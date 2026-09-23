---
paths:
  - "web/js/tiles.js"
  - "web/js/active.js"
  - "web/css/board.css"
---
# Tiles

How a tile draws: fronts, knobs, spines, panels and grains; the faces (checklist, calendar, collage, cover, card, control, bar, spawner); sizes, words and depth cues.

These paragraphs were the *How to work in this codebase* section of `CLAUDE.md`,
moved here whole and unreworded so they load when a file they are about is
opened rather than in every session (decision 175). A rule for this area goes
here; a rule for every area goes in `CLAUDE.md`.

**A tile shows less as it gets smaller.** `sizeClass()` in `tiles.js` stamps
`sz-short` (h≤1), `sz-thin` (w≤1), `sz-narrow` (w≤3) and `sz-mini` (1×1) onto
every tile, and the stylesheet only ever *takes away* what there is no longer
room for — a tile crossing a threshold loses a line rather than rearranging
itself. 1×1 is handled in `gridTile()` rather than in CSS: the tile is the type's
mark and nothing else, because at 40px a title is three letters and an ellipsis.
A drawer front at `sz-short` **or** `sz-thin` reaches the same answer from the
other side — the name goes and the mark sits over the knob — and it does it in
CSS, off a `.dmark` the plain front always renders, so the rule cannot take the
name off a checklist that happens to be short. The name ran *up* a thin tall
front for one version and came out **turned right over** on the device it
shipped to: `writing-mode:vertical-rl` plus `rotate(180deg)` is the spine's
pair, and either one of them not taking leaves the other doing the whole job.
A name printed upside down is worse than no name. So what a one-cell-wide
drawer says is what *kind* of drawer it is, and a thin container is still a
drawer — only `face:'spine'` makes one a book. See decisions 190 and 192. The classes are spliced into the first `class="` of
whatever `drawTile()` returns, so a new branch gets the behaviour without being
told. See decisions 26 and 50.

**A tile prints words, not markdown source.** `plain()` in `util.js` takes the
marks off and keeps the writing — not `md()`, because a face is not a page and
a `<ul>` in a 40px band is a bullet and half a word. `.tiletext` is `pre-line`,
so a note printed on a tile keeps the paragraphs it was written with. This was
wrong for a long time and every type that ships a body template was putting
`**` and `##` on the desk. `oneline()` is the same thing flattened, for a band.
Titles are *not* reduced: a name is edited in place as raw text, and showing it
differently from what you type in is worse than an asterisk. See decision 68.

**A body fills the face it is printed on.** `.tiletext` is `height:100%` inside
a `.dbody` that is `flex:1;overflow:hidden`, so the tile's own height is what
decides how much shows. It carried `-webkit-line-clamp:4` for a while, which is
why a note six cells tall printed four lines and left the bottom half of its own
paper blank — the clamp was doing a job the box already does. `BODY_ON_FACE` in
`tiles.js` is the character cut, and it is deliberately larger than any face can
show. Cut the text *then* escape it: slicing the escaped string cuts through an
`&amp;` and prints the entity.

**The seam is the tile's, not the knob strip's.** `<i class="dseam">` hangs off
the tile and runs `top:-1px` to `bottom:-1px` — the whole height, overshooting by
the front's own border width so the line cuts *through* the border at both ends.
It is the gap between two doors and a gap goes all the way; it used to live on
`.dfoot::before`, which on a `knb-bottom` front is the bottom third of the tile,
so the seam was a scratch down one panel.

**A knob is turned out of the same wood as the front.** `--knob` defaults to the
drawer's own colour and what makes it a knob is the *light on it* — a radial
highlight at the upper left, a shaded underside, a contact shadow — all in
`.pull`, so every shape gets it. It used to be a flat disc of a lighter shade,
which is a sticker rather than a handle and gave every drawer a colour nobody
had chosen. `knobtone` (lighter/darker) and `knobc` (a colour outright) still
override, in that order.

The light is a **highlight, not a coat of paint**: the lit spot is small and the
body of the knob *is* the front's colour, falling away into shade on the far
side. The first pass ran the white mix out to a third of the radius, which is
most of the face lightened — and a knob that is a paler disc of the front is the
sticker this was meant to replace, wearing a gradient.

