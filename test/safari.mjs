// The Safari check (2026-09-30). Timothy designs Bureau almost entirely on
// his iPhone, in the installed Safari PWA, so this is the first thing a change
// is looked at in: the app in WebKit, at an iPhone's size and density, with a
// touch screen. It is not the smoke suite — that is still the gate, and runs
// on Chromium — it is the few things that go wrong in Safari and not in
// Chrome, and a set of screenshots to look at. Decision 275 is why it exists:
// Safari zoomed container units twice, and every Chromium test passed.
//
//   scripts/serve.sh &            # the app, over http
//   scripts/webkit.sh             # WebKit, once per container (the session hook starts it)
//   node test/safari.mjs          # a minute; screenshots in test/shots/safari/
//
// What it cannot do: be installed. `display-mode: standalone` is not something
// Playwright can emulate, so the home-screen app's own chrome (the status bar,
// the safe areas as an installed app has them) is only approximated by the
// viewport being the whole screen.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const URL = process.env.BUREAU_URL || 'http://127.0.0.1:8000/index.html';
const DIR = process.env.BUREAU_WEBKIT_DIR || `${process.env.HOME}/.cache/bureau-webkit`;
try { execFileSync('scripts/webkit.sh', { stdio: ['ignore', 'ignore', 'inherit'] }); }
catch (e) { console.error('safari: WebKit is not installed and scripts/webkit.sh could not install it'); process.exit(2); }
process.env.PLAYWRIGHT_BROWSERS_PATH = DIR;
const { webkit } = await import('../node_modules/playwright/index.mjs');

const SHOTS = 'test/shots/safari';
mkdirSync(SHOTS, { recursive: true });
const browser = await webkit.launch();
// an iPhone 15 held upright, the whole screen as an installed app has it
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const shot = n => page.screenshot({ path: `${SHOTS}/${n}.png` });
const nap = ms => page.waitForTimeout(ms);

await page.goto(URL); await nap(1500);
const out = {};

// ---- it loads, and a phone board is eight cells across -------------------
out.loads = await page.evaluate(() => {
  const g = document.querySelector('#drawergrid'), sc = document.querySelector('#app .deskscroll');
  if (!g || !sc || !window.BUREAU) return false;
  const cell = parseFloat(g.style.getPropertyValue('--rowh'));
  return document.querySelectorAll('#drawergrid > .drawer').length > 3 && Math.abs(sc.clientWidth / cell - 8) < 0.2;
});
await shot('01-desk');

// ---- a zoomed thing keeps its proportions (decision 275) -----------------
// The knob, the name and the tile are measured at three zooms: each is a
// fixed fraction of the tile, whatever the zoom.
const ratios = [];
for (const z of [1, 2, 0.6]) {
  ratios.push(await page.evaluate(async z => {
    BUREAU.zoomCommit('root', z); await new Promise(r => setTimeout(r, 350));
    const t = document.querySelector('#drawergrid .drawer[data-drawer="d_in"]'); if (!t) return null;
    const k = t.querySelector('.pull'), tr = t.getBoundingClientRect();
    const name = [...t.querySelectorAll('*')].find(e => e.children.length === 0 && /Inbox/.test(e.textContent));
    return { knob: k ? k.getBoundingClientRect().width / tr.width : 0,
             name: name ? name.getBoundingClientRect().height / tr.height : 0 };
  }, z));
  await shot(`02-zoom-${z}`);
}
const same = (a, b) => a > 0 && Math.abs(a / b - 1) < 0.04;
out.zoomKeepsProportions = ratios.every(r => r && same(r.knob, ratios[0].knob) && same(r.name, ratios[0].name));
out.ratios = ratios.map(r => r && `${r.knob.toFixed(3)}/${r.name.toFixed(3)}`).join(' ');
await page.evaluate(() => { BUREAU.setZoom('root', 1); BUREAU.render(); });
await nap(250);

// ---- a drag at a zoom lands under the finger -----------------------------
const drag = await page.evaluate(async () => {
  const S = BUREAU.state; S.look.locked = false;
  // somewhere with two empty rows above it, since a tile is a cell (decision 283)
  S.objects.find(o => o.id === 'd_in').phone = { x: 1, y: 9, w: 2, h: 2 }; BUREAU.render();
  BUREAU.zoomCommit('root', 1.6); await new Promise(r => setTimeout(r, 350));
  const t = document.querySelector('#drawergrid .drawer[data-drawer="d_in"]');
  t.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 150));
  const b = t.getBoundingClientRect();
  const ref = S.objects.find(o => o.id !== 'd_in' && (o.parent || 'root') === 'root' && o.phone && o.phone.x);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, before: { ...S.objects.find(o => o.id === 'd_in').phone },
           ref: ref.id, refBefore: { ...ref.phone },
           cell: parseFloat(document.querySelector('#drawergrid').style.getPropertyValue('--rowh')) };
});
await page.mouse.move(drag.x, drag.y); await page.mouse.down(); await nap(350);
await page.mouse.move(drag.x, drag.y - 2 * drag.cell, { steps: 8 }); await nap(80);
const follows = await page.evaluate(() => {
  const b = document.querySelector('#drawergrid .drawer[data-drawer="d_in"]').getBoundingClientRect(); return b.y + b.height / 2; });
