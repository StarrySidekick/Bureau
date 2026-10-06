# Bureau — working notes for Claude Code

> **Read [`INTENT.md`](INTENT.md) first.** It records what this project is for
> and what Timothy wants next, in his own words, dated. Where it disagrees with
> this file about *direction* it is newer and wins; where it disagrees about
> *mechanics* — how the code works, what was decided deliberately, the
> invariants — this file wins.

Bureau is Timothy's personal to-do / note / idea / writing app. It is not a
product for other people, and design decisions should be made for one user.

The organising idea: **everything sits on a grid.** Drawers are containers on
that grid and open onto grids of their own; objects are everything else, and
what an object can do is defined by its attributes. Not files, not a feed, not a
database of undifferentiated "items". The desk *is* the app — there is no
toolbar and no sidebar, only the grid.

Comparables to keep in mind: Things 3 (for task feel), Bear (for writing feel),
Obsidian (for what to avoid — infinite nesting and file soup).

**Where it is used: an iPhone, in the installed Safari PWA** (Timothy,
2026-09-30: "I almost entirely am designing this app from my phone with a
Safari PWA… that's going to be your primary testing environment, less so
desktop and less so Chrome, for now at least"). So **WebKit is the engine a
change is checked in first**, at an iPhone's size, with touch; the Mac and
Chromium still have to work, but they are second. This matters in practice:
decision 275's bug (Safari zooming container units twice) passed every
Chromium test and was obvious on the phone. `node test/safari.mjs` is that
check; see *Running it*. When a change is about how something looks or
feels, look at its WebKit screenshots before saying it is done, and write
CSS and gestures for iOS Safari first (touch events, `-webkit-` prefixes
where Safari still wants them, safe areas, no hover-only affordances).

## Current state

A working, installable PWA in `web/`. Hand-written HTML/CSS/JS split into ES
modules (`web/js/`) and three stylesheets (`web/css/`) — still no build step, no
dependencies, no framework, no bundler. It runs on iPhone and Mac, persists to
local storage, and works offline.

Everything in the requirements list is implemented **except** sync between
devices (export/import JSON is the bridge). Images, sound and video are all
real.

**Where the last stretch of work got to (v1.80, 2026-09-22).** Five rounds in
one day, all of them living with the **camera** (decision 187 — you go to the
object where it sits). What settled out of them and is now load-bearing:
a container's board is **its own tile, four cells to a cell** (now only with
proportional boards on, decision 195), read off the box
for the device being drawn, with no shelves inside one — a board is exactly
`w×4` by `h×4`, centred if it is smaller than the screen and paged if it is
bigger (188, 190, 192); a drawer **opens onto that board flush to its own
face**, with the bar and the rail not drawn while the camera travels (192);
**full screen means the screen** (191); and **one hold means one thing** on
both kinds of board (192). Decisions 187–192 are the whole of it and are worth
reading before touching the camera, the dive, a container's board or the
reading surface. **v1.81** (decision 193) named every grid space a **board**,
made the gear open Board settings inside a container, took the chevron out of
the bar and added the **pigeonhole** — the face a one-cell-wide drawer wears.
**v1.82–1.83** (decision 194) replaced the ten stock plans with ten boards that are
each the base station for one thing (see INTENT.md, 2026-09-23), added the
**Link** and **Review** types, and let a plan's rules name the board it is put
down on. **v1.84** (decision 195) made **proportional boards a setting, off
by default** (so decisions 188–192 describe a mode, and a container is
screenfuls unless it is on), gave Film, Song, Trip, Essay or post and seven
kinds of Life drawer their board at birth, made a plan pressed on the desk
build its own drawer, and made a plan move as one onto a busy board. **v1.86**
(decision 196) built the rest of the list, **thirty-three boards** in three
lists (`sec`), made the Life drawer ask *which board* and wear a plain front,
put *Or start from a board* under the Project types, and routed every plan that
becomes a drawer through `makeFromPlan()`. **v1.87** (decision 197): boards are
**eight by fourteen**, the bottom two rows an *Add to this…* line; a paste can
lay out and fill a plan (`docs/examples/lived-in.json`, screenshotted by
`test/lived-in.mjs`); calendars have a face setting, checklists can carry their
name, spawners can file `into` a drawer, and a container can be `undated`. **v1.88** only stops a checklist line saying "Today".

**v1.89–1.93 (2026-09-23), decisions 198–203, one brief from Timothy.**
**The camera is tabled** (203): opening a note scales the tile up into the
full-screen surface in `sheet.js` and shrinks it back on close (`growSheet`/
`shrinkSheet` in motion.js); `CAMERA=false` keeps decisions 187–192's code in
place and inert, so read those as history, not as how things open. **Inside a
container, sideways is the container beside it** on the board it sits on and
up/down is its pages, a column that grows at the bottom (198). Checklist
fronts scroll with the name and add box on top; the stock boards fill their
twelve rows. A board can say what the Magic Selector makes on it (199). The
opened calendar is its face, bigger (200). The selector is violet, the deck is
one Rider-backed card, a Link is a portal (201). The habit tracker face, the
Tag on the desk and implicit tags through `tagsOf()`/`tagMatch()` (202). What
comes next is `docs/ROADMAP.md` §0zj, the brain dump first.

