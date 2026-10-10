// Every Firestore read and write in the app goes through this file.
import { db, auth, fs, au } from './fb.js';
import { LISTING_DAYS, WANTED_DAYS, PAGE, PURGE_DAYS } from './config.js';
import { DEFAULT_HOODS, DEFAULT_SOURCES } from './lists.js';
import { keywords, searchPlan, matchesAll } from './text.js';

const {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit,
  startAfter, onSnapshot, writeBatch, increment, getCountFromServer,
} = fs;

const DAY = 86400000;
export const now = () => Date.now();

// ------------------------------------------------------------------ lists
let listsCache = { hoods: DEFAULT_HOODS, sources: DEFAULT_SOURCES };
export const lists = () => listsCache;
export function watchLists(cb) {
  return onSnapshot(doc(db, 'config', 'lists'), (s) => {
    const d = s.exists() ? s.data() : {};
    listsCache = {
      hoods: Array.isArray(d.hoods) && d.hoods.length ? d.hoods : DEFAULT_HOODS,
      sources: Array.isArray(d.sources) && d.sources.length ? d.sources : DEFAULT_SOURCES,
    };
    cb(listsCache);
  }, () => cb(listsCache));
}
export const saveLists = (l) => setDoc(doc(db, 'config', 'lists'), l);

// ------------------------------------------------------------------ auth
export const onAuth = (cb) => au.onAuthStateChanged(auth, cb);

export async function signInGoogle() {
  const p = new au.GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  try {
    return await au.signInWithPopup(auth, p);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      return au.signInWithRedirect(auth, p);
    }
    throw e;
  }
}

export async function sendEmailLink(email) {
  const url = location.origin + location.pathname + (location.search.includes('emu') ? '?emu=1' : '');
  await au.sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
  try { localStorage.setItem('nus-email', email); } catch (e) {}
}

export const isEmailLink = () => au.isSignInWithEmailLink(auth, location.href);
export async function finishEmailLink(email) {
  const r = await au.signInWithEmailLink(auth, email, location.href);
  try { localStorage.removeItem('nus-email'); } catch (e) {}
  const u = new URL(location.href);
  ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl', 'tenantId'].forEach((k) => u.searchParams.delete(k));
  history.replaceState(null, '', u.toString());
  return r;
}
export const signOut = () => au.signOut(auth);

// ------------------------------------------------------------------ profile
export async function loadProfile(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? s.data() : null;
}
export function saveProfile(uid, data) {
  return setDoc(doc(db, 'users', uid), data, { merge: true });
}
export async function isBlocked(uid) {
  try { return (await getDoc(doc(db, 'blocked', uid))).exists(); } catch (e) { return false; }
}
export async function checkAdmin() {
  try { await getDoc(doc(db, 'config', 'admins')); return true; } catch (e) { return false; }
}

// ------------------------------------------------------------------ feed
const FILTERS = ['cat', 'who', 'age', 'cond', 'source', 'hood'];

function applyLocal(items, f, plan) {
  const t = now();
  return items.filter((l) => l.live && l.expiresAt > t
    && FILTERS.every((k) => !f[k] || l[k] === f[k])
    && (!f.free || l.price === 0)
    && (!plan || matchesAll(l.kw, plan.all)));
}

const asItem = (s) => ({ id: s.id, ...s.data() });

