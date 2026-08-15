# What to build next

Rewritten 2026-08-11 after the full review (bugs fixed, Styles shipped in v29).
Sequenced by dependency, not appetite: item 1 makes everything after it safer.

---

## 0a. Queued 2026-08-15 — DONE in the same pass (v55)

See decision 36 and `docs/BORDERS.md`.

- **the mobile bug** — a new object made inside a drawer landed below the fold
  and looked like nothing had happened; `reveal()` scrolls to it
- **one settings panel** — objects, containers and the desk; the drawer form
  and the detail sheet are gone, and everything on them moved in
- **one writing surface** — full screen, plus a double tap to edit a tile where
  it sits
- **condensed** — one-of-many lists are selects; traits and collect-rules are
  behind disclosures
- **a default sort per container type**, with `manual` as a real value
- **no coloured left stripe on any type**, a tick twice the size, and four new
  task shapes to choose between
- **a long press is Bureau's** — `-webkit-user-select:none`, `touch-action`

*Still open from that pass:* the border system is still container-only, and
picture frames are still a parallel list — `docs/BORDERS.md` §3 has the order
to fix that in. Timothy still has to pick one of the four task shapes.

---

## 0. Queued 2026-08-13 — DONE in the same pass (v44)

Six things asked for on 13 August; all six landed. See decisions 25b–30.

- **adaptive tiles** — `sizeClass()` stamps `sz-mini`/`sz-short`/`sz-narrow` and
  the stylesheet only takes away what there is no room for. At 1×1 the tile is
  the type's mark and nothing else (decision 26)
- **the board stays where you left it** — the scroll offset survives a redraw,
  keyed by where you are (decision 29)
- **the sway survives the drag** — `--carryx`/`--carryy` compose with the lift
  keyframes instead of being overridden by them (decision 30)
- **terminology** — everything is an object, containing is an attribute; the
  docs and the one comment that still said otherwise are fixed (decision 25b)
- **speech-bubble panels** — a panel about one tile comes up beside that tile
  (decision 27)
- **granular type sizes** — sliders as well as presets, on both grids, with an
  explicit `phoneSize` override (decision 28)

- **the phone grid halved**, 16 columns to 8, so a cell is ~47px against the
  desk's ~58 and the two grids finally mean the same thing by "one cell".
  Migration 10 halves every stored phone box (decision 31)

*Still open from that pass:* dragging the type preview's own corner to set the
size; the size thresholds are the same for containers and objects, and a 6×1
drawer probably wants its knob back.

## 1. Module split — DONE (2026-08-11, v30)

`web/index.html` is now a thin shell over thirteen ES modules in `web/js/` and
two stylesheets in `web/css/` — still no bundler. Largest file is ~625 lines
(`wire.js`). Also done in the same pass:

- `adopt()`'s ad-hoc per-load mutations are now ordered, versioned `MIGRATIONS`
  in `persist.js`, run once each and stamped into the snapshot's `v`
  (`dedupeIds` stays an every-load repair, deliberately)
- smoke assertions added for the paste bridge, magic rules, rollups,
  relations, and group move

The module map lives in CLAUDE.md. Note for later sessions: a *new* file in
`web/` must be added to `SHELL` in `sw.js`, and any change still needs the
`CACHE` bump.

## 2. The time layer — DONE (2026-08-11, v34)

`calendar` and `timeline` are **layouts**, so any container can wear one and
nothing in the code knows what a "calendar" is:

- a calendar drawer opens as a full month — day cells carrying what is due,
  ‹ › to step months, Today to come back
- clicking a day selects it and opens a panel listing that day with a quick-add
  that dates what it makes
- dragging a dated object onto a day cell schedules it **and** files it into
  that drawer, because a date you can't see it on is only half the gesture
- a timeline lays its contents on a real axis at however many pixels a day is
  worth, packing labels into lanes so they stay readable, with week ticks on a
  short span and month ticks on a long one

*Still open:* the calendar face on a tile is read-only apart from day clicks,
and a timeline can't be dragged to re-date (only the month can).

## 2b. Every menu is a panel — DONE (2026-08-11, v36)

See decision 23. There are no modals left: `openPanel(spec)` in `panels.js` is
the one system, and settings, the type picker, the type builder, the drawer
form, Move to drawer, Link to, Attributes, the paste schema and the object and
drawer settings all go through it. Settings stopped being a view. Sort became a
popup hung off its own button. The type picker draws every type as an object of
that type; the type builder is two columns and fits one screen; the drawer form
dropped the five controls the drawer panel already had.

*Still open:* the command palette kept its scrim on purpose. Move to drawer and
Link to are long unsearchable lists inside a panel — they want the palette's
filtering, not more space. Panels don't stack, so "Attributes" from an object
panel replaces it and there is no way back except reopening.

## 3. Workflow completion

- **button actions** — a button can run an app action (new object of type X in
  container Y, toggle a lock, open the paste box), not just open things
- **template-spawn** — generalize `spawn` to deep-copy a template object with
  its children (weekly review, packing list)
- ~~**undo log**~~ — done (2026-08-12). `S.undo` is a stack of up to 20 moves,
  each a list of steps replayed backwards (`{del}`, `{add}`, `{set}`), covering
  single delete, group delete, drawer delete and paste import, on the Undo in
  the toast or ⌘Z. *Still open:* panel changes aren't recorded, and there is no
  redo

## 4. Known small gaps (fold into any session)

- rollups only render on drawer-front and checklist faces
- accessibility: tiles are nested-interactive `<button>`s, no keyboard nav,
  no ARIA
- corner-grip resize is hover-only — invisible on touch; mobile drag vs scroll
  needs device testing
- ~~SPEC.md is three redesigns stale~~ — done (2026-08-12). SPEC.md and
  OBJECT-MODEL.md are folded into `docs/SYSTEM.md`, one reference for what the
  system is made of, written against the code rather than against the last
  redesign

## 4b. Borrowing from the four comparables

`docs/INFLUENCES.md` (2026-08-13) appraises Things 3, Bear, Notion and Obsidian
and proposes six changes in order — a shared transition vocabulary, panels that
ask one question, a markdown highlight overlay in the sheet, rollups on every
face, a container that types what you file into it, and a keyboard layer.

Two caveats worth carrying: it is an appraisal from observable behaviour, not
sourced research, and it closes with three claims worth verifying before acting
on them — chiefly what Bear's in-place markdown rendering actually *is*, which
changes the cost of the biggest item by an order of magnitude. Do that check
first if item 3 is the one that gets picked up.

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
