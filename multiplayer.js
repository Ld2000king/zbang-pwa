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
    _freezeNotifiedFor: 0, // freezeUntil value already announced, so each freeze alerts once
    spectating: false, // eliminated player chose "watch the rest" - hides the elimination overlay
    rematchRequested: false, // I pressed "play again" as a guest and am waiting for the host's client to reset the room
    rematching: false, // host-side guard so a repeat 'finished' snapshot can't fire the room reset twice
    friendsTotalRounds: 0, // friends match length, fixed when round 1 starts (players - 1)
    joinAcked: false, // my join write reached the server - only then may I judge a full room
    startingRound: 0, // host-side guard: the round already being started (double-tap on start/next)
    presenceRef: null, // .info/connected listener that re-announces me after a dropped connection
    dropout: null, // { reason: 'host' | 'alone', timer } while a friends match waits out its grace period
    endRoundDeferred: false // host: the clock hit 0 during that grace period - end the round if they return
};

const ROUND_SECONDS = 60;
const TOTAL_ROUNDS = 5;
// A friends room holds the host plus up to 5 guests. One player is knocked out
// per round, so a match of N players lasts N - 1 rounds (2 -> 1 ... 6 -> 5).
const FRIENDS_MAX_PLAYERS = 6;
// A tie for last place in a friends match replays the same round instead of
// knocking someone out. Capped per match, so two idle players stuck on 0
// can't loop forever - past it, the old tie-break applies (see
// endMultiplayerRound).
const MAX_TIE_REPLAYS = 3;

// The round number players see. room.currentRound always moves forward (so
// every client, older builds included, notices a new round), and room.replays
// counts the tie replays - a replay shows the same number again.
function displayedRound(room) {
    return (room.currentRound || 1) - (room.replays || 0);
}

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
    // photoData is a small (64px, low-quality JPEG) base64 data URL - see
    // handleCustomAvatarFile()/resizeImageToDataUrl() in game.js. It's kept
    // tiny on purpose: this whole room object re-downloads on every update
    // for every player in the room, not just its owner, and there's no
    // Firebase Storage in play here (that needs the paid Blaze plan; this
    // project stays on the free Spark plan), so the photo itself has to fit
    // directly inside the database. null here just omits the field
    // (Firebase treats a null leaf as "don't write it").
    const photoData = localStorage.getItem('zabangCustomAvatarSync') || null;
    return { uid: uid, name: gameState.playerName, avatarId: networkSafeAvatarId(), photoData: photoData, score: 0, eliminated: false, connected: true, freezeUntil: 0 };
}

// Called after a fresh avatar photo finishes its (local, no-upload) resize -
// pushes the new thumbnail straight into the room I'm currently in, if any,
// so friends already mid-match see it without me having to leave and rejoin.
function syncMyPhotoToRoom(dataUrl) {
    if (!MP.roomCode || !MP.playerId || !db) return;
    db.ref('rooms/' + MP.roomCode + '/players/' + MP.playerId + '/photoData').set(dataUrl).catch(() => {});
}

// Shared by renderLobby()/updateMultiplayerUI(): my own photo comes straight
// from local storage (the full-quality 160px copy, instant, works offline);
// an opponent's comes from their synced photoData thumbnail if they have
// one, else their preset avatarId.
function avatarMarkupForPlayer(pid, p) {
    if (pid === MP.playerId) return getOwnAvatarMarkup();
    // a blocked player's photo is never shown (moderation.js)
    if (p.photoData && !isPlayerBlocked(p.uid)) return `<img src="${escapeHtml(p.photoData)}" alt="" class="custom-avatar-img">`;
    return getAvatarById(p.avatarId).svg;
}

// ---- navigation entry points ----------------------------------------------

function showMultiplayerChoice() {
    if (!mpAvailable()) return;
    if (needsModeHelp('friends', showMultiplayerChoice)) return;
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

    // Kept for older clients still in the wild, which read this field to skin
    // the board. Current clients ignore it and show each player's own city
    // theme (see the round render below).
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

    const isFriends = (room.matchType || 'friends') === 'friends';
    if (isFriends && friendsLobbyPlayers(room).filter(([pid]) => pid !== MP.playerId).length >= FRIENDS_MAX_PLAYERS) {
        if (!opts.silent) showMessage('החדר מלא - עד 6 שחקנים', 'error');
        return false;
    }

    MP.roomCode = code;
    MP.matchType = room.matchType || 'friends';
    MP.joinAcked = false;
    const node = myPlayerNode();
    // Friends rooms: stamp the join with the server clock so every client can
    // agree who came first if two people grab the last seat at once (see
    // friendsSeatLost). It rides on freezeUntil - an existing field the Rules
    // already let me set on my own node - and a freeze that ends "now" is
    // already over, so it never freezes anyone. The host clears it to 0 when
    // the match starts.
    if (isFriends) node.freezeUntil = firebase.database.ServerValue.TIMESTAMP;
    await db.ref('rooms/' + code + '/players/' + MP.playerId).set(node);
    MP.joinAcked = true;

    attachPresence();
    listenToRoom(code);
    if (!opts.silent) showScreen('mpLobbyScreen');
    return true;
}

