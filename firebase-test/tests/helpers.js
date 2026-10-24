// Shared helpers for the emulator tests. Everything here talks ONLY to the
// local Firebase Emulator (127.0.0.1) under the demo project "demo-zbang" -
// a "demo-" project can't reach any real Firebase project.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/database');

const REPO = path.resolve(__dirname, '..', '..');
const XP = require(path.join(REPO, 'xp-engine.js'));
const XPCloud = require(path.join(REPO, 'xp-cloud.js'));

const PROJECT = 'demo-zbang';
const NS = `${PROJECT}-default-rtdb`;
const DB = 'http://127.0.0.1:9000';
const AUTH = 'http://127.0.0.1:9099';
const BUILD_4 = 'b59bff9'; // the 1.1 build 4 commit (its cloudsave.js == 24cd0da's)
const RULES = {
    current: path.join(REPO, 'database.rules.json'),
    proposal: path.join(REPO, 'firebase-test', 'rules', 'proposal-v1.2.rules.json')
};

if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    throw new Error('Run through `npm test` in firebase-test/ (starts the emulator)');
}

let appCount = 0;
const apps = [];

// One "device": its own Firebase app instance, auth session and connection.
function newDevice(label) {
    const app = firebase.initializeApp({
        apiKey: 'demo-api-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com`,
        databaseURL: `https://${NS}.firebaseio.com`
    }, `${label}-${++appCount}`);
    app.auth().useEmulator(AUTH, { disableWarnings: true });
    app.database().useEmulator('127.0.0.1', 9000);
    apps.push(app);
    return app;
}

async function disposeDevices() {
    await Promise.all(apps.splice(0).map(app => app.delete().catch(() => {})));
}

// Admin access to the emulator ("owner" bypasses the rules) - for setting up
// and inspecting test data only.
async function owner(method, p = '', body) {
    const res = await fetch(`${DB}/${p}.json?ns=${NS}`, {
        method, headers: { Authorization: 'Bearer owner' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`owner ${method} ${p}: ${res.status} ${await res.text()}`);
    return res.json();
}

async function useRules(which) {
    const res = await fetch(`${DB}/.settings/rules.json?ns=${NS}`, {
        method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: fs.readFileSync(RULES[which], 'utf8')
    });
    if (!res.ok) throw new Error(`rules ${which}: ${res.status} ${await res.text()}`);
}

async function resetEmulator() {
    await disposeDevices();
    await owner('PUT', '', null);
    await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

async function authUserExists(uid) {
    const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, {
        method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: [uid] })
    });
    const data = await res.json();
    return Array.isArray(data.users) && data.users.length > 0;
}

async function waitFor(check, what, ms = 15000) {
    const start = Date.now();
    for (;;) {
        const v = await check();
        if (v) return v;
        if (Date.now() - start > ms) throw new Error('timed out waiting for ' + what);
        await new Promise(r => setTimeout(r, 50));
    }
}

// ---- a device running the REAL 1.1 build 4 cloud-save code ------------------
// cloudsave.js is taken straight from the build-4 commit and run with minimal
// stand-ins for the page (no DOM). confirmAnswers: queue of 'yes' / 'no' for
// the restore-or-keep question.
function deviceV11(label, gameState, confirmAnswers = []) {
    const app = newDevice(label);
    const src = execFileSync('git', ['show', `${BUILD_4}:cloudsave.js`], { cwd: REPO }).toString();
    const storage = new Map();
    const ctx = {
        firebase, db: app.database(), auth: app.auth(), FIREBASE_READY: true, gameState,
        localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
        messages: [], errors: [],
        document: { getElementById: () => null },
        icon: () => '', escapeHtml: s => s,
        waitForAuth: () => Promise.resolve(app.auth().currentUser),
        setTimeout, clearTimeout, Promise, JSON, Date, Object, Array, String, Number, Math
    };
    ctx.showMessage = (m, type) => ctx.messages.push({ type, m });
    ctx.showConfirm = (msg, yes, no) => { (confirmAnswers.shift() === 'yes' ? yes : no || (() => {}))(); };
    ctx.console = { log() {}, warn() {}, info() {}, error: (...a) => ctx.errors.push(a.map(String).join(' ')) };
    vm.createContext(ctx);
    vm.runInContext(src + `
;globalThis.__v11 = { pushCloudSave, resolveCloudSaveAfterSignIn, cloudCreateAccount, cloudSignIn,
    cloudDeleteAccount, collectCloudState, CloudSave };`, ctx, { filename: `${BUILD_4}:cloudsave.js` });
    return { app, ctx, api: ctx.__v11 };
}

