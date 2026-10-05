import { $, esc, uid, clamp, ROOT, HOLD, BIN, D, pastTense } from './util.js';
import { S, byId, K, KINDS, KEYS, kindHas, has, isContainer, genKindOf, streak, T, dz, dev,
  repeatOf, repeats, nextRepeat, faceOf, childrenOf, TILT_MODES, tiltMode, GRAVITIES, gravityMode,
  ctlOf, isPrimary, SECONDARY, MASTERS, inMaster, isCut, doesOf, isPicture, isDecor, shapeOf, isBackdrop,
  BORDER_SLOTS, STOCK_SLOTS, SEAL_KEYS, TSIZES, FILL_KEYS, BUTTON_IMGS,
  placeOf, cfgOf, isHeld, stampsOf, isZone, zoneWrites, zoneSaid, ZONE_TRAITS, inBin, isInbox, pipeFor, makesSmart, heldObjects, homeFor , attrsOf, relate, rulesOf, CALSHOWS, SMART, habitPlan, habitOn, tagSlug, mediaTypeOf, measureOf, amountSaid, setting, setSetting, isShelved, isGone, prioOf } from './model.js';
import { TILE, GRID, PHONE_GRIDS, colsOf, gridOf, shelfRows, freeSpot, anySpot, fitSpot, roomFor, lay, boxOk, sizeOfKind, keepSize, shelvesOf, addBoard, randomSizeOf, formOf } from './grid.js';
import { randomFront, randomBoard, randomLook, styleDefaults,
  STYLES, CHECKS, DARKMODES, styleKey, applyStyle, applyLook, OBJ0, OBJN } from './look.js';
import { render, reveal } from './views.js';
import { tileRect, pop, clRefill } from './motion.js';
import { planForKind, stampPlan } from './plans.js';
import { DECOR_KEYS } from './decor.js';
import { DICE, CLOCKS } from './active.js';
import { WHEEL_COLOURS, WHEEL_INKS, WHEEL_FONTS, VINYLS, PORTAL_SHAPES, PORTAL_STYLES, PORTAL_EDGES, KSHAPES } from './tiles.js';
import { FONTS, INKS, isWritten } from './words.js';
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
  /* **A tick is a move** (2026-09-30). It was the one change with no undo:
     a ticked thing leaves the board, so a mis-tap on a phone took a task out
     of sight with no way back but finding it in the archive. The move is the
     fields as they were, plus the copy a repeat makes, which undo takes away. */
  const steps=[{set:{id, k:'done', v:o.done}}, {set:{id, k:'doneAt', v:o.doneAt}}];
  o.done=!o.done;
  if(o.done){
    o.doneAt=T;
    const nd=nextDue(o);
    if(nd){
      steps.push({set:{id, k:'kind', v:o.kind}});
      const r=repeatOf(o);
      /* `fromRepeat` marks a copy as one — Things 3.23 puts a small repeat glyph
         on generated to-dos, and it is worth having: it tells you the thing in
         front of you came from a rule rather than from you, which is the
         difference between "I wrote this down" and "this comes round". */
      /* **The history comes round with it**, and today is added to it. A
         repeating task is what a habit is (decision 160), and the record of
         the days it was done lived on the copy that was just archived — so a
         tracker on the next one started empty every time. A fresh array, too:
         `Object.assign` handed both objects the *same* one, so a day logged
         on either was logged on both. See decision 202. */
      const next=Object.assign({},o,{id:uid('o'), done:false, doneAt:null, due:nd,
        ord:o.ord+0.5, fromRepeat:true, history:[...(o.history||[]), T],
        repeat: (r && typeof o.repeat==='object')
          ? Object.assign({}, r, {made:(r.made||0)+1}) : o.repeat});
      S.objects.push(next);
      steps.push({add:next.id});
      o.kind='achievement';   // the archive is a magic drawer; nothing needs moving
      pushUndo('Checked', steps);
      toast(`Done · repeats ${D.human(nd).toLowerCase()}`, true);
    } else {
      pushUndo('Checked', steps);
      toast(repeats(o) ? 'Done · that was the last one' : 'Filed under Done & Dusted', true);
    }
  } else { o.doneAt=null; pushUndo('Unchecked', steps); }
  render();
  if(o.done) pop(id, was);
  if(o.done && clAt>=0) clRefill(o.parent, clAt);
}
/* **Logging a habit counts up to what the day asks for, then clears.** A habit
   done twice a day is pressed twice, and a third press is the way back to
   none — one button, walked round, rather than a plus and a minus on a tile
   with room for neither. A weekly habit takes one a day: doing it twice on a
   Tuesday is still Tuesday. An undo move, which it never had (decision 65),
   carrying the whole list because that is the field that changed. */
