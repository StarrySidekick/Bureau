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

### Added 2026-09-27 — boards you add

Timothy: the desk starts as **a single board**, and swiping off it shows the
carcass with a plus that makes a board there, so the desk can grow *"to any
size you desire basically in any direction"*; containers the same; the swipe
to the container beside this one is **two fingers** now; flows drop the title
row the lip already states, and can come with **several boards** (three across,
five in a column); and line view was meant to stripe the *background*, not
repaint the objects, which should still look like 8×1 versions of themselves,
swipes and all. Built as decision 219 (v2.16).

**Then, the same day (decision 220, v2.17):** his own desk down to one board
too; the drawer front's tools as objects you can put on a board; a spool of
thread for tying things with string, pinned at the top-left corner; a board's
drawer front chosen per board and per flow, up to three tools either side of
the knob; and a spiral coin that makes one of anything somewhere random.

### Added 2026-09-28 — the whole desk, the counter, clips, and setup cards

Timothy: zooming out on the main desk should show all of its boards, and that
is where new ones are added or taken away (never the central one); the viewer
behind the name at the top left is no longer a thing. The counter's wheel
colour, font and number colour should be choosable. Public-domain clips should
fill a Video made at random. And he wants to start making **setup sequences**:
a drawer is made as a plain drawer, and the first time you tap it a card fills
the screen and asks, as a run of questions ("what are you trying to make?")
with the pickers in them, whether it is a project, an aspect of life and so
on. *"Do this with all the objects it makes sense to do with and we'll go from
there. Major setting choices would be what we are deciding between."* Built as
decisions 227–230 (v2.24–2.25); what each type asks is in decision 229 and is the
first draft of a list he means to go through.

### Added 2026-09-28 — the Scope page answered

Timothy answered the Bureau Scope page: shaped knobs for each aspect of life
(a plus for Health, a fist for Exercise, a heart for Partner and so on), the
aspects as types under Aspect of Life under Drawer, a new aspect *Things*,
every flow with a type and a Workflow subtype for the ways of working, a setup
card per flow, Ideas cut, and a note on what each life flow is for. Built as
decisions 236–237 (v2.28). The project flows were all marked *rework* with no
notes beyond the films (casting, storyboard, props, locations, script); they
were rebuilt as decision 238 (v2.29), every one a type of its own.

### Added 2026-09-29 — eight by fourteen, the page as the face, six places, compounds

Timothy: a calendar seemed to suck up dated objects dropped on it and leave an
invisible imprint; book and scroll should keep the face's border, paper and
look, *"the face expanded to the full size of a book"*; video and audio should
loop, by default; 8×14 is the default board and *"it just works"*, so the
drawer front and the name on top should go back to how they were at 14 tall;
the drawer front has **six slots**, three each side of the knob, for any
object, shown at 1×1; and **compound objects**, a type made of two or more
objects grouped by default and already related (*"a counter related to an
object and measuring something about it"*), for spreads, labels and better
workflows without a whole flow. Built as decisions 249–254 (v2.48); the
compound scope is `docs/COMPOUNDS.md`. The calendar imprint did not reproduce
on a fresh desk and is open.

### Added 2026-09-29, later — the notepad, and strings that carry things

Timothy: an unplayed video flickers when anything else is tapped; the coin
never makes a background; the Button should be only the button, with a setup
card saying what it makes; a **notepad** (ruled, 4×1) is the spawner done
right, turning a typed line into a note, a thought or whatever it reads as;
a list should be written into by a notepad on top of it, the **Quick list**,
rather than a box built into it; where a notepad's things go should be easy to
see and change, perhaps by **tying things with string**; a phone scroll cut off
the icons under its paper; a list's name should not take a whole row; and the
Workshop had small changes. Built as decisions 255–258 (v2.49).

### Added 2026-09-29, evening — the counter family, the habit in three, Picture

Timothy: ruled paper's lines should sit under the words (the notepad most of
all), the pad less yellow, its gum strip a palette colour, and the pad easy to
pick up; more plants; Image and Picture are one object, Picture; the jar looked
goofy; a random book opened onto something nobody could read; habit trackers
should be compound objects, and Counter a category whose ticker and progress
bar can count *to* something and be complete there; Rename should be a small
field; the raised-band spine ran its bands through the title; the doodads'
hold should be the ring, their settings in Behaviour with a bigger preview;
and random generation should really be able to make anything. Built as
decisions 259–267 (v2.51).

### Added 2026-09-30 — tiles of five, the rigid swipe back, and a real zoom

Timothy: try tiles as 5×5, the desk starting as two tiles by three (10×15),
because it could help with tiling; now that the smooth scroll works, give
the rigid swipe back as an option, with a tool object that flips between the
two, placeable in the drawer front or on a board; zoom in and out of a board
smoothly and granularly, with no set zoom out to every tile (far enough out
is the whole board with the pluses, and further still puts you in the
container it is in); and a board setting for random checkerboard colours per
tile, the same on every tile staying the default. Built as decision 274
(v2.56). It is a trial: a container of one tile is five cells across now, so
what goes in one is at most five wide until a tile is added beside it.

### Added 2026-09-30, later — living with the zoom

Timothy: the crosses for taking a tile away were goofy and sat on top of
things; the zoom wants a gentle snap like the scroll's; knobs, text and a
portal's rim kept their size while the drawer grew ("a major bug"); a new
tile should click into place; and an empty slot should be just a plus,
thicker and fainter, with no outline or dotted ring, and only when unlocked.
Built as decision 275 (v2.61).

### Added 2026-10-01 — what it is for, honed

Timothy: Bureau is *"trying to do so many things at once"*, and much of its
dashboard side could now be an artifact made on the spot. So: what does it
actually do? Forty uses and sixteen objects were proposed; he approved
twenty-five uses and sixteen objects, renamed several (the brain dump is the
**Inbox**, the ledger is an **Automaton**, pneumatic tubes are **copper
pipes**, the lottery drum is a **pond**), and added a **garbage bin** that
deleted things fall into, with gravity, to be sifted. String is to work like
redstone. Automatons are fine *"as long as they are built with Bureau in mind
and integrate well."* The whole list, the constraints and the order to build
it in are **`docs/USES.md`**, which is now where "what now" is read from.

### Added 2026-10-01 — the objects are the grid

Timothy: with the smooth scroll in place there is no need for a board that is
carved out cell by cell; the checkerboard can be an expanse with a limit, and
where you put a thing is where it goes. Locked, the board turns to the
carcass so it looks presentational, and you can still look around. Built as
decision 285 (v2.75).

## Deliberately not next

- **Sync between devices.** It is real and it is coming, *after* the feature set
  feels complete. Export/import JSON is the bridge until then. Do not start it.
- **A native shell.** Also real, also after feature completeness. The
  dependency-free, build-step-free constraint exists partly to keep that cheap
  when the time comes, which is another reason not to relax it.

## Worth knowing

**He builds it on his phone.** 2026-09-30: *"I almost entirely am designing
this app from my phone with a Safari PWA. So that's going to be your primary
testing environment, less so desktop and less so Chrome, for now at least. It
should still be functional with that, but right now the proof of concept is
all being built through a Safari PWA."* Check a change in WebKit at iPhone
size first (`node test/safari.mjs`); the Mac and Chrome are second.

The smoke suite takes forty to ninety minutes in the nightly container, and
**Timothy has explicitly accepted that cost** because the run happens at night.
Do not water the suite down to save time.
