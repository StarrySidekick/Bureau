# The Bureau system

What Bureau is made of, and the rules those parts obey. This is the reference —
if something here disagrees with the code, the code is a bug or this file is
stale, and either way one of them gets fixed.

`DECISIONS.md` says *why* each of these was chosen. `DATA-MODEL.md` says how it
is stored. `STYLES.md` says how it looks. This file says what it *is*.

---

## 1. The idea

Everything sits on a **grid**, and **everything on it is an object**. There is
one species and one array holding all of it. What an object can do is decided by
its **attributes**, and a named set of attributes is a **type**.

**Containing is one of those attributes.** An object carrying `container` holds
other objects and opens onto a grid of its own; an object without it holds
nothing. That is the entire difference, and it is why a **drawer** is not a
second sort of thing — it is the name the interface gives an object carrying
`container`, because "drawer" is what it looks like and what you do with it. The
word belongs in the copy and not in the code: ask `isContainer(o)`, which is
`has(o,'container')` and nothing more.

The **desk** is the outermost container and the only grid you never see a tile
for. An object lives in exactly one container. A **magic drawer** is the only
thing that can show it somewhere else, and it does that by rule, not by holding.

The point of all of it: a desk is a *place*, not a list. Position carries
meaning, containers are finite, and opening one is a small deliberate act.

## 2. The vocabulary

| Word | What it is |
| --- | --- |
| **Object** | Anything that sits on a grid. The unit of everything. |
| **Attribute** | One capability — a checkbox, a date, the ability to contain. Attributes decide what an object can do and how it draws. |
| **Type** (`kind` in code) | A named preset of attributes, plus a colour, an icon, a key, a starting size and a body template. Forty built in; you can invent more at runtime. |
| **Field** | The named, typed value some attributes carry (`due`, `price`, `prio`). Only fields can be sorted, filtered or totalled. |
| **Drawer** | An object whose type carries `container`. It holds other objects, including other drawers. |
| **Magic drawer** | A drawer that carries `magic` as well. It holds nothing and shows whatever matches its rule. |
| **Desk** | The root container, id `root`. Never drawn as a tile. |
| **Face** | How a container draws itself on its *parent's* board. |
| **Shape** | How a non-container object draws itself. |
| **Layout** | How a container arranges its children once you *open* it. |
| **Read view** | How a non-container object opens to be read: `book`, `page` or `scroll`. |
| **Rule** | One clause — field, comparison, value — that a magic drawer matches against. |
| **Rollup** | A number a container totals across its children, shown on its face. |
| **Relation** | An id one object holds pointing at another. Read both ways. |
| **Desk** | A drawer given a place in the master space — somewhere you can *be*, rather than somewhere you went into. It has no parent: promoting takes it off the board it was on. An ordered list, `S.desks`, with `root` among them. |
| **Master space** | The row the desks sit in. It does not wrap. The name at the top left lays it all out at once. |
| **Pin** | Anything kept to hand on the shelf. One global ordered list, `S.pins`. |
| **Inbox** | A magic drawer whose rule is `loose`: everything on a desk rather than filed in something. It collects; nothing is moved into it. |
| **Panel** | The one menu shape: a strip down the right, over a live desk. |

"Kind" in the code, "type" in the interface. `KINDS` kept its name so diffs
stayed readable.

## 3. The one law

```
desk ──contains──▶ drawer ──contains──▶ drawer ──contains──▶ …
  │                  │
  └──contains──▶ object    └──contains──▶ object
```

- Drawers contain drawers and objects. Objects contain nothing. Recursion lives
  entirely on the drawer side, and there is no depth limit.
- Every object names its `parent`. `root` is the desk.
- An object lives in **exactly one** drawer. Filing moves it; it never copies.
- A magic drawer ignores `parent` and shows whatever its rule matches. That is
  the only way an object appears in two places.
