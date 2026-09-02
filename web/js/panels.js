import { $, $$, esc, ic, uid, clamp, D, ROOT } from './util.js';
import { S, K, KINDS, KEYS, T, ATTRS, USER_ATTRS, FIELDS, fieldOf, OPS, ROLLS,
  WHENS, whenISO, RULE_MAX, rulesOf,
  SORTS, MANUAL, sortOf, FACES, SHAPES, READS, OPENINGS, openingOf,
  faceOf, layoutOf, shapeOf, readOf, byId, container, cfgOf, deskTitle,
  rootObj, containers, isContainer, isAncestor, childrenOf, has, kindHas,
  attrsOf, allTags, placeOf, deskList, deskOf, isDesk, spanOf, heldObjects,
  dev, takesTyping, genKindOf, answered, isLate,
  PRIOS, prioOf, prioName, REPEAT_UNITS, repeatOf, repeats, repeatSaid,
  relatedTo, backlinksTo, streak, goalPct,
  CALVIEWS, calViewOf, weekStartOf, showsWeekends, KNOBSIZES, knobSizeOf,
  TSIZES, textSizeOf, mediaTypeOf, isPicture, isMedia, isDecor,
  BINDINGS, bindingOf, panelOf, knobOf, borderOf, textureOf, slotRaw } from './model.js';
import { GRID, lay, boxOk, freeSpot, sizeOfKind, toPhoneSize } from './grid.js';
import { randomBoard, randomFront, hexOf, objColour, objSlots, palNow, OBJ0,
  famSlots, famAll, FAMS, styleKey, stockNow } from './look.js';
import { CLICKS, clickOf, gridTile, pending } from './tiles.js';
import { DECOR, DECOR_KEYS, decorOf, decorSVG, decorFor, decorRest } from './decor.js';
import { quickAdd, toast, drawerForTag } from './mutations.js';
import { openObj, openWriter, openRead, renderSheet } from './sheet.js';
import { render, settingsPanel, gridSizeField } from './views.js';
import { openingFor } from './motion.js';
import { save } from './persist.js';

/* ============================================================
   16 · overlays
   ============================================================ */
function overlayHTML(){
  return `
  <div class="scrim" id="cmdscrim"><div class="modal cmd">
    <input class="cmdinput" id="cmdinput" placeholder="Search objects, drawers, kinds…">
    <div class="cmdlist" id="cmdlist"></div></div></div>
  <div class="toast" id="toast"></div>
  <div class="ctxmenu" id="ctx"></div>
  ${/* where every animation that outlives its tile is drawn — see motion.js */''}
  <div id="fx"></div>
  <div id="sheetHost"></div>
  <input type="file" id="importer" accept="application/json,.json" class="hidden">
  <input type="file" id="imgpicker" accept="image/*,.svg,audio/*,video/*" class="hidden">`;
}

/* ============================================================
   16b · the panel — the only shape a menu has
   ============================================================
   There are no modals left. Everything that used to be a card in the middle of
   a dimmed screen is a panel down the right instead, because every one of them
   asks a question about the desk and every one of them used to hide it. The
   desk stays visible and stays live behind a panel: you can watch a colour, a
   type or a drawer's rule land while you are still choosing it.

   One at a time — opening another replaces it. `spec.body` is a function, not
   a string, so refreshPanel() can redraw the panel from state without every
   caller remembering how; `spec.key` names which panel is up, for the handful
   of places that need to know. The draft a form is building lives here rather
   than on the element, so redrawing can't lose it. */
const PANEL = {spec:null, draft:null, anchor:null};

function openPanel(spec){
  PANEL.spec = spec;
  PANEL.draft = spec.draft || null;
  PANEL.anchor = spec.anchor || null;
  let el = $('#panel'), fresh=false;
  if(!el){
    $('#frame').insertAdjacentHTML('beforeend',
      `<aside class="panel" id="panel"><div class="ptop"></div><div class="pbody"></div></aside>`);
    el = $('#panel'); fresh=true;
  }
  /* Rebuild the class list rather than toggling, so a panel that was a bubble
     doesn't stay one — but keep `open`, or replacing one panel with another
     would slide the whole thing out and back in. */
  const wasOpen = !fresh && el.classList.contains('open');
  el.className = 'panel' + (spec.wide?' wide':'') + (spec.fit?' fit':'') + (wasOpen?' open':'');
  el.removeAttribute('style');
  el.dataset.panel = spec.key || '';
  bubbleAt(el, PANEL.anchor);
  /* One frame late, or the transform has nothing to animate from. Always, not
     only when the element is fresh: `open` is what turns off the off-screen
     transform, and a panel that opens twice inside one frame — the second call
     rebuilding the class list before the first frame arrives — used to lose it
     and sit 101% off to the right of where it had measured itself to. */
  requestAnimationFrame(()=>{ const p=$('#panel'); if(p) p.classList.add('open'); });
  drawPanel(true);
  return el;
}

/* ---- a panel that is about one object comes up out of it ----------------
   Settings is about the desk and belongs down the edge of it. A panel about
   one tile is a different question — "this one, what about it" — and asking it
   from the far side of the screen makes you look away from the thing you are
   changing. So it arrives beside the tile instead, on whichever side has room,
   with a tail pointing back at it. It is the same panel: same header, same
   body, same handlers. Only where it sits and how it arrives change.

   Below the breakpoint there is no room either side, and it falls back to the
   edge panel — which is the right shape on a phone anyway. */
const BUBBLE_W = 340, BUBBLE_GAP = 14;
const anchorEl = a => !a ? null
  : a.nodeType ? a
  : $(`.grid .drawer[data-drawer="${a}"], .grid .drawer[data-row="${a}"]`);

function bubbleAt(el, anchor){
  const at = anchorEl(anchor);
  if(!at || !document.body.contains(at)) return false;
  const fr = $('#frame').getBoundingClientRect(), a = at.getBoundingClientRect();
  const w = Math.min(BUBBLE_W, fr.width-24);
  const side = (fr.right-a.right) >= w+BUBBLE_GAP ? 'right'
             : (a.left-fr.left)   >= w+BUBBLE_GAP ? 'left' : null;
  if(!side) return false;
  const maxH = Math.min(fr.height-32, 540);
  const top = clamp(a.top-fr.top-10, 16, Math.max(16, fr.height-maxH-16));
  el.classList.add('bubble', 'from-'+side);
  el.style.width = w+'px';
  el.style.maxHeight = maxH+'px';
  el.style.left = (side==='right' ? a.right-fr.left+BUBBLE_GAP
                                  : a.left-fr.left-BUBBLE_GAP-w)+'px';
  el.style.top = top+'px';
  // the tail points at the middle of the tile, kept inside the bubble's edges
  el.style.setProperty('--tail', clamp(a.top+a.height/2-fr.top-top, 20, maxH-20)+'px');
  return true;
}
/* The tiles move on every render, and the bubble is pinned to one of them.
   Called from render(); does nothing when no panel is up or it isn't a bubble. */
function repositionPanel(){
  const el=$('#panel');
  if(!el || !PANEL.anchor) return;
  el.classList.remove('bubble','from-left','from-right');
  el.removeAttribute('style');
  bubbleAt(el, PANEL.anchor);
}
function drawPanel(fresh){
  const s=PANEL.spec, el=$('#panel'); if(!s||!el) return;
  /* A panel that replaces another needs a way back to it, or splitting one
     long panel into six short ones just loses you. `spec.back` is a function;
     the chevron calls it, and the panel it opens replaces this one under the
     same key. See decision 66. */
  el.querySelector('.ptop').innerHTML =
    `${s.back?`<button class="iconbtn" data-act="panelback" title="Back">${ic('chevL',16)}</button>`:''}
     <div class="pt"><b>${s.title}</b>${s.sub?`<i>${s.sub}</i>`:''}</div>
     ${s.act||''}<button class="iconbtn" data-act="panelclose" title="Close">${ic('x',15)}</button>`;
  const b=el.querySelector('.pbody'), at=fresh?0:b.scrollTop;
  b.innerHTML = typeof s.body==='function' ? s.body() : s.body;
  b.scrollTop = at;
}
/* Redraw what is open, from state. Safe to call when nothing is. */
function refreshPanel(){ if($('#panel')) drawPanel(false); }
// the chevron in a section's head — whatever that panel said its way out was
function panelBack(){ const b=PANEL.spec && PANEL.spec.back; if(b) b(); }
const panelKey = ()=>{ const p=$('#panel'); return p ? p.dataset.panel : null; };
function closePanel(){
  const p=$('#panel'); if(p) p.remove();
  PANEL.spec=null; PANEL.draft=null; PANEL.anchor=null; pending.cell=null;
  S.openId=null;                 // nothing is being edited once the panel is gone
}
// what a form in a panel is building, before it is saved
const draft = ()=> PANEL.draft;

/* A small menu hung off the button that opened it, rather than a modal in the
   middle of the screen. It borrows the context menu's element and its styling,
   because a menu is a menu wherever it was summoned from. */
function openMenu(anchor, html){
  const el=$('#ctx');
  el.innerHTML=html;
  el.classList.add('open');                 // measurable only once it is shown
  const r=$('#frame').getBoundingClientRect(), a=anchor.getBoundingClientRect();
  el.style.left = clamp(a.right-r.left-el.offsetWidth, 6, Math.max(6, r.width-el.offsetWidth-6))+'px';
  el.style.top  = clamp(a.bottom-r.top+6,              6, Math.max(6, r.height-el.offsetHeight-6))+'px';
}

/* Every type falls in exactly one group. `scene` used to be listed under both
   Writing and Film, because the two filters were written independently. */
function pickGroups(){
  const g={Containers:[], Objects:[], Writing:[], Cooking:[], Film:[], Yours:[]};
  KEYS.forEach(k=>{
    // 'control' isn't offered — Bureau's own buttons are seeded, not made
    if(k==='control') return;
    const d=KINDS[k];
    if(S.kinds[k])                    g.Yours.push(k);
    else if(d.narrative)              g.Writing.push(k);
    else if(d.cooking)                g.Cooking.push(k);
    else if(d.film)                   g.Film.push(k);
    else if(kindHas(k,'container'))   g.Containers.push(k);
    else                              g.Objects.push(k);
  });
  const note={Containers:'hold other things', Objects:'hold nothing',
              Writing:'for a world you are making', Yours:'ones you made'};
  return Object.entries(g).filter(([,ks])=>ks.length)
    .map(([nm,ks])=>({nm, ks, note:note[nm]||''}));
}
/* A type is shown as the thing it makes, not as an icon standing in for it —
   the sample sits on the panel with nothing around it, and its name floats
   underneath, because a card drawn around a card reads as two objects.
   The dial in the corner opens the type editor — the right-click that used to
   be the only way in doesn't exist on a phone. */
