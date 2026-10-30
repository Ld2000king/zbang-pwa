// Tests for the 1.2 single-player hint. Run with:  node --test tests/
//   1. board-hint.js on its own (path check + the tap/charge controller)
//   2. the REAL game.js + board-path.js + board-words.js + board-hint.js and
//      the full dictionary, in a sandbox with a small stand-in DOM: hint ->
//      path on the board -> the player drags it -> only then score/found.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { isShowableHint, createHintController, DEFAULT_SHOW_MS } = require('../board-hint.js');
const { xpForRound } = require('../xp-engine.js');

const N = 5;
const at = (r, c) => r * N + c;
const FILL = 'ז';
function boardWith(placed) {
    const b = new Array(N * N).fill(FILL);
    for (const [i, ch] of Object.entries(placed)) b[i] = ch;
    return b;
}

// ---------------------------------------------------------------------------
// 1a. isShowableHint
// ---------------------------------------------------------------------------
test('isShowableHint accepts only a real, unfound word on touching tiles', () => {
    const dict = { 'דגל': 10, 'כלב': 10 };
    const board = boardWith({ [at(0, 0)]: 'ד', [at(0, 1)]: 'ג', [at(0, 2)]: 'ל' });
    const ok = { word: 'דגל', path: [at(0, 0), at(0, 1), at(0, 2)] };
    assert.equal(isShowableHint(ok, board, N, dict, new Set()), true);
    assert.equal(isShowableHint(ok, board, N, dict, new Set(['דגל'])), false, 'already found');
    assert.equal(isShowableHint({ word: 'דגל', path: [at(0, 0), at(0, 2), at(0, 1)] }, board, N, dict, new Set()), false, 'skips a tile');
    assert.equal(isShowableHint({ word: 'דגל', path: [at(0, 0), at(0, 1), at(0, 1)] }, board, N, dict, new Set()), false, 'tile twice');
    assert.equal(isShowableHint({ word: 'כלב', path: [at(0, 0), at(0, 1), at(0, 2)] }, board, N, dict, new Set()), false, 'letters spell another word');
    assert.equal(isShowableHint({ word: 'דג', path: [at(0, 0), at(0, 1)] }, board, N, dict, new Set()), false, 'too short');
    assert.equal(isShowableHint(ok, board, N, {}, new Set()), false, 'not in the dictionary');
    assert.equal(isShowableHint(null, board, N, dict, new Set()), false);
    // wrap-around: end of row 0 to start of row 1 is not touching
    const wrap = boardWith({ [at(0, 3)]: 'ד', [at(0, 4)]: 'ג', [at(1, 0)]: 'ל' });
    assert.equal(isShowableHint({ word: 'דגל', path: [at(0, 3), at(0, 4), at(1, 0)] }, wrap, N, dict, new Set()), false, 'edge wrap');
    // final letters are compared normalized, like the board and endDrag
    const fin = boardWith({ [at(0, 0)]: 'ש', [at(0, 1)]: 'ל', [at(0, 2)]: 'ו', [at(0, 3)]: 'ם' });
    const norm = s => s.replace(/ם/g, 'מ');
    assert.equal(isShowableHint({ word: 'שלומ', path: [0, 1, 2, 3] }, fin, N, { 'שלומ': 5 }, new Set(), norm), true);
});

// ---------------------------------------------------------------------------
// 1b. the controller, with fake game parts
// ---------------------------------------------------------------------------
function fakeGame(overrides = {}) {
    const g = {
        playable: true, funds: true, paid: 0, shown: [], cleared: 0, exhausted: 0, timers: new Map(), nextId: 1,
        hints: [{ word: 'דגל', path: [0, 1, 2] }], showable: () => true
    };
    Object.assign(g, overrides);
    g.ctl = createHintController({
        isPlayable: () => g.playable,
        canPay: () => g.funds,
        pay: () => { g.paid++; },
        findHint: () => (g.hints.length ? g.hints[0] : null),
        isShowable: h => g.showable(h),
        onExhausted: () => { g.exhausted++; if (g.afterShuffle) g.hints = g.afterShuffle; },
        show: p => g.shown.push(p.slice()),
        clear: () => { g.cleared++; },
        setTimer: (fn, ms) => { const id = g.nextId++; g.timers.set(id, { fn, ms }); return id; },
        clearTimer: id => g.timers.delete(id)
    });
    g.fireTimers = () => { const all = [...g.timers.values()]; g.timers.clear(); all.forEach(t => t.fn()); };
    return g;
}

test('controller: shows the path, charges once, fast taps are not charged again', () => {
    const g = fakeGame();
    assert.equal(g.ctl.request(), 'shown');
    assert.equal(g.ctl.request(), 'busy');
    assert.equal(g.ctl.request(), 'busy');
    assert.equal(g.paid, 1);
    assert.deepEqual(g.shown, [[0, 1, 2]]);
    assert.equal([...g.timers.values()][0].ms, DEFAULT_SHOW_MS);
    g.fireTimers(); // the path goes away after a few seconds
    assert.equal(g.cleared, 1);
    assert.equal(g.ctl.current(), null);
    assert.equal(g.ctl.request(), 'shown'); // a new, separate hint is a new charge
    assert.equal(g.paid, 2);
});

test('controller: no word -> board shuffle tried, then nothing shown and nothing charged', () => {
    const g = fakeGame({ hints: [] });
    assert.equal(g.ctl.request(), 'none');
    assert.equal(g.exhausted, 1);
    assert.equal(g.paid, 0);
    assert.deepEqual(g.shown, []);
    const g2 = fakeGame({ hints: [], afterShuffle: [{ word: 'כלב', path: [3, 4, 9] }] });
    assert.equal(g2.ctl.request(), 'shown');
    assert.equal(g2.paid, 1);
});

test('controller: a path that fails the final check is never shown or charged', () => {
    const g = fakeGame({ showable: () => false });
    assert.equal(g.ctl.request(), 'none');
    assert.equal(g.paid, 0);
    assert.deepEqual(g.shown, []);
});

test('controller: no funds / game not running -> nothing happens', () => {
    const g = fakeGame({ funds: false });
    assert.equal(g.ctl.request(), 'no-funds');
    const g2 = fakeGame({ playable: false });
    assert.equal(g2.ctl.request(), 'inactive');
    assert.equal(g.paid + g2.paid, 0);
    assert.equal(g.shown.length + g2.shown.length, 0);
});

test('controller: dragging the hinted word ends the hint; another word does not', () => {
    const g = fakeGame();
    g.ctl.request();
    g.ctl.wordFound('כלב');
    assert.notEqual(g.ctl.current(), null);
    g.ctl.wordFound('דגל');
    assert.equal(g.ctl.current(), null);
    assert.equal(g.cleared, 1);
    assert.equal(g.timers.size, 0, 'timer cancelled');
    g.ctl.cancel(); // cancel with nothing active is harmless
    assert.equal(g.cleared, 1);
});

// ---------------------------------------------------------------------------
// 2. the real game.js in a sandbox
// ---------------------------------------------------------------------------
const ROOT = path.join(__dirname, '..');
const GAME_FILES = ['board-path.js', 'board-words.js', 'board-hint.js', 'game.js',
    'words.js', 'words-bulk.js', 'words-bulk-2.js', 'words-bulk-3.js', 'words-bulk-4.js']
    .map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);

