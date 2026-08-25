# Activinator — working notes for Claude Code

A deck of things to actually go and do. It deals one activity at a time, full
screen; you swipe right on the ones you would probably do and left on the ones
you wouldn't, and it works out what you are like — while deliberately keeping
some of the deck outside what it thinks you are like.

The point is a scroll where every card is a launchpad off the phone. Same
thumb, opposite direction. It is a personal app for one person; design
decisions get made for one user.

**Start here:** `README.md` is the reference — how it works, what every module
is for, and the reasoning behind the parts that look odd. Read it before
changing behaviour. This file is the short version plus the things that will
bite you.

## Running it

```bash
npm install                        # playwright, for the tests
scripts/serve.sh                   # http://localhost:8010
node scripts/build-activities.mjs  # packs/*.csv → js/activities.js
npm test                           # smoke + upgrade + pack check
node test/marks.mjs                # contact sheet of every tag mark
```

Open it over http, never as a `file://` URL — the service worker won't register
and the manifest won't load, so you'd be testing a different app than the one
that ships.

**Look at the screenshots.** `test/smoke.mjs` writes to `test/shots/`, and this
is a visual app: a passing assertion does not mean it looks right. Half the
real bugs in this project were found by reading a screenshot, not a summary.

## The two things most likely to bite

**Bump `CACHE` in `sw.js` and `APP_VERSION` in `js/state.js` after any change to
`js/`, `css/` or `index.html`.** Without it an installed copy keeps serving the
old version, and the symptom — "my change didn't deploy" — points at the wrong
culprit. A new file must also be added to `SHELL` in `sw.js` or it won't be
there offline. An already-open page finishes on the old assets, so a bump takes
effect on the **second** launch.

**Test the upgrade path, not just a fresh install.** `test/smoke.mjs` starts
every run with an empty browser profile, so it only ever exercises a first
install. `test/upgrade.mjs` boots from the shapes a phone that has had the app
for a while actually has saved. That half was untested once and shipped a blank
screen: a `ctx` saved under an older vocabulary said `where:'any'`, the new
filter had no entry for that word, and the throw during the first render left
nothing but the buttons. Add a case to `test/upgrade.mjs` whenever the saved
shape changes, and bump `DATA_V` with a migration.

## What not to undo

- **The service worker reaps only `activinator-` caches.** A cache store belongs
  to the origin, not to a scope, and another app of Timothy's is on the same
  hostname. `filter(k => k !== CACHE)` means "delete everything anybody else put
  here", and it did.
- **Activity ids come from the title, never from position.** `'s' + index` meant
  inserting one activity silently re-pointed every verdict after it at a
  different thing.
- **Nothing leaves the pool but "never again".** A dislike sinks; it does not
  delete. Recency is what stops a hand repeating.
- **A skip teaches nothing.** Swiping up is not a soft no.
- **No dependencies, no build step for the app, no backend.** The pack build is
  the one script, and it runs before commit, not at page load. The app has to
  open on a train.
- **The front of a card is the marks and the activity, nothing else.**
- **The marks are drawn, not emoji.** `node test/marks.mjs` and *look* before
  and after touching one.

## Adding activities

Activities are CSVs in `packs/`, one file per pack. Edit a CSV, run
`node scripts/build-activities.mjs`, commit both the CSV and the generated
`js/activities.js`. Never hand-edit `js/activities.js`.

The build validates and refuses bad rows with the file and line — that is the
point of it. See the README for the column rules and for the three ways an
activity gets in (say so in a session; edit the CSV on github.com, which the
deploy rebuilds from; or write one in the app and copy it out of Menu → Packs).

**The repo is the memory.** A session tomorrow knows what is in the deck
because it reads `packs/`, and for no other reason.

## Style

Match what's there. Compact but readable; two-space indent; single quotes;
template literals for HTML. Comments explain *why*, not *what*. Copy in the UI
is plain, specific and unexcited — "On the list", not "Added successfully!".
