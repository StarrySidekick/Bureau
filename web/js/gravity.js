import { $, clamp, ROOT } from './util.js';
import { S, dev, gravityMode, gravityOn, gravityTilts } from './model.js';
import { gridOf, drawCols, drawRows, shelfAt } from './grid.js';
import { still, tiltDown, applyTilt } from './motion.js';

/* ============================================================
   30 · the board lets go
   ============================================================
   A switch, and everything on the shelf you are looking at stops being on the
   grid and falls into a heap at the bottom of it. It is an experiment and it
   is meant to be one — but it is a real solver rather than a keyframe, because
   the interesting half is what a pile *does*: what it does when you throw
   another drawer into it, and what it does when you turn the phone over.

   **Nothing here touches the model.** A box stays exactly where it was; a body's
   *home* is the rectangle its tile was drawn in, and the whole of the fall is a
   `transform` written over the top of a board that has not moved. So switching
   it off is the arrangement you had, to the pixel — not a tidy-up you then have
   to undo, which is the one thing that would make this unsafe to play with. It
   is the same bargain the pinboard's tilt strikes (decision 75) with a great
   deal more going on.

   **Two answers, one solver, and they differ in a single number.** `sand` sets
   every body's inverse rotational inertia to zero: a box cannot turn, so it
   stays square to the board, falls straight down and sits on whatever is under
   it — Minecraft's sand, and the thing that was asked for first. `tumble`
   gives it real inertia, so it lands on a corner, leans, and a pile finds its
   own angle. Writing the second as a variation of the first is what makes it
   cheap; writing them as two systems would have been two things to keep in
   step. See decision 166.

   **A transform on a promoted layer and nothing else.** That is the whole
   performance argument, and it is the one this app has already made twice — for
   the flank (decision 117) and for the six face cues (decision 118). Forty
   tiles moving every frame is forty composited layers and zero layouts; the
   same forty moved by `left`/`top` would be forty layouts a frame. The one
   layout this costs is the *measurement*, once per render, and only while the
   switch is on.                                                              */

/* ---- the numbers ------------------------------------------------------
   Found by looking, like everything else in motion.js. Gravity is in pixels
   because the board is: a cell is about fifty of them, so 2200 px/s² drops a
   tile the height of a phone board in a bit under a second, which reads as
   heavy furniture rather than as a screensaver. Real gravity at this scale
   would be four times that and everything would land before you saw it fall. */
const GRAV = 2200;          // px/s², the pull
const STEP = 1/120;         // the solver's own clock, fixed
const MAXSTEP = 5;          // …and how far behind one frame may let it get
const ITERS = 10;           // velocity iterations per step
const BIAS = 0.18;          // how hard overlap is pushed apart
const SLOP = 0.4;           // …and how much overlap is allowed to stand
const MAXBIAS = 240;        // px/s, so a deep overlap cannot fire a body away
const MAXV = 3200;          // px/s, the speed cap that keeps a blow-up finite
const MAXW = 24;            // rad/s, the same for spin
const LINDAMP = 0.35, ANGDAMP = 1.1;
/* Sand is dead and grippy; a tumbling pile has a little life in it. Nothing
   else separates the two modes. */
const MODE = {
  sand:   {e:0,    mu:0.95, spin:false},
  tumble: {e:0.15, mu:0.5,  spin:true}
};
const REST_MIN = 90;        // px/s below which a bounce is not worth having
const WALL = 600;           // how thick the four walls are — nothing tunnels
/* Quiet for this long and the whole board is asleep and the loop parks. It is
   a **global** sleep rather than a per-body one on purpose: a body that sleeps
   on its own has to be woken by its neighbours, which is a graph problem, and
   a board is forty tiles and settles in a second. */
const SLEEP_V = 9, SLEEP_W = 0.09, SLEEP_T = 0.5;
/* How fast the pull follows the phone. Fast enough that a flick of the wrist
   is answered and slow enough that sensor noise is not; framerate-free, so it
   is the same movement at 60 and at 120. */
const TILT_EASE = 0.001;
const SETTLE_MS = 420;      // how long the tiles take to walk back to their cells

