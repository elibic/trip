import { state, T, L } from '../state.js';
import { $, $$, esc, I, nis, initial, daysLeft, hueFor, toast, busy, confirmSheet, hoodName, sourceName } from '../ui.js';
import { myListings, archiveMyExpired, setStatus, renew, deleteListing, savedCounts, saveProfile, signOut } from '../api.js';
import { REMIND_DAYS } from '../config.js';
import { CAT_EMOJI } from '../lists.js';
import { go } from '../nav.js';
import { requireLogin, askName } from './auth.js';
import { applySaved } from './feed.js';

export async function render(el) {
  const t = T(), m = t.mine;
  $('#filters').classList.add('hidden');
  if (!state.user) {
    el.innerHTML = `<div class="page narrow"><div class="card profile">
      <div class="avatar lg">?</div><div class="main"><div class="t1">${m.guest}</div><div class="t2">${t.post.loginFirst}</div></div>
      <button class="btn sm" data-login>${m.signin}</button></div></div>`;
    $('[data-login]', el).onclick = () => requireLogin().then((ok) => ok && render(el));
    return;
  }
  el.innerHTML = `<div class="page narrow">
    <div class="card profile">
      <div class="avatar lg">${esc(initial(state.user.name))}</div>
      <div class="main"><div class="t1" dir="auto">${esc(state.user.name || '')}</div><div class="t2" dir="ltr">${esc(state.user.email || '')}</div></div>
      <div class="pbtns"><button class="btn sm secondary" data-name>${m.edit}</button>
      <button class="btn sm secondary" data-out>${m.signout}</button></div>
    </div>
    ${state.isAdmin ? `<a class="card adminlink" href="admin.html${location.search.includes('emu') ? '?emu=1' : ''}">${I.flag} ${t.menu.admin}</a>` : ''}
    <div class="card"><div class="cardhead"><h2>${m.listings}</h2><span class="hint num" id="lcount"></span></div><div class="list" id="mylist"><div class="sk line"></div><div class="sk line"></div></div></div>
    <div class="card"><div class="cardhead"><h2>${m.saved}</h2></div><div class="list" id="saved"></div></div>
  </div>`;
  $('[data-out]', el).onclick = async () => { await signOut(); go('feed'); };
  $('[data-name]', el).onclick = async () => { if (await askName()) render(el); };
  drawSaved();
  try {
    if (!state.myListings) {
      state.myListings = await myListings(state.user.uid);
      await archiveMyExpired(state.myListings);
    }
  } catch (e) { console.error(e); state.myListings = []; }
  drawListings(el);
}

function drawListings(el) {
  const t = T(), m = t.mine, box = $('#mylist');
  if (!box) return;
  const items = state.myListings || [];
  $('#lcount').textContent = items.length || '';
  if (!items.length) { box.innerHTML = `<div class="empty">${m.none}<br><br><a class="btn sm" href="#post">${I.post} ${t.nav.post}</a></div>`; return; }
  box.innerHTML = items.map((l) => {
    const left = daysLeft(l.expiresAt);
    const soon = l.live && left <= REMIND_DAYS;
    const cls = { active: 'good', reserved: 'warn', sold: 'grey', archived: 'grey', hidden: 'bad' }[l.status];
    const acts = [];
    if (l.status === 'hidden') { /* admins decided; nothing to do here */ }
    else if (l.live) {
      if (soon) acts.push(`<button class="btn sm" data-act="renew">${m.renew}</button>`);
      acts.push(l.status === 'active' ? `<button class="btn sm secondary" data-act="reserved">${m.markReserved}</button>` : `<button class="btn sm secondary" data-act="active">${m.markActive}</button>`);
      acts.push(`<button class="btn sm secondary" data-act="sold">${m.markSold}</button>`);
      acts.push(`<button class="btn sm secondary" data-act="edit">${m.edit}</button>`);
    } else {
      acts.push(`<button class="btn sm" data-act="renew">${m.repost}</button>`);
    }
    acts.push(`<button class="btn sm danger" data-act="del">${m.del}</button>`);
    return `<div class="mrow" data-id="${esc(l.id)}">
      <a class="row" href="#item/${encodeURIComponent(l.id)}">
        <div class="avatar thumb">${l.thumb ? `<img src="${esc(l.thumb)}" alt="">` : CAT_EMOJI[l.cat]}</div>
        <div class="main"><div class="t1" dir="auto">${esc(L(l.title))}</div>
          <div class="t2">${nis(l.price)} · ${l.views || 0} ${t.labels.views}${l.live ? ` · ${m.expiresIn} <b class="num">${left}</b> ${m.days}` : ''}</div></div>
        <span class="tag ${cls}">${t.status[l.status]}</span>
      </a>
      ${soon ? `<div class="note warn" style="margin:0 0 6px">${m.expiring}</div>` : ''}
      <div class="mactions">${acts.join('')}</div>
    </div>`;
  }).join('');
  $$('.mrow', box).forEach((row) => $$('[data-act]', row).forEach((b) => (b.onclick = async () => {
    const id = row.dataset.id, act = b.dataset.act;
    const l = state.myListings.find((x) => x.id === id);
    if (act === 'edit') { go('edit/' + id); return; }
    if (act === 'del' && !(await confirmSheet(m.delConfirm, m.del))) return;
    busy(b, true);
    try {
      if (act === 'renew') { await renew(id); Object.assign(l, { status: 'active', live: true, expiresAt: Date.now() + 30 * 864e5 }); toast(m.renewed); }
      else if (act === 'del') { await deleteListing(id); state.myListings = state.myListings.filter((x) => x.id !== id); }
      else { await setStatus(id, act); Object.assign(l, { status: act, live: act === 'active' || act === 'reserved' }); }
      drawListings(el);
      window.dispatchEvent(new Event('mine-changed'));
    } catch (e) { console.error(e); toast(T().post.err); busy(b, false); }
  })));
}

