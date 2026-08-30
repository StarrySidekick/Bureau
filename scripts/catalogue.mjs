/* The specimen book: every visual option in the aesthetic system, drawn as the
   thing it makes.
 *
 *   scripts/serve.sh &  node scripts/catalogue.mjs [out.html]
 *
 * Every tile in the output comes out of Bureau's own `sampleTile()` — the same
 * primitive the type picker and the object stage draw with (decision 51) — and
 * the page links Bureau's own two stylesheets, inlined. Nothing here draws a
 * tile itself, because a second renderer drifts from the first the day a slot
 * gains a rule, and a catalogue that lies about what a knob looks like is
 * worse than no catalogue.
 *
 * The one thing that had to be worked around: the *chrome* rules are still
 * keyed on `html[data-style="x"]` and cannot be, because one page shows seven
 * aesthetics at once (decision 98 moved the tile rules onto `<fam>sty-`
 * classes, which is exactly what makes this page possible). So every remaining
 * `html[data-style]` rule is duplicated onto a `[data-sty]` wrapper attribute
 * and each row of the matrix carries one. Duplicated wholesale rather than
 * hand-picked: a rule about a panel or a button simply matches nothing here,
 * and choosing which ones mattered is how you miss one.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const OUT = process.argv[2] || 'catalogue.html';
const URL = process.env.SITE_URL || 'http://localhost:8000/';

/* ---- the six families, and what each is best shown on -------------------
   A knob and a panelling belong on a drawer front; a stock belongs on a sheet
   of paper; a binding belongs on a spine. Drawing all six on one shape would
   be tidier and would show four of them on something that never wears them. */
const FAMILIES = [
  { fam:'bd', prop:'border',  nm:'Edges',      of:'front',
    ds:'The line round a thing. Seven positions &mdash; the same seven on a drawer front and on a sheet of paper, drawn in wood on one and in ink on the other.' },
  { fam:'pn', prop:'panel',   nm:'Panellings', of:'front',
    ds:'How a drawer front is worked. All five are mouldings and all five are lit from the upper left, which is where the knob&rsquo;s highlight is.' },
  { fam:'kn', prop:'knob',    nm:'Knobs',      of:'front',
    ds:'Turned out of the front&rsquo;s own wood: what makes it a knob is the light on it, not a lighter shade painted where it sits.' },
  { fam:'tx', prop:'texture', nm:'Grains',     of:'front',
    ds:'What is printed on the surface. Six positions &mdash; nothing, the fine tooth of the sheet, a weave, a ruling, a scatter, a pattern.' },
  { fam:'st', prop:'stock',   nm:'Stocks',     of:'paper',
    ds:'What the sheet <em>is</em>, as against what is printed on it. The one family whose fallback is the aesthetic&rsquo;s own rather than the vocabulary&rsquo;s &mdash; and the one that is never written down.' },
  { fam:'bn', prop:'binding', nm:'Bindings',   of:'spine',
    ds:'A spine is the one face that is a made object rather than a layout, so it is the binder&rsquo;s work rather than the cabinetmaker&rsquo;s.' }
];

const page = await (async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{ width:1400, height:900 } });
  p.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
  await p.goto(URL, { waitUntil:'networkidle' });
  p.__browser = b;
  return p;
})();