await page.mouse.up(); await nap(300);
// a board fits itself to what is on it (decision 285), so every number may
// have moved by the same amount: measured against a neighbour
const [after, refAfter] = await page.evaluate(r => [BUREAU.state.objects.find(o => o.id === 'd_in').phone,
  BUREAU.state.objects.find(o => o.id === r).phone], drag.ref);
out.aZoomedDragFollowsTheFinger = Math.abs((drag.y - follows) / drag.cell - 2) < 0.15;
out.andLandsWhereItWasTaken = after.y - refAfter.y === drag.before.y - drag.refBefore.y - 2
  && after.x - refAfter.x === drag.before.x - drag.refBefore.x;
await page.evaluate(([b, r, r0]) => { const S = BUREAU.state, o = S.objects.find(o => o.id === 'd_in'),
  ref = S.objects.find(o => o.id === r).phone;
  o.phone = { ...b, x: b.x + ref.x - r0.x, y: b.y + ref.y - r0.y };
  BUREAU.setZoom('root', 1); BUREAU.render(); }, [drag.before, drag.ref, drag.refBefore]);
await nap(250);

// ---- a synthetic touch reaches the board: a rigid swipe moves one tile ---
/* Desktop WebKit has no `Touch` constructor, so the events are plain ones
   carrying their touch lists, the way the smoke suite drives two fingers;
   Bureau's handlers read nothing else off them. */
out.rigidSwipeMovesOneTile = await page.evaluate(async () => {
  const nap = n => new Promise(r => setTimeout(r, n));
  BUREAU.state.look.flow = 'rigid'; BUREAU.render(); await nap(250);
  const sc = document.querySelector('#app .deskscroll'), g = document.querySelector('#drawergrid');
  const cell = parseFloat(g.style.getPropertyValue('--rowh')), top0 = sc.scrollTop;
  const touch = (x, y) => ({ identifier: 1, target: g, clientX: x, clientY: y, pageX: x, pageY: y });
  const fire = (type, pts) => { const ts = pts.map(p => touch(p[0], p[1]));
    const e = new Event(type, { bubbles: true, cancelable: true });
    e.touches = ts; e.targetTouches = ts; e.changedTouches = ts.length ? ts : [touch(200, 300)];
    g.dispatchEvent(e); };
  fire('touchstart', [[200, 520]]);
  for (let y = 520; y >= 380; y -= 20) { fire('touchmove', [[200, y]]); await nap(16); }
  fire('touchend', []); await nap(900);
  const moved = sc.scrollTop - top0;
  delete BUREAU.state.look.flow; BUREAU.render();
  // a tile's height, or a screenful of whole cells once a tile is a cell (decision 283)
  const step = BUREAU.TILE === 1 ? Math.floor(sc.clientHeight / cell) * cell : 5 * cell;
  return Math.abs(moved - step) < 2 || Math.abs(sc.scrollTop - (sc.scrollHeight - sc.clientHeight)) < 2;
});

// ---- a board is as big as what is on it (decision 285) -----------------
/* No carving: the desk is everything on it with a margin of empty cells
   round it. A thing put out in the margin grows the board past it, and the
   view holds still while the numbers under it move. Locked, the empty cells
   are the carcass's wood and only what things stand on keeps its paper. */
