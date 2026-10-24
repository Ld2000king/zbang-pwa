// Tests for xp-engine.js. Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const XP = require('../xp-engine.js');

const A = 'deviceA01', B = 'deviceB02';

// ---- level curve -------------------------------------------------------------

test('XP to next level is 50 x level + 50', () => {
    assert.equal(XP.xpToNextLevel(1), 100);
    assert.equal(XP.xpToNextLevel(2), 150);
    assert.equal(XP.xpToNextLevel(10), 550);
    assert.equal(XP.xpToNextLevel(19), 1000);
    assert.equal(XP.xpToNextLevel(20), 1050);
});

test('cumulative XP matches the approved table for levels 1-20', () => {
    const table = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700,
        3250, 3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450];
    table.forEach((xp, i) => assert.equal(XP.totalXpForLevel(i + 1), xp, `level ${i + 1}`));
    // and each step is the sum of the per-level requirement
    for (let L = 1; L < 60; L++) {
        assert.equal(XP.totalXpForLevel(L + 1) - XP.totalXpForLevel(L), XP.xpToNextLevel(L));
    }
});

test('level from total XP, exactly at and around each threshold', () => {
    assert.equal(XP.levelForTotalXp(0), 1);
    assert.equal(XP.levelForTotalXp(99), 1);
    assert.equal(XP.levelForTotalXp(100), 2);
    assert.equal(XP.levelForTotalXp(249), 2);
    assert.equal(XP.levelForTotalXp(250), 3);
    assert.equal(XP.levelForTotalXp(10449), 19);
    assert.equal(XP.levelForTotalXp(10450), 20);
    for (let L = 1; L <= 300; L++) {
        const t = XP.totalXpForLevel(L);
        assert.equal(XP.levelForTotalXp(t), L);
        if (L > 1) assert.equal(XP.levelForTotalXp(t - 1), L - 1);
    }
    assert.equal(XP.levelForTotalXp(-50), 1);
    assert.equal(XP.levelForTotalXp(NaN), 1);
});

test('extreme totals never hang and stay consistent', () => {
    assert.equal(XP.levelForTotalXp(Infinity), 1);
    assert.equal(XP.levelForTotalXp(-Infinity), 1);
    const big = XP.levelForTotalXp(1e15);              // clamped to the max
    assert.ok(Number.isInteger(big) && big > 1000);
    assert.equal(big, XP.levelForTotalXp(1e9));
    const p = XP.normalizeProgress({ xp: { deviceA01: 1e300 } });
    assert.ok(Number.isFinite(XP.totalXp(p)));
});

test('levelProgress gives the numbers a progress bar needs', () => {
    assert.deepEqual(XP.levelProgress(130), { level: 2, xpIntoLevel: 30, xpToNextLevel: 150, totalXp: 130 });
    assert.deepEqual(XP.levelProgress(0), { level: 1, xpIntoLevel: 0, xpToNextLevel: 100, totalXp: 0 });
});

// ---- XP per mode -----------------------------------------------------------------

test('single player: 20 quick / 30 precise, +1 per word up to +20', () => {
    assert.equal(XP.xpForRound({ mode: 'single', singleMode: 'quick', completed: true, wordsFound: 1 }), 21);
    assert.equal(XP.xpForRound({ mode: 'single', singleMode: 'precise', completed: true, wordsFound: 5 }), 35);
    assert.equal(XP.xpForRound({ mode: 'single', singleMode: 'quick', completed: true, wordsFound: 50 }), 40);
});

test('bots battle: 10 per round, +5 survived, +25 for winning', () => {
    assert.equal(XP.xpForRound({ mode: 'battle', completed: true, wordsFound: 2, survived: false }), 10);
    assert.equal(XP.xpForRound({ mode: 'battle', completed: true, wordsFound: 2, survived: true }), 15);
    assert.equal(XP.xpForRound({ mode: 'battle', completed: true, wordsFound: 2, survived: true, wonMatch: true }), 40);
});

test('friends: 10 per round, +25 for the winner', () => {
    assert.equal(XP.xpForRound({ mode: 'friends', completed: true, wordsFound: 1 }), 10);
    assert.equal(XP.xpForRound({ mode: 'friends', completed: true, wordsFound: 1, wonMatch: true }), 35);
});

test('random match: 20, +15 win, +5 draw', () => {
    assert.equal(XP.xpForRound({ mode: 'random', completed: true, wordsFound: 1, result: 'loss' }), 20);
    assert.equal(XP.xpForRound({ mode: 'random', completed: true, wordsFound: 1, result: 'draw' }), 25);
    assert.equal(XP.xpForRound({ mode: 'random', completed: true, wordsFound: 1, result: 'win' }), 35);
});

