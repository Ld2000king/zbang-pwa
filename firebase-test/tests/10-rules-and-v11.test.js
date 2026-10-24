// Proposed 1.2 rules, checked against the REAL 1.1 build-4 cloud-save code.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers.js');

const PASS = 'test-pass-123';
const isDenied = e => /permission/i.test(String((e && (e.code || e.message)) || ''));
const TS = () => h.firebase.database.ServerValue.TIMESTAMP;

async function signUp(app, email) {
    return (await app.auth().createUserWithEmailAndPassword(email, PASS)).user.uid;
}

// a 1.2 player with some progress already in the cloud
async function playerWithProgress(email, xp = 120) {
    const d = new h.DeviceV12('v12', 'install-A1');
    await signUp(d.app, email);
    d.state.playerId = 'pid-' + d.uid.slice(0, 8);
    d.earn('single:1', xp);
    const r = await d.push();
    assert.equal(r.mode, 'progress');
    return d;
}

test.beforeEach(async () => { await h.resetEmulator(); await h.useRules('proposal'); });
test.after(() => h.disposeDevices());

for (const rules of ['current', 'proposal']) {
    test(`[${rules} rules] 1.1 build-4 code: create account + backups work on an account 1.2 never touched`, async () => {
        await h.useRules(rules);
        const gs = { playerName: 'old', coins: 500, diamonds: 7, level: 1, inventory: { hint: 3 }, playerId: 'p-old' };
        const d = h.deviceV11('v11', gs);
        await d.app.auth().signInAnonymously();
        const uid = d.app.auth().currentUser.uid;
        d.api.cloudCreateAccount('old@test.local', PASS);
        await h.waitFor(() => d.ctx.messages.some(m => m.type === 'success'), 'account created');
        let node = await h.owner('GET', 'player_saves/' + uid);
        assert.equal(JSON.parse(node.state).coins, 500);
        gs.coins = 650;
        await d.api.pushCloudSave();
        node = await h.owner('GET', 'player_saves/' + uid);
        assert.equal(JSON.parse(node.state).coins, 650);
        assert.deepEqual(d.ctx.errors, []);
    });
}

test('nobody can read or write another player\'s save', async () => {
    const a = h.newDevice('a'), b = h.newDevice('b');
    const uidA = await signUp(a, 'a@test.local');
    await signUp(b, 'b@test.local');
    await a.database().ref('player_saves/' + uidA).set({ state: '{}', updatedAt: 1 });
    await assert.rejects(b.database().ref('player_saves/' + uidA).once('value'), isDenied);
    await assert.rejects(b.database().ref('player_saves/' + uidA).set({ state: '{}', updatedAt: 2 }), isDenied);
    await assert.rejects(b.database().ref('player_saves/' + uidA + '/progress/xp/install-B1').set(5), isDenied);
});

test('1.2 progress is stored; counters can only go up; bad shapes are refused', async () => {
    const d = await playerWithProgress('p@test.local', 120);
    const p = d.ref().child('progress');
    assert.equal((await h.owner('GET', `player_saves/${d.uid}/progress/xp/install-A1`)), 120);
    await assert.rejects(p.child('xp/install-A1').set(50), isDenied, 'lower XP');
    await p.child('xp/install-A1').set(200);                              // higher is fine
    await assert.rejects(p.child('gemsPaid/install-A1').set(0), isDenied, 'lower diamonds paid');
    await assert.rejects(p.child('xp/bad id').set(10), isDenied, 'bad install id');
    await assert.rejects(p.child('xp/install-A2').set('ten'), isDenied, 'non-number');
    await assert.rejects(p.child('xp/install-A2').set(-1), isDenied, 'negative');
    await assert.rejects(p.child('extra').set(1), isDenied, 'unknown field');
    await assert.rejects(p.child('baseLevel').set(0), isDenied, 'baseLevel down');
    await assert.rejects(d.ref().child('state').set('x'.repeat(20001)), isDenied, 'state too long');
    // a whole-save write that keeps progress is fine; one that drops it is not
    await d.ref().update({ state: '{"a":1}', updatedAt: TS() });
    await assert.rejects(d.ref().set({ state: '{}', updatedAt: 5 }), isDenied, 'drops progress');
    await assert.rejects(d.ref().child('progress').remove(), isDenied, 'removes progress');
});

