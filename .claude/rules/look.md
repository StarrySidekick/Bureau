---
paths:
  - "web/js/look.js"
  - "web/js/guide.js"
  - "web/js/decor.js"
  - "web/css/board.css"
  - "web/css/chrome.css"
---
# Look

Aesthetics and the sixteen slots; families, positions and pins; edges, radii and shadows; decorations; the specimen book.

These paragraphs were the *How to work in this codebase* section of `CLAUDE.md`,
moved here whole and unreworded so they load when a file they are about is
opened rather than in every session (decision 175). A rule for this area goes
here; a rule for every area goes in `CLAUDE.md`.

**A knob is a slot, like an edge, a panelling and a colour.** `knobOf(o)` —
five positions, named by `knobSlots()` and dressed per aesthetic. Everything an
aesthetic adds only *adds* to `.pull`, which already turns the knob out of the
front's own wood and lights it from the upper left; say what it is made of, do
not re-light it. Girando's position 0 is a **volute**, which is how its default
knob is a spiral without a special case. `orb` is not a position — it was in
the picker with no CSS behind it for a long time and quietly gave you a round
one. See decision 96.

**Starful Gothic is a drawing, and it has no ground.** It sits further from
the other aesthetics than they sit from each other: no moulding, no bevel, no
relief, and — the part that took two goes — **no fill**. A thing on this desk
is its outline. The eleven colour slots therefore do nothing here, which is the
aesthetic's own answer rather than an omission. Its four dressed border slots
are the same hand-drawn line varying only in weight; a stock is still five
different sheets, drawn in line rather than in ground.

Four rules, each of which cost a session to learn. **The line lives on
`.dpanel`, and the tile itself must carry `filter:none`** — a torn shape
outlines itself with four drop-shadows tracing its own alpha, and with the
ground gone the only alpha left is the writing, so it haloed every letter.
**The line is three passes** — a long wander, a short tooth, and a fine
chipping — and the window on the chip grain is narrow at *both* ends: finer and
the line is dust, coarser and the bites become gaps and it reads as broken. A
one-turbulence version with coarse chips was tried, was cheaper, and looked
wrong; these numbers were found by looking. **The noise is per element**, so
two tiles the same size draw the identical line — three filters differing in
seed, staggered by `--wob`, is what breaks up the repeat. And **animate
`--pen`, never `filter`**: a `url()` filter is not compositable, so animating
it repaints every outline sixty times a second and an idle board sits at 42fps.
See decision 101.

**A filter costs about 0.2ms per element per *pass* per repaint**, and both
halves of that matter. Cutting passes is real — wander alone is 41ms across
fifty-two tiles, adding the chip makes it 51 and the tooth 61, against
Victoria's 40 — and so is cutting elements, which is why knobs, tick boxes,
grains and spine bands carry none: no three-pixel wander shows at the size they
are drawn. What is *not* a lever is the filter region: tightening it from 116%
to 106% changed nothing measurable. Don't add a filter to something small, and
don't add a pass without measuring it.

**A slot may be pinned to the aesthetic it came from.** Every look slot stores
a *position* and the aesthetic says what the position is made of — that is the
whole system, and its one sharp edge is that a Golf 97 group box you liked
becomes a Victorian raised panel the moment you switch. So a stored value may
be **pinned**, written `golf97/fielded`; a bare one follows the desk and
re-dresses on every switch, which stays the default. `slotKey()`/`slotFrom()`
in model.js parse it and `slotRaw(o, prop)` reads it per object then per type.
Nothing needed a migration, because every value written before this is bare.

The renderer stamps `<fam>sty-<aesthetic>` beside each slot class — ask
`dress(o, fam)` in look.js, never write `bd-${o.border}` by hand — and the
per-aesthetic **tile** rules are keyed on that (`.drawer.dtile.pn-fielded
.pnsty-carca`) rather than on `html[data-style]`, so four families on one tile
can be dressed by four different aesthetics. **The chrome stays on
`html[data-style]`**: panels, buttons, the bar, the wood, the typeface, the
radii — none of it is a slot and none of it can be pinned. Two traps: the old
selectors carried an attribute and beat the base rules on *specificity*, so the
new ones must sit **after** the base block in the same stylesheet; and a
selector that does not get converted fails **silently** — the tile renders,
just undressed, which is what `slotScoping` in the smoke test exists to catch.
See decision 98.

**Five families, one table.** `FAMS` in look.js — `bd` border, `pn` panelling,
`kn` knob, `tx` grain, `bn` binding, `st` stock — each naming the property it
is stored under, its positions, its fallback words, the key an aesthetic names
its own under, and the reader. `famSlots(fam, style)` is the picker's list and
`famAll(fam)` is every other aesthetic's, grouped. Add a family here and the
pickers, the pins and the scope classes all come along; add it anywhere else
and none of them do.

