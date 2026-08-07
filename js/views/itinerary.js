import { el, openModal, confirmDialog, toast } from '../ui.js';
import {
  updateStop, deleteStop, swapStops, moveStop,
  tripDays, fmtDay, dayLabel, IDEAS_DAY,
} from '../store.js';
import { openPlaceSearch } from './places.js';
import { wazeUrl, googleMapsUrl, googleRouteUrl } from '../places.js';

export function renderItinerary(view, ctx) {
  const { tripId, trip } = ctx;
  const days = tripDays(trip.meta);
  const itinerary = trip.itinerary || {};

  // ימים נוספים שקיימים בנתונים אך מחוץ לטווח התאריכים (למשל אחרי שינוי תאריכים)
  const extraDays = Object.keys(itinerary)
    .filter((d) => d !== IDEAS_DAY && !days.includes(d)).sort();

  view.append(ideasCard());

  for (const dayKey of [...days, ...extraDays]) {
    view.append(dayCard(dayKey));
  }

  /* ---------- רעיונות (בלי שיוך ליום) ---------- */

  function ideasCard() {
    const stops = sortedStops(IDEAS_DAY);

    const card = el('div', { class: 'card day-card ideas-card' },
      el('div', { class: 'day-head ideas' }, el('span', { class: 'd' }, '💡 רעיונות')),
      el('div', { class: 'ideas-hint' },
        'מקומות שאתם שוקלים — בלי לשייך ליום. אפשר לשבץ ליום בכל שלב.'),
    );

    for (const [stopId, stop] of stops) card.append(ideaRow(stopId, stop));
    card.append(addRow(IDEAS_DAY, 'הוספת רעיון…'));

    return card;
  }

  function ideaRow(stopId, stop) {
    const target = { name: stop.place || stop.title, lat: stop.lat, lng: stop.lng };
    return el('div', { class: 'idea-row' },
      el('div', { class: 'grow' },
        el('div', { class: 't' }, stop.lat && stop.lng ? '📍 ' : '', stop.title),
        stop.notes ? el('div', { class: 'n' }, stop.notes) : null,
        el('div', { class: 'navlinks' },
          el('a', { class: 'navlink waze', target: '_blank', rel: 'noopener', href: wazeUrl(target) }, '🚗 Waze'),
          el('a', { class: 'navlink', target: '_blank', rel: 'noopener', href: googleMapsUrl(target) }, '📍 מפות'),
        ),
      ),
      el('div', { class: 'idea-actions' },
        el('button', {
          class: 'btn small', onclick: () => openMoveModal(IDEAS_DAY, stopId, stop),
        }, '📅 שיבוץ'),
        el('button', {
          class: 'iconbtn-soft', 'aria-label': 'עריכה',
          onclick: () => openStopModal(IDEAS_DAY, stopId, stop),
        }, '⋯'),
      ),
    );
  }

  /* ---------- שיבוץ / העברה ---------- */

  function openMoveModal(fromDay, stopId, stop) {
    const targets = [...days, ...extraDays].filter((d) => d !== fromDay);
    const list = el('div', { class: 'fam-list', style: 'max-width:none' },
      targets.map((d) => el('button', { class: 'fam-pick', onclick: () => move(d) },
        el('span', { style: 'flex:1;text-align:start' }, fmtDay(d)))),
      fromDay !== IDEAS_DAY
        ? el('button', { class: 'fam-pick', onclick: () => move(IDEAS_DAY) },
            el('span', { style: 'flex:1;text-align:start' }, '💡 החזרה לרעיונות'))
        : null,
    );

    const { close } = openModal(`לאיזה יום לשבץ את "${stop.title}"?`, list);

    async function move(toDay) {
      close();
      await moveStop(tripId, fromDay, toDay, stopId, stop, nextOrder(sortedStops(toDay)));
      toast(`"${stop.title}" שובץ ל${dayLabel(toDay)} ✅`);
    }
  }

  /* שורת ההוספה — נפתחת ישר במפה עם המקומות שבאזור */
  function addRow(dayKey, label) {
    return el('button', {
      class: 'add-row add-row-btn',
      onclick: () => openPlaceSearch({ tripId, trip, dayKey }),
    },
      el('span', { class: 'plus' }, '＋'),
      el('span', { class: 'add-label' }, label),
      el('span', { class: 'map-hint' }, '🗺️'),
    );
  }

  function sortedStops(dayKey) {
    return Object.entries(itinerary[dayKey]?.stops || {})
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  }

  function nextOrder(stops) {
    return (stops.length ? Math.max(...stops.map(([, s]) => s.order || 0)) : 0) + 10;
  }

  function dayCard(dayKey) {
    const stops = sortedStops(dayKey);
    const routeUrl = googleRouteUrl(stops.map(([, s]) => s));

    const card = el('div', { class: 'card day-card' },
      el('div', { class: 'day-head' },
        el('span', { class: 'd' }, `📅 ${fmtDay(dayKey)}`),
        routeUrl ? el('a', {
          class: 'btn ghost small', href: routeUrl, target: '_blank', rel: 'noopener',
        }, '🧭 מסלול היום') : null,
      ),
    );

    stops.forEach(([stopId, stop], i) => {
      card.append(stopRow(dayKey, stopId, stop, i, stops));
    });

    card.append(addRow(dayKey, 'הוספת עצירה…'));

    return card;
  }

  function stopRow(dayKey, stopId, stop, i, stops) {
    const target = { name: stop.place || stop.title, lat: stop.lat, lng: stop.lng };
    const pinned = !!(stop.lat && stop.lng);

    return el('div', { class: 'stop' },
      el('div', { class: `time${stop.time ? '' : ' none'}` }, stop.time || '—'),
      el('div', { class: 'grow' },
        el('div', { class: 't' }, pinned ? '📍 ' : '', stop.title),
        stop.notes ? el('div', { class: 'n' }, stop.notes) : null,
        el('div', { class: 'navlinks' },
          el('a', { class: 'navlink waze', target: '_blank', rel: 'noopener', href: wazeUrl(target) },
            '🚗 Waze'),
          el('a', { class: 'navlink', target: '_blank', rel: 'noopener', href: googleMapsUrl(target) },
            '📍 מפות'),
          pinned ? null : el('button', {
            class: 'navlink pick', title: 'סימון המיקום המדויק במפה',
            'aria-label': 'סימון המיקום המדויק במפה',
            onclick: () => openPlaceSearch({ tripId, trip, dayKey, pickFor: { dayKey, stopId } }),
          }, '🎯'),
        ),
      ),
      el('div', { class: 'side' },
        el('button', {
          disabled: i === 0, 'aria-label': 'הזזה למעלה',
          onclick: () => swapStops(tripId, dayKey, stopId, stop.order || 0, stops[i - 1][0], stops[i - 1][1].order || 0),
        }, '▲'),
        el('button', {
          class: 'edit', 'aria-label': 'עריכה',
          onclick: () => openStopModal(dayKey, stopId, stop),
        }, '✎'),
        el('button', {
          disabled: i === stops.length - 1, 'aria-label': 'הזזה למטה',
          onclick: () => swapStops(tripId, dayKey, stopId, stop.order || 0, stops[i + 1][0], stops[i + 1][1].order || 0),
        }, '▼'),
      ),
    );
  }

  function openStopModal(dayKey, stopId, stop) {
    const titleIn = el('input', { type: 'text', maxlength: 80, value: stop.title || '' });
    const timeIn = el('input', { type: 'time', class: 'ltr', value: stop.time || '' });
    const notesIn = el('textarea', { placeholder: 'למשל: להביא מצופים, יש צל', maxlength: 300 }, stop.notes || '');

    const locationLine = stop.lat && stop.lng
      ? el('div', { class: 'loc-line' }, `📍 ${stop.place || 'מיקום מסומן'}`,
          el('button', { class: 'btn ghost small', onclick: pickLocation }, 'שינוי'))
      : el('button', { class: 'btn secondary block', onclick: pickLocation }, '🗺️ בחירת מיקום מדויק במפה');

    const { close } = openModal(`עריכה · ${dayLabel(dayKey)}`, el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'לאן הולכים?'), titleIn),
      dayKey === IDEAS_DAY ? null
        : el('div', { class: 'field' }, el('label', {}, 'שעה (לא חובה)'), timeIn),
      el('div', { class: 'field' }, el('label', {}, 'מיקום'), locationLine),
      el('div', { class: 'field' }, el('label', {}, 'הערות'), notesIn),
      el('div', { class: 'field' },
        el('label', {}, dayKey === IDEAS_DAY ? 'שיבוץ ליום' : 'העברה ליום אחר'),
        el('button', {
          class: 'btn secondary block',
          onclick: () => { close(); openMoveModal(dayKey, stopId, stop); },
        }, dayKey === IDEAS_DAY ? '📅 בחירת יום' : '📅 העברה ליום אחר')),
      el('div', { class: 'actions' },
        el('button', { class: 'btn danger-text', onclick: del }, 'מחיקה'),
        el('button', { class: 'btn secondary', onclick: () => close() }, 'ביטול'),
        el('button', { class: 'btn', onclick: save }, 'שמירה'),
      ),
    ));

    function pickLocation() {
      close();
      openPlaceSearch({ tripId, trip, dayKey, pickFor: { dayKey, stopId } });
    }

    async function save() {
      const title = titleIn.value.trim();
      if (!title) { toast('לאן הולכים? צריך שם לעצירה 🙂'); return; }
      await updateStop(tripId, dayKey, stopId, {
        title,
        time: timeIn.value || null,
        notes: notesIn.value.trim() || null,
      });
      close();
    }

    async function del() {
      close();
      if (await confirmDialog(`למחוק את "${stop.title}"?`)) {
        deleteStop(tripId, dayKey, stopId);
        toast('העצירה נמחקה');
      }
    }
  }
}
