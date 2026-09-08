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

## Current state

A working, installable PWA in `web/`. Hand-written HTML/CSS/JS split into ES
modules (`web/js/`) and three stylesheets (`web/css/`) — still no build step, no
dependencies, no framework, no bundler. It runs on iPhone and Mac, persists to
local storage, and works offline.

Everything in the requirements list is implemented **except** sync between
devices (export/import JSON is the bridge). Images, sound and video are all
real.

**Start here each session:** `docs/SYSTEM.md` is the reference for what Bureau is
made of — objects, attributes, types, drawers, the grid, the surfaces, storage.
`docs/ROADMAP.md` holds the current plan in dependency order, and
`docs/DIAGNOSTIC.md` is the last full review — what is wrong, what it measures
at, and what is worth taking from Bear, Things 3 and Notion.

Read `docs/SYSTEM.md` before changing behaviour and `docs/DECISIONS.md` before
changing structure — the second one records things that were decided deliberately
and shouldn't be undone by accident.

## Running it

```bash
scripts/serve.sh              # http://localhost:8000
node test/smoke.mjs           # headless browser check, needs the server running
node test/scale-probe.mjs     # what a render costs as the desk fills up
node scripts/catalogue.mjs out.html   # the specimen book, to a file (Settings opens it too)
```

Open it over http, never as a `file://` URL — the service worker won't register
and the manifest won't load, so you'd be testing a different app than the one
that ships.

`test/smoke.mjs` needs Playwright (`npm i playwright`). It exercises the desk,
drawers, quick-add, the detail sheet, habits and goals, both layouts, persistence
across a reload, and an offline reload. **Run it after any non-trivial change and
before saying you're done.** It writes screenshots to `test/shots/` — look at
them, this is a visual app and a passing assertion doesn't mean it looks right.

**Writing a phone block: the board is nine screens and you are on one of them.**
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
| `grid.js` | Grid geometry: `GRID`, `CELL`, `lay()`, `boxOk()`, `freeSpot()`, `ensureBox()`. Lives here, not in the views. |
| `look.js` | Styles, the sixteen colour slots, `hexOf`/`objColour`, `applyLook()`. |
| `mutations.js` | `toggleDone`, `del`, `create`, `quickAdd`, repeat scheduling, `toast`. |
| `tiles.js` | `gridTile()` — the one place that decides how an object looks on a grid — plus rows, cards, list bands, book/scroll entries, and what a click does (`tileTap`). |
| `views.js` | The desk and a drawer — the only two places there are. Also the time layouts (`viewMonth`, `viewTimeline`), the desk map and the settings panel's body. `render()` replaces `#app`'s innerHTML wholesale, then saves. |
| `sheet.js` | The three surfaces an object opens onto — reading, writing, and the picture — rendered into `#sheetHost`, **separately** from `render()`. |
| `panels.js` | `openPanel()` — **every menu in the app** — plus `openMenu()` for a popup hung off a button, the command palette (⌘K), the context menu, and `sampleObject`/`sampleTile` for drawing a type as the thing it makes. |
| `gestures.js` | Pointer-based drag, resize, lasso, swipe. The fiddliest code in the app. |
| `motion.js` | Every movement: `openTile()` (drawer, cabinet, curl, lift), `pop()`, and the pager that slides between boards. Nothing in it ever delays a state change. |
| `gravity.js` | A board that has **let go** — the rigid-body solver behind Sand and Tumbling. Reads nothing but the tiles' rectangles; writes nothing but their transforms. |
| `plans.js` | A **plan** — a saved board, in `S.plans`, captured and stamped. Not an object and not on any grid. |
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

**Rendering is full re-render.** `render()` rebuilds `#app` from `S` every time.
Don't add targeted DOM patching; it isn't the bottleneck and it would break the
mental model. The exceptions are the reading and writing surfaces, which render
into their own host so typing doesn't destroy the field you're typing in, and a
tile being edited in place, which doesn't re-render at all — respect both. The one thing carried *across* a rebuild is the board's scroll offset
(`SCROLL` in `views.js`, keyed by where you are), because a new scroller starts
at the top and moving a tile on a long desk used to throw you back to the first
screen. That is one number, not a foothold for patching — see decision 29.

**A tile shows less as it gets smaller.** `sizeClass()` in `tiles.js` stamps
`sz-short` (h≤1), `sz-thin` (w≤1), `sz-narrow` (w≤3) and `sz-mini` (1×1) onto
every tile, and the stylesheet only ever *takes away* what there is no longer
room for — a tile crossing a threshold loses a line rather than rearranging
itself. 1×1 is handled in `gridTile()` rather than in CSS: the tile is the type's
mark and nothing else, because at 40px a title is three letters and an ellipsis.
A drawer front at `sz-short` reaches the same answer from the other side — the
name goes and the mark sits over the knob — and it does it in CSS, off a
`.dmark` the plain front always renders, so the rule cannot take the name off a
checklist that happens to be short. At `sz-thin` a container is a spine instead,
which keeps the name. The classes are spliced into the first `class="` of
whatever `drawTile()` returns, so a new branch gets the behaviour without being
told. See decisions 26 and 50.

**What you typed is what you read.** `md()` made every non-blank line its own
`<p>` and threw every blank line away, so one Return read as a paragraph break
and deliberate empty rows read as nothing. **One Return is a line break** inside
the paragraph; **a blank row ends it, and every blank after the first keeps a
line of room** (`<p class="vspace">`). Counting the run is what tells the
ordinary gap between two paragraphs apart from spacing somebody asked for —
asking whether a paragraph is open cannot, because a heading has already closed
itself. `plain()` is untouched: a tile is a face, and a run of blanks on one is
still one break. See decision 157.

**A tap is answered once.** `onUp` answers a tap on a tile and the browser's
trailing click used to answer it again — invisible for everything idempotent,
which is nearly all of `tileTap`, and fatal for play, where the first call
started the video and the second stopped it before a frame had gone by. The tap
branch sets `gestureFlags.suppressClick`, like every other gesture that acts on
pointerup, and clears the selection the click would have cleared. See decision
158.

**A tile prints words, not markdown source.** `plain()` in `util.js` takes the
marks off and keeps the writing — not `md()`, because a face is not a page and
a `<ul>` in a 40px band is a bullet and half a word. `.tiletext` is `pre-line`,
so a note printed on a tile keeps the paragraphs it was written with. This was
wrong for a long time and every type that ships a body template was putting
`**` and `##` on the desk. `oneline()` is the same thing flattened, for a band.
Titles are *not* reduced: a name is edited in place as raw text, and showing it
differently from what you type in is worse than an asterisk. See decision 68.

**A body fills the face it is printed on.** `.tiletext` is `height:100%` inside
a `.dbody` that is `flex:1;overflow:hidden`, so the tile's own height is what
decides how much shows. It carried `-webkit-line-clamp:4` for a while, which is
why a note six cells tall printed four lines and left the bottom half of its own
paper blank — the clamp was doing a job the box already does. `BODY_ON_FACE` in
`tiles.js` is the character cut, and it is deliberately larger than any face can
show. Cut the text *then* escape it: slicing the escaped string cuts through an
`&amp;` and prints the entity.

**The board can let go, and nothing in the model moves when it does.**
`S.look.gravity` — `off | sand | tumble`, read with `gravityMode()` — and
everything on the shelf you are looking at falls into a heap at the bottom of
it. `gravity.js` is a real rigid-body solver, and its whole safety argument is
that the boxes are untouched: a body's *home* is the rectangle its tile was
drawn in, the fall is a `transform` over the top, and switching it off is the
arrangement you had to the pixel. **One solver, two answers, one number apart**
— sand sets `1/I` to zero so a body cannot turn, exactly as a wall's zero mass
makes it immovable; tumbling gives it real inertia. Don't write sand as its own
little system: it is not a simpler simulation, it is this one with the rotation
taken out.

Four things in it were learned by looking and will bite anyone who changes them.
**A leftover substep is a bomb**: the overlap bias is `BIAS/dt`, so running a
frame's seven-microsecond remainder as a short step fires hundreds of pixels a
second into every contact and a settled pile shivers for ever — whole steps
only, remainder carried. **A perfect grid falls into a perfect heap**, which is
correct physics of an impossibly precise release and looks identical to sand, so
a tumbling body starts a few degrees off true with a little spin and a shove, all
three off a hash of its own id (the pinboard's trick, decision 75, for the same
reason: the same board falls the same way twice). **The pen is a shelf** — on a
Mac the shelf-*row* you have scrolled to, not the whole nine-shelf board, or
flipping the switch tips the desk two screens below the one you are looking at.
And the **switch does not render**: turning it off has to walk the tiles home,
and a render replaces every one of them with a fresh element already sitting
there. `gravityApply()` patches the class and drives the settle, the way
`markTilt()` does. See decision 166.

**A falling board's tiles are not where their boxes say they are**, and that is
the one class of bug this mode produces. Anything that reads the model to decide
what the *screen* means gets a stale answer, quietly. Two were shipped and fixed:
`justmade` animates a transform and an animation beats an inline style, so a new
object sat in its cell for the length of the drop-in and then snapped to the heap
(`justmadeglow` under `.grid.falling` is the glow without the fall — the arrival
*is* the fall there); and the Magic Selector asks which objects the rubber band
crosses to tell a sketch from a lasso, found three tiles nobody could see, and
made nothing. A falling board keeps the **size** you drag out and gives up the
**place** — `G.falling` in gestures.js, and `placeAtPending()` takes a size that
arrives with no position. Before adding anything that reads a box to decide what
a cell means, ask what it does on a board that has let go. See decision 166a.

**Bureau is a portrait desk, and a phone on its side measures nothing.**
`sideways()` in grid.js — `S.device==='phone'` and a viewport wider than it is
tall. Landscape has about a quarter of the vertical room, so measuring it cut a
shelf from fifteen rows to four; and the shelf is *also* the unit the window is
cut from, so the one you were standing on became a slice of the board with
nothing on it and the desk went **blank** until you turned the phone back.
`sizeGrid()` returns early and `gridOfContainer()`'s straddle repair sits out, so
the board holds the geometry it had; the stylesheet keeps it its own width, or
the `1fr` columns would stretch across a screen twice as wide and `cellW()` and
`--rowh` would disagree about where a cell is. The manifest asks for `portrait`
as well, which is what an installed copy honours — this is what happens when it
is not. It matters for gravity because pouring the desk sideways *is* the
rotation gesture. See decision 166a.

**Things come out of a new object as it lands, and that one is physics.**
`spray(x, y, id)` / `sprayAt(id)` in motion.js: stars, rings, spirals and bars
thrown outward and pulled down, on **one canvas** in `#fx` that is made on the
first burst and removed when the last bit dies. The only canvas in the app, and
the only movement that isn't a keyframe — a keyframe is a path decided in
advance and every bit here needs its own arc. Colours come from `objColour()`
and the root's `--glow`/`--brass`, never a palette of its own. `S.look.spray`
is **which shape** (stars by default; sparkles, spirals, squares, hearts,
confetti, a mix, or nothing) and each preset carries its own count and scale.
Every option in Settings is drawn by the same `bitPath()` the burst uses, so a
sample can't drift from the thing it makes.

**A burst belongs to a new object and to nothing else.** There is exactly one
caller — `reveal()` in views.js, 450ms after the drop begins. It used to come
out of anything you touched, which made every tap on a busy desk a small
firework and made the app feel like it was congratulating you for opening a
drawer. Arriving is the event worth marking; touching is not. Ticking still
answers with `pop()`'s **ring**, which is a different thing and stays. Don't
put a `spray()` call back on a tap path — and if you add a second caller, it
had better be an arrival. See decision 85.

**A star is drawn, not stamped.** `roundPoly()` rounds every one of the ten
corners into the path itself, because canvas's `lineJoin:'round'` only rounds a
*stroke* and these are filled; and every star and sparkle carries an
**outline** in `SPRAY.line`, which is the style's own `--ink` — dark on paper,
light on a dark style, named nowhere. It is passed into `bitPath()` rather than
read off `strokeStyle`, because two of the shapes stroke themselves in their
own colour and Settings draws its samples through the same function.

**Filing lands, and the picture is read before the state changes.** `fileTo()`
in motion.js: a drop that files an object flies a picture of the tile from
where you let go into the front it went into, shrinking as it goes — toss's
mechanism aimed inward. The source element and its rect must both be captured
**before** `fileInto`/`save`/`render`, because `render()` replaces `#app` and
the element in your hand is detached a moment later with a rect of nothing.
The drawer's own `swallow` bump moved to the *end* of the fall, so the two read
as one event; that is a delay on an animation and not on a state change. A
**gather** keeps the bump and does not get the fall — nothing went into
anything, a third thing was made. See ROADMAP 0b-next item 1.

**An animation never holds anything up.** This is the one rule in `motion.js`
and it is easy to break by accident. A tap files, ticks or navigates the
*instant* it lands, `render()` runs, and the movement is drawn over the result
— which is why the flying drawer front goes into `#fx` and the pager hangs off
`#frame`, both outside the element `render()` replaces. Never `setTimeout(…,
300)` around a state change to "let the animation finish": that is how an
animated app becomes a slow one, and it breaks every test that reads state
after a click. See decision 38.

**How a thing opens is a property, and the front says which.** `openingFor(o,
box)` in `motion.js` — `auto | dive | drawer | cabinet | curl | lift | none`,
per object then per type. `auto` asks what the object *is*: a container
**taller than it is wide** at two cells of width or more swings open, any other
container is one you **go into**, a paper shape curls, everything else lifts.
Don't add a branch on a kind's name to get a different movement; add a value, or
set `opening` on the type.

**A drawer is somewhere you go, not something that comes to you.** `dive` is the
default: a still picture of the board you are leaving grows until the drawer's
own rect is the screen, and the board you are arriving on is framed **inside
that rect** the whole way. What is behind a drawer front is another desk, and
the movement should say so. The picture is cloned **before** `go()` and inserted
**after** it — the clone is free, laying a second board out is not, and it must
not land on the frame the tap has to feel instant on. It carries no ids and no
`data-drawer`/`data-row`, because the drag's lookups are not scoped to `#app`
the way `tileOf()` is. See decision 103.

**Both halves of a dive come out of one function, and all three of its rules
were learned by looking at frames.** `dive(el, r, mr, going)` in motion.js
writes four waypoints; `'away'` is the picture and `'into'` is the board
arriving, and they are exact inverses, so the mouth and the destination agree
at every waypoint. **One front** — flying a separate copy of the drawer as well
puts two of the same tile on two scale curves and reads as the drawer coming
out. **It pans as well as zooming** — scaling about a corner keeps the tile in
the corner, so it never covers the screen however far it grows, and the old
board shows round the edges at the end. **And a linear scale is not a zoom** —
a steady camera grows the picture by the same *factor* each frame, hence `z**f`
and not a lerp. The mouth is a **hole in the stack, not a hole in the
picture** — the picture goes *under* the arriving board in `#fxunder`, and what
you see through the drawer is what the picture does not cover; the dark of the
carcass sits between them. The **front dissolves** over that mouth, because a
clip is instant and cutting the mouth out at the tap made the drawer pop open.
A second element is fine; a second *curve* is what made the first version
wrong, so the fading front rides the mouth's own waypoints.

