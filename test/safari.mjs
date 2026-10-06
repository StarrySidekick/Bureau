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
// ---- the quick add (decision 297): a notepad in every drawer front that
// writes into the Brain Dump. Pressed inside Errands it goes to the Brain
// Dump with its line ready; a line goes in; the lip's button goes back.
const pad = await page.evaluate(async ({b, k}) => {
  const S = BUREAU.state, nap = n => new Promise(r => setTimeout(r, n));
  // the one the bench put in the desk's front when it was made
  const p = S.objects.find(o => o.frontAll && o.front && o.into === b);
  if (!p) return null;
  S.view = 'drawer'; S.drawerId = k; BUREAU.render(); await nap(400);
  return p.id;
}, bd);
out.theBenchPutsANotepadInTheFront = !!pad;
const padAt = await page.evaluate(id => { const e = document.querySelector(`.deskrail [data-act="frontpress"][data-id="${id}"]`);
  if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; }, pad);
out.theQuickAddStandsInEveryFront = !!padAt;
if (padAt) { await page.mouse.click(padAt.x, padAt.y); await nap(450); }
out.itGoesToTheBrainDumpReadyToWrite = await page.evaluate(b => BUREAU.state.drawerId === b
  && document.activeElement && document.activeElement.dataset.contadd === b
  && /Errands/.test(document.querySelector('.backpill')?.textContent || ''), bd.b);
await page.keyboard.type('Ring the plumber'); await page.keyboard.press('Enter'); await nap(300);
await shot('08e-quick-add');
out.aLineGoesIn = await page.evaluate(b => BUREAU.state.objects.some(o => o.parent === b && o.title === 'Ring the plumber'), bd.b);
const backAt = await page.evaluate(() => { const r = document.querySelector('.backpill')?.getBoundingClientRect();
  return r ? {x: r.x + r.width / 2, y: r.y + r.height / 2} : null; });
if (backAt) { await page.mouse.click(backAt.x, backAt.y); await nap(400); }
out.andTheButtonGoesBack = await page.evaluate(k => BUREAU.state.drawerId === k && !BUREAU.state.backTo && !document.querySelector('.backpill'), bd.k);
await page.evaluate(id => { const S = BUREAU.state; BUREAU.del(id); S.view = 'desk'; S.drawerId = null; BUREAU.render(); }, pad);

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
// a zone, on a board of its own: a task carried into it takes its priority
const pz = await page.evaluate(async () => {
  const S = BUREAU.state, nap = n => new Promise(r => setTimeout(r, n));
  const d = BUREAU.create('drawer', {parent:'root', title:'Matrix'}); delete d.setup;
  const z = BUREAU.create('zone', {parent:d.id, title:'Do now', writes:{prio:5, diff:2},
    desk:{x:1, y:1, w:4, h:4}, phone:{x:1, y:1, w:4, h:4}});
  S.view = 'drawer'; S.drawerId = d.id; BUREAU.render(); await nap(400);
  const t = BUREAU.create('task', {parent:d.id, title:'Send the invoice'}); delete t.setup;
  BUREAU.render(); await nap(300);
  // a new thing arrives outside every zone: being in one is a decision
  const inZone = t.phone.y >= z.phone.y && t.phone.y < z.phone.y + z.phone.h
    && t.phone.x < z.phone.x + z.phone.w && t.phone.x + t.phone.w > z.phone.x;
  const el = id => document.querySelector(`#drawergrid [data-row="${id}"]`);
  el(z.id).scrollIntoView({block: 'start'}); await nap(300);
  const a = el(t.id).getBoundingClientRect(), b = el(z.id).getBoundingClientRect();
  return { d: d.id, t: t.id, inZone,
    from: {x: a.x + a.width / 2, y: a.y + a.height / 2}, to: {x: b.x + b.width / 2, y: b.y + b.height / 2 + 20} };
});
await page.mouse.move(pz.from.x, pz.from.y); await page.mouse.down(); await nap(400);
await page.mouse.move(pz.to.x, pz.to.y, {steps: 10}); await nap(100); await page.mouse.up(); await nap(400);
await shot('14-zone');
out.aNewThingArrivesOutsideTheZones = !pz.inZone;
out.aZoneGivesWhatItSays = await page.evaluate(id => {
  const o = BUREAU.state.objects.find(x => x.id === id); return o.prio === 5 && o.diff === 2; }, pz.t);

// ---- the Prioritizer (decision 299): priorities written on its line go into
// the deck as cards; pressed, the deck opens full screen and is ranked a swipe
// at a time; it ends on the order, and the deck's top card is the first.
const WANT = ['Finish the film', 'Call the landlord', 'Learn the chords', 'Fix the bike', 'Sort the garage'];
const pr = await page.evaluate(async () => {
  const S = BUREAU.state, nap = n => new Promise(r => setTimeout(r, n));
  S.view = 'desk'; S.drawerId = null;
  const d = BUREAU.create('wf_prioritizer', {parent:'root', title:'This week'}); delete d.setup;
  S.view = 'drawer'; S.drawerId = d.id; BUREAU.render(); await nap(400);
  const deck = S.objects.find(o => o.parent === d.id && o.kind === 'deck');
  const pad = S.objects.find(o => o.parent === d.id && o.kind === 'notepad');
  return { d: d.id, deck: deck && deck.id, pad: pad && pad.id, rank: deck && deck.deckTap, into: pad && pad.into === deck.id,
    style: document.documentElement.dataset.style };
});
out.thePrioritizerIsADeckThatRanks = !!pr.deck && pr.rank === 'rank' && pr.into && pr.style === 'golf97';
for (const t of ['Sort the garage', 'Learn the chords', 'Finish the film', 'Fix the bike', 'Call the landlord']) {
  await page.evaluate(id => document.querySelector(`[data-row="${id}"]`)?.scrollIntoView({block: 'center'}), pr.pad);
  const f = page.locator(`[data-fieldfor="${pr.pad}"]`).first();
  await f.evaluate(e => e.focus()); await f.fill(t); await f.press('Enter'); await nap(150);
}
out.eachLineIsACardInTheDeck = await page.evaluate(id => {
  const k = BUREAU.state.objects.filter(o => o.parent === id); return k.length === 5 && k.every(o => o.kind === 'card'); }, pr.deck);
await page.evaluate(id => document.querySelector(`[data-drawer="${id}"],[data-row="${id}"]`)?.scrollIntoView({block: 'center'}), pr.deck);
await nap(250); await shot('15b-prioritizer');
const deckAt = await page.evaluate(id => { const r = document.querySelector(`#drawergrid [data-drawer="${id}"],#drawergrid [data-row="${id}"]`).getBoundingClientRect();
  return {x: r.x + r.width / 2, y: r.y + r.height / 2}; }, pr.deck);
