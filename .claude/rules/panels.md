---
paths:
  - "web/js/panels.js"
  - "web/js/sheet.js"
  - "web/css/chrome.css"
---
# Panels and surfaces

Panels, menus and bubbles; the object editor, the picker, settings and the When page; the reading and writing surfaces.

These paragraphs were the *How to work in this codebase* section of `CLAUDE.md`,
moved here whole and unreworded so they load when a file they are about is
opened rather than in every session (decision 175). A rule for this area goes
here; a rule for every area goes in `CLAUDE.md`.

**Nothing that reads as prose may be a flex container.** `.mini` was
`display:flex`, so a note with a `<b>` in it was dealt out into one narrow
column per bold word — invisible on a Mac, and a wall of vertical single-word
strips on a phone. `.rangerow` had the matching bug from the other direction:
`display:flex` at 0,1,0 against `.field label` at 0,2,0, so every slider in the
app was being drawn by the *label* rule, stacked and uppercased at 10px. It is
an explicitly placed grid now — name and value on one line, full-width track
beneath — and it states a specificity `.field` cannot beat. See decision 118a.

**A tile inside a `<button>` is a tile that falls out of its own cell.** A tile
renders its own `<button>`, and a button inside a button is a parse error the
browser fixes by *unnesting* it — silently, taking the layout with it. That is
why `.kindtile` and `.helditem` are `div`s with `role="button"`.

**The picker leads with stated categories, not with a tally.** `PRIMARY` in
model.js — the drawers first (Drawer, Sorting drawer,
Project, Life drawer, Goal), then Prose & Poetry, Checklist, Calendar, Collage,
Timeline, Note, Fragment, Label, Recipe, Achievement, Task, Progress bar,
Counter, Event, Image, Audio, Video, Decoration, Control, Spawner. Everything else is behind *Every other
type* and is still reachable by name, by shortcut, from the type builder and
from **every other type picker in the app** — `pickGroups(skipPrimary)` narrows
only the new-object picker, because narrowing what a type can *be* is a
different decision. No type is drawn twice on one screen. A container that says
what it makes still leads with that type wherever it sits in the order,
promoted into the row if it isn't a major. Adding a major is one name in
`PRIMARY`. See decision 130.

**Five of the majors are *categories*: you press them to be asked which.**
`family` on a kind is the list, and it leads with that kind where that is a
real thing to make — the first kind of note is a Note. **Note** (idea, thought,
problem, question, **quote**), **Prose & Poetry** (the old Book, renamed twice —
poem, novel, short story, essay, **script**; **Story is gone**, it was this with
a different binding), **Project** (film, novel, game, song, album, app, art
piece, trip, **script** — a thing you write *and* a piece of work, and
`inFamily()` keeps it out of the flat list either way), **Decoration**
(**window**: a decoration you can see through) and **Fragment**, which is the
only one that is *only* a question: `cat` marks it,
there is no generic fragment, and pressing it always asks. `familyPanel()` draws
the second screen and `inFamily()` is what keeps a member from being listed
twice — it is skipped from *Every other type* only when its category is itself
a major, so a family behind a door nobody can open cannot happen.

**Everything a type asks before it exists is in `newOfKind()`, once.** Pressing
a tile and typing its letter are the same act: the shortcut used to call
`create()` outright, so a sorting drawer made with `Q` skipped its own question
and landed as an empty front. `picksFile`, `asksTag`, `asksLife`, `asksDone`
and `family` all branch there, and every one of them reads `pending.cell`
first and puts it back — `closePanel()` clears it and the answer still has to
land in the cell you held. See decision 135.

