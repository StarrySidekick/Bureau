# The functions of paper systems, and Bureau's answer to each

Written **2026-09-09** against Timothy's *Function of Paper Systems* document,
which is the closest thing this project has to a thesis statement: fifteen
things a person actually does with paper, each with its own routine, its own
amount of structure and its own register. It is reproduced unedited as
[`PAPER-SYSTEMS.md`](PAPER-SYSTEMS.md), so every quote below can be checked.

This file is a **scoping pass, not a build**. For each function it says what
Bureau already does, what is honestly missing, what to add, and what the board
looks like when it is set up for that function. Nothing here is implemented.

`INTENT.md` named Functions as the axis for this stretch and listed four paper
*verbs* to build: margin (done, v1.52), clip, stamp, tear out. Those are the
verbs; this is the list of jobs the verbs are for. Where the two meet is noted,
because three separate functions below turn out to argue for **tear out** and
that is the strongest evidence for building it next.

**Read `SYSTEM.md` before acting on any of this.** Everything below is written
in Bureau's own vocabulary on purpose: a proposal that cannot be said in terms
of attributes, faces, layouts, types and rules is a proposal to build a second
app inside this one.

## How to read a section

Each one carries his brief verbatim, his own classification line, then four
paragraphs: **today**, **missing**, **the proposal**, **the arrangement**. The
arrangement is a real board with real boxes, sized in desk cells (24 columns) so
it can be laid out and looked at rather than agreed with in the abstract.

Five of the fifteen have **no brief**: he wrote the heading and left the
description empty (3, 10, 12, 13, 14) and put a question mark on the last one
(15). Those sections say so at the top. What is under them is Bureau's answer
inferred from the system, not his thinking recovered, and they are the five most
worth arguing with.

## The short version

| # | Function | What Bureau does today | The one thing it needs |
| --- | --- | --- | --- |
| 1 | Self-Expression | The writing surface, and the whole look system | **Ink**, and a page made without deciding to make one |
| 2 | Brainstorming | The board, Thought, gravity, gathering | A **starter**, and a board that skips the picker |
| 3 | Outlining | Outline, list layout, manual order | **Tear out**, and a heading in a list |
| 4 | Development | Projects, plans, rules, relations, types | A **built-in plan**, and selection by rule |
| 5 | Documentation | The margin, Event, Achievement, timestamps | A **log that takes a line**, and a time on it |
| 6 | Reflection | Book layout, streak, the archive | A **reading taken repeatedly**, and a review that stamps |
| 7 | Queuing / focus | The Void Drawer, ⌘K, the writing surface | The Void Drawer **takes typing**, and a quiet board |
| 8 | Cataloguing | Sorting drawers, tags, types, sorts, rollups | A list row that **prints a field** |
| 9 | Notetaking | The grid itself, Quote, link, colours | **Ink** again, and **tear out** again |
| 10 | Value judgments | `rating`, tags, manual order | **Tiers**: a label as a line things sit between |
| 11 | Goal definition | Goal, milestones, progress bars that track | A **tableau**: a board that is only looked at |
| 12 | Goal deconstruction | Milestones, "make it a project" | **Break it down**: milestones become tasks |
| 13 | Priority judgments | Priority, difficulty, duration, urgency | The **matrix layout**: position means two fields |
| 14 | Scheduling | Both deadlines, span, repeat, the When page | A **time on an event**, and the work band on a month |
| 15 | Skill development | Streak, progress, life drawers, achievements | Nothing new. A **Skill** type, which is a data change |

---

## 1. Self-Expression

> Open, unstructured environment to convey emotions as you please. Should be
> distanced from technical systems, or at least not require any technical
> constraints within the creative space.
>
> Daily journaling · Freewriting · Drawing/Sketching · Musical doodling ·
> Visual customization

*Physical · Daily · Low structure · Recreational.* His own note against Bureau:
"Interface options, titling, naming, custom systems, formatting, colors."

**What Bureau does today.** The visual customization half is finished and then
some: seven aesthetics, sixteen colour slots, six slot families, stocks, grains,
bindings, depth, gravity. That is the part of this function Bureau is already
best in the world at for one user, and it is worth saying plainly because the
rest of this section is a list of gaps.

The writing surface is the other half that works. `openWriter(id)` is a title
and a textarea, full screen, with nothing else on it, which is exactly the
"distanced from technical systems" the brief asks for. Thought exists precisely
because writing something down should cost nothing, and carries no body
template for the same reason.

**What is missing.** Three things, and they are the three activities on his
list that are not writing.

1. **There is no daily anything.** A journal is one page per day, made without
   the act of deciding to make it. Today that is: hold a cell, pick Note, name
   it with the date, open it, write. Five acts where paper has one.
2. **There is no ink.** Drawing and sketching are on his list twice (here and
   under Notetaking) and Bureau cannot draw a line. `media` takes an image
   file; it does not take a stroke.
3. **Sound is import-only.** The Audio type is real, plays, and stores a Blob,
   but nothing in the app records. Musical doodling means picking up a phone
   and humming, and Bureau makes you leave to do it.

**The proposal.**

- **A Daybook.** A container whose add box makes *today's* page and finds it
  again if it exists, so pressing it twice in one day opens what you already
  wrote. `layout:'calendar'` inside it, `face:'calendar'` outside, `read:'book'`
  on the pages. This is a kind plus one behaviour on `spawn` (`spawnBy:'day'`),
  which is a small change to a table that already branches on `spawnBy`.
- **Write on press.** A spawner may say what happens after it makes something:
  `genOpen: 'none' | 'write' | 'read'`. A Freewrite spawner at 1×1 in the corner
  of the desk then means: press, and you are in the writing surface with a blank
  page. One property, read in one place, and it collapses those five acts to
  one. This is the cheapest item in this entire document and probably the one
  that gets used most.
- **Ink.** A new attribute, `ink`, holding a list of strokes as vector paths,
  drawn on a surface beside reading, writing and the media. Vector rather than
  raster on purpose: strokes are small enough to live in the snapshot, they
  scale to any tile size the way everything else on this desk does, and they can
  take `--ink` from the aesthetic so a sketch is drawn in the desk's own colour
  instead of arriving as a foreign rectangle. It shows on the board as the
  drawing, at whatever box it is in, with no tile under it. This is the one
  **large** item in the document: a new surface, a pointer path, and a stroke
  model. It serves functions 1, 2 and 9, which is what justifies it.
