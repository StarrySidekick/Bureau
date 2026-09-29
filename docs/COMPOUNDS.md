# Compound objects — scope

*2026-09-29. Decision 254 built the first of these; this is what the system
could become, and the questions to answer before it grows.*

## What one is

A **compound** is a type made of two or more objects on the grid, put down
together, grouped from birth, and already wired to each other. It sits between
one object and a flow: a flow is a whole board (the base station for a film, a
trip, an aspect of life); a compound is a few cells that are one idea, such as a
list and the number that says how much of it is left.

It is built entirely out of things Bureau already has:

| Piece | What it already does | What a compound uses it for |
| --- | --- | --- |
| `grp` (decision 180) | objects that move together | the parts travel as one |
| `tracks` (decision 133) | a progress bar reads another object | a counter or bar reads its neighbour |
| `rel` | "this is about that", both ways | a label is about its drawer |
| stock-flow shorthand | `k`, `t`, `b`, `set`, `ref` | the parts and their offsets |
| `@under` rules (decision 194) | a calendar collects one board | a calendar collects the part beside it |

Nothing new is stored. Once made, a compound is a group of ordinary objects.
That is the design's main strength (nothing to migrate, nothing to go stale, a
part can be pulled out and is simply an object) and its main open question
(below).

## What is built (v2.48)

| Compound | Parts | Wiring |
| --- | --- | --- |
| Labelled drawer | label 4×1 over drawer 4×3 | drawer `rel` label |
| Counted list | checklist 4×6, counter 2×2 | counter reads things left to tick |
| Checklist with a bar | checklist 4×5, progress bar 4×1 | bar reads the list |
| Habit and its run | habit tracker 4×2, counter 2×2 | counter reads days in a row |
| Draft with a word count | note 4×4, counter 2×2 | counter reads words |
| Spread | label 8×1, two notes 4×5 | none |
| Quick list (v2.49) | notepad 4×1 over list 4×6 | notepad tied to the list with string |

Since v2.49 Counted list and Checklist with a bar carry a notepad on top too,
and **a string carries things**: a notepad, button or spawner tied to a drawer
puts what it makes in that drawer (decision 258). That answers most of the
Workflows section below without new fields: *Capture and file* is a notepad
tied to a drawer.

Picker: *Everything else → Put together*. The Magic Selector's box is where it
lands if the whole footprint is free there.

## Candidates

Grouped by what they are for. **Ready** means every piece exists and it is one
row in `COMPOUNDS`. **Needs** names the one thing missing.

### Labels and spreads (layout)

- **Titled board section**: a label 8×1 over a 8×n empty background. Ready
  (Background is a type).
- **Captioned picture**: a picture and a text set *above* it (Words door,
  `layer:'above'`), so the caption lies on the image. Ready.
- **Index card pair**: question card and answer card side by side, answer
  flipped. Ready.
- **Two-column notes** with a shared heading: the Spread with a divider line.
  Ready.
- **Pinned note on a corkboard patch**: a background fill 4×4 with a note on
  it. Ready.

### Readouts (a number about the thing beside it)

- **Jar with a count**: jar plus counter reading things in it. Ready.
- **Project with a bar**: project drawer plus progress bar reading it. Ready.
- **Deadline countdown**: task plus counter reading days until its day. Ready.
- **Reading log**: book plus counter of pages. Needs a `pages` field on a book
  for the counter to read (or a `measure` on the book, as a measured habit has).
- **Savings jar**: jar plus bar reading a money goal. Needs the goal to hold an
  amount (`measure` again), which is the "goal with a number" INTENT names.
- **Streak and best streak**: habit plus two counters. Needs a `best` count
  (the longest run), a small addition to `COUNTS`.

### Workflows (a way of working, small)

- **Inbox and outbox**: two lists and a button that moves a line from one to
  the other. Needs a Button that files (`does:'move'`), which the Button
  (decision 240) does not do yet.
- **Capture and file**: a spawner feeding a list beside it. Ready (a spawner's
  `into`, decision 197).
- **Week at a glance**: a week calendar collecting only the list beside it.
  Needs `@in` pointed at a sibling part, which is the same re-pointing flows do
  for `PLAN_ROOT` (`repointRules()`), applied to a part's `ref`.
- **Timer on a task**: a task and an hourglass. Ready as a layout; *wired*
  needs an instrument to know which task it is timing (log the minutes to it).
- **Daily page**: a note titled with today, a checklist and a mood counter.
  Needs a title template (`{today}`).

### Things in the drawer front

- A compound whose part lives in the front (decision 252): a board's own
  counter standing beside the knob while the list it reads is on the board.
  Needs `front` allowed in a part's `set`, which is one line.

## The questions to answer first

1. **Does a compound remember it is one?** Today it does not: after it is made
   it is a group. That means no "reset the layout", no "these are the parts of
   a Counted list", and resizing one part does not move the others. The cheap
   answer is a `cp` field on each part naming the compound's type, alongside
   `grp`, so the editor can say what it is and offer "lay it out again". The
   honest alternative is that a group is enough, and a compound is only how it
   is born.
2. **Is ungrouping allowed to break the wiring?** Pulling the counter out of a
   Counted list leaves it reading the list, wherever it goes. That is probably
   right (the relation is real), but the tile should say so.
3. **Where do they live in the picker?** Behind *Everything else* for now so
   the Workshop's fifteen stay as Timothy arranged them. If compounds become the
   way to build setups, they want a row of their own, or a place inside each
   master (a Counted list under List).
4. **Can Timothy make one?** A flow is captured from a board ("Save as a
   flow"). The same gesture on a selection ("Save these as a compound") would
   let compounds be made on the desk rather than authored in model.js: the
   selection's boxes become offsets, `rel` and `tracks` between members become
   `@ref`s. `plans.js` already does the capture half.
5. **What happens on a Mac?** The parts get the same arrangement when the
   numbers fit there too, and otherwise only sizes, which `ensureBox()` places
   one by one. A group that arrives scattered on the other device should be put
   back together the first time it is drawn there.

## Suggested next steps

1. Answer question 1 (a `cp` field or not).
2. "Save these as a compound" from a selection, which turns this from a list in
   the code into something built on the desk.
3. The three one-line additions: `best` in `COUNTS`, `front` in a part's `set`,
   and `@ref` in a part's rules.