test('tower: 10 + words capped at 40, plus 10 per clear on top of the cap', () => {
    assert.equal(XP.xpForRound({ mode: 'tower', completed: true, wordsFound: 5, clears: 0 }), 15);
    assert.equal(XP.xpForRound({ mode: 'tower', completed: true, wordsFound: 30, clears: 0 }), 40);
    assert.equal(XP.xpForRound({ mode: 'tower', completed: true, wordsFound: 100, clears: 0 }), 40);
    assert.equal(XP.xpForRound({ mode: 'tower', completed: true, wordsFound: 100, clears: 2 }), 60);
    assert.equal(XP.xpForRound({ mode: 'tower', completed: true, wordsFound: 3, clears: 1 }), 23);
    assert.equal(XP.xpForRound({ mode: 'tower', completed: true, wordsFound: 3, clears: -4 }), 13);
});

test('no XP without a completed round and at least one word', () => {
    for (const mode of ['single', 'battle', 'friends', 'random', 'tower']) {
        assert.equal(XP.xpForRound({ mode, completed: true, wordsFound: 0, clears: 3, wonMatch: true, result: 'win' }), 0, mode);
        assert.equal(XP.xpForRound({ mode, completed: false, wordsFound: 9 }), 0, mode);
        assert.equal(XP.xpForRound({ mode, wordsFound: 9 }), 0, mode); // completed missing
    }
    assert.equal(XP.xpForRound({ mode: 'unknown', completed: true, wordsFound: 5 }), 0);
    assert.equal(XP.xpForRound(null), 0);
});

// ---- rewards, diamonds and duplicates ----------------------------------------

test('one level up pays exactly 15 diamonds', () => {
    const r = XP.applyReward(XP.createProgress(), A, 'single:1', 100);
    assert.equal(r.levelBefore, 1);
    assert.equal(r.levelAfter, 2);
    assert.equal(r.levelsGained, 1);
    assert.equal(r.diamonds, 15);
});

test('two and three levels in one reward pay 30 and 45', () => {
    let r = XP.applyReward(XP.createProgress(), A, 'e1', 250); // 1 -> 3
    assert.equal(r.levelsGained, 2);
    assert.equal(r.diamonds, 30);
    r = XP.applyReward(XP.createProgress(), A, 'e1', 450);     // 1 -> 4
    assert.equal(r.levelsGained, 3);
    assert.equal(r.diamonds, 45);
});

test('XP that stays inside a level pays no diamonds', () => {
    const r = XP.applyReward(XP.createProgress(), A, 'e1', 99);
    assert.equal(r.levelAfter, 1);
    assert.equal(r.diamonds, 0);
    assert.equal(r.xpGained, 99);
});

test('the same event key pays once; a different key pays again', () => {
    let p = XP.createProgress();
    const first = XP.applyReward(p, A, 'mp:ROOM1:1700000000000', 100);
    p = first.progress;
    const again = XP.applyReward(p, A, 'mp:ROOM1:1700000000000', 100);
    assert.equal(again.duplicate, true);
    assert.equal(again.xpGained, 0);
    assert.equal(again.diamonds, 0);
    assert.equal(XP.totalXp(again.progress), 100);
    const next = XP.applyReward(p, A, 'mp:ROOM1:1700000060000', 150);
    assert.equal(next.duplicate, false);
    assert.equal(XP.totalXp(next.progress), 250);
    assert.equal(next.diamonds, 15); // level 2 -> 3
});

test('replaying an event many times never adds diamonds', () => {
    let p = XP.applyReward(XP.createProgress(), A, 'battle:x:1', 300).progress;
    const paid = XP.diamondsPaid(p);
    for (let i = 0; i < 20; i++) p = XP.applyReward(p, A, 'battle:x:1', 300).progress;
    assert.equal(XP.diamondsPaid(p), paid);
    assert.equal(XP.totalXp(p), 300);
});

test('applyReward never changes the object it was given', () => {
    const p = XP.createProgress();
    const snapshot = JSON.stringify(p);
    XP.applyReward(p, A, 'e1', 500);
    assert.equal(JSON.stringify(p), snapshot);
});

