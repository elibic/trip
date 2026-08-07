import {
  el, openModal, confirmDialog, toast, famChip, quickAddRow, addFab, focusQuickAdd, flashItem,
  stripButton,
} from '../ui.js';
import {
  addShoppingItem, updateShoppingItem, deleteShoppingItem,
  setBought, claimShopping, clearBoughtItems, moveShoppingToGear, findByName, normalizeName,
} from '../store.js';
import {
  SHOPPING_CATEGORIES, knownCategories, groupByCategory, categoryChip,
  rowCategoryChip, addTargetChip, categoryAddButton,
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
  const movedCount = Object.values(trip.gear || {}).filter((g) => g.fromShopping).length;

  /* ----- סיכום ----- */
  if (items.length) {
    const pct = Math.round((boughtIds.length / items.length) * 100);
    view.append(el('div', { class: 'card shop-summary' },
      el('div', { class: 'line' },
        el('span', { class: 'nums' }, `🛒 ${items.length - boughtIds.length} נשארו · ${boughtIds.length} נקנו`),
      ),
      el('div', { class: 'bar' }, el('div', { class: 'fill', style: `width:${pct}%` })),
      movedCount
        ? el('button', {
            class: 'moved-line',
            onclick: () => ctx.navigate(`/trip/${tripId}/shared`),
          }, `📦 ${movedCount} הועברו לציוד`, el('span', { class: 'arrow' }, '‹'))
        : null,
      boughtIds.length
        ? el('div', { class: 'bought-actions' },
            el('button', { class: 'btn small', onclick: moveAllBought },
              `📦 העברת ${boughtIds.length} שנקנו לציוד`),
            el('button', { class: 'btn secondary small', onclick: clearBought }, '🧹 ניקוי'),
          )
        : null,
    ));
  }

  /* ----- הרשימה ----- */
  const addKey = `shopping-${tripId}`;
  const card = el('div', { class: 'card' });

  const addedNow = new Set();   // תופס כפילויות גם בתוך הדבקה אחת
  const addRow = quickAddRow(addKey, {
    placeholder: addState.category ? `הוספה ל${addState.category}…` : 'פיתות, גחלים, מים…',
    onAdd: (name) => {
      const existing = findByName(items, name);
      if (existing || addedNow.has(normalizeName(name))) {
        toast(`"${name}" כבר ברשימה`);
        if (existing) flashItem(existing[0]);
        return undefined;
      }
      addedNow.add(normalizeName(name));
      return addShoppingItem(tripId, { name, category: addState.category || null });
    },
  });
  addRow.append(addTargetChip({
    state: addState, categories, suggestions: SHOPPING_CATEGORIES,
    onChange: () => { ctx.refresh(); focusQuickAdd(addKey); },
  }));
  card.append(addRow);   // ההוספה בראש — לא צריך לגלול

  // בתוך כל קטגוריה: מה שעוד לא נקנה קודם
  const groups = groupByCategory(items, (a, b) =>
    (a[1].bought ? 1 : 0) - (b[1].bought ? 1 : 0) || (a[1].createdAt || 0) - (b[1].createdAt || 0));

  for (const [category, list] of groups) {
    if (groups.length > 1) {
      card.append(el('div', { class: 'cat-head' },
        el('span', { class: 'nm' }, category),
        el('span', { class: 'count' }, list.filter(([, i]) => !i.bought).length || '✓'),
        categoryAddButton(category, startAddingTo),
      ));
    }
    for (const [itemId, item] of list) card.append(itemRow(itemId, item));
  }
  view.append(card);

  if (items.length === 0 && movedCount) {
    view.append(el('button', {
      class: 'card moved-line standalone',
      onclick: () => ctx.navigate(`/trip/${tripId}/shared`),
    }, `📦 ${movedCount} הועברו לציוד`, el('span', { class: 'arrow' }, '‹')));
  }

  if (items.length === 0) {
    view.append(el('p', { class: 'list-hint' },
      '💡 כותבים מוצר ולוחצים Enter — אפשר להמשיך לכתוב עוד, וגם להדביק רשימה שלמה. ',
      'כל משפחה יכולה לקחת על עצמה מוצרים בכפתור "אנחנו נקנה".'));
  } else {
    view.append(addFab(addKey, 'מוצר'));
  }

  // בחירת קטגוריה יעד להוספה — מרנדר מחדש וקופץ לשדה
  function startAddingTo(category) {
    addState.category = category;
    ctx.refresh();
    focusQuickAdd(addKey);
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
    const catChip = rowCategoryChip({
      itemId, item, categories, suggestions: SHOPPING_CATEGORIES,
      onPick: (picked) => updateShoppingItem(tripId, itemId, { category: picked || null }),
    });

    return el('div', { class: `list-item${item.bought ? ' done' : ''}`, dataset: { id: itemId } },
      el('button', {
        class: `bigcheck${item.bought ? ' on' : ''}`, 'aria-label': 'נקנה',
        onclick: () => setBought(tripId, itemId, !item.bought),
      }, '✓'),
      el('div', { class: 'grow' },
        el('div', { class: 'name', style: item.bought ? 'text-decoration:line-through;opacity:.55' : '' },
          item.name),
        el('div', { class: 'sub' }, catChip, parts.length ? ` ${parts.join(' · ')}` : ''),
      ),
      item.bought
        ? el('button', {
            class: 'btn small to-gear', title: 'העברה לרשימת הציוד',
            onclick: () => moveOne(itemId, item),
          }, '📦 לציוד')
        : action,
      stripButton({
        key: `menu:${itemId}`,
        className: 'iconbtn-soft',
        title: 'העברה, עריכה ומחיקה',
        content: '⋯',
        chips: () => [
          { static: true, text: 'העברה אל:' },
          { label: '🛒 קניות', active: true, onPick: () => {} },
          { label: '🎒 ציוד אישי', onPick: () => moveOne(itemId, item, 'perFamily') },
          { label: '🤝 ציוד לכולם', onPick: () => moveOne(itemId, item, 'shared') },
          { label: null },
          { label: '✏️ עריכה', onPick: () => openItemModal(itemId, item) },
          { label: '🗑️ מחיקה', class: 'danger', onPick: () => removeItem(itemId, item) },
        ],
      }),
    );
  }

  async function moveOne(itemId, item, type = 'shared') {
    const dest = type === 'shared' ? 'ציוד לכולם' : 'ציוד אישי';
    const gear = Object.entries(trip.gear || {})
      .filter(([, g]) => (g.type === 'shared' ? 'shared' : 'perFamily') === type
        && (!g.private || g.ownerFamilyId === myFamilyId));
    if (findByName(gear, item.name)) { toast(`"${item.name}" כבר ב${dest}`); return; }
    await moveShoppingToGear(tripId, [[itemId, item]], type);
    toast(`"${item.name}" עבר ל${dest} 📦`);
  }

  async function removeItem(itemId, item) {
    if (await confirmDialog(`למחוק את "${item.name}" מהרשימה?`)) {
      deleteShoppingItem(tripId, itemId);
      toast('המוצר נמחק');
    }
  }

  async function moveAllBought() {
    const entries = items.filter(([id]) => boughtIds.includes(id));
    const ok = await confirmDialog(
      `להעביר ${entries.length} מוצרים שנקנו לרשימת "ציוד לכולם"? כך לא תשכחו לקחת אותם.`,
      { danger: 'העברה' });
    if (!ok) return;
    await moveShoppingToGear(tripId, entries);
    toast(`${entries.length} מוצרים עברו לציוד לכולם 📦`);
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