function kindTile(k){
  const d=KINDS[k];
  return `<div class="kindtile" data-new="${k}" role="button" tabindex="0"
      style="--k:${hexOf(d.c)}" title="${esc(d.ds||'')}">
    <div class="kpv">${sampleTile(kindSample(k), 146, 82)}</div>
    <div class="krow"><span class="nm">${esc(d.nm)}</span>
      ${d.key?`<span class="kbd">${esc(d.key)}</span>`:''}</div>
    <button class="kedit" data-act="editkind" data-id="${k}" title="Edit ${esc(d.nm)}">${ic('sliders',12)}</button>
  </div>`;
}
/* ---- what this desk actually uses --------------------------------------
   The picker drew all forty types in six sections, every time, wherever you
   were — the most beautiful screen in the app and a catalogue. Things 3's
   restraint applies exactly here: lead with the handful you reach for, and put
   the rest behind one more press.

   Counted off `S.objects` rather than stored, because a frequency you keep is
   a frequency that goes stale and needs migrating. A container that says what
   it makes goes first whatever the count — you opened the picker *inside* it,
   which is a stronger signal than anything the tally knows. See decision 67. */
const HANDFUL = 5;
function oftenUsed(homeId){
  const n={};
  S.objects.forEach(o=>{ if(KINDS[o.kind] && o.kind!=='control') n[o.kind]=(n[o.kind]||0)+1; });
  const home = homeId && byId(homeId);
  const first = home && isContainer(home) && takesTyping(home) ? genKindOf(home) : null;
  const rest = Object.keys(n).filter(k=>k!==first).sort((a,b)=>n[b]-n[a]);
  return [first, ...rest].filter(Boolean).slice(0, HANDFUL);
}
function modalNewObject(){
  /* Where the thing will land, which decides what the picker leads with. The
     cell a hold sketched knows its container; failing that it is the board you
     are looking at. */
  const home = (pending.cell && pending.cell.parent) || (S.view==='drawer' && S.drawerId) || ROOT;
  const often = oftenUsed(home);
  const c = byId(home);
  const made = c && isContainer(c) && takesTyping(c) ? K(genKindOf(c)).nm.toLowerCase() : null;
  openPanel({
    key:'newobject', wide:true, title:'New object',
    sub:'Every type is drawn as the thing it makes',
    act:`<button class="pill" data-act="newkind">${ic('sparkle',13)} New type</button>`,
    body:()=> (often.length ? `
      <div class="section-h"><h2>Often</h2><div class="rule"></div><span class="n">${
        made ? 'this drawer makes a '+esc(made) : 'what this desk is made of'}</span></div>
      <div class="kindgrid">${often.map(kindTile).join('')}</div>
      <details class="pgroup allkinds"><summary>Every type</summary>${
        pickGroups().map(g=>`
          <div class="section-h"><h2>${g.nm}</h2><div class="rule"></div>${g.note?`<span class="n">${g.note}</span>`:''}</div>
          <div class="kindgrid">${g.ks.map(kindTile).join('')}</div>`).join('')}</details>`
    : pickGroups().map(g=>`
      <div class="section-h"><h2>${g.nm}</h2><div class="rule"></div>${g.note?`<span class="n">${g.note}</span>`:''}</div>
      <div class="kindgrid">${g.ks.map(kindTile).join('')}</div>`).join(''))
  });
}
/* ============================================================
   16b · the holding space
   ============================================================
   The drawer along the bottom of a phone opens onto this. It is where a thing
   waits while you carry it somewhere else — pick a tile up, drop it on the
   drawer, walk to another desk, open the drawer and put it down. Copy and
   paste, made of furniture rather than of a clipboard you cannot see.

   It is drawn as the things themselves, through the same `sampleTile()` the
   type picker uses, because a list of names is not what you are carrying. Each
   is a **twin** — `__held_n`, boxed at the origin — for the same reason
   `objectStage()` draws one: a second element carrying the real id is one the
   drag, `anchorEl()` and `tileOf()` could all pick up instead of the tile.

   The panel is `fit`: it is as tall as what is in it, so holding one thing
   shows you one thing and leaves the board behind it visible. A drawer with
   two things in it is not a screen. See decision 107. */
function heldTile(o, i){
  /* At the size its *type* starts at on the desk, not the box it had. A held
     thing has no box — HOLD is not a board, so there are no coordinates to
     keep — and the box it came off would be the wrong picture anyway: a phone
     task is eight cells by one, which scaled into a thumbnail is a sliver
     fourteen pixels tall. The type picker draws a type at its desk size for
     the same reason, and drawing these the same way is what makes a row of
     held things read as a row rather than as an argument between aspect
     ratios. */
  const [w,h]=sizeOfKind(o.kind, 'desk', ROOT), at={x:1, y:1, w, h};
  const twin=Object.assign({}, o, {id:'__held_'+i, desk:at, phone:at});
  /* A div rather than a button, for the same reason `.kindtile` is one: a tile
     renders its own `<button>`, and a button inside a button is a parse error
     the browser fixes by *unnesting* it — which silently drops the tile out of
     its own cell and takes the layout with it. */
  return `<div class="helditem" data-act="holdtake" data-id="${o.id}"
      role="button" tabindex="0" title="Put it down here">
    <span class="hpv">${sampleTile(twin, 112, 72)}</span>
    <span class="hnm">${esc(o.title||'Untitled')}</span>
  </div>`;
}
function holdPanel(){
  openPanel({
    key:'holding', fit:true, title:'Holding',
    sub:'Kept out of the desk until you put it down',
    body:()=>{
      const held=heldObjects();
      const here = (S.view==='drawer' && S.drawerId && byId(S.drawerId)) || null;
      const where = here ? esc(here.title||'this drawer') : 'the desk';
      if(!held.length) return `<p class="holdnote">Nothing in here. Pick a tile
        up, drop it on the drawer along the bottom, and it waits here until you
        open the drawer somewhere else and put it down.</p>`;
      return `<div class="heldgrid">${held.map(heldTile).join('')}</div>
        <p class="holdnote">Press one to put it down on ${where}.</p>
        ${held.length>1?`<button class="holdall" data-act="holdtakeall">${
          ic('arrowD',13)} Put all ${held.length} down here</button>`:''}`;
    }
  });
}

/* The eleven a thing may be painted in, plus whatever literal colour is in use.
   A swatch carries the *slot*, not the hex it happens to be showing — that is
   the whole point: what you pick follows the aesthetic. A literal is still allowed
   (the colour input below writes one) and gets a swatch of its own at the end,
   marked as belonging to nobody. */
function swatchRows(cur, flat){
  const one=([slot,nm])=>`<button data-col="${slot}" title="${nm}" class="${cur===slot?'on':''}"
    style="background:${hexOf(slot)}"></button>`;
  const all=objSlots();
  const custom = typeof cur==='string' && cur
    ? `<button data-col="${esc(cur)}" title="Custom — this one stays put" class="on custom"
        style="background:${esc(cur)}"></button>` : '';
  return `<div class="pickgrid sw">${all.map(one).join('')}${custom}</div>`;
}
/* ============================================================
   16c · object settings — the one place a thing is changed
   ============================================================
   There used to be three of these and they overlapped: an object panel, a
   drawer panel, a drawer *form* behind a "Name, rule and totals…" button, and
   the detail sheet, which was a fourth settings screen with the body stapled
   to the bottom of it. A container is an object (§1 of SYSTEM.md), so its
   settings are an object's settings with the container rows shown — the split
   was never in the model, only in the code.

   Everything applies as you touch it, so the thing changes while you watch;
   the body is a function, so the panel agrees with the change afterwards.

   Space: a list of one-of-many is a **select**, not thirty chips. Forty types
   and twenty shapes were four hundred pixels of chips you had to read like a
   wall; they are two rows now. The bulky many-of-many groups — traits, what a
   magic drawer collects — are behind a disclosure, closed until asked for. */
const prow=(label,body,note)=>`<div class="prow"><label>${label}${note?`<i>${note}</i>`:''}</label><div>${body}</div></div>`;
/* The marks on offer, in one list, because a type and an object are choosing
   from the same drawer of stamps — two lists would drift the first time one
   gained an icon. */
const MARKS = ['note','check','list','bulb','feather','book','star','flag','clock','target',
  'image','film','music','pot','clapper','help','folder','sparkle','trophy','archive',
  'tag','plus','edit','inbox','brush','eye','calendar','repeat','lock','gear'];
/* What "however it suits" has decided, for the one row where the default is a
   judgement rather than a value — otherwise the only way to find out which
   animation you are getting is to tap the thing and watch. */
// what a desk is called — home has no title of its own
const deskName = id => id===ROOT ? deskTitle() : ((byId(id)||{}).title || 'Untitled');
const OPENING_IS = o => openingOf(o)==='auto'
  ? 'right now, it '+OPENINGS[openingFor(o)].toLowerCase() : '';
const psel=(id,key,list,cur)=>`<select class="psel" data-oset="${id}:${key}">${
  list.map(([v,n])=>`<option value="${esc(String(v))}"${String(cur==null?'':cur)===String(v)?' selected':''}>${esc(n)}</option>`).join('')}</select>`;
const pfield=(id,key,cur,type,ph)=>`<input class="pfield"${type?` type="${type}"`:''}
  data-oset="${id}:${key}" value="${esc(cur==null?'':cur)}" placeholder="${esc(ph||'')}">`;
const pgroup=(label,body,open)=>`<details class="pgroup"${open?' open':''}><summary>${esc(label)}</summary>${body}</details>`;
/* ---- a slot row -------------------------------------------------------
   Five knobs, seven edges, five panellings, six grains: what you see is
   *this* aesthetic's answers, because a slot is a position and the position
   is what you are choosing. They re-dress when you switch, which is the whole
   system (decision 33).

   And underneath, closed, is every other aesthetic's, grouped by aesthetic —
   because sometimes you want *that* one, Golf 97's group box on a Victorian
   desk, and until now there was no way to say so. Picking from there writes a
   **pinned** value (`golf97/fielded`) that stops following the desk. It is
   deliberately the second control and not a longer first one: thirty-five
   knobs where there were five is the wall of chips decision 66 took out.

   One `<select>` and one disclosure rather than a select with optgroups in
   it, because the pin is a different *kind* of answer — "always this one",
   not "position three" — and a picker that hides that distinction inside a
   scroll is a picker that pins things by accident. See decision 98. */
