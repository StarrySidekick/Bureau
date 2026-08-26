// Checks the assembled Pages artifact — Bureau at the root with the Activinator
// hand-off stub at /activinator/ — rather than the app on its own.
//
//   (cd web && python3 -m http.server 8020) & node test/deploy.mjs
//
// Activinator lives in its own repository now, but two seams from the years of
// sharing remain and both are here. The stub at /activinator/ must send an old
// installed copy to the new address, and its sw.js must take the old worker
// down — clear the activinator- caches, unregister — without touching Bureau's.
// And Bureau's own worker must keep its hands off /activinator/: its navigation
// branch stores whatever it fetched as Bureau's own shell, so without the guard
// in web/sw.js one visit to the stub left Bureau opening into it offline.
import { chromium } from 'playwright';
const URL = process.env.SITE_URL || 'http://127.0.0.1:8020';
const CHROME = process.env.BUREAU_CHROME;
const NEW_HOME = 'https://starrysidekick.github.io/Activinator/';

// A cache store belongs to the origin, not to a service worker's scope, so
// every worker on the origin can reap every cache. Count them all.
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

  // The new address is another repository's deploy, so it isn't in this
  // artifact — stand a marker in for it and assert the redirect arrived.
  await page.route(NEW_HOME + '**', r => r.fulfill({ contentType: 'text/html', body: '<title>NEW-HOME</title>' }));
  await page.route(NEW_HOME, r => r.fulfill({ contentType: 'text/html', body: '<title>NEW-HOME</title>' }));

  await page.goto(URL + '/index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(900);
  const bureauUp = await page.locator('#app .grid').count() > 0;
  const shellBefore = await shellOf(page, URL);

  // An old installed copy left this behind; the stub's worker must clear it.
  await page.evaluate(() => caches.open('activinator-v8').then(c => c.put('/activinator/x', new Response('old'))));
  const before = await cachesOf(page);

  // The visit that used to do the damage. Nothing may repair the shell between
  // here and the offline checks: an online Bureau launch re-fetches index.html
  // and papers over exactly the corruption this is looking for.
  await page.goto(URL + '/activinator/index.html');
  await page.waitForTimeout(600);
  const redirected = (await page.title()) === 'NEW-HOME';

  // The stub's sw.js replaces the worker an installed copy is still running.
  // Registering it from here is the same update path the browser takes; when
  // its activate handler has run, the old caches are gone and so is it.
  await page.goto(URL + '/index.html');
  await page.evaluate(() => navigator.serviceWorker.register('/activinator/sw.js', { scope: '/activinator/' }));
  // Unregistering happens inside the worker's own activate, so give it a
  // moment rather than a deadline. getRegistration falls back to Bureau's
  // root-scope registration by prefix match, so ask about the scope itself.
  const unregistered = await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      const r = await navigator.serviceWorker.getRegistration('/activinator/');
      if (!r || !r.scope.endsWith('/activinator/')) return true;
      await new Promise(res => setTimeout(res, 150));
    }
    return false;
  });
  const after = await cachesOf(page);
  const oldCacheGone = !Object.keys(after).some(k => k.startsWith('activinator-'));

  // Bureau's cache must come through all of that untouched — entry for entry,
  // and with its own shell still in it rather than the stub.
  const bureauKey = Object.keys(before).find(k => k.startsWith('bureau-'));
  const cachesIntact = !!bureauKey && after[bureauKey] === before[bureauKey];
  const shellAfter = await shellOf(page, URL);
  const shellIntact = shellAfter.includes('<title>Bureau</title>') &&
                     !shellAfter.includes('Activinator');

  // …and the symptom, from the other end: Bureau opened offline, straight after.
  await ctx.setOffline(true);
  await page.goto(URL + '/index.html'); await page.waitForTimeout(900);
  const bureauOffline = (await page.title()) === 'Bureau' && await page.locator('#app .grid').count() > 0;
  await ctx.setOffline(false);

  const shellTitle = (shellAfter.match(/<title>([^<]*)<\/title>/) || [, 'MISSING'])[1];
  console.log({ bureauUp, shellBefore: !!shellBefore, redirected, oldCacheGone, unregistered,
    cachesIntact, shellIntact, shellTitle, bureauOffline, caches: { before, after }, errors: errs });
  await browser.close();
  const ok = bureauUp && redirected && oldCacheGone && unregistered && cachesIntact &&
    shellIntact && bureauOffline && !errs.length;
  process.exit(ok ? 0 : 1);
})();
