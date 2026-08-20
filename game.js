// Escape HTML-significant characters before interpolating any user-controlled
// string (player names, etc.) into innerHTML - prevents stored XSS, since
// player names get shared across real clients in multiplayer mode.
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// Hebrew dictionary
const HEBREW_DICTIONARY = {
    'בית': 100, 'שלום': 250, 'זבאנג': 500, 'מחשב': 250, 'כלב': 100, 'חתול': 100, 'שולחן': 250, 'כיסא': 100, 'אוטו': 100,
    'אמא': 100, 'אבא': 100, 'אחות': 250, 'סבתא': 250, 'משפחה': 500, 'ילד': 100, 'ילדה': 100, 'אישה': 250, 'ספר': 100,
    'מחברת': 250, 'עיפרון': 250, 'תיק': 100, 'שמש': 100, 'ירח': 100, 'כוכב': 100, 'שמיים': 250, 'ארץ': 100, 'מים': 100,
    'רוח': 100, 'אדמה': 100, 'פרח': 100, 'דשא': 100, 'אבן': 100, 'נהר': 100, 'דרך': 100, 'רחוב': 100, 'עיר': 100, 'כפר': 100,
    'עבודה': 250, 'משחק': 100, 'כדור': 100, 'בובה': 100, 'אוכל': 100, 'לחם': 100, 'בשר': 100, 'חלב': 100, 'גבינה': 250,
    'ביצה': 100, 'תפוח': 100, 'בננה': 100, 'תפוז': 100, 'ענבים': 100, 'אבטיח': 250, 'מלון': 100, 'בוקר': 100,
    'צהריים': 250, 'ערב': 100, 'לילה': 100, 'יום': 100, 'שבוע': 100, 'חודש': 100, 'שנה': 100, 'אתמול': 100, 'היום': 100,
    'מחר': 100, 'שעון': 100, 'זמן': 100, 'רגע': 100, 'דקה': 100, 'שעה': 100, 'חבר': 100, 'חברה': 250, 'אהבה': 100,
    'שמחה': 100, 'עצב': 100, 'כעס': 100, 'פחד': 100, 'תקווה': 250, 'חלום': 100, 'מציאות': 250, 'אמת': 100, 'שקר': 100,
    'טוב': 100, 'יפה': 100, 'מכוער': 250, 'גדול': 100, 'קטן': 100, 'חדש': 100, 'ישן': 100, 'חם': 100, 'קר': 100,
    'אדום': 100, 'כחול': 100, 'ירוק': 100, 'צהוב': 100, 'לבן': 100, 'שחור': 100, 'עליון': 100, 'תחתון': 100, 'ימין': 100, 'שמאל': 100,

    // Animals
    'סוס': 100, 'פרה': 100, 'כבשה': 100, 'תרנגול': 250, 'ציפור': 250, 'נחש': 100, 'ארנב': 100, 'דוב': 100, 'אריה': 100,
    'נמר': 100, 'זאב': 100, 'שועל': 100, 'קוף': 100, 'פיל': 100, 'תולעת': 250, 'פרפר': 100, 'דבורה': 250, 'נמלה': 100,
    'עכביש': 250, 'עכבר': 100, 'חזיר': 100,

    // Food & drink
    'עוגה': 100, 'עוגיה': 250, 'גלידה': 250, 'שוקולד': 250, 'ממתק': 100, 'מיץ': 100, 'קפה': 100, 'סוכר': 100, 'מלח': 100,
    'פלפל': 100, 'בצל': 100, 'שום': 100, 'גזר': 100, 'מלפפון': 250, 'עגבניה': 250, 'חסה': 100, 'קמח': 100,

    // Family & people
    'תינוק': 250, 'נער': 100, 'נערה': 100, 'מורה': 100, 'רופא': 100, 'רופאה': 250, 'שוטר': 100, 'טבח': 100, 'נהג': 100,
    'חייל': 100, 'מלך': 100, 'מלכה': 100, 'נסיך': 100, 'נסיכה': 250, 'דוד': 100, 'דודה': 100, 'נכד': 100, 'נכדה': 100,

    // Nature & weather
    'גשם': 100, 'שלג': 100, 'ברד': 100, 'ענן': 100, 'ברק': 100, 'רעם': 100, 'קשת': 100, 'אגם': 100, 'גבעה': 100,
    'עמק': 100, 'מדבר': 100, 'יער': 100, 'עלה': 100, 'ענף': 100, 'שורש': 250, 'זרע': 100,

    // Home & objects
    'דלת': 100, 'חלון': 100, 'קיר': 100, 'רצפה': 100, 'תקרה': 100, 'מיטה': 100, 'כרית': 100, 'שמיכה': 250, 'מגבת': 100,
    'סבון': 100, 'מברשת': 250, 'מראה': 100, 'מנורה': 250, 'שטיח': 100, 'ארון': 100, 'מקרר': 100, 'תנור': 100, 'כיור': 100,
    'אמבטיה': 250, 'מטבח': 100, 'חדר': 100, 'מסדרון': 250,

    // School
    'לוח': 100, 'סרגל': 100, 'ילקוט': 250, 'כיתה': 100, 'מנהל': 100, 'תלמיד': 250, 'תלמידה': 250, 'בחינה': 250,
    'שיעור': 250, 'הפסקה': 250,

    // Body
    'ראש': 100, 'עין': 100, 'אוזן': 100, 'לשון': 100, 'רגל': 100, 'אצבע': 100, 'ברך': 100, 'כתף': 100, 'בטן': 100,
    'עור': 100, 'שיער': 100, 'ציפורן': 250,

    // Clothing
    'חולצה': 250, 'מכנסיים': 250, 'שמלה': 100, 'נעל': 100, 'גרב': 100, 'כובע': 100, 'מעיל': 100, 'חגורה': 250, 'כפפה': 100,

    // Transportation
    'אופניים': 250, 'רכבת': 100, 'מטוס': 100, 'ספינה': 250, 'אוטובוס': 250, 'מונית': 250, 'אופנוע': 250,

    // Music, sports & feelings
    'כדורגל': 250, 'כדורסל': 250, 'שחייה': 250, 'ריצה': 100, 'ניצחון': 250, 'הפסד': 100, 'גיטרה': 250, 'תוף': 100,
    'חליל': 100, 'שיר': 100, 'ריקוד': 250, 'צחוק': 100, 'בכי': 100,

    // Colors & descriptions
    'ורוד': 100, 'סגול': 100, 'אפור': 100, 'חום': 100, 'מהיר': 100, 'איטי': 100, 'חזק': 100, 'חלש': 100, 'עשיר': 100,
    'עני': 100, 'חכם': 100, 'טיפש': 100, 'אמיץ': 100, 'פחדן': 100,

    // Numbers
    'אחד': 100, 'שתיים': 250, 'שלוש': 100, 'ארבע': 100, 'חמש': 100, 'שבע': 100, 'שמונה': 250, 'תשע': 100, 'עשר': 100
};

// The board is built only from regular (non-final) Hebrew letter forms, so a
// word spelled with a final letter (שלום, לחם, ...) could never be matched
// against it. We normalize final forms to their regular counterparts
// everywhere - dictionary keys, planted words, and words the player drags -
// so those words become findable and every comparison is apples-to-apples.
const FINAL_LETTER_MAP = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

function normalizeFinals(str) {
    return str.replace(/[ךםןףץ]/g, c => FINAL_LETTER_MAP[c]);
}

// Rewrites HEBREW_DICTIONARY in place so every key uses regular letter forms.
// If two keys collapse to the same normalized word, keep the higher score.
function normalizeDictionary() {
    for (const key of Object.keys(HEBREW_DICTIONARY)) {
        const norm = normalizeFinals(key);
        if (norm === key) continue;
        HEBREW_DICTIONARY[norm] = Math.max(HEBREW_DICTIONARY[norm] || 0, HEBREW_DICTIONARY[key]);
        delete HEBREW_DICTIONARY[key];
    }
    invalidateDictionaryCache();
}

const SHOP_ITEMS = [
    { key: 'hint', icon: 'hint', name: 'רמז', desc: 'מסמן בלוח מילה שעוד לא מצאת', cost: 50 },
    { key: 'shuffle', icon: 'shuffle', name: 'ערבב לוח', desc: 'מחליף את אותיות הלוח', cost: 20 },
    { key: 'freeze', icon: 'freeze', name: 'הקפא זמן', desc: 'מקפיא את השעון ל-5 שניות', cost: 20 },
    { key: 'freezeOpponents', icon: 'freezeOpponents', name: 'הקפא יריבים', desc: 'באטל רויאל: מקפיא את הבוטים ל-8 שניות', cost: 20 },
    { key: 'tornado', icon: 'tornado', name: 'ערבב ליריבים', desc: 'באטל רויאל: חותך את ניקוד הבוטים בחצי', cost: 20 }
];

const BOT_NAMES = ['דני', 'מיכל', 'אורי', 'נועה', 'יוסי'];

// Arena progression - one tier per 200 trophies, named after Israeli cities
// ascending from a small town to the capital. Each arena also defines the
// board's visual skin (see applyBoardTheme, which writes the city's colors
// into inline CSS vars). Reaching an arena unlocks its theme for "preferred
// board".
const TROPHIES_PER_ARENA = 200;
// A tour of Israel from a quiet farming colony up to the glittering diamond
// exchange - 16 cities, one per 200-trophy tier (arena 15 = 3000+). Each city
// carries its character (tagline + motif) plus its own board skin: a solid
// flat tile color and a soft accent tint for the board's border/background
// (no animation - see applyBoardTheme). textLight flips tile text to white
// where the flat color is too dark for the default dark-on-light text.
const ARENAS = [
    { name: 'מזכרת בתיה',  tagline: 'מושבה חקלאית ותיקה',  motif: '🌾', tile: '#4CAF7D', accent: 'rgba(76, 175, 125, 0.35)' },   // 0-199
    { name: 'אשדוד',        tagline: 'עיר נמל דרומית',       motif: '⚓', tile: '#2E86C1', accent: 'rgba(46, 134, 193, 0.35)', textLight: true }, // 200-399
    { name: 'באר שבע',      tagline: 'בירת הנגב',            motif: '🏜️', tile: '#C8952E', accent: 'rgba(200, 149, 46, 0.35)' },   // 400-599
    { name: 'חיפה',         tagline: 'עיר הכרמל',            motif: '🌲', tile: '#1F9A7A', accent: 'rgba(31, 154, 122, 0.35)', textLight: true }, // 600-799
    { name: 'ראשון לציון',  tagline: 'עיר יין ומייסדים',     motif: '🍷', tile: '#A83B5C', accent: 'rgba(168, 59, 92, 0.35)',  textLight: true }, // 800-999
    { name: 'תל אביב',      tagline: 'העיר שלא נחה',         motif: '🏙️', tile: '#B23F94', accent: 'rgba(178, 63, 148, 0.35)', textLight: true }, // 1000-1199
    { name: 'ירושלים',      tagline: 'בירת הנצח',            motif: '👑', tile: '#C9A02B', accent: 'rgba(201, 160, 43, 0.35)' },   // 1200-1399
    { name: 'אילת',         tagline: 'עיר הנופש האדומה',     motif: '🐠', tile: '#CC5A38', accent: 'rgba(204, 90, 56, 0.35)',  textLight: true }, // 1400-1599
    { name: 'חדרה',         tagline: 'שער השרון',            motif: '🌉', tile: '#8A7355', accent: 'rgba(138, 115, 85, 0.35)', textLight: true }, // 1600-1799
    { name: 'טבריה',        tagline: 'עיר הכנרת',            motif: '🌊', tile: '#227C8F', accent: 'rgba(34, 124, 143, 0.35)', textLight: true }, // 1800-1999
    { name: 'אשקלון',       tagline: 'עיר חוף עתיקה',        motif: '🏖️', tile: '#3E8FA8', accent: 'rgba(62, 143, 168, 0.35)', textLight: true }, // 2000-2199
    { name: 'נתניה',        tagline: 'עיר היהלומים',         motif: '💎', tile: '#4A5FBD', accent: 'rgba(74, 95, 189, 0.35)',  textLight: true }, // 2200-2399
    { name: 'הרצליה',       tagline: 'עיר הייטק והים',       motif: '🏄', tile: '#5B4FCF', accent: 'rgba(91, 79, 207, 0.35)',  textLight: true }, // 2400-2599
    { name: 'פתח תקווה',    tagline: 'אם המושבות',           motif: '🏭', tile: '#C17B34', accent: 'rgba(193, 123, 52, 0.35)' },   // 2600-2799
    { name: 'רעננה',        tagline: 'עיר ירוקה ומטופחת',    motif: '🌳', tile: '#5E8A3A', accent: 'rgba(94, 138, 58, 0.35)',  textLight: true }, // 2800-2999
    { name: 'רמת גן',       tagline: 'עיר הבורסה והיהלומים', motif: '💠', tile: '#7B4FB0', accent: 'rgba(123, 79, 176, 0.35)', textLight: true }  // 3000+
];

