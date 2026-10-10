// End-to-end on the Firebase emulators: npm run test:e2e
// The Firebase SDK is served from node_modules instead of gstatic, and the
// translation service is replaced by a stub, so the run needs no network.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { readFile, mkdir } from 'node:fs/promises';
import { serve } from './server.mjs';
import assert from 'node:assert/strict';

const PORT = 5173, BASE = `http://localhost:${PORT}/?emu=1`;
const PROJECT = 'demo-dandash';
const SHOTS = 'tests/shots';
await mkdir(SHOTS, { recursive: true });
const srv = await serve(process.cwd(), PORT);
const browser = await chromium.launch();
const errors = [];
let step = 0;
const log = (m) => console.log(`${++step}. ${m}`);

async function context(opts = {}) {
  const ctx = await browser.newContext({ locale: 'he-IL', ...opts });
  await ctx.route('https://www.gstatic.com/firebasejs/**', async (route) => {
    const name = route.request().url().split('/').pop();
    route.fulfill({ body: await readFile(`node_modules/firebase/${name}`), contentType: 'text/javascript' });
  });
  await ctx.route('https://api.mymemory.translated.net/**', (route) => {
    const u = new URL(route.request().url());
    const q = u.searchParams.get('q'), pair = u.searchParams.get('langpair');
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ responseStatus: 200, responseData: { translatedText: `[${pair.split('|')[1]}] ${q}` } }) });
  });
  return ctx;
}
async function page(ctx) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon|manifest|PERMISSION_DENIED|offline/.test(m.text())) errors.push('console: ' + m.text()); });
  p.on('dialog', (d) => d.accept());
  return p;
}

