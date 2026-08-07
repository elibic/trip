import { el, openModal, confirmDialog, toast, famChip, quickAddRow } from '../ui.js';
import {
  addShoppingItem, updateShoppingItem, deleteShoppingItem,
  setBought, claimShopping, clearBoughtItems,
} from '../store.js';
import {
  SHOPPING_CATEGORIES, knownCategories, groupByCategory, categoryChip,
} from '../categories.js';

// הקטגוריה שנבחרה לשורת ההוספה — נשמרת בין רינדורים
const addState = { category: null };

export function renderShopping(view, ctx) {
  const { tripId, trip, myFamilyId } = ctx;
  const families = trip.families || {};

  const items = Object.entries(trip.shopping || {})
    .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
  const categories = knownCategories(items);
  const boughtIds = items.filter(([, i]) => i.bought).map(([id]) => id);

  /* ----- סיכום ----- */
  if (items.length) {
    const pct = Math.round((boughtIds.length / items.length) * 100);
    view.append(el('div', { class: 'card shop-summary' },
      el('div', { class: 'line' },
        el('span', { class: 'nums' }, `🛒 ${items.length - boughtIds.length} נשארו · ${boughtIds.length} נקנו`),
        boughtIds.length
          ? el('button', { class: 'btn ghost small', onclick: clearBought }, '🧹 ניקוי הנקנו')
          : null,
      ),
      el('div', { class: 'bar' }, el('div', { class: 'fill', style: `width:${pct}%` })),
    ));
  }

  /* ----- הרשימה ----- */
  const card = el('div', { class: 'card' });
  // בתוך כל קטגוריה: מה שעוד לא נקנה קודם
  const groups = groupByCategory(items, (a, b) =>
    (a[1].bought ? 1 : 0) - (b[1].bought ? 1 : 0) || (a[1].createdAt || 0) - (b[1].createdAt || 0));

  for (const [category, list] of groups) {
    if (groups.length > 1) {
      card.append(el('div', { class: 'cat-head' },
        el('span', { class: 'nm' }, category),
        el('span', { class: 'count' }, list.filter(([, i]) => !i.bought).length || '✓'),
      ));
    }
    for (const [itemId, item] of list) card.append(itemRow(itemId, item));
  }

  const addRow = quickAddRow(`shopping-${tripId}`, {
    placeholder: 'פיתות, גחלים, מים…',
    onAdd: (name) => addShoppingItem(tripId, { name, category: addState.category || null }),
  });
  addRow.append(categoryChip({
    state: addState, categories, suggestions: SHOPPING_CATEGORIES,
  }));
  card.append(addRow);
  view.append(card);

  if (items.length === 0) {
    view.append(el('p', { class: 'list-hint' },
      '💡 כותבים מוצר ולוחצים Enter — אפשר להמשיך לכתוב עוד, וגם להדביק רשימה שלמה. ',
      'כל משפחה יכולה לקחת על עצמה מוצרים בכפתור "אנחנו נקנה".'));
  }

  /* ---------- שורה ---------- */

  function itemRow(itemId, item) {
    const buyer = item.buyerFamilyId && families[item.buyerFamilyId];
    const isMine = item.buyerFamilyId === myFamilyId;

    const action = buyer
      ? (isMine
          ? el('span', { class: 'chip mine' }, '🛒 אנחנו')
          : famChip(buyer))
      : el('button', {
          class: 'btn small', style: 'background:var(--accent)',
          onclick: () => claimShopping(tripId, itemId, myFamilyId),
        }, 'אנחנו נקנה');

    const parts = [item.qty, item.notes].filter(Boolean);

    return el('div', { class: `list-item${item.bought ? ' done' : ''}` },
      el('button', {
        class: `bigcheck${item.bought ? ' on' : ''}`, 'aria-label': 'נקנה',
        onclick: () => setBought(tripId, itemId, !item.bought),
      }, '✓'),
      el('div', { class: 'grow' },
        el('div', { class: 'name', style: item.bought ? 'text-decoration:line-through;opacity:.55' : '' },
          item.name),
        parts.length ? el('div', { class: 'sub' }, parts.join(' · ')) : null,
      ),
      item.bought ? null : action,
      el('button', {
        class: 'iconbtn-soft', 'aria-label': 'עריכה',
        onclick: () => openItemModal(itemId, item),
      }, '⋯'),
    );
  }

  async function clearBought() {
    if (await confirmDialog(`למחוק מהרשימה ${boughtIds.length} מוצרים שכבר נקנו?`, { danger: 'ניקוי' })) {
      await clearBoughtItems(tripId, boughtIds);
      toast('הרשימה נוקתה');
    }
  }

  /* ---------- מודאל עריכה ---------- */

  function openItemModal(itemId, item) {
    const nameIn = el('input', { type: 'text', maxlength: 60, value: item.name || '' });
    const qtyIn = el('input', { type: 'text', placeholder: 'למשל: 3 חבילות', maxlength: 30, value: item.qty || '' });
    const notesIn = el('input', { type: 'text', placeholder: 'לא חובה', maxlength: 120, value: item.notes || '' });

    const editCat = { category: item.category || null };
    const catChip = categoryChip({
      state: editCat, categories, suggestions: SHOPPING_CATEGORIES, className: 'cat-chip wide',
    });

    const buyerSelect = el('select', {},
      el('option', { value: '' }, '— עדיין אין אחראי —'),
      Object.entries(families).map(([id, f]) =>
        el('option', { value: id, selected: id === item.buyerFamilyId }, f.name)),
    );

    const { close } = openModal('עריכת מוצר', el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'מה קונים?'), nameIn),
      el('div', { class: 'field' }, el('label', {}, 'כמות'), qtyIn),
      el('div', { class: 'field' }, el('label', {}, 'קטגוריה'), catChip),
      el('div', { class: 'field' }, el('label', {}, 'מי קונה?'), buyerSelect),
      el('div', { class: 'field' }, el('label', {}, 'הערה'), notesIn),
      el('div', { class: 'actions' },
        el('button', { class: 'btn danger-text', onclick: del }, 'מחיקה'),
        el('button', { class: 'btn secondary', onclick: () => close() }, 'ביטול'),
        el('button', { class: 'btn', onclick: save }, 'שמירה'),
      ),
    ));

    async function save() {
      const name = nameIn.value.trim();
      if (!name) { toast('צריך שם למוצר 🙂'); return; }
      await updateShoppingItem(tripId, itemId, {
        name,
        qty: qtyIn.value.trim() || null,
        category: editCat.category || null,
        buyerFamilyId: buyerSelect.value || null,
        notes: notesIn.value.trim() || null,
      });
      close();
    }

    async function del() {
      close();
      if (await confirmDialog(`למחוק את "${item.name}" מהרשימה?`)) {
        deleteShoppingItem(tripId, itemId);
        toast('המוצר נמחק');
      }
    }
  }
}
