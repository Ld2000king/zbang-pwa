// ============================================================================
// native.js - small glue that only matters inside the Capacitor native app.
// On the web/PWA every function here returns immediately, so the browser
// build behaves exactly as before.
//
// Android hardware/gesture Back button: the game has no URL history (screens
// are just toggled .active classes), so Capacitor's default Back would close
// the whole app - even mid-game. Instead Back does what the on-screen
// buttons already do: close the open popup, pause a running game, or step
// back toward the home screen; only Back on the home screen leaves the app.
// (iOS has no Back button - this listener simply never fires there.)
//
// Also pauses music and a running solo/bot game when the app is sent to the
// background (both platforms).
// ============================================================================

function isNativeApp() {
    return typeof Capacitor !== 'undefined' && !!Capacitor.isNativePlatform && Capacitor.isNativePlatform();
}

function nativeAppPlugin() {
    return (isNativeApp() && Capacitor.Plugins && Capacitor.Plugins.App) || null;
}

function isShown(id) {
    const el = document.getElementById(id);
    return !!el && el.style.display !== 'none' && el.style.display !== '';
}

// Popups, in the order Back should close them. A handler returning nothing
// means "Back is swallowed here" - used where closing could lose something.
const BACK_OVERLAYS = [
    ['adOverlay', () => {}],              // a rewarded ad is counting down
    ['confirmOverlay', () => {}],         // yes/no must be an explicit tap - "no" can be a real choice
    ['infoOverlay', () => closeInfoModal()],
    ['nameOverlay', () => {
        // the first-run name prompt is mandatory (its cancel button is hidden)
        const cancel = document.getElementById('nameCancelBtn');
        if (cancel && cancel.style.display !== 'none') closeNameModal();
    }],
    ['cloudAuthOverlay', () => closeCloudAuthModal()],
    ['pauseOverlay', () => resumeGame()],
    ['dailyRewardOverlay', () => closeDailyReward()],
    ['menuOverlay', () => closeMenu()]
];

// Screens that need something other than "go home" on Back.
const BACK_SCREENS = {
    homeScreen: () => { const app = nativeAppPlugin(); if (app) app.minimizeApp(); },
    gameScreen: backDuringGame,
    battleScreen: backDuringGame,
    roundEndScreen: () => {},             // mid-battle, the next round starts on its own
    mpSearchScreen: () => cancelRandomSearch(),
    arenaScreen: () => closeArenaScreen(),
    wordBankScreen: () => closeWordBank()
};

// Pause a solo/bot game (same as the pause button). Multiplayer can't be
// paused and leaving would forfeit, so there Back does nothing.
function backDuringGame() {
    if (currentGame.mode === 'multiplayer') return;
    pauseGame();
}

function handleNativeBack() {
    const overlay = BACK_OVERLAYS.find(([id]) => isShown(id));
    if (overlay) { overlay[1](); return; }

    const screen = document.querySelector('.screen.active');
    const handler = screen && BACK_SCREENS[screen.id];
    if (handler) handler();
    else goHome();
}

// Switching away from the app (home button, a call, another app): on a phone
// the webview keeps running, so the round's timer would tick down unseen and
// the music would keep playing. Pause both, the same way the pause button
// does; the player resumes the game themselves from the pause popup.
function handleNativeAppPause() {
    const audio = document.getElementById('bgMusic');
    if (audio) audio.pause();
    backDuringGame(); // no-op when no solo/bot game is running
}

function handleNativeAppResume() {
    attemptPlay(); // respects the player's music on/off setting
}

(function initNativeGlue() {
    const app = nativeAppPlugin();
    if (!app) return; // web/PWA
    app.addListener('backButton', handleNativeBack);
    app.addListener('pause', handleNativeAppPause);
    app.addListener('resume', handleNativeAppResume);
})();
