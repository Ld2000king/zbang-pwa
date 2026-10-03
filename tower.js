// ============================================================================
// מגדל זבאנג - a SpellTower-style mode.
//
// The tower is a grid of letter columns. The player drags through ADJACENT
// letters (8 directions) to spell a word; those letters disappear, everything
// above falls down, and a new row rises from the bottom. When a column grows
// past the ceiling the game ends. Bonuses:
//   * a word of 5+ letters also blasts the letters orthogonally next to it
//   * a rare letter (starred) used in a word clears its whole row
//   * emptying the whole tower is worth TOWER_CLEAR_BONUS
//
// Self-contained on purpose: it has its own board state, rendering and
// pointer handling, so the square-board drag code in game.js (which has no
// adjacency check) stays untouched. currentGame.mode is set to 'tower' only so
// shared helpers (goHome, positionAboveBoard) know which board is live.
// ============================================================================

const TOWER_COLS = 6;
const TOWER_ROWS = 10;
const TOWER_START_ROWS = 5;
const TOWER_REFILL_ROWS = 3;      // rows added after the tower is fully cleared
const TOWER_CLEAR_BONUS = 1000;
const TOWER_POINTS_PER_TILE = 10;
const TOWER_MAX_SEARCH_DEPTH = 7;

// Same feel as generateBoard()'s weights, plus the letters it leaves out (כ ט צ)
const TOWER_LETTER_WEIGHTS = {
    'א': 8, 'ב': 3, 'ג': 2, 'ד': 3, 'ה': 8, 'ו': 4, 'ז': 1, 'ח': 2, 'ט': 1, 'י': 8,
    'כ': 3, 'ל': 6, 'מ': 5, 'נ': 5, 'ס': 1, 'ע': 1, 'פ': 1, 'צ': 1, 'ק': 1, 'ר': 8,
    'ש': 6, 'ת': 4
};
const TOWER_RARE_LETTERS = new Set(['ז', 'ט', 'ס', 'ע', 'פ', 'צ', 'ק']);

// cols[c] is a bottom-to-top array of letters; columns are always compact
// (no holes), so cell (c, r) exists iff r < cols[c].length.
const tower = {
    cols: [],
    score: 0,
    words: 0,
    clears: 0,
    busy: false,       // true while a removal animation is running
    isNewBest: false
};

let towerDragging = false;
let towerDragPath = []; // [{c, r}]

// ---- board generation ------------------------------------------------------

function towerRandomLetter() {
    const letters = Object.keys(TOWER_LETTER_WEIGHTS);
    const total = letters.reduce((s, l) => s + TOWER_LETTER_WEIGHTS[l], 0);
    let rand = Math.random() * total;
    for (const l of letters) {
        rand -= TOWER_LETTER_WEIGHTS[l];
        if (rand < 0) return l;
    }
    return letters[0];
}

// A short dictionary word to plant in a fresh row, so every new row brings
// at least one findable word with it.
function towerPlantWord() {
    const pool = dictionaryWordList().filter(w => w.length >= 3 && w.length <= 4 && /^[א-ת]+$/.test(w));
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';
}

// One new row of TOWER_COLS letters. The planted word is laid out right to
// left, so it reads naturally in Hebrew.
function towerGenerateRow() {
    const row = [];
    for (let c = 0; c < TOWER_COLS; c++) row.push(towerRandomLetter());
    const word = towerPlantWord();
    if (word) {
        const start = Math.floor(Math.random() * (TOWER_COLS - word.length + 1));
        for (let i = 0; i < word.length; i++) row[start + word.length - 1 - i] = word[i];
    }
    return row;
}

// Pushes a new row in at the bottom of every column (everything rises by one).
function towerAddRow() {
    const row = towerGenerateRow();
    for (let c = 0; c < TOWER_COLS; c++) tower.cols[c].unshift(row[c]);
}

function towerMaxHeight() {
    return Math.max(...tower.cols.map(col => col.length));
}

