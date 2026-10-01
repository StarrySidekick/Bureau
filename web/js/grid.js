import { wordOf } from './words.js';
import { clamp, ROOT } from './util.js';
import { S, dev, byId, has, childrenOf, container, cfgOf, deskOf, K, kindHas, inFront } from './model.js';

/* ------------------------------------------------------------
   4b · the grid — one coordinate space per device
   ------------------------------------------------------------
   Drawers hold {x,y,w,h} in 1-based grid cells, per device. The grid does not
   flow: an empty cell stays empty, because position is meant to carry meaning.
   Two drawers may never occupy the same cell — a move or resize that would
   overlap is refused rather than shoving a neighbour out of the way, so nothing
   you arranged ever moves without you.                                        */
/* The grid is square: a cell is as tall as it is wide. Columns are fluid, so
   the row height is measured after layout by sizeGrid() and cached here —
   nothing may assume a fixed row height. Twice the columns of the first
   version, which is what makes the smallest object half the size it was. */
/* The phone grid comes in **three sizes**, and the only number that changes is
   the column count — the width is the width, so the columns set the cell and
   the cell sets everything else:

     name     columns   cell on a 390pt phone   rows that fit
     Small       8              48.8                 ~14
     Extra       9              43.3                 ~16
     Large      10              39.0                 ~18

   Small is the default: the fewest cells and therefore the biggest ones. The
   row count is *not* stated — it is whatever fits — because stating it too
   would mean giving up the square cell, and a square cell is what makes a size
   mean something: a 2×2 drawer front is a square, a 4×1 task is a sliver four
   times as long as it is deep. Ten by a stated fourteen rows was tried for
   exactly one version and made a cell a third taller than it was wide, which
   quietly rescaled every one of those judgements. See decision 44.

   **It is per board.** A desk you keep six big drawers on and a checklist you
   keep forty lines in do not want the same grain, and the whole of what a size
   changes is how many columns *that board* has. `S.look.grid` is the app's
   default, a container may carry a `grid` of its own, and a board with nothing
   to say follows the desk it is on. Ask `colsOf(cid)`, never `GRID.phone.cols`
   — that constant is the default and nothing else. See decision 60.

   A column count is a **coordinate space**, so changing one rescales the boxes
   on that board the way a migration would — `setGridSize()` in mutations.js. */
const PHONE_GRIDS = {small:8, extra:9, large:10};
const GRID = {
  desk:  {cols:24, gap:0},
  phone: {cols:PHONE_GRIDS.small, gap:0}      // the app's default, not a board's
};
/* ---- the shelf --------------------------------------------------------
   **A shelf is one screenful of board**, and it is the unit everything else
   is counted in. On a phone it is the whole visible board — the columns the
   grid is set to, by however many whole square cells fit between the bar and
   the drawer. That is exactly what a *page* used to be, and a shelf is that
   idea given a second axis and a name.

   The **Desk** is three shelves by three, and you start on the middle one.
   Every other container is **one** shelf, with the option of more. A drawer
   is somewhere you put a handful of related things; a desk is the room they
   are all in, and only the room needs nine screens.

   On a **Mac** a shelf is still eight columns — a third of the twenty-four the
   desk board has always had — so the desk shows its whole middle *row* of
   three shelves at once, side by side, and the rows above and below are up and
   down the scroller. That is the one thing the extra width is worth spending
   on. It also means a drawer, being one shelf, is a third of the width, drawn
   at the same cell size as everything else and centred in the carcass: a shelf
   sitting in the middle of a cabinet, which is what it is.

   The pages are gone with it. A page was a window of rows onto a board that
   was as tall as it needed to be; a shelf is a window of rows *and columns*
   onto a board that is exactly nine of them. Nothing straddles a shelf on a
   phone, for the reason nothing straddled a page: half a tile on each of two
   screens is a tile you can read neither half of. See decision 141. */
/* ---- the tile — decision 272 -------------------------------------------
   Timothy: every container has a **board**, and a board is made of
   **tiles**, every one eight cells by eight. What the code calls a shelf or
   a board (one of the rectangles in `shelves`/`boards`) is a tile in the
   interface; what the interface calls a board is the whole of a container's
   inside; and the home board is the **desk**. The names in the code stayed,
   as plan did when it became flow.

   A tile is not a screen any more. A phone shows eight columns by fourteen
   rows (`viewRows()`), which is one tile and three rows of the tiles above
   and below it, and scrolls smoothly down the column rather than paging a
   tile at a time (`flows()`, now the default). So a thing may lie across the
   seam between two tiles up and down; sideways a tile is exactly the phone's
   width, and a seam there is still an edge of the screen. */
/* **Five by five since decision 274** (Timothy, 2026-09-30: "this could
   help with tiling"). The screen did not change with it: a phone still
   shows eight cells across (`VIEW_COLS`), so a tile is five of them and a
   box may be as wide as the screen (`WIDE`), lying across a seam. The desk
   starts two tiles by three, ten by fifteen. */
/* **A tile is one cell** (decision 283; Timothy, 2026-09-30: "tiles are just
   1x1 grid tiles. that's it"). A board is carved out of the carcass a cell at
   a time: holding the wood one step off the edge cuts a cell out of it, and a
   long hold on an empty cell fills it back in. Everything that counts in
   tiles (`shelves`, `boards`, `start`, `SHELF`) now counts in cells, so the
   rectangle and the list of what is carved are the board's exact shape, and a
   board can be any shape at all. A fresh desk or container is eight by
   fourteen (`FRESH`); migration 54 re-cuts every older board cell by cell, so
   nothing moves and nothing changes size. */
const TILE = 1;
const FRESH = {w:8, h:14};
/* The cells a phone screen is wide, and the widest a thing may be on either
   device. They were the tile's eight until the tile stopped being the
   screen's width. */
const VIEW_COLS = 8, WIDE = 8;
const SHELVES = 3;                   // the desk is SHELVES × SHELVES of them
const DESK_SHELF_COLS = GRID.desk.cols / SHELVES;    // eight, and 24 = 3 × 8
/* A tile taller than a screenful cannot be seen at all, so nothing derived is
   allowed to ask for one. Not the page height — that is measured — just a cap
   on what the size mapping and a type's stated phone size may claim. */
const PHONE_MAX_H = 14;
const CELL = {desk:40, phone:48};   // the cell of the board on screen, measured
/* The column width, which on both devices is now the same number as the cell.
   Kept separate because it is *measured* separately — the one caller that has
   to guess before the grid exists writes the checker squares into the grid's
   style attribute as it is built, so a board is drawn at the right scale on
   its first frame instead of flashing the CSS fallback and snapping back. */
const COLW = {desk:40, phone:48};
/* What sizeGrid() actually measures, and the only two numbers it has to: how
   wide a board is, and how much vertical room it has. Everything else about a
   board is *derived* from them and its own column count — the cell is the width
   over the columns, and the rows are the room over the cell — so the geometry
   of a board that is nowhere near the screen (a pager pane, a preview, the
   drawer you are about to drop something into) is answerable without measuring
   it. Boards differ from each other only in columns; the room is the room. */
const MEASURE = {desk:{w:0, room:0}, phone:{w:0, room:0}};

/* ---- a phone turned on its side ----------------------------------------
   Bureau is a **portrait desk**: a shelf is a screenful of a phone held the way
   a phone is held, and landscape is not a second layout.

   Measuring one anyway is what made turning the phone look like losing the
   desk. A landscape screen has about a quarter of the vertical room, so the
   shelf re-measured from fifteen rows to four — and a shelf is *also* the unit
   the window is cut from, so the middle shelf of nine became rows five to
   eight of a twelve-row space, which is a slice of the coordinate space with
   nothing in it. The board went **blank**: a giant empty checkerboard, until
   you turned the phone back. Nothing was lost, and it read exactly like
   everything being lost, which is worse than most bugs that are.

   So nothing is measured while it is on its side. The board holds the geometry
   it had and the stylesheet keeps it its own width, so the cells stay square
   and you see the top of your desk through a letterbox; turn it back and it is
   where it was. The manifest asks for portrait too, which is what an installed
   copy honours — this is what happens when it is not.

   `S.device`, not `dev()`: this is a question about the screen in your hand,
   and `dev()` answers with whichever *layout* is being edited, so a Mac editing
   the phone layout is a wide window and is not a phone on its side. And only
   once there is a measurement to hold on to, or a launch in landscape would
   never place anything at all. */
const sideways = ()=> S.device==='phone' && MEASURE.phone.w > 0
  && window.innerWidth > window.innerHeight;

/* Which board a call is about when it doesn't say: the one you are looking at. */
const hereId = ()=> (S.view==='drawer' && S.drawerId) || ROOT;
/* Small | extra | large, resolved: the board's own answer, then the desk it is
   on, then the app's. Two levels rather than one because a desk set to Large is
   a desk you want the drawers on it to match, and a drawer that has been asked
   the question directly outranks both. */
function gridKeyOf(cid){
  const id = cid==null ? hereId() : cid;
  const own = (cfgOf(id)||{}).grid;
  if(own && PHONE_GRIDS[own]) return own;
  const d = (cfgOf(deskOf(id))||{}).grid;
  if(d && PHONE_GRIDS[d]) return d;
  const app = S.look && S.look.grid;
  return PHONE_GRIDS[app] ? app : 'small';
}
/* The columns of **one shelf**, which is what a size is measured against: a
   new object may never be wider than a shelf, because a shelf is a screen.
   This is what `colsOf()` has always meant on a phone — the change is that on
   a Mac it is now a third of the board rather than all of it. */