**Nothing on the desk shimmers.** A magic drawer used to be holographic foil,
lit from `--holox`/`--holoy` on `#frame` — the phone's tilt, or the pointer.
It was tacky, and it is gone along with the whole tilt apparatus. Furniture does
not react to being held. If you want a surface to catch light, give it a reason
first and read decision 42.

**A style is a typeface, and that includes an object's words.** `--serif` is
whatever the style declares; `.dname`, `.tiletext` and both inline editors are
set in it. They were pinned to `--sans` — the system face — which meant a note
and a task were the one thing on the desk not wearing the style, and Starry's
Optima drawer sat next to a San Francisco note.

**A stock is never written, and its fallback is the aesthetic's.** `stockNow()`
in look.js: an object with nothing said wears whatever `defaults.stock` this
aesthetic makes paper out of, so it re-dresses on a switch with nothing stored.
That asymmetry is the point — a drawer is *given* a rolled look at birth because
furniture in one room came from different hands (decision 92), and paper comes
off one pad. Don't add `stock` to `randomLook()`. Shapes stay global: `sh-note`
and `sh-index` say what a thing *is*, the way a face does.

**What cannot be a slot is tagged.** A decoration is a made object — a mantel
clock cannot be re-dressed into a gearwork the way a knob is re-dressed into a
boss — so each carries `aes:[…]` and the picker leads with `decorFor(style)`,
the rest behind the same "From other aesthetics" disclosure every slot family
has. A tick box stays a fact about the desk (decision 83) and takes the
aesthetic's `check` until you pick one; the way back **deletes** the key rather
than storing `''`. See decision 100.

**A decoration stands on the board rather than in it.** `isDecor(o)` —
`has(o,'decor')` — is the one thing exempt from collision: `boxOk()` returns
true for it outright *and* filters decorations out of the obstacles it checks
everything else against, so a drawer can be placed where a plant is standing
and the plant doesn't move. It is still on the grid — box, snap, drag, resize,
pages — it is only the overlap rule that lets go. It wears no tile at all (no
paper, border, shadow or name), is drawn above the tiles, and on a **locked**
board takes no pointer events, because a cut-out's transparent corners would
otherwise swallow taps meant for what it stands in front of. The built-ins
are inline SVG in `decor.js` so they can read the style — `currentColor` is the
object's colour, plus `--brass`/`--glow` — and each suggests the slot it looks
best in, plus its **own tight viewBox and tile size** — an ornament stands on
the floor of its box rather than floating in it. An uploaded **SVG is never put
through the canvas**; rasterising is
the one thing that throws away what an SVG is for. New file → add it to `SHELL`
in `sw.js`. See decision 86.

**A corner is round or square, and nothing in between.** Four tokens in
board.css — `--radius` 4px (a control, a chip, a field), `--radius-lg` 6px (a
panel, a menu, a card), `--radius-d` 2px (drawers), `--pill` 999px (round ends,
all the way). A **squircle** is the shape of software and the one thing on this
desk that could not be a made object: a knob is turned and is a circle, a front
is sawn and is a rectangle. Don't write a raw `border-radius` in the 6–12px
band in the chrome. An **aesthetic** may still say otherwise for its own tiles
— Aeros is glossy and round and that is its argument — which is the line
between the twelve declarations that stayed and the forty-six that went. The
sharp end keeps a hair of radius on purpose: dead square reads as a rendering
fault rather than a made edge. Guarded off the *computed* style, because a
token nobody applied is a rule nobody follows. See decision 125.

**Shadows are a switch.** `S.look.shadows`, in the app's settings. Off writes a
**zero** shadow into `--shadow`/`--shadow-lg`, never `none`: half the border
slots write `box-shadow: inset …, var(--shadow)`, and `none` is only legal as
the sole value of the property — it would take the inset rings down with it.

**CSS uses custom properties for kind colour.** `--k` is set inline on the element
and everything inside inherits it. `--c` does the same for drawer colour. Don't
hardcode a hex value in a component rule.

**The gilt frame is an edge, not a privilege.** `bd-gilt` is the seventh border
slot — a ruled frame inset from the edge with corner brackets and one wash of
leaf held to the top. It used to appear on a *magic* drawer automatically,
which made it the one ornament nobody could choose and nobody could decline;
now anyone can wear it and a magic drawer needn't. A magic drawer still carries
the **sparkle mark**, because that is a fact about behaviour rather than
decoration. A checklist face still wears the frame (decision 79) and now says
so as `bd-gilt` rather than by borrowing a class. See decision 94. It was holographic foil for
a while, which was worse than either; see decision 42. Never hardcode the gold:
it is `var(--glow)`, so it is leaf on Victorian and a green shimmer on Starry.

**An edge is a slot too.** The six `bd-*` classes are positions, not
descriptions — `bd-panel` is a Victorian moulding, a Pseudochromo hairline, a
white-pencil rule on Starry and a lit glass sill on Aero. A style names its own
six in `borders:[…]`; only the four dressed ones need per-style CSS, because
plain and none mean the same thing everywhere. Same rule as colour: never
hardcode what an edge is made of outside the style that owns it.

