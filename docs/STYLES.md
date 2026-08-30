# Aesthetics

An **Aesthetic** is the whole look at once: **sixteen colours**, a board, a
typeface, whether the desk is light or dark, and the defaults every new drawer
is born with (knob, border, texture, panelling). Choosing one is a starting
point, not a cage — every individual control keeps working afterwards.

**A colour, an edge and a *working* are all slots.** Sixteen colour positions,
seven border positions and five panelling positions; each aesthetic names and
dresses its own, and what an object stores is the position. That is what lets
one drawer be a claret ashlar block here and a deep-sea-blue group box in 1997
and itself again when you come back. See decisions 33, 88 and 93.

It was called a *Style* until 2026-08-30. The word is now **Aesthetics**
throughout the interface, ahead of the shared definitions coming from the
Aesthetics repository; the stored key is still `style` and the CSS hook is
still `data-style`, because renaming those buys nothing and costs a migration.
See decision 90.

The seven are **Victoria**, **Carca**, **Stelaine**, **Girando**, **Golf 97**,
**Starful Gothic** and **Aeros**.

## The sixteen

A palette is not a separate choice any more, and a colour is not stored as a
hex. Every aesthetic has the same sixteen **slots**, in the same order, and an
object stores the *slot number*:

| Slots | | What they are |
| --- | --- | --- |
| 0–4 | Page · Text · Lines · Accent · Glow | The app itself. `chromeTokens()` derives the whole CSS token set from these five — the softer inks are the ink walked back toward the page, the rules are the line at low alpha — so an aesthetic supplies five hexes and gets forty. |
| 5–15 | Named by the aesthetic | What drawers and objects are painted in. |

Because slot 9 is Slate in every aesthetic, changing aesthetic repaints every
slate drawer in the new one's slate, and changing back puts every one of them
exactly where it was — nothing is converted, only looked up. An aesthetic that runs
cool still has to answer "what is your umber"; the answer is allowed to be a
warm grey, but it has to be *an* answer.

Repainting a slot in Settings stores the override against **that aesthetic**
(`S.look.slots[style][i]`), so a rust you disliked in Victoria doesn't follow
you to Aeros. A literal hex typed into a colour input is still allowed on one
object; it belongs to no aesthetic and stays put through every switch.

Implementation: `STYLES` in `web/js/look.js`, applied by `applyStyle()` →
`data-style` on `<html>` + inline tokens. Per-aesthetic chrome lives in CSS blocks
keyed on `html[data-style="…"]`.

---

## Victoria *(default)*

The app as it grew up: an old writing desk.

| Token | Value |
| --- | --- |
| Board | `#EFEADA` / `#DDE5CE` — cream & soft-green baize checker |
| Background | parchment `#E9E1CC` (slot 0) |
| Accent | brass `#A9793F` |
| Display type | Iowan Old Style / Palatino (serif) |
| Its eleven | Walnut · Baize · Sage · Emerald · Royal · Delft · Claret · Gilt · Oak · Regal · Pewter |
| Drawer defaults | round knob · panelled border · no texture |
| Signature elements | brass pulls, panelled fronts, plaque achievements, ledger counters, checkerboard baize |

Mood: finite, warm, deliberate. Nothing pure white, nothing pure black.

---

## Carca

Carcassonne: a walled French city in tile-sized pieces, with the war long over
and its machines turned to tinkering. Flowers and overgrowth on the ramparts,
brass and copper in the works.

| Token | Value |
| --- | --- |
| Board | `#EAE5D4` / `#DBDCC6` — and this is the one aesthetic where the checker reads as exactly what it is: a table of laid tiles |
| Background | limestone `#E8E4D6`, ink a blue-black `#22303F` |
| Accent | brass `#A87A3C`, glow pale gilt `#D4B872` |
| Display type | Hoefler Text / Baskerville — old-style, with a French cut |
| Its eleven | Rampart · Woad · Cornflower · Meadow · Ivy · Wisteria · Rose · Brass · Copper · Verdigris · Tufa |
| Drawer defaults | ring pull · ashlar border · grid texture · **fielded panel** |
| Radii | 6px chrome, 2px drawers — masonry, not cabinetwork |
| Signature elements | a course line held off the edge with a chamfer above it, because a dressed block is bedded rather than framed |

