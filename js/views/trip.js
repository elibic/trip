import { el, openModal, toast } from '../ui.js';
import { addFamily, setMyFamily } from '../store.js';

/* שער "מי אתם?" — מוצג בכניסה ראשונה לטיול */
export function renderGate(view, { tripId, trip, onPicked }) {
  const families = trip.families || {};
  const famList = el('div', { class: 'fam-list' });

  for (const [famId, fam] of Object.entries(families)) {
    famList.append(el('button', { class: 'fam-pick', onclick: () => pick(famId) },
      el('span', { class: 'dot', style: `background:${fam.color}` }),
      el('span', {}, fam.name),
    ));
  }

  view.append(el('div', { class: 'gate' },
    el('div', { class: 'big' }, '👋'),
    el('h1', {}, 'מי אתם?'),
    el('p', {}, Object.keys(families).length
      ? 'בחרו את המשפחה שלכם — הבחירה נשמרת במכשיר הזה'
      : 'אתם הראשונים כאן! הוסיפו את המשפחה שלכם'),
    famList,
    el('button', { class: 'btn secondary', onclick: () => openAddFamily(tripId, families, pick) },
      '＋ הוספת משפחה חדשה'),
  ));

  function pick(famId) {
    setMyFamily(tripId, famId);
    onPicked();
  }
}

/* מודאל החלפת משפחה (מהצ'יפ שב-header) */
export function renderFamilySwitcher({ tripId, trip, myFamilyId, onChanged }) {
  const families = trip.families || {};
  const list = el('div', { class: 'fam-list', style: 'max-width:none' });

  const { close } = openModal('החלפת משפחה', el('div', {},
    el('p', { style: 'color:var(--text-soft);font-size:13.5px;margin-bottom:12px' },
      'באיזו משפחה אתם? הבחירה קובעת אילו משבצות ציוד מסומנות בשבילכם.'),
    list,
    el('button', {
      class: 'btn secondary block', style: 'margin-top:12px',
      onclick: () => { close(); openAddFamily(tripId, families, pick); },
    }, '＋ הוספת משפחה חדשה'),
  ));

  for (const [famId, fam] of Object.entries(families)) {
    list.append(el('button', { class: 'fam-pick', onclick: () => pick(famId) },
      el('span', { class: 'dot', style: `background:${fam.color}` }),
      el('span', { style: 'flex:1;text-align:start' }, fam.name),
      famId === myFamilyId ? el('span', { style: 'color:var(--primary)' }, '✓') : null,
    ));
  }

  function pick(famId) {
    setMyFamily(tripId, famId);
    close();
    onChanged();
  }
}

/* מודאל הוספת משפחה */
function openAddFamily(tripId, families, onAdded) {
  const nameIn = el('input', { type: 'text', placeholder: 'למשל: משפחת כהן', maxlength: 40 });
  const { close } = openModal('משפחה חדשה', el('div', {},
    el('div', { class: 'field' }, el('label', {}, 'שם המשפחה'), nameIn),
    el('div', { class: 'actions' },
      el('button', { class: 'btn secondary', onclick: () => close() }, 'ביטול'),
      el('button', { class: 'btn', onclick: save }, 'הוספה'),
    ),
  ));

  async function save() {
    const name = nameIn.value.trim();
    if (!name) { toast('צריך שם משפחה 🙂'); return; }
    const exists = Object.values(families).some((f) => f.name === name);
    if (exists) { toast('משפחה בשם הזה כבר קיימת'); return; }
    const famId = await addFamily(tripId, name, Object.keys(families).length);
    close();
    onAdded(famId);
  }
}
