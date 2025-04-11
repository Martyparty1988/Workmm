// notifications.js - Push notifikace

import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js";
import { app } from './firebase-config.js';

// Inicializace Firebase Messaging
const messaging = getMessaging(app);

// Registrace service workeru pro notifikace
async function registerServiceWorkerForNotifications() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      console.log('Service Worker pro notifikace zaregistrován:', registration);
      return registration;
    } catch (error) {
      console.error('Chyba registrace Service Workeru pro notifikace:', error);
      throw error;
    }
  } else {
    throw new Error('Service Worker není podporován v tomto prohlížeči');
  }
}

/**
 * Požádání o povolení push notifikací
 */
export async function requestNotificationPermission() {
  try {
    // Kontrola, zda prohlížeč podporuje notifikace
    if (!('Notification' in window)) {
      console.warn('Tento prohlížeč nepodporuje push notifikace');
      return false;
    }
    
    // Požádání o povolení
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Notifikace povoleny');
      
      // Registrace service workeru
      await registerServiceWorkerForNotifications();
      
      // Získání tokenu zařízení
      const currentToken = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY' // Nahraďte skutečným VAPID klíčem z Firebase
      });
      
      if (currentToken) {
        console.log('Token zařízení:', currentToken);
        
        // Zde můžete uložit token do Firestore nebo poslat na server
        // await saveTokenToServer(currentToken);
        
        // Nastavení handleru pro příchozí zprávy
        onMessage(messaging, (payload) => {
          console.log('Přijata zpráva:', payload);
          showLocalNotification(payload.notification.title, payload.notification.body);
        });
        
        return true;
      } else {
        console.warn('Nepodařilo se získat token zařízení');
        return false;
      }
    } else {
      console.warn('Povolení pro notifikace nebylo uděleno');
      return false;
    }
  } catch (error) {
    console.error('Chyba při nastavování notifikací:', error);
    return false;
  }
}

/**
 * Zobrazení lokální notifikace
 * @param {string} title - Titulek notifikace
 * @param {string} body - Obsah notifikace
 * @param {Object} options - Další volby
 */
export function showLocalNotification(title, body, options = {}) {
  if (Notification.permission === 'granted') {
    // Vytvoření a zobrazení notifikace
    const notification = new Notification(title, {
      body,
      icon: '/images/icon-192x192.png',
      ...options
    });
    
    // Event listener pro kliknutí na notifikaci
    notification.onclick = function() {
      window.focus();
      notification.close();
      
      // Případná další akce po kliknutí
      if (options.onClick) {
        options.onClick();
      }
    };
  }
}

/**
 * Naplánování připomenutí na určitý čas
 * @param {string} title - Titulek připomenutí
 * @param {string} body - Obsah připomenutí
 * @param {Date} scheduledTime - Čas připomenutí
 */
export function scheduleReminder(title, body, scheduledTime) {
  const now = new Date();
  const delay = scheduledTime.getTime() - now.getTime();
  
  if (delay <= 0) {
    console.warn('Nelze naplánovat připomenutí v minulosti');
    return;
  }
  
  // Naplánování notifikace
  setTimeout(() => {
    showLocalNotification(title, body);
  }, delay);
  
  console.log(`Připomenutí naplánováno na ${scheduledTime.toLocaleString()}`);
}