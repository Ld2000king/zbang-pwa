// ============================================================================
// moderation.js - what App Store guideline 1.2 asks of an app where players
// see each other's content (here: player names on the leaderboard and in
// multiplayer, and the custom avatar photo shared with opponents):
//   * a filter for objectionable names - a player can't save one, and one
//     that reaches us anyway (an older client, a direct database write) is
//     shown as a neutral "שחקן" instead
//   * reporting a player - written to the admin-only /reports node, where
//     the admin reviews it (admin.js) and can pull the row off the leaderboard
//   * blocking a player - their name and photo are hidden from this player
//     everywhere, their leaderboard rows disappear, and random matchmaking
//     skips rooms they're in. Kept in gameState, so it rides the cloud save.
//
// Loads after game.js / multiplayer.js / cloudsave.js and only calls into
// them at runtime.
// ============================================================================

// Matched anywhere inside a normalized name (letters only, final letters
// folded, common digit/symbol swaps undone) - so "f.u.c.k" or "ז ו נ ה" are
// caught too. Only words long or specific enough not to hit innocent names.
const BLOCKED_NAME_PARTS = [
    // Hebrew (in normalizeFinals form: no final letters)
    'זונה', 'שרמוט', 'זיינ', 'מזדיינ', 'מניאק', 'קוקסינל', 'חרא', 'כוסאמ', 'כוסעמ',
    'כוסית', 'כוסשל', 'זובי', 'מפגר', 'נאצי', 'היטלר', 'אנסת', 'פורנו', 'סקס',
    'טמבל', 'אידיוט', 'דביל', 'מטומטמ', 'הומואימ', 'ערבושימ',
    // English
    'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'fagot',
    'whore', 'slut', 'porn', 'hitler', 'nazi', 'rapist', 'asshole', 'dick', 'cock',
    'pussy', 'penis', 'vagina', 'boobs', 'sexy', 'retard', 'kkk'
];

// Short words that are only objectionable on their own (as a separate word),
// not as part of a longer, innocent name.
const BLOCKED_NAME_WORDS = ['כוס', 'זינ', 'תחת', 'זבל', 'סקסי', 'ass', 'fag', 'tit', 'tits', 'sex'];

const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

function normalizeNameForFilter(str) {
    const lowered = String(str || '').toLowerCase().replace(/[013457@$]/g, ch => LEET_MAP[ch]);
    return typeof normalizeFinals === 'function' ? normalizeFinals(lowered) : lowered;
}

function isNameAllowed(name) {
    const norm = normalizeNameForFilter(name);
    const squashed = norm.replace(/[^a-zא-ת]/g, '');
    if (BLOCKED_NAME_PARTS.some(part => squashed.includes(part))) return false;
    const words = norm.split(/[^a-zא-ת]+/).filter(Boolean);
    return !words.some(w => BLOCKED_NAME_WORDS.includes(w));
}

// ---- blocking --------------------------------------------------------------

function blockedPlayers() {
    if (!Array.isArray(gameState.blockedPlayers)) gameState.blockedPlayers = [];
    return gameState.blockedPlayers;
}

function isPlayerBlocked(uid) {
    return !!uid && blockedPlayers().some(b => b.uid === uid);
}

// The name to show for another player: hidden when blocked, neutral when it
// fails the filter.
function safePlayerName(name, uid) {
    if (isPlayerBlocked(uid)) return 'שחקן חסום';
    return isNameAllowed(name) ? (name || 'שחקן') : 'שחקן';
}

function blockPlayer(uid, name) {
    if (!uid || isPlayerBlocked(uid)) return;
    // the name is only kept so the profile list can show who is blocked
    blockedPlayers().push({ uid: uid, name: String(name || 'שחקן').slice(0, 20) });
    saveGameState();
    refreshAfterModerationChange();
    showMessage('השחקן נחסם. לא תראה יותר את השם והתמונה שלו', 'success');
}

function unblockPlayer(uid) {
    gameState.blockedPlayers = blockedPlayers().filter(b => b.uid !== uid);
    saveGameState();
    refreshAfterModerationChange();
    showMessage('החסימה הוסרה', 'info');
}

function refreshAfterModerationChange() {
    renderBlockedSection();
    const lb = document.getElementById('leaderboardScreen');
    if (lb && lb.classList.contains('active') && typeof renderLeaderboard === 'function') renderLeaderboard();
    if (typeof MP !== 'undefined' && MP.room) {
        if (typeof updateMultiplayerUI === 'function') updateMultiplayerUI(MP.room);
        const lobby = document.getElementById('lobbyScreen');
        if (lobby && lobby.classList.contains('active') && typeof renderLobby === 'function') renderLobby(MP.room);
    }
}

