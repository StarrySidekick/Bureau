import { $, clamp, ROOT } from './util.js';
import { S, byId, isContainer, shapeOf, openingOf, dev, deskIds, deskOf } from './model.js';
import { lay } from './grid.js';
import { objColour, styleNow } from './look.js';
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
// where a point sits inside a box, as a percentage — a transform origin
const pct = (v, size) => `${(v/Math.max(1,size)*100).toFixed(1)}%`;
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
/* **A drawer is somewhere you go, not something that comes to you.** `auto`
   used to answer `drawer` for anything that isn't standing — the front pulls
   out of the carcass and past you, which is a lovely piece of furniture and
   the wrong idea: what is behind it is another *desk*, not the inside of a
   box. So the camera goes in instead. A drawer inside a drawer inside a
   drawer then reads as what it is, which is the organising idea of the whole
   app arriving in the movement. `drawer` is still there to be picked; it is
   just no longer what nobody chose. See decision 103. */
function openingFor(o, box){
  const how = openingOf(o);
  if(how!=='auto') return how;
  if(isContainer(o)) return standing(box||lay(o)) ? 'cabinet' : 'dive';
  return PAPER.includes(shapeOf(o)) ? 'curl' : 'lift';
}

/* Opening something. `go` is the thing that actually happens — navigating into
   a drawer, opening a surface — and it is called straight away, every time,
   including when there is no animation to play at all. */
