# If Bureau goes native

Not urgent. Do it when there's something the PWA can't do that you actually want.

## What a PWA genuinely can't do on iOS

- Home-screen and Lock Screen **widgets** — probably the strongest argument. A
  drawer as a widget is very much the point of the app.
- **Shortcuts** and Siri intents ("add a task to Bureau").
- **Share sheet** capture — sending a link, photo or selection into Bureau from
  another app.
- **Local notifications** — no reliable scheduled reminders in an iOS PWA.
- **Filesystem and iCloud Drive** access, which is also the cheapest sync route.
- Storage Apple can't quietly evict.

If none of those are things you reach for, the PWA is the better app: it updates
instantly, needs no developer account, and has no review queue.

## The two routes

### A. WKWebView shell — days, not weeks

Wrap `web/` in a SwiftUI app with a `WKWebView`, load it from the bundle, and add
native pieces at the edges: a `WidgetKit` extension reading a shared App Group
file, a share extension that appends to a JSON inbox, `AppIntents` for Shortcuts,
and iCloud Drive for sync.

Ships fast, keeps one codebase, and the web app stays the source of truth.
Scrolling and text selection will feel *almost* right rather than right, and that
gap is more noticeable on a writing app than most.

Worth it if widgets and capture are the goal and the UI is settled.

### B. Real SwiftUI rewrite — weeks

`SwiftData` + `CloudKit` gives sync, offline, and conflict handling largely for
free across iPhone and Mac, which is the single hardest remaining problem solved
by adopting a framework. Native gestures, real drag and drop, proper text input.

`DATA-MODEL.md` has the SwiftData mapping. Two notes carried forward: keep `kind`
as a string rather than an enum, so adding a kind stays a one-line change rather
than a schema migration; and make `ord` a `Double`, so reordering is an average
of two neighbours rather than a re-index.

## The two parts that will fight you in SwiftUI

**The drawer grid.** Resizable tiles on a fixed column grid with two stored
layouts is not something `LazyVGrid` does. Expect a custom `Layout` that reads
each drawer's `(w, h)` and places tiles into a column raster, plus a drag
interaction that reorders the underlying array. Prototype this before committing
to the rewrite — it's the visual identity of the app and if it doesn't feel good,
nothing else matters.

**Row gestures.** `.swipeActions` gets you swipe-to-delete cheaply but not the
same feel, and combining swipe with drag-to-reorder means a `DragGesture` that
decides its axis after a few points of movement. The web version's section 19 has
the logic already worked out; it translates directly.

## Order of work, if it happens

1. Rebuild the drawer grid alone, in a throwaway project, with fake data. Decide
   from that whether route B is worth it.
2. Port the model and get SwiftData + CloudKit syncing two devices.
3. Import a JSON backup from the web version — one screen, and it means no data
   is stranded.
4. Then the views, in this order: drawer → detail → today → keeping up.
5. Widgets last. They're the reason for the port, but they need everything else
   working first.