/* ---- a board's own width and height — decision 235 --------------------
   Any board, the desk or a drawer, may say how many cells wide and tall it
   is, from two to twelve each way (`bw`, `bh` on its config). Said, it is the
   same shape on both devices, and the cell is **whatever fits**: the screen's
   width over the columns or the room over the rows, the smaller — so a tall
   narrow board is drawn with smaller cells, centred, rather than running off
   the screen. Unsaid, a board is what it was: the phone's three widths and
   as many rows as fit, capped at fourteen. Only the board's own answer counts;
   a drawer does not take the desk's, because the desk is a room and a drawer
   is a box, and they are rarely the same shape. */
/* Two to twelve across and two to twenty-four down (Timothy, 2026-09-28): a
   phone is tall, and a list board wants the length. */
const DIM_MIN = 2, DIM_MAX = 12, DIM_MAX_H = 24;
/* **Retired by decision 272**: every tile is eight by eight, so no board
   states a shape of its own. Kept, answering null, so every reader of it
   takes the plain path; migration 50 takes `bw`/`bh` off. */
function dimsOf(cid){
  if(TILE) return null;
  const id = cid==null ? hereId() : cid;
  if(id!==ROOT && innerOf(id)) return null;     // a proportional board is its tile
  const c = boardCfg(id); if(!c) return null;
  const ok = (v, mx) => Number.isInteger(+v) && +v>=DIM_MIN && +v<=mx ? +v : null;
  const w = ok(c.bw, DIM_MAX), h = ok(c.bh, DIM_MAX_H);
  return w || h ? {w, h} : null;
}
function colsOf(cid, device){
  // a tile is eight across on every board and both devices (decision 272)
  if(TILE) return TILE;
  const dm = dimsOf(cid);
  if(dm && dm.w) return dm.w;
  if((device||dev())!=='phone') return DESK_SHELF_COLS;
  return PHONE_GRIDS[gridKeyOf(cid)];
}
/* How many shelves a board is, either way. The desk is three by three; every
   other container is one by one until it is given more — `shelves` on the
   object, which is the "add another shelf" the desk's own editor writes. */
/* **Inside a container the shelf system is off.** A shelf is the desk's idea:
   the desk is three by three of them and you walk between them, because a desk
   is a room. A drawer is not a room — it is a box whose inside is exactly its
   outside times four (decision 188) — so it has no shelves of its own to be
   given or to store. What it has is *pages*, and only because a phone screen is
   smaller than some drawers: how many screenfuls the board happens to come to,
   derived, never stated. On a **Mac** the whole board is drawn at once, so
   there is exactly one of them however big the drawer is.

   Everything that walks between screenfuls — the dots in the bar, the pager,
   `shelfAt`/`setShelf` — reads this one function, so deriving it here is what
   makes a four-by-two drawer swipeable rather than silently one page with half
   its board off the end. See decision 190. */
function shelvesOf(cid, device){
  const id = cid==null ? hereId() : cid;
  const d = device || dev();
  const inner = id===ROOT ? null : innerOf(id, d);
  if(inner){
    if(d !== 'phone') return {w:1, h:1};        // a Mac draws the whole board
    // a page of a proportional board is a screenful, not a tile (274)
    const sw = VIEW_COLS, sh = Math.max(1, viewRows(d));
    return {w: Math.max(1, Math.ceil(inner.cols/sw)),
            h: Math.max(1, Math.ceil(inner.rows/sh))};
  }
  /* **The desk and every container are as many boards as you have made**
     (decision 219). A board is added by walking off the edge of the ones
     there are and pressing the plus on the empty slot, in any direction, so
     what is stored is the rectangle they span (`shelves`) and which cells of
     it are boards (`boards`). The desk was a fixed three by three, and a
     container one screen wide that grew at the bottom; both are now this. */
  return boardRect(id);
}
const PAGES_MAX = 4000;     // cells since decision 283: 90 tiles of five was 2250
/* The most boards a board may run to, either way. Nine, as the desk was: a
   limit a thumb never meets, which exists so a runaway loop cannot build a
   thousand screens. */
const SPAN = 200;  // cells since decision 283; it was 40 tiles of five
/* Where a board's rectangle and its list are kept: the desk's on its own
   config (it is not an object), everything else's on the object. */
const boardCfg = id => id===ROOT ? (S.deskCfg || (S.deskCfg = {layout:'grid', sort:null})) : byId(id);
function boardRect(id){
  const o = boardCfg(id), s = o && o.shelves;
  // a board that has never been given a shape is the fresh one (decision 283)
  if(!s) return TILE===1 ? {w:FRESH.w, h:FRESH.h} : {w:1, h:1};
  return {w:clamp(s.w||1, 1, SPAN), h:clamp(s.h||1, 1, SPAN)};
}
/* The boards of a board, as a set of "x,y". No list means every cell of the
   rectangle is one — which is every board before decision 219, and the
   compact way to store a full rectangle. Cached against the list itself,
   because `boxOk()` asks inside every loop of `freeSpot()`. */
const BOARDSETS = new WeakMap();
function boardList(id){
  const o = boardCfg(id), r = boardRect(id);
  const list = o && Array.isArray(o.boards) ? o.boards : null;
  if(!list) return null;
  let got = BOARDSETS.get(list);
  if(!got){
    got = new Set(list.filter(k=>{ const [x,y]=String(k).split(',').map(Number);
      return x>=0 && y>=0 && x<r.w && y<r.h; }));
    BOARDSETS.set(list, got);
  }
  return got.size ? got : null;
}
/* Is there a board at this cell of the rectangle? Always yes on a
   proportional container, whose pages are derived and all real. */
function isBoard(cid, x, y){
  const id = cid==null ? hereId() : cid;
  const r = shelvesOf(id);
  if(x<0 || y<0 || x>=r.w || y>=r.h) return false;
  if(id!==ROOT && innerOf(id)) return true;
  const set = boardList(id);
  return !set || set.has(x+','+y);
}
/* Every board there is, in reading order. */
function boardsOf(cid){
  const id = cid==null ? hereId() : cid, r = shelvesOf(id), out = [];
  for(let y=0; y<r.h; y++) for(let x=0; x<r.w; x++) if(isBoard(id, x, y)) out.push({x, y});
  return out;
}
/* A magic drawer holds nothing, so it has nothing to put on a second board. */
const growsNot = id => id!==ROOT && !!byId(id) && has(byId(id), 'magic');
/* **An empty slot is somewhere you can stand**, if a board is next to it:
   one step off the edge of the boards there are, never two. That is where
   the carcass is drawn with a plus on it. */
function reachable(cid, x, y){
  const id = cid==null ? hereId() : cid;
  if(isBoard(id, x, y)) return true;
  if(id!==ROOT && innerOf(id)) return false;       // a proportional board is its tile
  if(growsNot(id)) return false;
  return isBoard(id, x-1, y) || isBoard(id, x+1, y) || isBoard(id, x, y-1) || isBoard(id, x, y+1);
}
/* One step for each device: how many cells a board is on it. */
const boardStep = (id, dv) => ({w: colsOf(id, dv), h: shelfRows(dv, id)});
/* **Adding a board**, anywhere a step off the edge. To the right or below it
   is a new cell of the rectangle; to the left or above it the rectangle grows
   that way and **everything moves over by a board** — every box on it on both
   devices, the board you are standing on and the one it opens on — because a
   box is in cells counted from the top-left corner, and the corner has moved.
   Nothing changes place on the screen: it is only the numbers. */
function addBoard(cid, x, y){
  const id = cid==null ? hereId() : cid;
  const o = boardCfg(id); if(!o) return null;
  if(isBoard(id, x, y)) return {x, y};
  const r = boardRect(id);
  const sx = x<0 ? -x : 0, sy = y<0 ? -y : 0;
  const w = Math.max(r.w + sx, x + sx + 1), h = Math.max(r.h + sy, y + sy + 1);
  if(w > SPAN || h > SPAN) return null;
  const had = boardsOf(id).map(b=>(b.x+sx)+','+(b.y+sy));
  if(sx || sy) shiftBoard(id, sx, sy);
  had.push((x+sx)+','+(y+sy));
  o.shelves = {w, h};
  if(w*h===had.length) delete o.boards; else o.boards = had;
  return {x:x+sx, y:y+sy};
}
/* Everything on a board moved by whole boards, on both devices, plus where
   you are standing and where it opens. By `parent`, never `childrenOf()`: a
   sorting drawer on the board shows things that live somewhere else. */
function shiftBoard(id, sx, sy){
  ['desk','phone'].forEach(dv=>{
    const st = boardStep(id, dv);
    S.objects.forEach(k=>{
      if(!k || (k.parent||ROOT)!==id) return;
      const b = k[dv]; if(!b || !b.x) return;
      k[dv] = Object.assign({}, b, {x:b.x + sx*st.w, y:b.y + sy*st.h});
    });
  });
  if(SHELF[id]) SHELF[id] = {x:SHELF[id].x+sx, y:SHELF[id].y+sy};
  const o = boardCfg(id);
  if(o && o.start) o.start = {x:(o.start.x||0)+sx, y:(o.start.y||0)+sy};
}
/* Is anything on this board, on either device? A board is taken away only
   when it is empty, and it has to be empty on both. */
function boardHolds(id, x, y){
  return S.objects.some(k=>{
    if(!k || (k.parent||ROOT)!==id) return false;
    return ['desk','phone'].some(dv=>{
      const b = k[dv]; if(!b || !b.x || !b.w) return false;
      return covers(b, boardStep(id, dv), x, y);
    });
  });
}
/* **Every tile a box lies on**, not only the one its corner is on: since a
   thing may cross a seam (decisions 272–273) and a tile is five (274), the
   right half of an eight-wide thing is on a tile of its own, and a tile
   holding only that half is not empty. */