// --- a very small DOM: enough for renderBoard, the hint drawing, messages ---
class El {
    constructor(tag) {
        this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.id = '';
        this.dataset = {}; this._cls = new Set(); this._text = ''; this._props = new Map();
        const self = this;
        this.classList = {
            add: (...c) => c.forEach(x => self._cls.add(x)),
            remove: (...c) => c.forEach(x => self._cls.delete(x)),
            contains: c => self._cls.has(c),
            toggle: (c, on) => { const v = on === undefined ? !self._cls.has(c) : !!on; v ? self._cls.add(c) : self._cls.delete(c); return v; }
        };
        this.style = {
            setProperty: (k, v) => self._props.set(k, String(v)),
            removeProperty: k => self._props.delete(k),
            getPropertyValue: k => self._props.get(k) || ''
        };
    }
    get textContent() { return this._text; }
    set textContent(v) { this._text = String(v); } // the real DOM stores text
    get className() { return [...this._cls].join(' '); }
    set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
    set innerHTML(v) { if (v === '') { this.children.forEach(c => { c.parent = null; }); this.children = []; } this._html = v; }
    get innerHTML() { return this._html || ''; }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300 }; }
    setAttribute() {} removeAttribute() {} addEventListener() {}
}
function allUnder(el) { const out = []; (function walk(e) { e.children.forEach(c => { out.push(c); walk(c); }); })(el); return out; }
// compound selector: #id, .class, [data-x="v"] in any mix
function matches(el, part) {
    for (const m of part.match(/#[\w-]+|\.[\w-]+|\[[^\]]+\]/g) || []) {
        if (m[0] === '#' && el.id !== m.slice(1)) return false;
        if (m[0] === '.' && !el._cls.has(m.slice(1))) return false;
        if (m[0] === '[') {
            const [, k, v] = m.match(/^\[data-([\w-]+)="([^"]*)"\]$/);
            const key = k.replace(/-(\w)/g, (_, ch) => ch.toUpperCase());
            if (String(el.dataset[key]) !== v) return false;
        }
    }
    return true;
}
function makeDocument() {
    const body = new El('body');
    const byId = new Map();
    const doc = {
        body,
        createElement: tag => new El(tag),
        getElementById(id) {
            if (!byId.has(id)) { const e = new El('div'); e.id = id; body.appendChild(e); byId.set(id, e); }
            return byId.get(id);
        },
        querySelectorAll(sel) {
            if (sel.includes(',')) { // a selector list: the union, like the real DOM
                const all = [];
                sel.split(',').forEach(one => this.querySelectorAll(one).forEach(e => { if (!all.includes(e)) all.push(e); }));
                return all;
            }
            const parts = sel.trim().split(/\s+/);
            let scope = [body];
            parts.forEach((part, i) => {
                const next = [];
                scope.forEach(s => allUnder(s).forEach(e => { if (matches(e, part) && !next.includes(e)) next.push(e); }));
                scope = next;
                if (i === parts.length - 1) scope = next;
            });
            return scope;
        },
        querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
        addEventListener() {}
    };
    return doc;
}

function startGame() {
    const timers = new Map();
    let nextTimer = 1;
    const storage = new Map();
    const ctx = {
        console: { log() {}, info() {}, warn() {}, error() {} },
        Math, JSON, Date, Set, Map, Array, Object, String, Number, RegExp, Error, Promise, parseInt,
        setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
        clearTimeout: id => timers.delete(id),
        setInterval: () => 0, clearInterval() {},
        localStorage: { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
        navigator: { userAgent: 'node' }, location: { search: '', hostname: 'localhost' },
        addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
        document: makeDocument()
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    for (const [f, src] of GAME_FILES) vm.runInContext(src, ctx, { filename: f });
    const run = code => vm.runInContext(code, ctx);
    run('mergeExtraWords(); applyRemovedWords();');
    // UI/sound parts not under test
    run(`updateHomeUI = () => {}; playWordSound = () => 1; playMissSound = () => {}; playDupeSound = () => {};
         playLetterTick = () => {}; launchSparkles = () => {};`);
    const g = {
        ctx, run, timers, storage,
        messages: () => allUnder(ctx.document.body).filter(e => e._cls.has('board-msg') || e._cls.has('message')).map(e => e.textContent),
        // runs every pending timer whose delay is <= ms (one pass)
        advance(ms) { [...timers].forEach(([id, t]) => { if (t.ms <= ms) { timers.delete(id); t.fn(); } }); },
        setBoard(board) {
            run(`currentGame.mode = 'single'; currentGame.gridSize = 5; currentGame.foundWords.clear();
                 currentGame.score = 0; currentGame.gameActive = true; currentGame.paused = false;`);
            ctx.__board = board;
            run(`currentGame.board = __board.slice(); renderBoard('board');`);
        },
        // keeps only these words in the live dictionary (to control what's on a board)
        onlyWords(words) {
            ctx.__words = words;
            run(`Object.keys(HEBREW_DICTIONARY).forEach(k => delete HEBREW_DICTIONARY[k]);
                 __words.forEach(w => { HEBREW_DICTIONARY[w] = 10; }); invalidateDictionaryCache();`);
        },
        wallet(coins, hints) { ctx.__w = [coins, hints]; run('gameState.coins = __w[0]; gameState.inventory.hint = __w[1];'); },
        // copied out through JSON: arrays from the sandbox are another realm's arrays
        state: () => JSON.parse(run(`JSON.stringify({ coins: gameState.coins, hints: gameState.inventory.hint, score: currentGame.score,
                            found: [...currentGame.foundWords], shown: document.getElementById('scoreDisplay').textContent,
                            board: currentGame.board.slice() })`)),
        // a bots battle round on #battleBoard, with 4 bots that have scores
        setBattle(board) {
            run(`currentGame.mode = 'battle'; currentGame.gridSize = 5; currentGame.foundWords.clear();
                 currentGame.playerScore = 0; currentGame.score = 0; currentGame.gameActive = true; currentGame.paused = false;
                 battleState.players = ['א', 'ב', 'ג', 'ד'].map((name, i) => ({ name, score: 100 * (i + 1), eliminated: false }));
                 battleState.boardWords = [{ word: 'בוט', points: 10 }]; battleState.botsFrozenSeconds = 0;`);
            ctx.__board = board;
            run(`currentGame.board = __board.slice(); renderBoard('battleBoard');`);
        },
        battle: () => JSON.parse(run(`JSON.stringify({ coins: gameState.coins, hints: gameState.inventory.hint,
                            playerScore: currentGame.playerScore, shown: document.getElementById('playerBattleScore').textContent,
                            found: [...currentGame.foundWords], bots: battleState.players.map(b => b.score),
                            pool: battleState.boardWords, frozen: battleState.botsFrozenSeconds })`)),
        tapBattle: () => run('useBattleHint()'),
        hintTiles(boardId = 'board') {
            return ctx.document.querySelectorAll(`#${boardId} .letter-tile.hint-path`)
                .map(e => ({ idx: Number(e.dataset.index), step: Number(e.dataset.hintStep), cssStep: e.style.getPropertyValue('--hint-step') }))
                .sort((a, b) => a.step - b.step);
        },
        drag(p) { ctx.__p = p; run('dragPath = __p.slice(); isDragging = true; endDrag();'); },
        tap: () => run('useHint()')
    };
    return g;
}

function expectHint(g, word, expectedPath) {
    g.tap();
    const tiles = g.hintTiles();
    assert.deepEqual(tiles.map(t => t.idx), expectedPath, word + ': path in letter order');
    assert.deepEqual(tiles.map(t => t.step), expectedPath.map((_, i) => i + 1), 'badges 1..n');
    assert.deepEqual(tiles.map(t => t.cssStep), expectedPath.map((_, i) => String(i)), 'pulse order');
    const s = g.state();
    assert.equal(s.score, 0, 'hint gives no score');
    assert.deepEqual(s.found, [], 'hint does not mark the word found');
    return s;
}

test('game: horizontal, vertical, diagonal and zigzag words are shown with their exact path', () => {
    const cases = [
        ['דגל', { [at(2, 1)]: 'ד', [at(2, 2)]: 'ג', [at(2, 3)]: 'ל' }, [at(2, 1), at(2, 2), at(2, 3)]],
        ['ילד', { [at(0, 4)]: 'י', [at(1, 4)]: 'ל', [at(2, 4)]: 'ד' }, [at(0, 4), at(1, 4), at(2, 4)]],
        ['כלב', { [at(0, 4)]: 'כ', [at(1, 3)]: 'ל', [at(2, 2)]: 'ב' }, [at(0, 4), at(1, 3), at(2, 2)]],
        ['שלומ', { [at(3, 0)]: 'ש', [at(4, 1)]: 'ל', [at(3, 2)]: 'ו', [at(4, 3)]: 'מ' }, [at(3, 0), at(4, 1), at(3, 2), at(4, 3)]]
    ];
    for (const [word, placed, p] of cases) {
        const g = startGame();
        g.onlyWords([word]);
        g.wallet(1000, 0);
        g.setBoard(boardWith(placed));
        expectHint(g, word, p);
    }
});

test('game: the hint takes no score or XP; only the real drag scores, and then XP counts it', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(1000, 0);
    g.setBoard(boardWith({ [at(2, 1)]: 'ד', [at(2, 2)]: 'ג', [at(2, 3)]: 'ל' }));
    const s = expectHint(g, 'דגל', [at(2, 1), at(2, 2), at(2, 3)]);
    assert.equal(s.coins, 925, 'paid with coins (hint price 75)');
    assert.equal(s.shown, '', 'score display untouched');
    const words = () => g.run('currentGame.foundWords.size');
    assert.equal(xpForRound({ mode: 'single', singleMode: 'quick', completed: true, wordsFound: words() }), 0, 'no XP from the hint alone');

    g.drag([at(2, 1), at(2, 2), at(2, 3)]);
    const after = g.state();
    assert.equal(after.score, 10);
    assert.deepEqual(after.found, ['דגל']);
    assert.equal(after.shown, '10');
    assert.deepEqual(g.hintTiles(), [], 'path removed once dragged');
    assert.ok(xpForRound({ mode: 'single', singleMode: 'quick', completed: true, wordsFound: words() }) > 0, 'XP once dragged');
    g.tap();
    assert.equal(g.state().coins, 925, 'board now has no word: nothing shown, nothing charged');
    assert.ok(g.messages().includes('אין מילה להצגה כרגע'));
});

test('game: a wrong or partial drag after the hint scores nothing', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(1000, 0);
    g.setBoard(boardWith({ [at(2, 1)]: 'ד', [at(2, 2)]: 'ג', [at(2, 3)]: 'ל' }));
    g.tap();
    g.drag([at(2, 1), at(2, 2)]);                 // too short
    g.drag([at(2, 1), at(2, 3), at(2, 2)]);       // skips a tile
    assert.equal(g.state().score, 0);
    assert.deepEqual(g.state().found, []);
    assert.equal(g.hintTiles().length, 3, 'hint still on the board');
});

test('game: another word can be dragged normally while the hint is shown', () => {
    const g = startGame();
    g.onlyWords(['דגל', 'כלבי']);
    g.wallet(1000, 0);
    g.setBoard(boardWith({ [at(0, 0)]: 'ד', [at(0, 1)]: 'ג', [at(0, 2)]: 'ל', [at(3, 0)]: 'כ', [at(3, 1)]: 'ל', [at(3, 2)]: 'ב', [at(3, 3)]: 'י' }));
    g.tap();
    assert.deepEqual(g.hintTiles().map(t => t.idx), [0, 1, 2], 'shortest word first');
    g.drag([at(3, 0), at(3, 1), at(3, 2), at(3, 3)]);
    assert.deepEqual(g.state().found, ['כלבי']);
    assert.equal(g.hintTiles().length, 3, 'other word: hint stays');
});

test('game: a word already found is never chosen', () => {
    const g = startGame();
    g.onlyWords(['דגל', 'ילד']);
    g.wallet(20 * 75, 0); // 20 hints at 75
    g.setBoard(boardWith({ [at(0, 0)]: 'ד', [at(0, 1)]: 'ג', [at(0, 2)]: 'ל', [at(2, 4)]: 'י', [at(3, 4)]: 'ל', [at(4, 4)]: 'ד' }));
    g.drag([0, 1, 2]);
    for (let i = 0; i < 20; i++) {
        g.tap();
        assert.deepEqual(g.hintTiles().map(t => t.idx), [at(2, 4), at(3, 4), at(4, 4)]);
        g.advance(DEFAULT_SHOW_MS);
    }
});

test('game: board with no word - nothing shown, nothing charged (coins and inventory)', () => {
    const g = startGame();
    // the auto-shuffle is switched off (before the hint is first used - the
    // hint keeps that function): its random mix sometimes puts ד ג ל side by
    // side below, and then a hint is (correctly) shown
    g.run('autoShuffleIfExhausted = () => {};');
    g.onlyWords(['דגל']);
    g.wallet(1000, 2);
    g.setBoard(new Array(25).fill(FILL));
    g.tap();
    g.tap();
    const s = g.state();
    assert.equal(s.coins, 1000);
    assert.equal(s.hints, 2);
    assert.deepEqual(g.hintTiles(), []);
    // letters only across the board edge (wrap) are not a word either
    g.setBoard(boardWith({ [at(0, 3)]: 'ד', [at(0, 4)]: 'ג', [at(1, 0)]: 'ל' }));
    g.tap();
    assert.equal(g.state().coins, 1000);
    assert.deepEqual(g.hintTiles(), []);
});

test('game: fast taps charge once (inventory first, then coins)', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(1000, 1);
    g.setBoard(boardWith({ [at(2, 1)]: 'ד', [at(2, 2)]: 'ג', [at(2, 3)]: 'ל' }));
    for (let i = 0; i < 6; i++) g.tap();
    let s = g.state();
    assert.equal(s.hints, 0, 'one hint from the inventory');
    assert.equal(s.coins, 1000, 'no coins taken');
    assert.equal(g.messages().filter(m => m.startsWith('רמז:')).length, 1, 'one hint message, nothing stacked');
    g.advance(DEFAULT_SHOW_MS);
    assert.deepEqual(g.hintTiles(), [], 'path disappears after the timeout');
    g.tap(); g.tap();
    s = g.state();
    assert.equal(s.coins, 925, 'next hint from coins, once');
});

