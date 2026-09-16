---
paths:
  - "web/js/grid.js"
  - "web/js/views.js"
---
# The board

The grid, the shelves and the cells; measuring, placing and windowing; the carcass, the rail and the knob; a list as a board.

These paragraphs were the *How to work in this codebase* section of `CLAUDE.md`,
moved here whole and unreworded so they load when a file they are about is
opened rather than in every session (decision 175). A rule for this area goes
here; a rule for every area goes in `CLAUDE.md`.

**A list is windowed where the grid is.** A row is the strip the same object
would be on a grid (decision 168), so a list is a second way of looking at
*this board* — and it was showing all nine of the desk's shelves in one column
while the dots in the bar said you were on the middle one. `onThisShelf()` in
views.js: one shelf on a phone, the whole board on a Mac, asking `shelfShift()`'s
own question so the two cannot disagree about what "this board" means. Gated by
`isListView()` — **the list and nothing else**, because a grid is the board
itself and a book, a calendar and a timeline arrange by sequence or by date.
Anything never placed has no shelf and is always shown; an empty shelf says
where the rest is rather than drawing a bare column. No new gesture: the dots
are the toggle. See decision 173.

**Navigation is the shelves, and nothing else.** There are exactly two views: the
desk and a drawer. The four fixed tabs (Today, Keeping Up, Everything) are gone
— they were hard-coded aggregations, which is a magic drawer's job. Don't add a
view without a very good reason — a magic drawer is nearly always the answer.
See decision 22. The three that used to be pinned still ship, as ordinary
drawers on the desk: **Today** (anything due, every desk), **Inbox** (where a
new object lands when nobody said), **Everything** (every unfinished task).

**There is one desk and it is nine shelves.** A **shelf** is one screenful of
board and it is the unit everything else is counted in; the Desk is three by
three and you start in the middle; every other container is one shelf, with the
option of more (`shelves` on the object, `shelvesOf(cid)` to read it). The row
of desks is gone — what it bought was *room*, and the room is on the desk. A
drawer is a drawer wherever it is. `deskIds()`, `isDesk()`, `deskOf()` and
`deskHere()` are constants now rather than deleted, because everything asking
"which desk am I on" is asking a question that still has one answer.
See decision 141.

**`gridOf()` answers two questions and they are easy to confuse.** `shelfW`/
`shelfH` are one **shelf** — the window a phone can see. `cols`/`rows` are the
**coordinate space**, which is the shelf times the shelves this container has. A
box lives in the second; a screen shows the first. `drawCols(g)`/`drawRows(g)`
say which is actually rendered — the shelf on a phone, the whole board on a Mac,
where the middle row of three is on the screen at once and the other two are up
and down the scroller. Everything that goes wrong here goes wrong by using one
where the other was meant.

**`SHELFSHIFT` is the whole of it, and it is the same trap the page was.** A box
is in board cells and `grid-column`/`grid-row` are in shelf cells, and the two
agree only on the first shelf. `gridTile()` subtracts the shelf as it draws;
anything reading a cell *off* the screen (the sketch, the drop) adds it back,
and anything writing a box *onto* it (the ghost, the live resize) takes it off —
`shelfShift(cid)` in views.js is the one reader. Both axes now. Zero on a Mac,
where nothing is windowed. See decisions 102 and 141.

**Place nothing before the board has been measured.** A shelf is as tall as
whatever fits on this screen, so `ensureBox()` returns **null** while
`MEASURE[dv]` is empty and `gridOfContainer()` leaves that object off the frame.
The frame in question is the first one at launch and sizeGrid() re-renders the
moment it has a number. Placing on the guess writes a coordinate in the wrong
space, and correcting it is a shuffle of an arrangement nobody asked to shuffle.

