/* עזרי DOM קטנים — בלי framework */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const child of children.flat(9)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

export function clear(node) {
  node.textContent = '';
  return node;
}

/* ---------- שורת הוספה מהירה (בסגנון גוגל קיפ) ----------
   התצוגה מתרנדרת מחדש בכל עדכון מהשרת, לכן שומרים כאן את הטקסט
   שהוקלד ואת מצב הפוקוס כדי שהכתיבה לא תיקטע. */

const quickAdd = new Map(); // key → { node, draft, focused }

/* בזמן רינדור מחדש הדפדפן משגר blur על השדה שנמחק (עוד לפני שהוא מנותק),
   ואסור להתייחס אליו כאילו המשתמש עזב את השדה. app.js מסמן את החלון הזה. */
let rendering = false;
export function setRendering(value) { rendering = value; }

export function quickAddRow(key, { placeholder, onAdd, multiline = true }) {
  const state = quickAdd.get(key) || { draft: '', focused: false };
  quickAdd.set(key, state);

  const input = el('input', {
    type: 'text', placeholder, value: state.draft,
    maxlength: 80, enterkeyhint: 'enter',
    autocomplete: 'off', autocorrect: 'off',
  });
  state.node = input;

  input.addEventListener('input', () => { state.draft = input.value; });
  input.addEventListener('focus', () => { state.focused = true; });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { input.value = ''; state.draft = ''; input.blur(); }
  });

  // blur שנגרם מרינדור מחדש אינו blur אמיתי — מתעלמים ממנו
  input.addEventListener('blur', () => {
    if (rendering || !input.isConnected) return;
    state.focused = false;
    commit();
  });

  if (multiline) {
    input.addEventListener('paste', (e) => {
      const text = e.clipboardData?.getData('text') || '';
      if (!text.includes('\n')) return;
      e.preventDefault();
      const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
      if (!lines.length) return;
      lines.forEach(onAdd);
      toast(`נוספו ${lines.length} פריטים`);
    });
  }

  function commit() {
    if (!input.isConnected || quickAdd.get(key)?.node !== input) return;
    const text = input.value.trim();
    input.value = '';
    state.draft = '';
    if (text) onAdd(text);
  }

  if (state.focused) queueMicrotask(() => input.isConnected && input.focus());

  return el('div', { class: 'add-row' }, el('span', { class: 'plus' }, '＋'), input);
}

/* ---------- מודאל (bottom sheet) ---------- */

export function openModal(title, body, { onClose, className = '' } = {}) {
  const root = document.getElementById('modal-root');
  const modal = el('div', { class: `modal ${className}`.trim() }, title ? el('h2', {}, title) : null, body);
  const back = el('div', { class: 'modal-back' }, modal);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  function close() {
    back.remove();
    onClose?.();
  }
  root.append(back);
  modal.querySelector('input, textarea, select')?.focus();
  return { close, modal };
}

export function confirmDialog(message, { danger = 'מחיקה' } = {}) {
  return new Promise((resolve) => {
    const actions = el('div', { class: 'actions' },
      el('button', { class: 'btn secondary', onclick: () => done(false) }, 'ביטול'),
      el('button', { class: 'btn', style: 'background:var(--danger)', onclick: () => done(true) }, danger),
    );
    const { close } = openModal(null,
      el('div', {}, el('p', { style: 'font-size:15.5px;line-height:1.5' }, message), actions),
      { onClose: () => resolve(false) },
    );
    function done(v) { resolve(v); close(); }
  });
}

/* ---------- Toast ---------- */

export function toast(message) {
  const root = document.getElementById('toast-root');
  const t = el('div', { class: 'toast' }, message);
  root.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2200);
  setTimeout(() => t.remove(), 2600);
}

/* ---------- Empty state ---------- */

export function emptyState(icon, message, cta) {
  return el('div', { class: 'empty' },
    el('div', { class: 'big' }, icon),
    el('div', { class: 'msg' }, message),
    cta || null,
  );
}

export function famChip(family, { warn = false } = {}) {
  if (!family) return el('span', { class: 'chip warn' }, '⚠️ ', el('span', {}, 'לא שובץ'));
  return el('span', { class: `chip${warn ? ' warn' : ''}` },
    el('span', { class: 'dot', style: `background:${family.color}` }),
    el('span', {}, family.name),
  );
}
