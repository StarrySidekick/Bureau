---
name: bench
description: Design, build, rework or review a Bureau bench, a container set up so one activity is easier in it than anywhere else (its arrangement, room, navigation, drawer front and affordances). Use when Timothy asks for a new bench, wants a bench changed, critiqued or made less cramped, asks what a bench should have or how it should move, or when a bench needs something Bureau cannot do yet. Covers the design questions, the navigation patterns, the stockplans.js spec, wiring a bench in, and testing it in WebKit.
---

# Designing and building a bench

A **bench** is Timothy's word (decision 295) for a container set up so one
activity is *"easier to accomplish because it's set up to be so"*. It is not
only what is on the board: *"it's also about what tools are available and what
affordances are immediately present."* In the code a bench is a stock plan in
`web/js/stockplans.js` (`plan`), made by a type (`wf_*` for a way of working,
`pj_*` or `film` for a project), carrying a room (`env`).

**Say "bench", never "flow" or "workflow"**, in the interface and in anything
written for Timothy. The code keeps `plan`, `workflow` and `wf_*`.

## Read first

1. `docs/BENCHES.md`: what a bench is, the seven built, the **ledger** of
   features benches share, and the order. It is where "what now" is read from.
2. `docs/NAVIGATION.md`: how a bench is moved around in (tile size, layout,
   scroll type, zoom type, the front, stations), the five patterns, and each
   current bench reviewed through them. **Much of it is proposed, not built**;
   `reference/dials.md` says which is which.
3. `docs/GRAMMAR.md` §7 and §8: Timothy's standing preferences for a board, and
   every type, field and bench key the app accepts (generated, so current).
4. The newest entries of `INTENT.md` and the last few decisions in
   `docs/DECISIONS.md` (from 292 on are about benches).
5. Before setting any type's size: the Workshop artifact (CLAUDE.md links it).

## The layers of a bench

| Layer | The question | Where it lives |
| --- | --- | --- |
| **Arrangement** | what is on each tile, and where | the spec's `on` and `boards` |
| **Navigation** | how you get around it: tile size, layout, scroll, zoom, where it opens | `start`, the room's `flow`; the rest is proposed (`reference/dials.md`) |
| **Room** | what it looks and behaves like inside: aesthetic, board, gravity, bars | `env` (`ENV_KEYS`, read with `setting()`) |
| **Tools at hand** | what is one press away from anywhere in it | `rail` (three a side), objects standing in the front, the stamp's word |
| **Affordances** | what a placement or a press *decides* | `makes.only`, zones, stamps with a sorting drawer, a ranking deck, notepads writing `into` a list |
| **Setup** | what it asks on its first tap | setup cards, `sref` |

## The design process

Work through these in order and write the answers down before writing a spec.
Each one narrows the next.

1. **Name the one thing**, in Timothy's words where he gave them. One bench,
   one activity (*"one board, one thing"*). If the request mixes two, say so
   and propose two benches.
2. **Walk the activity as verbs and moments.** What does a person *do*, in what
   order? (Brainstorm: write everything, then pick. Film: write, cast, board,
   prep, shoot, cut.) Each **moment** is a candidate tile, and each **verb done
   everywhere** is a candidate tool for the front.
3. **Pick the navigation pattern** from the moments
   (`reference/dials.md` has the dials behind each):

   | The moments are… | Pattern | Example |
   | --- | --- | --- |
   | one, all visible at once | **Sheet** | Prioritizer |
   | a growing list read in order | **Scroll** | Brain Dump, Journal |
   | stages, done in order | **Carousel** | Story Builder |
   | places you move between as needed | **Rooms** | Film |
   | spatial: where a thing sits is the thinking | **Expanse** | the desk, a moodboard |
   | one center fed from one side, emptied to the other | **Hub** | Project Management |

4. **Lay out each tile** on 8 by 14 (see *Laying out a tile* below). If a
   moment does not fit on one tile with room to breathe, **split it across two
   tiles rather than shrinking things**; that is Timothy's "a little cramped".
5. **Choose the front**: up to three a side of the knob, from the verbs done
   on every tile. The gear is on the top lip (decision 302), not in the front.
   A place left empty is fine: things can be stood there.
6. **Choose the room**, with a reason that is about the activity (a
   screening room for film, an old desk for a journal). Gravity off unless
   the bench is *about* things settling. Say why in the spec's comment.
