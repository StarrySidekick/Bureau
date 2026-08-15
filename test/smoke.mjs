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
  await page.click('.grid .drawer[data-drawer="d_in"]');
  await page.waitForTimeout(250);
  // the quick-add bar is gone; a text-field object makes tasks instead
  await page.evaluate(() => {
    const f = BUREAU.create('field', { parent: 'd_in', title: 'Add…' });
    f[BUREAU.state.device] = { x:1, y:1, w:8, h:2 };
    BUREAU.render();
  });
  await page.waitForTimeout(250);
  await page.fill('[data-fieldfor]', 'Order the brass pulls');
  await page.press('[data-fieldfor]', 'Enter');
  await page.waitForTimeout(400);
  await page.click('.gridbar [data-view="desk"]');   // the tab bar is phone-only
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
  /* Eight columns, not sixteen: a cell has to be a real tap target rather than
     a 23px stamp that has to be padded into one. See decision 31. */
  const phoneGrid = await phone.evaluate(() => {
    const g = document.querySelector('#drawergrid');
    const cols = +getComputedStyle(g).getPropertyValue('--cols');
    const cell = g.getBoundingClientRect().width / cols;
    return { cols: cols === 8, cellIsThumbSized: cell > 38 && cell < 62,
             // and square, still: the row height must match the column width
             square: Math.abs(cell - parseFloat(getComputedStyle(g).getPropertyValue('--rowh'))) < 1 };
  });
  // the sidebar and the four fixed tabs were both removed on purpose —
  // assert they are genuinely gone and the pin bar took the tabs' place
  const railGone = await phone.evaluate(() => !document.querySelector('.rail'));
  const tabsGone = await phone.evaluate(() => !document.querySelector('.tabbar'));
  const pinbarShown = await phone.evaluate(() => {
    /* The bottom shelf. It is a real flex child of .main now rather than
       something floating over the board — that is what makes the board end
       exactly where the shelf begins, with nothing left to scroll past. */
    const b = document.querySelector('.shelf-bottom');
    const sc = document.querySelector('#app .scroll');
    if (!b || !sc) return false;
    const r = b.getBoundingClientRect();
    return getComputedStyle(b).display !== 'none'
      && r.bottom >= window.innerHeight - 1
      && Math.abs(sc.getBoundingClientRect().bottom - r.top) < 2   // flush
      && !!b.querySelector('.pinbtn[data-drawer]');
  });
  // a pin navigates, and the bar marks where you are
  await phone.click('.pinbar .pinbtn[data-drawer="d_keep"]');
  await phone.waitForTimeout(350);
  const pinNavigates = await phone.evaluate(() =>
    BUREAU.state.view === 'drawer' && BUREAU.state.drawerId === 'd_keep'
    && document.querySelector('.pinbtn[data-drawer="d_keep"]').classList.contains('on'));
  await phone.screenshot({ path: 'test/shots/08-phone-pinned-drawer.png' });
  await phone.click('.pinbar .pinbtn[data-view="desk"]');
  await phone.waitForTimeout(300);
  await phone.click('.drawer[data-drawer="d_write"]');
  await phone.waitForTimeout(350);
  await phone.screenshot({ path: 'test/shots/09-phone-drawer.png' });

  // pinning is a round trip: on the bar, off the bar, and it survives a save
  const pinToggles = await phone.evaluate(() => {
    const n = () => document.querySelectorAll('.pinbar .pinbtn[data-drawer]').length;
    const before = n();
    BUREAU.pin('d_write');                       // the drawer we are looking at
    const added = n() === before + 1
      && !!document.querySelector('.pinbtn[data-drawer="d_write"]');
    BUREAU.pin('d_write');
    return added && n() === before
      && !document.querySelector('.pinbtn[data-drawer="d_write"]');
  });

  // --- everything is always movable; a hold arms the drag, a tap does not
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

  // the holdArms tap opened a drawer; the rest of the checks live on the desk
  await page.evaluate(() => { BUREAU.state.view = 'desk'; BUREAU.state.drawerId = null; BUREAU.render(); });
  await page.waitForTimeout(250);

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
    const into = document.querySelector('.grid .drawer[data-drawer="d_in"]');
    if (!line || !into) return null;
    const a = line.getBoundingClientRect(), b = into.getBoundingClientRect();
    const tick = document.querySelector(`[data-pluck="${two.id}"]`).getBoundingClientRect();
    return { from: [a.left + a.width / 2, a.top + a.height / 2],
             to:   [b.left + b.width / 2, b.top + b.height / 2],
             tick: [tick.left + tick.width / 2, tick.top + tick.height / 2] };
  });
  const pluckWorks = await (async () => {
    if (!pluck) return { found: false };
    // a hold, then a drag onto the Inbox tile
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
    return { found: true, lifted, aimed, filed: moved.parent === 'd_in',
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

  // --- a pin can be dragged along the bar, and the drag must not also navigate
  const pinReorder = await page.evaluate(async () => {
    const S = BUREAU.state;
    const before = S.pins.slice();
    if (before.length < 2) return false;
    const pins = [...document.querySelectorAll('.pinbar .pinbtn[data-drawer]')];
    const first = pins[0], last = pins[pins.length - 1];
    const fr = first.getBoundingClientRect(), lr = last.getBoundingClientRect();
    const ev = (type, x) => first.dispatchEvent(new PointerEvent(type,
      { bubbles: true, clientX: x, clientY: fr.y + fr.height / 2, pointerId: 5, isPrimary: true }));
    ev('pointerdown', fr.x + fr.width / 2);
    ev('pointermove', lr.x + lr.width);
    ev('pointermove', lr.x + lr.width);
    ev('pointerup', lr.x + lr.width);
    await new Promise(r => setTimeout(r, 250));
    const after = S.pins;
    return after[after.length - 1] === before[0]
      && after.slice().sort().join() === before.slice().sort().join()
      && S.view === 'desk';                    // the reorder must not open it
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
  await page.evaluate(() => { BUREAU.state.view='drawer'; BUREAU.state.drawerId='d_studio'; BUREAU.render(); });
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
  await page.evaluate(() => { BUREAU.state.drawerId='d_in'; BUREAU.render(); });
  await page.waitForTimeout(320);
  const two = await page.evaluate(() =>
    BUREAU.state.objects.filter(o => o.kind==='task' && o.parent==='d_in' && !o.done).slice(0,2).map(o=>o.id));
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
    const o = BUREAU.create('smoketype');
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
      BUREAU.create('task', { parent: 'd_in', title: 'undo ' + n }).id);
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

  /* --- migration 10: a v9 desk's phone boxes are in 16-column coordinates ---
     Halving is the inverse of the two doublings on the way up, and rounding can
     put two neighbours in the same cell, so it also has to leave nothing
     overlapping. A fresh context, and the snapshot is planted by an init script
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
      halved: b('d_a').w === 4 && b('d_a').h === 3 && b('d_b').x === 5,
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
    out.startsUnlocked = !S.deskCfg.locked && !!btn('[data-act="togglelock"]');
    const openShackle = btn('[data-act="togglelock"]').innerHTML;
    btn('[data-act="togglelock"]').click(); await nap(200);
    out.locks = !!S.deskCfg.locked
      && btn('[data-act="togglelock"]').innerHTML !== openShackle
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

    /* The sort steps through its seven and wears the one it is on — a letter
       where a letter is the answer, an arrow where a direction is. Seven
       presses come back round to where they started. */
    const seen = [], glyphs = [];
    for (let i = 0; i < 7; i++) {
      seen.push(S.deskCfg.sort || 'manual');
      const b = btn('[data-act="sortnext"]');
      glyphs.push(b.textContent.trim() || (b.querySelector('svg') ? 'svg' : ''));
      b.click();
      await nap(90);
    }
    out.sortCycles = new Set(seen).size === 7 && (S.deskCfg.sort || 'manual') === 'manual';
    out.everyStateHasAMark = glyphs.every(Boolean)
      && glyphs.filter(g => g === 'svg').length === 4        // four directions
      && ['M','A','Z'].every(l => glyphs.includes(l));       // three letters
    out.noSortPopup = !document.querySelector('[data-sortby]');
    return out;
  });

  /* --- two shelves. The tools live on the top one, drawers pin to the bottom,
     and on a Mac both are drawn along the top because there is no bottom edge
     worth reserving on a desk. */
  const shelves = await page.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const S = BUREAU.state, out = {};
    out.bothOnDesk = document.querySelectorAll('.gridbar .shelf-top, .gridbar .shelf-bottom').length >= 1
      && !!document.querySelector('.gridbar .shelf-bottom .pinbtn[data-drawer]');
    const d = S.objects.find(o => o.kind === 'drawer' && !S.pins.includes(o.id));
    BUREAU.setPin(d.id, 'top'); await nap(200);
    out.pinsToTop = S.pinsTop.includes(d.id) && !S.pins.includes(d.id)
      && !!document.querySelector(`.shelf-top .pinbtn[data-drawer="${d.id}"]`);
    BUREAU.setPin(d.id, 'bottom'); await nap(200);
    out.movesShelf = S.pins.includes(d.id) && !S.pinsTop.includes(d.id);
    BUREAU.setPin(d.id, null); await nap(150);
    out.unpins = !S.pins.includes(d.id) && !S.pinsTop.includes(d.id);
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
     room between the two shelves; what does not fit is on the next page, and
     two fingers walk through them. */
  await phone.bringToFront();
  await phone.evaluate(() => { BUREAU.state.view='desk'; BUREAU.state.drawerId=null; BUREAU.render(); });
  await phone.waitForTimeout(400);
  const paging = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const out = {};
    const g = () => document.querySelector('#drawergrid');
    const sc = () => document.querySelector('#app .scroll');
    const shelf = document.querySelector('.shelf-bottom');
    out.rowsMeasured = BUREAU.pageRows >= 4;
    out.exactlyOnePage = /repeat\((\d+),/.exec(g().style.gridTemplateRows)[1] === String(BUREAU.pageRows);
    out.neverScrolls = sc().scrollHeight <= sc().clientHeight + 1
      && getComputedStyle(sc()).overflowY === 'hidden';
    // and it stops above the shelf rather than half a cell past it
    out.endsAboveTheShelf = g().getBoundingClientRect().bottom <= shelf.getBoundingClientRect().top + 1;
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

  /* --- and the way in is a swipe up off the bottom shelf. Tapping bare board
     used to open the picker and was triggered by accident more than on
     purpose; a board is a surface you put things on, not a button. */
  const shelfSwipe = await phone.evaluate(async () => {
    const nap = n => new Promise(r => setTimeout(r, n));
    const out = {};
    const grid = document.querySelector('#drawergrid');
    const gr = grid.getBoundingClientRect();
    const bare = { x: gr.left + gr.width/2, y: gr.bottom - 12 };
    const tap = (el,x,y,type) => el.dispatchEvent(new PointerEvent(type,
      { bubbles:true, cancelable:true, pointerId:11, pointerType:'touch', clientX:x, clientY:y }));
    tap(grid, bare.x, bare.y, 'pointerdown'); tap(grid, bare.x, bare.y, 'pointerup');
    await nap(200);
    out.bareBoardDoesNothing = !document.querySelector('#panel');
    const shelf = document.querySelector('.shelf-bottom');
    const r = shelf.getBoundingClientRect();
    const x = r.right - 30, y = r.top + r.height/2;
    tap(shelf, x, y, 'pointerdown');
    tap(shelf, x, y - 60, 'pointermove');
    tap(shelf, x, y - 120, 'pointermove');
    tap(shelf, x, y - 120, 'pointerup');
    await nap(300);
    const p = document.querySelector('#panel');
    out.swipeUpOpensThePicker = !!p && p.dataset.panel === 'newobject';
    // …and on a phone a menu comes up out of the bottom, so the board is still
    // visible and still live above it
    const pr = p && p.getBoundingClientRect();
    out.comesFromTheBottom = !!pr && pr.left < 2 && pr.right > innerWidth - 2
      && pr.bottom >= innerHeight - 1 && pr.top > innerHeight * 0.1;
    document.querySelector('[data-act="panelclose"]').click();
    return out;
  });
  await phone.screenshot({ path: 'test/shots/19-phone-shelves.png' });

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

    /* how a thing opens is worked out from what it is, and can be overruled */
    const d = S.objects.find(o => o.id === 'd_in');
    d.desk = { ...d.desk, w:4, h:4 };
    out.smallIsADrawer = BUREAU.openingFor(d) === 'drawer';
    d.desk = { ...d.desk, w:6, h:6 };
    out.bigIsACabinet = BUREAU.openingFor(d) === 'cabinet';
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

    /* a magic drawer is foil, not a sweep: nothing about it animates, and the
       light it catches is two numbers on #frame that a tilt or a pointer moves */
    const md = S.objects.find(o => BUREAU.state.objects.includes(o) && o.kind === 'magic');
    BUREAU.render(); await nap(150);
    const mt = document.querySelector('.drawer.magicdrawer');
    out.foilDoesNotAnimate = !!mt && getComputedStyle(mt).animationName === 'none';
    out.foilIsLit = !!mt && /gradient/.test(getComputedStyle(mt).backgroundImage);
    const before = getComputedStyle(mt).backgroundPosition;
    document.querySelector('#frame').style.setProperty('--holox', '0.05');
    out.lightMoves = getComputedStyle(mt).backgroundPosition !== before;
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
    out.threeBoardsInAStrip = !!p && p.querySelectorAll('.pane').length === 3;
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
    out.shortSwipeIsPulledBack = S.view === 'desk' && !document.querySelector('.pager');

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

  console.log(JSON.stringify({
    errors: errs, manifestOk, swReady, survived, styleSurvived, slotColours,
    newObjectSeen, inlineEdit, sortDefaults, taskLook,
    shelfTools, shelves, versionShown, sampler, paging, shelfSwipe,
    gridClass, offlineWorks, railGone, tabsGone, pinbarShown, pinNavigates,
    pinToggles, holdArms, maxDrift,
    settingsIsPanel, pickerPreviews, builderPreview, everyMenuIsAPanel,
    pasteOk, magicOk, rollupOk, relationsOk, relationsUI,
    timeLayer, checklistBox, pluckWorks, answering, seedAndKnobs, longPress, drawerSize, tagDrawer, pinReorder, groupMove, dropStates,
    adaptiveTiles, bubblePanel, scrollKept, kindSizes,
    phoneGrid, phoneMigration,
    dupIds, undoWorks, readViews, paperSize, movement, pager
  }, null, 2));
  await browser.close();
})();
