# Intent

What this is for, and what to build next. Recorded **2026-09-06** from Timothy's
own answers to a direct set of questions, so this is *stated* intent rather than
intent inferred from the code.

**Read this before choosing what to build.** Where it disagrees with the rest of
the docs about **direction**, this file is newer and wins. Where it disagrees
about **mechanics** — how the code works, what was decided deliberately, the
invariants — the other docs win, always.

When something here is done, or turns out to be wrong, **edit it**. A stale
intent file is worse than no intent file.

## What it is for

Timothy's own daily desk. One user, no product.

He uses it now **to fiddle with, not yet to live in**, and he named the reason:
he has not got the layout that fits his actual life onto it. That is the gap
between a thing that works and a thing that gets used, and closing it is worth
more than any single feature.

## What is next

**Functions** — in his words, *"representing the different things one does with
paper systems."*

That is the axis for this stretch. Not more dressing on how the desk looks, but
what a paper desk lets you *do*: file, annotate, cross-reference, clip, stamp,
copy, tear out, pin, date, archive. Bureau has spent many passes on aesthetics,
slots, depth and motion, and those are good and are not banned — but look work
is no longer the default answer to "what now".

**First of them, 2026-09-06 (v1.52): the margin.** `margin` is an attribute any
object can carry — a running note, each entry dated as it is written and never
rewritten. `text` is the document and is edited; the margin is what you write
beside it, and a paper file grows by having things added rather than by the
letter being redrafted. Entries are printed rather than editable on purpose: a
margin you can go back and tidy is just the body again. On the board it shows as
a count, because an entry is a sentence and a tile has no room for one.

**Still on the list**, in rough order of how paper they are: **clip** (objects
that travel together, which containing and relating both fail to express),
**stamp** (a dated impression — received, sent, paid), and **tear out** (pulling
part of a note out as its own object).

Second, and directly useful to him: **a real personal desk layout that fits his
life.** `plans.js` exists for exactly this — a plan is a board you can put down
again. Proposing a concrete arrangement as a plan is legitimate, welcome work.

## Deliberately not next

- **Sync between devices.** It is real and it is coming, *after* the feature set
  feels complete. Export/import JSON is the bridge until then. Do not start it.
- **A native shell.** Also real, also after feature completeness. The
  dependency-free, build-step-free constraint exists partly to keep that cheap
  when the time comes, which is another reason not to relax it.

## Worth knowing

The smoke suite takes forty to ninety minutes in the nightly container, and
**Timothy has explicitly accepted that cost** because the run happens at night.
Do not water the suite down to save time.