- **Recording.** `getUserMedia` into the Blob store the Audio type already
  uses, from the media surface's empty mount, which is already the button that
  chooses a file. **Small**, and it finishes a type that is currently half a
  type.

**The arrangement.** A desk called *Expression*, locked, with the pinned board
on so nothing sits square:

```
row 1    [ Label: "Today" 4×1 ]
rows 2-8 [ Daybook 6×7 · calendar face, showing the month with today large ]
         [ Freewrite spawner 2×2 · genOpen:'write' ]
         [ Sketchpad 6×7 · collage face, holding ink ]
rows 9-14[ Doodles 5×5 · a drawer of Audio, list layout ]
         [ Collage 8×6 · whatever you are looking at this month ]
```

On a phone: the Daybook 4×4 on the middle shelf, the spawner 1×1 beside it, and
the rest one shelf down. The spawner is 1×1 deliberately: at that size it is the
spiral and nothing else, which is the right amount of furniture for the thing
you press without thinking.

---

## 2. Early-Stage Ideation (Brainstorming)

> Large, unstructured space with very VERY low barrier to entry and almost no
> setup. Essential that there is a "anything goes" mentality shift. Sometimes a
> "starter" may be needed, like a *constraint* *catalyst* *template* *problem*
> or *question*. [...] Can also be repeated as necessary within the development
> of a project to fulfill the need for more specific ideas.

*Physical · On demand · No structure besides the starter · Professional.*

**What Bureau does today.** More than it gets credit for. The nine-shelf desk
is the large space, and a shelf you have not used is a blank one you can walk to
with two fingers. Holding a bare cell and dragging sizes a box and makes
something in it. Thought is the no-template type. Gathering (two of a kind make
a third) is the ending: a pile of Thoughts becomes a container without you
filing anything. The Magic Selector lassoes a region, and the context menu will
sweep a selection into a new drawer.

And **gravity** turns out to be a brainstorming tool by accident. A board set to
Tumbling that you can shake is a physical thing you can disturb, which is a
different relationship to twenty ideas than a list of them.

**What is missing.** Two things.

1. **The barrier is the picker.** Every new object on a bare board goes through
   a type picker, which is correct on a desk you are arranging and wrong on a
   board you are dumping onto. In a brainstorm you want the same type twenty
   times and you want to be typing, not choosing.
2. **There is no starter.** His brief names five kinds (constraint, catalyst,
   template, problem, question) and Bureau has types for two of them (Problem,
   Question) but nothing that *hands you one*. A starter is not a thing you
   write, it is a thing you are dealt.

**The proposal.**

- **A board can name its default type.** `genKind` already exists on containers
  and says what a typed line makes. Let the sketch gesture read it too: on a
  board whose `genKind` is `thought`, holding a cell and letting go makes a
  Thought with its name field open, and the picker never appears. The picker
  stays one press away on the rail. **Small**, and it changes what a board *is*
  rather than adding a mode.
- **A Deck.** A container of starters that deals one when you press it. Face: a
  stack of cards, slightly askew, using the tilt hash from decision 75 so the
  same deck sits the same way every render. Pressing turns the top card over
  and puts it on the board beside the deck as a Thought carrying the prompt in
  its body. Prompts are its children, so a deck is written by filing things in
  it, and a deck is a plan away from being shareable between desks. **Medium**:
  a face, a press, and one mutation. It is also the honest home for the
  constraint/catalyst/template distinction, which is four decks rather than four
  types.
- Nothing else. Do not add a brainstorm mode. The board with gravity on, a
  default type and a deck in the corner is a brainstorm mode made of furniture.

**The arrangement.** One shelf of any desk, not its own desk, because the brief
says this repeats inside a project. Gravity set to Tumbling on that shelf,
`genKind: thought`, and:

```
top-left  [ Deck 4×5 · a stack of cards you cut ]
top-right [ Label 4×1 · the question you are answering ]
the rest  bare board
bottom    [ Drawer 2×2 · "Keep" — what survives the session ]
```

The session ends by lassoing what survived and sweeping it into the Keep drawer,
which is one gesture that exists today. The rest can be thrown off the edge:
decision 112's toss is the right ending for an idea that did not work, and it is
recoverable from the toast.

---

## 3. Mid-Stage Ideation (Outlining)

> *He left the brief blank.* The heading reads: "Detailing an outline of what
> you will do to accomplish a goal."

**What Bureau does today.** The Outline type exists with a numbered body
template. Any container in list layout under Manual sort can be dragged into
order, which shipped in v1.68 and is a real outliner gesture: the band lifts,
the others step aside, letting go drops it in. Containment gives you levels,
without limit.

**What is missing.** The level problem, and it is the interesting one. An
outline has depth, and Bureau's only depth is containment, and every container
costs an *opening*. An outline whose second level is behind eight drawer fronts
is not an outline, it is Obsidian, which `CLAUDE.md` names as the thing to avoid.

So the honest question is not "how does Bureau nest a list" but "what is an
outline on a desk". The answer paper gives is: **a page of headings with things
under them**, all visible at once.

**The proposal.**

- **A Label is a heading, and things belong to it.** The Label type already
  exists at 4×1 with a gilt frame and words set large enough to read across the
  desk, and it exists precisely to say what a stretch of board is. What it
  cannot do is *keep* what is under it: move the label and the section stays
  behind. That is **clip**, which `INTENT.md` already wants for its own reasons:
  objects that travel together. A section of an outline is a Label with its rows
  clipped to it, and moving the label moves the section. This is the clearest
  argument in the document for building clip, because it is the only one where
  clip is not a convenience but the whole structure.
- **A heading in a list.** In list layout, a Label draws as a section rule
  rather than as a row, and the rows after it belong to it until the next one.
  No nesting, no disclosure triangles, no tree: one flat list with rules across
  it, which is what an outline on a page is. **Medium**, and mostly CSS plus one
  branch in the list band renderer.
- **Tear out.** The second half of outlining is what happens next: a section
  becomes a draft. Pulling one heading and its rows out as their own object,
  with a relation back to where it came from, is the paper act exactly. This is
  argument one of three for tear out.

**The arrangement.** An Outline is a container in list layout, Manual sort, with
its own board:

