import { state, T, L } from '../state.js';
import { $, $$, esc, I, nis, hoodName, sourceName, hueFor, initial, dateStr, ago, openSheet, closeSheet, sheetHead, toast, busy, chip } from '../ui.js';
import { getListing, getPhotos, getContact, countView, openThread, report } from '../api.js';
import { CAT_EMOJI, REPORT_REASONS } from '../lists.js';
import { googleLink } from '../translate.js';
import { waNumber } from '../text.js';
import { go } from '../nav.js';
import { requireLogin } from './auth.js';

const viewed = new Set();

export async function openItem(id, onClose) {
  const t = T();
  const sh = openSheet(`${sheetHead(t.loading)}<div class="body detail"><div class="gallery"><div class="sk"></div></div><div class="sk line" style="margin-top:16px"></div><div class="sk big"></div></div>`, { close: onClose });
  let l;
  try { l = await getListing(id); } catch (e) { l = null; }
  if (!sh.classList.contains('on')) return;
  if (!l) {
    sh.querySelector('.body').innerHTML = `<div class="empty"><div class="big">🙈</div>${state.lang === 'he' ? 'המודעה לא נמצאה, או שכבר ירדה.' : 'This listing is gone.'}</div>`;
    sh.querySelector('h3').textContent = '';
    return;
  }
  if (!viewed.has(id) && !(state.user && state.user.uid === l.ownerUid)) { viewed.add(id); countView(id); }
  draw(sh, l, [l.thumb].filter(Boolean));
  getPhotos(id).then((p) => { if (p.length && sh.classList.contains('on') && sh.dataset.id === id) drawGallery(sh, l, p); }).catch(() => {});
}

function drawGallery(sh, l, photos) {
  const g = $('.gallery', sh);
  if (!g) return;
  g.innerHTML = photos.length
    ? photos.map((p, i) => `<div><img src="${esc(p)}" alt="" ${i ? 'loading="lazy"' : ''}></div>`).join('')
    : `<div><div class="ph" style="background:${hueFor(l.cat)}">${CAT_EMOJI[l.cat]}</div></div>`;
}

function draw(sh, l, photos) {
  const t = T();
  sh.dataset.id = l.id;
  const other = state.lang === 'he' ? 'en' : 'he';
  const showOrig = !!state.showOrig[l.id];
  const shownLang = l.translated ? (showOrig ? l.lang : state.lang) : l.lang;
  const pick = (m) => (m && (m[shownLang] || m[l.lang])) || '';
  const savePct = l.origPrice && l.price ? Math.round(100 - (l.price / l.origPrice) * 100) : null;
  const mine = state.user && state.user.uid === l.ownerUid;
  const live = l.live && l.expiresAt > Date.now();

  let trans = '';
  if (l.translated && l.lang !== state.lang) trans = `<div class="translated">${I.globe} ${t.translated} · <button data-orig>${showOrig ? t.showTrans : t.showOrig}</button></div>`;
  else if (!l.translated && l.lang !== state.lang) trans = `<div class="translated">${I.globe} <a href="${googleLink([pick(l.title), pick(l.problemText), pick(l.desc)].filter(Boolean).join('\n\n'), l.lang, state.lang)}" target="_blank" rel="noopener">${t.translateBtn}</a></div>`;

  sh.innerHTML = `${sheetHead(esc(pick(l.title)))}
    <div class="body detail">
      <div class="gallery"></div>
      ${!live ? `<div class="note warn" style="margin-top:12px">${t.status[l.status] || ''}</div>` : ''}
      <h2 dir="auto">${esc(pick(l.title))}</h2>
      <div class="pricerow"><span class="p">${nis(l.price)}</span>${l.origPrice ? `<s class="num">₪${l.origPrice}</s>` : ''}${savePct > 0 ? `<span class="save">${savePct}% ${t.save}</span>` : ''}${l.status === 'reserved' ? `<span class="tag warn">${t.status.reserved}</span>` : ''}</div>
      <div class="facts">
        <div class="fact"><span>${t.labels.cond}</span><b>${t.cond[l.cond]}</b></div>
        <div class="fact"><span>${t.labels.source}</span><b dir="auto">${esc(sourceName(l.source, l.sourceOther))}</b></div>
        ${l.size ? `<div class="fact"><span>${t.labels.size}</span><b dir="auto">${esc(l.size)}</b></div>` : ''}
        <div class="fact"><span>${t.labels.who} · ${t.labels.age}</span><b>${t.who[l.who]} · ${t.age[l.age]}</b></div>
        <div class="fact"><span>${t.labels.hood}</span><b>${esc(hoodName(l.hood))}</b></div>
        <div class="fact"><span>${t.labels.posted} · ${t.labels.expires}</span><b>${ago(l.postedAt)} · ${dateStr(l.expiresAt)}</b></div>
      </div>
      <div class="problem"><div class="lbl">${t.labels.problem}: ${t.problem[l.problem]}</div><p class="selectable" dir="auto">${esc(pick(l.problemText))}</p>
        ${pick(l.desc) ? `<div class="lbl" style="margin-top:10px">${t.labels.desc}</div><p class="selectable" dir="auto">${esc(pick(l.desc))}</p>` : ''}
        ${trans}
      </div>
      ${l.link ? `<a class="linkrow" href="${esc(l.link)}" target="_blank" rel="noopener nofollow">${I.tag} ${t.labels.link}</a>` : ''}
      <div class="seller">
        <div class="avatar lg">${esc(initial(l.ownerName))}</div>
        <div class="main"><div class="t1" dir="auto">${esc(l.ownerName)}</div><div class="t2">${l.views || 0} ${t.labels.views}</div></div>
        <button class="iconbtn" data-share aria-label="share">${I.share}</button>
        ${mine ? '' : `<button class="iconbtn" data-report aria-label="${t.report.btn}" title="${t.report.btn}">${I.flag}</button>`}
      </div>
      <div class="contact" id="contact"></div>
    </div>`;
  $$('[data-close]', sh).forEach((b) => (b.onclick = closeSheet));
  drawGallery(sh, l, photos);
  const ob = $('[data-orig]', sh);
  if (ob) ob.onclick = () => { state.showOrig[l.id] = !showOrig; draw(sh, l, $$('.gallery img', sh).map((i) => i.src)); };
  $('[data-share]', sh).onclick = () => share(l, pick(l.title));
  const rb = $('[data-report]', sh);
  if (rb) rb.onclick = () => openReport('listing', l.id);
  drawContact(sh, l, mine, live);
}

