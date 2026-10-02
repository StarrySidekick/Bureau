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
// a board fits itself to what is on it (decision 287), so every number may
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

// ---- a board is as big as what is on it (decision 287) -----------------
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
  return g.classList.contains('showcase') && !!g.querySelector('.showpaper') && !g.querySelector('.carve')
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
// …and it opens on what is in it, not on the empty margin at its corner
// (decision 287): something in it is on the screen when it arrives
out.andOpensOnItsThings = await page.evaluate(() => {
  const sc = document.querySelector('#app .deskscroll').getBoundingClientRect();
  return [...document.querySelectorAll('#drawergrid > .drawer')].some(e => { const r = e.getBoundingClientRect();
    return r.left >= sc.left - 1 && r.right <= sc.right + 1 && r.top >= sc.top - 1 && r.bottom <= sc.bottom + 1; });
});
await shot('05-drawer');

// ---- the garbage bin (decision 285): a wire basket on the desk, and a heap
// at the bottom of its board once it is opened, which is the gravity solver
// running in Safari on a board it was not switched on for.
out.theBinIsABasket = await page.evaluate(async () => {
  const S = BUREAU.state; S.view = 'desk'; S.drawerId = null;
  BUREAU.delMany(S.objects.filter(o => o.parent === 'root' && !BUREAU.state.objects.some(x => x.parent === o.id)
    && !o.filter && o.id !== '__bin').slice(0, 5).map(o => o.id));
  await new Promise(r => setTimeout(r, 400));
  const t = document.querySelector('.bintile');
  return !!t && t.querySelectorAll('.binball').length === 5 && !t.querySelector('.dpanel:not([style*="none"])')?.offsetWidth;
});
await shot('06-bin-on-desk');
out.theBinHeapsUp = await page.evaluate(async () => {
  const S = BUREAU.state; S.view = 'drawer'; S.drawerId = '__bin'; BUREAU.render();
  await new Promise(r => setTimeout(r, 3500));
  const g = document.querySelector('#drawergrid').getBoundingClientRect();
  const tiles = [...document.querySelectorAll('#drawergrid > .drawer')];
  // every one has fallen into the lower half of the board
  return tiles.length === 5 && tiles.every(e => e.getBoundingClientRect().top - g.top > g.height / 2 - 60);
});
await shot('07-bin-open');

// ---- the inbox and its copper pipes (decision 286): an inbox with a pipe
// tied to it, a task typed into its real input going down the pipe, and a
// pipe's brass tag laid out beside its mouth rather than under it.
const pipeAt = await page.evaluate(async () => {
  const S = BUREAU.state;
  const room = BUREAU.create('drawer', {parent:'root', title:'Pipework'}); delete room.setup;
  const ib = BUREAU.create('inbox', {parent:room.id, title:'Inbox'});
  const doo = BUREAU.create('drawer', {parent:room.id, title:'Do'}); delete doo.setup;
  const pp = BUREAU.create('pipe', {parent:room.id}); pp.takes = 'task'; pp.from = ib.id; pp.into = doo.id;
  S.view = 'drawer'; S.drawerId = room.id; BUREAU.render(); await new Promise(r => setTimeout(r, 300));
  ib.phone = {x:1, y:1, w:4, h:5}; doo.phone = {x:5, y:3, w:2, h:2}; pp.phone = {x:5, y:1, w:3, h:1};
  BUREAU.render(); await new Promise(r => setTimeout(r, 300));
  return ib.id;
});
{ const f = page.locator(`[data-contadd="${pipeAt}"]`).first(); await f.click(); await f.fill('Renew the passport'); await f.press('Enter'); await nap(250); }
out.theInboxSendsATaskDownItsPipe = await page.evaluate(() => {
  const S = BUREAU.state, o = S.objects.find(x => x.title === 'Renew the passport');
  return !!o && (S.objects.find(x => x.id === o.parent) || {}).title === 'Do';
});
out.aPipeTagSitsBesideItsMouth = await page.evaluate(() => {
  const t = document.querySelector('.pipetile.pipewide'); if (!t) return false;
  const m = t.querySelector('.pipemouth').getBoundingClientRect(), g = t.querySelector('.pipetag').getBoundingClientRect();
  return g.left >= m.right - 1 && g.height > m.height * 0.5;
});
await shot('08-pipes');

