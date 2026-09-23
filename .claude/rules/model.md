---
paths:
  - "web/js/model.js"
  - "web/js/mutations.js"
  - "web/js/plans.js"
  - "web/js/stockplans.js"
---
# The model

Objects, attributes and kinds; containers, sorting drawers and rules; dates, deadlines, ranks and repeats; plans; the controls table.

These paragraphs were the *How to work in this codebase* section of `CLAUDE.md`,
moved here whole and unreworded so they load when a file they are about is
opened rather than in every session (decision 175). A rule for this area goes
here; a rule for every area goes in `CLAUDE.md`.

**The shape list is silhouettes, and one of them is nothing.** `SHAPES` is what
a picker offers; it lost eleven — filing tab, torn chit, book spine, ruled line,
bar, progress bar, streak, ticket, pill, switch and the sliver — because a third
of the list was a rectangle with one detail on it and several said the same
small thing twice. It gained **`none`**: no ground, no edge, no shadow, no
stock, the board straight through. Two of the eleven are still *drawn* and no
longer offered — `SHAPES_KEPT` — because a Task **is** a sliver and a Progress
bar **is** a row of blocks; ask `shapeChoices(cur)` for a particular object's
ring, which puts the kept one at the head when that is what it is wearing, and
`shapeName(k)` when you only need the word. Migration 33 folds the rest in: a
removed shape needs one for the same reason a removed kind does. See decision
163.

**Three types were a property wearing a name, and are gone.** A **habit** is a
task with a repeat rule on it; a **dream** is a goal with no day owed, which
`goalStanding()` has said since decision 146; an **ingredient** is a line of a
recipe, and a recipe is a card you write on now. Migration 32 turns each into
the type it always was. **A removed kind needs a migration even though `K()`
falls back** — the fallback keeps the object working while it stores a name that
resolves to a note, so it turns into one at the first thing that reads its kind.
See decision 160.

**A magic drawer asks up to five questions, ANDed, and they are not only about
fields.** `filter.rules` is an array; ask `rulesOf(f)`, never `filter.rule`,
which is the old single-clause shape still read for a pre-migration-21 backup.
Half the useful clauses are **meta fields** — `@kind`, `@in`, `@under`, `@tag`,
`@trait`, `@title`, `@body`, `@done`, `@made`, `@holds`, `@colour` — marked
`meta` in `FIELDS`, read off every object rather than gated on a trait, and
named with an `@` so they cannot collide with an attribute. `@under` is a chain
of parents (`ancestorIds()`), which is what makes "a task, anywhere inside the
film" sayable; it walks `parent` by hand because `childrenOf()` runs magic rules
and a rule that ran rules would call itself. A field carrying `pick` tells the
builder to offer a list — containers, types, tags, traits — rather than a box to
type an id into. There is no OR and there is not going to be one — an OR needs groups, groups need a builder, and a builder is a
query UI, which is the thing tags-become-drawers exists to avoid. A date clause
compares as a *date* (`numOf` read "2026-08-19" as 2026) and its value may be
one of five words — `today`, `tomorrow`, `week`, `month`, `year` — resolved when
the rule runs, so "before next week" keeps meaning it. See decision 63.

**An achievement is picked, not written.** `finishedThings()` is the list —
ticked objects, and goals and projects whose work is all done. `st.length>0` is
the load-bearing clause: every tickable thing under an empty container is done
vacuously, so without it an unstarted project is offered as an achievement.
`pastTense()` in util.js puts the first word in the past and **only** off a
list of verbs it knows: "Bike shed" and "Bill's birthday" look exactly like
verbs, so a title it cannot vouch for comes back exactly as written.

**A spawner's line makes what the spawner is set to make.** It created a `task`
outright for a long time, so one set to Note pressed out notes with the spiral
and typed out tasks with the line. `genKindOf()`, or `someKind()` when it is set
to anything — resolved once, like `dispense()` does it — and `fits()` asked
first, like everything else that makes something.

