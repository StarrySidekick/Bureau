import { $, clamp, ROOT } from './util.js';
import { S, byId, isContainer, shapeOf, openingOf, dev, pinnedDrawers } from './model.js';
import { lay } from './grid.js';
import { objColour } from './look.js';
import { render, previewHTML, pageAt, pageCount, goPage } from './views.js';
import { save } from './persist.js';

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
   `auto` asks the object what it is. A container wide and deep enough to have
   doors gets doors; anything smaller is a drawer that pulls out. The threshold
   is per device because sizeOfKind() halves a container onto a phone — the
   same drawer has to clear the same bar on both grids, and 4×4 on the desk is
   2×2 there. Everything else is paper: the shapes that are drawn as a sheet
   curl up off the board, and the rest give a small lift to say they were hit. */
const CABINET_OVER = {desk:16, phone:4};
const PAPER = ['note','idea','verse','quote','index','page','chit'];
function openingFor(o){
  const how = openingOf(o);
  if(how!=='auto') return how;
  if(isContainer(o)){ const b=lay(o); return (b.w*b.h) > CABINET_OVER[dev()] ? 'cabinet' : 'drawer'; }
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
   20b · holographic — the desk reacts to how the phone is held
   ============================================================
   Magic drawers used to carry a band of light that travelled across them on a
   seven-second loop. It was the same sweep whatever you did, which after a
   week reads as a thing blinking at you rather than as a surface. A foil
   doesn't move on its own: it moves because *you* did.

   So two numbers, --holox and --holoy, live on #frame and mean "where the
   light is coming from", 0 to 1 in each direction. On a phone they come from
   how the phone is tilted; on a Mac, from where the pointer is. chrome.css
   does the rest — nothing else in the app knows this exists.

   The values are eased toward rather than written straight through: a
   deviceorientation stream is noisy enough that a foil driven raw off it
   twitches. */
const HOLO={x:.5, y:.5, tx:.5, ty:.5, raf:0};
function holoTo(x, y){
  HOLO.tx=clamp(x,0,1); HOLO.ty=clamp(y,0,1);
  if(!HOLO.raf) HOLO.raf=requestAnimationFrame(holoStep);
}
function holoStep(){
  HOLO.raf=0;
  HOLO.x += (HOLO.tx-HOLO.x)*0.16;
  HOLO.y += (HOLO.ty-HOLO.y)*0.16;
  const f=$('#frame'); if(!f) return;
  f.style.setProperty('--holox', HOLO.x.toFixed(3));
  f.style.setProperty('--holoy', HOLO.y.toFixed(3));
  if(Math.abs(HOLO.tx-HOLO.x)>0.002 || Math.abs(HOLO.ty-HOLO.y)>0.002)
    HOLO.raf=requestAnimationFrame(holoStep);
}

/* Beta is how far the phone is tilted away from you, and there is no such
   thing as a neutral value for it — everybody holds a phone at their own
   angle. So the first reading *is* neutral, and everything after it is
   measured from there. Gamma has a real zero (flat on its side either way),
   so it doesn't need one. */
const TILT={on:false, base:null};
function onTilt(e){
  if(e.gamma==null && e.beta==null) return;
  if(TILT.base==null) TILT.base=e.beta||0;
  const g=clamp((e.gamma||0)/38, -1, 1);
  const b=clamp(((e.beta||0)-TILT.base)/34, -1, 1);
  holoTo(.5+g*.5, .5+b*.5);
}
function listenTilt(){
  if(TILT.on) return;
  TILT.on=true; TILT.base=null;
  window.addEventListener('deviceorientation', onTilt);
}
function stopTilt(){
  if(!TILT.on) return;
  TILT.on=false; TILT.base=null;
  window.removeEventListener('deviceorientation', onTilt);
  holoTo(.5,.5);
}
const needsAsking = ()=> typeof DeviceOrientationEvent!=='undefined'
  && typeof DeviceOrientationEvent.requestPermission==='function';

/* The Settings button. iOS will only hand over the motion sensors from inside
   a real gesture, which is exactly what pressing a button is — and it is the
   reason this is a button at all rather than something that just happens. */
function askTilt(){
  if(TILT.on){ stopTilt(); S.look.tilt=false; save(); return 'off'; }
  if(typeof DeviceOrientationEvent==='undefined') return 'none';
  if(!needsAsking()){ S.look.tilt=true; save(); listenTilt(); return 'on'; }
  DeviceOrientationEvent.requestPermission().then(r=>{
    S.look.tilt = r==='granted';
    save();
    if(r==='granted') listenTilt();
  }).catch(()=>{});
  return 'asked';
}
const tiltOn = ()=> TILT.on;

/* Once granted, iOS answers requestPermission() again without a dialog — but
   only from a gesture, so the first press anywhere in the app is where a desk
   that had it last time picks it back up. Once, then never again. */
function armTilt(){
  const go=()=>{
    document.removeEventListener('pointerdown', go, true);
    if(S.look.tilt) askTilt();
  };
  document.addEventListener('pointerdown', go, true);
}
function startMotion(){
  // a mouse is a light source too — the same foil, lit from where you point
  $('#frame').addEventListener('pointermove', e=>{
    if(e.pointerType && e.pointerType!=='mouse') return;
    holoTo(e.clientX/Math.max(1,innerWidth), e.clientY/Math.max(1,innerHeight));
  }, {passive:true});
  if(typeof DeviceOrientationEvent==='undefined') return;
  if(!needsAsking()){ if(S.look.tilt!==false) listenTilt(); return; }
  if(S.look.tilt) armTilt();
}

/* ============================================================
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

/* The desk, then every pinned drawer in shelf order, as one loop. Somewhere
   you pinned is somewhere you go back to often; somewhere you didn't is not on
   this list, which is what keeps the loop short enough to be worth swiping. */
function drawerStops(){
  const pins=pinnedDrawers();
  return [null, ...pins.map(p=>p.id)];
}
function stepDrawer(d){
  const stops=drawerStops();
  if(stops.length<2) return false;
  const at2=stops.indexOf(S.view==='drawer' ? S.drawerId : null);
  const to=stops[((at2<0?0:at2)+d+stops.length) % stops.length];
  S.view = to ? 'drawer' : 'desk';
  S.drawerId = to;
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
    const i=Math.max(0, stops.indexOf(S.view==='drawer' ? S.drawerId : null));
    const to=d=>{ const id=stops[(i+d+stops.length)%stops.length];
                  return {view:id?'drawer':'desk', drawerId:id}; };
    prev=to(-1); next=to(1);
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
  startMotion, askTilt, tiltOn,
  pagerBegin, pagerMove, pagerEnd, pagerCancel, pagerOn, stepDrawer };