test('game: no funds, paused, ended or other modes - no hint, no charge', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.setBoard(boardWith({ [at(2, 1)]: 'ד', [at(2, 2)]: 'ג', [at(2, 3)]: 'ל' }));
    g.wallet(10, 0);
    g.tap();
    assert.equal(g.state().coins, 10);
    assert.deepEqual(g.hintTiles(), []);
    g.wallet(1000, 0);
    for (const setup of ['currentGame.paused = true; currentGame.gameActive = false;',
        'currentGame.gameActive = false;', "currentGame.mode = 'battle';", "currentGame.mode = 'tower';", "currentGame.mode = 'multiplayer';"]) {
        g.setBoard(boardWith({ [at(2, 1)]: 'ד', [at(2, 2)]: 'ג', [at(2, 3)]: 'ל' }));
        g.run(setup);
        g.tap();
        assert.equal(g.state().coins, 1000, setup);
        assert.deepEqual(g.hintTiles(), [], setup);
    }
});

test('game: a redrawn board (shuffle) drops the old path and frees the button', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(1000, 0);
    g.setBoard(boardWith({ [at(2, 1)]: 'ד', [at(2, 2)]: 'ג', [at(2, 3)]: 'ל' }));
    g.tap();
    g.run("renderBoard('board');");
    assert.deepEqual(g.hintTiles(), []);
    assert.equal(g.run('singleHint.current()'), null);
    g.tap();
    assert.equal(g.state().coins, 850, 'a new hint can be taken');
});

test('game: 300 random real boards with the full dictionary - every hint is valid and draggable', () => {
    const g = startGame();
    const { isValidBoardPath } = require('../board-path.js');
    assert.ok(g.run('Object.keys(HEBREW_DICTIONARY).length') > 40000, 'full dictionary loaded');
    g.wallet(1e9, 0);
    let shown = 0, none = 0;
    for (let i = 0; i < 300; i++) {
        g.run(`currentGame.mode = 'single'; currentGame.gridSize = 5; currentGame.foundWords.clear(); currentGame.score = 0;
               currentGame.gameActive = true; currentGame.paused = false; currentGame.board = generateBoard(); renderBoard('board');`);
        for (let k = 0; k < 3; k++) { // a few hints in a row, dragging each one
            const before = g.state();
            g.tap();
            const p = g.hintTiles().map(t => t.idx);
            if (!p.length) { none++; assert.equal(g.state().coins, before.coins, 'no word: no charge'); break; }
            shown++;
            const s = g.state();
            g.ctx.__hp = p;
            const spelled = g.run('normalizeFinals(__hp.map(i => currentGame.board[i]).join(""))');
            assert.ok(isValidBoardPath(p, 5), 'touching tiles');
            assert.ok(g.run(`HEBREW_DICTIONARY[${JSON.stringify(spelled)}] !== undefined`), spelled + ' is a word');
            assert.ok(!before.found.includes(spelled), 'not found before');
            assert.equal(s.score, before.score, 'no score from the hint');
            assert.equal(s.found.length, before.found.length, 'nothing marked found');
            g.drag(p);
            assert.ok(g.state().found.includes(spelled), 'the shown path drags as that word');
            assert.deepEqual(g.hintTiles(), []);
        }
    }
    assert.ok(shown > 300, `hints shown: ${shown}, empty: ${none}`);
});

// ---------------------------------------------------------------------------
// 3. bots battle (useBattleHint) - same hint, on the battle board
// ---------------------------------------------------------------------------
const DGL = () => boardWith({ [at(1, 0)]: 'ד', [at(2, 1)]: 'ג', [at(1, 2)]: 'ל' }); // zigzag: down-left, up-left