**A new object goes on the shelf you are looking at, and a board can be full.**
`freeSpot()` scans the current shelf first and the rest nearest-first, and
returns **null** when there is nowhere — which is a real answer. Every path that
*makes* something asks `fits()` first and refuses with a sentence saying what to
do about it. But `freeSpot()` asks one question — *is there a hole exactly this
shape?* — and inside a drawer, which is eight columns wide, one tile in the
middle of a row is enough for there to be no six-by-four hole on a board that is
three quarters empty. **`fitSpot()`** steps the long side down a cell at a time
and asks again, so it gives up the proportion before it gives up the object, and
returns null only when a single cell will not fit. `fits()` and `ensureBox()`
both go through it, so what was promised is what arrives; `fits()` also takes the
**sketched box** when there is one, because a sketch wins over the type's size in
`placeAtPending()` and asking about the type's default refused a box you had just
drawn room for. `anySpot()` is the never-null version and is only for things that
already exist and must be somewhere (a reparent, a paste, a shelf that got
shorter when the window did); it is the one place in the app that writes an
overlap.

**Nothing straddles a seam where a seam is a screen** — a phone. On a Mac the
three shelves of a row are all visible at once and a tile lying across two is
legible, so `boxOk()` refuses it only on a phone. Same shape of rule the page
break had.

**The name at the top left opens the shelf map**, and the dots beside it are the
same thing small: nine shelves are a *square*, so the dots are one — a map you
can aim at rather than a count you have to translate. `deskMap()` in `views.js`
draws each shelf with what is on it at a fiftieth of the size, and pressing one
goes there.

**What was already on the desk is moved to the middle shelf once**, per device,
by `centreDesk()` — and it has to happen at first render rather than in the
migration, because a shelf's height is measured. `S.centred` is stored, because
it must happen exactly once and a second pass would push everything off.

**The status bar is the top of the carcass, and only `theme-color` can reach
it.** On an installed app the strip the clock and battery sit in is painted by
the system, not by the page — so it is the one piece of the furniture CSS
cannot touch. It is the **wood**, so the carcass runs unbroken from there to
the drawer along the bottom. **One meta, no light/dark pair**: the wood is the
same in both, and a second meta carrying a `media` would outrank the one
`paintStatusBar()` in views.js writes to. The head states the default so a cold
launch is right before any script runs; the function follows a desk that names
its own `wood` and a style that overrules the token, reading the computed value
only when neither can answer. Never duplicate the default as a JS constant —
the stylesheet owns it. See decision 89.

**The knob is the Home Knob, and on a Mac it floats.** A phone gets the whole
drawer front along the bottom of the carcass because a phone screen has a
bottom; a Mac window has none — the board fills it and scrolls — so `deskKnob()`
draws the same knob on its own, `position:fixed` in the bottom right corner,
staying put while the board scrolls under it. Fixed and not absolute: `.main` is
inside `#app`, which `render()` replaces. Same `railCfg()` as the rail, so the
desk's own editor dresses both. Tap goes home (the click, not the gesture —
nothing is claimed until you have moved `KNOB_DRAG`), a drag inside its own ring
opens the **Void Drawer**, a drag past the ring onto a bare cell is where the
next object goes, and a tile carried onto it goes into the Void Drawer —
`aimHold()` reads a **circle** there instead of the phone's band, with the same
two radii a detent needs. The holding space is called the Void Drawer and the
dashed rectangle you drag out of a bare cell is the **Magic Selector**; neither
behaviour changed, both can now be talked about. See decision 165.

**The app is furniture, and the board is set into it.** A phone screen has two
strips the board cannot use — the notch above the bar and the curve of the
bottom corners — and both are the desk itself: `--wood` above, and along the
bottom a **drawer front** with a round knob. Tapping the knob takes you out (out
of a drawer to its desk, from a desk to home); **pulling it up a little opens
the drawer** onto the holding space, and **pulling it all the way out opens the
type picker**, which is decision 43's gesture given back the thing it comes out
of. It is a real drawer now — it holds things (decision 107).
The wood is the same in light and dark and is deliberately not derived from the
style's five — a desk is walnut at midday too. See decision 55.

