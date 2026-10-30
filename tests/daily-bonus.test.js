// Tests for the daily bonus (1.2): the gift button and the bonus window live
// on the main menu only. Run with:  node --test tests/
// Amounts, eligibility, reset time and saving are unchanged - checked here too.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startSandbox, read } = require('./sandbox.js');

const GAME_CSS = read('game.css');
const OTHER_SCREENS = ['arenaScreen', 'instructionsScreen', 'gameModeScreen', 'singleModeScreen', 'battleDifficultyScreen',
    'mpChoiceScreen', 'mpJoinScreen', 'mpSearchScreen', 'mpLobbyScreen', 'gameScreen', 'battleScreen', 'singleResultScreen',
    'towerScreen', 'towerResultScreen', 'roundEndScreen', 'victoryScreen', 'shopScreen', 'profileScreen', 'wordBankScreen',
    'leaderboardScreen', 'accessibilityScreen'];

function bonusWaiting(g) {
    g.run(`gameState.lastDailyClaim = null; gameState.dailyStreak = 0; dailyPromptedFor = null; launchConfetti = () => {};`);
    g.el('dailyRewardOverlay').style.display = 'none';
}
const bonusOpen = g => g.el('dailyRewardOverlay').style.display === 'flex';
const onHome = g => g.ctx.document.body.classList.contains('on-home');

test('the gift button is marked visible on the main menu only', () => {
    const g = startSandbox();
    // CSS: hidden whenever the body is not marked as being on the main menu
    assert.match(GAME_CSS, /body:not\(\.on-home\) \.daily-fab \{ display: none; \}/);
    g.run(`showScreen('homeScreen')`);
    assert.ok(onHome(g), 'home');
    for (const id of OTHER_SCREENS) {
        g.run(`showScreen('${id}')`);
        assert.ok(!onHome(g), id);
    }
    g.run(`showScreen('homeScreen')`);
    assert.ok(onHome(g), 'back home');
    // first load (homeScreen is already active in the HTML, showScreen never runs for it)
    const g2 = startSandbox();
    g2.run(`updateBottomNav('homeScreen')`);
    assert.ok(onHome(g2));
});

for (const [label, start] of [
    ['single 1 min', `startSinglePlayer('quick')`],
    ['single 2 min', `startSinglePlayer('precise')`],
    ['bots easy', `startBattleRoyale('easy')`],
    ['bots hard', `startBattleRoyale('hard')`],
    ['tower', `gameState.towerTutorialSeen = true; startTower()`]
]) {
    test(`${label}: no gift button and no bonus pop-up during the game (also on app resume); it waits for the main menu`, () => {
        const g = startSandbox();
        bonusWaiting(g);
        g.run(start);
        assert.ok(!onHome(g));
        // what the focus / visibilitychange handlers run when the app comes back from the background
        g.run('maybeShowDailyReward()');
        assert.ok(!bonusOpen(g), 'no pop-up over the game');
        assert.equal(g.run('dailyPromptedFor'), null, "today's pop-up is not used up");
        assert.equal(g.run('dailyRewardAvailable()'), true, 'still eligible');
        g.run('goHome()');
        assert.ok(onHome(g));
        assert.ok(bonusOpen(g), 'shown on returning to the main menu');
    });
}

test('multiplayer screens: no pop-up on resume', () => {
    const g = startSandbox();
    bonusWaiting(g);
    for (const id of ['mpChoiceScreen', 'mpLobbyScreen', 'mpSearchScreen', 'battleScreen']) {
        g.run(`showScreen('${id}'); maybeShowDailyReward()`);
        assert.ok(!bonusOpen(g), id);
    }
    assert.equal(g.run('dailyPromptedFor'), null);
});

test('results, shop, profile, instructions...: no pop-up, and leaving the menu closes an open bonus window', () => {
    const g = startSandbox();
    bonusWaiting(g);
    for (const id of OTHER_SCREENS) {
        g.run(`showScreen('${id}'); maybeShowDailyReward()`);
        assert.ok(!bonusOpen(g), id);
    }
    g.run(`showScreen('homeScreen')`);
    assert.ok(bonusOpen(g));
    g.run(`showScreen('shopScreen')`);
    assert.ok(!bonusOpen(g), 'closed when leaving the main menu');
});

test('pop-up rules unchanged on the menu: once a day per session, gift button reopens it, claim works the same', () => {
    const g = startSandbox();
    bonusWaiting(g);
    g.run(`showScreen('homeScreen')`);
    assert.ok(bonusOpen(g));
    g.run('closeDailyReward()');                         // dismissed without claiming
    g.run(`showScreen('gameModeScreen'); showScreen('homeScreen')`);
    assert.ok(!bonusOpen(g), 'no nagging after a dismiss');
    assert.equal(g.run('dailyRewardAvailable()'), true, 'still eligible - the gift button opens it');
    g.run('showDailyReward()');                          // the gift button
    assert.ok(bonusOpen(g));

    const before = JSON.parse(g.run('JSON.stringify({ c: gameState.coins, d: gameState.diamonds })'));
    const reward = JSON.parse(g.run('JSON.stringify(dailyRewardFor(pendingDailyStreak()))'));
    g.run('claimDailyReward()');
    const after = JSON.parse(g.run('JSON.stringify({ c: gameState.coins, d: gameState.diamonds, last: gameState.lastDailyClaim, today: dateKey(), streak: gameState.dailyStreak })'));
    assert.equal(after.c, before.c + (reward.coins || 0));
    assert.equal(after.d, before.d + (reward.diamonds || 0));
    assert.equal(after.last, after.today);
    assert.equal(after.streak, 1);
    assert.equal(g.run('dailyRewardAvailable()'), false);
    assert.equal(JSON.parse(g.storage.get('zabangState')).lastDailyClaim, after.today, 'saved');
    // claimed: going home again never re-opens it
    g.run(`closeDailyReward(); showScreen('shopScreen'); showScreen('homeScreen')`);
    assert.ok(!bonusOpen(g));
});

test('bonus amounts and the 7-day cycle are unchanged', () => {
    const g = startSandbox();
    assert.deepEqual(JSON.parse(g.run('JSON.stringify(DAILY_REWARDS)')), [
        { coins: 50 }, { coins: 100 }, { coins: 150 }, { coins: 200 }, { coins: 250 }, { coins: 300 }, { coins: 400, diamonds: 15 }
    ]);
    // day 8 starts the cycle again
    assert.equal(g.run('JSON.stringify(dailyRewardFor(8))'), JSON.stringify({ coins: 50 }));
});
