# Navigation: how a bench is moved around in

Scope, 2026-10-03. Not built yet, except the gear (decision 302). Timothy:

> *"I want to expand on the actual navigation aspect of each bench. I think
> things are a little cramped right now and I want us to think more about
> board shape and size. We should be able to have flexibility over: scroll
> type: smooth, rigid (tile by tile); zoom type: set zoom level, multiple set
> zoom levels, free zoom; tile size: 8x14, 9x15, etc., width and height;
> board layout (remember, a tile is a segment of a board): two tiles side by
> side, a long vertical strip of tiles, etc. Then what tools are available on
> the slots on the void drawer. With all this, we could for example make a
> bench that has a rigid scroll to a left tile and right tile, but not to any
> tiles up or down, and have a custom toolbar."*
>
> *"New change: the gear settings icon is just in the top right menu bar thing
> to make more room for other stuff in the void drawer."* (Built, decision 302.)

`BENCHES.md` says what a bench is and which benches matter. `BOARDS.md` says
what shape a board can be. This file is the layer between them: **how you get
around a bench once you are in it**, and what is in your hand while you do.

---

## 1. What exists today, restated

Most of the parts are already in the code. What is missing is that they do
not agree with each other, and that a bench cannot state most of them.

| Dial | What you can choose today | Stored | Who decides | The gap |
| --- | --- | --- | --- | --- |
| **Kind of board** | Free (grows round its things), Tiled (tiles of one size), Fixed (one tile) | `form` on the board | the board; a type's default | a bench cannot say it (`BOARDS.md` phase 7 is not done) |
| **Tile size** | 2 to 24 wide, 2 to 24 tall, Tiled and Fixed only | `bw`, `bh` on the board | the board | nothing but the default 8×14 lines up with the screen, so any other size makes the rigid swipe and the snap disagree with the tiles |
| **Board layout** | any set of tiles, added by holding the wood beside one | `tiles: ['0,0','1,0']` | the board; a bench's `boards` | there is no way to say "these tiles and no more": every tiled board can always grow |
| **Scroll type** | Smooth scroll (settles on cells) or Rigid swipe | `flow` in the room (`env`) | the desk, a bench | rigid moves **a screenful**, not a tile; it goes every direction, and where there is no tile that way it slides the board into the empty edge drawn round it and leaves it there. *A tile at a time* (`flow:'page'`, settle on the nearest tile) is still in the code but no longer offered |
| **Zoom** | a pinch, free, from the whole board to 3×, settling on whole cells across | in memory only, per board (`ZOOM`) | nobody: it is not a setting | no set level, no steps, no "a tile fills the screen", and every bench opens at 1× |
| **Where you arrive** | the tile a bench was laid out to open on | `start` on the board | a bench | fine as it is |
| **Bars** | showing, or tucked away | `tuck` in the room | the desk, a bench | fine as it is |
| **The drawer front** | three places a side; seven tools (glass, block, padlock, swipe switch, spool, stamp, coin), or any object standing there | `rail`, and `front` on an object | the board; a bench's `rail` | the gear took a place on every board until decision 302 |
| **The lip** | the board's name, the way back, and now the gear | nothing | nothing | it never says which tile you are on |

**The one idea that ties them together:** the tile is already the unit of
layout (a bench is authored a tile at a time). It should also be the unit of
**movement** (a rigid swipe moves one tile) and of **zoom** (one named zoom is
"a tile fills the screen"). Today only layout uses it, and movement uses the
screen instead, which is why only 8×14 works.

## 2. The four dials

Each is a setting on a **board**, so a bench sets it on the boards it lays
out, and Board settings shows it in a section called **Navigation**. One
reader, `navOf(id)`, answers for all four, the way `formOf()` answers for the
kind of board: the board's own value, then its type's, then the room's (so
the `flow` a bench already sets keeps working), then the default. Nothing
reads the stored fields directly.

### 2.1 Tile size

A tile's size only matters together with the zoom. At the zoom where **one
tile fills the screen**, the tile's size decides how big a cell is. An iPhone
15's board is about 393 by 688 points, which is 8 by 14 cells of 49 points:

