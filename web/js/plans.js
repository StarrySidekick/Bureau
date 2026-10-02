/* ============================================================
   22 · plans — a board you can put down again
   ============================================================
   A **plan** is a saved arrangement: what is on a board, where each thing sits
   on both devices, what type each one is and how it is dressed — kept so it
   can be laid out again somewhere else. A shoot day, a packing list, a weekly
   review. `seed:` on a kind already did a hair of this — a list of titles, one
   level deep, no boxes — and this is what it wanted to be.

   **The word.** `layout` was taken: in Bureau it is how a container arranges
   its children when it opens (grid, list, book, calendar…), which is a
   different question and already in the interface. A *plan* is what an
   architect draws of a room, which is exactly what this is — an arrangement,
   drawn, so it can be built again. See decision 121.

   **A plan is not on the grid, so it is not an object.** Everything else in
   Bureau is one, and the temptation was to make a plan a container with a null
   parent — a desk that is not in the row. That would have been one clever
   thing too many: `chainOf` stops at a desk, `isDesk()` reads `S.desks`, and a
   container in neither state is an orphan every walk of the object list would
   have had to learn about. `S.plans` is its own list, sitting beside `S.kinds`
   in exactly the same way — a thing the desk is made *with* rather than a thing
   on it.

   **What it carries: everything but the doing.** Types, titles, bodies, boxes
   on both devices, colours, faces, the whole look, tags, and however deep the
   nesting goes. What it does *not* carry is the record of having done it —
   ticks, counts, streak history, dates, answers, the mark a repeat leaves on
   its copies. So a packing list arrives written and unticked, and a plan
   stamped in March does not arrive overdue since February. The stripping
   happens at **capture**, not at stamping: a plan is then a clean thing you can
   look at, and putting one down is a plain copy with no rules in it.

   Media is stripped outright. Image and sound bytes live in IndexedDB and
   `snapshot()` takes `media.src` out of every object on its way to
   localStorage — a plan is stored *inside* that snapshot, so a plan carrying a
   photograph would be a data URL smuggled past the one place that stops them.
   A plan is an arrangement; it is not an asset store. */
import { S, K, T, byId, isContainer, container, childrenOf, has } from './model.js';
import { uid, ROOT, clamp } from './util.js';
import { create } from './mutations.js';
import { GRID, SHELVES, ensureBox, boxOk, freeSpot, anySpot, gridOf, lay, overlaps,
         oneShelf, boardsOf, ensureBoards, shelfAt, setShelf, nearestBoard, startOf,
         addBoard, colsOf, shelfRows, growDown, growsDown, onBoards, shelvesOf, TILE, SPAN, PAGES_MAX } from './grid.js';
import { rescaleOneBoard } from './persist.js';
import { randomLook } from './look.js';

/* The parent every top-level thing in a plan carries. A reserved string, the
   way ROOT and HOLD are — there is no object with this id and there never will
   be, so nothing to seed, migrate, export or reap. */
const PLAN_ROOT = '__plan';

const plans = ()=> (S.plans = S.plans || []);
const planById = id => plans().find(p=>p.id===id) || null;
// what a plan puts on the board it is stamped onto — its top level
const planTop = p => (p && p.objects || []).filter(o=>(o.parent||PLAN_ROOT)===PLAN_ROOT);
const planKids = (p, pid) => (p && p.objects || []).filter(o=>o.parent===pid);

/* Everything that is a record of having done a thing rather than a fact about
   what the thing *is*. Listed once, here, because the alternative is the same
   list written out at capture and again at stamping and the two drifting. */
const DOING = ['done','doneAt','due','dead','soft','till','count','rating','answer',
               'history','fromRepeat','media','doneOn'];

/* **A rule can name the board it sits on.** `@in` and `@under` compare against
   a container's id, so a sorting drawer or a calendar asking "anything inside
   this project" named the project it was captured from, and put down in a
   second project it went on collecting the first one's things. The value is
   re-pointed like `rel` and `tracks` are: the board the plan came off becomes
   PLAN_ROOT in the plan, and PLAN_ROOT becomes the board it is put down on.
   A rule naming some *other* container is left alone, because that container
   is not being copied and still exists. This is what lets a stock plan carry
   a calendar of its own board. See decision 194. */
