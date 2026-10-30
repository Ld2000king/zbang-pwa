// Tests for words-bulk-4.js (1.2): 41k more Hebrew words. Run with:  node --test tests/
// 1. the pack on its own: format, game rules, no duplicates, no known blocked words
// 2. the real game (tests/sandbox.js): the new words score once when dragged,
//    the hint finds them, the bots use them, and the admin's removed-words
//    blocklist still keeps a removed word out.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { startSandbox, read } = require('./sandbox.js');

const FIN = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const norm = w => w.replace(/[ךםןףץ]/g, c => FIN[c]);
function loadPack(file, name) {
    const ctx = vm.createContext({});
    vm.runInContext(read(file) + `;globalThis.__w = ${name};`, ctx);
    return [...ctx.__w];
}
const PACK = loadPack('words-bulk-4.js', 'EXTRA_WORDS_BULK_4');

// ---------------------------------------------------------------------------
// 1. the pack on its own
// ---------------------------------------------------------------------------
test('pack: 41,391 words, normalized (no final letters), Hebrew letters only, 3-8 letters', () => {
    assert.equal(PACK.length, 41391);
    for (const w of PACK) {
        assert.match(w, /^[א-ת]{3,8}$/, w);
        assert.doesNotMatch(w, /[ךםןףץ]/, 'final letter: ' + w);
    }
});

test('pack: no duplicates inside it, and nothing the game already knows', () => {
    assert.equal(new Set(PACK).size, PACK.length, 'internal duplicates');
    const existing = new Set();
    const g = read('game.js');
    const base = vm.createContext({});
    vm.runInContext(g.match(/const HEBREW_DICTIONARY = \{[\s\S]*?\n\};/)[0].replace('const ', 'var '), base);
    Object.keys(base.HEBREW_DICTIONARY).forEach(w => existing.add(norm(w)));
    for (const [f, v] of [['words.js', 'EXTRA_WORDS'], ['words-bulk.js', 'EXTRA_WORDS_BULK'], ['words-bulk-2.js', 'EXTRA_WORDS_BULK_2'], ['words-bulk-3.js', 'EXTRA_WORDS_BULK_3']])
        loadPack(f, v).forEach(w => existing.add(norm(w)));
    const clash = PACK.filter(w => existing.has(w));
    assert.deepEqual(clash, [], 'already in the game');
});

test('pack: no word from the game\'s moderation lists, and none of the names / blocked words found in review', () => {
    const mod = read('moderation.js');
    const parts = [...mod.match(/BLOCKED_NAME_PARTS = \[([\s\S]*?)\];/)[1].matchAll(/'([א-ת]+)'/g)].map(m => m[1]);
    const exact = new Set([...mod.match(/BLOCKED_NAME_WORDS = \[([\s\S]*?)\];/)[1].matchAll(/'([א-ת]+)'/g)].map(m => m[1]));
    const hits = PACK.filter(w => exact.has(w) || parts.some(p => w.includes(p)));
    assert.deepEqual(hits, []);
    const reviewed = ['פרנק', 'לורנ', 'מוסא', 'סטילס', 'סטיבנ', 'מריה', 'ברנר', 'חברונ', 'צפת', 'ליטא', 'גמליאל', 'אבשלומ',
        'ביוני', 'וכו', 'ולא', 'ואז', 'ואת', 'מזוינ', 'אונס', 'קוקאינ', 'להתמסטל', 'שדיכ'];
    const set = new Set(PACK);
    assert.deepEqual(reviewed.filter(w => set.has(w)), []);
});

test('pack header names its sources and licences', () => {
    const head = read('words-bulk-4.js').slice(0, 3000);
    assert.match(head, /hebrew-words-db/);
    assert.match(head, /CC0 1\.0/);
    assert.match(head, /Project\s+Ben-Yehuda/);
    assert.match(head, /public domain/);
});

