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

---

### 19. There is no arrange mode

Everything on a grid is always movable and resizable. A 300ms hold arms the
drag; a drawer can be locked when you want it to stay put.

*Why:* a mode you have to enter is a mode you forget you're in, and the Done
button that ends it is chrome on a screen that is meant to be nothing but grid.
If the answer to "can I move this?" is always yes, there is nothing to remember.

*Against:* a click and a drag now differ only by 300ms, which is a real tax on
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