// highest arena the trophy count reaches, capped at the last defined arena.
// The admin account is treated as top city with every theme unlocked.
function getArenaIndex(trophies) {
    if (isAdminAccount()) return ARENAS.length - 1;
    const tier = Math.floor((trophies || 0) / TROPHIES_PER_ARENA);
    return Math.max(0, Math.min(tier, ARENAS.length - 1));
}

function currentArena() {
    return ARENAS[getArenaIndex(gameState.trophies)];
}

// themes unlocked = every arena up to and including the current one
function isThemeUnlocked(themeIndex) {
    return themeIndex <= getArenaIndex(gameState.trophies);
}

// the player's preferred theme, clamped to what they've actually unlocked
// (trophies can drop on a loss and re-lock a previously chosen theme)
function preferredThemeIndex() {
    return Math.min(gameState.preferredTheme || 0, getArenaIndex(gameState.trophies));
}

// Applies an arena skin to a board container by writing the city's flat tile
// color and a soft static accent tint into inline CSS vars (no animation -
// see .arena-themed in game.css). renderBoard only clears innerHTML, so
// these survive re-renders within a round.
function applyBoardTheme(boardId, themeIndex) {
    const el = document.getElementById(boardId);
    if (!el) return;
    const arena = ARENAS[themeIndex] || ARENAS[0];
    el.classList.add('arena-themed');
    el.style.setProperty('--tile-bg', arena.tile);
    el.style.setProperty('--board-accent', arena.accent);
    el.style.setProperty('--tile-text', arena.textLight ? '#fff' : 'var(--text-dark)');
}

// Game State
let gameState = {
    playerName: 'שחקן',
    coins: 100,
    diamonds: 0,         // premium currency (blue diamonds) - buys exclusive avatars
    inventory: { hint: 3, shuffle: 0, freeze: 0, freezeOpponents: 0, tornado: 0 },
    totalScore: 0,
    gamesPlayed: 0,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    avatarId: 'dan',
    trophies: 0,
    preferredTheme: 0,
    ownedAvatars: [],
    musicEnabled: true,  // actual playback still gated on a user gesture, see initMusic()
    bestSingleScore: 0,  // personal best single-player score (shown on the leaderboard)
    playerId: null,      // stable per-device id for the global leaderboard entry
    lastDailyClaim: null, // 'YYYY-MM-DD' of the last claimed daily reward
    dailyStreak: 0        // consecutive-day login streak
};

// price of a premium ("cooler") profile picture - now paid in blue diamonds
const AVATAR_DIAMOND_COST = 20;

// Daily login reward: a 7-day cycle. The streak grows the coin bonus, and the
// 7th day pays a big finish + blue diamonds. Miss a day and the streak resets.
const DAILY_REWARDS = [
    { coins: 50 },
    { coins: 100 },
    { coins: 150 },
    { coins: 200 },
    { coins: 250 },
    { coins: 300 },
    { coins: 400, diamonds: 15 }
];

// Coins granted by watching a (mock) rewarded video ad.
const AD_REWARD_COINS = 50;

// Mock in-app coin packages. Prices are display-only placeholders in ILS -
// tapping "buy" just shows the store-coming-soon modal (no real payments).
const COIN_PACKAGES = [
    { name: 'שק מטבעות', coins: 500,  price: '₪4.90',  emoji: '💰' },
    { name: 'תיבת אוצר', coins: 1200, price: '₪9.90',  emoji: '🎁' },
    { name: 'אוצר ענק',  coins: 3000, price: '₪19.90', emoji: '💎' }
];

// words the admin has rejected (public rejected_words node), used to prune a
// player's local submission list. Populated by a Firebase listener in admin.js.
const rejectedWordsSet = new Set();

// Words the admin pulled OUT of the dictionary from the admin word-bank screen
// (public removed_words node). The expansion packs are static files that can't
// be edited at runtime, so a removal is stored as this shared blocklist and
// applied on top of them - on every device, not just the admin's. Normalized
// forms. Populated by a Firebase listener in admin.js.
const removedWordsSet = new Set();

let currentGame = {
    mode: null, // 'single' or 'battle'
    board: [],
    gridSize: 5,
    foundWords: new Set(),
    score: 0,
    timeLeft: 60,
    selectedIndices: new Set(),
    currentWord: '',
    gameActive: false,
    paused: false,
    timer: null,
    freezeLeft: 0,
    selectedLetters: []
};

let battleState = {
    currentRound: 1,
    totalRounds: 5,
    players: [],
    playerScore: 0,
    botsFrozenSeconds: 0,
    totalCoinsEarned: 0,
    botTimer: null,  // handle for the bots' scoring interval (see startBotAI/stopBotAI)
    difficulty: 'medium'
};

// Bot difficulty tiers (chosen before a Battle Royale). Each bot "searches"
// the board and finds a word roughly every minDelay..maxDelay ms - so a bot's
// score comes from finding real words at a human-like pace, not from arbitrary
// points every tick. Easy = slow, relaxed searching; hard = fast.
const BOT_DIFFICULTY = {
    easy:   { name: 'זבאנג התחלתי', minDelay: 7000, maxDelay: 13000 },
    medium: { name: 'זבאנג קלאסי',  minDelay: 4000, maxDelay: 7500 },
    hard:   { name: 'זבאנג מלכותי', minDelay: 2200, maxDelay: 4500 }
};

// Randomized "thinking time" until a bot's next find, within its tier's range.
function botFindDelay(tier) {
    return tier.minDelay + Math.random() * (tier.maxDelay - tier.minDelay);
}

// ---- dictionary scan helpers ----------------------------------------------
// The dictionary is big (12k+ words once the expansion packs are merged) and
// both collectBoardWords() and findWordOnBoard() sweep all of it - and
// findWordOnBoard() runs after every single word a player finds. Two cheap
// guards keep that sweep fast: the key list is cached (Object.keys() was
// allocating a 12k array per call) and a word is skipped outright when the
// board doesn't even contain one of its letters, which discards the vast
// majority before the position scan. The letter test ignores repeats, so it
// can only ever reject words that truly aren't on the board.
let dictionaryWordsCache = null;

function dictionaryWordList() {
    if (!dictionaryWordsCache) dictionaryWordsCache = Object.keys(HEBREW_DICTIONARY);
    return dictionaryWordsCache;
}

// Must be called by anything that adds/removes dictionary keys.
function invalidateDictionaryCache() {
    dictionaryWordsCache = null;
}

function wordUsesOnlyLetters(word, letters) {
    for (let i = 0; i < word.length; i++) {
        if (!letters.has(word[i])) return false;
    }
    return true;
}

// All valid dictionary words currently placed on the board, with their point
// value. This is the pool bots draw from when they "find" a word, so their
// score reflects real board words (right length/value distribution) instead of
// arbitrary increments. Scans both directions, like findWordOnBoard().
function collectBoardWords() {
    const size = currentGame.gridSize;
    const board = currentGame.board;
    const words = [];
    const seen = new Set();
    const letters = new Set(board);
    for (const word of dictionaryWordList()) {
        if (word.length < 3 || word.length > size || seen.has(word)) continue;
        if (!wordUsesOnlyLetters(word, letters)) continue;
        let onBoard = false;
        for (let r = 0; r < size && !onBoard; r++) {
            for (let c = 0; c <= size - word.length && !onBoard; c++) {
                let ok = true;
                for (let i = 0; i < word.length; i++) { if (board[r * size + c + i] !== word[i]) { ok = false; break; } }
                if (ok) onBoard = true;
            }
        }
        for (let c = 0; c < size && !onBoard; c++) {
            for (let r = 0; r <= size - word.length && !onBoard; r++) {
                let ok = true;
                for (let i = 0; i < word.length; i++) { if (board[(r + i) * size + c] !== word[i]) { ok = false; break; } }
                if (ok) onBoard = true;
            }
        }
        if (onBoard) { seen.add(word); words.push({ word: word, points: HEBREW_DICTIONARY[word] }); }
    }
    return words;
}

// Initialize
window.addEventListener('load', () => {
    const isFirstRun = !localStorage.getItem('zabangState'); // capture before loadGameState() fills in the default state
    loadGameState();
    normalizeDictionary();
    mergeExtraWords();
    loadCustomWords();
    applyRemovedWords(); // the blocklist may already be filled from a cached snapshot
    updateHomeUI();
    updateBottomNav('homeScreen'); // homeScreen starts .active in the HTML, showScreen() never runs for it
    initMusic();
    maybeShowDailyReward(); // pop the daily bonus if it's waiting
    if (isFirstRun) openNameModal(true); // brand-new player - must pick a name before playing
});

// Merge the expansion packs into the dictionary: words.js (EXTRA_WORDS, written
// with natural final letters) and words-bulk.js (EXTRA_WORDS_BULK, already
// normalized). Every word is normalized again here - a no-op for the bulk pack -
// so it's findable on the board, and duplicates against the base dictionary
// (and against each other) are skipped.
function mergeExtraWords() {
    const packs = [];
    if (typeof EXTRA_WORDS !== 'undefined') packs.push(EXTRA_WORDS);
    if (typeof EXTRA_WORDS_BULK !== 'undefined') packs.push(EXTRA_WORDS_BULK);

    packs.forEach(pack => pack.forEach(w => {
        const word = normalizeFinals(w);
        if (word.length >= 2 && HEBREW_DICTIONARY[word] === undefined && !removedWordsSet.has(word)) {
            HEBREW_DICTIONARY[word] = pointsForWord(word);
        }
    }));
    invalidateDictionaryCache();
}

// Drops every admin-removed word from the live dictionary. Called after the
// packs are merged and again whenever the removed_words listener fires, since
// that snapshot can land before or after any of the merges.
function applyRemovedWords() {
    let changed = false;
    removedWordsSet.forEach(word => {
        if (HEBREW_DICTIONARY[word] !== undefined) {
            delete HEBREW_DICTIONARY[word];
            changed = true;
        }
    });
    if (changed) invalidateDictionaryCache();
    return changed;
}

// ---- word bank (dictionary browser) ----------------------------------------
// Browsing the words the game knows needs no permissions - that's the whole
// point of the screen, and it's reachable from the menu for every player. The
// add/remove controls only render for a signed-in admin; those actions live in
// admin.js and the Security Rules are what actually enforce them.

const WORD_BANK_PAGE = 120; // 12k+ rows can't all live in the DOM at once