**A picture opens onto the picture, and so does an empty one.** `isPicture(o)`
in `model.js` — it carries `media`, and `mediaTypeOf(o)` is `image`. That is a
property, so an Audio type states `mediaType:'audio'` rather than an empty media
field being guessed at as a photograph that hasn't arrived. The surface is
`openViewer(id)` / `S.viewId` in `sheet.js`, beside reading and writing; the
routing is at the **tap** — `tileTap`, `openObj`, the context menu — so
`openRead()` still means one thing and the Read button on a picture with words
in it doesn't bounce. An empty picture is a dashed mount on the board and the
file picker itself on the surface; `importImage()` calls `renderSheet()` when
the file lands, because the file comes back long after the button was pressed.
See decision 49.

**Three buttons off a card: When, Done and Due.** `SCHED_PENS` in panels.js,
drawn as sewing buttons. **A placed one wears a tab on its own day**, carrying
the same `data-schedpen` — so the drag, the tap-then-tap and `placePen()` are one
code path, and a date you put down is a date you can pick up and move. Anything
asking about the *lane* has to say `.schedpens` now, because the month has pens
in it too. There is **no `On` field**: the month had already drawn that day, and
`09/14/2026` cannot say where the 14th falls against the other two.
**Dropping one is what creates the deadline** — both
deadlines are opt-in traits, and `placePen()` adds the trait as it writes the
date, because picking a thing up and putting it down is one act. A **placed
button leaves the lane**: it is on the day it was put on, and a tray still
showing it was drawing the same fact twice. The carry is a **transform on one
rAF** — it was `left`/`top` plus an `elementFromPoint` on every pointermove,
which is a layout and a hit-test per event on a pointer that fires faster than
the screen. See decision 154. **Drag one onto a day, or tap it and tap the day** —
`G.type:'pen'` in gestures.js claims the press *without consuming the tap*, so
a finger that never travels falls through to the click that takes the button
into your hand. `placePen()` is the one writer for both ways, including that
dropping a button on the day it is already on takes it off. The ghost is a copy
carrying `pointer-events:none` (which is what lets `elementFromPoint` find the
day), and the day under the finger is asked of the document each frame — the
month is in a scroller and a cached rect goes stale.

**There are no date rows, and there must not be.** A button sitting on the 14th
says where the 14th falls against the other two and against the days the work
takes; `09/14/2026` in a field never could, and it is a second answer to a
settled question. The month is the readout. The work is a **highlighter stroke
drawn over the day**, with no blend mode: `multiply` is right on parchment and
invisible over the red deadline, which is the one day the run has to be seen
crossing. See decisions 125 and 126.

**Everything a task is weighed by is one page, called `When`.**
`schedulePanel(id)` — the name, the day it sits on, both deadlines, the
duration, the difficulty, the priority, the urgency they produce, the repeat
rule and the tags. **Repeating is opt-in** — it came off `task`'s attrs and is
offered beside the ranks, with migration 25 keeping it on anything already
running a rule. The chip **is** the answer, so it arrives carrying a rule and
the section asks no "Never / Yes" underneath itself; saying never is the one
button that takes the trait off. See decision 129. **A page, not a bubble**: a month grid and nine rows is a
sheet, and decision 27's "a question about one tile belongs beside it" was
right when this asked one question. **Tapping a task opens it** (`onclick:'when'`
in `CLICKS`) and *When…* on the long press opens the same one — one
destination, two ways in. The object editor is not a duplicate: it answers what
an object *is* (look, structure, traits), this answers what it is *worth and
when*.

The month is **always drawn** and carries four marks: the day it sits on
(yellow), the day you aim for (orange), the day it is owed (red), and the days
the work takes as a grey **rule along the top edge** — `workBand()`, reaching
back `duration ÷ workday()` days from the nearest deadline. That last one must
be an edge and not a fill: its final day is nearly always the deadline itself,
so a grey background loses to the red one and a three-day run reads as two.
Those four are the only colours named outright anywhere in the app — they are
signals, not slots, for the same reason `late` is red everywhere.

