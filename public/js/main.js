// main.js - Hlavní soubor aplikace

import { auth, onAuthStateChanged } from './firebase-config.js';
import { initTimer, saveTimerEntry } from './timer-service.js';
import { initWorkLogsView, updateWorkLogsList } from './worklogs-view.js';
import { initDebtsView } from './debts-view.js';
import { initDeductionsView } from './deductions-view.js';
import { initSettingsView } from './settings-view.js';
import { checkAuth } from './auth.js';

// Reference na HTML elementy
let navLinks;
let contentSections;
let saveTimerButton;
let notificationContainer;

// Aktuální sekce
let currentSection = 'timer';

// Inicializace aplikace
async function initApp() {
  console.log('Inicializace aplikace...');
  
  // Kontrola, zda je uživatel přihlášen
  const user = await checkAuth();
  if (!user) {
    console.error('Uživatel není přihlášen');
    return;
  }
  
  // Načtení referencí na HTML elementy
  navLinks = document.querySelectorAll('.nav-link');
  contentSections = document.querySelectorAll('.content-section');
  saveTimerButton = document.getElementById('save-timer-button');
  notificationContainer = document.getElementById('notification-container');
  
  // Kontrola, zda byly nalezeny všechny potřebné elementy
  if (!navLinks.length || !contentSections.length) {
    console.error('Nebyly nalezeny všechny potřebné HTML elementy pro navigaci');
    return;
  }
  
  // Přidání event listenerů na navigační odkazy
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const section = link.getAttribute('data-section');
      if (section) {
        showSection(section);
      }
    });
  });
  
  // Přidání event listeneru na tlačítko pro uložení časovače
  if (saveTimerButton) {
    saveTimerButton.addEventListener('click', saveTimerEntry);
  }
  
  // Kontrola hash v URL
  const hash = window.location.hash.substring(1);
  if (hash) {
    showSection(hash);
  } else {
    showSection('timer');
  }
  
  // Inicializace jednotlivých modulů
  try {
    await initTimer();
    await initWorkLogsView();
    await initDebtsView();
    await initDeductionsView();
    await initSettingsView();
  } catch (error) {
    console.error('Chyba při inicializaci modulů:', error);
    showNotification('Chyba při inicializaci aplikace', 'error');
  }
  
  console.log('Aplikace byla úspěšně inicializována');
}

// Zobrazení konkrétní sekce
function showSection(section) {
  console.log('Přepnutí na sekci:', section);
  
  // Aktualizace URL hash
  window.location.hash = section;
  
  // Aktualizace aktivního odkazu
  navLinks.forEach(link => {
    const linkSection = link.getAttribute('data-section');
    if (linkSection === section) {
      link.classList.add('bg-blue-700');
      link.classList.remove('hover:bg-blue-600');
    } else {
      link.classList.remove('bg-blue-700');
      link.classList.add('hover:bg-blue-600');
    }
  });
  
  // Aktualizace viditelné sekce
  contentSections.forEach(content => {
    if (content.id === section + '-section') {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });
  
  // Aktualizace aktuální sekce
  currentSection = section;
  
  // Případná aktualizace dat při přepnutí sekce
  switch (section) {
    case 'worklogs':
      if (typeof updateWorkLogsList === 'function') {
        updateWorkLogsList();
      }
      break;
    default:
      break;
  }
}

// Zobrazení notifikace
function showNotification(message, type = 'info') {
  // Kontrola, zda existuje element pro notifikace
  if (!notificationContainer) {
    console.log('Notifikace:', message, '(typ:', type, ')');
    return;
  }
  
  // Vytvoření elementu notifikace
  const notification = document.createElement('div');
  notification.className = 'notification p-3 rounded-lg shadow-md mb-3 animate-fadeIn';
  
  // Nastavení barvy podle typu
  if (type === 'success') {
    notification.classList.add('bg-green-100', 'text-green-800', 'border-l-4', 'border-green-500');
  } else if (type === 'error') {
    notification.classList.add('bg-red-100', 'text-red-800', 'border-l-4', 'border-red-500');
  } else {
    notification.classList.add('bg-blue-100', 'text-blue-800', 'border-l-4', 'border-blue-500');
  }
  
  notification.textContent = message;
  
  // Přidání notifikace do kontejneru
  notificationContainer.appendChild(notification);
  
  // Odstranění notifikace po 3 sekundách
  setTimeout(() => {
    notification.classList.add('animate-fadeOut');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Kontrola stavu přihlášení a spuštění aplikace
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Uživatel je přihlášen
      console.log('Uživatel je přihlášen:', user.email);
      initApp();
    } else {
      // Uživatel není přihlášen, přesměrování na přihlášení
      if (!window.location.pathname.includes('login.html')) {
        console.log('Uživatel není přihlášen, přesměrování na přihlášení');
        window.location.href = 'login.html';
      }
    }
  });
});

// Export funkcí pro použití v jiných souborech
export { showNotification };