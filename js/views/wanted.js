import { state, T, L } from '../state.js';
import { $, $$, esc, I, chip, ago, hoodName, toast, busy, openSheet, closeSheet, sheetHead, confirmSheet } from '../ui.js';
import { wantedList, saveWanted, deleteWanted, openThread, lists } from '../api.js';
import { CATS, WHO, AGES, CAT_EMOJI } from '../lists.js';
import { translate } from '../translate.js';
import { detectLang, clamp } from '../text.js';
import { go } from '../nav.js';
import { requireLogin } from './auth.js';
import { openReport } from './detail.js';

let items = [];

export async function render(el) {
  const t = T().wantedT;
  $('#filters').classList.add('hidden');
  el.innerHTML = `<div class="page narrow"><div class="card wanted">
    <div class="cardhead"><h2>${t.title}</h2><span class="hint">${t.hint}</span></div>
    <div class="list" id="wlist"><div class="sk line"></div><div class="sk line"></div><div class="sk line"></div></div>
    <button class="btn block" style="margin-top:14px" id="addw">${I.post} ${t.add}</button></div></div>`;
  $('#addw').onclick = () => openForm(el);
  try { items = await wantedList(); } catch (e) { console.error(e); items = []; }
  draw(el);
}

function draw(el) {
  const t = T(), w = t.wantedT;
  const mineIdx = state.user ? items.findIndex((x) => x.id === state.user.uid) : -1;
  if (mineIdx > 0) items.unshift(items.splice(mineIdx, 1)[0]);
  $('#addw').innerHTML = `${I.post} ${mineIdx >= 0 ? w.edit : w.add}`;
  const box = $('#wlist');
  if (!items.length) { box.innerHTML = `<div class="empty">${w.empty}</div>`; return; }
  box.innerHTML = items.map((x) => {
    const mine = state.user && x.id === state.user.uid;
    const text = x.translated ? L(x.text) : (x.text[x.lang] || L(x.text));
    return `<div class="row ${mine ? 'mine' : ''}">
      <div class="want-ico">${CAT_EMOJI[x.cat] || I.wanted}</div>
      <div class="main"><div class="t1" dir="auto">${esc(text)}</div>
        <div class="t2">${[x.who !== 'na' && t.who[x.who], x.age !== 'na' && t.age[x.age], hoodName(x.hood), x.ownerName].filter(Boolean).map(esc).join(' · ')} · ${ago(x.postedAt)}</div></div>
      ${mine ? `<span class="tag">${w.mine}</span>` : `<button class="btn sm secondary" data-match="${esc(x.id)}">${w.match}</button><button class="iconbtn sm" data-rep="${esc(x.id)}" aria-label="${t.report.btn}">${I.flag}</button>`}
    </div>`;
  }).join('');
  $$('[data-match]', box).forEach((b) => (b.onclick = async () => {
    if (!(await requireLogin())) return;
    const x = items.find((i) => i.id === b.dataset.match);
    busy(b, true);
    try {
      const id = await openThread({ kind: 'wanted', refId: 'w_' + x.id, owner: x.id, title: x.text, me: state.user });
      go('thread/' + id);
    } catch (e) { console.error(e); toast(T().post.err); busy(b, false); }
  }));
  $$('[data-rep]', box).forEach((b) => (b.onclick = () => openReport('wanted', b.dataset.rep)));
}

async function openForm(el) {
  if (!(await requireLogin())) return;
  const t = T(), w = t.wantedT;
  const cur = items.find((x) => x.id === state.user.uid);
  const f = cur ? { text: cur.text[cur.lang] || L(cur.text), cat: cur.cat, who: cur.who, age: cur.age, hood: cur.hood }
    : { text: '', cat: 'clothes', who: 'girls', age: 'a6', hood: (state.profile && state.profile.hood) || lists().hoods[0].id };
  const sh = openSheet(`${sheetHead(w.formTitle, w.onePer)}<div class="body" style="padding-top:12px">
    <div class="field"><label for="w-text">${w.textLbl}</label><input type="text" id="w-text" maxlength="160" placeholder="${esc(w.textPh)}" value="${esc(f.text)}" dir="auto"></div>
    <div class="field"><label>${t.labels.category}</label><div class="segs">${CATS.map((k) => chip(`${CAT_EMOJI[k]} ${t.cat[k]}`, f.cat === k, `data-cat="${k}"`)).join('')}</div></div>
    <div class="grid2">
      <div class="field"><label>${t.labels.who}</label><select id="w-who">${WHO.map((k) => `<option value="${k}" ${f.who === k ? 'selected' : ''}>${t.who[k]}</option>`).join('')}</select></div>
      <div class="field"><label>${t.labels.age}</label><select id="w-age">${AGES.map((k) => `<option value="${k}" ${f.age === k ? 'selected' : ''}>${t.age[k]}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>${t.labels.hood}</label><select id="w-hood">${lists().hoods.filter((h) => !h.hidden).map((h) => `<option value="${esc(h.id)}" ${f.hood === h.id ? 'selected' : ''}>${esc(h[state.lang])}</option>`).join('')}</select></div>
    <div class="actions">${cur ? `<button class="btn danger" data-del>${w.remove}</button>` : ''}<button class="btn" data-pub>${I.check} ${w.publish}</button></div>
  </div>`);
  $$('[data-cat]', sh).forEach((b) => (b.onclick = () => { f.cat = b.dataset.cat; $$('[data-cat]', sh).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  const del = $('[data-del]', sh);
  if (del) del.onclick = async () => {
    if (!(await confirmSheet(w.remove + '?', w.remove))) return;
    await deleteWanted(state.user.uid);
    toast(w.removed);
    render(el);
  };
  $('[data-pub]', sh).onclick = async (e) => {
    const text = clamp($('#w-text', sh).value, 160);
    if (!text) { $('#w-text', sh).focus(); return; }
    if (state.blocked) { toast(T().post.blocked); return; }
    busy(e.currentTarget, true, T().post.translating);
    const lang = detectLang(text), other = lang === 'he' ? 'en' : 'he';
    let tr = '';
    try { tr = clamp(await translate(text, lang, other), 190); } catch (err) { tr = ''; }
    try {
      await saveWanted(state.user.uid, {
        ownerName: state.user.name, lang, translated: !!tr, text: { [lang]: text, [other]: tr },
        cat: f.cat, who: $('#w-who', sh).value, age: $('#w-age', sh).value, hood: $('#w-hood', sh).value,
      });
      closeSheet();
      toast(w.posted);
      render(el);
    } catch (err) { console.error(err); toast(T().post.err); busy(e.currentTarget, false); }
  };
}
