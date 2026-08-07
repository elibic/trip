import {
  el, openModal, confirmDialog, toast, famChip, quickAddRow, addFab, focusQuickAdd,
} from '../ui.js';
import {
  addGearItem, updateGearItem, deleteGearItem,
  setGearChecked, claimShared, setPacked,
} from '../store.js';
import {
  GEAR_CATEGORIES, knownCategories, groupByCategory,
  rowCategoryChip, addTargetChip, categoryAddButton,
} from '../categories.js';

// הקטגוריה והמצב הפרטי שנבחרו לשורת ההוספה — נשמרים בין רינדורים
const addState = {
  shared: { category: null },
  perFamily: { category: null, isPrivate: false },
};

/* טאב "ציוד אישי" — מה שכל משפחה מביאה לעצמה */
export function renderPersonalGear(view, ctx) {
  renderGearList(view, ctx, {
    type: 'perFamily',
    hint: '👨‍👩‍👧‍👦 כל משפחה מביאה לעצמה — סמנו כשארזתם',
    placeholder: 'אוהל, שק"שים…',
    emptyHint: '💡 כותבים פריט ולוחצים Enter — אפשר להמשיך לכתוב עוד. '
      + 'בכפתור הקטגוריה שליד השדה בוחרים לאן ייכנסו הפריטים החדשים, '
      + 'ובכפתור 🔒 מסמנים פריט שרק אתם תראו.',
  });
}

/* טאב "ציוד לכולם" — פריטים שמשפחה אחת מביאה עבור כולם */
export function renderSharedGear(view, ctx) {
  renderGearList(view, ctx, {
    type: 'shared',
    hint: '🤝 משפחה אחת מביאה עבור כולם — לחצו "אנחנו נביא!"',
    placeholder: 'מנגל, צידנית גדולה…',
    emptyHint: '💡 כותבים פריט ולוחצים Enter. כל משפחה יכולה לקחת על עצמה פריטים '
      + 'בכפתור "אנחנו נביא!", וכולם רואים מי אחראי על מה.',
  });
}

