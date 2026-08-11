# The object model

Two sorts of thing, and one rule about how they nest:

- A **drawer** is a container. It holds objects and other drawers. The **desk**
  is the one drawer you never see a tile for — it is the grid everything starts
  on.
- An **object** is everything else. Objects hold nothing.

So drawers contain drawers, drawers contain objects, and objects contain
nothing. Recursion lives entirely on the drawer side.

Drawers are customised through drawer settings — colour, view, rule. Objects are
customised through their attributes. The two are edited in different places
because they are different sorts of thing.

**An object lives in exactly one drawer.** The single exception is a magic
drawer, which collects by rule and can therefore show an object that lives
somewhere else. Tags are just labels and go on anything.

## The four words

| Word | What it is |
| --- | --- |
| **Object** | Anything that sits in a grid. The unit of everything. |
| **Attribute** | A capability an object has — a checkbox, a date, a button, the ability to contain other objects. Attributes define what an object can do and how it looks. |
| **Type** (`kind` in code) | A named preset of attributes. "Task" is the name for `text + check + date + repeats`. Kinds are made by mixing and matching, including by hand at runtime. |
| **Layout** | A named preset of a grid's arrangement — which objects sit where. A template for a desk or a drawer. |

A **drawer** is not a separate species. It is an object whose kind includes the
`container` attribute. Everything that used to be special about drawers —
colour, a rule, a preview style, a position on the grid — is now just what that
attribute carries.

## Why this is the same idea, better

The old registry already had behaviour flags (`checkable`, `sched`, `habit`,
`goal`, `media`) and CLAUDE.md already said that special-casing a kind name in a
view was a smell. Attributes are those flags, promoted: named, described,
composable, and editable by the user rather than only by the source.

The old model had two top-level arrays — `drawers` and `objects` — and a drawer
could never live inside anything. Collapsing them to one array with a `parent`
is what buys recursion, and recursion is what makes "a drawer inside a drawer"
a non-question.

## Attributes

| Attribute | Gives the object |
| --- | --- |
| `text` | A markdown body. The default; a bare object is just this. |
| `check` | A checkbox on the left. Ticking it completes the object. |
| `date` | A due date, and a place in Today. |
| `repeat` | Completing it spawns the next occurrence. |
| `button` | A button with a customisable target — another object, a drawer, or a URL. |
| `container` | Children, laid out on a grid or a list of its own. This is what makes a drawer. |
| `magic` | Collects **only** by rule, never by hand — a smart folder. |
| `spawn` | Makes new objects — on a press, or as you type into it. |
| `total` | Adds up a field across what it holds. |
| `streak` | A daily cadence and a tickable history, with no due date and no overdue. |
| `progress` | Ordered milestones and a progress bar. |
| `media` | An image, video, or audio file. A transparent PNG stays transparent. |
| `link` | A web address it points at. |
| `count` | A tally you add to. |
| `rating` | Out of five. |
| `location` | Where it is. |
| `duration` | How long it takes. |
| `priority` | How much it matters — drawn as a stripe, not a word. |
| `price` | What it costs. |

Attributes are additive and independent. Nothing reads a kind's *name* to decide
behaviour — if a view needs to know whether to draw a checkbox it asks
`has(o,'check')`, never `o.kind === 'task'`.

## The shape

```js
{
  id, kind,                    // kind names the attribute preset
  attrs: null,                 // per-object override; null = use the kind's
  title, body, tags,
  parent: "root",              // the container it lives in; "root" is the desk
  desk:  {x,y,w,h},            // where it sits in its parent's grid, per device
  phone: {x,y,w,h},
  ord,                         // where it sits in a list layout instead
  created,

  // carried only when the matching attribute is present
  done, doneAt, due, repeat, history, milestones, media, link,
  c, pv, filter, layout        // container: colour, preview, rule, grid|list
}
```

`root` is the desk itself — a container that is never rendered as a tile. An
object with `parent: "root"` sits on the desk, whether it is a drawer or a
single note pinned to the corner.

## Containment: hold or collect, never both

`inContainer()` is short on purpose:

- An **ordinary drawer** shows exactly the objects whose `parent` is that
  drawer. Nothing else. No rule.
- A **magic drawer** ignores `parent` entirely and shows whatever matches its
  rule — a kind, a tag, due today, or done. It never holds anything, so filing
  into one does nothing.

This is what makes "an object is in one place" true. It replaces the original
both-at-once design (see decision 1, and 17 which overturns it), and the cost is
that Kitchen no longer sweeps up every recipe by itself — you file it, or you
make Kitchen magic.

Completed objects leave every drawer except the archive.

## Face and layout

