# App Store Connect - טקסטים להגשה

כל מה שצריך להעתיק ל-App Store Connect, מוכן מראש. לפי הקוד בענף `IOS` (גרסת אתר v37).

> **גרסה 1.0 - חינמית לגמרי: בלי רכישות בכסף אמיתי ובלי פרסומות.** הקוד של הרכישות נשאר באפליקציה אבל לא פעיל: בלי מוצרים ב-App Store Connect, החנות לא מציגה את "קבל מטבעות". כל מה שצריך כדי להפעיל רכישות בעדכון עתידי נמצא בסעיף 9.

שפה ראשית מומלצת: **עברית**. אפשר להוסיף לוקליזציה באנגלית (App Information ← Localizations) עם הטקסטים באנגלית.

---

## 1. פרטי האפליקציה (App Information)

| שדה | ערך |
|---|---|
| Bundle ID | `com.zabang.royale` |
| SKU (מזהה פנימי, לא מוצג) | `zabang-royale-ios` |
| Primary Language | Hebrew |
| Category - Primary | Games → **Word** |
| Category - Secondary | Games → **Puzzle** |
| Content Rights | לא מכילה תוכן של צד שלישי (No) |
| Privacy Policy URL | `https://ld2000king.github.io/zbang-pwa/privacy.html` |
| Support URL | `https://ld2000king.github.io/zbang-pwa/support.html` |
| Marketing URL (לא חובה) | `https://ld2000king.github.io/zbang-pwa/` |
| Copyright | `2026 <השם המלא שלך>` |

---

## 2. עמוד החנות - עברית

**Name** (עד 30 תווים)
```
זבאנג רויאל
```

**Subtitle** (עד 30 תווים)
```
משחק מילים בעברית - מול חברים
```

**Promotional Text** (עד 170 תווים, אפשר לשנות בכל רגע בלי גרסה חדשה)
```
מצאו כמה שיותר מילים לפני שהזמן נגמר! שחקו לבד, נגד בוטים או מול חברים בזמן אמת, טפסו בין 16 ערים בישראל ובנו את מגדל זבאנג.
```

**Description** (עד 4,000 תווים)
```
זבאנג רויאל הוא משחק מילים מהיר בעברית: גוררים את האצבע על אותיות הלוח, יוצרים מילים, ואוספים נקודות לפני שהשעון נגמר.

מצבי משחק
• משחק מהיר - דקה אחת, כמה שיותר מילים.
• משחק מדויק - שתי דקות לחשוב ולמצוא את המילים הארוכות.
• באטל רויאל - חמישה סיבובים נגד בוטים בשלוש רמות קושי. בכל סיבוב השחקן עם הניקוד הנמוך מודח - רק אחד נשאר.
• מולטיפלייר בזמן אמת - יריב אקראי 1 על 1, או חדר פרטי עם חברים בעזרת קוד.
• מגדל זבאנג - מצב חשיבה בלי שעון: מחברים אותיות סמוכות, המילים נעלמות והאותיות נופלות. מילה ארוכה מפוצצת את מה שסביבה, ואות נדירה מנקה שורה שלמה. אל תתנו למגדל לגעת בתקרה!

מה עוד יש
• מאגר של יותר מ-12,000 מילים בעברית, שגדל כל הזמן - מצאתם מילה שחסרה? שלחו אותה לבדיקה.
• 16 ערים בישראל - ממזכרת בתיה ועד רמת גן. אספו גביעים, פתחו ערים חדשות וכל עיר מחליפה את עיצוב המשחק כולו.
• עזרים: רמז, ערבוב לוח, הקפאת זמן, והקפאת יריבים בבאטל רויאל.
• דמויות ותמונות פרופיל, או תמונה אישית משלכם.
• ערכות צליל לכל מילה וקומבו.
• בונוס התחברות יומי וטבלת שיאים לכל מצב.
• גיבוי בענן אופציונלי - ממשיכים מאותה נקודה גם בטלפון חדש.

בלי פרסומות. משחק יחיד, באטל רויאל ומגדל זבאנג עובדים גם בלי אינטרנט.

שאלות? support: https://ld2000king.github.io/zbang-pwa/support.html
```

