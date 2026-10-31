// Tests for xp-state.js - XP inside the game's save. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const XP = require('../xp-engine.js');
const XS = require('../xp-state.js');

const ID = 'iTestDevice01', OTHER = 'iOtherDevice02';
let clock = 1700000000000;
const T = () => (clock += 1000);
const round = (words = 3) => ({ mode: 'single', singleMode: 'quick', completed: true, wordsFound: words });
const save = (extra = {}) => Object.assign({ playerName: 'p', coins: 340, diamonds: 22, level: 1, xp: 0, xpToNextLevel: 100 }, extra);

function grantInto(gs, key, xp) {
    // a reward sized exactly: a tower round gives min(40, 10+words) + 10 per clear
    const words = Math.min(30, xp - 10), clears = Math.max(0, Math.round((xp - 10 - words) / 10));
    const plan = XS.planGrant(gs, ID, { mode: 'tower', completed: true, wordsFound: words, clears }, key, T());
    if (plan.fields) Object.assign(gs, plan.fields);
    return plan;
}

test('install ids are valid and different', () => {
    const a = XS.newInstallId(), b = XS.newInstallId();
    assert.ok(XS.isValidInstallId(a) && XS.isValidInstallId(b));
    assert.notEqual(a, b);
    assert.ok(!XS.isValidInstallId('a b'));
    assert.ok(!XS.isValidInstallId(null));
});

test('an existing save without XP: nothing reset, nothing paid, level kept', () => {
    const gs = save({ level: 1 });
    XS.ensureXpState(gs);
    assert.equal(gs.level, 1);
    assert.equal(gs.coins, 340);
    assert.equal(gs.diamonds, 22);
    assert.equal(XP.diamondsOwed(gs.xpProgress) - XP.diamondsPaid(gs.xpProgress), 0);
    const legacy = save({ level: 4 }); // (no real save has this, but never lower one)
    XS.ensureXpState(legacy);
    assert.equal(legacy.level, 4);
    assert.equal(legacy.diamonds, 22);
    assert.equal(XP.diamondsOwed(legacy.xpProgress) - XP.diamondsPaid(legacy.xpProgress), 0);
});

test('ensureXpState is idempotent and keeps saved progress', () => {
    const gs = XS.ensureXpState(save());
    grantInto(gs, 'k1', 60);
    const copy = JSON.parse(JSON.stringify(gs));
    XS.ensureXpState(copy); XS.ensureXpState(copy);
    assert.equal(XP.totalXp(copy.xpProgress), 60);
    assert.deepEqual(copy.xpProgress.events, gs.xpProgress.events);
});

test('planGrant: XP and level fields together, gameState untouched until applied', () => {
    const gs = XS.ensureXpState(save());
    const before = JSON.stringify(gs);
    const plan = XS.planGrant(gs, ID, round(3), 'single:1', T());
    assert.equal(JSON.stringify(gs), before);           // nothing written yet
    assert.equal(plan.result.granted, true);
    assert.equal(plan.result.xp, 23);
    assert.deepEqual(Object.keys(plan.fields).sort(), ['diamonds', 'level', 'xp', 'xpProgress', 'xpToNextLevel']);
    assert.equal(plan.fields.xp, 23);
    assert.equal(plan.fields.diamonds, 22);
});

test('one level = exactly 15 diamonds, two levels = 30, onto the existing wallet', () => {
    const gs = XS.ensureXpState(save());
    let p = grantInto(gs, 'a', 100);                    // 1 -> 2
    assert.equal(p.result.diamonds, 15);
    assert.equal(gs.diamonds, 22 + 15);
    assert.equal(gs.level, 2);
    p = grantInto(gs, 'b', 40); p = grantInto(gs, 'c', 40); p = grantInto(gs, 'd', 40); // 220
    p = grantInto(gs, 'e', 60);                        // 280 -> level 3 (+15)
    assert.equal(gs.level, 3);
    assert.equal(gs.diamonds, 22 + 30);
    const gs2 = XS.ensureXpState(save());
    assert.equal(grantInto(gs2, 'x', 60).result.diamonds, 0);    // 60 XP: no level yet
    const big = XS.planGrant(XS.ensureXpState(save()), ID, { mode: 'tower', completed: true, wordsFound: 30, clears: 21 }, 'big', T());
    assert.equal(big.result.xp, 250);                  // 40 + 21 clears x 10
    assert.equal(big.result.levelsGained, 2);
    assert.equal(big.result.diamonds, 30);
    assert.equal(big.fields.diamonds, 22 + 30);
});

test('the same reward key never pays twice, even after the save is reloaded', () => {
    const gs = XS.ensureXpState(save());
    grantInto(gs, 'mp:ROOM:1', 100);
    const reloaded = XS.ensureXpState(JSON.parse(JSON.stringify(gs)));
    const again = XS.planGrant(reloaded, ID, round(3), 'mp:ROOM:1', T());
    assert.equal(again.fields, null);
    assert.equal(again.result.reason, 'duplicate');
});

test('rounds with no words, or not completed, earn nothing', () => {
    const gs = XS.ensureXpState(save());
    assert.equal(XS.planGrant(gs, ID, round(0), 'k', T()).fields, null);
    assert.equal(XS.planGrant(gs, ID, { mode: 'battle', completed: false, wordsFound: 5 }, 'k2', T()).fields, null);
});

