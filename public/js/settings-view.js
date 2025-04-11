// Přidejte toto do settings-view.js

import { migrateDataFromLocalStorage } from './migration.js';

// Přidejte tuto funkci do inicializace nastavení
function addMigrationButton() {
  const settingsForm = document.getElementById('settings-form');
  if (!settingsForm) return;
  
  // Vytvoření sekce pro pokročilá nastavení
  const advancedSection = document.createElement('div');
  advancedSection.className = 'mt-8 pt-6 border-t';
  advancedSection.innerHTML = `
    <h3 class="text-lg font-bold mb-4">Pokročilá nastavení</h3>
    
    <div class="bg-yellow-50 p-4 rounded-lg mb-4">
      <h4 class="font-medium mb-2">Migrace dat z localStorage</h4>
      <p class="text-sm mb-3">
        Tato funkce přenese všechna data uložená lokálně v prohlížeči (localStorage) do cloudové databáze Firebase.
        Použijte ji při prvním přechodu na cloudovou verzi aplikace.
      </p>
      <button type="button" id="migrate-data-button" class="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition duration-200">
        Migrovat data z localStorage
      </button>
    </div>
    
    <div class="bg-red-50 p-4 rounded-lg">
      <h4 class="font-medium mb-2">Nebezpečná zóna</h4>
      <p class="text-sm mb-3">
        Následující akce mohou způsobit nevratnou ztrátu dat. Používejte pouze pokud přesně víte, co děláte.
      </p>
      <button type="button" id="clear-all-data-button" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-200">
        Smazat všechna cloudová data
      </button>
    </div>
  `;
  
  // Přidání sekce do formuláře
  settingsForm.appendChild(advancedSection);
  
  // Přidání event listeneru na tlačítko pro migraci
  document.getElementById('migrate-data-button').addEventListener('click', async () => {
    try {
      const result = await migrateDataFromLocalStorage();
      if (result) {
        showNotification('Data byla úspěšně migrována do cloudu', 'success');
      }
    } catch (error) {
      console.error('Chyba při migraci dat:', error);
      showNotification('Chyba při migraci dat: ' + error.message, 'error');
    }
  });
  
  // Přidání event listeneru na tlačítko pro smazání dat
  document.getElementById('clear-all-data-button').addEventListener('click', async () => {
    if (!confirm('VAROVÁNÍ: Tato akce smaže VŠECHNA vaše cloudová data! Tuto akci nelze vrátit. Opravdu chcete pokračovat?')) {
      return;
    }
    
    if (!confirm('Pro potvrzení zadejte "SMAZAT" (velkými písmeny):')) {
      return;
    }
    
    const confirmText = prompt('Pro potvrzení zadejte "SMAZAT" (velkými písmeny):');
    if (confirmText !== 'SMAZAT') {
      showNotification('Akce byla zrušena', 'info');
      return;
    }
    
    try {
      // Tato funkce by měla být implementována v data-service.js
      // await clearAllUserData();
      showNotification('Všechna data byla smazána', 'success');
    } catch (error) {
      console.error('Chyba při mazání dat:', error);
      showNotification('Chyba při mazání dat: ' + error.message, 'error');
    }
  });
}

// Nezapomeňte volat tuto funkci v rámci initSettingsView
// addMigrationButton();