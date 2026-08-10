# What to build next

Sequenced by what unblocks the most. Each item has a definition of done, because
"add media" is not a task.

**Before anything on this list:** use it for a week. The next real task should
come from a week of Timothy's actual to-dos, not from this document. Everything
below is a guess; a week of use replaces guesses with facts.

---

## Now

### 1. Update prompt
When a new version is deployed, installed copies pick it up on the next launch
with no indication anything changed.

*Done when:* the service worker detects a waiting update, the app shows a quiet
"new version ready — tap to reload" bar, and tapping it activates and reloads.
~10 lines in the boot section plus a `skipWaiting` message handler.

### 2. Real media
The single biggest gap between this and a usable app. See `DATA-MODEL.md` for
the storage plan.

*Done when:* you can pick a photo, video or audio file on iPhone and Mac; it's
stored in IndexedDB; images and video show a real thumbnail in drawer previews,
card grids and the detail view; audio plays inline; deleting the object frees the
blob; export still works and doesn't balloon.

*Watch for:* iOS memory limits on large video — store the file, generate a small
poster frame, never decode the whole thing for a preview.

### 3. Backup that doesn't need remembering
Right now backup is a button you have to think about.

*Done when:* the app keeps the last N snapshots in IndexedDB automatically, shows
when the last one was taken, and can restore any of them. Belt and braces for the
period before sync exists.

---

## Next

### 4. Sync
Read the options in `DATA-MODEL.md` first and pick deliberately. For two devices
and one user, a versioned whole-document push/pull is probably enough, and
per-object `updatedAt` is the upgrade path if it isn't.

*Done when:* an object created on the phone appears on the Mac without a manual
step, and being offline on both then reconnecting doesn't lose an edit.

*Do not start this* without deciding what happens when both devices edited the
same object while offline. Write the answer down before writing code.

### 5. Month calendar
Today's week strip is fine for a week and useless for planning a month.

*Done when:* a month grid shows scheduled objects as coloured dots by kind, you
can drag an object onto a day to schedule it, and it's reachable from Today.

### 6. Search that searches bodies properly
⌘K does a substring match. Fine at 36 objects, weak at 500.

*Done when:* results are ranked (title over body, recent over old), matched text
is highlighted, and `kind:essay`, `#tag`, `drawer:kitchen` filter the query.

---

## Later

### 7. Drawer nesting, or a deliberate refusal
The seeded Question "Should a drawer be able to contain another drawer?" is real.
Two levels is probably safe; unlimited depth is how Obsidian becomes a swamp.
Decide, write it in `DECISIONS.md`, and either build it or close it.

### 8. Object links
`[[Wikilinks]]` between objects, with a backlinks list in the detail view. The
thing Obsidian genuinely gets right. Worth it only if the writing side of Bureau
gets real use.

### 9. Native app
See `NATIVE-PORT.md`. Only worth doing when there's something a PWA can't do that
you actually want: widgets, Shortcuts, share-sheet capture, notifications.

---

## Deliberately not doing

- **Collaboration or sharing.** It's a personal desk. Sharing means accounts,
  permissions, and a completely different app.
- **AI features.** Nothing here needs a model. A to-do list that summarises your
  to-dos is a to-do list with extra steps.
- **Plugins or a theme system.** One user, two themes, edit the CSS.
- **A web clipper.** Real if the browser habit exists; there's no evidence it does.