**A rectangle with a rectangle taken out of it is a mask.** The mouth was an
`evenodd` `clip-path` for four versions, and a non-rectangular clip cannot be
composited — it is a mask on a layer that is scaling, which is a repaint every
frame, and it cost four dropped frames in every dive. Identical with `nonzero`
winding and free with a plain rect clip on the same element, which is what
named it. Don't reach for a clip-path to cut a shape out of anything that
moves; restack it instead. See decision 142.

**The way out is the way in, backwards.** `leaveTile()` in motion.js — the
knob along the bottom and the chevron at the top of the bar. The board you are
standing in shrinks into the front it came out of, the board you arrive on
starts zoomed in on that front and settles back around it, and the carcass and
the front close over the mouth behind you. It is the **same four animations run
`reverse`**, called with the same arguments `dive()` got on the way in — not a
second set of keyframes, which would be eight more chances to disagree about
where the mouth is. So the picture takes `divein` (on the way in that was the
board *arriving*, framed inside the mouth) and the board you arrive on takes
`diveleave`. Walking off a *desk* keeps the small settle: desks sit beside each
other, not inside each other. The knob can climb more than one level, so the
mouth is the nearest ancestor with a tile on the board that has just been
drawn, not necessarily the drawer you were in. See decision 104.

**Nothing that flies carries a filter.** One inherited `drop-shadow` on the
diving front — scaled to four times size, so a hundred-pixel blur recomputed
every frame — cost 25fps against the pull-out's 60, and it was the *only* thing
that did: not the clone, not the second layout, not the throw distance, not the
checkerboard. The flying picture drops the board's filters too, and a desk has
one on every torn shape. A scale is a repaint every frame and a filter costs per
element per repaint — decision 101's finding, from the other side.

**Nor a shadow, nor a flank, and the reason is raster scale.** A scaling layer
is rasterised once, at the animation's **maximum** scale — so a picture ending
at four and a half times the screen is twenty times the pixels, each paying for
every `box-shadow` and every `.dside` depth face on it. `.fxleave`/`.fxback`
therefore zero both on everything they contain. Those two and nothing else, on
purpose: a shadow and a flank are what you cannot see on a board flying past at
three times size in a fifth of a second, and a moulding and a grain are what a
drawer front *is*. And `#app` gives up the wood for the length of a dive
(`.app.diving`), because the picture is behind it now. See decision 142.

A container is a **cabinet when it stands** — taller than it is wide, at least
two cells across — and a drawer at any other shape, however big. Which way round
it is, not how big: an area threshold used to give doors to a 4×3, which is a
drawer in every piece of furniture ever built. See decision 54.

A cabinet wears **two knobs**, close in either side of the seam, and a drawer wears
one — `tiles.js` asks `openingFor(o, box)` rather than repeating the size test,
so setting a tall drawer to "pulls out" puts the single knob back. Pass the box
being drawn: a sorted board packs tiles into flowed boxes `lay()` knows nothing
about. See decisions 50 and 54.

**The seam is the tile's, not the knob strip's.** `<i class="dseam">` hangs off
the tile and runs `top:-1px` to `bottom:-1px` — the whole height, overshooting by
the front's own border width so the line cuts *through* the border at both ends.
It is the gap between two doors and a gap goes all the way; it used to live on
`.dfoot::before`, which on a `knb-bottom` front is the bottom third of the tile,
so the seam was a scratch down one panel.

**A knob is turned out of the same wood as the front.** `--knob` defaults to the
drawer's own colour and what makes it a knob is the *light on it* — a radial
highlight at the upper left, a shaded underside, a contact shadow — all in
`.pull`, so every shape gets it. It used to be a flat disc of a lighter shade,
which is a sticker rather than a handle and gave every drawer a colour nobody
had chosen. `knobtone` (lighter/darker) and `knobc` (a colour outright) still
override, in that order.

The light is a **highlight, not a coat of paint**: the lit spot is small and the
body of the knob *is* the front's colour, falling away into shade on the far
side. The first pass ran the white mix out to a third of the radius, which is
most of the face lightened — and a knob that is a paler disc of the front is the
sticker this was meant to replace, wearing a gradient.

**A knob is a slot, like an edge, a panelling and a colour.** `knobOf(o)` —
five positions, named by `knobSlots()` and dressed per aesthetic. Everything an
aesthetic adds only *adds* to `.pull`, which already turns the knob out of the
front's own wood and lights it from the upper left; say what it is made of, do
not re-light it. Girando's position 0 is a **volute**, which is how its default
knob is a spiral without a special case. `orb` is not a position — it was in
the picker with no CSS behind it for a long time and quietly gave you a round
one. See decision 96.

**Starful Gothic is a drawing, and it has no ground.** It sits further from
the other aesthetics than they sit from each other: no moulding, no bevel, no
relief, and — the part that took two goes — **no fill**. A thing on this desk
is its outline. The eleven colour slots therefore do nothing here, which is the
aesthetic's own answer rather than an omission. Its four dressed border slots
are the same hand-drawn line varying only in weight; a stock is still five
different sheets, drawn in line rather than in ground.

Four rules, each of which cost a session to learn. **The line lives on
`.dpanel`, and the tile itself must carry `filter:none`** — a torn shape
outlines itself with four drop-shadows tracing its own alpha, and with the
ground gone the only alpha left is the writing, so it haloed every letter.
**The line is three passes** — a long wander, a short tooth, and a fine
chipping — and the window on the chip grain is narrow at *both* ends: finer and
the line is dust, coarser and the bites become gaps and it reads as broken. A
one-turbulence version with coarse chips was tried, was cheaper, and looked
wrong; these numbers were found by looking. **The noise is per element**, so
two tiles the same size draw the identical line — three filters differing in
seed, staggered by `--wob`, is what breaks up the repeat. And **animate
`--pen`, never `filter`**: a `url()` filter is not compositable, so animating
it repaints every outline sixty times a second and an idle board sits at 42fps.
See decision 101.

**A filter costs about 0.2ms per element per *pass* per repaint**, and both
halves of that matter. Cutting passes is real — wander alone is 41ms across
fifty-two tiles, adding the chip makes it 51 and the tooth 61, against
Victoria's 40 — and so is cutting elements, which is why knobs, tick boxes,
grains and spine bands carry none: no three-pixel wander shows at the size they
are drawn. What is *not* a lever is the filter region: tightening it from 116%
to 106% changed nothing measurable. Don't add a filter to something small, and
don't add a pass without measuring it.

**A slot may be pinned to the aesthetic it came from.** Every look slot stores
a *position* and the aesthetic says what the position is made of — that is the
whole system, and its one sharp edge is that a Golf 97 group box you liked
becomes a Victorian raised panel the moment you switch. So a stored value may
be **pinned**, written `golf97/fielded`; a bare one follows the desk and
re-dresses on every switch, which stays the default. `slotKey()`/`slotFrom()`
in model.js parse it and `slotRaw(o, prop)` reads it per object then per type.
Nothing needed a migration, because every value written before this is bare.

The renderer stamps `<fam>sty-<aesthetic>` beside each slot class — ask
`dress(o, fam)` in look.js, never write `bd-${o.border}` by hand — and the
per-aesthetic **tile** rules are keyed on that (`.drawer.dtile.pn-fielded
.pnsty-carca`) rather than on `html[data-style]`, so four families on one tile
can be dressed by four different aesthetics. **The chrome stays on
`html[data-style]`**: panels, buttons, the bar, the wood, the typeface, the
radii — none of it is a slot and none of it can be pinned. Two traps: the old
selectors carried an attribute and beat the base rules on *specificity*, so the
new ones must sit **after** the base block in the same stylesheet; and a
selector that does not get converted fails **silently** — the tile renders,
just undressed, which is what `slotScoping` in the smoke test exists to catch.
See decision 98.

**Five families, one table.** `FAMS` in look.js — `bd` border, `pn` panelling,
`kn` knob, `tx` grain, `bn` binding, `st` stock — each naming the property it
is stored under, its positions, its fallback words, the key an aesthetic names
its own under, and the reader. `famSlots(fam, style)` is the picker's list and
`famAll(fam)` is every other aesthetic's, grouped. Add a family here and the
pickers, the pins and the scope classes all come along; add it anywhere else
and none of them do.

**A drawer front is worked, and the working is a *slot*.** `panelOf(o)` — per
object then per type — stamps `pn-<name>` and the rest is CSS. The five keys
(`plain`, `cockbead`, `fielded`, `reeded`, `ogee`) are **positions**, not
descriptions, exactly as the seven `bd-*` are: what is stored is the position,
and each aesthetic names and dresses its own. Position 2 is Victoria's raised panel,
Carca's ashlar block, Golf 97's group box and Stelaine's floating slab — so a
front re-dresses on a switch and is itself again when you come back. Ask
`panelSlots()` for the names, never `PANELS` (that is the fallback and it is
Victoria's words). Don't rename the keys: the stored value surviving a switch is
the entire point. See decision 93.
Two rules carry all five, and they are the spine's generalised: **a multi-stop
gradient across a narrow band reads as a half-round**, and **a moulding is a
fixed thickness at any size** — px thicknesses, proportional insets, so a wide
drawer gets more reeds rather than fatter ones.

**One light, at the upper left**, because that is where `.pull` puts its
highlight. A cockbead therefore needs **four gradients, not one turned two
ways**: the bottom bead is lit along its *top* edge and the right bead along
its *left*, and one profile mirrored lights them on their outer faces instead —
a rim lit from four directions, which reads as glass. Each side also carries
the **quirk**, the shadow line where the bead meets the field, always on the
inner edge. Nothing here invents a colour: the wood is `--c` and the light and
shade are white and black at low alpha over it.

The moulding is `<i class="dpanel">`, **a real element**, because both
pseudo-elements are taken on a drawer tile (magic frame `::before`, texture
`::after`) — which leaves it two of its own. It sits under the texture on
purpose, and a magic front asking for an ogee gives up its gilt lines: two gilt
frames on one drawer is a picture frame shop. See decision 88.

**A grain is a slot, and it lives on an element.** Six positions — `none`,
`fine`, `weave`, `wideweave`, `herring`, `wash` — named and drawn by each
aesthetic (Carca's hurdle, Stelaine's aurora, Golf 97's chevron, Aeros'
gloss sweep). The last three used to be `ruled`, `speckle` and `pattern` and all
three were **noise** — a hard rule, a field of dots, a lattice of figures, each
a drawing laid over a tile that already has a colour, a moulding and a knob to
say. Migration 34 rewrites them, on **both sides of a pin** (`golf97/speckle` is
a legal value). Two `repeating-linear-gradient`s at opposing angles do *not*
make a herringbone — they cross everywhere and draw a lattice however they are
offset; four corner triangles with the left pair shifted half a cell do. See
decision 164. There were eleven global names for a long time, which is a list
of *pictures* rather than a vocabulary and meant cut stone and a 1997 dialog
wore the same graph paper; migration 24 folds the eleven in. Ask `textureOf(o)`.

It is drawn on `<i class="dgrain">`, not on the tile's `::after`, because an
object cannot spare that pseudo-element — half the object shapes are already
spending it. The weight travels as `--txo`: the container rule is three classes
and used to win the argument outright, so every opacity written on a `tx-` rule
was dead from the day it was written.

**A texture is printed on the front, so it goes under what stands on it.** The
depths on a drawer front, bottom to top: `.dpanel` and `.dgrain` (0), the knobs
(1), the name (2), the mark and the seam (3).

**The shelf is inset, and tilting the phone looks into the cavity.** One
transform on **one** element: `.grid` — the tiles and the checkerboard they
stand on are one piece of furniture and move together — while the opening
(`.deskscroll`) stays put and clips, and the wood shows along the edge you
tilted away from. **Translate, never rotate**: the drag maths divides by the
grid's own rect, and a translate cancels out of every coordinate in the app
where a `rotate3d` makes `getBoundingClientRect()` return the bounding box of a
trapezoid and quietly breaks the drop. The rim's shading is a `::after` at
`z-index:5`, because an inset shadow paints *under* its element's own children
and every tile on the board is one of those — and its spread must be the
negative of its offset or the shadow lands outside the box. **Never read the Euler angles as coordinates**: `Rz(a)Rx(b)Ry(g)` is singular
at beta ±90, which is a phone held upright, and there alpha and gamma are the
same rotation — so gamma jitters while the phone is still. `onOrient()` builds
the rotation and tracks the **screen normal against its rest attitude**, which
is continuous at any attitude and needs no case for how the phone is held.
Gravity-in-device-frame is stabler still and cannot see yaw, which is most of
the gesture, so it is not enough. The shelf runs
**against** the phone — `TILT_SIGN_X`/`TILT_SIGN_Y` negate the sensor, because a
thing in a recess lags the movement rather than chasing it, and the first
version had it the other way and read backwards in the hand. Negate at the
sensor, never in the CSS: the rim's shading derives from the same two variables
and stays on the right side of the movement for free. `--tiltx`/`--tilty`
(−1..1) are written on `#frame` by motion.js §20b²; `--tiltpx`/`--tiltpy` are
the only two numbers worth turning, and `BUREAU.tilt(1,0)` parks the shelf so
you can look. **Depth is throw, not sensitivity** — parallax displaces by depth
× tan(angle), so a deeper shelf moves further for the same tilt; narrowing
`TILT_RANGE` instead reads as twitchy. The cue is *relative* displacement, and it is
between the board and the **opening** — which is what the four walls draw. See
decision 116. **Which surfaces answer the tilt is a choice** — `tiltMode()` in model.js, four
modes (`off | desk | window | both`), each gated on its own class (`.tilt-desk`,
`.tilt-win`) stamped by `render()` from `S.look`, so a desk set to windows only
pays for none of the cavity. The old stored boolean still reads as `both`.
**One slider each** (`tiltdesk`, `tiltwin`): the second axis and the floor's
extra travel are fixed fractions of the one number, written by `applyLook()`,
so the four properties cannot disagree. **The board is the back panel of a slot, and it goes *over* what surrounds it,
never under.** Four `.cavwall` quadrilaterals join the opening's corners to the
board's, and each polygon carries the board's own offset — so tilting opens one
wall out and closes the opposite one, which is what looking into a bookshelf at
an angle does and what a fixed rim can never say. The board is **inset**
(`margin` on `.grid`, never padding — `cellW()` measures that rect) by
`max(S.look.deskinset, --tiltpx)`: a back panel that can shift further than it
is inset runs out past the opening, so the slider is a floor that adds room
beyond the movement. Nothing is ever clipped. See decision 116, which reverses
110 — the checkerboard is the board's own paper and must not slide under its
own tiles. It is off by default, phone only, and it eases to zero for a
drag, the pager, a panel, a surface and reduced motion — all read off state or
the DOM, so nothing else has to know it exists. See decision 108.

**`render()` writes `#frame.className` wholesale**, so anything else living on
that element has to be restated in `render()` or the next one wipes it. That is
how the cavity came to work until you ticked something and then stop, silently.

**Nothing on the desk shimmers.** A magic drawer used to be holographic foil,
lit from `--holox`/`--holoy` on `#frame` — the phone's tilt, or the pointer.
It was tacky, and it is gone along with the whole tilt apparatus. Furniture does
not react to being held. If you want a surface to catch light, give it a reason
first and read decision 42.

**A book wider than it is tall is lying down.** `lying` in `drawTile()`'s spine
branch — the same test a cabinet answers from the other side (decision 54):
which way round it is, never how big. One class over the *same three elements*,
so every binding transposes for nothing; the block in board.css is a
transposition of the standing one, and neither of the spine's two laws (a
multi-stop gradient across a narrow band is a half-round, an ornament is a
fixed thickness at any size) needed changing. The round back is along the
**bottom** — that is what looking down at a book on a table shows — the
lettering takes the drawer front's size rather than the spine's, and the
roll-off answers the vertical eye (`--f`) with the cylinder's inversion. A 1×n
can never reach this, so decision 50's fallback is safe. See decision 124.