- Completed objects leave every drawer except the archive and the four faces
  whose job is to show what already happened — checklist, project, calendar,
  timeline (`keepsDone()`). Everywhere else they go, and that is what keeps a drawer
  finite, which is the whole argument for drawers.
- Reparenting goes through `isAncestor()` — recursion admits cycles, and a
  drawer dropped inside itself takes its subtree out of reach.

`inContainer(c, o)` in `model.js` is the single source of truth for all of it.

## 4. An object

One array, `S.objects`, holds drawers and objects alike.

```js
{
  id, kind,                  // kind names the attribute preset
  attrs: null,               // per-object override; null means "use the type's"
  title, body, tags,
  parent: 'root',            // the container it lives in
  desk:  {x,y,w,h},          // where it sits in that container's grid, per device
  phone: {x,y,w,h},
  ord,                       // where it sits in a list layout instead
  created, edited,
  shape, face, read, onclick,   // per-object overrides of the type's defaults
  opening,                      // and how it moves when it is opened
  ic, tsize,                    // its own mark, and how big the words on it are

  // carried only when the matching attribute is present
  done, doneAt, due, repeat, history, milestones, media, link,
  count, rating, loc, dur, prio, price, rel,

  // containers only
  c, board, pv, knob, border, texture,   // how the front looks
  layout, sort, locked, filter, roll     // how it behaves when opened
}
```

`desk` and `phone` start `null` and are filled by `ensureBox()` the first time
the object appears in that layout — coordinates are not invented for a device
you have never looked at.

## 5. Attributes

Twenty of them. Additive, independent, and never inferred from a type's name —
the app asks `has(o,'check')`, never `o.kind==='task'`. That rule is the whole
reason an invented type works everywhere immediately.

| Attribute | Gives the object | Field |
| --- | --- | --- |
| `text` | A markdown body. The default; a bare object is just this. | — |
| `check` | A checkbox. Ticking it completes the object. | `done` bool |
| `date` | A due date. | `due` date |
| `repeat` | Completing it spawns the next occurrence. | `repeat` text |
| `button` | A button pointing at an object, a drawer, or a URL. | — |
| `container` | Children, on a grid or a list of its own. **This is what makes a drawer.** | — |
| `magic` | Collects by rule only, never by hand. | — |
| `spawn` | Makes new objects — on a press, or as you type into it. | — |
| `total` | Adds a field up across what it holds. | — |
| `streak` | A daily cadence and a tickable history. No due date, no overdue. | — |
| `progress` | Ordered milestones and a progress bar. | — |
| `media` | An image, video or audio file. A transparent PNG stays transparent. An image opens onto the picture surface. | — |
| `link` | A web address it points at. | `url` text |
| `count` | A tally you add to. | `count` number |
| `rating` | Out of five. | `rating` number |
| `location` | Where it is. | `loc` text |
| `duration` | How long it takes. | `dur` number |
| `priority` | How much it matters — a stripe, not a word. | `prio` low/mid/high |
| `price` | What it costs. | `price` money |
| `answer` | A box on the front to answer it in. Filled means answered. | `answer` text |
| `relates` | Points at other objects, both ways. | `rel` refs |

`container` and `magic` are **structural**: they are excluded from `USER_ATTRS`
and never appear in the attribute picker, so a note cannot be ticked into a
drawer. Structural means *dangerous to toggle*, not different in kind —
containing is an ordinary attribute (see §1), and turning a note into a drawer
by brushing past a chip would orphan whatever was inside it, so the question is
asked deliberately in the type builder and the drawer settings instead of
casually everywhere. Everything else is yours to combine, including combinations nobody
designed for — a streak with milestones reads fine, and prevention would mean a
compatibility matrix.

The `control` type still declares an attribute of that name, left over from when
Bureau's own buttons sat on the board. Nothing reads it, migration 7 strips it,
and the type is hidden from the picker.

## 6. Types

Forty built in, grouped in the picker by what they are for. Each carries an
icon, a colour, a single-letter key, a description, a starting size, a body
template, an attribute set, a default shape or face, and — for an object — how
it opens to be read.