**Three kinds of drawer, and `magic` is called a *sorting drawer*.** The stored
kind key is unchanged — `magic` in the code, "sorting drawer" in the interface,
exactly as `container` is "drawer" — so nothing needed migrating and every
`has(o,'magic')` still reads. What changed is `asksTag` on the kind: placing one
opens `tagFirstPanel()` first, which offers every tag the desk has (counted) and
a field for one it hasn't, and `makeSorting()` in wire.js is the **one** place
both answers land, so the naming, the placing and the reveal cannot drift.
*No rule yet* still makes the drawer and opens the rule builder — the question
is a shortcut past the common case, never a gate in front of the uncommon one.
A **life drawer** is the third: `face:'life'`, the project's own
`projectStat()` walk drawn with `.projtile .lifetile` and one CSS rule taking
the bar's row out. It has no percentage on purpose — an area of your life has
no end for one to be a fraction of, and a bar at 62% against Health is worse
than no bar. See decision 131.

**A control is a switch on the board, and the table is the feature.** `CONTROLS`
in mutations.js says, for each of the desk's own settings, how it is **read**
and how it is **flipped**; `ctlOf(o)` names which one this object is for.
Nothing outside that table knows which settings are switchable — a new one is a
row there and the tile, the press and the object editor all come along. A
**switch** is on or off and is drawn as a lever, never printed: the state has to
be readable across the desk. A **dial** walks a list and prints where it is.
Neither pushes an undo move, for decision 65's reason — `S.look` has no id for a
step to point at, and flipping it back is the same press. A control is
furniture, not chrome: it moves, resizes, takes a colour and wears an aesthetic.
See decision 132.

**Anything drawn as a bar asks `barPct()`, never `goalPct()`.** `goalPct` is an
object's own milestones; `barPct` is what a bar is actually drawn at, and a
Progress bar may name a `tracks` — a container reports how much of everything
under it is ticked, a streak reports its run against `target` days, and with
nothing tracked (or a tracked object since deleted) it falls back to its own
milestones. The fallback matters as much as the feature: what happened somewhere
else is not the bar's fault. `sh-bar` is its shape — on a goal the bar is one
detail of a card, here the bar *is* the tile. See decision 133.

**`random` is not a kind, and it must never reach `K()`.** A Spawner (was
Generator) may be set to make one of anything. `K('random')` answers `note`, so
a spawner set to anything would draw as a note factory and press out notes —
ask `makesAnything(o)` and `genSaid(o)`, and resolve it **once** in `dispense()`
with `someKind()`, which picks from the majors with containers, controls and
decorations taken out. Every "Add a …" placeholder in the app goes through
`genSaid()` for the same reason.

**A thing made "in" a sorting drawer is made where that drawer lives.** A
magic drawer *collects; it does not hold* — `inContainer()` ignores `parent` for
one — so an object whose parent is a sorting drawer is in no board at all: the
drawer will not list it unless the rule happens to match, and nothing else lists
it either. It was made, saved, and nowhere. `homeFor(id)` in model.js is the one
answer — the nearest ancestor that actually holds — and `create()`, `quickAdd()`,
`spawnInto()`, the picker and the sketch all go through it. That was the whole of
"some drawers don't propagate new objects".

**A tag is a magic drawer waiting to happen.** There is no filter mode and no
filter bar; clicking a tag anywhere calls `drawerForTag()`, which finds the
magic drawer collecting that tag or makes one. If you are tempted to add a
filter UI, add a drawer instead — that is the same instinct that deleted the
tabs (decision 22).

**Match a tag through `tagMatch()`, never `o.tags.includes()`.** A thing answers
to the tags written on it, to what it is and carries and is doing (`task`,
`note` for an idea, `checklist`, `due-week`, `late`…), and to the tags on every
drawer it is filed inside — `tagsOf(o)`, derived and never stored. A tag may be
an expression (`task & due-week`, `!done`). A Tag (`face:'tag'`) is a sorting
drawer that also collects drawers. See decision 202.

