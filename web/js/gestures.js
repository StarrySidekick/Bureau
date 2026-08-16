import { $, $$, clamp, D, ROOT } from './util.js';
import { S, byId, dev, has, isAncestor, childrenOf, container, gatherKind, spanOf,
  sortOf, cfgOf, pinIds } from './model.js';
import { GRID, CELL, gridOf, cellW, lay, boxOk, overlaps } from './grid.js';
import { toast, gather, setPin } from './mutations.js';
import { pending, tileTap, fireButton } from './tiles.js';
import { modalNewObject, openCtx, closeCtx } from './panels.js';
import { render } from './views.js';
import { pagerBegin, pagerMove, pagerEnd, pagerCancel, pagerOn } from './motion.js';
import { save } from './persist.js';

/* ============================================================
   19 · gestures: swipe + drag reorder
   ============================================================ */
let G=null;
let holdTimer=null, menuTimer=null, holdFrom=null;
/* Two lengths of press, and the difference between them is whether you moved.
   A touch that holds for 300ms has picked the tile up. A touch that is *still*
   holding it 250ms later, and has not moved further than a thumb wobbles, did
   not mean to move it at all — that is the long press every phone uses to mean
   "tell me about this", so it becomes the context menu instead. Six pixels of
   slack, because a finger resting on glass is never perfectly still. */
