// debts-view.js - Správa dluhů a splátek

import { debtsService, debtPaymentsService, settingsService } from './data-service.js';
import { auth } from './firebase-config.js';

// Reference na HTML elementy
let debtsTable;
let debtForm;
let debtPaymentForm;
let debtDetails;
let debtsSummary;

// Aktuální dluhy a splátky
let allDebts = [];
let activeDebts = [];
let paidDebts = [];
let currentDebtId = null;
let currentDebtPayments = [];

// Inicializace správy dluhů
export async function initDebtsView() {
  // Kontrola, zda je uživatel přihlášen
  const user = auth.currentUser;
  if (!user) {
    console.error('Uživatel není přihlášen');
    return;
  }
  
  // Načtení referencí na HTML elementy
  debtsTable = document.getElementById('debts-table');
  debtForm = document.getElementById('debt-form');
  debtPaymentForm = document.getElementById('debt-payment-form');
  debtDetails = document.getElementById('debt-details');
  debtsSummary = document.getElementById('debts-summary');
  
  // Kontrola, zda byly nalezeny všechny potřebné elementy
  if (!debtsTable || !debtForm) {
    console.error('Nebyly nalezeny všechny potřebné HTML elementy pro správu dluhů');
    return;
  }
  
  // Načtení dluhů
  try {
    await loadDebts();
  } catch (error) {
    console.error('Chyba při načítání dluhů:', error);
    showNotification('Chyba při načítání dluhů', 'error');
  }
  
  // Přidání event listenerů na formulář pro přidání dluhu
  if (debtForm) {
    debtForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await addDebt();
    });
  }
  
  // Přidání event listenerů na formulář pro přidání splátky
  if (debtPaymentForm) {
    debtPaymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await addDebtPayment();
    });
  }
  
  console.log('Správa dluhů byla inicializována');
}

// Načtení dluhů z Firestore
async function loadDebts() {
  try {
    allDebts = await debtsService.getAll();
    console.log('Načteno', allDebts.length, 'dluhů');
    
    // Rozdělení na aktivní a zaplacené dluhy
    activeDebts = allDebts.filter(debt => !debt.paid);
    paidDebts = allDebts.filter(debt => debt.paid);
    
    // Zobrazení dluhů v tabulce
    renderDebtsTable();
    
    // Zobrazení souhrnu dluhů
    renderDebtsSummary();
  } catch (error) {
    console.error('Chyba při načítání dluhů:', error);
    showNotification('Chyba při načítání dluhů', 'error');
  }
}

// Zobrazení tabulky dluhů
function renderDebtsTable() {
  if (!debtsTable) return;
  
  // Vyčištění tabulky
  debtsTable.innerHTML = '';
  
  // Kontrola, zda jsou nějaké dluhy
  if (allDebts.length === 0) {
    debtsTable.innerHTML = '<tr><td colspan="5" class="text-center py-4">Žádné dluhy k zobrazení</td></tr>';
    return;
  }
  
  // Nejprve zobrazíme aktivní dluhy
  if (activeDebts.length > 0) {
    const activeSectionRow = document.createElement('tr');
    activeSectionRow.innerHTML = `<td colspan="5" class="bg-blue-100 font-bold py-2 px-4">Aktivní dluhy</td>`;
    debtsTable.appendChild(activeSectionRow);
    
    // Seřazení podle data (od nejnovějšího)
    activeDebts.sort((a, b) => b.createdAt - a.createdAt);
    
    // Vytvoření řádků pro aktivní dluhy
    activeDebts.forEach(debt => {
      const row = createDebtRow(debt);
      debtsTable.appendChild(row);
    });
  }
  
  // Poté zobrazíme zaplacené dluhy
  if (paidDebts.length > 0) {
    const paidSectionRow = document.createElement('tr');
    paidSectionRow.innerHTML = `<td colspan="5" class="bg-green-100 font-bold py-2 px-4">Zaplacené dluhy</td>`;
    debtsTable.appendChild(paidSectionRow);
    
    // Seřazení podle data (od nejnovějšího)
    paidDebts.sort((a, b) => b.createdAt - a.createdAt);
    
    // Vytvoření řádků pro zaplacené dluhy
    paidDebts.forEach(debt => {
      const row = createDebtRow(debt);
      debtsTable.appendChild(row);
    });
  }
}

