import { clamp, ROOT } from './util.js';
import { dev, childrenOf, container, K } from './model.js';

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
const GRID = {
  desk:  {cols:24, gap:0},
  phone: {cols:16, gap:0}
};
const CELL = {desk:40, phone:21};   // last measured; a sane guess until then
const gridOf = (device)=>{
  const d=device||dev();
  return {cols:GRID[d].cols, gap:GRID[d].gap, rowh:CELL[d]};
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
  // Only objects that have actually been placed can be collided with. Without
  // this, everything unplaced reads as sitting at 1,1 and blocks the corner.
  return !childrenOf(container(parentId||ROOT))
    .some(d=>d.id!==id && hasBox(d,dv) && overlaps(box, lay(d,device)));
}
// Lowest free spot in this container, scanning left-to-right then down.
function freeSpot(w,h,device,parentId){
  const g=gridOf(device);
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
   a drawer a big square. Editable per kind in the kind builder. */
const sizeOfKind = k => (K(k).size || [4,4]);
function ensureBox(o, device, parentId){
  const dv=device||dev();
  if(o[dv] && o[dv].w) return o[dv];
  const [w,h]=sizeOfKind(o.kind);
  o[dv] = freeSpot(w, h, dv, parentId||o.parent);
  return o[dv];
}

/* Width of one grid column in px, measured rather than assumed — the grid is
   fluid (repeat(cols,1fr)) so this changes with the window and the rail. */
function cellW(grid,g){
  const r=grid.getBoundingClientRect();
  return (r.width - g.gap*(g.cols-1))/g.cols;
}

export { GRID, CELL, gridOf, lay, overlaps, boxOk, freeSpot, gridRows, sizeOfKind, ensureBox, cellW };
