# Diagnostic — 19 August 2026

> **All of it was built the same day, in v0.62.** Every item in §6 landed, plus
> the `deadline` attribute from §4. See ROADMAP §0m for what shipped and
> decisions 62–71 for why each one is the shape it is. What is *still* open is
> at the foot of that roadmap entry: nested tags, template-spawn, and the
> animation list. This file is kept as written — a diagnostic that gets edited
> to agree with what was done afterwards is not a diagnostic.

The thirteenth pass is not written yet; this is the look at the app that decides
what it should be. Read with `ROADMAP.md`, which carries the plan this proposes,
and `INFLUENCES.md`, which this corrects in one place.

Method: read the whole of `web/js`, ran the smoke test, looked at every
screenshot it wrote, and measured the thing nobody had measured — what a render
costs as a desk fills up. Nothing in `web/` was changed, so no cache bump.

---

## 1. The state of it

`node test/smoke.mjs` is **entirely green** — every assertion true, no console
errors, no page errors, on both layouts and after an offline reload. That is
over 350 assertions across the desk, drawers, the three surfaces, fronts, the
editor, the picture, the pager, migrations and selection. The app
is not broken anywhere the test can see, and the test can see a lot. (Counted
off the printed summary: every leaf in it is truthy and `errors` is empty.)

What follows is therefore all critique of a working thing. None of it is a
crash. Most of it is either *the app quietly breaking its own rule* or *a good
idea that got built halfway and stopped*.

## 2. What was measured

`test/scale-probe.mjs` — new, run by hand, not part of the smoke test. It pours
objects onto the sample desk and times a render, the string build inside it, and
a full save. Headless Chromium, so read it as *shape*, not as milliseconds on an
iPhone; a real handset is roughly two to four times slower.

**And read it against itself, not across runs.** Re-running these numbers after
the pass gave figures 30–50% higher at *every* size, including 145 objects where
almost nothing changed — and `save`, whose code path was not touched at all,
went from 0.4ms to 1.2ms on the same 42 KB. That is the machine, not the app.
A timing comparison across a session is worth nothing here; what a change did
has to be shown some other way, which is what the smoke test is for.

| Objects | Mac render | Mac build | Mac save | Phone render | Phone build | Tiles drawn (Mac / phone) | Stored |
| ---: | ---: | ---: | ---: | ---: | ---: | :---: | ---: |
| 145 *(as it ships)* | 12ms | 2.5ms | 0.4ms | 7ms | 1.6ms | 59 / 23 | 42 KB |
| 345 | 16ms | 2.8ms | 0.9ms | 11ms | 2.3ms | 159 / 83 | 94 KB |
| 1,145 | 42ms | 7.5ms | 3.4ms | 17ms | 6.2ms | 559 / 143 | 292 KB |
| 3,145 | 111ms | 18.5ms | 35.5ms | 28ms | 13.8ms | 1,559 / 203 | 800 KB |

**Re-measured at v1.07**, after every tile grew a moulding layer and, when it
has a grain, a grain layer (decision 99). At the size Bureau is actually used
it is unchanged — 13.5ms before, 13.6ms after on a Mac; 8.3 to 8.1 on a phone.
At three thousand objects, where a Mac is drawing fifteen hundred tiles at
once, it is 120ms to 137ms. Two extra elements per tile is a linear cost paid
in layout, and the string build is *faster* than before, so nothing about the
shape of the curve changed. The grain layer is skipped when there is no grain,
which is what brought the ship-size number back to parity; the moulding layer
is unconditional on purpose — which aesthetics put something on it is the
stylesheet's business, and encoding that list in the renderer is the
silent-failure coupling decision 98 exists to avoid.

Four things fall out of that, and only one of them is a worry.

**The memo works, and decision 8 survives.** Growth is linear, not quadratic.
`beginPass()` did what decision 59 claimed it would: `childrenOf()` walking
every object per container was the quadratic term and it is gone. Full
re-render at the size Bureau is actually used at costs ten milliseconds. It was
never measured against anything before; now it is.

**The phone pages and the Mac does not.** At 3,145 objects the phone draws 203
tiles and the Mac draws 1,559 — `gridOfContainer()` filters to the current page
when `pageRows()` answers, and on a Mac it answers zero. So the first thing to
get slow is not the model, not the rules, and not the phone: it is a Mac desk
with a thousand things loose on it. Not a problem to solve now — it is a problem
to *know about*, because the instinct when a board feels heavy will be to blame
the full re-render, and the full re-render is not the culprit. The string build
is 18ms of the 111ms. The rest is the browser laying out fifteen hundred
absolutely-placed tiles, which no amount of cleverness in `viewHTML()` touches.