async function drawContact(sh, l, mine, live) {
  const t = T(), box = $('#contact', sh);
  if (mine) {
    box.innerHTML = `<div class="note" style="margin:0">${t.contact.own}</div><button class="btn secondary" data-edit>${T().mine.edit}</button>`;
    $('[data-edit]', sh).onclick = () => { closeSheet(); go('edit/' + l.id); };
    return;
  }
  if (!live) { box.innerHTML = ''; return; }
  const btns = [];
  if (l.contact.msg) btns.push(`<button class="btn" data-msg>${I.inbox} ${t.contact.msg}</button>`);
  if ((l.contact.phone || l.contact.mail) && !state.user) btns.push(`<button class="btn secondary" data-login>${I.phone} ${t.contact.loginToSee}</button>`);
  box.innerHTML = btns.join('');
  box.className = 'contact';
  const mb = $('[data-msg]', sh);
  if (mb) mb.onclick = async (e) => {
    if (!(await requireLogin())) return;
    busy(e.currentTarget, true);
    try {
      const id = await openThread({ kind: 'listing', refId: l.id, owner: l.ownerUid, title: l.title, me: state.user });
      closeSheet();
      go('thread/' + id);
    } catch (err) { console.error(err); toast(T().post.err); busy(e.currentTarget, false); }
  };
  const lb = $('[data-login]', sh);
  if (lb) lb.onclick = async () => { if (await requireLogin()) openItemAgain(l.id); };
  if (state.user && (l.contact.phone || l.contact.mail)) {
    try {
      const c = await getContact(l.id);
      if (!c) return;
      const more = [];
      if (l.contact.phone && c.phone) {
        const msg = encodeURIComponent(`${state.lang === 'he' ? 'היי, ראיתי את' : 'Hi, I saw'} "${L(l.title)}" ${location.origin + location.pathname}#item/${l.id}`);
        more.push(`<a class="btn secondary" href="https://wa.me/${waNumber(c.phone)}?text=${msg}" target="_blank" rel="noopener">${I.wa} ${t.contact.wa}</a>`);
        more.push(`<a class="btn secondary" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${I.phone} ${t.contact.call}</a>`);
      }
      if (l.contact.mail && c.email) more.push(`<a class="btn secondary" href="mailto:${esc(c.email)}?subject=${encodeURIComponent(L(l.title))}">${I.mail} ${t.contact.mail}</a>`);
      box.insertAdjacentHTML('beforeend', more.join(''));
      if (box.children.length > 1) box.classList.add('two');
    } catch (e) { console.warn(e); }
  }
}

function openItemAgain(id) { setTimeout(() => openItem(id), 50); }

function share(l, title) {
  const url = `${location.origin}${location.pathname}#item/${l.id}`;
  const text = `${title} · ${l.price ? '₪' + l.price : T().free}`;
  if (navigator.share) navigator.share({ title, text, url }).catch(() => {});
  else window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank', 'noopener');
}

export async function openReport(type, targetId) {
  const t = T().report;
  if (!(await requireLogin())) return;
  let reason = null;
  const sh = openSheet(`${sheetHead(type === 'wanted' ? t.titleWanted : t.title)}<div class="body" style="padding-top:12px">
    <div class="segs">${REPORT_REASONS.map((r) => chip(t.reason[r], false, `data-r="${r}"`)).join('')}</div>
    <div class="field" style="margin-top:14px"><label>${t.note}</label><textarea id="rnote" maxlength="500" dir="auto"></textarea></div>
    <button class="btn block" data-send disabled>${t.send}</button></div>`);
  $$('[data-r]', sh).forEach((b) => (b.onclick = () => {
    reason = b.dataset.r;
    $$('[data-r]', sh).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('[data-send]', sh).disabled = false;
  }));
  $('[data-send]', sh).onclick = async (e) => {
    busy(e.currentTarget, true);
    try { await report({ type, targetId, reason, note: $('#rnote').value.trim().slice(0, 500) }); closeSheet(); toast(t.thanks); }
    catch (err) { console.error(err); toast(T().post.err); busy(e.currentTarget, false); }
  };
}
