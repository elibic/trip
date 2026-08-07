import { el, openModal, emptyState, toast } from '../ui.js';
import { createTrip, fmtRange } from '../store.js';

export function renderHome(view, { index, navigate }) {
  const trips = Object.entries(index || {})
    .sort((a, b) => (b[1].startDate || '').localeCompare(a[1].startDate || ''));

  if (trips.length === 0) {
    view.append(emptyState('🏕️', 'עוד אין טיולים — צרו את הראשון!',
      el('button', { class: 'btn', onclick: openNewTripModal }, '＋ טיול חדש'),
    ));
  } else {
    for (const [id, meta] of trips) {
      view.append(el('div', {
        class: 'card tappable trip-card',
        onclick: () => navigate(`/trip/${id}`),
      },
        el('div', { class: 'emoji' }, '🏕️'),
        el('div', { class: 'grow', style: 'flex:1;min-width:0' },
          el('div', { class: 'nm' }, meta.name),
          el('div', { class: 'dates' }, fmtRange(meta)),
        ),
        el('div', { class: 'arrow' }, '‹'),
      ));
    }
    view.append(el('button', { class: 'fab no-tabs', onclick: openNewTripModal }, '＋ טיול חדש'));
  }

  function openNewTripModal() {
    const nameIn = el('input', { type: 'text', placeholder: 'למשל: טיול סוכות בגליל', maxlength: 60 });
    const startIn = el('input', { type: 'date', class: 'ltr' });
    const endIn = el('input', { type: 'date', class: 'ltr' });

    const { close } = openModal('טיול חדש 🎉', el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'שם הטיול'), nameIn),
      el('div', { class: 'field' },
        el('label', {}, 'תאריכים'),
        el('div', { class: 'row2' },
          el('div', {}, el('label', { style: 'font-weight:400;font-size:12px' }, 'מתאריך'), startIn),
          el('div', {}, el('label', { style: 'font-weight:400;font-size:12px' }, 'עד תאריך'), endIn),
        ),
      ),
      el('div', { class: 'actions' },
        el('button', { class: 'btn secondary', onclick: () => close() }, 'ביטול'),
        el('button', { class: 'btn', onclick: save }, 'יוצאים לדרך!'),
      ),
    ));

    async function save() {
      const name = nameIn.value.trim();
      if (!name) { toast('צריך לתת שם לטיול 🙂'); return; }
      if (!startIn.value) { toast('בחרו תאריך התחלה'); return; }
      let end = endIn.value || startIn.value;
      if (end < startIn.value) end = startIn.value;
      const id = await createTrip({ name, startDate: startIn.value, endDate: end });
      close();
      navigate(`/trip/${id}`);
    }
  }
}
