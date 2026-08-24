import { $, esc, uid, ROOT, D } from './util.js';
import { S, byId, K, KINDS, KEYS, kindHas, has, isContainer, genKindOf, streak, T, dz, dev,
  repeatOf, repeats, nextRepeat,
  deskIds, deskHere, placeOf, cfgOf } from './model.js';
import { GRID, PHONE_GRIDS, colsOf, gridOf, freeSpot, lay, boxOk, sizeOfKind } from './grid.js';
import { randomFront, randomBoard, styleDefaults } from './look.js';
import { render, reveal } from './views.js';
import { tileRect, pop } from './motion.js';
import { closeSheet } from './sheet.js';
import { assetDel, rescalePhone, rescaleOneBoard, rescaleBoxes, save } from './persist.js';

/* ============================================================
   6 · mutations
   ============================================================ */
function toast(msg,undo){
  const t=$('#toast');
  t.innerHTML = esc(msg) + (undo?' <u data-undo="1">Undo</u>':'');
  t.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),3400);
}
/* ---- the next one ------------------------------------------------------
   The rule decides, and `nextRepeat()` in model.js is where it lives. Two
   things this does *not* do any more, both of which were wrong:

   - it no longer requires a due date. An after-completion rule counts from the
     day you finished it, so "three days after I do it" works on something that
     was never scheduled at all.
   - it no longer needs a special case for finishing early. The tick is the
     tick; a fixed schedule counts from the day it was due and an
     after-completion one from today, which is exactly what each of them means.

   See decision 73. */
const nextDue = o => nextRepeat(o, T);

/* Make the next one now, before this one is done — Things 3.23's "create next
   copy", which is for getting a head start on something you want to fill in
   ahead of time. The copy is a real object at the next date; the original keeps
   its own, so this is not a reschedule. */
function spawnNext(id){
  const o=byId(id); if(!o) return null;
  const nd=nextDue(o);
  if(!nd){ toast(repeats(o) ? 'That rule has run out' : 'It does not repeat'); return null; }
  const r=repeatOf(o);
  const copy=Object.assign({}, o, {id:uid('o'), done:false, doneAt:null, due:nd,
    ord:(o.ord||0)+0.5, fromRepeat:true, desk:null, phone:null});
  S.objects.push(copy);
  if(r && typeof o.repeat==='object') o.repeat=Object.assign({}, r, {made:(r.made||0)+1});
  pushUndo('Next one made', [{add:copy.id}]);
  save(); render(); reveal && reveal(copy.id);
  toast(`Next one · ${D.human(nd).toLowerCase()}`);
  return copy;
}
function toggleDone(id){
  const o=byId(id); if(!o) return;
  if(has(o,'streak')){ toggleHabit(id); return; }
  /* Where it was standing, taken before the board redraws — because "done"
     usually means the thing leaves the drawer it was in, and a pop you can
     only see when it survives is a pop you mostly never see. */
  const was=tileRect(id);
  o.done=!o.done;
  if(o.done){
    o.doneAt=T;
    const nd=nextDue(o);
    if(nd){
      const r=repeatOf(o);
      /* `fromRepeat` marks a copy as one — Things 3.23 puts a small repeat glyph
         on generated to-dos, and it is worth having: it tells you the thing in
         front of you came from a rule rather than from you, which is the
         difference between "I wrote this down" and "this comes round". */
      S.objects.push(Object.assign({},o,{id:uid('o'), done:false, doneAt:null, due:nd,
        ord:o.ord+0.5, fromRepeat:true,
        repeat: (r && typeof o.repeat==='object')
          ? Object.assign({}, r, {made:(r.made||0)+1}) : o.repeat}));
      o.kind='achievement';   // the archive is a magic drawer; nothing needs moving
      toast(`Done · repeats ${D.human(nd).toLowerCase()}`);
    } else toast(repeats(o) ? 'Done · that was the last one' : 'Filed under Done & Dusted');
  } else { o.doneAt=null; }
  render();
  if(o.done) pop(id, was);
}
function toggleHabit(id){
  const o=byId(id); if(!o) return;
  o.history=o.history||[];
  const i=o.history.indexOf(T);
  if(i>=0) o.history.splice(i,1); else { o.history.push(T); toast(`${o.title} · ${streak(o)+0} day streak`); }
  render();
}
/* ------------------------------------------------------------
   6b · undo — a stack of moves, not a single bin
   ------------------------------------------------------------
   There used to be one slot, `S.trash`, holding one deleted object. Deleting a
   selection or a drawer bypassed it entirely, so the two ways to lose the most
   at once were the two with no way back. A move is a list of steps that put
   things exactly as they were, replayed backwards:

     {del:{o,i}}       an object that was removed — splice it back in at i
     {add:id}          an object that was made — take it out again
     {set:{id,k,v}}    a field that changed — v is what it was before

   The stack is in memory only. It is not in snapshot() and it does not survive
   a reload, which is the same promise every undo makes.                      */