const HOLD_TOUCH = 300, HOLD_MOUSE = 200, MENU_AFTER = 250, WOBBLE = 6;
// any real movement, or letting go, means it was not a press-and-hold
function cancelHold(e){
  if(e && holdFrom && Math.abs(e.clientX-holdFrom.x)<WOBBLE && Math.abs(e.clientY-holdFrom.y)<WOBBLE) return;
  if(holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
  if(menuTimer){ clearTimeout(menuTimer); menuTimer=null; }
}


/* ---- pulling the new-object drawer out of the shelf --------------------
   Three numbers and an element. PULL_START is how far the finger travels
   before the drawer is showing at all — enough to rule out a tap and a
   sideways scroll, not enough to feel like a delay. PULL_OPEN is the pull
   itself, and it is deliberately long: a quarter of a phone screen is a stroke
   you have to commit to, which is the entire fix. HOME_EDGE is the strip along
   the very bottom that belongs to iOS, and it is left alone. */
/* HOME_EDGE is the strip along the very bottom that iOS keeps for its own home
   swipe. It is small because the shelf is now one grid cell tall — about 43px —
   and a guard half that deep would leave nothing to pull from. On a real phone
   the shelf already sits *above* the home indicator (`margin-bottom` is the
   safe-area inset), so this is the belt to that pair of braces. */
const PULL_START = 12, HOME_EDGE = 14;
const PULL_OPEN = ()=> Math.round(Math.min(200, Math.max(110, innerHeight*0.26)));
function makePull(){
  const el=document.createElement('div');
  el.className='shelfpull';
  el.innerHTML=`<div class="pullfront"><i class="pullknob"></i><b>New object</b></div>`;
  // it comes out *of* the shelf, so it stands on the shelf's top edge rather
  // than covering it — the strip is the thing it is being pulled from
  const sh=$('.pinrow'), fr=$('#frame').getBoundingClientRect();
  el.style.bottom = (sh ? fr.bottom - sh.getBoundingClientRect().top : 0) + 'px';
  $('#frame').appendChild(el);
  return el;
}

/* ---- opening a locked board with the tile already in your hand -----------
   The iPhone home screen's gesture: hold an icon, the menu comes up, and if you
   keep holding and start moving, the menu goes and the icon is in your hand.
   Here that also means the board **unlocks** — you have just demonstrated that
   you want to rearrange it, and making you find the padlock first would be
   asking a question you have already answered.

   It writes the state and patches the two elements that show it, and does not
   render: the tile is under the finger, and render() would replace it. The drop
   at the end of the drag renders, and everything agrees then — the same rule
   that lets you type into a tile. */
function unlockBoard(g){
  const c=cfgOf(g.parent);
  if(!c || !c.locked) return;
  c.locked=false;
  const grid=g.el && g.el.closest('.grid');
  if(grid) grid.classList.remove('locked');
  const btn=$('.bartools [data-act="togglelock"]');
  if(btn) btn.classList.remove('on','locked');
  g.locked=false;
  g.stuck = grid ? grid.classList.contains('sorted') : false;
  save();
  toast('Board unlocked');
}

/* Where a move/resize would land, in grid cells. Dragging an edge moves that
   edge only; dragging a corner moves both of its edges — same as a window. */
function candidate(g, cx, cy){
  const b=g.box, hd=g.handle;
  if(g.type==='move') return {x:b.x+cx, y:b.y+cy, w:b.w, h:b.h};
  let x=b.x, y=b.y, w=b.w, h=b.h;
  if(hd.includes('e')) w=b.w+cx;
  if(hd.includes('w')){ x=b.x+cx; w=b.w-cx; }
  if(hd.includes('s')) h=b.h+cy;
  if(hd.includes('n')){ y=b.y+cy; h=b.h-cy; }
  if(w<1){ if(hd.includes('w')) x=b.x+b.w-1; w=1; }   // never invert the box
  if(h<1){ if(hd.includes('n')) y=b.y+b.h-1; h=1; }
  return {x,y,w,h};
}
function place(el, b){
  el.style.gridColumn=`${b.x} / span ${b.w}`;
  el.style.gridRow=`${b.y} / span ${b.h}`;
}
// put a carried tile down: the offset the sway was composing, and the fallback
function clearCarry(el){
  if(!el) return;
  el.style.removeProperty('--carryx');
  el.style.removeProperty('--carryy');
  el.style.transform='';
}

/* ---- where letting go would put it ------------------------------------
   Four answers, in the order they beat each other: a day on a calendar, a
   point along a timeline's axis, an object it can gather with, a container to
   file into. The first two sit *inside* a container's tile, so they have to be
   asked about first — otherwise every drop on a calendar would file into the
   drawer and throw the date away, which is the bug that made this ordering
   explicit rather than incidental. */
function clearAim(g){
  if(g.shelfEl){ g.shelfEl.classList.remove('dropshelf'); g.shelfEl=null; }
  if(g.dayEl){ g.dayEl.classList.remove('dropday'); g.dayEl=null; }
  if(g.tlEl){ g.tlEl.classList.remove('droptime');
              delete g.tlEl.dataset.droplabel;
              const r=g.tlEl.querySelector('.tlrule');
              if(r) r.style.removeProperty('--dropx');
              g.tlEl=null; }
  if(g.gatherEl){ g.gatherEl.classList.remove('dropgather'); g.gatherEl=null; }
  if(g.dropEl){ g.dropEl.classList.remove('dropinto'); g.dropEl=null; }
  g.dropDay=g.dropTl=g.dropOn=g.gatherOn=g.gatherKind=g.pinIt=null;
}
// Somewhere this object may legally end up: not itself, not inside itself, and
// not a magic drawer — those collect by rule and hold nothing, so filing into
// one would take the object out of the drawer it actually lives in.
const canFile = (dragId, intoId) => !!intoId && intoId!==dragId
  && !has(byId(intoId),'magic') && !isAncestor(dragId, byId(intoId));
// The same, minus the magic rule: a magic calendar can still date something it
// only ever borrows.
const canDate = (dragId, intoId) => !!intoId && intoId!==dragId && !isAncestor(dragId, byId(intoId));

/* Where letting a plucked line go would put it. Simpler than aimDrop: a line has
   no box being carried and no date being aimed at, so the only question is which
   container it lands in — a drawer under the pointer, a pin on the bar, or the
   board itself, which is the container whose grid you are looking at. The chip
   follows the pointer, so it has to stand aside to be seen past. */
function aimPluck(g, px, py){
  if(g.shelfEl){ g.shelfEl.classList.remove('dropshelf'); g.shelfEl=null; }
  if(g.dropEl) g.dropEl.classList.remove('dropinto','dropboard');
  g.dropEl=null; g.dropOn=null; g.pinIt=null;
  if(g.chip) g.chip.style.visibility='hidden';
  const under=document.elementFromPoint(px, py);
  if(g.chip) g.chip.style.visibility='';
  if(!under) return;
  // the shelf first: a line lifted off a checklist can be kept to hand too
  const shelf=under.closest('.pinrow');
  if(shelf && !pinIds().includes(g.id)){
    g.shelfEl=shelf; g.pinIt=true; shelf.classList.add('dropshelf'); return;
  }
  const over=under.closest('.grid .drawer[data-drawer], .pinbar .pinbtn[data-drawer]');
  if(over && canFile(g.id, over.dataset.drawer)){
    g.dropEl=over; g.dropOn=over.dataset.drawer; over.classList.add('dropinto');
    return;
  }
  const grid=under.closest('.grid');
  if(grid){
    const home=grid.dataset.gridfor||ROOT;
    if(canFile(g.id, home)){ g.dropEl=grid; g.dropOn=home; grid.classList.add('dropboard'); }
  }
}

function aimDrop(g, px, py){
  clearAim(g);
  const d=byId(g.id);
  // a set has no single date, and nothing to gather with — it only ever files
  if(!d) return;
  const under=document.elementFromPoint(px, py);
  if(!under) return;
  const dated=!g.group && has(d,'date');

  /* The shelf is a row of the grid now, so it is somewhere you can *carry*
     something — and carrying a thing onto the shelf is what pinning is. It is
     asked about first, because the shelf is not a container and every other
     answer below is about which container a thing lands in. */
  const shelf = !g.group && under.closest('.pinrow');
  if(shelf && !pinIds().includes(g.id)){
    g.shelfEl=shelf; g.pinIt=true; shelf.classList.add('dropshelf');
    return;
  }

  const dayEl = dated && under.closest('[data-calday]');
  if(dayEl && canDate(g.id, dayEl.dataset.calday.split(':')[0])){
    g.dayEl=dayEl; g.dropDay=dayEl.dataset.calday; dayEl.classList.add('dropday');
    return;
  }
  /* A timeline's face is a date axis, so the fraction of the rule the pointer
     is along *is* the date. The readout is drawn from --dropx and the label,
     because you cannot aim at a day you cannot see. */
  const tlEl = dated && under.closest('[data-tlspan]');
  if(tlEl){
    const [tid,min,max]=tlEl.dataset.tlspan.split(':');
    const rule=tlEl.querySelector('.tlrule');
    if(rule && canDate(g.id, tid)){
      const r=rule.getBoundingClientRect();
      const f=clamp((px-r.left)/Math.max(1,r.width), 0, 1);
      const span=Math.max(1, Math.round((D.parse(max)-D.parse(min))/864e5));
      const iso=D.addISO(min, Math.round(f*span));
      g.tlEl=tlEl; g.dropTl={id:tid, iso};
      tlEl.classList.add('droptime');
      rule.style.setProperty('--dropx', (f*100)+'%');
      // the date reads in the tile's corner, not at the mark: the tile being
      // dragged is under the pointer and would sit on top of it there
      tlEl.dataset.droplabel=D.short(iso);
      return;
    }
  }
  // two of a kind, dropped together, become the thing they add up to
  if(!g.group){
    const objEl=under.closest('.grid .drawer[data-row]');
    const tgt=objEl && byId(objEl.dataset.row);
    const gk=tgt && gatherKind(d, tgt);
    if(gk){ g.gatherEl=objEl; g.gatherOn=tgt.id; g.gatherKind=gk; objEl.classList.add('dropgather'); return; }
  }
  /* A pinned drawer is a drop target too, and on a phone it is *the* drop
     target: the bar is always on screen, so filing something three screens
     away stops being a scroll you cannot perform while your finger is holding
     the tile. One selector rather than a branch — the bar and the board are
     both just places a drawer can be. */
  const over=under.closest('.grid .drawer[data-drawer], .pinbar .pinbtn[data-drawer]');
  if(over && !g.group && canFile(g.id, over.dataset.drawer)){
    g.dropEl=over; g.dropOn=over.dataset.drawer; over.classList.add('dropinto');
  }
}

/* ---- carrying a tile past the edge of the screen ----------------------
   The drag suppresses scrolling, or the page would run away under the finger.
   That leaves a phone desk five screens tall rearrangeable only within the one
   screen you started on, so holding the tile near the top or bottom pans the
   board under it — the same thing dragging a file to the edge of a window does.
   The grab point moves with the board, or the tile would slide out from under
   the finger by exactly as much as the board scrolled. */
const PAN_EDGE = 68, PAN_MAX = 16;
let panning=null;
function stopPan(){ if(panning){ cancelAnimationFrame(panning); panning=null; } }
function autoPan(){
  panning=null;
  if(!G || G.mode!=='grid' || G.type!=='move' || !G.scroller) return;
  const sc=G.scroller, r=sc.getBoundingClientRect();
  let v=0;
  if(G.py < r.top+PAN_EDGE)         v = -PAN_MAX*Math.min(1,(r.top+PAN_EDGE-G.py)/PAN_EDGE);
  else if(G.py > r.bottom-PAN_EDGE) v =  PAN_MAX*Math.min(1,(G.py-(r.bottom-PAN_EDGE))/PAN_EDGE);
  if(v){
    const was=sc.scrollTop;
    sc.scrollTop += v;
    const moved=sc.scrollTop-was;             // 0 at either end of the board
    if(moved){
      G.sy -= moved;
      applyDrag(G, G.px-G.sx, G.py-G.sy);
    }
  }
  panning=requestAnimationFrame(autoPan);
}
/* Moving a dated thing to a new day. A thing that *lasts* keeps its length —
   dragging a week in Lisbon to the following Monday means the whole week, not
   a trip that now ends before it began. */
function reschedule(d, iso){
  const sp=spanOf(d);
  d.due=iso;
  if(sp) d.till=D.addISO(iso, sp.days-1);
}
/* Filing on a drop clears *both* layouts, not just this device's. The object
   has landed in a new container, which is a new coordinate space on the phone
   as much as on the desk — leaving the other box meant it kept a position that
   belonged to the drawer it came from, and collided the next time you opened
   that layout. */
function fileInto(d, intoId){
  if(!canFile(d.id, intoId) || d.parent===intoId) return false;
  d.parent=intoId; d.desk=null; d.phone=null;
  return true;
}

/* ---- a swipe that walks the boards ------------------------------------
   One decision per gesture: at SWIPE_MIN, by whichever of the two distances
   is the larger, and then held until the fingers come off — so a slightly
   diagonal swipe turns one page rather than turning three and changing drawer
   as well. Tracking starts from where the decision was made, not from where
   the finger went down, or the strip would jump by the threshold the moment
   it appeared.

   `g` is whichever gesture is driving: the two-finger one, a one-finger drag
   on a locked board, or a one-finger drag on a locked board's bare cells.
   Fourteen pixels rather than the old forty-six, because the swipe no longer
   *commits* at the threshold — it starts following you there, and letting go
   without going far enough puts it back. */
const SWIPE_MIN = 14;
function swipeMove(g, dx, dy){
  if(g.axis==='dead') return;
  if(!g.axis){
    if(Math.abs(dx)<SWIPE_MIN && Math.abs(dy)<SWIPE_MIN) return;
    g.axis = Math.abs(dy)>=Math.abs(dx) ? 'y' : 'x';
    /* Everything past the threshold counts, and the threshold itself doesn't:
       tracking from the raw delta would jump by fourteen pixels the moment the
       strip appeared, and tracking from *this* delta would throw away a flick
       that crossed the line and kept going in the same event. */
    g.from = SWIPE_MIN * Math.sign(g.axis==='y' ? dy : dx);
    g.mode = 'swipe';
    gestureFlags.suppressClick=true;      // it was a swipe, not a tap
    if(!pagerBegin(g.axis)){ g.axis='dead'; return; }
  }
  pagerMove((g.axis==='y' ? dy : dx) - g.from);
}

function onDown(e){
  if(e.button===2) return;
  if(pagerOn()) return;              // a board already in flight owns the screen
  /* A drag arms suppressClick so its own trailing click can't also fire. If
     that click never arrives — the pointer left the window, or the drag was
     synthetic — the flag would sit there and eat somebody else's click later.
     A new press means the old one is finished with, whatever happened to it. */
  gestureFlags.suppressClick=false;
  /* A pin can be dragged along the bar to reorder it. The bar is chrome, not a
     grid, so it gets its own tiny path rather than going through the box
     maths — and a plain click still has to navigate, which is why nothing
     happens until the pointer has actually moved. */
  /* The bottom shelf is where things come out of. A press on it that travels
     upward opens the new-object menu; one that doesn't is a plain tap and the
     pin under it navigates as usual. */
  /* Bare shelf — not one of the things on it, which are buttons and answer a
     tap and a hold of their own. */
  const shelfEl = S.device!=='desk' && !e.target.closest('.pinbtn')
    && e.target.closest('.pinrow');
  if(shelfEl){
    /* …unless the finger went down in the last few millimetres of the screen,
       which is iOS's own home gesture and not ours. Sharing that strip is how
       the new-object menu kept appearing on the way out of the app. */
    G = (innerHeight - e.clientY) < HOME_EDGE
      ? {type:'homeedge'}
      : {type:'shelf', el:shelfEl, sx:e.clientX, sy:e.clientY, mode:null, pull:null};
    return;
  }
  // home is draggable too — where it sits in the row is a thing you can change
  const pinEl=e.target.closest('.pinbar .pinbtn');
  if(pinEl && S.device==='desk'){
    G={type:'pin', el:pinEl, id:pinEl.dataset.drawer, bar:pinEl.parentElement,
       sx:e.clientX, sy:e.clientY, mode:null};
    return;
  }
  // Any tile on any unlocked grid. There is no arrange mode — everything is
  // always movable — so a short hold arms the drag, which is the only thing
  // keeping an ordinary click from picking the tile up.
  /* Bare grid. On a board that has been locked there is nothing to sketch and
     nothing to pick up, which frees the one finger that is otherwise always
     busy: a plain swipe walks the pinned drawers and turns the pages. On an
     unlocked one the same drag sketches the size of a new object. */
  /* Bare grid. One path, and what a locked board does with it is decided by
     *when* you move rather than by whether it is locked:

       move first   the board is locked, so the finger has nothing to carry —
                    it walks the boards, which is what one finger is for there
       hold first   the sketch, exactly as on an unlocked board: the cell
                    highlights, dragging sizes the box, and letting go opens the
                    type picker on it

     That is the missing half of decision 43. Pulling the shelf makes a thing
     with nowhere in mind; holding a cell makes one *there*, which is the thing
     a grid is for and which a phone had no way of saying. */
  if(e.target.classList && e.target.classList.contains('grid')){
    const grid=e.target, g=gridOf(), r=grid.getBoundingClientRect(), cw=cellW(grid,g);
    const cx=clamp(Math.floor((e.clientX-r.left)/(cw+g.gap))+1, 1, g.cols);
    const cy=Math.max(1, Math.floor((e.clientY-r.top)/(CELL[dev()]+g.gap))+1);
    const locked=grid.classList.contains('locked');
    G={type:'sketch', grid, parent:grid.dataset.gridfor||ROOT, x0:cx, y0:cy,
       stepX:cw+g.gap, stepY:CELL[dev()]+g.gap, sx:e.clientX, sy:e.clientY, mode:null,
       add:e.shiftKey||e.metaKey||e.ctrlKey, hits:[],
       locked, axis:null, from:0, canSketch:!locked, held:false};
    const g0=G;
    holdTimer=setTimeout(()=>{
      holdTimer=null;
      if(G!==g0 || G.mode) return;
      G.held=true; G.canSketch=true;
      if(navigator.vibrate) navigator.vibrate(6);
      // the cell lights up the moment the hold lands, or nothing has happened
      G.ghost=document.createElement('div');
      G.ghost.className='ghost band';
      place(G.ghost, {x:G.x0, y:G.y0, w:1, h:1});
      G.grid.appendChild(G.ghost);
      G.mode='sketch';
    }, e.pointerType==='touch' ? HOLD_TOUCH : HOLD_MOUSE);
    holdFrom={x:e.clientX,y:e.clientY};
    return;
  }
  /* A pinned thing on the shelf. It is not on a grid, so it has no box to
     carry — but it still has to be able to answer "what is this, and how do I
     get it off the shelf", which is what the long press is everywhere else. */
  const pinEl2=e.target.closest('.pinrow .pinbtn');
  if(pinEl2){
    G={type:'pinpress', el:pinEl2, id:pinEl2.dataset.pin, sx:e.clientX, sy:e.clientY, mode:null};
    const g0=G;
    holdTimer=setTimeout(()=>{
      holdTimer=null;
      if(G!==g0) return;
      const r=g0.el.getBoundingClientRect();
      if(navigator.vibrate) navigator.vibrate([4,40,10]);
      G.menu=true;
      gestureFlags.suppressClick=true;
      openCtx(r.left+r.width/2, r.top, g0.id);
    }, e.pointerType==='touch' ? HOLD_TOUCH+MENU_AFTER : HOLD_MOUSE+MENU_AFTER);
    holdFrom={x:e.clientX,y:e.clientY};
    return;
  }

  /* A line on a checklist front is the object itself, so it can be taken off
     the front. Holding one lifts it out as a chip you can drop on the board or
     into another drawer — which is what makes a checklist somewhere things pass
     through rather than somewhere they go to stay. A tap still ticks it: only
     the hold plucks, and only a plucked one suppresses its own click. */
  const plEl=e.target.closest('.cline[data-pluck]');
  if(plEl){
    G={type:'pluck', el:plEl, id:plEl.dataset.pluck, sx:e.clientX, sy:e.clientY,
       px:e.clientX, py:e.clientY, mode:null, armed:false};
    const g0=G;
    holdTimer=setTimeout(()=>{
      holdTimer=null;
      if(G!==g0) return;
      G.armed=true;
      G.el.classList.add('lifted');
      if(navigator.vibrate) navigator.vibrate(6);
    }, e.pointerType==='touch' ? 300 : 200);
    holdFrom={x:e.clientX,y:e.clientY};
    return;
  }
  /* A list you arranged is a list you can rearrange. A grid has coordinates and
     a list has an order, and `ord` is that order — so holding a band and moving
     it writes a new one, exactly as dragging a tile writes a new box.
     Only under Manual: a board that sorts itself arranges itself, and letting
     you shuffle an A–Z list would be a gesture whose result vanished on the
     next render. The bar says which sort it is on, so there is nowhere for this
     to be a surprise. */
  const bandEl = e.target.closest('.listgrid[data-listfor] .listband');
  if(bandEl && !e.target.closest('[data-check]')){
    const list=bandEl.parentElement;
    const cid=list.dataset.listfor;
    if(cid && !sortOf(container(cid))){
      G={type:'band', el:bandEl, list, cid, id:bandEl.dataset.row||bandEl.dataset.drawer,
         sx:e.clientX, sy:e.clientY, mode:null, armed:false};
      const g0=G;
      holdTimer=setTimeout(()=>{
        holdTimer=null;
        if(G!==g0) return;
        G.armed=true;
        G.el.classList.add('lifted');
        if(navigator.vibrate) navigator.vibrate(6);
      }, e.pointerType==='touch' ? HOLD_TOUCH : HOLD_MOUSE);
      holdFrom={x:e.clientX,y:e.clientY};
      return;
    }
  }

  // a field inside a tile is for typing in, not for dragging the tile by
  if(e.target.closest('input,textarea,select')) return;
  // a tick, a counter or a button inside a tile is its own target
  // A tick or a counter is its own target. A button tile carries data-fire on
  // the tile itself, so only its face counts — otherwise the whole thing would
  // be undraggable.
  if(e.target.closest('[data-check],.cntnum')) return;
  const dEl=e.target.closest('.grid .drawer[data-drawer],.grid .drawer[data-row],.grid .drawer[data-id]');
  if(dEl){
    const grid=dEl.closest('.grid');
    const d=byId(dEl.dataset.drawer||dEl.dataset.row||dEl.dataset.id);
    if(!d || !grid) return;
    /* A locked board — or a sorted one, which arranges itself — refuses to be
       moved or resized. It does **not** refuse the long press: "tell me about
       this" is the one thing a phone has to be able to do to a tile it cannot
       pick up, and locking a board so you can scroll it without disturbing
       anything is exactly when you still want the menu. */
    const locked = grid.classList.contains('locked');
    const stuck = locked || grid.classList.contains('sorted');
    const hEl = stuck ? null : e.target.closest('[data-rz]');
    const g=gridOf();
    G={type: hEl?'resize':'move', el:dEl, id:d.id, handle:hEl?hEl.dataset.rz:null,
       stuck, locked, axis:null, from:0,
       armed: !stuck && !!hEl,      // a corner grip drags at once; a tile waits
       startedOnFace:!!e.target.closest('.btnface'),
       // dragging any member of a selection moves the lot, keeping their
       // relative positions — the offsets are captured up front
       group: (!stuck && S.sel.includes(d.id) && S.sel.length>1)
         ? S.sel.map(byId).filter(Boolean).map(o=>({id:o.id, box:lay(o)})) : null,
       parent:grid.dataset.gridfor||ROOT,
       box:lay(d), stepX:cellW(grid,g)+g.gap, stepY:g.rowh+g.gap,
       sx:e.clientX, sy:e.clientY, mode:null, ok:true, cand:null};
    try{ dEl.setPointerCapture&&dEl.setPointerCapture(e.pointerId); }catch(_){}
    if(!G.armed){
      const g0=G;
      /* A finger needs longer than a mouse. 200ms is a click you held slightly
         too long, and on touch that is most of them — but it is also the whole
         budget for deciding this is not a scroll, so it cannot grow much. */
      const touch = e.pointerType==='touch';
      holdTimer=setTimeout(()=>{
        holdTimer=null;
        if(G!==g0) return;
        if(!g0.stuck){
          G.armed=true;
          G.el.classList.add('lifted');
          if(navigator.vibrate) navigator.vibrate(6);
        }
        // keep holding without moving and it becomes the menu. Touch only: a
        // mouse already has a right button, and a slow click is still a click.
        if(!touch) return;
        /* …and the gesture is **not** cancelled when the menu opens. It used
           to be: the menu appeared and the finger was finished with. The iPhone
           home screen keeps the icon in your hand — hold, the menu comes up,
           keep holding and move, and the menu goes away and you are dragging.
           So the tile is put back down but G stays alive, and the first real
           movement after this takes it (see onMove). */
        menuTimer=setTimeout(()=>{
          menuTimer=null;
          if(G!==g0 || G.mode) return;       // it started moving: it is a drag
          const el=G.el, id=G.id, r=el.getBoundingClientRect();
          if(navigator.vibrate) navigator.vibrate([4,40,10]);
          G.menu=true;
          G.armed=false;
          clearCarry(G.el);
          G.el.classList.remove('lifted');   // down, but still under the finger
          gestureFlags.suppressClick=true;   // and swallow the tap that follows
          openCtx(r.left+r.width/2, r.top+Math.min(r.height/2, 60), id);
        }, MENU_AFTER);
      }, touch ? HOLD_TOUCH : HOLD_MOUSE);
      holdFrom={x:e.clientX,y:e.clientY};
    }
    return;
  }
  /* Swipe-to-file and drag-to-reorder used to live here, on the `.row` list
     the Today and Everything tabs were built from. Those tabs are gone and
     nothing renders `.row[data-row]` any more — the modals' rows carry
     data-moveto/data-sortby/data-dorel and are plain clicks — so the whole
     path went with them. A grid is the only thing you drag now. */
}
function onMove(e){
  cancelHold(e);
  if(!G) return;
  const dx=e.clientX-G.sx, dy=e.clientY-G.sy;

  if(G.type==='swipe'){ swipeMove(G, dx, dy); return; }

  if(G.type==='sketch'){
    // locked, and moved before the hold landed: the finger walks the boards
    if(!G.canSketch){ swipeMove(G, dx, dy); return; }
    if(!G.mode || !G.ghost){
      if(Math.abs(dx)<6 && Math.abs(dy)<6) return;
      G.mode='sketch';
      G.ghost=document.createElement('div');
      G.ghost.className='ghost';
      G.grid.appendChild(G.ghost);
    }
    const cx=G.x0+Math.round(dx/G.stepX), cy=G.y0+Math.round(dy/G.stepY);
    const box={x:Math.min(G.x0,cx), y:Math.min(G.y0,cy),
               w:Math.abs(cx-G.x0)+1, h:Math.abs(cy-G.y0)+1};
    G.cand=box;
    /* Anything the rubber band touches becomes the selection. If it touches
       nothing, the same drag is sketching the size of a new object — which is
       what stopped the two gestures from fighting each other. */
    const hits=childrenOf(container(G.parent)).filter(o=>overlaps(box, lay(o)));
    G.hits=hits.map(o=>o.id);
    G.ok = !hits.length && boxOk(box,null,dev(),G.parent);
    G.ghost.className='ghost band'+(hits.length?' picking':(G.ok?'':' bad'));
    place(G.ghost, box);
    $$('.grid .drawer').forEach(el=>{
      const id=el.dataset.row||el.dataset.drawer||el.dataset.id;
      el.classList.toggle('selected', G.hits.includes(id));
    });
    return;
  }

  if(G.type==='pin'){
    if(!G.mode){
      if(Math.abs(dx)<6) return;
      G.mode='pin'; G.el.classList.add('dragging');
    }
    // slide past whichever neighbour the pointer has cleared the middle of
    const sibs=[...G.bar.querySelectorAll('.pinbtn')].filter(x=>x!==G.el);
    const after=sibs.filter(x=>{ const r=x.getBoundingClientRect(); return e.clientX > r.left+r.width/2; }).pop();
    if(after) after.after(G.el); else {
      const firstPin=G.bar.querySelector('.pinbtn');
      if(firstPin && firstPin!==G.el) firstPin.before(G.el);
    }
    return;
  }

  if(G.type==='band'){
    if(!G.armed) return;             // still waiting out the hold
    if(!G.mode){
      if(Math.abs(dy)<5) return;
      G.mode='band'; G.el.classList.add('dragging');
    }
    // slide past whichever neighbour the pointer has cleared the middle of —
    // the same trick the pin bar uses, turned ninety degrees
    const sibs=[...G.list.querySelectorAll('.listband')].filter(x=>x!==G.el);
    const after=sibs.filter(x=>{ const r=x.getBoundingClientRect(); return e.clientY > r.top+r.height/2; }).pop();
    if(after) after.after(G.el);
    else { const first=G.list.querySelector('.listband');
           if(first && first!==G.el) first.before(G.el); }
    return;
  }

  if(G.type==='pluck'){
    if(!G.armed) return;             // still waiting out the hold
    G.px=e.clientX; G.py=e.clientY;
    if(!G.mode){
      if(Math.abs(dx)<5 && Math.abs(dy)<5) return;
      G.mode='pluck';
      G.el.classList.add('plucked');
      const o=byId(G.id);
      G.chip=document.createElement('div');
      G.chip.className='pluckchip';
      G.chip.textContent=(o&&o.title)||'Untitled';
      $('#frame').appendChild(G.chip);
    }
    const fr=$('#frame').getBoundingClientRect();
    G.chip.style.left=(e.clientX-fr.left)+'px';
    G.chip.style.top=(e.clientY-fr.top)+'px';
    aimPluck(G, e.clientX, e.clientY);
    return;
  }

  if(G.type==='homeedge') return;      // iOS owns that strip; keep out of it

  if(G.type==='shelf'){
    /* Up off the bottom shelf opens the new-object menu. Tapping bare board
       used to do it and was triggered by accident more than on purpose — the
       board is a place you put things down, not a button. The shelf is where
       the menu comes from, and the menu comes up out of it.

       Then *this* kept happening by accident too: forty pixels and it fired,
       committed, with nothing on the screen until it was already done — so a
       flick, a sideways scroll along the shelf, and every swipe up out of the
       app to the home screen all opened it. It is a real pull now. A drawer
       front rises out of the shelf and follows the finger the whole way, and
       it only opens if you carried it PULL_OPEN — a quarter of the screen —
       which is a distance you cannot travel without meaning to. Let go short
       and it drops back. Nothing is decided until you let go. */
    if(G.mode==='dead') return;
    if(!G.pull){
      // sideways first means the shelf is being scrolled, and that is that
      if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6){ G.mode='dead'; return; }
      if(dy > -PULL_START) return;
      G.pull=makePull();
      G.mode='pull';
      gestureFlags.suppressClick=true;
    }
    const open=PULL_OPEN();
    const up=clamp(-dy - PULL_START, 0, open*1.25);
    G.at=up;
    G.pull.style.setProperty('--pull', up+'px');
    G.pull.classList.toggle('ready', up >= open);
    return;
  }

  if(G.type==='move' || G.type==='resize'){
    /* The menu is up and the finger has moved: iOS home-screen behaviour. The
       menu goes, the tile comes up into your hand — and if the board was locked
       it opens, because holding a tile and dragging it is not something you do
       by accident, and it is exactly the thing a locked board refuses. */
    if(G.menu){
      if(Math.abs(dx)<WOBBLE && Math.abs(dy)<WOBBLE) return;
      G.menu=false;
      closeCtx();
      if(G.locked) unlockBoard(G);
      if(!G.stuck){
        G.armed=true;
        G.el.classList.add('lifted');
        if(navigator.vibrate) navigator.vibrate(6);
      }
    }
    if(G.stuck){
      /* A locked board doesn't refuse the drag any more, it *spends* it: the
         finger that can't carry a tile walks the boards instead. A sorted one
         still refuses, because it isn't locked — you can move things on it the
         moment you set it back to Manual, and it has to say so. */
      if(G.locked){ swipeMove(G, dx, dy); return; }
      if(!G.mode && (Math.abs(dx)>10 || Math.abs(dy)>10)){
        G.mode='refused';
        toast('Sorted boards arrange themselves — set Manual to move things');
      }
      return;
    }
    if(!G.armed) return;             // still waiting out the hold
    G.px=e.clientX; G.py=e.clientY;
    if(!G.mode){
      if(Math.abs(dx)<5 && Math.abs(dy)<5) return;
      G.mode='grid';
      G.el.classList.add('dragging');
      if(G.type==='move'){
        // the tile follows the pointer, so it has to stop being hit-testable or
        // elementFromPoint only ever finds the thing being dragged
        G.el.style.pointerEvents='none';
        G.ghost=document.createElement('div');
        G.ghost.className='ghost';
        place(G.ghost, G.box);
        G.el.parentElement.appendChild(G.ghost);
        G.scroller=G.el.closest('.scroll');
        if(!panning) panning=requestAnimationFrame(autoPan);
      }
    }
    applyDrag(G, dx, dy);
    return;
  }
}
/* Everything a move redraws, given how far the pointer has travelled. Split out
   because the edge pan has to redraw between pointer events — the finger is
   holding still at the edge and the board is what moves. */
