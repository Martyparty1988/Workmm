// worklogs-view.js - Přehled pracovních záznamů a grafy

import { workLogsService, settingsService } from './data-service.js';
import { auth } from './firebase-config.js';

// Reference na HTML elementy
let workLogsTable;
let workLogsSummary;
let workLogsChart;
let filterDateFrom;
let filterDateTo;
let filterPersonSelect;
let exportCsvButton;

// Aktuální záznamy a filtry
let allWorkLogs = [];
let filteredWorkLogs = [];
let currentFilters = {
  dateFrom: null,
  dateTo: null,
  person: 'all'
};

// Inicializace přehledu pracovních záznamů
export async function initWorkLogsView() {
  // Kontrola, zda je uživatel přihlášen
  const user = auth.currentUser;
  if (!user) {
    console.error('Uživatel není přihlášen');
    return;
  }
  
  // Načtení referencí na HTML elementy
  workLogsTable = document.getElementById('worklogs-table');
  workLogsSummary = document.getElementById('worklogs-summary');
  workLogsChart = document.getElementById('worklogs-chart');
  filterDateFrom = document.getElementById('filter-date-from');
  filterDateTo = document.getElementById('filter-date-to');
  filterPersonSelect = document.getElementById('filter-person');
  exportCsvButton = document.getElementById('export-csv-button');
  
  // Kontrola, zda byly nalezeny všechny potřebné elementy
  if (!workLogsTable || !workLogsSummary) {
    console.error('Nebyly nalezeny všechny potřebné HTML elementy pro přehled záznamů');
    return;
  }
  
  // Nastavení výchozích hodnot filtrů
  setDefaultFilters();
  
  // Načtení pracovních záznamů
  try {
    await loadWorkLogs();
  } catch (error) {
    console.error('Chyba při načítání pracovních záznamů:', error);
    showNotification('Chyba při načítání záznamů', 'error');
  }
  
  // Přidání event listenerů na filtry
  if (filterDateFrom) {
    filterDateFrom.addEventListener('change', applyFilters);
  }
  
  if (filterDateTo) {
    filterDateTo.addEventListener('change', applyFilters);
  }
  
  if (filterPersonSelect) {
    filterPersonSelect.addEventListener('change', applyFilters);
  }
  
  // Přidání event listeneru na tlačítko pro export CSV
  if (exportCsvButton) {
    exportCsvButton.addEventListener('click', exportToCSV);
  }
  
  console.log('Přehled pracovních záznamů byl inicializován');
}

// Načtení pracovních záznamů z Firestore
async function loadWorkLogs() {
  try {
    allWorkLogs = await workLogsService.getAll();
    console.log('Načteno', allWorkLogs.length, 'pracovních záznamů');
    
    // Aplikace filtrů
    applyFilters();
  } catch (error) {
    console.error('Chyba při načítání pracovních záznamů:', error);
    showNotification('Chyba při načítání záznamů', 'error');
  }
}

// Nastavení výchozích hodnot filtrů
function setDefaultFilters() {
  // Výchozí datumy - poslední měsíc
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  currentFilters.dateFrom = firstDayOfMonth;
  currentFilters.dateTo = lastDayOfMonth;
  
  // Nastavení hodnot inputů
  if (filterDateFrom) {
    filterDateFrom.value = formatDateForInput(firstDayOfMonth);
  }
  
  if (filterDateTo) {
    filterDateTo.value = formatDateForInput(lastDayOfMonth);
  }
  
  // Výchozí osoba - všechny
  currentFilters.person = 'all';
  if (filterPersonSelect) {
    filterPersonSelect.value = 'all';
  }
}

// Formátování data pro input typu date
function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Aplikace filtrů na pracovní záznamy
function applyFilters() {
  // Aktualizace hodnot filtrů
  if (filterDateFrom) {
    currentFilters.dateFrom = filterDateFrom.value ? new Date(filterDateFrom.value) : null;
  }
  
  if (filterDateTo) {
    currentFilters.dateTo = filterDateTo.value ? new Date(filterDateTo.value) : null;
    // Nastavení času na konec dne
    if (currentFilters.dateTo) {
      currentFilters.dateTo.setHours(23, 59, 59, 999);
    }
  }
  
  if (filterPersonSelect) {
    currentFilters.person = filterPersonSelect.value;
  }
  
  // Filtrování záznamů
  filteredWorkLogs = allWorkLogs.filter(workLog => {
    // Filtr podle data
    if (currentFilters.dateFrom && workLog.date < currentFilters.dateFrom) {
      return false;
    }
    
    if (currentFilters.dateTo && workLog.date > currentFilters.dateTo) {
      return false;
    }
    
    // Filtr podle osoby
    if (currentFilters.person !== 'all' && workLog.person !== currentFilters.person) {
      return false;
    }
    
    return true;
  });
  
  // Seřazení podle data (od nejnovějšího)
  filteredWorkLogs.sort((a, b) => b.date - a.date);
  
  // Aktualizace tabulky, souhrnu a grafu
  renderWorkLogsTable();
  renderWorkLogsSummary();
  renderWorkLogsChart();
}

