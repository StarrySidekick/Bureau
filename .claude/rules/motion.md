---
paths:
  - "web/js/motion.js"
  - "web/js/gravity.js"
  - "web/css/motion.css"
---
# Motion

Every movement: the dive and the way back, the pager, the spray, filing, the hop, gravity and tilt. Nothing here delays a state change.

These paragraphs were the *How to work in this codebase* section of `CLAUDE.md`,
moved here whole and unreworded so they load when a file they are about is
opened rather than in every session (decision 175). A rule for this area goes
here; a rule for every area goes in `CLAUDE.md`.

**The board can let go, and nothing in the model moves when it does.**
`S.look.gravity` — `off | sand | tumble`, read with `gravityMode()` — and
everything on the shelf you are looking at falls into a heap at the bottom of
it. `gravity.js` is a real rigid-body solver, and its whole safety argument is
that the boxes are untouched: a body's *home* is the rectangle its tile was
drawn in, the fall is a `transform` over the top, and switching it off is the
arrangement you had to the pixel. **One solver, two answers, one number apart**
— sand sets `1/I` to zero so a body cannot turn, exactly as a wall's zero mass
makes it immovable; tumbling gives it real inertia. Don't write sand as its own
little system: it is not a simpler simulation, it is this one with the rotation
taken out.

Four things in it were learned by looking and will bite anyone who changes them.
**A leftover substep is a bomb**: the overlap bias is `BIAS/dt`, so running a
frame's seven-microsecond remainder as a short step fires hundreds of pixels a
second into every contact and a settled pile shivers for ever — whole steps
only, remainder carried. **A perfect grid falls into a perfect heap**, which is
correct physics of an impossibly precise release and looks identical to sand, so
a tumbling body starts a few degrees off true with a little spin and a shove, all
three off a hash of its own id (the pinboard's trick, decision 75, for the same
reason: the same board falls the same way twice). **The pen is a shelf** — on a
Mac the shelf-*row* you have scrolled to, not the whole nine-shelf board, or
flipping the switch tips the desk two screens below the one you are looking at.
And the **switch does not render**: turning it off has to walk the tiles home,
and a render replaces every one of them with a fresh element already sitting
there. `gravityApply()` patches the class and drives the settle, the way
`markTilt()` does. See decision 166.

**Which way is down is measured, not borrowed from the shelf.** The tilt sensor
is read twice, for two different jobs, and the readings must not be swapped.
The **shelf's** lean is relative, clamped at twenty degrees and drifting back to
neutral, which is right for a recess and wrong for a floor — borrowed for
gravity it made left and right do a little and turning the phone over do nothing
at all. `tiltDown()` in motion.js is gravity's: earth's up in the device frame
is the third row of R, which has **no alpha in it** because a compass heading
cannot change which way is down, so gravity's shadow on the glass is
`(cos β · sin γ, sin β)` — absolute, unclamped, the whole circle, and **zero when
the phone is flat**, which is a tray held level. Its **length is the pull**, so
`set()` must not normalise: a phone at forty-five degrees pours at 0.866 g.
Decision 108's gimbal lock cannot reach it — gamma jitters near beta ±90 and the
`cos β` in front of it is zero at exactly that attitude — but it is the *device*
frame, so it agrees with the screen only while the page is portrait, which is
the next paragraph's job. See decision 166b.

**Bureau is a portrait desk, and a phone on its side measures nothing.**
`sideways()` in grid.js — `S.device==='phone'` and a viewport wider than it is
tall. Landscape has about a quarter of the vertical room, so measuring it cut a
shelf from fifteen rows to four; and the shelf is *also* the unit the window is
cut from, so the one you were standing on became a slice of the board with
nothing on it and the desk went **blank** until you turned the phone back.
`sizeGrid()` returns early and `gridOfContainer()`'s straddle repair sits out, so
the board holds the geometry it had; the stylesheet keeps it its own width, or
the `1fr` columns would stretch across a screen twice as wide and `cellW()` and
`--rowh` would disagree about where a cell is. The manifest asks for `portrait`
as well, which is what an installed copy honours — this is what happens when it
is not. It matters for gravity because pouring the desk sideways *is* the
rotation gesture. See decision 166a.

