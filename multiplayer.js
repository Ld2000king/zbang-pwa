// ============================================================================
// multiplayer.js - Real-multiplayer "Battle Royale with friends" via Firebase
// Realtime Database. Loads AFTER game.js so it can freely call its globals
// (renderBoard, showScreen, showMessage, activeBoardId, getAvatarById, icon,
//  showRoundEnd, launchConfetti, launchSparkles, generateBoard, findWordOnBoard,
//  autoShuffleIfExhausted, HEBREW_DICTIONARY, gameState, currentGame, ...).
//
// The single source of truth is /rooms/{roomCode} in RTDB. Every client renders
// from a shared on('value') listener; the host is authoritative for round
// start/advance/end to avoid race conditions.
// ============================================================================

const MP = {
    roomCode: null,
    playerId: null,
    isHost: false,
    roomRef: null,
    serverOffset: 0,   // ms difference between server clock and this device
    lastRound: 0,      // detect round changes to (re)render the board once
    timer: null,       // local countdown interval
    room: null,        // latest room snapshot
    matchType: null,   // 'random' while this room came from random matchmaking
    autoStarting: false, // guards against double-firing the random-match auto-start
    resultApplied: false, // guards against re-awarding coins/trophies on repeat 'finished' snapshots
    _freezeNotifiedFor: 0 // freezeUntil value already announced, so each freeze alerts once
};

const ROUND_SECONDS = 60;
const TOTAL_ROUNDS = 5;

// ---- helpers ---------------------------------------------------------------

function mpAvailable() {
    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !db) {
        showMessage('מולטיפלייר לא זמין - יש להגדיר Firebase (firebase-config.js)', 'error');
        return false;
    }
    return true;
}

// Wait for the anonymous sign-in to complete, but don't hang forever if it
// never does (e.g. network hiccup, or Anonymous auth disabled in Console).
function waitForAuth() {
    return Promise.race([
        authReady,
        new Promise((_, reject) => setTimeout(() => reject(new Error('auth-timeout')), 8000))
    ]);
}

