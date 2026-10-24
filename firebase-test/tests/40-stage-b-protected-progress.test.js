// Stage B: the REAL 1.2 cloudsave.js writing XP into player_saves/<uid>/progress
// with a merging transaction, a token check before every write, and a
// read-only pull on opening - next to the REAL 1.1 build-4 cloudsave.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers.js');
const { XP } = h;

const PASS = 'test-pass-123';
const node = async uid => h.owner('GET', `player_saves/${uid}`);

async function createAccount(device, email) {
    await device.app.auth().signInAnonymously();
    device.api.cloudCreateAccount(email, PASS);
    await h.waitFor(() => device.ctx.messages.some(m => m.m.includes('החשבון נוצר')), 'account created');
    return device.app.auth().currentUser.uid;
}
async function signIn(device, email, word) {
    device.api.cloudSignIn(email, PASS);
    await h.waitFor(() => device.ctx.messages.some(m => m.m.includes(word)), 'sign-in: ' + word);
}
const unpaid = d => XP.diamondsOwed(d.gs.xpProgress) - XP.diamondsPaid(d.gs.xpProgress);

test.beforeEach(async () => { await h.resetEmulator(); await h.useRules('proposal'); });
test.after(() => h.disposeDevices());

test('a 1.2 save writes the protected progress node through the merging transaction', async () => {
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'node@test.local');
    a.earn(100);
    await a.api.pushCloudSave();
    const n = await node(uid);
    const id = a.ctx.ZbangXPGame.installId();
    assert.equal(n.progress.xp[id], 100);
    assert.equal(n.progress.gemsPaid[id], 15);
    assert.equal(JSON.parse(n.state).xpProgress.xp[id], 100);  // the copy older rules can carry
    assert.equal(a.api.CloudSave.progressNodeRefused, undefined);
    assert.deepEqual(a.ctx.errors, []);
});

test('two 1.2 devices saving at the same moment: both installs\' XP kept, no level paid twice, no top-up', async () => {
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'two@test.local');
    await a.api.pushCloudSave();
    const b = h.deviceV12Real('phoneB', ['no']);
    await signIn(b, 'two@test.local', 'ההתקדמות המקומית נשמרה');
    a.earn(100);                                  // A: level 2, +15 on A
    b.earn(60);                                   // B: 60 XP, nothing paid
    await Promise.all([a.api.pushCloudSave(), b.api.pushCloudSave()]);
    // whichever write landed first didn't know the other yet: one more sync each
    // (the next save, or the pull on opening) brings both up to date
    await a.api.pushCloudSave();
    await b.api.pushCloudSave();
    const ids = [a, b].map(d => d.ctx.ZbangXPGame.installId());
    const n = await node(uid);
    assert.equal(n.progress.xp[ids[0]], 100);
    assert.equal(n.progress.xp[ids[1]], 60);
    for (const d of [a, b]) assert.equal(XP.totalXp(d.gs.xpProgress), 160);
    assert.deepEqual([a.gs.diamonds, b.gs.diamonds], [15, 0]);
    assert.equal(unpaid(a), 0);
    assert.equal(unpaid(b), 0);
});

test('a level reached only by merging two devices is paid once, on the next reward, and shown as paid', async () => {
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'merge@test.local');
    await a.api.pushCloudSave();
    const b = h.deviceV12Real('phoneB', ['no']);
    await signIn(b, 'merge@test.local', 'ההתקדמות המקומית נשמרה');
    a.earn(60); b.earn(60);                       // 60 + 60: neither reaches level 2 alone
    await a.api.pushCloudSave(); await b.api.pushCloudSave(); await a.api.pushCloudSave();
    assert.equal(a.gs.level, 2);                  // merged: 120 XP
    assert.equal(a.gs.diamonds, 0);               // nothing paid by merging itself
    const r = a.ctx.ZbangXPGame.grant({ mode: 'single', singleMode: 'quick', completed: true, wordsFound: 1 }, 'single:after-merge', h.nextTime());
    assert.equal(r.diamonds, 15);                 // the merged level, paid once with the next reward
    assert.equal(r.levelsGained, 0);
    await a.api.pushCloudSave(); await b.api.pushCloudSave();
    const rb = b.ctx.ZbangXPGame.grant({ mode: 'single', singleMode: 'quick', completed: true, wordsFound: 1 }, 'single:b-after', h.nextTime());
    assert.equal(rb.diamonds, 0);                 // not paid again on B
    assert.equal(XP.diamondsPaid(XP.normalizeProgress((await node(uid)).progress)), 15); // one level, paid once in the cloud
});

test('1.1 build-4: restores a 1.2 save (sees the level), its backups are refused, the progress node stays', async () => {
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'mix@test.local');
    a.earn(100); a.earn(150);                     // level 3
    await a.api.pushCloudSave();
    const before = await node(uid);
    const gs = { playerName: 'p11', coins: 5, diamonds: 0, level: 1, inventory: {} };
    const v11 = h.deviceV11('phone11', gs, ['yes']);
    await signIn(v11, 'mix@test.local', 'שוחזר');
    assert.equal(gs.level, 3);
    await v11.api.pushCloudSave();
    assert.ok(v11.ctx.errors.some(e => /permission/i.test(e)));
    const after = await node(uid);
    assert.deepEqual(after.progress, before.progress);
    assert.equal(after.state, before.state);
});