| Tile | Cell at "tile" zoom | Feels like | Good for |
| --- | --- | --- | --- |
| 4×7 | 98 pt | big buttons | a bench you use one-handed, walking |
| 6×10 | 65 pt | roomy | a few big things, cards, a deck |
| 7×12 | 56 pt | comfortable | a station with four or five things |
| **8×14** | **49 pt** | **today** | the default |
| 9×15 | 44 pt | dense, still pressable; a sliver of the next tile shows below | a station with many small things |
| 9×16 | 43 pt | the same, the screen's shape exactly | the same |
| 10×17 | 39 pt | dense | a reference board you read more than press |
| 12×21 | 33 pt | very dense | an overview, a map |

Two rules fall out of the table:

1. **Keep the tile the screen's shape**, about 4 wide to 7 tall, or "a tile
   fills the screen" leaves a band of the next tile showing. A square tile
   (5×5, the 2026-09-30 trial) is a fine unit to lay things out in, but then
   the zoom should be "cells", not "tile".
2. **Below about 44 points a 1×1 thing stops being a comfortable target**
   (Apple's minimum touch size). So 9 across is about the densest a tile
   can be while a 1×1 tool or counter is still easy to press.

So "cramped" has two cures, and the dial makes both available: **more tiles**
(spread a station over two) or **a bigger tile at tile zoom** (more cells to
a tile, each a little smaller). The first is usually right on a phone.

### 2.2 Board layout

Which tiles there are, and whether more can be made.

```
Sheet       Strip down   Strip across        Rooms             Hub
 [#]          [#]        [#][#][#]        [#][#][#]            [ ]
              [#]                         [#][#][#]         [ ][*][ ]
              [#]                                              [ ]
```

The new part is **edges**: `open` (as today: the slots past the last tile are
drawn, you can move onto them, and holding the wood there makes a tile) or
`closed` (the board ends at its tiles: no slots are drawn, scrolling and
swiping stop at the last tile, and the layout can only be changed in Board
settings). A closed board of two tiles side by side **is** Timothy's example:
there is nowhere up or down to go, so nothing has to forbid going there.

That makes an explicit axis lock unnecessary on a tiled board. It is still
worth having on a **free** board (a long scroll you should only go down), as
`axes: 'both' | 'across' | 'down'`.

The Fixed kind of board is then a closed Tiled board of one tile. It stays a
kind in the interface, because "this is one fixed box" is how it is thought
of.

### 2.3 Scroll type

| Value | What it does | Today |
| --- | --- | --- |
| **Smooth** | scroll freely, settle on the nearest row and column of cells | built |
| **Settle on tiles** | scroll freely, settle on the nearest whole tile, centered | in the code (`flow:'page'`, `byTile()`), not offered |
| **Rigid** | the board follows the finger; letting go moves exactly one tile, or back | built, but by a screenful |

What changes:

- **Rigid moves one tile**, the board's own tile, and arrives with it
  centered. At tile zoom that is one screen, as now; at another zoom it is
  still one tile, so the swipe and the layout always agree.
- **It stops at a closed edge** with a small give and a bounce, rather than
  sliding onto an empty slot.
- **Settle on tiles comes back as an option.** It is the halfway house:
  the freedom of a scroll, and you always end up square on a station.

### 2.4 Zoom type

| Value | What it does |
| --- | --- |
| **Free** | pinch anywhere in the range, settle on whole cells across. Today. |
| **Steps** | the pinch clicks between named levels and settles on the nearest one |
| **Set** | no pinch: the board is shown at one level, always |

The levels are said **in the board's own terms**, not as numbers, so they
still mean the same thing on a Mac, on a bigger iPhone and after the tile
size changes:

| Level | Means |
| --- | --- |
| `cells` | the screen is 8 cells across on a phone (24 on a Mac); today's 1× |
| `tile` | one tile fills the screen |
| `row` | a row of tiles fills the width |
| `whole` | the whole board fits on the screen |

A board also says the level it **opens at** (`zoomAt`). A Rooms bench set to
**Steps: tile, whole** gets an overview for free: pinch out and every station
is on the screen at once, pinch in and you are in one. The overview *is* the
map, with no map drawn.

Two smaller choices go with it: whether pinching out past `whole` goes **up a
level** to the container it is in (today it does, everywhere), and whether a
**tap on an empty cell at `whole`** zooms into that tile.

## 3. The front and the lip

**The gear is on the lip, at the right** (decision 302). The front keeps its
six places for the board's own tools and things, so a board that carried the
default four now has a free place, and every bench's front has one more.

Tools the navigation dials would want, each a drawn object like the rest
(and each also an object a board can hold, decision 220). **New objects, so
each needs Timothy's yes first:**

| Tool | Press | Hold | Why |
| --- | --- | --- | --- |
| **Compass** | go to the tile the bench opens on | the map of stations, to jump | the way home inside a bench, as the knob is the way home out of it |
| **Loupe** | the next zoom level (tile, whole, tile) | the levels to pick from | Steps zoom with one thumb, no pinch |
| **Ribbon** (bookmark) | mark this tile; press again anywhere to come back | clear it | two stations you go between all day (the script and the shot list) |

The swipe switch (decision 274) stays the way to flip smooth and rigid.

**The lip says which tile you are on**, once tiles have names (§5): *Low Tide
· Casting*. With more than one tile it can carry the row of dots it used to
(`.shelfmark` is still in the stylesheet), lit for where you are, each a
press away.

## 4. Patterns: the dials set together

Most benches want one of five arrangements of the four dials. A **pattern**
is a preset in Board settings → Navigation that writes all four at once,
after which any dial can still be changed. They are also the vocabulary to
design a bench in: *"the Story Builder is a carousel"* says most of what
needs saying.

| Pattern | Layout | Edges | Scroll | Zoom | It is for | Like |
| --- | --- | --- | --- | --- | --- | --- |
| **Sheet** | one tile | closed | none | set: tile | one job, all of it on one screen | a clipboard |
| **Scroll** | a strip down, or a free board | closed sides | smooth, down only | set: cells | something that grows and is read in order | a ledger |
| **Carousel** | a strip across | closed | rigid, across | steps: tile, whole | stages in order | a book's spreads |
| **Rooms** | a grid of tiles | closed | rigid, both ways | steps: tile, whole | places you go between as needed | a house plan |
| **Expanse** | free | open | smooth | free | arranging, where the space is the thinking | a table |

**Hub** is Rooms in a cross, opening in the middle: the work in the middle,
what feeds it on one side and what is finished on the other (the shelved
Project Management bench is this, three across, opening on *Now*).

## 5. Stations: tiles with names

The one new idea here that is not a dial. A **station** is a tile with a name,
and optionally its own drawer front and its own Magic Selector list.

- The **lip** says it: *Low Tide · Casting*.
- A **rigid swipe** that arrives on one shows its name a moment.
- **Edge hints**: in Rigid or Settle on tiles, a faint tab at each edge of
  the screen where there is a station that way, carrying its name
  (*Storyboard ›*). Pressed, it goes there. This is what tells you a
  carousel goes on, which nothing does today.
- The **compass** and the **dots** jump to one by name.
- A **Button** can go to one: a fourth thing a Button does, `does:'go'`,
  beside make, open and switch (decision 246). That is a signpost made of an
  object that exists, rather than a new one.
- A bench names them where it lays them out: `boards:[{at:[1,0], name:'Casting', on:[…]}]`.
  Stored on the board as `stations: {'1,0': {name, rail, makes}}`.

## 6. Other features a strong bench wants

In order of how many benches want them. Each is a Bureau feature, built once
and usable on any board, never a branch on a bench's name (`BENCHES.md` §3).

1. **A bench can state its whole board** (`board:{form, bw, bh, tiles, edges, nav}`
   on a bench spec), which is `BOARDS.md` phase 7 and is what every pattern
   above depends on. Also a paste field, so Claude can build one
   (`GRAMMAR.md` §5, item 9).
2. **Stations**, §5.
3. **The pencil ledge** (new furniture, needs a yes): an optional strip one
   row tall between the board and the front, holding up to eight cells of
   things that **stay put while the board moves**: the bench's notepad, a
   timer, a counter. Today each station repeats its own *Add to this…* line
   on rows 13 and 14 because there is nowhere for one line to stay. A ledge
   costs one row of board (8×13).
4. **The lens**, already first in the `BENCHES.md` ledger: show only what
   matches, for "only what is undecided".
5. **A saved room and navigation, on its own** (`BENCHES.md` §6, question 1):
   pick "the Film bench's room" or "a carousel" for a drawer that is not a
   film. Patterns are the first half of this.

## 7. The benches we have, through this

| Bench | Today | Pattern | Front, left · right | What it is missing |
| --- | --- | --- | --- | --- |
| **Brain Dump** | an inbox in line view | Scroll | glass, stamp (*Filed*), coin · spool | the lens (only what is not filed yet); the coin makes random things, which is the opposite of emptying a head, and its place would serve the lens or the padlock better |
| **Prioritizer** | one tile, smooth, free zoom | **Sheet** | glass, block, stamp (*Done*) · lock | nothing on it needs a scroll or a zoom, and both are only ways to knock it out of place; Sheet makes it a fixed tool |
| **Short and Feature Film** | six tiles in two rows, rigid every way | **Rooms**, steps tile and whole | glass, stamp (*Approved*), spool · block | station names (Script, Casting, Storyboard, Props and wardrobe, Locations, Scenes), closed edges, the lip saying which; the first tile carries nine things and the line, and wants splitting into *Where it stands* and *Script* |
| **Brainstorm** | one tile | Sheet now; **Carousel** of two (*Out*, *Pick*) later | glass, stamp (*Keep*), coin · spool | the two halves of the bench are two moments, and a carousel would make the second a deliberate swipe; *Every idea* is 5×6 and fills fast |
| **Story Builder** | three tiles across, rigid; a swipe up or down slides it a cell into the empty edge and leaves it there | **Carousel** | glass, spool, stamp (*Canon*) · block | closed edges (Timothy's example exactly); the twelve stages are 2×4 each and already lost a word to fit, so the journey wants three stations, one act each, four stages at 4×6: five stations across (Departure, Initiation, Return, People, World) |
| **Journal** | one tile | Sheet | glass, block · lock | the Daybook (an entry that shows its day); the ledge would keep *Today…* in reach |
| *Project Management (shelved)* | three tiles across | **Hub**, opening on *Now* | | closed edges and station names would make it ready to come back |

What the table shows: **two of the seven need nothing new but closed edges**
(Story Builder, Prioritizer), **two need stations** (Film, Story Builder),
and the cramping Timothy names is on the boards that put one stage's worth of
things on a tile meant for one step (the Film's first tile, the journey).

## 8. Order to build

Each step ends with `node test/safari.mjs` (with screenshots looked at) and
the smoke blocks it touches.

1. **`navOf(id)` and the Navigation section** in Board settings, with today's
   behavior as the default: scroll type (three), zoom type and levels, opens
   at, edges. No behavior changes yet except where a board says otherwise.
2. **Rigid by the tile, and closed edges.** The swipe measures the board's
   tile; a closed board draws no pad and stops at its last tile. Story Builder
   and Film set `edges:'closed'`. This alone is Timothy's example.
3. **Zoom levels**: `tile`, `row`, `whole`, `cells`; Steps and Set; opens at.
4. **A bench states its board** (`board` on a spec, and in a paste), and the
   **patterns** as presets.
5. **Stations**: names on the lip, edge hints, the dots, a Button that goes.
6. **The benches reworked** per §7: the Story Builder as five stations, the
   Film's first tile split, the Prioritizer and Journal as sheets.
7. **The new tools** (compass, loupe, ribbon) and **the ledge**, each once
   Timothy has said yes to it.

## 9. Questions for Timothy

1. **Edges:** closed by default on a bench's board, open on a drawer you made
   yourself? Or always open unless a bench says so?
2. **Zoom levels in board terms** (cells, tile, row, whole) rather than
   numbers: is that how you think of it, or do you want a numeric level too
   (say "1.5×")?
3. **Stations:** worth naming tiles? It is the biggest new idea here and the
   one the Film and Story Builder benches most want.
4. **The three tools** (compass, loupe, ribbon) and **the pencil ledge**:
   which, if any, should be made?
5. **The Story Builder as five stations** (an act per tile): yes, or keep the
   journey on one tile and make it bigger (9×16)?
6. **Brainstorm as a carousel** (*Out*, then swipe to *Pick*)?
