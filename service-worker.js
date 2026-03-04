const CACHE_NAME = 'levelup-v16';

// These are the app shell files we want to pre-cache during install.
// On every new deploy, bump CACHE_NAME so the install event fires again,
// the old cache is deleted, and fresh files are fetched immediately.
const PRECACHE_ASSETS = [
    '/levelup/',
    '/levelup/index.html',
    '/levelup/css/style.css',
    '/levelup/js/app.js',
    '/levelup/js/quests.js',
    '/levelup/data/quests.json',
    '/levelup/manifest.json'
];

// ─── INSTALL ──────────────────────────────────────────────────
// Pre-cache all assets, then skip the waiting phase immediately
// so the new service worker activates without waiting for tabs to close.
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ─── ACTIVATE ────────────────────────────────────────────────
// Delete any old caches from previous versions, then claim all open
// clients immediately so the new worker takes control right away.
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys =>
                Promise.all(
                    keys
                        .filter(k => k !== CACHE_NAME)
                        .map(k => caches.delete(k))
                )
            )
            .then(() => self.clients.claim())
    );
});

// ─── FETCH ───────────────────────────────────────────────────
// Strategy is split by file type:
//
//   • HTML, CSS, JS → Network-first.
//     Always try the network so new deploys are picked up immediately.
//     Fall back to cache only if the network is unavailable (offline mode).
//
//   • Everything else (images, JSON data) → Cache-first.
//     Serve from cache for speed; fall back to network if not cached.
//     These files are updated when the cache version is bumped on deploy.

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Only handle same-origin requests (ignore analytics, CDN, etc.)
    if (url.origin !== self.location.origin) return;

    const isAppShell = /\.(html|css|js)$/.test(url.pathname) || url.pathname.endsWith('/');

    if (isAppShell) {
        // Network-first strategy for HTML, CSS, and JS
        e.respondWith(
            fetch(e.request)
                .then(networkResponse => {
                    // Update the cache with the fresh response
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(e.request, responseClone);
                    });
                    return networkResponse;
                })
                .catch(() => {
                    // Network failed — serve stale cache as offline fallback
                    return caches.match(e.request);
                })
        );
    } else {
        // Cache-first strategy for images, JSON, and other static assets
        e.respondWith(
            caches.match(e.request)
                .then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    // Not in cache — fetch from network and store for next time
                    return fetch(e.request).then(networkResponse => {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(e.request, responseClone);
                        });
                        return networkResponse;
                    });
                })
        );
    }
});

// ─── NOTIFICATION CHECK ──────────────────────────────────────
// Fires when the app sends a CHECK_NOTIFICATION message.
// If the player has been inactive for 3 or more days, a push notification
// is shown to encourage them to return.
self.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'CHECK_NOTIFICATION') return;
    const { lastActiveDate, playerName } = e.data;
    if (!lastActiveDate) return;

    const diffDays = Math.floor(
        (new Date() - new Date(lastActiveDate)) / 86400000
    );

    if (diffDays >= 3) {
        self.registration.showNotification('LevelUp', {
            body:     `${playerName || 'Hunter'}, your momentum is fading. Return and keep levelling up.`,
            icon:     '/levelup/icons/icon-192.png',
            tag:      'levelup-reminder',
            renotify: false,
            data:     { url: '/levelup/' }
        });
    }
});

// ─── NOTIFICATION CLICK ──────────────────────────────────────
// When the user taps the notification, focus an existing LevelUp tab
// or open a new one if none is available.
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url.includes('/levelup/') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) return clients.openWindow('/levelup/');
            })
    );
});