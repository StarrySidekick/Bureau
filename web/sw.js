/* Bureau — service worker.
   Bump CACHE when you change anything in css/ or js/ (or index.html) and the
   next launch picks it up. New js/css files must also be added to SHELL. */
const CACHE = 'bureau-v69';
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
  './js/persist.js',
  './js/wire.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
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

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Navigations: try the network so updates land, fall back to the cached shell
// when offline. Everything else: cache first, it never changes within a version.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

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