const covers = (b, st, x, y) =>
     Math.floor((b.x-1)/st.w) <= x && x <= Math.floor((b.x+b.w-2)/st.w)
  && Math.floor((b.y-1)/st.h) <= y && y <= Math.floor((b.y+(b.h||1)-2)/st.h);
/* Everything on a board, on either device, by id — what taking it away would
   take with it (decision 234). The same test `boardHolds()` makes. */
function onBoard(id, x, y){
  return S.objects.filter(k=>{
    if(!k || (k.parent||ROOT)!==id) return false;
    return ['desk','phone'].some(dv=>{
      const b = k[dv]; if(!b || !b.x || !b.w) return false;
      return covers(b, boardStep(id, dv), x, y);
    });
  }).map(k=>k.id);
}
/* **Taking a board away**, which only an empty one can be, and never the
   last. The rectangle then gives up any edge row or column with no board
   left in it — moving everything back by a board if that edge was the left
   or the top, the same bookkeeping as adding one. */
function removeBoard(cid, x, y){
  const id = cid==null ? hereId() : cid;
  const o = boardCfg(id); if(!o || !isBoard(id, x, y)) return false;
  const all = boardsOf(id);
  if(all.length<=1 || boardHolds(id, x, y)) return false;
  let keep = all.filter(b=>b.x!==x || b.y!==y);
  const minX = Math.min(...keep.map(b=>b.x)), minY = Math.min(...keep.map(b=>b.y));
  const maxX = Math.max(...keep.map(b=>b.x)), maxY = Math.max(...keep.map(b=>b.y));
  if(minX || minY){ shiftBoard(id, -minX, -minY); keep = keep.map(b=>({x:b.x-minX, y:b.y-minY})); }
  const w = maxX-minX+1, h = maxY-minY+1;
  o.shelves = {w, h};
  if(keep.length===w*h) delete o.boards; else o.boards = keep.map(b=>b.x+','+b.y);
  return true;
}
/* ---- a board as big as what is on it — decision 287 --------------------
   Timothy, 2026-10-01: with the smooth scroll there is no need for a board
   you carve out and fill back in; "the objects themselves are the grid".
   So a board is never shaped by hand. It is the rectangle round everything
   on it, on either device, with `MARGIN` of empty checkerboard on every side
   to put the next thing in, and never smaller than `FRESH`. Put something
   in the margin and the board grows past it; take the last thing off an edge
   and the board closes up behind it. `SPAN` is the limit.

   Called on the board being drawn at the start of every render, because a
   board's size follows from what is on it the way a box follows from
   `ensureBox()`, and every way of changing what is on a board ends in a
   render. When the left or top edge moves, every box on the board moves by
   the same number of cells (a box is counted from the top-left corner), and
   so do where you stand, where it opens, and the boxes on the undo and redo
   stacks, or an undo would put a thing back by the old numbers. The answer
   is that shift, so the render can move the scroll with it and nothing
   moves on the screen. */
const MARGIN = {w:8, h:8};
function fitBoard(cid){
  const id = cid==null ? hereId() : cid;
  const o = boardCfg(id);
  if(!o || (id!==ROOT && (!byId(id) || innerOf(id) || growsNot(id)))) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  S.objects.forEach(k=>{
    if(!k || (k.parent||ROOT)!==id || k.done || inFront(k)) return;
    ['desk','phone'].forEach(dv=>{
      const b = k[dv]; if(!b || !b.x || !b.w) return;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w - 1); y1 = Math.max(y1, b.y + (b.h||1) - 1);
    });
  });
  const r = boardRect(id);
  let w, h, sx = 0, sy = 0;
  if(x0===Infinity){ w = FRESH.w; h = FRESH.h; }
  else {
    // the margin gives way before the things do, so nothing is ever cut off
    const mx = clamp(Math.floor((SPAN - (x1-x0+1))/2), 0, MARGIN.w);
    const my = clamp(Math.floor((SPAN - (y1-y0+1))/2), 0, MARGIN.h);
    /* **The left and top only ever grow.** A thing put within the margin of
       either moves every number along; a thing taken away from them moves
       nothing, because a number that changes while it is held somewhere (a
       gesture, a pending box, the undo stack, a test) is a thing put back in
       the wrong place. The right and the bottom are counted from the corner
       already, so they follow what is on the board both ways for nothing. */
    sx = Math.max(0, mx - (x0-1)); sy = Math.max(0, my - (y0-1));
    w = Math.min(SPAN, Math.max(FRESH.w, x1 + sx + mx)); h = Math.min(SPAN, Math.max(FRESH.h, y1 + sy + my));
  }
  const same = !sx && !sy && r.w===w && r.h===h && !o.boards;
  if(same) return null;
  if(sx || sy) shiftCells(id, sx, sy);
  o.shelves = {w, h};
  delete o.boards;
  PLACED.n++;
  return {x:sx, y:sy};
}
/* The top-left corner of what is on a board on one device, or null. */
function cornerOf(id, dv){
  let x = Infinity, y = Infinity;
  S.objects.forEach(k=>{
    if(!k || (k.parent||ROOT)!==id || k.done || inFront(k)) return;
    const b = k[dv]; if(!b || !b.x || !b.w) return;
    x = Math.min(x, b.x); y = Math.min(y, b.y);
  });
  return x===Infinity ? null : {x, y};
}
/* Every board at once, at load: the one time a desk from before decision 287
   moves its numbers, before anything is drawn or held. */
function fitAll(){
  fitBoard(ROOT);
  S.objects.forEach(o=>{ if(o && has(o,'container')) fitBoard(o.id); });
}
/* Everything on a board moved by whole cells, the undo and redo stacks too. */
function shiftCells(id, sx, sy){
  const mv = b => (b && b.x) ? Object.assign({}, b, {x:b.x + sx, y:b.y + sy}) : b;
  S.objects.forEach(k=>{
    if(!k || (k.parent||ROOT)!==id) return;
    k.desk = mv(k.desk); k.phone = mv(k.phone);
  });
  /* A box on the stacks belongs to the board its object will be on when the
     box is put back: the parent the same move restores, if it restores one
     (a filing undone goes back to this board while it is in a drawer now),
     else where it is. */
  [S.undo, S.redo].forEach(stack=>(stack||[]).forEach(m=>(m.steps||[]).forEach((s, n, steps)=>{
    if(s.set && (s.set.k==='desk' || s.set.k==='phone')){
      const p = steps.find(t=>t.set && t.set.id===s.set.id && t.set.k==='parent');
      const k = byId(s.set.id);
      const home = p ? (p.set.v||ROOT) : k && (k.parent||ROOT);
      if(home===id) s.set.v = mv(s.set.v);
    } else if(s.del && s.del.o && (s.del.o.parent||ROOT)===id){
      s.del.o.desk = mv(s.del.o.desk); s.del.o.phone = mv(s.del.o.phone);
    }
  })));
  if(SHELF[id]) SHELF[id] = {x:SHELF[id].x+sx, y:SHELF[id].y+sy};
  const o = boardCfg(id);
  if(o && o.start) o.start = {x:(o.start.x||0)+sx, y:(o.start.y||0)+sy};
}
/* The boards a flow puts down, made sure of: each named cell becomes a board,
   in the order given, growing the rectangle as it has to. The cells are
   relative to `at` and the answer is where each one ended up, because adding
   one to the left or above moves the others. */
function ensureBoards(cid, cells, at){
  const id = cid==null ? hereId() : cid;
  let origin = at || {x:0, y:0};
  const out = cells.map(()=>null);
  cells.forEach((c, i)=>{
    const want = {x:origin.x + c.x, y:origin.y + c.y};
    if(isBoard(id, want.x, want.y)){ out[i] = want; return; }
    const got = addBoard(id, want.x, want.y);
    if(!got) return;
    const dx = got.x - want.x, dy = got.y - want.y;
    origin = {x:origin.x+dx, y:origin.y+dy};
    for(let j=0; j<i; j++) if(out[j]) out[j] = {x:out[j].x+dx, y:out[j].y+dy};
    out[i] = got;
  });
  return out;
}
/* A board that grows by itself: any container not sized from its tile. The
   desk grows too, but only when you ask it to. */
const growsDown = cid => cid!=null && cid!==ROOT && !innerOf(cid) && !!byId(cid);
/* **A full container adds a board under the one you are on**, under the last
   board of that column, when there is room for one. Written as a fact — the
   board is that big now — and counted in `PLACED` so the render that asked
   saves it, the same as a box ensureBox() invented. */
/* `shows`: a sorting drawer holds nothing, so nothing is ever *placed* on a
   second board of one; but it packs what it collects (decision 278), and a
   packing that has run out of room asks for a page to show the rest on. */
