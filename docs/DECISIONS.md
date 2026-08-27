# Decisions

Things that were chosen on purpose, with the reasoning, so they don't get undone
by accident — and the arguments against, so they can be undone on purpose.

---

### 1. A drawer is both a smart filter and a real container

Kitchen automatically collects every Recipe. It also keeps anything you drop in
it by hand, whatever kind that is. Hand-filing always wins.

*Why:* purely manual containers (Finder, Things' projects) become work — you file
the same thing in the same place forever. Purely smart containers (Obsidian
queries, Notion databases) stop feeling like places, because you can't put a
thing somewhere; you can only describe it.

*Against:* it's two mental models in one control, and "why is this here?" has two
possible answers. If drawers ever feel unpredictable, this is the cause.

*If revisited:* show a small marker on hand-filed objects so the two are
distinguishable at a glance.

---

### 2. Completed things leave their drawer

They go to Done & Dusted and appear nowhere else.

*Why:* a drawer's value is that it's finite and you decided what's in it. If
finished things pile up, the tile count stops meaning anything and you're back to
a feed.

*Against:* you lose the satisfaction of seeing a crossed-out row where you did
the work, and "what did I do in the Studio last month?" gets harder.

---

### 3. Kind is a mutable property, not a folder

An object's kind can change; the fields follow.

*Why:* ideas become outlines become essays. If kind were a location, that journey
would be copy-paste, and you'd lose the history.

*Against:* it makes kind-specific data (milestones, streak history) potentially
orphaned when you switch away and back. Currently that data survives, unused,
which is the right default but does mean objects can carry invisible baggage.

---

### 4. Habit is its own kind

Not a flag on Task.

*Why:* a habit has no due date and no completion — it has a cadence and a
history. Modelling that as a task with a repeat rule means "overdue habits",
which is exactly the guilt-generating pattern that makes habit trackers unpleasant.

*Against:* two things that both get ticked daily now live in two places.

*Status:* still genuinely open. It's seeded in the app as a Question object so it
stays in view.

---

### 5. Repeating a task spawns a new object

Rather than moving the due date forward on the same object.

*Why:* the record of having done it survives. "Water the fig" completed eleven
times is eleven dated records, not one object with a counter.

*Against:* it multiplies objects over time. Needs a cull or an archive-compaction
strategy eventually.

---

### 6. Local-first, no account, no backend

Data lives in each device's storage. Nothing is transmitted. There's no login.

*Why:* it's a personal app for one person. A backend would mean an account
system, a privacy surface, hosting costs, and an outage mode — for a to-do list
that fits in a text file.

*Against:* no sync, which is on the original requirements list. Export/import is
a manual bridge, not a solution. See `DATA-MODEL.md` for the routes.

---

### 7. One file, no dependencies, no build step

The whole app is ~1,770 lines of HTML/CSS/JS in one file.

*Why:* it loads instantly, works offline trivially, can't break from a dependency
update, and can be read end to end in one sitting. It also drops into a native
`WKWebView` unchanged, which keeps the native-port option cheap.

*Against:* one long file. If it passes ~3,000 lines this stops being a virtue and
splitting into a few `<script type="module">` files (still no bundler) is the
next move.

*Status:* the file passed ~4,700 lines and the split happened (2026-08-11, v30):
thirteen ES modules in `web/js/`, two stylesheets in `web/css/`, no bundler,
still zero dependencies. "No dependencies, no build step" stands; "one file"
served its purpose and was retired exactly as this entry planned.

---

### 8. Full re-render on every change

`render()` rebuilds the whole view from state.

*Why:* there is one source of truth and no reconciliation bugs. At this scale it
is imperceptibly fast.

*Against:* it loses focus and scroll position — which is exactly why the detail
sheet renders separately. If more views need to hold live input state, that
exception list will grow and it'll be time for a real reactive layer.

---

### 9. Two device layouts, both editable from either device

Each drawer stores a Mac size and an iPhone size.

*Why:* it was an explicit requirement, and the two devices genuinely want
different shapes. Editing the phone layout from the Mac is a convenience that
turned out to matter more than expected — dragging tiles with a thumb is
miserable.

*Against:* two layouts to keep coherent as drawers are added and removed.

---

### 10. The desk is a coordinate space, and drawers never shove each other

Each drawer stores `{x,y,w,h}` per device. The grid has no auto-flow, and a
move or resize that would overlap a neighbour is **refused** — the drawer snaps
back and you get "No room there".

*Why:* the argument for drawers is that position carries meaning. If the grid
reflows, the thing you put in the top-left corner is only there until something
above it changes size, and the position stops meaning anything. Refusing is also
the only rule with no surprises: nothing you arranged moves unless you move it.

*Against:* you have to make room yourself before you can grow a drawer, which is
two gestures where a packing algorithm would need one. It also permits an ugly
desk full of holes — deliberately, since a gap is sometimes the point.

*If revisited:* the softer version is push-on-collide with an undo, not reflow.

---

### 11. Colour is customisable, but from a set

Background, accent, drawer outline and each drawer's colour can be set from a
small palette of warm solids, or from a colour picker for anything else.

*Why:* "visually customisable and pretty" was an original requirement, and a
palette is what makes a desk of nine drawers look like one object rather than
nine. The picker is there because one user should never be told no by their own
app.

*Against:* the picker makes it possible to build something unreadable — light
text is hardcoded on drawer fronts, so a pale custom drawer colour will read
badly. If that becomes a real problem, pick the text colour from the drawer
colour's luminance rather than assuming dark.

---

### 12. One array, one recursion: a drawer is an object

`S.drawers` and `S.objects` were merged. A drawer is an object whose kind
carries the `container` attribute; every object names a `parent`; the desk is
the root container. Grids nest without limit.

*Why:* it collapses three special cases into one. "Can a drawer contain a
drawer?" — the seeded Question that had been open since the start — stops being
a feature and becomes a consequence. The desk, a drawer, and a drawer four
levels down all render through the same function, so anything true of one is
true of all of them.

*Against:* recursion admits cycles, so every reparent has to be guarded
(`isAncestor`), and "everything is an object" makes it possible to build an
unnavigable nest. Obsidian's swamp is exactly this failure, and the only thing
standing against it now is that drawers are finite and completed things leave.

*Watch for:* if depth ever becomes a problem, the fix is a depth limit on
`create`, not a retreat to two arrays.

---

### 13. Attributes, not behaviour flags

Kinds are named sets of attributes. Attributes are the capabilities — `check`,
`date`, `repeat`, `button`, `container`, `streak`, `progress`, `media`, `text` —
and nothing in the app branches on a kind's *name*.

*Why:* the old flags (`checkable`, `sched`, `habit`…) were already this idea,
half-built and only editable in the source. Promoting them means a new kind is a
thing the user makes at runtime by ticking boxes, and every view supports it
immediately because every view asks about attributes.

*Against:* an object can now carry a combination nobody designed for — a
container that is also a checkbox, a streak with milestones. Most read fine;
none are prevented. Prevention would mean a compatibility matrix, which is the
kind of rule that makes a personal tool feel like someone else's product.

---

### 14. The grid is square, and it is the whole page

Cells are square, twice as fine as before, and the desk has no toolbar — New,
Arrange and Settings are objects sitting on the grid.

*Why:* if everything is on a grid, the app's own buttons have no business
floating above it. Square cells make placement legible in one unit instead of
two, and halving the cell makes small things possible — a button, a photo, a
single-line note — without a second sizing system.

*Against:* a drawer on the desk now shows only its name, so the desk tells you
less at a glance than it did. That is deliberate — a drawer is a thing you open
— but it is a real loss, and if the desk starts feeling inert, printing a count
or a first line back onto the front is the fix.

*Also against:* Bureau's buttons can be moved somewhere useless or deleted.
`ensureControls()` restores missing ones on load, which is a patch over a hazard
the design creates rather than a real answer.

---

### 15. Magic drawers collect but never hold

A magic drawer matches by rule only. Filing something into one does nothing.

*Why:* decision 1 made ordinary drawers deliberately two things at once, and
that ambiguity is worth it for a place you put things. It is not worth it for a
saved search. Keeping them separate means "why is this here?" has exactly one
answer for a magic drawer.

*Against:* two kinds of container that look nearly identical on the desk. The
sparkle mark is doing a lot of work; if it isn't enough, they should look
properly different.

---

### 17. A drawer and an object are different sorts of thing — overturns 1

Decision 1 made a drawer both a hand-filled container and a rule. Decision 13
then made "container" an attribute any object could have. Both are undone here.

A drawer contains; an object does not. An ordinary drawer holds exactly what is
filed in it. A magic drawer holds nothing and shows what matches its rule. An
object therefore lives in exactly one drawer, and appears in a second place only
by being *collected* by a magic drawer.

*Why:* "why is this here?" now has one answer per drawer instead of two, and
"where does this live?" has exactly one answer, ever. The old model let an
object sit in Inbox and appear in Kitchen and Writing Desk at once, which made
counts meaningless and made moving something feel like it did nothing.

*Against:* Kitchen no longer collects every recipe on its own — filing is
manual, or you make Kitchen magic and lose the ability to put anything in it by
hand. That is a real loss of convenience, traded for a model you can hold in
your head.

*Consequence:* `container`, `magic` and `control` are structural, not
attributes you can tick. You cannot turn a note into a drawer.

---

### 18. No New button, no Arrange button, no sidebar

Clicking bare grid makes something. Pressing and holding arranges. The sidebar
is gone entirely.

*Why:* every one of those was chrome sitting on top of a grid that is supposed
to *be* the app. A home screen has taught everyone what press-and-hold means.

*Against:* discoverability is now zero for anyone who isn't told. There is no
affordance that says "hold me". For a one-person app that is an acceptable
trade; for anyone else it would not be.

*Also:* losing the sidebar cost the only route to Today, Keeping Up and
Everything on the Mac. They survive through ⌘K and, for Today and the archive,
as magic drawers on the desk. If that bites, the answer is more magic drawers on
the desk, not the sidebar coming back.

*Status:* that last sentence turned out to be the whole answer — those three
views are gone entirely and pinned drawers replace them. See decision 22.

---

### 19. There is no arrange mode

Everything on a grid is always movable and resizable. A 200ms hold arms the
drag; a drawer can be locked when you want it to stay put.

*Why:* a mode you have to enter is a mode you forget you're in, and the Done
button that ends it is chrome on a screen that is meant to be nothing but grid.
If the answer to "can I move this?" is always yes, there is nothing to remember.

*Against:* a click and a drag now differ only by 200ms, which is a real tax on
every deliberate click, and touch users will pick things up by accident. The
lock exists because of this, not as a feature.

---

### 20. Clicking an object does what the object says

`onclick` is per object, falling back to per kind: nothing, read, edit, or tick.
A note opens to read; a task does nothing. The editor moved to the context menu.

*Why:* opening a full editor was too heavy an answer to a click, and the right
answer genuinely differs by kind — you read a note and you tick a task.

*Against:* a default of "nothing" means some objects appear inert until you
learn the context menu, and there is now no single thing a click always does.

---

### 21. PWA before native

*Why:* it satisfies "iPhone app", "Mac app" and "pretty" for one codebase and no
developer account, and it can be used tomorrow. A wrong idea discovered in a week
of real use is worth more than a month of Swift.

*Against:* no widgets, no Shortcuts, no share sheet, no notifications on iOS, and
storage that Apple could evict. Anything that depends on those needs the native
build — see `NATIVE-PORT.md`.

---

### 22. Pinned drawers, not tabs — completes 18

The phone had a four-tab bar: Desk, Today, Keeping Up, Everything. Three of
those tabs are gone, along with the views behind them. What sits on the bar now
is whatever drawers you pinned — a strip along the top on a Mac, the bar along
the bottom on a phone, from one piece of markup.

*Why:* Today was "everything due by now", Everything was "everything", Keeping
Up was "habits and goals". Those are aggregations, and a magic drawer is the
app's own way of expressing an aggregation. Hard-coding three of them meant the
app shipped three fixed answers to a question it already lets you ask, and they
could not be renamed, recoloured, reordered, or removed. A desk of nine drawers
where four of them are unreachable except by scrolling is the actual problem the
tabs were solving, and pinning solves it without deciding *which* four.

*Against:* discoverability. A new desk arrives with four pins seeded, but the
only way to learn you can change them is the context menu or the drawer panel —
the same "no affordance says hold me" problem decision 18 already accepted.
Pinning also can't be reordered yet: pins append, and the only way to move one
is to unpin the rest. That will want fixing if the bar gets busy.

*Consequences:* `S.pins` is an ordered list of ids, not a flag on the drawer,
because nav order is its own decision and has nothing to do with desk position.
It resolves on read, so a deleted drawer's pin disappears by itself. With
nothing pinned the bar isn't drawn at all, which keeps decision 14's "nothing
but grid" true for a desk you haven't customised.

*What went with them:* the row list (`row()`, `card()`), and with it swipe-to-
file and drag-to-reorder, which only ever existed inside those views. The grid
is the only thing you drag now.

---


### 23. There are no modals — a menu is a panel

Every menu in Bureau is the same thing now: a panel down the right-hand side,
over a desk that stays visible and stays live. The centred card on a dimmed
screen is gone, and so is the scrim it sat on. What went through the change:

- **Settings** stopped being a view. It was one of three (`S.view==='settings'`)
  and replaced the desk entirely.
- **New object**, **New/Edit type**, **New/Edit drawer**, **Move to drawer**,
  **Link to**, **Attributes** and the **paste schema** were all modals.
- **Object settings** and **drawer settings** were already panels, but a
  different shape — a 290px card floating at the top right.
- **Sort** became a popup hung off the button that opened it (`openMenu`),
  because a list of choices is a menu, not a form.

*Why:* every one of these asks a question about the desk, and every one of them
hid the desk to ask it. Picking a board colour meant choose, dismiss, look,
reopen. The drawer panel had already proved the alternative — a colour or a knob
lands while you watch — and once you have that, a modal is just a panel that
covers the answer. Two panel shapes was one too many; a menu should not look
like a different kind of thing depending on which one you opened.

*Consequences:* `openPanel(spec)` in `panels.js` is the whole system. One panel
exists at a time and opening another replaces it. `spec.body` is a **function**,
not a string, so `refreshPanel()` can redraw from state — which is what removed
the old "rebuild the panel so the marks follow" line from every handler in
`wire.js` that changed something a panel was displaying. `spec.key` names which
panel is up, for the two places that need to know (the type-shortcut keys only
fire over the picker; the settings auto-refresh listener only fires over
settings). A form's draft lives in the `PANEL` object rather than on the DOM
node, so a redraw cannot lose it.

Panels live outside `#app`, so `render()` leaves them alone — the same trick the
drawer panel always used. The detail sheet also claims the right-hand side, so
`renderSheet()` closes any panel when it opens: the sheet is the bigger claim.

The command palette (⌘K) kept its scrim. It is a search field you summon and
type into blind, not a menu about the thing in front of you, and dropping it
down the right would make it worse.

*Against:* the panel covers the right-hand quarter of the desk, which is where a
wide drawer's right edge tends to be. Nothing dims, so it is less obvious that a
form is open and waiting — the type builder in particular now sits quietly
beside a desk you can still drag things around on. And a phone gets 92–96% of
the width, which is a panel in name more than in feel; there is simply nowhere
else for it to go.

### 23b. A type is drawn as the thing it makes

The type picker's tiles were an icon, a name and a blurb. Each one is now a real
`gridTile()` on a throwaway object — a drawer front with a knob, a checklist
with its boxes, a habit with its streak dots, a quote with its quotation mark.

*Why:* the whole argument of the app is that things have shapes. Describing them
in words, in the one place you are choosing between them, was the app failing to
believe its own premise.

*Why the scaling is backwards:* the sample is built at 40px a cell and then
CSS-scaled down, not built at whatever cell size fits. Type sizes inside a tile
are in px and don't scale with the grid, so the first attempt — an 11px cell —
wrapped "Drawer" onto two lines and drew a drawer that no drawer looks like. A
miniature has to be the real thing seen from further away.

*And nothing is drawn around it:* the sample first sat inside a bordered card on
a checkered board, with its name in a footer strip. That is a card inside a card
— two objects where there is one, and the frame reads as part of the thing you
are about to make. The card, the border and the board are gone; the sample sits
on the panel exactly as it will sit on the desk, and its name floats underneath
as a caption. Hover lifts the sample and colours the name; the edit dial is
absolutely positioned level with the name, so it can't shove the caption off
centre as it fades in, and can't land on top of a wide sample.

*Consequences:* a `.kindtile` is a `<div role="button">`, not a `<button>` — the
sample inside it is itself a `<button>` and a nested one gets hoisted out of the
DOM. The sample never enters `S`. Deleting an invented type moved from a row of
✕ chips at the bottom of the picker into the type editor, reached by the dial in
a tile's corner; right-click opens the same editor but doesn't exist on a phone,
which is why the dial had to. Type groups are also mutually exclusive now —
`scene` used to be listed under both Writing and Film, because the two filters
were written independently.

**The type builder** was a single long scroll; it is two columns with the live
preview, the name and Create pinned on the left, and fits one screen. **The
drawer form** lost view, border, knob, knob colour and locked, all of which were
already in the drawer panel; it keeps name, colour, what it collects, its rule,
its total and the preview style. Its draft is still seeded from the drawer, so
saving preserves the fields it no longer shows.

### 24. What a drop means — four answers, and a `gathers` property

Dragging used to mean two things: move a tile, or file it into a drawer. It now
means four, tried in the order they beat each other — a day on a calendar, a
point along a timeline's axis, an object it adds up with, a container to file
into. The first two sit *inside* a container's tile, which is why the ordering
is explicit in `aimDrop()` rather than incidental: ask the drawer first and
every drop on a calendar files the object and throws the date away.

*The rule that isn't a branch:* "two tasks make a checklist, two ingredients
make a recipe, two shots make a shot list, two scenes make a story" is four
branches on a type's name, which CLAUDE.md forbids for good reason — a type you
invent tomorrow would get none of it. It is one property instead. `gathers`
names the container a pile of that type becomes, `gatherKind(a,b)` says yes only
when both agree, and the type builder offers it as a row of chips ("Two of them
make"). Adding the behaviour to an invented type is filling in a field.

*Why the container takes its own size, not the union:* the new container starts
at the target's corner, so the pile stays where you made it, but at the size its
type asks for. Growing to fit what it replaced made a story — a book spine, 3
cells wide on purpose — six cells wide, which is a door.

*Why a calendar is a container and not a new kind of thing:* it always was one.
`calendar` is `attrs:['container'], layout:'calendar', face:'calendar'` — the
layout is how it arranges what it holds when opened, the face is how it draws on
its parent's board, and nothing branches on the name. A day is not a container:
the day is a *field* on the object (`due`), and the month grid is how the
container draws what it holds, arranged by that field. A magic calendar —
`['container','magic']` with a calendar face, "everything due, drawn as a month"
— needs no new code at all; the only difference is that dropping on one sets the
date without reparenting, because a magic drawer holds nothing.

*The timeline had to change to accept a drop.* Its face spaced children by array
index, which drew a straight line through unequal gaps and gave the pointer no
date to read. It is a real axis now, `data-tlspan` naming the two dates at its
ends, labels alternating above and below the rule because a busy fortnight puts
three of them in the same inch. An empty timeline opens out to four weeks either
side, or you could never drop the first thing onto it.

*Consequences:* a recipe is a container that holds its ingredients, and a story
is a container that holds its scenes and wears the `spine` face — so `spine` had
to become a face as well as a shape. `world` is new, and holds the characters,
places, items and events that outlive any one book. A container carrying `text`
now shows its body above what it holds, which is where a recipe's method lives
once the ingredients have moved out of the prose. And a drawer's layout falls
back to its *type's* layout: reading only the object meant a type that says it
opens as a calendar did so only if something had written `layout` onto the
object, which `create()` does and the seed does not.

### 25. The phone is a column

*A kind's size is written for the desk.* The desk grid is 24 columns, the phone
16, and a phone column is about 23px against the desk's ~58. Copying the number
across made a 4×1 task an 84×24 box holding a checkbox and a truncated word: a
quarter of a desk row is a row, a quarter of a phone row is a stamp. `sizeOfKind`
takes a device now — on a phone an **object** takes the full width, and a sliver
gets two cells of height so a thumb has something to hit. **Containers** are left
alone: two drawers across is what the phone desk looks like, and a book spine
that fills the width is not a spine.

*The grid runs to both edges.* 10px of paper each side plus a reserved scrollbar
gutter was 40px of a 375px screen — 11% of the desk spent on nothing, and at
23px a column that is most of two columns. The gutter is reserved on a desk,
where the scrollbar is real, and not on a phone, where it is an overlay.
The padding stays on list and scroll views; only the grid goes flush.

*Dragging on a touch screen.* It did nothing, and the reason is that a finger
cannot scroll the page and carry a tile at once — the browser decides which by
the time the second `touchmove` lands, and with `touch-action:auto` it always
chose scroll. The fix is the hold: 300ms of a stationary finger means no scroll
has started, and that is the only window in which `preventDefault` can stop one
from starting. So a **non-passive** `touchmove` listener preventDefaults while
`dragArmed()`, iOS's long-press callout and context menu are suppressed for the
same press, and the hold is 300ms on touch against 200 with a mouse.

*Against:* it is one gesture arbitrating two intentions, and 6px of wobble
during the hold can still lose the drag to a scroll. Preventing during the hold
*window* would fix that and break flick-scrolling from a tile, which is the more
common action — so the wobble stays.

*And two ways to reach.* Blocking the scroll leaves a five-screen desk
rearrangeable only within one screen, so carrying a tile to the top or bottom
edge pans the board under it. Better than panning: **a pinned drawer is a drop
target**. The bar never scrolls away, so filing something into a drawer three
screens down is a short drag rather than a journey. One selector in `aimDrop`,
not a branch — the bar and the board are both just places a drawer can be.

### 25b. Everything is an object; containing is an attribute

Not a change of code — a change of what the words mean, and the code was
already shaped for it. The model had two names for one thing: `S.objects` holds
everything and `container` is an ordinary entry in `ATTRS`, but the docs still
opened with "two sorts of thing" and `model.js` still said a drawer "is a
different sort of thing". That sentence is the seed of every future
special-case, so it is gone.

**There is one species.** A drawer is an object carrying `container`. The word
stays in the interface, because "drawer" is what it looks like and what you do
with it, and stays out of the code, because `isContainer(o)` is just
`has(o,'container')` and nothing may ask more than that.

`container` and `magic` remain in `STRUCTURAL`, kept out of `USER_ATTRS` and the
attribute picker. That is not a retreat from the idea: they are dangerous to
toggle, not different in kind. Turning a note into a drawer by brushing past a
chip orphans whatever was inside, so the question is asked deliberately — in the
type builder and the drawer settings — rather than never.

### 26. A tile says less as it gets smaller, and at 1×1 says nothing

*A cell is 40px on a desk and 23 on a phone.* Every shape in `tiles.js` was
drawn assuming there is room for a name, so a drawer shrunk to one cell printed
"Untit…" across its own knob and an object printed three letters and an
ellipsis. That reads as a bug, not as a small thing.

So a tile now knows how big it is. `sizeClass()` stamps three classes and the
stylesheet only ever *takes away* what there is no longer room for — `sz-short`
(h≤1) drops the body, `sz-narrow` (w≤3) drops the meta line and the rollup.
Nothing moves; a tile crossing a threshold loses a line rather than rearranging
itself, so resizing one never turns it into a different-looking thing.

`sz-mini` — one cell square — is the special case, and it is handled in
`gridTile()` rather than in CSS: the tile is the type's mark, in the object's
colour, and the title is the tooltip. It is still a drawer front and still a
drop target, because it is still the same object; only the content is gone.

*Why the classes are stamped on afterwards.* There are fifteen branches in
`drawTile()` and each returns one element. Threading a class string through all
fifteen is fifteen chances to forget one, so `gridTile()` splices the size
classes into the first `class="` of whatever comes back. Add a branch and it
gets the behaviour for free — the same argument as `gathers` in decision 24.

*Still open:* the thresholds are the same for a container and an object, and a
6×1 drawer probably wants its knob back.

### 27. A menu about one object comes up out of that object

Decision 23 made every menu a panel down the right, over a desk that stays live.
That is right for a question about the *desk* — settings, the type picker — and
wrong for a question about one tile: you click a drawer in the bottom-left and
answer questions about it in the top-right, looking away from the thing you are
changing the whole time.

So a panel may name an `anchor`. If the tile is on screen and either side has
room for the panel, it comes up beside it with a tail pointing back — the same
panel, the same header, the same handlers, only placed and animated differently.
It grows rather than slides: something that arrives from off-screen is a drawer,
not a bubble. Below the 900px breakpoint neither side has room and it falls back
to the edge panel, which is the right shape on a phone anyway.

`repositionPanel()` runs at the end of `render()`, because the tiles move and
the bubble is pinned to one of them.

*What is anchored:* object settings and drawer settings, from the context menu
or from a tile. Not the gear in the bar — that opens the settings for the drawer
you are *inside*, whose tile is nowhere on screen, and `anchorEl()` finding
nothing is exactly the right answer there.

### 28. A type's starting size is a number, not a menu of eight

The type builder offered eight preset sizes. Eight is enough to pick from and
nowhere near enough to *design* with, and the presets were desk sizes only —
what an object did on a phone was derived by `toPhoneSize()` and could not be
argued with. That derivation is a good guess and a bad rule: "an object goes
full width" is right for the first task on a screen and wrong for the third
checklist.

So both grids get sliders as well as presets, and they are two views of one
number — moving either drags the other with it. The phone pair *follows* the
derivation until you touch it, at which point `phoneSize` is written onto the
kind and `sizeOfKind()` prefers it. "Work it out for me" puts it back.

The preview goes through `sampleObject()` and therefore through the same
`gridTile()` the board uses, so a size you choose here cannot draw differently
there — including at 1×1, where it draws as decision 26 says it must.

*Still open:* dragging the preview's own corner to set the size, which is the
gesture the board already uses for exactly this and would need the preview's
scale factor threaded into a pointer path.

### 29. The board stays where you left it

`render()` replaces `#app` wholesale, so the scroller is a new element every
time and started at the top. On a desk five screens tall, moving a tile down two
rows threw you back to the first screen at the moment you let go of it — the
gesture worked and the evidence of it scrolled away.

The scroll offset is now remembered across a redraw, keyed by *where you are*.
Same place, same offset; a different place starts at the top, because going into
a drawer and coming back out is navigation and navigation should land at the
top. This is not targeted DOM patching and does not open the door to it: the
render is still a full rebuild, and this is one number carried across it.

### 30. A tile keeps swaying while you carry it

Picking a tile up starts a small unsteady sway. Moving it stopped the sway, and
the reason is a cascade rule rather than an oversight: a CSS animation's
`transform` beats an inline one, so a tile could sway *or* follow the pointer,
and `.dragging{animation:none}` bought the second by giving up the first.

The carry offset is a pair of custom properties now, `--carryx`/`--carryy`, and
the keyframes compose it with the scale and the rotation. Both are set — the
inline `transform` still runs as a fallback for anything that never gets the
animation. A pin being reordered along the bar is `dragging` without ever having
been `lifted`, so the sway is scoped to `.lifted.dragging` and the bar stays
still.

### 31. The phone grid is eight columns, not sixteen

Sixteen columns on a 375px screen is a 23px cell. That number was chosen to make
the smallest thing on the desk small — and it worked, which is the problem: a
1×1 object was a 23px stamp you could neither read nor reliably hit, a 4×1 task
was a quarter of a row, and every size written for the desk had to be translated
through `toPhoneSize()` because the two grids meant genuinely different things
by "one cell".

Eight columns puts a phone cell at ~47px against the desk's ~58. The two grids
now describe roughly the same sizes, and a cell is a real tap target rather than
something that has to be padded into one. Rows halve with the columns, because a
cell is square.

*What follows from it:*

- `toPhoneSize()` stopped multiplying heights. The ×1.5 existed to buy back
  pixels from 23px cells; at 47px it would make a 4-tall note *taller* on a
  phone than on the Mac. Heights come across 1:1 now.
- `PHONE_MIN_ROWS` is gone. It existed to make a one-cell sliver into a 47px
  tap target, and one cell is 47px.
- **Containers are halved rather than left alone**, which reverses the letter of
  decision 25 and keeps its intent. A 6×6 drawer left alone would be three
  quarters of an 8-column screen; halved to 3×3 it is the same fraction of the
  screen it was at 6/16, so two drawers across is still what the phone desk
  looks like.
- Every stored phone box is in the wrong coordinate space, so **migration 10**
  halves them — the exact inverse of `doubleBoxes()`, which did this twice on
  the way up. Rounding can push two neighbours into each other (7 and 8 both
  halve to 4) and `lay()` clamps rather than refuses, so the migration re-places
  per container: first to claim a spot keeps it, anything landing on top gets
  the nearest free box. A kind's explicit `phoneSize` (decision 28) is in the
  same space and halves with everything else.
- The seed's phone layout is rewritten by hand rather than migrated, because a
  first run has no snapshot to migrate.

*Against:* half the columns is half the arrangements. A phone desk can no longer
be three narrow things across, and the 16-column grid could express a sliver
beside a square. That expressiveness was theoretical — nothing at 23px was
usable enough to arrange deliberately.

### 32. A calendar collects; a checklist takes dictation; a drawer is two cells

Four types, tightened one at a time. Three of them are size and one is
structural, and the structural one is the reason this has an entry.

**A calendar is a magic drawer wearing a calendar layout.** It used to be an
ordinary container: things were filed *into* it, and the month drew whatever it
held. That made a day two things at once — a `due` field on the object, and a
membership in the drawer showing that month — and the two disagreed constantly.
Scheduling something meant moving it out of the drawer it actually lives in, so
a task on a calendar was a task nowhere else; and a thing could only ever be on
one calendar, because an object lives in exactly one container (decision 17).

Collecting fixes both. The rule says what lands on it — "anything with a date"
by default, but a tag, a set of types or any field clause will do — and the day
it lands on is the `due` field, which was always the truth of the matter. One
task now appears on the work calendar and the household one without being in
either, and it still lives in the Inbox where you put it. Dropping on a day
still dates it (`canDate()` deliberately ignores the magic rule), it just no
longer files it. **Migration 11** converts an existing calendar: its contents
move up to where the calendar itself lives, keeping their dates, and the new
rule collects them straight back onto the days they were already on.

It also grew the three settings every calendar has ever had: `calview`
(month, week or day — one screenful, and the arrows step by that unit),
`weekStart`, and whether weekends are drawn at all. All three are per object
then per type, and `calCols()`/`calSpan()` serve the front and the opened view
from the same answer, so a calendar set to a week does not draw a month on the
desk.

**A checklist takes dictation, through an attribute that already existed.**
"A box at the top that makes a task" is `spawn` with `spawnBy:'type'` — the same
trait the Text field object carries — and `genKind` says a line makes a task.
Nothing about a checklist is special-cased: a type you invent that ticks the
same trait gets the same box, on its front and inside it. A container that is
*also* magic can't hold what you type into it, so `spawnInto()` makes it where
the container lives and lets the rule collect it — which is what makes the
quick-add on a calendar day work at all.

The other half of "things pass through a checklist" is taking them out again.
Holding a line on the front lifts it off as a chip you can drop on a drawer, a
pin, or the board (`type:'pluck'` in `gestures.js`). A tap still ticks; only the
hold plucks. This is the first gesture that carries something which is not a
tile, which is why it is its own branch rather than a mode of the move drag.

**A drawer starts at two cells square, not six.** Six was a quarter of the desk
for something whose entire job is to be a name and a knob — a wall of nine of
them was the whole board. Two is the smallest a front can be and still read as a
drawer rather than a stamp, and nine of them is one row along the top: a rack of
pigeonholes, which is what a desk full of drawers ought to look like. The seed
is laid out that way so a first run shows it.

*What follows from it:*

- Drawer and Magic drawer state `phoneSize:[2,2]`. The derivation halves a
  container (decision 31) and half of two is one, which is the mini tile
  (decision 26) with no room for a name.
- A drawer front at two cells is `sz-narrow`, so the size rule finally has to
  win — `.drawer.dtile .dname` in `chrome.css` was silently outsizing it — and
  the magic sparkle comes off the front, because at that width it and the name
  are competing for the same inch. The dotted border already says magic.
- `keepsDone()` replaces the checklist special case in `inContainer()`. Three
  faces keep completed things — checklist, calendar, timeline — and they are the
  three whose job is to show what already happened. A calendar day that clears
  behind you is not a record of anything.
- A kind may declare a `filter`, copied into the object by `create()`, which is
  how a calendar arrives already collecting instead of being a magic drawer you
  then have to explain itself to.

*Against:* a calendar you cannot file into is a calendar you cannot use as a
drawer, and "drag it onto September" no longer puts it away anywhere. That was
never really filing — it was scheduling that happened to move the object — and
the thing it cost was the ability to be on two calendars, which is worth more.

### 33. A colour is a slot, and a style owns sixteen of them

A palette used to be a separate choice from a style, and it only decided what
*new* objects were painted. The colour itself was stored as a hex, so a desk
built under Workshop kept those hexes forever: switching palette changed the
swatches in the picker and nothing you could see. The style, meanwhile, carried
a `vars` block of forty hand-tuned tokens that had nothing to do with the
palette sitting next to it. Two colour systems, neither of which reached the
other.

They are one thing now. **A style has sixteen colours, and a colour is stored
as the slot number.** Slot 9 is Slate in every style, so an object holding `c:9`
shows Victorian's slate on Victorian and Aero's on Aero. Change style and the
whole desk repaints; change back and every tile is exactly where it was —
nothing was converted, only looked up, so the round trip is lossless by
construction rather than by care.

The first five are the app itself — Page, Text, Lines, Accent, Glow — and
`chromeTokens()` derives the whole token set from them: the softer inks are the
ink walked back toward the page it sits on, the rules are the line at low alpha,
the raised surfaces are the page toward white. A style therefore declares
sixteen hexes and gets forty tokens that agree with each other, instead of
forty hexes that agree because somebody checked.

**The other eleven correspond by position and not by hue.** The first cut of
this gave them universal family names — Umber, Fern, Rust — which quietly
demanded that every style field one of each. That is a tax the styles cannot
pay and should not: Aero is teal, ocean, screen green, steel and grey with
nothing warm in it at all, and Pseudochromo is a lightness ramp with no hue to
speak of. Making them both produce a rust so they could receive somebody else's
rust would have wrecked two styles to preserve a correspondence nobody wanted.
So slot 11 is a claret on Victorian, a deep sea blue on Aero, a near-black pine
on Starry Sidekick and a plain grey on Pseudochromo, and each style names its
own eleven in `names` — which is what the picker and the settings panel label
them with. The round trip is still exact, because the round trip never depended
on the colours resembling each other.

*What follows from it:*

- **The theme switch is gone.** Light or dark is `isDark(palNow()[0])` — the
  style's own background. Paper-on-Victorian and Walnut-on-Victorian were the
  same question asked twice, and answering them differently gave you dark
  shadows under parchment. `themeNow()` still reports paper/walnut because the
  CSS block owns the shadows and the per-theme custom colours key on it, but
  nothing sets `S.theme` any more. A dark style is a style, not an axis.
- **The palette picker is gone too**, replaced by the style's own sixteen shown
  as sixteen swatches you can repaint. An override is stored against *that*
  style (`S.look.slots[style][i]`), because a rust you disliked in Victorian
  has no business following you to Aero.
- **Never read `o.c` to paint something.** `objColour(o)` in `look.js` falls
  back to the type's colour and resolves either form; `hexOf()` does the same
  for a bare value. A number is a slot, a string is a literal — and a literal
  is still allowed, because somebody typing a hex into a colour input is
  insisting, and the right response to insisting is to leave it alone.
- Built-in types carry slot numbers rather than hexes, so adding a style
  repaints all forty-two of them without touching `model.js`.
- Modern became **Pseudochromo** — near-monochrome, desaturated, sharp corners
  — when it stopped being an absence of decisions and became a stated one.
  Migration 13 renames the stored key and its slot overrides.
- Starry Sidekick's line slot is white and its `vars` push it to 92% opacity,
  because that style is drawn rather than printed: a front is its outline, and
  the derivation's 72% is right for every style that fills its fronts and wrong
  for the one that doesn't.
- Skeuomorphic is parked. Its whole idea is materials that look real, and
  materials are images, not hexes.
- The style previews in Settings draw themselves out of their own sixteen, so a
  new style needs no CSS for its swatch, and a preview cannot drift from the
  thing it previews.
- `randomBoard()` follows the style's lightness. A white checkerboard inside a
  midnight desk is a hole in the page.
- **Migration 12** names every hex the five old palettes and the built-in types
  ever used and maps each to its family slot. A hex on neither list was typed
  in by hand and stays a literal: snapping somebody's deliberate choice to the
  nearest family would be the wrong repair.

*Against:* eleven is fewer than the sixteen free colours a palette used to
offer, and two drawers that were different browns may now share a slot. That is
the cost of a colour being able to travel at all — and a hand-typed hex is still
there for the one drawer that has to be its own colour and no style's business.

### 34. A project reports; four shapes stop pretending

Four changes to how things look, one of which is really about what a type *is*.

**A project is a drawer with a front page.** It was a checklist wearing a
different name — `face:'checklist'`, a list layout, and a front that printed
the first fourteen things inside it. But the question you ask a project from
across the desk is not "what is in here", it is **"where is this up to"**, and
no list answers that. So it has a face of its own: a cover, a progress bar, a
count, what is next, and a row of what it is made of. It opens onto a **grid**
rather than a list, because a project holds everything a piece of work is made
of — tasks, events, goals, pictures, notes — and a grid is where you arrange
things that are not all the same kind.

The number under the bar is `progressOf()`, and for a container it is **every
tickable thing underneath it, however deep**. A project is made of checklists
as often as of loose tasks, and counting only direct children reported a
project of four completed checklists as nothing done at all. Milestones are the
fallback, for a project that holds nothing tickable yet — so `progress` still
means what it always meant, it just isn't the only source any more.
`projectStat()` reads the count, the makeup, the cover and what is coming up
off one walk, because four walks of the same subtree per tile per render is
four times the work for the same answer.

*What follows from it:* `keepsDone()` gains `project` — a project that hid its
finished work would report on a subtree it wasn't showing you. `spawn` comes
with it, so you can throw a task at a project without opening it, and `media`
gives it a cover.

**A magic drawer is gilded, not dotted.** Dotted borders and scattered stars
read as a placeholder — a dotted line is what every drawing tool on earth means
by "not real yet", which is the opposite of what a drawer that fills itself
should say. It is *illuminated* now: a gilt rule held off the edge the way a
manuscript is ruled, the corners thickened into brackets, and a slow band of
light that crosses the front and then leaves it alone. All of it is drawn in
`var(--glow)` — slot 4 — so the gilt is leaf on Victorian and a green shimmer
on Starry Sidekick, and a style added later gets an answer without being asked.
The frame is dropped at 1×1, where it would be the whole tile.

**A task is a band.** The sliver came to a point down its right-hand edge: the
one shape implying a direction the object hasn't got, and it cost every task
20px of its own width to make room for the arrow. It is a plain band with the
type's colour down the left now.

**An achievement is a plaque, and the plaque takes its colour from its slot.**
Two bugs in one line: `.sh-plaque` was grouped with `.sh-note` in the
torn-parchment rule, and because that file loads second it overrode the plaque
styling entirely — so an achievement was a torn note wearing a plaque's
stylesheet. And the plaque itself was three hardcoded browns, which since
decision 33 meant an award stayed brass in a style that owns no browns. It is
cast from `var(--c)` now: a lit top edge, the object's own colour, a shadowed
foot, a bevel inside the frame.

*Against:* the project face is the first container front that costs a subtree
walk to draw. It is bounded by what is actually under one project and only runs
for tiles wearing that face, but it is the first place where drawing a tile is
not O(1), and a desk of fifty deep projects would be the thing to watch.

### 35. An edge is a slot, a question is answered, and a type can be born full

Five changes, three of which extend rules that already existed rather than
adding new ones.

**An edge is a slot, exactly as a colour is (decision 33).** The six borders
were Victorian mouldings wearing generic names, so every other style got a
bevelled chest front whether it suited it or not. `bd-panel` is position one
now, and what position one is *made of* is the style's business: a moulding on
Victorian, a hairline on Pseudochromo, a white-pencil rule on Starry Sidekick,
a lit glass sill on Aero. A drawer keeps its stored border through a style swap
and comes back to the moulding when you come back. Only the four dressed slots
need per-style CSS — plain and none mean the same thing everywhere — and `aqua`
became `gloss`, because it was the one slot named after the style that owned it.

**A question is answered, not ticked.** A checkbox on a question only ever
recorded that you had stopped thinking about it. The `answer` attribute puts a
box on the front instead, and answered is "there is something written in it" —
so the thing you worked out is on the tile, which is the entire value of
keeping a question. Typing into it deliberately does **not** re-render: the
input is the thing being typed in, so the state class is toggled in place. The
seeded Open Questions drawer collects on `answer is ""`, which needed no new
operator — `is` against an empty value was already "has nothing in it".

**A type can be born with things already inside it.** `seed` on a kind creates
children with the container. It exists because the project had grown an add-box
bolted to its front, and Bureau already *has* the type that turns typing into
tasks — so a project is born holding a Text field rather than growing a second
one of its own. That is the same instinct as decision 22 (a magic drawer, not a
filter bar) and decision 32 (spawn is an attribute, not a checklist feature):
when the app can already do the thing, put the thing in rather than reimplement
it on a front. Seeded children are placed at the top of the board rather than
left to `ensureBox()`, because a seeded thing is the way *in*. One level only.

**A long press is two presses.** 300ms arms the drag, as before. A touch still
holding 250ms later — and inside six pixels, because a finger on glass is never
still — did not mean to move it at all, and gets the context menu, which is what
the long press means on every phone. Touch only: a mouse already has a right
button, and a slow click is still a click.

**Three knob sizes**, because a front is mostly knob at 2×2 and mostly name at
8×8, and one size was a compromise at both. The pull is already measured against
the tile rather than the page, so a size is one multiplier over the whole clamp.

*Also:* the speech bubble's three rounded corners went from 12px to 28px and the
fourth stays square, because that is the one the tail comes out of. A note lost
its border — `clip-path` cuts a border off at the notches and leaves it hanging
at the corners, which is exactly what it looked like — and gained a
`drop-shadow`, since `clip-path` slices a `box-shadow` off too.

*Against:* per-style borders are the second thing after colour that a new style
has to answer for, and unlike colour it cannot be derived — four rules of real
CSS each. That is the cost of the styles being genuinely different rather than
one style with the hue changed.

### 36. One settings panel, one writing surface, and a new thing is scrolled to

Seven changes asked for on 15 August. Four of them are the same change.

**There is one object settings panel now.** There were four ways to change a
thing: an object panel, a drawer panel, a drawer *form* behind a "Name, rule
and totals…" button, and the detail sheet — a scrolling list of every field the
object had, with the body stapled to the bottom of it. A container is an object
with children (§1 of `SYSTEM.md`); the split into "object settings" and "drawer
settings" was never in the model, only in the code. `objectPanel(id)` answers
for both and for the desk, which is a container without a tile — `cfgOf()`
already returned `deskCfg` for it, so one target serves all three. The drawer
form's three rows (what it collects, what it totals, its front preview) are a
disclosure inside it, and `modalDrawer` is gone.

**The detail sheet is gone with it.** It was a settings screen *and* the only
writing surface, which made it a bad version of both — the thing you came for
was a textarea eight fields down. Every setting on it moved into the panel;
milestones, a streak's 28 days, tags and relations included. What is left is
the words, and they get a surface of their own: a title and a body, full
screen, with nothing else on it. `S.openId` kept its name and changed its
meaning — it is the object the settings panel is about, which is what every
`byId(S.openId)` handler already wanted.

**Two ways in, sized to the job.** Double-tap a tile and its name becomes a
field where it sits — and its body under it, if the tile is showing one. That
is the whole of "simple text editing" for a task and a note: a line and a
paragraph, neither worth a screen. Return moves to the body or finishes if
there isn't one; Escape puts the tile down. Typing does **not** re-render — the
input *is* the tile — which is the rule the answer box established. The reading
view's Edit opens the full-screen surface for when there is real writing to do.

**A one-of-many list is a select.** Forty types and twenty shapes were four
hundred pixels of chips you had to read like a wall, and the panel now has to
carry twice as much. Type, shape, face, layout, sort, click, read, border,
knob, texture, frame, priority, repeat — all selects. The many-of-many groups
(traits, what a magic drawer collects) are still chips, behind a `<details>`
that is closed until asked for.

**A container type carries a default sort.** `sort` is per object then per type
like everything else, and `manual` is a real value rather than the absence of
one — which is what lets one drawer refuse a type that sorts. A drawer's answer
is manual, deliberately: a grid is a place, and a place you did not arrange is
a list.

**A new object is scrolled to.** *The bug:* made inside a drawer on a phone, a
new object appeared to do nothing at all. It was placed correctly — a board is
a coordinate space, so `freeSpot()` scans from the top — but on a phone an
object is full width, so the first free room is *always* below everything
already there, a screen and a half down. `reveal()` scrolls to it and marks it
for a second. Not a placement change: quietly shuffling the board to make room
at the top would move things you put where they are.

**No type draws a coloured left stripe.** A stripe down the left is what
`priority` means; painting one on by default made every task look flagged.
Sliver, idea and quotation all carried one and none do now — `edge` is the
opt-in, on any object. In its place, four new shapes a task can wear: a filing
tab, a ruled line, a torn chit, a pill. And the tick on a tile is twice the size
it was, because it sits on a drag handle and missing it picked the tile up.

*Also:* a long press is Bureau's, not the text selection's — the unprefixed
`user-select` only lands on Safari 17 and later, so `-webkit-user-select:none`
is the rule that actually does the work on a phone, and `touch-action:
manipulation` stops the double tap zooming instead of editing. And `openPanel`
now schedules its `open` class every time rather than only for a fresh element:
a panel opened twice inside one frame lost it and sat 101% to the right of
where it had correctly measured itself to.

*Against:* the settings panel is long. It is one scroll instead of four
surfaces, which is the trade, but a note with milestones, a streak, relations
and tags is a lot of panel — the disclosures help and more of it probably
belongs behind them. And `S.openId` meaning something new is exactly the sort
of rename that reads fine today and is a trap in six months.

### 37. Two shelves, pages instead of scrolling, and buttons that say what they are

A phone pass. Everything here is the same argument in a different place: a
phone has one thumb, no right button, no hover and no room for a menu that
asks a question you could have answered by pressing the button again.

**The bar is two shelves.** A shelf is a strip of things you can reach without
going anywhere. The **top** one holds the tools — view, sort, lock, random,
settings — and the **bottom** one is where drawers pin by default; you can pin
to either. On a Mac both are drawn along the top, because a desk has no bottom
edge worth reserving. A pin is a **square** now, the same square as the tools,
in the drawer's own colour with its mark on it: the old little-front-with-a-name
gave each of five pins 78px and fitted "Done & Dusted" into none of them.
`S.pins` kept its name and became the bottom shelf, so no desk needs migrating.

**Every tool on the top shelf is a toggle.** The sort was a popup; it is one
button cycling seven states, wearing the one it is on — **M** for manual, **A**
and **Z** for the alphabet, and an arrow for each of the four directions of
made-and-modified. The lock is new and is the answer to a real problem: on a
phone the only way to *not* move something was to be careful. Locked refuses
moves and resizes; the long press still opens the menu either way, because
"tell me about this" is the one thing you must be able to do to a tile you
cannot pick up.

**A phone board does not scroll. It has pages.** The bottom row used to hang
half a cell past the bottom bar, which is the entire reason the board scrolled
at all — the row count was a `ceil`. It is a `floor` of the room between the two
shelves now, so the board ends flush, and everything past it is on the next
page. Two fingers up and down turn pages; two fingers left and right walk the
pinned drawers, with the desk at the front of the loop. Two fingers because one
is already carrying tiles.

A page is **not stored**. `y` is still one continuous coordinate space per
container and a page is a window of *n* rows onto it, measured per device — so
a phone with a taller screen simply has taller pages, drag and drop keep working
on plain arithmetic, and turning paging off would put every board back exactly
as it is. The one new rule is that nothing may straddle a page break, enforced
in `boxOk()`, which is the one place every box already passes through.

**The way in is a swipe up off the bottom shelf.** Tapping bare board opened the
type picker and was triggered by accident far more than on purpose — a board is
a surface you put a finger on to scroll, to steady something, or to miss a tile.
Dragging a size out on bare board still works, on both devices, because that one
is deliberate. And on a phone every menu comes up from the bottom rather than in
from the right: a panel from the right covers the whole board, and the argument
that made panels replace modals (decision 23) says a menu should not hide the
thing it is asking about.

**Also:** the version is in Settings, because "which Bureau is this phone
running" is exactly the question you ask when a change appears not to have
deployed, and it should be readable off the device rather than guessed at. The
resize grips are 34px on a phone against a mouse's 16, and their marks are drawn
rather than waiting for a hover that never comes. The default knob is medium.
The sample desk now carries one of every built-in type, named after itself,
generated from `KEYS` so a type added tomorrow appears without anyone
remembering — under the rack, from row 10, leaving six clear rows that every
hand-made object and every test fixture lands in first.

**And the long press finally stops selecting text.** `user-select:none` is
supposed to prevent it and demonstrably doesn't on iOS. Refusing `selectstart`
outright does, with an exception list for the places there is genuinely
something to select — a field, a page of prose, the writing surface.

*Against:* the page height is measured, so it is not the same number on two
phones, and a board arranged on one will have been re-packed for the other the
first time it is opened there. That is the cost of a board that always fits the
screen exactly, and the alternative — a fixed page height — fits no screen. And
a square pin drops the drawer's name; four squares in four colours are easy, and
nine will not be.

---

### 38. Furniture moves, and the movement never holds the app up

Bureau is a desk made of furniture, and until now none of it moved. A drawer
opened by the screen becoming a different screen. Ticking something off made it
vanish. A magic drawer had the one animation in the app, and it was a band of
light on a seven-second loop that did the same thing whatever you did — which
after a week reads as a thing blinking at you rather than as a surface.

Six movements now, and one rule that matters more than any of them.

**The rule: nothing here delays a state change.** A tap files, ticks or
navigates the instant it lands, `render()` runs, and the movement is drawn
*over* the result. The drawer front you just pulled is a copy flying over a
board that has already changed; the strip that slides between two boards
commits before it has finished sliding. This is why `motion.js` draws into
`#fx` and hangs the pager off `#frame` rather than `#app` — both live outside
the thing `render()` replaces, so a state change can land underneath a
flourish that is still finishing its sentence. An animation that has to
complete before the app will answer is the reason animated apps feel slow, and
it is a very easy thing to build by accident.

**How a thing opens is a property, not a branch.** `opening` — auto | drawer |
cabinet | curl | lift | none — per object, then per type, the same shape as
`readOf()` and `clickOf()`. `auto` asks the object what it *is*: a container
over four cells square swings open like a cabinet, a smaller one pulls out like
a drawer, a shape that is drawn as a sheet of paper curls up off the board, and
everything else gives a small lift so a tap is never silent. The threshold is
per device, because `sizeOfKind()` halves a container onto a phone and the same
drawer has to clear the same bar on both grids. It is a judgement, so the
settings row says which way it has gone.

**A magic drawer is foil, and foil doesn't move on its own — it moves because
you did.** The sweep is gone. `--holox` and `--holoy` live on `#frame` and mean
"where the light is coming from"; on a phone they come from how it is tilted,
on a Mac from where the pointer is. Nothing about the drawer animates: it is a
material that catches light, and the light is the only moving part. iOS hands
over the motion sensors only from inside a real gesture, which is why this is a
button in Settings rather than something that quietly happens.

**A swipe is something you can do slowly.** Walking between pinned drawers, and
between the pages of a board, used to redraw the screen the moment the gesture
passed forty-six pixels. It was correct and it felt like nothing: there was no
sense of the boards being laid out beside each other, so a wrong turn was a
surprise rather than something you could see coming and pull back from. The
neighbour is drawn *before* you get there now, into a strip that follows your
finger; letting go either carries it the rest of the way or puts it back. That
is the whole trick behind an iOS home screen. Sideways the strip carries the
whole of `.main`, because the bar says which drawer you are in; up and down it
carries only the board, because the page dots are counting the pages and must
not slide away with one.

**On a locked board, one finger does it.** Decision 37 gave a board a lock so
that a phone could be scrolled without disturbing what is on it. A locked board
also has nothing for a finger to carry — so the finger walks the boards
instead. Two fingers still work everywhere; one finger works where it cannot
mean anything else. A tap still opens the tile under it, and the long press
still opens the menu, which were already the two things a locked board had to
keep.

*Against:* six movements is five more than Bureau had, and every one of them is
a thing that can be in the way when you are moving quickly. They are short
(340–520ms) and none of them blocks anything, but the honest risk is the
cumulative one — the second week, not the first. The `opening` row exists partly
so any single one can be turned off per object or per type without touching
code, and `prefers-reduced-motion` turns off the lot.

*Also against:* the pager builds two whole neighbouring boards at the start of
every swipe. On a desk of a few hundred objects that is nothing, and it happens
once per gesture rather than per frame, but it is real work at the moment a
gesture begins — which is the worst moment for it. If a swipe ever feels like
it starts late, this is the cause, and the fix is to build only the board in
the direction the finger is already going, which is already known by then.

---

### 39. More than one desk, and a rule that knows which one it is on

One desk works until the desk is asked to be a life. Finances, a screenplay,
what to eat, who to ring, when to run — all of it landing on one board, all of
it visible from everywhere at once. Adding a life area cost a row of the same
board and made every aggregation on it slightly less true, which is a cost that
grows linearly and never stops.

**A desk is a drawer that has been given a place in the master space.** The
master space is an ordered row with home in it like anything else. A drawer in
the row is somewhere you can *be*; a drawer that isn't is somewhere you went
*into*. That is the whole of the distinction, and it shows up in exactly three
places: the breadcrumb roots at the nearest desk rather than walking home
(`chainOf` stops at one), the top shelf belongs to the desk you are on rather
than to the app, and a sideways swipe walks the row.

Deliberately *not* a new noun. A desk is a drawer, `S.desks` is a list of ids,
and promoting one is `setPin(id,'desk')`. If those three behaviours had not
earned it, the honest answer would have been that desks and drawers are the
same thing with different names — and they nearly are. What earns it is the
first one: "am I inside something, or am I somewhere" is most of how a place
feels, and a breadcrumb reading `Desk › Finance › Bills` is a path back to a
house nobody has lived in since there was more than one of them.

**The row does not wrap.** The old two-finger swipe looped through the pins, so
walking right from the last one arrived at the desk. A space you can walk off
the end of is a space you can learn — "Finance is two to the right of home"
only means anything if two to the right of the last desk is nothing at all.
Rubber-banding at the ends was already in the pager; the loop was the only
thing making it unreachable.

**The bottom shelf became the master space, and the top one became per desk.**
The bottom shelf was a list of favourites, which is halfway to being a list of
places already. The top one moved the other way for the same reason the
breadcrumb did: what you keep to hand is a different answer in Finance than in
a screenplay.

**A magic drawer collects from its own desk unless it says otherwise.** This is
the half that makes desks structural rather than cosmetic. A rule with nothing
bounding it matches across everything there is, which is right for an inbox and
wrong for everything else — "anything due this week" on the Exercise desk
answering with a screenplay scene is the mess desks exist to stop. `scope` is
`desk` (the default), `all`, or `some` plus a chosen list, and it is checked
before every other clause so the archive obeys it too. For a desk that has
never been split up it changes nothing: everything is on the home desk, so
"this desk" and "everywhere" are the same answer. It starts mattering at the
moment you promote a drawer, which is the moment you wanted it to — and the
toast on promoting says so, because it is the one consequence you would not
guess.

**And a thing that lasts is not a thing with a date.** `date` is the day
something falls on. A trip, a shoot week or a term *occupies* days, and the
difference is not cosmetic: a calendar has to mark all of them, a timeline has
to draw a bar rather than a dot, and dragging one to a new day has to carry its
length with it. `span` is an attribute of its own rather than a second meaning
for `date`, because everything dated does not last, and an attribute is the one
thing a type can be given without anything else being told about it.

That change surfaced a real one underneath it: a magic drawer refused to
collect containers at all, so a calendar could never show a trip — and a trip
is a container, because it holds the plan. The refusal is right for a grid (a
rack of drawers inside another drawer is a desk with two of everything on it)
and wrong for a layout that runs on time, where the thing happening that week
is very often a container. `showsContainers(c)` is the exception, by face or by
layout, and it is the same shape as `keepsDone(c)`.

*Against:* two shelves that mean different things is a thing to learn, and the
star in the bar now promotes rather than pins — the quieter half of the
question moved into the panel, where it is less discoverable than it was.
`deskOf()` walks the parent chain on every `inContainer()` call, which is every
object against every container on every render; it is a depth-3 walk on a
personal desk and it has not been measured on a big one. And migration 15
promotes nothing, so an existing desk gains the machinery and none of the
benefit until a drawer is deliberately pushed out into the row. That is the
right default — promoting somebody's drawers for them would rearrange their
life — but it does mean the feature is invisible on first launch, which is why
the sample desk ships with two.

---

### 40. A desk is somewhere, so it stops being something

Promoting a drawer to a desk used to be a label. The drawer stayed exactly where
it was — a front on somebody's board — and also appeared in the row of desks,
so the same container was both a place you walked to and an object you looked
at. Opening it from the board and arriving at it by swiping were two routes to
one screen with two different meanings, and the breadcrumb had to pick one.

So promoting is a **move**. `setPin(id,'desk')` remembers where the drawer stood
in `wasIn`, clears its `parent` and both its boxes, and the drawer leaves the
board it was on. Demoting is the return trip: it goes back to `wasIn`, or to the
desk if that container has since gone. A container with a null parent is in no
coordinate space at all, which is what a desk is — `inContainer()` never matches
it, `chainOf()` stops at it, and `deskOf()` still walks up through it for
everything inside.

*Why:* a place and a thing are different, and the app had been saying so
everywhere else — the breadcrumb roots at a desk, the row is walked sideways,
`chainOf` stops there. Leaving the front behind was the one place that said the
opposite, and the cost was a drawer you could delete from a board while standing
inside it as a desk.

*Against:* promoting now removes something from a board you were looking at,
which is a bigger act than a star usually implies — so the toast says where it
went. And `wasIn` is a second piece of location state on the object, which is
exactly the kind of thing that goes stale; it is only read on demote and only
trusted if the container still exists.

---

### 41. One shelf, and the desks came off it

There were two shelves. The bottom one was the master space — the row of desks —
and the top one was whatever you had pinned on the desk you happened to be
standing on. Two strips, at opposite ends of the screen, both answering "what
can I reach from here".

The desks did not need a strip. They are laid out in space: a sideways swipe
walks the row, and pressing the name at the top left opens **all of them at
once**, drawn small, to jump. That is a map, which is what a space wants, and it
costs nothing when you are not looking at it. So the desks came off the shelf,
the top shelf went, and what is left is one strip along the bottom holding
anything at all — a drawer, a magic drawer, a project, a film. `S.pins`, global
rather than per desk, because something kept to hand is kept to hand wherever
you are standing.

It is drawn as a shelf now rather than as a row of buttons: a board with a lip
along the front and a slot cut for each pinned thing. A strip of buttons along
the bottom of a phone is a tab bar, and a tab bar is precisely what decision 22
deleted.

*Why:* the top shelf cost a row of board on every screen and answered a question
the bottom one was already answering. And a desk with a button is a desk you
navigate to rather than a place you walk to, which undoes most of decision 39.

*Against:* a desk is now one press further away than a drawer you pinned, which
is backwards if you spend all day moving between desks — you can pin a desk's
contents, but not the desk. Watch for that; the fix is to allow a desk on the
shelf too, not to bring the second strip back.

---

### 42. The magic foil was tacky

A magic drawer was holographic: a rainbow spectrum under a specular highlight,
both driven off two numbers on `#frame` that came from how the phone was tilted
or from where the pointer was. It replaced a band of light that travelled across
the front on a seven-second loop, and it was a real improvement on that — a
surface that moves because *you* did rather than because a timer said so.

It was still wrong. A drawer that fills itself is *illuminated*, which is a
manuscript idea; a foil is a trading card. The spectrum was also the one place
in the app that named hues outright, which made it the one thing on the desk
belonging to no style. And it cost a `deviceorientation` listener, an iOS
permission prompt, a Settings button to ask for it, and an easing loop.

What is left is the gilt: a ruled frame inset from the edge with corner
brackets, and one wash of the style's own Glow held to the top edge where a lamp
would put it. It does not move. `--holox`/`--holoy` are gone and nothing
replaced them.

*Against:* the desk lost the one thing that reacted to the phone in your hand,
and that was genuinely delightful the first ten times. If it comes back it
should come back on a surface that has a reason to be lit — glass, water, an
actual foil — rather than on every container with a rule.

---

### 43. The new-object menu is pulled, not flicked

Swiping up off the bottom shelf opens the type picker. It used to fire the
instant the finger had travelled forty pixels — committed, with nothing on the
screen until it was already done. So a flick opened it, a sideways scroll along
the shelf opened it, and every swipe up out of the app to the iPhone home screen
opened it, which is the one that made this unbearable.

It is a real pull now. A drawer front rises out of the shelf after twelve pixels
and follows the finger the whole way; it opens only if you carry it about a
quarter of the screen, and letting go short of that drops it back. Nothing is
decided until you let go. The last 26 pixels above the bottom edge are left
alone entirely, because they belong to iOS.

*Why:* a gesture that commits at a threshold with no feedback is a gesture you
cannot aim, and this one shared its strip with the operating system's own. The
same argument made the pager follow your finger (decision 38); this is that
argument applied to the one gesture that was still a threshold.

*Against:* it is a longer stroke than it was, and on a big phone it is a real
reach. The distance is a proportion of the screen rather than a constant, which
helps, but "make something" is now a deliberate act rather than a flick — which
is the point, and will still be annoying on the day you want six things.

---

### 44. Ten columns on a phone, and the cell stays square

A phone board was eight columns. It is ten now — the cell goes from ~48px to
~39px, which is still a real tap target and gives a board that can hold a rack
of five drawer fronts across instead of four.

Ten by a **stated fourteen rows** was tried first, and reverted. Stating both
numbers makes a page the same shape on every handset — an arrangement made on
one phone is the arrangement on another, which is a genuinely good property —
but it costs the square cell: 390pt over ten columns is 39px across, while the
board over fourteen rows is ~52px down. A cell a third taller than it is wide
quietly rescales every size judgement in the app. A 2×2 drawer front stops being
a square, a 4×1 task stops being four times as long as it is deep, and `sz-mini`
stops being a stamp and becomes a domino. Every stated size in `KINDS` was
chosen against a square cell, and none of them were re-chosen.

So: the row height is the measured column width, on both devices, and the free
number is how many rows fit — a floor, so the last one ends flush above the
shelf. About nineteen on a 390 × 844 screen, about seventeen once iOS takes its
insets.

Both bars were slimmed to buy rows back, which is where the height came from.
The top one carries no pins any more (decision 41), so it is a thin strip with
the title, the lock, the sort and the gear — 34px. The shelf is one slot deep
and no deeper — 44px of slot and six of air. Every pixel taken out of either is
a pixel of board.

*Why:* a square cell is the thing that makes a size a size. Portability between
handsets is worth less than that, and it was only ever portability of the *page
break* anyway — `y` is one continuous coordinate space, so a layout already
survives a different row count; it just falls across pages differently.

*Against:* the number of rows still depends on the phone, so "the bottom row" is
not a place and a board can break across pages differently on a different
handset. Migration 17 rescales every stored phone box from eight columns to ten
by five quarters, and rounding can push two neighbours into each other, so it
re-places anything that collides — the same repair migration 10 already had to
make.

---

### 45. An inbox collects; it does not hold

For exactly one version, `create()` routed anything made without a stated place
*into* a nominated inbox drawer. It was the wrong shape, and obviously so once
it was running: a thing you made on the desk vanished off the desk. A drawer
that takes what you make is a drawer that files your desk for you, and the desk
is the one thing in Bureau that is yours to arrange.

So the inbox is a **magic drawer**, and its rule is the only one an inbox
actually has: *loose on a desk* — parented to a desk rather than filed inside
anything. `filter.loose`, checked in `inContainer()` alongside the rest. A new
object appears in the inbox the moment you make it and stays exactly where you
made it; filing it into any drawer takes it out of the inbox, because it is no
longer loose. Nothing moves. Nothing is taken.

That is also what makes the inbox agree with decision 17: a drawer holds, a
magic drawer collects, and nothing does both. The inbox was briefly trying to be
both — a container you filed into *and* the default destination — which is the
combination decision 1 was overturned for.

`S.inbox` is gone with it. There is nothing to nominate: any drawer can carry
the rule, and a drawer that carries it is an inbox.

*Against:* on a desk where most things are loose — the sample desk, where the
whole type museum sits directly on the board — the inbox collects nearly
everything. That is a true statement about that desk rather than a bug, but it
does make the shipped sample's Inbox a long list. Narrowing it with a kind or a
tag is one row in the drawer's own settings.

---

### 46. The shelf is the last row of the grid

The shelf was a strip of chrome bolted under the board: its own background, its
own padding, its own idea of how big a thing on it should be. Which meant the
shelf was a different *kind of thing* from everything it held, and pinning was
consequently a menu — you opened a drawer's settings and told it where to live.

It is a row of the grid now. Same nine columns, same square cell, same board
texture underneath, divided from the board by one hairline: nine by however many
rows fit, plus one. **9 × 13 +1**, in the shape it was asked for. It does not
turn with the pages and it does not change when you walk to another desk — the
board moves, the shelf stays, which is the whole point of a shelf.

And because it is a row of the grid, it is somewhere you can *carry* something.
Pinning is a drag now: pick a thing up and put it on the shelf. The object does
not move — `parent` and both boxes are untouched — because pinning is about
reach, not about where a thing lives. Taking it off again is the long press,
which is where every other question about one thing already lives.

It is a sibling element rather than a literal fourteenth row of `#drawergrid`,
and that is deliberate: the board's coordinate space stays exactly what it was,
so `boxOk()`, `freeSpot()`, `pageOfBox()` and the pager go on knowing nothing
about the shelf. Nine columns and one row of the same measured cell is all it
takes to look like part of the grid, and nothing has to be special-cased to keep
a tile out of it.

*Against:* nine slots is the whole shelf, and the tenth pin is refused with a
toast rather than scrolling — a scrolling shelf would stop being a row. A pinned
thing is also small: one cell, about 43px, with an eight-point label under the
mark. That is a dock, not a list, and if you pin nine things you will be reading
them by colour.

---

### 47. Hold to make, hold to take — the locked board's two long presses

A locked board had one finger free and spent it entirely on navigation: a drag
walked the boards, a tap opened a tile, and that was the whole vocabulary. So a
locked board could not make anything on a particular cell, and could not move
anything at all without first finding the padlock.

Both are long presses now, and which one you get depends on what is under your
finger.

**Bare board.** Move first and the finger walks the boards, exactly as before.
*Hold* first and the cell lights up: drag to size the box, let go and the type
picker opens on it. That is the missing half of decision 43 — pulling the shelf
makes a thing with nowhere in mind, and holding a cell makes one *there*, which
is what a grid is for and which a phone previously had no way of saying.

**A tile.** The hold opens the context menu, as it always did — but the gesture
is no longer cancelled when it appears. Keep holding and move, and the menu goes
away and the tile is in your hand: the iPhone home screen's gesture, which is
where every phone user has already learnt it. And because you have just
demonstrated that you want to rearrange the board, the board **unlocks**. Making
you find the padlock after that would be asking a question you have already
answered.

The unlock writes state and patches the two elements that display it — the grid's
`locked` class and the bar's padlock — without rendering, because the tile is
under your finger and `render()` would replace it. The drop at the end renders,
and everything agrees then. That is the same rule that lets you type into a tile
without the caret being destroyed.

*Against:* the tile long press now has three outcomes depending on what happens
next (menu, drag, or nothing), which is more than any other gesture in the app
carries. It is only defensible because it is the gesture iOS itself uses, and it
would not be worth inventing.

---

### 48. Three grid sizes, and the columns are the only number

A phone board has been eight columns, then ten, then nine, in three consecutive
versions, each chosen by argument rather than by looking at it. It is a setting
now — **Small** (8), **Extra** (9), **Large** (10) — so the question can be
answered by living with each of them for a day.

The column count is the only number any of them changes. The width is the
width, so the columns set the cell; the cell is square (decision 44), so the
cell sets the rows; and the last row is the shelf whatever the size (decision
46). Fewer columns therefore means bigger cells and fewer of them, which is why
Small is the fewest columns rather than the smallest tiles. Small is the
default.

A column count is a **coordinate space** — every stored phone box is measured
in it — so switching runs the same rescale a migration does, live, on the
objects in memory. Each tile keeps the fraction of the screen it had.

Two details in that rescale earn their place, both learnt the hard way:

- **Round half down.** Half up grew a two-cell drawer front into three every
  time the grid got finer (2 × 1.25 = 2.5 → 3), which broke the rack apart and
  then could not put it back — flipping Small → Large → Small returned a
  different desk from the one you left. Half down keeps it two in both
  directions, and a full-width tile still maps exactly (8 × 1.25 = 10).
- **Scale the left edge, not the column number.** Column 3 is *two cells in
  from the left*, not three, and scaling the 1-based number instead of the
  offset slides everything right as the grid gets finer.

Together those make eight to ten and back the arrangement you started with, for
the sizes that matter. It is not guaranteed in general — two roundings can
still land a box a cell from where it began — which is why this is a setting you
choose from rather than something a gesture does.

*Against:* three sizes is three things to test, and the phone grid is now the
one coordinate space in the app that a *setting* can change. That is a real
sharp edge: anything that stores a phone box has to accept that the space it
was measured in may be replaced under it. Nothing does, today, because every
box goes through `lay()` — which clamps — and `boxOk()`, which refuses.

### 49. A picture opens onto the picture

An object made of an image opened onto the reading surface, because "read" was
the only thing a click had ever needed to mean. So an Image object gave you a
sheet of US Letter with a photograph gummed along the top of it and a blank page
underneath — and, worse, no way at all to *put a picture in*. Choosing a file
lived in one row of the settings panel, which you had to know was there.

There is a third surface now. It is the same stage the writing surface uses —
same scrim, same head, same dark room — with the image on it as large as the
window allows, matted rather than mounted. Replace and Remove are in the head,
because that is where you are looking at the thing you want to change. And when
there is nothing in it, the empty mount **is** the button: "Add image" as a line
of text beside an empty rectangle asks you to find the small target instead of
pressing the obvious one.

Which objects go there is a property, not a type name: `isPicture(o)` is "it
carries media, and that media is an image". The media *type* now falls back to
the type's own `mediaType`, so an empty Audio object is still for audio rather
than being guessed at as a photograph that hasn't arrived. An image that also
carries text keeps a Read button in the head; reading is a thing you do to
words, and it is still there for the words.

The empty tile changed with it. A picture with nothing in it fell through every
branch of `drawTile()` to the ordinary card — a title, an empty body, and no
indication that anything was missing or that pressing it would help. It is a
dashed mount now, which is the one place in Bureau a dashed edge is honest:
this is genuinely a thing that is not there yet.

*Against:* a fourth thing on the screen to keep consistent, and `openRead()` is
now something the *caller* routes around rather than a single door. Routing at
the tap — `tileTap`, `openObj`, the context menu — keeps `openRead` meaning one
thing, at the cost of three call sites knowing about the choice.

### 50. A cabinet wears two knobs, and a front with no room for a name wears its mark

Two admissions a drawer front had to make.

**Standing containers swing.** `openingFor()` gave doors to anything over
sixteen cells and a pull-out drawer to everything else, which is a rule about
*area* answering a question about *shape*. A 2×3 or a 2×4 front is a cabinet at
a glance — a tall narrow thing with a door on it — and pulling it toward you
read as the wrong piece of furniture. Taller than wide, at two cells of width or
more, now swings; two doors inside one cell of width is not a cabinet either,
which is where the floor comes from.

And a front that swings open wears **two** knobs, one either side of the seam.
It had one in the middle — a drawer's pull, on a thing that does not pull — so
the only way to find out which movement you were about to get was to tap it and
watch. The knob count follows `openingFor()` rather than repeating the size
test, so setting a tall drawer to "pulls out" puts the single knob back. That is
the same discipline as every other look in the app: ask the property, never the
dimensions.

**A front too small for a name shows its mark instead.** At one cell of height,
or one of width, a name is three letters and an ellipsis printed across the
knob, which reads as a rendering fault rather than as a small drawer. The 1×1
tile already had the answer — the type's mark and nothing else — and this is the
same answer arrived at from the other side. `sz-thin` joins `sz-short` and
`sz-narrow`, the mark is rendered on every plain front and revealed by the size
class, and the stylesheet still only ever *takes away*.

*Against:* the two-knob rule changes fronts nobody complained about — every
container over sixteen cells has grown a second knob, because it was already
swinging open and lying about it. That is the point, and it is still a change
you did not ask for on a desk you had arranged.

### 51. The object editor, and the thing itself on a moving floor

Object settings became the **object editor**: same panel, same rows, one
addition and a different mark on the button that opens it.

Everything in that panel already wrote straight to the object and re-rendered
the board, so it was live — as long as the tile happened to be on the screen,
unobscured, and on the page you were looking at. Often it is none of the three:
the panel covers it, a phone panel covers the whole board, and the tile you
opened the editor from may be a page away. "It updates live" was a promise you
could only keep by closing the thing you were using.

So the object is drawn at the top of its own editor, through the same
`gridTile()` the board uses, on the floor a video game puts a model on: a
checkerboard scrolling diagonally. The motion is the whole message — a pattern
that moves says *this is the thing, not the place it lives* — and it holds still
for anyone who has asked for less movement. What is drawn is a **clone** with a
throwaway id and its box moved to the origin: a second element carrying the real
id is one the drag, the bubble's anchor and `tileOf()` could all pick up instead
of the tile, and a box carrying the object's real `x` lands in a column the
preview grid hasn't got.

The button is a **paintbrush** now, not a gear. Inside a drawer the bar's gear
opened that drawer's settings while the same gear on the desk opened the app's,
which is one icon standing for two questions in the same corner of the same bar.
The desk keeps the gear; everything about one object gets the brush.

Two settings arrived with it, both of which had been type-level only:

- **Text size**, per object — a multiplier rather than a size, so a name that is
  15.5px on a card, 11.5px on a narrow front and 11px on an index card keeps all
  three answers, multiplied. Making a note readable from across the desk used to
  mean resizing the tile.
- **The mark**, per object. A type carries one and every object of that type
  wore it, which is right until two drawers of the same type sit side by side
  and the only thing telling them apart is a name too small to read. The first
  chip is the way back to the type's own.

*Against:* the stage is a second live rendering of a tile, and a second place a
tile can be drawn wrong. It goes through `gridTile()` precisely so it cannot
drift — if it renders wrong there it renders wrong on the board — but it is
still one more thing to keep true.

### 52. Refuse the selection at the top, exempt downwards

iOS reads a long press on ordinary text as "select this", and puts a magnifier
over the tile you are trying to lift. The defence was a list of the places a
long press was *known* to land — `.drawer`, `.pinbar`, `.gridbar`, the context
menu, a panel's header — which meant every surface added since arrived
selectable and had to be found out about by holding it on a phone.

Stated the other way round it closes by default: `#frame` refuses, and the
exemptions are the handful of things there is genuinely something to select in —
a field, a page of prose, the writing surface. The exceptions are countable and
the surfaces are not.

Two holes closed with it. `.pbody` was on the exempt list, which exempted an
entire panel — every label, every chip, every row — when only its fields were
ever meant. And refusing `selectstart` does nothing about a selection that
*already exists*: Safari keeps a highlight, and the callout that goes with it,
from a press two gestures ago, so the next hold anywhere near it grows the
magnifier again. Every press that turns into one of Bureau's own gestures now
drops whatever was selected first — never inside a field, where the selection is
yours.

*Against:* selecting text in the interface is now impossible outside those
exemptions, on a Mac as much as on a phone. Copying a drawer's name off its
front is not a thing you can do. That is the trade the magnifier was worth.

---

### 53. The shelf comes out, and the row goes back to the grid

The shelf was one global row along the bottom of a phone board — the last row of
the grid, same nine columns, same square cell — holding whatever you wanted to
hand from wherever you were standing (decisions 41 and 46). It is out.

*Why:* it was the third answer to "what can I reach from here" and the app
already had two better ones. Desks are laid out in space and walked sideways,
and the name at the top left opens all of them at once. A magic drawer collects
anything you can describe, from one desk or from every desk, and pinning one of
those is what "keep Today to hand" actually means. ⌘K finds the rest. Against
those three, the shelf's contribution was reach — and it charged a **row of every
board on every desk** for it, on the one device where rows are scarce. Eight by
thirteen plus one is eight by fourteen with a row spent on navigation.

So the row goes back to the board: 8×13, 9×14 and 10×15 at the three sizes, and
the last row of a board is a row you can put something on. The space the shelf
used to hold at the bottom of the screen — its `margin-bottom` was the safe-area
inset — moves onto `.main` as padding, because a phone screen is a rounded
rectangle and a grid that runs into the curve loses its first and last tile to
it. `sizeGrid()` subtracts that padding before counting rows, so the board never
reaches for room that was reserved.

Three things went with it, and they are the cost:

- **Pinning.** Carrying a tile onto the shelf, and the long press that took it
  off again. `setPin(id,'pin')` is still accepted and now means "not a desk"; the
  panel offers the board or a desk of its own, and nothing else.
- **The pull.** A drawer front rising up out of the shelf to open the type picker
  (decision 43). It came out *of* the shelf, so there is nowhere for it to come
  from. Holding a bare cell (decision 47) is the way in now, and it was always
  the better half — pulling made a thing with nowhere in mind, holding a cell
  makes one *there*, which is what a grid is for.
- **The toggle.** Pressing the pin you were already in went back to whatever it
  interrupted. Nothing else in the app is somewhere you duck into, so `PLACE`
  went with the shelf.

`S.pins` is still loaded, filtered and saved exactly as before, and `placeOf()`
still knows the word. Nothing anybody put on a shelf is lost, and putting it back
is putting back `shelfStrip()`, `pinTile()` and the two drop branches in
`gestures.js` — which is why this is written down rather than deleted quietly.

*Against:* something genuinely kept to hand — the drawer you are living in this
week — is now a tile on a board like everything else, and reaching it from three
desks away is a swipe rather than a thumb. If that turns out to matter more than
a row does, the shelf comes back and this decision is the thing to reverse.

---

### 54. A cabinet is which way round it is, not how big it is

`openingFor()` gave doors to a container that **stands** — taller than it is
wide, at least two cells across — *or* to one over a certain area: sixteen cells
on a desk, four on a phone.

The second clause was wrong and it was wrong loudly. A 4×3 drawer — a front half
again as wide as it is tall — is twelve cells, which cleared the phone threshold
three times over, so the commonest shape of drawer on a phone board swung open
like a wardrobe. No piece of furniture ever built puts doors on something wider
than it is tall; that is a drawer, and it pulls.

So the area test is gone and `standing()` is the whole of it. Size is not the
question. A 6×5 chest is a drawer, a 2×3 is a cabinet, and the front says which
before you touch it — one knob or two, either side of a seam.

The seam grew up with it. It ran from 6% to 94% of the knob strip's height,
which on a `knb-bottom` front was 6% of the bottom third — a scratch down one
panel rather than the place two of them meet. It hangs off the tile now, top to
bottom, overshooting by the front's own border width so it cuts through the
border at both ends. Two doors have a gap between them and the gap goes all the
way.

*Against:* a large square container no longer swings, and the cabinet movement
is now rarer than it was. That is the price of the front telling the truth.

---

### 55. The app is a piece of furniture, and the board is set into it

A phone screen has two strips the board cannot use: the notch above the bar, and
the curve of the bottom corners below the last row. They were paper, so they
read as a board that had failed to reach the edges of the screen — and the
bottom one had just lost the shelf that used to occupy it (decision 53).

They are the desk itself now. `--wood` and `--wood-2`: a deep walnut above the
bar, and along the bottom a **drawer front** with a round knob on it. The board
is the surface set into that carcass, with a shaded reveal where the two meet.

Three things follow from it being real furniture rather than a margin.

- **The wood is the same in light and dark**, and it is deliberately *not*
  derived from the style's five. A desk is walnut at midday as much as at
  midnight, and paper laid on pale wood reads as a rendering fault. A style may
  overrule it in its own `vars` if it is made of something else.
- **The knob takes you out** — out of a drawer to the desk it stands on, and
  from a desk to the home desk. Nothing when you are already home.
- **Pulling it opens the new-object picker**, which is decision 43's gesture
  given back the thing it comes out of. It went with the shelf and it was
  missed: holding a bare cell makes a thing *there*, and pulling makes one with
  nowhere in mind, which is what you want when the thought arrives before the
  place for it does. A drawer is a thing you pull open, and this one is drawn as
  one — which is better furniture for the gesture than the shelf ever was.

The rail's height is written by `sizeGrid()`, because it is also where half the
leftover goes. A board is a whole number of square cells and a screen is not, so
there are always a few pixels over; they are split evenly between the reveal
above the board and the depth of the drawer below it. Giving the lot to one end
was tried both ways and neither survives a screen whose height divides badly —
all of it below is a drawer front two rows deep, and all of it above is the dead
strip under the title that decision 44 spent a version removing. Half each is at
most half a cell of either, and the board ends up centred in its carcass, which
is what a surface set into a frame looks like anyway.

*Against:* the rail costs about thirty points of screen that used to be
nothing — less than a row, but not nothing. And two gestures now start on the
same strip, told apart by whether you moved; that is the same bargain the tile
long-press makes, and it is a bargain rather than a free lunch.

---

### 56. The dots by the title are the desks, not the pages

They counted the pages of the board you were on. Position in the wrong axis: how
far down you have scrolled is a thing the board itself tells you by what is on
it, and it changes every time you flick.

The row of desks is the thing you can genuinely be lost in — it is walked
sideways, it does not wrap, and there is nothing on screen that says how far
along it you are. "Third of five" is exactly what a strip of dots says better
than anything else, which is why every home screen ever made uses one for
precisely this. So the dots are the desks, in the order they sit in the master
space, with the one you are standing on lit; they follow you into a drawer,
because a drawer is on a desk; and pressing one goes there.

The page count is still worth knowing and is now a number rather than a place —
`2/3`, only when there is more than one.

*Against:* a board with fifteen pages says so in four characters and no longer
lets you jump to page seven by aiming at a dot. Two fingers still walk them, and
aiming at the seventh of fifteen dots was never really a thing you could do.

---

### 57. The bar is part of the carcass, and the carcass is one piece

Decision 55 made the strips above and below the board out of wood. It left the
bar itself on paper, which drew a line straight across the top of the screen
between the notch strip and the bar — two pieces of the same piece of furniture,
divided by a change of material. The wood read as a second bar sitting on top of
the real one.

So everything above the board is now one surface: the safe-area inset, the bar,
and the reveal under it. The board is the only paper up there, and it is set into
the wood with a shadow line where they meet. `.main` is the carcass rather than
the surface — the grid paints its own board, and the layouts that are not a grid
ask for paper explicitly. The bar overrides `--ink`, `--rule` and friends for its
own subtree, the way a drawer front does with `--dink`, so light-on-dark is a
local fact and nothing outside it changes. Its accent becomes the style's **Glow**
rather than its Brass, because brass on walnut is two browns and the lit dot for
the desk you are on disappears into the grain.

The bar is also about a fifth taller than it was. It had been squeezed to the
pixel while the shelf was eating a row of the board; the shelf is gone, the row
came back, and a title crammed against a grid is not worth the third of a row
that buys.

**And the wood is furniture you can change.** Knob shape, knob size, knob colour,
texture and the wood itself are rows in the desk's own editor — the same panel,
and the same questions, a drawer front is asked. The knob carries `.pull`, so all
six shapes and the light on it are the ones every knob on the board already has;
a shape added for one is added for both. The keys are prefixed (`railknob`,
`railtexture`, `wood`) because for every desk but home `cfgOf()` is the drawer's
*own* object, which already has a `knob` and a `texture` for the tile it draws on
its parent's board.

The wood is per desk and it is the whole carcass, not just the rail — one piece
of furniture, so `render()` writes `--wood` onto `#frame` and the strip, the bar
and the drawer all follow. `--wood-2` derives from it, so the shaded edge comes
along.

*Against:* the bar is now the one place in the app where the ink tokens are
inverted, and anything new dropped into it has to survive that. The rule is the
same one `.drawer` has lived under since the beginning — don't reach for
`--ink-*` inside a dark surface — but it is a second place to remember it.

---

### 58. A board drawn off-screen is drawn at the size it will be

The reveal above the board and the depth of the drawer below it are computed by
`sizeGrid()` *after* layout, because both depend on the measured cell. They were
written onto the elements at that moment and nowhere else — which is correct for
the board you are looking at, and wrong for the one being slid in beside it.

The pager builds its neighbours from `previewHTML()`, a string. That string had
no inline reveal, so an incoming desk arrived at the CSS floor: the board sat a
few pixels high and the drawer under it was shallow, and the whole thing clicked
down into position the instant the swipe committed and `render()` measured it.
A swipe that ends with a jolt reads as the app catching up with you.

So the numbers are held in a `REVEAL` holder and written into the markup **as it
is built**, exactly as `gridOfContainer()` already writes the checker squares
from the last measured cell. `sizeGrid()` keeps them up to date; the first frame
of a brand-new board uses the last measurement, which is right within a pixel,
and the measurement that follows agrees with it.

This is the general rule and it is worth stating once: anything measured after
layout that affects *where things sit* has to be readable at build time, or every
surface drawn off-screen — a pager pane, a stage, a preview — is drawn wrong and
corrects itself in front of you.

*Against:* two more numbers living in module state between renders. They are
derived, never stored, and stale by at most one frame.

---

### 59. A pass may remember, and a rebuild may wait a frame

Walking sideways between desks was laggy, in three separate places. None of
them was the animation.

**Drawing a board asked the same question fifty times.** `childrenOf()` walks
every object on the desk and asks `inContainer()` about each — for a magic
drawer that means running its rule — and then sorts what is left. That is the
right shape for a question that has to be able to change its mind. But drawing
one board asks it for the board and then again for every container on it: a
checklist lists its lines, a calendar walks its days, `projectStat()` walks a
whole subtree calling it at every level, and `freeSpot()` calls it once per
candidate cell while placing a board nobody has visited yet. Two hundred
objects and fifty calls is ten thousand rule evaluations to draw one screen.

So a **pass** may remember. `beginPass()` opens a memo and `endPass()` closes
it, and it is only ever open for the length of one synchronous string build —
`viewHTML()` and `previewHTML()` are the two. Outside a pass the map is null and
every call is the honest walk it always was, which is what keeps this from being
a cache that can go stale: there is no invalidation to get wrong, because it
does not survive the statement that opened it. Placing a box during a pass is
fine — `ensureBox()` changes where a thing sits, never which container it is in.

The first visit to a desk went from 74ms to 13.

**Rendering laid the board out twice.** `sizeGrid()` measures after layout and
then writes what it measured — `--rowh`, the checker squares, the row template,
the reveal above the board, the depth of the drawer below. Every one of those
was written on every render, whether or not it had changed, and a style write
that changes nothing is still a style write: the board was laid out once for the
measurement and again for the writes, before a single pixel could be painted.
The markup already carries last render's numbers (decision 58), so on any render
where the window has not moved the measurement agrees with what is on the
element and there is nothing to write. Two of those properties — `--cellw` and
`--cellstep` — turned out to be read by no rule at all.

Restoring `scrollTop` was a third forced layout, paid on every render to put a
scroller back to a top it already starts at. It is skipped when there is nothing
to restore, which on a phone is always: a phone board does not scroll.

**And the rebuild landed on the frame the settle started on.** Letting go of a
swipe changed desk *and* rebuilt the board in the same instant — fifteen
milliseconds of string, parse and layout on exactly the frame the transition was
meant to begin, so the strip stuttered to a halt instead of gliding to one.

`renderSoon()` moves the rebuild to the next frame. This is not the thing
motion.js forbids: **the state change still happens immediately** — where you
are changes in the same call — and it is only the DOM that waits, under an
opaque strip that is already drawing the board you are arriving at. Nothing
waits for a keyframe to *finish*, which is the rule.

The pager itself was doing all its work on the frame the gesture is recognised
in: two neighbouring boards built and laid out, plus a clone of the one already
on the screen. It is spread over two frames now. The frame that has to feel
instant builds only the neighbour you are moving **towards** — the other one
cannot be seen until you reverse past the middle, which takes longer than a
frame — and for that first frame the strip is transparent and carries the
**real** board, which costs nothing because it is already laid out. The picture
of it, and the far neighbour, are made on the next frame while your finger is
still moving; the real board steps out of the strip the moment its picture
exists, because letting go rebuilds `#app` and the real one would turn into the
board you arrived at while it was still sliding away.

*Against:* the pager now has a state it passes through — carrying the live board
— and a board that is hidden rather than absent while the strip owns it. If a
render happens mid-gesture, before the picture exists, the middle of the strip
is empty for the rest of the swipe. Nothing renders mid-gesture today (the drag
deliberately doesn't, and `unlockBoard()` patches rather than renders), but that
is now a thing to keep true.

---

### 60. How fine a board's grid is belongs to the board, and a new thing is small

The three phone grid sizes were one global setting. That is the wrong scope for
what they are: a column count is how a *board* is cut up, and a desk you keep
six big drawers on and a checklist you keep forty lines in do not want the same
grain. So `grid` is a property of a container, `S.look.grid` is the app's
default, and a board with nothing to say follows the desk it is on.

Two levels of fallback rather than one, because a desk set to Large is a desk
whose drawers should match, and a drawer that has been asked the question
directly should outrank both. `colsOf(cid)` is the resolver and `GRID.phone.cols`
is now the default and nothing else — reading it as "the columns" is the mistake
this decision exists to prevent.

Changing one rescales the boxes **on that board only**, the way a migration
would; changing the app's default rescales every board that was following it and
leaves the ones with an answer of their own alone.

The measurement had to change with it. `sizeGrid()` now measures exactly two
numbers — how wide a board is, and how much vertical room it has — and every
other number is arithmetic on those plus a column count: the cell is the width
over the columns, the rows are the room over the cell. Boards differ only in
columns, so the geometry of a board that is nowhere near the screen — a pager
pane, the drawer you are about to drop something into — is answerable without
measuring it. `PAGEROWS`, which was a stored number per device, is a function of
a board now.

**And a new object arrives no bigger than three cells either way.** An object
used to come out at the full width of the phone board, which is a first object
that has decided the board is about it: you made a note and there was nowhere
left to put the next thing. Three cells is a tile you can read from across the
room with room for two more beside it, and dragging a corner is one gesture
away. It trims a type's *stated* phone size too — a stated size is a preference
about proportion, and three cells is the room there is to have a preference in.

The desk's own sizes are untouched: 24 columns is a desk, and three cells there
is a postage stamp. `PHONE_MAX_NEW` is one constant if that turns out to be the
wrong call.

*Against:* two boards side by side can now be measured in different units, which
is a thing you can get confused by — drag a 3×2 tile from an eight-column drawer
into a ten-column one and it is the same three cells and a different size. That
was already true between the desk and the phone; it is now true within a device.

---

### 61. A name is a thing you can tap, and a list is a board

Two gaps, and they turn out to be the same gap.

**The name.** Editing was a double tap on a tile. That is a gesture you have to
be told about, it is one a phone spends on zooming, and it worked only for a
tile on a grid — so the words on a checklist front, which is where most of the
short text in the app actually lives, could not be corrected at all without
opening the drawer. Now the words *are* the target: tap them and they become a
field, wherever they are drawn.

Only on an **unlocked** board. Locked is the state a board is in when you are
reading it rather than working on it — one finger navigates there and a tap
opens what it lands on — so the rule is the same one the lock already carried
and there is nothing new to learn. `nameField()` in tiles.js is the whole of it
on the drawing side, `data-edit` on the wiring side.

On a checklist front this moves the tick onto the **box**. Tapping the line used
to tick it, which is why there was no way to fix a typo; the box is what a
checkbox is for and the words are what words are for.

**The list.** A list had the tiles and none of the controls. You could look at
things on one, and tapping anything opened the object editor — including a task,
which is a short string of text with `onclick:'none'` and no use for a page of
paper. So a list obeys the object's own click behaviour now, exactly as a grid
does, and it has the rest of the handful too:

    tap the words      change them
    tap the box        tick it
    swipe left         delete it
    swipe right        put it on today — offered only to something with a day
    hold, then move    reorder, under Manual sort
    hold still         the menu, which is everything else

Same two lengths of press as a tile, for the same reason. Sideways starts
immediately rather than after a hold, because a swipe you have to hold for first
is a swipe nobody finds; up and down waits the hold out, because up and down on a
list is the list scrolling.

The action is drawn behind the row in **one borrowed element**, not a strip built
into every band. A list is the one place in the app that can hold two hundred of
something, and two hundred copies of a thing you only ever see one of at a time
is two hundred you should not have built — the same argument as the drag chip and
the pull.

One thing fell out of it. A hold is three hundred milliseconds long and a render
that lands inside one replaces `#app` wholesale, so the node the press started on
is detached and the drag afterwards happens to something nobody can see. Putting
an inline edit down renders on the next tick, and since a name became something
you *tap* there is very often one open when the next press starts. The arming
callbacks look their element up again by id now (`refind()`), which makes the
drag survive any render rather than the ones we happened to think of.

*Against:* a tap on a drawer's name no longer opens the drawer on an unlocked
board — it renames it. That is the trade, and the lock is the answer: a board you
are reading is a board you lock, and that is the state it starts in.

---

### 62. When it sits is not when it is late

Things 3's central idea and the one thing in it Bureau had not got. `due` was
carrying two jobs: the day a thing *sits* on — what a calendar draws it on, what
Today collects, what a drag onto a day cell writes — and the day it is *late*.
An app that stores one of those makes you lie about the other. Put a task on
Monday because that is when you meant to start it and it is overdue on Tuesday;
give it Friday because that is when it is owed and it is invisible all week.

So `deadline` is an attribute of its own, carrying the field `dead`.

- `date`/`due` is unchanged and still means the day it sits on.
- `deadline`/`dead` means the day it is owed.
- `lateOn(o)` says which of the two decides: the deadline when there is one,
  otherwise the day it sits on — which is exactly what everything did before
  this existed. `isLate(o)` is that date being in the past, and a finished
  thing is never late.

**Opt-in, and not on Task by default.** Nothing already on a desk changes, no
migration is needed, and a thing merely *scheduled* for Friday stays a different
thing from a thing *owed* on Friday. Tick Deadline in an object's traits, or in
the type builder, and the field appears; leave it and the app is what it was.

It is a field, so a magic drawer can rule on it for free — "anything owed this
week" is two clauses and no new machinery (decision 63).

*Against:* two dates on one object is one more thing to explain, and most tasks
will never want the second. That is why it is a trait rather than a field on
Task: the ones that want it ask, and the rest never see it.

---

### 63. Two clauses, ANDed, and no OR

A magic drawer's shorthands already stacked — types AND tag AND loose AND the
rule, in sequence — but there was exactly **one free field clause**, so:

- "due after Monday and before Friday" could not be said, and neither could
  "due this week", which is the same sentence;
- "high priority *and* has a duration" could not be said;
- more than one tag could not be said.

`filter.rules` is an array now, ANDed, capped at three, drawn as a row each with
one empty row on the end — which is how you add one without a button that has to
know how many there are. Clearing a row's field removes that clause and the list
compacts, so "clear the first of two" leaves one clause rather than a hole.

**There is no OR and there is not going to be one.** An OR needs groups, groups
need a builder, and a builder is a query UI — which is precisely the thing
tags-becoming-drawers exists to avoid (decision 22). Two clauses covers what a
desk actually asks; if you want a union, that is two drawers, and two drawers on
a board is a thing you can see.

Two smaller repairs came with it, both of which had made date rules useless:

- **A date is compared as a date.** `numOf()` strips everything but digits, dots
  and minus signs, so `"2026-08-19"` came out of it as `2026` — every "due
  before" rule was an assertion about the year. ISO dates sort as strings, which
  is the whole reason they are stored as strings.
- **A date written into a rule goes stale.** So five words are resolved when the
  rule *runs* rather than when it was written: `today`, `tomorrow`, `week`,
  `month`, `year`. "Before next week" keeps meaning it on Monday.

`rule` is still read where `rules` is absent, so a backup made before migration
21 collects exactly what it always did.

---

### 64. A render is not a change

`render()` ended with `save()` and a comment saying "cheaply". At the size
Bureau is used at, the comment was right: 0.4ms. At three thousand objects it is
**35ms** — the most expensive thing in the frame — and it fired for renders that
changed nothing at all: walking to the next desk, turning a page, opening a
drawer, closing a panel. On the 250ms debounce, while you are dragging.

Every mutation already says `save()` for itself. The only thing a *render*
writes is a box invented by `ensureBox()` for an object appearing in a layout
for the first time — so placement says so, with a counter (`PLACED.n`) that
render() reads either side of the build. Everything else goes through
`saveIfDirty()`, which writes only when a real change is waiting.

A counter rather than a call into `persist.js`, because a module that answers
questions about coordinates has no business knowing what a disk is.

The debounce changed shape at the same time. It used to `clearTimeout` on every
call, so a change every 200ms — which is what a drag is — pushed the write
further away each time and nothing reached storage until you let go. It is a
**ceiling** now: the first change starts a 250ms clock and later ones ride it,
so a write lands at least that often however busy it is. Safer as well as
faster.

---

### 65. Undo covers everything, and there is a redo

`pushUndo` was called from four places, all of them deletions. A panel edit, a
drag, a resize, a type change, a colour, a reparent — none of it was on the
stack, and ⌘Z after one of them did nothing, silently. That is worse than having
no undo at all, because you try it.

Three additions and no new machinery:

- **`pushSet`** records one field going back to what it was, and **coalesces**:
  a set touching the same field of the same object within 1.5s rides the move on
  top rather than pushing another, keeping the *first* value — which is what
  "before I started typing" means. Without it a ten-letter rename is ten moves
  and the stack is full of one edit.
- **`pushSets`** records several fields of several objects as one move, which is
  what a drop is: a reparent carries both boxes, a scheduled drop carries both
  dates, a group drag carries every tile in it.
- **`redo`** is a second stack. `applyMove()` replays a move backwards *and*
  returns the move that would replay it — so redo is not a special case, it is
  the same function pointed the other way. A new move clears the redo stack,
  because keeping it across an edit is how a redo comes to reinstate a change on
  top of a desk it no longer fits.

One thing is deliberately left out: the **desk's own settings**, which live in
`S.deskCfg` and have no id for a step to point at. Giving them one would mean
inventing an object for the one container that deliberately hasn't got one.

---

### 66. A panel asks one question

The object editor was nineteen rows in one column — name, type, where it lives,
shape, colour, a wall of thirty marks, text size, edge, border, knob, knob
colour, texture, board, click, opening, reading, every field its traits carry,
milestones, a streak, tags, relations, traits, duplicate, delete. Settings was
seventeen sections with a *Testing* button among them and "erase everything"
three scrolls past the thing you came for. Everything an object can be asked was
in one place, which was the point, and it made changing a colour a scroll past
everything an object can be asked. On a phone the panel covers the board, so
that scroll is the whole screen.

Both are a short list of **doors** now. The object editor's top is what you came
for — the thing itself on its stage, its name, its type, where it lives — and
under it: Look, Behaviour, Fields, Collects, Tags and links, Traits. Settings
is Style, Appearance, Your things, Paste in, About.

Each door is the **same panel under the same key**, so a section replaces rather
than stacks. `spec.back` is the way out — a chevron in the head — and it is the
one thing a replaced panel never had, which is why this had been sitting open on
the roadmap since INFLUENCES.md named it.

*Against:* everything is one press further away than it was. That is the trade,
and it is the right way round: the rows you reach for most are on the top level,
and the twelve you touch once a year are behind a word that says which is which.

---

### 67. The picker leads with what you use

Forty types in six sections, every time, on every device, wherever you were. The
most beautiful screen in the app and a catalogue.

It leads with a handful now — five, counted off `S.objects` — and every type is
behind one more press. Counted rather than stored, because a frequency you keep
is a frequency that goes stale and needs migrating; the count is three lines and
answers from the desk in front of you.

And a container that says what it makes goes **first**, whatever the tally says.
`genKind` already existed for the typing box; opening the picker *inside* a
Recipe is a stronger signal about what you are about to make than anything a
count across the whole desk knows. This is Notion's schema idea on machinery
Bureau already had.

---

### 68. Make the textarea behave; don't fake the paper

INFLUENCES.md recommended a syntax-highlight overlay behind a transparent
textarea — "80% of the feel for a fraction of the risk". **That is withdrawn**,
and the reason is structural rather than fiddly: the overlay has to share the
textarea's metrics exactly, and a textarea has one font at one size for all of
its text. So an overlay can change colour and can never change size or weight,
and a heading that is not bigger is not a heading. Bear's effect is a custom
text engine on a native text view; its own team built a second editor around
that behaviour rather than getting it from a control.

`contenteditable` can do it properly, is real work, is famously bad on iOS, and
is the first step down the road to a block editor, which is on the never list.

So the paper is left alone and the **typing** is made good, which is what people
actually miss:

    Return in a list     continues it — a bullet, a number, an emptied box
    Return on an empty   ends the list, rather than making another empty one
    ⌘B / ⌘I              wraps what is selected, and again takes it off

All of it goes through `insertText` where the browser has it, because that is
what keeps the textarea's own undo working — and ⌘Z inside a field is the
browser's to answer.

Bureau already has the other half. The reading surface did not exist when
INFLUENCES was written, and it is better paper than any editor's preview.

**And one object comes out as markdown.** Export was a whole-desk JSON button in
Settings — the right shape for a backup and no shape at all for "send me that
note". Copy is on the writing surface, the reading surface and the editor's
foot: the title as a heading, the body, the tags. Obsidian earns its trust by
being inspectable, and a store you can only get out of all at once is a store
you hope about.

---

### 69. The palette answers to the keyboard

⌘K opened a search field, and `Enter` ran result **zero**. The one list in the
app you summon with the keyboard and type into blind was the one list you had to
finish with the mouse. Arrows move the lit row now, and it wraps.

It also did not search **tags**, in an app whose entire filing story is that a
tag is a magic drawer waiting to happen. Now a tag matches as itself — running
it opens the drawer that collects it, which is what pressing a tag anywhere else
already does — and an object matches on its tags as well as its title and body.

---

### 70. The cursor on the board is the selection

There was no keyboard on the board at all: no way between tiles, no way to open
one, no way to delete one. That is also the accessibility gap the roadmap has
carried since the module split, approached from the side that has a payoff you
can see.

The arrows do not introduce a second idea of "the current tile" — they move the
**selection**, which already exists, already draws itself, and is already what
the context menu and a group drag act on. Space or Return opens what is
selected, ⌘⌫ deletes it, Escape puts it down.

Nearest in the direction pressed, weighing distance *across* the axis double, so
Right from a tall tile finds the thing beside it rather than the thing three rows
down that happens to be marginally closer.

---

### 71. Two types that could not do their one job

Audio and Video were real types with a mark, a size, a `mediaType` and a place in
the picker — and the file input was `accept="image/*"`. So they existed in order
to tell you they were not implemented, which is a promise the desk makes and
does not keep.

- The picker is told what to show, per object (`acceptFor`).
- A sound or a video is stored as the **Blob itself**, not as a data URL: base64
  is a third bigger, and a third bigger on a phone recording is tens of megabytes
  for nothing. `hydrateAssets()` makes an object URL on the way out. A picture
  stays a data URL — it is small after downscaling and it survives an export.
- There is a **ceiling**, 60MB. IndexedDB will accept a file that then makes the
  desk slow to open, and a refusal you can read beats a desk that has quietly
  become sluggish.
- The media surface **plays** them, with the browser's own transport. A player
  is a control nobody should be reimplementing.
- On the board they are a face — a mark, a name, how long it runs — and not a
  player. Forty decoded media elements is a board that will not scroll.

`isMedia(o)` is anything carrying a file and is what routes to the surface;
`isPicture(o)` still means the image case, and `isPlayable(o)` is the other two.

---

### 72. Priority is a rank, 0 to 5, and it is not urgency

Low, mid, high is a shape you outgrow the moment you have more than a handful
of important things, because "high" stops telling you *which* high thing to do.
Six levels do, and each one says what it means rather than leaving it to the
reader:

    0  Not now       a dream — nothing to act on yet
    1  Barely        barely a task; the least of it
    2  Taking hold   starting to take precedence
    3  Decent        worth an afternoon
    4  Important     solidly important
    5  The one       the most important thing in the docket

**It is about how much a thing matters, not how soon it is needed.** Urgency is
a deadline coming up and consequences for missing it, and that is `deadline`'s
job (decision 62). An app that folds the two together makes you answer neither:
the tax return is urgent and dull, the novel is important and has no date at
all, and one number cannot hold both. Two fields can.

0 is the interesting end. Every list app makes you either delete a thing you are
not going to do or feel bad about it; a rank of zero is a third answer — kept,
visible, and explicitly not asking anything of you.

**Stored as a number, and 0 is a real answer**, so `prioOf(o)` returns null or a
number and every read has to check for null. `o.prio || 3` would turn "not now"
into "decent", which is the exact bug this shape invites; the tile's own class
had it (`o.prio ? …` drew nothing for 0) and the test now guards it.

It is a field, so a magic drawer can collect on it — "more than 3" is a drawer
of what matters — and it sorts, which is what a ranking is for.

*Still open:* Timothy raised a third thing — a mark for something that causes
real problems if it is not done at a specific time, which is neither importance
nor a plain deadline. It is not built, because it has not been named. My
suggestion is in ROADMAP §0n.

---

### 73. Repeating is a rule, and "after completion" is half of it

`repeat` was one of four words — daily, weekdays, weekly, monthly. Every three
days, the first Monday, three days *after I finish it*: none of them could be
said at all.

It is an object now: `{every, unit, days, from, ends, paused, made}`. The row
that matters is **`from`**, and it is the change Things 3.23 shipped on the day
this was written, after years of people asking:

- `from:'date'` — a **fixed schedule**, counted from the day it was due. The
  bins go out on Tuesday whether or not you did it last Tuesday.
- `from:'done'` — counted from the day you **actually finished it**. You water
  the plant a week after you last watered it.

A single fixed schedule makes the second one a lie that accumulates: skip two
weeks of watering and a fixed rule insists you are two waterings behind, which
is not a fact about the plant.

Bureau already had the better half of this and keeps it. Completing a repeating
thing **spawns a fresh object** at the next date and turns the original into a
record (decision 5), so eleven waterings are eleven dated things rather than one
counter — and *that is why finishing early needs no special case*. The tick is
the tick; a fixed rule counts from the due date and an after-completion rule
counts from today, which is what each of them already means. Things 3 needed a
change to allow early completion at all; here it fell out of the model.

Taken from 3.23 as well:

- **A head start.** "Make the next one now" produces the copy without ticking
  anything, for something you want to fill in ahead of time.
- **A copy says it is one.** `fromRepeat` puts a small repeat glyph on the tile:
  the difference between "I wrote this down" and "this comes round".
- **Pause.** A paused rule keeps its shape and stops producing, which is not the
  same as deleting it and is the thing you actually want in a quiet fortnight.

Deliberately **not** taken: 3.23's prompt asking "make an exception or update the
rule?" when you drag a repeating thing to a new day. Bureau's answer is that
dragging always moves *this one* — it is an object, and moving an object moves
that object — and the rule is changed where rules live, in the editor. A
question every time you drag is a modal in a shape decision 23 already refused.

A string is still read (`repeatOf`), so a backup from before migration 22 works.

---

### 74. One lock, not one per board

Every container carried its own `locked`, and the padlock toggled whichever
board you were standing on. That is the same shape as every other setting in
Bureau — per object, then per type — and it was still wrong, because **a lock is
not a property of a board. It is which mode you are in.** You are either reading
your desks or arranging them. Having to unlock each drawer as you walk into it
is arrange-mode by another name, which is the thing decision 19 refused.

`S.look.locked`, default locked. The padlock in the bar is the switch and it is
the only one; the "Moving things" row is out of the object editor, because it
was never a fact about one drawer.

Everything else about the lock stands: a locked board refuses moves and resizes,
never refuses the long press, and one finger walks the boards on it (decision
47). Holding a tile and moving still unlocks — you have demonstrated what you
want — and now it unlocks everywhere at once, which is what you meant.

Migration 22 deletes the per-object field and takes the desk's own answer as
everybody's.

---

### 75. Pinned to the board, or laid flat on it

A setting, off by default, and the only one in the app that is purely about
mood — which is reason enough to have it. On: a little air around every tile,
and one to three degrees of tilt, as though a pin went through one of its top
corners.

Three things make it read as furniture rather than as a bug:

- **The angle never changes.** It is derived from a hash of the object's own id,
  so a tile tilts the same way on every render, on every device, forever. A
  random number would jitter on every rebuild, which is the one thing that would
  make this unbearable.
- **The angle is small.** Past about four degrees it stops reading as "pinned"
  and starts reading as "broken".
- **The origin is a top corner**, alternating left and right off the same hash,
  because paper hangs from its pin.

The gap is a **margin on the tile**, never `gap` on the grid: the grid is a
coordinate space and `cellW()` measures its own rect, so changing its geometry
would move every tile out from under the drag maths. A margin shrinks the tile
inside a cell that has not moved at all.

Two things were tried and taken out. A drawn **pin head** is clipped by the
tile's own `overflow`, and un-clipping it would take the torn edge off every
`clip-path` shape — forty brass dots is also a lot of brass. And a **shadow** of
its own replaces the whole `box-shadow` property, which half the border slots
use for their inset moulding, and would survive Shadows being switched off — a
switch that means what it says (decision 58). The tilt is the whole idea; the
rest was decoration that cost something.

A tile straightens while you carry it, because you are holding it.

---

### 76. A colour of your own

A slot is a *position*, not a hue (decision 33): store 11 and you get
Victorian's claret or Aero's deep sea blue, and changing style repaints the desk
without converting anything. That is the right default and it is not always what
somebody wants.

The model has always allowed a literal — `objColour()` resolves either — and
there was simply no way to type one in. There is now: a colour picker under the
eleven, writing a hex. It does not follow the style, it does not change when the
style does, and it travels between styles unchanged.

**Its own labelled row rather than a twelfth swatch**, and that is the point
rather than a compromise: it does something different from the eleven above it,
and a swatch that looked like theirs would say it did the same thing. There is a
way back to the style's own, and taking it writes **null** rather than `''` —
`objColour()` tests `o.c != null`, so an empty string is an answer that resolves
to the fallback slot instead of to the type.

---

### 77. The add box is a choice, and it goes by itself when there is no room

`spawn` + `spawnBy:'type'` puts a box at the top of a container, on its front
and inside it. On a checklist five cells tall that box is one line, and one line
is one item you could have seen instead.

So `showsAddBox(c, box)` answers separately from `takesTyping(c)`, and says no
for two reasons: you turned it off, or **the front is two cells tall or less**.
At two cells a front is a name, a count and about two lines, and spending one of
them on a way to add a tenth thing you cannot see is the wrong trade. Automatic,
so nobody has to notice.

Inside the container the box is always there. That board has room, and for a
magic container it is the only way in at all.

---

### 78. Swiping right opens the little calendar

Right on a list row meant one thing: today. That is the commonest answer and it
is not the only one, and a gesture that can say one thing makes you open the
editor to say "tomorrow".

It opens a panel now: the handful of answers worth a button (today, tomorrow,
this weekend, next week, no date), a month you can press a day on, the date
itself, and — for anything carrying the trait — **the deadline**, which is the
other date and belongs beside the first rather than three sections down a
different panel. Things 3's when-popover, in Bureau's one menu shape.

It is a panel rather than a popup because it asks more than one question
(decision 23's rule), and it takes an anchor, so on a Mac it comes up out of the
tile and on a phone it falls back to the edge. Pressing the day a thing is
already on clears it, which is the same toggle every calendar cell in the app
already is.

A Mac has no row swipe, so the context menu has **When…** as well.

---

### 79. A checklist face is a stack of task-sized lines, and it refills itself

The front of a checklist used to be furniture with a list printed on it: a
name, a count, an add box, and however many compact lines fit under them —
fourteen at most, at whatever height the text happened to take.

It is the tasks now. One line per cell of height, so a checklist one cell tall
shows one task and three cells tall shows three, each line the size the task
would be as a tile of its own — and the border is what says the stack is one
thing rather than three tasks in a column. The name comes off the face (it is
the tooltip, and the drawer wears it inside); the add box becomes opt-in
(`addbox:'show'`), because it now costs a whole task-sized line — decision
77's trade with the price marked up; and done lines don't print at all.

That last one is the point. The face shows the next few things to do, not a
record: ticking a line takes it off the front, the lines under it move up a
row, and the next thing waiting inside the drawer slides in over the bottom
edge. A checklist refills itself from its own depth, which is what a drawer
full of tasks is *for* — the fourth or fifth thing on the list was always in
there; now it surfaces the moment there is a line free to show it on.

This refines what the face **shows**, not what the drawer **holds**: done
things still stay inside (`keepsDone()` is untouched), so the record is in
the drawer, where a record belongs — a checklist that *emptied* itself as you
ticked would still not be a checklist.

State first, movement after, as always: the tick renders instantly and
`clRefill()` in motion.js draws the shuffle over the result. A face with
nothing left to show is a label again — name and a quiet line — because a
stack of zero lines is an anonymous coloured square.

---

### 80. A calendar face is a desk calendar until it is big enough to be a wall one

The month grid drew at every size, which below about three cells a side is a
smear of dots — columns two letters wide, day numbers nobody can read, marks
that could mean anything. A face that cannot say anything at its size should
say something smaller instead.

So the face is adaptive, by the box it is drawn in:

- **One cell square** is the tear-off day pad — the month small, today large —
  the way a desk calendar is. Not the anonymous mark every other 1×1 wears:
  a calendar has one thing it can always say, and that is what day it is.
- **One cell tall** is the pad on the left and the next thing or two beside
  it. Two cells across, the date chip goes and the title is the row.
- **Two wide or two tall** is the pad on top and the agenda under it — the
  late things first, then today's, then the next by date, one row each.
- **Three cells a side** earns the month — the grid exactly as it was, with
  `calview`, week start and weekends still deciding what it spans.
- **Twelve wide and six tall** earns words: the planner prints the first two
  titles in each day cell the way a wall calendar does, and sums the rest.
  Twelve desk cells across seven days is about 90px a day, which is what a
  title needs; a phone board is at most ten columns, so the planner is a desk
  face by arithmetic rather than by rule.

The pad always shows **today** — paging months is the month face's job — and
it carries today's `data-calday`, so dropping a thing on a small calendar
still dates it. Below the month the calendar's name rides on the tooltip,
exactly as the checklist's does (decision 79): the pad is the identity, and
a label would cost the one row the face has.
