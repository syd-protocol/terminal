const CACHE_NAME = 'syd-v55';

// These are the app shell files we want to pre-cache during install.
// On every new deploy, bump CACHE_NAME so the install event fires again,
// the old cache is deleted, and fresh files are fetched immediately.
const PRECACHE_ASSETS = [
    '/terminal/',
    '/terminal/index.html',
    '/terminal/css/style.css',
    '/terminal/css/games-enhanced.css',
    '/terminal/js/gemini.js',
    '/terminal/js/app.js',
    '/terminal/js/quests.js',
    '/terminal/js/scan.js',
    '/terminal/js/path.js',
    '/terminal/js/encounter.js',
    '/terminal/js/minigames.js',
    '/terminal/js/dailyloop.js',
    '/terminal/js/status.js',
    '/terminal/data/quests.json',
    '/terminal/data/encounters.json',
    '/terminal/manifest.json'
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
            .then(() => {
                // Notify all open clients that new code is available.
                // app.js listens for SW_UPDATED and reloads the page so
                // operatives never run stale JS after a deploy.
                return self.clients.matchAll({ type: 'window' })
                    .then(clients => {
                        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
                    });
            })
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

// ─── NOTIFICATION HANDLING ───────────────────────────────────
// Three notification types:
//
//   CHECK_NOTIFICATION — re-engagement after 3+ inactive days
//   SCHEDULE_MORNING   — schedule a morning briefing notification
//   CANCEL_MORNING     — cancel any pending morning notification
//
// All notification bodies use SYD's voice — clipped, specific, no fluff.

self.addEventListener('message', e => {
    if (!e.data) return;

    // ── Re-engagement: 3+ days inactive ──────────────────────
    if (e.data.type === 'CHECK_NOTIFICATION') {
        const { lastActiveDate, playerName } = e.data;
        if (!lastActiveDate) return;

        const diffDays = Math.floor(
            (new Date() - new Date(lastActiveDate)) / 86400000
        );

        if (diffDays >= 3) {
            self.registration.showNotification('SYD', {
                body:     `${playerName || 'Operative'}, your momentum is decaying. The System is standing by.`,
                icon:     '/terminal/icons/icon-192.png',
                tag:      'syd-reengagement',
                renotify: false,
                data:     { url: '/' }
            });
        }
        return;
    }

    // ── Morning briefing: schedule for 8:00 AM today or tomorrow ─
    if (e.data.type === 'SCHEDULE_MORNING') {
        const { playerName, momentum } = e.data;

        const now   = new Date();
        const target = new Date(now);
        target.setHours(8, 0, 0, 0);

        // If 8am already passed today, schedule for tomorrow
        if (target <= now) target.setDate(target.getDate() + 1);

        const msUntil = target - now;

        // Use setTimeout in SW — note: SW may be terminated and restarted,
        // so this is best-effort. Push API would be more reliable for production.
        setTimeout(() => {
            const mStr = momentum >= 1.3 ? 'high' : momentum >= 1.1 ? 'building' : 'low';
            self.registration.showNotification('SYD', {
                body:     `${playerName || 'Operative'} — morning transmission. Momentum ${mStr}. Directives queued.`,
                icon:     '/terminal/icons/icon-192.png',
                tag:      'syd-morning',
                renotify: true,
                data:     { url: '/' }
            });
        }, msUntil);
        return;
    }
});

// ─── NOTIFICATION CLICK ──────────────────────────────────────
// When the operative taps the notification, focus an existing SYD tab
// or open a new one if none is available.
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url.includes('/') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) return clients.openWindow('/terminal/');
            })
    );
});