function applyDrag(G, dx, dy){
    const cx=Math.round(dx/G.stepX), cy=Math.round(dy/G.stepY);
    const box=candidate(G, cx, cy);
    G.cand=box;
    if(G.group){
      // the whole set has to land legally, and only collisions with objects
      // outside the set count
      const ids=G.group.map(g2=>g2.id);
      const moved=G.group.map(g2=>({id:g2.id, box:{x:g2.box.x+cx, y:g2.box.y+cy, w:g2.box.w, h:g2.box.h}}));
      G.moved=moved;
      const g0=gridOf();
      G.ok = moved.every(m=>m.box.x>=1 && m.box.y>=1 && m.box.x+m.box.w-1<=g0.cols)
        && !childrenOf(container(G.parent)).some(o=>!ids.includes(o.id) &&
             moved.some(m=>overlaps(m.box, lay(o))));
    } else {
      G.ok = boxOk(box, G.id, dev(), G.parent);
    }
    G.el.classList.toggle('invalid', !G.ok);
    if(G.type==='move'){
      /* Both: the animation's transform composes --carryx/--carryy and wins,
         and the inline one carries the tile if the sway never started (reduced
         motion, or a resize grip, which is armed without ever being lifted). */
      G.el.style.setProperty('--carryx', dx+'px');
      G.el.style.setProperty('--carryy', dy+'px');
      G.el.style.transform=`translate(${dx}px,${dy}px)`;
      if(G.group) G.group.forEach(g2=>{
        if(g2.id===G.id) return;
        const el=document.querySelector(`.grid .drawer[data-row="${g2.id}"],.grid .drawer[data-drawer="${g2.id}"],.grid .drawer[data-id="${g2.id}"]`);
        if(el){ el.style.transform=`translate(${dx}px,${dy}px)`; el.style.zIndex=49; }
      });
      // what is under the pointer is a place to land, not a collision
      aimDrop(G, G.px, G.py);
      const landing = G.dropDay||G.dropTl||G.dropOn||G.gatherOn;
      G.ghost.className='ghost'+(landing?' hidden':(G.ok?'':' bad'));
      place(G.ghost, box);
    } else {
      place(G.el, box);            // live resize, like dragging a window edge
    }
}
function onUp(e){
  cancelHold();
  stopPan();
  if(!G) return;
  const g=G; G=null;
  const dx=e.clientX-g.sx;

  /* A swipe that got going lets the strip settle where it is heading; one
     that never did was a tap on a locked board, and the tile under it still
     opens (that falls through to the bottom of this function). */
  if(g.mode==='swipe'){ pagerEnd(); return; }
  if(g.type==='swipe'){ if(S.sel.length){ S.sel=[]; render(); } return; }

  if(g.type==='sketch'){
    if(g.ghost) g.ghost.remove();
    if(g.hits && g.hits.length){        // it was a lasso, not a sketch
      S.sel = g.add ? [...new Set([...S.sel, ...g.hits])] : g.hits;
      render();
      return;
    }
    if(S.sel.length){ S.sel=[]; render(); return; }   // a click on bare board clears
    /* A *tap* on bare board does nothing on a phone. It used to open the type
       picker and was triggered by accident far more than on purpose — a board
       is a surface you put a finger on to scroll, steady a thing, or miss a
       tile. The way in is a swipe up off the bottom shelf. Sketching a size by
       dragging still works, on both devices, because that is deliberate. */
    if(g.mode!=='sketch' || !g.cand){
      // a tap does nothing; a hold makes something, right there
      if(S.device!=='desk' && !g.held) return;
      pending.cell={x:g.x0, y:g.y0, parent:g.parent};
    } else pending.cell = g.ok
      ? {x:g.cand.x, y:g.cand.y, w:g.cand.w, h:g.cand.h, parent:g.parent}
      : {x:g.x0, y:g.y0, parent:g.parent};
    modalNewObject();
    return;
  }

  if(g.type==='pinpress') return;     // a tap navigates; the menu is the hold
  if(g.type==='homeedge') return;
  if(g.type==='shelf'){
    if(!g.pull) return;            // a tap; the pin under it navigates
    const open = g.at >= PULL_OPEN();
    const el=g.pull;
    el.classList.remove('ready');
    el.classList.add('settling');
    el.style.setProperty('--pull', open ? (PULL_OPEN()*1.35)+'px' : '0px');
    setTimeout(()=>el.remove(), 260);
    if(open){
      if(navigator.vibrate) navigator.vibrate(6);
      pending.cell=null;
      modalNewObject();
    }
    return;
  }

  if(g.type==='band'){
    g.el.classList.remove('lifted','dragging');
    if(g.mode!=='band') return;          // a tap; let the click open it
    gestureFlags.suppressClick=true;     // the drag must not also open it
    /* Read the new order straight off the list. `ord` is what childrenOf()
       falls back to when nothing sorts, so writing indexes into it is the whole
       of the change — and the boxes are untouched, because a thing's place on a
       grid is a different fact from its place in a list. */
    [...g.list.querySelectorAll('.listband')].forEach((el,i)=>{
      const o=byId(el.dataset.row||el.dataset.drawer);
      if(o) o.ord=i;
    });
    save(); render(); toast('Reordered');
    return;
  }

  if(g.type==='pluck'){
    if(g.chip) g.chip.remove();
    if(g.el) g.el.classList.remove('lifted','plucked');
    if(g.shelfEl) g.shelfEl.classList.remove('dropshelf');
    if(g.dropEl) g.dropEl.classList.remove('dropinto','dropboard');
    if(g.mode!=='pluck') return;         // a tap; let the click tick it off
    gestureFlags.suppressClick=true;     // the drag must not also tick it
    const o=byId(g.id);
    if(o && g.pinIt){
      if(pinIds().length>=GRID.phone.cols){ render(); toast('The shelf is full'); return; }
      setPin(g.id,'pin'); save(); toast(`${o.title||'It'} is on the shelf`); return;
    }
    if(o && g.dropOn && g.dropOn!==o.parent){
      o.parent=g.dropOn; o.desk=null; o.phone=null;   // a new coordinate space
      const into=g.dropOn===ROOT?null:byId(g.dropOn);
      save(); render();
      toast(`Filed in ${into?into.title:'the desk'}`);
    } else render();
    return;
  }

  if(g.type==='pin'){
    g.el.classList.remove('dragging');
    if(g.mode!=='pin') return;            // it was a click; let it navigate
    // Read the new order straight off the shelf. One strip, one list.
    S.pins=[...g.bar.querySelectorAll('.pinbtn')].map(x=>x.dataset.drawer).filter(Boolean);
    gestureFlags.suppressClick=true;      // the drag must not also open it
    save(); render(); toast('Shelf reordered');
    return;
  }

  if(g.mode==='grid'){
    g.el.classList.remove('dragging','invalid','lifted');
    clearCarry(g.el); g.el.style.pointerEvents='';
    if(g.group) g.group.forEach(g2=>{
      const el=document.querySelector(`.grid .drawer[data-row="${g2.id}"],.grid .drawer[data-drawer="${g2.id}"],.grid .drawer[data-id="${g2.id}"]`);
      if(el){ el.style.transform=''; el.style.zIndex=''; }
    });
    if(g.ghost) g.ghost.remove();
    const aim={day:g.dropDay, tl:g.dropTl, on:g.dropOn, gath:g.gatherOn, gk:g.gatherKind,
               pin:g.pinIt};
    clearAim(g);
    const d=byId(g.id);
    /* Carried onto the shelf: it is pinned, and it does not move. Pinning is
       about reach, not about where a thing lives — the object stays on the
       board it was on, in the box it was in, which is why nothing here touches
       `parent` or the layout. */
    if(d && aim.pin){
      const cols=GRID.phone.cols;
      if(pinIds().length>=cols){ render(); toast('The shelf is full — take something off it first'); return; }
      setPin(g.id, 'pin'); save();
      toast(`${d.title||'It'} is on the shelf`);
      return;
    }
    const swallow=id=>{ const el=document.querySelector(`[data-drawer="${id}"]`);
      if(el){ el.classList.add('swallow'); setTimeout(()=>el.classList.remove('swallow'),420); } };
    // dropped on a day: it gets that date, and moves into the container showing
    // the month, because a date it can't be seen on is only half the gesture
    if(d && aim.day){
      const [did,iso]=aim.day.split(':');
      reschedule(d, iso); fileInto(d, did);
      save(); render(); toast(`Scheduled ${D.said(iso)}`);
      return;
    }
    // dropped along a timeline: the point on the axis is the date
    if(d && aim.tl){
      reschedule(d, aim.tl.iso); fileInto(d, aim.tl.id);
      save(); render(); swallow(aim.tl.id);
      toast(`Placed at ${D.said(aim.tl.iso)}`);
      return;
    }
    // dropped on something it agrees with: the two become what they add up to
    if(d && aim.gath){
      const c=gather(g.id, aim.gath, aim.gk);
      save(); render();
      if(c) swallow(c.id);
      return;
    }
    if(d && aim.on){
      const into=byId(aim.on);
      fileInto(d, aim.on);                   // it will be placed inside on first render
      save(); render(); swallow(aim.on);
      toast(`Filed in ${into?into.title:'the drawer'}`);
      return;
    }
    if(d && g.moved && g.ok) g.moved.forEach(m=>{ const o=byId(m.id); if(o) o[dev()]={...m.box}; });
    else if(d && g.cand && g.ok) d[dev()]={...g.cand};
    save(); render();
    if(d && g.cand && !g.ok) toast('No room there');
    return;
  }

  if(g.el) g.el.classList.remove('lifted');
  // the menu is up and the finger simply left: the menu is the answer
  if(g.menu) return;
  if(g.mode===null && Math.abs(dx)<7){
    // a tap on a button's face fires it; anywhere else follows the type
    const o=byId(g.id);
    if(o && has(o,'button') && g.startedOnFace) fireButton(o); else tileTap(g.id);
  }
}

