# Data model

> The conceptual model — objects, attributes, kinds, layouts — is in
> [SYSTEM.md](SYSTEM.md). This file is the storage detail.

**One** array, `S.objects`, holding every object including drawers, serialised to
one localStorage key. There is no
normalisation, no indexes, no ORM. At personal scale — call it 5,000 objects —
a linear filter over an in-memory array is microseconds, and the simplicity buys
more than an index would.

## Object

```js
{
  id:        "o1a2b",        // uid('o'), unique within the desk
  kind:      "task",         // key into KINDS
  title:     "Water the fig",
  body:      "",             // markdown
  tags:      ["home"],
  parent:    "d_in",         // the one drawer it lives in ("root" = the desk)
  done:      false,
  doneAt:    null,           // "YYYY-MM-DD" when completed
  due:       "2026-08-12",   // "YYYY-MM-DD" or null
  repeat:    "weekly",       // daily | weekdays | weekly | monthly | null
  history:   [],             // habits: completed dates
  milestones:[],             // goals: [{t, done, d}]
  media:     null,           // {assetId, type, w, h, label} — see Images
  attrs:     null,           // per-object attribute override; null = use the kind's
  desk:      {x:1,y:1,w:4,h:4},   // where it sits in its parent's grid, per device
  phone:     null,
  ord:       4,              // position in list and scroll views
  created:   "2026-07-11"
}
```

Only `id` and `kind` are truly required; every reader tolerates the rest being
absent, and `adopt()` backfills defaults when loading a backup.

## Drawer

```js
{
  id:     "d_kitch",
  kind:   "drawer",                   // or "magic"
  title:  "Kitchen",
  parent: "root",                     // drawers nest too
  c:      "#A55A3E",                  // drawer front colour, solid
  layout: "grid",                     // grid | list | scroll
  filter: { kinds:["recipe"] },       // magic drawers only; ignored otherwise
  sort:   "manual",                   // manual | made | madeup | edited | az | za
                                      // absent = follow the type's; see sortOf()
  desk:   { x:13, y:7, w:6, h:6 },    // place + size in the 24-column Mac grid
  phone:  { x:9,  y:13, w:8, h:6 }    // place + size in the 8-column iPhone grid
}
```

`sort` is a real value both ways round. `"manual"` means *this container refuses
to sort*, which is different from saying nothing — a container that says nothing
follows its type, and a type may say `az`. A type carries the same key.

`x` and `y` are **1-based grid cells**, and they are the whole layout — array
order no longer positions anything. The grid does not flow: an empty cell stays
empty, because on a desk a gap is a choice. Two drawers may never overlap;
`boxOk()` refuses a move or resize that would collide rather than pushing a
neighbour aside, so nothing you arranged ever moves without you.

`desk` and `phone` are independent and must stay that way — that's the
"separately customisable layouts" requirement.

## Appearance

```js
look: {
  bg:         "#DED3B6" | null,   // custom background; null = use the theme's
  accent:     "#A9793F" | null,
  line:       "rgba(0,0,0,.28)" | null    // drawer outline
}
```

## What is open, and on what

None of this is stored — it is `S`, in memory, and every field names an object
by id:

| Field | Means |
| --- | --- |
| `view` / `drawerId` | Which of the two views you are on |
| `openId` | The object the **settings panel** is about |
| `writeId` | The object on the **writing** surface |
| `readId` | The object on the **reading** surface |
| `editId` | The tile being typed in **on the board** |
| `sel` | The Finder-style selection |

Which **page** of a board you are on is in memory too, and deliberately not
stored — `y` is one continuous coordinate space per container, and a page is a
window of *n* rows onto it, where *n* is measured from this device's screen.
Nothing about a box changes when it moves between pages.

`S.pins` is the **bottom** shelf and `S.pinsTop` the top one; both are ordered
lists of container ids, resolved on read. `pins` kept its old name so no desk
needs migrating.

`openId` used to mean "the object in the detail sheet". The sheet is gone
(decision 36) and the name stayed, because every handler that read it wanted
"the object being changed" and that is what the panel is.

`applyLook()` writes these as inline custom properties on `<html>`, which beat
both theme blocks — that's why a custom background survives switching between
Paper and Walnut. `null` means "inherit the theme", not "no colour".

## Dates

Every date in state is a `YYYY-MM-DD` **string in local time**. No `Date` objects
are stored and nothing is UTC. This is deliberate: a to-do due "Tuesday" is due
Tuesday wherever you are, and storing an instant would move it across a timezone
boundary. Section 0's `D` object is the only place that converts.

## Storage

One key, `bureau.v1` (the key name is stable; `v` inside it is the schema):

```js
{ v: 5, savedAt: "…ISO…", theme, listmode, look, kinds, objects: [...] }
```

**v1 → v2** added `x`/`y` to each drawer layout and the `look` block. `adopt()`
migrates by replaying v1's dense flow through `flowToCoords()`, so a desk saved
before coordinates existed comes back looking exactly as its owner left it.

