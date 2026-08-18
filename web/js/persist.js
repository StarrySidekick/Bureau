import { D, uid, clamp, ROOT } from './util.js';
import { S, K, KINDS, KEYS, kindHas, has, byId, isContainer, refreshKinds, defaultLook, dev } from './model.js';
import { GRID, PHONE_GRIDS, overlaps, gridOf, freeSpot, sizeOfKind } from './grid.js';
import { toast, create, pushUndo } from './mutations.js';
import { render } from './views.js';
import { renderSheet } from './sheet.js';
import { closePanel } from './panels.js';

/* ============================================================
   19b · persistence — everything stays on this device
   ============================================================ */
/* The version **is the commit count**, as `0.NN`: the fifty-fifth commit is
   0.55 and the hundredth will be 1.00, which is the first honest claim to a
   1.0 this app will have made. It used to be a number chosen by hand, which
   meant it said nothing you could check.
   Bumped with the cache in web/sw.js — the two travel together, because "which
   Bureau is this phone running" is exactly the question you ask when a change
   appears not to have deployed. Shown in Settings, so it can be read off the
   device rather than guessed at. */
const APP_VERSION = '0.61';
const KEY = 'bureau.v1';
const install = {deferred:null};   // the browser's install prompt, when one is on offer
let saveTimer = null;

function snapshot(){
  // image bytes live in IndexedDB — keep them out of the JSON
  const objects = S.objects.map(o=>{
    if(!o.media || !o.media.src) return o;
    const m=Object.assign({},o.media); delete m.src;
    return Object.assign({},o,{media:m});
  });
  // a desk whose drawer has gone is dropped here rather than in every delete
  // path; in memory it survives so undo can bring the drawer back as a desk.
  // Home is always in the row and is not an object, so it is never filtered.
  const live = id => id===ROOT || S.objects.some(o=>o.id===id);
  const desks=(S.desks||[ROOT]).filter(live);
  const pins=(S.pins||[]).filter(live);
  return {v:DATA_V, savedAt:new Date().toISOString(), desks, pins,
          look:S.look, kinds:S.kinds, deskCfg:S.deskCfg, objects};
}
function writeNow(){
  try{ localStorage.setItem(KEY, JSON.stringify(snapshot())); }
  catch(e){ console.warn('Bureau could not save:', e.message); }
}
function save(){ clearTimeout(saveTimer); saveTimer = setTimeout(writeNow, 250); }
function storeSize(){ try{ return (localStorage.getItem(KEY)||'').length; }catch(e){ return 0; } }

/* v1 → v2: drawers carried only {w,h} and were laid out by flow order. Replay
   that same dense flow once to give every drawer real x/y coordinates, so an
   existing desk comes back looking exactly as its owner left it. */
function flowToCoords(drawers, device){
  const g=GRID[device], taken=[];
  const free=(box)=> box.x+box.w-1<=g.cols && !taken.some(t=>overlaps(box,t));
  drawers.forEach(d=>{
    const b=d[device]||{}, w=clamp(b.w||2,1,g.cols), h=clamp(b.h||1,1,40);
    if(b.x&&b.y){ taken.push({x:b.x,y:b.y,w,h}); d[device]={x:b.x,y:b.y,w,h}; return; }
    let placed=null;
    for(let y=1;y<400&&!placed;y++) for(let x=1;x<=g.cols-w+1;x++){
      const box={x,y,w,h};
      if(free(box)){ placed=box; break; }
    }
    placed=placed||{x:1,y:1,w,h};
    taken.push(placed); d[device]=placed;
  });
}
/* v2 → v3: drawers and objects were two arrays and a drawer could not live
   inside anything. Fold the drawers into the object list as kind 'drawer', and
   turn each object's `drawer` pointer into a `parent`. Ids are preserved, so
   anything that referenced an object by id still resolves. */
function foldDrawers(d){
  const drawers=(d.drawers||[]).map(x=>Object.assign({
    kind:'drawer', parent:ROOT, layout:'list', tags:[], body:'', ord:0,
    filter:{}, pv:'list'
  }, x, {title: x.title || x.nm || 'Untitled'}));
  drawers.forEach(x=>{ delete x.nm; });
  flowToCoords(drawers,'desk');
  flowToCoords(drawers,'phone');
  const known=new Set(drawers.map(x=>x.id));
  const objects=(d.objects||[]).map(o=>{
    const n=Object.assign({tags:[],history:[],milestones:[],ord:0,desk:null,phone:null},o);
    n.parent = (o.parent && (known.has(o.parent)||o.parent===ROOT)) ? o.parent
             : (known.has(o.drawer) ? o.drawer : ROOT);
    delete n.drawer;
    return n;
  });
  return drawers.concat(objects);
}
/* v3 → v4: the grid went from 6 columns of 104px rows to 12 square columns, so
   every cell is half the width it was. Doubling each box keeps a desk looking
   the way it was arranged — a tile twice as wide as tall stays twice as wide
   as tall — which matters more than matching the old pixel height exactly. */