const data = await page.evaluate(async ({ FAMILIES }) => {
  const B = window.BUREAU, nap = n => new Promise(r => setTimeout(r, n));
  const keys = Object.keys(B.styles);
  const out = { styles:[], families:[], shapes:[], decor:[], checks:[] };

  /* Every token an aesthetic writes onto the root, captured by asking the app
     to *be* that aesthetic and reading what it wrote. Derived rather than
     copied: `chromeTokens()` makes forty-odd values out of five hexes, and a
     hand-written list of them here would be a second source of truth. */
  const was = B.state.look.style;
  for(const k of keys){
    B.state.look.style = k; B.applyLook(); await nap(20);
    const st = B.styles[k], el = document.documentElement;
    const vars = {};
    for(let i = 0; i < el.style.length; i++){
      const n = el.style[i];
      if(n.startsWith('--')) vars[n] = el.style.getPropertyValue(n);
    }
    out.styles.push({
      key:k, nm:st.nm, ds:st.ds, vars,
      cols:B.palNow().slice(), names:st.names || [],
      wood:vars['--wood'] || '', board:(B.state.look.board || {}).paper || st.board,
      check:st.check || 'square', spray:st.spray || 'stars',
      dark:!!st.dark, checksNow:el.dataset.checks
    });
  }

  /* A sample carrying every family pinned to one aesthetic, so a cell reads as
     that aesthetic entire and only the family under test varies across the
     row. Pinning is what makes one page able to show seven at once — a bare
     value would follow whichever aesthetic the page happens to be sitting in
     (decision 98). */
  const pin = (o, sty, over) => {
    o.border  = sty + '/' + (over.border  || 'panel');
    o.panel   = sty + '/' + (over.panel   || 'cockbead');
    o.knob    = sty + '/' + (over.knob    || 'round');
    o.texture = sty + '/' + (over.texture || 'none');
    o.stock   = sty + '/' + (over.stock   || 'plain');
    o.binding = sty + '/' + (over.binding || 'banded');
    return o;
  };
  const make = (of, sty, title, colour) => {
    const spec = of === 'paper'
      ? { kind:'note', attrs:['text'], title, size:[3,2],
          body:'A line or two, so you can see how it sits.' }
      : of === 'spine'
      ? { kind:'drawer', attrs:['container'], face:'spine', title, size:[1,4] }
      : { kind:'drawer', attrs:['container'], title, size:[3,2] };
    const o = B.sampleObject(spec);
    o.c = colour;
    o.face = spec.face;
    return o;
  };

  for(const f of FAMILIES){
    const rows = [];
    for(const k of keys){
      const st = B.styles[k];
      // slot 5 is the first an object may wear; a mid tone shows a moulding
      const colour = (st.dark || st.cols)[st.dark && B.state.look.dark === 'dark' ? 5 : 5];
      const cells = B.famSlots(f.fam, k).map(([slot, name]) => {
        const o = pin(make(f.of, k, name, colour), k, { [f.prop]:slot });
        return { slot, name, html:B.sampleTile(o, f.of === 'spine' ? 70 : 150, f.of === 'spine' ? 170 : 100) };
      });
      rows.push({ style:k, cells });
    }
    out.families.push({ ...f, slots:B.famSlots(f.fam, keys[0]).map(([s]) => s), rows });
  }

  /* The three that are the same in all seven, and say so. A shape is what a
     thing *is*, a mark is a word, and a tick box is a fact about the desk. */
  B.state.look.style = 'victorian'; B.applyLook(); await nap(20);
  const vcol = B.styles.victorian.cols;
  out.shapes = Object.entries(B.shapes).map(([k, nm]) => {
    const o = B.sampleObject({ kind:'note', attrs:['text','check'], title:nm, size:[3,2],
      body:'A line or two.' });
    o.shape = k; o.c = vcol[9];
    return { key:k, nm, html:B.sampleTile(o, 150, 100) };
  });
  out.decor = B.decorKeys.map(k => ({
    key:k, nm:B.decor[k].nm,
    suits:Object.keys(B.styles).filter(s => B.decorSuits(k, s)).map(s => B.styles[s].nm)
  }));
  out.checks = Object.entries(B.CHECKS || {}).map(([k, nm]) => ({ key:k, nm }));
  out.decorSVG = Object.fromEntries(B.decorKeys.map(k => [k, B.decorSVG(k)]));

  B.state.look.style = was; B.applyLook(); B.render();
  return out;
}, { FAMILIES });

await page.__browser.close();

/* ---- the page ----------------------------------------------------------
   Two collisions to get out of the way before anything is drawn.

   **Bureau's stylesheet styles the document, not just its tiles.** `body` is
   parchment, `overflow:hidden`, and a hundred per cent tall, because Bureau is
   an app that fills the screen. Inlined here that painted this page brown and
   stopped it scrolling. The globals are reset after it rather than stripped
   out of it: cutting rules out of 271KB of someone else's cascade is how you
   remove the one a tile needed.

   **And its class names are unprefixed**, so `.bar`, `.cell`, `.chip` and
   `.grid` all mean something already. Everything this file adds is `sb-`;
   everything that came out of `sampleTile()` keeps the names Bureau gave it,
   which is the whole point. */