const GROW_ROWS = 7;
function growDown(cid, shows){
  if(!growsDown(cid) || (growsNot(cid) && !shows)) return false;
  const all = boardsOf(cid);
  if(all.length >= PAGES_MAX) return false;
  /* **A tile of one cell grows by rows** (decision 283): a page of cells
     under the whole width of the board, since one cell under the column you
     are in is never room for anything wider than a cell. Below the rectangle,
     so nothing already counted from the corner moves. */
  if(TILE===1){
    const r = boardRect(cid), xs = [...new Set(all.map(b=>b.x))];
    if(r.h + GROW_ROWS > SPAN) return false;
    for(let j=0; j<GROW_ROWS; j++) xs.forEach(x=>addBoard(cid, x, r.h + j));
    PLACED.n++;
    return true;
  }
  const at = shelfAt(cid);
  const col = isBoard(cid, at.x, at.y) ? at.x : (all[0]||{x:0}).x;
  const inCol = all.filter(b=>b.x===col);
  let y = inCol.length ? Math.max(...inCol.map(b=>b.y)) + 1 : 0;
  if(!addBoard(cid, col, y)) return false;
  PLACED.n++;
  return true;
}
/* ---- a drawer is as big inside as it is outside -----------------------
   **A container's board is its own tile, four cells to a cell.** A 2×2 drawer
   opens onto 8×8, a 1×1 onto 4×4, a 2×4 onto 8×16. Before this every drawer
   opened onto exactly one shelf whatever size it was on the desk, so a drawer
   you had deliberately made small held precisely as much as one you had made
   big, and the size you chose said nothing at all.

   It is read off the **desk** box on both devices, never the one for the
   device being drawn. A container's inside is a coordinate space and a
   coordinate space may not change shape between a phone and a Mac — the boxes
   in it are the same numbers on both, and halving the container (which is what
   `sizeOfKind()` does to put it on a phone) would otherwise halve the grid
   those numbers are measured against. The desk box is the one both devices can
   agree on.

   The desk itself is not a tile and keeps its nine shelves. */
const INNER = 4;
/* **Proportional boards are a setting, and off by default** (decision 195).
   Decision 188 made a container's board its tile times four, and a plan laid
   out in one then depended on how big somebody had made the front: the same
   board was a squeeze in a two-by-two drawer and a field in a five-by-five.
   Off, a container is what it was before 188 — `o.shelves` screenfuls, one
   unless it says otherwise — and every board is the same size to arrange on.
   `S.look.proportional` turns 188 back on; everything below it is untouched,
   because `innerOf()` answering null was always the way back to shelves. */
const proportional = () => !!(S.look && S.look.proportional);
/* How many screenfuls a container needs to hold what is already in it, off
   the boxes on both devices. Read when the setting goes off (and once, by
   migration 38, for desks that had it on without a key) so a board arranged
   at five by five is not re-placed into one shelf: that re-placing keeps
   sizes and gives up places, and a place is the thing somebody arranged.
   Twelve rows to a shelf, the short handset's, because a shelf is as tall as
   the screen is and the smaller answer is the one that holds on both. */
const SHELF_ROWS_FIT = 12;
function shelvesToHold(o, objects){
  let mx = 0, my = 0;
  (objects||[]).forEach(k=>{
    if(!k || k.parent!==o.id) return;
    ['desk','phone'].forEach(dv=>{ const b=k[dv];
      if(b && b.x && b.w){ mx=Math.max(mx, b.x+b.w-1); my=Math.max(my, b.y+b.h-1); } });
  });
  const had = o.shelves || {};
  return {w: clamp(Math.max(had.w||1, Math.ceil(mx/DESK_SHELF_COLS)), 1, SHELVES),
          h: clamp(Math.max(had.h||1, Math.ceil(my/SHELF_ROWS_FIT)), 1, SHELVES)};
}
function innerOf(cid, device){
  const id = cid==null ? hereId() : cid;
  if(id===ROOT || !proportional()) return null;
  const o = byId(id); if(!o) return null;
  const dv = device || dev();
  /* **The box for the device you are looking at**, and that is the whole rule.
     It read the *desk* box on both devices for a version, on the argument that
     a coordinate space should not change shape between them — and a container
     is deliberately **half the size on a phone** (`toPhoneSize`), so a drawer
     that looked four cells by two on a phone opened onto thirty-two by
     sixteen. "A 4×2 drawer gives you an 8×8 and another 8×8 beside it" is the
     thing being described, and it is only true of the tile you can see.

     The objects inside already store a box per device and `ensureBox()` places
     each one on the board it is going onto, so the two boards being different
     shapes costs nothing: they were never one space to begin with. See
     decision 190.

     The other device's box is the fallback, for a drawer that has only ever
     been on one board — and it is **converted**, not read across. A container
     is half the size on a phone (`toPhoneSize`), so a drawer that only has a
     phone box doubles onto the desk and one that only has a desk box halves
     onto the phone. Reading it across gives the same drawer two boards four
     times apart, which is how a drawer made on a phone came to open onto a
     single shelf however big it was. */
  const own = o[dv] && o[dv].w && o[dv].h ? o[dv] : null;
  const other = dv==='phone' ? o.desk : o.phone;
  const b = own ? own
    : (other && other.w && other.h)
      ? (dv==='phone' ? {w:Math.max(1,Math.round(other.w/2)), h:Math.max(1,Math.round(other.h/2))}
                      : {w:other.w*2, h:other.h*2})
      : null;
  if(!b) return null;                        // never placed: fall back to a shelf
  return {cols: Math.max(2, Math.round(b.w*INNER)),
          rows: Math.max(2, Math.round(b.h*INNER))};
}
/* The geometry of one board. `cid` says which; left out it is the one on the
   screen. The row height is derived from the measured width rather than read
   out of CELL, so a board with a different column count answers correctly even
   while another one is the one being displayed. */
/* The geometry of one board, and it answers two different questions at once.

   `shelfW`/`shelfH` are one **shelf** — the window you can see on a phone.
   `cols`/`rows` are the **coordinate space**, which is the shelf times the
   number of shelves this container has. A box lives in the second; a screen
   shows the first. Everything that goes wrong with this system goes wrong by
   using one where the other was meant.

   The cell is derived from the device's own width over the *desk's* columns,
   not over this board's — that is what makes a drawer's eight columns the same
   size as the desk's, rather than three times as big. */
const gridOf = (device, cid)=>{
  const d=device||dev(), shelfW=colsOf(cid, d);
  const m=MEASURE[d];
  const shelfH = shelfRows(d, cid);
  // the zoom scales the cell and nothing else (decision 274)
  let rowh = m.w ? m.w/(d==='phone' ? VIEW_COLS : GRID.desk.cols) * zoomOf(cid) : CELL[d];
  /* A board with a stated shape fits the screen both ways (decision 235):
     on a phone one shelf is the whole width and the whole room; on a Mac the
     row of boards across (at most three are drawn side by side) and the room
     of one shelf-row. The smaller cell wins. */
  if(dimsOf(cid) && m.w){
    const across = d==='phone' ? shelfW : Math.max(GRID.desk.cols, shelfW*Math.min(3, shelvesOf(cid, d).w));
    rowh = m.w/across;
    if(m.room) rowh = Math.min(rowh, m.room/shelfH);
  }
  /* A container sizes its own board from its tile; the desk keeps its shelves.
     How many screenfuls that comes to is `shelvesOf()`'s to say — one function,
     so the dots in the bar, the pager and the board itself cannot disagree. */
  const inner = innerOf(cid, d);
  const sh = shelvesOf(cid, d);
  /* The largest box (decision 272): a tile wide, and as tall as the screen
     shows, since a phone scrolls down across the seams. A phone that pages
     is back to one tile each way. */
  const maxW = WIDE, maxH = d==='phone' && !flows(d) ? shelfH : PHONE_MAX_H;
  /* A phone that scrolls draws an **empty tile's worth above and below** the
     board (decision 272), so the slot one step off the top or the bottom is
     somewhere you can scroll to and press the plus on. Not on a board that
     cannot grow. */
  const id = cid==null ? hereId() : cid;
  const pad = padded(d, id) && !inner && !growsNot(id) ? shelfH : 0;
  /* …and to the left and right (Timothy, 2026-09-29): the phone scrolls
     every way, so the slot one step off either side is somewhere you can
     scroll to as well. */
  const padX = pad ? shelfW : 0;
  return {cols: inner ? inner.cols : shelfW*sh.w,
          rows: inner ? inner.rows : shelfH*sh.h,
          shelfW, shelfH, shelves:sh, gap:GRID[d].gap, rowh, maxW, maxH, pad, padX};
};

/* ---- how tall a shelf is ----------------------------------------------
   Measured, like the cell: however many whole square cells fit in the room the
   board actually has. A **floor**, so the last row ends flush against the edge
   rather than hanging half a cell past it.

   Both devices answer now. It used to be zero on a Mac, meaning "no paging at
   all — a desk has room and a mouse has a wheel", and that is still true of
   *scrolling*: a Mac shows a whole shelf-row at once and scrolls to the rows
   above and below. But the shelf is the coordinate unit on both, so both have
   to be able to say how tall one is. On a Mac the cell is the width over the
   desk's twenty-four columns whatever board is showing, which is what makes a
   drawer's eight columns the same size as the desk's rather than three times
   as big.

   The fallback is a nominal twelve rather than zero: the geometry has to be
   answerable before the first measurement, and sizeGrid() re-renders when the
   real number turns out to be different. */
/* Fourteen since decision 197: what a Mac window and every iPhone since the X
   actually measure (fourteen or fifteen), and the height the stock boards are
   authored to. It matters most for the device you are *not* on — a plan laid
   out from a Mac places its phone boxes against this number, and at twelve a
   fourteen-row board was taken to be taller than a phone and scattered. */
/* A phone guesses fifteen since decision 204: the bar rides in the drawer
   front, so the row it took is board, and an installed iPhone measures
   fifteen where it measured fourteen. A Mac still has its bar on top. */
/* **A phone board is eight by fourteen by default** (decision 208). It was
   however many rows the screen had room for, which was fifteen on some
   iPhones and fourteen on others, so a stock board authored to fourteen had a
   spare row on one phone and not the other, and a shelf boundary that moved
   with the handset. Fourteen is now a ceiling: a screen with room for more
   gives the leftover to the wood, and one with room for fewer still gets what
   fits. *One more row* is the way to ask for every row the screen has. */