test('account deleted from 1.1 build-4: everything removed, and a 1.2 phone still signed in can NOT write it back', async () => {
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'del@test.local');
    a.earn(100);
    await a.api.pushCloudSave();
    assert.ok((await node(uid)).progress);
    const gs = { playerName: 'x', coins: 0, diamonds: 0, level: 1, inventory: {} };
    const v11 = h.deviceV11('phone11', gs, ['yes']);
    await signIn(v11, 'del@test.local', 'שוחזר');
    v11.api.cloudDeleteAccount(PASS);
    await h.waitFor(() => v11.ctx.messages.some(m => m.m.includes('נמחקו')), 'deleted on 1.1');
    assert.equal(await node(uid), null);
    assert.equal(await h.authUserExists(uid), false);
    // phone A (1.2) is still signed in with a cached token and earns more
    a.earn(60);
    await a.api.pushCloudSave();
    assert.ok(!JSON.stringify(await h.owner('GET', '')).includes(uid), 'nothing written back');
    await h.waitFor(() => a.ctx.messages.some(m => m.m.includes('החשבון הזה נמחק')), 'phone A told');
    await h.waitFor(() => a.app.auth().currentUser && a.app.auth().currentUser.isAnonymous, 'phone A back to anonymous');
    assert.equal(a.gs.level, 2);                  // the device keeps its own progress
});

test('opening the app pulls the XP other devices saved - read only, wallet untouched', async () => {
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'pull@test.local');
    await a.api.pushCloudSave();
    const b = h.deviceV12Real('phoneB', ['no']);
    await signIn(b, 'pull@test.local', 'ההתקדמות המקומית נשמרה');
    await h.waitFor(async () => (await node(uid)).updatedAt, 'B saved');
    a.earn(100); a.earn(150);                     // A: level 3, 30 diamonds on A
    await a.api.pushCloudSave();
    const stateBefore = (await node(uid)).state;
    b.api.CloudSave.pulledFor = null;             // as on a fresh launch
    await b.api.pullCloudProgress();
    assert.equal(b.gs.level, 3);
    assert.equal(b.gs.diamonds, 0);               // B's wallet: no top-up
    assert.equal(unpaid(b), 0);                   // and nothing owed on B for A's levels
    assert.equal((await node(uid)).state, stateBefore); // the pull wrote nothing
});

test('reinstall: restoring takes the protected progress; the next level pays once', async () => {
    const a = h.deviceV12Real('phoneA');
    await createAccount(a, 're@test.local');
    a.earn(100); a.earn(150);                     // level 3, 30
    await a.api.pushCloudSave();
    const fresh = h.deviceV12Real('reinstalled', ['yes']);
    await signIn(fresh, 're@test.local', 'שוחזר');
    assert.deepEqual([fresh.gs.level, fresh.gs.diamonds], [3, 30]);
    assert.equal(fresh.earn(100).diamonds, 0);
    assert.equal(fresh.earn(100).diamonds, 15);   // 450 -> level 4
    assert.equal(fresh.gs.diamonds, 45);
});

test('offline: a save made without network waits, then merges with what another device saved meanwhile', async () => {
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'off@test.local');
    await a.api.pushCloudSave();
    const b = h.deviceV12Real('phoneB', ['no']);
    await signIn(b, 'off@test.local', 'ההתקדמות המקומית נשמרה');
    a.app.database().goOffline();
    a.earn(100);
    let done = false;
    const pending = a.api.pushCloudSave().then(() => { done = true; });
    await new Promise(r => setTimeout(r, 400));
    assert.equal(done, false);
    b.earn(40); await b.api.pushCloudSave();
    a.app.database().goOnline();
    await pending;
    const n = await node(uid);
    const [ia, ib] = [a, b].map(d => d.ctx.ZbangXPGame.installId());
    assert.deepEqual([n.progress.xp[ia], n.progress.xp[ib]], [100, 40]);
    assert.equal(XP.totalXp(a.gs.xpProgress), 140);
});

test('spent diamonds stay spent through restore, pull and merge', async () => {
    const a = h.deviceV12Real('phoneA');
    await createAccount(a, 'spend@test.local');
    a.earn(100);                                  // +15
    a.gs.diamonds -= 15; a.ctx.saveGameState();   // spent
    await a.api.pushCloudSave();
    a.api.CloudSave.pulledFor = null;
    await a.api.pullCloudProgress();
    assert.equal(a.gs.diamonds, 0);
    a.ctx.showConfirm = (m, yes) => yes();
    a.api.resolveCloudSaveAfterSignIn();
    await h.waitFor(() => a.ctx.messages.some(m => m.m.includes('שוחזר')), 'restored');
    assert.equal(a.gs.diamonds, 0);
    assert.equal(a.earn(1).diamonds, 0);
});

test('[today\'s rules] the protected write is refused once, then the session uses the old backup only', async () => {
    await h.useRules('current');
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'today@test.local');
    a.earn(100);
    await a.api.pushCloudSave();
    assert.equal(a.api.CloudSave.progressNodeRefused, true);
    const n = await node(uid);
    assert.equal(n.progress, undefined);
    assert.equal(JSON.parse(n.state).xpProgress.xp[a.ctx.ZbangXPGame.installId()], 100);
    a.earn(50);                                   // more XP, still saved
    await a.api.pushCloudSave();
    assert.equal(XP.totalXp(JSON.parse((await node(uid)).state).xpProgress), XP.totalXp(a.gs.xpProgress));
});