**A literal colour is somebody insisting, and there is now a picker for one.**
Under the eleven slots is a colour input writing a hex, in its own labelled row —
it does something different from the slots, so it must not look like one. The way
back writes **null**, never `''`: `objColour()` tests `o.c != null`. See decision
76.

**The board can be pinned rather than laid flat.** `S.look.pinned` — a margin on
each tile and one to three degrees of tilt, from `tiltOf(id)`, a hash of the
object's own id so the angle is the same on every render forever. Never `gap` on
the grid: `cellW()` measures the grid's own rect and moving it moves every tile
out from under the drag maths. Don't add a drawn pin head (the tile's overflow
clips it) or a `box-shadow` here (it replaces the border slots' inset moulding
and outlives the Shadows switch). See decision 75.

**A style is called an *Aesthetic* in the interface.** The stored key is still
`style` and the CSS hook is still `data-style` — renaming those buys nothing
and costs a migration — but every word a person reads says Aesthetics. The
seven are **Victoria**, **Carca**, **Stelaine**, **Girando**, **Golf 97**,
**Starful Gothic** and **Aeros**; `docs/STYLES.md` says what each is made of.
**Skeuomorphic and
Pseudochromo are gone** — the first because Victoria became the thing it was
waiting to be, the second because it is not in the new list. Removing one needs
a migration even though `styleNow()` falls back: the fallback means a desk left
on it *looks* right while storing a name that no longer resolves, and its slot
overrides are stored per aesthetic and become unreachable. See decision 90.

**A colour is a slot, and a slot is a position, not a hue.** Every aesthetic has
the same sixteen — five that dress the app (Page, Text, Lines, Accent, Glow)
and eleven it names itself — so an object stores `c: 11` and shows Victorian's
claret, Aero's deep sea blue or Starry's pine depending on where you are. Don't
try to make the eleven line up by colour across styles: Aero owns no reds and
Pseudochromo owns no hues at all, and forcing them to would wreck both. Change style and the desk repaints; change back and it is
exactly where it was. Never read `o.c` to paint something: go through
`objColour(o)` in `look.js`, which falls back to the type's and resolves either
a slot number or a literal. `hexOf()` is the same resolver for a bare value.
A literal string is still legal — it is somebody insisting — and travels
between styles unchanged. `chromeTokens()` derives every CSS token from the
five, so a new style declares sixteen hexes and nothing else. See decision 33
and `docs/STYLES.md`.

**An override is stored per theme, and `applyLook()` must not write it back.**
`bg`, `accent`, `line` and `board` live as `{paper, walnut}` and are read with
`lookVal()`. Assigning the resolved string back into `S.look` collapses the
object, and `lookVal()`'s string branch only answers for paper — so the next
call returns null and the value is silently dropped. There is always a next
call: `applyStyle()` runs `applyLook()` and then `render()`, which runs it
again. That bug meant **no dark aesthetic ever showed its own board** — Starful
Gothic fell back to the CSS default from the day it was written, and it took a
second dark aesthetic before anyone could see it. Read into locals. Anything
comparing one of these to a string wants `lookVal()`, not `S.look.<key>`. See
decision 91.

**An aesthetic's `defaults` are what a new container is born with** — knob,
border, texture, knobtone **and panel**. Add a new per-container look property
and it belongs in that set, or the aesthetics cannot speak for it: panelling
shipped without it, which left the one thing separating a Victorian drawer from
a Windows 95 button as the one thing an aesthetic could not say.

**A new drawer rolls its own look, from this aesthetic's vocabulary.**
`randomLook()` in look.js: knob, edge, grain and panelling, each picked with
the aesthetic's stated default in the bag **three times over**, so a desk is a
room of related furniture rather than a row of identical fronts — and still
reads as the aesthetic it is in. Uniform picks would make every aesthetic look
like the same jumble. `none` is in no bag: it is a deliberate choice, not a
thing to hand out. See decision 92.

**An aesthetic states its own `--wood`, and that is the widest thing it says.**
The carcass frames everything — the strip above the bar, the bar, the reveal,
the drawer along the bottom, and the status bar, which follows it through
decision 89. A desk's own `wood` still beats it. It also names a **spray**
shape, which an unset `S.look.spray` takes, so the burst changes with the
aesthetic until you pick one; unsetting deletes the key rather than storing
`''`. And each dresses `.panel` and `.sqbtn` — one menu system and one button
(decision 23), so two rules per aesthetic reach every menu in the app.

**There is no theme switch.** Light or dark is `isDark(palNow()[0])` — the
style's own background. `themeNow()` still reports paper/walnut, because the
CSS theme block owns the shadows and the per-theme custom colours are keyed on
it, but nothing sets `S.theme` any more. Adding a dark style means adding a
style, not a second axis.