let wordBankQuery = '';
let wordBankShown = WORD_BANK_PAGE;
let wordBankMode = 'all';        // 'all' | 'removed'
let wordBankReturn = 'homeScreen'; // where the back button goes
let wordBankSorted = null;
let wordBankSortedFrom = null;

// Alphabetical dictionary keys, memoized against the key cache above so the
// sort only runs when the dictionary actually changed. Hebrew letters are
// contiguous and in alphabetical order in Unicode, so a plain compare sorts
// correctly and far faster than localeCompare over 12k words.
function sortedDictionaryWords() {
    const src = dictionaryWordList();
    if (wordBankSortedFrom !== src) {
        wordBankSortedFrom = src;
        wordBankSorted = src.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }
    return wordBankSorted;
}

function wordBankIsEditable() {
    return typeof isAdminUser === 'function' && isAdminUser()
        && typeof isSignedInAsAdmin === 'function' && isSignedInAsAdmin();
}

function openWordBank(from) {
    wordBankReturn = from || 'homeScreen';
    wordBankQuery = '';
    wordBankShown = WORD_BANK_PAGE;
    wordBankMode = 'all';
    const search = document.getElementById('wordBankSearch');
    if (search) search.value = '';
    const add = document.getElementById('wordBankAddInput');
    if (add) add.value = '';
    showScreen('wordBankScreen');
    renderWordBank();
}

function closeWordBank() {
    showScreen(wordBankReturn);
}

function onWordBankSearch(value) {
    wordBankQuery = value || '';
    wordBankShown = WORD_BANK_PAGE; // a new search always starts from the top
    renderWordBank();
}

function showMoreWordBankWords() {
    wordBankShown += WORD_BANK_PAGE;
    renderWordBank();
}

// Admin-only: flip between the live dictionary and the removed-words blocklist.
function toggleWordBankRemoved() {
    wordBankMode = wordBankMode === 'removed' ? 'all' : 'removed';
    wordBankShown = WORD_BANK_PAGE;
    renderWordBank();
}

// The rows to show, filtered by the search box. The query is normalized so
// typing a word with its natural final letter ("שלום") finds the stored form.
function wordBankMatches() {
    const q = normalizeFinals(wordBankQuery.trim());
    const all = wordBankMode === 'removed'
        ? Array.from(removedWordsSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        : sortedDictionaryWords();
    return q ? all.filter(w => w.includes(q)) : all;
}

function renderWordBank() {
    const listEl = document.getElementById('wordBankList');
    if (!listEl) return;

    // This screen is the only place the full dictionary is visible, so a
    // failure here must say so rather than leave a blank screen behind.
    try {
        const editable = wordBankIsEditable();
        const matches = wordBankMatches();
        const shown = matches.slice(0, wordBankShown);

        const editTools = document.getElementById('wordBankAdminTools');
        if (editTools) editTools.style.display = editable ? '' : 'none';

        const statsEl = document.getElementById('wordBankStats');
        if (statsEl) {
            const total = sortedDictionaryWords().length;
            statsEl.textContent = wordBankMode === 'removed'
                ? `${matches.length} מילים שהוסרו`
                : `${matches.length.toLocaleString('he-IL')} מילים${wordBankQuery ? ` מתוך ${total.toLocaleString('he-IL')}` : ' במאגר'}`;
        }

        const removedBtn = document.getElementById('wordBankRemovedToggle');
        if (removedBtn) {
            removedBtn.textContent = wordBankMode === 'removed'
                ? 'חזרה למאגר המלא'
                : `מילים שהוסרו (${removedWordsSet.size})`;
        }

        listEl.innerHTML = '';
        if (shown.length === 0) {
            listEl.innerHTML = '<p class="no-subs">לא נמצאו מילים</p>';
        } else {
            shown.forEach(word => listEl.appendChild(wordBankRow(word, editable)));
        }

        const moreBtn = document.getElementById('wordBankMoreBtn');
        if (moreBtn) {
            const rest = matches.length - shown.length;
            moreBtn.style.display = rest > 0 ? 'block' : 'none';
            moreBtn.textContent = `הצג עוד ${Math.min(rest, WORD_BANK_PAGE)} (נותרו ${rest.toLocaleString('he-IL')})`;
        }
    } catch (err) {
        console.error('Word bank render failed:', err);
        listEl.innerHTML = `<p class="no-subs">שגיאה בטעינת המאגר: ${escapeHtml(err.message)}</p>`;
    }
}

function wordBankRow(word, editable) {
    const row = document.createElement('div');
    row.className = 'submission-row dict-row';

    if (wordBankMode === 'removed') {
        row.innerHTML = `
            <span class="sub-word">${escapeHtml(word)}</span>
            <span class="sub-actions">
                <span class="sub-status sub-pending">הוסרה</span>
                ${editable ? `<button class="approve-btn">${icon('check')} החזר</button>` : ''}
            </span>`;
        const btn = row.querySelector('.approve-btn');
        if (btn) btn.onclick = () => adminRestoreWord(word);
        return row;
    }

    const points = HEBREW_DICTIONARY[word];
    const approved = typeof approvedWordsSet !== 'undefined' && approvedWordsSet.has(word);
    row.innerHTML = `
        <span class="sub-word">${escapeHtml(word)} <small>(+${points})</small></span>
        <span class="sub-actions">
            <span class="sub-status ${approved ? 'sub-approved' : 'sub-builtin'}">${approved ? 'מאושרת' : 'מובנית'}</span>
            ${editable ? `<button class="reject-btn">${icon('close')} הסר</button>` : ''}
        </span>`;
    const btn = row.querySelector('.reject-btn');
    if (btn) btn.onclick = () => adminRemoveWord(word);
    return row;
}

// Re-render only when the word bank is the visible screen (the Firebase
// listeners in admin.js fire on every device, usually with nothing on screen).
function refreshWordBank() {
    const screen = document.getElementById('wordBankScreen');
    if (screen && screen.classList.contains('active')) renderWordBank();
}

// Storage
function loadGameState() {
    const saved = localStorage.getItem('zabangState');
    if (saved) gameState = JSON.parse(saved);
    if (!gameState.avatarId) gameState.avatarId = 'dan';
    if (typeof gameState.trophies !== 'number') gameState.trophies = 0;
    if (typeof gameState.preferredTheme !== 'number') gameState.preferredTheme = 0;
    if (!Array.isArray(gameState.ownedAvatars)) gameState.ownedAvatars = [];
    if (typeof gameState.musicEnabled !== 'boolean') gameState.musicEnabled = true;
    if (typeof gameState.bestSingleScore !== 'number') gameState.bestSingleScore = 0;
    if (typeof gameState.diamonds !== 'number') gameState.diamonds = 0;
    if (typeof gameState.dailyStreak !== 'number') gameState.dailyStreak = 0;
    if (typeof gameState.lastDailyClaim === 'undefined') gameState.lastDailyClaim = null;
    // a stable per-device id so a player keeps a single leaderboard entry across
    // sessions (getMyPlayerId() in multiplayer.js is sessionStorage-based and
    // resets each session, so it's unsuitable for a persistent leaderboard row)
    if (!gameState.playerId) {
        gameState.playerId = (typeof db !== 'undefined' && db) ? db.ref().push().key
            : 'local-' + Date.now() + Math.random().toString(36).slice(2);
    }
    if (!gameState.inventory) gameState.inventory = {};
    // migrate the old single-counter hint field (pre-multi-item inventory) into the new shape
    if (typeof gameState.hints === 'number') {
        gameState.inventory.hint = gameState.hints;
        delete gameState.hints;
    }
    // make sure every shop item (including ones added after a save was created) has a counter
    SHOP_ITEMS.forEach(item => {
        if (typeof gameState.inventory[item.key] !== 'number') gameState.inventory[item.key] = 0;
    });
}

function saveGameState() {
    localStorage.setItem('zabangState', JSON.stringify(gameState));
}

// ===== Daily login reward =====
// Local-date keyed (not UTC) so "a new day" matches the player's own midnight.
function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dailyRewardAvailable() {
    return gameState.lastDailyClaim !== dateKey();
}

// The streak-day that WOULD be claimed today: continues yesterday's streak,
// otherwise restarts at day 1. (1-based)
function pendingDailyStreak() {
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (gameState.lastDailyClaim === dateKey(y)) return (gameState.dailyStreak || 0) + 1;
    return 1;
}

// Reward for a given 1-based streak day, cycling every 7 days.
function dailyRewardFor(streak) {
    return DAILY_REWARDS[(streak - 1) % DAILY_REWARDS.length];
}

function claimDailyReward() {
    if (!dailyRewardAvailable()) return;
    const streak = pendingDailyStreak();
    const reward = dailyRewardFor(streak);
    gameState.coins += reward.coins || 0;
    gameState.diamonds += reward.diamonds || 0;
    gameState.dailyStreak = streak;
    gameState.lastDailyClaim = dateKey();
    saveGameState();
    updateHomeUI();
    renderDailyReward(); // refresh the modal to its "claimed" state
    let msg = `יום ${((streak - 1) % 7) + 1}! קיבלת ${reward.coins} מטבעות`;
    if (reward.diamonds) msg += ` ו-${reward.diamonds} יהלומים`;
    showMessage(msg + '!', 'success');
    if (reward.diamonds) launchConfetti();
}

// Opens the daily-reward modal (also auto-opened on home load when available).
function showDailyReward() {
    renderDailyReward();
    const overlay = document.getElementById('dailyRewardOverlay');
    if (overlay) overlay.style.display = 'flex';
}

function closeDailyReward() {
    const overlay = document.getElementById('dailyRewardOverlay');
    if (overlay) overlay.style.display = 'none';
}

// Renders the 7-day track + claim button / claimed state into the modal.
function renderDailyReward() {
    const track = document.getElementById('dailyTrack');
    const btn = document.getElementById('dailyClaimBtn');
    const note = document.getElementById('dailyNote');
    if (!track || !btn || !note) return;

    const available = dailyRewardAvailable();
    const pending = pendingDailyStreak();
    const activeDay = ((pending - 1) % 7) + 1;         // highlighted day (1..7)
    const claimedDay = ((gameState.dailyStreak - 1) % 7) + 1;

    track.innerHTML = DAILY_REWARDS.map((r, i) => {
        const day = i + 1;
        const isToday = available && day === activeDay;
        const isDone = !available ? day <= claimedDay : day < activeDay;
        const cls = `daily-day${isToday ? ' today' : ''}${isDone ? ' done' : ''}`;
        const reward = r.diamonds
            ? `${icon('diamond', 'daily-ico')}${r.diamonds}`
            : `${icon('coin', 'daily-ico')}${r.coins}`;
        return `<div class="${cls}"><span class="daily-num">יום ${day}</span><span class="daily-reward">${reward}</span></div>`;
    }).join('');

    if (available) {
        btn.style.display = '';
        btn.disabled = false;
        btn.textContent = 'קבל בונוס';
        note.textContent = `רצף התחברות: ${pending} ימים`;
    } else {
        btn.style.display = 'none';
        note.textContent = 'כבר קיבלת היום — חזור מחר!';
    }
}

// Auto-pop the reward when it's waiting, but at most once per calendar day per
// session, so reopening/resuming the app (or dismissing without claiming)
// doesn't nag repeatedly. A genuinely new day re-arms it. The gift FAB always
// lets the player reopen it manually.
let dailyPromptedFor = null;
function maybeShowDailyReward() {
    if (!dailyRewardAvailable()) return;
    if (dailyPromptedFor === dateKey()) return;
    dailyPromptedFor = dateKey();
    showDailyReward();
}

// PWAs / installed apps usually RESUME from background instead of doing a full
// page load, so `window load` never re-fires on the next day's "login". Also
// check whenever the app becomes visible again - this is what makes the daily
// bonus actually appear when you reopen the game each day.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') maybeShowDailyReward();
});
window.addEventListener('focus', maybeShowDailyReward);

