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

// resolves once we have a signed-in user (anonymous by default). Every
// write that Security Rules protect (multiplayer rooms, word submissions)
// should wait on this before touching Firebase.
let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });

if (FIREBASE_READY && typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    auth = firebase.auth();

    auth.onAuthStateChanged(user => {
        if (user) authReadyResolve(user);
    });

    // Anonymous sign-in gives every regular player a stable, Rules-verifiable
    // identity without needing a real account. The admin signs in separately
    // with a real email/password account (see admin.js / adminSignIn()),
    // which REPLACES the anonymous session with a fixed, permanent UID.
    if (!auth.currentUser) {
        auth.signInAnonymously().catch(err => console.error('Anonymous sign-in failed:', err));
    }
}