Mood: heraldry that has relaxed. Stone and meadow, with something ticking.

---

## Stelaine

A floating island under a sky that drops its stars as crystal. Violets and
cosmic blues rather than black space, elven gold on top of them — rich, not
merely dark. The astronomers keep the tower and the information; everyone else
mines what falls.

| Token | Value |
| --- | --- |
| Board | `#171233` / `#1D1740` — a violet night |
| Background | void indigo `#120E20`, ink starlight `#EDE7FA` |
| Accent | arcane violet `#9A6BD8`, glow elven gold `#E3C98A` |
| Display type | Didot / Bodoni 72 — elven is high-contrast and thin-stroked, not blackletter |
| Its eleven | Nebula · Amethyst · Void · Astral · Aether · Starcrystal · Arcane · Ember · Eldergold · Nether · Slate |
| Drawer defaults | orb pull · filigree border · starry texture · **ogee panel** |
| Radii | 11px chrome, 4px drawers — nothing here was cut |
| Signature elements | filigree held well off the edge and doubled; slot 4 is a crystal **facet**, lit off one shoulder and shaded off the other |

Mood: somebody else knows where the next one lands.

---

## Girando

The underside of a landmass that will not hold still: Sicilian baroque seen
from below, in volcanic stone and majolica, gold on the ornament and vines
through everything. The motif is the **spiral** — the volute of a scroll, and
the turn of the rock itself.

| Token | Value |
| --- | --- |
| Board | `#262119` / `#2E2820` — basalt in shadow |
| Background | dark warm stone `#211E1A`, ink limestone `#EDE4D2` |
| Accent | terracotta gold `#B98846`, glow pale gold `#E0C782` |
| Display type | Bodoni 72 — Italian, and the face baroque plates were re-set in |
| Its eleven | Basalt · Tufa · Majolica · Verde · Acanthus · Terracotta · Sangue · Ochre · Lapis · Aubergine · Cenere |
| Drawer defaults | round pull · volute border · speckle texture · **ogee panel** |
| Radii | 14px chrome, 5px drawers — the roundest here, because a volute has no corners |
| Signature elements | a *carved* edge: deep, gilded on its lit face and dark in the hollow, never the same depth twice round |

Mood: labyrinthine. You are underneath it and it is moving.

---

## Golf 97

1997, on a television. Washed fairway greens, the beige of golf slacks, maroon
polo, distressed leather, and the grey and teal of the desktop it was all
running beside.

| Token | Value |
| --- | --- |
| Board | `#CFD8B8` / `#C0CBA6` — the checker is the mown fairway |
| Background | `#D6D3C4`, ink near-black `#2A2A24` |
| Accent | desktop teal `#12736E`, glow ad-gold `#C8A63C` |
| Display type | Tahoma / Verdana — the faces this actually happened in |
| Its eleven | Fairway · Rough · Khaki · Sand · Polo · Cadet · Teal · Mustard · Leather · Plum · Silver |
| Drawer defaults | square pull · outset border · check texture · **flat panel** |
| Radii | **0px everywhere** — nothing in 1997 had one, tick boxes included |
| Signature elements | the only *hard* edge in the app: two flat steps, light at the top left and dark at the bottom right, no blur and no gradient. Sunken is the same thing turned over. Four pixels rather than the two a real one had, because that bevel was drawn on a 90px button and these tiles are five times that |

Mood: a driving range at four in the afternoon, on a CRT.

---

## Starful Gothic