// Vytvoření řádku pro dluh
function createDebtRow(debt) {
  const row = document.createElement('tr');
  row.className = 'border-b hover:bg-gray-50';
  
  // Formátování data
  const dateFormatted = new Date(debt.createdAt).toLocaleDateString('cs-CZ');
  
  // Formátování částky
  const amountFormatted = new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0
  }).format(debt.amount);
  
  // Vytvoření buněk
  row.innerHTML = `
    <td class="py-2 px-4">${dateFormatted}</td>
    <td class="py-2 px-4">${debt.description || '-'}</td>
    <td class="py-2 px-4">${amountFormatted}</td>
    <td class="py-2 px-4">${debt.paid ? '<span class="text-green-500">Zaplaceno</span>' : '<span class="text-red-500">Aktivní</span>'}</td>
    <td class="py-2 px-4 flex gap-2">
      <button class="view-debt text-blue-500 hover:text-blue-700" data-id="${debt.id}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
      <button class="edit-debt text-blue-500 hover:text-blue-700" data-id="${debt.id}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button class="delete-debt text-red-500 hover:text-red-700" data-id="${debt.id}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </td>
  `;
  
  // Přidání event listenerů na tlačítka
  row.querySelector('.view-debt').addEventListener('click', () => viewDebtDetails(debt.id));
  row.querySelector('.edit-debt').addEventListener('click', () => editDebt(debt.id));
  row.querySelector('.delete-debt').addEventListener('click', () => deleteDebt(debt.id));
  
  return row;
}

// Zobrazení souhrnu dluhů
function renderDebtsSummary() {
  if (!debtsSummary) return;
  
  // Výpočet souhrnných hodnot
  const totalActiveAmount = activeDebts.reduce((total, debt) => total + debt.amount, 0);
  const totalPaidAmount = paidDebts.reduce((total, debt) => total + debt.amount, 0);
  
  // Formátování částek
  const activeAmountFormatted = new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0
  }).format(totalActiveAmount);
  
  const paidAmountFormatted = new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0
  }).format(totalPaidAmount);
  
  const totalAmountFormatted = new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    minimumFractionDigits: 0
  }).format(totalActiveAmount + totalPaidAmount);
  
  // Vytvoření HTML pro souhrn
  const summaryHTML = `
    <div class="mb-4">
      <h3 class="font-bold text-lg">Souhrn dluhů</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        <div class="bg-red-100 p-4 rounded-lg">
          <h4 class="font-medium">Aktivní dluhy</h4>
          <p>Počet: <span class="font-medium">${activeDebts.length}</span></p>
          <p>Celková částka: <span class="font-medium">${activeAmountFormatted}</span></p>
        </div>
        <div class="bg-green-100 p-4 rounded-lg">
          <h4 class="font-medium">Zaplacené dluhy</h4>
          <p>Počet: <span class="font-medium">${paidDebts.length}</span></p>
          <p>Celková částka: <span class="font-medium">${paidAmountFormatted}</span></p>
        </div>
        <div class="bg-blue-100 p-4 rounded-lg">
          <h4 class="font-medium">Celkem</h4>
          <p>Počet: <span class="font-medium">${allDebts.length}</span></p>
          <p>Celková částka: <span class="font-medium">${totalAmountFormatted}</span></p>
        </div>
      </div>
    </div>
  `;
  
  // Aktualizace souhrnu
  debtsSummary.innerHTML = summaryHTML;
}

// Přidání nového dluhu
async function addDebt() {
  try {
    // Získání hodnot z formuláře
    const description = document.getElementById('debt-description').value.trim();
    const amount = parseInt(document.getElementById('debt-amount').value);
    
    // Kontrola vstupů
    if (!description) {
      showNotification('Zadejte popis dluhu', 'error');
      return;
    }
    
    if (isNaN(amount) || amount <= 0) {
      showNotification('Zadejte platnou částku', 'error');
      return;
    }
    
    // Vytvoření objektu dluhu
    const debt = {
      description,
      amount,
      paid: false,
      createdAt: new Date()
    };
    
    // Uložení dluhu
    await debtsService.add(debt);
    
    // Vyčištění formuláře
    document.getElementById('debt-description').value = '';
    document.getElementById('debt-amount').value = '';
    
    // Aktualizace seznamu dluhů
    await loadDebts();
    
    // Zobrazení notifikace
    showNotification('Dluh byl úspěšně přidán', 'success');
  } catch (error) {
    console.error('Chyba při přidávání dluhu:', error);
    showNotification('Chyba při přidávání dluhu', 'error');
  }
}