test('bad input is rejected without paying anything', () => {
    const p = XP.createProgress();
    assert.equal(XP.applyReward(p, A, '', 50).rejected, 'bad-key');
    assert.equal(XP.applyReward(p, A, null, 50).rejected, 'bad-key');
    assert.equal(XP.applyReward(p, A, 'k', 0).rejected, 'no-xp');
    assert.equal(XP.applyReward(p, A, 'k', -10).rejected, 'no-xp');
    assert.equal(XP.applyReward(p, A, 'k', 'abc').rejected, 'no-xp');
    assert.throws(() => XP.applyReward(p, 'x', 'k', 10));   // install id too short
    assert.throws(() => XP.applyReward(p, 'a b c d', 'k', 10));
    // a rejected reward does not burn the key
    const ok = XP.applyReward(XP.applyReward(p, A, 'k', 0).progress, A, 'k', 10);
    assert.equal(ok.xpGained, 10);
});

test('a single reward is capped', () => {
    const r = XP.applyReward(XP.createProgress(), A, 'e', 1e9);
    assert.equal(r.xpGained, XP.MAX_XP_PER_EVENT);
});

test('event keys: built from parts, missing parts give null', () => {
    assert.equal(XP.eventKey('mp', 'ABCD', 1700000000000), 'mp:ABCD:1700000000000');
    assert.equal(XP.eventKey('single', undefined), null);
    assert.equal(XP.eventKey(), null);
});

test('the recent-events list stays bounded and keeps the newest keys', () => {
    let p = XP.createProgress();
    for (let i = 0; i < XP.MAX_RECENT_EVENTS + 30; i++) p = XP.applyReward(p, A, 'e' + i, 1).progress;
    assert.equal(p.events.length, XP.MAX_RECENT_EVENTS);
    assert.equal(p.events.at(-1), 'e' + (XP.MAX_RECENT_EVENTS + 29));
    assert.ok(!p.events.includes('e0'));
});

// ---- existing players, merges and restores -----------------------------------

test('an old save without progress starts at level 1 with nothing owed', () => {
    const p = XP.normalizeProgress(undefined);
    assert.equal(XP.levelOf(p), 1);
    assert.equal(XP.diamondsOwed(p), 0);
});

test('a legacy level is kept and pays no diamonds retroactively', () => {
    const p = XP.createProgress(5);
    assert.equal(XP.levelOf(p), 5);
    assert.equal(XP.diamondsOwed(p) - XP.diamondsPaid(p), 0);
    const r = XP.applyReward(p, A, 'e1', XP.xpToNextLevel(5)); // 5 -> 6
    assert.equal(r.levelAfter, 6);
    assert.equal(r.diamonds, 15);
});

test('merging a legacy-level save with a fresh one pays no retroactive diamonds', () => {
    const legacy = XP.createProgress(5);       // an older save already at level 5
    const fresh = XP.createProgress();         // e.g. a second device, nothing yet
    for (const merged of [XP.mergeProgress(legacy, fresh), XP.mergeProgress(fresh, legacy)]) {
        assert.equal(XP.levelOf(merged), 5);
        assert.equal(XP.settleDiamonds(merged, A).diamonds, 0);
    }
});

test('normalizeProgress ignores garbage and never throws', () => {
    const p = XP.normalizeProgress({ xp: { [A]: 120, 'bad id!': 999, [B]: -5, x: 'y' }, gemsPaid: 'nope', baseLevel: 0, events: [1, 'ok', null] });
    assert.deepEqual(p, { xp: { [A]: 120 }, gemsPaid: {}, baseLevel: 1, events: ['ok'] });
    assert.doesNotThrow(() => XP.normalizeProgress('junk'));
});

test('merge is order-free, repeatable, and never double counts', () => {
    let a = XP.createProgress(), b = XP.createProgress();
    a = XP.applyReward(a, A, 'a1', 120).progress;
    b = XP.applyReward(b, B, 'b1', 200).progress;
    const ab = XP.mergeProgress(a, b), ba = XP.mergeProgress(b, a);
    assert.equal(XP.totalXp(ab), 320);
    assert.deepEqual(ab.xp, ba.xp);
    assert.deepEqual(ab.gemsPaid, ba.gemsPaid);
    const again = XP.mergeProgress(ab, ab);
    assert.equal(XP.totalXp(again), 320);
    assert.equal(XP.totalXp(XP.mergeProgress(XP.mergeProgress(ab, a), b)), 320);
});

test('restoring an older save never lowers XP or the level', () => {
    let p = XP.createProgress();
    p = XP.applyReward(p, A, 'e1', 300).progress;
    const old = JSON.parse(JSON.stringify(p));      // backup taken here
    p = XP.applyReward(p, A, 'e2', 500).progress;   // more progress after it
    const restored = XP.mergeProgress(p, old);
    assert.equal(XP.totalXp(restored), 800);
    assert.equal(XP.levelOf(restored), XP.levelOf(p));
});

