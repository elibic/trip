// Pure text helpers: no DOM, no Firebase. Tested directly in Node.

const HEB = /[֐-׿]/;
export const isHebrew = (s) => HEB.test(String(s || ''));
export const detectLang = (...parts) => {
  const s = parts.join(' ');
  const he = (s.match(/[֐-׿]/g) || []).length;
  const en = (s.match(/[A-Za-z]/g) || []).length;
  return he >= en * 0.5 && he > 0 ? 'he' : 'en';
};

// Lowercase, unify the different geresh and quote marks, keep letters and digits.
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[׳’‘`´]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/[֑-ׇ]/g, '') // niqqud
    .replace(/[^\p{L}\p{N}'"]+/gu, ' ')
    .replace(/['"]/g, '')
    .trim();
}

export const words = (s) => normalize(s).split(/\s+/).filter((w) => w.length >= 2);

// Hebrew prefixes that glue onto a word: ה, ו, ב, ל, מ, ש, כ.
const PREFIX = /^[הובלמשכ]/;

// Search keys stored on each listing: every word, its Hebrew form without one
// leading prefix letter, and its first 3+ letters so typing a part matches.
export function keywords(...texts) {
  const out = new Set();
  for (const t of texts) {
    for (const w of words(t)) {
      const forms = [w];
      if (PREFIX.test(w) && w.length >= 4 && isHebrew(w)) forms.push(w.slice(1));
      for (const f of forms) {
        out.add(f);
        for (let i = 3; i < Math.min(f.length, 10); i++) out.add(f.slice(0, i));
      }
    }
  }
  return [...out].slice(0, 240);
}

// Forms of one typed word that may be stored: the word, without a glued
// prefix letter, and without a feminine or plural ending (שמלה finds שמלת).
export function forms(w) {
  const out = new Set([w.slice(0, 9)]);
  const heb = isHebrew(w);
  const bases = [w];
  if (heb && PREFIX.test(w) && w.length >= 4) bases.push(w.slice(1));
  for (const b of bases) {
    out.add(b.slice(0, 9));
    if (heb && b.length >= 4 && /[התי]$/.test(b)) out.add(b.slice(0, -1).slice(0, 9));
    if (heb && b.length >= 5 && /(ים|ות)$/.test(b)) out.add(b.slice(0, -2).slice(0, 9));
    if (!heb && b.length >= 4 && /s$/.test(b)) out.add(b.slice(0, -1).slice(0, 9));
  }
  return [...out].filter((f) => f.length >= 2);
}

// The search box: the longest word goes to the server (array-contains-any over
// its forms), every word filters locally.
export function searchPlan(q) {
  const ws = words(q);
  if (!ws.length) return null;
  const longest = [...ws].sort((a, b) => b.length - a.length)[0];
  return { server: forms(longest).slice(0, 10), all: ws.map(forms) };
}

export function matchesAll(kw, groups) {
  const set = new Set(kw || []);
  return groups.every((g) => (Array.isArray(g) ? g : forms(g)).some((f) => set.has(f)));
}

// Israeli phone to a wa.me number.
export function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '972' + d.slice(1);
  return d;
}

export const clamp = (s, n) => String(s || '').trim().slice(0, n);