const W = {
  mode:'off', key:'', grid:null, cid:null,
  bodies:[], by:new Map(), walls:[], sweep:[],
  cell:0, w:0, h:0, y0:0,       // the pen, in the grid's own pixels
  gx:0, gy:1, dx:0, dy:1,       // where down is, and the reading it is eased from
  raf:0, last:0, acc:0, quiet:0, gen:0,
  grab:null
};

/* ---- a body ------------------------------------------------------------
   Everything is a box, walls included, so there is one collision routine and
   not two. A wall is a box with no mass: `im`/`ii` are the *inverse* mass and
   inverse rotational inertia, which is what makes "infinitely heavy" a zero
   rather than a special case everywhere it is used. */
function body(el, id, x, y, hw, hh){
  return weigh({el, id, hw, hh, hx:x, hy:y,
                x, y, a:0, vx:0, vy:0, w:0, im:0, i0:0, ii:0, t:''});
}
// mass and rotational inertia from the box, both stored inverted. Re-asked
// whenever a body's rectangle changes, so a tile that was resized under the
// heap does not go on weighing what it used to.
function weigh(b){
  const m = (b.hw*2)*(b.hh*2)/2500;             // a 50px square weighs one
  b.im = 1/m;
  b.i0 = 12/(m*((b.hw*2)**2 + (b.hh*2)**2));
  return b;
}
function wall(x, y, hw, hh){
  return {el:null, id:null, hw, hh, hx:x, hy:y, x, y, a:0,
          vx:0, vy:0, w:0, im:0, i0:0, ii:0, fixed:true};
}
/* Which of the two modes a body is in, said as the one number that differs. */
function spins(b){ return MODE[W.mode] && MODE[W.mode].spin ? b.i0 : 0; }
/* ---- the nudge --------------------------------------------------------
   A grid is a perfect thing and a heap is not, and letting go of a perfect
   grid straight down produces a perfect heap: every drawer lands square on the
   one below it and a tumbling board is indistinguishable from a sand one. That
   is correct physics of an impossibly precise release, and it is the wrong
   picture — a shelf tipped out does not land flat.

   So a body starts a degree or two off true, with a little spin, and both come
   from a **hash of its own id** rather than from `Math.random()` — the pinboard's
   trick (decision 75), for the pinboard's reason: it is the same lean every
   time, so a board that has fallen and been put back falls the same way again.
   Sand gets none of it: sand cannot turn, and a nudge it cannot answer is a
   sideways shove nobody asked for. */
function nudge(b){
  let h=0;
  for(let i=0;i<b.id.length;i++) h=(h*31 + b.id.charCodeAt(i)) >>> 0;
  b.a = ((h % 51) - 25) / 500;              // ±0.05 rad, about three degrees
  b.w = (((h>>>5) % 41) - 20) / 45;         // …and half a radian a second of turn
  /* …and a shove sideways, which is what actually makes a heap a heap: a box
     that lands square on the one below it stands back up however hard it was
     spinning, so without this a tumbling board settles into the same flat
     columns a sand one does. Forty-five pixels a second is a hand tipping a
     shelf, not a throw — and the spin above is half a radian a second, which
     over the length of a fall is a lean and not a somersault. */
  b.vx = (((h>>>11) % 61) - 30) * 1.5;
}

/* ---- reading the board -------------------------------------------------
   Measured rather than derived, and the reason is the pinboard: a pinned tile
   carries a three-pixel margin, so its rectangle is not its cell and a body
   worked out from `grid-column` would be six pixels too big in each direction.
   One `getBoundingClientRect` per tile per render is a layout, which is why
   every transform is cleared **first**: clear all, read all, write all is two
   passes and one layout, where clearing and reading one at a time would be one
   layout per tile. */
function measure(){
  const grid = $('#drawergrid');
  if(!grid) return null;
  const els = [...grid.querySelectorAll(':scope > .drawer')];
  els.forEach(el=>{ el.style.transform=''; });
  const gr = grid.getBoundingClientRect();
  return {grid, els, gr, rects: els.map(el=>el.getBoundingClientRect())};
}
const idOf = el => el.dataset.drawer || el.dataset.row || el.dataset.id || '';

/* Which board, on which shelf, at what size — the key that says whether the
   pile you have is still about the thing you are looking at. Walking to
   another shelf is arriving somewhere else, so the heap stays behind. */
