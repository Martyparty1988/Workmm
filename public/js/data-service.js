// data-service.js - Služba pro práci s daty v Firestore

import { 
  db, 
  auth, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  doc, 
  deleteDoc, 
  getDoc, 
  setDoc, 
  Timestamp, 
  serverTimestamp 
} from './firebase-config.js';

// Pomocná funkce pro získání aktuálního userId
function getCurrentUserId() {
  const user = auth.currentUser;
  if (!user) throw new Error('Uživatel není přihlášen');
  return user.uid;
}

// Pomocná funkce pro převod Timestamp na datum
function timestampToDate(timestamp) {
  return timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
}

// Pomocná funkce pro převod data na Timestamp
function dateToTimestamp(date) {
  if (date instanceof Date) {
    return Timestamp.fromDate(date);
  }
  return date;
}

/**
 * Konverze objektu pro uložení do Firestore
 * - Převádí Date objekty na Timestamp
 * - Přidává userId a metadata
 */
function prepareForFirestore(data) {
  const prepared = { ...data };
  
  // Přidání userId a metadata
  prepared.userId = getCurrentUserId();
  prepared.updatedAt = serverTimestamp();
  
  // Pokud není createdAt, přidáme ho
  if (!prepared.createdAt) {
    prepared.createdAt = serverTimestamp();
  }
  
  // Převod Date objektů na Timestamp
  Object.keys(prepared).forEach(key => {
    if (prepared[key] instanceof Date) {
      prepared[key] = Timestamp.fromDate(prepared[key]);
    }
  });
  
  return prepared;
}

/**
 * Konverze objektu z Firestore pro aplikaci
 * - Převádí Timestamp na Date
 * - Odstraňuje metadata, která nepotřebujeme v aplikaci
 */
function convertFromFirestore(doc) {
  if (!doc.exists()) return null;
  
  const data = doc.data();
  const result = { ...data, id: doc.id };
  
  // Převod Timestamp na Date
  Object.keys(result).forEach(key => {
    if (result[key] instanceof Timestamp) {
      result[key] = result[key].toDate();
    }
  });
  
  return result;
}

/**
 * Konverze pole dokumentů z Firestore
 */
function convertDocsFromFirestore(querySnapshot) {
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    const result = { ...data, id: doc.id };
    
    // Převod Timestamp na Date
    Object.keys(result).forEach(key => {
      if (result[key] instanceof Timestamp) {
        result[key] = result[key].toDate();
      }
    });
    
    return result;
  });
}

/**
 * CRUD operace pro pracovní záznamy (workLogs)
 */