function slotRow(label, id, fam, cur, note, prop){
  prop = prop || FAMS[fam].prop;
  const pinned = String(cur||'').includes('/');
  const mine = famSlots(fam);
  // a pinned value is not in this aesthetic's list, so the select would show
  // its first option as though nothing had been chosen — say so instead
  const head = pinned ? [['', '— from another aesthetic —']] : [];
  return prow(label,
    psel(id, prop, head.concat(mine), pinned ? '' : cur)
    + pgroup('From other aesthetics',
        `<select class="psel" data-oset="${id}:${prop}">
          <option value="">Follow this aesthetic</option>${
          famAll(fam).map(([nm, opts])=>`<optgroup label="${esc(nm)}">${
            opts.map(([v,n])=>`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(n)}</option>`).join('')
          }</optgroup>`).join('')}</select>`, pinned),
    note);
}
/* ---- eleven slots, and one colour of your own --------------------------
   A slot is a *position*, not a hue: store 11 and you get Victoria's claret or
   Aero's deep sea blue depending on where you are, and changing style repaints
   the desk without converting anything (decision 33). That is the right default
   and it is not always what someone wants.

   So under the eleven there is a **colour picker**, and what it writes is a
   literal hex. A literal is somebody insisting: it does not follow the aesthetic,
   it does not change when the aesthetic does, and it travels between them
   unchanged.
   The model has always allowed one — `objColour()` resolves either — and there
   was simply no way to type one in.

   It is a labelled row of its own rather than a twelfth swatch, and that is the
   point rather than a compromise: it does something *different* from the eleven
   above it, and a swatch that looked like theirs would say it did the same
   thing. See decision 76. */
const swatches=(id,key,cur)=>{
  const literal = typeof cur==='string' && cur ? cur : '';
  return `<div class="pickgrid sw">${objSlots().map(([slot,nm])=>
    `<button data-ocolour="${slot}" data-key="${key}" data-id="${id}" title="${esc(nm)}"
       class="${cur===slot?'on':''}" style="background:${hexOf(slot)}"></button>`).join('')}</div>
    <div class="ownrow">
      <label class="custcol${literal?' on':''}" title="It stays put when the aesthetic changes">
        <input type="color" data-ocolinput="${key}" data-id="${id}"
          value="${esc(literal || hexOf(cur==null?11:cur))}">
        <span>${literal ? 'Your own · '+esc(literal) : 'A colour of your own'}</span>
      </label>
      ${literal?`<button class="pill" data-ocolour="" data-key="${key}" data-id="${id}"
        title="Follow the aesthetic again">${ic('undo',12)} Back to the aesthetic</button>`:''}
    </div>
    ${literal?`<div class="mini" style="--k:var(--brass);margin-top:5px">A colour of your own is not one of the aesthetic's sixteen, so it stays exactly this when you change aesthetic.</div>`:''}`;
};
// forty types is a wall of chips and two rows of a select, grouped as the
// picker groups them
const typeOptions = cur => pickGroups().map(g=>
  `<optgroup label="${esc(g.nm)}">${g.ks.map(k=>
    `<option value="${k}"${cur===k?' selected':''}>${esc(KINDS[k].nm)}</option>`).join('')}</optgroup>`).join('');

/* ---- the stage: the thing itself, while you change it -------------------
   Every row below writes to the object and re-renders, so the desk behind the
   panel already agreed with what you were doing — as long as the tile happened
   to be on the screen, unobscured, and on the page you were looking at. Often
   it is none of the three: the panel covers it, a phone panel covers the whole
   board, and the object you opened the editor from may be a page away.

   So the object is drawn at the top of its own editor, through the same
   gridTile() the board uses, on the floor a video game puts a model on: a
   checkerboard scrolling diagonally, which reads as "this is the thing, not the
   place". The clone is what is drawn — a second element carrying the real id
   would be a duplicate the drag, the bubble anchor and tileOf() could all pick
   up — and both boxes are set from lay(), so the preview is this device's
   arrangement rather than a size invented for it. */
function objectStage(id){
  const o=byId(id); if(!o) return '';
  /* Its size, at the origin. The preview grid is only as wide as the tile, so a
     box carrying the object's real x and y is placed in columns that grid does
     not have — the tile lands in an implicit column off to the right and the
     stage draws an empty checkerboard. Same reason sampleObject() has always
     said {x:1,y:1}. */
  const b=lay(o), at={x:1, y:1, w:b.w, h:b.h};
  const twin=Object.assign({}, o, {id:'__stage', desk:at, phone:at});
  return `<div class="objstage"><i class="stagefloor"></i>
    <div class="stagetile">${sampleTile(twin, 300, 176)}</div></div>`;
}

/* ---- one panel, one question ------------------------------------------
   The object editor was nineteen rows in one column — name, type, where it
   lives, shape, colour, a wall of thirty marks, text size, edge, border, knob,
   knob colour, texture, board, click, opening, reading, every field its traits
   carry, milestones, a streak, tags, relations, traits, duplicate, delete.
   Everything an object can be asked was in it, which was the point, and it
   made changing a colour a scroll past everything an object can be asked. On a
   phone the panel covers the board, so that scroll is the whole screen.

   So the top of it is what you came for — the thing itself, its name, its type
   and where it lives — and the rest is a row of doors. Each one is the *same*
   panel under the same key, so a section replaces rather than stacks, and
   `spec.back` is the way out: the one thing a replaced panel never had, and the
   only real work in splitting these up. See decision 66. */
const OBJSECS = {
  look:   ['Look',      'palette',  'shape, colour, mark, edges'],
  does:   ['Behaviour', 'sliders',  'what it does when you touch it'],
  fields: ['Fields',    'list',     'what its traits carry'],
  collect:['Collects',  'sparkle',  'what fills it, and what it totals'],
  tags:   ['Tags and links','tag',  'what it is filed under, what it points at'],
  traits: ['Traits',    'gear',     'what it can do at all']
};
function objectPanel(id, sec){
  const o = id===ROOT ? null : byId(id);
  if(id!==ROOT && !o) return;
  S.openId = id;                    // what the field handlers in wire.js act on
  const s = OBJSECS[sec] ? sec : null;
  openPanel({key:'object:'+id, anchor:id===ROOT?null:id,
    title: s ? OBJSECS[s][0]
             : id===ROOT ? esc(deskTitle()) : esc(o.title||'Untitled'),
    sub: s ? (id===ROOT ? esc(deskTitle()) : esc(o.title||'Untitled'))
           : id===ROOT ? 'The desk itself' : esc(K(o.kind).nm)+' · editor',
    back: s ? (()=>objectPanel(id)) : null,
    body:()=>objectPanelBody(id, s)});
}
/* The gear in the bar opens the same panel for the container you are *inside*,
   whose tile is nowhere on screen — anchorEl() finds nothing and it falls back
   to the edge panel, which is right: that question is about the whole board. */
const drawerPanel = objectPanel;

