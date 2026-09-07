/* ============================================================
   22 · the specimen book — every aesthetic, and everything it dresses
   ============================================================
   One page holding the whole visual system: the seven aesthetics, the sixteen
   colour slots each of them names, the six slot families, every type drawn as
   the thing it makes, every face a container can wear, every shape an object
   can be — and the **chrome**, which nothing had ever laid out: the panel, the
   menu, the bar, the rail, the toast, the palette, and every control that goes
   inside them.

   Three rules, and the first is the one that makes it worth having.

   **It is generated from the running app, never written out by hand.** Every
   tile comes out of `sampleTile()` — the type picker's own primitive, decision
   51 — and every colour, token and default is read back off the root after
   asking the app to *be* that aesthetic. A second renderer drifts from the
   first the day a slot gains a rule, and a specimen book that lies about what
   a knob looks like is worse than no specimen book.

   **The chrome is the exception, and it is an honest one.** A `.sqbtn` is not
   produced by a shared function; it is markup written inline at a dozen call
   sites, so there is nothing to reuse and the specimens here are written in
   the app's own class names. That is the point rather than a compromise: this
   section is the *inventory* of those names, and a class that gets renamed
   shows up here as an undressed specimen, which is exactly the thing a style
   guide is for.

   **And it is one document, rendered twice.** `guideDoc()` builds the whole
   file; the app shows it in an iframe (`openGuide()`) and
   `scripts/catalogue.mjs` writes the same string to disk. An iframe rather
   than a section of the app because the page needs its own global reset —
   Bureau's stylesheet says `body` is parchment, a hundred per cent tall and
   does not scroll, which is true of an app and wrong for a book — and because
   a document that has to be safe to inline is a document that has to be
   careful. Isolated, it need not be.

   The one thing that has to be worked around: the tile rules moved onto
   `<fam>sty-` classes in decision 98, which is exactly what lets seven
   aesthetics share a page, but the *chrome* rules are still keyed on
   `html[data-style]` and cannot be — one page, one `<html>`. So every one of
   those rules is re-emitted against a `[data-sty]` wrapper attribute and each
   specimen carries one. Wholesale, not hand-picked: a rule about something
   this page does not draw simply matches nothing, and choosing which ones
   mattered is how you miss one. */
import { $, esc, ic } from './util.js';
import { S, KEYS, K, SHAPES, FACES, PROJ_COVERS, isCategory, familyOf,
         isContainer, PRIMARY } from './model.js';
import { STYLES, palNow, applyLook, styleNow, famSlots, FAMS, ROLES, OBJ0,
         CHECKS, isDark } from './look.js';
import { sampleObject, sampleTile, kindSample } from './panels.js';
import { DECOR, DECOR_KEYS, decorSVG, decorSuits } from './decor.js';
import { SPRAYS, sprayMark } from './motion.js';
import { LIFE_KEYS, LIFE_ART } from './decor.js';
import { APP_VERSION } from './persist.js';

/* A function, not a constant. The import graph is cyclic at function level and
   nothing may cross a module boundary at load time — `Object.keys(STYLES)` at
   the top of this file reads look.js's binding before look.js has run whenever
   this module is reached first, and throws. See the note on the import graph
   in CLAUDE.md. */
const styleKeys = ()=> Object.keys(STYLES);

/* ---- what the browser is actually running ------------------------------
   Read out of the CSSOM rather than fetched, for two reasons. It needs no
   network, so the book works offline and in a file the service worker has
   never seen; and what `cssRules` hands back is what this browser *parsed*,
   which is a truer answer than the file on disk — a rule it dropped was never
   applying to the desk either. */
function liveCSS(){
  const out=[];
  for(const sheet of document.styleSheets){
    let rules=null; try{ rules=sheet.cssRules; }catch(e){ continue; }
    if(!rules) continue;
    for(const r of rules) out.push(r.cssText);
  }
  return out.join('\n');
}

/* Every `html[data-style=…]` rule again, on a wrapper attribute. Recursive,
   because a couple of them sit inside an `@media` and a rule lifted out of its
   condition is a rule that applies where it was told not to. */
