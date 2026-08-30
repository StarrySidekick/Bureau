# Bureau — working notes for Claude Code

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
```

Open it over http, never as a `file://` URL — the service worker won't register
and the manifest won't load, so you'd be testing a different app than the one
that ships.

`test/smoke.mjs` needs Playwright (`npm i playwright`). It exercises the desk,
drawers, quick-add, the detail sheet, habits and goals, both layouts, persistence
across a reload, and an offline reload. **Run it after any non-trivial change and
before saying you're done.** It writes screenshots to `test/shots/` — look at
them, this is a visual app and a passing assertion doesn't mean it looks right.

`test/scale-probe.mjs` is not a test and nothing gates on it — it pours objects
onto the sample desk and times a render, the string build inside it, and a full
save, so "is this getting slow" has an answer rather than an opinion. Run it
after anything that touches `render()`, `childrenOf()` or the grid maths. The
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
about to make. Without
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

**An animation never holds anything up.** This is the one rule in `motion.js`
and it is easy to break by accident. A tap files, ticks or navigates the
*instant* it lands, `render()` runs, and the movement is drawn over the result
— which is why the flying drawer front goes into `#fx` and the pager hangs off
`#frame`, both outside the element `render()` replaces. Never `setTimeout(…,
300)` around a state change to "let the animation finish": that is how an
animated app becomes a slow one, and it breaks every test that reads state
after a click. See decision 38.

**How a thing opens is a property, and the front says which.** `openingFor(o,
box)` in `motion.js` — `auto | drawer | cabinet | curl | lift | none`, per object
then per type. `auto` asks what the object *is*: a container over four cells
square swings open, so does one **taller than it is wide** at two cells of width
or more, a smaller one pulls out, a paper shape curls, everything else lifts.
Don't add a branch on a kind's name to get a different movement; add a value, or
set `opening` on the type.

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

**A texture is printed on the front, so it goes under what stands on it.** The
depths on a drawer front, bottom to top: the texture's `::after` (0), the knobs
(1), the name (2), the mark and the seam (3). A generated `::after` is the last
child of the tile, so with nothing said about depth it painted grain across the
brass handle.

**Nothing on the desk shimmers.** A magic drawer used to be holographic foil,
lit from `--holox`/`--holoy` on `#frame` — the phone's tilt, or the pointer.
It was tacky, and it is gone along with the whole tilt apparatus. Furniture does
not react to being held. If you want a surface to catch light, give it a reason
first and read decision 42.

**A container one cell wide is a spine, whatever face it asked for.** The title
runs up the tile, the way it does on a book on a shelf — `box.w<=1` is part of
the spine branch's own condition in `drawTile()`, which is why it sits above the
checklist and the calendar rather than after them. One cell *square* is still the
mark and nothing else, handled earlier: at 40px a spine has no length to set a
name along. A magic one gets `magicspine`, which gilds the two bands it already
has rather than the frame every other magic front wears — inset 5px on a tile one
cell wide is the whole tile.

**A spine is bound, and the binding is five choices.** `bindingOf(o)` — per
object then per type, like a knob or a border slot — stamps `bn-<name>` and the
rest is CSS: `plain` (cloth), `banded` (gilt rules, the default), `ribbed`
(raised hubs), `tooled` (a double-ruled panel) and `label` (paper pasted on).
Under all five the back is **round**, which is seven stops of one horizontal
gradient and most of what makes it a book rather than a coloured rectangle.
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
fills a plain spine still fit between two hubs. Gilt lettering carries a dark
impression with it, because gold is a mid tone and several of the eleven slots
are pale. See decision 87.

**A style is a typeface, and that includes an object's words.** `--serif` is
whatever the style declares; `.dname`, `.tiletext` and both inline editors are
set in it. They were pinned to `--sans` — the system face — which meant a note
and a task were the one thing on the desk not wearing the style, and Starry's
Optima drawer sat next to a San Francisco note.

**A magic drawer asks up to three questions, ANDed.** `filter.rules` is an
array; ask `rulesOf(f)`, never `filter.rule`, which is the old single-clause
shape still read for a pre-migration-21 backup. There is no OR and there is not
going to be one — an OR needs groups, groups need a builder, and a builder is a
query UI, which is the thing tags-become-drawers exists to avoid. A date clause
compares as a *date* (`numOf` read "2026-08-19" as 2026) and its value may be
one of five words — `today`, `tomorrow`, `week`, `month`, `year` — resolved when
the rule runs, so "before next week" keeps meaning it. See decision 63.

**A checklist face is a stack of task-sized lines, and it refills itself.** One
line per cell of height, counted out by `--clrows` from the box being drawn — a
checklist three cells tall shows three tasks the way three task tiles would.
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

**Anything made of a file opens onto the media surface — sound and video
included.** `isMedia(o)` routes; `isPicture(o)` is still the image case and
`isPlayable(o)` the other two, and `acceptFor(o)` tells the one file input what
to offer. A picture is stored as a downscaled data URL, a sound or a video as
the **Blob itself** (base64 is a third bigger), with a 60MB ceiling;
`hydrateAssets()` makes an object URL for a blob. On the *board* a sound or a
video is a face — a mark and a name — never a player: forty decoded media
elements is a board that will not scroll. `create()` deliberately stores **no**
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

**A project reports; every other container lists or hides.** `face:'project'`
is the one front that answers "where is this up to" — a bar, a count, what is
next, and what it is made of — all read off `projectStat(c)`, which walks the
*whole* subtree once. `progressOf(o)` is the number: a container is its ticked
descendants, however deep, so a project made of four full checklists reads 100%
rather than 0%; milestones are the fallback for when it holds nothing tickable
yet. A project opens onto a **grid**, not a list, because it holds everything a
piece of work is made of. See decision 34.

