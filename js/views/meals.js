import { el, openModal, famChip, toast } from '../ui.js';
import { setMeal, tripDays, fmtDay, MEAL_SLOTS } from '../store.js';

export function renderMeals(view, ctx) {
  const { tripId, trip } = ctx;
  const families = trip.families || {};
  const days = tripDays(trip.meta);
  const meals = trip.meals || {};

  const extraDays = Object.keys(meals).filter((d) => !days.includes(d)).sort();

  for (const dayKey of [...days, ...extraDays]) {
    const card = el('div', { class: 'card day-card' },
      el('div', { class: 'day-head' }, el('span', { class: 'd' }, `📅 ${fmtDay(dayKey)}`)),
    );

    for (const [slot, label, icon] of MEAL_SLOTS) {
      const meal = meals[dayKey]?.[slot];
      const fam = meal?.responsibleFamilyId && families[meal.responsibleFamilyId];

      card.append(el('div', {
        class: 'meal-row',
        onclick: () => openMealModal(dayKey, slot, label, meal),
      },
        el('div', { class: 'slot' }, `${icon} ${label}`),
        el('div', { class: 'grow' },
          fam || meal?.menu ? famChip(fam) : el('span', { class: 'chip warn' }, 'לא שובץ'),
          meal?.menu ? el('div', { class: 'menu' }, meal.menu) : null,
        ),
        el('span', { style: 'color:var(--text-soft)' }, '✎'),
      ));
    }

    view.append(card);
  }

  function openMealModal(dayKey, slot, label, meal) {
    const famSelect = el('select', {},
      el('option', { value: '' }, '— עדיין לא שובץ —'),
      Object.entries(families).map(([id, f]) =>
        el('option', { value: id, selected: id === meal?.responsibleFamilyId }, f.name)),
    );
    const menuIn = el('textarea', { placeholder: 'למשל: פיתות, גבינות, ירקות חתוכים', maxlength: 300 }, meal?.menu || '');
    const notesIn = el('input', { type: 'text', placeholder: 'לא חובה', maxlength: 120, value: meal?.notes || '' });

    const { close } = openModal(`ארוחת ${label} · ${fmtDay(dayKey)}`, el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'איזו משפחה אחראית?'), famSelect),
      el('div', { class: 'field' }, el('label', {}, 'מה בתפריט?'), menuIn),
      el('div', { class: 'field' }, el('label', {}, 'הערה'), notesIn),
      el('div', { class: 'actions' },
        el('button', { class: 'btn secondary', onclick: () => close() }, 'ביטול'),
        el('button', { class: 'btn', onclick: save }, 'שמירה'),
      ),
    ));

    async function save() {
      const data = {
        responsibleFamilyId: famSelect.value || null,
        menu: menuIn.value.trim() || null,
        notes: notesIn.value.trim() || null,
      };
      await setMeal(tripId, dayKey, slot, (data.responsibleFamilyId || data.menu || data.notes) ? data : null);
      close();
    }
  }
}