**A file is what its name says when its type says nothing.** `accept="audio/*"`
is a request the picker has to translate, and `audio/wave`, `audio/x-wav` and the
empty string are not what it translated it to — a `.wav` came back greyed out and
unpickable. `MEDIA_EXT` in model.js names the extensions outright and
`importMedia()` reads the extension when the MIME type says nothing. **A video
wears no button**: the tile is the control, and it asks for `#t=0.1` (plus a
`loadedmetadata` seek in wire.js, in the capture phase, because media events do
not bubble) so an unplayed one shows a frame rather than a black rectangle.

**Anything made of a file opens onto the media surface — sound and video
included.** `isMedia(o)` routes; `isPicture(o)` is still the image case and
`isPlayable(o)` the other two, and `acceptFor(o)` tells the one file input what
to offer. A picture is stored as a downscaled data URL, a sound or a video as
the **Blob itself** (base64 is a third bigger), with a 60MB ceiling;
`hydrateAssets()` makes an object URL for a blob. On the *board* a **sound is a record with a play
button in its label** and a **video is the video**, and pressing either starts
and stops it — decision 144, which walks part of 71 back. The expensive half of
71 still holds and is still enforced: a sound draws **no element at all** until
it is pressed, and the `Audio()` it makes lives in a module map outside the DOM,
so a board of a hundred costs a hundred discs and an unrelated render cannot
silence the one that is playing. A video has to show a frame, so it does carry
an element, at `preload="metadata"`, and a render does stop it. One at a time,
because a desk plays one thing at a time. `create()` deliberately stores **no**
`media.type`, so an object follows its kind's `mediaType` until told otherwise —
it used to stamp `type:'image'` at birth, which made every Audio a photograph.
See decision 71.

**Difficulty is the third axis, and nothing else stands in for it.** `diffOf(o)`
— 1 to 5, teardrops, `DIFFS` in model.js. Priority says how much a thing
matters and duration says how long it is; difficulty says what it will cost you
to *start*, which is what actually decides what gets put off. It feeds urgency
not at all — urgency is time against time — and it **starts at 1**: an unranked
thing has no difficulty, but there is no task that is zero hard.

**Priority is a rank of 0–5, and 0 is a real answer.** `prioOf(o)` returns null
or a number — never `o.prio || …`, which folds "a dream, nothing to act on" into
whatever the fallback is. It is *importance*, not urgency: urgency is a deadline
coming up, which is `deadline`'s job. The stripe's **weight** is the rank rather
than three named colours. See decision 72.

**A repeat is a rule, and `from` is the half that matters.** `repeatOf(o)`
normalises (it still reads the four old words), `repeatSaid(o)` says it in
English, `nextRepeat(o, doneOn)` gives the next day. `from:'date'` counts from
the day it was due — the bins go out on Tuesday either way; `from:'done'` counts
from the day you finished it — you water the plant a week after you last watered
it. Because completing spawns a fresh object (decision 5), finishing early needs
no special case. A generated copy carries `fromRepeat` and wears the glyph. See
decision 73.

**Locking is one switch, not one per board.** `boardLocked()`, backed by
`S.look.locked`. A lock is which mode you are in — reading or arranging — not a
fact about one drawer, and unlocking each drawer as you walked into it was
arrange-mode by another name. Nothing carries its own `locked` any more. See
decision 74.

**Urgency is a subtraction, and nothing stores it.** `urgencyOf(o)` in model.js
— the days you have to a deadline, less the days the work needs (`dur` minutes
divided by `workday()` hours) — because *three hours due tomorrow and three
weeks due tomorrow are not the same situation*, which is the thing sorting by
date can never say. Five rungs (`URGES`: Room · Ahead · Soon · Tight · Behind),
and the answer carries the arithmetic so the editor can say **why**. Three
rules, each of which is a bug if you forget it: a **soft** deadline reads one
rung lower than the identical hard one and so can never reach Behind; a thing
with **no** deadline has no urgency at all — null, not 0, exactly as an unranked
thing has no priority; and the day a thing merely *sits* on does not count, or
decision 62 is undone in one line. Duration is optional and its absence costs
nothing — with no estimate the slack is simply the days left. Ask `urgeRank(o)`,
never `o.urg`: there is no such field on any object. It is in `FIELDS` anyway,
marked `derived`, which is what lets a magic drawer collect on it (matchRule
skips the trait test and reads `get()`) while the rollup picker refuses it.
`SORTS.urgent` is the sort and has deliberately no reverse. Drawn on the
deadline chip as **the line thickening as the slack runs out** — never as a left
stripe, which is what priority means. See decision 120.

