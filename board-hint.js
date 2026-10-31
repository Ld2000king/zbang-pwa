// ============================================================================
// board-hint.js - the single-player hint for 1.2: it SHOWS the path of one
// word that hasn't been found yet, and the player drags it themselves. The
// hint never scores, never gives XP and never marks the word as found - only
// a real drag (endDrag in game.js) does that.
//
// The game passes in what it needs (finder, payment, drawing, timers), so
// this file has no DOM and the tests run it in Node.
//
// Rules kept here:
//   - the word comes from board-words.js (8 directions, zigzag, no wrap),
//     shortest words first, one picked at random
//   - before it is shown the path is checked again: touching tiles, no tile
//     twice, the letters spell the word, the word is in the dictionary and
//     not found yet - otherwise nothing is shown and nothing is charged
//   - payment happens only after a word was found to show
//   - while a hint is on the board, another tap does nothing (no second
//     charge from fast taps)
//
// Used by useHint() (single player), useBattleHint() (bots) and
// useMultiplayerHint() (friends + random). מגדל זבאנג (tower.js) is not
// connected to it.
// ============================================================================

(function (root) {
    'use strict';

    const isNode = typeof module !== 'undefined' && module.exports;
    const validPath = isNode ? require('./board-path.js').isValidBoardPath : root.isValidBoardPath;

    const DEFAULT_SHOW_MS = 4000;

    // Is this { word, path } safe to show on this board?
    //   normalize(letters) - the game's normalizeFinals (identity if missing)
    function isShowableHint(hint, board, size, dictionary, foundWords, normalize) {
        if (!hint || typeof hint.word !== 'string' || !Array.isArray(hint.path)) return false;
        if (hint.path.length < 3 || hint.path.length !== hint.word.length) return false;
        if (!validPath(hint.path, size)) return false;
        const letters = hint.path.map(i => board[i]);
        if (letters.some(ch => typeof ch !== 'string' || !ch)) return false;
        const spelled = (normalize || (s => s))(letters.join(''));
        if (spelled !== hint.word) return false;
        if (dictionary[hint.word] === undefined) return false;
        if (foundWords && foundWords.has(hint.word)) return false;
        return true;
    }

    // deps:
    //   isPlayable()      - game running in single player (not paused/ended)
    //   canPay()          - true if inventory/coins cover it (shows its own message)
    //   pay()             - takes the hint from inventory or coins
    //   findHint()        - { word, path } or null
    //   isShowable(hint)  - final check (isShowableHint bound to the board)
    //   onExhausted()     - board has no word: the game's normal auto-shuffle
    //   show(path)        - draw the path, in letter order
    //   clear()           - remove the drawing
    //   setTimer/clearTimer - setTimeout/clearTimeout
    //   showMs            - how long the path stays (default 4000)
    // request() -> 'shown' | 'busy' | 'inactive' | 'no-funds' | 'none'
    function createHintController(deps) {
        const showMs = deps.showMs || DEFAULT_SHOW_MS;
        let active = null; // { word, path, timer }

        function pick() {
            const hint = deps.findHint();
            return hint && deps.isShowable(hint) ? hint : null;
        }

        function end() {
            if (!active) return;
            const a = active;
            active = null;
            if (a.timer != null) deps.clearTimer(a.timer);
            deps.clear(a.path);
        }

        function request() {
            if (active) return 'busy';
            if (!deps.isPlayable()) return 'inactive';
            if (!deps.canPay()) return 'no-funds';
            let hint = pick();
            if (!hint && deps.onExhausted) {
                deps.onExhausted();
                hint = pick();
            }
            if (!hint) return 'none';
            deps.pay();
            active = { word: hint.word, path: hint.path.slice(), timer: null };
            deps.show(active.path);
            active.timer = deps.setTimer(end, showMs);
            return 'shown';
        }

        // the player dragged a word: if it was the hinted one, the hint is done
        function wordFound(word) {
            if (active && active.word === word) end();
        }

        return {
            request,
            wordFound,
            cancel: end, // board redrawn / new game / leaving the screen
            current: () => (active ? { word: active.word, path: active.path.slice() } : null)
        };
    }

    const api = { isShowableHint, createHintController, DEFAULT_SHOW_MS };
    if (isNode) module.exports = api;
    else root.ZbangBoardHint = api;
})(typeof window !== 'undefined' ? window : globalThis);
