# Data model

> The conceptual model — objects, attributes, kinds, layouts — is in
> [OBJECT-MODEL.md](OBJECT-MODEL.md). This file is the storage detail.

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
  drawer:    "d_in",         // hand-filed home; beats the drawer rule
  done:      false,
  doneAt:    null,           // "YYYY-MM-DD" when completed
  due:       "2026-08-12",   // "YYYY-MM-DD" or null
  repeat:    "weekly",       // daily | weekdays | weekly | monthly | null
  history:   [],             // habits: completed dates
  milestones:[],             // goals: [{t, done, d}]
  media:     null,           // {type: image|video|audio, label}
  ord:       4,              // manual sort position within a drawer
  created:   "2026-07-11"
}
```

Only `id` and `kind` are truly required; every reader tolerates the rest being
absent, and `adopt()` backfills defaults when loading a backup.

## Drawer

```js
{
  id:     "d_kitch",
  nm:     "Kitchen",
  c:      "#A55A3E",                  // drawer front colour, solid
  pv:     "thumbs",                   // list | stack | thumbs | bars | big
  filter: { kinds: ["recipe"] },      // or {due:'today'} or {done:true} or {}
  desk:   { x:5, y:3, w:2, h:1 },     // place + size in the 6-column Mac grid
  phone:  { x:3, y:6, w:2, h:2 }      // place + size in the 4-column iPhone grid
}
```

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
  line:       "rgba(0,0,0,.28)" | null,   // drawer outline
  railw:      212,                // sidebar width in px
  railHidden: false
}
```

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
{ v: 3, savedAt: "…ISO…", theme, listmode, look, kinds, objects: [...] }
```

**v1 → v2** added `x`/`y` to each drawer layout and the `look` block. `adopt()`
migrates by replaying v1's dense flow through `flowToCoords()`, so a desk saved
before coordinates existed comes back looking exactly as its owner left it.

**v2 → v3** folded `drawers` into `objects` and turned each object's `drawer`
pointer into a `parent`. `foldDrawers()` does it, preserving every id, so links
by id still resolve. A backup written by any earlier version still restores —
`adopt()` recognises the old two-array shape by the presence of `drawers`.

Written 250ms after any change (debounced), plus on `visibilitychange` and
`beforeunload`. Reads and writes are wrapped in try/catch — private browsing and
quota exhaustion both throw, and a failed save must never break the render.

Export writes the same shape to `bureau-YYYY-MM-DD.json`. Import replaces the
desk wholesale after validating it has `objects` and `drawers` arrays.

**Migrations.** Bump `v` and translate inside `adopt()` when the shape changes.
Keep reading old versions — this is one person's real notes and there is no
server-side backup.

**Capacity.** localStorage caps around 5MB. The seeded desk is 13KB; a few
thousand text objects stay well under. Real media will not fit and needs
IndexedDB — see below.

## Media, when it becomes real

`media` is currently a label. The plan:

- Store blobs in IndexedDB in an `assets` store, keyed by an id.
- Object keeps `media: {assetId, type, mime, w, h, dur, label}` — metadata in the
  main JSON, bytes in IndexedDB, so the export stays small and readable.
- Generate a thumbnail on import (canvas for images and video frames, a waveform
  for audio) and store it as a small blob alongside; thumbnails are what drawer
  previews and card grids need.
- Export gains an option to bundle assets as base64, off by default.

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
