/* Activinator has moved to its own repository, served at /activinator/. This
   worker replaces the one an installed copy is still running at the old
   address: the browser's update check fetches sw.js regardless of what the old
   worker serves from cache, finds this one, and this one takes the old app
   down — caches cleared, registration gone, every open page sent back to the
   network, where index.html is now a redirect to the new address. No fetch
   handler on purpose. Saved state is untouched: localStorage belongs to the
   origin, which is the same, so the new address picks it up as its own. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('activinator-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.navigate(c.url));
  })());
});
