// deductions-view.js - Přehled fondu srážek

import { deductionsFundHistoryService, settingsService } from './data-service.js';
import { auth } from './firebase-config.js';

// Reference na HTML elementy
let deductionsFundDisplay;
let deductionsChart;
let deductionsTable;
let filterYearSelect;
let manualTriggerButton;

// Data
let settings = null;
let monthlySummary = [];
let currentYear = new Date().getFullYear();

// Inicializace přehledu fondu srážek
export async function initDeductionsView() {
  // Kontrola, zda je uživatel přihlášen
  const user = auth.currentUser;
  if (!user) {
    console.error('Uživatel není přihlášen');
    return;
  }
  
  // Načtení referencí na HTML elementy
  deductionsFundDisplay = document.getElementById('deductions-fund-display');
  deductionsChart = document.getElementById('deductions-chart');
  deductionsTable = document.getElementById('deductions-table');
  filterYearSelect = document.getElementById('filter-year');
  manualTriggerButton = document.getElementById('manual-trigger-button');
  
  // Kontrola, zda byly nalezeny všechny potřebné elementy
  if (!deductionsFundDisplay) {
    console.error('Nebyly nalezeny všechny potřebné HTML elementy pro přehled fondu srážek');
    return;
  }
  
  // Načtení nastavení
  try {
    settings = await settingsService.get();
    console.log('Načteno nastavení:', settings);
  } catch (error) {
    console.error('Chyba při načítání nastavení:', error);
    showNotification('Chyba při načítání nastavení', 'error');
  }
  
  // Načtení dat
  try {
    await loadDeductionsData();
  } catch (error) {
    console.error('Chyba při načítání dat fondu srážek:', error);
    showNotification('Chyba při načítání dat fondu srážek', 'error');
  }
  
  // Přidání event listenerů na filtr roku
  if (filterYearSelect) {
    // Naplnění select boxu
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 2; year <= currentYear; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === currentYear) {
        option.selected = true;
      }
      filterYearSelect.appendChild(option);
    }
    
    // Event listener
    filterYearSelect.addEventListener('change', async () => {
      currentYear = parseInt(filterYearSelect.value);
      await loadDeductionsData();
    });
  }
  
  // Přidání event listeneru na tlačítko pro ruční spuštění
  if (manualTriggerButton) {
    manualTriggerButton.addEventListener('click', async () => {
      await triggerMonthlyProcessing();
    });
  }
  
  console.log('Přehled fondu srážek byl inicializován');
}

// Načtení dat o fondu srážek
async function loadDeductionsData() {
  try {
    // Načtení nastavení (pro aktuální stav fondu)
    settings = await settingsService.get();
    
    // Načtení měsíčního souhrnu
    monthlySummary = await deductionsFundHistoryService.getMonthlySummary();
    
    // Filtrování podle roku
    if (currentYear) {
      monthlySummary = monthlySummary.filter(item => item.year === currentYear);
    }
    
    // Aktualizace zobrazení
    updateDeductionsFundDisplay();
    renderDeductionsChart();
    renderDeductionsTable();
  } catch (error) {
    console.error('Chyba při načítání dat fondu srážek:', error);
    showNotification('Chyba při načítání dat fondu srážek', 'error');
  }
}

// Aktualizace zobrazení stavu fondu srážek
function updateDeductionsFundDisplay() {
  if (!deductionsFundDisplay || !settings) return;
  
  // Formátování částky
  const fundAmountFormatted = new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0
  }).format(settings.deductionsFund || 0);
  
  // Aktualizace zobrazení
  deductionsFundDisplay.innerHTML = `
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 class="text-xl font-bold mb-4">Aktuální stav fondu srážek</h3>
      <p class="text-3xl font-bold text-blue-600">${fundAmountFormatted}</p>
      
      <div class="mt-4">
        <p>Nastavení srážek:</p>
        <ul class="list-disc ml-5 mt-2">
          <li>Maru: ${settings.deductionRates?.Maru ? `${Math.round(settings.deductionRates.Maru * 100)}%` : 'Nenastaveno'}</li>
          <li>Marty: ${settings.deductionRates?.Marty ? `${Math.round(settings.deductionRates.Marty * 100)}%` : 'Nenastaveno'}</li>
        </ul>
      </div>
      
      <div class="mt-4">
        <p>Měsíční nájem: ${new Intl.NumberFormat('cs-CZ', {
          style: 'currency',
          currency: 'CZK',
          minimumFractionDigits: 0
        }).format(settings.monthlyRent || 0)}</p>
      </div>
    </div>
  `;
}

