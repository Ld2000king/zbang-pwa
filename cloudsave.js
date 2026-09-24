// ============================================================================
// cloudsave.js - optional cloud save for a player's OWN progress.
// Loads after game.js / multiplayer.js so it can use their globals
// (gameState, saveGameState, showMessage, showConfirm, waitForAuth, ...).
//
// WHY THIS EXISTS: coins, diamonds, inventory and real-money coin purchases
// live only in this device's localStorage. Clear the browser data, switch
// phone, or break the device and all of it is gone forever - including
// things the player paid for, with no way for anyone to restore it.
//
// WHY IT NEEDS AN ACCOUNT: the game signs everyone in anonymously, and an
// anonymous UID is per-device - it cannot identify the same person on a new
// phone. So a cloud save is only meaningful once the player attaches a real
// credential. Creating one LINKS the existing anonymous account (same UID),
// so their multiplayer identity and leaderboard row carry over untouched.
//
// Everything here is opt-in: a player who never signs in is completely
// unaffected, and keeps playing anonymously exactly as before.
// ============================================================================

// Fields of gameState that belong to the PLAYER rather than to the device.
// musicEnabled is deliberately absent - a per-device preference, not progress.
const CLOUD_SAVE_FIELDS = [
    'playerName', 'coins', 'diamonds', 'inventory', 'totalScore', 'gamesPlayed',
    'level', 'xp', 'xpToNextLevel', 'avatarId', 'trophies', 'preferredTheme', 'themeAuto',
    'ownedAvatars', 'bestSingleScore', 'bestSingleScorePrecise', 'playerId', 'lastDailyClaim',
    'dailyStreak', 'grantedIapTransactions'
];

// Progress changes in bursts (a word found bumps score, coins and xp in the
// same breath), so writes are debounced instead of one per saveGameState().
const CLOUD_SYNC_DEBOUNCE_MS = 4000;
const CLOUD_STATE_MAX_CHARS = 20000; // matches the cap in database.rules.json

const CloudSave = {
    timer: null,
    // Set between signing in and the player answering "restore or keep?" -
    // until that's resolved, nothing may overwrite the cloud copy, or the
    // local state would silently clobber the very save they might restore.
    awaitingRestoreChoice: false,
    lastSyncedAt: 0
};

function cloudSaveAvailable() {
    return typeof FIREBASE_READY !== 'undefined' && FIREBASE_READY && !!db && !!auth;
}

// True once this device is attached to a real (non-anonymous) account.
function cloudSaveActive() {
    return cloudSaveAvailable() && !!auth.currentUser && !auth.currentUser.isAnonymous;
}

function cloudSaveEmail() {
    return (cloudSaveAvailable() && auth.currentUser && auth.currentUser.email) || '';
}

function cloudSaveRef() {
    return db.ref('player_saves/' + auth.currentUser.uid);
}

// ---- collecting / applying progress ----------------------------------------

function collectCloudState() {
    const out = {};
    CLOUD_SAVE_FIELDS.forEach(key => {
        if (gameState[key] !== undefined) out[key] = gameState[key];
    });
    return out;
}

function applyCloudState(state) {
    CLOUD_SAVE_FIELDS.forEach(key => {
        if (state[key] !== undefined) gameState[key] = state[key];
    });
    localStorage.setItem('zabangState', JSON.stringify(gameState)); // not saveGameState(): that would re-trigger a sync
    refreshAfterCloudAuthChange();
}

// ---- pushing to the cloud ---------------------------------------------------

// Called from saveGameState() on every progress change - cheap and safe to
// call constantly; the real write is debounced and skipped entirely when
// there's no account attached.
function scheduleCloudSync() {
    if (!cloudSaveActive() || CloudSave.awaitingRestoreChoice) return;
    clearTimeout(CloudSave.timer);
    CloudSave.timer = setTimeout(pushCloudSave, CLOUD_SYNC_DEBOUNCE_MS);
}