**A container one cell wide is a spine, whatever face it asked for.** The title
runs up the tile, the way it does on a book on a shelf — `box.w<=1` is part of
the spine branch's own condition in `drawTile()`, which is why it sits above the
checklist and the calendar rather than after them. One cell *square* is still the
mark and nothing else, handled earlier: at 40px a spine has no length to set a
name along. A magic one gets `magicspine`, which gilds the two bands it already
has rather than the frame every other magic front wears — inset 5px on a tile one
cell wide is the whole tile.

**A background layer's per cent resolves against the container *less that
layer*.** The ribbed spine's gilt fillet was a 1px-tall layer at the same per
cent as its 9px hub, so it sat about a pixel and a half low on every band of
every book — the same number, two different boxes. Give both layers the **same
size** and put the gold inside the hub-sized one, and they cannot come apart.
(The lying spine also needs the *turned* gradient: a 180deg shade in a 9px-wide
full-height strip runs along the band instead of across it.)

**A spine is bound, and the binding is five choices — three ornaments and two
backs.** `bindingOf(o)` — per object then per type, like a knob or a border slot
— stamps `bn-<name>` and the rest is CSS: `plain` (cloth), `banded` (gilt rules,
the default), `ribbed` (raised hubs with a fillet down the middle of each),
`flat` (a square back) and `chamfer` (a bevelled one). Under the first three the
back is **round**, which is seven stops of one horizontal gradient and most of
what makes it a book rather than a coloured rectangle; the last two are the one
thing a binding is otherwise forbidden to restate, and changing it is what they
are for. A chamfer's gradient stops are **hard** — one that eases is a round
back again. See decision 152.
**Ornaments are a fixed thickness and a proportional position** — a cord is the
same width on a pamphlet as on a folio, so every thickness is px and every
position %; 5.5% hubs were four grey belts across a tall spine.

The part that breaks is the *lettering*, not the ornament. The title runs
vertically inside a `<b>` whose height is its inline length, and that `<b>` is
the measuring frame — without a definite height `text-overflow` has nothing to
measure. **Both places that draw a spine must wrap the title** (the container's
face and the `sh-spine` object shape); one that forgets prints its title across
the book. The three panelled bindings shorten that box, so their lettering is a
step smaller — which is true of the real thing and is what lets a title that
fills a plain spine still fit between two hubs.

**A spine's lettering is chosen against the cover, by contrast ratio.** It is
the one piece of type printed straight onto an object's own colour, and gold is
a *mid* tone — so it hides on a pale cover and a mid one alike, and `isDark()`
cannot answer "can this be read". `spineInk()` in tiles.js hands the stylesheet
`--spineink` and `--spinegilt`; `readsOn()`/`contrast()` in look.js are the
primitives. It burnishes the gilt **bright** on a dark cover and deepens it to a
**bronze** on a pale one — the metal changes, not the design.

**A vertical title has to be told to centre.** `text-align:center` on the `<b>`,
and it is not optional: the flex box around it centres the *box*, which is
already full height, but where the line sits **inside** that box is
`text-align` — and the default `start` is the *top* of a `vertical-rl` box,
which `rotate(180deg)` then flips to the bottom. So a short title on a tall
spine sat on the tail, and no `align-items` could reach it. A fit test cannot
see this: the length is right and only the position is wrong, which is why
`everyTitleIsCentred` measures the text run's centre and not just its length.

**Take the best candidate, never the first that passes a threshold**, and never
narrow the candidate set by a side test first — both are the same bug, and both
shipped once. A pass/fail test swaps cream for near-black on a mid cover and
*loses* contrast; choosing the candidates by `lum < 0.5` means a cover at 0.46
never sees the bronze that would have doubled its ratio. Offer everything, take
the max. Guarded as `spineReads` across eleven slots times four styles. See
decision 87.

**A style is a typeface, and that includes an object's words.** `--serif` is
whatever the style declares; `.dname`, `.tiletext` and both inline editors are
set in it. They were pinned to `--sans` — the system face — which meant a note
and a task were the one thing on the desk not wearing the style, and Starry's
Optima drawer sat next to a San Francisco note.

**An object is paper, and paper is in the system.** `.otile` had exactly one
per-aesthetic rule in the whole stylesheet: every note in Golf 97 was the same
tile as every note in Victoria. A drawer is wood — colour, edge, panelling,
knob, grain; an object is the same list minus the hardware, plus a **stock**,
which is what the sheet *is* as against what is printed on it. Ask `paper(o)`
in tiles.js for the three classes. `borderOf()` falls back to `panel` for a
container and `plain` for an object, which is structural rather than a branch
on a type's name.

**A stock is never written, and its fallback is the aesthetic's.** `stockNow()`
in look.js: an object with nothing said wears whatever `defaults.stock` this
aesthetic makes paper out of, so it re-dresses on a switch with nothing stored.
That asymmetry is the point — a drawer is *given* a rolled look at birth because
furniture in one room came from different hands (decision 92), and paper comes
off one pad. Don't add `stock` to `randomLook()`. Shapes stay global: `sh-note`
and `sh-index` say what a thing *is*, the way a face does.

**Two layers under every tile, and they are real elements.** `<i class="dpanel">`
(the moulding on a front, the mount on an object) and `<i class="dgrain">` (the
grain), spliced into whatever `drawTile()` returned — the same trick the size
classes use, so a branch nobody has thought about gets them. They had to become
elements because a tile's own `::before` and `::after` are spoken for several
times over on an object: the gilt frame takes one, and the index card's red
margin, the habit's bar, the idea's folded corner, the tab and the chit take the
other. They are also the only surfaces the drawn-line filter may touch. See
decision 99. A **third** joins them inside the shelf — `<i class="dside">`,
below.

**How much of a face you see is where the thing stands plus where your eye is,
and only the second moves.** Every tile that stands proud carries `--px`/`--py`
— its centre against the board's, −1..1 — written once per render by
`perspOf()` in tiles.js. Stand in front of the middle of a bookshelf and you see
the right side of everything to your left before you move at all; that is the
resting answer. Turning the phone adds `--tiltx × --turn` to it in `.dside`'s
`--ex`/`--ey` — the same `--tiltx` that slides the board, so the faces and the
board cannot disagree about which way you are looking — and `--turn`
(`S.look.turn`, 0–100) is how much that counts. **Every face is a `transform`
on a promoted layer of its own**: that is the whole performance argument. A
face that follows the phone changes on every frame, and a version that changed
a `background-size` and a `box-shadow` — paint — cost 21fps across a board. A
`scaleX` on a composited layer costs the compositor and nothing else, and a
120-frame sweep still does **0 layouts**. The one exception is a spine's
cylinder, a `background-position` per frame, allowed because a board has a
handful of spines; don't give the same treatment to anything there are fifty
of. Never move a face by anything that paints.

**And it is its own setting — two of them.** `S.look.depth` is the drawers,
cards and pictures and `S.look.bookdepth` is the books; px, zero is off on
each, and `standsOut()` asks per tile which slider it stands under, so a board
can have the books turning and the drawers flat and draw no layer at all on the
drawers. Not the tilt's: the perspective reads with the desk sitting still, so
have it without the tilt or the tilt without it. Two rather than one because a
flank and a roll-off are different surfaces and one number was a compromise
between them — the books looked right and the drawers only technically worked.
A spine **redeclares `--deep`/`--deepy`** from `--deepbk`/`--deepybk`, so the
head and tail bands and `--spinerun` go on reading the property they always
read rather than needing rules of their own; `--bkshade` is the roll-off's
weight, because on a cylinder the shade spans half the spine at any depth and a
width cannot say how far round it has turned. Within each, one number:
`applyLook()` derives the top-and-bottom band from the flank so the two cannot
disagree. See decision 117c.

**And a drawer's depth is light on its face, not a face on its side.** The
flank is honest geometry and nearly invisible — a front's character is the
moulding, the knob and the grain, and a band of grey down one edge is not part
of it. Six more cues, each **one number 0–100** in `S.look` with every property
derived from it in `applyLook()`: `arris` (a two-pixel eased edge, the one that
reads most like a drawer), `facelight` (the face lighter on the edge turning
towards you), `facesweep` (the spine's specular on a flat front — wide, because
narrow and bright is decision 42's foil), `recess` (the *opening's* depth: the
desk's lip shading the front), `knobturn` (the light on the knob moves, the wood
does not) and `fieldshift` (the panel's field sliding in its moulding — the only
real parallax of the six). **Every one is a transform or an opacity on a
promoted layer**, which is the condition of their existing: 0 layouts and no
repaint across a 120-frame sweep with all six on. Zero is off and off costs no
element — `faceLayers()` gates per tile. They go to things with a face at the
same `FLANKED` line the flank uses; not to a book, which has its own answer, and
not to paper. There is **still no cast shadow**, now for a structural reason as
well: `.drawer` is `overflow:hidden` with `isolation:isolate`, so nothing drawn
inside it can reach the board behind it. See decision 118.

**Which way round a cue runs is a setting, one per cue.** There is no single
right sign for all of them — a flank and a roll-off are opposite by geometry, a
field set back behind its moulding slides against the frame in front of it, a
specular follows your eye while a shadow runs from it — and a wrong one is
invisible until it sits beside a right one. `CUE_DIR` in model.js is the
baseline, `<key>flip` reverses it, and `applyLook()` writes `--sgn-<key>` off
the key. Every rule reads **its own** eye: each layer declares `--e`/`--f` and
nothing under it touches `--ex` again — on the layer and not the tile, because
a cue that is off has no layer and the choice then costs nothing. Two baselines
are deliberately not the geometry: the **flank** now runs the book's way rather
than opposite it (reversing half of 117b — a desk that reads as one object beat
a desk correct in six places separately), and the **field** slides the other way
from how it was first written. The board's own slide stays out of the table:
`tiltflip` has said it since decision 114. See decision 119.

**Nothing that reads as prose may be a flex container.** `.mini` was
`display:flex`, so a note with a `<b>` in it was dealt out into one narrow
column per bold word — invisible on a Mac, and a wall of vertical single-word
strips on a phone. `.rangerow` had the matching bug from the other direction:
`display:flex` at 0,1,0 against `.field label` at 0,2,0, so every slider in the
app was being drawn by the *label* rule, stacked and uppercased at 10px. It is
an explicitly placed grid now — name and value on one line, full-width track
beneath — and it states a specificity `.field` cannot beat. See decision 118a.

**A decoration gets none of it, and thickness is the wrong test.** An ornament
wears no tile at all (decision 86), so there is no box for a side face to belong
to — the flank drew a hard grey rectangle round a cut-out plant. *Having a box*
is the test. Same for `sz-mini`, where eleven pixels of flank on forty is a
quarter of the tile, and `.dpanel` already bows out; and for a tile in your
hand, which still carries the `--px` of the cell it came out of. The numbers and
the layer are one condition (`standsOut()`), so a tile cannot carry one without
the other.

**`.dtop` is two different things, and the depth face comes first.** A drawer
front's name row is `.dtop`, and so is the *top* face of the flank inside
`.dside` — which sits earlier in the DOM, so `querySelector('.dtop')` on a tile
finds the face and not the name. The CSS is safe (`.dside > i` and
`.dmark ~ .dtop` are both scoped by structure), but anything reading a tile by
hand wants `:scope > .dtop`.

`.dside` is the third spliced layer and it carries all four faces of a tile: its
two pseudo-elements are the upright ones and two children (`.dtop`, `.dbot`)
the horizontal ones, each `scaleX`d or `scaleY`d by `max(0, ±--ex/--ey)` so a
face is drawn only from the side it can be seen from. They were inset shadows
for one version — cheaper in elements, but a shadow is paint and cannot follow
the phone. `depthOf(o)` is the multiplier and paper (0.18) gets
no layer at all. One light, at the upper left, the same one `.pull` has always
had — so both sides are darker than the front and the left one only less so; a
face lit *brighter* than the tile reads as glare on glass. A spine gets no flank
but it does get shade: its two upright layers are soft roll-offs half the spine
wide (a cylinder has no edge for a face to end on), and **their sign is the
box's inverted** — your eye moving left shows a box a new surface in shade, but
turns a cylinder's left side *towards* you, so its shade grows on the right. The
specular underneath (`--spinerun`) goes the same way. See decisions 117 and 117b.

**A custom property resolves where it is declared, not where it is used.** The
cast shadow was going to be the third cue — `--shx`/`--shy` on a tile, fed into
the `--shadow` that board.css builds — and it did nothing whatever, silently,
because `var()` inside a declaration is substituted on the element the
declaration is **on**: a `--shadow` declared at `:root` takes root's `--shx`,
which is unset, and every tile inherits that already-resolved string. Declaring
`--shadow` on the tile would work and would beat the Shadows switch's own zeros,
which is the trap two paragraphs of this file already name. Don't reach for this
pattern; it is not lazy substitution.

**When a number will not hold still, measure something that has to.** The fps
sweep in this container drifted far enough under contention that one
configuration read 59 and then 53, and one run had three cues cheaper than one
of them. Style-recalculation and layout **counts** are deterministic where
clocks are not — contention changes how long they take, never how many there
are. Decision 101's discipline still stands for filters; this is the estimator
to use when the machine is noisy.

**The shape list is silhouettes, and one of them is nothing.** `SHAPES` is what
a picker offers; it lost eleven — filing tab, torn chit, book spine, ruled line,
bar, progress bar, streak, ticket, pill, switch and the sliver — because a third
of the list was a rectangle with one detail on it and several said the same
small thing twice. It gained **`none`**: no ground, no edge, no shadow, no
stock, the board straight through. Two of the eleven are still *drawn* and no
longer offered — `SHAPES_KEPT` — because a Task **is** a sliver and a Progress
bar **is** a row of blocks; ask `shapeChoices(cur)` for a particular object's
ring, which puts the kept one at the head when that is what it is wearing, and
`shapeName(k)` when you only need the word. Migration 33 folds the rest in: a
removed shape needs one for the same reason a removed kind does. See decision
163.