**`render()` saves whether or not anything changed.** The last line of
`render()` is `save()`, and the comment says "cheaply". At 145 objects it is
0.4ms and the comment is right. At 3,145 it is 35ms — the single most expensive
thing in the frame, and it fires for renders that changed nothing at all:
walking to the next desk, turning a page, opening a drawer, closing a panel.
The debounce means it lands once per 250ms rather than per render, which is
exactly the interval at which you would notice it while dragging. A dirty flag
set by the mutations and cleared by `writeNow()` is about six lines and removes
the whole class.

> **Fixed in v0.62** (decision 64), and guarded as a *count* rather than a
> time: `savesOnlyChanges.idleRendersDoNotWrite` in the smoke test wraps
> `localStorage.setItem`, renders six times, and requires zero writes. A count
> is the honest way to assert this — it says the thing that was actually wrong,
> and it does not move when the machine does.

**Storage has a ceiling and it is further away than it feels.** About 260 bytes
an object. `localStorage` is ~5MB, so the hard wall is around 19,000 objects;
comfort ends earlier, when a 35ms save becomes a 200ms one. Nothing to do. But
it is the number to quote when sync is decided, because it says the JSON
snapshot is a viable sync payload for a very long time.

## 3. Where the app breaks its own rules

These are the ones that matter, because Bureau's argument is that one decision
held everywhere is what makes an app feel made rather than assembled.

### 3a. The board prints markdown source

**This is the worst thing in the app and the cheapest to fix.** Look at any
screenshot: the Idea on the desk reads

> `**The spark —** **Why it might work —** **What it needs —**`

and the reading-notes note reads `A handle affords pulling **for a hand**.
- Signifiers > affordances`. `gridTile()` does `esc(String(o.body).slice(0,
BODY_ON_FACE))` — the source, escaped, no rendering and no reduction. Every
type that ships with a body template (idea, outline, script, essay, quote,
question, habit, goal, recipe) therefore puts asterisks and hashes on the desk
the moment it is made. The type picker draws them too, so the *advertisement*
for each type is a sample of it wearing its own syntax.

CLAUDE.md says a body fills the face it is printed on. It does. It just prints
the wrong thing on it. The fix is not `md()` — a face is not a page and headings
and lists have no business inside a tile. It is a `plain()` reduction next to
`md()` in `util.js`: take the marks off, keep the words, collapse a list to its
items. Twenty lines, and it changes every screen in the app.

### 3b. Every menu is a panel, and one panel is nineteen questions

Decision 23 won the argument against modals and the panel system is genuinely
good. Then two panels grew into exactly the thing Things 3 exists to avoid.

- **The object editor** is Name, Type, Lives in, Shape, Colour, Mark, Text
  size, Edge, Clicking it, Opens as, Reading, Fields, Milestones, Streak, Tags,
  Related, Traits, Duplicate, Delete. The Mark row alone is a wall of thirty
  icons. On a phone this is a very long scroll to change a colour.
- **Settings** is Version, Style, Light and dark, Sixteen slots, Background,
  Board, Shadows, Grid size, Owner, Accent, Outline, Layouts, Your things,
  Install, Paste, Testing, Start over. Seventeen sections in one column, with
  a *Testing* button among them.
- **The type picker** shows all forty types in six sections, every time, on
  every device, wherever you are. It is the most beautiful screen in the app
  and it is a catalogue.

INFLUENCES.md flagged this six days ago as item 2, and it was the second thing
on its list. It costs nothing structurally — `openPanel` already replaces
itself — and the absence of a way *back* from a replaced panel is the only real
work in it.

### 3c. A magic drawer can ask one question

The shorthands do stack — `inContainer()` ANDs `kinds`, `tag`, `loose` and
`rule` in sequence, which is how the seeded Open Questions drawer manages
"questions with an empty answer". What there is exactly one of is the **free
field clause**: a single `filter.rule` of field / comparison / value. So

- "due after Monday and before Friday" — two clauses on one field — cannot be
  said, and neither can "due this week", which is the same thing;
- "high priority *and* has a duration" — two clauses on two fields — cannot;
- more than one tag cannot: `filter.tag` is a single value;
- and there is no OR anywhere, at any grain.

That last one is fine and should stay refused — an OR needs groups and groups
need a rule builder, which is a query UI, which is the thing tags-become-drawers
exists to avoid. The fix is `filter.rules` as an **array, ANDed, capped at
two or three**. Everything a desk actually wants lives inside two clauses.

