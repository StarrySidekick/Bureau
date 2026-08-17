import { $, clamp, ROOT } from './util.js';
import { S, byId, isContainer, shapeOf, openingOf, dev, deskIds, deskOf } from './model.js';
import { lay } from './grid.js';
import { objColour } from './look.js';
import { render, previewHTML, pageAt, pageCount, goPage } from './views.js';

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
   handles and any id that would now be a duplicate all go. */
function faceOf(el){
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
  return PAPER.includes(shapeOf(o)) ? 'curl' : 'lift';
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
    ghost.querySelectorAll('.fxhalf').forEach(h=>h.appendChild(faceOf(el)));
  } else {
    ghost.innerHTML=`<i class="fxcave"></i><div class="fxfront"></div>`;
    ghost.querySelector('.fxfront').appendChild(faceOf(el));
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
function stepDrawer(d){
  const stops=drawerStops();
  if(stops.length<2) return false;
  const at2=Math.max(0, stops.indexOf(deskOf(S.view==='drawer' ? S.drawerId : ROOT)));
  const to=stops[at2+d];
  if(to==null) return false;                 // the end of the row
  S.view = to===ROOT ? 'desk' : 'drawer';
  S.drawerId = to===ROOT ? null : to;
  S.kindFilter=null;
  render();
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
function pagerBegin(axis){
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

  // the middle pane is a copy of what is on the screen, so nothing reflows as
  // the strip is built and there is nothing to hide underneath it
  const cur=pane('cur');
  const twin=host.cloneNode(true);
  twin.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
  twin.removeAttribute('id');
  cur.appendChild(twin);
  const sc=host.classList.contains('scroll') ? host : host.querySelector('.scroll');
  if(sc){ const t2=twin.classList.contains('scroll') ? twin : twin.querySelector('.scroll');
          if(t2) t2.scrollTop=sc.scrollTop; }

  track.appendChild(pane('prev', prev ? side(axis, prev) : ''));
  track.appendChild(cur);
  track.appendChild(pane('next', next ? side(axis, next) : ''));
  el.appendChild(track);
  $('#app').after(el);        // over the board, under #fx and any panel
  PG.el=el; PG.track=track;
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

function pagerMove(d){
  if(!PG) return;
  const size = PG.axis==='x' ? PG.w : PG.h;
  // nothing that way: the strip still gives, but only a third as much, which
  // is the whole of how a screen says "this is the end"
  const open = d>0 ? PG.prev : PG.next;
  let v = open ? d : d*0.32;
  v = clamp(v, -size, size);
  // smoothed, because one sample of a touch stream is mostly noise
  const now=performance.now(), dt=Math.max(1, now-PG.t);
  PG.vel = PG.vel*0.4 + ((v-PG.last)/dt)*0.6;
  PG.last=v; PG.t=now; PG.at=v;
  if(PG.track) PG.track.style.transform =
    PG.axis==='x' ? `translateX(${v}px)` : `translateY(${v}px)`;
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
  if(g.flat){ if(step) commit(g, step); return; }

  // it happens now; the strip is only finishing the sentence
  if(step) commit(g, step);
  const to = step ? -step*size : 0;
  g.track.style.transition='transform .26s cubic-bezier(.22,1,.3,1)';
  g.track.style.transform = g.axis==='x' ? `translateX(${to}px)` : `translateY(${to}px)`;
  setTimeout(()=>{ if(g.el) g.el.remove(); }, 280);
}
function commit(g, step){
  if(g.axis==='x') stepDrawer(step);
  // goPage() clamps and renders, so a page that has gone away between the
  // swipe starting and it ending simply lands on the nearest one
  else goPage(g.here, pageAt(g.here)+step);
}
function pagerCancel(){
  if(!PG) return;
  const g=PG; PG=null;
  if(g.el) g.el.remove();
}

export { still, tileOf, tileRect, openingFor, openTile, enter, pop,
  pagerBegin, pagerMove, pagerEnd, pagerCancel, pagerOn, stepDrawer };
