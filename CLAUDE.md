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

Everything in the requirements list is implemented **except** video and audio
files (images are real) and sync between devices (export/import JSON is the
bridge).

**Start here each session:** `docs/SYSTEM.md` is the reference for what Bureau is
made of — objects, attributes, types, drawers, the grid, the surfaces, storage.
`docs/ROADMAP.md` holds the current plan in dependency order.

Read `docs/SYSTEM.md` before changing behaviour and `docs/DECISIONS.md` before
changing structure — the second one records things that were decided deliberately
and shouldn't be undone by accident.

## Running it

```bash
scripts/serve.sh              # http://localhost:8000
node test/smoke.mjs           # headless browser check, needs the server running
```

Open it over http, never as a `file://` URL — the service worker won't register
and the manifest won't load, so you'd be testing a different app than the one
that ships.

`test/smoke.mjs` needs Playwright (`npm i playwright`). It exercises the desk,
drawers, quick-add, the detail sheet, habits and goals, both layouts, persistence
across a reload, and an offline reload. **Run it after any non-trivial change and
before saying you're done.** It writes screenshots to `test/shots/` — look at
them, this is a visual app and a passing assertion doesn't mean it looks right.

## Deploying

Live at **https://starrysidekick.github.io/bureau/**. Pushing to `main` deploys
it — `.github/workflows/pages.yml` uploads `web/` as the Pages artifact. Pages'
branch mode can only serve the repo root or `docs/`, and `docs/` is the written
documentation, hence the workflow.

After changing anything in `web/` (any `js/` or `css/` file, or `index.html`),
bump `CACHE` in `web/sw.js` **and** `APP_VERSION` in `web/js/persist.js` — the
two travel together, and the second is what Settings prints, so "which Bureau is
this phone running" can be read off the device instead of guessed at. Without
the cache bump, installed copies keep serving the old version. A **new** file must also be added to `SHELL` in `sw.js` or
it won't work offline. This is the easiest thing in the project to forget and
the symptom — "my change didn't deploy" — points at the wrong culprit.

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
| `views.js` | The desk and a drawer — the only two places there are. Also `pinbar()`, the time layouts (`viewMonth`, `viewTimeline`) and the settings panel's body. `render()` replaces `#app`'s innerHTML wholesale, then saves. |
| `sheet.js` | The two surfaces an object opens onto — reading and writing — rendered into `#sheetHost`, **separately** from `render()`. |
| `panels.js` | `openPanel()` — **every menu in the app** — plus `openMenu()` for a popup hung off a button, the command palette (⌘K), the context menu, and `sampleObject`/`sampleTile` for drawing a type as the thing it makes. |
| `gestures.js` | Pointer-based drag, resize, lasso, swipe. The fiddliest code in the app. |
| `motion.js` | Every movement: `openTile()` (drawer, cabinet, curl, lift), `pop()`, the holographic light (`--holox`/`--holoy`), and the pager that slides between boards. Nothing in it ever delays a state change. |
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
`sz-short` (h≤1), `sz-narrow` (w≤3) and `sz-mini` (1×1) onto every tile, and the
stylesheet only ever *takes away* what there is no longer room for — a tile
crossing a threshold loses a line rather than rearranging itself. 1×1 is handled
in `gridTile()` rather than in CSS: the tile is the type's mark and nothing else,
because at 40px a title is three letters and an ellipsis. The classes are spliced
into the first `class="` of whatever `drawTile()` returns, so a new branch gets
the behaviour without being told. See decision 26.

**An animation never holds anything up.** This is the one rule in `motion.js`
and it is easy to break by accident. A tap files, ticks or navigates the
*instant* it lands, `render()` runs, and the movement is drawn over the result
— which is why the flying drawer front goes into `#fx` and the pager hangs off
`#frame`, both outside the element `render()` replaces. Never `setTimeout(…,
300)` around a state change to "let the animation finish": that is how an
animated app becomes a slow one, and it breaks every test that reads state
after a click. See decision 38.

**How a thing opens is a property.** `openingFor(o)` in `motion.js` — `auto |
drawer | cabinet | curl | lift | none`, per object then per type. `auto` asks
what the object *is*: a container over four cells square swings open, a smaller
one pulls out, a paper shape curls, everything else lifts. Don't add a branch on
a kind's name to get a different movement; add a value, or set `opening` on the
type.

**The desk catches light, and light is the only thing that moves.** `--holox`
and `--holoy` on `#frame` say where it is coming from — tilt on a phone,
pointer on a Mac — and a magic drawer's foil is drawn from them in `chrome.css`.
There is no keyframe. If you want a surface to shimmer, read those two numbers;
don't add a loop.

**A tag is a magic drawer waiting to happen.** There is no filter mode and no
filter bar; clicking a tag anywhere calls `drawerForTag()`, which finds the
magic drawer collecting that tag or makes one. If you are tempted to add a
filter UI, add a drawer instead — that is the same instinct that deleted the
tabs (decision 22).

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

**Two fingers navigate; on a locked board, one does.** Both go through the
pager in `motion.js`, which draws the board either side of this one and slides
the strip with your finger rather than committing at a threshold. A locked board
has nothing for a finger to carry, so the finger walks the boards — while a tap
still opens the tile and the long press still opens the menu. See decision 38.

**Navigation is the desk plus whatever you pinned.** There are exactly two
views: the desk and a drawer. The four fixed tabs (Today, Keeping Up,
Everything) are gone — they were hard-coded aggregations, which is a magic
drawer's job. Don't add a view without a very good reason — a magic drawer is
nearly always the answer. See decision 22.

