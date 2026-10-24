// Tests for board-words.js. Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildWordIndex, findBoardWords, findHintWord } = require('../board-words.js');
const { isValidBoardPath } = require('../board-path.js');

const N = 5;
const at = (r, c) => r * N + c;
const FILL = 'ז';
// a board of filler letters with some letters placed: { [index]: letter }
function boardWith(placed) {
    const b = new Array(N * N).fill(FILL);
    for (const [i, ch] of Object.entries(placed)) b[i] = ch;
    return b;
}
const spells = (board, p) => p.map(i => board[i]).join('');
const wordsOf = res => res.found.map(f => f.word).sort();

test('horizontal, vertical and diagonal words are found with their exact path', () => {
    const index = buildWordIndex(['דגל', 'ילד', 'כלב']);
    const board = boardWith({
        [at(4, 0)]: 'ד', [at(4, 1)]: 'ג', [at(4, 2)]: 'ל',     // horizontal
        [at(2, 0)]: 'י', [at(3, 0)]: 'ל',                      // vertical ילד ends on (4,0)
        [at(0, 4)]: 'כ', [at(1, 3)]: 'ל', [at(2, 2)]: 'ב'      // diagonal
    });
    const res = findBoardWords(board, N, index);
    assert.equal(res.complete, true);
    assert.deepEqual(wordsOf(res), ['דגל', 'ילד', 'כלב']);
    for (const f of res.found) {
        assert.ok(isValidBoardPath(f.path, N), f.word);
        assert.equal(spells(board, f.path), f.word);
    }
    assert.deepEqual(res.found.find(f => f.word === 'כלב').path, [at(0, 4), at(1, 3), at(2, 2)]);
});

test('zigzag and turning words are found', () => {
    const index = buildWordIndex(['בית', 'שלומ']); // normalized, like the game's dictionary (שלום -> שלומ)
    const board = boardWith({
        [at(0, 0)]: 'ב', [at(1, 1)]: 'י', [at(0, 2)]: 'ת',                 // down-right, up-right
        [at(2, 3)]: 'ש', [at(3, 3)]: 'ל', [at(3, 4)]: 'ו', [at(2, 4)]: 'מ'  // down, right, up (a U-turn)
    });
    const res = findBoardWords(board, N, index);
    assert.deepEqual(wordsOf(res), ['בית', 'שלומ']);
    for (const f of res.found) { assert.ok(isValidBoardPath(f.path, N)); assert.equal(spells(board, f.path), f.word); }
    assert.deepEqual(res.found.find(f => f.word === 'שלומ').path, [at(2, 3), at(3, 3), at(3, 4), at(2, 4)]);
});

test('no word through a skipped tile, a far tile, or across the board edge', () => {
    const index = buildWordIndex(['אבג', 'דהו', 'זחט']);
    const board = new Array(N * N).fill('ק');
    // אבג with a gap: (0,0) (0,2) (0,3) - the tile between is not ב
    board[at(0, 0)] = 'א'; board[at(0, 2)] = 'ב'; board[at(0, 3)] = 'ג';
    // דהו wrapping from the end of row 1 to the start of row 2 (index difference 1)
    board[at(1, 3)] = 'ד'; board[at(1, 4)] = 'ה'; board[at(2, 0)] = 'ו';
    // זחט with its last letter far away
    board[at(3, 1)] = 'ז'; board[at(3, 2)] = 'ח'; board[at(0, 4)] = 'ט';
    assert.deepEqual(wordsOf(findBoardWords(board, N, index)), []);
});

test('a tile is never used twice in one word', () => {
    const index = buildWordIndex(['אבא', 'אבב']);
    const board = new Array(N * N).fill('ק');
    board[at(2, 2)] = 'א'; board[at(2, 3)] = 'ב'; // only ONE א: אבא would need it twice
    assert.deepEqual(wordsOf(findBoardWords(board, N, index)), []);
    board[at(1, 3)] = 'א';                       // a second א next to the ב: now it exists
    const res = findBoardWords(board, N, index);
    assert.deepEqual(wordsOf(res), ['אבא']);
    assert.equal(new Set(res.found[0].path).size, 3);
});

test('words already found are skipped; minimum length is respected', () => {
    const index = buildWordIndex(['דג', 'דגל', 'ילד']);
    const board = boardWith({ [at(4, 0)]: 'ד', [at(4, 1)]: 'ג', [at(4, 2)]: 'ל', [at(2, 0)]: 'י', [at(3, 0)]: 'ל' });
    assert.deepEqual(wordsOf(findBoardWords(board, N, index, { exclude: new Set(['דגל']) })), ['ילד']);
    assert.ok(!wordsOf(findBoardWords(board, N, index)).includes('דג')); // 2 letters: too short
});

