// timer-service.js - Služba pro časovač a pracovní záznamy

import { workLogsService, settingsService, deductionsFundHistoryService } from './data-service.js';
import { auth } from './firebase-config.js';

// Reference na HTML elementy
let timerDisplay;
let startStopButton;
let resetButton;
let saveManualButton;
let manualHoursInput;
let manualDateInput;
let manualDescriptionInput;
let personSelect;

// Stav časovače
let startTime = null;
let timerInterval = null;
let elapsedTime = 0;
let isRunning = false;

// Nastavení
let settings = {
  hourlyRate: 160,
  workingHours: 8,
  deductionRates: {
    'Maru': 1/3,
    'Marty': 1/2
  }
};

// Inicializace časovače
export async function initTimer() {
  // Kontrola, zda je uživatel přihlášen
  const user = auth.currentUser;
  if (!user) {
    console.error('Uživatel není přihlášen');
    return;
  }
  
  // Načtení referencí na HTML elementy
  timerDisplay = document.getElementById('timer-display');
  startStopButton = document.getElementById('start-stop-button');
  resetButton = document.getElementById('reset-button');
  saveManualButton = document.getElementById('save-manual-button');
  manualHoursInput = document.getElementById('manual-hours-input');
  manualDateInput = document.getElementById('manual-date-input');
  manualDescriptionInput = document.getElementById('manual-description-input');
  personSelect = document.getElementById('person-select');
  
  // Kontrola, zda byly nalezeny všechny potřebné elementy
  if (!timerDisplay || !startStopButton || !resetButton || !saveManualButton) {
    console.error('Nebyly nalezeny všechny potřebné HTML elementy');
    return;
  }
  
  // Načtení nastavení z Firestore
  try {
    settings = await settingsService.get();
    console.log('Načteno nastavení:', settings);
  } catch (error) {
    console.error('Chyba při načítání nastavení:', error);
  }
  
  // Zkontrolujeme, zda existuje uložený stav časovače v session storage
  const savedState = sessionStorage.getItem('timerState');
  if (savedState) {
    const state = JSON.parse(savedState);
    startTime = state.startTime ? new Date(state.startTime) : null;
    elapsedTime = state.elapsedTime || 0;
    isRunning = state.isRunning || false;
    
    // Pokud byl časovač spuštěn, obnovíme interval
    if (isRunning && startTime) {
      timerInterval = setInterval(updateTimer, 1000);
      startStopButton.textContent = 'Stop';
      startStopButton.classList.remove('bg-green-500', 'hover:bg-green-600');
      startStopButton.classList.add('bg-red-500', 'hover:bg-red-600');
    }
    
    // Aktualizace zobrazení
    updateTimerDisplay();
  }
  
  // Nastavení aktuálního data pro manuální vstup
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  if (manualDateInput) {
    manualDateInput.value = formattedDate;
  }
  
  // Přidání event listenerů
  startStopButton.addEventListener('click', toggleTimer);
  resetButton.addEventListener('click', resetTimer);
  saveManualButton.addEventListener('click', saveManualEntry);
  
  console.log('Časovač byl inicializován');
}

// Přepínání mezi spuštěním a zastavením časovače
function toggleTimer() {
  if (isRunning) {
    // Zastavení časovače
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    
    // Aktualizace uloženého času
    elapsedTime += Date.now() - startTime.getTime();
    startTime = null;
    
    // Změna tlačítka
    startStopButton.textContent = 'Start';
    startStopButton.classList.remove('bg-red-500', 'hover:bg-red-600');
    startStopButton.classList.add('bg-green-500', 'hover:bg-green-600');
  } else {
    // Spuštění časovače
    startTime = new Date();
    timerInterval = setInterval(updateTimer, 1000);
    isRunning = true;
    
    // Změna tlačítka
    startStopButton.textContent = 'Stop';
    startStopButton.classList.remove('bg-green-500', 'hover:bg-green-600');
    startStopButton.classList.add('bg-red-500', 'hover:bg-red-600');
  }
  
  // Uložení stavu do session storage
  saveTimerState();
}

// Aktualizace časovače (volá se každou sekundu, když je časovač aktivní)
function updateTimer() {
  updateTimerDisplay();
}

// Aktualizace zobrazení času
function updateTimerDisplay() {
  // Výpočet celkového uplynulého času
  let totalElapsed = elapsedTime;
  
  // Pokud je časovač spuštěn, přidáme aktuální interval
  if (isRunning && startTime) {
    totalElapsed += Date.now() - startTime.getTime();
  }
  
  // Převod na hodiny, minuty a sekundy
  const hours = Math.floor(totalElapsed / 3600000);
  const minutes = Math.floor((totalElapsed % 3600000) / 60000);
  const seconds = Math.floor((totalElapsed % 60000) / 1000);
  
  // Formátování času (doplnění nul)
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Aktualizace zobrazení
  timerDisplay.textContent = formattedTime;
  
  // Uložení stavu do session storage
  saveTimerState();
}

// Resetování časovače
function resetTimer() {
  // Zastavení časovače, pokud běží
  if (isRunning) {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    
    // Změna tlačítka
    startStopButton.textContent = 'Start';
    startStopButton.classList.remove('bg-red-500', 'hover:bg-red-600');
    startStopButton.classList.add('bg-green-500', 'hover:bg-green-600');
  }
  
  // Resetování hodnot
  startTime = null;
  elapsedTime = 0;
  
  // Aktualizace zobrazení
  updateTimerDisplay();
  
  // Uložení stavu do session storage
  saveTimerState();
}

