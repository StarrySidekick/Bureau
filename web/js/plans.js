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
import { S, K, T, isContainer, container } from './model.js';
import { uid, ROOT } from './util.js';
import { GRID, ensureBox, boxOk, freeSpot } from './grid.js';
import { rescaleOneBoard } from './persist.js';

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

/* One object, cleaned and re-pointed. `map` is old id → new id; anything the
   map does not know about is dropped rather than left dangling, which is what
   `rel` needs — a relation to something outside the plan cannot come along,
   because the thing at the other end is not being copied. */
function planCopy(o, map, parent){
  const c = Object.assign({}, o);
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
  const objects = out.map(([o, into])=>planCopy(o, map, into===PLAN_ROOT ? PLAN_ROOT : into));
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
  const map = {};
  // `d` or `o` on the id is a convention, not a fact anything reads — but a
  // drawer whose id starts `o` is confusing in a console and free to avoid.
  // isContainer() answers off the object's own attrs, so an invented type and
  // a hand-edited object both get it right.
  p.objects.forEach(o=>{ map[o.id] = uid(isContainer(o) ? 'd' : 'o'); });
  const made = p.objects.map(o=>{
    const c = Object.assign({}, o);
    c.id = map[o.id];
    c.parent = (o.parent||PLAN_ROOT)===PLAN_ROOT ? home : (map[o.parent] || home);
    c.rel = (o.rel||[]).map(r=>map[r]).filter(Boolean);
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
  /* Only the top level can collide — everything deeper is going into a
     container that has just been created empty. Try where it was saved; if
     something is already there, that one thing finds a spot and the rest stay
     put, which is better than re-flowing the board and better than refusing. */
  top.forEach(o=>{
    ['desk','phone'].forEach(dv=>{
      const b = o[dv];
      if(!b || !b.w){ ensureBox(o, dv, home); return; }
      if(boxOk(b, o.id, dv, home)) return;
      const spot = freeSpot(b.w, b.h, dv, home);
      o[dv] = spot ? Object.assign({}, spot, {w:b.w, h:b.h}) : b;
    });
  });
  return made;
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
