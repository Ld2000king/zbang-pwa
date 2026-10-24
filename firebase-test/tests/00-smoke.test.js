const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers.js');

test('emulator is up, both rule files load, a signed-in device can save', async () => {
    await h.resetEmulator();
    await h.useRules('current');
    await h.useRules('proposal');
    const app = h.newDevice('smoke');
    const cred = await app.auth().createUserWithEmailAndPassword('smoke@test.local', 'test-pass-123');
    await app.database().ref('player_saves/' + cred.user.uid).set({ state: '{}', updatedAt: 1 });
    const dump = await h.owner('GET', 'player_saves/' + cred.user.uid);
    assert.equal(dump.state, '{}');
    await h.disposeDevices();
});
