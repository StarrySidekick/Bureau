# What to build next

Rewritten 2026-08-11 after the full review (bugs fixed, Styles shipped in v29).
Sequenced by dependency, not appetite: item 1 makes everything after it safer.

---

## 0p. Queued 2026-09-05 (fifteenth pass) — urgency, and plans — DONE (v1.42)

Three things Timothy asked for after a read of where the project stood.
Decisions 120 and 121.

- **Urgency is a deadline and an estimate put together**, and stored nowhere.
  Three hours due tomorrow and three weeks due tomorrow are not the same
  situation, and sorting by date cannot tell them apart. A deadline is **hard**
  (consequences) or **soft** (a day you gave yourself) and a thing may carry
  both; a duration in minutes says how much work it is; `workday` — three hours
  by default — turns one into the other. Slack is the days you have less the
  days the work needs, and the ladder is Room · Ahead · Soon · Tight · Behind.
  A soft deadline reads one rung lower and can never reach Behind. A magic
  drawer collects on it, a board sorts by it, and the deadline chip carries it
  as the line thickening under the date
- **A plan is a board you can put down again.** Arrange a drawer, save it, lay
  it out anywhere — with fresh ids, everything but the doing, and the whole
  arrangement shifted by one offset so its shape survives. A type may **open
  fitted to** one, which is what `seed:` was reaching for. Three lead in the
  picker, all of them live in a settings door. This is the roadmap's
  template-spawn, in Timothy's own shape
- **The scale probe counts as well as times**, because its milliseconds move
  30–50% between runs on code that did not change. `layouts` and `styles` per
  render are 1 at every size on both devices, which is the invariant
  `sizeGrid()` was written to hold and had never been measured

**And a second follow-up: When, rebuilt to what Timothy actually wanted.** The
month stays open and the panel became a **page** to make room for it; two quick
answers instead of four (this weekend and next week were ranges said as a
single day); four marks on the month — on, aim for, due by, and the work as a
grey rule along the run it takes; **difficulty**, a new 1–5 attribute in
teardrops; ranks drawn as their own mark filled to the rank; duration in five
presses; the repeat rule moved to where the dates it counts from are; tags in
the same page; tapping a task opens it; two entries off the long press.
Decision 123. And **books lie down** when they are wider than they are tall —
one class over the same markup, decision 124.

**Follow-up the same day: it was implemented and not reachable.** Priority was
five steps behind two doors of the object editor, and the other three sat under
the fold of a bubble that leads with a month grid. All four are one panel now,
off a long press — *Dates and priority…* — with the traits an object hasn't got
offered as one row of chips and the month behind a disclosure. Decision 122.
The lesson worth keeping: every assertion in the suite could say the markup was
right and none could say it was on the screen, so `reachable` now checks that
the panel does not scroll and its bottom edge is visible.

*Deliberately not done:* sync, which Timothy is holding until Bureau is a
TestFlight app, since the transport will be a different question by then. The
Depth and light door stays as it is; the defaults get locked in later.

*Merged with:* the filing-lands animation (§0b-next item 1), built overnight on
its own branch. The two touched no code in common — only `APP_VERSION`, `CACHE`,
`CLAUDE.md`, this file and `smoke.mjs`, and only the first two conflicted. The
fall was re-checked on the merged tree by driving a real drop, since the block
that guarded it was taken back out: the object is filed, an `.fxfile` picture
flies with a real translation and a scale under 1, and `#fx` is empty
afterwards.

---

## 0o. Queued 2026-08-30 — everything joins the aesthetic system — DONE (v1.07)

From the coverage audit in `docs/STYLES.md`. Five stages, sequenced by
dependency: **A is the foundation and everything else is cheaper after it.**
All five shipped; decisions 98, 99 and 100 are the write-up.

**A — a slot knows which aesthetic dresses it.** A stored value may be pinned
(`golf97/fielded`) and the per-aesthetic tile rules are keyed on a `<fam>sty-`
class the renderer writes, rather than on `html[data-style]`. The chrome stays
where it was. Five families read through one table; the picker shows your
aesthetic's answers with everyone else's behind a disclosure. `slotScoping`
guards it, because a selector that did not get converted fails silently.

**B — objects join.** `.otile` had one per-aesthetic rule in the whole
stylesheet. It wears an edge, a grain and a **stock** now, the last of which is
never written and falls back to the aesthetic's own paper. Two layers had to
become real elements (`.dpanel`, `.dgrain`) because an object's pseudo-elements
are spent on what it *is*.