function objectPanelBody(id, sec){
  const isRoot = id===ROOT;
  const o = isRoot ? null : byId(id);
  if(!isRoot && !o) return '';
  const at = s => sec===s;      // the top level is the doors, not everything at once
  /* Where a write lands and what a read sees. cfgOf() is deskCfg for the desk
     and the object itself for everything else, so one target serves both — the
     desk is a container without a tile, not a special case. */
  const d = isRoot ? rootObj() : o;
  const cont = isContainer(d), magic = has(d,'magic');
  const view = isRoot ? (cfgOf(id).layout||'grid') : layoutOf(d);
  const cal = cont && (view==='calendar' || faceOf(d)==='calendar');
  const img = isPicture(d);
  const spawns = has(d,'spawn') || clickOf(d)==='generate';
  const objectKinds = KEYS.filter(k=>!kindHas(k,'container') && k!=='control')
    .map(k=>[k, KINDS[k].nm]);

  const out=[];

  /* ---- what it is. The top level, and only there: a section is about one
     question and "what is this thing called" is not that question twice. ---- */
  if(!sec && !isRoot){
    out.push(objectStage(id));
    out.push(prow('Name', pfield(id,'title', o.title, '', 'Untitled')));
    out.push(prow('Type', `<select class="psel" data-oset="${id}:kind">${typeOptions(o.kind)}</select>`,
      'swaps its traits, keeps its data'));
    out.push(prow('Lives in', psel(id,'parent',
      moveTargets(id).map(c=>[c.id, c.id===ROOT?'The Desk':(c.title||'Untitled')]), o.parent||ROOT)));
  }
  /* …and the doors. Which ones there are depends on what the thing is: only a
     container collects, and the desk has no traits of its own to tick. */
  if(!sec){
    const doors = ['look','does','fields','collect','tags','traits'].filter(s=>
        (s!=='collect' || (cont && !isRoot))
     && (s!=='fields'  || !isRoot)
     && (s!=='tags'    || !isRoot)
     && (s!=='traits'  || !isRoot));
    out.push(`<div class="rows osecs">${doors.map(s=>{
      const [nm,icon,note]=OBJSECS[s];
      return `<div class="row" data-osec="${id}:${s}">
        <span class="kindmark">${ic(icon,13)}</span>
        <div class="body"><div class="title">${esc(nm)}</div><div class="snip">${esc(note)}</div></div>
        <span class="rowgo">${ic('chevR',13)}</span></div>`;}).join('')}</div>`);
  }

  if(at('look')) {
  /* ---- how it looks ---- */
  /* The thing itself, again. Every row in this section changes how the object
     looks, and the panel is covering the object — on a phone it covers the
     whole board — so a section about appearance with nothing to look at is the
     one place the stage is least optional. It was only on the top level, which
     is where you go to rename something. See decisions 51 and 97. */
  if(!isRoot) out.push(objectStage(id));
  /* A face is how a container draws itself on its parent's board, and the desk
     has no parent and no tile — asking it which front to wear is asking about
     a thing that does not exist. Everything below this line does apply to it:
     a desk is a container, and what it is made of is its own question. */
  if(!isRoot) out.push(cont
    ? prow('Face', psel(id,'face', Object.entries(FACES), faceOf(d)), 'on its parent’s board')
      + (faceOf(d)==='spine' || (d[dev()]||{}).w<=1
          ? slotRow('Binding', id, 'bn', slotRaw(d,'binding')||bindingOf(d),
              'how the book is bound — the spine is the one face that is a made object')
          : faceOf(d)==='front'
          ? slotRow('Panelling', id, 'pn', slotRaw(d,'panel')||panelOf(d),
              'how the front is worked — a moulding, lit from the upper left like the knob')
          : '')
    : prow('Shape', psel(id,'shape', Object.entries(SHAPES), shapeOf(d))));
  if(!isRoot) out.push(prow(cont?'Front':'Colour', swatches(id,'c', d.c)));
  /* The mark, per object. A type carries one and every object of that type wore
     it, which is right until two drawers of the same type sit side by side and
     the only thing telling them apart is a name too small to read. Follows the
     type until you pick, and the first chip is the way back. */
  if(!isRoot) out.push(prow('Mark', `<button class="pchip iconchip${d.ic?'':' on'}"
      data-oic="" data-id="${id}" title="Follow the ${esc(K(d.kind).nm.toLowerCase())} type">${ic('undo',15)}</button>`
    + MARKS.map(i=>`<button class="pchip iconchip${d.ic===i?' on':''}" data-oic="${i}" data-id="${id}"
        title="${esc(i)}">${ic(i,15)}</button>`).join(''),
    d.ic ? 'its own' : esc(K(d.kind).nm)));
  /* How big the words on its face are. A note you want to read from across the
     desk and a note that is a label are the same object at two sizes, and
     resizing the tile was the only answer the app had. */
  if(!isRoot) out.push(prow('Text size', psel(id,'tsize', TSIZES, String(textSizeOf(d)))));
  /* An object is paper, so it wears the same families a drawer front does
     minus the hardware: an edge, a grain, and what the sheet itself is made
     of. It was the one thing on the desk outside the aesthetic system — every
     note in Golf 97 looked exactly like every note in Victoria. See decision
     99. */
  if(!isRoot && !cont){
    out.push(slotRow('Border', id, 'bd', slotRaw(d,'border')||borderOf(d), 'a slot, named by the aesthetic'));
    out.push(slotRow('Stock', id, 'st', slotRaw(d,'stock')||stockNow(d), 'what the sheet is made of'));
    out.push(slotRow('Texture', id, 'tx', slotRaw(d,'texture')||textureOf(d), 'what is printed on it'));
    out.push(prow('Coloured stripe', psel(id,'edge',[['','None'],['1','Down the left']], d.edge?'1':'')));
  }
  if(!isRoot && cont){
    out.push(slotRow('Border', id, 'bd', slotRaw(d,'border')||borderOf(d), 'a slot, named by the aesthetic'));
    out.push(slotRow('Knob', id, 'kn', slotRaw(d,'knob')||knobOf(d)));
    out.push(prow('Knob size', psel(id,'knobsize', Object.entries(KNOBSIZES), knobSizeOf(d))
      + psel(id,'knobpos', [['centre','Centre'],['bottom','Bottom']], d.knobpos||'centre')));
    /* A knob is turned out of the same wood as the front, so by default that is
       what it is: the drawer's own colour, told apart by the light on it rather
       than by being a different colour. Lighter and darker are still there for
       a brass handle on a walnut front — and so is a colour outright. The first
       swatch is the way back to the front's own. */
    out.push(prow('Knob colour', psel(id,'knobtone',
        [['','Same as the front'],['light','Lighter'],['dark','Darker']], d.knobc?'':(d.knobtone||''))
      + `<div class="pickgrid sw" style="margin-top:5px">
        <button data-pknobc="" data-id="${id}" title="Follow the front" class="${d.knobc?'':'on'}"
          style="background:var(--paper);border-style:dashed"></button>${
        ['#F8F3E6','#A9793F','#2A241C','#C0563F','#3E7A6B','#5D7E99'].map(c=>
        `<button data-pknobc="${c}" data-id="${id}" class="${d.knobc===c?'on':''}" style="background:${c}"></button>`).join('')}</div>`));
    out.push(slotRow('Texture', id, 'tx', slotRaw(d,'texture')||textureOf(d),
      'what the surface is made of'));
  }
  /* What the board underneath is made of. The desk gets this too — it is a
     container like any other, and repainting *this* desk used to be impossible
     without repainting every one of them from the app's settings. */
  if(cont){
    out.push(prow('Board', `<div class="pickgrid sw">${[0,1,2,3,4,5].map(()=>randomBoard()).map(b=>{
        const [a,z]=b.split('|');
        return `<button data-pboard="${b}" data-id="${id}" style="background:linear-gradient(135deg,${a} 0 50%,${z} 50% 100%)"></button>`;}).join('')}
        <button data-pboard="" data-id="${id}" title="${isRoot?'Use the app’s board':'Use the desk’s board'}" class="${d.board?'':'on'}"
          style="background:var(--paper);border-style:dashed"></button></div>
      <input class="pslide" type="range" min="0" max="100" step="5"
        value="${Math.round((d.boardAlpha==null?1:d.boardAlpha)*100)}" data-palpha data-id="${id}">`,
      isRoot?'this desk only':''));
  }
  if(img) out.push(prow('Frame', psel(id,'frame',
    [['none','None'],['mount','Mount'],['gilt','Gilt'],['walnut','Walnut'],['black','Lacquer'],['polaroid','Instant']], d.frame||'none')));
  if(has(d,'button')) out.push(prow('Button shape', psel(id,'btnshape',
    [['rounded','Rounded'],['round','Round'],['square','Square']], d.btnshape||'rounded')));

  }

  if(at('does')) {
  /* ---- how it behaves ---- */
  if(cont){
    out.push(prow('Opens as', psel(id,'layout',
      [['grid','Grid'],['list','List'],['scroll','Scroll'],
       ...(isRoot?[]:[['book','Book'],['calendar','Calendar'],['timeline','Timeline']])], view)));
    // manual is a value, not the absence of one: a container has to be able to
    // refuse a type that sorts
    out.push(prow('Sorted by', psel(id,'sort',
      [[MANUAL,'As I arranged them'], ...Object.entries(SORTS).map(([k,[nm]])=>[k,nm])],
      sortOf(d)||MANUAL)));
    /* Not here any more: locking is one switch for everything, and it is the
       padlock in the bar. A lock is which mode you are in, not a fact about one
       board. See decision 74. */
    /* How fine this board's grid is. Every container gets the row, because
       every container opens onto a board — a desk you keep six big drawers on
       and a checklist you keep forty lines in do not want the same grain. See
       decision 60. */
    out.push(gridSizeField(id));
    /* A desk is somewhere you stand, so its editor is also where the carcass it
       is drawn in is asked about: the wood, and the drawer along the bottom of
       a phone that you tap to come out of and pull to make something. It is a
       piece of furniture like any other, so it is asked the same questions a
       drawer front is — and the keys are prefixed, because for every desk but
       home this object *is* a drawer with a knob and a texture of its own for
       the tile it draws on its parent's board. */
    if(isRoot || isDesk(id)){
      out.push(prow('The desk itself', `<div class="pickgrid sw">${
        ['#3A2C1E','#4A3524','#5A4632','#2E2A24','#3B3A36','#2A3038'].map(c=>
        `<button data-pwood="${c}" data-id="${id}" class="${d.wood===c?'on':''}" style="background:${c}"></button>`).join('')}
        <button data-pwood="" data-id="${id}" title="The app's own walnut" class="${d.wood?'':'on'}"
          style="background:var(--paper);border-style:dashed"></button></div>`,
        'the wood above the bar and below the board'));
      out.push(slotRow('Its knob', id, 'kn', d.railknob||'round', 'a phone', 'railknob'));
      out.push(slotRow('Its grain', id, 'tx', d.railtexture||'none', '', 'railtexture'));
      out.push(prow('Its drawer', psel(id,'railknobsize', Object.entries(KNOBSIZES), d.railknobsize||'sm')
        + `<div class="pickgrid sw" style="margin-top:5px">
          <button data-prailknobc="" data-id="${id}" title="Follow the wood" class="${d.railknobc?'':'on'}"
            style="background:var(--paper);border-style:dashed"></button>${
          ['#F8F3E6','#A9793F','#2A241C','#C0563F','#3E7A6B','#5D7E99'].map(c=>
          `<button data-prailknobc="${c}" data-id="${id}" class="${d.railknobc===c?'on':''}" style="background:${c}"></button>`).join('')}</div>`,
        'how big it is, and what colour'));
    }
    if(!isRoot) out.push(prow('Where it is kept', psel(id,'pin',
      [['','On the board it lives on'],['desk','A desk of its own']],
      placeOf(id)||''),
      'a desk leaves the board it was on'));
  } else if(!isRoot){
    out.push(prow('Clicking it', psel(id,'onclick', Object.entries(CLICKS), clickOf(d))));
    if(has(d,'text')) out.push(prow('Opens as', psel(id,'read', Object.entries(READS), readOf(d))));
  }
  /* How it opens — the movement, not the destination. Left alone it works
     itself out: a big container swings, a small one pulls out, a sheet of
     paper curls. This is here for when it has worked it out wrongly. */
  if(!isRoot) out.push(prow('Opening', psel(id,'opening', Object.entries(OPENINGS), openingOf(d)),
    esc(OPENING_IS(d))));
  if(cal){
    out.push(prow('Shows', psel(id,'calview', Object.entries(CALVIEWS), calViewOf(d))
      + psel(id,'weekStart',[['mon','Week starts Monday'],['sun','Week starts Sunday']], weekStartOf(d))
      + psel(id,'weekends',[['1','Weekends shown'],['','Weekends hidden']], showsWeekends(d)?'1':'')));
  }
  if(!isRoot && cont && takesTyping(d)){
    out.push(prow('Typing in it makes', psel(id,'genKind', objectKinds, genKindOf(d))));
    /* The add box costs a task-sized line of the front, so showing it is the
       opt-in and every line showing an item is the default; inside the drawer
       the box is there either way. See decisions 77 and 79. */
    out.push(prow('The add box', psel(id,'addbox',
      [['','Inside it only — every line shows an item'],['show','On its front too — it takes a line']],
      d.addbox==='show'?'show':''),
      'even shown, it goes by itself at two cells tall'));
  }
  if(!isRoot && !cont && spawns){
    out.push(prow('It makes', psel(id,'genKind', objectKinds, genKindOf(d))
      + psel(id,'genDir',[['down','Down'],['up','Up'],['left','Left'],['right','Right'],['random','Anywhere']], d.genDir||'down')));
  }

  }

  if(at('fields')) {
  /* ---- the fields its traits carry. Every one is gated on an attribute,
     never on a type's name — which is what lets an invented type get the right
     fields the moment it ticks the trait. ---- */
  if(!isRoot){
    const f=[];
    if(has(o,'date')) f.push(prow(has(o,'progress')?'Target date':'On', pfield(id,'due',o.due,'date'),
      has(o,'deadline') ? 'the day it sits on' : ''));
    /* The day it is *owed*, which is not the day it sits on. Only for something
       carrying the trait, and it says which of the two is deciding whether it is
       late, because two dates on one object is exactly the place to be explicit.
       See decision 62. */
    if(has(o,'deadline')) f.push(prow('Due by', pfield(id,'dead',o.dead,'date'),
      o.dead ? (isLate(o) ? 'late' : 'what makes it late') : 'not set — its date decides'));
    /* A last day, inclusive: a trip from the 4th to the 11th is still on the
       desk on the 11th. It needs a date to run from, so it says so rather than
       drawing a lone field that means nothing on its own. */
    if(has(o,'span')) f.push(prow('Runs until', pfield(id,'till',o.till,'date'),
      o.due ? (spanOf(o) ? `${spanOf(o).days} days` : 'must not be before the date it starts')
            : 'give it a date first'));
    /* ---- how it comes round -------------------------------------------
       A rule rather than one of four words, and the row that matters is
       **counted from**: "every week" and "a week after I finish it" are
       different promises, and only one of them survives a week you skipped.
       See decision 73. */
    if(has(o,'repeat')||has(o,'streak')){
      const r = repeatOf(o);
      const DOW=['S','M','T','W','T','F','S'];
      f.push(prow(has(o,'streak')?'Cadence':'Repeats',
        psel(id,'rep.on', [['','Never'],['1','Yes — on a rule']], r?'1':''),
        r ? esc(repeatSaid(o)) : ''));
      if(r){
        f.push(prow('Every',
          `<input class="pfield num" type="number" min="1" max="99" data-oset="${id}:rep.every" value="${r.every||1}">`
          + psel(id,'rep.unit', REPEAT_UNITS.map(([u,pl])=>[u, (r.every>1?pl:u)]), r.unit)));
        f.push(prow('Counted from', psel(id,'rep.from',
          [['date','The day it is due — a fixed schedule'],
           ['done','The day I finish it']], r.from||'date'),
          r.from==='done' ? 'skip a week and it does not pile up'
                          : 'the bins go out on Tuesday either way'));
        if(r.unit==='week' && r.from!=='done')
          f.push(prow('On', `<div class="pickgrid chips dowchips">${DOW.map((d,i)=>
            `<button class="fchip${(r.days||[]).includes(i)?' on':''}" data-repday="${i}" data-id="${id}"
               title="${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i]}">${d}</button>`).join('')}</div>`,
            (r.days||[]).length ? '' : 'the day it already falls on'));
        f.push(prow('Until', psel(id,'rep.endkind',
            [['','It just keeps going'],['after','A number of times'],['on','A date']],
            r.ends && r.ends.after ? 'after' : r.ends && r.ends.on ? 'on' : '')
          + (r.ends && r.ends.after
              ? `<input class="pfield num" type="number" min="1" max="999" data-oset="${id}:rep.after" value="${r.ends.after}">`
              : r.ends && r.ends.on
              ? pfield(id,'rep.on_date', r.ends.on, 'date') : ''),
          r.ends && r.ends.after ? `${r.made||0} made so far` : ''));
        f.push(prow('Running', psel(id,'rep.paused',
          [['','Making the next one'],['1','Paused — keeps its rule, stops making']], r.paused?'1':''),
          `<button class="pill" data-act="nextcopy" data-id="${id}">${ic('plus',12)} Make the next one now</button>`));
      }
    }
    if(has(o,'link')) f.push(prow('Link', pfield(id,'url',o.url,'','https://')));
    if(has(o,'location')) f.push(prow('Location', pfield(id,'loc',o.loc,'','Where')));
    if(has(o,'duration')) f.push(prow('Duration', pfield(id,'dur',o.dur,'number','minutes')));
    if(has(o,'price')) f.push(prow('Price', pfield(id,'price',o.price,'','12.50')));
    /* ---- how much it matters, 0 to 5 ----------------------------------
       A rank, not three words. Six buttons rather than a select, because the
       whole point is that you can see the scale — and each one says what it
       means, so "3" is a decision rather than a number you invented. This is
       *importance*; urgency is the deadline row above. See decision 72. */
    if(has(o,'priority')){
      const p = prioOf(o);
      f.push(prow('Priority',
        `<div class="priorow">
          <button class="priobtn${p==null?' on':''}" data-prio="" data-id="${id}" title="Unranked">–</button>
          ${PRIOS.map(([n,nm,ds])=>
            `<button class="priobtn p${n}${p===n?' on':''}" data-prio="${n}" data-id="${id}"
               title="${esc(nm)} — ${esc(ds)}">${n}</button>`).join('')}
        </div>`,
        p==null ? 'how much it matters, not how urgent' : esc(prioName(p))));
    }
    if(has(o,'count')) f.push(prow('Count',
      `<div class="counter"><button data-act="countdown" data-id="${id}">−</button><b>${o.count||0}</b><button data-act="countup" data-id="${id}">+</button></div>`));
    if(has(o,'rating')) f.push(prow('Rating',
      `<div class="stars">${[1,2,3,4,5].map(n=>`<button data-star="${id}:${n}" class="${(o.rating||0)>=n?'on':''}">${ic('star',17)}</button>`).join('')}</div>`));
    if(has(o,'answer')) f.push(prow(`Answer${answered(o)?'':' — unanswered'}`,
      `<textarea class="pfield tall" data-oset="${id}:answer" placeholder="What you worked out">${esc(o.answer||'')}</textarea>`));
    /* A decoration picks one of the ten that ship with the app, or a file of
       your own. The ten are drawn as themselves — a decoration *is* a picture,
       so a list of names would be the one picker in the app that made you
       imagine what you were choosing. See decision 86. */
    if(isDecor(o)){
      const own = o.media && o.media.src;
      const opt = k=>`<button class="decopt${!own&&decorOf(o)===k?' on':''}"
          data-decor="${id}:${k}" title="${esc(DECOR[k].nm)}">
          <span style="--c:${objColour(o)}">${decorSVG(k)}</span>
          <u>${esc(DECOR[k].nm)}</u></button>`;
      /* Led by the ones that belong here. A decoration is a made object rather
         than a slot — a mantel clock cannot be re-dressed into a gearwork — so
         it is tagged and ordered rather than converted, and the rest sit behind
         the same disclosure every slot family has. See decision 100. */
      const here = decorFor(styleKey()), rest = decorRest(styleKey());
      const showing = !own && rest.includes(decorOf(o));
      f.push(prow('Which one',
        `<div class="decpick">${here.map(opt).join('')}</div>`
        + (rest.length ? pgroup('From other aesthetics',
            `<div class="decpick">${rest.map(opt).join('')}</div>`, showing) : ''),
        own ? 'a file of your own is showing — remove it below to use one of these'
            : 'they take this object’s colour and the aesthetic’s'));
    }
    if(has(o,'media')){
      const mt=mediaTypeOf(o), src=o.media&&o.media.src;
      const noun = mt==='audio' ? 'sound' : mt==='video' ? 'video' : 'picture';
      const mark = mt==='audio' ? 'music' : mt==='video' ? 'film' : 'image';
      f.push(prow(isDecor(o)?'Or one of your own':'Media',
        (isDecor(o) ? '' : psel(id,'mtype',[['image','Image'],['video','Video'],['audio','Audio']], mt))
        + `<button class="pill" data-act="pickimage" data-id="${id}">${ic(mark,13)} ${
            src?`Replace the ${noun}`:(isDecor(o)?'Choose a PNG or SVG':`Choose a ${noun}`)}</button>`
        + (src
            ? `<button class="pill" data-act="dropimage" data-id="${id}">${ic('trash',13)} Remove</button>
               <div class="mediablock" style="--k:${K(o.kind).c}">${
                 mt==='audio' ? `<audio src="${esc(src)}" controls preload="metadata" style="width:100%"></audio>`
               : mt==='video' ? `<video src="${esc(src)}" controls preload="metadata" playsinline style="width:100%"></video>`
               : `<img class="tileimg" src="${esc(src)}" alt="">`}
                 <div class="cap">${esc(o.media.label||'')}</div></div>` : ''),
        isDecor(o) ? 'a cut-out PNG or an SVG stands best' : 'what it is for, then the file'));
    }
    if(has(o,'button')){
      const L=o.link||{};
      f.push(prow('Button', pfield(id,'linklabel',L.label,'','Open')
        + psel(id,'linktarget',[['','Nothing yet'],...containers().map(c=>[c.id, c.title||'Untitled'])], L.target||'')
        + pfield(id,'linkurl', /^https?:/.test(L.target||'')?L.target:'', '', '…or a link')));
    }
    if(f.length) out.push(`<div class="section-h"><h2>Fields</h2><div class="rule"></div></div>${f.join('')}`);
  }

  }

  if(at('fields')||at('tags')) {
  /* ---- milestones, a streak, tags and relations: all four were on the old
     detail sheet, and all four are settings about one object ---- */
  if(at('fields') && !isRoot && has(o,'progress')){
    out.push(`<div class="section-h"><h2>Milestones</h2><div class="rule"></div><span class="n">${goalPct(o)}%</span></div>
      <div class="bar" style="--k:${K(o.kind).c}"><i style="width:${goalPct(o)}%"></i></div>
      <div class="miles">${(o.milestones||[]).map((m,i)=>`
        <div class="mile${m.done?' done':''}">
          <span class="check${m.done?' on':''}" style="--k:${K(o.kind).c};width:16px;height:16px" data-mile="${id}:${i}">${ic('check',11)}</span>
          <input value="${esc(m.t)}" data-mtext="${i}">
          <input type="date" value="${m.d||''}" data-mdate="${i}">
          <button data-mdel="${i}">${ic('x',13)}</button>
        </div>`).join('')}</div>
      <button class="subtle-btn" data-act="addmile" data-id="${id}">${ic('plus',12)} Add milestone</button>`);
  }
  if(at('fields') && !isRoot && has(o,'streak')){
    out.push(`<div class="section-h"><h2>Last 28 days</h2><div class="rule"></div><span class="n">${streak(o)}-day streak</span></div>
      <div class="dots" style="--k:${K(o.kind).c};flex-wrap:wrap;gap:4px">
      ${[...Array(28)].map((_,i)=>{const ds=D.addISO(T,i-27);
        return `<i data-hday="${ds}" class="${(o.history||[]).includes(ds)?'on':''}${ds===T?' today':''}"></i>`}).join('')}</div>`);
  }
  if(at('tags') && !isRoot){
    out.push(`<div class="section-h"><h2>Tags</h2><div class="rule"></div></div>
      <div class="tagrow">${(o.tags||[]).map(t=>
        `<span class="realtag" data-tagdrawer="${esc(t)}" title="Open a drawer for #${esc(t)}">${esc(t)}<b data-untag="${esc(t)}">✕</b></span>`).join('')}
        <button class="add" data-act="addtag" data-id="${id}">+ tag</button></div>`);
    const rel=relatedTo(o), back=backlinksTo(id).filter(x=>x.id!==id);
    if(has(o,'relates') || rel.length || back.length){
      const chip=(x,rm)=>`<span class="relchip" style="--k:${objColour(x)}" data-openrel="${x.id}">
        ${ic(K(x.kind).ic,11)} ${esc(x.title||'Untitled')}${rm?`<b data-unrel="${id}:${x.id}" title="Unlink">✕</b>`:''}</span>`;
      out.push(`<div class="section-h"><h2>Related</h2><div class="rule"></div>
          <span class="n">${rel.length+back.length||''}</span></div>
        <div class="relrow">${rel.map(x=>chip(x,true)).join('')}
          ${has(o,'relates')?`<button class="add" data-act="addrel" data-id="${id}">+ link</button>`
            :`<span class="mini" style="--k:var(--brass);padding:0">Tick <b>Related</b> in Traits to link from here</span>`}</div>
        ${back.length?`<div class="statline" style="margin:10px 0 4px"><div class="s">Pointed at by</div></div>
          <div class="relrow">${back.map(x=>chip(x,false)).join('')}</div>`:''}`);
    }
  }

  }

  if(at('collect')) {
  /* ---- what a magic container collects, and what any container totals.
     This was the "Name, rule and totals…" form, which was a fourth panel for
     three rows. Behind a disclosure, because most containers never ask. ---- */
  if(cont && !isRoot){
    const fl=d.filter||{}, rl=d.roll||{};
    /* ---- the clauses ----------------------------------------------------
       One free clause used to be the whole of it, so "due after Monday and
       before Friday" could not be said. There are up to RULE_MAX now, ANDed,
       drawn as a row each — and one empty row on the end, which is how you add
       one without a button that has to know how many there are. Clearing a
       row's field removes that clause; the writer compacts the list.

       No OR. An OR needs groups, groups need a builder, and a builder is a
       query UI — which is the thing tags-becoming-drawers exists to avoid.
       See decision 63. */
    const rs = rulesOf(fl);
    const dateish = f => (fieldOf(f)||{}).type==='date';
    const clause = (r, i) => prow(i ? '…and also' : '…and matching',
      psel(id,`rule.${i}.f`, [['','Any field'],...Object.keys(FIELDS).map(a=>[a,FIELDS[a].nm])], r.f||'')
      + psel(id,`rule.${i}.op`, Object.entries(OPS), r.op||'is')
      + (dateish(r.f)
          ? psel(id,`rule.${i}.v`, [['','—'],...Object.entries(WHENS),
              ...(whenISO(r.v)&&!WHENS[r.v] ? [[r.v, r.v]] : [])], r.v||'')
            + pfield(id,`rule.${i}.v`, /^\d{4}-/.test(r.v||'')?r.v:'', 'date')
          : pfield(id,`rule.${i}.v`, r.v, '', 'value')),
      i ? '' : (rs.length>1 ? 'all of them have to be true' : ''));
    const clauses = rs.slice(0,RULE_MAX).map(clause).join('')
      + (rs.length<RULE_MAX ? clause({op:'is'}, rs.length) : '');
    /* What it can see. The default is its own desk, which on a desk that has
       never been split up is everything — so this only starts mattering the
       moment there is more than one place to look. */
    const sc = fl.scope||'desk';
    const scope = prow('Collects from', psel(id,'filter.scope',
        [['desk','This desk'],['all','Every desk'],['some','The desks I choose']], sc),
        sc==='desk' ? esc(deskName(deskOf(id))) : '')
      + (sc==='some' ? pgroup('Which desks', `<div>${deskList().map(k=>
          `<button class="pchip${(fl.scopeDesks||[]).includes(k.id)?' on':''}" data-fdesk="${k.id}" data-id="${id}">${
            esc(deskName(k.id))}</button>`).join('')}</div>`, true) : '');
    const body = (magic ? scope + `
      ${prow('Collects these types',
        `<div class="pickgrid chips">${KEYS.filter(k=>k!=='control').map(k=>
          `<button class="fchip${(fl.kinds||[]).includes(k)?' on':''}" data-fkind="${k}" data-id="${id}"
             style="--k:${hexOf(KINDS[k].c)}">${esc(KINDS[k].nm)}</button>`).join('')}</div>`)}
      ${clauses}
      ${prow('…and anything tagged', psel(id,'filter.tag',
        [['','Any tag'], ...allTags().map(([t])=>[t,'#'+t])], fl.tag||''))}
      ${/* An inbox is not a rule about a field — it is a rule about *where a
           thing is*: loose on a desk, not put away in anything. On its own it
           is the whole of what an inbox collects. */''}
      ${prow('Where they are', psel(id,'filter.loose',
        [['','Anywhere'],['1','Loose on a desk — not filed in anything']], fl.loose?'1':''),
        'an inbox is this and nothing else')}` : '')
      + prow('Shows a total', psel(id,'roll.fn',[['','Nothing'],...Object.entries(ROLLS)], rl.fn||'')
        + psel(id,'roll.f',[['','—'],...Object.keys(FIELDS).map(a=>[a,FIELDS[a].nm])], rl.f||''),
        'on every face it can wear')
      + prow('Front preview', psel(id,'pv',
        [['list','List'],['stack','Card stack'],['thumbs','Thumbnails'],['bars','Progress bars'],['big','Big number']], d.pv||'list'));
    out.push(body);
  }

  }

  if(at('traits')) {
  /* ---- traits. A many-of-many, so still chips — behind a disclosure, and
     the structural two stay out of it (see STRUCTURAL in model.js). ---- */
  if(!isRoot){
    const mine=attrsOf(o);
    out.push(pgroup('Traits', `
      <div class="mini" style="--k:var(--brass)">${o.attrs?'It has its own set.'
        :'It follows the '+esc(K(o.kind).nm.toLowerCase())+' type.'}</div>
      <div class="prow"><div>${USER_ATTRS.map(a=>
        `<button class="pchip${mine.includes(a)?' on':''}" data-attr="${a}" data-id="${id}" title="${esc(ATTRS[a].ds)}">${ATTRS[a].nm}</button>`).join('')}</div></div>
      ${o.attrs?`<button class="subtle-btn" data-act="attrreset" data-id="${id}">${ic('undo',12)} Follow the ${esc(K(o.kind).nm.toLowerCase())} type again</button>`:''}`));
  }

  }

  if(!sec && !isRoot) out.push(`<div class="pfoot">
    ${has(o,'text')?`<button class="pill" data-act="editthis" data-id="${id}">${ic('edit',13)} Write</button>`:''}
    ${has(o,'text')?`<button class="pill" data-act="copymd" data-id="${id}">${ic('archive',13)} Copy</button>`:''}
    <button class="pill" data-act="dupe" data-id="${id}">${ic('archive',13)} Duplicate</button>
    <button class="pill" data-act="delthis" data-id="${id}" style="margin-left:auto;color:#C0563F">${ic('trash',13)} Delete</button>
  </div>`);
  return out.join('');
}
/* Make a kind by choosing attributes. `from` is an object whose attributes seed
   the picker — "save these attributes as a new kind" from the detail sheet. */