// One page of the feed. Filters run on the server; if an index is still being
// built (or was never created), fall back to a wider query filtered here, so
// the feed never breaks for users. The error goes to the console for admins.
export async function feedPage(f, cursor) {
  const plan = searchPlan(f.q || '');
  const cons = [where('live', '==', true)];
  for (const k of FILTERS) if (f[k]) cons.push(where(k, '==', f[k]));
  if (f.free) cons.push(where('price', '==', 0));
  if (plan) cons.push(where('kw', 'array-contains-any', plan.server));
  cons.push(orderBy('postedAt', 'desc'));
  if (cursor) cons.push(startAfter(cursor));
  cons.push(limit(PAGE));
  try {
    const snap = await getDocs(query(collection(db, 'listings'), ...cons));
    const items = applyLocal(snap.docs.map(asItem), f, plan);
    return { items, cursor: snap.docs.length === PAGE ? snap.docs[snap.docs.length - 1] : null, fallback: false };
  } catch (e) {
    if (e.code !== 'failed-precondition') throw e;
    console.warn('[index needed]', e.message);
    const c2 = [where('live', '==', true), orderBy('postedAt', 'desc')];
    if (cursor) c2.push(startAfter(cursor));
    c2.push(limit(120));
    const snap = await getDocs(query(collection(db, 'listings'), ...c2));
    return { items: applyLocal(snap.docs.map(asItem), f, plan), cursor: snap.docs.length === 120 ? snap.docs[snap.docs.length - 1] : null, fallback: true, indexError: e.message };
  }
}

export async function promoted() {
  try {
    const snap = await getDocs(query(collection(db, 'listings'), where('live', '==', true), where('promoUntil', '>', now()), limit(6)));
    return snap.docs.map(asItem).filter((l) => l.expiresAt > now());
  } catch (e) {
    console.warn('[promoted]', e.message);
    return [];
  }
}

export async function stats() {
  const base = collection(db, 'listings');
  try {
    const [all, week] = await Promise.all([
      getCountFromServer(query(base, where('live', '==', true))),
      getCountFromServer(query(base, where('live', '==', true), where('postedAt', '>', now() - 7 * DAY))),
    ]);
    return { active: all.data().count, week: week.data().count };
  } catch (e) {
    return null;
  }
}

export async function getListing(id) {
  const s = await getDoc(doc(db, 'listings', id));
  return s.exists() ? asItem(s) : null;
}
export async function getPhotos(id) {
  const s = await getDoc(doc(db, 'photos', id));
  return s.exists() ? s.data().list || [] : [];
}
export async function getContact(id) {
  const s = await getDoc(doc(db, 'listings', id, 'private', 'contact'));
  return s.exists() ? s.data() : null;
}
export const countView = (id) => updateDoc(doc(db, 'listings', id), { views: increment(1) }).catch(() => {});

// ------------------------------------------------------------------ posting
export function buildListing(form, user, existing) {
  const t = now();
  const kw = keywords(form.title.he, form.title.en, form.size, form.sourceName, form.sourceOther);
  const base = {
    ownerUid: user.uid, ownerName: user.name, lang: form.lang, translated: !!form.translated,
    title: form.title, problemText: form.problemText, desc: form.desc,
    cat: form.cat, who: form.who, age: form.age, cond: form.cond, source: form.source,
    sourceOther: form.sourceOther || '', size: form.size || '', problem: form.problem,
    price: form.price, origPrice: form.origPrice || 0, link: form.link || '', hood: form.hood,
    contact: form.contact, thumb: form.thumb, photoCount: form.photoCount, kw,
  };
  if (existing) return { ...base, status: existing.status, live: existing.live, postedAt: existing.postedAt, expiresAt: existing.expiresAt, promoUntil: existing.promoUntil, views: existing.views };
  return { ...base, status: 'active', live: true, postedAt: t, expiresAt: t + LISTING_DAYS * DAY, promoUntil: 0, views: 0 };
}

export async function saveListing({ id, data, photos, contact }) {
  const ref = id ? doc(db, 'listings', id) : doc(collection(db, 'listings'));
  const b = writeBatch(db);
  b.set(ref, data);
  if (photos) b.set(doc(db, 'photos', ref.id), { ownerUid: data.ownerUid, list: photos });
  b.set(doc(db, 'listings', ref.id, 'private', 'contact'), { ownerUid: data.ownerUid, phone: contact.phone || '', email: contact.email || '' });
  await b.commit();
  return ref.id;
}