**v1.95 (2026-09-24), decision 204.** On a phone **the bar is in the drawer
front** either side of the knob (`.gridbar.inrail`), so a board is 8×15 on an
installed iPhone; the search is a ring button that opens a full-width field at
the top. The hold menu is a **ring of paint blobs round the finger**. The
picker leads with twelve physical things (`PRIMARY`), the old majors are
`SECONDARY` under *More types*, plans are a dropdown. The spawner is a garden
patch; a deck is face up and deals when face down; bundled public-domain
pictures live in `web/img/` (see `docs/IMAGES.md`).
**v2.00** (decision 205): *One more row* is a Board setting (8×15, the default
keeps the wood and 8×14); the tools are photographs with their moving parts
drawn over them at measured coordinates, and the clock's hands turn for the
first time. **v2.01** (decision 206): the rail's buttons are turned like the
knob, the board's name is on the top lip (`.toplip`), and the brush is gone:
the gear opens the desk's editor as a door of Settings, and a drawer's editor
at the top of its Board settings.
**v2.04** (decision 208): the drawer front holds a gear, a padlock, the knob,
a Scrabble tile (sort, and grid or list) and a magnifying glass, drawn as the
objects (`RAILART` in views.js); a phone board is at most **8×14** unless
*One more row* is on; the name on the lip is big and on the left; every
decoration is a photograph (eight new ones); and **Painting** is Image's first
subtype (`family`), hanging one of 26 Met paintings from `img/paintings/`.
**v2.05** (decision 209): *Moving down a phone board* can be **Smooth scroll**
(`S.look.flow`, `flows()` in grid.js): the column of shelves is drawn whole and
scrolls natively; sideways still pages.
**v2.06** (decision 210): a box drawn with the Magic Selector opens the
**shape ring** (`shapeRing()`/`shapeKinds()` in panels.js), the types nearest
that shape at their default size, each drawn as its miniature (212), with
*More…* for the whole picker.
Decision 211 put the drawer front the right way round: glass, letter block
(the sort, in place of the Scrabble tile), knob, padlock, gear.
**v2.11** (decision 213): Settings as Timothy arranged them in the Workshop:
Aesthetics folded into **Global Settings**, labels renamed, five settings cut
(migration 43 resets them to their defaults).
**v2.13** (decisions 215–216): a sort stays on its shelf; the letter block is
a flat square that **cycles the board's sorts on a tap** (`SORT_FACES`,
`sortCycleOf()`, per board and carried by a flow) and **swaps grid and line
view on a hold**; the glass closes the search too. Subtypes are chosen on the
ring (`VARIANTS`, `ringInto()`): a Decoration's ornaments, a Painting's
paintings, a **Background**'s fills (a new type drawn under the other tiles).
Delete sits at the ring’s lower right. **Plans are called flows** in the
interface; the code still says plan. (Since decision 295 they are called
**benches**: read "flow" in this log as an older name for a bench.)
**v2.14** (decision 217): line view stripes its paper rows in the board's two
checkerboard colours.
**v2.15** (decision 218): the Workshop's second pass. The object editor has
two doors (Look, Behaviour); the hold ring keeps what a tap cannot do; the
Time door is gone; types renamed and reordered, Sorting drawer and Recipe cut
from every picker (`isCut()`), Decoration's subtypes are Plant, Physical
Object, Painting and Window, and **Random** (`anything`) makes one of the
others. Eight new stock flows, three of them in a fourth list, *Getting work
done* (`sec:'work'`).
**v2.16** (decision 219): **boards you add**. A fresh desk is one board; one
step off the edge of the boards is an empty slot (the carcass and a plus) that
makes a board there, in any direction, on the desk and in any container
(`shelves` is the rectangle, `boards` which cells are boards; `addBoard()`,
`removeBoard()`, `isBoard()` in grid.js). Two fingers sideways inside a
container is the container beside it; one finger is its boards. Flows have no
title row and can be several boards (`boards`/`start`/`dims` on a plan;
Project Management is three across, Novel five down). Line view draws each row
as the tile at 8×1 on a striped list, which undoes 217's painting of the rows.
**v2.17** (decision 220): the drawer front's glass, block, padlock and gear
are also **Tool** objects, one cell each, plus a **spool of thread** (tap it,
then two things, and they are tied) and a **spiral coin** (one of anything,
somewhere random on the board). Tools are `ACTIVE` rows whose tap is handed to
wire.js through `TOOLS.press`; `TOOLART` in active.js draws both the objects
and the front. A board carries its own front (`rail`, three a side, Board
settings → Drawer Front), and a flow can say it. Strings pin at the top-left
corner. Migration 46 trims an old desk to the boards it uses.
**v2.18** (decision 221): a **counter is its wheels**: no tile behind them,
one wheel per height of width (`wheelsFor()`), showing the last digits of the
count, and the whole tile is one target (tap counts, hold drags).
**v2.19** (decision 222): the Link is called a **Portal**, the whole tile is
the vortex, and its name and address run round the rim (`portalWords()`); a
record has a real hole in the middle.
**v2.20** (decision 223): a portal is a circle, a square or an arch (`pshape`)
in its own colour, and the coin makes any of them.
**v2.21** (decision 224): an empty slot is heavier to swipe onto than a board
(`SLOT_PULL`, `SLOT_FAR` in motion.js), and a disc's hole is CD-sized.
**v2.22** (decision 225): a portal's vortex is stretched to its opening
(`.pwhirl`, `--pa`), not a circle turning inside it.
**v2.23** (decision 226): a portal's frame is the carcass's wood, a square
or arch fills its cells, the edge can be vines or a glow (`pedge`), and the
inside can be a vortex, a drift, a tunnel or a glimpse of the page
(`pstyle`, a screenshot from WordPress mShots).
**v2.24–2.25** (decisions 227–230): **pinching out on the desk zooms out to every
board** (`openOverview()` in views.js, `#overview`), where boards are added and
taken away, never the home board; the name at the top left opens nothing. A
counter's drum colour, figure colour and typeface (`wheelc`, `wink`, `wfont`).
And **setup cards**: a drawer, project, aspect of life, tag, text, goal,
checklist, calendar, counter, habit tracker or portal made from the picker is
put down plain, carrying `setup`, and its first tap opens a full-screen card of
questions (`setup.js`) that writes the fields the editor has. A Video made at
random is one of ten public-domain clips (`web/img/clips/`, `CLIPS` in
mutations.js), and the worker answers a ranged request out of the cache.
**v2.27** (decisions 231–235): a round portal on a long tile stays round
beside its words (`.pcirc`, `.pwords`); a habit can be **measured**
(`measure: {unit, goal, step}`, `measureOf()`); *This desk* is folded into
Board settings; a board can be taken away with things on it, into the Void
Drawer (`holdMany()`, `onBoard()`); and **every board has its own width and
height, two to twelve** (`bw`/`bh`, `dimsOf()`, `setBoardDims()`), fitted to
the screen.
**v2.28** (decisions 236–237): the **aspects of life are types** (`lf_*`,
`LIFE_ASPECTS` in model.js), each with a **shaped knob** (`kshape`, masks in
chrome.css), its own front and its flow; **Workflow** is a Drawer subtype
(`wf_*`); the life flows were rebuilt from Timothy's notes, each with setup
questions (`ASPECT_STEPS`, `sref` markers); migration 47; a drawer of several
boards pinches out to them; boards run to 24 tall. **v2.29** (decision 238): every
project flow is a type (`pj_*`, `PROJECT_TYPES`), a film is its departments
(`FILM_DEPARTMENTS`), and the project flows were rebuilt.
**v2.31** (decision 239): a **List** type and `list` face, the checklist
generalised to any object: every kind inside, one line each, and a tap on a
line opens that thing (`data-open`). The stock flows' `LIST()` drawers wear it.
**v2.32–2.35** (decisions 240–243): **the fifteen** (`MASTERS` in model.js),
Timothy's master categories, lead the picker in two rows and fill the ring
on two rings (seven that hold things inside, eight that do not outside)
instead of the nearest shapes, unless a board names its own types; every
type sits inside one, and the multi-member ones are `m_*` category kinds. A
decoration is pressed by its traced outline (`hit` in decor.js, from
`scripts/decor-hits.mjs`), on locked boards too. An achievement is a task you
did (sliver, no box, gilt, `past`). The **Button** (`does`: make, open,
switch) replaces the Control and the Spawner in the pickers, wears one of ten
photographed clothing buttons (`bimg`), and wider is the photograph and a line.
**v2.36–2.43** (decisions 244–246): one of anything is random all the way
through (`roll()` in mutations.js: type from the fifteen, look, words from
`data/texts.json`, sounds, a size); a record has a `vinyl` colour and a
printed label so it visibly turns; and every type has a **range** of sizes
beside its default (`rangeOfKind()`, `randomSizeOf()`, `inRange()` in
grid.js), edited in the Workshop's Sizes tab. **The Workshop's snapshot is
made by `scripts/workshop-snapshot.mjs`**: rerun it and splice its JSON into
the page's `#shipped` script whenever menus, types, sizes or flows change.
The **Bureau Workshop** artifact (https://claude.ai/artifact/4TjyQZ5xcuxCYFgfnRm76k)
holds Timothy's own rearrangement of every menu, type, size and flow: read its
`workshop/state` document before reorganising menus or types, or setting sizes.
The **Bureau Scope** artifact (https://claude.ai/artifact/MjuzPyN2CXcdYmN4MRxqJY,
2026-09-28) holds the knob proposal for each aspect of life and the verbs for
each flow, with Timothy's answers in its `answers` collection (one document per
card, `{key, value}`): read it before building life knobs, aspect subtypes or
reworking the flows.

**v2.44–2.45** (decision 247): **the words.** A paragraph taller than a page
runs on to the next one (`splitToFit()` in tiles.js). Every written object has
a **Words** door: twenty-two fields (typeface, ink, paper or none, weight,
case, spacing, alignment, face and page sizes, what the face shows, halo,
layer, margins, a drop capital, ten page layouts), read through `wordOf()` and
drawn by `wordStyle()` in `words.js`, with type and desk defaults in
`S.look.words` and `-` meaning "the plain default". `md()` draws tables, code,
strikes, highlights, pictures, pull quotes (`.pullq`, never `.pull`, which is
the knob), callouts and `+++` page breaks; a formatting strip sits over both
editing surfaces.

**v2.46** (decision 248): **every type's size is the Workshop's**
(`WORKSHOP_SIZES` in model.js, applied after every type is built; `phone:null`
means the same size as on a Mac, with nothing halved or capped),
and on a phone the reader is sized from the keyboard-free height (`--rvh`,
`--kbh` in boot.js) with a 6px inset, so the keyboard comes up over the page.

**v2.48** (decisions 249–254): a board of a stated shape is laid out like
the default one (name on the lip, full drawer front) and migration 48 turns
off the orphaned *One more row*; video and audio loop unless told to stop
(`loopOf()`); **the page wears the face** (`faceLook()` in tiles.js reads the
tile's paper, border, typeface and ink off the board, the Words door still
winning); **six places in the drawer front** hold any object (`front` on the
object, `inFront()`, drawn by `railSide()`/`railThing()`); a drop on a
collecting calendar's day no longer flies into it; and **compound objects**,
types made of several grouped, wired objects (`COMPOUNDS`, `makeCompound()`),
with a counter that can read another object (`countOf()`). The scope for
compounds is `docs/COMPOUNDS.md`.

**v2.49** (decisions 255–258): the Workshop's ring (Schedule, Rename, Edit Look,
Edit Behavior; no Edit) and Settings (Depth inside Global Settings, Your Things
heading About, Testing cut); a phone scroll clears the home strip; a list's
name is a 17px tab (`.cltab`); a video keeps its first frame as its poster
(`keepStill()`); the coin makes backgrounds; and **the notepad** (`notepad`,
`guessKind()`), a ruled line that makes what it reads as and puts it where
`intoOf()` says: `into`, else **a drawer tied to it with string**, else below
itself. The Button has no line; a list's front add box is off by default
(`addbox:'show'`), and the **Quick list** compound is a notepad tied to a list.

