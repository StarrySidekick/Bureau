import { $, $$, esc, ic, uid, clamp, D, ROOT } from './util.js';
import { S, K, KINDS, KEYS, T, ATTRS, USER_ATTRS, FIELDS, fieldOf, OPS, ROLLS,
  SORTS, MANUAL, sortOf, FACES, SHAPES, READS, OPENINGS, openingOf,
  faceOf, layoutOf, shapeOf, readOf, byId, container, cfgOf, deskTitle,
  rootObj, containers, isContainer, isAncestor, childrenOf, has, kindHas,
  attrsOf, allTags, placeOf, deskList, deskOf, isDesk, spanOf,
  dev, takesTyping, genKindOf, answered,
  relatedTo, backlinksTo, streak, goalPct,
  CALVIEWS, calViewOf, weekStartOf, showsWeekends, KNOBSIZES, knobSizeOf } from './model.js';
import { GRID, lay, boxOk, freeSpot, sizeOfKind, toPhoneSize } from './grid.js';
import { randomBoard, randomFront, hexOf, objColour, objSlots, palNow, OBJ0, borderSlots } from './look.js';
import { CLICKS, clickOf, gridTile, pending } from './tiles.js';
import { quickAdd, toast } from './mutations.js';
import { openObj, openWriter, openRead, renderSheet } from './sheet.js';
import { render, settingsPanel } from './views.js';
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
  <input type="file" id="imgpicker" accept="image/*" class="hidden">`;
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
  el.className = 'panel' + (spec.wide?' wide':'') + (wasOpen?' open':'');
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
  el.querySelector('.ptop').innerHTML =
    `<div class="pt"><b>${s.title}</b>${s.sub?`<i>${s.sub}</i>`:''}</div>
     ${s.act||''}<button class="iconbtn" data-act="panelclose" title="Close">${ic('x',15)}</button>`;
  const b=el.querySelector('.pbody'), at=fresh?0:b.scrollTop;
  b.innerHTML = typeof s.body==='function' ? s.body() : s.body;
  b.scrollTop = at;
}
/* Redraw what is open, from state. Safe to call when nothing is. */
function refreshPanel(){ if($('#panel')) drawPanel(false); }
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
function modalNewObject(){
  openPanel({
    key:'newobject', wide:true, title:'New object',
    sub:'Every type is drawn as the thing it makes',
    act:`<button class="pill" data-act="newkind">${ic('sparkle',13)} New type</button>`,
    body:()=> pickGroups().map(g=>`
      <div class="section-h"><h2>${g.nm}</h2><div class="rule"></div>${g.note?`<span class="n">${g.note}</span>`:''}</div>
      <div class="kindgrid">${g.ks.map(kindTile).join('')}</div>`).join('')
  });
}
/* The eleven a thing may be painted in, plus whatever literal colour is in use.
   A swatch carries the *slot*, not the hex it happens to be showing — that is
   the whole point: what you pick follows the style. A literal is still allowed
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
const swatches=(id,key,cur)=>`<div class="pickgrid sw">${objSlots().map(([slot,nm])=>
  `<button data-ocolour="${slot}" data-key="${key}" data-id="${id}" title="${esc(nm)}"
     class="${cur===slot?'on':''}" style="background:${hexOf(slot)}"></button>`).join('')}</div>`;
// forty types is a wall of chips and two rows of a select, grouped as the
// picker groups them
const typeOptions = cur => pickGroups().map(g=>
  `<optgroup label="${esc(g.nm)}">${g.ks.map(k=>
    `<option value="${k}"${cur===k?' selected':''}>${esc(KINDS[k].nm)}</option>`).join('')}</optgroup>`).join('');

function objectPanel(id){
  const o = id===ROOT ? null : byId(id);
  if(id!==ROOT && !o) return;
  S.openId = id;                    // what the field handlers in wire.js act on
  openPanel({key:'object:'+id, anchor:id===ROOT?null:id,
    title: id===ROOT ? esc(deskTitle()) : esc(o.title||'Untitled'),
    sub: id===ROOT ? 'The desk itself' : esc(K(o.kind).nm),
    body:()=>objectPanelBody(id)});
}
/* The gear in the bar opens the same panel for the container you are *inside*,
   whose tile is nowhere on screen — anchorEl() finds nothing and it falls back
   to the edge panel, which is right: that question is about the whole board. */
const drawerPanel = objectPanel;

function objectPanelBody(id){
  const isRoot = id===ROOT;
  const o = isRoot ? null : byId(id);
  if(!isRoot && !o) return '';
  /* Where a write lands and what a read sees. cfgOf() is deskCfg for the desk
     and the object itself for everything else, so one target serves both — the
     desk is a container without a tile, not a special case. */
  const d = isRoot ? rootObj() : o;
  const cont = isContainer(d), magic = has(d,'magic');
  const view = isRoot ? (cfgOf(id).layout||'grid') : layoutOf(d);
  const cal = cont && (view==='calendar' || faceOf(d)==='calendar');
  const img = has(d,'media') && d.media && d.media.type==='image';
  const spawns = has(d,'spawn') || clickOf(d)==='generate';
  const objectKinds = KEYS.filter(k=>!kindHas(k,'container') && k!=='control')
    .map(k=>[k, KINDS[k].nm]);

  const out=[];

  /* ---- what it is ---- */
  if(!isRoot){
    out.push(prow('Name', pfield(id,'title', o.title, '', 'Untitled')));
    out.push(prow('Type', `<select class="psel" data-oset="${id}:kind">${typeOptions(o.kind)}</select>`,
      'swaps its traits, keeps its data'));
    out.push(prow('Lives in', psel(id,'parent',
      moveTargets(id).map(c=>[c.id, c.id===ROOT?'The Desk':(c.title||'Untitled')]), o.parent||ROOT)));
  }

  /* ---- how it looks ---- */
  out.push(cont
    ? prow('Face', psel(id,'face', Object.entries(FACES), faceOf(d)), 'on its parent’s board')
    : prow('Shape', psel(id,'shape', Object.entries(SHAPES), shapeOf(d))));
  if(!isRoot) out.push(prow(cont?'Front':'Colour', swatches(id,'c', d.c)));
  if(!isRoot && !cont)
    out.push(prow('Edge', psel(id,'edge',[['','None'],['1','Coloured stripe']], d.edge?'1':'')));
  if(!isRoot && cont){
    out.push(prow('Border', psel(id,'border', borderSlots(), d.border||'panel'), 'a slot, named by the style'));
    out.push(prow('Knob', psel(id,'knob',
      [['round','Round'],['diamond','Diamond'],['bar','Bar'],['ring','Ring'],['square','Square'],['orb','Orb']], d.knob||'round')
      + psel(id,'knobsize', Object.entries(KNOBSIZES), knobSizeOf(d))
      + psel(id,'knobpos', [['centre','Centre'],['bottom','Bottom']], d.knobpos||'centre')));
    out.push(prow('Knob colour', psel(id,'knobtone',[['light','Lighter'],['dark','Darker']], d.knobtone||'light')
      + `<div class="pickgrid sw" style="margin-top:5px">${
        ['#F8F3E6','#A9793F','#2A241C','#C0563F','#3E7A6B','#5D7E99'].map(c=>
        `<button data-pknobc="${c}" data-id="${id}" class="${d.knobc===c?'on':''}" style="background:${c}"></button>`).join('')}</div>`));
    out.push(prow('Texture', psel(id,'texture',
      [['none','None'],['dots','Dots'],['grid','Graph'],['weave','Weave'],['weave2','Wide weave'],
       ['check','Checker'],['rule','Ruled'],['stars','Stars'],['sheen','Sheen']], d.texture||'none')));
    out.push(prow('Board', `<div class="pickgrid sw">${[0,1,2,3,4,5].map(()=>randomBoard()).map(b=>{
        const [a,z]=b.split('|');
        return `<button data-pboard="${b}" data-id="${id}" style="background:linear-gradient(135deg,${a} 0 50%,${z} 50% 100%)"></button>`;}).join('')}
        <button data-pboard="" data-id="${id}" title="Use the desk's board" class="${d.board?'':'on'}"
          style="background:var(--paper);border-style:dashed"></button></div>
      <input class="pslide" type="range" min="0" max="100" step="5"
        value="${Math.round((d.boardAlpha==null?1:d.boardAlpha)*100)}" data-palpha data-id="${id}">`));
  }
  if(img) out.push(prow('Frame', psel(id,'frame',
    [['none','None'],['mount','Mount'],['gilt','Gilt'],['walnut','Walnut'],['black','Lacquer'],['polaroid','Instant']], d.frame||'none')));
  if(has(d,'button')) out.push(prow('Button shape', psel(id,'btnshape',
    [['rounded','Rounded'],['round','Round'],['square','Square']], d.btnshape||'rounded')));

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
    out.push(prow('Moving things', psel(id,'locked',[['','Movable'],['1','Locked']], d.locked?'1':'')));
    if(!isRoot) out.push(prow('Where it is kept', psel(id,'pin',
      [['','On the board it lives on'],['desk','A desk of its own'],['pin','On the shelf']],
      placeOf(id)||''),
      'a desk leaves the board it was on'));
    /* What a magic drawer can see. The default is its own desk, which for a
       desk that has never been split up is everything — so this row only
       starts mattering once there is more than one place to look. */
    if(has(d,'magic')){
      const sc=(d.filter||{}).scope||'desk';
      out.push(prow('Collects from', psel(id,'filter.scope',
        [['desk','This desk'],['all','Every desk'],['some','The desks I choose']], sc),
        sc==='desk' ? esc(deskName(deskOf(id))) : ''));
      if(sc==='some'){
        const on=((d.filter||{}).scopeDesks)||[];
        out.push(pgroup('Which desks', `<div>${deskList().map(k=>
          `<button class="pchip${on.includes(k.id)?' on':''}" data-fdesk="${k.id}" data-id="${id}">${
            esc(deskName(k.id))}</button>`).join('')}</div>`, true));
      }
    }
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
  if(!isRoot && cont && takesTyping(d))
    out.push(prow('Typing in it makes', psel(id,'genKind', objectKinds, genKindOf(d))));
  if(!isRoot && !cont && spawns){
    out.push(prow('It makes', psel(id,'genKind', objectKinds, genKindOf(d))
      + psel(id,'genDir',[['down','Down'],['up','Up'],['left','Left'],['right','Right'],['random','Anywhere']], d.genDir||'down')));
  }

  /* ---- the fields its traits carry. Every one is gated on an attribute,
     never on a type's name — which is what lets an invented type get the right
     fields the moment it ticks the trait. ---- */
  if(!isRoot){
    const f=[];
    if(has(o,'date')) f.push(prow(has(o,'progress')?'Target date':'Scheduled', pfield(id,'due',o.due,'date')));
    /* A last day, inclusive: a trip from the 4th to the 11th is still on the
       desk on the 11th. It needs a date to run from, so it says so rather than
       drawing a lone field that means nothing on its own. */
    if(has(o,'span')) f.push(prow('Runs until', pfield(id,'till',o.till,'date'),
      o.due ? (spanOf(o) ? `${spanOf(o).days} days` : 'must not be before the date it starts')
            : 'give it a date first'));
    if(has(o,'repeat')||has(o,'streak')) f.push(prow(has(o,'streak')?'Cadence':'Repeats',
      psel(id,'repeat',[['','Never'],['daily','Daily'],['weekdays','Weekdays'],['weekly','Weekly'],['monthly','Monthly']], o.repeat||'')));
    if(has(o,'link')) f.push(prow('Link', pfield(id,'url',o.url,'','https://')));
    if(has(o,'location')) f.push(prow('Location', pfield(id,'loc',o.loc,'','Where')));
    if(has(o,'duration')) f.push(prow('Duration', pfield(id,'dur',o.dur,'number','minutes')));
    if(has(o,'price')) f.push(prow('Price', pfield(id,'price',o.price,'','12.50')));
    if(has(o,'priority')) f.push(prow('Priority', psel(id,'prio',
      [['','—'],['low','Low'],['mid','Medium'],['high','High']], o.prio||'')));
    if(has(o,'count')) f.push(prow('Count',
      `<div class="counter"><button data-act="countdown" data-id="${id}">−</button><b>${o.count||0}</b><button data-act="countup" data-id="${id}">+</button></div>`));
    if(has(o,'rating')) f.push(prow('Rating',
      `<div class="stars">${[1,2,3,4,5].map(n=>`<button data-star="${id}:${n}" class="${(o.rating||0)>=n?'on':''}">${ic('star',17)}</button>`).join('')}</div>`));
    if(has(o,'answer')) f.push(prow(`Answer${answered(o)?'':' — unanswered'}`,
      `<textarea class="pfield tall" data-oset="${id}:answer" placeholder="What you worked out">${esc(o.answer||'')}</textarea>`));
    if(has(o,'media')) f.push(prow('Media', psel(id,'mtype',[['image','Image'],['video','Video'],['audio','Audio']], (o.media&&o.media.type)||'image')
      + `<button class="pill" data-act="pickimage" data-id="${id}">${ic('image',13)} ${
          o.media&&o.media.src?'Replace the picture':'Choose a picture'}</button>`
      + (o.media&&o.media.src
          ? `<div class="mediablock" style="--k:${K(o.kind).c}">
               <img class="tileimg" src="${esc(o.media.src)}" alt="">
               <div class="cap">${esc(o.media.label||'')}</div></div>` : '')));
    if(has(o,'button')){
      const L=o.link||{};
      f.push(prow('Button', pfield(id,'linklabel',L.label,'','Open')
        + psel(id,'linktarget',[['','Nothing yet'],...containers().map(c=>[c.id, c.title||'Untitled'])], L.target||'')
        + pfield(id,'linkurl', /^https?:/.test(L.target||'')?L.target:'', '', '…or a link')));
    }
    if(f.length) out.push(`<div class="section-h"><h2>Fields</h2><div class="rule"></div></div>${f.join('')}`);
  }

  /* ---- milestones, a streak, tags and relations: all four were on the old
     detail sheet, and all four are settings about one object ---- */
  if(!isRoot && has(o,'progress')){
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
  if(!isRoot && has(o,'streak')){
    out.push(`<div class="section-h"><h2>Last 28 days</h2><div class="rule"></div><span class="n">${streak(o)}-day streak</span></div>
      <div class="dots" style="--k:${K(o.kind).c};flex-wrap:wrap;gap:4px">
      ${[...Array(28)].map((_,i)=>{const ds=D.addISO(T,i-27);
        return `<i data-hday="${ds}" class="${(o.history||[]).includes(ds)?'on':''}${ds===T?' today':''}"></i>`}).join('')}</div>`);
  }
  if(!isRoot){
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

  /* ---- what a magic container collects, and what any container totals.
     This was the "Name, rule and totals…" form, which was a fourth panel for
     three rows. Behind a disclosure, because most containers never ask. ---- */
  if(cont && !isRoot){
    const fl=d.filter||{}, r=fl.rule||{}, rl=d.roll||{};
    const body = (magic ? `
      ${prow('Collects these types',
        `<div class="pickgrid chips">${KEYS.filter(k=>k!=='control').map(k=>
          `<button class="fchip${(fl.kinds||[]).includes(k)?' on':''}" data-fkind="${k}" data-id="${id}"
             style="--k:${hexOf(KINDS[k].c)}">${esc(KINDS[k].nm)}</button>`).join('')}</div>`)}
      ${prow('…and matching', psel(id,'rule.f',[['','Any field'],...Object.keys(FIELDS).map(a=>[a,FIELDS[a].nm])], r.f||'')
        + psel(id,'rule.op', Object.entries(OPS), r.op||'is')
        + pfield(id,'rule.v', r.v, '', 'value'))}
      ${prow('…and anything tagged', psel(id,'filter.tag',
        [['','Any tag'], ...allTags().map(([t])=>[t,'#'+t])], fl.tag||''))}
      ${/* An inbox is not a rule about a field — it is a rule about *where a
           thing is*: loose on a desk, not put away in anything. On its own it
           is the whole of what an inbox collects. */''}
      ${prow('Where they are', psel(id,'filter.loose',
        [['','Anywhere'],['1','Loose on a desk — not filed in anything']], fl.loose?'1':''),
        'an inbox is this and nothing else')}` : '')
      + prow('Shows a total', psel(id,'roll.fn',[['','Nothing'],...Object.entries(ROLLS)], rl.fn||'')
        + psel(id,'roll.f',[['','—'],...Object.keys(FIELDS).map(a=>[a,FIELDS[a].nm])], rl.f||''))
      + prow('Front preview', psel(id,'pv',
        [['list','List'],['stack','Card stack'],['thumbs','Thumbnails'],['bars','Progress bars'],['big','Big number']], d.pv||'list'));
    out.push(pgroup(magic?'What it collects':'Totals and preview', body));
  }

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

  if(!isRoot) out.push(`<div class="pfoot">
    ${has(o,'text')?`<button class="pill" data-act="editthis" data-id="${id}">${ic('edit',13)} Write</button>`:''}
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
  const b=o[dev()]||o.desk, w=b.w*PV_CELL, h=b.h*PV_CELL;
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
      ${row('Mark','',
        ['note','check','list','bulb','feather','book','star','flag','clock','target','image','film','music',
         'pot','clapper','help','folder','sparkle','trophy','archive','tag','plus','edit','inbox'].map(i=>
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
   17 · command palette
   ============================================================ */
function openCmd(){ $('#cmdscrim').classList.add('open'); $('#cmdinput').value=''; cmdList(''); setTimeout(()=>$('#cmdinput').focus(),30); }
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
  containers().forEach(d=>{ if(!q||(d.title||'').toLowerCase().includes(q)) res.push({t:d.title,s:'drawer',c:objColour(d),i:'folder',go:()=>{S.view='drawer';S.drawerId=d.id;}}); });
  S.objects.forEach(o=>{ if(q&&((o.title||'').toLowerCase().includes(q)||(o.body||'').toLowerCase().includes(q)))
    res.push({t:o.title||'Untitled',s:K(o.kind).nm,c:objColour(o),i:K(o.kind).ic,go:()=>openObj(o.id)}); });
  if(q) res.unshift({t:`Create task “${q}”`,s:'new',c:hexOf(KINDS.task.c),i:'plus',go:()=>{const o=quickAdd(q,'task');openObj(o.id);}});
  cmdList._res=res.slice(0,40);
  $('#cmdlist').innerHTML = cmdList._res.map((r,i)=>
    `<div class="cmdrow${i===0?' on':''}" data-cmd="${i}" style="--k:${r.c}"><span class="ic">${ic(r.i,13)}</span>${esc(r.t)}<span class="sub">${r.s}</span></div>`).join('')
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
    ${many?'' : `<button data-c="objset:${id}">${ic('sliders',14)} Object settings</button>
      ${isContainer(o)
        ? `<button data-c="opendrawer:${id}">${ic('eye',14)} Open</button>
           <button data-c="pin:${id}">${ic('star',14)} ${isDesk(id)?'Make it a drawer again':'Make it a desk'}</button>`
        : `${has(o,'text')?`<button data-c="read:${id}">${ic('eye',14)} Read</button>
             <button data-c="write:${id}">${ic('edit',14)} Write…</button>`:''}`}`}
    ${(!many&&(has(o,'check')||has(o,'streak')))?`<button data-c="done:${id}">${ic('check',14)} ${has(o,'streak')?'Mark today':'Complete'}</button>`:''}
    ${/* Pinning is a drag onto the shelf; taking it off again has to be
         somewhere, and the menu is where every other "about this one" lives. */''}
    ${many?'' : placeOf(id)==='pin'
      ? `<button data-c="unpin:${id}">${ic('star',14)} Take off the shelf</button>`
      : `<button data-c="topin:${id}">${ic('star',14)} Keep on the shelf</button>`}
    <button data-c="intodrawer:${id}">${ic('folder',14)} ${many?`Put these ${sel.length} in a new drawer`:'Put this in a new drawer'}</button>
    <button data-c="move:${id}">${ic('folder',14)} Move to drawer…</button>
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

export { overlayHTML, openPanel, closePanel, refreshPanel, repositionPanel, panelKey, draft,
  openMenu, modalNewObject, objectPanel, drawerPanel, modalNewKind,
  renderPreview, modalMove, sampleObject, sampleTile, kindSample,
  openCmd, closeCmd, cmdList, runCmd, drawerFromSelection, openCtx, closeCtx };