function doubleBoxes(objects){
  objects.forEach(o=>['desk','phone'].forEach(dv=>{
    const b=o[dv]; if(!b || !b.w) return;
    o[dv]={x:(b.x-1)*2+1, y:(b.y-1)*2+1, w:b.w*2, h:b.h*2};
  }));
}
/* v9 → v10: the phone grid went from 16 columns to 8, so a phone cell is twice
   the size it was and every stored phone box is in the wrong coordinate space.
   Halving is the inverse of doubleBoxes() above and keeps each tile the same
   fraction of the screen it occupied — which is the thing the owner actually
   arranged.

   Rounding can push two neighbours into each other (7 and 8 both halve to 4),
   and `lay()` clamps rather than refuses, so a collision would render one tile
   on top of another with no way to tell them apart. So each container's
   children are re-placed in order: the first to claim a spot keeps it, and
   anything that lands on top is dropped into the nearest free box instead. */
function halvePhoneBoxes(objects){
  const half = n => Math.max(1, Math.round(n/2));
  const cols = 8;                       // GRID.phone.cols, written out: a
  const placed = {};                    // migration must not drift with it
  const overlap = (a,b)=> a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h;
  objects.forEach(o=>{
    const b=o.phone; if(!b || !b.w) return;
    const w=Math.min(cols, half(b.w)), h=half(b.h);
    let box={x:Math.min(half(b.x), cols-w+1), y:half(b.y), w, h};
    const home = placed[o.parent||ROOT] = placed[o.parent||ROOT] || [];
    if(home.some(t=>overlap(box,t))){
      outer: for(let y=1;y<400;y++) for(let x=1;x<=cols-w+1;x++){
        const spot={x,y,w,h};
        if(!home.some(t=>overlap(spot,t))){ box=spot; break outer; }
      }
    }
    home.push(box);
    o.phone=box;
  });
}
/* Repair, not migration: anything saved before ids were unique may hold
   collisions, and an old backup can reintroduce them at any time — so this
   runs on every load. Keep the first holder of an id and re-id the rest;
   children that pointed at the shared id stay with the first, which is the
   best that can be recovered. The smoke test guards this as `dupIds`. */
function dedupeIds(objects){
  const seen=new Set(); let fixed=0;
  objects.forEach(o=>{
    if(!o.id || seen.has(o.id)){ o.id=uid(isContainer(o)?'d':'o'); fixed++; }
    seen.add(o.id);
  });
  return fixed;
}
/* The phone grid has changed width three times — 16 to 8, then 8 to 10, then
   10 to 9 — and every time, each stored phone box is in the wrong coordinate
   space by the ratio. Scaling x and w by it keeps each tile the same fraction of the
   screen it occupied, which is the thing that was actually arranged.

   Rounding can push two neighbours into each other, and `lay()` clamps rather
   than refuses, so a collision would render one tile on top of another with no
   way to tell them apart. Each container's children are therefore re-placed in
   order: the first to claim a spot keeps it, and anything landing on top drops
   into the nearest free box instead. The column counts are passed in and
   written out at the call site — a migration must not drift with GRID. */
/* The rounding rule both rescales share.

   Rounding **half down**, and scaling the left *edge* rather than the 1-based
   column number. Both matter more than they look.

   Half up grew a two-cell drawer front into three every time the grid got finer
   (2 × 1.25 = 2.5), which broke the rack apart and then could not put it back.
   Half down keeps it two in both directions — 2 × 1.25 → 2 and 2 × 0.8 → 2 — so
   eight columns to ten and back is the arrangement you started with, and a
   full-width tile still maps exactly (8 × 1.25 = 10). Scaling the edge is what
   makes the gaps between tiles scale too: column 3 is two cells in from the
   left, not three. */
