# What to build next

Rewritten 2026-08-11 after the full review (bugs fixed, Styles shipped in v29).
Sequenced by dependency, not appetite: item 1 makes everything after it safer.

---

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