This is the one item in this document that changes the data model, so it wants
a migration and it wants doing before anything else is built on top of rules.

### 3d. Undo covers deletion and nothing else

`pushUndo` is called from `del`, `delMany`, `delDrawer` and paste. Every panel
edit, every move, every resize, every type change, every colour, every
reparent — none of it is on the stack, and there is no redo. ⌘Z after
accidentally changing a drawer's type does nothing, silently. On a grid app
where a move is refused rather than shoved this is less dangerous than it
sounds, but "⌘Z works sometimes" is worse than either alternative.

### 3e. Two types you cannot put a file in

Audio and Video are real types with `mediaType` set, sizes, marks and a place
in the picker, and the file input is `accept="image/*"` with `importImage()`
behind it. So the two types exist to be told they are not implemented. That is
the last item on the original requirements list, and it is fine for it to stay
last — but a type in the picker that cannot do its one job is a promise the
desk is making and not keeping. Either wire them (an `<audio>`/`<video>` element
and a blob in IndexedDB is not much more than the image path) or take them out
of the picker until they are.

### 3f. The palette cannot be driven from the keyboard

⌘K opens a search field and `Enter` runs result **zero**. There is no arrow-key
handler, so a keyboard-summoned, keyboard-typed list can only be finished with
the mouse unless the thing you want happens to be first. It also does not search
tags — title and body only — which is odd in an app whose whole filing story is
tags. Both are a dozen lines in `wire.js` and `cmdList()`.

More broadly: there is still no keyboard anywhere on the board. No arrows
between tiles, no space to open, no ⌘⌫ to delete. This is also the accessibility
gap the roadmap has carried since item 4, approached from the side that has a
payoff you can see.

### 3g. Rollups render on two faces

`rollup()` appears twice in `tiles.js` — the checklist face and the drawer
front. A project, a calendar, a timeline, a moodboard and a spine show nothing,
so the answer to "what is a container worth" depends on which coat it has on.
It is the first line of the roadmap's "known small gaps" list and it is still
true.

## 4. What to take from the three apps

INFLUENCES.md (2026-08-13) is still the right appraisal, and **all six of its
recommendations are still open** — item 5 comes closest, and only because
`genKind` already existed for a different reason. A dozen passes have shipped
since it was written and none of them was one of its six, which is worth
noticing on its own: the passes have been about the furniture, and this list is
about the work. This section adds what those passes have made newly worth
taking, and corrects the list in one place.

### The correction: the Bear overlay gets you less than 80%

INFLUENCES recommends a syntax-highlight overlay behind a transparent textarea
and estimates "80% of the feel". That is too generous, and the reason is
structural rather than fiddly: **the overlay has to match the textarea's metrics
exactly, and a textarea has one font at one size for all of its text.** So the
overlay can change *colour* and it cannot change *size or weight* — bold cannot
be bolder and a heading cannot be bigger, because either would move the
characters out from under the caret. What Bear actually does — the `#` stays
visible and the heading is already a heading, syntax fading out when the cursor
leaves the line — is a custom text engine on a native text view. Its own team
built a second editor, Lettera, around that behaviour rather than getting it
free from a control.

So the honest menu is three items, not one:

1. **Overlay** — syntax *colouring* only. Maybe 100 lines, deletable, and it
   does not give the paper feeling. Worth it only if colour is what you wanted.
2. **`contenteditable`** — the real thing, real work, famously bad on iOS, and
   the first step down the road to a block editor, which is on the never list.
3. **Neither — make the textarea behave instead.** Return in a list continues
   the list; `**` wraps a selection; `#` at the start of a line is a shortcut;
   ⌘B does the obvious. This is what people miss when they say an editor feels
   dumb, it is a day's work, it survives iOS, and Bureau *already* has the
   "already a heading" half — the reading surface is one tap away and it is
   better paper than Bear's.

**Recommendation: 3, and drop 1 and 2.** The overlay was the best idea available
when the alternative was a toggle between a textarea and a preview. It is not
the best idea now that reading is its own surface.

### From Things 3

**When is not the same as due.** Things' central idea, and the one thing in it
Bureau has not got: *when I will work on this* and *when it is actually late*
are different facts, and an app that stores one date makes you lie about the
other. Bureau's `due` is doing both jobs — it is the day the thing sits on in
a calendar (`coversDay`), it is what Today collects on, and it is what the
overdue styling reads. Add `deadline` as an **attribute**, not a field on Task:
opt-in, so a note that is due Friday and a task you have merely scheduled for
Friday stay different things, and so nothing already on the desk changes. The
Today drawer then means "what I said I would do today" and a second drawer can
mean "what is late", which is the pair of questions the app currently answers
with one.

