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
import { GRID, INNER, SHELVES, ensureBox, boxOk, freeSpot, anySpot, gridOf, lay, overlaps,
         oneShelf, proportional } from './grid.js';
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
  /* **Screenfuls, when boards are not proportional** (decision 195, the
     default). The drawer is given as many screens as the plan covers — and
     one more across when the plan fills most of them, because a board that is
     the base station for something has to have room beside it for what you
     make there: a spawner on a full board presses things out on top of each
     other. Never fewer than it had. */
  if(home!==ROOT && byId(home) && !proportional()){
    const c = byId(home), had = c.shelves || {w:1, h:1};
    let nw = 1, nh = 1, full = false;
    ['desk','phone'].forEach(dv => {
      const e = planExtent(dv); if(!e.mx) return;
      const g = gridOf(dv, home);
      const w = Math.ceil(e.mx/g.shelfW), h = Math.ceil(e.my/g.shelfH);
      nw = Math.max(nw, w); nh = Math.max(nh, h);
      if(e.cells > 0.6 * w*g.shelfW * h*g.shelfH) full = true;
    });
    c.shelves = {w:clamp(Math.max(had.w||1, nw + (full?1:0)), 1, SHELVES),
                 h:clamp(Math.max(had.h||1, nh), 1, SHELVES)};
  }
  (() => {
    const c = home===ROOT ? null : byId(home);
    if(!c || !proportional()) return;
    /* **Both boards, each against its own extent.** A container's inside is
       read off the box for the device being drawn (decision 190), so growing
       the desk box alone left the phone board the size it was and every phone
       box in the plan failed `boxOk()` there — the same re-flow this whole
       block exists to prevent, happening on one device only and therefore
       invisible from the other. */
    ['desk','phone'].forEach(dv => {
      let mx = 0, my = 0;
      p.objects.forEach(o => {
        if((o.parent||PLAN_ROOT)!==PLAN_ROOT) return;
        const b = o[dv]; if(!b || !b.x) return;
        mx = Math.max(mx, b.x + b.w - 1);
        my = Math.max(my, b.y + b.h - 1);
      });
      if(!mx && !my) return;
      const box = (c[dv] && c[dv].w) ? c[dv] : {w:2, h:2};
      const w = Math.max(box.w, Math.ceil(mx/INNER));
      const h = Math.max(box.h, Math.ceil(my/INNER));
      if(w===box.w && h===box.h) return;
      const want = Object.assign({}, box, {w, h});
      /* If it no longer fits where it sits, it gives the place up and keeps
         the size — `ensureBox()`'s bargain, and the only honest way to grow a
         tile on a board somebody else has arranged. */
      c[dv] = (want.x && !boxOk(want, c.id, dv, c.parent)) ? {w, h} : want;
    });
  })();
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
  S.objects.push(...made);
  /* A plan arranged on an eight-column phone put down on a ten-column one is
     boxes in the wrong coordinate space. The same rescale a stored desk gets
     when the grid size changes, applied to just the board being stamped. */
  if(p.cols && p.cols !== GRID.phone.cols)
    rescaleOneBoard(made, home, p.cols, GRID.phone.cols);
  const top = made.filter(o=>o.parent===home);
  /* Laid out **where you asked**. Holding a bare cell is how you make a thing
     *there* (decision 47), and a plan put down from that gesture should arrive
     under your finger rather than wherever the board had room. The whole
     arrangement shifts by one offset — its top-left corner to that cell — so
     the shape of it survives the move, which is the only reason it is a plan
     and not a list. */
  if(at && (at.x || at.y)){
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
    const seamed = dv==='phone' && tall > g0.shelfH;
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
      const spot = anySpot(b.w, b.h, dv, home);
      o[dv] = spot ? Object.assign({}, spot, {w:b.w, h:b.h}) : b;
    });
  });
  return made;
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
    if(nb.w>g.shelfW || nb.h>g.shelfH) return false;
    if(dv==='phone' && !oneShelf(nb, g)) return false;
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
  if(!proportional()){
    const had = c.shelves || {w:1, h:1};
    if((had.h||1) < SHELVES){ c.shelves = {w:had.w||1, h:(had.h||1)+1}; return true; }
    if((had.w||1) < SHELVES){ c.shelves = {w:(had.w||1)+1, h:had.h||1}; return true; }
    return false;
  }
  const bs = top.map(o=>o[dv]).filter(b=>b && b.w);
  const tall = bs.length ? Math.max(...bs.map(b=>(b.y||1)+b.h-1)) - Math.min(...bs.map(b=>b.y||1)) + 1 : 4;
  const box = (c[dv] && c[dv].w) ? c[dv] : {w:2, h:2};
  const want = Object.assign({}, box, {h: box.h + Math.ceil(tall/INNER)});
  c[dv] = (want.x && !boxOk(want, c.id, dv, c.parent)) ? {w:want.w, h:want.h} : want;
  return true;
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
