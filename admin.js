// ============================================================================
// admin.js - Word-approval moderation queue (Firebase-backed) + admin auth.
// Loads AFTER game.js, multiplayer.js and firebase-config.js.
//
// IMPORTANT: checking gameState.playerName === 'ld2000' only controls what
// this client's UI SHOWS (the approve/reject panel). It is NOT a security
// boundary - anyone can rename themselves to 'ld2000' locally. The real
// authority is enforced by Firebase Security Rules, which only allow writes
// to /approved_words and deletes from /pending_requests from the ONE fixed
// admin UID (a real signed-in Firebase Auth account), set via adminSignIn().
// ============================================================================

function isAdminUser() {
    return gameState.playerName.trim().toLowerCase() === 'ld2000';
}

function isSignedInAsAdmin() {
    return !!(auth && auth.currentUser && !auth.currentUser.isAnonymous);
}

function adminAvailable() {
    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !auth) {
        showMessage('אדמין לא זמין - Firebase לא מוגדר', 'error');
        return false;
    }
    return true;
}

let adminPendingRef = null;

function adminSignIn() {
    if (!adminAvailable()) return;
    const email = prompt('אימייל אדמין:');
    if (!email) return;
    const password = prompt('סיסמה:');
    if (!password) return;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            showMessage('התחברת כאדמין!', 'success');
            refreshAfterAdminChange();
        })
        .catch(err => showMessage('התחברות נכשלה: ' + err.message, 'error'));
}

// Admin status affects coins/trophies/unlocked cities (see isAdminAccount in
// game.js), so refresh the home banner + profile whenever it changes.
function refreshAfterAdminChange() {
    if (typeof updateHomeUI === 'function') updateHomeUI();
    const profileEl = document.getElementById('profileScreen');
    if (profileEl && profileEl.classList.contains('active') && typeof renderProfile === 'function') {
        renderProfile();
    } else {
        renderAdminSection();
    }
}

function adminSignOut() {
    if (!auth) return;
    detachAdminListener();
    auth.signOut().then(() => {
        // fall back to an anonymous session so regular features keep working
        auth.signInAnonymously().catch(() => {});
        showMessage('התנתקת מאדמין', 'info');
        refreshAfterAdminChange();
    });
}

function renderAdminSection() {
    const section = document.getElementById('adminSection');
    if (!section) return;

    if (!isAdminUser()) {
        section.style.display = 'none';
        detachAdminListener();
        return;
    }

    section.style.display = 'block';
    const signedOut = document.getElementById('adminSignedOut');
    const signedIn = document.getElementById('adminSignedIn');

    if (isSignedInAsAdmin()) {
        signedOut.style.display = 'none';
        signedIn.style.display = 'block';
        attachAdminListener();
    } else {
        signedOut.style.display = 'block';
        signedIn.style.display = 'none';
        detachAdminListener();
    }
}

function attachAdminListener() {
    if (adminPendingRef || !db) return;
    adminPendingRef = db.ref('pending_requests');
    adminPendingRef.on('value', snap => {
        renderPendingRequests(snap.val() || {});
    }, err => {
        // Most likely cause: Security Rules don't recognize this UID as
        // admin yet - check that the ADMIN_UID placeholder was replaced.
        console.error('Failed to read pending requests (check Security Rules / admin UID):', err);
        showMessage('אין הרשאה לקרוא בקשות - בדוק את חוקי ה-Security Rules', 'error');
    });
}

function detachAdminListener() {
    if (adminPendingRef) { adminPendingRef.off(); adminPendingRef = null; }
}