**A drawer front is worked, and the working is a *slot*.** `panelOf(o)` — per
object then per type — stamps `pn-<name>` and the rest is CSS. The five keys
(`plain`, `cockbead`, `fielded`, `reeded`, `ogee`) are **positions**, not
descriptions, exactly as the seven `bd-*` are: what is stored is the position,
and each aesthetic names and dresses its own. Position 2 is Victoria's raised panel,
Carca's ashlar block, Golf 97's group box and Stelaine's floating slab — so a
front re-dresses on a switch and is itself again when you come back. Ask
`panelSlots()` for the names, never `PANELS` (that is the fallback and it is
Victoria's words). Don't rename the keys: the stored value surviving a switch is
the entire point. See decision 93.
Two rules carry all five, and they are the spine's generalised: **a multi-stop
gradient across a narrow band reads as a half-round**, and **a moulding is a
fixed thickness at any size** — px thicknesses, proportional insets, so a wide
drawer gets more reeds rather than fatter ones.

**One light, at the upper left**, because that is where `.pull` puts its
highlight. A cockbead therefore needs **four gradients, not one turned two
ways**: the bottom bead is lit along its *top* edge and the right bead along
its *left*, and one profile mirrored lights them on their outer faces instead —
a rim lit from four directions, which reads as glass. Each side also carries
the **quirk**, the shadow line where the bead meets the field, always on the
inner edge. Nothing here invents a colour: the wood is `--c` and the light and
shade are white and black at low alpha over it.

The moulding is `<i class="dpanel">`, **a real element**, because both
pseudo-elements are taken on a drawer tile (magic frame `::before`, texture
`::after`) — which leaves it two of its own. It sits under the texture on
purpose, and a magic front asking for an ogee gives up its gilt lines: two gilt
frames on one drawer is a picture frame shop. See decision 88.

**A grain is a slot, and it lives on an element.** Six positions — `none`,
`fine`, `weave`, `wideweave`, `herring`, `wash` — named and drawn by each
aesthetic (Carca's hurdle, Stelaine's aurora, Golf 97's chevron, Aeros'
gloss sweep). The last three used to be `ruled`, `speckle` and `pattern` and all
three were **noise** — a hard rule, a field of dots, a lattice of figures, each
a drawing laid over a tile that already has a colour, a moulding and a knob to
say. Migration 34 rewrites them, on **both sides of a pin** (`golf97/speckle` is
a legal value). Two `repeating-linear-gradient`s at opposing angles do *not*
make a herringbone — they cross everywhere and draw a lattice however they are
offset; four corner triangles with the left pair shifted half a cell do. See
decision 164. There were eleven global names for a long time, which is a list
of *pictures* rather than a vocabulary and meant cut stone and a 1997 dialog
wore the same graph paper; migration 24 folds the eleven in. Ask `textureOf(o)`.

It is drawn on `<i class="dgrain">`, not on the tile's `::after`, because an
object cannot spare that pseudo-element — half the object shapes are already
spending it. The weight travels as `--txo`: the container rule is three classes
and used to win the argument outright, so every opacity written on a `tx-` rule
was dead from the day it was written.

**A texture is printed on the front, so it goes under what stands on it.** The
depths on a drawer front, bottom to top: `.dpanel` and `.dgrain` (0), the knobs
(1), the name (2), the mark and the seam (3).

**A book wider than it is tall is lying down.** `lying` in `drawTile()`'s spine
branch — the same test a cabinet answers from the other side (decision 54):
which way round it is, never how big. One class over the *same three elements*,
so every binding transposes for nothing; the block in board.css is a
transposition of the standing one, and neither of the spine's two laws (a
multi-stop gradient across a narrow band is a half-round, an ornament is a
fixed thickness at any size) needed changing. The round back is along the
**bottom** — that is what looking down at a book on a table shows — the
lettering takes the drawer front's size rather than the spine's, and the
roll-off answers the vertical eye (`--f`) with the cylinder's inversion. A 1×n
can never reach this, so decision 50's fallback is safe. See decision 124.

**A container one cell wide is a spine, whatever face it asked for.** The title
runs up the tile, the way it does on a book on a shelf — `box.w<=1` is part of
the spine branch's own condition in `drawTile()`, which is why it sits above the
checklist and the calendar rather than after them. One cell *square* is still the
mark and nothing else, handled earlier: at 40px a spine has no length to set a
name along. A magic one gets `magicspine`, which gilds the two bands it already
has rather than the frame every other magic front wears — inset 5px on a tile one
cell wide is the whole tile.

**A background layer's per cent resolves against the container *less that
layer*.** The ribbed spine's gilt fillet was a 1px-tall layer at the same per
cent as its 9px hub, so it sat about a pixel and a half low on every band of
every book — the same number, two different boxes. Give both layers the **same
size** and put the gold inside the hub-sized one, and they cannot come apart.
(The lying spine also needs the *turned* gradient: a 180deg shade in a 9px-wide
full-height strip runs along the band instead of across it.)

**A spine is bound, and the binding is five choices — three ornaments and two
backs.** `bindingOf(o)` — per object then per type, like a knob or a border slot
— stamps `bn-<name>` and the rest is CSS: `plain` (cloth), `banded` (gilt rules,
the default), `ribbed` (raised hubs with a fillet down the middle of each),
`flat` (a square back) and `chamfer` (a bevelled one). Under the first three the
back is **round**, which is seven stops of one horizontal gradient and most of
what makes it a book rather than a coloured rectangle; the last two are the one
thing a binding is otherwise forbidden to restate, and changing it is what they
are for. A chamfer's gradient stops are **hard** — one that eases is a round
back again. See decision 152.
**Ornaments are a fixed thickness and a proportional position** — a cord is the
same width on a pamphlet as on a folio, so every thickness is px and every
position %; 5.5% hubs were four grey belts across a tall spine.

The part that breaks is the *lettering*, not the ornament. The title runs
vertically inside a `<b>` whose height is its inline length, and that `<b>` is
the measuring frame — without a definite height `text-overflow` has nothing to
measure. **Both places that draw a spine must wrap the title** (the container's
face and the `sh-spine` object shape); one that forgets prints its title across
the book. The three panelled bindings shorten that box, so their lettering is a
step smaller — which is true of the real thing and is what lets a title that
fills a plain spine still fit between two hubs.

**A spine's lettering is chosen against the cover, by contrast ratio.** It is
the one piece of type printed straight onto an object's own colour, and gold is
a *mid* tone — so it hides on a pale cover and a mid one alike, and `isDark()`
cannot answer "can this be read". `spineInk()` in tiles.js hands the stylesheet
`--spineink` and `--spinegilt`; `readsOn()`/`contrast()` in look.js are the
primitives. It burnishes the gilt **bright** on a dark cover and deepens it to a
**bronze** on a pale one — the metal changes, not the design.

**A vertical title has to be told to centre.** `text-align:center` on the `<b>`,
and it is not optional: the flex box around it centres the *box*, which is
already full height, but where the line sits **inside** that box is
`text-align` — and the default `start` is the *top* of a `vertical-rl` box,
which `rotate(180deg)` then flips to the bottom. So a short title on a tall
spine sat on the tail, and no `align-items` could reach it. A fit test cannot
see this: the length is right and only the position is wrong, which is why
`everyTitleIsCentred` measures the text run's centre and not just its length.