/* ============================================================
   19b · two fingers — the board's own navigation
   ============================================================
   On an *unlocked* board one finger is already busy: it carries tiles, ticks
   boxes and scrolls. So moving between boards, and between the pages of one,
   is two fingers, which nothing else in Bureau uses and which no tile can
   swallow. Lock the board and one finger does the same thing, because on a
   locked board there is nothing else for it to do — see swipeMove().

     up / down     the next page of this board, and the one before
     left / right  the next pinned drawer, and the one before — the shelves in
                   order, with the desk at the front of the loop

   The direction is the one every scrolling surface uses: what you are looking
   at follows the fingers, so pushing the board up brings the next page in from
   below. Both gestures go through the pager, which draws the neighbouring
   board *beside* this one and slides the pair — so a swipe is something you
   can do slowly, see coming, and pull back from. */
const TWO = {on:false, x:0, y:0, axis:null, from:0, mode:null};
function onTouchStart(e){
  if(!e.touches || e.touches.length!==2){ TWO.on=false; return; }
  const [a,b]=e.touches;
  TWO.on=true; TWO.axis=null; TWO.from=0; TWO.mode=null;
  TWO.x=(a.clientX+b.clientX)/2; TWO.y=(a.clientY+b.clientY)/2;
  onCancel();                      // two fingers is never a drag
  gestureFlags.suppressClick=true;
}
function onTouchMove(e){
  if(!TWO.on || !e.touches || e.touches.length!==2) return;
  const [a,b]=e.touches;
  swipeMove(TWO, (a.clientX+b.clientX)/2 - TWO.x, (a.clientY+b.clientY)/2 - TWO.y);
}
function onTouchEnd(e){
  if(e.touches && e.touches.length>=2) return;
  if(TWO.on && TWO.mode==='swipe') pagerEnd();
  TWO.on=false; TWO.axis=null; TWO.mode=null;
}

/* A drag ends with a click event the browser sends anyway. When the drag *was*
   the gesture, that click has to be swallowed or reordering a pin would also
   open the drawer. wire.js clears this on the next click it sees. */
const gestureFlags = {suppressClick:false};
/* Whether a tile is currently being carried. wire.js asks, because two things
   outside this module have to stand down while one is: the page's own scroll,
   and the long-press context menu that iOS fires at about the same moment the
   hold arms. */
const dragArmed = ()=> !!(G && G.armed);

function onCancel(){
  cancelHold();
  stopPan();
  pagerCancel();
  if(G){ clearAim(G); if(G.ghost) G.ghost.remove();
         if(G.shelfEl) G.shelfEl.classList.remove('dropshelf');
         if(G.chip) G.chip.remove();
         if(G.pull) G.pull.remove();
         if(G.dropEl) G.dropEl.classList.remove('dropinto','dropboard');
         if(G.el){ clearCarry(G.el); G.el.style.pointerEvents='';
                   G.el.classList.remove('lifted','dragging','invalid','plucked'); } G=null; }
}

export { onDown, onMove, onUp, onCancel, onTouchStart, onTouchMove, onTouchEnd,
  gestureFlags, dragArmed };
