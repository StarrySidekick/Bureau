import { $, clamp, ROOT } from './util.js';
import { S, byId, isContainer, faceOf, openingOf, dev, deskIds, deskOf } from './model.js';
import { lay } from './grid.js';
import { objColour } from './look.js';
import { render, renderSoon, previewHTML, pageAt, pageCount, goPage } from './views.js';

/* ============================================================
   20 · motion — the movements the desk makes
   ============================================================
   One rule holds the whole file together, and breaking it is what makes an
   animated app feel slow: **nothing here delays a state change.** A tap files,
   ticks or navigates the instant it lands, `render()` runs, and the movement is
   an overlay drawn over the result. So the drawer front you just pulled is a
   copy flying over a board that has already changed, and a test — or an
   impatient second tap — never has to wait for a keyframe to finish.

   Everything is drawn into #fx, a pointer-transparent layer over #frame, and
   removes itself. Nothing in here is ever stored.                            */

const still = ()=> window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fx = ()=> $('#fx');
const frameRect = ()=> $('#frame').getBoundingClientRect();

/* The element standing for an object right now. A ticked task might be a tile
   on a board or a line on a checklist's front, and both are worth popping. */
function tileOf(id){
  return document.querySelector(
    `#app .grid .drawer[data-drawer="${id}"], #app .grid .drawer[data-row="${id}"], `+
    `#app .cline[data-check="${id}"], #app .listband[data-row="${id}"]`);
}
const tileRect = id => { const el=tileOf(id); return el ? el.getBoundingClientRect() : null; };

/* Place a floating box over the frame, in the frame's own coordinates. */
function at(el, r){
  const f=frameRect();
  el.style.left=(r.left-f.left)+'px'; el.style.top=(r.top-f.top)+'px';
  el.style.width=r.width+'px'; el.style.height=r.height+'px';
}

/* A copy of a tile that can live outside a grid: its cell placement, its
   handles and any id that would now be a duplicate all go. Named for what it
   returns — an element — because `faceOf` is an object's face, from model.js. */
function faceEl(el){
  const c=el.cloneNode(true);
  c.style.gridColumn=''; c.style.gridRow='';
  c.style.position='absolute'; c.style.inset='0'; c.style.margin='0';
  c.classList.remove('lifted','dragging','selected','invalid');
  c.querySelectorAll('.rz').forEach(h=>h.remove());
  c.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
  return c;
}

/* ---- how a thing opens ------------------------------------------------
   `auto` asks the object what it is. Everything that is not a container is
   paper: the shapes drawn as a sheet curl up off the board, and the rest give a
   small lift to say they were hit.

   A container is a cabinet when it **stands** — taller than it is wide, and at
   least two cells across — and a drawer otherwise. That is the whole test. A
   drawer is a thing you pull horizontally out of a carcass, and a front taller
   than it is wide has never been one; two doors inside a single cell is not a
   cabinet either, which is what the width floor is for.

   It used to have a second clause: anything over a certain *area* swung open
   too. That is what put doors on a 4×3 — a front half again as wide as it is
   tall, which is a drawer in every piece of furniture ever built. Size is not
   the question; which way round it is, is.

   `box` is passed by the tile renderer, which already has the box it is drawing
   into — including the flowed box a sorted board packs an object into, which
   lay() knows nothing about. Left out, it asks lay() the same as before. */
const PAPER = ['note','idea','verse','quote','index','page','chit'];
const standing = b => b.w>=2 && b.h>b.w;
function openingFor(o, box){
  const how = openingOf(o);
  if(how!=='auto') return how;
  if(isContainer(o)) return standing(box||lay(o)) ? 'cabinet' : 'drawer';
  return PAPER.includes(faceOf(o)) ? 'curl' : 'lift';
}

/* Opening something. `go` is the thing that actually happens — navigating into
   a drawer, opening a surface — and it is called straight away, every time,
   including when there is no animation to play at all. */
