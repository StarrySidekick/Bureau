# Benches: five environments, made good

Scope, 2026-10-02. Timothy: *"each bench is a fully all inclusive custom
environment with the settings aligned to the particular thing we are trying to
do… I want to hone in on the best five and make them good."* And the process
he wants: *"when we have an idea of something we'd have to build in order to
make the environment more workable, we can also scope out the feature and build
it so that it's now a feature of Bureau, and then it can be added to other
workflows that might need it."*

`USES.md` is what Bureau is for; this file is how the five benches that matter
most get there. Where they disagree about order, this file is newer.

---

## 1. What a bench is

A **flow** today is an arrangement: what sits on a board and where (decision
121, `plans.js`). A bench is a flow that also brings **the whole room with
it**. Opening one changes how Bureau behaves while you are inside it.

| Layer | What it is | Exists today? |
| --- | --- | --- |
| **Arrangement** | the objects and where they sit, on one or several tiles | yes: the flow |
| **Environment** | the settings that apply while you are inside: aesthetic, board color, surface, scroll or rigid swipe, bars tucked, gravity, default sort and view, the Words defaults | **no**: all of these are global (`S.look`) |
| **Kit** | what the Magic Selector and the ring offer here, and the six places in the drawer front | partly: `makes.only` (199) and `rail` (220) are per board |
| **Setup card** | the questions it asks on its first tap | yes: `SETUPS`/`ASPECT_STEPS` (229, 237) |
| **Features** | the objects and tools it is built from | some; the rest is §4 |

So the one new mechanism is the **environment**, and the rest is the existing
pieces gathered under one name.

### The environment, proposed

- A container may carry **`env`**: a small object of setting overrides,
  `{style, board, surface, flow, tuck, gravity, sort, layout, words}`.
- **It inherits downward.** Inside a bench, every drawer within it wears the
  bench's environment unless it says otherwise. Leaving the bench puts the
  desk's own settings back.
- **One reader**, `envOf(key)`: walk from the board you are on up through its
  parents to the desk, return the first value set, else `S.look`. Every place
  that reads one of those keys from `S.look` today reads it through `envOf()`
  instead. `applyLook()` merges the chain, so the aesthetic changes on the way
  in and back on the way out.
- **Settings changed inside a bench write to the bench**, with a *Use
  everywhere* button beside the row that writes the desk's instead.
- A flow carries `env` and `kit` like it carries `rail` now, so a stamped bench
  arrives with its room.
- Board settings shows a small line at the top, *Set by the Writing bench*, on
  any row the bench is deciding.

This is "give me the option rather than the decision" (INTENT, 2026-09-22) one
level up: the desk keeps its settings, and each bench may disagree with them.

## 2. The five, proposed

Chosen by four tests: something done **weekly or more**, so it is lived in; it
**piles up** over time and place matters (the USES frame); one per heading of
Timothy's four (Project Management, Life Management, Writing Tool, Catalog),
with Life getting two because it is daily; and the five together need **the
most shared features**, so building them builds Bureau.

### 1. The Day bench (Life Management)

The place you start and end the day. It is what closes the gap INTENT names:
Bureau is fiddled with rather than lived in because nothing on it is daily.

- **On it:** the Inbox and its pipes; today (what is due, read off the whole
  desk); a wind-up and a wind-down checklist that reset each morning; the
  habit wall; today's page of the Daybook; a stamp.
- **Environment:** quiet aesthetic, smooth scroll, bars showing, no gravity,
  sorted by when.
- **Kit:** task, thought, habit tick, note, the stamp.
- **Needs:** daily reset (counters and checklists), the Daybook, the stamp,
  the lens (*overdue*, *today*), series and graph paper (the habit wall's long
  view).

### 2. The Film bench (Project Management)

One film from idea to delivery. The film flows exist (`shortfilm`,
`featurefilm`, decision 238) and are the most worked-out project boards.

- **On it:** the departments; a storyboard strip; a scene pipeline (idea,
  written, shot, cut); cast and crew; shoot days on a calendar; a build log.
- **Environment:** dark aesthetic, rigid swipe between departments, bars
  tucked.
- **Kit:** shot, scene card, character, location, Picture, the stamp.
- **Needs:** the pipeline (moving a card writes its status), the strip layout,
  the rolodex, the stamp (*approved*, *shot*), the lens (by department), tear
  out.

### 3. The Writing bench (Writing Tool)

One piece of writing from notes to draft, Bear's feel. Serves the novel, the
short story, the essay and the screenplay flows.

- **On it:** the outline you reorder; the bible (characters, places, rules)
  linked to each other; the drafts; a margin of notes; a word counter.
- **Environment:** paper aesthetic, the Words defaults set to a reading
  typeface, smooth scroll, bars tucked.
- **Kit:** note, character, place, chapter, quote.
- **Needs:** wiki links and backlinks, tear out, a label as a heading in a
  list, the pipeline (draft, revise, done), the lens.

