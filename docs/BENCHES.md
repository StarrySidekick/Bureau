# Benches: the environments, made good

Scope, 2026-10-02, revised the same day with Timothy's answers. Timothy:
*"each bench is a fully all inclusive custom environment with the settings
aligned to the particular thing we are trying to do… I want to hone in on the
best five and make them good."* And the process he wants: *"when we have an
idea of something we'd have to build in order to make the environment more
workable, we can also scope out the feature and build it so that it's now a
feature of Bureau, and then it can be added to other workflows that might need
it."*

`USES.md` is what Bureau is for; this file is how the benches that matter most
get there. Where they disagree about order, this file is newer.

**Built so far:** the environment and zones (decision 293), the rubber stamp
(292), and three benches: **Brain Dump**, **Prioritizer**, **Film** (293).
The Brain Dump was rebuilt as an inbox you write into, with the tray (296).

---

## 0. Timothy's answers (2026-10-02)

1. **The five:** yes, and add a **Brain Dump / Inbox** bench and a
   **Prioritizer**. Seven.
2. **What a bench is:** *"benches aren't necessarily just about what's on the
   board already, it's also about what tools are available and what
   affordances are immediately present (in a design sense). A bench represents
   an environment where the particular thing the bench is about is easier to
   accomplish because it's set up to be so."*
3. **Aesthetic per bench:** *"absolutely, even outside of Victoria. The more
   custom the better, as long as it can be mixed and matched and used
   elsewhere too, like a system."*
4. **One or many:** *"a bench is a workflow, you can have more than one of
   the same bench if it's for a film for example and you have two films
   you're working on, but for like a brain dump bench you're most likely
   going to have one."*
5. **Order:** skip the Day bench for now; build the Brain Dump and two others
   from the list. The two chosen were the **Prioritizer** and **Film**,
   because the three share one new feature (zones): the dump empties a head,
   the Prioritizer decides what matters, and the Film bench is where it gets
   made.

## 1. What a bench is