// ===== Background music =====
// A single continuous loop for the whole app - no per-screen switching, since
// showScreen() never touches anything outside #app and #bgMusic/#musicToggleBtn
// live outside #app as persistent global chrome.
function initMusic() {
    updateMusicButtonUI();
    const audio = document.getElementById('bgMusic');
    if (!audio) return;
    audio.volume = 0.5;
    attemptPlay();
    // Browsers block audio.play() before a user gesture - retry once on the
    // first tap/keypress anywhere. Harmless no-op if the immediate attempt
    // above already succeeded (e.g. gesture already happened).
    const unlock = () => {
        attemptPlay();
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
}

function attemptPlay() {
    const audio = document.getElementById('bgMusic');
    if (!audio || !gameState.musicEnabled) return;
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {}); // autoplay blocked or file missing - ignore silently
}

function toggleMusic() {
    gameState.musicEnabled = !gameState.musicEnabled;
    saveGameState();
    const audio = document.getElementById('bgMusic');
    if (audio) {
        if (gameState.musicEnabled) attemptPlay();
        else audio.pause();
    }
    updateMusicButtonUI();
}

function updateMusicButtonUI() {
    const btn = document.getElementById('musicToggleBtn');
    if (!btn) return;
    btn.innerHTML = icon(gameState.musicEnabled ? 'musicOn' : 'musicOff');
    btn.classList.toggle('muted', !gameState.musicEnabled);
}

// The admin/dev account. Grants infinite coins, infinite trophies, and
// every city/theme unlocked. Recognized two ways:
//  1. the local dev shortcut: player named 'ld2000'
//  2. a real Firebase admin sign-in (a non-anonymous account via
//     adminSignIn) - this is what actually matters when logging in as
//     admin on another device, where the display name isn't 'ld2000'
function isAdminAccount() {
    if (gameState.playerName.trim().toLowerCase() === 'ld2000') return true;
    if (typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) return true;
    return false;
}

function hasInfiniteCoins() {
    return isAdminAccount();
}

function coinsText() {
    return hasInfiniteCoins() ? '∞' : gameState.coins;
}

function trophiesText() {
    return isAdminAccount() ? '∞' : gameState.trophies;
}

// Trophies track ranked standing in random 1v1 multiplayer specifically
// (see showMultiplayerResult in multiplayer.js) - never let them go negative,
// same convention as most trophy/rank systems.
function awardTrophies(delta, label) {
    gameState.trophies = Math.max(0, (gameState.trophies || 0) + delta);
    saveGameState();
    updateHomeUI();
    if (delta !== 0) {
        showMessage(`${delta > 0 ? '+' : ''}${delta} גביעים (${label})`, delta > 0 ? 'success' : 'error');
    }
}

function updateHomeUI() {
    document.getElementById('playerName').textContent = gameState.playerName;
    document.getElementById('homeCoins').textContent = coinsText();
    document.getElementById('homeTrophies').textContent = trophiesText();
    document.getElementById('levelBadge').textContent = `רמה ${gameState.level}`;
    document.getElementById('shopCoins').textContent = coinsText();
    const diamondsTxt = isAdminAccount() ? '∞' : gameState.diamonds;
    const homeDiamondsEl = document.getElementById('homeDiamonds');
    if (homeDiamondsEl) homeDiamondsEl.textContent = diamondsTxt;
    const shopDiamondsEl = document.getElementById('shopDiamonds');
    if (shopDiamondsEl) shopDiamondsEl.textContent = diamondsTxt;
    document.getElementById('homeAvatar').innerHTML = getAvatarById(gameState.avatarId).svg;
    const arena = currentArena();
    const arenaEl = document.getElementById('homeArena');
    if (arenaEl) arenaEl.textContent = arena.name;
    const taglineEl = document.getElementById('homeCityTagline');
    if (taglineEl) taglineEl.textContent = arena.tagline;
    const motifEl = document.getElementById('homeCityMotif');
    if (motifEl) motifEl.textContent = arena.motif;
    // the banner expresses the current city's identity via a soft accent tint
    const bannerEl = document.querySelector('.arena-banner');
    if (bannerEl) bannerEl.style.setProperty('--banner-accent', arena.accent);
}

// Arena picker screen - swipeable card carousel over ARENAS, replacing the
// old <select> dropdown. Cards reuse onThemeSelect()'s existing lock-check/
// save logic; only the picker UI itself is new.
let arenaObserver = null;

function openArenaScreen() {
    showScreen('arenaScreen');
    renderArenaCarousel();
    // land on the player's current selection instead of always card 0
    const pref = preferredThemeIndex();
    const card = document.querySelector(`.arena-card[data-index="${pref}"]`);
    if (card) card.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function closeArenaScreen() {
    showScreen('homeScreen');
}

function renderArenaCarousel() {
    const track = document.getElementById('arenaCarousel');
    const dots = document.getElementById('arenaDots');
    if (!track || !dots) return;
    const pref = preferredThemeIndex();

    track.innerHTML = ARENAS.map((a, i) => {
        const locked = !isThemeUnlocked(i);
        const current = i === pref;
        const motifColor = a.textLight ? '#fff' : 'var(--text-dark)';
        let bodyExtra;
        if (locked) {
            const needed = (i * TROPHIES_PER_ARENA) - (gameState.trophies || 0);
            bodyExtra = `<p class="arena-card-req">${needed.toLocaleString('he-IL')} גביעים נוספים לפתיחה</p>`;
        } else if (current) {
            bodyExtra = `<span class="arena-card-badge">✓ בלוח שלך</span>`;
        } else {
            bodyExtra = `<button class="arena-card-select-btn" onclick="onArenaCardTap(${i})">בחירה</button>`;
        }
        return `
            <div class="arena-card${locked ? ' arena-locked' : ''}${current ? ' arena-current' : ''}"
                 style="--arena-tile:${a.tile}; --arena-accent:${a.accent}; --arena-motif-color:${motifColor};"
                 data-index="${i}"
                 ${locked ? `onclick="onArenaCardLockedTap(${i})"` : ''}>
                <div class="arena-card-art">
                    <span class="arena-card-motif">${a.motif}</span>
                    ${locked ? '<span class="arena-lock">🔒</span>' : ''}
                </div>
                <div class="arena-card-body">
                    <h3 class="arena-card-name">${a.name}</h3>
                    <p class="arena-card-tagline">${a.tagline}</p>
                    ${bodyExtra}
                </div>
            </div>`;
    }).join('');

    dots.innerHTML = ARENAS.map((_, i) => `<span class="arena-dot${i === pref ? ' active' : ''}" data-index="${i}"></span>`).join('');

    // dot-sync via IntersectionObserver rather than scrollLeft math, which
    // has inconsistent sign/zero-point conventions across engines under RTL
    if (arenaObserver) arenaObserver.disconnect();
    arenaObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const idx = entry.target.dataset.index;
                document.querySelectorAll('.arena-dot').forEach(d => d.classList.toggle('active', d.dataset.index === idx));
            }
        });
    }, { root: track, threshold: 0.6 });
    track.querySelectorAll('.arena-card').forEach(c => arenaObserver.observe(c));
}

function onArenaCardTap(idx) {
    onThemeSelect(idx);
    renderArenaCarousel();
    showMessage(`נבחר: ${ARENAS[idx].motif} ${ARENAS[idx].name}`, 'success');
}

function onArenaCardLockedTap(idx) {
    const needed = (idx * TROPHIES_PER_ARENA) - (gameState.trophies || 0);
    showMessage(`עיר נעולה - ${needed.toLocaleString('he-IL')} גביעים נוספים לפתיחה`, 'warning');
}

function onThemeSelect(value) {
    const idx = parseInt(value, 10);
    if (isNaN(idx) || !isThemeUnlocked(idx)) { renderArenaCarousel(); return; }
    gameState.preferredTheme = idx;
    saveGameState();
}

// Navigation
const TAB_SCREENS = ['homeScreen', 'shopScreen', 'profileScreen', 'leaderboardScreen'];

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    // Long screens (like the profile) may leave the page scrolled down -
    // every screen should open from its top
    window.scrollTo(0, 0);
    updateBottomNav(screenId);
}

// Shows/hides the fixed bottom tab bar and syncs its active tab - only the
// 4 main hub screens get it, every drill-down/modal/in-game screen doesn't
function updateBottomNav(screenId) {
    document.body.classList.toggle('has-bottom-nav', TAB_SCREENS.includes(screenId));
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        const active = btn.dataset.screen === screenId;
        btn.classList.toggle('active', active);
        if (active) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
    });
}

function goHome() {
    if (currentGame.timer) clearInterval(currentGame.timer);
    currentGame.gameActive = false; // stop any game loops still checking this flag
    currentGame.paused = false;      // clear any pause state / overlay when leaving
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (pauseOverlay) pauseOverlay.style.display = 'none';
    stopBotAI();                     // kill the bots interval so it can't leak into a later game
    // Multiplayer: detach Firebase listeners / leave the room before going home
    if (currentGame.mode === 'multiplayer' && typeof leaveMultiplayerRoom === 'function') {
        leaveMultiplayerRoom();
    }
    showScreen('homeScreen');
    updateHomeUI();
}

function showGameModeSelection() {
    showScreen('gameModeScreen');
}

function showInstructions() {
    showScreen('instructionsScreen');
}

function showAccessibilityStatement() {
    showScreen('accessibilityScreen');
}

function openMenu() {
    const el = document.getElementById('menuOverlay');
    if (el) el.style.display = 'flex';
}

function closeMenu() {
    const el = document.getElementById('menuOverlay');
    if (el) el.style.display = 'none';
}

function goToShop() {
    renderShop();
    showScreen('shopScreen');
}

function goToProfile() {
    renderProfile();
    showScreen('profileScreen');
}

// Board Generation
function generateBoard() {
    const hebrewLetters = 'אבגדהוזחטיכלמנסעפצקרשת';
    const weights = { 'א': 8, 'ב': 3, 'ג': 2, 'ד': 3, 'ה': 8, 'ו': 4, 'ז': 1, 'ח': 2, 'י': 8, 'ל': 6, 'מ': 5, 'נ': 5, 'ס': 1, 'ע': 1, 'פ': 1, 'ק': 1, 'ר': 8, 'ש': 6, 'ת': 4 };

    let board = [];
    for (let i = 0; i < currentGame.gridSize * currentGame.gridSize; i++) {
        board.push('');
    }

    // Plant some words
    const words = Array.from(Object.keys(HEBREW_DICTIONARY)).sort(() => Math.random() - 0.5).slice(0, 5);

    for (let word of words) {
        let planted = false;
        for (let attempt = 0; attempt < 20 && !planted; attempt++) {
            const horizontal = Math.random() > 0.5;
            const row = Math.floor(Math.random() * currentGame.gridSize);
            const col = Math.floor(Math.random() * currentGame.gridSize);

            if (horizontal && col + word.length <= currentGame.gridSize) {
                let canPlace = true;
                for (let i = 0; i < word.length; i++) {
                    if (board[row * currentGame.gridSize + col + i] !== '' && board[row * currentGame.gridSize + col + i] !== word[i]) {
                        canPlace = false;
                        break;
                    }
                }
                if (canPlace) {
                    for (let i = 0; i < word.length; i++) {
                        board[row * currentGame.gridSize + col + i] = word[i];
                    }
                    planted = true;
                }
            } else if (!horizontal && row + word.length <= currentGame.gridSize) {
                let canPlace = true;
                for (let i = 0; i < word.length; i++) {
                    if (board[(row + i) * currentGame.gridSize + col] !== '' && board[(row + i) * currentGame.gridSize + col] !== word[i]) {
                        canPlace = false;
                        break;
                    }
                }
                if (canPlace) {
                    for (let i = 0; i < word.length; i++) {
                        board[(row + i) * currentGame.gridSize + col] = word[i];
                    }
                    planted = true;
                }
            }
        }
    }

    // Fill remaining
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            const letters = Object.keys(weights);
            const rand = Math.random() * Object.values(weights).reduce((a, b) => a + b);
            let sum = 0;
            for (let letter of letters) {
                sum += weights[letter];
                if (rand < sum) {
                    board[i] = letter;
                    break;
                }
            }
        }
    }

    return board;
}