const OPEN_MS = {drawer:420, cabinet:520, curl:520, lift:340};
function openTile(id, go){
  const o=byId(id);
  if(!o){ go(); return; }
  const how=openingFor(o), el=tileOf(id);
  if(how==='none' || still() || !el || !fx()){ go(); return; }
  // the browser sends a click after the pointerup that already opened this;
  // it is the same tap, so it does not get a second animation
  if(el.classList.contains('curling') || el.classList.contains('lifting')){ go(); return; }

  // curl and lift happen to the tile itself: it stays on the board, and what
  // opens over it is a surface rather than another board
  if(how==='curl' || how==='lift'){
    const cls = how==='curl' ? 'curling' : 'lifting';
    el.classList.add(cls);
    /* The underside of the curl is a real child rather than a pseudo-element:
       two of the paper shapes already spend ::before on their own silhouette,
       and a flourish must never take a slot a shape is using. */
    let shade=null;
    if(how==='curl'){ shade=document.createElement('i'); shade.className='curlshade'; el.appendChild(shade); }
    setTimeout(()=>{ el.classList.remove(cls); if(shade) shade.remove(); }, OPEN_MS[how]);
    go();
    return;
  }

  // a drawer or a cabinet: the front comes off the board, and what was behind
  // it is the board you have just arrived on
  const r=el.getBoundingClientRect();
  const ghost=document.createElement('div');
  ghost.className='fxopen fx-'+how;
  at(ghost, r);
  ghost.style.setProperty('--c', objColour(o));
  if(how==='cabinet'){
    ghost.innerHTML=`<i class="fxcave"></i>
      <div class="fxleaf l"><div class="fxhalf"></div></div>
      <div class="fxleaf r"><div class="fxhalf"></div></div>`;
    ghost.querySelectorAll('.fxhalf').forEach(h=>h.appendChild(faceEl(el)));
  } else {
    ghost.innerHTML=`<i class="fxcave"></i><div class="fxfront"></div>`;
    ghost.querySelector('.fxfront').appendChild(faceEl(el));
  }
  fx().appendChild(ghost);
  go();
  enter(how);
  setTimeout(()=>ghost.remove(), OPEN_MS[how]);
}

/* The board that has just been rendered, arriving. Set after go() because
   render() replaces #app wholesale and would take the class with it. */
function enter(kind){
  const m=$('#app .main');
  if(!m || still()) return;
  const cls='in-'+kind;
  m.classList.add(cls);
  setTimeout(()=>m.classList.remove(cls), 520);
}

/* ---- ticking something off -------------------------------------------
   Called *after* the render that ticked it, with the rect the tile had before
   — because "done" often means the thing leaves the drawer it was in, and a
   pop you can only see when it survives is a pop you mostly never see. If it
   is still there it pops in place; either way a ring goes out from where it
   was standing. */
function pop(id, was){
  if(still()) return;
  const el=tileOf(id);
  if(el){
    el.classList.add('popped');
    setTimeout(()=>el.classList.remove('popped'), 460);
  }
  const r=(el && el.getBoundingClientRect()) || was;
  const o=byId(id);
  if(!r || !r.width || !fx()) return;
  const ring=document.createElement('i');
  ring.className='fxring';
  const f=frameRect(), s=Math.max(28, Math.min(r.width, r.height));
  ring.style.cssText=`left:${r.left-f.left+r.width/2}px;top:${r.top-f.top+r.height/2}px;`+
    `width:${s}px;height:${s}px;--k:${o?objColour(o):'var(--brass)'}`;
  fx().appendChild(ring);
  setTimeout(()=>ring.remove(), 560);
}