A rank is **one outlined mark with its number inside it** — a star for
priority, a teardrop for difficulty, the same two marks they are drawn with
everywhere else — and pressing it walks one to five and round to nothing. Five
marks filled to the answer is a picture of the *scale*, and the scale is not
what you want to see; decision 72's argument was against a **select**, which
hides the scale behind a word, and a mark carrying its own number hides nothing.
See decision 155. `PRIOS` still runs 0–5, because 0 is a real answer (decision
72) and the object editor's numbered row still offers it outright; the mark
prints a dash for "no rank", which covers both nothing-said and rank zero. What an object hasn't got
is one row of chips in the same page (`data-want` names the attribute), each
wearing its own mark.

**A test that asks whether the markup is right cannot say whether you can reach
it.** `reachable` in the smoke test presses the menu item, presses each chip,
ranks both scales, reads the urgency line back and checks the month's marks
against what the object carries; write that kind of pair for anything new that
has to be found. See decisions 122 and 123.

**A rule is a sentence, and the blanks are the controls.** *This drawer collects
[anything] from [anywhere] tagged [any tag] with [field] [is] [value].* Six
labelled rows told you six correct things and never told you what the drawer
would do; reading the rule and changing it are one act now. The joining words
are chosen not to agree with anything — "from", not "that are", which reads as
"anything that are". The **types** are grouped the way the new-object picker
groups them and folded behind the blank, with one button back to *anything*.
Making a sorting drawer lands you here. See decision 159.

**The reader is one column, and the keyboard is not a resize.** `--paperw` is
computed on `.bookstage` — not on `.book`, which is a sibling the title and the
bar cannot read — so the title, the sheet and the bar are one width that cannot
disagree. The header is **only the title**, two lines then clipped; every
control is in **one bar under the paper** (tools left, page turns centred, the
way out right, three grid columns so the turns stay centred). The paper is
sized and positioned from `--vvh`/`--vvt`, the *visual* viewport written onto
the root by `watchViewport()` in boot.js — `100vh` on iOS ignores the software
keyboard and `dvh` tracks browser chrome, not the keyboard. Letter proportions
are kept throughout: a keyboard gets a smaller sheet, never a different shape.
**The pagination ruler lives on `#frame`, not in the stage**, so it has to be
named in the same rule as `.bookstage` — without `--pageh` nothing overflows it
and a whole book measures as one page. See decision 84.

**A page is a sheet of the object's own paper.** `sheetOf(o)` in tiles.js —
the same `tx` and `st` readers `paper()` gives a tile, so a note that is ruled
on the board is ruled when you open it and re-dresses on an aesthetic switch
the same way. Two families, not three: a stock and a grain are what the sheet
*is*, an **edge** is the tile's frame on the board and a page has its own. It
goes on the **spread** — the spread is the sheet, two pages side by side are
one leaf, and in scroll mode the paper is what the column moves over rather
than something that moves with it (an absolute box inside a scrolling page
covers the first screenful and stops). The grain is a *sibling* of the pages,
which is why the one-column rule asks `:not(:has(> .page + .page))` and not
`.page:only-child` — `:only-child` is a question about the DOM, and the day
the paper arrived a single page was laid out in half the width. A ruled grain
does **not** line up with the text baselines and that is knowingly left: the
pitch is the aesthetic's and the leading is the reader's, and joining them
means one number across seven aesthetics plus the pagination ruler. Don't damp
the grain for reading either — see decision 105.

**Everything in the reading bar is one shape on one rhythm.** One `--bkgap`
for all three groups, one radius, one glyph size, and every mark centred in
its own box — `.readmode` is `inline-flex` because it carries a label, so it
needs `justify-content:center` or its mark sits hard left the moment a phone
hides the label. It is dressed as a chip on purpose: it is the one control
that is also a readout. The page count is **fixed width**, because it sits
between the two chevrons and a count sized to its own digits walks the button
you are pressing out from under your thumb as you page. See decision 106.

**The page you read is the page you write on.** Tapping the paper puts a caret
in it — the whole body, in the page's own face, however the page is broken up;
`clearPages()` when you put it down. The reading head is three things: the mode
as **one cycling button**, copy as a glyph, and Edit meaning the *object
editor*. See decision 82.

