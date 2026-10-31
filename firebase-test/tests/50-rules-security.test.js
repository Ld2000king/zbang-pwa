// Security check of the 1.2 rules with REAL writes and deletes against the
// emulator, from signed-in accounts. Every attempt starts from the same
// seeded save. RULES_FILE=<path> runs the same table against another rules
// file (used to show what the hardening closes); without it: the proposal.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers.js');

const RULES = process.env.RULES_FILE || 'proposal';
const PASS = 'test-pass-123';
const TS = () => h.firebase.database.ServerValue.TIMESTAMP;

const SEED = () => ({
    state: JSON.stringify({ coins: 10, diamonds: 30, level: 3 }),
    updatedAt: 1,
    progress: { baseLevel: 1, xp: { 'install-A1': 300, 'install-B1': 100 }, gemsPaid: { 'install-A1': 30, 'install-B1': 15 } }
});

let owner, other, uid;
async function fresh(seed = SEED()) {
    await h.resetEmulator();
    await h.useRules(RULES);
    owner = h.newDevice('owner'); other = h.newDevice('other');
    uid = (await owner.auth().createUserWithEmailAndPassword('owner@test.local', PASS)).user.uid;
    await other.auth().createUserWithEmailAndPassword('other@test.local', PASS);
    if (seed) await h.owner('PUT', 'player_saves/' + uid, seed);
}
const save = (app = owner) => app.database().ref('player_saves/' + uid);
async function attempt(fn) {
    try { await fn(); return 'allowed'; }
    catch (e) { if (/permission/i.test(String(e.code || e.message))) return 'denied'; throw e; }
}
const progressNow = async () => h.owner('GET', `player_saves/${uid}/progress`);

// [name, attempt, expected with the hardened proposal]
const ATTACKS = [
    ['V1  1.1-style overwrite of the whole save (no progress)', () => save().set({ state: '{}', updatedAt: 2 }), 'denied'],
    ['V2  update() that sets progress to null', () => save().update({ progress: null }), 'denied'],
    ['V3  remove() the progress node', () => save().child('progress').remove(), 'denied'],
    ['V4  progress rewritten as {baseLevel} only (all counters gone)', () => save().child('progress').set({ baseLevel: 1 }), 'denied'],
    ['V5  remove() the whole xp map', () => save().child('progress/xp').remove(), 'denied'],
    ['V6  remove() the whole gemsPaid map', () => save().child('progress/gemsPaid').remove(), 'denied'],
    ['V7  remove() baseLevel', () => save().child('progress/baseLevel').remove(), 'denied'],
    ['V8  lower one XP counter (300 -> 50)', () => save().child('progress/xp/install-A1').set(50), 'denied'],
    ['V9  lower one gemsPaid counter (30 -> 0)', () => save().child('progress/gemsPaid/install-A1').set(0), 'denied'],
    ['V9b re-create a counter lower in the same write (remove + add)', () => save().child('progress/xp').set({ 'install-A1': 1, 'install-B1': 100 }), 'denied'],
    ['V10 lower baseLevel... raise is fine, lower to 0', () => save().child('progress/baseLevel').set(0), 'denied'],
    ['V11 remove() ONE XP counter', () => save().child('progress/xp/install-A1').remove(), 'allowed'],
    ['V12 update() deleting ONE gemsPaid counter', () => save().update({ 'progress/gemsPaid/install-A1': null }), 'allowed'],
    ['V12b delete the LAST counters of a map (map would vanish)', () => save().update({ 'progress/gemsPaid/install-A1': null, 'progress/gemsPaid/install-B1': null }), 'denied'],
    ['V13 rewrite xp map without one install (B1 dropped)', () => save().child('progress/xp').set({ 'install-A1': 300 }), 'allowed'],
    ['V14 delete the whole save, then recreate it with lower progress', async () => {
        await save().remove();
        await save().set({ state: '{}', updatedAt: 3, progress: { baseLevel: 1, xp: { 'install-A1': 1 } } });
    }, 'allowed'],
    ['O1  other user reads my save', () => save(other).once('value'), 'denied'],
    ['O2  other user reads my progress', () => save(other).child('progress').once('value'), 'denied'],
    ['O3  other user raises my XP counter', () => save(other).child('progress/xp/install-A1').set(999), 'denied'],
    ['O4  other user deletes one of my counters', () => save(other).child('progress/xp/install-A1').remove(), 'denied'],
    ['O5  other user deletes my whole save', () => save(other).remove(), 'denied'],
    ['O6  other user creates progress in my save', () => save(other).child('progress/xp/install-Z9').set(5), 'denied']
];

const results = [];
for (const [name, fn, expected] of ATTACKS) {
    test(`${name} -> expect ${expected}`, async () => {
        await fresh();
        const got = await attempt(fn);
        results.push([name, got]);
        if (RULES === 'proposal') assert.equal(got, expected);
        if (got === 'denied') assert.deepEqual(await progressNow(), SEED().progress, 'a denied attempt changed nothing');
    });
}

// ---- legitimate use must keep working --------------------------------------------

test('L1 owner raises a counter and adds a new install', async () => {
    await fresh();
    assert.equal(await attempt(() => save().child('progress/xp/install-A1').set(350)), 'allowed');
    assert.equal(await attempt(() => save().child('progress/xp/install-C3').set(10)), 'allowed');
});

test('L2 owner writes the whole save with progress kept (what 1.2 does)', async () => {
    await fresh();
    const s = SEED(); s.progress.xp['install-A1'] = 320; s.updatedAt = TS();
    assert.equal(await attempt(() => save().set(s)), 'allowed');
    assert.equal(await attempt(() => save().update({ state: '{"a":1}', updatedAt: TS() })), 'allowed');
});

test('L3 account deletion: the whole save can be removed, nothing remains', async () => {
    await fresh();
    assert.equal(await attempt(() => save().remove()), 'allowed');
    assert.equal(await h.owner('GET', 'player_saves/' + uid), null);
    await owner.auth().currentUser.delete();
    assert.equal(await h.authUserExists(uid), false);
});

test('L4 a 1.1 user who never used 1.2: create, overwrite and delete the backup', async () => {
    await fresh(null);
    assert.equal(await attempt(() => save().set({ state: '{"coins":1}', updatedAt: TS() })), 'allowed');
    assert.equal(await attempt(() => save().set({ state: '{"coins":2}', updatedAt: TS(), photo: 'data:image/jpeg;base64,AAAA' })), 'allowed');
    assert.equal(await attempt(() => save().remove()), 'allowed');
});

test('L5 first progress write ever (only baseLevel, no XP yet) and later the first counter', async () => {
    await fresh({ state: '{}', updatedAt: 1 });
    assert.equal(await attempt(() => save().child('progress').set({ baseLevel: 1 })), 'allowed');
    assert.equal(await attempt(() => save().child('progress/xp/install-A1').set(20)), 'allowed');
});

test.after(async () => {
    console.log('\n=== rules: ' + RULES + ' ===');
    for (const [name, got] of results) console.log((got === 'denied' ? 'DENIED ' : 'ALLOWED') + '  ' + name);
    await h.disposeDevices();
});
