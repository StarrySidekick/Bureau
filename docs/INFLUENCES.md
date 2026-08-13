# What Bear, Things 3, Notion and Obsidian are actually doing

Written 2026-08-13, as scoping for roadmap item 6.

**What this is and isn't.** This is an appraisal of four apps from the outside —
what they visibly do, what that costs to build, and which of it Bureau could
take. It is not sourced research: nothing here comes from a published post-mortem,
an engineering blog, or a decompiled binary, and where I am inferring an
implementation I say so. The parts worth actually verifying before acting on
them are listed at the bottom, and roadmap item 6 keeps that work open.

Read this as a menu, not a plan. Most of what these apps do well, Bureau either
already does or has deliberately refused (a backend, a block editor, a plugin
API — decision 6 and the "Deliberately not doing" list).

---

## The one thing all four share

None of them are beautiful because of a colour palette. They are beautiful
because **one decision is made everywhere and never broken**:

| App | The decision |
| --- | --- |
| Things 3 | Nothing appears until you need it. Every control is earned by context. |
| Bear | The document is the interface. Chrome apologises for existing. |
| Notion | Everything is a block, and a block can be anything. |
| Obsidian | The file on disk is the truth; the app is one view of it. |

Bureau has one of these already — *everything sits on a grid, and what an object
can do is its attributes*. The value in studying the other four is not their
decisions, it is the **discipline with which they hold theirs**. Where Bureau
looks weakest is where it has quietly broken its own: a settings panel that is a
scrolling wall of controls, a context menu that lists twelve verbs, a type
builder that asks nine questions at once.

---

## Things 3 — the one to steal from

The nearest comparable, and the highest bar.

**Animation as explanation, not decoration.** Nothing in Things teleports.
Completing a task, opening a project, adding an item — each is a short
transform that shows you *where the thing went*. That is why the app feels
trustworthy: state changes are legible. Bureau has this instinct already (the
`swallow` pulse when something is filed, the lift sway, decision 30) but only in
three places, and the biggest state change of all — a full `render()` — is
instant and silent.

- **Take:** a shared vocabulary of transitions, defined once. Something arriving,
  something leaving, something being absorbed, something completing. Four
  keyframes, applied by class, rather than one-offs invented per feature.
- **Cost:** low. CSS plus a class-adding helper in `mutations.js`.
- **Risk:** full re-render is hostile to exit animations — the element is gone
  before it can play. That is the real cost, and it is a good reason to keep
  such animations to *arrivals* and *in-place* changes, which survive a rebuild.

**The magic plus.** One control, dragged to where you want the new thing.
Bureau's answer is better suited to a grid — click a bare cell, or sketch a box —
but the type picker that follows is a full-screen grid of every type, which is
the opposite of Things' restraint. A frequency-ordered short list with "more…"
would be the same idea, kept.

**Type as a design material.** Things is set in one family at four sizes with
generous line height, and the hierarchy comes from weight and spacing rather
than from rules and boxes. Bureau's tiles are close to this. Its *panels* are
not: ten-pixel uppercase labels over rows of pills is a settings dialog, and
reads like one.

**Keyboard-first, everywhere.** Every action has a key. Bureau has ⌘K and the
type shortcuts; it has no key for move, complete, or navigate-between-tiles.

## Bear — the writing feel

**The editor is not a preview.** Bear renders markdown *in place* as you type:
the `#` stays visible, the heading is already a heading. This is why it feels
like paper rather than like a compiler. Bureau's detail sheet has a textarea and
a rendered view and a toggle between them, which is the arrangement Bear exists
to avoid.

- **Take:** in-place styling of the markdown source in the sheet's textarea.
- **Cost:** high, and this is the honest answer. A textarea cannot style its own
  contents. Doing it properly means a `contenteditable` with your own input
  handling, or an overlay highlighter aligned to the textarea's metrics. Both are
  real work, both are famously fiddly on iOS, and one of them is the first step
  down the road to a block editor — which is on the "deliberately not doing"
  list for good reasons.