**A deadline is hard or soft, and a thing may carry both.** `deadline`/`dead` is
the **hard** one — missing it costs something; `softdeadline`/`soft` is a day
you set yourself, and nothing happens if it slips. The ordinary case is both at
once (aim for Friday, owed on Monday), which is why they are two fields and not
one field with a switch. `isLate()` still reads the hard one only. All three of
these traits — both deadlines and the duration — stay **opt-in**, and the way in
is the little calendar's three buttons (`data-want` names the attribute). Don't
put them on the `task` kind to save a tap: that deletes the affordance that
teaches they exist, and decision 62's separation with it.

**When a thing sits and when it is late are two facts.** `date`/`due` is the day
it is drawn on — what a calendar shows it on, what Today collects, what a drag
onto a day cell writes. `deadline`/`dead` is the day it is *late*, and it is an
opt-in trait, so nothing that hasn't asked for it changes. Ask `lateOn(o)` for
which one decides (the deadline where there is one, otherwise the day it sits
on) and `isLate(o)` for the answer; never `D.overdue(o.due)`, or a task put on
Monday with a deadline of Friday is overdue on Tuesday. A finished thing is
never late. See decision 62.

**A thing that lasts is not a thing with a date.** `date` is the day something
falls on; `span` adds `till`, the last day, inclusive. Ask `spanOf(o)` (null
unless it has both, in order) and `coversDay(o,iso)` — never `o.due===iso`, or
a trip disappears from every day but its first. A backwards span is ignored
rather than drawn wrong. Moving a spanning thing carries its length: go through
`reschedule()` in `gestures.js`.

**A layout that runs on time collects containers; a grid one doesn't.** A magic
drawer refuses containers — a rack of drawers inside another drawer is a desk
with two of everything on it — except when it is laid out along time, because
the thing happening that week is very often a container. `showsContainers(c)`,
by face or by layout.

**Calendar and timeline are layouts, not kinds.** `layout` is how a container
arranges its children when opened — `grid | list | scroll | book | calendar |
timeline` — and `face` is how it draws on its parent's board. Any container can
wear either; nothing branches on a kind called "calendar". A layout falls back
to the *kind's* if the object hasn't got one — ask `layoutOf(o)`, never
`o.layout`.

**A calendar collects; it does not hold.** The Calendar kind is a *magic*
drawer wearing a calendar layout, defaulting to the rule "anything with a date".
The day a thing sits on is the `due` field on the object, never a container —
which is what lets one task appear on two calendars while still living in the
one drawer it was filed in. Dropping on a day dates it and leaves it where it
lives (`canDate()` ignores the magic rule on purpose). Its three settings —
`calview` (`month|week|day`), `weekStart`, `weekends` — are per object then per
kind, and `calCols()`/`calSpan()` answer for the front and the opened view
together, so a calendar set to a week can't draw a month on the desk. See
decision 32 and migration 11.

**A container can take dictation, and that is an attribute.** `spawn` +
`spawnBy:'type'` puts a box at the top of a container — on its front and inside
it — and `genKindOf()` says what a typed line makes. A Checklist is just the
built-in that carries them; a type you invent that ticks the same trait gets the
same box. Ask `takesTyping(c)`, and go through `spawnInto()` rather than
`quickAdd()` directly: a magic container holds nothing, so what you type into
one has to be made where the container itself lives and collected back by its
rule. That is the only reason the quick-add on a calendar day works.

