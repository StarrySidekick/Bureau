import { $, esc, uid, clamp, ROOT, HOLD, D } from './util.js';
import { S, byId, K, KINDS, KEYS, kindHas, has, isContainer, genKindOf, streak, T, dz, dev,
  repeatOf, repeats, nextRepeat, faceOf, childrenOf, TILT_MODES, tiltMode,
  ctlOf, isPrimary,
  placeOf, cfgOf, isHeld, heldObjects } from './model.js';
import { GRID, PHONE_GRIDS, colsOf, gridOf, freeSpot, anySpot, roomFor, lay, boxOk, sizeOfKind, keepSize } from './grid.js';
import { randomFront, randomBoard, randomLook, styleDefaults,
  STYLES, CHECKS, DARKMODES, styleKey, applyStyle, applyLook } from './look.js';
import { render, reveal } from './views.js';
import { tileRect, pop, clRefill } from './motion.js';
import { planForKind, stampPlan } from './plans.js';
import { closeSheet } from './sheet.js';
import { assetDel, rescaleOneBoard, rescaleBoxes, save } from './persist.js';

/* ============================================================
   6 · mutations
   ============================================================ */
/* `undo` offers the way back on the toast itself, which is the only way back a
   phone has. It is **pinned to the move that was on top when the words were
   written** — the link used to call undo(), which takes whatever is on top
   *now*, so a toast still on screen after anything else had been changed undid
   the newer thing and left the filing you were looking at exactly where it
   was. Pressable, and quietly about something else. */
function toast(msg,undo){
  const t=$('#toast');
  toast._move = undo ? (S.undo[S.undo.length-1] || null) : null;
  t.innerHTML = esc(msg) + (undo?' <u data-undo="1">Undo</u>':'');
  t.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),3400);
}
/* What the word on the toast does. If the move it was offered for is still on
   top, step back over it; if something has happened since, say so rather than
   undoing a thing nobody pointed at. ⌘Z is the unpinned one and still walks
   the whole stack. */
function undoToast(){
  const m=toast._move;
  if(m && S.undo[S.undo.length-1]!==m){
    toast('Something else has happened since — ⌘Z steps back through it');
    return;
  }
  undo();
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
  /* And where this line stands on its parent's checklist face, also taken
     before — after the tick the line is off the face, and the lines that were
     under it are about to move up a row. clRefill() draws that shuffle over
     the rendered result; the index is into the undone children, which is the
     order the face prints. See decision 79. */
  const par=byId(o.parent);
  const clAt = (!o.done && par && faceOf(par)==='checklist')
    ? childrenOf(par).filter(x=>!x.done).findIndex(x=>x.id===id) : -1;
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
  if(o.done && clAt>=0) clRefill(o.parent, clAt);
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
    o.parent=up; keepSize(o);
  });
  steps.push(...removeMany([id]));
  if(S.drawerId===id){ S.drawerId = up===ROOT?null:up; S.view = up===ROOT?'desk':'drawer'; }
  pushUndo('Drawer removed', steps);
  toast('Drawer removed — its contents kept', true);
  render();
}
/* ---- the holding space -------------------------------------------------
   Putting a thing in the drawer along the bottom, and taking it out again.
   Both are reparenting and nothing more — the same move a drop into a drawer
   makes — so both clear *both* devices' boxes, because HOLD is not a board and
   whatever the object's coordinates were, they were somewhere else's.

   Both push one undo move, so ⌘Z after either puts the thing back where it
   was rather than leaving it in a drawer with no board. See decisions 65
   and 107. */
function holdIt(id){
  const o=byId(id);
  if(!o || isHeld(o) || o.id===ROOT) return false;
  pushSets('Held', [[o.id,'parent',o.parent], [o.id,'desk',o.desk],
                    [o.id,'phone',o.phone],   [o.id,'ord',o.ord]]);
  // arrival order: the drawer is a queue of things you meant to move, not a
  // board you arranged, so a new one goes on the end
  const last = heldObjects().reduce((m,x)=>Math.max(m, x.ord||0), 0);
  o.parent=HOLD; keepSize(o); o.ord=last+1;
  save();
  return true;
}
/* Out of the drawer and onto the board you are standing on. The box is left
   null on purpose: ensureBox() places it on the next render, which is the one
   thing that knows what room this board has. */
