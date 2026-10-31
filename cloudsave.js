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
    'ownedAvatars', 'coinAvatarsGranted', 'bestSingleScore', 'bestSingleScorePrecise', 'bestTowerScore', 'towerTutorialSeen', 'modeHelpSeen', 'playerId', 'lastDailyClaim',
    'dailyStreak', 'grantedIapTransactions', 'soundKit', 'ownedSoundKits', 'blockedPlayers',
    // 1.2: XP counters (see xp-state.js). Older versions ignore this field.
    'xpProgress'
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
    // the XP counters only - the reward-event list stays on this device
    if (typeof xpProgressForCloud === 'function') {
        const xp = xpProgressForCloud();
        if (xp) out.xpProgress = xp; else delete out.xpProgress;
    }
    return out;
}

function applyCloudState(state) {
    const xpBefore = gameState.xpProgress; // this device's XP, merged back in below
    CLOUD_SAVE_FIELDS.forEach(key => {
        if (state[key] !== undefined) gameState[key] = state[key];
    });
    // a restore never lowers XP or levels, and never pays a level twice
    if (typeof xpAfterCloudRestore === 'function') xpAfterCloudRestore(xpBefore, state);
    // a cloud save from before the coin shop keeps the avatars that were free then
    if (state.coinAvatarsGranted === undefined && typeof grantLegacyCoinAvatars === 'function') grantLegacyCoinAvatars();
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

    return confirmAccountStillExists().then(alive => {
        if (!alive) return;
        return writeCloudSave(payload)
            .then(() => { CloudSave.lastSyncedAt = Date.now(); renderCloudSaveSection(); });
    }).catch(err => {
        console.error('Cloud save failed:', err);
        renderCloudSaveSection();
    });
}

// ---- 1.2: XP-safe writing ---------------------------------------------------
// With the XP files loaded, the save is written in a transaction that merges
// this device's XP counters with the ones already in the cloud
// (player_saves/<uid>/progress, see xp-cloud.js) - so no device or older copy
// can lower anyone's XP. Until the rules allow `progress`, that write is
// refused and the save falls back to exactly the old backup (state only);
// after the first refusal this session stops trying.
function writeCloudSave(payload) {
    const canMerge = typeof ZbangXPCloud !== 'undefined' && gameState.xpProgress && !CloudSave.progressNodeRefused;
    if (!canMerge) return cloudSaveRef().set(payload);
    return ZbangXPCloud.pushSave(cloudSaveRef(), {
        stateJson: payload.state, progress: gameState.xpProgress,
        timestamp: payload.updatedAt, photo: payload.photo
    }).then(res => {
        if (res.mode === 'state-only') CloudSave.progressNodeRefused = true;
        if (typeof xpAdoptCloudProgress === 'function') xpAdoptCloudProgress(res.progress);
    });
}

// A token refresh before writing: once the account was deleted (on another
// device, or from version 1.1) the refresh fails and nothing is written -
// otherwise a still-signed-in device could bring the deleted save back.
// Offline the refresh fails too; then the write goes ahead and the database
// queues it as before.
// (the codes Firebase uses when the account no longer exists or was disabled;
// the emulator answers a deleted account with invalid-refresh-token)
const ACCOUNT_GONE_CODES = ['auth/user-token-expired', 'auth/user-not-found', 'auth/user-disabled',
    'auth/invalid-user-token', 'auth/invalid-refresh-token'];
function confirmAccountStillExists() {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return Promise.resolve(false);
    return user.getIdToken(true).then(() => true).catch(err => {
        if (ACCOUNT_GONE_CODES.includes(err && err.code)) {
            accountGoneElsewhere();
            return false;
        }
        return true;
    });
}

function accountGoneElsewhere() {
    clearTimeout(CloudSave.timer);
    CloudSave.lastSyncedAt = 0;
    auth.signOut().then(() => auth.signInAnonymously()).catch(() => {}).then(() => {
        refreshAfterCloudAuthChange();
        showMessage('החשבון הזה נמחק. ההתקדמות נשארה במכשיר הזה', 'warning');
    });
}

// The XP counters the cloud holds (protected node + the copy in the state).
function cloudXpProgress(save, cloudState) {
    return typeof ZbangXPCloud !== 'undefined' ? ZbangXPCloud.progressFromNode(save, cloudState) : null;
}

