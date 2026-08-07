import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase, ref, set, update, remove, push, onValue, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

export function isConfigured() {
  return !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL);
}

let db = null;
if (isConfigured()) {
  db = getDatabase(initializeApp(firebaseConfig));
}

export function subscribe(path, cb) {
  return onValue(ref(db, path), (snap) => cb(snap.val()));
}

export function setAt(path, value) {
  return set(ref(db, path), value);
}

export function updateAt(path, values) {
  return update(ref(db, path), values);
}

export function removeAt(path) {
  return remove(ref(db, path));
}

// מחזיר מפתח push חדש; הכתיבה עצמה נעשית ע"י הקורא (מאפשר כתיבה אטומית לכמה נתיבים)
export function newKey(path) {
  return push(ref(db, path)).key;
}

export function pushTo(path, value) {
  const key = newKey(path);
  return set(ref(db, `${path}/${key}`), value).then(() => key);
}

export { serverTimestamp };
