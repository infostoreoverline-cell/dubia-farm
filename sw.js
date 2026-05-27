const CACHE_NAME = 'dubia-app-v3';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './src/styles/variables.css',
  './src/styles/base.css',
  './src/styles/layout.css',
  './src/styles/animations.css',
  './src/styles/components.css',
  './src/styles/responsive.css',
  './src/engine/dubia_module.js',
  './src/engine/app_state.js',
  './src/engine/calculations.js',
  './src/components/ui/notifications.js',
  './src/components/ui/number_scramble.js',
  './src/components/charts/biomass_chart.js',
  './src/components/charts/health_chart.js',
  './src/components/charts/demographic_bars.js',
  './src/main.js',
  'https://cdn.jsdelivr.net/npm/apexcharts',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Clear old caches on activation
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
