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
