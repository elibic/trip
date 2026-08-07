import { el, openModal, confirmDialog, toast, famChip, quickAddRow } from '../ui.js';
import {
  addGearItem, updateGearItem, deleteGearItem,
  setGearChecked, claimShared, setPacked,
} from '../store.js';
import {
  GEAR_CATEGORIES, knownCategories, groupByCategory, categoryChip,
} from '../categories.js';

// הקטגוריה והמצב הפרטי שנבחרו לשורת ההוספה — נשמרים בין רינדורים
const addState = {
  shared: { category: null },
  perFamily: { category: null, isPrivate: false },
};

export function renderGear(view, ctx) {
  const { tripId, trip, myFamilyId } = ctx;
  const families = trip.families || {};

  const all = Object.entries(trip.gear || {})
    .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));

  // פריטים פרטיים גלויים רק למשפחה שרשמה אותם
  const visible = all.filter(([, g]) => !g.private || g.ownerFamilyId === myFamilyId);
  const categories = knownCategories(visible);

  renderSection({
    type: 'shared',
    items: visible.filter(([, g]) => g.type === 'shared'),
    title: '🤝 ציוד משותף',
    hint: 'משפחה אחת מביאה עבור כולם',
    placeholder: 'מנגל, צידנית גדולה…',
    row: sharedRow,
  });

  renderSection({
    type: 'perFamily',
    items: visible.filter(([, g]) => g.type !== 'shared'),
    title: '👨‍👩‍👧‍👦 כל משפחה מביאה לעצמה',
    hint: 'סמנו כשארזתם',
    placeholder: 'אוהל, שק"שים…',
    row: perFamilyRow,
  });

  if (all.length === 0) {
    view.append(el('p', { class: 'list-hint' },
      '💡 כותבים פריט ולוחצים Enter — אפשר להמשיך לכתוב עוד. ',
      'בכפתור הקטגוריה בוחרים לאיזו קטגוריה הפריטים החדשים ייכנסו.'));
  }

  /* ---------- מקטע ---------- */

  function renderSection({ type, items, title, hint, placeholder, row }) {
    view.append(el('div', { class: 'section-title' }, title, el('span', { class: 'hint' }, hint)));

    const card = el('div', { class: 'card' });
    const groups = groupByCategory(items);

    for (const [category, list] of groups) {
      if (groups.length > 1) {
        card.append(el('div', { class: 'cat-head' },
          el('span', { class: 'nm' }, category),
          el('span', { class: 'count' }, list.length),
        ));
      }
      for (const [itemId, item] of list) card.append(row(itemId, item));
    }

    card.append(buildAddRow({ type, placeholder }));
    view.append(card);
  }

  function buildAddRow({ type, placeholder }) {
    const st = addState[type];

    const row = quickAddRow(`gear-${type}-${tripId}`, {
      placeholder,
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

    row.append(categoryChip({
      state: st, categories, suggestions: GEAR_CATEGORIES,
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
        notes ? el('div', { class: 'sub' }, notes) : null,
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
        el('span', { class: 'private-badge' }, '🔒 פרטי'),
        item.notes ? ` · ${item.notes}` : '');
    } else {
      const famIds = Object.keys(families);
      const doneCount = famIds.filter((id) => checked[id]).length;
      sub = el('div', { class: 'sub' },
        el('span', { class: 'dots' },
          famIds.map((id) => el('span', {
            class: `dot${checked[id] ? ' on' : ''}`,
            style: `background:${families[id].color}`,
            title: families[id].name,
          }))),
        ` ${doneCount}/${famIds.length} משפחות ארזו`,
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

