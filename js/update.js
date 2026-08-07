/* בדיקת גרסה חדשה + רענון עמוק (ניקוי Service Worker ומטמון) */
import { el, openModal } from './ui.js';
import { APP_VERSION } from './version.js';

const DISMISS_KEY = 'trip.updateDismissed';
const RENAG_HOURS = 6;
const CHECK_EVERY_MS = 15 * 60 * 1000;

let showing = false;
let lastCheck = 0;

export function initUpdateChecker() {
  cleanCacheBusterFromUrl();

  setTimeout(check, 4000);
  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}

async function check({ manual = false } = {}) {
  if (showing) return null;
  if (!manual && Date.now() - lastCheck < 60000) return null;
  lastCheck = Date.now();

  let info;
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    info = await res.json();
  } catch {
    return null;
  }

  if (!info?.version || info.version === APP_VERSION) return info;
  if (!manual && isDismissed(info.version)) return info;

  showUpdateModal(info);
  return info;
}

function isDismissed(version) {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
    return raw.version === version
      && Date.now() - (raw.at || 0) < RENAG_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function showUpdateModal(info) {
  showing = true;

  const changes = Array.isArray(info.changes) ? info.changes : [];
  const button = el('button', { class: 'btn block', onclick: update }, '🔄 עדכון עכשיו');

  const { close } = openModal(null, el('div', { class: 'update-sheet' },
    el('div', { class: 'ico' }, '🎉'),
    el('h2', {}, 'יש גרסה חדשה!'),
    el('div', { class: 'ver' }, `גרסה ${info.version}`),
    changes.length
      ? el('ul', { class: 'changes' }, changes.map((c) => el('li', {}, c)))
      : null,
    button,
    el('p', { class: 'note' }, 'העדכון מבצע רענון מלא ומנקה את הזיכרון המקומי של האפליקציה. הנתונים שלכם נשמרים בענן ולא ייפגעו.'),
    el('button', { class: 'btn ghost block', onclick: later }, 'אחר כך'),
  ), { className: 'update-modal', onClose: () => { showing = false; } });

  async function update() {
    button.disabled = true;
    button.textContent = 'מעדכנים…';
    await hardRefresh();
  }

  function later() {
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ version: info.version, at: Date.now() }));
    } catch { /* אין localStorage — פשוט נשאל שוב בפעם הבאה */ }
    close();
  }
}

/* רענון עמוק: הסרת Service Worker, מחיקת כל המטמונים, וטעינה מחדש מהרשת */
export async function hardRefresh() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* ממשיכים גם אם נכשל */ }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ממשיכים גם אם נכשל */ }

  // חותמת זמן בכתובת כדי לעקוף גם את המטמון של הדפדפן עצמו
  const url = `${location.pathname}?v=${Date.now()}${location.hash}`;
  location.replace(url);
}

export function checkNow() {
  return check({ manual: true });
}

export { APP_VERSION };

/* אחרי רענון עמוק — ניקוי חותמת הזמן מהכתובת */
function cleanCacheBusterFromUrl() {
  if (!location.search.includes('v=')) return;
  const params = new URLSearchParams(location.search);
  params.delete('v');
  const query = params.toString();
  history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
}