**A plan is a board you can put down again, and it is not an object.**
`web/js/plans.js` — `planFrom(cid)` captures what a container *holds*, all the
way down; `stampPlan(id, into, at)` lays it out again with fresh ids. The word
is **plan** because `layout` is taken (it is how a container arranges its
children when it opens) — an architect's plan of a room, which is what this is.
It lives in `S.plans`, beside `S.kinds`, because both are things the desk is
made **with** rather than things on it; a container with a null parent that is
not in `S.desks` is an orphan every walk of the object list would have had to
learn about. Four rules: it carries **everything but the doing** (ticks, counts,
dates, history and the repeat's tally are stripped at *capture*, so stamping is
a plain copy); **media is stripped outright**, because a plan is stored inside
the snapshot that exists to keep `media.src` out of localStorage; it is captured
**by parent, never `childrenOf()`**, or a magic drawer's plan would duplicate
half the desk; and where it lands is **one offset applied to the whole
arrangement**, because if the shape didn't survive the move there would be
nothing to save. A kind may carry `plan`, which supersedes `seed:` and is read
before it. Deleting a plan clears that pointer off any type holding it. See
decision 121.

**A drawer out of a plan rolls its own look.** `stampPlan()` was the one maker
that skipped `randomLook()`, which `create()` has run on every container since
decision 92 — invisible while every plan was *captured* (create() had already
written a look onto each of its drawers) and obvious the moment ten
hand-authored ones shipped stating none, as five identical cockbead fronts. It
fills in **only what nobody has said**, which is what makes it safe for an
arrangement you saved; the colour is left alone in both directions. See
decision 173.

**A plan is arranged in a shelf, which is eight columns — not the desk's
twenty-four.** The desk's twenty-four are three shelves side by side and a
drawer is exactly one, so a plan wider than eight cannot be stamped into a
drawer at all: the columns are not there, every box fails `boxOk()`, and
`anySpot()` re-flows the arrangement, which is the one thing a plan exists to
prevent — silently, on the board you would most want to put one down. Eight by
at most **twelve** rows fits a phone shelf, a Mac shelf and any drawer at once;
twelve and not thirteen because a shelf is as tall as whatever fits on *this*
screen and a short handset gives twelve. **Ten ship with the desk** —
`stockplans.js`, each a **base-station board** for a part of your life, a thing
you take in or a piece of work (decision 194; the first ten, one per paper job,
were retired by migration 37 by `RETIRED_KEYS` and nothing else) — as
*ordinary* plans and not a merged-on-read category: seeded on a fresh desk,
added by migration on an existing one, and after that yours to rename or throw
away. `stock` is read by migrations only. **Three** ids travel through a plan:
`rel`, **`tracks`**, and a rule's value on `@in`/`@under` — the board a plan was
captured off becomes `__plan`, and `__plan` becomes the board it is put down
on (`repointRules()`), which is what `HERE` in stockplans.js means and what
gives a plan a calendar of its own board. A rule naming any *other* container
is left alone. And `planCard()` measures the
miniature's width off the plan's own boxes — it drew every one on twenty-four,
which put a shelf-wide plan in the left third of its card. See decisions 172
and 194.

**A Link is a button that goes somewhere outside, and it says where.** The
`outlink` type is the `button` trait with an address; `outURL()` in util.js is
the one test of whether a target is an address (any scheme but `javascript:`,
`data:` and `vbscript:`, and a bare host gains `https://`), which is also how a
container id in the same field is told apart. `fireButton()` opens a site in a
new window and hands any other scheme to the system by navigating. The tile
is decided by **where it points**, never by the type, and an empty one draws as
a Link saying *no address yet*, because pressing it opens the editor. See
decision 194.

**A board comes with the thing it is for, and a plan moves as one.** A kind's
`plan` is read by `create()`, and a type that stamped one does **not** also
get its `seed` (the two both claim the top of the board). Film, Song, Trip and
`writing` (Essay or post) carry the stock plans; a plan's `life` names the Life
drawing it is the board for, and `makeLife()` lays it out. Pressing a plan on
the **desk** makes a container of the plan's `of` kind and stamps into that.
`stampPlan()` places the whole top level at one offset found by
`clearOffset()`, growing the container through `growFor()` when there is none,
and only then falls back to one box at a time; with screenfuls it also gives
the container a screen of room beside a plan that fills its own. See decision
195.