const SHELF_ROWS_GUESS = 14, PHONE_ROWS_GUESS = 15, PHONE_ROWS = 14;
const phoneCap = ()=> S.look && S.look.rows === 'fit' ? Infinity : PHONE_ROWS;
/* A tile is eight rows (decision 272); how many rows a screen shows is a
   different question, and `viewRows()` answers it. */
function shelfRows(device, cid){
  if(TILE) return TILE;
  const d=device||dev();
  const dm = dimsOf(cid);
  if(dm && dm.h) return dm.h;
  const m=MEASURE[d];
  if(!m.room || !m.w) return d==='phone' ? Math.min(PHONE_ROWS_GUESS, phoneCap()) : SHELF_ROWS_GUESS;
  const cell = m.w / (d==='phone' ? colsOf(cid, d) : GRID.desk.cols);
  const fit = Math.max(4, Math.floor(m.room / Math.max(1, cell)));
  return d==='phone' ? Math.min(fit, phoneCap()) : fit;
}
/* **How many rows the screen shows** (decision 272): on a phone as many
   whole cells as fit, at most fourteen unless *One more row* says every
   row; on a Mac as many as fit. This is what a shelf's height used to be,
   and it is now only the height of the window onto the board — what the
   lip, the drawer front and the scroller are sized from, and the tallest a
   thing may be, since a thing taller than the screen cannot be seen. */
function viewRows(device){
  const d=device||dev(), m=MEASURE[d];
  if(!m.room || !m.w) return d==='phone' ? Math.min(PHONE_ROWS_GUESS, phoneCap()) : SHELF_ROWS_GUESS;
  const cell = m.w / (d==='phone' ? VIEW_COLS : GRID.desk.cols);
  const fit = Math.max(4, Math.floor(m.room / Math.max(1, cell)));
  return d==='phone' ? Math.min(fit, phoneCap()) : fit;
}
/* Which shelf a box is on, as {x,y} in shelves. */
function shelfOfBox(b, device, cid){
  const g=gridOf(device, cid);
  return {x: clamp(Math.floor((b.x-1)/g.shelfW), 0, g.shelves.w-1),
          y: clamp(Math.floor((b.y-1)/g.shelfH), 0, g.shelves.h-1)};
}
/* A box may not straddle a shelf **where a shelf is a screen**, which is a
   phone. Half a tile on each of two screens is a tile you can read neither
   half of — the same rule a page break had, now in two axes. On a Mac the
   three shelves of a row are all on the screen at once and a tile lying across
   two of them is perfectly legible, so nothing is refused there. */
/* …and since decision 272 a phone that scrolls reads across the seam up and
   down, so only the seam sideways, which is still the screen's edge, is
   refused there. */
/* …and since the phone scrolls sideways too (2026-09-29), no seam is an edge
   of the screen any more: a thing may lie across one either way. */
const oneShelf = (b, g, device)=> flows(device) || (
     Math.floor((b.x-1)/g.shelfW) === Math.floor((b.x+b.w-2)/g.shelfW)
  && Math.floor((b.y-1)/g.shelfH) === Math.floor((b.y+b.h-2)/g.shelfH));

/* ---- which shelf you are looking at ------------------------------------
   Remembered per container, in memory, so walking into a drawer and back does
   not lose your place — and never stored, because which screen of a board you
   happened to be on is not a fact about the desk. A board you have not been on
   opens at its **middle** shelf, which for the desk is the centre of the nine
   and for everything else is the only one there is. */
const SHELF = {};
function shelfAt(cid){
  const id = cid==null ? hereId() : cid;
  const at = SHELF[id];
  /* **Where you are may be an empty slot** (decision 219): one step off the
     edge of the boards, where the carcass is drawn with a plus on it. Any
     further out, or a board that has since gone, lands on the nearest one. */
  if(at && reachable(id, at.x, at.y)) return {x:at.x, y:at.y};
  return nearestBoard(id, at || startOf(id));
}
/* Where a board opens: the one it says (`start`, which a flow writes), else
   the desk's middle board, else a container's first. */
function startOf(id){
  const o = boardCfg(id), sh = shelvesOf(id);
  if(o && o.start && isBoard(id, o.start.x, o.start.y)) return {x:o.start.x, y:o.start.y};
  if(id===ROOT){ const mid = {x:(sh.w-1)>>1, y:(sh.h-1)>>1};
    if(isBoard(id, mid.x, mid.y)) return mid; }
  /* **A board opens on what is on it** (decision 287): its top-left cell is
     the margin now, so a drawer opened there showed an empty checkerboard
     with everything in it off the side of the screen. The middle of what is
     there, then; the middle of the board when nothing is. */
  if(!innerOf(id) || id===ROOT){
    const dv = dev(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    S.objects.forEach(k=>{
      if(!k || (k.parent||ROOT)!==id || k.done || inFront(k)) return;
      const b = k[dv]; if(!b || !b.x || !b.w) return;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x+b.w-1); y1 = Math.max(y1, b.y+(b.h||1)-1);
    });
    const mid = x0===Infinity ? {x:(sh.w-1)>>1, y:(sh.h-1)>>1} : {x:((x0+x1)>>1)-1, y:((y0+y1)>>1)-1};
    if(isBoard(id, mid.x, mid.y)) return mid;
  }
  return boardsOf(id)[0] || {x:0, y:0};
}
function nearestBoard(id, p){
  const all = boardsOf(id);
  if(!all.length) return {x:0, y:0};
  return all.reduce((best, b)=>
    (Math.abs(b.x-p.x)+Math.abs(b.y-p.y) < Math.abs(best.x-p.x)+Math.abs(best.y-p.y)) ? b : best);
}
function setShelf(cid, x, y){
  const id = cid==null ? hereId() : cid;
  const to = reachable(id, x, y) ? {x, y} : nearestBoard(id, {x, y});
  const was = shelfAt(id);
  SHELF[id] = to;
  return to.x!==was.x || to.y!==was.y;
}
/* The cell the shelf you are on starts at — what a screen row has to have
   added back to become a board row, and what a board row has to have taken off
   to become a screen row. `SHELFSHIFT` in tiles.js subtracts it as it draws;
   anything reading a cell *off* the screen adds it. This is the whole of the
   shelf system and the one place to get it wrong. See decision 141. */
function shelfOrigin(cid, device){
  const g=gridOf(device, cid), at=shelfAt(cid);
  // a Mac draws its whole board, so its shift is only ever the pad (274)
  return (device||dev())!=='phone' || flows(device) ? {x: -g.padX, y: -g.pad} : {x: at.x*g.shelfW, y: at.y*g.shelfH};
}
/* **A phone board can scroll instead of paging** (decision 209). `S.look.flow`
   — unset is the rigid swipe, a shelf at a time; `'scroll'` draws the whole
   column of shelves the phone is standing in and lets the scroller carry you
   down it, the way a Mac's board has always been reached. Sideways is still
   one shelf at a time. Vertically the phone then behaves as a Mac does: the
   shift is zero, the rows are all drawn, and which shelf you are on is where
   you have scrolled to. One question, asked here, so the window, the drawn
   rows and every reader of the shift cannot disagree about it. */
/* **Always, since decision 272.** A phone is one geometry now: the column of
   tiles in a scroller fourteen rows tall. *A tile at a time* (`S.look.flow ===
   'page'`) is not a second layout any more — it is where the scroll settles,
   a whole tile centred rather than the nearest row of cells (`snapBoard()` in
   views.js). An eight-row tile paged on a fourteen-row screen was six rows of
   bare wood. */
const flows = device => (device||dev())==='phone';
const byTile = () => !!(S.look && S.look.flow==='page');
/* **Drawn with a tile's pad round it**: a phone that scrolls, since 272,
   and since decision 274 a Mac **zoomed out**, because the zoom out to every
   tile is gone and the plus on an empty slot is how a tile is added. At no
   zoom a Mac's board is what it was, starting at its own corner. */
const padded = (device, cid) => (device||dev())==='phone' ? flows(device) : zoomOf(cid) < 0.999;

/* ---- the zoom — decision 274 -------------------------------------------
   Timothy: zoom in and out of a board smoothly, rather than a fixed zoom
   out to every tile. It is **the cell's size and nothing else**: `gridOf()`
   multiplies the cell by it, so everything that measures a cell — the drag,
   the drop, the snap, the checkerboard — is measuring the real one, and the
   board is laid out again at the new size rather than magnified. The pinch
   draws a transform while the fingers are down and commits on letting go.
   Remembered per board in memory, like the tile you are on, and never
   stored: how close you are standing is not a fact about the desk. */
const ZOOM = {};
const ZOOM_MAX = 3;
const zoomOf = cid => ZOOM[cid==null ? hereId() : cid] || 1;
/* The closest and the furthest this board goes, at this screen: out as far
   as the whole of it and its pads fit, and never further in than three
   times. Furthest out is at most where it starts. */
