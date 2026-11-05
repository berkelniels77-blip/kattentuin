const scope = self.registration.scope;
const prefix = 'kattentuin:' + scope + ':';
const cacheName = prefix + 'v13';
const absolute = path => new URL(path, scope).href;
const entry = absolute('./index.html');
const assets = new Set([
  './index.html', './style.css', './expansion.css', './capy.js', './capy-model.js', './effects.js', './app.js', './game.js', './levels.json', './manifest.webmanifest',
  './assets/cat.svg', './assets/cross.svg', './assets/coin.svg', './assets/skin-miso.svg', './assets/skin-pixel.svg', './assets/skin-mochi.svg', './assets/skin-luna.svg', './assets/skin-nova.svg', './assets/skin-parel.svg', './assets/skin-mint.svg', './assets/skin-kaneel.svg', './assets/mascot.webp', './assets/fish.png', './assets/trophy-fill.svg', './assets/star-fill.svg', './assets/gear-fill.svg', './assets/arrow-left.svg', './assets/palette-fill.svg', './assets/grid-3x3-gap-fill.svg', './assets/arrows-angle-expand.svg', './assets/x-lg.svg', './assets/icon-180.png',
  './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable.png'
].map(absolute));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([...assets].map(url => new Request(url, {cache: 'reload'})))
  ));
});
self.addEventListener('message', event => {
  if (event.data === 'activate') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const path = url.origin + url.pathname;
  const home = event.request.mode === 'navigate' && (path === scope || path === entry);
  const key = home ? entry : path;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(key) ?? fetch(event.request);
  })());
});