function toggleHabit(id){
  const o=byId(id); if(!o) return;
  const was = (o.history||[]).slice();
  const plan = habitPlan(o);
  const cap = plan.per==='day' ? plan.times : 1;
  const today = habitOn(o, T);
  pushSet('Logged', id, 'history', was);
  if(today >= cap) o.history = was.filter(d=>d!==T);
  else {
    o.history = was.concat(T);
    const ms = measureOf(o);
    toast(ms ? `${o.title} · ${amountSaid(Math.min((today+1)*ms.step, ms.goal))} of ${amountSaid(ms.goal)}${ms.unit?' '+ms.unit:''} today`
        : cap>1 ? `${o.title} · ${today+1} of ${cap} today`
                : `${o.title} · ${streak(o)+0} day streak`);
  }
  save(); render();
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
/* ---- letting one thing out of the lock — decision 181 ------------------
   `movable` has been an attribute since decision 81: an object carrying it
   keeps its drag on a locked board and wears a pin at the top left to say so.
   What it has never had is a way in that is not three doors into the object
   editor — so in practice nothing on any desk has ever carried one, and the
   feature existed without being reachable. This is the way in, and the hold
   menu is where it lives.

   It writes the object's **own** attrs, because `attrsOf()` answers the
   object first and its type second: an object with nothing of its own
   inherits the type's list, and the moment one thing is said about it the
   whole list has to be said. So the undo step records `o.attrs` as it was,
   which is very often `undefined` — and that is the right value to restore,
   because it means "follow the type" and not "carry nothing".

   Not `resizable`. An object let out of the lock behaves exactly as it would
   on an unlocked board **except that its corners stay shut**: resizing is
   arranging, and arranging is what the lock is a switch for. */
function toggleFree(id){
  const o=byId(id); if(!o) return null;
  const now=attrsOf(o), free=now.includes('movable');
  pushSet(free ? 'Locked in place' : 'Free to move', id, 'attrs', o.attrs);
  o.attrs = free ? now.filter(a=>a!=='movable') : now.concat('movable');
  save();
  return !free;
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
/* ---- the garbage bin — decision 285 -------------------------------------
   Delete used to be removal, with twenty moves of undo and nothing after.
   Now Delete **files the thing in the bin**: a real container with a fixed
   id, made on the desk the first time anything is thrown away, whose board
   tumbles (gravityMode()). It is a reparent like any other, so it is undone
   like any other, and a picture in the bin is never reaped because its
   object is still in S.objects. What it came out of is written on it
   (`binFrom`, `binBox`, `binAt`), so Put back can return it to where it was.

   A thing **already in the bin** is deleted for good, which is how you take
   one thing out of the heap; Empty the bin does the lot. Both still undo. A
   drawer thrown away goes whole, with what is in it, and comes back whole:
   isGone() keeps its contents out of Today, search and every sorting drawer
   while it is there. */
function theBin(){
  let b = byId(BIN);
  if(b) return b;
  b = create('bin', {id:BIN, parent:ROOT, title:'Garbage bin', noSeed:true});
  delete b.setup;
  ['desk','phone'].forEach(dv=>{
    const [w,h] = sizeOfKind('bin', dv);
    b[dv] = fitSpot(w, h, dv, ROOT) || anySpot(w, h, dv, ROOT);
  });
  return b;
}
function binMany(ids){
  const live = ids.map(byId).filter(o=>o && o.id!==BIN && o.id!==ROOT && !inBin(o));
  if(!live.length) return [];
  const had = !!byId(BIN), steps = [];
  theBin();
  // the bin is an object too, so making it is part of the move that needed it
  if(!had) steps.push({add:BIN});
  live.forEach(o=>{
    ['parent','desk','phone','front','binFrom','binBox','binAt'].forEach(k=>steps.push({set:{id:o.id, k, v:o[k]}}));
    o.binFrom = o.parent; o.binBox = {desk:o.desk||null, phone:o.phone||null}; o.binAt = T;
    o.parent = BIN; keepSize(o);
  });
  const gone = live.map(o=>o.id);
  if(gone.includes(S.writeId)||gone.includes(S.readId)||gone.includes(S.viewId)) closeSheet();
  if(gone.includes(S.editId)) S.editId=null;
  S.sel=(S.sel||[]).filter(x=>!gone.includes(x));
  if(S.view==='drawer' && gone.includes(S.drawerId)){
    const up=byId(live[0].binFrom); S.drawerId = up ? up.id : null; S.view = up ? 'drawer' : 'desk'; }
  return steps;
}
/* Back where it came from: the container it was filed in if that is still on
   the desk, and its old box there if that is still clear; otherwise the desk,
   wherever there is room. */
function unbin(id){
  const o=byId(id); if(!o || !inBin(o) || o.parent!==BIN) return false;
  const from=byId(o.binFrom);
  const home = (o.binFrom===ROOT || (from && isContainer(from) && !inBin(from) && from.id!==BIN)) ? o.binFrom : ROOT;
  const steps=['parent','desk','phone','binFrom','binBox','binAt'].map(k=>({set:{id:o.id, k, v:o[k]}}));
  const was=o.binBox||{};
  o.parent = home;
  ['desk','phone'].forEach(dv=>{
    const b=was[dv];
    o[dv] = b && b.x!=null && boxOk(b, o.id, dv, home) ? Object.assign({}, b) : (b && b.w ? {w:b.w, h:b.h} : null);
  });
  delete o.binFrom; delete o.binBox; delete o.binAt;
  pushUndo('Put back', steps);
  const where = home===ROOT ? 'the desk' : (byId(home).title || 'its drawer');
  toast(`Back in ${where}`, true);
  return true;
}
// Everything in the bin, and everything inside what is in it.
const binned = ()=> S.objects.filter(inBin);
function emptyBin(){
  const ids = binned().map(o=>o.id);
  if(!ids.length){ toast('The bin is empty'); return; }
  const steps = removeMany(ids);
  pushUndo('Emptied the bin', steps);
  toast(`Emptied the bin · ${ids.length} gone for good`, true); render();
}
/* Delete: into the bin, or out of the world if it is in the bin already. */
function del(id){ delMany([id]); }
function delMany(ids){
  if(ids.includes(BIN)){ toast('The bin stays. Hold it to empty it'); ids = ids.filter(x=>x!==BIN); }
  const here = ids.map(byId).filter(Boolean);
  const forGood = here.filter(inBin).map(o=>o.id);
  // what is inside a thing deleted for good goes with it
  const inside = forGood.length ? S.objects.filter(o=>forGood.some(g=>o.parent===g || isAncestorId(g, o))).map(o=>o.id) : [];
  const steps = binMany(here.filter(o=>!inBin(o)).map(o=>o.id))
    .concat(forGood.length ? removeMany(forGood.concat(inside)) : []);
  if(!steps.length) return;
  const n = here.length;
  pushUndo(forGood.length ? 'Deleted' : 'Into the bin', steps);
  toast(forGood.length && forGood.length===n ? (n>1 ? `Deleted ${n} for good` : 'Deleted for good')
    : (n>1 ? `${n} things into the bin` : 'Into the bin'), true);
  render();
}
const isAncestorId = (a, o)=>{ let p=o && o.parent, n=0;
  while(p && p!==ROOT && n++<32){ if(p===a) return true; const up=byId(p); p=up && up.parent; }
  return false; };
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
  if(id===BIN){ toast('The bin stays. Hold it to empty it'); return; }
  // a drawer already in the bin goes for good; anywhere else, into the bin
  const forGood = inBin(d);
  if(S.drawerId===id){ S.drawerId = up===ROOT?null:up; S.view = up===ROOT?'desk':'drawer'; }
  steps.push(...(forGood ? removeMany([id]) : binMany([id])));
  pushUndo('Drawer removed', steps);
  toast(forGood ? 'Drawer deleted for good, its contents kept' : 'Drawer into the bin, its contents kept', true);
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
/* Several into the Void Drawer as **one move**, the way `unholdMany()` takes
   several out: the Undo on the toast puts every one of them back where it
   was. Taking a board away with things on it is what asks for this. */
function holdMany(ids){
  const live = ids.map(byId).filter(o=>o && !isHeld(o) && o.id!==ROOT);
  if(!live.length) return 0;
  pushSets('Held', live.flatMap(o=>[[o.id,'parent',o.parent], [o.id,'desk',o.desk],
    [o.id,'phone',o.phone], [o.id,'ord',o.ord]]));
  let last = heldObjects().reduce((m,x)=>Math.max(m, x.ord||0), 0);
  live.forEach(o=>{ o.parent=HOLD; keepSize(o); o.ord=++last; });
  save();
  return live.length;
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

   **A notch at a time is exact; two notches at once is not.** Small → Extra →
   Small comes home to the cell; Small → Large → Small does not, and the reason
   is worth knowing rather than shrugging at. Scaling the left *edge* while the
   width rounds to the nearest whole cell compresses the gaps between tiles: at
   ten columns a rack of two-wide fronts sits at 3, 5, 7, 9, and ×0.8 maps
   those to 3, 4, 6, 7 while every tile stays two wide — so two of them land on
   each other and the loser is dropped into the nearest free box. That is the
   honest cost of trying sizes on, and it is why this is a setting rather than
   a gesture. See decisions 48 and 60. */
function setGridSize(key, cid){
  // every tile is eight across since decision 272: there is nothing to choose
  if(TILE) return;
  const cols = PHONE_GRIDS[key];
  if(!cols) return;
  if(cid!=null){
    const t = cfgOf(cid); if(!t) return;
    const from = colsOf(cid, 'phone');
    if(cols!==from){
      /* Measured either side of the change, because a shelf's **height** moves
         with its width — the cell is square, so eight columns is thirteen rows
         and ten is fifteen — and a box has to come out of this on the shelf it
         went in on. See rescaleBoxes(). */
      const wasRows = shelfRows('phone', cid);
      t.grid = key;
      rescaleOneBoard(S.objects, cid, from, cols, 'phone',
        [wasRows, shelfRows('phone', cid)]);
    }
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
    // …and the objects on them, which is every object whose home is a follower.
    // Both numbers, taken either side of the switch: a shelf's height moves
    // with its width and a box has to stay on the shelf it was on.
    const wasRows = shelfRows('phone', ROOT);
    S.look.grid = key; GRID.phone.cols = cols;
    rescaleBoxes(S.objects.filter(o=>followers.has(o.parent||ROOT)), from, cols,
      'phone', [wasRows, shelfRows('phone', ROOT)]);
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
/* `cell` is the box a hold sketched, when there was one. A sketched box wins
   over the type's own size in placeAtPending(), so asking about the type's
   default was asking the wrong question: hold out two cells in a drawer, ask
   for an Image — six by four — and be told there is no room for a thing you
   had just made room for. */
function fits(kind, home, dv, cell){
  const d = dv || dev();
  const [w,h] = cell && cell.w ? [cell.w, cell.h] : sizeOfKind(kind, d, home);
  if(roomFor(w, h, d, home)) return true;
  const c = byId(home);
  /* A board that is full on purpose says so (decision 288). */
  const f = formOf(home);
  if(f.form!=='free'){
    const nm = home===ROOT ? 'The desk' : (c && c.title) || 'This board';
    toast(f.form==='fixed' || f.full==='stop'
      ? `${nm} is full`
      : `${nm} is full. Hold the wood beside it to add a tile`);
    return false;
  }
  /* a tile is added where you want it (decision 219), so that is the way
     out; since decision 276 by holding an empty slot, not pressing a plus */
  toast(home===ROOT
    ? 'No room on the Desk — hold an empty slot beside a tile to add another'
    : `No room in ${c && c.title ? c.title : 'here'} — hold an empty slot beside its board to add a tile`);
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
  /* The tag it already has, compared the way tags are matched — "Film" and
     "film" are one tag since decision 202, so asking for one must not make a
     second drawer beside the first. A Tag on the desk counts: it is a sorting
     drawer in another shape. */
  let d=S.objects.find(o=>isContainer(o)&&has(o,'magic')&&tagSlug((o.filter||{}).tag)===tagSlug(t));
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
    parent:homeFor((S.view==='drawer'&&S.drawerId)||ROOT),
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
  /* **A list can make things with no day** (decision 197). Everything that can
     carry a date is born on today, which is right for a task you type onto a
     board and wrong for a watchlist: four films filed "Today" read as overdue
     the next morning. A container carrying `undated` makes what goes into it
     without one, unless the maker said a day outright. */
  { const par = o.parent && byId(o.parent);
    if(par && par.undated && !(patch && 'due' in patch)) o.due = null; }
  /* A type that hangs from a gallery (a Painting, decision 208) is born with
     one of its pictures on it; a blank painting is not a thing. A caller
     that brought its own media keeps it. */
  { const gal = GALLERIES[k.gallery];
    if(gal && !(patch && patch.media)) hangPainting(o, gal[Math.floor(Math.random()*gal.length)]); }
  if(kindHas(kind,'container')){
    /* **A type may say what it looks like** (decision 236): an aspect of life
       comes with its own front colour, knob, moulding and grain, where an
       ordinary drawer rolls them. Filled in before the roll, so the roll only
       answers what the type left open; anything the caller passed wins. */
    if(k.look) Object.keys(k.look).forEach(key=>{ if(o[key]==null) o[key] = k.look[key]; });
    /* **A container states its size on both boards the moment it exists**,
       even though only one of them is being looked at. Its own board is its
       tile times four (decision 188) and that is read off the desk box — so a
       drawer made on a phone, which only ever got a `phone` box, had no size
       for the desk to state and opened onto a single shelf however big you
       made it. A box carrying a **size and no position** is exactly what
       `ensureBox()` knows how to place, so the other board fills itself in the
       first time it is drawn. Anything the caller passed wins. */
    ['desk','phone'].forEach(dv=>{
      if(o[dv] && o[dv].w) return;
      const [w,h] = sizeOfKind(kind, dv, o.parent);
      o[dv] = Object.assign({w, h}, o[dv]||{});
    });
    /* **A drawer you just made is a drawer you made in order to arrange**, so
       the board is unlocked when one arrives. The lock is one switch for
       everything (decision 74), so this is the switch and not a fact about the
       drawer — which is right: you are about to put things in it. */
    S.look.locked = false;
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
    /* The seventh family. `rl.plate` is usually `none` and `none` is truthy,
       which is the point: most fronts print their name on the wood, and the
       one in five that does not is what makes a rack of them read as
       furniture collected rather than bought. See decision 176. */
    o.plate=o.plate||rl.plate||sd.plate;
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
  let planned = false;
  if(!(patch&&patch.noSeed) && kindHas(kind,'container')){
    const pid = planForKind(kind);
    if(pid) planned = stampPlan(pid, o.id).length > 0;
  }
  /* **A type that opens onto a board does not also get the seed.** The seed
     is a spawner along the top, placed rather than left to ensureBox, and a
     plan's own first row is there too — so a Film came out with "Add to this
     film…" lying across the plan's label. The plan is the whole of what the
     type is born holding; the seed is for a type that has none, or whose plan
     has been thrown away. See decision 195. */
  if(!(patch&&(patch.noSeed||patch.seedless)) && !planned) seedInto(o, kind);
  delete o.noSeed; delete o.seedless;
  return o;
}
/* What a type is born holding. Its own function because `becomeKind()` needs it
   too: a task that turns out to be a project should arrive holding the same
   band a new project does, or it is a project with no way in. */
function seedInto(o, kind){
  (K(kind).seed||[]).forEach((sp,i)=>{
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
}

/* ---- a thing that turned out to be bigger than it was ------------------
   A task you keep adding to is a project, and noticing that is the commonest
   reason to want to change what something *is*. The editor's Type row has
   always been able to do it; what it could not do is what a conversion
   actually needs — the box, and what the new type is born holding.

   Three things happen and they are one move on the stack, because one press
   did all three:

     the **type**, and its attributes with it, which is what the Type row does
     the **box**, taken to the new type's size where there is room for it —
       an 8×1 task is a spine as a project, and a project is a front you look
       at. Where there is no room it keeps the box it had rather than moving:
       a conversion must never file a thing somewhere else.
     the **seed**, but only into something holding nothing. A project is born
       with a band you type into; one you converted into needs the same way in,
       and one that already has children has its own.

   Never a branch on a name: `kindHas(kind,'container')` is what decides
   whether there is anything to seed, and the caller decides which types are
   worth offering. */
function becomeKind(id, kind){
  const o=byId(id);
  if(!o || !KINDS[kind] || o.kind===kind) return null;
  const clone = v => v==null ? v : JSON.parse(JSON.stringify(v));
  pushSets(`Made a ${K(kind).nm.toLowerCase()}`, [
    [id,'kind',o.kind], [id,'attrs',clone(o.attrs)], [id,'milestones',clone(o.milestones)],
    [id,'desk',clone(o.desk)], [id,'phone',clone(o.phone)], [id,'layout',o.layout]]);
  /* A layout nobody chose (the old type's own, copied in by create()) is the
     new type's (decision 298): a drawer made into a Brain Dump from its setup
     card stayed a grid, where the Brain Dump is a list. */
  if(isContainer(o) && K(kind).layout && (!o.layout || o.layout===K(o.kind).layout)) o.layout = K(kind).layout;
  o.kind=kind; o.attrs=null;
  if(has(o,'progress') && !(o.milestones||[]).length)
    o.milestones=[{t:'First milestone',done:false,d:dz(30)}];
  const home=o.parent||ROOT;
  ['desk','phone'].forEach(dv=>{
    const b=o[dv]; if(!b) return;
    /* The new type's size at the old corner, stepping the **long side** down
       until it fits — fitSpot()'s rule with the origin held, because a
       conversion may change what a thing is and must never change where it
       is. It gives up the proportion before it gives up the place, and gives
       up both before it comes out *smaller* than the box it already had: a
       task that turned into a project is not a stamp. */
    let [w,h]=sizeOfKind(kind, dv, home);
    while(!boxOk({x:b.x,y:b.y,w,h}, o.id, dv, home) && (w>1 || h>1)){
      if(w>=h) w--; else h--;
    }
    if(w*h >= b.w*b.h) o[dv]={x:b.x, y:b.y, w, h};
  });
  if(kindHas(kind,'container') && !childrenOf(o).length) seedInto(o, kind);
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
  /* No seed (a flow is still laid): what it is born holding would sit among
     the two that made it (decision 269). And it wears what the one underneath was wearing — its
     colour and its back — so two claret cards make a claret deck, with the
     one you dropped onto on top. */
  const c=create(kind, {parent:home, title:K(kind).nm, seedless:true});
  a.parent=c.id; b.parent=c.id;
  keepSize(a); keepSize(b);
  b.ord=0; a.ord=1;
  if(b.c!=null) c.c=b.c;
  if(b.back) c.back=b.back;
  c.top=b.id;
  const [kw,kh]=sizeOfKind(kind, dv, home);   // never K(kind).size — a board states its own columns
  const want={x:box.x, y:box.y, w:kw, h:kh};
  c[dv] = boxOk(want, c.id, dv, home) ? want : anySpot(kw, kh, dv, home);
  toast(`Made a ${K(kind).nm.toLowerCase()}`);
  return c;
}

/* ---- a compound, made — decision 254 -----------------------------------
   Every part is an ordinary object, made the ordinary way and set up already
   (a part answers its own questions from the table, so none of them asks on
   its first tap), placed at its offset from one corner, and given the one
   `grp` that makes them move as one. The corner is the cell the Magic
   Selector drew when the whole footprint is free there, and otherwise the
   first place the whole footprint fits: a compound is never scattered to
   make it fit, because apart it is not the thing it was.

   The other device is given the same arrangement where it has room for it at
   the same numbers, and only sizes where it has not, which `ensureBox()`
   then places one by one: the group still moves as one there once it is put
   back together, and nothing is lost.

   **One undo move**, so the Undo on the toast takes the whole of it back. */
function makeCompound(kind, at){
  const d = K(kind); if(!d.parts) return null;
  const dv = dev(), other = dv==='phone' ? 'desk' : 'phone';
  const home = homeFor((at && at.parent) || (S.view==='drawer' && S.drawerId) || ROOT);
  const [fw, fh] = d.size;
  let o0 = null;
  if(at && at.x!=null){ const b = {x:at.x, y:at.y, w:fw, h:fh}; if(boxOk(b, null, dv, home)) o0 = b; }
  if(!o0) o0 = freeSpot(fw, fh, dv, home);
  if(!o0 || o0.w<fw || o0.h<fh){ toast(`No room for a ${d.nm.toLowerCase()} on this board`); return null; }
  const otherFits = boxOk({x:o0.x, y:o0.y, w:fw, h:fh}, null, other, home);
  const grp = uid('g'), refs = {}, made = [];
  d.parts.forEach(s=>{
    const o = create(s.k, Object.assign({parent:home, title:s.t||K(s.k).nm, noSeed:true},
      s.set ? JSON.parse(JSON.stringify(s.set)) : {}));
    delete o.setup;
    const box = {x:o0.x+s.b[0]-1, y:o0.y+s.b[1]-1, w:s.b[2], h:s.b[3]};
    o[dv] = box;
    o[other] = otherFits ? Object.assign({}, box) : {w:s.b[2], h:s.b[3]};
    o.grp = grp;
    if(s.ref) refs[s.ref] = o.id;
    made.push([o, s]);
  });
  const said = r => refs[String(r||'').replace(/^@/, '')];
  made.forEach(([o, s])=>{
    if(s.tracks && said(s.tracks)) o.tracks = said(s.tracks);
    (s.rel||[]).forEach(r=>{ if(said(r)) relate(o.id, said(r)); });
  });
  pushUndo(`Made a ${d.nm.toLowerCase()}`, made.map(([o])=>({add:o.id})));
  return made.map(([o])=>o);
}

/* ---- what a line reads as — decision 258 ---------------------------------
   A notepad set to `smart` makes whatever the words say they are: a question
   ends in a question mark, a quote opens with a quotation mark, "idea:" or
   "what if" is an idea, "problem:" or "bug:" a problem, and an errand (it
   starts with a doing word, a box, "todo", or asks for a day with !today) is
   a task. Anything else is a thought when it is short and a note when it runs
   on. A `/type` at the start still wins, through quickAdd(). The cue a line
   was recognised by is taken off it, so "idea: a shelf for records" is an
   idea called "a shelf for records". */
const ERRANDS = ['buy','call','email','text','send','pay','book','fix','clean','finish','write',
  'read','watch','make','get','pick','return','schedule','order','check','remember','cancel',
  'renew','submit','print','post','ship','wash','water','feed','take','bring','ask','tell',
  'reply','draft','plan','sort','file','move','update','install','charge','collect','visit'];
/* ---- reading a line — decision 305 --------------------------------------
   Capture without deciding (STOCKTAKE §3.3). A line typed anywhere (a
   notepad, an inbox, a list's add box) is read for **when**, **how much it
   matters** and **where it goes**, so a thought lands dated and filed without
   a menu: "call Sam friday", "dentist oct 12 !!", "buy oil @kitchen
   tomorrow". What was understood is taken off the name and said in the toast,
   with Undo, so the reading is visible and cheap to refuse.

   A day is read **only at the end of the line, at its start, or after on,
   by or due**: "Call Sam friday" is dated and "Watch Friday Night Lights" is
   not. Weekdays mean the next one to come (a weekday that is today means a
   week on, unless it says "this"); a month and day this year, or next year
   once it has passed. `!` to `!!!` is a priority of 3 to 5; `@name` is the
   first drawer whose name starts with it; `#tag` is a tag. The old cues
   (`!today`, `!tomorrow`, `!week`) still work. */
const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const wkIdx = w => WEEKDAYS.findIndex(d=>d.startsWith(w) && w.length>=3);
const moIdx = m => MONTHS.findIndex(d=>d.startsWith(m) && m.length>=3);
const WD = '(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
const MO = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)';
/* [pattern, the day it means, months on, may it open the line]. Only the
   words that are almost never a title may open one: "Today show recap" is a
   title, "Tomorrow pick up the lens" is not. */
const DAY_PHRASES = [
  [/(today|tonight)/, m=>0, null, m=>m[1]==='tonight'],
  [/(tomorrow|tmrw|tmr)/, ()=>1, null, ()=>true],
  [/(?:this )?weekend/, ()=>{ const w=D.today().getDay(); return w===6 ? 0 : 6-w; }, null, ()=>true],
  [/next week/, ()=>{ const w=D.today().getDay(); return ((8-w)%7)||7; }, null, ()=>true],
  [/in (\d{1,3}) (day|days|week|weeks|month|months)/, m=>{ const n=+m[1], u=m[2][0]; return u==='d' ? n : u==='w' ? n*7 : 0; }, m=>m[2][0]==='m' ? +m[1] : 0],
  [new RegExp('(this |next )?'+WD), m=>{ const want=wkIdx(m[2]), now=D.today().getDay();
      let d=(want-now+7)%7; if(d===0 && m[1]!=='this ') d=7; return d; }],
  [new RegExp(MO+' (\\d{1,2})(?:st|nd|rd|th)?'), m=>({mo:moIdx(m[1]), day:+m[2]})],
  [new RegExp('(\\d{1,2})(?:st|nd|rd|th)? '+MO), m=>({mo:moIdx(m[2]), day:+m[1]})],
  [/(\d{4})-(\d{2})-(\d{2})/, m=>({iso:`${m[1]}-${m[2]}-${m[3]}`})],
];
function dayFrom(v, months){
  if(v==null) return null;
  if(typeof v==='number'){ const d=D.add(D.today(), v); if(months){ d.setMonth(d.getMonth()+months); } return D.iso(d); }
  if(v.iso) return v.iso;
  if(v.mo<0 || !(v.day>=1 && v.day<=31)) return null;
  const t=D.today(); let d=new Date(t.getFullYear(), v.mo, v.day);
  if(d.getMonth()!==v.mo) return null;
  // a day passed within the month is late this year, not next year
  if(d < D.add(t, -31)) d=new Date(t.getFullYear()+1, v.mo, v.day);
  return D.iso(d);
}
function readLine(text){
  let t = ' '+String(text||'').replace(/\s+/g,' ').trim()+' ';
  const out = {due:null, prio:null, tags:[], into:null, said:[]};
  // the old cues first, exactly as they were
  if(/!today\b/i.test(t)){ out.due=T; t=t.replace(/!today\b/i,' '); }
  else if(/!tomorrow\b/i.test(t)){ out.due=dz(1); t=t.replace(/!tomorrow\b/i,' '); }
  else if(/!week\b/i.test(t)){ out.due=dz(7); t=t.replace(/!week\b/i,' '); }
  t = t.replace(/\s#([\w-]+)/g, (m,g)=>{ out.tags.push(g); return ' '; });
  t = t.replace(/\s(!{1,3})(?=\s)/, (m,b)=>{ out.prio = 2+b.length; return ' '; });
  // a place, by the start of its name: @kitchen, @low-tide
  t = t.replace(/\s@([\w'’-]+)/, (m,w)=>{
    const k = w.toLowerCase().replace(/[-'’]/g,'');
    const c = S.objects.find(o=>o && isContainer(o) && !has(o,'magic') && !isGone(o)
      && String(o.title||'').toLowerCase().replace(/[^a-z0-9]/g,'').startsWith(k));
    if(!c) return m;
    out.into = c; return ' ';
  });
  if(!out.due){
    for(const [re, fn, mfn, opens] of DAY_PHRASES){
      const src = re.source;
      const cue = new RegExp('(\\s(?:on|by|due)\\s)'+src+'(?=\\s)', 'i');
      const end = new RegExp('(\\s)'+src+'\\s*$', 'i');
      const start = new RegExp('^(\\s)'+src+'(?=\\s\\S)', 'i');
      const lower = h => h && [h[0].toLowerCase(), ...h.slice(2).map(x=>x==null ? x : x.toLowerCase())];
      let hit = t.match(cue) || t.match(end), grp = lower(hit);
      if(!hit){ hit = t.match(start); grp = lower(hit); if(hit && !(opens && opens(grp))) hit = null; }
      if(!hit) continue;
      const v = fn(grp), d = dayFrom(v, mfn ? mfn(grp) : 0);
      if(!d) continue;
      out.due = d; t = t.replace(hit[0], ' ');
      break;
    }
  }
  out.text = t.replace(/\s+/g,' ').replace(/\s+([,.;:!?])/g,'$1').trim() || String(text||'').trim();
  return out;
}
/* What a line became, for the toast: "A task, due Friday, into Kitchen". */
function madeSaid(o, where){
  if(!o) return '';
  const bits = [`A ${K(o.kind).nm.toLowerCase()}`];
  if(o.due && o.due!==T){ const h = D.human(o.due);
    bits.push('due '+(/^(today|tomorrow|yesterday)$/i.test(h) ? h.toLowerCase() : h)); }
  else if(o.due===T && has(o,'check')) bits.push('for today');
  if(prioOf(o)!=null && prioOf(o)>=3) bits.push('priority '+prioOf(o));
  if(where) bits.push(where);
  return bits.join(', ');
}

function guessKind(text){
  const t = String(text||'').trim(), lo = t.toLowerCase();
  const ok = k => KINDS[k] && !isCut(k) ? k : null;
  const first = (lo.match(/^[a-z']+/)||[''])[0];
  const cue = (k, re) => ({kind: ok(k) || 'note', text: t.replace(re, '').trim() || t});
  if(/^\//.test(t)) return {kind:'note', text:t};
  if(/^(idea|what if)\b:?/i.test(t)) return cue('idea', /^idea\s*:?\s*/i);
  if(/^(problem|bug|issue)\b\s*:/i.test(t)) return cue('problem', /^(problem|bug|issue)\s*:\s*/i);
  if(/^(\[ ?\]|- ?\[ ?\]|todo\b:?|to do\b:?)/i.test(t)) return cue('task', /^(\[ ?\]|- ?\[ ?\]|todo\s*:?|to do\s*:?)\s*/i);
  if(/\?\s*$/.test(t)) return {kind: ok('question') || 'note', text:t};
  if(/^["“'‘]/.test(t)) return {kind: ok('quote') || 'note', text:t.replace(/^["“'‘]|["”'’]$/g, '').trim() || t};
  if(/!(today|tomorrow|week)\b/i.test(t) || ERRANDS.includes(first)) return {kind: ok('task') || 'note', text:t};
  // a line that names a day is something to do on it (decision 305)
  if(readLine(t).due) return {kind: ok('task') || 'note', text:t};
  const words = (t.match(/\S+/g)||[]).length;
  return {kind: words<=12 ? (ok('thought') || 'note') : 'note', text:t};
}

/* ---- counting to something — decision 265 --------------------------------
   A ticker counts up for ever unless it is given a `goal`; a progress bar's
   goal is its number of steps. Reaching it does what `atGoal` says: stay
   there and say so (the default), be finished (a thing done leaves its board
   for the archive, as everything done does), or start again from nought,
   which is a count kept per day or per session. Called after the number has
   moved, by whatever moved it. */
const AT_GOAL = {stay:'Stays there, marked', done:'Is finished', reset:'Starts again from nought'};
const goalOf = o => { if(!o) return 0;
  if(shapeOf(o)==='bar') return (o.steps || K(o.kind).steps || 10);
  const g = +o.goal; return g>0 ? g : 0; };
function reachedGoal(o, n){
  const g = goalOf(o); if(!g || n < g) return false;
  const how = AT_GOAL[o.atGoal] ? o.atGoal : 'stay';
  if(how==='reset'){
    pushSet('Started again', o.id, shapeOf(o)==='bar' ? 'at' : 'count', n);
    if(shapeOf(o)==='bar') o.at = 0; else o.count = 0;
    toast(`Reached ${g} · back to nought`, true); return true;
  }
  if(how==='done' && !o.done){
    pushSets('Finished', [[o.id,'done',o.done], [o.id,'doneAt',o.doneAt]]);
    o.done = true; o.doneAt = T;
    toast(`Reached ${g} · finished`, true); return true;
  }
  toast(`Reached ${g}`); return true;
}

function quickAdd(text, kind, drawerId){
  let t=text.trim(); if(!t) return null;
  let k=kind||'task';
  const slash=t.match(/^\/(\w+)\s+/);
  if(slash){ const found=KEYS.find(x=>x.startsWith(slash[1].toLowerCase())); if(found){ k=found; t=t.slice(slash[0].length); } }
  // when, how much and where, read off the line (decision 305)
  const r = readLine(t); t = r.text;
  const home = r.into ? homeFor(r.into.id) : drawerId;
  quickAdd.last = r;
  // a shelf is finite: a line typed into a full board makes nothing and says so
  if(!fits(k, home || homeFor((S.view==='drawer' && S.drawerId) || ROOT))) return null;
  const o=create(k,{title:t, tags:r.tags, parent:home||undefined, body:''});
  if(r.due) o.due=r.due; else if(!kindHas(k,'date')) o.due=null;
  if(r.prio!=null) o.prio=r.prio;
  return o;
}

/* Typing into a container makes one of what it collects, in it. A magic
   container holds nothing, so the new object goes where the container itself
   lives and the rule collects it straight back — which is the only way a thing
   you typed into a calendar can appear on the calendar. `patch` is for the
   caller that aimed at a particular day. */
function spawnInto(c, text, patch){
  if(!c) return null;
  if(isInbox(c)) return inboxTake(c, text, patch);
  const home = homeFor(c.id);
  const o = quickAdd(text, genKindOf(c), home);
  if(o && patch) Object.assign(o, patch);
  return o;
}

/* ---- the inbox — decision 286 --------------------------------------------
   A line written into an inbox becomes what it reads as and leaves by the
   pipe that carries that kind, or stays in the inbox when none does. Nothing
   it makes is dated unless the line asked for a day (!today): a brain dump
   is not a list of things due this morning. It says where the thing went,
   because the inbox chose and the toast is how you know. */
function inboxTake(c, text, patch){
  const raw = String(text||'').trim(); if(!raw) return null;
  const g = guessKind(raw);
  const dest = pipeFor(c, g.kind);
  const o = quickAdd(g.text, g.kind, dest ? dest.id : c.id);
  if(!o) return null;
  if(!readLine(raw).due && !(patch && 'due' in patch)) o.due = null;
  if(patch) Object.assign(o, patch);
  pushUndo('Written in', [{add:o.id}]);
  const went = byId(o.parent);
  toast(madeSaid(o, o.parent===c.id ? 'in the inbox'
    : dest && o.parent===dest.id ? `down the pipe to ${dest.title||'its drawer'}` : `into ${(went||{}).title||'its drawer'}`), true);
  return o;
}
/* Everything already waiting in an inbox, sent down whichever pipe carries
   it: what was written before the pipes were laid, or dropped in by hand.
   One move, however many it sends. */
function sortInbox(id){
  const c = byId(id); if(!isInbox(c)) return 0;
  const sets = [];
  let sent = 0;
  S.objects.filter(o => o.parent===c.id && !isContainer(o)).forEach(o=>{
    const dest = pipeFor(c, o.kind); if(!dest) return;
    sets.push([o.id,'parent',o.parent], [o.id,'desk',o.desk], [o.id,'phone',o.phone]);
    o.parent = dest.id; keepSize(o); sent++;
  });
  const left = S.objects.filter(o => o.parent===c.id).length;
  if(!sent){ toast(left ? 'No pipe carries what is left here' : 'The inbox is empty'); return 0; }
  pushSets('Sorted the inbox', sets);
  toast(`Sent ${sent} down the pipes${left ? ` · ${left} left here` : ''}`, true);
  return sent;
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
             on:()=>!!setting('pinned'),  flip(){ setSetting('pinned', !setting('pinned') || null); }},
  style:    {nm:'Aesthetic', ic:'brush', ds:'Walks the aesthetics',
             cycle:()=>Object.keys(STYLES), get:()=>styleKey(),
             said:v=>(STYLES[v]||{}).nm||v, set(v){ applyStyle(v); }},
  dark:     {nm:'Light',     ic:'eye',   ds:'Follow the device, or insist',
             cycle:()=>Object.keys(DARKMODES), get:()=>setting('dark')||'auto',
             said:v=>DARKMODES[v]||v, set(v){ setSetting('dark', v); applyLook(); }},
  check:    {nm:'Checkbox',  ic:'check', ds:'Which box every check in the app is drawn in',
             cycle:()=>Object.keys(CHECKS), get:()=>CHECKS[S.look.check]?S.look.check:'square',
             said:v=>CHECKS[v]||v, set(v){ S.look.check=v; applyLook(); }},
  grid:     {nm:'Grid',      ic:'grid',  ds:'How fine a phone board is',
             cycle:()=>Object.keys(PHONE_GRIDS), get:()=>S.look.grid||'small',
             said:v=>v[0].toUpperCase()+v.slice(1), set(v){ setGridSize(v); }},
  parallax: {nm:'Depth',     ic:'resize',ds:'What answers the phone being tilted',
             cycle:()=>Object.keys(TILT_MODES), get:()=>tiltMode(),
             said:v=>TILT_MODES[v]||v, set(v){ S.look.parallax=v; applyLook(); }},
  /* A lever on the desk that drops everything on it — including, once the heap
     has settled, itself. The press goes through `render()` like every other
     control, and the fall is picked back up by `gravitySync()` at the end of
     it; the settle-back is Settings' alone, because there is nothing left to
     walk home once a render has rebuilt the board. See decision 166. */
  gravity:  {nm:'Gravity',   ic:'drop',  ds:'The shelf lets go, and everything on it falls',
             cycle:()=>Object.keys(GRAVITIES), get:()=>gravityMode(),
             said:v=>GRAVITIES[v]||v,
             set(v){ setSetting('gravity', v && v!=='off' ? v : null); }},
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
  // a Button set to flip a switch is one too (decision 243)
  const o=byId(id); if(!o || !(has(o,'control') || doesOf(o)==='switch')) return;
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
  /* **Anything the fifteen reach** (decision 244). It was the paper and the
     pictures only: no Note (Note heads a family, and heads were left out), no
     drawer or list, no clock or candle, no ornament. What stays out is what
     cannot exist without a question answered first (a tag and a sorting
     drawer need their rule, an aspect of life its part of your life, an
     achievement the thing you did), a category (a question, not a thing),
     Random itself, what was cut, and a deck (a deck of no cards is a box).
     A Background is in since decision 257, at no more than four by four so it
     lies under a corner of the board rather than all of it. */
  /* Since decision 261 an achievement, a deck and a tag are in too: `roll()`
     answers the question each would have asked (a thing done, a card, a tag
     to sort for). Only a bare Aspect of Life stays out, because its types
     (`lf_*`) are all in the bag and each is that answer already. */
  const ok = k => KINDS[k] && !isCut(k) && !isShelved(k) && !K(k).cat && !K(k).makesAny
    && !K(k).asksLife && !kindHas(k,'control') && !K(k).parts;
  /* **One of the fifteen, then one of what it holds.** Flat, a third of the
     tosses were a part of your life or a kind of project, each laying a whole
     flow down, because there are thirty-four of those and one Jar. */
  const bags = MASTERS.map(([m, also])=>{
    const seen = new Set(), walk = k => { if(!k || seen.has(k) || !KINDS[k]) return; seen.add(k); (K(k).family||[]).forEach(walk); };
    walk(m); (also||[]).forEach(walk);
    return [...seen].filter(ok);
  }).filter(b=>b.length);
  const bag = bags[Math.floor(Math.random()*bags.length)];
  return bag ? bag[Math.floor(Math.random()*bag.length)] : 'note';
}

/* ---- pictures that ship with the app — decision 204 --------------------
   A dozen public-domain paintings and photographs under `img/pictures/`
   (where each came from is docs/IMAGES.md), so a collage, an image or a
   postcard made while trying things out has something in it. They are named
   by `media.url` rather than stored: the file is in the shell, cached with
   the rest of the app, and `snapshot()` keeps the url while it strips `src`. */
const PICTURES = [
  {f:'p01.jpg', t:'The Great Wave'},
  {f:'p02.jpg', t:'The Oxbow'},
  {f:'p03.jpg', t:'Still Life with Flowers and Fruit'},
  {f:'p04.jpg', t:'Empress Josephine rose'},
  {f:'p05.jpg', t:'Map of Alexandria'},
  {f:'p06.jpg', t:'Boulevard Montmartre, Winter Morning'},
  {f:'p07.jpg', t:'Northeaster'},
  {f:'p08.jpg', t:'The Horse Fair'},
  {f:'p09.jpg', t:'Young Woman with a Water Pitcher'},
  {f:'p10.jpg', t:'Moonlight, Strandgade 30'},
  {f:'p11.jpg', t:'Wheat Field with Cypresses'},
  {f:'p12.jpg', t:'Piazza San Marco'},
];
const samplePicture = ()=> PICTURES.length ? PICTURES[Math.floor(Math.random()*PICTURES.length)] : null;
function pictureMedia(p){
  const url = (p.dir||'img/pictures/')+p.f;
  return {type:'image', url, src:url, label:p.t};
}
/* ---- the paintings — decision 208 --------------------------------------
   Twenty-six Impressionist and Post-Impressionist paintings from the Met's
   open-access collection, under `img/paintings/` (docs/IMAGES.md says where
   each came from). A **Painting** is the Image type's subtype that is always
   one of these: a type that says `gallery:'paintings'` is born holding one at
   random and its editor picks among them, where an Image holds whatever you
   gave it. The Met marks its Monets as not public domain, so there are none. */
const PAINTINGS = [
  ['a01','By the Seashore','Renoir','1883'],
  ['a02','Bouquet of Chrysanthemums','Renoir','1881'],
  ['a03','A Road in Louveciennes','Renoir','c. 1870'],
  ['a04','The Dance Class','Degas','1874'],
  ['a05','A Woman Seated beside a Vase of Flowers','Degas','1865'],
  ['a06','The Garden of the Tuileries on a Spring Morning','Pissarro','1899'],
  ['a07','The Harvest, Pontoise','Pissarro','1881'],
  ['a08','Barges at Pontoise','Pissarro','1876'],
  ['a09','The Bridge at Villeneuve-la-Garenne','Sisley','1872'],
  ['a10','Rue Eugène Moussoir at Moret: Winter','Sisley','1891'],
  ['a11','Allée of Chestnut Trees','Sisley','1878'],
  ['a12','Young Woman Knitting','Morisot','c. 1883'],
  ['a13','Chrysanthemums in the Garden at Petit-Gennevilliers','Caillebotte','1893'],
  ['a14','Still Life with Apples and a Pot of Primroses','Cézanne','c. 1890'],
  ['a15','The Gulf of Marseille Seen from L’Estaque','Cézanne','c. 1885'],
  ['a16','Mont Sainte-Victoire and the Viaduct','Cézanne','1882–85'],
  ['a17','Irises','Van Gogh','1890'],
  ['a18','Sunflowers','Van Gogh','1887'],
  ['a19','Olive Trees','Van Gogh','1889'],
  ['a20','Gray Weather, Grande Jatte','Seurat','c. 1886–88'],
  ['a21','Ia Orana Maria','Gauguin','1891'],
  ['a22','Tahitian Landscape','Gauguin','1892'],
  ['a23','Boating','Manet','1874'],
  ['a24','The Monet Family in Their Garden at Argenteuil','Manet','1874'],
  ['a25','At the Seaside','Chase','c. 1892'],
  ['a26','Pines Along the Shore','Cross','1896']
].map(([f,t,a,d])=>({f:f+'.jpg', t, a, d, dir:'img/paintings/'}));
/* ---- the clips — decision 230 -----------------------------------------
   Ten public-domain animated GIFs from Wikimedia Commons — Muybridge's and
   Marey's motion studies, three optical-toy discs, two Reynaud strips and two
   NASA globes — made into short looping MP4s under `img/clips/`, each with a
   still of its first frame (docs/IMAGES.md says where each came from). An
   MP4 because a Video is a `<video>` and a GIF is not one; the clip `loop`s,
   which is what the GIF did. A Video made at random is born holding one. */
const CLIPS = [
  ['v01','A Race Horse Galloping','Eadweard Muybridge','1887'],
  ['v02','A Lion Walking','Eadweard Muybridge','1887'],
  ['v03','Camel Racking','Eadweard Muybridge','1887'],
  ['v04','Flight of a Gull','Étienne-Jules Marey','1890'],
  ['v05','Running Rats (phenakistiscope)','Thomas Mann Baynes','1833'],
  ['v06','Cats and Donkey (phenakistiscope)','Unknown artist','c. 1830'],
  ['v07','At the Pump (praxinoscope strip)','Émile Reynaud','1878'],
  ['v08','Pauvre Pierrot','Émile Reynaud','1892'],
  ['v09','Saturn Turning','NASA/JPL-Caltech/Space Science Institute (Cassini)','2016'],
  ['v10','The Earth Turning','NASA EPIC (DSCOVR)','2016']
].map(([f,t,a,d])=>({f, t, a, d}));
function clipMedia(c){
  const url = 'img/clips/'+c.f+'.mp4';
  return {type:'video', url, src:url, label:c.t, poster:'img/clips/'+c.f+'.jpg', loop:true};
}
/* ---- the sounds — decision 244 ----------------------------------------
   Public-domain recordings (docs/IMAGES.md says where each came from), a
   minute at most, mono MP3 under `img/sounds/`, beside the clips. An Audio
   made at random is born holding one, so it plays rather than being a blank
   disc: ragtime, Bach, a Haydn quartet, early jazz, a fiddle duet, a Sousa
   march, a garden of birds and Apollo 11. */
const SOUNDS = [
  ['s01',"Maple Leaf Rag","Scott Joplin",'1916'],
  ['s02',"Prelude in C major","Kimiko Ishizaka · Bach",'2015'],
  ['s03',"The Lark, finale","Musopen String Quartet · Haydn",'2012'],
  ['s04',"Livery Stable Blues","Original Dixieland Jass Band",'1917'],
  ['s05',"Arkansaw Traveler","Gilliland & Robertson",'1922'],
  ['s06',"The Stars and Stripes Forever","US Marine Band · Sousa",''],
  ['s07',"Birds in a garden","Akum20",'2025'],
  ['s08',"One small step","Neil Armstrong",'1969']
].map(([f,t,a,d])=>({f, t, a, d}));
function soundMedia(c){
  const url = 'img/sounds/'+c.f+'.mp3';
  return {type:'audio', url, src:url, label:c.t};
}
const GALLERIES = {paintings: PAINTINGS};
const galleryOf = o => o && GALLERIES[K(o.kind).gallery] || null;
/* Hang one of a gallery's paintings on an object. The name follows the
   painting while it is still the painting's name — a title you wrote
   yourself is never overwritten. */
function hangPainting(o, p){
  const was = o.media && o.media.label;
  o.media = pictureMedia(p);
  if(!o.title || o.title===was) o.title = p.t;
}
/* ---- the words a random thing is born with — decision 244 --------------
   Public-domain writing (docs/TEXTS.md says where each came from) in
   `data/texts.json`: stories, fables, poems, Shakespeare's speeches, essay
   openings, first lines of novels and letters. Fetched once after the first
   render rather than imported, so the app does not parse two hundred
   kilobytes of Poe to boot; a thing made before it arrives is filled the
   moment it does, if its words are still empty. */
let TEXTS = null, TEXTS_AT = null;
const WAITING = new Set();
function loadTexts(){
  if(TEXTS || TEXTS_AT) return TEXTS_AT;
  TEXTS_AT = fetch('data/texts.json').then(r=>r.json()).then(list=>{
    TEXTS = Array.isArray(list) ? list : [];
    let any = false;
    WAITING.forEach(id=>{ const o = byId(id); if(o && wordless(o)){ writeText(o); any = true; } });
    WAITING.clear();
    if(any){ save(); render(); }
  }).catch(()=>{ TEXTS = []; });
  return TEXTS_AT;
}
const pick = a => a[Math.floor(Math.random()*a.length)];
const chance = p => Math.random() < p;
/* Which writing suits which type: a poem wants a poem, a script a speech, a
   quotation a first line, a letter a letter; a note, a thought or an idea
   takes anything. Asked of the type's shape and traits, not its name. */
function textKindsFor(o){
  // a type may say outright what it is written in (an essay is a plain sheet)
  if(K(o.kind).writes) return [K(o.kind).writes];
  const sh = shapeOf(o);
  if(sh==='verse') return ['poem'];
  if(sh==='quote') return ['opening'];
  if(sh==='letter' || sh==='postcard' || sh==='telegram') return ['letter'];
  if(sh==='page') return ['speech'];
  if(K(o.kind).narrative) return ['fable','opening'];
  return ['story','fable','poem','opening','essay','speech','letter'];
}
/* Nothing written yet: empty, or still the type's own prompts. Prompts are
   kept on a type whose writing is generic (an idea's three questions are the
   point of an idea) and replaced where the writing is specific (a script's
   stage direction is a placeholder for a script). */
function wordless(o){
  const tpl = K(o.kind).body || '';
  return !o.body || (o.body===tpl && textKindsFor(o).length < 7);
}
function writeText(o){
  const ks = textKindsFor(o);
  const pool = (TEXTS||[]).filter(t=>ks.includes(t.k));
  const t = pool.length ? pick(pool) : null;
  if(!t) return false;
  const by = [t.a, t.d].filter(Boolean).join(', ');
  o.body = shapeOf(o)==='quote' ? `${t.body}\n\n— ${t.a}, *${t.t}*`
    : `${t.body}${by ? `\n\n*${by}*` : ''}`;
  if(!o.title || o.title===K(o.kind).nm) o.title = t.t;
  return true;
}
// where a portal made at random goes: places made for wandering
const WANDER = [['A random article','https://en.wikipedia.org/wiki/Special:Random'],
  ['Project Gutenberg','https://www.gutenberg.org/ebooks/search/?sort_order=random'],
  ['The Met, open access','https://www.metmuseum.org/art/collection/search?showOnly=openAccess'],
  ['Astronomy Picture of the Day','https://apod.nasa.gov/apod/astropix.html'],
  ['The Internet Archive','https://archive.org/'],
  ['Wikisource','https://en.wikisource.org/wiki/Special:Random'],
  ['A random Commons picture','https://commons.wikimedia.org/wiki/Special:Random/File'],
  ['The Public Domain Review','https://publicdomainreview.org/']];
// two of these name a drawer made at random: "Cedar ledger", "Harbour thistle"
const NAMES = 'brass ledger cedar tide quarry lantern vellum thistle harbor ember slate poppy compass juniper marrow orchard cobalt linen saffron pewter'.split(' ');
/* Things to do, for a task made at random: the ordinary run of a week. */
const CHORES = ['Water the plants','Call the bank','Return the library books','Buy stamps','Oil the hinge on the back door',
  'Book a haircut','Back up the laptop','Clear the inbox','Pay the electric bill','Sharpen the kitchen knives',
  'Write to Grandma','Renew the passport','Take the bins out','Wash the car','Replace the smoke alarm battery',
  'Make a dentist appointment','Order printer ink','Tidy the desk drawer','Defrost the freezer','Fix the wobbly chair',
  'Plan next week','Read one chapter','Go for a run','Frame the print','Sort the photos from the trip'];
/* A shape a sheet of paper can be cut to. A type whose shape *is* what it is
   (a quotation, a verse, a plaque, a portrait) keeps it; one wearing plain
   paper may come off any pad. */
const PAPER_SHAPES = ['card','rounded','note','tornnote','idea','index','torn','dream'];
/* **A thing made at random is random in every way it can be** (decision 244):
   the type, and then its colour, its edge, its paper, its shape, its words,
   its day and whatever its own type lets it choose — which ornament, which
   fill, which button, which clock, how many sides. A container gets two to
   four random things inside it, one level deep. */
function roll(o, depth){
  /* **Its size, rolled inside its type's range** (decision 246), on both
     boards, as a size with no position: whoever places it (the coin, the
     spawner, the drawer it is born in) puts it somewhere that size fits. A
     box that already has a place keeps it. */
  ['desk','phone'].forEach(dv=>{
    if(o[dv] && o[dv].x!=null) return;
    const [w,h] = randomSizeOf(o.kind, dv, o.parent);
    // a background under a corner, not the whole board (decision 257)
    o[dv] = isBackdrop(o) ? {w:Math.min(w,4), h:Math.min(h,4)} : {w, h};
  });
  if(!isContainer(o)){
    o.c = randomFront();
    // paper looks are for things drawn on paper: not an ornament, a fill, a
    // button, a counter's wheels or anything that runs
    if(!isDecor(o) && !isBackdrop(o) && !doesOf(o) && !has(o,'count') && !K(o.kind).act){
      o.border = pick(BORDER_SLOTS);
      o.stock = pick(STOCK_SLOTS);
      if(PAPER_SHAPES.includes(shapeOf(o)) && chance(.5)) o.shape = pick(PAPER_SHAPES);
      if(chance(.25)) o.tsize = pick(TSIZES)[0];
      if(chance(.1)) o.seal = pick(SEAL_KEYS.filter(k=>k!=='none'));
    }
  }
  // a kind with its own flow is named for what it is (Health, a Feature Film)
  if(isContainer(o) && !planForKind(o.kind) && (!o.title || o.title===K(o.kind).nm)){
    const w = pick(NAMES)+' '+pick(NAMES); o.title = w[0].toUpperCase()+w.slice(1); }
  if(has(o,'check') && !o.title) o.title = pick(CHORES);
  else if(has(o,'text') && wordless(o)){
    if(!writeText(o)){ WAITING.add(o.id); loadTexts(); }
  }
  if(has(o,'date')) o.due = chance(.3) ? null : dz(Math.floor(Math.random()*42)-14);
  if(has(o,'rating')) o.rating = 1 + Math.floor(Math.random()*5);
  if(has(o,'priority')) o.prio = Math.floor(Math.random()*6);
  if(mediaTypeOf(o)==='audio') o.vinyl = pick(VINYLS)[0];
  if(isDecor(o)) o.decor = pick(DECOR_KEYS);
  if(isBackdrop(o)) o.fill = pick(FILL_KEYS);
  if(doesOf(o)){ o.bimg = pick(BUTTON_IMGS).f;
    let k = someKind(), n = 0; while(kindHas(k,'container') && n++ < 8) k = someKind(); o.genKind = k;
    // …and not always a maker: a switch for one of the desk's settings (261)
    if(chance(.25)){ o.does = 'switch'; o.ctl = pick(CTL_KEYS); } }
  /* ---- everything else a thing can be set to — decision 261 --------------
     Timothy: one of anything should be random all the way through, and a
     Background was missing for a whole version without anybody noticing. So
     every setting with a table of answers is rolled here, a written thing's
     typeface and ink included, and what used to be left out because it asks
     a question first (a tag, a thing you did) is given an answer. */
  if(isWritten(o)){
    if(chance(.3)){ const f = Object.keys(FONTS).filter(Boolean); if(f.length) o.tfont = pick(f); }
    if(chance(.2)){ const ink = INKS.map(x=>x[0]).filter(Boolean); if(ink.length) o.ink = pick(ink); }
  }
  if(shapeOf(o)==='notepad') o.genKind = pick([SMART, SMART, 'task', 'note', 'idea', 'question']);
  if(isContainer(o) && faceOf(o)!=='spine' && chance(.25)) o.kshape = pick(Object.keys(KSHAPES));
  if(faceOf(o)==='calendar'){ o.calview = pick(['month','week','day']); o.calshow = pick(Object.keys(CALSHOWS)); }
  if(has(o,'streak') && chance(.3)){
    const [unit, goal, step] = pick([['oz',64,8],['min',30,5],['pages',20,5],['km',5,1],['glasses',8,1]]);
    o.measure = {unit, goal, step};
  }
  if(shapeOf(o)==='bar'){ o.steps = 3 + Math.floor(Math.random()*10); o.at = Math.floor(Math.random()*(o.steps+1)); }
  if(K(o.kind).past && !o.title){ o.title = pastTense(pick(CHORES)); o.doneAt = dz(-Math.floor(Math.random()*60)); }
  if(has(o,'magic') && !((o.filter||{}).tag) && !rulesOf(o.filter||{}).length){
    const t = pick(TAG_WORDS); o.filter = Object.assign({}, o.filter, {tag:t});
    if(!o.title || o.title===K(o.kind).nm) o.title = '#'+t;
  }
  if(has(o,'count')){ o.count = Math.floor(Math.random()*1000);
    o.wheelc = pick(WHEEL_COLOURS)[0]; o.wink = pick(WHEEL_INKS)[0]; o.wfont = pick(Object.keys(WHEEL_FONTS)); }
  const act = K(o.kind).act;
  if(act==='metro') o.bpm = 40 + Math.floor(Math.random()*169);
  if(act==='glass') o.mins = pick([1,2,3,5,10,15,20,30,60]);
  if(act==='candle') o.burn = pick([15,30,60,90,120,240]);
  if(act==='die') o.sides = pick(DICE);
  if(act==='clock') o.clock = pick(Object.keys(CLOCKS));
  // …and one that came with its flow laid out is already full
  /* A book is its words (decision 261): a Text made at random has its body
     written, and a video, a place and an event put inside it were a book
     nobody could make sense of. */
  if(isContainer(o) && !has(o,'magic') && depth < 1 && !K(o.kind).act && faceOf(o)!=='spine'
     && !S.objects.some(x=>x.parent===o.id)){
    const n = 2 + Math.floor(Math.random()*3);
    const makes = has(o,'spawn') && genKindOf(o);
    for(let i=0; i<n; i++){
      let k = makes || someKind(), tries = 0;
      while(!makes && kindHas(k,'container') && tries++ < 8) k = someKind();
      furnish(create(k, {parent:o.id}), depth+1);
    }
  }
}
/* Whatever a thing made at random needs so it is not a blank: a picture for
   anything that holds one, and a collage is laid with three or four. */
function furnish(o, depth){
  if(!o) return o;
  roll(o, depth||0);
  const gal = galleryOf(o);
  if(gal && !(o.media && (o.media.src||o.media.assetId))){
    hangPainting(o, gal[Math.floor(Math.random()*gal.length)]);
  } else if(isPicture(o) && !isDecor(o) && !(o.media && (o.media.src||o.media.assetId))){
    const p = samplePicture(); if(p) o.media = pictureMedia(p);
  } else if(mediaTypeOf(o)==='audio' && SOUNDS.length && !(o.media && (o.media.src||o.media.assetId))){
    const c = pick(SOUNDS);
    o.media = soundMedia(c);
    if(!o.title || o.title===K(o.kind).nm) o.title = c.t;
  } else if(mediaTypeOf(o)==='video' && !(o.media && (o.media.src||o.media.assetId))){
    const c = CLIPS[Math.floor(Math.random()*CLIPS.length)];
    o.media = clipMedia(c);
    if(!o.title) o.title = c.t;
  }
  /* A portal the coin or the spiral makes is any of them (decision 223): one
     of the three openings, in any of the aesthetic's object colours. */
  /* **And it goes somewhere** (decision 244): a portal made at random opens
     onto a place made for wandering, rather than onto nothing. */
  if(has(o,'button') && !(o.link && o.link.target)){
    const [nm, url] = pick(WANDER);
    o.link = Object.assign({}, o.link, {label:nm, target:url});
    if(!o.title || o.title===K(o.kind).nm) o.title = nm;
  }
  if(has(o,'button') && o.link && o.link.target && !o.pstyle){
    o.pshape = pick(Object.keys(PORTAL_SHAPES));
    // …what is in it and what is on its edge (decision 226), a glimpse of the
    // page among them now that it goes somewhere
    o.pstyle = pick(Object.keys(PORTAL_STYLES));
    o.pedge = pick(Object.keys(PORTAL_EDGES));
    o.c = OBJ0 + Math.floor(Math.random()*OBJN);
  }
  if(faceOf(o)==='collage' && !S.objects.some(x=>x.parent===o.id)){
    const n = 3 + Math.floor(Math.random()*2);
    const pool = PICTURES.slice().sort(()=>Math.random()-.5).slice(0, n);
    pool.forEach(p=>{ const c = create('image', {parent:o.id, title:p.t}); if(c) c.media = pictureMedia(p); });
  }
  return o;
}

const TAG_WORDS = ['home','work','someday','reading','errands','ideas','film','money','garden','kitchen','travel','music'];
const WORDS='brass ledger cedar tide quarry lantern vellum thistle harbor ember slate poppy compass juniper marrow'.split(' ');
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
  furnish(o);
  const g=gridOf(undefined, home), dv=dev();
  const w=1+Math.floor(Math.random()*8), h=1+Math.floor(Math.random()*8);
  o[dv]=anySpot(Math.min(w,g.maxW,g.cols), Math.min(h,g.maxH,g.rows), dv, home);
  return o;
}

/* ---- dealing a card out of a deck — decision 204 -----------------------
   Out onto the board the deck is standing on, **beside the deck** where there
   is room (right, below, left, above) and wherever `ensureBox()` finds room
   otherwise. It keeps its size and loses its position, because a box's place
   belongs to a coordinate space and the deck's is not the board's. One undo
   move, and a toast carrying it, because a phone has no other way back. */
function dealTop(id){
  const d=byId(id); if(!d) return null;
  const kids=S.objects.filter(x=>x.parent===id);
  const c=kids.find(x=>x.id===d.top) || kids[0];
  if(!c){ toast('Nothing to deal'); return null; }
  pushSets('Dealt', [[c.id,'parent',c.parent],[c.id,'desk',c.desk],
    [c.id,'phone',c.phone],[id,'top',d.top]]);
  c.parent=d.parent; keepSize(c); delete d.top;
  const dv=dev(), b=d[dv];
  if(b && b.x){
    const [dw,dh]=sizeOfKind(c.kind, dv, d.parent);
    const w=(c[dv]&&c[dv].w)||dw, h=(c[dv]&&c[dv].h)||dh;
    const tries=[{x:b.x+b.w, y:b.y}, {x:b.x, y:b.y+b.h}, {x:b.x-w, y:b.y}, {x:b.x, y:b.y-h}];
    const at=tries.find(t=>boxOk({x:t.x, y:t.y, w, h}, c.id, dv, d.parent));
    if(at) c[dv]={x:at.x, y:at.y, w, h};
  }
  save(); return c;
}

// toggleHabit isn't exported — a streak reaches it through toggleDone, which is
// the one door, so nothing outside has to know a habit ticks differently.
/* ---- what an inbox line is taken for — decision 296 ---------------------
   The kinds a written line is guessed as, in the order a tap on its label
   walks them: the next one, round to the first. Only the ones there are. */
const GUESSES = ['task','idea','question','thought','note','quote','problem'];
function rekind(id){
  const o = byId(id); if(!o || isContainer(o)) return null;
  const list = GUESSES.filter(k=>KINDS[k] && !isCut(k) && !isShelved(k));
  const next = list[(list.indexOf(o.kind)+1) % list.length];
  if(!next || !becomeKind(id, next)) return null;
  save(); toast(`Now a ${K(next).nm.toLowerCase()}`, true);
  return next;
}

/* ---- put down in a zone — decision 293 -----------------------------------
   After a drop, each thing moved is given what the zone under its middle
   says, the smallest zone winning where two overlap. The writes ride the
   drop's own undo move when there is one, so one Undo takes the thing back
   out of the zone and puts its fields back as they were. */
function zoneUnder(o, parent){
  const b = lay(o); if(!b || !b.w) return null;
  const cx = b.x + (b.w-1)/2, cy = b.y + (b.h-1)/2;
  return S.objects.filter(z=>z!==o && isZone(z) && (z.parent||ROOT)===parent)
    .map(z=>[z, lay(z)]).filter(([z,r])=>r && r.w && cx>=r.x && cx<=r.x+r.w-1 && cy>=r.y && cy<=r.y+r.h-1)
    .sort((a,b)=>a[1].w*a[1].h - b[1].w*b[1].h).map(([z])=>z)[0] || null;
}
function zoneDrop(ids, parent){
  const steps = [], said = [];
  const zoneTags = S.objects.filter(z=>isZone(z) && (z.parent||ROOT)===parent).map(z=>zoneWrites(z).tag).filter(Boolean);
  ids.forEach(id=>{
    const o = byId(id); if(!o || isZone(o) || isBackdrop(o) || isDecor(o)) return;
    const z = zoneUnder(o, parent); if(!z) return;
    const w = zoneWrites(z), was = steps.length;
    const set = (k, v)=>{ steps.push({set:{id, k, v:o[k] && typeof o[k]==='object' ? o[k].slice() : o[k]}}); o[k] = v; };
    Object.entries(ZONE_TRAITS).forEach(([k, trait])=>{
      if(w[k]==null || o[k]===w[k]) return;
      if(!has(o, trait)) set('attrs', attrsOf(o).concat(trait));
      set(k, w[k]);
    });
    if(w.tag){
      const tags = (o.tags||[]).filter(t=>t===w.tag || !zoneTags.includes(t));
      if(!tags.includes(w.tag)) tags.push(w.tag);
      if(tags.join('|')!==(o.tags||[]).join('|')) set('tags', tags);
    }
    if(steps.length>was) said.push(z.title || zoneSaid(z) || 'the zone');
  });
  if(!steps.length) return null;
  const top = S.undo[S.undo.length-1];
  if(top && top.label==='Moved' && Date.now()-top.at < 2000) top.steps.push(...steps);
  else pushUndo('Put in a zone', steps);
  return [...new Set(said)].join(', ');
}

/* ---- the rubber stamp — decision 292 -------------------------------------
   One impression, on one thing: the stamp's word, today's date and its ink,
   appended to `stamps`. A record, so it is added and not edited; the same
   word twice in one day is one impression, because stamping a pile of
   letters twice by accident should not leave a second mark. One undo move
   per press, and the toast carries the Undo, since a phone has no other. */
function stampIt(id, st){
  const o = byId(id); if(!o || !st) return false;
  const was = stampsOf(o), d = D.iso(D.today());
  if(was.some(x=>x.w===st.w && x.d===d)){ toast(`Already stamped ${st.w} today`); return false; }
  pushSet('Stamped', id, 'stamps', o.stamps ? o.stamps.slice() : undefined);
  o.stamps = was.concat([{w:st.w, d, ink:st.ink}]);
  save();
  toast(`${st.w} · ${o.title || K(o.kind).nm}`, true);
  return true;
}
/* Lifting one off, from the editor: the way back from a stamp on the wrong
   thing once the toast has gone. */
function unstamp(id, i){
  const o = byId(id); if(!o) return;
  const was = stampsOf(o); if(!was[i]) return;
  pushSet('Stamp lifted', id, 'stamps', o.stamps.slice());
  o.stamps = was.filter((_, j)=>j!==i);
  if(!o.stamps.length) delete o.stamps;
  save(); toast('Stamp lifted', true);
}

export { readLine, madeSaid, rekind, zoneDrop, zoneUnder, stampIt, unstamp, toast, setGridSize, toggleDone, spawnNext, del, delMany, delDrawer, theBin, unbin, emptyBin, binned, inboxTake, sortInbox, undo, redo,
  pushUndo, pushSet, pushSets, toggleFree, setPin, togglePin, becomeKind, seedInto,
  drawerForTag, create, makeCompound, guessKind, AT_GOAL, goalOf, reachedGoal, gather, quickAdd, spawnInto, randomThing,
  loadTexts, CONTROLS, CTL_KEYS, ctlSpec, ctlSaid, ctlIsOn, ctlForm, ctlNum, ctlIndex, ctlPress, someKind,
  fits,
  holdIt, holdMany, unholdIt, unholdMany, undoToast, dealTop, furnish, PICTURES, PAINTINGS, galleryOf, hangPainting, pictureMedia, CLIPS };