await page.mouse.click(deckAt.x, deckAt.y); await nap(500);
out.pressedItOpensFullScreen = await page.evaluate(() => !!document.querySelector('#rank .rkcard'));
let swipes = 0, shotMid = false;
for (; swipes < 30; swipes++) {
  const q = await page.evaluate(() => {
    const c = document.querySelector('#rank .rkface .dkword b'), p = document.querySelector('#rank .rkpivot .dkword b');
    const r = document.querySelector('#rank .rkcard')?.getBoundingClientRect();
    return c && p && r ? {c: c.textContent, p: p.textContent, x: r.x + r.width / 2, y: r.y + r.height / 2} : null; });
  if (!q) break;
  const by = WANT.indexOf(q.c) < WANT.indexOf(q.p) ? 170 : -170;
  await page.mouse.move(q.x, q.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(q.x + by * i / 8, q.y); await nap(16); }
  if (!shotMid) { await shot('16-rank-swipe'); shotMid = true; }
  await page.mouse.up(); await nap(420);
}
await shot('17-rank-order');
out.itEndsOnTheOrder = await page.evaluate(n => document.querySelectorAll('#rank .rklist li').length === n, WANT.length);
out.inFewerSwipesThanEveryPair = swipes > 0 && swipes <= 8;
out.andTheDeckIsInThatOrder = await page.evaluate(({id, want}) => {
  const S = BUREAU.state, d = S.objects.find(o => o.id === id);
  const titles = (d.ranked || []).map(r => S.objects.find(o => o.id === r).title);
  return titles.join('|') === want.join('|') && S.objects.find(o => o.id === d.top).title === want[0];
}, {id: pr.deck, want: WANT});
await page.evaluate(() => document.querySelector('#rank [data-rk="close"]')?.click()); await nap(400);
out.doneCloses = await page.evaluate(() => !document.querySelector('#rank'));

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

// ---- the painter's Face and 3D (decision 300): the knob and the name
// carried anywhere on a front, a knob shape picked, kept on Done and drawn
// there on the board; and the turning model built of its faces.
const fc = await page.evaluate(async () => {
  const S = BUREAU.state, nap = n => new Promise(r => setTimeout(r, n));
  S.view = 'desk'; S.drawerId = null; S.look.locked = false;
  const d = BUREAU.create('drawer', {parent:'root', title:'Kitchen Things'}); delete d.setup;
  BUREAU.render(); await nap(300); BUREAU.openPaint(d.id); await nap(300);
  document.querySelector('[data-ptmode="face"]').click(); await nap(300);
  return d.id;
});
const grab = sel => page.evaluate(sel => { const r = document.querySelector('#paint .ptface ' + sel).getBoundingClientRect();
  const t = document.querySelector('#paint .ptface .drawer').getBoundingClientRect();
  return {x: r.x + r.width / 2, y: r.y + r.height / 2, tx: t.x, ty: t.y, tw: t.width, th: t.height}; }, sel);
const kn = await grab('.pull');
await page.mouse.move(kn.x, kn.y); await page.mouse.down(); await page.mouse.move(kn.tx + kn.tw * .8, kn.ty + kn.th * .8, {steps: 8}); await page.mouse.up(); await nap(200);
const nm = await grab('.dname');
await page.mouse.move(nm.x, nm.y); await page.mouse.down(); await page.mouse.move(nm.tx + nm.tw * .4, nm.ty + nm.th * .75, {steps: 8}); await page.mouse.up(); await nap(200);
await page.click('[data-ptface="kshape"][data-v="heart"]'); await nap(200);
await shot('18-paint-face');
await page.click('[data-ptmode="3d"]'); await nap(600);
out.theModelIsItsFaces = await page.evaluate(() => document.querySelectorAll('#paint .p3obj .p3f').length >= 10 && !!document.querySelector('#paint .p3obj .p3face .drawer'));
await shot('19-paint-3d');
await page.click('[data-pt="done"]'); await nap(400);
out.theKnobAndNameGoWhereTheyArePut = await page.evaluate(id => {
  const o = BUREAU.state.objects.find(x => x.id === id), t = document.querySelector(`[data-drawer="${id}"]`);
  const k = t.querySelector('.pull').getBoundingClientRect(), r = t.getBoundingClientRect();
  return o.kshape === 'heart' && Math.abs(o.knobAt.x - .8) < .06 && Math.abs(o.knobAt.y - .8) < .06 && o.nameAt.y > .6
    && t.classList.contains('knb-free') && t.classList.contains('nm-free')
    && Math.abs((k.x + k.width / 2 - r.x) / r.width - o.knobAt.x) < .06 && k.width > 4;
}, fc);

// ---- three more benches (decision 301) -----------------------------------
// Each opens in its own room. The Brainstorm's line writes ideas into Every
// idea, and an idea stamped Keep shows in Keepers without moving. The Story
// Builder opens on the twelve stages, then its people, then its world. The
// Journal's line writes into Entries, newest first.
const bench = async (kind, title) => page.evaluate(async ({kind, title}) => {
  const S = BUREAU.state, nap = n => new Promise(r => setTimeout(r, n));
  S.view = 'desk'; S.drawerId = null; BUREAU.render();
  const d = BUREAU.create(kind, {parent:'root', title}); delete d.setup;
  S.view = 'drawer'; S.drawerId = d.id; BUREAU.render(); await nap(450);
  const mine = S.objects.filter(o => o.parent === d.id);
  return { id: d.id, style: document.documentElement.dataset.style, n: mine.length,
    kinds: mine.map(o => o.kind), titles: mine.map(o => o.title),
    pads: mine.filter(o => o.kind === 'notepad').map(o => ({id: o.id, into: o.into && S.objects.find(x => x.id === o.into)?.title})) };
}, {kind, title});
const write = async (pad, t) => {
  await page.evaluate(id => document.querySelector(`[data-row="${id}"]`)?.scrollIntoView({block: 'center'}), pad);
  const f = page.locator(`[data-fieldfor="${pad}"]`).first();
  await f.evaluate(e => e.focus()); await f.fill(t); await f.press('Enter'); await nap(200);
};
const bs = await bench('wf_brainstorming', 'A name for the shop');
out.theBrainstormIsAWorkshop = bs.style === 'carca' && bs.titles.includes('Every idea') && bs.titles.includes('Keepers')
  && bs.pads.length === 1 && bs.pads[0].into === 'Every idea';