### 4. The Shelf bench (Catalog)

What you take in: books, films, records, quotes. Visual and personal, his
word for catalogs.

- **On it:** the reading shelf as spines; films watched; the commonplace book
  of quotes, each tied to the book it came from; a want-to list; a rolodex of
  quotes.
- **Environment:** warm aesthetic, wood surface, locked by default so it reads
  as a showcase (decision 287).
- **Kit:** book, film, record, quote, review.
- **Needs:** a book from its ISBN (Open Library), quote-to-source tied with
  string, the rolodex, the lens (by tag, *unread*), wiki links.

### 5. The Money bench (Life Management)

Bills, accounts, runway. The financial dashboard in USES, and the one bench
that is mostly machines.

- **On it:** accounts with their balances; bills that repeat and get stamped
  *paid*; a runway gauge; spending on graph paper; a no-spend-day counter.
- **Environment:** plain aesthetic, smooth scroll, no gravity.
- **Kit:** bill, account, counter, the stamp.
- **Needs:** string as signal, the Automaton (sum a field across a drawer),
  the gauge, series and graph paper, daily reset, the stamp.

**Alternates**, if one of the five is wrong: the **Practice bench** (song and
music practice: metronome, recordings, minutes on graph paper), the
**Worldbuilding bench** (a wiki and a map), the **People bench** (the
rolodex), the **Prioritizer** (the matrix).

## 3. The process: a bench need becomes a Bureau feature

Every gap a bench shows goes through the same four steps, and never into the
bench itself.

1. **Write it in the ledger** (§4), with the benches that want it.
2. **Scope it as a general thing:** an attribute, a type, a tool, a face or a
   setting, named in Bureau's grammar. *Never* a branch on a bench's name, the
   same rule as never branching on a type's name.
3. **Build it, test it in WebKit, write its decision.** It is then a feature
   of Bureau: in the picker, in the grammar (`scripts/grammar.mjs`), and
   available to any flow.
4. **Put it into every bench in the ledger row**, then live in the bench and
   write down what is still missing. That list is the next round.

So a bench is a forcing function and the feature is the product.

## 4. The ledger

Sorted by how many of the five need it. *Status* is kept current.

| Feature | Day | Film | Writing | Shelf | Money | Status | Scope |
| --- | :-: | :-: | :-: | :-: | :-: | --- | --- |
| **Bench environment** (`env`, `envOf()`) | x | x | x | x | x | proposed | §1 |
| **Stamp** (tap the tool, then things) | x | x | x | | x | **done**, v2.86 | decision 292 |
| **Lens** (show only what matches) | x | x | x | x | | to scope | USES §2 |
| **Wiki links and backlinks** | | x | x | x | | to scope | USES §1 |
| **Tear out** | x | x | x | | | to scope | FUNCTIONS V1 |
| **Series and graph paper** | x | | | | x | to scope | FUNCTIONS A2 |
| **Daily reset** (counter, checklist) | x | | | | x | to scope | ROADMAP §0zj |
| **Pipeline** (column moves write status) | | x | x | | | to scope | USES §1 |
| **Rolodex** face | | x | | x | | to scope | USES §2 |
| **Strip layout** (storyboard) | | x | x | | | to scope | USES §1 |
| **Daybook** | x | | x | | | to scope | FUNCTIONS T1 |
| **String as signal** | x | | | | x | to scope | USES §2 |
| **Automaton and gauge** | | | | | x | to scope | USES §2 |
| **Book from ISBN** | | | | x | | to scope | USES §3 |

## 5. Order

Bench by bench, not feature by feature, so one bench is good before the next
is started, and each later bench reuses what the earlier ones built.

1. **The environment** (needed by all five).
2. **The Day bench:** stamp, lens, daily reset, series and graph paper,
   Daybook. Then live in it for a few days.
3. **The Writing bench:** wiki links, tear out, the pipeline, list headings.
4. **The Film bench:** strip, rolodex (the pipeline, stamp and lens are
   already built).
5. **The Shelf bench:** book from ISBN (rolodex, wiki links and lens already
   built).
6. **The Money bench:** string as signal, automaton, gauge (series, stamp and
   daily reset already built).

By the fifth bench, four of its six needs are already built. That is the
process working.

## 6. Questions for Timothy

1. **The five.** Are these the five, or does an alternate replace one?
2. **Settings inside a bench.** Changing a setting inside a bench changes the
   bench only, with *Use everywhere* beside it. Right, or the other way round?
3. **Aesthetic per bench.** Should a bench be allowed its own aesthetic, so
   walking into the Film bench turns the room dark? It is the biggest visual
   change and the one most likely to feel like a different app.
4. **One bench or many.** Is a bench a single place (one Day bench on the
   desk), or a type you can make several of (a Film bench per film)? The Day
   and Money benches read as one each; Film and Writing as one per piece.
5. **The order.** Day first, because it is daily. Or Film first, because it
   is the most worked out.
