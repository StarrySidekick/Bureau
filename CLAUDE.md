# Bureau — working notes for Claude Code

Bureau is Timothy's personal to-do / note / idea / writing app. It is not a
product for other people, and design decisions should be made for one user.

The organising idea: **everything is an object with a declared kind, filed in a
drawer.** Not files, not a feed, not a database of undifferentiated "items". A
task and a recipe and an essay are genuinely different things and the app should
know the difference. The drawer grid is the home screen and the largest visual
element in the app.

Comparables to keep in mind: Things 3 (for task feel), Bear (for writing feel),
Obsidian (for what to avoid — infinite nesting and file soup).

## Current state

A working, installable PWA in `web/`. Single-file app, ~1,770 lines of hand-written
HTML/CSS/JS, no build step, no dependencies, no framework. It runs on iPhone and
Mac, persists to local storage, and works offline.

Everything in the requirements list is implemented **except**: real media files
(placeholders only) and sync between devices (export/import JSON is the bridge).

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

After changing `web/index.html`, bump `CACHE` in `web/sw.js` or installed copies
will keep serving the old version from cache. This is the easiest thing in the
project to forget and the symptom — "my change didn't deploy" — points at the
wrong culprit.

## Layout of the code

`web/index.html` is the whole app. One `<style>` block, one `<script>` block
wrapped in an IIFE. The script is divided by numbered banner comments — find them
with `grep -n "· " web/index.html`. In order:

| Section | What lives there |
| --- | --- |
| 0 tiny helpers | `$`, `esc`, `uid`, and the `D` date object. All dates are `YYYY-MM-DD` strings in local time — never `Date` objects in state, never UTC. |
| 1 icons | Inline SVG path strings, `ic(name, size)`. Add new icons to `P`. |
| 2 KINDS | The kind registry. **This is the heart of the app** — see below. |
| 3 seed data | The sample desk a first-run user gets. Dates are relative to today. |
| 4 state | `S`, plus `inDrawer()`, `streak()`, `goalPct()`. |
| 5 markdown | ~35-line renderer. Headings, lists, checkboxes, quotes, bold/italic/code/links. Deliberately small. |
| 6 mutations | `toggleDone`, `del`, `create`, `quickAdd`, repeat scheduling. |
| 7–12b rendering | One function per view, each returning an HTML string. |
| 13 rail + tabbar | Sidebar (Mac) and tab bar (phone) navigation. |
| 14 main render | `render()` — replaces `#app`'s innerHTML wholesale. |
| 15 detail sheet | `renderSheet()` — rendered into `#sheetHost`, **separately** from `render()`. |
| 16–18 overlays | Modals, command palette (⌘K), context menu. |
| 19 gestures | Pointer-based swipe and drag-reorder. The fiddliest code in the file. |
| 19b persistence | localStorage read/write, JSON export/import. |
| 20 event wiring | One delegated listener set on `#frame`. All interaction routes through here. |
| 21 boot | Load, wire, render, register the service worker. |

## How to work in this codebase

**Rendering is full re-render.** `render()` rebuilds `#app` from `S` every time.
Don't add targeted DOM patching; it isn't the bottleneck and it would break the
mental model. The one exception is the detail sheet, which renders into its own
host so that typing doesn't destroy the field you're typing in — respect that
split.

**Events are delegated, not bound.** Everything hangs off the listeners attached
to `#frame` in section 20, dispatched on `data-*` attributes. To add an action,
add a `data-act="thing"` attribute and a case in `act()`. Don't attach listeners
inside render functions — they'd leak on every re-render.

**Adding a kind is a one-line change** and it should stay that way. Add an entry
to `KINDS` with a name, icon, colour, keyboard letter, one-line description, an
optional body template, and optional behaviour flags (`checkable`, `sched`,
`habit`, `goal`, `media`). Everything downstream — the new-object palette, filter
chips, the detail sheet's fields, drawer rules — reads from the registry. If you
find yourself special-casing a kind name in a view function, that's a smell; add
a flag to the registry instead.

**CSS uses custom properties for kind colour.** `--k` is set inline on the element
and everything inside inherits it. `--c` does the same for drawer colour. Both
themes are driven from the token block at the top; don't hardcode a hex value in
a component rule.

**`.is-desk` / `.is-phone` on `#frame`** drive responsive rules — the breakpoint is
900px, set in JS, not a media query, because the same classes also need to apply
when you're editing the *other* device's layout from this one.

## Invariants that will bite you

- **Layouts are stored per device.** Each drawer has both `desk: {w,h}` and
  `phone: {w,h}`. Resizing must only touch `d[dev()]`. `dev()` returns the layout
  currently being *edited*, which is not always the physical device.
- **Drawers are simultaneously smart filters and real containers.** `inDrawer()`
  is the single source of truth for what appears where and the order of its checks
  is deliberate. Read the comment above it before touching it.
- **Completed things leave their drawer** and appear only in the archive drawer.
  This is what keeps drawers finite, which is the entire argument for drawers.
- **Repeating a task doesn't reuse the object.** Completing it spawns a fresh
  object at the next due date and converts the original into a `record`. History
  is preserved rather than overwritten.
- **Storage may throw.** Private browsing and quota exhaustion both fail. Every
  storage call is already wrapped; keep it that way, and never let a failed save
  take down the render.
- **No `localStorage` access outside section 19b.** All of it goes through
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