const UNDO_MAX = 20;

// A picture is only unrecoverable once its move falls off the bottom of the
// stack — not when it was deleted, which would break the undo above it.
function reap(move){
  (move.steps||[]).forEach(s=>{
    const o = s.del && s.del.o;
    if(o && o.media && o.media.assetId && !byId(o.id)) assetDel(o.media.assetId);
    /* A picture taken *out* of an object that is still on the desk. The move
       held the old media so undo could put it back; once the move has gone,
       nothing points at those bytes — unless something else adopted the same
       asset in the meantime, which a duplicate does. */
    const m = s.set && s.set.k==='media' && s.set.v;
    if(m && m.assetId && !S.objects.some(x=>x.media && x.media.assetId===m.assetId))
      assetDel(m.assetId);
  });
}
function pushUndo(label, steps){
  if(!steps.length) return;
  S.undo.push({label, steps, at:Date.now()});
  /* A new move ends the branch you undid your way out of. Keeping the redo
     stack across an edit is how an undo history comes to offer a redo that
     reinstates a change on top of a desk it no longer fits. */
  S.redo.length = 0;
  while(S.undo.length>UNDO_MAX) reap(S.undo.shift());
}
/* ---- a field going back to what it was ---------------------------------
   Undo used to know about deletion and nothing else: a panel edit, a drag, a
   type change, a reparent were all silent, and ⌘Z after one of them did
   nothing at all — which is worse than having no undo, because you try it.

   Typing is the case that needs care. An input fires per keystroke, so a
   ten-letter name is ten moves and the stack is full of one rename. A set is
   therefore **coalesced** into the move on top when it touches the same field
   of the same object within COALESCE ms, and the value kept is the *first*
   one — which is what "before I started typing" means. See decision 65. */
const COALESCE = 1500;
function pushSet(label, id, k, was){
  const top=S.undo[S.undo.length-1], now=Date.now();
  if(top && now-(top.at||0)<COALESCE && top.steps.length===1 && top.steps[0].set
     && top.steps[0].set.id===id && top.steps[0].set.k===k){
    top.at=now; S.redo.length=0; return;
  }
  pushUndo(label, [{set:{id, k, v:was}}]);
}
/* Several fields of several objects at once — a drag that moved a selection, a
   reparent, a group of boxes cleared. One move, so one ⌘Z takes all of it. */
function pushSets(label, sets){
  pushUndo(label, sets.filter(Boolean).map(([id,k,v])=>({set:{id,k,v}})));
}

/* Replay a move backwards, and hand back the move that would replay *it*
   backwards — which is what makes redo a second stack rather than a special
   case. Steps run in reverse index order; each one is turned into its own
   inverse as it goes, collected in the order they ran, and that collection
   read in reverse index order is the way back. */