function keyNow(){
  const cid = (S.view==='drawer' && S.drawerId) || ROOT;
  const at = shelfAt(cid);
  return `${W.mode}|${dev()}|${cid}|${at.x},${at.y}`;
}

/* ---- the pen ------------------------------------------------------------
   **A shelf, and only a shelf.** A phone is already windowed to one — the board
   element is one shelf tall and the tiles have had the shift taken off them as
   they were drawn — so the pen is the whole of it. A **Mac** draws the entire
   board and scrolls, so the pen is the shelf-row you have scrolled to: full
   width, because the three shelves of a row are all on the screen at once, and
   one row deep, because the two rows you cannot see are not what let go.

   Without this the floor was the bottom of the ninth shelf and flipping the
   switch on a Mac tipped the whole desk into a heap two screens below the one
   you were looking at, which reads exactly like everything vanishing. */
function pen(g){
  const rows = g.shelfH * g.rowh;
  const top = dev()==='phone' ? 0 : shelfAt(W.cid).y * rows;
  return {w: drawCols(g)*g.rowh, h: rows, y0: top};
}
/* The board is the back panel of a slot and the slot has four sides, which is
   the same shape decision 116 gave the cavity — so a thrown drawer comes back
   rather than leaving by the top. They are boxes like everything else, six
   hundred pixels thick, because a wall you can travel through in one step is
   not a wall. */
function walls(w, h, y0){
  const T = WALL/2, mid = y0 + h/2;
  return [wall(w/2, y0+h+T, w/2+WALL, T),   // the floor
          wall(w/2, y0-T,   w/2+WALL, T),   // …and the lid
          wall(-T,  mid, T, h/2+WALL),
          wall(w+T, mid, T, h/2+WALL)];
}

/* ---- binding the pile to what is on the screen -------------------------
   Called at the end of every render, because `render()` replaces `#app`
   wholesale and the elements a body was moving are detached a moment later.
   A body is kept by **id**: the tile is new, the pile is not, so a render in
   the middle of a fall is invisible. */
function sync(){
  const mode = gravityMode();
  if(mode==='off' || S.device==null){ if(W.mode!=='off') clear(); W.mode='off'; return; }
  W.mode = mode;
  const m = measure();
  if(!m){ clear(); return; }
  const key = keyNow();
  if(key !== W.key){ W.key = key; W.by.clear(); W.bodies=[]; }
  W.cid = m.grid.dataset.gridfor || ROOT;
  const g = gridOf(dev(), W.cid);
  W.grid = m.grid;
  W.cell = g.rowh;
  const p = pen(g);
  W.w = p.w; W.h = p.h; W.y0 = p.y0;
  W.walls = walls(W.w, W.h, W.y0);

  const seen = new Set();
  m.els.forEach((el, i)=>{
    const id = idOf(el); if(!id) return;
    const r = m.rects[i];
    const hw = Math.max(2, r.width/2), hh = Math.max(2, r.height/2);
    const hx = r.left - m.gr.left + hw, hy = r.top - m.gr.top + hh;
    // on a Mac the other two shelf-rows are drawn as well, and they stay on
    // the grid: what let go is the shelf you are looking at
    if(hy < W.y0 || hy > W.y0 + W.h) return;
    seen.add(id);
    const had = W.by.get(id);
    if(had){
      /* It was already falling. Keep where it has got to and take the new
         element and the new home — the board may have been re-measured under
         it, and a body whose home has drifted from its tile would draw the
         pile a few pixels out of true. */
      had.el = el; had.t = '';
      had.hx = hx; had.hy = hy;
      if(had.hw !== hw || had.hh !== hh){ had.hw = hw; had.hh = hh; weigh(had); }
      return;
    }
    const b = body(el, id, hx, hy, hw, hh);
    if(MODE[W.mode] && MODE[W.mode].spin) nudge(b);
    W.by.set(id, b); W.bodies.push(b);
  });
  // …and anything whose tile has gone is no longer part of the pile
  if(seen.size !== W.bodies.length){
    W.bodies = W.bodies.filter(b=>{ if(seen.has(b.id)) return true; W.by.delete(b.id); return false; });
  }
  W.bodies.forEach(b=>{ b.ii = spins(b); });
  m.grid.classList.add('falling');
  write();
  wake();
}

