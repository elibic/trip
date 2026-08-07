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