// mark this player disconnected if the tab closes / network drops
function attachPresence() {
    const code = MP.roomCode;
    const connRef = db.ref('rooms/' + code + '/players/' + MP.playerId + '/connected');
    connRef.onDisconnect().set(false);
    // keep the server clock offset up to date for a synced countdown
    db.ref('.info/serverTimeOffset').on('value', s => { MP.serverOffset = s.val() || 0; });

    // A dropped connection fires the onDisconnect above (connected: false),
    // and that handler is then used up. When the connection comes back, say
    // "I'm here" again and re-arm it - otherwise a 2-second network blip would
    // read as gone for the rest of the match. A transaction, so it only flips
    // a slot that still exists: if the room was deleted meanwhile it aborts
    // instead of writing a stray node into a closed room.
    if (MP.presenceRef) MP.presenceRef.off();
    let dropped = false;
    MP.presenceRef = db.ref('.info/connected');
    MP.presenceRef.on('value', snap => {
        if (snap.val() !== true) { dropped = true; return; }
        if (!dropped || MP.roomCode !== code) return;
        dropped = false;
        connRef.onDisconnect().set(false);
        // applyLocally=false: no optimistic local copy - if the room is gone,
        // a local "connected: true" would briefly show this client a room
        // holding only itself (and its rollback trips a Firebase SDK assert)
        connRef.transaction(cur => (cur === null ? undefined : true), undefined, false).catch(() => {});
    });
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
            // a match already ran in this room: the host pressed "play again",
            // so pull everyone still on the end screen back into the lobby
            if (MP.lastRound !== 0 || MP.resultApplied) resetLocalMatchState();
            if (friendsSeatLost(room)) {
                leaveMultiplayerRoom();
                showMessage('החדר מלא - עד 6 שחקנים', 'error');
                showScreen('gameModeScreen');
                updateHomeUI();
                return;
            }
            renderLobby(room);
        }
        return;
    }

    // host gone (friends and random) / everyone else gone (friends) - see below
    watchFriendsDropouts(room);

    if (room.status === 'playing') {
        // the round is live - the matchmaking intro (if any) is over
        if (MM.phase !== 'idle') mmIntroReset();
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
            // Round counter: a random 1v1 and a 2-player friends match are a
            // single round, so they show none. A bigger friends match shows
            // "round r / total", total fixed when round 1 starts. Bots mode
            // brings the counter back in startBattleRound().
            const total = room.matchType === 'friends' ? friendsMatchRounds(room) : 1;
            const roundBadge = document.getElementById('roundBadge');
            roundBadge.textContent = `סיבוב ${displayedRound(room)}/${total}`;
            roundBadge.style.display = total >= 2 ? '' : 'none';
            document.getElementById('playerBattleScore').textContent = currentGame.playerScore;
            renderBoard('battleBoard');
            // each player sees the board in their OWN city theme (the room's
            // shared boardTheme field is still written, but no longer read)
            applyBoardTheme('battleBoard', preferredThemeIndex());
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
        // An eliminated player can't keep scoring off the board they're stuck
        // looking at - hide the power-ups (nothing left to spend them on) and
        // surface the "watch / go home / new game" choice instead.
        const iAmEliminated = amIEliminatedMP();
        const powerUpsRow = document.getElementById('battlePowerUpsRow');
        if (powerUpsRow) powerUpsRow.style.display = iAmEliminated ? 'none' : '';
        renderEliminatedOverlay(iAmEliminated && !MP.spectating);
    } else if (room.status === 'roundEnd') {
        stopMultiplayerTimer();
        showMultiplayerRoundEnd(room);
    } else if (room.status === 'finished') {
        stopMultiplayerTimer();
        showMultiplayerResult(room);
        // a guest pressed "play again" - only the host may reset the room, so
        // the host's client does it on their behalf
        if (MP.isHost && room.matchType !== 'random' && !MP.rematching) {
            const guestWantsRematch = Object.entries(room.players || {})
                .some(([pid, p]) => pid !== MP.playerId && p.rematch === true && p.connected !== false);
            if (guestWantsRematch) hostRematchFriends();
        }
    }
}

// ---- host gone / left alone (friends; random gets the host part) ---------
// Only the host can end a round or start the next one, so a friends match
// whose host has dropped out can't go on - everyone else would sit on a
// frozen 0. And a player whose opponents have all left has nobody to play.
// Either way, after a short grace period (a connection that drops and comes
// straight back - see attachPresence - cancels it) this client leaves the
// room and returns to the mode list. Nothing is written for the others and
// no result screen is shown, so nobody is awarded a win, coins or trophies
// for a match that simply stopped. A real win (the last player standing
// after the eliminations) arrives as status 'finished' and is untouched.
// The lobby is left alone too: a host may wait there by themselves.

const MP_DROPOUT_GRACE_MS = 5000;

