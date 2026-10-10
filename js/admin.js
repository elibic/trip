// Admin page. Hebrew only: it is for the people running the board.
import { configured, EMU } from './fb.js';
import { state } from './state.js';
import { $, $$, esc, I, toast, busy, confirmSheet, openSheet, closeSheet, sheetHead, ago, dateStr, nis } from './ui.js';
import { STR } from './i18n.js';

state.lang = 'he';
const H = STR.he;
const app = $('#app');
if (EMU) { $('#back').href = 'index.html?emu=1'; $('.logo').href = 'index.html?emu=1'; }
$('#backdrop').onclick = closeSheet;

const TABS = [['home', 'סקירה'], ['reports', 'דיווחים'], ['listings', 'מודעות'], ['users', 'משתמשים'], ['wanted', 'מחפשים'], ['lists', 'שכונות ומקורות'], ['admins', 'מנהלים']];
let tab = (location.hash.slice(1) || 'home');
let api;

function shell(inner) {
  app.innerHTML = `<div class="atabs">${TABS.map(([k, l]) => `<a class="chip" href="#${k}" aria-pressed="${tab === k}">${l}</a>`).join('')}</div>${inner}`;
}
const card = (title, body, hint = '') => `<div class="card" style="margin-bottom:14px"><div class="cardhead"><h2>${title}</h2>${hint ? `<span class="hint">${hint}</span>` : ''}</div>${body}</div>`;
const statusTag = (s) => `<span class="tag ${{ active: 'good', reserved: 'warn', hidden: 'bad' }[s] || 'grey'}">${H.status[s]}</span>`;
const appLink = (hash) => `index.html${EMU ? '?emu=1' : ''}#${hash}`;

async function render() {
  tab = location.hash.slice(1) || 'home';
  shell(`<div class="card"><div class="sk line"></div><div class="sk line"></div><div class="sk line"></div></div>`);
  try { await (VIEWS[tab] || VIEWS.home)(); }
  catch (e) { console.error(e); shell(card('שגיאה', `<div class="note warn">${esc(e.message)}</div>`)); }
}