**Everything above the board is one piece of wood, the bar included.** The inset,
the bar and the reveal under it are one surface, because a change of material
across the top of the screen reads as two bars rather than one. `.main` is
therefore the carcass and the grid paints its own paper; a layout that isn't a
grid asks for paper explicitly. The bar overrides `--ink`, `--ink-2`, `--rule`
and friends for its own subtree — the same trick `.drawer` plays with `--dink`,
so light-on-dark is local — and it takes the style's **Glow** as its accent,
because brass on walnut is two browns. See decision 57.

**The carcass is furniture you can change, per desk.** Knob shape, size and
colour, the texture, and the wood itself are rows in the desk's own editor —
`railknob`, `railknobsize`, `railknobc`, `railtexture` and `wood` on the desk's
config. Prefixed, because for every desk but home `cfgOf()` is the drawer's own
object and it already has a `knob` and a `texture` for its tile. The rail knob
carries `.pull`, so a shape or a shading added for a drawer front is added for
the desk at the same time. `render()` writes `--wood` onto `#frame`, not onto
the rail: it is one piece of furniture.

**`sizeGrid()` writes only what changed.** It measures after layout and then
writes what it measured, and every one of those writes dirties layout again — so
rendering laid the board out twice, once for the measurement and once for the
writes. The markup already carries last render's numbers, so on an ordinary
render there is nothing to write. Same for `scrollTop`: restoring it on a fresh
element forces a full layout, and it is skipped when there is nothing to restore
(on a phone, always).

**Anything measured after layout has to be readable at build time.** `REVEAL` in
`views.js` holds the gap above the board and the depth of the drawer below, and
`viewDesk()`/`deskRail()` write them inline as the markup is built — the same
thing `gridOfContainer()` does with the checker squares. `sizeGrid()` measures
and updates them. Without it, a board drawn *off-screen* — a pager pane, a
preview — is drawn at the CSS floor and clicks into position the moment the
swipe commits. See decision 58.

**The rail's height is written by `sizeGrid()`, and so is the gap under the
bar.** A board is a whole number of square cells and a screen is not, so the
leftover is split evenly between the reveal above the board and the depth of the
drawer below it — at most half a cell of either, and the board ends up centred
in its carcass. Give it all to one end and you get either a drawer two rows deep
or the dead strip under the title that decision 44 removed. `--gapmin` on
`.deskscroll` is the floor for the top half; `min-height` on `.deskrail` is the
floor for the bottom, and the safe-area inset rides inside it.

**There are no seams between the shelves.** A hairline every `shelfW` columns was
there to say the board is nine screens rather than one wide one, and on a Mac —
where three of them are on the screen at once — what it said instead was that
the paper had been cut into pieces. The checkerboard is one surface and runs
straight through; which shelf you are on is the map of dots in the bar, which is
a thing you can aim at rather than a line you have to read.

**The dots by the title are the shelves of this board, laid out the way they
actually are.** A row of dots was right when the desks were a row; nine shelves
are a *square*, so the dots are one — a map you can aim at rather than a count
you have to translate. The one you are standing on is lit, pressing one goes
there, and a board with one shelf draws none. See decisions 56 and 141.

**There is no shelf.** There was: one global row along the bottom of a phone,
drawn as the last row of the grid, holding whatever you kept to hand. It cost a
row of every board on every desk to answer a question the desks, the magic
drawers and ⌘K already answer between them, so it is out and the row went back
to the board — 8×13, 9×14, 10×15. `S.pins` is still loaded, filtered and saved
untouched, and `placeOf()` still returns `desk | null`; `setPin(id,'pin')` is
accepted and means "not a desk". Putting the shelf back means putting back
`shelfStrip()` and `pinTile()` in `views.js`, the two drop branches in
`gestures.js` and the `.pinrow` block in `chrome.css`. **Don't reintroduce it by
accident** — if something needs to be to hand from everywhere, that is a magic
drawer on a desk. See decision 53.

