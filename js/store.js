import { subscribe, setAt, updateAt, removeAt, pushTo, newKey } from './firebase.js';

export const FAMILY_COLORS = [
  '#e63946', '#2a9d8f', '#4361ee', '#f4a261',
  '#9d4edd', '#ef476f', '#118ab2', '#73a942',
  '#b5651d', '#6d597a', '#0ea5e9', '#d97706',
];

export const MEAL_SLOTS = [
  ['breakfast', 'בוקר', '🌅'],
  ['lunch', 'צהריים', '☀️'],
  ['dinner', 'ערב', '🌙'],
  ['snacks', 'נשנושים', '🍉'],
];

/* ---------- מנויים ---------- */

export function subscribeIndex(cb) {
  return subscribe('tripsIndex', cb);
}

let latestTrip = null;

export function subscribeTrip(tripId, cb) {
  return subscribe(`trips/${tripId}`, (data) => {
    latestTrip = data;
    cb(data);
  });
}

// התמונה העדכנית של הטיול — למסכים שנפתחים מעל התצוגה (כמו חיפוש מקומות)
// ומחזיקים ברפרנס ישן אחרי שהנתונים התעדכנו
export function currentTrip() {
  return latestTrip;
}

/* ---------- הודעת שידור לכל המכשירים ----------
   יושבת תחת trips/ כדי להיכנס לחוקי האבטחה הקיימים (trips/$tripId),
   ובשם שמתחיל ב-__ כדי שלא תיראה אף פעם כטיול (מסך הבית קורא מ-tripsIndex). */

export const BROADCAST_PATH = 'trips/__broadcast';

export function subscribeBroadcast(cb) {
  return subscribe(BROADCAST_PATH, cb);
}

export function publishBroadcast(message) {
  return setAt(BROADCAST_PATH, message);
}

export function clearBroadcast() {
  return removeAt(BROADCAST_PATH);
}

/* ---------- טיולים ---------- */

export async function createTrip({ name, startDate, endDate }) {
  const id = newKey('trips');
  const meta = { name, startDate, endDate, createdAt: Date.now() };
  await updateAt('/', {
    [`trips/${id}/meta`]: meta,
    [`tripsIndex/${id}`]: meta,
  });
  return id;
}

export function updateTripMeta(tripId, meta) {
  return updateAt('/', {
    [`trips/${tripId}/meta`]: { ...meta },
    [`tripsIndex/${tripId}`]: { ...meta },
  });
}

export function deleteTrip(tripId) {
  return updateAt('/', {
    [`trips/${tripId}`]: null,
    [`tripsIndex/${tripId}`]: null,
  });
}

/* ---------- משפחות ---------- */

export function addFamily(tripId, name, existingCount) {
  const color = FAMILY_COLORS[existingCount % FAMILY_COLORS.length];
  return pushTo(`trips/${tripId}/families`, { name, color, createdAt: Date.now() });
}

export function renameFamily(tripId, famId, name) {
  return setAt(`trips/${tripId}/families/${famId}/name`, name);
}

/* ---------- ציוד ---------- */

export function addGearItem(tripId, item) {
  return pushTo(`trips/${tripId}/gear`, { ...item, createdAt: Date.now() });
}

export function updateGearItem(tripId, itemId, fields) {
  return updateAt(`trips/${tripId}/gear/${itemId}`, fields);
}

export function deleteGearItem(tripId, itemId) {
  return removeAt(`trips/${tripId}/gear/${itemId}`);
}

export function setGearChecked(tripId, itemId, famId, on) {
  const path = `trips/${tripId}/gear/${itemId}/checked/${famId}`;
  return on ? setAt(path, true) : removeAt(path);
}

export function claimShared(tripId, itemId, famId) {
  // famId = null → שחרור אחריות (וגם איפוס "נארז")
  return updateAt(`trips/${tripId}/gear/${itemId}`, {
    responsibleFamilyId: famId,
    ...(famId ? {} : { packed: null }),
  });
}

export function setPacked(tripId, itemId, on) {
  const path = `trips/${tripId}/gear/${itemId}/packed`;
  return on ? setAt(path, true) : removeAt(path);
}

/* ---------- קניות ---------- */

export function addShoppingItem(tripId, item) {
  return pushTo(`trips/${tripId}/shopping`, { ...item, createdAt: Date.now() });
}

export function updateShoppingItem(tripId, itemId, fields) {
  return updateAt(`trips/${tripId}/shopping/${itemId}`, fields);
}

export function deleteShoppingItem(tripId, itemId) {
  return removeAt(`trips/${tripId}/shopping/${itemId}`);
}

export function setBought(tripId, itemId, on) {
  const path = `trips/${tripId}/shopping/${itemId}/bought`;
  return on ? setAt(path, true) : removeAt(path);
}

export function claimShopping(tripId, itemId, famId) {
  const path = `trips/${tripId}/shopping/${itemId}/buyerFamilyId`;
  return famId ? setAt(path, famId) : removeAt(path);
}

export function clearBoughtItems(tripId, itemIds) {
  return updateAt(`trips/${tripId}/shopping`,
    Object.fromEntries(itemIds.map((id) => [id, null])));
}

// קטגוריית ברירת מחדל למוצר שעובר לציוד בלי קטגוריה משלו
export const SHOPPING_TO_GEAR_CATEGORY = 'אוכל';

/* העברת מוצרים שנקנו לרשימת "ציוד לכולם" — מה שקנינו צריך גם לזכור לקחת.
   entries: [[itemId, shoppingItem], ...]. הכתיבה אחת ואטומית. */
