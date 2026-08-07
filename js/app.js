import * as store from './store.js';
import { el, clear, setRendering } from './ui.js';
import { initInstallBanner } from './install.js';
import { renderHome } from './views/home.js';
import { renderGate, renderFamilySwitcher } from './views/trip.js';
import { renderGear } from './views/gear.js';
import { renderShopping } from './views/shopping.js';
import { renderItinerary } from './views/itinerary.js';
import { renderMeals } from './views/meals.js';
import { renderExpenses } from './views/expenses.js';

const TABS = [
  ['gear', 'ציוד', '🎒', renderGear],
  ['shopping', 'קניות', '🛒', renderShopping],
  ['itinerary', 'מסלול', '🗺️', renderItinerary],
  ['meals', 'ארוחות', '🍽️', renderMeals],
  ['expenses', 'הוצאות', '💰', renderExpenses],
];

const topbar = document.getElementById('topbar');
const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');

const state = {
  route: { name: 'home' },   // {name:'home'} | {name:'trip', tripId, tab}
  index: undefined,          // undefined = בטעינה
  trip: undefined,
  tripId: null,
};

let unsubIndex = null;
let unsubTrip = null;

export function navigate(hash) {
  location.hash = hash;
}

/* ---------- ניתוב ---------- */

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'trip' && parts[1]) {
    const tab = TABS.some(([k]) => k === parts[2]) ? parts[2] : null;
    return { name: 'trip', tripId: parts[1], tab };
  }
  return { name: 'home' };
}

function onRouteChange() {
  state.route = parseRoute();

  if (state.route.name === 'trip') {
    const { tripId } = state.route;
    if (!state.route.tab) {
      // ללא טאב — הפניה לטאב האחרון שנצפה
      const tab = store.getLastTab(tripId) || 'gear';
      history.replaceState(null, '', `#/trip/${tripId}/${tab}`);
      state.route = { name: 'trip', tripId, tab };
    }
    store.setLastTab(tripId, state.route.tab);
    if (state.tripId !== tripId) {
      unsubTrip?.();
      state.tripId = tripId;
      state.trip = undefined;
      unsubTrip = store.subscribeTrip(tripId, (data) => {
        state.trip = data; // null = לא קיים
        render();
      });
    }
  } else {
    unsubTrip?.();
    unsubTrip = null;
    state.tripId = null;
    state.trip = undefined;
  }
  render();
}

/* ---------- רינדור ---------- */

function render() {
  setRendering(true);
  try {
    clear(topbar);
    clear(view);
    view.classList.remove('no-tabs');
    tabbar.hidden = true;

    if (state.route.name === 'home') renderHomeScreen();
    else renderTripScreen();
  } finally {
    setRendering(false);
  }
}

function renderHomeScreen() {
  view.classList.add('no-tabs');
  topbar.append(el('div', { class: 'title' }, '🏕️ טיול משפחות'));
  if (state.index === undefined) {
    view.append(el('div', { class: 'spinner' }));
    return;
  }
  renderHome(view, { index: state.index, navigate });
}

function renderTripScreen() {
  const { tripId, tab } = state.route;
  const trip = state.trip;

  const backBtn = el('button', { class: 'icon-btn', 'aria-label': 'חזרה', onclick: () => navigate('/') }, '→');

  if (trip === undefined) {
    topbar.append(backBtn, el('div', { class: 'title' }, '...'));
    view.append(el('div', { class: 'spinner' }));
    return;
  }

  if (trip === null) {
    topbar.append(backBtn, el('div', { class: 'title' }, 'טיול משפחות'));
    view.classList.add('no-tabs');
    view.append(el('div', { class: 'setup-screen' },
      el('div', { class: 'big' }, '🤔'),
      el('h1', {}, 'הטיול לא נמצא'),
      el('p', {}, 'ייתכן שהקישור שגוי או שהטיול נמחק.'),
      el('button', { class: 'btn', style: 'margin-top:14px', onclick: () => navigate('/') }, 'לרשימת הטיולים'),
    ));
    return;
  }

  const myFamilyId = store.getMyFamily(tripId);
  const families = trip.families || {};
  const myFamily = myFamilyId && families[myFamilyId];

  // שער בחירת משפחה
  if (!myFamily) {
    topbar.append(backBtn, el('div', { class: 'title' }, trip.meta?.name || 'טיול'));
    view.classList.add('no-tabs');
    renderGate(view, { tripId, trip, onPicked: render });
    return;
  }

  // מעטפת טיול מלאה
  topbar.append(
    backBtn,
    el('div', { class: 'title' }, trip.meta?.name || 'טיול',
      el('div', { class: 'subtitle' }, store.fmtRange(trip.meta)),
    ),
    el('button', {
      class: 'fam-chip-btn',
      onclick: () => renderFamilySwitcher({ tripId, trip, myFamilyId, onChanged: render }),
    },
      el('span', { class: 'dot', style: `background:${myFamily.color}` }),
      el('span', { class: 'nm' }, myFamily.name),
    ),
  );

  tabbar.hidden = false;
  clear(tabbar);
  for (const [key, label, icon] of TABS) {
    tabbar.append(el('button', {
      class: `tab${key === tab ? ' active' : ''}`,
      onclick: () => navigate(`/trip/${tripId}/${key}`),
    },
      el('span', { class: 'ico' }, icon),
      el('span', {}, label),
    ));
  }

  const renderTab = TABS.find(([k]) => k === tab)[3];
  renderTab(view, { tripId, trip, myFamilyId, navigate, refresh: render });
}

/* ---------- אתחול ---------- */

unsubIndex = store.subscribeIndex((data) => {
  state.index = data || {};
  if (state.route.name === 'home') render();
});
window.addEventListener('hashchange', onRouteChange);
onRouteChange();
initInstallBanner();
