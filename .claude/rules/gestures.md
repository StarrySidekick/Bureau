---
paths:
  - "web/js/gestures.js"
  - "web/js/wire.js"
---
# Gestures

Drag, drop, hold, tap, pinch, toss and swipe; the holding space and the rail pull; the lock; the one delegated listener.

These paragraphs were the *How to work in this codebase* section of `CLAUDE.md`,
moved here whole and unreworded so they load when a file they are about is
opened rather than in every session (decision 175). A rule for this area goes
here; a rule for every area goes in `CLAUDE.md`.

**A tap is answered once.** `onUp` answers a tap on a tile and the browser's
trailing click used to answer it again — invisible for everything idempotent,
which is nearly all of `tileTap`, and fatal for play, where the first call
started the video and the second stopped it before a frame had gone by. The tap
branch sets `gestureFlags.suppressClick`, like every other gesture that acts on
pointerup, and clears the selection the click would have cleared. See decision
158.

**A falling board's tiles are not where their boxes say they are**, and that is
the one class of bug this mode produces. Anything that reads the model to decide
what the *screen* means gets a stale answer, quietly. Two were shipped and fixed:
`justmade` animates a transform and an animation beats an inline style, so a new
object sat in its cell for the length of the drop-in and then snapped to the heap
(`justmadeglow` under `.grid.falling` is the glow without the fall — the arrival
*is* the fall there); and the Magic Selector asks which objects the rubber band
crosses to tell a sketch from a lasso, found three tiles nobody could see, and
made nothing. A falling board keeps the **size** you drag out and gives up the
**place** — `G.falling` in gestures.js, and `placeAtPending()` takes a size that
arrives with no position. Before adding anything that reads a box to decide what
a cell means, ask what it does on a board that has let go. See decision 166a.

**Each of the three targets on that face keeps a tap and a hold, and the words
fall through to the tile.** The box ticks and, held, plucks the line out; the
words change and, held, put the *drawer* in your hand; the front opens and, held,
does the same. The pluck used to arm anywhere on the line, and a face is lines
from edge to edge — so holding a checklist took a task out of it wherever your
finger landed and there was no tile left to pick the drawer up by. `onDown`
therefore matches `.cline[data-pluck] > .clbox` and not the line, and everything
else on the face reaches the tile branch below. See decision 169.

**The drawer along the bottom holds things, and you take them out where you
want them.** Pick a tile up on a phone and it
stands ajar under the tile; let go over it and the object leaves the board and
waits in the **holding space**, which is how a thing is carried to another
desk. Its mouth is the **whole open front** (`AJAR_GRAB`) with a second, higher
line to leave by (`AJAR_KEEP`) — coming in and going out are two numbers, which
is what a detent is; one line is a switch that shuts while you are aiming at
it. Dragging a `.helditem` **out** of the panel is the third act of the
gesture: built in the pen's shape (the press is claimed without consuming the
tap, so a tap still puts it down here), aiming at a drawer or at a **cell**,
and the panel `standaside`s — it slides to its own closed position while you
carry one out and comes back when you let go, because it is over the board and
`elementFromPoint` would hit it before any grid. It slides rather than closing
because the gesture is still running and it has to come back if you let go over
nothing; a phone panel is a fixed overlay, so nothing is relayed out either
way. See decision 128. A held object is `parent: HOLD` — a *reserved id*, `'__hold'`, exactly as
ROOT is, not an object — so there is nothing to seed, migrate, export or reap;
ask `isHeld(o)` and `heldObjects()`, go through `holdIt`/`unholdIt`. Both boxes
are cleared going in, because HOLD is not a coordinate space, and `ensureBox()`
places it fresh coming out. **A magic drawer cannot see into it** —
`inContainer()` refuses a held object before scope and before the archive, or
"everything unfinished" would draw it straight back onto the board it was taken
off and it would be in two places. The panel is `fit`: as tall as what is in
it. Held things are drawn at their **type's desk size**, not the box they had —
a phone task is eight cells by one, and scaled to a thumbnail that is a sliver.
See decision 107.