// Úprava dluhu
async function editDebt(id) {
  // Nalezení dluhu
  const debt = allDebts.find(d => d.id === id);
  if (!debt) {
    console.error('Dluh nebyl nalezen:', id);
    return;
  }
  
  // Vytvoření modal dialogu pro úpravu
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <h3 class="text-xl font-bold mb-4">Úprava dluhu</h3>
      
      <div class="mb-4">
        <label class="block text-gray-700 mb-2" for="edit-debt-description">Popis</label>
        <input type="text" id="edit-debt-description" class="w-full px-3 py-2 border rounded" value="${debt.description || ''}">
      </div>
      
      <div class="mb-4">
        <label class="block text-gray-700 mb-2" for="edit-debt-amount">Částka (Kč)</label>
        <input type="number" id="edit-debt-amount" class="w-full px-3 py-2 border rounded" min="0" value="${debt.amount}">
      </div>
      
      <div class="mb-4">
        <label class="block text-gray-700 mb-2" for="edit-debt-paid">Stav</label>
        <select id="edit-debt-paid" class="w-full px-3 py-2 border rounded">
          <option value="false" ${!debt.paid ? 'selected' : ''}>Aktivní</option>
          <option value="true" ${debt.paid ? 'selected' : ''}>Zaplaceno</option>
        </select>
      </div>
      
      <div class="flex justify-end gap-2">
        <button id="cancel-edit-debt" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Zrušit</button>
        <button id="save-edit-debt" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Uložit</button>
      </div>
    </div>
  `;
  
  // Přidání modalu do dokumentu
  document.body.appendChild(modal);
  
  // Přidání event listenerů
  document.getElementById('cancel-edit-debt').addEventListener('click', () => {
    modal.remove();
  });
  
  document.getElementById('save-edit-debt').addEventListener('click', async () => {
    try {
      // Získání hodnot
      const description = document.getElementById('edit-debt-description').value.trim();
      const amount = parseInt(document.getElementById('edit-debt-amount').value);
      const paid = document.getElementById('edit-debt-paid').value === 'true';
      
      // Kontrola hodnot
      if (!description) {
        showNotification('Zadejte popis dluhu', 'error');
        return;
      }
      
      if (isNaN(amount) || amount <= 0) {
        showNotification('Zadejte platnou částku', 'error');
        return;
      }
      
      // Aktualizace dluhu
      const updatedDebt = {
        ...debt,
        description,
        amount,
        paid
      };
      
      await debtsService.update(id, updatedDebt);
      
      // Odstranění modalu
      modal.remove();
      
      // Aktualizace seznamu
      await loadDebts();
      
      // Aktualizace detailů, pokud jsou zobrazeny
      if (currentDebtId === id) {
        viewDebtDetails(id);
      }
      
      // Zobrazení notifikace
      showNotification('Dluh byl úspěšně aktualizován', 'success');
    } catch (error) {
      console.error('Chyba při aktualizaci dluhu:', error);
      showNotification('Chyba při aktualizaci dluhu', 'error');
    }
  });
}

// Smazání dluhu
async function deleteDebt(id) {
  // Potvrzení
  if (!confirm('Opravdu chcete smazat tento dluh a všechny jeho splátky?')) {
    return;
  }
  
  try {
    // Získání splátek pro tento dluh
    const payments = await debtPaymentsService.getForDebt(id);
    
    // Smazání všech splátek
    for (const payment of payments) {
      await debtPaymentsService.delete(payment.id);
    }
    
    // Smazání dluhu
    await debtsService.delete(id);
    
    // Aktualizace seznamu
    await loadDebts();
    
    // Skrytí detailů, pokud byly zobrazeny
    if (currentDebtId === id && debtDetails) {
      debtDetails.innerHTML = '';
      currentDebtId = null;
    }
    
    // Zobrazení notifikace
    showNotification('Dluh byl úspěšně smazán', 'success');
  } catch (error) {
    console.error('Chyba při mazání dluhu:', error);
    showNotification('Chyba při mazání dluhu', 'error');
  }
}

// Zobrazení detailů dluhu
async function viewDebtDetails(id) {
  if (!debtDetails) return;
  
  try {
    // Uložení ID aktuálního dluhu
    currentDebtId = id;
    
    // Nalezení dluhu
    const debt = allDebts.find(d => d.id === id);
    if (!debt) {
      console.error('Dluh nebyl nalezen:', id);
      return;
    }
    
    // Načtení splátek pro tento dluh
    currentDebtPayments = await debtPaymentsService.getForDebt(id);
    console.log('Načteno', currentDebtPayments.length, 'splátek pro dluh', id);
    
    // Výpočet celkové splacené částky
    const totalPaid = currentDebtPayments.reduce((total, payment) => total + payment.amount, 0);
    const remainingAmount = debt.amount - totalPaid;
    
    // Formátování částek
    const amountFormatted = new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0
    }).format(debt.amount);
    
    const totalPaidFormatted = new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0
    }).format(totalPaid);
    
    const remainingAmountFormatted = new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0
    }).format(remainingAmount);
    
    // Výpočet procenta splacení
    const paymentPercentage = debt.amount > 0 ? Math.round((totalPaid / debt.amount) * 100) : 0;
    
    // Vytvoření HTML pro detaily
    let detailsHTML = `
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-xl font-bold mb-4">Detail dluhu</h3>
        
        <div class="mb-4">
          <p><span class="font-medium">Popis:</span> ${debt.description || '-'}</p>
          <p><span class="font-medium">Částka:</span> ${amountFormatted}</p>
          <p><span class="font-medium">Stav:</span> ${debt.paid ? '<span class="text-green-500">Zaplaceno</span>' : '<span class="text-red-500">Aktivní</span>'}</p>
          <p><span class="font-medium">Vytvořeno:</span> ${new Date(debt.createdAt).toLocaleDateString('cs-CZ')}</p>
        </div>
        
        <div class="mb-4">
          <p><span class="font-medium">Splaceno:</span> ${totalPaidFormatted} (${paymentPercentage}%)</p>
          <p><span class="font-medium">Zbývá:</span> ${remainingAmountFormatted}</p>
          
          <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
            <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${paymentPercentage}%"></div>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 class="text-xl font-bold mb-4">Přidat splátku</h3>
        
        <form id="payment-form" class="mb-4">
          <div class="mb-4">
            <label class="block text-gray-700 mb-2" for="payment-amount">Částka (Kč)</label>
            <input type="number" id="payment-amount" class="w-full px-3 py-2 border rounded" min="0" max="${remainingAmount}" required>
          </div>
          
          <div class="mb-4">
            <label class="block text-gray-700 mb-2" for="payment-date">Datum</label>
            <input type="date" id="payment-date" class="w-full px-3 py-2 border rounded" value="${new Date().toISOString().split('T')[0]}" required>
          </div>
          
          <div class="mb-4">
            <label class="block text-gray-700 mb-2" for="payment-description">Popis (volitelné)</label>
            <input type="text" id="payment-description" class="w-full px-3 py-2 border rounded">
          </div>
          
          <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Přidat splátku</button>
        </form>
      </div>
      
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-xl font-bold mb-4">Historie splátek</h3>
    `;
    
    // Seznam splátek
    if (currentDebtPayments.length === 0) {
      detailsHTML += '<p class="text-center py-4">Žádné splátky k zobrazení</p>';
    } else {
      detailsHTML += `
        <table class="w-full">
          <thead>
            <tr class="bg-gray-100">
              <th class="py-2 px-4 text-left">Datum</th>
              <th class="py-2 px-4 text-left">Částka</th>
              <th class="py-2 px-4 text-left">Popis</th>
              <th class="py-2 px-4 text-left">Akce</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      // Seřazení splátek podle data (od nejnovějšího)
      currentDebtPayments.sort((a, b) => b.date - a.date);
      
      // Přidání řádků pro splátky
      currentDebtPayments.forEach(payment => {
        const paymentDateFormatted = new Date(payment.date).toLocaleDateString('cs-CZ');
        const paymentAmountFormatted = new Intl.NumberFormat('cs-CZ', {
          style: 'currency',
          currency: 'CZK',
          minimumFractionDigits: 0
        }).format(payment.amount);
        
        detailsHTML += `
          <tr class="border-b hover:bg-gray-50">
            <td class="py-2 px-4">${paymentDateFormatted}</td>
            <td class="py-2 px-4">${paymentAmountFormatted}</td>
            <td class="py-2 px-4">${payment.description || '-'}</td>
            <td class="py-2 px-4">
              <button class="delete-payment text-red-500 hover:text-red-700" data-id="${payment.id}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </td>
          </tr>
        `;
      });
      
      detailsHTML += '</tbody></table>';
    }
    
    detailsHTML += '</div>';
    
    // Aktualizace detailů
    debtDetails.innerHTML = detailsHTML;
    
    // Přidání event listeneru na formulář pro přidání splátky
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
      paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addPayment(id);
      });
    }
    
    // Přidání event listenerů na tlačítka pro smazání splátky
    const deleteButtons = debtDetails.querySelectorAll('.delete-payment');
    deleteButtons.forEach(button => {
      button.addEventListener('click', () => deletePayment(button.getAttribute('data-id')));
    });
  } catch (error) {
    console.error('Chyba při zobrazení detailů dluhu:', error);
    showNotification('Chyba při zobrazení detailů dluhu', 'error');
  }
}

    // Přidání splátky
