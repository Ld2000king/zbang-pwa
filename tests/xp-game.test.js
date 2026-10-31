// Integration tests: the REAL xp-engine.js, xp-state.js, xp-game.js and
// cloudsave.js, run together in a sandbox with stand-ins for the parts of
// the game they hook into (round-end functions, saveGameState, storage).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SOURCES = ['xp-engine.js', 'xp-state.js', 'cloudsave.js', 'xp-game.js'].map(f => [f, read(f)]);

// A "device": its own storage that survives "app restarts" (new sandboxes).
function makeStorage(initial) {
    const m = new Map(initial ? initial : []);
    return {
        map: m, failWrites: false,
        getItem: k => (m.has(k) ? m.get(k) : null),
        setItem(k, v) { if (this.failWrites) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
        removeItem: k => m.delete(k)
    };
}

// Starts the app on a device: loads the scripts, then runs loadGameState()
// the way the game's load handler does.
function startApp(storage, { query = '', initialState } = {}) {
    if (initialState && !storage.map.has('zabangState')) storage.map.set('zabangState', JSON.stringify(initialState));
    const ctx = {
        console: { log() {}, info() {}, warn() {}, error() {} },
        location: { search: query }, localStorage: storage, URLSearchParams, Date, JSON, Math, Object, Array, Number, String, Map, Set, Error, Promise, setTimeout, clearTimeout,
        gameState: { playerName: 'שחקן', coins: 100, diamonds: 0, level: 1, xp: 0, xpToNextLevel: 100, inventory: { hint: 3 } },
        currentGame: { mode: null, foundWords: new Set(), gameActive: false, singleMode: 'quick' },
        battleState: { currentRound: 1, totalRounds: 5, players: [] },
        MP: { playerId: 'me', roomCode: 'ROOM1', serverOffset: 0 },
        tower: { words: 0, clears: 0, score: 0 },
        calls: [], homeUpdates: 0,
        document: { getElementById: () => null } // cloudsave.js only paints UI with it
    };
    ctx.window = ctx;
    // stand-ins for the game's own functions (the real ones aren't loaded)
    ctx.saveGameState = () => storage.setItem('zabangState', JSON.stringify(ctx.gameState));
    ctx.loadGameState = () => { const s = storage.getItem('zabangState'); if (s) ctx.gameState = JSON.parse(s); };
    ctx.updateHomeUI = () => { ctx.homeUpdates++; };
    ctx.startSinglePlayer = (m = 'quick') => { ctx.currentGame = { mode: 'single', singleMode: m, gameActive: true, foundWords: new Set() }; };
    ctx.endRound = (mode) => { ctx.calls.push('endRound:' + mode); ctx.gameState.coins += 10; ctx.saveGameState(); };
    ctx.startBattleRoyale = () => {
        ctx.currentGame = { mode: 'battle', gameActive: true, foundWords: new Set() };
        ctx.battleState = { currentRound: 1, totalRounds: 5, players: ['a', 'b', 'c', 'd', 'e'].map(name => ({ name, eliminated: false })) };
    };
    ctx.endBattleRound = () => { // the player survives unless ctx.playerLoses is set
        ctx.calls.push('endBattleRound');
        if (!ctx.playerLoses) ctx.battleState.players.find(b => !b.eliminated).eliminated = true;
    };
    ctx.showMultiplayerRoundEnd = () => ctx.calls.push('mpRoundEnd');
    ctx.showMultiplayerResult = () => ctx.calls.push('mpResult');
    ctx.towerGameOver = () => { ctx.calls.push('towerGameOver'); ctx.gameState.coins += Math.floor(ctx.tower.score / 10); ctx.saveGameState(); };
    vm.createContext(ctx);
    for (const [file, src] of SOURCES) vm.runInContext(src, ctx, { filename: file });
    ctx.loadGameState();
    return ctx;
}

const saved = storage => JSON.parse(storage.getItem('zabangState'));
const words = n => new Set(Array.from({ length: n }, (_, i) => 'w' + i));
function playSingle(app, n) {
    app.startSinglePlayer('quick');
    app.currentGame.foundWords = words(n);
    app.endRound('single');
    return app.ZbangXPGame.results.at(-1);
}
function playTower(app, w, clears, score = 0) {
    Object.assign(app.tower, { words: w, clears, score });
    app.towerGameOver();
    return app.ZbangXPGame.results.at(-1);
}

// ---- modes -------------------------------------------------------------------

test('single player: XP saved with the round; no words -> nothing', () => {
    const s = makeStorage(), app = startApp(s);
    const r = playSingle(app, 3);
    assert.equal(r.saved, true);
    assert.equal(r.xp, 23);
    assert.equal(saved(s).xp, 23);
    assert.equal(saved(s).coins, 110);                  // the game's own reward still happened
    assert.ok(app.calls.includes('endRound:single'));
    const none = playSingle(app, 0);
    assert.equal(none.saved, false);
    assert.equal(none.reason, 'not-eligible');
    assert.equal(saved(s).xp, 23);
});

test('bots: survive 15, knocked out 10, win the final round 40', () => {
    const s = makeStorage(), app = startApp(s);
    app.startBattleRoyale();
    app.currentGame.foundWords = words(2);
    app.endBattleRound();
    assert.equal(app.ZbangXPGame.results.at(-1).xp, 15);
    app.battleState.currentRound = 5; app.currentGame.foundWords = words(1);
    app.endBattleRound();
    assert.equal(app.ZbangXPGame.results.at(-1).xp, 40);
    app.startBattleRoyale(); app.playerLoses = true; app.currentGame.foundWords = words(1);
    app.endBattleRound();
    assert.equal(app.ZbangXPGame.results.at(-1).xp, 10);
    assert.equal(saved(s).xpProgress.xp[app.ZbangXPGame.installId()], 65);
});

test('friends and random: round, win, draw, loss, spectator, repeated snapshot', () => {
    const s = makeStorage(), app = startApp(s);
    const room = (extra) => Object.assign({ matchType: 'friends', roundStartTime: 1792849000000, loserId: 'b',
        players: { me: { eliminated: false }, b: { eliminated: true } } }, extra);
    app.currentGame.foundWords = words(2);
    app.showMultiplayerRoundEnd(room());
    assert.equal(app.ZbangXPGame.results.at(-1).xp, 10);
    app.showMultiplayerRoundEnd(room());                                    // same snapshot again
    assert.equal(app.ZbangXPGame.results.at(-1).reason, 'duplicate');
    app.showMultiplayerResult(room({ roundStartTime: 1792849100000, winnerId: 'me', loserId: 'b' }));
    assert.equal(app.ZbangXPGame.results.at(-1).xp, 35);
    app.currentGame.foundWords = new Set();
    app.showMultiplayerResult(room({ roundStartTime: 1792849200000, winnerId: 'x', loserId: 'y', players: { me: { eliminated: true } } }));
    assert.equal(app.ZbangXPGame.results.at(-1).saved, false);              // only watching
    app.MP.roomCode = 'R2'; app.currentGame.foundWords = words(1);
    app.showMultiplayerResult({ matchType: 'random', roundStartTime: 1792849300000, isDraw: true, players: { me: { eliminated: false } } });
    assert.equal(app.ZbangXPGame.results.at(-1).xp, 25);
    app.MP.roomCode = 'R3';
    app.showMultiplayerResult({ matchType: 'random', roundStartTime: 1792849400000, winnerId: 'o', loserId: 'me', players: { me: { eliminated: true } } });
    assert.equal(app.ZbangXPGame.results.at(-1).xp, 20);
    assert.equal(saved(s).xp, 90);
});

test('tower: game over pays min(40, 10 + words) + 10 per clear; tower coins unchanged', () => {
    const s = makeStorage(), app = startApp(s);
    const r = playTower(app, 30, 2, 5000);
    assert.equal(r.xp, 60);
    assert.equal(saved(s).coins, 100 + 500);
    assert.ok(app.calls.includes('towerGameOver'));
    assert.equal(playTower(app, 0, 3).saved, false); // no words, no XP
});

// ---- diamonds, duplicates, saving ---------------------------------------------

test('one level = 15 diamonds, two levels in one reward = 30, saved together with the XP', () => {
    const s = makeStorage(), app = startApp(s);
    app.gameState.diamonds = 7;
    const a = playTower(app, 30, 6);        // 100 XP -> level 2
    assert.equal(a.diamonds, 15);
    assert.deepEqual([saved(s).diamonds, saved(s).level], [22, 2]);
    const b = playTower(app, 30, 31);       // +350 = 450 -> level 4
    assert.equal(b.levelsGained, 2);
    assert.equal(b.diamonds, 30);
    const st = saved(s);
    assert.deepEqual([st.diamonds, st.level, st.xp, st.xpToNextLevel], [52, 4, 0, 250]);
    assert.equal(st.xpProgress.gemsPaid[app.ZbangXPGame.installId()], 45);
});

test('a reward whose save fails is rolled back and reported as not saved', () => {
    const s = makeStorage(), app = startApp(s);
    playSingle(app, 1);
    const before = s.getItem('zabangState');
    const mem = JSON.stringify([app.gameState.xpProgress, app.gameState.diamonds, app.gameState.level, app.gameState.xp]);
    app.startSinglePlayer();
    app.currentGame.foundWords = words(5);
    s.failWrites = true;
    try { app.endRound('single'); } catch (e) { /* the game's own save fails too */ }
    s.failWrites = false;
    // (the stand-in endRound threw before the hook; call the grant path directly as well)
    s.failWrites = true;
    const r = app.ZbangXPGame.grant({ mode: 'tower', completed: true, wordsFound: 30, clears: 6 }, 'tower:fail', Date.now());
    s.failWrites = false;
    assert.equal(r.saved, false);
    assert.equal(r.reason, 'save-failed');
    assert.equal(s.getItem('zabangState'), before);
    assert.equal(JSON.stringify([app.gameState.xpProgress, app.gameState.diamonds, app.gameState.level, app.gameState.xp]), mem);
    // and the same reward can still be earned once storage works again
    assert.equal(app.ZbangXPGame.grant({ mode: 'tower', completed: true, wordsFound: 30, clears: 6 }, 'tower:fail', Date.now()).saved, true);
});

test('closing the app: before the save nothing is kept, after it everything is', () => {
    const s = makeStorage(), app = startApp(s);
    s.failWrites = true;                    // the app "dies" before the write lands
    app.ZbangXPGame.grant({ mode: 'tower', completed: true, wordsFound: 30, clears: 6 }, 'k-lost', Date.now());
    s.failWrites = false;
    let reopened = startApp(s);
    assert.equal(reopened.gameState.level, 1);
    assert.equal(reopened.gameState.diamonds, 0);
    reopened.ZbangXPGame.grant({ mode: 'tower', completed: true, wordsFound: 30, clears: 6 }, 'k-kept', Date.now());
    reopened = startApp(s);                 // closed right after the save
    assert.deepEqual([reopened.gameState.level, reopened.gameState.diamonds], [2, 15]);
    assert.equal(reopened.gameState.xpProgress.gemsPaid[reopened.ZbangXPGame.installId()], 15);
});

test('reopening the app: same install id, and an already-paid event can\'t pay again', () => {
    const s = makeStorage(), app = startApp(s);
    app.currentGame.foundWords = words(2);
    app.showMultiplayerResult({ matchType: 'random', roundStartTime: 1792849500000, winnerId: 'me', loserId: 'o', players: { me: { eliminated: false } } });
    const id = app.ZbangXPGame.installId();
    const again = startApp(s);
    assert.equal(again.ZbangXPGame.installId(), id);
    again.currentGame.foundWords = words(2);
    again.showMultiplayerResult({ matchType: 'random', roundStartTime: 1792849500000, winnerId: 'me', loserId: 'o', players: { me: { eliminated: false } } });
    assert.equal(again.ZbangXPGame.results.at(-1).reason, 'duplicate');
    assert.equal(saved(s).xp, 35);
});

test('an existing 1.1 save loads with nothing reset and no retroactive diamonds', () => {
    const old = { playerName: 'ותיק', coins: 4321, diamonds: 77, level: 1, xp: 0, xpToNextLevel: 100, inventory: { hint: 9 }, trophies: 640 };
    const s = makeStorage(), app = startApp(s, { initialState: old });
    for (const k of ['coins', 'diamonds', 'level', 'trophies']) assert.equal(app.gameState[k], old[k], k);
    assert.deepEqual(app.gameState.inventory, { hint: 9 });
    assert.ok(app.gameState.xpProgress);
    playSingle(app, 1); // 21 XP - no level
    assert.equal(saved(s).diamonds, 77);
});

// ---- feature flag ---------------------------------------------------------------

test('flag off: no XP is earned, but saved progress is kept and still shown', () => {
    const s = makeStorage(), app = startApp(s);
    playTower(app, 30, 6); // level 2, 15 diamonds
    const off = startApp(s, { query: '?xp=off' });
    assert.equal(off.ZbangXPGame.mode, 'off');
    assert.equal(off.gameState.level, 2);
    off.startSinglePlayer(); off.currentGame.foundWords = words(5); off.endRound('single');
    assert.equal(off.ZbangXPGame.results.length, 0);
    assert.equal(saved(s).level, 2);
    assert.equal(saved(s).xpProgress.xp[off.ZbangXPGame.installId()], 100);
    const on = startApp(s);
    assert.equal(playSingle(on, 1).saved, true);   // and back on again
});

test('dry run never saves any XP or diamonds', () => {
    const s = makeStorage(), app = startApp(s, { query: '?xp=dryrun' });
    playTower(app, 30, 6, 1000);                 // the game itself still saves its tower coins
    assert.equal(app.ZbangXPGame.log.length, 1);
    assert.equal(app.ZbangXPGame.log[0].xp, 100);
    const st = saved(s);
    assert.equal(st.coins, 200);
    assert.deepEqual([st.level, st.diamonds, st.xp], [1, 0, 0]);
    assert.deepEqual(st.xpProgress.xp, {});
    assert.equal(app.ZbangXPGame.results.length, 0);
});

// ---- cloud backup (real cloudsave.js functions, no network) --------------------

test('the backup carries the XP counters, not the event list', () => {
    const s = makeStorage(), app = startApp(s);
    playTower(app, 30, 6);
    const cloud = app.collectCloudState();
    assert.deepEqual(Object.keys(cloud.xpProgress).sort(), ['baseLevel', 'gemsPaid', 'xp']);
    assert.equal(cloud.level, 2);
    assert.equal(cloud.diamonds, 15);
});

test('restore of a backup that already holds level diamonds: wallet as backed up, no level paid again', () => {
    const phone = makeStorage(), a = startApp(phone);
    playTower(a, 30, 6);                       // level 2, 15 diamonds
    const backup = JSON.parse(JSON.stringify(a.collectCloudState()));
    const fresh = makeStorage(), b = startApp(fresh);   // reinstall: new install
    b.applyCloudState(backup);
    assert.deepEqual([b.gameState.level, b.gameState.diamonds], [2, 15]);
    assert.notEqual(b.ZbangXPGame.installId(), a.ZbangXPGame.installId());
    const next = playTower(b, 30, 11);         // +150 = 250 -> level 3
    assert.equal(next.diamonds, 15);
    assert.equal(saved(fresh).diamonds, 30);
});

test('restore of an old backup with no XP data: level and XP stay, nothing added', () => {
    const s = makeStorage(), app = startApp(s);
    playTower(app, 30, 6); playTower(app, 30, 4); // 180 XP, level 2, 15 diamonds
    app.applyCloudState({ playerName: 'x', coins: 1, diamonds: 4, level: 1, inventory: {} }); // from 1.1
    assert.equal(app.gameState.level, 2);
    assert.equal(app.gameState.xp, 80);
    assert.equal(app.gameState.diamonds, 4);         // the restored wallet, as always for a restore
    assert.equal(saved(s).level, 2);
    assert.equal(app.ZbangXP.totalXp(saved(s).xpProgress), 180);
});

test('restore of an OLDER 1.2 backup never lowers the level and never re-creates spent diamonds', () => {
    const s = makeStorage(), app = startApp(s);
    playTower(app, 30, 6);                            // level 2, +15
    const older = JSON.parse(JSON.stringify(app.collectCloudState()));
    playTower(app, 30, 11);                           // level 3, +15 -> 30
    app.gameState.diamonds -= 30; app.saveGameState(); // spent everything
    app.applyCloudState(older);
    assert.equal(app.gameState.level, 3);
    assert.equal(app.gameState.diamonds, older.diamonds); // 15: the backup's wallet, not +30 on top
    const n = playTower(app, 30, 0);                  // more XP, still level 3
    assert.equal(n.diamonds, 0);
});