**Keywords** (עד 100 תווים, מופרדים בפסיקים, בלי רווחים אחרי פסיק. לא לחזור על מילים שכבר בשם)
```
מילים,עברית,תשבץ,אותיות,חידון,פאזל,מולטיפלייר,חברים,אוצר מילים,מגדל,משחק חשיבה,חיפוש מילים
```
*(90 תווים. בכוונה בלי שמות של משחקים אחרים (Boggle, Wordle, SpellTower) - אפל דוחה מילות מפתח עם סימנים מסחריים של אחרים, סעיף 2.3.7.)*

**What's New** - לא נדרש בגרסה הראשונה. לגרסאות הבאות, דוגמה:
```
• תיקונים ושיפורים
```

---

## 3. עמוד החנות - English (לוקליזציה)

**Name**
```
Zabang Royale
```

**Subtitle**
```
Hebrew word game with friends
```

**Promotional Text**
```
Find as many words as you can before time runs out! Play solo, against bots or live against friends, climb through 16 Israeli cities and build the Zabang Tower.
```

**Description**
```
Zabang Royale is a fast Hebrew word game: drag your finger across the letters, form words, and rack up points before the clock runs out.

Game modes
• Quick game - one minute, as many words as you can.
• Precise game - two minutes to think and find the long words.
• Battle Royale - five rounds against bots at three difficulty levels. The lowest score is knocked out every round - only one remains.
• Live multiplayer - a random 1-on-1 opponent, or a private room with friends using a room code.
• Zabang Tower - a no-clock thinking mode: connect neighbouring letters, words disappear and letters fall. A long word blasts its neighbours, and a rare letter clears a whole row. Don't let the tower touch the ceiling!

And also
• A dictionary of over 12,000 Hebrew words that keeps growing - found a missing word? Send it for review.
• 16 Israeli cities - collect trophies to unlock new ones, and each city re-skins the whole game.
• Power-ups: hint, shuffle, time freeze, and freezing opponents in Battle Royale.
• Characters and profile pictures, or your own photo.
• Sound kits for every word and combo.
• Daily login bonus and a leaderboard for every mode.
• Optional cloud backup - pick up where you left off on a new phone.

No ads. Single player, Battle Royale and the Zabang Tower also work offline.

The game is in Hebrew.
```

**Keywords**
```
hebrew,word game,words,letters,puzzle,word search,multiplayer,friends,vocabulary,tower,israel,ivrit
```

---

## 4. רכישות בתוך האפליקציה (In-App Purchases)

**בגרסה 1.0 - אין.** לא ליצור מוצרים ב-App Store Connect ← Monetization ← In-App Purchases.
המטבעות, היהלומים והחנות הפנימית עובדים כרגיל - מרוויחים אותם רק במשחק. ההוראות להפעלת רכישות בעתיד: סעיף 9.

---

## 5. Review Notes (הערות לבודק - App Review Information)

**Sign-in required:** לא (No). המשחק לא דורש התחברות.
אבל כדאי לצרף חשבון בדיקה כדי שהבודק יוכל לבדוק מחיקת חשבון:
- **User name:** `review@...` *(ליצור באפליקציה: פרופיל ← גיבוי בענן ← צור חשבון לגיבוי, עם מייל שלך)*
- **Password:** *(הסיסמה שבחרת)*

**Contact Information:** שם, טלפון ומייל שלך.