// Zobrazení tabulky pracovních záznamů
function renderWorkLogsTable() {
  if (!workLogsTable) return;
  
  // Vyčištění tabulky
  workLogsTable.innerHTML = '';
  
  // Kontrola, zda jsou nějaké záznamy
  if (filteredWorkLogs.length === 0) {
    workLogsTable.innerHTML = '<tr><td colspan="7" class="text-center py-4">Žádné záznamy k zobrazení</td></tr>';
    return;
  }
  
  // Vytvoření řádků tabulky
  filteredWorkLogs.forEach(workLog => {
    const row = document.createElement('tr');
    row.className = 'border-b hover:bg-gray-50';
    
    // Formátování data
    const dateFormatted = new Date(workLog.date).toLocaleDateString('cs-CZ');
    
    // Formátování částky
    const amountFormatted = new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0
    }).format(workLog.amount);
    
    // Vytvoření buněk
    row.innerHTML = `
      <td class="py-2 px-4">${dateFormatted}</td>
      <td class="py-2 px-4">${workLog.person || '-'}</td>
      <td class="py-2 px-4">${workLog.hours.toFixed(2)}</td>
      <td class="py-2 px-4">${workLog.hourlyRate}</td>
      <td class="py-2 px-4">${amountFormatted}</td>
      <td class="py-2 px-4">${workLog.description || '-'}</td>
      <td class="py-2 px-4 flex gap-2">
        <button class="edit-worklog text-blue-500 hover:text-blue-700" data-id="${workLog.id}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button class="delete-worklog text-red-500 hover:text-red-700" data-id="${workLog.id}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    `;
    
    // Přidání event listenerů na tlačítka
    row.querySelector('.edit-worklog').addEventListener('click', () => editWorkLog(workLog.id));
    row.querySelector('.delete-worklog').addEventListener('click', () => deleteWorkLog(workLog.id));
    
    // Přidání řádku do tabulky
    workLogsTable.appendChild(row);
  });
}

// Zobrazení souhrnu pracovních záznamů
function renderWorkLogsSummary() {
  if (!workLogsSummary) return;
  
  // Výpočet souhrnných hodnot
  const totalHours = filteredWorkLogs.reduce((total, workLog) => total + workLog.hours, 0);
  const totalAmount = filteredWorkLogs.reduce((total, workLog) => total + workLog.amount, 0);
  
  // Seskupení podle osoby
  const personStats = {};
  filteredWorkLogs.forEach(workLog => {
    const person = workLog.person || 'Neurčeno';
    if (!personStats[person]) {
      personStats[person] = {
        hours: 0,
        amount: 0
      };
    }
    personStats[person].hours += workLog.hours;
    personStats[person].amount += workLog.amount;
  });
  
  // Formátování částky
  const totalAmountFormatted = new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0
  }).format(totalAmount);
  
  // Vytvoření HTML pro souhrn
  let summaryHTML = `
    <div class="mb-4">
      <h3 class="font-bold text-lg">Celkový souhrn</h3>
      <p>Počet záznamů: <span class="font-medium">${filteredWorkLogs.length}</span></p>
      <p>Celkem hodin: <span class="font-medium">${totalHours.toFixed(2)}</span></p>
      <p>Celková částka: <span class="font-medium">${totalAmountFormatted}</span></p>
    </div>
  `;
  
  // Přidání statistik podle osoby
  if (Object.keys(personStats).length > 1) {
    summaryHTML += '<div class="mb-4"><h3 class="font-bold text-lg">Podle osoby</h3>';
    
    Object.keys(personStats).forEach(person => {
      const stats = personStats[person];
      const amountFormatted = new Intl.NumberFormat('cs-CZ', {
        style: 'currency',
        currency: 'CZK',
        minimumFractionDigits: 0
      }).format(stats.amount);
      
      summaryHTML += `
        <div class="mb-2">
          <h4 class="font-medium">${person}</h4>
          <p>Celkem hodin: ${stats.hours.toFixed(2)}</p>
          <p>Celková částka: ${amountFormatted}</p>
        </div>
      `;
    });
    
    summaryHTML += '</div>';
  }
  
  // Aktualizace souhrnu
  workLogsSummary.innerHTML = summaryHTML;
}