// Render board
function renderBoard(boardId = 'board') {
    const boardEl = document.getElementById(boardId);
    boardEl.innerHTML = '';

    currentGame.board.forEach((letter, idx) => {
        const tile = document.createElement('div');
        tile.className = 'letter-tile';
        tile.textContent = letter;
        tile.dataset.index = idx;
        boardEl.appendChild(tile);
    });

    boardEl.onpointerdown = (e) => {
        if (!currentGame.gameActive || isBoardInputFrozen()) return;
        e.preventDefault();
        isDragging = true;
        dragPath = [];
        detectTileAt(e.clientX, e.clientY);
    };
}

// Drag logic - works on both mouse and touch.
// Detection runs at document level with elementFromPoint, because on
// touch devices the pointer gets captured by the first tile touched.
let isDragging = false;
let dragPath = [];

document.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    detectTileAt(e.clientX, e.clientY);
}, { passive: false });

document.addEventListener('pointerup', () => {
    if (isDragging) endDrag();
});

document.addEventListener('pointercancel', () => {
    if (isDragging) cancelDrag();
});

// ---- freeze gate -----------------------------------------------------------
// A freeze has to actually STOP the frozen player. Pausing their timer display
// (the old behaviour) was purely cosmetic: they could keep dragging words,
// scoring and firing power-ups, so "הקפא יריבים" did nothing in multiplayer.
// mpFreezeMsLeft() (multiplayer.js) is the single source of truth; in bots mode
// it doesn't exist / returns 0, because there only the bots ever get frozen.
function isBoardInputFrozen() {
    return typeof mpFreezeMsLeft === 'function' && mpFreezeMsLeft() > 0;
}

// Guard for every player action. Returns true (and nags) while frozen.
function blockedByFreeze() {
    if (!isBoardInputFrozen()) return false;
    showBoardMessage('אתה מוקפא!', 'warning', 800);
    return true;
}

// Aborts an in-flight drag - used when a freeze lands mid-drag.
function cancelDrag() {
    isDragging = false;
    dragPath = [];
    clearSelection();
}

function detectTileAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || !el.classList.contains('letter-tile')) return;

    // Only register when the finger is near the tile center,
    // so neighboring letters aren't picked up by accident
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.min(rect.width, rect.height) * 0.42;
    if (Math.abs(x - cx) > radius || Math.abs(y - cy) > radius) return;

    const idx = parseInt(el.dataset.index, 10);
    if (!dragPath.includes(idx)) {
        dragPath.push(idx);
        updateSelection();
    }
}

function endDrag() {
    isDragging = false;
    // a freeze that landed mid-drag voids the word instead of scoring it
    if (isBoardInputFrozen()) { cancelDrag(); return; }
    // board is all-regular forms, but normalize defensively so lookups match
    const word = normalizeFinals(dragPath.map(i => currentGame.board[i]).join(''));

    if (word.length < 3) {
        showBoardMessage('קצר מדי!', 'error', 800);
    } else if (HEBREW_DICTIONARY[word] === undefined) {
        showWordSubmitToast(word);
    } else if (currentGame.foundWords.has(word)) {
        showBoardMessage('כבר מצאת!', 'warning', 850);
    } else {
        const points = HEBREW_DICTIONARY[word];
        currentGame.foundWords.add(word);
        currentGame.score += points;

        if (currentGame.mode === 'single') {
            document.getElementById('scoreDisplay').textContent = currentGame.score;
        } else if (currentGame.mode === 'multiplayer') {
            currentGame.playerScore += points;
            document.getElementById('playerBattleScore').textContent = currentGame.playerScore;
            // Write the new total to Firebase so opponents see it live
            if (typeof submitMultiplayerWord === 'function') submitMultiplayerWord(word, currentGame.playerScore);
        } else {
            currentGame.playerScore += points;
            document.getElementById('playerBattleScore').textContent = currentGame.playerScore;
        }

        updateFoundWords();
        showZabangCheer(points); // themed "זבאנג!" cheer above the board
        launchSparkles();
        autoShuffleIfExhausted();
    }

    dragPath = [];
    clearSelection();
}

function activeBoardId() {
    // 'battle' and 'multiplayer' both use the battle board; only 'single' uses #board
    return currentGame.mode === 'single' ? 'board' : 'battleBoard';
}

// Called after any word is found (drag or hint) - if no valid unfound
// words remain on the board, reshuffle it automatically so play can continue
function autoShuffleIfExhausted() {
    if (findWordOnBoard().length === 0) {
        currentGame.board = currentGame.board.sort(() => Math.random() - 0.5);
        renderBoard(activeBoardId());
        showBoardMessage('נגמרו המילים — הלוח עורבב!', 'info', 1100);
    }
}

function updateSelection() {
    document.querySelectorAll(`#${activeBoardId()} .letter-tile`).forEach(tile => {
        const idx = parseInt(tile.dataset.index, 10);
        tile.classList.toggle('selected', dragPath.includes(idx));
    });

    const word = dragPath.map(i => currentGame.board[i]).join('');
    const display = document.getElementById(currentGame.mode === 'single' ? 'currentWordDisplay' : 'battleWordDisplay');
    display.textContent = word;
}

function clearSelection() {
    document.querySelectorAll('.letter-tile').forEach(tile => tile.classList.remove('selected'));
    const display = document.getElementById(currentGame.mode === 'single' ? 'currentWordDisplay' : 'battleWordDisplay');
    display.textContent = '';
}

// Messages
function showMessage(msg, type = 'info') {
    const msgEl = document.createElement('div');
    msgEl.className = `message ${type}`;
    msgEl.textContent = msg;
    document.body.appendChild(msgEl);
    setTimeout(() => msgEl.remove(), 2000);
}

// ---- Above-the-board messages ----------------------------------------------
// In-game feedback shows just ABOVE the active board (never over it) and for a
// short time, so the player can keep hunting words without the toast covering
// the letters. Position is measured live from the board so it stays correct
// across screen sizes and both boards (single #board / battle #battleBoard).
function positionAboveBoard(el) {
    const boardEl = document.getElementById(activeBoardId());
    if (!boardEl) { // fallback: near the top
        el.style.left = '50%';
        el.style.top = '14%';
        el.style.transform = 'translate(-50%, 0)';
        return;
    }
    const r = boardEl.getBoundingClientRect();
    el.style.left = (r.left + r.width / 2) + 'px';
    el.style.top = (r.top - 8) + 'px';
    el.style.transform = 'translate(-50%, -100%)'; // sit just above the board
}

function showBoardMessage(msg, type = 'info', duration = 1000) {
    const el = document.createElement('div');
    el.className = `board-msg ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    positionAboveBoard(el);
    setTimeout(() => el.classList.add('leaving'), Math.max(0, duration - 220));
    setTimeout(() => el.remove(), duration);
}

// Themed "זבאנג!" celebration on every found word, tiered by the word's value
// so bigger finds get a bigger cheer. Shown above the board like other in-game
// feedback.
const ZABANG_CHEERS = {
    big:   ['זבאנג של מלך!', 'זבאנג מלכותי!', 'איזה זבאנג ענק!', 'זבאנג אגדי!', 'זבאנג על!'],
    mid:   ['איזה זבאנג!', 'זבאנג חזק!', 'זבאנג מטורף!', 'בום זבאנג!', 'זבאנג יפה!'],
    small: ['זבאנג!', 'זבאנג נחמד!', 'זבאנג קטן!', 'טוב, זבאנג!']
};

function zabangCheerPhrase(points) {
    const pool = points >= 500 ? ZABANG_CHEERS.big
        : points >= 250 ? ZABANG_CHEERS.mid
        : ZABANG_CHEERS.small;
    return pool[Math.floor(Math.random() * pool.length)];
}

function showZabangCheer(points) {
    showBoardMessage(`${zabangCheerPhrase(points)} +${points}`, 'cheer', 1100);
}

const CELEBRATION_COLORS = ['#00e5ff', '#39ff6a', '#ffd60a', '#ff2ec4', '#8b5cf6', '#ff3b5c'];

// Big confetti burst - victory moments
function launchConfetti(count = 70) {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.background = CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)];
        piece.style.animationDelay = `${Math.random() * 0.4}s`;
        piece.style.animationDuration = `${2 + Math.random() * 1.5}s`;
        container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 4000);
}

// Small sparkle burst - every word found
function launchSparkles(count = 10) {
    const container = document.createElement('div');
    container.className = 'sparkle-container';
    document.body.appendChild(container);

    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'sparkle-piece';
        piece.style.left = `${40 + Math.random() * 20}vw`;
        piece.style.top = `${35 + Math.random() * 20}vh`;
        piece.style.background = CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)];
        piece.style.animationDelay = `${Math.random() * 0.15}s`;
        container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 1000);
}

// Invalid word: show for 1.5s a clickable "real word?" toast.
// Clicking sends the word to the pending-review list (the game creator
// approves or rejects it in the profile screen).
function showWordSubmitToast(word) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message error word-submit-toast';
    msgEl.innerHTML = `<span>לא במאגר</span><button class="submit-word-btn">מילה אמיתית? ${icon('submit')}</button>`;
    msgEl.querySelector('button').addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        submitWordForReview(word);
        msgEl.remove();
    });
    document.body.appendChild(msgEl);
    positionAboveBoard(msgEl); // above the board, not over it
    setTimeout(() => msgEl.remove(), 1800); // a bit longer: it's clickable
}

function submitWordForReview(word) {
    // Keep a local per-device history so the player can see what they've
    // submitted - approval itself now only happens on the developer's
    // admin-signed-in client, writing to a shared Firebase queue.
    const subs = JSON.parse(localStorage.getItem('zabangSubmissions') || '[]');
    if (!subs.some(s => s.word === word)) {
        subs.push({ word: word, date: new Date().toISOString() });
        localStorage.setItem('zabangSubmissions', JSON.stringify(subs));
    }

    if (typeof FIREBASE_READY !== 'undefined' && FIREBASE_READY && db) {
        authReady.then(() => {
            db.ref('pending_requests').push({
                word: word,
                points: pointsForWord(word),
                submittedBy: gameState.playerName,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }).catch(err => console.error('Failed to submit word for review:', err));
        });
    }

    showBoardMessage('נשלח לבדיקה — תודה!', 'success', 1100);
}

function pointsForWord(word) {
    if (word.length >= 5) return 500;
    if (word.length === 4) return 250;
    return 100;
}

// Words the creator approved are stored locally and merged into the
// dictionary on every launch
function loadCustomWords() {
    const custom = JSON.parse(localStorage.getItem('zabangCustomWords') || '[]');
    custom.forEach(w => {
        const word = normalizeFinals(w);
        if (!removedWordsSet.has(word)) HEBREW_DICTIONARY[word] = pointsForWord(word);
    });
    invalidateDictionaryCache();
}

// Single Player
// Single-player durations: quick = 1 min, precise = 2 min.
const SINGLE_DURATIONS = { quick: 60, precise: 120 };

// Show the single-player duration picker (called from the mode menu).
function showSingleModeChoice() {
    showScreen('singleModeScreen');
}

function startSinglePlayer(singleMode = 'quick') {
    const duration = SINGLE_DURATIONS[singleMode] || SINGLE_DURATIONS.quick;
    currentGame.mode = 'single';
    currentGame.singleMode = singleMode; // remembered so "play again" replays the same length
    currentGame.board = generateBoard();
    currentGame.foundWords.clear();
    currentGame.score = 0;
    currentGame.timeLeft = duration;
    currentGame.freezeLeft = 0;
    currentGame.gameActive = true;

    showScreen('gameScreen');
    document.getElementById('timerDisplay').textContent = currentGame.timeLeft; // avoid a 1s stale "60"
    renderBoard('board');
    applyBoardTheme('board', preferredThemeIndex());
    updateFoundWords();
    startTimer('single');
}

function updateFoundWords() {
    const list = document.getElementById('foundWordsList');
    list.innerHTML = '';
    currentGame.foundWords.forEach(word => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${word}</span><span class="points">+${HEBREW_DICTIONARY[word]}</span>`;
        list.appendChild(li);
    });
}