// ---- a device running the 1.2 logic (xp-engine + xp-cloud) ------------------
let clock = Date.now();
const nextTime = () => (clock += 1000);

class DeviceV12 {
    constructor(label, installId) {
        this.app = newDevice(label);
        this.installId = installId;
        this.progress = XP.createProgress();
        this.state = { playerName: label, coins: 100, diamonds: 0, level: 1, inventory: { hint: 3 } };
    }
    get uid() { return this.app.auth().currentUser.uid; }
    ref() { return this.app.database().ref('player_saves/' + this.uid); }
    earn(key, xp) {
        const r = XP.applyReward(this.progress, this.installId, key, xp, nextTime());
        this.progress = r.progress;
        this.state.diamonds += r.diamonds;   // each level's diamonds go into THIS wallet only
        this.state.level = XP.levelOf(this.progress);
        return r;
    }
    syncLevel() {
        this.state.level = XP.levelOf(this.progress); // the wallet is never topped up
    }
    async push() {
        const r = await XPCloud.pushSave(this.ref(), {
            stateObj: this.state, progress: this.progress,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        this.progress = r.progress;
        this.syncLevel();
        return r;
    }
    async pull() {
        const r = await XPCloud.pullProgress(this.ref(), this.progress);
        this.progress = r.progress;
        this.syncLevel();
        return r.node;
    }
    async restore() {
        const snap = await this.ref().once('value');
        const r = XPCloud.restoreFromNode(snap.val(), this.progress);
        this.state = r.state;
        this.progress = r.progress;
        return r;
    }
}

// ---- a device running the REAL 1.2 code from this working tree ----------------
// cloudsave.js (with its 1.2 changes) + xp-engine.js + xp-state.js + xp-game.js,
// with stand-ins only for the game parts they hook into.
function deviceV12Real(label, confirmAnswers = []) {
    const app = newDevice(label);
    const storage = new Map();
    const ctx = {
        firebase, db: app.database(), auth: app.auth(), FIREBASE_READY: true,
        gameState: { playerName: label, coins: 100, diamonds: 0, level: 1, xp: 0, xpToNextLevel: 100, inventory: { hint: 3 } },
        localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
        location: { search: '' }, URLSearchParams,
        messages: [], errors: [],
        document: { getElementById: () => null },
        icon: () => '', escapeHtml: s => s,
        waitForAuth: () => Promise.resolve(app.auth().currentUser),
        setTimeout, clearTimeout, Promise, JSON, Date, Object, Array, String, Number, Math, Map, Set, Error
    };
    ctx.window = ctx;
    ctx.showMessage = (m, type) => ctx.messages.push({ type, m });
    ctx.showConfirm = (msg, yes, no) => { (confirmAnswers.shift() === 'yes' ? yes : no || (() => {}))(); };
    ctx.console = { log() {}, warn() {}, info() {}, error: (...a) => ctx.errors.push(a.map(String).join(' ')) };
    ctx.saveGameState = () => ctx.localStorage.setItem('zabangState', JSON.stringify(ctx.gameState));
    ctx.loadGameState = () => { const s = ctx.localStorage.getItem('zabangState'); if (s) ctx.gameState = JSON.parse(s); };
    vm.createContext(ctx);
    for (const f of ['cloudsave.js', 'xp-engine.js', 'xp-state.js', 'xp-game.js']) {
        vm.runInContext(fs.readFileSync(path.join(REPO, f), 'utf8'), ctx, { filename: f });
    }
    vm.runInContext(`globalThis.__v12 = { pushCloudSave, resolveCloudSaveAfterSignIn, cloudCreateAccount, cloudSignIn, cloudDeleteAccount, collectCloudState };`, ctx);
    ctx.loadGameState();
    // a tower game over worth exactly `xp` (min(40, 10 + words) + 10 per clear)
    const earn = (xp) => ctx.ZbangXPGame.grant({ mode: 'tower', completed: true, wordsFound: 30, clears: (xp - 40) / 10 },
        'tower:' + label + ':' + (++earnSeq), nextTime());
    return { app, ctx, api: ctx.__v12, earn, get gs() { return ctx.gameState; } };
}
let earnSeq = 0;

module.exports = {
    firebase, XP, XPCloud, REPO, BUILD_4, newDevice, deviceV11, DeviceV12, deviceV12Real,
    owner, useRules, resetEmulator, disposeDevices, authUserExists, waitFor, nextTime
};
