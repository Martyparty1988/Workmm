// service-worker.js - Service Worker pro PWA

const CACHE_NAME = 'workandpay-cache-v1';

// Soubory pro precache při instalaci service workeru
const precacheResources = [
  '/',
  '/index.html',
  '/login.html',
  '/css/styles.css',
  '/js/firebase-config.js',
  '/js/auth.js',
  '/js/data-service.js',
  '/js/debts-view.js',
  '/js/deductions-view.js',
  '/js/main.js',
  '/js/migration.js',
  '/js/timer-service.js',
  '/js/worklogs-view.js',
  '/js/settings-view.js',
  '/manifest.json',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

// Event listener pro instalaci service workeru
self.addEventListener('install', (event) => {
  console.log('Service worker instalován');
  
  // Precache klíčových souborů
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(precacheResources);
      })
      .then(() => {
        // Aktivace service workeru ihned po instalaci
        return self.skipWaiting();
      })
  );
});

// Event listener pro aktivaci service workeru
self.addEventListener('activate', (event) => {
  console.log('Service worker aktivován');
  
  // Vyčištění starých cache
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Zajištění, že service worker převezme okamžitě kontrolu nad stránkami
      return self.clients.claim();
    })
  );
});

// Event listener pro požadavky na síť
self.addEventListener('fetch', (event) => {
  // Ignorujeme požadavky na Firebase API
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('firestore') ||
      event.request.url.includes('firebase')) {
    return;
  }
  
  // Strategie "Cache first, then network"
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Vrací data z cache, pokud existují
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Jinak jde na síť
        return fetch(event.request)
          .then((response) => {
            // Ukládáme kopii odpovědi do cache
            if (response && response.status === 200 && response.type === 'basic') {
              const responseToCache = response.clone();
              
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            
            return response;
          })
          .catch(() => {
            // Pokud selže síť a jde o požadavek na stránku, vrátíme offline stránku
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            
            // Jinak necháme selhat
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Synchronizace dat při obnovení připojení
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('Sync data požadavek obdržen');
    // Zde by byla logika pro synchronizaci offline dat
  }
});