test('findHintWord picks one of the shortest words still unfound, or null', () => {
    const index = buildWordIndex(['דגל', 'ילד', 'דגלי']);
    const board = boardWith({ [at(4, 0)]: 'ד', [at(4, 1)]: 'ג', [at(4, 2)]: 'ל', [at(3, 3)]: 'י', [at(2, 0)]: 'י', [at(3, 0)]: 'ל' });
    const h = findHintWord(board, N, index, { random: () => 0 });
    assert.equal(h.word.length, 3);
    assert.ok(isValidBoardPath(h.path, N));
    assert.equal(spells(board, h.path), h.word);
    assert.equal(findHintWord(board, N, index, { exclude: new Set(['דגל', 'ילד', 'דגלי']) }), null);
});

test('bad input never throws', () => {
    const index = buildWordIndex(['אבג']);
    assert.deepEqual(findBoardWords(null, N, index).found, []);
    assert.deepEqual(findBoardWords(new Array(7).fill('א'), N, index).found, []);
    assert.deepEqual(findBoardWords(new Array(25).fill(''), N, index).found, []);
});

test('the step budget stops a huge search instead of freezing', () => {
    // every tile the same letter and a dictionary of long words made of it:
    // a worst case with a very large number of paths
    const index = buildWordIndex(['אאא', 'אאאא', 'אאאאא', 'אאאאאא', 'אאאאאאא', 'אאאאאאאב']);
    const board = new Array(N * N).fill('א');
    const t0 = Date.now();
    const res = findBoardWords(board, N, index, { maxSteps: 50000 });
    assert.equal(res.complete, false);
    assert.ok(res.steps <= 50001);
    assert.ok(Date.now() - t0 < 1000, 'stopped quickly');
    for (const f of res.found) assert.ok(isValidBoardPath(f.path, N));
});

// ---- the real game dictionary --------------------------------------------------

function loadGameWords() {
    const ROOT = path.join(__dirname, '..');
    const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
    const norm = w => w.replace(/[ךםןףץ]/g, c => FINALS[c]);
    const ctx = vm.createContext({});
    const lists = [['words.js', 'EXTRA_WORDS'], ['words-bulk.js', 'EXTRA_WORDS_BULK'],
        ['words-bulk-2.js', 'EXTRA_WORDS_BULK_2'], ['words-bulk-3.js', 'EXTRA_WORDS_BULK_3']];
    const all = new Set();
    for (const [file, name] of lists) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8') + `;globalThis.__w = ${name};`, ctx);
        for (const w of ctx.__w) if (typeof w === 'string' && /^[א-ת]+$/.test(w)) all.add(norm(w));
    }
    return [...all];
}

test('real dictionary: fast on hundreds of game-like boards, every path valid', () => {
    const words = loadGameWords();
    assert.ok(words.length > 30000, 'dictionary loaded: ' + words.length);
    const tBuild = Date.now();
    const index = buildWordIndex(words);
    const buildMs = Date.now() - tBuild;

    // letters weighted like a real board
    const W = { 'א': 8, 'ב': 3, 'ג': 2, 'ד': 3, 'ה': 8, 'ו': 6, 'ז': 1, 'ח': 2, 'י': 8, 'ל': 6, 'מ': 5, 'נ': 5,
        'ס': 1, 'ע': 2, 'פ': 2, 'ק': 2, 'ר': 6, 'ש': 5, 'ת': 5 };
    const letters = Object.entries(W).flatMap(([l, w]) => Array(w).fill(l));
    let seed = 99;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

    let worst = 0, total = 0, words0 = 0, incomplete = 0;
    for (let b = 0; b < 300; b++) {
        const board = Array.from({ length: N * N }, () => letters[Math.floor(rand() * letters.length)]);
        const t0 = process.hrtime.bigint();
        const res = findBoardWords(board, N, index);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        worst = Math.max(worst, ms); total += ms;
        if (!res.complete) incomplete++;
        if (!res.found.length) words0++;
        for (const f of res.found) {
            assert.ok(isValidBoardPath(f.path, N), f.word);
            assert.equal(spells(board, f.path), f.word);
            assert.ok(index.words.has(f.word));
        }
    }
    console.log(`  dictionary ${words.length} words, index built in ${buildMs} ms; 300 boards: avg ${(total / 300).toFixed(1)} ms, worst ${worst.toFixed(1)} ms, incomplete ${incomplete}, boards with no word ${words0}`);
    assert.equal(incomplete, 0);
    assert.ok(worst < 250, 'worst board ' + worst + ' ms');
    assert.ok(buildMs < 3000, 'index build ' + buildMs + ' ms');
});
