import { clamp, ROOT } from './util.js';
import { S, dev, byId, has, childrenOf, container, cfgOf, deskOf, K, kindHas } from './model.js';

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
const SHELVES = 3;                   // the desk is SHELVES × SHELVES of them
const DESK_SHELF_COLS = GRID.desk.cols / SHELVES;    // eight, and 24 = 3 × 8
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
/* The columns of **one shelf**, which is what a size is measured against: a
   new object may never be wider than a shelf, because a shelf is a screen.
   This is what `colsOf()` has always meant on a phone — the change is that on
   a Mac it is now a third of the board rather than all of it. */
function colsOf(cid, device){
  if((device||dev())!=='phone') return DESK_SHELF_COLS;
  return PHONE_GRIDS[gridKeyOf(cid)];
}
/* How many shelves a board is, either way. The desk is three by three; every
   other container is one by one until it is given more — `shelves` on the
   object, which is the "add another shelf" the desk's own editor writes. */
function shelvesOf(cid){
  const id = cid==null ? hereId() : cid;
  if(id===ROOT) return {w:SHELVES, h:SHELVES};
  const o = byId(id), s = o && o.shelves;
  return {w:clamp((s&&s.w)||1, 1, SHELVES), h:clamp((s&&s.h)||1, 1, SHELVES)};
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
  const d=device||dev(), shelfW=colsOf(cid, d), sh=shelvesOf(cid);
  const m=MEASURE[d];
  const rowh = m.w ? m.w/(d==='phone' ? shelfW : GRID.desk.cols) : CELL[d];
  const shelfH = shelfRows(d, cid);
  return {cols: shelfW*sh.w, rows: shelfH*sh.h,
          shelfW, shelfH, shelves:sh, gap:GRID[d].gap, rowh};
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
const SHELF_ROWS_GUESS = 12;
function shelfRows(device, cid){
  const d=device||dev();
  const m=MEASURE[d];
  if(!m.room || !m.w) return SHELF_ROWS_GUESS;
  const cell = m.w / (d==='phone' ? colsOf(cid, d) : GRID.desk.cols);
  return Math.max(4, Math.floor(m.room / Math.max(1, cell)));
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
const oneShelf = (b, g)=>
     Math.floor((b.x-1)/g.shelfW) === Math.floor((b.x+b.w-2)/g.shelfW)
  && Math.floor((b.y-1)/g.shelfH) === Math.floor((b.y+b.h-2)/g.shelfH);

/* ---- which shelf you are looking at ------------------------------------
   Remembered per container, in memory, so walking into a drawer and back does
   not lose your place — and never stored, because which screen of a board you
   happened to be on is not a fact about the desk. A board you have not been on
   opens at its **middle** shelf, which for the desk is the centre of the nine
   and for everything else is the only one there is. */
const SHELF = {};
function shelfAt(cid){
  const id = cid==null ? hereId() : cid;
  const sh = shelvesOf(id), at = SHELF[id];
  const mid = {x:(sh.w-1)>>1, y:(sh.h-1)>>1};
  if(!at) return mid;
  return {x:clamp(at.x, 0, sh.w-1), y:clamp(at.y, 0, sh.h-1)};
}
function setShelf(cid, x, y){
  const id = cid==null ? hereId() : cid;
  const sh = shelvesOf(id);
  const to = {x:clamp(x, 0, sh.w-1), y:clamp(y, 0, sh.h-1)};
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
  return {x: at.x*g.shelfW, y: at.y*g.shelfH};
}

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
  const w=clamp(b.w||2,1,dv2==='phone'?g.shelfW:g.cols),
        h=clamp(b.h||1,1,dv2==='phone'?g.shelfH:g.rows);
  return {x:clamp(b.x||1,1,Math.max(1,g.cols-w+1)),
          y:clamp(b.y||1,1,Math.max(1,g.rows-h+1)), w, h};
}
const overlaps = (a,b)=> a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h;
/* Every check below is scoped to one container's grid. Collisions only matter
   between siblings — two objects in different drawers can share coordinates,
   because they are in different coordinate spaces. */
const hasBox = (o,dv)=> !!(o && o[dv] && o[dv].w);
function boxOk(box, id, device, parentId){
  const g=gridOf(device, parentId||ROOT), dv=device||dev();
  if(box.x<1 || box.y<1 || box.w<1 || box.h<1) return false;
  /* The board is **finite** now: nine shelves, or one. A box past the last of
     them is off the desk, which is the whole of "it won't fit". */
  if(box.x+box.w-1>g.cols || box.y+box.h-1>g.rows) return false;
  // nothing bigger than a screen, and nothing across the seam between two
  if(box.w>g.shelfW || box.h>g.shelfH) return false;
  if(dv==='phone' && !oneShelf(box, g)) return false;
  /* A **decoration** is above the board rather than in it, so collision does
     not apply to it in either direction: it may stand anywhere, including in
     front of something, and nothing has to make room for one. The board is
     still a coordinate space and a decoration still has a box in it — it
     snaps, it drags, it pages — it is only the overlap rule that lets go.
     See decision 86. */
  const me = id && byId(id);
  if(me && has(me,'decor')) return true;
  // Only objects that have actually been placed can be collided with. Without
  // this, everything unplaced reads as sitting at 1,1 and blocks the corner.
  return !childrenOf(container(parentId||ROOT))
    .some(d=>d.id!==id && !has(d,'decor') && hasBox(d,dv)
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
function freeSpot(w,h,device,parentId,prefer){
  const dv=device||dev(), home=parentId||ROOT, g=gridOf(dv, home);
  const oneShelfOnly = dv==='phone';
  w=Math.min(w, oneShelfOnly ? g.shelfW : g.cols);
  h=Math.min(h, oneShelfOnly ? g.shelfH : g.rows);
  const p = prefer || shelfAt(home);
  const order=[];
  for(let sy=0; sy<g.shelves.h; sy++) for(let sx=0; sx<g.shelves.w; sx++)
    order.push([sx, sy, Math.abs(sx-p.x)+Math.abs(sy-p.y)]);
  order.sort((a,b)=> a[2]-b[2] || a[1]-b[1] || a[0]-b[0]);
  for(const [sx,sy] of order){
    const x0=sx*g.shelfW, y0=sy*g.shelfH;
    const lastX = (oneShelfOnly ? g.shelfW : g.cols-x0) - w + 1;
    const lastY = (oneShelfOnly ? g.shelfH : g.rows-y0) - h + 1;
    for(let y=1;y<=lastY;y++) for(let x=1;x<=lastX;x++){
      const box={x:x0+x, y:y0+y, w, h};
      if(boxOk(box,null,dv,home)) return box;
    }
  }
  return null;
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
function fitSpot(w,h,device,parentId,prefer){
  let a=Math.max(1,w|0), b=Math.max(1,h|0);
  for(let i=0;i<12;i++){
    const spot=freeSpot(a,b,device,parentId,prefer);
    if(spot) return spot;
    if(a<=1 && b<=1) return null;
    if(a>=b) a--; else b--;
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
  const at = prefer || shelfAt(home);
  const one = dv==='phone';
  return {x: at.x*gg.shelfW+1, y: at.y*gg.shelfH+1,
          w: Math.min(w, one ? gg.shelfW : gg.cols),
          h: Math.min(h, one ? gg.shelfH : gg.rows)};
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
  /* A Mac shelf is eight columns where the board used to be twenty-four, so a
     stated desk size may now be wider than a shelf — and a shelf is a screen.
     Trimmed rather than refused: the number in KINDS is a proportion, and the
     shelf is the room there is to have one in. */
  if((device||dev())!=='phone'){
    const g=gridOf('desk', cid);
    return [Math.min(w, g.shelfW), Math.min(h, g.shelfH)];
  }
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
/* Moving to another container is a change of **coordinate space, not of
   size**: x and y mean somewhere else there, w and h mean the same thing
   anywhere. Clearing the whole box therefore threw away the shape you had
   given the object and handed it back its type's default — a note you had
   pulled out to six cells tall came out of a drawer two cells tall, and there
   was nothing to say where the size had gone. So a box may now carry a size
   with no position: `keepSize()` writes one and this places it. */
function keepSize(o){
  ['desk','phone'].forEach(dv=>{ const b=o[dv]; o[dv] = b && b.w ? {w:b.w, h:b.h} : null; });
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
  const gg=gridOf(dv, home), one = dv==='phone';
  const w=Math.min(b && b.w ? b.w : dw, one ? gg.shelfW : gg.cols);
  const h=Math.min((b && b.h) ? b.h : dh, one ? gg.shelfH : gg.rows);
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
const drawCols = (g, device)=> (device||dev())==='phone' ? g.shelfW : g.cols;
const drawRows = (g, device)=> (device||dev())==='phone' ? g.shelfH : g.rows;

/* Width of one grid column in px, measured rather than assumed — the grid is
   fluid so this changes with the window and the rail. It divides by the
   columns actually **drawn**, not by the board's whole space: on a phone the
   element is one shelf wide and dividing by twenty-four would put every tile
   at a third of its size. */
function cellW(grid,g){
  const r=grid.getBoundingClientRect(), n=drawCols(g);
  return (r.width - g.gap*(n-1))/n;
}

export { GRID, PHONE_GRIDS, PHONE_MAX_H, PHONE_MAX_NEW, CELL, COLW, MEASURE,
  SHELVES, DESK_SHELF_COLS, colsOf, gridKeyOf, shelvesOf,
  shelfRows, shelfOfBox, shelfAt, setShelf, shelfOrigin, SHELF, fitSpot,
  gridOf, drawCols, drawRows, lay, overlaps, boxOk, freeSpot, anySpot, roomFor, gridRows, sizeOfKind, toPhoneSize,
  ensureBox, keepSize, cellW, PLACED };