```
[ Label "I. The problem"  8×1 ]
  [ Task or Note 8×1 ] × n
[ Label "II. What it needs" 8×1 ]
  [ Task or Note 8×1 ] × n
[ Label "III. Order" 8×1 ]
  ...
```

Eight-by-one because that is what a list row is (decision 168), so the same
board reads identically in grid and in list, and the bar's grid/list toggle
becomes "spread it out" and "read it down" rather than two different documents.

---

## 4. Late-Stage Ideation (Development)

> Heavy usage of tagging\grouping\linking along with maintaining a back catalog
> of information that is easy to access, maintain flexibility and be regularly
> added upon. Also should feature template and outline functionality. Needs to
> support the ebb and flow of the process of creation, along with enough wiggle
> room to accommodate a pivot or restructuring. Also in the case of groups need
> to support collaboration and sharing of information (this might need its own
> function).

*Digital · On demand · High structure · Professional.* **Bureau** is bolded in
his source, and it should be: this is the function the app was built for.

**What Bureau does today.** Nearly all of it. Projects with a report face that
walks the whole subtree; life drawers for the ongoing practice around them;
plans, which are templates that carry a whole arrangement rather than a list of
titles; sorting drawers with five ANDed clauses and meta fields, including
`@under`, which is what makes "any task anywhere inside the film" sayable;
tags that become drawers when you press them; relations read both ways; rollups
on every face; progress bars that read another object's progress; and the type
builder, so a piece of work that needs its own species of thing gets one.

**What is missing.** Three, in order of how much they hurt.

1. **A pivot is expensive.** Restructuring means moving many objects between
   containers, and every move is a drag. The Void Drawer takes a multi-selection
   and puts it down somewhere else, so the carrying is solved; what is missing is
   the *selecting*. The Magic Selector selects by region. A rule selects by
   meaning, and a sorting drawer is a rule you already wrote.
2. **There is no starter plan.** Plans exist and are the right shape, but every
   plan has to be built by hand first, so the template function is available
   only to someone who has already done the thing once.
3. **Collaboration**, which he flags himself as possibly its own function.
   Bureau deliberately has no backend, no account and no sharing
   (`SYSTEM.md` §13). This does not change. The honest bridge is export/import
   JSON and the paste bridge, and it should be described that way rather than
   left as an implied gap.

**The proposal.**

- **Select what this collects.** One context-menu item on a sorting drawer that
  turns its contents into the board's selection. A rule then drives every bulk
  operation Bureau already has: move to a drawer, keep in the Void Drawer, tag,
  delete, sweep into a new container. **Small**, and it converts the rule
  builder from a viewing tool into a restructuring tool, which is what this
  function asks for.
- **Built-in plans.** A small set shipped in `S.plans`, marked so they cannot be
  deleted by accident and can be reset: *A piece of work* (an Outline, a
  Checklist, a Collage for references, a Drawer for drafts, a Timeline), *A
  week*, *A shoot day*. ROADMAP 0r already flagged that a built-in plan is a new
  category of thing in `S.plans` and wants its own session; it does, and this is
  the function that pays for it. **Medium.**
- **A project stamps a plan into itself.** The Project type can already carry
  `plan:`, which supersedes `seed:`. What it cannot do is stamp a *second* plan
  later, when the work turns out to need a shot list after all. One menu item on
  a container: *Lay out a plan in here*. **Small**, since `stampPlan(id, into,
  at)` takes the arguments already.

**The arrangement.** A project's own board, which the Project type would be born
with:

```
rows 1-2   [ Label "The work" 6×1 ]  [ Progress bar 10×2 tracking this project ]
rows 3-8   [ Outline 6×6 ] [ Checklist 6×6 ] [ Drawer "Drafts" 4×6 ]
rows 9-14  [ Collage "References" 8×6 ] [ Timeline 10×6 ]
rows 15-16 [ Spawner 8×2 · "Add to this project…" ]
```

The spawner at the bottom is what the Project type already seeds. Everything
else above is the built-in plan.

---

## 5. Documentation

> Should be very easy to record information and habitual to the extent that it
> is second nature. Needs a memorized underlying structure in order to pull out
> the events of the day as fast and in as much important detail as possible.
>
> Daily logging · Life at a glance · Queueing

*Digital · Constant · Moderate structure · Personal.* His note: "Happenings,
cataloging system, filters, timestamping."

**What Bureau does today.** The **margin** shipped three days ago and is exactly
this function's primitive: a running note, each entry dated as it is written and
never rewritten, because a paper file grows by having things added rather than
by the letter being redrafted. Event is a diary leaf that knows a day and a
duration. Achievement is picked from what is actually finished rather than
written, which is documentation that cannot lie. Every object carries `created`
and `edited`. The timeline layout lays anything dated along an axis, and the
shelf map draws all nine shelves at a fiftieth of the size, which is "life at a
glance" already built.

**What is missing.** Speed, and a clock.

1. **Logging a line costs an object.** The brief's word is *habitual*, and the
   test is whether recording something is faster than not recording it. Today
   the fastest path is ⌘K, type, Return, which makes a task on a board. That is
   an object to look at later, not a line in a log.
2. **Bureau stores a day and never a time.** That is deliberate (decision 162)
   and correct for scheduling, which is function 14. It is wrong for a log: "at
   14:20 the render broke" is the detail the brief asks for.
3. **"Happenings" is his word and has no code behind it.** It appears twice in
   his document, here and under Reflection, and it is worth taking literally: a
   happening is something that occurred, as against a task, which is something
   owed. Bureau has Event (a day something falls on, usually ahead) and
   Achievement (something finished). Neither is "a thing that happened".

**The proposal.**

- **A Log.** A container whose add box appends to its own **margin** instead of
  making a child. Type a line, press Return, and it is a dated entry in a
  running document. No object per line, no board filling up, nothing to file.
  The face prints the last few entries and the count; opening it is the whole
  run. This is the single best fit between an existing primitive and a stated
  function anywhere in this document: the margin was built for the inside of an
  object and the log is the margin given its own tile. **Small to medium**, and
  it needs no new storage shape at all.
- **A time on a margin entry.** A margin entry already carries `{d, t}` (a day
  and the text). Adding a clock time to *that* does not touch decision 162,
  because a margin entry is a record and not a schedule: nothing sorts by it,
  nothing is late because of it, and no calendar draws it. This is the careful
  version of "timestamping" and it keeps the design's own argument intact.
  **Small.**