**Things come out of a new object as it lands, and that one is physics.**
`spray(x, y, id)` / `sprayAt(id)` in motion.js: stars, rings, spirals and bars
thrown outward and pulled down, on **one canvas** in `#fx` that is made on the
first burst and removed when the last bit dies. The only canvas in the app, and
the only movement that isn't a keyframe — a keyframe is a path decided in
advance and every bit here needs its own arc. Colours come from `objColour()`
and the root's `--glow`/`--brass`, never a palette of its own. `S.look.spray`
is **which shape** (stars by default; sparkles, spirals, squares, hearts,
confetti, a mix, or nothing) and each preset carries its own count and scale.
Every option in Settings is drawn by the same `bitPath()` the burst uses, so a
sample can't drift from the thing it makes.

**A new object says which sorting drawer caught it.** A sorting drawer
collects and does not hold, so a quote typed into a spawner goes on the board —
wherever `freeSpot()` had room — *and* into the drawer standing beside it, and
nothing said the second half. `hopIntoCollector(id)` in motion.js flies a
picture of the tile into the collector: `fileTo()`'s mechanism aimed at a
**rule** rather than at a drop. From the **tile** and not the spawner, because
the hop's two endpoints are the two facts — where the thing is, and where it is
also findable. One caller, `reveal()` at 620ms, which is why it needed no
plumbing: every maker in the app already goes through it. Three limits, each
the difference between an answer and a firework: **only a drawer drawn on this
board**, **only the first one**, and **only a magic drawer** — an ordinary one
holds by `parent`, so there is no second place to point at. Silent with no
collector, which is the common case. It asks `childrenOf()` because
`inContainer()` is model.js's own. See decision 173.

**A burst belongs to a new object and to nothing else.** There is exactly one
caller — `reveal()` in views.js, 450ms after the drop begins. It used to come
out of anything you touched, which made every tap on a busy desk a small
firework and made the app feel like it was congratulating you for opening a
drawer. Arriving is the event worth marking; touching is not. Ticking still
answers with `pop()`'s **ring**, which is a different thing and stays. Don't
put a `spray()` call back on a tap path — and if you add a second caller, it
had better be an arrival. See decision 85.

**A star is drawn, not stamped.** `roundPoly()` rounds every one of the ten
corners into the path itself, because canvas's `lineJoin:'round'` only rounds a
*stroke* and these are filled; and every star and sparkle carries an
**outline** in `SPRAY.line`, which is the style's own `--ink` — dark on paper,
light on a dark style, named nowhere. It is passed into `bitPath()` rather than
read off `strokeStyle`, because two of the shapes stroke themselves in their
own colour and Settings draws its samples through the same function.

**Filing lands, and the picture is read before the state changes.** `fileTo()`
in motion.js: a drop that files an object flies a picture of the tile from
where you let go into the front it went into, shrinking as it goes — toss's
mechanism aimed inward. The source element and its rect must both be captured
**before** `fileInto`/`save`/`render`, because `render()` replaces `#app` and
the element in your hand is detached a moment later with a rect of nothing.
The drawer's own `swallow` bump moved to the *end* of the fall, so the two read
as one event; that is a delay on an animation and not on a state change. A
**gather** keeps the bump and does not get the fall — nothing went into
anything, a third thing was made. See ROADMAP 0b-next item 1.

**How a thing opens is a property, and the front says which.** `openingFor(o,
box)` in `motion.js` — `auto | dive | drawer | cabinet | curl | lift | none`,
per object then per type. `auto` asks what the object *is*: a container
**taller than it is wide** at two cells of width or more swings open, any other
container is one you **go into**, a paper shape curls, everything else lifts.
Don't add a branch on a kind's name to get a different movement; add a value, or
set `opening` on the type.