function zoomRange(cid, device){
  const id = cid==null ? hereId() : cid, d = device || dev(), m = MEASURE[d];
  if(!m.w) return {min:1, max:ZOOM_MAX};
  const base = m.w / (d==='phone' ? VIEW_COLS : GRID.desk.cols);
  const g = gridOf(d, id);
  // with its pad, which a Mac only draws once it is zoomed out
  const pads = d==='phone' && !flows(d) ? 0 : (innerOf(id, d) || growsNot(id)) ? 0 : 1;
  const W = m.w, H = d==='phone' ? viewRows('phone')*base : (m.room || viewRows('desk')*base);
  const fit = Math.min(W / ((g.cols + 2*pads*g.shelfW)*base), H / ((g.rows + 2*pads*g.shelfH)*base));
  return {min: Math.max(0.12, Math.min(1, fit)), max: ZOOM_MAX};
}
/* **The zoom settles, as the scroll does** (Timothy, 2026-09-30): let go
   and it eases to the nearest zoom at which the screen is a whole number of
   cells across — eight at no zoom on a phone, twenty-four on a Mac — or to
   the whole board, furthest out; and the scroll's own snap then puts the
   screen's edges on the grid lines. Nearest by ratio, since a zoom is felt
   as a ratio. */
function snapZoom(cid, z){
  const id = cid==null ? hereId() : cid, r = zoomRange(id);
  const across = dev()==='phone' ? VIEW_COLS : GRID.desk.cols;
  const levels = [r.min];
  for(let n=1; n<=200; n++){ const v = across/n; if(v < r.min) break; if(v <= r.max) levels.push(v); }
  const want = Math.max(r.min, Math.min(r.max, z));
  return levels.reduce((best, v)=> Math.abs(Math.log(v/want)) < Math.abs(Math.log(best/want)) ? v : best, levels[0]);
}
function setZoom(cid, z){
  const id = cid==null ? hereId() : cid, r = zoomRange(id);
  const v = Math.max(r.min, Math.min(r.max, z));
  if(Math.abs(v-1) < 0.02) delete ZOOM[id]; else ZOOM[id] = v;
  return zoomOf(id);
}
/* **A rigid swipe** (decision 274): the board does not scroll; it follows the
   finger and a swipe moves exactly one tile, which is decision 141's paging
   given back as an option now that a tile is not the screen. The setting is
   the app's (`rigidOn`); it only does anything on a phone (`rigidSwipe`). */
const rigidOn = () => !!(S.look && S.look.flow==='rigid');
const rigidSwipe = device => (device||dev())==='phone' && rigidOn();

// Tolerate a drawer that predates x/y, or one hand-edited into nonsense.
function lay(d, device, cid){
  // an object's coordinates are in its own container's space, so that is the
  // board whose column count clamps them — never "the board on the screen"
  const g=gridOf(device, cid===undefined ? (d && d.parent) || ROOT : cid);
  const b=d[device||dev()]||{};
  /* Clamped in size to a **shelf on a phone** and to the whole board on a Mac,
     and in position to the board either way: on a phone nothing may be bigger
     than a screen, and on a Mac the row of three shelves is one screen, so a
     tile lying across two of them is legible — the asymmetry boxOk() and
     freeSpot() both state. Clamping here as well is what kept the planner
     unreachable after freeSpot() was fixed: the box said twelve and the tile
     was drawn at eight. */
  const dv2 = device||dev();
  const w=clamp(b.w||2,1,dv2==='phone'?Math.min(g.maxW, g.cols):g.cols),
        h=clamp(b.h||1,1,dv2==='phone'?Math.min(g.maxH, g.rows):g.rows);
  return {x:clamp(b.x||1,1,Math.max(1,g.cols-w+1)),
          y:clamp(b.y||1,1,Math.max(1,g.rows-h+1)), w, h};
}
function onBoards(box, g, id){
  if(id!==ROOT && innerOf(id)) return true;         // a proportional board is all board
  const x0 = Math.floor((box.x-1)/g.shelfW), x1 = Math.floor((box.x+box.w-2)/g.shelfW);
  const y0 = Math.floor((box.y-1)/g.shelfH), y1 = Math.floor((box.y+box.h-2)/g.shelfH);
  for(let y=y0; y<=y1; y++) for(let x=x0; x<=x1; x++) if(!isBoard(id, x, y)) return false;
  return true;
}
const overlaps = (a,b)=> a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h;
/* Every check below is scoped to one container's grid. Collisions only matter
   between siblings — two objects in different drawers can share coordinates,
   because they are in different coordinate spaces. */
const hasBox = (o,dv)=> !!(o && o[dv] && o[dv].w);
function boxOk(box, id, device, parentId, clear){
  const g=gridOf(device, parentId||ROOT), dv=device||dev();
  if(box.x<1 || box.y<1 || box.w<1 || box.h<1) return false;
  /* The board is **finite** now: nine shelves, or one. A box past the last of
     them is off the desk, which is the whole of "it won't fit". */
  if(box.x+box.w-1>g.cols || box.y+box.h-1>g.rows) return false;
  // nothing bigger than a screen, and nothing across the seam between two
  if(box.w>g.maxW || box.h>g.maxH) return false;
  if(dv==='phone' && !oneShelf(box, g, dv)) return false;
  /* …and nothing on a slot that is not a board (decision 219). A box on a
     phone is on one board; on a Mac it may lie across several, and every one
     of them has to be there. */
  if(!onBoards(box, g, parentId||ROOT)) return false;
  /* A **decoration** is above the board rather than in it, so collision does
     not apply to it in either direction: it may stand anywhere, including in
     front of something, and nothing has to make room for one. The board is
     still a coordinate space and a decoration still has a box in it — it
     snaps, it drags, it pages — it is only the overlap rule that lets go.
     See decision 86. */
  /* Words set **over the others** (decision 247) float the same way: a
     caption written across a picture has to be allowed to lie on it. */
  /* `clear` asks for a box nothing is standing on, a decoration included:
     what a *search* for somewhere to put a thing wants first (freeSpot), so
     a new tile is not laid down under a plant and a plant is not set down on
     a tile. A background is still under everything, which is what it is for.
     A drag still gets the rule above. */
  const floats = d => has(d,'decor') || has(d,'backdrop') || wordOf(d,'layer')==='above';
  const me = id && byId(id);
  if(me && floats(me) && !clear) return true;
  // Only objects that have actually been placed can be collided with. Without
  // this, everything unplaced reads as sitting at 1,1 and blocks the corner.
  // a thing standing in the drawer front has given up its cells (decision 252)
  return !childrenOf(container(parentId||ROOT))
    .some(d=>d.id!==id && (clear ? !has(d,'backdrop') : !floats(d)) && !inFront(d) && hasBox(d,dv)
             && overlaps(box, lay(d,device,parentId||ROOT)));
}
/* The lowest free spot, **on the shelf you are looking at first**. A board is
   nine screens now, so scanning from the top-left would put everything you
   made on a shelf you are not on and it would look exactly like nothing had
   happened — which is the bug decision 46 fixed for one screen and this is the
   same bug with more room to hide in. The shelves after it are taken nearest
   first, so a full shelf spills to the one next door rather than to a corner.

   **Null when there is no room anywhere.** That is a real answer: a shelf is a
   finite thing and an object that will not fit on one does not get made. Every
   caller has to say so rather than quietly putting it somewhere. */
/* **A shelf bounds the search on a phone and not on a Mac**, which is the same
   asymmetry `boxOk()` already states: a phone shows one shelf at a time and
   half a tile on each of two screens is a tile you can read neither half of,
   while a Mac shows a whole row of shelves at once and a tile lying across two
   is perfectly legible.

   Clamping on both made the widest face in the app unreachable. A desk shelf
   is eight columns and the planner wants twelve, so a 12x6 calendar was placed
   at eight wide and quietly drew a month grid instead — a face nobody could
   get to, failing silently, which is the shape of bug decision 141 keeps
   producing. The scan still *starts* near the shelf you are on either way:
   what changes is how far it may run from there. */
/* **A full container grows a page rather than saying no** (2026-09-23): the
   next page pops on at the bottom, which is how a drawer got longer before it
   had shelves. Only when every page there is has been looked through, so a hole
   higher up is still used first. */
