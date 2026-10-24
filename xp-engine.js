// ============================================================================
// xp-engine.js - the XP / level / level-up diamonds rules for 1.2.
//
// NOT CONNECTED YET: nothing loads this file (it is not in index.html), so it
// changes nothing in the game. It is pure logic - no DOM, no localStorage, no
// Firebase - so the tests (tests/xp-engine.test.js) can run it in Node and the
// game can wire it in later.
//
// Rules (approved for 1.2):
//   * XP needed to go from level L to L+1 = 50 * L + 50 (100, 150, 200, ...).
//   * Every level gained pays exactly 15 diamonds - 30 for two levels at once,
//     45 for three, with no upper level limit.
//   * XP only for a completed round in which the player found at least one
//     valid word. Each reward has a unique event key and the time the event
//     happened; the same key never pays twice. Only the newest 100 events are
//     kept, and anything not newer than the newest event ever dropped from
//     that list (eventFloor) is refused - so an old event can't pay again
//     after it has left the list.
//
// Progress is kept as COUNTERS PER INSTALL rather than one total: every
// install of the game only ever raises its own counters. Combining two copies
// (two devices, a restored backup, an old save) takes the larger value per
// install, so it gives the same result in any order, run any number of times,
// and can never lower progress or count the same XP twice.
//
// Diamonds are not tracked with a "already paid" flag. Owed diamonds are
// 15 x (level - baseLevel); the diamonds already paid are counters too; only
// the difference is ever paid. Replaying an event, merging a save or running
// the code twice therefore pays nothing extra.
// ============================================================================

