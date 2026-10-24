// ============================================================================
// xp-cloud.js - how XP progress and level-up diamonds travel with the cloud
// save (player_saves/<uid>). Built on xp-engine.js.
//
// NOT CONNECTED YET: nothing loads this file. It is tested against the local
// Firebase Emulator (firebase-test/), never against the real project.
//
// Where things live
//   player_saves/<uid>/state     the existing JSON backup string (unchanged
//                                shape; 1.2 adds `gemsInBalance` and keeps
//                                `level` up to date so 1.1 shows it)
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
//   `diamonds` in the state is a wallet, last-writer-wins as always.
//   `gemsInBalance` says how many level-up diamonds that wallet already
//   includes. syncWallet() credits the difference to the total level-up
//   diamonds paid (from the merged counters), once - so a wallet restored
//   from any snapshot, or written by another device, ends up holding every
//   level-up reward exactly once.
// ============================================================================

(function (root) {
    'use strict';

    const XP = (typeof module !== 'undefined' && module.exports) ? require('./xp-engine.js') : root.ZbangXP;

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

    // Credits level-up diamonds the wallet doesn't hold yet. Never takes any away.
    function syncWallet(diamonds, gemsInBalance, progress) {
        const paid = XP.diamondsPaid(XP.normalizeProgress(progress));
        const have = Number.isFinite(gemsInBalance) && gemsInBalance > 0 ? gemsInBalance : 0;
        const credited = Math.max(0, paid - have);
        const wallet = Number.isFinite(diamonds) ? diamonds : 0;
        return { diamonds: wallet + credited, gemsInBalance: Math.max(have, paid), credited };
    }

    // The value a 1.2 push writes, given what is in the cloud right now.
    // Pure, so it can run inside a transaction (which may call it repeatedly).
    function buildPushValue(current, stateObj, localProgress, timestamp, photo) {
        const cloudProgress = fromCloudProgress(current && current.progress);
        const merged = XP.mergeProgress(localProgress, cloudProgress);
        const value = {
            state: JSON.stringify(stateObj),
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
    //   opts: { stateObj, progress, timestamp, photo }
    // Resolves { mode: 'progress' | 'state-only', progress } where `progress`
    // is the merged progress the device should keep (events preserved).
    async function pushSave(ref, opts) {
        let merged = XP.normalizeProgress(opts.progress);
        try {
            const res = await ref.transaction(current => {
                const built = buildPushValue(current, opts.stateObj, opts.progress, opts.timestamp, opts.photo);
                merged = built.merged;
                return built.value;
            }, undefined, false);
            if (!res.committed) throw new Error('transaction not committed');
            return { mode: 'progress', progress: XP.mergeProgress(opts.progress, merged) };
        } catch (err) {
            if (!isPermissionDenied(err)) throw err;
            // today's rules don't know `progress` yet: same backup as 1.1 does
            const value = { state: JSON.stringify(opts.stateObj), updatedAt: opts.timestamp };
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

    // The player chose "restore the cloud copy": the state comes from the
    // cloud, the progress is merged (never lowered), and the restored wallet
    // gets any level-up diamonds it is missing.
    function restoreFromNode(node, localProgress) {
        const cloudState = JSON.parse(node.state);
        const progress = XP.mergeProgress(localProgress, fromCloudProgress(node.progress));
        const wallet = syncWallet(cloudState.diamonds, cloudState.gemsInBalance, progress);
        const state = Object.assign({}, cloudState, {
            diamonds: wallet.diamonds,
            gemsInBalance: wallet.gemsInBalance,
            level: XP.levelOf(progress)
        });
        return { state, progress, credited: wallet.credited };
    }

    const api = {
        toCloudProgress, fromCloudProgress, syncWallet, buildPushValue,
        isPermissionDenied, pushSave, pullProgress, restoreFromNode
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ZbangXPCloud = api;
})(typeof window !== 'undefined' ? window : globalThis);