**A fragment wears the tear until it says otherwise.** `tornOf()` reads
`o.shape` first and only then the family, so picking another shape for a scene
takes the tear off. Before that it was an `||` with no way back and every
fragment was torn for ever.

**Three types were a property wearing a name, and are gone.** A **habit** is a
task with a repeat rule on it; a **dream** is a goal with no day owed, which
`goalStanding()` has said since decision 146; an **ingredient** is a line of a
recipe, and a recipe is a card you write on now. Migration 32 turns each into
the type it always was. **A removed kind needs a migration even though `K()`
falls back** — the fallback keeps the object working while it stores a name that
resolves to a note, so it turns into one at the first thing that reads its kind.
See decision 160.

**A Label is a caption on the grid.** Four cells by one, gilt frame, words set
large because they are read across the desk — and it is what gives `sh-band` a
job, a shape that existed with no rule behind it. **An Event is a diary leaf**:
weekday over day over month on a block of its own colour, torn along a
perforation, the name beside it and under it how long it runs. It knows a *day*
and a *duration* (or a run of days, since it carries `span`) because Bureau
stores a day and never a clock time — that is the design, not a limit. See
decisions 161 and 162.

**What cannot be a slot is tagged.** A decoration is a made object — a mantel
clock cannot be re-dressed into a gearwork the way a knob is re-dressed into a
boss — so each carries `aes:[…]` and the picker leads with `decorFor(style)`,
the rest behind the same "From other aesthetics" disclosure every slot family
has. A tick box stays a fact about the desk (decision 83) and takes the
aesthetic's `check` until you pick one; the way back **deletes** the key rather
than storing `''`. See decision 100.

**A magic drawer asks up to five questions, ANDed, and they are not only about
fields.** `filter.rules` is an array; ask `rulesOf(f)`, never `filter.rule`,
which is the old single-clause shape still read for a pre-migration-21 backup.
Half the useful clauses are **meta fields** — `@kind`, `@in`, `@under`, `@tag`,
`@trait`, `@title`, `@body`, `@done`, `@made`, `@holds`, `@colour` — marked
`meta` in `FIELDS`, read off every object rather than gated on a trait, and
named with an `@` so they cannot collide with an attribute. `@under` is a chain
of parents (`ancestorIds()`), which is what makes "a task, anywhere inside the
film" sayable; it walks `parent` by hand because `childrenOf()` runs magic rules
and a rule that ran rules would call itself. A field carrying `pick` tells the
builder to offer a list — containers, types, tags, traits — rather than a box to
type an id into. There is no OR and there is not going to be one — an OR needs groups, groups need a builder, and a builder is a
query UI, which is the thing tags-become-drawers exists to avoid. A date clause
compares as a *date* (`numOf` read "2026-08-19" as 2026) and its value may be
one of five words — `today`, `tomorrow`, `week`, `month`, `year` — resolved when
the rule runs, so "before next week" keeps meaning it. See decision 63.

**A checklist face is a stack of task-sized lines, and it refills itself.** One
line per cell of height on a **phone** and two on a **Mac**, counted out by
`--clrows` from the box being drawn. The density is answered **per device**
(`clFit(d)` / `setClFit(v, d)` in model.js): the cell is the same fifty pixels
on both and the *screen* is not, so two to a cell is a good Mac front and a
twenty-four-pixel task on a phone. A bare stored word means both, which is what
every desk saved before this holds. See decision 140, as amended.
Each line is drawn the way the task tile is — paper and ink (the same `--dink`
remap `.otile` does), the task's own 38px box and name type — and what says the
stack is one thing rather than three loose tasks is the **magic drawer's gilt
frame**, worn by every checklist face because a face that refills itself has
earned it. Done lines don't print:
the front is the next few things to do, not a record (inside, `keepsDone()`
still keeps them), so ticking a line pulls the ones under it up a row and the
next thing inside steps onto the bottom — `clRefill()` in motion.js draws that
shuffle *after* the render, never instead of it. A face with nothing to show is
a label again — name and a quiet line — which is also what the type picker's
sample is. See decision 79.

**The add box is opt-in, and even then it can go by itself.** Ask
`showsAddBox(c, box)` for the front, not `takesTyping(c)` — that answers whether
a container takes dictation at all. The box is off unless `addbox` says
`'show'` — on a checklist face it costs a whole task-sized line — and off
regardless at two cells tall or less, where the line is worth more as an item.
Inside the container it is always there. See decisions 77 and 79.

**The drawer along the bottom holds things, and you take them out where you
want them.** Pick a tile up on a phone and it
stands ajar under the tile; let go over it and the object leaves the board and
waits in the **holding space**, which is how a thing is carried to another
desk. Its mouth is the **whole open front** (`AJAR_GRAB`) with a second, higher
line to leave by (`AJAR_KEEP`) — coming in and going out are two numbers, which
is what a detent is; one line is a switch that shuts while you are aiming at
it. Dragging a `.helditem` **out** of the panel is the third act of the
gesture: built in the pen's shape (the press is claimed without consuming the
tap, so a tap still puts it down here), aiming at a drawer or at a **cell**,
and the panel `standaside`s — it slides to its own closed position while you
carry one out and comes back when you let go, because it is over the board and
`elementFromPoint` would hit it before any grid. It slides rather than closing
because the gesture is still running and it has to come back if you let go over
nothing; a phone panel is a fixed overlay, so nothing is relayed out either
way. See decision 128. A held object is `parent: HOLD` — a *reserved id*, `'__hold'`, exactly as
ROOT is, not an object — so there is nothing to seed, migrate, export or reap;
ask `isHeld(o)` and `heldObjects()`, go through `holdIt`/`unholdIt`. Both boxes
are cleared going in, because HOLD is not a coordinate space, and `ensureBox()`
places it fresh coming out. **A magic drawer cannot see into it** —
`inContainer()` refuses a held object before scope and before the archive, or
"everything unfinished" would draw it straight back onto the board it was taken
off and it would be in two places. The panel is `fit`: as tall as what is in
it. Held things are drawn at their **type's desk size**, not the box they had —
a phone task is eight cells by one, and scaled to a thumbnail that is a sliver.
See decision 107.

**The rail's pull has two detents, and they are the same drawer read
literally.** A little way (`PULL_HOLD`) opens the drawer onto what is in it;
the whole way (`PULL_OPEN`, a quarter of the screen) pulls it clean out of the
desk, which is the new-object picker. The long one is unchanged, so the gesture
that already existed still means what it meant. The ajar drawer and the pulled
one are **one element** — `makePull()` — because two would disagree about where
the mouth is. It is an overlay rather than a taller rail: the rail is a flex
item and growing it would relayout the board under the tile in your hand. And
the drop is aimed **geometrically**, off one number measured once, because the
front is `pointer-events:none` and `elementFromPoint` falls through it — and
the mouth starts a lip above the *rail*, not at the top of the front, because
the front is an overlay standing on the board's last row. `aimDrop()` asks about it **first** — it is not on a board at all, so
there is nothing under it for it to beat.

**A tile inside a `<button>` is a tile that falls out of its own cell.** A tile
renders its own `<button>`, and a button inside a button is a parse error the
browser fixes by *unnesting* it — silently, taking the layout with it. That is
why `.kindtile` and `.helditem` are `div`s with `role="button"`.

**The picker leads with stated categories, not with a tally.** `PRIMARY` in
model.js — the drawers first (Drawer, Sorting drawer,
Project, Life drawer, Goal), then Prose & Poetry, Checklist, Calendar, Collage,
Timeline, Note, Fragment, Label, Recipe, Achievement, Task, Progress bar,
Counter, Event, Image, Audio, Video, Decoration, Control, Spawner. Everything else is behind *Every other
type* and is still reachable by name, by shortcut, from the type builder and
from **every other type picker in the app** — `pickGroups(skipPrimary)` narrows
only the new-object picker, because narrowing what a type can *be* is a
different decision. No type is drawn twice on one screen. A container that says
what it makes still leads with that type wherever it sits in the order,
promoted into the row if it isn't a major. Adding a major is one name in
`PRIMARY`. See decision 130.

**Five of the majors are *categories*: you press them to be asked which.**
`family` on a kind is the list, and it leads with that kind where that is a
real thing to make — the first kind of note is a Note. **Note** (idea, thought,
problem, question, **quote**), **Prose & Poetry** (the old Book, renamed twice —
poem, novel, short story, essay, **script**; **Story is gone**, it was this with
a different binding), **Project** (film, novel, game, song, album, app, art
piece, trip, **script** — a thing you write *and* a piece of work, and
`inFamily()` keeps it out of the flat list either way), **Decoration**
(**window**: a decoration you can see through) and **Fragment**, which is the
only one that is *only* a question: `cat` marks it,
there is no generic fragment, and pressing it always asks. `familyPanel()` draws
the second screen and `inFamily()` is what keeps a member from being listed
twice — it is skipped from *Every other type* only when its category is itself
a major, so a family behind a door nobody can open cannot happen.

**Everything a type asks before it exists is in `newOfKind()`, once.** Pressing
a tile and typing its letter are the same act: the shortcut used to call
`create()` outright, so a sorting drawer made with `Q` skipped its own question
and landed as an empty front. `picksFile`, `asksTag`, `asksLife`, `asksDone`
and `family` all branch there, and every one of them reads `pending.cell`
first and puts it back — `closePanel()` clears it and the answer still has to
land in the cell you held. See decision 135.

**A project's cover is a slot, and a placeholder is not a fallback.**
`projCoverOf(o)` — per object then per type — says which cover the project face
wears: `film` a poster, `album` a sleeve, `song` a record, `game` a boxed case
with the platform's strip down the left, `app` an icon squircle, `art` a
canvas, `novel` the spine it already had, `trip` the ticket. A picture on the
object is always the cover; with none, each kind draws its **own** placeholder,
because an empty film should read as a film you have not made yet rather than
as a project you have not filled in. Three depths on a cover tile and they must
not be guessed at — the cover at 0, the scrim at 1, the report at 2:
`.projtile > *` lifts every child into the positioned layer, which had been
silently overriding `.projcover{position:absolute}` for as long as that line
has existed.

**A goal is a playing card, and what it is *called* is read rather than
stored.** `goalStanding(o)` — no deadline is a **dream**, thirty days or fewer
is a **challenge**, anything else is a goal. Derived, so putting a date on a
dream makes it a goal without re-declaring it and a slipped date cannot leave a
Challenge lying about itself. It is drawn as a Bicycle card and needs all four
of the things that say card: a **heavy corner radius** (the one exception to
decision 125, and a *proportion* rather than a token, because a card is die-cut
that way), the **linen tooth**, a **ruled panel** in the goal's own colour, and
an **index in two opposite corners with the second upside down**. The face is
the card's white — a card's colour is the ink on it — so `--c` moves to the rule
and the index. Its default box is 3×2, a card laid down. The name is still the
face and the run is still a hairline along the bottom, never a bar. See
decision 146.

**An achievement is picked, not written.** `finishedThings()` is the list —
ticked objects, and goals and projects whose work is all done. `st.length>0` is
the load-bearing clause: every tickable thing under an empty container is done
vacuously, so without it an unstarted project is offered as an achievement.
`pastTense()` in util.js puts the first word in the past and **only** off a
list of verbs it knows: "Bike shed" and "Bill's birthday" look exactly like
verbs, so a title it cannot vouch for comes back exactly as written.

**A life drawer wears an object, and a picture beats the drawing.**
`lifeArtOf(o)` names one of the nine in `LIFE_ART` (decor.js, beside the
decorations and drawn the same way); an object carrying `media` wears that
instead, which is where this is meant to end up. No front at all on that face —
no panel, no knob, no border — the thing lies on the desk with its name on a
small label. `makeLife()` in wire.js is the one place the answer lands.
See decision 136.

**A control has three forms and `ctlForm()` reads the table, never a name.**
Two states is a **switch**; more than two is a **button that changes colour**,
stepping the aesthetic's own eleven slots, because a list has no lever position
to be at; a `range` is a **dial**, 270° of sweep with a stop at each end.
`cycle().length<=2` and not "has a cycle": a two-value list is a switch wearing
a list. Pressing a dial is one detent of ten and wraps. See decision 137.

**At one cell wide there is no room for a name or a printed value, so what is
left has to be the hardware.** The stylesheet takes both away there, and for two
of the three forms nothing was left: a **button** had no lever to fall back on
and a **dial** lost its knob with the words, so both drew a blank tile. A button
draws its stepped-colour push disc (`box.w<=1` in tiles.js) and the dial keeps
its knob. That was "the control turned invisible when I set it to change
aesthetics" — not the aesthetic, the form.

**And a switch is a piece of hardware, so it comes in sizes.** `switchShape(box)`
— one cell is a **push button**, one cell in either direction is a **light
switch** (a plate with a bat thrown up or down), two cells each way and up is a
**two-pole knife switch** hinged at one end and closing into its jaws. All three
say their state by *position*, never by colour. The last two are inline SVG
rather than stacked boxes, because a blade at an angle and a tapered bat are
shapes; the knife's viewBox leaves room **above** the slate for the blades to
stand open in, or the only state that is not the default is clipped. **A control
wears no tile at all** — no ground, no edge, no shadow — because the plate, the
base and the button each carry their own, and a second one under them is what
made every control read as a sticker.

**A progress bar is blocks, and *only* blocks.** There was a continuous
`--pct` track on `.sh-bar`'s `::after` from before decision 138, and when the
blocks arrived it stayed — so every bar drew its number twice, the analog
reading lying across the bottom row of the digital one. `barSteps`, `barFilled`
and `barGrid(o, box)` in model.js: two increments to a cell of width, each a whole
cell tall, so a ten-step bar is five cells long without being told — and
narrower than that it **wraps** rather than shrinking the blocks. The columns
are evened across the rows, because a half-empty last row reads as broken
rather than wrapped. Pressing a block sets the bar to it and pressing the one it
is on steps back; a bar that names a `tracks` refuses the press. See decision 138.

**A spawner is a spiral, and bigger it is a box with a line in it.** Square
corners like everything else on a board (decision 125); the spiral is drawn
**only where the box is square** — `gensquare` — because it is a mark that winds
out from its own middle and a four-by-one has no middle for it to wind out of.
The icon is eight half-arcs whose ends alternate either side of the viewBox's
centre line, so it is even by construction and reaches the edge; the old one was
four relative arcs starting a pixel off centre and wound off to one side. In a
square box the mark takes whatever height the line leaves, by `aspect-ratio` and
not by a width in `cqw` — a proportion of the width is the wrong number in a
column — and `.fieldin` has to restate `height:auto`, because the base rule is
`height:100%` and that is the whole tile.

The rest of it, unchanged:

**A spawner is a spiral, and bigger it is a pill with a line in it.** One cell
square the spiral **is** the tile — no ground, no edge, no shadow and no stock,
drawn in the object's own colour and filling the cell, because a coloured square
with a small mark on it is a button carrying a picture of a button. Wider or
taller it is a **pill** (`--pill`, the token that exists for exactly this) with
the press at the head and the box you type into filling the rest; what you type
names the thing it presses out. The line goes only at one cell of width. That is the whole of what the
Text field type was, so there is no Text field type — pressing and typing are
two sizes of one machine. The branch sits **above** the 1×1 branch in
`drawTile()` deliberately, or a spawner shrunk to a stamp would be an anonymous
mark. A seed may state its own box (`sz`/`phoneSz`), which is how a project is
born holding a band rather than a spiral.

**A collage is the board inside it, drawn small.** `faceOf(o)==='collage'` —
every child at the box it actually occupies, on the container's own columns.
A moodboard is an *arrangement*, and the old front re-packed it three to a row,
which is a picture of something else. A child that has never been placed gets a
synthetic box in flow order rather than being dropped (a face may not call
`ensureBox()` — that is a mutation), and something in it that is not a picture
is drawn as its own colour, because a wall with holes where the notes are is
not the arrangement either. See decision 134.

**Three kinds of drawer, and `magic` is called a *sorting drawer*.** The stored
kind key is unchanged — `magic` in the code, "sorting drawer" in the interface,
exactly as `container` is "drawer" — so nothing needed migrating and every
`has(o,'magic')` still reads. What changed is `asksTag` on the kind: placing one
opens `tagFirstPanel()` first, which offers every tag the desk has (counted) and
a field for one it hasn't, and `makeSorting()` in wire.js is the **one** place
both answers land, so the naming, the placing and the reveal cannot drift.
*No rule yet* still makes the drawer and opens the rule builder — the question
is a shortcut past the common case, never a gate in front of the uncommon one.
A **life drawer** is the third: `face:'life'`, the project's own
`projectStat()` walk drawn with `.projtile .lifetile` and one CSS rule taking
the bar's row out. It has no percentage on purpose — an area of your life has
no end for one to be a fraction of, and a bar at 62% against Health is worse
than no bar. See decision 131.

**A control is a switch on the board, and the table is the feature.** `CONTROLS`
in mutations.js says, for each of the desk's own settings, how it is **read**
and how it is **flipped**; `ctlOf(o)` names which one this object is for.
Nothing outside that table knows which settings are switchable — a new one is a
row there and the tile, the press and the object editor all come along. A
**switch** is on or off and is drawn as a lever, never printed: the state has to
be readable across the desk. A **dial** walks a list and prints where it is.
Neither pushes an undo move, for decision 65's reason — `S.look` has no id for a
step to point at, and flipping it back is the same press. A control is
furniture, not chrome: it moves, resizes, takes a colour and wears an aesthetic.
See decision 132.

**Anything drawn as a bar asks `barPct()`, never `goalPct()`.** `goalPct` is an
object's own milestones; `barPct` is what a bar is actually drawn at, and a
Progress bar may name a `tracks` — a container reports how much of everything
under it is ticked, a streak reports its run against `target` days, and with
nothing tracked (or a tracked object since deleted) it falls back to its own
milestones. The fallback matters as much as the feature: what happened somewhere
else is not the bar's fault. `sh-bar` is its shape — on a goal the bar is one
detail of a card, here the bar *is* the tile. See decision 133.

**`random` is not a kind, and it must never reach `K()`.** A Spawner (was
Generator) may be set to make one of anything. `K('random')` answers `note`, so
a spawner set to anything would draw as a note factory and press out notes —
ask `makesAnything(o)` and `genSaid(o)`, and resolve it **once** in `dispense()`
with `someKind()`, which picks from the majors with containers, controls and
decorations taken out. Every "Add a …" placeholder in the app goes through
`genSaid()` for the same reason.

**A tile made of its own colour has to say so three classes deep.**
`.drawer.gentile{background:var(--c)}` is two classes; `.drawer.otile{background:
var(--paper-2)}` in chrome.css is also two and *later in the cascade*, so from
the day an object became paper (decision 99) the spawner rendered as a blank
sheet with white writing on it — silently, for versions. Write
`.drawer.otile.<tile>` and set `background-color`, never the shorthand: a stock
sets `background-image` and the shorthand would fight it for the grain and lose.

**A thing made "in" a sorting drawer is made where that drawer lives.** A
magic drawer *collects; it does not hold* — `inContainer()` ignores `parent` for
one — so an object whose parent is a sorting drawer is in no board at all: the
drawer will not list it unless the rule happens to match, and nothing else lists
it either. It was made, saved, and nowhere. `homeFor(id)` in model.js is the one
answer — the nearest ancestor that actually holds — and `create()`, `quickAdd()`,
`spawnInto()`, the picker and the sketch all go through it. That was the whole of
"some drawers don't propagate new objects".

**A tag is a magic drawer waiting to happen.** There is no filter mode and no
filter bar; clicking a tag anywhere calls `drawerForTag()`, which finds the
magic drawer collecting that tag or makes one. If you are tempted to add a
filter UI, add a drawer instead — that is the same instinct that deleted the
tabs (decision 22).

**A decoration stands on the board rather than in it.** `isDecor(o)` —
`has(o,'decor')` — is the one thing exempt from collision: `boxOk()` returns
true for it outright *and* filters decorations out of the obstacles it checks
everything else against, so a drawer can be placed where a plant is standing
and the plant doesn't move. It is still on the grid — box, snap, drag, resize,
pages — it is only the overlap rule that lets go. It wears no tile at all (no
paper, border, shadow or name), is drawn above the tiles, and on a **locked**
board takes no pointer events, because a cut-out's transparent corners would
otherwise swallow taps meant for what it stands in front of. The built-ins
are inline SVG in `decor.js` so they can read the style — `currentColor` is the
object's colour, plus `--brass`/`--glow` — and each suggests the slot it looks
best in, plus its **own tight viewBox and tile size** — an ornament stands on
the floor of its box rather than floating in it. An uploaded **SVG is never put
through the canvas**; rasterising is
the one thing that throws away what an SVG is for. New file → add it to `SHELL`
in `sw.js`. See decision 86.

**A frame goes round a picture; a window goes in front of a view.** One slot,
`frameOf(o)` (per object then per type — never `o.frame`), holding six picture
frames and four window ones; `isWindow(o)` is the second group. A window is
painted in **`--c`**, the object's own colour, like everything else on a board —
it was `--wood`, which made every window walnut and the colour picker useless on
one. Its
muntins are their own element (`.wbars`) because they sit *above* the image and
a tile's two pseudo-elements are spent — drawn as gradients so a bar is a fixed
px thickness at any size and every position is a %. The view behind the glass
moves with `--tiltx`/`--tilty` and the bars never do, which is what keeps this
clear of decision 42: nothing is behind a photograph, so a picture frame stays
still. It is also the one place the parallax needs no argument — the frame *is*
the occluder the desk's own cavity has to imply. See decision 113.

**A file is what its name says when its type says nothing.** `accept="audio/*"`
is a request the picker has to translate, and `audio/wave`, `audio/x-wav` and the
empty string are not what it translated it to — a `.wav` came back greyed out and
unpickable. `MEDIA_EXT` in model.js names the extensions outright and
`importMedia()` reads the extension when the MIME type says nothing. **A video
wears no button**: the tile is the control, and it asks for `#t=0.1` (plus a
`loadedmetadata` seek in wire.js, in the capture phase, because media events do
not bubble) so an unplayed one shows a frame rather than a black rectangle.

**Anything made of a file opens onto the media surface — sound and video
included.** `isMedia(o)` routes; `isPicture(o)` is still the image case and
`isPlayable(o)` the other two, and `acceptFor(o)` tells the one file input what
to offer. A picture is stored as a downscaled data URL, a sound or a video as
the **Blob itself** (base64 is a third bigger), with a 60MB ceiling;
`hydrateAssets()` makes an object URL for a blob. On the *board* a **sound is a record with a play
button in its label** and a **video is the video**, and pressing either starts
and stops it — decision 144, which walks part of 71 back. The expensive half of
71 still holds and is still enforced: a sound draws **no element at all** until
it is pressed, and the `Audio()` it makes lives in a module map outside the DOM,
so a board of a hundred costs a hundred discs and an unrelated render cannot
silence the one that is playing. A video has to show a frame, so it does carry
an element, at `preload="metadata"`, and a render does stop it. One at a time,
because a desk plays one thing at a time. `create()` deliberately stores **no**
`media.type`, so an object follows its kind's `mediaType` until told otherwise —
it used to stamp `type:'image'` at birth, which made every Audio a photograph.
See decision 71.

**A picture opens onto the picture, and so does an empty one.** `isPicture(o)`
in `model.js` — it carries `media`, and `mediaTypeOf(o)` is `image`. That is a
property, so an Audio type states `mediaType:'audio'` rather than an empty media
field being guessed at as a photograph that hasn't arrived. The surface is
`openViewer(id)` / `S.viewId` in `sheet.js`, beside reading and writing; the
routing is at the **tap** — `tileTap`, `openObj`, the context menu — so
`openRead()` still means one thing and the Read button on a picture with words
in it doesn't bounce. An empty picture is a dashed mount on the board and the
file picker itself on the surface; `importImage()` calls `renderSheet()` when
the file lands, because the file comes back long after the button was pressed.
See decision 49.

**Difficulty is the third axis, and nothing else stands in for it.** `diffOf(o)`
— 1 to 5, teardrops, `DIFFS` in model.js. Priority says how much a thing
matters and duration says how long it is; difficulty says what it will cost you
to *start*, which is what actually decides what gets put off. It feeds urgency
not at all — urgency is time against time — and it **starts at 1**: an unranked
thing has no difficulty, but there is no task that is zero hard.

**Priority is a rank of 0–5, and 0 is a real answer.** `prioOf(o)` returns null
or a number — never `o.prio || …`, which folds "a dream, nothing to act on" into
whatever the fallback is. It is *importance*, not urgency: urgency is a deadline
coming up, which is `deadline`'s job. The stripe's **weight** is the rank rather
than three named colours. See decision 72.

**A repeat is a rule, and `from` is the half that matters.** `repeatOf(o)`
normalises (it still reads the four old words), `repeatSaid(o)` says it in
English, `nextRepeat(o, doneOn)` gives the next day. `from:'date'` counts from
the day it was due — the bins go out on Tuesday either way; `from:'done'` counts
from the day you finished it — you water the plant a week after you last watered
it. Because completing spawns a fresh object (decision 5), finishing early needs
no special case. A generated copy carries `fromRepeat` and wears the glyph. See
decision 73.

**Locking is one switch, not one per board.** `boardLocked()`, backed by
`S.look.locked`. A lock is which mode you are in — reading or arranging — not a
fact about one drawer, and unlocking each drawer as you walked into it was
arrange-mode by another name. Nothing carries its own `locked` any more. See
decision 74.

**Urgency is a subtraction, and nothing stores it.** `urgencyOf(o)` in model.js
— the days you have to a deadline, less the days the work needs (`dur` minutes
divided by `workday()` hours) — because *three hours due tomorrow and three
weeks due tomorrow are not the same situation*, which is the thing sorting by
date can never say. Five rungs (`URGES`: Room · Ahead · Soon · Tight · Behind),
and the answer carries the arithmetic so the editor can say **why**. Three
rules, each of which is a bug if you forget it: a **soft** deadline reads one
rung lower than the identical hard one and so can never reach Behind; a thing
with **no** deadline has no urgency at all — null, not 0, exactly as an unranked
thing has no priority; and the day a thing merely *sits* on does not count, or
decision 62 is undone in one line. Duration is optional and its absence costs
nothing — with no estimate the slack is simply the days left. Ask `urgeRank(o)`,
never `o.urg`: there is no such field on any object. It is in `FIELDS` anyway,
marked `derived`, which is what lets a magic drawer collect on it (matchRule
skips the trait test and reads `get()`) while the rollup picker refuses it.
`SORTS.urgent` is the sort and has deliberately no reverse. Drawn on the
deadline chip as **the line thickening as the slack runs out** — never as a left
stripe, which is what priority means. See decision 120.

**A selection box is four edges, not one path.** `.ghost` draws its line on a
child pinned at `inset:2px` rather than as an `outline` at a negative offset.
Both are inset by construction, and the outline is *correct* — but an outline is
one path around the whole box, so an engine that clips or rounds it anywhere
loses whole sides of it at once, which is what it went on doing on the phone. A
border on a child is four independent edges and a side can only go missing if
something takes that side away by name. Structural beats correct-in-theory when
there is exactly one of the thing at a time.

**Two concentric corners are one radius and one inset.** The goal card's rule is
`max(0px, var(--cardr) - var(--cardin))`, and both read `--checkerx` — the
board's own two-cell step — rather than `cqw`. The card sets
`container-type:inline-size`, and **an element is not its own query container**:
`cqw` written on the card resolves against whatever container is above it while
the same `cqw` on `.cardrule` resolves against the card, so the two arcs were
being measured against different boxes and could not have agreed. The same trap
is waiting for anything else that sizes a container and its children together.

**A corner is round or square, and nothing in between.** Four tokens in
board.css — `--radius` 4px (a control, a chip, a field), `--radius-lg` 6px (a
panel, a menu, a card), `--radius-d` 2px (drawers), `--pill` 999px (round ends,
all the way). A **squircle** is the shape of software and the one thing on this
desk that could not be a made object: a knob is turned and is a circle, a front
is sawn and is a rectangle. Don't write a raw `border-radius` in the 6–12px
band in the chrome. An **aesthetic** may still say otherwise for its own tiles
— Aeros is glossy and round and that is its argument — which is the line
between the twelve declarations that stayed and the forty-six that went. The
sharp end keeps a hair of radius on purpose: dead square reads as a rendering
fault rather than a made edge. Guarded off the *computed* style, because a
token nobody applied is a rule nobody follows. See decision 125.

**Three buttons off a card: When, Done and Due.** `SCHED_PENS` in panels.js,
drawn as sewing buttons. **A placed one wears a tab on its own day**, carrying
the same `data-schedpen` — so the drag, the tap-then-tap and `placePen()` are one
code path, and a date you put down is a date you can pick up and move. Anything
asking about the *lane* has to say `.schedpens` now, because the month has pens
in it too. There is **no `On` field**: the month had already drawn that day, and
`09/14/2026` cannot say where the 14th falls against the other two.
**Dropping one is what creates the deadline** — both
deadlines are opt-in traits, and `placePen()` adds the trait as it writes the
date, because picking a thing up and putting it down is one act. A **placed
button leaves the lane**: it is on the day it was put on, and a tray still
showing it was drawing the same fact twice. The carry is a **transform on one
rAF** — it was `left`/`top` plus an `elementFromPoint` on every pointermove,
which is a layout and a hit-test per event on a pointer that fires faster than
the screen. See decision 154. **Drag one onto a day, or tap it and tap the day** —
`G.type:'pen'` in gestures.js claims the press *without consuming the tap*, so
a finger that never travels falls through to the click that takes the button
into your hand. `placePen()` is the one writer for both ways, including that
dropping a button on the day it is already on takes it off. The ghost is a copy
carrying `pointer-events:none` (which is what lets `elementFromPoint` find the
day), and the day under the finger is asked of the document each frame — the
month is in a scroller and a cached rect goes stale.