function applyMove(steps){
  const back=[];
  for(let i=steps.length-1;i>=0;i--){
    const s=steps[i];
    if(s.del){ S.objects.splice(Math.min(s.del.i, S.objects.length), 0, s.del.o); back.push({add:s.del.o.id}); }
    else if(s.add){ const j=S.objects.findIndex(o=>o.id===s.add);
      if(j>=0){ back.push({del:{o:S.objects[j], i:j}}); S.objects.splice(j,1); } }
    else if(s.set){ const o=byId(s.set.id);
      if(o){ back.push({set:{id:s.set.id, k:s.set.k, v:o[s.set.k]}}); o[s.set.k]=s.set.v; } }
  }
  return back;
}
function undo(){
  const m=S.undo.pop();
  if(!m){ toast('Nothing to undo'); return; }
  S.redo.push({label:m.label, steps:applyMove(m.steps)});
  while(S.redo.length>UNDO_MAX) S.redo.shift();
  $('#toast').classList.remove('show');
  toast(m.label ? `Undone · ${m.label}` : 'Undone');
  render();
}
function redo(){
  const m=S.redo.pop();
  if(!m){ toast('Nothing to redo'); return; }
  // straight onto the undo stack, without pushUndo(), which would clear redo
  S.undo.push({label:m.label, steps:applyMove(m.steps), at:Date.now()});
  while(S.undo.length>UNDO_MAX) reap(S.undo.shift());
  $('#toast').classList.remove('show');
  toast(m.label ? `Redone · ${m.label}` : 'Redone');
  render();
}
/* Removing several at once: take them out from the end so each recorded index
   is still valid, and record them in that same order — undo replays a move
   backwards, so descending removal comes back ascending and everything lands
   where it was. */
function removeMany(ids){
  const steps=[];
  ids.map(id=>S.objects.findIndex(o=>o.id===id)).filter(i=>i>=0).sort((a,b)=>b-a)
     .forEach(i=>{ steps.push({del:{o:S.objects[i], i}}); S.objects.splice(i,1); });
  // whatever was open on it can't stay open — a surface, a panel, or a tile
  // being typed in
  if(ids.includes(S.writeId)||ids.includes(S.readId)||ids.includes(S.viewId)) closeSheet();
  if(ids.includes(S.editId)) S.editId=null;
  S.sel=(S.sel||[]).filter(x=>!ids.includes(x));
  return steps;
}
function del(id){
  const steps=removeMany([id]);
  if(!steps.length) return;
  pushUndo('Deleted', steps);
  toast('Deleted', true); render();
}
function delMany(ids){
  const steps=removeMany(ids);
  if(!steps.length) return;
  pushUndo(`Deleted ${steps.length}`, steps);
  toast(`Deleted ${steps.length}`, true); render();
}
/* A drawer's contents are kept — they move up to wherever the drawer lived.
   Their boxes do not come with them: {x,y,w,h} was a coordinate in the
   drawer's own space, and the same numbers in the parent's space mean somewhere
   else entirely, usually on top of something. Clearing them lets ensureBox()
   find each one real room. */
function delDrawer(id){
  const d=byId(id); if(!d) return;
  const up=d.parent||ROOT, steps=[];
  S.objects.forEach(o=>{
    if(o.parent!==id) return;
    steps.push({set:{id:o.id, k:'parent', v:id}},
               {set:{id:o.id, k:'desk',   v:o.desk}},
               {set:{id:o.id, k:'phone',  v:o.phone}});
    o.parent=up; o.desk=null; o.phone=null;
  });
  steps.push(...removeMany([id]));
  if(S.drawerId===id){ S.drawerId = up===ROOT?null:up; S.view = up===ROOT?'desk':'drawer'; }
  pushUndo('Drawer removed', steps);
  toast('Drawer removed — its contents kept', true);
  render();
}
/* ---- changing how fine a board's grid is -------------------------------
   The three sizes are three column counts, and a column count is a coordinate
   space: every box on that board is measured in it. So switching is a migration
   run live — the same rescale the numbered ones do, on the objects in memory
   rather than on a snapshot — and each tile keeps the fraction of the board it
   had. Rounding can push two neighbours into each other, which the rescale
   repairs by re-placing whichever lands second.

   `cid` names the board. Without one it is the **app's default**, which is what
   every board follows until it is asked directly — and changing the default has
   to rescale every board that was following it, which is all of them except the
   ones that have an answer of their own.

   It is not reversible to the pixel: going Small → Large → Small rounds twice
   and a box may come back a cell wider than it went. That is the honest cost of
   trying sizes on, and it is why this is a setting rather than a gesture.
   See decisions 48 and 60. */
