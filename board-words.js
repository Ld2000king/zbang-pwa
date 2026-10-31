// ============================================================================
// board-words.js - finds the dictionary words that can really be dragged on
// a square board, under the same rules as board-path.js: each tile touches
// the previous one in one of 8 directions (zigzag and turns allowed), no
// skipping, no tile twice, no wrap-around between board edges. Returns each
// word with the exact tile path.
//
// Used by the hint in single player, bots and multiplayer (board-hint.js /
// requestBoardHint in game.js) and by the automatic shuffle's "any word
// left?" check (findWordOnBoard in game.js). Pure functions, no DOM - the
// tests run it in Node. מגדל זבאנג (tower.js) is not touched.
//
// Speed: a depth-first search that only follows letter sequences which are
// the start of some dictionary word (a prefix index), with a hard step
// budget, so even a worst-case board can't freeze the phone. If the budget
// runs out the result says complete: false.
// ============================================================================

(function (root) {
    'use strict';

    const adjacent = (typeof module !== 'undefined' && module.exports)
        ? require('./board-path.js').boardTilesAdjacent
        : root.boardTilesAdjacent;

    const DEFAULT_MIN_LEN = 3;
    const DEFAULT_MAX_LEN = 8;          // longer words are rare on a 5x5 board
    const DEFAULT_MAX_STEPS = 200000;   // tiles visited before giving up

    // words: iterable of dictionary words, already normalized (regular letter
    // forms, as HEBREW_DICTIONARY keys are). Builds the word set and the set
    // of every proper prefix. Build once and reuse.
    function buildWordIndex(words, maxLen = DEFAULT_MAX_LEN) {
        const wordSet = new Set();
        const prefixes = new Set();
        for (const w of words) {
            if (typeof w !== 'string' || w.length < 2 || w.length > maxLen) continue;
            wordSet.add(w);
            for (let i = 1; i < w.length; i++) prefixes.add(w.slice(0, i));
        }
        return { words: wordSet, prefixes, maxLen };
    }

    // All words on the board, each once, with one valid path.
    //   opts.exclude   - Set of words to skip (already found)
    //   opts.minLen    - shortest word (default 3)
    //   opts.maxSteps  - search budget (default 200000)
    //   opts.firstOnly - stop at the first word found ("is there any word?")
    // -> { found: [{ word, path }], complete, steps }
    function findBoardWords(board, size, index, opts = {}) {
        const exclude = opts.exclude || new Set();
        const minLen = opts.minLen || DEFAULT_MIN_LEN;
        const maxSteps = opts.maxSteps || DEFAULT_MAX_STEPS;
        const firstOnly = !!opts.firstOnly;
        const maxLen = Math.min(index.maxLen, size * size);
        const found = new Map();
        const n = size * size;
        const used = new Array(n).fill(false);
        const path = [];
        let steps = 0, complete = true, stopped = false;
        if (!Array.isArray(board) || board.length !== n) return { found: [], complete: true, steps: 0 };

        // neighbours of every tile, worked out once from row/column
        const neighbours = [];
        for (let i = 0; i < n; i++) {
            neighbours.push([]);
            for (let j = 0; j < n; j++) if (adjacent(i, j, size)) neighbours[i].push(j);
        }

        function visit(idx, word) {
            if (++steps > maxSteps) { complete = false; return; }
            used[idx] = true;
            path.push(idx);
            if (word.length >= minLen && index.words.has(word) && !exclude.has(word) && !found.has(word)) {
                found.set(word, path.slice());
                if (firstOnly) stopped = true;
            }
            if (!stopped && word.length < maxLen && index.prefixes.has(word)) {
                for (const next of neighbours[idx]) {
                    if (!complete || stopped) break;
                    if (!used[next] && typeof board[next] === 'string' && board[next]) visit(next, word + board[next]);
                }
            }
            path.pop();
            used[idx] = false;
        }

        for (let start = 0; start < n && complete && !stopped; start++) {
            const ch = board[start];
            if (typeof ch === 'string' && ch && (index.prefixes.has(ch) || index.words.has(ch))) visit(start, ch);
        }
        return { found: [...found].map(([word, p]) => ({ word, path: p })), complete, steps };
    }

    // One word to suggest: among the words not found yet, the shortest ones,
    // one picked at random (opts.random to make it repeatable in tests).
    // -> { word, path } or null when the board has none
    function findHintWord(board, size, index, opts = {}) {
        const { found } = findBoardWords(board, size, index, opts);
        if (!found.length) return null;
        const shortest = Math.min(...found.map(f => f.word.length));
        const pool = found.filter(f => f.word.length === shortest);
        const random = opts.random || Math.random;
        return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    }

    const api = { buildWordIndex, findBoardWords, findHintWord, DEFAULT_MAX_STEPS };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ZbangBoardWords = api;
})(typeof window !== 'undefined' ? window : globalThis);