/* ---- which way is down -------------------------------------------------
   Straight down the board, unless the phone has been asked — and then it is
   **where down actually is**, the whole circle of it, taken from the sensor
   rather than from the shelf's lean. `tiltDown()` in motion.js is the
   measurement and the note there is why; what matters here is that it is
   absolute rather than relative, has no rest to drift back to, and is not
   clamped to a throw. Roll the phone and the heap runs to the low edge; turn it
   over and it falls to the top of the screen; lay it flat and nothing moves,
   because a tray held level is not tipping anything anywhere.

   Its **length** is kept, not just its direction. A phone at forty-five degrees
   has seven tenths of a g in the plane of the glass and the heap should pour at
   seven tenths, which is the difference between a shelf you are tipping and a
   switch you have thrown. See decision 166b. */
function pull(dt){
  if(!gravityTilts()) return set(0, 1);
  const d = tiltDown();
  const k = 1 - Math.pow(TILT_EASE, dt);
  W.dx += (d.x - W.dx)*k;
  W.dy += (d.y - W.dy)*k;
  return set(W.dx, W.dy);
}
// No normalising: the length is the pull. A flat phone is a zero here and the
// pile stays exactly where it is, which is the answer rather than a gap in it.
function set(x, y){
  if(!isFinite(x) || !isFinite(y)){ x = 0; y = 1; }
  const turned = Math.abs(x-W.gx) + Math.abs(y-W.gy) > 0.004;
  W.gx = x; W.gy = y;
  return turned;
}

/* ---- one box, as four corners and four outward faces -------------------- */
function axes(b){
  const c=Math.cos(b.a), s=Math.sin(b.a);
  return [c, s, -s, c, -c, -s, s, -c];        // +u, +v, −u, −v, in pairs
}
function support(b, dx, dy){
  const c=Math.cos(b.a), s=Math.sin(b.a);
  const ux = (c*dx + s*dy) >= 0 ? b.hw : -b.hw;
  const vy = (-s*dx + c*dy) >= 0 ? b.hh : -b.hh;
  return {x: b.x + c*ux - s*vy, y: b.y + s*ux + c*vy};
}
/* How far B is from A along A's own faces — the largest is the axis A is least
   overlapped on, and a positive answer anywhere is two boxes that miss. */
function faceSep(a, b){
  const ax = axes(a), ex = [a.hw, a.hh, a.hw, a.hh];
  let best = -Infinity, idx = 0;
  for(let i=0;i<4;i++){
    const nx = ax[i*2], ny = ax[i*2+1];
    const p = support(b, -nx, -ny);
    const s = nx*(p.x-a.x) + ny*(p.y-a.y) - ex[i];
    if(s > best){ best = s; idx = i; }
  }
  return {sep:best, idx};
}
/* The two corners of a body's face i, in order. */
function faceOf(b, i){
  const ax = axes(b), ex = [b.hw, b.hh, b.hw, b.hh];
  const nx = ax[i*2], ny = ax[i*2+1];
  const tx = -ny, ty = nx;                    // along the face
  const half = i%2 ? b.hw : b.hh;             // …and how long half of it is
  const cx = b.x + nx*ex[i], cy = b.y + ny*ex[i];
  return [{x:cx - tx*half, y:cy - ty*half}, {x:cx + tx*half, y:cy + ty*half},
          nx, ny, tx, ty];
}
// keep the part of a segment on the near side of a plane
function clipSeg(p, q, nx, ny, o){
  const d1 = nx*p.x + ny*p.y - o, d2 = nx*q.x + ny*q.y - o;
  const out = [];
  if(d1 <= 0) out.push(p);
  if(d2 <= 0) out.push(q);
  if(d1*d2 < 0){
    const t = d1/(d1-d2);
    out.push({x:p.x + (q.x-p.x)*t, y:p.y + (q.y-p.y)*t});
  }
  return out;
}
/* The manifold for one pair: up to two points, and a normal that always runs
   from A towards B so the solver never has to ask which way round it is. */