/* Also the kind *editor*. `editKey` names an existing kind — built-in or one of
   yours — and saving writes an override into S.kinds, so a built-in can be
   changed without touching the source. */
/* A throwaway object, drawn through the same gridTile() the board uses, so a
   preview cannot drift from what you will actually get — if it renders wrong
   here it renders wrong there. It never enters S; only the renderer sees it. */
function sampleObject(spec){
  const a=(spec.attrs||['text']).slice();
  const [w,h]=spec.size||[4,4];
  return {
    id:spec.id||'__sample', kind:spec.kind||'note',
    title:spec.title||'Untitled',
    body:spec.body!=null?spec.body:'A line or two of whatever it holds, so you can see how it sits.',
    attrs:a, shape:spec.shape, face:spec.face,
    c:spec.c, parent:ROOT, tags:[], ord:0, created:T,
    /* Both layouts, or lay() reads the empty one on a phone-width window and
       ensureBox quietly fills it from the fallback kind's size instead — and
       the phone one goes through the same mapping a real object would, so the
       sample stays a picture of what you are actually about to get. */
    desk:{x:1,y:1,w,h},
    phone:(([pw,ph])=>({x:1,y:1,w:pw,h:ph}))(spec.phoneSize || toPhoneSize(w, h, a.includes('container'))),
    onclick:spec.onclick, spawnBy:spec.spawnBy, genKind:'task', genDir:'down',
    ...(a.includes('date')     ? {due:T} : {}),
    ...(a.includes('count')    ? {count:12} : {}),
    ...(a.includes('rating')   ? {rating:4} : {}),
    ...(a.includes('priority') ? {prio:'high'} : {}),
    ...(a.includes('price')    ? {price:'12.50'} : {}),
    ...(a.includes('duration') ? {dur:45} : {}),
    ...(a.includes('location') ? {loc:'The shed'} : {}),
    ...(a.includes('streak')   ? {history:[T]} : {history:[]}),
    ...(a.includes('progress') ? {milestones:[{t:'One',done:true},{t:'Two',done:false}]} : {milestones:[]}),
    done:false,
    link:{label:spec.title||'Press', target:''},
    knob:'round', border:'panel', texture:'none', layout:'list'
  };
}
/* A tile is drawn at desk scale and then shrunk to fit the box it is given,
   rather than drawn small. Type sizes inside a tile are in px, so building it
   at 11px a cell wrapped "Drawer" onto two lines — a miniature has to be the
   real thing seen from further away, or it isn't a preview of anything. */