async function addPayment(debtId) {
  try {
    // Získání hodnot z formuláře
    const amount = parseInt(document.getElementById('payment-amount').value);
    const date = new Date(document.getElementById('payment-date').value);
    const description = document.getElementById('payment-description').value.trim();
    
    // Kontrola vstupů
    if (isNaN(amount) || amount <= 0) {
      showNotification('Zadejte platnou částku', 'error');
      return;
    }
    
    if (isNaN(date.getTime())) {
      showNotification('Zadejte platné datum', 'error');
      return;
    }
    
    // Nalezení dluhu
    const debt = allDebts.find(d => d.id === debtId);
    if (!debt) {
      console.error('Dluh nebyl nalezen:', debtId);
      return;
    }
    
    // Výpočet celkové splacené částky
    const totalPaid = currentDebtPayments.reduce((total, payment) => total + payment.amount, 0);
    const remainingAmount = debt.amount - totalPaid;
    
    // Kontrola, zda částka nepřesahuje zbývající dluh
    if (amount > remainingAmount) {
      showNotification(`Částka přesahuje zbývající dluh (${remainingAmount} Kč)`, 'error');
      return;
    }
    
    // Vytvoření objektu splátky
    const payment = {
      debtId,
      amount,
      date,
      description,
      createdAt: new Date()
    };
    
    // Uložení splátky
    await debtPaymentsService.add(payment);
    
    // Vyčištění formuláře
    document.getElementById('payment-amount').value = '';
    document.getElementById('payment-description').value = '';
    
    // Kontrola, zda je dluh zcela splacen
    const newTotalPaid = totalPaid + amount;
    if (newTotalPaid >= debt.amount) {
      // Aktualizace dluhu
      await debtsService.update(debtId, { ...debt, paid: true });
    }
    
    // Aktualizace detailů
    await viewDebtDetails(debtId);
    
    // Aktualizace seznamu dluhů
    await loadDebts();
    
    // Zobrazení notifikace
    showNotification('Splátka byla úspěšně přidána', 'success');
  } catch (error) {
    console.error('Chyba při přidávání splátky:', error);
    showNotification('Chyba při přidávání splátky', 'error');
  }
}

// Smazání splátky
async function deletePayment(paymentId) {
  // Potvrzení
  if (!confirm('Opravdu chcete smazat tuto splátku?')) {
    return;
  }
  
  try {
    // Nalezení splátky
    const payment = currentDebtPayments.find(p => p.id === paymentId);
    if (!payment) {
      console.error('Splátka nebyla nalezena:', paymentId);
      return;
    }
    
    // Smazání splátky
    await debtPaymentsService.delete(paymentId);
    
    // Aktualizace detailů
    await viewDebtDetails(currentDebtId);
    
    // Aktualizace seznamu dluhů
    await loadDebts();
    
    // Zobrazení notifikace
    showNotification('Splátka byla úspěšně smazána', 'success');
  } catch (error) {
    console.error('Chyba při mazání splátky:', error);
    showNotification('Chyba při mazání splátky', 'error');
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