**Take the best candidate, never the first that passes a threshold**, and never
narrow the candidate set by a side test first — both are the same bug, and both
shipped once. A pass/fail test swaps cream for near-black on a mid cover and
*loses* contrast; choosing the candidates by `lum < 0.5` means a cover at 0.46
never sees the bronze that would have doubled its ratio. Offer everything, take
the max. Guarded as `spineReads` across eleven slots times four styles. See
decision 87.

**An object is paper, and paper is in the system.** `.otile` had exactly one
per-aesthetic rule in the whole stylesheet: every note in Golf 97 was the same
tile as every note in Victoria. A drawer is wood — colour, edge, panelling,
knob, grain; an object is the same list minus the hardware, plus a **stock**,
which is what the sheet *is* as against what is printed on it. Ask `paper(o)`
in tiles.js for the three classes. `borderOf()` falls back to `panel` for a
container and `plain` for an object, which is structural rather than a branch
on a type's name.

**Two layers under every tile, and they are real elements.** `<i class="dpanel">`
(the moulding on a front, the mount on an object) and `<i class="dgrain">` (the
grain), spliced into whatever `drawTile()` returned — the same trick the size
classes use, so a branch nobody has thought about gets them. They had to become
elements because a tile's own `::before` and `::after` are spoken for several
times over on an object: the gilt frame takes one, and the index card's red
margin, the habit's bar, the idea's folded corner, the tab and the chit take the
other. They are also the only surfaces the drawn-line filter may touch. See
decision 99. A **third** joins them inside the shelf — `<i class="dside">`,
below.

**How much of a face you see is where the thing stands plus where your eye is,
and only the second moves.** Every tile that stands proud carries `--px`/`--py`
— its centre against the board's, −1..1 — written once per render by
`perspOf()` in tiles.js. Stand in front of the middle of a bookshelf and you see
the right side of everything to your left before you move at all; that is the
resting answer. Turning the phone adds `--tiltx × --turn` to it in `.dside`'s
`--ex`/`--ey` — the same `--tiltx` that slides the board, so the faces and the
board cannot disagree about which way you are looking — and `--turn`
(`S.look.turn`, 0–100) is how much that counts. **Every face is a `transform`
on a promoted layer of its own**: that is the whole performance argument. A
face that follows the phone changes on every frame, and a version that changed
a `background-size` and a `box-shadow` — paint — cost 21fps across a board. A
`scaleX` on a composited layer costs the compositor and nothing else, and a
120-frame sweep still does **0 layouts**. The one exception is a spine's
cylinder, a `background-position` per frame, allowed because a board has a
handful of spines; don't give the same treatment to anything there are fifty
of. Never move a face by anything that paints.

**And it is its own setting — two of them.** `S.look.depth` is the drawers,
cards and pictures and `S.look.bookdepth` is the books; px, zero is off on
each, and `standsOut()` asks per tile which slider it stands under, so a board
can have the books turning and the drawers flat and draw no layer at all on the
drawers. Not the tilt's: the perspective reads with the desk sitting still, so
have it without the tilt or the tilt without it. Two rather than one because a
flank and a roll-off are different surfaces and one number was a compromise
between them — the books looked right and the drawers only technically worked.
A spine **redeclares `--deep`/`--deepy`** from `--deepbk`/`--deepybk`, so the
head and tail bands and `--spinerun` go on reading the property they always
read rather than needing rules of their own; `--bkshade` is the roll-off's
weight, because on a cylinder the shade spans half the spine at any depth and a
width cannot say how far round it has turned. Within each, one number:
`applyLook()` derives the top-and-bottom band from the flank so the two cannot
disagree. See decision 117c.

**And a drawer's depth is light on its face, not a face on its side.** The
flank is honest geometry and nearly invisible — a front's character is the
moulding, the knob and the grain, and a band of grey down one edge is not part
of it. Six more cues, each **one number 0–100** in `S.look` with every property
derived from it in `applyLook()`: `arris` (a two-pixel eased edge, the one that
reads most like a drawer), `facelight` (the face lighter on the edge turning
towards you), `facesweep` (the spine's specular on a flat front — wide, because
narrow and bright is decision 42's foil), `recess` (the *opening's* depth: the
desk's lip shading the front), `knobturn` (the light on the knob moves, the wood
does not) and `fieldshift` (the panel's field sliding in its moulding — the only
real parallax of the six). **Every one is a transform or an opacity on a
promoted layer**, which is the condition of their existing: 0 layouts and no
repaint across a 120-frame sweep with all six on. Zero is off and off costs no
element — `faceLayers()` gates per tile. They go to things with a face at the
same `FLANKED` line the flank uses; not to a book, which has its own answer, and
not to paper. There is **still no cast shadow**, now for a structural reason as
well: `.drawer` is `overflow:hidden` with `isolation:isolate`, so nothing drawn
inside it can reach the board behind it. See decision 118.

**Which way round a cue runs is a setting, one per cue.** There is no single
right sign for all of them — a flank and a roll-off are opposite by geometry, a
field set back behind its moulding slides against the frame in front of it, a
specular follows your eye while a shadow runs from it — and a wrong one is
invisible until it sits beside a right one. `CUE_DIR` in model.js is the
baseline, `<key>flip` reverses it, and `applyLook()` writes `--sgn-<key>` off
the key. Every rule reads **its own** eye: each layer declares `--e`/`--f` and
nothing under it touches `--ex` again — on the layer and not the tile, because
a cue that is off has no layer and the choice then costs nothing. Two baselines
are deliberately not the geometry: the **flank** now runs the book's way rather
than opposite it (reversing half of 117b — a desk that reads as one object beat
a desk correct in six places separately), and the **field** slides the other way
from how it was first written. The board's own slide stays out of the table:
`tiltflip` has said it since decision 114. See decision 119.