// On opening the app with an account attached: take in the XP other devices
// saved (counters only - the wallet is never touched). Reads, never writes.
function pullCloudProgress() {
    if (!cloudSaveActive() || CloudSave.awaitingRestoreChoice) return Promise.resolve();
    if (typeof xpAdoptCloudProgress !== 'function') return Promise.resolve();
    const uid = auth.currentUser.uid;
    if (CloudSave.pulledFor === uid) return Promise.resolve(); // once per account per launch
    CloudSave.pulledFor = uid;
    return confirmAccountStillExists().then(alive => {
        if (!alive) return;
        return fetchCloudSave().then(save => {
            if (!save || !save.state) return;
            let cloudState = null;
            try { cloudState = JSON.parse(save.state); } catch (e) { /* unreadable: keep local */ }
            const progress = cloudXpProgress(save, cloudState);
            if (progress) xpAdoptCloudProgress(progress);
        });
    }).catch(err => { CloudSave.pulledFor = null; console.warn('Reading cloud XP failed:', err); });
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
        // 1.2: the XP counters of the protected node count as part of the backup
        const cloudXp = cloudXpProgress(save, cloudState);
        if (cloudXp) cloudState.xpProgress = cloudXp;

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
                // ...but keep the XP other devices saved there (counters only go up)
                if (typeof xpMergeCloudCopy === 'function') {
                    xpMergeCloudCopy(cloudState);
                    localStorage.setItem('zabangState', JSON.stringify(gameState));
                }
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

// Permanently deletes the account and everything stored under it in the
// cloud - the cloud save and this player's leaderboard rows (App Store
// guideline 5.1.1(v): an app that lets people create an account must let them
// delete it from inside the app). Firebase only lets a user delete themselves
// right after signing in, so the password is asked for again first. Progress
// on THIS device stays, and play continues anonymously like before the
// account existed.
function cloudDeleteAccount(password) {
    if (!cloudSaveActive() || blockedByActiveMatch()) return;
    const user = auth.currentUser;
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, password);
    clearTimeout(CloudSave.timer);
    CloudSave.awaitingRestoreChoice = true; // nothing may re-create the save mid-delete
    user.reauthenticateWithCredential(cred).then(() => {
        const removals = [cloudSaveRef().remove()];
        if (gameState.playerId) {
            ['leaderboard', 'leaderboard_precise', 'leaderboard_tower'].forEach(path => {
                const ref = db.ref(path + '/' + gameState.playerId);
                // only rows this account owns - the rules refuse anyone else's
                removals.push(ref.once('value').then(snap => {
                    if (snap.exists() && snap.child('uid').val() === user.uid) return ref.remove();
                }).catch(err => console.warn('Leaderboard row not removed:', path, err)));
            });
        }
        return Promise.all(removals);
    }).then(() => user.delete())
        .then(() => auth.signInAnonymously())
        .then(() => {
            CloudSave.awaitingRestoreChoice = false;
            CloudSave.lastSyncedAt = 0;
            closeCloudAuthModal();
            refreshAfterCloudAuthChange();
            showMessage('החשבון והגיבוי בענן נמחקו', 'success');
        })
        .catch(err => {
            CloudSave.awaitingRestoreChoice = false;
            showMessage(cloudAuthErrorText(err), 'error');
        });
}

function confirmDeleteAccount() {
    if (!cloudSaveActive() || blockedByActiveMatch()) return;
    showConfirm('למחוק את החשבון לצמיתות? הגיבוי בענן והשיאים שלך בטבלת המובילים יימחקו ואי אפשר לשחזר אותם. ההתקדמות במכשיר הזה תישאר.',
        () => openCloudAuthModal('delete'));
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

let cloudAuthMode = 'create'; // 'create' | 'signin' | 'delete'

function openCloudAuthModal(mode) {
    cloudAuthMode = (mode === 'signin' || mode === 'delete') ? mode : 'create';
    const overlay = document.getElementById('cloudAuthOverlay');
    if (!overlay) return;
    const deleting = cloudAuthMode === 'delete';
    document.getElementById('cloudAuthTitle').textContent =
        deleting ? 'הכנס סיסמה כדי למחוק את החשבון'
        : cloudAuthMode === 'signin' ? 'כניסה לחשבון קיים' : 'יצירת חשבון לגיבוי';
    const submit = document.getElementById('cloudAuthSubmitBtn');
    submit.textContent = deleting ? 'מחק חשבון' : cloudAuthMode === 'signin' ? 'כניסה' : 'צור חשבון';
    submit.classList.toggle('red-btn', deleting);
    submit.classList.toggle('blue-btn', !deleting);
    const emailInput = document.getElementById('cloudEmailInput');
    emailInput.value = deleting ? cloudSaveEmail() : '';
    emailInput.disabled = deleting;
    document.getElementById('cloudPasswordInput').value = '';
    const reset = document.getElementById('cloudResetBtn');
    if (reset) reset.style.display = deleting ? 'none' : '';
    overlay.style.display = 'flex';
    document.getElementById(deleting ? 'cloudPasswordInput' : 'cloudEmailInput').focus();
}

function closeCloudAuthModal() {
    const overlay = document.getElementById('cloudAuthOverlay');
    if (overlay) overlay.style.display = 'none';
}

function submitCloudAuth() {
    const email = (document.getElementById('cloudEmailInput').value || '').trim();
    const password = document.getElementById('cloudPasswordInput').value || '';
    if (cloudAuthMode === 'delete') {
        if (!password) { showMessage('צריך סיסמה', 'warning'); return; }
        cloudDeleteAccount(password);
        return;
    }
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
            <button class="close-modal-btn" onclick="cloudSignOut()">התנתקות</button>
            <button class="cloud-link-btn cloud-delete-btn" onclick="confirmDeleteAccount()">מחיקת החשבון</button>`;
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
    auth.onAuthStateChanged(() => {
        renderCloudSaveSection();
        pullCloudProgress(); // 1.2: XP from the account's other devices
    });
}
