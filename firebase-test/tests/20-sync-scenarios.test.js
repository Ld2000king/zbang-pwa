// Two devices, reinstall/restore, old saves, offline, diamonds - 1.2 logic on
// the proposed rules (and the fallback on today's rules).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers.js');
const { XP } = h;

const PASS = 'test-pass-123';
// every level-up reward exactly once: wallet diamonds == 15 x (level - 1)
const owedFor = d => 15 * (XP.levelOf(d.progress) - 1);

async function account(email, installId) {
    const d = new h.DeviceV12('v12', installId);
    await d.app.auth().createUserWithEmailAndPassword(email, PASS);
    return d;
}
async function sameAccount(email, installId) {
    const d = new h.DeviceV12('v12', installId);
    await d.app.auth().signInWithEmailAndPassword(email, PASS);
    return d;
}

test.beforeEach(async () => { await h.resetEmulator(); await h.useRules('proposal'); });
test.after(() => h.disposeDevices());

test('one level = 15 diamonds, two levels at once = 30, stored in the cloud', async () => {
    const d = await account('gems@test.local', 'install-A1');
    assert.equal(d.earn('e1', 100).diamonds, 15);   // 1 -> 2
    assert.equal(d.earn('e2', 350).diamonds, 30);   // 2 -> 4 (needs 150 + 200)
    await d.push();
    const node = await h.owner('GET', 'player_saves/' + d.uid);
    assert.equal(node.progress.gemsPaid['install-A1'], 45);
    assert.equal(node.progress.xp['install-A1'], 450);
    assert.equal(JSON.parse(node.state).diamonds, 45);
    assert.equal(JSON.parse(node.state).level, 4);
});

test('two devices on one account playing at the same time: no XP lost, each level paid once', async () => {
    const a = await account('two@test.local', 'install-A1');
    const b = await sameAccount('two@test.local', 'install-B1');
    a.earn('a1', 100);            // A: level 2, +15
    b.earn('b1', 150);            // B (doesn't know about A yet): level 2, +15
    await Promise.all([a.push(), b.push()]);   // concurrent transactions
    await a.pull(); await b.pull();
    assert.equal(XP.totalXp(a.progress), 250);
    assert.equal(XP.levelOf(a.progress), 3);
    for (const d of [a, b]) assert.equal(d.state.diamonds, owedFor(d));  // 30 each, not 45
    const node = await h.owner('GET', 'player_saves/' + a.uid);
    assert.deepEqual(node.progress.xp, { 'install-A1': 100, 'install-B1': 150 });
    // a reinstall restoring the cloud wallet also ends with exactly 30
    const fresh = await sameAccount('two@test.local', 'install-C1');
    const r = await fresh.restore();
    assert.equal(r.state.diamonds, 30);
});

test('reinstall + restore: level and diamonds come back, nothing paid twice', async () => {
    const a = await account('re@test.local', 'install-A1');
    a.earn('a1', 250); // level 3, +30
    a.state.coins = 777;
    await a.push();
    const reinstalled = await sameAccount('re@test.local', 'install-A2'); // new install, empty local data
    const r = await reinstalled.restore();
    assert.equal(r.state.level, 3);
    assert.equal(r.state.diamonds, 30);
    assert.equal(r.state.coins, 777);
    assert.equal(r.credited, 0);
    assert.equal(reinstalled.earn('a2', 50).diamonds, 0);    // 300 XP, still level 3
    assert.equal(reinstalled.earn('a3', 150).diamonds, 15);  // 450 -> level 4, only that level
    assert.equal(reinstalled.state.diamonds, 45);
});

test('a device with an OLD local save ("keep this device") cannot lower the cloud progress', async () => {
    const a = await account('old@test.local', 'install-A1');
    a.earn('a1', 100); await a.push();                      // level 2
    const stale = await sameAccount('old@test.local', 'install-B1');
    await stale.restore();                                  // B is now a copy at level 2
    a.earn('a2', 350); await a.push();                      // A goes on to level 4
    await stale.push();                                     // B pushes its stale copy
    const node = await h.owner('GET', 'player_saves/' + a.uid);
    assert.equal(node.progress.xp['install-A1'], 450);      // not lowered
    assert.equal(XP.levelOf(stale.progress), 4);            // B picked up the newer progress
    assert.equal(stale.state.diamonds, owedFor(stale));     // and the missing diamonds, once
});