const PV_CELL = 40;
function sampleTile(o, maxW, maxH){
  // a real object may not have been placed on this device yet, and a sample is
  // not the place to invent a box for one — lay() answers for both
  const b=o[dev()]||o.desk||o.phone||lay(o), w=b.w*PV_CELL, h=b.h*PV_CELL;
  const k=Math.min(maxW/w, maxH/h, 1);
  // the geometry is inline because it is computed here, not chosen
  return `<div class="pvscale" aria-hidden="true" style="width:${w*k}px;height:${h*k}px;overflow:hidden">
    <div style="width:${w}px;height:${h}px;transform:scale(${k});transform-origin:top left">
      <div class="grid g-desk pvgrid"
        style="--cols:${b.w};--rowh:${PV_CELL}px;--checker:${2*PV_CELL}px;
               grid-template-rows:repeat(${b.h},${PV_CELL}px);width:${w}px">
        ${gridTile(o,false,ROOT)}</div></div></div>`;
}
// One built-in or invented type, as an object of that type.
const kindSample = k => { const d=K(k); return sampleObject({
  id:'__k_'+k, kind:k, title:d.nm, attrs:d.attrs, shape:d.shape, face:d.face,
  c:d.c, size:d.size, phoneSize:d.phoneSize, onclick:d.onclick, spawnBy:d.spawnBy}); };

/* A live sample of the type being built, from the draft rather than a kind —
   the kind doesn't exist until you press Create. */
function previewObject(){
  const d=draft(); if(!d) return null;
  const nameEl=$('#knm');
  const cont = d.sort!=='object';
  return sampleObject({
    id:'__preview', kind:'note', title:(nameEl&&nameEl.value.trim())||'Untitled',
    attrs:d.attrs, c:d.c, size:d.size, phoneSize:d.phoneSize, onclick:d.onclick, spawnBy:d.spawnBy,
    shape: cont?undefined:(d.shape||'card'),
    face:  cont?(d.face||'front'):undefined
  });
}
function renderPreview(){
  const host=$('#kpreview'); if(!host) return;
  const o=previewObject(); if(!o) return;
  host.innerHTML=sampleTile(o, 230, 170);
}
/* Two sliders and a readout, for a size the presets don't happen to contain.
   `p` prefixes the data attributes so the same markup serves both grids — the
   Mac's 24 columns and the phone's 16, which are different coordinate spaces
   and were never one number. */