**There are no date rows, and there must not be.** A button sitting on the 14th
says where the 14th falls against the other two and against the days the work
takes; `09/14/2026` in a field never could, and it is a second answer to a
settled question. The month is the readout. The work is a **highlighter stroke
drawn over the day**, with no blend mode: `multiply` is right on parchment and
invisible over the red deadline, which is the one day the run has to be seen
crossing. See decisions 125 and 126.

**Everything a task is weighed by is one page, called `When`.**
`schedulePanel(id)` — the name, the day it sits on, both deadlines, the
duration, the difficulty, the priority, the urgency they produce, the repeat
rule and the tags. **Repeating is opt-in** — it came off `task`'s attrs and is
offered beside the ranks, with migration 25 keeping it on anything already
running a rule. The chip **is** the answer, so it arrives carrying a rule and
the section asks no "Never / Yes" underneath itself; saying never is the one
button that takes the trait off. See decision 129. **A page, not a bubble**: a month grid and nine rows is a
sheet, and decision 27's "a question about one tile belongs beside it" was
right when this asked one question. **Tapping a task opens it** (`onclick:'when'`
in `CLICKS`) and *When…* on the long press opens the same one — one
destination, two ways in. The object editor is not a duplicate: it answers what
an object *is* (look, structure, traits), this answers what it is *worth and
when*.

The month is **always drawn** and carries four marks: the day it sits on
(yellow), the day you aim for (orange), the day it is owed (red), and the days
the work takes as a grey **rule along the top edge** — `workBand()`, reaching
back `duration ÷ workday()` days from the nearest deadline. That last one must
be an edge and not a fill: its final day is nearly always the deadline itself,
so a grey background loses to the red one and a three-day run reads as two.
Those four are the only colours named outright anywhere in the app — they are
signals, not slots, for the same reason `late` is red everywhere.

A rank is **one outlined mark with its number inside it** — a star for
priority, a teardrop for difficulty, the same two marks they are drawn with
everywhere else — and pressing it walks one to five and round to nothing. Five
marks filled to the answer is a picture of the *scale*, and the scale is not
what you want to see; decision 72's argument was against a **select**, which
hides the scale behind a word, and a mark carrying its own number hides nothing.
See decision 155. `PRIOS` still runs 0–5, because 0 is a real answer (decision
72) and the object editor's numbered row still offers it outright; the mark
prints a dash for "no rank", which covers both nothing-said and rank zero. What an object hasn't got
is one row of chips in the same page (`data-want` names the attribute), each
wearing its own mark.

**A test that asks whether the markup is right cannot say whether you can reach
it.** `reachable` in the smoke test presses the menu item, presses each chip,
ranks both scales, reads the urgency line back and checks the month's marks
against what the object carries; write that kind of pair for anything new that
has to be found. See decisions 122 and 123.

**A deadline is hard or soft, and a thing may carry both.** `deadline`/`dead` is
the **hard** one — missing it costs something; `softdeadline`/`soft` is a day
you set yourself, and nothing happens if it slips. The ordinary case is both at
once (aim for Friday, owed on Monday), which is why they are two fields and not
one field with a switch. `isLate()` still reads the hard one only. All three of
these traits — both deadlines and the duration — stay **opt-in**, and the way in
is the little calendar's three buttons (`data-want` names the attribute). Don't
put them on the `task` kind to save a tap: that deletes the affordance that
teaches they exist, and decision 62's separation with it.

**When a thing sits and when it is late are two facts.** `date`/`due` is the day
it is drawn on — what a calendar shows it on, what Today collects, what a drag
onto a day cell writes. `deadline`/`dead` is the day it is *late*, and it is an
opt-in trait, so nothing that hasn't asked for it changes. Ask `lateOn(o)` for
which one decides (the deadline where there is one, otherwise the day it sits
on) and `isLate(o)` for the answer; never `D.overdue(o.due)`, or a task put on
Monday with a deadline of Friday is overdue on Tuesday. A finished thing is
never late. See decision 62.

**A thing that lasts is not a thing with a date.** `date` is the day something
falls on; `span` adds `till`, the last day, inclusive. Ask `spanOf(o)` (null
unless it has both, in order) and `coversDay(o,iso)` — never `o.due===iso`, or
a trip disappears from every day but its first. A backwards span is ignored
rather than drawn wrong. Moving a spanning thing carries its length: go through
`reschedule()` in `gestures.js`.

**A layout that runs on time collects containers; a grid one doesn't.** A magic
drawer refuses containers — a rack of drawers inside another drawer is a desk
with two of everything on it — except when it is laid out along time, because
the thing happening that week is very often a container. `showsContainers(c)`,
by face or by layout.

**A calendar face is a desk calendar until it is big enough to be a wall one.**
The face adapts to the box it is drawn in: one cell square is the tear-off day
pad (the month small, today large), one cell tall is the pad plus the next
thing or two, two wide or two tall is the pad over an agenda, three cells a
side earns the month grid, and twelve wide by six tall earns the planner —
titles printed in the day cells, the rest summed. Up to three cells a side the
gilt sits at the **rim** and the border slot sits out, the way a checklist's
does — `calBorder(o, snug)` in tiles.js writes both decisions. The pad always shows today
and carries today's `data-calday`, so a drop on a small calendar still dates
the thing; below the month the name rides on the tooltip, like the
checklist's. `calSoon()` in tiles.js is the agenda's order: late first, then
today, then next by date. See decision 80.

**Calendar and timeline are layouts, not kinds.** `layout` is how a container
arranges its children when opened — `grid | list | scroll | book | calendar |
timeline` — and `face` is how it draws on its parent's board. Any container can
wear either; nothing branches on a kind called "calendar". A layout falls back
to the *kind's* if the object hasn't got one — ask `layoutOf(o)`, never
`o.layout`.

**A calendar collects; it does not hold.** The Calendar kind is a *magic*
drawer wearing a calendar layout, defaulting to the rule "anything with a date".
The day a thing sits on is the `due` field on the object, never a container —
which is what lets one task appear on two calendars while still living in the
one drawer it was filed in. Dropping on a day dates it and leaves it where it
lives (`canDate()` ignores the magic rule on purpose). Its three settings —
`calview` (`month|week|day`), `weekStart`, `weekends` — are per object then per
kind, and `calCols()`/`calSpan()` answer for the front and the opened view
together, so a calendar set to a week can't draw a month on the desk. See
decision 32 and migration 11.

**A container can take dictation, and that is an attribute.** `spawn` +
`spawnBy:'type'` puts a box at the top of a container — on its front and inside
it — and `genKindOf()` says what a typed line makes. A Checklist is just the
built-in that carries them; a type you invent that ticks the same trait gets the
same box. Ask `takesTyping(c)`, and go through `spawnInto()` rather than
`quickAdd()` directly: a magic container holds nothing, so what you type into
one has to be made where the container itself lives and collected back by its
rule. That is the only reason the quick-add on a calendar day works.

**A plan is a board you can put down again, and it is not an object.**
`web/js/plans.js` — `planFrom(cid)` captures what a container *holds*, all the
way down; `stampPlan(id, into, at)` lays it out again with fresh ids. The word
is **plan** because `layout` is taken (it is how a container arranges its
children when it opens) — an architect's plan of a room, which is what this is.
It lives in `S.plans`, beside `S.kinds`, because both are things the desk is
made **with** rather than things on it; a container with a null parent that is
not in `S.desks` is an orphan every walk of the object list would have had to
learn about. Four rules: it carries **everything but the doing** (ticks, counts,
dates, history and the repeat's tally are stripped at *capture*, so stamping is
a plain copy); **media is stripped outright**, because a plan is stored inside
the snapshot that exists to keep `media.src` out of localStorage; it is captured
**by parent, never `childrenOf()`**, or a magic drawer's plan would duplicate
half the desk; and where it lands is **one offset applied to the whole
arrangement**, because if the shape didn't survive the move there would be
nothing to save. A kind may carry `plan`, which supersedes `seed:` and is read
before it. Deleting a plan clears that pointer off any type holding it. See
decision 121.

**A type can be born with things inside it.** `seed:[{kind,title}]` on a kind
makes those children when the container is created, placed at the top of its
board rather than left to `ensureBox()`. One level only — a seeded child's own
seed is ignored, because two types seeding each other would fill the desk. This
is why a project has no add-box bolted to its front: it is born holding a Text
field, which is the type that already turns typing into tasks.

**Answering is writing, not ticking.** The `answer` attribute puts a box on the
front and `answered(o)` is "is there anything in it". Typing in it must not
`render()` — the input is the thing being typed in, so wire.js toggles the
`answered`/`unanswered` class in place and lets the next ordinary render agree.

**A project is a drawer whose knob is a dial; the named kinds of work report.**
The generic `project` kind wears `face:'front'` — the drawer it is filed behind
— and `ringFor()`/`knobHTML()` in tiles.js burn a conic sweep round the knob at
`barPct()`, which is how far along it is read off the one part of a drawer your
eye already goes to. The named kinds (film, game, song, app, art piece) keep
`face:'project'`, because a film knows it is a poster before it exists. **No
bar on any of them**: a percentage was drawn twice and is neither the question
you ask a project across the desk nor an honest answer to it. What it holds and
what is next are what the face says, all read off `projectStat(c)`, which walks
the *whole* subtree once. `progressOf(o)` is the number: a container is its ticked
descendants, however deep, so a project made of four full checklists reads 100%
rather than 0%; milestones are the fallback for when it holds nothing tickable
yet. A project opens onto a **grid**, not a list, because it holds everything a
piece of work is made of. See decision 34.

**Completed things leave a drawer unless it counts them.** `keepsDone(c)` —
the four faces that exist to show what already happened (checklist, project,
calendar, timeline), **and anything carrying `progress`**. The second half is
the honest predicate: a container that reports a fraction of what is under it
needs its numerator, and a percentage whose ticked things have been thrown out
of the drawer is not a percentage. It catches a goal, which never wore one of
those faces and had been reporting 0 of 1 the moment you ticked something
inside it. Everywhere else, done means gone, and that
is what keeps a drawer finite.