**There is more than one desk, and a desk is a drawer with a place of its own.**
`S.desks` is the master space: an ordered row of container ids with `ROOT` among
them. A container in it is somewhere you can *be* — the breadcrumb roots there
(`chainOf` stops at a desk), the top shelf belongs to it, and a sideways swipe
walks the row. Everything else is a drawer, somewhere you went *into*. Ask
`isDesk(id)` and `deskOf(o)`; promote with `setPin(id,'desk')`. The row does
**not** wrap — a space you can walk off the end of is a space you can learn.
See decision 39.

**A magic drawer sees its own desk unless it says otherwise.** `filter.scope` is
`desk` (the default) | `all` | `some` + `filter.scopeDesks`. Without it, a rule
on the Exercise desk answers with screenplay scenes. `inScope()` is checked
before every other clause in `inContainer()`, so it applies to the archive and
to every rule alike.

**There are two shelves, and a shelf is a strip you can reach from anywhere.**
The **bottom** one *is* the master space — the row of desks, home included, in
its own order. The **top** one carries the tools and whatever you pinned **on
this desk**, and rides in the grid bar. On a Mac both are drawn along the top;
on a phone the bottom one is its own strip along the bottom, which is the half a
thumb reaches. Ask `placeOf(id)`, `shelfHere()`, and render either with
`shelfStrip(where)`.

**Every tool on the top shelf is a toggle, not a menu.** The sort cycles seven
states and *wears the one it is on*; the lock is a lock, open or shut. A phone
has no room for a popup asking a question you could answer by pressing the
button again. A locked board refuses moves and resizes and **never** refuses the
long press — see `G.stuck` in `gestures.js`.

**A phone board has pages; it does not scroll.** It is exactly as many whole
square cells as fit between the two shelves (`PAGEROWS`, measured by
`sizeGrid()` — a `floor`, and the `ceil` it replaced is the entire reason the
board used to scroll). A page is *not stored*: `y` is one continuous coordinate
space per container and a page is a window of *n* rows onto it, so drag, drop
and `freeSpot()` know nothing about pages. The one rule is that nothing may
straddle a break, enforced in `boxOk()`. Two fingers up and down turn pages;
two fingers left and right walk the pins. See decision 37.

**Tapping bare board does nothing on a phone.** The way in is a swipe up off
the bottom shelf. Dragging a size out on bare board still makes something, on
both devices, because that one is deliberate. And on a phone every panel comes
up from the bottom rather than in from the right — a panel from the right covers
the whole board, which is the thing decision 23 exists to prevent.

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

**There is one settings panel, and one place words are written.** A container
is an object with children, so `objectPanel(id)` answers for objects,
containers and the desk alike — `drawerPanel` is an alias for it and the old
drawer *form* is gone. Everything that used to be on the detail sheet is in
there: fields, milestones, a streak, tags, relations, traits. The words are the
other half, and they get their own surface — `openWriter(id)` full screen, or a
double tap on the tile for a name and a line. Don't reintroduce a form that is
both. See decision 36.

**A one-of-many list is a `<select>`; a many-of-many is chips.** Forty types and
twenty shapes as chips were four hundred pixels you had to read like a wall. New
settings go in as `psel()`; if a group is genuinely multi-select, put the chips
behind a `pgroup()` disclosure.

**A sort is per object then per type.** Ask `sortOf(c)`, never `c.sort`. `manual`
is a real stored value — it is what lets one container refuse a type that sorts —
so writing `null` to mean "unsorted" reintroduces the bug it was there to stop.

**A new object has to be *seen*.** `reveal(id)` after creating one. A board is a
coordinate space and `freeSpot()` scans from the top, so on a phone — where an
object is full width — a new thing always lands below the fold. It looked
exactly like nothing had happened. Don't fix it by shuffling the board: things
you arranged don't move.

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

**A magic drawer is gilded, and the gilt is foil.** Not dotted, not speckled
with stars — a dotted border is what every drawing tool means by "not real yet".
`.magicdrawer` gets a ruled frame inset from the edge with corner brackets, and
a holographic wash that shifts as the light moves. The band of light that used
to travel across it on a seven-second loop is gone; see decision 38. Never
hardcode the gold: the highlight is `var(--glow)`, so it is leaf on Victorian
and a green shimmer on Starry. The spectrum under it is the one place in the app
that names hues outright, deliberately — a foil that is one hue is not a foil.

**An edge is a slot too.** The six `bd-*` classes are positions, not
descriptions — `bd-panel` is a Victorian moulding, a Pseudochromo hairline, a
white-pencil rule on Starry and a lit glass sill on Aero. A style names its own
six in `borders:[…]`; only the four dressed ones need per-style CSS, because
plain and none mean the same thing everywhere. Same rule as colour: never
hardcode what an edge is made of outside the style that owns it.

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
  to place something — a 6×6 drawer copied straight onto an 8-column phone grid
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
  it in `CELL`. Don't hardcode a row height — `GRID` deliberately has none.
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
- **A reading page is US Letter and sized from the window, never the text.** It
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
- **Anything destructive pushes an undo move.** `S.undo` is a stack of up to 20,
  each a list of `{del}` / `{add}` / `{set}` steps replayed backwards. Remove
  objects through `del()`, `delMany()` or `delDrawer()` in `mutations.js` — a
  bare `S.objects.splice()` in a handler is exactly how group delete came to be
  unrecoverable. A deleted picture is only freed from IndexedDB when its move
  falls off the bottom of the stack.
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
