// Free translation through MyMemory (no key, no card). Each listing is
// translated once when it is posted and both versions are stored, so reading
// costs nothing. If the service is down or the daily allowance is used up,
// the listing posts in its own language and readers get a Translate link.
import { translateEmail } from './config.js';

const API = 'https://api.mymemory.translated.net/get';

function chunks(text, maxBytes = 450) {
  const parts = String(text).split(/(?<=[.!?\n])\s*/);
  const out = [];
  let cur = '';
  const bytes = (s) => new TextEncoder().encode(s).length;
  for (const p of parts) {
    if (bytes(cur + ' ' + p) > maxBytes && cur) { out.push(cur); cur = p; }
    else cur = cur ? cur + ' ' + p : p;
    while (bytes(cur) > maxBytes) { const cut = Math.floor(cur.length / 2); out.push(cur.slice(0, cut)); cur = cur.slice(cut); }
  }
  if (cur) out.push(cur);
  return out;
}

async function one(q, from, to) {
  const u = new URL(API);
  u.searchParams.set('q', q);
  u.searchParams.set('langpair', `${from}|${to}`);
  if (translateEmail) u.searchParams.set('de', translateEmail);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(u, { signal: ctl.signal });
    const j = await r.json();
    const t = j && j.responseData && j.responseData.translatedText;
    if (Number(j.responseStatus) !== 200 || !t || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) throw new Error('translate-unavailable');
    return t;
  } finally { clearTimeout(timer); }
}

export async function translate(text, from, to) {
  if (!String(text || '').trim()) return '';
  const out = [];
  for (const c of chunks(text)) out.push(await one(c, from, to));
  return out.join(' ');
}

// Translate several fields; null if any of them failed.
export async function translateAll(fields, from, to) {
  try {
    const res = {};
    for (const [k, v] of Object.entries(fields)) res[k] = await translate(v, from, to);
    return res;
  } catch (e) {
    return null;
  }
}

export const googleLink = (text, from, to) =>
  `https://translate.google.com/?sl=${from}&tl=${to}&op=translate&text=${encodeURIComponent(text)}`;