function renderGearList(view, ctx, opts) {
  const { tripId, trip, myFamilyId } = ctx;
  const { type, hint, placeholder, emptyHint } = opts;
  const families = trip.families || {};

  const all = Object.entries(trip.gear || {})
    .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));

  // פריטים פרטיים גלויים רק למשפחה שרשמה אותם
  const visible = all.filter(([, g]) => !g.private || g.ownerFamilyId === myFamilyId);
  const categories = knownCategories(visible);

  const items = type === 'shared'
    ? visible.filter(([, g]) => g.type === 'shared')
    : visible.filter(([, g]) => g.type !== 'shared');
  const row = type === 'shared' ? sharedRow : perFamilyRow;
  const addKey = `gear-${type}-${tripId}`;

  view.append(el('div', { class: 'tab-hint' }, hint));

  const card = el('div', { class: 'card' });
  card.append(buildAddRow({ type, placeholder }));   // ההוספה בראש — לא צריך לגלול

  const groups = groupByCategory(items);
  for (const [category, list] of groups) {
    if (groups.length > 1) {
      card.append(el('div', { class: 'cat-head' },
        el('span', { class: 'nm' }, category),
        el('span', { class: 'count' }, list.length),
        categoryAddButton(category, startAddingTo),
      ));
    }
    for (const [itemId, item] of list) card.append(row(itemId, item));
  }
  view.append(card);

  if (items.length === 0) view.append(el('p', { class: 'list-hint' }, emptyHint));
  else view.append(addFab(addKey, 'פריט'));

  // בחירת קטגוריה יעד להוספה — מרנדר מחדש וקופץ לשדה
  function startAddingTo(category) {
    addState[type].category = category;
    ctx.refresh();
    focusQuickAdd(addKey);
  }

  function buildAddRow({ type, placeholder }) {
    const st = addState[type];

    const row = quickAddRow(addKey, {
      placeholder: st.category ? `הוספה ל${st.category}…` : placeholder,
      onAdd: (name) => addGearItem(tripId, {
        name, type,
        category: st.category || null,
        ...(type === 'perFamily' && st.isPrivate
          ? { private: true, ownerFamilyId: myFamilyId }
          : {}),
      }),
    });

    if (type === 'perFamily') {
      const lock = el('button', {
        class: `lock-btn${st.isPrivate ? ' on' : ''}`,
        title: 'פריט פרטי — רק המשפחה שלכם תראה אותו',
        'aria-label': 'פריט פרטי',
        onclick: () => {
          st.isPrivate = !st.isPrivate;
          lock.classList.toggle('on', st.isPrivate);
          toast(st.isPrivate
            ? '🔒 הפריטים הבאים יהיו פרטיים — רק אתם תראו אותם'
            : 'הפריטים הבאים יהיו גלויים לכל המשפחות');
        },
      }, '🔒');
      row.append(lock);
    }

    row.append(addTargetChip({
      state: st, categories, suggestions: GEAR_CATEGORIES,
      onChange: () => { ctx.refresh(); focusQuickAdd(addKey); },
    }));

    return row;
  }

  /* ---------- שורות ---------- */

  function sharedRow(itemId, item) {
    const respFam = item.responsibleFamilyId && families[item.responsibleFamilyId];
    const isMine = item.responsibleFamilyId === myFamilyId;

    let action;
    if (!respFam) {
      action = el('button', {
        class: 'btn small', style: 'background:var(--accent)',
        onclick: () => claimShared(tripId, itemId, myFamilyId),
      }, 'אנחנו נביא!');
    } else if (isMine) {
      action = el('button', {
        class: `bigcheck${item.packed ? ' on' : ''}`, 'aria-label': 'נארז',
        onclick: () => setPacked(tripId, itemId, !item.packed),
      }, '✓');
    } else {
      action = famChip(respFam);
    }

    const extra = isMine ? 'אתם מביאים 💪' : (respFam && item.packed ? '✓ נארז' : null);
    const notes = [item.notes, extra].filter(Boolean).join(' · ');

    return el('div', { class: 'list-item' },
      el('div', { class: 'grow' },
        el('div', { class: 'name', style: item.packed ? 'text-decoration:line-through;opacity:.6' : '' },
          item.name),
        el('div', { class: 'sub' }, catChipFor(itemId, item), notes ? ` ${notes}` : ''),
      ),
      action,
      menuBtn(itemId, item),
    );
  }

  function perFamilyRow(itemId, item) {
    const checked = item.checked || {};
    const myChecked = !!checked[myFamilyId];

    let sub;
    if (item.private) {
      sub = el('div', { class: 'sub' },
        catChipFor(itemId, item),
        el('span', { class: 'private-badge' }, '🔒 פרטי'),
        item.notes ? ` ${item.notes}` : '');
    } else {
      const famIds = Object.keys(families);
      const doneCount = famIds.filter((id) => checked[id]).length;
      sub = el('div', { class: 'sub' },
        catChipFor(itemId, item),
        el('span', { class: 'dots' },
          famIds.map((id) => el('span', {
            class: `dot${checked[id] ? ' on' : ''}`,
            style: `background:${families[id].color}`,
            title: families[id].name,
          }))),
        ` ${doneCount}/${famIds.length}`,
        item.notes ? ` · ${item.notes}` : '',
      );
    }

    return el('div', { class: 'list-item' },
      el('button', {
        class: `bigcheck${myChecked ? ' on' : ''}`, 'aria-label': 'ארזנו',
        onclick: () => setGearChecked(tripId, itemId, myFamilyId, !myChecked),
      }, '✓'),
      el('div', { class: 'grow' },
        el('div', { class: 'name', style: myChecked ? 'text-decoration:line-through;opacity:.6' : '' },
          item.name),
        sub,
      ),
      menuBtn(itemId, item),
    );
  }

  function menuBtn(itemId, item) {
    return el('button', {
      class: 'iconbtn-soft', 'aria-label': 'עריכה',
      onclick: () => openItemModal(itemId, item),
    }, '⋯');
  }

  /* תיוג בהקשה אחת — הקטגוריה נשמרת מיד */
  function catChipFor(itemId, item) {
    return rowCategoryChip({
      itemId, item, categories, suggestions: GEAR_CATEGORIES,
      onPick: (picked) => updateGearItem(tripId, itemId, { category: picked || null }),
    });
  }

  /* ---------- מודאל עריכה ---------- */

  function openItemModal(itemId, item) {
    const nameIn = el('input', { type: 'text', maxlength: 60, value: item.name || '' });
    const notesIn = el('input', { type: 'text', placeholder: 'לא חובה', maxlength: 120, value: item.notes || '' });

    let type = item.type === 'shared' ? 'shared' : 'perFamily';
    const editCat = { category: item.category || null };
    const catChip = categoryChip({
      state: editCat, categories, suggestions: GEAR_CATEGORIES, className: 'cat-chip wide',
    });

    const privateCheck = el('input', { type: 'checkbox', checked: !!item.private });
    const privateField = el('label', { class: 'check-row', hidden: type !== 'perFamily' },
      privateCheck,
      el('span', {}, '🔒 פריט פרטי — רק המשפחה שלנו רואה אותו'),
    );

    const respSelect = el('select', {},
      el('option', { value: '' }, '— עדיין אין אחראי —'),
      Object.entries(families).map(([id, f]) =>
        el('option', { value: id, selected: id === item.responsibleFamilyId }, f.name)),
    );
    const respField = el('div', { class: 'field', hidden: type !== 'shared' },
      el('label', {}, 'מי אחראי?'), respSelect);

    const radios = el('div', { class: 'radio-cards' },
      radioCard('perFamily', '👨‍👩‍👧‍👦 כל משפחה מביאה לעצמה'),
      radioCard('shared', '🤝 פריט משותף — משפחה אחת אחראית'),
    );

    function radioCard(value, title) {
      const input = el('input', { type: 'radio', name: 'gtype', checked: type === value });
      const card = el('label', { class: `radio-card${type === value ? ' selected' : ''}` },
        input, el('div', {}, el('div', { class: 't' }, title)),
      );
      input.addEventListener('change', () => {
        type = value;
        radios.querySelectorAll('.radio-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        respField.hidden = value !== 'shared';
        privateField.hidden = value !== 'perFamily';
      });
      return card;
    }

    const { close } = openModal('עריכת פריט', el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'שם הפריט'), nameIn),
      el('div', { class: 'field' }, el('label', {}, 'קטגוריה'), catChip),
      el('div', { class: 'field' }, el('label', {}, 'סוג הפריט'), radios),
      respField,
      privateField,
      el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'הערה'), notesIn),
      el('div', { class: 'actions' },
        el('button', { class: 'btn danger-text', onclick: del }, 'מחיקה'),
        el('button', { class: 'btn secondary', onclick: () => close() }, 'ביטול'),
        el('button', { class: 'btn', onclick: save }, 'שמירה'),
      ),
    ));

    async function save() {
      const name = nameIn.value.trim();
      if (!name) { toast('צריך שם לפריט 🙂'); return; }

      const fields = {
        name, type,
        category: editCat.category || null,
        notes: notesIn.value.trim() || null,
      };

      if (type === 'shared') {
        fields.responsibleFamilyId = respSelect.value || null;
        if (!respSelect.value) fields.packed = null;
        if (item.type !== 'shared') fields.checked = null;
        fields.private = null;
        fields.ownerFamilyId = null;
      } else {
        fields.responsibleFamilyId = null;
        fields.packed = null;
        if (privateCheck.checked) {
          fields.private = true;
          fields.ownerFamilyId = item.ownerFamilyId || myFamilyId;
        } else {
          fields.private = null;
          fields.ownerFamilyId = null;
        }
      }

      await updateGearItem(tripId, itemId, fields);
      close();
    }

    async function del() {
      close();
      if (await confirmDialog(`למחוק את "${item.name}"?`)) {
        deleteGearItem(tripId, itemId);
        toast('הפריט נמחק');
      }
    }
  }
}

