import { clamp, ROOT } from './util.js';
import { S, dev, childrenOf, container, cfgOf, deskOf, K, kindHas } from './model.js';

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
/* A tile taller than a screenful cannot be seen at all, so nothing derived is
   allowed to ask for one. Not the page height — that is measured — just a cap
   on what the size mapping and a type's stated phone size may claim. */
const PHONE_MAX_H = 14;
/* …and a cap on how big a *new* object is, in either direction. A note that
   arrives eight cells wide is a note that has decided the board is about it;
   three is a tile you can read from across the room and still fit two beside.
   The stated sizes in KINDS are the desk's, and this is what they come out as
   on a phone unless the type says otherwise — and then this trims that too. */
const PHONE_MAX_NEW = 3;
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
function colsOf(cid, device){
  if((device||dev())!=='phone') return GRID.desk.cols;
  return PHONE_GRIDS[gridKeyOf(cid)];
}
/* The geometry of one board. `cid` says which; left out it is the one on the
   screen. The row height is derived from the measured width rather than read
   out of CELL, so a board with a different column count answers correctly even
   while another one is the one being displayed. */
const gridOf = (device, cid)=>{
  const d=device||dev(), cols=colsOf(cid, d);
  const m=MEASURE[d];
  return {cols, gap:GRID[d].gap, rowh: m.w ? m.w/cols : CELL[d]};
};

/* ---- pages, not scrolling ---------------------------------------------
   A phone board does not scroll. It is exactly as tall as the room between
   the two shelves, and everything past that is on the **next page** — two
   fingers up and down walk through them.

   A page is not stored. `y` is still one continuous coordinate space per
   container, and a page is a window of `pageRows()` rows onto it: page 0
   is rows 1…n, page 1 is rows n+1…2n. Nothing about a box changes when it
   moves between pages, drag and drop keep working on plain arithmetic, and
   turning paging off would put the board back exactly as it is.

   Measured, like the cell: it is however many whole square cells fit between
   the bar and the shelf on this particular phone. A *floor*, so the last row
   ends flush above the shelf rather than hanging half a cell past it. 0 means
   no paging at all, which is what a Mac says: a desk has room and a mouse has
   a wheel. */
/* How many rows a board has: its room over its cell, floored, so the last row
   ends flush rather than hanging half off the bottom. Derived rather than
   stored, because it is now a fact about a *board* — a board eight columns
   across has bigger cells and therefore fewer rows than the same board at ten.
   Zero until the first measurement, and zero on a Mac, both of which mean "no
   paging at all": a desk has room and a mouse has a wheel. */
function pageRows(device, cid){
  const d=device||dev();
  if(d!=='phone') return 0;
  const m=MEASURE.phone;
  if(!m.room || !m.w) return 0;
  return Math.max(4, Math.floor(m.room / Math.max(1, m.w/colsOf(cid, d))));
}
const pageOfBox = (b, device, cid)=>{ const n=pageRows(device, cid); return n ? Math.floor((b.y-1)/n) : 0; };
const lastPage = (device,parentId)=>{ const n=pageRows(device, parentId);
  if(!n) return 0;
  return childrenOf(container(parentId||ROOT))
    .reduce((m,d)=>Math.max(m, pageOfBox(lay(d,device),device,parentId)), 0);
};
// Tolerate a drawer that predates x/y, or one hand-edited into nonsense.
function lay(d, device, cid){
  // an object's coordinates are in its own container's space, so that is the
  // board whose column count clamps them — never "the board on the screen"
  const g=gridOf(device, cid===undefined ? (d && d.parent) || ROOT : cid);
  const b=d[device||dev()]||{};
  const w=clamp(b.w||2,1,g.cols), h=clamp(b.h||1,1,40);
  return {x:clamp(b.x||1,1,g.cols-w+1), y:Math.max(1,b.y||1), w, h};
}
const overlaps = (a,b)=> a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h;
/* Every check below is scoped to one container's grid. Collisions only matter
   between siblings — two objects in different drawers can share coordinates,
   because they are in different coordinate spaces. */
