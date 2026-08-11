# Style guides

A **Style** sets the whole aesthetic at once: theme, palette, board, type, and
the defaults every new drawer is born with (knob, border, texture). Choosing one
is a starting point, not a cage — every individual control keeps working, and a
custom colour you set survives a style switch.

Implementation: `STYLES` in `web/index.html`, applied by `applyStyle()` →
`data-style` on `<html>` + inline tokens. Per-style chrome lives in CSS blocks
keyed on `html[data-style="…"]`.

---

## Victorian *(default)*

The app as it grew up: an old writing desk.

| Token | Value |
| --- | --- |
| Board | `#EFEADA` / `#DDE5CE` — cream & soft-green baize checker |
| Background | parchment `#E9E1CC` (Paper theme) |
| Accent | brass `#A9793F` |
| Display type | Iowan Old Style / Palatino (serif) |
| Palette | **Workshop** — walnut, chestnut, fern, slate, terracotta |
| Drawer defaults | round knob · panelled border · no texture |
| Signature elements | brass pulls, panelled fronts, plaque achievements, ledger counters, checkerboard baize |

Mood: finite, warm, deliberate. Nothing pure white, nothing pure black.

---

## Modern

Flat, quiet, out of the way.

| Token | Value |
| --- | --- |
| Board | `#F4F4F1` / `#EBEBE6` at 60% — a whisper of a checker |
| Background | `#FAFAF8`, cards pure white |
| Accent | calm teal-green `#3A6E68` |
| Display type | system sans (SF Pro / Inter), weight 500 |
| Palette | **Ink** — greys, slate blues, muted everything |
| Drawer defaults | bar knob · no border · no texture |
| Radii | 8px everywhere (vs 3–5px elsewhere) |
| Signature elements | hairline shadows, no ornament, generous whitespace |

Mood: a tool that disappears. The style to pick when the content is the point.

---

## Skeuomorphic

Things that look like the things they are.

| Token | Value |
| --- | --- |
| Board | `#E8DCC4` / `#D9C9A8` — sanded pine |
| Background | warm buff `#EFE4CC` |
| Accent | saddle `#8A5A2B` |
| Display type | serif (as Victorian) |
| Palette | **Orchard** — clay reds, apple greens, timber browns |
| Drawer defaults | ring pull · heavy panel border · wide-weave texture |
| Signature elements | wood-grain drawer fronts (vertical graining overlay), gilt & walnut picture frames, ticket stubs, instant-photo frames |

Mood: tactile. Everything casts a shadow because everything is an object.

---

## Starry Sidekick

The night sky from timothyvlangas.com — dark, whimsical, hand-drawn.

| Token | Value |
| --- | --- |
| Board | `#101422` / `#161B2E` night checker **with stars scattered over it** |
| Background | deep space `#0B0E1A` |
| Accent | starlight gold `#F5D76E` |
| Display type | Chalkboard SE / Comic Sans (hand-drawn; stands in for the site's Amatic SC without a webfont dependency) |
| Palette | **Seaside** — moonlit teals, sages, and sands that read well on dark |
| Drawer defaults | round knob · plain border · **stars texture** |
| Signature elements | star-speckled board and drawer fronts, gold accents, playful hand-lettered headings |

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
| Palette | **Aero** — aquas, cyans, sky blues, one dolphin green |
| Drawer defaults | **orb knob** (glossy sphere, radial highlight) · **aqua border** (glassy rim, inner light) · **sheen texture** (diagonal gloss sweep) |
| Radii | 10–12px, rounder than anything else |
| Signature elements | gloss gradients on tiles and buttons, orb pulls, glass-rim drawers, the sheen sweep |

Mood: optimistic frutiger-aero utopia. Bubbles, gloss, and clean water.

New elements invented for this style (available to every style once chosen
manually): `orb` knob, `aqua` border, `sheen` texture, `stars` texture.

---

## Adding a style

1. Add an entry to `STYLES`: name, theme, palette (add one to `PALETTES` if
   needed), board pair, `defaults{knob,border,texture,knobtone}`, and a `vars`
   map of CSS custom properties (only what differs).
2. Optional chrome: a `html[data-style="…"]` CSS block for anything tokens
   can't express.
3. Optional new elements (knobs/borders/textures) — add the CSS class and the
   option to the pickers; they become available to all styles.
4. Add a `.stpv.st-…` swatch for the picker tile, and a section here.