test('bots: the hint shows the path on the battle board; no score, no found word, bots untouched', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(1000, 0);
    g.setBattle(DGL());
    const before = g.battle();
    for (let i = 0; i < 5; i++) g.tapBattle(); // fast taps
    const tiles = g.hintTiles('battleBoard');
    assert.deepEqual(tiles.map(t => t.idx), [at(1, 0), at(2, 1), at(1, 2)], 'path in letter order');
    assert.deepEqual(tiles.map(t => t.step), [1, 2, 3]);
    assert.deepEqual(g.hintTiles('board'), [], 'nothing drawn on the single-player board');
    const s = g.battle();
    assert.equal(s.coins, 925, 'one charge of the hint price (75)');
    assert.equal(s.playerScore, 0);
    assert.deepEqual(s.found, []);
    assert.deepEqual(s.bots, before.bots, 'bot scores unchanged');
    assert.deepEqual(s.pool, before.pool, 'bot word pool unchanged');
    assert.equal(s.frozen, 0, 'bots not frozen');
    assert.equal(xpForRound({ mode: 'battle', completed: true, wordsFound: s.found.length, survived: false }), 0, 'no XP from the hint');
});

test('bots: dragging the hinted word scores for the player and counts for XP', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(1000, 0);
    g.setBattle(DGL());
    g.tapBattle();
    g.drag([at(1, 0), at(2, 1), at(1, 2)]);
    const s = g.battle();
    assert.equal(s.playerScore, 10);
    assert.equal(s.shown, '10');
    assert.deepEqual(s.found, ['דגל']);
    assert.deepEqual(g.hintTiles('battleBoard'), [], 'path removed once dragged');
    assert.deepEqual(s.bots, [100, 200, 300, 400], 'bots unchanged');
    assert.ok(xpForRound({ mode: 'battle', completed: true, wordsFound: 1, survived: false }) > 0);
});

test('bots: inventory before coins, one hint per tap while shown', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(1000, 1);
    g.setBattle(DGL());
    g.tapBattle(); g.tapBattle();
    assert.equal(g.battle().hints, 0);
    assert.equal(g.battle().coins, 1000);
    g.advance(DEFAULT_SHOW_MS);
    assert.deepEqual(g.hintTiles('battleBoard'), []);
    g.tapBattle(); g.tapBattle();
    assert.equal(g.battle().coins, 925, 'then coins, once');
});

test('bots: no word, paused, round over, no funds, wrong mode - no hint and no charge', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(1000, 2);
    g.setBattle(new Array(25).fill(FILL));
    g.tapBattle();
    assert.deepEqual([g.battle().coins, g.battle().hints], [1000, 2], 'no word');
    assert.ok(g.messages().includes('אין מילה להצגה כרגע'));
    for (const setup of ['currentGame.paused = true; currentGame.gameActive = false;', 'currentGame.gameActive = false;']) {
        g.setBattle(DGL());
        g.run(setup);
        g.tapBattle();
        assert.deepEqual([g.battle().coins, g.battle().hints], [1000, 2], setup);
        assert.deepEqual(g.hintTiles('battleBoard'), [], setup);
    }
    g.setBattle(DGL());
    g.wallet(10, 0);
    g.tapBattle();
    assert.equal(g.battle().coins, 10, 'no funds');
    g.wallet(1000, 0);
    g.tap(); // the single-player button in a bots game
    assert.equal(g.battle().coins, 1000);
    g.setBoard(DGL()); // single game
    g.tapBattle();     // the bots button in a single game
    assert.equal(g.state().coins, 1000);
    assert.deepEqual(g.hintTiles('board'), []);
    g.run("currentGame.mode = 'multiplayer'; currentGame.gameActive = true;");
    g.tapBattle();
    assert.equal(g.state().coins, 1000, 'multiplayer untouched by this hint');
});

test('bots: a new round (board redrawn) drops the old path', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(1000, 0);
    g.setBattle(DGL());
    g.tapBattle();
    g.run("renderBoard('battleBoard');");
    assert.deepEqual(g.hintTiles('battleBoard'), []);
    assert.equal(g.run('singleHint.current()'), null);
});

test('bots: 150 random real battle boards - every hint is valid, draggable and leaves the bots alone', () => {
    const g = startGame();
    const { isValidBoardPath } = require('../board-path.js');
    g.wallet(1e9, 0);
    let shown = 0;
    for (let i = 0; i < 150; i++) {
        g.setBattle(g.run('generateBoard()'));
        const bots = g.battle().bots;
        g.tapBattle();
        const p = g.hintTiles('battleBoard').map(t => t.idx);
        if (!p.length) continue;
        shown++;
        g.ctx.__hp = p;
        const word = g.run('normalizeFinals(__hp.map(i => currentGame.board[i]).join(""))');
        assert.ok(isValidBoardPath(p, 5));
        assert.ok(g.run(`HEBREW_DICTIONARY[${JSON.stringify(word)}] !== undefined`));
        assert.equal(g.battle().playerScore, 0);
        g.drag(p);
        const s = g.battle();
        assert.ok(s.found.includes(word));
        assert.equal(s.playerScore, g.run(`HEBREW_DICTIONARY[${JSON.stringify(word)}]`));
        assert.deepEqual(s.bots, bots);
    }
    assert.ok(shown > 140, `shown ${shown}`);
});

// ---------------------------------------------------------------------------
// 3. hint prices (1.2): 75 in single / bots / multiplayer and in the shop,
//    50 in the tower, 20 for every other power-up. The hint stays one shared
//    inventory item, used before coins. tower.js and multiplayer.js are the
//    real files, loaded unchanged into the same sandbox.
// ---------------------------------------------------------------------------
const TOWER_SRC = fs.readFileSync(path.join(ROOT, 'tower.js'), 'utf8');
const MP_SRC = fs.readFileSync(path.join(ROOT, 'multiplayer.js'), 'utf8');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function startFullGame() {
    const g = startGame();
    vm.runInContext(TOWER_SRC, g.ctx, { filename: 'tower.js' });
    vm.runInContext(MP_SRC, g.ctx, { filename: 'multiplayer.js' });
    g.run('saveGameState = () => {};');
    return g;
}
const wallet = g => JSON.parse(g.run('JSON.stringify({ coins: gameState.coins, hints: gameState.inventory.hint })'));

test('prices: one place - hint 75, tower hint 50, every other power-up 20', () => {
    const g = startGame();
    assert.equal(g.run('HINT_COST'), 75);
    assert.equal(g.run('TOWER_HINT_COST'), 50);
    const shop = JSON.parse(g.run('JSON.stringify(SHOP_ITEMS.map(i => [i.key, i.cost]))'));
    assert.deepEqual(shop, [['hint', 75], ['shuffle', 20], ['freeze', 20], ['freezeOpponents', 20], ['tornado', 20]]);
    const cost = (mode, key) => g.run(`currentGame.mode = '${mode}'; itemUseCost('${key}')`);
    for (const mode of ['single', 'battle', 'multiplayer']) assert.equal(cost(mode, 'hint'), 75, mode);
    assert.equal(cost('tower', 'hint'), 50);
    for (const mode of ['single', 'battle', 'multiplayer', 'tower'])
        for (const key of ['shuffle', 'freeze', 'freezeOpponents', 'tornado']) assert.equal(cost(mode, key), 20, mode + ' ' + key);
});

test('prices: every in-game button label equals the price charged', () => {
    const g = startGame();
    const labels = [...INDEX_HTML.matchAll(/onclick="([\w]+)\(\)"[^>]*>(?:(?!<\/button>).)*?<span class="pu-cost">(\d+)<\/span>/gs)]
        .map(m => [m[1], Number(m[2])]);
    assert.deepEqual(labels, [
        ['useHint', g.run('HINT_COST')], ['useShuffle', 20], ['useFreeze', 20],
        ['handleBattleHint', g.run('HINT_COST')], ['useShuffle', 20], ['handleBattleFreeze', 20], ['useBattleShuffle', 20],
        ['useTowerHint', g.run('TOWER_HINT_COST')]
    ]);
    const shopCost = k => g.run(`getShopItem('${k}').cost`);
    assert.equal(shopCost('shuffle'), 20); assert.equal(shopCost('freeze'), 20);
    assert.equal(shopCost('freezeOpponents'), 20); assert.equal(shopCost('tornado'), 20);
});

test('prices: single - 74 coins is not enough (message says 75), 75 is charged exactly', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.setBoard(boardWith({ [at(2, 1)]: 'ד', [at(2, 2)]: 'ג', [at(2, 3)]: 'ל' }));
    g.wallet(74, 0);
    g.tap();
    assert.equal(g.state().coins, 74);
    assert.deepEqual(g.hintTiles(), []);
    assert.ok(g.messages().includes('אין מספיק מטבעות! (רמז עולה 75)'));
    g.wallet(75, 0);
    g.tap();
    assert.equal(g.state().coins, 0);
    assert.equal(g.hintTiles().length, 3);
});

test('prices: bots - 75 coins, inventory first', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(74, 0);
    g.setBattle(DGL());
    g.tapBattle();
    assert.equal(g.battle().coins, 74, 'not enough for 75');
    g.wallet(500, 2);
    g.tapBattle();
    assert.deepEqual([g.battle().coins, g.battle().hints], [500, 1], 'inventory, no coins');
});

