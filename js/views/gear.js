import { el, openModal, confirmDialog, toast, emptyState, famChip } from '../ui.js';
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

  if (gear.length === 0) {
    view.append(emptyState('🎒', 'עוד אין פריטי ציוד. מה צריך להביא לטיול?'));
  }

  /* ----- ציוד משותף ----- */
  if (shared.length) {
    view.append(el('div', { class: 'section-title' }, '🤝 ציוד משותף',
      el('span', { class: 'hint' }, 'משפחה אחת מביאה עבור כולם')));
    const card = el('div', { class: 'card' });
    for (const [itemId, item] of shared) card.append(sharedRow(itemId, item));
    view.append(card);
  }

  /* ----- ציוד אישי ----- */
  if (perFamily.length) {
    view.append(el('div', { class: 'section-title' }, '👨‍👩‍👧‍👦 כל משפחה מביאה לעצמה',
      el('span', { class: 'hint' }, 'סמנו כשארזתם')));
    const card = el('div', { class: 'card' });
    for (const [itemId, item] of perFamily) card.append(perFamilyRow(itemId, item));
    view.append(card);
  }

  view.append(el('button', { class: 'fab', onclick: () => openItemModal() }, '＋ פריט'));

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
      action = packedCheck(itemId, item);
    } else {
      action = famChip(respFam);
    }

    return el('div', { class: 'list-item' },
      el('div', { class: 'grow' },
        el('div', { class: 'name', style: item.packed ? 'text-decoration:line-through;opacity:.6' : '' },
          item.name),
        subLine(item, respFam && !isMine && item.packed ? '✓ נארז' : (isMine ? 'אתם מביאים 💪' : null)),
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
        ),
      ),
      menuBtn(itemId, item),
    );
  }

  function subLine(item, extra) {
    const parts = [item.category, item.notes, extra].filter(Boolean);
    return parts.length ? el('div', { class: 'sub' }, parts.join(' · ')) : null;
  }

  function packedCheck(itemId, item) {
    const on = !!item.packed;
    return el('button', {
      class: `bigcheck${on ? ' on' : ''}`, 'aria-label': 'נארז',
      onclick: () => setPacked(tripId, itemId, !on),
    }, '✓');
  }

  function menuBtn(itemId, item) {
    return el('button', {
      class: 'iconbtn-soft', 'aria-label': 'עריכה',
      onclick: () => openItemModal(itemId, item),
    }, '⋯');
  }

  /* ---------- מודאל הוספה/עריכה ---------- */

  function openItemModal(itemId, item) {
    const isEdit = !!itemId;
    const nameIn = el('input', { type: 'text', placeholder: 'למשל: אוהל, מנגל, שקיות קרח...', maxlength: 60, value: item?.name || '' });
    const catIn = el('input', { type: 'text', placeholder: 'למשל: לינה, מטבח (לא חובה)', maxlength: 30, value: item?.category || '' });
    const notesIn = el('input', { type: 'text', placeholder: 'לא חובה', maxlength: 120, value: item?.notes || '' });

    let type = item?.type || 'perFamily';
    const radios = el('div', { class: 'radio-cards' },
      radioCard('perFamily', '👨‍👩‍👧‍👦 כל משפחה מביאה לעצמה', 'לכל משפחה יש סימון משלה — למשל אוהל, שק"שים'),
      radioCard('shared', '🤝 פריט משותף — משפחה אחת אחראית', 'מישהו לוקח אחריות עבור כולם — למשל מנגל, צידנית גדולה'),
    );

    function radioCard(value, title, desc) {
      const input = el('input', { type: 'radio', name: 'gtype', checked: type === value });
      const card = el('label', { class: `radio-card${type === value ? ' selected' : ''}` },
        input,
        el('div', {}, el('div', { class: 't' }, title), el('div', { class: 'd' }, desc)),
      );
      input.addEventListener('change', () => {
        type = value;
        radios.querySelectorAll('.radio-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      return card;
    }

    // בעריכת פריט משותף — אפשרות לשנות אחראי
    let respSelect = null;
    if (isEdit && item.type === 'shared') {
      respSelect = el('select', {},
        el('option', { value: '' }, '— עדיין אין אחראי —'),
        Object.entries(families).map(([id, f]) =>
          el('option', { value: id, selected: id === item.responsibleFamilyId }, f.name)),
      );
    }

    const { close } = openModal(isEdit ? 'עריכת פריט' : 'פריט חדש', el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'מה מביאים?'), nameIn),
      el('div', { class: 'field' }, el('label', {}, 'סוג הפריט'), radios),
      respSelect ? el('div', { class: 'field' }, el('label', {}, 'מי אחראי?'), respSelect) : null,
      el('div', { class: 'field' }, el('label', {}, 'קטגוריה'), catIn),
      el('div', { class: 'field' }, el('label', {}, 'הערה'), notesIn),
      el('div', { class: 'actions' },
        isEdit ? el('button', { class: 'btn danger-text', onclick: del }, 'מחיקה') : null,
        el('button', { class: 'btn secondary', onclick: () => close() }, 'ביטול'),
        el('button', { class: 'btn', onclick: save }, isEdit ? 'שמירה' : 'הוספה'),
      ),
    ));

    async function save() {
      const name = nameIn.value.trim();
      if (!name) { toast('מה מביאים? צריך שם לפריט 🙂'); return; }
      const fields = {
        name, type,
        category: catIn.value.trim() || null,
        notes: notesIn.value.trim() || null,
      };
      if (isEdit) {
        if (respSelect) fields.responsibleFamilyId = respSelect.value || null;
        if (item.type === 'shared' && type !== 'shared') {
          fields.responsibleFamilyId = null;
          fields.packed = null;
        }
        if (item.type !== 'shared' && type === 'shared') fields.checked = null;
        await updateGearItem(tripId, itemId, fields);
      } else {
        await addGearItem(tripId, fields);
      }
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
