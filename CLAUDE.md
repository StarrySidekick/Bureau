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

**Where the last stretch of work got to (v1.80, 2026-09-22).** Five rounds in
one day, all of them living with the **camera** (decision 187 — you go to the
object where it sits). What settled out of them and is now load-bearing:
a container's board is **its own tile, four cells to a cell**, read off the box
for the device being drawn, with no shelves inside one — a board is exactly
`w×4` by `h×4`, centred if it is smaller than the screen and paged if it is
bigger (188, 190, 192); a drawer **opens onto that board flush to its own
face**, with the bar and the rail not drawn while the camera travels (192);
**full screen means the screen** (191); and **one hold means one thing** on
both kinds of board (192). Decisions 187–192 are the whole of it and are worth
reading before touching the camera, the dive, a container's board or the
reading surface.

**Start here each session:** `docs/SYSTEM.md` is the reference for what Bureau is
made of — objects, attributes, types, drawers, the grid, the surfaces, storage.
`docs/ROADMAP.md` holds the current plan in dependency order, and
`docs/DIAGNOSTIC.md` is the last full review — what is wrong, what it measures
at, and what is worth taking from Bear, Things 3 and Notion.
`docs/FUNCTIONS.md` is the fifteen functions a paper system serves and Bureau's
answer to each — scoped, not built, and the source of the current plan.

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
```

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
left, so the file is never changed and the full run is still the gate. It writes
screenshots to `test/shots/` — look at
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
| `grid.js` | Grid geometry: `GRID`, `CELL`, `lay()`, `boxOk()`, `freeSpot()`, `ensureBox()`, and `innerOf()` — **a container's board is its own tile, four cells to a cell**. Lives here, not in the views. |
| `look.js` | Styles, the sixteen colour slots, `hexOf`/`objColour`, `applyLook()`. |
| `mutations.js` | `toggleDone`, `del`, `create`, `quickAdd`, repeat scheduling, `toast`. |
| `tiles.js` | `gridTile()` — the one place that decides how an object looks on a grid — plus rows, cards, list bands, book/scroll entries, and what a click does (`tileTap`). |
| `views.js` | The desk and a drawer — the only two places there are. Also the time layouts (`viewMonth`, `viewTimeline`), the desk map and the settings panel's body. `render()` replaces `#app`'s innerHTML wholesale, then saves. |
| `sheet.js` | The three surfaces an object opens onto — reading, writing, and the picture — rendered into `#sheetHost`, **separately** from `render()`. |
| `panels.js` | `openPanel()` — **every menu in the app** — plus `openMenu()` for a popup hung off a button, the command palette (⌘K), the context menu, and `sampleObject`/`sampleTile` for drawing a type as the thing it makes. |
| `gestures.js` | Pointer-based drag, resize, lasso, swipe. The fiddliest code in the app. |
| `motion.js` | Every movement: `openTile()` (drawer, cabinet, curl, lift), `pop()`, the pager that slides between boards, and **the camera** (`applyZoom`/`camScale`) that zooms the board into one object where it sits. Nothing in it ever delays a state change. |
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