const css = ['web/css/board.css', 'web/css/chrome.css'].map(f => readFileSync(f, 'utf8')).join('\n');
const html = readFileSync('web/index.html', 'utf8');
const svg = html.slice(html.indexOf('<svg width="0"'), html.indexOf('</svg>') + 6);

/* Every remaining `html[data-style]` rule, again on a `[data-sty]` wrapper --
   see the note at the top of this file.

   **Whole rules, not matching lines.** The first pass filtered by line, which
   takes the opening brace of a rule whose body is on the next line and leaves
   it unclosed -- and an unclosed rule in a stylesheet swallows everything
   after it until the next `}`, which here was most of this page's own CSS.
   Nothing rendered and the tiles still did, which is exactly the sort of
   half-working that takes a while to see.

   A scan rather than a parser: every one of these rules sits at the top level
   (checked -- none is inside an `@media`), so the rule runs from wherever its
   selector list starts to the next `}`. */
const patch = (() => {
  const out = [];
  for(let i = css.indexOf('html[data-style='); i >= 0; i = css.indexOf('html[data-style=', i + 1)){
    // walk back over the selector list to the end of whatever came before it
    let a = i;
    while(a > 0 && !'}/'.includes(css[a - 1])) a--;
    const b = css.indexOf('}', i);
    if(b < 0) continue;
    const rule = css.slice(a, b + 1);
    if(!out.includes(rule)) out.push(rule);   // one entry per rule, not per selector
  }
  return out.map(r => r.replace(/html\[data-style=/g, '[data-sty=')).join('\n');
})();

/* The page is written as pure ASCII. A dash or a curly quote is one byte-order
   guess away from mojibake wherever this file gets opened, and a specimen book
   that says `â€"` has failed at the only thing it does. */
const ascii = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]))
  .replace(/[^\x20-\x7E]/g, c => '&#' + c.codePointAt(0) + ';');
const esc = ascii;
const varsOf = s => Object.entries(s.vars).map(([k, v]) => `${k}:${v}`).join(';');
const byKey = Object.fromEntries(data.styles.map(s => [s.key, s]));
const ROLES = ['Page', 'Text', 'Lines', 'Accent', 'Glow'];

/* An aesthetic's own ink on its own paper is readable by construction, so a
   caption sitting on a specimen takes the row's `--ink` rather than being
   fought for with a blend mode. */
const swatchRow = s => `<div class="sb-chips">${s.cols.map((c, i) => `
  <span class="sb-chip"><i style="background:${esc(c)}"></i>
    <b>${esc(i < 5 ? ROLES[i] : (s.names[i - 5] || 'Colour ' + (i - 4)))}</b>
    <u>${esc(c)}</u></span>`).join('')}</div>`;

const matrix = f => `
<section class="sb-fam" id="fam-${f.fam}">
  <header class="sb-head">
    <h2>${esc(f.nm)}</h2>
    <p>${f.ds}</p>
  </header>
  <div class="sb-scroll">
    <table class="sb-matrix">
      <thead><tr><th class="sb-rowhead"><span class="sb-sr">Aesthetic</span></th>${
        f.rows[0].cells.map((c, i) => `<th>${i}</th>`).join('')}</tr></thead>
      <tbody>${f.rows.map(r => {
        const s = byKey[r.style];
        return `<tr data-sty="${esc(r.style)}" style="${esc(varsOf(s))}">
          <th class="sb-rowhead sb-onpaper"><span class="sb-rname">${esc(s.nm)}</span></th>
          ${r.cells.map(c => `<td class="sb-onpaper">
            <div class="sb-cell">${c.html}
              <span class="sb-cap"><b>${esc(c.name)}</b><u>${esc(c.slot)}</u></span></div></td>`).join('')}
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>
</section>`;

const version = /const APP_VERSION = '([^']+)'/.exec(readFileSync('web/js/persist.js', 'utf8'))[1];
const total = data.families.reduce((n, f) => n + f.rows.reduce((m, r) => m + r.cells.length, 0), 0);

const doc = `<title>Bureau Specimen Book</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* ================= Bureau's own two stylesheets, verbatim ================= */
${css}
/* ====== and every per-aesthetic chrome rule again, on a wrapper attribute == */
${patch}