function setTower(g, foundPath) {
    g.run(`currentGame.mode = 'tower'; currentGame.gameActive = true; tower.busy = false;`);
    g.ctx.__tp = foundPath;
    g.run('towerFindWord = () => __tp; towerTileEl = () => null; showBoardMessage = () => {};');
}

test('prices: tower (real tower.js) - 50 coins, inventory first, no charge without a word', () => {
    const g = startFullGame();
    setTower(g, [{ c: 0, r: 0 }, { c: 1, r: 0 }]);
    g.run('gameState.coins = 1000; gameState.inventory.hint = 0;');
    g.run('useTowerHint()');
    assert.deepEqual(wallet(g), { coins: 950, hints: 0 }, 'tower hint costs 50');
    g.run('gameState.coins = 50;'); g.run('useTowerHint()');
    assert.deepEqual(wallet(g), { coins: 0, hints: 0 }, '50 coins is enough in the tower');
    g.run('gameState.coins = 49;'); g.run('useTowerHint()');
    assert.deepEqual(wallet(g), { coins: 49, hints: 0 });
    assert.ok(g.messages().includes('אין מספיק מטבעות! (רמז עולה 50)'));
    g.run('gameState.coins = 1000; gameState.inventory.hint = 1;'); g.run('useTowerHint()');
    assert.deepEqual(wallet(g), { coins: 1000, hints: 0 }, 'inventory first');
    setTower(g, null);
    g.run('useTowerHint()');
    assert.deepEqual(wallet(g), { coins: 1000, hints: 0 }, 'no word -> no charge');
});

// ---------------------------------------------------------------------------
// 4. multiplayer hint (1.2): the same show-the-path hint, local to this device
//    (real multiplayer.js; `db` is a recorder, so every room write is seen)
// ---------------------------------------------------------------------------
function startMultiplayer(board, opts = {}) {
    const g = startFullGame();
    g.run('__writes = [];');
    // copied out through JSON: the array lives in the sandbox's realm
    Object.defineProperty(g, 'writes', { get: () => JSON.parse(g.run('JSON.stringify(__writes)')) });
    g.run(`db = { ref: path => ({
                set: v => { __writes.push([path, 'set', JSON.parse(JSON.stringify(v === undefined ? null : v))]); return Promise.resolve(); },
                update: v => { __writes.push([path, 'update', JSON.parse(JSON.stringify(v))]); return Promise.resolve(); },
                remove: () => { __writes.push([path, 'remove']); return Promise.resolve(); },
                transaction: () => { __writes.push([path, 'transaction']); return Promise.resolve({}); },
                onDisconnect: () => ({ cancel() {}, set() {}, remove() {}, update() {} }),
                off() {}, on() {}, once: () => Promise.resolve({ val: () => null })
            }) };`);
    g.onlyWords(opts.words || ['דגל']);
    g.setBattle(board);
    g.ctx.__mt = opts.matchType || 'friends';
    g.run(`currentGame.mode = 'multiplayer';
           MP.roomCode = 'ROOM1'; MP.playerId = 'me'; MP.matchType = __mt; MP.serverOffset = 0; MP.lastRound = 1;
           MP.room = { status: 'playing', matchType: __mt, hostId: 'me', currentRound: 1,
                       players: { me: { score: 0, connected: true }, other: { score: 0, connected: true } } };
           gameState.coins = 1000; gameState.inventory.hint = 0;`);
    g.tapMP = () => g.run('handleBattleHint()');
    g.mp = () => JSON.parse(g.run(`JSON.stringify({ coins: gameState.coins, hints: gameState.inventory.hint,
        playerScore: currentGame.playerScore, shown: document.getElementById('playerBattleScore').textContent,
        found: [...currentGame.foundWords], board: currentGame.board.slice() })`));
    return g;
}
const DGL_ROW = () => boardWith({ [at(2, 1)]: 'ד', [at(2, 2)]: 'ג', [at(2, 3)]: 'ל' });

for (const matchType of ['friends', 'random']) {
    test(`multiplayer (${matchType}): hint shows the path only - no score, no found word, no room write`, () => {
        const g = startMultiplayer(DGL_ROW(), { matchType });
        const before = g.mp();
        for (let i = 0; i < 6; i++) g.tapMP(); // fast taps
        const tiles = g.hintTiles('battleBoard');
        assert.deepEqual(tiles.map(t => t.idx), [at(2, 1), at(2, 2), at(2, 3)], 'path in letter order');
        assert.deepEqual(tiles.map(t => t.step), [1, 2, 3]);
        const s = g.mp();
        assert.equal(s.coins, 925, 'one charge of 75');
        assert.equal(s.playerScore, 0);
        assert.equal(s.shown, before.shown, 'score display untouched');
        assert.deepEqual(s.found, []);
        assert.deepEqual(s.board, before.board, 'board unchanged');
        assert.deepEqual(g.writes, [], 'nothing written to the room - the opponent sees nothing');
        assert.equal(xpForRound(matchType === 'random'
            ? { mode: 'random', completed: true, wordsFound: s.found.length, result: 'win' }
            : { mode: 'friends', completed: true, wordsFound: s.found.length, wonMatch: true }), 0, 'no XP from the hint, even on a win');
    });

    test(`multiplayer (${matchType}): dragging the hinted word scores and syncs like any word`, () => {
        const g = startMultiplayer(DGL_ROW(), { matchType });
        g.tapMP();
        g.drag([at(2, 1), at(2, 2), at(2, 3)]);
        const s = g.mp();
        assert.equal(s.playerScore, 10);
        assert.equal(s.shown, '10');
        assert.deepEqual(s.found, ['דגל']);
        assert.deepEqual(g.hintTiles('battleBoard'), [], 'path removed once dragged');
        assert.deepEqual(g.writes, [
            ['rooms/ROOM1/players/me/score', 'set', 10],
            ['rooms/ROOM1/players/me/foundWords/דגל', 'set', true]
        ], 'the normal word sync, once');
    });
}

test('multiplayer: inventory before coins; a new hint only after the path is gone', () => {
    const g = startMultiplayer(DGL_ROW());
    g.run('gameState.inventory.hint = 1;');
    g.tapMP(); g.tapMP();
    assert.deepEqual([g.mp().coins, g.mp().hints], [1000, 0], 'from the inventory, once');
    g.advance(DEFAULT_SHOW_MS);
    assert.deepEqual(g.hintTiles('battleBoard'), [], 'path gone after the timeout');
    g.tapMP(); g.tapMP();
    assert.deepEqual([g.mp().coins, g.mp().hints], [925, 0], 'then coins, once');
    g.run('gameState.coins = 74;');
    g.advance(DEFAULT_SHOW_MS);
    g.tapMP();
    assert.equal(g.mp().coins, 74, '74 coins is not enough');
    assert.deepEqual(g.hintTiles('battleBoard'), []);
});

test('multiplayer: no hint and no charge when the round is over, frozen, eliminated or no word', () => {
    const cases = [
        ['round over', 'currentGame.gameActive = false;'],
        // a guest's gameActive stays true on the round-end screen - the room status decides
        ['round-end screen (guest)', "MP.room.status = 'roundEnd';"],
        ['match finished', "MP.room.status = 'finished';"],
        ['next round not drawn here yet', 'MP.room.currentRound = 2;'],
        ['left the room', 'MP.roomCode = null;'],
        ['frozen by an opponent', 'MP.room.players.me.freezeUntil = Date.now() + 60000;'],
        ['eliminated', 'MP.room.players.me.eliminated = true;'],
        ['not in multiplayer', "currentGame.mode = 'battle';"]
    ];
    for (const [name, setup] of cases) {
        const g = startMultiplayer(DGL_ROW());
        g.run(setup);
        g.run("currentGame.mode === 'multiplayer' ? handleBattleHint() : useMultiplayerHint()");
        assert.deepEqual([g.mp().coins, g.mp().hints], [1000, 0], name);
        assert.deepEqual(g.hintTiles('battleBoard'), [], name);
        assert.deepEqual(g.writes, [], name);
    }
    // no word on the board: the normal auto-shuffle (local board only) is tried
    const g = startMultiplayer(new Array(25).fill(FILL));
    g.run('gameState.inventory.hint = 2;');
    g.tapMP();
    assert.deepEqual([g.mp().coins, g.mp().hints], [1000, 2], 'no word');
    assert.deepEqual(g.writes, [], 'the shuffle is local - nothing written');
});

