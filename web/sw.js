/* Bureau — service worker.
   Bump CACHE when you change anything in css/ or js/ (or index.html) and the
   next launch picks it up. New js/css files must also be added to SHELL. */
const CACHE = 'bureau-v210';
const SHELL = [
  './',
  './index.html',
  './css/board.css',
  './css/chrome.css',
  './css/motion.css',
  './js/boot.js',
  './js/util.js',
  './js/model.js',
  './js/grid.js',
  './js/look.js',
  './js/mutations.js',
  './js/tiles.js',
  './js/views.js',
  './js/sheet.js',
  './js/panels.js',
  './js/gestures.js',
  './js/motion.js',
  './js/gravity.js',
  './js/decor.js',
  './js/active.js',
  './js/plans.js',
  './js/stockplans.js',
  './js/guide.js',
  './js/persist.js',
  './js/wire.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  // the bundled public-domain pictures and cut-outs (decision 204, docs/IMAGES.md)
  './img/decor/bookend.png',
  './img/decor/bust.png',
  './img/decor/candle.png',
  './img/decor/carriage.png',
  './img/decor/clock.png',
  './img/decor/cog.png',
  './img/decor/dome.png',
  './img/decor/figurine.png',
  './img/decor/jardiniere.png',
  './img/decor/lamp.png',
  './img/decor/plant.png',
  './img/decor/vase.png',
  './img/decor/volute.png',
  './img/decor/globe.png',
  './img/decor/inkstand.png',
  './img/decor/teapot.png',
  './img/decor/pitcher.png',
  './img/decor/candelabrum.png',
  './img/decor/casket.png',
  './img/decor/horse.png',
  './img/decor/teacup.png',
  './img/tools/bell.png',
  './img/tools/candle.png',
  './img/tools/clock.png',
  './img/tools/d6-1.png',
  './img/tools/d6-2.png',
  './img/tools/d6-3.png',
  './img/tools/d6-4.png',
  './img/tools/d6-5.png',
  './img/tools/d6-6.png',
  './img/tools/glass.png',
  './img/tools/metro.png',
  './img/pictures/p01.jpg',
  './img/pictures/p02.jpg',
  './img/pictures/p03.jpg',
  './img/pictures/p04.jpg',
  './img/pictures/p05.jpg',
  './img/pictures/p06.jpg',
  './img/pictures/p07.jpg',
  './img/pictures/p08.jpg',
  './img/pictures/p09.jpg',
  './img/pictures/p10.jpg',
  './img/pictures/p11.jpg',
  './img/pictures/p12.jpg',
  // the paintings a Painting hangs (decision 208)
  './img/paintings/a01.jpg',
  './img/paintings/a02.jpg',
  './img/paintings/a03.jpg',
  './img/paintings/a04.jpg',
  './img/paintings/a05.jpg',
  './img/paintings/a06.jpg',
  './img/paintings/a07.jpg',
  './img/paintings/a08.jpg',
  './img/paintings/a09.jpg',
  './img/paintings/a10.jpg',
  './img/paintings/a11.jpg',
  './img/paintings/a12.jpg',
  './img/paintings/a13.jpg',
  './img/paintings/a14.jpg',
  './img/paintings/a15.jpg',
  './img/paintings/a16.jpg',
  './img/paintings/a17.jpg',
  './img/paintings/a18.jpg',
  './img/paintings/a19.jpg',
  './img/paintings/a20.jpg',
  './img/paintings/a21.jpg',
  './img/paintings/a22.jpg',
  './img/paintings/a23.jpg',
  './img/paintings/a24.jpg',
  './img/paintings/a25.jpg',
  './img/paintings/a26.jpg'
];

/* `cache:'reload'` makes each shell fetch go to the network instead of the
   browser's own HTTP cache. Without it a version bump could fill the new cache
   from the old one — this really happened: a bump landed the new stylesheet and
   the previous grid.js side by side, so the app was half-updated and the symptom
   pointed at the code rather than at here. */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, {cache:'reload'}))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

// Only ever delete Bureau's own old caches. A cache store belongs to the whole
// origin, not to a scope, so `k !== CACHE` reads as "everything anybody else
// put here" — and with Activinator served from this origin that is exactly
// what it did: one visit there wiped Bureau's shell, and the next launch
// rebuilt it from whatever that page happened to request. Activinator lives at
// /activinator/ now — its own repository, same origin — so this stays.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('bureau-') && k !== CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Navigations: try the network so updates land, fall back to the cached shell
// when offline. Everything else: cache first, it never changes within a version.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // activinator/ inside this scope is the hand-off stub for the app that used
  // to be served there, and this worker must keep its hands off it — the stub's
  // own worker has to be fetched fresh to take the old install down, and the
  // navigation branch below stores whatever it fetched as Bureau's own shell,
  // so without this Bureau would open into that page the next time it was
  // launched offline.
  if (new URL(req.url).pathname.includes('/activinator/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
