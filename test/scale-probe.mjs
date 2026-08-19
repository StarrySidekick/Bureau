// Scale probe for Bureau: how a render's cost grows with the number of objects,
// and where the time actually goes. Not a test — a measurement, run by hand.
//   scripts/serve.sh & ; node test/scale-probe.mjs
import { chromium } from 'playwright';
const URL = process.env.BUREAU_URL || 'http://127.0.0.1:8000/index.html';
const CHROME = process.env.BUREAU_CHROME;

const probe = async (page, add) => page.evaluate((add) => {
  const B = window.BUREAU, S = B.state;
  const drawers = S.objects.filter(o => o.kind === 'drawer');
  /* Half loose on a desk, half filed in ordinary drawers — the shape a desk
     grows into. Boxes are handed out directly rather than through create():
     freeSpot() is O(board × siblings) per placement and would dominate the
     setup instead of the thing being measured. */
  const base = S.objects.length;
  for (let i = 0; i < add; i++) {
    const home = i % 2 ? 'root' : (drawers[i % drawers.length] || {}).id || 'root';
    S.objects.push({
      id: 'z' + base + '_' + i, kind: i % 3 ? 'task' : 'note',
      title: 'Probe ' + i, body: 'x'.repeat(40),
      tags: i % 5 ? [] : ['probe'], parent: home, done: false, due: null, ord: i,
      created: '2026-01-01',
      desk: { x: 1 + (i % 20), y: 1 + Math.floor(i / 20), w: 1, h: 1 },
      phone: { x: 1 + (i % 8), y: 1 + Math.floor(i / 8), w: 1, h: 1 }
    });
  }
  const med = (f, n = 7) => { const t = []; for (let i = 0; i < n; i++) { const a = performance.now(); f(); t.push(performance.now() - a); } t.sort((x, y) => x - y); return +t[Math.floor(n / 2)].toFixed(1); };
  const whole = med(() => B.render());
  const build = med(() => B.viewHTML && B.viewHTML());   // string build alone, when exposed
  const store = med(() => B.save(), 3);                  // writeNow: stringify + localStorage
  return {
    objects: S.objects.length,
    render: whole, build: build || null, save: store,
    bytes: (localStorage.getItem('bureau.v1') || '').length,
    tiles: document.querySelectorAll('#app .grid > *').length
  };
}, add);

(async () => {
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const out = {};
  for (const [label, viewport] of [['mac', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL); await page.waitForTimeout(800);
    const steps = [];
    for (const add of [0, 200, 800, 2000]) steps.push(await probe(page, add));
    out[label] = { steps, errs };
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