test('restoring a wallet snapshot older than the progress adds the missing level diamonds once', async () => {
    const a = await account('snap@test.local', 'install-A1');
    a.earn('a1', 100); await a.push();               // cloud wallet 15
    const b = await sameAccount('snap@test.local', 'install-B1');
    b.earn('b1', 50);                               // B: 50 XP, no level yet
    a.earn('a2', 150);                              // A: 250 -> level 3 (+15), not pushed yet
    await b.push();                                 // cloud state = B's wallet (0 level diamonds)
    await a.push();                                 // A's progress merges in, A's state written
    await b.push();                                 // B writes its (older) wallet again last
    const fresh = await sameAccount('snap@test.local', 'install-C1');
    const r = await fresh.restore();
    assert.equal(XP.levelOf(r.progress), 3);        // 300 XP
    assert.equal(r.state.diamonds, 30);             // the 30 level diamonds, exactly once
});

test('offline: rewards earned without network are kept and merged after reconnecting', async () => {
    const a = await account('off@test.local', 'install-A1');
    const b = await sameAccount('off@test.local', 'install-B1');
    await a.push();
    a.app.database().goOffline();
    a.earn('a1', 120);                              // earned offline: level 2, +15
    let settled = false;
    const pending = a.push().then(r => { settled = true; return r; }); // waits for the network
    await new Promise(r => setTimeout(r, 400));
    assert.equal(settled, false, 'push must wait while offline');
    b.earn('b1', 30);
    await b.push();                                 // B goes ahead meanwhile
    a.app.database().goOnline();
    await pending;
    await a.pull(); await b.pull();
    assert.equal(XP.totalXp(a.progress), 150);
    assert.equal(XP.totalXp(b.progress), 150);
    assert.equal(a.state.diamonds, 15);
    assert.equal(b.state.diamonds, 15);
});

test('the same event never pays twice - not after a push, a restore, or a pull', async () => {
    const a = await account('dup@test.local', 'install-A1');
    const t = h.nextTime();
    let r = XP.applyReward(a.progress, a.installId, 'mp:ROOM:1', 100, t);
    a.progress = r.progress; a.state.diamonds += r.diamonds; a.state.gemsInBalance += r.diamonds;
    await a.push();
    await a.pull();
    const restored = XP.mergeProgress(a.progress, XP.createProgress());
    r = XP.applyReward(restored, a.installId, 'mp:ROOM:1', 100, t);
    assert.equal(r.duplicate, true);
    assert.equal(r.xpGained, 0);
    assert.equal(XP.totalXp(a.progress), 100);
});

test('on TODAY\'s rules (nothing deployed) 1.2 falls back to the old backup and keeps working', async () => {
    await h.useRules('current');
    const a = await account('today@test.local', 'install-A1');
    a.earn('a1', 100);
    const r = await a.push();
    assert.equal(r.mode, 'state-only');
    const node = await h.owner('GET', 'player_saves/' + a.uid);
    assert.equal(node.progress, undefined);
    assert.equal(JSON.parse(node.state).level, 2);       // 1.1 would still show the level
    assert.equal(XP.totalXp(a.progress), 100);           // progress kept on the device
    // once the new rules are live, the next push stores the progress too
    await h.useRules('proposal');
    assert.equal((await a.push()).mode, 'progress');
    const after = await h.owner('GET', 'player_saves/' + a.uid);
    assert.equal(after.progress.xp['install-A1'], 100);
});

test('[control] on today\'s rules a 1.1 device DOES overwrite the level in the backup - the risk the new rule removes', async () => {
    await h.useRules('current');
    const a = await account('ctl@test.local', 'install-A1');
    a.earn('a1', 260); await a.push();                        // state-only, level 3
    const gs = { playerName: 'p2', coins: 1, diamonds: 0, level: 1, inventory: {} };
    const d11 = h.deviceV11('v11', gs, ['no']);               // keep its own local copy
    d11.api.cloudSignIn('ctl@test.local', PASS);
    await h.waitFor(() => d11.ctx.messages.some(m => m.m.includes('ההתקדמות המקומית נשמרה')), 'keep-local');
    await h.waitFor(async () => JSON.parse((await h.owner('GET', 'player_saves/' + a.uid)).state).level === 1, 'overwrite');
});