await write(bs.pads[0].id, 'Call it after the street');
await write(bs.pads[0].id, 'A word in another language');
out.aKeptIdeaRisesToKeepers = await page.evaluate(async id => {
  const S = BUREAU.state, nap = n => new Promise(r => setTimeout(r, n));
  const list = S.objects.find(o => o.parent === id && o.title === 'Every idea');
  const keep = S.objects.find(o => o.parent === id && o.title === 'Keepers');
  const ideas = S.objects.filter(o => o.parent === list.id);
  if (ideas.length !== 2 || !ideas.every(o => o.kind === 'idea')) return false;
  const before = BUREAU.kids(keep.id).length;
  ideas[0].stamps = [{w:'Keep', d:'2026-10-02', ink:'green'}]; BUREAU.render(); await nap(200);
  const after = BUREAU.kids(keep.id);
  return before === 0 && after.length === 1 && after[0] === ideas[0].id && ideas[0].parent === list.id;
}, bs.id);
await page.evaluate(id => { const t = BUREAU.state.objects.find(o => o.parent === id && o.kind === 'question');
  document.querySelector(`[data-row="${t.id}"]`)?.scrollIntoView({block: 'start', inline: 'start'}); }, bs.id); await nap(300);
await shot('20-brainstorm');

const sb = await bench('wf_storybuilder', 'The lighthouse');
out.theStoryBuilderIsTheJourneyFirst = sb.style === 'stelaine'
  && sb.titles.filter(t => /^\d+\. /.test(t)).length === 12
  && sb.titles.includes('Characters') && sb.titles.includes('Places') && sb.titles.includes('Powers and rules')
  && await page.evaluate(id => BUREAU.boardsOf(id).length >= 3, sb.id);
out.itsPeopleAreTheArchetypes = await page.evaluate(id => {
  const S = BUREAU.state, c = S.objects.find(o => o.parent === id && o.title === 'Characters');
  return S.objects.filter(o => o.parent === c.id && o.kind === 'character').length === 8; }, sb.id);
await page.evaluate(id => { const t = BUREAU.state.objects.find(o => o.parent === id && o.title === '1. The ordinary world');
  document.querySelector(`[data-row="${t.id}"],[data-drawer="${t.id}"]`)?.scrollIntoView({block: 'start', inline: 'start'}); }, sb.id);
await nap(300); await shot('21-story-journey');
for (const [t, n] of [['Characters', '21b-story-people'], ['Places', '21c-story-world']]) {
  await page.evaluate(({id, t}) => { const o = BUREAU.state.objects.find(o => o.parent === id && o.title === t);
    document.querySelector(`[data-row="${o.id}"],[data-drawer="${o.id}"]`)?.scrollIntoView({block: 'start', inline: 'start'}); }, {id: sb.id, t});
  await nap(400); await shot(n);
}

const jn = await bench('wf_journal', 'Journal');
out.theJournalIsAnOldDesk = jn.style === 'victorian' && jn.pads.length === 1 && jn.pads[0].into === 'Entries';
await write(jn.pads[0].id, 'Rain all day');
await nap(30);
await write(jn.pads[0].id, 'The first cold morning');
out.newestEntryOnTop = await page.evaluate(id => {
  const S = BUREAU.state, e = S.objects.find(o => o.parent === id && o.title === 'Entries');
  const k = BUREAU.kids(e.id).map(i => S.objects.find(o => o.id === i)); return k.length === 2 && k[0].title === 'The first cold morning'; }, jn.id);
await page.evaluate(id => { const t = BUREAU.state.objects.find(o => o.parent === id && o.title === 'Entries');
  document.querySelector(`[data-row="${t.id}"],[data-drawer="${t.id}"]`)?.scrollIntoView({block: 'start', inline: 'start'}); }, jn.id); await nap(300);
await shot('22-journal');

// ---- the gear is on the top lip, at the right (decision 302) --------------
// Not in the drawer front, on the desk or in a drawer, and pressing it still
// opens Settings; its right edge is near the lip's, past the name.
const gearAt = async () => page.evaluate(async () => {
  const lip = document.querySelector('#app .toplip'), g = lip && lip.querySelector('.lipgear [data-act="appsettings"]');
  const name = lip && lip.querySelector('.here');
  if (!g) return { inLip: false };
  const r = g.getBoundingClientRect(), l = lip.getBoundingClientRect(), n = name.getBoundingClientRect();
  const front = !!document.querySelector('.deskrail [data-act="appsettings"]');
  g.click(); await new Promise(r => setTimeout(r, 350));
  const opened = !!document.querySelector('.panel, #panel, [data-panel="settings"]') && /settings/i.test(document.body.innerText);
  document.querySelector('[data-act="panelclose"]')?.click(); await new Promise(r => setTimeout(r, 250));
  return { inLip: true, right: l.right - r.right < 40, pastName: r.left > n.right, inside: r.top >= l.top - 1 && r.bottom <= l.bottom + 1,
    front, opened };
});
await page.evaluate(() => { const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; BUREAU.render(); }); await nap(300);
const gDesk = await gearAt();
await shot('23-lip-gear-desk');
await page.evaluate(() => { const S = BUREAU.state, d = S.objects.find(o => o.title === 'Workroom');
  S.view = 'drawer'; S.drawerId = d.id; BUREAU.render(); }); await nap(300);
const gIn = await gearAt();
await shot('23b-lip-gear-drawer');
await page.evaluate(() => { const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; BUREAU.render(); }); await nap(200);
out.theGearIsOnTheLip = [gDesk, gIn].every(g => g.inLip && g.right && g.pastName && g.inside && !g.front && g.opened);
out.gearAt = JSON.stringify({ gDesk, gIn });

// ---- the project dashboards, sections and links (decision 304) -----------
// Laid the way Settings' button lays them; then real taps: a Contents line
// goes to its heading and the lip names it, the lip's name opens the same
// list, a [[link]] in a page opens the page it names (which says what links
// to it), and a project's front says what is open inside.
await page.evaluate(() => { BUREAU.dashboards(true); const S = BUREAU.state;
  S.view = 'drawer'; S.drawerId = S.objects.find(o => o.sk === 'composerskey').id; BUREAU.render(); });
await nap(700);
await shot('24-dashboard');
const lipSays = () => page.evaluate(() => (document.querySelector('.lipsec .secname') || {}).textContent || '');
const headTop = t => page.evaluate(t => { const sc = document.querySelector('#app .scroll');
  const el = [...document.querySelectorAll('#app .grid .drawer')].find(e => e.textContent.trim() === t);
  return el ? Math.round(el.getBoundingClientRect().top - sc.getBoundingClientRect().top) : null; }, t);
