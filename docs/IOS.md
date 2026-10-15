# מדריך: מהמקבוק החדש ועד הגשה ל-App Store

כל השלבים לפי הסדר. כל פקודה מריצים ב-**Terminal** של המק (⌘+רווח ← "Terminal").
הטקסטים להגשה נמצאים ב-[APP-STORE.md](APP-STORE.md), וצילומי המסך ב-`store/screenshots/iphone-6.3/` (1206×2622 - הסט שהועלה; הסט הישן `iphone-6.9/` נשאר לעיון).

> אם משהו נתקע או מופיעה שגיאה - להעתיק את ההודעה ולשלוח ל-Claude. התיקונים בקוד נעשים ב-Windows, ובמק רק מושכים אותם (שלב 9).

---

## שלב 0 - חשבון מפתח (ביום הראשון, כי האישור לוקח זמן)

1. https://developer.apple.com/programs/enroll - נרשמים עם ה-Apple ID שלך כ-**Individual**. עולה **99$ לשנה**.
2. האישור לוקח בדרך כלל 24-48 שעות. בינתיים אפשר להמשיך לשלבים 1-6 - הרצה על האייפון שלך עובדת גם בלי המנוי.
3. **גרסה 1.0 חינמית, בלי רכישות ובלי פרסומות** - לכן **לא צריך** Paid Apps Agreement, פרטי בנק או טופס מס. הסכם האפליקציות החינמיות נחתם אוטומטית עם ההרשמה.
   (כשיוחלט להפעיל רכישות - ראו "פיתוח עתידי" בסוף המדריך.)

---

## שלב 1 - התקנות (פעם אחת, בערך שעה)

1. **Xcode** - מה-App Store של המק (חינם, הורדה גדולה - להתחיל ראשון).
   אחרי ההתקנה לפתוח אותו פעם אחת, לאשר את הרישיון ולתת לו להתקין רכיבים. אם הוא שואל על פלטפורמות - לסמן **iOS**.

2. **Command Line Tools** (אם לא הותקנו עם Xcode):
   ```bash
   xcode-select --install
   ```

3. **Homebrew** - מנהל ההתקנות של המק. להעתיק את הפקודה מ-https://brew.sh ולהריץ.
   בסוף ההתקנה הוא מדפיס 2 פקודות תחת "Next steps" - **להריץ גם אותן** (הן מוסיפות את brew ל-PATH).

4. **Node, Git, CocoaPods ו-GitHub CLI:**
   ```bash
   brew install node git cocoapods gh
   ```

5. **בדיקה שהכול הותקן:**
   ```bash
   node -v && git --version && pod --version && xcodebuild -version
   ```
   צריך לראות ארבע גרסאות בלי שגיאה (Node 18 ומעלה, Xcode 15 ומעלה).

6. **התחברות ל-GitHub** (כדי שתוכל למשוך ולדחוף שינויים):
   ```bash
   gh auth login
   ```
   לבחור: GitHub.com ← HTTPS ← Yes ← Login with a web browser.

---

## שלב 2 - הורדת הפרויקט

```bash
cd ~/Desktop
git clone https://github.com/Ld2000king/zbang-pwa.git
cd zbang-pwa
git checkout IOS
npm ci
```

> **תמיד לעבוד על הענף `IOS`.** לבדוק עם `git branch` - הכוכבית צריכה להיות ליד IOS.

> `npm ci` מתקין בדיוק את הגרסאות שב-`package-lock.json` (בלי לשנות אותו). אזהרה על `sharp@0.32.6` ו-`allowScripts` היא תקינה - הקובץ המהודר של sharp כבר כלול בחבילה, ואין צורך לאשר את הסקריפט.

---

## שלב 3 - פרויקט ה-iOS (✅ כבר נוצר ונשמר בגיט)

תיקיית `ios/` כבר קיימת בענף `IOS`, כולל כל התיקונים שלמטה. **לא להריץ `npm run add:ios` שוב.** אחרי `git clone` מספיק:
```bash
npm run sync
```
הפקודה בונה את `www/`, מעתיקה אותו לפרויקט, מריצה `pod install` ומוודאת את ההרשאות ב-Info.plist. בסוף צריך לראות `patch-ios-plist: Info.plist already has every key.`

**מה תוקן בפרויקט אחרי `add:ios`** (Capacitor 6 נוצר עם תבנית ישנה מ-Xcode 27). אם אי פעם יוצרים את `ios/` מחדש - צריך לחזור על שלושתם:

