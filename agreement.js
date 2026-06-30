# טופס פרטי מתאמן ותהליך אימון — בית הספר למנהיגות תודעתית

טופס דיגיטלי דו-שלבי: מתאמן בוחר מאמן וממלא פרטים, חותם, ומקבל קישור לשליחה למאמן.
המאמן פותח את הקישור, רואה את הפרטים, חותם, וה-PDF הסופי (עברית מלאה, RTL) זמין להורדה.

כל הנתונים נשמרים בטבלת Airtable הקיימת ("Tal Bashan CRM" → "אנשי קשר"),
בעמודה "טופס פרטי מתאמן והליך אימון".

## ⚠️ חשוב: יש להעלות דרך GitHub, לא דרך גרירת ZIP

לפרויקט הזה יש **חלק שרת** (Netlify Function שמתחבר לאיירטייבל). גרירת קובץ ZIP
ל-Netlify מעלה רק קבצים סטטיים ולא מפעילה פונקציות שרת — מה שיגרום לטופס לא לשמור נתונים,
או לדף "Page not found" אם מבנה התיקיות לא בדיוק כמו שNetlify מצפה.

**הדרך הנכונה: חיבור ל-GitHub.**

### שלב 1: יצירת Personal Access Token באיירטייבל
1. עבור ל-https://airtable.com/create/tokens
2. צור טוקן חדש עם הרשאות: `data.records:read`, `data.records:write`
3. תן לו גישה לבסיס "Tal Bashan CRM" (appnKmW94PJcSJX6M)
4. שמור את הטוקן (יוצג רק פעם אחת)

### שלב 2: יצירת ריפו ב-GitHub
1. כנס ל-https://github.com/new
2. תן שם לריפו (לדוגמה `training-agreement-form`), השאר אותו Private אם תרצה
3. **אל תסמן** "Add a README" (כבר יש לנו אחד) — צור ריפו ריק
4. בעמוד הריפו החדש, לחץ "uploading an existing file"
5. חלץ (Extract) את קובץ ה-ZIP הזה במחשב שלך, וגרור את **כל התוכן שבפנים**
   (התיקיות `public/`, `netlify/`, והקבצים `netlify.toml`, `package.json`, `.gitignore`, `README.md`)
   — לא לגרור את קובץ ה-ZIP עצמו, ולא ליצור עוד תיקייה עוטפת
6. כתוב הודעת קומיט (לדוגמה "העלאה ראשונית") ולחץ "Commit changes"

### שלב 3: חיבור ל-Netlify
1. היכנס ל-https://app.netlify.com
2. "Add new site" → "Import an existing project" → "Deploy with GitHub"
3. בחר את הריפו שיצרת
4. הגדרות הבנייה אמורות להתמלא אוטומטית מתוך `netlify.toml` (Publish directory: `public`, Functions directory: `netlify/functions`) — אם לא, מלא אותן ידנית
5. לחץ "Deploy site"

### שלב 4: הוספת משתנה הסביבה
1. לאחר הפריסה: Site settings → Environment variables → "Add a variable"
2. מפתח: `AIRTABLE_API_KEY`
3. ערך: הטוקן מהשלב הראשון
4. שמור, ואז עבור ל-Deploys → "Trigger deploy" → "Deploy site" (כדי שמשתנה הסביבה ייכנס לתוקף)

### שלב 5: בדיקה
1. פתח את כתובת ה-Netlify שקיבלת (לדוגמה `your-site.netlify.app`)
2. בחר מאמן, בחר מתאמן מהרשימה, מלא טופס, חתום, שלח
3. פתח את הקישור שנוצר (יראה כמו `your-site.netlify.app/?token=...`) — זה הקישור לשלוח למאמן

מעכשיו, כל פעם שתרצה לעדכן את הטופס, פשוט תעלה קובץ מעודכן לאותו ריפו ב-GitHub —
Netlify יבנה וייפרס אוטומטית מחדש.

## מבנה הפרויקט
- `public/index.html` — הטופס המלא (פרונט-אנד, כולל גופן עברי מוטבע ל-PDF)
- `netlify/functions/agreement.js` — הפונקציה שמתחברת לאיירטייבל (כל הלוגיקה בצד שרת, הטוקן לא נחשף לדפדפן)
- `netlify.toml` — קונפיגורציית Netlify

## עדכון רשימת מאמנים
רשימת 47 המאמנים מוטבעת בקובץ `public/index.html` (קבוע `TRAINERS`).
אם נוספו/הוסרו מאמנים בטבלת "צוות", יש לעדכן את הרשימה הזו ולפרוס מחדש.
(אפשר לבקש מ-Claude לרענן את הרשימה מאיירטייבל ולבנות גרסה מעודכנת.)