async function signIn(p, email, name) {
  await p.waitForSelector('#authmail', { state: 'visible' });
  await p.fill('#authmail', email);
  await p.click('[data-link]');
  await p.waitForSelector('#authnote:not([hidden])');
  const codes = await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/oobCodes`)).json();
  const c = codes.oobCodes.filter((x) => x.email === email).pop();
  const link = new URL(c.oobLink);
  const cont = new URL(link.searchParams.get('continueUrl'));
  for (const k of ['apiKey', 'oobCode', 'mode', 'lang']) cont.searchParams.set(k, link.searchParams.get(k) || 'en');
  await p.goto(cont.toString());
  await p.waitForSelector('#dname', { state: 'visible' });
  await p.fill('#dname', name);
  await p.click('[data-save]');
  await p.waitForFunction(() => !document.querySelector('#sheet.on #dname'));
}

async function makePhoto(p, color, path) {
  await p.setContent(`<div style="width:900px;height:1100px;background:linear-gradient(135deg,${color},#fff);display:grid;place-items:center;font:120px sans-serif">👗</div>`);
  await p.locator('div').screenshot({ path });
}

try {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

  // ---------------------------------------------------------------- seller
  const sCtx = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const s = await page(sCtx);
  const tmp = await sCtx.newPage();
  await makePhoto(tmp, '#f2a0b0', `${SHOTS}/_photo1.png`);
  await makePhoto(tmp, '#a0c0f2', `${SHOTS}/_photo2.png`);
  await tmp.close();

  await s.goto(BASE);
  await s.waitForSelector('.empty');
  log('feed loads empty for a guest');
  await s.screenshot({ path: `${SHOTS}/01-empty-feed.png` });

  await s.click('#nav a.post');
  await s.waitForSelector('#postform');
  await s.click('[data-login]');
  await signIn(s, 'rachel@example.com', 'רחלי');
  log('seller signs in with an email link and sets a name');
  await s.goto(BASE + '#post');
  await s.waitForSelector('#postform');
  assert.equal(await s.locator('.loginbar').count(), 0, 'login bar gone after sign-in');

  // Validation: an empty form says what is missing.
  await s.click('#go');
  assert.match(await s.textContent('#formerr'), /תמונה/);
  log('empty form explains what is missing');

  await s.setInputFiles('#files', [`${SHOTS}/_photo1.png`, `${SHOTS}/_photo2.png`]);
  await s.waitForFunction(() => document.querySelectorAll('#photos .slot img').length === 2);
  await s.fill('#f-title', 'שמלת פרחים לתינוקת');
  await s.click('[data-seg="source"][data-v="next"]');
  await s.fill('#f-size', '9 חודשים');
  await s.fill('#f-ptext', 'לא התאים לבת שלי בת שנה שהיא בגודל רגיל לגילה, היה גדול עליה');
  await s.fill('#f-price', '35');
  await s.fill('#f-orig', '89');
  await s.selectOption('#f-hood', 'ramat-b');
  await s.click('[data-c="phone"]');
  await s.fill('#f-phone', '052-123-4567');
  await s.screenshot({ path: `${SHOTS}/02-post-form.png`, fullPage: true });
  await s.click('#go');
  await s.waitForSelector('#r-title');
  assert.match(await s.inputValue('#r-title'), /^\[en\] /);
  await s.fill('#r-title', 'Floral baby dress, Next');
  log('translation review shows the English version and allows a fix');
  await s.screenshot({ path: `${SHOTS}/03-review.png` });
  await s.click('[data-submit]');
  await s.waitForSelector('.detail h2', { timeout: 15000 });
  assert.equal(await s.textContent('.detail h2'), 'שמלת פרחים לתינוקת');
  await s.waitForFunction(() => document.querySelectorAll('.detail .gallery img').length === 2, null, { timeout: 10000 });
  log('listing posted, detail shows both photos');
  await s.screenshot({ path: `${SHOTS}/04-detail-own.png` });

  // A second listing, free, in English.
  await s.goto(BASE + '#post');
  await s.waitForSelector('#postform');
  await s.setInputFiles('#files', [`${SHOTS}/_photo2.png`]);
  await s.waitForSelector('#photos .slot img');
  await s.click('[data-seg="cat"][data-v="toys"]');
  await s.selectOption('#f-who', 'unisex');
  await s.selectOption('#f-age', 'a2');
  await s.fill('#f-title', 'Magnetic wooden puzzle');
  await s.click('[data-seg="problem"][data-v="other"]');
  await s.fill('#f-ptext', 'We ordered two by mistake. Sealed box.');
  await s.fill('#f-price', '0');
  await s.click('#go');
  await s.waitForSelector('#r-title');
  await s.click('[data-submit]');
  await s.waitForSelector('.detail h2');
  log('second listing (free, written in English) posted');

  await s.goto(BASE + '#feed');
  await s.waitForFunction(() => document.querySelectorAll('#feed .item').length === 2);
  assert.match(await s.textContent('#feed'), /חינם/);
  await s.screenshot({ path: `${SHOTS}/05-feed.png` });
  log('feed shows both listings, the free one marked free');

  // Search, with a different Hebrew form of the word.
  await s.fill('#q', 'שמלה');
  await s.waitForFunction(() => document.querySelectorAll('#feed .item').length === 1);
  await s.fill('#q', '');
  await s.waitForFunction(() => document.querySelectorAll('#feed .item').length === 2);
  await s.click('#filterbar [data-f="cat"][data-v="toys"]');
  await s.waitForFunction(() => document.querySelectorAll('#feed .item').length === 1);
  await s.click('#filterbar [data-f="cat"][data-v=""]');
  await s.waitForFunction(() => document.querySelectorAll('#feed .item').length === 2);
  log('search finds "שמלת" when typing "שמלה"; category filter narrows');

  // ---------------------------------------------------------------- buyer (desktop, English)
  const bCtx = await context({ viewport: { width: 1366, height: 900 }, locale: 'en-US' });
  await bCtx.addInitScript(() => localStorage.setItem('nus-lang', 'en'));
  const b = await page(bCtx);
  await b.goto(BASE);
  await b.waitForFunction(() => document.querySelectorAll('#feed .item').length === 2);
  await b.screenshot({ path: `${SHOTS}/06-desktop-feed-en.png` });
  await b.click('#feed .item:has-text("Floral")');
  await b.waitForSelector('.detail h2');
  assert.equal(await b.textContent('.detail h2'), 'Floral baby dress, Next');
  assert.match(await b.textContent('.detail .translated'), /Auto-translated/);
  log('English reader sees the corrected translation, marked auto-translated');
  await b.click('[data-orig]');
  assert.equal(await b.textContent('.detail h2'), 'שמלת פרחים לתינוקת');
  await b.click('[data-orig]');
  assert.equal(await b.locator('#contact a[href^="tel:"]').count(), 0, 'no phone for guests');
  await b.screenshot({ path: `${SHOTS}/07-desktop-detail.png` });
  await b.click('[data-msg]');
  await signIn(b, 'david@example.com', 'David');
  log('buyer signs in from the message button');
  await b.goto(BASE + '#feed');
  await b.waitForSelector('#feed .item');
  await b.click('#feed .item:has-text("Floral")');
  await b.waitForSelector('#contact a[href^="tel:"]');
  assert.match(await b.getAttribute('#contact a[href*="wa.me"]', 'href'), /wa\.me\/972521234567/);
  log('signed-in buyer sees WhatsApp and call buttons with the right number');
  await b.click('[data-msg]');
  await b.waitForSelector('#composer');
  await b.fill('#mtext', 'Hi, is it still available? Can I come today?');
  await b.click('#composer button');
  await b.waitForSelector('.msg.me');
  log('buyer sends a message');

  // Seller gets the unread badge and replies.
  await s.waitForSelector('#nav a[href="#inbox"] .badge', { timeout: 10000 });
  log('seller sees the unread badge without reloading');
  await s.click('#nav a[href="#inbox"]');
  await s.waitForSelector('#app a.row');
  await s.screenshot({ path: `${SHOTS}/08-inbox.png` });
  await s.click('#app a.row');
  await s.waitForSelector('.msg:not(.me)');
  await s.fill('#mtext', 'כן, אפשר אחרי 5');
  await s.click('#composer button');
  await b.waitForFunction(() => [...document.querySelectorAll('.msg:not(.me) .bubble')].some((x) => x.textContent.includes('אחרי 5')));
  await s.waitForFunction(() => !document.querySelector('#nav a[href="#inbox"] .badge'));
  log('reply arrives live; badge clears once read');
  await s.screenshot({ path: `${SHOTS}/09-thread.png` });

  // Buyer posts in Wanted, seller sees it.
  await b.goto(BASE + '#wanted');
  await b.click('#addw');
  await b.fill('#w-text', 'White winter coat for a girl, size 8-10');
  await b.click('[data-pub]');
  await b.waitForSelector('.wanted .row.mine');
  log('buyer posts in Wanted (one post per person)');
  await s.goto(BASE + '#wanted');
  await s.waitForSelector('.wanted [data-match]');
  assert.match(await s.textContent('.wanted .t1'), /\[he\] White winter coat/);
  await s.screenshot({ path: `${SHOTS}/10-wanted.png` });
  log('Hebrew reader sees the Wanted post translated');

  // Saved search and the "new" counter.
  await b.goto(BASE + '#feed');
  await b.click('.side [data-f="who"][data-v="unisex"]');
  await b.waitForFunction(() => document.querySelectorAll('#feed .item').length === 1);
  await b.click('#savesearch');
  await b.waitForSelector('#toast.on');
  log('buyer saves a filtered search');

  // Seller: mark reserved, then sold; feed reflects it.
  await s.goto(BASE + '#mine');
  await s.waitForSelector('.mrow');
  await s.screenshot({ path: `${SHOTS}/11-mine.png`, fullPage: true });
  await s.locator('.mrow:has-text("שמלת") [data-act="reserved"]').click();
  await s.waitForSelector('.mrow:has-text("שמלת") .tag.warn');
  await b.goto(BASE + '#feed');
  await b.click('.side [data-clear]');
  await b.waitForFunction(() => document.querySelectorAll('#feed .item').length === 2);
  assert.match(await b.textContent('#feed .item:has-text("Floral")'), /Reserved/);
  log('reserved listing stays in the feed with a Reserved badge');
  await s.locator('.mrow:has-text("שמלת") [data-act="sold"]').click();
  await s.waitForSelector('.mrow:has-text("שמלת") .tag.grey');
  await b.reload();
  await b.waitForFunction(() => document.querySelectorAll('#feed .item').length === 1);
  log('sold listing leaves the feed');

  // Report.
  await b.click('#feed .item');
  await b.waitForSelector('[data-report]');
  await b.click('[data-report]');
  await b.click('[data-r="notnew"]');
  await b.click('[data-send]');
  await b.waitForSelector('#toast.on');
  log('buyer reports a listing');

  // Language switch and dark mode render.
  await s.goto(BASE + '#feed');
  await s.click('#langbtn');
  await s.waitForFunction(() => document.documentElement.dir === 'ltr');
  await s.click('#themebtn');
  await s.waitForSelector('#feed .item');
  await s.screenshot({ path: `${SHOTS}/12-mobile-en-dark.png` });
  log('language and theme switch in place');

  // Admin page.
  await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/config/admins`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: { emails: { arrayValue: { values: [{ stringValue: 'rachel@example.com' }] } } } }),
  });
  globalThis.__admin = { s, b };
} catch (e) {
  console.error('FAILED at step', step + 1, e);
  errors.push(String(e && e.stack || e));
}

if (globalThis.__admin && !errors.length) {
  try {
    const { runAdmin } = await import('./e2e-admin.mjs').catch(() => ({}));
    if (runAdmin) await runAdmin(globalThis.__admin, { BASE, SHOTS, log });
  } catch (e) { console.error('FAILED in admin', e); errors.push(String(e && e.stack || e)); }
}

await browser.close();
srv.close();
if (errors.length) { console.error('\nErrors:\n' + errors.join('\n')); process.exit(1); }
console.log('\nAll e2e steps passed.');
