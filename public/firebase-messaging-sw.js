// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Konfigurační objekt Firebase - tyto údaje je potřeba nahradit skutečnými údaji z Firebase konzole
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "workandpay.firebaseapp.com",
  projectId: "workandpay",
  storageBucket: "workandpay.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Inicializace Firebase
firebase.initializeApp(firebaseConfig);

// Inicializace Firebase Messaging
const messaging = firebase.messaging();

// Zpracování push notifikací na pozadí
messaging.onBackgroundMessage((payload) => {
  console.log('Přijata zpráva na pozadí:', payload);
  
  const notificationTitle = payload.notification.title || 'WorkAndPay';
  const notificationOptions = {
    body: payload.notification.body || '',
    icon: '/images/icon-192x192.png',
    badge: '/images/icon-192x192.png',
    data: payload.data
  };
  
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Event pro kliknutí na notifikaci
self.addEventListener('notificationclick', (event) => {
  console.log('Kliknuto na notifikaci:', event);
  
  // Zavření notifikace
  event.notification.close();
  
  // Otevření nebo zaměření okna aplikace
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((clientList) => {
      // Pokud je již otevřeno okno aplikace, zaměřit ho
      for (const client of clientList) {
        if (client.url.includes('/index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Jinak otevřít nové okno
      if (clients.openWindow) {
        return clients.openWindow('/index.html');
      }
    })
  );
});