7. **Choose the affordances**: what the Magic Selector should make here
   (`makes.only`), and which decisions should be a *placement* or a *press*
   rather than a menu (a zone, a stamp a sorting drawer collects, a deck that
   ranks, a notepad writing into a list).
8. **Name the gaps.** Anything the bench needs that Bureau cannot do goes in
   the `BENCHES.md` ledger, scoped as a Bureau feature any board can use. Never
   a branch on a bench's or a type's name (`has()`, `faceOf()`, `shapeOf()`
   only). **Ask Timothy before making a new object type** (his rule, decision
   296); prefer extending an object that exists (a Button that does one more
   thing, a deck that ranks).
9. **Propose before building** when the bench is new or the change is
   structural: the one thing, the moments as tiles (an ASCII sketch of the
   layout), the front, the room, the gaps. Small reworks of a built bench can
   go straight to building.

## Laying out a tile

- A tile is **8 wide by 14 tall** on the phone, authored with `b:[x, y, w, h]`,
  1-based. Rows 13 and 14 are **the way in**: a notepad (`MAKES()`), added for
  you unless the spec says `inbox:false`. So the bench's own things use rows 1
  to 12.
- Without `raw:true` the builder **stretches things to fill twelve rows**
  (`fillRows()`); with it, empty rows stay empty. New benches use `raw:true`
  and are laid out to the row on purpose.
- **What matters is in the first screenful**, top left first.
- **Phone first.** Check every tile in WebKit at an iPhone's size; a 1×1 thing
  at 49 points is fine, smaller cells need care (NAVIGATION §2.1).
- **Fewer, real things**, each the type that says what it is (a question is a
  `question`). Titles plain, American English, sentence case, no exclamation
  marks. Bodies use the house prompt pattern, a bold label then room:
  `**Who they are before —** `.
- **Every bench has a way out** to where the work is done (decision 194): a
  `LINK()` to the app or site.
- Use the shorthands in `stockplans.js` (`LIST`, `MAKES`, `LINK`, `CAL`,
  `WITH`, `NEWEST`, `CARDS`, `ZONE`, `STAGES`, `AGAIN`); `reference/spec.md`
  lists them.

## Building it

`reference/spec.md` is the whole checklist. In short:

1. The spec in `SPECS` in `stockplans.js`, with a comment saying what it is
   for in Timothy's words and why each choice.
2. Its type: a row in `WORKFLOWS` (model.js) for a way of working, or the
   project or life type it belongs to.
3. Its key in `BENCH_READY` (model.js), or it is shelved and hidden.
4. A migration in `persist.js` that adds it to an existing desk's `plans` by
   key, or replaces the stored one (migration 62 is the pattern).
5. A block in `test/safari.mjs` asserting what makes it *that* bench, with a
   screenshot of every tile; look at them.
6. `node scripts/grammar.mjs` (the vocabulary in GRAMMAR §8), the smoke
   blocks it touches, `CACHE` and `APP_VERSION`, a decision in
   `docs/DECISIONS.md`, `BENCHES.md`, a line in CLAUDE.md, and INTENT.md if
   Timothy said something new about what he wants.

## Reviewing a bench

When asked what a bench is missing, or whether it is any good, use the rubric
in `reference/review.md` and answer as a table, one row per bench, then the
two or three changes that matter most. Be specific: "the first tile has nine
things and the line" beats "it feels busy".

## Things that bite

- Read room settings with `setting(k)` and write them with `setSetting(k, v)`,
  never `S.look.k` (decision 293).
- A spec's `rail` names tools from `RAIL_TOOLS` in views.js; anything else is
  dropped silently. `gear` is no longer one of them.
- A stamp's word can be any word (`stamp:{w:'Keep', ink:'green'}`), but Board
  settings only offers `STAMP_WORDS`, so a bench's own word cannot be picked
  again by hand once changed.
- A stored bench is user data: changing a spec changes nothing on an existing
  desk until a migration copies it, and a bench already put down is an
  arrangement the migration must leave alone.
- Several tiles: the first tile is `on`, the rest are `boards:[{at:[x,y], on}]`
  relative to it; `[1,0]` is to the right, `[0,-1]` above. Each is authored
  on its own 8 by 14.
- A bench cannot yet state its board's kind, tile size or edges, and a paste
  cannot state a board at all (GRAMMAR §5). Both are on NAVIGATION's build
  order; until then, do not promise them.