test('1.1 build-4 code restores a 1.2 backup (shows the level) but cannot overwrite it', async () => {
    const d12 = await playerWithProgress('mix@test.local', 260); // level 3
    const before = await h.owner('GET', 'player_saves/' + d12.uid);
    const gs = { playerName: 'phone2', coins: 10, diamonds: 0, level: 1, inventory: { hint: 3 } };
    const d11 = h.deviceV11('v11', gs, ['yes']); // "restore the cloud copy"
    d11.api.cloudSignIn('mix@test.local', PASS);
    await h.waitFor(() => d11.ctx.messages.some(m => m.m.includes('שוחזר')), 'restored on 1.1');
    assert.equal(gs.level, 3);                       // 1.1 shows the 1.2 level
    assert.equal(gs.diamonds, d12.state.diamonds);   // and the 1.2 wallet
    gs.coins += 50;
    await d11.api.pushCloudSave();                   // resolves - 1.1 catches the error itself
    assert.ok(d11.ctx.errors.some(e => /permission/i.test(e)), '1.1 logged the refused save');
    const after = await h.owner('GET', 'player_saves/' + d12.uid);
    assert.deepEqual(after.progress, before.progress);
    assert.equal(after.state, before.state);
});

test('1.1 "keep this device" on a 1.2 account: refused, cloud kept (1.1 still shows its usual message)', async () => {
    const d12 = await playerWithProgress('keep@test.local', 120);
    const before = await h.owner('GET', 'player_saves/' + d12.uid);
    const gs = { playerName: 'phone2', coins: 999, diamonds: 1, level: 1, inventory: { hint: 3 } };
    const d11 = h.deviceV11('v11', gs, ['no']); // "keep local, replace the backup"
    d11.api.cloudSignIn('keep@test.local', PASS);
    await h.waitFor(() => d11.ctx.messages.some(m => m.m.includes('ההתקדמות המקומית נשמרה')), 'keep-local message');
    await h.waitFor(() => d11.ctx.errors.some(e => /permission/i.test(e)), 'refused save');
    const after = await h.owner('GET', 'player_saves/' + d12.uid);
    assert.deepEqual(after.progress, before.progress);
    assert.equal(after.state, before.state);
});

test('account deletion from 1.1 build-4 removes the save, the 1.2 progress, leaderboard rows and the account', async () => {
    const d12 = await playerWithProgress('del@test.local', 300);
    const uid = d12.uid;
    for (const board of ['leaderboard', 'leaderboard_precise', 'leaderboard_tower']) {
        await d12.app.database().ref(`${board}/${d12.state.playerId}`)
            .set({ uid, name: 'del', score: 1234, avatarId: 'dan', updatedAt: TS() });
    }
    await d12.push(); // the 1.2 state carries playerId, which 1.1 uses to find the rows
    // the data really is there before the deletion
    const before = await h.owner('GET', '');
    assert.equal(before.player_saves[uid].progress.xp['install-A1'], 300);
    for (const board of ['leaderboard', 'leaderboard_precise', 'leaderboard_tower']) {
        assert.equal(before[board][d12.state.playerId].uid, uid);
    }
    assert.equal(await h.authUserExists(uid), true);
    const gs = { playerName: 'x', coins: 0, diamonds: 0, level: 1, inventory: {} };
    const d11 = h.deviceV11('v11', gs, ['yes']);
    d11.api.cloudSignIn('del@test.local', PASS);
    await h.waitFor(() => d11.ctx.messages.some(m => m.m.includes('שוחזר')), 'restored');
    d11.api.cloudDeleteAccount(PASS);
    await h.waitFor(() => d11.ctx.messages.some(m => m.m.includes('נמחקו')), 'deleted');
    const everything = JSON.stringify(await h.owner('GET', ''));
    assert.ok(!everything.includes(uid), 'no data left that mentions the uid: ' + everything);
    assert.equal(await h.authUserExists(uid), false);
});

test('account deletion with the 1.2 flow (same calls) removes everything too', async () => {
    const d12 = await playerWithProgress('del2@test.local', 150);
    const uid = d12.uid;
    await d12.app.database().ref(`leaderboard/${d12.state.playerId}`)
        .set({ uid, name: 'del2', score: 50, avatarId: 'dan', updatedAt: TS() });
    assert.ok((await h.owner('GET', 'player_saves/' + uid)).progress);
    await d12.ref().remove();
    await d12.app.database().ref(`leaderboard/${d12.state.playerId}`).remove();
    await d12.app.auth().currentUser.delete();
    const everything = JSON.stringify(await h.owner('GET', ''));
    assert.ok(!everything.includes(uid));
    assert.equal(await h.authUserExists(uid), false);
});

test('LIMITATION: a second device still signed in can write again right after deletion; a forced token refresh stops it', async () => {
    const a = await playerWithProgress('two@test.local', 120);
    const b = new h.DeviceV12('v12b', 'install-B1');
    await b.app.auth().signInWithEmailAndPassword('two@test.local', PASS);
    const uid = a.uid;
    await a.ref().remove();
    await a.app.auth().currentUser.delete();
    // device B's cached token is still accepted by the database for a while
    await b.push();
    const resurrected = await h.owner('GET', 'player_saves/' + uid);
    assert.ok(resurrected, 'B could write after the account was deleted');
    // mitigation for 1.2: refresh the token before pushing - fails once the account is gone
    await assert.rejects(b.app.auth().currentUser.getIdToken(true));
});
