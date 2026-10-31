// ============================================================================
// xp-cloud.js - how XP progress and level-up diamonds travel with the cloud
// save (player_saves/<uid>). Built on xp-engine.js.
//
// NOT CONNECTED YET: nothing loads this file. It is tested against the local
// Firebase Emulator (firebase-test/), never against the real project.
//
// Where things live
//   player_saves/<uid>/state     the existing JSON backup string (same
//                                shape; 1.2 adds the `xpProgress` counters and
//                                keeps `level` up to date so 1.1 shows it)
//   player_saves/<uid>/progress  NEW: { xp: {install: n}, gemsPaid: {install: n},
//                                baseLevel } - counters that only go up.
//                                Inside the same node on purpose: deleting the
//                                save (account deletion, from ANY app version)
//                                deletes the progress with it.
//
// The proposed rules (firebase-test/rules/proposal-v1.2.rules.json) refuse a
// write that would drop `progress`, so an older app version can no longer
// overwrite it. Until those rules are live, `progress` is refused outright
// ($other: false) - pushSave then falls back to the old state-only backup,
// so 1.2 keeps working on today's rules.
//
// Diamonds wallet
//   `diamonds` in the state is a wallet, last-writer-wins as always. Each
//   level's 15 diamonds are paid once, into the wallet of the device that
//   reached the level (booked in progress.gemsPaid). Merging or restoring
//   only merges the counters - it never adds diamonds to a wallet, because
//   "topping up" would give back diamonds a player already spent.
// ============================================================================

(function (root) {
    'use strict';

    const node = typeof module !== 'undefined' && module.exports;
    const XP = node ? require('./xp-engine.js') : root.ZbangXP;
    const XS = node ? require('./xp-state.js') : root.ZbangXPState;

    // engine progress -> what is stored in the cloud (events stay on the device)
    function toCloudProgress(progress) {
        const p = XP.normalizeProgress(progress);
        const out = { baseLevel: p.baseLevel };
        if (Object.keys(p.xp).length) out.xp = p.xp;
        if (Object.keys(p.gemsPaid).length) out.gemsPaid = p.gemsPaid;
        return out;
    }

    // cloud value (possibly missing) -> engine progress with no events
    function fromCloudProgress(raw) {
        if (!raw || typeof raw !== 'object') return XP.normalizeProgress(null);
        return XP.normalizeProgress({ xp: raw.xp, gemsPaid: raw.gemsPaid, baseLevel: raw.baseLevel });
    }

    // The value a 1.2 push writes, given what is in the cloud right now.
    // Pure, so it can run inside a transaction (which may call it repeatedly).
    // `state` may be the state object or the JSON string cloudsave.js already built
    function buildPushValue(current, state, localProgress, timestamp, photo) {
        const cloudProgress = fromCloudProgress(current && current.progress);
        const merged = XP.mergeProgress(localProgress, cloudProgress);
        const value = {
            state: typeof state === 'string' ? state : JSON.stringify(state),
            updatedAt: timestamp,
            progress: toCloudProgress(merged)
        };
        if (photo) value.photo = photo;
        return { value, merged };
    }

    function isPermissionDenied(err) {
        const text = String((err && (err.code || err.message)) || '').toLowerCase();
        return text.includes('permission_denied') || text.includes('permission denied');
    }

    // Pushes this device's save. `ref` is player_saves/<uid> (compat SDK ref).
    //   opts: { stateJson (or stateObj), progress, timestamp, photo }
    // Resolves { mode: 'progress' | 'state-only', progress } where `progress`
    // is the merged progress the device should keep (events preserved).
    async function pushSave(ref, opts) {
        let merged = XP.normalizeProgress(opts.progress);
        try {
            const res = await ref.transaction(current => {
                const built = buildPushValue(current, opts.stateJson || opts.stateObj, opts.progress, opts.timestamp, opts.photo);
                merged = built.merged;
                return built.value;
            }, undefined, false);
            if (!res.committed) throw new Error('transaction not committed');
            return { mode: 'progress', progress: XP.mergeProgress(opts.progress, merged) };
        } catch (err) {
            if (!isPermissionDenied(err)) throw err;
            // today's rules don't know `progress` yet: same backup as 1.1 does
            const value = { state: opts.stateJson || JSON.stringify(opts.stateObj), updatedAt: opts.timestamp };
            if (opts.photo) value.photo = opts.photo;
            await ref.set(value);
            return { mode: 'state-only', progress: XP.normalizeProgress(opts.progress) };
        }
    }

    // Reads player_saves/<uid> and merges its progress into the local one.
    // Returns { node, progress } (node may be null).
    async function pullProgress(ref, localProgress) {
        const snap = await ref.once('value');
        const node = snap.exists() ? snap.val() : null;
        return { node, progress: XP.mergeProgress(localProgress, fromCloudProgress(node && node.progress)) };
    }

    // The player chose "restore the cloud copy": the state (wallet included)
    // comes from the cloud, exactly like today; the progress is merged so it
    // is never lowered and no level is paid again. The protected node's
    // counters win over the ones inside the state string when both exist.
    function restoreFromNode(node, localProgress) {
        const cloudState = JSON.parse(node.state);
        const fromNode = node.progress ? fromCloudProgress(node.progress) : null;
        const backup = Object.assign({}, cloudState, {
            xpProgress: fromNode
                ? XP.mergeProgress(fromNode, cloudState.xpProgress || null)
                : cloudState.xpProgress
        });
        const progress = XS.progressAfterRestore(localProgress, backup);
        const state = Object.assign({}, cloudState, { level: XP.levelOf(progress) });
        delete state.gemsInBalance;
        return { state, progress };
    }

    // All XP counters a save node holds: the protected node's and the copy
    // inside the state string (the only one older rules allow), merged.
    function progressFromNode(node, stateObj) {
        const inState = stateObj && stateObj.xpProgress && typeof stateObj.xpProgress === 'object'
            ? XP.normalizeProgress(stateObj.xpProgress) : null;
        const inNode = node && node.progress ? fromCloudProgress(node.progress) : null;
        if (inState && inNode) return XP.mergeProgress(inNode, inState);
        return inNode || inState || null;
    }

    const api = {
        toCloudProgress, fromCloudProgress, buildPushValue,
        isPermissionDenied, pushSave, pullProgress, restoreFromNode, progressFromNode
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ZbangXPCloud = api;
})(typeof window !== 'undefined' ? window : globalThis);
