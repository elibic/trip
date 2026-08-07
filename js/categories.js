/* קטגוריות משותפות לרשימות (ציוד וקניות) */
import { el, openModal, toast } from './ui.js';

export const DEFAULT_CATEGORY = 'כללי';

export const GEAR_CATEGORIES = [
  'לינה', 'מטבח ואוכל', 'בגדים', 'ילדים',
  'חוף ובריכה', 'עזרה ראשונה', 'אלקטרוניקה', 'ניקיון',
];

export const SHOPPING_CATEGORIES = [
  'ירקות ופירות', 'בשר ודגים', 'מוצרי חלב', 'לחם ומאפים',
  'שתייה', 'חטיפים', 'על האש', 'חד-פעמי', 'ניקיון',
];

export function categoryOf(item) {
  return (item.category || '').trim() || DEFAULT_CATEGORY;
}

export function knownCategories(entries) {
  const seen = [];
  for (const [, item] of entries) {
    const cat = categoryOf(item);
    if (!seen.includes(cat)) seen.push(cat);
  }
  return seen;
}

/* מקבץ לפי קטגוריה. "כללי" תמיד ראשונה, השאר לפי סדר ההופעה (sort יציב).
   sortWithin (אופציונלי): מיון בתוך כל קבוצה. */
export function groupByCategory(entries, sortWithin) {
  const map = new Map();
  for (const entry of entries) {
    const cat = categoryOf(entry[1]);
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(entry);
  }
  if (sortWithin) for (const list of map.values()) list.sort(sortWithin);
  return [...map.entries()].sort((a, b) => {
    if (a[0] === DEFAULT_CATEGORY) return -1;
    if (b[0] === DEFAULT_CATEGORY) return 1;
    return 0;
  });
}

export function openCategoryPicker({ current, categories, suggestions = [], onPick }) {
  const options = [DEFAULT_CATEGORY, ...categories.filter((c) => c !== DEFAULT_CATEGORY)];
  const extra = suggestions.filter((s) => !options.includes(s));

  const list = el('div', { class: 'fam-list', style: 'max-width:none' },
    options.map((cat) => el('button', {
      class: 'fam-pick', onclick: () => pick(cat === DEFAULT_CATEGORY ? null : cat),
    },
      el('span', { style: 'flex:1;text-align:start' }, cat),
      (current || DEFAULT_CATEGORY) === cat ? el('span', { style: 'color:var(--primary)' }, '✓') : null,
    )),
  );

  const newIn = el('input', { type: 'text', placeholder: 'שם הקטגוריה', maxlength: 25 });
  newIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } });

  const { close } = openModal('קטגוריה', el('div', {},
    list,
    extra.length ? el('div', { class: 'suggest-row' },
      extra.map((s) => el('button', { class: 'map-chip', onclick: () => pick(s) }, `＋ ${s}`))) : null,
    el('div', { class: 'field', style: 'margin-top:14px' },
      el('label', {}, 'קטגוריה חדשה'),
      el('div', { class: 'row2' }, newIn, el('button', { class: 'btn', onclick: addNew }, 'הוספה')),
    ),
  ));

  function addNew() {
    const name = newIn.value.trim();
    if (!name) { toast('צריך שם לקטגוריה 🙂'); return; }
    pick(name);
  }

  function pick(value) {
    onPick(value);
    close();
  }
}

/* צ'יפ קטגוריה על שורת פריט — לחיצה משנה את הקטגוריה מיד, בלי מודאל עריכה */
export function rowCategoryChip({ item, categories, suggestions, onPick }) {
  const tagged = !!(item.category || '').trim();
  return el('button', {
    class: `row-cat-chip${tagged ? '' : ' untagged'}`,
    'aria-label': 'שינוי קטגוריה',
    onclick: (e) => {
      e.stopPropagation();
      openCategoryPicker({
        current: item.category || null, categories, suggestions, onPick,
      });
    },
  }, tagged ? item.category : '＋ קטגוריה');
}

/* צ'יפ בחירת קטגוריה לשורת ההוספה */
export function categoryChip({ state, categories, suggestions, className = 'cat-chip' }) {
  const chip = el('button', {
    class: className,
    onclick: () => openCategoryPicker({
      current: state.category, categories, suggestions,
      onPick: (picked) => {
        state.category = picked;
        chip.textContent = picked || DEFAULT_CATEGORY;
      },
    }),
  }, state.category || DEFAULT_CATEGORY);
  return chip;
}