function chromePatch(){
  const rewrite = t => t.replace(/html\[data-style=/g, '[data-sty=');
  const walk = rules => {
    let out='';
    for(const r of rules){
      if(r.selectorText && r.selectorText.includes('html[data-style=')){ out += rewrite(r.cssText)+'\n'; continue; }
      if(r.cssRules && r.cssRules.length){
        const inner = walk(r.cssRules);
        if(!inner) continue;
        const at = r.media ? '@media '+r.conditionText
                 : r.conditionText ? '@supports '+r.conditionText : '';
        out += at ? at+'{\n'+inner+'}\n' : inner;
      }
    }
    return out;
  };
  let out='';
  for(const sheet of document.styleSheets){
    let rules=null; try{ rules=sheet.cssRules; }catch(e){ continue; }
    if(rules) out += walk(rules);
  }
  return out;
}

/* ---- being each aesthetic in turn --------------------------------------
   `applyLook()` writes forty-odd tokens onto the root out of five hexes
   (`chromeTokens()`), so the only honest way to know what an aesthetic writes
   is to let it write. Assign the key, apply, read the root back, and put it
   all the way back at the end — never `applyStyle()`, which also lays down the
   board, the alpha and the defaults a new drawer is born with, and would leave
   the desk repainted after a visit to the bookshelf. */
function survey(draw){
  const was = S.look.style, out = [];
  for(const key of styleKeys()){
    S.look.style = key; applyLook();
    const st = STYLES[key], el = document.documentElement, vars = {};
    for(let i=0;i<el.style.length;i++){
      const n = el.style[i];
      if(n.startsWith('--')) vars[n] = el.style.getPropertyValue(n);
    }
    out.push({ key, nm:st.nm, ds:st.ds, vars, cols:palNow().slice(),
      names:st.names||[], defaults:st.defaults||{}, check:st.check||'square',
      spray:st.spray||'stars', board:st.board||'', dark:!!st.dark,
      wood:vars['--wood']||'', serif:vars['--serif']||'', sans:vars['--sans']||'',
      dressed: draw ? draw(key) : null });
  }
  S.look.style = was; applyLook();
  return out;
}

/* ---- specimens ---------------------------------------------------------
   A slot family belongs on the thing that wears it: a knob and a panelling on
   a drawer front, a stock on a sheet of paper, a binding on a spine. Drawing
   all six on one shape would be tidier and would show four of them on
   something that never wears them. */
const FAMILIES = [
  { fam:'bd', prop:'border',  nm:'Edges',      of:'front',
    ds:'The line round a thing. Seven positions, the same seven on a drawer front and on a sheet of paper, drawn in wood on one and in ink on the other.' },
  { fam:'pn', prop:'panel',   nm:'Panellings', of:'front',
    ds:'How a drawer front is worked. All five are mouldings and all five are lit from the upper left, which is where the knob&rsquo;s highlight is.' },
  { fam:'kn', prop:'knob',    nm:'Knobs',      of:'front',
    ds:'Turned out of the front&rsquo;s own wood: what makes it a knob is the light on it, not a lighter shade painted where it sits.' },
  { fam:'tx', prop:'texture', nm:'Grains',     of:'front',
    ds:'What is printed on the surface. Six positions: nothing, the fine tooth of the sheet, a weave, a ruling, a scatter, a pattern.' },
  { fam:'st', prop:'stock',   nm:'Stocks',     of:'paper',
    ds:'What the sheet <em>is</em>, as against what is printed on it. The one family whose fallback is the aesthetic&rsquo;s own rather than the vocabulary&rsquo;s, and the one that is never written down.' },
  { fam:'bn', prop:'binding', nm:'Bindings',   of:'spine',
    ds:'A spine is the one face that is a made object rather than a layout, so it is the binder&rsquo;s work rather than the cabinetmaker&rsquo;s.' }
];

/* Pinning is what lets one page show seven aesthetics at once: a bare slot
   follows whichever aesthetic the document is sitting in, and this document is
   sitting in all of them. See decision 98. */
const pin = (o, sty, over) => {
  o.border  = sty+'/'+(over.border  || 'panel');
  o.panel   = sty+'/'+(over.panel   || 'cockbead');
  o.knob    = sty+'/'+(over.knob    || 'round');
  o.texture = sty+'/'+(over.texture || 'none');
  o.stock   = sty+'/'+(over.stock   || 'plain');
  o.binding = sty+'/'+(over.binding || 'banded');
  return o;
};
const specimen = (of, title, colour) => {
  const spec = of==='paper'
    ? { kind:'note', attrs:['text'], title, size:[3,2],
        body:'A line or two, so you can see how it sits.' }
    : of==='spine'
    ? { kind:'drawer', attrs:['container'], face:'spine', title, size:[1,4] }
    : { kind:'drawer', attrs:['container'], title, size:[3,2] };
  const o = sampleObject(spec);
  o.c = colour; o.face = spec.face;
  return o;
};

/* A handful of tiles that between them use most of what an aesthetic says:
   wood and paper, a knob, a moulding, a grain, a stock, a spine, a tick box,
   a bar. Drawn inside each aesthetic's own plate, so a row reads as that
   aesthetic entire. */
function tasteRow(){
  const mk = (spec, w, h) => sampleTile(sampleObject(spec), w||132, h||92);
  return [
    ['A drawer',   mk({kind:'drawer', attrs:['container'], title:'Kitchen', size:[3,2]})],
    ['A cabinet',  mk({kind:'drawer', attrs:['container'], title:'Studio', size:[2,3]}, 96, 132)],
    ['A book',     mk({kind:'book', attrs:['container','text'], face:'spine', title:'Middlemarch', size:[1,4]}, 60, 150)],
    ['A note',     mk({kind:'note', attrs:['text'], title:'Kept', size:[3,2]})],
    ['A task',     mk({kind:'task', attrs:['check','date'], title:'Water the fig', size:[4,1]}, 160, 52)],
    ['A checklist',mk({kind:'checklist', attrs:['container','spawn'], face:'checklist', title:'Before dinner', size:[3,3]}, 132, 132)],
    ['A project',  mk({kind:'project', attrs:['container','progress'], face:'project', title:'The film', size:[3,3]}, 132, 132)],
    ['A bar',      mk({kind:'progress', attrs:['progress'], shape:'bar', title:'Ten pounds', size:[5,1]}, 170, 46)]
  ];
}

/* ---- the chrome ---------------------------------------------------------
   Written in the app's own class names, per the note at the top of this file.
   Every specimen is inert: no `data-act`, no ids, nothing a delegated listener
   could pick up if this ever ends up somewhere it can hear one. */
function chromePlate(s){
  const B = (n,sz)=>ic(n, sz||14);
  const panel = `
  <div class="gx-stage gx-tall">
    <aside class="panel open">
      <div class="ptop">
        <div class="pt"><b>Kitchen</b><i>Drawer &middot; 12 things</i></div>
        <span class="pill">${B('undo',13)} Done</span>
      </div>
      <div class="pbody">
        <div class="section-h"><h2>Look</h2><div class="rule"></div></div>
        <div class="field"><label>Opens as</label>
          <select class="psel"><option>A grid</option><option>A list</option></select>
        </div>
        <div class="field" style="margin-top:12px"><label>Name</label>
          <input class="pfield" value="Kitchen" readonly>
        </div>
        <div class="prow"><label>Colour</label><div>${
          s.cols.slice(OBJ0, OBJ0+7).map((c,i)=>`<span class="pill${i===2?' on':''}"
            style="background:${esc(c)};color:#fff;border-color:${esc(c)}">&nbsp;&nbsp;</span>`).join('')}</div></div>
        <label class="rangerow"><span>Board strength</span><b class="num">62</b>
          <input type="range" min="0" max="100" value="62" disabled></label>
        <div class="mini" style="--k:var(--brass)">A slot is a <b>position</b>, not a colour. Changing aesthetic swaps every tile to that aesthetic&rsquo;s answer; changing back puts each one exactly where it was.</div>
        <div class="statline" style="margin-top:12px">
          <div class="s"><b>12</b>things</div><div class="s"><b>4</b>done</div><div class="s"><b>1</b>shelf</div>
        </div>
        <details class="pgroup" style="margin-top:12px"><summary>From other aesthetics</summary>
          <div class="prow"><div>${['Victoria','Carca','Aeros'].map(n=>`<span class="pill">${esc(n)}</span>`).join('')}</div></div>
        </details>
        <div class="section-h" style="margin-top:14px"><h2>Doors</h2><div class="rule"></div></div>
        <div class="rows osecs">
          ${[['palette','Aesthetics','the sixteen colours, light and dark'],
             ['brush','Appearance','the board, the shadows, the grid'],
             ['layers','Depth and light','how solid things look']].map(([i,t,n])=>
            `<div class="row"><span class="kindmark">${B(i,13)}</span>
              <div class="body"><div class="title">${esc(t)}</div><div class="snip">${esc(n)}</div></div>
              <span class="rowgo">${B('chevR',13)}</span></div>`).join('')}
        </div>
      </div>
    </aside>
  </div>`;

  const bubble = `
  <div class="gx-stage gx-bubble">
    <aside class="panel bubble from-right open" style="--tail:34px;width:250px">
      <div class="ptop"><div class="pt"><b>Water the fig</b><i>Task</i></div></div>
      <div class="pbody">
        <div class="prow"><label>Priority</label><div>${
          [1,2,3,4,5].map(n=>`<span class="pill${n<=3?' on':''}">${B('star',11)}</span>`).join('')}</div></div>
        <div class="mini">A question about one tile is asked beside it.</div>
      </div>
    </aside>
  </div>`;

  const menu = `
  <div class="gx-stage gx-menu">
    <div class="ctxmenu" style="position:relative;display:block;left:auto;top:auto">
      <button>${B('brush')} Object editor</button>
      <button>${B('eye')} Read</button>
      <button>${B('calendar')} When&hellip;</button>
      <button>${B('folder')} Move to drawer&hellip;</button>
      <div class="ctxrule"></div>
      <button class="danger">${B('trash')} Delete</button>
    </div>
  </div>`;

  /* Both of these are the phone's: the bar is part of the carcass only on a
     phone (on a Mac it sits on paper) and the rail does not exist on a Mac at
     all. So the specimen carries `is-phone`, which is where those rules live —
     the class is on `#frame` in the app and means exactly the same here. */
  const bar = `
  <div class="gx-bar is-phone">
    <div class="gridbar shelf shelf-top">
      <div class="where">
        <button class="iconbtn">${B('chevL',17)}</button>
        <span class="trail"><b>Desk</b> ${B('chevR',9)} <span class="here">Kitchen</span></span>
        <span class="shelfmark" style="--sw:3">${
          Array.from({length:9},(_,i)=>`<i class="${i===4?'on':''}"></i>`).join('')}</span>
      </div>
      <div class="bartools">
        <button class="sqbtn on locked">${B('lock',16)}</button>
        <button class="sqbtn">${B('brush',16)}</button>
        <button class="sqbtn">${B('gear',16)}</button>
      </div>
    </div>
  </div>`;

  const rail = `
  <div class="gx-rail is-phone">
    <nav class="deskrail ks-med" style="height:46px">
      <i class="dgrain"></i>
      <i class="pull railknob"></i>
    </nav>
  </div>`;

  const bits = `
  <div class="gx-bits">
    <div class="gx-bit"><span class="pill">${B('plus',12)} A pill</span><small>.pill</small></div>
    <div class="gx-bit"><span class="pill on">Chosen</span><small>.pill.on</small></div>
    <div class="gx-bit"><button class="sqbtn">${B('gear',16)}</button><small>.sqbtn</small></div>
    <div class="gx-bit"><button class="sqbtn on">${B('lock',16)}</button><small>.sqbtn.on</small></div>
    <div class="gx-bit"><button class="iconbtn">${B('chevL',17)}</button><small>.iconbtn</small></div>
    <div class="gx-bit"><button class="subtle-btn">Start over</button><small>.subtle-btn</small></div>
    <div class="gx-bit"><select class="psel"><option>One of many</option></select><small>.psel</small></div>
    <div class="gx-bit"><input class="pfield" value="Typed in" readonly><small>.pfield</small></div>
    <div class="gx-bit"><span class="tagchip">#kitchen</span><small>.tagchip</small></div>
    <div class="gx-bit"><span class="kindmark">${B('folder',13)}</span><small>.kindmark</small></div>
    <div class="gx-bit gx-wide"><div class="section-h"><h2>A heading</h2><div class="rule"></div></div><small>.section-h</small></div>
    <div class="gx-bit gx-wide"><div class="mini" style="--k:var(--brass)">A note in a panel, which is where every explanation in the app lives.</div><small>.mini</small></div>
    <div class="gx-bit gx-wide"><div class="pickgrid sw">${
      s.cols.slice(OBJ0, OBJ0+6).map((c,i)=>`<button class="${i===1?'on':''}" style="background:${esc(c)}"></button>`).join('')}</div><small>.pickgrid.sw</small></div>
  </div>`;

  const toast = `
  <div class="gx-stage gx-toast">
    <div class="toast show" style="position:relative;left:auto;bottom:auto;transform:none">
      Filed in Kitchen <button class="tundo">Undo</button></div>
  </div>`;

  const cmd = `
  <div class="gx-stage gx-cmd">
    <div class="modal cmd" style="position:relative;transform:none">
      <input class="cmdinput" value="fig" readonly>
      <div class="cmdlist">
        <div class="cmdrow on"><span class="kindmark">${B('check',13)}</span>
          <div class="body"><div class="title">Water the fig</div><div class="snip">Kitchen</div></div></div>
        <div class="cmdrow"><span class="kindmark">${B('folder',13)}</span>
          <div class="body"><div class="title">Figures</div><div class="snip">Studio</div></div></div>
      </div>
    </div>
  </div>`;

  return { panel, bubble, menu, bar, rail, bits, toast, cmd };
}

/* ---- the page ----------------------------------------------------------
   Pure ASCII in, HTML entities out. A curly quote or a dash is one byte-order
   guess away from mojibake wherever a saved copy of this ends up opened, and a
   specimen book that says `a-a"` has failed at the only thing it does. */
const ascii = s => String(s==null?'':s)
  .replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
  .replace(/[^\x20-\x7E]/g, c=>'&#'+c.codePointAt(0)+';');
const A = ascii;
const varsOf = s => Object.entries(s.vars).map(([k,v])=>`${k}:${v}`).join(';');
const wrap = (s, body, cls) =>
  `<div class="${cls||'gx'}" data-sty="${A(s.key)}" style="${A(varsOf(s))}">${body}</div>`;

function guideBody(){
  /* Everything drawn per aesthetic is built inside the survey, while that
     aesthetic is the one the app is wearing — a tile's dressed classes come
     off `dress()`, which asks the desk, so a tile built outside its own turn
     would be dressed by whichever aesthetic happened to be showing. */
  const mats = FAMILIES.map(f=>({ ...f, rows:[] }));
  const styles = survey(key=>{
    const st = STYLES[key], colour = (palNow())[OBJ0+6];
    for(let i=0;i<FAMILIES.length;i++){
      const f = FAMILIES[i];
      mats[i].rows.push({ style:key, cells: famSlots(f.fam, key).map(([slot,name])=>({
        slot, name,
        html: sampleTile(pin(specimen(f.of, name, colour), key, {[f.prop]:slot}),
          f.of==='spine'?70:148, f.of==='spine'?168:100)
      })) });
    }
    return { taste:tasteRow(), chrome:chromePlate({key, cols:palNow().slice()}) };
  });
  const byKey = Object.fromEntries(styles.map(s=>[s.key,s]));
  const here = styleNow().nm;
  /* A bit is drawn in the object's own colour with the desk's ink round it, so
     a sample of one needs both. Victoria's, because the burst plate below is
     drawn in Victoria the way the tick boxes are. */
  const brass = byKey.victorian.vars['--brass'] || byKey.victorian.cols[3];
  const ink   = byKey.victorian.vars['--ink']   || byKey.victorian.cols[1];

  /* The three galleries below are drawn in whichever aesthetic the desk is
     wearing right now, and say so. Seven copies of sixty types is a megabyte
     of book to answer a question the plates above already answer; what these
     are for is the inventory, which is the same list in all seven. */
  const shapes = Object.entries(SHAPES).map(([k,nm])=>{
    const o = sampleObject({kind:'note', attrs:['text','check'], title:nm, size:[3,2],
      body:'A line or two.'});
    o.shape = k;
    return {key:k, nm, html:sampleTile(o,148,100)};
  });
  /* No `spawn` in the attrs, and that is not a detail: a container carrying it
     with no `spawnBy` of its own answers `click`, which is the spawner branch,
     and the spawner branch sits above every face — so a sample asking for nine
     different faces drew nine identical spirals. The book caught it on its
     first run, which is the argument for the book. */
  const faces = Object.entries(FACES).map(([k,nm])=>{
    const spine = k==='spine';
    const o = sampleObject({kind:'drawer', attrs:['container','progress'],
      title:nm, size: spine?[1,4]:[3,3]});
    o.face = k;
    return {key:k, nm, html:sampleTile(o, spine?70:148, spine?168:132)};
  });
  const covers = Object.entries(PROJ_COVERS).map(([k,nm])=>{
    const o = sampleObject({kind:'project', attrs:['container','progress'],
      face:'project', title:nm, size: k==='film'?[2,3]:[3,3]});
    o.proj = k;
    return {key:k, nm, html:sampleTile(o, k==='film'?100:148, 150)};
  });
  const lifes = LIFE_KEYS.map(k=>{
    const o = sampleObject({kind:'life', attrs:['container'], face:'life',
      title:(LIFE_ART[k]||{}).nm || k, size:[3,3]});
    o.lifeart = k;
    return {key:k, nm:(LIFE_ART[k]||{}).nm || k, html:sampleTile(o,132,132)};
  });
  const types = KEYS.filter(k=>!isCategory(k)).map(k=>({
    key:k, nm:K(k).nm, cat: isContainer({kind:k, attrs:K(k).attrs}) ? 'Drawers' : 'Objects',
    major: PRIMARY.includes(k), fam: familyOf(k),
    html: sampleTile(kindSample(k), 148, 108)
  }));

  const cell = c => `<td class="gx-paper"><div class="gx-cell">${c.html}
    <span class="gx-cap"><b>${A(c.name)}</b><u>${A(c.slot)}</u></span></div></td>`;
  const matrix = f => `
  <section class="gx-sec" id="fam-${f.fam}">
    <header class="gx-head"><h2>${A(f.nm)}</h2><p>${f.ds}</p></header>
    <div class="gx-scroll"><table class="gx-matrix">
      <thead><tr><th class="gx-rowhead"></th>${
        f.rows[0].cells.map((c,i)=>`<th>${i}</th>`).join('')}</tr></thead>
      <tbody>${f.rows.map(r=>{ const s=byKey[r.style]; return `
        <tr data-sty="${A(r.style)}" style="${A(varsOf(s))}">
          <th class="gx-rowhead gx-paper"><span class="gx-rname">${A(s.nm)}</span></th>
          ${r.cells.map(cell).join('')}</tr>`; }).join('')}</tbody>
    </table></div>
  </section>`;

  const tiles = (list, note) => `${note?`<p class="gx-note">${note}</p>`:''}
    <div class="gx-plate gx-tiles" data-sty="${A(S.look.style||'victorian')}">${
      list.map(t=>`<div class="gx-cell">${t.html}
        <span class="gx-cap"><b>${A(t.nm)}</b><u>${A(t.key)}</u></span></div>`).join('')}</div>`;

  const swatches = s => `<div class="gx-chips">${s.cols.map((c,i)=>`
    <span class="gx-chip"><i style="background:${A(c)}"></i>
      <b>${A(i<OBJ0 ? ROLES[i] : (s.names[i-OBJ0] || 'Colour '+(i-OBJ0+1)))}</b>
      <u>${A(c)}</u></span>`).join('')}</div>`;

  const plate = s => `
  <section class="gx-sec gx-aes" id="aes-${A(s.key)}">
    <header class="gx-head">
      <h2>${A(s.nm)}</h2>
      <p>${A(s.ds)}.${s.dark?' It carries a second set of sixteen for after dark.':''}</p>
    </header>
    <h3 class="gx-sub">Its sixteen</h3>
    <p class="gx-note">The first five dress the app. The other eleven are what drawers and
      objects are painted in, and what is stored on an object is the <em>number</em>.</p>
    ${swatches(s)}
    <div class="gx-says">
      <span><i style="background:${A(s.wood)}"></i>carcass <b>${A(s.wood)}</b></span>
      <span><i style="background:linear-gradient(135deg,${A((s.board||'').split('|')[0])} 0 50%,${
        A((s.board||'').split('|')[1] || (s.board||'').split('|')[0])} 50%)"></i>board</span>
      <span>ticks <b>${A((CHECKS[s.check]||s.check))}</b></span>
      <span>bursts in <b>${A(s.spray)}</b></span>
      <span>${A(isDark(s.cols[0])?'a dark ground':'a light ground')}</span>
    </div>
    <h3 class="gx-sub">What a new drawer is born with</h3>
    <p class="gx-note">Rolled from this aesthetic&rsquo;s own vocabulary, with each of these in the
      bag three times over, so a desk is a room of related furniture rather than a row of
      identical fronts.</p>
    <div class="gx-says">${Object.entries(s.defaults).map(([k,v])=>
      `<span>${A(k)} <b>${A(v)}</b></span>`).join('')}</div>
    <h3 class="gx-sub">Its typefaces</h3>
    ${wrap(s, `<div class="gx-plate gx-type">
      <p class="gx-serif" style="font-family:${A(s.serif)}">Every drawer, book and note is set in this.</p>
      <p class="gx-sans" style="font-family:${A(s.sans)}">And every label, field and menu row in this.</p>
      <p class="gx-mono">${A(s.serif)}<br>${A(s.sans)}</p></div>`)}
    <h3 class="gx-sub">On the desk</h3>
    ${wrap(s, `<div class="gx-plate gx-taste gx-paper">${s.dressed.taste.map(([nm,html])=>
      `<div class="gx-cell">${html}<span class="gx-cap"><b>${A(nm)}</b></span></div>`).join('')}</div>`)}
    <h3 class="gx-sub">Its chrome</h3>
    <p class="gx-note">One <b>.panel</b> rule and one <b>.sqbtn</b> rule per aesthetic is nearly all
      of it: there is one menu system and one button in the app, so two rules reach every menu there
      is. Everything below is inert.</p>
    ${wrap(s, `<div class="gx-chrome">
      ${s.dressed.chrome.panel}${s.dressed.chrome.bubble}
      ${s.dressed.chrome.menu}${s.dressed.chrome.toast}
      ${s.dressed.chrome.cmd}</div>
      <div class="gx-chrome gx-stack">${s.dressed.chrome.bar}${s.dressed.chrome.rail}</div>
      ${s.dressed.chrome.bits}`)}
    <details class="gx-tokens"><summary>The ${Object.keys(s.vars).length} tokens it writes</summary>
      <div class="gx-toks">${Object.entries(s.vars).map(([k,v])=>
        `<span class="gx-tok"><i style="background:${A(v)}"></i><b>${A(k)}</b><u>${A(v)}</u></span>`).join('')}</div>
    </details>
  </section>`;

  const NAV = [
    ...styles.map(s=>['#aes-'+s.key, s.nm]),
    ...FAMILIES.map(f=>['#fam-'+f.fam, f.nm]),
    ['#types','Types'], ['#faces','Faces'], ['#shapes','Shapes'],
    ['#marks','Ticks, bursts, ornaments']
  ];

  const total = mats.reduce((n,f)=>n+f.rows.reduce((m,r)=>m+r.cells.length,0),0)
    + shapes.length + faces.length + covers.length + lifes.length + types.length
    + styles.length * 8;

  return `
<div class="gx-wrap">
  <header class="gx-mast">
    <h1>Bureau Specimen Book</h1>
    <p>Every visual option there is, drawn as the thing it makes. Read an <strong>aesthetic</strong>
       for what one desk is made of; read a <strong>column</strong> of a slot matrix for what one
       stored position becomes everywhere else, which is the question a pin asks.</p>
    <p class="gx-meta">${styles.length} aesthetics &middot; ${FAMILIES.length} slot families
       &middot; ${types.length} types &middot; ${total} specimens &middot; Bureau ${A(APP_VERSION)}
       &middot; drawn by the app&rsquo;s own renderer</p>
  </header>
  <hr class="gx-rule">
  <nav class="gx-nav">${NAV.map(([h,n])=>`<a href="${h}">${A(n)}</a>`).join('')}</nav>

  <div class="gx-strip">${styles.map(s=>`
    <a class="gx-aeslink" href="#aes-${A(s.key)}">
      <span class="gx-band">${s.cols.slice(OBJ0,OBJ0+7).map(c=>`<i style="background:${A(c)}"></i>`).join('')}</span>
      <span class="gx-lab"><b>${A(s.nm)}</b><u>${A(s.key)}</u></span></a>`).join('')}</div>

  ${styles.map(plate).join('')}

  ${mats.map(matrix).join('')}

  <section class="gx-sec" id="types">
    <header class="gx-head"><h2>Types</h2>
      <p>Every type there is, drawn as the thing it makes. A type is a named preset of attributes,
         so what a thing can <em>do</em> is the attributes and what it <em>looks</em> like is a
         shape or a face. The ones marked <b>major</b> are the twenty the picker leads with;
         the rest sit behind <em>Every other type</em>. Drawn in ${A(here)}.</p></header>
    ${['Drawers','Objects'].map(g=>`
      <h3 class="gx-sub">${g}</h3>
      <div class="gx-plate gx-tiles" data-sty="${A(S.look.style||'victorian')}">${
        types.filter(t=>t.cat===g).map(t=>`<div class="gx-cell">${t.html}
          <span class="gx-cap"><b>${A(t.nm)}</b><u>${A(t.key)}${t.major?' &middot; major':''}${
            t.fam?' &middot; a '+A(t.fam.of||'family'):''}</u></span></div>`).join('')}</div>`).join('')}
  </section>

  <section class="gx-sec" id="faces">
    <header class="gx-head"><h2>Faces</h2>
      <p>A <b>face</b> is how a container draws on its parent&rsquo;s board; a <b>layout</b> is how it
         arranges its children when you go in. Any container can wear either, and nothing branches
         on a type&rsquo;s name to decide.</p></header>
    ${tiles(faces, 'Drawn empty, because what a face shows is what is inside it and a sample holds nothing. The row on each aesthetic&rsquo;s own plate above has one of each with something in it.')}
    <h3 class="gx-sub">Project covers</h3>
    ${tiles(covers, 'A project face is a report, and the cover says what the thing being reported on <em>is</em>. A slot like any other: per object, then per type.')}
    <h3 class="gx-sub">Life areas</h3>
    ${tiles(lifes, 'Nine things lying on the desk. Drawn rather than photographed, so they take the aesthetic&rsquo;s own colours and cost nothing to ship; an uploaded picture beats the drawing.')}
  </section>

  <section class="gx-sec" id="shapes">
    <header class="gx-head"><h2>Shapes</h2>
      <p>A shape says what a thing <em>is</em>, the way a face does. The same ${shapes.length} in all
         seven aesthetics. Drawn in ${A(here)}.</p></header>
    ${tiles(shapes)}
  </section>

  <section class="gx-sec" id="marks">
    <header class="gx-head"><h2>Ticks, bursts and ornaments</h2>
      <p>A tick box is a fact about the desk rather than about a type, so a task ticked one way and a
         checklist line ticked another cannot happen. A burst belongs to a new object arriving and to
         nothing else. And a decoration is a made object, so it is tagged with where it belongs
         instead of being re-dressed.</p></header>

    <h3 class="gx-sub">Tick boxes</h3>
    <div class="gx-plate gx-boxes" data-sty="victorian" style="${A(varsOf(byKey.victorian))}">${
      Object.entries(CHECKS).map(([k,nm])=>`<div class="gx-box" data-checks="${A(k)}">
        <span class="gx-pair"><i class="check"></i><i class="check on">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>
        </i></span><small>${A(nm)}</small></div>`).join('')}</div>
    <p class="gx-note">Each aesthetic states which one it starts as: ${
      styles.map(s=>`${A(s.nm)} ticks <em>${A(CHECKS[s.check]||s.check)}</em>`).join(', ')}.</p>

    <h3 class="gx-sub">Bursts</h3>
    <div class="gx-decgrid">${Object.entries(SPRAYS).map(([k,sp])=>`
      <div class="gx-dec"><span class="gx-art gx-burst">${sprayCard(k, brass, ink)}</span>
        <b>${A(sp[0]||k)}</b><u>${A(k)}${sp[1]?' &middot; '+sp[1]+' bits':''}</u></div>`).join('')}</div>

    <h3 class="gx-sub">Decorations</h3>
    <div class="gx-decgrid">${DECOR_KEYS.map(k=>`
      <div class="gx-dec"><span class="gx-art">${decorSVG(k)}</span>
        <b>${A(DECOR[k].nm)}</b><u>${styleKeys().filter(s=>decorSuits(k,s)).map(s=>A(STYLES[s].nm)).join(' &middot; ')}</u></div>`).join('')}</div>
  </section>

  <p class="gx-foot">
    Generated from Bureau <b>${A(APP_VERSION)}</b> by <b>web/js/guide.js</b>, out of the app that
    was running when you pressed the button.<br>Every tile above came through the desk&rsquo;s own
    <b>sampleTile()</b>, so this page cannot drift from what the desk actually draws.
  </p>
</div>`;
}

/* A burst drawn as its own bits, through `sprayMark()` — the same function
   Settings draws its samples with, which is the same `bitPath()` the canvas
   throws. One vocabulary, one picture: a second set of shapes agrees with the
   first until somebody edits one. */
function sprayCard(key, brass, ink){
  const bits = (SPRAYS[key] || [])[3] || [];
  if(!bits.length) return '<em class="gx-none">nothing</em>';
  const show = bits.length>1 ? bits.slice(0,5) : bits;
  return show.map(b=>`<img src="${sprayMark(b, brass, 34, ink)}" width="34" height="34" alt="">`).join('');
}

/* ---- the book's own frame ----------------------------------------------
   Quiet on purpose. Seven aesthetics are about to argue on one page and the
   binding must not join in: a cool grey with a faint blue bias, which is none
   of their grounds. */
const BOOKCSS = `
html,body{height:auto;overflow:visible;overscroll-behavior:auto}
body{margin:0;background:var(--gx-bg);color:var(--gx-tx);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  font-size:15px;line-height:1.55}
:root{--gx-bg:#F1F2F5;--gx-bg2:#FFF;--gx-edge:#DCDFE5;
  --gx-tx:#191C22;--gx-tx2:#5A616D;--gx-tx3:#8A919C;--gx-mark:#3D6B8E;
  --gx-sp:clamp(16px,3vw,34px);color-scheme:light dark}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --gx-bg:#141619;--gx-bg2:#1C1F24;--gx-edge:#2B2F36;
  --gx-tx:#E7E9ED;--gx-tx2:#9BA3AE;--gx-tx3:#6B7481;--gx-mark:#79A9CC}}
:root[data-theme="dark"]{--gx-bg:#141619;--gx-bg2:#1C1F24;--gx-edge:#2B2F36;
  --gx-tx:#E7E9ED;--gx-tx2:#9BA3AE;--gx-tx3:#6B7481;--gx-mark:#79A9CC}
.gx-wrap{max-width:1240px;margin:0 auto;padding:0 var(--gx-sp) 90px}
.gx-mast{padding:clamp(34px,6vw,72px) 0 clamp(20px,4vw,32px)}
.gx-mast h1{font-family:Georgia,"Times New Roman",serif;font-weight:600;
  font-size:clamp(32px,6vw,54px);line-height:1.04;letter-spacing:-.018em;margin:0 0 14px;
  text-wrap:balance;color:var(--gx-tx)}
.gx-mast p{max-width:66ch;color:var(--gx-tx2);margin:0}
.gx-meta{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;
  color:var(--gx-tx3);letter-spacing:.02em;margin-top:18px !important;font-variant-numeric:tabular-nums}
.gx-rule{height:1px;background:var(--gx-edge);border:0;margin:0}
.gx-nav{display:flex;flex-wrap:wrap;gap:6px 8px;padding:16px 0 2px}
.gx-nav a{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;letter-spacing:.02em;
  color:var(--gx-tx2);text-decoration:none;padding:4px 9px;border-radius:2px;
  border:1px solid var(--gx-edge);transition:.15s}
.gx-nav a:hover{color:var(--gx-mark);border-color:var(--gx-mark)}
.gx-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(146px,1fr));gap:10px;margin:24px 0 4px}
.gx-aeslink{display:block;border:1px solid var(--gx-edge);border-radius:3px;overflow:hidden;
  background:var(--gx-bg2);text-decoration:none;color:inherit;transition:.15s}
.gx-aeslink:hover{border-color:var(--gx-mark);transform:translateY(-1px)}
.gx-band{display:flex;height:34px}.gx-band i{flex:1}
.gx-lab{display:block;padding:9px 10px 11px}
.gx-lab b{display:block;font-family:Georgia,serif;font-weight:600;font-size:16px;color:var(--gx-tx)}
.gx-lab u{display:block;text-decoration:none;font-family:ui-monospace,Menlo,monospace;
  font-size:10.5px;color:var(--gx-tx3);letter-spacing:.03em;margin-top:2px}
.gx-sec{padding-top:clamp(34px,5vw,58px)}
.gx-aes{border-top:1px solid var(--gx-edge);margin-top:clamp(20px,3vw,34px)}
.gx-head{margin-bottom:16px}
.gx-head h2{font-family:Georgia,serif;font-weight:600;font-size:clamp(22px,3vw,29px);
  margin:0 0 6px;letter-spacing:-.012em;color:var(--gx-tx);text-wrap:balance}
.gx-head p{margin:0;color:var(--gx-tx2);max-width:70ch;font-size:14.5px}
.gx-sub{font-family:Georgia,serif;font-weight:600;font-size:17px;margin:26px 0 0;color:var(--gx-tx)}
.gx-note{color:var(--gx-tx2);font-size:13.5px;margin:8px 0 0;max-width:70ch}
.gx-scroll{overflow-x:auto;border:1px solid var(--gx-edge);border-radius:4px;background:var(--gx-bg2)}
table.gx-matrix{border-collapse:collapse;width:100%;margin:0}
table.gx-matrix th,table.gx-matrix td{padding:0;text-align:left;vertical-align:top;border:0}
table.gx-matrix tbody th.gx-rowhead{vertical-align:middle}
table.gx-matrix thead th{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;font-weight:500;
  color:var(--gx-tx3);padding:9px 13px 8px;border-bottom:1px solid var(--gx-edge);
  font-variant-numeric:tabular-nums;background:var(--gx-bg2)}
.gx-paper{background:var(--paper)}
.gx-rowhead{position:sticky;left:0;z-index:2;width:112px;min-width:112px;
  border-right:1px solid var(--gx-edge);border-bottom:1px solid var(--gx-edge);padding:15px 13px}
thead .gx-rowhead{background:var(--gx-bg2)}
.gx-rname{font-family:Georgia,serif;font-weight:600;font-size:14.5px;line-height:1.2;color:var(--ink)}
tbody td{border-bottom:1px solid var(--gx-edge);border-right:1px solid var(--gx-edge)}
tbody tr:last-child td,tbody tr:last-child .gx-rowhead{border-bottom:0}
.gx-cell{padding:15px 13px 13px;display:flex;flex-direction:column;gap:9px;align-items:flex-start}
.gx-cap{display:block;line-height:1.25;color:var(--ink)}
.gx-cap b{display:block;font-size:12.5px;font-weight:500}
.gx-cap u{display:block;text-decoration:none;font-family:ui-monospace,Menlo,monospace;
  font-size:10px;letter-spacing:.02em;color:var(--ink-3)}
.gx-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.gx-chip{display:flex;flex-direction:column;gap:4px;width:74px}
.gx-chip i{display:block;height:34px;border-radius:2px;border:1px solid rgba(128,128,128,.3)}
.gx-chip b{font-size:10.5px;font-weight:500;line-height:1.2;color:var(--gx-tx)}
.gx-chip u{font-family:ui-monospace,Menlo,monospace;font-size:9px;text-decoration:none;
  color:var(--gx-tx3);text-transform:uppercase;letter-spacing:.03em}
.gx-says{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:13px;font-size:12px;color:var(--gx-tx2)}
.gx-says span{display:flex;align-items:center;gap:6px}
.gx-says i{width:15px;height:15px;border-radius:2px;border:1px solid rgba(128,128,128,.3);
  display:inline-block;flex:0 0 auto}
.gx-says b{font-family:ui-monospace,Menlo,monospace;font-weight:500;font-size:11px;
  color:var(--gx-tx);letter-spacing:.02em}
.gx-plate{border:1px solid var(--gx-edge);border-radius:4px;padding:17px;margin-top:14px;
  background:var(--paper)}
.gx-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:15px}
.gx-tiles .gx-cell,.gx-taste .gx-cell{padding:0}
/* The taste row is eight different shapes, so it packs rather than gridding:
   a fixed column leaves a gap beside every narrow one, and a spine is one cell
   wide. Bottom-aligned, because they are standing on a desk. */
.gx-taste{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end}
.gx-type p{margin:0 0 8px;color:var(--ink)}
.gx-type .gx-serif{font-size:21px;line-height:1.3}
.gx-type .gx-sans{font-size:15px}
.gx-type .gx-mono{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;color:var(--ink-3);
  margin-top:12px;line-height:1.6;word-break:break-all}
.gx-boxes{display:flex;flex-wrap:wrap;gap:16px;--k:var(--brass)}
.gx-box{display:flex;flex-direction:column;gap:8px;align-items:center;width:88px}
.gx-pair{display:flex;gap:8px}
.gx-box small{font-size:11px;color:var(--ink-2)}
.gx-decgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(134px,1fr));gap:12px;margin-top:14px}
.gx-dec{border:1px solid var(--gx-edge);border-radius:3px;background:var(--gx-bg2);
  padding:13px 12px 11px;display:flex;flex-direction:column;gap:9px}
.gx-art{min-height:70px;display:grid;place-items:center;color:#8A6A3C}
.gx-art svg{max-height:70px;max-width:100%;width:auto}
/* A mix throws eight shapes and confetti three, so the row wraps rather than
   running out of the card it is drawn in. */
.gx-burst{display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;
  align-content:center;padding:4px 0}
.gx-burst img{display:block}
.gx-dec b{font-size:12.5px;font-weight:500;color:var(--gx-tx)}
.gx-dec u{font-family:ui-monospace,Menlo,monospace;font-size:9.5px;text-decoration:none;
  color:var(--gx-tx3);line-height:1.4;display:block}
.gx-none{color:var(--gx-tx3);font-size:12px}
.gx-tokens{margin-top:18px;border:1px solid var(--gx-edge);border-radius:4px;background:var(--gx-bg2)}
.gx-tokens summary{padding:10px 14px;cursor:pointer;font-size:13px;color:var(--gx-tx2)}
.gx-toks{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px;padding:0 14px 14px}
.gx-tok{display:flex;align-items:center;gap:7px;font-size:11px;min-width:0}
.gx-tok i{width:14px;height:14px;border-radius:2px;flex:0 0 auto;border:1px solid rgba(128,128,128,.3)}
.gx-tok b{font-family:ui-monospace,Menlo,monospace;font-weight:500;color:var(--gx-tx)}
.gx-tok u{text-decoration:none;color:var(--gx-tx3);font-family:ui-monospace,Menlo,monospace;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gx-foot{margin-top:clamp(44px,7vw,80px);padding-top:20px;border-top:1px solid var(--gx-edge);
  color:var(--gx-tx3);font-size:12.5px;font-family:ui-monospace,Menlo,monospace;line-height:1.75}
.gx-foot b{color:var(--gx-tx2);font-weight:500}

/* ---- the chrome specimens ----
   A panel is position:absolute against the frame and a menu is fixed, because
   in the app both are over a desk. Here they are exhibits, so each gets a box
   of its own to be absolute inside. Nothing else about them is changed: the
   dressing, the type, the spacing and the rules are the app's own. */
/* Most of the chrome declares no colour of its own: in the app it inherits
   from #frame, which sets color to var(--ink). There is no #frame here, so every
   panel title, section heading and menu row inherited the *book's* grey — dark
   on parchment and invisible on Starful Gothic's night, which is how the book
   found it. The wrapper stands in for the frame. */
.gx[data-sty]{color:var(--ink)}
.gx-chrome{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;margin-top:14px}
.gx-chrome.gx-stack{flex-direction:column;align-items:stretch}
.gx-stage{position:relative;border:1px solid var(--gx-edge);border-radius:4px;
  background:var(--wood);overflow:hidden;flex:0 0 auto}
.gx-tall{width:340px;height:640px}
.gx-bubble{width:280px;height:262px;padding:14px}
.gx-menu{width:230px;height:230px;padding:12px}
.gx-toast{width:280px;height:90px;display:grid;place-items:center}
.gx-cmd{width:330px;height:300px;padding:14px}
.gx-stage .panel{position:absolute}
.gx-bubble .panel.bubble,.gx-menu .ctxmenu,.gx-toast .toast,.gx-cmd .modal.cmd{position:relative}
.gx-bar,.gx-rail{border:1px solid var(--gx-edge);border-radius:4px;overflow:hidden;background:var(--wood)}
.gx-bar .gridbar{position:relative}
.gx-bits{display:flex;flex-wrap:wrap;gap:14px 18px;margin-top:16px;padding:16px;
  border:1px solid var(--gx-edge);border-radius:4px;background:var(--paper-2);color:var(--ink)}
.gx-bit{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
/* align-items:flex-start on the bit shrinks its control to min-content, and a
   grid of auto-fill columns at min-content is one column, which is how every
   swatch row in here stacked into a stripe. (No backticks in this block: it is
   a template literal, and one would end it.) */
.gx-bit.gx-wide{flex:1 1 100%;align-items:stretch}
.gx-bit small{font-family:ui-monospace,Menlo,monospace;font-size:10px;color:var(--ink-3)}
@media (prefers-reduced-motion:reduce){*{animation:none !important;transition:none !important}}
`;

/* The whole book, as one document. Bureau's own stylesheets first, verbatim,
   then every per-aesthetic chrome rule again on a wrapper, then the binding —
   in that order, because the binding has to undo two things the app's
   stylesheet says about `body` and a reset before the thing it resets is a
   reset of nothing. */
function guideDoc(){
  const body = guideBody();
  const shell = document.querySelector('svg[width="0"]');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bureau Specimen Book</title>
<style>
/* ===== Bureau's own stylesheets, as this browser parsed them ===== */
${liveCSS()}
/* ===== and every per-aesthetic chrome rule again, on a wrapper ===== */
${chromePatch()}
/* ===== the book the specimens are printed in ===== */
${BOOKCSS}
</style></head><body>
${shell ? shell.outerHTML : ''}
${body}
</body></html>`;
}

/* ---- showing it --------------------------------------------------------
   Its own host beside `#app` rather than a section of it, so `render()` leaves
   it alone — the same reason a panel lives on `#frame`. And an iframe rather
   than a slice of this document, because the book carries a global reset that
   would take the desk down with it: `body` here is parchment, full height and
   does not scroll, and all three are wrong for a page you read. Isolated, the
   same string is a file you can save. */
function openGuide(){
  closeGuide();
  const frame = $('#frame'); if(!frame) return;
  frame.insertAdjacentHTML('beforeend', `
    <div class="guidehost" id="guidehost">
      <div class="guidebar">
        <button class="iconbtn" data-act="closeguide" title="Back">${ic('chevL',17)}</button>
        <b>Specimen book</b>
        <i>every aesthetic, and everything it dresses</i>
        <button class="pill" data-act="saveguide" title="Save it as one HTML file">${ic('archive',13)} Save a copy</button>
      </div>
      <iframe class="guideframe" title="Bureau specimen book"></iframe>
    </div>`);
  /* Built after the host is on the page, and set as a property rather than an
     attribute: srcdoc as an attribute means escaping a megabyte of quotes, and
     a document that has to survive being written into its own markup is a
     document one stray quote away from a blank page. */
  const f = $('#guidehost .guideframe');
  if(f) f.srcdoc = guideDoc();
}
function closeGuide(){ const h=$('#guidehost'); if(h) h.remove(); }
const guideOpen = ()=> !!$('#guidehost');

/* Saving is the same string again rather than the iframe's own document: what
   is in the frame has been through a parse and a serialise, and a file that
   differs from what generated it is a file nobody can regenerate. */
function saveGuide(){
  const blob = new Blob([guideDoc()], {type:'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bureau-specimens-${APP_VERSION}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}

export { guideDoc, openGuide, closeGuide, guideOpen, saveGuide };
