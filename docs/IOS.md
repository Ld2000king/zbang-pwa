# מדריך: מהמקבוק החדש ועד הגשה ל-App Store

כל השלבים לפי הסדר. כל פקודה מריצים ב-**Terminal** של המק (⌘+רווח ← "Terminal").
הטקסטים להגשה נמצאים ב-[APP-STORE.md](APP-STORE.md), וצילומי המסך ב-`store/screenshots/iphone-6.9/`.

> אם משהו נתקע או מופיעה שגיאה - להעתיק את ההודעה ולשלוח ל-Claude. התיקונים בקוד נעשים ב-Windows, ובמק רק מושכים אותם (שלב 9).

---

## שלב 0 - חשבון מפתח (ביום הראשון, כי האישור לוקח זמן)

1. https://developer.apple.com/programs/enroll - נרשמים עם ה-Apple ID שלך כ-**Individual**. עולה **99$ לשנה**.
2. האישור לוקח בדרך כלל 24-48 שעות. בינתיים אפשר להמשיך לשלבים 1-6 - הרצה על האייפון שלך עובדת גם בלי המנוי.
3. אחרי האישור, ב-https://appstoreconnect.apple.com ← **Business** (או Agreements, Tax, and Banking):
   - לחתום על **Paid Apps Agreement**
   - למלא **פרטי בנק** ו-**טופס מס** (W-8BEN לתושב ישראל)
   - בלי זה המוצרים לרכישה לא ייטענו באפליקציה, והחנות לא תציג את חבילות המטבעות.

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
npm install
```

> **תמיד לעבוד על הענף `IOS`.** לבדוק עם `git branch` - הכוכבית צריכה להיות ליד IOS.

---

## שלב 3 - יצירת פרויקט ה-iOS (פעם אחת)

```bash
npm run add:ios
```
הפקודה הזו:
- בונה את קבצי המשחק לתיקייה `www/`
- יוצרת את תיקיית `ios/` עם פרויקט Xcode
- מתקינה את פלאגין הרכישות (CocoaPods)
- מוסיפה ל-Info.plist אוטומטית את הרשאות המצלמה והגלריה ואת `ITSAppUsesNonExemptEncryption = NO`

בסוף צריך לראות: `patch-ios-plist: added NSCameraUsageDescription, NSPhotoLibraryUsageDescription, ITSAppUsesNonExemptEncryption`

**אייקון ומסך פתיחה:**
```bash
npm run generate:native-assets
```

**לשמור את פרויקט ה-iOS בגיט** (כדי שההגדרות של Xcode לא ילכו לאיבוד):
```bash
git add ios && git commit -m "Add the iOS project" && git push
```

---

## שלב 4 - הגדרות ב-Xcode (פעם אחת)

```bash
npm run open:ios
```
Xcode נפתח. בצד שמאל ללחוץ על **App** (הכחול, למעלה), ואז ב-TARGETS לבחור **App**.

**לשונית Signing & Capabilities:**
- [ ] **Automatically manage signing** - מסומן
- [ ] **Team** - לבחור את החשבון שלך. אם לא מופיע: Xcode ← Settings ← Accounts ← "+" ← Apple ID.
- [ ] **Bundle Identifier** - חייב להיות `com.zabang.royale`
- [ ] **+ Capability** (למעלה משמאל) ← לחפש **In-App Purchase** ← דאבל-קליק

**לשונית General:**
- [ ] **Display Name** - `זבאנג רויאל` (השם שמופיע מתחת לאייקון באייפון. אם משאירים ריק - יופיע "Zabang Royale")
- [ ] **Version** - `1.0`
- [ ] **Build** - `1` (בכל העלאה חדשה להעלות ב-1: 2, 3, 4...)
- [ ] **Supported Destinations** - להשאיר רק **iPhone** (למחוק iPad עם "-"). כך אפל לא תבדוק את האפליקציה באייפד.
- [ ] **Minimum Deployments** - להשאיר כמו שהוא (Capacitor 6 = iOS 13 ומעלה)
- [ ] **Device Orientation** - לסמן רק **Portrait**

אחרי השינויים:
```bash
git add ios && git commit -m "Xcode: signing, in-app purchase, iPhone only" && git push
```

---

## שלב 5 - הרצה על האייפון שלך

1. לחבר את האייפון בכבל ולאשר "Trust This Computer" באייפון.
2. באייפון: **הגדרות ← פרטיות ואבטחה ← מצב מפתח (Developer Mode)** ← להפעיל ← האייפון יופעל מחדש.
3. ב-Xcode למעלה, ליד ▶, לבחור את **האייפון שלך** מהרשימה.
4. ללחוץ **▶** (או ⌘R).
5. בפעם הראשונה האייפון יחסום את האפליקציה: **הגדרות ← כללי ← ניהול VPN והתקנים** ← ללחוץ על החשבון שלך ← **אמון**. ואז ▶ שוב.

> אפשר גם בסימולטור (לבחור "iPhone 16 Pro Max" במקום האייפון), אבל רכישות ומצלמה נבדקות רק על מכשיר אמיתי.

---

## שלב 6 - מה לבדוק באייפון

- [ ] האפליקציה נפתחת, בלי מסך לבן
- [ ] **תפריט ← פרטיות** נפתח, ו"חזרה למשחק" מחזיר
- [ ] **תפריט ← תנאים** ו-**תמיכה** נפתחים
- [ ] קישור חיצוני בדף הפרטיות (Google) נפתח ב-Safari
- [ ] משחק מהיר, משחק מדויק, באטל רויאל, מגדל זבאנג
- [ ] **מולטיפלייר** - חדר עם חבר (או מול הדפדפן במחשב): יצירה, הצטרפות, משחק עד הסוף
- [ ] **תמונת פרופיל** - מהגלריה **וגם** "צלם תמונה" (בלי קריסה!)
- [ ] **חנות** - **אין** "צפה בסרטון". חבילות המטבעות מופיעות רק אחרי שלב 7 (לפני זה החלק הזה פשוט חסר - זה תקין)
- [ ] **פרופיל ← גיבוי בענן** - יצירת חשבון, התנתקות, כניסה, ו**מחיקת החשבון**
- [ ] **⋯** ליד שחקן בטבלת הדירוג - דיווח וחסימה
- [ ] **אין** אזור אדמין בפרופיל (גם עם השם ld2000)
- [ ] מצב טיסה - פתיחת האפליקציה, משחק יחיד עובד
- [ ] יציאה לבית וחזרה, נעילת מסך וחזרה - המשחק ממשיך / נשמר
- [ ] הטקסט בעברית מיושר נכון, ושום כפתור לא מוסתר מתחת לחריץ (notch) או לפס התחתון

---

## שלב 7 - App Store Connect: אפליקציה ומוצרים

אחרי שחשבון המפתח אושר (שלב 0). כל הטקסטים: [APP-STORE.md](APP-STORE.md).

1. https://appstoreconnect.apple.com ← **Apps** ← **+** ← **New App**
   - Platform: **iOS** | Name: `זבאנג רויאל` | Primary Language: **Hebrew**
   - Bundle ID: `com.zabang.royale` (אם לא מופיע ברשימה - ליצור ב-developer.apple.com ← Identifiers)
   - SKU: `zabang-royale-ios` | User Access: Full Access
2. **Monetization ← In-App Purchases ← +** - שלושה מוצרים מסוג **Consumable**, עם ה-Product ID **בדיוק** כמו ב-APP-STORE.md סעיף 4.
3. **Users and Access ← Sandbox ← Test Accounts ← +** - ליצור **Sandbox Tester** (מייל שלא משמש לשום Apple ID אחר, למשל `you+sandbox@gmail.com`).
4. באייפון: **הגדרות ← App Store ← Sandbox Account** (בגרסאות iOS חדשות זה יכול להיות תחת **הגדרות ← מפתח / Developer**) ← להתחבר עם ה-Sandbox Tester. לא צריך להתנתק מה-Apple ID הרגיל.
5. להריץ שוב מ-Xcode ולבדוק בחנות:
   - [ ] שלוש החבילות מופיעות עם מחיר
   - [ ] רכישה עוברת (בלי חיוב אמיתי) והמטבעות נכנסים
   - [ ] ביטול באמצע - בלי הודעת שגיאה
   - [ ] סגירה ופתיחה - המטבעות לא נזקפים פעמיים

---

## שלב 8 - העלאה והגשה

**העלאה מ-Xcode:**
1. למעלה ליד ▶ לבחור **Any iOS Device (arm64)**
2. **Product ← Archive** (כמה דקות)
3. נפתח חלון Organizer ← **Distribute App** ← **App Store Connect** ← **Upload** ← Next עד הסוף
4. אחרי 10-30 דקות הגרסה מופיעה ב-App Store Connect ← האפליקציה ← **TestFlight** (מגיע גם מייל)

**TestFlight (מומלץ לפני הגשה):** TestFlight ← Internal Testing ← להוסיף את עצמך ← להתקין את אפליקציית TestFlight באייפון ← לבדוק שוב את שלב 6.

**הגשה לבדיקה:** App Store Connect ← האפליקציה ← גרסה 1.0, ולמלא לפי APP-STORE.md:
- [ ] צילומי מסך - לגרור את 7 התמונות מ-`store/screenshots/iphone-6.9/` ל-**iPhone 6.9" Display**
- [ ] Promotional Text, Description, Keywords, Support URL, Marketing URL
- [ ] **Build** ← לבחור את הגרסה שהועלתה
- [ ] **In-App Purchases** ← לסמן את שלושת המוצרים
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
| החנות לא מציגה חבילות מטבעות | חסר Paid Apps Agreement (שלב 0), המוצרים לא נוצרו בדיוק עם אותו Product ID, או שעוד לא עברו כמה שעות מיצירתם |
| `Archive` אפור / לא זמין | לבחור למעלה **Any iOS Device** ולא סימולטור |
| קריסה ב"צלם תמונה" | `npm run patch:ios` ואז ▶ שוב (חסרה הרשאת מצלמה ב-Info.plist) |
| שינויים מ-Windows לא מופיעים | `git pull && npm run sync` (בלי sync הקבצים החדשים לא נכנסים לאפליקציה) |
