import { state, T, L } from '../state.js';
import { $, $$, esc, I, chip, toast, busy, openSheet, closeSheet, sheetHead, sourceName } from '../ui.js';
import { lists, buildListing, saveListing, getListing, getPhotos, getContact, wantedList } from '../api.js';
import { CATS, WHO, AGES, CONDS, PROBLEMS, CAT_EMOJI } from '../lists.js';
import { compress, thumbFrom, fitBudget } from '../photos.js';
import { translateAll } from '../translate.js';
import { detectLang, clamp } from '../text.js';
import { go } from '../nav.js';
import { requireLogin } from './auth.js';

const blank = () => ({
  photos: [], photosChanged: true, title: '', cat: 'clothes', who: 'girls', age: 'a0', cond: 'tag', source: null, sourceOther: '',
  size: '', problem: 'big', problemText: '', desc: '', price: '', origPrice: '', link: '', hood: null,
  contact: { msg: true, phone: false, mail: false }, phone: (() => { try { return localStorage.getItem('nus-phone') || ''; } catch (e) { return ''; } })(), email: '',
});
let draft = blank();
let editing = null; // the listing being edited

export async function render(el, editId) {
  const t = T(), p = t.post;
  $('#filters').classList.add('hidden');
  if (editId && (!editing || editing.id !== editId)) {
    el.innerHTML = `<div class="page narrow"><div class="card"><div class="sk big"></div><div class="sk block"></div></div></div>`;
    const l = await getListing(editId);
    if (!l || !state.user || l.ownerUid !== state.user.uid) { go('mine'); return; }
    const [photos, c] = await Promise.all([getPhotos(editId), getContact(editId).catch(() => null)]);
    editing = l;
    draft = {
      photos: photos.length ? photos : [l.thumb], photosChanged: false, title: l.title[l.lang] || L(l.title), cat: l.cat, who: l.who, age: l.age, cond: l.cond,
      source: l.source, sourceOther: l.sourceOther, size: l.size, problem: l.problem, problemText: l.problemText[l.lang] || L(l.problemText),
      desc: (l.desc && l.desc[l.lang]) || '', price: String(l.price), origPrice: l.origPrice ? String(l.origPrice) : '', link: l.link, hood: l.hood,
      contact: { ...l.contact }, phone: (c && c.phone) || '', email: (c && c.email) || '',
    };
  } else if (!editId && editing) { editing = null; draft = blank(); }
  if (!draft.hood && state.profile && state.profile.hood) draft.hood = state.profile.hood;
  if (!draft.email && state.user) draft.email = state.user.email || '';
  const ls = lists();
  if (!draft.hood) draft.hood = ls.hoods[0].id;
  if (!draft.source) draft.source = ls.sources[0].id;

  const seg = (name, ids, label) => `<div class="segs">${ids.map((k) => chip(label(k), draft[name] === k, `data-seg="${name}" data-v="${esc(k)}"`)).join('')}</div>`;
  el.innerHTML = `
    <div class="page narrow">
      ${!state.user ? `<div class="card flat loginbar"><div>${p.loginFirst}</div><button class="btn sm" data-login>${p.login}</button></div>` : ''}
      ${state.blocked ? `<div class="note warn">${p.blocked}</div>` : ''}
      <form class="card" id="postform" novalidate>
        <div class="cardhead"><h2>${editing ? p.editTitle : p.title}</h2><span class="hint">${editing ? '' : p.sub}</span></div>

        <div class="field"><label>${p.photos}</label>
          <div class="photos" id="photos"></div>
          <input type="file" id="files" accept="image/*" multiple hidden>
          <div class="help">${p.photoHelp}</div>
        </div>

        <div class="field"><label for="f-title">${p.name}</label><input type="text" id="f-title" maxlength="100" placeholder="${esc(p.namePh)}" value="${esc(draft.title)}" dir="auto"></div>
        <div class="field"><label>${t.labels.category}</label>${seg('cat', CATS, (k) => `${CAT_EMOJI[k]} ${t.cat[k]}`)}</div>
        <div class="grid2">
          <div class="field"><label for="f-who">${t.labels.who}</label><select id="f-who">${WHO.map((k) => `<option value="${k}" ${draft.who === k ? 'selected' : ''}>${t.who[k]}</option>`).join('')}</select></div>
          <div class="field"><label for="f-age">${t.labels.age}</label><select id="f-age">${AGES.map((k) => `<option value="${k}" ${draft.age === k ? 'selected' : ''}>${t.age[k]}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>${t.labels.cond}</label>${seg('cond', CONDS, (k) => t.cond[k])}</div>
        <div class="field"><label>${t.labels.source}</label>${seg('source', ls.sources.filter((s) => !s.hidden || s.id === draft.source).map((s) => s.id), (k) => esc(sourceName(k)))}
          <input type="text" id="f-sother" maxlength="40" placeholder="${esc(p.sourceOther)}" value="${esc(draft.sourceOther)}" ${draft.source === 'other' ? '' : 'hidden'} style="margin-top:8px" dir="auto"></div>

        <div class="field"><label for="f-size">${p.sizeLbl} <span class="opt">${p.sizeHelp}</span></label><input type="text" id="f-size" maxlength="40" placeholder="${esc(p.sizePh)}" value="${esc(draft.size)}" dir="auto"></div>
        <div class="field"><label>${p.problemLbl}</label>${seg('problem', PROBLEMS, (k) => t.problem[k])}</div>
        <div class="field"><label for="f-ptext">${p.problemNote}</label><textarea id="f-ptext" maxlength="600" placeholder="${esc(p.problemPh)}" dir="auto">${esc(draft.problemText)}</textarea></div>
        <div class="field"><label for="f-desc">${p.desc} <span class="opt">${p.optional}</span></label><textarea id="f-desc" maxlength="900" style="min-height:64px" dir="auto">${esc(draft.desc)}</textarea></div>

        <div class="grid2">
          <div class="field"><label for="f-price">${p.price}</label><div class="pricebox"><input type="number" id="f-price" inputmode="numeric" min="0" max="100000" placeholder="${esc(p.pricePh)}" value="${esc(draft.price)}"><span class="cur">₪</span></div></div>
          <div class="field"><label for="f-orig">${p.origPrice} <span class="opt">${p.optional}</span></label><div class="pricebox"><input type="number" id="f-orig" inputmode="numeric" min="0" max="100000" value="${esc(draft.origPrice)}"><span class="cur">₪</span></div></div>
        </div>
        <div class="field"><label for="f-link">${p.link} <span class="opt">${p.optional}</span></label><input type="url" id="f-link" maxlength="480" placeholder="https://" value="${esc(draft.link)}" dir="ltr"></div>

        <div class="field"><label for="f-hood">${p.hood}</label><select id="f-hood">${ls.hoods.filter((h) => !h.hidden || h.id === draft.hood).map((h) => `<option value="${esc(h.id)}" ${draft.hood === h.id ? 'selected' : ''}>${esc(h[state.lang])}</option>`).join('')}</select></div>
        <div class="field"><label>${p.contactLbl}</label>
          <div class="segs">
            ${chip(`${I.inbox} ${p.cMsg}`, draft.contact.msg, 'data-c="msg"')}
            ${chip(`${I.phone} ${p.cPhone}`, draft.contact.phone, 'data-c="phone"')}
            ${chip(`${I.mail} ${p.cMail}`, draft.contact.mail, 'data-c="mail"')}
          </div>
          <input type="tel" id="f-phone" maxlength="20" placeholder="${esc(p.phoneLbl)}" value="${esc(draft.phone)}" ${draft.contact.phone ? '' : 'hidden'} style="margin-top:8px" dir="ltr" autocomplete="tel">
          <input type="email" id="f-mail" maxlength="120" placeholder="${esc(p.mailLbl)}" value="${esc(draft.email)}" ${draft.contact.mail ? '' : 'hidden'} style="margin-top:8px" dir="ltr" autocomplete="email">
        </div>

        <div class="note">${p.translateNote}</div>
        <div class="formerr" id="formerr" role="alert"></div>
        <div class="actions">
          ${editing ? `<button type="button" class="btn secondary" data-cancel>${p.back}</button>` : ''}
          <button type="submit" class="btn" id="go">${I.globe} ${p.next}</button>
        </div>
      </form>
    </div>`;

  drawPhotos();
  $$('[data-login]', el).forEach((b) => (b.onclick = () => requireLogin().then((ok) => ok && render(el, editId))));
  $$('[data-seg]', el).forEach((b) => (b.onclick = () => {
    const k = b.dataset.seg;
    draft[k] = b.dataset.v;
    $$(`[data-seg="${k}"]`, el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (k === 'source') $('#f-sother').hidden = draft.source !== 'other';
  }));
  $$('[data-c]', el).forEach((b) => (b.onclick = () => {
    const k = b.dataset.c;
    draft.contact[k] = !draft.contact[k];
    b.setAttribute('aria-pressed', String(draft.contact[k]));
    if (k === 'phone') $('#f-phone').hidden = !draft.contact.phone;
    if (k === 'mail') $('#f-mail').hidden = !draft.contact.mail;
  }));
  const cancel = $('[data-cancel]', el);
  if (cancel) cancel.onclick = () => { editing = null; draft = blank(); go('mine'); };
  $('#files').onchange = onFiles;
  el.addEventListener('input', readForm);
  el.addEventListener('change', readForm);
  $('#postform').onsubmit = (e) => { e.preventDefault(); next(el); };
}

function readForm() {
  const v = (id) => { const x = document.getElementById(id); return x ? x.value : ''; };
  Object.assign(draft, {
    title: v('f-title'), who: v('f-who') || draft.who, age: v('f-age') || draft.age, sourceOther: v('f-sother'), size: v('f-size'),
    problemText: v('f-ptext'), desc: v('f-desc'), price: v('f-price'), origPrice: v('f-orig'), link: v('f-link'),
    hood: v('f-hood') || draft.hood, phone: v('f-phone'), email: v('f-mail'),
  });
}

function drawPhotos() {
  const p = T().post, box = $('#photos');
  if (!box) return;
  const slots = [];
  draft.photos.forEach((src, i) => slots.push(`<div class="slot ${i === 0 ? 'main' : ''}" data-i="${i}">
      <img src="${esc(src)}" alt=""><button type="button" class="rm" data-rm="${i}" aria-label="remove">${I.x}</button>
      ${i === 0 ? `<span class="mainlbl">${p.mainPhoto}</span>` : ''}</div>`));
  if (draft.photos.length < 4) {
    slots.push(`<button type="button" class="slot ${draft.photos.length === 0 ? 'main' : ''}" data-add>
      <div>${draft.photos.length === 0 ? I.camera : I.post}<div class="lbl">${draft.photos.length === 0 ? p.mainPhoto : p.addPhoto}</div></div></button>`);
  }
  box.innerHTML = slots.join('');
  $$('[data-add]', box).forEach((b) => (b.onclick = () => $('#files').click()));
  $$('[data-rm]', box).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); draft.photos.splice(+b.dataset.rm, 1); draft.photosChanged = true; drawPhotos(); }));
  // Tap a photo to make it the main one.
  $$('.slot[data-i]', box).forEach((s) => (s.onclick = () => {
    const i = +s.dataset.i; if (!i) return;
    const [x] = draft.photos.splice(i, 1); draft.photos.unshift(x); draft.photosChanged = true; drawPhotos();
  }));
}

async function onFiles(e) {
  const files = [...e.target.files].slice(0, 4 - draft.photos.length);
  e.target.value = '';
  for (const f of files) {
    try { draft.photos.push(await compress(f)); draft.photosChanged = true; drawPhotos(); }
    catch (err) { console.warn(err); toast(state.lang === 'he' ? 'לא הצלחנו לקרוא את התמונה' : 'Could not read that photo'); }
  }
}

function validate() {
  const n = T().post.need;
  if (!draft.photos.length) return n.photo;
  if (!draft.title.trim()) return n.title;
  if (draft.source === 'other' && !draft.sourceOther.trim()) return n.source;
  if (!draft.problemText.trim()) return n.problem;
  if (draft.price === '' || isNaN(+draft.price) || +draft.price < 0) return n.price;
  if (!draft.contact.msg && !draft.contact.phone && !draft.contact.mail) return n.contact;
  if (draft.contact.phone && draft.phone.replace(/\D/g, '').length < 9) return n.phone;
  if (draft.contact.mail && !/^\S+@\S+\.\S+$/.test(draft.email)) return n.mail;
  return null;
}

async function next(el) {
  readForm();
  const t = T(), p = t.post;
  const err = validate();
  $('#formerr').textContent = err || '';
  if (err) { $('#formerr').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  if (!(await requireLogin())) return;
  if (state.blocked) { toast(p.blocked); return; }
  const btn = $('#go');
  busy(btn, true, p.translating);
  const lang = detectLang(draft.title, draft.problemText, draft.desc);
  const other = lang === 'he' ? 'en' : 'he';
  const src = { title: clamp(draft.title, 100), problemText: clamp(draft.problemText, 600), desc: clamp(draft.desc, 900) };
  const tr = await translateAll(src, lang, other);
  busy(btn, false);
  review(el, lang, other, src, tr);
}

function review(el, lang, other, src, tr) {
  const t = T(), p = t.post;
  const ok = !!tr;
  const sh = openSheet(`${sheetHead(p.review, ok ? p.reviewHint : '')}<div class="body" style="padding-top:12px">
    ${ok ? `
      <div class="field"><label>${p.name}</label><input type="text" id="r-title" maxlength="110" value="${esc(tr.title)}" dir="${other === 'he' ? 'rtl' : 'ltr'}"></div>
      <div class="field"><label>${p.problemNote}</label><textarea id="r-ptext" maxlength="690" dir="${other === 'he' ? 'rtl' : 'ltr'}">${esc(tr.problemText)}</textarea></div>
      ${src.desc ? `<div class="field"><label>${p.desc}</label><textarea id="r-desc" maxlength="990" dir="${other === 'he' ? 'rtl' : 'ltr'}">${esc(tr.desc)}</textarea></div>` : ''}`
    : `<div class="note warn" style="margin-top:0">${p.reviewFail}</div>`}
    <div class="actions"><button class="btn secondary" data-close>${p.back}</button><button class="btn" data-submit>${I.check} ${editing ? p.saveEdit : p.submit}</button></div>
  </div>`);
  $('[data-submit]', sh).onclick = async (e) => {
    const b = e.currentTarget;
    busy(b, true, p.posting);
    try {
      const pair = (k) => ({ [lang]: src[k], [other]: ok ? clamp(($(`#r-${k === 'problemText' ? 'ptext' : k}`, sh) || {}).value || '', k === 'title' ? 110 : k === 'desc' ? 990 : 690) : '' });
      let photos = null, thumb = editing ? editing.thumb : null;
      if (draft.photosChanged || !editing) {
        photos = draft.photos;
        if (photos.reduce((n, s) => n + s.length, 0) > 900000) {
          photos = await fitBudget(await Promise.all(photos.map((u) => fetch(u).then((r) => r.blob()))));
        }
        thumb = await thumbFrom(photos[0]);
      }
      const form = {
        lang, translated: ok, title: pair('title'), problemText: pair('problemText'), desc: src.desc ? pair('desc') : { he: '', en: '' },
        cat: draft.cat, who: draft.who, age: draft.age, cond: draft.cond, source: draft.source, sourceName: sourceName(draft.source), sourceOther: draft.source === 'other' ? clamp(draft.sourceOther, 40) : '',
        size: clamp(draft.size, 40), problem: draft.problem, price: Math.round(+draft.price), origPrice: Math.round(+draft.origPrice || 0),
        link: /^https?:\/\//i.test(draft.link.trim()) ? clamp(draft.link, 480) : '', hood: draft.hood, contact: { ...draft.contact }, thumb,
        photoCount: (photos || draft.photos).length,
      };
      const data = buildListing(form, state.user, editing);
      const id = await saveListing({ id: editing && editing.id, data, photos, contact: { phone: draft.contact.phone ? draft.phone.trim() : '', email: draft.contact.mail ? draft.email.trim() : '' } });
      try { if (draft.contact.phone) localStorage.setItem('nus-phone', draft.phone.trim()); } catch (e2) {}
      const wasEdit = !!editing;
      const cat = draft.cat, who = draft.who;
      editing = null; draft = blank();
      state.myListings = null;
      closeSheet();
      toast(wasEdit ? p.saved : p.done);
      go('item/' + id);
      if (!wasEdit) suggestWanted(cat, who);
    } catch (err) {
      console.error(err);
      busy(b, false);
      toast(`${p.err} ${err.code || ''}`);
    }
  };
}

// After posting: someone in Wanted may be looking for exactly this.
async function suggestWanted(cat, who) {
  try {
    const n = (await wantedList()).filter((w) => w.cat === cat && (w.who === who || w.who === 'na' || who === 'na') && w.id !== state.user.uid).length;
    if (n) setTimeout(() => toast(`${T().wantedT.someone} (${n}) · ${T().nav.wanted}`, 6000), 2800);
  } catch (e) { console.warn(e); }
}