function startTimer(mode) {
    if (currentGame.timer) clearInterval(currentGame.timer);

    currentGame.timer = setInterval(() => {
        const timerEl = document.getElementById(mode === 'single' ? 'timerDisplay' : 'battleTimerDisplay');

        // While frozen the clock does not move - it just shows the ice state
        if (currentGame.freezeLeft > 0) {
            currentGame.freezeLeft--;
            timerEl.classList.add('frozen');
            timerEl.textContent = currentGame.timeLeft;
            return;
        }

        timerEl.classList.remove('frozen');
        currentGame.timeLeft--;
        timerEl.textContent = currentGame.timeLeft;

        if (currentGame.timeLeft <= 0) {
            clearInterval(currentGame.timer);
            endRound(mode);
        }
    }, 1000);
}

// ===== Pause (single-player & bots battle only) =====
// Multiplayer can't be paused - you can't freeze real opponents' clocks.
function pauseGame() {
    if (currentGame.mode === 'multiplayer') return;
    if (!currentGame.gameActive || currentGame.paused) return;
    currentGame.paused = true;
    currentGame.gameActive = false;      // blocks board input while paused
    if (currentGame.timer) clearInterval(currentGame.timer);
    stopBotAI();                          // freeze the bots too (no-op in single mode)
    document.getElementById('pauseOverlay').style.display = 'flex';
}

function resumeGame() {
    if (!currentGame.paused) return;
    currentGame.paused = false;
    currentGame.gameActive = true;
    document.getElementById('pauseOverlay').style.display = 'none';
    // resume from the preserved timeLeft; restart the bots only in battle mode
    startTimer(currentGame.mode === 'single' ? 'single' : 'battle');
    if (currentGame.mode === 'battle') startBotAI();
}

function quitFromPause() {
    currentGame.paused = false;
    document.getElementById('pauseOverlay').style.display = 'none';
    goHome();
}

function endRound(mode) {
    currentGame.gameActive = false;

    if (mode === 'single') {
        gameState.coins += Math.floor(currentGame.score / 10);
        gameState.totalScore += currentGame.score;
        gameState.gamesPlayed++;
        // A new personal best unlocks the OPT-IN "add to זבאנג רויאל" button on
        // the result screen - we no longer auto-submit. Only the best score can
        // ever be submitted, and only if the player chooses to.
        const prevBest = gameState.bestSingleScore || 0;
        currentGame.isNewBest = currentGame.score > prevBest && currentGame.score > 0;
        if (currentGame.isNewBest) gameState.bestSingleScore = currentGame.score;
        saveGameState();
        showGameOverDialog();
    } else {
        endBattleRound();
    }
}

function showGameOverDialog() {
    document.getElementById('srScore').textContent = currentGame.score;
    document.getElementById('srWords').textContent = currentGame.foundWords.size;
    document.getElementById('srCoins').textContent = `+${Math.floor(currentGame.score / 10)} מטבעות`;

    // Opt-in leaderboard button: only offered on a new personal best (only the
    // best score is submittable) and only when Firebase is available.
    const lbBtn = document.getElementById('srLeaderboardBtn');
    const lbNote = document.getElementById('srLeaderboardNote');
    const canSubmit = currentGame.isNewBest && typeof FIREBASE_READY !== 'undefined'
        && FIREBASE_READY && db && gameState.playerId;
    if (lbBtn && lbNote) {
        if (canSubmit) {
            lbBtn.style.display = '';
            lbBtn.disabled = false;
            lbBtn.innerHTML = '🏆 הוסף שיא לזבאנג רויאל';
            lbNote.style.display = 'block';
            lbNote.textContent = `שיא חדש! ${currentGame.score} נקודות`;
        } else {
            lbBtn.style.display = 'none';
            lbNote.style.display = 'none';
        }
    }

    updateHomeUI();
    showScreen('singleResultScreen');
}

// ===== זבאנג רויאל leaderboard (best single-player score, global via Firebase) =====
// Each device keeps one row keyed by gameState.playerId. Submission is OPT-IN:
// only offered on a new personal best, and only when the player taps the button
// on the result screen (see showGameOverDialog). So scores can only go up and
// nothing is published without the player choosing to.
// NOTE: like all scores in this client-authoritative game, this is spoofable -
// fine for a casual leaderboard, not a competitive-stakes one.
function submitScoreToLeaderboard() {
    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !db || !gameState.playerId) return;
    const entry = {
        name: gameState.playerName,
        score: gameState.bestSingleScore,
        avatarId: gameState.avatarId,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    const btn = document.getElementById('srLeaderboardBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '✓ נוסף לזבאנג רויאל'; }
    if (typeof authReady !== 'undefined') {
        authReady.then(() => db.ref('leaderboard/' + gameState.playerId).set(entry)
            .then(() => showMessage('נוסף לזבאנג רויאל!', 'success'))
            .catch(err => {
                console.warn('Leaderboard write failed:', err.message);
                showMessage('השמירה נכשלה, נסה שוב', 'error');
                if (btn) { btn.disabled = false; btn.innerHTML = '🏆 הוסף שיא לזבאנג רויאל'; }
            }));
    }
}

function showLeaderboard() {
    showScreen('leaderboardScreen');
    renderLeaderboard();
}

function renderLeaderboard() {
    const listEl = document.getElementById('leaderboardList');
    if (!listEl) return;
    if (typeof FIREBASE_READY === 'undefined' || !FIREBASE_READY || !db) {
        listEl.innerHTML = '<p class="no-subs">טבלת הדירוג לא זמינה (Firebase לא מוגדר)</p>';
        return;
    }
    listEl.innerHTML = '<div class="mp-spinner"></div>';
    db.ref('leaderboard').once('value').then(snap => {
        const rows = Object.entries(snap.val() || {})
            .map(([id, e]) => ({ id, name: e.name || 'שחקן', score: e.score || 0, avatarId: e.avatarId }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 20);
        if (rows.length === 0) {
            listEl.innerHTML = '<p class="no-subs">עדיין אין תוצאות - שחק משחק יחיד כדי להיכנס לטבלה!</p>';
            return;
        }
        listEl.innerHTML = rows.map((r, i) => {
            const isMe = r.id === gameState.playerId;
            const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
            const avatar = (typeof getAvatarById === 'function') ? getAvatarById(r.avatarId).svg : '';
            return `<div class="lb-row${isMe ? ' lb-me' : ''}">
                <span class="lb-rank">${rank}</span>
                <span class="lb-avatar">${avatar}</span>
                <span class="lb-name">${escapeHtml(r.name)}${isMe ? ' (אתה)' : ''}</span>
                <span class="lb-score">${r.score}</span>
            </div>`;
        }).join('');
    }).catch(err => {
        listEl.innerHTML = '<p class="no-subs">שגיאה בטעינת הטבלה</p>';
        console.warn('Leaderboard read failed (add a leaderboard Security Rule):', err.message);
    });
}

// Power-ups

function getShopItem(key) {
    return SHOP_ITEMS.find(i => i.key === key);
}

// Every power-up is paid from its own shop-bought inventory slot first, then
// coins. Split into "can pay" / "consume" so the charge only happens after
// the power-up's effect was actually applied (e.g. a hint word was found).
function canPayForItem(key) {
    const item = getShopItem(key);
    if (gameState.inventory[key] > 0 || hasInfiniteCoins() || gameState.coins >= item.cost) return true;
    showMessage(`אין מספיק מטבעות! (${item.name} עולה ${item.cost})`, 'error');
    return false;
}

function consumeItemPayment(key) {
    const item = getShopItem(key);
    if (gameState.inventory[key] > 0) {
        gameState.inventory[key]--;
        showMessage(`${item.name} נוצל מהמלאי (נשארו ${gameState.inventory[key]})`, 'info');
        return;
    }
    if (!hasInfiniteCoins()) gameState.coins -= item.cost;
}

function useHint() {
    if (!canPayForItem('hint')) return;

    let indices = findWordOnBoard();
    if (indices.length === 0) {
        autoShuffleIfExhausted();
        indices = findWordOnBoard();
        if (indices.length === 0) return;
    }

    const word = indices.map(i => currentGame.board[i]).join('');
    const points = HEBREW_DICTIONARY[word];

    consumeItemPayment('hint');
    currentGame.foundWords.add(word);
    currentGame.score += points;
    document.getElementById('scoreDisplay').textContent = currentGame.score;
    updateFoundWords();
    saveGameState();
    updateHomeUI();

    // Flash the word's tiles for 1.5 seconds
    const tiles = document.querySelectorAll(`#${activeBoardId()} .letter-tile`);
    indices.forEach(i => tiles[i]?.classList.add('selected'));
    setTimeout(() => tiles.forEach(t => t.classList.remove('selected')), 1500);

    showMessage(`${word} - כל הכבוד! +${points}`, 'success');
    launchSparkles();
}

// Find a dictionary word that actually exists on the board (horizontal or
// vertical) and hasn't been found yet - same logic as the Flutter version
function findWordOnBoard() {
    const size = currentGame.gridSize;
    const letters = new Set(currentGame.board);
    for (const word of dictionaryWordList()) {
        if (currentGame.foundWords.has(word) || word.length > size || word.length < 3) continue;
        if (!wordUsesOnlyLetters(word, letters)) continue;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c <= size - word.length; c++) {
                let ok = true;
                const idxs = [];
                for (let i = 0; i < word.length; i++) {
                    const idx = r * size + c + i;
                    if (currentGame.board[idx] !== word[i]) { ok = false; break; }
                    idxs.push(idx);
                }
                if (ok) return idxs;
            }
        }

        for (let c = 0; c < size; c++) {
            for (let r = 0; r <= size - word.length; r++) {
                let ok = true;
                const idxs = [];
                for (let i = 0; i < word.length; i++) {
                    const idx = (r + i) * size + c;
                    if (currentGame.board[idx] !== word[i]) { ok = false; break; }
                    idxs.push(idx);
                }
                if (ok) return idxs;
            }
        }
    }
    return [];
}

function useShuffle() {
    if (blockedByFreeze()) return;
    if (!canPayForItem('shuffle')) return;

    consumeItemPayment('shuffle');
    currentGame.board = currentGame.board.sort(() => Math.random() - 0.5);
    renderBoard(currentGame.mode === 'single' ? 'board' : 'battleBoard');
    saveGameState();
    updateHomeUI();
    showMessage('הלוח עורבב!', 'success');
}