function collide(a, b, e){
  const sa = faceSep(a, b); if(sa.sep > 0) return null;
  const sb = faceSep(b, a); if(sb.sep > 0) return null;
  let ref = a, inc = b, idx = sa.idx, flip = false;
  if(sb.sep > sa.sep + 0.02){ ref = b; inc = a; idx = sb.idx; flip = true; }
  const [r1, r2, nx, ny, tx, ty] = faceOf(ref, idx);
  // the face of the other body most turned away from this one
  const ia = axes(inc);
  let bi = 0, bd = Infinity;
  for(let i=0;i<4;i++){
    const d = ia[i*2]*nx + ia[i*2+1]*ny;
    if(d < bd){ bd = d; bi = i; }
  }
  const [i1, i2] = faceOf(inc, bi);
  let pts = clipSeg(i1, i2, -tx, -ty, -(tx*r1.x + ty*r1.y));
  if(pts.length < 2) return null;
  pts = clipSeg(pts[0], pts[1], tx, ty, tx*r2.x + ty*r2.y);
  if(!pts.length) return null;
  const o = nx*r1.x + ny*r1.y;
  const out = [];
  for(const p of pts){
    const d = nx*p.x + ny*p.y - o;
    if(d > 0) continue;
    out.push({x:p.x, y:p.y, pen:-d, pn:0, pt:0, rest:0});
  }
  if(!out.length) return null;
  const n = flip ? {x:-nx, y:-ny} : {x:nx, y:ny};
  const A = flip ? inc : ref, B = flip ? ref : inc;
  // the bounce, taken from how fast they were coming together before anything
  // was solved — worked out once, or ten iterations would each add their own
  for(const p of out){
    const rax=p.x-A.x, ray=p.y-A.y, rbx=p.x-B.x, rby=p.y-B.y;
    const rvx = (B.vx - B.w*rby) - (A.vx - A.w*ray);
    const rvy = (B.vy + B.w*rbx) - (A.vy + A.w*rax);
    const vn = rvx*n.x + rvy*n.y;
    p.rest = vn < -REST_MIN ? -e*vn : 0;
  }
  return {a:A, b:B, n, pts:out};
}

/* ---- the solver --------------------------------------------------------
   Sequential impulses: walk every contact ten times, each pass pushing the two
   bodies apart just enough that they are no longer approaching, then the same
   again sideways for friction, clamped by Coulomb against the normal impulse
   this pass has actually built up. The accumulated impulse is clamped rather
   than each increment, which is what lets a stack of five settle instead of
   shivering. */
function solve(cs, dt, mu){
  for(let it=0; it<ITERS; it++){
    for(const c of cs){
      const {a, b, n} = c;
      for(const p of c.pts){
        const rax=p.x-a.x, ray=p.y-a.y, rbx=p.x-b.x, rby=p.y-b.y;
        const rvx = (b.vx - b.w*rby) - (a.vx - a.w*ray);
        const rvy = (b.vy + b.w*rbx) - (a.vy + a.w*rax);
        const vn = rvx*n.x + rvy*n.y;
        const rnA = rax*n.y - ray*n.x, rnB = rbx*n.y - rby*n.x;
        const kn = a.im + b.im + a.ii*rnA*rnA + b.ii*rnB*rnB;
        if(kn <= 0) continue;
        const bias = Math.min(MAXBIAS, BIAS/dt * Math.max(0, p.pen - SLOP));
        let d = (-vn + bias + p.rest) / kn;
        const was = p.pn; p.pn = Math.max(0, was + d); d = p.pn - was;
        const jx = d*n.x, jy = d*n.y;
        a.vx -= jx*a.im; a.vy -= jy*a.im; a.w -= a.ii*(rax*jy - ray*jx);
        b.vx += jx*b.im; b.vy += jy*b.im; b.w += b.ii*(rbx*jy - rby*jx);
      }
      const tx = -n.y, ty = n.x;
      for(const p of c.pts){
        const rax=p.x-a.x, ray=p.y-a.y, rbx=p.x-b.x, rby=p.y-b.y;
        const rvx = (b.vx - b.w*rby) - (a.vx - a.w*ray);
        const rvy = (b.vy + b.w*rbx) - (a.vy + a.w*rax);
        const vt = rvx*tx + rvy*ty;
        const rtA = rax*ty - ray*tx, rtB = rbx*ty - rby*tx;
        const kt = a.im + b.im + a.ii*rtA*rtA + b.ii*rtB*rtB;
        if(kt <= 0) continue;
        const cap = mu*p.pn;
        let d = -vt/kt;
        const was = p.pt; p.pt = clamp(was + d, -cap, cap); d = p.pt - was;
        const jx = d*tx, jy = d*ty;
        a.vx -= jx*a.im; a.vy -= jy*a.im; a.w -= a.ii*(rax*jy - ray*jx);
        b.vx += jx*b.im; b.vy += jy*b.im; b.w += b.ii*(rbx*jy - rby*jx);
      }
    }
  }
}

