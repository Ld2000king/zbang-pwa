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
        approvedWordsSet.clear();
        // normalize final letters so approved words are findable on the board
        // (the board only uses regular letter forms) - matches game.js
        Object.entries(words).forEach(([word, points]) => {
            const norm = typeof normalizeFinals === 'function' ? normalizeFinals(word) : word;
            approvedWordsSet.add(norm);
            if (removedWordsSet.has(norm)) return; // a removal wins over an old approval
            HEBREW_DICTIONARY[norm] = points;
        });
        if (typeof invalidateDictionaryCache === 'function') invalidateDictionaryCache();
        refreshDictionaryScreen();
    });
}

// The admin's removals (see the word-bank screen below). Applied on every
// device: the expansion packs are static files, so the only way to take a word
// out of the game is this shared blocklist.
function loadRemovedWordsFromFirebase() {
    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !db) return;
    if (typeof removedWordsSet === 'undefined') return;
    db.ref('removed_words').on('value', snap => {
        removedWordsSet.clear();
        Object.keys(snap.val() || {}).forEach(w => {
            removedWordsSet.add(w);
            if (typeof normalizeFinals === 'function') removedWordsSet.add(normalizeFinals(w));
        });
        if (typeof applyRemovedWords === 'function') applyRemovedWords();
        refreshDictionaryScreen();
    }, err => {
        console.warn('removed_words not readable (add a Security Rule to enable word removal):', err.message);
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

// ============================================================================
// Word bank - the admin's view of the WHOLE dictionary, with add + remove.
//
// The dictionary is assembled from static files (game.js base + words.js +
// words-bulk.js) that can't be rewritten from a phone, so the two edits are
// stored in Firebase and applied on top of the packs on every device:
//   * add    -> approved_words/{word} = points   (the node the approval queue
//               already uses, so an added word reaches every player live)
//   * remove -> removed_words/{word} = true      (a blocklist; applyRemovedWords()
//               in game.js drops those keys after the packs are merged)
// Both nodes are admin-UID-only in the Security Rules; the checks here are
// just UI guards.
// ============================================================================

const approvedWordsSet = new Set(); // normalized, mirrors approved_words
const DICT_PAGE_SIZE = 120;         // 12k+ rows can't all be in the DOM

let dictQuery = '';
let dictShown = DICT_PAGE_SIZE;
let dictMode = 'all'; // 'all' | 'removed'
let dictSortedCache = null;
let dictSortedFrom = null;

// Alphabetical dictionary keys, memoized against game.js's own key cache so a
// sort only happens when the dictionary actually changed. Hebrew letters are
// contiguous in Unicode and in alphabetical order, so a plain compare sorts
// correctly and much faster than localeCompare over 12k words.
function sortedDictionaryWords() {
    const src = typeof dictionaryWordList === 'function'
        ? dictionaryWordList() : Object.keys(HEBREW_DICTIONARY);
    if (dictSortedFrom !== src) {
        dictSortedFrom = src;
        dictSortedCache = src.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }
    return dictSortedCache;
}

function openDictionaryScreen() {
    if (!isAdminUser()) return;
    dictQuery = '';
    dictShown = DICT_PAGE_SIZE;
    dictMode = 'all';
    const input = document.getElementById('dictSearchInput');
    if (input) input.value = '';
    const addInput = document.getElementById('dictAddInput');
    if (addInput) addInput.value = '';
    showScreen('dictionaryScreen');
    renderDictionaryScreen();
}

function onDictSearchInput(value) {
    dictQuery = value || '';
    dictShown = DICT_PAGE_SIZE; // a new search always starts from the top
    renderDictionaryScreen();
}

function setDictMode(mode) {
    dictMode = mode;
    dictShown = DICT_PAGE_SIZE;
    renderDictionaryScreen();
}

// Switches between the live dictionary and the removed-words blocklist.
function toggleDictRemovedView() {
    setDictMode(dictMode === 'removed' ? 'all' : 'removed');
}

function showMoreDictWords() {
    dictShown += DICT_PAGE_SIZE;
    renderDictionaryScreen();
}

// The rows to show: either the live dictionary or the removed-words blocklist,
// filtered by the search box.
function dictionaryMatches() {
    const q = normalizeFinals(dictQuery.trim());
    const all = dictMode === 'removed'
        ? Array.from(removedWordsSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        : sortedDictionaryWords();
    return q ? all.filter(w => w.includes(q)) : all;
}

function renderDictionaryScreen() {
    const listEl = document.getElementById('dictWordList');
    if (!listEl) return;

    const matches = dictionaryMatches();
    const shown = matches.slice(0, dictShown);

    const statsEl = document.getElementById('dictStats');
    if (statsEl) {
        const total = sortedDictionaryWords().length;
        statsEl.textContent = dictMode === 'removed'
            ? `${matches.length} מילים שהוסרו${dictQuery ? ' (מתוך החיפוש)' : ''}`
            : `${matches.length.toLocaleString('he-IL')} מילים${dictQuery ? ` מתוך ${total.toLocaleString('he-IL')}` : ' במאגר'}`;
    }

    const removedBtn = document.getElementById('dictRemovedToggle');
    if (removedBtn) {
        removedBtn.textContent = dictMode === 'removed'
            ? 'חזרה למאגר המלא'
            : `מילים שהוסרו (${removedWordsSet.size})`;
    }

    listEl.innerHTML = '';
    if (shown.length === 0) {
        listEl.innerHTML = '<p class="no-subs">לא נמצאו מילים</p>';
    } else {
        shown.forEach(word => listEl.appendChild(dictionaryRow(word)));
    }

    const moreBtn = document.getElementById('dictMoreBtn');
    if (moreBtn) {
        const rest = matches.length - shown.length;
        moreBtn.style.display = rest > 0 ? 'block' : 'none';
        moreBtn.textContent = `הצג עוד ${Math.min(rest, DICT_PAGE_SIZE)} (נותרו ${rest.toLocaleString('he-IL')})`;
    }
}

function dictionaryRow(word) {
    const row = document.createElement('div');
    row.className = 'submission-row dict-row';

    if (dictMode === 'removed') {
        row.innerHTML = `
            <span class="sub-word">${escapeHtml(word)}</span>
            <span class="sub-actions">
                <span class="sub-status sub-pending">הוסרה</span>
                <button class="approve-btn">${icon('check')} החזר</button>
            </span>`;
        row.querySelector('.approve-btn').onclick = () => adminRestoreWord(word);
        return row;
    }

    const points = HEBREW_DICTIONARY[word];
    const source = approvedWordsSet.has(word) ? 'מאושרת' : 'מובנית';
    row.innerHTML = `
        <span class="sub-word">${escapeHtml(word)} <small>(+${points})</small></span>
        <span class="sub-actions">
            <span class="sub-status ${approvedWordsSet.has(word) ? 'sub-approved' : 'sub-builtin'}">${source}</span>
            <button class="reject-btn">${icon('close')} הסר</button>
        </span>`;
    row.querySelector('.reject-btn').onclick = () => adminRemoveWord(word);
    return row;
}

// Both edits are real writes to the shared database - refuse early (with a
// clear reason) instead of letting Firebase reject them.
function adminCanWrite() {
    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !db) {
        showMessage('Firebase לא מוגדר - אי אפשר לערוך את המאגר', 'error');
        return false;
    }
    if (!isSignedInAsAdmin()) {
        showMessage('צריך להתחבר כאדמין כדי לערוך את המאגר', 'error');
        return false;
    }
    return true;
}

function adminAddWord() {
    const input = document.getElementById('dictAddInput');
    const raw = (input ? input.value : '').trim();
    if (!raw) return;

    // Hebrew letters only: it also guarantees a legal Firebase key (no . # $ [ ] /)
    if (!/^[א-ת]{2,20}$/.test(raw)) {
        showMessage('מילה בעברית בלבד, 2-20 אותיות', 'error');
        return;
    }
    const word = normalizeFinals(raw);
    if (HEBREW_DICTIONARY[word] !== undefined) {
        showMessage(`"${word}" כבר במאגר`, 'warning');
        return;
    }
    if (!adminCanWrite()) return;

    const points = pointsForWord(word);
    db.ref('approved_words/' + word).set(points)
        // a word that was removed before must lose its blocklist entry, or the
        // removed_words listener would immediately delete it again
        .then(() => db.ref('removed_words/' + word).remove().catch(() => {}))
        .then(() => {
            removedWordsSet.delete(word);
            approvedWordsSet.add(word);
            HEBREW_DICTIONARY[word] = points;
            if (typeof invalidateDictionaryCache === 'function') invalidateDictionaryCache();
            if (input) input.value = '';
            showMessage(`"${word}" נוספה למאגר (+${points})`, 'success');
            renderDictionaryScreen();
        })
        .catch(err => showMessage('שגיאה: ' + err.message, 'error'));
}

function adminRemoveWord(word) {
    if (!adminCanWrite()) return;
    if (!confirm(`להסיר את "${word}" ממאגר המילים?`)) return;

    db.ref('removed_words/' + word).set(true)
        // if it got in via an approval, drop that too - otherwise the word
        // stays listed as approved even though it's blocked
        .then(() => (approvedWordsSet.has(word)
            ? db.ref('approved_words/' + word).remove().catch(() => {})
            : null))
        .then(() => {
            removedWordsSet.add(word);
            approvedWordsSet.delete(word);
            if (typeof applyRemovedWords === 'function') applyRemovedWords();
            showMessage(`"${word}" הוסרה מהמאגר`, 'warning');
            renderDictionaryScreen();
        })
        .catch(err => showMessage('שגיאה: ' + err.message, 'error'));
}

function adminRestoreWord(word) {
    if (!adminCanWrite()) return;

    db.ref('removed_words/' + word).remove()
        .then(() => {
            removedWordsSet.delete(word);
            // put it straight back so the admin sees the effect immediately; the
            // packs would also restore it on the next launch
            if (HEBREW_DICTIONARY[word] === undefined) {
                HEBREW_DICTIONARY[word] = pointsForWord(word);
                if (typeof invalidateDictionaryCache === 'function') invalidateDictionaryCache();
            }
            showMessage(`"${word}" הוחזרה למאגר`, 'success');
            renderDictionaryScreen();
        })
        .catch(err => showMessage('שגיאה: ' + err.message, 'error'));
}

// Re-render only when the word bank is the visible screen (the Firebase
// listeners fire on every device, most of the time with nothing on screen).
function refreshDictionaryScreen() {
    const screen = document.getElementById('dictionaryScreen');
    if (screen && screen.classList.contains('active')) renderDictionaryScreen();
}

if (typeof authReady !== 'undefined') {
    authReady.then(loadApprovedWordsFromFirebase);
    authReady.then(loadRejectedWordsFromFirebase);
    authReady.then(loadRemovedWordsFromFirebase);
}

// A persisted admin session is restored asynchronously after page load, so
// refresh the home/profile UI when auth resolves - otherwise cities stay
// locked until the next manual navigation.
if (typeof auth !== 'undefined' && auth) {
    auth.onAuthStateChanged(() => {
        if (typeof refreshAfterAdminChange === 'function') refreshAfterAdminChange();
    });
}