// Uložení stavu časovače do session storage
function saveTimerState() {
  const state = {
    startTime: startTime ? startTime.getTime() : null,
    elapsedTime,
    isRunning
  };
  
  sessionStorage.setItem('timerState', JSON.stringify(state));
}

// Uložení časového záznamu po zastavení časovače
export async function saveTimerEntry() {
  try {
    // Kontrola, zda je co ukládat
    if (elapsedTime === 0 && (!isRunning || !startTime)) {
      showNotification('Není co uložit, časovač nebyl spuštěn', 'error');
      return;
    }
    
    // Výpočet celkového uplynulého času
    let totalElapsed = elapsedTime;
    
    // Pokud je časovač spuštěn, přidáme aktuální interval
    if (isRunning && startTime) {
      totalElapsed += Date.now() - startTime.getTime();
    }
    
    // Převod na hodiny
    const hours = totalElapsed / 3600000;
    
    // Vytvoření pracovního záznamu
    const person = personSelect ? personSelect.value : 'Marty'; // Výchozí osoba
    const workLog = {
      date: new Date(),
      hours,
      hourlyRate: settings.hourlyRate,
      amount: Math.round(hours * settings.hourlyRate),
      description: 'Časovač',
      person
    };
    
    // Uložení záznamu do Firestore
    const savedWorkLog = await workLogsService.add(workLog);
    console.log('Pracovní záznam uložen:', savedWorkLog);
    
    // Výpočet srážky do fondu
    const deductionRate = settings.deductionRates[person] || 0;
    const deductionAmount = Math.round(workLog.amount * deductionRate);
    
    // Aktualizace fondu srážek
    if (deductionAmount > 0) {
      await settingsService.updateDeductionsFund(deductionAmount);
      
      // Přidání záznamu do historie fondu
      await deductionsFundHistoryService.add({
        type: 'deduction',
        amount: deductionAmount,
        date: new Date(),
        person,
        workLogId: savedWorkLog.id,
        description: `Srážka z výdělku: ${workLog.description}`
      });
      
      console.log(`Srážka ${deductionAmount} Kč přidána do fondu`);
    }
    
    // Resetování časovače
    resetTimer();
    
    // Zobrazení notifikace
    showNotification(`Záznam uložen: ${hours.toFixed(2)} hodin = ${workLog.amount} Kč`, 'success');
    
    // Aktualizace přehledu
    if (typeof updateWorkLogsList === 'function') {
      updateWorkLogsList();
    }
    
    return savedWorkLog;
  } catch (error) {
    console.error('Chyba při ukládání pracovního záznamu:', error);
    showNotification('Chyba při ukládání záznamu', 'error');
    return null;
  }
}

// Uložení manuálně zadaného záznamu
async function saveManualEntry() {
  try {
    // Kontrola vstupů
    const hours = parseFloat(manualHoursInput.value);
    const date = new Date(manualDateInput.value);
    const description = manualDescriptionInput.value.trim();
    const person = personSelect ? personSelect.value : 'Marty'; // Výchozí osoba
    
    if (isNaN(hours) || hours <= 0) {
      showNotification('Zadejte platný počet hodin', 'error');
      return;
    }
    
    if (isNaN(date.getTime())) {
      showNotification('Zadejte platné datum', 'error');
      return;
    }
    
    if (!description) {
      showNotification('Zadejte popis činnosti', 'error');
      return;
    }
    
    // Vytvoření pracovního záznamu
    const workLog = {
      date,
      hours,
      hourlyRate: settings.hourlyRate,
      amount: Math.round(hours * settings.hourlyRate),
      description,
      person
    };
    
    // Uložení záznamu do Firestore
    const savedWorkLog = await workLogsService.add(workLog);
    console.log('Pracovní záznam uložen:', savedWorkLog);
    
    // Výpočet srážky do fondu
    const deductionRate = settings.deductionRates[person] || 0;
    const deductionAmount = Math.round(workLog.amount * deductionRate);
    
    // Aktualizace fondu srážek
    if (deductionAmount > 0) {
      await settingsService.updateDeductionsFund(deductionAmount);
      
      // Přidání záznamu do historie fondu
      await deductionsFundHistoryService.add({
        type: 'deduction',
        amount: deductionAmount,
        date: new Date(),
        person,
        workLogId: savedWorkLog.id,
        description: `Srážka z výdělku: ${workLog.description}`
      });
      
      console.log(`Srážka ${deductionAmount} Kč přidána do fondu`);
    }
    
    // Vyčištění vstupů
    manualHoursInput.value = '';
    manualDescriptionInput.value = '';
    
    // Zobrazení notifikace
    showNotification(`Záznam uložen: ${hours.toFixed(2)} hodin = ${workLog.amount} Kč`, 'success');
    
    // Aktualizace přehledu
    if (typeof updateWorkLogsList === 'function') {
      updateWorkLogsList();
    }
    
    return savedWorkLog;
  } catch (error) {
    console.error('Chyba při ukládání pracovního záznamu:', error);
    showNotification('Chyba při ukládání záznamu', 'error');
    return null;
  }
}

// Zobrazení notifikace
function showNotification(message, type = 'info') {
  // Kontrola, zda existuje element pro notifikace
  const notificationContainer = document.getElementById('notification-container');
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