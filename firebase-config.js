// firebase-config.js
// ============================================================================
// הגדרות Firebase לפרויקט zbang-royale.
// שים לב: אנחנו משתמשים ב-compat SDK (תגי script רגילים), לא ב-import מודולים,
// כי הפרויקט סטטי בלי build step.
// זה בטוח לשיתוף/קומיט - ה-apiKey מיועד לצד לקוח; ההגנה היא ב-Security Rules.
// ============================================================================

const firebaseConfig = {
    apiKey: "AIzaSyAO_fD-DXwm5JRbdTdtObx9zbUmXxY4obs",
    authDomain: "zbang-royale.firebaseapp.com",
    // databaseURL חובה ל-Realtime Database - הדבק כאן את הכתובת שמופיעה בראש
    // עמוד ה-Realtime Database ב-Console (נראית כמו אחת מאלה):
    //   https://zbang-royale-default-rtdb.firebaseio.com               (אזור ברירת מחדל US)
    //   https://zbang-royale-default-rtdb.europe-west1.firebasedatabase.app  (אירופה)
    databaseURL: "https://zbang-royale-default-rtdb.firebaseio.com",
    projectId: "zbang-royale",
    storageBucket: "zbang-royale.firebasestorage.app",
    messagingSenderId: "571259407169",
    appId: "1:571259407169:web:b5b0c93511e4bd045e2fc0",
    measurementId: "G-QVCS0BMEEJ"
};

// true כשה-databaseURL מולא (לא ערך ה-placeholder). מאפשר למשחק לרוץ
// כרגיל (יחיד/בוטים) בלי Firebase עד שממלאים את הכתובת.
const FIREBASE_READY = !firebaseConfig.databaseURL.startsWith('PASTE_');

let db = null;
let auth = null;

// Resolves once we have a signed-in user (anonymous by default). Every
// write that Security Rules protect (multiplayer rooms, word submissions,
// leaderboard) should wait on this before touching Firebase.
//
// authReady is re-pointed to a fresh, already-resolved promise on EVERY
// auth change, not just the first - a plain one-shot Promise can only ever
// resolve once, so it would stay permanently frozen on whichever user was
// signed in first. Since every call site does `authReady.then(...)` inline
// (never caches the promise object), each one picks up whatever `authReady`
// currently points to. Without this, any write made after a later identity
// change (admin sign-in replacing anonymous, linking/signing into a cloud
// account, signing out back to a fresh anonymous session) would still embed
// the STALE first uid, which no longer matches the live auth.uid the
// Security Rules check - silently failing every such write with
// PERMISSION_DENIED forever after (this is what broke "add to leaderboard").
let authReadyResolve;
let authReady = new Promise(resolve => { authReadyResolve = resolve; });

if (FIREBASE_READY && typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    auth = firebase.auth();

    auth.onAuthStateChanged(user => {
        if (!user) return;
        if (authReadyResolve) {
            authReadyResolve(user);
            authReadyResolve = null; // only the first change needs to unblock the initial promise
        } else {
            authReady = Promise.resolve(user);
        }
    });

    // Anonymous sign-in gives every regular player a stable, Rules-verifiable
    // identity without needing a real account. The admin signs in separately
    // with a real email/password account (see admin.js / adminSignIn()),
    // which REPLACES the anonymous session with a fixed, permanent UID.
    if (!auth.currentUser) {
        auth.signInAnonymously().catch(err => console.error('Anonymous sign-in failed:', err));
    }
}