function pushCloudSave() {
    if (!cloudSaveActive() || CloudSave.awaitingRestoreChoice) return Promise.resolve();
    const stateJson = JSON.stringify(collectCloudState());
    if (stateJson.length > CLOUD_STATE_MAX_CHARS) {
        // The rules would reject this anyway - fail loudly in the console
        // rather than silently leaving the player's save stale.
        console.error('Cloud save skipped: state is', stateJson.length, 'chars (max', CLOUD_STATE_MAX_CHARS + ')');
        return Promise.resolve();
    }
    const payload = {
        state: stateJson,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    const photo = localStorage.getItem('zabangCustomAvatarSync');
    if (photo) payload.photo = photo;

    return cloudSaveRef().set(payload)
        .then(() => { CloudSave.lastSyncedAt = Date.now(); renderCloudSaveSection(); })
        .catch(err => {
            console.error('Cloud save failed:', err);
            renderCloudSaveSection();
        });
}

function fetchCloudSave() {
    return cloudSaveRef().once('value').then(snap => (snap.exists() ? snap.val() : null));
}

// ---- restore-or-keep, after signing in on a device ---------------------------

// Called right after a successful sign-in. If the account already has a save,
// the player decides which copy wins - merging currencies automatically would
// be worse than either choice (it can silently double or erase what they own).
function resolveCloudSaveAfterSignIn() {
    CloudSave.awaitingRestoreChoice = true;
    return fetchCloudSave().then(save => {
        if (!save || !save.state) { // first device on this account - seed it
            CloudSave.awaitingRestoreChoice = false;
            return pushCloudSave().then(() => showMessage('הגיבוי הופעל - ההתקדמות שלך נשמרת בענן', 'success'));
        }

        let cloudState;
        try {
            cloudState = JSON.parse(save.state);
        } catch (err) {
            console.error('Cloud save is unreadable:', err);
            CloudSave.awaitingRestoreChoice = false;
            showMessage('הגיבוי בענן פגום - נשמרת ההתקדמות המקומית', 'warning');
            return pushCloudSave();
        }

        const when = save.updatedAt ? new Date(save.updatedAt).toLocaleDateString('he-IL') : 'לא ידוע';
        const coins = (cloudState.coins || 0).toLocaleString('he-IL');
        showConfirm(
            `נמצא גיבוי בענן מ-${when} (${coins} מטבעות, רמה ${cloudState.level || 1}).\nלשחזר אותו למכשיר הזה? ההתקדמות המקומית הנוכחית תוחלף.`,
            () => { // restore the cloud copy
                CloudSave.awaitingRestoreChoice = false;
                applyCloudState(cloudState);
                if (save.photo) restoreCloudPhoto(save.photo);
                pushCloudSave();
                showMessage('הגיבוי שוחזר!', 'success');
            },
            () => { // keep this device's progress, and overwrite the cloud copy with it
                CloudSave.awaitingRestoreChoice = false;
                pushCloudSave();
                showMessage('ההתקדמות המקומית נשמרה והחליפה את הגיבוי', 'info');
            }
        );
    }).catch(err => {
        CloudSave.awaitingRestoreChoice = false;
        console.error('Reading the cloud save failed:', err);
        showMessage('קריאת הגיבוי נכשלה - נסה שוב מאוחר יותר', 'error');
    });
}

// The cloud only carries the small synced thumbnail (see handleCustomAvatarFile
// in game.js). On a fresh device that's better than no photo at all, so it
// seeds both copies; a device that still has its own full-quality original
// keeps it.
function restoreCloudPhoto(photo) {
    try {
        localStorage.setItem('zabangCustomAvatarSync', photo);
        if (!localStorage.getItem('zabangCustomAvatar')) localStorage.setItem('zabangCustomAvatar', photo);
    } catch (err) {
        console.error('Restoring the avatar photo failed:', err);
    }
}

// ---- account actions ---------------------------------------------------------

// Switching identity mid-match would break every room write in flight (the
// rules bind each player slot to the UID that created it).
function blockedByActiveMatch() {
    if (typeof currentGame !== 'undefined' && currentGame.mode === 'multiplayer') {
        showMessage('אי אפשר להחליף חשבון באמצע משחק מרובה משתתפים', 'warning');
        return true;
    }
    return false;
}

// Turns the current anonymous session into a permanent account, keeping the
// same UID - so the player's multiplayer identity and leaderboard row survive.
function cloudCreateAccount(email, password) {
    if (!cloudSaveAvailable() || blockedByActiveMatch()) return;
    waitForAuth().then(() => {
        const cred = firebase.auth.EmailAuthProvider.credential(email, password);
        return auth.currentUser.linkWithCredential(cred);
    }).then(() => {
        closeCloudAuthModal();
        refreshAfterCloudAuthChange();
        return pushCloudSave().then(() => showMessage('החשבון נוצר - ההתקדמות שלך מגובה בענן', 'success'));
    }).catch(err => showMessage(cloudAuthErrorText(err), 'error'));
}

// Signing in to an existing account - the normal path on a NEW device.
function cloudSignIn(email, password) {
    if (!cloudSaveAvailable() || blockedByActiveMatch()) return;
    auth.signInWithEmailAndPassword(email, password).then(() => {
        closeCloudAuthModal();
        refreshAfterCloudAuthChange();
        return resolveCloudSaveAfterSignIn();
    }).catch(err => showMessage(cloudAuthErrorText(err), 'error'));
}

// Back to anonymous play. The cloud copy stays exactly as it was, so signing
// back in restores it - that's the whole point.
function cloudSignOut() {
    if (!cloudSaveAvailable() || blockedByActiveMatch()) return;
    clearTimeout(CloudSave.timer);
    pushCloudSave().then(() => auth.signOut()).then(() => {
        // regular play (multiplayer, leaderboard) needs *some* signed-in user
        return auth.signInAnonymously();
    }).then(() => {
        refreshAfterCloudAuthChange();
        showMessage('התנתקת. ההתקדמות נשארה שמורה בענן', 'info');
    }).catch(err => showMessage(cloudAuthErrorText(err), 'error'));
}

function cloudResetPassword() {
    if (!cloudSaveAvailable()) return;
    const email = (document.getElementById('cloudEmailInput') || {}).value || cloudSaveEmail();
    if (!email) { showMessage('הכנס אימייל קודם', 'warning'); return; }
    auth.sendPasswordResetEmail(email.trim())
        .then(() => showMessage('נשלח מייל לאיפוס הסיסמה', 'success'))
        .catch(err => showMessage(cloudAuthErrorText(err), 'error'));
}

// Firebase's own messages are English and developer-facing; these are the
// cases a player can actually hit.
function cloudAuthErrorText(err) {
    const code = (err && err.code) || '';
    switch (code) {
        case 'auth/email-already-in-use':
        case 'auth/credential-already-in-use':
            return 'האימייל הזה כבר רשום - השתמש ב"כניסה לחשבון קיים"';
        case 'auth/invalid-email':       return 'כתובת אימייל לא תקינה';
        case 'auth/weak-password':       return 'הסיסמה קצרה מדי (לפחות 6 תווים)';
        case 'auth/wrong-password':
        case 'auth/invalid-credential':  return 'אימייל או סיסמה שגויים';
        case 'auth/user-not-found':      return 'לא נמצא חשבון עם האימייל הזה';
        case 'auth/network-request-failed': return 'אין חיבור לאינטרנט - נסה שוב';
        case 'auth/too-many-requests':   return 'יותר מדי ניסיונות - נסה שוב בעוד כמה דקות';
        default:
            console.error('Cloud auth error:', err);
            return 'הפעולה נכשלה - נסה שוב';
    }
}

// ---- UI ----------------------------------------------------------------------

let cloudAuthMode = 'create'; // 'create' | 'signin'

function openCloudAuthModal(mode) {
    cloudAuthMode = mode === 'signin' ? 'signin' : 'create';
    const overlay = document.getElementById('cloudAuthOverlay');
    if (!overlay) return;
    document.getElementById('cloudAuthTitle').textContent =
        cloudAuthMode === 'signin' ? 'כניסה לחשבון קיים' : 'יצירת חשבון לגיבוי';
    document.getElementById('cloudAuthSubmitBtn').textContent =
        cloudAuthMode === 'signin' ? 'כניסה' : 'צור חשבון';
    document.getElementById('cloudEmailInput').value = '';
    document.getElementById('cloudPasswordInput').value = '';
    overlay.style.display = 'flex';
    document.getElementById('cloudEmailInput').focus();
}

function closeCloudAuthModal() {
    const overlay = document.getElementById('cloudAuthOverlay');
    if (overlay) overlay.style.display = 'none';
}

function submitCloudAuth() {
    const email = (document.getElementById('cloudEmailInput').value || '').trim();
    const password = document.getElementById('cloudPasswordInput').value || '';
    if (!email || !password) { showMessage('צריך אימייל וסיסמה', 'warning'); return; }
    if (cloudAuthMode === 'signin') cloudSignIn(email, password);
    else cloudCreateAccount(email, password);
}

function refreshAfterCloudAuthChange() {
    if (typeof updateHomeUI === 'function') updateHomeUI();
    const profile = document.getElementById('profileScreen');
    if (profile && profile.classList.contains('active') && typeof renderProfile === 'function') renderProfile();
    else renderCloudSaveSection();
    if (typeof renderAdminSection === 'function') renderAdminSection();
}

function renderCloudSaveSection() {
    const section = document.getElementById('cloudSaveSection');
    if (!section) return;

    if (!cloudSaveAvailable()) {
        section.innerHTML = `<h3>${icon('trophy')} גיבוי בענן</h3>
            <p class="mp-hint">הגיבוי לא זמין - Firebase לא מוגדר במכשיר הזה.</p>`;
        return;
    }

    if (cloudSaveActive()) {
        const synced = CloudSave.lastSyncedAt
            ? `סונכרן לאחרונה ב-${new Date(CloudSave.lastSyncedAt).toLocaleTimeString('he-IL')}`
            : 'מסונכרן אוטומטית אחרי כל שינוי';
        section.innerHTML = `<h3>${icon('trophy')} גיבוי בענן</h3>
            <p class="mp-hint">מחובר כ-<strong>${escapeHtml(cloudSaveEmail())}</strong>. ${synced}.</p>
            <button class="btn-large blue-btn" onclick="pushCloudSave()">גבה עכשיו</button>
            <button class="close-modal-btn" onclick="cloudSignOut()">התנתקות</button>`;
        return;
    }

    section.innerHTML = `<h3>${icon('trophy')} גיבוי בענן</h3>
        <p class="mp-hint">ההתקדמות שלך (מטבעות, יהלומים, פריטים ורכישות) שמורה כרגע רק במכשיר הזה. צור חשבון כדי לגבות אותה ולשחזר אותה בכל מכשיר.</p>
        <button class="btn-large blue-btn" onclick="openCloudAuthModal('create')">צור חשבון לגיבוי</button>
        <button class="btn-large green-btn" onclick="openCloudAuthModal('signin')">כניסה לחשבון קיים</button>`;
}

// Keep the section honest when the session changes from anywhere (admin
// sign-in/out, a token expiring, the anonymous session being created).
if (typeof auth !== 'undefined' && auth) {
    auth.onAuthStateChanged(() => renderCloudSaveSection());
}
