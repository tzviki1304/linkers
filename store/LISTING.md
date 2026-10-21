# Chrome Web Store listing — Link Saver 2.1.0

Copy these into the Developer Dashboard (https://chrome.google.com/webstore/devconsole).

Upload file: `dist/link-saver-2.1.0.zip`
Screenshots (1280×800): `store/screenshots/1-…5-….png`
Store icon (128×128): `icons/icon128.png`

---

## Store listing tab

**Category:** Productivity → Tools (or "Workflow & Planning")
**Language:** English (add Hebrew as a second listing language if you like — text below)

### Short description (max 132 characters)

EN:
> Your New Tab, organized: save links into workspaces and categories, search everything, and back up automatically every day.

HE:
> דף כרטיסייה חדשה מסודר: שמרו קישורים בסביבות עבודה וקטגוריות, חפשו הכול, וקבלו גיבוי אוטומטי כל יום.

### Detailed description

EN:
```
Link Saver turns your New Tab page into a clean, fast home for the links you use every day.

ORGANIZE
• Workspaces for Work, Personal, projects — each with its own color and emoji
• Categories inside each workspace, in a grid or compact list
• Drag & drop everything: open tabs into categories, links between categories and workspaces, reorder categories and workspaces
• Pin important links to the top, add notes and tags

SAVE FASTER
• Open tabs panel: drag any open tab into a category, or save all tabs in one click
• Right-click any page or link → Save to Link Saver → pick a category
• Alt+Shift+S saves the current tab to your Inbox
• Duplicate detection, so the same link isn't saved twice

FIND ANYTHING
• Ctrl+K searches every workspace: titles, addresses, notes and tags
• Open a whole category at once, in new tabs or a new window

NEVER LOSE YOUR LINKS
• Automatic daily backup to any folder you choose — pick a Google Drive / OneDrive / Dropbox folder for a cloud copy
• Or back up to a folder inside Downloads
• Restore from any backup, merge or replace; undo for every delete

YOUR CHOICE
• Use it as your New Tab page, or keep Chrome's page and open Link Saver from the toolbar (Alt+Shift+L)
• Light, dark or system theme
• Interface in English, Hebrew (full right-to-left), French, Spanish and Chinese

PRIVATE
Everything is stored locally in your browser. No account, no tracking, no ads.
```

HE:
```
Link Saver הופך את דף הכרטיסייה החדשה לבית נקי ומהיר לקישורים שאתם משתמשים בהם כל יום.

סדר
• סביבות עבודה לעבודה, לבית ולפרויקטים — לכל אחת צבע ואימוג׳י משלה
• קטגוריות בתוך כל סביבת עבודה, בתצוגת רשת או רשימה
• גרירה של הכול: כרטיסיות פתוחות לקטגוריות, קישורים בין קטגוריות וסביבות עבודה, שינוי סדר
• הצמדת קישורים חשובים למעלה, הערות ותגיות

שמירה מהירה
• חלונית כרטיסיות פתוחות: גררו כרטיסייה לקטגוריה, או שמרו את כולן בלחיצה
• לחיצה ימנית על כל דף או קישור ← שמירה ב-Link Saver ← בחירת קטגוריה
• Alt+Shift+S שומר את הכרטיסייה הנוכחית בדואר הנכנס
• זיהוי כפילויות

חיפוש
• Ctrl+K מחפש בכל סביבות העבודה: כותרות, כתובות, הערות ותגיות
• פתיחת קטגוריה שלמה בבת אחת

גיבוי
• גיבוי יומי אוטומטי לכל תיקייה שתבחרו — תיקיית Google Drive / OneDrive / Dropbox נותנת גם עותק בענן
• או גיבוי לתיקייה בתוך ההורדות
• שחזור מכל גיבוי, מיזוג או החלפה, וביטול לכל מחיקה

בחירה שלכם
• כדף כרטיסייה חדשה, או רק מסמל התוסף (Alt+Shift+L)
• ערכת נושא בהירה, כהה או לפי המערכת
• ממשק בעברית (מימין לשמאל), אנגלית, צרפתית, ספרדית וסינית

פרטיות
הכול נשמר מקומית בדפדפן. בלי חשבון, בלי מעקב, בלי פרסומות.
```

---

## Privacy practices tab

**Single purpose:**
> Link Saver replaces the New Tab page with a dashboard for saving and organizing the user's links into workspaces and categories.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `tabs` | Shows the user's open tabs (title, address, icon) in a side panel so they can drag or save them into categories, switch to them, or close them. |
| `storage` | Stores the user's workspaces, categories, links and settings locally. |
| `unlimitedStorage` | Users with large link collections can exceed the default local storage quota. |
| `alarms` | Checks once an hour whether the daily automatic backup is due. |
| `contextMenus` | Adds "Save to Link Saver" to the right-click menu so a page or link can be saved to a chosen category. |
| `favicon` | Shows each saved link's site icon from Chrome's local icon cache. |
| `downloads` (optional, requested only if the user picks it) | Saves the daily backup file into a folder inside Downloads and removes backups older than the user's chosen limit. |
| New Tab override | The extension's main purpose is a New Tab dashboard; users can switch back to Chrome's page in Settings. |

**Remote code:** No, I am not using remote code.

**Data usage** — tick:
- ☑ Web history (the user's saved links and open-tab list, stored only on the device)

And certify:
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** host `store/PRIVACY.md` (for example on GitHub) and paste its link.