test('multiplayer: the path is cleared at round end, on leaving and on a new round', () => {
    const g = startMultiplayer(DGL_ROW());
    g.tapMP();
    assert.equal(g.hintTiles('battleBoard').length, 3);
    g.run('stopMultiplayerTimer()'); // round end / finished / leave all go through here
    assert.deepEqual(g.hintTiles('battleBoard'), []);
    assert.equal(g.run('singleHint.current()'), null);

    g.run('gameState.coins = 1000;');
    g.tapMP();
    assert.equal(g.hintTiles('battleBoard').length, 3);
    g.run('leaveMultiplayerRoom()'); // home button / disconnect / abandoned match
    assert.deepEqual(g.hintTiles('battleBoard'), []);

    const g2 = startMultiplayer(DGL_ROW());
    g2.tapMP();
    g2.ctx.__room = { status: 'playing', matchType: 'friends', hostId: 'other', currentRound: 2, roundStartTime: Date.now(),
        board: DGL_ROW(), players: { me: { score: 0, connected: true }, other: { score: 0, connected: true } } };
    g2.run(`applyBoardTheme = () => {}; preferredThemeIndex = () => 0; showScreen = () => {}; startMultiplayerTimer = () => {};
            friendsMatchRounds = () => 2; displayedRound = () => 2; updateMultiplayerUI = () => {}; applyFreezeFromRoom = () => {};
            renderEliminatedOverlay = () => {}; watchFriendsDropouts = () => {}; onRoomUpdate(__room);`);
    assert.deepEqual(g2.hintTiles('battleBoard'), [], 'new round board: old path gone');
    assert.equal(g2.run('singleHint.current()'), null);
});

// ---------------------------------------------------------------------------
// 5. multiplayer: at most 2 hints per player per round (friends + random)
// ---------------------------------------------------------------------------
const LIMIT_MSG = 'ניצלת את 2 הרמזים של הסיבוב הזה';
const limitMsgs = g => g.messages().filter(m => m === LIMIT_MSG).length;

// the room listener delivers a new snapshot (new round / tie replay / same round again)
function roomSnapshot(g, room) {
    g.ctx.__room = Object.assign({ status: 'playing', matchType: 'friends', hostId: 'other', roundStartTime: Date.now(),
        board: DGL_ROW(), players: { me: { score: 0, connected: true }, other: { score: 0, connected: true } } }, room);
    g.run(`applyBoardTheme = () => {}; preferredThemeIndex = () => 0; showScreen = () => {}; startMultiplayerTimer = () => {};
           friendsMatchRounds = () => 3; updateMultiplayerUI = () => {}; applyFreezeFromRoom = () => {};
           renderEliminatedOverlay = () => {}; watchFriendsDropouts = () => {}; handleRandomWaitingRoom = () => {};
           friendsSeatLost = () => false; renderLobby = () => {};
           MP.room = __room; onRoomUpdate(__room);`);
}
// one hint, then let its path time out so the next tap is a new request
const hintAndWait = g => { g.tapMP(); const n = g.hintTiles('battleBoard').length; g.advance(DEFAULT_SHOW_MS); return n; };

for (const matchType of ['friends', 'random']) {
    test(`multiplayer limit (${matchType}): hints 1 and 2 work, the 3rd is blocked with no charge`, () => {
        const g = startMultiplayer(DGL_ROW(), { matchType });
        assert.equal(hintAndWait(g), 3, 'hint 1 shown');
        assert.equal(g.mp().coins, 925);
        assert.equal(hintAndWait(g), 3, 'hint 2 shown');
        assert.equal(g.mp().coins, 850);
        g.tapMP();
        assert.deepEqual(g.hintTiles('battleBoard'), [], 'hint 3 not shown');
        assert.deepEqual([g.mp().coins, g.mp().hints], [850, 0], 'hint 3 not charged');
        assert.equal(limitMsgs(g), 1, 'clear Hebrew message');
        for (let i = 0; i < 5; i++) g.tapMP();
        assert.equal(g.mp().coins, 850, 'more taps cost nothing');
        assert.equal(limitMsgs(g), 1, 'fast taps: one message, not a stack');
        const s = g.mp();
        assert.equal(s.playerScore, 0, 'no score from hints');
        assert.deepEqual(s.found, []);
        assert.deepEqual(g.writes, [], 'nothing written to the room');
        assert.equal(g.run('MP.hintsUsed'), 2);
    });
}

test('multiplayer limit: inventory first, then coins; a 3rd hint leaves both untouched', () => {
    const g = startMultiplayer(DGL_ROW());
    g.run('gameState.inventory.hint = 1;');
    hintAndWait(g);
    assert.deepEqual([g.mp().coins, g.mp().hints], [1000, 0], 'hint 1 from the inventory');
    hintAndWait(g);
    assert.deepEqual([g.mp().coins, g.mp().hints], [925, 0], 'hint 2 from coins');
    g.run('gameState.inventory.hint = 3;');
    g.tapMP();
    assert.deepEqual([g.mp().coins, g.mp().hints], [925, 3], 'hint 3: no item used, no coins taken');
});

test('multiplayer limit: fast taps can not get past 2', () => {
    const g = startMultiplayer(DGL_ROW());
    for (let round = 0; round < 4; round++) {
        for (let i = 0; i < 10; i++) g.tapMP();
        g.advance(DEFAULT_SHOW_MS);
    }
    assert.equal(g.mp().coins, 850, 'exactly 2 charges');
    assert.equal(g.run('MP.hintsUsed'), 2);
    // a tap while the 2nd path is still on the board is just ignored (no limit message on top of it)
    const g2 = startMultiplayer(DGL_ROW());
    hintAndWait(g2); g2.tapMP(); g2.tapMP(); g2.tapMP();
    assert.equal(g2.hintTiles('battleBoard').length, 3);
    assert.equal(limitMsgs(g2), 0);
    assert.equal(g2.mp().coins, 850);
});

test('multiplayer limit: a failed or blocked hint does not use the quota', () => {
    const g = startMultiplayer(DGL_ROW());
    const blocked = [
        "MP.room.status = 'roundEnd';",            // round not live
        'MP.room.players.me.freezeUntil = Date.now() + 60000;', // frozen
        'gameState.coins = 10;'                    // no funds
    ];
    const undo = ["MP.room.status = 'playing';", 'MP.room.players.me.freezeUntil = 0;', 'gameState.coins = 1000;'];
    blocked.forEach((b, i) => { g.run(b); g.tapMP(); g.run(undo[i]); });
    assert.equal(g.run('MP.hintsUsed'), 0, 'blocked taps did not count');
    assert.equal(g.mp().coins, 1000);
    // no word on the board
    const empty = startMultiplayer(new Array(25).fill(FILL));
    empty.tapMP(); empty.tapMP(); empty.tapMP();
    assert.equal(empty.run('MP.hintsUsed'), 0, 'no word: nothing counted');
    assert.equal(empty.mp().coins, 1000);
    assert.equal(limitMsgs(empty), 0);
    // the full 2 are still there
    assert.equal(hintAndWait(g), 3);
    assert.equal(hintAndWait(g), 3);
    assert.equal(g.mp().coins, 850);
});

test('multiplayer limit: round over / frozen / eliminated with the quota used - no message, no charge', () => {
    for (const setup of ["MP.room.status = 'roundEnd';", "MP.room.status = 'finished';",
        'MP.room.players.me.freezeUntil = Date.now() + 60000;', 'MP.room.players.me.eliminated = true;']) {
        const g = startMultiplayer(DGL_ROW());
        hintAndWait(g); hintAndWait(g);
        g.run(setup);
        g.tapMP();
        assert.equal(g.mp().coins, 850, setup);
        assert.equal(limitMsgs(g), 0, setup);
        assert.deepEqual(g.hintTiles('battleBoard'), [], setup);
    }
});

test('multiplayer limit: a new round, a tie replay and a rematch each give a fresh 2', () => {
    const g = startMultiplayer(DGL_ROW());
    hintAndWait(g); hintAndWait(g);
    g.tapMP();
    assert.equal(g.mp().coins, 850, 'round 1: used up');

    roomSnapshot(g, { currentRound: 2 }); // next round
    assert.equal(g.run('MP.hintsUsed'), 0);
    assert.equal(hintAndWait(g), 3); assert.equal(hintAndWait(g), 3);
    g.tapMP();
    assert.equal(g.mp().coins, 700, 'round 2: exactly 2 more');

    roomSnapshot(g, { currentRound: 3, replays: 1 }); // tie replay: same displayed round, currentRound moves on
    assert.equal(hintAndWait(g), 3); assert.equal(hintAndWait(g), 3);
    g.tapMP();
    assert.equal(g.mp().coins, 550, 'tie replay: a fresh 2');

    // friends rematch: back to the lobby (currentRound 0), then round 1 again in the same room
    roomSnapshot(g, { status: 'waiting', currentRound: 0, board: null });
    roomSnapshot(g, { currentRound: 1 });
    assert.equal(hintAndWait(g), 3); assert.equal(hintAndWait(g), 3);
    g.tapMP();
    assert.equal(g.mp().coins, 400, 'rematch round 1: a fresh 2');
});

