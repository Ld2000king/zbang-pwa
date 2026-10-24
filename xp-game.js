// ============================================================================
// xp-game.js - connects the XP engine to the game, from the outside: it wraps
// existing functions and never edits game.js, multiplayer.js or tower.js.
//
// FEATURE FLAG: XP_REWARDS_ENABLED below.
//   true  -> completed rounds earn XP and level-ups pay 15 diamonds each
//   false -> nothing is earned; progress already earned is kept and shown
// Developer testing only (the native app never has a query string):
//   ?xp=off     same as the flag being false
//   ?xp=dryrun  works out rewards into an in-memory log, saves nothing
//
// Always on, whatever the flag (so progress is never lost or lowered):
//   * a loaded save gets well-formed XP fields (xp-state.js ensureXpState)
//   * a restored cloud backup has its progress MERGED with this device's
//   * the backup carries the progress counters (cloudsave.js asks
//     xpProgressForCloud)
//
// Where a round counts as completed (from the existing code):
//   single   - endRound('single'): only the timer reaching 0 calls it
//   battle   - endBattleRound(): every round the clock ran out on
//   friends  - showMultiplayerRoundEnd / showMultiplayerResult: the host
//              wrote 'roundEnd' / 'finished' for the round
//   random   - showMultiplayerResult: a random match is one round
//   tower    - towerGameOver(): the only end of a tower game (a quit tower
//              is saved and resumed, so it never counts)
// Reward keys: single:<game id>, battle:<battle id>:<round>,
// mp:<room code>:<roundStartTime>, tower:<game-over id>.
// ============================================================================

const XP_REWARDS_ENABLED = true;