**v2.51** (decisions 259–267): Rename on the ring is one field
(`renameBubble()`); raised bands clear the spine's title; the random is random
all the way through (achievements, decks, tags, typefaces, knob shapes,
compounds from the coin; a random Text holds nothing); **Picture is one
object** (the `image` kind, among the fifteen); the notepad's rules are its
line's pitch, it has a gum colour, and a tap writes while a hold carries it;
an **instrument's hold is the ring**, its settings the head of Behaviour, which
now shows the object big; **Counter is a family** (`m_counter`: Ticker and
Progress bar) that can count to a `goal` and do what `atGoal` says there
(`reachedGoal()`); the **Habit tracker is a compound** (`cp_habit`); nine
Fabergé and porcelain plants; and a corked, clear-glass jar.
**v2.52** (decision 268): Random, Telegram and Album are cut (`CUT_KINDS`;
`familyList()` drops a cut type, so no category screen or ring offers one).
**v2.53** (decisions 269–271): **the goal is the Card** (`card`, paper,
`playcard` shape, `back`, `suit`; migration 49), drawn by `cardFace()` in
active.js, opening full screen as itself (`openCard()`, `S.cardId`); two
dropped together gather into a **deck**, whose press can shuffle, deal or open
(`deckTap`) and whose ring has Open. A thing whose `tug` is `open` goes into
the drawer it is tied to when pressed (`tugOf()`). And **a custom look drawn
by hand** on a front, a spine or a card: `paint.js`, strokes in `o.art`, the
painter at `#paint`, its filters and metals in index.html.
**v2.54** (decision 272): **a board is tiles, every one 8×8.** The old
"board" is a **tile** in the interface (the code still says shelf/board:
`TILE`, `boardsOf()`, `addBoard()`), a container's inside is its **board**,
and the home board is the **desk**. A tile is not a screen: `viewRows()` is
the 8×14 an iPhone shows (a tile and three rows of each neighbour), things
may lie across a seam up and down (`maxH`, `oneShelf()` refuses only the
sideways seam), a phone always scrolls the column with an empty tile's
worth drawn above and below (`g.pad`), a stopped scroll snaps to the cells,
or to a whole tile with *A tile at a time* (`snapBoard()`, `byTile()`), and
arriving centres the tile (`tileTop()`). Stated board
shapes and the 9/10-column grids are retired; migration 50 re-cuts old
boards into tiles without moving anything.
**v2.55** (decision 273): **the phone scrolls every way.** Every column is
drawn with a tile's pad either side (`g.padX`), one finger pans natively both
ways, the snap and the centring are both ways (`tileLeft()`, `tileUnder()`),
the pager is only two fingers sideways inside a container, and a thing may
cross any seam.

**v2.56** (decision 274): **tiles are five by five** (`TILE`), the screen
still eight cells across (`VIEW_COLS`, `WIDE`), a fresh desk two tiles by
three (migration 51 re-cuts old boards, moving nothing); a **rigid swipe**
option (`S.look.flow==='rigid'`, one tile per swipe, read in views.js) and
the **swipe switch** tool (`tswipe`, `swipe` in the drawer front); **the
board's own zoom** (`zoomOf()`/`setZoom()` in grid.js, a pinch or trackpad
pinch, committed by `zoomCommit()`), which replaces the zoom out to every
tile: far out is the whole board with a plus on each slot and a cross on
each tile but the home one, and further out inside a container goes up a
level; a Mac zoomed out is drawn with the pad of slots round it too (`padded()`); and a
board may give **each tile its own checkerboard** (`tilepaper:'each'`).

**v2.61** (decision 275): the zoom is a **transform on each thing**, not CSS
`zoom`, because Safari zooms container units twice (knobs, names and rims
came out far too big); it **settles** on a zoom where the screen is whole
cells across (`snapZoom()`), then the scroll on the cells; the crosses are
gone for a faint **minus on an empty tile** and a pressable **Tiles map** in
Board settings; a slot is plain wood with a faint thick plus, unlocked only;
and a new tile's squares **click into place** (`tileArrives()`). WebKit can
be installed in the container to check a Safari question (see 275).
**v2.63** (decision 276): no plus and no minus; **holding an empty slot makes
a tile there** and holding a tile's middle cell long takes it away
(`tileHere()`/`tileAway()` in wire.js).
**v2.64** (decision 277), an overnight pass in WebKit: a tap's trailing click
no longer lands on what the tap put under the finger (`tapEcho()`); every
`:hover` is inside `@media (hover:hover)`; a plain drawer front is a
`1fr auto 1fr` grid so a two-line name clears the knob; timeline labels take
the lane with room; a new Quote shows its name; a tick is undoable, with
Undo on its toast; makers place through
`fitSpot()` as `fits()` promised; and `smoke.mjs` runs to the end again
(`holdTile()`).
**v2.65** (decision 278): a **sorting drawer packs itself** (`flowSorted()`),
reading and writing no box on what it collects, and a packed board steps sizes
down rather than stacking things in the corner.
**v2.66** (decision 279): the hold ring is kept on screen by its measured
labels (`ringReach()`), and a disclosure's note is not shouted.
**v2.67** (decision 280): a sorting drawer is **packed, not sorted**
(`packs` in the grid builder), so its things can still be carried out; a move
there pushes no empty undo; a dropped echo still closes the ring; a
pigeonhole packs a sorting drawer's miniature; a timeline's end labels sit
inside the tile.
**v2.68** (decision 281): **American English** in the interface (migration 52
respells the stock flows); a darker reader veil on a phone; the hold ring's
hole holds the thing held; names in thin tiles hyphenate and keep their
room; three stylesheet leaks into miniatures closed; `fitSpot()` finds a clear
spot before one under a decoration (migration 53); a full sorting drawer grows
a page; the pager's picture is scrolled where the board is.
**v2.69** (decision 282): **the bars tuck away** on a phone: a flick down on
the drawer front hides it and the top lip (`S.look.tuck`, `setTuck()` in
views.js), leaving a faint floating knob; a flick down on it or a hold brings
them back.
**v2.70** (decision 283): **a tile is one cell** (`TILE = 1`); a board is
carved out of the carcass a cell at a time (hold the wood beside it; a long
hold on an empty cell fills it back); a fresh desk or container is 8×14
(`FRESH`); migration 54 re-cuts old boards cell by cell, moving nothing; the
cut is drawn as wooden walls and shadow (`carveEdges()`, `.carve`).
**v2.71** (decision 284): **the grammar** (`docs/GRAMMAR.md`,
`scripts/grammar.mjs`) and three paste fixes. **v2.72** (decision 285):
**the garbage bin**. Delete files a thing in a real container (`BIN`), a wire
wastebasket whose board always tumbles; `isGone()` keeps what is in it (and
in a drawer thrown away whole) out of Today, search and every sorting drawer;
hold one for Put Back or Delete for Good, hold the bin to Empty it.
**v2.74** (decision 286): **the inbox and copper pipes**. A container that
makes *whatever it reads as* is an inbox (`isInbox()`); each line leaves by
the pipe tied to it that carries its kind (`pipeFor()`), or waits; Sort sends
what waits. A pipe leads to the drawer it is tied to (`pipeTo()`), a drop on
it files there (`data-pipe`), a tap goes there. The Brain Dump flow is an
inbox and four pipes (`from`/`into` on a flow; migration 55).
**v2.76–2.80** (decision 287): **a board is as big as what is on it.** Nothing is
carved: `fitBoard()` makes it the rectangle round its things plus `MARGIN`
(8) empty cells each side, at least `FRESH`, every render and at boot
(`fitAll()`). The right and bottom follow what is there both ways; **the
left and top only grow**, shifting every box, `SHELF`, `start`, the undo
stacks and the scroll together when something is put within the margin
there, and `freeSpot()` keeps new things out of that margin. **Locked, it is
a showcase**: wood, with the checkerboard only under things and walls round
them (`showcaseOf()`, `.showcase`), taking back decision 192's half that
the lock is not the surface. Migration 56 drops the carved lists.
**v2.81–2.82** (decision 288): **free, tiled and fixed boards.** `formOf(id)` in
grid.js is the one reader (`form`, `bw`, `bh`, `full` on a board's config or
its type). The desk is free (decision 287); a container is tiled 8×14 by
default, more tiles of the same size laid by holding the wood beside it
(`tiles`, `addTile()`, `fitTiles()`); fixed is one tile and refuses what will
not fit; an inbox and the bin are fixed. Board settings → Kind of board. And
the **Board** object (`mat`), a checkerboard underlay that carries what lies
on it (`carriesOf()`, `travelWith()`). Scope in `docs/BOARDS.md`.
**v2.83** (decision 289): the proportional mode, a board's stated shape
(235) and every dead `if(TILE)` branch are deleted; `colsOf()`/`shelfRows()`
answer `TILE`. Read decisions 188–195 as history.
**v2.84** (decision 290): no carved walls round a board; the checkerboard
meets the wood.
**v2.85** (decision 291): locked, a board sits on a drawn wooden table
(`--table`, `--table-grain`) instead of the carcass.
**v2.86** (decision 292): **benches** and **the rubber stamp**. A bench is a
flow that brings its whole environment with it; the scope, five proposed,
and the ledger of features they share are `docs/BENCHES.md`, which is where
"what now" is read from. The stamp (`tstamp`, also `stamp` in the drawer
front) is the first feature through it: press it, then press things, and
each carries an impression (`stamps: [{w, d, ink}]`, a record, Lift in the
editor) until the stamp is pressed again (`S.stamping`); `@stamp` is a rule.
**v2.87–2.88** (decision 293): **the room and zones, and three benches.** A
container carrying `env` is a bench: it overrides the desk's settings one
key at a time (`ENV_KEYS`), inherited downward. **Read those keys only with
`setting(k)` and write them only with `setSetting(k, v)`**, never `S.look.k`
(model.js; `envSync()` at the top of `render()`); an aesthetic set by a bench
brings its own board. Board settings → Bench makes and edits one. A **zone**
(`zone`, `writes`) gives what is dropped in it a priority, an effort or an
exclusive tag (`zoneDrop()`), and a new thing never lands in one. Built:
the Brain Dump, the Prioritizer (`wf_prioritizer`) and the Film benches;
flows carry `env` and `stamp`; migration 57.
**v2.89** (decision 294): **the notepad replaces the garden.** Every flow's
*Add to this…* line, `MAKES()`, the type seeds and (migration 58) every
garden already on a desk or in a saved flow are notepads; the museum shows
no cut types.
**v2.90–2.91** (decision 295): **flows are benches, and most are shelved.** Every
"flow" and "workflow" in the interface says **bench** (the Workflow type is
the Bench, the Flows door is Benches); the code keeps `plan`, `workflow` and
`wf_*`. Only `BENCH_READY` (Brain Dump, Prioritizer, Short Film, Feature
Film) is offered; every other stock bench, and a type there only to hold one,
is **shelved** (`isShelved()`, `isShelvedPlan()` in model.js): hidden from
pickers, setup cards, the coin and the Benches door, never deleted, still
pasteable. Add a key to `BENCH_READY` to bring one back.
**v2.92** (decision 296): **the Brain Dump is the inbox.** `wf_braindump`
is itself an inbox in line view, wearing a list front with an entry line on
the desk; each line in an inbox carries a label saying its guessed kind
(`.kindchip`, tap for the next: `rekind()`), and holding one raises **the
tray** of drawers above the front to carry it into (`#tray`, `showTray()`,
`trayTargets()`, `trayFile()` in gestures.js). Migration 59 keeps old Brain
Dumps in their old shape.
**v2.93** (decision 297): **the quick add.** A notepad in the drawer front
writes somewhere else: a press goes to the drawer it writes into with the
entry line focused (`writeAway()` in tiles.js) and the lip carries a button
back (`S.backTo`, `.backpill`, `goback`). A thing in the desk's front can
stand in every front (`frontAll`), taking only a place the board has left
over; a bench saying `quick` (the Brain Dump) puts one there when it is made
(`quickPad()` in plans.js).
**v2.94** (decision 298): every Brain Dump is the list: `becomeKind()` lets
an unchosen layout follow the new type, and migration 60 converts an old
Brain Dump (lines up out of its inner inbox, scaffolding to the bin, the
quick add on the desk).
**v2.95** (decision 299): **a deck can rank** (`deckTap:'rank'`): pressed,
it opens `#rank` (`rank.js`), one card against another, swipe right if it
matters more and left if less (a binary insertion, `ranked`/`rankAt` on the
deck, each card's `ord` and the deck's `top` following), ending on the
numbered order. **The Prioritizer bench is a Priorities deck** with a line
writing cards into it; migration 61 converts an old one (zones to the bin).
**v2.96** (decision 300): the painter has **Draw, Face and 3D** modes. Face
moves a front's knob and name anywhere (`knobAt`/`nameAt`, fractions of the
front, `knb-free`/`nm-free` on the tile) and edits its name, color and knob
as a draft kept on Done; 3D turns it as a flat-shaded CSS 3D model (drawer,
card or book). WebKit on Linux cannot composite 3D: look at it in Chromium.

