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
