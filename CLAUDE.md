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
modules (`web/js/`) and two stylesheets (`web/css/`) — still no build step, no
dependencies, no framework, no bundler. It runs on iPhone and Mac, persists to
local storage, and works offline.

Everything in the requirements list is implemented **except** video and audio
files (images are real) and sync between devices (export/import JSON is the
bridge).

**Start here each session:** `docs/ROADMAP.md` holds the current plan in
dependency order — item 1 (the module split) is done. `docs/SPEC.md`
is currently stale (roadmap item 4); trust `docs/OBJECT-MODEL.md` and
`docs/STYLES.md` over it.

Read `docs/SPEC.md` before changing behaviour and `docs/DECISIONS.md` before
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
bump `CACHE` in `web/sw.js` or installed copies will keep serving the old
version from cache. A **new** file must also be added to `SHELL` in `sw.js` or
it won't work offline. This is the easiest thing in the project to forget and
the symptom — "my change didn't deploy" — points at the wrong culprit.

## Layout of the code

`web/index.html` is a thin shell: head, two stylesheet links, `#frame`, and one
`<script type="module" src="js/boot.js">`. The app is ES modules in `web/js/`,
loaded with no bundler. Imports are explicit and exports are the `export {…}`
clause at the bottom of each file — that list is each module's public surface.

| Module | What lives there |
| --- | --- |
| `util.js` | `$`, `esc`, `uid`, the `D` date object, icons (`ic`), markdown (`md`). All dates are `YYYY-MM-DD` strings in local time — never `Date` objects in state, never UTC. |
| `model.js` | ATTRS + KINDS (**the heart of the app** — see below and `docs/OBJECT-MODEL.md`), seed data, `S`, `inContainer()`, `childrenOf()`, `streak()`, `goalPct()`, relations. |
| `grid.js` | Grid geometry: `GRID`, `CELL`, `lay()`, `boxOk()`, `freeSpot()`, `ensureBox()`. Lives here, not in the views. |
| `look.js` | Themes, palettes, Styles, `applyLook()`. |
| `mutations.js` | `toggleDone`, `del`, `create`, `quickAdd`, repeat scheduling, `toast`. |
| `tiles.js` | `gridTile()` — the one place that decides how an object looks on a grid — plus rows, cards, list bands, book/scroll entries, and what a click does (`tileTap`). |
| `views.js` | The desk, a drawer, and settings — the only three places there are. Also `pinbar()`. `render()` replaces `#app`'s innerHTML wholesale, then saves. |
| `sheet.js` | `renderSheet()` — rendered into `#sheetHost`, **separately** from `render()`. |
| `panels.js` | Modals, side panels, command palette (⌘K), context menu. |
| `gestures.js` | Pointer-based drag, resize, lasso, swipe. The fiddliest code in the app. |
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
mental model. The one exception is the detail sheet, which renders into its own
host so that typing doesn't destroy the field you're typing in — respect that
split.

**Navigation is the desk plus whatever you pinned.** There are exactly three
views: the desk, a drawer, and settings. The four fixed tabs (Today, Keeping Up,
Everything) are gone — they were hard-coded aggregations, which is a magic
drawer's job. `S.pins` is an ordered list of drawer ids, resolved on read by
`pinnedDrawers()`; the same `pinbar()` markup is a top strip on a Mac and the
bottom bar on a phone. With nothing pinned it isn't drawn. See decision 22, and
don't add a view without a very good reason — a magic drawer is nearly always
the answer.

**Events are delegated, not bound.** Everything hangs off the listeners attached
to `#frame` in `wire.js`, dispatched on `data-*` attributes. To add an action,
add a `data-act="thing"` attribute and a case in `act()`. Don't attach listeners
inside render functions — they'd leak on every re-render.

**Drawers contain; objects don't.** One array, `S.objects`, holds both, and
every object names its `parent`. `ROOT` is the desk. Drawers nest inside
drawers; objects nest inside nothing. An object lives in exactly one drawer —
a magic drawer is the only way it appears anywhere else. Read
`docs/OBJECT-MODEL.md` before changing any of it.

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
and everything inside inherits it. `--c` does the same for drawer colour. Both
themes are driven from the token block at the top; don't hardcode a hex value in
a component rule.

**`.is-desk` / `.is-phone` on `#frame`** drive responsive rules — the breakpoint is
900px, set in JS, not a media query, because the same classes also need to apply
when you're editing the *other* device's layout from this one.

## Invariants that will bite you

- **Layouts are stored per device.** Each drawer has both `desk: {x,y,w,h}` and
  `phone: {x,y,w,h}`. Resizing must only touch `d[dev()]`. `dev()` returns the
  layout currently being *edited*, which is not always the physical device.
- **The grid is a coordinate space, not a flow.** `x`/`y` are 1-based cells and
  array order positions nothing. There is no `grid-auto-flow` — an empty cell
  stays empty. Every move and resize goes through `boxOk()`, which refuses
  anything that would overlap or leave the columns; see `web/js/grid.js`.
- **Cells are square and the row height is measured, never assumed.** Columns
  are fluid, so `sizeGrid()` reads the real column width after layout and caches
  it in `CELL`. Don't hardcode a row height — `GRID` deliberately has none.
- **There is no arrange mode.** Everything is always movable; a drawer can be
  `locked` to opt out. A 300ms hold arms the drag (`G.armed`), which is the only
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
- **Image bytes live in IndexedDB, never in the JSON.** The assets half of `persist.js`. `snapshot()`
  strips `media.src`; `hydrateAssets()` puts it back after a load. If you add a
  new place that writes objects to storage, it has to strip too.
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
- **Completed things leave their drawer** and appear only in the archive drawer.
  This is what keeps drawers finite, which is the entire argument for drawers.
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
