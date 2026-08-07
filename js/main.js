/* נקודת כניסה קלה: בודקת הגדרות ורשת לפני טעינת האפליקציה המלאה,
   כך שגם בלי חיבור ל-CDN של Firebase מוצג מסך ידידותי ולא דף ריק. */
import { firebaseConfig } from './firebase-config.js';

const configured = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL);

if (!configured) {
  renderScreen('🔧', 'עוד רגע והאפליקציה מוכנה!', [
    'חסרה הגדרת החיבור למסד הנתונים (Firebase).',
    'פתחו את הקובץ <code>js/firebase-config.js</code> והדביקו בו את ההגדרות לפי ההוראות המלאות בקובץ <code>README.md</code>.',
    'ההקמה נעשית פעם אחת בלבד, לוקחת כ־5 דקות, וחינמית לגמרי.',
  ]);
} else {
  import('./app.js').catch((err) => {
    console.error(err);
    renderScreen('📡', 'אין חיבור לאינטרנט', [
      'לא הצלחנו לטעון את האפליקציה. בדקו את החיבור ונסו לרענן.',
    ], true);
  });
}

function renderScreen(icon, title, paragraphs, withRetry = false) {
  const topbar = document.getElementById('topbar');
  topbar.innerHTML = '<div class="title">🏕️ טיול משפחות</div>';
  const view = document.getElementById('view');
  view.classList.add('no-tabs');
  view.innerHTML = `
    <div class="setup-screen">
      <div class="big">${icon}</div>
      <h1>${title}</h1>
      ${paragraphs.map((p) => `<p>${p}</p>`).join('')}
      ${withRetry ? '<button class="btn" style="margin-top:14px" onclick="location.reload()">ניסיון חוזר</button>' : ''}
    </div>`;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
