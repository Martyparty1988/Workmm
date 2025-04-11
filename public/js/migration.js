// migration.js - Funkce pro migraci dat z localStorage do Firestore

import { workLogsService, debtsService, debtPaymentsService, settingsService } from './data-service.js';
import { auth } from './firebase-config.js';

/**
 * Migrace dat z localStorage do Firestore
 * 
 * Tato funkce načte data z localStorage a uloží je do Firestore
 * pod aktuálně přihlášeným uživatelem.
 */
export async function migrateDataFromLocalStorage() {
  try {
    // Kontrola, zda je uživatel přihlášen
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Uživatel není přihlášen');
    }
    
    // Zobrazení potvrzovacího dialogu
    if (!confirm('Tato akce přenese všechna lokální data do cloudu. Pokračovat?')) {
      return;
    }
    
    console.log('Migrace dat z localStorage začíná...');
    
    // 1. Migrace pracovních záznamů
    const workLogs = JSON.parse(localStorage.getItem('workLogs') || '[]');
    console.log(`Nalezeno ${workLogs.length} pracovních záznamů`);
    
    for (const workLog of workLogs) {
      // Konverze dat - záleží na formátu vašich dat v localStorage
      const convertedWorkLog = {
        date: new Date(workLog.date),
        hours: workLog.hours,
        hourlyRate: workLog.hourlyRate || 160,
        amount: workLog.amount,
        description: workLog.description || 'Importovaný záznam',
        person: workLog.person || 'Marty'
      };
      
      // Uložení do Firestore
      await workLogsService.add(convertedWorkLog);
    }
    console.log(`Migrováno ${workLogs.length} pracovních záznamů`);
    
    // 2. Migrace dluhů
    const debts = JSON.parse(localStorage.getItem('debts') || '[]');
    console.log(`Nalezeno ${debts.length} dluhů`);
    
    for (const debt of debts) {
      // Konverze dat
      const convertedDebt = {
        description: debt.description,
        amount: debt.amount,
        paid: debt.paid || false,
        createdAt: debt.createdAt ? new Date(debt.createdAt) : new Date()
      };
      
      // Uložení do Firestore
      const savedDebt = await debtsService.add(convertedDebt);
      
      // 3. Migrace splátek dluhů pro tento dluh
      if (debt.id) {
        const debtPayments = JSON.parse(localStorage.getItem(`debtPayments_${debt.id}`) || '[]');
        console.log(`Nalezeno ${debtPayments.length} splátek pro dluh ${debt.id}`);
        
        for (const payment of debtPayments) {
          // Konverze dat
          const convertedPayment = {
            debtId: savedDebt.id, // Nové ID dluhu v Firestore
            amount: payment.amount,
            date: new Date(payment.date),
            description: payment.description || 'Importovaná splátka',
            createdAt: payment.createdAt ? new Date(payment.createdAt) : new Date()
          };
          
          // Uložení do Firestore
          await debtPaymentsService.add(convertedPayment);
        }
        console.log(`Migrováno ${debtPayments.length} splátek pro dluh ${debt.id}`);
      }
    }
    console.log(`Migrováno ${debts.length} dluhů`);
    
    // 4. Migrace nastavení
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    if (Object.keys(settings).length > 0) {
      console.log('Nalezeno nastavení');
      
      // Konverze dat
      const convertedSettings = {
        hourlyRate: settings.hourlyRate || 160,
        workingHours: settings.workingHours || 8,
        workdays: settings.workdays || [1, 2, 3, 4, 5],
        deductionRates: settings.deductionRates || {
          'Maru': 1/3,
          'Marty': 1/2
        },
        monthlyRent: settings.monthlyRent || 24500,
        deductionsFund: settings.deductionsFund || 0
      };
      
      // Uložení do Firestore
      await settingsService.update(convertedSettings);
      console.log('Migrováno nastavení');
    }
    
    console.log('Migrace dat z localStorage byla úspěšně dokončena');
    return true;
  } catch (error) {
    console.error('Chyba při migraci dat:', error);
    throw error;
  }
}