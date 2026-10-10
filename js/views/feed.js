import { state, T, L, persistFilters } from '../state.js';
import { $, $$, esc, I, chip, nis, hoodName, sourceName, hueFor, openSheet, closeSheet, sheetHead, toast } from '../ui.js';
import { feedPage, promoted, stats, lists, saveProfile } from '../api.js';
import { CATS, WHO, AGES, CONDS, CAT_EMOJI } from '../lists.js';
import { go } from '../nav.js';
import { requireLogin } from './auth.js';

const KEYS = ['cat', 'who', 'age', 'cond', 'source', 'hood'];
let page = { items: [], cursor: null, loading: false, gen: 0 };

const activeCount = () => ['who', 'age', 'cond', 'source', 'hood'].filter((k) => state.filters[k]).length + (state.filters.free ? 1 : 0);
const anyFilter = () => KEYS.some((k) => state.filters[k]) || state.filters.free || !!state.filters.q.trim();

export function card(l) {
  const t = T();
  const reserved = l.status === 'reserved';
  return `
    <a class="item" href="#item/${encodeURIComponent(l.id)}" data-id="${esc(l.id)}">
      <div class="pic">
        ${l.thumb ? `<img src="${esc(l.thumb)}" alt="" loading="lazy" decoding="async">` : `<div class="ph" style="background:${hueFor(l.cat)}">${CAT_EMOJI[l.cat] || '📦'}</div>`}
        <span class="cond ${l.cond === 'tag' ? 'tag1' : ''}">${t.cond[l.cond]}</span>
        ${reserved ? `<span class="promo">${t.reserved}</span>` : l.promoUntil > Date.now() ? `<span class="promo">${t.featured}</span>` : ''}
      </div>
      <div class="info">
        <div class="price">${nis(l.price)} ${l.origPrice && l.price ? `<s class="num">₪${l.origPrice}</s>` : ''}</div>
        <div class="title" dir="auto">${esc(L(l.title))}</div>
        <div class="meta">${l.size ? `<span dir="auto">${t.labels.size} ${esc(l.size)}</span><span class="sep">·</span>` : ''}${l.who !== 'na' ? `<span>${t.who[l.who]}</span><span class="sep">·</span>` : ''}<span>${esc(hoodName(l.hood))}</span></div>
        <span class="src">${I.tag} <span>${esc(sourceName(l.source, l.sourceOther))} · ${t.problem[l.problem]}</span></span>
      </div>
    </a>`;
}

function filterPanel() {
  const t = T(), f = state.filters, ls = lists();
  const group = (label, key, ids, names) => `
    <div class="section-title">${label}</div>
    <div class="segs">${ids.map((k) => chip(esc(names(k)), f[key] === k, `data-f="${key}" data-v="${esc(k)}"`)).join('')}</div>`;
  return `
    ${group(t.labels.who, 'who', WHO, (k) => t.who[k])}
    ${group(t.labels.age, 'age', AGES, (k) => t.age[k])}
    ${group(t.labels.cond, 'cond', CONDS, (k) => t.cond[k])}
    ${group(t.labels.source, 'source', ls.sources.filter((s) => !s.hidden).map((s) => s.id), (k) => sourceName(k))}
    ${group(t.labels.hood, 'hood', ls.hoods.filter((h) => !h.hidden).map((h) => h.id), (k) => hoodName(k))}
    <div class="section-title"></div>
    <div class="segs">${chip(t.freeOnly, f.free, 'data-f="free" data-v="1"')}</div>`;
}

function chipRow() {
  const t = T(), n = activeCount();
  return `<div class="chiprow">
    ${chip(`${I.filter} ${t.filter}${n ? ` <span class="count">${n}</span>` : ''}`, n > 0, 'data-open-filters')}
    ${chip(t.all, !state.filters.cat, 'data-f="cat" data-v=""')}
    ${CATS.map((k) => chip(`${CAT_EMOJI[k]} ${t.cat[k]}`, state.filters.cat === k, `data-f="cat" data-v="${k}"`)).join('')}
  </div>`;
}

function bindFilterClicks(root) {
  $$('[data-f]', root).forEach((b) => (b.onclick = () => {
    const k = b.dataset.f, v = b.dataset.v;
    if (k === 'free') state.filters.free = !state.filters.free;
    else state.filters[k] = !v || state.filters[k] === v ? null : v;
    persistFilters();
    refresh();
  }));
  $$('[data-open-filters]', root).forEach((b) => (b.onclick = openFilters));
  $$('[data-clear]', root).forEach((b) => (b.onclick = () => {
    Object.assign(state.filters, { cat: null, who: null, age: null, cond: null, source: null, hood: null, free: false, q: '' });
    persistFilters(); closeSheet(); refresh(true);
  }));
}

function openFilters() {
  const t = T();
  const sh = openSheet(`${sheetHead(t.filter)}<div class="body" data-filtersheet>${filterPanel()}
    <div class="actions"><button class="btn secondary" data-clear>${t.clear}</button><button class="btn" data-close>${t.apply}</button></div></div>`);
  bindFilterClicks(sh);
}

