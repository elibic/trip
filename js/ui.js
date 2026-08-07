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

/* ---------- מודאל (bottom sheet) ---------- */

export function openModal(title, body, { onClose } = {}) {
  const root = document.getElementById('modal-root');
  const modal = el('div', { class: 'modal' }, title ? el('h2', {}, title) : null, body);
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
