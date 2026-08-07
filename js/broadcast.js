/* הודעה שנשלחת לכל המכשירים ומופיעה מיידית — בלי רענון ובלי לחכות לכלום.
   מבוסס על החיבור החי של Firebase שכבר פתוח בכל מכשיר. */
import { el, openModal } from './ui.js';
import { subscribeBroadcast } from './store.js';
import { hardRefresh } from './update.js';

const SEEN_KEY = 'trip.broadcastSeen';

let showing = false;

export function initBroadcast() {
  subscribeBroadcast((msg) => {
    if (!msg || !msg.id || !msg.title) return;
    if (msg.expiresAt && Date.now() > msg.expiresAt) return;
    if (wasSeen(msg.id)) return;
    if (showing) return;
    show(msg);
  });
}

function wasSeen(id) {
  try {
    return localStorage.getItem(SEEN_KEY) === String(id);
  } catch {
    return false;
  }
}

function markSeen(id) {
  try {
    localStorage.setItem(SEEN_KEY, String(id));
  } catch { /* בלי localStorage ההודעה פשוט תופיע שוב */ }
}

function show(msg) {
  showing = true;

  const wantsRefresh = msg.action === 'refresh';
  const refreshBtn = wantsRefresh
    ? el('button', { class: 'btn block', onclick: doRefresh }, '🔄 רענון ועדכון עכשיו')
    : null;

  const { close } = openModal(null, el('div', { class: 'update-sheet' },
    el('div', { class: 'ico' }, msg.icon || '📣'),
    el('h2', {}, msg.title),
    msg.body ? el('p', { class: 'bc-body' }, msg.body) : null,
    refreshBtn,
    wantsRefresh
      ? el('p', { class: 'note' }, 'הרענון מנקה את המטמון וטוען את הגרסה העדכנית. הנתונים שלכם בענן ולא ייפגעו.')
      : null,
    el('button', { class: `btn ${wantsRefresh ? 'ghost' : ''} block`, onclick: dismiss },
      wantsRefresh ? 'אחר כך' : 'הבנתי'),
  ), { className: 'update-modal', onClose: () => { showing = false; } });

  async function doRefresh() {
    markSeen(msg.id);
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'מרעננים…';
    await hardRefresh();
  }

  function dismiss() {
    markSeen(msg.id);
    close();
  }
}