function towerIsEmpty() {
    return tower.cols.every(col => col.length === 0);
}

// ---- word search (stuck detection + hints) ---------------------------------

let towerPrefixSet = null;
let towerPrefixSource = null;

// Every proper prefix of every dictionary word, rebuilt only when the
// dictionary list itself changes (admin approvals / removals).
function towerPrefixes() {
    const words = dictionaryWordList();
    if (towerPrefixSet && towerPrefixSource === words) return towerPrefixSet;
    towerPrefixSet = new Set();
    for (const w of words) {
        for (let i = 1; i < w.length && i <= TOWER_MAX_SEARCH_DEPTH; i++) towerPrefixSet.add(w.slice(0, i));
    }
    towerPrefixSource = words;
    return towerPrefixSet;
}

function towerCell(c, r) {
    const col = tower.cols[c];
    return col && r >= 0 && r < col.length ? col[r] : null;
}

function towerAdjacent(a, b) {
    return Math.abs(a.c - b.c) <= 1 && Math.abs(a.r - b.r) <= 1 && !(a.c === b.c && a.r === b.r);
}

// Depth-first search for any dictionary word on the tower. Returns its path
// ([{c, r}]), preferring longer words, or null when the tower is stuck.
function towerFindWord() {
    const prefixes = towerPrefixes();
    let best = null;
    const path = [];
    const used = new Set();

    function dfs(c, r, word) {
        path.push({ c, r });
        used.add(c + ',' + r);
        if (word.length >= 3 && HEBREW_DICTIONARY[word] !== undefined && (!best || word.length > best.length)) {
            best = path.slice();
        }
        if (word.length < TOWER_MAX_SEARCH_DEPTH && prefixes.has(word)) {
            for (let dc = -1; dc <= 1; dc++) {
                for (let dr = -1; dr <= 1; dr++) {
                    const nc = c + dc, nr = r + dr;
                    const ch = towerCell(nc, nr);
                    if (ch && !used.has(nc + ',' + nr)) dfs(nc, nr, word + ch);
                }
            }
        }
        path.pop();
        used.delete(c + ',' + r);
    }

    for (let c = 0; c < TOWER_COLS; c++) {
        for (let r = 0; r < tower.cols[c].length; r++) {
            dfs(c, r, tower.cols[c][r]);
            if (best && best.length >= 5) return best;
        }
    }
    return best;
}

// ---- rendering -------------------------------------------------------------

// drops: optional map "c,r" -> rows the tile moved down since the last render
// (negative = moved up), used to animate the fall / rise.
function renderTower(drops) {
    const boardEl = document.getElementById('towerBoard');
    if (!boardEl) return;
    boardEl.innerHTML = '';
    for (let r = TOWER_ROWS - 1; r >= 0; r--) {
        for (let c = 0; c < TOWER_COLS; c++) {
            const ch = towerCell(c, r);
            const tile = document.createElement('div');
            if (!ch) {
                tile.className = 'tower-empty';
            } else {
                tile.className = 'letter-tile tower-tile';
                if (TOWER_RARE_LETTERS.has(ch)) tile.classList.add('tower-rare');
                tile.textContent = ch;
                tile.dataset.c = c;
                tile.dataset.r = r;
                const drop = drops && drops[c + ',' + r];
                if (drop) {
                    tile.style.setProperty('--drop', drop);
                    tile.classList.add('tower-fall');
                }
            }
            boardEl.appendChild(tile);
        }
    }

    const height = towerMaxHeight();
    boardEl.classList.toggle('tower-danger', height >= TOWER_ROWS - 2);
    const meter = document.getElementById('towerHeightFill');
    if (meter) meter.style.height = Math.min(100, (height / TOWER_ROWS) * 100) + '%';
    const meterWrap = document.getElementById('towerHeightMeter');
    if (meterWrap) meterWrap.classList.toggle('danger', height >= TOWER_ROWS - 2);
    document.getElementById('towerScoreDisplay').textContent = tower.score.toLocaleString('he-IL');
    document.getElementById('towerWordsDisplay').textContent = tower.words;

    boardEl.onpointerdown = (e) => {
        if (!currentGame.gameActive || currentGame.mode !== 'tower' || tower.busy) return;
        e.preventDefault();
        towerDragging = true;
        towerDragPath = [];
        towerDetectTileAt(e.clientX, e.clientY);
    };
}

