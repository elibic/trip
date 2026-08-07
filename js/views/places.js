import { el, clear, openModal, toast } from '../ui.js';
import { addStop, updateStop, currentTrip, tripDays, fmtDay } from '../store.js';
import {
  CATEGORIES, searchPlaces, nearbyPlaces, fmtDistance,
  googleEmbedUrl, googleMapsUrl,
} from '../places.js';

/* מסך חיפוש מקומות עם מפת גוגל מוטמעת.
   pickFor (אופציונלי): { dayKey, stopId } — עדכון מיקום לעצירה קיימת במקום הוספה חדשה. */
export function openPlaceSearch({ tripId, trip, dayKey, pickFor }) {
  const days = tripDays(trip.meta);
  let targetDay = dayKey || days[0];
  let anchor = firstKnownPoint(trip, dayKey);  // נקודת ייחוס לחיפוש "באזור"
  let selected = null;
  let activeCat = null;

  /* ---------- אלמנטים ---------- */

  const daySelect = el('select', { class: 'day-select', onchange: (e) => { targetDay = e.target.value; } },
    days.map((d) => el('option', { value: d, selected: d === targetDay }, fmtDay(d))));

  const searchInput = el('input', {
    type: 'search', placeholder: 'חפשו מקום או אזור — למשל: חוף גופרה, טבריה',
    enterkeyhint: 'search', autocomplete: 'off',
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); runSearch(); }
  });

  const chipsRow = el('div', { class: 'map-chips' },
    CATEGORIES.map((cat) => el('button', {
      class: 'map-chip', dataset: { key: cat.key },
      onclick: () => runNearby(cat),
    }, cat.label)));

  const mapBox = el('div', { class: 'map-box' });
  const listBox = el('div', { class: 'places-list' });
  const statusBox = el('div', { class: 'places-status' });

  const { close } = openModal(null, el('div', { class: 'map-screen' },
    el('div', { class: 'map-head' },
      el('button', { class: 'icon-btn', 'aria-label': 'סגירה', onclick: () => close() }, '✕'),
      el('div', { class: 'title' }, pickFor ? 'בחירת מיקום' : 'חיפוש מקומות'),
      pickFor ? null : daySelect,
    ),
    el('div', { class: 'map-search' }, searchInput,
      el('button', { class: 'btn small', onclick: runSearch }, '🔍')),
    chipsRow,
    mapBox,
    statusBox,
    listBox,
  ), { className: 'full' });

  showMap(anchor);
  renderIdleHint();

  /* ---------- פעולות ---------- */

  async function runSearch() {
    const q = searchInput.value.trim();
    if (!q) { toast('מה לחפש? 🙂'); return; }
    searchInput.blur();
    setActiveChip(null);
    setStatus('spinner', `מחפשים "${q}"…`);
    try {
      const results = await searchPlaces(q, anchor);
      if (!results.length) { setStatus('empty', `לא נמצאו תוצאות עבור "${q}"`); clear(listBox); return; }
      anchor = { lat: results[0].lat, lng: results[0].lng };
      select(results[0]);
      renderResults(results, { showDistance: false });
      setStatus(null);
    } catch {
      setStatus('error', 'החיפוש נכשל — בדקו את החיבור לאינטרנט ונסו שוב');
    }
  }

  async function runNearby(cat) {
    if (!anchor) {
      setStatus('hint', 'קודם חפשו אזור (למשל "טבריה") ואז בחרו קטגוריה');
      searchInput.focus();
      return;
    }
    setActiveChip(cat.key);
    setStatus('spinner', `מחפשים ${cat.label} ברדיוס 5 ק״מ…`);
    try {
      const results = await nearbyPlaces(cat, anchor);
      renderResults(results, { showDistance: true });
      setStatus(results.length ? null : 'empty', results.length ? '' : `לא נמצאו ${cat.label} באזור הזה`);
    } catch {
      setStatus('error', 'החיפוש באזור נכשל — נסו שוב בעוד רגע');
    }
  }

  function select(place) {
    selected = place;
    showMap(place);
    mapBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function addPlace(place) {
    if (pickFor) {
      await updateStop(tripId, pickFor.dayKey, pickFor.stopId, {
        place: place.name, lat: place.lat, lng: place.lng,
      });
      toast('המיקום עודכן 📍');
      close();
      return;
    }
    const stops = currentTrip()?.itinerary?.[targetDay]?.stops || {};
    const maxOrder = Math.max(0, ...Object.values(stops).map((s) => s.order || 0));
    await addStop(tripId, targetDay, {
      title: place.name, place: place.name,
      lat: place.lat, lng: place.lng, order: maxOrder + 10,
    });
    toast(`"${place.name}" נוסף ל${fmtDay(targetDay)} ✅`);
  }

  /* ---------- תצוגה ---------- */

  function showMap(place) {
    clear(mapBox);
    if (!place) {
      mapBox.append(el('div', { class: 'map-placeholder' },
        el('div', { style: 'font-size:38px' }, '🗺️'),
        el('div', {}, 'חפשו מקום כדי לראות אותו על המפה')));
      return;
    }
    mapBox.append(
      el('iframe', {
        src: googleEmbedUrl(place), title: 'מפה', loading: 'lazy',
        referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: true,
      }),
      place.name ? el('div', { class: 'map-caption' },
        el('span', { class: 'nm' }, `📍 ${place.name}`),
        el('a', { href: googleMapsUrl(place), target: '_blank', rel: 'noopener' }, 'פתיחה בגוגל מפות ↗'),
      ) : null,
    );
  }

  function renderResults(results, { showDistance }) {
    clear(listBox);
    for (const place of results) {
      listBox.append(el('div', { class: 'place-row' },
        el('button', { class: 'grow', onclick: () => select(place) },
          el('div', { class: 'name' }, place.name),
          el('div', { class: 'sub' },
            showDistance && place.distance != null ? `${fmtDistance(place.distance)} · ` : '',
            place.address || ''),
        ),
        el('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); addPlace(place); } },
          pickFor ? 'בחירה' : '＋ הוספה'),
      ));
    }
  }

  function renderIdleHint() {
    clear(listBox);
    listBox.append(el('p', { class: 'list-hint' },
      '💡 חפשו מקום בשמו, או חפשו אזור (עיר/יישוב) ואז בחרו קטגוריה כדי לגלות מה יש בסביבה.'));
  }

  function setActiveChip(key) {
    activeCat = key;
    chipsRow.querySelectorAll('.map-chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.key === key);
    });
  }

  function setStatus(kind, message) {
    clear(statusBox);
    if (!kind) return;
    if (kind === 'spinner') {
      statusBox.append(el('div', { class: 'status-line' }, el('span', { class: 'mini-spinner' }), message));
    } else {
      statusBox.append(el('div', { class: `status-line ${kind}` }, message));
    }
  }
}

/* נקודת ייחוס התחלתית: עצירה קיימת עם קואורדינטות */
function firstKnownPoint(trip, dayKey) {
  const days = dayKey ? [dayKey, ...Object.keys(trip.itinerary || {})] : Object.keys(trip.itinerary || {});
  for (const day of days) {
    for (const stop of Object.values(trip.itinerary?.[day]?.stops || {})) {
      if (stop.lat && stop.lng) return { lat: stop.lat, lng: stop.lng };
    }
  }
  return null;
}
