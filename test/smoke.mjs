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
  // No sidebar any more: drawers are opened from the desk itself.
  await page.click('.grid .drawer[data-drawer="d_in"]');
  await page.waitForTimeout(250);
  await page.fill('#qa', 'Order the brass pulls #bureau !today');
  await page.press('#qa', 'Enter');
  await page.waitForTimeout(400);
  await page.click('.crumbs [data-view="desk"]');   // the tab bar is phone-only
  await page.waitForTimeout(250);
  await page.click('.grid .drawer[data-ctl="settings"]');
  await shot('02-settings');
  await page.click('[data-theme2="walnut"]');
  await page.waitForTimeout(250);
  await shot('03-walnut-settings');

  await page.reload();
  await page.waitForTimeout(700);
  const survived = await page.evaluate(() =>
    BUREAU.state.objects.some(o => (o.title||'').includes('brass pulls')));
  const themeSurvived = await page.evaluate(() => BUREAU.state.theme);
  await page.click('.grid .drawer[data-ctl="settings"]');
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
  // the sidebar was removed on purpose — assert it is genuinely gone
  const railGone = await phone.evaluate(() => !document.querySelector('.rail'));
  const tabbarShown = await phone.evaluate(() => getComputedStyle(document.querySelector('.tabbar')).display !== 'none');
  await phone.click('.tabbar button >> nth=2');
  await phone.waitForTimeout(350);
  await phone.screenshot({ path: 'test/shots/08-phone-keep.png' });
  await phone.click('.tabbar button >> nth=0');
  await phone.waitForTimeout(300);
  await phone.click('.drawer[data-drawer="d_write"]');
  await phone.waitForTimeout(350);
  await phone.screenshot({ path: 'test/shots/09-phone-drawer.png' });

  // --- press and hold enters arrange, a tap does not (already on the desk)
  await page.waitForTimeout(300);
  const holdArranges = await page.evaluate(async () => {
    const t = document.querySelector('.grid .drawer[data-drawer]');
    const r = t.getBoundingClientRect();
    const o = { bubbles:true, clientX:r.x+r.width/2, clientY:r.y+r.height/2, pointerId:9, isPrimary:true };
    t.dispatchEvent(new PointerEvent('pointerdown', o));
    await new Promise(r2 => setTimeout(r2, 600));
    const on = BUREAU.state.arrange;
    t.dispatchEvent(new PointerEvent('pointerup', o));
    return on;
  });
  await shot('10-arrange-by-hold');

  console.log(JSON.stringify({
    errors: errs, manifestOk, swReady, survived, themeSurvived,
    gridClass, offlineWorks, railGone, tabbarShown, holdArranges
  }, null, 2));
  await browser.close();
})();