function useFreeze() {
    if (!canPayForItem('freeze')) return;

    consumeItemPayment('freeze');
    currentGame.freezeLeft += 5;
    saveGameState();
    updateHomeUI();
    showMessage('הזמן הוקפא ל-5 שניות!', 'info');
}

function useBattleFreeze() {
    if (!canPayForItem('freezeOpponents')) return;

    consumeItemPayment('freezeOpponents');
    battleState.botsFrozenSeconds = 8;
    saveGameState();
    updateHomeUI();
    showMessage('היריבים הוקפאו ל-8 שניות!', 'info');
}

function useBattleShuffle() {
    if (!canPayForItem('tornado')) return;

    consumeItemPayment('tornado');
    for (let bot of battleState.players) {
        bot.score = Math.floor(bot.score * 0.5);
    }
    saveGameState();
    updateHomeUI();
    updateBattleUI();
    showMessage('הבוטים מבולבלים!', 'success');
}

function useBattleHint() {
    if (!canPayForItem('hint')) return;

    let indices = findWordOnBoard();
    if (indices.length === 0) {
        autoShuffleIfExhausted();
        indices = findWordOnBoard();
        if (indices.length === 0) return;
    }

    const word = indices.map(i => currentGame.board[i]).join('');
    const points = HEBREW_DICTIONARY[word];

    consumeItemPayment('hint');
    currentGame.foundWords.add(word);
    currentGame.playerScore += points;
    document.getElementById('playerBattleScore').textContent = currentGame.playerScore;
    updateBattleUI();
    saveGameState();
    updateHomeUI();

    const tiles = document.querySelectorAll(`#${activeBoardId()} .letter-tile`);
    indices.forEach(i => tiles[i]?.classList.add('selected'));
    setTimeout(() => tiles.forEach(t => t.classList.remove('selected')), 1500);

    showMessage(`${word} - כל הכבוד! +${points}`, 'success');
    launchSparkles();
}

// Battle Royale
// Show the difficulty picker before a bots battle (called from the mode menu).
function showBattleDifficulty() {
    showScreen('battleDifficultyScreen');
}

function startBattleRoyale(difficulty = 'medium') {
    battleState.difficulty = BOT_DIFFICULTY[difficulty] ? difficulty : 'medium';
    currentGame.mode = 'battle';
    battleState.currentRound = 1;
    battleState.totalCoinsEarned = 0;
    const botAvatars = AVATARS.filter(a => a.id !== gameState.avatarId)
        .sort(() => Math.random() - 0.5);
    battleState.players = BOT_NAMES.map((name, i) => ({
        name,
        score: 0,
        eliminated: false,
        avatarId: botAvatars[i % botAvatars.length].id
    }));
    startBattleRound();
}

function startBattleRound() {
    currentGame.board = generateBoard();
    currentGame.foundWords.clear();
    currentGame.playerScore = 0;
    currentGame.timeLeft = 60;
    currentGame.freezeLeft = 0;
    currentGame.gameActive = true;
    battleState.botsFrozenSeconds = 0;
    // each round is scored independently (the player already resets to 0 above);
    // reset the surviving bots too so the round is a fair head-to-head and the
    // per-round lowest scorer is eliminated
    battleState.players.forEach(b => { if (!b.eliminated) b.score = 0; });

    showScreen('battleScreen');
    const diffName = (BOT_DIFFICULTY[battleState.difficulty] || BOT_DIFFICULTY.medium).name;
    document.getElementById('roundBadge').textContent = `סיבוב ${battleState.currentRound}/5 · ${diffName}`;
    // ensure the "shuffle opponents" power-up + pause button are visible in
    // bots mode (multiplayer mode hides both since they don't apply to real players)
    const shuffleBtn = document.getElementById('battleShuffleBtn');
    if (shuffleBtn) shuffleBtn.style.display = '';
    // bots mode: pause button is the top-right control; exit is via the pause
    // menu, so hide the header home button (multiplayer re-shows it below)
    const battlePauseBtn = document.getElementById('battlePauseBtn');
    if (battlePauseBtn) battlePauseBtn.style.display = '';
    const battleExitBtn = document.getElementById('battleExitBtn');
    if (battleExitBtn) battleExitBtn.style.display = 'none';
    renderBoard('battleBoard');
    applyBoardTheme('battleBoard', preferredThemeIndex());
    battleState.boardWords = collectBoardWords(); // pool the bots "search" this round
    updateBattleUI();
    startBotAI();
    startTimer('battle');
}

function updateBattleUI() {
    const statusEl = document.getElementById('playersStatus');
    statusEl.innerHTML = '';

    statusEl.innerHTML += `<div class="player-status self">
        <div class="status-avatar">${getAvatarById(gameState.avatarId).svg}</div>
        <span>אתה</span><span>${currentGame.playerScore}</span>
    </div>`;

    for (let bot of battleState.players) {
        if (!bot.eliminated) {
            statusEl.innerHTML += `<div class="player-status">
                <div class="status-avatar">${getAvatarById(bot.avatarId).svg}</div>
                <span>${escapeHtml(bot.name)}</span><span>${bot.score}</span>
            </div>`;
        }
    }
}

function startBotAI() {
    stopBotAI(); // never stack intervals across rounds
    const tier = BOT_DIFFICULTY[battleState.difficulty] || BOT_DIFFICULTY.medium;

    // Give each bot its own initial "thinking" countdown, staggered so they
    // don't all find a word on the same tick (feels like independent players).
    battleState.players.forEach(bot => {
        if (!bot.eliminated) bot.nextFindIn = botFindDelay(tier) * (0.4 + Math.random() * 0.6);
    });

    const TICK = 1000; // 1s resolution keeps the pacing smooth and freeze exact
    battleState.botTimer = setInterval(() => {
        if (!currentGame.gameActive) {
            stopBotAI();
            return;
        }

        // Frozen by a power-up: bots stop searching entirely until it wears off.
        if (battleState.botsFrozenSeconds > 0) {
            battleState.botsFrozenSeconds = Math.max(0, battleState.botsFrozenSeconds - 1);
            return;
        }

        const pool = (battleState.boardWords && battleState.boardWords.length) ? battleState.boardWords : null;
        let changed = false;
        for (const bot of battleState.players) {
            if (bot.eliminated) continue;
            bot.nextFindIn = (bot.nextFindIn || 0) - TICK;
            if (bot.nextFindIn <= 0) {
                // the bot "found" a word - award a real board word's value
                bot.score += pool ? pool[Math.floor(Math.random() * pool.length)].points : 100;
                bot.nextFindIn = botFindDelay(tier); // schedule the next search
                changed = true;
            }
        }
        if (changed) updateBattleUI();
    }, TICK);
}

// Stops the bots' scoring interval. Must be called whenever we leave a bots
// battle (goHome) or start a real-multiplayer game - otherwise a lingering
// bot interval keeps calling updateBattleUI() and paints bot names over the
// live multiplayer player list.
function stopBotAI() {
    if (battleState.botTimer) {
        clearInterval(battleState.botTimer);
        battleState.botTimer = null;
    }
}

function endBattleRound() {
    // victoryScreen is shared with real multiplayer results, where this button
    // can be visible - bots mode never offers a matchmaking "play again"
    const playAgainBtn = document.getElementById('playAgainRandomBtn');
    if (playAgainBtn) playAgainBtn.style.display = 'none';

    // Only the player + still-active bots compete for the round's elimination.
    // (Including already-eliminated bots let their frozen low score win the
    // "lowest" spot again, so no NEW bot ever got removed after round 1.)
    const standings = [
        { name: gameState.playerName, score: currentGame.playerScore },
        ...battleState.players.filter(b => !b.eliminated).map(b => ({ name: b.name, score: b.score }))
    ].sort((a, b) => a.score - b.score);

    const loser = standings[0].name;

    if (loser === gameState.playerName) {
        // Player eliminated
        document.getElementById('victoryTitle').innerHTML = `${icon('close')} הודחת! ${icon('close')}`;
        document.getElementById('victorySubtitle').textContent = `הודחת בסיבוב ${battleState.currentRound} מתוך ${battleState.totalRounds}`;
        showScreen('victoryScreen');
        document.getElementById('victoryRewards').innerHTML = `
            <div class="reward-box">
                <span class="coin-icon icon">${ICONS.coin}</span>
                <span>סה"כ: ${battleState.totalCoinsEarned} מטבעות</span>
            </div>
        `;
    } else {
        // Bot eliminated
        for (let bot of battleState.players) {
            if (bot.name === loser) bot.eliminated = true;
        }

        gameState.coins += 25;
        battleState.totalCoinsEarned += 25;
        updateHomeUI();

        if (battleState.currentRound >= battleState.totalRounds) {
            // Victory! coins + a few blue diamonds as a premium bonus
            gameState.coins += 100;
            gameState.diamonds += 5;
            battleState.totalCoinsEarned += 100;
            saveGameState();
            document.getElementById('victoryTitle').innerHTML = `${icon('trophy')} ניצחת! ${icon('trophy')}`;
            document.getElementById('victorySubtitle').textContent = `שרדת את כל ${battleState.totalRounds} הסיבובים!`;
            showScreen('victoryScreen');
            document.getElementById('victoryRewards').innerHTML = `
                <div class="reward-box">
                    <span class="icon">${ICONS.diamond}</span><span>+5 יהלומים</span>
                </div>
                <div class="reward-box">
                    <span class="coin-icon icon">${ICONS.coin}</span>
                    <span>סה"כ: ${battleState.totalCoinsEarned} מטבעות!</span>
                </div>
            `;
            launchConfetti();
        } else {
            // Next round
            showRoundEnd(standings, loser);
        }
    }
}

function showRoundEnd(standings, eliminatedName) {
    const standingsHTML = standings.map((s, i) => `
        <div class="standing${s.name === eliminatedName ? ' eliminated' : ''}">
            <span>#${i + 1}</span>
            <span>${escapeHtml(s.name)}${s.name === eliminatedName ? ' ' + icon('close') : ''}</span>
            <span>${s.score}</span>
        </div>
    `).join('');

    document.getElementById('eliminationNotice').textContent = `${eliminatedName} הודח/ה מהסיבוב!`;
    document.getElementById('standingsDisplay').innerHTML = standingsHTML;
    showScreen('roundEndScreen');
}

function nextBattleRound() {
    battleState.currentRound++;
    startBattleRound();
}

// The round-end "next round" button is shared between bots-battle and
// multiplayer. Route to the right handler based on the current mode.
function handleNextRoundClick() {
    if (currentGame.mode === 'multiplayer' && typeof hostNextMultiplayerRound === 'function') {
        hostNextMultiplayerRound();
    } else {
        nextBattleRound();
    }
}