function setGridSize(key, cid){
  const cols = PHONE_GRIDS[key];
  if(!cols) return;
  if(cid!=null){
    const t = cfgOf(cid); if(!t) return;
    const from = colsOf(cid, 'phone');
    if(cols!==from){ rescaleOneBoard(S.objects, cid, from, cols); }
    t.grid = key;
    save(); render();
    toast(`This board — ${cols} across`);
    return;
  }
  /* The app's default. Every board that has not been asked the question is
     measured in it, so each of them is rescaled from whatever it was showing —
     which is the old default for all of them, since a board with its own answer
     is skipped. */
  const from = GRID.phone.cols;
  if(cols!==from){
    const followers = new Set([ROOT, ...S.objects.filter(isContainer).map(o=>o.id)]
      .filter(id=>{
        const own=(cfgOf(id)||{}).grid;
        return !(own && PHONE_GRIDS[own]) && colsOf(id,'phone')===from;
      }));
    // …and the objects on them, which is every object whose home is a follower
    rescaleBoxes(S.objects.filter(o=>followers.has(o.parent||ROOT)), from, cols);
  }
  S.look.grid = key;
  GRID.phone.cols = cols;
  save(); render();
  toast(`${key[0].toUpperCase()+key.slice(1)} — ${cols} across`);
}

/* Where a drawer is kept, which is deliberately not a property of the drawer —
   see the note in model.js. `where` is:

     desk    out in the master space, somewhere you can be
     null    an ordinary drawer, on the board where it lives

   The row appends, so it fills left to right in the order you chose things, and
   taking one out leaves the rest where they were.

   Becoming a desk is a **move**, not a label. A desk is somewhere you can be,
   and a thing cannot be both a place you go to and a front sitting on somebody
   else's board — so promoting takes the drawer off the board it was on
   entirely, and demoting puts it back where it came from. Its boxes go with
   it, because it is a new coordinate space either way. See decision 40. */
function setPin(id, where){
  const o=byId(id); if(!o) return;
  /* 'pin' is still accepted and still means "not a desk": the shelf is out for
     now (decision 53) and there is nowhere for a pinned thing to be drawn, so
     asking for it takes the drawer off the desk row and leaves it on its board.
     Old data keeps its `S.pins` list, untouched, for whenever the shelf comes
     back. */
  const to = where===true ? 'desk' : (where==='pin' ? null : (where||null));
  // only a container can be a desk — a desk is a place, and a place holds things
  if(to==='desk' && !isContainer(o)) return;
  const was = placeOf(id);
  S.desks = (S.desks||[ROOT]).filter(x=>x!==id);
  if(to==='desk'){
    S.desks.push(id);
    if(was!=='desk'){
      // remember where it stood, so demoting is a return and not a guess
      o.wasIn = o.parent||ROOT;
      o.parent=null; o.desk=null; o.phone=null;
    }
  } else {
    if(was==='desk'){
      o.parent = (o.wasIn && (o.wasIn===ROOT || byId(o.wasIn))) ? o.wasIn : ROOT;
      delete o.wasIn; o.desk=null; o.phone=null;
      // whoever was looking at it as a desk has to be put somewhere real
      if(S.view==='drawer' && S.drawerId===id){ S.view='desk'; S.drawerId=null; }
    }
  }
  render();
}
/* The star in the bar. It promotes, because that is the interesting half of
   the question — and it says what promoting costs, since a drawer that becomes
   a desk leaves the board it was on and drops out of what every rule on every
   *other* desk can see. Both are consequences you would not guess. */
function togglePin(id){
  const o=byId(id); if(!o || !isContainer(o)) return;
  const was = placeOf(id)==='desk';
  const home = was ? null : (byId(o.parent)||{}).title || 'the desk';
  setPin(id, was ? null : 'desk');
  toast(was ? `${o.title} is an ordinary drawer again`
            : `${o.title} is a desk of its own — it has left ${home}`);
}
/* Tag filtering has no mode and no filter bar on purpose. A tag you care about
   enough to filter by is a tag you care about enough to keep, and "everything
   matching this" is exactly what a magic drawer already says — so clicking a
   tag makes that drawer once and opens it every time after. One concept doing
   the work instead of two. */