const REPOINT = new Set(['@in','@under']);
function repointRules(o, swap){
  const f = o.filter;
  if(!f || !Array.isArray(f.rules) || !f.rules.some(r=>r && REPOINT.has(r.f))) return;
  o.filter = Object.assign({}, f, {rules: f.rules.map(r=>{
    if(!r || !REPOINT.has(r.f)) return r;
    const to = swap(String(r.v??''));
    return to ? Object.assign({}, r, {v:to}) : r;
  })});
}

/* One object, cleaned and re-pointed. `map` is old id → new id; anything the
   map does not know about is dropped rather than left dangling, which is what
   `rel` needs — a relation to something outside the plan cannot come along,
   because the thing at the other end is not being copied. */
function planCopy(o, map, parent, from){
  const c = Object.assign({}, o);
  repointRules(c, v => v===from ? PLAN_ROOT : map[v]);
  DOING.forEach(k=>{ delete c[k]; });
  /* A milestone is structure — the steps a piece of work is made of — so it
     travels; whether each one is ticked is doing, so it does not. */
  if(Array.isArray(c.milestones))
    c.milestones = c.milestones.map(m=>Object.assign({}, m, {done:false}));
  /* A repeat rule is a fact about the thing; how many copies it has made is a
     record of it having run. */
  if(c.repeat && typeof c.repeat==='object')
    c.repeat = Object.assign({}, c.repeat, {made:0});
  c.id = map[o.id];
  c.parent = parent;
  c.rel = (o.rel||[]).map(r=>map[r]).filter(Boolean);
  /* A `tracks` is an id like a relation is, and it was the one the copy did
     not re-point — so a progress bar reading the checklist beside it came out
     of a plan still naming the checklist it was captured from, and stamping a
     second copy gave you two bars reading the same original. Dropped rather
     than left dangling, for `rel`'s reason: barPct() falls back to the bar's
     own milestones when nothing is tracked, which is the right answer for a
     bar whose subject did not come along. */
  if(o.tracks) c.tracks = map[o.tracks] || null;
  // where a spawner files what it makes is an id too (decision 197)
  if(o.into) c.into = map[o.into] || null;
  // …and the inbox a copper pipe drains (decision 286)
  if(o.from) c.from = map[o.from] || null;
  return c;
}

/* ---- capture -----------------------------------------------------------
   By **parent**, never by childrenOf(): a magic drawer shows things that live
   somewhere else, and a plan that captured a collection would put copies of
   other people's objects in the box. A magic drawer inside a plan keeps its
   rule, which is a setting and travels like any other — so it arrives empty
   and fills itself, which is what a magic drawer is for. */
function planFrom(cid, nm){
  const c = container(cid); if(!c) return null;
  const map = {}, out = [];
  const walk = (parentId, into)=>{
    S.objects.filter(o=>o.parent===parentId).forEach(o=>{
      map[o.id] = uid('p_');
      out.push([o, into]);
      if(isContainer(o)) walk(o.id, map[o.id]);
    });
  };
  walk(cid, PLAN_ROOT);
  const objects = out.map(([o, into])=>planCopy(o, map, into===PLAN_ROOT ? PLAN_ROOT : into, cid));
  const p = {
    id: uid('pl_'),
    nm: nm || c.title || K(c.kind).nm,
    // drawn as the thing it came off, so a plan is recognisable in a list
    ic: c.icon || K(c.kind).ic, c: c.c != null ? c.c : K(c.kind).c,
    of: c.kind, made: T,
    // the phone board it was arranged on, so a plan can be rescaled onto one
    // with a different number of columns — a column count is a coordinate
    // space (decision 48) and a plan is boxes in it
    cols: GRID.phone.cols,
    /* What the Magic Selector makes on the board it came off. It is a fact
       about the board rather than about anything on it, so it rides on the
       plan and is given to the container the plan is put down in. Kind names
       only — nothing in it is an id to re-point. See decision 199. */
    makes: c.makes ? JSON.parse(JSON.stringify(c.makes)) : undefined,
    env: c.env ? JSON.parse(JSON.stringify(c.env)) : undefined,
    stamp: c.stampw ? {w:c.stampw, ink:c.stampink} : undefined,
    /* The orders its letter block steps through, and the one it is on
       (decision 215): a flow says how its boards sort as much as what is on
       them. */
    sorts: Array.isArray(c.sortCycle) ? c.sortCycle.slice() : undefined,
    sort: c.sort || undefined,
    // which tools its drawer front carries, either side of the knob (decision 220)
    rail: c.rail ? JSON.parse(JSON.stringify(c.rail)) : undefined,
    objects
  };
  plans().push(p);
  return p;
}