**Notes:**
```
Zabang Royale is a Hebrew word game. No sign-in is needed: every player gets an anonymous session automatically.

Where to find things (the app is in Hebrew, right-to-left):
- Shop: the "חנות" (Shop) tab in the bottom bar sells power-ups and characters for virtual coins and diamonds, which are earned only by playing (game rewards, daily bonus). This version has no real-money purchases.
- Optional account + account deletion: "פרופיל" (Profile) tab → "גיבוי בענן" (Cloud backup). A test account is provided above. To delete it: "מחיקת החשבון" (Delete account) → confirm → enter the password. This permanently deletes the account, its cloud backup and its leaderboard entries.
- Reporting / blocking players (user-generated content = player names and profile photos): tap "⋯" next to any other player on the leaderboard ("דירוג" tab) or in a multiplayer match. Reports go to a moderation queue reviewed by the developer; blocked players are hidden. Offensive names are filtered when a player sets their name. Terms with a zero-tolerance policy are accepted when choosing a name.
- Privacy policy, terms and support: the round menu button (☰) at the top of the home screen.

Multiplayer needs a second player: Play → "מולטיפלייר עם חברים" (Multiplayer with friends) → "צור חדר" (Create room) on one device, and "הצטרף לחדר" (Join room) with the room code on another. "משחק אקראי" (Random game) waits for any other online player. All other modes are single-player.

The app is free and contains no in-app purchases, no ads and no third-party tracking.
```

---

## 6. App Privacy (Privacy Labels)

**Do you or your third-party partners collect data from this app?** → **Yes**

**Is data used for tracking?** → **No** (לכל סוג)

| סוג מידע (Apple) | נאסף? | מטרה (Purpose) | מקושר למשתמש? | מעקב? | הערה |
|---|---|---|---|---|---|
| Contact Info → **Email Address** | כן | App Functionality | Yes | No | רק למי שיוצר חשבון גיבוי |
| User Content → **Photos or Videos** | כן | App Functionality | Yes | No | עותק קטן של תמונת הפרופיל - ליריבים במולטיפלייר ולגיבוי |
| User Content → **Gameplay Content** | כן | App Functionality | Yes | No | ניקוד, טבלת שיאים, התקדמות בגיבוי |
| User Content → **Other User Content** | כן | App Functionality | Yes | No | שם השחקן, מילים שהוצעו, דיווחים על שחקנים |
| Identifiers → **User ID** | כן | App Functionality | Yes | No | המזהה האנונימי של Firebase |
| כל השאר (רכישות, מיקום, אנשי קשר, בריאות, פיננסי, היסטוריית גלישה, חיפוש, Diagnostics, Usage Data...) | **לא** | | | | אין אנליטיקס ואין דיווחי קריסות |

> חשוב: התשובות כאן חייבות להתאים ל-privacy.html. אם מוסיפים בעתיד אנליטיקס, Crashlytics או פרסומות - לעדכן גם כאן וגם שם.

---

## 7. Age Rating (שאלון דירוג גיל)