function drawerForTag(tag){
  const t=String(tag||'').replace(/^#/,'').trim();
  if(!t) return null;
  let d=S.objects.find(o=>isContainer(o)&&has(o,'magic')&&(o.filter||{}).tag===t);
  if(!d){
    d=create('magic',{title:'#'+t, parent:ROOT});
    d.filter={tag:t};
    toast(`Made a drawer for #${t}`);
  }
  S.view='drawer'; S.drawerId=d.id; S.kindFilter=null;
  render();
  return d;
}
function create(kind, patch){
  const k=K(kind);
  const o = Object.assign({
    id:uid(kindHas(kind,'container')?'d':'o'), kind, title:'', body:k.body||'', tags:[],
    /* Where it lands when nobody said: the board you are looking at. Nowhere
       else. It was routed to the inbox for one version, and that was wrong —
       a drawer that takes what you make is a drawer that files your desk for
       you. The inbox *collects* instead: it is a magic drawer whose rule is
       "loose on a desk", so a new object shows up in it while staying exactly
       where you made it. See inContainer() and decision 45. */
    parent:(S.view==='drawer'&&S.drawerId)||ROOT,
    done:false, doneAt:null, due:kindHas(kind,'date')?T:null,
    repeat:kindHas(kind,'streak')?{every:1,unit:'day',days:[],from:'date',ends:null,paused:false,made:0}:null,
    history:[], milestones:kindHas(kind,'progress')?[{t:'First milestone',done:false,d:dz(30)}]:[],
    /* Media, with **no type stamped on it**. It used to be born saying
       `type:'image'`, so an Audio object declared itself a photograph the
       moment it existed — and `mediaTypeOf()` asks the object first, which is
       the whole point of it. The same mistake as storing tsize:1 on everything
       ever looked at: normal is the absence of an answer, not a value written
       everywhere. The type's own `mediaType` answers until something says
       otherwise. See decisions 49 and 71. */
    media:kindHas(kind,'media')?{label:'Attach a file'}:null,
    link:kindHas(kind,'button')?{label:'Open',target:''}:null,
    desk:null, phone:null,
    ord:Math.min(0,...S.objects.map(o=>o.ord||0))-1, created:T
  }, patch||{});
  if(kindHas(kind,'container')){
    o.board = o.board || randomBoard();
    o.c = o.c || randomFront();
    const sd=styleDefaults();
    o.knob=o.knob||sd.knob; o.border=o.border||sd.border;
    o.texture=o.texture||sd.texture; o.knobtone=o.knobtone||sd.knobtone; o.pv = o.pv || 'list';
    o.opens = o.opens || k.opens || 'list';
    // A type may declare the rule its containers start with — a calendar
    // collects anything dated the moment you make one, rather than being a
    // magic drawer you then have to explain itself to. Copied, never shared:
    // the drawer form edits this object's filter in place.
    o.filter = o.filter || (k.filter ? JSON.parse(JSON.stringify(k.filter)) : {});
  }
  /* No auto-routing. It made sense when ordinary drawers had rules; now the
     only drawers with rules are magic ones, which hold nothing — so routing a
     new object into one filed it somewhere it could never appear, and it
     vanished from the drawer you made it in. */
  S.objects.push(o);
  /* A type may be born with things already inside it. A project needs a way to
     add to it, and the type that turns typing into tasks already exists — so it
     gets one *put in it* rather than growing a second one of its own on its
     front. One level only: a seeded child's own seed is ignored, because two
     types that seed each other would fill the desk forever. */
  if(!(patch&&patch.noSeed)) (k.seed||[]).forEach((sp,i)=>{
    if(!KINDS[sp.kind]) return;
    const child = create(sp.kind, {parent:o.id, title:sp.title||'', noSeed:true});
    /* Placed rather than left to ensureBox: a seeded thing is the way *in*, so
       it belongs at the top of the board and not wherever the ordering happens
       to drop it. Both devices, because either could be opened first. */
    ['desk','phone'].forEach(dv=>{
      const [w,h]=sizeOfKind(sp.kind, dv, o.id);
      child[dv]={x:1, y:1+i*h, w, h};
    });
  });
  delete o.noSeed;
  return o;
}
/* Two objects dropped on each other become the container their type gathers
   into — see gatherKind() in model.js, which decides whether they agree. The
   new container starts at the target's corner so the pile stays where you made
   it, but at its *own* size and not the union with what it replaced: a story
   is a book spine, and a spine as wide as the scene it landed on is a door.
   Both objects move inside and lose their boxes, so the container places them
   on first render. The one the others landed on goes first, since it was
   already there. */
function gather(aId, bId, kind){
  const a=byId(aId), b=byId(bId);
  if(!a || !b || !kind) return null;
  const dv=dev(), home=b.parent, box=lay(b);
  const c=create(kind, {parent:home, title:K(kind).nm});
  a.parent=c.id; b.parent=c.id;
  a.desk=a.phone=b.desk=b.phone=null;
  b.ord=0; a.ord=1;
  const [kw,kh]=sizeOfKind(kind, dv, home);   // never K(kind).size — a board states its own columns
  const want={x:box.x, y:box.y, w:kw, h:kh};
  c[dv] = boxOk(want, c.id, dv, home) ? want : freeSpot(kw, kh, dv, home);
  toast(`Made a ${K(kind).nm.toLowerCase()}`);
  return c;
}

function quickAdd(text, kind, drawerId){
  let t=text.trim(); if(!t) return null;
  let k=kind||'task', due=null; const tags=[];
  const slash=t.match(/^\/(\w+)\s+/);
  if(slash){ const found=KEYS.find(x=>x.startsWith(slash[1].toLowerCase())); if(found){ k=found; t=t.slice(slash[0].length); } }
  t=t.replace(/#([\w-]+)/g,(m,g)=>{tags.push(g);return '';});
  if(/!today\b/i.test(t)){ due=T; t=t.replace(/!today\b/i,''); }
  if(/!tomorrow\b/i.test(t)){ due=dz(1); t=t.replace(/!tomorrow\b/i,''); }
  if(/!week\b/i.test(t)){ due=dz(7); t=t.replace(/!week\b/i,''); }
  t=t.replace(/\s+/g,' ').trim();
  const o=create(k,{title:t, tags, parent:drawerId||undefined, body:''});
  if(due) o.due=due; else if(!kindHas(k,'date')) o.due=null;
  return o;
}

/* Typing into a container makes one of what it collects, in it. A magic
   container holds nothing, so the new object goes where the container itself
   lives and the rule collects it straight back — which is the only way a thing
   you typed into a calendar can appear on the calendar. `patch` is for the
   caller that aimed at a particular day. */
function spawnInto(c, text, patch){
  if(!c) return null;
  const home = has(c,'magic') ? (c.parent||ROOT) : c.id;
  const o = quickAdd(text, genKindOf(c), home);
  if(o && patch) Object.assign(o, patch);
  return o;
}

/* Testing aid: drop something arbitrary onto the desk. Random kind, random
   size within what the grid allows, random colour — the point is to see how
   placement and the board cope with shapes nobody designed for. */
const WORDS='brass ledger cedar tide quarry lantern vellum thistle harbour ember slate poppy compass juniper marrow'.split(' ');
function randomThing(parentId){
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const kinds=KEYS.slice();
  const kind=pick(kinds);
  const home=parentId||(S.view==='drawer'&&S.drawerId)||ROOT;
  const o=create(kind,{parent:home,
    title:`${pick(WORDS)} ${pick(WORDS)}`.replace(/^./,c=>c.toUpperCase())});
  if(has(o,'text')) o.body=Array.from({length:2+Math.floor(Math.random()*4)},()=>pick(WORDS)).join(' ')+'.';
  if(has(o,'date')&&Math.random()<0.6) o.due=dz(Math.floor(Math.random()*14)-3);
  if(has(o,'check')&&Math.random()<0.3) { o.done=true; o.doneAt=T; }
  if(isContainer(o)){ o.c=randomFront(); o.board=randomBoard();
    o.knob=pick(['round','diamond','bar','ring','square']);
    o.border=pick(['panel','panel','heavy','bar','plain','none']); }
  const g=gridOf(undefined, home), dv=dev();
  const w=1+Math.floor(Math.random()*8), h=1+Math.floor(Math.random()*8);
  o[dv]=freeSpot(Math.min(w,g.cols), h, dv, home);
  return o;
}

// toggleHabit isn't exported — a streak reaches it through toggleDone, which is
// the one door, so nothing outside has to know a habit ticks differently.
export { toast, setGridSize, toggleDone, spawnNext, del, delMany, delDrawer, undo, redo,
  pushUndo, pushSet, pushSets, setPin, togglePin,
  drawerForTag, create, gather, quickAdd, spawnInto, randomThing };