const OPEN_MS = {dive:460, drawer:420, cabinet:520, curl:520, lift:340};
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

  /* Going *in*. The front rushes up past the camera while the board you are
     arriving on grows out of the place the drawer was standing — so the
     movement has a direction and the direction is inward. The origin is the
     tile's own centre, which is what makes opening the drawer on the left
     feel different from opening the one on the right.

     No clone of the board you are leaving, which the obvious version of this
     wants: `.main.cloneNode(true)` is thirteen milliseconds to lay out and it
     would land on the frame that has to feel instant. The front expanding over
     the cut covers it instead. See decision 103. */
  const r=el.getBoundingClientRect();
  if(how==='dive'){
    /* The board you are leaving has to still be there, or the first fifth of
       a second is a blank page: `go()` replaces #app on the spot, and the
       board arriving is small and faded at that moment. So a still picture of
       it flies at the camera and past, and what grows out from behind it is
       where you were going.

       **Cloned before `go()`, inserted after it.** `cloneNode` is a DOM copy
       and costs almost nothing; what costs is laying a second whole board out,
       and that must not land on the frame the tap has to feel instant on.
       Same split the pager makes for the same reason. */
    const m=$('#app .main');
    const twin = m ? m.cloneNode(true) : null;
    const mr = m && m.getBoundingClientRect();

    const ghost=document.createElement('div');
    ghost.className='fxopen fx-dive';
    at(ghost, r);
    ghost.style.setProperty('--c', objColour(o));
    ghost.innerHTML=`<i class="fxcave"></i><div class="fxfront"></div>`;
    ghost.querySelector('.fxfront').appendChild(faceOf(el));

    go();

    if(twin){
      /* A picture of a board, not a second board. Ids go for the reason
         `faceOf()` takes them off a flying front, and so does everything a
         tile is *found* by — `tileOf()` scopes itself to `#app` and this is in
         `#fx`, but the drag's own lookups do not, and a second element
         answering to a real object's id is decision 51's bug waiting to
         happen. */
      twin.removeAttribute('id');
      twin.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
      twin.querySelectorAll('[data-drawer],[data-row],[data-id],[data-check],[data-edit]')
        .forEach(n=>{ n.removeAttribute('data-drawer'); n.removeAttribute('data-row');
          n.removeAttribute('data-id'); n.removeAttribute('data-check');
          n.removeAttribute('data-edit'); });
      twin.setAttribute('aria-hidden','true');
      twin.className='fxleave';
      at(twin, mr);
      twin.style.setProperty('--divex', pct(r.left+r.width/2 - mr.left, mr.width));
      twin.style.setProperty('--divey', pct(r.top+r.height/2 - mr.top, mr.height));
      fx().appendChild(twin);
      setTimeout(()=>twin.remove(), OPEN_MS.dive);
    }
    fx().appendChild(ghost);
    enter('dive', r);
    setTimeout(()=>ghost.remove(), OPEN_MS.dive);
    return;
  }
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
function enter(kind, from){
  const m=$('#app .main');
  if(!m || still()) return;
  /* Where the movement comes from. A dive grows out of the tile you touched,
     so the transform origin is that tile's centre in the arriving board's own
     coordinates — the one number that makes this a movement *through
     something* rather than a box getting bigger. */
  if(from){
    const b=m.getBoundingClientRect();
    m.style.setProperty('--divex', pct(from.left+from.width/2 - b.left, b.width));
    m.style.setProperty('--divey', pct(from.top+from.height/2 - b.top, b.height));
  }
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
   20a · the spray — physics, not a keyframe
   ============================================================
   Things shoot out of a tile when you touch it: stars, rings, spirals, little
   bars of confetti, thrown outward and then pulled down. Every other movement
   in this file is a CSS keyframe, and this one cannot be — a keyframe is a
   path decided in advance, and the whole point here is that each bit has its
   own velocity, its own spin and its own arc, so twenty of them never repeat.
   So it is real integration: a force, a step, a draw.

   **One canvas, not thirty elements.** A spiral has no CSS, and thirty nodes
   entering and leaving the DOM twice a second is thirty style recalculations
   against a board that may hold three thousand tiles. The canvas is made on
   the first burst, lives in #fx like every other overlay, and takes itself
   down when the last bit dies — so a desk nobody is touching is a desk with
   no canvas on it and no frame loop running.

   The colours are the **object's own** and the style's, never a palette of
   its own: a burst off a claret drawer is claret and leaf on Victoria, and
   pine and green shimmer on Starry. Same rule as everything else that draws
   — go through objColour(), and read the chrome from the root. See
   decision 85. */
const SPRAY = { el:null, ctx:null, bits:[], raf:0, t:0, at:0, line:'' };

/* **Which shape comes out**, which is the only question worth asking: how many
   and how big always move together with it, so each preset carries its own
   count and scale rather than making you set three things to get one look.
   Stars by default — the friendliest of them, and the one this was for.

   An unknown value falls back to stars rather than leaving a desk that throws
   nothing, which also carries a preference written by an older version. */
const SPRAYS = {
  off:      ['Nothing',   0,  0,   []],
  stars:    ['Stars',     14, 1.1, ['star']],
  twinkles: ['Sparkles',  16, 1,   ['twinkle']],
  spirals:  ['Spirals',   12, 1.2, ['spiral']],
  squares:  ['Squares',   16, .95, ['square']],
  hearts:   ['Hearts',    12, 1.1, ['heart']],
  confetti: ['Confetti',  22, 1,   ['bar','bar','square']],
  mixed:    ['A mix',      18, 1,
             ['star','twinkle','spiral','square','heart','ring','bar','circle']]
};
/* **What comes out is the aesthetic's suggestion until you say otherwise.**
   Girando's whole motif is a spiral and the burst already draws one; Golf 97
   should throw squares and Stelaine sparkles. So an aesthetic names a shape,
   and an unset preference takes it — which also means a desk that has never
   been told changes its burst when you change aesthetic, the way its colours
   and its wood do. Choosing one in Settings pins it across all of them, and
   "Follows the aesthetic" is how you hand it back. An unknown name still falls
   to stars rather than to a desk that throws nothing. See decision 92. */
const sprayNow = ()=> SPRAYS[S.look.spray] ? S.look.spray
  : (SPRAYS[styleNow().spray] ? styleNow().spray : 'stars');

const GRAVITY = 1500;      // px/s² — heavy enough to arc inside half a second
const DRAG    = 2.1;       // air, per second: the sideways throw dies first
const LIFE    = [.55,.95]; // seconds

/* ---- the shapes, each drawn at the origin so the caller owns the maths --- */
/* Round the corners of a polygon given as a flat list of points: cut each
   vertex back by `d` along both its edges and curve through where the corner
   was. Canvas's `lineJoin:'round'` only rounds a *stroke*, so a filled star
   with sharp points needs the rounding built into the path itself. */
function roundPoly(ctx, pts, d){
  const n=pts.length;
  for(let i=0;i<n;i++){
    const p=pts[i], a=pts[(i+n-1)%n], b=pts[(i+1)%n];
    const cut=(q)=>{ const dx=q[0]-p[0], dy=q[1]-p[1];
      const L=Math.hypot(dx,dy)||1, k=Math.min(d, L/2)/L;
      return [p[0]+dx*k, p[1]+dy*k]; };
    const from=cut(a), to=cut(b);
    i ? ctx.lineTo(from[0],from[1]) : ctx.moveTo(from[0],from[1]);
    ctx.quadraticCurveTo(p[0], p[1], to[0], to[1]);
  }
  ctx.closePath();
}
/* A star wears an outline, which is what makes it read as a drawn thing rather
   than a coloured blob — `line` is the style's own ink, passed in rather than
   taken from `strokeStyle`, because two of the shapes stroke themselves in
   their own colour and the sample in Settings uses the same path. */
function outline(ctx, line, w){
  if(!line) return;
  const prev=ctx.strokeStyle;
  ctx.strokeStyle=line; ctx.lineWidth=w; ctx.lineJoin='round';
  ctx.stroke();
  ctx.strokeStyle=prev;
}
function bitPath(ctx, kind, r, line){
  ctx.beginPath();
  if(kind==='circle'){ ctx.arc(0,0,r,0,6.284); ctx.fill(); return; }
  if(kind==='ring'){ ctx.lineWidth=Math.max(1,r*.34); ctx.arc(0,0,r*.8,0,6.284); ctx.stroke(); return; }
  if(kind==='bar'){ ctx.fillRect(-r,-r*.42,r*2,r*.84); return; }
  if(kind==='square'){
    const d=r*1.5;
    if(ctx.roundRect){ ctx.roundRect(-d/2,-d/2,d,d,r*.3); ctx.fill(); }
    else ctx.fillRect(-d/2,-d/2,d,d);
    return;
  }
  if(kind==='twinkle'){
    /* A four-pointed sparkle: the sides curve *in* towards the middle, which
       is the whole difference between a sparkle and a plus sign. The waist is
       .18 rather than .13 — a fatter sparkle takes an outline without the two
       sides of a point closing up into a single line. */
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2, b=a+Math.PI/2;
      const x=Math.cos(a)*r, y=Math.sin(a)*r;
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
      ctx.quadraticCurveTo(Math.cos(a+Math.PI/4)*r*.18, Math.sin(a+Math.PI/4)*r*.18,
                           Math.cos(b)*r, Math.sin(b)*r);
    }
    ctx.closePath(); ctx.fill(); outline(ctx, line, Math.max(1, r*.15)); return;
  }
  if(kind==='heart'){
    const d=r*.95;
    ctx.moveTo(0, d*.78);
    ctx.bezierCurveTo(-d*1.5,-d*.35, -d*.52,-d*1.15, 0,-d*.32);
    ctx.bezierCurveTo( d*.52,-d*1.15,  d*1.5,-d*.35, 0, d*.78);
    ctx.closePath(); ctx.fill(); return;
  }
  if(kind==='triangle'){
    ctx.moveTo(0,-r); ctx.lineTo(r*.9,r*.7); ctx.lineTo(-r*.9,r*.7);
    ctx.closePath(); ctx.fill(); return;
  }
  if(kind==='spiral'){
    // an archimedean curl, a turn and a half — the one shape CSS cannot draw
    ctx.lineWidth=Math.max(1,r*.28); ctx.lineCap='round';
    for(let a=0;a<9.4;a+=.3){ const rr=r*(a/9.4);
      const x=Math.cos(a)*rr, y=Math.sin(a)*rr;
      a ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }
    ctx.stroke(); return;
  }
  /* A five-pointed star, the default. The inner radius is .54 rather than the
     .38 a "correct" pentagram uses: fatter points read as friendly, and thin
     ones read as a compass rose. And the corners are *rounded* — every one of
     the ten, so the points are blunt and the valleys between them are soft,
     which is the difference between a sticker and a sheriff's badge. The cut
     is a fraction of the radius, so it is the same star at any size. */
  const pts=[];
  for(let i=0;i<10;i++){
    const a=(i*Math.PI)/5 - Math.PI/2, rr=i%2 ? r*.54 : r;
    pts.push([Math.cos(a)*rr, Math.sin(a)*rr]);
  }
  roundPoly(ctx, pts, r*.26);
  ctx.fill();
  outline(ctx, line, Math.max(1, r*.15));
}