test('multiplayer limit: a repeat snapshot of the same round (reconnect) does not reset it', () => {
    const g = startMultiplayer(DGL_ROW());
    hintAndWait(g); hintAndWait(g);
    // network blip: presence flips connected false -> true, the listener re-sends the same round
    roomSnapshot(g, { currentRound: 1, players: { me: { score: 0, connected: false }, other: { score: 0, connected: true } } });
    roomSnapshot(g, { currentRound: 1 });
    g.tapMP();
    assert.equal(g.run('MP.hintsUsed'), 2);
    assert.equal(g.mp().coins, 850, 'still blocked after reconnecting');
    assert.equal(limitMsgs(g), 1);
});

test('multiplayer limit: after a refresh the round can not be joined again', async () => {
    const g = startMultiplayer(DGL_ROW());
    // a refreshed page has a fresh MP (no room) - it can only try to join by code
    g.run(`MP.roomCode = null; MP.room = null; MP.lastRound = 0; MP.hintsUsed = 0; __writes = [];
           waitForAuth = () => Promise.resolve(); mpAvailable = () => true; getMyPlayerId = () => 'me'; __shown = [];
           showMessage = (m) => __shown.push(m);
           db.ref = path => ({ once: () => Promise.resolve({ exists: () => true,
               val: () => ({ status: 'playing', matchType: 'friends', currentRound: 1, players: {} }) }),
               set: v => { __writes.push([path, 'set']); return Promise.resolve(); } });`);
    const joined = await g.run("joinRoom('ROOM1')");
    assert.equal(joined, false);
    assert.deepEqual(g.writes, [], 'no join write');
    assert.equal(g.run('MP.roomCode'), null);
    assert.ok(JSON.parse(g.run('JSON.stringify(__shown)')).includes('המשחק כבר התחיל'));
});

test('multiplayer limit: single player and bots hints are not limited', () => {
    const g = startFullGame(); // multiplayer.js loaded too
    g.onlyWords(['דגל']);
    g.setBoard(DGL_ROW());
    g.run('gameState.coins = 1000; gameState.inventory.hint = 0;');
    for (let i = 0; i < 4; i++) { g.run('useHint()'); g.advance(DEFAULT_SHOW_MS); }
    assert.equal(g.run('gameState.coins'), 700, 'single: 4 hints, 4 charges');
    const b = startFullGame();
    b.onlyWords(['דגל']);
    b.setBattle(DGL_ROW());
    b.run("currentGame.mode = 'battle'; gameState.coins = 1000; gameState.inventory.hint = 0;");
    for (let i = 0; i < 4; i++) { b.run('useBattleHint()'); b.advance(DEFAULT_SHOW_MS); }
    assert.equal(b.run('gameState.coins'), 700, 'bots: 4 hints, 4 charges');
});

test('multiplayer: other power-ups still work the same (freeze opponents)', () => {
    const g = startMultiplayer(DGL_ROW());
    g.run('handleBattleFreeze()');
    const freezeWrites = g.writes.filter(w => w[0].startsWith('rooms/ROOM1'));
    assert.ok(freezeWrites.length > 0, 'the freeze is still written to the room');
    assert.equal(g.mp().coins, 980, 'freeze opponents still costs 20');
});

test('prices: the shop sells the shared hint at 75 and charges what it shows', () => {
    const g = startGame();
    g.run(`showConfirm = (text, ok) => { __confirm = text; ok(); }; renderShop = () => {}; updateCoinsDisplay = () => {};`);
    for (const mode of ['single', 'tower']) {
        g.run(`currentGame.mode = '${mode}'; gameState.coins = 1000; gameState.inventory.hint = 0; buyItem('hint');`);
        assert.equal(g.run('__confirm'), 'האם אתה בטוח? קניית רמז ב-75 מטבעות', mode);
        assert.deepEqual(wallet(g), { coins: 925, hints: 1 }, 'shop price is the same from any screen: ' + mode);
    }
    g.run(`gameState.coins = 1000; gameState.inventory.shuffle = 0; buyItem('shuffle');`);
    assert.equal(g.run('gameState.coins'), 980);
});

// ---------------------------------------------------------------------------
// 6. automatic shuffle (1.2): the "any word left?" check uses board-words.js
//    (8 directions, zigzag, no wrap, no tile twice) instead of straight
//    rows/columns only. Only the detection changed - when it shuffles, how it
//    shuffles and the manual shuffle are the same as before.
// ---------------------------------------------------------------------------
const SHUFFLED_MSG = 'נגמרו המילים — הלוח עורבב!';
const shuffledMsgs = g => g.messages().filter(m => m === SHUFFLED_MSG).length;
const sorted = a => a.slice().sort().join('');
const boardNow = g => JSON.parse(g.run('JSON.stringify(currentGame.board)'));
const leftPath = g => JSON.parse(g.run('JSON.stringify(findWordOnBoard())'));
// the board a word path spells, read back from the live board
const spell = (g, p) => p.map(i => boardNow(g)[i]).join('');

// a board with one word to drag (דגל, top row) plus the "other" word placed as given
const DGL_TOP = { [at(0, 0)]: 'ד', [at(0, 1)]: 'ג', [at(0, 2)]: 'ל' };
const OTHER = {
    horizontal: { [at(3, 1)]: 'ס', [at(3, 2)]: 'פ', [at(3, 3)]: 'ר' },
    vertical:   { [at(1, 4)]: 'ס', [at(2, 4)]: 'פ', [at(3, 4)]: 'ר' },
    diagonal:   { [at(2, 1)]: 'ס', [at(3, 2)]: 'פ', [at(4, 3)]: 'ר' },
    'anti-diagonal': { [at(2, 3)]: 'ס', [at(3, 2)]: 'פ', [at(4, 1)]: 'ר' },
    zigzag:     { [at(2, 1)]: 'ס', [at(3, 2)]: 'פ', [at(3, 3)]: 'ר' }
};

for (const [kind, placed] of Object.entries(OTHER)) {
    test(`auto-shuffle: a ${kind} word still on the board - no shuffle after a find`, () => {
        const g = startGame();
        g.onlyWords(['דגל', 'ספר']);
        g.setBoard(boardWith({ ...DGL_TOP, ...placed }));
        const before = boardNow(g);
        g.drag([at(0, 0), at(0, 1), at(0, 2)]);
        assert.deepEqual(g.state().found, ['דגל']);
        assert.deepEqual(boardNow(g), before, 'board not shuffled');
        assert.equal(shuffledMsgs(g), 0);
        const p = leftPath(g);
        assert.equal(spell(g, p), 'ספר', 'the remaining word is the one detected');
        assert.ok(g.run(`isValidBoardPath(${JSON.stringify(p)}, 5)`), 'a path the player can really drag');
    });
}

test('auto-shuffle: once every word is found the board is shuffled once (same letters)', () => {
    const g = startGame();
    g.onlyWords(['דגל', 'ספר']);
    g.setBoard(boardWith({ ...DGL_TOP, ...OTHER.zigzag }));
    const before = boardNow(g);
    g.drag([at(0, 0), at(0, 1), at(0, 2)]);
    assert.equal(shuffledMsgs(g), 0);
    g.drag([at(2, 1), at(3, 2), at(3, 3)]);
    assert.deepEqual(g.state().found.sort(), ['דגל', 'ספר'].sort());
    assert.equal(shuffledMsgs(g), 1, 'one shuffle, one message');
    assert.equal(sorted(boardNow(g)), sorted(before), 'same letters, only moved');
    assert.equal(g.state().score, 20, 'score untouched by the shuffle');
});

test('auto-shuffle: found words do not count as "left" (same foundWords as the mode)', () => {
    const g = startGame();
    g.onlyWords(['ספר']);
    g.setBoard(boardWith(OTHER.diagonal));
    assert.equal(leftPath(g).length, 3);
    g.run("currentGame.foundWords.add('ספר');");
    assert.deepEqual(leftPath(g), []);
});