**v2.97** (decision 301): **three more benches**, from objects that exist:
**Brainstorm** (ideas into a list, keepers picked with a *Keep* stamp that a
sorting drawer collects, `@stamp`), **Story Builder** (`wf_storybuilder`: the
hero's journey's twelve stages, then the eight archetypes, then the world, on
three boards) and **Journal** (`wf_journal`: entries newest first). Seven
benches are in `BENCH_READY`; migration 62. The made sorts break a same-day
tie on `ord`.

**v2.98** (decision 302): **the gear is on the top lip**, at its right, on
every board (`.lipgear`), and no longer a drawer front tool, so every front
has a place more; with *One more row* it rides in the front again. **How a
bench is moved around in is scoped, not built: `docs/NAVIGATION.md`** (tile
size, layout with closed edges, scroll type, zoom type, the five patterns,
stations, the seven benches reviewed, six questions for Timothy). **To design
or build a bench, use the `bench` skill** (`.claude/skills/bench/`).

**v2.99–3.00** (decisions 303–304): **a board has sections and the
project dashboards ship.** A Label is a `heading`; `sectionsOf()` in grid.js
reads them; the **Contents** (`contents`, List family) lists them and goes
to one (`goSection()`), and the lip names the section you are in and opens
the same list (`litSection()`, `sectionMenu()`). `[[Title]]` links pages,
resolved nearest first (`linkTarget()`), and the reader ends a page with
*Linked from*. A paste can lay out in reading order (`arrange:'rows'`),
come back with `update:true` without touching what was written, ticked or
thrown away (`sp`, `laid`, `key`), set `words` and a front `status` line;
a board copies as text from Board settings. **Bureau, Composer's Key and
EveryPark are dashboards in `web/js/dashboards.js`**: laid once by migration
63, refreshed when `DASH_V` moves, and in Settings → About for a fresh desk.
Edit them there and bump `DASH_V`; never by hand on the desk.

**v3.01** (decision 305): **a desk that helps.** Automatic **backups** in
IndexedDB (`dailyBackup()`, `backupBefore()`, `restoreBackup()` in
persist.js; Settings → About). **A typed line is read** (`readLine()` in
mutations.js): its day, `!` priority, `#tags` and `@place` come off the name,
a day only at the line's end, after on/by/due, or opening it for the words
never a title; the toast says what was understood (`madeSaid()`). **Now**
(`now`, `filter.next`, `isNow()`/`nextSteps()` in model.js): what is due, and
each `status` project's next step in reading order; its lines go there
(`goThere()` in views.js).
**v3.02** (decision 306): **Claude in Bureau** (`web/js/ai.js`). It writes
objects, never chat, in the paste grammar through an explicit list of types
(`AI_TYPES`, `grammarPrompt()`), by raw `fetch` with structured outputs
(`output_config.format`, flat schemas, every field required). The **fountain
pen** (`tpen`, or `pen` in a drawer front) opens the Ask card (`openAsk()`); a
board arrives as a **flat-pack** (`flatpack`, `pack`) that unfolds where it
lies (`unfold()`: a backup, the paste's rules, the parcel to the bin, one
move); the ring offers **Break Down**, **Draft Answer** (`drafted`, which
`answered()` still counts as open) and **Fill In** once a key is set. The key
is `aiCfg()`/`setAiCfg()` in persist.js under `bureau.ai`, **never in the
desk**. Tests use `BUREAU.aiStub`, never the network.
**v3.03** (decision 307): a box drawn with the Magic Selector offers
**Claude…** on the shape ring (`ringask`); what it writes lands inside the box
(`spotIn()`), the rest below. On the desk Claude is told only the names of
what lies there (`boardSaid()`).
**v3.04** (decision 308): **paper on paper.** A drop that would cover only
things that lay (`lays()`, not containers, pipes or floats) lays on top
instead of being refused (`boxOver()`, `z`, `--z`); looking for a place still
wants clear board. A stack is computed, not stored (`stackOf()`,
`pilesOn()`); the ring squares it into a pile (a tap drops it down as slips,
`openPile()`), fans it into a cascade (a contents of its pages) or spreads it
(`squareStack()`/`fanStack()`/`spreadStack()` in mutations.js).
**v3.05** (decision 309): **the Showroom** (`web/js/showroom.js`,
`shipShowroom()`): a drawer on the desk with a room per part of Bureau and
cards into the three wikis; migration 64 lays it once, Settings → About lays
it fresh (the last to the bin); `test/showroom.mjs` screenshots every room.
It keeps to itself (`sample`, `sampleOf()`): nothing in it reaches the real
Now or calendars. The paste grammar gained `look`, `dress`, `ref`/`tie`,
`group`, `pile`/`fan` and `"due": "+3"` (`LOOK_FIELDS`, `settle()`), and
**`byId()` is a self-checking index**, not a `find()`.