**Every flow is called a bench now** (decision 295, Timothy: *"all mentions
of workflow or flow should be replaced with bench in all places"*). A bench is
an arrangement, what sits on a board and where (decision 121, `plans.js`,
`plan` in the code), and it may also bring **the room and the tools** with it,
so the thing it is for is easier to do in it than anywhere else. The ones not
yet worked on as benches are **shelved** for now: only Brain Dump,
Prioritizer, Short Film and Feature Film are offered (`BENCH_READY`).

| Layer | What it is | Where it lives |
| --- | --- | --- |
| **Arrangement** | the objects and where they sit, on one or several tiles | the bench's objects (`plan`) |
| **Room** | the settings that hold inside it: aesthetic, palette, board color and strength, light or dark, surface, scroll or rigid swipe, bars, gravity, Words defaults, pinned | `env` on the container (decision 293) |
| **Tools at hand** | the drawer front's tools, including the stamp and what it says | `rail`, `stampw`/`stampink` |
| **Affordances** | what the Magic Selector makes here, and zones that turn a placement into a decision | `makes.only`, `zone` objects |
| **Setup card** | the questions it asks on its first tap | `SETUPS` |

A bench is a **Bench type** (`wf_*` in the code) or a project type laid out as a bench, so there
can be several of one (a Film bench per film) or one of another (the Brain
Dump).

### The room (`env`), as built

- A container carrying `env` is a bench. `env` overrides the desk's settings
  **one key at a time** (`ENV_KEYS` in model.js), which is the mixing and
  matching: an aesthetic from one place, a rigid swipe, the desk's own board.
- **It inherits downward.** A drawer inside a bench wears the bench's room
  unless it is a bench itself; the innermost wins.
- **One reader and one writer.** Every place that reads one of those settings
  calls `setting(k)`; every place that writes one calls `setSetting(k, v)`,
  which inside a bench writes the bench. `envSync()` at the top of `render()`
  works out the room you are standing in, and walking in or out of a bench
  that looks different reapplies the look (`LOOKSIG` in look.js).
- **An aesthetic brings its own board.** Where a bench decides the aesthetic
  more closely than the board, the board and its strength are that
  aesthetic's own, and a board the bench's drawer was born with steps aside.
- **Board settings inside a container has a Bench section:** *Make this a
  bench*; what the bench decides, each with *Desk's* (forget it, the desk
  decides) and *Everywhere* (make it the desk's too); the aesthetic picker;
  *Stop being a bench*.
- A bench carries `env` and `stamp` the way it carries `rail` and `makes`, and
  one you save keeps them, so a bench's room is reusable anywhere.

### Zones, as built

A **zone** (`zone`) is a place on a board that means something: a wash of
color with its name and what it gives along the top. A thing **dropped** in it
is given what it says (`writes`): a priority, an effort, a tag. A tag is the
zone's own on its board, so moving a thing to the next zone takes the last
one's off. That makes four zones a **matrix** and a row of them a
**pipeline**. A field comes with its trait (a task given a priority shows
one), the write rides the drop's undo, and **a new thing never lands in a
zone by itself**, because being in one is a decision.

## 2. The seven

### Built

**1. Brain Dump** (`wf_braindump`, one per desk). Since decision 296 the
bench **is the inbox**: on the desk a list front with its own entry line, so
a thought goes in without opening it; opened, line view with the entry line
on top and every line listed. Each line is guessed and says its guess on a
label (tap for the next kind); swipe left deletes, right asks when; hold it
and a tray of drawers rises above the front to carry it into. In **Aeros**
(clear skies), nothing falling, the bars showing. Front: glass, the stamp
(says *Filed*, blue), the coin; the spool, the gear.

**2. Prioritizer** (`wf_prioritizer`). A matrix of four zones, importance
across and effort down: **Do now** (priority 5, easy), **Plan it** (4, hard),
**Squeeze in** (2, trivial), **Let it go** (0, punishing). Two empty rows
under it where new things arrive, a deck that asks the questions, a
ten-minute hourglass, and the way in along the bottom. In **Golf 97**. Front:
glass, block (sort), the stamp (says *Done*, green). Because the zone writes
real fields, every board's *Most important first* agrees with the decision.

**3. Film** (`film`, `pj_featurefilm`, one per film). The film benches with
their departments, plus a **scene pipeline** board: four zones a scene card
walks across, *Written*, *Prepped*, *Shot*, *Cut*, each giving its tag. In
**Starful Gothic** (a screening room), with a rigid swipe from department to
department. Front: glass, the stamp (says *Approved*, red), the spool, the
block, the gear.

### Next

**4. Writing** (Writing Tool). One piece from notes to draft, Bear's feel.
Needs wiki links and backlinks, tear out, a label as a heading in a list; its
draft, revise, done pipeline is zones, already built.

**5. Shelf** (Catalog). Books, films, records, quotes. Needs a book from its
ISBN (Open Library), quote tied to its source, the rolodex, the lens.

**6. Money** (Life). Bills, accounts, runway. Needs string as signal, the
Automaton, the gauge, series and graph paper, daily reset; the stamp
(*Paid*) is built.

**7. Day** (Life), set aside for now. Needs daily reset, the Daybook, the
lens, series and graph paper.

## 3. The process: a bench need becomes a Bureau feature

1. **Write it in the ledger** (§4), with the benches that want it.
2. **Scope it as a general thing:** an attribute, a type, a tool, a face or a
   setting, named in Bureau's grammar. *Never* a branch on a bench's name.
3. **Build it, test it in WebKit, write its decision.** It is then a feature
   of Bureau: in the picker, in the grammar, and available to any bench.
4. **Put it into every bench in its row**, then live in the bench and write
   down what is still missing. That list is the next round.

Zones are the first proof: the Prioritizer asked for a matrix and the Film
bench for a pipeline, and one feature answered both.

## 4. The ledger

| Feature | Dump | Prio | Film | Writing | Shelf | Money | Day | Status |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| **Room** (`env`, `setting()`) | x | x | x | x | x | x | x | **done**, 293 |
| **Stamp** | x | x | x | x | | x | x | **done**, 292 |
| **Zones** (matrix, pipeline) | | x | x | x | | | | **done**, 293 |
| **Tray** (hold a line, drag it to a drawer) | x | x | | x | | | x | **done** in inboxes, 296 |
| **Guess label** (tap to change the kind) | x | | | | | | x | **done** in inboxes, 296 |
| **Lens** (show only what matches) | x | x | x | x | x | | x | to scope |
| **Wiki links and backlinks** | | | x | x | x | | | to scope |
| **Tear out** | x | | x | x | | | x | to scope |
| **Series and graph paper** | | | | | | x | x | to scope |
| **Daily reset** | | | | | | x | x | to scope |
| **Rolodex** face | | | x | | x | | | to scope |
| **Strip layout** (storyboard) | | | x | x | | | | to scope |
| **Daybook** | | | | x | | | x | to scope |
| **String as signal** | | x | | | | x | x | to scope |
| **Automaton and gauge** | | | | | | x | | to scope |
| **Book from ISBN** | | | | | x | | | to scope |

## 5. Order from here

1. **Live in the three built benches** and write down what is missing.
2. **The lens**: six of the seven want it, and it would let the Brain Dump
   and the Prioritizer show *only what is undecided*.
3. **Writing**: wiki links, tear out, list headings.
4. **Shelf**: book from ISBN, the rolodex.
5. **Money**: string as signal, automaton, gauge, series.
6. **Day**.

## 6. Still open

1. Should **a room be saved on its own**, so the Film bench's room can be put
   on a drawer that is not a film (a named room, picked from a list)? Today it
   travels with a bench, or is set by hand in the Bench section.
2. Zones give priority, effort and a tag. Others worth adding: a **date**
   (a "This week" zone), a **color**, a **stamp**.
3. Should **leaving a zone** take back what it gave? Today it keeps it until
   another zone says otherwise, which is how a pipeline remembers.