**Thirty-three boards, in three lists, and one maker.** A plan's `sec` (`life`,
`experience`, `project`) says which list it is drawn in: the Life drawer's
question offers the first two as miniatures (`lifeFirstPanel()`), a category
naming `boards` offers its list under its types (`familyPanel()`), and the
Plans door groups by it. **Every** path that turns a plan into a drawer goes
through `makeFromPlan()` in wire.js. Fields describing what a stock plan is
*for* (`life`, `sec`, `of`) may be rewritten by a migration by key, as 39 did;
anything a person could have arranged may not. A Life drawer's kind face is
`front` since decision 196. See decision 196.

**A board is eight by fourteen, the bottom two rows the way in.** `build()` in
stockplans.js appends the *Add to this…* spawner at `[1,13,8,2]` to every
plan, and names and undates every top-level checklist (`clhead`, `undated`).
`into` on a spawner is an id like `tracks` and is re-pointed through a plan the
same way; `intoOf()` in tiles.js refuses a sorting drawer, which holds nothing.
`undated` on a container is read by `create()` and nowhere else. A paste may
carry `plan` and `fill`; `fillOne()` in persist.js is the list of what a fill
may set, and nothing in it may arrange a board. See decision 197.

**A type can be born with things inside it.** `seed:[{kind,title}]` on a kind
makes those children when the container is created, placed at the top of its
board rather than left to `ensureBox()`. One level only — a seeded child's own
seed is ignored, because two types seeding each other would fill the desk. This
is why a project has no add-box bolted to its front: it is born holding a Text
field, which is the type that already turns typing into tasks.

**Answering is writing, not ticking.** The `answer` attribute puts a box on the
front and `answered(o)` is "is there anything in it". Typing in it must not
`render()` — the input is the thing being typed in, so wire.js toggles the
`answered`/`unanswered` class in place and lets the next ordinary render agree.

**Completed things leave a drawer unless it counts them.** `keepsDone(c)` —
the four faces that exist to show what already happened (checklist, project,
calendar, timeline), **and anything carrying `progress`**. The second half is
the honest predicate: a container that reports a fraction of what is under it
needs its numerator, and a percentage whose ticked things have been thrown out
of the drawer is not a percentage. It catches a goal, which never wore one of
those faces and had been reporting 0 of 1 the moment you ticked something
inside it. Everywhere else, done means gone, and that
is what keeps a drawer finite.

**Two of a kind make a third thing, and that's a property.** `gathers` on a kind
names the container a pile of it becomes — task→checklist, ingredient→recipe,
shot→shotlist, scene→story, character/place/item/event→world. `gatherKind(a,b)`
agrees only when both name the same thing. If you are tempted to write
`if(a.kind==='task' && b.kind==='task')`, that is the instinct this property
exists to stop: a type invented at runtime has to get the behaviour too, and
the type builder offers it as "Two of them make".

**A desk starts locked, and so does every drawer in the sample.** A board you
arranged is one you want to look at rather than nudge, and on a locked board one
finger walks the boards, which is the gesture a phone is actually for. A drawer
you make yourself starts unlocked, because you made it in order to arrange it —
`create()` sets nothing, the seed sets `locked:true`.

**An inbox collects; it does not hold.** It is a magic drawer carrying
`filter.loose` — "on a desk rather than filed in anything" — so a new object
appears in it and stays exactly where you made it. `create()` never routes
anywhere but the board you are looking at. For one version it filed into a
nominated inbox instead, which meant a thing you made on the desk vanished off
the desk; `S.inbox` is gone with it. See decision 45.

**A magic drawer sees everywhere unless it says otherwise.** `filter.scope` is
`all` (**the default**) | `desk` | `some` + `filter.scopeDesks`. `desk` was
right when the app was a row of desks and a rule on one answering with another's
contents was a real surprise; there is one desk of nine shelves now, so the two
are the same answer on every desk that exists and the one that read as a limit
was the one being applied. `inScope()` is checked before every other clause in
`inContainer()`, so it applies to the archive and to every rule alike. The scope
blank only shows when there is more than one desk. See decisions 141 and 159.

**A sort is per object then per type.** Ask `sortOf(c)`, never `c.sort`. `manual`
is a real stored value — it is what lets one container refuse a type that sorts —
so writing `null` to mean "unsorted" reintroduces the bug it was there to stop.