**Completed things leave a drawer unless its face says otherwise.**
`keepsDone(c)` — checklist, project, calendar and timeline keep them, because
all four exist to show what already happened. Everywhere else, done means gone, and that
is what keeps a drawer finite.

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

**Two fingers navigate; on a locked board, one does.** Both go through the
pager in `motion.js`, which draws the board either side of this one and slides
the strip with your finger rather than committing at a threshold. A locked board
has nothing for a finger to carry, so the finger walks the boards — while a tap
still opens the tile and the long press still opens the menu. See decision 38.

**Navigation is the desks, and nothing else.** There are exactly two views: the
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

**There is more than one desk, and a desk is somewhere rather than something.**
`S.desks` is the master space: an ordered row of container ids with `ROOT` among
them. A container in it is somewhere you can *be* — the breadcrumb roots there
(`chainOf` stops at a desk) — and a sideways swipe walks the row. Everything
else is a drawer, somewhere you went *into*. Ask `isDesk(id)` and `deskOf(o)`;
promote with `setPin(id,'desk')`. The row does **not** wrap — a space you can
walk off the end of is a space you can learn. See decision 39.

**Promoting a drawer to a desk takes it off the board it was on.** It is a
move, not a label: `setPin()` remembers `wasIn`, clears `parent` and both boxes,
and demoting is the return trip. A container with a null parent is in no
coordinate space at all, which is exactly what a desk is. Don't reintroduce a
front that is also a place. See decision 40.

**The name at the top left opens every desk at once.** Desks are laid out in
space, so the row needs a map rather than a strip of buttons — `deskMap()` in
`views.js` draws each desk small, its boxes on its own board, and pressing one
goes there. Desks are laid out in space, not listed in a strip.

**A magic drawer sees its own desk unless it says otherwise.** `filter.scope` is
`desk` (the default) | `all` | `some` + `filter.scopeDesks`. Without it, a rule
on the Exercise desk answers with screenplay scenes. `inScope()` is checked
before every other clause in `inContainer()`, so it applies to the archive and
to every rule alike.

**The app is furniture, and the board is set into it.** A phone screen has two
strips the board cannot use — the notch above the bar and the curve of the
bottom corners — and both are the desk itself: `--wood` above, and along the
bottom a **drawer front** with a round knob. Tapping the knob takes you out (out
of a drawer to its desk, from a desk to home); **pulling it up opens the type
picker**, which is decision 43's gesture given back the thing it comes out of.
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

**The dots by the title are the desks, not the pages.** In the order they sit in
the master space, the one you are standing on lit, following you into a drawer
because a drawer is on a desk, and pressing one goes there. They counted pages
once, which is position in the wrong axis. The page is a number now — `2/3`,
only when there is more than one. See decision 56.

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
what every other gesture on the board means. Then the **brush**, which opens
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
`sizeGrid()` works out. Boards differ from each other only in columns, so the
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
sized into pixels it cannot be seen in. A page is *not stored*: `y` is one continuous
coordinate space per container and a page is a window of *n* rows onto it, so
drag, drop and `freeSpot()` know nothing about pages. The one rule is that
nothing may straddle a break, enforced in `boxOk()`. Two fingers up and down
turn pages; two fingers left and right walk the desks. See decision 44. See decision 37.

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

**The page you read is the page you write on.** Tapping the paper puts a caret
in it — the whole body, in the page's own face, however the page is broken up;
`clearPages()` when you put it down. The reading head is three things: the mode
as **one cycling button**, copy as a glyph, and Edit meaning the *object
editor*. See decision 82.

**A tick box is a fact about the desk, not about a type.** Six shapes,
`S.look.check`, written onto the root as `data-checks` by `applyLook()` and
answered in CSS for `.check` and `.clbox` alike. A task ticked one way and a
checklist line ticked another are two apps sharing a board. See decision 83.

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

**A panel asks one question.** A long one is a short list of **doors**:
`objectPanel(id, sec)` and `settingsPanel(sec)` are the *same panel under the
same key*, so a section replaces rather than stacks, and `spec.back` puts a
chevron in the head — the way out a replaced panel never had. The object
editor's top is the thing itself, its name, its type and where it lives; the
rest is Look, Behaviour, Fields, Collects, Tags and links, Traits. Don't add a
row to the top level unless it is one you reach for constantly. See decision 66.

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
and belongs to the desk alone. At the top of the body is `objectStage(id)` — the
object drawn through the same `gridTile()` the board uses, on a checkerboard
scrolling diagonally, because a panel covers the tile it is asking about and on
a phone it covers the board. It draws a **clone**: id `__stage`, box moved to
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

**A magic drawer is gilded, and the gilt does not move.** Not dotted, not
speckled with stars — a dotted border is what every drawing tool means by "not
real yet". `.magicdrawer` gets a ruled frame inset from the edge with corner
brackets and one wash of leaf held to the top edge. It was holographic foil for
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

**A colour is a slot, and a slot is a position, not a hue.** Every style has
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
- **How an object reads is one property, not three click actions.** `readOf()`
  — `book | page | scroll`, per object then per kind, defaulting to `page`.
  "Open it as a book" used to be a click action, which made *whether* it opens
  and *how it looks* the same question. There is one reading surface now; the
  plain half-screen read panel is gone.
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
- **Anything that changes a field pushes an undo move.** Not just deletion — that
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
- **A box belongs to one container's coordinate space.** Reparenting in bulk has
  to clear `desk`/`phone` and let `ensureBox()` re-place, or the moved objects
  land on the same numbers in a grid where those numbers mean somewhere else —
  usually on top of something. `delDrawer()` is the one that got this wrong.
  Guarded as `contentsReplaced` in the smoke test.
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
