# The object model

The rule, in one line: **everything is an object, every object sits in a grid,
and a grid is itself an object.**

## The four words

| Word | What it is |
| --- | --- |
| **Object** | Anything that sits in a grid. The unit of everything. |
| **Attribute** | A capability an object has — a checkbox, a date, a button, the ability to contain other objects. Attributes define what an object can do and how it looks. |
| **Kind** | A named preset of attributes. "Task" is the name for `text + check + date + repeats`. Kinds are made by mixing and matching, including by hand at runtime. |
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
| `streak` | A daily cadence and a tickable history, with no due date and no overdue. |
| `progress` | Ordered milestones and a progress bar. |
| `media` | An image, video, or audio file. |

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

## Containment, still two ideas at once

`inContainer()` keeps [decision 1](DECISIONS.md): a container shows anything
filed in it by hand (`o.parent === c.id`) **plus** anything matching its rule.
Hand-filing still wins, completed things still leave, and the archive still
takes everything finished.

## Layout

A container's `layout` is `grid` or `list`.

- **grid** — children are placed by `{x,y,w,h}`, the same coordinate space the
  desk uses, at any depth. The desk is simply the root container in grid layout.
- **list** — children are stacked in `ord` order, which is what you usually want
  once you are *inside* a drawer looking at its contents.

New drawers default to `list`, because listing is the common case inside a
drawer; the desk defaults to `grid`. Either can be switched per container.

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