**Restraint in the picker.** Not a new idea — INFLUENCES said it. Lead the
picker with the four or five types this desk actually uses, then the rest behind
"more". A frequency count over `S.objects` is three lines and needs no storage.

**Animation as explanation.** The queued list in ROADMAP §0b-next is exactly
Things' discipline written out, and items 1–3 (filing lands, a new object
arrives from where it was made, undo runs the delete backwards) are the three
that answer "where did that go". None started. They are worth more than items
4–16 put together.

**Keyboard everywhere.** See 3f.

### From Bear

**Take the syntax off the board** — 3a. This is Bear's actual decision (the
document is the interface) landing on Bureau's actual surface, and it is the
single highest-value item in this document.

**Nested tags.** Bear's `#work/clients` is its whole filing system and it is
better than Bureau's flat tags for one reason: a tag with a slash in it already
describes a tree, and Bureau *has* the tree. `drawerForTag()` makes a magic
drawer per tag; `#film/shoots` would make a magic drawer inside the magic drawer
for `#film`, and the containment story would come out unchanged. Cheap, and it
is the kind of thing that makes tags worth using rather than worth having.

**Let one object out as markdown.** Export is a whole-desk JSON button in
settings. There is no way to get *this note* out as text — no copy-as-markdown,
no share. Obsidian earns its trust by being inspectable and Bureau's answer is
one all-or-nothing button. A "Copy" on the writing surface is ten lines and it
is the difference between a store you trust and a store you hope about.

**Say the word count where the words are.** It is in the writing surface's head
only. Reading has none, the object editor has none, a tile has none.

### From Notion

**A container that says what it makes.** Half built and worth finishing.
`genKind` already exists — it is "Typing in it makes" — but it only governs
typing. Holding a bare cell inside a Recipe still opens the full forty-type
picker, and dropping something in changes nothing. Make `genKind` the default
the picker opens on inside that container, and the thing a sketched box becomes
when you let go. Small, and it removes the type-picking step from most of the
making.

**Rollups on every face** — 3g.

**Two clauses** — 3c. This is Notion's filter row, cut down to what a desk needs.

**Templates.** ROADMAP item 3 has "template-spawn — deep-copy a template object
with its children" and it is still unstarted. The machinery is there: `seed:` on
a kind already makes children when a container is created, one level deep. A
weekly review, a packing list, a shoot day are all the same shape. This is the
Notion feature that fits Bureau best and the one nobody has built.

**Still not taking:** blocks, formulas, a backend, latency.

## 5. What the platform is blocking, not the design

Worth stating plainly so it stops looking like a gap in the app.

- **Reminders.** A to-do app on a phone with no notification. An installed iOS
  PWA can only be notified by *push*, which means a server, which is decision 6.
  There is no local-notification API. This is the strongest argument in
  NATIVE-PORT.md after widgets, and it is not fixable here.
- **Sync.** Still blocked on a decision, not effort — DATA-MODEL option 3 is
  right and needs a transport. The measurement above adds one fact to that
  decision: the whole desk is 300 KB at a thousand objects, so a naive
  whole-snapshot sync over anything at all would work for years.

## 6. What I would do, in order

Three passes. The first is all visible, all cheap, and needs no migration.

**Pass 13 — the words on the board**

1. `plain()` — tiles print words, not source (3a).
2. The writing surface behaves: list continuation, wrap-selection, ⌘B, `#`.
3. Copy one object out as markdown.
4. The picker leads with what this desk uses.
5. The palette takes arrow keys and searches tags (3f).

**Pass 14 — the drawer knows what it holds**

6. Two-clause rules, with the migration (3c). Do this before anything else
   touches rules.
7. `genKind` reaches the picker and the sketched box.
8. Rollups on every face.
9. Split the object editor and settings into panels that ask one question.

**Pass 15 — repair and keys**

10. Undo covers edits, moves and reparents; add redo.
11. A dirty flag, so `render()` stops saving what has not changed.
12. Arrow keys on the board, space to open, ⌘⌫ to delete.
13. Wire audio and video, or take them out of the picker.

**Then a decision, not a pass:** sync, and whether the native shell is worth it
for reminders and widgets. Both are choices Timothy makes; neither is work
anyone should start speculatively.

Deliberately not proposed: a framework, a build step, a block editor, a plugin
API, formulas, or anything that needs a backend. Nothing above wants one.