1. **מינימום iOS 15** - Xcode 27 לא בונה ל-iOS 13 (`deployment target ... 13.0 ... range ... 15.0 to 27.0`):
   - `ios/App/Podfile`: `platform :ios, '15.0'`, ובתוך `post_install` (אחרי `assertDeploymentTarget`) לולאה שקובעת `IPHONEOS_DEPLOYMENT_TARGET = '15.0'` לכל יעדי ה-Pods.
   - `ios/App/App.xcodeproj/project.pbxproj`: כל `IPHONEOS_DEPLOYMENT_TARGET = 13.0` ← `15.0`.
   - ואז `cd ios/App && pod install`.
2. **Scene Lifecycle** - אפליקציה שנבנית עם ה-SDK של iOS 27 בלי UIScene לא עולה (מסך שחור, `EXC_BREAKPOINT` ב-AppDelegate, ובלוג: `UIScene life cycle is required for apps built with this SDK`):
   - `Info.plist`: `UIApplicationSceneManifest` עם Scene אחד - `UISceneDelegateClassName = $(PRODUCT_MODULE_NAME).SceneDelegate`, `UISceneStoryboardFile = Main`.
   - `AppDelegate.swift`: מחלקה `SceneDelegate` בסוף הקובץ, שמעבירה קישורים חיצוניים (URL / Universal Links) ל-`ApplicationDelegateProxy` של Capacitor.
3. **בלי פס כחול בתחתית** - ב-`capacitor.config.json`: `"ios": { "contentInset": "never" }`. עם `"always"` ה-WebView מתכווץ, ומתחת לתפריט התחתון נחשף פס בצבע `backgroundColor` (`#7FC4E8`). ה-CSS כבר מטפל באזורי ה-notch וה-Home Indicator עם `env(safe-area-inset-*)`.

**אייקון ומסך פתיחה** (✅ כבר נוצרו ונשמרו). אם משנים את התמונות בתיקיית `assets/`:
```bash
npx capacitor-assets generate --ios --assetPath assets
```
חשוב לכתוב `--ios` - בלעדיו הכלי עלול לגעת גם בקבצי האתר. האייקון יוצא 1024×1024 בלי שקיפות, כמו שאפל דורשת.

---

## שלב 4 - הגדרות ב-Xcode (פעם אחת)

```bash
npm run open:ios
```
Xcode נפתח. בצד שמאל ללחוץ על **App** (הכחול, למעלה), ואז ב-TARGETS לבחור **App**.

**לשונית Signing & Capabilities** (צריך חשבון מפתח - שלב 0):
- [x] **Automatically manage signing** - מסומן
- [ ] **Team** - לבחור את החשבון שלך. אם לא מופיע: Xcode ← Settings ← Accounts ← "+" ← Apple ID.
- [x] **Bundle Identifier** - `com.zabang.royale`
- **לא** להוסיף Capability של In-App Purchase בגרסה 1.0 (רק בעתיד - ראו "פיתוח עתידי").

**לשונית General** (✅ כבר הוגדר ונשמר בגיט - רק לוודא):
- [x] **Display Name** - `זבאנג רויאל` (השם שמופיע מתחת לאייקון באייפון)
- [x] **Version** - `1.0`
- [x] **Build** - `1` (בכל העלאה חדשה להעלות ב-1: 2, 3, 4...)
- [x] **Supported Destinations** - רק **iPhone**. כך אפל לא תבדוק את האפליקציה באייפד.
- [x] **Minimum Deployments** - **iOS 15.0** (לא להוריד - ראו שלב 3)
- [x] **Device Orientation** - רק **Portrait**

אחרי בחירת ה-Team:
```bash
git add ios && git commit -m "Xcode: signing team" && git push
```

---

## שלב 5 - הרצה בסימולטור ועל האייפון שלך

**סימולטור (חינם, בלי חשבון מפתח):**
1. `npm run open:ios` - נפתח `ios/App/App.xcworkspace` (תמיד ה-workspace, לא `App.xcodeproj`).
2. ב-Xcode למעלה, ליד ▶, לבחור **iPhone 18 Pro** תחת iOS Simulators.
3. ▶ (או ⌘R). הסימולטור נפתח לבד והמשחק עולה.