- **Middle path, and my recommendation:** a syntax-highlight overlay behind a
  transparent textarea (the CodeMirror-less trick — one `<pre>` positioned under
  the textarea, sharing its font metrics, re-rendered on input). It gets 80% of
  the feel for a fraction of the risk, keeps the textarea as the real input, and
  is deletable if it doesn't work. Roughly 100 lines and one invariant: *the
  overlay and the textarea must share every font and box property exactly.*

**Theme as a first-class object.** Bear's themes change type, colour and rules
together, and they are the app's identity rather than a settings page. Bureau
already has this — `look.js`, Styles, decision from v29 — and it is one of the
best things in the project. It is undersold: the Style tiles are buried
halfway down a long settings panel.

## Notion — one good idea, well insulated

The idea worth having is **the block**: one unit, one set of operations, and any
type expressible as a composition. Bureau's equivalent is the object with
attributes, which is the same bet at a different grain and, for a desk, a better
one — a page of blocks is a document, and Bureau is not making documents.

What Notion demonstrates that Bureau could use:

- **A property is a first-class thing you can sort, filter and total by.** Bureau
  has this (`FIELDS`, magic-drawer rules, `rollup()`), and it is under-exposed:
  rollups only render on two faces.
- **Views over the same data.** Bureau has this too — `layout` vs `face`,
  decision 24 — and it is one of the model's real strengths.
- **The database-as-object.** A container that defines a *schema* its children
  inherit. Bureau's magic drawers are the query half of this without the schema
  half. A container that says "everything filed in me is a shot" would remove
  the type-picking step from most filing.

What Notion demonstrates *not* to take: latency. Everything is a round trip and
the app is a browser in a costume. Bureau's local-first, no-build, no-framework
position is a straightforward win over this and should not be traded.

## Obsidian — mostly a list of things not to do

Kept on the comparables list as a warning (CLAUDE.md says so), and the warning
holds: infinite nesting, file soup, and a plugin ecosystem that becomes the
product. Two things are worth taking anyway:

- **The graph is a real feature, not a toy** — but only because links are typed
  and bidirectional. Bureau's `relate()`/`backlinksTo()` is already this shape.
  There is no view of it beyond a list on the sheet.
- **The store is inspectable.** Obsidian users trust it because they can see
  their files. Bureau's equivalent is JSON export, which is a button in settings
  rather than a promise. Worth stating more loudly, especially before sync.

---

## What I would actually do, in order

1. **A transition vocabulary** (Things). Four named keyframes, applied by class,
   replacing the three one-offs. Low cost, high effect, no architectural risk.
2. **Panels that ask one question** (Things). Settings is currently nine sections
   in one scroll. Splitting it — Appearance, Your things, Advanced — costs
   nothing structurally now that `openPanel` is the one system, and the panel
   already knows how to be replaced.
3. **The markdown overlay** (Bear). The single biggest change to how Bureau
   *feels* to write in. Prototype it behind nothing; if the metrics fight, delete
   it.
4. **Rollups on every face** (Notion). Already on the roadmap as a small gap;
   this is the argument for doing it.
5. **A container that types what you file into it** (Notion). Small model
   change — one field on a container, read by `create()` and by the drop path.
6. **A keyboard layer** (Things). Arrow keys between tiles, `space` to open,
   `enter` to edit, `⌘⌫` to delete. This is also the accessibility gap already
   on the roadmap, approached from the side that has a visible payoff.

Explicitly **not** recommended: a framework, a virtual DOM, a build step, a
plugin API, a block editor, or a backend. Nothing above needs one, and the
no-dependency position is what makes the native port (`docs/NATIVE-PORT.md`)
cheap.

## Worth actually verifying

The claims above I would not want to act on without checking:

- Whether Bear's in-place rendering is a `contenteditable`, an overlay, or a
  native `NSTextView` behaviour that has no web equivalent. This changes the cost
  estimate for item 3 by an order of magnitude.
- What Things actually uses for its transitions, and whether the "everything
  animates" impression survives instrumentation or is four well-chosen cases.
- Whether any of the four re-render wholesale like Bureau does, and what their
  numbers look like — the full-render decision is load-bearing here and has never
  been measured against anything.