**A decoration gets none of it, and thickness is the wrong test.** An ornament
wears no tile at all (decision 86), so there is no box for a side face to belong
to — the flank drew a hard grey rectangle round a cut-out plant. *Having a box*
is the test. Same for `sz-mini`, where eleven pixels of flank on forty is a
quarter of the tile, and `.dpanel` already bows out; and for a tile in your
hand, which still carries the `--px` of the cell it came out of. The numbers and
the layer are one condition (`standsOut()`), so a tile cannot carry one without
the other.

**`.dtop` is two different things, and the depth face comes first.** A drawer
front's name row is `.dtop`, and so is the *top* face of the flank inside
`.dside` — which sits earlier in the DOM, so `querySelector('.dtop')` on a tile
finds the face and not the name. The CSS is safe (`.dside > i` and
`.dmark ~ .dtop` are both scoped by structure), but anything reading a tile by
hand wants `:scope > .dtop`.

`.dside` is the third spliced layer and it carries all four faces of a tile: its
two pseudo-elements are the upright ones and two children (`.dtop`, `.dbot`)
the horizontal ones, each `scaleX`d or `scaleY`d by `max(0, ±--ex/--ey)` so a
face is drawn only from the side it can be seen from. They were inset shadows
for one version — cheaper in elements, but a shadow is paint and cannot follow
the phone. `depthOf(o)` is the multiplier and paper (0.18) gets
no layer at all. One light, at the upper left, the same one `.pull` has always
had — so both sides are darker than the front and the left one only less so; a
face lit *brighter* than the tile reads as glare on glass. A spine gets no flank
but it does get shade: its two upright layers are soft roll-offs half the spine
wide (a cylinder has no edge for a face to end on), and **their sign is the
box's inverted** — your eye moving left shows a box a new surface in shade, but
turns a cylinder's left side *towards* you, so its shade grows on the right. The
specular underneath (`--spinerun`) goes the same way. See decisions 117 and 117b.

**A custom property resolves where it is declared, not where it is used.** The
cast shadow was going to be the third cue — `--shx`/`--shy` on a tile, fed into
the `--shadow` that board.css builds — and it did nothing whatever, silently,
because `var()` inside a declaration is substituted on the element the
declaration is **on**: a `--shadow` declared at `:root` takes root's `--shx`,
which is unset, and every tile inherits that already-resolved string. Declaring
`--shadow` on the tile would work and would beat the Shadows switch's own zeros,
which is the trap two paragraphs of this file already name. Don't reach for this
pattern; it is not lazy substitution.

**When a number will not hold still, measure something that has to.** The fps
sweep in this container drifted far enough under contention that one
configuration read 59 and then 53, and one run had three cues cheaper than one
of them. Style-recalculation and layout **counts** are deterministic where
clocks are not — contention changes how long they take, never how many there
are. Decision 101's discipline still stands for filters; this is the estimator
to use when the machine is noisy.

**A fragment wears the tear until it says otherwise.** `tornOf()` reads
`o.shape` first and only then the family, so picking another shape for a scene
takes the tear off. Before that it was an `||` with no way back and every
fragment was torn for ever.

**A Label is a caption on the grid.** Four cells by one, gilt frame, words set
large because they are read across the desk — and it is what gives `sh-band` a
job, a shape that existed with no rule behind it. **An Event is a diary leaf**:
weekday over day over month on a block of its own colour, torn along a
perforation, the name beside it and under it how long it runs. It knows a *day*
and a *duration* (or a run of days, since it carries `span`) because Bureau
stores a day and never a clock time — that is the design, not a limit. See
decisions 161 and 162.

**A checklist face is a stack of task-sized lines, and it refills itself.** One
line per cell of height on a **phone** and two on a **Mac**, counted out by
`--clrows` from the box being drawn. The density is answered **per device**
(`clFit(d)` / `setClFit(v, d)` in model.js): the cell is the same fifty pixels
on both and the *screen* is not, so two to a cell is a good Mac front and a
twenty-four-pixel task on a phone. A bare stored word means both, which is what
every desk saved before this holds. See decision 140, as amended.
Each line is drawn the way the task tile is — paper and ink (the same `--dink`
remap `.otile` does), the task's own 38px box and name type — and what says the
stack is one thing rather than three loose tasks is the **magic drawer's gilt
frame**, worn by every checklist face because a face that refills itself has
earned it. Done lines don't print:
the front is the next few things to do, not a record (inside, `keepsDone()`
still keeps them), so ticking a line pulls the ones under it up a row and the
next thing inside steps onto the bottom — `clRefill()` in motion.js draws that
shuffle *after* the render, never instead of it. A face with nothing to show is
a label again — name and a quiet line — which is also what the type picker's
sample is. See decision 79.

**The add box is opt-in, and even then it can go by itself.** Ask
`showsAddBox(c, box)` for the front, not `takesTyping(c)` — that answers whether
a container takes dictation at all. The box is off unless `addbox` says
`'show'` — on a checklist face it costs a whole task-sized line — and off
regardless at two cells tall or less, where the line is worth more as an item.
Inside the container it is always there. See decisions 77 and 79.

**A project's cover is a slot, and a placeholder is not a fallback.**
`projCoverOf(o)` — per object then per type — says which cover the project face
wears: `film` a poster, `album` a sleeve, `song` a record, `game` a boxed case
with the platform's strip down the left, `app` an icon squircle, `art` a
canvas, `novel` the spine it already had, `trip` the ticket. A picture on the
object is always the cover; with none, each kind draws its **own** placeholder,
because an empty film should read as a film you have not made yet rather than
as a project you have not filled in. Three depths on a cover tile and they must
not be guessed at — the cover at 0, the scrim at 1, the report at 2:
`.projtile > *` lifts every child into the positioned layer, which had been
silently overriding `.projcover{position:absolute}` for as long as that line
has existed.