// Profile section listing blocked players, each with an unblock button.
// Hidden while the list is empty.
function renderBlockedSection() {
    const section = document.getElementById('blockedSection');
    if (!section) return;
    const list = blockedPlayers();
    if (!list.length) { section.style.display = 'none'; section.innerHTML = ''; return; }
    section.style.display = 'block';
    section.innerHTML = `<h3>${icon('close')} שחקנים חסומים</h3>` + list.map((b, i) => `
        <div class="submission-row">
            <span class="sub-word">${escapeHtml(b.name)}</span>
            <span class="sub-actions"><button class="approve-btn" onclick="unblockPlayer(blockedPlayers()[${i}].uid)">בטל חסימה</button></span>
        </div>`).join('');
}

// ---- report / block menu ---------------------------------------------------

// The player the menu is open for: { uid, name, photo, lbPath, lbId }
let playerActionsTarget = null;

function openPlayerActions(target) {
    if (!target || !target.uid) return;
    if (typeof auth !== 'undefined' && auth && auth.currentUser && auth.currentUser.uid === target.uid) return; // that's me
    playerActionsTarget = target;
    const overlay = document.getElementById('playerActionsOverlay');
    if (!overlay) return;
    document.getElementById('playerActionsName').textContent = safePlayerName(target.name, target.uid);
    const blocked = isPlayerBlocked(target.uid);
    document.getElementById('playerBlockBtn').textContent = blocked ? 'בטל חסימה' : 'חסום שחקן';
    overlay.style.display = 'flex';
}

function closePlayerActions() {
    const overlay = document.getElementById('playerActionsOverlay');
    if (overlay) overlay.style.display = 'none';
    playerActionsTarget = null;
}

// from a leaderboard row (leaderboardRows in game.js)
function openPlayerActionsFromLeaderboard(id) {
    const row = (typeof leaderboardRows !== 'undefined' ? leaderboardRows : []).find(r => r.id === id);
    if (!row) return;
    openPlayerActions({ uid: row.uid, name: row.name, lbPath: leaderboardPath(currentLeaderboardMode), lbId: row.id });
}

// from a player in the current multiplayer room
function openPlayerActionsFromRoom(pid) {
    const p = (typeof MP !== 'undefined' && MP.room && MP.room.players || {})[pid];
    if (!p) return;
    openPlayerActions({ uid: p.uid, name: p.name, photo: p.photoData || null });
}

function playerActionsBlock() {
    const t = playerActionsTarget;
    closePlayerActions();
    if (!t) return;
    if (isPlayerBlocked(t.uid)) unblockPlayer(t.uid);
    else blockPlayer(t.uid, t.name);
}

function playerActionsReport() {
    const t = playerActionsTarget;
    closePlayerActions();
    if (!t) return;
    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !db) {
        showMessage('הדיווח לא זמין כרגע - נסה שוב מאוחר יותר', 'error');
        return;
    }
    authReady.then(user => {
        const report = {
            reporterUid: user.uid,
            reportedUid: t.uid,
            reportedName: String(t.name || '').slice(0, 40),
            source: t.lbPath ? 'leaderboard' : 'multiplayer',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        if (t.lbPath) { report.lbPath = t.lbPath; report.lbId = t.lbId; }
        if (t.photo && t.photo.length <= 8000 && /^data:image\/jpeg;base64,/.test(t.photo)) report.photo = t.photo;
        return db.ref('reports').push(report);
    }).then(() => {
        // reporting someone usually means you don't want to see them again either
        if (isPlayerBlocked(t.uid)) {
            showMessage('הדיווח נשלח לבדיקה. תודה!', 'success');
            return;
        }
        showConfirm('הדיווח נשלח לבדיקה. תודה!\nלחסום גם את השחקן? לא תראה יותר את השם והתמונה שלו.',
            () => blockPlayer(t.uid, t.name));
    }).catch(err => {
        console.error('Report failed:', err);
        showMessage('שליחת הדיווח נכשלה - נסה שוב', 'error');
    });
}

// Small "⋯" button that opens the report/block menu - shown next to OTHER
// players only.
function playerActionsButton(onclick) {
    return `<button class="player-more-btn" onclick="event.stopPropagation(); ${onclick}" title="דווח / חסום" aria-label="דווח או חסום שחקן">⋯</button>`;
}
