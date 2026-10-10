// Admin steps, run by e2e.mjs after the main flow. Rachel (the seller) is an admin.
import assert from 'node:assert/strict';

export async function runAdmin({ s, b }, { BASE, SHOTS, log }) {
  const ADMIN = BASE.replace('/?emu=1', '/admin.html?emu=1');
  const a = await s.context().newPage();
  await a.setViewportSize({ width: 1200, height: 900 });
  a.on('pageerror', (e) => { throw e; });
  a.on('dialog', (d) => d.accept());

  await a.goto(ADMIN);
  await a.waitForSelector('.kpis .kpi b');
  await a.waitForFunction(() => [...document.querySelectorAll('.kpi b')].every((x) => x.textContent !== '-'));
  await a.screenshot({ path: `${SHOTS}/13-admin-home.png` });
  log('admin sees the overview numbers');

  await a.click('a[href="#reports"]');
  await a.waitForSelector('[data-done]');
  assert.match(await a.textContent('#app'), /זה לא מוצר חדש/);
  await a.screenshot({ path: `${SHOTS}/14-admin-reports.png` });
  await a.click('[data-hide]');
  await a.waitForSelector('[data-done]');
  await a.click('[data-done]');
  await a.waitForSelector('text=אין דיווחים פתוחים');
  log('admin hides the reported listing and closes the report');

  await b.goto(BASE + '#feed');
  await b.waitForSelector('#feed .empty');
  log('hidden listing is gone from the public feed');

  await a.click('a[href="#listings"]');
  await a.waitForSelector('#lrows .arow');
  await a.locator('#lrows .arow:has-text("Magnetic") [data-a="restore"]').click();
  await a.locator('#lrows .arow:has-text("Magnetic") [data-a="promo"]').click();
  await a.click('[data-d="7"]');
  await a.waitForSelector('#lrows .arow:has-text("Magnetic") [data-a="unpromo"]');
  await a.screenshot({ path: `${SHOTS}/15-admin-listings.png` });
  await b.reload();
  await b.waitForSelector('#feed .item .promo');
  assert.match(await b.textContent('#feed .item .promo'), /Featured/);
  log('admin restores and promotes; the feed shows it as Featured');

  await a.click('a[href="#lists"]');
  await a.waitForSelector('#ed-hoods .ledit');
  await a.click('[data-add="hoods"]');
  const last = a.locator('#ed-hoods .ledit').last();
  await last.locator('input[data-k="he"]').fill('רמת אברהם');
  await last.locator('input[data-k="en"]').fill('Ramat Avraham');
  await a.click('#savelists');
  await a.waitForSelector('#toast.on');
  await a.screenshot({ path: `${SHOTS}/16-admin-lists.png`, fullPage: true });
  await b.goto(BASE + '#post');
  await b.waitForSelector('#f-hood');
  await b.waitForFunction(() => [...document.querySelectorAll('#f-hood option')].some((o) => o.textContent === 'Ramat Avraham'));
  log('admin adds a neighborhood; it appears in the post form for everyone');

  await a.click('a[href="#users"]');
  await a.waitForSelector('#urows .arow');
  await a.locator('#urows .arow:has-text("David") [data-block]').click();
  await a.click('[data-yes]');
  await a.waitForSelector('#urows .arow:has-text("David") .tag.bad');
  log('admin blocks a user');
  await b.goto(BASE + '#wanted');
  await b.waitForSelector('#addw');
  await b.reload();
  await b.waitForSelector('#addw');
  await b.click('#addw');
  await b.fill('#w-text', 'Another post');
  await b.click('[data-pub]');
  await b.waitForSelector('#toast.on');
  assert.match(await b.textContent('#toast'), /blocked/i);
  log('blocked user cannot post');

  await a.click('a[href="#home"]');
  await a.waitForSelector('#maint');
  await a.click('#maint');
  await a.waitForFunction(() => /לארכיון/.test(document.querySelector('#toast').textContent));
  log('maintenance runs');

  const d = await b.context().newPage();
  await d.goto(ADMIN);
  await d.waitForSelector('text=אין הרשאה');
  log('non-admin is refused on the admin page');
  await d.close();
  await a.close();
}