test('auto-shuffle: no wrap between board edges, no tile used twice', () => {
    const g = startGame();
    g.onlyWords(['ספר', 'אבא', 'דגל']);
    // ס at the end of row 0, פ ר at the start of row 1: only "connected" by wrapping
    g.setBoard(boardWith({ [at(0, 4)]: 'ס', [at(1, 0)]: 'פ', [at(1, 1)]: 'ר' }));
    assert.deepEqual(leftPath(g), [], 'wrap-around is not a word');
    // a single א next to ב: אבא would need the same tile twice
    g.setBoard(boardWith({ [at(2, 2)]: 'א', [at(2, 3)]: 'ב' }));
    assert.deepEqual(leftPath(g), [], 'no tile twice');
    // the same in the real flow: drag the last real word -> shuffled
    g.setBoard(boardWith({ ...DGL_TOP, [at(2, 4)]: 'ס', [at(3, 0)]: 'פ', [at(3, 1)]: 'ר' }));
    g.drag([at(0, 0), at(0, 1), at(0, 2)]);
    assert.equal(shuffledMsgs(g), 1, 'a wrap "word" does not stop the shuffle');
});

test('auto-shuffle: a board with no word - the hint tries one shuffle, no loop, no charge', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.wallet(1000, 0);
    g.setBoard(new Array(25).fill(FILL));
    let calls = 0;
    g.ctx.__count = () => calls++;
    g.run('const __shuffle = autoShuffleIfExhausted; autoShuffleIfExhausted = () => { __count(); __shuffle(); };');
    g.run('singleHint = null;'); // rebuild the controller so it picks up the counting wrapper
    g.tap();
    assert.equal(calls, 1, 'exactly one shuffle attempt');
    assert.equal(shuffledMsgs(g), 1);
    assert.equal(g.state().coins, 1000, 'nothing charged');
    assert.ok(g.messages().includes('אין מילה להצגה כרגע'));
});

test('auto-shuffle: a step-budget miss never shuffles on a guess', () => {
    const g = startGame();
    g.onlyWords(['דגל']);
    g.setBoard(new Array(25).fill('ד')); // every tile starts a word, so the search needs many steps
    g.run('const __fbw = ZbangBoardWords.findBoardWords; ZbangBoardWords.findBoardWords = (b, s, i, o) => __fbw(b, s, i, { ...o, maxSteps: 1 });');
    assert.equal(g.run('findWordOnBoard()'), null);
    const before = boardNow(g);
    g.run('autoShuffleIfExhausted()');
    assert.deepEqual(boardNow(g), before);
    assert.equal(shuffledMsgs(g), 0);
});

test('auto-shuffle: bots board - diagonal word left keeps the board, all found shuffles it', () => {
    const g = startGame();
    g.onlyWords(['דגל', 'ספר']);
    g.setBattle(boardWith({ ...DGL_TOP, ...OTHER['anti-diagonal'] }));
    const before = boardNow(g);
    g.drag([at(0, 0), at(0, 1), at(0, 2)]);
    assert.deepEqual(boardNow(g), before, 'bots: not shuffled');
    g.drag([at(2, 3), at(3, 2), at(4, 1)]);
    assert.equal(shuffledMsgs(g), 1, 'bots: shuffled once all are found');
    assert.equal(g.battle().playerScore, 20);
    assert.ok(g.ctx.document.querySelectorAll('#battleBoard .letter-tile').length === 25, 'battle board redrawn');
});

test('auto-shuffle: multiplayer - zigzag word left keeps the board; the shuffle stays local', () => {
    const board = boardWith({ ...DGL_TOP, ...OTHER.zigzag });
    const g = startMultiplayer(board, { words: ['דגל', 'ספר'] });
    const before = boardNow(g);
    g.drag([at(0, 0), at(0, 1), at(0, 2)]);
    assert.deepEqual(boardNow(g), before, 'not shuffled');
    g.drag([at(2, 1), at(3, 2), at(3, 3)]);
    assert.equal(shuffledMsgs(g), 1);
    assert.deepEqual(g.writes.map(w => w[0]), [
        'rooms/ROOM1/players/me/score', 'rooms/ROOM1/players/me/foundWords/דגל',
        'rooms/ROOM1/players/me/score', 'rooms/ROOM1/players/me/foundWords/ספר'
    ], 'only the normal word syncs - the shuffle writes nothing to the room');
});

test('auto-shuffle: the hint still finds and shows a real path after a shuffle', () => {
    const g = startGame();
    g.wallet(100000, 0);
    // a repeatable shuffle, so the run is the same every time
    g.run('let __seed = 7; Math.random = () => ((__seed = (__seed * 16807) % 2147483647) / 2147483647);');
    for (let i = 0; i < 30; i++) {
        g.run("currentGame.mode = 'single'; currentGame.gridSize = 5; currentGame.foundWords.clear(); currentGame.gameActive = true; currentGame.paused = false;");
        g.run("currentGame.board = generateBoard(); renderBoard('board'); useShuffle();");
        const left = leftPath(g);
        g.tap();
        const tiles = g.hintTiles();
        assert.equal(tiles.length > 0, left.length > 0, 'hint shows a path exactly when the check sees a word');
        if (tiles.length) {
            const p = tiles.map(t => t.idx);
            assert.ok(g.run(`isValidBoardPath(${JSON.stringify(p)}, 5)`));
            assert.ok(g.run(`HEBREW_DICTIONARY[normalizeFinals(${JSON.stringify(p)}.map(i => currentGame.board[i]).join(''))] !== undefined`));
        }
        g.advance(DEFAULT_SHOW_MS);
    }
});

test('manual shuffle: unchanged - 20 coins (inventory first), same letters, works with words left', () => {
    const g = startGame();
    g.onlyWords(['דגל', 'ספר']);
    g.setBoard(boardWith({ ...DGL_TOP, ...OTHER.diagonal }));
    g.run('gameState.coins = 1000; gameState.inventory.shuffle = 1;');
    const before = boardNow(g);
    g.run('useShuffle()');
    assert.deepEqual(JSON.parse(g.run('JSON.stringify([gameState.coins, gameState.inventory.shuffle])')), [1000, 0], 'inventory first');
    g.run('useShuffle()');
    assert.deepEqual(JSON.parse(g.run('JSON.stringify([gameState.coins, gameState.inventory.shuffle])')), [980, 0], 'then 20 coins');
    assert.equal(sorted(boardNow(g)), sorted(before));
    assert.equal(shuffledMsgs(g), 0, 'the manual shuffle has its own message');
    g.run('gameState.coins = 19;');
    const b2 = boardNow(g);
    g.run('useShuffle()');
    assert.deepEqual(boardNow(g), b2, '19 coins: no shuffle');
});

test('auto-shuffle: speed with the real dictionary (generated boards, phone-safe)', () => {
    const g = startGame();
    assert.ok(g.run('Object.keys(HEBREW_DICTIONARY).length') > 40000);
    g.run("currentGame.mode = 'single'; currentGame.gridSize = 5; currentGame.foundWords.clear();");
    const t0 = process.hrtime.bigint();
    g.run('hintWordIndexForDictionary()');
    const buildMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const r = JSON.parse(g.run(`JSON.stringify((() => {
        let worst = 0, total = 0, incomplete = 0, worstSteps = 0, empty = 0;
        for (let i = 0; i < 500; i++) {
            currentGame.board = generateBoard();
            const t = Date.now();
            const res = ZbangBoardWords.findBoardWords(currentGame.board, 5, hintWordIndexForDictionary(), { exclude: currentGame.foundWords, firstOnly: true });
            const ms = Date.now() - t; total += ms; worst = Math.max(worst, ms);
            if (!res.complete) incomplete++;
            if (!res.found.length) empty++;
            worstSteps = Math.max(worstSteps, res.steps);
            // the worst case for "any word left": every word on the board already found
            const all = ZbangBoardWords.findBoardWords(currentGame.board, 5, hintWordIndexForDictionary());
            const ex = new Set(all.found.map(f => f.word));
            const t2 = Date.now();
            const res2 = ZbangBoardWords.findBoardWords(currentGame.board, 5, hintWordIndexForDictionary(), { exclude: ex, firstOnly: true });
            worst = Math.max(worst, Date.now() - t2);
            if (!res2.complete) incomplete++;
            worstSteps = Math.max(worstSteps, res2.steps);
        }
        return { worst, avg: total / 500, incomplete, worstSteps, empty };
    })())`));
    console.log(`  index build ${buildMs.toFixed(1)}ms; check avg ${r.avg.toFixed(2)}ms, worst ${r.worst}ms, worst steps ${r.worstSteps}, budget misses ${r.incomplete}, boards with no word ${r.empty}/500`);
    assert.equal(r.incomplete, 0, 'never runs out of budget on a real board');
    assert.ok(r.worst < 50, 'worst check well under a frame budget on this machine');
});