**A goal is a playing card, and what it is *called* is read rather than
stored.** `goalStanding(o)` — no deadline is a **dream**, thirty days or fewer
is a **challenge**, anything else is a goal. Derived, so putting a date on a
dream makes it a goal without re-declaring it and a slipped date cannot leave a
Challenge lying about itself. It is drawn as a Bicycle card and needs all four
of the things that say card: a **heavy corner radius** (the one exception to
decision 125, and a *proportion* rather than a token, because a card is die-cut
that way), the **linen tooth**, a **ruled panel** in the goal's own colour, and
an **index in two opposite corners with the second upside down**. The face is
the card's white — a card's colour is the ink on it — so `--c` moves to the rule
and the index. Its default box is 3×2, a card laid down. The name is still the
face and the run is still a hairline along the bottom, never a bar. See
decision 146.

**A life drawer wears an object, and a picture beats the drawing.**
`lifeArtOf(o)` names one of the nine in `LIFE_ART` (decor.js, beside the
decorations and drawn the same way); an object carrying `media` wears that
instead, which is where this is meant to end up. No front at all on that face —
no panel, no knob, no border — the thing lies on the desk with its name on a
small label. `makeLife()` in wire.js is the one place the answer lands.
See decision 136.

**A control has three forms and `ctlForm()` reads the table, never a name.**
Two states is a **switch**; more than two is a **button that changes colour**,
stepping the aesthetic's own eleven slots, because a list has no lever position
to be at; a `range` is a **dial**, 270° of sweep with a stop at each end.
`cycle().length<=2` and not "has a cycle": a two-value list is a switch wearing
a list. Pressing a dial is one detent of ten and wraps. See decision 137.

**At one cell wide there is no room for a name or a printed value, so what is
left has to be the hardware.** The stylesheet takes both away there, and for two
of the three forms nothing was left: a **button** had no lever to fall back on
and a **dial** lost its knob with the words, so both drew a blank tile. A button
draws its stepped-colour push disc (`box.w<=1` in tiles.js) and the dial keeps
its knob. That was "the control turned invisible when I set it to change
aesthetics" — not the aesthetic, the form.

**And a switch is a piece of hardware, so it comes in sizes.** `switchShape(box)`
— one cell is a **push button**, one cell in either direction is a **light
switch** (a plate with a bat thrown up or down), two cells each way and up is a
**two-pole knife switch** hinged at one end and closing into its jaws. All three
say their state by *position*, never by colour. The last two are inline SVG
rather than stacked boxes, because a blade at an angle and a tapered bat are
shapes; the knife's viewBox leaves room **above** the slate for the blades to
stand open in, or the only state that is not the default is clipped. **A control
wears no tile at all** — no ground, no edge, no shadow — because the plate, the
base and the button each carry their own, and a second one under them is what
made every control read as a sticker.

**A progress bar is blocks, and *only* blocks.** There was a continuous
`--pct` track on `.sh-bar`'s `::after` from before decision 138, and when the
blocks arrived it stayed — so every bar drew its number twice, the analog
reading lying across the bottom row of the digital one. `barSteps`, `barFilled`
and `barGrid(o, box)` in model.js: two increments to a cell of width, each a whole
cell tall, so a ten-step bar is five cells long without being told — and
narrower than that it **wraps** rather than shrinking the blocks. The columns
are evened across the rows, because a half-empty last row reads as broken
rather than wrapped. Pressing a block sets the bar to it and pressing the one it
is on steps back; a bar that names a `tracks` refuses the press. See decision 138.

**A spawner with its line showing is the add box, and so is the box at the top
of a drawer.** They are one machine — a mark you press, a line you write a name
in, one of a stated type comes out — and they were drawn as two things: a dashed
rule on paper inside a drawer, a solid pill of the object's own colour on a
board. The pill said *control* where what it does says *write here*. One look
now, **`.addline`**, in **one CSS block naming both selectors** so they cannot
drift; the tile's selector is four classes deep because
`.drawer.otile.gentile{background-color:var(--c)}` is three and `.drawer` owns
the border and the shadow — the trap that block's own comment names, met from
the other side. The colour did not go anywhere: it is in the **mark**. The mark
is drawn at every big size (a spiral in the left-hand cell was a badge on a
pill and is the head of an add box here), and the box at the top of a drawer
grew the half it lacked — pressing its mark makes one with no name, through
`spawnInto()`, so a sorting drawer still makes the thing where the drawer
itself lives. `.addpress` and not `.genico`: that class's `62cqw` is *the whole
cell*, which outside a query container is most of the screen. See decision 167.

**One cell square, the spiral still *is* the tile** — no ground, no edge, no
shadow and no stock, drawn in the object's own colour and filling the cell,
because a coloured square with a small mark on it is a button carrying a picture
of a button. The **line** is dropped only at one cell of *width* (`sz-thin`) —
above that the box is what the big spawner is for — and the `return` hint goes
one step sooner, at `sz-narrow` or `sz-short`, because a hint is what a small
tile can spare. Line and mark together are the whole of what the Text field type
was, so there is no Text field type: pressing and typing are two sizes of one
machine. The branch sits **above** the 1×1 branch in
`drawTile()` deliberately, or a spawner shrunk to a stamp would be an anonymous
mark. A seed may state its own box (`sz`/`phoneSz`), which is how a project is
born holding a band rather than a spiral.

The icon is eight half-arcs whose ends alternate either side of the viewBox's
centre line, so it is even by construction and reaches the edge; the old one was
four relative arcs starting a pixel off centre and wound off to one side. In a
**square** box (`gensquare`) the mark takes whatever height the line leaves, by
`aspect-ratio` and not by a width in `cqw` — a proportion of the width is the
wrong number in a column — and `.fieldin` has to restate `height:auto`, because
the base rule is `height:100%` and that is the whole tile.

