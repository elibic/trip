import { state, T, L } from '../state.js';
import { $, $$, esc, I, ago, initial, toast } from '../ui.js';
import { watchThread, watchMessages, sendMessage, markRead } from '../api.js';
import { go, own } from '../nav.js';
import { requireLogin } from './auth.js';

export async function render(el) {
  const t = T();
  $('#filters').classList.add('hidden');
  if (!state.user) {
    el.innerHTML = `<div class="page narrow"><div class="card"><div class="empty"><div class="big">💬</div>${t.inbox.empty}</div>
      <button class="btn block" data-login>${t.post.login}</button></div></div>`;
    $('[data-login]', el).onclick = () => requireLogin().then((ok) => ok && render(el));
    return;
  }
  draw(el);
}

// Called by app.js whenever the threads listener fires.
export function draw(el) {
  const t = T(), me = state.user.uid;
  const th = state.threads;
  el.innerHTML = `<div class="page narrow"><div class="card">
    <div class="cardhead"><h2>${t.inbox.title}</h2></div>
    ${th.length ? `<div class="list">${th.map((x) => {
      const other = x.participants.find((p) => p !== me);
      const name = (x.names && x.names[other]) || '?';
      const unread = (x.unread && x.unread[me]) || 0;
      return `<a class="row" href="#thread/${encodeURIComponent(x.id)}">
        <div class="avatar" style="--av-c:${unread ? 'var(--accent)' : 'var(--muted)'}">${esc(initial(name))}</div>
        <div class="main"><div class="t1" style="${unread ? 'font-weight:650' : ''}" dir="auto">${esc(name)} · ${esc(L(x.title))}</div>
          <div class="t2" dir="auto">${x.lastBy === me ? t.inbox.you + ': ' : ''}${esc(x.last)}</div></div>
        <div class="val">${ago(x.lastAt)}${unread ? ` <span class="tag">${unread}</span>` : ''}</div></a>`;
    }).join('')}</div>` : `<div class="empty"><div class="big">💬</div>${t.inbox.empty}</div>`}
  </div></div>`;
}

export async function renderThread(el, id) {
  const t = T();
  $('#filters').classList.add('hidden');
  if (!state.user) { if (!(await requireLogin())) { go('inbox'); return; } }
  const me = state.user.uid;
  el.innerHTML = `<div class="page narrow chat">
    <div class="card chathead"><a class="iconbtn" href="#inbox" aria-label="back">${I.back}</a>
      <div class="main"><div class="t1" id="cname" dir="auto"></div><a class="t2" id="ctitle" dir="auto"></a></div></div>
    <div class="msgs" id="msgs"><div class="sk line"></div></div>
    <form class="composer" id="composer"><textarea id="mtext" rows="1" maxlength="1000" placeholder="${esc(t.inbox.placeholder)}" dir="auto"></textarea>
      <button class="btn" type="submit" aria-label="${t.inbox.send}">${I.send}</button></form>
  </div>`;
  let thread = null;
  own(watchThread(id, (x) => {
    if (!x) { $('#msgs').innerHTML = `<div class="empty">${state.lang === 'he' ? 'השיחה לא נמצאה' : 'Conversation not found'}</div>`; return; }
    thread = x;
    const other = x.participants.find((p) => p !== me);
    $('#cname').textContent = (x.names && x.names[other]) || (x.owner === me ? '' : '');
    const title = $('#ctitle');
    title.textContent = `${t.inbox.about} ${L(x.title)}`;
    title.href = x.kind === 'listing' ? `#item/${encodeURIComponent(x.refId)}` : '#wanted';
    if (x.unread && x.unread[me]) markRead(id, me);
  }));
  own(watchMessages(id, (msgs) => {
    const box = $('#msgs');
    if (!box) return;
    box.innerHTML = msgs.length ? msgs.map((m) => `<div class="msg ${m.from === me ? 'me' : ''}"><div class="bubble" dir="auto">${esc(m.text)}</div><div class="when">${ago(m.at)}</div></div>`).join('')
      : `<div class="empty">${state.lang === 'he' ? 'כתבו הודעה ראשונה' : 'Write the first message'}</div>`;
    box.scrollTop = box.scrollHeight;
    window.scrollTo({ top: document.body.scrollHeight });
  }));
  const ta = $('#mtext');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) { e.preventDefault(); $('#composer').requestSubmit(); } });
  $('#composer').onsubmit = async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text || !thread) return;
    if (state.blocked) { toast(T().post.blocked); return; }
    ta.value = ''; ta.style.height = 'auto';
    try { await sendMessage(thread, state.user, text.slice(0, 1000)); }
    catch (err) { console.error(err); ta.value = text; toast(T().post.err); }
  };
}