**Start here each session:** `docs/SYSTEM.md` is the reference for what Bureau is
made of — objects, attributes, types, drawers, the grid, the surfaces, storage.
`docs/ROADMAP.md` holds the current plan in dependency order, and
`docs/DIAGNOSTIC.md` is the last full review — what is wrong, what it measures
at, and what is worth taking from Bear, Things 3 and Notion.
`docs/STOCKTAKE.md` (2026-09-28) is a look at scope rather than code: what is
missing for Timothy to live in it, and the case for a freeze.
`docs/FUNCTIONS.md` is the fifteen functions a paper system serves and Bureau's
answer to each — scoped, not built, and the source of the current plan.
`docs/NAVIGATION.md` (2026-10-03) is how a bench is moved around in: read
it before touching the swipe, the zoom, tile sizes or a bench's layout.
`docs/USES.md` (2026-10-01) is what Timothy approved Bureau being for, the
objects that need, and the order to build them. **`docs/GRAMMAR.md` is how to
build in Bureau** (a paste, a bench and its `fill`, the whole vocabulary):
read it before writing any board for him, and rerun `node scripts/grammar.mjs`
after changing a type, a field or a bench. **Say "bench", never "flow" or
"workflow"**, in the interface and in anything written for him (decision 295).

Read `docs/SYSTEM.md` before changing behaviour and `docs/DECISIONS.md` before
changing structure — the second one records things that were decided deliberately
and shouldn't be undone by accident.

## Running it

```bash
scripts/serve.sh              # http://localhost:8000
node test/smoke.mjs           # headless browser check, needs the server running
node test/smoke-only.mjs gravity    # one block of it, in seconds; --list names them
node test/version.mjs         # CACHE, APP_VERSION and SHELL agree; the commit hook runs this too
node test/scale-probe.mjs     # what a render costs as the desk fills up
node scripts/catalogue.mjs out.html   # the specimen book, to a file (Settings opens it too)
node test/lived-in.mjs        # the lived-in desk, every board screenshotted on both devices
node test/showroom.mjs        # the Showroom in WebKit, every room a screen at a time (--mac too)
scripts/webkit.sh             # Safari's engine for the tests, once per container
node test/safari.mjs          # the app in WebKit at an iPhone's size: the first check
```

**`test/safari.mjs` is the first check, the smoke suite the gate.** Timothy
works on an iPhone in the Safari PWA, so a change is looked at in WebKit
first: `test/safari.mjs` loads the app there at an iPhone 15's size and
density with touch, asserts the things that have gone wrong in Safari and
not in Chrome (a zoomed thing keeping its proportions, a zoomed drag landing
under the finger, a rigid swipe, a new tile, a drawer opening, no page
errors) and writes screenshots to `test/shots/safari/` — look at them. It
takes about a minute. Add to it whenever a bug turns out to be Safari's. The
container ships only Chromium, so `scripts/webkit.sh` downloads Playwright's
WebKit into `~/.cache/bureau-webkit` and apt-installs its libraries; the
session-start hook starts it in the background, and `safari.mjs` runs it
itself if it has not finished. It is WebKit on Linux, not iOS: it cannot be
*installed*, so `display-mode: standalone` and the home-screen app's safe
areas are only approximated. The smoke suite still runs on Chromium (it
drives touches through CDP, which WebKit has not got).

Open it over http, never as a `file://` URL — the service worker won't register
and the manifest won't load, so you'd be testing a different app than the one
that ships.

`test/smoke.mjs` needs Playwright: `npm install`, never `npm i playwright`, which
re-resolves the pin and rewrites `package.json` (a web session's start hook does
it for you, see below). It exercises the desk,
drawers, quick-add, the detail sheet, habits and goals, both layouts, persistence
across a reload, and an offline reload. **Run it after any non-trivial change and
before saying you're done.** While you work, `test/smoke-only.mjs <word>` runs the
blocks whose title has the word in it, plus whatever they read, in seconds rather
than five minutes; it cuts the rest out of `smoke.mjs` as text and runs what is
left, so the file is never changed and the full run is still the gate — and
`test/safari.mjs` comes before both, since the phone is where it is used. It writes
screenshots to `test/shots/` — look at
them, this is a visual app and a passing assertion doesn't mean it looks right.

**Writing a phone block: the desk is tiles and you are centred on one** (since
decision 272 the phone draws the whole column and `hereBox()` puts a box on
the tile you are centred on; what follows is how it read before).
A fresh desk is one board since decision 219, so the suite makes the desk
three by three once, right after the first load, and the one-board desk is
tested in a context of its own (`boardsYouAdd`).
Two window helpers are injected on the context for it, and between them they
cost three forty-minute runs to learn. `hereBox(box)` puts a box on the shelf
you are *looking at* — the desk starts on the middle one, where the shift is
(8,15), so a bare `phone:{x:1,y:1}` lands on shelf (0,0) and its tile is never
drawn. `twoOnAShelf()` / `aTileOnAShelf()` find something to press, walking the
shelves if this one hasn't got it — and they **stay** where they walked to,
because putting the shelf back is what broke the block after. On the desk the
whole board is drawn, the shift is zero and none of it costs anything.

**The specimen book is `web/js/guide.js`, and the app opens it.** Every visual
option there is on one page: the seven aesthetics with their sixteen colours,
their tokens, their typefaces and what a new drawer is born with; the six slot
families as seven-by-n matrices; every type, every face, every project cover,
every life object, every shape; the tick boxes, the bursts and the ornaments;
and the **chrome** — the panel, the bubble, the menu, the bar, the rail, the
toast, the palette and every control that goes inside them, once per aesthetic.
Settings → *Specimen book*. `node scripts/catalogue.mjs out.html` writes the
same string to a file, and the script is eleven lines that load the app and ask
it for one, because **there is one generator**: a page built out in a script
from data it extracted is a second book that agrees with the first until
somebody edits one. Nothing in it draws a tile itself either — every specimen
comes out of `sampleTile()`, and every colour, token and default is read off
the root after asking the app to *be* that aesthetic.

It is shown in an **iframe**, which is not a convenience: the book resets
`body` to scroll, to not be parchment and to not be full height, and Bureau's
stylesheet says all three the other way round because Bureau is an app and this
is a page you read. Its host sits beside `#app` the way a panel does, so
`render()` leaves it alone, and Escape closes it before anything else.

Two things to know before touching it. The **chrome rules are still keyed on
`html[data-style]`** and cannot be on a page showing seven aesthetics at once
(decision 98 moved the *tile* rules onto `<fam>sty-` classes, which is exactly
what makes the page possible), so every one of them is re-emitted onto a
`[data-sty]` wrapper — read out of the live CSSOM, recursively, so a rule inside
an `@media` keeps its condition, and wholesale, because choosing which ones
mattered is how you miss one. That failure is **silent** — a panel renders, just
undressed — so `specimenBook` in the smoke test compares Golf 97's panel against
Victoria's. And the **chrome specimens are written in the app's own class
names**, because a `.sqbtn` has no shared function to reuse; that section is the
*inventory* of those names, and a renamed class shows up there as an undressed
specimen. Re-run nothing after changing a slot: the book is generated when you
press the button. See decision 143.

`test/scale-probe.mjs` is not a test and nothing gates on it — it pours objects
onto the sample desk and times a render, the string build inside it, and a full
save, so "is this getting slow" has an answer rather than an opinion. Run it
after anything that touches `render()`, `childrenOf()` or the grid maths.
**Quote its counts, not its milliseconds.** The times are the shape of the
curve and nothing else — DIAGNOSTIC §2 has them moving 30–50% between runs on
code that did not change. `layouts` and `styles`, off Chrome's own counters
either side of one render, are things that either happen or do not: **both
should be 1**, at every size and on both devices, and a render that starts
doing two layouts is decision 59's regression coming back. `perTile` is how
many elements one tile is made of, which is the question every spliced layer
since decision 99 has raised — read it down the same row across versions, never
along a run, because the objects poured on are 1×1 and a 1×1 is the mark alone.
`chars` is the built string's own length, which is what `build` is timing. The
numbers as of v0.61 are in `docs/DIAGNOSTIC.md` §2; the short version is that
growth is linear, the phone pages and the Mac doesn't, and the most expensive
thing in a big frame is the save.

## Deploying