| שאלה | תשובה |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Simulated Gambling | None |
| Sexual Content or Nudity | None |
| Graphic Sexual Content and Nudity | None |
| Contests | No |
| Unrestricted Web Access | No |
| **User-Generated Content** | **Yes** (שמות ותמונות פרופיל של שחקנים) |
| Messaging and Chat | No (אין צ'אט) |
| Advertising | No |
| In-App Purchases | **No** (בגרסה 1.0) |
| Parental Controls / Age Assurance | No |
| Made for Kids | No |

אפל מחשבת את הדירוג לבד מהתשובות. הצפי: דירוג נמוך (4+ / 9+). כדי **לא** להיכנס לקטגוריית Kids, לא לסמן "Made for Kids" - אחרת חלים חוקים נוקשים בהרבה (למשל אסור כל קישור החוצה).

---

## 8. מה עוד צריך ביום ההגשה (לא טקסט)

- [x] **צילומי מסך** - מוכנים ב-`store/screenshots/iphone-6.9/` (1320×2868). בגרסה 1.0 מעלים **רק 6** - `01-home` עד `06-cities` (בית, משחק מהיר, באטל רויאל, מולטיפלייר, מגדל זבאנג, ערים). גוררים אותם ל-App Store Connect ← iPhone 6.9" Display. אפל משתמשת בהם גם לגדלים הקטנים יותר.
  **לא להעלות את `07-shop.png`** - הוא מציג חבילות מטבעות בכסף אמיתי שלא קיימות בגרסה 1.0 (שמור לעדכון שיפעיל רכישות, סעיף 9).
- [ ] **App Icon 1024×1024** - נוצר מ-`assets/` עם `npm run generate:native-assets` (הקובץ `store/app-store-icon-1024.png` כבר קיים).
- [ ] **Build** - מועלה מ-Xcode (Product ← Archive).
- [ ] **Export Compliance** - כבר מוגדר ב-Info.plist (`ITSAppUsesNonExemptEncryption = NO`), השאלה לא תופיע.
- [ ] **Pricing and Availability** - האפליקציה חינמית (Free). זמינות: ישראל (או כל המדינות).

---

## 9. פיתוח עתידי - הפעלת רכישות בכסף אמיתי (לא בגרסה 1.0)

הקוד כבר מוכן (`iap.js`, `COIN_PACKAGES` ב-`game.js`) ואין צורך לשנות אותו. כשמחליטים להפעיל רכישות בעדכון:
1. App Store Connect ← Business: לחתום על **Paid Apps Agreement**, ולמלא פרטי בנק וטופס מס (W-8BEN לתושב ישראל).
2. ב-Xcode: להוסיף את ה-Capability **In-App Purchase** (ראו docs/IOS.md, "פיתוח עתידי").
3. ליצור את שלושת המוצרים שלמטה, ולבדוק עם Sandbox Tester.
4. לעדכן בחזרה את הסעיפים בקובץ הזה:
   - **סעיף 5 (Review Notes):** להחזיר את השורה על "קבל מטבעות" ולהוריד את "no in-app purchases".
   - **סעיף 6 (פרטיות):** להוסיף `Purchases → Purchase History | כן | App Functionality | Yes | No | מזהי עסקאות נשמרים כדי לא לזכות פעמיים`.
   - **סעיף 7 (דירוג גיל):** `In-App Purchases` ← Yes.
   - **סעיף 8:** להעלות גם את `07-shop.png` (רק אם המחירים זהים לטבלה), ולסמן את המוצרים בעמוד הגרסה ← In-App Purchases.

### המוצרים

שלושה מוצרים מסוג **Consumable**. ה-Product ID חייב להיות **בדיוק** כמו כאן (הקוד מחפש אותו).

| Reference Name | Product ID | מחיר מומלץ | Display Name (עברית) | Description (עברית, עד 45 תווים) |
|---|---|---|---|---|
| Coins Small | `com.zabang.royale.coins.small` | ₪4.90 | שק מטבעות | 500 מטבעות לקניית עזרים ודמויות |
| Coins Medium | `com.zabang.royale.coins.medium` | ₪9.90 | תיבת אוצר | 1,200 מטבעות לקניית עזרים ודמויות |
| Coins Large | `com.zabang.royale.coins.large` | ₪19.90 | אוצר ענק | 3,000 מטבעות לקניית עזרים ודמויות |

**באנגלית:** Bag of Coins / Treasure Chest / Huge Treasure - "500 / 1,200 / 3,000 coins for power-ups and characters".

**Review Note לכל מוצר** (אותו טקסט לשלושה):
```
Coins are added to the player's balance right after purchase. Find them in the Shop tab (bottom bar) under "קבל מטבעות" (Get coins).
```
**Review Screenshot לכל מוצר:** צילום מסך של לשונית החנות עם חבילות המטבעות (מצלמים במק / באייפון אחרי שהמוצרים נטענים).

> המחירים ב-App Store Connect נבחרים מתוך טבלת מחירים (Price Tier) - לבחור את הקרוב ביותר ל-₪4.90 / ₪9.90 / ₪19.90. המחיר האמיתי שמוצג בחנות נלקח אוטומטית מאפל.