await page.locator('.tocline', { hasText: 'Mechanics' }).first().tap(); await nap(1300);
const mech = { lip: await lipSays(), top: await headTop('Mechanics') };
await shot('24b-contents-jump');
// …and stays there: the snap once eased it back a few cells into the glide
await nap(700); mech.later = await headTop('Mechanics');
await page.locator('.toplip .here').tap(); await nap(400);
const menuRows = await page.evaluate(() => [...document.querySelectorAll('#ctx button[data-act="gosec"]')].map(b => b.textContent.trim()));
await page.locator('#ctx button[data-act="gosec"]', { hasText: 'The world' }).tap(); await nap(1300);
const world = { lip: await lipSays(), top: await headTop('The world') };
out.aContentsLineGoesThere = mech.lip === 'Mechanics' && mech.top !== null && Math.abs(mech.top) < 60
  && Math.abs(mech.later) < 60 || JSON.stringify(mech);
out.theLipOpensTheContents = menuRows.length === 3 && world.lip === 'The world' && Math.abs(world.top) < 60
  || JSON.stringify({ menuRows, world });
const ids = await page.evaluate(() => { const S = BUREAU.state, ck = S.objects.find(o => o.sk === 'composerskey');
  const under = (o, root) => { for (let p = o.parent; p; p = (S.objects.find(x => x.id === p) || {}).parent) if (p === root) return true; return false; };
  const f = t => S.objects.find(o => o.title === t && under(o, ck.id));
  return { time: f('Everything in time').id, metro: f('The Metronome').id }; });
await page.evaluate(id => BUREAU.read(id), ids.time); await nap(900);
await page.locator('#sheetHost a.wlink', { hasText: 'The Metronome' }).first().tap(); await nap(900);
const link = await page.evaluate(() => ({ reading: BUREAU.state.readId,
  back: [...document.querySelectorAll('#sheetHost .backlinks a')].map(a => a.textContent.trim()) }));
await shot('24c-link');
out.aLinkOpensThePage = link.reading === ids.metro && link.back.includes('Everything in time') || JSON.stringify(link);
await page.evaluate(() => { document.querySelector('#sheetHost [data-sheet="close"]')?.click(); }); await nap(500);
await page.evaluate(() => { const S = BUREAU.state; S.readId = null; S.view = 'desk'; S.drawerId = null; BUREAU.render(); }); await nap(500);
const fstat = await page.evaluate(() => { const S = BUREAU.state, b = S.objects.find(o => o.sk === 'bureau');
  const el = document.querySelector(`#app [data-drawer="${b.id}"] .fstat`);
  return el ? { text: el.textContent.trim(), shown: el.getBoundingClientRect().height > 0 } : null; });
out.aFrontSaysWhatIsOpen = !!(fstat && fstat.shown && /to do/.test(fstat.text)) || JSON.stringify(fstat);
await shot('24d-fronts');

// ---- capture reads a line, Now, and the backups (decision 305) ------------
// A line typed into a project's notepad is read for its day and its place;
// Now on the desk shows what is due and each project's next step, a check
// brings up the step after it, and its words go to the step where it lives;
// a backup kept and gone back to brings the desk back.
await page.evaluate(() => { BUREAU.dashboards(true); const S = BUREAU.state;
  S.view = 'drawer'; S.drawerId = S.objects.find(o => o.sk === 'composerskey').id; BUREAU.render(); });
