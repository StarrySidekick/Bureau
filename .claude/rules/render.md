---
paths:
  - "web/js/persist.js"
  - "web/js/boot.js"
  - "web/js/util.js"
  - "web/js/views.js"
  - "web/sw.js"
  - "web/index.html"
---
# Render and persist

What a render is and is not; passes; what you typed is what you read; storage and the worker.

These paragraphs were the *How to work in this codebase* section of `CLAUDE.md`,
moved here whole and unreworded so they load when a file they are about is
opened rather than in every session (decision 175). A rule for this area goes
here; a rule for every area goes in `CLAUDE.md`.

**What you typed is what you read.** `md()` made every non-blank line its own
`<p>` and threw every blank line away, so one Return read as a paragraph break
and deliberate empty rows read as nothing. **One Return is a line break** inside
the paragraph; **a blank row ends it, and every blank after the first keeps a
line of room** (`<p class="vspace">`). Counting the run is what tells the
ordinary gap between two paragraphs apart from spacing somebody asked for —
asking whether a paragraph is open cannot, because a heading has already closed
itself. `plain()` is untouched: a tile is a face, and a run of blanks on one is
still one break. See decision 157.

**`render()` writes `#frame.className` wholesale**, so anything else living on
that element has to be restated in `render()` or the next one wipes it. That is
how the cavity came to work until you ticked something and then stop, silently.

**One render is one pass, and a pass may remember.** `childrenOf()` walks every
object and runs every magic rule, and drawing a board asks it fifty times — for
the board, for every container on it, once per level of `projectStat()`, and
once per candidate cell in `freeSpot()`. `beginPass()`/`endPass()` in `model.js`
open a memo for the length of one **synchronous string build**, and `viewHTML()`
and `previewHTML()` are the only two that open one. Outside a pass the map is
null and every call is the honest walk — there is no invalidation to get wrong,
which is the whole point. Don't hold a pass open across anything asynchronous,
and don't add a mutation inside one. See decision 59.

**`renderSoon()` rebuilds on the next frame, and that is not a delayed state
change.** Where you are changes immediately; only the DOM waits, and only while
an opaque strip is over it. It exists for the pager, where the rebuild used to
land on the very frame the settle transition began on. `render()` supersedes a
pending one, so nothing renders twice.
