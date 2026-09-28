# Stocktake — 28 September 2026

Timothy asked, the same day he asked for the List face (decision 239): *"do
kind of like a project diagnostic and you tell me if there's anything that
we're missing or we need, or object types, or philosophically if there's some
holes … I'm feeling a little bit lost. I think we're biting off more than we
can chew."*

This is not a code review (`DIAGNOSTIC.md` is the last of those, and is kept as
written). It is a look at scope. Like that file, it should not be edited to
agree with what happens afterwards.

---

## 1. The shape of it, counted

| | |
| --- | --- |
| JavaScript | 26,500 lines in 18 modules |
| CSS | 10,700 lines in 3 files |
| Decisions | 239, and `DECISIONS.md` is 10,500 lines |
| Types | 120 (Timothy's front row alone is 19, after decision 204 set it at twelve) |
| Stock flows | 41 |
| Smoke test | 148 blocks, 40–90 minutes |
| Commits | 50 between 20 and 28 September; 14 on the 27th |

And the sentence that matters, from `INTENT.md`, 6 September: *he uses it
now to fiddle with, not yet to live in, because he has not got the layout that
fits his actual life onto it.* Three weeks and about a hundred decisions later
nothing in the docs says that has changed.

## 2. The feeling is accurate

"Biting off more than we can chew" is a fair reading of the record. The sign
is not the volume, it is the **reversals**, because each one is a frame being
decided after furniture was put on it:

- The camera (187) was built, lived with through five rounds, and tabled (203).
- Proportional boards (188–192) became a setting, off by default (195).
- Line view striped its rows (217) and was undone two days later (219).
- The picker was twelve physical things (204); it is nineteen.
- Stock plans were replaced three times (194, 196, 236–238).
- The Life drawer wore a report, then a drawing, then a plain front (131, 136, 196).

None of these was a bad call on its own. Together they say the app has been
exploring, which is fine, but exploring and finishing are different jobs and
the last month has been almost all the first.

## 3. What is actually missing

Ranked by what stops Timothy living in it, not by how interesting it is.

1. **A safety net for the data.** Everything is in one browser's local storage
   on one device, and the only backup is a manual export. That is fine while
   you are fiddling and a real risk the day you start living in it. This is
   not sync (which is deliberately deferred); it is an automatic snapshot and
   a restore. Small, and it protects everything else.
2. **Two devices.** He uses an iPhone and a Mac. Sync is "after the feature
   set feels complete", but the feature set grows every day, so that condition
   is never met. Worth deciding on evidence: live on one device for two weeks
   and see whether the other one is missed.
3. **Capture without deciding.** The brain dump that sorts itself by kind has
   been named the biggest idea in his notes since 23 September and is still not
   built. The Brain Dump flow is a spawner, a jar, three lists and a deck of
   prompt cards: the sorting is by hand. Every other way in asks you to choose a
   type and a place first, which is the moment a thought gets lost.
4. **"What do I do now?"** Bureau is organised by *place* (boards) and the
   daily question is organised by *time*. The parts exist (the Today magic
   drawer, ranks, deadlines, the calendar's agenda face) but there is no one
   place that is the morning. Things 3 is built round exactly that. With the
   List face, a Today list on the home board is now one object.
5. **Nothing notices neglect.** A paper desk has the tickler file; nothing here
   says a thing has sat untouched for a month. Lower than the four above.

**Object types: none missing.** 120 is more than a one-person desk will use.
The List face was a real gap and it was the last view that was missing: a
container can now show its contents on the outside as a front, a checklist, a
list, a calendar, a timeline, a collage or a spine. That is a complete set.

## 4. The philosophical holes

**Types and flows have fused.** The founding rule is that a type is a named
preset of attributes. `lf_*`, `pj_*` and `wf_*` are 34 types whose real
content is the board they come with, so the type list has become the template
menu. That is why the picker needs a front row, a dropdown, families, setup
cards, a shape ring, and a Workshop to rearrange it all. A Feature Film is a
Project that comes with a flow, and should be that, chosen on the setup card,
rather than one more type. Recommendation: no more `lf_`/`pj_`/`wf_` types;
flows stay flows.

**Faces and layouts are one idea.** A face is a container's contents shown on
the outside, a layout is the same contents shown inside. The List was missing
because it existed as a layout and not as a face. Worth keeping in mind so the
next "missing link" is recognised as a view rather than a new type.

**The instruments are the fun part, and should stay a reward.** Portals with
vortices, coins, spools, counters with typefaces: these are what make Bureau
Bureau and not Things. They are also the easiest work to reach for when the
real work (putting a life on the board) is unclear.

## 5. What to do

A **freeze of two weeks** on new types, faces, flows and look work. During it:

1. **Automatic backup** (§3.1). One small feature.
2. **Put the real life on the home board.** A Today list, an inbox, the three
   to five projects actually active, the habits actually kept. Use it daily.
3. **Fix only what hurts while living in it**, and write each pain into
   `INTENT.md` as it happens.
4. **The self-sorting brain dump** as the one feature, because it is the
   capture path.

Then decide sync with two weeks of evidence.

Two process notes. `CLAUDE.md`'s *Current state* has grown into a changelog of
about 150 lines that every session reads before anything else; it belongs in
`ROADMAP.md`, with `CLAUDE.md` kept to mechanics. And `test/smoke-only.mjs`
fails on any block that reads block 2 (it times out waiting for
`[data-style3="starry"]`), on the code as it was before today's change too.