// Vykreslení grafu využití fondu srážek
function renderDeductionsChart() {
  if (!deductionsChart) return;
  
  // Kontrola, zda jsou nějaká data
  if (monthlySummary.length === 0) {
    deductionsChart.innerHTML = '<p class="text-center py-4">Žádná data pro zobrazení grafu</p>';
    return;
  }
  
  // Příprava dat pro graf
  const chartData = [...monthlySummary].reverse(); // Seřazení od nejstaršího
  
  // Vykreslení grafu pomocí Chart.js
  deductionsChart.innerHTML = '<canvas id="monthly-deductions-chart" width="400" height="300"></canvas>';
  const canvas = document.getElementById('monthly-deductions-chart');
  
  // Kontrola, zda existuje knihovna Chart
  if (!window.Chart) {
    console.error('Knihovna Chart.js není načtena');
    deductionsChart.innerHTML = '<p class="text-center py-4">Graf nelze zobrazit - chybí Chart.js</p>';
    return;
  }
  
  // Zničení předchozího grafu, pokud existuje
  if (window.deductionsMonthlyChart) {
    window.deductionsMonthlyChart.destroy();
  }
  
  // Vytvoření datové sady pro graf
  const labels = chartData.map(item => `${item.month}/${item.year}`);
  
  // Vytvoření grafu
  window.deductionsMonthlyChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Maru',
          data: chartData.map(item => item.deductedMaru),
          backgroundColor: '#4C51BF', // Indigo
          stack: 'Stack 0'
        },
        {
          label: 'Marty',
          data: chartData.map(item => item.deductedMarty),
          backgroundColor: '#38B2AC', // Teal
          stack: 'Stack 0'
        },
        {
          label: 'Nájem',
          data: chartData.map(item => -item.rent), // Záporné hodnoty pro odečtení
          backgroundColor: '#ED8936', // Orange
          stack: 'Stack 1'
        },
        {
          label: 'Splátky dluhů',
          data: chartData.map(item => -item.debtPayments), // Záporné hodnoty pro odečtení
          backgroundColor: '#9B2C2C', // Dark red
          stack: 'Stack 1'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          stacked: true
        },
        y: {
          stacked: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString('cs-CZ') + ' Kč';
            }
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = Math.abs(context.raw); // Použití absolutní hodnoty
              return `${context.dataset.label}: ${value.toLocaleString('cs-CZ')} Kč`;
            }
          }
        },
        title: {
          display: true,
          text: 'Měsíční přehled srážek a využití fondu'
        },
        legend: {
          display: true,
          position: 'top'
        }
      }
    }
  });
  
  // Vytvoření druhého grafu pro zůstatky
  deductionsChart.innerHTML += '<canvas id="balance-chart" width="400" height="200" class="mt-8"></canvas>';
  const balanceCanvas = document.getElementById('balance-chart');
  
  // Zničení předchozího grafu, pokud existuje
  if (window.balanceChart) {
    window.balanceChart.destroy();
  }
  
  // Výpočet kumulativního zůstatku
  let cumulativeBalance = 0;
  const balanceData = chartData.map(item => {
    const monthlyBalance = item.deductedMaru + item.deductedMarty - item.rent - item.debtPayments;
    cumulativeBalance += monthlyBalance;
    return cumulativeBalance;
  });
  
  // Vytvoření grafu
  window.balanceChart = new Chart(balanceCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Kumulativní zůstatek',
          data: balanceData,
          borderColor: '#3182CE', // Blue
          backgroundColor: 'rgba(49, 130, 206, 0.1)',
          borderWidth: 2,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          ticks: {
            callback: function(value) {
              return value.toLocaleString('cs-CZ') + ' Kč';
            }
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              return `Zůstatek: ${value.toLocaleString('cs-CZ')} Kč`;
            }
          }
        },
        title: {
          display: true,
          text: 'Vývoj zůstatku fondu srážek'
        }
      }
    }
  });
}

