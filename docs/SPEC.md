# Bureau — what it is and how it behaves

## The idea in one paragraph

Everything sits on a **grid**. A **drawer** is a container on that grid which
opens onto a grid of its own; the **desk** is the outermost one. Everything else
is an **object**, and what an object can do is defined by its **attributes** — a
named set of attributes is a **kind**, and you can invent kinds by choosing
attributes. Drawers hold drawers and objects; objects hold nothing. An object
lives in exactly one drawer, unless a **magic drawer** collects it by rule. The
point is that a desk is a place, not a list — position carries meaning,
containers are finite, and opening one is a small deliberate act.

The full model is in [OBJECT-MODEL.md](OBJECT-MODEL.md).

## Kinds

Fourteen built in, plus any you make. Each has an icon, a colour, a keyboard
letter, a one-line description, a body template, and a set of attributes. The
attributes are what actually do the work — the table's "behaves like" column is
just the attribute set in words.

Three are structural rather than things you make from the menu: **Drawer**,
**Magic drawer** and **Control** (the Settings button). **Button** is an ordinary
object that is just a button, pointing at a drawer or a URL.

| Kind | Colour | Key | Behaves like |
| --- | --- | --- | --- |
| Task | green `#4A7C59` | T | checkable, schedulable, can repeat |
| Note | slate `#5F7A93` | N | plain markdown |
| Idea | amber `#C1902B` | I | template: spark / why / what it needs |
| Outline | violet `#7A6AA0` | O | template: numbered sections |
| Recipe | terracotta `#B5654A` | R | template: serves, time, ingredients, method |
| Script | blue `#4A6E8F` | S | template: slugline, action, dialogue |
| Question | rose `#A94E6B` | Q | checkable — closes when answered |
| Essay | olive `#5C7148` | E | long-form, word count shown |
| Habit | teal `#3E8A87` | H | daily/weekday cadence, streak history |
| Goal | brown `#8A5A3F` | G | milestones, progress bar, target date |
| Media | grey `#6E7075` | M | image, video, or audio |
| Record | gold `#9A7B2F` | A | something accomplished, dated |

Kind is a property, not a folder. Changing an object's kind in the detail view
swaps its fields and re-files it — an Idea that grows up becomes an Essay without
copy-paste.

The detail view also shows the object's attributes directly. Ticking one changes
that object alone; "Save these attributes as a new kind" turns the combination
into a kind you can reuse, which is how you get a kind Bureau never shipped.

**Answered:** "Should a drawer be able to contain another drawer?" — yes.
Drawers nest without limit; objects don't nest at all. **Still open:** whether
Habit is really its own kind or a Task with a `streak` attribute. Now that
attributes are composable it is one tick either way, which is most of the
answer.

## Drawers

A drawer has a name, a colour, a view, and two sizes — one for Mac, one for
iPhone. A magic drawer also has a rule.

**Membership** (`inContainer()`):

- An **ordinary drawer** shows exactly the objects filed in it — those whose
  `parent` is that drawer. Nothing else.
- A **magic drawer** ignores parentage and shows whatever matches its rule: a set
  of kinds, a tag, due today, or done. You cannot file into one.
- Completed objects leave every drawer except the archive, which is what keeps
  drawers finite.

**On the grid** a drawer shows only its name, its count and a pull — what is
inside it is inside it. A magic drawer is marked with a sparkle and looks faintly
unsettled, because it holds nothing.

**Sizes and position** — the grid is **square**: 12 columns on the Mac, 8 on the
iPhone, with rows as tall as a column is wide. Each object stores its own
`x, y, w, h` per device, so the desk is a coordinate space: things stay where
you put them and an empty cell stays empty. New objects land square — 3×3 for a
drawer, 2×2 for anything else — and can be dragged down to a single cell.

The desk has no toolbar and no sidebar. **Click a bare cell** to make something
there; **press and hold** a tile to start arranging; **shift- or ⌘-click** to
select several, then right-click to sweep them into a new drawer. Settings is
the one button left, and it is an object on the grid like everything else.

Arrange mode — entered by pressing and holding any tile — turns the grid into
visible graph paper and gives every tile eight handles. Drag the body to move it, drag an edge or
a corner to resize it — the same as a window, but snapped to cells. Drawers may
not overlap; a move or resize that would collide is refused and says so. The
size chip still cycles presets, which is quicker with a thumb. All of it **only
touches the layout you're currently editing** — Settings lets you open the other
device's layout and arrange it from here.

