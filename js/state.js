// Shared app state. Views read it; app.js owns the changes.
import { STR } from './i18n.js';

const saved = (() => { try { return JSON.parse(localStorage.getItem('nus-filters') || '{}'); } catch (e) { return {}; } })();

export const state = {
  lang: document.documentElement.lang === 'en' ? 'en' : 'he',
  user: null,          // { uid, name, email } once signed in
  profile: null,       // users/{uid}
  blocked: false,
  isAdmin: false,
  lists: null,
  filters: { q: '', cat: null, who: null, age: null, cond: null, source: null, hood: null, free: false, ...saved },
  threads: [],
  unread: 0,
  myListings: null,
  savedCounts: {},
  showOrig: {},
};

export const T = () => STR[state.lang];
export function persistFilters() {
  const { q, ...rest } = state.filters;
  try { localStorage.setItem('nus-filters', JSON.stringify(rest)); } catch (e) {}
}
export const L = (m) => (m ? (m[state.lang] || m[state.lang === 'he' ? 'en' : 'he'] || '') : '');