// Vykreslení tabulky měsíčního přehledu fondu
function renderDeductionsTable() {
  if (!deductionsTable) return;
  
  // Kontrola, zda jsou nějaká data
  if (monthlySummary.length === 0) {
    deductionsTable.innerHTML = '<p class="text-center py-4">Žádná data pro zobrazení tabulky</p>';
    return;
  }
  
  // Vytvoření HTML pro tabulku
  let tableHTML = `
    <table class="w-full border-collapse">
      <thead>
        <tr class="bg-gray-100">
          <th class="py-2 px-4 text-left">Měsíc</th>
          <th class="py-2 px-4 text-left">Srážky Maru</th>
          <th class="py-2 px-4 text-left">Srážky Marty</th>
          <th class="py-2 px-4 text-left">Nájem</th>
          <th class="py-2 px-4 text-left">Splátky dluhů</th>
          <th class="py-2 px-4 text-left">Měsíční zůstatek</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  // Seřazení od nejnovějšího
  const sortedData = [...monthlySummary].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
  
  // Vytvoření řádků tabulky
  sortedData.forEach(item => {
    const monthlyBalance = item.deductedMaru + item.deductedMarty - item.rent - item.debtPayments;
    
    // Formátování částek
    const deductedMaruFormatted = new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0
    }).format(item.deductedMaru);
    
    const deductedMartyFormatted = new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0
    }).format(item.deductedMarty);
    
    const rentFormatted = new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0
    }).format(item.rent);
    
    const debtPaymentsFormatted = new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0
    }).format(item.debtPayments);
    
    const balanceFormatted = new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0
    }).format(monthlyBalance);
    
    // Určení třídy pro zůstatek
    const balanceClass = monthlyBalance >= 0 ? 'text-green-600' : 'text-red-600';
    
    tableHTML += `
      <tr class="border-b hover:bg-gray-50">
        <td class="py-2 px-4">${item.month}/${item.year}</td>
        <td class="py-2 px-4">${deductedMaruFormatted}</td>
        <td class="py-2 px-4">${deductedMartyFormatted}</td>
        <td class="py-2 px-4">${rentFormatted}</td>
        <td class="py-2 px-4">${debtPaymentsFormatted}</td>
        <td class="py-2 px-4 font-medium ${balanceClass}">${balanceFormatted}</td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody></table>';
  
  // Aktualizace tabulky
  deductionsTable.innerHTML = tableHTML;
}

// Ruční spuštění měsíčního zpracování
async function triggerMonthlyProcessing() {
  if (!confirm('Opravdu chcete spustit automatické měsíční zpracování? Tato akce odečte nájem a případně zaplatí dluhy z fondu srážek.')) {
    return;
  }
  
  try {
    // Zobrazení načítání
    showNotification('Spouštím měsíční zpracování...', 'info');
    
    // Získání odkazu na Firebase Functions
    if (!window.firebase || !window.firebase.functions) {
      console.error('Firebase Functions není k dispozici');
      showNotification('Nepodařilo se spustit měsíční zpracování - chybí Firebase Functions', 'error');
      return;
    }
    
    const functions = window.firebase.functions();
    const manualProcessingFunction = functions.httpsCallable('manualMonthlyProcessing');
    
    // Volání funkce
    const result = await manualProcessingFunction();
    console.log('Výsledek měsíčního zpracování:', result);
    
    // Aktualizace dat
    await loadDeductionsData();
    
    // Zobrazení notifikace
    showNotification('Měsíční zpracování bylo úspěšně dokončeno', 'success');
  } catch (error) {
    console.error('Chyba při spouštění měsíčního zpracování:', error);
    showNotification('Chyba při spouštění měsíčního zpracování', 'error');
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