**Nothing an instrument does ticks by re-rendering.** `active.js`, and this is
the rule the whole file is built on. A clock's hands and an hourglass's sand
are infinite CSS animations with a **negative `animation-delay` written
inline**, so they are already however far through they should be on the first
frame and cost no timer at all. A candle stores `litAt` and `burn` and the wax
is arithmetic done while the tile is built. Only the metronome needs an
interval, because a noise on the beat cannot be derived, and it lives in a
module map **outside the DOM** the way a playing sound does (decision 71), so
an unrelated render cannot silence one. `MINUTE` is one shared tick for the two
things that have to *finish* — an alarm and a guttering candle — started only
while something needs watching. Reach for the animation first, the timestamp
second and a timer only when there is no third answer. Sound is synthesised
through Web Audio: no files in `SHELL`, no dependency, and the context is made
on the first press because a browser will not start one before a gesture. A
**deck** is the odd one: an instrument that is also a container, so its press
cuts rather than opens (`isContainer(o) && !isActive(o)` in `tileTap`) and
everything else it does is what a container already did. See decisions 182
and 183.

**A string is a relation drawn on the board, and it is written in cells.**
`boardStrings()` in tiles.js, one SVG at `inset:0` whose viewBox is
`drawCols × drawRows` — so an endpoint is `box.x - shift.x - 1 + box.w/2`, the
same arithmetic a tile's own `grid-column` is, and the pins land on the tile
centres to the pixel on both devices. Built **before** the tiles, because
`gridTile()` takes each box out of `FLOW` as it draws it and a sorted board
would have nothing left to read. It refuses four things: an end not on this
board, a board that has let go (`gravityOn()` — every number here is read off a
box), the same pair twice, and a board with no relations, which returns the
empty string rather than an empty element per board. The casing is `--ink` and
not black, so it is a shadow on a light desk and a halo on a dark one from one
declaration; three passes and no filter, for the reason look.md gives. The
colour is `strc` on the end the string leaves from — a relation is an id in
somebody's `rel` and not an object, so there is nowhere else to put it. See
decision 178.

**A jar is a drawer you can see into, and its face is made of tokens.**
`faceOf(o)==='jar'` — the tile is the jar, so the drawer's ground, border and
padding come off and the silhouette is four elements: a lid, the glass, the
heap in it and the label across the front. Three rules. The heap has to **sit
still**, so a bit's position, size and turn are `jitter(id)`, a hash of the
object's own id, never `Math.random()` — a full re-render is the ordinary case
here and a random heap reshuffles on every one. The **fill is read off the
count and the bits off the fill** (`JAR_ROWS` caps it at seven rows), so sixty
things is a full jar rather than sixty overflowing bits. And **nothing keys on
the aesthetic**: the lid is `--brass`, the glass a wash of `--c`, the label
`--paper-2` with `--ink` on it. That last one is not taste — the specimen
book's Types section is drawn once, in the desk's own aesthetic, with no
`[data-sty]` wrapper for `chromePatch()` to re-point an `html[data-style]` rule
at, so a face keyed that way renders undressed there and nothing says so. A
face is not a slot family and cannot use the `<fam>sty-` escape decision 98
built, so tokens are the only way it survives that page. See decision 177.

**A collage is the board inside it, drawn small.** `faceOf(o)==='collage'` —
every child at the box it actually occupies, on the container's own columns.
A moodboard is an *arrangement*, and the old front re-packed it three to a row,
which is a picture of something else. A child that has never been placed gets a
synthetic box in flow order rather than being dropped (a face may not call
`ensureBox()` — that is a mutation), and something in it that is not a picture
is drawn as its own colour, because a wall with holes where the notes are is
not the arrangement either. See decision 134.

**A tile made of its own colour has to say so three classes deep.**
`.drawer.gentile{background:var(--c)}` is two classes; `.drawer.otile{background:
var(--paper-2)}` in chrome.css is also two and *later in the cascade*, so from
the day an object became paper (decision 99) the spawner rendered as a blank
sheet with white writing on it — silently, for versions. Write
`.drawer.otile.<tile>` and set `background-color`, never the shorthand: a stock
sets `background-image` and the shorthand would fight it for the grain and lose.

**A frame goes round a picture; a window goes in front of a view.** One slot,
`frameOf(o)` (per object then per type — never `o.frame`), holding six picture
frames and four window ones; `isWindow(o)` is the second group. A window is
painted in **`--c`**, the object's own colour, like everything else on a board —
it was `--wood`, which made every window walnut and the colour picker useless on
one. Its
muntins are their own element (`.wbars`) because they sit *above* the image and
a tile's two pseudo-elements are spent — drawn as gradients so a bar is a fixed
px thickness at any size and every position is a %. The view behind the glass
moves with `--tiltx`/`--tilty` and the bars never do, which is what keeps this
clear of decision 42: nothing is behind a photograph, so a picture frame stays
still. It is also the one place the parallax needs no argument — the frame *is*
the occluder the desk's own cavity has to imply. See decision 113.

**Two concentric corners are one radius and one inset.** The goal card's rule is
`max(0px, var(--cardr) - var(--cardin))`, and both read `--checkerx` — the
board's own two-cell step — rather than `cqw`. The card sets
`container-type:inline-size`, and **an element is not its own query container**:
`cqw` written on the card resolves against whatever container is above it while
the same `cqw` on `.cardrule` resolves against the card, so the two arcs were
being measured against different boxes and could not have agreed. The same trap
is waiting for anything else that sizes a container and its children together.