// Zobrazení grafu pracovních záznamů
function renderWorkLogsChart() {
  if (!workLogsChart) return;
  
  // Kontrola, zda jsou nějaké záznamy
  if (filteredWorkLogs.length === 0) {
    workLogsChart.innerHTML = '<p class="text-center py-4">Žádná data pro zobrazení grafu</p>';
    return;
  }
  
  // Seskupení podle měsíce
  const monthlyData = {};
  
  filteredWorkLogs.forEach(workLog => {
    const date = new Date(workLog.date);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const key = `${year}-${month.toString().padStart(2, '0')}`;
    
    if (!monthlyData[key]) {
      monthlyData[key] = {
        label: `${month}/${year}`,
        amount: 0,
        hours: 0,
        persons: {}
      };
    }
    
    monthlyData[key].amount += workLog.amount;
    monthlyData[key].hours += workLog.hours;
    
    // Seskupení podle osoby
    const person = workLog.person || 'Neurčeno';
    if (!monthlyData[key].persons[person]) {
      monthlyData[key].persons[person] = {
        amount: 0,
        hours: 0
      };
    }
    
    monthlyData[key].persons[person].amount += workLog.amount;
    monthlyData[key].persons[person].hours += workLog.hours;
  });
  
  // Převod na pole a seřazení podle data
  const chartData = Object.values(monthlyData).sort((a, b) => {
    const [yearA, monthA] = a.label.split('/');
    const [yearB, monthB] = b.label.split('/');
    return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
  });
  
  // Vykreslení grafu pomocí Chart.js
  workLogsChart.innerHTML = '<canvas id="monthly-chart" width="400" height="200"></canvas>';
  const canvas = document.getElementById('monthly-chart');
  
  // Kontrola, zda existuje knihovna Chart
  if (!window.Chart) {
    console.error('Knihovna Chart.js není načtena');
    workLogsChart.innerHTML = '<p class="text-center py-4">Graf nelze zobrazit - chybí Chart.js</p>';
    return;
  }
  
  // Zničení předchozího grafu, pokud existuje
  if (window.monthlyChart) {
    window.monthlyChart.destroy();
  }
  
  // Vytvoření datové sady pro graf
  const labels = chartData.map(item => item.label);
  const datasets = [];
  
  // Kontrola, zda používáme filtraci podle osoby
  if (currentFilters.person === 'all') {
    // Zjištění všech osob
    const allPersons = new Set();
    chartData.forEach(item => {
      Object.keys(item.persons).forEach(person => {
        allPersons.add(person);
      });
    });
    
    // Vytvoření datové sady pro každou osobu
    const colors = ['#4C51BF', '#38B2AC', '#ED8936', '#9B2C2C', '#702459'];
    let colorIndex = 0;
    
    allPersons.forEach(person => {
      const color = colors[colorIndex % colors.length];
      colorIndex++;
      
      datasets.push({
        label: person,
        data: chartData.map(item => {
          return item.persons[person] ? item.persons[person].amount : 0;
        }),
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1
      });
    });
  } else {
    // Pouze jedna osoba - jednodušší graf
    datasets.push({
      label: 'Částka (Kč)',
      data: chartData.map(item => item.amount),
      backgroundColor: '#4C51BF',
      borderColor: '#4C51BF',
      borderWidth: 1
    });
  }
  
  // Vytvoření grafu
  window.monthlyChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
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
              return `${context.dataset.label}: ${value.toLocaleString('cs-CZ')} Kč`;
            }
          }
        }
      }
    }
  });
}