Live at **https://starrysidekick.github.io/Bureau/**. Pushing to `main` deploys
it — `.github/workflows/pages.yml` uploads `web/` as the Pages artifact.
Timothy's standing instruction (2026-08-27): once a change is tested, merge it
to `main` and push without asking — don't leave finished work sitting on a
branch. Pages'
branch mode can only serve the repo root or `docs/`, and `docs/` is the written
documentation, hence the workflow.

After changing anything in `web/` (any `js/` or `css/` file, or `index.html`),
bump `CACHE` in `web/sw.js` **and** `APP_VERSION` in `web/js/persist.js` — the
two travel together, and the second is what Settings prints, so "which Bureau is
this phone running" can be read off the device instead of guessed at.
`APP_VERSION` **is the commit count**, written `0.NN`: the fifty-first commit is
`0.51` and the hundredth is `1.00`, which will be the first honest claim to a
1.0 this app has made. `git log --oneline | wc -l`, plus the commit you are
about to make. **In a shallow clone that count is a lie**: it read 53 against
an `APP_VERSION` of 1.40, and taking it at face value would walk the version
*backwards* — which Settings would then report, on top of a cache name the
origin has already served. Ask `git rev-parse --is-shallow-repository` first,
and if it says true, read the current `APP_VERSION` and add one. Without
the cache bump, installed copies keep serving the old version. A **new** file must also be added to `SHELL` in `sw.js` or
it won't work offline. This is the easiest thing in the project to forget and
the symptom — "my change didn't deploy" — points at the wrong culprit.

**So it is checked, not remembered.** `test/version.mjs` asserts all of it: the
two numbers agree, `SHELL` matches the files on disk, a change under `web/`
moved `CACHE`, and the version never went backwards. `.claude/settings.json`
runs it as a hook before every `git commit` and refuses one that forgot, with
the exact edit in the message. The same file starts a web session by
installing Playwright at the pinned version and pointing the tests at the
container's Chromium (`.claude/hooks/session-start.sh`, remote only), and
carries a short allowlist of read-only commands so a session is not asked
about `git status`. See decision 174.

**A second app used to be deployed beside Bureau, and it still shares the
origin.** Activinator lives in its own repository now
(StarrySidekick/Activinator, deployed at `/Activinator/`), but project sites
share `starrysidekick.github.io`, and a cache store belongs to the origin and
not to a scope — the usual `filter(k => k !== CACHE)` on activate means
"delete every cache anybody else put here", and when the two apps did that to
each other it wiped both shells. `sw.js` therefore reaps only `bureau-` caches,
and that must outlive the move. What remains in this repository is
`web/activinator/`, the **hand-off stub** at the old `/Bureau/activinator/`
address: an index.html that redirects to the new home, and a self-destructing
sw.js that takes down the worker an installed copy is still running. Bureau's
worker skips `/activinator/` entirely — its navigation branch stores whatever
it fetched as *Bureau's* `./index.html`, so without the guard one visit to that
path left Bureau opening into it offline, and the stub's sw.js must be fetched
fresh to do its job. `test/deploy.mjs` runs against `web/` as deployed and
guards all of it. Don't undo any of this without reading it.

Two more things about that cache, both of which have wasted a session already:
the shell is fetched with `cache:'reload'` so a bump can't refill the new cache
from the browser's own stale copies (it did, once, landing a new stylesheet
beside the previous `grid.js`); and an already-open page still finishes on the
old assets, so a bump takes effect on the **second** launch, not the first.
`scripts/serve.sh` sends `no-store` for the same reason — that header is
development-only and never ships.

## Layout of the code

`web/index.html` is a thin shell: head, three stylesheet links, `#frame`, and one
`<script type="module" src="js/boot.js">`. The app is ES modules in `web/js/`,
loaded with no bundler. Imports are explicit and exports are the `export {…}`
clause at the bottom of each file — that list is each module's public surface.

| Module | What lives there |
| --- | --- |
| `util.js` | `$`, `esc`, `uid`, the `D` date object, icons (`ic`), markdown (`md`). All dates are `YYYY-MM-DD` strings in local time — never `Date` objects in state, never UTC. |
| `model.js` | ATTRS + KINDS (**the heart of the app** — see below and `docs/SYSTEM.md`), seed data, `S`, `inContainer()`, `childrenOf()`, `streak()`, `goalPct()`, relations. |
| `grid.js` | Grid geometry: `GRID`, `CELL`, `lay()`, `boxOk()`, `freeSpot()`, `ensureBox()`, and `innerOf()` — **a container's board is its own tile, four cells to a cell** when proportional boards are on, and screenfuls otherwise. Lives here, not in the views. |
| `look.js` | Styles, the sixteen colour slots, `hexOf`/`objColour`, `applyLook()`. |
| `mutations.js` | `toggleDone`, `del`, `create`, `quickAdd`, repeat scheduling, `toast`. |
| `tiles.js` | `gridTile()` — the one place that decides how an object looks on a grid — plus rows, cards, list bands, book/scroll entries, and what a click does (`tileTap`). |
| `views.js` | The desk and a drawer — the only two places there are. Also the time layouts (`viewMonth`, `viewTimeline`), the zoom out to every board (`openOverview()`) and the settings panel's body. `render()` replaces `#app`'s innerHTML wholesale, then saves. |
| `sheet.js` | The three surfaces an object opens onto — reading, writing, and the picture — rendered into `#sheetHost`, **separately** from `render()`. |
| `words.js` | How a written thing is set (decision 247): the typefaces, inks, papers and layouts, `wordOf()` through four layers, and `wordStyle()`, the one class-and-property answer the tile, the reader, the ruler and the writer all draw from. |
| `paint.js` | **A custom look drawn by hand** (decision 271): `o.art`'s strokes, `artLayer()` for a tile, and the painter at `#paint`, which has its own listeners in the capture phase. |
| `ai.js` | **Claude in Bureau** (decision 306): the request (`askClaude()`, structured outputs, no SDK), the system prompt built from the types (`grammarPrompt()`), the schemas, the Ask card, the flat-pack's packing and unfolding, and the ring's three verbs. `AI.stub` stands in for the network in tests. |
| `showroom.js` | **The Showroom** (decision 309): pure data in the paste grammar, a room per part of Bureau and cards into the wikis, laid by `shipShowroom()` in persist.js. Bump `SHOW_V` to lay a fresh one on every desk that has one. |
| `setup.js` | The **setup card** (decision 229): the questions a new drawer, project, goal, counter and the rest ask on their first tap, `SETUPS` and `STEPS`, drawn into `#setup` beside `#app`. Every answer writes a field the editor already has. |
| `panels.js` | `openPanel()` — **every menu in the app** — plus `openMenu()` for a popup hung off a button, the command palette (⌘K), the context menu, and `sampleObject`/`sampleTile` for drawing a type as the thing it makes. |
| `gestures.js` | Pointer-based drag, resize, lasso, swipe. The fiddliest code in the app. |
| `motion.js` | Every movement: `openTile()` (drawer, cabinet, curl, lift), `growSheet()`/`shrinkSheet()` (an object scaling up into its surface and back), `pop()`, the pager that slides between boards and to the drawer beside this one, and **the camera** (`applyZoom`/`camScale`), tabled behind `CAMERA=false` since decision 203. Nothing in it ever delays a state change. |
| `gravity.js` | A board that has **let go** — the rigid-body solver behind Sand and Tumbling. Reads nothing but the tiles' rectangles; writes nothing but their transforms. |
| `plans.js` | A **plan** — a saved board, in `S.plans`, captured and stamped. Not an object and not on any grid. |
| `active.js` | The **instruments** — a metronome, an hourglass, a candle, a bell, a clock, a die and a deck. One table, and one rule: nothing ticks by re-rendering. |
| `guide.js` | The **specimen book** — every aesthetic and everything each one dresses, generated out of the running app. `guideDoc()` builds it, `openGuide()` shows it. |
| `persist.js` | localStorage read/write, **versioned `MIGRATIONS`**, JSON export/import, IndexedDB image assets, the paste bridge. |
| `wire.js` | One delegated listener set on `#frame`. All interaction routes through here — to add an action, add a `data-act` and a case in `act()`. |
| `boot.js` | Entry point: load, wire, render, register the service worker, `window.BUREAU`. |