function sprayCanvas(){
  if(SPRAY.el && SPRAY.el.isConnected) return SPRAY.el;
  const host=fx(); if(!host) return null;
  const c=document.createElement('canvas');
  c.className='fxspray';
  host.appendChild(c);
  SPRAY.el=c; SPRAY.ctx=c.getContext('2d');
  return c;
}
function endSpray(){
  cancelAnimationFrame(SPRAY.raf); SPRAY.raf=0; SPRAY.bits.length=0;
  if(SPRAY.el){ SPRAY.el.remove(); SPRAY.el=null; SPRAY.ctx=null; }
}
function sprayFrame(now){
  const dt=Math.min(.05, (now - SPRAY.t)/1000 || .016);
  SPRAY.t=now;
  const c=SPRAY.el, ctx=SPRAY.ctx;
  if(!c || !ctx) return endSpray();
  ctx.clearRect(0,0,c.width,c.height);
  const dpr=c.__dpr||1;
  for(let i=SPRAY.bits.length-1;i>=0;i--){
    const b=SPRAY.bits[i];
    b.age+=dt;
    if(b.age>=b.life){ SPRAY.bits.splice(i,1); continue; }
    const d=Math.exp(-DRAG*dt);
    b.vx*=d; b.vy=(b.vy*d)+GRAVITY*dt;
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.rot+=b.vr*dt;
    // it thins out at the end rather than blinking off
    const k=b.age/b.life, fade=k<.7 ? 1 : 1-(k-.7)/.3;
    ctx.save();
    ctx.globalAlpha=fade;
    ctx.translate(b.x*dpr, b.y*dpr);
    ctx.rotate(b.rot);
    ctx.fillStyle=b.c; ctx.strokeStyle=b.c;
    bitPath(ctx, b.kind, b.r*dpr, SPRAY.line);
    ctx.restore();
  }
  if(SPRAY.bits.length) SPRAY.raf=requestAnimationFrame(sprayFrame);
  else endSpray();
}