/* ============================================================
   20b · the holographic foil, and why it is gone
   ============================================================
   A magic drawer used to be holographic: a rainbow foil under a specular
   highlight, both driven off two numbers — --holox and --holoy on #frame —
   that came from how the phone was tilted, or from where the pointer was.

   It was clever and it was tacky. A drawer that fills itself is *illuminated*,
   which is a manuscript idea, not a trading-card one; the spectrum was the one
   place in the app that named hues outright and it read as a sticker stuck on
   the furniture. So the foil is gone, and with it the whole tilt apparatus —
   the deviceorientation listener, the iOS permission prompt, the easing loop
   and the Settings button that asked for all three. What is left is the gilt:
   a ruled frame inset from the edge with corner brackets, drawn in the style's
   own Glow. See decision 42.

   Nothing replaced --holox/--holoy. If a surface ever wants to react to how a
   phone is held again, it starts here and it starts from a stated reason.

   ============================================================
   20c · the pager — boards that slide
   ============================================================
   Walking between pinned drawers, and between the pages of one board, used to
   be a swipe that redrew the screen the moment it passed a threshold. It was
   correct and it felt like nothing: there was no sense of the boards being
   laid out beside each other, so a wrong turn was a surprise rather than
   something you could see coming and pull back from.

   So the neighbour is drawn before you get there. The board you are on, and
   the one either side of it, sit in a strip that follows your finger; letting
   go either carries it the rest of the way or puts it back. That is the whole
   trick behind an iOS home screen, and it is why paging there is something you
   can do slowly.

   Two axes and one mechanism. Sideways the strip is the whole of `.main`,
   because the bar at the top says which drawer you are in and that has to
   travel with it. Up and down it is only the board, because the page dots are
   a fact about where you are and should not slide off with the page they are
   counting.                                                                  */
let PG=null;

const pagerOn = ()=> !!PG;

/* The desks, in the order they sit in the master space. It does **not** wrap:
   a row you can walk off the end of is a row you can learn — "Finance is two
   to the right of home" only means something if two to the right of the last
   desk is nothing at all. A loop with a seam in it is not a space. */
function drawerStops(){ return deskIds(); }
/* `soon` rebuilds on the next frame instead of this one. Where you are changes
   either way and changes now — it is only the DOM that waits, and only while
   there is an opaque strip over it. See renderSoon() in views.js. */
function stepDrawer(d, soon){
  const stops=drawerStops();
  if(stops.length<2) return false;
  const at2=Math.max(0, stops.indexOf(deskOf(S.view==='drawer' ? S.drawerId : ROOT)));
  const to=stops[at2+d];
  if(to==null) return false;                 // the end of the row
  S.view = to===ROOT ? 'desk' : 'drawer';
  S.drawerId = to===ROOT ? null : to;
  S.kindFilter=null;
  if(soon) renderSoon(); else render();
  return true;
}

function pane(cls, html){
  const p=document.createElement('div');
  p.className='pane '+cls;
  if(html!=null) p.innerHTML=html;
  return p;
}

/* Begin tracking. Returns false when there is nowhere to go, so the caller can
   let the gesture fall through to whatever else it might have been. When the
   desk is set to reduced motion it still begins — as a `flat` pager, which
   draws nothing and commits on release, so one code path covers both. */