// ---- the Brain Dump (decision 296), Timothy's process end to end: a line
// written into its front on the desk, each guessed and labelled, a label
// tapped for another kind, the bench opened in line view with its entry line
// on top, a swipe left deleting, a swipe right asking for a date, and a held
// line carried onto a drawer in the tray that rises.
const bd = await page.evaluate(async () => {
  const S = BUREAU.state, nap = n => new Promise(r => setTimeout(r, n));
  S.view = 'desk'; S.drawerId = null; S.look.locked = false;
  const b = BUREAU.create('wf_braindump', {parent:'root', title:'Brain Dump'}); delete b.setup;
  const k = BUREAU.create('drawer', {parent:'root', title:'Errands'}); delete k.setup;
  BUREAU.render(); await nap(300);
  document.querySelector(`[data-drawer="${b.id}"]`).scrollIntoView({block: 'center'}); await nap(200);
  return {b: b.id, k: k.id};
});
for (const t of ['Buy a new kettle', 'Call the dentist', 'What if the shed were a studio?', 'Is the lease up in March?', 'The light at six was gold']) {
  const f = page.locator(`[data-contadd="${bd.b}"]`).first(); await f.click(); await f.fill(t); await f.press('Enter'); await nap(200);
}
await shot('08b-brain-dump-front');
out.theBrainDumpTakesEveryLine = await page.evaluate(id => {
  const kids = BUREAU.state.objects.filter(o => o.parent === id);
  const kind = t => (kids.find(o => o.title.startsWith(t)) || {}).kind;
  return kids.length === 5 && kind('Buy') === 'task' && kind('Is the lease') === 'question' && kind('What if') === 'idea';
}, bd.b);
await page.evaluate(id => { const S = BUREAU.state; S.view = 'drawer'; S.drawerId = id; BUREAU.render(); }, bd.b);
await nap(500);
out.itOpensAsAListWithItsLineOnTop = await page.evaluate(id => {
  const add = document.querySelector(`#app .quickadd [data-contadd="${id}"]`), rows = document.querySelectorAll('[data-listfor] .listband');
  return !!add && rows.length === 5 && rows[0].getBoundingClientRect().top > add.getBoundingClientRect().bottom
    && document.querySelectorAll('[data-listfor] .kindchip').length === 5;
}, bd.b);
await shot('08c-brain-dump-open');
// a tap on a label takes the next kind
const chipAt = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-listfor] .listband')]
  .find(e => /light at six/.test(e.textContent)).querySelector('.kindchip').getBoundingClientRect();
  return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
await page.mouse.click(chipAt.x, chipAt.y); await nap(300);
out.aLabelTapChangesTheGuess = await page.evaluate(() => BUREAU.state.objects.find(o => o.title === 'The light at six was gold').kind !== 'thought');
// a swipe left deletes, a swipe right asks when
const rowAt = t => page.evaluate(t => { const r = [...document.querySelectorAll('[data-listfor] .listband')]
  .find(e => e.textContent.includes(t)).getBoundingClientRect(); return {x: r.x + r.width * 0.5, y: r.y + r.height / 2}; }, t);
const swipe = async (p, by) => { await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(p.x + by * i / 10, p.y); await nap(16); }
  await page.mouse.up(); await nap(400); };
await swipe(await rowAt('Call the dentist'), -170);
out.aSwipeLeftDeletes = await page.evaluate(id => !BUREAU.state.objects.some(o => o.parent === id && o.title === 'Call the dentist'), bd.b);
await swipe(await rowAt('Is the lease'), 170);
out.aSwipeRightAsksWhen = await page.evaluate(() => !!document.querySelector('#panel'));
await page.evaluate(() => BUREAU.closePanel()); await nap(300);
// held, the tray rises; carried onto Errands, it is filed there
const held = await rowAt('Buy a new kettle');
await page.mouse.move(held.x, held.y); await page.mouse.down(); await nap(450);
const trayUp = await page.evaluate(k => !!document.querySelector(`#tray [data-trayto="${k}"]`), bd.k);
await page.evaluate(k => document.querySelector(`#tray [data-trayto="${k}"]`)?.scrollIntoView({inline: 'center'}), bd.k);
const into = await page.evaluate(k => { const r = document.querySelector(`#tray [data-trayto="${k}"]`)?.getBoundingClientRect();
  return r ? {x: r.x + r.width / 2, y: r.y + r.height / 2} : null; }, bd.k);