function freeSpot(w,h,device,parentId,prefer){
  const spot = freeSpotIn(w,h,device,parentId,prefer);
  if(spot || !growDown(parentId)) return spot;
  return freeSpot(w,h,device,parentId,prefer);
}
function freeSpotIn(w,h,device,parentId,prefer,clearOnly){
  const dv=device||dev(), home=parentId||ROOT, g=gridOf(dv, home);
  const oneShelfOnly = dv==='phone';
  w=Math.min(w, oneShelfOnly ? g.maxW : g.cols);
  h=Math.min(h, oneShelfOnly ? g.maxH : g.rows);
  const p = prefer || shelfAt(home);
  const order=boardsOf(home).map(b=>[b.x, b.y, Math.abs(b.x-p.x)+Math.abs(b.y-p.y)]);
  /* Nearest first, and of two as near, **the one you can see** (decision
     272): on a phone the tile below, since the board is a column you scroll
     down and the tile beside you is off the screen; on a Mac the tile beside
     you, since a row of three is on the screen at once. Then below before
     above. */
  const lane = dv==='phone' ? (b => b[0]!==p.x) : (b => b[1]!==p.y);
  order.sort((a,b)=> a[2]-b[2] || lane(a)-lane(b) || (a[1]<p.y)-(b[1]<p.y) || a[1]-b[1] || a[0]-b[0]);
  /* Each tile is asked for a box whose **top row** is in it (decision 272):
     the box may run on into the tile below, which `boxOk()` checks is there. */
  /* Twice: somewhere nothing is standing at all, then somewhere only the
     floating things are (a decoration, a background), which is all a tile has
     ever had to keep clear of. */
  /* A proportional board's pages are not tiles (decision 195), so once a
     tile is a cell (283) each page is searched whole from its corner. */
  const whole = home!==ROOT && !!innerOf(home, dv);
  /* **Not out past the top or the left of what is there** (decision 287),
     while anywhere else will do: a thing put there grows the board that way
     and moves every number on it, which is for a person to choose by putting
     it there, not for a new thing to do by itself. */
  const lo = whole ? null : cornerOf(home, dv);
  const passes = (clearOnly ? [true] : [true, false]).flatMap(c => lo ? [[c, true], [c, false]] : [[c, false]]);
  /* **The cells taken, once per search** (decision 287). `boxOk()` asks every
     sibling about every candidate, and a search over a board of a few
     thousand cells did that a few thousand times for each thing placed: a
     garbage bin of two hundred things took minutes to open. The same rule
     `boxOk()` keeps, as two sets of cells, rules out nearly every candidate
     for the price of a lookup; `boxOk()` still has the last word on the few
     that are left. */
  const taken = {true:new Set(), false:new Set()};
  const floats = d => has(d,'decor') || has(d,'backdrop') || wordOf(d,'layer')==='above';
  childrenOf(container(home)).forEach(d=>{
    if(inFront(d) || !hasBox(d, dv)) return;
    const b = lay(d, dv, home), hit = [!has(d,'backdrop'), !floats(d)];
    for(let j=0; j<(b.h||1); j++) for(let i=0; i<b.w; i++){
      const k = (b.x+i)+','+(b.y+j);
      if(hit[0]) taken.true.add(k);
      if(hit[1]) taken.false.add(k);
    }
  });
  const free = (box, clear) => { const t = taken[clear];
    for(let j=0; j<box.h; j++) for(let i=0; i<box.w; i++) if(t.has((box.x+i)+','+(box.y+j))) return false;
    return true; };
  for(const [clear, inside] of passes) for(const [sx,sy] of whole ? [[0,0]] : order){
    const x0=sx*g.shelfW, y0=sy*g.shelfH;
    // the top-left cell is in this tile; the box may run on across the seam
    const lastX = whole ? g.cols-w+1 : Math.min(g.shelfW, g.cols-x0-w+1);
    const lastY = whole ? g.rows-h+1 : Math.min(g.shelfH, g.rows-y0-h+1);
    for(let y=1;y<=lastY;y++) for(let x=1;x<=lastX;x++){
      const box={x:x0+x, y:y0+y, w, h};
      if(inside && (box.x < lo.x || box.y < lo.y)) continue;
      if(!free(box, clear)) continue;
      if(boxOk(box,null,dv,home,clear)) return box;
    }
  }
  return null;
}
/* **Somewhere at random** (decision 220): every place on every board this
   size would fit, and one of them. What the spiral coin tosses for. Null on a
   board with nowhere, which the caller turns into the usual refusal. */
function randomSpot(w,h,device,parentId){
  const dv=device||dev(), home=parentId||ROOT, g=gridOf(dv, home);
  w=Math.min(w, dv==='phone' ? g.maxW : g.cols); h=Math.min(h, dv==='phone' ? g.maxH : g.rows);
  const all=[];
  boardsOf(home).forEach(b=>{
    const x0=b.x*g.shelfW, y0=b.y*g.shelfH;
    for(let y=1; y<=Math.min(g.shelfH, g.rows-y0-h+1); y++) for(let x=1; x<=Math.min(g.shelfW, g.cols-x0-w+1); x++){
      const box={x:x0+x, y:y0+y, w, h};
      if(boxOk(box, null, dv, home)) all.push(box);
    }
  });
  return all.length ? all[Math.floor(Math.random()*all.length)] : null;
}
/* ---- room for one this size, or the largest one there is room for ------
   `freeSpot` asks one question: is there a hole exactly this shape? On the
   Desk, twenty-four columns wide, the answer is nearly always yes. Inside a
   **drawer** it is eight columns wide and one tile in the middle of a row is
   enough to mean there is no six-by-four hole anywhere on a board that is
   three quarters empty — which is what "it says there is no room and there
   very obviously is" was. A person looking at that board is not asking for a
   six-by-four hole; they are asking whether the thing can go in the drawer.

   So this steps the **long side** down a cell at a time and asks again, which
   keeps the shape as long as it can and gives up the proportion before it
   gives up the object. Null only when a single cell will not fit, which is a
   board that really is full — and that is still a refusal, because an object
   with nowhere to be is worse than no object (decision 46).

   The first ask is the common case and costs exactly what it always did. */
/* **Half its size, then a new page, then smaller still** (decision 198). Once
   a full container could grow, asking `freeSpot()` first meant every object
   that did not fit at its full size grew the board instead of stepping down a
   cell — the seed's Studio drawer went to two pages to hold a timeline it had
   always held at three by three. So the step-down runs on the pages there are
   until the object is half the size it asked for, a page is added only then,
   and past that it steps down as it always did. */
function fitSpot(w,h,device,parentId,prefer){
  let a=Math.max(1,w|0), b=Math.max(1,h|0);
  const minA=Math.ceil(a/2), minB=Math.ceil(b/2);
  /* A clear spot at any size down to half, and then a new page with one on
     it, come before a spot under a decoration: asked size by size, the first
     free place at each size was under the sampler's plant, every time. */
  const clear = ()=>{ for(let c=a, r=b; ; ){
    const spot = freeSpotIn(c, r, device, parentId, prefer, true);
    if(spot) return spot;
    if(c<=minA && r<=minB) return null;
    if(c>=r && c>minA) c--; else if(r>minB) r--; else c--;
  } };
  let first = clear();
  while(!first && growDown(parentId)) first = clear();
  if(first) return first;
  let grown=false;
  for(let i=0;i<40;i++){
    const spot = grown ? freeSpot(a,b,device,parentId,prefer)
                       : freeSpotIn(a,b,device,parentId,prefer);
    if(spot) return spot;
    if(!grown && a<=minA && b<=minB){
      grown=true;
      if(growDown(parentId)){ a=Math.max(1,w|0); b=Math.max(1,h|0); }
      continue;
    }
    if(a<=1 && b<=1) return null;
    if(!grown){
      if(a>=b && a>minA) a--; else if(b>minB) b--; else a--;
    } else if(a>=b) a--; else b--;
  }
  return null;
}
/* Is there room for one of these here? The question every maker has to ask
   before it makes anything, so that "it won't fit" is said *before* an object
   exists rather than after it has nowhere to go. */
const roomFor = (w,h,device,parentId,prefer)=> !!fitSpot(w,h,device,parentId,prefer);
/* freeSpot(), but **never null**. An object that already exists has to be
   somewhere: with no box it is invisible and unreachable, which is worse than
   one sitting on top of another. So a full board puts it in the corner of the
   shelf you are on, overlapping, for you to move — the only place in the app
   that writes an overlap, and deliberately so.

   Every path that is *making* something asks `roomFor()` first and refuses
   with a message instead of reaching this. This is for the paths where the
   object is already real: a reparent, a paste, a plan stamped onto a full
   board, a shelf that got shorter when the window did. */
function anySpot(w,h,device,parentId,prefer){
  const spot = freeSpot(w,h,device,parentId,prefer);
  if(spot) return spot;
  const dv=device||dev(), home=parentId||ROOT, gg=gridOf(dv, home);
  const at = nearestBoard(home, prefer || shelfAt(home));
  const one = dv==='phone';
  return {x: at.x*gg.shelfW+1, y: at.y*gg.shelfH+1,
          w: Math.min(w, one ? gg.maxW : gg.cols),
          h: Math.min(h, one ? gg.maxH : gg.rows)};
}
const gridRows = (device,parentId)=> childrenOf(container(parentId||ROOT))
  .reduce((m,d)=>{const b=lay(d,device,parentId||ROOT);return Math.max(m,b.y+b.h-1)},0);
/* An object that has never been in a grid has no box. Give it one the first
   time it needs to be placed, rather than storing coordinates for everything. */
/* **The phone takes the size you set** (Timothy, 2026-09-28). This used to
   work out a phone size of its own — an object capped at three cells, a
   container halved — and every one of those rules was the app's guess, not a
   choice anybody made. The sizes are chosen in the Workshop now, so the phone
   uses them: a type's own phone size if it states one, otherwise its size,
   held only to the board's width (sizeOfKind) and to a screenful tall.
   `isCont` is still accepted so no caller has to change. */
function toPhoneSize(w, h, isCont){
  return [Math.max(1, w), clamp(h, 1, PHONE_MAX_H)];
}
/* A kind may also state its phone size outright, in which case the mapping
   above is only the default it started from. The type builder writes one the
   moment you touch the phone sliders — the derivation is a good guess and a
   bad rule. The cap applies to it too: a stated size is a preference about
   proportion, and three cells is the room there is to have a preference in. */
function sizeOfKind(k, device, cid){
  const [w,h] = K(k).size || [4,4];
  /* A Mac shelf is eight columns where the board used to be twenty-four, so a
     stated desk size may now be wider than a shelf — and a shelf is a screen.
     Trimmed rather than refused: the number in KINDS is a proportion, and the
     shelf is the room there is to have one in. */
  if((device||dev())!=='phone'){
    const g=gridOf('desk', cid);
    return [Math.min(w, g.maxW, g.cols), Math.min(h, g.maxH, g.rows)];
  }
  const gp = gridOf('phone', cid), cols = Math.min(gp.maxW, gp.cols);
  const p = K(k).phoneSize;
  /* A phone size somebody **stated** is what they get, up to the board: the
     three-cell cap is a rule for a size the app has to guess, and the
     Workshop is where the answer is now given outright (a magnifying glass
     seven wide is a search bar across the phone). Height keeps its cap, since
     a tile taller than a screenful cannot be seen at all. */
  if(p && p[0]) return [clamp(p[0],1,cols), clamp(p[1],1,PHONE_MAX_H)];
  const [pw,ph] = toPhoneSize(w, h, kindHas(k,'container'));
  return [Math.min(pw, cols), ph];
}
/* ---- the size a type comes in, and the sizes it goes to — decision 246 --
   A type has a **default** (`size`, above), which is what it is made at when
   there is only one answer, and a **range**, which is the sizes it is
   reasonably made at: what a thing made at random is rolled between, and
   what a box drawn with the Magic Selector is measured against when the
   picker guesses from a shape. The range is not a limit. You can drag
   anything bigger; nothing *makes* it bigger for you.

   `range` on the kind is `[[wmin,wmax],[hmin,hmax]]` in desk cells, as
   `size` is; Timothy sets them in the Workshop and they are written here.
   A kind that states none gets half to double its default, and a kind whose
   drawing *is* its proportions (anything that runs, an ornament, a
   one-cell tool) stays at its default. A `square` kind (a record) keeps its
   two sides equal. On a phone a container's range halves, the way its size
   does, and every range is cut to the board it is on. */