const hasBox = (o,dv)=> !!(o && o[dv] && o[dv].w);
function boxOk(box, id, device, parentId){
  const g=gridOf(device, parentId||ROOT), dv=device||dev();
  if(box.x<1 || box.y<1 || box.w<1 || box.h<1 || box.x+box.w-1>g.cols) return false;
  /* Nothing may straddle a page break. A page is a screen, and half a tile on
     each of two screens is a tile you can read neither of — refusing it here
     means the drag, the resize, freeSpot() and the paste bridge all get the
     rule for free, in the one place every box already has to pass through. */
  const n=pageRows(dv, parentId||ROOT);
  if(n && (box.h>n || Math.floor((box.y-1)/n) !== Math.floor((box.y+box.h-2)/n))) return false;
  // Only objects that have actually been placed can be collided with. Without
  // this, everything unplaced reads as sitting at 1,1 and blocks the corner.
  return !childrenOf(container(parentId||ROOT))
    .some(d=>d.id!==id && hasBox(d,dv) && overlaps(box, lay(d,device,parentId||ROOT)));
}
// Lowest free spot in this container, scanning left-to-right then down.
function freeSpot(w,h,device,parentId){
  const g=gridOf(device, parentId||ROOT), n=pageRows(device, parentId||ROOT);
  if(n) h=Math.min(h,n);              // nothing taller than a page exists there
  w=Math.min(w, g.cols);
  for(let y=1;y<200;y++) for(let x=1;x<=g.cols-w+1;x++){
    const box={x,y,w,h};
    if(boxOk(box,null,device,parentId)) return box;
  }
  return {x:1,y:1,w,h};
}
const gridRows = (device,parentId)=> childrenOf(container(parentId||ROOT))
  .reduce((m,d)=>{const b=lay(d,device,parentId||ROOT);return Math.max(m,b.y+b.h-1)},0);
/* An object that has never been in a grid has no box. Give it one the first
   time it needs to be placed, rather than storing coordinates for everything. */
/* Each kind declares the size its objects start at — a task is a wide sliver,
   a drawer a big square. Editable per kind in the kind builder.

   It declares it for the *desk*. A phone is 8 columns to the desk's 24, so
   copying the number across would make a 4×1 task half a screen wide and a
   6×6 drawer three quarters of one.

   An **object** takes the whole width, because a phone is a column and the
   things in a column are rows. Its height comes across 1:1 — a phone cell
   (~39px) and a desk cell (~58px) are within a third of each other — and is
   capped, because nothing taller than a screenful can be seen at all.

   A **container** is halved instead of filled, which keeps the fraction of the
   screen it had before: two drawers across is what the phone desk looks like,
   and a book spine that fills the width is not a spine. */
function toPhoneSize(w, h, isCont){
  const half = n => Math.max(1, Math.round(n/2));
  const cap  = n => clamp(n, 1, PHONE_MAX_NEW);
  /* Both directions, and both kinds of thing. An object used to arrive at the
     full width of the board — which is right for a column of rows and wrong for
     a desk, because the first thing you make owns the screen and the second has
     nowhere to go. Three cells is a tile you can read from across the room with
     room for two more beside it, and resizing it is one drag away. */
  if(isCont) return [cap(half(w)), cap(half(h))];
  return [cap(w), cap(Math.min(PHONE_MAX_H, Math.max(1, h)))];
}
/* A kind may also state its phone size outright, in which case the mapping
   above is only the default it started from. The type builder writes one the
   moment you touch the phone sliders — the derivation is a good guess and a
   bad rule. The cap applies to it too: a stated size is a preference about
   proportion, and three cells is the room there is to have a preference in. */
function sizeOfKind(k, device, cid){
  const [w,h] = K(k).size || [4,4];
  if((device||dev())!=='phone') return [w,h];
  const cols = colsOf(cid, 'phone');
  const p = K(k).phoneSize;
  if(p && p[0]) return [clamp(Math.min(p[0], PHONE_MAX_NEW),1,cols),
                        clamp(Math.min(p[1], PHONE_MAX_NEW),1,PHONE_MAX_H)];
  const [pw,ph] = toPhoneSize(w, h, kindHas(k,'container'));
  return [Math.min(pw, cols), ph];
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
function ensureBox(o, device, parentId){
  const dv=device||dev();
  const home = parentId||o.parent||ROOT;
  if(o[dv] && o[dv].w) return o[dv];
  const [w,h]=sizeOfKind(o.kind, dv, home);
  o[dv] = freeSpot(w, h, dv, home);
  PLACED.n++;
  return o[dv];
}

/* Width of one grid column in px, measured rather than assumed — the grid is
   fluid (repeat(cols,1fr)) so this changes with the window and the rail. */
function cellW(grid,g){
  const r=grid.getBoundingClientRect();
  return (r.width - g.gap*(g.cols-1))/g.cols;
}

export { GRID, PHONE_GRIDS, PHONE_MAX_H, PHONE_MAX_NEW, CELL, COLW, MEASURE,
  colsOf, gridKeyOf, pageRows, pageOfBox, lastPage,
  gridOf, lay, overlaps, boxOk, freeSpot, gridRows, sizeOfKind, toPhoneSize, ensureBox, cellW,
  PLACED };
