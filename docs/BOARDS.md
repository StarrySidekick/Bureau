# Boards: one shape system for the desk and every container

Scope, 2026-10-01, revised the same day with Timothy's answers. **Built as decision 288 (v2.81)**, with the dead generations deleted as decision 289 (v2.83); flows stating their board is still to do. Free turned out to be decision 287 unchanged: Timothy's free board is the growing expanse with smooth scroll and zoom, so the corner-free coordinates below were not needed. The Mat is called a **Board**. Timothy asked for a board system flexible enough
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

## Timothy's three kinds (2026-10-01, second pass)

| Kind | Shape | Grows | Code |
| --- | --- | --- | --- |
| **Tiled** | a tile of w×h | by adding another w×h tile beside it | `board:{mode:'tiled', w, h}` |
| **Fixed** | one w×h tile | never | `board:{mode:'tiled', w, h, lock:true}` |
| **Free** | whatever the things on it span | as things are put down | `board:{mode:'free'}` |

Fixed is Tiled with expansion switched off, so the code has two modes and a
flag, and the interface shows three. A fresh Tiled board and a Fixed board
of the same size are the same thing until someone adds a tile.

Plus a new object, working name **Mat**: a board-shaped underlay you put down
on a Free board, which things sit on and are dragged around inside without
the board growing. See below.

Answers to the first four questions:
1. Each container **type** gets a default kind of board (table below), and
   existing containers take their type's default.
2. *When full* is a setting (Tiled only: add a tile, or refuse).
3. Cells are always square and always the same size: the desk's cell, on
   every board. A small board is centred in wood; it is never stretched.
4. Phone first. The Mac keeps its own layouts and is worked out later.

## How each kind behaves

**Tiled.** The board is a grid of tiles, each `w × h` cells, stored as the
rectangle of tiles and which ones exist (`shelves`/`boards`, which already
exist from decision 219, with the tile size per board instead of `TILE`).
A tile is added by holding the wood one step off the edge (the gesture from
decision 276). When a thing will not fit and *When full* says add, a tile is
added below the last one. Things may cross a seam between tiles.

**Fixed.** One tile, no slots drawn around it, no adding. A thing that will
not fit is refused with a toast ("Kitchen is full") and stays where it came
from. The size changes only from Board settings, and never below what is on it.

**Free.** The board is the rectangle around what is on it, with **no stored
padding**. Put a thing down past an edge and that is now the edge. The phone
still draws empty space around it to scroll into and drop on, but that space
is a view, not part of the board.

## The Mat

A Mat is a Free board's answer to "give me a defined area". It is an object
with a size, drawn as a checkerboard, that lies **under** other things the
way a Background does (decision 216; `boxOk()` already lets things sit on a
background). Because it occupies its whole rectangle, the Free board already
counts that area as board, so dragging things around on it grows nothing.

Proposed rules:
- What is on a Mat is whatever lies wholly inside its rectangle. Moving the
  Mat moves those things with it; resizing it never cuts one off.
- Things stay children of the board, not of the Mat. A Mat is not a
  container, so nothing needs opening and nothing is filed.
- Optionally it **holds its edge**: a drag inside it is clamped to it, so it
  behaves like a Fixed board inside the Free one.

## Each type's default board

| Type | Default |
| --- | --- |
| Desk | Free |
| Drawer, Workflow, Trip, World | Tiled 8×14 |
| Project and life aspect types (multi-board flows) | Tiled, tile size from the flow |
| Collage | Free |
| Inbox | Fixed 8×14 |
| Garbage bin | Fixed (it tumbles; gravity wants walls) |
| Sorting drawer, Tag, Calendar, Checklist, List, Timeline, Book types | none: they pack, list or lay out by date, so the board kind does not apply |

A type states this as `board` in `KINDS`; an object's own `board` overrides
it. Existing containers are migrated to their type's default, sized to hold
what is in them, with their contents moved to the top-left (one shift at
load, never again).

## The one thing that keeps it from breaking: no renumbering

A box is counted in cells from the board's top-left corner. Today, when the
desk grows left or up, every box on it is renumbered, along with the saved
positions in the undo stacks (`shiftCells()`). That is the most fragile code
in the board system.

- **Tiled and Fixed** grow only right and down (tiles are added there), so
  nothing is ever renumbered. If adding a tile to the left or above is
  wanted, it costs one renumbering per added tile, the decision-219 way.
- **Free** should stop having a corner. Positions become plain integers that
  may be zero or negative, and the board's edges are computed from what is
  on it each render. Putting a thing above everything else then changes
  nothing else's number. The cost: 27 places test a box with `!b.x`, which
  reads 0 as "not placed yet", and need to ask `b.x == null` instead.

## The order to build it

Each phase ends with `test/safari.mjs` and the smoke suite passing.

1. **Clear the dead generations.** No behaviour change. Delete `dimsOf()`,
   the dead `if(TILE)` branches, the proportional path (`innerOf()`,
   `INNER`, `shelvesToHold()`), and `CAMERA`'s inert code.
2. **`board` on kinds and objects, and one reader**, `boardOf(id)`. Tile
   size per board replaces the global `TILE`. Migration to each type's default.
3. **Tiled and Fixed**: drawing in wood, the add-a-tile hold, *When full*,
   the full toast.
4. **Free without a corner**: unbounded coordinates, `!b.x` audit, retire
   `shiftCells()` for Free boards.
5. **Board settings**: kind, width, height, when full; same panel on the
   desk and in a container. A setup-card question for new containers.
6. **The Mat.**
7. **Flows** state their `board`; port the recent ones.

## Still open

1. Tiled: can a tile be added left of or above the first one, or only right
   and down?
2. Mat: does moving it carry what is on it? Does a drag inside it stay
   inside it?
3. Mat name: Mat, Tray, Pad, or something else.
4. Free on the phone: how much empty space is drawn around it to drop into
   (one screen each way, as now)?