/* ================= the book the specimens are printed in ==================
   Deliberately quiet. Seven aesthetics are about to argue on one page and the
   frame must not join in: a cool grey with a faint blue bias, which is none of
   their grounds -- not Victoria's cream, not Starful Gothic's night. */

/* Bureau is an app that fills the screen, so its stylesheet says so. Undone
   here, and only here. */
html, body{ height:auto; overflow:visible }
body{
  margin:0; background:var(--sb-bg); color:var(--sb-tx);
  font-family:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  font-size:15px; line-height:1.55; overscroll-behavior:auto;
}
:root{
  --sb-bg:#F1F2F5; --sb-bg-2:#FFFFFF; --sb-edge:#DCDFE5;
  --sb-tx:#191C22; --sb-tx-2:#5A616D; --sb-tx-3:#8A919C;
  --sb-mark:#3D6B8E;
  --sb-sp:clamp(16px,3vw,34px);
  color-scheme:light dark;
}
@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]){
  --sb-bg:#141619; --sb-bg-2:#1C1F24; --sb-edge:#2B2F36;
  --sb-tx:#E7E9ED; --sb-tx-2:#9BA3AE; --sb-tx-3:#6B7481;
  --sb-mark:#79A9CC;
}}
:root[data-theme="dark"]{
  --sb-bg:#141619; --sb-bg-2:#1C1F24; --sb-edge:#2B2F36;
  --sb-tx:#E7E9ED; --sb-tx-2:#9BA3AE; --sb-tx-3:#6B7481;
  --sb-mark:#79A9CC;
}
.sb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.sb-wrap{max-width:1240px;margin:0 auto;padding:0 var(--sb-sp) 90px}
.sb-serif{font-family:Fraunces,Georgia,"Times New Roman",serif;font-weight:600}
.sb-mono{font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace}

/* ---- masthead ---- */
.sb-mast{padding:clamp(40px,7vw,80px) 0 clamp(22px,4vw,36px)}
.sb-mast h1{
  font-family:Fraunces,Georgia,serif;font-weight:600;
  font-variation-settings:"opsz" 120,"SOFT" 40,"WONK" 1;
  font-size:clamp(34px,6.2vw,58px);line-height:1.03;letter-spacing:-.018em;
  margin:0 0 14px;text-wrap:balance;color:var(--sb-tx);
}
.sb-mast p{max-width:64ch;color:var(--sb-tx-2);margin:0;font-size:clamp(15px,1.5vw,16.5px)}
.sb-meta{
  font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--sb-tx-3);
  letter-spacing:.02em;margin-top:20px !important;font-variant-numeric:tabular-nums;
}
.sb-rule{height:1px;background:var(--sb-edge);border:0;margin:0}
.sb-nav{display:flex;flex-wrap:wrap;gap:6px 8px;padding:16px 0 2px}
.sb-nav a{
  font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.02em;
  color:var(--sb-tx-2);text-decoration:none;padding:4px 9px;border-radius:2px;
  border:1px solid var(--sb-edge);transition:.15s;
}
.sb-nav a:hover{color:var(--sb-mark);border-color:var(--sb-mark)}
.sb-nav a:focus-visible{outline:2px solid var(--sb-mark);outline-offset:2px}

/* ---- the seven, as a strip of their own colour ---- */
.sb-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(146px,1fr));gap:10px;margin:26px 0 4px}
.sb-aes{
  display:block;border:1px solid var(--sb-edge);border-radius:3px;overflow:hidden;
  background:var(--sb-bg-2);text-decoration:none;color:inherit;
  transition:border-color .15s,transform .15s;
}
.sb-aes:hover{border-color:var(--sb-mark);transform:translateY(-1px)}
.sb-aes:focus-visible{outline:2px solid var(--sb-mark);outline-offset:2px}
.sb-aes .sb-band{display:flex;height:36px}
.sb-aes .sb-band i{flex:1}
.sb-aes .sb-lab{display:block;padding:9px 10px 11px}
.sb-aes .sb-lab b{display:block;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:16px;
  font-variation-settings:"opsz" 20,"SOFT" 30;color:var(--sb-tx)}