/* One fixed step of the solver's own clock. */
function step(dt){
  const m = MODE[W.mode] || MODE.sand;
  const held = W.grab && W.grab.b;
  for(const b of W.bodies){
    if(b === held){
      /* Carried. A spring rather than a teleport: the body is still solid, so
         it shoves what it is dragged through and gets shoved back, and letting
         go throws it at whatever speed it had. */
      const gr = W.grab;
      b.vx = clamp((gr.tx - b.x)*18, -MAXV, MAXV);
      b.vy = clamp((gr.ty - b.y)*18, -MAXV, MAXV);
      b.w *= 0.82;
    } else {
      b.vx += W.gx*GRAV*dt; b.vy += W.gy*GRAV*dt;
      b.vx -= b.vx*LINDAMP*dt; b.vy -= b.vy*LINDAMP*dt;
      b.w  -= b.w*ANGDAMP*dt;
    }
  }
  /* ---- finding the pairs -------------------------------------------
     A **sweep along x**, not every body against every other. A shelf is a
     finite space (decision 141) but it is not a small one — a Mac shelf-row is
     twenty-four columns by fourteen, so three hundred and thirty tiles is a
     legal board, and every-against-every is fifty-six thousand tests a step
     where the sweep is a sort and a few hundred. Sorted by left edge, the
     inner loop stops at the first body that starts to the right of where this
     one ends, because everything after it starts further right still.

     `hw+hh` rather than `hw` is the reach of a box that may have **turned**:
     rotated as far as it can go, its half-width is |cos|·hw + |sin|·hh, which
     that bounds for any angle. The walls sit outside the sweep because a wall
     is six hundred pixels thick and spans the whole board — one that took part
     would overlap everything and the early exit would never fire. */
  const cs = [];
  const list = W.sweep; list.length = 0;
  for(const b of W.bodies) list.push(b);
  list.sort((a,b)=> (a.x-a.hw-a.hh) - (b.x-b.hw-b.hh));
  for(let i=0;i<list.length;i++){
    const a=list[i], reach = a.x + a.hw + a.hh;
    for(let j=i+1;j<list.length;j++){
      const b=list[j];
      if(b.x - b.hw - b.hh > reach) break;
      if(Math.abs(a.y-b.y) > a.hw+a.hh+b.hw+b.hh) continue;
      const c = collide(a, b, m.e);
      if(c) cs.push(c);
    }
  }
  for(const b of W.bodies) for(const w of W.walls){
    const c = collide(b, w, m.e);
    if(c) cs.push(c);
  }
  solve(cs, dt, m.mu);
  let quiet = true;
  for(const b of W.bodies){
    b.vx = clamp(b.vx, -MAXV, MAXV); b.vy = clamp(b.vy, -MAXV, MAXV);
    b.w  = clamp(b.w, -MAXW, MAXW);
    if(!isFinite(b.vx) || !isFinite(b.vy) || !isFinite(b.w)){ b.vx=b.vy=b.w=0; }
    b.x += b.vx*dt; b.y += b.vy*dt;
    if(b.ii) b.a += b.w*dt; else { b.a = 0; b.w = 0; }
    /* A last, blunt fence. The walls do the work; this is what guarantees that
       a solver that has gone wrong loses a body inside the board rather than
       somewhere off the desk with no way back. */
    const rad = b.hw + b.hh;
    b.x = clamp(b.x, -rad, W.w + rad);
    b.y = clamp(b.y, W.y0 - rad, W.y0 + W.h + rad);
    if(!isFinite(b.x) || !isFinite(b.y)){ b.x=b.hx; b.y=b.hy; b.vx=b.vy=0; }
    if(Math.hypot(b.vx, b.vy) > SLEEP_V || Math.abs(b.w) > SLEEP_W) quiet = false;
  }
  return quiet && !held;
}