- **A Happening is an Event whose date is past.** Not a new type: the Event type
  with a date behind today reads as a record, and the diary leaf it is drawn as
  already suits both. What it needs is one line in `SYSTEM.md` saying so, and
  the timeline layout to draw past and future differently, which it half does
  already with the `today` marker.

**The arrangement.** A strip along the top of the home desk, on the shelf you
start on, because a thing used constantly should be where your thumb already is:

```
[ Log 8×3 · today's entries, add box showing ]
[ Sorting drawer 4×3 · "This week" — @made after week ]
[ Timeline 10×5 · everything dated, laid along the axis ]
```

On a phone the Log is 4×3 on the middle shelf with its add box on, which is the
one place `addbox:'show'` is worth the row it costs.

---

## 6. Reflection

> Easy of access, habitual and structured in a way to get you looking at your
> day/experiences in as much detail as possible.

*Both · Daily → Weekly → Monthly · Moderate structure · Personal.* His note:
"'Accordion' formatting, the timeline, pattern logging, Happenings, Drawers."

**What Bureau does today.** `layout:'book'` pages through what a container holds,
so a Daybook of pages is already a month you read straight through, which is
most of what "accordion formatting" is asking for. The archive is a sorting
drawer whose rule is `done`. Streaks keep a history of dates. The timeline is
there. Sort by date made runs a drawer backwards through time.

**What is missing.** The reading, and the cadence.

1. **A number taken repeatedly has nowhere to live.** `rating` is one value and
   it is overwritten. `count` is a running total with no dates on it. `streak`
   keeps dates but only binary ones: did it or did not. So "how has my sleep
   been this month", which is the shape of half his Mind branch in the life map,
   cannot be recorded at all. ROADMAP 0r spotted this and proposed a habit with
   a progress bar reading its streak, which answers *did I* and not *how was it*.
2. **The review is not a thing.** Daily → weekly → monthly is a cadence and
   Bureau has repeat rules, but a repeating task spawns a copy of itself. A
   review is not a copy of a task, it is a fresh sheet with the same questions
   on it.

**The proposal.**

- **A reading: the `series` attribute.** A value taken repeatedly, stored as
  `[{d, v}]`, the same shape the margin uses and for the same reason. It draws
  as a run of marks, one per day, height by value, which at 8×2 is a month you
  can read across the desk and at 1×1 is the last value alone. It composes with
  everything: a progress bar can `track` it, a sorting drawer can collect on it,
  a rollup can average it. **Medium**, and it is the highest-value new attribute
  in this document because it is what functions 6 and 15 both actually need.
- **A repeat that stamps a plan.** A container carrying `repeat` and naming a
  `plan` lays that plan out fresh on the appointed day instead of copying
  itself. "Weekly review" then means: every Sunday, a new sheet appears in the
  Daybook carrying the four questions, blank. Everything needed exists —
  `nextRepeat()`, `stampPlan()` — and it is one branch at the point where
  completion currently spawns a copy. **Small**, and it turns plans from a thing
  you remember to use into a thing that arrives.
- **Accordion is the grid/list toggle, and that is enough.** A tile shows less
  as it gets smaller is already Bureau's answer to disclosure, and the bar's
  toggle already switches a board between the spread-out and the read-down view.
  Do not build a collapsing entry. If a month of pages is unreadable, the fix is
  book layout on the Daybook, which exists.

**The arrangement.** A *Reflection* shelf, one shelf of the home desk:

```
rows 1-2   [ Label "This week" 6×1 ]
rows 3-6   [ Daybook 6×4 · book layout, so pressing it reads the week ]
           [ Readings 8×4 · Sleep, Energy, Focus, Stress as four series 8×1 ]
rows 7-12  [ Sorting drawer "Finished this week" 5×5 · @done is yes, @made after week ]
           [ Timeline 10×5 ]
rows 13-14 [ Task "Weekly review" 6×1 · repeats weekly from date, stamps the review plan ]
```

Four series stacked at 8×1 each is the pattern log: four lines of marks, a
month wide, read in one look. That is the object his life map's Mind branch has
been waiting for.

---

## 7. Queuing / Focus Topics

> Completely distraction free, and easily integrated into other paper systems so
> that the information is cataloged automatically, reducing busywork. Sometimes
> needs a physical "statement space" to be effective, based on my experience.

*Digital · On demand · Moderate structure · Universal.* His note: "Global
timeline, ability to convert reserved topic into notes."

**What Bureau does today.** This is the function Bureau is worst at, and the
reason is structural rather than accidental: the whole argument of the app is
that everything is visible on a desk, and this function asks for the opposite.

What exists: the writing surface is genuinely distraction free, with nothing on
it but a title and the words. Desks separate contexts, and walking between them
is two fingers. ⌘K captures from anywhere. And the **Void Drawer** already
means, exactly, "a thing with no place yet": it is reachable from four places,
a sorting drawer cannot see into it, and its contents have no coordinates at
all, which is what makes it a queue rather than a board.

**What is missing.** Getting something *into* the queue without leaving what you
are doing, and a place where the desk stops competing for attention.

Today, queueing something means it must already be an object: you pick a tile up
and carry it down into the drawer. The interruption Bureau needs to absorb is a
sentence, not a tile.

**The proposal.**

- **The Void Drawer takes typing.** Pull the knob, type a line, press Return,
  and it is in the drawer with nothing decided about it: no type chosen, no
  board, no cell, no name field to fill in later. It comes out as a Thought when
  you put it down. The drawer is already a panel that opens on a pull and
  already lists what it holds, so this is the add box on a container that is not
  one. **Small**, and it is the piece that makes the queue usable rather than
  theoretical.
- **A quiet board.** A container may say `quiet: true`, and its board draws with
  no bar and no shelf dots: the wood, the paper and what is on it. The way out
  is the Home Knob, which is furniture rather than chrome and is the one thing
  that should survive. This is the "statement space" his brief asks for, made of
  a property rather than a mode, and it is the same property function 11's
  tableau wants. **Small.**
- **Nothing else.** Do not add a focus mode, a timer, or a do-not-disturb. A
  drawer you are inside of, with a quiet board, is already the only thing on the
  screen; Bureau's dive already fills the screen with that board and frames the
  desk you left behind it. The missing piece was never concealment, it was
  capture.

