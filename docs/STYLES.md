# Style guides

A **Style** is the whole aesthetic at once: **sixteen colours**, a board, a
typeface, whether the desk is light or dark, and the defaults every new drawer
is born with (knob, border, texture). Choosing one is a starting point, not a
cage — every individual control keeps working afterwards.

## The sixteen

A palette is not a separate choice any more, and a colour is not stored as a
hex. Every style has the same sixteen **slots**, in the same order, and an
object stores the *slot number*:

| Slots | | What they are |
| --- | --- | --- |
| 0–4 | Page · Text · Lines · Accent · Glow | The app itself. `chromeTokens()` derives the whole CSS token set from these five — the softer inks are the ink walked back toward the page, the rules are the line at low alpha — so a style supplies five hexes and gets forty. |
| 5–15 | Named by the style | What drawers and objects are painted in. |

Because slot 9 is Slate in every style, changing style repaints every slate
drawer in the new style's slate, and changing back puts every one of them
exactly where it was — nothing is converted, only looked up. A style that runs
cool still has to answer "what is your umber"; the answer is allowed to be a
warm grey, but it has to be *an* answer.

Repainting a slot in Settings stores the override against **that style**
(`S.look.slots[style][i]`), so a rust you disliked in Victorian doesn't follow
you to Aero. A literal hex typed into a colour input is still allowed on one
object; it belongs to no style and stays put through every switch.

Implementation: `STYLES` in `web/js/look.js`, applied by `applyStyle()` →
`data-style` on `<html>` + inline tokens. Per-style chrome lives in CSS blocks
keyed on `html[data-style="…"]`.

---

## Victorian *(default)*

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

## Pseudochromo

Near-monochrome. Professional, sleek, and not remotely colourful. Was called
Modern until it had a stated idea rather than an absence of one; **migration 13**
renames the stored key.

| Token | Value |
| --- | --- |
| Board | `#F6F6F7` / `#EDEEF0` at 60% — a whisper of a checker |
| Background | `#FBFBFC`, cards near-white |
| Accent | graphite `#4A5058` — the accent is a grey too |
| Display type | system sans (SF Pro / Inter), weight 500 |
| Its eleven | Carbon · Graphite · Iron · Steel · Ash · Nickel · Basalt · Clay · Payne · Mauve · Silver — a lightness ramp, barely a tint in any of them |
| Drawer defaults | bar knob · plain border · no texture |
| Radii | **2px chrome, 0px drawers** — sharp corners are the point |
| Signature elements | hairline shadows, no ornament, drawers told apart by weight rather than hue |

Mood: a tool that disappears. The style to pick when the content is the point.

---

## Skeuomorphic *(parked)*

The whole idea is materials that look real, and materials are images rather
than hexes — this one waits on assets. The palette below keeps it coherent
in the meantime; it is not the finished thing.

Things that look like the things they are.

| Token | Value |
| --- | --- |
| Board | `#E8DCC4` / `#D9C9A8` — sanded pine |
| Background | warm buff `#EFE4CC` |
| Accent | saddle `#8A5A2B` |
| Display type | serif (as Victorian) |
| Its eleven | Mahogany · Moss · Olive · Verdigris · Denim · Chambray · Leather · Brass · Tan · Velvet · Slate |
| Drawer defaults | ring pull · heavy panel border · wide-weave texture |
| Signature elements | wood-grain drawer fronts (vertical graining overlay), gilt & walnut picture frames, ticket stubs, instant-photo frames |

Mood: tactile. Everything casts a shadow because everything is an object.

---

## Starry Sidekick

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

## Aero

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

## Two things a style does not own

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

## Adding a style

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