function towerTileEl(c, r) {
    return document.querySelector(`#towerBoard .tower-tile[data-c="${c}"][data-r="${r}"]`);
}

function towerUpdateSelection() {
    document.querySelectorAll('#towerBoard .tower-tile.selected').forEach(t => t.classList.remove('selected'));
    towerDragPath.forEach(p => {
        const el = towerTileEl(p.c, p.r);
        if (el) el.classList.add('selected');
    });
    document.getElementById('towerWordDisplay').textContent =
        towerDragPath.map(p => towerCell(p.c, p.r)).join('');
}

// ---- input -----------------------------------------------------------------

document.addEventListener('pointermove', (e) => {
    if (!towerDragging) return;
    e.preventDefault();
    towerDetectTileAt(e.clientX, e.clientY);
}, { passive: false });

document.addEventListener('pointerup', () => {
    if (towerDragging) towerEndDrag();
});

document.addEventListener('pointercancel', () => {
    if (!towerDragging) return;
    towerDragging = false;
    towerDragPath = [];
    towerUpdateSelection();
});

// Same centre-radius test as detectTileAt() in game.js, plus the rules the
// square boards don't have: each letter must touch the previous one, and
// sliding back onto the previous letter un-picks the last one.
function towerDetectTileAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || !el.classList.contains('tower-tile')) return;

    const rect = el.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) * 0.42;
    if (Math.abs(x - (rect.left + rect.width / 2)) > radius ||
        Math.abs(y - (rect.top + rect.height / 2)) > radius) return;

    const cell = { c: parseInt(el.dataset.c, 10), r: parseInt(el.dataset.r, 10) };
    const same = p => p.c === cell.c && p.r === cell.r;
    const n = towerDragPath.length;

    if (n >= 2 && same(towerDragPath[n - 2])) {
        towerDragPath.pop();
        towerUpdateSelection();
        return;
    }
    if (towerDragPath.some(same)) return;
    if (n > 0 && !towerAdjacent(towerDragPath[n - 1], cell)) return;

    towerDragPath.push(cell);
    towerUpdateSelection();
}

function towerEndDrag() {
    towerDragging = false;
    const path = towerDragPath;
    towerDragPath = [];
    if (!currentGame.gameActive || currentGame.mode !== 'tower' || tower.busy || path.length === 0) {
        towerUpdateSelection();
        return;
    }

    const word = normalizeFinals(path.map(p => towerCell(p.c, p.r)).join(''));
    if (word.length < 3) {
        if (path.length > 1) showBoardMessage('קצר מדי!', 'error', 800);
        towerUpdateSelection();
        return;
    }
    if (HEBREW_DICTIONARY[word] === undefined) {
        showWordSubmitToast(word);
        towerUpdateSelection();
        return;
    }
    towerScoreWord(word, path);
}

// ---- scoring & removal -----------------------------------------------------

function towerWordMultiplier(len) {
    if (len >= 6) return 2;
    if (len === 5) return 1.5;
    return 1;
}