function rescaleBoxes(objects, from, cols){
  const r = cols/from;
  const half = v => Math.ceil(v - 0.5);
  const up = n => Math.max(1, half(n*r));
  const placed = {};
  const overlap = (a,b)=> a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h;
  objects.forEach(o=>{
    const b=o.phone; if(!b || !b.w) return;
    const w=Math.min(cols, up(b.w));
    const x=Math.max(1, half((b.x-1)*r) + 1);
    let box={x:Math.min(x, cols-w+1), y:Math.max(1,b.y), w, h:Math.max(1,b.h)};
    const home = placed[o.parent||ROOT] = placed[o.parent||ROOT] || [];
    if(home.some(t=>overlap(box,t))){
      outer: for(let y=1;y<400;y++) for(let x=1;x<=cols-w+1;x++){
        const spot={x, y, w, h:box.h};
        if(!home.some(t=>overlap(spot,t))){ box=spot; break outer; }
      }
    }
    home.push(box); o.phone=box;
  });
}
/* One board's worth: what changing *this* drawer's grain costs. The boxes on a
   board are measured in that board's columns and nowhere else, so nothing
   outside it is touched. */
function rescaleOneBoard(objects, cid, from, cols){
  rescaleBoxes(objects.filter(o=>(o.parent||ROOT)===cid), from, cols);
}
function rescalePhone(d, from, cols){
  rescaleBoxes(d.objects||[], from, cols);
  const up = n => Math.max(1, Math.ceil(n*(cols/from) - 0.5));
  Object.values(d.kinds||{}).forEach(k=>{
    if(Array.isArray(k.phoneSize) && k.phoneSize[0])
      k.phoneSize=[Math.min(cols, up(k.phoneSize[0])), Math.max(1, k.phoneSize[1])];
  });
}

/* Migrations, ordered and versioned. The snapshot's `v` records the last step
   already applied, so each step runs exactly once per desk — a current desk
   skips all of them, an old backup replays only what it is missing. These
   used to be ad-hoc per-load mutations inside adopt(); a new repair that
   should run once belongs here, as the next numbered step. */
