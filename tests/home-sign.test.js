// Tests for the signpost main menu on the home screen. Run with:  node --test tests/
// The five planks keep the old menu's order and actions; the city sign shows
// the active theme with its skyline and how far the next city is.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startSandbox, read, INDEX_HTML } = require('./sandbox.js');

const GAME_SRC = read('game.js');

// The sandbox swaps updateHomeUI for a no-op; put the real one back, with
// stand-ins for the theme helpers that live in themes.js.
function homeSandbox() {
    const g = startSandbox();
    g.run(GAME_SRC.match(/function updateHomeUI\(\) \{[\s\S]*?\n\}\n/)[0]);
    g.run(`citySceneUrl = i => 'url("city-' + i + '")'; islandSceneUrl = () => 'url("island")';`);
    const win = g.el('homeCityWindow');
    win.style.setProperty = (k, v) => { win.style[k] = v; };
    return g;
}

test('the signpost has the five planks in the old order, each with its old action', () => {
    const sign = INDEX_HTML.match(/<nav class="home-sign"[\s\S]*?<\/nav>/)[0];
    const actions = [...sign.matchAll(/<button class="sign-plank[^"]*" onclick="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(actions, [
        "openArenaScreen('homeScreen')", 'showGameModeSelection()', 'goToShop()', 'goToProfile()', 'showLeaderboard()'
    ]);
    assert.match(sign, /class="sign-plank sign-big sign-left green-btn"/, 'play is the big green plank');
    assert.doesNotMatch(INDEX_HTML, /class="arena-banner"|class="mega-btn|class="subtitle"/, 'old menu is gone');
});

test('nextCityProgress counts the trophies left to the next city', () => {
    const g = startSandbox();
    const p = t => g.run(`JSON.stringify(nextCityProgress(${t}))`);
    assert.equal(p(0), JSON.stringify({ next: 'אשדוד', left: 200 }));
    assert.equal(p(120), JSON.stringify({ next: 'אשדוד', left: 80 }));
    assert.equal(p(650), JSON.stringify({ next: 'ראשון לציון', left: 150 }));
    assert.equal(p(2999), JSON.stringify({ next: 'רמת גן', left: 1 }));
    assert.equal(p(3000), 'null', 'רמת גן is the last city');
    assert.equal(p(9999), 'null');
});

test('updateHomeUI fills the city sign, the window and the shop/profile lines', () => {
    const g = homeSandbox();
    g.run('gameState.trophies = 650; gameState.themeAuto = true; gameState.coins = 1250; gameState.level = 7; updateHomeUI();');
    assert.equal(g.el('homeArena').textContent, 'חיפה');
    assert.equal(g.el('homeCityNext').textContent, 'עוד 150 גביעים לראשון לציון');
    assert.equal(g.el('homeCityWindow').style['--sign-scene'], "url('city-3')", 'quotes swapped so the inline style stays valid');
    assert.equal(g.el('homeShopSub').textContent, 'יש לך 1250 מטבעות');
    assert.equal(g.el('homeProfileSub').textContent, 'רמה 7 · 650 גביעים');
});

test('the city sign follows a hand-picked theme, and the island shows its own scene', () => {
    const g = homeSandbox();
    g.run('gameState.trophies = 3100; gameState.themeAuto = false; gameState.preferredTheme = 0; updateHomeUI();');
    assert.equal(g.el('homeArena').textContent, 'מזכרת בתיה', 'the picked theme, not the trophy arena');
    assert.equal(g.el('homeCityNext').textContent, 'העיר האחרונה · אלופ/ת זבאנג', 'progress still follows the trophies');
    g.run('gameState.preferredTheme = ISLAND_THEME_INDEX; updateHomeUI();');
    assert.equal(g.el('homeArena').textContent, 'האי');
    assert.equal(g.el('homeCityWindow').style['--sign-scene'], "url('island')");
});
