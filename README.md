# Bureau

A desk for everything you keep. Tasks, notes, ideas, outlines, recipes, scripts,
questions, essays, habits, goals, media — every one a typed object, filed in a
drawer. Personal app, one user, local-first.

Runs as an installable PWA on iPhone and Mac. No dependencies, no build step, no
backend.

```
CLAUDE.md            start here — orientation, conventions, invariants
docs/SYSTEM.md       the system — objects, attributes, types, drawers, the grid
docs/DECISIONS.md    what was chosen deliberately, and the case against each
docs/DATA-MODEL.md   the schema, storage, and where media and sync would go
docs/ROADMAP.md      what to build next, with definitions of done
docs/NATIVE-PORT.md  the Swift route, if and when it's worth it
web/                 the app — index.html is the entire thing
test/smoke.mjs       headless browser check
scripts/serve.sh     local server
activinator/         a second, separate app — see activinator/README.md
```

`activinator/` is not part of Bureau. It is a card deck of things to go and do,
started here for convenience and self-contained so it can be moved to its own
repository. It shares no code with Bureau — but it is deployed beside it, at
`/activinator/`, which puts it inside Bureau's service worker scope and its
origin's cache store. `test/deploy.mjs` guards that seam; read
`activinator/README.md` before touching either service worker.

## Run it

```bash
scripts/serve.sh          # http://localhost:8000
```

Serve it over http. Opening `web/index.html` directly as a file won't register
the service worker or load the manifest, so you'd be testing a different app than
the one that ships.

## Test it

```bash
npm i playwright          # once
scripts/serve.sh &        # in another shell
node test/smoke.mjs
```

Everything in the printed summary should be truthy and `errors` should be empty.
Screenshots go to `test/shots/` — open them. Assertions passing doesn't mean it
looks right, and this is an app where looking right is most of the point.

## Install it

Live at **https://starrysidekick.github.io/bureau/**. Every push to `main`
redeploys it. Then:

- **iPhone** — open the URL in Safari, Share → Add to Home Screen. Launch from
  the icon, not the tab. On iOS the installed app has its own storage, separate
  from the Safari tab you installed it from, so put real data only in the
  installed copy.
- **Mac** — Chrome and Edge show an install button in the address bar; Safari 17+
  has File → Add to Dock.

Settings inside Bureau tells you which one you're in.

After changing `web/index.html`, bump `CACHE` in `web/sw.js`, or installed copies
will keep serving the cached version.

## Where the data lives

Local storage on each device, under `bureau.v1`. Nothing leaves the device and
there's no account. Settings → Export a backup writes a JSON file; Restore reads
one back. That's how a desk moves between devices until sync exists — see
`docs/DATA-MODEL.md`.