// Úprava pracovního záznamu
async function editWorkLog(id) {
  // Nalezení záznamu
  const workLog = allWorkLogs.find(log => log.id === id);
  if (!workLog) {
    console.error('Pracovní záznam nebyl nalezen:', id);
    return;
  }
  
  // Vytvoření modal dialogu pro úpravu
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  
  // Formátování data pro input
  const dateFormatted = formatDateForInput(new Date(workLog.date));
  
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <h3 class="text-xl font-bold mb-4">Úprava záznamu</h3>
      
      <div class="mb-4">
        <label class="block text-gray-700 mb-2" for="edit-date">Datum</label>
        <input type="date" id="edit-date" class="w-full px-3 py-2 border rounded" value="${dateFormatted}">
      </div>
      
      <div class="mb-4">
        <label class="block text-gray-700 mb-2" for="edit-person">Osoba</label>
        <select id="edit-person" class="w-full px-3 py-2 border rounded">
          <option value="Marty" ${workLog.person === 'Marty' ? 'selected' : ''}>Marty</option>
          <option value="Maru" ${workLog.person === 'Maru' ? 'selected' : ''}>Maru</option>
        </select>
      </div>
      
      <div class="mb-4">
        <label class="block text-gray-700 mb-2" for="edit-hours">Hodiny</label>
        <input type="number" id="edit-hours" class="w-full px-3 py-2 border rounded" step="0.01" min="0" value="${workLog.hours}">
      </div>
      
      <div class="mb-4">
        <label class="block text-gray-700 mb-2" for="edit-hourly-rate">Hodinová sazba</label>
        <input type="number" id="edit-hourly-rate" class="w-full px-3 py-2 border rounded" min="0" value="${workLog.hourlyRate}">
      </div>
      
      <div class="mb-4">
        <label class="block text-gray-700 mb-2" for="edit-description">Popis</label>
        <input type="text" id="edit-description" class="w-full px-3 py-2 border rounded" value="${workLog.description || ''}">
      </div>
      
      <div class="flex justify-end gap-2">
        <button id="cancel-edit" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Zrušit</button>
        <button id="save-edit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Uložit</button>
      </div>
    </div>
  `;
  
  // Přidání modalu do dokumentu
  document.body.appendChild(modal);
  
  // Přidání event listenerů
  document.getElementById('cancel-edit').addEventListener('click', () => {
    modal.remove();
  });
  
  document.getElementById('save-edit').addEventListener('click', async () => {
    try {
      // Získání hodnot
      const date = new Date(document.getElementById('edit-date').value);
      const person = document.getElementById('edit-person').value;
      const hours = parseFloat(document.getElementById('edit-hours').value);
      const hourlyRate = parseInt(document.getElementById('edit-hourly-rate').value);
      const description = document.getElementById('edit-description').value.trim();
      
      // Kontrola hodnot
      if (isNaN(date.getTime())) {
        showNotification('Zadejte platné datum', 'error');
        return;
      }
      
      if (isNaN(hours) || hours <= 0) {
        showNotification('Zadejte platný počet hodin', 'error');
        return;
      }
      
      if (isNaN(hourlyRate) || hourlyRate <= 0) {
        showNotification('Zadejte platnou hodinovou sazbu', 'error');
        return;
      }
      
      // Výpočet částky
      const amount = Math.round(hours * hourlyRate);
      
      // Aktualizace záznamu
      const updatedWorkLog = {
        ...workLog,
        date,
        person,
        hours,
        hourlyRate,
        amount,
        description
      };
      
      await workLogsService.update(id, updatedWorkLog);
      
      // Odstranění modalu
      modal.remove();
      
      // Aktualizace seznamu
      await loadWorkLogs();
      
      // Zobrazení notifikace
      showNotification('Záznam byl úspěšně aktualizován', 'success');
    } catch (error) {
      console.error('Chyba při aktualizaci záznamu:', error);
      showNotification('Chyba při aktualizaci záznamu', 'error');
    }
  });
}

// Smazání pracovního záznamu
async function deleteWorkLog(id) {
  // Potvrzení
  if (!confirm('Opravdu chcete smazat tento záznam?')) {
    return;
  }
  
  try {
    await workLogsService.delete(id);
    
    // Aktualizace seznamu
    await loadWorkLogs();
    
    // Zobrazení notifikace
    showNotification('Záznam byl úspěšně smazán', 'success');
  } catch (error) {
    console.error('Chyba při mazání záznamu:', error);
    showNotification('Chyba při mazání záznamu', 'error');
  }
}

// Export do CSV
function exportToCSV() {
  // Kontrola, zda jsou nějaké záznamy
  if (filteredWorkLogs.length === 0) {
    showNotification('Žádné záznamy k exportu', 'error');
    return;
  }
  
  // Příprava dat
  const csvContent = filteredWorkLogs.map(workLog => {
    const date = new Date(workLog.date).toLocaleDateString('cs-CZ');
    return [
      date,
      workLog.person || '',
      workLog.hours.toFixed(2),
      workLog.hourlyRate,
      workLog.amount,
      workLog.description || ''
    ].join(',');
  });
  
  // Přidání hlavičky
  csvContent.unshift('Datum,Osoba,Hodiny,Sazba,Částka,Popis');
  
  // Vytvoření Blob
  const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
  
  // Vytvoření odkazu
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `worklogs-export-${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.display = 'none';
  
  // Přidání odkazu do dokumentu
  document.body.appendChild(link);
  
  // Kliknutí na odkaz
  link.click();
  
  // Odstranění odkazu
  document.body.removeChild(link);
  
  // Zobrazení notifikace
  showNotification('Export byl úspěšně vytvořen', 'success');
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

// Export funkcí pro použití v jiných souborech
export { loadWorkLogs as updateWorkLogsList };