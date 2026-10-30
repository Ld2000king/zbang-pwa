// Shared test sandbox (not a test file itself): the real game.js with
// avatars/icons/board files, words, tower.js and multiplayer.js, loaded into a
// vm with a tiny stand-in DOM and a fake clock. Used by game-help.test.js and
// daily-bonus.test.js.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const FILES = ['avatars.js', 'icons.js', 'board-path.js', 'board-words.js', 'board-hint.js', 'game.js',
    'words.js', 'words-bulk.js', 'words-bulk-2.js', 'words-bulk-3.js', 'words-bulk-4.js', 'tower.js', 'multiplayer.js']
    .map(f => [f, read(f)]);
const INDEX_HTML = read('index.html');

function makeEl(id) {
    const cls = new Set();
    return {
        id: id || '', style: {}, dataset: {}, children: [], textContent: '', innerHTML: '', value: '',
        classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
        setAttribute() {}, removeAttribute() {}, addEventListener() {}, focus() {}, remove() {},
        appendChild(c) { this.children.push(c); return c; },
        querySelector: () => null, querySelectorAll: () => [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 300 })
    };
}

// A sandboxed game with a fake clock: advance(ms) runs every timer that falls
// due, in time order, moving Date.now() along with it.
function startSandbox() {
    const clock = { now: 1000000 };
    const timers = new Map();
    let nextId = 1;
    const add = (fn, ms, every) => { const id = nextId++; timers.set(id, { fn, at: clock.now + Math.max(0, ms || 0), every }); return id; };
    const clear = id => timers.delete(id);
    class FakeDate extends Date {
        constructor(...a) { super(...(a.length ? a : [clock.now])); }
        static now() { return clock.now; }
    }
    const byId = new Map();
    const storage = new Map();
    const document = {
        body: makeEl('body'),
        getElementById(id) { if (!byId.has(id)) byId.set(id, makeEl(id)); return byId.get(id); },
        createElement: () => makeEl(),
        querySelector: () => null, querySelectorAll: () => [],
        addEventListener() {}, visibilityState: 'visible'
    };
    const ctx = {
        console: { log() {}, info() {}, warn() {}, error() {} },
        Math, JSON, Set, Map, Array, Object, String, Number, RegExp, Error, Promise, parseInt, parseFloat, isNaN,
        Date: FakeDate,
        setTimeout: (fn, ms) => add(fn, ms, 0), clearTimeout: clear,
        setInterval: (fn, ms) => add(fn, ms, ms), clearInterval: clear,
        localStorage: { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
        navigator: { userAgent: 'node' }, location: { search: '', hostname: 'localhost' },
        addEventListener() {}, scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
        requestAnimationFrame: fn => add(fn, 16, 0),
        document
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    for (const [f, src] of FILES) vm.runInContext(src, ctx, { filename: f });
    const run = code => vm.runInContext(code, ctx);
    run('mergeExtraWords(); applyRemovedWords();');
    // UI / sound / saving parts not under test
    run(`updateHomeUI = () => {}; syncMusicToScreen = () => {}; applyBoardTheme = () => {}; showMessage = () => {};
         gameState.playerName = 'בודק'; gameState.modeHelpSeen = { single: true, battle: true, friends: true, random: true };`);
    function advance(ms) {
        const end = clock.now + ms;
        for (;;) {
            let next = null;
            for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
            if (!next) break;
            const [id, t] = next;
            clock.now = t.at;
            if (t.every) t.at += t.every; else timers.delete(id);
            t.fn();
        }
        clock.now = end;
    }
    const el = id => document.getElementById(id);
    const wallet = () => run(`JSON.stringify({ coins: gameState.coins, diamonds: gameState.diamonds, inventory: gameState.inventory,
                                xp: gameState.xp, totalScore: gameState.totalScore, gamesPlayed: gameState.gamesPlayed })`);
    const bots = () => run('JSON.stringify(battleState.players.map(b => [b.score, b.nextFindIn, b.eliminated]))');
    return { ctx, run, advance, el, wallet, bots, storage, clock };
}

module.exports = { startSandbox, read, INDEX_HTML };