export async function myListings(uid) {
  const snap = await getDocs(query(collection(db, 'listings'), where('ownerUid', '==', uid)));
  return snap.docs.map(asItem).sort((a, b) => b.postedAt - a.postedAt);
}

export function setStatus(id, status) {
  return updateDoc(doc(db, 'listings', id), { status, live: status === 'active' || status === 'reserved' });
}
export function renew(id) {
  return updateDoc(doc(db, 'listings', id), { status: 'active', live: true, expiresAt: now() + LISTING_DAYS * DAY });
}
export async function deleteListing(id) {
  const b = writeBatch(db);
  b.delete(doc(db, 'listings', id, 'private', 'contact'));
  b.delete(doc(db, 'photos', id));
  b.delete(doc(db, 'listings', id));
  await b.commit();
}

// The owner's expired listings move to the archive when the owner opens the app.
export async function archiveMyExpired(items) {
  const t = now();
  const due = items.filter((l) => l.live && l.expiresAt <= t);
  await Promise.all(due.map((l) => setStatus(l.id, 'archived').catch(() => {})));
  due.forEach((l) => { l.status = 'archived'; l.live = false; });
  return due.length;
}

// ------------------------------------------------------------------ saved searches
// How many live listings, posted since each search was last opened, match it.
export async function savedCounts(saved) {
  if (!saved || !saved.length) return {};
  const since = Math.min(...saved.map((s) => s.seenAt || 0));
  const snap = await getDocs(query(collection(db, 'listings'), where('live', '==', true), where('postedAt', '>', Math.max(since, now() - LISTING_DAYS * DAY)), orderBy('postedAt', 'desc'), limit(200)));
  const items = snap.docs.map(asItem);
  const out = {};
  for (const s of saved) {
    out[s.id] = applyLocal(items.filter((l) => l.postedAt > (s.seenAt || 0)), s.f, searchPlan(s.f.q || '')).length;
  }
  return out;
}

// ------------------------------------------------------------------ wanted
export async function wantedList() {
  const snap = await getDocs(query(collection(db, 'wanted'), orderBy('postedAt', 'desc'), limit(80)));
  return snap.docs.map(asItem).filter((w) => w.expiresAt > now());
}
export function saveWanted(uid, data) {
  const t = now();
  return setDoc(doc(db, 'wanted', uid), { ...data, postedAt: t, expiresAt: t + WANTED_DAYS * DAY });
}
export const deleteWanted = (uid) => deleteDoc(doc(db, 'wanted', uid));

// ------------------------------------------------------------------ messages
export function threadId(kind, refId, buyerUid) { return `${refId}_${buyerUid}`; }

export async function openThread({ kind, refId, owner, title, me }) {
  const id = threadId(kind, refId, me.uid);
  const ref = doc(db, 'threads', id);
  let s;
  try { s = await getDoc(ref); } catch (e) { s = null; }
  if (!s || !s.exists()) {
    await setDoc(ref, {
      kind, refId, title, owner, buyer: me.uid, participants: [owner, me.uid],
      names: { [me.uid]: me.name }, last: '', lastAt: now(), lastBy: me.uid, unread: { [owner]: 0, [me.uid]: 0 },
    });
  }
  return id;
}

export function watchThreads(uid, cb) {
  return onSnapshot(query(collection(db, 'threads'), where('participants', 'array-contains', uid)),
    (snap) => cb(snap.docs.map(asItem).filter((t) => t.last).sort((a, b) => b.lastAt - a.lastAt)),
    (e) => console.warn('[threads]', e.message));
}
export function watchThread(tid, cb) {
  return onSnapshot(doc(db, 'threads', tid), (s) => cb(s.exists() ? asItem(s) : null), (e) => { console.warn('[thread]', e.message); cb(null); });
}
export function watchMessages(tid, cb) {
  return onSnapshot(query(collection(db, 'threads', tid, 'messages'), orderBy('at', 'asc'), limit(300)),
    (snap) => cb(snap.docs.map(asItem)), (e) => console.warn('[messages]', e.message));
}
export async function sendMessage(thread, me, text) {
  const other = thread.participants.find((p) => p !== me.uid);
  const b = writeBatch(db);
  const t = now();
  b.set(doc(collection(db, 'threads', thread.id, 'messages')), { from: me.uid, text, at: t });
  b.update(doc(db, 'threads', thread.id), {
    last: text.slice(0, 200), lastAt: t, lastBy: me.uid, [`unread.${other}`]: increment(1), [`names.${me.uid}`]: me.name,
  });
  await b.commit();
}
export function markRead(tid, uid) {
  return updateDoc(doc(db, 'threads', tid), { [`unread.${uid}`]: 0 }).catch(() => {});
}