**The arrangement.** Not a board. This function is a gesture and a property, and
its arrangement is: the Void Drawer, wherever you are, plus one quiet drawer per
topic you are working through. The queue empties by opening the drawer and
putting things down on the board they belong to, which is the "convert reserved
topic into notes" his note asks for and is already how the drawer works.

---

## 8. Cataloguing

> Heavy use of filters, tagging, and categorization, with a focus on organizing
> information quickly in order to create a sort of "database". Similar to the
> idea of a "Personal Wikipedia Page".

*Digital · On demand · Very high structure · Universal.* His note: "Drawers,
Item differentiation, auto-sorting, filters."

**What Bureau does today.** Most of it, and the item differentiation half is
finished: forty-odd types, sixteen colour slots, shapes, faces, marks, and a
type builder so a catalogue that needs its own species gets one. Sorting drawers
do the filtering with five ANDed clauses over both trait fields and meta fields.
Tags become drawers when pressed, which is the whole filter UI replaced by a
piece of furniture. Sorting is per container. Rollups total a field across what a
container holds. The archive keeps what is finished without anything being moved.

**What is missing.** One thing, and it is small and specific: **you cannot see
the fields.** A catalogue is records with values, and the only place a value
shows is inside the object. Twenty books in a list are twenty names, and the
rating you catalogued them by is invisible until you open one.

The second, softer gap: a sorting drawer collects and never files. That is the
law (hold or collect, never both) and it should stay. But "auto-sorting" in his
note means putting things away, and there is a version of that which does not
break the law.

**The proposal.**

- **A list row prints one field.** The container says which: `listField: 'rating'`,
  and every row in it shows its name and that value, right-aligned. Sorted by
  the same field, that is a catalogue view, and it is one line in the list band
  renderer plus a row in the Behaviour door. **Small**, and it is the single
  highest ratio of usefulness to work in this document.
- **Empty a sorting drawer into a real one.** One menu item: everything this
  rule currently matches gets `parent` set to a container you choose. It is an
  act you press, not a standing rule, so nothing collects and holds at the same
  time and §3's law is intact. Pairs with function 4's *select what this
  collects*; they are the same idea aimed at different jobs. **Small.**
- **A personal Wikipedia is relations, and relations are done.** `relates` reads
  both ways and the object editor prints "Pointed at by". Resist a backlink
  panel, a graph view, or anything that makes the links the subject: that is
  Obsidian, and `CLAUDE.md` names it as the comparable to avoid.

**The arrangement.** One drawer per catalogue, list layout, sorted, printing its
field:

```
[ Drawer "Books" ] → list layout, sort A–Z, listField: rating
                     one type: a Book record you built (text, rating, date, link)
[ Sorting drawer "Five stars" ] → rating is 5
[ Sorting drawer "This year" ]  → @made after year
```

The two sorting drawers sit beside the real one on the same shelf. That is the
Bureau answer to a saved search: a thing on a board, at a size, in a place.

---

## 9. Notetaking

> Format should support abridging and summarizing information as easily as
> possible. Unique in that there is a focus on memory forming, and so benefits
> from physical/spacial environments. Paired with the mental direction stage of
> "Observation".

*Digital → Physical · On demand · Moderate → No structure · Professional.* His
note: "Sections for each type of note, quick access, list and outline
functionality, colors."

**What Bureau does today.** The spatial half is Bureau's own thesis: a desk is a
place, position carries meaning, and a note is somewhere rather than in a feed.
Nothing else on his comparables list can say that, and it is the half of this
function that is hardest to build and is already built. Sections for each type
of note are drawers. Colours are the sixteen slots. Quick access is ⌘K and the
shelf map. List and outline functionality is function 3.

**What is missing.** The two things the brief actually emphasises: abridging, and
the physical.

1. **Abridging has no gesture.** Summarizing means taking a long thing and
   producing a short thing that points at it. Today: open the source, select,
   copy, make a new object, paste, and then remember by hand where it came from.
2. **A note from a source does not say so.** `link` holds a URL and Quote
   carries link and rating. But a source is very often a book, a lecture or a
   conversation, which is an object rather than an address, and there is no
   convention for it.
3. **Handwriting**, again. His brief puts *Physical* at the end of the paper-type
   arrow specifically for the memory-forming reason, and handwriting is that.

**The proposal.**

- **Tear out.** Select a passage while reading and pull it out as its own
  object, carrying a `relates` back to the source and leaving a mark where it
  came from. This is argument two of three for the verb `INTENT.md` already
  wants, and it is the abridging gesture exactly: paper's answer to summarizing
  is to tear out the part that mattered. **Medium**: a selection on the reading
  surface, one mutation, one relation.
- **A source is a container.** No new machinery: the book is a drawer, the notes
  are its children, the drawer carries `link` if the source has an address, and
  `@under` collects across it. Write this down as the convention rather than
  building a `source` field, because a field would be a second, weaker way of
  saying what containment already says.
- **Ink**, as in function 1. Handwritten notes on a grid, at any size, in the
  desk's own colour. This is the second of the three functions that pay for that
  surface.

**The arrangement.** A drawer per source, and one shelf per subject:

```
[ Label "Architecture" 6×1 ]
[ Drawer "Towards a New Architecture" 4×4 ] · link, holding notes and ink
[ Drawer "Lectures" 4×4 ]
[ Sorting drawer "Torn out" 4×4 ] · @kind is quote, @under is Architecture
[ Collage 8×6 ] · the pictures, arranged, because a moodboard is a memory aid
```

---

## 10. Value Judgments

> *He left the brief blank.* The heading reads: "Stating what you like in place
> outside yourself."

**What Bureau does today.** `rating` is out of five and is a field, so it sorts,
filters and totals. Tags do the rest: his own source document is tagged
`#meta# #favorites#`, which is a value judgment already recorded in the system
he was writing about. Manual sort keeps an order you arranged.

**What is missing.** Everything comparative. A rating is a statement about one
thing against an abstract scale, and liking is almost never that: you like this
more than that, and the useful artefact is the order, not the number. Bureau can
say "four stars" about fifty films and cannot say which one is best.

**The proposal.** This is the function where Bureau's own thesis gives the
answer for free, and the answer is that **position already means something**.

