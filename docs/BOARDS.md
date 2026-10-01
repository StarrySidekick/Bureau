# Boards: one shape system for the desk and every container

Scope, 2026-10-01. Not built. Timothy asked for a board system flexible enough
that the desk and each container can have the shape it wants, without the
next change breaking the last one.

## What Timothy asked for

- The desk stays the **growing expanse** (decision 287): put a thing down and
  the board grows round it.
- A container can have a **set size**: a board you place things into, with
  edges you can see, which can be expanded when you want more.
- Either can be either. The desk can be set to a fixed size; a container can
  be set to grow.
- Flows may break. Most are being redesigned, apart from the recent ones.

## Why it keeps breaking

`grid.js` carries five generations of "what is a board" at once, and most of
them still branch:

| Generation | What it was | State now |
| --- | --- | --- |
| Shelves (141) | desk 3×3 screens, containers 1 screen | `shelvesOf()`, `SHELF`, `shelfRows()` still route through it |
| Proportional (188, 195) | inside = front × 4 | `innerOf()`, 20 call sites; the setting is off and nothing turns it on |
| Stated size (235) | `bw`/`bh`, 2–12 | `dimsOf()` returns null; migration 50 stripped the fields |
| Tiles (272, 274, 283) | 8×8, then 5×5, then 1×1 | `TILE` is 1; 35 `if(TILE)` branches whose else is dead |
| Carved (283) / fitted (287) | a list of cells, then the content rectangle | `boards` list dropped by migration 56, but `isBoard()`/`boardList()` still read it |

Every new rule had to be threaded past the old ones, which is why "a board"
answers differently depending on which function asks. The fix is not another
layer. It is **one function that says what shape a board is**, and deleting
the generations nobody uses.

## The idea: a board is a minimum, a maximum and a margin

Every mode Timothy described is the same calculation with different numbers.
`fitBoard()` already does it: take the rectangle round what is on the board,
add a margin, clamp it between a floor and a ceiling. Today those numbers are
constants (`FRESH`, `SPAN`, `MARGIN`). Make them per board:

```js
// on S.deskCfg for the desk, on the object for a container
board: {mode:'grow'}                       // the expanse
board: {mode:'fixed', w:8, h:14}           // a set size, expanded by hand
board: {mode:'fixed', w:8, h:14, more:'rows'}  // set, adds rows when full
```

```js
// grid.js: the one reader
function shapeOf(id) → {min:{w,h}, max:{w,h}, margin:{w,h}, growsLeft}
//   grow:   min FRESH,  max SPAN,  margin MARGIN, growsLeft true
//   fixed:  min = max = {w,h},     margin 0,      growsLeft false
//   rows:   min {w,h}, max {w, SPAN}, margin {0, 0}, growsLeft false
```

`fitBoard()` becomes `clamp(content + margin, shape.min, shape.max)`. Nothing
else in the app asks what mode a board is in; it asks `shapeOf()`, the same
way appearance asks `shapeOf()` for a tile and never a type's name.

**Why "growsLeft" matters.** A box is counted in cells from the top-left
corner. Growing left or up means every number on the board changes
(`shiftCells()`, which also rewrites the undo stacks). That is the most
fragile thing in the board code. Only the expanse needs it. A fixed board
never shifts, and a board that adds rows adds them at the bottom, where
nothing already counted moves.

## What each mode does

**Grow** (the desk's default). Exactly decision 287: content plus eight
cells each side, at least 8×14, pad of empty cells drawn round it on a phone.

**Fixed** (a new container's default). The board is `w × h`, drawn as a
checkerboard inside the carcass's wood, centred when smaller than the screen
and scrolled when bigger. Nothing is placed outside it: `boxOk()` already
refuses a box off the columns or rows, so this costs nothing new.
- *Full*: `freeSpot()` finds no room. The thing is refused with a toast,
  "Kitchen is full", and stays where it was (or in the holding space).
- *Expand*: Board settings gets **Width** and **Height** steppers. Shrinking
  stops at the edge of what is on it; there is no silent eviction.
- *Range*: 2 to 24 each way (the old `DIM_MIN`/`DIM_MAX_H`), wider than the
  screen allowed, since the phone scrolls both ways now.

**Fixed, adds rows** (a setting on a fixed board, "When full: add rows").
The old container behaviour from before 287: when full it grows `GROW_ROWS`
at the bottom. `growDown()` already does this.

## Cell size on a fixed board

Recommended: **the same cell as everywhere else**, so an object is the same
size in a drawer as on the desk, and the board is centred in wood. A 5×5
drawer then reads as a small box, which is what it is. The pinch zoom
(`zoomOf()`) is still there to blow it up. The alternative, stretching the
cells to fill the screen (what decision 235 did), makes the same note a
different size in every drawer.

## The phone and the Mac

Each object stores a box per device (`desk`, `phone`). On a fixed board that
is two arrangements of one small board, and it doubles every bug surface.
Recommended for fixed boards: **one layout**, the phone's, which the Mac reads
too. The expanse can keep two for now. This is the one change with real reach
(190 references to per-device boxes), so it is its own phase and can be
skipped.

## The order to build it

Each phase ends with `test/safari.mjs` and the smoke suite passing.

1. **Clear the dead generations.** No behaviour changes. Delete `dimsOf()`,
   the `if(TILE)` else-branches, `boardList()`/the carved list, the
   proportional path (`innerOf()`, `INNER`, `shelvesToHold()`, the setting),
   and `CAMERA`'s inert code. `shelvesOf()` becomes the rectangle. This is
   most of the "it won't break later": fewer paths means fewer places a new
   rule has to be taught.
2. **`shapeOf()` and the `board` field.** `fitBoard()` reads it. Migration:
   the desk becomes `grow`; existing containers stay `grow` too, so nothing
   moves on Timothy's phone. New containers are born `fixed` 8×14.
3. **Drawing a fixed board.** Wood round the checkerboard, no pad of empty
   slots, centred, the "full" toast, the refusal on a drop.
4. **Board settings.** Size: Grows / Set size. Width and height steppers.
   When full: Stop / Add rows. Same panel on the desk and in a container.
   A setup card question for new containers: "How big is the board inside?"
5. **Flows.** A flow states its board (`board:{mode:'fixed', w, h}`) in place
   of `dims`/`boards`/`start`. The recent flows are ported; the rest are
   left to the redesign.
6. **One layout on fixed boards** (optional, last).

## Decisions for Timothy

1. **Existing containers**: leave them growing (nothing moves), or convert
   each to a fixed board the size of what is in it now?
2. **Full fixed board**: refuse with a toast (recommended), or default to
   adding rows?
3. **Cell size**: same everywhere and centred (recommended), or stretched to
   fill the screen?
4. **One layout on fixed boards**: do it, or keep the phone/Mac split?
