# What Bureau is for, and what it needs to be for it

Timothy, 2026-10-01. He asked what one would actually *do* with Bureau, given
that a lot of its dashboard side could now be an artifact made on the spot, and
what objects would bring it closer to an artifact's adaptability while staying
physical. Forty uses and sixteen objects were proposed; this file is what he
approved, with his changes, and the order to build it in.

**The frame he agreed to.** An artifact is a view: made for one question, used,
thrown away. Bureau is a place: things go in and stay, and are found again by
where they were put. So Bureau is for things that pile up over time and where
place matters, and it should hold artifact-like machines rather than compete
with artifacts.

Read this before choosing what to build. `INTENT.md` points here.

---

## 1. The uses (approved)

Each is a board or a flow, built from objects. *Have* is what exists today;
*needs* is what this file adds.

| Use | Have | Needs |
| --- | --- | --- |
| **Inbox** (the brain dump, renamed) | notepad, `guessKind()`, `intoOf()` | sorting by kind into named drawers; copper pipes to carry it |
| **Question jar** | jar | a question type or tag, and a way to draw one out (the pond) |
| **Wind up / wind down** checklists | checklist, repeat | stock flows for morning and evening |
| **Habit wall** | habit tracker compound, counters | a wall flow; graph paper for the long view |
| **Journaling** | writing surface, margin, book layout | the Daybook (FUNCTIONS T1): today's page without deciding to make one |
| **Film board** | `pj_*` film flows, departments | live use, and the fixes that come from it |
| **Storyboard** | cards, Picture | a strip layout: picture, line, shot note, in order |
| **Song workbench** | song flow, audio, metronome | live use |
| **Story outline you can reorder** | outline, list, cards | tear out (FUNCTIONS V1); a label as a heading in a list (B11) |
| **Novel or story bible** | novel flow, relations, string | wiki links between pages, and backlinks |
| **Worldbuilding wiki** *(new)* | as above | the same wiki links; a map board |
| **Art gallery** *(new)* | Painting, Picture, wall decorations | a gallery flow: frames, a label card under each |
| **Mood board** | Picture, paintings, quotes, swatches | a flow |
| **Prioritizer** *(new, from the decision board)* | priority, rating, tiers by label | the matrix layout (FUNCTIONS L1) |
| **Reading shelf** | book spines | a book from a photo (see §3) |
| **Writing archive** | spines, sorting drawers | a flow sorted by status |
| **Commonplace book** | Quote | a quote's source as a book on the shelf, tied |
| **Things you own, digitized** | Picture, bundled cut-out photographs | photograph, cut out and place (see §3) |
| **Project bench** | project flows | a build log (FUNCTIONS T2) |
| **Design docs and wikis** | text, book layout | wiki links, a contents page |
| **One page as a static site** | the reader, `faceLook()` | export one object or board as a self-contained, sized HTML page |
| **Notion, not confusing and not ugly** | all of the above | wiki links, backlinks, the lens, printed fields on a card |
| **Financial dashboard** | goals, progress bars | the Automaton, gauge and graph paper (§2) |
| **People drawer** | drawer, cards | the rolodex face |
| **Project pipeline** | drawers, drag | a column board where moving a card writes its status |

## 2. The objects (approved, with his names)