async function drawSaved() {
  const t = T(), m = t.mine, box = $('#saved');
  const saved = (state.profile && state.profile.saved) || [];
  if (!saved.length) { box.innerHTML = `<div class="empty">${m.noSaved}</div>`; return; }
  const label = (f) => [f.cat && t.cat[f.cat], f.who && t.who[f.who], f.age && t.age[f.age], f.cond && t.cond[f.cond], f.source && sourceName(f.source), f.hood && hoodName(f.hood), f.free && t.free, f.q && `"${f.q}"`].filter(Boolean).join(' · ') || t.all;
  box.innerHTML = saved.map((s) => `<div class="row">
      <button class="rowbtn" data-open="${esc(s.id)}"><div class="avatar">${I.bell}</div>
        <div class="main"><div class="t1" dir="auto">${esc(label(s.f))}</div></div>
        ${state.savedCounts[s.id] ? `<span class="tag">${state.savedCounts[s.id]} ${m.newMatch}</span>` : ''}</button>
      <button class="iconbtn sm" data-rm="${esc(s.id)}" aria-label="${m.del}">${I.x}</button></div>`).join('');
  $$('[data-open]', box).forEach((b) => (b.onclick = async () => {
    const s = saved.find((x) => x.id === b.dataset.open);
    const next = saved.map((x) => (x.id === s.id ? { ...x, seenAt: Date.now() } : x));
    state.profile.saved = next; state.savedCounts[s.id] = 0;
    saveProfile(state.user.uid, { saved: next }).catch(() => {});
    window.dispatchEvent(new Event('mine-changed'));
    applySaved(s);
  }));
  $$('[data-rm]', box).forEach((b) => (b.onclick = async () => {
    const next = saved.filter((x) => x.id !== b.dataset.rm);
    state.profile.saved = next;
    await saveProfile(state.user.uid, { saved: next });
    drawSaved();
    window.dispatchEvent(new Event('mine-changed'));
  }));
}

// How many things in "Mine" want attention: expiring listings and new matches.
export async function attention() {
  if (!state.user) return 0;
  try {
    if (!state.myListings) { state.myListings = await myListings(state.user.uid); await archiveMyExpired(state.myListings); }
    state.savedCounts = await savedCounts((state.profile && state.profile.saved) || []);
  } catch (e) { console.warn(e); }
  const expiring = (state.myListings || []).filter((l) => l.live && daysLeft(l.expiresAt) <= REMIND_DAYS).length;
  const matches = Object.values(state.savedCounts).reduce((a, b) => a + b, 0);
  return expiring + matches;
}