function sizeSliders(p, [w,h], cols){
  return `<div class="szrow">
    <span class="s">W</span><input class="pslide" type="range" min="1" max="${cols}" step="1" value="${w}" data-${p}szw>
    <span class="s">H</span><input class="pslide" type="range" min="1" max="20" step="1" value="${h}" data-${p}szh>
    <b id="${p}szout">${w} × ${h}</b></div>`;
}
function modalNewKind(from, editKey){
  const ex = editKey ? K(editKey) : null;
  const base = ex || (from ? K(from.kind) : null);
  const seedAttrs = ex ? (ex.attrs||['text']).slice() : from ? attrsOf(from).slice() : ['text'];
  const c = (base && base.c) || '#5F7A93';
  const isCont = seedAttrs.includes('container');
  const sort = isCont ? (seedAttrs.includes('magic') ? 'magic' : 'drawer') : 'object';
  const size = (base && base.size) || [4,4];
  const phoneSize = (base && base.phoneSize) || null;
  const gathersNow = (base && base.gathers) || '';
  const chip=(on,attrs,label,title)=>`<button class="pchip${on?' on':''}" ${attrs}${title?` title="${esc(title)}"`:''}>${label}</button>`;
  // the id lands on the *inner* div, because that is what the wiring rebuilds
  const row=(label,note,body,id,extra)=>`<div class="prow"${extra||''}>
    <label>${label}${note?`<i>${note}</i>`:''}</label><div${id?` id="${id}"`:''}>${body}</div></div>`;
  // traits that carry a typed value are worth separating: only these can be
  // sorted, filtered or totalled
  const plain = USER_ATTRS.filter(a=>!fieldOf(a));
  const bearing = USER_ATTRS.filter(a=>fieldOf(a));

  openPanel({
    key:'kindform', wide:true, title:ex?'Edit '+esc(ex.nm):'New type',
    sub:'A type is a name for a set of traits',
    draft:{c, attrs:seedAttrs, ic:(base&&base.ic)||'note', ds:'',
           fromId:from&&from.id, editKey:editKey||null,
           size, phoneSize, onclick:(base&&base.onclick)||'read',
           read:(base&&base.read)||'page',
           sort, shape:(base&&base.shape)||'card', face:(base&&base.face)||'front',
           sortBy:(base&&base.sort)||MANUAL,
           gathers:gathersNow, spawnBy:(base&&base.spawnBy)||'click'},
    body:`
  <div class="kbuild">
    <div class="kleft">
      <div class="pvwrap"><div id="kpreview"></div></div>
      <div class="field"><label>Name</label>
        <input id="knm" value="${ex?esc(ex.nm):(from?esc(K(from.kind).nm)+' variant':'')}" placeholder="Reading note"></div>
      <div class="field"><label>Description</label>
        <input id="kds" value="${ex?esc(ex.ds||''):''}" placeholder="What it's for, in a few words"></div>
      <div class="kacts">
        <button class="pill solid" data-act="savekind" data-id="${editKey||''}">${ex?'Save':'Create type'}</button>
        <button class="pill" data-act="cancel">Cancel</button>
        ${ex&&S.kinds[editKey]?`<button class="pill" data-act="delkind" data-id="${editKey}" style="color:#C0563F">Delete</button>`:''}
        ${ex&&!S.kinds[editKey]?`<button class="pill" data-act="resetkind" data-id="${editKey}">Reset to default</button>`:''}
      </div>
    </div>

    <div class="kright">
      ${row('What it is','',
        chip(sort==='object','data-ksort="object"','Object','Holds nothing')+
        chip(sort==='drawer','data-ksort="drawer"','Drawer','Holds what you file in it')+
        chip(sort==='magic','data-ksort="magic"','Magic drawer','Collects by rule; holds nothing'),
        'ksort')}
      ${row('Look','<span id="klookn">'+(sort==='object'?'shape':'face')+'</span>',
        (sort==='object'?Object.entries(SHAPES):Object.entries(FACES)).map(([v,n])=>
          chip(((base&&(sort==='object'?base.shape:base.face))||(sort==='object'?'card':'front'))===v,
               `data-klook="${v}"`, n)).join(''), 'klook')}
      ${row('Traits','what it can do',
        plain.map(a=>chip(seedAttrs.includes(a),`data-ka="${a}"`,ATTRS[a].nm,ATTRS[a].ds)).join(''), 'kattrs')}
      ${row('Fields','typed, so they sort and total',
        bearing.map(a=>chip(seedAttrs.includes(a),`data-ka="${a}"`,
          `${ATTRS[a].nm} <i>${fieldOf(a).type}</i>`,ATTRS[a].ds)).join(''), 'kfields')}
      <div class="mini" style="--k:var(--brass)" id="kattrsds">${
        esc(seedAttrs.map(a=>ATTRS[a]&&ATTRS[a].ds).filter(Boolean).join(' · '))||'Nothing yet'}</div>

      ${row('Clicking one','',
        Object.entries(CLICKS).map(([v,n])=>chip(((base&&base.onclick)||'read')===v,`data-kclick="${v}"`,n)).join(''),
        'kclick')}
      ${row('Opens as','how one reads',
        Object.entries(READS).map(([v,n])=>chip(((base&&base.read)||'page')===v,`data-kread="${v}"`,n)).join(''),
        'kread', ` id="kreadrow"${sort==='object'?'':' style="display:none"'}`)}
      ${row('Two of them make','dropped on each other',
        chip(!gathersNow,'data-kgather=""','Nothing')+
        KEYS.filter(k=>kindHas(k,'container')&&!kindHas(k,'magic')).map(k=>
          chip(gathersNow===k,`data-kgather="${k}"`,esc(KINDS[k].nm))).join(''),
        'kgather', ` id="kgatherrow"${sort==='object'?'':' style="display:none"'}`)}
      ${row('It spawns','',
        chip(((base&&base.spawnBy)||'click')==='click','data-kspawn="click"','When pressed')+
        chip(((base&&base.spawnBy)||'click')==='type','data-kspawn="type"','As you type in it'),
        'kspawn', ` id="kspawnrow"${seedAttrs.includes('spawn')?'':' style="display:none"'}`)}
      ${/* a container's contents have a default order, like everything else a
           type decides. Manual is a real answer, and the one a drawer gives. */''}
      ${row('Contents sorted by','one of these can still be set per drawer',
        `<select class="psel" data-ksort2>${[[MANUAL,'As they were arranged'],
          ...Object.entries(SORTS).map(([k,[nm]])=>[k,nm])].map(([v,n])=>
          `<option value="${v}"${((base&&base.sort)||MANUAL)===v?' selected':''}>${esc(n)}</option>`).join('')}</select>`,
        'ksortby', ` id="ksortrow"${sort==='object'?' style="display:none"':''}`)}
      ${row('Starts at','on the Mac grid, 24 columns',
        [[1,1],[4,1],[6,1],[2,2],[4,4],[6,4],[6,6],[8,6],[12,8]].map(([w,h])=>
          chip(size.join('x')===w+'x'+h,`data-ksz="${w}x${h}"`,`${w}×${h}`)).join('')
        + sizeSliders('k', size, GRID.desk.cols), 'ksize')}
      ${row('On a phone','8 columns, and a cell about the same size',
        chip(!phoneSize,'data-kphauto=""','Work it out for me',
             'Objects go full width; containers keep the size they have')
        + sizeSliders('kp', phoneSize||toPhoneSize(size[0],size[1],isCont), GRID.phone.cols), 'kphone')}
      ${row('Colour','',
        `${swatchRows(c,true)}<label class="custcol"><input type="color" data-colinput value="${c}"><span>Custom</span></label>`,
        'dcol')}
      ${row('Mark','', MARKS.map(i=>
          `<button class="pchip iconchip${((base&&base.ic)||'note')===i?' on':''}" data-kic="${i}" title="${i}">${ic(i,15)}</button>`).join(''),
        'kicon')}
    </div>
  </div>`
  });
  renderPreview();
}
// Anywhere this object may legally go: any container that is not itself, and
// not inside itself — otherwise a drawer can swallow its own ancestor.
function moveTargets(objId){
  const o=byId(objId);
  return [rootObj()].concat(containers().filter(c=>c.id!==objId && !has(c,'magic') && !(o&&isAncestor(objId,c))));
}
function modalMove(objId){
  openPanel({key:'move', title:'Move to drawer',
    sub:'Filing by hand always wins over a drawer&rsquo;s rule',
    body:()=>`<div class="rows">${moveTargets(objId).map(d=>
      `<div class="row" data-moveto="${objId}:${d.id}" style="--k:${objColour(d)}"><span class="kindmark">${ic('folder',13)}</span>
        <div class="body"><div class="title">${esc(d.title)}</div><div class="snip">${childrenOf(d).length} objects</div></div></div>`).join('')}</div>`});
}

/* ============================================================
   16d · scheduling — the little calendar
   ============================================================
   Swiping a row right used to mean one thing: today. That is the commonest
   answer and it is not the only one, and a gesture that can only say one thing
   makes you open the editor for "tomorrow".

   So it opens this: the handful of answers worth a button, a month you can
   press a day on, and — for anything carrying the trait — the deadline, which
   is the *other* date and belongs beside the first one rather than three
   sections down a different panel. Things 3's when-popover, in Bureau's one
   menu shape. See decisions 62 and 78.

   It is a panel rather than a popup because it asks more than one question,
   and on a phone a panel comes up from the bottom where the thumb is. */
const WHENS_QUICK = [
  ['today',    'Today',        0],
  ['tomorrow', 'Tomorrow',     1],
  ['weekend',  'This weekend', null],
  ['week',     'Next week',    null],
  ['clear',    'No date',      null]
];
function quickISO(which){
  if(which==='today') return T;
  if(which==='tomorrow') return D.addISO(T,1);
  if(which==='weekend'){                 // the coming Saturday, today if it is one
    const d=D.today(); const add=(6-d.getDay()+7)%7;
    return D.addISO(T, add);
  }
  if(which==='week'){                    // the coming Monday
    const d=D.today(); const add=((8-d.getDay())%7)||7;
    return D.addISO(T, add);
  }
  return null;
}
/* One month of squares, with what is already on each day marked — the same
   thing the calendar face draws, at the size a menu can hold. */