/* ---- putting one down --------------------------------------------------
   Fresh ids throughout, parents re-pointed, and the boxes kept where they
   will fit. Kept rather than re-placed because the arrangement *is* the plan —
   stamping into an empty drawer should give back exactly what was saved. Where
   a box is taken, that one thing moves and the rest stay, which is better than
   re-flowing the board and better than refusing. */
function stampPlan(planId, intoId, at){
  const p = planById(planId); if(!p) return [];
  const home = intoId || ROOT;
  /* A board the plan says what to make on, put down in a container that says
     nothing yet, says it too. Never over a board that already answers — that
     was somebody's choice — and never onto the desk, whose picker is every
     board's way in. See decision 199. */
  if(p.makes && home!==ROOT && byId(home) && !byId(home).makes)
    byId(home).makes = JSON.parse(JSON.stringify(p.makes));
  // …and how it sorts, onto a board that has not said (decision 215)
  if(home!==ROOT && byId(home)){ const hb = byId(home);
    if(Array.isArray(p.sorts) && !hb.sortCycle) hb.sortCycle = p.sorts.slice();
    if(p.sort && !hb.sort) hb.sort = p.sort;
    // …and what its drawer front carries, onto a board that has not said (220)
    if(p.rail && !hb.rail) hb.rail = JSON.parse(JSON.stringify(p.rail));
    // …and its room, so a bench arrives with it (decision 293)
    if(p.env && !hb.env){ hb.env = JSON.parse(JSON.stringify(p.env));
      // an aesthetic brings its own board, so the one it was born with steps aside
      if(p.env.style) delete hb.board; }
    if(p.stamp && !hb.stampw){ hb.stampw = p.stamp.w; hb.stampink = p.stamp.ink; } }
  /* **A plan is an arrangement, so the drawer grows to hold it.** Since
     decision 188 a container's board is its own tile, four cells to a cell —
     so a plan authored eight cells across and twelve down no longer fits a
     drawer somebody made two cells square, and every box would fail `boxOk()`
     and be re-flowed by `anySpot()`, which is the one thing a plan exists to
     prevent. The drawer is raised to the plan's own extent rather than the
     plan being squeezed into the drawer; it is never shrunk, because a big
     drawer holding a small plan is fine and the size was somebody's choice.
     The desk is not a tile and needs none of this. */
  const planExtent = dv => {
    let mx = 0, my = 0, cells = 0;
    planTop(p).forEach(o => { const b = o[dv]; if(!b || !b.x) return;
      mx = Math.max(mx, b.x + b.w - 1); my = Math.max(my, b.y + b.h - 1); cells += b.w*b.h; });
    return {mx, my, cells};
  };
  /* **Several boards** (decision 219), put down around the one you are on —
     or, in a container that is empty, which is what a flow made into its own
     drawer always is, round its only board. Worked out before the copies go
     into `S.objects`, because making a board to the left moves everything
     already there, and these are not there yet. */
  const multi = Array.isArray(p.boards) && p.boards.length>1 && p.dims;
  let spots = null, startSpot = null, blk = null;
  if(multi){
    /* **Each board it was written on is a block of tiles here** (decision
       272): a flow's board was eight by fourteen, and a tile is eight by
       eight, so each stands for as many tiles as it takes to hold one — two
       down, for every stock flow. The block's top-left tile is where its
       boxes are counted from. */
    const k = dm => dm ? {x:Math.max(1, Math.ceil(dm.w/TILE)), y:Math.max(1, Math.ceil(dm.h/TILE))} : {x:1, y:1};
    blk = {x:Math.max(k(p.dims.desk).x, k(p.dims.phone).x), y:Math.max(k(p.dims.desk).y, k(p.dims.phone).y)};
    const st = p.start || p.boards[0];
    const wasEmpty = !S.objects.some(o=>o.parent===home);
    const here = wasEmpty ? boardsOf(home)[0] || {x:0, y:0} : nearestBoard(home, shelfAt(home));
    const cells = [];
    p.boards.forEach(b=>{ for(let j=0;j<blk.y;j++) for(let i=0;i<blk.x;i++)
      cells.push({x:(b.x-st.x)*blk.x+i, y:(b.y-st.y)*blk.y+j}); });
    const got = ensureBoards(home, cells, here);
    // the tile each block starts at, one per board of the flow
    spots = p.boards.map((b, n)=>got[n*blk.x*blk.y] || null);
    startSpot = spots[p.boards.findIndex(b=>b.x===st.x && b.y===st.y)] || spots[0];
    if(wasEmpty && home!==ROOT && byId(home) && startSpot) byId(home).start = {x:startSpot.x, y:startSpot.y};
  }
  const map = {};
  // `d` or `o` on the id is a convention, not a fact anything reads — but a
  // drawer whose id starts `o` is confusing in a console and free to avoid.
  // isContainer() answers off the object's own attrs, so an invented type and
  // a hand-edited object both get it right.
  p.objects.forEach(o=>{ map[o.id] = uid(isContainer(o) ? 'd' : 'o'); });
  const made = p.objects.map(o=>{
    const c = Object.assign({}, o);
    /* A shallow copy shares the *boxes*, so the object put on the board and
       the one still in the plan were two names for one rectangle. Nothing
       mutates a box in place today — every writer replaces it — so this never
       showed; it is a landmine rather than a bug, and it is two lines. */
    if(o.desk)  c.desk  = Object.assign({}, o.desk);
    if(o.phone) c.phone = Object.assign({}, o.phone);
    c.id = map[o.id];
    c.parent = (o.parent||PLAN_ROOT)===PLAN_ROOT ? home : (map[o.parent] || home);
    c.rel = (o.rel||[]).map(r=>map[r]).filter(Boolean);
    // the same re-pointing capture does, for the same reason: a bar put down
    // twice must read the copy beside it and not the first one
    if(o.tracks) c.tracks = map[o.tracks] || null;
    if(o.into) c.into = map[o.into] || null;
    if(o.from) c.from = map[o.from] || null;
    repointRules(c, v => v===PLAN_ROOT ? home : map[v]);
    /* **A drawer that came out of a plan rolls its own look, like any other.**
       `create()` gives every container its own knob, edge, grain and panelling
       from this aesthetic's vocabulary at birth (decision 92), and a plan
       stamped them without one — so the ten the desk ships with, which state
       no look at all, laid out a row of identical cockbead fronts and read as
       a template rather than as furniture.

       It only ever fills in what nobody has said. A plan *captured* off a
       board carries a look on every drawer in it, because create() wrote one
       there, so this cannot overwrite an arrangement you saved; and a stock
       plan that does state a slot keeps it. The colour is left alone either
       way — `c` is the one thing the ten do state, and a plan's palette is
       part of what it is. */
    if(isContainer(c)){
      const rl = randomLook();
      ['knob','border','texture','panel','plate','knobtone'].forEach(k=>{
        if(c[k] == null && rl[k] != null) c[k] = rl[k];
      });
    }
    c.created = T;
    c.ord = (o.ord||0);
    // a plan carries no doing, and a copy of one starts with none either
    if(K(c.kind) && c.done) c.done = false;
    return c;
  });
  /* Each box read out of the board it was written on and into the board that
     stands for it here, rescaled if a board is a different number of columns
     on this device. A box whose board did not come (the rectangle was full)
     keeps its size and is placed like anything new. */
  if(multi){
    made.filter(o=>o.parent===home).forEach(o=>['desk','phone'].forEach(dv=>{
      const b = o[dv], dm = p.dims[dv]; if(!b || !b.x || !dm) return;
      const bx = Math.floor((b.x-1)/dm.w), by = Math.floor((b.y-1)/dm.h);
      const i = p.boards.findIndex(c=>c.x===bx && c.y===by);
      const to = i>=0 ? spots[i] : null;
      if(!to){ o[dv] = {w:b.w, h:b.h}; return; }
      const g = gridOf(dv, home), bw = blk.x*g.shelfW, bh = blk.y*g.shelfH;
      const rx = b.x-1-bx*dm.w, w = Math.max(1, Math.min(g.maxW, b.w));
      const ry = b.y-1-by*dm.h, h = Math.max(1, Math.min(g.maxH, b.h));
      o[dv] = {x: to.x*g.shelfW + Math.min(rx, Math.max(0, bw-w)) + 1,
               y: to.y*g.shelfH + Math.min(ry, Math.max(0, bh-h)) + 1, w, h};
    }));
  }
  /* **A flow is given the tiles it covers** (decision 274): its board was
     written eight wide, and a tile is five, so a container that is one bare
     tile is grown right and down, before anything is placed, to the block of
     tiles its boxes reach. Right and down only, so nothing already counted
     from the corner moves. */
  if(!multi && home!==ROOT && growsDown(home)
     && !S.objects.some(o=>o.parent===home)){
    let mx = 0, my = 0;
    made.filter(o=>o.parent===home).forEach(o=>['desk','phone'].forEach(dv=>{
      const b = o[dv]; if(!b || !b.x || !b.w) return;
      mx = Math.max(mx, b.x+b.w-1 + ((at && at.x) ? at.x-1 : 0));
      my = Math.max(my, b.y+(b.h||1)-1 + ((at && at.y) ? at.y-1 : 0));
    }));
    /* a tile is a cell since decision 283, so the block is the boxes' own
       reach, no bigger than the most a board may span */
    const tw = Math.min(SPAN, Math.ceil(mx/TILE)), th = Math.min(SPAN, Math.ceil(my/TILE)), cells = [];
    for(let j=0; j<th; j++) for(let i=0; i<tw; i++) cells.push({x:i, y:j});
    if(cells.length > 1) ensureBoards(home, cells, {x:0, y:0});
  }
  S.objects.push(...made);
  /* A plan arranged on an eight-column phone put down on a ten-column one is
     boxes in the wrong coordinate space. The same rescale a stored desk gets
     when the grid size changes, applied to just the board being stamped. */
  if(!multi && p.cols && p.cols !== GRID.phone.cols)
    rescaleOneBoard(made, home, p.cols, GRID.phone.cols);
  const top = made.filter(o=>o.parent===home);
  /* Laid out **where you asked**. Holding a bare cell is how you make a thing
     *there* (decision 47), and a plan put down from that gesture should arrive
     under your finger rather than wherever the board had room. The whole
     arrangement shifts by one offset — its top-left corner to that cell — so
     the shape of it survives the move, which is the only reason it is a plan
     and not a list. */
  if(!multi && at && (at.x || at.y)){
    ['desk','phone'].forEach(dv=>{
      const boxed = top.filter(o=>o[dv] && o[dv].w);
      if(!boxed.length) return;
      const dx = (at.x||1) - Math.min(...boxed.map(o=>o[dv].x||1));
      const dy = (at.y||1) - Math.min(...boxed.map(o=>o[dv].y||1));
      boxed.forEach(o=>{ o[dv] = Object.assign({}, o[dv],
        {x:Math.max(1,(o[dv].x||1)+dx), y:Math.max(1,(o[dv].y||1)+dy)}); });
    });
  }
  /* **The arrangement moves as one** (decision 195). Only the top level can
     collide — everything deeper is going into a container that has just been
     created empty. Where it was saved, if that is clear; otherwise the first
     place on this board, top first, where the *whole* plan fits — which is
     what happens when you lay one out on a board that already has things on
     it. It used to try each box where it was saved and send the ones that hit
     something to `anySpot()` one by one, so the few that collided scattered
     and the rest stayed: the shape broken in exactly the place it met the
     board. No room anywhere and the container is given more (a screenful
     down, or across; or a taller tile when boards are proportional) and asked
     again. Only when that runs out does it fall back to one box at a time. */
  ['desk','phone'].forEach(dv=>{
    /* A plan taller than this phone's screenful cannot sit whole on one: the
       seam between screens would cut through it wherever it went, so looking
       for a place (and growing the drawer to find one) is wasted. It keeps
       the places it was saved at and what crosses the seam moves on its own,
       which on a fourteen-row plan and a twelve-row phone is the last line. */
    const g0 = gridOf(dv, home);
    const tall = top.reduce((m,o)=>{ const b=o[dv]; return b && b.y ? Math.max(m, b.y+b.h-1) : m; }, 0);
    // up and down a board scrolls across its seams now (decision 272)
    const seamed = multi || (dv==='phone' && tall > g0.maxH);
    let off = seamed ? null : clearOffset(top, dv, home);
    if(!seamed) for(let tries=0; !off && tries<3 && growFor(top, dv, home); tries++) off = clearOffset(top, dv, home);
    if(off){
      top.forEach(o=>{ const b=o[dv]; if(b && b.w && b.x)
        o[dv] = Object.assign({}, b, {x:b.x+off.dx, y:b.y+off.dy}); });
    }
    top.forEach(o=>{
      const b = o[dv];
      if(!b || !b.w){ ensureBox(o, dv, home); return; }
      if(off || boxOk(b, o.id, dv, home)) return;
      const g1 = gridOf(dv, home);
      const spot = anySpot(b.w, b.h, dv, home,
        {x:Math.floor((b.x-1)/g1.shelfW), y:Math.floor((b.y-1)/g1.shelfH)});
      o[dv] = spot ? Object.assign({}, spot, {w:b.w, h:b.h}) : b;
    });
  });
  // …and you are standing on the board it opens on
  if(multi && startSpot) setShelf(home, startSpot.x, startSpot.y);
  const qp = p.quick ? quickPad(home) : null;
  if(qp) made.push(qp);
  return made;
}
/* ---- a quick way in — decision 297 ------------------------------------
   A bench that says `quick` puts a notepad in the desk's drawer front when it
   is made, standing in every board's front (`frontAll`) and writing into the
   bench (`into`). Pressed from anywhere it takes you there with the line
   ready, and a button on the lip takes you back (`writeAway()` in tiles.js).
   Once: a desk whose front already has a notepad writing into a drawer keeps
   that one, so a second Brain Dump does not crowd the front. */