The old numbered banner comments survive inside the files, so `grep -rn "· "
web/js` still maps the territory. The import graph is deliberately cyclic at
function level (views call tiles, tiles call views' `render`) — ES modules
resolve this fine because nothing crosses a module boundary at load time. Keep
it that way: no top-level code that *calls* another module.

## How to work in this codebase

The rules for each area of the code are in `.claude/rules/`, one file per area,
and each loads by itself when a file in that area is read or edited. They were
this section, moved whole and unreworded (decision 175), so `grep -rn` across
`.claude/rules/` finds what a grep of this file used to find. **Read the file for
an area before changing it, and before planning the change**: a plan made before
any file has been opened has loaded none of them.

| Rule file | Covers | Loads when you open |
| --- | --- | --- |
| `board.md` | The grid, the shelves and the cells; measuring, placing and windowing; the carcass, the rail and the knob; a list as a board. | `grid.js`, `views.js` |
| `tiles.md` | How a tile draws: fronts, knobs, spines, panels and grains; the faces (checklist, calendar, collage, cover, card, control, bar, spawner); sizes, words and depth cues. | `tiles.js`, `board.css` |
| `look.md` | Aesthetics and the sixteen slots; families, positions and pins; edges, radii and shadows; decorations; the specimen book. | `look.js`, `guide.js`, `decor.js`, `board.css`, `chrome.css` |
| `gestures.md` | Drag, drop, hold, tap, pinch, toss and swipe; the holding space and the rail pull; the lock; the one delegated listener. | `gestures.js`, `wire.js` |
| `motion.md` | Every movement: the dive and the way back, the pager, the spray, filing, the hop, gravity and tilt. | `motion.js`, `gravity.js`, `motion.css` |
| `tiles.md` (also) | The instruments and their timekeeping. | `active.js` |
| `model.md` | Objects, attributes and kinds; containers, sorting drawers and rules; dates, deadlines, ranks and repeats; plans; the controls table. | `model.js`, `mutations.js`, `plans.js`, `stockplans.js` |
| `panels.md` | Panels, menus and bubbles; the object editor, the picker, settings and the When page; the reading and writing surfaces. | `panels.js`, `sheet.js`, `chrome.css` |
| `render.md` | What a render is and is not; passes; what you typed is what you read; storage and the worker. | `persist.js`, `boot.js`, `util.js`, `views.js`, `sw.js`, `index.html` |

Five rules are about every module at once, so they stay here.

**Rendering is full re-render.** `render()` rebuilds `#app` from `S` every time.
Don't add targeted DOM patching; it isn't the bottleneck and it would break the
mental model. The exceptions are the reading and writing surfaces, which render
into their own host so typing doesn't destroy the field you're typing in, and a
tile being edited in place, which doesn't re-render at all — respect both. The one thing carried *across* a rebuild is the board's scroll offset
(`SCROLL` in `views.js`, keyed by where you are), because a new scroller starts
at the top and moving a tile on a long desk used to throw you back to the first
screen. That is one number, not a foothold for patching — see decision 29.

**An animation never holds anything up.** This is the one rule in `motion.js`
and it is easy to break by accident. A tap files, ticks or navigates the
*instant* it lands, `render()` runs, and the movement is drawn over the result
— which is why the flying drawer front goes into `#fx` and the pager hangs off
`#frame`, both outside the element `render()` replaces. Never `setTimeout(…,
300)` around a state change to "let the animation finish": that is how an
animated app becomes a slow one, and it breaks every test that reads state
after a click. See decision 38.

**Events are delegated, not bound.** Everything hangs off the listeners attached
to `#frame` in `wire.js`, dispatched on `data-*` attributes. To add an action,
add a `data-act="thing"` attribute and a case in `act()`. Don't attach listeners
inside render functions — they'd leak on every re-render.

**Everything is an object; containing is an attribute.** One array,
`S.objects`, holds all of it, and every object names its `parent`. `ROOT` is the
desk. A "drawer" is an object carrying `container` — the word is right in the
interface and wrong in the code, so ask `isContainer(o)` (which is
`has(o,'container')`) and never anything about a type's name. Containers nest
inside containers; everything else nests inside nothing. An object lives in
exactly one container — a magic drawer is the only way it appears anywhere
else. Read `docs/SYSTEM.md` before changing any of it.

**Never branch on a type's name.** Appearance goes through `shapeOf()`, faces
through `faceOf()`, behaviour through `has()`. The only remaining `kind===`
comparisons are inside migrations, where naming an old type is the whole point.
 ("Kind" in the code, "type" in the interface — `KINDS` stayed put so the diff stayed readable.) Ask `has(o,'check')`, not `o.kind==='task'`.
Kinds are named presets of attributes, users can invent them at runtime, and a
view that checks for `'task'` will silently ignore every kind someone makes. The
attribute registry is `ATTRS`; the presets are `BUILTIN_KINDS` merged with
`S.kinds`. Adding a built-in kind is still a one-line change; adding an
*attribute* means teaching the detail sheet and the tile renderer what it draws.

## Invariants that will bite you

- **Layouts are stored per device.** Each drawer has both `desk: {x,y,w,h}` and
  `phone: {x,y,w,h}`. Resizing must only touch `d[dev()]`. `dev()` returns the
  layout currently being *edited*, which is not always the physical device.
- **The phone takes the size you set** (2026-09-28). A type's own `phoneSize`
  if it states one, otherwise its `size`, held only to the board's width and a
  screenful tall (`PHONE_MAX_H`). There is no halving of containers and no
  three-cell cap any more: those were the app's guesses, and the sizes are
  Timothy's choices in the Workshop now. The same goes for a type's range.
- **A kind's `size` is the desk size, and the phone's too.** `sizeOfKind(kind,
  device)` trims it to the board it lands on. Never use `K(k).size` directly
  to place something: it may be wider than the board it lands on. Anything
  drawing a *preview* of a phone box goes through `toPhoneSize()` so the
  preview can't drift from the placement. A kind may also carry `phoneSize`,
  set in the Workshop or the type builder's second pair of sliders, and
  `sizeOfKind()` prefers it. Read the size through `sizeOfKind()` and both
  cases come along; read `K(k).size` and neither does.
- **Two lengths of press, and the difference is whether you moved.** 300ms arms
  the drag; a touch still holding 250ms later, within 6px, becomes the context
  menu instead (`menuTimer` in `gestures.js`). Touch only — a mouse has a right
  button. Anything driving two gestures in a row must re-query the tile between
  them: a completed drag re-renders, and the old node is detached.
- **On touch, the drag has to steal the scroll, and it only gets one chance.**
  The non-passive `touchmove` listener in `wire.js` preventDefaults while
  `dragArmed()`. That call only works because the 300ms hold kept the finger
  still, so no native scroll had begun — once one has, preventDefault is
  ignored. Don't make that listener passive, don't shorten the touch hold, and
  don't preventDefault during the hold *window* (it would break flick-scrolling
  off a tile, which is the commoner gesture).
- **The grid is a coordinate space, not a flow.** `x`/`y` are 1-based cells and
  array order positions nothing. There is no `grid-auto-flow` — an empty cell
  stays empty. Every move and resize goes through `boxOk()`, which refuses
  anything that would overlap or leave the columns; see `web/js/grid.js`.
  **Except a drop of paper on paper** (decision 308): `boxOver()` lets a thing
  that lays be put down over other things that lay, at a height `z`. Every
  search for a place still asks `boxOk()`, so nothing lands under paper
  unasked, and a container still never overlaps anything.
- **Cells are square and the row height is measured, never assumed.** Columns
  are fluid, so `sizeGrid()` reads the real column width after layout and caches
  it in `COLW`, then makes `CELL` match. Don't hardcode a row height — `GRID`
  deliberately has none. The one place that has to *guess* before the grid
  exists is `gridOfContainer()`, which writes `--checkerx`/`--checkery` into the
  grid's own style from the last measurement, so a new board is drawn at the
  right scale on its first frame instead of flashing the CSS fallback and
  snapping back to size.
- **There is no arrange mode.** Everything is always movable; a drawer can be
  `locked` to opt out. A 200ms hold arms the drag (`G.armed`), which is the only
  thing keeping a click from picking a tile up. Corners resize, and that's all —
  no edge handles, no size chip, no delete cross.
- **`byId(ROOT)` is undefined — ask `container()`.** The desk is a container
  that is not an object: ROOT is a reserved id the way HOLD is, and there is
  nothing in `S.objects` answering to it. `container(id)` returns `rootObj()`
  for the desk and the object otherwise, which is what every reader that has to
  work on both boards goes through. A `byId()` followed by `if(!o) return`
  fails shut and is safe; a `byId()` folded into an `||` falls through to a
  second branch on the desk and only on the desk — which is how "Save as a
  plan" shipped throwing on the one board it was most likely to be used from.
  See decision 127.
- **Ids must be unique across sessions.** `uid()` once used a counter that
  restarted at 0 on every load, so the Nth object made today collided with the
  Nth made yesterday. `byId()` returns the first match, so a collision meant
  dragging one tile moved a different object, drew that object's outline, and
  left the new one immovable. `dedupeIds()` repairs old data on load; the smoke
  test guards it as `dupIds`.