**A drawer is somewhere you go, not something that comes to you.** `dive` is the
default: a still picture of the board you are leaving grows until the drawer's
own rect is the screen, and the board you are arriving on is framed **inside
that rect** the whole way. What is behind a drawer front is another desk, and
the movement should say so. The picture is cloned **before** `go()` and inserted
**after** it — the clone is free, laying a second board out is not, and it must
not land on the frame the tap has to feel instant on. It carries no ids and no
`data-drawer`/`data-row`, because the drag's lookups are not scoped to `#app`
the way `tileOf()` is. See decision 103.

**Both halves of a dive come out of one function, and all three of its rules
were learned by looking at frames.** `dive(el, r, mr, going)` in motion.js
writes four waypoints; `'away'` is the picture and `'into'` is the board
arriving, and they are exact inverses, so the mouth and the destination agree
at every waypoint. **One front** — flying a separate copy of the drawer as well
puts two of the same tile on two scale curves and reads as the drawer coming
out. **It pans as well as zooming** — scaling about a corner keeps the tile in
the corner, so it never covers the screen however far it grows, and the old
board shows round the edges at the end. **And a linear scale is not a zoom** —
a steady camera grows the picture by the same *factor* each frame, hence `z**f`
and not a lerp. The mouth is a **hole in the stack, not a hole in the
picture** — the picture goes *under* the arriving board in `#fxunder`, and what
you see through the drawer is what the picture does not cover; the dark of the
carcass sits between them. The **front dissolves** over that mouth, because a
clip is instant and cutting the mouth out at the tap made the drawer pop open.
A second element is fine; a second *curve* is what made the first version
wrong, so the fading front rides the mouth's own waypoints.

**A rectangle with a rectangle taken out of it is a mask.** The mouth was an
`evenodd` `clip-path` for four versions, and a non-rectangular clip cannot be
composited — it is a mask on a layer that is scaling, which is a repaint every
frame, and it cost four dropped frames in every dive. Identical with `nonzero`
winding and free with a plain rect clip on the same element, which is what
named it. Don't reach for a clip-path to cut a shape out of anything that
moves; restack it instead. See decision 142.

**The way out is the way in, backwards.** `leaveTile()` in motion.js — the
knob along the bottom and the chevron at the top of the bar. The board you are
standing in shrinks into the front it came out of, the board you arrive on
starts zoomed in on that front and settles back around it, and the carcass and
the front close over the mouth behind you. It is the **same four animations run
`reverse`**, called with the same arguments `dive()` got on the way in — not a
second set of keyframes, which would be eight more chances to disagree about
where the mouth is. So the picture takes `divein` (on the way in that was the
board *arriving*, framed inside the mouth) and the board you arrive on takes
`diveleave`. Walking off a *desk* keeps the small settle: desks sit beside each
other, not inside each other. The knob can climb more than one level, so the
mouth is the nearest ancestor with a tile on the board that has just been
drawn, not necessarily the drawer you were in. See decision 104.

**Nothing that flies carries a filter.** One inherited `drop-shadow` on the
diving front — scaled to four times size, so a hundred-pixel blur recomputed
every frame — cost 25fps against the pull-out's 60, and it was the *only* thing
that did: not the clone, not the second layout, not the throw distance, not the
checkerboard. The flying picture drops the board's filters too, and a desk has
one on every torn shape. A scale is a repaint every frame and a filter costs per
element per repaint — decision 101's finding, from the other side.

**Nor a shadow, nor a flank, and the reason is raster scale.** A scaling layer
is rasterised once, at the animation's **maximum** scale — so a picture ending
at four and a half times the screen is twenty times the pixels, each paying for
every `box-shadow` and every `.dside` depth face on it. `.fxleave`/`.fxback`
therefore zero both on everything they contain. Those two and nothing else, on
purpose: a shadow and a flank are what you cannot see on a board flying past at
three times size in a fifth of a second, and a moulding and a grain are what a
drawer front *is*. And `#app` gives up the wood for the length of a dive
(`.app.diving`), because the picture is behind it now. See decision 142.

A container is a **cabinet when it stands** — taller than it is wide, at least
two cells across — and a drawer at any other shape, however big. Which way round
it is, not how big: an area threshold used to give doors to a 4×3, which is a
drawer in every piece of furniture ever built. See decision 54.