בנייה לסימולטור מהטרמינל, בלי Xcode ובלי חתימה (לבדיקה מהירה שהכול נבנה):
```bash
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```
צריך לראות `** BUILD SUCCEEDED **`. אזהרות `deprecated` מ-Capacitor (`WKProcessPool`, `UTType...`) תקינות.

**האייפון שלך:**

1. לחבר את האייפון בכבל ולאשר "Trust This Computer" באייפון.
2. באייפון: **הגדרות ← פרטיות ואבטחה ← מצב מפתח (Developer Mode)** ← להפעיל ← האייפון יופעל מחדש.
3. ב-Xcode למעלה, ליד ▶, לבחור את **האייפון שלך** מהרשימה.
4. ללחוץ **▶** (או ⌘R).
5. בפעם הראשונה האייפון יחסום את האפליקציה: **הגדרות ← כללי ← ניהול VPN והתקנים** ← ללחוץ על החשבון שלך ← **אמון**. ואז ▶ שוב.

> בסימולטור אין מצלמה - אותה בודקים רק על מכשיר אמיתי.

---

## שלב 6 - מה לבדוק באייפון

- [ ] האפליקציה נפתחת, בלי מסך לבן
- [ ] **תפריט ← פרטיות** נפתח, ו"חזרה למשחק" מחזיר
- [ ] **תפריט ← תנאים** ו-**תמיכה** נפתחים
- [ ] קישור חיצוני בדף הפרטיות (Google) נפתח ב-Safari
- [ ] משחק מהיר, משחק מדויק, באטל רויאל, מגדל זבאנג
- [ ] **מולטיפלייר** - חדר עם חבר (או מול הדפדפן במחשב): יצירה, הצטרפות, משחק עד הסוף
- [ ] **תמונת פרופיל** - מהגלריה **וגם** "צלם תמונה" (בלי קריסה!)
- [ ] **חנות** - **אין** "צפה בסרטון" ו**אין** "קבל מטבעות" (חבילות בכסף אמיתי). בגרסה 1.0 זה התקין - יש רק עזרים, דמויות וערכות צליל שנקנים במטבעות/יהלומים מהמשחק
- [ ] **פרופיל ← גיבוי בענן** - יצירת חשבון, התנתקות, כניסה, ו**מחיקת החשבון**
- [ ] **⋯** ליד שחקן בטבלת הדירוג - דיווח וחסימה
- [ ] **אין** אזור אדמין בפרופיל (גם עם השם ld2000)
- [ ] מצב טיסה - פתיחת האפליקציה, משחק יחיד עובד
- [ ] יציאה לבית וחזרה, נעילת מסך וחזרה - המשחק ממשיך / נשמר
- [ ] הטקסט בעברית מיושר נכון, ושום כפתור לא מוסתר מתחת לחריץ (notch) או לפס התחתון

---

## שלב 7 - App Store Connect: האפליקציה

אחרי שחשבון המפתח אושר (שלב 0). כל הטקסטים: [APP-STORE.md](APP-STORE.md).

1. https://appstoreconnect.apple.com ← **Apps** ← **+** ← **New App**
   - Platform: **iOS** | Name: `זבאנג רויאל` | Primary Language: **Hebrew**
   - Bundle ID: `com.zabang.royale` (אם לא מופיע ברשימה - ליצור ב-developer.apple.com ← Identifiers)
   - SKU: `zabang-royale-ios` | User Access: Full Access

בגרסה 1.0 **לא** יוצרים מוצרים לרכישה ולא Sandbox Tester (ההוראות עברו ל"פיתוח עתידי").

---

## שלב 8 - העלאה והגשה

**העלאה מ-Xcode:**
1. למעלה ליד ▶ לבחור **Any iOS Device (arm64)**
2. **Product ← Archive** (כמה דקות)
3. נפתח חלון Organizer ← **Distribute App** ← **App Store Connect** ← **Upload** ← Next עד הסוף
4. אחרי 10-30 דקות הגרסה מופיעה ב-App Store Connect ← האפליקציה ← **TestFlight** (מגיע גם מייל)

**TestFlight (מומלץ לפני הגשה):** TestFlight ← Internal Testing ← להוסיף את עצמך ← להתקין את אפליקציית TestFlight באייפון ← לבדוק שוב את שלב 6.