- **Tiers.** A board where Labels are horizontal lines and what sits between two
  of them belongs to that tier. No new type, no new layout, no new attribute:
  Labels at 24×1 spanning the board, things arranged between them, and Manual
  sort so nothing rearranges itself. A tier list is a Bureau board that has been
  used correctly, and the only thing that would make it better is **clip**, so a
  tier and its contents move as one when you decide the whole tier is wrong.
  That is argument two for clip.
- **A rating on the tile.** Function 8's *list row prints a field* covers this
  from the other side: a drawer of films in list layout printing `rating` is a
  ranked list you can read down.
- **Nothing else.** Resist a comparison mode, a pairwise sorter, or an Elo. The
  brief says "stating what you like in a place outside yourself", and a board
  you arranged *is* the statement outside yourself. This function needs the
  system it already has, described so it can be used deliberately.

**The arrangement.** A *Taste* desk, locked, pinned board on:

```
[ Label "Best" 24×1 ]
   things
[ Label "Very good" 24×1 ]
   things
[ Label "Fine" 24×1 ]
   things
```

Each thing at 3×4 (a card) or 2×3 on a phone, with a picture where there is one.
Locked, because the point of the board is that it holds still between the
occasions when you change your mind about it.

---

## 11. Goal Definition

> Should be within an environment that has ample connections to other systems.
> Also needs to be very easily viewable and shoved in your face to remind you of
> what you are aiming towards. Should follow a thorough process if necessary to
> cover all ground when presented with a new objective or idea after it has been
> initially "stated".

*Both · Daily → Weekly → Monthly → Life · No structure → High · Universal.* His
note: "Bulletins, Tableau."

**What Bureau does today.** The Goal type is a playing card laid down, with
ordered milestones and a bar, and `goalStanding()` reads what it is called off
what it carries: no deadline is a dream, thirty days or fewer is a challenge,
anything else is a goal. Progress bars can `track` another object, so a goal can
read a project's ticks or a habit's streak. Relations connect it to everything
else. Life drawers hold the areas the goals sit in.

**What is missing.** The "shoved in your face" half, and it is a real gap rather
than a rhetorical one. Bureau removed the pinned shelf (decision 53) on the
grounds that anything needed everywhere is a magic drawer on a desk. That is
right for *reach* and wrong for *sight*: a goal does not need to be one press
away, it needs to be unavoidable.

**Bulletins** and **Tableau** are his words and have no code behind them.

**The proposal.**

- **A tableau is a quiet board that is only looked at.** The same `quiet: true`
  property function 7 wants, plus `locked`, plus large type. Opening it fills
  the screen with the goals and nothing else: no bar, no dots, no add box. That
  is a tableau, made of two properties that already exist and one that function 7
  is paying for anyway. **Free, given function 7.**
- **A bulletin is a Label and a Goal at a size.** The Label already sets its
  words large because they are read across the desk, and a Goal at 6×4 is a card
  you can read from the other side of a room. The thing that makes a bulletin a
  bulletin is *where it is*, and Bureau has an answer: the **middle shelf**,
  which is where the desk opens. A goal on the shelf you start on is in your
  face every time you open the app, by construction. Write this down as the
  convention; build nothing.
