// Can a normal player reach the three rule gaps (delete one counter, rewrite
// a map without an install, delete + recreate the save lower) through the
// game itself? Runs the REAL 1.2 and 1.1 build-4 cloud code through every
// flow that writes the save and checks, after each step, that no counter in
// the cloud disappeared or went down.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers.js');

const PASS = 'test-pass-123';
// counters "other devices" already saved; this account's devices must keep them
const OTHERS = { xp: { 'install-X1': 300, 'install-Y2': 120 }, gemsPaid: { 'install-X1': 30, 'install-Y2': 15 } };

async function checkNothingDropped(uid, step) {
    const p = (await h.owner('GET', `player_saves/${uid}/progress`)) || {};
    for (const map of ['xp', 'gemsPaid']) {
        for (const [id, v] of Object.entries(OTHERS[map])) {
            assert.ok(p[map] && p[map][id] >= v, `${step}: ${map}.${id} dropped or lowered (${JSON.stringify(p[map])})`);
        }
    }
}

async function seededAccount(email) {
    const a = h.deviceV12Real('phoneA');
    await a.app.auth().signInAnonymously();
    a.api.cloudCreateAccount(email, PASS);
    await h.waitFor(() => a.ctx.messages.some(m => m.m.includes('החשבון נוצר')), 'account created');
    const uid = a.app.auth().currentUser.uid;
    // the cloud already holds two other installs' counters (an older backup state)
    const node = await h.owner('GET', `player_saves/${uid}`);
    await h.owner('PUT', `player_saves/${uid}/progress`, {
        baseLevel: 1,
        xp: Object.assign({}, (node.progress || {}).xp, OTHERS.xp),
        gemsPaid: Object.assign({}, (node.progress || {}).gemsPaid, OTHERS.gemsPaid)
    });
    return { a, uid };
}

test.beforeEach(async () => { await h.resetEmulator(); await h.useRules('proposal'); });
test.after(() => h.disposeDevices());

test('every 1.2 flow that writes the save keeps all counters (never drops, never lowers)', async () => {
    const { a, uid } = await seededAccount('flows@test.local');
    a.earn(100); await a.api.pushCloudSave();                       await checkNothingDropped(uid, 'save after a round');
    a.api.CloudSave.pulledFor = null; await a.api.pullCloudProgress(); await checkNothingDropped(uid, 'pull on opening');
    await a.api.pushCloudSave();                                    await checkNothingDropped(uid, 'save after pull');

    // restore the backup ("restore the cloud copy"), then keep playing
    a.ctx.showConfirm = (m, yes) => yes();
    a.api.resolveCloudSaveAfterSignIn();
    await h.waitFor(() => a.ctx.messages.some(m => m.m.includes('שוחזר')), 'restored');
    await a.api.pushCloudSave();                                    await checkNothingDropped(uid, 'restore + save');

    // a second phone whose own (older, smaller) progress is kept: "keep this device"
    const b = h.deviceV12Real('phoneB', ['no']);
    b.earn(40);
    b.api.cloudSignIn('flows@test.local', PASS);
    await h.waitFor(() => b.ctx.messages.some(m => m.m.includes('ההתקדמות המקומית נשמרה')), 'keep local');
    await h.waitFor(async () => (await h.owner('GET', `player_saves/${uid}/progress/xp`))[b.ctx.ZbangXPGame.installId()], 'B saved');
    await checkNothingDropped(uid, 'second phone keeps its own copy');

    // a reinstall restoring the backup, then saving
    const re = h.deviceV12Real('reinstall', ['yes']);
    re.api.cloudSignIn('flows@test.local', PASS);
    await h.waitFor(() => re.ctx.messages.some(m => m.m.includes('שוחזר')), 'reinstall restored');
    re.earn(50); await re.api.pushCloudSave();                      await checkNothingDropped(uid, 'reinstall + save');

    // two phones saving at the same instant
    a.earn(40); b.earn(40);
    await Promise.all([a.api.pushCloudSave(), b.api.pushCloudSave()]); await checkNothingDropped(uid, 'simultaneous saves');

    // a session that fell back to the old backup (as on today's rules) can't drop them either
    b.api.CloudSave.progressNodeRefused = true;
    b.earn(40); await b.api.pushCloudSave();                        await checkNothingDropped(uid, 'old-style save attempt');
    assert.ok(b.ctx.errors.some(e => /permission/i.test(e)), 'the old-style save was refused');
});

test('1.1 build-4 flows (restore, backup, "keep this device") never drop a counter', async () => {
    const { a, uid } = await seededAccount('v11@test.local');
    a.earn(100); await a.api.pushCloudSave();
    const gs = { playerName: 'p11', coins: 1, diamonds: 0, level: 1, inventory: {} };
    const v11 = h.deviceV11('phone11', gs, ['yes']);
    v11.api.cloudSignIn('v11@test.local', PASS);
    await h.waitFor(() => v11.ctx.messages.some(m => m.m.includes('שוחזר')), '1.1 restored');
    await v11.api.pushCloudSave();                                  await checkNothingDropped(uid, '1.1 backup');
    const v11b = h.deviceV11('phone11b', { playerName: 'q', coins: 9, diamonds: 9, level: 1, inventory: {} }, ['no']);
    v11b.api.cloudSignIn('v11@test.local', PASS);
    await h.waitFor(() => v11b.ctx.messages.some(m => m.m.includes('ההתקדמות המקומית נשמרה')), '1.1 keep local');
    await h.waitFor(() => v11b.ctx.errors.some(e => /permission/i.test(e)), 'refused');
    await checkNothingDropped(uid, '1.1 keep local');
});

test('the only flow that deletes the save is account deletion - and then nothing is recreated', async () => {
    const { a, uid } = await seededAccount('gone@test.local');
    const b = h.deviceV12Real('phoneB', ['no']);                    // a second phone stays signed in
    b.api.cloudSignIn('gone@test.local', PASS);
    await h.waitFor(() => b.ctx.messages.some(m => m.m.includes('ההתקדמות המקומית נשמרה')), 'B in');
    a.api.cloudDeleteAccount(PASS);
    await h.waitFor(() => a.ctx.messages.some(m => m.m.includes('נמחקו')), 'deleted');
    b.earn(100); await b.api.pushCloudSave();                       // B tries to save afterwards
    assert.equal(await h.owner('GET', `player_saves/${uid}`), null, 'nothing recreated');
    assert.equal(await h.authUserExists(uid), false);
});
