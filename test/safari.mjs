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
  BUREAU.zoomCommit('root', 1.6); await new Promise(r => setTimeout(r, 350));
  const t = document.querySelector('#drawergrid .drawer[data-drawer="d_in"]');
  t.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 150));
  const b = t.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, before: { ...S.objects.find(o => o.id === 'd_in').phone },
           cell: parseFloat(document.querySelector('#drawergrid').style.getPropertyValue('--rowh')) };
});
await page.mouse.move(drag.x, drag.y); await page.mouse.down(); await nap(350);
await page.mouse.move(drag.x, drag.y - 2 * drag.cell, { steps: 8 }); await nap(80);
const follows = await page.evaluate(() => {
  const b = document.querySelector('#drawergrid .drawer[data-drawer="d_in"]').getBoundingClientRect(); return b.y + b.height / 2; });
await page.mouse.up(); await nap(300);
const after = await page.evaluate(() => BUREAU.state.objects.find(o => o.id === 'd_in').phone);
out.aZoomedDragFollowsTheFinger = Math.abs((drag.y - follows) / drag.cell - 2) < 0.15;
out.andLandsWhereItWasTaken = after.y === drag.before.y - 2 && after.x === drag.before.x;
await page.evaluate(b => { const o = BUREAU.state.objects.find(o => o.id === 'd_in'); o.phone = b;
  BUREAU.setZoom('root', 1); BUREAU.render(); }, drag.before);
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
  return Math.abs(moved - 5 * cell) < 2 || Math.abs(sc.scrollTop - (sc.scrollHeight - sc.clientHeight)) < 2;
});

// ---- holding an empty slot makes a tile there, and it clicks into place --
const slot = await page.evaluate(async () => {
  const nap = n => new Promise(r => setTimeout(r, n));
  BUREAU.state.look.locked = false; BUREAU.zoomCommit('root', 0.5); await nap(350);
  const g = document.querySelector('#drawergrid'), s = [...g.querySelectorAll('.noboard')]
    .map(e => e.getBoundingClientRect()).find(r => r.top > 0 && r.bottom < innerHeight && r.left >= 0 && r.right <= innerWidth);
  return { n: BUREAU.boardsOf('root').length, plus: !!g.querySelector('.addboard,.tiledrop'),
           x: s && s.x + s.width / 2, y: s && s.y + s.height / 2 };
});
out.noPlusNoMinus = !slot.plus;
await page.mouse.move(slot.x, slot.y); await page.mouse.down(); await nap(450);
const grew = await page.evaluate(() => !!document.querySelector('.tilegrow'));
await page.mouse.up();
await shot('03-new-tile');
await nap(1100);
out.aHeldSlotMakesATile = grew && await page.evaluate(n => BUREAU.boardsOf('root').length === n + 1, slot.n);

// ---- holding the middle of an empty tile long takes it away --------------
const gone = await page.evaluate(async () => {
  const nap = n => new Promise(r => setTimeout(r, n));
  BUREAU.zoomCommit('root', 1); await nap(350);
  const g = document.querySelector('#drawergrid'), S = BUREAU.state;
  const home = BUREAU.startOf('root');
  const b = BUREAU.boardsOf('root').find(b => (b.x !== home.x || b.y !== home.y) && !BUREAU.boardHolds('root', b.x, b.y));
  if (!b) return null;
  const cell = parseFloat(document.querySelector('#drawergrid').style.getPropertyValue('--rowh'));
  return { b, n: BUREAU.boardsOf('root').length, cell };
});
out.aLongCentreHoldTakesATile = null;
if (gone) {
  const pt = {}; await page.evaluate(b => {
    const g = document.querySelector('#drawergrid'), sc = document.querySelector('#app .deskscroll');
    const r = g.getBoundingClientRect(), c = parseFloat(g.style.getPropertyValue('--rowh'));
    const sh = BUREAU.shelfShift ? BUREAU.shelfShift('root') : { x: 0, y: 0 };
    const x = r.left + (b.x * 5 + 2 - sh.x + .5) * c, y = r.top + (b.y * 5 + 2 - sh.y + .5) * c;
    sc.scrollBy(0, y - innerHeight / 2); sc.scrollBy(x - innerWidth / 2, 0);
    return true;
  }, gone.b);
  await nap(400);
  Object.assign(pt, await page.evaluate(b => {
    const g = document.querySelector('#drawergrid'), r = g.getBoundingClientRect(), c = parseFloat(g.style.getPropertyValue('--rowh'));
    const sh = BUREAU.shelfShift('root');
    return { x: r.left + (b.x * 5 + 2 - sh.x + .5) * c, y: r.top + (b.y * 5 + 2 - sh.y + .5) * c };
  }, gone.b));
  await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await nap(700);
  await shot('04-tile-going');
  await nap(800); await page.mouse.up(); await nap(300);
  out.aLongCentreHoldTakesATile = await page.evaluate(n => BUREAU.boardsOf('root').length === n - 1, gone.n);
}
await shot('04b-tile-gone');

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