// A random 1v1 gets only the host half of this: its host also runs the clock,
// so a vanished host leaves the guest stuck the same way. A vanished GUEST is
// still the host's win by forfeit there, as before - 'alone' is friends-only.
function friendsDropoutReason(room) {
    if (!room || (room.matchType !== 'friends' && room.matchType !== 'random')) return null;
    if (room.status !== 'playing' && room.status !== 'roundEnd') return null;
    if (room.matchType === 'friends') {
        const others = Object.entries(room.players || {}).filter(([pid]) => pid !== MP.playerId);
        if (others.length && others.every(([, p]) => p.connected === false)) return 'alone';
    }
    const host = (room.players || {})[room.hostId];
    if (!MP.isHost && (!host || host.connected === false)) return 'host';
    return null;
}

function dropoutMessage(reason, final) {
    if (reason === 'alone') return 'כל השחקנים עזבו את החדר';
    const who = MP.matchType === 'random' ? 'היריב' : 'מארח החדר';
    return final ? `${who} התנתק. המשחק הסתיים.` : `${who} התנתק - ממתינים לחזרתו...`;
}

function clearDropoutWatch() {
    if (MP.dropout) clearTimeout(MP.dropout.timer);
    MP.dropout = null;
}

function watchFriendsDropouts(room) {
    const reason = friendsDropoutReason(room);
    if (!reason) {
        if (!MP.dropout) return;
        clearDropoutWatch(); // they're back (or the match ended normally)
        // the round ran out while we were waiting - the host ends it now
        if (MP.endRoundDeferred) {
            MP.endRoundDeferred = false;
            if (MP.isHost && room.status === 'playing') endMultiplayerRound();
        }
        return;
    }
    if (MP.dropout && MP.dropout.reason === reason) return; // already counting down
    clearDropoutWatch();
    const code = MP.roomCode;
    MP.dropout = { reason, timer: setTimeout(() => abandonFriendsMatch(code), MP_DROPOUT_GRACE_MS) };
    showMessage(dropoutMessage(reason, false), 'warning');
}

function abandonFriendsMatch(code) {
    if (MP.roomCode !== code) return;
    const reason = friendsDropoutReason(MP.room);
    if (!reason) { clearDropoutWatch(); return; }
    const message = dropoutMessage(reason, true); // before leaving clears MP.matchType
    leaveMultiplayerRoom(); // stops the timer, detaches the listeners, clears match state
    currentGame.gameActive = false;
    showMessage(message, 'warning');
    showScreen('gameModeScreen');
    updateHomeUI();
}

// How many rounds this friends match lasts. One player is knocked out per round
// until one is left, so it is the number of players in round 1, minus one
// (capped at TOTAL_ROUNDS, where endMultiplayerRound() also stops). Worked out
// once when round 1 starts and then kept, so a player leaving or being knocked
// out later never changes it. A client that first sees a later round (it
// can't normally - nobody joins mid-match) gets the same answer from the
// players still in, plus one knocked out per round already played.
function friendsMatchRounds(room) {
    if (!MP.friendsTotalRounds) {
        const active = Object.values(room.players || {}).filter(p => !p.eliminated).length;
        const inRound1 = active + displayedRound(room) - 1;
        MP.friendsTotalRounds = Math.max(1, Math.min(TOTAL_ROUNDS, inRound1 - 1));
    }
    return MP.friendsTotalRounds;
}

// ---- lobby -----------------------------------------------------------------

// Players actually in a lobby: those who left after a previous match stay in
// the room data (only their own client can delete their node) - don't count them.
function friendsLobbyPlayers(room) {
    return Object.entries(room.players || {}).filter(([, p]) => p.connected !== false);
}

// Two people can read "5 players" and both join, leaving 7 in the room. Every
// client orders the lobby the same way - host first, then by server join time
// (freezeUntil stamp, see joinRoom; 0 for everyone already there before a
// rematch, and for older clients that don't stamp), then by id - and whoever
// lands past seat 6 leaves on their own. Judged only once my own join is
// acknowledged, so my stamp is the server's value and not a local guess.
function friendsSeatLost(room) {
    if (MP.isHost || !MP.joinAcked || room.matchType === 'random') return false;
    const lobby = friendsLobbyPlayers(room);
    if (lobby.length <= FRIENDS_MAX_PLAYERS) return false;
    lobby.sort(([aId, a], [bId, b]) => {
        if ((aId === room.hostId) !== (bId === room.hostId)) return aId === room.hostId ? -1 : 1;
        if ((a.freezeUntil || 0) !== (b.freezeUntil || 0)) return (a.freezeUntil || 0) - (b.freezeUntil || 0);
        return aId < bId ? -1 : aId > bId ? 1 : 0;
    });
    return lobby.findIndex(([pid]) => pid === MP.playerId) >= FRIENDS_MAX_PLAYERS;
}

