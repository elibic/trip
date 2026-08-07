import { el, openModal, confirmDialog, toast, famChip, quickAddRow } from '../ui.js';
import {
  addGearItem, updateGearItem, deleteGearItem,
  setGearChecked, claimShared, setPacked,
} from '../store.js';

export function renderGear(view, ctx) {
  const { tripId, trip, myFamilyId } = ctx;
  const families = trip.families || {};
  const gear = Object.entries(trip.gear || {})
    .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));

  const shared = gear.filter(([, g]) => g.type === 'shared');
  const perFamily = gear.filter(([, g]) => g.type !== 'shared');

  /* ----- ציוד משותף ----- */
  view.append(el('div', { class: 'section-title' }, '🤝 ציוד משותף',
    el('span', { class: 'hint' }, 'משפחה אחת מביאה עבור כולם')));

  const sharedCard = el('div', { class: 'card' });
  for (const [itemId, item] of shared) sharedCard.append(sharedRow(itemId, item));
  sharedCard.append(quickAddRow(`gear-shared-${tripId}`, {
    placeholder: 'מנגל, צידנית גדולה…',
    onAdd: (name) => addGearItem(tripId, { name, type: 'shared' }),
  }));
  view.append(sharedCard);

  /* ----- ציוד אישי ----- */
  view.append(el('div', { class: 'section-title' }, '👨‍👩‍👧‍👦 כל משפחה מביאה לעצמה',
    el('span', { class: 'hint' }, 'סמנו כשארזתם')));

  const perFamilyCard = el('div', { class: 'card' });
  for (const [itemId, item] of perFamily) perFamilyCard.append(perFamilyRow(itemId, item));
  perFamilyCard.append(quickAddRow(`gear-per-${tripId}`, {
    placeholder: 'אוהל, שק"שים…',
    onAdd: (name) => addGearItem(tripId, { name, type: 'perFamily' }),
  }));
  view.append(perFamilyCard);

  if (gear.length === 0) {
    view.append(el('p', { class: 'list-hint' },
      '💡 כותבים פריט ולוחצים Enter — אפשר להמשיך לכתוב עוד. גם הדבקה של רשימה שלמה עובדת.'));
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

    return el('div', { class: 'list-item' },
      el('div', { class: 'grow' },
        el('div', { class: 'name', style: item.packed ? 'text-decoration:line-through;opacity:.6' : '' },
          item.name),
        subLine(item, isMine ? 'אתם מביאים 💪' : (respFam && item.packed ? '✓ נארז' : null)),
      ),
      action,
      menuBtn(itemId, item),
    );
  }

  function perFamilyRow(itemId, item) {
    const checked = item.checked || {};
    const myChecked = !!checked[myFamilyId];
    const famIds = Object.keys(families);
    const doneCount = famIds.filter((id) => checked[id]).length;

    const dots = el('span', { class: 'dots' },
      famIds.map((id) => el('span', {
        class: `dot${checked[id] ? ' on' : ''}`,
        style: `background:${families[id].color}`,
        title: families[id].name,
      })),
    );

    return el('div', { class: 'list-item' },
      el('button', {
        class: `bigcheck${myChecked ? ' on' : ''}`, 'aria-label': 'ארזנו',
        onclick: () => setGearChecked(tripId, itemId, myFamilyId, !myChecked),
      }, '✓'),
      el('div', { class: 'grow' },
        el('div', { class: 'name', style: myChecked ? 'text-decoration:line-through;opacity:.6' : '' },
          item.name),
        el('div', { class: 'sub' },
          dots, ` ${doneCount}/${famIds.length} משפחות ארזו`,
          item.category ? ` · ${item.category}` : '',
          item.notes ? ` · ${item.notes}` : '',
        ),
      ),
      menuBtn(itemId, item),
    );
  }

  function subLine(item, extra) {
    const parts = [item.category, item.notes, extra].filter(Boolean);
    return parts.length ? el('div', { class: 'sub' }, parts.join(' · ')) : null;
  }

  function menuBtn(itemId, item) {
    return el('button', {
      class: 'iconbtn-soft', 'aria-label': 'עריכה',
      onclick: () => openItemModal(itemId, item),
    }, '⋯');
  }

  /* ---------- מודאל עריכה (רק בלחיצה על ⋯) ---------- */

  function openItemModal(itemId, item) {
    const nameIn = el('input', { type: 'text', maxlength: 60, value: item.name || '' });
    const catIn = el('input', { type: 'text', placeholder: 'למשל: לינה, מטבח', maxlength: 30, value: item.category || '' });
    const notesIn = el('input', { type: 'text', placeholder: 'לא חובה', maxlength: 120, value: item.notes || '' });

    let type = item.type || 'perFamily';
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
      });
      return card;
    }

    const respSelect = el('select', {},
      el('option', { value: '' }, '— עדיין אין אחראי —'),
      Object.entries(families).map(([id, f]) =>
        el('option', { value: id, selected: id === item.responsibleFamilyId }, f.name)),
    );
    const respField = el('div', { class: 'field', hidden: type !== 'shared' },
      el('label', {}, 'מי אחראי?'), respSelect);

    const { close } = openModal('עריכת פריט', el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'שם הפריט'), nameIn),
      el('div', { class: 'field' }, el('label', {}, 'סוג הפריט'), radios),
      respField,
      el('div', { class: 'field' }, el('label', {}, 'קטגוריה'), catIn),
      el('div', { class: 'field' }, el('label', {}, 'הערה'), notesIn),
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
        category: catIn.value.trim() || null,
        notes: notesIn.value.trim() || null,
      };
      if (type === 'shared') {
        fields.responsibleFamilyId = respSelect.value || null;
        if (!respSelect.value) fields.packed = null;
        if (item.type !== 'shared') fields.checked = null;
      } else {
        fields.responsibleFamilyId = null;
        fields.packed = null;
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