if (into) { await page.mouse.move(into.x, into.y, {steps: 12}); await nap(400); await shot('08d-brain-dump-tray'); }
await page.mouse.up(); await nap(400);
out.aHeldLineGoesIntoADrawer = trayUp && await page.evaluate(k => {
  const o = BUREAU.state.objects.find(x => x.title === 'Buy a new kettle');
  return !!o && o.parent === k && !document.querySelector('#tray') && /Errands/.test(document.querySelector('.toast')?.textContent || '');
}, bd.k);
await page.evaluate(() => { const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; BUREAU.render(); });

// ---- three kinds of board (decision 288): the desk is free, a new drawer
// is one tile of 8×14, holding the wood beside it lays a second tile, a
// fixed board refuses what will not fit, and a Board carries what is on it.
out.theDeskIsFree = await page.evaluate(() => BUREAU.formOf('root').form === 'free');
const tiled = await page.evaluate(async () => {
  const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; BUREAU.render();
  const d = BUREAU.create('drawer', {parent:'root', title:'Kitchen'}); delete d.setup;
  S.view = 'drawer'; S.drawerId = d.id; BUREAU.render(); await new Promise(r => setTimeout(r, 400));
  const f = BUREAU.formOf(d.id), g = document.querySelector('#drawergrid');
  return {id: d.id, form: f.form, w: f.w, h: f.h, tiles: BUREAU.tilesOf(d.id).length,
    cols: +g.style.getPropertyValue('--cols'), wood: document.querySelectorAll('#drawergrid > .noboard').length};
});
out.aNewDrawerIsOneTile = tiled.form === 'tiled' && tiled.w === 8 && tiled.h === 14 && tiled.tiles === 1;
await shot('09-tiled-drawer');
// scroll to the foot of the tile and hold the wood under it
const woodNow = await page.evaluate(async () => {
  const sc = document.querySelector('#app .deskscroll'); sc.scrollTop = sc.scrollHeight;
  await new Promise(r => setTimeout(r, 400));
  const g = document.querySelector('#drawergrid'), cell = parseFloat(g.style.getPropertyValue('--rowh'));
  const v = sc.getBoundingClientRect();
  const t = [...g.querySelectorAll('.noboard')].map(e => e.getBoundingClientRect())
    .find(b => b.left >= v.left + cell * 3 && b.right <= v.right && b.top >= (v.top + v.bottom) / 2 && b.bottom <= v.bottom + 1);
  if (!t) return null;
  const x = (Math.max(t.left, v.left) + Math.min(t.right, v.right)) / 2, y = (t.top + t.bottom) / 2;
  return {x, y};
});
if (woodNow) {
  await page.mouse.move(woodNow.x, woodNow.y); await page.mouse.down(); await nap(900); await page.mouse.up(); await nap(500);
}
out.holdingTheWoodAddsATile = await page.evaluate(id => BUREAU.tilesOf(id).length === 2, tiled.id);
await shot('10-tiled-two');
out.aFixedBoardSaysNo = await page.evaluate(async id => {
  BUREAU.setForm(id, 'fixed'); BUREAU.setTileDim(id, 'w', 2); BUREAU.setTileDim(id, 'h', 2);
  BUREAU.render(); await new Promise(r => setTimeout(r, 300));
  const f = BUREAU.formOf(id);
  return f.form === 'fixed' && f.w === 2 && f.h === 2 && !(await import('./js/grid.js')).freeSpot(4, 4, 'phone', id);
}, tiled.id);
await page.evaluate(async id => { BUREAU.setTileDim(id, 'w', 6); BUREAU.setTileDim(id, 'h', 6);
  BUREAU.render(); await new Promise(r => setTimeout(r, 300)); }, tiled.id);