**A calendar face is a desk calendar until it is big enough to be a wall one.**
The face adapts to the box it is drawn in: one cell square is the tear-off day
pad (the month small, today large), one cell tall is the pad plus the next
thing or two, two wide or two tall is the pad over an agenda, three cells a
side earns the month grid, and twelve wide by six tall earns the planner —
titles printed in the day cells, the rest summed. Up to three cells a side the
gilt sits at the **rim** and the border slot sits out, the way a checklist's
does — `calBorder(o, snug)` in tiles.js writes both decisions. The pad always shows today
and carries today's `data-calday`, so a drop on a small calendar still dates
the thing; below the month the name rides on the tooltip, like the
checklist's. `calSoon()` in tiles.js is the agenda's order: late first, then
today, then next by date. See decision 80.

**A project is a drawer whose knob is a dial; the named kinds of work report.**
The generic `project` kind wears `face:'front'` — the drawer it is filed behind
— and `ringFor()`/`knobHTML()` in tiles.js burn a conic sweep round the knob at
`barPct()`, which is how far along it is read off the one part of a drawer your
eye already goes to. The named kinds (film, game, song, app, art piece) keep
`face:'project'`, because a film knows it is a poster before it exists. **No
bar on any of them**: a percentage was drawn twice and is neither the question
you ask a project across the desk nor an honest answer to it. What it holds and
what is next are what the face says, all read off `projectStat(c)`, which walks
the *whole* subtree once. `progressOf(o)` is the number: a container is its ticked
descendants, however deep, so a project made of four full checklists reads 100%
rather than 0%; milestones are the fallback for when it holds nothing tickable
yet. A project opens onto a **grid**, not a list, because it holds everything a
piece of work is made of. See decision 34.

**A ruled sheet's lines go under the writing, not across the paper.** The
`st-laid` ruling is painted on the **prose element** — `.tiletext`, `.contbody`,
`.page` — with a period of `1lh`, the element's own line box, so every rule
falls at the foot of a line by construction rather than by agreement between two
numbers. The sheet keeps the tint that says what it is made of. And the default
stock is **plain** in every aesthetic: laid was the default in five of seven,
which meant every note on a new desk arrived ruled. See decision 147.

**A tick box is a fact about the desk, and an object may argue.** Six shapes;
the desk's is `S.look.check`, written onto the root as `data-checks` by
`applyLook()`, and an object's own `check` is stamped as `ck-<shape>` beside the
size classes. The desk's rules are wrapped in **`:where()`** and the object's are
not — that is the whole mechanism, because `:where()` scores nothing and the two
would otherwise tie on specificity and let *source order* pick the shape. The
default is the **circle**, in every aesthetic, and the box is a fraction of a
cell (`--rowh`) rather than a fixed 38px, or the same box is 65% of a desk cell
and 95% of a preview's. See decisions 83 and 149.

**A mark and a text size are per object, then per type.** `iconOf(o)` and
`textSizeOf(o)`, next to `shapeOf` and `colour`. Never read `K(o.kind).ic` to
draw an object — that is the same mistake as reading `o.c`. Text size is a
*multiplier* written into the tile's style as `--tscale` (folded into `place`,
so every branch of `drawTile()` carries it), and the stylesheet restates each
size times it at the end of `chrome.css` — a name is 15.5px on a card, 11.5px on
a narrow front and 11px on an index card, and all three survive being read from
closer.

**A name is a thing you can tap, on an unlocked board.** `nameField()` in
`tiles.js` draws every name — a tile's, a list band's, a checklist line's — and
draws it as an `<input>` when it is the one being edited, so a thing that is not
a tile on a board can still be typed in. `data-edit` is the wiring; wire.js
checks the board's lock and calls `startEdit()`. Locked is for reading, so there
a tap opens what it lands on and a name is only a name. On a checklist front this
puts the tick on the **box** — the words are how you change it. See decision 61.

**The torn edge is a shape, and a fragment wears it without asking.**
`tornOf()` answers for `shapeOf(o)==='torn'` **or** `isFragmentKind(o.kind)`, so
anyone can pick "Torn edge" and a scene still keeps its punched page *and* its
tear — what makes a fragment is that it came out of something, not what it is
drawn on. See decision 161.

**A fragment is a piece torn out of something, and the edge says so.** Every
type under the Fragment category wears a **fuzzy crease-tear**: a near-straight
edge with a px-sized jitter along its whole length, not `sh-tornnote`'s chipped
bites. The jitter is in **px** so the fuzz is a fixed thickness at any tile size;
the line is four zero-blur drop-shadows off the element's alpha *after* the clip,
which is the one way to rule a clipped shape; and there are **three** silhouettes
picked by a hash of the object's id (`tornOf()`), because one polygon on every
fragment on a board is a repeat you can see. Which types these are is asked of
`isFragmentKind()` — the category's own `family` list — never of a name. See
decision 145.

**A note is a plain sheet, an idea is a note ruled round, and a thought is a
rounded card.** The note was torn — a chip out of each side and a drawn outline
following it — which is the most characterful tile on the board worn by the
type you reach for most. That machinery is still here as **`sh-tornnote`** for
the shapes that are genuinely torn. An idea's border is `var(--c)` and never a
named yellow: the type sits on slot 12, which is Victoria's Gilt and every
other aesthetic's answer to the same position. See decision 138.

**An edge of none still has to reach the edge.** `border-color:transparent`
leaves the border *box*, and a background **image** is laid against the padding
box — so a tile with no edge and a gradient painted a pixel short all the way
round and showed a hairline of board. A background *colour* never was, which is
why it hid: only spines and anything wearing a stock were short.
`background-origin:border-box` on `.drawer.bd-none` is the fix, and a spine
states its **shadow** back, because `bd-none` is forced onto it to suppress the
border *slot* and was taking the shadow with it. See decision 139.

