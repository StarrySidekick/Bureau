// Smoke test for Bureau. Needs a server running (scripts/serve.sh) and playwright.
//   npm i playwright && scripts/serve.sh & && node test/smoke.mjs
// Every value in the printed summary should be truthy and `errors` should be [].
// Screenshots land in test/shots/ — look at them, this is a visual app.
import { chromium } from 'playwright';
const URL = process.env.BUREAU_URL || 'http://127.0.0.1:8000/index.html';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  const shot = async (n) => { await page.waitForTimeout(320); await page.screenshot({ path: `test/shots/${n}.png` }); };

  await page.goto(URL);
  await page.waitForTimeout(700);
  await shot('01-desk');

  // manifest + sw
  const manifestOk = await page.evaluate(async () => {
    const r = await fetch('manifest.webmanifest'); const j = await r.json();
    return j.name === 'Bureau' && j.icons.length === 3;
  });
  await page.waitForTimeout(900);
  const swReady = await page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false));

  // --- persistence: make a change, reload, check it survived
  await page.click('.navitem[data-drawer="d_in"]');
  await page.waitForTimeout(250);
  await page.fill('#qa', 'Order the brass pulls #bureau !today');
  await page.press('#qa', 'Enter');
  await page.waitForTimeout(400);
  await page.click('.navitem[data-view="settings"]');
  await shot('02-settings');
  await page.click('[data-theme2="walnut"]');
  await page.waitForTimeout(250);
  await shot('03-walnut-settings');

  await page.reload();
  await page.waitForTimeout(700);
  const survived = await page.evaluate(() =>
    BUREAU.state.objects.some(o => o.title.includes('brass pulls')));
  const themeSurvived = await page.evaluate(() => BUREAU.state.theme);
  await page.click('.navitem[data-view="settings"]');
  await page.waitForTimeout(250);
  await page.click('[data-theme2="paper"]');
  await page.waitForTimeout(200);

  // --- editing the phone layout from the desktop
  await page.click('[data-layout="phone"]');
  await page.waitForTimeout(400);
  await shot('04-edit-phone-layout');
  const gridClass = await page.getAttribute('#drawergrid', 'class');
  await page.click('[data-act="stopedit"]');
  await page.waitForTimeout(300);
  await shot('05-back-to-desk');

  // --- offline
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForTimeout(900);
  const offlineWorks = await page.evaluate(() => !!document.querySelector('.drawer'));
  await shot('06-offline');
  await ctx.setOffline(false);

  // --- real phone viewport
  const phone = await ctx.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(URL);
  await phone.waitForTimeout(700);
  await phone.screenshot({ path: 'test/shots/07-phone.png' });
  const railHidden = await phone.evaluate(() => getComputedStyle(document.querySelector('.rail')).display === 'none');
  const tabbarShown = await phone.evaluate(() => getComputedStyle(document.querySelector('.tabbar')).display !== 'none');
  await phone.click('.tabbar button >> nth=2');
  await phone.waitForTimeout(350);
  await phone.screenshot({ path: 'test/shots/08-phone-keep.png' });
  await phone.click('.tabbar button >> nth=0');
  await phone.waitForTimeout(300);
  await phone.click('.drawer[data-drawer="d_write"]');
  await phone.waitForTimeout(350);
  await phone.screenshot({ path: 'test/shots/09-phone-drawer.png' });

  console.log(JSON.stringify({
    errors: errs, manifestOk, swReady, survived, themeSurvived,
    gridClass, offlineWorks, railHidden, tabbarShown
  }, null, 2));
  await browser.close();
})();