**A tool in the grid bar is something you change while you are working;
everything else is a settings row.** The lock is leftmost, because it decides
what every other gesture on the board means. Then **grid or list**, and only
those two — which of the two ways of *looking* at a board you want is something
you change while working, while Book, Calendar and Timeline are what a container
*is* and stay in its editor. (Scroll was a third state on that button — a list
with nothing truncated — and it is gone as a container layout entirely;
migration 33 reads one as a list. The object's own `read: scroll` is a different
thing and untouched.) Then the **spiral**, which makes one of anything wherever
there is room — the same `someKind()` a spawner set to "one of anything" goes
through, so the button and the tile cannot make from two different bags. Then
the **brush**, which opens
*this board's* editor — `objectPanel(id)` for a drawer and `objectPanel(ROOT)`
for the desk, which is the same panel: the desk is a container without a tile,
not a special case, so it gets its own board colour, its own layout, its own
sort and its own lock rather than borrowing the app's. Then the **gear**, which
is the app, and only on a desk. Inside a drawer the gear's place is the star,
which promotes it. A locked board refuses moves and resizes and **never**
refuses the long press — see `G.stuck` in `gestures.js`.

How a board is laid out and how it sorts itself are *not* tools: they are the
"Opens as" and "Sorted by" rows of that editor. The sort was a bar toggle
cycling seven states for a while; a thing you set once and then live with does
not earn a permanent button on a phone.

**A phone board is a chosen number of columns of square cells, and the choice
is the board's.** `small` (8) | `extra` (9) | `large` (10). `S.look.grid` is the
app's **default**; a container may carry a `grid` of its own, and a board with
nothing to say follows the desk it is on. Ask `colsOf(cid)` — reading
`GRID.phone.cols` as "the columns" is the mistake decision 60 exists to stop.
The column count is the *only* number a size changes: the width is the width, so
the columns set the cell and the cell is square so it sets the rows. About 8×13,
9×14 and 10×15 on a 390 × 844 screen.

**Two numbers are measured and the rest is arithmetic.** `MEASURE[device]` holds
how wide a board is and how much vertical room it has, and that is all
`sizeGrid()` works out. On a Mac the width is the scroller's **content** box, not
its `clientWidth` — that includes `.deskscroll`'s fourteen pixels of padding
either side, so the cell came out a whole twenty-eight pixels' worth too wide,
`.grid`'s `max-width:100%` clamped the element back to the honest width, and the
columns and the row height then disagreed by that much. The tiles are laid out by
the grid and were right; the **checkerboard** is drawn from `--checkerx`, which
is derived from the cell — so every square was slightly too wide and the board
drifted left under its own tiles, a couple of pixels at column two and most of a
cell by column twenty-four. Boards differ from each other only in columns, so the
cell (`width/cols`) and the row count (`room/cell`, floored) of a board that is
nowhere near the screen — a pager pane, the drawer you are about to drop into —
are answerable without measuring it. `pageRows(device, cid)` is a function, not
a stored number.

**Nothing new arrives bigger than three cells either way.** `PHONE_MAX_NEW` in
`grid.js`, applied in `sizeOfKind()` — to the derivation *and* to a type's stated
`phoneSize`. An object used to come out at the full width of the board, which is
a first object that has decided the board is about it. The desk's stated sizes
are untouched: 24 columns is a desk. A stated
row count cannot be square on a phone-shaped screen and the square cell wins: it
is what makes every stated size in `KINDS` mean what it says. **A column count
is a coordinate space**, so `setGridSize()` rescales every stored phone box the
way a migration does — rounding half *down*, and scaling the left edge rather
than the column number, which is what makes eight to ten and back the
arrangement you started with. See decision 48.

