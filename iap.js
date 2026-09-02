// ============================================================================
// iap.js - Real coin-package purchases via Apple StoreKit / Google Play
// Billing, through the cordova-plugin-purchase bridge (Capacitor runs
// Cordova plugins natively - see capacitor.config.json). This calls each
// platform's own purchase system directly; no third-party payment processor
// is involved, which is what App Store review requires for digital goods.
//
// This file is inert everywhere except a native build with the plugin
// actually wired in. Getting there still needs, in order:
//   1. npm install cordova-plugin-purchase
//   2. npx cap add ios / npx cap sync    (Mac + Xcode required)
//   3. In Xcode: add the "In-App Purchase" capability to the app target
//   4. In App Store Connect (and Google Play Console for Android): create
//      consumable products with ids EXACTLY matching COIN_PACKAGES' `sku`
//      in game.js
// None of that is possible from this environment. Until it's done,
// iapNativeAvailable() is false and every purchase button falls back to
// showIapComingSoon(), same as before this file existed.
// ============================================================================

const IAP = { store: null, ready: false };

function iapNativeAvailable() {
    return typeof window.CdvPurchase !== 'undefined'
        && typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
}

function initIAP() {
    if (!iapNativeAvailable()) return; // web/PWA build, or the native plugin isn't wired in yet
    const { store, Platform, ProductType } = window.CdvPurchase;
    IAP.store = store;

    COIN_PACKAGES.forEach(pack => {
        store.register([
            { id: pack.sku, type: ProductType.CONSUMABLE, platform: Platform.APPLE_APPSTORE },
            { id: pack.sku, type: ProductType.CONSUMABLE, platform: Platform.GOOGLE_PLAY }
        ]);
    });

    store.when()
        // real, localized price/currency straight from the store - once a
        // product loads this replaces the static placeholder price shown
        // before the store responded
        .productUpdated(product => {
            const pack = COIN_PACKAGES.find(p => p.sku === product.id);
            if (pack && product.pricing) pack.livePrice = product.pricing.price;
            refreshShopIfOpen();
        })
        .approved(transaction => transaction.verify())
        .verified(receipt => {
            (receipt.collection || []).forEach(purchase => grantCoinPackage(purchase.id, purchase.transactionId));
            receipt.finish();
        });

    store.error(err => console.error('IAP error:', err));
    store.initialize([Platform.APPLE_APPSTORE, Platform.GOOGLE_PLAY]).then(() => {
        IAP.ready = true;
        refreshShopIfOpen();
    });
}

// Grants one coin package. transactionId (when present) guards against the
// same purchase being credited twice - e.g. its receipt getting redelivered
// on next launch because the app closed between verified() and finish()
// actually completing.
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
// places a real order when the native store is ready, otherwise falls back
// to the existing "coming soon" modal exactly like before this file existed.
function buyCoinPackage(sku) {
    if (!iapNativeAvailable() || !IAP.ready) { showIapComingSoon(); return; }
    const product = IAP.store.get(sku);
    const offer = product && product.getOffer();
    if (!product || !product.canPurchase || !offer) { showIapComingSoon(); return; }
    offer.order().then(error => {
        if (!error) return; // success - the .approved()/.verified() handlers above grant the coins
        if (error.code === CdvPurchase.ErrorCode.PAYMENT_CANCELLED) return; // user backed out, not a failure
        console.error('Purchase failed:', error);
        showMessage('הרכישה נכשלה - נסה שוב', 'error');
    });
}

function refreshShopIfOpen() {
    const screen = document.getElementById('shopScreen');
    if (screen && screen.classList.contains('active')) renderShop();
}

// 'deviceready' is Cordova/Capacitor's signal that native plugins have
// loaded - never fires on the plain web/PWA build, which is exactly when
// this should stay inert.
document.addEventListener('deviceready', initIAP, false);