**C — grains became slots.** Eleven global picture names into six positions,
named and drawn by each aesthetic. Migration 24.

**D — knobs finished, bindings slotted.** All seven aesthetics dress all five
knobs; all seven name their five bindings and the three that are not
nineteenth-century books dress them.

**E — what cannot be a slot is tagged.** Decorations carry the aesthetics they
belong on and the picker leads with those; the tick box takes the aesthetic's
default until you pick one.

**Left deliberately undone: marks as a slot.** Thirty icons times seven
aesthetics is two hundred drawings, and a mark is a *semantic* vocabulary — a
clock means a time — rather than a material one. If it is ever wanted, the
honest smaller version is a per-aesthetic stroke weight and cap.

---

## 0n. Queued 2026-08-20 (fourteenth pass) — DONE (v0.63)

Eight changes Timothy asked for. Decisions 72–78, migration 22.

- **priority is a rank, 0 to 5**, and it is *importance*, not urgency — urgency
  is a deadline coming up, which is what `deadline` is for. 0 is "a dream,
  nothing to act on", which is the answer every other list app makes you delete.
  Six buttons rather than a select, because the point is that you can see the
  scale. It sorts and a magic drawer collects on it. **0 is a real answer**, so
  `prioOf(o)` returns null or a number and `o.prio || …` is the bug this invites