.sb-aes .sb-lab u{display:block;text-decoration:none;font-family:"IBM Plex Mono",monospace;
  font-size:10.5px;color:var(--sb-tx-3);letter-spacing:.03em;margin-top:2px}

/* ---- a family: rows are aesthetics, columns are positions ---- */
.sb-fam,.sb-shared{padding-top:clamp(36px,5vw,60px)}
.sb-head{margin-bottom:16px}
.sb-head h2{
  font-family:Fraunces,Georgia,serif;font-weight:600;font-size:clamp(22px,3vw,29px);
  font-variation-settings:"opsz" 40,"SOFT" 30;
  margin:0 0 6px;letter-spacing:-.012em;color:var(--sb-tx);text-wrap:balance;
}
.sb-head p{margin:0;color:var(--sb-tx-2);max-width:68ch;font-size:14.5px}
.sb-scroll{overflow-x:auto;border:1px solid var(--sb-edge);border-radius:4px;background:var(--sb-bg-2)}
table.sb-matrix{border-collapse:collapse;width:100%;margin:0}
table.sb-matrix th,table.sb-matrix td{padding:0;text-align:left;vertical-align:top;border:0}
/* A matrix reads better with its row label beside the row than above it.
   Stated at full strength: the rule above is two elements and a class, so
   anything shorter loses to it silently. */
table.sb-matrix tbody th.sb-rowhead{vertical-align:middle}
table.sb-matrix thead th{
  font-family:"IBM Plex Mono",monospace;font-size:10.5px;font-weight:500;
  color:var(--sb-tx-3);padding:9px 13px 8px;border-bottom:1px solid var(--sb-edge);
  font-variant-numeric:tabular-nums;background:var(--sb-bg-2);
}
.sb-onpaper{background:var(--paper)}
.sb-rowhead{
  position:sticky;left:0;z-index:2;width:114px;min-width:114px;
  border-right:1px solid var(--sb-edge);border-bottom:1px solid var(--sb-edge);
  padding:15px 13px;
}
thead .sb-rowhead{background:var(--sb-bg-2)}
.sb-rname{
  font-family:Fraunces,Georgia,serif;font-weight:600;font-size:14.5px;line-height:1.2;
  font-variation-settings:"opsz" 20,"SOFT" 30;color:var(--ink);
}
tbody td{border-bottom:1px solid var(--sb-edge);border-right:1px solid var(--sb-edge)}
tbody tr:last-child td,tbody tr:last-child .sb-rowhead{border-bottom:0}
.sb-cell{padding:15px 13px 13px;display:flex;flex-direction:column;gap:9px;align-items:flex-start}
.sb-cap{display:block;line-height:1.25;color:var(--ink)}
.sb-cap b{display:block;font-size:12.5px;font-weight:500}
.sb-cap u{display:block;text-decoration:none;font-family:"IBM Plex Mono",monospace;
  font-size:10px;letter-spacing:.02em;color:var(--ink-3)}

/* ---- colour ---- */
.sb-pal{border:1px solid var(--sb-edge);border-radius:4px;overflow:hidden;
  background:var(--sb-bg-2);margin-top:14px}
.sb-palrow{padding:15px 16px 17px;border-bottom:1px solid var(--sb-edge)}
.sb-palrow:last-child{border-bottom:0}
.sb-palrow h3{margin:0 0 11px;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:16px;
  font-variation-settings:"opsz" 20,"SOFT" 30;color:var(--sb-tx)}
.sb-palrow h3 em{font-family:"IBM Plex Sans",sans-serif;font-weight:400;font-style:normal;
  font-size:13px;color:var(--sb-tx-2)}
