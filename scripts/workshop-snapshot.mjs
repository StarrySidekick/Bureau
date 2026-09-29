// What the Bureau Workshop calls "how it ships" (decision 246).
//
// The Workshop artifact lays out every menu, setting, editor row, type,
// size and flow for Timothy to rearrange, and keeps his arrangement as the
// difference from a snapshot of the app. This makes that snapshot out of the
// running app, the way the specimen book is made (decision 143): one
// generator, so the Workshop cannot drift from the app it describes.
//
//   scripts/serve.sh &   node scripts/workshop-snapshot.mjs > shipped.json
import { chromium } from 'playwright';

const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath: CHROME });
const slug = s => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- the drawer front, on a phone -------------------------------------------
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await phone.goto('http://localhost:8000/'); await phone.waitForTimeout(1500);
const rail = await phone.evaluate(() => [...document.querySelectorAll('.gridbar.inrail [data-act], .gridbar.inrail .railknob, .gridbar.inrail button')]
  .map(b => ({ act: b.dataset.act || 'knob', name: (b.title || b.getAttribute('aria-label') || b.textContent || '').trim() }))
  .filter((x, i, a) => x.name && a.findIndex(y => y.act === x.act) === i));

// Depth and light is the phone's alone, so its rows are read here
const depth = await phone.evaluate(async () => {
  const nap = n => new Promise(r => setTimeout(r, n));
  const g = document.querySelector('[data-act="appsettings"]'); if (!g) return [];
  g.click(); await nap(350);
  // Depth and light is inside Global Settings since decision 255
  const d = document.querySelector('#panel [data-ssec="depth"]') || document.querySelector('#panel [data-ssec="look"]'); if (!d) return [];
  d.click(); await nap(350);
  const out = [];
  document.querySelectorAll('#panel .pbody .prow, #panel .pbody .field, #panel .pbody label').forEach(el => {
    const lab = el.matches('label') ? el : el.querySelector(':scope > label, .lbl, b'); if (!lab) return;
    const note = (lab.querySelector('i') || {}).textContent || '';
    const name = lab.textContent.replace(note, '').trim().split('\n')[0].trim();
    if (!name || name.length > 60 || out.some(x => x.name === name)) return;
    const kind = el.querySelector('input[type=range]') ? 'slider' : el.querySelector('select') ? 'select' : 'choice';
    const opts = [...el.querySelectorAll('option, button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 8);
    out.push({ name, note: note.trim(), kind, opts });
  });
  return out;
});

// ---- everything else, on a Mac ----------------------------------------------
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:8000/'); await page.waitForTimeout(1500);
const got = await page.evaluate(async ({ rail, depth }) => {
  const nap = n => new Promise(r => setTimeout(r, n));
  const M = await import('./js/model.js'), G = await import('./js/grid.js'), P = await import('./js/plans.js');
  const B = window.BUREAU, S = B.state;
  const slug = s => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const menus = [
    { id: 'rail', name: 'Drawer front', note: 'Along the bottom of the phone, left to right; a board can carry its own' },
    { id: 'bar', name: 'Mac bar', note: 'Across the top of a Mac window' },
    { id: 'settings', name: 'Settings', note: 'The gear, on the desk: a list of doors' },
    { id: 'editor', name: 'Object editor', note: 'Hold an object, then Editor: the top, then three doors' },
    { id: 'hold', name: 'Hold menu', note: 'The ring of paint blobs round your finger' },
    { id: 'palette', name: 'Palette picker', note: 'A box drawn with the Magic Selector: the fifteen on two rings' }];
  const sections = [], items = {};
  const add = (sec, name, kind, opts, note) => {
    const id = sec.id + '.' + slug(name);
    if (!items[id]) { items[id] = { id, name, kind, opts: opts.slice(0, 12), note: note || '', home: sec.id }; sec.items.push(id); }
    return items[id];
  };
  // what one row of a panel is: its label, its note, and its control
  const rowOf = r => {
    const lab = r.querySelector(':scope > label'); if (!lab) return null;
    const note = (lab.querySelector('i') || {}).textContent || '';
    const name = lab.textContent.replace(note, '').trim(); if (!name) return null;
    const ctl = r.querySelector(':scope > div') || r;
    const sel = ctl.querySelector('select');
    const opts = sel ? [...sel.options].map(o => o.textContent.trim())
      : [...ctl.querySelectorAll('button')].map(b => (b.title || b.textContent || '').trim()).filter(Boolean);
    const kind = sel ? 'select' : ctl.querySelector('input[type=range]') ? 'slider' : ctl.querySelector('input[type=color]') ? 'colour'
      : ctl.querySelector('.sw,.pickgrid.sw') ? 'colour' : ctl.querySelector('input[type=text],input:not([type]),textarea') ? 'text'
      : ctl.querySelector('button') ? 'buttons' : 'row';
    return { name, note: note.trim(), kind, opts };
  };

  // the drawer front, as the phone draws it
  const railSec = { id: 'rail.front', menu: 'rail', name: 'The default front', note: 'a board may carry its own, three a side', items: [] };
  const RAILNM = { search: ['Magnifying glass', 'search, full width along the top'], sortcycle: ['Letter block', 'tap: the next sort; hold: grid or line view'],
    knob: ['Home knob', 'tap: home; pull up: make something'], togglelock: ['Padlock', 'one lock for every board'], appsettings: ['Gear', 'Settings on the desk, Board settings in a drawer'] };
  const RAILBY = [[/^search/i,'search'],[/^sorted/i,'sortcycle'],[/knob/i,'knob'],[/lock/i,'togglelock'],[/^settings/i,'appsettings']];
  rail.forEach(x => { const by = (RAILBY.find(([re]) => re.test(x.name)) || [])[1];
    const [nm, note] = RAILNM[by] || RAILNM[x.act] || [x.name.split(' — ')[0], x.name.split(' — ')[1] || ''];
    add(railSec, nm, x.act === 'knob' ? 'gesture' : 'button', [], note); });
  sections.push(railSec);
  // the Mac bar
  const barSec = { id: 'bar.tools', menu: 'bar', name: 'Bar tools', note: '', items: [] };
  const BARNM = { appsettings: 'Gear', togglelock: 'Padlock', randomobject: 'Make one of anything', setlayout: 'Grid or list' };
  [...document.querySelectorAll('.gridbar:not(.inrail) [data-act]')].forEach(b => {
    const n = (b.title || b.getAttribute('aria-label') || b.textContent || '').trim(); if (!n) return;
    add(barSec, BARNM[b.dataset.act] || n.split(' — ')[0].replace(/^Everything is (un)?locked$/, 'Padlock').replace(/^On the grid$/, 'Grid or list'), 'button', [], n.split(' — ')[1] || ''); });
  sections.push(barSec);

  // Settings: each door is a section, each row a card
  document.querySelector('.gridbar [data-act="appsettings"]').click(); await nap(300);
  const doors = [...document.querySelectorAll('#panel [data-ssec]')].map(d => ({ key: d.dataset.ssec,
    name: ((d.querySelector('.title') || d.querySelector('b') || {}).textContent || d.textContent).trim(),
    note: ((d.querySelector('.snip') || {}).textContent || '').trim() }));
  /* A door's body in order: a heading (with the choices under it, as the
     aesthetic's tiles are), a field, or a row. Each is one card. */
  const walk = (sec) => {
    const body = document.querySelector('#panel .pbody'); if (!body) return;
    let head = null;
    const opt = el => [...el.querySelectorAll('option, button b, button')].map(b => (b.tagName === 'OPTION' ? b.textContent : (b.querySelector('b') || b).textContent).trim())
      .filter((t, i, a) => t && t.length < 60 && a.indexOf(t) === i);
    body.querySelectorAll('.section-h h2, .field, .prow').forEach(el => {
      if (el.tagName === 'H2') { head = add(sec, el.textContent.trim(), 'section', [], ''); return; }
      if (el.classList.contains('prow')) { const x = rowOf(el); if (x) add(sec, x.name, x.kind, x.opts, x.note); return; }
      const lab = el.querySelector('label, .lbl, b'); const name = lab && lab.textContent.trim();
      if (name && name.length < 60) { const x = add(sec, name, el.querySelector('select') ? 'select' : el.querySelector('input[type=range]') ? 'slider' : el.querySelector('input[type=color]') ? 'colour' : 'choice', opt(el), ''); }
      else if (head && !head.opts.length) head.opts = opt(el);
    });
    // a heading whose choices are not in a field (the aesthetic's tiles)
    body.querySelectorAll('.section-h').forEach(h => { const id = sec.id + '.' + slug(h.textContent.trim());
      if (items[id] && !items[id].opts.length) { const n = h.nextElementSibling; if (n && !n.classList.contains('section-h')) items[id].opts = opt(n); } });
  };
  for (const d of doors) {
    B.closePanel(); await nap(80);
    document.querySelector('.gridbar [data-act="appsettings"]').click(); await nap(250);
    const door = document.querySelector(`#panel [data-ssec="${d.key}"]`); if (!door) continue;
    door.click(); await nap(300);
    const sec = { id: 'set.' + d.key, menu: 'settings', name: d.name, note: d.note, items: [] };
    walk(sec);
    if (d.key === 'depth') depth.forEach(x => add(sec, x.name, x.kind, x.opts, x.note));
    /* Since decision 255 Depth and light is inside Global Settings. Its rows
       keep the ids they had (`set.depth.…`), because the Workshop's saved
       arrangement names them by id, and live in the look door. */
    if (d.key === 'look') {
      const dsec = { id: 'set.depth', items: sec.items };
      const head = sec.id + '.depth-and-light';
      if (items[head]) { sec.items.splice(sec.items.indexOf(head), 1); delete items[head]; }
      add(dsec, 'Depth and light', 'section', [], '').home = sec.id;
      depth.filter(x => x.kind === 'slider').forEach(x => { add(dsec, x.name, x.kind, x.opts, x.note).home = sec.id; });
    }
    // …and Your Things heads About, keeping its row's old id the same way
    if (d.key === 'about') sec.items = sec.items.map(id => {
      if (!/^set\.about\.statistics$/.test(id)) return id;
      const to = 'set.things.statistics'; items[to] = Object.assign({}, items[id], { id: to }); delete items[id]; return to; });
    if (!sec.items.length) document.querySelectorAll('#panel .pbody button.pill').forEach(b => {
      const n = b.textContent.trim(); if (n && n.length < 40) add(sec, n, 'button', [], ''); });
    sections.push(sec);
  }
  B.closePanel(); await nap(100);

  // the object editor, across a set of samples, saying which each row is for
  const samples = ['note', 'task', 'drawer', 'checklist', 'list', 'calendar', 'image', 'audio', 'video', 'button', 'counter', 'outlink', 'decoration', 'card', 'clock'];
  const made = samples.map(k => { const o = B.create(k, { parent: 'root', title: M.K(k).nm }); delete o.setup; return o; });
  B.render(); await nap(300);
  const edSecs = { top: { id: 'ed.top', menu: 'editor', name: 'Top', note: 'the type, where it lives, its tags', items: [] },
    look: { id: 'ed.look', menu: 'editor', name: 'Look', note: 'colour, face, edges, hardware', items: [] },
    words: { id: 'ed.words', menu: 'editor', name: 'Words', note: 'typeface, ink, paper, sizes, how the page is laid out (decision 247)', items: [] },
    does: { id: 'ed.does', menu: 'editor', name: 'Behaviour', note: 'what it does, what it collects, its fields and traits', items: [] } };
  const shows = {};
  for (const o of made) {
    for (const [door, key] of [[undefined, 'top'], ['look', 'look'], ['words', 'words'], ['does', 'does']]) {
      B.panel(o.id, door); await nap(160);
      document.querySelectorAll('#panel .prow').forEach(r => { const x = rowOf(r); if (!x) return;
        const it = add(edSecs[key], x.name, x.kind, x.opts, '');
        (shows[it.id] = shows[it.id] || new Set()).add(M.K(o.kind).nm); });
      B.closePanel(); await nap(60);
    }
  }
  Object.entries(shows).forEach(([id, set]) => { items[id].note = 'Shows on: ' + [...set].join(', '); });
  sections.push(edSecs.top, edSecs.look, edSecs.words, edSecs.does);

  // the hold ring, round each sample
  const ring = { id: 'hold.ring', menu: 'hold', name: 'The ring', note: 'clockwise from the top; what shows depends on the thing', items: [] };
  const on = {};
  for (const o of made) {
    const el = document.querySelector(`[data-row="${o.id}"],[data-drawer="${o.id}"]`); if (!el) continue;
    const r = el.getBoundingClientRect(); B.ctx(r.left + 5, r.top + 5, o.id); await nap(120);
    document.querySelectorAll('#ctx .radblob').forEach(b => { const n = (b.title || b.textContent || '').trim(); if (!n) return;
      const it = add(ring, n, 'action', [], ''); (on[it.id] = on[it.id] || new Set()).add(M.K(o.kind).nm); });
    document.body.click(); await nap(60);
  }
  Object.entries(on).forEach(([id, set]) => { items[id].note = set.size >= made.length - 1 ? 'on everything' : 'on ' + [...set].join(', '); });
  sections.push(ring);
  made.forEach(o => B.del(o.id)); S.undo = []; B.render();

  // the palette picker: the fifteen, in their two rings
  const pal = { id: 'palette.masters', menu: 'palette', name: 'The fifteen', note: 'inner ring: the seven that hold things; outer: the eight that do not', items: [] };
  M.MASTERS.forEach(([k], i) => add(pal, M.K(k).pickNm || M.K(k).nm, i < M.MASTER_HOLDS ? 'holds things' : 'thing', [], ''));
  sections.push(pal);

  // ---- the types: the fifteen first, so the tree nests the way the picker does
  const K = M.K, masters = M.MASTERS.map(m => m[0]);
  const treeFamily = k => { const m = M.MASTERS.find(x => x[0] === k);
    return m && m[1] ? m[1].filter(x => x !== k) : (K(k).family || []).filter(x => x !== k && !M.isCut(x)); };
  const reach = new Set(); M.MASTERS.forEach(([m, also]) => { const walk = k => { if (reach.has(k) || !M.KINDS[k]) return; reach.add(k); (K(k).family || []).forEach(walk); }; walk(m); (also || []).forEach(walk); });
  const order = masters.concat(Object.keys(M.KINDS).filter(k => !masters.includes(k)));
  const kinds = order.filter(k => M.KINDS[k]).map(k => {
    const d = K(k), r = G.rangeOfKind(k, 'desk', 'root');
    return { key: k, nm: d.pickNm && masters.includes(k) ? d.pickNm : d.nm, attrs: (d.attrs || []).slice(), family: treeFamily(k), cat: !!d.cat, ds: d.ds || '',
      row: masters.includes(k) ? 'primary' : M.isCut(k) ? 'cut' : reach.has(k) ? 'sub' : 'more',
      size: d.size || [4, 4], phoneSize: d.phoneSize || null, range: r, rangeStated: !!d.range,
      fixed: !d.range && (!!d.act || (d.attrs || []).includes('decor') || ((d.size || [])[0] === 1 && (d.size || [])[1] === 1)), square: !!d.square };
  });
  const attrs = Object.entries(M.ATTRS).map(([key, a]) => ({ key, nm: a.nm, ds: a.ds, structural: ['container', 'magic', 'control'].includes(key) }));

  // ---- the flows
  const flows = P.plans().filter(p => p && p.stock !== false).map(p => ({
    id: p.key || p.id, name: p.nm || p.name || 'A flow', sec: p.sec || 'project', of: p.of || null, life: p.life || null, makes: p.makes || null,
    objects: P.planTop(p).map(o => ({ kind: o.kind, title: o.title || '', w: (o.desk || {}).w || 0, h: (o.desk || {}).h || 0,
      kids: (p.objects || []).filter(x => x.parent === o.id).length })),
    shipNote: p.why || p.ds || '' }));
  const kindNames = Object.fromEntries(Object.keys(M.KINDS).map(k => [k, K(k).nm]));
  return { menus, sections, items, kinds, attrs, PRIMARY: M.PRIMARY, SECONDARY: M.SECONDARY, MASTER_HOLDS: M.MASTER_HOLDS, flows, kindNames,
    version: (document.querySelector('[data-version]') || {}).textContent || '' };
}, { rail, depth });
await browser.close();
process.stdout.write(JSON.stringify(got));