const DATA_V = 20;
const MIGRATIONS = [
  // Drawers and objects were two arrays and a drawer could not live inside
  // anything. foldDrawers also replays the old dense flow to give v1 drawers
  // real x/y coordinates.
  {v:3, up(d){ if(Array.isArray(d.drawers)){ d.objects=foldDrawers(d); delete d.drawers; } }},
  // 6 columns -> 12 square columns: double every box.
  {v:4, up(d){ doubleBoxes(d.objects); }},
  // 12 -> 24, so a half-cell exists.
  {v:5, up(d){ doubleBoxes(d.objects); }},
  // `layout` used to describe the face as well as the arrangement.
  {v:6, up(d){ d.objects.forEach(o=>{
      if(['checklist','calendar','moodboard','timeline'].includes(o.layout)){
        o.face=o.layout;
        o.layout = o.face==='moodboard' ? 'grid' : 'list';
      }
    }); }},
  // Renames, and the retirement of control objects: New is a click on bare
  // grid, Arrange is press-and-hold, Settings is the gear in the bar.
  {v:7, up(d){
      d.objects.forEach(o=>{
        if(Array.isArray(o.attrs)) o.attrs=o.attrs
          .map(a=>a==='generator'||a==='field'?'spawn':a).filter(a=>a!=='control');
        if(o.kind==='record') o.kind='achievement';
        if(o.kind==='media')
          o.kind = (o.media&&o.media.type==='audio') ? 'audio'
                 : (o.media&&o.media.type==='video') ? 'video' : 'image';
      });
      d.objects = d.objects.filter(o=>!o.ctl && o.kind!=='control');
    }},
  // The Today / Keeping Up / Everything tabs are gone — they were hard-coded
  // aggregations, which is the job a magic drawer already does. Pinned drawers
  // replace them. Put the four that did the tabs' work on the bar if this desk
  // still has them, so an existing desk keeps its one-tap routes; a desk built
  // by hand starts with an empty bar and nothing but grid.
  {v:8, up(d){
      if(Array.isArray(d.pins)) return;
      const live=new Set((d.objects||[]).map(o=>o.id));
      d.pins=['d_today','d_in','d_keep','d_done'].filter(id=>live.has(id));
    }},
  // Opening as a book stopped being one of the things a click can do and
  // became how the object reads — one property with three settings, so that
  // "open it" and "how it looks once open" are two questions again.
  {v:9, up(d){
      const fix=x=>{ if(x && x.onclick==='book'){ x.onclick='read'; x.read=x.read||'book'; } };
      (d.objects||[]).forEach(fix);
      Object.values(d.kinds||{}).forEach(fix);
    }},
  // The phone grid halved, 16 columns to 8, so a cell is twice the size — see
  // decision 31. A kind's explicit phoneSize is in the same coordinate space
  // and halves with everything else.
  {v:10, up(d){
      halvePhoneBoxes(d.objects||[]);
      Object.values(d.kinds||{}).forEach(k=>{
        if(Array.isArray(k.phoneSize) && k.phoneSize[0])
          k.phoneSize=[Math.max(1,Math.min(8,Math.round(k.phoneSize[0]/2))),
                       Math.max(1,Math.round(k.phoneSize[1]/2))];
      });
    }},
  /* A calendar is a magic drawer now: it collects what has a date instead of
     holding what was filed in it, which is what lets one thing sit on two
     calendars and what makes a day a field rather than a container. Existing
     calendars keep everything — their contents move up to where the calendar
     itself lives, and the new rule collects them straight back onto the days
     they were already on. Boxes are cleared because {x,y,w,h} in the calendar's
     space means somewhere else in its parent's, usually on top of something. */
  {v:11, up(d){
      const objs=d.objects||[];
      objs.filter(o=>o.kind==='calendar').forEach(c=>{
        objs.forEach(o=>{
          if(o.parent!==c.id) return;
          o.parent=c.parent||ROOT; o.desk=null; o.phone=null;
        });
        // an object that overrode its type's attributes has to gain the trait too
        if(Array.isArray(c.attrs) && !c.attrs.includes('magic')) c.attrs=c.attrs.concat('magic');
        const f=c.filter||{};
        const ruled = f.rule || f.tag || f.due || f.done || (f.kinds&&f.kinds.length);
        if(!ruled) c.filter=Object.assign(f, {rule:{f:'date', op:'any'}});
      });
    }},
  /* A colour stopped being a hex and became a *slot* in the style's sixteen, so
     that changing style repaints the desk and changing back restores it exactly.
     Every hex a desk is holding came out of one of the five old palettes or off
     a built-in type, so those are named here — naming old things is what a
     migration is for — and each is mapped to the family slot it belonged to.
     A hex that is on neither list was typed into a colour input by hand, and
     stays a literal: the new scheme still allows one, and snapping somebody's
     deliberate choice to the nearest family would be the wrong repair.

     `palette` and `theme` go with it. A palette was a separate axis and is now
     part of the style; light-or-dark is the style's background. */
  {v:12, up(d){
      // family slots 5–15: Umber Fern Olive Teal Slate Steel Rust Ochre Clay Plum Stone
      const SLOT = {};
      const add = (slot, hexes) => hexes.split(' ').forEach(h=>SLOT[h.toUpperCase()]=slot);
      add(5,  '#6F5137 #7E5A38 #8A6A3C #5A4130 #7A6A55 #8C7A5E #4A4238 #3F3128 #5B5B68');
      add(6,  '#4A7C59 #3D6B4A #6E8B4E #3E6B63 #517F6F #6E9B7E #93B39A #B7C9AE');
      add(7,  '#5C7148 #6B7A3F #849453 #9DAE6B #5E6B47 #47533A');
      add(8,  '#3E7A6B #3FAE9C #63C6B0 #93D9C6 #7ED4A0');
      add(9,  '#3F5F7A #2F4A5E #37687A #4E8395 #2B6B99 #0E4B62 #4A5E7A #3A4048 #2A2E33');
      add(10, '#4A6E8F #5D7E99 #5F7A93 #6FA3AE #8FB9BE #4C89C8 #6FA6DB #9BC4EA #4B535D #5D6772 #707B87 #3B4A52 #4C5F68 #5E747E #718A94 #89A1A9');
      add(11, '#A55A3E #8C4A38 #C0563F #7A3B3C #9A4F42 #B4674C #C68A5E #D8A97A');
      add(12, '#9A7B2F #96652F #C9A66B #D6C9A8 #C2B08C #A69375 #18A6C4 #2FBCD8 #54CFE6 #8ADFEF #B7ECF5 #1B8FA8 #27788C');
      add(13, '#8A5A3F #A0703F #6B4A4A');
      add(14, '#7A6AA0 #4A4A55 #6C6C7A #7E7E8C');
      add(15, '#6E7075 #6B6152 #38383F #9A9AA6');
      const conv = x => {
        if(!x || typeof x.c!=='string') return;
        const s = SLOT[x.c.toUpperCase()];
        if(s!=null) x.c = s;
      };
      (d.objects||[]).forEach(conv);
      Object.values(d.kinds||{}).forEach(conv);
      if(d.deskCfg) conv(d.deskCfg);
      if(d.look){ delete d.look.palette; }
      delete d.theme;
    }},
  /* Modern became Pseudochromo when it stopped being "flat and quiet" and
     became a stated idea — near-monochrome, desaturated, sharp. The key is
     stored in `look.style` and keys the per-style slot overrides, so both move.
     A style key is one of ours, not user text: renaming it in a migration is
     the only place a desk can be told about it. */
  {v:13, up(d){
      if(!d.look) return;
      if(d.look.style==='modern') d.look.style='pseudochromo';
      const sl=d.look.slots;
      if(sl && sl.modern){ sl.pseudochromo = sl.pseudochromo || sl.modern; delete sl.modern; }
    }},
  /* Two renames and a retirement.
     `aqua` was the one border named after the style that owned it, back when a
     border belonged to a style rather than being a slot every style answers —
     it is `gloss` now, position four, and each style says what its own is.
     And a question stopped being ticked: it carries `answer` instead of
     `check`, because the point of keeping a question is the thing you worked
     out, and a tick only ever recorded that you had stopped thinking about it.
     A question that was ticked and never written up keeps its `done` — it is
     still in the archive, and inventing an answer for it would be a lie. */
  {v:14, up(d){
      (d.objects||[]).forEach(o=>{ if(o.border==='aqua') o.border='gloss'; });
      const swap = x => { if(!Array.isArray(x.attrs)) return;
        if(!x.attrs.includes('check')) return;
        x.attrs = x.attrs.filter(a=>a!=='check');
        if(!x.attrs.includes('answer')) x.attrs.push('answer'); };
      (d.objects||[]).filter(o=>o.kind==='question').forEach(swap);
      Object.entries(d.kinds||{}).forEach(([k,v])=>{ if(k==='question') swap(v); });
    }},
  /* Desks, and the master space they sit in.
     The bottom shelf used to be a list of favourites; it is the row of desks
     now. Nobody's existing pins ever claimed to be a desk, so this promotes
     none of them — both old shelves fold into the *home* desk's shelf, in the
     order they were in, and the row starts as home alone. Everything is where
     it was and looks how it looked; the difference is that there is now
     somewhere else to put things. Promoting a drawer is a deliberate act, and
     it should stay one. See decision 39. */
  {v:15, up(d){
      d.desks = [ROOT];
      d.deskCfg = Object.assign({layout:'grid', locked:false, sort:null}, d.deskCfg);
      d.deskCfg.shelf = [...(d.pinsTop||[]), ...(d.pins||[])];
      delete d.pins; delete d.pinsTop;
    }},
  /* One shelf, and a desk that is somewhere rather than something.
     The top shelf is gone: every per-desk shelf folds into one global list of
     pins, home first out of it because home is walked to and never pinned. And
     a drawer that had been promoted to a desk stops being a front on whatever
     board it was on — it *is* the place now — so its parent is remembered in
     `wasIn` and cleared, which is exactly what setPin() does from here on.
     See decisions 40 and 41. */
  {v:16, up(d){
      const objs=d.objects||[];
      const seen=new Set(), pins=[];
      const take=list=>(list||[]).forEach(id=>{ if(id!==ROOT && !seen.has(id)){ seen.add(id); pins.push(id); } });
      take(d.deskCfg && d.deskCfg.shelf);
      objs.forEach(o=>{ if(Array.isArray(o.shelf)) { take(o.shelf); delete o.shelf; } });
      if(d.deskCfg) delete d.deskCfg.shelf;
      d.pins = pins;
      (d.desks||[]).forEach(id=>{
        const o=objs.find(x=>x.id===id);
        if(!o || o.parent==null) return;
        o.wasIn=o.parent; o.parent=null; o.desk=null; o.phone=null;
      });
    }},
  /* The phone grid went from 8 columns to 10, so every stored phone box is in
     the wrong coordinate space by a quarter — scale x and w by 10/8 and keep
     each tile the same fraction of the screen it occupied, which is the thing
     that was actually arranged.
     Rows are left alone: y was already a continuous coordinate and nothing
     depended on how many of them fitted. Anything that ends up straddling a
     page break is re-placed by gridOfContainer() on the first render, which is
     the same repair it already does for a box that predates paging. */
  {v:17, up(d){ rescalePhone(d, 8, 10); }},
  /* An inbox collects; it does not hold.
     For one version `create()` routed anything made without a stated place
     *into* the nominated inbox, which meant a drawer quietly took what you
     made and filed your desk for you. It is a magic drawer now, with the one
     rule an inbox actually has — loose on a desk, not put away in anything —
     so a new object shows up in it while staying exactly where you made it.

     Whatever the old inbox was holding moves up to where the inbox itself
     lives, and the new rule collects it straight back: it was loose before it
     was filed there, and it is loose again. Boxes are cleared because {x,y,w,h}
     in the drawer's space means somewhere else in its parent's, usually on top
     of something — the same repair migration 11 made for calendars.
     See decision 45. */
  {v:18, up(d){
      const objs=d.objects||[];
      const id = d.inbox || 'd_in';
      const inbox = objs.find(o=>o.id===id);
      delete d.inbox;
      if(!inbox) return;
      objs.forEach(o=>{
        if(o.parent!==inbox.id) return;
        o.parent = inbox.parent||ROOT; o.desk=null; o.phone=null;
      });
      if(inbox.kind==='drawer') inbox.kind='magic';
      // an object that overrode its type's attributes has to gain the trait too
      if(Array.isArray(inbox.attrs) && !inbox.attrs.includes('magic'))
        inbox.attrs=inbox.attrs.concat('magic');
      inbox.filter = Object.assign({}, inbox.filter, {loose:true, scope:'all'});
    }},
  /* Ten columns to nine, so the cell is bigger. Same rescale as the step
     before, in the other direction: x and w by 9/10, and anything that rounds
     onto a neighbour is re-placed rather than left to render on top of it. */
  {v:19, up(d){ rescalePhone(d, 10, 9); }},
  /* Three grid sizes to choose between, and the default is the smallest number
     of columns — the biggest cells. A desk that has never been asked comes to
     Small from the nine columns it was on. See decision 48. */
  {v:20, up(d){
      d.look = d.look || {};
      if(!d.look.grid){ d.look.grid='small'; rescalePhone(d, 9, 8); }
    }},
];
function migrate(d){
  let v = d.v||0;
  MIGRATIONS.forEach(m=>{ if(v<m.v){ m.up(d); v=m.v; } });
  d.v = DATA_V;
}
function adopt(d){
  if(!d || !(Array.isArray(d.objects)||Array.isArray(d.drawers))) return false;
  migrate(d);
  S.objects = (d.objects||[]).map(o=>Object.assign({tags:[],history:[],milestones:[],ord:0},o));
  const fixedIds=dedupeIds(S.objects);
  if(fixedIds) setTimeout(()=>toast(`Repaired ${fixedIds} duplicated id${fixedIds>1?'s':''}`),400);
  S.kinds = d.kinds || {};
  if(d.deskCfg) S.deskCfg = Object.assign({layout:'grid',locked:false,sort:null}, d.deskCfg);
  S.look = Object.assign(defaultLook(), d.look||{});
  // the grid size is a coordinate space, so it has to be in place before
  // anything is laid out — every stored phone box is in its columns
  GRID.phone.cols = PHONE_GRIDS[S.look.grid] || PHONE_GRIDS.small;
  S.desks = Array.isArray(d.desks) && d.desks.length ? d.desks.slice() : [ROOT];
  if(!S.desks.includes(ROOT)) S.desks.unshift(ROOT);   // home is always in the row
  // the shelf holds drawers only: home is walked to, not pinned
  S.pins = (Array.isArray(d.pins) ? d.pins : []).filter(id=>id!==ROOT);
  S.undo = [];   // the moves on it referred to objects this desk has never had
  refreshKinds();
  return true;
}
function load(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? adopt(JSON.parse(raw)) : false;
  }catch(e){ return false; }
}
function exportBackup(){
  const name = `bureau-${D.iso(D.today())}.json`;
  const blob = new Blob([JSON.stringify(snapshot(),null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('Backup saved · ' + name);
}
function importBackup(file){
  const fr = new FileReader();
  fr.onload = ()=>{
    try{
      if(adopt(JSON.parse(fr.result))){ writeNow(); S.view='desk'; S.openId=null; render(); renderSheet(); toast('Desk restored'); }
      else toast('That file is not a Bureau backup');
    }catch(e){ toast('Could not read that file'); }
  };
  fr.readAsText(file);
}

/* ============================================================
   19c · assets — image bytes live in IndexedDB, never in the JSON
   ============================================================
   localStorage caps around 5MB and holds the whole desk, so pictures cannot go
   in it. Objects keep {assetId, w, h, label}; the bytes sit in IndexedDB and
   are hydrated onto `media.src` in memory after load. snapshot() strips `src`
   again on the way out, which is what keeps a backup small and readable.      */
const DBNAME='bureau-assets', STORE='assets';
let _db=null;
function db(){
  if(_db) return _db;
  _db = new Promise((res,rej)=>{
    const r=indexedDB.open(DBNAME,1);
    r.onupgradeneeded=()=>{ r.result.createObjectStore(STORE); };
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  }).catch(()=>null);
  return _db;
}
function assetPut(id,src){
  return db().then(d=>d&&new Promise(res=>{
    const tx=d.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(src,id);
    tx.oncomplete=()=>res(true); tx.onerror=()=>res(false);
  })).catch(()=>false);
}
function assetGet(id){
  return db().then(d=>d&&new Promise(res=>{
    const rq=d.transaction(STORE,'readonly').objectStore(STORE).get(id);
    rq.onsuccess=()=>res(rq.result||null); rq.onerror=()=>res(null);
  })).catch(()=>null);
}
function assetDel(id){
  return db().then(d=>d&&new Promise(res=>{
    const tx=d.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete=()=>res(true); tx.onerror=()=>res(false);
  })).catch(()=>false);
}
// After a load, put the pictures back on the objects that reference them.
function hydrateAssets(){
  const want=S.objects.filter(o=>o.media&&o.media.assetId&&!o.media.src);
  if(!want.length) return;
  Promise.all(want.map(o=>assetGet(o.media.assetId).then(src=>{ if(src) o.media.src=src; })))
    .then(()=>render());
}
/* Downscale on import: an untouched phone photo is several megabytes and
   nothing on this grid needs more than about 1400px on its long edge. */
/* Does any pixel have a non-opaque alpha? Sampled on a grid rather than every
   pixel — a 1400px image is two million reads and we only need a yes or no. */
function hasAlpha(cx, cv){
  try{
    const d=cx.getImageData(0,0,cv.width,cv.height).data;
    const step=Math.max(4, Math.floor(d.length/4/20000))*4;   // ~20k samples
    for(let i=3;i<d.length;i+=step) if(d[i]<250) return true;
    return false;
  }catch(e){ return true; }   // tainted canvas: assume alpha and keep PNG
}
/* Which object the file picker was opened for, if any. A holder rather than an
   argument, because the picker is an <input type=file> in the overlay and the
   file comes back on its own change event, long after the button was pressed. */
const imgFor = {id:null};
function importImage(file){
  if(!/^image\//.test(file.type)){ toast('That is not an image'); return; }
  const fr=new FileReader();
  fr.onerror=()=>toast('Could not read that file');
  fr.onload=()=>{
    const im=new Image();
    im.onerror=()=>toast('Could not read that image');
    im.onload=()=>{
      const max=1400, s=Math.min(1, max/Math.max(im.width,im.height));
      const cv=document.createElement('canvas');
      cv.width=Math.max(1,Math.round(im.width*s)); cv.height=Math.max(1,Math.round(im.height*s));
      const cx=cv.getContext('2d');
      cx.drawImage(im,0,0,cv.width,cv.height);
      /* JPEG has no alpha, so anything see-through came back with a black or
         white box behind it. Keep the alpha channel when the source has one —
         that's what lets a cut-out PNG sit on the board as a cut-out. */
      const keepAlpha = /png|webp|gif|svg/i.test(file.type) && hasAlpha(cx, cv);
      let src;
      try{ src = keepAlpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg',0.82); }
      catch(e){ toast('Could not read that image'); return; }
      const assetId=uid('a');
      assetPut(assetId,src).then(ok=>{
        /* Onto the object that asked, if one did — the Media row in an
           object's settings picks a file *for that object*, and making a
           second object instead was the picker answering a question nobody
           had asked. Otherwise an image is placed, not filed: it lands on the
           grid you are looking at rather than being routed to whatever drawer
           collects media. */
        const into = imgFor.id && byId(imgFor.id);
        imgFor.id = null;
        const o = into && has(into,'media') ? into
          : create('image',{title:file.name.replace(/\.[^.]+$/,''),
              parent:(S.view==='drawer'&&S.drawerId)||ROOT});
        const was = o.media && o.media.assetId;
        o.media={assetId, type:(o.media&&o.media.type)||'image', w:cv.width, h:cv.height,
                 label:file.name, src, alpha:keepAlpha};
        if(was && was!==assetId) assetDel(was);      // the picture it replaced
        // pictures land square; you stretch them to the shape you want
        if(o!==into){ o.desk=null; o.phone=null; }
        closePanel(); save(); render();
        // the picture surface may be the thing that asked for the file, and it
        // is showing an empty mount until it is told
        renderSheet();
        toast(ok?'Image added':'Image added — it may not survive a reload');
      });
    };
    im.src=fr.result;
  };
  fr.readAsDataURL(file);
}

/* ============================================================
   19d · the paste bridge — objects written elsewhere, dropped in here
   ============================================================
   No API and no backend: you describe what you want somewhere that can write
   JSON, paste the result, and it lands on the board. Everything routes through
   create() so nothing can arrive that the model would not have made itself.  */

// "Magic drawer", "magic_drawer", "MAGICDRAWER" — all the same type.
function kindFromName(n){
  if(!n) return 'note';
  const t=String(n).toLowerCase().replace(/[^a-z]/g,'');
  if(KINDS[t]) return t;
  const byName=KEYS.find(k=>K(k).nm.toLowerCase().replace(/[^a-z]/g,'')===t);
  if(byName) return byName;
  const partial=KEYS.find(k=>k.startsWith(t)||t.startsWith(k));
  return partial||'note';
}
const SPEC_FIELDS=['body','due','done','count','rating','price','prio','loc','dur','url','repeat','rel'];

function addSpec(spec, parentId, tally){
  if(spec==null) return;
  if(typeof spec==='string') spec={type:'task', title:spec};   // a bare line is a task
  const asked=kindFromName(spec.type||spec.kind);
  const kids=Array.isArray(spec.children)?spec.children:[];
  // something with children has to be able to hold them
  const kind = (kids.length && !kindHas(asked,'container')) ? 'drawer' : asked;
  const o=create(kind,{parent:parentId, title:String(spec.title||spec.name||'Untitled')});
  if(spec.tags) o.tags=[].concat(spec.tags).map(String);
  SPEC_FIELDS.forEach(f=>{ if(spec[f]!=null) o[f]=spec[f]; });
  if(spec.colour||spec.color) o.c=spec.colour||spec.color;
  if(spec.shape) o.shape=spec.shape;
  if(spec.face)  o.face=spec.face;
  if(spec.layout) o.layout=spec.layout;
  if(spec.onclick) o.onclick=spec.onclick;
  const [dw,dh]=sizeOfKind(kind, dev());
  const w=clamp(parseInt(spec.w,10)||dw,1,gridOf().cols), h=Math.max(1,parseInt(spec.h,10)||dh);
  o[dev()]=freeSpot(w,h,dev(),parentId);
  tally[isContainer(o)?'drawers':'objects']++;
  tally.made.push(o.id);
  kids.forEach(c=>addSpec(c, o.id, tally));
  return o;
}

function pasteObjects(text, parentId){
  let raw=String(text||'').trim();
  raw=raw.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();   // tolerate fences
  if(!raw) return toast('Nothing to add');
  let data;
  try{ data=JSON.parse(raw); }
  catch(e){ toast('That is not valid JSON — check for a stray comma'); return; }
  const list=Array.isArray(data)?data:[data];
  if(!list.length) return toast('Nothing to add');
  const tally={drawers:0,objects:0,made:[]};
  try{ list.forEach(sp=>addSpec(sp, parentId||ROOT, tally)); }
  catch(e){ toast('Could not read that: '+e.message); return; }
  save(); render();
  const bits=[];
  if(tally.drawers) bits.push(`${tally.drawers} drawer${tally.drawers>1?'s':''}`);
  if(tally.objects) bits.push(`${tally.objects} object${tally.objects>1?'s':''}`);
  // a paste is one move, however many objects it made — undoing it should not
  // mean pressing undo forty times
  pushUndo('Paste', tally.made.map(id=>({add:id})));
  toast('Added '+(bits.join(' and ')||'nothing'), !!tally.made.length);
}

export { APP_VERSION, DATA_V, rescalePhone, rescaleOneBoard, rescaleBoxes, writeNow, save, storeSize, load, exportBackup,
  importBackup, assetDel, hydrateAssets, importImage, imgFor, pasteObjects, install };
