// ============================================================================
// Service Worker - Zabang Royale
//
// Strategy overview:
//   * Non-http(s) requests (capacitor://, chrome-extension:, ...) are ignored
//     entirely, so the SW never interferes with Capacitor's native webview
//     asset loading (avoids blank-screen errors on iOS/Android shells).
//   * Firebase realtime / auth / analytics hosts are BYPASSED - never
//     intercepted or cached - so the live Firebase connection is untouched.
//   * Same-origin app code & shell use network-first: online players always
//     get the freshest code (no lock-in to a stale cached build), with the
//     cache as an offline fallback and an index.html fallback for navigations.
//   * Google Fonts + the Firebase SDK CDN use cache-first (immutable, versioned
//     URLs) for fast loads and offline availability.
//
// Bump VERSION on every release; activate() purges all older caches.
// ============================================================================

const VERSION = 'v11';
const APP_CACHE = 'zabang-app-' + VERSION;       // same-origin shell + code
const RUNTIME_CACHE = 'zabang-runtime-' + VERSION; // fonts + CDN statics

// Same-origin assets to pre-cache on install so first offline load works.
// (background-music.mp3 and Logo.png.jpeg are intentionally left to be
// runtime-cached on first use, to keep install fast.)
const PRECACHE = [
    './',
    './index.html',
    './style.css',
    './game.css',
    './game.js',
    './words.js',
    './words-bulk.js',
    './avatars.js',
    './icons.js',
    './firebase-config.js',
    './multiplayer.js',
    './admin.js',
    './manifest.json',
    './privacy.html',
    './terms.html',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png'
];

// Hosts that must ALWAYS reach the network live and never be cached or
// intercepted: Firebase realtime DB, auth, installations, and analytics.
// Matched by hostname suffix.
const BYPASS_HOSTS = [
    'firebaseio.com',
    'firebasedatabase.app',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firebaseinstallations.googleapis.com',
    'firebase.googleapis.com',
    'google-analytics.com',
    'analytics.google.com',
    'googletagmanager.com'
];

// Cross-origin STATIC we do want cached (fonts + Firebase compat SDK).
const CACHEABLE_CDN = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'www.gstatic.com'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    const keep = [APP_CACHE, RUNTIME_CACHE];
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Optional: lets the page trigger an immediate update (postMessage SKIP_WAITING).
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    let url;
    try {
        url = new URL(req.url);
    } catch (e) {
        return; // malformed URL - let the browser handle it
    }

    // 1. Ignore anything that isn't http(s): capacitor://, chrome-extension:,
    //    data:, blob:, etc. Critical for the Capacitor native shell.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // 2. Never touch Firebase realtime / auth / analytics - straight to network.
    if (BYPASS_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) return;

    // 3. Same-origin app code & shell -> network-first (fresh code, offline fallback).
    if (url.origin === self.location.origin) {
        event.respondWith(networkFirst(req));
        return;
    }

    // 4. Whitelisted CDN statics (fonts, Firebase SDK) -> cache-first.
    if (CACHEABLE_CDN.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
        event.respondWith(cacheFirst(req));
        return;
    }

    // 5. Any other cross-origin request -> leave to the network (no respondWith).
});

// Network-first: try the network (and refresh the cache), fall back to cache
// when offline. Navigations fall back to the cached index.html so an offline
// launch never shows a blank screen.
async function networkFirst(req) {
    try {
        const res = await fetch(req);
        if (res && res.ok) {
            const copy = res.clone();
            caches.open(APP_CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
    } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
            const shell = await caches.match('./index.html');
            if (shell) return shell;
        }
        return Response.error();
    }
}

// Cache-first: serve from cache if present, otherwise fetch and cache. Good for
// immutable, versioned assets (fonts, SDK) - fast and offline-friendly.
async function cacheFirst(req) {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (res && res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
    } catch (e) {
        return Response.error();
    }
}