// Shop - hints can be pre-purchased into an inventory; the other power-ups
// are still paid with coins at the moment of use, during the game
function renderShop() {
    const shopEl = document.getElementById('shopItems');
    let html = '';

    // --- Get coins: rewarded ad + (mock) coin packages ---
    html += `<h3 class="shop-section-title">קבל מטבעות</h3>`;
    html += `
        <div class="shop-item ad-card">
            <div class="item-info item-info-avatar">
                <div class="pack-emoji">🎬</div>
                <div>
                    <h3>צפה בסרטון</h3>
                    <p>קבל ${AD_REWARD_COINS} מטבעות חינם</p>
                </div>
            </div>
            <button class="buy-btn green-buy-btn" onclick="watchAdForCoins()">${icon('coin', 'coin-icon')} +${AD_REWARD_COINS}</button>
        </div>
    `;
    COIN_PACKAGES.forEach(p => {
        html += `
            <div class="shop-item pack-card">
                <div class="item-info item-info-avatar">
                    <div class="pack-emoji">${p.emoji}</div>
                    <div>
                        <h3>${p.name}</h3>
                        <p>${icon('coin', 'coin-icon')} ${p.coins} מטבעות</p>
                    </div>
                </div>
                <button class="buy-btn price-btn" onclick="showIapComingSoon()">${p.price}</button>
            </div>
        `;
    });

    // --- Power-ups (bought with coins into inventory) ---
    html += `<h3 class="shop-section-title">עזרים למשחק</h3>`;
    html += `<p class="shop-note">כל העזרים אפשר לקנות מראש למלאי - פשוט לחצו על "קנה"</p>`;
    SHOP_ITEMS.forEach(item => {
        html += `
            <div class="shop-item">
                <div class="item-info">
                    <h3>${icon(item.icon)} ${item.name} <span class="owned-count">במלאי: ${gameState.inventory[item.key]}</span></h3>
                    <p>${item.desc}</p>
                </div>
                <button class="buy-btn" onclick="buyItem('${item.key}')">${icon('coin', 'coin-icon')} ${item.cost} קנה</button>
            </div>
        `;
    });

    // --- Premium ("cooler") profile pictures ---
    const premiumAvatars = AVATARS.filter(a => a.premium);
    if (premiumAvatars.length) {
        html += `<h3 class="shop-section-title">תמונות פרופיל אקסקלוסיביות ${icon('diamond', 'coin-icon')}</h3>`;
        premiumAvatars.forEach(a => {
            const owned = isAvatarOwned(a.id);
            html += `
                <div class="shop-item">
                    <div class="item-info item-info-avatar">
                        <div class="shop-avatar">${a.svg}</div>
                        <div>
                            <h3>${a.name}</h3>
                            <p>תמונת פרופיל מיוחדת</p>
                        </div>
                    </div>
                    ${owned
                        ? `<span class="shop-owned">${icon('check')} בבעלותך</span>`
                        : `<button class="buy-btn diamond-buy-btn" onclick="buyAvatar('${a.id}')">${icon('diamond', 'coin-icon')} ${AVATAR_DIAMOND_COST} קנה</button>`}
                </div>
            `;
        });
    }

    shopEl.innerHTML = html;
}

// Mock rewarded video: a 5s countdown "loading" the ad, then grant coins.
function watchAdForCoins() {
    const overlay = document.getElementById('adOverlay');
    const countEl = document.getElementById('adCountdown');
    if (!overlay || !countEl) return;
    if (overlay.dataset.running === '1') return; // ignore taps while already playing
    overlay.dataset.running = '1';
    overlay.style.display = 'flex';

    let remaining = 5;
    countEl.textContent = remaining;
    const timer = setInterval(() => {
        remaining--;
        if (remaining > 0) { countEl.textContent = remaining; return; }
        clearInterval(timer);
        overlay.style.display = 'none';
        overlay.dataset.running = '0';
        gameState.coins += AD_REWARD_COINS;
        saveGameState();
        updateHomeUI();
        renderShop();
        showMessage(`קיבלת ${AD_REWARD_COINS} מטבעות!`, 'success');
    }, 1000);
}

// Mock IAP: real payments arrive with the native app launch.
function showIapComingSoon() {
    showInfoModal('החנות הפיננסית תהיה זמינה עם השקת האפליקציה הרשמית ב-Google Play וב-App Store!');
}

// Generic single-button info modal.
function showInfoModal(message) {
    const overlay = document.getElementById('infoOverlay');
    if (!overlay) return;
    document.getElementById('infoText').textContent = message;
    overlay.style.display = 'flex';
}

function closeInfoModal() {
    const overlay = document.getElementById('infoOverlay');
    if (overlay) overlay.style.display = 'none';
}

// generic yes/no confirmation modal (the callback runs only on "yes")
function showConfirm(message, onYes) {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmText').textContent = message;
    overlay.style.display = 'flex';
    const yes = document.getElementById('confirmYesBtn');
    const no = document.getElementById('confirmNoBtn');
    const close = () => { overlay.style.display = 'none'; yes.onclick = null; no.onclick = null; };
    yes.onclick = () => { close(); onYes(); };
    no.onclick = close;
}

// buys one unit of any shop item (key = SHOP_ITEMS[].key) into its own
// inventory slot; the confirmation text/price are looked up per-item so
// this stays generic as new power-ups get added
function buyItem(key) {
    const item = getShopItem(key);
    if (!hasInfiniteCoins() && gameState.coins < item.cost) {
        showMessage('אין מספיק מטבעות!', 'error');
        return;
    }
    showConfirm(`האם אתה בטוח? קניית ${item.name} ב-${item.cost} מטבעות`, () => {
        if (!hasInfiniteCoins()) gameState.coins -= item.cost;
        gameState.inventory[key]++;
        saveGameState();
        updateHomeUI();
        renderShop();
        showMessage(`${item.name} נוסף למלאי! (${gameState.inventory[key]})`, 'success');
    });
}

// A profile picture is available if it's a free (non-premium) one, the admin
// account (owns everything), or a premium one the player has bought.
function isAvatarOwned(id) {
    const a = getAvatarById(id);
    if (!a.premium) return true;
    if (isAdminAccount()) return true;
    return (gameState.ownedAvatars || []).includes(id);
}

function buyAvatar(id) {
    const a = getAvatarById(id);
    if (isAvatarOwned(id)) { showMessage('כבר בבעלותך', 'info'); return; }
    // Premium avatars are bought with blue diamonds (admin owns everything free)
    if (!isAdminAccount() && gameState.diamonds < AVATAR_DIAMOND_COST) {
        showMessage('אין מספיק יהלומים!', 'error');
        return;
    }
    showConfirm(`האם אתה בטוח? קניית התמונה "${a.name}" ב-${AVATAR_DIAMOND_COST} יהלומים`, () => {
        if (!isAdminAccount()) gameState.diamonds -= AVATAR_DIAMOND_COST;
        if (!gameState.ownedAvatars.includes(id)) gameState.ownedAvatars.push(id);
        saveGameState();
        updateHomeUI();
        renderShop();
        showMessage(`התמונה "${a.name}" נוספה לאוסף!`, 'success');
    });
}

// Profile
function renderProfile() {
    document.getElementById('profileStats').innerHTML = `
        <p><strong>שם:</strong> ${escapeHtml(gameState.playerName)} <button class="rename-btn" onclick="renamePlayer()" title="ערוך שם">${icon('pencil')}</button></p>
        <p><strong>רמה:</strong> ${gameState.level}</p>
        <p><strong>מטבעות:</strong> ${coinsText()}</p>
        <p><strong>יהלומים:</strong> ${isAdminAccount() ? '∞' : gameState.diamonds}</p>
        <p><strong>גביעים:</strong> ${trophiesText()}</p>
        <p><strong>רצף התחברות:</strong> ${gameState.dailyStreak || 0} ימים</p>
        <p><strong>עיר:</strong> ${currentArena().motif} ${currentArena().name} — ${currentArena().tagline}</p>
        <p><strong>ניקוד כולל:</strong> ${gameState.totalScore}</p>
        <p><strong>שיא משחק יחיד:</strong> ${gameState.bestSingleScore || 0}</p>
        <p><strong>משחקים:</strong> ${gameState.gamesPlayed}</p>
    `;
    renderAvatarPicker();
    renderSubmissions();
}

function renamePlayer() {
    openNameModal(false);
}

// Set/rename player name - one shared modal for the mandatory first-run gate
// and every optional rename entry point (home screen tap, profile pencil).
let nameModalMandatory = false;

function openNameModal(mandatory) {
    nameModalMandatory = mandatory;
    const overlay = document.getElementById('nameOverlay');
    const input = document.getElementById('nameInput');
    document.getElementById('nameModalTitle').textContent =
        mandatory ? 'ברוכים הבאים! איך קוראים לך?' : 'שינוי שם';
    input.value = mandatory ? '' : gameState.playerName;
    document.getElementById('nameCancelBtn').style.display = mandatory ? 'none' : '';
    overlay.style.display = 'flex';
    input.focus();
}

function closeNameModal() {
    if (nameModalMandatory) return; // no dismissing the first-run gate without a name
    document.getElementById('nameOverlay').style.display = 'none';
}

function saveNameFromModal() {
    const raw = document.getElementById('nameInput').value;
    // Strip HTML-significant characters at the source - this name gets
    // shared with other real players over Firebase in multiplayer mode
    const cleaned = raw.trim().slice(0, 20).replace(/[<>&"']/g, '');
    if (!cleaned) { showMessage('שם לא תקין', 'error'); return; }
    gameState.playerName = cleaned;
    saveGameState();
    updateHomeUI();
    renderProfile();
    document.getElementById('nameOverlay').style.display = 'none';
    showMessage(nameModalMandatory ? `ברוך הבא, ${cleaned}!` : 'השם עודכן!', 'success');
    nameModalMandatory = false;
}

// ===== Word review panel - shows the player's own submission history.
// Approval is admin-only now (see admin.js): words wait in a shared
// Firebase queue until the developer's admin-signed-in client approves them. =====
function renderSubmissions() {
    const el = document.getElementById('submissionsList');
    if (el) {
        let subs = JSON.parse(localStorage.getItem('zabangSubmissions') || '[]');

        // Once the admin has decided on a word it should leave the profile:
        // approved words end up in the dictionary, rejected words appear in
        // the public rejected_words list. Only genuinely-pending words stay.
        const remaining = subs.filter(s => {
            const norm = typeof normalizeFinals === 'function' ? normalizeFinals(s.word) : s.word;
            const approved = HEBREW_DICTIONARY[norm] !== undefined;
            const rejected = rejectedWordsSet.has(norm) || rejectedWordsSet.has(s.word);
            return !approved && !rejected;
        });
        if (remaining.length !== subs.length) {
            subs = remaining;
            localStorage.setItem('zabangSubmissions', JSON.stringify(subs));
        }

        if (subs.length === 0) {
            el.innerHTML = '<p class="no-subs">אין מילים ממתינות לבדיקה</p>';
        } else {
            el.innerHTML = '';
            subs.forEach(s => {
                const row = document.createElement('div');
                row.className = 'submission-row';
                row.innerHTML = `
                    <span class="sub-word">${escapeHtml(s.word)}</span>
                    <span class="sub-status sub-pending">ממתינה לאישור</span>`;
                el.appendChild(row);
            });
        }
    }

    if (typeof renderAdminSection === 'function') renderAdminSection();
}

function renderAvatarPicker() {
    document.getElementById('currentAvatar').innerHTML = getAvatarById(gameState.avatarId).svg;

    const grid = document.getElementById('avatarGrid');
    grid.innerHTML = '';

    AVATARS.forEach(avatar => {
        const owned = isAvatarOwned(avatar.id);
        const option = document.createElement('div');
        option.className = 'avatar-option'
            + (avatar.id === gameState.avatarId ? ' avatar-selected' : '')
            + (owned ? '' : ' avatar-locked');
        option.innerHTML = `${avatar.svg}<span class="avatar-name">${avatar.name}</span>`
            + (owned ? '' : `<span class="avatar-lock">🔒</span>`);
        option.onclick = () => {
            if (owned) selectAvatar(avatar.id);
            else showMessage('תמונה נעולה - ניתן לרכוש בחנות', 'warning');
        };
        grid.appendChild(option);
    });
}

function selectAvatar(id) {
    if (!isAvatarOwned(id)) { showMessage('תמונה נעולה - ניתן לרכוש בחנות', 'warning'); return; }
    gameState.avatarId = id;
    saveGameState();
    renderAvatarPicker();
    updateHomeUI();
    showMessage(`הדמות הוחלפה ל${getAvatarById(id).name}!`, 'success');
}