**Depth is its own door.** `Depth and light` in Settings — four headed groups:
*Looking in* (what the tilt moves), *Books*, *Drawer fronts* and *Both* (how far
any of it follows the phone). It was four rows at the foot of Appearance and is
now eleven, and "how solid does this desk look" is not "what colour is the
board". Every note in it is one or two sentences: eleven controls each with a
paragraph is a wall rather than an explanation.

**A panel asks one question.** A long one is a short list of **doors**:
`objectPanel(id, sec)` and `settingsPanel(sec)` are the *same panel under the
same key*, so a section replaces rather than stacks, and `spec.back` puts a
chevron in the head — the way out a replaced panel never had. The object
editor's top is the thing itself, its **type and where it lives**; its **tags
and links** are at the **foot**, just above the row of things you can do to it,
because what a thing is filed under and what it points at are the last things
you say about it and they were sitting above every door; the rest is four doors — Look, Behaviour, Collects, **Advanced** (its
fields and which traits it carries). Don't add a row to the top level unless it
is one you reach for constantly. See decisions 66 and 148.

**The name is the panel's own heading**, and pressing it turns it into an input
in place (`data-headname`, handled in wire.js). It swaps itself rather than
re-rendering the panel, because a rebuilt panel is a lost caret.

**Every row in Look is a cycle, not a select.** `pcycle()` — the answer is a
thing you look at, drawn six inches above it on the stage, and a `<select>`
covers the preview with a list of words you have to imagine. It writes through
`setField()` like every other row, so undo and the refresh come along. Rows that
are lists of *behaviours* keep their select. A slot family's back door — the
other aesthetics' answers — is a chip with a brush on it beside the cycle, not a
full-width labelled disclosure: five slot rows meant five of those. The Look
rows are in **one order whatever the thing is**, so the row you want is where it
was last time. And **the editor closes an open surface** rather than opening
behind it: whichever you opened last wins, in both directions. See decision 148.

**There are no modals — a menu is a panel.** `openPanel(spec)` in `panels.js`
is the whole system: one panel at a time, down the right, over a desk that stays
visible and stays live. Settings, the type picker, the type builder, the drawer
form, Move to drawer, Link to, Attributes and object/drawer settings are all the
same thing. Panels are appended to `#frame`, *outside* `#app`, so `render()`
leaves them alone. See decision 23, and don't bring back a centred card on a
scrim — a menu that covers the answer to the question it is asking is the wrong
shape.

- `spec.body` is a **function**, not a string, so `refreshPanel()` redraws from
  state. That is why no handler rebuilds a panel by hand any more.
- `spec.key` names which panel is up (`panelKey()`), for the two places that
  care: the type-shortcut keys only fire over the picker, and the settings
  auto-refresh listener only fires over settings.
- A form's draft lives in the `PANEL` object, read with `draft()`, never on the
  DOM node — a redraw would lose it.
- A surface claims the same screen, so `renderSheet()` closes any open panel.
  A surface is the bigger claim.
- `spec.anchor` and `S.openId`: `objectPanel(id)` sets `S.openId` to the object
  it is about, which is what every `byId(S.openId)` handler in `wire.js` acts
  on. `closePanel()` clears it.
- The command palette (⌘K) is the one thing that kept a scrim: it is a search
  field you summon and type into blind, not a menu about what is in front of you.
- `spec.anchor` — an object id or an element — makes the panel a **bubble**
  beside that tile instead of a slab down the edge, on whichever side has room,
  with a tail pointing back at it. Object and drawer settings use it. A question
  about one tile asked from the far corner of the screen makes you look away
  from the thing you are changing; a question about the *desk* (settings, the
  type picker) belongs on the edge and shouldn't take an anchor. With no room
  either side — a phone — it falls back to the edge panel by itself. See
  decision 27. `repositionPanel()` runs at the end of `render()`, because the
  tiles move and the bubble is pinned to one.