function pagerBegin(axis, dir){
  if(PG) return true;
  const app=$('#app');
  const host = axis==='x' ? $('#app .main') : $('#app .scroll');
  if(!app || !host || !host.getBoundingClientRect().width) return false;

  const here = S.view==='drawer' ? S.drawerId : ROOT;
  let prev=null, next=null;
  if(axis==='x'){
    const stops=drawerStops();
    if(stops.length<2) return false;
    const i=Math.max(0, stops.indexOf(deskOf(S.view==='drawer' ? S.drawerId : ROOT)));
    // undefined at either end of the row, which is what makes the strip give
    // rather than carry you round to the other side of the desk
    const to=n=>{ const id=stops[n];
      return id==null ? null : {view:id===ROOT?'desk':'drawer', drawerId:id===ROOT?null:id}; };
    prev=to(i-1); next=to(i+1);
    if(!prev && !next) return false;
  } else {
    const n=pageAt(here), last=pageCount(here)-1;
    if(last<1) return false;
    const me={view:S.view, drawerId:S.drawerId};
    if(n>0) prev={...me, page:n-1};
    if(n<last) next={...me, page:n+1};
    if(!prev && !next) return false;
  }

  const r=host.getBoundingClientRect(), fr=frameRect();
  PG={axis, here, prev, next, at:0, w:r.width, h:r.height,
      last:0, vel:0, t:performance.now(), flat:still()};
  if(PG.flat) return true;

  /* The strip is hung off #frame, beside #app rather than inside it — the
     same reason panels are. Letting go commits immediately, and committing
     means render(), which replaces #app wholesale: a pager living in there
     would delete itself halfway through its own slide. Out here the state
     change lands under an opaque strip that is still finishing the movement,
     which is the rule the whole of this file is built on. */
  const el=document.createElement('div');
  el.className='pager ax-'+axis;
  el.style.cssText=`left:${r.left-fr.left}px;top:${r.top-fr.top}px;`+
    `width:${r.width}px;height:${r.height}px`;
  const track=document.createElement('div');
  track.className='track';

  /* ---- what the middle of the strip is, and when ----------------------
     The middle has to end up as a **still picture** of the board you are
     leaving, because letting go rebuilds #app underneath and the real one
     would turn into the board you have arrived at while it was still sliding
     away. That picture is `host.cloneNode(true)` — cheap to make and thirteen
     milliseconds to *lay out*, because it is a second full board in the
     document and every tile on it has to be placed before a single frame of
     the swipe can be painted.

     It is not needed until you let go. So for the first frame the strip is
     transparent and carries the **real** board: `host` takes the same
     transform the track does and the three move as one, with nothing extra
     built and nothing extra laid out on the frame the gesture is recognised
     in. The picture is made on the next frame, while your finger is still
     moving, and the real board steps out of the strip the moment it exists.
     Same three boards in the end; the work is spread over two frames instead
     of landing on the one that has to feel instant. */

  /* ---- one board now, the other next frame ---------------------------
     Building a neighbour means building a whole board — every tile on it,
     every rule a magic drawer on it runs — and then laying it out. Doing both
     of them in the frame the gesture is recognised in is the hitch you feel as
     the swipe starts, and one of the two is *away from where your finger is
     going*: it cannot be seen until you reverse past the middle, which takes
     longer than a frame.

     So the one you are heading towards is built now and the other on the next
     frame. `dir` is the sign of the movement that crossed the threshold — a
     finger going left reveals `next`. Nothing else changes: both panes exist
     from the start, so the geometry and the commit are what they always were. */
  const prevPane=pane('prev'), nextPane=pane('next');
  const fill=(p, spot)=>{ if(p && spot) p.innerHTML = side(axis, spot); };
  const near = dir<0 ? nextPane : prevPane, nearSpot = dir<0 ? next : prev;
  const far  = dir<0 ? prevPane : nextPane, farSpot  = dir<0 ? prev : next;
  fill(near, nearSpot);

  track.appendChild(prevPane);
  track.appendChild(nextPane);
  el.appendChild(track);
  $('#app').after(el);        // over the board, under #fx and any panel
  host.style.willChange='transform';
  PG.el=el; PG.track=track; PG.live=host; PG.carry=true;

  const mine=PG;
  requestAnimationFrame(()=>{
    if(PG!==mine) return;
    fill(far, farSpot);
    // …and the still picture, which is what lets #app be rebuilt on release
    const cur=pane('cur');
    const twin=host.cloneNode(true);
    twin.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
    twin.removeAttribute('id');
    twin.style.transform=''; twin.style.willChange=''; twin.style.visibility='';
    const sc=host.classList.contains('scroll') ? host : host.querySelector('.scroll');
    if(sc){ const t2=twin.classList.contains('scroll') ? twin : twin.querySelector('.scroll');
            if(t2) t2.scrollTop=sc.scrollTop; }
    cur.appendChild(twin);
    track.insertBefore(cur, nextPane);
    /* The picture has taken over, so the real board stops moving and stands
       down. Both happen before this frame is painted, so there is no seam. */
    PG.carry=false;
    host.style.transform=''; host.style.visibility='hidden';
  });
  return true;
}
/* Sideways is the whole screen; up and down is the board out of it. */
function side(axis, spot){
  const html=previewHTML(spot);
  if(axis==='x') return html;
  const box=document.createElement('div');
  box.innerHTML=html;
  const sc=box.querySelector('.scroll');
  return sc ? sc.outerHTML : '';
}