const fit = await page.evaluate(async () => {
  const nap = n => new Promise(r => setTimeout(r, n));
  const S = BUREAU.state; S.look.locked = false; BUREAU.zoomCommit('root', 1); await nap(350);
  const box = () => { let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
    S.objects.forEach(o => { if ((o.parent || 'root') !== 'root' || o.done) return;
      ['desk', 'phone'].forEach(dv => { const b = o[dv]; if (!b || !b.x || !b.w) return;
        x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w - 1); y1 = Math.max(y1, b.y + (b.h || 1) - 1); }); });
    return { x0, y0, x1, y1 }; };
  const r0 = BUREAU.shelvesOf('root'), b0 = box();
  // the left and the top only ever grow, so at least the margin there; the
  // right and the bottom follow what is there exactly
  const margin = b0.x0 - 1 >= 8 && b0.y0 - 1 >= 8 && r0.w - b0.x1 === 8 && r0.h - b0.y1 === 8;
  // a 1×1 put out at the far left of the margin: the board grows that way
  const t = S.objects.find(o => o.id === 'd_in'), ref = S.objects.find(o => o.id !== 'd_in' && (o.parent || 'root') === 'root' && o.phone && o.phone.x);
  const refAt = { ...ref.phone };
  const g = document.querySelector('#drawergrid').getBoundingClientRect(), r = ref && document.querySelector(`#drawergrid [data-drawer="${ref.id}"],#drawergrid [data-id="${ref.id}"]`);
  const before = r && r.getBoundingClientRect().left;
  t.phone = { x: 1, y: t.phone.y, w: 1, h: 1 }; BUREAU.render(); await nap(200);
  const r1 = BUREAU.shelvesOf('root'), b1 = box();
  const r2 = r && document.querySelector(`#drawergrid [data-drawer="${ref.id}"],#drawergrid [data-id="${ref.id}"]`);
  return { margin, grew: r1.w > r0.w && b1.x0 - 1 === 8, shifted: ref.phone.x - refAt.x,
           still: !r2 || Math.abs(r2.getBoundingClientRect().left - before) < 2,
           carved: !!document.querySelector('.tilemap'), r0, r1 };
});
out.aBoardIsItsThingsAndAMargin = fit.margin;
out.aThingInTheMarginGrowsIt = fit.grew && fit.shifted === 8;
out.andTheViewHoldsStill = fit.still;
await shot('03-grown');
out.lockedIsAShowcase = await page.evaluate(async () => {
  BUREAU.state.look.locked = true; BUREAU.render(); await new Promise(r => setTimeout(r, 200));
  const g = document.querySelector('#drawergrid');
  return g.classList.contains('showcase') && !!g.querySelector('.showpaper') && !!g.querySelector('.carve')
    && getComputedStyle(g, '::before').backgroundImage === 'none';
});
await shot('04-showcase');
await page.evaluate(() => { BUREAU.state.look.locked = false; BUREAU.render(); });

// ---- tucked away: a flick down on the front, and the board fills ---------
/* The lip and the drawer front put away (2026-09-30). Driven with the pointer
   the rail's own handler reads: a flick down on the front tucks, a hold on the
   floating knob brings it back. */
await page.evaluate(async () => { BUREAU.setZoom('root', 1); BUREAU.render();
  await new Promise(r => setTimeout(r, 300)); });
const railAt = () => page.evaluate(() => { const r = document.querySelector('.deskrail').getBoundingClientRect();
  return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.35, kx: r.left + r.width / 2, ky: r.top + r.height / 2 }; });
const before = await page.evaluate(() => document.querySelector('#app .deskscroll').getBoundingClientRect().height);
let at = await railAt();
await page.mouse.move(at.x, at.y); await page.mouse.down();
for (let d = 4; d <= 36; d += 8) { await page.mouse.move(at.x, at.y + d); await nap(16); }
await page.mouse.up(); await nap(600);
const tuck = await page.evaluate(() => ({ on: !!BUREAU.state.look.tuck, lip: !!document.querySelector('.toplip'),
  knob: !!document.querySelector('.deskrail.tucked .railknob'),
  h: document.querySelector('#app .deskscroll').getBoundingClientRect().height }));
out.aFlickDownTucksTheBarsAway = tuck.on && !tuck.lip && tuck.knob && tuck.h > before + 40;
await shot('05a-tucked');
at = await railAt();
await page.mouse.move(at.kx, at.ky); await page.mouse.down(); await nap(700); await page.mouse.up(); await nap(600);
out.holdingTheKnobBringsThemBack = await page.evaluate(() => !BUREAU.state.look.tuck
  && !!document.querySelector('.toplip') && !document.querySelector('.deskrail.tucked'));
out.stillHome = await page.evaluate(() => BUREAU.state.view === 'desk');
await shot('05b-untucked');

// ---- into a drawer and back ----------------------------------------------
out.aDrawerOpens = await page.evaluate(async () => {
  BUREAU.setZoom('root', 1); const S = BUREAU.state;
  S.view = 'drawer'; S.drawerId = 'd_studio'; BUREAU.render(); await new Promise(r => setTimeout(r, 400));
  return document.querySelector('#drawergrid')?.dataset.gridfor === 'd_studio'
    && document.querySelectorAll('#drawergrid > .drawer').length > 0;
});
await shot('05-drawer');

out.errors = errs;
console.log(JSON.stringify(out, null, 2));
await browser.close();
const bad = Object.entries(out).filter(([k, v]) => v === false);
if (errs.length || bad.length) { console.error('safari: ' + (bad.map(([k]) => k).join(', ') || 'page errors')); process.exit(1); }