**The rail's pull has two detents, and they are the same drawer read
literally.** A little way (`PULL_HOLD`) opens the drawer onto what is in it;
the whole way (`PULL_OPEN`, a quarter of the screen) pulls it clean out of the
desk, which is the new-object picker. The long one is unchanged, so the gesture
that already existed still means what it meant. The ajar drawer and the pulled
one are **one element** — `makePull()` — because two would disagree about where
the mouth is. It is an overlay rather than a taller rail: the rail is a flex
item and growing it would relayout the board under the tile in your hand. And
the drop is aimed **geometrically**, off one number measured once, because the
front is `pointer-events:none` and `elementFromPoint` falls through it — and
the mouth starts a lip above the *rail*, not at the top of the front, because
the front is an overlay standing on the board's last row. `aimDrop()` asks about it **first** — it is not on a board at all, so
there is nothing under it for it to beat.

**The Magic Selector's line is four edges, and each of them is its own paint.**
`.ghost::before` draws no border at all: four `repeating-linear-gradient`
background layers, one per edge, sized `100% × --ghostw` and `--ghostw × 100%`
and positioned at the four sides, with `--ghostdash` — one custom property read
by all four — saying solid or dashed. It was an `outline` (one path round the
whole box, and an engine that clips or rounds it anywhere loses whole sides at
once), then a **border on an inset child**, and the phone went on losing the
two upright sides under both. A border is still four sides of *one property*,
resolved together against one box and one radius and then segmented into dashes
by the engine — so a side going missing is something the engine can decide,
once. Four layers cannot be decided about together. Same trick as a moulding and
a window's muntins: a fixed px thickness, a proportional position. The general
rule: **when a structural fix does not hold, the structure was not small enough
yet** — stop where the thing that can fail is a thing you named. See decision
170, which supersedes the border-on-a-child half of the same argument.