.sb-chips{display:flex;flex-wrap:wrap;gap:6px}
.sb-chip{display:flex;flex-direction:column;gap:4px;width:74px}
.sb-chip i{display:block;height:34px;border-radius:2px;border:1px solid rgba(128,128,128,.3)}
.sb-chip b{font-size:10.5px;font-weight:500;line-height:1.2;color:var(--sb-tx)}
.sb-chip u{font-family:"IBM Plex Mono",monospace;font-size:9px;text-decoration:none;
  color:var(--sb-tx-3);text-transform:uppercase;letter-spacing:.03em}
.sb-says{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:13px;
  font-size:12px;color:var(--sb-tx-2)}
.sb-says span{display:flex;align-items:center;gap:6px}
.sb-says i{width:15px;height:15px;border-radius:2px;border:1px solid rgba(128,128,128,.3);
  display:inline-block;flex:0 0 auto}
.sb-says b{font-family:"IBM Plex Mono",monospace;font-weight:500;font-size:11px;
  color:var(--sb-tx);letter-spacing:.02em}

/* ---- the ones that are the same everywhere ---- */
.sb-sub{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:17px;
  font-variation-settings:"opsz" 20,"SOFT" 30;margin:28px 0 0;color:var(--sb-tx)}
.sb-plate{border:1px solid var(--sb-edge);border-radius:4px;padding:17px;margin-top:14px;
  background:var(--paper)}
.sb-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:15px}
.sb-tiles .sb-cell{padding:0}
.sb-boxes{display:flex;flex-wrap:wrap;gap:16px;--k:var(--brass)}
.sb-box{display:flex;flex-direction:column;gap:8px;align-items:center;width:88px}
.sb-box .sb-pair{display:flex;gap:8px}
.sb-box small{font-size:11px;color:var(--ink-2)}
.sb-note{color:var(--sb-tx-2);font-size:13.5px;margin-top:11px;max-width:68ch}
.sb-decgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(134px,1fr));gap:12px;margin-top:14px}
.sb-dec{border:1px solid var(--sb-edge);border-radius:3px;background:var(--sb-bg-2);
  padding:13px 12px 11px;display:flex;flex-direction:column;gap:9px}
