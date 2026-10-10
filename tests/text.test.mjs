import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keywords, searchPlan, matchesAll, detectLang, waNumber, normalize } from '../js/text.js';

const found = (kw, q) => { const p = searchPlan(q); return p.server.some((f) => kw.includes(f)) && matchesAll(kw, p.all); };
const kw = keywords('שמלת פרחים לתינוקת', 'Floral baby dresses', '9 חודשים', 'Next');

test('Hebrew forms find each other', () => {
  for (const q of ['שמלה', 'שמלת', 'השמלה', 'תינוקות', 'לתינוקת', 'פרח', 'חודשים']) assert.ok(found(kw, q), q);
});
test('English, plural and partial words', () => {
  for (const q of ['dress', 'dresses', 'flor', 'NEXT', 'baby dress']) assert.ok(found(kw, q), q);
});
test('unrelated words do not match', () => {
  for (const q of ['מעיל', 'coat', 'שמלה מעיל']) assert.ok(!found(kw, q), q);
});
test('geresh and niqqud are ignored', () => {
  assert.equal(normalize("רמה ג׳1"), normalize("רמה ג'1"));
  assert.equal(normalize('שָׂמְלָה'), 'שמלה');
});
test('language detection', () => {
  assert.equal(detectLang('שמלה של Next'), 'he');
  assert.equal(detectLang('Floral dress'), 'en');
});
test('WhatsApp numbers', () => {
  assert.equal(waNumber('052-123-4567'), '972521234567');
  assert.equal(waNumber('+972 52 123 4567'), '972521234567');
  assert.equal(waNumber('00972521234567'), '972521234567');
});