function renderPendingRequests(requests) {
    const el = document.getElementById('adminPendingList');
    if (!el) return;
    const entries = Object.entries(requests);

    if (entries.length === 0) {
        el.innerHTML = '<p class="no-subs">אין בקשות ממתינות</p>';
        return;
    }

    el.innerHTML = '';
    entries.forEach(([reqId, req]) => {
        const points = req.points || pointsForWord(req.word);
        const row = document.createElement('div');
        row.className = 'submission-row';
        row.innerHTML = `
            <span class="sub-word">${escapeHtml(req.word)} <small>(+${points}, ${escapeHtml(req.submittedBy || '')})</small></span>
            <span class="sub-actions">
                <button class="approve-btn">${icon('check')} אשר</button>
                <button class="reject-btn">${icon('close')} דחה</button>
            </span>`;
        row.querySelector('.approve-btn').onclick = () => approvePendingWord(reqId, req.word, points);
        row.querySelector('.reject-btn').onclick = () => rejectPendingWord(reqId, req.word);
        el.appendChild(row);
    });
}

function approvePendingWord(reqId, word, points) {
    db.ref('approved_words/' + word).set(points)
        .then(() => db.ref('pending_requests/' + reqId).remove())
        .then(() => {
            const norm = typeof normalizeFinals === 'function' ? normalizeFinals(word) : word;
            HEBREW_DICTIONARY[norm] = points;
            if (typeof invalidateDictionaryCache === 'function') invalidateDictionaryCache();
            showMessage(`"${word}" אושרה ונוספה למאגר!`, 'success');
        })
        .catch(err => showMessage('שגיאה: ' + err.message, 'error'));
}

function rejectPendingWord(reqId, word) {
    db.ref('pending_requests/' + reqId).remove()
        .then(() => {
            // record a public rejection so the submitter's device can drop it
            // from their profile list (best-effort; needs a rejected_words rule)
            if (word) db.ref('rejected_words/' + word).set(true).catch(() => {});
            showMessage('הבקשה נדחתה', 'warning');
        })
        .catch(err => showMessage('שגיאה: ' + err.message, 'error'));
}

// Merge everyone's admin-approved words into the shared dictionary - this
// makes community-approved words available to every player, live, not just
// the device that originally submitted them.
function loadApprovedWordsFromFirebase() {
    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !db) return;
    db.ref('approved_words').on('value', snap => {
        const words = snap.val() || {};
        // normalize final letters so approved words are findable on the board
        // (the board only uses regular letter forms) - matches game.js
        Object.entries(words).forEach(([word, points]) => {
            const norm = typeof normalizeFinals === 'function' ? normalizeFinals(word) : word;
            HEBREW_DICTIONARY[norm] = points;
        });
        if (typeof invalidateDictionaryCache === 'function') invalidateDictionaryCache();
    });
}

// Mirror of loadApprovedWordsFromFirebase for rejections: populate the shared
// rejectedWordsSet (defined in game.js) so every player's profile can prune
// words the admin declined. Degrades gracefully if the rejected_words rule
// isn't configured yet (approval-based pruning still works without it).
function loadRejectedWordsFromFirebase() {
    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !db) return;
    if (typeof rejectedWordsSet === 'undefined') return;
    db.ref('rejected_words').on('value', snap => {
        rejectedWordsSet.clear();
        Object.keys(snap.val() || {}).forEach(w => {
            rejectedWordsSet.add(w);
            if (typeof normalizeFinals === 'function') rejectedWordsSet.add(normalizeFinals(w));
        });
        const profileEl = document.getElementById('profileScreen');
        if (profileEl && profileEl.classList.contains('active') && typeof renderSubmissions === 'function') {
            renderSubmissions();
        }
    }, err => {
        console.warn('rejected_words not readable (add a Security Rule to enable rejection cleanup):', err.message);
    });
}

if (typeof authReady !== 'undefined') {
    authReady.then(loadApprovedWordsFromFirebase);
    authReady.then(loadRejectedWordsFromFirebase);
}

// A persisted admin session is restored asynchronously after page load, so
// refresh the home/profile UI when auth resolves - otherwise cities stay
// locked until the next manual navigation.
if (typeof auth !== 'undefined' && auth) {
    auth.onAuthStateChanged(() => {
        if (typeof refreshAfterAdminChange === 'function') refreshAfterAdminChange();
    });
}