/* ---- what gets written -------------------------------------------------
   One transform per tile, and only when it has changed. `rotate` is left off a
   body that has not turned, so a sand board writes half the string a tumbling
   one does and a tile that has come to rest writes nothing at all. */
function write(){
  for(const b of W.bodies){
    if(!b.el) continue;
    const dx = b.x - b.hx, dy = b.y - b.hy;
    const t = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px)`
            + (b.a ? ` rotate(${b.a.toFixed(4)}rad)` : '');
    if(t !== b.t){ b.t = t; b.el.style.transform = t; }
  }
}

/* One frame. The solver's clock is fixed and the screen's is not, so a frame
   that arrives late runs several steps rather than one long one — a long step
   is how a box ends up on the far side of the floor.

   **Parking is conditional, and that is the one subtle thing here.** A settled
   pile costs nothing and the loop stops; but a board that is taking its pull
   from the phone can be woken by the phone, and a parked loop is not reading
   it. So while the sensor is the floor, the frame keeps running and does the
   physics only when the lean has actually moved — which is a `pull()` and a
   comparison, and no contacts at all. */
function frame(now){
  W.raf = 0;
  if(!gravityOn() || !W.bodies.length) return;
  const dt = W.last ? Math.min(0.25, (now - W.last)/1000) : STEP;
  W.last = now;
  if(pull(dt)) W.quiet = 0;                      // down has moved: it is awake
  if(W.quiet < SLEEP_T){
    /* **A whole step or none.** The leftover is carried to the next frame
       rather than run as a short one, and that is not tidiness: the overlap
       bias is a *speed*, `BIAS/dt` times how far two boxes are inside each
       other, so a step of a few microseconds asks for a correction of hundreds
       of pixels a second. A frame at 60Hz leaves about seven microseconds of a
       120Hz step over, and running it fired two hundred and forty pixels a
       second into every contact in the pile, every frame — so a stack that had
       plainly come to rest went on shivering and the loop never parked. */
    W.acc = Math.min(W.acc + dt, STEP*MAXSTEP);
    let n = 0, quiet = true;
    while(W.acc >= STEP && n < MAXSTEP){ quiet = step(STEP) && quiet; W.acc -= STEP; n++; }
    if(n){ write(); W.quiet = quiet ? W.quiet + n*STEP : 0; }
  }
  if(W.quiet < SLEEP_T || gravityTilts()) W.raf = requestAnimationFrame(frame);
  else { W.last = 0; W.quiet = 0; }              // the pile has settled: park
}
function wake(){
  if(!gravityOn() || !W.bodies.length) return;
  /* Asked not to be moved, and not being dragged: run the whole fall inside
     this frame and write the answer once. The heap is there and nothing moved
     on the way, which is the honest reading of the request — a switch somebody
     threw is not an incidental animation to be refused. A carry is the
     exception, because a hand in the pile is movement you are causing. */
  if(still() && !W.grab){ settleAtOnce(); return; }
  W.quiet = 0;
  if(!W.raf){ W.last = 0; W.acc = 0; W.raf = requestAnimationFrame(frame); }
}
function stop(){
  if(W.raf){ cancelAnimationFrame(W.raf); W.raf = 0; }
  W.last = 0; W.acc = 0; W.quiet = 0;
}
function clear(){
  stop();
  W.bodies.forEach(b=>{ if(b.el) b.el.style.transform=''; });
  W.bodies = []; W.by.clear(); W.grab = null; W.key = '';
  const g = $('#drawergrid');
  if(g) g.classList.remove('falling','settling');
}

/* ---- reduced motion ----------------------------------------------------
   The switch is not an incidental animation — somebody asked for this — so it
   is not simply refused. It is run to a standstill inside one frame and the
   answer written once: the heap is there, and nothing moved on the way. */
function settleAtOnce(){
  for(let i=0;i<600 && !step(STEP);i++);
  write();
  stop();
}

/* ---- throwing the switch ----------------------------------------------
   Deliberately **not** a render. Turning it off has to walk the tiles back to
   their cells, and a render replaces every one of them with a fresh element
   sitting at home — so there would be nothing left to animate. The DOM is
   already right either way; only the class differs, and the next ordinary
   render states it from `S.look` like everything else. */
function apply(){
  const mode = gravityMode();
  if(mode === 'off'){
    if(!W.bodies.length){ clear(); return; }
    const g = W.grid || $('#drawergrid');
    stop();
    if(W.grab){ if(W.grab.b.el) W.grab.b.el.classList.remove('carried'); W.grab = null; }
    if(still() || !g){ clear(); return; }
    g.classList.add('settling');
    W.bodies.forEach(b=>{ b.t=''; if(b.el) b.el.style.transform=''; });
    // …and a token, because the switch can be thrown back on inside those four
    // hundred milliseconds and a stale timer would clear the new pile
    const gen = ++W.gen;
    setTimeout(()=>{ if(W.gen===gen) clear(); }, SETTLE_MS);
    return;
  }
  W.gen++;
  const was = W.mode;
  W.mode = mode;
  sync();                                        // …which wakes it, or settles it
  /* Sand to tumbling is the pile being told it may lean, so it does — from
     where it already is, rather than from the grid it left a minute ago. */
  /* Sand to tumbling is a settled pile being told it may lean — so it is
     nudged now rather than at birth, and it finds its angle from where it
     already is rather than from the grid it left a minute ago. */
  if(was !== mode){
    const spin = MODE[mode] && MODE[mode].spin;
    W.bodies.forEach(b=>{ b.ii = spins(b); if(spin && !b.a) nudge(b); });
  }
  applyTilt();                                   // it may want the sensor now
  wake();
}

/* ---- picking one up ----------------------------------------------------
   gestures.js owns the pointer and hands the press over, for the reason every
   other gesture goes through one file: two systems capturing the same finger
   is how a drag ends up with no release. What arrives here is a body and a
   point on the board, in the grid's own pixels. */
function localOf(x, y){
  const g = W.grid || $('#drawergrid');
  if(!g) return null;
  const r = g.getBoundingClientRect();
  return {x: x - r.left, y: y - r.top};
}
function grab(id, x, y){
  const b = W.by.get(id); if(!b) return false;
  const p = localOf(x, y); if(!p) return false;
  W.grab = {b, ox: b.x - p.x, oy: b.y - p.y, tx: b.x, ty: b.y};
  if(b.el) b.el.classList.add('carried');
  wake();
  return true;
}
function drag(x, y){
  if(!W.grab) return;
  const p = localOf(x, y); if(!p) return;
  W.grab.tx = p.x + W.grab.ox;
  W.grab.ty = p.y + W.grab.oy;
  wake();
}
function drop(){
  if(!W.grab) return;
  if(W.grab.b.el) W.grab.b.el.classList.remove('carried');
  W.grab = null;
  wake();
}
const grabbed = ()=> !!W.grab;
const bodyOf = id => W.by.get(id) || null;

/* A way in for the smoke test and for tuning by hand: how many bodies there
   are, where one of them has got to, and pointing the pull somewhere without a
   phone to lean. The numbers are the board's own pixels. */
const report = ()=> ({
  mode: W.mode, bodies: W.bodies.length, running: !!W.raf,
  board: {w:W.w, h:W.h, y0:W.y0}, g: {x:W.gx, y:W.gy},
  at: W.bodies.map(b=>({id:b.id, x:+b.x.toFixed(1), y:+b.y.toFixed(1),
                        a:+b.a.toFixed(3), hw:b.hw, hh:b.hh,
                        v:+Math.hypot(b.vx,b.vy).toFixed(1),
                        home:{x:+b.hx.toFixed(1), y:+b.hy.toFixed(1)}}))
});
function settle(n){
  for(let i=0;i<(n||400);i++) if(step(STEP)) break;
  write();
}

export { sync as gravitySync, apply as gravityApply, clear as gravityClear,
  grab as gravityGrab, drag as gravityDrag, drop as gravityDrop, grabbed as gravityGrabbed,
  bodyOf, report as gravityReport, settle as gravitySettle, wake as gravityWake };
