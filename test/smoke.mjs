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
  await page.click('[data-theme2="walnut"]');
  await page.waitForTimeout(250);
  await shot('03-walnut-settings');

  await page.reload();
  await page.waitForTimeout(700);
  const survived = await page.evaluate(() =>
    BUREAU.state.objects.some(o => (o.title||'').includes('brass pulls')));
  const themeSurvived = await page.evaluate(() => BUREAU.state.theme);
  await page.click('.gridbar [data-act="appsettings"]');
  await page.waitForTimeout(250);
  await page.click('[data-theme2="paper"]');
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
    // a drawer's own settings, then the form behind "Name, rule and totals…"
    const d = BUREAU.state.objects.find(o => o.kind === 'drawer');
    document.querySelector(`.grid .drawer[data-drawer="${d.id}"]`)
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 }));
    await wait();
    await click('[data-c^="drawerset"]');              out.drawer = (key() || '').split(':')[0];
    await click('[data-act="panelmore"]');             out.drawerform = key();
    await click('[data-act="cancel"]');
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
    const b = document.querySelector('.pinbar');
    if (!b) return false;
    const s = getComputedStyle(b);
    // it has to be the bottom bar on a phone, not a strip left at the top
    return s.display !== 'none' && s.position === 'absolute'
      && b.getBoundingClientRect().bottom >= window.innerHeight - 1;
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
    S.openId = a.id; S.readId = null; BUREAU.renderSheet();
    await new Promise(r => setTimeout(r, 120));
    const host = document.querySelector('#sheetHost');
    const chips = [...host.querySelectorAll('.relchip')];
    const hasOut = chips.some(c => c.dataset.openrel === b.id);
    const canUnlink = !!host.querySelector(`[data-unrel="${a.id}:${b.id}"]`);
    const canAdd = !!host.querySelector('[data-act="addrel"]');
    // and the other end shows it as a backlink, without opting in
    S.openId = b.id; BUREAU.renderSheet();
    await new Promise(r => setTimeout(r, 120));
    const backChip = [...document.querySelectorAll('#sheetHost .relchip')]
      .some(c => c.dataset.openrel === a.id);
    S.openId = null; BUREAU.renderSheet();
    return hasOut && canUnlink && canAdd && backChip;
  });

  // --- the time layer: a calendar drawer opens as a real month, a day can be
  // clicked and added to, and a timeline lays its contents on a scaled axis
  const timeLayer = await page.evaluate(async () => {
    const L = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const S = BUREAU.state;
    const cal = BUREAU.create('calendar', { parent: 'root', title: 'A month' });
    ['One','Two','Three'].forEach((t, i) => {
      const o = BUREAU.create('task', { parent: cal.id, title: 'Cal ' + t });
      o.due = L(new Date(Date.now() + (i * 3 - 3) * 86400000));
    });
    S.view = 'drawer'; S.drawerId = cal.id; BUREAU.render();
    await new Promise(r => setTimeout(r, 250));
    const isMonth = !!document.querySelector('.monthgrid')
      && document.querySelectorAll('.mitem').length === 3;
    // clicking a day selects it and offers a quick-add
    document.querySelector('.mcell.today').click();
    await new Promise(r => setTimeout(r, 200));
    const daySelected = !!document.querySelector('.mcell.sel') && !!document.querySelector('[data-dayadd]');
    // the same container as a timeline: items placed, and zoom widens the axis
    cal.layout = 'timeline'; BUREAU.render();
    await new Promise(r => setTimeout(r, 200));
    const w0 = parseFloat(document.querySelector('.tlcanvas').style.width);
    const marks = document.querySelectorAll('.tlitem').length;
    const s = document.querySelector('[data-tlzoom]');
    s.value = 40; s.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 220));
    const zooms = parseFloat(document.querySelector('.tlcanvas').style.width) > w0;
    // tidy up: a calendar left on the desk sits under later drag tests
    S.objects = S.objects.filter(x => x.id !== cal.id && x.parent !== cal.id);
    S.view = 'desk'; S.drawerId = null; BUREAU.render();
    return isMonth && daySelected && marks === 3 && zooms;
  });

  // --- a tag opens the magic drawer that collects it, and only ever makes one
  const tagDrawer = await page.evaluate(async () => {
    const S = BUREAU.state;
    const o = S.objects.find(x => (x.tags || []).includes('bureau'));
    S.openId = o.id; BUREAU.renderSheet();
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('.realtag[data-tagdrawer="bureau"]').click();
    await new Promise(r => setTimeout(r, 250));
    const d = S.objects.find(x => x.id === S.drawerId);
    const madeOne = !!d && (d.filter || {}).tag === 'bureau'
      && BUREAU.kids(d.id).length > 0
      && BUREAU.kids(d.id).every(id => (S.objects.find(y => y.id === id).tags || []).includes('bureau'));
    // asking again reuses it rather than piling up drawers
    const n = S.objects.filter(x => (x.filter || {}).tag === 'bureau').length;
    S.openId = o.id; BUREAU.renderSheet();
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
     doesn't also open. Spend it on a click that does nothing. */
  await page.evaluate(() =>
    document.querySelector('#frame').dispatchEvent(new MouseEvent('click', { bubbles:true })));
  await page.evaluate(() => {
    const el = document.querySelector(`.grid .drawer[data-drawer="${window.__narrow}"]`);
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, clientX:200, clientY:200 }));
  });
  await page.waitForTimeout(120);
  await page.click('#ctx button[data-c^="drawerset"]');
  await page.waitForTimeout(320);
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

  console.log(JSON.stringify({
    errors: errs, manifestOk, swReady, survived, themeSurvived,
    gridClass, offlineWorks, railGone, tabsGone, pinbarShown, pinNavigates,
    pinToggles, holdArms, maxDrift,
    settingsIsPanel, pickerPreviews, builderPreview, everyMenuIsAPanel,
    pasteOk, magicOk, rollupOk, relationsOk, relationsUI,
    timeLayer, tagDrawer, pinReorder, groupMove, dropStates,
    adaptiveTiles, bubblePanel, scrollKept, kindSizes,
    phoneGrid, phoneMigration,
    dupIds, undoWorks, readViews, paperSize
  }, null, 2));
  await browser.close();
})();