| Group | Types |
| --- | --- |
| **Containers** — hold other things | Drawer, Magic drawer, Checklist, Calendar, Trip, Moodboard, Project, Timeline |
| **Objects** — hold nothing | Task, Note, Idea, Outline, Script, Question, Essay, Habit, Goal, Image, Quote, Text field, Poem, Generator, Counter, Button, Achievement, Dream, Event |
| **Writing** — for a world you are making | Story, Scene, Character, Place, Event, Item |
| **Cooking** | Recipe, Ingredient, Shopping list |
| **Film** | Audio, Video, Shot |
| **Yours** | Anything you build in the type editor |

Plus **Control**, which is seeded rather than made and does not appear in the
picker.

A type also states `mediaType` where it means one — Audio is for audio and
Video for video — so an object that carries `media` and has nothing in it yet is
still known to be for sound rather than guessed at as a photograph that has not
arrived. `mediaTypeOf(o)` is the object's own answer then the type's; `isPicture(o)`
is that answer being `image`, and it is what decides which surface it opens onto.

A type is a preset, not a category. Changing an object's type swaps which
attributes it has and leaves its data alone, so an Idea becomes an Essay without
copy-paste, and switching back finds its milestones still there.

Types you invent live in `S.kinds` and are merged over `BUILTIN_KINDS` on read,
so a built-in can also be edited — and reset. In the picker and the builder,
**a type is drawn as the thing it makes**: a real `gridTile()` on a throwaway
object, built at desk scale and CSS-scaled down, never drawn small.

## 7. Drawers

A drawer has a name, a colour, a board, a front style, a face, a layout, a sort,
a lock, and two sizes. A magic drawer also has a rule. The desk has all of the
same settings, kept in `S.deskCfg` because it has no object to hang them on.

**Hold or collect, never both.**

- An ordinary drawer shows exactly the objects whose `parent` is it. No rule.
- A magic drawer shows whatever matches, and filing into one does nothing.

**Face** — how it draws on its parent's board: `front` (a drawer front with a
pull), `checklist` (its children listed with boxes you can tick without opening
it), `project` (a front page: progress, counts, what is next, what it is made
of), `calendar`, `moodboard`, `timeline`.

**Layout** — how it arranges its children once opened: `grid`, `list`, `scroll`
(nothing truncated — for reading a drawer rather than scanning it), plus
`checklist`, `calendar` and `timeline` for anything that isn't the desk.

Face and layout are two properties because they are two questions. A Checklist
is `face:checklist, layout:list`, and any container can wear any face.

**A container can take dictation.** `spawn` with `spawnBy:'type'` puts a box at
the top of it — on its front and inside it — and `genKind` says what a line you
type makes. A Checklist is the built-in that carries them, so it is a container
of tasks you can tick, add to and take from without opening it; any type that
ticks the same trait gets the same box. A magic container holds nothing, so what
you type into one is made where the container itself lives and collected back by
its rule (`spawnInto()`).

**A calendar is a magic drawer wearing a calendar layout.** It collects by rule
like any other and then draws what it collected on the day each thing is due —
the day is the `due` field on the object, never a container, which is why one
task can sit on two calendars. Its default rule is "anything with a date". It
answers three more questions, per object then per type: `calview`
(`month | week | day` — one screenful, and the arrows step by that unit),
`weekStart` (`mon | sun`) and `weekends` (shown or hidden, which takes two
columns off the grid). All three reach the front as well as the opened view.

**Rules.** A magic drawer matches on one clause — a field, a comparison
(`is`, `is not`, `contains`, `more than`, `less than`, `has any`), and a value —
or on one of the shorthands the seeded drawers use: a tag, a set of types, due
today, done. An object that hasn't got the field never matches.

**Rollups.** A container can total a field across its children: how many, total,
average, lowest, highest, or done-out-of. It shows on the face. Rollups, not
formulas — there is no expression language and there isn't going to be one.