A cabinet wears **two knobs**, close in either side of the seam, and a drawer wears
one — `tiles.js` asks `openingFor(o, box)` rather than repeating the size test,
so setting a tall drawer to "pulls out" puts the single knob back. Pass the box
being drawn: a sorted board packs tiles into flowed boxes `lay()` knows nothing
about. See decisions 50 and 54.

**The shelf is inset, and tilting the phone looks into the cavity.** One
transform on **one** element: `.grid` — the tiles and the checkerboard they
stand on are one piece of furniture and move together — while the opening
(`.deskscroll`) stays put and clips, and the wood shows along the edge you
tilted away from. **Translate, never rotate**: the drag maths divides by the
grid's own rect, and a translate cancels out of every coordinate in the app
where a `rotate3d` makes `getBoundingClientRect()` return the bounding box of a
trapezoid and quietly breaks the drop. The rim's shading is a `::after` at
`z-index:5`, because an inset shadow paints *under* its element's own children
and every tile on the board is one of those — and its spread must be the
negative of its offset or the shadow lands outside the box. **Never read the Euler angles as coordinates**: `Rz(a)Rx(b)Ry(g)` is singular
at beta ±90, which is a phone held upright, and there alpha and gamma are the
same rotation — so gamma jitters while the phone is still. `onOrient()` builds
the rotation and tracks the **screen normal against its rest attitude**, which
is continuous at any attitude and needs no case for how the phone is held.
Gravity-in-device-frame is stabler still and cannot see yaw, which is most of
the gesture, so it is not enough. The shelf runs
**against** the phone — `TILT_SIGN_X`/`TILT_SIGN_Y` negate the sensor, because a
thing in a recess lags the movement rather than chasing it, and the first
version had it the other way and read backwards in the hand. Negate at the
sensor, never in the CSS: the rim's shading derives from the same two variables
and stays on the right side of the movement for free. `--tiltx`/`--tilty`
(−1..1) are written on `#frame` by motion.js §20b²; `--tiltpx`/`--tiltpy` are
the only two numbers worth turning, and `BUREAU.tilt(1,0)` parks the shelf so
you can look. **Depth is throw, not sensitivity** — parallax displaces by depth
× tan(angle), so a deeper shelf moves further for the same tilt; narrowing
`TILT_RANGE` instead reads as twitchy. The cue is *relative* displacement, and it is
between the board and the **opening** — which is what the four walls draw. See
decision 116. **Which surfaces answer the tilt is a choice** — `tiltMode()` in model.js, four
modes (`off | desk | window | both`), each gated on its own class (`.tilt-desk`,
`.tilt-win`) stamped by `render()` from `S.look`, so a desk set to windows only
pays for none of the cavity. The old stored boolean still reads as `both`.
**One slider each** (`tiltdesk`, `tiltwin`): the second axis and the floor's
extra travel are fixed fractions of the one number, written by `applyLook()`,
so the four properties cannot disagree. **The board is the back panel of a slot, and it goes *over* what surrounds it,
never under.** Four `.cavwall` quadrilaterals join the opening's corners to the
board's, and each polygon carries the board's own offset — so tilting opens one
wall out and closes the opposite one, which is what looking into a bookshelf at
an angle does and what a fixed rim can never say. The board is **inset**
(`margin` on `.grid`, never padding — `cellW()` measures that rect) by
`max(S.look.deskinset, --tiltpx)`: a back panel that can shift further than it
is inset runs out past the opening, so the slider is a floor that adds room
beyond the movement. Nothing is ever clipped. See decision 116, which reverses
110 — the checkerboard is the board's own paper and must not slide under its
own tiles. It is off by default, phone only, and it eases to zero for a
drag, the pager, a panel, a surface and reduced motion — all read off state or
the DOM, so nothing else has to know it exists. See decision 108.

**`picture()` strips the clone itself, not only its descendants.** Every caller
but the toss hands it a whole board, where the thing answering to an id is
always a descendant; the toss hands it a tile, and it flew off still answering
to an id the desk had just deleted. Decision 51 from the other side.

