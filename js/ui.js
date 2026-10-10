import { state, T } from './state.js';
import { lists } from './api.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const I = {
  feed: svg('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'),
  wanted: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  post: svg('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.4"'),
  inbox: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>'),
  mine: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  filter: svg('<path d="M4 6h16M7 12h10M10 18h4"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>', 'stroke-width="1.6"'),
  tag: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3" fill="currentColor"/>'),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  check: svg('<path d="m5 12 5 5L20 7"/>', 'stroke-width="2.4"'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  share: svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>'),
  flag: svg('<path d="M5 21V4h11l-1.5 4L16 12H5"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  send: svg('<path d="M4 12 20 4l-6 16-3-7z"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.2 14.8l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4zm-3 4.5c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.5 0 1.7-.7 2-1.4.2-.7.2-1.3.1-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5.3-.5v-.6l-.9-2.2c-.2-.6-.5-.5-.7-.5z"/></svg>',
};

export const chip = (label, on, attrs = '') => `<button type="button" class="chip" aria-pressed="${!!on}" ${attrs}>${label}</button>`;

export const nis = (n) => (n === 0 ? `<span class="free">${T().free}</span>` : `<span class="num">₪${n}</span>`);
export function ago(ts) {
  const t = T().time, d = Date.now() - ts, m = Math.round(d / 60e3), h = Math.round(d / 36e5), day = Math.round(d / 864e5);
  if (m < 2) return t.now;
  if (m < 60) return `${m} ${t.m}`;
  if (h < 24) return `${h} ${t.h}`;
  if (day === 1) return t.d1;
  return `${day} ${t.d}`;
}
export const dateStr = (ts) => new Date(ts).toLocaleDateString(T().locale, { day: 'numeric', month: 'short' });
export const daysLeft = (ts) => Math.max(0, Math.ceil((ts - Date.now()) / 864e5));

export const hoodName = (id) => { const h = lists().hoods.find((x) => x.id === id); return h ? h[state.lang] : id || ''; };
export const sourceName = (id, other) => {
  if (id === 'other' && other) return other;
  const s = lists().sources.find((x) => x.id === id);
  return s ? s[state.lang] : other || id || '';
};

// Deterministic soft colour per category for placeholders and avatars.
const HUE = { clothes: '#f2c4c4', shoes: '#c9d8ea', toys: '#f5deb0', electronics: '#d7d2ea', home: '#e8d5c4', other: '#d9e3c9' };
export const hueFor = (cat) => HUE[cat] || '#e8d5c4';
export const initial = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();

// ----------------------------------------------------------------- toast
export function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('on'), ms);
}

// ----------------------------------------------------------------- sheet
let onClose = null;
export function openSheet(html, { close } = {}) {
  const sh = $('#sheet');
  sh.innerHTML = html;
  sh.classList.add('on');
  $('#backdrop').classList.add('on');
  document.body.classList.add('noscroll');
  onClose = close || null;
  $$('[data-close]', sh).forEach((b) => (b.onclick = closeSheet));
  const first = $('input, textarea, button', sh);
  if (first && matchMedia('(pointer: fine)').matches) setTimeout(() => first.focus(), 30);
  return sh;
}
export function closeSheet() {
  const sh = $('#sheet');
  if (!sh.classList.contains('on')) return;
  sh.classList.remove('on');
  $('#backdrop').classList.remove('on');
  document.body.classList.remove('noscroll');
  const f = onClose; onClose = null;
  if (f) f();
}
export const sheetOpen = () => $('#sheet').classList.contains('on');

export function sheetHead(title, sub = '') {
  return `<div class="grab"></div><div class="sheethead"><div style="min-width:0;flex:1"><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="iconbtn" data-close aria-label="close">${I.x}</button></div>`;
}

export function confirmSheet(msg, okLabel, danger = true) {
  return new Promise((res) => {
    let answered = false;
    const sh = openSheet(`${sheetHead(msg)}<div class="body"><div class="actions">
      <button class="btn secondary" data-no>${state.lang === 'he' ? 'ביטול' : 'Cancel'}</button>
      <button class="btn ${danger ? 'danger' : ''}" data-yes>${okLabel}</button></div></div>`, { close: () => { if (!answered) res(false); } });
    $('[data-no]', sh).onclick = () => { closeSheet(); };
    $('[data-yes]', sh).onclick = () => { answered = true; closeSheet(); res(true); };
  });
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = label || '...'; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}