const VIEWS = {
  async home() {
    const c = await api.admin.counts();
    const k = (l, v) => `<div class="kpi"><span>${l}</span><b class="num">${v ?? '-'}</b></div>`;
    shell(card('מספרים', `<div class="kpis">${k('מודעות פעילות', c.live)}${k('פורסמו השבוע', c.week)}${k('נמכרו', c.sold)}${k('משתמשים', c.users)}${k('פוסטים במחפשים', c.wanted)}${k('דיווחים פתוחים', c.reports)}</div>`)
      + card('תחזוקה', `<p class="note" style="margin-top:0">מעביר לארכיון מודעות שעבר תוקפן, מוחק לצמיתות מודעות שבארכיון יותר מ-90 יום (כולל התמונות), ומוחק פוסטים במחפשים שפג תוקפם. כך האחסון נשאר בתוך המכסה החינמית. מומלץ פעם בשבוע.</p>
        <button class="btn" id="maint">הרצת תחזוקה</button>`));
    $('#maint').onclick = async (e) => {
      busy(e.currentTarget, true, 'רץ...');
      try { const r = await api.admin.maintenance(); toast(`לארכיון: ${r.archived} · נמחקו: ${r.purged} · מחפשים: ${r.wanted}`, 5000); }
      catch (err) { toast(err.message); }
      busy(e.currentTarget, false);
    };
  },

  async reports() {
    const rs = await api.admin.reports();
    const list = await Promise.all(rs.map(async (r) => ({ r, l: r.type === 'listing' ? await api.getListing(r.targetId).catch(() => null) : null })));
    shell(card('דיווחים פתוחים', list.length ? list.map(({ r, l }) => `<div class="arow" data-r="${esc(r.id)}">
        ${l && l.thumb ? `<img src="${esc(l.thumb)}" alt="">` : ''}
        <div class="main"><div class="t1">${H.report.reason[r.reason]}${r.note ? ` · ${esc(r.note)}` : ''}</div>
          <div class="t2">${r.type === 'listing' ? (l ? `${esc(l.title.he || l.title.en)} · ${esc(l.ownerName)} · ${H.status[l.status]}` : 'המודעה נמחקה') : r.type === 'wanted' ? 'פוסט במחפשים' : 'משתמש'} · ${ago(r.at)}</div></div>
        <div class="acts">
          ${l ? `<a class="btn sm secondary" href="${appLink('item/' + encodeURIComponent(l.id))}" target="_blank">צפייה</a>` : ''}
          ${l && l.status !== 'hidden' ? `<button class="btn sm danger" data-hide="${esc(l.id)}">הסתרה</button>` : ''}
          ${r.type === 'wanted' ? `<button class="btn sm danger" data-delw="${esc(r.targetId)}">מחיקת הפוסט</button>` : ''}
          ${l ? `<button class="btn sm secondary" data-block="${esc(l.ownerUid)}">חסימת המפרסם</button>` : ''}
          <button class="btn sm" data-done="${esc(r.id)}">${I.check} טופל</button>
        </div></div>`).join('') : '<div class="empty">אין דיווחים פתוחים</div>'));
    $$('[data-hide]').forEach((b) => (b.onclick = async () => { await api.admin.setStatus(b.dataset.hide, 'hidden'); toast('הוסתר'); render(); }));
    $$('[data-delw]').forEach((b) => (b.onclick = async () => { if (await confirmSheet('למחוק את הפוסט?', 'מחיקה')) { await api.admin.deleteWanted(b.dataset.delw).catch(() => {}); toast('נמחק'); } }));
    $$('[data-block]').forEach((b) => (b.onclick = async () => { if (await confirmSheet('לחסום את המפרסם מפרסום ומהודעות?', 'חסימה')) { await api.admin.block(b.dataset.block, 'report'); toast('נחסם'); } }));
    $$('[data-done]').forEach((b) => (b.onclick = async () => { await api.admin.closeReport(b.dataset.done); render(); }));
  },

  async listings() {
    const all = await api.admin.listings();
    let q = '', st = '';
    shell(card('כל המודעות', `<div class="tools"><input type="search" id="lq" placeholder="חיפוש בכותרת או במפרסם" dir="auto">
      <select id="lst"><option value="">כל הסטטוסים</option>${['active', 'reserved', 'sold', 'archived', 'hidden'].map((s) => `<option value="${s}">${H.status[s]}</option>`).join('')}</select></div>
      <div id="lrows"></div>`, `${all.length} אחרונות`));
    const draw = () => {
      const now = Date.now();
      const rows = all.filter((l) => (!st || l.status === st) && (!q || `${l.title.he} ${l.title.en} ${l.ownerName}`.toLowerCase().includes(q)));
      $('#lrows').innerHTML = rows.map((l) => {
        const promo = l.promoUntil > now;
        return `<div class="arow"><img src="${esc(l.thumb)}" alt="">
          <div class="main"><div class="t1" dir="auto">${esc(l.title.he || l.title.en)}</div>
            <div class="t2">${nis(l.price)} · ${esc(l.ownerName)} · ${ago(l.postedAt)} · ${l.views || 0} צפיות${promo ? ` · מקודם עד ${dateStr(l.promoUntil)}` : ''}</div></div>
          ${statusTag(l.status)}
          <div class="acts">
            <a class="btn sm secondary" href="${appLink('item/' + encodeURIComponent(l.id))}" target="_blank">צפייה</a>
            ${l.status === 'hidden' ? `<button class="btn sm secondary" data-a="restore" data-id="${esc(l.id)}">החזרה</button>` : `<button class="btn sm secondary" data-a="hide" data-id="${esc(l.id)}">הסתרה</button>`}
            ${promo ? `<button class="btn sm secondary" data-a="unpromo" data-id="${esc(l.id)}">ביטול קידום</button>` : (l.live ? `<button class="btn sm" data-a="promo" data-id="${esc(l.id)}">קידום</button>` : '')}
            <button class="btn sm danger" data-a="del" data-id="${esc(l.id)}">מחיקה</button>
            <button class="btn sm secondary" data-a="block" data-id="${esc(l.id)}">חסימת מפרסם</button>
          </div></div>`;
      }).join('') || '<div class="empty">אין מודעות</div>';
      $$('#lrows [data-a]').forEach((b) => (b.onclick = () => act(b.dataset.a, all.find((x) => x.id === b.dataset.id), draw)));
    };
    $('#lq').oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
    $('#lst').onchange = (e) => { st = e.target.value; draw(); };
    draw();
  },

  async users() {
    const [users, blocked] = await Promise.all([api.admin.users(), api.admin.blocked()]);
    shell(card('משתמשים', `<div class="tools"><input type="search" id="uq" placeholder="חיפוש בשם או במייל" dir="auto"></div><div id="urows"></div>`, `${users.length}`));
    const draw = (q = '') => {
      $('#urows').innerHTML = users.filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q)).map((u) => `<div class="arow">
        <div class="avatar">${esc((u.name || '?')[0])}</div>
        <div class="main"><div class="t1" dir="auto">${esc(u.name)}</div><div class="t2" dir="ltr" style="text-align:start">${esc(u.email || '')} · ${u.createdAt ? dateStr(u.createdAt) : ''}</div></div>
        ${blocked.has(u.id) ? '<span class="tag bad">חסום</span>' : ''}
        <div class="acts">${blocked.has(u.id) ? `<button class="btn sm secondary" data-unblock="${esc(u.id)}">ביטול חסימה</button>` : `<button class="btn sm danger" data-block="${esc(u.id)}">חסימה</button>`}</div>
      </div>`).join('') || '<div class="empty">אין משתמשים</div>';
      $$('[data-block]').forEach((b) => (b.onclick = async () => { if (await confirmSheet('לחסום מפרסום, מ"מחפשים" ומהודעות?', 'חסימה')) { await api.admin.block(b.dataset.block); blocked.add(b.dataset.block); draw(q); } }));
      $$('[data-unblock]').forEach((b) => (b.onclick = async () => { await api.admin.unblock(b.dataset.unblock); blocked.delete(b.dataset.unblock); draw(q); }));
    };
    $('#uq').oninput = (e) => draw(e.target.value.trim().toLowerCase());
    draw();
  },

  async wanted() {
    const ws = await api.wantedList();
    shell(card('מחפשים', ws.map((w) => `<div class="arow"><div class="main"><div class="t1" dir="auto">${esc(w.text.he || w.text.en)}</div>
      <div class="t2">${esc(w.ownerName)} · ${ago(w.postedAt)}</div></div>
      <div class="acts"><button class="btn sm danger" data-del="${esc(w.id)}">מחיקה</button></div></div>`).join('') || '<div class="empty">אין פוסטים</div>'));
    $$('[data-del]').forEach((b) => (b.onclick = async () => { if (await confirmSheet('למחוק את הפוסט?', 'מחיקה')) { await api.admin.deleteWanted(b.dataset.del); render(); } }));
  },

  async lists() {
    const cur = api.lists();
    const data = { hoods: cur.hoods.map((x) => ({ ...x })), sources: cur.sources.map((x) => ({ ...x })) };
    const editor = (key, title, hint) => card(title, `<div id="ed-${key}"></div><button class="btn sm secondary" style="margin-top:10px" data-add="${key}">${I.post} הוספה</button>`, hint);
    shell(editor('hoods', 'שכונות', 'שם בעברית, שם באנגלית')
      + editor('sources', 'מקורות קנייה', '"אחר" נשאר תמיד אחרון')
      + `<div class="note">הסתרה מורידה פריט מהטפסים ומהסינון, אבל מודעות קיימות ממשיכות להציג אותו. זו הסיבה שאין מחיקה של פריט שכבר בשימוש.</div>
         <div class="actions"><button class="btn" id="savelists">${I.check} שמירת הרשימות</button></div>`);
    const draw = (key) => {
      const box = $(`#ed-${key}`);
      box.innerHTML = data[key].map((x, i) => `<div class="ledit ${x.hidden ? 'off' : ''}" data-i="${i}">
        <input data-k="he" value="${esc(x.he)}" dir="rtl"><input data-k="en" value="${esc(x.en)}" dir="ltr">
        <div class="acts">
          <button class="iconbtn sm" data-up title="למעלה">↑</button>
          <button class="iconbtn sm" data-hide title="${x.hidden ? 'הצגה' : 'הסתרה'}">${x.hidden ? '👁' : '✕'}</button>
        </div></div>`).join('');
      $$('.ledit', box).forEach((row) => {
        const i = +row.dataset.i;
        $$('input', row).forEach((inp) => (inp.oninput = () => { data[key][i][inp.dataset.k] = inp.value; }));
        $('[data-up]', row).onclick = () => { if (i > 0) { const [x] = data[key].splice(i, 1); data[key].splice(i - 1, 0, x); draw(key); } };
        $('[data-hide]', row).onclick = () => { data[key][i].hidden = !data[key][i].hidden; draw(key); };
      });
    };
    draw('hoods'); draw('sources');
    $$('[data-add]').forEach((b) => (b.onclick = () => {
      const key = b.dataset.add;
      const item = { id: `${key === 'hoods' ? 'h' : 's'}-${Date.now().toString(36)}`, he: '', en: '' };
      const other = data[key].findIndex((x) => x.id === 'other');
      if (other >= 0) data[key].splice(other, 0, item); else data[key].push(item);
      draw(key);
      $(`#ed-${key} .ledit:nth-child(${(other >= 0 ? other : data[key].length - 1) + 1}) input`).focus();
    }));
    $('#savelists').onclick = async (e) => {
      const clean = (arr) => arr.filter((x) => x.he.trim() || x.en.trim()).map((x) => ({ id: x.id, he: x.he.trim() || x.en.trim(), en: x.en.trim() || x.he.trim(), ...(x.hidden ? { hidden: true } : {}) }));
      const out = { hoods: clean(data.hoods), sources: clean(data.sources) };
      const oi = out.sources.findIndex((x) => x.id === 'other');
      if (oi >= 0 && oi !== out.sources.length - 1) out.sources.push(out.sources.splice(oi, 1)[0]);
      if (!out.hoods.filter((x) => !x.hidden).length) { toast('צריכה להישאר לפחות שכונה אחת'); return; }
      busy(e.currentTarget, true);
      try { await api.saveLists(out); toast('נשמר. האפליקציה מתעדכנת אצל כולם.'); }
      catch (err) { toast(err.message); }
      busy(e.currentTarget, false);
    };
  },

  async admins() {
    let emails = await api.admin.admins();
    shell(card('מנהלים', `<div id="arows"></div>
      <div class="tools" style="margin-top:12px"><input type="email" id="newmail" placeholder="כתובת מייל של מנהל חדש" dir="ltr"><button class="btn sm" id="addadmin">${I.post} הוספה</button></div>
      <div class="note">מנהל נכנס עם אותה כתובת מייל, בגוגל או בקישור למייל. מנהלים יכולים להסתיר, לקדם ולמחוק מודעות, לחסום משתמשים, לערוך שכונות ומקורות, ולהוסיף מנהלים.</div>`));
    const draw = () => {
      $('#arows').innerHTML = emails.map((m) => `<div class="arow"><div class="main"><div class="t1" dir="ltr" style="text-align:start">${esc(m)}</div></div>
        ${m === state.user.email ? '<span class="tag">את/ה</span>' : `<button class="btn sm danger" data-rm="${esc(m)}">הסרה</button>`}</div>`).join('');
      $$('[data-rm]').forEach((b) => (b.onclick = async () => {
        if (!(await confirmSheet(`להסיר את ${b.dataset.rm}?`, 'הסרה'))) return;
        emails = emails.filter((x) => x !== b.dataset.rm); await api.admin.saveAdmins(emails); draw();
      }));
    };
    $('#addadmin').onclick = async () => {
      const m = $('#newmail').value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(m) || emails.includes(m)) return;
      emails = [...emails, m]; await api.admin.saveAdmins(emails); $('#newmail').value = ''; draw();
    };
    draw();
  },
};