**Sorting.** `sort` is per object then per type, like every other setting —
`sortOf(c)`. It is a **toggle** in the grid bar rather than a menu: one button
cycling seven states and wearing the one it is on, `M`/`A`/`Z` where a letter
is the answer and an arrow where a direction is. The values are `manual` (the order you arranged, which is a real
answer and not the absence of one), date made either way, date modified, or A–Z
either way. A type states the default its containers are born with, so a
Shopping list can be alphabetical while a Drawer stays as you left it; a
container may override its type with `manual`, which is why manual is stored
rather than implied. A sorted grid arranges itself, so tiles in one can't be
dragged.

**Tags are magic drawers waiting to happen.** There is no filter mode and no
filter bar. Clicking a tag calls `drawerForTag()`, which finds the magic drawer
collecting that tag or makes one. If a filter UI ever seems necessary, the
answer is a drawer.

## 8. The grid

Each container is its own coordinate space, and every device has its own.

- **24 columns** on a Mac, with unlimited rows and a board that scrolls.
  On a phone the count is a **setting** — Small (8), Extra (9), Large (10),
  `S.look.grid`, Small by default — the board is pages rather than a scroller,
  and the last row is the shelf: *n* by however many fit, plus one.
- Cells are **square** on both, ~58px on a Mac and ~49px on a phone at Small. Columns are
  fluid, so `sizeGrid()` measures the column width after layout, caches it in
  `COLW`, and makes the row height (`CELL`) match. Nothing may assume either.
  How many rows a phone page holds is the measured leftover — about seventeen —
  and the bar is kept thin because every pixel of it is a row.
- `x`/`y` are 1-based cells. Array order positions nothing. There is no
  auto-flow: an empty cell stays empty.
- Two objects may never overlap. A move or resize that would collide is
  **refused** — nothing you arranged moves unless you move it. `boxOk()` is the
  gate, and it only compares siblings, so two objects in different drawers may
  share coordinates.
- Layouts are stored per device, `desk` and `phone`, and both are editable from
  either device. `dev()` returns the one being edited, which is not always the
  one you are holding.
- The grid element carries no padding and no border, because `cellW()` measures
  its own rect. Decoration goes on a wrapper.
- The cell size is never rounded. Columns are `1fr` and therefore fractional;
  rounding made the error accumulate across the board until tiles at high x/y
  sat several pixels from where the drag maths thought they were.

New objects land at the size their type declares — 6×6 for a drawer, 4×4 for
most things, a wide sliver for a task — and can be dragged down to 1×1.

## 9. Surfaces

There are exactly **two views**: the desk, and a drawer. Everything else is one
of four things layered over them.

| Surface | What it is for | Where it lives |
| --- | --- | --- |
| **The grid** | The app. | `#app`, rebuilt whole by `render()` |
| **The bar** | Where you are — pressing it opens every desk at once — plus the pins on a Mac and three icon buttons: lock, sort, settings (and the star inside a drawer). | inside `#app` |
| **The shelf** | Whatever you pinned, drawn as a shelf with a slot per thing. In the bar on a Mac, its own strip along the bottom on a phone. | inside `#app` |
| **Reading** | An object's body as paper — a spread, a page, or a column. Over a dimmed desk. | `#sheetHost`, rendered separately from `render()` |
| **Writing** | The same body, full screen, with nothing else on it. A title and a textarea. | `#sheetHost` |
| **The picture** | What something made of an image opens onto: the image as large as the window allows, and — when there isn't one — the empty mount, which *is* the button that chooses a file. Replace and Remove in the head. | `#sheetHost` |
| **Panel** | Every menu, every form, and every setting an object has — the object editor among them. One at a time, down the right, over a desk that stays live. | `#frame`, outside `#app` |
| **Popup** | Picking one of a handful — Sort, the context menu. Hangs off the button that opened it. | borrowed context-menu element |
| **Command palette** | ⌘K. The one thing that kept a scrim, because it is a search field you type into blind. | `#frame` |

