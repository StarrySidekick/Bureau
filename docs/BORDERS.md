# Every edge in Bureau

Asked for on 15 August: *"a list of all current borders we have, along with
anything similar that needs to be wrapped into the border system."*

So: what the border system is, everything currently in it, everything doing the
same job **outside** it, and which of those should be folded in.

---

## 1. The border system as it stands

Six **slots**, exactly like the sixteen colour slots (decision 33): a slot is a
*position*, not a material. An object stores `border:'panel'`, and what
`panel` is *made of* is the style's business. Stored values survive a style
swap and come back unchanged.

| Slot | Class | Victorian | Pseudochromo | Starry Sidekick | Skeuomorphic | Aero |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `bd-panel` | Panelled | Hairline | Ruled | Moulding | Bevel |
| 2 | `bd-heavy` | Heavy panel | Inset rule | Double rule | Deep moulding | Deep bevel |
| 3 | `bd-bar` | Bar | Top rule | Underline | Inlay | Sill |
| 4 | `bd-gloss` | Beaded | Card | Sketched | Beading | Glass |
| 5 | `bd-plain` | Plain — the shadow and nothing else. The same everywhere. |
| 6 | `bd-none` | None — no shadow, transparent border. The same everywhere. |

Declared in `BORDER_SLOTS` + each style's `borders:[…]` in `look.js`; drawn by
`.drawer.dtile.bd-*` in `chrome.css`, with a `html[data-style="…"]` block per
style overriding the four dressed ones. Plain and none need no per-style CSS,
because they mean the same thing in every style.

**The limit that matters:** every one of those rules is scoped to `.dtile`.
**Only containers have a border.** An object cannot choose one at all.

---

## 2. Everything else that draws an edge

### 2a. Doing the border's job, outside the system

| What | Where | Why it is a border in disguise |
| --- | --- | --- |
| **`edge`** — `.drawer.otile.edge{border-left:3px solid var(--c)}` | `chrome.css` | The only edge setting an *object* has, and it is a boolean rather than a slot. It is the seventh border, kept in a different drawer. |
| **Picture frames** — `fr-mount`, `fr-gilt`, `fr-walnut`, `fr-black`, `fr-polaroid`, `fr-none` | `chrome.css`, `frame` on the object | A six-option, style-blind, image-only edge system running exactly parallel to the six slots. Gilt is gilt in Aero, which owns no golds. |
| **`sh-dream`** — `border-style:dashed` | shape | A *shape* deciding the border style. "Dashed" is an edge, not a silhouette. |
| **`sh-pill`** — `border-radius:999px` + a 1.5px outline | shape | Half shape, half border. |
| **`sh-bubble`** — `border-radius:28px 28px 28px 3px` + the tail's two borders | shape | The corner radius is genuinely part of the silhouette; the 1px rule is not. |
| **`fieldtile`** — `border:1px dashed var(--rule)` | shape | Same as dream. |
| **`.drawer.unanswered`** — `border-style:dashed` | state | Overrides whatever border the object was given, rather than adding to it. |
| **`.drawer.magicdrawer`** — glow border-colour, an inset gilt rule, corner brackets | structural | Correctly *additive* decoration, but it repaints `border-color` out from under the slot. |
| **`--line` / "Drawer outline"** in Settings | `look.js` | The colour of the 1px border every tile carries. A global, and the one part of the edge that already crosses objects and containers. |
| **`--radius-d`, and `aero .drawer{border-radius:10px}`** | style vars | Corner radius is an edge property and is set per style, which is right — but it is invisible to the slot system. |
| **`starry .drawer.dtile{border-width:1.5px}`** | per-style | A per-style border weight applied outside the four slot rules. |

### 2b. Edges that belong to a shape, and should stay there

`sh-note` and `sh-verse` (torn paper: `border:0` + `clip-path` + `drop-shadow`),
`sh-idea` (folded corner), `sh-index` (the red margin rule of a record card),
`sh-page` (punch holes), `sh-tab` (the coloured divider tab), `sh-chit` (torn
ends and a perforation), `sh-plaque` (a cast bevel), `spinetile` (the boards of
a book), `triptile`'s `.tkstub` (a ticket perforation), `cnttile`, `gentile`,
`btntile`, `imgtile`. These are silhouettes. A border is a treatment of the
*same* rectangle; a clip-path is a different rectangle.

### 2c. Edges that are state, and correctly outside

`.selected`, `.dropinto`, `.dropgather`, `.droptime`, `.dropday`, `.dropboard`,
`.invalid`, `.ghost`, `.focused`, `.editing`, `.justmade`. All `outline` or
`box-shadow`, all transient, none stored. Leave them alone — an outline draws
*over* the border rather than replacing it, which is exactly why it was used.

### 2d. Chrome, not objects

`.pill`, `.sqbtn`, `.psel`, `.pfield`, `.pgroup`, `.row`, `.mcell`, `.panel`,
`.check`, `.cladd`, `.ansbox`, `.relchip`, `.tagchip`, `.styletile`. These are
the app's furniture. They take their line from `--rule` and are out of scope.

---

## 3. What should be wrapped in, in order

1. **Move the six slots from `.dtile` to `.drawer`.** One line per rule, and
   suddenly `border` is an ordinary per-object property like colour, shape or
   face — which is what §1 of `SYSTEM.md` says it should already be. Today a
   note cannot have a moulding and a drawer cannot have a hairline unless it
   happens to be a container. Nothing in the model prevents it; only the
   selector does.

2. **Fold the picture frames into the slots.** Six frames against six borders is
   not a coincidence. A frame is a border with a wider inset, and `gilt` is
   precisely the sort of thing a style should be allowed to answer for itself —
   Aero's gilt is a chrome rim, Starry's is a white pencil box. It would delete
   a whole parallel list and give every object the frames pictures already have.

3. **Take the border away from the shapes.** `sh-dream`'s dashed edge and
   `fieldtile`'s dashed edge are the same edge asked for twice; if borders were
   per-object, "Dashed" would be a seventh slot and a dream would be a card
   wearing it. Same for `sh-pill`'s outline. Leave the radius with the shape.

4. **Make the state borders additive.** `unanswered` and `magicdrawer` both
   write `border-style` / `border-color` over whatever slot is set. Both should
   draw their own inset ring (`box-shadow`, as the gilt frame already does)
   and leave the border to the border.

5. **Then, and only then, a seventh and eighth slot are cheap.** Dashed and
   Coloured edge (today's `edge`) become positions each style answers, and the
   boolean goes.

None of this is done. Item 1 is a few selectors and would pay for itself
immediately; items 2–4 are each an afternoon and a migration.