- **The thorough process.** His brief asks for a process a new objective goes
  through. That is a plan: *Stating a goal*, holding a Question ("what does done
  look like?"), a Goal card, a Progress bar, and an empty Checklist. Stamped
  when a goal is made, which is `plan:` on the Goal type, which already works.
  **Free**, once function 4's built-in plans exist.

**The arrangement.** The middle shelf of the home desk, which is where you land:

```
rows 1     [ Label "This year" 8×1 ]
rows 2-5   [ Goal 6×4 ] [ Goal 6×4 ] [ Goal 6×4 ]
rows 6-7   [ Progress bar 8×2 tracking each ]
rows 8-14  the rest of the desk
```

And a *Tableau* drawer beside them: quiet, locked, holding the life-sized
version of the same three, for the occasions when you want to look at nothing
else.

---

## 12. Goal Deconstruction

> *He left the brief blank.* The heading reads: "The act of breaking down a goal
> into actionable tasks."

**What Bureau does today.** A goal has ordered milestones with a bar over them.
A goal is also a container, so it can hold the work. It is born with a spawner
in it ("What gets you there…"). And since v1.68, anything that is not already a
container can be **made a project** from its own menu, which asks what kind of
work and carries the box and the seed across.

**What is missing.** One specific dead end, and it is the clearest single
opportunity in this document.

**A goal's milestones are strings.** They are ordered, they draw a bar, and they
are not objects: you cannot tick one from the board, drag it onto a day, give it
a deadline, file it, or collect it into a sorting drawer. So the act this
function names — breaking a goal into *actionable* tasks — produces something
that is not actionable in Bureau's own sense of the word.

**The proposal.**

- **Break it down.** One item on a goal's menu. Each milestone becomes a Task in
  a new Checklist filed under the goal; the milestone list is cleared; and the
  goal's bar is pointed at the checklist with `tracks`, so the number on the
  card keeps meaning what it meant. Everything needed already exists:
  `create()`, `keepSize()`, `tracks`, `barPct()`. It is one function and one
  menu row. **Small**, and it converts a dead end into the rest of the system:
  those tasks can now be dated, ranked, made urgent, collected by a sorting
  drawer, and ticked from a checklist front without opening anything.
- **The reverse is already there.** "Make it a project" (decision 171) is the
  same act one level up, and the two together are the whole of deconstruction: a
  thought becomes a project, a goal becomes tasks.
- **Nothing else.** Do not add a sub-task field. Containment is how Bureau does
  levels, and a checklist under a goal is that.

**The arrangement.** Inside a goal, after breaking it down:

```
rows 1-2  [ Progress bar 8×2 · tracks the checklist below ]
rows 3-8  [ Checklist 8×6 · the milestones, now tasks, tickable from outside ]
rows 9-10 [ Spawner 8×2 · "What gets you there…" ]
```

The goal's own tile on the parent board is unchanged: a card, with a bar that
now reads real ticks instead of strings crossed off.

---

## 13. Priority Judgments

> *He left the brief blank.* The heading reads: "The act of determining which
> tasks or goals are more important than the others."

**What Bureau does today.** This is Bureau's most original piece of thinking and
it is fully built. Priority is importance, 0–5, where 0 is a real answer.
Difficulty is 1–5 and is what it costs you to start, which is what actually
decides what gets put off. Duration is minutes. And **urgency is derived**: the
days you have to a deadline less the days the work needs, which is why three
hours due tomorrow and three weeks due tomorrow are not the same situation. All
of it is on one page, the When page, with the month drawn underneath and the
arithmetic shown so it can say *why*.

**What is missing.** The same gap as function 10, for the same reason: every one
of those is a statement about **one** object against a scale, and a priority
judgment is comparative. The urgency sort ranks a list, which is the closest
Bureau gets, and it ranks by a formula rather than by a decision you made.

**The proposal.** One substantial new thing, and it is the only new *layout* in
this document.

- **The matrix layout.** A container whose board has meaning on both axes: x is
  one field, y is another, and where you put a tile *writes* those fields.
  Default axes: importance across, urgency up, which is the box everyone draws
  on a whiteboard and which Bureau can draw better because the tiles are the
  real objects and dragging one is the judgment. The drop already writes fields
  in two places (a calendar day writes `due`, a timeline position writes a date),
  so this is a third instance of a pattern the code knows, not a new kind of
  behaviour. Axis labels along the edges, the four quadrants shaded faintly, and
  `boxOk()` unchanged: two things may not overlap, so the board makes you decide
  between them, which is the point.
  **Medium to large**: a layout renderer, a drop branch, two axis pickers.
- **It is a layout, so anything can wear it.** A drawer of tasks, a life drawer
  of projects, a board of goals. That is the test Bureau applies to every layout
  (`calendar` and `timeline` are layouts and nothing in the code knows what a
  calendar is), and this passes it.
- **Urgency stays derived.** The y axis reads `urgencyOf()` and does not write
  it: dragging up means moving the deadline in, which is a real act with real
  consequences. Writing a fake urgency would undo decision 120 in one gesture.

**The arrangement.** A drawer called *What matters*, matrix layout:

```
        ▲ urgent
        │  [ task ]        [ task ] [ task ]
        │
        │        [ task ]
        │  [ task ]                 [ task ]
        └──────────────────────────────────▶ important
```

Sorting drawers do the filling: the matrix collects "anything unfinished with a
deadline", so things arrive in it by rule and you place them by hand. Placing is
the judgment; arriving is not.

---

## 14. Scheduling

> *He left the brief blank.* The heading reads: "Setting the time in which you
> will do something or must have it completed."

**What Bureau does today.** Nearly all of it, and carefully. `date` is the day a
thing sits on and `deadline` is the day it is owed, which are two facts and not
one (decision 62). `softdeadline` is the day you set yourself, with no
consequence. `span` makes a thing last. Repeat rules count from the date or from
the day you finished, which is the distinction between the bins and the plant.
The When page puts all of it on one sheet with the month underneath and three
sewing buttons you drag onto days. The calendar face adapts from a day pad at
one cell to a full planner at twelve by six. Dropping a tile on a day dates it.
And `workBand()` draws the days the work actually takes as a rule along the top
edge of the month, reaching back from the deadline by duration ÷ workday.

**What is missing.** Two things, one of which is a decision rather than a gap.

1. **No clock time.** Bureau stores a day and never a time, and for tasks that
   is right: a task with a time on it is a lie you have to maintain. But an
   Event is a meeting, a shoot, a call, and a meeting without a time is not a
   meeting.
2. **The work band is only on the When page.** The one drawing in the app that
   shows where the time actually goes appears in a panel about a single object,
   and not on any calendar, where it would answer "is this month possible".

**The proposal.**

- **A time belongs to the Event, not to the task.** `at` rides on the `span`
  attribute or on its own small trait carried by Event alone: a start time and
  nothing else, printed on the diary leaf and on the calendar cell. Tasks stay
  day-grained, the urgency arithmetic stays in days, no calendar grows an hour
  axis, and decision 162's argument is untouched because it was an argument
  about tasks. **Small**, and it should be recorded as a decision when built,
  because it reads as a reversal and is not one.
- **The work band on the calendar.** Reuse `workBand()` in the calendar face and
  layout: every dated thing with a duration draws its run of days as a rule
  along the top of the cells it covers. A month then shows commitments *and*
  the work they imply, which is the thing no other calendar draws. **Small**,
  and it is the highest-value reuse of existing code in this document.
- **No hour grid, no week-of-hours view, no automatic scheduling.** Bureau is a
  day-grained desk and should stay one.

**The arrangement.** The scheduling shelf is the calendar at a size that earns
the planner:

```
rows 1-8   [ Calendar 12×6 · month grid, titles in the cells, work bands on top ]
rows 9-11  [ Sorting drawer "Owed this week" 5×3 · dead before week ]
           [ Sorting drawer "Behind" 5×3 · urgency is 4 ]
rows 12-14 [ Timeline 10×3 ]
```

Twelve by six is the threshold at which the calendar face prints titles in the
day cells rather than counting them, which is the difference between a widget
and a planner.

---

## 15. Skill Development

> *He wrote the heading with a question mark and nothing under it:*
> "15. Skill Development?"

**The answer to the question mark is yes**, and it is the one function on the
list that needs no new machinery at all, which is itself an argument that it
belongs: the system grew the parts for it without being asked.

**What Bureau does today.** A habit is a task that repeats, and the `streak`
trait keeps a history of dates with no overdue, which is deliberate: overdue is
the guilt-generating pattern that makes habit trackers unpleasant. `progress`
gives ordered milestones and a bar, which is a ladder. A progress bar can track a
streak against `target` days. Life drawers are areas rather than pieces of work
and never report a percentage, because an area of your life has no end for one
to be a fraction of. Achievements are picked from what is actually finished.

**What is missing.** Nothing structural. Two things worth having:

1. **The practice itself is not recorded.** A streak says you practised; it does
   not say for how long or how well. Function 6's `series` covers this exactly:
   a reading taken repeatedly. Twenty minutes a day, or a self-rating out of
   five, drawn as a run of marks a month wide.
2. **There is no preset.** Every part exists and assembling them is six
   decisions, which is what a type is for.

**The proposal.**

- **The Skill type.** A life drawer carrying `progress` and `streak`: an area of
  practice with a ladder and a run. Face: the life drawer's walk, with the
  ladder's current rung named instead of a percentage, and the streak under it.
  This is a **data change** — one entry in `BUILTIN_KINDS` plus one face branch
  — which is the cheapest kind of addition Bureau has, and the type system
  exists precisely so that a recognised combination becomes a named preset.
- **A series beside it** for the practice log, once function 6 pays for it.
- **Achievements are the record.** They are already picked from what is finished
  rather than written, so a skill's history is honest by construction. Nothing
  to build.

**The arrangement.** One Skill drawer per skill, inside a Learning life drawer:

```
[ Skill "Music theory" 5×5 ]
   rows 1-2  [ Progress bar 8×2 · the ladder: intervals → keys → voice leading ]
   rows 3-4  [ Series 8×2 · minutes practised, a month wide ]
   rows 5-6  [ Task 8×1 · "Practise" — repeats daily from done, carries streak ]
   rows 7-12 [ Drawer "Exercises" 4×6 ] [ Drawer "Notes" 4×6 ]
   rows 13-14[ Sorting drawer "Done" 8×2 · @done is yes, @under is this skill ]
```

---

## What is actually new

Everything proposed above, gathered, deduplicated, and costed. The cost scale is
Bureau's own: a **data change** is a row in a table, **small** is a function and
a rule, **medium** is a face or a behaviour with CSS and a smoke assertion, and
**large** is a new surface or a new layout.

### Attributes (4)

| | Attribute | What it holds | Serves | Cost |
| --- | --- | --- | --- | --- |
| A1 | `ink` | Strokes as vector paths, drawn on a new surface | 1, 2, 9 | **Large** |
| A2 | `series` | `[{d, v}]` — a value taken repeatedly | 6, 15 | **Medium** |
| A3 | `clip` | Objects that travel together | 3, 10, 11 | **Medium** (already on INTENT) |
| A4 | `at` | A start time, on an Event only | 14 | **Small** |

### Layouts and faces (1)

| | | Serves | Cost |
| --- | --- | --- | --- |
| L1 | **Matrix layout** — position writes two fields | 13, 10 | **Medium–large** |

### Verbs (2, both already wanted by INTENT)

| | | Serves | Cost |
| --- | --- | --- | --- |
| V1 | **Tear out** — pull part of a thing out as its own object, with a relation back | 3, 9, 4 | **Medium** |
| V2 | **Stamp** — a dated impression | 5 | **Small** |

### Types (4, all data changes)

| | Type | What it is | Serves |
| --- | --- | --- | --- |
| T1 | **Daybook** | A container that makes today's page | 1, 6 |
| T2 | **Log** | A container whose add box writes to its own margin | 5 |
| T3 | **Deck** | A container of starters that deals one | 2 |
| T4 | **Skill** | A life drawer with a ladder and a run | 15 |

### Small behaviours (11)

| | | Serves | Cost |
| --- | --- | --- | --- |
| B1 | `genOpen` — a spawner opens what it made, for writing | 1 | Small |
| B2 | A board's `genKind` drives the **sketch** gesture, skipping the picker | 2 | Small |
| B3 | The **Void Drawer takes typing** | 7 | Small |
| B4 | `quiet: true` — a board with no bar and no dots | 7, 11 | Small |
| B5 | **A list row prints one field** (`listField`) | 8, 10 | Small |
| B6 | **Select what this sorting drawer collects** | 4 | Small |
| B7 | **Empty a sorting drawer into a real one** | 8 | Small |
| B8 | **Break it down** — a goal's milestones become tasks | 12 | Small |
| B9 | A **repeat that stamps a plan** instead of copying | 6 | Small |
| B10 | The **work band on the calendar** | 14 | Small |
| B11 | A **Label is a heading in a list** | 3 | Medium |

### Built-in plans (1)

| | | Serves | Cost |
| --- | --- | --- | --- |
| P1 | A small protected set in `S.plans`: *a piece of work*, *a week*, *stating a goal*, *a review* | 4, 6, 11 | Medium |

### Conventions to write down and not build (5)

- A **source** is a container, not a field (9).
- A **happening** is an Event whose date is past (5).
- A **bulletin** is a Goal on the middle shelf, which is where the desk opens (11).
- A **tier list** is Labels across a locked board (10).
- **Accordion** is the grid/list toggle plus book layout (6).

## Order to build in

Sequenced by dependency and by how much each one unlocks, which is the same rule
`ROADMAP.md` uses.

1. **B8 break it down**, **B5 list field**, **B10 work band**, **B6 select by
   rule**. Four small things, four different functions, no dependencies between
   them, and each turns an existing dead end into the rest of the system. This
   is the pass with the best ratio in the document.
2. **B3 the Void Drawer takes typing**, **B4 quiet**, **B1 genOpen**, **B2 the
   board's default type.** Four gestures. Between them they fix the entry cost
   of functions 1, 2 and 7, which are the three the app is worst at.
3. **A2 `series`** and **T2 Log**, then **T1 Daybook** and **B9 the stamping
   repeat**. This is the documentation and reflection block, and it is the one
   that makes the app something to live in rather than something to arrange:
   `INTENT.md` names that gap as worth more than any single feature.
4. **V1 tear out** and **A3 clip**. Both already wanted; three functions each.
   After this, outlining and notetaking work.
5. **P1 built-in plans**, then **T3 Deck** and **T4 Skill**, which are data
   changes that ride on it.
6. **L1 the matrix layout.** The one genuinely new layout, and it should wait
   until the rest is settled because it is the one thing here that could turn
   out to be a whiteboard bolted to a desk.
7. **A1 ink.** Last, because it is a whole surface, and first among the large
   things, because it is the only proposal in the document that Bureau cannot
   approximate at all today.

**A4 (a time on an Event)** can ride along with any pass; it is small and it
needs a decision recorded, not a session.

## What this pass says no to

Named here so they are not proposed again in six months.

- **Collaboration and sharing**, which he flags as possibly its own function.
  Deliberately out (`SYSTEM.md` §13). Export/import JSON and the paste bridge
  are the bridge, and that should be said in the copy rather than left implied.
- **A filter bar or a query UI.** Tags become drawers; a union is two drawers.
- **A graph view or a backlink panel.** Relations read both ways in the editor
  and that is enough. The comparable to avoid is named in `CLAUDE.md`.
- **A focus mode, a timer, a do-not-disturb.** A quiet board you are inside of
  is the same thing made of furniture.
- **An hour grid or automatic scheduling.** Bureau is day-grained.
- **Sub-tasks as a field.** Containment is how levels work.
- **A collapsing accordion entry.** A tile shows less as it gets smaller, and
  the bar already toggles the board between spread out and read down.
