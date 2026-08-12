import { $$, clamp, D, ROOT } from './util.js';
import { S, byId, dev, has, isAncestor, childrenOf, container } from './model.js';
import { CELL, gridOf, cellW, lay, boxOk, overlaps } from './grid.js';
import { toast } from './mutations.js';
import { pending, tileTap, fireButton } from './tiles.js';
import { modalNewObject } from './panels.js';
import { render } from './views.js';
import { save } from './persist.js';

/* ============================================================
   19 · gestures: swipe + drag reorder
   ============================================================ */
let G=null;
let holdTimer=null, holdFrom=null;
// any real movement, or letting go, means it was not a press-and-hold
function cancelHold(e){
  if(!holdTimer) return;
  if(e && holdFrom && Math.abs(e.clientX-holdFrom.x)<6 && Math.abs(e.clientY-holdFrom.y)<6) return;
  clearTimeout(holdTimer); holdTimer=null;
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

function onDown(e){
  if(e.button===2) return;
  /* A pin can be dragged along the bar to reorder it. The bar is chrome, not a
     grid, so it gets its own tiny path rather than going through the box
     maths — and a plain click still has to navigate, which is why nothing
     happens until the pointer has actually moved. */
  const pinEl=e.target.closest('.pinbar .pinbtn[data-drawer]');
  if(pinEl && S.device==='desk'){
    G={type:'pin', el:pinEl, id:pinEl.dataset.drawer, bar:pinEl.parentElement,
       sx:e.clientX, sy:e.clientY, mode:null};
    return;
  }
  // Any tile on any unlocked grid. There is no arrange mode — everything is
  // always movable — so a short hold arms the drag, which is the only thing
  // keeping an ordinary click from picking the tile up.
  // bare grid: start sketching a box for a new object
  if(e.target.classList && e.target.classList.contains('grid') && !e.target.classList.contains('locked')){
    const grid=e.target, g=gridOf(), r=grid.getBoundingClientRect(), cw=cellW(grid,g);
    const cx=clamp(Math.floor((e.clientX-r.left)/(cw+g.gap))+1, 1, g.cols);
    const cy=Math.max(1, Math.floor((e.clientY-r.top)/(CELL[dev()]+g.gap))+1);
    G={type:'sketch', grid, parent:grid.dataset.gridfor||ROOT, x0:cx, y0:cy,
       stepX:cw+g.gap, stepY:CELL[dev()]+g.gap, sx:e.clientX, sy:e.clientY, mode:null,
       add:e.shiftKey||e.metaKey||e.ctrlKey, hits:[]};
    return;
  }
  // a tick, a counter or a button inside a tile is its own target
  // A tick or a counter is its own target. A button tile carries data-fire on
  // the tile itself, so only its face counts — otherwise the whole thing would
  // be undraggable.
  if(e.target.closest('[data-check],.cntnum')) return;
  const dEl=e.target.closest('.grid .drawer[data-drawer],.grid .drawer[data-row],.grid .drawer[data-id]');
  if(dEl && dEl.closest('.grid.sorted')){
    toast('Sorted drawers arrange themselves — switch to Custom to move things');
    return;
  }
  if(dEl && !dEl.closest('.grid.locked')){
    const grid=dEl.closest('.grid');
    const d=byId(dEl.dataset.drawer||dEl.dataset.row||dEl.dataset.id);
    if(!d || !grid) return;
    const hEl=e.target.closest('[data-rz]'), g=gridOf();
    G={type: hEl?'resize':'move', el:dEl, id:d.id, handle:hEl?hEl.dataset.rz:null,
       armed:!!hEl,                 // a corner grip drags at once; a tile waits
       startedOnFace:!!e.target.closest('.btnface'),
       // dragging any member of a selection moves the lot, keeping their
       // relative positions — the offsets are captured up front
       group: (S.sel.includes(d.id) && S.sel.length>1)
         ? S.sel.map(byId).filter(Boolean).map(o=>({id:o.id, box:lay(o)})) : null,
       parent:grid.dataset.gridfor||ROOT,
       box:lay(d), stepX:cellW(grid,g)+g.gap, stepY:g.rowh+g.gap,
       sx:e.clientX, sy:e.clientY, mode:null, ok:true, cand:null};
    try{ dEl.setPointerCapture&&dEl.setPointerCapture(e.pointerId); }catch(_){}
    if(!G.armed){
      const g=G;
      holdTimer=setTimeout(()=>{
        holdTimer=null;
        if(G!==g) return;
        G.armed=true;
        G.el.classList.add('lifted');
        if(navigator.vibrate) navigator.vibrate(6);
      }, 200);
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

  if(G.type==='sketch'){
    if(!G.mode){
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
    const sibs=[...G.bar.querySelectorAll('.pinbtn[data-drawer]')].filter(x=>x!==G.el);
    const after=sibs.filter(x=>{ const r=x.getBoundingClientRect(); return e.clientX > r.left+r.width/2; }).pop();
    if(after) after.after(G.el); else {
      const firstPin=G.bar.querySelector('.pinbtn[data-drawer]');
      if(firstPin && firstPin!==G.el) firstPin.before(G.el);
    }
    return;
  }

  if(G.type==='move' || G.type==='resize'){
    if(!G.armed) return;             // still waiting out the hold
    if(!G.mode){
      if(Math.abs(dx)<5 && Math.abs(dy)<5) return;
      G.mode='grid';
      G.el.classList.add('dragging');
      // the tile follows the pointer, so it has to stop being hit-testable or
      // elementFromPoint only ever finds the thing being dragged
      if(G.type==='move') G.el.style.pointerEvents='none';
      if(G.type==='move'){
        G.ghost=document.createElement('div');
        G.ghost.className='ghost';
        place(G.ghost, G.box);
        G.el.parentElement.appendChild(G.ghost);
      }
    }
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
      G.el.style.transform=`translate(${dx}px,${dy}px)`;
      if(G.group) G.group.forEach(g2=>{
        if(g2.id===G.id) return;
        const el=document.querySelector(`.grid .drawer[data-row="${g2.id}"],.grid .drawer[data-drawer="${g2.id}"],.grid .drawer[data-id="${g2.id}"]`);
        if(el){ el.style.transform=`translate(${dx}px,${dy}px)`; el.style.zIndex=49; }
      });
      // a drawer under the pointer is a place to file into, not a collision
      const under=document.elementFromPoint(e.clientX,e.clientY);
      /* A day cell sits inside a calendar drawer's tile, so it has to be asked
         about first — otherwise every drop would just file into the drawer and
         the date would be lost. */
      // a group has no single date to set, so it only ever files, never schedules
      const dayEl=!G.group && under && under.closest('[data-calday]');
      if(G.dayEl && G.dayEl!==dayEl) G.dayEl.classList.remove('dropday');
      G.dayEl=dayEl||null;
      G.dropDay = dayEl ? dayEl.dataset.calday : null;
      if(dayEl) dayEl.classList.add('dropday');
      const over=!dayEl && under && under.closest('.grid .drawer[data-drawer]');
      const overId=over && over.dataset.drawer;
      const canDrop = !G.group && overId && overId!==G.id && !isAncestor(G.id, byId(overId)) && !has(byId(overId),'magic');
      if(G.dropOn && G.dropOn!==overId){ const p=document.querySelector(`[data-drawer="${G.dropOn}"]`); p&&p.classList.remove('dropinto'); }
      G.dropOn = canDrop ? overId : null;
      if(G.dropOn) over.classList.add('dropinto');
      G.ghost.className='ghost'+(G.dropOn?' hidden':(G.ok?'':' bad'));
      place(G.ghost, box);
    } else {
      place(G.el, box);            // live resize, like dragging a window edge
    }
    return;
  }
}
function onUp(e){
  if(holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
  if(!G) return;
  const g=G; G=null;
  const dx=e.clientX-g.sx;

  if(g.type==='sketch'){
    if(g.ghost) g.ghost.remove();
    if(g.hits && g.hits.length){        // it was a lasso, not a sketch
      S.sel = g.add ? [...new Set([...S.sel, ...g.hits])] : g.hits;
      render();
      return;
    }
    if(S.sel.length){ S.sel=[]; render(); return; }   // a click on bare board clears
    pending.cell = g.mode==='sketch' && g.ok
      ? {x:g.cand.x, y:g.cand.y, w:g.cand.w, h:g.cand.h, parent:g.parent}
      : {x:g.x0, y:g.y0, parent:g.parent};
    modalNewObject();
    return;
  }

  if(g.type==='pin'){
    g.el.classList.remove('dragging');
    if(g.mode!=='pin') return;            // it was a click; let it navigate
    S.pins=[...g.bar.querySelectorAll('.pinbtn[data-drawer]')].map(x=>x.dataset.drawer);
    gestureFlags.suppressClick=true;      // the drag must not also open it
    save(); render(); toast('Bar reordered');
    return;
  }

  if(g.mode==='grid'){
    g.el.classList.remove('dragging','invalid','lifted');
    g.el.style.transform=''; g.el.style.pointerEvents='';
    if(g.group) g.group.forEach(g2=>{
      const el=document.querySelector(`.grid .drawer[data-row="${g2.id}"],.grid .drawer[data-drawer="${g2.id}"],.grid .drawer[data-id="${g2.id}"]`);
      if(el){ el.style.transform=''; el.style.zIndex=''; }
    });
    if(g.ghost) g.ghost.remove();
    $$('.dropinto').forEach(e2=>e2.classList.remove('dropinto'));
    $$('.dropday').forEach(e2=>e2.classList.remove('dropday'));
    const d=byId(g.id);
    // dropped on a day: it gets that date, and moves into the drawer showing
    // the month, because a date it can't be seen on is only half the gesture
    if(d && g.dropDay && !g.group){
      const [did,iso]=g.dropDay.split(':');
      if(has(d,'date')){
        d.due=iso;
        if(d.parent!==did && !isAncestor(d.id, byId(did))){ d.parent=did; d[dev()]=null; }
        save(); render(); toast(`Scheduled ${D.human(iso).toLowerCase()}`);
      } else { render(); toast(`${d.title||'That'} has no date to set`); }
      return;
    }
    if(d && g.dropOn){
      const into=byId(g.dropOn);
      d.parent=g.dropOn; d[dev()]=null;      // it will be placed inside on first render
      save(); render();
      const el=document.querySelector(`[data-drawer="${g.dropOn}"]`);
      if(el){ el.classList.add('swallow'); setTimeout(()=>el.classList.remove('swallow'),420); }
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
  if(g.mode===null && Math.abs(dx)<7){
    // a tap on a button's face fires it; anywhere else follows the type
    const o=byId(g.id);
    if(o && has(o,'button') && g.startedOnFace) fireButton(o); else tileTap(g.id);
  }
}

/* A drag ends with a click event the browser sends anyway. When the drag *was*
   the gesture, that click has to be swallowed or reordering a pin would also
   open the drawer. wire.js clears this on the next click it sees. */
const gestureFlags = {suppressClick:false};

function onCancel(){
  if(holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
  if(G){ if(G.el){ G.el.style.transform=''; G.el.classList.remove('lifted','dragging','invalid'); } G=null; }
}

export { onDown, onMove, onUp, onCancel, gestureFlags };