function quickPad(home){
  const into = home!==ROOT && byId(home); if(!into) return null;
  if(S.objects.some(o=>(o.parent||ROOT)===ROOT && o.front && o.frontAll && !o.done && byId(o.into))) return null;
  return create('notepad', {parent:ROOT, into:into.id, front:'right', frontAt:Date.now(), frontAll:true});
}

/* The offset that puts every box of a plan somewhere clear on this board, or
   null. `boxOk()` asked of each would see the plan's own other boxes as
   siblings — they are already in `S.objects` — so the board's other things are
   read once and the rules are asked directly: on the board, no bigger than a
   screen, not across a seam on a phone, and on top of nothing. Row by row from
   the top, so it lands as high as it can; the saved place first. */
function clearOffset(top, dv, home){
  const boxes = top.map(o=>o[dv]).filter(b=>b && b.w && b.x);
  if(!boxes.length) return {dx:0, dy:0};
  const g = gridOf(dv, home);
  const mine = new Set(top.map(o=>o.id));
  const sibs = childrenOf(container(home))
    .filter(d=>!mine.has(d.id) && !has(d,'decor') && d[dv] && d[dv].x && d[dv].w)
    .map(d=>lay(d, dv, home));
  const ok = (dx, dy)=> boxes.every(b=>{
    const nb = {x:b.x+dx, y:b.y+dy, w:b.w, h:b.h};
    if(nb.x<1 || nb.y<1 || nb.x+nb.w-1>g.cols || nb.y+nb.h-1>g.rows) return false;
    if(nb.w>g.maxW || nb.h>g.maxH) return false;
    if(dv==='phone' && !oneShelf(nb, g, dv)) return false;
    if(!onBoards(nb, g, home)) return false;          // decision 219
    return !sibs.some(s=>overlaps(nb, s));
  });
  if(ok(0, 0)) return {dx:0, dy:0};
  const x0 = Math.min(...boxes.map(b=>b.x)), y0 = Math.min(...boxes.map(b=>b.y));
  const x1 = Math.max(...boxes.map(b=>b.x+b.w-1)), y1 = Math.max(...boxes.map(b=>b.y+b.h-1));
  for(let dy=1-y0; dy<=g.rows-y1; dy++)
    for(let dx=1-x0; dx<=g.cols-x1; dx++) if(ok(dx, dy)) return {dx, dy};
  return null;
}
/* More room for a plan that found none: a screenful down, then across, on a
   board of screenfuls; a taller tile on a proportional one. False when there
   is nothing left to give, or the plan is going onto the desk, which is the
   size it is. */
