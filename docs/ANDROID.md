# Android (Capacitor) - איך לבנות ולהריץ

המשחק הוא אותו אתר (PWA) שיושב בשורש הריפו. Capacitor עוטף אותו כאפליקציה.
כל שינוי במשחק נעשה בקבצים שבשורש (`game.js`, `index.html` וכו') - לא בתוך `android/`.

## דרישות (חינם)

- Node.js 22 ומעלה
- Android Studio (כולל Android SDK)
- JDK 21 (מגיע עם Android Studio)

## הפקודות

| פקודה | מה היא עושה |
|---|---|
| `npm install` | מתקין את התלויות (פעם אחת, או אחרי `git pull` ששינה את `package.json`) |
| `npm run sync` | בונה את `www/` מהקבצים שבשורש ומעתיק אותם לפרויקט ה-Android. **להריץ אחרי כל שינוי בקוד המשחק** |
| `npm run open:android` | פותח את הפרויקט ב-Android Studio |
| `npm run generate:native-assets` | מייצר מחדש אייקונים ו-splash מתוך `assets/` |

## הרצה ב-Android Studio

1. `npm install` ואז `npm run sync`
2. `npm run open:android` (או ב-Android Studio: File → Open → התיקייה `android`)
3. בפעם הראשונה: לחכות שה-Gradle Sync יסתיים (פס ההתקדמות למטה)
4. לבחור מכשיר ברשימה שלמעלה (אמולטור, למשל `Medium_Phone`, או טלפון מחובר)
5. ללחוץ על ▶ Run

### טלפון אמיתי

1. בטלפון: הגדרות → מידע על הטלפון → ללחוץ 7 פעמים על "מספר Build" (פותח "אפשרויות מפתחים")
2. הגדרות → אפשרויות מפתחים → להפעיל "ניפוי באגים ב-USB"
3. לחבר בכבל USB ולאשר בטלפון את ההודעה "לאפשר ניפוי באגים?"
4. הטלפון יופיע ברשימת המכשירים ב-Android Studio → ▶ Run

## מה מותאם ל-Android

- **כפתור Back** (`native.js`): סוגר חלון פתוח → משהה משחק רץ → חוזר למסך הבית → במסך הבית ממזער את האפליקציה.
  במולטיפלייר Back לא עושה כלום באמצע משחק (כדי לא להפסיד בטעות).
- **יציאה לרקע**: המוזיקה נעצרת ומשחק יחיד/בוטים עובר להשהיה.
- **Portrait** בלבד (`AndroidManifest.xml`). הערה: מ-Android 16 מערכת ההפעלה מתעלמת מנעילת כיוון בטאבלטים ובמסכים מתקפלים.
- **הרשאות**: רק `INTERNET` ו-`BILLING` (השנייה מגיעה מספריית הרכישות).

## רכישות

`purchases.js` - השכבה המשותפת שהמשחק משתמש בה (Google, Apple ו-Web).
`purchases-native.js` - המימוש ל-Google Play ול-Apple דרך `cordova-plugin-purchase` (חינמית, MIT).
כל ההבדלים בין החנויות נמצאים ב-`NATIVE_STORES` שבקובץ הזה.

ב-PWA ובאפליקציה שעדיין לא הוגדרו לה מוצרים בחנות, כפתור הקנייה מציג "בקרוב" - זה צפוי.

### מה נשאר (דורש חשבון / כסף - לא בוצע)

1. **Google Play Console** - חשבון מפתח (תשלום חד-פעמי של $25).
2. יצירת 3 מוצרים מסוג In-app product (consumable) עם המזהים **בדיוק** כמו ב-`COIN_PACKAGES` (`game.js`):
   `com.zabang.royale.coins.small`, `com.zabang.royale.coins.medium`, `com.zabang.royale.coins.large`
3. העלאת גרסה חתומה (release) ל-Internal testing והוספת License testers - רק אז Google מאפשרת לבדוק רכישות (בלי חיוב אמיתי לבודקים).
4. מומלץ בעתיד: אימות קבלות בשרת. כרגע האימות מקומי (כמו שאר כלכלת המטבעות שנשמרת במכשיר).
   בשרת של Firebase זה דורש Cloud Functions = מסלול Blaze (בתשלום לפי שימוש).

## iOS בעתיד (על Mac)

```
npm install
npx cap add ios
npm run sync
npx cap open ios
```
ב-Xcode: Signing & Capabilities → להוסיף **In-App Purchase**. ב-App Store Connect ליצור את אותם 3 מוצרים
(Consumable) עם אותם מזהים. לא צריך לשנות קוד - `purchases-native.js` כבר כולל את הגדרות Apple.
(Apple Developer Program עולה $99 לשנה.)

## חזרה אחורה

לפני העבודה נוצר tag מקומי: `pre-android-restore-point` (= master כפי שהיה).
