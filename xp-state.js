// ============================================================================
// xp-state.js - how XP progress lives inside the game's own save (gameState).
// Pure functions on a gameState-like object: no DOM, no localStorage, no
// Firebase, so the tests can run them in Node. xp-game.js does the saving.
//
// gameState.xpProgress  the engine's progress (xp-engine.js): per-install
//                       counters + recent reward events
// gameState.level / xp / xpToNextLevel
//                       kept in step with xpProgress - the fields the game
//                       (and version 1.1) already show
//
// Level-up diamonds: each level's 15 diamonds are paid once, into the wallet
// of the device that reached the level, and booked in xpProgress.gemsPaid.
// Nothing ever adds them again: a restored or merged save only merges the
// counters (so no level is paid twice); the wallet itself follows the save's
// normal rules - a restore brings back the backup's wallet, exactly like
// coins. There is deliberately no "top the wallet back up" step: that would
// hand back diamonds a player had already spent.
// ============================================================================

(function (root) {
    'use strict';

    const XP = (typeof module !== 'undefined' && module.exports) ? require('./xp-engine.js') : root.ZbangXP;
    const INSTALL_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;

    function isValidInstallId(id) {
        return typeof id === 'string' && INSTALL_ID_RE.test(id);
    }

    // e.g. "imh2k3x0a9c4b1d8e7f" - letters/digits only, 15-25 chars
    function newInstallId(now = Date.now(), rand = Math.random) {
        let tail = '';
        while (tail.length < 10) tail += rand().toString(36).slice(2);
        return 'i' + now.toString(36) + tail.slice(0, 10);
    }

    // level / xp / xpToNextLevel from the progress
    function syncDerived(gs) {
        const lp = XP.levelProgress(XP.totalXp(gs.xpProgress));
        gs.level = lp.level;
        gs.xp = lp.xpIntoLevel;
        gs.xpToNextLevel = lp.xpToNextLevel;
    }

    // Makes sure a loaded save has well-formed XP fields. A save from before
    // XP (no xpProgress) starts from the level it already shows, with no
    // diamonds owed for it. Never lowers a level; never touches coins or
    // diamonds.
    function ensureXpState(gs) {
        const shownLevel = Number.isInteger(gs.level) && gs.level > 1 ? gs.level : 1;
        gs.xpProgress = gs.xpProgress && typeof gs.xpProgress === 'object'
            ? XP.normalizeProgress(gs.xpProgress)
            : XP.createProgress(shownLevel);
        delete gs.gemsInBalance; // never shipped; the design doesn't use it
        syncDerived(gs);
        return gs;
    }

    const hasProgress = p => !!p && (XP.totalXp(p) > 0 || XP.diamondsPaid(p) > 0);

    // A cloud backup was restored. `localBefore` is this device's progress
    // from just before; `backupState` is the restored state object. Returns
    // the progress to keep:
    //   backup has progress   -> merged with this device's (never lower)
    //   backup has none (from 1.1, or before XP) -> this device's progress,
    //       or - on a device with none yet - a start from the level the
    //       backup shows (no diamonds owed for it). Never adds XP on top.
    function progressAfterRestore(localBefore, backupState) {
        const local = localBefore && typeof localBefore === 'object' ? XP.normalizeProgress(localBefore) : null;
        const raw = backupState && backupState.xpProgress;
        const backup = raw && typeof raw === 'object' ? XP.normalizeProgress(raw) : null;
        if (backup) return local ? XP.mergeProgress(local, backup) : backup;
        if (hasProgress(local)) return local;
        const lvl = backupState && Number.isInteger(backupState.level) && backupState.level > 1 ? backupState.level : 1;
        const fresh = XP.createProgress(lvl);
        return local ? XP.mergeProgress(local, fresh) : fresh;
    }

    // Works out a reward WITHOUT changing gs. Returns { result, fields } where
    // fields (null when nothing is granted) are the new values to write into
    // gameState in one go, right before a single save.
    function planGrant(gs, installId, round, key, eventTime) {
        if (!isValidInstallId(installId)) throw new Error('bad installId');
        const xp = XP.xpForRound(round);
        if (xp <= 0) return { result: { granted: false, reason: 'not-eligible', xp: 0 }, fields: null };
        const progress = gs.xpProgress ? XP.normalizeProgress(gs.xpProgress) : XP.createProgress(1);
        const r = XP.applyReward(progress, installId, key, xp, eventTime);
        if (r.duplicate || r.rejected || r.xpGained <= 0) {
            return { result: { granted: false, reason: r.rejected || 'duplicate', xp }, fields: null };
        }
        const lp = XP.levelProgress(XP.totalXp(r.progress));
        return {
            result: {
                granted: true, xp: r.xpGained, levelBefore: r.levelBefore, levelAfter: r.levelAfter,
                levelsGained: r.levelsGained, diamonds: r.diamonds
            },
            fields: {
                xpProgress: r.progress,
                diamonds: (Number.isFinite(gs.diamonds) ? gs.diamonds : 0) + r.diamonds,
                level: lp.level, xp: lp.xpIntoLevel, xpToNextLevel: lp.xpToNextLevel
            }
        };
    }

    // Merges another copy's progress (a restored backup, the cloud copy on
    // "keep this device") into gs. Counters only ever go up, so no XP is lost
    // and no level is paid twice. The wallet is not touched.
    function mergeIntoState(gs, otherProgress) {
        const mine = gs.xpProgress ? XP.normalizeProgress(gs.xpProgress) : XP.createProgress(1);
        const other = otherProgress && typeof otherProgress === 'object' ? otherProgress : null;
        gs.xpProgress = other ? XP.mergeProgress(mine, other) : mine;
        syncDerived(gs);
        return gs;
    }

    // What goes into the cloud backup: the counters only. The event list stays
    // on the device (events can only repeat on the device that had them).
    function progressForCloud(progress) {
        if (!progress || typeof progress !== 'object') return undefined;
        const p = XP.normalizeProgress(progress);
        return { xp: p.xp, gemsPaid: p.gemsPaid, baseLevel: p.baseLevel };
    }

    const api = { isValidInstallId, newInstallId, syncDerived, ensureXpState, planGrant, mergeIntoState, progressAfterRestore, progressForCloud };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ZbangXPState = api;
})(typeof window !== 'undefined' ? window : globalThis);