// Which cells a word removes: its own letters, the orthogonal neighbours of
// every letter for a 5+ letter word, and the whole row of any rare letter.
function towerCellsToRemove(path) {
    const remove = new Set(path.map(p => p.c + ',' + p.r));
    let blast = false, rowClear = false;

    if (path.length >= 5) {
        blast = true;
        path.forEach(p => {
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dc, dr]) => {
                if (towerCell(p.c + dc, p.r + dr)) remove.add((p.c + dc) + ',' + (p.r + dr));
            });
        });
    }
    path.forEach(p => {
        if (!TOWER_RARE_LETTERS.has(towerCell(p.c, p.r))) return;
        rowClear = true;
        for (let c = 0; c < TOWER_COLS; c++) {
            if (towerCell(c, p.r)) remove.add(c + ',' + p.r);
        }
    });
    return { remove, blast, rowClear };
}

function towerScoreWord(word, path) {
    const { remove, blast, rowClear } = towerCellsToRemove(path);
    const base = HEBREW_DICTIONARY[word] || pointsForWord(word);
    const points = Math.round(base * towerWordMultiplier(word.length)) + remove.size * TOWER_POINTS_PER_TILE;
    tower.score += points;
    tower.words++;

    showZabangCheer(points);
    if (rowClear) setTimeout(() => showBoardMessage('שורה שלמה התפוצצה!', 'success', 1000), 1150);
    else if (blast) setTimeout(() => showBoardMessage('פיצוץ!', 'success', 900), 1150);
    launchSparkles();

    tower.busy = true;
    remove.forEach(key => {
        const [c, r] = key.split(',').map(Number);
        const el = towerTileEl(c, r);
        if (el) { el.classList.remove('selected'); el.classList.add('tower-pop'); }
    });
    document.getElementById('towerWordDisplay').textContent = '';

    setTimeout(() => towerAfterRemoval(remove), 230);
}

function towerAfterRemoval(remove) {
    if (!currentGame.gameActive || currentGame.mode !== 'tower') { tower.busy = false; return; }

    // Collapse every column, remembering where each survivor came from.
    const origin = []; // origin[c][newR] = oldR
    for (let c = 0; c < TOWER_COLS; c++) {
        origin[c] = [];
        tower.cols[c] = tower.cols[c].filter((ch, r) => {
            if (remove.has(c + ',' + r)) return false;
            origin[c].push(r);
            return true;
        });
    }

    let addedRows = 1;
    if (towerIsEmpty()) {
        tower.score += TOWER_CLEAR_BONUS;
        tower.clears++;
        showBoardMessage(`ניקית את המגדל! +${TOWER_CLEAR_BONUS}`, 'cheer', 1600);
        launchConfetti();
        addedRows = TOWER_REFILL_ROWS;
    }
    for (let i = 0; i < addedRows; i++) towerAddRow();

    // stuck tower: keep adding rows (each brings a planted word) until a word exists
    let rescued = false;
    while (towerMaxHeight() <= TOWER_ROWS && !towerFindWord()) {
        towerAddRow();
        addedRows++;
        rescued = true;
    }
    if (rescued) setTimeout(() => showBoardMessage('לא נשארו מילים - נוספה שורה', 'info', 1200), 1150);

    const drops = {};
    for (let c = 0; c < TOWER_COLS; c++) {
        origin[c].forEach((oldR, newR) => {
            const delta = oldR - (newR + addedRows);
            if (delta) drops[c + ',' + (newR + addedRows)] = delta;
        });
    }

    renderTower(drops);
    tower.busy = false;

    if (towerMaxHeight() > TOWER_ROWS) {
        tower.busy = true;
        currentGame.gameActive = false;
        showBoardMessage('המגדל הגיע לתקרה!', 'error', 1400);
        setTimeout(towerGameOver, 1400);
    }
}

// ---- hint ------------------------------------------------------------------

function useTowerHint() {
    if (!currentGame.gameActive || currentGame.mode !== 'tower' || tower.busy) return;
    if (!canPayForItem('hint')) return;
    const path = towerFindWord();
    if (!path) { showBoardMessage('אין מילה כרגע', 'warning', 900); return; }
    consumeItemPayment('hint');
    saveGameState();
    path.forEach((p, i) => {
        const el = towerTileEl(p.c, p.r);
        if (!el) return;
        el.style.setProperty('--hint-step', i);
        el.classList.add('tower-hint');
        setTimeout(() => el.classList.remove('tower-hint'), 2200);
    });
}