| Object | What it is | Notes |
| --- | --- | --- |
| **Garbage bin** *(new)* | Deleted things fall into a container with gravity on, where you can sift through them and take one back out | Today a delete is gone once it falls off the 20-move undo stack. The bin is the safety net STOCKTAKE §3.1 asked for, for objects at least |
| **Stamp** | A tool: tap it, then tap anything, and it is stamped (dated impression: received, paid, done, your own) | FUNCTIONS V2. Same "tap the tool, then the target" grammar as the spool |
| **String is redstone** | String carries signals: when this is checked, that moves; when this counter reaches ten, that card flips | Builds on `tug` and `countOf()`. Signals, not formulas |
| **Copper pipes** | Drop something in one end and it comes out in a named drawer elsewhere | Routing as an object; the inbox's sorting runs through them |
| **Lens** | Laid over a board, shows only what matches: a tag, overdue, untouched for a month. Custom lenses | Lets tags be a way of looking rather than a container, which always felt wrong |
| **Pond** | Shows random things from a source you choose, surfacing and sinking | The lottery drum, rethemed. Draws from your things; the coin makes new ones |
| **Mirror** | Literally a mirror: the front camera, live | `getUserMedia`, which iOS Safari allows in an installed PWA after a permission prompt |
| **Automaton** | The number cruncher: sums, counts, averages a field across a drawer | Also the name of the family of Claude-built machines (below) |
| **Gauge** | A dial reading another object's number through string | Generalises `countOf()` from counters to any number |
| **Graph paper** | Plots a value taken repeatedly | Needs `series` (FUNCTIONS A2) |
| **Radio** | Prints the latest lines from a feed | See the constraint in §3 |
| **Weather window** | The Window decoration, showing the real sky | Open-Meteo needs no key and allows browser requests |
| **Rolodex** | A face that shows one card at a time with tabs | For people, recipes, quotes |
| **Flat-pack** | A board delivered as an object; on its first tap it unfolds like origami into its drawer | The paste bridge made physical. Claude writes them |
| **Grammar doc** | The written rules for building in Bureau: every type, field, face, flow and size, in one place | So Claude builds boards reliably. Docs only |

**Automatons, in his words: they can work, as long as they are built with Bureau
in mind and integrate well.** So an automaton is not an arbitrary web page in a
box. It is a machine with declared inputs and outputs that are string, reads
and writes fields on objects it is tied to, wears Bureau's look, and saves its
state into its object like anything else. The number cruncher is the first one,
and it sets the pattern the rest follow. A custom automaton is code Claude
writes inside that frame, never outside it.

## 3. Three honest constraints

- **The radio.** A browser can only read a feed whose server allows it (the
  CORS header, a server saying "other sites may read me"). Most RSS feeds do
  not. With no backend (decision 6), the radio can only tune to feeds that do,
  or to services that re-serve feeds with that header. Worth knowing before it
  is promised.
- **Cutting out objects.** Removing a photo's background well on the device
  needs a model or a library, and Bureau has neither. iOS already does it:
  hold the subject in Photos, *Copy*, and paste a transparent PNG. So the
  first version is a paste that keeps transparency plus a manual crop, and the
  phone does the hard part.
- **A book from a photo.** Safari has no barcode reader built in. The cheap
  path is reading the ISBN off the photo or typing it, then fetching the
  cover and details from Open Library, which allows browser requests.

## 4. Order to build in

Foundations first, because most of the uses above are flows made of the
objects, and the objects mostly share three mechanisms: string as signal, a
tool that is tapped then aimed, and a source that is drawn from.

1. **Grammar doc.** Done, v2.71: `docs/GRAMMAR.md`, decision 284. Writing it
   fixed three paste bugs; its §5 is the flat-pack's specification.
2. **Garbage bin.** Done, v2.72, decision 285: Delete puts things in a wire
   wastebasket whose board tumbles; Put Back, Delete for Good and Empty.
3. **Inbox with copper pipes.** The capture path, named the biggest idea since
   2026-09-23.
4. **Stamp and the lens.** Two tools; the lens retires the tag-as-container.
5. **String as redstone**, then **Automaton, gauge, graph paper** on top of it,
   then the **financial dashboard** as a flow of them.
6. **Wiki links and backlinks, rolodex, reorderable outline**: the Notion
   cluster, which serves the bible, the worldbuilding wiki and design docs.
7. **Flat-pack** and **one page as a static site**.
8. **Mirror, weather window, pond, radio**: the outside world.
9. **Digitizing things and books from photos.**
10. **The flows**: each use in §1 as a stock flow, mostly data, built from 1–9.