- **repeating is a rule**, not one of four words: how often, on which weekdays,
  until when, paused or not — and **counted from the day it is due or the day
  you finish it**, which is the change Things 3.23 shipped the same day and the
  half that matters. Finishing early needed no special case: completing already
  spawns a fresh object, so the tick is just the tick. Plus a head start ("make
  the next one now") and a glyph on copies a rule made
- **one lock, not one per board.** A lock is which mode you are in, not a fact
  about a drawer, and unlocking each drawer as you walked into it was
  arrange-mode by another name. The row is out of the object editor
- **a colour of your own**: a picker under the eleven slots, writing a literal
  hex that ignores the style and stays put when it changes. Its own labelled row
  rather than a twelfth swatch, because it does something different
- **the add box is a choice** — turn it off for one more line of what a
  checklist holds — and it goes by itself at two cells tall, where the line is
  worth more as an item
- **swiping right opens the little calendar**: today, tomorrow, this weekend,
  next week, no date, a month you can press a day on, and the deadline beside
  the date rather than three sections down another panel. Also on the context
  menu, since a Mac has no row swipe
- **pinned or laid flat**, a setting: a little air around each tile and one to
  three degrees of tilt, off a hash of the object's own id so the angle never
  changes between renders. A margin on the tile, never a gap on the grid — the
  grid is a coordinate space

Two bugs fell out: `clamp` was never imported into `model.js`, so any priority
rule threw; and the priority class used `o.prio ? …`, which drew nothing for a
rank of 0.

*Still open — and it needs a decision rather than work.* Timothy raised a third
axis: a mark for something that causes **real problems if it is not done at a
specific time**, which is neither importance (priority) nor simply having a
deadline. Two ways to go, and I would take the first:

1. **A trait on the deadline**, `hard:true` — "missing this costs something".
   Cheap, sits exactly where the fact belongs, and reads as *this deadline is
   real* rather than as a fourth field to keep up to date. A name: **binding**.
   "A binding deadline" says it without inventing a word.
2. **A `stakes` field**, 0–2, independent of both. More expressive, another
   thing to maintain, and it starts to look like a spreadsheet.

Not built either way, because naming it *is* the decision.

Also still open from the thirteenth pass: nested tags, template-spawn, and the
animation list in §0b-next.

---

## 0m. Queued 2026-08-19 (thirteenth pass) — DONE (v0.62)

The whole of `docs/DIAGNOSTIC.md`, built in one pass. Decisions 62–71.

**13 — the words on the board.**

- **a tile prints words, not source.** `plain()` in `util.js` takes the marks
  off and keeps the writing, and `.tiletext` is `pre-line`, so a note printed on
  a tile has the paragraphs it was written with. Every type shipping a body
  template was putting `**` and `##` on the desk. `strip()` is gone with it — it
  replaced every hyphen with a space, so "twenty-one" printed as two words
- **the writing surface behaves like an editor**: Return continues the list you
  are in, Return on an empty item ends it, ⌘B and ⌘I wrap what is selected. All
  of it through `insertText`, so the textarea's own undo still works. *Not* the
  markdown overlay INFLUENCES recommended — see decision 68 for why it cannot
  work at all
- **one object comes out as markdown**, from the writing surface, the reading
  surface and the editor's foot
- **the picker leads with a handful** — five, counted off the desk — and a
  container that says what it makes goes first, whatever the tally says
- **⌘K takes arrow keys and searches tags**, and a tag match opens the drawer
  that collects it

**14 — the drawer knows what it holds.**

- **up to three clauses, ANDed**, with migration 21. And two repairs that had
  made every date rule useless: a date compares as a date rather than as the
  year, and five words — `today`, `tomorrow`, `week`, `month`, `year` — resolve
  when the rule runs rather than when it was written
- **rollups on every face**, not the two that had them
- **panels that ask one question.** The object editor is a stage, a name, a type,
  where it lives, and six doors; settings is five. `spec.back` is the way out,
  which is the thing a replaced panel never had

**15 — repair and keys.**

- **undo covers everything and there is a redo.** Every editor row, every drag,
  every drop, every reparent. Typing coalesces, so a rename is one move
- **a render is not a change.** `render()` was serialising the whole desk after
  every rebuild — 35ms at three thousand objects, on a 250ms timer, while you
  drag. It saves what changed now, and the debounce is a ceiling rather than a
  quiet-period
- **the board has a keyboard**: the arrows move the selection, space opens, ⌘⌫
  deletes, Escape puts it down
- **audio and video work.** The picker is told what to show, the file is stored
  as a blob rather than base64, and the surface plays it. Two bugs fell out on
  the way: `create()` stamped `type:'image'` on every media object at birth, so
  an Audio declared itself a photograph, and the tile branch tested "carries
  media" rather than "is a picture", so a sound with a file in it was drawn as
  a photograph of nothing

**And Things 3's central idea, which was the ask:** `deadline` is an attribute
of its own. `date`/`due` is the day a thing **sits** on; `deadline`/`dead` is the
day it is **late**. Opt-in, so nothing already on a desk changes. `lateOn(o)`
says which decides and `isLate(o)` is the answer — never `D.overdue(o.due)`.

*Still open from this pass:* nested tags (`#film/shoots` making a drawer inside
the one for `#film`), template-spawn, and the animation list in §0b-next, none
of which were started. The desk's own settings are still outside undo, because
`S.deskCfg` has no id for a step to point at.

---

## 0l. Queued 2026-08-17 (twelfth pass) — a list is a board — DONE (v0.61)

See decisions 60 and 61.

- **a name is a thing you can tap**, on an unlocked board — a tile's, a list
  band's, a line on a checklist front. The double tap still works
- **a list has the controls a grid has**: swipe left to delete, swipe right to
  put it on today, hold to reorder, hold longer for the menu, and a tap obeys
  the object's own click behaviour rather than always opening the editor
- **on a checklist front the box ticks and the words change**
- **how fine a board's grid is belongs to the board.** Every container's editor
  has the row; `S.look.grid` is the app's default and a board follows the desk
  it is on until it is asked directly
- **nothing new arrives bigger than three cells** either way on a phone

*Still open:* whether the three-cell cap wants to apply to the desk's 24 columns
too — `PHONE_MAX_NEW` is one constant.

---

## 0k. Queued 2026-08-17 (eleventh pass) — tightening the swipe — DONE (v0.60)

See decision 59. Walking sideways between desks was laggy in three places, none
of which was the animation.

- **a pass may remember.** `childrenOf()` is memoised for the length of one
  string build, so drawing a board asks "what is in this?" once per container
  instead of once per caller. First visit to a desk: 74ms → 13ms
- **rendering laid the board out twice** — once to measure, once for the writes
  that followed. `sizeGrid()` writes only what changed, two of the properties it
  was writing were read by nobody, and `scrollTop` is only restored when there
  is something to restore
- **the rebuild moved off the settle frame.** `renderSoon()` — the state still
  changes immediately, only the DOM waits a frame, under the strip
- **the pager spreads its work.** The gesture frame builds one neighbour and
  carries the real board; the next frame builds the far one and the picture

Release cost went from ~22ms to under 1ms, and the gesture frame from three
boards of layout to one.

---

## 0j. Queued 2026-08-17 (tenth pass) — one piece of furniture — DONE (v0.59)

See decisions 57 and 58.

- **the bar is part of the carcass.** Everything above the board is one piece of
  wood now — the notch strip, the bar and the reveal under it — rather than wood
  with a paper bar sitting on it. The bar inverts its own ink tokens and takes
  the style's Glow as its accent
- **and it is a fifth taller**, which the row the shelf gave back pays for
- **the desk's drawer is furniture you can change**: knob shape, size and
  colour, texture, and the wood itself, per desk, from the desk's own editor.
  The rail knob carries `.pull`, so it gets every shape a drawer front has
- **the knob is bigger and sits lower** — only half the home-indicator inset is
  reserved, so it reads as centred in the wood rather than high in it
- **a board slid in beside you arrives in position.** The reveal and the drawer
  depth are written into the markup as it is built, so a previewed neighbour is
  drawn at the size it will be instead of clicking down on commit

---

## 0i. Queued 2026-08-17 (ninth pass) — the carcass — DONE (v0.58)

See decisions 55 and 56.

- **the app is a piece of furniture.** The notch strip above the bar and the
  curve below the last row are the desk itself now: `--wood` above, and along
  the bottom a drawer front with a round knob. Deep walnut in light and dark
  alike, and not derived from the style's five
- **the knob takes you out** one level, and **pulling the rail opens the type
  picker** — decision 43's gesture given back the thing it comes out of
- **the leftover is split** between the reveal above the board and the depth of
  the drawer below, so the bar has room to breathe and neither end gets a whole
  spare cell
- **the dots by the title are the desks**, not the pages, with the one you are
  standing on lit and pressing one going there. The page is a number now
- **shadows are a switch** in the app's settings — a zero shadow rather than
  `none`, so the border slots' inset rings survive it
- **the knob's highlight is a highlight**, not a coat of paint: the body of it
  is the front's own colour
- **textures render under the knobs**, not over them

---

## 0h. Queued 2026-08-17 (eighth pass) — the shelf comes out — DONE (v0.57)

See decisions 53 and 54.

- **the shelf is gone**, and the row it was taking went back to the grid: 8×13,
  9×14, 10×15. Pinning, the pull that opened the type picker, and the pin-as-a-
  toggle went with it. `S.pins` is still stored, so putting it back is putting
  back two render functions and two drop branches
- **the whole app rides up off the bottom edge** by the safe-area inset plus a
  little, so the last row is clear of the screen's rounded corners. `sizeGrid()`
  counts rows inside that padding
- **the desk has an editor.** The brush in the bar opens `objectPanel(ROOT)` —
  the same panel a drawer gets — so one desk's board, layout, sort and lock are
  that desk's rather than the app's. The sort came off the bar to live in it
- **a cabinet is which way round it is, not how big.** The area threshold gave
  doors to a 4×3; it is gone, and `standing()` is the whole test. The two knobs
  moved in towards the seam, and the seam runs the full height of the front and
  through the border at both ends
- **a container one cell wide is a spine**, with the title running up it, rather
  than a nameless front wearing its mark
- **a knob is the front's own colour, shaded** — lit from the upper left with a
  shaded underside, so it reads as turned rather than painted on
- **a body fills the face it is printed on.** The four-line clamp is gone
- **an object's words follow the style's typeface**, the same as a drawer's do.
  They were pinned to the system sans
- **a board that isn't a grid can be swiped off** to the next desk — a List desk
  had no bare cells for the gesture to start from

---

## 0g. Queued 2026-08-16 (seventh pass) — sizes to try on — DONE (v0.55)

See decision 48.

- **three grid sizes**: Small (8 across), Extra (9), Large (10), default Small.
  The column count is the only number any of them changes, and switching
  rescales every stored phone box the way a migration does — rounding half down
  and scaling the left edge, so eight to ten and back is where you started
- **a pinned thing is a 1×1 tile**, drawn by the same `gridTile()` the board
  uses. The bespoke pin shape is gone
- **the board is exactly as tall as its rows**, so the spare pixels fall below
  the shelf instead of above the board — no more dead strip under the title, and
  the shelf's end slots are clear of the screen's rounded corners

*Superseded by 0h:* the shelf itself came out, and the space below it is now
the inset that keeps the board clear of the screen's rounded corners.

---

## 0f. Queued 2026-08-16 (sixth pass) — the shelf becomes a row — DONE (v0.54)

Three corrections to the fifth pass. See decisions 45–47.

- **an inbox collects; it does not hold.** `create()` briefly routed anything
  made without a stated place *into* the inbox, so a thing you made on the desk
  vanished off it. The inbox is a magic drawer now, carrying the one rule an
  inbox has — `loose`, meaning on a desk rather than filed in anything — and
  nothing is moved into it ever again. `S.inbox` is gone
- **nine columns, and the shelf is the last row of the grid.** Same cell, same
  texture, one hairline between: "9 × 13 +1". It does not turn with the pages
  and does not change with the desk
- **pinning is a drag.** Carry a tile onto the shelf and let go; the object does
  not move, because pinning is about reach. The long press on a pin takes it
  back off
- **two long presses on a locked board.** Holding a bare cell lights it and
  opens the picker there; holding a tile opens the menu, and moving from there
  takes the tile and unlocks the board, the way the iPhone home screen does
- **a pin is a toggle** — press the one you are in and you go back where it
  interrupted — and the lit ring is round the slot rather than round the mark

*Still open:* nine slots is the whole shelf and the tenth pin is refused rather
than scrolling. And on a desk where most things are loose — the sample desk,
where the whole type museum sits on the board — the Inbox collects nearly all of
it, which is true but noisy.

---

## 0e. Queued 2026-08-16 (fifth pass) — a bugfix and tweak pass — DONE (v0.52)

Nineteen small things, most of them corrections to the fourth pass. See
decisions 40–44, and `APP_VERSION`, which is the commit count from here on.

- **a desk stops being where it was.** Promoting is a move, not a label: the
  drawer leaves the board it stood on, and demoting is the return trip
- **one shelf.** The top strip went; `S.pins` is a single global list of
  anything at all, drawn as a shelf with a slot per thing, with more padding at
  the ends than a curved screen was giving the leftmost one
- **the name at the top left opens every desk at once**, drawn small — which is
  the "no way to see all the desks" note left open by the fourth pass
- **the phone grid is ten columns**, up from eight, and the cell stays square —
  ten by a stated fourteen rows was tried and reverted, because a cell a third
  taller than it is wide rescales every size in `KINDS`. Both bars were slimmed
  to buy the rows back instead
- **the new-object menu is pulled, not flicked** — a front follows your finger
  and only opens if you carry it a quarter of the screen, and the strip iOS
  uses for its own home swipe is left alone
- **the foil is gone.** A magic drawer is gilt, and the gilt does not move
- **a walnut Victorian**, following the phone's own light-or-dark by default
- **every default desk and drawer starts locked**; one you make starts open
- **the lock is the leftmost tool**, the view cycler moved into the board's own
  settings, and the random button came off the bar
- **four container types**: film, novel, short story, album
- **a torn note has a border again**, and it follows the tear
- **a list under Manual can be dragged into order**
- **Today, Inbox and Everything ship pinned**, and the inbox is where a new
  object goes when nothing else says where
- **the board no longer flashes a bigger checkerboard** on the first frame of
  every new grid

*Still open:* a desk cannot be pinned to the shelf, only walked to — right for
now, wrong if you spend all day moving between them. And `--holox`/`--holoy`
are gone with nothing replacing them, so nothing on the desk reacts to how the
phone is held.

---

## 0d. Queued 2026-08-16 (fourth pass) — desks, scope, spans — DONE (v58)

See decision 39, `S.desks` in `model.js`, migration 15.

The question was how to keep Bureau usable across many unrelated jobs — a
to-do list, a screenplay, a travel plan, finances, exercise — without one board
turning into a wall. The answer was not more features: nearly all of it was
already expressible. It was that everything lived in one coordinate space with
no notion of context.

- **more than one desk.** A drawer given a place in the master space is
  somewhere you can *be*: the breadcrumb roots there, the top shelf belongs to
  it, and a sideways swipe walks the row without wrapping
- **the bottom shelf is the master space**; the top one is per desk
- **scope on magic drawers** — this desk (default), every desk, or a chosen few
- **spans**: `till` alongside `due`, so a trip occupies days rather than
  falling on one. Calendars mark every day, timelines draw a bar, and dragging
  one carries its length
- **a time layout collects containers**, so a calendar can show a trip — which
  it could not before, because a trip is a container

*Held off:* "save this drawer as a template" — Timothy has another idea for it.

*Still open:* `deskOf()` walks the parent chain inside `inContainer()`, so it
runs per object per container per render; fine at this size, unmeasured at a
big one. There is no way to see all the desks at once — the row is the only
view of the master space, which will stop working somewhere north of six.
*(Both of the shelf notes above were overturned by the fifth pass, and the
"all the desks at once" gap was closed by it.)*

---

## 0c. Queued 2026-08-15 (third pass) — animations — DONE (v57)

See decision 38, `web/js/motion.js` and `web/css/motion.css`.

- **a drawer pulls out of the shelf** when tapped, and a container bigger than
  four cells square **swings open like a cabinet** instead
- **a note curls up from the bottom**, the way a sheet pinned to a board does,
  and the page it opens onto fades up over it rather than slamming shut on it
- **a task pops** when it is ticked — and a ring goes out from where it stood,
  which is the half that survives it leaving the drawer
- **magic drawers are holographic foil** instead of a sweep, lit by how the
  phone is tilted (or where the pointer is on a Mac)
- **swiping between pinned drawers and pages is a pager**: the neighbouring
  board is drawn beside this one and the strip follows your finger, iOS
  home-screen fashion, so a swipe can be done slowly and pulled back from
- **on a locked board one finger navigates**; two fingers still do everywhere
- **how a thing opens is a property** (`opening`, per object then per type),
  because the size rule is a guess and guesses need an override

*Still open:* the pager builds both neighbouring boards at the start of a
gesture rather than only the one you are heading for. Going *back* out of a
drawer is a fade rather than the opening run backwards. And nothing yet moves
when a tile is filed into a drawer by drag — the swallow is still the old
scale bump.

---

## 0b-next. Queued animations — not started

Suggested 2026-08-15, in rough order of how much they'd be felt. Nothing here
is started; pick from it.

**Things that would be felt every day**

1. ~~**Filing lands.**~~ **Done (v1.41.)** The tile falls in: a picture of what
   you were holding, from exactly where you let go, shrinking into the front it
   went into. `fileTo()` in motion.js — toss's mechanism aimed inward rather
   than away, and it carries the tile's own markup rather than a stand-in.

   Three things fell out of building it. Both halves of the geometry have to be
   read *before* the state change, because `render()` replaces `#app` and a
   moment later the element in your hand is detached and its rect is nothing.
   The drawer's own bump now lands when the tile does rather than when the
   finger lifts — a delay on an animation, which is allowed, where a delay on
   the state change would not be. And **gathering deliberately does not get
   it**: nothing went into anything there, a third thing was made, so it keeps
   the bump alone.

   It also applies to the two drops that file without looking like filing — a
   tile dropped on a calendar day, and one dropped along a timeline. Both move
   the object into the container, and neither said so before; the day drop had
   no feedback at all.

   **It is verified but not yet guarded, and that is worth finishing.** The
   behaviour was checked by driving a real drag: the object is filed by the
   time the drop returns, a picture of the tile flies in `#fx` carrying a real
   translation and a scale under 1, it answers to no id, and it cleans itself
   up — plus three frames of the fall, captured by freezing the animation with
   a negative delay and hiding `#app`, which show the tile's own paper and tick
   box travelling and shrinking.

   A `filingLands` block asserting all of that was written and then **taken
   back out**, because it destabilised `smoke.mjs` and a suite you cannot trust
   is worse than a missing assertion. Two things it got wrong, both recorded so
   the next attempt starts ahead of them: a test ending on a real drag leaves
   `gestureFlags.suppressClick` set, which swallows the *next* test's press
   (`longPress.armed` and `groupMove` both failed); and forcing
   `S.look.locked = true` afterwards is not the fix — restoring the previous
   value instead made the suite hang outright, somewhere after
   `18-task-shapes`. Whatever the right cleanup is, it is not either of those,
   and it wants a machine where the suite runs in minutes rather than the
   forty this one took.
2. **A new object arrives from where it was made.** `reveal()` flashes
   `justmade`; it could instead grow out of the shelf, the picker tile, or the
   cell you sketched — so "where did that go" is answered by watching.
3. **Undo runs the delete backwards.** Deleting fades a tile out; the toast's
   Undo pops it straight back. It should fall back onto the board from the
   direction it left.
4. **The board turns pages with weight.** Now that boards slide, the *tiles*
   could lag very slightly behind the strip and settle — the difference between
   a screenshot moving and a tray of objects moving.
5. **A drawer knob presses.** A tile you are holding a finger on already
   lifts; the knob itself could depress a pixel first, so a press is a press
   before it is a drag.

**Things that would be felt at the edges**

6. **A checklist line ticks with a stroke**, the box drawing rather than
   appearing, and the line drawn through the words left to right.
7. **A count spins to its new number.** The counter wheels already do this;
   rollups, streaks and the project bar all snap.
8. **The project bar fills rather than jumps** when something under it is
   ticked — it already has a width transition, but the number above it snaps.
9. **A magic drawer catches something.** When its rule picks up a new object,
   the foil could flare once from the corner the object came from.
10. **The lasso closes.** The selection band vanishes at the end of the drag;
    the tiles it caught could pull together a pixel or two, so a selection is
    a thing that happened rather than a set of outlines.
11. **A page turn on the reading surface for a single page.** The leaf turns
    for a spread; `page` mode just swaps.
12. **The panel tail draws.** A bubble panel scales up whole; the tail could
    shoot out of the tile first, so the panel is visibly *from* that thing.

**Things that are mostly showing off**

13. **A drawer you cannot open shakes its head** — a locked board's refusal, a
    drop that has no room.
14. **The desk settles on load**: tiles falling into place from the top-left,
    once, on a cold start only.
15. **Paper on paper.** A note dropped onto another note could push it aside
    with a shove rather than refusing the box outright.
16. **Style changes cross-fade** rather than repainting — sixteen slots moving
    at once is the one place a transition is genuinely descriptive.

---

## 0b. Queued 2026-08-15 (second pass) — DONE (v56)

See decision 37.

- **two shelves** — tools on the top, drawers pinned to the bottom, both along
  the top on a Mac; a pin is a square in the drawer's colour
- **toggles, not menus** — the sort cycles seven states and wears the one it is
  on; a lock button that refuses moves but never the long press
- **pages, not scrolling** — a phone board is exactly the room between the two
  shelves and turns with two fingers; two fingers sideways walks the pins
- **a swipe up off the bottom shelf** opens the new-object menu, and menus on a
  phone come up from the bottom
- **the version is in Settings**, medium knobs, thumb-sized resize grips, and
  one of every type on the sample desk
- **the long press stops selecting text** — `selectstart` is refused outright

*Still open:* the page height is measured per device, so a board arranged on
one phone is re-packed on a different-sized one. And the leftover under the
last row (never more than one cell) sits at the bottom rather than being shared
out — squares or flush, pick one.

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
- ~~**template-spawn**~~ — done (2026-09-05) as **plans**, decision 121: a saved
  board, laid out again with fresh ids, and a type that opens fitted to one
- ~~**undo log**~~ — done (2026-08-12). `S.undo` is a stack of up to 20 moves,
  each a list of steps replayed backwards (`{del}`, `{add}`, `{set}`), covering
  single delete, group delete, drawer delete and paste import, on the Undo in
  the toast or ⌘Z. *Still open:* panel changes aren't recorded, and there is no
  redo

## 4. Known small gaps (fold into any session)

- ~~rollups only render on drawer-front and checklist faces~~ — done in the
  thirteenth pass; every face shows what a container totals
- accessibility: tiles are nested-interactive `<button>`s and there is no ARIA.
  Keyboard navigation landed in the thirteenth pass (the arrows move the
  selection, space opens, ⌘⌫ deletes) — the labelling half is still open
- corner-grip resize is hover-only — invisible on touch; mobile drag vs scroll
  needs device testing
- ~~SPEC.md is three redesigns stale~~ — done (2026-08-12). SPEC.md and
  OBJECT-MODEL.md are folded into `docs/SYSTEM.md`, one reference for what the
  system is made of, written against the code rather than against the last
  redesign

## 4b. Borrowing from the four comparables

`docs/INFLUENCES.md` (2026-08-13) appraises Things 3, Bear, Notion and Obsidian
and proposes six changes in order. Five of the six landed in the thirteenth pass
— panels that ask one question, rollups on every face, a container that says what
it makes, a keyboard layer, and the writing item in a different form.

**Item 3 is withdrawn rather than done.** The markdown overlay cannot work: it
must share the textarea's metrics exactly, and a textarea has one font at one
size, so an overlay can colour and can never resize. See decision 68 and
DIAGNOSTIC §4 for the replacement, which is to make the typing good and let the
reading surface be the paper.

**Item 1, a shared transition vocabulary, is the one still open**, along with the
whole animation list in §0b-next.

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