async function act(a, l, redraw) {
  try {
    if (a === 'hide') { await api.admin.setStatus(l.id, 'hidden'); Object.assign(l, { status: 'hidden', live: false }); }
    else if (a === 'restore') { await api.admin.setStatus(l.id, 'active'); Object.assign(l, { status: 'active', live: true }); }
    else if (a === 'promo') {
      const days = await new Promise((res) => {
        const sh = openSheet(`${sheetHead('קידום לראש הפיד', 'כמה זמן?')}<div class="body"><div class="segs">${[3, 7, 14, 30].map((d) => `<button class="chip" data-d="${d}">${d} ימים</button>`).join('')}</div></div>`, { close: () => res(0) });
        $$('[data-d]', sh).forEach((b) => (b.onclick = () => { const d = +b.dataset.d; res(d); closeSheet(); }));
      });
      if (!days) return;
      await api.admin.promote(l.id, days); l.promoUntil = Date.now() + days * 864e5;
    }
    else if (a === 'unpromo') { await api.admin.promote(l.id, 0); l.promoUntil = 0; }
    else if (a === 'del') { if (!(await confirmSheet('למחוק לצמיתות, כולל התמונות?', 'מחיקה'))) return; await api.admin.deleteListing(l.id); l.status = 'deleted'; }
    else if (a === 'block') { if (!(await confirmSheet(`לחסום את ${l.ownerName}?`, 'חסימה'))) return; await api.admin.block(l.ownerUid); toast('נחסם'); return; }
    toast('בוצע');
    redraw();
  } catch (e) { console.error(e); toast(e.message); }
}