await shot('11-fixed-drawer');
out.aBoardCarriesWhatIsOnIt = await page.evaluate(async () => {
  const S = BUREAU.state; S.view = 'desk'; S.drawerId = null;
  const m = BUREAU.create('mat', {parent:'root', title:'Board'});
  const n = BUREAU.create('thought', {parent:'root', title:'On the board'});
  BUREAU.render(); await new Promise(r => setTimeout(r, 300));
  const b = m.phone; n.phone = {x: b.x + 1, y: b.y + 1, w: 2, h: 2};
  BUREAU.render(); await new Promise(r => setTimeout(r, 300));
  const t = BUREAU.travelWith(m) || [];
  return t.includes(n.id) && !!document.querySelector('.bgtile.fill-board');
});
await shot('12-a-board');

// ---- the rubber stamp (decision 292): pressed with a finger, then a task
// pressed with a finger, and the task carries the impression; the stamp
// pressed again puts it down, and a second press on the task does nothing.
const stampAt = await page.evaluate(async () => {
  const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; S.look.locked = false;
  const st = BUREAU.create('tstamp', {parent:'root'}); st.stampw = 'Paid';
  const t = BUREAU.create('task', {parent:'root', title:'Electric bill'}); delete t.setup;
  BUREAU.render(); await new Promise(r => setTimeout(r, 200));
  // side by side, out in empty space to the right of everything
  const right = Math.max(...S.objects.filter(o => (o.parent || 'root') === 'root' && o.phone && o.phone.x)
    .map(o => o.phone.x + o.phone.w));
  st.phone = {x: right + 1, y: 10, w: 1, h: 1}; t.phone = {x: right + 3, y: 10, w: 3, h: 2};
  BUREAU.render(); await new Promise(r => setTimeout(r, 300));
  const el = id => document.querySelector(`#drawergrid [data-row="${id}"],#drawergrid [data-drawer="${id}"]`);
  el(t.id).scrollIntoView({block: 'center', inline: 'center'}); await new Promise(r => setTimeout(r, 300));
  const c = id => { const b = el(id).getBoundingClientRect(); return {x: b.x + b.width / 2, y: b.y + b.height / 2}; };
  return {st: st.id, t: t.id, a: c(st.id), b: c(t.id)};
});
const press = async p => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await nap(60); await page.mouse.up(); await nap(350); };
await press(stampAt.a);
const inked = await page.evaluate(() => !!BUREAU.state.stamping && BUREAU.state.stamping.w === 'Paid');
await press(stampAt.b);
await shot('13-stamped');
out.aStampPrintsOnWhatItIsPressedOn = inked && await page.evaluate(id => {
  const o = BUREAU.state.objects.find(x => x.id === id), el = document.querySelector(`#drawergrid [data-row="${id}"] .stampimp`);
  return !!o.stamps && o.stamps.length === 1 && o.stamps[0].w === 'Paid' && !!el && /PAID/i.test(el.textContent)
    && getComputedStyle(el).position === 'absolute' && el.getBoundingClientRect().width > 20;
}, stampAt.t);
await press(stampAt.a);
out.andIsPutDownByPressingItAgain = await page.evaluate(id => !BUREAU.state.stamping
  && BUREAU.state.view === 'desk' && BUREAU.state.objects.find(x => x.id === id).stamps.length === 1, stampAt.t);

// ---- benches (decision 293): a drawer made a bench from its own Board
// settings, a setting changed inside it stays in it, and the desk keeps its
// own; then the Prioritizer, where a task carried into a zone takes its
// priority; and the Film bench, whose night sky brings its own board.
const benchAt = await page.evaluate(async () => {
  const S = BUREAU.state, nap = n => new Promise(r => setTimeout(r, n));
  S.view = 'desk'; S.drawerId = null; S.look.locked = false; BUREAU.render();
  const d = BUREAU.create('drawer', {parent:'root', title:'Workroom'}); delete d.setup;
  S.view = 'drawer'; S.drawerId = d.id; BUREAU.render(); await nap(300);
  document.querySelector('[data-act="appsettings"]').click(); await nap(400);
  document.querySelector('[data-bench^="make:"]')?.click(); await nap(300);
  document.querySelector('[data-flow="rigid"]')?.click(); await nap(300);
  const inside = { env: JSON.stringify(d.env), rigid: document.querySelector('#frame').classList.contains('rigid'), desk: S.look.flow || '' };
  document.querySelector('[data-act="panelclose"]')?.click();
  S.view = 'desk'; S.drawerId = null; BUREAU.render(); await nap(300);
  return { inside, outside: document.querySelector('#frame').classList.contains('rigid') };
});
out.aSettingInABenchStaysInIt = benchAt.inside.env === '{"flow":"rigid"}' && benchAt.inside.rigid
  && benchAt.inside.desk === '' && benchAt.outside === false;