// ---------------------------------------------------------------------------
// 2. in the real game
// ---------------------------------------------------------------------------
function game() {
    const g = startSandbox();
    g.run(`playWordSound = () => 1; playMissSound = () => {}; playDupeSound = () => {}; playLetterTick = () => {};
           launchSparkles = () => {}; launchConfetti = () => {};`);
    return g;
}
// a 5x5 board with `word` laid along a snake path (row 0 left->right, then row 1 right->left)
function boardWith(word) {
    const path = [0, 1, 2, 3, 4, 9, 8, 7].slice(0, word.length);
    const board = Array(25).fill('ט');
    path.forEach((idx, i) => { board[idx] = word[i]; });
    return { board, path };
}
const pick = len => PACK.find(w => w.length === len);

test('the merged dictionary grows by exactly the pack size', () => {
    const g = game();
    const withPack = g.run('Object.keys(HEBREW_DICTIONARY).length');
    const g2 = game();
    g2.run(`EXTRA_WORDS_BULK_4.forEach(w => { delete HEBREW_DICTIONARY[w]; }); invalidateDictionaryCache();`);
    const without = g2.run('Object.keys(HEBREW_DICTIONARY).length');
    assert.equal(withPack - without, PACK.length);
    assert.equal(withPack, 85766, 'total words in the game');
    assert.equal(g.run("Object.keys(HEBREW_DICTIONARY).filter(w => /[ךםןףץ]/.test(w)).length"), 0, 'no final letters left');
});

for (const len of [3, 5, 8]) {
    test(`a new ${len}-letter word scores when dragged - once`, () => {
        const g = game();
        const word = pick(len);
        const { board, path } = boardWith(word);
        g.run(`startSinglePlayer('quick')`);
        g.ctx.__b = board; g.ctx.__p = path;
        g.run(`currentGame.board = __b.slice(); currentGame.score = 0; currentGame.foundWords.clear();`);
        g.run('dragPath = __p.slice(); isDragging = true; endDrag();');
        const pts = len >= 5 ? 500 : len === 4 ? 250 : 100;
        assert.equal(g.run('currentGame.score'), pts, word);
        assert.equal(g.run(`currentGame.foundWords.has(${JSON.stringify(word)})`), true);
        // the same word again (put the board back first: a board with no other
        // word left is shuffled by the game after a find)
        g.run('currentGame.board = __b.slice(); dragPath = __p.slice(); isDragging = true; endDrag();');
        assert.equal(g.run('currentGame.score'), pts, 'no second score for the same word');
    });
}

test('the hint search finds new words on the board', () => {
    const g = game();
    const word = pick(6);
    const { board } = boardWith(word);
    g.ctx.__b = board;
    const found = JSON.parse(g.run(`JSON.stringify(ZbangBoardWords.findBoardWords(__b, 5, ZbangBoardWords.buildWordIndex(dictionaryWordList())).found.map(f => f.word))`));
    assert.ok(found.includes(word), word);
});

test('the bots draw new words from the board (straight rows, up to 5 letters)', () => {
    const g = game();
    const word = pick(5);
    const { board } = boardWith(word);
    g.ctx.__b = board;
    g.run('currentGame.gridSize = 5; currentGame.board = __b.slice();');
    const pool = JSON.parse(g.run('JSON.stringify(collectBoardWords().map(w => w.word))'));
    assert.ok(pool.includes(word), word);
});

test('a word the admin removed stays out even though it is in the pack', () => {
    const g = game();
    const word = pick(4);
    g.ctx.__w = word;
    g.run('removedWordsSet.add(__w); applyRemovedWords();');
    assert.equal(g.run('HEBREW_DICTIONARY[__w] === undefined'), true, 'dropped by applyRemovedWords');
    g.run('mergeExtraWords();');
    assert.equal(g.run('HEBREW_DICTIONARY[__w] === undefined'), true, 'not merged back');
});

test('wired everywhere: index.html, the offline cache (sw.js) and the merge', () => {
    assert.match(read('index.html'), /<script src="words-bulk-3\.js\?v=\d+"><\/script>\s*<script src="words-bulk-4\.js\?v=\d+"><\/script>/);
    assert.match(read('sw.js'), /'\.\/words-bulk-4\.js'/);
    assert.match(read('game.js'), /packs\.push\(EXTRA_WORDS_BULK_4\)/);
});