function growFor(top, dv, home){
  const c = home===ROOT ? null : byId(home);
  if(!c) return false;
  /* **Room the shape of the flow** (decision 274): a flow was written eight
     wide and a tile is five, and one tile at a time under the one you are on
     never makes a board wider, nor a whole row deeper. So a board narrower
     than the flow is given columns of tiles beside it, every row of them, and
     one wide enough is given rows below, as many as the flow is tall, every
     column of them; `clearOffset()` then finds the room they make. */
  const bs = top.map(o=>o[dv]).filter(b=>b && b.w && b.x);
  if(!bs.length) return boardsOf(home).length < PAGES_MAX && growDown(home);
  const wide = Math.max(...bs.map(b=>b.x+b.w-1)) - Math.min(...bs.map(b=>b.x)) + 1;
  const tall = Math.max(...bs.map(b=>b.y+(b.h||1)-1)) - Math.min(...bs.map(b=>b.y)) + 1;
  const g = gridOf(dv, home), sh = shelvesOf(home, dv);
  const add = (x, y) => boardsOf(home).length < PAGES_MAX && !!addBoard(home, x, y);
  let grew = false;
  if(wide > g.cols){
    const more = Math.ceil((wide - g.cols) / g.shelfW);
    for(let i=0; i<more; i++) for(let y=0; y<sh.h; y++) grew = add(sh.w+i, y) || grew;
  } else {
    const more = Math.ceil(tall / g.shelfH);
    for(let j=0; j<more; j++) for(let x=0; x<sh.w; x++) grew = add(x, sh.h+j) || grew;
  }
  return grew;
}

/* A plan is the same shape whichever way it was made, so a *type* that opens
   fitted to one needs no second mechanism: `plan` on a kind names it, and
   create() stamps it into the container it has just made. It supersedes
   `seed:`, which said the same thing in titles only and one level deep — both
   are read, the plan first, and nothing already using seed had to change. */
const planForKind = kind => { const id = K(kind) && K(kind).plan; return id && planById(id) ? id : null; };

// renaming and deleting, so the panel does not reach into the array itself
function renamePlan(id, nm){ const p=planById(id); if(p && nm) p.nm=nm; return p; }
function delPlan(id){ const i=plans().findIndex(p=>p.id===id); if(i>=0) plans().splice(i,1);
  /* A type pointing at a plan that has gone would silently make an empty
     container for ever, which is the quiet kind of broken. */
  Object.values(S.kinds||{}).forEach(k=>{ if(k.plan===id) delete k.plan; });
  return i>=0; }

// how many things a plan holds, all the way down — what its card says
const planSize = p => (p && p.objects || []).length;

export { PLAN_ROOT, plans, planById, planTop, planKids, planFrom, stampPlan,
         planForKind, renamePlan, delPlan, planSize };
