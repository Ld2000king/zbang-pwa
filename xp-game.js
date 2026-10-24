// ============================================================================
// xp-game.js - connects the XP engine to the end of every round, from the
// outside: it wraps the game's existing round-end functions and never edits
// game.js, multiplayer.js or tower.js.
//
// CURRENT STATE: DRY RUN ONLY, OFF BY DEFAULT.
//   * Normally this file does nothing at all - no function is wrapped, and the
//     game runs exactly as before.
//   * Only when the page is opened with ?xp=dryrun (developer testing; the
//     native app never has a query string) it watches round ends and keeps a
//     log, in memory, of the XP each round WOULD earn. It never touches
//     gameState, localStorage, the cloud save or the player's diamonds.
// Real rewards (saving progress, paying diamonds) are not implemented here
// yet - that step needs the owner's approval first.
//
// Where a round counts as completed (from the existing code):
//   single   - endRound('single'): only the timer reaching 0 calls it
//   battle   - endBattleRound(): every round the clock ran out on
//   friends  - showMultiplayerRoundEnd / showMultiplayerResult: the host
//              wrote 'roundEnd' / 'finished' for the round
//   random   - showMultiplayerResult: a random match is one round
//   tower    - towerGameOver(): the only end of a tower game (a quit tower
//              is saved and resumed, so it never counts)
// Each reward's key: single:<start>, battle:<battle start>:<round>,
// mp:<room code>:<roundStartTime>, tower:<game-over time>.
// ============================================================================

(function () {
    'use strict';

    const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    const MODE = params && params.get('xp') === 'dryrun' ? 'dryrun' : 'off';
    const api = { mode: MODE, log: [], progress: null };
    window.ZbangXPGame = api;
    if (MODE === 'off' || !window.ZbangXP) return; // nothing installed

    const XP = window.ZbangXP;
    const INSTALL = 'dryrun-device';
    const ids = { single: null, battle: null };
    api.progress = XP.createProgress(typeof gameState !== 'undefined' && gameState.level > 1 ? gameState.level : 1);
    api.reset = () => { api.log.length = 0; api.progress = XP.createProgress(); };

    function record(round, key, eventTime) {
        const entry = { key, round, eligible: XP.isEligible(round), xp: XP.xpForRound(round) };
        if (entry.xp > 0) {
            const r = XP.applyReward(api.progress, INSTALL, key, entry.xp, eventTime);
            api.progress = r.progress;
            Object.assign(entry, {
                duplicate: r.duplicate, rejected: r.rejected || null,
                xpGained: r.xpGained, levelAfter: r.levelAfter, diamonds: r.diamonds
            });
        }
        api.log.push(entry);
        console.info('[XP dry-run]', entry);
    }

    // Replaces window[name] with a wrapper that always runs the original
    // first and unchanged; the XP part runs after it, inside try/catch, so it
    // can never change or break the game.
    function wrap(name, after, before) {
        const original = window[name];
        if (typeof original !== 'function') { console.warn('[XP dry-run] missing', name); return; }
        window[name] = function (...args) {
            let snapshot;
            try { if (before) snapshot = before(...args); } catch (e) { console.error('[XP dry-run]', e); }
            const result = original.apply(this, args);
            try { after(args, snapshot); } catch (e) { console.error('[XP dry-run]', e); }
            return result;
        };
    }

    // ---- single player ------------------------------------------------------
    wrap('startSinglePlayer', () => {
        if (currentGame.mode === 'single' && currentGame.gameActive) ids.single = Date.now();
    });
    wrap('endRound', ([mode]) => {
        if (mode !== 'single') return; // battle rounds are handled by endBattleRound
        record({
            mode: 'single', singleMode: currentGame.singleMode, completed: true,
            wordsFound: currentGame.foundWords.size
        }, XP.eventKey('single', ids.single), Date.now());
    });

    // ---- bots battle --------------------------------------------------------
    wrap('startBattleRoyale', () => {
        if (currentGame.mode === 'battle') ids.battle = Date.now();
    });
    wrap('endBattleRound', ([], before) => {
        const newlyOut = before.alive.filter(n => (battleState.players.find(b => b.name === n) || {}).eliminated);
        const survived = newlyOut.length > 0; // a bot went out instead of the player
        record({
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
        record(round, XP.eventKey('mp', MP.roomCode, room.roundStartTime), when);
    }
    wrap('showMultiplayerRoundEnd', ([room]) => multiplayerRound(room, false));
    wrap('showMultiplayerResult', ([room]) => multiplayerRound(room, true));

    // ---- tower (tower.js itself is not touched) ------------------------------
    wrap('towerGameOver', ([], before) => {
        const now = Date.now();
        record({ mode: 'tower', completed: true, wordsFound: before.words, clears: before.clears },
            XP.eventKey('tower', now), now);
    }, () => ({ words: tower.words, clears: tower.clears }));
})();
