# Intent

What this is for, and what to build next. Recorded **2026-09-06** from Timothy's
own answers to a direct set of questions, so this is *stated* intent rather than
intent inferred from the code.

**Read this before choosing what to build.** Where it disagrees with the rest of
the docs about **direction**, this file is newer and wins. Where it disagrees
about **mechanics** — how the code works, what was decided deliberately, the
invariants — the other docs win, always.

When something here is done, or turns out to be wrong, **edit it**. A stale
intent file is worse than no intent file.

## What it is for

Timothy's own daily desk. One user, no product.

He uses it now **to fiddle with, not yet to live in**, and he named the reason:
he has not got the layout that fits his actual life onto it. That is the gap
between a thing that works and a thing that gets used, and closing it is worth
more than any single feature.

## What is next

**Functions** — in his words, *"representing the different things one does with
paper systems."*

That is the axis for this stretch. Not more dressing on how the desk looks, but
what a paper desk lets you *do*: file, annotate, cross-reference, clip, stamp,
copy, tear out, pin, date, archive. Bureau has spent many passes on aesthetics,
slots, depth and motion, and those are good and are not banned — but look work
is no longer the default answer to "what now".

**The whole list is now scoped, 2026-09-09: `docs/FUNCTIONS.md`.** Timothy's own
*Function of Paper Systems* document is fifteen functions a paper system serves,
and that file gives each one a format in Bureau: what exists, what is missing,
what to add and the board it looks like. It is where "what now" should be read
from for this stretch, and `ROADMAP.md` §0y is its summary and its order.

**First of them, 2026-09-06 (v1.52): the margin.** `margin` is an attribute any
object can carry — a running note, each entry dated as it is written and never
rewritten. `text` is the document and is edited; the margin is what you write
beside it, and a paper file grows by having things added rather than by the
letter being redrafted. Entries are printed rather than editable on purpose: a
margin you can go back and tidy is just the body again. On the board it shows as
a count, because an entry is a sentence and a tile has no room for one.

**Still on the list**, in rough order of how paper they are: **clip** (objects
that travel together, which containing and relating both fail to express),
**stamp** (a dated impression — received, sent, paid), and **tear out** (pulling
part of a note out as its own object).

Second, and directly useful to him: **a real personal desk layout that fits his
life.** `plans.js` exists for exactly this — a plan is a board you can put down
again. Proposing a concrete arrangement as a plan is legitimate, welcome work.

### Added 2026-09-21 — things that sit on a desk

Timothy went looking for **objects that are on a desk rather than filed in
one** — a glass jar, a brass plate, string between things, a lamp that lights
what is round it, wax seals and letters and postcards, a deck of cards, and six
things that run: a metronome, an hourglass, a candle, a desk bell, a clock and
a die. Plus two changes to how anything at all is handled: persistent
**groups**, and a **per-object lock** reached from a palette-shaped menu.
`ROADMAP.md` §0zb has the whole brief broken into seven phases with what each
one needs.

**Three of the eight are functions from the list above, arrived at from the
other end.** *String between objects* is **cross-reference**, which `relates`
has stored both ways for versions and has never drawn. *Grouping* is **clip** —
"objects that travel together, which containing and relating both fail to
express", named in this file as still on the list, and a group is the sentence
that expresses it. *Wax seals* are **stamp**. So this is not the look work the
section above says is no longer the default answer: two-thirds of it is the
function work, asked for as furniture.

The third that is honestly look work is the first that shipped (v1.71, the jar
and the nameplate), because it was the part with nothing underneath it —
additive, no gesture touched, no migration. The rest is in order of what it
needs.

### Added 2026-09-22 — the camera, and then five rounds of living with it

Five reports in one day, each one a list, and they are all the same kind of
work: **the desk objects are built and now they have to behave.** The camera
(decision 187) was the big idea — you go to the object where it sits, rather
than the object coming to you — and everything since has been the consequences
of it meeting the rest of the app.

What came out of it that is worth carrying forward:

- **A container's board is its own tile, four cells to a cell**, read off the
  box for the device you are looking at, and inside one the desk's nine
  shelves do not apply at all: a board is exactly `w×4` by `h×4`, centred if
  it is smaller than the screen and paged if it is bigger (decisions 188, 190,
  192). This is the rule the drawer sizes finally mean something under.