**The board is exactly as tall as its rows, and it rides up off the bottom of
the screen.** `.deskscroll` is `flex:0 0 auto` on a phone, so the few pixels the
screen has left over fall *below* the board rather than above it. `.main`
carries a bottom padding of the safe-area inset plus a little, because a phone
screen is a rounded rectangle and a row that runs into the curve loses its first
and last tile to it — the shelf used to hold that space and now nothing does.
`sizeGrid()` measures the room from `.main` less the bar less **that padding**,
never from the scroller's own height; forget the padding and the last row is
sized into pixels it cannot be seen in. Which shelf you are on is *not stored*:
`x` and `y` are one continuous coordinate space per container and a shelf is a
window of `shelfW × shelfH` cells onto it, so drag, drop and `freeSpot()` know
nothing about which one you are looking at. The one rule is that nothing may
straddle a seam **on a phone**, enforced in `boxOk()`.

**But a board cell is not a screen cell, and the boundary between them is two
functions.** `gridTile()` subtracts the shelf as it draws (`SHELFSHIFT`), so
anything that reads a cell *off* the screen has to add it back and anything
that writes a box *onto* the screen has to take it off. `shelfShift(cid)` in
views.js is the offset; the sketch gesture adds it, `place()` in gestures.js
subtracts it, and those are the only two places allowed to know. Get it wrong
and it is invisible on the first shelf — a new object made on the middle one
landed a shelf up and a shelf across, and a tile being resized left the screen
until you let go. See decisions 102 and 141. **Two fingers in any of the four
directions walks the shelves**, and so does one finger on a locked board; both
go through the same pager, whose two axes now do the same thing. See decisions
44 and 37.

**A list is a board.** Same controls a grid has: the words edit, the box ticks,
swipe left deletes, swipe right puts it on today (offered only to something
carrying `date`), a hold reorders and a longer hold is the menu. A band obeys
`clickOf()` like a tile — a list used to open the object editor for everything on
it, which sent a task to a page of paper it has no use for. The swipe's backing
is **one** borrowed `#rowact` element positioned over the row that is moving, not
a strip in every band: a list is the one place that can hold two hundred of
something.

**And a row is an eight-by-one.** A list is for looking at things one after
another, so a row is the strip the same object would be on a grid at eight cells
by one — one cell tall, standing **flush** against the one above it, in a column
eight cells wide. On a phone that is the board's own width, so a task in a list
is the strip it is on the desk. `--listrow` is the measured cell, written onto
the **scroller** by `listStyle()` in views.js from `CELL[dev()]` — a list is not
a grid, so `sizeGrid()` never reaches one, and the add box at the top has to
stand in the same column. Flush **up and down** is a `margin-top:-1px` on every
band after the first: each tile carries a one-pixel edge, so two touching ones
draw a two-pixel rule and the stack reads as gapped anyway. Flush **left and
right** is `.flushlist` on the scroller: a list scroller carries more side
padding than a grid one — 22px against 14, and 12px against nothing on a phone
— so the column sat a dozen pixels in from the board it is a view of. It takes
the grid scroller's inset instead, and centres, the way `.is-desk .grid` does;
on a phone that is edge to edge, which is where an 8-wide tile is. The type
chips and a container's own writing keep the reading inset and say so. A name in a band is **one
line**, and it has to say so at three classes — `.drawer.otile .dname` sets
`white-space:normal` and the text-size multiplier restates the size, and both
are two classes and later in the file. Restate the multiplier, don't beat it.
See decision 168.

**A new object has to be *seen*.** `reveal(id)` after creating one. A board is a
coordinate space and `freeSpot()` scans from the top, so on a phone — where an
object is full width — a new thing always lands below the fold. It looked
exactly like nothing had happened. Don't fix it by shuffling the board: things
you arranged don't move.

**`.is-desk` / `.is-phone` on `#frame`** drive responsive rules — the breakpoint is
900px, set in JS, not a media query, because the same classes also need to apply
when you're editing the *other* device's layout from this one.