**A shape with a torn edge still has a border, and it follows the tear.** A
`border` is drawn on the box, so `clip-path` slices it off at the notches and
leaves it hanging at the corners — which is why `sh-note` had `border:0`. The
outline comes from four zero-blur `drop-shadow`s instead, one per direction:
a drop-shadow is computed from the element's alpha *after* the clip, so the line
traces whatever the clip cut. Same filter chain as the real shadows, which is
also what stops a clipped tile from floating with none.

**No type draws a coloured left stripe.** A stripe down the left is what
`priority` means. `edge` is the opt-in, on any object; four shapes (`tab`,
`ruled`, `chit`, `pill`) are the answers a task has instead. `docs/BORDERS.md`
is the inventory of every edge in the app and which ones still belong to the
border system rather than to a shape.

**Under the camera a tile shows a reading face, and it takes the name row
over.** `zoomFace(o, box)` in tiles.js, spliced in the way the size classes are
so every branch of `drawTile()` gets it. It answers the empty string for
anything that is not words — an instrument, a picture, a control is already the
whole of itself and the camera just brings it close enough to use — and
`camreading` is only stamped when there is one. It carries its **own head**,
because a tile's name is drawn at the tile's size and is therefore magnified
into a banner lying across the words; the tile's `> .dtop` is hidden under it.
Everything in it is in `em` off one counter-scaled font size, and the three
numbers `pagesOf()` also has to know — the two paddings and the head's height —
are written onto the element as `--zpx`/`--zpy`/`--zhead` rather than said once
in the stylesheet and once in the script. Note the trap it walked into:
**chrome.css loads after board.css**, so `.spread .page`'s 14.5px type, relative
position and centred page number each beat a two-class rule here on source
order and had to be restated at three. See decision 187.

**The camera's two controls are counter-scaled, and they are not `<button>`s.**
`camTools(o, box)` writes `transform:scale(1/k)` inline with the corner as its
origin, so they land at button size whatever the object is magnified by. They
are `div role="button"`: a tile is itself a `<button>`, and a button inside a
button is a parse error the browser fixes by **unnesting** — silently, which is
why they did not appear at all the first time. Same reason `.kindtile` and
`.helditem` are divs.

**Writing under the camera is the board's own in-place edit.** `S.editId` was
already an `<input>` for the name and a `<textarea>` for the body, both carrying
`data-inline` so one handler in wire.js writes the field as you type; zoomed it
is the same two fields at the counter-scaled size. Nothing new was needed but a
way to reach it — a hold longer than the board's own (520ms in gestures.js),
because the finger is resting on words it may be about to push.

**A digit's advance is about six tenths of its font size.** The counter fills
its tile by dividing the available width by the digit count *times 0.62*;
dividing by the count alone makes a three-digit counter half the size it could
be. `--digits` is written by the renderer, which is the only place that knows.

**A candle stands, and its light is worked out from the same two lines that
drew it.** An instrument is drawn `xMidYMid meet` — an instrument sits in the
middle of its box — and an instrument may now say otherwise with `par` on its
`ACTIVE` entry, which the candle does (`xMidYMax meet`). It has to: the wax is
as long as the timer since decision 188, so a short candle centred in a tall
tile floated with air above it *and* below it, which reads as a drawing that
has come loose rather than as a stub. On the floor the air is all above, and
that is the picture of how long it burns for. `activeFlame()` reads `parOf()`
too — it undoes the letterboxing to place the light, so it has to undo the
*same* letterboxing. And it reads `candleFull()` rather than the fixed 84-unit
taper it was written against, which had put the glow a tile and a half above
the wick on every length but the default. See decision 190.

**An `<svg>` clips its own viewport, and the tile's `overflow` has nothing to
say about it.** The die's roll was a rotation on a `<g>` inside the artwork,
and since the die grew to fill its viewBox there was no margin left inside for
a corner to swing into — so every corner that left the square was shaved off
and a throw read as a die sitting still. The turn is on `.actart` itself, an
ordinary HTML element with only the tile to get past, and `.acttile.rolling`
has already lifted the tile's own clip and put it over its neighbours. The
general rule: to move a drawing past the edge of its box, move the box.

**A container one cell wide is a spine only if its face says so.** Decision
50's fallback — a front too thin for a name becomes a spine — was the answer
before there were dedicated books, and it turned any tall narrow drawer into
one. `drawsAsSpine()` asks `faceOf(o)` for a container and `shapeOf(o)` for an
object, so a thin drawer is still a drawer and an object wearing `sh-spine` is
still a book. See decision 190.

**Under the camera an envelope is open.** Pressing a letter takes the letter
out of it, which is what the closed front is *for*, so `.sh-letter.oncamera`
drops the flap and the wax and the plain sheet underneath is what you read.


**A pigeonhole draws its children with `gridTile()`, and makes them a picture.**
`pigeonBoard()` in tiles.js lays the children out on the container's real board
at the real cell size and scales the lot to the opening with one transform. It
strips every `data-*`, turns nested `<button>`s into `<div>`s, zeroes
`SHELFSHIFT` while it draws and puts it back, and goes one level deep. Anything
that adds a way of finding a tile by attribute has to be something this strip
removes, or the miniature will answer to it. **Which face at this size** is
`faceAt(o, box)`, not `faceOf(o)`: a front one cell wide and taller than that
is a pigeonhole unless the object named a face. A one-cell container keeps its
knob, with its mark printed on it. See decision 193.


**A calendar's face is a setting and a checklist may carry its name.**
`calShowOf()` (marks, titles, agenda, both) decides the face at three cells a
side and up; below that the pad and agenda faces are what they were. A
checklist's `clhead` spends its top line on the name and *n of m*; each line
says its day (`cldue`) or its stars, and a thing that cannot be ticked wears
its type's mark instead of the box, because a box on a review would tick it.
The answer box is a `<textarea>`: `gestures.js` already leaves one alone. See
decision 197.
