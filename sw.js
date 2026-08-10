/* BOW & BATTALION — service worker.
   Precaches the whole (tiny, asset-free) game so it installs to the home
   screen and plays fully offline. Bump CACHE whenever the ?v= asset
   version changes so clients pick up the new shell. */
'use strict';

const CACHE = 'bowbat-v16';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=16',
  './js/util.js?v=16',
  './js/data.js?v=16',
  './js/art.js?v=16',
  './js/game.js?v=16',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon.svg',
  './apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navigations: network-first so a fresh deploy wins, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (versioned assets/icons): cache-first, then network + warm the cache.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