**הגשה לבדיקה:** App Store Connect ← האפליקציה ← גרסה 1.0, ולמלא לפי APP-STORE.md:
- [x] צילומי מסך - ✅ הועלו: **6** התמונות `01-home` עד `06-cities` מ-`store/screenshots/iphone-6.3/` (1206×2622) ל-**iPhone 6.3" Display** - הקטגוריה החובה. תמונות 1320×2868 (`iphone-6.9/`) נדחות שם עם "File dimensions are invalid" (פרטים: APP-STORE.md סעיף 8)
- [ ] Promotional Text, Description, Keywords, Support URL, Marketing URL
- [ ] **Build** ← לבחור את הגרסה שהועלתה
- [ ] **App Review Information** ← פרטי קשר + חשבון בדיקה + Notes
- [ ] **App Privacy** (בתפריט משמאל) ← התשובות מסעיף 6
- [ ] **Age Rating** ← התשובות מסעיף 7
- [ ] **Pricing and Availability** ← Free
- [ ] **Add for Review** ← **Submit**

הבדיקה של אפל לוקחת בדרך כלל 24-48 שעות. אם יש דחייה - להעתיק את ההודעה של אפל ולשלוח ל-Claude.

---

## שלב 9 - כשיש שינויים בקוד (העבודה השוטפת)

התיקונים נעשים ב-Windows ונדחפים לענף `IOS`. במק:
```bash
cd ~/Desktop/zbang-pwa
git pull
npm run sync
```
ואז ▶ ב-Xcode. אין צורך ליצור את פרויקט ה-iOS מחדש.

**לגרסה חדשה בחנות:** ב-Xcode להעלות את **Build** ב-1 (ואם יש שינוי משמעותי - גם את **Version**, למשל 1.1), ואז שלב 8 מההתחלה.

---

## תקלות נפוצות

| בעיה | פתרון |
|---|---|
| `pod: command not found` | `brew install cocoapods`, ואז `npx cap sync ios` |
| `No signing certificate` / `No account for team` | Xcode ← Settings ← Accounts ← להוסיף Apple ID; ב-Signing לבחור Team |
| `Untrusted Developer` באייפון | הגדרות ← כללי ← ניהול VPN והתקנים ← אמון |
| מסך לבן כשהאפליקציה נפתחת | `npm run sync` ואז ▶ שוב (חסרים קבצים ב-www) |
| `Archive` אפור / לא זמין | לבחור למעלה **Any iOS Device** ולא סימולטור |
| קריסה ב"צלם תמונה" | `npm run patch:ios` ואז ▶ שוב (חסרה הרשאת מצלמה ב-Info.plist) |
| שינויים מ-Windows לא מופיעים | `git pull && npm run sync` (בלי sync הקבצים החדשים לא נכנסים לאפליקציה) |
| `deployment target ... 13.0 ... range ... 15.0 to 27.0` | מינימום iOS 15 ב-Podfile וב-project.pbxproj, ואז `pod install` (שלב 3, סעיף 1) |
| מסך שחור + `EXC_BREAKPOINT` ב-AppDelegate.swift | חסר Scene Lifecycle (שלב 3, סעיף 2). לוודא שב-Info.plist יש `UIApplicationSceneManifest` |
| פס תכלת מתחת לתפריט התחתון | `"contentInset": "never"` ב-`capacitor.config.json`, ואז `npm run sync` (שלב 3, סעיף 3) |
| אזהרת `sharp@0.32.6` / `allowScripts` ב-npm | תקין, לא צריך לעשות כלום (שלב 2) |

---

## מצב הבדיקות (14.10.2026, סימולטור iPhone 18 Pro, iOS 27, Xcode 27)

**עברו - נבדקו בפועל בסימולטור:**
- [x] בנייה נקייה (`clean build`) - בלי שגיאות
- [x] התקנה חדשה: מסך "ברוכים הבאים", שמירת שם, מעבר לבית - בלי קריסות ובלי שגיאות JavaScript בלוג
- [x] משחק מהיר, משחק מדויק, באטל רויאל (קל) - הלוח עולה, הטיימר רץ, מילה נספרת, מסך סיום מופיע
- [x] בית, חנות, פרופיל, דירוג - בלי גלילה אופקית, התפריט התחתון צמוד לתחתית
- [x] שמירת נתונים - נשמרים אחרי מעבר לרקע ואחרי סגירה מלאה ופתיחה מחדש
- [x] Firebase - חיבור והתחברות אנונימית; טבלת הדירוג נטענת (קריאה בלבד)
- [x] 22 תמונות האווטאר נטענות
- [x] עם השם `ld2000` אין אזור אדמין; אין "צפה בסרטון" בחנות
- [x] אייקון זבאנג, מסך פתיחה, והשם "זבאנג רויאל" מתחת לאייקון
- [x] אין פס כחול בתחתית; תגיות "במלאי" וערכות הצליל בחנות לא נחתכות

