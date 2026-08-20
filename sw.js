const CACHE_NAME = 'tfr-wiki-shell-v27';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/editor.css',
  './css/tfr-theme.css',
  './js/app.bundle.js',
  './js/app.js',
  './js/model.js',
  './js/render.js',
  './js/sanitize.js',
  './js/pwa.js',
  './assets/tfr-logo.gif',
  './assets/Cursor1.png',
  './assets/Pointer1.png',
  './assets/click_close.wav',
  './assets/click_window_open.wav',
  './assets/click_province_01.wav',
  './assets/Crossing_The_Styx.mp3',
  './assets/large_flag_frame.png',
  './assets/app-icon-180.png',
  './assets/app-icon-192.png',
  './assets/app-icon-512.png',
  './assets/icon-library/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // One missing optional file should not prevent the whole PWA from installing.
    await Promise.all(CORE.map(url => cache.add(url).catch(() => null)));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('tfr-wiki-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (_) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('./index.html');
    throw _;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Let the browser handle byte-range audio requests normally. The editor itself
  // remains available offline even if iOS chooses a range request for the music.
  if (request.headers.has('range')) return;

  const appShell = request.mode === 'navigate' || /\.(?:html?|js|css|webmanifest|json)$/i.test(url.pathname);
  event.respondWith(appShell ? networkFirst(request) : cacheFirst(request));
});