/* Throw a handful of things out of a point. `id` is only for the colour — the
   burst belongs to wherever it was aimed, not to a tile it has to keep up
   with, so nothing here holds a reference to an element that render() is
   about to replace. */
function spray(x, y, id, force){
  if(still()) return;
  const flavour=sprayNow();
  const [,n,scale,kinds]=SPRAYS[flavour];
  if(!n) return;
  /* Two calls in the same instant are one event wearing two hats — a tap that
     ticks a box goes through both tileTap() and pop(). The second is dropped
     rather than doubling the burst. */
  const now=performance.now();
  if(now - SPRAY.at < 120) return;
  SPRAY.at=now;
  const c=sprayCanvas(); if(!c) return;
  const f=frameRect(), dpr=Math.min(2, window.devicePixelRatio||1);
  if(c.width!==Math.round(f.width*dpr) || c.height!==Math.round(f.height*dpr)){
    c.width=Math.round(f.width*dpr); c.height=Math.round(f.height*dpr);
    c.style.width=f.width+'px'; c.style.height=f.height+'px';
  }
  c.__dpr=dpr;
  const o=id && byId(id);
  const root=getComputedStyle(document.documentElement);
  const pick=[ o ? objColour(o) : root.getPropertyValue('--brass'),
               root.getPropertyValue('--glow'),
               root.getPropertyValue('--brass') ].map(s=>String(s).trim()).filter(Boolean);
  /* The line a star is drawn with is the style's own ink, so it is dark on
     paper and light on a dark style without either being named here — the same
     rule the rest of the app follows. Read once per burst rather than per bit;
     a burst is over long before a style could change under it. */
  SPRAY.line=String(root.getPropertyValue('--ink')||'').trim();
  const px=x-f.left, py=y-f.top;
  const count=Math.round(n*(force||1));
  for(let i=0;i<count;i++){
    /* Outward, and biased upward: things thrown off a desk go up before they
       come down, and a burst that is even in every direction reads as an
       explosion rather than a handful of something. */
    const a=Math.random()*6.284;
    const speed=140+Math.random()*260;
    SPRAY.bits.push({
      x:px, y:py,
      vx:Math.cos(a)*speed,
      vy:Math.sin(a)*speed - (120+Math.random()*180),
      rot:Math.random()*6.284, vr:(Math.random()-.5)*14,
      r:(3+Math.random()*4.5)*scale,
      kind:kinds[(Math.random()*kinds.length)|0],
      c:pick[(Math.random()*pick.length)|0],
      age:0, life:LIFE[0]+Math.random()*(LIFE[1]-LIFE[0])
    });
  }
  if(!SPRAY.raf){ SPRAY.t=performance.now(); SPRAY.raf=requestAnimationFrame(sprayFrame); }
}
/* The middle of whatever is standing for an object, for a caller that has an
   id and no pointer — the keyboard, or a tile that has just landed. */