**Navigation is the desks plus one shelf.** There are no tabs. `S.desks` is the
row of desks, walked with a sideways swipe and laid out all at once by pressing
the name at the top left; `S.pins` is one global list of whatever you keep to
hand, drawn as the shelf. Both are ordered lists of ids resolved on read, so a
deleted drawer disappears from them by itself. The breadcrumb roots at the desk
you are on rather than at home, and the row does not wrap. There was briefly a
second shelf, per desk, along the top — two answers to one question at opposite
ends of the screen. See decisions 39 and 41.

**There are no modals.** `openPanel(spec)` is the whole system. `spec.body` is a
function so `refreshPanel()` can redraw from state; a form's draft lives in the
`PANEL` object, never on the DOM node. A surface and a panel claim the same
screen, and the surface wins.

**Everything an object can be changed to is in one panel — the object editor.**
`objectPanel(id)` answers for objects, containers and the desk alike — a
container is an object with children, so "drawer settings" and "object settings"
were the same question asked twice. Name, type, where it lives, its mark, how
big its words are, look, behaviour, every field its traits carry, milestones, a
streak, tags, relations, what a magic drawer collects, its traits, duplicate and
delete. A list of one-of-many is a `<select>`; the many-of-many groups are chips
behind a closed `<details>`. See decision 36.

At the top of it is **the thing itself**, drawn through the same `gridTile()`
the board uses, on a checkerboard scrolling diagonally. Every row was already
live; the stage is what makes that visible when the panel is covering the tile,
which on a phone it always is. What is drawn is a clone with a throwaway id and
its box at the origin — a second element carrying the real id is one the drag,
the bubble's anchor and `tileOf()` could pick up instead of the tile. The button
that opens it is a **paintbrush**; the desk's own settings keep the gear. See
decision 51.

## 10. Interaction

**There is no arrange mode and no New button** — both are gestures.

| Gesture | What happens |
| --- | --- |
| Click a tile | Whatever that object says — see below |
| Two fingers up / down | The next page of this board, and the one before |
| Two fingers left / right | The next pinned drawer, and the one before |
| Pull up off the shelf | A drawer front follows your finger; carry it a quarter of the screen and it opens the new-object menu. A phone; a *tap* on bare board does nothing |
| Hold a bare cell | Lights it; drag to size a box, let go for the picker — on a locked board too |
| Hold a tile, then move | The menu goes and the tile is in your hand, iOS-style — and the board unlocks |
| Carry a tile onto the shelf | Pins it. Nothing moves: `parent` and both boxes are untouched |
| Tap a pin you are already in | Back to whatever the pin interrupted — a pin is a toggle |
| Hold a pin | The menu, including the way back off the shelf |
| Hold a band in a list | Reorder it, under Manual sort only — it writes `ord` |
| Double-tap a tile | Its name becomes a field where it sits, and its body under it if the tile shows one. Containers are exempt: two taps on a drawer opens it twice |
| Press and hold a tile (200ms) | Arms the drag; then move it, or drag a corner to resize |
| Click bare grid | The type picker, and what you pick lands on that cell |
| Drag across bare grid | Sketch a box — the new object takes that size — or lasso tiles |
| Shift/⌘-click | Finder-style multi-select; dragging one moves the lot |
| Right-click | Act on the tile or the selection, including sweeping it into a new drawer |
| Drag onto a calendar day | Dates it, and files it into the drawer showing the month — unless that drawer is magic, which dates it and leaves it where it lives |
| Hold a line on a checklist front | Lifts it off as a chip; drop it on a drawer, a pin or the board to file it there. A tap still ticks it |
| Drag a pin | Reorders the bar |