(function () {
    'use strict';

    const XP = window.ZbangXP, XS = window.ZbangXPState;
    const INSTALL_KEY = 'zabangInstallId';
    const param = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('xp') : null;
    const MODE = param === 'dryrun' ? 'dryrun' : (param === 'off' || !XP_REWARDS_ENABLED) ? 'off' : 'live';
    const api = { mode: MODE, log: [], results: [], dryProgress: null };
    window.ZbangXPGame = api;
    if (!XP || !XS) { console.error('[XP] engine not loaded'); return; }

    // ---- install id: one per install, kept apart from gameState so a cloud
    // restore never copies another device's id onto this one ----------------
    let installIdCache = null;
    function installId() {
        if (installIdCache) return installIdCache;
        let id = null;
        try { id = localStorage.getItem(INSTALL_KEY); } catch (e) { /* storage blocked */ }
        if (!XS.isValidInstallId(id)) {
            id = XS.newInstallId();
            try { localStorage.setItem(INSTALL_KEY, id); } catch (e) { /* rewards will refuse to save */ }
        }
        installIdCache = id;
        return id;
    }
    api.installId = installId;

    function wrap(name, after, before) {
        const original = window[name];
        if (typeof original !== 'function') { console.warn('[XP] missing', name); return; }
        window[name] = function (...args) {
            let snapshot;
            try { if (before) snapshot = before(...args); } catch (e) { console.error('[XP]', e); }
            const result = original.apply(this, args); // the game's own code, unchanged, first
            try { after(args, snapshot); } catch (e) { console.error('[XP]', e); }
            return result;
        };
    }

    // ---- always on: keep the save's XP fields sound --------------------------
    wrap('loadGameState', () => { XS.ensureXpState(gameState); });

    // cloudsave.js calls these (they are no-ops in older builds' absence)
    window.xpProgressForCloud = () => XS.progressForCloud(gameState.xpProgress);
    // after a restore copied the backup's fields over gameState: merge the
    // progress this device had, so a restore can never lower it
    window.xpAfterCloudRestore = (localProgressBefore, backupState) => {
        gameState.xpProgress = XS.progressAfterRestore(localProgressBefore, backupState);
        XS.syncDerived(gameState);
    };
    // "keep this device's progress": take in the cloud copy's counters first,
    // so other devices' XP isn't thrown away
    window.xpMergeCloudCopy = (cloudState) => {
        if (!cloudState || typeof cloudState.xpProgress !== 'object') return;
        XS.ensureXpState(gameState);
        XS.mergeIntoState(gameState, XP.normalizeProgress(cloudState.xpProgress));
    };

    // ---- granting -------------------------------------------------------------
    // Writes XP, level, diamonds and the reward key into gameState and saves
    // ONCE. If the save fails, everything is put back and the reward is
    // reported as not saved - never shown as if it was.
    function grant(round, key, eventTime) {
        if (MODE === 'dryrun') return dryRun(round, key, eventTime);
        const id = installId();
        let stored = null;
        try { stored = localStorage.getItem(INSTALL_KEY); } catch (e) { /* blocked */ }
        if (stored !== id) return note({ granted: false, saved: false, reason: 'no-install-id', key, round });
        XS.ensureXpState(gameState);
        const plan = XS.planGrant(gameState, id, round, key, eventTime);
        if (!plan.fields) return note(Object.assign({ saved: false, key, round }, plan.result));
        const before = {};
        for (const k of Object.keys(plan.fields)) before[k] = gameState[k];
        Object.assign(gameState, plan.fields);
        try {
            saveGameState();
        } catch (e) {
            Object.assign(gameState, before); // roll back: nothing was saved
            console.error('[XP] reward not saved:', e);
            return note(Object.assign({}, plan.result, { granted: false, saved: false, reason: 'save-failed', key, round }));
        }
        if (typeof updateHomeUI === 'function') { try { updateHomeUI(); } catch (e) { /* UI only */ } }
        return note(Object.assign({ saved: true, key, round }, plan.result));
    }
    api.grant = grant;

    function note(entry) {
        api.results.push(entry);
        if (api.results.length > 50) api.results.shift();
        // what the player sees comes from this saved result (xp-ui.js)
        if (window.ZbangXPUI) { try { window.ZbangXPUI.onReward(entry); } catch (e) { console.error('[XP UI]', e); } }
        return entry;
    }

    function dryRun(round, key, eventTime) {
        if (!api.dryProgress) api.dryProgress = XP.createProgress(gameState.level > 1 ? gameState.level : 1);
        const entry = { key, round, eligible: XP.isEligible(round), xp: XP.xpForRound(round) };
        if (entry.xp > 0) {
            const r = XP.applyReward(api.dryProgress, 'dryrun-device', key, entry.xp, eventTime);
            api.dryProgress = r.progress;
            Object.assign(entry, { duplicate: r.duplicate, rejected: r.rejected || null,
                xpGained: r.xpGained, levelAfter: r.levelAfter, diamonds: r.diamonds });
        }
        api.log.push(entry);
        return entry;
    }

    if (MODE === 'off') return; // no round hooks: nothing is earned

    // ---- single player ------------------------------------------------------
    // ids for the keys of games that have no id of their own: unique even for
    // two games started in the same millisecond
    let seq = 0;
    const uniqueId = () => Date.now().toString(36) + '-' + (++seq).toString(36) + Math.random().toString(36).slice(2, 7);
    const ids = { single: null, battle: null };
    wrap('startSinglePlayer', () => {
        if (currentGame.mode === 'single' && currentGame.gameActive) ids.single = uniqueId();
    });
    wrap('endRound', ([mode]) => {
        if (mode !== 'single') return; // battle rounds are handled by endBattleRound
        grant({
            mode: 'single', singleMode: currentGame.singleMode, completed: true,
            wordsFound: currentGame.foundWords.size
        }, XP.eventKey('single', ids.single), Date.now());
    });

    // ---- bots battle --------------------------------------------------------
    wrap('startBattleRoyale', () => {
        if (currentGame.mode === 'battle') ids.battle = uniqueId();
    });
    wrap('endBattleRound', ([], before) => {
        const newlyOut = before.alive.filter(n => (battleState.players.find(b => b.name === n) || {}).eliminated);
        const survived = newlyOut.length > 0; // a bot went out instead of the player
        grant({
            mode: 'battle', completed: true, wordsFound: before.words, survived,
            wonMatch: survived && before.round >= battleState.totalRounds
        }, XP.eventKey('battle', ids.battle, before.round), Date.now());
    }, () => ({
        round: battleState.currentRound,
        words: currentGame.foundWords.size,
        alive: battleState.players.filter(b => !b.eliminated).map(b => b.name)
    }));

    // ---- multiplayer (friends and random) -----------------------------------
    function multiplayerRound(room, final) {
        const me = room && room.players && room.players[MP.playerId];
        if (!me) return;
        // played this round = still in it, or knocked out by this very round
        const playedIt = !me.eliminated || room.loserId === MP.playerId;
        const words = playedIt ? currentGame.foundWords.size : 0;
        const won = final && !room.isDraw && room.winnerId === MP.playerId;
        const round = room.matchType === 'random'
            ? { mode: 'random', completed: playedIt, wordsFound: words, result: room.isDraw ? 'draw' : won ? 'win' : 'loss' }
            : { mode: 'friends', completed: playedIt, wordsFound: words, wonMatch: won };
        const when = Number.isFinite(room.roundStartTime) ? room.roundStartTime - (MP.serverOffset || 0) : Date.now();
        grant(round, XP.eventKey('mp', MP.roomCode, room.roundStartTime), when);
    }
    wrap('showMultiplayerRoundEnd', ([room]) => multiplayerRound(room, false));
    wrap('showMultiplayerResult', ([room]) => multiplayerRound(room, true));

    // ---- tower (tower.js itself is not touched) ------------------------------
    wrap('towerGameOver', ([], before) => {
        grant({ mode: 'tower', completed: true, wordsFound: before.words, clears: before.clears },
            XP.eventKey('tower', uniqueId()), Date.now());
    }, () => ({ words: tower.words, clears: tower.clears }));
})();