function getMyPlayerId() {
    let id = sessionStorage.getItem('zabangPlayerId');
    if (!id) {
        id = db.ref().push().key;
        sessionStorage.setItem('zabangPlayerId', id);
    }
    return id;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O/1/I
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function myPlayerNode() {
    // uid binds this room slot to the authenticated Firebase user so Security
    // Rules can enforce that only THIS player edits their own score/data. It
    // must equal auth.uid (Rules reject any other value). Callers (createRoom /
    // joinRoom) always waitForAuth() first, so auth.currentUser is set here.
    const uid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;
    return { uid: uid, name: gameState.playerName, avatarId: gameState.avatarId, score: 0, eliminated: false, connected: true, freezeUntil: 0 };
}

// ---- navigation entry points ----------------------------------------------

function showMultiplayerChoice() {
    if (!mpAvailable()) return;
    showScreen('mpChoiceScreen');
}

function showJoinScreen() {
    showScreen('mpJoinScreen');
    const input = document.getElementById('joinCodeInput');
    if (input) { input.value = ''; input.focus(); }
}

// ---- create / join ---------------------------------------------------------

async function createRoom(opts = {}) {
    if (!mpAvailable()) return;
    try {
        await waitForAuth(); // Security Rules require auth != null - wait for anonymous sign-in first
    } catch (e) {
        showMessage('החיבור ל-Firebase נכשל - נסה שוב', 'error');
        return;
    }
    MP.playerId = getMyPlayerId();
    MP.isHost = true;
    MP.matchType = opts.matchType || 'friends';

    // find an unused code
    let code;
    for (let attempt = 0; attempt < 10; attempt++) {
        code = generateRoomCode();
        const snap = await db.ref('rooms/' + code).once('value');
        if (!snap.exists()) break;
    }
    MP.roomCode = code;

    // Board skin for the whole match. Random 1v1: the arena of the creator's
    // current trophy tier. Friends: the host's chosen preferred theme. Both
    // players then render the same skin from this shared room field.
    const boardTheme = MP.matchType === 'random'
        ? getArenaIndex(gameState.trophies)
        : preferredThemeIndex();

    await db.ref('rooms/' + code).set({
        status: 'waiting',
        hostId: MP.playerId,
        matchType: MP.matchType,
        boardTheme: boardTheme,
        currentRound: 0,
        totalRounds: TOTAL_ROUNDS,
        roundDurationSec: ROUND_SECONDS,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        players: { [MP.playerId]: myPlayerNode() }
    });

    attachPresence();
    listenToRoom(code);
    if (!opts.silent) showScreen('mpLobbyScreen');
}

function joinRoomFromInput() {
    const input = document.getElementById('joinCodeInput');
    const code = (input.value || '').trim().toUpperCase();
    if (code.length !== 5) { showMessage('קוד חדר צריך להיות 5 תווים', 'error'); return; }
    joinRoom(code);
}

async function joinRoom(code, opts = {}) {
    if (!mpAvailable()) return false;
    try {
        await waitForAuth(); // Security Rules require auth != null - wait for anonymous sign-in first
    } catch (e) {
        if (!opts.silent) showMessage('החיבור ל-Firebase נכשל - נסה שוב', 'error');
        return false;
    }
    MP.playerId = getMyPlayerId();
    MP.isHost = false;

    const snap = await db.ref('rooms/' + code).once('value');
    if (!snap.exists()) { if (!opts.silent) showMessage('חדר לא נמצא', 'error'); return false; }
    const room = snap.val();
    if (room.status !== 'waiting') { if (!opts.silent) showMessage('המשחק כבר התחיל', 'error'); return false; }

    MP.roomCode = code;
    MP.matchType = room.matchType || 'friends';
    await db.ref('rooms/' + code + '/players/' + MP.playerId).set(myPlayerNode());

    attachPresence();
    listenToRoom(code);
    if (!opts.silent) showScreen('mpLobbyScreen');
    return true;
}

// mark this player disconnected if the tab closes / network drops
function attachPresence() {
    const connRef = db.ref('rooms/' + MP.roomCode + '/players/' + MP.playerId + '/connected');
    connRef.onDisconnect().set(false);
    // keep the server clock offset up to date for a synced countdown
    db.ref('.info/serverTimeOffset').on('value', s => { MP.serverOffset = s.val() || 0; });
}

// ---- the single shared realtime listener -----------------------------------

function listenToRoom(code) {
    MP.roomRef = db.ref('rooms/' + code);
    MP.roomRef.on('value', snap => {
        const room = snap.val();
        if (!room) { // room was deleted
            showMessage('החדר נסגר', 'warning');
            leaveMultiplayerRoom();
            showScreen('homeScreen');
            updateHomeUI();
            return;
        }
        MP.room = room;
        onRoomUpdate(room);
    });
}

function onRoomUpdate(room) {
    currentGame.mode = 'multiplayer';

    if (room.status === 'waiting') {
        if (room.matchType === 'random') {
            handleRandomWaitingRoom(room);
        } else {
            renderLobby(room);
        }
        return;
    }

    // host-disconnect guard
    const host = room.players && room.players[room.hostId];
    if (host && host.connected === false && room.status !== 'finished') {
        showMessage('המארח התנתק - צאו למסך הבית', 'warning');
    }

    if (room.status === 'playing') {
        // never let a leftover bots battle bleed into a real multiplayer game:
        // kill any bot interval and drop stale bots so they can't be rendered
        // into the shared player-status strip alongside the real players
        if (typeof stopBotAI === 'function') stopBotAI();
        if (typeof battleState !== 'undefined') battleState.players = [];
        // (re)render the board once per new round
        if (room.currentRound !== MP.lastRound) {
            MP.lastRound = room.currentRound;
            currentGame.board = room.board.slice();
            currentGame.foundWords = new Set();
            currentGame.playerScore = (room.players[MP.playerId] || {}).score || 0;
            currentGame.gameActive = true;
            document.getElementById('roundBadge').textContent = `סיבוב ${room.currentRound}/${room.totalRounds}`;
            document.getElementById('playerBattleScore').textContent = currentGame.playerScore;
            renderBoard('battleBoard');
            applyBoardTheme('battleBoard', room.boardTheme || 0);
            // "shuffle opponents' score" makes no sense against real people - hide it.
            // Pause is also disabled in multiplayer (can't freeze real opponents'
            // clocks), so hide the pause button and keep the direct home button.
            const shuffleBtn = document.getElementById('battleShuffleBtn');
            if (shuffleBtn) shuffleBtn.style.display = 'none';
            const battlePauseBtn = document.getElementById('battlePauseBtn');
            if (battlePauseBtn) battlePauseBtn.style.display = 'none';
            const battleExitBtn = document.getElementById('battleExitBtn');
            if (battleExitBtn) battleExitBtn.style.display = '';
            showScreen('battleScreen');
            startMultiplayerTimer(room);
        }
        updateMultiplayerUI(room);
        applyFreezeFromRoom(room);
    } else if (room.status === 'roundEnd') {
        stopMultiplayerTimer();
        showMultiplayerRoundEnd(room);
    } else if (room.status === 'finished') {
        stopMultiplayerTimer();
        showMultiplayerResult(room);
    }
}

// ---- lobby -----------------------------------------------------------------

function renderLobby(room) {
    document.getElementById('lobbyRoomCode').textContent = MP.roomCode;

    const listEl = document.getElementById('lobbyPlayers');
    listEl.innerHTML = '';
    Object.entries(room.players || {}).forEach(([pid, p]) => {
        const isSelf = pid === MP.playerId;
        listEl.innerHTML += `<div class="player-status${isSelf ? ' self' : ''}">
            <div class="status-avatar">${getAvatarById(p.avatarId).svg}</div>
            <span>${escapeHtml(p.name)}${pid === room.hostId ? ' 👑' : ''}</span>
        </div>`;
    });

    const startBtn = document.getElementById('lobbyStartBtn');
    const waiting = document.getElementById('lobbyWaiting');
    const canStart = MP.isHost && Object.keys(room.players || {}).length >= 2;
    startBtn.style.display = canStart ? 'block' : 'none';
    waiting.style.display = MP.isHost
        ? (canStart ? 'none' : 'block')
        : 'block';
    if (MP.isHost && !canStart) waiting.textContent = 'ממתין לשחקנים נוספים שיצטרפו...';
    else if (!MP.isHost) waiting.textContent = 'ממתין למארח שיתחיל את המשחק...';
}

function copyRoomCode() {
    if (!MP.roomCode) return;
    if (navigator.clipboard) navigator.clipboard.writeText(MP.roomCode).catch(() => {});
    const copied = document.getElementById('lobbyCopied');
    if (copied) { copied.style.display = 'block'; setTimeout(() => copied.style.display = 'none', 1500); }
}

// ---- random matchmaking ------------------------------------------------
// Data model: matchmaking_queue/{playerId} = { roomCode, createdAt }.
// One node per player (not one shared "current waiter" slot) so that an
// onDisconnect().remove() registered on our own ticket can never delete
// someone else's ticket, no matter how the matching races play out.

function matchmakingQueueRef(playerId) {
    return db.ref('matchmaking_queue/' + playerId);
}

function setSearchStatusText(text) {
    const el = document.getElementById('searchStatusText');
    if (el) el.textContent = text;
}

async function findRandomGame() {
    if (!mpAvailable()) return;
    // show the loading screen BEFORE awaiting auth - the anonymous sign-in
    // can take up to 8s on a cold/slow connection, and with no immediate
    // feedback the button click looks completely dead
    setSearchStatusText('מתחבר...');
    showScreen('mpSearchScreen');
    try {
        await waitForAuth(); // Security Rules require auth != null - wait for anonymous sign-in first
    } catch (e) {
        showMessage('החיבור ל-Firebase נכשל - נסה שוב', 'error');
        showScreen('gameModeScreen');
        return;
    }
    MP.playerId = getMyPlayerId();
    setSearchStatusText('מחפש יריב זמין...');

    try {
        const opponent = await findWaitingOpponent();
        if (opponent && await tryJoinOpponent(opponent)) return;
        await becomeWaitingPlayer();
    } catch (e) {
        console.error('Matchmaking failed:', e);
        showMessage('החיפוש נכשל - נסה שוב', 'error');
        showScreen('gameModeScreen');
    }
}

// look for the longest-waiting opponent already sitting in the queue
async function findWaitingOpponent() {
    const snap = await db.ref('matchmaking_queue').once('value');
    const all = snap.val() || {};
    const candidates = Object.entries(all)
        .filter(([pid]) => pid !== MP.playerId)
        .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
    return candidates.length ? { playerId: candidates[0][0], roomCode: candidates[0][1].roomCode } : null;
}

// atomically claim someone's queue ticket so two seekers can never both
// grab the same waiting player - the transaction only commits for whoever
// gets there first, the loser falls back to becoming the new waiter.
//
// IMPORTANT: never abort (return undefined) based on the callback's `current`
// argument. On a path with no live local listener the SDK seeds the very
// first invocation with a phantom "unknown -> assume null" guess regardless
// of the real server value; returning undefined here reads as a deliberate
// cancel, so Firebase does NOT retry with the real data and the transaction
// permanently fails even though a real ticket exists (verified: 100%
// reproducible before this fix). Instead always return null (a harmless
// no-op if the ticket is genuinely already gone) and inspect whatever
// `current` was on the invocation that actually committed.
async function tryJoinOpponent(opponent) {
    const ref = matchmakingQueueRef(opponent.playerId);
    let lastSeen;
    const result = await ref.transaction(current => { lastSeen = current; return null; });
    if (!result.committed || lastSeen === null || lastSeen === undefined) return false; // nothing real to claim

    // rare race: the host may have canceled/closed right as we claimed them
    const snap = await db.ref('rooms/' + opponent.roomCode).once('value');
    if (!snap.exists() || snap.val().status !== 'waiting') return false;

    const joined = await joinRoom(opponent.roomCode, { silent: true });
    if (!joined) return false;
    setSearchStatusText('נמצא יריב! מתחילים...');
    return true;
}

// no one is waiting - open a fresh room and put myself in the queue
async function becomeWaitingPlayer() {
    await createRoom({ matchType: 'random', silent: true });
    await matchmakingQueueRef(MP.playerId).set({
        roomCode: MP.roomCode,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    // ghost-request cleanup: closing the tab while still alone removes both
    // the queue ticket and the empty room. Cancelled the moment an opponent joins.
    matchmakingQueueRef(MP.playerId).onDisconnect().remove();
    db.ref('rooms/' + MP.roomCode).onDisconnect().remove();
    showScreen('mpSearchScreen');
    scheduleDoubleWaiterCheck();
}

// Self-heals the case where two players clicked at almost the exact same
// instant: both read an empty queue and both became their own lone waiter,
// so neither would otherwise ever find the other. A short re-scan catches
// this. The ID tie-break (only the smaller playerId acts) guarantees that
// if both sides run this check, only one of them attempts a claim - so this
// fix can't itself create a new mutual-claim race.
function scheduleDoubleWaiterCheck() {
    const myCode = MP.roomCode;
    setTimeout(async () => {
        // bail if anything changed since scheduling: matched normally,
        // canceled, or navigated away
        if (MP.matchType !== 'random' || !MP.isHost || MP.roomCode !== myCode) return;
        if (!MP.room || Object.keys(MP.room.players || {}).length >= 2) return;

        try {
            const opponent = await findWaitingOpponent();
            if (!opponent || MP.playerId > opponent.playerId) return; // nothing to claim, or it's their job to claim me

            const oldRoomRef = MP.roomRef; // capture before joinRoom() reassigns MP.roomRef
            const claimed = await tryJoinOpponent(opponent);
            if (!claimed) return;

            // moved into their room - shed my own now-abandoned room and ticket
            if (oldRoomRef) oldRoomRef.off();
            db.ref('rooms/' + myCode).onDisconnect().cancel();
            db.ref('rooms/' + myCode).remove().catch(() => {});
            matchmakingQueueRef(MP.playerId).onDisconnect().cancel();
            matchmakingQueueRef(MP.playerId).remove().catch(() => {});
        } catch (e) {
            console.error('Double-waiter self-heal failed:', e);
        }
    }, 1500);
}

// called from onRoomUpdate while a random-match room is still 'waiting'
function handleRandomWaitingRoom(room) {
    const count = Object.keys(room.players || {}).length;
    if (count < 2) {
        showScreen('mpSearchScreen');
        return;
    }
    // matched - normal presence tracking takes over from here, so drop the
    // "delete on disconnect" safety nets meant only for the lone-waiter window
    if (MP.isHost) {
        db.ref('rooms/' + MP.roomCode).onDisconnect().cancel();
        matchmakingQueueRef(MP.playerId).remove();
        matchmakingQueueRef(MP.playerId).onDisconnect().cancel();
        if (!MP.autoStarting) {
            MP.autoStarting = true;
            startMultiplayerRound(1);
        }
    }
    setSearchStatusText('נמצא יריב! מתחילים...');
}

// user pressed "cancel" while still searching / waiting for an opponent
async function cancelRandomSearch() {
    const code = MP.roomCode;
    const wasSoloHost = MP.isHost && MP.room && Object.keys(MP.room.players || {}).length <= 1;

    // best-effort cleanup - a failed/slow Firebase write must never strand
    // the user on the search screen with no way back
    if (MP.playerId && db) {
        matchmakingQueueRef(MP.playerId).onDisconnect().cancel();
        try { await matchmakingQueueRef(MP.playerId).remove(); } catch (e) { console.error('Queue cleanup failed:', e); }
    }

    leaveMultiplayerRoom();
    if (wasSoloHost && code) db.ref('rooms/' + code).remove().catch(() => {}); // no ghost room left behind

    showScreen('gameModeScreen');
    updateHomeUI();
}

// ---- host: start / advance rounds ------------------------------------------

function hostStartMultiplayerGame() {
    if (!MP.isHost) return;
    startMultiplayerRound(1);
}

function startMultiplayerRound(roundNum) {
    if (!MP.isHost) return;
    const board = generateBoard();
    const updates = {
        status: 'playing',
        currentRound: roundNum,
        board: board,
        roundStartTime: firebase.database.ServerValue.TIMESTAMP
    };
    // reset every non-eliminated player's per-round score/foundWords
    Object.entries(MP.room.players || {}).forEach(([pid, p]) => {
        if (!p.eliminated) {
            updates['players/' + pid + '/score'] = 0;
            updates['players/' + pid + '/foundWords'] = null;
            updates['players/' + pid + '/freezeUntil'] = 0;
        }
    });
    MP.roomRef.update(updates);
}

function hostNextMultiplayerRound() {
    if (!MP.isHost) return;
    startMultiplayerRound((MP.room.currentRound || 1) + 1);
}

// ---- synced timer ----------------------------------------------------------

function startMultiplayerTimer(room) {
    stopMultiplayerTimer();
    MP.timer = setInterval(() => {
        const timerEl = document.getElementById('battleTimerDisplay');
        const now = Date.now() + MP.serverOffset;

        // Frozen by an opponent: paint the ice state and drive the board
        // lockout overlay. The round clock itself keeps running - it is
        // server-timed and shared, so the round must still end on schedule
        // for everyone (the old early-return also meant a player frozen at
        // the buzzer never reached the remaining<=0 branch, so a frozen host
        // never wrote the round result).
        const frozenMs = mpFreezeMsLeft();
        timerEl.classList.toggle('frozen', frozenMs > 0);
        renderFreezeOverlay(frozenMs);

        const elapsed = (now - (room.roundStartTime || now)) / 1000;
        const remaining = Math.max(0, Math.ceil((room.roundDurationSec || ROUND_SECONDS) - elapsed));
        timerEl.textContent = remaining;

        if (remaining <= 0) {
            stopMultiplayerTimer();
            currentGame.gameActive = false;
            // only the host writes the authoritative round result
            if (MP.isHost) endMultiplayerRound();
        }
    }, 250);
}

function stopMultiplayerTimer() {
    if (MP.timer) { clearInterval(MP.timer); MP.timer = null; }
    renderFreezeOverlay(0); // never leave the lockout on a screen we left
}

// ---- host: authoritative round end -----------------------------------------

function endMultiplayerRound() {
    if (!MP.isHost) return;
    const players = MP.room.players || {};
    const active = Object.entries(players).filter(([, p]) => !p.eliminated);

    // pick the loser: disconnected first, then lowest score
    active.sort((a, b) => {
        const [, pa] = a, [, pb] = b;
        if ((pa.connected === false) !== (pb.connected === false)) return pa.connected === false ? -1 : 1;
        return (pa.score || 0) - (pb.score || 0);
    });
    const [loserId] = active[0] || [];

    const isFinal = (MP.room.currentRound || 1) >= (MP.room.totalRounds || TOTAL_ROUNDS);
    const remainingAfter = active.length - 1;
    const updates = {};

    // A genuine head-to-head (exactly 2 still active - always true for a
    // random-matched 1v1, and also true for the deciding round of a larger
    // battle once it's down to the last two) that ends tied - with both
    // players actually connected - has no legitimate loser to eliminate.
    // Call it a draw instead of letting the sort's stable tie-break
    // arbitrarily pick one.
    const isTiedHeadToHead = (isFinal || remainingAfter <= 1) && active.length === 2
        && active.every(([, p]) => p.connected !== false)
        && (active[0][1].score || 0) === (active[1][1].score || 0);

    if (isTiedHeadToHead) {
        updates['status'] = 'finished';
        updates['isDraw'] = true;
        updates['winnerId'] = '';
        updates['loserId'] = '';
    } else {
        if (loserId) updates['players/' + loserId + '/eliminated'] = true;
        if (isFinal || remainingAfter <= 1) {
            // winner = the highest scorer among the still-active (non-loser) players
            const survivors = active.filter(([pid]) => pid !== loserId);
            survivors.sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
            updates['status'] = 'finished';
            updates['winnerId'] = survivors.length ? survivors[0][0] : loserId;
            updates['loserId'] = loserId || '';
        } else {
            updates['status'] = 'roundEnd';
            updates['loserId'] = loserId || '';
        }
    }
    MP.roomRef.update(updates);
}

// ---- round-end & final screens ---------------------------------------------

function buildStandings(room) {
    return Object.values(room.players || {})
        .map(p => ({ name: p.name, score: p.score || 0 }))
        .sort((a, b) => b.score - a.score);
}

function showMultiplayerRoundEnd(room) {
    const standings = buildStandings(room);
    const loserName = (room.players[room.loserId] || {}).name || '';
    // reuse the existing round-end UI renderer
    showRoundEnd(standings, loserName);

    const iWasEliminated = room.loserId === MP.playerId;
    const nextBtn = document.getElementById('nextRoundBtn');
    const waiting = document.getElementById('roundEndWaiting');
    if (iWasEliminated) {
        // eliminated players go straight to a "you're out" result and can leave
        document.getElementById('eliminationNotice').textContent = 'הודחת מהמשחק!';
    }
    // only the host advances the round
    if (nextBtn) nextBtn.style.display = MP.isHost ? 'block' : 'none';
    if (waiting) waiting.style.display = MP.isHost ? 'none' : 'block';
}

function showMultiplayerResult(room) {
    const title = document.getElementById('victoryTitle');
    const subtitle = document.getElementById('victorySubtitle');
    const rewards = document.getElementById('victoryRewards');
    const isRandom1v1 = room.matchType === 'random';

    const playAgainBtn = document.getElementById('playAgainRandomBtn');
    if (playAgainBtn) playAgainBtn.style.display = isRandom1v1 ? 'block' : 'none';

    // the room's 'finished' snapshot can re-fire (e.g. an opponent's presence
    // flag changing) - only apply coins/trophies once per match
    const alreadyApplied = MP.resultApplied;
    MP.resultApplied = true;

    if (room.isDraw) {
        title.textContent = 'תיקו!';
        subtitle.textContent = 'שני הצדדים סיימו בניקוד שווה';
        rewards.innerHTML = '';
        if (!alreadyApplied && isRandom1v1) awardTrophies(0, 'תיקו');
    } else if (room.winnerId === MP.playerId) {
        title.innerHTML = `${icon('trophy')} ניצחת! ${icon('trophy')}`;
        subtitle.textContent = isRandom1v1 ? 'ניצחת את היריב!' : 'ניצחת את כל החברים!';
        rewards.innerHTML = `<div class="reward-box"><span class="coin-icon icon">${ICONS.coin}</span><span>+100 מטבעות!</span></div>`;
        launchConfetti();
        if (!alreadyApplied) {
            gameState.coins += 100;
            saveGameState();
            updateHomeUI();
            if (isRandom1v1) awardTrophies(20, 'ניצחון');
        }
    } else {
        const winnerName = (room.players[room.winnerId] || {}).name || 'שחקן אחר';
        title.innerHTML = `${icon('close')} המשחק נגמר ${icon('close')}`;
        subtitle.textContent = `${winnerName} ניצח/ה את המשחק`;
        rewards.innerHTML = '';
        if (!alreadyApplied && isRandom1v1) awardTrophies(-10, 'הפסד');
    }
    showScreen('victoryScreen');
}

// Immediately re-enters random matchmaking from the match-end screen,
// without routing back through the home/mode-selection menus.
function playAgainRandom() {
    leaveMultiplayerRoom(); // detach the finished room's listener, clear matchmaking state
    findRandomGame();
}

// ---- word submission (called from game.js endDrag) -------------------------

function submitMultiplayerWord(word, newTotalScore) {
    if (!MP.roomCode || !MP.playerId) return;
    if (mpFreezeMsLeft() > 0) return; // last line of defence: no scoring while frozen
    const base = 'rooms/' + MP.roomCode + '/players/' + MP.playerId;
    db.ref(base + '/score').set(newTotalScore);
    db.ref(base + '/foundWords/' + word).set(true);
}

// ---- opponents UI ----------------------------------------------------------

function updateMultiplayerUI(room) {
    const statusEl = document.getElementById('playersStatus');
    if (!statusEl) return;
    statusEl.innerHTML = '';
    Object.entries(room.players || {}).forEach(([pid, p]) => {
        if (p.eliminated) return;
        const isSelf = pid === MP.playerId;
        const dim = p.connected === false ? ' style="opacity:.5"' : '';
        statusEl.innerHTML += `<div class="player-status${isSelf ? ' self' : ''}"${dim}>
            <div class="status-avatar">${getAvatarById(p.avatarId).svg}</div>
            <span>${isSelf ? 'אתה' : escapeHtml(p.name)}</span><span>${p.score || 0}</span>
        </div>`;
    });
    // keep my own big score display in sync with the server value
    const me = (room.players || {})[MP.playerId];
    if (me) document.getElementById('playerBattleScore').textContent = me.score || 0;
}

// ---- power-ups (multiplayer variants) --------------------------------------

function useMultiplayerHint() {
    if (blockedByFreeze()) return;
    if (!canPayForItem('hint')) return;

    let indices = findWordOnBoard();
    if (indices.length === 0) { autoShuffleIfExhausted(); indices = findWordOnBoard(); if (indices.length === 0) return; }

    const word = indices.map(i => currentGame.board[i]).join('');
    const points = HEBREW_DICTIONARY[word];

    consumeItemPayment('hint');
    currentGame.foundWords.add(word);
    currentGame.playerScore += points;
    document.getElementById('playerBattleScore').textContent = currentGame.playerScore;
    submitMultiplayerWord(word, currentGame.playerScore);
    saveGameState();
    updateHomeUI();

    const tiles = document.querySelectorAll('#battleBoard .letter-tile');
    indices.forEach(i => tiles[i]?.classList.add('selected'));
    setTimeout(() => tiles.forEach(t => t.classList.remove('selected')), 1500);

    showMessage(`${word} - כל הכבוד! +${points}`, 'success');
    launchSparkles();
}

// ---- freeze state ----------------------------------------------------------

// Milliseconds left on a freeze an opponent put on ME (0 when not frozen).
// This is the authority the board input handlers in game.js consult, so a
// freeze actually locks the victim out instead of only stopping their clock.
function mpFreezeMsLeft() {
    if (currentGame.mode !== 'multiplayer' || !MP.room || !MP.playerId) return 0;
    const me = (MP.room.players || {})[MP.playerId];
    if (!me || !me.freezeUntil) return 0;
    return Math.max(0, me.freezeUntil - (Date.now() + MP.serverOffset));
}

// Full-board "you are frozen" curtain with a live countdown. It also swallows
// pointer events, so a stray tap can't reach a tile underneath.
function renderFreezeOverlay(msLeft) {
    const board = document.getElementById('battleBoard');
    if (!board) return;
    let overlay = document.getElementById('battleFreezeOverlay');

    if (msLeft <= 0) {
        if (overlay) overlay.remove();
        board.classList.remove('board-frozen');
        return;
    }

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'battleFreezeOverlay';
        overlay.className = 'board-freeze-overlay';
        overlay.innerHTML = '<div class="freeze-label">הוקפאת!</div><div class="freeze-count"></div>';
        board.appendChild(overlay);
    } else if (overlay.parentElement !== board) {
        board.appendChild(overlay); // renderBoard() wipes the board's children
    }
    board.classList.add('board-frozen');
    overlay.querySelector('.freeze-count').textContent = Math.ceil(msLeft / 1000);
    if (isDragging) cancelDrag(); // a freeze mid-drag drops the selection at once
}

// freeze the current highest-scoring opponent for 8 seconds (on their device)
function useMultiplayerFreeze() {
    if (blockedByFreeze()) return;
    if (!canPayForItem('freezeOpponents')) return;
    const players = (MP.room || {}).players || {};
    const opponents = Object.entries(players)
        .filter(([pid, p]) => pid !== MP.playerId && !p.eliminated && p.connected !== false)
        .sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
    if (opponents.length === 0) { showMessage('אין יריבים להקפיא', 'warning'); return; }

    consumeItemPayment('freezeOpponents');
    saveGameState();
    updateHomeUI();

    const [targetId, target] = opponents[0];
    const until = Date.now() + MP.serverOffset + 8000;
    db.ref('rooms/' + MP.roomCode + '/players/' + targetId + '/freezeUntil').set(until);
    showMessage(`${target.name} הוקפא/ה ל-8 שניות!`, 'info');
}

// react to a freeze written to MY node by an opponent: lock the board right
// away rather than waiting for the next timer tick, and announce it once
function applyFreezeFromRoom(room) {
    const me = (room.players || {})[MP.playerId];
    if (!me) return;
    const until = me.freezeUntil || 0;
    const msLeft = Math.max(0, until - (Date.now() + MP.serverOffset));

    renderFreezeOverlay(msLeft);

    // keyed by the freeze's timestamp, so back-to-back freezes from different
    // opponents each get their own alert - and a re-render of the same freeze
    // never re-alerts
    if (msLeft > 0 && MP._freezeNotifiedFor !== until) {
        MP._freezeNotifiedFor = until;
        showMessage('הוקפאת על ידי יריב!', 'warning');
    }
}

// ---- power-up dispatchers (battle screen is shared bots/multiplayer) --------

function handleBattleHint() {
    if (currentGame.mode === 'multiplayer') useMultiplayerHint();
    else useBattleHint();
}

function handleBattleFreeze() {
    if (currentGame.mode === 'multiplayer') useMultiplayerFreeze();
    else useBattleFreeze();
}

// ---- leave / cleanup -------------------------------------------------------

function leaveMultiplayerRoom() {
    stopMultiplayerTimer();
    // defensive matchmaking cleanup - a safe no-op for friends-mode games,
    // and covers stray exits (e.g. goHome) while a random search is pending
    if (MP.playerId && db) {
        matchmakingQueueRef(MP.playerId).remove().catch(() => {});
        matchmakingQueueRef(MP.playerId).onDisconnect().cancel();
    }
    if (MP.matchType === 'random' && MP.roomCode && db) {
        db.ref('rooms/' + MP.roomCode).onDisconnect().cancel();
    }
    if (MP.roomRef) { MP.roomRef.off(); MP.roomRef = null; }
    if (MP.roomCode && MP.playerId && db) {
        // if we're still just waiting in the lobby, remove our slot entirely
        if (MP.room && MP.room.status === 'waiting') {
            db.ref('rooms/' + MP.roomCode + '/players/' + MP.playerId).remove();
        } else {
            db.ref('rooms/' + MP.roomCode + '/players/' + MP.playerId + '/connected').set(false);
        }
    }
    MP.roomCode = null;
    MP.isHost = false;
    MP.room = null;
    MP.lastRound = 0;
    MP.matchType = null;
    MP.autoStarting = false;
    MP.resultApplied = false;
    MP._freezeNotifiedFor = 0;
    if (currentGame.mode === 'multiplayer') currentGame.mode = null;
}
