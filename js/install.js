/* באנר "התקינו את האפליקציה" — PWA install prompt */
import { el } from './ui.js';

const DISMISS_KEY = 'trip.installDismissedAt';
const REMIND_AFTER_DAYS = 7;

export function initInstallBanner() {
  // כבר מותקן — אין מה להציע
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;

  const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
  if (Date.now() - dismissedAt < REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000) return;

  const root = document.getElementById('install-root');

  // אנדרואיד / Chrome — דיאלוג התקנה אמיתי
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    showBanner({
      text: 'התקינו את האפליקציה למסך הבית',
      sub: 'גישה מהירה, מסך מלא — כמו אפליקציה אמיתית',
      buttonLabel: 'התקנה',
      onInstall: async () => {
        e.prompt();
        await e.userChoice;
        hide();
      },
    });
  });

  // iPhone / iPad — אין beforeinstallprompt, מציגים הוראות
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIos) {
    setTimeout(() => showBanner({
      text: 'התקינו את האפליקציה למסך הבית',
      sub: 'לחצו על כפתור השיתוף ⬆️ ואז "הוספה למסך הבית"',
      buttonLabel: null,
    }), 2500);
  }

  let banner = null;

  function showBanner({ text, sub, buttonLabel, onInstall }) {
    if (banner) return;
    banner = el('div', { class: 'install-banner' },
      el('div', { class: 'ico' }, '📲'),
      el('div', { class: 'grow' },
        el('div', { class: 't' }, text),
        el('div', { class: 'd' }, sub),
      ),
      buttonLabel ? el('button', { class: 'btn', onclick: onInstall }, buttonLabel) : null,
      el('button', { class: 'close', 'aria-label': 'סגירה', onclick: dismiss }, '✕'),
    );
    root.append(banner);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    hide();
  }

  function hide() {
    banner?.remove();
    banner = null;
  }
}