**פתוחות - עוד לא נבדקו:**
- [ ] מולטיפלייר בין שני מכשירים (חדר עם קוד + משחק אקראי)
- [ ] מצלמה וגלריה לתמונת פרופיל - באייפון אמיתי
- [ ] גיבוי בענן: יצירת חשבון, התנתקות, כניסה ומחיקת חשבון
- [ ] דיווח וחסימה של שחקן (⋯ בטבלת הדירוג)
- [ ] גרירת אצבע אמיתית על הלוח (בבדיקה האוטומטית הקלט הופעל מהקוד), וקפיצת גלילה (bounce) בסוף המסך
- [ ] מגדל זבאנג - משחק מלא (נבדק רק שהלוח עולה והיציאה עובדת)
- [ ] תפריט ☰: פרטיות, תנאים, תמיכה, וקישור חיצוני שנפתח ב-Safari
- רכישות Sandbox - לא רלוונטי לגרסה 1.0 (אין רכישות). ראו "פיתוח עתידי".
- [ ] **באג אפשרי:** בבאטל רויאל, שנייה אחרי מילה, הכרטיס "אתה" בפס השחקנים העליון הראה 0 בזמן ש"הניקוד שלך" הראה 100 (במסך סיום הסיבוב הניקוד היה נכון). לא נחקר - אולי הפס מתעדכן רק בקצב הבוטים

**לפני הפרסום הבא של גרסת האתר:** ב-`game.css` יש שינוי (תיקון החנות), ולכן צריך להעלות את `VERSION` ב-`sw.js` מ-v37 ל-v38, ואת ה-`?v=` שב-`index.html` בהתאם. אחרת מי שכבר טען את האתר ימשיך לקבל את ה-CSS הישן.

---

## פיתוח עתידי - הפעלת רכישות בכסף אמיתי (לא בגרסה 1.0)

הקוד של הרכישות (`iap.js`) נשאר באפליקציה ולא צריך לשנות אותו. כדי להפעיל אותו בעדכון:

1. App Store Connect ← **Business** (Agreements, Tax, and Banking):
   - לחתום על **Paid Apps Agreement**
   - למלא **פרטי בנק** ו-**טופס מס** (W-8BEN לתושב ישראל)
   - בלי זה המוצרים לרכישה לא ייטענו באפליקציה, והחנות לא תציג את חבילות המטבעות.
2. Xcode ← Signing & Capabilities ← **+ Capability** ← **In-App Purchase** ← דאבל-קליק.
3. App Store Connect, לפי APP-STORE.md סעיף 9:
   - **Monetization ← In-App Purchases ← +** - שלושה מוצרים מסוג **Consumable**, עם ה-Product ID **בדיוק** כמו ב-APP-STORE.md סעיף 9.
   - **Users and Access ← Sandbox ← Test Accounts ← +** - ליצור **Sandbox Tester** (מייל שלא משמש לשום Apple ID אחר, למשל `you+sandbox@gmail.com`).
   - באייפון: **הגדרות ← App Store ← Sandbox Account** (בגרסאות iOS חדשות זה יכול להיות תחת **הגדרות ← מפתח / Developer**) ← להתחבר עם ה-Sandbox Tester. לא צריך להתנתק מה-Apple ID הרגיל.
   - להריץ שוב מ-Xcode ולבדוק בחנות:
      - [ ] שלוש החבילות מופיעות עם מחיר
      - [ ] רכישה עוברת (בלי חיוב אמיתי) והמטבעות נכנסים
      - [ ] ביטול באמצע - בלי הודעת שגיאה
      - [ ] סגירה ופתיחה - המטבעות לא נזקפים פעמיים
4. לעדכן בחזרה את APP-STORE.md (סעיף 9 מפרט מה) ואת שלב 8 כאן: לסמן את המוצרים בעמוד הגרסה, ולהוסיף צילום חנות חדש ב-1206×2622 (ראו APP-STORE.md סעיף 9).

| בעיה | פתרון |
|---|---|
| החנות לא מציגה חבילות מטבעות | חסר Paid Apps Agreement (סעיף 1 כאן), המוצרים לא נוצרו בדיוק עם אותו Product ID, או שעוד לא עברו כמה שעות מיצירתם |