.sb-dec .sb-art{height:66px;display:grid;place-items:center;color:#8A6A3C}
.sb-dec .sb-art svg{max-height:66px;max-width:100%;width:auto}
.sb-dec b{font-size:12.5px;font-weight:500;color:var(--sb-tx)}
.sb-dec u{font-family:"IBM Plex Mono",monospace;font-size:9.5px;text-decoration:none;
  color:var(--sb-tx-3);line-height:1.4;display:block}
.sb-foot{margin-top:clamp(46px,7vw,82px);padding-top:20px;border-top:1px solid var(--sb-edge);
  color:var(--sb-tx-3);font-size:12.5px;font-family:"IBM Plex Mono",monospace;line-height:1.75}
.sb-foot b{color:var(--sb-tx-2);font-weight:500}
@media (prefers-reduced-motion:reduce){ *{animation:none !important;transition:none !important} }
</style>

${svg}

<div class="sb-wrap">
  <header class="sb-mast">
    <h1>Bureau Specimen Book</h1>
    <p>Every visual option there is, drawn as the thing it makes. Read a <strong>row</strong> for
       what one aesthetic is made of; read a <strong>column</strong> for what one stored position
       becomes everywhere else &mdash; which is the question a pin asks.</p>
    <p class="sb-meta">${data.styles.length} aesthetics &middot; ${FAMILIES.length} slot families
       &middot; ${total} specimens &middot; drawn by Bureau&rsquo;s own renderer</p>
  </header>
  <hr class="sb-rule">

  <nav class="sb-nav" aria-label="Sections">${
    [...FAMILIES.map(f => ['#fam-' + f.fam, f.nm]),
     ['#palette', 'Colour'], ['#shared', 'The same in all seven']]
      .map(([h, n]) => `<a href="${h}">${esc(n)}</a>`).join('')}</nav>

  <div class="sb-strip">${data.styles.map(s => `
    <a class="sb-aes" href="#pal-${esc(s.key)}">
      <span class="sb-band">${s.cols.slice(5, 12).map(c => `<i style="background:${esc(c)}"></i>`).join('')}</span>
      <span class="sb-lab"><b>${esc(s.nm)}</b><u>${esc(s.key)}</u></span>
    </a>`).join('')}</div>

  ${FAMILIES.map((f, i) => matrix(data.families[i])).join('')}

  <section class="sb-fam" id="palette">
    <header class="sb-head">
      <h2>Colour</h2>
      <p>Sixteen positions: five that dress the app, and eleven an object may wear. What is stored
         is the <em>number</em>, so changing aesthetic repaints the desk without converting
         anything &mdash; and changing back puts every tile exactly where it was.</p>
    </header>
    <div class="sb-pal">${data.styles.map(s => `
      <div class="sb-palrow" id="pal-${esc(s.key)}">
        <h3>${esc(s.nm)} <em>&mdash; ${esc(s.ds)}</em></h3>
        ${swatchRow(s)}
        <div class="sb-says">
          <span><i style="background:${esc(s.wood)}"></i>the carcass <b>${esc(s.wood)}</b></span>
          <span><i style="background:linear-gradient(135deg,${
            esc((s.board || '').split('|')[0])} 0 50%,${
            esc((s.board || '').split('|')[1] || (s.board || '').split('|')[0])} 50%)"></i>the board</span>
          <span>ticks <b>${esc((data.checks.find(c => c.key === s.check) || {}).nm || s.check)}</b></span>
          <span>bursts in <b>${esc(s.spray)}</b></span>
          ${s.dark ? '<span>has a set for <b>after dark</b></span>' : ''}
        </div>
      </div>`).join('')}
    </div>
  </section>

  <section class="sb-shared" id="shared">
    <header class="sb-head">
      <h2>The same in all seven</h2>
      <p>A shape says what a thing <em>is</em>, the way a face does. A tick box is a fact about the
         desk rather than about a type. And a decoration is a made object &mdash; a mantel clock
         cannot be re-dressed into a gearwork the way a knob is re-dressed into a boss &mdash; so it
         is tagged with where it belongs instead. Drawn here in Victoria.</p>
    </header>

    <h3 class="sb-sub">Shapes</h3>
    <div class="sb-plate sb-tiles" data-sty="victorian" style="${esc(varsOf(byKey.victorian))}">${
      data.shapes.map(sh => `<div class="sb-cell">${sh.html}
        <span class="sb-cap"><b>${esc(sh.nm)}</b><u>sh-${esc(sh.key)}</u></span></div>`).join('')}</div>

    <h3 class="sb-sub">Tick boxes</h3>
    <div class="sb-plate sb-boxes" data-sty="victorian" style="${esc(varsOf(byKey.victorian))}">${
      data.checks.map(c => `<div class="sb-box" data-checks="${esc(c.key)}">
        <span class="sb-pair"><i class="check"></i><i class="check on">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
               stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>
        </i></span><small>${esc(c.nm)}</small></div>`).join('')}</div>
    <p class="sb-note">Each aesthetic states which one it starts as &mdash; ${
      data.styles.map(s => `${esc(s.nm)} ticks <em>${esc((data.checks.find(c => c.key === s.check) || {}).nm || s.check)}</em>`).join(', ')
    } &mdash; and picking one keeps it, everywhere.</p>

    <h3 class="sb-sub">Decorations</h3>
    <p class="sb-note">The picker leads with the ones that belong where you are; the rest sit
       behind the same disclosure every slot family has.</p>
    <div class="sb-decgrid">${data.decor.map(d => `
      <div class="sb-dec"><span class="sb-art">${data.decorSVG[d.key]}</span>
        <b>${esc(d.nm)}</b><u>${d.suits.map(esc).join(' &middot; ')}</u></div>`).join('')}</div>
  </section>

  <p class="sb-foot">
    Generated by <b>scripts/catalogue.mjs</b> from Bureau v${esc(version)}. Every tile above came out
    of the app&rsquo;s own <b>sampleTile()</b>,<br>so this page cannot drift from what the desk
    actually draws. Re-run it after changing a slot.
  </p>
</div>`;

writeFileSync(OUT, doc);
console.log(`${OUT} - ${(doc.length / 1024).toFixed(0)}KB, ${total} specimens`);