export function moveShoppingToGear(tripId, entries) {
  const updates = {};
  const now = Date.now();

  entries.forEach(([itemId, item], i) => {
    const notes = [item.qty, item.notes].filter(Boolean).join(' · ') || null;
    updates[`trips/${tripId}/shopping/${itemId}`] = null;
    updates[`trips/${tripId}/gear/${newKey(`trips/${tripId}/gear`)}`] = {
      name: item.name,
      type: 'shared',
      category: (item.category || '').trim() || SHOPPING_TO_GEAR_CATEGORY,
      responsibleFamilyId: item.buyerFamilyId || null,
      notes,
      fromShopping: true,   // הגיע מרשימת הקניות — כבר נקנה
      createdAt: now + i,   // שמירה על סדר ההעברה
    };
  });

  return updateAt('/', updates);
}

/* ---------- מסלול ---------- */

export function addStop(tripId, dayKey, stop) {
  return pushTo(`trips/${tripId}/itinerary/${dayKey}/stops`, stop);
}

export function updateStop(tripId, dayKey, stopId, fields) {
  return updateAt(`trips/${tripId}/itinerary/${dayKey}/stops/${stopId}`, fields);
}

export function deleteStop(tripId, dayKey, stopId) {
  return removeAt(`trips/${tripId}/itinerary/${dayKey}/stops/${stopId}`);
}

// העברת עצירה בין ימים (ובין "רעיונות" ליום מסוים) — כתיבה אחת אטומית
export function moveStop(tripId, fromDay, toDay, stopId, stop, order) {
  if (fromDay === toDay) return Promise.resolve();
  return updateAt('/', {
    [`trips/${tripId}/itinerary/${fromDay}/stops/${stopId}`]: null,
    [`trips/${tripId}/itinerary/${toDay}/stops/${stopId}`]: { ...stop, order },
  });
}

export function swapStops(tripId, dayKey, aId, aOrder, bId, bOrder) {
  return updateAt(`trips/${tripId}/itinerary/${dayKey}/stops`, {
    [`${aId}/order`]: bOrder,
    [`${bId}/order`]: aOrder,
  });
}

/* ---------- ארוחות ---------- */

export function setMeal(tripId, dayKey, slot, data) {
  return setAt(`trips/${tripId}/meals/${dayKey}/${slot}`, data);
}

/* ---------- הוצאות ---------- */

export function addExpense(tripId, exp) {
  return pushTo(`trips/${tripId}/expenses`, { ...exp, createdAt: Date.now() });
}

export function updateExpense(tripId, expId, fields) {
  return updateAt(`trips/${tripId}/expenses/${expId}`, fields);
}

export function deleteExpense(tripId, expId) {
  return removeAt(`trips/${tripId}/expenses/${expId}`);
}

/* ---------- המשפחה שלי (localStorage) ---------- */

export function getMyFamily(tripId) {
  return localStorage.getItem(`trip.familyId.${tripId}`);
}

export function setMyFamily(tripId, famId) {
  localStorage.setItem(`trip.familyId.${tripId}`, famId);
}

export function getLastTab(tripId) {
  return localStorage.getItem(`trip.lastTab.${tripId}`);
}

export function setLastTab(tripId, tab) {
  localStorage.setItem(`trip.lastTab.${tripId}`, tab);
}

/* ---------- הגנה מכתיבה כפולה ---------- */

// השוואת שמות סלחנית: רווחים מיותרים, אותיות גדולות/קטנות וגרשיים שונים
export function normalizeName(value) {
  return String(value || '')
    .trim().replace(/\s+/g, ' ').toLowerCase()
    .replace(/[\u2018\u2019\u05f3]/g, "'")
    .replace(/[\u201c\u201d\u05f4]/g, '"');
}

/* מחזיר [id, item] של פריט קיים באותו שם, או null.
   entries: [[id, item], ...] — עובד גם על name וגם על title. */
export function findByName(entries, name) {
  const target = normalizeName(name);
  if (!target) return null;
  return entries.find(([, it]) => normalizeName(it.name ?? it.title) === target) || null;
}

/* ---------- עזרי תאריכים ---------- */

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function tripDays(meta) {
  const days = [];
  if (!meta?.startDate) return days;
  const start = new Date(meta.startDate + 'T12:00:00');
  const end = new Date((meta.endDate || meta.startDate) + 'T12:00:00');
  const d = new Date(start);
  while (d <= end && days.length < 31) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export function fmtDay(dayKey) {
  const d = new Date(dayKey + 'T12:00:00');
  return `יום ${DAY_NAMES[d.getDay()]} · ${d.getDate()}.${d.getMonth() + 1}`;
}

// מקומות שנאספו כרעיון ועוד לא שובצו ליום — נשמרים כ"יום" וירטואלי
export const IDEAS_DAY = 'ideas';

export function dayLabel(dayKey) {
  return dayKey === IDEAS_DAY ? '💡 רעיונות' : fmtDay(dayKey);
}

export function fmtRange(meta) {
  if (!meta?.startDate) return '';
  const f = (k) => {
    const d = new Date(k + 'T12:00:00');
    return `${d.getDate()}.${d.getMonth() + 1}`;
  };
  if (!meta.endDate || meta.endDate === meta.startDate) return f(meta.startDate);
  return `${f(meta.startDate)} – ${f(meta.endDate)}`;
}

const nisFmt = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
export function fmtNis(n) {
  return nisFmt.format(Math.round(n));
}
