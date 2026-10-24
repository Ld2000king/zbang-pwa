// ============================================================================
// xp-ui.js - what the player sees of XP: a level progress bar (home card and
// profile), the XP a round earned on its result screen, and a level-up
// message with the diamonds actually paid. Built from the existing island
// components (level badge, reward-box, menu-overlay bubble) and added from
// the outside - no game file is edited for it.
//
// Shows only what was really saved: xp-game.js calls ZbangXPUI.onReward()
// with the result of the save; a reward that wasn't saved is never shown as
// earned, and diamonds appear only when a level was actually gained.
//
// Language: Hebrew by default. If the English build's language switch
// (i18n.js, global ZBANG_LANG) is present and set to 'en', or the page is
// lang="en", the English texts are used. Direction comes from the page.
// ============================================================================

(function () {
    'use strict';

    const TEXT = {
        he: {
            level: n => `רמה ${n}`,
            progress: (a, b) => `${a} / ${b} XP`,
            barLabel: (lvl, a, b) => `רמה ${lvl}: ${a} מתוך ${b} נקודות ניסיון לרמה הבאה`,
            gained: x => `+${x} XP`,
            levelUpLine: (lvl, d) => `עלית לרמה ${lvl}! קיבלת ${d} יהלומים`,
            levelUpTitle: 'עלית רמה!',
            levelUpBody: (lvl, d) => `עלית לרמה ${lvl}! קיבלת ${d} יהלומים!`,
            cont: 'המשך',
            close: 'סגור',
            notSaved: 'ה-XP של הסיבוב הזה לא נשמר'
        },
        en: {
            level: n => `Level ${n}`,
            progress: (a, b) => `${a} / ${b} XP`,
            barLabel: (lvl, a, b) => `Level ${lvl}: ${a} of ${b} XP to the next level`,
            gained: x => `+${x} XP`,
            levelUpLine: (lvl, d) => `Level ${lvl}! +${d} diamonds`,
            levelUpTitle: 'Level up!',
            levelUpBody: (lvl, d) => `You reached level ${lvl}! You got ${d} diamonds!`,
            cont: 'Continue',
            close: 'Close',
            notSaved: "This round's XP couldn't be saved"
        }
    };

    function lang() {
        if (typeof ZBANG_LANG !== 'undefined' && ZBANG_LANG === 'en') return 'en';
        return document.documentElement.lang === 'en' ? 'en' : 'he';
    }
    const t = () => TEXT[lang()];
    const num = n => Number(n || 0).toLocaleString(lang() === 'en' ? 'en-US' : 'he-IL');

    const STAR = '<span class="icon xp-star" aria-hidden="true"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L14.6 8.6 L20.6 9.3 L16.1 13.4 L17.3 19.4 L12 16.4 L6.7 19.4 L7.9 13.4 L3.4 9.3 L9.4 8.6 Z"/></svg></span>';
    const diamondIcon = () => (typeof icon === 'function' ? icon('diamond') : '');
    // "60 / 100 XP" and "+23 XP" must read left-to-right even inside Hebrew text
    function ltr(str) {
        const span = document.createElement('span');
        span.dir = 'ltr';
        span.textContent = str;
        return span;
    }

    // ---- the progress bar ------------------------------------------------------

    function barMarkup(id) {
        return `<div class="xp-bar-wrap" id="${id}">
            <div class="xp-bar" role="progressbar" aria-valuemin="0"><div class="xp-bar-fill"></div></div>
            <div class="xp-bar-text"></div>
        </div>`;
    }

    function paintBar(wrap) {
        if (!wrap || typeof gameState === 'undefined') return;
        const into = Math.max(0, gameState.xp || 0);
        const need = Math.max(1, gameState.xpToNextLevel || 100);
        const pct = Math.min(100, Math.round(into / need * 100));
        const bar = wrap.querySelector('.xp-bar');
        wrap.querySelector('.xp-bar-fill').style.setProperty('--xp-pct', pct + '%');
        bar.setAttribute('aria-valuemax', String(need));
        bar.setAttribute('aria-valuenow', String(into));
        bar.setAttribute('aria-label', t().barLabel(gameState.level || 1, num(into), num(need)));
        const text = wrap.querySelector('.xp-bar-text');
        text.textContent = '';
        text.appendChild(ltr(t().progress(num(into), num(need))));
    }

    function homeBar() {
        let wrap = document.getElementById('homeXpBar');
        if (!wrap) {
            const badge = document.getElementById('levelBadge');
            if (!badge) return null;
            badge.insertAdjacentHTML('afterend', barMarkup('homeXpBar'));
            wrap = document.getElementById('homeXpBar');
        }
        return wrap;
    }

    function refreshHome() {
        const badge = document.getElementById('levelBadge');
        if (badge && typeof gameState !== 'undefined') badge.textContent = t().level(gameState.level || 1);
        paintBar(homeBar());
    }

    function refreshProfile() {
        const stats = document.getElementById('profileStats');
        if (!stats || document.getElementById('profileXpBar')) return paintBar(document.getElementById('profileXpBar'));
        const levelRow = stats.children[1]; // "רמה: N" - second row of renderProfile()
        if (!levelRow) return;
        levelRow.insertAdjacentHTML('afterend', barMarkup('profileXpBar'));
        paintBar(document.getElementById('profileXpBar'));
    }

    // ---- result screens -----------------------------------------------------------

    function activeResultHost() {
        const screen = document.querySelector('.screen.active');
        if (!screen) return null;
        return screen.querySelector('#victoryRewards') || screen.querySelector('.result-modal') || null;
    }

    function clearRoundBox(host) {
        const scope = host ? host.closest('.screen') : document;
        if (scope) scope.querySelectorAll('.xp-reward-box').forEach(el => el.remove());
    }

    function showRoundBox(host, result) {
        clearRoundBox(host);
        const box = document.createElement('div');
        box.className = 'reward-box xp-reward-box';
        box.setAttribute('role', 'status');
        let html = `<span class="xp-gained">${STAR}<span dir="ltr">${t().gained(num(result.xp))}</span></span>`;
        if (result.levelsGained > 0 && result.diamonds > 0) {
            html += `<span class="xp-levelup-line">${diamondIcon()}<span>${t().levelUpLine(num(result.levelAfter), num(result.diamonds))}</span></span>`;
        }
        box.innerHTML = html;
        const after = [...host.querySelectorAll('.reward-box')].filter(el => !el.classList.contains('xp-reward-box')).pop();
        if (after && after.parentNode === host) after.insertAdjacentElement('afterend', box);
        else if (host.id === 'victoryRewards') host.appendChild(box);
        else if (after) after.insertAdjacentElement('afterend', box);
        else host.insertBefore(box, host.querySelector('button') || null);
    }

    // ---- level-up message -------------------------------------------------------

    function celebrate(result) {
        let overlay = document.getElementById('xpLevelUpOverlay');
        if (!overlay) {
            document.body.insertAdjacentHTML('beforeend', `
                <div id="xpLevelUpOverlay" class="menu-overlay" style="display:none;">
                    <div class="menu-bubble daily-bubble xp-levelup-bubble" role="dialog" aria-modal="true" aria-labelledby="xpLevelUpTitle">
                        <button class="menu-close" id="xpLevelUpClose" aria-label="">&times;</button>
                        <div class="xp-levelup-badge" id="xpLevelUpBadge"></div>
                        <h2 class="menu-title" id="xpLevelUpTitle"></h2>
                        <p class="xp-levelup-body" id="xpLevelUpBody"></p>
                        <button class="btn-large gold-btn" id="xpLevelUpBtn"></button>
                    </div>
                </div>`);
            overlay = document.getElementById('xpLevelUpOverlay');
            const close = () => { overlay.style.display = 'none'; };
            overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
            document.getElementById('xpLevelUpClose').addEventListener('click', close);
            document.getElementById('xpLevelUpBtn').addEventListener('click', close);
        }
        document.getElementById('xpLevelUpClose').setAttribute('aria-label', t().close);
        document.getElementById('xpLevelUpBadge').textContent = num(result.levelAfter);
        document.getElementById('xpLevelUpTitle').textContent = t().levelUpTitle;
        document.getElementById('xpLevelUpBody').textContent = t().levelUpBody(num(result.levelAfter), num(result.diamonds));
        document.getElementById('xpLevelUpBtn').textContent = t().cont;
        overlay.style.display = 'flex';
        if (typeof launchConfetti === 'function') { try { launchConfetti(); } catch (e) { /* decoration only */ } }
        document.getElementById('xpLevelUpBtn').focus();
    }

    // ---- entry point from xp-game.js ----------------------------------------------

    function onReward(result) {
        if (!result) return;
        const host = activeResultHost();
        if (result.saved) {
            if (host) showRoundBox(host, result);
            refreshHome();
            if (result.levelsGained > 0 && result.diamonds > 0) celebrate(result);
            return;
        }
        if (result.reason === 'save-failed') {
            clearRoundBox(host);
            if (typeof showMessage === 'function') showMessage(t().notSaved, 'warning');
            return;
        }
        // nothing earned (no words, not completed): make sure no earlier round's
        // XP is still showing on this reused screen. A repeated event
        // ('duplicate') keeps the box its first, real reward put there.
        if (result.reason !== 'duplicate') clearRoundBox(host);
    }

    window.ZbangXPUI = { onReward, refreshHome, refreshProfile, text: TEXT, lang };

    // keep the bar in step with the existing home and profile renders
    function after(name, fn) {
        const original = window[name];
        if (typeof original !== 'function') return;
        window[name] = function (...args) {
            const out = original.apply(this, args);
            try { fn(); } catch (e) { console.error('[XP UI]', e); }
            return out;
        };
    }
    after('updateHomeUI', refreshHome);
    after('renderProfile', refreshProfile);
})();
