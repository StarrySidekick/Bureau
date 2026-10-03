# Every dial a bench can set

**Built** means a bench spec can state it today. **Board only** means it
exists but is set by hand in Board settings, not by a bench. **Proposed**
means it is in `docs/NAVIGATION.md` and not built; do not put it in a spec.
Update this file as each proposed dial is built.

## Navigation

| Dial | Values | Stored | Read by | Status |
| --- | --- | --- | --- | --- |
| Where it opens | a tile, `{x, y}` | `start` on the board; the spec's first tile is `on`, others `boards:[{at}]` | `startOf()` | **built** |
| Scroll type | smooth (default) or `rigid` | `flow` in `env` | `setting('flow')`, `rigidOn()` in grid.js | **built**; rigid moves a screenful, not a tile |
| Settle on tiles | `flow:'page'` | `env` | `byTile()` | in the code, not offered in Settings |
| Kind of board | `free`, `tiled`, `fixed` | `form` on the board, or `form` on the type | `formOf()` in grid.js | **board only** (a type can state it) |
| Tile size | 2 to 24 by 2 to 24 | `bw`, `bh` on the board or type | `formOf()` | **board only** |
| Layout | which tiles exist | `tiles: ['0,0','1,0']` | `tilesOf()` | built through a spec's `boards` |
| When full | add a tile, or refuse | `full` on the board | `formOf()` | **board only** |
| Zoom | a pinch, free, settling on whole cells | memory only (`ZOOM`) | `zoomOf()` | not a setting |
| Edges (open, closed) | | | | **proposed** |
| Zoom type (free, steps, set) and levels (`cells`, `tile`, `row`, `whole`) | | | | **proposed** |
| Opens at a zoom | | | | **proposed** |
| Axes on a free board (`both`, `across`, `down`) | | | | **proposed** |
| Stations (named tiles, edge hints, dots on the lip) | | | | **proposed** |
| A bench states its board (`board:{…}` on a spec) | | | | **proposed** (BOARDS.md phase 7) |

### The five patterns (proposed as presets; usable now as a design language)

| Pattern | Layout | Edges | Scroll | Zoom |
| --- | --- | --- | --- | --- |
| Sheet | one tile | closed | none | set: tile |
| Scroll | a strip down, or free | closed sides | smooth, down | set: cells |
| Carousel | a strip across | closed | rigid, across | steps: tile, whole |
| Rooms | a grid of tiles | closed | rigid, both | steps: tile, whole |
| Expanse | free | open | smooth | free |

Hub is Rooms in a cross, opening in the middle.

What can be done **today** toward each: Sheet is one tile with the room's
`flow` left smooth; Carousel and Rooms are `boards` plus `env.flow:'rigid'`
(the edges are still open, so a swipe past the last tile slides into the
empty edge); Scroll is a list or an inbox in line view; Expanse is the desk.

## Room (`env`)

Overrides the desk one key at a time, inherited by drawers inside, innermost
wins. Keys are `ENV_KEYS` in model.js; read with `setting(k)`, write with
`setSetting(k, v)`. `false` inside a bench means "off here", which differs
from leaving the key out ("the desk decides").

| Key | Values |
| --- | --- |
| `style` | `victorian` (Victoria: an old desk, baize, brass), `carca` (a walled city of tinkerers), `stelaine` (crystal stars, a floating island), `girando` (Sicilian baroque and vine), `golf97` (late-nineties desktop gray), `starry` (Starful Gothic: white pencil on night), `aero` (Aeros: teal gloss, clear skies). An aesthetic brings its own board. |
| `flow` | `rigid`, `page`, or `false` (smooth) |
| `gravity` | `false`, `sand`, `tumble` |
| `gravitytilt` | true: down is wherever the phone leans |
| `tuck` | true: bars tucked away; `false`: showing |
| `dark` | `auto`, `light`, `dark` |
| `surface` | `grid` (graph paper), `plain`, `wood` (the carcass) |
| `board`, `boardAlpha`, `slots`, `words`, `pinned` | the board's colors and strength, the palette, Words defaults, decorations pinned |

## Tools at hand

| Field | Values |
| --- | --- |
| `rail:{left:[…], right:[…]}` | up to three a side from `glass` (search), `block` (sort; hold for line view), `lock`, `swipe` (smooth or rigid), `spool` (tie two things), `stamp`, `coin` (one of anything). Not `gear`: it is on the lip (decision 302). |
| `stamp:{w, ink}` | any word (`STAMP_WORDS` are the ones Settings offers: Received, Paid, Sent, Done, Approved, Filed, Copy, Urgent, Void); ink `red`, `blue`, `black`, `green`, `violet` |
| `quick:true` | a notepad in the desk's front, lent to every front, writing into this bench (decision 297) |
| Objects in the front | an object with `front:'left'|'right'` stands in one of the six places; a spec cannot place one yet |

## Affordances

| What | How a spec says it |
| --- | --- |
| What the Magic Selector makes here | `makes:{only:['note','task',…], sizes:[]}` |
| A line that writes into a list | `MAKES('Another idea…', 'idea', [1,13,8,2], c, '@ref')` and `ref` on the list |
| A list on the board | `LIST(title, ref, b, c)`; `NEWEST(LIST(…))` for newest first |
| A place that decides | `ZONE(title, {prio:n} or {effort:n} or {tag:'x'}, b, c)` |
| Picking by stamping | the front's stamp word, and a sorting drawer `{k:'magic', set:{filter:{rules:[{f:'@stamp', op:'is', v:'Keep'}, HERE]}}}` |
| Ranking | `{k:'deck', set:{deckTap:'rank', faceup:true}}`, cards written in by a `MAKES(…, 'card', …, '@deck')` |
| Prompts to cut to | `{k:'deck', set:{faceup:true}, kids:CARDS([...])}` |
| A timer | `hourglass` (`mins`), `candle` (`burn`), `metronome` (`bpm`) |
| The way out | `LINK(title, url, b, c)` |
| A bar of progress | `{k:'progressbar', set:{tracks:'@ref'}}` on a checklist |