**A hard flick off an edge throws a tile away.** `tossed()` in gestures.js asks
three things, not one — fast enough (`TOSS_SPEED`, on a *smoothed* velocity,
because a threshold on one event's noise fires at random), let go within
`TOSS_EDGE` of the board's edge, and travelling out through it. A slow carry to
the edge is still a move. **Down is not an edge**, and that falls out rather
than being said: the drawer's mouth is along the bottom and `aimHold()` is asked
first, so a downward flick is kept rather than thrown. `del()` pushes its own
undo and the toast offers it. See decision 112.

**`picture()` strips the clone itself, not only its descendants.** Every caller
but the toss hands it a whole board, where the thing answering to an id is
always a descendant; the toss hands it a tile, and it flew off still answering
to an id the desk had just deleted. Decision 51 from the other side.

**A drop has four meanings, and they are ordered.** `aimDrop()` in
`gestures.js`: a day on a calendar, a point along a timeline's axis, an object
it gathers with, a container to file into. The first two sit inside a
container's tile, so they must be asked about first — ask the drawer first and
every calendar drop files the object and loses the date. Add a fifth by adding a
branch there, in the right place in that order. A *plucked* line is the one
thing dragged that isn't a tile, so it has its own aim (`aimPluck()`) with only
the last of those four questions.

**Two of a kind make a third thing, and that's a property.** `gathers` on a kind
names the container a pile of it becomes — task→checklist, ingredient→recipe,
shot→shotlist, scene→story, character/place/item/event→world. `gatherKind(a,b)`
agrees only when both name the same thing. If you are tempted to write
`if(a.kind==='task' && b.kind==='task')`, that is the instinct this property
exists to stop: a type invented at runtime has to get the behaviour too, and
the type builder offers it as "Two of them make".

**A desk starts locked, and so does every drawer in the sample.** A board you
arranged is one you want to look at rather than nudge, and on a locked board one
finger walks the boards, which is the gesture a phone is actually for. A drawer
you make yourself starts unlocked, because you made it in order to arrange it —
`create()` sets nothing, the seed sets `locked:true`.

**Pinching two fingers together goes up one level.** The parent, not the desk
— `zoomBegin/Move/End` in gestures.js — and again for the next, until a desk,
which has no parent and so refuses (desks sit *beside* each other, decision 39).
The knob along the bottom still goes straight home in one press, which is why
both exist: one is a step, the other a destination. Only *inward*; pinching out
would have to name a thing to go into. Whichever is winning when the squeeze
passes `PINCH_MIN` — the squeeze or the midpoint's travel — decides the gesture,
once, so a pager under way can't turn into a pinch. A surface answers it too, by
shrinking. **`onCancel()` must not touch it**: iOS fires `pointercancel` for
both pointers the moment it recognises a two-finger gesture, so cancelling from
there tore the pinch down on the device and never in a test. Touch events own
its lifecycle — `touchend` and `touchcancel` both land in `onTouchEnd`. See
decision 109.

**A touch belongs to the element it started on, and a render takes that element
away.** `render()` replaces `#app` wholesale, and a detached node has no
ancestors, so nothing bubbles to `#frame` — a gesture that renders mid-flight
stops hearing its own fingers and freezes with no `touchend` ever arriving.
`holdFingers()` in gestures.js puts the handlers on that element for the length
of the pinch (a stamp on the event swallows the second delivery while it is
still attached). The pager avoids the whole problem by committing on release;
anything that must render mid-gesture has to hold on by hand. **A test that
dispatches at `#frame` cannot see any of this** — `#frame` is never replaced —
so the pinch tests fire at the element the fingers land on and assert it really
has gone.

**A dive can be scrubbed, and that is why it has no second set of keyframes.**
`scrubDive()` in motion.js: the four animations are on one clock and all
`linear` (the easing is baked into `dive()`'s waypoints), so a **paused
animation with a negative `animation-delay`** renders at that point in its own
timeline — one number moves all four and they cannot drift apart. Pass `scrub`
to `leaveTile()` for a handle (`set` / `finish` / `undo`) instead of a played
movement; it returns null when there is no movement to give (reduced motion, a
drawer that doesn't dive) and has already navigated. The commit happens on the
first frame and lands *under* the opaque picture of the board you were on —
`undo` re-renders the drawer under that same picture before taking it away,
which is the pager's trick and why neither needs a "maybe" in the model.

**Two fingers navigate; on a locked board, one does.** Both go through the
pager in `motion.js`, which draws the shelf either side of this one and slides
the strip with your finger rather than committing at a threshold. A locked board
has nothing for a finger to carry, so the finger walks the shelves — while a tap
still opens the tile and the long press still opens the menu. Both axes commit
`goShelf()` now: where the sideways swipe used to build a whole other desk, it
builds the same board windowed one shelf over. See decisions 38 and 141.

**Navigation is the shelves, and nothing else.** There are exactly two views: the
desk and a drawer. The four fixed tabs (Today, Keeping Up, Everything) are gone
— they were hard-coded aggregations, which is a magic drawer's job. Don't add a
view without a very good reason — a magic drawer is nearly always the answer.
See decision 22. The three that used to be pinned still ship, as ordinary
drawers on the desk: **Today** (anything due, every desk), **Inbox** (where a
new object lands when nobody said), **Everything** (every unfinished task).

**An inbox collects; it does not hold.** It is a magic drawer carrying
`filter.loose` — "on a desk rather than filed in anything" — so a new object
appears in it and stays exactly where you made it. `create()` never routes
anywhere but the board you are looking at. For one version it filed into a
nominated inbox instead, which meant a thing you made on the desk vanished off
the desk; `S.inbox` is gone with it. See decision 45.

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

**A magic drawer sees everywhere unless it says otherwise.** `filter.scope` is
`all` (**the default**) | `desk` | `some` + `filter.scopeDesks`. `desk` was
right when the app was a row of desks and a rule on one answering with another's
contents was a real surprise; there is one desk of nine shelves now, so the two
are the same answer on every desk that exists and the one that read as a limit
was the one being applied. `inScope()` is checked before every other clause in
`inContainer()`, so it applies to the archive and to every rule alike. The scope
blank only shows when there is more than one desk. See decisions 141 and 159.

**A rule is a sentence, and the blanks are the controls.** *This drawer collects
[anything] from [anywhere] tagged [any tag] with [field] [is] [value].* Six
labelled rows told you six correct things and never told you what the drawer
would do; reading the rule and changing it are one act now. The joining words
are chosen not to agree with anything — "from", not "that are", which reads as
"anything that are". The **types** are grouped the way the new-object picker
groups them and folded behind the blank, with one button back to *anything*.
Making a sorting drawer lands you here. See decision 159.

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

**One render is one pass, and a pass may remember.** `childrenOf()` walks every
object and runs every magic rule, and drawing a board asks it fifty times — for
the board, for every container on it, once per level of `projectStat()`, and
once per candidate cell in `freeSpot()`. `beginPass()`/`endPass()` in `model.js`
open a memo for the length of one **synchronous string build**, and `viewHTML()`
and `previewHTML()` are the only two that open one. Outside a pass the map is
null and every call is the honest walk — there is no invalidation to get wrong,
which is the whole point. Don't hold a pass open across anything asynchronous,
and don't add a mutation inside one. See decision 59.

**`sizeGrid()` writes only what changed.** It measures after layout and then
writes what it measured, and every one of those writes dirties layout again — so
rendering laid the board out twice, once for the measurement and once for the
writes. The markup already carries last render's numbers, so on an ordinary
render there is nothing to write. Same for `scrollTop`: restoring it on a fresh
element forces a full layout, and it is skipped when there is nothing to restore
(on a phone, always).

**`renderSoon()` rebuilds on the next frame, and that is not a delayed state
change.** Where you are changes immediately; only the DOM waits, and only while
an opaque strip is over it. It exists for the pager, where the rebuild used to
land on the very frame the settle transition began on. `render()` supersedes a
pending one, so nothing renders twice.

**The pager spreads its work over two frames.** The frame the gesture is
recognised in builds only the neighbour you are moving *towards* and carries the
**real** board in the middle of the strip — free, because it is already laid
out. The next frame builds the far neighbour and a still picture of the board
you are leaving, and the real one steps out and hides. It has to become a
picture before you let go, because letting go rebuilds `#app`. If you ever make
something render mid-gesture, that picture won't exist and the middle of the
strip will be empty.

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

**Shadows are a switch.** `S.look.shadows`, in the app's settings. Off writes a
**zero** shadow into `--shadow`/`--shadow-lg`, never `none`: half the border
slots write `box-shadow: inset …, var(--shadow)`, and `none` is only legal as
the sole value of the property — it would take the inset rings down with it.

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

**Tapping bare board does nothing on a phone; holding it makes something
there.** One way in, and it is the good one: **holding a bare cell** lights that
cell, sizes a box as you drag, and opens the picker on it when you let go. On a
locked board the difference is purely *when you move*: move first and the finger
walks the boards, hold first and it sketches. There was a second — pulling a
drawer front up out of the shelf (decision 43) — and it went with the shelf,
which is no loss: pulling made a thing with nowhere in mind, and holding a cell
makes one *there*, which is what a grid is for. See decisions 47 and 53.

**A board that isn't a grid can still be swiped off.** The one-finger sideways
swipe starts from the bare cells of a locked grid, which a List, Scroll, Book,
Calendar or Timeline board hasn't got — so a desk set to List was a desk you
could not walk off. A press on the `.scroll` background of a gridless board is
`type:'swipe'` with `xonly`, and `swipeMove()` kills the gesture if the finger
picks the vertical axis: up and down belongs to the list.

**A locked board opens for one tile and shuts behind it.** The hold-and-drag
still opens it — you have answered the padlock's question — but `relock` is set
and `onUp()` shuts it before the drop renders, so one deliberate nudge doesn't
leave arrange mode on behind you. Two attributes are the standing version of
the same exception: `movable` keeps an object's drag on a locked board,
`resizable` keeps its corners, and each says so on the tile — a pin top left, a
bracket bottom right, both riding along with the resize grips in `handles`.
That makes `arr` three answers, not two: `true` unlocked, `'locked'` locked,
`false` not a board at all (a sample). A grip is a bigger target than the mark
that advertises it — 22px desk, 40px phone, capped at a third of the tile so
four corners can't swallow a 1×1. A new object **drops in from above** and
settles (`.justmade`) — starting half again its size and easing *in*, because a
tile that only slides a few pixels reads as a twitch; the glow is an `outline`
so it can't take a border slot's moulding with it. The ring of light still says
which. See decision 81.

**The reader is one column, and the keyboard is not a resize.** `--paperw` is
computed on `.bookstage` — not on `.book`, which is a sibling the title and the
bar cannot read — so the title, the sheet and the bar are one width that cannot
disagree. The header is **only the title**, two lines then clipped; every
control is in **one bar under the paper** (tools left, page turns centred, the
way out right, three grid columns so the turns stay centred). The paper is
sized and positioned from `--vvh`/`--vvt`, the *visual* viewport written onto
the root by `watchViewport()` in boot.js — `100vh` on iOS ignores the software
keyboard and `dvh` tracks browser chrome, not the keyboard. Letter proportions
are kept throughout: a keyboard gets a smaller sheet, never a different shape.
**The pagination ruler lives on `#frame`, not in the stage**, so it has to be
named in the same rule as `.bookstage` — without `--pageh` nothing overflows it
and a whole book measures as one page. See decision 84.

**A ruled sheet's lines go under the writing, not across the paper.** The
`st-laid` ruling is painted on the **prose element** — `.tiletext`, `.contbody`,
`.page` — with a period of `1lh`, the element's own line box, so every rule
falls at the foot of a line by construction rather than by agreement between two
numbers. The sheet keeps the tint that says what it is made of. And the default
stock is **plain** in every aesthetic: laid was the default in five of seven,
which meant every note on a new desk arrived ruled. See decision 147.

**A page is a sheet of the object's own paper.** `sheetOf(o)` in tiles.js —
the same `tx` and `st` readers `paper()` gives a tile, so a note that is ruled
on the board is ruled when you open it and re-dresses on an aesthetic switch
the same way. Two families, not three: a stock and a grain are what the sheet
*is*, an **edge** is the tile's frame on the board and a page has its own. It
goes on the **spread** — the spread is the sheet, two pages side by side are
one leaf, and in scroll mode the paper is what the column moves over rather
than something that moves with it (an absolute box inside a scrolling page
covers the first screenful and stops). The grain is a *sibling* of the pages,
which is why the one-column rule asks `:not(:has(> .page + .page))` and not
`.page:only-child` — `:only-child` is a question about the DOM, and the day
the paper arrived a single page was laid out in half the width. A ruled grain
does **not** line up with the text baselines and that is knowingly left: the
pitch is the aesthetic's and the leading is the reader's, and joining them
means one number across seven aesthetics plus the pagination ruler. Don't damp
the grain for reading either — see decision 105.

**Everything in the reading bar is one shape on one rhythm.** One `--bkgap`
for all three groups, one radius, one glyph size, and every mark centred in
its own box — `.readmode` is `inline-flex` because it carries a label, so it
needs `justify-content:center` or its mark sits hard left the moment a phone
hides the label. It is dressed as a chip on purpose: it is the one control
that is also a readout. The page count is **fixed width**, because it sits
between the two chevrons and a count sized to its own digits walks the button
you are pressing out from under your thumb as you page. See decision 106.

**The page you read is the page you write on.** Tapping the paper puts a caret
in it — the whole body, in the page's own face, however the page is broken up;
`clearPages()` when you put it down. The reading head is three things: the mode
as **one cycling button**, copy as a glyph, and Edit meaning the *object
editor*. See decision 82.

**A tick box is a fact about the desk, and an object may argue.** Six shapes;
the desk's is `S.look.check`, written onto the root as `data-checks` by
`applyLook()`, and an object's own `check` is stamped as `ck-<shape>` beside the
size classes. The desk's rules are wrapped in **`:where()`** and the object's are
not — that is the whole mechanism, because `:where()` scores nothing and the two
would otherwise tie on specificity and let *source order* pick the shape. The
default is the **circle**, in every aesthetic, and the box is a fraction of a
cell (`--rowh`) rather than a fixed 38px, or the same box is 65% of a desk cell
and 95% of a preview's. See decisions 83 and 149.

**Holding a tile opens the menu, and moving from there takes the tile — and
unlocks the board, for as long as you hold it.** The iPhone home screen's gesture, and the gesture is no
longer cancelled when the menu appears: `G.menu` stays set, and the first real
movement closes the menu, lifts the tile and calls `unlockBoard()`. That writes
state and patches the grid's `locked` class and the bar's padlock **without
rendering**, because the tile is under the finger and `render()` would replace
it — the drop at the end renders and everything agrees then, with the lock back
on. See decisions 47 and 81. Dragging a size out on bare board still makes something, on
both devices, because that one is deliberate. And on a phone every panel comes
up from the bottom rather than in from the right — a panel from the right covers
the whole board, which is the thing decision 23 exists to prevent.

**Depth is its own door.** `Depth and light` in Settings — four headed groups:
*Looking in* (what the tilt moves), *Books*, *Drawer fronts* and *Both* (how far
any of it follows the phone). It was four rows at the foot of Appearance and is
now eleven, and "how solid does this desk look" is not "what colour is the
board". Every note in it is one or two sentences: eleven controls each with a
paragraph is a wall rather than an explanation.

**A panel asks one question.** A long one is a short list of **doors**:
`objectPanel(id, sec)` and `settingsPanel(sec)` are the *same panel under the
same key*, so a section replaces rather than stacks, and `spec.back` puts a
chevron in the head — the way out a replaced panel never had. The object
editor's top is the thing itself, its **type and where it lives**; its **tags
and links** are at the **foot**, just above the row of things you can do to it,
because what a thing is filed under and what it points at are the last things
you say about it and they were sitting above every door; the rest is four doors — Look, Behaviour, Collects, **Advanced** (its
fields and which traits it carries). Don't add a row to the top level unless it
is one you reach for constantly. See decisions 66 and 148.

**The name is the panel's own heading**, and pressing it turns it into an input
in place (`data-headname`, handled in wire.js). It swaps itself rather than
re-rendering the panel, because a rebuilt panel is a lost caret.

**Every row in Look is a cycle, not a select.** `pcycle()` — the answer is a
thing you look at, drawn six inches above it on the stage, and a `<select>`
covers the preview with a list of words you have to imagine. It writes through
`setField()` like every other row, so undo and the refresh come along. Rows that
are lists of *behaviours* keep their select. A slot family's back door — the
other aesthetics' answers — is a chip with a brush on it beside the cycle, not a
full-width labelled disclosure: five slot rows meant five of those. The Look
rows are in **one order whatever the thing is**, so the row you want is where it
was last time. And **the editor closes an open surface** rather than opening
behind it: whichever you opened last wins, in both directions. See decision 148.

**There are no modals — a menu is a panel.** `openPanel(spec)` in `panels.js`
is the whole system: one panel at a time, down the right, over a desk that stays
visible and stays live. Settings, the type picker, the type builder, the drawer
form, Move to drawer, Link to, Attributes and object/drawer settings are all the
same thing. Panels are appended to `#frame`, *outside* `#app`, so `render()`
leaves them alone. See decision 23, and don't bring back a centred card on a
scrim — a menu that covers the answer to the question it is asking is the wrong
shape.

- `spec.body` is a **function**, not a string, so `refreshPanel()` redraws from
  state. That is why no handler rebuilds a panel by hand any more.
- `spec.key` names which panel is up (`panelKey()`), for the two places that
  care: the type-shortcut keys only fire over the picker, and the settings
  auto-refresh listener only fires over settings.
- A form's draft lives in the `PANEL` object, read with `draft()`, never on the
  DOM node — a redraw would lose it.
- A surface claims the same screen, so `renderSheet()` closes any open panel.
  A surface is the bigger claim.
- `spec.anchor` and `S.openId`: `objectPanel(id)` sets `S.openId` to the object
  it is about, which is what every `byId(S.openId)` handler in `wire.js` acts
  on. `closePanel()` clears it.
- The command palette (⌘K) is the one thing that kept a scrim: it is a search
  field you summon and type into blind, not a menu about what is in front of you.
- `spec.anchor` — an object id or an element — makes the panel a **bubble**
  beside that tile instead of a slab down the edge, on whichever side has room,
  with a tail pointing back at it. Object and drawer settings use it. A question
  about one tile asked from the far corner of the screen makes you look away
  from the thing you are changing; a question about the *desk* (settings, the
  type picker) belongs on the edge and shouldn't take an anchor. With no room
  either side — a phone — it falls back to the edge panel by itself. See
  decision 27. `repositionPanel()` runs at the end of `render()`, because the
  tiles move and the bubble is pinned to one.

**A list of choices is a popup, not a panel.** `openMenu(anchorEl, html)` borrows
the context menu's element and hangs it under the button that opened it — that is
what Sort does. A panel is for a form; a popup is for picking one of a handful.

**A type is drawn as the thing it makes.** The type picker and the type builder
both go through `sampleTile()`, which renders a throwaway object with the same
`gridTile()` the board uses — at desk scale, then CSS-scaled down. Full size and
shrunk, never drawn small: type sizes inside a tile are in px, so building one
at 11px a cell wrapped "Drawer" onto two lines. A miniature has to be the real
thing seen from further away or it is a preview of nothing. The sample never
enters `S`.

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

**There is one object editor, and one place words are written.** A container is
an object with children, so `objectPanel(id)` answers for objects, containers
and the desk alike — `drawerPanel` is an alias for it and the old drawer *form*
is gone. Everything that used to be on the detail sheet is in there: fields,
milestones, a streak, tags, relations, traits, its mark, how big its words are.
The words are the other half, and they get their own surface — `openWriter(id)`
full screen, or a double tap on the tile for a name and a line. Don't
reintroduce a form that is both. See decision 36.

Its button is a **paintbrush** (`ic('brush')`); the gear is the *app's* settings
and belongs to the desk alone. At the top of the body — and **again at the
top of Look**, which is nothing but rows that change how a thing looks — is
`objectStage(id)`: the object drawn through the same `gridTile()` the board
uses, on a checkerboard scrolling diagonally, because a panel covers the tile it
is asking about and on a phone it covers the board. The desk gets none, because
a desk is a container without a tile. See decisions 51 and 97. It draws a **clone**: id `__stage`, box moved to
`{x:1,y:1}`. A second element carrying the real id is one the drag, `anchorEl()`
and `tileOf()` could all pick up instead of the tile, and a box at the object's
real `x` lands in a column the preview grid hasn't got — which draws an empty
floor and looks like the stage is broken. See decision 51.

**A mark and a text size are per object, then per type.** `iconOf(o)` and
`textSizeOf(o)`, next to `shapeOf` and `colour`. Never read `K(o.kind).ic` to
draw an object — that is the same mistake as reading `o.c`. Text size is a
*multiplier* written into the tile's style as `--tscale` (folded into `place`,
so every branch of `drawTile()` carries it), and the stylesheet restates each
size times it at the end of `chrome.css` — a name is 15.5px on a card, 11.5px on
a narrow front and 11px on an index card, and all three survive being read from
closer.

**A one-of-many list is a `<select>`; a many-of-many is chips.** Forty types and
twenty shapes as chips were four hundred pixels you had to read like a wall. New
settings go in as `psel()`; if a group is genuinely multi-select, put the chips
behind a `pgroup()` disclosure.

**A name is a thing you can tap, on an unlocked board.** `nameField()` in
`tiles.js` draws every name — a tile's, a list band's, a checklist line's — and
draws it as an `<input>` when it is the one being edited, so a thing that is not
a tile on a board can still be typed in. `data-edit` is the wiring; wire.js
checks the board's lock and calls `startEdit()`. Locked is for reading, so there
a tap opens what it lands on and a name is only a name. On a checklist front this
puts the tick on the **box** — the words are how you change it. See decision 61.

**A list is a board.** Same controls a grid has: the words edit, the box ticks,
swipe left deletes, swipe right puts it on today (offered only to something
carrying `date`), a hold reorders and a longer hold is the menu. A band obeys
`clickOf()` like a tile — a list used to open the object editor for everything on
it, which sent a task to a page of paper it has no use for. The swipe's backing
is **one** borrowed `#rowact` element positioned over the row that is moving, not
a strip in every band: a list is the one place that can hold two hundred of
something.

**A hold is 300ms and a render inside one detaches the tile.** The arming
callbacks call `refind(g)`, which looks the element up again by id — putting an
inline edit down renders on the next tick, and since a name became something you
tap there is very often one open when the next press starts.

**A list under Manual can be dragged into order; under any other sort it
can't.** `ord` is what `childrenOf()` falls back to when nothing sorts, so
holding a `.listband` and moving it writes indexes into `ord` — the boxes are
untouched, because a thing's place on a grid is a different fact from its place
in a list. The gesture only arms when `sortOf(container)` is manual: a board
that sorts itself arranges itself, and shuffling an A–Z list would be a gesture
whose result vanished on the next render. The list carries `data-listfor`.

**A sort is per object then per type.** Ask `sortOf(c)`, never `c.sort`. `manual`
is a real stored value — it is what lets one container refuse a type that sorts —
so writing `null` to mean "unsorted" reintroduces the bug it was there to stop.

**A new object has to be *seen*.** `reveal(id)` after creating one. A board is a
coordinate space and `freeSpot()` scans from the top, so on a phone — where an
object is full width — a new thing always lands below the fold. It looked
exactly like nothing had happened. Don't fix it by shuffling the board: things
you arranged don't move.

**The torn edge is a shape, and a fragment wears it without asking.**
`tornOf()` answers for `shapeOf(o)==='torn'` **or** `isFragmentKind(o.kind)`, so
anyone can pick "Torn edge" and a scene still keeps its punched page *and* its
tear — what makes a fragment is that it came out of something, not what it is
drawn on. See decision 161.

**A fragment is a piece torn out of something, and the edge says so.** Every
type under the Fragment category wears a **fuzzy crease-tear**: a near-straight
edge with a px-sized jitter along its whole length, not `sh-tornnote`'s chipped
bites. The jitter is in **px** so the fuzz is a fixed thickness at any tile size;
the line is four zero-blur drop-shadows off the element's alpha *after* the clip,
which is the one way to rule a clipped shape; and there are **three** silhouettes
picked by a hash of the object's id (`tornOf()`), because one polygon on every
fragment on a board is a repeat you can see. Which types these are is asked of
`isFragmentKind()` — the category's own `family` list — never of a name. See
decision 145.

**A note is a plain sheet, an idea is a note ruled round, and a thought is a
rounded card.** The note was torn — a chip out of each side and a drawn outline
following it — which is the most characterful tile on the board worn by the
type you reach for most. That machinery is still here as **`sh-tornnote`** for
the shapes that are genuinely torn. An idea's border is `var(--c)` and never a
named yellow: the type sits on slot 12, which is Victoria's Gilt and every
other aesthetic's answer to the same position. See decision 138.

**An edge of none still has to reach the edge.** `border-color:transparent`
leaves the border *box*, and a background **image** is laid against the padding
box — so a tile with no edge and a gradient painted a pixel short all the way
round and showed a hairline of board. A background *colour* never was, which is
why it hid: only spines and anything wearing a stock were short.
`background-origin:border-box` on `.drawer.bd-none` is the fix, and a spine
states its **shadow** back, because `bd-none` is forced onto it to suppress the
border *slot* and was taking the shadow with it. See decision 139.

**A shape with a torn edge still has a border, and it follows the tear.** A
`border` is drawn on the box, so `clip-path` slices it off at the notches and
leaves it hanging at the corners — which is why `sh-note` had `border:0`. The
outline comes from four zero-blur `drop-shadow`s instead, one per direction:
a drop-shadow is computed from the element's alpha *after* the clip, so the line
traces whatever the clip cut. Same filter chain as the real shadows, which is
also what stops a clipped tile from floating with none.

**No type draws a coloured left stripe.** A stripe down the left is what
`priority` means. `edge` is the opt-in, on any object; four shapes (`tab`,
`ruled`, `chit`, `pill`) are the answers a task has instead. `docs/BORDERS.md`
is the inventory of every edge in the app and which ones still belong to the
border system rather than to a shape.

**Never branch on a type's name.** Appearance goes through `shapeOf()`, faces
through `faceOf()`, behaviour through `has()`. The only remaining `kind===`
comparisons are inside migrations, where naming an old type is the whole point.
 ("Kind" in the code, "type" in the interface — `KINDS` stayed put so the diff stayed readable.) Ask `has(o,'check')`, not `o.kind==='task'`.
Kinds are named presets of attributes, users can invent them at runtime, and a
view that checks for `'task'` will silently ignore every kind someone makes. The
attribute registry is `ATTRS`; the presets are `BUILTIN_KINDS` merged with
`S.kinds`. Adding a built-in kind is still a one-line change; adding an
*attribute* means teaching the detail sheet and the tile renderer what it draws.

**CSS uses custom properties for kind colour.** `--k` is set inline on the element
and everything inside inherits it. `--c` does the same for drawer colour. Don't
hardcode a hex value in a component rule.

**The gilt frame is an edge, not a privilege.** `bd-gilt` is the seventh border
slot — a ruled frame inset from the edge with corner brackets and one wash of
leaf held to the top. It used to appear on a *magic* drawer automatically,
which made it the one ornament nobody could choose and nobody could decline;
now anyone can wear it and a magic drawer needn't. A magic drawer still carries
the **sparkle mark**, because that is a fact about behaviour rather than
decoration. A checklist face still wears the frame (decision 79) and now says
so as `bd-gilt` rather than by borrowing a class. See decision 94. It was holographic foil for
a while, which was worse than either; see decision 42. Never hardcode the gold:
it is `var(--glow)`, so it is leaf on Victorian and a green shimmer on Starry.

**An edge is a slot too.** The six `bd-*` classes are positions, not
descriptions — `bd-panel` is a Victorian moulding, a Pseudochromo hairline, a
white-pencil rule on Starry and a lit glass sill on Aero. A style names its own
six in `borders:[…]`; only the four dressed ones need per-style CSS, because
plain and none mean the same thing everywhere. Same rule as colour: never
hardcode what an edge is made of outside the style that owns it.

**A literal colour is somebody insisting, and there is now a picker for one.**
Under the eleven slots is a colour input writing a hex, in its own labelled row —
it does something different from the slots, so it must not look like one. The way
back writes **null**, never `''`: `objColour()` tests `o.c != null`. See decision
76.

**The board can be pinned rather than laid flat.** `S.look.pinned` — a margin on
each tile and one to three degrees of tilt, from `tiltOf(id)`, a hash of the
object's own id so the angle is the same on every render forever. Never `gap` on
the grid: `cellW()` measures the grid's own rect and moving it moves every tile
out from under the drag maths. Don't add a drawn pin head (the tile's overflow
clips it) or a `box-shadow` here (it replaces the border slots' inset moulding
and outlives the Shadows switch). See decision 75.

**A style is called an *Aesthetic* in the interface.** The stored key is still
`style` and the CSS hook is still `data-style` — renaming those buys nothing
and costs a migration — but every word a person reads says Aesthetics. The
seven are **Victoria**, **Carca**, **Stelaine**, **Girando**, **Golf 97**,
**Starful Gothic** and **Aeros**; `docs/STYLES.md` says what each is made of.
**Skeuomorphic and
Pseudochromo are gone** — the first because Victoria became the thing it was
waiting to be, the second because it is not in the new list. Removing one needs
a migration even though `styleNow()` falls back: the fallback means a desk left
on it *looks* right while storing a name that no longer resolves, and its slot
overrides are stored per aesthetic and become unreachable. See decision 90.

**A colour is a slot, and a slot is a position, not a hue.** Every aesthetic has
the same sixteen — five that dress the app (Page, Text, Lines, Accent, Glow)
and eleven it names itself — so an object stores `c: 11` and shows Victorian's
claret, Aero's deep sea blue or Starry's pine depending on where you are. Don't
try to make the eleven line up by colour across styles: Aero owns no reds and
Pseudochromo owns no hues at all, and forcing them to would wreck both. Change style and the desk repaints; change back and it is
exactly where it was. Never read `o.c` to paint something: go through
`objColour(o)` in `look.js`, which falls back to the type's and resolves either
a slot number or a literal. `hexOf()` is the same resolver for a bare value.
A literal string is still legal — it is somebody insisting — and travels
between styles unchanged. `chromeTokens()` derives every CSS token from the
five, so a new style declares sixteen hexes and nothing else. See decision 33
and `docs/STYLES.md`.

**An override is stored per theme, and `applyLook()` must not write it back.**
`bg`, `accent`, `line` and `board` live as `{paper, walnut}` and are read with
`lookVal()`. Assigning the resolved string back into `S.look` collapses the
object, and `lookVal()`'s string branch only answers for paper — so the next
call returns null and the value is silently dropped. There is always a next
call: `applyStyle()` runs `applyLook()` and then `render()`, which runs it
again. That bug meant **no dark aesthetic ever showed its own board** — Starful
Gothic fell back to the CSS default from the day it was written, and it took a
second dark aesthetic before anyone could see it. Read into locals. Anything
comparing one of these to a string wants `lookVal()`, not `S.look.<key>`. See
decision 91.

**An aesthetic's `defaults` are what a new container is born with** — knob,
border, texture, knobtone **and panel**. Add a new per-container look property
and it belongs in that set, or the aesthetics cannot speak for it: panelling
shipped without it, which left the one thing separating a Victorian drawer from
a Windows 95 button as the one thing an aesthetic could not say.

**A new drawer rolls its own look, from this aesthetic's vocabulary.**
`randomLook()` in look.js: knob, edge, grain and panelling, each picked with
the aesthetic's stated default in the bag **three times over**, so a desk is a
room of related furniture rather than a row of identical fronts — and still
reads as the aesthetic it is in. Uniform picks would make every aesthetic look
like the same jumble. `none` is in no bag: it is a deliberate choice, not a
thing to hand out. See decision 92.

**An aesthetic states its own `--wood`, and that is the widest thing it says.**
The carcass frames everything — the strip above the bar, the bar, the reveal,
the drawer along the bottom, and the status bar, which follows it through
decision 89. A desk's own `wood` still beats it. It also names a **spray**
shape, which an unset `S.look.spray` takes, so the burst changes with the
aesthetic until you pick one; unsetting deletes the key rather than storing
`''`. And each dresses `.panel` and `.sqbtn` — one menu system and one button
(decision 23), so two rules per aesthetic reach every menu in the app.

**There is no theme switch.** Light or dark is `isDark(palNow()[0])` — the
style's own background. `themeNow()` still reports paper/walnut, because the
CSS theme block owns the shadows and the per-theme custom colours are keyed on
it, but nothing sets `S.theme` any more. Adding a dark style means adding a
style, not a second axis.

**`.is-desk` / `.is-phone` on `#frame`** drive responsive rules — the breakpoint is
900px, set in JS, not a media query, because the same classes also need to apply
when you're editing the *other* device's layout from this one.

## Invariants that will bite you

- **Layouts are stored per device.** Each drawer has both `desk: {x,y,w,h}` and
  `phone: {x,y,w,h}`. Resizing must only touch `d[dev()]`. `dev()` returns the
  layout currently being *edited*, which is not always the physical device.
- **A drawer starts at 2×2 and states its own `phoneSize`.** The derivation
  halves a container, and half of two is one — the mini tile, which has no room
  for a name. Any kind at 2×2 needs the same explicit `phoneSize`.
- **A kind's `size` is the desk size.** `sizeOfKind(kind, device)` maps it: on a
  phone an object goes full width at the same height, and a container is halved
  so it keeps the fraction of the screen it had. Never use `K(k).size` directly
  to place something — a 6×6 drawer copied straight onto a 10-column phone grid
  is three quarters of the screen, which is what this
  function exists to stop. Anything drawing a *preview* of a phone box goes
  through `toPhoneSize()` so the preview can't drift from the placement. A kind
  may also carry `phoneSize`, set from the type builder's second pair of
  sliders, and `sizeOfKind()` prefers it over the derivation — the derivation is
  a good default and a bad rule. Read the size through `sizeOfKind()` and both
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
not "Successfully moved item!".

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
