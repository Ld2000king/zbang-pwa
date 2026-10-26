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
    'words.js', 'words-bulk.js', 'words-bulk-2.js', 'words-bulk-3.js']
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

test('prices: multiplayer (real multiplayer.js) - 75 coins, inventory first, no charge without a word', () => {
    const g = startFullGame();
    g.onlyWords(['דגל']);
    g.setBattle(boardWith({ [at(2, 1)]: 'ד', [at(2, 2)]: 'ג', [at(2, 3)]: 'ל' }));
    g.run(`currentGame.mode = 'multiplayer'; blockedByFreeze = () => false; submitMultiplayerWord = () => {};
           gameState.coins = 1000; gameState.inventory.hint = 0;`);
    g.run('handleBattleHint()');
    assert.deepEqual(wallet(g), { coins: 925, hints: 0 }, 'multiplayer hint costs 75');
    g.run('gameState.inventory.hint = 1; currentGame.foundWords.clear();');
    g.run('handleBattleHint()');
    assert.deepEqual(wallet(g), { coins: 925, hints: 0 }, 'inventory first');
    g.run('gameState.coins = 74; currentGame.foundWords.clear();');
    g.run('handleBattleHint()');
    assert.deepEqual(wallet(g), { coins: 74, hints: 0 }, 'not enough for 75');
    g.run("gameState.coins = 1000; autoShuffleIfExhausted = () => {}; currentGame.foundWords.add('דגל');");
    g.run('handleBattleHint()'); // the only word is already found
    assert.deepEqual(wallet(g), { coins: 1000, hints: 0 }, 'no word -> no charge');
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
