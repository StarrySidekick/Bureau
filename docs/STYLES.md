# Aesthetics

An **Aesthetic** is the whole look at once: **sixteen colours**, a board, a
typeface, whether the desk is light or dark, and the defaults every new drawer
is born with (knob, border, texture, panelling). Choosing one is a starting
point, not a cage — every individual control keeps working afterwards.

It was called a *Style* until 2026-08-30. The word is now **Aesthetics**
throughout the interface, ahead of the shared definitions coming from the
Aesthetics repository; the stored key is still `style` and the CSS hook is
still `data-style`, because renaming those buys nothing and costs a migration.
See decision 90.

The list is **Victoria**, **Starful Gothic** and **Aeros** today, and will be
seven: Carca, Golf 97, Stelaine and Girando are named but not yet defined.

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
| Drawer defaults | round knob · plain border · **stars texture** |
| Signature elements | white-pencil outlines, no shadows, star-speckled board, playful hand-lettered headings |

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

## Two things an aesthetic does not own

**The wood.** `--wood` and `--wood-2` are the carcass — the rail above the bar
and the drawer front along the bottom of a phone. They are a deep walnut in
light and dark alike and are deliberately *not* derived from the sixteen: a desk
is walnut at midday as much as at midnight, and paper laid on pale wood reads as
a rendering fault rather than as furniture. A style that is genuinely made of
something else may overrule them in its own `vars`, but it should have a reason.

**The shadow.** Whether things on a desk cast one is `S.look.shadows`, a switch
in the app's settings rather than a property of the style. Off writes a *zero*
shadow into `--shadow` and `--shadow-lg` — never `none`, because half the border
slots write `box-shadow: inset …, var(--shadow)` and `none` is only legal as the
sole value of the property.

## Adding an aesthetic

1. Add an entry to `STYLES`: name, `cols` (all sixteen, in slot order — the
   five first), board pair, `defaults{knob,border,texture,knobtone}`, and a
   `vars` map for the handful of things a colour can't say (radius, typeface,
   and the wood if it is genuinely not wood). Light or dark follows from
   `cols[0]`; there is nothing else to declare.
2. Optional chrome: a `html[data-style="…"]` CSS block for anything tokens
   can't express.
3. Optional new elements (knobs/borders/textures) — add the CSS class and the
   option to the pickers; they become available to all styles.
4. Write a section here. The picker tile needs no CSS — it draws itself out of
   the style's own sixteen.