- **The grid element carries no padding and no border.** `cellW()` measures
  `.grid`'s own bounding rect, which includes both — so a border or padding on
  it silently shifts every tile away from where the drag maths thinks it is.
  Anything decorative you want around a board goes on a **wrapper** element, or
  on `box-shadow`, never on the grid itself.
- **Never round the cell size.** Columns are `1fr` and therefore fractional.
  Rounding the row height made rows and columns different sizes and the error
  accumulated across the grid, so tiles at high x/y sat several pixels from
  where the drag maths thought they were. The smoke test guards this as
  `maxDrift`.
- **Clicking an object is configurable** — `clickOf()`, per object then per
  kind: nothing, read, edit, or tick. The editor is no longer the default; it is
  on the context menu. Don't add a code path that opens the editor on click.
- **How an object reads is one property, and there are two ways.** `readOf()`
  — `book | scroll`, per object then per kind, defaulting to **book**. `page`
  was a book showing one page — the same sheet, the same pagination, the same
  turn — which is what a book already is on a phone; it is gone, and a desk that
  stored it reads as a book (migration 31). A **scroll is the whole stage**, not
  a letter-shaped sheet with the words moving inside it, and its column keeps a
  measure said in the page's own padding (a per cent there resolves against the
  page's width, so one declaration centres every block). "Open it as a book"
  used to be a click action, which made *whether* it opens and *how it looks* the
  same question. See decision 156.
- **A reading page is US Letter and sized from the *visual* viewport, never the
  text.** It
  was a `min-height`, so a long body grew a taller sheet and an empty one
  collapsed. `--pageh`/`--pagew` in `chrome.css` derive from `--stage-x`/`-y`;
  change the stage inset and the paper follows. **Pagination is measured** —
  `pagesOf()` fills an offscreen `.bookruler` twin until a block doesn't fit,
  and caches by object, mode, body length and window size. Anything that
  changes the page box or its typography has to call `clearPages()`, or the
  breaks will be from the old geometry.
- **Image bytes live in IndexedDB, never in the JSON.** The assets half of `persist.js`. `snapshot()`
  strips `media.src`; `hydrateAssets()` puts it back after a load. If you add a
  new place that writes objects to storage, it has to strip too.
- **Nothing on a board may be selected, and the exemptions are the list.**
  `#frame` refuses `user-select` and `selectstart`; fields, prose, a page and
  the writing surface are exempt, and nothing else is — not a panel's labels,
  which are furniture. Refusing `selectstart` does nothing about a highlight
  that already exists, so `dropSelection()` in `gestures.js` clears one at the
  start of every hold that becomes a Bureau gesture. Never inside a field. See
  decision 52.
- **An Undo on a toast is about the move the words were written for.** It used
to call `undo()`, which takes whatever is on top of the stack — so anything at
all happening inside the toast's three and a half seconds meant the word
stepped back over the *newer* thing and left the filing exactly where it was:
pressable, and quietly about something else. `toast(msg, true)` pins the move
that was on top; `undoToast()` fires only if it still is, and says so otherwise.
⌘Z stays unpinned and walks the whole stack. See decision 129.

**An undo nobody can reach is not an undo.** A phone has no ⌘Z, so a move on
the stack with no `toast(msg, true)` in front of it is a way back that exists
only on a keyboard — which is what every filing in the app was for a long time,
correctly recorded and unreachable. Pass the flag. And **one gesture is one
move**: `unholdIt()` in a loop pushes a move each, so the Undo offered after
"put all down" would have put back the last thing only — `unholdMany()` records
the lot as one, the way `delMany()` sits beside `del()`. See decision 128.

**Anything that changes a field pushes an undo move.** Not just deletion — that
was the whole of it for a long time, and ⌘Z after a panel edit or a drag did
nothing, silently. `pushSet(label, id, key, was)` records one field and
**coalesces** (a set on the same field within 1.5s rides the move on top,
keeping the first value, or a ten-letter rename is ten moves); `pushSets` records
several at once, which is what a drop is. `S.redo` is the other stack and
`applyMove()` returns the move that undoes what it just did, so redo is the same
function pointed the other way. The desk's own settings are outside it: they
live in `S.deskCfg` and have no id for a step to point at. See decision 65.

**A render is not a change.** `render()` used to end with `save()` — 35ms of
serialising an unchanged desk at three thousand objects, on the 250ms debounce,
while you drag. Mutations say `save()` for themselves; a finished render calls
`saveIfDirty()`. The one thing a render legitimately writes is a box invented by
`ensureBox()`, which is why `PLACED.n` exists and why render() compares it either
side of the build. Don't put `save()` back in render(). See decision 64.

**Anything destructive pushes an undo move.** `S.undo` is a stack of up to 20,
  each a list of `{del}` / `{add}` / `{set}` steps replayed backwards. Remove
  objects through `del()`, `delMany()` or `delDrawer()` in `mutations.js` — a
  bare `S.objects.splice()` in a handler is exactly how group delete came to be
  unrecoverable. A picture is only freed from IndexedDB when the move
  holding it falls off the bottom of the stack — which `reap()` now checks for a
  `{set:{k:'media'}}` step as well as a deleted object, because taking a picture
  *out* of an object that is still on the desk is the same bargain.
- **A box's *position* belongs to a container's coordinate space; its *size*
  does not.** Reparenting has to drop `x`/`y` and let `ensureBox()` re-place, or
  the moved objects land on the same numbers in a grid where those numbers mean
  somewhere else — usually on top of something (`delDrawer()` got that wrong
  once; guarded as `contentsReplaced`). But `w`/`h` mean the same thing
  anywhere, and clearing the whole box handed the object back its **type's**
  default — so a note pulled out to six cells tall came out of a drawer two
  cells tall. Go through **`keepSize(o)`** in grid.js, never `o.desk=null;
  o.phone=null`: it leaves a box carrying a size with no position, which
  `ensureBox()` knows how to place (clamped to the arriving board's columns).
  The holding drawer's *preview* still normalises to the type's desk size —
  that is decision 107 and is about a thumbnail, not about the object. See
  decision 129.
- **Drawer fronts are solid mid-dark colours** and everything inside them reads
  light, via `--dink`/`--dink-2`/`--dink-3` set on `.drawer`. Don't use `--ink-*`
  inside a drawer tile — it's the page's dark ink and will vanish.
- **A drawer holds; a magic drawer collects; nothing does both.** `inContainer()`
  is the single source of truth. An ordinary drawer shows only objects whose
  `parent` is it; a magic drawer ignores `parent` and matches its rule. An object
  lives in exactly one drawer — see decision 17, which overturns decision 1.
- **`container`, `magic` and `control` are structural, not user attributes.**
  They are in `STRUCTURAL` and excluded from `USER_ATTRS`, which is what stops a
  note being turned into a drawer. Attribute pickers must use `USER_ATTRS`.
- **Containment is recursive, so cycles are possible.** Anything that reparents
  an object must go through `isAncestor()` first, or a drawer can be dropped
  inside itself and take its whole subtree out of reach.
- **Collision is per-container.** `boxOk()` takes a `parentId` and only compares
  siblings — two objects in different drawers may share coordinates, because they
  are in different coordinate spaces. Only objects that have actually been placed
  can be collided with; `ensureBox()` places them on first render.
- **Completed things leave their drawer** and appear only in the archive — bar
  the three faces `keepsDone()` names. This is what keeps drawers finite, which
  is the entire argument for drawers.
- **Repeating a task doesn't reuse the object.** Completing it spawns a fresh
  object at the next due date and converts the original into a `record`. History
  is preserved rather than overwritten.
- **Storage may throw.** Private browsing and quota exhaustion both fail. Every
  storage call is already wrapped; keep it that way, and never let a failed save
  take down the render.
- **No `localStorage` access outside `persist.js`.** All of it goes through
  `save()` / `load()` / `snapshot()` so the schema stays in one place.

## Style

Match what's there. Compact but readable; two-space indent; single quotes;
template literals for HTML. Comments explain *why*, not *what* — the code already
says what. Copy in the UI is plain, specific, and unexcited: "Filed in Kitchen",
not "Successfully moved item!". **Copy in the UI is American English** (Timothy,
2026-09-30: "use American English for now"): color, behavior, center, a check
rather than a tick. Identifiers and stored values keep their old spelling.

No dependencies. If something seems to need a library, say so and make the case
before adding one — the whole app being one dependency-free file is a feature,
not an accident, and it's what makes it trivially portable to a native shell later.

## Don't

- Don't add a build step, bundler, or framework without discussing it first.
- Don't introduce a backend. Local-first is a decision, not a limitation — see
  `docs/DECISIONS.md`.
- Don't reformat the whole file. Diffs should be readable.
- Don't rename `bureau.v1` in localStorage without writing a migration.
- Don't delete the seed data — first-run needs to feel like a real desk, and it's
  the fastest way to eyeball a change across every kind at once.
