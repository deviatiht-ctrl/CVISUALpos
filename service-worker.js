/**
 * CVISUAL POS — service-worker.js
 * PWA Service Worker avec stratégie Cache-First pour les assets statiques
 * et Network-First avec repli pour les requêtes réseau.
 */

const CACHE_NAME = 'cvisual-pos-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.html',
    '/admin.html',
    '/catalogue.html',
    '/manifest.json',
    '/assets/img/logo-placeholder.svg',
    '/assets/css/variables.css',
    '/assets/css/main.css',
    '/assets/css/navbar.css',
    '/assets/css/mobile-nav.css',
    '/assets/css/pos.css',
    '/assets/css/dashboard.css',
    '/assets/css/admin.css',
    '/assets/css/catalogue.css',
    '/assets/css/receipt.css',
    '/assets/js/supabase.js',
    '/assets/js/auth.js',
    '/assets/js/offline-db.js',
    '/assets/js/sync.js',
    '/assets/js/router.js',
    '/assets/js/navbar.js',
    '/assets/js/toast.js',
    '/assets/js/i18n.js',
    '/assets/js/modules/sales.js',
    '/assets/js/modules/products.js',
    '/assets/js/modules/stock.js',
    '/assets/js/modules/customers.js',
    '/assets/js/modules/suppliers.js',
    '/assets/js/modules/expenses.js',
    '/assets/js/modules/cash-register.js',
    '/assets/js/modules/reports.js',
    '/assets/js/modules/staff.js',
    '/assets/js/modules/receipt.js',
    '/assets/js/modules/whatsapp.js',
    '/assets/js/modules/catalogue-settings.js',
    '/assets/js/modules/settings.js',
    '/assets/js/modules/dashboard.js',
    '/assets/js/admin/admin-auth.js',
    '/assets/js/admin/admin-dashboard.js',
    '/assets/js/admin/admin-businesses.js'
];

// Installation : mise en cache des assets essentiels
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Cvisual SW] Pré-mise en cache des fichiers de base...');
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('[Cvisual SW] Avertissement mise en cache initiale:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activation : suppression des anciens caches obsolètes
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Cvisual SW] Suppression de l\'ancien cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interception des requêtes (Cache-first pour les statiques, Network-first pour les données)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Ignorer les requêtes non GET ou les websockets
    if (event.request.method !== 'GET') return;

    // Pour les ressources Supabase API / Rest : Network-First
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Si échec réseau, on retourne une réponse vide ou le cache s'il existe
                return caches.match(event.request);
            })
        );
        return;
    }

    // Pour les fichiers statiques de l'application : Cache-First avec mise à jour en tâche de fond
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Rafraîchir en tâche de fond
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            }).catch(() => {
                // Repli hors-ligne pour la navigation HTML
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('/app.html');
                }
            });
        })
    );
});