out.benchAt = JSON.stringify(benchAt);
const pz = await page.evaluate(async () => {
  const S = BUREAU.state, nap = n => new Promise(r => setTimeout(r, n));
  const d = BUREAU.create('wf_prioritizer', {parent:'root', title:'This week'}); delete d.setup;
  S.view = 'drawer'; S.drawerId = d.id; BUREAU.render(); await nap(400);
  const z = S.objects.find(o => o.parent === d.id && o.title === 'Do now');
  const t = BUREAU.create('task', {parent:d.id, title:'Send the invoice'}); delete t.setup;
  BUREAU.render(); await nap(300);
  // a new thing arrives outside every zone: being in one is a decision
  const z2 = S.objects.filter(o => o.parent === d.id && o.kind === 'zone');
  const inZone = z2.some(q => t.phone.y >= q.phone.y && t.phone.y < q.phone.y + q.phone.h
    && t.phone.x < q.phone.x + q.phone.w && t.phone.x + t.phone.w > q.phone.x);
  const el = id => document.querySelector(`#drawergrid [data-row="${id}"]`);
  el(z.id).scrollIntoView({block: 'start'}); await nap(300);
  const a = el(t.id).getBoundingClientRect(), b = el(z.id).getBoundingClientRect();
  return { d: d.id, t: t.id, inZone, style: document.documentElement.dataset.style,
    from: {x: a.x + a.width / 2, y: a.y + a.height / 2}, to: {x: b.x + b.width / 2, y: b.y + b.height / 2 + 20} };
});
await page.mouse.move(pz.from.x, pz.from.y); await page.mouse.down(); await nap(400);
await page.mouse.move(pz.to.x, pz.to.y, {steps: 10}); await nap(100); await page.mouse.up(); await nap(400);
await shot('14-prioritizer');
out.aNewThingArrivesOutsideTheZones = !pz.inZone;
out.aZoneGivesWhatItSays = pz.style === 'golf97' && await page.evaluate(id => {
  const o = BUREAU.state.objects.find(x => x.id === id); return o.prio === 5 && o.diff === 2; }, pz.t);
out.theFilmBenchIsANightRoom = await page.evaluate(async () => {
  const S = BUREAU.state, nap = n => new Promise(r => setTimeout(r, n));
  S.view = 'desk'; S.drawerId = null; BUREAU.render();
  const d = BUREAU.create('film', {parent:'root', title:'Low Tide'}); delete d.setup;
  S.view = 'drawer'; S.drawerId = d.id; BUREAU.render(); await nap(400);
  const g = document.querySelector('#drawergrid');
  // the aesthetic's own night board, with no board of its birth over it
  return document.documentElement.dataset.style === 'starry'
    && getComputedStyle(g).getPropertyValue('--board-1').trim().toUpperCase() === '#07080C'
    && S.objects.filter(o => o.parent === d.id && o.kind === 'zone').length === 4;
});
await shot('15-film-bench');
await page.evaluate(() => { const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; BUREAU.render(); });
out.theDeskKeepsItsOwnRoom = await page.evaluate(() => document.documentElement.dataset.style === BUREAU.state.look.style);

out.errors = errs;
console.log(JSON.stringify(out, null, 2));
await browser.close();
const bad = Object.entries(out).filter(([k, v]) => v === false);
if (errs.length || bad.length) { console.error('safari: ' + (bad.map(([k]) => k).join(', ') || 'page errors')); process.exit(1); }