**A dive can be scrubbed, and that is why it has no second set of keyframes.**
`scrubDive()` in motion.js: the four animations are on one clock and all
`linear` (the easing is baked into `dive()`'s waypoints), so a **paused
animation with a negative `animation-delay`** renders at that point in its own
timeline — one number moves all four and they cannot drift apart. Pass `scrub`
to `leaveTile()` for a handle (`set` / `finish` / `undo`) instead of a played
movement; it returns null when there is no movement to give (reduced motion, a
drawer that doesn't dive) and has already navigated. The commit happens on the
first frame and lands *under* the opaque picture of the board you were on —
`undo` re-renders the drawer under that same picture before taking it away,
which is the pager's trick and why neither needs a "maybe" in the model.

**The pager spreads its work over two frames.** The frame the gesture is
recognised in builds only the neighbour you are moving *towards* and carries the
**real** board in the middle of the strip — free, because it is already laid
out. The next frame builds the far neighbour and a still picture of the board
you are leaving, and the real one steps out and hides. It has to become a
picture before you let go, because letting go rebuilds `#app`. If you ever make
something render mid-gesture, that picture won't exist and the middle of the
strip will be empty.

**The camera scales the board, and nothing may be dragged through it.**
`S.zoomOn` names one object; `applyZoom()` slides and scales `#drawergrid` until
that tile is centred and as large as fits, with the neighbours still on screen
behind it. One transform on one element — the compositor does the whole move, so
four tiles and four hundred cost the same — and the scroller is frozen
(`.camerascroll`) because a `scrollTop` under a transform is two things arguing
about the same pixels. **It is a camera and not a container**: nothing is
reparented, no box is rewritten, nothing is saved, and `zoomOut()` is one
assignment. The one thing it breaks is the drag maths — `cellW()` measures
`.grid`'s own bounding rect and a scaled rect gives a cell four times too wide —
so the first line of `onDown` refuses any press inside a zoomed grid that is not
inside the reading face. Come out first, then move things. See decision 187.

**Anything shown under the camera has to be counter-scaled or it is magnified
with everything else.** Type, a page number, a name row, a margin: each is
either written at `size / camScale()` so the transform lands it at `size` on
screen, or it is drawn at four times what it was meant to be. `camScale()` is
one function shared by `applyZoom()` and `zoomFace()` for exactly that reason,
and `--camk` is on the grid for anything in CSS that needs the same division.

**A test that taps a readable tile has to come back out.** While the camera is
in, a press on the board is *spent* coming out of it — the same bargain a panel
makes with a press past it — so a smoke block that leaves `S.zoomOn` set makes
the next block's click land on nothing, and the assertion that fails is nowhere
near the block that broke it. Two blocks were poisoned this way before it was
found: one crashed on a null element three hundred lines later, the other read a
font size that a swallowed click had never changed. The camera is also cleared
by `applyZoom()` whenever the tile it names is not on the board being drawn, so
navigating away is safe; staying on the same board and not pressing off it is
not.

**The camera moves, and a transition needs something to move from.** Going in,
the class that carries the transition cannot go on in the same frame the
transform is first written; coming out, `render()` has just replaced `#app`, so
the element being asked to animate has never carried a transform at all. Both
ends put the grid where it is *coming from* with the transition suppressed,
flush the layout (`void grid.offsetWidth`) so the engine holds that value, and
write the target on the next line. `CAM` in motion.js is the other end of a
journey the DOM no longer remembers, which is why it is kept at all.

**`will-change:transform` is worn only while the move is running.** A promoted
layer is rasterised once and then stretched, so a page of words held at four
times with it on is a picture of words. `camSettle()` takes it off when the
move ends and the browser redraws the text at the size it actually reached.

**Pinching while the camera is in comes out of it, and tracks.** `camScrub(t)`
interpolates between where the camera is and rest; `camScrubEnd(t)` finishes
past 0.42 and falls back in short of it — the dive's bargain (decision 103),
asked before the drawer because when both are true the camera is the one you
are looking through. The two-finger swipe is not offered there at all: it walks
the shelves and the desks, and under the camera it competes with the finger
that pushes the words.