**A list of choices is a popup, not a panel.** `openMenu(anchorEl, html)` borrows
the context menu's element and hangs it under the button that opened it — that is
what Sort does. A panel is for a form; a popup is for picking one of a handful.

**A type is drawn as the thing it makes.** The type picker and the type builder
both go through `sampleTile()`, which renders a throwaway object with the same
`gridTile()` the board uses — at desk scale, then CSS-scaled down. Full size and
shrunk, never drawn small: type sizes inside a tile are in px, so building one
at 11px a cell wrapped "Drawer" onto two lines. A miniature has to be the real
thing seen from further away or it is a preview of nothing. The sample never
enters `S`.

**There is one object editor, and one place words are written.** A container is
an object with children, so `objectPanel(id)` answers for objects, containers
and the desk alike — `drawerPanel` is an alias for it and the old drawer *form*
is gone. Everything that used to be on the detail sheet is in there: fields,
milestones, a streak, tags, relations, traits, its mark, how big its words are.
The words are the other half, and they get their own surface — `openWriter(id)`
full screen, or a double tap on the tile for a name and a line. Don't
reintroduce a form that is both. See decision 36.

Its button is a **paintbrush** (`ic('brush')`); the gear is the *app's* settings
and belongs to the desk alone. At the top of the body — and **again at the
top of Look**, which is nothing but rows that change how a thing looks — is
`objectStage(id)`: the object drawn through the same `gridTile()` the board
uses, on a checkerboard scrolling diagonally, because a panel covers the tile it
is asking about and on a phone it covers the board. The desk gets none, because
a desk is a container without a tile. See decisions 51 and 97. It draws a **clone**: id `__stage`, box moved to
`{x:1,y:1}`. A second element carrying the real id is one the drag, `anchorEl()`
and `tileOf()` could all pick up instead of the tile, and a box at the object's
real `x` lands in a column the preview grid hasn't got — which draws an empty
floor and looks like the stage is broken. See decision 51.

**A one-of-many list is a `<select>`; a many-of-many is chips.** Forty types and
twenty shapes as chips were four hundred pixels you had to read like a wall. New
settings go in as `psel()`; if a group is genuinely multi-select, put the chips
behind a `pgroup()` disclosure.

**Full screen means the screen.** The expand under the camera hands the object
to the reading surface with `S.readFull`, and that is now the whole screen —
the stage loses its inset, the title goes, and the bar becomes two things
floating over the page: the way out at the top right, and the page turns at the
bottom centre and **only in book mode**, where a Mac has no other way to turn
one (a surface owns the keys while it is up and `boardKey()` bows out). The
pinch that closes any surface closes this one. See decision 191.

Three things travel with it and every one of them fails silently:

- **The ruler takes the same class and the same numbers.** `pagesOf()` fills an
  offscreen `.bookruler` until a block stops fitting, so a twin measured
  against the letter-shaped sheet breaks a full-screen page for a box it is
  not — which nobody notices until they count the pages. The stylesheet names
  `.bookruler.fullbleed` beside `.bookstage.fullbleed`, and `S.readFull` is in
  the cache key for the reason the window size is.
- **Both boxes are stated in lengths, never per cents.** The ruler is an
  absolutely positioned offscreen box with **no size of its own**, so a `100%`
  height inside it resolves against nothing and the twin shrinks to its own
  contents: it came out 40 by 56 against a 390 by 844 page, nothing ever
  overflowed, and a whole body measured as one page. The stage is exactly the
  viewport, so saying the viewport twice is saying one number.
- **Full screen is one column**, whatever the object would do. Ask
  `spreadNow(o)` and never `spreadOf(o)` from a reader: the two were asked
  separately, which is how a body came to be broken for two columns and drawn
  in one with half of it unreachable.

And the column keeps a **measure** — said in the page's own padding, the way
scroll mode says it, because a percentage there resolves against the page's
width and one declaration centres every block at once. Full screen is the one
place where the paper stops holding the line in for you.
