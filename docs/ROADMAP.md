# What to build next

Rewritten 2026-08-11 after the full review (bugs fixed, Styles shipped in v29).
Sequenced by dependency, not appetite: item 1 makes everything after it safer.

---

## 1. Module split — do this first, alone, in a fresh session

`web/index.html` is ~4,700 lines; decision 7 set the ceiling at ~3,000. The
last several regressions were caused by global find-replace editing, which the
size forces. Split into `<script type="module">` files (still no bundler):
state/model · grid geometry · tile rendering · panels/modals · gestures ·
persistence/migrations. While in there:

- consolidate `adopt()`'s ad-hoc per-load mutations into ordered, versioned
  `MIGRATIONS` steps run once each
- add smoke assertions for the newest systems: paste bridge, magic rules,
  rollups, relations, group move

*Done when:* app boots identically, smoke passes, no file over ~800 lines,
and a deliberate change to one module can't touch another.

## 2. The time layer

The stated goal names "visual timelines and time-based organization"; this is
the weakest area.

- interactive calendar face: click a day to see/add, drag an object onto a day
  to schedule it
- a real timeline view (inside a container, zoomable), not just the 8-node face
- month calendar page reachable from Today

## 3. Workflow completion

- **button actions** — a button can run an app action (new object of type X in
  container Y, toggle a lock, open the paste box), not just open things
- **template-spawn** — generalize `spawn` to deep-copy a template object with
  its children (weekly review, packing list)
- **undo log** — multi-level, covering group delete, drawer delete, paste
  import, panel changes

## 4. Known small gaps (fold into any session)

- manual reorder in list view is dead (`ord` unused, no drag)
- tag filtering has no UI since the sidebar went
- rollups only render on drawer-front and checklist faces
- accessibility: tiles are nested-interactive `<button>`s, no keyboard nav,
  no ARIA
- corner-grip resize is hover-only — invisible on touch; mobile drag vs scroll
  needs device testing
- SPEC.md is three redesigns stale (kinds table, membership rules, quick-add,
  themes) — rewrite it against OBJECT-MODEL.md and STYLES.md

## 5. Sync — blocked on a decision, not effort

DATA-MODEL option 3 (per-object `updatedAt`, last-write-wins) remains right.
But it needs a transport: CloudKit means the native shell (NATIVE-PORT.md);
anything else means revisiting decision 6 (no backend). **Decide before any
code.** The object model is already sync-shaped: flat, id-stable, timestamped.

---

## Deliberately not doing

- Collaboration/sharing, plugins, a web clipper (unchanged from v1)
- **Formulas** — rollups yes, expression language no
- **A block editor** — the body stays markdown in a textarea
- AI *features in-app* — the paste bridge covers generation without a key,
  a backend, or a bill