function schedMonth(o, anchorISO){
  const at = D.parse(anchorISO || o.due || T) || D.today();
  const first = new Date(at.getFullYear(), at.getMonth(), 1);
  const lead = (first.getDay()+6)%7;               // weeks start Monday here
  const start = D.add(first, -lead);
  const cells=[];
  for(let i=0;i<42;i++){
    const d=D.add(start,i), iso=D.iso(d);
    const out = d.getMonth()!==at.getMonth();
    const on = o.due===iso, dead = has(o,'deadline') && o.dead===iso;
    cells.push(`<button class="sday${out?' out':''}${iso===T?' today':''}${on?' on':''}${dead?' dead':''}"
      data-schedday="${o.id}:${iso}">${d.getDate()}</button>`);
  }
  return `<div class="schedmonth">
    <div class="schedhead">
      <button class="iconbtn" data-schedmon="${o.id}:${D.iso(new Date(at.getFullYear(), at.getMonth()-1, 1))}">${ic('chevL',14)}</button>
      <b>${at.toLocaleDateString(undefined,{month:'long', year:'numeric'})}</b>
      <button class="iconbtn" data-schedmon="${o.id}:${D.iso(new Date(at.getFullYear(), at.getMonth()+1, 1))}">${ic('chevR',14)}</button>
    </div>
    <div class="schedgrid">
      ${['M','T','W','T','F','S','S'].map(x=>`<i class="dow">${x}</i>`).join('')}
      ${cells.join('')}
    </div></div>`;
}
const SCHED = {month:null};
function schedulePanel(id){
  const o=byId(id); if(!o || !has(o,'date')) return;
  SCHED.month = null;
  S.openId = id;
  openPanel({key:'schedule:'+id, anchor:id,
    title:'When', sub:esc(o.title||'Untitled'),
    body:()=>{
      const ob=byId(id); if(!ob) return '';
      const deadline = has(ob,'deadline');
      return `<div class="schedquick">${WHENS_QUICK.map(([k,nm])=>{
          const iso=quickISO(k);
          return `<button class="pill${(k==='clear'?!ob.due:ob.due===iso)?' solid':''}"
            data-schedset="${id}:${k}">${nm}${iso?`<u>${esc(D.short(iso))}</u>`:''}</button>`;
        }).join('')}</div>
        ${schedMonth(ob, SCHED.month)}
        ${prow('On', pfield(id,'due', ob.due, 'date'), 'the day it sits on')}
        ${deadline
          ? prow('Due by', pfield(id,'dead', ob.dead, 'date'),
              ob.dead ? (isLate(ob)?'late':'what makes it late') : 'the day it is owed')
          : `<button class="subtle-btn" data-act="wantdeadline" data-id="${id}">${ic('plus',12)} Give it a deadline as well</button>
             <div class="mini" style="--k:var(--brass)">A deadline is a different fact from the day you have put it on — see decision 62.</div>`}
        ${has(ob,'span') ? prow('Runs until', pfield(id,'till', ob.till,'date')) : ''}
        ${has(ob,'repeat') ? `<div class="mini" style="--k:var(--brass);margin-top:10px">${
          repeats(ob) ? 'Repeats '+esc(repeatSaid(ob))+' — the rule is in the object editor.'
                      : 'Set it to repeat in the object editor.'}</div>` : ''}`;
    }});
}

/* ============================================================
   17 · command palette
   ============================================================ */
/* Which row is lit. ⌘K is summoned with the keyboard and typed into blind, and
   Enter used to run result *zero* — so the one list in the app you never touch
   with a mouse was the one list you had to. See decision 69. */
const CMD = {at:0};
function cmdMove(d){
  const n=(cmdList._res||[]).length; if(!n) return;
  CMD.at = (CMD.at + d + n) % n;
  $$('#cmdlist .cmdrow').forEach((r,i)=>r.classList.toggle('on', i===CMD.at));
  const on=$('#cmdlist .cmdrow.on');
  if(on && on.scrollIntoView) on.scrollIntoView({block:'nearest'});
}
const cmdAt = ()=> CMD.at;
function openCmd(){ $('#cmdscrim').classList.add('open'); $('#cmdinput').value=''; CMD.at=0; cmdList(''); setTimeout(()=>$('#cmdinput').focus(),30); }
function closeCmd(){ $('#cmdscrim').classList.remove('open'); if(document.activeElement&&document.activeElement.blur) document.activeElement.blur(); }
function cmdList(q){
  q=q.trim().toLowerCase();
  const res=[];
  // The desk is the only place. Settings is a sheet over it, not somewhere
  // you go; Today, Keeping Up and Everything were aggregations, so make a
  // magic drawer if you want one of those back.
  if(!q||'the desk'.includes(q))
    res.push({t:'The Desk',s:'view',c:'var(--brass)',i:'grid',go:()=>{S.view='desk';S.drawerId=null;}});
  if(!q||'settings'.includes(q))
    res.push({t:'Settings',s:'panel',c:'var(--brass)',i:'sliders',go:()=>settingsPanel()});
  /* The holding space, whenever there is anything in it. Without this a thing
     kept on a phone would be unreachable on a Mac, which has no rail to pull
     — and a drawer you cannot open is a drawer things go missing in. */
  if(heldObjects().length && (!q||'holding'.includes(q)))
    res.push({t:'Holding', s:`${heldObjects().length} kept`, c:'var(--brass)',
              i:'inbox', go:()=>holdPanel()});
  containers().forEach(d=>{ if(!q||(d.title||'').toLowerCase().includes(q)) res.push({t:d.title,s:'drawer',c:objColour(d),i:'folder',go:()=>{S.view='drawer';S.drawerId=d.id;}}); });
  /* Tags are how everything in Bureau is filed, and the one search in the app
     did not look at them. A tag match opens the magic drawer that collects it,
     which is what pressing a tag anywhere else already does — so searching for
     one and pressing return lands you in the same place. See decision 69. */
  if(q) allTags().forEach(([t,n])=>{ if(t.toLowerCase().includes(q))
    res.push({t:'#'+t, s:`${n} tagged`, c:'var(--brass)', i:'tag', go:()=>{ drawerForTag(t); }}); });
  S.objects.forEach(o=>{ if(q&&((o.title||'').toLowerCase().includes(q)||(o.body||'').toLowerCase().includes(q)
      ||(o.tags||[]).some(t=>t.toLowerCase().includes(q))))
    res.push({t:o.title||'Untitled',s:K(o.kind).nm,c:objColour(o),i:K(o.kind).ic,go:()=>openObj(o.id)}); });
  if(q) res.unshift({t:`Create task “${q}”`,s:'new',c:hexOf(KINDS.task.c),i:'plus',go:()=>{const o=quickAdd(q,'task');openObj(o.id);}});
  cmdList._res=res.slice(0,40);
  if(CMD.at >= cmdList._res.length) CMD.at=0;
  $('#cmdlist').innerHTML = cmdList._res.map((r,i)=>
    `<div class="cmdrow${i===CMD.at?' on':''}" data-cmd="${i}" style="--k:${r.c}"><span class="ic">${ic(r.i,13)}</span>${esc(r.t)}<span class="sub">${r.s}</span></div>`).join('')
    || `<div class="cmdrow">No matches</div>`;
}
function runCmd(i){ const r=(cmdList._res||[])[i]; if(!r) return; closeCmd(); r.go(); render(); renderSheet(); }

/* ============================================================
   18 · context menu
   ============================================================ */
/* Sweep the selection (or one object) into a brand-new drawer, made where they
   already are. The drawer takes the place of the first one, which is the least
   surprising spot for it to appear. */
function drawerFromSelection(id){
  const sel = S.sel.includes(id) ? S.sel.slice() : [id];
  const objs = sel.map(byId).filter(Boolean);
  if(!objs.length) return;
  const home = objs[0].parent || ROOT;
  const spot = lay(objs[0]);
  const d = {
    id:uid('d'), kind:'drawer', title:'New drawer', body:'', tags:[],
    parent:home, c:randomFront(), pv:'list', layout:'grid', filter:{}, board:randomBoard(),
    ord:0, created:T,
    desk:null, phone:null
  };
  S.objects.push(d);
  objs.forEach(o=>{ o.parent=d.id; o.desk=null; o.phone=null; });
  // now that its contents have moved out, the first object's old spot is free —
  // and the drawer arrives at the size a drawer starts at, not a hardcoded one
  const [dw,dh]=sizeOfKind('drawer', dev());
  d[dev()] = boxOk({x:spot.x,y:spot.y,w:dw,h:dh}, d.id, dev(), home)
    ? {x:spot.x,y:spot.y,w:dw,h:dh} : freeSpot(dw,dh,dev(),home);
  S.sel=[];
  save(); render();
  toast(`${objs.length} filed in a new drawer`);
  objectPanel(d.id);
}

function openCtx(x,y,id){
  const o=byId(id); if(!o) return;
  const el=$('#ctx');
  // If a selection is open and this object is part of it, the menu acts on all
  // of them — the same way a Finder context menu does.
  const sel = S.sel.includes(id) ? S.sel.slice() : [id];
  const many = sel.length>1;
  el.innerHTML=`
    ${many?`<div class="ctxhead">${sel.length} objects</div>` : ''}
    ${/* one panel for both — a container is an object with children */''}
    ${many?'' : `<button data-c="objset:${id}">${ic('brush',14)} Object editor</button>
      ${isContainer(o)
        ? `<button data-c="opendrawer:${id}">${ic('eye',14)} Open</button>
           <button data-c="pin:${id}">${ic('star',14)} ${isDesk(id)?'Make it a drawer again':'Make it a desk'}</button>`
        : `${isMedia(o)?`<button data-c="view:${id}">${ic(
               mediaTypeOf(o)==='audio'?'music':mediaTypeOf(o)==='video'?'film':'image',14)} ${
               o.media&&o.media.src
                 ? (mediaTypeOf(o)==='image'?'View picture':'Play it')
                 : (mediaTypeOf(o)==='audio'?'Add a sound'
                   :mediaTypeOf(o)==='video'?'Add a video':'Add a picture')}</button>`:''}
           ${has(o,'text')?`<button data-c="read:${id}">${ic('eye',14)} Read</button>
             <button data-c="write:${id}">${ic('edit',14)} Write…</button>`:''}`}`}
    ${(!many&&has(o,'date'))?`<button data-c="when:${id}">${ic('calendar',14)} When…</button>`:''}
    ${(!many&&repeats(o))?`<button data-c="nextcopy:${id}">${ic('repeat',14)} Make the next one</button>`:''}
    ${(!many&&(has(o,'check')||has(o,'streak')))?`<button data-c="done:${id}">${ic('check',14)} ${has(o,'streak')?'Mark today':'Complete'}</button>`:''}
    <button data-c="intodrawer:${id}">${ic('folder',14)} ${many?`Put these ${sel.length} in a new drawer`:'Put this in a new drawer'}</button>
    <button data-c="move:${id}">${ic('folder',14)} Move to drawer…</button>
    ${many?'':`<button data-c="hold:${id}">${ic('inbox',14)} Keep in the drawer</button>`}
    ${many?'':`<button data-c="today:${id}">${ic('calendar',14)} Schedule today</button>
    <button data-c="dupe:${id}">${ic('archive',14)} Duplicate</button>`}
    <div class="div"></div>
    <button class="danger" data-c="del:${id}">${ic('trash',14)} ${many?`Delete ${sel.length}`:'Delete'}</button>`;
  const r=$('#frame').getBoundingClientRect();
  el.classList.add('open');
  const w=el.offsetWidth,h=el.offsetHeight;
  el.style.left = clamp(x-r.left, 6, r.width-w-6)+'px';
  el.style.top  = clamp(y-r.top,  6, r.height-h-6)+'px';
}
const closeCtx = ()=> $('#ctx').classList.remove('open');

export { overlayHTML, openPanel, closePanel, refreshPanel, repositionPanel, panelKey, panelBack, draft,
  openMenu, modalNewObject, holdPanel, objectPanel, drawerPanel, modalNewKind,
  renderPreview, modalMove, sampleObject, sampleTile, kindSample,
  openCmd, closeCmd, cmdList, cmdMove, cmdAt, runCmd, drawerFromSelection, openCtx, closeCtx,
  schedulePanel, quickISO, SCHED };