**Colour** — the background, the accent, the drawer outline, and each drawer's
own colour are all settable, from a palette of warm solids (browns, greens,
blues, earths) or a colour picker. Background defaults to parchment.

The nine seeded drawers: Today, Inbox, Writing Desk, Idea Bin, Studio, Kitchen,
Open Questions, Keeping Up, Done & Dusted.

## Views

- **The Desk** — the drawer grid. Home.
- **A drawer** — quick-add bar, kind filter chips, list or card view, reorder mode.
- **Today** — a week strip, overdue, everything scheduled for the selected day,
  and the day's habits.
- **Keeping Up** — habits with 14-day streak grids, goals with milestone
  checklists and progress, and the timeline of past accomplishments.
- **Everything** — all objects, filterable by kind and tag.
- **Settings** — theme, layout editing, backup, reset.
- **Object detail** — opens over everything. Title, kind, drawer, schedule,
  repeat, tags, kind-specific fields, and a markdown body with Read/Write toggle.

## Interaction

**Gestures**

- Swipe a row left → delete, with undo in the toast.
- Swipe a row right → complete/file.
- Drag a row vertically → reorder. Mouse anywhere; on touch, first turn on
  Reorder mode, because otherwise vertical drag fights the scroll.
- Drag a drawer in arrange mode → reorder the grid.
- Right-click or the ⋯ button on a row → open, complete, schedule today or
  tomorrow, move to drawer, duplicate, delete.

**Quick add** — the bar at the top of every drawer. Plain text makes an object of
the drawer's default kind. `/idea` at the start picks a kind by prefix, `#tag`
attaches tags, `!today` / `!tomorrow` / `!week` schedules.

**Keyboard** — `N` opens the new-object palette, then a single letter picks the
kind. `⌘K` searches objects, drawers and kinds, and offers to create what you
typed. `Esc` closes whatever is open.

## Tasks, habits, goals, records

- Tasks have a due date and an optional repeat: daily, weekdays, weekly, monthly.
- Completing a repeating task creates the next occurrence and turns the original
  into a dated `record`, so the history is real rather than a reset counter.
- Habits store a list of completed dates. The streak counts back from today, and
  tolerates today not being done yet. The detail view has a 28-day grid you can
  click to fix a missed day.
- Goals hold ordered milestones with dates and done flags; progress is the
  fraction completed.
- Records are the archive. Anything finished lands there with the date it was
  finished, and Keeping Up shows them as a timeline.

## Look

Two themes: **Paper** (warm off-white, ink, brass) and **Walnut** (dark, the same
brass). A serif for headings, drawer names and numbers; the system sans for UI.
Drawer tiles have a lit top edge, a brass pull, and lift on hover. Nothing pure
white, nothing pure black, no drop shadows that look like Material.

Kind colours are muted and distinguishable in both themes — they're identity, not
decoration, and they carry information the same way a coloured file tab does.

## Requirements, and where each one landed

| Requirement | Status |
| --- | --- |
| iPhone app | PWA, installs to the home screen and runs standalone |
| Mac app | Same PWA, installs to the Dock |
| Syncs between devices | **Not built.** JSON export/import is the bridge |
| Basic to-do list | Yes |
| Making new to-dos | Quick add, palette, ⌘K, keyboard |
| Adjusting order of items | Drag to reorder, per drawer |
| Scheduling into a calendar | Due dates, week strip, Today view. No month grid yet |
| Choosing an object's kind | Kind picker with templates, changeable later |
| Shortcuts / templates for new kinds | Single-letter keys, per-kind body templates |
| Gestures for delete / create / sort | Swipe both ways, drag, long-press menu |
| Visually customisable and pretty | Two themes, per-drawer colour and preview style |
| Markdown | Yes, small renderer; Read/Write toggle |
| Tagging | Yes, with filtering from the sidebar |
| Sorting into drawers | Yes, by hand and by rule |
| Drawers as home page, sized on a grid | Yes |
| Separate mobile and desktop drawer layouts | Yes, both editable from either device |
| Images, video, audio in and as objects | **Images are real** — picked, downscaled, stored in IndexedDB, placed and resized on the grid. Video and audio still placeholders |
| Repeating tasks | Yes |
| Habit tracking | Yes, with streaks |
| Long-term goals and milestones | Yes |
| Record of past accomplishments | Yes |