function renderLobby(room) {
    document.getElementById('lobbyRoomCode').textContent = MP.roomCode;

    const lobbyPlayers = friendsLobbyPlayers(room);

    const listEl = document.getElementById('lobbyPlayers');
    listEl.innerHTML = '';
    lobbyPlayers.forEach(([pid, p]) => {
        const isSelf = pid === MP.playerId;
        listEl.innerHTML += `<div class="player-status${isSelf ? ' self' : ''}">
            <div class="status-avatar">${avatarMarkupForPlayer(pid, p)}</div>
            <span>${escapeHtml(isSelf ? p.name : safePlayerName(p.name, p.uid))}${pid === room.hostId ? ' 👑' : ''}</span>
            ${isSelf ? '' : playerActionsButton(`openPlayerActionsFromRoom('${pid}')`)}
        </div>`;
    });

    const startBtn = document.getElementById('lobbyStartBtn');
    const waiting = document.getElementById('lobbyWaiting');
    const overFull = lobbyPlayers.length > FRIENDS_MAX_PLAYERS;
    const canStart = MP.isHost && lobbyPlayers.length >= 2 && !overFull;
    startBtn.style.display = canStart ? 'block' : 'none';
    waiting.style.display = MP.isHost
        ? (canStart ? 'none' : 'block')
        : 'block';
    if (MP.isHost && overFull) waiting.textContent = 'יותר מ-6 שחקנים בחדר - ממתין שמישהו ייצא...';
    else if (MP.isHost && !canStart) waiting.textContent = 'ממתין לשחקנים נוספים שיצטרפו...';
    else if (!MP.isHost) waiting.textContent = 'ממתין למארח שיתחיל את המשחק...';

    // round length: the host picks it, everyone else just sees the choice
    const duration = room.roundDurationSec || ROUND_SECONDS;
    const tabs = document.getElementById('lobbyDurationTabs');
    const label = document.getElementById('lobbyDurationLabel');
    tabs.style.display = MP.isHost ? 'flex' : 'none';
    label.style.display = MP.isHost ? 'none' : 'block';
    label.textContent = duration >= 120 ? '2 דקות' : 'דקה';
    document.getElementById('lobbyDur60').classList.toggle('active', duration < 120);
    document.getElementById('lobbyDur120').classList.toggle('active', duration >= 120);
}

// host only: choose how long each round lasts (1 or 2 minutes) before starting
function hostSetRoundDuration(seconds) {
    if (!MP.isHost || !MP.roomRef || !MP.room || MP.room.status !== 'waiting') return;
    if (seconds !== 60 && seconds !== 120) return;
    MP.roomRef.child('roundDurationSec').set(seconds).catch(err => {
        console.error('Failed to set round length:', err);
        showMessage('שגיאה בשינוי משך הסיבוב - נסה שוב', 'error');
    });
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
    if (needsModeHelp('random', findRandomGame)) return;
    // show the loading screen BEFORE awaiting auth - the anonymous sign-in
    // can take up to 8s on a cold/slow connection, and with no immediate
    // feedback the button click looks completely dead
    setSearchStatusText('מתחבר...');
    mmIntroStart();
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
    // skip a waiting room that holds a player I blocked (moderation.js) -
    // checked BEFORE claiming their ticket, so they keep waiting for someone else
    for (const [pid, ticket] of candidates.slice(0, 5)) {
        if (blockedPlayers().length) {
            const players = (await db.ref('rooms/' + ticket.roomCode + '/players').once('value')).val() || {};
            if (Object.values(players).some(p => isPlayerBlocked(p.uid))) continue;
        }
        return { playerId: pid, roomCode: ticket.roomCode };
    }
    return null;
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
    const introRunning = MM.phase !== 'idle' && MM.phase !== 'search';
    if (count < 2) {
        // the opponent left while the VS intro was on screen - don't strand
        // anyone on it (hostId check: ignore a stale snapshot of another room)
        if (introRunning && room.hostId === MM.hostId) {
            mmIntroAbort('היריב יצא - נסה שוב');
            return;
        }
        showScreen('mpSearchScreen');
        return;
    }
    if (introRunning && mmOpponentEntry(room) && mmOpponentEntry(room)[1].connected === false) {
        mmIntroAbort('היריב התנתק - נסה שוב');
        return;
    }
    // matched - normal presence tracking takes over from here, so drop the
    // "delete on disconnect" safety nets meant only for the lone-waiter window
    if (MP.isHost) {
        db.ref('rooms/' + MP.roomCode).onDisconnect().cancel();
        // that cancel also drops every onDisconnect queued UNDER the room -
        // including my own presence flag from attachPresence() - so re-arm it,
        // or the guest would never learn that I dropped out mid-match
        db.ref('rooms/' + MP.roomCode + '/players/' + MP.playerId + '/connected').onDisconnect().set(false);
        matchmakingQueueRef(MP.playerId).remove();
        matchmakingQueueRef(MP.playerId).onDisconnect().cancel();
        if (!MP.autoStarting) {
            MP.autoStarting = true;
            // the round (and its server-timed clock) starts only after the
            // VS intro, so nobody loses playing time to the animation. Both
            // players then switch to the board on the same 'playing' snapshot,
            // exactly as before.
            const code = MP.roomCode;
            MM.timers.push(setTimeout(() => hostStartAfterIntro(code), MM_INTRO_MS));
        }
    }
    setSearchStatusText('נמצא יריב! מתחילים...');
    mmIntroReveal(room);
}

// host: the intro is over - start round 1 if the match is still on
function hostStartAfterIntro(code) {
    if (!MP.isHost || MP.roomCode !== code || !MP.room) return;
    const room = MP.room;
    if (room.status !== 'waiting') return;
    const opp = mmOpponentEntry(room);
    if (!opp || opp[1].connected === false) {
        mmIntroAbort('היריב יצא - נסה שוב');
        return;
    }
    startMultiplayerRound(1);
}

