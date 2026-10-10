import { configured, EMU } from './fb.js';
import { state, T } from './state.js';
import { $, $$, esc, I, toast, openSheet, closeSheet, sheetHead, sheetOpen } from './ui.js';
import { VERSION } from './version.js';

const tabs = ['feed', 'wanted', 'post', 'inbox', 'mine'];
let lastTab = 'feed';

function setLangAttrs() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = T().dir;
  document.title = T().brand;
}

function chrome(current) {
  const t = T();
  setLangAttrs();
  $('#brand').textContent = t.brand;
  $('#tagline').textContent = t.tagline;
  $('#langbtn').textContent = t.lang;
  const badge = (k) => (k === 'inbox' && state.unread ? state.unread : k === 'mine' && state.attention ? state.attention : 0);
  $('#nav').innerHTML = tabs.map((k) => k === 'post'
    ? `<a class="post" role="tab" href="#post" aria-selected="${current === 'post'}"><span class="disc">${I.post}</span><span>${t.nav.post}</span></a>`
    : `<a role="tab" href="#${k}" aria-selected="${current === k}">${I[k]}<span>${t.nav[k]}</span>${badge(k) ? `<span class="badge">${badge(k)}</span>` : ''}</a>`).join('');
  $('#toptabs').innerHTML = tabs.map((k) => `<a role="tab" href="#${k}" aria-selected="${current === k}">${I[k]}<span>${t.nav[k]}</span>${badge(k) ? `<span class="tag">${badge(k)}</span>` : ''}</a>`).join('');
  const items = [['lang', t.menu.lang], ['theme', t.menu.theme], ['about', t.menu.about], ['install', t.menu.install], ['update', t.menu.update]];
  if (state.isAdmin) items.push(['admin', t.menu.admin]);
  $('#menu').innerHTML = items.map(([k, l]) => `<button class="menuitem" role="menuitem" data-m="${k}"><span>${l}</span></button>`).join('');
  $$('#menu [data-m]').forEach((b) => (b.onclick = () => { $('#menu').hidden = true; menu(b.dataset.m); }));
  $('#build').textContent = `v${VERSION}${EMU ? ' · emulator' : ''}`;
}

function menu(k) {
  const t = T();
  if (k === 'lang') toggleLang();
  else if (k === 'theme') toggleTheme();
  else if (k === 'admin') location.href = 'admin.html' + (EMU ? '?emu=1' : '');
  else if (k === 'update') checkUpdate(true);
  else if (k === 'about') openSheet(`${sheetHead(t.about.title)}<div class="body"><div class="aboutintro"><img src="icons/logo.svg" alt="">${t.about.intro.map((p) => `<p>${esc(p)}</p>`).join('')}</div><ul class="about">${t.about.body.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`);
  else if (k === 'install') {
    if (window.__installPrompt) { window.__installPrompt.prompt(); window.__installPrompt = null; return; }
    openSheet(`${sheetHead(t.menu.install)}<div class="body"><ul class="about"><li>${t.install.ios}</li><li>${t.install.android}</li></ul></div>`);
  }
}

function toggleLang() {
  state.lang = state.lang === 'he' ? 'en' : 'he';
  try { localStorage.setItem('nus-lang', state.lang); } catch (e) {}
  setLangAttrs();
  if (sheetOpen()) closeSheet();
  router();
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  $('#tc').content = next === 'dark' ? '#0a0e15' : '#f2f0eb';
  try { localStorage.setItem('nus-theme', next); } catch (e) {}
}

// ------------------------------------------------------------------ router
let views = null;
let rendering = 0;
async function router() {
  const { route, releaseAll } = await import('./nav.js');
  const { name, arg } = route();
  const el = $('#app');
  // Overlays open above the last full screen instead of replacing it.
  if (name === 'item' && arg) {
    if (!$('#app').dataset.tab) await show(lastTab, el, releaseAll);
    chrome(lastTab);
    views.detail.openItem(arg, () => { if (location.hash.startsWith('#item/')) history.replaceState(null, '', '#' + lastTab); });
    return;
  }
  if (sheetOpen()) closeSheet();
  const tab = tabs.includes(name) || name === 'edit' || name === 'thread' ? name : 'feed';
  if (tabs.includes(tab)) lastTab = tab;
  await show(tab, el, releaseAll, arg);
}

async function show(tab, el, releaseAll, arg) {
  const my = ++rendering;
  releaseAll();
  chrome(tab === 'edit' ? 'post' : tab === 'thread' ? 'inbox' : tab);
  el.dataset.tab = tab;
  window.scrollTo({ top: 0 });
  const v = views;
  if (tab === 'feed') await v.feed.render(el);
  else if (tab === 'wanted') await v.wanted.render(el);
  else if (tab === 'post') await v.post.render(el);
  else if (tab === 'edit') await v.post.render(el, arg);
  else if (tab === 'inbox') await v.inbox.render(el);
  else if (tab === 'thread') await v.inbox.renderThread(el, arg);
  else if (tab === 'mine') await v.mine.render(el);
  return my === rendering;
}