**Clicking an object is configurable** — `clickOf()`, per object then per type:
nothing, read it, write in it, tick it off, open its editor, or make one of
something. Writing is not the default; it is on the context menu and on the
reading view. A drawer always opens. "Read" on something whose content is an
image means the picture surface, not paper — the routing is at the tap, so
`openRead()` keeps meaning one thing.

**A new object is scrolled to.** `reveal()` after every creation. A board is a
coordinate space, so a new thing takes the first free room scanning from the
top — and on a phone, where an object is full width, that is always below
everything already there. It was placed correctly and never seen.

**A picture opens onto the picture.** `isPicture(o)` — it carries media, and
that media is an image — and the surface is the image at whatever size the
window allows, with Replace, Remove and, if it also carries words, Read. Nothing
in it yet means an empty mount that is itself the file picker, on the surface
and on the board alike. See decision 49.

**Reading is one surface with three settings.** `readOf()` — per object, then
per type, defaulting to `page`:

- **book** — a two-page spread you turn through. On a phone there is no room
  for two, so it draws and steps as a page.
- **page** — the same paper, one leaf at a time.
- **scroll** — no pagination at all: the whole body in one column you scroll,
  an article rather than a book.

**How a thing opens is one property too.** `openingFor()` in `motion.js` — per
object, then per type, defaulting to `auto`, which asks the object what it is:

- **drawer** — the front pulls out of the shelf, toward you and past you, and
  the board inside it comes up behind. What a container smaller than four cells
  square, and no taller than it is wide, gets. One knob.
- **cabinet** — the front is two doors hinged at the outer edges and they swing
  open. What a container bigger than that gets, and what any container **taller
  than it is wide** gets at any size, down to two cells of width. The area
  threshold is per device, because a container is halved onto a phone. **Two
  knobs**, either side of the seam: a front says which movement it is about to
  make, and the count follows `openingFor()` rather than repeating the size
  test — say "pulls out" and the second door goes with it. See decision 50.
- **curl** — the sheet curls up off the board from its bottom edge, the way
  something pinned at the top does. What a paper shape gets: note, idea, verse,
  quote, index card, page, chit.
- **lift** — a small nod, so a tap is never silent. Everything else.
- **none** — nothing.

None of it delays anything. The tap files, ticks or navigates immediately and
the movement is drawn over the result, in `#fx`, outside what `render()`
replaces. See decision 38.

A page is **US Letter**, 8.5:11, and its size comes from the window, never from
what is written on it — whichever is smallest of the room available, a maximum,
and what the width allows at that ratio. All three modes are the same height, so
switching between them doesn't resize anything. A spread is two of those sheets
side by side, which is why book mode gets half the width per page to work with.

Only the first two paginate, and they do it by **measuring**: the body goes
into an offscreen twin of a real page and blocks are added until one doesn't
fit, which starts the next page. The answer is cached against the object, the
mode, the body length and the window size, so turning costs nothing and only
the first look at a body measures at all — a resized window clears it. A block
taller than a whole page still gets its own page rather than none. Turning is a
real turn: the leaf is built from the DOM
after the spread has redrawn, one page printed on each side, and rotated about
the spine, so it works anywhere a spread is drawn. `prefers-reduced-motion`
skips it. The type builder sets a type's default; the reading header and the
object's settings panel override it for one object.

**Keys.** `N` opens the type picker, then a single letter picks the type. `⌘K`
searches objects, drawers and types and offers to create what you typed. `⌘Z`
undoes — except in a field, where it is the browser's to answer. `Esc` closes
whatever is open.

**Undo** is a stack of up to 20 moves in `S.undo`, in memory only. A move is a
list of steps replayed backwards: `{del:{o,i}}` puts an object back at its
index, `{add:id}` takes one out again, `{set:{id,k,v}}` restores a field to
what it was. Deleting one thing, deleting a selection, deleting a drawer and
pasting are each one move. A deleted object's picture is only freed from
IndexedDB when its move falls off the bottom of the stack.

