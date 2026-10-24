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

test('restoring from the cloud node: wallet as backed up, progress merged, no level paid again', () => {
    const local = earn(XP.createProgress(), 'install-A1', 'a', 250).progress; // level 3, paid 30
    // a 1.1-era snapshot: no XP data at all -> this device's progress stays, nothing is added
    let r = C.restoreFromNode({ state: JSON.stringify({ coins: 40, diamonds: 7, level: 1 }) }, local);
    assert.equal(r.state.diamonds, 7);
    assert.equal(r.state.level, 3);
    assert.equal(XP.totalXp(r.progress), 250);
    assert.equal(r.state.gemsInBalance, undefined);
    // a 1.2 node with protected counters from another install
    r = C.restoreFromNode({ state: JSON.stringify({ diamonds: 15, level: 2 }),
        progress: { baseLevel: 1, xp: { 'install-B1': 150 }, gemsPaid: { 'install-B1': 15 } } }, local);
    assert.equal(XP.totalXp(r.progress), 400);   // 250 + 150
    assert.equal(r.state.level, 3);
    assert.equal(r.state.diamonds, 15);          // the backed-up wallet, nothing topped up
    assert.equal(XP.diamondsOwed(r.progress) - XP.diamondsPaid(r.progress), -15); // paid ahead, absorbed later
});

test('permission errors are recognised in both SDK spellings', () => {
    assert.ok(C.isPermissionDenied({ code: 'PERMISSION_DENIED' }));
    assert.ok(C.isPermissionDenied(new Error('permission_denied at /player_saves/x')));
    assert.ok(!C.isPermissionDenied(new Error('network error')));
});
