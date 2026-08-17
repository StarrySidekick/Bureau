// Smoke test for Bureau. Needs a server running (scripts/serve.sh) and playwright.
//   npm i playwright && scripts/serve.sh & && node test/smoke.mjs
// Every value in the printed summary should be truthy and `errors` should be [].
// Screenshots land in test/shots/ — look at them, this is a visual app.
import { chromium } from 'playwright';
const URL = process.env.BUREAU_URL || 'http://127.0.0.1:8000/index.html';
// Somewhere that already has a Chromium playwright didn't download itself:
//   BUREAU_CHROME=/opt/pw-browsers/chromium node test/smoke.mjs
const CHROME = process.env.BUREAU_CHROME;

(async () => {
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
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
  // …into a drawer that opens as a grid: the Inbox opens as a list now, and a
  // field tile is a thing on a board.
  await page.click('.grid .drawer[data-drawer="d_ideas"]');
  await page.waitForTimeout(250);
  // the quick-add bar is gone; a text-field object makes tasks instead
  await page.evaluate(() => {
    const f = BUREAU.create('field', { parent: 'd_ideas', title: 'Add…' });
    f[BUREAU.state.device] = { x:1, y:1, w:8, h:2 };
    BUREAU.render();
  });
  await page.waitForTimeout(250);
  await page.fill('[data-fieldfor]', 'Order the brass pulls');
  await page.press('[data-fieldfor]', 'Enter');
  await page.waitForTimeout(400);
  // the desk name in the bar opens the desk map now, so going home is the
  // back button — which is what it is there for
  await page.click('.gridbar [data-act="back"]');
  await page.waitForTimeout(250);
  await page.click('.gridbar [data-act="appsettings"]');
  await page.waitForTimeout(320);
  // settings is a panel over the desk now, not a screen instead of it — the
  // board has to still be there behind it, and there is no modal scrim left
  const settingsIsPanel = await page.evaluate(() => {
    const s = document.querySelector('#panel');
    return !!s && s.dataset.panel === 'settings'
      && s.getBoundingClientRect().width < innerWidth * 0.6
      && !!document.querySelector('#drawergrid')
      && !document.querySelector('#scrim');
  });
  await shot('02-settings');
  /* --- sixteen slots, and a slot means the same thing in every style.
     A drawer holds the slot number, not the hex, so changing style has to
     repaint it in the new style's answer for that slot — and changing back has
     to put it exactly where it was, because nothing was ever converted. */
  const before = await page.evaluate(() => {
    const S = BUREAU.state;
    const d = S.objects.find(o => o.id === 'd_in');
    return { slot: d.c,
             paint: getComputedStyle(document.querySelector('[data-drawer="d_in"]')).backgroundColor,
             ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() };
  });
  await page.click('[data-style3="starry"]');
  await page.waitForTimeout(320);
  const swapped = await page.evaluate(() => {
    const S = BUREAU.state;
    const d = S.objects.find(o => o.id === 'd_in');
    return { slot: d.c,
             paint: getComputedStyle(document.querySelector('[data-drawer="d_in"]')).backgroundColor,
             ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
             theme: document.documentElement.dataset.theme };
  });
  await shot('03-starry-settings');
  await page.click('[data-style3="victorian"]');
  await page.waitForTimeout(320);
  const backAgain = await page.evaluate(() => ({
    slot: BUREAU.state.objects.find(o => o.id === 'd_in').c,
    paint: getComputedStyle(document.querySelector('[data-drawer="d_in"]')).backgroundColor,
    ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()
  }));
  const slotColours = {
    storedAsSlot: typeof before.slot === 'number',
    slotUnchanged: before.slot === swapped.slot && swapped.slot === backAgain.slot,
    repainted: before.paint !== swapped.paint,
    chromeFollowed: before.ink !== swapped.ink,
    darkFromStyle: swapped.theme === 'walnut',
    exactRoundTrip: before.paint === backAgain.paint && before.ink === backAgain.ink
  };

  await page.click('[data-style3="starry"]');
  await page.waitForTimeout(250);
  await page.reload();
  await page.waitForTimeout(700);
  const survived = await page.evaluate(() =>
    BUREAU.state.objects.some(o => (o.title||'').includes('brass pulls')));
  const styleSurvived = await page.evaluate(() => BUREAU.state.look.style);
  await page.click('.gridbar [data-act="appsettings"]');
  await page.waitForTimeout(250);
  await page.click('[data-style3="victorian"]');
  await page.waitForTimeout(200);

  // --- editing the phone layout from the desktop
  await page.click('[data-layout="phone"]');
  await page.waitForTimeout(400);
  await shot('04-edit-phone-layout');
  const gridClass = await page.getAttribute('#drawergrid', 'class');
  await page.click('[data-act="stopedit"]');
  await page.waitForTimeout(300);
  await shot('05-back-to-desk');

  // --- the type picker draws every type as the thing it makes
  await page.keyboard.press('n');
  await page.waitForTimeout(400);
  const pickerPreviews = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.kindtile')];
    return tiles.length > 20 && tiles.every(t => t.querySelector('.kpv .pvgrid .drawer'));
  });
  await shot('27-type-picker');
  // the builder's preview is the same renderer on a draft object
  await page.click('[data-act="newkind"]');
  await page.waitForTimeout(300);
  await page.click('[data-ksort="drawer"]');
  await page.click('[data-klook="checklist"]');
  await page.fill('#knm', 'Reading pile');
  await page.waitForTimeout(250);
  const builderPreview = await page.evaluate(() =>
    (document.querySelector('#kpreview .drawer .dname')||{}).textContent === 'Reading pile');
  await shot('28-type-builder');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // --- every menu is the same panel, and the desk stays live behind it
  const everyMenuIsAPanel = await page.evaluate(async () => {
    const wait = () => new Promise(r => setTimeout(r, 120));
    const out = {};
    // drive each entry point and record which panel came up
    const click = async sel => { const e = document.querySelector(sel); if (e) e.click(); await wait(); };
    const key = () => { const p = document.querySelector('#panel'); return p && p.dataset.panel; };
    await click('.gridbar [data-act="appsettings"]');  out.settings = key();
    await click('[data-act="panelclose"]');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true })); await wait();
    out.newobject = key();
    await click('[data-act="newkind"]');               out.kindform = key();
    await click('[data-act="cancel"]');
    /* One panel for objects and containers alike — a container is an object
       with children, so "drawer settings" and "object settings" were the same
       question asked twice. The drawer *form* behind "Name, rule and totals…"
       is gone with them; its three rows are a disclosure in this panel. */
    const d = BUREAU.state.objects.find(o => o.kind === 'drawer');
    document.querySelector(`.grid .drawer[data-drawer="${d.id}"]`)
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 }));
    await wait();
    await click('[data-c^="objset"]');                 out.drawer = (key() || '').split(':')[0];
    out.oneName = key() === 'object:' + d.id;
    // and every one-of-many list in it is a select, not a wall of chips
    const p = document.querySelector('#panel');
    out.condensed = p.querySelectorAll('.psel').length >= 8
      && !p.querySelector('[data-otype],[data-oshape],[data-pface]');
    await click('[data-act="panelclose"]');
    // the same panel for an object, by the same name
    const o = BUREAU.state.objects.find(x => x.kind === 'task');
    BUREAU.panel(o.id); await wait();
    out.object = (key() || '').split(':')[0];
    await click('[data-act="panelclose"]');
    return out;
  });
  await page.waitForTimeout(200);

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
  /* Ten columns, and the cell is **square**. It was briefly ten by a stated
     fourteen rows, which made a page the same shape on every handset at the
     cost of a cell a third taller than it was wide — the wrong trade, because a
     square cell is what makes a stated size mean anything. So the row height
     follows the column width and the row *count* is the measured number. See
     decision 44. */
  const phoneGrid = await phone.evaluate(() => {
    const g = document.querySelector('#drawergrid');
    const cols = +getComputedStyle(g).getPropertyValue('--cols');
    const colw = g.getBoundingClientRect().width / cols;
    const rowh = parseFloat(getComputedStyle(g).getPropertyValue('--rowh'));
    return { cols: cols === 8,           // Small, the default of the three
             cellIsThumbSized: colw > 36 && colw < 62,
             square: Math.abs(colw - rowh) < 1,
             // and the bar is thin enough to leave a real page of them
             rowsFit: BUREAU.pageRows >= 12 };
  });
  // the sidebar and the four fixed tabs were both removed on purpose —
  // assert they are genuinely gone, and so is the shelf that replaced them
  const railGone = await phone.evaluate(() => !document.querySelector('.rail'));
  const tabsGone = await phone.evaluate(() => !document.querySelector('.tabbar'));
  /* --- the shelf is out, and the row it was taking went back to the grid.
     It was the last row of the phone board, holding whatever you kept to hand;
     the desks, the magic drawers and ⌘K already answer "what can I reach from
     here" between them, and none of the three costs a row of every board on
     every desk. See decision 53. */
  const shelfGone = await phone.evaluate(() => {
    const out = {};
    out.noShelf = !document.querySelector('.pinrow') && !document.querySelector('.pinbar');
    /* What is along the bottom now is the desk's own drawer front — the carcass
       the board is set into, not a shelf, because it holds nothing. It is wood
       in light and dark alike, it has a round knob, and the board stops on top
       of it, clear of the curve of the screen. */
    const main = document.querySelector('#app .main');
    const sc = document.querySelector('#app .scroll');
    const rail = document.querySelector('.deskrail');
    out.theresARailInstead = !!rail && !!rail.querySelector('.railknob');
    /* Wood, and the same wood in light and dark: `--wood` is deliberately not
       derived from the style's five, because a desk is walnut at midday too.
       The computed gradient is in rgb(), so the token is resolved the same way
       rather than compared as a hex string. */
    const probe = document.createElement('i');
    probe.style.color = 'var(--wood)';
    rail.appendChild(probe);
    const wood = getComputedStyle(probe).color;
    probe.remove();
    out.itIsMadeOfWood = getComputedStyle(rail).backgroundImage.includes(wood);
    const [r,g,bl] = wood.match(/\d+/g).map(Number);
    out.andItIsDeep = (r*0.299 + g*0.587 + bl*0.114) < 90;
    const rr = rail.getBoundingClientRect();
    out.itIsTheBottomOfTheColumn = Math.abs(rr.bottom - main.getBoundingClientRect().bottom) < 1.5;
    out.andTheBoardStopsOnIt = Math.abs(sc.getBoundingClientRect().bottom - rr.top) < 1.5;
    /* …and the bar has room to breathe: the board is inset into the carcass,
       so there is a reveal above it as well as below. */
    out.theBarBreathes = parseFloat(getComputedStyle(sc).marginTop) >= 7;
    /* …and the wood is **continuous**: the strip above the bar, the bar itself
       and the reveal under it are one piece of furniture, so nothing draws a
       line across the top of the screen between two halves of the same thing.
       The board is the only paper up there. */
    const bar = document.querySelector('.gridbar');
    out.theBarIsOnTheWood = getComputedStyle(bar).backgroundColor === wood
      && getComputedStyle(document.querySelector('#app .main')).backgroundColor === wood;
    return out;
  });
  // a tile on the board navigates, the same as it always did
  await phone.click('.grid .drawer[data-drawer="d_today"]');
  await phone.waitForTimeout(400);
  const tileNavigates = await phone.evaluate(() =>
    BUREAU.state.view === 'drawer' && BUREAU.state.drawerId === 'd_today');
  await phone.screenshot({ path: 'test/shots/08-phone-drawer-open.png' });
  // home is not on the shelf any more — desks are walked to, so this is the
  // back button, which from a desk's own drawer is the desk
  await phone.evaluate(() => { const S=BUREAU.state; S.view='desk'; S.drawerId=null; BUREAU.render(); });
  await phone.waitForTimeout(300);
  await phone.click('.drawer[data-drawer="d_ideas"]');
  await phone.waitForTimeout(350);
  await phone.screenshot({ path: 'test/shots/09-phone-drawer.png' });

  /* --- everything is always movable; a hold arms the drag, a tap does not.
     "Movable" is the *unlocked* state, and a desk now starts locked — one you
     arranged is one you want to look at — so this unlocks it first, which is
     exactly what you would do before rearranging anything. */
  await page.evaluate(() => { const S = BUREAU.state;
    S.view='desk'; S.drawerId=null; S.deskCfg.locked=false; BUREAU.render(); });
  await page.waitForTimeout(300);
  const holdArms = await page.evaluate(async () => {
    const t = document.querySelector('.grid .drawer[data-drawer]');
    const r = t.getBoundingClientRect();
    const o = { bubbles:true, clientX:r.x+r.width/2, clientY:r.y+r.height/2, pointerId:9, isPrimary:true };
    t.dispatchEvent(new PointerEvent('pointerdown', o));
    await new Promise(r2 => setTimeout(r2, 420));
    const lifted = t.classList.contains('lifted');
    t.dispatchEvent(new PointerEvent('pointerup', o));
    return lifted;
  });
  // the holdArms tap opened whatever was under it; the rest live on the desk
  await page.evaluate(() => { BUREAU.state.view = 'desk'; BUREAU.state.drawerId = null; BUREAU.render(); });
  await page.waitForTimeout(250);
  // every tile must sit exactly where its coordinates say, with no drift
  const maxDrift = await page.evaluate(() => {
    const g = document.querySelector('#drawergrid'), cs = getComputedStyle(g);
    const cell = parseFloat(cs.getPropertyValue('--rowh')), gap = parseFloat(cs.rowGap);
    const gr = g.getBoundingClientRect();
    let worst = 0;
    document.querySelectorAll('.grid .drawer').forEach(el => {
      const id = el.dataset.row || el.dataset.drawer || el.dataset.id;
      const o = BUREAU.state.objects.find(x => x.id === id);
      const box = o && o[BUREAU.state.device];
      if (!box) return;
      const er = el.getBoundingClientRect();
      worst = Math.max(worst,
        Math.abs(er.left - (gr.left + (box.x-1)*(cell+gap))),
        Math.abs(er.top  - (gr.top  + (box.y-1)*(cell+gap))));
    });
    return Math.round(worst * 100) / 100;
  });
  await shot('10-desk-board');

  // --- the paste bridge: JSON in, a drawer with its children on the desk out
  const pasteOk = await page.evaluate(() => {
    const before = BUREAU.state.objects.length;
    BUREAU.paste(JSON.stringify([
      { type: 'drawer', title: 'Lisbon', children: [
        { type: 'task', title: 'Book the flight', due: '2026-09-02' }, 'Milk' ] }
    ]));
    const d = BUREAU.state.objects.find(o => o.title === 'Lisbon');
    const t = BUREAU.state.objects.find(o => o.title === 'Book the flight');
    const m = BUREAU.state.objects.find(o => o.title === 'Milk');
    return !!(d && t && m && t.parent === d.id && m.parent === d.id
      && t.kind === 'task' && m.kind === 'task'      // a bare string is a task
      && t.due === '2026-09-02'
      && BUREAU.state.objects.length === before + 3);
  });

  // --- magic rules: a magic drawer collects by rule, and completed things
  // leave their own drawer for the archive (decisions 15 and 2)
  const magicOk = await page.evaluate(() => {
    const S = BUREAU.state;
    const q = S.objects.find(o => o.kind === 'question' && !o.done);
    const done = S.objects.find(o => o.done && !BUREAU.K[o.kind].attrs.includes('container'));
    return !!(q && BUREAU.kids('d_open').includes(q.id)       // collected by kind rule
      && done && BUREAU.kids('d_done').includes(done.id)      // the archive collects it
      && !BUREAU.kids(done.parent).includes(done.id));        // and its drawer lets it go
  });

  // --- rollups: a drawer totalling its children shows the number on its front
  const rollupOk = await page.evaluate(() => {
    const d = BUREAU.state.objects.find(o => o.title === 'Lisbon');
    d.roll = { fn: 'count' };
    BUREAU.render();
    const el = document.querySelector(`[data-drawer="${d.id}"] .rollup`);
    return !!el && el.textContent.trim() === '2';
  });

  // --- relations: stored once on one side, and the backlink is found by asking
  const relationsOk = await page.evaluate(() => {
    const S = BUREAU.state;
    const a = S.objects.find(o => o.title === 'Book the flight');
    const b = S.objects.find(o => o.title === 'Milk');
    BUREAU.relate(a.id, b.id);
    BUREAU.relate(a.id, b.id);                       // relating twice stores once
    const back = S.objects.filter(o => (o.rel || []).includes(b.id)).map(o => o.id);
    return a.rel.length === 1 && a.rel[0] === b.id
      && back.length === 1 && back[0] === a.id;
  });

  // --- the relations UI actually renders: chips, backlinks, and unlink.
  // It existed as model + CSS + handlers with nothing drawing it for a while,
  // which is exactly the failure this assertion is here to catch.
  const relationsUI = await page.evaluate(async () => {
    const S = BUREAU.state;
    const a = S.objects.find(o => o.title === 'Book the flight');
    const b = S.objects.find(o => o.title === 'Milk');
    a.attrs = (a.attrs || ['text','check','date','repeat']).concat('relates');
    // relations were on the detail sheet; they are a setting about one object,
    // so they moved into that object's panel with the rest of it
    BUREAU.panel(a.id);
    await new Promise(r => setTimeout(r, 120));
    const host = document.querySelector('#panel');
    const chips = [...host.querySelectorAll('.relchip')];
    const hasOut = chips.some(c => c.dataset.openrel === b.id);
    const canUnlink = !!host.querySelector(`[data-unrel="${a.id}:${b.id}"]`);
    const canAdd = !!host.querySelector('[data-act="addrel"]');
    // and the other end shows it as a backlink, without opting in
    BUREAU.panel(b.id);
    await new Promise(r => setTimeout(r, 120));
    const backChip = [...document.querySelectorAll('#panel .relchip')]
      .some(c => c.dataset.openrel === a.id);
    document.querySelector('[data-act="panelclose"]').click();
    return hasOut && canUnlink && canAdd && backChip;
  });

  // --- the time layer: a calendar is a magic drawer that draws what it collects
  // on the day each thing falls, in a month, a week or a day; and the same
  // container as a timeline lays its contents on a scaled axis.
  const timeLayer = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const L = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const S = BUREAU.state;
    const cal = BUREAU.create('calendar', { parent: 'root', title: 'A month' });
    // it collects, so the tasks live on the desk — narrowed to a tag as well as
    // a date, or every dated thing on the sample desk would land on it too
    cal.filter = { tag: 'caltest', rule: { f: 'date', op: 'any' } };
    const made = ['One','Two','Three'].map((t, i) => {
      const o = BUREAU.create('task', { parent: 'root', title: 'Cal ' + t, tags: ['caltest'] });
      o.due = L(new Date(Date.now() + (i * 3 - 3) * 86400000));
      return o;
    });
    const collectsNotHolds = !made.some(o => o.parent === cal.id);
    S.view = 'drawer'; S.drawerId = cal.id; BUREAU.render();
    await nap(250);
    const isMonth = !!document.querySelector('.monthgrid')
      && document.querySelectorAll('.mitem').length === 3;
    // clicking a day selects it and offers a quick-add
    document.querySelector('.mcell.today').click();
    await nap(200);
    const daySelected = !!document.querySelector('.mcell.sel') && !!document.querySelector('[data-dayadd]');
    // a week is seven of the same cells; a day is the panel and no grid at all
    document.querySelector(`[data-calview="${cal.id}:week"]`).click();
    await nap(200);
    const isWeek = !!document.querySelector('.monthgrid.cal-week')
      && document.querySelectorAll('.monthgrid .mcell').length === 7;
    document.querySelector(`[data-calview="${cal.id}:day"]`).click();
    await nap(200);
    const isDay = !document.querySelector('.monthgrid') && !!document.querySelector('.dayp');
    // hiding weekends takes two columns off the month, front and back
    cal.calview = 'month'; cal.weekends = false; BUREAU.render();
    await nap(200);
    const noWeekends = document.querySelectorAll('.monthgrid .dow').length === 5
      && [...document.querySelectorAll('.mcell')].every(c => {
        const dow = new Date(c.dataset.calday.split(':')[1] + 'T00:00').getDay();
        return dow !== 0 && dow !== 6;
      });
    // the same container as a timeline: items placed, and zoom widens the axis
    cal.layout = 'timeline'; BUREAU.render();
    await nap(200);
    const w0 = parseFloat(document.querySelector('.tlcanvas').style.width);
    const marks = document.querySelectorAll('.tlitem').length;
    const s = document.querySelector('[data-tlzoom]');
    s.value = 40; s.dispatchEvent(new Event('input', { bubbles: true }));
    await nap(220);
    const zooms = parseFloat(document.querySelector('.tlcanvas').style.width) > w0;
    // tidy up: a calendar left on the desk sits under later drag tests, and its
    // contents are on the desk now rather than inside it
    const gone = new Set([cal.id, ...made.map(o => o.id)]);
    S.objects = S.objects.filter(x => !gone.has(x.id));
    S.view = 'desk'; S.drawerId = null; BUREAU.render();
    return { collectsNotHolds, isMonth, daySelected, isWeek, isDay, noWeekends,
             marks: marks === 3, zooms };
  });

  // --- a checklist takes dictation: a box on its front makes a task inside it,
  // ticking one leaves it there, and holding a line lifts it back out
  const checklistBox = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state;
    S.view = 'desk'; S.drawerId = null;
    const cl = BUREAU.create('checklist', { parent: 'root', title: 'Pack' });
    BUREAU.render();
    await nap(200);
    const tile = document.querySelector(`.drawer[data-drawer="${cl.id}"]`);
    const box = tile && tile.querySelector('input[data-contadd]');
    const startsRight = cl.desk.w === 4 && cl.desk.h === 6;
    if (!box) return { hasBox: false };
    box.value = 'Passport';
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nap(250);
    const kids = S.objects.filter(o => o.parent === cl.id);
    const made = kids.length === 1 && kids[0].kind === 'task' && kids[0].title === 'Passport';
    const onFront = [...document.querySelectorAll(`[data-drawer="${cl.id}"] .cline`)]
      .some(l => l.textContent.trim() === 'Passport');
    // ticked things stay on a checklist — that is what a checklist is for
    BUREAU.toggleDone(kids[0].id);
    await nap(200);
    const staysWhenDone = kids[0].done
      && !!document.querySelector(`[data-drawer="${cl.id}"] .cline.done`);
    // reaching for the box must not open the drawer out from under you
    const box2 = document.querySelector(`[data-drawer="${cl.id}"] input[data-contadd]`);
    if (box2) box2.click();
    await nap(150);
    const boxDoesNotOpen = S.view === 'desk';
    S.objects = S.objects.filter(o => o.id !== cl.id && o.parent !== cl.id);
    BUREAU.render();
    return { hasBox: true, startsRight, made, onFront, staysWhenDone, boxDoesNotOpen };
  });

  /* --- a line on a checklist front can be taken back off it. Real pointer
     events, because the whole point is the 200ms hold: a tap ticks the line,
     a hold lifts it out and a drop files it somewhere else. */
  const pluck = await page.evaluate(() => {
    const S = BUREAU.state;
    S.view = 'desk'; S.drawerId = null; S.sel = [];
    const cl = BUREAU.create('checklist', { parent: 'root', title: 'Plucking' });
    // the six rows under the drawer rack are left clear by the seed, and this
    // gesture is a real mouse drag, so it has to happen where the mouse can see
    cl.desk = { x: 1, y: 4, w: 4, h: 6 };
    const one = BUREAU.create('task', { parent: cl.id, title: 'Take me out' });
    const two = BUREAU.create('task', { parent: cl.id, title: 'Tick me' });
    window.__pl = { cl: cl.id, one: one.id, two: two.id };
    BUREAU.render();
    const line = document.querySelector(`[data-pluck="${one.id}"]`);
    // an ordinary drawer: the Inbox collects by rule now and holds nothing,
    // so nothing can be filed into it — see decision 45
    const into = document.querySelector('.grid .drawer[data-drawer="d_ideas"]');
    if (!line || !into) return null;
    const a = line.getBoundingClientRect(), b = into.getBoundingClientRect();
    const tick = document.querySelector(`[data-pluck="${two.id}"]`).getBoundingClientRect();
    return { from: [a.left + a.width / 2, a.top + a.height / 2],
             to:   [b.left + b.width / 2, b.top + b.height / 2],
             tick: [tick.left + tick.width / 2, tick.top + tick.height / 2] };
  });
  const pluckWorks = await (async () => {
    if (!pluck) return { found: false };
    // a hold, then a drag onto an ordinary drawer's tile
    await page.mouse.move(...pluck.from);
    await page.mouse.down();
    await page.waitForTimeout(320);
    await page.mouse.move(pluck.from[0] + 20, pluck.from[1] + 10, { steps: 4 });
    const lifted = await page.evaluate(() => !!document.querySelector('.pluckchip'));
    await page.mouse.move(...pluck.to, { steps: 8 });
    const aimed = await page.evaluate(() => !!document.querySelector('.drawer.dropinto'));
    await page.mouse.up();
    await page.waitForTimeout(250);
    const moved = await page.evaluate(() => {
      const p = window.__pl, S = BUREAU.state;
      const o = S.objects.find(x => x.id === p.one);
      return { parent: o && o.parent, boxCleared: o && !o.desk && !o.phone,
               chipGone: !document.querySelector('.pluckchip') };
    });
    // and a plain tap still ticks the line rather than lifting it
    await page.mouse.move(...pluck.tick);
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(200);
    const ticked = await page.evaluate(() => {
      const p = window.__pl, S = BUREAU.state;
      const t = S.objects.find(x => x.id === p.two);
      const done = !!(t && t.done);
      S.objects = S.objects.filter(x => x.id !== p.cl && x.id !== p.one && x.id !== p.two);
      S.view = 'desk'; S.drawerId = null; BUREAU.render();
      return done;
    });
    return { found: true, lifted, aimed, filed: moved.parent === 'd_ideas',
             boxCleared: moved.boxCleared, chipGone: moved.chipGone, tapStillTicks: ticked };
  })();

  /* --- a question is answered by writing the answer, not by ticking a box.
     Typing must not re-render the board: the input is the thing being typed in,
     and rebuilding it would take the caret with it — so the state class is
     toggled in place and the next ordinary render agrees with it. */
  const answering = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state;
    S.view = 'desk'; S.drawerId = null;
    const q = BUREAU.create('question', { parent: 'root', title: 'Answer me' });
    q.desk = BUREAU.free(5, 4);
    BUREAU.render(); await nap(200);
    const tile = () => document.querySelector(`.drawer[data-row="${q.id}"]`);
    const noTick = !tile().querySelector('[data-check]');
    const box = tile().querySelector('input[data-answer]');
    const startsOpen = !!box && tile().classList.contains('unanswered');
    box.value = 'Because it is a property, not a species.';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await nap(150);
    const nowAnswered = tile().classList.contains('answered') && !!q.answer;
    const caretKept = document.querySelector(`input[data-answer="${q.id}"]`) === box;
    BUREAU.render(); await nap(150);
    const survivesRender = tile().classList.contains('answered');
    S.objects = S.objects.filter(o => o.id !== q.id);
    BUREAU.render();
    return { noTick, startsOpen, nowAnswered, caretKept, survivesRender };
  });

  /* --- a type can be born with things already inside it, and three knob sizes */
  const seedAndKnobs = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state;
    const pr = BUREAU.create('project', { parent: 'root', title: 'Seeded' });
    pr.desk = BUREAU.free(5, 5);
    const kids = S.objects.filter(o => o.parent === pr.id);
    const seeded = kids.length === 1 && kids[0].kind === 'field'
      && kids[0].desk.x === 1 && kids[0].desk.y === 1;
    // and a seeded child does not seed in turn (the test made one of its own
    // earlier, so count only what this project put inside itself)
    const noRunaway = kids.length === 1;
    const sizes = ['sm','md','lg'].map(k => {
      const d = BUREAU.create('drawer', { parent:'root', title:k });
      d.knobsize = k; d.desk = BUREAU.free(4, 4);
      return d;
    });
    BUREAU.render(); await nap(250);
    const w = sizes.map(d =>
      document.querySelector(`[data-drawer="${d.id}"] .pull`).getBoundingClientRect().width);
    const gone = new Set([pr.id, ...kids.map(o=>o.id), ...sizes.map(d=>d.id)]);
    S.objects = S.objects.filter(o => !gone.has(o.id));
    BUREAU.render();
    return { seeded, noRunaway, growsWithSize: w[0] < w[1] && w[1] < w[2] };
  });

  /* --- on a phone, holding still past the drag opens the menu instead.
     Synthetic pointer events, because the difference is entirely in the timing
     and a real tap can't be held. A wobble inside the slack must not cancel it. */
  const longPress = await page.evaluate(async () => {
    /* Re-queried each time on purpose: a completed drag re-renders, which
       replaces #app wholesale — dispatching the second press on the node from
       the first would be dispatching at a detached element that reaches
       nothing. This is the same trap any test driving two gestures will hit. */
    const tile = () => document.querySelector('.grid .drawer[data-drawer="d_in"]');
    if (!tile()) return { found: false };
    const at = () => { const r = tile().getBoundingClientRect();
      return [r.left + r.width/2, r.top + r.height/2]; };
    let [x, y] = at();
    const ev = (t, o) => tile().dispatchEvent(new PointerEvent(t, Object.assign(
      { bubbles:true, cancelable:true, pointerId:1, pointerType:'touch', clientX:x, clientY:y }, o)));
    // held, then let go quickly: a drag, no menu
    ev('pointerdown');
    await new Promise(r2 => setTimeout(r2, 360));
    const armed = !!document.querySelector('.drawer.lifted');
    ev('pointermove', { clientX: x + 40, clientY: y });      // a real move
    await new Promise(r2 => setTimeout(r2, 300));
    const movedNoMenu = !document.querySelector('#ctx.open');
    ev('pointerup');
    await new Promise(r2 => setTimeout(r2, 400));
    // held still through both: the menu
    [x, y] = at();
    ev('pointerdown');
    await new Promise(r2 => setTimeout(r2, 360));
    ev('pointermove', { clientX: x + 2, clientY: y + 2 });   // a thumb wobble
    await new Promise(r2 => setTimeout(r2, 300));
    const menu = !!document.querySelector('#ctx.open');
    const putDown = !document.querySelector('.drawer.lifted');
    ev('pointerup');
    document.querySelector('#ctx').classList.remove('open');
    /* A gesture that ended in the menu arms suppressClick, by design — a real
       touch always sends a click after pointerup and spends it. Synthetic
       events don't, so spend it here or it eats the next test's click. */
    document.querySelector('#frame').dispatchEvent(new MouseEvent('click', { bubbles:true }));
    return { found: true, armed, movedNoMenu, menu, putDown };
  });

  // --- a drawer starts at two cells square, on both grids
  const drawerSize = await page.evaluate(() => {
    const S = BUREAU.state;
    const d = BUREAU.create('drawer', { parent: 'root', title: 'Small' });
    const m = BUREAU.create('magic', { parent: 'root', title: 'Also small' });
    BUREAU.render();
    const ok = [d, m].every(x => x.desk.w === 2 && x.desk.h === 2);
    // and does not derive itself down to a 1×1 stamp on the phone
    S.layoutEdit = 'phone'; BUREAU.render();
    const phoneOk = [d, m].every(x => x.phone.w === 2 && x.phone.h === 2);
    S.layoutEdit = null;
    S.objects = S.objects.filter(x => x.id !== d.id && x.id !== m.id);
    BUREAU.render();
    return { ok, phoneOk };
  });

  // --- a tag opens the magic drawer that collects it, and only ever makes one
  const tagDrawer = await page.evaluate(async () => {
    const S = BUREAU.state;
    const o = S.objects.find(x => (x.tags || []).includes('bureau'));
    BUREAU.panel(o.id);
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('.realtag[data-tagdrawer="bureau"]').click();
    await new Promise(r => setTimeout(r, 250));
    const d = S.objects.find(x => x.id === S.drawerId);
    const madeOne = !!d && (d.filter || {}).tag === 'bureau'
      && BUREAU.kids(d.id).length > 0
      && BUREAU.kids(d.id).every(id => (S.objects.find(y => y.id === id).tags || []).includes('bureau'));
    // asking again reuses it rather than piling up drawers
    const n = S.objects.filter(x => (x.filter || {}).tag === 'bureau').length;
    BUREAU.panel(o.id);
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('.realtag[data-tagdrawer="bureau"]').click();
    await new Promise(r => setTimeout(r, 200));
    const kept = madeOne && S.objects.filter(x => (x.filter || {}).tag === 'bureau').length === n;
    // tidy up: it lands where the group-move test wants to move to, and the
    // grid rightly refuses to drop a drawer on top of another one
    S.objects = S.objects.filter(x => (x.filter || {}).tag !== 'bureau');
    S.view = 'desk'; S.drawerId = null; S.openId = null; BUREAU.render();
    return kept;
  });

  // --- group move: dragging one member of a selection moves the lot, keeping
  // their relative positions
  const groupMove = await page.evaluate(async () => {
    const S = BUREAU.state;
    S.sel = ['d_open', 'd_keep']; BUREAU.render();
    await new Promise(r2 => setTimeout(r2, 150));
    const t = document.querySelector('.grid .drawer[data-drawer="d_open"]');
    const grid = document.querySelector('#drawergrid');
    const cell = parseFloat(getComputedStyle(grid).getPropertyValue('--rowh'));
    const r = t.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    const ev = (type, cx, cy) => t.dispatchEvent(new PointerEvent(type,
      { bubbles: true, clientX: cx, clientY: cy, pointerId: 7, isPrimary: true }));
    const dv = S.device;
    const before = { open: { ...S.objects.find(o => o.id === 'd_open')[dv] },
                     keep: { ...S.objects.find(o => o.id === 'd_keep')[dv] } };
    ev('pointerdown', x, y);
    await new Promise(r2 => setTimeout(r2, 320));     // the hold arms the drag
    ev('pointermove', x, y + cell * 6);
    ev('pointermove', x, y + cell * 6);
    ev('pointerup', x, y + cell * 6);
    await new Promise(r2 => setTimeout(r2, 150));
    const after = { open: S.objects.find(o => o.id === 'd_open')[dv],
                    keep: S.objects.find(o => o.id === 'd_keep')[dv] };
    S.sel = []; BUREAU.render();
    return after.open.y === before.open.y + 6 && after.keep.y === before.keep.y + 6
        && after.open.x === before.open.x && after.keep.x === before.keep.x;
  });
  await shot('11-new-systems');

  /* --- what a drop means. Dragging is the only way to reach any of this, so a
     real press-hold-move-release is the only way to test it. */
  const drop = async (fromSel, to) => {
    const b = await (await page.$(fromSel)).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(320);                 // the hold arms the drag
    await page.mouse.move(to.x, to.y, { steps: 14 });
    await page.waitForTimeout(150);
    const aiming = await page.evaluate(() => ({
      gather: !!document.querySelector('.dropgather'),
      time: !!document.querySelector('.droptime'),
      into: !!document.querySelector('.dropinto') }));
    await page.mouse.up();
    await page.waitForTimeout(400);
    return aiming;
  };

  // a timeline's face is a real date axis, so a drop along it is a date
  // …unlocked first: every seeded drawer starts locked now, and a locked board
  // refuses to be rearranged, which is the whole point of it
  await page.evaluate(() => { const S=BUREAU.state;
    S.objects.find(o=>o.id==='d_studio').locked=false;
    S.view='drawer'; S.drawerId='d_studio'; BUREAU.render(); });
  await page.waitForTimeout(320);
  const tlSpan = await page.getAttribute('[data-tlspan]', 'data-tlspan');
  const rb = await (await page.$('[data-tlspan] .tlrule')).boundingBox();
  const taskSel = await page.evaluate(() => {
    const o = BUREAU.state.objects.find(x => /Dana/.test(x.title || ''));
    return o ? `.grid .drawer[data-row="${o.id}"]` : null;
  });
  const tlAim = await drop(taskSel, { x: rb.x + rb.width * 0.75, y: rb.y });
  // 75% along a 43-day span from its first day is the day the arithmetic names
  const droppedOnDay = await page.evaluate(span => {
    const p = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
    const f = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const [id, min, max] = span.split(':');
    const days = Math.round((p(max) - p(min)) / 864e5);
    const want = p(min); want.setDate(want.getDate() + Math.round(0.75 * days));
    const o = BUREAU.state.objects.find(x => /Dana/.test(x.title || ''));
    return o.parent === id && o.due === f(want);
  }, tlSpan);
  await shot('12-timeline-drop');

  // two of a kind dropped together become what they add up to
  /* Two of a kind, on the desk. The seeded tasks are *loose* now — the Inbox
     collects them where they lie rather than holding them (decision 45) — so
     this is the desk's own board, unlocked, which is where you would do it. */
  await page.evaluate(() => { const S=BUREAU.state;
    S.view='desk'; S.drawerId=null; S.deskCfg.locked=false; BUREAU.render(); });
  await page.waitForTimeout(320);
  const two = await page.evaluate(() =>
    BUREAU.state.objects.filter(o => o.kind==='task' && o.parent==='root' && !o.done
      && !(o.tags||[]).includes('sampler')).slice(0,2).map(o=>o.id));
  const tb = await (await page.$(`.grid .drawer[data-row="${two[1]}"]`)).boundingBox();
  const gatherAim = await drop(`.grid .drawer[data-row="${two[0]}"]`,
    { x: tb.x + tb.width/2, y: tb.y + tb.height/2 });
  const gathered = await page.evaluate(ids => {
    const a = BUREAU.state.objects.find(o => o.id===ids[0]);
    const c = BUREAU.state.objects.find(o => o.id===a.parent);
    return !!c && c.kind==='checklist'
      && BUREAU.state.objects.filter(o => o.parent===c.id).length===2;
  }, two);
  await shot('13-gathered');

  const dropStates = { tlAim: tlAim.time, gatherAim: gatherAim.gather, droppedOnDay, gathered };

  /* --- a tile shows less as it gets smaller, and at 1×1 shows no text ----
     Text at 40px is three letters and an ellipsis, which reads as a bug.
     Back to a desk first: the phone checks above left the window narrow, and
     the next three things all only exist above the 900px breakpoint. */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const S = BUREAU.state;
    S.view = 'desk'; S.drawerId = null;
    const kids = BUREAU.kids('root');
    const one = S.objects.find(o => o.id === kids[0]);
    const two = S.objects.find(o => o.id === kids[1]);
    if (one) one[S.device] = { x:1, y:1, w:1, h:1 };
    if (two) two[S.device] = { x:3, y:1, w:2, h:6 };
    window.__narrow = two && two.id;   // far left, so a bubble has room to its right
    BUREAU.render();
  });
  await page.waitForTimeout(200);
  const adaptiveTiles = await page.evaluate(() => {
    const mini = document.querySelector('.grid .drawer.sz-mini');
    const narrow = document.querySelector('.grid .drawer.sz-narrow:not(.sz-mini)');
    return {
      mini: !!mini,
      miniIsSilent: !!mini && !mini.innerText.trim(),
      miniHasMark: !!(mini && mini.querySelector('.minimark svg,.minimark')),
      miniStillOpens: !!(mini && (mini.dataset.drawer || mini.dataset.row)),
      narrow: !!narrow
    };
  });
  await shot('14-adaptive');

  /* --- a panel about one tile comes up beside that tile, not down the edge
     The drag tests above ended on a gesture, which leaves gestureFlags
     .suppressClick set for the next click — by design, so a reordered pin
     doesn't also open. Spend it on a click that does nothing.

     And bring this page to the front first: opening the phone page put it in
     the background, where Chromium stops producing frames — so neither the
     requestAnimationFrame that adds `open` nor the transform transition it
     turns off ever runs, and the panel measures 101% off to the right of where
     it had correctly placed itself. */
  await page.bringToFront();
  await page.waitForTimeout(200);
  await page.evaluate(() =>
    document.querySelector('#frame').dispatchEvent(new MouseEvent('click', { bubbles:true })));
  await page.evaluate(() => {
    const el = document.querySelector(`.grid .drawer[data-drawer="${window.__narrow}"]`);
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, clientX:200, clientY:200 }));
  });
  await page.waitForTimeout(120);
  await page.click('#ctx button[data-c^="objset"]');
  // a panel comes up out of the tile — measure it once the transform has run,
  // or the number you read is a frame of the animation
  await page.waitForTimeout(700);
  const bubblePanel = await page.evaluate(() => {
    const p = document.querySelector('#panel');
    if (!p) return 'no panel';
    const r = p.getBoundingClientRect();
    const t = document.querySelector(`.grid .drawer[data-drawer="${window.__narrow}"]`)
      .getBoundingClientRect();
    return { bubble: p.classList.contains('bubble'),
             side: p.classList.contains('from-right') ? 'right'
                 : p.classList.contains('from-left') ? 'left' : null,
             narrow: r.width < 420,
             gap: Math.round(r.left - t.right),
             besideIt: r.left > t.right && r.left - t.right < 30 };
  });
  await shot('15-bubble');
  await page.keyboard.press('Escape');

  /* --- the board stays where you left it ---------------------------------
     render() replaces #app wholesale, so the scroller is new every time and
     started at the top: moving a tile on a long desk threw you back a screen. */
  const scrollKept = await page.evaluate(async () => {
    const S = BUREAU.state;
    const o = S.objects.find(x => x.id === BUREAU.kids('root')[4]);
    if (o) o[S.device] = { x:1, y:44, w:6, h:6 };
    BUREAU.render();
    const sc = document.querySelector('#app .scroll');
    sc.scrollTop = 800;
    const asked = sc.scrollTop;
    BUREAU.render();
    const after = document.querySelector('#app .scroll').scrollTop;
    // …but navigating somewhere else still lands at the top
    S.view = 'drawer'; S.drawerId = 'd_in'; BUREAU.render();
    const moved = document.querySelector('#app .scroll').scrollTop;
    S.view = 'desk'; S.drawerId = null; BUREAU.render();
    return asked > 0 && after === asked && moved === 0;
  });

  /* --- a type's size is granular, and the phone size can be stated outright
     rather than derived. sizeOfKind() has to prefer the explicit one. */
  const kindSizes = await page.evaluate(() => {
    const S = BUREAU.state;
    // straight into the live registry: S.kinds only reaches KINDS via
    // refreshKinds(), which the test surface deliberately doesn't expose
    BUREAU.K.smoketype = { nm:'Smoke', ic:'note', c:'#4A7C59', key:'', ds:'test',
      attrs:['text'], size:[7,3], phoneSize:[5,4], onclick:'read', body:'' };
    // on the desk, an object made without a place goes to the inbox — so this
    // one says where, because it is about placement and not about routing
    const o = BUREAU.create('smoketype', { parent: 'root' });
    // ensureBox places it on first render, and only for the layout being edited
    S.layoutEdit = 'desk';  BUREAU.render(); const desk = { ...o.desk };
    S.layoutEdit = 'phone'; BUREAU.render(); const phone = { ...o.phone };
    S.layoutEdit = null;
    S.objects = S.objects.filter(x => x.id !== o.id);
    delete BUREAU.K.smoketype;
    BUREAU.render();
    // 7×3 is not one of the presets, and toPhoneSize would have said 16×5 —
    // an explicit phoneSize has to beat the derivation
    return desk.w === 7 && desk.h === 3 && phone.w === 5 && phone.h === 4;
  });

  // ids must be unique — a collision made byId() return the wrong object, so
  // dragging one tile moved another and new objects were immovable
  const dupIds = await page.evaluate(() => {
    const seen = new Set(); let n = 0;
    BUREAU.state.objects.forEach(o => { if (seen.has(o.id)) n++; seen.add(o.id); });
    return n;
  });

  // --- undo covers the three ways to lose the most at once. Group delete and
  // drawer delete used to bypass the single-slot bin entirely, so the toast
  // said "Deleted 12" and meant it.
  const undoWorks = await page.evaluate(async () => {
    const S = BUREAU.state, out = {};
    const ids = () => S.objects.map(o => o.id).join();

    // a selection comes back whole, in the order it was in
    const made = ['a', 'b', 'c'].map(n =>
      BUREAU.create('task', { parent: 'd_ideas', title: 'undo ' + n }).id);
    BUREAU.render();
    const beforeGroup = ids();
    BUREAU.delMany(made);
    out.groupGone = made.every(id => !S.objects.some(o => o.id === id));
    BUREAU.undo();
    out.groupExact = ids() === beforeGroup;

    // a drawer comes back, and so does where its contents were sitting
    const d = BUREAU.create('drawer', { parent: 'root', title: 'Undo test' });
    const kid = BUREAU.create('note', { parent: d.id, title: 'inside' });
    kid.desk = { x: 1, y: 1, w: 4, h: 4 };
    BUREAU.render();
    const beforeDrawer = ids();
    BUREAU.delDrawer(d.id);
    out.drawerGone = !S.objects.some(o => o.id === d.id);
    const orphan = S.objects.find(o => o.id === kid.id);
    out.contentsKept = !!orphan && orphan.parent === 'root';
    // its box was a coordinate in the drawer's space. Reused on the desk it
    // landed on top of Today; it has to be re-placed somewhere free instead.
    out.contentsReplaced = !!orphan.desk && !(orphan.desk.x === 1 && orphan.desk.y === 1);
    BUREAU.undo();
    const home = S.objects.find(o => o.id === kid.id);
    out.drawerExact = ids() === beforeDrawer;
    out.contentsHome = home.parent === d.id && home.desk.x === 1 && home.desk.y === 1;
    BUREAU.delDrawer(d.id); BUREAU.del(kid.id);

    // a paste is one move however many objects it made
    const n0 = S.objects.length;
    BUREAU.paste(JSON.stringify([{ type: 'drawer', title: 'Pasted',
      children: [{ type: 'task', title: 'x' }, { type: 'task', title: 'y' }] }]), 'root');
    out.pasteMade = S.objects.length === n0 + 3;
    BUREAU.undo();
    out.pasteUndone = S.objects.length === n0;

    // an empty stack is a toast, not a crash
    S.undo = [];
    BUREAU.undo();
    out.emptyStackSafe = true;
    return out;
  });

  // --- reading: three views of one body, and a page that actually turns
  const readViews = await page.evaluate(async () => {
    const S = BUREAU.state, out = {};
    // long enough to paginate: a page is a measured Letter sheet now, and a
    // handful of short lines all land on the first one
    const body = Array.from({ length: 30 }, (_, i) =>
      'Paragraph ' + (i + 1) + '. ' + 'Enough words to run to a line or two of a real page. '.repeat(3)
    ).join('\n\n');
    const o = BUREAU.create('note', { parent: 'root', title: 'Reading test', body });
    BUREAU.render();
    const open = m => { o.read = m; S.readId = o.id; S.openId = null; S.bookAt = 0; BUREAU.renderSheet(); };
    const pages = () => document.querySelectorAll('.bookstage .spread .page').length;

    open('book');   out.bookIsSpread = pages() === 2 && !!document.querySelector('.bookstage.rm-book');
    open('page');   out.pageIsOne = pages() === 1;
    open('scroll'); out.scrollIsOne = pages() === 1
      && !!document.querySelector('.spread.scrolling')
      && !document.querySelector('.bookbar');          // nothing to turn

    // the plain half-screen read panel is gone
    out.noPlainRead = !document.querySelector('#sheet');

    // turning forward advances by a spread and lays a leaf over the page.
    // A press first: the synthetic pin drag above armed suppressClick and no
    // real click ever came to spend it, which is the staleness onDown clears.
    open('book');
    document.body.dispatchEvent(new PointerEvent('pointerdown',
      { bubbles: true, clientX: 2, clientY: 2, pointerId: 9, isPrimary: true }));
    document.querySelector('[data-act="booknext"]').click();
    out.turnAdvanced = S.bookAt === 2;
    out.leafDrawn = !!document.querySelector('.book .spread .leaf');
    await new Promise(r => setTimeout(r, 700));
    out.leafCleared = !document.querySelector('.leaf');
    // and back again
    document.querySelector('[data-act="bookprev"]').click();
    await new Promise(r => setTimeout(r, 700));
    out.turnedBack = S.bookAt === 0;

    // a page turns one at a time, not two
    open('page');
    document.querySelector('[data-act="booknext"]').click();
    out.pageStepsOne = S.bookAt === 1;
    await new Promise(r => setTimeout(r, 700));

    // the type carries the default, the object overrides it
    out.typeDefault = BUREAU.K.note.read === undefined;   // unset means page
    delete o.read;
    open(undefined); o.read = undefined; S.readId = o.id; BUREAU.renderSheet();
    out.defaultsToPage = document.querySelectorAll('.bookstage .spread .page').length === 1;
    /* A story opens as a book in both senses, and they are different
       properties: `layout` pages through the scenes it holds, `read` pages
       through its own body. It used to assert `onclick === 'read'`, which a
       container has no use for — clicking one navigates into it. */
    out.storyOpensAsBook = BUREAU.K.story.read === 'book' && BUREAU.K.story.layout === 'book';

    S.readId = null; BUREAU.renderSheet();
    BUREAU.del(o.id); S.undo = [];
    return out;
  });

  // --- the sheet is US Letter and the same size whatever is written on it.
  // It used to be a min-height, so a long body grew a taller and taller page
  // and an empty one in scroll view collapsed to a sliver.
  const paperSize = await page.evaluate(async () => {
    const S = BUREAU.state, out = {};
    const p = 'Paragraph with enough words in it to take up a line or two of a real page. ';
    const make = (n, t) => BUREAU.create('note',
      { parent: 'root', title: t, body: Array.from({ length: n }, () => p).join('\n\n') });
    const empty = make(0, 'Empty'), long = make(60, 'Long');
    empty.body = '';
    const box = (o, m) => { o.read = m; S.readId = o.id; S.openId = null; S.bookAt = 0;
      BUREAU.renderSheet();
      const r = document.querySelector('.bookstage .spread').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    };
    const near = (a, b) => Math.abs(a - b) <= 1;

    for (const m of ['book', 'page', 'scroll']) {
      const e = box(empty, m), l = box(long, m);
      out[m + 'Steady'] = near(e.w, l.w) && near(e.h, l.h);
      // one sheet is 8.5:11; a spread is two of them side by side
      const cols = m === 'book' ? 2 : 1;
      out[m + 'IsLetter'] = Math.abs((e.w / cols) / e.h - 8.5 / 11) < 0.02;
    }
    // and every mode is the same height, so switching view doesn't jump
    out.sameHeight = near(box(long, 'book').h, box(long, 'page').h)
      && near(box(long, 'page').h, box(long, 'scroll').h);
    // a long body paginates rather than overflowing its page
    box(long, 'page');
    const pg = document.querySelector('.bookstage .spread .page');
    out.noOverflow = pg.scrollHeight <= pg.clientHeight + 1;
    out.paginated = +document.querySelector('.bookcount').textContent.split(' of ')[1] > 6;

    S.readId = null; BUREAU.renderSheet();
    BUREAU.delMany([empty.id, long.id]); S.undo = [];
    return out;
  });
  await shot('12-reading');

  /* --- migrations 10, 17, 19 and 20: a v9 desk's phone boxes are in
     16-column coordinates, and the phone grid has been 8, 10, 9, and is now 8
     again — Small, the first of three sizes to choose between. Halving and then
     rescaling three times is the inverse of what the grid did, and rounding can
     put two neighbours in the same cell each time, so every step also has to
     leave nothing overlapping. A fresh context, and the snapshot is planted by an init script
     rather than written and reloaded — the running page writes on beforeunload,
     so a reload would put the seeded desk straight back over it. */
  const v9desk = JSON.stringify({
    v: 9, theme: 'paper', pins: [], look: {}, kinds: {}, deskCfg: {},
    objects: [
      { id:'d_a', kind:'drawer', title:'A', parent:'root', tags:[], phone:{x:1,y:1,w:8,h:6}, desk:{x:1,y:1,w:6,h:6} },
      { id:'d_b', kind:'drawer', title:'B', parent:'root', tags:[], phone:{x:9,y:1,w:8,h:6}, desk:{x:7,y:1,w:6,h:6} },
      // 7 and 8 both halve to 4, so these two would land on each other
      { id:'d_c', kind:'drawer', title:'C', parent:'root', tags:[], phone:{x:1,y:7,w:7,h:6}, desk:{x:13,y:1,w:6,h:6} },
      { id:'d_d', kind:'drawer', title:'D', parent:'root', tags:[], phone:{x:2,y:8,w:8,h:6}, desk:{x:19,y:1,w:6,h:6} }
    ]
  });
  const migCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await migCtx.addInitScript(snap => { localStorage.setItem('bureau.v1', snap); }, v9desk);
  const mig = await migCtx.newPage();
  await mig.goto(URL);
  await mig.waitForTimeout(700);
  const phoneMigration = await mig.evaluate(() => {
    const b = id => (BUREAU.state.objects.find(o => o.id === id) || {}).phone;
    const hit = (p,q)=> p.x < q.x+q.w && q.x < p.x+p.w && p.y < q.y+q.h && q.y < p.y+p.h;
    const all = ['d_a','d_b','d_c','d_d'].map(b);
    if (all.some(x => !x)) return { found: false };
    let clear = true;
    for (let i=0;i<all.length;i++) for (let j=i+1;j<all.length;j++) if (hit(all[i],all[j])) clear = false;
    return {
      found: true,
      /* 16 → 8 halves it, 8 → 10 adds a quarter, 10 → 9 takes a tenth off:
         a 8-wide box in sixteen columns comes out 5 wide in nine. Only the
         first is asserted by number — the rest of the row cannot fit beside it
         at nine columns, so they are re-placed, and what is checked there is
         that they are re-placed *legally* rather than left on top of it. */
      rescaled: b('d_a').w === 4 && b('d_a').h === 3 && b('d_a').x === 1,
      inside: all.every(x => x.x >= 1 && x.x + x.w - 1 <= 8),
      clear,
      nothingElseAdded: BUREAU.state.objects.length === 4,
      deskUntouched: BUREAU.state.objects.find(o=>o.id==='d_b').desk.x === 7
    };
  });
  await mig.screenshot({ path: 'test/shots/16-migrated-phone.png' });
  await migCtx.close();

  /* --- a new object has to be *seen*. A board is a coordinate space, so the
     first free room is found scanning from the top — and on a phone, where an
     object is full width, that is always below everything already there. Made
     inside a drawer it landed a screen and a half down and looked exactly like
     nothing had happened. Driven through the real path: the picker, then the
     type's own key, which is what a keyboard and a tap both end up calling. */
  await phone.evaluate(() => {
    BUREAU.state.view = 'drawer'; BUREAU.state.drawerId = 'd_ideas';
    BUREAU.state.editId = null; BUREAU.render();
    document.querySelector('#app .scroll').scrollTop = 0;
  });
  await phone.waitForTimeout(300);
  const newObjectSeen = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const before = BUREAU.state.objects.length;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    await nap(200);
    const picker = !!document.querySelector('[data-new="note"]');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', bubbles: true }));  // Note
    await nap(300);
    const made = BUREAU.state.objects[BUREAU.state.objects.length - 1];
    const el = document.querySelector(`.grid .drawer[data-row="${made.id}"]`);
    const r = el && el.getBoundingClientRect();
    const out = { picker, madeOne: BUREAU.state.objects.length === before + 1,
      inDrawer: made.parent === 'd_ideas',
      // it was placed below the fold — that is correct — and then scrolled to
      placedLow: made.phone.y > 8,
      onScreen: !!r && r.top >= 0 && r.bottom <= innerHeight + 1 };
    BUREAU.del(made.id); BUREAU.state.undo = [];
    BUREAU.state.view = 'desk'; BUREAU.state.drawerId = null; BUREAU.render();
    return out;
  });
  await phone.screenshot({ path: 'test/shots/17-phone-new-object.png' });

  /* --- a double tap edits the tile where it sits. Tasks and notes are a line
     and a paragraph; neither is worth a screen, and the old detail sheet was
     the only way to change either of them. */
  const inlineEdit = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state;
    S.view = 'desk'; S.drawerId = null; S.sel = [];
    const o = BUREAU.create('task', { parent: 'root', title: 'Before' });
    o.desk = BUREAU.free(6, 2);
    BUREAU.render(); await nap(150);
    const tile = () => document.querySelector(`.grid .drawer[data-row="${o.id}"]`);
    tile().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await nap(150);
    const field = document.querySelector(`.inlinename[data-inline="${o.id}:title"]`);
    const opened = !!field && S.editId === o.id;
    // a tile being typed in is a div, not a button — an input inside one is
    // unfocusable, the same trap the answer box hit
    const isDiv = !!tile() && tile().tagName === 'DIV';
    if (field) { field.value = 'After'; field.dispatchEvent(new Event('input', { bubbles: true })); }
    await nap(80);
    const wrote = o.title === 'After';
    // …and typing must not rebuild the board underneath the caret
    const caretKept = document.querySelector(`.inlinename[data-inline="${o.id}:title"]`) === field;
    /* A task carries `text`, so the body is under the name and Return moves to
       it rather than finishing — the same key does the same thing it does in
       any two-field form. Escape is what puts the tile back down. */
    if (field) field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nap(120);
    const toBody = document.activeElement
      && document.activeElement.dataset.inline === o.id + ':body';
    document.querySelector('[data-inline]')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nap(150);
    const closed = S.editId === null && !document.querySelector('.inlinename');
    const survives = tile().innerText.includes('After');
    // a container is not edited this way: two taps on a drawer opens it twice
    const d = BUREAU.state.objects.find(x => x.id === 'd_in');
    document.querySelector(`.grid .drawer[data-drawer="${d.id}"]`)
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await nap(120);
    const containerExempt = S.editId === null;
    S.view = 'desk'; S.drawerId = null;
    BUREAU.del(o.id); S.undo = []; BUREAU.render();
    return { opened, isDiv, wrote, caretKept, toBody, closed, survives, containerExempt };
  });

  /* --- a container type carries a default sort, and one container can refuse
     it. Manual is a value, not the absence of one — which is what lets an
     object override a type that sorts. */
  const sortDefaults = await page.evaluate(async () => {
    const S = BUREAU.state, out = {};
    const d = BUREAU.create('drawer', { parent: 'root', title: 'Sorting' });
    ['Charlie', 'Alpha', 'Bravo'].forEach(t => BUREAU.create('note', { parent: d.id, title: t }));
    const titles = () => BUREAU.kids(d.id).map(id => S.objects.find(o => o.id === id).title);
    // a drawer is manual, and deliberately so: a grid is a place
    const manual = titles().join();
    out.drawerIsManual = manual !== 'Alpha,Bravo,Charlie' && manual.split(',').length === 3;
    BUREAU.K.sorttype = { nm:'Sorted', ic:'folder', c:5, key:'', ds:'test',
      attrs:['container'], layout:'grid', size:[4,4], sort:'az', body:'' };
    d.kind = 'sorttype';
    out.typeSorts = titles().join() === 'Alpha,Bravo,Charlie';
    d.sort = 'manual';                       // one drawer refusing its type
    out.objectRefuses = titles().join() === manual;
    d.sort = 'za';
    out.objectOverrides = titles().join() === 'Charlie,Bravo,Alpha';
    delete BUREAU.K.sorttype;
    BUREAU.delDrawer(d.id);
    BUREAU.state.objects = S.objects.filter(o => !['Charlie','Alpha','Bravo'].includes(o.title));
    S.undo = []; BUREAU.render();
    return out;
  });

  /* --- no type draws a coloured left stripe any more. A stripe is what
     priority means; painting one on by default made every task look flagged.
     `edge` is the opt-in, and the four new shapes are the answers instead. */
  const taskLook = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state;
    S.view = 'desk'; S.drawerId = null;
    const shapes = ['sliver','tab','ruled','chit','pill'];
    const made = shapes.map((sh, i) => {
      const o = BUREAU.create('task', { parent: 'root', title: 'Look ' + sh });
      o.shape = sh; o.desk = BUREAU.free(7, 1);
      return o;
    });
    BUREAU.render(); await nap(200);
    const px = el => parseFloat(getComputedStyle(el).borderLeftWidth) || 0;
    const el = o => document.querySelector(`.grid .drawer[data-row="${o.id}"]`);
    const noStripe = made.every(o => px(el(o)) < 2);
    const allDrawn = made.every(o => el(o) && el(o).getBoundingClientRect().height > 10);
    // and the opt-in still works
    made[0].edge = true; BUREAU.render(); await nap(150);
    const edgeStillWorks = px(el(made[0])) >= 3;
    // the tick on a tile is twice the one in a row
    const rowBox = 19;
    const tick = document.querySelector('.grid .tilecheck');
    const bigCheck = !!tick && tick.getBoundingClientRect().width >= rowBox * 2 - 1;
    BUREAU.delMany(made.map(o => o.id)); S.undo = []; BUREAU.render();
    return { noStripe, allDrawn, edgeStillWorks, bigCheck,
             fourNewShapes: ['tab','ruled','chit','pill'].every(s => !!BUREAU.shapes[s]) };
  });
  await shot('18-task-shapes');

  /* --- the top shelf's buttons are toggles, not menus. A phone has no room
     for a popup that asks a question you could answer by pressing the button
     again — so each one has to *say* which state it is in. */
  const shelfTools = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    S.view = 'desk'; S.drawerId = null; BUREAU.render(); await nap(150);
    const btn = sel => document.querySelector('.gridbar ' + sel);
    // the lock: one button, and the icon says which way round it is
    /* A desk starts *locked*: one you arranged is one you want to look at, not
       one you nudge every time a thumb lands on a front. So the round trip
       starts from shut. */
    S.deskCfg.locked = true; BUREAU.render(); await nap(150);
    out.startsLocked = !!S.deskCfg.locked && !!btn('[data-act="togglelock"]');
    const shutShackle = btn('[data-act="togglelock"]').innerHTML;
    btn('[data-act="togglelock"]').click(); await nap(200);
    out.unlocksFromTheBar = !S.deskCfg.locked
      && btn('[data-act="togglelock"]').innerHTML !== shutShackle;
    btn('[data-act="togglelock"]').click(); await nap(200);
    out.locks = !!S.deskCfg.locked
      && !!document.querySelector('.grid.locked');
    // a locked board refuses the drag and still gives you the menu
    const tile = () => document.querySelector('.grid .drawer[data-drawer="d_in"]');
    const r = tile().getBoundingClientRect();
    const ev = (t, o) => tile().dispatchEvent(new PointerEvent(t, Object.assign(
      { bubbles:true, cancelable:true, pointerId:3, pointerType:'touch',
        clientX:r.left+r.width/2, clientY:r.top+r.height/2 }, o)));
    const before = { ...BUREAU.state.objects.find(o => o.id === 'd_in')[S.device] };
    ev('pointerdown');
    await nap(360);
    out.lockedDoesNotLift = !document.querySelector('.drawer.lifted');
    ev('pointermove', { clientX: r.left + r.width/2 + 2, clientY: r.top + r.height/2 + 2 });
    await nap(320);
    out.lockedStillMenus = !!document.querySelector('#ctx.open');
    ev('pointerup');
    document.querySelector('#ctx').classList.remove('open');
    document.querySelector('#frame').dispatchEvent(new MouseEvent('click', { bubbles:true }));
    const after = BUREAU.state.objects.find(o => o.id === 'd_in')[S.device];
    out.lockedDoesNotMove = after.x === before.x && after.y === before.y;
    btn('[data-act="togglelock"]').click(); await nap(200);
    out.unlocks = !S.deskCfg.locked;

    /* The sort tool is gone from the bar. How a board arranges itself is
       something you decide once and then live with, which is a settings
       question; a tool is for what you change while you are working. It is the
       "Sorted by" row of the board's own editor now. */
    out.noSortTool = !document.querySelector('[data-act="sortnext"]');
    out.noSortPopup = !document.querySelector('[data-sortby]');
    // the lock is the leftmost of them, because it decides what every other
    // gesture on the board means
    const tools = [...document.querySelectorAll('.bartools .sqbtn')];
    out.lockIsLeftmost = tools[0] && tools[0].dataset.act === 'togglelock';
    /* …and the desk has an editor of its own — the same panel a drawer opens,
       for the board you are standing on. The gear beside it is the *app*, which
       is a different question, and it is only offered from a desk. */
    out.deskHasAnEditor = tools.some(t => t.dataset.act === 'drawersettings'
      && t.dataset.id === 'root');
    out.andTheGearIsStillTheApp = tools.some(t => t.dataset.act === 'appsettings');
    document.querySelector('.bartools [data-act="drawersettings"]').click(); await nap(280);
    const body = document.querySelector('#panel .pbody');
    out.theDeskEditorSorts = /Sorted by/.test(body.textContent)
      && !!body.querySelector('[data-oset="root:sort"]');
    out.andPaintsThisDeskAlone = !!body.querySelector('[data-pboard][data-id="root"]');
    out.andSaysHowWideTheGridIs = !!body.querySelector('[data-gridsize]');
    document.querySelector('[data-act="panelclose"]').click(); await nap(150);
    // and the view cycler is gone: how a board is laid out is a settings
    // question, not a tool
    out.noViewButton = !document.querySelector('[data-act="cycleview"]');
    out.noRandomButton = !document.querySelector('.gridbar [data-act="randomone"]');
    return out;
  });

  /* --- three grid sizes to try on. The only number that changes is how many
     columns a phone board has; the cell is square, so the columns set its size
     and the rows are whatever fits. Switching rescales every stored phone box —
     a column count is a coordinate space — and the rounding is half *down* so a
     two-cell drawer front does not grow into three on a finer grid, which is
     what makes eight to ten and back the arrangement you started with. */
  const gridSizes = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    const g = () => document.querySelector('#drawergrid');
    const cols = () => +getComputedStyle(g()).getPropertyValue('--cols');
    const rack = () => ['d_today','d_in','d_all','d_ideas'].map(id => {
      const b = S.objects.find(o => o.id === id).phone;
      return `${b.x},${b.y},${b.w}x${b.h}`; }).join('|');
    const square = () => Math.abs(g().getBoundingClientRect().width/cols()
      - parseFloat(getComputedStyle(g()).getPropertyValue('--rowh'))) < 1;
    const was = rack();
    out.smallIsTheDefault = S.look.grid === 'small' && cols() === 8;
    BUREAU.setGrid('extra'); await nap(400);
    out.extraIsNine = cols() === 9 && square();
    BUREAU.setGrid('large'); await nap(400);
    out.largeIsTen = cols() === 10 && square();
    // …and the cells get smaller as the columns get more, which is the point
    const big = 390/8, small = 390/10;
    out.moreColumnsSmallerCells = big > small;
    BUREAU.setGrid('small'); await nap(400);
    out.backIsWhereYouWere = cols() === 8 && rack() === was;
    /* The whole board is rows now, not rows-less-a-shelf: 8x13, 9x14, 10x15 on
       a 390pt handset, give or take whatever this one's height rounds to. */
    out.everyRowIsTheBoards = BUREAU.pageRows >= 13;
    return out;
  });

  /* --- where a container is kept. There is one answer left: a drawer is
     either a desk out in the master space, or it is on the board it lives on.
     The shelf was the third and it is out (decision 53) — but nothing anybody
     put on it is lost, because `S.pins` is still loaded and saved untouched. */
  const keeping = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    out.noShelfAnywhere = !document.querySelector('.pinbar,.pinrow,.shelf-bottom');
    out.pinsAreStillStored = Array.isArray(S.pins);
    const d = S.objects.find(o => o.kind === 'drawer' && !S.desks.includes(o.id));
    const stood = d.parent;
    /* Promoting takes it off the board it was standing on, because a desk is
       somewhere you go rather than a front you look at. See decision 40. */
    BUREAU.setPin(d.id, 'desk'); await nap(200);
    out.movesToTheRow = S.desks.includes(d.id);
    out.leavesTheBoardItWasOn = d.parent == null
      && !BUREAU.kids(stood).includes(d.id)
      && !document.querySelector(`.grid .drawer[data-drawer="${d.id}"]`);
    // and demoting is a return, not a guess: it goes back where it stood
    BUREAU.setPin(d.id, null); await nap(150);
    out.unpins = !S.desks.includes(d.id);
    out.demotingPutsItBack = d.parent === stood;
    // asking for the shelf leaves it exactly where it lives, and draws nothing
    BUREAU.setPin(d.id, 'pin'); await nap(150);
    out.askingForTheShelfIsHarmless = d.parent === stood && !S.desks.includes(d.id)
      && !!document.querySelector(`.grid .drawer[data-drawer="${d.id}"]`);

    // the desk map: every desk drawn small, and pressing one goes there
    document.querySelector('.gridbar .deskname').click(); await nap(250);
    out.theNameOpensTheMap = document.querySelectorAll('#panel .deskcard').length === S.desks.length;
    document.querySelector(`#panel .deskcard[data-deskgo="${S.desks[1]}"]`).click(); await nap(250);
    out.aCardJumps = S.drawerId === S.desks[1];
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(120);
    return out;
  });

  // --- the version is readable off the device, not guessed at
  await page.click('.gridbar [data-act="appsettings"]');
  await page.waitForTimeout(320);
  const versionShown = await page.evaluate(() => {
    const p = document.querySelector('#panel');
    return /\d+\.\d+/.test(p.querySelector('.pbody .statline').textContent)
      && /Bureau \d+\.\d+/.test(p.querySelector('.ptop').textContent);
  });
  await page.keyboard.press('Escape');

  // --- one of every type on the desk, named after itself
  const sampler = await page.evaluate(() => {
    const S = BUREAU.state;
    const kinds = Object.keys(BUREAU.K).filter(k => k !== 'control');
    const onDesk = S.objects.filter(o => o.parent === 'root' && (o.tags||[]).includes('sampler'));
    return { one: kinds.every(k => onDesk.some(o => o.kind === k)),
             named: onDesk.every(o => o.title === BUREAU.K[o.kind].nm),
             // and the rack plus six clear rows above them
             clearTop: onDesk.every(o => o.desk.y >= 10),
             knobIsMedium: BUREAU.K.drawer.knobsize === undefined
               && getComputedStyle(document.querySelector('.grid .dtile .pull')).width !== '' };
  });

  /* --- a phone board is pages, not scrolling. It is exactly as tall as the
     rows that fit under the bar; what does not fit is on the next page, and
     two fingers walk through them. */
  await phone.bringToFront();
  await phone.evaluate(() => { BUREAU.state.view='desk'; BUREAU.state.drawerId=null; BUREAU.render(); });
  await phone.waitForTimeout(400);
  const paging = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const out = {};
    const g = () => document.querySelector('#drawergrid');
    const sc = () => document.querySelector('#app .scroll');
    // every row of it is the board's now — the shelf used to take the last one
    out.rowsMeasured = BUREAU.pageRows >= 13;
    out.exactlyOnePage = /repeat\((\d+),/.exec(g().style.gridTemplateRows)[1] === String(BUREAU.pageRows);
    out.neverScrolls = sc().scrollHeight <= sc().clientHeight + 1
      && getComputedStyle(sc()).overflowY === 'hidden';
    /* …and the column adds up exactly — bar, the reveal, the rows, the rail —
       so the board never runs into the curve at the bottom of the screen and
       there is nothing left hanging anywhere. */
    const main = document.querySelector('#app .main');
    const bar = document.querySelector('.gridbar');
    const rail = document.querySelector('.deskrail');
    const h = e => e.getBoundingClientRect().height;
    const gap = parseFloat(getComputedStyle(sc()).marginTop);
    out.theColumnAddsUp =
      Math.abs(h(bar) + gap + h(sc()) + h(rail) - main.clientHeight) < 1.5;
    out.clearsTheCurveOfTheScreen = h(rail) >= 30
      && g().getBoundingClientRect().bottom <= innerHeight - 30;
    out.morePages = BUREAU.pageCount('root') > 1;
    // nothing may straddle a break: half a tile on each of two screens is a
    // tile you can read neither half of
    const per = BUREAU.pageRows;
    out.nothingStraddles = BUREAU.kids('root').every(id => {
      const b = BUREAU.state.objects.find(o => o.id === id).phone;
      return !b || (b.h <= per && Math.floor((b.y-1)/per) === Math.floor((b.y+b.h-2)/per));
    });
    // two fingers up and down
    const el = document.querySelector('#frame');
    const T = (x,y,i) => ({identifier:i, target:el, clientX:x, clientY:y});
    const mk = (t,list) => { const e = new Event(t,{bubbles:true,cancelable:true});
      e.touches=list; e.targetTouches=list; e.changedTouches=list; return e; };
    const swipe = (dx,dy) => { el.dispatchEvent(mk('touchstart',[T(200,500,1),T(240,500,2)]));
      el.dispatchEvent(mk('touchmove',[T(200+dx,500+dy,1),T(240+dx,500+dy,2)]));
      el.dispatchEvent(mk('touchend',[])); };
    swipe(0,-120); await nap(220);
    out.twoFingersTurnPage = BUREAU.pageAt('root') === 1;
    swipe(0,120); await nap(220);
    out.andBack = BUREAU.pageAt('root') === 0;
    // two fingers sideways walks the pinned drawers
    swipe(-140,0); await nap(260);
    out.twoFingersWalkDrawers = BUREAU.state.view === 'drawer';
    swipe(140,0); await nap(260);
    out.andBackToDesk = BUREAU.state.view === 'desk';
    return out;
  });

  /* --- the way in on a phone. There were two: pulling a drawer front up out
     of the shelf, and holding a bare cell. The shelf is gone and so is the
     pull that came out of it — holding a cell is the one that is left, and it
     is the better half: pulling made a thing with nowhere in mind, holding a
     cell makes one *there*, which is what a grid is for. See decision 47. */
  const makingOnAPhone = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const out = {};
    const grid = document.querySelector('#drawergrid');
    const gr = grid.getBoundingClientRect();
    const cell = parseFloat(getComputedStyle(grid).getPropertyValue('--rowh'));
    // a bare cell, low on the board where the seed leaves room
    const bare = { x: gr.left + cell/2, y: gr.bottom - cell/2 };
    const tap = (el,x,y,type) => el.dispatchEvent(new PointerEvent(type,
      { bubbles:true, cancelable:true, pointerId:11, pointerType:'touch', clientX:x, clientY:y }));
    tap(grid, bare.x, bare.y, 'pointerdown'); tap(grid, bare.x, bare.y, 'pointerup');
    await nap(200);
    out.bareBoardDoesNothing = !document.querySelector('#panel');
    out.noPullLeftBehind = !document.querySelector('.shelfpull');
    // …and holding it lights the cell and opens the picker on that cell
    tap(grid, bare.x, bare.y, 'pointerdown');
    await nap(420);
    out.holdingLightsTheCell = !!document.querySelector('.grid .ghost.band');
    tap(grid, bare.x, bare.y, 'pointerup');
    await nap(320);
    const p = document.querySelector('#panel');
    out.andOpensThePicker = !!p && p.dataset.panel === 'newobject';
    // …and on a phone a menu comes up out of the bottom, so the board is still
    // visible and still live above it
    const pr = p && p.getBoundingClientRect();
    out.comesFromTheBottom = !!pr && pr.left < 2 && pr.right > innerWidth - 2
      && pr.bottom >= innerHeight - 1 && pr.top > innerHeight * 0.1;
    document.querySelector('[data-act="panelclose"]').click();
    return out;
  });

  /* --- the desk's own drawer front. Two things start on it and the difference
     is whether you moved: a tap on the knob takes you out, and a pull opens the
     new-object picker. The pull came out of the shelf until the shelf went; it
     comes out of real furniture now. See decisions 43 and 53. */
  const railDrawer = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(200);
    const rail = () => document.querySelector('.deskrail');
    const knob = () => document.querySelector('.railknob');
    // the knob is round, and it is the wood the rail is made of
    const ks = getComputedStyle(knob());
    out.theKnobIsRound = ks.borderRadius.startsWith('50%')
      && Math.abs(parseFloat(ks.width) - parseFloat(ks.height)) < 1;
    // tapping it from inside a drawer comes back out to the desk
    S.view='drawer'; S.drawerId='d_ideas'; BUREAU.render(); await nap(220);
    knob().click(); await nap(400);
    out.theKnobTakesYouOut = S.view === 'desk' && !S.drawerId;

    /* A real pull, not a flick: the front follows the finger and only opens if
       you carry it about a quarter of the screen. Forty pixels used to do it,
       committed, with nothing drawn — which is why it kept happening by
       accident, including on the way out of the app. */
    const r = rail().getBoundingClientRect();
    const x = r.left + 24, y = r.top + 8;      // clear of the knob and of iOS's strip
    const tap = (el,cx,cy,type) => el.dispatchEvent(new PointerEvent(type,
      { bubbles:true, cancelable:true, pointerId:31, pointerType:'touch', clientX:cx, clientY:cy }));
    tap(rail(), x, y, 'pointerdown');
    tap(rail(), x, y - 60, 'pointermove');
    await nap(20);
    out.aFlickDoesNotOpenIt = !!document.querySelector('.shelfpull')
      && !document.querySelector('.shelfpull.ready') && !document.querySelector('#panel');
    tap(rail(), x, y - 60, 'pointerup');
    await nap(320);
    out.andItDropsBack = !document.querySelector('#panel');
    // …and the whole way does
    tap(rail(), x, y, 'pointerdown');
    for (let i = 1; i <= 8; i++){ tap(rail(), x, y - i*40, 'pointermove'); await nap(12); }
    out.itFollowsTheFinger = !!document.querySelector('.shelfpull.ready');
    tap(rail(), x, y - 320, 'pointerup');
    await nap(320);
    const p = document.querySelector('#panel');
    out.pullingOpensThePicker = !!p && p.dataset.panel === 'newobject';
    document.querySelector('[data-act="panelclose"]').click(); await nap(150);
    return out;
  });

  /* --- the desk's drawer is furniture, so it is asked the same questions a
     drawer front is — and from the same panel that asks about the board it is
     set into. The keys are prefixed because for every desk but home that
     object is itself a drawer with a knob and a texture of its own. */
  const railIsFurniture = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(200);
    const rail = () => document.querySelector('.deskrail');
    const knob = () => document.querySelector('.railknob');
    // the knob *is* a drawer pull: same class, so every shape and the light on
    // it are the ones the board already has
    out.theKnobIsAPull = knob().classList.contains('pull');
    const wasW = parseFloat(getComputedStyle(knob()).width);
    const set = (k,v) => { S.deskCfg[k]=v; BUREAU.render(); };
    set('railknob','bar'); await nap(150);
    out.theShapeFollows = knob().classList.contains('kn-bar')
      && parseFloat(getComputedStyle(knob()).width) > wasW;
    set('railknob','round'); set('railknobsize','lg'); await nap(150);
    out.theSizeFollows = parseFloat(getComputedStyle(knob()).width) > wasW;
    set('railknobsize','sm'); set('railtexture','weave'); await nap(150);
    out.theTextureFollows = rail().classList.contains('tx-weave')
      && getComputedStyle(rail(), '::after').backgroundImage !== 'none';
    // …and the texture goes *under* the knob, the same as on a front
    out.andPrintsUnderTheKnob = (+getComputedStyle(rail(), '::after').zIndex || 0)
      < (+getComputedStyle(knob()).zIndex || 0);
    set('railtexture','none');
    /* The wood is per desk and it is the **whole** carcass, not just the rail:
       one piece of furniture, so recolouring it repaints the bar too. */
    set('wood','#4A3524'); await nap(150);
    const woodOf = el => { const i=document.createElement('i');
      i.style.color='var(--wood)'; el.appendChild(i);
      const c=getComputedStyle(i).color; i.remove(); return c; };
    out.theWoodIsPerDesk = woodOf(rail()) === 'rgb(74, 53, 36)'
      && getComputedStyle(document.querySelector('.gridbar')).backgroundColor === 'rgb(74, 53, 36)';
    delete S.deskCfg.wood; delete S.deskCfg.railknob;
    delete S.deskCfg.railknobsize; delete S.deskCfg.railtexture;
    BUREAU.render(); await nap(150);
    out.andTheAppsOwnWalnutComesBack = woodOf(rail()) === 'rgb(58, 44, 30)';
    return out;
  });

  /* --- the board being slid in beside you arrives *in position*. Both the
     reveal above the board and the depth of the drawer below it are measured
     after layout, and they used to be written onto the elements only then — so
     a previewed neighbour arrived at the CSS floor, sat a little high, and
     clicked down to position the moment the swipe committed. */
  const pagerLandsFlat = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(250);
    const grid = document.querySelector('#drawergrid');
    const gr = grid.getBoundingClientRect();
    const x = gr.left + gr.width - 30, y = gr.top + gr.height - 30;
    const ev = (t,cx) => grid.dispatchEvent(new PointerEvent(t,
      { bubbles:true, cancelable:true, pointerId:77, pointerType:'touch', clientX:cx, clientY:y }));
    ev('pointerdown', x);
    for (let i=1;i<=5;i++){ ev('pointermove', x - i*30); await nap(16); }
    const px = sel => { const e=document.querySelector(sel); return e && getComputedStyle(e); };
    /* The neighbour is measured against the live board in #app, which is what
       the strip carried on its first frame and what the middle pane is a
       picture of by now. */
    const cur = px('#app .scroll'), next = px('.pane.next .scroll');
    const curRail = px('#app .deskrail'), nextRail = px('.pane.next .deskrail');
    out.thePagerIsUp = !!document.querySelector('.pager') && !!next;
    out.theMiddleIsAPicture = !!document.querySelector('.pane.cur .main');
    out.theNextBoardStartsWhereThisOneDoes = !!next && next.marginTop === cur.marginTop;
    out.andItsDrawerIsAsDeep = !!nextRail && nextRail.height === curRail.height;
    ev('pointerup', x - 150); await nap(500);
    /* A swipe arms suppressClick so its own trailing click can't also fire.
       Nothing sends that click here, so it is consumed by hand — otherwise the
       flag sits there and eats the next test's first tap. */
    document.querySelector('#frame').dispatchEvent(new MouseEvent('click', {bubbles:true}));
    // the live board is the real one, so it has to be handed back untouched
    const m = document.querySelector('#app .main');
    out.andTheBoardIsPutBack = !m.style.transform && !m.style.willChange;
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(150);
    return out;
  });

  /* --- the dots by the title are the desks, not the pages. A row you walk
     sideways is a row you can be lost in, and "third of five" is the one thing
     a strip of dots says better than anything else. */
  const deskDots = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(200);
    const dots = () => [...document.querySelectorAll('.deskmark i')];
    out.oneDotPerDesk = dots().length === S.desks.length;
    out.theOneYouAreOnIsLit = dots().findIndex(d => d.classList.contains('on'))
      === S.desks.indexOf('root');
    // …and inside a drawer it still says which desk that drawer is on
    S.view='drawer'; S.drawerId='d_ideas'; BUREAU.render(); await nap(200);
    out.itFollowsYouIntoADrawer = dots().findIndex(d => d.classList.contains('on'))
      === S.desks.indexOf(BUREAU.deskOf('d_ideas'));
    // pressing one goes there
    dots()[1].click(); await nap(300);
    out.pressingOneGoesThere = S.drawerId === S.desks[1];
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(150);
    return out;
  });

  /* --- a board that isn't a grid can still be swiped off. The one-finger
     sideways swipe that walks the desks started from the bare cells of a
     locked grid, which a desk set to List, Scroll or Book hasn't got — so a
     desk laid out as a list was one you could not swipe off. The scroller is
     the surface those layouts do have. Sideways only: up and down is the
     list's own scrolling. */
  const listSwipe = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    S.view='desk'; S.drawerId=null; S.deskCfg.layout='list'; BUREAU.render(); await nap(250);
    const sc = document.querySelector('#app .scroll');
    out.aListDeskHasNoGrid = !!sc && !sc.querySelector('.grid');
    const r = sc.getBoundingClientRect();
    const y = r.top + 30, x = r.left + r.width - 24;
    const ev = (type, cx, cy) => sc.dispatchEvent(new PointerEvent(type,
      { bubbles:true, cancelable:true, pointerId:23, pointerType:'touch', clientX:cx, clientY:cy }));
    ev('pointerdown', x, y);
    for (let i=1;i<=6;i++){ ev('pointermove', x - i*40, y); await nap(16); }
    out.sidewaysStartsThePager = !!document.querySelector('.pager');
    ev('pointerup', x - 240, y);
    await nap(450);
    out.andLandsOnTheNextDesk = S.drawerId === S.desks[1];
    S.view='desk'; S.drawerId=null; S.deskCfg.layout='grid'; BUREAU.render(); await nap(200);
    return out;
  });
  await phone.screenshot({ path: 'test/shots/19-phone-board.png' });

  /* --- movement. Every animation in Bureau is an overlay over a state change
     that has already happened, so what is checked here is that the state moves
     *immediately* and that the flourish exists beside it — never that anything
     waits for a keyframe. See motion.js. */
  await page.bringToFront();
  await page.evaluate(() => { const S = BUREAU.state;
    S.view='desk'; S.drawerId=null; S.deskCfg.locked=false; BUREAU.render(); });
  await page.waitForTimeout(300);
  const movement = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};

    /* how a thing opens is worked out from what it is, and can be overruled.
       Which way round it is, not how big: a square is a drawer at any size, and
       it takes standing up taller than it is wide to be a cabinet. */
    const d = S.objects.find(o => o.id === 'd_in');
    d.desk = { ...d.desk, w:4, h:4 };
    out.squareIsADrawer = BUREAU.openingFor(d) === 'drawer';
    d.desk = { ...d.desk, w:6, h:6 };
    out.andSoIsABigSquare = BUREAU.openingFor(d) === 'drawer';
    d.desk = { ...d.desk, w:4, h:6 };
    out.standingIsACabinet = BUREAU.openingFor(d) === 'cabinet';
    d.opening = 'curl';
    out.overrideWins = BUREAU.openingFor(d) === 'curl';
    delete d.opening;
    d.desk = { ...d.desk, w:4, h:4 };
    const note = S.objects.find(o => o.kind === 'note');
    out.paperCurls = BUREAU.openingFor(note) === 'curl';
    out.aTaskJustLifts = BUREAU.openingFor(S.objects.find(o => o.kind === 'task')) === 'lift';
    BUREAU.render(); await nap(160);

    // opening a drawer: there *and then*, with the front flying over the top
    document.querySelector('.grid .drawer[data-drawer="d_in"]').click();
    out.arrivesAtOnce = S.view === 'drawer' && S.drawerId === 'd_in';
    out.frontFlies = !!document.querySelector('#fx .fxopen.fx-drawer .fxfront');
    out.boardArrives = !!document.querySelector('#app .main.in-drawer');
    await nap(560);
    out.ghostClearsItselfUp = !document.querySelector('#fx .fxopen');
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(160);

    // a sheet of paper curls, and the page it opens is not instant either
    note.parent = 'root'; note.desk = BUREAU.free(5, 4, 'root');
    BUREAU.render(); await nap(150);
    document.querySelector(`.grid .drawer[data-row="${note.id}"]`).click();
    out.paperLifts = !!document.querySelector('.drawer.curling .curlshade');
    out.readOpensAtOnce = S.readId === note.id;
    await nap(600);
    out.curlClearsItselfUp = !document.querySelector('.curling,.curlshade');
    BUREAU.state.readId = null; BUREAU.renderSheet();

    // ticking pops, and the ring survives the thing leaving the drawer
    const t = BUREAU.create('task', { parent:'root', title:'Pop' });
    t.desk = BUREAU.free(4, 2, 'root'); BUREAU.render(); await nap(150);
    document.querySelector(`.grid .drawer[data-row="${t.id}"] [data-check]`).click();
    out.tickedAtOnce = t.done === true;
    out.popsWhereItStood = !!document.querySelector('#fx .fxring');
    await nap(620);
    out.ringClearsItselfUp = !document.querySelector('#fx .fxring');
    BUREAU.del(t.id); S.undo = [];

    /* A magic drawer is gilded, and the gilt does not move. It was holographic
       — a rainbow foil under a highlight, both sliding about with how the phone
       was tilted — and it was tacky: furniture does not shimmer at you. Gone,
       along with the two numbers on #frame that drove it. See decision 42. */
    BUREAU.render(); await nap(150);
    const mt = document.querySelector('.drawer.magicdrawer');
    out.giltDoesNotAnimate = !!mt && getComputedStyle(mt).animationName === 'none';
    out.stillGilded = !!mt && /gradient/.test(getComputedStyle(mt).backgroundImage);
    const before = getComputedStyle(mt).backgroundImage;
    document.querySelector('#frame').style.setProperty('--holox', '0.05');
    out.nothingTracksTheLight = getComputedStyle(mt).backgroundImage === before
      && !/repeating-linear-gradient/.test(before);
    document.querySelector('#frame').style.removeProperty('--holox');
    return out;
  });

  /* --- the pager: the board either side of this one, drawn before you get
     there, following the finger and settling when you let go. */
  await phone.bringToFront();
  await phone.evaluate(() => { const S = BUREAU.state;
    S.view='desk'; S.drawerId=null; S.deskCfg.locked=false; BUREAU.render(); });
  await phone.waitForTimeout(350);
  const pager = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    const el = document.querySelector('#frame');
    const T = (x,y,i) => ({ identifier:i, target:el, clientX:x, clientY:y });
    const mk = (t,l) => { const e = new Event(t, {bubbles:true, cancelable:true});
      e.touches=l; e.targetTouches=l; e.changedTouches=l; return e; };
    const drag = async (dx, steps) => {
      el.dispatchEvent(mk('touchstart', [T(300,500,1), T(330,500,2)]));
      for (let i=1;i<=steps;i++){
        el.dispatchEvent(mk('touchmove', [T(300+dx*i,500,1), T(330+dx*i,500,2)]));
        await nap(16);
      }
    };
    const letGo = () => el.dispatchEvent(mk('touchend', []));

    await drag(-13, 12);
    const p = document.querySelector('.pager');
    /* Two panes and the real board between them. The middle used to be a copy
       of what was already on the screen — cheap to clone and thirteen
       milliseconds to lay out, on the frame the gesture is recognised in. The
       strip carries the live one now and the panes are only the neighbours. */
    /* Three boards again by the time you have moved twice — but the picture of
       the one you are leaving is made on the *second* frame, not the frame the
       gesture is recognised in, and until it exists the strip carries the real
       board. So the work is spread rather than landing all at once. */
    out.threeBoardsInAStrip = !!p && p.querySelectorAll('.pane').length === 3;
    out.andTheRealBoardStoodDown =
      getComputedStyle(document.querySelector('#app .main')).visibility === 'hidden';
    out.itFollowsTheFinger = !!p && /matrix|translate/.test(getComputedStyle(p.querySelector('.track')).transform);
    // it is beside #app, not inside it: a render would take it away mid-slide
    out.outsideTheBoard = !!p && p.parentElement.id === 'frame';
    out.onlyOneDrawergrid = document.querySelectorAll('#drawergrid').length === 1;
    letGo(); await nap(60);
    out.landsBeforeItStops = S.view === 'drawer';    // committed, still sliding
    await nap(400);
    out.stripClearsItselfUp = !document.querySelector('.pager');

    // …and a swipe that does not go far enough is put back
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(200);
    await drag(-4, 10); letGo(); await nap(420);
    /* Pulled back: nothing moved, and — the thing that would otherwise be left
       behind — the real board is visible again. It is hidden the moment its
       picture takes over in the strip, and a swipe that commits gets a fresh
       one from the render; a swipe that doesn't has to be handed this one back
       exactly as it was found. */
    const live = document.querySelector('#app .main');
    out.shortSwipeIsPulledBack = S.view === 'desk' && !document.querySelector('.pager')
      && getComputedStyle(live).visibility === 'visible'
      && !live.style.transform && !live.style.willChange;

    /* Locked, one finger does the same thing — a board that refuses to be
       rearranged has a spare finger. It works from a tile and from bare cells
       alike, which are two different paths through onDown, so both are driven
       here rather than trusting whatever happens to be under a coordinate. */
    S.deskCfg.locked = true; BUREAU.render(); await nap(200);
    const oneFinger = async (from, id) => {
      const r = from.getBoundingClientRect();
      const x = r.left + r.width/2, y = r.top + Math.min(r.height/2, 60);
      const o = { bubbles:true, cancelable:true, pointerId:id, pointerType:'touch', isPrimary:true };
      from.dispatchEvent(new PointerEvent('pointerdown', {...o, clientX:x, clientY:y}));
      for (let i=1;i<=14;i++){
        from.dispatchEvent(new PointerEvent('pointermove', {...o, clientX:x-i*16, clientY:y}));
        await nap(16);
      }
      const up = !!document.querySelector('.pager');
      from.dispatchEvent(new PointerEvent('pointerup', {...o, clientX:x-224, clientY:y}));
      await nap(420);
      return up;
    };
    out.oneFingerFromATile = await oneFinger(document.querySelector('.grid.locked .drawer'), 21);
    out.lockedSwipeArrives = S.view === 'drawer';
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(200);
    out.oneFingerFromBareBoard = await oneFinger(document.querySelector('#drawergrid'), 23);

    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(180);
    const tile = document.querySelector('.grid .drawer[data-drawer]');
    const id = tile.dataset.drawer, tr = tile.getBoundingClientRect();
    const tp = { bubbles:true, cancelable:true, pointerId:22, pointerType:'touch', isPrimary:true,
                 clientX:tr.left+tr.width/2, clientY:tr.top+tr.height/2 };
    tile.dispatchEvent(new PointerEvent('pointerdown', tp));
    await nap(80);
    tile.dispatchEvent(new PointerEvent('pointerup', tp));
    await nap(200);
    out.lockedTapStillOpens = S.view === 'drawer' && S.drawerId === id;
    S.deskCfg.locked = false; S.view='desk'; S.drawerId=null; BUREAU.render();
    return out;
  });
  await phone.screenshot({ path: 'test/shots/20-phone-pager.png' });

  /* --- desks: a drawer given a place in the master space. What makes it a
     desk rather than a drawer is that you are *at* it — so the breadcrumb
     roots there, the shelf belongs to it, and the row you swipe is the row of
     them. And a magic drawer stops seeing across the lot. */
  await page.bringToFront();
  await page.evaluate(() => { const S=BUREAU.state;
    S.view='desk'; S.drawerId=null; S.deskCfg.locked=false; BUREAU.render(); });
  await page.waitForTimeout(300);
  const desks = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    const bar = () => (document.querySelector('.gridbar .where')||{}).textContent
      .replace(/\s+/g,' ').trim();

    out.homeIsInTheRow = S.desks.includes('root');
    out.sampleHasMoreThanOne = S.desks.length > 1;
    // the shelf is the app's now, not any one desk's
    out.oneShelfForAllOfThem = (S.pins||[]).length > 0 && !('shelf' in S.deskCfg);

    // at a desk there is no way "up": it is where you are, not what you are in
    const dk = S.desks[1];
    S.view='drawer'; S.drawerId=dk; BUREAU.render(); await nap(200);
    out.aDeskIsWhereYouAre = bar() === (BUREAU.state.objects.find(o=>o.id===dk).title)
      && !document.querySelector('[data-act="back"]');
    out.noSecondShelf = !document.querySelector('.shelf-top.pinbar .pinbtn');

    // …and a drawer on it is somewhere you went into, from that desk
    const inner = BUREAU.create('drawer', {parent:dk, title:'Drafts'});
    inner.desk = BUREAU.free(2,2,dk);
    S.drawerId = inner.id; BUREAU.render(); await nap(200);
    out.breadcrumbRootsAtTheDesk =
      bar().startsWith(BUREAU.state.objects.find(o=>o.id===dk).title)
      && bar().includes('Drafts') && !bar().includes('Desk ›');
    out.backGoesUpOne = true;
    document.querySelector('[data-act="back"]').click(); await nap(200);
    out.backGoesUpOne = S.drawerId === dk;

    /* Scope. A rule on the home desk collects from the home desk; the same
       rule set to every desk reaches inside the others. This is the whole
       reason desks are not merely cosmetic. */
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(150);
    const far = BUREAU.create('task', {parent:dk, title:'Over there', due:BUREAU.state.objects[0].created});
    far.due = new Date().toISOString().slice(0,10);
    const mg = BUREAU.create('magic', {parent:'root', title:'Rule'});
    mg.filter = {rule:{f:'date', op:'any'}};
    mg.desk = BUREAU.free(2,2,'root'); BUREAU.render(); await nap(150);
    const sees = () => BUREAU.kids(mg.id).includes(far.id);
    out.scopedToItsOwnDeskByDefault = !sees();
    mg.filter = Object.assign({}, mg.filter, {scope:'all'});
    out.everyDeskSeesInside = sees();
    mg.filter = Object.assign({}, mg.filter, {scope:'some', scopeDesks:[dk]});
    out.chosenDesksWork = sees();
    mg.filter = Object.assign({}, mg.filter, {scope:'some', scopeDesks:['root']});
    out.chosenDesksExclude = !sees();
    // the seeded Today is global, because a Today that stops at one desk is
    // not a Today
    const today = BUREAU.state.objects.find(o => o.id === 'd_today');
    out.todayIsGlobal = (today.filter||{}).scope === 'all';

    // demoting puts it back to being an ordinary drawer, contents intact and
    // standing on a board again
    BUREAU.setPin(dk, null); await nap(150);
    const back = BUREAU.state.objects.find(o=>o.id===dk);
    out.demotes = !S.desks.includes(dk) && !!back && back.parent != null;
    BUREAU.setPin(dk, 'desk'); await nap(100);

    BUREAU.del(far.id); BUREAU.del(mg.id); BUREAU.del(inner.id); S.undo=[];
    S.view='desk'; S.drawerId=null; BUREAU.render();
    return out;
  });

  /* --- a thing that lasts more than a day. `date` is the day it falls on;
     `span` is the days it occupies, which a calendar has to mark all of and a
     timeline has to draw as a bar. */
  const spans = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    const iso = n => { const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

    const trip = BUREAU.create('trip', {parent:'root', title:'Lisbon'});
    out.tripLasts = BUREAU.K.trip.attrs.includes('span');
    trip.due = iso(1); trip.till = iso(5);
    trip.desk = {x:1, y:3, w:4, h:3};       // the clear rows under the rack, so
    // a calendar collecting anything dated has to mark all five days — and a
    // trip is a container, which only a layout that runs on time will collect
    const cal = BUREAU.create('calendar', {parent:'root', title:'When'});
    cal.desk = {x:6, y:3, w:6, h:6};        // the drop below happens on screen
    cal.filter = {rule:{f:'date',op:'any'}, scope:'all'};
    BUREAU.render(); await nap(150);
    out.aTimeLayoutCollectsContainers = BUREAU.kids(cal.id).includes(trip.id);
    S.view='drawer'; S.drawerId=cal.id; BUREAU.render(); await nap(250);
    const marked = [...document.querySelectorAll('.mcell')]
      .filter(c => c.querySelector(`.mitem[data-row="${trip.id}"]`));
    out.everyDayIsMarked = marked.length === 5;
    out.namedOnlyOnce = marked.filter(c =>
      c.querySelector(`.mitem[data-row="${trip.id}"]`).textContent.trim()).length === 1;
    out.drawnAsARun = !!document.querySelector(`.mitem.runs[data-row="${trip.id}"]`);

    // an end before the start is not a span, it is a mistake, and is ignored
    trip.till = iso(-3);
    BUREAU.render(); await nap(200);
    out.backwardsIsIgnored = [...document.querySelectorAll('.mcell')]
      .filter(c => c.querySelector(`.mitem[data-row="${trip.id}"]`)).length === 1;
    trip.till = iso(5);

    /* …and moving it keeps its length rather than collapsing it onto one day.
       Done from the desk, dropping on a day of the calendar's *tile*, which is
       the gesture you would actually make. */
    S.view='desk'; S.drawerId=null; BUREAU.render(); await nap(250);
    const day = [...document.querySelectorAll(`[data-drawer="${cal.id}"] [data-calday]`)]
      .find(c => c.dataset.calday.endsWith(iso(8)));
    const tile = document.querySelector(`.grid .drawer[data-drawer="${trip.id}"]`);
    out.movedKeepsItsLength = 'no tile';
    if(tile && day){
      const t = tile.getBoundingClientRect(), c = day.getBoundingClientRect();
      const ev = (type, x, y) => tile.dispatchEvent(new PointerEvent(type,
        {bubbles:true, clientX:x, clientY:y, pointerId:31, isPrimary:true}));
      ev('pointerdown', t.x+t.width/2, t.y+t.height/2);
      await nap(320);
      ev('pointermove', c.x+c.width/2, c.y+c.height/2);
      ev('pointermove', c.x+c.width/2, c.y+c.height/2);
      ev('pointerup',   c.x+c.width/2, c.y+c.height/2);
      await nap(250);
      out.movedKeepsItsLength = trip.due === iso(8) && trip.till === iso(12);
    }
    BUREAU.del(trip.id); BUREAU.del(cal.id); S.undo=[];
    S.view='desk'; S.drawerId=null; BUREAU.render();
    return out;
  });
  await page.screenshot({ path: 'test/shots/21-desks.png' });

  /* --- the picture surface, and a front that says how it opens ------------
     Three things that were each the app answering the wrong question. An
     object made of an image opened onto paper, because "read" was the only
     thing a click knew how to mean. A container taller than it is wide swung
     open like a cabinet while wearing a single drawer pull. And a front with
     one cell of height printed its name across its own knob. */
  const picture = await page.evaluate(async () => {
    const nap = ms => new Promise(r => setTimeout(r, ms));
    const S = BUREAU.state, out = {};
    const o = BUREAU.create('image', {title:'Kitchen wall', parent:'root'});
    o[S.device] = Object.assign(BUREAU.free(6,4,'root'), {w:6,h:4});
    BUREAU.render(); await nap(120);
    // nothing in it yet: an empty mount, not a card with a title and no body
    const tile = () => document.querySelector(`.grid .drawer[data-row="${o.id}"]`);
    out.emptyIsAMount = !!tile() && tile().classList.contains('empty')
      && !!tile().querySelector('.imgempty') && !tile().querySelector('.dbody');
    // and it opens onto the picture rather than onto a blank page
    BUREAU.view(o.id); await nap(150);
    out.opensAsAPicture = !!document.querySelector('.viewstage') && !document.querySelector('.bookstage');
    out.offersToAddOne  = !!document.querySelector('.viewdrop[data-act="pickimage"]');
    // with a picture in it: the image, and the two ways to change it
    o.media = {assetId:'a_test', type:'image', w:2, h:2, label:'wall.png',
      src:'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
      alpha:false};
    BUREAU.renderSheet(); BUREAU.render(); await nap(150);
    out.showsTheImage  = !!document.querySelector('.viewstage .viewimg');
    out.canReplaceIt   = !!document.querySelector('.viewhead [data-act="pickimage"]');
    out.canRemoveIt    = !!document.querySelector('.viewhead [data-act="dropimage"]');
    out.tileIsThePicture = !!document.querySelector(`.grid .drawer[data-row="${o.id}"] img.tileimg`);
    // audio is media too, and is not a picture: it still opens onto paper
    const a = BUREAU.create('audio', {title:'Take 3', parent:'root'});
    a[S.device] = Object.assign(BUREAU.free(6,2,'root'), {w:6,h:2});
    BUREAU.render(); await nap(120);
    out.soundIsNotAPicture = !document.querySelector(`.grid .drawer[data-row="${a.id}"].imgtile`);
    S.viewId=null; BUREAU.renderSheet();
    BUREAU.del(a.id); BUREAU.del(o.id); S.undo=[];
    BUREAU.render();
    return out;
  });

  const fronts = await page.evaluate(async () => {
    const nap = ms => new Promise(r => setTimeout(r, ms));
    const S = BUREAU.state, out = {};
    const mk = (nm,w,h) => { const d = BUREAU.create('drawer', {title:nm, parent:'root'});
      d[S.device] = Object.assign(BUREAU.free(w,h,'root'), {w,h}); return d; };
    const tall = mk('Standing', 2, 4);      // taller than wide: a cabinet
    const wide = mk('Lying',    4, 3);      // wider than tall: a drawer, at any size
    const big  = mk('Chest',    6, 5);      // …and still one, however big it gets
    const flat = mk('Sliver',   4, 1);      // one cell tall: no room for a name
    const thin = mk('Column',   1, 4);      // one cell wide: a spine
    BUREAU.render(); await nap(150);
    const knobs = d => document.querySelectorAll(`.grid .drawer[data-drawer="${d.id}"] .pull`).length;
    out.standingSwings   = BUREAU.openingFor(tall) === 'cabinet';
    out.andWearsTwoKnobs = knobs(tall) === 2;
    out.lyingStillPulls  = BUREAU.openingFor(wide) === 'drawer';
    out.andWearsOne      = knobs(wide) === 1;
    /* Which way round it is, not how big it is. A second clause used to put
       doors on anything over a given area, which is what gave a 4x3 — a front
       half again as wide as it is tall — two of them. */
    out.sizeIsNotTheQuestion = BUREAU.openingFor(big) === 'drawer' && knobs(big) === 1;
    // it follows openingFor(), not a size test of its own: say "pulls out" and
    // the second door goes with it
    tall.opening = 'drawer'; BUREAU.render(); await nap(120);
    out.overrideTakesADoorOff = knobs(tall) === 1;
    tall.opening = null;
    BUREAU.render(); await nap(120);
    /* The seam runs the whole height of the front and past the border at both
       ends — it is the gap between two doors, not a scratch on one panel. */
    const seam = document.querySelector(`.grid .drawer[data-drawer="${tall.id}"] .dseam`);
    const tr = document.querySelector(`.grid .drawer[data-drawer="${tall.id}"]`).getBoundingClientRect();
    const sr = seam && seam.getBoundingClientRect();
    out.theSeamCutsTheWholeFace = !!sr && sr.top <= tr.top + 0.5 && sr.bottom >= tr.bottom - 0.5;
    // no room for a name: the mark, over the knob
    const shows = d => { const t = document.querySelector(`.grid .drawer[data-drawer="${d.id}"]`);
      const m = t && t.querySelector('.dmark'), n = t && t.querySelector('.dtop');
      return { mark: !!m && getComputedStyle(m).display !== 'none',
               name: !!n && getComputedStyle(n).display !== 'none' }; };
    const f = shows(flat), w2 = shows(wide);
    out.shortWearsItsMark = f.mark && !f.name;
    out.roomyKeepsItsName = !w2.mark && w2.name;
    /* One cell wide is a **spine**: the title runs up the tile. It used to drop
       its name for its mark, which said it was a drawer and nothing about which
       drawer — and a book seen spine-on is the shape that already solved that. */
    const col = document.querySelector(`.grid .drawer[data-drawer="${thin.id}"]`);
    const ttl = col && col.querySelector('.spinetitle');
    out.oneCellWideIsASpine = !!ttl && ttl.textContent.trim() === 'Column'
      && /vertical/.test(getComputedStyle(ttl).writingMode);
    [tall,wide,big,flat,thin].forEach(d => BUREAU.delDrawer(d.id));
    S.undo=[]; BUREAU.render();
    return out;
  });

  /* --- shadows are a switch. Every tile casts one onto whatever is under it,
     which is most of what makes a board read as things lying *on* a surface —
     and it is also the loudest thing in the app, so it is worth being able to
     see the desk without it. A **zero** shadow rather than `none`: half the
     border slots write `box-shadow: inset …, var(--shadow)`, and `none` is only
     legal as the sole value — it would take the inset rings down with it. */
  const shadows = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    const root = document.documentElement;
    const tile = () => document.querySelector('.grid .drawer.dtile');
    const tok = () => getComputedStyle(root).getPropertyValue('--shadow').trim();
    out.onByDefault = S.look.shadows !== false && /rgba\(42/.test(tok());
    S.look.shadows = false; BUREAU.render(); await nap(160);
    out.offIsZeroNotNone = tok() === '0 0 0 rgba(0,0,0,0)';
    out.andNothingIsCast = !/0px 6px 18px/.test(getComputedStyle(tile()).boxShadow);
    // the border slot's own inset rings must survive it
    out.theBorderSurvives = /inset/.test(getComputedStyle(tile()).boxShadow);
    S.look.shadows = true; BUREAU.render(); await nap(160);
    out.andBackAgain = /rgba\(42/.test(tok());
    return out;
  });

  /* --- a texture is printed on the front, so it goes *under* what is standing
     on it. A generated ::after is the last child of the tile, so with nothing
     said about depth it painted over the knobs — grain across a brass handle. */
  const textureDepth = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    const d = BUREAU.create('drawer', { parent:'root', title:'Grained' });
    d.texture = 'weave'; d.desk = Object.assign(BUREAU.free(4,4,'root'), {w:4,h:4});
    BUREAU.render(); await nap(200);
    const tile = document.querySelector(`.grid .drawer[data-drawer="${d.id}"]`);
    const z = (el, pseudo) => +getComputedStyle(el, pseudo||null).zIndex || 0;
    out.theTextureIsAtTheBottom = z(tile, '::after') === 0;
    out.theKnobsAreOverIt = z(tile.querySelector('.dfoot')) > z(tile, '::after');
    out.andTheNameIsOverThose = z(tile.querySelector('.dtop')) > z(tile.querySelector('.dfoot'));
    BUREAU.delDrawer(d.id); S.undo=[]; BUREAU.render();
    return out;
  });

  /* --- the object editor: the thing itself, while you change it ---------- */
  const editor = await page.evaluate(async () => {
    const nap = ms => new Promise(r => setTimeout(r, ms));
    const S = BUREAU.state, out = {};
    const n = BUREAU.create('note', {title:'Read me', body:'A line of it.', parent:'root'});
    n[S.device] = Object.assign(BUREAU.free(6,4,'root'), {w:6,h:4});
    BUREAU.render(); await nap(150);
    BUREAU.panel(n.id); await nap(250);
    const stage = () => document.querySelector('#panel .objstage');
    const shown = () => stage() && stage().querySelector('.stagetile .drawer');
    out.theThingIsOnTheStage = !!shown();
    // …and inside it: a box carrying the object's real x lands in a column the
    // preview grid hasn't got, and the stage draws an empty floor
    out.andActuallyInsideIt = (() => { const t = shown(); if(!t) return false;
      const a = t.getBoundingClientRect(), b = stage().getBoundingClientRect();
      return a.width > 10 && a.left >= b.left-1 && a.right <= b.right+1; })();
    out.onAMovingFloor = !!stage() &&
      getComputedStyle(stage().querySelector('.stagefloor')).animationName === 'stagedrift';
    // it is a clone: a second element with the real id is one the drag, the
    // bubble's anchor and tileOf() could all pick up instead of the tile
    out.itIsACloneNotACopy = !document.querySelector(`#panel [data-row="${n.id}"]`);
    // text size: a multiplier over whatever each rule decided
    const sel = document.querySelector(`#panel [data-oset="${n.id}:tsize"]`);
    out.textSizeIsOffered = !!sel;
    if(sel){ sel.value='1.6'; sel.dispatchEvent(new Event('change',{bubbles:true})); }
    await nap(220);
    const tile = () => document.querySelector(`.grid .drawer[data-row="${n.id}"]`);
    out.wordsGetBigger = !!tile() && tile().style.getPropertyValue('--tscale')==='1.6'
      && parseFloat(getComputedStyle(tile().querySelector('.dname')).fontSize) > 20;
    const s2 = document.querySelector(`#panel [data-oset="${n.id}:tsize"]`);
    if(s2){ s2.value='1'; s2.dispatchEvent(new Event('change',{bubbles:true})); }
    await nap(200);
    out.normalIsNotStored = n.tsize == null;
    // the mark, per object, with the way back to the type's
    const chip = v => document.querySelector(`#panel [data-oic="${v}"]`);
    out.markIsOffered = !!chip('feather');
    if(chip('feather')) chip('feather').click();
    await nap(220);
    out.markIsKept = n.ic === 'feather';
    if(chip('')) chip('').click();
    await nap(200);
    out.markGoesBackToTheType = n.ic == null;
    BUREAU.del(n.id); S.undo=[]; BUREAU.render();
    return out;
  });
  await page.screenshot({ path: 'test/shots/22-editor.png' });

  /* --- nothing highlights under a long press ---------------------------- */
  const noSelecting = await page.evaluate(() => {
    const out = {}, css = el => getComputedStyle(el).webkitUserSelect;
    out.theFrameRefuses = css(document.querySelector('#frame')) === 'none';
    out.aTileRefuses    = css(document.querySelector('.grid .drawer')) === 'none';
    const fire = el => { const e = new Event('selectstart',{bubbles:true,cancelable:true});
      el.dispatchEvent(e); return e.defaultPrevented; };
    out.selectstartRefused = fire(document.querySelector('.grid .drawer .dname'));
    BUREAU.panel('d_ideas');
    return new Promise(r => setTimeout(() => {
      // a panel's labels are furniture; only its fields are text
      out.panelLabelRefuses = css(document.querySelector('#panel .prow label')) === 'none';
      out.panelFieldAllows  = css(document.querySelector('#panel input.pfield')) === 'text';
      out.fieldSelectstartAllowed = !fire(document.querySelector('#panel input.pfield'));
      document.querySelector('#panel [data-act="panelclose"]').click();
      r(out);
    }, 260));
  });
  /* …and a highlight left over from a previous press is dropped by the next
     hold, because refusing selectstart does nothing about one that already
     exists — which is how the magnifier kept coming back. */
  const selectionDropped = await page.evaluate(async () => {
    const nap = ms => new Promise(r => setTimeout(r, ms));
    const el = document.querySelector('.grid .drawer .dname');
    const rg = document.createRange(); rg.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
    const b = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, pointerType:'touch',
      pointerId:41, isPrimary:true, clientX:b.left+4, clientY:b.top+4}));
    await nap(700);
    const gone = getSelection().isCollapsed;
    el.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, pointerType:'touch',
      pointerId:41, isPrimary:true, clientX:b.left+4, clientY:b.top+4}));
    await nap(120);
    document.querySelector('#ctx').classList.remove('open');
    return gone;
  });

  console.log(JSON.stringify({
    errors: errs, manifestOk, swReady, survived, styleSurvived, slotColours,
    newObjectSeen, inlineEdit, sortDefaults, taskLook,
    shelfTools, gridSizes, keeping, versionShown, sampler, paging,
    makingOnAPhone, railDrawer, railIsFurniture, pagerLandsFlat, deskDots,
    listSwipe, shadows, textureDepth,
    gridClass, offlineWorks, railGone, tabsGone, shelfGone, tileNavigates,
    holdArms, maxDrift,
    settingsIsPanel, pickerPreviews, builderPreview, everyMenuIsAPanel,
    pasteOk, magicOk, rollupOk, relationsOk, relationsUI,
    timeLayer, checklistBox, pluckWorks, answering, seedAndKnobs, longPress, drawerSize, tagDrawer, groupMove, dropStates,
    adaptiveTiles, bubblePanel, scrollKept, kindSizes,
    phoneGrid, phoneMigration,
    dupIds, undoWorks, readViews, paperSize, movement, pager, desks, spans,
    picture, fronts, editor, noSelecting, selectionDropped
  }, null, 2));
  await browser.close();
})();