**Making things by typing** happens in four places: a Text field object (type
into it and a task appears beneath it), the box at the top of any container that
takes dictation — on its front and inside it — the day panel in a calendar, and
the command palette. All four go through `quickAdd()`, which reads `/type` at
the start, `#tag` anywhere, and `!today` / `!tomorrow` / `!week`.

## 11. Time, repetition, completion

- A task has a due date and an optional repeat: daily, weekdays, weekly,
  monthly.
- **Completing a repeating task does not reuse the object.** It spawns a fresh
  one at the next due date and turns the original into an `achievement`, so
  eleven waterings are eleven dated records rather than one counter.
- A habit has `streak` instead of `check`: a history of dates, a streak counted
  back from today, and no overdue — which is the guilt-generating pattern that
  makes habit trackers unpleasant.
- A goal has ordered milestones; progress is the fraction done.
- Completed things go to the archive, which is a magic drawer whose rule is
  `done`. Nothing is moved to get them there.
- `calendar` and `timeline` are layouts, not types. Nothing in the code knows
  what a calendar is — the Calendar type is a magic drawer that happens to wear
  one, and any container can wear it instead.

## 12. Storage

Local-first. No account, no backend, nothing transmitted.

- **`localStorage['bureau.v1']`** holds the whole desk: `{v, savedAt,
  desks, pins, inbox, look, kinds, deskCfg, objects}`. Writes are debounced 250ms. All of it
  goes through `persist.js` — no other module touches localStorage.
- **IndexedDB** (`bureau-assets`) holds image bytes. `snapshot()` strips
  `media.src` on the way out and `hydrateAssets()` puts it back after a load, so
  a backup stays small and readable. Anything new that writes objects to storage
  has to strip too.
- **Migrations** are ordered and versioned (`DATA_V`, currently 17). The
  snapshot's `v` records the last step applied, so each runs once per desk.
  `dedupeIds()` is a repair, not a migration, and runs on every load, because an
  old backup can reintroduce colliding ids at any time.
- **Export/import** writes and reads the same JSON. It is the bridge between
  devices until sync exists.
- **The paste bridge** takes JSON describing objects — written anywhere that can
  write JSON — and builds them through `create()`, so nothing can arrive that
  the model wouldn't have made itself.
- **Storage can throw.** Private browsing and quota exhaustion both fail; every
  call is wrapped, and a failed save must never take down a render.

Ids must be unique across sessions. `uid()` once restarted a counter on every
load, so the Nth object made today collided with the Nth made yesterday, and
dragging one tile moved a different object.

## 13. What is deliberately not in the system

No backend, no account, no sync yet. No build step, bundler, framework, or
dependency. No collaboration, plugins, or web clipper. No formula language. No
block editor — the body is markdown in a textarea. No AI features in-app; the
paste bridge covers generation without a key or a bill. No filter bar, no
sidebar, no tabs, no modals, no arrange mode.

Everything on the original requirements list is built except **video and audio
files** (images are real: picked from the picture surface or the object editor,
downscaled, stored in IndexedDB, placed and resized on the grid) and **sync between devices** (export/import is the bridge).

## 14. Where each part lives

| Part of the system | Module |
| --- | --- |
| Attributes, fields, types, state, containment, rules, rollups, relations | `model.js` |
| Coordinate space, collision, placement | `grid.js` |
| Faces, shapes, tiles, what a click does | `tiles.js` |
| The desk, a drawer, the bar, calendar and timeline layouts | `views.js` |
| The detail sheet | `sheet.js` |
| Every menu, form, popup and the palette | `panels.js` |
| Drag, resize, lasso, sketch, swipe | `gestures.js` |
| Create, complete, delete, undo, repeat, pin, tag-drawer | `mutations.js` |
| Storage, migrations, assets, export/import, paste | `persist.js` |
| Styles, the sixteen colour slots, tokens | `look.js` |
| The one delegated listener set | `wire.js` |

Conventions for working in it are in `CLAUDE.md`.