// ---- matchmaking intro (visual only) ------------------------------------
// search: a reel of preset avatars spins behind a "?" name plate - it never
//         names anyone, it only says "looking".
// reveal: an opponent really joined the room - the reel slows down and stops
//         on THEIR avatar.
// vs:     both real players face off until the host starts the round.
// The intro never decides anything: the room snapshot does. 'playing' tears
// it down at once, and leaving/abort resets it.

const MM_REVEAL_MS = 1400;       // reel slow-down
const MM_INTRO_MS = 3600;        // match found -> host starts the round (~2s of VS)
const MM_FAIL_MS = 12000;        // no round by then -> give up safely

const MM = { phase: 'idle', hostId: null, timers: [], anim: null };

function mmReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function mmOpponentEntry(room) {
    return Object.entries(room.players || {}).find(([pid]) => pid !== MP.playerId) || null;
}

function mmShuffledPresets(n) {
    const pool = AVATARS.slice().sort(() => Math.random() - 0.5);
    const out = [];
    for (let i = 0; i < n; i++) out.push(pool[i % pool.length]);
    return out;
}

function mmReelItem(svg) {
    return `<div class="mm-reel-item">${svg}</div>`;
}

// put avatar markup in place; a broken photo falls back to the preset avatar
function mmSetAvatar(el, markup, fallbackAvatarId) {
    el.innerHTML = markup;
    const img = el.querySelector('img');
    if (img) img.addEventListener('error', () => { el.innerHTML = getAvatarById(fallbackAvatarId).svg; }, { once: true });
}

function mmIntroReset() {
    MM.timers.forEach(clearTimeout);
    MM.timers = [];
    if (MM.anim) { try { MM.anim.cancel(); } catch (e) {} MM.anim = null; }
    MM.phase = 'idle';
    MM.hostId = null;
}

// entering random matchmaking: me on one side, the spinning reel on the other
function mmIntroStart() {
    mmIntroReset();
    MM.phase = 'search';
    const stage = document.getElementById('mmStage');
    if (!stage) return;
    stage.dataset.phase = 'search';
    mmSetAvatar(document.getElementById('mmMyAvatar'), getOwnAvatarMarkup(), networkSafeAvatarId());
    document.getElementById('mmMyName').textContent = gameState.playerName || 'שחקן';
    document.getElementById('mmOppName').textContent = '?';
    document.getElementById('mmOppAvatar').innerHTML = '';
    const reel = document.getElementById('mmReel');
    reel.style.transform = '';
    const set = mmShuffledPresets(8).map(a => mmReelItem(a.svg)).join('');
    reel.innerHTML = set + set; // two copies so the -50% loop is seamless
    const cancelBtn = document.getElementById('mmCancelBtn');
    if (cancelBtn) cancelBtn.style.display = '';
}