function unholdIt(id, intoId, rec=true){
  const o=byId(id);
  if(!o || !isHeld(o)) return false;
  /* A magic drawer holds nothing, so putting a thing "down here" while you are
     standing in one means putting it where that drawer lives — the same answer
     spawnInto() gives when you type into one. */
  let into = intoId || (S.view==='drawer' && S.drawerId) || ROOT;
  const c = into===ROOT ? null : byId(into);
  if(into!==ROOT && !c) return false;
  if(c && has(c,'magic')) into = c.parent||ROOT;
  // `rec` is off only for unholdMany(), which has already recorded the lot as
  // one move — never as a way of filing something without a way back
  if(rec) pushSets('Taken out', [[o.id,'parent',o.parent], [o.id,'desk',o.desk],
                                 [o.id,'phone',o.phone]]);
  o.parent=into; keepSize(o);
  if(rec) save();
  return true;
}

/* Several at once, as **one** move. Putting the whole drawer down is one
   gesture, so it has to be one ⌘Z — calling unholdIt() in a loop pushes a move
   each, and the Undo offered on the toast would then put back the last thing
   only and quietly leave the rest. Same argument as delMany() beside del().
   The order matters: each is placed against what the one before it took, so
   they are applied in order and recorded in one go beforehand. */
function unholdMany(ids, intoId){
  const live = ids.map(byId).filter(o=>o && isHeld(o));
  if(!live.length) return 0;
  pushSets('Taken out', live.flatMap(o=>[[o.id,'parent',o.parent],
    [o.id,'desk',o.desk], [o.id,'phone',o.phone]]));
  let n=0;
  live.forEach(o=>{ if(unholdIt(o.id, intoId, false)) n++; });
  save();
  return n;
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

/* ---- a drawer is a drawer ---------------------------------------------
   Promoting one into a desk of its own is gone with the row of desks it was
   promoting into (decision 141). What it bought was **room**, and the Desk is
   nine shelves now — you get your Finance board by putting a drawer on the
   shelf to the left, which is a thing you already know how to do.

   Both readers are kept as no-ops rather than deleted, because a keyboard
   shortcut, a context-menu item and an old backup all still reach them, and a
   missing function is a thrown error where a refusal is a sentence. `setPin`
   also has one job left: **demoting**. An old desk is a container with a null
   parent, which is no coordinate space at all, so anything still in that state
   has to be put back on the board — which is what migration 27 does to all of
   them at once and what this does to any that arrive later. */
function setPin(id, where){
  const o=byId(id); if(!o) return;
  if(where==='desk' || where===true){
    toast('Drawers are not desks any more — put it on a shelf instead');
    return;
  }
  if(o.parent==null){
    o.parent = (o.wasIn && (o.wasIn===ROOT || byId(o.wasIn))) ? o.wasIn : ROOT;
    delete o.wasIn; keepSize(o);
    if(S.view==='drawer' && S.drawerId===id){ S.view='desk'; S.drawerId=null; }
  }
  S.desks = [ROOT];
  render();
}
function togglePin(id){
  const o=byId(id); if(!o || !isContainer(o)) return;
  toast('Every drawer is on the Desk now — the Desk is nine shelves wide');
}

/* ---- it won't fit ------------------------------------------------------
   A shelf is a screen and a board is one shelf or nine, so a board can be
   **full**. When it is, the thing you asked for is not made: an object with
   nowhere to be is worse than no object, and quietly putting it somewhere else
   is the thing decision 46 spent a version establishing you must not do.

   Said once, here, so every maker says the same sentence — and it says what to
   do about it, because "it won't fit" with no next move is an error message.
   Returns false when there is no room, so a caller reads as
   `if(!fits(...)) return;`. See decision 141. */
function fits(kind, home, dv){
  const d = dv || dev();
  const [w,h] = sizeOfKind(kind, d, home);
  if(roomFor(w, h, d, home)) return true;
  const c = byId(home);
  const many = c && (c.shelves||{}).w*(c.shelves||{}).h > 1;
  toast(home===ROOT
    ? 'No room on the Desk — all nine shelves are full'
    : `No room in ${c && c.title ? c.title : 'here'} — give it another shelf in its editor${many?'':''}`);
  return false;
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
    /* Its own knob, edge, grain and panelling — picked from this aesthetic's
       vocabulary and weighted heavily to its stated answer, so a desk is a
       room of related furniture rather than a row of identical fronts. See
       decision 92. `sd` is still the fallback for anything the roll leaves
       undecided, and an explicit `patch` always wins over both. */
    const rl = randomLook();
    o.knob=o.knob||rl.knob||sd.knob; o.border=o.border||rl.border||sd.border;
    o.texture=o.texture||rl.texture||sd.texture;
    o.knobtone=o.knobtone||rl.knobtone||undefined;
    o.panel=o.panel||rl.panel||sd.panel; o.pv = o.pv || 'list';
    o.layout = o.layout || k.layout || 'list';
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
  /* A type may open **fitted to a plan** — a whole saved arrangement, boxes
     and nesting and all, rather than `seed:`'s list of titles one level deep.
     The plan comes first and `seed` is still read after it, so a type that had
     one keeps working and a type can honestly have both. See decision 121. */
  if(!(patch&&patch.noSeed) && kindHas(kind,'container')){
    const pid = planForKind(kind);
    if(pid) stampPlan(pid, o.id);
  }
  if(!(patch&&patch.noSeed)) (k.seed||[]).forEach((sp,i)=>{
    if(!KINDS[sp.kind]) return;
    const child = create(sp.kind, {parent:o.id, title:sp.title||'', noSeed:true});
    /* Placed rather than left to ensureBox: a seeded thing is the way *in*, so
       it belongs at the top of the board and not wherever the ordering happens
       to drop it. Both devices, because either could be opened first. */
    /* A seed may state its own size. The spawner a project is born with is a
       band you type into, not the one-cell spiral its type is: what the type
       is *for* on a bare board and what it is *for* at the top of a project
       are two shapes of the same thing, and only the seed knows which. */
    ['desk','phone'].forEach(dv=>{
      const said = dv==='phone' ? (sp.phoneSz || sp.sz) : sp.sz;
      const [w,h] = said ? said : sizeOfKind(sp.kind, dv, o.id);
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
  keepSize(a); keepSize(b);
  b.ord=0; a.ord=1;
  const [kw,kh]=sizeOfKind(kind, dv, home);   // never K(kind).size — a board states its own columns
  const want={x:box.x, y:box.y, w:kw, h:kh};
  c[dv] = boxOk(want, c.id, dv, home) ? want : anySpot(kw, kh, dv, home);
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
  // a shelf is finite: a line typed into a full board makes nothing and says so
  if(!fits(k, drawerId || (S.view==='drawer' && S.drawerId) || ROOT)) return null;
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

/* ---- controls: a switch on the board for one of the desk's own settings --
   Every one of these is already in Settings, three doors deep, and that is the
   right place for a thing you set once. A control is for the two or three you
   flip constantly — the lock above all — put on the board where your thumb
   already is. It is furniture: it moves, resizes, takes a colour and wears an
   aesthetic like anything else on the grid.

   The table is the whole feature. Each entry says how its setting is *read*
   and how it is *flipped*, and nothing outside this object knows which
   settings are switchable — so a new one is a row here and a name in the
   picker, and the tile, the press and the object editor all come along.

   Two shapes of control, and the tile tells them apart by `cycle`: a **switch**
   is on or off, and a **dial** walks a list and says where it is. Nothing here
   pushes an undo move, for the same reason the desk's own settings do not —
   `S.look` has no id for a step to point at (decision 65). Flipping it back is
   the same press. See decision 132. */
const CONTROLS = {
  lock:     {nm:'Lock',      ic:'lock',  ds:'Locks and unlocks every board',
             on:()=>!!S.look.locked,  flip(){ S.look.locked=!S.look.locked; }},
  shadows:  {nm:'Shadows',   ic:'sun',   ds:'Whether what stands on a surface casts one',
             on:()=>!!S.look.shadows, flip(){ S.look.shadows=!S.look.shadows; applyLook(); }},
  pinned:   {nm:'Pinned',    ic:'pin',   ds:'Tiles pinned to the board rather than laid flat',
             on:()=>!!S.look.pinned,  flip(){ S.look.pinned=!S.look.pinned; }},
  style:    {nm:'Aesthetic', ic:'brush', ds:'Walks the aesthetics',
             cycle:()=>Object.keys(STYLES), get:()=>styleKey(),
             said:v=>(STYLES[v]||{}).nm||v, set(v){ applyStyle(v); }},
  dark:     {nm:'Light',     ic:'eye',   ds:'Follow the device, or insist',
             cycle:()=>Object.keys(DARKMODES), get:()=>S.look.dark||'auto',
             said:v=>DARKMODES[v]||v, set(v){ S.look.dark=v; applyLook(); }},
  check:    {nm:'Tick box',  ic:'check', ds:'Which box every tick in the app is drawn in',
             cycle:()=>Object.keys(CHECKS), get:()=>CHECKS[S.look.check]?S.look.check:'square',
             said:v=>CHECKS[v]||v, set(v){ S.look.check=v; applyLook(); }},
  grid:     {nm:'Grid',      ic:'grid',  ds:'How fine a phone board is',
             cycle:()=>Object.keys(PHONE_GRIDS), get:()=>S.look.grid||'small',
             said:v=>v[0].toUpperCase()+v.slice(1), set(v){ setGridSize(v); }},
  parallax: {nm:'Depth',     ic:'resize',ds:'What answers the phone being tilted',
             cycle:()=>Object.keys(TILT_MODES), get:()=>tiltMode(),
             said:v=>TILT_MODES[v]||v, set(v){ S.look.parallax=v; applyLook(); }},
  /* ---- the ones that are a number ------------------------------------
     A switch is on or off and a dial walks a list; these are neither — they
     are a quantity, and the thing that reads a quantity on a real desk is a
     turned knob with a pointer on it. `range` is what says so, and it is the
     only difference between these rows and the ones above: everything else
     about a control (moving it, colouring it, wearing an aesthetic) already
     works. See decision 137. */
  depth:    {nm:'Drawer depth', ic:'resize', ds:'How far a drawer front stands off the board',
             range:[0,40], get:()=>S.look.depth??11, set(v){ S.look.depth=v; applyLook(); }},
  bookdepth:{nm:'Book depth',   ic:'book',   ds:'How far a spine stands off the board',
             range:[0,40], get:()=>S.look.bookdepth??S.look.depth??11, set(v){ S.look.bookdepth=v; applyLook(); }},
  turn:     {nm:'Turn',         ic:'swap',   ds:'How much a face follows the phone',
             range:[0,100], get:()=>S.look.turn??100, set(v){ S.look.turn=v; applyLook(); }},
  inset:    {nm:'Shelf inset',  ic:'grid',   ds:'How far the board is set into the carcass',
             range:[0,40], get:()=>S.look.deskinset??8, set(v){ S.look.deskinset=v; applyLook(); }}
};
const CTL_KEYS = Object.keys(CONTROLS);
const ctlSpec = o => CONTROLS[ctlOf(o)] || CONTROLS.lock;
/* ---- what a control is *made of* ---------------------------------------
   Three, and the table decides — nothing here branches on a control's name.

   A thing with **two** states is a switch, and a switch is drawn as a switch:
   a lever you can read across the room, because "Shadows: On" is a label where
   a lever is a glance. A thing walking **more than two** is a **button** that
   changes colour as it goes, which is what a bank of indicator buttons does and
   is the only way a list longer than two can say where it is at a glance. And
   a thing that is a **number** is a **dial**, turned, with a pointer.

   `cycle().length<=2` rather than "has a cycle": a two-value list is a switch
   wearing a list, and drawing it as a button would give the desk two different
   answers to the same question. See decision 137. */
function ctlForm(o){
  const c = ctlSpec(o);
  if(c.range) return 'dial';
  if(c.cycle) return (c.cycle()||[]).length<=2 ? 'switch' : 'button';
  return 'switch';
}
/* Where a numbered control is, as the value and as a fraction — the fraction
   is what the pointer's angle is worked out from, and it is clamped here so a
   stored number outside the range cannot spin the pointer off its scale. */
function ctlNum(o){
  const c = ctlSpec(o); if(!c.range) return null;
  const [lo,hi] = c.range;
  const v = clamp(Number(c.get())||0, lo, hi);
  return {v, lo, hi, pct:(v-lo)/((hi-lo)||1)};
}
// where a walking control is in its own list, which is what colours the button
function ctlIndex(o){
  const c = ctlSpec(o); if(!c.cycle) return 0;
  return Math.max(0, (c.cycle()||[]).indexOf(c.get()));
}
// What the switch is showing right now, in words. A dial says where it is; a
// switch says on or off, which is drawn as a switch and not printed.
const ctlSaid = o => { const c=ctlSpec(o);
  return c.range ? String(Math.round(Number(c.get())||0))
       : c.cycle ? c.said(c.get()) : (c.on()?'On':'Off'); };
const ctlIsOn = o => { const c=ctlSpec(o); return (c.cycle||c.range) ? true : !!c.on(); };
/* Pressing one. A dial walks to the next value and wraps; a switch flips.
   Both save and render immediately — a control is a thing you press to see the
   board change, so there is nothing here to defer. */
const DIAL_DETENTS = 10;
function ctlPress(id){
  const o=byId(id); if(!o || !has(o,'control')) return;
  const c=ctlSpec(o);
  /* A dial is turned, and pressing it is one detent round — ten to the sweep,
     wrapping back to the bottom past the top. A real one is dragged and this
     one will be too, but a dial you cannot move at all is an ornament, and the
     press is the whole of what every other control already answers to. */
  if(c.range){
    const n=ctlNum(o), step=(n.hi-n.lo)/DIAL_DETENTS;
    const next = n.v + step > n.hi + step/2 ? n.lo : Math.min(n.hi, Math.round((n.v+step)/step)*step);
    c.set(Math.round(next));
    toast(`${c.nm}: ${Math.round(next)}`);
    save(); render(); return;
  }
  if(c.cycle){
    const list=c.cycle(), i=list.indexOf(c.get());
    const next=list[(i+1)%list.length];
    c.set(next);
    toast(`${c.nm}: ${c.said(next)}`);
  } else {
    c.flip();
    toast(`${c.nm} ${c.on()?'on':'off'}`);
  }
  save();
  render();
}

/* Testing aid: drop something arbitrary onto the desk. Random kind, random
   size within what the grid allows, random colour — the point is to see how
   placement and the board cope with shapes nobody designed for. */
/* What a spawner set to `random` presses out. The major categories only, and
   nothing structural with them: a spawner that made a drawer, a control or a
   decoration is a machine for making furniture, and what you want out of one
   is work. See decision 133. */
function someKind(){
  /* …and never a **category**, which is not a type at all but a question. A
     spawner set to anything would otherwise press out a Fragment, which is the
     one thing in KINDS that nothing knows how to draw as itself. */
  const pool = KEYS.filter(k => isPrimary(k) && !K(k).cat && !K(k).family
    && !kindHas(k,'container') && !kindHas(k,'control') && !kindHas(k,'decor'));
  return pool[Math.floor(Math.random()*pool.length)] || 'note';
}

const WORDS='brass ledger cedar tide quarry lantern vellum thistle harbour ember slate poppy compass juniper marrow'.split(' ');
function randomThing(parentId){
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const kinds=KEYS.filter(k=>!kindHas(k,'control'));
  const kind=pick(kinds);
  const home=parentId||(S.view==='drawer'&&S.drawerId)||ROOT;
  const o=create(kind,{parent:home,
    title:`${pick(WORDS)} ${pick(WORDS)}`.replace(/^./,c=>c.toUpperCase())});
  if(has(o,'text')) o.body=Array.from({length:2+Math.floor(Math.random()*4)},()=>pick(WORDS)).join(' ')+'.';
  if(has(o,'date')&&Math.random()<0.6) o.due=dz(Math.floor(Math.random()*14)-3);
  if(has(o,'check')&&Math.random()<0.3) { o.done=true; o.doneAt=T; }
  // create() gives a container its own look now (decision 92), so this only
  // rerolls the two that make a sample desk worth looking at
  if(isContainer(o)){ o.c=randomFront(); o.board=randomBoard(); }
  const g=gridOf(undefined, home), dv=dev();
  const w=1+Math.floor(Math.random()*8), h=1+Math.floor(Math.random()*8);
  o[dv]=anySpot(Math.min(w,g.shelfW), h, dv, home);
  return o;
}

// toggleHabit isn't exported — a streak reaches it through toggleDone, which is
// the one door, so nothing outside has to know a habit ticks differently.
export { toast, setGridSize, toggleDone, spawnNext, del, delMany, delDrawer, undo, redo,
  pushUndo, pushSet, pushSets, setPin, togglePin,
  drawerForTag, create, gather, quickAdd, spawnInto, randomThing,
  CONTROLS, CTL_KEYS, ctlSpec, ctlSaid, ctlIsOn, ctlForm, ctlNum, ctlIndex, ctlPress, someKind,
  fits,
  holdIt, unholdIt, unholdMany, undoToast };