function sprayAt(id, force){
  const el=tileOf(id); if(!el) return;
  const r=el.getBoundingClientRect();
  spray(r.left+r.width/2, r.top+r.height/2, id, force);
}
const sprayCount = ()=> SPRAY.bits.length;

/* One option, drawn as the thing it throws — the type picker's rule (a type is
   drawn as the thing it makes) applied to a shape. It goes through the same
   bitPath() the burst does, on a throwaway canvas, so a sample in Settings
   cannot drift from what you actually get. Cached: the settings panel redraws
   on every keystroke in it. */
const MARKS = {};
function sprayMark(kind, colour, px, line){
  const key=kind+'|'+colour+'|'+(px||22)+'|'+(line||'');
  if(MARKS[key]) return MARKS[key];
  const d=px||22, dpr=2;
  const c=document.createElement('canvas');
  c.width=c.height=d*dpr;
  const x=c.getContext('2d');
  x.translate(d*dpr/2, d*dpr/2);
  x.fillStyle=colour; x.strokeStyle=colour;
  /* The outline goes into the sample too — a sample that leaves it out is a
     picture of a different star from the one you get. It is inset a little so
     the stroke isn't clipped by the edge of a 20px canvas. */
  bitPath(x, kind, d*dpr*.40, line);
  return (MARKS[key]=c.toDataURL());
}

/* ---- a checklist face refilling itself --------------------------------
   Ticking a line takes it off the front — the render this runs after already
   has — and the lines that were under it move up a row, so the next thing
   waiting inside the drawer slides in over the bottom edge. State first,
   movement after, like everything in here: the lines start displaced down by
   one of their own heights and settle to where the render actually put them,
   and the clip on .clist is what makes the last one arrive "out of" the
   drawer. `idx` is the ticked line's place among the undone children, taken
   before the tick; everything at that index and after is a mover. */
function clRefill(cid, idx){
  if(still()) return;
  const tile=document.querySelector(`#app .grid .drawer[data-drawer="${cid}"]`);
  if(!tile) return;
  const move=[...tile.querySelectorAll('.cline')].slice(Math.max(0, idx));
  if(!move.length) return;
  const h=move[0].getBoundingClientRect().height;
  if(!h) return;
  move.forEach(el=>{ el.style.transition='none'; el.style.transform=`translateY(${h}px)`; });
  void tile.offsetWidth;   // commit the start positions before they move
  move.forEach(el=>{ el.style.transition='transform .3s cubic-bezier(.2,.8,.3,1)'; el.style.transform=''; });
  setTimeout(()=>move.forEach(el=>{ el.style.transition=''; }), 340);
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

export { still, tileOf, tileRect, openingFor, openTile, enter, pop, clRefill,
  spray, sprayAt, sprayCount, SPRAYS, sprayNow, sprayMark,
  pagerBegin, pagerMove, pagerEnd, pagerCancel, pagerOn, stepDrawer };