function rangeOfKind(k, device, cid){
  const d = K(k), [w,h] = d.size || [4,4];
  let r = d.range;
  if(!r){
    const fixed = d.act || kindHas(k,'decor') || (w===1 && h===1);
    r = fixed ? [[w,w],[h,h]]
      : [[Math.max(1, Math.ceil(w/2)), Math.min(8, w*2)], [Math.max(1, Math.ceil(h/2)), Math.min(12, h*2)]];
  }
  let [[w0,w1],[h0,h1]] = r;
  const dv = device || dev();
  // the same range on both devices, trimmed to the board below (2026-09-28)
  const gr = gridOf(dv==='phone' ? 'phone' : 'desk', cid);
  const cols = Math.min(gr.maxW, gr.cols);
  const rows = Math.min(gr.maxH, gr.rows);
  w1 = clamp(w1, 1, cols); w0 = clamp(w0, 1, w1);
  h1 = clamp(h1, 1, rows); h0 = clamp(h0, 1, h1);
  return [[w0,w1],[h0,h1]];
}
const inRange = (k, w, h, device, cid) => {
  const [[w0,w1],[h0,h1]] = rangeOfKind(k, device, cid);
  return w>=w0 && w<=w1 && h>=h0 && h<=h1;
};
// a size rolled inside the range, for a thing made at random
function randomSizeOf(k, device, cid){
  const [[w0,w1],[h0,h1]] = rangeOfKind(k, device, cid);
  const roll = (a,b) => a + Math.floor(Math.random()*(b-a+1));
  if(K(k).square){ const lo = Math.max(w0,h0), n = roll(lo, Math.max(lo, Math.min(w1,h1))); return [n, n]; }
  return [roll(w0,w1), roll(h0,h1)];
}
/* Rendering is the one thing that writes state without being a mutation:
   `ensureBox()` invents a box the first time an object appears in a layout, and
   that is a fact worth keeping. `render()` used to cover it by saving after
   every single rebuild — which at three thousand objects is 35ms of
   serialising a desk that in almost every case had not changed at all, on the
   250ms debounce, while you are dragging.

   So placement says so. `PLACED.n` goes up only when a box is actually
   invented; render() compares it either side of the build and saves for real
   when it moved, and asks storage to save only what is dirty otherwise. A
   counter rather than a call into persist.js, because a module that answers
   questions about coordinates has no business knowing what a disk is.
   See decision 64. */
const PLACED = {n:0};
/* Moving to another container is a change of **coordinate space, not of
   size**: x and y mean somewhere else there, w and h mean the same thing
   anywhere. Clearing the whole box therefore threw away the shape you had
   given the object and handed it back its type's default — a note you had
   pulled out to six cells tall came out of a drawer two cells tall, and there
   was nothing to say where the size had gone. So a box may now carry a size
   with no position: `keepSize()` writes one and this places it. */
function keepSize(o){
  ['desk','phone'].forEach(dv=>{ const b=o[dv]; o[dv] = b && b.w ? {w:b.w, h:b.h} : null; });
  // a drawer front belongs to its board, so a thing that leaves the board
  // leaves its front too (decision 252) — every reparent comes through here
  delete o.front;
}
function ensureBox(o, device, parentId){
  const dv=device||dev();
  const home = parentId||o.parent||ROOT;
  const b=o[dv];
  if(b && b.w && b.x) return b;
  /* **Not until the board has been measured.** A shelf is as tall as whatever
     fits on this screen, and until that is known the geometry is a guess — so
     placing here writes a coordinate in the wrong space, and the correction is
     a re-place, which is a shuffle of an arrangement nobody asked to shuffle.

     Null means "not placed yet" and the renderer leaves the object out for
     that one frame. The frame in question is the first one at launch, and
     sizeGrid() re-renders the moment it has a number. See decision 141. */
  if(!MEASURE[dv].w || !MEASURE[dv].room) return null;
  const [dw,dh]=sizeOfKind(o.kind, dv, home);
  /* The size it was given, if it has one, clamped to what the board it is
     arriving on can actually hold — a shelf on a phone, the whole board on a
     Mac. Boards differ in columns (decisions 48 and 60), so a ten-wide box put
     on an eight-column phone board is one freeSpot() would look for for ever
     and never find. */
  /* **A shelf, or the board, whichever is smaller.** A phone used to clamp to
     the shelf alone, on the reasonable argument that a shelf is a screen and
     nothing may be wider than one — and that was the same number as the board
     until a container's board became its own tile times four (decision 188).
     A 1×1 drawer is four columns now, and a note's phone size is a shelf
     wide, so the clamp let a ten-wide box onto a four-column board: `anySpot`
     then looked for a place for it for ever, found none, and the object was
     drawn nowhere at all. Take the min of both and it cannot happen either
     way round. */
  const gg=gridOf(dv, home), one = dv==='phone';
  const capW = one ? Math.min(gg.maxW, gg.cols) : gg.cols;
  const capH = one ? Math.min(gg.maxH, gg.rows) : gg.rows;
  const w=Math.min(b && b.w ? b.w : dw, capW);
  const h=Math.min((b && b.h) ? b.h : dh, capH);
  /* `anySpot` rather than `freeSpot`: an object being placed for the first
     time already exists, so it has to end up somewhere even on a full board.
     See the note there. */
  /* `fitSpot` rather than `freeSpot`: the same step-down `fits()` agreed to
     before the object was made, so what was promised is what arrives. */
  o[dv] = fitSpot(w, h, dv, home) || anySpot(dw, dh, dv, home);
  PLACED.n++;
  return o[dv];
}

/* ---- what is actually drawn -------------------------------------------
   A board has a coordinate space of `cols × rows` and a **screen** shows
   `shelfW × shelfH` of it — except on a Mac, where the whole board is drawn
   and scrolled rather than windowed. These two are what every renderer and
   every measurement uses; `g.cols`/`g.rows` are for the model. Getting the
   wrong one is the single easiest mistake in this file to make. */
/* A phone draws one shelf — **or the whole board, if it is smaller than one**,
   which a drawer's own grid very often is. Drawing a shelf's worth of columns
   round a four-column board would stretch four tiles across ten cells' worth
   of screen and put every one of them somewhere its box does not say. */
/* …and a phone that scrolls draws every column, with a pad either side
   (2026-09-29): it scrolls sideways the way it scrolls down. */
const drawCols = (g, device)=> (device||dev())==='phone'
  ? (flows(device) ? g.cols + 2*(g.padX||0) : Math.min(g.shelfW, g.cols)) : g.cols + 2*(g.padX||0);
/* …and on a phone that scrolls (`flows()`), the whole column: every row of the
   board, in a scroller one shelf tall. The columns stay windowed. */
/* …with the empty tile's worth above and below it (`g.pad`, decision 272). */
const drawRows = (g, device)=> (device||dev())==='phone'
  ? (flows(device) ? g.rows + 2*(g.pad||0) : Math.min(g.shelfH, g.rows)) : g.rows + 2*(g.pad||0);

/* Width of one grid column in px, measured rather than assumed — the grid is
   fluid so this changes with the window and the rail. It divides by the
   columns actually **drawn**, not by the board's whole space: on a phone the
   element is one shelf wide and dividing by twenty-four would put every tile
   at a third of its size. */
function cellW(grid,g){
  const r=grid.getBoundingClientRect(), n=drawCols(g);
  return (r.width - g.gap*(n-1))/n;
}

export { TILE, VIEW_COLS, WIDE, viewRows, byTile, rigidOn, rigidSwipe, padded, ZOOM, ZOOM_MAX, zoomOf, zoomRange, setZoom, snapZoom, GRID, PHONE_GRIDS, PHONE_MAX_H, rangeOfKind, inRange, randomSizeOf, CELL, COLW, MEASURE, sideways,
  SHELVES, DESK_SHELF_COLS, INNER, FRESH, dimsOf, DIM_MIN, DIM_MAX, DIM_MAX_H, PAGES_MAX, SPAN, isBoard, boardsOf, reachable, addBoard, removeBoard,
  ensureBoards, boardHolds, onBoard, fitBoard, fitAll, MARGIN, startOf, nearestBoard, onBoards, randomSpot, growsDown, growDown, proportional, shelvesToHold, colsOf, gridKeyOf, shelvesOf, innerOf,
  shelfRows, shelfOfBox, oneShelf, shelfAt, setShelf, shelfOrigin, SHELF, fitSpot, flows,
  gridOf, drawCols, drawRows, lay, overlaps, boxOk, freeSpot, anySpot, roomFor, gridRows, sizeOfKind, toPhoneSize,
  ensureBox, keepSize, cellW, PLACED };