async function boot() {
  if (!configured) { app.innerHTML = card(H.setup.title, `<p>${H.setup.body}</p>`); return; }
  api = await import('./api.js');
  const { openAuth } = await import('./views/auth.js');
  await new Promise((res) => { api.watchLists(() => res()); setTimeout(res, 2500); });
  if (api.isEmailLink()) {
    let email = null; try { email = localStorage.getItem('nus-email'); } catch (e) {}
    try { await api.finishEmailLink(email || prompt(H.auth.confirmEmail) || ''); } catch (e) { toast(e.code || e.message); }
  }
  api.onAuth(async (u) => {
    if (!u) {
      state.user = null;
      app.innerHTML = card('כניסת מנהלים', `<p class="note" style="margin-top:0">הדף פתוח רק למנהלים. היכנסו עם כתובת המייל שמופיעה ברשימת המנהלים.</p><button class="btn" id="login">התחברות</button>`);
      $('#login').onclick = openAuth;
      return;
    }
    closeSheet();
    state.user = { uid: u.uid, email: (u.email || '').toLowerCase(), name: u.displayName || '' };
    $('#who').textContent = u.email || '';
    if (!(await api.checkAdmin())) {
      app.innerHTML = card('אין הרשאה', `<p class="note" style="margin-top:0">${esc(u.email)} לא ברשימת המנהלים. את הרשימה עורכים במסוף של Firebase, במסמך config/admins (ראו README), או מנהל קיים מוסיף מכאן.</p><button class="btn secondary" id="out">יציאה</button>`);
      $('#out').onclick = () => api.signOut();
      return;
    }
    render();
  });
  addEventListener('hashchange', render);
}
boot();