// ------------------------------------------------------------------ reports
export function report({ type, targetId, reason, note }) {
  return setDoc(doc(collection(db, 'reports')), { type, targetId, reason, note: note || '', by: auth.currentUser.uid, at: now(), status: 'open' });
}

// ------------------------------------------------------------------ admin
export const admin = {
  async reports() {
    const snap = await getDocs(query(collection(db, 'reports'), where('status', '==', 'open'), limit(200)));
    return snap.docs.map(asItem).sort((a, b) => b.at - a.at);
  },
  closeReport: (id) => updateDoc(doc(db, 'reports', id), { status: 'done' }),
  async listings(max = 300) {
    const snap = await getDocs(query(collection(db, 'listings'), orderBy('postedAt', 'desc'), limit(max)));
    return snap.docs.map(asItem);
  },
  setStatus: (id, status) => updateDoc(doc(db, 'listings', id), { status, live: status === 'active' || status === 'reserved' }),
  promote: (id, days) => updateDoc(doc(db, 'listings', id), { promoUntil: days ? now() + days * DAY : 0 }),
  deleteListing,
  async users() {
    const snap = await getDocs(query(collection(db, 'users'), limit(500)));
    return snap.docs.map(asItem).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
  async blocked() {
    const snap = await getDocs(collection(db, 'blocked'));
    return new Set(snap.docs.map((d) => d.id));
  },
  block: (uid, reason) => setDoc(doc(db, 'blocked', uid), { at: now(), reason: reason || '' }),
  unblock: (uid) => deleteDoc(doc(db, 'blocked', uid)),
  async admins() {
    const s = await getDoc(doc(db, 'config', 'admins'));
    return s.exists() ? s.data().emails || [] : [];
  },
  saveAdmins: (emails) => setDoc(doc(db, 'config', 'admins'), { emails }),
  deleteWanted,
  async counts() {
    const c = (q) => getCountFromServer(q).then((r) => r.data().count).catch(() => null);
    const L = collection(db, 'listings');
    const [live, week, sold, users, wanted, reports] = await Promise.all([
      c(query(L, where('live', '==', true))),
      c(query(L, where('postedAt', '>', now() - 7 * DAY))),
      c(query(L, where('status', '==', 'sold'))),
      c(collection(db, 'users')),
      c(collection(db, 'wanted')),
      c(query(collection(db, 'reports'), where('status', '==', 'open'))),
    ]);
    return { live, week, sold, users, wanted, reports };
  },
  // Live listings past their date go to the archive; archived ones older than
  // PURGE_DAYS are deleted with their photos, so storage stays in the free tier.
  async maintenance() {
    const t = now();
    const snap = await getDocs(query(collection(db, 'listings'), where('expiresAt', '<', t), limit(400)));
    let archived = 0, purged = 0;
    for (const d of snap.docs) {
      const l = d.data();
      if (l.live) { await this.setStatus(d.id, 'archived'); archived++; }
      else if (l.expiresAt < t - PURGE_DAYS * DAY) { await deleteListing(d.id); purged++; }
    }
    const w = await getDocs(query(collection(db, 'wanted'), where('expiresAt', '<', t), limit(400)));
    for (const d of w.docs) await deleteWanted(d.id);
    return { archived, purged, wanted: w.size };
  },
};
