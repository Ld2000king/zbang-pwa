// The web/PWA build plays offline from the service worker's precache (sw.js).
// A first-time visitor's page isn't controlled by the service worker yet, so
// a script that is only cached at runtime would be missing offline - every
// local file index.html loads must be in PRECACHE. Run with:  node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('every local script and stylesheet in index.html is precached by sw.js', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    const precache = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
    const local = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)]
        .map(m => m[1].split('?')[0])
        .filter(u => !/^(https?:|data:|#)/.test(u) && /\.(js|css)$/.test(u));
    assert.ok(local.length > 20, 'found ' + local.length + ' local files');
    const missing = local.filter(u => !precache.includes(`'./${u}'`));
    assert.deepEqual(missing, [], 'not precached');
    for (const u of local) assert.ok(fs.existsSync(path.join(ROOT, u)), 'file exists: ' + u);
});

test('every file in PRECACHE exists (one missing file fails the whole install)', () => {
    const precache = read('sw.js').match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
    const files = [...precache.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
    const missing = files.filter(f => !fs.existsSync(path.join(ROOT, f)));
    assert.deepEqual(missing, []);
});
