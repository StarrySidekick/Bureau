// Scale probe for Bureau: how a render's cost grows with the number of objects,
// and where the time actually goes. Not a test — a measurement, run by hand.
//   scripts/serve.sh & ; node test/scale-probe.mjs
//
// It reports two kinds of number and they are not worth the same.
//
// The **milliseconds** are the honest shape of the curve and nothing else.
// DIAGNOSTIC §2 says why: re-running them after a pass gave figures 30–50%
// higher at every size, including sizes where nothing had changed, and `save`
// — whose code path had not been touched at all — tripled on the same 42 KB.
// That is the machine, not the app. Read them against each other within one
// run; a timing comparison across sessions is worth nothing here.
//
// The **counts** are the ones that hold still. A style recalculation and a
// layout are things that either happen or do not; contention changes how long
// they take and never how many there are. So `layouts` and `styles` — taken
// off the CDP performance counters either side of one render — answer "did
// this change make the browser do more work?" where a stopwatch cannot, and
// `nodes` / `perTile` answer "how many elements is a tile now made of?", which
// is the question every spliced layer since decision 99 has raised. If a
// number in here is going to be quoted in a commit message, quote one of
// these. CLAUDE.md states the same rule for the fps sweep.
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
  const tileEls = document.querySelectorAll('#app .grid > *');
  /* Counted *inside the tiles*, not across the board: the bar, the rail and
     the checkerboard are a fixed overhead, and dividing the whole board by the
     tile count made a busy desk look like it had lighter tiles than an empty
     one. This number is what a new spliced layer actually costs.

     Read it **down the same row across versions**, never along a run: the
     objects poured on are 1×1, which draw as the type's mark and nothing else
     (decision 26), so the mix gets lighter as the desk fills and the figure
     falls for reasons that have nothing to do with what a tile is made of.
     At the size Bureau ships it is the honest one. */
  let inTiles = 0;
  tileEls.forEach(t => { inTiles += 1 + t.querySelectorAll('*').length; });
  return {
    objects: S.objects.length,
    render: whole, build: build || null, save: store,
    bytes: (localStorage.getItem('bureau.v1') || '').length,
    tiles: tileEls.length,
    nodes: document.querySelectorAll('#app *').length,
    perTile: tileEls.length ? +(inTiles / tileEls.length).toFixed(1) : null,
    // the built string's own length — deterministic, and what `build` tracks
    chars: B.viewHTML ? B.viewHTML().length : null
  };
}, add);

/* Style recalculations and layouts across one render, off Chrome's own
   counters. Deterministic where the clock is not: these are *counts*, so a
   noisy machine changes how long they take and never how many there are.
   A render that suddenly does two layouts instead of one is the regression
   `sizeGrid()` was written to prevent (decision 59) and it is invisible in
   milliseconds on a machine under load. */
const counted = async (page, cdp) => {
  const read = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  await page.evaluate(() => window.BUREAU.render());   // warm, so first-paint work is not counted
  const a = await read();
  await page.evaluate(() => window.BUREAU.render());
  const b = await read();
  return {
    layouts: (b.LayoutCount || 0) - (a.LayoutCount || 0),
    styles: (b.RecalcStyleCount || 0) - (a.RecalcStyleCount || 0)
  };
};

(async () => {
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const out = {};
  for (const [label, viewport] of [['mac', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.goto(URL); await page.waitForTimeout(800);
    const steps = [];
    for (const add of [0, 200, 800, 2000]) {
      const step = await probe(page, add);
      steps.push(Object.assign(step, await counted(page, cdp)));
    }
    out[label] = { steps, errs };
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
