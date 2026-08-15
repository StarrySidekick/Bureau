import { clamp, ROOT } from './util.js';
import { dev, childrenOf, container, K, kindHas } from './model.js';

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
/* The phone went from 16 columns to 8, which doubles the size of a cell: at 16
   a cell was ~23px, and a 1×1 object was a stamp you could neither read nor
   reliably hit. Eight columns puts a phone cell at ~47px — near enough the
   desk's ~58 that the two grids finally describe the same sizes. Halving the
   columns halves the rows too, because a cell is square. */
const GRID = {
  desk:  {cols:24, gap:0},
  phone: {cols:8,  gap:0}
};
const CELL = {desk:40, phone:42};   // last measured; a sane guess until then
const gridOf = (device)=>{
  const d=device||dev();
  return {cols:GRID[d].cols, gap:GRID[d].gap, rowh:CELL[d]};
};

/* ---- pages, not scrolling ---------------------------------------------
   A phone board does not scroll. It is exactly as tall as the room between
   the two shelves, and everything past that is on the **next page** — two
   fingers up and down walk through them.

   A page is not stored. `y` is still one continuous coordinate space per
   container, and a page is a window of `PAGEROWS.phone` rows onto it: page 0
   is rows 1…n, page 1 is rows n+1…2n. Nothing about a box changes when it
   moves between pages, drag and drop keep working on plain arithmetic, and
   turning paging off would put the board back exactly as it is.

   Measured, like the cell size, by sizeGrid() — it is however many square
   cells fit between the shelves on this particular phone. 0 means no paging
   at all, which is what a Mac says: a desk has room and a mouse has a wheel. */
const PAGEROWS = {desk:0, phone:0};
const pageRows = device => PAGEROWS[device||dev()] || 0;
const pageOfBox = (b, device)=>{ const n=pageRows(device); return n ? Math.floor((b.y-1)/n) : 0; };
const lastPage = (device,parentId)=>{ const n=pageRows(device);
  if(!n) return 0;
  return childrenOf(container(parentId||ROOT))
    .reduce((m,d)=>Math.max(m, pageOfBox(lay(d,device),device)), 0);
};
// Tolerate a drawer that predates x/y, or one hand-edited into nonsense.
function lay(d, device){
  const g=gridOf(device), b=d[device||dev()]||{};
  const w=clamp(b.w||2,1,g.cols), h=clamp(b.h||1,1,40);
  return {x:clamp(b.x||1,1,g.cols-w+1), y:Math.max(1,b.y||1), w, h};
}
const overlaps = (a,b)=> a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h;
/* Every check below is scoped to one container's grid. Collisions only matter
   between siblings — two objects in different drawers can share coordinates,
   because they are in different coordinate spaces. */
const hasBox = (o,dv)=> !!(o && o[dv] && o[dv].w);
function boxOk(box, id, device, parentId){
  const g=gridOf(device), dv=device||dev();
  if(box.x<1 || box.y<1 || box.w<1 || box.h<1 || box.x+box.w-1>g.cols) return false;
  /* Nothing may straddle a page break. A page is a screen, and half a tile on
     each of two screens is a tile you can read neither of — refusing it here
     means the drag, the resize, freeSpot() and the paste bridge all get the
     rule for free, in the one place every box already has to pass through. */
  const n=pageRows(dv);
  if(n && (box.h>n || Math.floor((box.y-1)/n) !== Math.floor((box.y+box.h-2)/n))) return false;
  // Only objects that have actually been placed can be collided with. Without
  // this, everything unplaced reads as sitting at 1,1 and blocks the corner.
  return !childrenOf(container(parentId||ROOT))
    .some(d=>d.id!==id && hasBox(d,dv) && overlaps(box, lay(d,device)));
}
// Lowest free spot in this container, scanning left-to-right then down.
function freeSpot(w,h,device,parentId){
  const g=gridOf(device), n=pageRows(device);
  if(n) h=Math.min(h,n);              // nothing taller than a page exists there
  for(let y=1;y<200;y++) for(let x=1;x<=g.cols-w+1;x++){
    const box={x,y,w,h};
    if(boxOk(box,null,device,parentId)) return box;
  }
  return {x:1,y:1,w,h};
}
const gridRows = (device,parentId)=> childrenOf(container(parentId||ROOT))
  .reduce((m,d)=>{const b=lay(d,device);return Math.max(m,b.y+b.h-1)},0);
/* An object that has never been in a grid has no box. Give it one the first
   time it needs to be placed, rather than storing coordinates for everything. */
/* Each kind declares the size its objects start at — a task is a wide sliver,
   a drawer a big square. Editable per kind in the kind builder.

   It declares it for the *desk*. A phone is 8 columns to the desk's 24, so
   copying the number across would make a 4×1 task half a screen wide and a
   6×6 drawer three quarters of one.

   An **object** takes the whole width, because a phone is a column and the
   things in a column are rows. Its height comes across 1:1 now that a phone
   cell (~47px) and a desk cell (~58px) are within a third of each other — the
   old ×1.5 was there to buy back pixels from 23px cells and would now make a
   4-tall note taller on the phone than on the desk.

   A **container** is halved instead of filled, which keeps the fraction of the
   screen it had before: two drawers across is what the phone desk looks like,
   and a book spine that fills the width is not a spine. */
function toPhoneSize(w, h, isCont){
  const half = n => Math.max(1, Math.round(n/2));
  if(isCont) return [Math.min(GRID.phone.cols, half(w)), half(h)];
  return [GRID.phone.cols, Math.min(12, Math.max(1, h))];
}
/* A kind may also state its phone size outright, in which case the mapping
   above is only the default it started from. The type builder writes one the
   moment you touch the phone sliders — the derivation is a good guess and a
   bad rule, and "full width" is wrong for the third checklist on a screen. */
function sizeOfKind(k, device){
  const [w,h] = K(k).size || [4,4];
  if((device||dev())!=='phone') return [w,h];
  const p = K(k).phoneSize;
  if(p && p[0]) return [clamp(p[0],1,GRID.phone.cols), clamp(p[1],1,40)];
  return toPhoneSize(w, h, kindHas(k,'container'));
}
function ensureBox(o, device, parentId){
  const dv=device||dev();
  if(o[dv] && o[dv].w) return o[dv];
  const [w,h]=sizeOfKind(o.kind, dv);
  o[dv] = freeSpot(w, h, dv, parentId||o.parent);
  return o[dv];
}

/* Width of one grid column in px, measured rather than assumed — the grid is
   fluid (repeat(cols,1fr)) so this changes with the window and the rail. */
function cellW(grid,g){
  const r=grid.getBoundingClientRect();
  return (r.width - g.gap*(g.cols-1))/g.cols;
}

export { GRID, CELL, PAGEROWS, pageRows, pageOfBox, lastPage,
  gridOf, lay, overlaps, boxOk, freeSpot, gridRows, sizeOfKind, toPhoneSize, ensureBox, cellW };
