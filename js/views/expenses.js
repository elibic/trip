import { el, openModal, confirmDialog, toast, emptyState, famChip } from '../ui.js';
import { addExpense, updateExpense, deleteExpense, fmtNis } from '../store.js';
import { computeSettlement } from '../settle.js';

export function renderExpenses(view, ctx) {
  const { tripId, trip, myFamilyId } = ctx;
  const families = trip.families || {};
  const expenses = trip.expenses || {};
  const expList = Object.entries(expenses).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

  const { total, perFamily, transfers } = computeSettlement(families, expenses);

  /* ----- סיכום ----- */
  if (expList.length) {
    const summary = el('div', { class: 'card exp-summary' },
      el('div', { class: 'section-title', style: 'margin-top:0' }, '📊 סיכום'),
      Object.entries(families).map(([id, f]) =>
        el('div', { class: 'row' },
          famChip(f),
          el('span', { class: 'amount' }, fmtNis(perFamily[id]?.paid || 0)),
        )),
      el('div', { class: 'row total' },
        el('span', {}, 'סה"כ הוצאות'),
        el('span', { class: 'amount' }, fmtNis(total)),
      ),
    );

    if (transfers.length) {
      summary.append(el('div', { class: 'section-title', style: 'margin-bottom:2px' }, '🔄 התחשבנות — מי מעביר למי'));
      for (const t of transfers) {
        summary.append(el('div', { class: 'transfer' },
          famChip(families[t.from]),
          el('span', {}, '⬅'),
          famChip(families[t.to]),
          el('span', { class: 'amount' }, fmtNis(t.amount)),
        ));
      }
    } else {
      summary.append(el('div', { class: 'transfer' }, '✅ הכל מאוזן — אין העברות'));
    }
    view.append(summary);
  }

  /* ----- רשימת הוצאות ----- */
  if (expList.length === 0) {
    view.append(emptyState('💰', 'עוד אין הוצאות. כל הוצאה שתרשמו תתחלק אוטומטית בין המשפחות.'));
  } else {
    view.append(el('div', { class: 'section-title' }, '🧾 כל ההוצאות'));
    const card = el('div', { class: 'card' });
    for (const [expId, exp] of expList) {
      const fam = families[exp.paidByFamilyId];
      const partial = exp.splitAmong && Object.keys(exp.splitAmong).length < Object.keys(families).length;
      card.append(el('div', { class: 'list-item exp-item' },
        el('div', { class: 'grow' },
          el('div', { class: 'name' }, exp.description),
          el('div', { class: 'sub' },
            fam ? `שילמה ${fam.name}` : '',
            partial ? ` · מתחלק בין ${Object.keys(exp.splitAmong).length} משפחות` : '',
          ),
        ),
        el('div', { class: 'amt' }, fmtNis(exp.amount)),
        el('button', { class: 'iconbtn-soft', 'aria-label': 'עריכה', onclick: () => openExpenseModal(expId, exp) }, '⋯'),
      ));
    }
    view.append(card);
  }

  view.append(el('button', { class: 'fab', onclick: () => openExpenseModal() }, '＋ הוצאה'));

  /* ---------- מודאל ---------- */

  function openExpenseModal(expId, exp) {
    const isEdit = !!expId;
    const descIn = el('input', { type: 'text', placeholder: 'למשל: דלק, קניות בסופר, כניסה לאתר', maxlength: 80, value: exp?.description || '' });
    const amountIn = el('input', { type: 'number', class: 'ltr', inputmode: 'decimal', min: '0', step: 'any', placeholder: '₪', value: exp?.amount || '' });
    const payerSelect = el('select', {},
      Object.entries(families).map(([id, f]) =>
        el('option', { value: id, selected: id === (exp?.paidByFamilyId || myFamilyId) }, f.name)),
    );

    const splitChecks = {};
    const splitBox = el('div', {},
      Object.entries(families).map(([id, f]) => {
        const input = el('input', {
          type: 'checkbox',
          checked: exp?.splitAmong ? !!exp.splitAmong[id] : true,
        });
        splitChecks[id] = input;
        return el('label', { class: 'check-row' }, input,
          el('span', { class: 'dot', style: `width:10px;height:10px;border-radius:50%;background:${f.color}` }),
          f.name);
      }),
    );

    const { close } = openModal(isEdit ? 'עריכת הוצאה' : 'הוצאה חדשה', el('div', {},
      el('div', { class: 'field' }, el('label', {}, 'על מה שילמתם?'), descIn),
      el('div', { class: 'field' }, el('label', {}, 'כמה? (₪)'), amountIn),
      el('div', { class: 'field' }, el('label', {}, 'מי שילם?'), payerSelect),
      el('div', { class: 'field' }, el('label', {}, 'מתחלק בין'), splitBox),
      el('div', { class: 'actions' },
        isEdit ? el('button', { class: 'btn danger-text', onclick: del }, 'מחיקה') : null,
        el('button', { class: 'btn secondary', onclick: () => close() }, 'ביטול'),
        el('button', { class: 'btn', onclick: save }, isEdit ? 'שמירה' : 'הוספה'),
      ),
    ));

    async function save() {
      const description = descIn.value.trim();
      const amount = parseFloat(amountIn.value);
      if (!description) { toast('על מה שילמתם? צריך תיאור 🙂'); return; }
      if (!(amount > 0)) { toast('צריך סכום גדול מאפס'); return; }

      const selected = Object.entries(splitChecks).filter(([, c]) => c.checked).map(([id]) => id);
      if (selected.length === 0) { toast('צריך לבחור לפחות משפחה אחת לחלוקה'); return; }
      const splitAmong = selected.length === Object.keys(families).length
        ? null // כולם = ברירת המחדל
        : Object.fromEntries(selected.map((id) => [id, true]));

      const fields = { description, amount, paidByFamilyId: payerSelect.value, splitAmong };
      if (isEdit) await updateExpense(tripId, expId, fields);
      else await addExpense(tripId, fields);
      close();
    }

    async function del() {
      close();
      if (await confirmDialog(`למחוק את ההוצאה "${exp.description}"?`)) {
        deleteExpense(tripId, expId);
        toast('ההוצאה נמחקה');
      }
    }
  }
}