**A hard flick off an edge throws a tile away.** `tossed()` in gestures.js asks
three things, not one — fast enough (`TOSS_SPEED`, on a *smoothed* velocity,
because a threshold on one event's noise fires at random), let go within
`TOSS_EDGE` of the board's edge, and travelling out through it. A slow carry to
the edge is still a move. **Down is not an edge**, and that falls out rather
than being said: the drawer's mouth is along the bottom and `aimHold()` is asked
first, so a downward flick is kept rather than thrown. `del()` pushes its own
undo and the toast offers it. See decision 112.

**A drop has four meanings, and they are ordered.** `aimDrop()` in
`gestures.js`: a day on a calendar, a point along a timeline's axis, an object
it gathers with, a container to file into. The first two sit inside a
container's tile, so they must be asked about first — ask the drawer first and
every calendar drop files the object and loses the date. Add a fifth by adding a
branch there, in the right place in that order. A *plucked* line is the one
thing dragged that isn't a tile, so it has its own aim (`aimPluck()`) with only
the last of those four questions.

**Pinching two fingers together goes up one level.** The parent, not the desk
— `zoomBegin/Move/End` in gestures.js — and again for the next, until a desk,
which has no parent and so refuses (desks sit *beside* each other, decision 39).
The knob along the bottom still goes straight home in one press, which is why
both exist: one is a step, the other a destination. Only *inward*; pinching out
would have to name a thing to go into. Whichever is winning when the squeeze
passes `PINCH_MIN` — the squeeze or the midpoint's travel — decides the gesture,
once, so a pager under way can't turn into a pinch. A surface answers it too, by
shrinking. **`onCancel()` must not touch it**: iOS fires `pointercancel` for
both pointers the moment it recognises a two-finger gesture, so cancelling from
there tore the pinch down on the device and never in a test. Touch events own
its lifecycle — `touchend` and `touchcancel` both land in `onTouchEnd`. See
decision 109.

**A touch belongs to the element it started on, and a render takes that element
away.** `render()` replaces `#app` wholesale, and a detached node has no
ancestors, so nothing bubbles to `#frame` — a gesture that renders mid-flight
stops hearing its own fingers and freezes with no `touchend` ever arriving.
`holdFingers()` in gestures.js puts the handlers on that element for the length
of the pinch (a stamp on the event swallows the second delivery while it is
still attached). The pager avoids the whole problem by committing on release;
anything that must render mid-gesture has to hold on by hand. **A test that
dispatches at `#frame` cannot see any of this** — `#frame` is never replaced —
so the pinch tests fire at the element the fingers land on and assert it really
has gone.

**Two fingers navigate; on a locked board, one does.** Both go through the
pager in `motion.js`, which draws the shelf either side of this one and slides
the strip with your finger rather than committing at a threshold. A locked board
has nothing for a finger to carry, so the finger walks the shelves — while a tap
still opens the tile and the long press still opens the menu. Both axes commit
`goShelf()` now: where the sideways swipe used to build a whole other desk, it
builds the same board windowed one shelf over. See decisions 38 and 141.

**Tapping bare board does nothing on a phone; holding it makes something
there.** One way in, and it is the good one: **holding a bare cell** lights that
cell, sizes a box as you drag, and opens the picker on it when you let go. On a
locked board the difference is purely *when you move*: move first and the finger
walks the boards, hold first and it sketches. There was a second — pulling a
drawer front up out of the shelf (decision 43) — and it went with the shelf,
which is no loss: pulling made a thing with nowhere in mind, and holding a cell
makes one *there*, which is what a grid is for. See decisions 47 and 53.

**A board that isn't a grid can still be swiped off.** The one-finger sideways
swipe starts from the bare cells of a locked grid, which a List, Scroll, Book,
Calendar or Timeline board hasn't got — so a desk set to List was a desk you
could not walk off. A press on the `.scroll` background of a gridless board is
`type:'swipe'` with `xonly`, and `swipeMove()` kills the gesture if the finger
picks the vertical axis: up and down belongs to the list.

**A locked board opens for one tile and shuts behind it.** The hold-and-drag
still opens it — you have answered the padlock's question — but `relock` is set
and `onUp()` shuts it before the drop renders, so one deliberate nudge doesn't
leave arrange mode on behind you. Two attributes are the standing version of
the same exception: `movable` keeps an object's drag on a locked board,
`resizable` keeps its corners, and each says so on the tile — a pin top left, a
bracket bottom right, both riding along with the resize grips in `handles`.
That makes `arr` three answers, not two: `true` unlocked, `'locked'` locked,
`false` not a board at all (a sample). A grip is a bigger target than the mark
that advertises it — 22px desk, 40px phone, capped at a third of the tile so
four corners can't swallow a 1×1. A new object **drops in from above** and
settles (`.justmade`) — starting half again its size and easing *in*, because a
tile that only slides a few pixels reads as a twitch; the glow is an `outline`
so it can't take a border slot's moulding with it. The ring of light still says
which. See decision 81.

**Holding a tile opens the menu, and moving from there takes the tile — and
unlocks the board, for as long as you hold it.** The iPhone home screen's gesture, and the gesture is no
longer cancelled when the menu appears: `G.menu` stays set, and the first real
movement closes the menu, lifts the tile and calls `unlockBoard()`. That writes
state and patches the grid's `locked` class and the bar's padlock **without
rendering**, because the tile is under the finger and `render()` would replace
it — the drop at the end renders and everything agrees then, with the lock back
on. See decisions 47 and 81. Dragging a size out on bare board still makes something, on
both devices, because that one is deliberate. And on a phone every panel comes
up from the bottom rather than in from the right — a panel from the right covers
the whole board, which is the thing decision 23 exists to prevent.

**A hold is 300ms and a render inside one detaches the tile.** The arming
callbacks call `refind(g)`, which looks the element up again by id — putting an
inline edit down renders on the next tick, and since a name became something you
tap there is very often one open when the next press starts.

**A list under Manual can be dragged into order; under any other sort it
can't.** `ord` is what `childrenOf()` falls back to when nothing sorts, so
holding a `.listband` and moving it writes indexes into `ord` — the boxes are
untouched, because a thing's place on a grid is a different fact from its place
in a list. The gesture only arms when `sortOf(container)` is manual: a board
that sorts itself arranges itself, and shuffling an A–Z list would be a gesture
whose result vanished on the next render. The list carries `data-listfor`.

**Reordering is picking up and putting down, and nothing moves in the DOM until
you let go.** `liftBand()` captures the siblings and the **pitch** — measured
between two real neighbours' tops, because the bands overlap their borders by a
pixel and a height is the wrong number; `clearBandShift()` puts everything back.
On the move the band you hold takes a `translateY` of the finger's travel and
the ones it is passing take one of ±pitch, so a gap opens where it will land;
the new order is read off `from` and `to` at the drop rather than off the list.
It used to `after.after(G.el)` on every `pointermove` — the list re-flowed under
your finger, everything past the insertion point jumped a row at a time, and
what you were carrying jumped with it, because it was one of them. The band in
your hand is the one thing that must **not** ease (`.dragging` turns its own
transition off): a tile that lags your thumb reads as a tile you have not picked
up. One `pushSets` for the whole shuffle, and `toast(…, true)` — a reorder with
nothing in front of it is a way back that only exists on a keyboard. See
decision 168.