**v2 → v3** folded `drawers` into `objects` and turned each object's `drawer`
pointer into a `parent`. `foldDrawers()` does it, preserving every id, so links
by id still resolve. A backup written by any earlier version still restores —
`adopt()` recognises the old two-array shape by the presence of `drawers`.

**v3 → v4** halved the cell: 6 columns of 104px rows became 12 square columns.
`doubleBoxes()` doubles every `{x,y,w,h}`, which keeps a desk arranged the way
its owner left it — a tile twice as wide as tall stays twice as wide as tall.
`ensureControls()` also runs, adding the New/Arrange/Settings control objects to
any desk saved before the toolbar became part of the grid.

**v4 → v5** halved the cell again (12 → 24 columns) so a quarter-size object is
possible; `doubleBoxes()` runs a second time. Ordinary drawers lost their rules
in the same pass — a rule now belongs only to a magic drawer — and the New and
Arrange control objects were retired, since both became gestures.

## Images

Bytes never go in the JSON. localStorage caps around 5MB and holds the entire
desk, so an object keeps only metadata:

```js
media: { assetId:"a1b2", type:"image", w:1400, h:933, label:"holiday.png" }
```

The image itself is a downscaled data URL (long edge 1400px, JPEG q0.82) in
**IndexedDB**, database `bureau-assets`, store `assets`, keyed by `assetId`.
After a load, `hydrateAssets()` puts each one back on `media.src` in memory;
`snapshot()` strips `src` on the way out. A desk with two images is still 16KB.

A deleted object's asset is freed by `dropTrash()` — when the bin is emptied,
not when the delete happens, because undo has to be able to bring it back.

**Not yet:** video and audio are still labels. The same mechanism will carry
them; they need a poster frame and a waveform respectively, which images did
not.

Written 250ms after any change (debounced), plus on `visibilitychange` and
`beforeunload`. Reads and writes are wrapped in try/catch — private browsing and
quota exhaustion both throw, and a failed save must never break the render.

Export writes the same shape to `bureau-YYYY-MM-DD.json`. Import replaces the
desk wholesale after validating it has an `objects` array. Image bytes are not
included — a restored backup keeps the metadata but the pictures only come back
on the device that holds the IndexedDB.

**Migrations.** Bump `v` and translate inside `adopt()` when the shape changes.
Keep reading old versions — this is one person's real notes and there is no
server-side backup.

**Capacity.** localStorage caps around 5MB. The seeded desk is 16KB; a few
thousand text objects stay well under. Image bytes are in IndexedDB, so they do
not count against it — see Images above.

## The paste bridge

Objects can arrive as JSON — written anywhere that can write JSON, pasted into
Settings. There is no API and no backend; the point is that describing what you
want somewhere else and pasting the result costs nothing and keeps the app
local-first.

```json
[{"type":"drawer","title":"Lisbon","face":"checklist","children":[
   {"type":"task","title":"Book the flight","due":"2026-09-02"}]}]
```

Everything routes through `create()`, so nothing can arrive that the app could
not have made itself. Type names are matched loosely, missing fields take the
type's defaults, a bare string is a task, and giving children to something that
cannot hold them turns it into a drawer. Invalid JSON adds nothing at all.

## If sync happens

The realistic options, roughly in order of effort:

1. **File sync.** Write the JSON into iCloud Drive and let Apple move it. Nearly
   free; last-write-wins conflicts; only works once the app is native or can
   reach the filesystem.
2. **A key-value cloud store** (CloudKit, Supabase, or similar). Push and pull the
   whole document with a version number, resolve by timestamp. Fine for one user
   on two devices, which is the actual requirement.
3. **Per-object sync with a change log.** Give each object an `updatedAt` and sync
   objects individually, last-write-wins per object. More work, but it stops a
   stale device from clobbering a day of edits — the failure mode option 2 has.

Option 3 is what to build if Bureau is ever going to hold something you'd be
upset to lose. Whichever route: the current model already suits it, because
objects are flat, independently addressable, and carry their own identity.

## Mapping to SwiftData, for the native port

```swift
@Model final class BureauObject {
    @Attribute(.unique) var id: String
    var kind: String              // keep as a string, not an enum —
                                  // adding a kind shouldn't need a migration
    var title: String
    var body: String
    var tags: [String]
    var drawerID: String?
    var done: Bool
    var doneAt: Date?
    var due: Date?                // store as a date, format day-only on display
    var repeatRule: String?
    var history: [Date]
    var milestones: [Milestone]   // small @Model or a Codable struct
    var ord: Double               // Double so you can insert between two items
    var created: Date
}
```

Note `ord` as a `Double`: dragging between neighbours becomes an average rather
than a re-index of the whole list. Worth adopting in the web version too.

`kind` stays a string on purpose. The registry pattern is the thing that makes
adding a kind cheap, and an enum in a persisted model turns that into a schema
migration.
