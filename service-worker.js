const CACHE_NAME = 'levelup-v1';
const ASSETS = [
    '/levelup/',
    '/levelup/index.html',
    '/levelup/css/style.css',
    '/levelup/js/app.js',
    '/levelup/js/quests.js',
    '/levelup/data/quests.json',
    '/levelup/manifest.json'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});