// a real opponent is in the room: slow the reel down onto them, then VS
function mmIntroReveal(room) {
    if (MM.phase !== 'search') return; // once per match
    const opp = mmOpponentEntry(room);
    const stage = document.getElementById('mmStage');
    if (!opp || !stage) return;
    const [oppId, oppData] = opp;
    MM.phase = 'reveal';
    MM.hostId = room.hostId;

    // past this point a cancel would leave the other player hanging
    const cancelBtn = document.getElementById('mmCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';

    const oppMarkup = avatarMarkupForPlayer(oppId, oppData);
    mmSetAvatar(document.getElementById('mmOppAvatar'), oppMarkup, oppData.avatarId);
    const oppName = safePlayerName(oppData.name, oppData.uid);

    MM.timers.push(setTimeout(() => {
        mmIntroAbort('ההתאמה נכשלה - נסה שוב');
    }, MM_FAIL_MS));

    const toVs = () => {
        if (MM.phase !== 'reveal') return;
        MM.phase = 'vs';
        MM.anim = null;
        document.getElementById('mmOppName').textContent = oppName;
        stage.dataset.phase = 'vs';
        setSearchStatusText('נמצא יריב! מתחילים...');
    };

    const reel = document.getElementById('mmReel');
    const windowEl = reel && reel.parentElement;
    if (mmReducedMotion() || !reel || !windowEl || typeof reel.animate !== 'function') {
        toVs();
        return;
    }

    // freeze the looping reel where it is, add a few more faces and the real
    // opponent at the end, then decelerate onto that last slot
    const itemH = windowEl.clientHeight || 1;
    const startY = new DOMMatrixReadOnly(getComputedStyle(reel).transform).m42 || 0;
    stage.dataset.phase = 'reveal'; // stops the CSS loop
    reel.style.transform = `translateY(${startY}px)`;
    reel.insertAdjacentHTML('beforeend',
        mmShuffledPresets(6).map(a => mmReelItem(a.svg)).join('') + mmReelItem(oppMarkup));
    const lastIndex = reel.children.length - 1;
    const endY = -lastIndex * itemH;
    MM.anim = reel.animate(
        [{ transform: `translateY(${startY}px)` }, { transform: `translateY(${endY}px)` }],
        { duration: MM_REVEAL_MS, easing: 'cubic-bezier(0.15, 0.7, 0.2, 1)', fill: 'forwards' }
    );
    MM.anim.onfinish = () => {
        reel.style.transform = `translateY(${endY}px)`;
        MM.timers.push(setTimeout(toVs, 150));
    };
}

// something went wrong mid-intro: leave cleanly and go back to the mode list
function mmIntroAbort(message) {
    if (MM.phase === 'idle') return;
    mmIntroReset();
    leaveMultiplayerRoom();
    if (message) showMessage(message, 'warning');
    showScreen('gameModeScreen');
    updateHomeUI();
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
    if (!MP.isHost || !MP.room || MP.room.status !== 'waiting') return;
    const lobbyCount = friendsLobbyPlayers(MP.room).length;
    if (lobbyCount < 2 || lobbyCount > FRIENDS_MAX_PLAYERS) return;
    startMultiplayerRound(1);
}

function startMultiplayerRound(roundNum) {
    if (!MP.isHost) return;
    // a double tap on "start" / "next round" would otherwise write two
    // different boards for the same round - and a client whose snapshots got
    // merged would render the second while everyone else plays the first
    if (MP.startingRound === roundNum) return;
    MP.startingRound = roundNum;
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
    MP.roomRef.update(updates).catch(err => {
        MP.startingRound = 0; // let the host try again
        console.error('Failed to start round:', err);
        showMessage('שגיאה בהתחלת הסיבוב - נסה שוב', 'error');
    });
}

function hostNextMultiplayerRound() {
    // only from the round-end screen: our own write updates MP.room at once
    // (Firebase applies local writes immediately), so a second tap would
    // otherwise see the new round and start the one after it as well
    if (!MP.isHost || !MP.room || MP.room.status !== 'roundEnd') return;
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
            // only the host writes the authoritative round result - but not
            // while everyone else is gone: that match is about to be dropped
            // (no win for being left alone), or ended here if they come back
            if (MP.isHost) {
                if (MP.dropout) MP.endRoundDeferred = true;
                else endMultiplayerRound();
            }
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

    const isFinal = displayedRound(MP.room) >= (MP.room.totalRounds || TOTAL_ROUNDS);
    const remainingAfter = active.length - 1;
    const updates = {};

    // Friends match, two or more connected players tied for last place: no one
    // is knocked out - the same round is played again (the next round keeps
    // its number on screen, see displayedRound()). loserId '' tells every
    // client the round ended in a tie.
    const replays = MP.room.replays || 0;
    const isTiedForLast = MP.room.matchType !== 'random' && active.length >= 2
        && active[0][1].connected !== false && active[1][1].connected !== false
        && (active[0][1].score || 0) === (active[1][1].score || 0);
    if (isTiedForLast && replays < MAX_TIE_REPLAYS) {
        updates['status'] = 'roundEnd';
        updates['loserId'] = '';
        updates['replays'] = replays + 1;
        MP.roomRef.update(updates).catch(err => {
            console.error('Failed to end round:', err);
            showMessage('שגיאה בסיום הסיבוב - נסה שוב', 'error');
        });
        return;
    }

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
    MP.roomRef.update(updates).catch(err => {
        console.error('Failed to end round:', err);
        showMessage('שגיאה בסיום הסיבוב - נסה שוב', 'error');
    });
}

// ---- round-end & final screens ---------------------------------------------

function buildStandings(room) {
    return Object.entries(room.players || {})
        .map(([pid, p]) => ({ name: pid === MP.playerId ? p.name : safePlayerName(p.name, p.uid), score: p.score || 0 }))
        .sort((a, b) => b.score - a.score);
}

function showMultiplayerRoundEnd(room) {
    const standings = buildStandings(room);
    const loser = room.players[room.loserId];
    const loserName = !loser ? '' : room.loserId === MP.playerId ? loser.name : safePlayerName(loser.name, loser.uid);
    // reuse the existing round-end UI renderer
    showRoundEnd(standings, loserName);

    // a tie for last place: nobody is out, the same round is played again
    const isTieReplay = !room.loserId;
    if (isTieReplay) {
        // replays already counts this tie, so the round just played is one more
        document.getElementById('eliminationNotice').textContent =
            `שוויון במקום האחרון! אף אחד לא הודח - סיבוב ${displayedRound(room) + 1} ישוחק שוב`;
    }
    const nextBtnLabel = document.getElementById('nextRoundBtn');
    if (nextBtnLabel) nextBtnLabel.textContent = isTieReplay ? 'שחקו שוב את הסיבוב ›' : 'סיבוב הבא ›';

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

    // friends rooms: anyone can press "play again" and the whole room goes back
    // to its lobby (same code, same people). A guest's press is carried out by
    // the host's client; once pressed, the button turns into a waiting note.
    const playAgainFriendsBtn = document.getElementById('playAgainFriendsBtn');
    const playAgainFriendsWaiting = document.getElementById('playAgainFriendsWaiting');
    if (playAgainFriendsBtn) playAgainFriendsBtn.style.display = (!isRandom1v1 && !MP.rematchRequested) ? 'block' : 'none';
    if (playAgainFriendsWaiting) playAgainFriendsWaiting.style.display = (!isRandom1v1 && MP.rematchRequested) ? 'block' : 'none';

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
        const winner = room.players[room.winnerId];
        const winnerName = winner ? safePlayerName(winner.name, winner.uid) : 'שחקן אחר';
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

// Friends rooms: the host sends the finished room back to its lobby, keeping
// the same code and the same people. Everyone still on the end screen follows
// via the shared listener (see the 'waiting' branch of onRoomUpdate).
function hostRematchFriends() {
    if (!MP.isHost || !MP.roomRef || !MP.room || MP.rematching) return;
    MP.rematching = true;
    const updates = {
        status: 'waiting',
        currentRound: 0,
        winnerId: null,
        loserId: null,
        isDraw: null,
        replays: null,
        board: null,
        roundStartTime: null
    };
    Object.entries(MP.room.players || {}).forEach(([pid, p]) => {
        // anyone who left after the match is parked as eliminated so they can't
        // be counted as an active player (or picked as the loser) next match
        updates['players/' + pid + '/eliminated'] = p.connected === false;
        updates['players/' + pid + '/score'] = 0;
        updates['players/' + pid + '/foundWords'] = null;
        updates['players/' + pid + '/freezeUntil'] = 0;
        updates['players/' + pid + '/rematch'] = null;
    });
    MP.roomRef.update(updates).catch(err => {
        MP.rematching = false;
        console.error('Failed to restart room:', err);
        showMessage('שגיאה בהתחלת משחק חדש - נסה שוב', 'error');
    });
}

// the "play again" button on the friends end screen - same button for everyone
function friendsPlayAgain() {
    if (MP.isHost) { hostRematchFriends(); return; }
    if (!MP.room || !MP.roomCode || !MP.playerId) return;
    const host = (MP.room.players || {})[MP.room.hostId];
    if (!host || host.connected === false) { showMessage('המארח יצא מהחדר', 'warning'); return; }
    // a guest can't reset the room (only the host may), so leave a request on
    // my own player node - the host's client picks it up and does the reset
    MP.rematchRequested = true;
    document.getElementById('playAgainFriendsBtn').style.display = 'none';
    document.getElementById('playAgainFriendsWaiting').style.display = 'block';
    db.ref('rooms/' + MP.roomCode + '/players/' + MP.playerId + '/rematch').set(true).catch(err => {
        console.error('Rematch request failed:', err);
        MP.rematchRequested = false;
        showMultiplayerResult(MP.room);
        showMessage('הבקשה נכשלה - נסה שוב', 'error');
    });
}

// clear everything a finished match left behind on this client, then show the lobby
function resetLocalMatchState() {
    stopMultiplayerTimer();
    currentGame.gameActive = false;
    MP.lastRound = 0;
    MP.friendsTotalRounds = 0;
    MP.startingRound = 0;
    clearDropoutWatch();
    MP.endRoundDeferred = false;
    MP.resultApplied = false;
    MP.spectating = false;
    MP.rematchRequested = false;
    MP.rematching = false;
    MP._freezeNotifiedFor = 0;
    renderEliminatedOverlay(false);
    showScreen('mpLobbyScreen');
}

// ---- word submission (called from game.js endDrag) -------------------------

function submitMultiplayerWord(word, newTotalScore) {
    if (!MP.roomCode || !MP.playerId) return;
    if (mpFreezeMsLeft() > 0 || amIEliminatedMP()) return; // last line of defence: no scoring while frozen/eliminated
    const base = 'rooms/' + MP.roomCode + '/players/' + MP.playerId;
    db.ref(base + '/score').set(newTotalScore).catch(err => console.error('Score sync failed:', err));
    db.ref(base + '/foundWords/' + word).set(true).catch(err => console.error('Word sync failed:', err));
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
            <div class="status-avatar">${avatarMarkupForPlayer(pid, p)}</div>
            <span>${isSelf ? 'אתה' : escapeHtml(safePlayerName(p.name, p.uid))}</span><span>${p.score || 0}</span>
            ${isSelf ? '' : playerActionsButton(`openPlayerActionsFromRoom('${pid}')`)}
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
    playWordSound(points);
    launchSparkles();
}

// ---- elimination gate --------------------------------------------------------

// True once the room marks ME as eliminated - an eliminated player must not
// keep finding words / spending power-ups on a match they're already out of.
function amIEliminatedMP() {
    if (currentGame.mode !== 'multiplayer' || !MP.room || !MP.playerId) return false;
    const me = (MP.room.players || {})[MP.playerId];
    return !!(me && me.eliminated);
}

// Full-board "you're out" curtain offering the only three things an
// eliminated player can still do: keep watching, go home, or start a new
// game. Dismissing it (spectate) just hides the curtain - the board input
// itself stays locked via isBoardInputFrozen()/blockedByFreeze() in game.js.
function renderEliminatedOverlay(show) {
    const board = document.getElementById('battleBoard');
    if (!board) return;
    let overlay = document.getElementById('battleEliminatedOverlay');

    if (!show) {
        if (overlay) overlay.remove();
        board.classList.remove('board-frozen');
        return;
    }

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'battleEliminatedOverlay';
        overlay.className = 'board-eliminated-overlay';
        overlay.innerHTML = `
            <div class="elim-label">הודחת מהמשחק!</div>
            <div class="elim-actions">
                <button class="elim-btn elim-spectate" onclick="mpSpectateAfterElimination()">צפה בהמשך המשחק</button>
                <button class="elim-btn elim-home" onclick="goHome()">מסך בית</button>
                <button class="elim-btn elim-new" onclick="mpNewGameAfterElimination()">משחק חדש</button>
            </div>`;
        board.appendChild(overlay);
    } else if (overlay.parentElement !== board) {
        board.appendChild(overlay); // renderBoard() wipes the board's children
    }
    board.classList.add('board-frozen'); // reuse the same dimmed-tile look
    if (isDragging) cancelDrag();
}

// "watch the rest" - dismiss the curtain, board stays visible but locked
function mpSpectateAfterElimination() {
    MP.spectating = true;
    renderEliminatedOverlay(false);
}

// leave this room entirely and go pick a new game mode
function mpNewGameAfterElimination() {
    leaveMultiplayerRoom();
    showScreen('gameModeScreen');
    updateHomeUI();
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

// freeze every opponent (all players except the one who used the item) for 8 seconds
function useMultiplayerFreeze() {
    if (blockedByFreeze()) return;
    if (!canPayForItem('freezeOpponents')) return;
    const players = (MP.room || {}).players || {};
    const opponents = Object.entries(players)
        .filter(([pid, p]) => pid !== MP.playerId && !p.eliminated && p.connected !== false);
    if (opponents.length === 0) { showMessage('אין יריבים להקפיא', 'warning'); return; }

    // remember which payment path was taken so a failed broadcast (below)
    // can be refunded exactly, instead of the player losing the cost for an
    // effect that never actually reached anyone
    const paidFromInventory = gameState.inventory.freezeOpponents > 0;
    consumeItemPayment('freezeOpponents');
    saveGameState();
    updateHomeUI();

    const until = Date.now() + MP.serverOffset + 8000;
    const updates = {};
    opponents.forEach(([pid]) => {
        updates['players/' + pid + '/freezeUntil'] = until;
    });
    db.ref('rooms/' + MP.roomCode).update(updates).then(() => {
        showMessage('כל היריבים הוקפאו ל-8 שניות!', 'info');
    }).catch(err => {
        console.error('Freeze broadcast failed:', err);
        if (paidFromInventory) gameState.inventory.freezeOpponents++;
        else if (!hasInfiniteCoins()) gameState.coins += getShopItem('freezeOpponents').cost;
        saveGameState();
        updateHomeUI();
        showMessage('ההקפאה נכשלה - המטבעות הוחזרו, נסה שוב', 'error');
    });
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

// Whether leaving should delete the whole room rather than just my slot:
//   * the host leaving a lobby (nobody can start the match without them), or
//     leaving with nobody else still connected;
//   * a guest who is the last one connected after the host already left.
// The rules (database.rules.json, rooms/$code) allow exactly these deletes.
function shouldDeleteRoomOnLeave(room) {
    if (!room) return false;
    const players = room.players || {};
    const othersConnected = Object.entries(players)
        .some(([pid, p]) => pid !== MP.playerId && p.connected !== false);
    if (MP.isHost) return room.status === 'waiting' || !othersConnected;
    const host = players[room.hostId];
    const hostGone = !host || host.connected === false;
    return hostGone && !othersConnected;
}

function leaveMultiplayerRoom() {
    stopMultiplayerTimer();
    mmIntroReset();
    clearDropoutWatch();
    MP.endRoundDeferred = false;
    if (MP.presenceRef) { MP.presenceRef.off(); MP.presenceRef = null; }
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
    if (MP.roomCode && MP.playerId && db && shouldDeleteRoomOnLeave(MP.room)) {
        // last one out closes the room, so empty rooms don't pile up in the
        // database (anyone still in it - a guest in the host's lobby - gets
        // "החדר נסגר" and goes home)
        db.ref('rooms/' + MP.roomCode).remove().catch(() => {});
    } else if (MP.roomCode && MP.playerId && db) {
        // if we're still just waiting in the lobby, remove our slot entirely
        if (MP.room && MP.room.status === 'waiting') {
            db.ref('rooms/' + MP.roomCode + '/players/' + MP.playerId).remove().catch(() => {});
        } else {
            db.ref('rooms/' + MP.roomCode + '/players/' + MP.playerId + '/connected').set(false).catch(() => {});
        }
    }
    MP.roomCode = null;
    MP.isHost = false;
    MP.room = null;
    MP.lastRound = 0;
    MP.friendsTotalRounds = 0;
    MP.joinAcked = false;
    MP.startingRound = 0;
    MP.matchType = null;
    MP.autoStarting = false;
    MP.resultApplied = false;
    MP._freezeNotifiedFor = 0;
    MP.spectating = false;
    MP.rematchRequested = false;
    MP.rematching = false;
    renderEliminatedOverlay(false);
    if (currentGame.mode === 'multiplayer') currentGame.mode = null;
}
