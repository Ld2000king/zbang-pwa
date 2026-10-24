// Pure-logic tests for xp-cloud.js (no Firebase needed). The end-to-end
// tests against the emulator are in firebase-test/.
const test = require('node:test');
const assert = require('node:assert/strict');
const XP = require('../xp-engine.js');
const C = require('../xp-cloud.js');

let clock = 1700000000000;
const earn = (p, id, key, xp) => XP.applyReward(p, id, key, xp, (clock += 1000));

test('cloud progress keeps counters and baseLevel, never events', () => {
    const p = earn(XP.createProgress(), 'install-A1', 'k', 120).progress;
    const cloud = C.toCloudProgress(p);
    assert.deepEqual(cloud, { baseLevel: 1, xp: { 'install-A1': 120 }, gemsPaid: { 'install-A1': 15 } });
    assert.deepEqual(C.toCloudProgress(XP.createProgress()), { baseLevel: 1 }); // RTDB drops empty objects
    assert.equal(XP.totalXp(C.fromCloudProgress(cloud)), 120);
    assert.deepEqual(C.fromCloudProgress(undefined).xp, {});
});

test('syncWallet credits missing level diamonds once and never takes any away', () => {
    const p = earn(XP.createProgress(), 'install-A1', 'k', 250).progress; // paid 30
    assert.deepEqual(C.syncWallet(5, 0, p), { diamonds: 35, gemsInBalance: 30, credited: 30 });
    assert.deepEqual(C.syncWallet(35, 30, p), { diamonds: 35, gemsInBalance: 30, credited: 0 });
    assert.deepEqual(C.syncWallet(0, 999, p), { diamonds: 0, gemsInBalance: 999, credited: 0 });
    assert.deepEqual(C.syncWallet(undefined, undefined, XP.createProgress()), { diamonds: 0, gemsInBalance: 0, credited: 0 });
});

test('buildPushValue merges what is in the cloud with the device copy', () => {
    const local = earn(XP.createProgress(), 'install-A1', 'a', 100).progress;
    const current = { state: '{}', progress: { baseLevel: 1, xp: { 'install-B1': 70 }, gemsPaid: {} } };
    const { value, merged } = C.buildPushValue(current, { coins: 1 }, local, 12345, null);
    assert.deepEqual(value.progress.xp, { 'install-A1': 100, 'install-B1': 70 });
    assert.equal(value.updatedAt, 12345);
    assert.equal(value.state, '{"coins":1}');
    assert.equal(value.photo, undefined);
    assert.equal(XP.totalXp(merged), 170);
    assert.ok(merged.events.some(e => e[0] === 'a')); // device events kept locally
    // nothing in the cloud yet (first push / transaction's first try)
    assert.deepEqual(C.buildPushValue(null, {}, local, 1).value.progress.xp, { 'install-A1': 100 });
});

test('restoring a 1.1-era snapshot (no gemsInBalance) onto a device with 1.2 progress keeps its level diamonds', () => {
    const local = earn(XP.createProgress(), 'install-A1', 'a', 250).progress; // level 3, paid 30
    const node = { state: JSON.stringify({ coins: 40, diamonds: 7, level: 1 }) };   // written by 1.1
    const r = C.restoreFromNode(node, local);
    assert.equal(r.state.diamonds, 37);
    assert.equal(r.state.level, 3);
    assert.equal(r.state.coins, 40);
    assert.equal(r.credited, 30);
});

test('permission errors are recognised in both SDK spellings', () => {
    assert.ok(C.isPermissionDenied({ code: 'PERMISSION_DENIED' }));
    assert.ok(C.isPermissionDenied(new Error('permission_denied at /player_saves/x')));
    assert.ok(!C.isPermissionDenied(new Error('network error')));
});