// ------------------------------------------------------------------ boot
function setupScreen() {
  const t = T();
  chrome('feed');
  $('#filters').classList.add('hidden');
  $('#app').innerHTML = `<div class="page narrow"><div class="hero-card"><div class="hero-sun">${I.sun}</div>
    <div class="hero-label">${t.tagline}</div><div class="hero-value">${t.setup.title}</div><div class="hero-note">${t.setup.body}</div></div></div>`;
}

async function boot() {
  $('#langbtn').onclick = toggleLang;
  $('#themebtn').onclick = toggleTheme;
  $('#menubtn').onclick = (e) => { e.stopPropagation(); const m = $('#menu'); m.hidden = !m.hidden; $('#menubtn').setAttribute('aria-expanded', String(!m.hidden)); };
  document.addEventListener('click', (e) => { if (!e.target.closest('.menuwrap')) $('#menu').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSheet(); $('#menu').hidden = true; } });
  $('#backdrop').onclick = closeSheet;
  addEventListener('scroll', () => $('#topbar').classList.toggle('stuck', scrollY > 4), { passive: true });
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });

  if (!configured) { setupScreen(); return; }

  const api = await import('./api.js');
  views = {
    feed: await import('./views/feed.js'),
    detail: await import('./views/detail.js'),
    post: await import('./views/post.js'),
    wanted: await import('./views/wanted.js'),
    inbox: await import('./views/inbox.js'),
    mine: await import('./views/mine.js'),
    auth: await import('./views/auth.js'),
  };

  // Lists first, so neighborhood names are right on the first paint.
  await new Promise((res) => { let first = true; api.watchLists(() => { if (first) { first = false; res(); } else if (!sheetOpen()) router(); }); setTimeout(res, 2500); });

  // Finishing an email-link sign-in.
  if (api.isEmailLink()) {
    let email = null;
    try { email = localStorage.getItem('nus-email'); } catch (e) {}
    if (!email) email = prompt(T().auth.confirmEmail) || '';
    try { await api.finishEmailLink(email); } catch (e) { console.warn(e); toast(`${T().auth.fail}: ${e.code || e.message}`); }
  }

  let stopThreads = null;
  let firstAuth = true;
  api.onAuth(async (u) => {
    if (stopThreads) { stopThreads(); stopThreads = null; }
    state.myListings = null; state.threads = []; state.unread = 0; state.attention = 0;
    if (u) {
      state.user = { uid: u.uid, email: u.email || '', name: u.displayName || '' };
      try { state.profile = await api.loadProfile(u.uid); } catch (e) { state.profile = null; }
      if (state.profile && state.profile.name) state.user.name = state.profile.name;
      else if (u.displayName) {
        // Google gives a name: keep it without asking.
        const data = { name: u.displayName.slice(0, 40), email: u.email || '', createdAt: Date.now(), lang: state.lang };
        try { await api.saveProfile(u.uid, data); state.profile = { ...(state.profile || {}), ...data }; } catch (e) { console.warn(e); }
      }
      if (!state.profile || !state.profile.name) await views.auth.askName();
      views.auth.resolveLogin(true);
      if (sheetOpen() && $('#sheet [data-google]')) closeSheet();
      [state.blocked, state.isAdmin] = await Promise.all([api.isBlocked(u.uid), api.checkAdmin()]);
      stopThreads = api.watchThreads(u.uid, (th) => {
        state.threads = th;
        const n = th.reduce((s, x) => s + ((x.unread && x.unread[u.uid]) || 0), 0);
        const changed = n !== state.unread;
        state.unread = n;
        if ($('#app').dataset.tab === 'inbox') views.inbox.draw($('#app'));
        else if (changed) chrome($('#app').dataset.tab === 'thread' ? 'inbox' : $('#app').dataset.tab);
      });
      refreshAttention();
    } else {
      Object.assign(state, { user: null, profile: null, blocked: false, isAdmin: false });
    }
    if (firstAuth) { firstAuth = false; router(); }
    else if (!sheetOpen()) router();
    else chrome($('#app').dataset.tab);
  });

  addEventListener('hashchange', router);
  addEventListener('mine-changed', refreshAttention);
  async function refreshAttention() {
    state.attention = await views.mine.attention();
    chrome($('#app').dataset.tab || 'feed');
  }

  addEventListener('offline', () => toast(T().offline, 4000));
  checkUpdate(false);
  setInterval(() => checkUpdate(false), 30 * 60e3);
}

// ------------------------------------------------------------------ updates
async function checkUpdate(manual) {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const v = await r.json();
    if (v.version && v.version !== VERSION) {
      const t = T().update;
      const sh = openSheet(`${sheetHead(t.title, 'v' + esc(v.version))}<div class="body">
        ${(v.changes && v.changes[state.lang] ? `<ul class="about">${v.changes[state.lang].map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '')}
        <button class="btn block" data-reload>${t.btn}</button></div>`);
      $('[data-reload]', sh).onclick = hardReload;
    } else if (manual) toast(T().update.none);
  } catch (e) { if (manual) toast(T().offline); }
}
async function hardReload() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch (e) {}
  location.reload();
}

if ('serviceWorker' in navigator && !EMU) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