test('a restored save cannot be used to claim the same diamonds again', () => {
    let p = XP.createProgress();
    p = XP.applyReward(p, A, 'e1', 450).progress;           // levels 2-4 paid: 45
    const old = XP.createProgress();                         // an old save from before
    const merged = XP.mergeProgress(old, p);
    const s = XP.settleDiamonds(merged, A);
    assert.equal(s.diamonds, 0);
    assert.equal(XP.diamondsPaid(s.progress), 45);
});

test('two devices merged pay for each level once', () => {
    let a = XP.applyReward(XP.createProgress(), A, 'a1', 100).progress; // A: level 2, paid 15
    let b = XP.mergeProgress(XP.createProgress(), a);                    // B picks up A's state
    b = XP.applyReward(b, B, 'b1', 150).progress;                         // B: level 3, pays 15
    const merged = XP.mergeProgress(a, b);
    assert.equal(XP.levelOf(merged), 3);
    assert.equal(XP.diamondsPaid(merged), 30); // levels 2 and 3, once each
    assert.equal(XP.settleDiamonds(merged, A).diamonds, 0);
});

test('two offline devices crossing the same level: the extra is absorbed later', () => {
    const base = XP.createProgress();
    const a = XP.applyReward(base, A, 'a1', 60).progress; // A alone: 60 XP
    const b = XP.applyReward(base, B, 'b1', 60).progress; // B alone: 60 XP
    let a2 = XP.applyReward(a, A, 'a2', 40);              // A reaches level 2 -> 15
    let b2 = XP.applyReward(b, B, 'b2', 40);              // B reaches level 2 -> 15
    assert.equal(a2.diamonds + b2.diamonds, 30);
    let merged = XP.mergeProgress(a2.progress, b2.progress);
    assert.equal(XP.levelOf(merged), 2);                   // 200 XP -> still level 2
    assert.equal(XP.diamondsPaid(merged), 30);             // 15 paid ahead
    // settling while paid ahead pays nothing and takes nothing back
    const s = XP.settleDiamonds(merged, A);
    assert.equal(s.diamonds, 0);
    assert.equal(XP.diamondsPaid(s.progress), 30);
    assert.deepEqual(s.progress.gemsPaid, merged.gemsPaid);
    // reaching level 3 pays nothing - it was prepaid
    const r3 = XP.applyReward(merged, A, 'a3', 50);        // 250 -> level 3
    assert.equal(r3.levelAfter, 3);
    assert.equal(r3.diamonds, 0);
    // level 4 pays normally again
    const r4 = XP.applyReward(r3.progress, A, 'a4', 200);  // 450 -> level 4
    assert.equal(r4.diamonds, 15);
    assert.equal(XP.diamondsPaid(r4.progress), XP.diamondsOwed(r4.progress));
});

test('random merges and replays always end with paid == owed and no lost XP', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const ids = ['deviceA01', 'deviceB02', 'deviceC03'];
    let copies = ids.map(() => XP.createProgress());
    const earned = {};
    for (let step = 0; step < 3000; step++) {
        const i = Math.floor(rand() * ids.length);
        if (rand() < 0.2) {
            const j = Math.floor(rand() * ids.length);
            copies[i] = XP.mergeProgress(copies[i], copies[j]);
        } else {
            const key = ids[i] + ':' + Math.floor(rand() * 400); // keys repeat on purpose
            const r = XP.applyReward(copies[i], ids[i], key, 1 + Math.floor(rand() * 60));
            copies[i] = r.progress;
            if (!r.duplicate) earned[ids[i]] = (earned[ids[i]] || 0) + r.xpGained;
        }
    }
    let all = copies.reduce((x, y) => XP.mergeProgress(x, y));
    all = XP.settleDiamonds(all, ids[0]).progress;
    for (const id of ids) assert.equal(all.xp[id] || 0, earned[id] || 0, id);
    assert.ok(XP.diamondsPaid(all) >= XP.diamondsOwed(all));
    assert.ok(XP.diamondsPaid(all) - XP.diamondsOwed(all) <= 15 * ids.length * 50); // only offline prepay
});

test('the progress object stays small enough for the cloud save', () => {
    let p = XP.createProgress();
    for (let d = 0; d < 10; d++) {
        for (let i = 0; i < 200; i++) p = XP.applyReward(p, 'device' + String(d).padStart(4, '0'), `mp:ROOM${d}:${1700000000000 + i}`, 50).progress;
    }
    assert.ok(JSON.stringify(p).length < 6000, String(JSON.stringify(p).length));
});
