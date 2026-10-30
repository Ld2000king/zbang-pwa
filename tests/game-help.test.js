// Tests for the in-game how-to-play (1.2): the ? button next to pause in
// single player (1 and 2 minutes) and bots (all 3 difficulties). Run with:
//   node --test tests/
// The real game.js (+ avatars/icons/board files, multiplayer.js, tower.js) run
// in a sandbox with a tiny stand-in DOM and a fake clock, so "the round stops
// while the help is open and carries on from the same point" is checked to the
// millisecond.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const FILES = ['avatars.js', 'icons.js', 'board-path.js', 'board-words.js', 'board-hint.js', 'game.js',
    'words.js', 'words-bulk.js', 'words-bulk-2.js', 'words-bulk-3.js', 'tower.js', 'multiplayer.js']
    .map(f => [f, read(f)]);
const INDEX_HTML = read('index.html');

function makeEl(id) {
    const cls = new Set();
    return {
        id: id || '', style: {}, dataset: {}, children: [], textContent: '', innerHTML: '', value: '',
        classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle() {} },
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

const isOpen = g => g.el('modeHelpOverlay').style.display === 'flex';

// ---------------------------------------------------------------------------
// single player
// ---------------------------------------------------------------------------
for (const [mode, seconds, label] of [['quick', 60, 'משחק מהיר'], ['precise', 120, 'משחק מדוייק']]) {
    test(`single ${mode}: ? stops the clock, closing carries on from the same millisecond`, () => {
        const g = startSandbox();
        g.run(`startSinglePlayer('${mode}')`);
        g.advance(2600);                                   // 2 ticks + 600ms into the 3rd second
        assert.equal(g.run('currentGame.timeLeft'), seconds - 2);
        const before = g.wallet();

        g.run('openGameHelp()');
        assert.ok(isOpen(g), 'help open');
        assert.equal(g.run('currentGame.paused'), true);
        assert.equal(g.run('currentGame.gameActive'), false, 'board input blocked');
        assert.match(g.el('modeHelpTitle').textContent, new RegExp(label));
        assert.equal(g.el('modeHelpCloseBtn').textContent, 'חזרה למשחק');

        g.advance(30000);                                  // reading for 30s
        assert.equal(g.run('currentGame.timeLeft'), seconds - 2, 'clock did not move while open');

        g.run('closeModeHelp()');
        assert.ok(!isOpen(g));
        assert.equal(g.run('currentGame.gameActive'), true);
        g.advance(399);
        assert.equal(g.run('currentGame.timeLeft'), seconds - 2, 'the rest of the second is still owed');
        g.advance(1);
        assert.equal(g.run('currentGame.timeLeft'), seconds - 3, 'ticks exactly when the 3rd second ends');
        g.advance(1000);
        assert.equal(g.run('currentGame.timeLeft'), seconds - 4, 'then every second as before');
        assert.equal(g.wallet(), before, 'no coins / diamonds / items / XP change');
    });
}

test('single: help text matches 1.2 (diagonal + zigzag, hint shows the path, scoring, time)', () => {
    const g = startSandbox();
    for (const [mode, time] of [['quick', 'דקה אחת'], ['precise', '2 דקות']]) {
        g.run(`startSinglePlayer('${mode}'); openGameHelp()`);
        const items = g.el('modeHelpList').innerHTML;
        assert.match(items, /באלכסון ובזיגזג/);
        assert.match(items, /3 אותיות לפחות/);
        assert.match(items, new RegExp(time));
        assert.match(items, /המסלול של מילה/);
        assert.match(items, /100.*250.*500/);
        assert.match(items, /5 שניות/);
        assert.doesNotMatch(items, /מסמן מילה/, 'old hint wording is gone');
        g.run('closeModeHelp(); goHome()');
    }
});

test('single: reopening many times never loses or gains time', () => {
    const g = startSandbox();
    g.run(`startSinglePlayer('quick')`);
    g.advance(1250);                                       // 1 tick, 250ms into the 2nd second
    for (let i = 0; i < 20; i++) {                         // 20 x (play 100ms, read 5s)
        g.run('openGameHelp()'); g.advance(5000); g.run('closeModeHelp()'); g.advance(100);
    }
    // played 1250 + 20*100 = 3250ms of round time -> 3 ticks
    assert.equal(g.run('currentGame.timeLeft'), 57);
});

test('single: freeze seconds are kept while the help is open', () => {
    const g = startSandbox();
    g.run(`startSinglePlayer('quick'); currentGame.freezeLeft = 5;`);
    g.advance(2500);
    assert.equal(g.run('currentGame.freezeLeft'), 3);
    g.run('openGameHelp()'); g.advance(10000); g.run('closeModeHelp()');
    assert.equal(g.run('currentGame.freezeLeft'), 3);
    assert.equal(g.run('currentGame.timeLeft'), 60);
});

test('a drag in progress is dropped when the help opens (it can not score later)', () => {
    const g = startSandbox();
    g.run(`startSinglePlayer('quick'); isDragging = true; dragPath = [0, 1, 2];`);
    g.run('openGameHelp()');
    assert.equal(g.run('isDragging'), false);
    assert.equal(g.run('dragPath.length'), 0);
});

// ---------------------------------------------------------------------------
// bots - all three difficulties
// ---------------------------------------------------------------------------
for (const [diff, name] of [['easy', 'זבאנג התחלתי'], ['medium', 'זבאנג קלאסי'], ['hard', 'זבאנג מלכותי']]) {
    test(`bots ${diff}: ? stops the clock AND the bots; closing keeps every bot's countdown`, () => {
        const g = startSandbox();
        g.run(`startBattleRoyale('${diff}')`);
        assert.match(g.el('roundBadge').innerHTML, /round-num">סיבוב 1\/5</);
        assert.match(g.el('roundBadge').innerHTML, new RegExp(`round-diff">${name}<`));
        assert.notEqual(g.el('battleHelpBtn').style.display, 'none');
        g.advance(3700);
        const t0 = g.run('currentGame.timeLeft');
        const bots0 = g.bots();
        const before = g.wallet();

        g.run('openGameHelp()');
        assert.ok(isOpen(g));
        assert.equal(g.run('battleState.botTimer'), null, 'bot loop stopped');
        assert.equal(g.el('modeHelpTitle').textContent, 'איך משחקים מול בוטים?');
        assert.match(g.el('modeHelpList').innerHTML, new RegExp(name));
        assert.match(g.el('modeHelpList').innerHTML, /באלכסון ובזיגזג/);
        const botCount = g.run('battleState.players.length');
        assert.equal(botCount, 5);
        assert.match(g.el('modeHelpList').innerHTML, new RegExp(`מול <strong>${botCount} בוטים</strong>, ב-<strong>5 סיבובים`), 'bot count in the text = real bots');

        g.advance(60000);                                  // a full minute of reading
        assert.equal(g.run('currentGame.timeLeft'), t0, 'clock did not move');
        assert.equal(g.bots(), bots0, 'no bot scored or counted down');

        g.run('closeModeHelp()');
        assert.equal(g.bots(), bots0, 'each bot keeps its own countdown');
        assert.ok(g.run('!!battleState.botTimer'), 'bots run again');
        g.advance(300);
        assert.equal(g.run('currentGame.timeLeft'), t0 - 1, 'clock carries on with the 300ms that were left');
        assert.equal(g.wallet(), before);
    });
}

test('bots: frozen-opponents seconds are kept while the help is open', () => {
    const g = startSandbox();
    g.run(`startBattleRoyale('medium'); battleState.botsFrozenSeconds = 8;`);
    g.advance(3000);
    const left = g.run('battleState.botsFrozenSeconds');
    g.run('openGameHelp()'); g.advance(20000); g.run('closeModeHelp()');
    assert.equal(g.run('battleState.botsFrozenSeconds'), left);
});

// ---------------------------------------------------------------------------
// pause, edge cases, first-run help
// ---------------------------------------------------------------------------
test('pause menu still works, and ? does nothing while paused or between rounds', () => {
    const g = startSandbox();
    g.run(`startBattleRoyale('easy')`);
    g.advance(1500);
    g.run('pauseGame()');
    assert.equal(g.el('pauseOverlay').style.display, 'flex');
    g.run('openGameHelp()');
    assert.ok(!isOpen(g), 'no help on top of the pause menu');
    const t = g.run('currentGame.timeLeft');
    g.advance(5000);
    assert.equal(g.run('currentGame.timeLeft'), t);
    g.run('resumeGame()');
    assert.equal(g.el('pauseOverlay').style.display, 'none');
    g.advance(500);
    assert.equal(g.run('currentGame.timeLeft'), t - 1, 'pause also keeps the rest of the second now');

    g.run('currentGame.gameActive = false');               // e.g. the round just ended
    g.run('openGameHelp()');
    assert.ok(!isOpen(g));
});

test('? never runs in multiplayer, and multiplayer hides the bots ? button', () => {
    const g = startSandbox();
    g.run(`currentGame.mode = 'multiplayer'; currentGame.gameActive = true; currentGame.paused = false;`);
    g.run('openGameHelp()');
    assert.ok(!isOpen(g));
    assert.equal(g.run('currentGame.paused'), false);
    const mp = read('multiplayer.js');
    assert.match(mp, /getElementById\('battleHelpBtn'\)[\s\S]{0,200}style\.display = 'none'/);
});

test('leaving the game closes an open in-game help', () => {
    const g = startSandbox();
    g.run(`startSinglePlayer('quick'); openGameHelp(); goHome();`);
    assert.ok(!isOpen(g));
    assert.equal(g.run('modeHelpThen'), null);
});

test('first entry: the same updated text, game starts only after closing', () => {
    const g = startSandbox();
    g.run('gameState.modeHelpSeen = {}');
    g.run(`startSinglePlayer('precise')`);
    assert.ok(isOpen(g));
    assert.equal(g.el('modeHelpCloseBtn').textContent, 'בוא נתחיל!');
    assert.match(g.el('modeHelpTitle').textContent, /משחק מדוייק/);
    assert.match(g.el('modeHelpList').innerHTML, /באלכסון ובזיגזג/);
    assert.notEqual(g.run('currentGame.mode'), 'single', 'round not started yet');
    g.run('closeModeHelp()');
    assert.equal(g.run('currentGame.mode'), 'single');
    assert.equal(g.run('currentGame.gameActive'), true);
    assert.equal(g.run('gameState.modeHelpSeen.single'), true);

    g.run(`startBattleRoyale('hard')`);
    assert.ok(isOpen(g));
    assert.match(g.el('modeHelpList').innerHTML, /זבאנג מלכותי/);
    g.run('closeModeHelp()');
    assert.equal(g.run('currentGame.mode'), 'battle');
    assert.equal(g.run('battleState.difficulty'), 'hard');
});

test('multiplayer first-entry help and the tower help are unchanged', () => {
    const g = startSandbox();
    g.run('gameState.modeHelpSeen = {}');
    let ran = 0;
    g.ctx.__then = () => { ran++; };
    g.run(`showModeHelp('friends', __then)`);
    assert.equal(g.el('modeHelpTitle').textContent, 'איך משחקים עם חברים?');
    assert.equal(g.el('modeHelpCloseBtn').textContent, 'בוא נתחיל!');
    g.run('closeModeHelp()');
    assert.equal(ran, 1);
    assert.equal(g.run('gameState.modeHelpSeen.friends'), true);
    g.run(`showModeHelp('random', __then)`);
    assert.equal(g.el('modeHelpTitle').textContent, 'איך משחקים במשחק אקראי?');
    g.run('closeModeHelp()');
    assert.equal(ran, 2);

    g.run('showTowerHelp()');
    assert.equal(g.el('towerHelpOverlay').style.display, 'flex');
    g.run('closeTowerHelp()');
    assert.equal(g.el('towerHelpOverlay').style.display, 'none');
});

// ---------------------------------------------------------------------------
// markup
// ---------------------------------------------------------------------------
test('markup: a ? next to pause in single player and bots; help closes from its button or the backdrop', () => {
    const single = INDEX_HTML.match(/<div id="gameScreen"[\s\S]*?<div class="board" id="board">/)[0];
    assert.match(single, /<div class="header-btns">\s*<button class="pause-btn[^"]*"[^>]*onclick="pauseGame\(\)"[\s\S]*?<\/button>\s*<button class="exit-btn game-help-btn icon" id="singleHelpBtn" onclick="openGameHelp\(\)" title="איך משחקים\?" aria-label="איך משחקים\?">/);
    const battle = INDEX_HTML.match(/<div id="battleScreen"[\s\S]*?<div class="round-badge"/)[0];
    assert.match(battle, /id="battlePauseBtn"[\s\S]*?<\/button>\s*<button class="exit-btn game-help-btn icon" id="battleHelpBtn" onclick="openGameHelp\(\)"/);
    assert.match(INDEX_HTML, /id="modeHelpOverlay"[^>]*onclick="if\(event\.target===this\)closeModeHelp\(\)"/);
    assert.match(INDEX_HTML, /id="modeHelpCloseBtn" onclick="closeModeHelp\(\)"/);
    assert.match(INDEX_HTML, /<html[^>]*dir="rtl"/);
});

test('general instructions screen matches 1.2 (two single-player modes, diagonal + zigzag, hint path)', () => {
    const screen = INDEX_HTML.match(/<div id="instructionsScreen"[\s\S]*?<\/ul>/)[0];
    assert.doesNotMatch(screen, /60 שניות/, 'the old "single = 60 seconds only" line is gone');
    assert.doesNotMatch(screen, /אותיות סמוכות/);
    assert.match(screen, /<strong>משחק מהיר<\/strong> של דקה אחת/);
    assert.match(screen, /<strong>משחק מדוייק<\/strong> של 2 דקות/);
    assert.match(screen, /באלכסון ובזיגזג/);
    assert.match(screen, /3 אותיות לפחות/);
    assert.match(screen, /<strong>רמז<\/strong> מראה על הלוח את המסלול של מילה/);
    assert.match(screen, /5 סיבובים נגד 5 בוטים/);
    // the mode names match the buttons on the single-player picker
    const picker = INDEX_HTML.match(/<div id="singleModeScreen"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)[0];
    assert.match(picker, /<h3>משחק מהיר<\/h3>/);
    assert.match(picker, /<h3>משחק מדוייק<\/h3>/);
});