- **A drawer opens onto that board, flush to its own face** (192). The two are
  the same shape now, so the opening is a window rather than a box growing.
- **Full screen means the screen** (191).
- **One hold, one meaning**, on both kinds of board (192).

Three things Timothy said twice, which is the signal to write them down:

1. *Proportion.* He asked for it three rounds running before it was right,
   because each fix was true of one device and not the other. The answer that
   held is per-device.
2. *Don't put furniture round the thing I am looking at.* The bar and the rail
   during a dive, the title banner in full screen, the margins round a
   "full screen" page. Every time, the fix was to take the frame away.
3. *Give me the option rather than the decision.* The locked/unlocked
   background was a rule; it is a setting now.

**Timothy's standing note on this stretch:** the reports arrive as spoken
lists, several items long, mixing a structural idea with three small bugs.
Take the structural one first and say which it was.

### Added 2026-09-22, later — what a board is

Timothy's definition, in his words: *"the new term for the 'grid' or 'shelf' is
the 'board'. This just refers to any grid space making up a desk, container, or
shelf. We no longer use the term shelf in this context. The main home is called
the 'desk' still, and it is made up of boards, a 3x3 grid of them. Inside
containers the grid space is also called a board, and that board's size is
determined by the container shape."* Settings follow the word: on the desk the
board's options (colour, type, aesthetic, gravity, size) are behind **Board
settings**, and inside a container the gear opens straight onto them. Use
*board* in anything written from now on. Decision 193.

### Added 2026-09-23 — a board is the base station for one thing

Timothy's words: a board, once fully customised, is *"catered to a specific
kind of activity or project or aspect of one's life"*, the base station for
it, and it can send you on to other apps. His notes behind it: brain-dumping
tasks, thoughts, ideas, questions and problems and having them sorted by kind;
all projects in one place, each with its own board; the same for each part of
a life; a calendar filled from the rest of the app; habits charted; boards for
activities (painting, composition, music practice) with links out and small
tools (number and prompt generators); Claude able to make boards, layouts,
tasks and notes; and catalogues of notes, essays, stories and creations that
are visual and personal. His four headings: Project Management (ideating,
prioritising, outlining, creating, scheduling, maintaining), Life Management,
Writing Tool, Catalog.

**First of it (v1.82, decision 194):** the ten stock plans were replaced by ten
such boards (Health, Finances, Exercise, Nutrition, Travel, Films, Books, Short
Film, Song, Essay), and two types were added for them, **Link** and
**Review**. The rest of his list followed in decision 196. The brain dump that sorts itself by kind is the biggest idea in the notes and
is not started.

**Then (v1.84, decision 195), in his words:** Life and Project drawers were
always meant to *"come prepackaged with this plan within them already when you
made them"*, so they do now; a plan pressed on the desk makes its own drawer;
a plan laid on a busy board moves as one. And *"the proportional drawer rule
makes the layout system very wonky"*: proportional boards are a setting, **off
by default**, and a container is screenfuls again.

**Then (v1.86, decision 196):** the rest of the list is built, thirty-three
boards in all. The Life drawer asks which board, drawn as the boards, and wears
a plain drawer front for now; the Project question offers every project board
under its types. Not on his list and still not started: the brain dump that
sorts itself by kind.

**Then (v1.87, decision 197):** boards are eight by fourteen with a way in along
the bottom; eleven of them were filled as if they were his
(`docs/examples/lived-in.json`, through Paste in) and what that showed was
fixed: calendars that list what is coming, lists with their names, dates and
counts, spawners that file into a drawer, lists that make undated things, and
answers that wrap. Named next: a counter that resets daily, a habit's year of
squares, a goal with a number, and the brain dump.

## Deliberately not next

- **Sync between devices.** It is real and it is coming, *after* the feature set
  feels complete. Export/import JSON is the bridge until then. Do not start it.
- **A native shell.** Also real, also after feature completeness. The
  dependency-free, build-step-free constraint exists partly to keep that cheap
  when the time comes, which is another reason not to relax it.

## Worth knowing

The smoke suite takes forty to ninety minutes in the nightly container, and
**Timothy has explicitly accepted that cost** because the run happens at night.
Do not water the suite down to save time.
