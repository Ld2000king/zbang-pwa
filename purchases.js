// ============================================================================
// purchases.js - the ONE purchase layer the game talks to.
//
// The game only ever calls buyCoinPackage(sku) (the shop's buy button, see
// renderShop() in game.js). Everything below decides HOW that purchase
// happens on the platform we're running on:
//
//   web / PWA  -> no purchase system exists; every buy button shows
//                 showIapComingSoon(). No native code is ever touched.
//   android    -> Google Play Billing  } both through cordova-plugin-purchase,
//   ios        -> Apple StoreKit       } see purchases-native.js
//
// A store implementation registers itself with registerPurchaseProvider()
// under a Capacitor platform name ('android' / 'ios'). This file knows
// nothing about Google or Apple - everything store-specific lives in the
// provider, so adding iOS later is `npx cap add ios` + the App Store Connect
// setup, with no change here or in game.js.
//
// What stays shared (this file): the coin catalog (COIN_PACKAGES in game.js),
// granting coins, the double-credit guard, and refreshing the shop.
// ============================================================================

const Purchases = {
    providers: {},  // platform name -> factory(callbacks) returning a provider
    active: null    // the running provider, or null (web, or not started yet)
};

// 'web' on the PWA / a normal browser, otherwise Capacitor's platform name.
function purchasesPlatform() {
    if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) return 'web';
    return Capacitor.getPlatform();
}

// Called by each store implementation file at load time.
function registerPurchaseProvider(platform, factory) {
    Purchases.providers[platform] = factory;
}

// Everything a provider is allowed to do to the game, in one place.
const purchaseCallbacks = {
    // the store's real, localized price replaces the static placeholder
    onPrice(sku, price) {
        const pack = COIN_PACKAGES.find(p => p.sku === sku);
        if (pack && price) pack.livePrice = price;
        refreshShopIfOpen();
    },
    onReady() {
        refreshShopIfOpen();
    },
    onGranted(sku, transactionId) {
        grantCoinPackage(sku, transactionId);
    },
    onFailed(error) {
        console.error('Purchase failed:', error);
        showMessage('הרכישה נכשלה - נסה שוב', 'error');
    }
};

function initPurchases() {
    if (Purchases.active) return;
    const factory = Purchases.providers[purchasesPlatform()];
    if (!factory) return; // web/PWA, or a platform with no store wired in
    try {
        Purchases.active = factory(purchaseCallbacks);
    } catch (err) {
        // a broken store must never take the game down with it - the shop
        // just keeps showing "coming soon"
        console.error('Purchases init failed:', err);
        Purchases.active = null;
    }
}

// Grants one coin package. transactionId (when present) guards against the
// same purchase being credited twice - e.g. its receipt getting redelivered
// on next launch because the app closed between granting and finishing the
// transaction.
function grantCoinPackage(sku, transactionId) {
    const pack = COIN_PACKAGES.find(p => p.sku === sku);
    if (!pack) return;
    if (transactionId) {
        if (gameState.grantedIapTransactions.includes(transactionId)) return;
        gameState.grantedIapTransactions.push(transactionId);
        // keep the log from growing forever
        if (gameState.grantedIapTransactions.length > 200) gameState.grantedIapTransactions.splice(0, 100);
    }
    gameState.coins += pack.coins;
    saveGameState();
    updateHomeUI();
    refreshShopIfOpen();
    showMessage(`קיבלת ${pack.coins} מטבעות! תודה על הרכישה`, 'success');
}

// The coin-package "buy" button's onclick (see renderShop() in game.js) -
// places a real order when a native store is ready, otherwise falls back to
// the "coming soon" modal (always, on the web/PWA build).
function buyCoinPackage(sku) {
    const provider = Purchases.active;
    if (!provider || !provider.canBuy(sku)) { showIapComingSoon(); return; }
    provider.buy(sku);
}

function refreshShopIfOpen() {
    const screen = document.getElementById('shopScreen');
    if (screen && screen.classList.contains('active')) renderShop();
}

// 'deviceready' is Capacitor/Cordova's signal that native plugins have
// loaded - it never fires on the plain web/PWA build, which is exactly when
// purchases should stay inert.
document.addEventListener('deviceready', initPurchases, false);