Two different questions, which used to be one property and shouldn't be:

- **`face`** — how a container draws itself on its *parent's* board: a drawer
  front, a checklist, a calendar, a moodboard, a timeline.
- **`layout`** — how it arranges its children once you *open* it: grid, list,
  or scroll.

A Checklist is `face:checklist, layout:list`. Conflating them meant a checklist
could not also be sorted when opened, and that any new face had to be a new
arrangement. Any container can now wear any face.

## Shape

How a non-container object draws itself — `card`, `note`, `idea`, `bubble`,
`page`, `index`, `spine`, `portrait`, `ticket`, `plaque`, `tally`, `quote`,
`verse`, `sliver`, `press`, `band`, `button`, `image`. A type declares its
default; any object can override it. This used to be read off the type's *name*
in both the renderer and the stylesheet, which meant an invented type could
never look like anything but a plain card.

`face` is the same idea for containers.

## Traits and fields

An attribute is a **trait** — what an object can do and how it is drawn. Some
traits also carry a **field**: a named, typed value (`FIELDS`). Only fields can
be sorted, filtered or totalled, which is what lets a magic drawer ask about
anything rather than the four things it used to know.

```js
price:  {key:'price', type:'money'}
prio:   {key:'prio',  type:'enum', opts:['low','mid','high']}
```

## Rules, rollups and relations

- A magic drawer's `filter.rule` is one clause — field, comparison, value —
  evaluated by `matchRule()`. "Price more than 10", "Priority is high".
- A container's `roll` totals a field across its children: count, sum, average,
  lowest, highest, or done-out-of. It shows on the container's face.
- `relates` holds ids of other objects. Relations are stored once and read both
  ways — `backlinksTo()` finds whoever points at you — which is how a Character
  connects to a Scene without either containing the other.

## Views

A drawer's `layout` is its view, remembered per drawer, set in drawer settings:

- **grid** — children placed by `{x,y,w,h}`. The default everywhere.
- **list** — one line each, for scanning.
- **scroll** — the same order, but nothing truncated: every object's whole body,
  top to bottom, for reading a drawer rather than scanning it.
- **checklist** — the contents worn on the outside: the tile itself lists its
  children with boxes you can tick without opening it. This is the one place
  completed objects **stay** rather than leaving for the archive, because seeing
  what you ticked is the whole point.
- **calendar** — a month, with a mark on any day something inside is due.

The last two are what a Checklist and a Calendar are: ordinary containers whose
layout draws their contents on the front. Nothing else distinguishes them, so
any drawer can become either by changing its view.

## The grid itself

Cells are **square**. Columns are fluid — 12 across on the Mac, 8 on the phone —
so the row height has to be measured from the real column width after layout,
not assumed. `sizeGrid()` does that and caches it in `CELL`; nothing may
hardcode a row height.

Twenty-four columns means the smallest possible object is a quarter of the
original cell. New objects land square and comfortable — 6×6 for a drawer, 4×4
for anything else — and can be dragged all the way down to 1×1.

## Gestures

There is no New button and no Arrange button, because both are gestures:

- **Click a bare cell** → the new-object menu, and whatever you pick lands on
  that cell.
- **Press and hold a tile** (~420ms) → arrange mode.
- **Shift- or ⌘-click** tiles → a Finder-style selection.
- **Right-click** → act on the selection, including sweeping it into a new
  drawer.

Settings is the only button left on the desk, and it is an object on the grid
like everything else.

## How things look on a grid

- A **drawer** shows its name, its count, and a pull. Nothing else — what is
  inside it is *inside* it, and you open it to find out. Clicking one opens its
  grid.
- An **image** fills its box, cropped, like something pasted into a scrapbook.
  Resize it and the crop follows.
- Everything **else** shows what its attributes say: a checkbox if it checks, a
  button if it buttons, a few lines of its text.
- A **control** is one of Bureau's own buttons. They sit on the desk grid and
  move and resize like anything else, which is why the desk has no toolbar.

## Migration, v2 → v3

`S.drawers` and `S.objects` become one array.

1. Each old drawer becomes an object of kind `drawer`, `parent: "root"`, keeping
   its `c`, `pv`, `filter` and both `{x,y,w,h}` boxes, with `layout: 'list'`.
2. Each old object keeps its id and gains `parent` — its old `drawer` field, or
   `root` if it had none — plus empty position boxes, filled lazily the first
   time it appears in a grid.
3. Old behaviour flags map to attributes: `checkable→check`, `sched→date`,
   `habit→streak`, `goal→progress`, `media→media`.

Nothing is dropped, and no id changes, so anything that referenced an object by
id still resolves.
