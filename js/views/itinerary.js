import { el, openModal, confirmDialog, toast, quickAddRow } from '../ui.js';
import { addStop, updateStop, deleteStop, swapStops, tripDays, fmtDay } from '../store.js';
import { openPlaceSearch } from './places.js';
import { wazeUrl, googleMapsUrl, googleRouteUrl } from '../places.js';

export function renderItinerary(view, ctx) {
  const { tripId, trip } = ctx;
  const days = tripDays(trip.meta);
  const itinerary = trip.itinerary || {};

  // ימים נוספים שקיימים בנתונים אך מחוץ לטווח התאריכים (למשל אחרי שינוי תאריכים)
  const extraDays = Object.keys(itinerary).filter((d) => !days.includes(d)).sort();

  view.append(el('button', {
    class: 'btn secondary block search-places-btn',
    onclick: () => openPlaceSearch({ tripId, trip, dayKey: days[0] }),
  }, '🔍 חיפוש מקומות על המפה'));

  for (const dayKey of [...days, ...extraDays]) {
    view.append(dayCard(dayKey));
  }

  function dayCard(dayKey) {
    const stops = Object.entries(itinerary[dayKey]?.stops || {})
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

    const routeUrl = googleRouteUrl(stops.map(([, s]) => s));

    const card = el('div', { class: 'card day-card' },
      el('div', { class: 'day-head' },
        el('span', { class: 'd' }, `📅 ${fmtDay(dayKey)}`),
        routeUrl ? el('a', {
          class: 'btn ghost small', href: routeUrl, target: '_blank', rel: 'noopener',
        }, '🧭 מסלול היום') : null,
        el('button', {
          class: 'btn ghost small',
          onclick: () => openPlaceSearch({ tripId, trip, dayKey }),
        }, '🔍 מפה'),
      ),
    );

    stops.forEach(([stopId, stop], i) => {
      card.append(stopRow(dayKey, stopId, stop, i, stops));
    });

    card.append(quickAddRow(`stop-${tripId}-${dayKey}`, {
      placeholder: 'הוספת עצירה…',
      onAdd: (title) => {
        const maxOrder = stops.length ? Math.max(...stops.map(([, s]) => s.order || 0)) : 0;
        return addStop(tripId, dayKey, { title, order: maxOrder + 10 });
      },
    }));

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

    const { close } = openModal(`עריכת עצירה · ${fmtDay(dayKey)}`, el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'לאן הולכים?'), titleIn),
      el('div', { class: 'field' }, el('label', {}, 'שעה (לא חובה)'), timeIn),
      el('div', { class: 'field' }, el('label', {}, 'מיקום'), locationLine),
      el('div', { class: 'field' }, el('label', {}, 'הערות'), notesIn),
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
