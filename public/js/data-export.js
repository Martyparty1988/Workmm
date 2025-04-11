// data-export.js - Export a import dat

import { 
  workLogsService, 
  debtsService, 
  debtPaymentsService, 
  settingsService, 
  deductionsFundHistoryService 
} from './data-service.js';
import { auth } from './firebase-config.js';

/**
 * Export všech dat uživatele do JSON souboru
 */
export async function exportAllData() {
  try {
    // Kontrola, zda je uživatel přihlášen
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Uživatel není přihlášen');
    }
    
    // Načtení všech dat
    const workLogs = await workLogsService.getAll();
    const debts = await debtsService.getAll();
    const debtPayments = await debtPaymentsService.getAll();
    const settings = await settingsService.get();
    const deductionsFundHistory = await deductionsFundHistoryService.getAll();
    
    // Vytvoření objektu s exportovanými daty
    const exportData = {
      timestamp: new Date().toISOString(),
      userId: user.uid,
      userEmail: user.email,
      workLogs,
      debts,
      debtPayments,
      settings,
      deductionsFundHistory
    };
    
    // Konverze do JSON
    const jsonData = JSON.stringify(exportData, null, 2);
    
    // Vytvoření a stažení souboru
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workandpay-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Chyba při exportu dat:', error);
    throw error;
  }
}

/**
 * Import dat ze souboru JSON
 * @param {File} file - Soubor s daty k importu
 */
export async function importDataFromFile(file) {
  try {
    // Kontrola, zda je uživatel přihlášen
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Uživatel není přihlášen');
    }
    
    // Načtení a parsování souboru
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          
          // Kontrola formátu dat
          if (!jsonData.workLogs || !jsonData.debts || !jsonData.settings) {
            throw new Error('Neplatný formát souboru');
          }
          
          // Zobrazení potvrzovacího dialogu
          if (!confirm(`Chystáte se importovat data z ${jsonData.timestamp || 'neznámého data'}.\nTato akce přepíše existující data. Pokračovat?`)) {
            return resolve(false);
          }
          
          // Import nastavení
          if (jsonData.settings) {
            const newSettings = {
              ...jsonData.settings,
              userId: user.uid // Zajištění správného userId
            };
            await settingsService.update(newSettings);
          }
          
          // Import pracovních záznamů
          if (jsonData.workLogs && Array.isArray(jsonData.workLogs)) {
            for (const workLog of jsonData.workLogs) {
              // Odstranění ID a nastavení správného userId
              const { id, ...workLogData } = workLog;
              const newWorkLog = {
                ...workLogData,
                userId: user.uid,
                date: new Date(workLog.date) // Převod řetězce na Date objekt
              };
              await workLogsService.add(newWorkLog);
            }
          }
          
          // Import dluhů
          if (jsonData.debts && Array.isArray(jsonData.debts)) {
            for (const debt of jsonData.debts) {
              // Odstranění ID a nastavení správného userId
              const { id, ...debtData } = debt;
              const newDebt = {
                ...debtData,
                userId: user.uid,
                createdAt: new Date(debt.createdAt) // Převod řetězce na Date objekt
              };
              await debtsService.add(newDebt);
            }
          }
          
          // Import splátek dluhů
          if (jsonData.debtPayments && Array.isArray(jsonData.debtPayments)) {
            for (const payment of jsonData.debtPayments) {
              // Odstranění ID a nastavení správného userId
              const { id, ...paymentData } = payment;
              const newPayment = {
                ...paymentData,
                userId: user.uid,
                date: new Date(payment.date), // Převod řetězce na Date objekt
                createdAt: new Date(payment.createdAt || new Date())
              };
              await debtPaymentsService.add(newPayment);
            }
          }
          
          // Import historie fondu srážek
          if (jsonData.deductionsFundHistory && Array.isArray(jsonData.deductionsFundHistory)) {
            for (const record of jsonData.deductionsFundHistory) {
              // Odstranění ID a nastavení správného userId
              const { id, ...recordData } = record;
              const newRecord = {
                ...recordData,
                userId: user.uid,
                date: new Date(record.date), // Převod řetězce na Date objekt
                createdAt: new Date(record.createdAt || new Date())
              };
              await deductionsFundHistoryService.add(newRecord);
            }
          }
          
          resolve(true);
        } catch (error) {
          console.error('Chyba při zpracování importovaného souboru:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Chyba při čtení souboru'));
      };
      
      reader.readAsText(file);
    });
  } catch (error) {
    console.error('Chyba při importu dat:', error);
    throw error;
  }
}