The night sky from timothyvlangas.com — black and white, drawn in white pencil.
Swirly, starry, wireframe: a front is its **outline**, not its fill, so the line
slot is white and nearly opaque and the drawer shadow goes entirely.

| Token | Value |
| --- | --- |
| Board | `#07080C` / `#0B0D13` night checker **with stars scattered over it** |
| Background | pitch `#07080C` |
| Accent | blue `#6FD3F5`, with green `#7DE8B0` as the glow — the only two colours in it |
| Display type | Chalkboard SE / Comic Sans (hand-drawn; stands in for the site's Amatic SC without a webfont dependency) |
| Its eleven | Ink · Slate night · Charcoal · Deep blue · Harbour · Pine · Fern night · Graphite · Midnight · Pitch · Ash — near-blacks that differ by a whisper of blue or green |
| Drawer defaults | round knob · plain border · **stars texture** · flat panel |
| Signature elements | white-pencil outlines that **actually waver** — see below — no shadows, star-speckled board |

**The drawn line.** Taken from Tilemakers' Workshop, where the wobble is applied
to the *picture* rather than the paths: a sprite is rendered clean and every
pixel is then looked up a small, smoothly-varying distance from where it should
be, which bends every edge at once the way a nib wanders. Redrawing two
thousand path calls with hand-wobble is a rewrite that never ends; displacing
the result is one pass.

A `box-shadow` cannot be displaced — but that operation is exactly what an SVG
filter does natively, and `feTurbulence` + `feDisplacementMap` *is*
smooth-noise displacement of a rendered picture. So the technique carries over
whole; only the implementation changes. Two passes, matching theirs: a
long-wavelength **wander** that bends a line, and a short-wavelength **tooth**
that gives its edge the grain of the paper.

It is only ever applied to a layer that holds **no text** — `.dpanel`, the
moulding layer, and the gilt frame on a magic front. Displacing a drawer's name
would be smudging the label, not drawing the box. It costs nothing at composite
time: the filtered layer rasterises once and caches, and a full phone board
scrolls at the same 16.7ms per frame as Victoria's.

Mood: cosy night-web. The early-internet charm of the site, kept legible.

*Future asset hook:* the site's animated GIFs (persona, sun, cassettes) could
become optional board decorations — objects of an `ornament` type — without
touching the style system.

---

## Aeros

2006 in the best way: teal gloss, clear skies, everything slightly wet.

| Token | Value |
| --- | --- |
| Board | `#D8F0F4` / `#C2E6EC` at 85% — swimming-pool checker |
| Background | sky wash `#E9F6F8`, cards near-white `#F6FCFD` |
| Accent | aqua `#18A6C4` |
| Ink | deep teal `#0E3A44` |
| Display type | Trebuchet MS (the 2000s UI font) |
| Its eleven | Aqua · Lagoon · Meadow · Bliss · Harbour · Sky · Deep sea · Steel · Slate · Storm · Silver — no reds, browns or golds anywhere |
| Drawer defaults | **orb knob** (glossy sphere, radial highlight) · **aqua border** (glassy rim, inner light) · **sheen texture** (diagonal gloss sweep) |
| Radii | 10–12px, rounder than anything else |
| Signature elements | gloss gradients on tiles and buttons, orb pulls, glass-rim drawers, the sheen sweep |

Mood: optimistic frutiger-aero utopia. Bubbles, gloss, and clean water.

New elements invented for this style (available to every style once chosen
manually): `orb` knob, `aqua` border, `sheen` texture, `stars` texture.

---

## What an aesthetic controls — a coverage map

*Audited 2026-08-30, rebuilt the same day (decisions 98–100).* This is the
honest state of it: what changes when you switch, what does not, and where the
thin patches are.

### The six slot systems

A slot is a **position**. The object stores the position; the aesthetic decides
what that position is made of. This is what makes a switch re-dress everything
you own while your individual choices survive — and switch back and every one
of them is itself again.

| System | Positions | Worn by | Every aesthetic names them? | Dressed in CSS by |
| --- | --- | --- | --- | --- |
| **Colour** | 16 (5 chrome + 11 objects) | everything | yes | all — it is the `cols` array |
| **Border / edge** | 7 | drawers **and objects** | yes | all seven, both halves |
| **Panelling** | 5 | drawer fronts | yes | all seven |
| **Knob** | 5 | drawer fronts, the desk rail | yes | all seven × all five |
| **Grain / texture** | 6 | drawers, objects, the rail | yes | all seven |
| **Stock** | 5 | objects | yes | all seven |
| **Binding** | 5 | book spines | yes | Golf 97, Starful Gothic and Aeros dress; the rest take Victoria's shelf |

Every one of them can be **pinned** to an aesthetic other than the one you are
in — `golf97/fielded` — which is the "hyper-customisation" escape hatch: the
picker shows your five, and every other aesthetic's five sit behind a
disclosure. A bare value follows the desk; a pinned one does not.

### What else an aesthetic declares

| | What it sets |
| --- | --- |
| `cols` + `names` | sixteen hexes and what it calls its eleven |
| `dark` | an optional second sixteen — **only Victoria has one** |
| `board` + `boardAlpha` | the checker under everything |
| `borders` · `panels` · `knobs` · `textures` · `stocks` · `bindings` | what it calls each family's positions |
| `defaults` | knob · border · texture · knobtone · panel — what a new drawer leans toward — and `stock`, which is what a *sheet* is made of and is never written to an object |
| `check` | which tick box an unset preference follows |
| `spray` | which burst shape an unset preference follows |
| `vars` | `--wood` (the carcass, and the status bar with it), `--radius`, `--radius-d`, `--serif`, `--line` |

Plus per-aesthetic CSS for `.panel` and `.sqbtn` — one menu system and one
button, so two rules reach every menu in the app — and `.gridbar`.

### The one that answers differently

**Starful Gothic has no ground.** A thing on that desk is its outline and
nothing else — no fill on a drawer front or on a note, no ring, no shadow. So
its colour slots do nothing, its edges are one drawn line at four weights, and
its five stocks are five *drawn* sheets rather than five materials. That is the
aesthetic's own answer and not a gap in the coverage: an aesthetic is allowed
to be about one thing, the way Aeros owns no reds. See decision 101.

### What is tagged rather than dressed

A **decoration** is a made object: a mantel clock cannot be re-dressed into a
gearwork the way a knob is re-dressed into a boss, and pretending otherwise
would mean fourteen drawings times seven aesthetics. So each carries `aes:[…]`
saying where it belongs, the picker leads with those, and the rest sit behind
the same disclosure the slot families use. Nothing is hidden and nothing is
converted; the order is the whole of it.

### What does **not** change between aesthetics

1. **Marks / icons.** One global set of about thirty. They are a *semantic*
   vocabulary — a clock means a time, a feather means writing — and thirty
   icons times seven aesthetics is two hundred drawings for a distinction
   nobody is asking a mark to make. The honest smaller version, if it is ever
   wanted, is a per-aesthetic stroke weight and cap.
2. **Spray shapes.** The list is global; an aesthetic only picks which is the
   default.
3. **Tick boxes.** Six shapes, desk-wide (`S.look.check`) rather than per
   object — deliberately, by decision 83, so a task and a checklist line never
   disagree. An aesthetic supplies the *default*, and picking one keeps it.

### What *should* not change, and does not

Faces and layouts (`front`, `checklist`, `project`, `calendar`, `timeline`,
`spine`; `grid`, `list`, `book`, `scroll`) are **structural** — they say what a
container *is* and how it arranges what it holds. An aesthetic saying a
checklist is a calendar would not be a style, it would be a different app.
Likewise object *shapes* — `sh-note`, `sh-index`, `sh-quote` say what a thing
is, the way a face does. And the grid, paging, locking, shadows and the pinned
board: those are facts about the desk, not about the look.
