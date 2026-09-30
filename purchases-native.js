// ============================================================================
// purchases-native.js - the native store implementation behind purchases.js,
// for Google Play Billing (Android) and Apple StoreKit (iOS).
//
// Both go through cordova-plugin-purchase (window.CdvPurchase - free, MIT,
// no server or third-party payment processor; Capacitor runs Cordova plugins
// natively). The plugin only exists inside a native build, so on the web/PWA
// nothing in this file ever runs: purchases.js only calls a provider on
// Capacitor's 'deviceready', which the browser never fires.
//
// EVERY difference between Google and Apple belongs in NATIVE_STORES below.
// The rest of this file is shared by both.
//
// Still needed before a real purchase can happen (none of it free / possible
// from here - see docs/ANDROID.md):
//   * Google Play Console: consumable in-app products whose ids match
//     productId() below, and an Internal Testing track with license testers
//   * iOS: `npx cap add ios` on a Mac, the "In-App Purchase" capability in
//     Xcode, and matching consumables in App Store Connect
// ============================================================================

// Per-store settings. `platform` is the CdvPurchase.Platform key; productId()
// maps the game's catalog sku (COIN_PACKAGES in game.js) to that store's
// product id - identical today, but either store can diverge here without
// touching the catalog.
const NATIVE_STORES = {
    android: {
        platform: 'GOOGLE_PLAY',
        productId: sku => sku
    },
    ios: {
        platform: 'APPLE_APPSTORE',
        productId: sku => sku
    }
};

function createNativePurchaseProvider(storeConfig, callbacks) {
    if (typeof window.CdvPurchase === 'undefined') return null; // plugin not in this build
    const { store, ProductType, TransactionState, ErrorCode, LogLevel } = window.CdvPurchase;
    const platform = window.CdvPurchase.Platform[storeConfig.platform];
    let ready = false;

    const skuFor = productId => {
        const pack = COIN_PACKAGES.find(p => storeConfig.productId(p.sku) === productId);
        return pack ? pack.sku : null;
    };

    store.verbosity = LogLevel.WARNING;
    store.register(COIN_PACKAGES.map(pack => ({
        id: storeConfig.productId(pack.sku),
        type: ProductType.CONSUMABLE,
        platform
    })));

    store.when()
        .productUpdated(product => {
            const sku = skuFor(product.id);
            if (sku && product.pricing) callbacks.onPrice(sku, product.pricing.price);
        })
        .approved(transaction => transaction.verify())
        .verified(receipt => {
            // Grant from the store's own transactions, not receipt.collection:
            // with no receipt-validation server configured (the free setup),
            // the plugin's local "verification" leaves collection empty, so
            // reading it would charge the player and grant nothing.
            // Only APPROVED transactions - never PENDING (e.g. a cash payment
            // not completed yet) and never ones already FINISHED earlier.
            const transactions = (receipt.sourceReceipt && receipt.sourceReceipt.transactions) || [];
            transactions.forEach(transaction => {
                if (transaction.state !== TransactionState.APPROVED) return;
                (transaction.products || []).forEach(p => {
                    const sku = skuFor(p.id);
                    if (sku) callbacks.onGranted(sku, transaction.transactionId);
                });
            });
            // finishing a consumable is what lets it be bought again (Google
            // "consumes" it, Apple closes the transaction)
            receipt.finish();
        })
        .unverified(result => console.error('Purchase could not be verified:', result));

    store.error(err => console.error('Store error:', err));

    store.initialize([platform]).then(errors => {
        if (errors && errors.length) console.error('Store init errors:', errors);
        ready = true;
        callbacks.onReady();
    });

    return {
        canBuy(sku) {
            if (!ready) return false;
            const product = store.get(storeConfig.productId(sku), platform);
            return !!(product && product.canPurchase && product.getOffer());
        },
        buy(sku) {
            const offer = store.get(storeConfig.productId(sku), platform).getOffer();
            offer.order().then(error => {
                if (!error) return; // success - approved()/verified() above grant the coins
                if (error.code === ErrorCode.PAYMENT_CANCELLED) return; // player backed out, not a failure
                callbacks.onFailed(error);
            });
        }
    };
}

Object.keys(NATIVE_STORES).forEach(name => {
    registerPurchaseProvider(name, callbacks => createNativePurchaseProvider(NATIVE_STORES[name], callbacks));
});