// ---- lifecycle -------------------------------------------------------------

function startTower() {
    currentGame.mode = 'tower';
    currentGame.gameActive = true;
    currentGame.paused = false;
    tower.cols = Array.from({ length: TOWER_COLS }, () => []);
    tower.score = 0;
    tower.words = 0;
    tower.clears = 0;
    tower.busy = false;
    tower.isNewBest = false;
    towerDragging = false;
    towerDragPath = [];
    for (let i = 0; i < TOWER_START_ROWS; i++) towerAddRow();
    while (!towerFindWord() && towerMaxHeight() < TOWER_ROWS - 2) towerAddRow();

    document.getElementById('towerWordDisplay').textContent = '';
    showScreen('towerScreen');
    applyBoardTheme('towerBoard', preferredThemeIndex());
    renderTower();
    if (!gameState.towerTutorialSeen) showTowerHelp();
}

// ---- how to play -----------------------------------------------------------
// Opens by itself on the player's first tower game, and any time from the ?
// button. The overlay covers the board, so no drag can start while it's open.

function showTowerHelp() {
    towerDragging = false;
    towerDragPath = [];
    towerUpdateSelection();
    document.getElementById('towerHelpCloseBtn').textContent =
        gameState.towerTutorialSeen ? 'הבנתי' : 'בוא נתחיל!';
    document.getElementById('towerHelpOverlay').style.display = 'flex';
}

function closeTowerHelp() {
    document.getElementById('towerHelpOverlay').style.display = 'none';
    if (!gameState.towerTutorialSeen) {
        gameState.towerTutorialSeen = true;
        saveGameState();
    }
}

function towerGameOver() {
    tower.busy = false;
    currentGame.gameActive = false;
    const coins = Math.floor(tower.score / 10);
    gameState.coins += coins;
    gameState.totalScore += tower.score;
    gameState.gamesPlayed++;
    const prevBest = gameState.bestTowerScore || 0;
    tower.isNewBest = tower.score > prevBest && tower.score > 0;
    if (tower.isNewBest) gameState.bestTowerScore = tower.score;
    saveGameState();

    document.getElementById('trScore').textContent = tower.score.toLocaleString('he-IL');
    document.getElementById('trWords').textContent = tower.words;
    document.getElementById('trClears').textContent = tower.clears;
    document.getElementById('trCoins').textContent = `+${coins} מטבעות`;

    const lbBtn = document.getElementById('trLeaderboardBtn');
    const lbNote = document.getElementById('trLeaderboardNote');
    const canSubmit = tower.isNewBest && typeof FIREBASE_READY !== 'undefined'
        && FIREBASE_READY && db && gameState.playerId;
    lbBtn.style.display = canSubmit ? '' : 'none';
    lbBtn.disabled = false;
    lbBtn.innerHTML = '🏆 הוסף שיא לזבאנג רויאל';
    lbNote.style.display = tower.isNewBest ? 'block' : 'none';
    lbNote.textContent = `שיא חדש! ${tower.score.toLocaleString('he-IL')} נקודות`;

    updateHomeUI();
    showScreen('towerResultScreen');
}

function submitTowerScore() {
    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !db || !gameState.playerId) return;
    const btn = document.getElementById('trLeaderboardBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '✓ נוסף לזבאנג רויאל'; }
    if (typeof authReady === 'undefined') return;
    const score = gameState.bestTowerScore;
    authReady.then(user => writeLeaderboardEntry(leaderboardPath('tower'), gameState.playerId, user, score));
}

function quitTower() {
    if (currentGame.mode === 'tower' && currentGame.gameActive && tower.words > 0
        && !confirm('לצאת מהמגדל? ההתקדמות לא תישמר.')) return;
    goHome();
}