test('restoring a backup that already holds level-up diamonds pays nothing again', () => {
    const device = XS.ensureXpState(save());
    grantInto(device, 'a', 100);                          // level 2, wallet 37
    const backup = JSON.parse(JSON.stringify(Object.assign({}, device, { xpProgress: XS.progressForCloud(device.xpProgress) })));
    // restore onto a NEW install (nothing local) - the wallet is the backup's
    const progress = XS.progressAfterRestore(null, backup);
    assert.equal(XP.levelOf(progress), 2);
    assert.equal(backup.diamonds, 37);
    const gs = Object.assign({}, backup, { xpProgress: progress }); XS.syncDerived(gs);
    // the next level pays 15 once more - not 30
    const p = XS.planGrant(gs, 'iNewInstall03', { mode: 'tower', completed: true, wordsFound: 30, clears: 11 }, 'n', T());
    assert.equal(p.result.levelAfter, 3);
    assert.equal(p.result.diamonds, 15);
});

test('restoring an old backup with NO XP data keeps this device\'s level and adds no XP', () => {
    const device = XS.ensureXpState(save());
    grantInto(device, 'a', 60); grantInto(device, 'b', 60); grantInto(device, 'c', 60); // 180 XP, level 2
    const old11 = { coins: 5, diamonds: 3, level: 1 };    // written by 1.1
    const progress = XS.progressAfterRestore(device.xpProgress, old11);
    assert.equal(XP.totalXp(progress), 180);              // not 180 + anything
    assert.equal(XP.levelOf(progress), 2);
    // a 1.1 backup that came from a restored 1.2 save shows level 2 but has no counters:
    const via11 = { coins: 5, diamonds: 3, level: 2 };
    assert.equal(XP.totalXp(XS.progressAfterRestore(device.xpProgress, via11)), 180);
});

test('a fresh device restoring a backup with no XP data starts at its level, owing nothing', () => {
    const progress = XS.progressAfterRestore(XS.ensureXpState(save()).xpProgress, { diamonds: 50, level: 3 });
    assert.equal(XP.levelOf(progress), 3);
    assert.equal(XP.diamondsOwed(progress) - XP.diamondsPaid(progress), 0);
    assert.equal(XP.levelOf(XS.progressAfterRestore(null, { level: 1 })), 1);
});

test('restoring an OLDER backup never lowers the level', () => {
    const device = XS.ensureXpState(save());
    grantInto(device, 'a', 100);
    const older = { diamonds: 22, level: 2, xpProgress: XS.progressForCloud(device.xpProgress) };
    grantInto(device, 'b', 60); grantInto(device, 'c', 60); grantInto(device, 'd', 60); // 280 -> level 3
    const progress = XS.progressAfterRestore(device.xpProgress, older);
    assert.equal(XP.levelOf(progress), 3);
    assert.equal(XP.totalXp(progress), 280);
});

test('spent diamonds are never re-created by a merge or restore', () => {
    const gs = XS.ensureXpState(save({ diamonds: 0 }));
    grantInto(gs, 'a', 100);                              // +15 -> 15
    gs.diamonds -= 15;                                    // spent in the shop
    XS.mergeIntoState(gs, XS.progressForCloud(gs.xpProgress)); // e.g. "keep this device"
    assert.equal(gs.diamonds, 0);
    const p = XS.progressAfterRestore(gs.xpProgress, { diamonds: 0, level: 2, xpProgress: XS.progressForCloud(gs.xpProgress) });
    assert.equal(XP.diamondsOwed(p) - XP.diamondsPaid(p), 0); // nothing left to pay
    const next = XS.planGrant(Object.assign({}, gs, { xpProgress: p }), ID, round(1), 'b', T());
    assert.equal(next.result.diamonds, 0);
});

test('"keep this device" merges the other device\'s XP without paying its levels again', () => {
    const a = XS.ensureXpState(save()), b = XS.ensureXpState(save());
    grantInto(a, 'a1', 100);                              // A: level 2, paid 15 into A's wallet
    const pb = XS.planGrant(b, OTHER, { mode: 'tower', completed: true, wordsFound: 30, clears: 11 }, 'b1', T());
    Object.assign(b, pb.fields);                          // B: 150 XP -> level 2, paid 15 into B's wallet
    const walletA = a.diamonds;
    XS.mergeIntoState(a, XS.progressForCloud(b.xpProgress));
    assert.equal(XP.totalXp(a.xpProgress), 250);
    assert.equal(a.level, 3);
    assert.equal(a.diamonds, walletA);                    // the wallet itself is not touched
    assert.equal(XP.diamondsOwed(a.xpProgress) - XP.diamondsPaid(a.xpProgress), 0); // level 3 already covered
});

test('the backup gets the counters only, never the event list', () => {
    const gs = XS.ensureXpState(save());
    grantInto(gs, 'a', 100);
    const cloud = XS.progressForCloud(gs.xpProgress);
    assert.deepEqual(Object.keys(cloud).sort(), ['baseLevel', 'gemsPaid', 'xp']);
    assert.equal(XS.progressForCloud(undefined), undefined);
});

test('a leftover gemsInBalance field is dropped and never used', () => {
    const gs = XS.ensureXpState(save({ gemsInBalance: 999 }));
    assert.equal(gs.gemsInBalance, undefined);
    assert.equal(gs.diamonds, 22);
});