export const workLogsService = {
  // Přidání nového pracovního záznamu
  async add(workLog) {
    try {
      const preparedData = prepareForFirestore(workLog);
      const docRef = await addDoc(collection(db, 'workLogs'), preparedData);
      console.log('Pracovní záznam přidán s ID:', docRef.id);
      return { ...workLog, id: docRef.id };
    } catch (error) {
      console.error('Chyba při přidávání pracovního záznamu:', error);
      throw error;
    }
  },
  
  // Získání všech pracovních záznamů pro přihlášeného uživatele
  async getAll() {
    try {
      const userId = getCurrentUserId();
      const q = query(
        collection(db, 'workLogs'),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return convertDocsFromFirestore(querySnapshot);
    } catch (error) {
      console.error('Chyba při načítání pracovních záznamů:', error);
      throw error;
    }
  },
  
  // Aktualizace pracovního záznamu
  async update(id, workLog) {
    try {
      const docRef = doc(db, 'workLogs', id);
      
      // Kontrola, že záznam patří přihlášenému uživateli
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('Záznam neexistuje');
      if (docSnap.data().userId !== getCurrentUserId()) {
        throw new Error('Nemáte oprávnění upravit tento záznam');
      }
      
      const preparedData = prepareForFirestore(workLog);
      // Odstraníme createdAt, abychom ho nepřepsali
      delete preparedData.createdAt;
      
      await updateDoc(docRef, preparedData);
      console.log('Pracovní záznam aktualizován:', id);
      return { ...workLog, id };
    } catch (error) {
      console.error('Chyba při aktualizaci pracovního záznamu:', error);
      throw error;
    }
  },
  
  // Smazání pracovního záznamu
  async delete(id) {
    try {
      const docRef = doc(db, 'workLogs', id);
      
      // Kontrola, že záznam patří přihlášenému uživateli
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('Záznam neexistuje');
      if (docSnap.data().userId !== getCurrentUserId()) {
        throw new Error('Nemáte oprávnění smazat tento záznam');
      }
      
      await deleteDoc(docRef);
      console.log('Pracovní záznam smazán:', id);
      return id;
    } catch (error) {
      console.error('Chyba při mazání pracovního záznamu:', error);
      throw error;
    }
  }
};

/**
 * CRUD operace pro dluhy (debts)
 */
export const debtsService = {
  // Přidání nového dluhu
  async add(debt) {
    try {
      const preparedData = prepareForFirestore(debt);
      const docRef = await addDoc(collection(db, 'debts'), preparedData);
      console.log('Dluh přidán s ID:', docRef.id);
      return { ...debt, id: docRef.id };
    } catch (error) {
      console.error('Chyba při přidávání dluhu:', error);
      throw error;
    }
  },
  
  // Získání všech dluhů pro přihlášeného uživatele
  async getAll() {
    try {
      const userId = getCurrentUserId();
      const q = query(
        collection(db, 'debts'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return convertDocsFromFirestore(querySnapshot);
    } catch (error) {
      console.error('Chyba při načítání dluhů:', error);
      throw error;
    }
  },
  
  // Aktualizace dluhu
  async update(id, debt) {
    try {
      const docRef = doc(db, 'debts', id);
      
      // Kontrola, že dluh patří přihlášenému uživateli
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('Dluh neexistuje');
      if (docSnap.data().userId !== getCurrentUserId()) {
        throw new Error('Nemáte oprávnění upravit tento dluh');
      }
      
      const preparedData = prepareForFirestore(debt);
      // Odstraníme createdAt, abychom ho nepřepsali
      delete preparedData.createdAt;
      
      await updateDoc(docRef, preparedData);
      console.log('Dluh aktualizován:', id);
      return { ...debt, id };
    } catch (error) {
      console.error('Chyba při aktualizaci dluhu:', error);
      throw error;
    }
  },
  
  // Smazání dluhu
  async delete(id) {
    try {
      const docRef = doc(db, 'debts', id);
      
      // Kontrola, že dluh patří přihlášenému uživateli
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('Dluh neexistuje');
      if (docSnap.data().userId !== getCurrentUserId()) {
        throw new Error('Nemáte oprávnění smazat tento dluh');
      }
      
      await deleteDoc(docRef);
      console.log('Dluh smazán:', id);
      return id;
    } catch (error) {
      console.error('Chyba při mazání dluhu:', error);
      throw error;
    }
  }
};

/**
 * CRUD operace pro splátky dluhů (debtPayments)
 */
export const debtPaymentsService = {
  // Přidání nové splátky
  async add(payment) {
    try {
      const preparedData = prepareForFirestore(payment);
      const docRef = await addDoc(collection(db, 'debtPayments'), preparedData);
      console.log('Splátka přidána s ID:', docRef.id);
      return { ...payment, id: docRef.id };
    } catch (error) {
      console.error('Chyba při přidávání splátky:', error);
      throw error;
    }
  },
  
  // Získání všech splátek pro přihlášeného uživatele
  async getAll() {
    try {
      const userId = getCurrentUserId();
      const q = query(
        collection(db, 'debtPayments'),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return convertDocsFromFirestore(querySnapshot);
    } catch (error) {
      console.error('Chyba při načítání splátek:', error);
      throw error;
    }
  },
  
  // Získání splátek pro konkrétní dluh
  async getForDebt(debtId) {
    try {
      const userId = getCurrentUserId();
      const q = query(
        collection(db, 'debtPayments'),
        where('userId', '==', userId),
        where('debtId', '==', debtId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return convertDocsFromFirestore(querySnapshot);
    } catch (error) {
      console.error('Chyba při načítání splátek pro dluh:', error);
      throw error;
    }
  },
  
  // Aktualizace splátky
  async update(id, payment) {
    try {
      const docRef = doc(db, 'debtPayments', id);
      
      // Kontrola, že splátka patří přihlášenému uživateli
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('Splátka neexistuje');
      if (docSnap.data().userId !== getCurrentUserId()) {
        throw new Error('Nemáte oprávnění upravit tuto splátku');
      }
      
      const preparedData = prepareForFirestore(payment);
      // Odstraníme createdAt, abychom ho nepřepsali
      delete preparedData.createdAt;
      
      await updateDoc(docRef, preparedData);
      console.log('Splátka aktualizována:', id);
      return { ...payment, id };
    } catch (error) {
      console.error('Chyba při aktualizaci splátky:', error);
      throw error;
    }
  },
  
  // Smazání splátky
  async delete(id) {
    try {
      const docRef = doc(db, 'debtPayments', id);
      
      // Kontrola, že splátka patří přihlášenému uživateli
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('Splátka neexistuje');
      if (docSnap.data().userId !== getCurrentUserId()) {
        throw new Error('Nemáte oprávnění smazat tuto splátku');
      }
      
      await deleteDoc(docRef);
      console.log('Splátka smazána:', id);
      return id;
    } catch (error) {
      console.error('Chyba při mazání splátky:', error);
      throw error;
    }
  }
};

/**
 * CRUD operace pro nastavení (settings)
 */
export const settingsService = {
  // Získání nastavení pro přihlášeného uživatele
  async get() {
    try {
      const userId = getCurrentUserId();
      const docRef = doc(db, 'settings', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return convertFromFirestore(docSnap);
      } else {
        // Výchozí nastavení, pokud ještě neexistuje
        const defaultSettings = {
          hourlyRate: 160,
          workingHours: 8,
          workdays: [1, 2, 3, 4, 5], // 1 = pondělí, 5 = pátek
          deductionRates: {
            'Maru': 1/3, // 1/3 z výdělku
            'Marty': 1/2 // 1/2 z výdělku
          },
          monthlyRent: 24500,
          deductionsFund: 0,
          userId // Přidáme userId
        };
        
        // Uložíme výchozí nastavení
        await setDoc(docRef, prepareForFirestore(defaultSettings));
        return defaultSettings;
      }
    } catch (error) {
      console.error('Chyba při načítání nastavení:', error);
      throw error;
    }
  },
  
  // Aktualizace nastavení
  async update(settings) {
    try {
      const userId = getCurrentUserId();
      const docRef = doc(db, 'settings', userId);
      
      const preparedData = prepareForFirestore(settings);
      await setDoc(docRef, preparedData, { merge: true });
      
      console.log('Nastavení aktualizováno');
      return { ...settings, id: userId };
    } catch (error) {
      console.error('Chyba při aktualizaci nastavení:', error);
      throw error;
    }
  },
  
  // Aktualizace fondu srážek
  async updateDeductionsFund(amount) {
    try {
      const userId = getCurrentUserId();
      const docRef = doc(db, 'settings', userId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Nastavení neexistuje');
      }
      
      const settings = convertFromFirestore(docSnap);
      const currentFund = settings.deductionsFund || 0;
      const updatedFund = currentFund + amount;
      
      await updateDoc(docRef, {
        deductionsFund: updatedFund,
        updatedAt: serverTimestamp()
      });
      
      console.log('Fond srážek aktualizován:', updatedFund);
      return updatedFund;
    } catch (error) {
      console.error('Chyba při aktualizaci fondu srážek:', error);
      throw error;
    }
  }
};

/**
 * Služba pro historii fondu srážek (deductionsFundHistory)
 */
export const deductionsFundHistoryService = {
  // Přidání nového záznamu do historie fondu
  async add(record) {
    try {
      const preparedData = prepareForFirestore(record);
      const docRef = await addDoc(collection(db, 'deductionsFundHistory'), preparedData);
      console.log('Záznam historie fondu přidán s ID:', docRef.id);
      return { ...record, id: docRef.id };
    } catch (error) {
      console.error('Chyba při přidávání záznamu historie fondu:', error);
      throw error;
    }
  },
  
  // Získání historie fondu srážek pro přihlášeného uživatele
  async getAll() {
    try {
      const userId = getCurrentUserId();
      const q = query(
        collection(db, 'deductionsFundHistory'),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return convertDocsFromFirestore(querySnapshot);
    } catch (error) {
      console.error('Chyba při načítání historie fondu srážek:', error);
      throw error;
    }
  },
  
  // Získání historie fondu srážek pro konkrétní měsíc
  async getForMonth(year, month) {
    try {
      const userId = getCurrentUserId();
      
      // Vytvoření data pro první den v měsíci
      const startDate = new Date(year, month - 1, 1);
      
      // Vytvoření data pro první den následujícího měsíce
      const endDate = new Date(year, month, 1);
      
      const q = query(
        collection(db, 'deductionsFundHistory'),
        where('userId', '==', userId),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<', Timestamp.fromDate(endDate)),
        orderBy('date', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return convertDocsFromFirestore(querySnapshot);
    } catch (error) {
      console.error('Chyba při načítání historie fondu srážek pro měsíc:', error);
      throw error;
    }
  },
  
  // Získání měsíčního souhrnu historie fondu srážek
  async getMonthlySummary() {
    try {
      const allHistory = await this.getAll();
      
      // Seskupení podle měsíce a roku
      const monthlySummary = {};
      
      allHistory.forEach(record => {
        const date = new Date(record.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // Měsíce jsou indexovány od 0
        const key = `${year}-${month.toString().padStart(2, '0')}`;
        
        if (!monthlySummary[key]) {
          monthlySummary[key] = {
            year,
            month,
            deductedMaru: 0,
            deductedMarty: 0,
            rent: 0,
            debtPayments: 0,
            balance: 0,
            date: new Date(year, month - 1, 1) // První den v měsíci
          };
        }
        
        // Aktualizace souhrnu podle typu záznamu
        switch (record.type) {
          case 'deduction':
            if (record.person === 'Maru') {
              monthlySummary[key].deductedMaru += record.amount;
            } else if (record.person === 'Marty') {
              monthlySummary[key].deductedMarty += record.amount;
            }
            monthlySummary[key].balance += record.amount;
            break;
          case 'rent':
            monthlySummary[key].rent += record.amount;
            monthlySummary[key].balance -= record.amount;
            break;
          case 'debtPayment':
            monthlySummary[key].debtPayments += record.amount;
            monthlySummary[key].balance -= record.amount;
            break;
        }
      });
      
      // Převod na pole a seřazení podle data
      return Object.values(monthlySummary).sort((a, b) => b.date - a.date);
    } catch (error) {
      console.error('Chyba při načítání měsíčního souhrnu:', error);
      throw error;
    }
  }
};