await nap(600);
const said = [];
for (const line of ['call Sam friday', 'buy oil @kitchen tomorrow']) {
  await page.locator('#app .padline').first().tap();
  await page.locator('#app input[data-fieldfor]').first().fill(line);
  await page.locator('#app input[data-fieldfor]').first().press('Enter'); await nap(450);
  said.push(await page.evaluate(() => (document.querySelector('#toast') || {}).textContent || ''));
}
const typed = await page.evaluate(() => { const S = BUREAU.state, f = t => S.objects.find(o => o.title === t) || {};
  const fri = (() => { const d = new Date(); d.setHours(0,0,0,0); let n = (5 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  return { sam: f('call Sam').due === fri && f('call Sam').kind === 'task',
    oil: (S.objects.find(o => o.id === f('buy oil').parent) || {}).title === 'Kitchen' }; });
out.aLineIsRead = typed.sam && typed.oil && /due Friday/.test(said[0]) && /into Kitchen/.test(said[1]) || JSON.stringify({ typed, said });
await page.evaluate(() => { const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; BUREAU.render();
  const n = S.objects.find(o => o.sk === 'now'); document.querySelector(`[data-drawer="${n.id}"]`).scrollIntoView({ block: 'center' }); });
await nap(500);
const nowLines = () => page.evaluate(() => [...document.querySelectorAll('#app .lline[data-goto]')].map(l => l.textContent.replace(/\s+/g, ' ').trim()));
const nowBefore = await nowLines();
await shot('25-now');
await page.locator('.lline[data-goto]', { hasText: 'Play the dungeon' }).locator('.clbox').tap(); await nap(900);
const nowAfter = await nowLines();
await page.locator('.lline[data-goto]', { hasText: 'Listen to the motif' }).locator('.cltext').tap(); await nap(1300);
const went = await page.evaluate(() => { const S = BUREAU.state, sc = document.querySelector('#app .scroll');
  const next = [...document.querySelectorAll('#app .grid .drawer')].find(e => /^Next/.test(e.textContent.trim()));
  const r = next && next.getBoundingClientRect(), a = sc.getBoundingClientRect();
  return { at: (S.objects.find(o => o.id === S.drawerId) || {}).title, top: r ? Math.round(r.top - a.top) : null,
    onScreen: !!r && r.left >= a.left - 2 && r.right <= a.right + 2 }; });
await shot('25b-now-went');
out.nowIsWhatIsNext = nowBefore.some(l => /Play the dungeon.*Composer/.test(l)) && nowBefore.some(l => /Bureau$/.test(l))
  && nowAfter.some(l => /Listen to the motif/.test(l)) && !nowAfter.some(l => /Play the dungeon/.test(l))
  && went.at === 'Composer’s Key' && went.onScreen && Math.abs(went.top) < 60 || JSON.stringify({ nowBefore, nowAfter, went });
out.aBackupGoesBack = await page.evaluate(async () => { const S = BUREAU.state, n0 = S.objects.length;
  await BUREAU.dailyBackup(); const list = await BUREAU.backupList(), day = list.find(b => /^day:/.test(b.key));
  if (!day) return 'no day backup: ' + JSON.stringify(list);
  S.objects = S.objects.slice(0, 5); BUREAU.render();
  const ok = await BUREAU.restoreBackup(day.key), list2 = await BUREAU.backupList();
  return ok && BUREAU.state.objects.length === day.n && list2.some(b => /^Before restoring/.test(b.label)) || JSON.stringify({ ok, n0, day, n: BUREAU.state.objects.length }); });

// ---- Claude in Bureau (decision 306) ----------------------------------------
// With a stand-in for the network: the pen in the desk's front opens the Ask
// card; Build puts a parcel beside it at once that says it is packing, and
// fills it when the answer comes; a press unfolds it into a board where it
// lay (the parcel in the bin, one Undo to fold it back); a task breaks into
// its steps, a question gets a draft that still counts as open, a drawer
// fills in under what it has; and the ring offers all three.
await page.evaluate(() => {
  const S = BUREAU.state; S.view = 'desk'; S.drawerId = null;
  window.SENT = [];
  const reply = obj => new Promise(r => setTimeout(() => r({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }] }), 400));
  const leaf = (type, title, more) => Object.assign({ type, title, body: '', due: '', w: 0, h: 0 }, more || {});
  BUREAU.aiStub = body => { SENT.push(body); const req = body.output_config.format.schema.required;
    if (req.includes('about')) return reply({ title: 'The Lighthouse', about: 'A short film about a keeper who stops answering the radio.',
      said: 'A board for the film.', children: [
        Object.assign(leaf('contents', 'Contents'), { children: [] }),
        Object.assign(leaf('checklist', 'Next', { w: 4, h: 4 }), { children: [leaf('task', 'Write the logline'), leaf('task', 'Scout the lighthouse'), leaf('task', 'Cast the keeper')] }),
        Object.assign(leaf('label', 'The story', { w: 8, h: 1 }), { children: [] }),
        Object.assign(leaf('list', 'Open questions', { w: 4, h: 5 }), { children: [leaf('question', 'Black and white or color?')] })] });
    if (req.includes('steps')) return reply({ steps: ['Pick the date', 'Book the van', 'Drive out at dawn'], said: 'Three steps.' });
    if (req.includes('answer')) return reply({ answer: 'Black and white: the lighthouse is the only light in the film.' });
    return reply({ said: 'The shoot, added.', children: [Object.assign(leaf('label', 'The shoot', { w: 8, h: 1 }), { children: [] }),
      Object.assign(leaf('checklist', 'Kit', { w: 4, h: 4 }), { children: [leaf('task', 'Tripod')] })] }); };
  S.deskCfg.rail = { left: ['glass', 'block'], right: ['lock', 'pen'] };
  BUREAU.render();
});
await nap(500);
await page.locator('#app .railobj.ro-pen').first().tap(); await nap(600);
const askCard = await page.evaluate(() => ({ panel: (document.querySelector('#panel.open') || {}).dataset?.panel, box: !!document.querySelector('#askbox') }));
await page.locator('#askbox').fill('A short film about a lighthouse keeper');
await page.locator('#panel [data-act="askgo"]').first().tap(); await nap(120);
const packing = await page.evaluate(() => { const p = BUREAU.state.objects.find(o => o.kind === 'flatpack' && o.parent === 'root');
  const el = p && document.querySelector(`#app [data-row="${p.id}"]`), sc = document.querySelector('#app .scroll').getBoundingClientRect();
  const r = el && el.getBoundingClientRect();
  return { id: p && p.id, packing: !!el && el.classList.contains('packing'), onScreen: !!r && r.top >= sc.top && r.bottom <= sc.bottom && r.left >= sc.left - 1 && r.right <= sc.right + 1 }; });
await shot('26-packing');
await nap(900);
const packed = await page.evaluate(id => { const p = BUREAU.state.objects.find(o => o.id === id), el = document.querySelector(`#app [data-row="${id}"]`);
  return { title: p.title, kids: (p.pack.children || []).length, tag: el && el.querySelector('.parcellabel')?.textContent.trim(), packing: !!el && el.classList.contains('packing') }; }, packing.id);
await shot('26b-packed');
out.thePenAsksAndAParcelArrives = askCard.panel === 'ask' && askCard.box && packing.packing && packing.onScreen
  && packed.title === 'The Lighthouse' && /things/.test(packed.tag || '') && !packed.packing || JSON.stringify({ askCard, packing, packed });
await page.locator(`#app [data-row="${packing.id}"]`).tap(); await nap(700);
const unfolded = await page.evaluate(id => { const S = BUREAU.state, p = S.objects.find(o => o.id === id),
    b = S.objects.find(o => o.title === 'The Lighthouse' && o.kind === 'project'), el = b && document.querySelector(`#app [data-drawer="${b.id}"]`);
  const kids = b ? S.objects.filter(o => o.parent === b.id) : [], at = o => o.phone || {};
  const order = kids.filter(o => o.kind !== 'notepad').sort((x, y) => at(x).y - at(y).y || at(x).x - at(y).x).map(o => o.title);
  return { inBin: p.parent === '__bin', board: !!b, shown: !!el, undo: S.undo[S.undo.length - 1].label, order, open: b && b.status }; }, packing.id);
await shot('26c-unfolded');
const folded = await page.evaluate(id => { BUREAU.undo(); const S = BUREAU.state;
  const r = { back: (S.objects.find(o => o.id === id) || {}).parent === 'root', gone: !S.objects.some(o => o.title === 'The Lighthouse' && o.kind === 'project') };
  BUREAU.unfold(id); return r; }, packing.id);
out.itUnfoldsWhereItLay = unfolded.inBin && unfolded.board && unfolded.shown && unfolded.undo === 'Unfolded' && unfolded.open === 'open'
  && unfolded.order.indexOf('About') > unfolded.order.indexOf('Next') && unfolded.order.indexOf('About') < unfolded.order.indexOf('The story')
  && folded.back && folded.gone || JSON.stringify({ unfolded, folded });
const verbs = await page.evaluate(async () => { const S = BUREAU.state, b = S.objects.find(o => o.title === 'The Lighthouse' && o.kind === 'project');
  S.view = 'drawer'; S.drawerId = b.id; BUREAU.render();
  const t = BUREAU.create('task', { parent: b.id, title: 'Shoot the storm scene' }); t.due = null; BUREAU.render();
  const q = S.objects.find(o => o.title === 'Black and white or color?');
  const ring = id => { BUREAU.ctx(200, 300, id); const r = [...document.querySelectorAll('[data-c]')].map(n => n.dataset.c.split(':')[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return r; };
  const rings = { task: ring(t.id), question: ring(q.id), board: ring(b.id) };
  const p1 = BUREAU.askSteps(t.id); const glowing = BUREAU.aiAsking.includes(t.id); await p1;
  await BUREAU.askAnswer(q.id);
  const before = S.objects.filter(o => o.parent === b.id).length; await BUREAU.askFill(b.id, 'the shoot');
  const kidsOf = id => S.objects.filter(o => o.parent === id);
  return { rings, glowing, steps: t.kind === 'checklist' ? kidsOf(t.id).map(o => o.title) : t.kind, stepsUndo: S.undo.length,
    q: { a: q.answer, drafted: q.drafted, open: BUREAU.state.objects.find(o => o.id === q.id) && !(q.answer && !q.drafted) },
    added: S.objects.filter(o => o.parent === b.id).length - before,
    sent: SENT.map(x => ({ model: x.model, effort: x.output_config.effort, cached: !!x.system[0].cache_control, fb: x.fallbacks })) }; });
await nap(500);
await shot('26d-filled');
out.claudeWritesObjectsInPlace = verbs.rings.task.includes('aisteps') && verbs.rings.question.includes('aianswer') && verbs.rings.board.includes('aifill')
  && verbs.glowing && Array.isArray(verbs.steps) && verbs.steps.length === 3 && verbs.q.drafted === true && /Black and white/.test(verbs.q.a)
  && verbs.added === 2 && verbs.sent.every(x => x.model === 'claude-opus-5-5' && x.cached && x.fb === 'default') || JSON.stringify(verbs);
// A box drawn with the Magic Selector offers Claude on its ring; the card
// fills that space, and everything lands inside the box (decision 307).
const room = await page.evaluate(async () => { const S = BUREAU.state;
  const d = BUREAU.create('drawer', { parent: 'root', title: 'Shoot day', noSeed: true });
  S.view = 'drawer'; S.drawerId = d.id; BUREAU.render();
  const cell = { x: 2, y: 3, w: 4, h: 6, parent: d.id };
  const m = await import('/js/panels.js'); const t = await import('/js/tiles.js');
  t.pending.cell = cell; m.shapeRing({ left: 120, top: 300, width: 160, height: 240, right: 280, bottom: 540 }, cell);
  return { id: d.id, cell, ask: !!document.querySelector('[data-act="ringask"]') }; });
await nap(400);
await shot('27-ring');
await page.locator('[data-act="ringask"]').tap(); await nap(500);
const roomCard = await page.evaluate(() => ({ verb: document.querySelector('#panel [data-act="askgo"]')?.dataset.verb,
  sub: document.querySelector('#panel .psub, #panel .ptop')?.textContent.replace(/\s+/g, ' ').trim() }));
await page.locator('#askbox').fill('the kit for the shoot');
await page.locator('#panel [data-act="askgo"]').first().tap(); await nap(900);
const filled = await page.evaluate(r => { const S = BUREAU.state, kids = S.objects.filter(o => o.parent === r.id);
  const inside = o => { const b = o.phone; return b && b.x >= r.cell.x && b.y >= r.cell.y && b.x + b.w <= r.cell.x + r.cell.w && b.y + b.h <= r.cell.y + r.cell.h; };
  return { n: kids.length, inside: kids.every(inside), titles: kids.map(o => o.title + '@' + JSON.stringify(o.phone)) }; }, room);
await shot('27b-room');
out.aDrawnBoxIsFilledByClaude = room.ask && roomCard.verb === 'room' && filled.n === 2 && filled.inside || JSON.stringify({ room, roomCard, filled });
await page.evaluate(() => { BUREAU.aiStub = null; BUREAU.state.deskCfg.rail = null; });

// ---- paper on paper (decision 308) ------------------------------------------
// A note carried over another is laid on top rather than refused, and is what
// a finger finds there; Square Up piles a stack at one corner, a tap on the
// pile drops its sheets down as slips, a slip opens its sheet; Fan Out lays
// them a row apart with every name showing and pressable; Spread Out gives
// each clear board again.
const pp = await page.evaluate(() => { const S = BUREAU.state; S.look.locked = false; S.sel = [];
  const d = BUREAU.create('drawer', { parent: 'root', title: 'Papers', noSeed: true });
  const mk = (t, box, body) => { const o = BUREAU.create('note', { parent: d.id, title: t }); o.body = body; o.phone = box; return o.id; };
  const ids = { d: d.id, a: mk('The pitch', { x: 1, y: 1, w: 4, h: 4 }, 'One page, what it is.'),
    b: mk('Budget', { x: 1, y: 7, w: 4, h: 4 }, 'Under five thousand.'), c: mk('Schedule', { x: 5, y: 7, w: 3, h: 3 }, 'Three weekends in March.') };
  S.view = 'drawer'; S.drawerId = d.id; BUREAU.render(); return ids; });
await nap(500);
const ppAt = id => page.evaluate(id => { const r = document.querySelector(`#app .grid .drawer[data-row="${id}"]`).getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + 12, cell: parseFloat(document.querySelector('#drawergrid').style.getPropertyValue('--rowh')) || r.width / 4 }; }, id);
const ppDrag = async (id, dx, dy) => { const st = await ppAt(id);
  await page.mouse.move(st.x, st.y); await page.mouse.down(); await nap(350);
  await page.mouse.move(st.x + dx * st.cell, st.y + dy * st.cell, { steps: 10 }); await nap(120);
  const lifts = await page.evaluate(id => document.querySelector(`#app .grid .drawer[data-row="${id}"]`).classList.contains('laysover'), id);
  await page.mouse.up(); await nap(400); return lifts; };
const lifts = await ppDrag(pp.b, 0, -5);
await ppDrag(pp.c, -3, -5);
const laid = await page.evaluate(i => { const S = BUREAU.state, f = id => S.objects.find(o => o.id === id);
  const ra = document.querySelector(`[data-row="${i.a}"]`).getBoundingClientRect();
  const top = document.elementFromPoint(ra.x + 20, ra.bottom - 10)?.closest('[data-row]')?.dataset.row;
  return { bz: f(i.b).z, cz: f(i.c).z, overlaps: f(i.b).phone.y < 5, topIsB: top === i.b, undo: S.undo[S.undo.length - 1].steps.some(x => x.set && x.set.k === 'z') }; }, pp);
await shot('28-paper');
out.paperLiesOnPaper = lifts && laid.bz === 1 && laid.cz === 2 && laid.overlaps && laid.topIsB && laid.undo || JSON.stringify({ lifts, laid });
const piled = await page.evaluate(i => { BUREAU.ctx(200, 300, i.a); const ring = [...document.querySelectorAll('[data-c]')].map(n => n.dataset.c.split(':')[0]);
  document.querySelector('[data-c^="square:"]').click(); const S = BUREAU.state, f = id => S.objects.find(o => o.id === id);
  return { ring: ['square', 'fan', 'spread'].every(k => ring.includes(k)), corner: [i.a, i.b, i.c].every(id => f(id).phone.x === 1 && f(id).phone.y === 1),
    top: document.querySelector(`[data-row="${i.a}"]`).classList.contains('piletop'), grouped: [i.a, i.b, i.c].every(id => f(id).grp && f(id).grp === f(i.a).grp) }; }, pp);
await nap(400);
await page.locator(`#app .grid .drawer[data-row="${pp.a}"]`).tap(); await nap(600);
const slips = await page.evaluate(() => ({ open: document.querySelector('#ctx.open.pilemenu') != null, names: [...document.querySelectorAll('#ctx .pilestrip b')].map(n => n.textContent) }));
await shot('28b-pile');
await page.locator('#ctx .pilestrip').nth(2).tap(); await nap(800);
const slipOpens = await page.evaluate(() => { const S = BUREAU.state; return (S.objects.find(o => o.id === S.readId) || {}).title; });
await page.evaluate(() => { document.querySelector('#sheetHost [data-sheet="close"]')?.click(); }); await nap(500);
out.aPileDropsDownAsSlips = piled.ring && piled.corner && piled.top && piled.grouped && slips.open
  && slips.names.join('|') === 'The pitch|Schedule|Budget' && slipOpens === 'Budget' || JSON.stringify({ piled, slips, slipOpens });
await page.evaluate(i => { BUREAU.state.readId = null; BUREAU.render(); BUREAU.ctx(200, 300, i.a); document.querySelector('[data-c^="fan:"]').click(); }, pp); await nap(500);
const fannedOut = await page.evaluate(i => { const S = BUREAU.state, f = id => S.objects.find(o => o.id === id);
  const col = [i.a, i.b, i.c].map(id => f(id)).sort((x, y) => x.phone.y - y.phone.y);
  const tap = col[1], r = document.querySelector(`[data-row="${tap.id}"]`).getBoundingClientRect();
  return { ys: col.map(o => o.phone.y), xs: col.map(o => o.phone.x), names: col.every(o => { const el = document.querySelector(`[data-row="${o.id}"]`), q = el.getBoundingClientRect();
    return document.elementFromPoint(q.x + 30, q.y + 8)?.closest('[data-row]') === el; }), mid: tap.title, at: { x: r.x + 40, y: r.y + 10 } }; }, pp);
await shot('28c-fanned');
await page.touchscreen.tap(fannedOut.at.x, fannedOut.at.y); await nap(800);
const midOpens = await page.evaluate(() => { const S = BUREAU.state; return (S.objects.find(o => o.id === S.readId) || {}).title; });
await page.evaluate(() => { document.querySelector('#sheetHost [data-sheet="close"]')?.click(); }); await nap(400);
out.aFanIsAContentsOfItsPages = fannedOut.ys.join() === '1,2,3' && fannedOut.xs.every(x => x === 1) && fannedOut.names && midOpens === fannedOut.mid
  || JSON.stringify({ fannedOut, midOpens });
const spreadOut = await page.evaluate(i => { const S = BUREAU.state; S.readId = null; BUREAU.render(); BUREAU.ctx(200, 300, i.a);
  document.querySelector('[data-c^="spread:"]').click(); const f = id => S.objects.find(o => o.id === id);
  const bx = [i.a, i.b, i.c].map(id => f(id).phone), ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  return { clear: !ov(bx[0], bx[1]) && !ov(bx[0], bx[2]) && !ov(bx[1], bx[2]), loose: [i.a, i.b, i.c].every(id => !f(id).z && !f(id).grp) }; }, pp);
out.spreadOutGivesEachItsPlace = spreadOut.clear && spreadOut.loose || JSON.stringify(spreadOut);
await page.evaluate(() => { const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; BUREAU.render(); });

// ---- the Showroom (decision 309) ---------------------------------------------
// Laid by its Settings button: a drawer on the desk with a room for each part
// of Bureau, quick to lay; a tap opens it; a wiki card goes into the real
// dashboard; nothing in it reaches the desk's Now; the packed parcel unfolds;
// a fan written in the paste is laid as one, a row apart.
const sr = await page.evaluate(() => { const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; S.readId = null; BUREAU.render();
  const t0 = performance.now(); const r = BUREAU.showroom(true); const ms = Math.round(performance.now() - t0);
  const sh = r && r.box; BUREAU.render();
  const el = sh && document.querySelector(`#app [data-drawer="${sh.id}"]`); if (el) el.scrollIntoView({ block: 'center' });
  return { id: sh && sh.id, ms, sample: !!(sh && sh.sample), rooms: sh ? S.objects.filter(o => o.parent === sh.id && o.kind === 'drawer').map(o => o.title) : [] }; });
await nap(500);
await page.locator(`#app [data-drawer="${sr.id}"]`).first().tap(); await nap(900);
const inRoom = await page.evaluate(id => BUREAU.state.drawerId === id, sr.id);
await shot('29-showroom');
const wikiGo = await page.evaluate(() => { const S = BUREAU.state, card = S.objects.find(o => o.parent === S.drawerId && o.kind === 'card' && o.title === 'Bureau');
  const el = card && document.querySelector(`#app [data-row="${card.id}"]`); if (el) el.scrollIntoView({ block: 'center' });
  return card && card.id; });
await nap(500);
if (wikiGo) await page.locator(`#app [data-row="${wikiGo}"]`).tap(); await nap(1000);
const wentTo = await page.evaluate(() => { const S = BUREAU.state; return (S.objects.find(o => o.id === S.drawerId) || {}).sk; });
await shot('29b-wiki');
const kept = await page.evaluate(id => { const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; BUREAU.render();
  const now = S.objects.find(o => o.sk === 'now' && o.parent === 'root'); if (!now) return 'no Now on the desk';
  const el = document.querySelector(`#app [data-drawer="${now.id}"]`); const words = el ? el.textContent : '';
  const sr = S.objects.find(o => o.id === id), insideNow = S.objects.find(o => o.kind === 'now' && o.title === 'Now' && o.parent !== 'root' && (S.objects.find(x => x.id === o.parent) || {}).title === 'A desk that helps');
  return { desk: !/Renew the lens insurance/.test(words), room: !!insideNow }; }, sr.id);
const parcel = await page.evaluate(() => { const S = BUREAU.state, p = S.objects.find(o => o.kind === 'flatpack' && o.title === 'A weekend in Lisbon' && o.pack);
  if (!p) return 'no parcel'; BUREAU.unfold(p.id); const b = S.objects.find(o => o.title === 'A weekend in Lisbon' && o.kind === 'project');
  return { unfolded: !!b, inside: b ? S.objects.filter(o => o.parent === b.id).length : 0, inBin: p.parent === '__bin' }; });
const fan = await page.evaluate(() => { const S = BUREAU.state, f = t => S.objects.find(o => o.title === t && o.phone);
  const c = ['1. The radio', '2. The boat', '3. The storm', '4. The light'].map(f);
  return c.every(Boolean) && c.every((o, i) => o.phone.x === c[0].phone.x && o.phone.y === c[0].phone.y + i && o.z === i + 1 && o.grp === c[0].grp); });
out.theShowroomHasARoomForEachPart = sr.rooms.length === 12 && sr.sample && sr.ms < 6000 && inRoom || JSON.stringify(sr);
out.aWikiCardGoesToTheDashboard = wentTo === 'bureau' || JSON.stringify({ wikiGo, wentTo });
out.itKeepsToItself = kept && kept.desk && kept.room || JSON.stringify(kept);
out.itsParcelUnfoldsAndItsFanIsLaid = parcel && parcel.unfolded && parcel.inside >= 5 && parcel.inBin && fan || JSON.stringify({ parcel, fan });
await page.evaluate(() => { const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; BUREAU.render(); });

// ---- up and down only, and a desk that does not swell (decision 310) --------
// A room of the Showroom is a screen wide: it draws no pad beside it, cannot
// be scrolled sideways even when told to, and still scrolls down; the desk,
// wider than the screen, still goes sideways. Laying the Showroom again
// leaves no old one in the bin and the desk no bigger; a save that cannot be
// written says so.
const col = await page.evaluate(id => { const S = BUREAU.state;
  const room = S.objects.find(o => o.parent === id && o.kind === 'drawer' && o.title === 'Paper');
  S.view = 'drawer'; S.drawerId = room.id; BUREAU.render();
  const sc = document.querySelector('#app .scroll'), g = document.querySelector('#app .grid');
  sc.scrollLeft = 120; sc.scrollTop = 300;
  const r = { colonly: sc.classList.contains('colonly'), cols: g && g.style.getPropertyValue('--cols'), wide: sc.scrollWidth - sc.clientWidth,
    left: sc.scrollLeft, down: sc.scrollTop > 0, overflowX: getComputedStyle(sc).overflowX };
  S.view = 'desk'; S.drawerId = null; BUREAU.render();
  const dk = document.querySelector('#app .scroll'); dk.scrollLeft = 0; dk.scrollLeft = 120;
  r.desk = { colonly: dk.classList.contains('colonly'), left: dk.scrollLeft };
  return r; }, sr.id);
await nap(300);
const relaid = await page.evaluate(() => { const S = BUREAU.state;
  BUREAU.showroom(true); const n0 = S.objects.length; BUREAU.showroom(true);
  const inBin = S.objects.filter(o => o.sk === 'showroom' && o.parent === '__bin').length;
  return { grew: S.objects.length - n0, inBin, onDesk: S.objects.filter(o => o.sk === 'showroom').length }; });
const full = await page.evaluate(async () => { const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function(){ const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; };
  try { BUREAU.save(); } finally { Storage.prototype.setItem = set; }
  await new Promise(r => setTimeout(r, 50));
  const t = document.querySelector('.toast'); const said = t ? t.textContent : '';
  BUREAU.save(); return said; });
await shot('30-column');
out.aScreenWideBoardGoesUpAndDownOnly = col.colonly && col.cols === '8' && col.wide <= 1 && col.left === 0 && col.down && col.overflowX === 'hidden'
  && !col.desk.colonly && col.desk.left > 0 || JSON.stringify(col);
out.layingTheShowroomAgainDoesNotSwellTheDesk = relaid.inBin === 0 && relaid.onDesk === 1 && Math.abs(relaid.grew) <= 4 || JSON.stringify(relaid);
out.aSaveThatFailsIsSaid = /Not saved: storage is full/.test(full) || JSON.stringify(full);
await page.evaluate(() => { const S = BUREAU.state; S.view = 'desk'; S.drawerId = null; BUREAU.render(); });

// ---- flat on the table (decision 311) ---------------------------------------
// Nothing on a board casts a shadow, on the desk or in a Showroom room: no
// outer box-shadow with a blur or an offset that can be seen, and no soft
// drop-shadow (the zero-blur hairlines that draw a torn edge are lines, not
// shadows). A tile in the hand still lifts, and the toast over the board
// still floats.
const flat = await page.evaluate(async () => { const S = BUREAU.state;
  const soft = v => v.split(/,(?![^(]*\))/).filter(l => !/inset/.test(l)).some(l => {
    const a = l.match(/rgba?\(([^)]*)\)/), al = a ? parseFloat(a[1].split(',')[3] ?? '1') : 1;
    const n = (l.replace(/rgba?\([^)]*\)|color\([^)]*\)|oklab\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
    return al > .02 && n.length >= 3 && n[2] > 0 && (n[0] || n[1]); });
  const dark = v => /drop-shadow/.test(v) && [...v.matchAll(/drop-shadow\(([^()]*(?:\([^)]*\))?[^()]*)\)/g)]
    .some(m => { const n = (m[1].replace(/rgba?\([^)]*\)|color\([^)]*\)|var\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat); return n[2] > 0 && (n[0] || n[1]) && !/rgba\(0, 0, 0, 0\)/.test(m[1]); });
  const own = /^(pull|dmark|wseal|dpanel|dtop|jar|binball|binrim|pipemouth|tlnowmark|tageye|tileimg|pvines|twine|parcellabel|spinetop|spinefoot)/;
  const cast = [];
  const look = () => document.querySelectorAll('#app .grid > .drawer, #app .grid > .drawer *').forEach(el => {
    if ([...el.classList].some(c => own.test(c))) return;
    const cs = getComputedStyle(el);
    if (soft(cs.boxShadow) || dark(cs.filter)) cast.push([...el.classList].slice(0, 3).join('.')); });
  look();
  const sh = S.objects.find(o => o.sk === 'showroom');
  for (const t of ['Paper', 'Doodads and tools', 'Pictures and decor', 'Claude']) {
    const room = S.objects.find(o => o.parent === (sh && sh.id) && o.title === t); if (!room) continue;
    S.view = 'drawer'; S.drawerId = room.id; BUREAU.render(); look(); }
  S.view = 'desk'; S.drawerId = null; BUREAU.render();
  const t = document.querySelector('#app .grid > .drawer.dtile');
  t.classList.add('dragging'); await new Promise(r => setTimeout(r, 400));
  const lifts = soft(getComputedStyle(t).boxShadow); t.classList.remove('dragging');
  const M = await import('./js/mutations.js'); M.toast('Flat');
  const floats = soft(getComputedStyle(document.querySelector('.toast')).boxShadow);
  return { cast: [...new Set(cast)].slice(0, 8), lifts, floats }; });
await shot('31-flat');
out.nothingOnABoardCastsAShadow = !flat.cast.length && flat.lifts && flat.floats || JSON.stringify(flat);

out.errors = errs;
console.log(JSON.stringify(out, null, 2));
await browser.close();
const bad = Object.entries(out).filter(([k, v]) => v === false);
if (errs.length || bad.length) { console.error('safari: ' + (bad.map(([k]) => k).join(', ') || 'page errors')); process.exit(1); }