/* Where the strip is. The real board is carried only until its picture exists
   — see pagerBegin() — and after that the track is the only thing moving. */
function slide(g, v){
  const t = g.axis==='x' ? `translateX(${v}px)` : `translateY(${v}px)`;
  if(g.track) g.track.style.transform = t;
  if(g.carry && g.live) g.live.style.transform = t;
}
function pagerMove(d){
  if(!PG) return;
  const size = PG.axis==='x' ? PG.w : PG.h;
  // nothing that way: the strip still gives, but only a third as much, which
  // is the whole of how a screen says "this is the end"
  const open = d>0 ? PG.prev : PG.next;
  let v = clamp(open ? d : d*0.32, -size, size);
  // smoothed, because one sample of a touch stream is mostly noise
  const now=performance.now(), dt=Math.max(1, now-PG.t);
  PG.vel = PG.vel*0.4 + ((v-PG.last)/dt)*0.6;
  PG.last=v; PG.t=now; PG.at=v;
  /* One write per **frame**, not one per event. A phone reports a finger
     faster than it can draw it, so the untouched version wrote the transform
     two or three times for every frame anyone ever saw — the last one is the
     only one that was ever painted. */
  if(!PG.raf) PG.raf = requestAnimationFrame(()=>{
    if(!PG) return;
    PG.raf=0; slide(PG, PG.at);
  });
}

function pagerEnd(){
  if(!PG) return;
  const g=PG;
  const size = g.axis==='x' ? g.w : g.h;
  const far  = Math.abs(g.at) > Math.min(size*0.24, 110);
  // a flick is short but fast; it still has to have gone somewhere, or every
  // quick tap-and-slip off a locked board would change drawer
  const flick= Math.abs(g.vel) > 0.9 && Math.abs(g.at) > 30;
  let step = 0;
  if(far || flick){
    const dir = (flick ? -Math.sign(g.vel) : (g.at>0 ? -1 : 1));
    if(dir<0 && g.prev) step=-1;
    else if(dir>0 && g.next) step=1;
  }
  PG=null;
  if(g.raf) cancelAnimationFrame(g.raf);
  if(g.flat){ if(step) commit(g, step); letGo(g); return; }

  /* The settle is started **first** and the commit follows, rebuilding on the
     next frame. Where you are changes now, in this same call — it is only the
     DOM that waits, and it waits under an opaque strip that is already drawing
     the board you are arriving at. The other way round, the rebuild landed on
     the very frame the transition was meant to begin on and the strip stuttered
     to a halt instead of gliding to one. */
  const to = step ? -step*size : 0;
  const ease='transform .26s cubic-bezier(.22,1,.3,1)';
  g.track.style.transition=ease;
  if(g.carry && g.live) g.live.style.transition=ease;
  slide(g, to);
  if(step) commit(g, step, true);
  setTimeout(()=>{ if(g.el) g.el.remove(); letGo(g); }, 280);
}
/* Put the real board back. It is the live element — not a copy — so a
   transform, a transition or the `hidden` it was given when its picture took
   over would all follow the desk around for ever. Usually it has already been
   replaced by the render the commit asked for, in which case this is styling a
   detached node and costs nothing; when the swipe was pulled back there was no
   render and this is the whole of putting it right. */
function letGo(g){
  const h=g.live; if(!h) return;
  h.style.transition=''; h.style.transform='';
  h.style.willChange=''; h.style.visibility='';
}
function commit(g, step, soon){
  if(g.axis==='x') stepDrawer(step, soon);
  // goPage() clamps and renders, so a page that has gone away between the
  // swipe starting and it ending simply lands on the nearest one
  else goPage(g.here, pageAt(g.here)+step, soon);
}
function pagerCancel(){
  if(!PG) return;
  const g=PG; PG=null;
  if(g.raf) cancelAnimationFrame(g.raf);
  if(g.el) g.el.remove();
  letGo(g);
}

export { still, tileOf, tileRect, openingFor, openTile, enter, pop,
  pagerBegin, pagerMove, pagerEnd, pagerCancel, pagerOn, stepDrawer };
