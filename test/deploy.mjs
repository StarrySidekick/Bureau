// Checks the assembled Pages artifact — Bureau at the root with Activinator at
// /activinator/ — rather than either app on its own.
//
//   mkdir -p _site && cp -r web/. _site/ && cp -r activinator _site/activinator
//   (cd _site && python3 -m http.server 8020) & node test/deploy.mjs
//
// The thing worth testing is the seam: Activinator is served from a path inside
// Bureau's service worker scope, and Bureau's worker stores whatever a
// navigation fetched as its own shell. Without the guard in web/sw.js, opening
// Activinator once left Bureau opening into Activinator whenever it was offline.
import { chromium } from 'playwright';
const URL = process.env.SITE_URL || 'http://127.0.0.1:8020';
const CHROME = process.env.BUREAU_CHROME;

// A cache store belongs to the origin, not to a service worker's scope, so
// both apps' caches sit in the same list and either worker can reap the other's.
const cachesOf = (page) => page.evaluate(async () => {
  const out = {};
  for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).length;
  return out;
});

// The key is absolute: Bureau's worker stores it as './index.html' resolved
// against its own script URL, which is the site root — not against whatever
// page happens to be open when this runs.
const shellOf = (page, root) => page.evaluate(async (root) => {
  for (const k of await caches.keys()) {
    if (!k.startsWith('bureau')) continue;
    const hit = await (await caches.open(k)).match(root + '/index.html');
    if (hit) return (await hit.text()).slice(0, 600);
  }
  return '';
}, root);

(async () => {
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.goto(URL + '/index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(900);
  const bureauUp = await page.locator('#app .grid').count() > 0;
  const shellBefore = await shellOf(page, URL);
  const before = await cachesOf(page);

  // The visit that used to do the damage. Nothing may repair the shell between
  // here and the offline checks: an online Bureau launch re-fetches index.html
  // and papers over exactly the corruption this is looking for.
  await page.goto(URL + '/activinator/index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1200);
  const activinatorUp = await page.locator('#deck .card').count() > 0;

  // Bureau's cache must come through that untouched — entry for entry, and with
  // its own shell still in it rather than the other app's front page.
  const after = await cachesOf(page);
  const bureauKey = Object.keys(before).find(k => k.startsWith('bureau-'));
  const cachesIntact = !!bureauKey && after[bureauKey] === before[bureauKey];
  const shellAfter = await shellOf(page, URL);
  const shellIntact = shellAfter.includes('<title>Bureau</title>') &&
                     !shellAfter.includes('Activinator');

  // …and the symptom, from the other end: Bureau opened offline, straight after.
  await ctx.setOffline(true);
  await page.goto(URL + '/index.html'); await page.waitForTimeout(900);
  const bureauOffline = (await page.title()) === 'Bureau' && await page.locator('#app .grid').count() > 0;
  await page.goto(URL + '/activinator/index.html'); await page.waitForTimeout(900);
  const activinatorOffline = (await page.title()) === 'Activinator' && await page.locator('#deck .card').count() > 0;
  await ctx.setOffline(false);

  const shellTitle = (shellAfter.match(/<title>([^<]*)<\/title>/) || [, 'MISSING'])[1];
  console.log({ bureauUp, activinatorUp, shellBefore: !!shellBefore, cachesIntact,
    shellIntact, shellTitle, bureauOffline, activinatorOffline, caches: { before, after }, errors: errs });
  await browser.close();
  const ok = bureauUp && activinatorUp && cachesIntact && shellIntact &&
    bureauOffline && activinatorOffline && !errs.length;
  process.exit(ok ? 0 : 1);
})();
