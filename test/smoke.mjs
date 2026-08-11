// Smoke test for Bureau. Needs a server running (scripts/serve.sh) and playwright.
//   npm i playwright && scripts/serve.sh & && node test/smoke.mjs
// Every value in the printed summary should be truthy and `errors` should be [].
// Screenshots land in test/shots/ — look at them, this is a visual app.
import { chromium } from 'playwright';
const URL = process.env.BUREAU_URL || 'http://127.0.0.1:8000/index.html';

(async () => {
  const browser = await chromium.launch();
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

  // ids must be unique — a collision made byId() return the wrong object, so
  // dragging one tile moved another and new objects were immovable
  const dupIds = await page.evaluate(() => {
    const seen = new Set(); let n = 0;
    BUREAU.state.objects.forEach(o => { if (seen.has(o.id)) n++; seen.add(o.id); });
    return n;
  });

  console.log(JSON.stringify({
    errors: errs, manifestOk, swReady, survived, themeSurvived,
    gridClass, offlineWorks, railGone, tabsGone, pinbarShown, pinNavigates,
    pinToggles, holdArms, maxDrift,
    pasteOk, magicOk, rollupOk, relationsOk, relationsUI, groupMove, dupIds
  }, null, 2));
  await browser.close();
})();
