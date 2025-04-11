// pwa.js - Registrace service workera pro PWA funkcionalitu

// Funkce pro registraci service workera
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('Service Worker registrován úspěšně:', registration.scope);
        })
        .catch((error) => {
          console.error('Chyba při registraci Service Workera:', error);
        });
    });
  }
}

// Instalace PWA
function installPWA() {
  let deferredPrompt;
  const installButton = document.getElementById('install-pwa-button');
  
  // Skrytí tlačítka pro instalaci
  if (installButton) {
    installButton.style.display = 'none';
  }
  
  // Zachycení události beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    // Zamezení zobrazení výchozího dialogu pro instalaci
    e.preventDefault();
    
    // Uložení události pro pozdější použití
    deferredPrompt = e;
    
    // Zobrazení tlačítka pro instalaci
    if (installButton) {
      installButton.style.display = 'block';
      
      // Přidání event listeneru na tlačítko
      installButton.addEventListener('click', () => {
        // Skrytí tlačítka
        installButton.style.display = 'none';
        
        // Zobrazení vlastního dialogu pro instalaci
        deferredPrompt.prompt();
        
        // Čekání na rozhodnutí uživatele
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('Uživatel přijal výzvu k instalaci');
          } else {
            console.log('Uživatel odmítl výzvu k instalaci');
          }
          
          // Reset proměnné
          deferredPrompt = null;
        });
      });
    }
  });
  
  // Detekce, zda je aplikace již nainstalována
  window.addEventListener('appinstalled', (e) => {
    console.log('Aplikace byla nainstalována');
    
    // Skrytí tlačítka pro instalaci
    if (installButton) {
      installButton.style.display = 'none';
    }
  });
}

// Registrace service workera
registerServiceWorker();

// Instalace PWA
document.addEventListener('DOMContentLoaded', installPWA);