(function (root) {
    'use strict';

    const DIAMONDS_PER_LEVEL = 15;
    const MAX_RECENT_EVENTS = 100;          // keeps the saved state small
    const MAX_XP_PER_EVENT = 1000;          // sanity cap on a single reward
    const MAX_TOTAL_XP = 1e9;               // far beyond real play; keeps maths finite
    const INSTALL_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
    const LEGACY_INSTALL = 'legacy';        // XP a pre-1.2 save already had

    // ---- level curve --------------------------------------------------------

    // XP needed to go from `level` to `level + 1`
    function xpToNextLevel(level) {
        return 50 * level + 50;
    }

    // total XP needed to reach `level` from level 1 (level 1 = 0)
    // sum over k = 1 .. level-1 of (50k + 50) = (level - 1) * (25 * level + 50)
    function totalXpForLevel(level) {
        if (!Number.isInteger(level) || level < 1) return 0;
        return (level - 1) * (25 * level + 50);
    }

    // clamps any input (negative, NaN, Infinity, huge) into a safe range
    function safeXp(totalXp) {
        const n = Math.floor(Number(totalXp));
        return Number.isFinite(n) ? Math.min(MAX_TOTAL_XP, Math.max(0, n)) : 0;
    }

    function levelForTotalXp(totalXp) {
        const xp = safeXp(totalXp);
        // inverse of totalXpForLevel, then corrected for rounding
        let level = Math.max(1, Math.floor((-25 + Math.sqrt(625 + 100 * (xp + 100))) / 50));
        while (totalXpForLevel(level + 1) <= xp) level++;
        while (level > 1 && totalXpForLevel(level) > xp) level--;
        return level;
    }

    // { level, xpIntoLevel, xpToNextLevel, totalXp } - for the UI
    function levelProgress(totalXp) {
        const xp = safeXp(totalXp);
        const level = levelForTotalXp(xp);
        return {
            level,
            xpIntoLevel: xp - totalXpForLevel(level),
            xpToNextLevel: xpToNextLevel(level),
            totalXp: xp
        };
    }

    // ---- XP per round, per mode ---------------------------------------------
    // `round` describes a round that ended:
    //   completed  - true only when the round finished by the rules
    //                (not quit, abandoned, or left mid-way)
    //   wordsFound - valid words the player found in it
    // plus per mode:
    //   single:  singleMode 'quick' | 'precise'
    //   battle:  survived (bool), wonMatch (bool - survived the final round)
    //   friends: wonMatch (bool)
    //   random:  result 'win' | 'draw' | 'loss'
    //   tower:   clears (times the tower was emptied); paid at Game Over only

    function isEligible(round) {
        return !!round && round.completed === true
            && Number.isInteger(round.wordsFound) && round.wordsFound >= 1;
    }

    function xpForRound(round) {
        if (!isEligible(round)) return 0;
        const words = round.wordsFound;
        switch (round.mode) {
            case 'single':
                return (round.singleMode === 'precise' ? 30 : 20) + Math.min(20, words);
            case 'battle':
                return 10 + (round.survived ? 5 : 0) + (round.wonMatch ? 25 : 0);
            case 'friends':
                return 10 + (round.wonMatch ? 25 : 0);
            case 'random':
                return 20 + (round.result === 'win' ? 15 : round.result === 'draw' ? 5 : 0);
            case 'tower': {
                const clears = Number.isInteger(round.clears) && round.clears > 0 ? round.clears : 0;
                return Math.min(40, 10 + words) + 10 * clears; // the 40 cap is on the base only
            }
            default:
                return 0;
        }
    }

    // Unique key for one reward, e.g. eventKey('mp', roomCode, roundStartTime).
    function eventKey(...parts) {
        if (!parts.length || parts.some(p => p === undefined || p === null || p === '')) return null;
        return parts.map(String).join(':');
    }

    // ---- progress state -----------------------------------------------------
    // {
    //   xp:        { [installId]: XP earned on that install },
    //   gemsPaid:  { [installId]: level-up diamonds paid on that install },
    //   baseLevel: level the player had when 1.2 started counting
    //              (no diamonds for levels at or below it),
    //   events:    the newest reward events as [key, timeMs] pairs (max 100),
    //   eventFloor: newest time ever dropped from `events`; events at or before
    //              it are refused
    // }

    // A fresh progress object. `legacyLevel` is the level an older save
    // already shows: it is kept (seeded as legacy XP) but pays no diamonds.
    function createProgress(legacyLevel) {
        const base = Number.isInteger(legacyLevel) && legacyLevel > 1 ? legacyLevel : 1;
        const progress = { xp: {}, gemsPaid: {}, baseLevel: base, events: [], eventFloor: 0 };
        if (base > 1) progress.xp[LEGACY_INSTALL] = totalXpForLevel(base);
        return progress;
    }

    // Reads whatever was saved (possibly missing, partial or from an older
    // build) into a well-formed progress object. Never throws.
    function normalizeProgress(raw, legacyLevel) {
        if (!raw || typeof raw !== 'object') return createProgress(legacyLevel);
        const clean = (obj) => {
            const out = {};
            if (obj && typeof obj === 'object') {
                for (const [k, v] of Object.entries(obj)) {
                    if ((INSTALL_ID_RE.test(k) || k === LEGACY_INSTALL)
                        && Number.isFinite(v) && v > 0) out[k] = Math.min(MAX_TOTAL_XP, Math.floor(v));
                }
            }
            return out;
        };
        return {
            xp: clean(raw.xp),
            gemsPaid: clean(raw.gemsPaid),
            baseLevel: Number.isInteger(raw.baseLevel) && raw.baseLevel >= 1 ? raw.baseLevel : 1,
            ...keepRecent(Array.isArray(raw.events)
                ? raw.events.filter(e => Array.isArray(e) && typeof e[0] === 'string' && e[0]
                    && Number.isFinite(e[1]) && e[1] > 0).map(e => [e[0], e[1]])
                : [], Number.isFinite(raw.eventFloor) && raw.eventFloor > 0 ? raw.eventFloor : 0)
        };
    }

    // Keeps the MAX_RECENT_EVENTS newest events (by time); the newest time it
    // drops raises the floor. Returns { events, eventFloor }.
    function keepRecent(events, floor) {
        const byKey = new Map();
        for (const [k, t] of events) if (t > floor) byKey.set(k, Math.max(byKey.get(k) || 0, t));
        const sorted = [...byKey.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
        let eventFloor = floor;
        for (const [, t] of sorted.slice(MAX_RECENT_EVENTS)) eventFloor = Math.max(eventFloor, t);
        return { events: sorted.slice(0, MAX_RECENT_EVENTS).reverse(), eventFloor };
    }

    const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

    function totalXp(progress) { return sum(progress.xp); }
    function levelOf(progress) { return levelForTotalXp(totalXp(progress)); }
    function diamondsOwed(progress) {
        return DIAMONDS_PER_LEVEL * Math.max(0, levelOf(progress) - progress.baseLevel);
    }
    function diamondsPaid(progress) { return sum(progress.gemsPaid); }

    function copyProgress(p) {
        return {
            xp: { ...p.xp }, gemsPaid: { ...p.gemsPaid }, baseLevel: p.baseLevel,
            events: p.events.map(e => e.slice()), eventFloor: p.eventFloor
        };
    }

    // Combines two copies of the same player's progress. Per install the
    // larger counter wins; events are united. Order does not matter, and
    // merging the same copy again changes nothing. baseLevel takes the higher
    // value, so a merge can never make old levels pay diamonds.
    function mergeProgress(a, b) {
        const pa = normalizeProgress(a), pb = normalizeProgress(b);
        const maxMerge = (x, y) => {
            const out = { ...x };
            for (const [k, v] of Object.entries(y)) out[k] = Math.max(out[k] || 0, v);
            return out;
        };
        return {
            xp: maxMerge(pa.xp, pb.xp),
            gemsPaid: maxMerge(pa.gemsPaid, pb.gemsPaid),
            baseLevel: Math.max(pa.baseLevel, pb.baseLevel),
            ...keepRecent(pa.events.concat(pb.events), Math.max(pa.eventFloor, pb.eventFloor))
        };
    }

    // Pays whatever level-up diamonds are owed but not yet paid, booking them
    // on `installId`. Returns { progress, diamonds }. Pays 0 when nothing is due
    // (including when more was paid ahead - e.g. two offline devices crossing
    // the same level - which later level-ups then absorb).
    function settleDiamonds(progress, installId) {
        if (!INSTALL_ID_RE.test(installId || '')) throw new Error('bad installId');
        const p = copyProgress(normalizeProgress(progress));
        const due = diamondsOwed(p) - diamondsPaid(p);
        if (due <= 0) return { progress: p, diamonds: 0 };
        p.gemsPaid[installId] = (p.gemsPaid[installId] || 0) + due;
        return { progress: p, diamonds: due };
    }

    // The single entry point for granting a reward. Pure: returns a NEW
    // progress object (the input is never changed), plus what happened.
    //   eventTime: when the event happened (ms since 1970) - required
    //   duplicate: true -> this event was already rewarded (or is older than
    //              the events still remembered); nothing paid
    function applyReward(progress, installId, key, xp, eventTime) {
        if (!INSTALL_ID_RE.test(installId || '')) throw new Error('bad installId');
        const p = copyProgress(normalizeProgress(progress));
        const levelBefore = levelOf(p);
        const result = (extra) => Object.assign({
            progress: p, xpGained: 0, levelBefore, levelAfter: levelBefore,
            levelsGained: 0, diamonds: 0, duplicate: false
        }, extra);

        if (typeof key !== 'string' || !key) return result({ rejected: 'bad-key' });
        if (!Number.isFinite(eventTime) || eventTime <= 0) return result({ rejected: 'bad-time' });
        if (p.events.some(e => e[0] === key)) return result({ duplicate: true });
        if (eventTime <= p.eventFloor) return result({ duplicate: true, tooOld: true });
        const amount = Math.floor(Number(xp));
        if (!Number.isFinite(amount) || amount <= 0) return result({ rejected: 'no-xp' });

        const gained = Math.min(amount, MAX_XP_PER_EVENT);
        p.xp[installId] = (p.xp[installId] || 0) + gained;
        Object.assign(p, keepRecent(p.events.concat([[key, Math.floor(eventTime)]]), p.eventFloor));

        const settled = settleDiamonds(p, installId);
        const levelAfter = levelOf(settled.progress);
        return {
            progress: settled.progress,
            xpGained: gained,
            levelBefore,
            levelAfter,
            levelsGained: levelAfter - levelBefore,
            diamonds: settled.diamonds,
            duplicate: false
        };
    }

    const api = {
        DIAMONDS_PER_LEVEL, MAX_RECENT_EVENTS, MAX_XP_PER_EVENT, LEGACY_INSTALL,
        xpToNextLevel, totalXpForLevel, levelForTotalXp, levelProgress,
        isEligible, xpForRound, eventKey,
        createProgress, normalizeProgress, mergeProgress,
        totalXp, levelOf, diamondsOwed, diamondsPaid,
        settleDiamonds, applyReward
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ZbangXP = api;
})(typeof window !== 'undefined' ? window : globalThis);