let root = null;
export async function render(el) {
  root = el;
  const t = T();
  $('#filterbar').innerHTML = chipRow();
  $('#filters').classList.remove('hidden');
  el.innerHTML = `
    <div class="page withside">
      <aside class="side"><div class="card">
        <div class="cardhead"><h2>${t.filter}</h2><div class="spacer"></div><button class="linkbtn" data-clear>${t.clear}</button></div>
        <div id="sidefilters">${filterPanel()}</div></div></aside>
      <div>
        <div class="hero-card">
          <div class="hero-sun">${I.sun}</div>
          <div class="hero-value">${t.brand}</div>
          <div class="hero-motto">${t.hero.motto}</div>
          <div class="hero-note">${t.hero.note}</div>
          <div class="hero-stats" id="herostats">
            <div class="hero-stat"><span>${t.hero.active}</span><b class="num" data-s="active">-</b></div>
            <div class="hero-stat"><span>${t.hero.week}</span><b class="num" data-s="week">-</b></div>
            <div class="hero-stat"><span>${t.hero.hoods}</span><b class="num">${lists().hoods.filter((h) => !h.hidden).length}</b></div>
          </div>
        </div>
        <div class="searchbox" style="margin:12px 0 10px">${I.search}<input type="search" id="q" enterkeyhint="search" placeholder="${esc(t.search)}" value="${esc(state.filters.q)}" dir="auto"></div>
        <div class="section-title"><span id="count"></span><span class="spacer"></span><button class="linkbtn" id="savesearch" hidden>${I.bell} ${t.saveSearch}</button></div>
        <div class="feed" id="feed"></div>
        <div id="more" style="text-align:center;margin-top:14px"></div>
      </div>
    </div>`;
  bindFilterClicks(document);
  let timer;
  $('#q').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { state.filters.q = e.target.value; refresh(true); }, 350); };
  $('#savesearch').onclick = saveSearch;
  stats().then((s) => { if (s && root === el) { $('[data-s="active"]', el).textContent = s.active; $('[data-s="week"]', el).textContent = s.week; } });
  await load(true);
}

// Re-render the filter widgets in place and reload the list.
function refresh(reload = true) {
  if (!root) return;
  $('#filterbar').innerHTML = chipRow();
  const side = $('#sidefilters'); if (side) side.innerHTML = filterPanel();
  if ($('#sheet [data-filtersheet]')) openFilters();
  bindFilterClicks(document);
  if (reload) load(true);
}

async function load(reset) {
  const t = T();
  const gen = reset ? ++page.gen : page.gen;
  if (reset) page = { items: [], cursor: null, loading: false, gen };
  page.loading = true;
  const feed = $('#feed'), more = $('#more');
  if (reset) feed.innerHTML = Array.from({ length: 6 }, () => '<div class="item sk-card"><div class="pic sk"></div><div class="info"><div class="sk line"></div><div class="sk line" style="width:60%"></div></div></div>').join('');
  more.innerHTML = '';
  try {
    const [res, promo] = await Promise.all([feedPage(state.filters, page.cursor), reset && !anyFilter() ? promoted() : Promise.resolve([])]);
    if (gen !== page.gen) return;
    const seen = new Set(page.items.map((x) => x.id));
    const promoIds = new Set(promo.map((p) => p.id));
    const fresh = [...promo.filter((p) => !seen.has(p.id)), ...res.items.filter((x) => !seen.has(x.id) && !promoIds.has(x.id))];
    page.items.push(...fresh);
    page.cursor = res.cursor;
    if (reset) feed.innerHTML = '';
    feed.insertAdjacentHTML('beforeend', fresh.map(card).join(''));
    if (!page.items.length) feed.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">${anyFilter() ? '🔍' : '☀️'}</div>${anyFilter() ? t.empty : t.emptyAll}</div>`;
    $('#count').innerHTML = page.items.length ? `<span class="num">${page.items.length}${page.cursor ? '+' : ''}</span> ${t.results}` : '';
    $('#savesearch').hidden = !anyFilter();
    if (page.cursor) {
      more.innerHTML = `<button class="btn secondary" id="loadmore">${t.loadMore}</button>`;
      $('#loadmore').onclick = () => load(false);
    }
  } catch (e) {
    console.error(e);
    if (gen === page.gen) feed.innerHTML = `<div class="empty" style="grid-column:1/-1">${navigator.onLine ? esc(e.message) : t.offline}</div>`;
  } finally {
    page.loading = false;
  }
}

async function saveSearch() {
  const t = T();
  if (!(await requireLogin())) return;
  const saved = [...((state.profile && state.profile.saved) || [])];
  const f = {};
  for (const k of KEYS) if (state.filters[k]) f[k] = state.filters[k];
  if (state.filters.free) f.free = true;
  if (state.filters.q.trim()) f.q = state.filters.q.trim();
  saved.unshift({ id: Math.random().toString(36).slice(2, 10), f, seenAt: Date.now() });
  const next = saved.slice(0, 10);
  await saveProfile(state.user.uid, { saved: next });
  state.profile = { ...(state.profile || {}), saved: next };
  toast(t.savedOk);
}

// For the saved-search row in "Mine": apply it and open the feed.
export function applySaved(s) {
  Object.assign(state.filters, { cat: null, who: null, age: null, cond: null, source: null, hood: null, free: false, q: '' }, s.f);
  persistFilters();
  go('feed');
}
