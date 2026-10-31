// The REAL 1.2 code of this stage (cloudsave.js + xp-engine/state/game) on
// the emulator, next to the REAL 1.1 build-4 cloudsave.js. This stage keeps
// the XP counters inside the existing backup string, so it runs on TODAY's
// rules (nothing to deploy) - checked here on both rule sets.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers.js');
const { XP } = h;

const PASS = 'test-pass-123';
const backupOf = async uid => JSON.parse((await h.owner('GET', `player_saves/${uid}`)).state);

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

test.beforeEach(async () => { await h.resetEmulator(); });
test.after(() => h.disposeDevices());

for (const rules of ['current', 'proposal']) {
    test(`[${rules} rules] backup carries the XP counters; a reinstall restores level and wallet, no level paid twice`, async () => {
        await h.useRules(rules);
        const a = h.deviceV12Real('phoneA');
        const uid = await createAccount(a, `re-${rules}@test.local`);
        assert.equal(a.earn(100).diamonds, 15);           // level 2
        assert.equal(a.earn(150).diamonds, 15);           // level 3
        await a.api.pushCloudSave();
        const backup = await backupOf(uid);
        assert.equal(backup.level, 3);
        assert.equal(backup.diamonds, 30);
        assert.deepEqual(Object.keys(backup.xpProgress).sort(), ['baseLevel', 'gemsPaid', 'xp']);
        assert.equal(backup.xpProgress.gemsPaid[a.ctx.ZbangXPGame.installId()], 30);

        const reinstall = h.deviceV12Real('phoneA-again', ['yes']); // restore the backup
        await signIn(reinstall, `re-${rules}@test.local`, 'שוחזר');
        assert.deepEqual([reinstall.gs.level, reinstall.gs.diamonds], [3, 30]);
        assert.equal(reinstall.earn(100).diamonds, 0);    // 350 XP, still level 3
        assert.equal(reinstall.earn(100).diamonds, 15);   // 450 -> level 4: only this level
        assert.equal(reinstall.gs.diamonds, 45);
        assert.deepEqual(a.ctx.errors, []);
        assert.deepEqual(reinstall.ctx.errors, []);
    });
}

test('two 1.2 devices, one account, "keep this device": XP from both kept, no level paid twice, no top-up', async () => {
    await h.useRules('current');
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'two@test.local');
    a.earn(100);                                     // A: level 2, wallet 15
    await a.api.pushCloudSave();
    const b = h.deviceV12Real('phoneB', ['no']);     // B has its own progress and keeps it
    b.earn(60);                                      // B alone: 60 XP, level 1
    await signIn(b, 'two@test.local', 'ההתקדמות המקומית נשמרה');
    await h.waitFor(async () => Object.keys((await backupOf(uid)).xpProgress.xp).length === 2, 'B pushed merged counters');
    assert.equal(XP.totalXp(b.gs.xpProgress), 160);  // A's 100 + B's 60
    assert.equal(b.gs.level, 2);
    assert.equal(b.gs.diamonds, 0);                  // level 2 was paid on A - not again on B
    assert.equal(b.earn(90).diamonds, 15);           // 250 -> level 3: paid once, on B
    const third = h.deviceV12Real('phoneC', ['yes']);
    await signIn(third, 'two@test.local', 'שוחזר');
    assert.equal(third.gs.level, 2);                 // the cloud has B's push from before level 3
    assert.equal(XP.totalXp(third.gs.xpProgress), 160);
});

test('[today\'s rules] 1.1 overwrites the backup without the counters: the 1.2 phone loses nothing; a fresh install starts at the shown level without extra XP', async () => {
    await h.useRules('current');
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'mix@test.local');
    a.earn(100); a.earn(150);                        // level 3, 30 diamonds
    await a.api.pushCloudSave();
    const old = { playerName: 'p11', coins: 5, diamonds: 30, level: 1, inventory: {} };
    const v11 = h.deviceV11('phone11', old, ['yes']);  // 1.1 restores (gets level 3), then backs up
    await signIn(v11, 'mix@test.local', 'שוחזר');
    assert.equal(old.level, 3);
    await v11.api.pushCloudSave();
    assert.equal((await backupOf(uid)).xpProgress, undefined); // 1.1 dropped the counters (known gap until option B)
    // the 1.2 phone restoring that backup keeps its own progress - no extra XP
    a.ctx.showConfirm = (m, yes) => yes();
    a.api.resolveCloudSaveAfterSignIn();
    await h.waitFor(() => a.ctx.messages.some(m => m.m.includes('שוחזר')), 'A restored');
    assert.equal(a.gs.level, 3);
    assert.equal(XP.totalXp(a.gs.xpProgress), 250);
    // a fresh install restoring it starts at level 3, owing nothing
    const fresh = h.deviceV12Real('fresh', ['yes']);
    await signIn(fresh, 'mix@test.local', 'שוחזר');
    assert.equal(fresh.gs.level, 3);
    assert.equal(fresh.earn(1).diamonds, 0);
    assert.equal(XP.diamondsOwed(fresh.gs.xpProgress) - XP.diamondsPaid(fresh.gs.xpProgress), 0);
});

test('spending after a level-up: a later restore or sync never re-creates the spent diamonds', async () => {
    await h.useRules('current');
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'spend@test.local');
    a.earn(100);                                     // +15
    a.gs.diamonds -= 15; a.ctx.saveGameState();      // spent in the shop
    await a.api.pushCloudSave();
    a.ctx.showConfirm = (m, yes) => yes();
    a.api.resolveCloudSaveAfterSignIn();             // restore its own backup
    await h.waitFor(() => a.ctx.messages.some(m => m.m.includes('שוחזר')), 'restored');
    assert.equal(a.gs.diamonds, 0);
    assert.equal(a.gs.level, 2);
    assert.equal((await backupOf(uid)).diamonds, 0);
});

test('account deletion with the real 1.2 code removes the backup (XP included) and the account', async () => {
    await h.useRules('proposal');
    const a = h.deviceV12Real('phoneA');
    const uid = await createAccount(a, 'del@test.local');
    a.earn(100);
    await a.api.pushCloudSave();
    assert.ok((await backupOf(uid)).xpProgress);
    a.api.cloudDeleteAccount(PASS);
    await h.waitFor(() => a.ctx.messages.some(m => m.m.includes('נמחקו')), 'deleted');
    assert.ok(!JSON.stringify(await h.owner('GET', '')).includes(uid));
    assert.equal(await h.authUserExists(uid), false);
    assert.equal(a.gs.level, 2);                    // this device keeps its own progress, as before
});
