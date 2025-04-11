// functions/index.js - Cloud Functions pro automatické zpracování

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Funkce pro automatické zpracování na začátku každého měsíce
exports.monthlyProcessing = functions.pubsub
  .schedule('0 0 1 * *')  // Spustí se první den v měsíci v 00:00
  .timeZone('Europe/Prague')
  .onRun(async (context) => {
    try {
      console.log('Spuštěno automatické měsíční zpracování');
      
      // Získání všech uživatelů s nastavením
      const settingsSnapshot = await db.collection('settings').get();
      
      // Pro každého uživatele provedeme zpracování
      const processingPromises = [];
      
      settingsSnapshot.forEach(doc => {
        const settings = doc.data();
        const userId = doc.id;
        
        // Přidání do pole promises pro paralelní zpracování
        processingPromises.push(processUserMonthly(userId, settings));
      });
      
      // Počkáme na dokončení všech zpracování
      await Promise.all(processingPromises);
      
      console.log('Automatické měsíční zpracování dokončeno');
      return null;
    } catch (error) {
      console.error('Chyba při automatickém měsíčním zpracování:', error);
      throw error;
    }
  });

// Funkce pro zpracování jednoho uživatele
async function processUserMonthly(userId, settings) {
  try {
    // Získání aktuálního data
    const now = admin.firestore.Timestamp.now().toDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // Zkontrolujeme, zda má uživatel fond srážek a nastavený nájem
    if (!settings.deductionsFund || !settings.monthlyRent) {
      console.log(`Uživatel ${userId} nemá nastavený fond srážek nebo nájem, přeskakuji`);
      return;
    }
    
    // 1. Odečtení nájmu z fondu srážek
    const rentAmount = settings.monthlyRent;
    let remainingFund = settings.deductionsFund;
    let actualRentPayment = 0;
    
    if (remainingFund >= rentAmount) {
      // Máme dostatek prostředků na nájem
      actualRentPayment = rentAmount;
      remainingFund -= rentAmount;
    } else {
      // Nemáme dostatek prostředků, platíme kolik můžeme
      actualRentPayment = remainingFund;
      remainingFund = 0;
    }
    
    // Aktualizace fondu srážek
    await db.collection('settings').doc(userId).update({
      deductionsFund: remainingFund,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Přidání záznamu o platbě nájmu do historie
    await db.collection('deductionsFundHistory').add({
      userId,
      type: 'rent',
      amount: actualRentPayment,
      date: admin.firestore.Timestamp.now(),
      description: `Automatická platba nájmu za ${currentMonth}/${currentYear}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Uživatel ${userId}: Nájem ve výši ${actualRentPayment} Kč zaplacen`);
    
    // 2. Pokud zbývají prostředky, automaticky splácíme dluhy
    if (remainingFund > 0) {
      // Získání aktivních dluhů seřazených podle priority (nejprve nejstarší)
      const debtsSnapshot = await db.collection('debts')
        .where('userId', '==', userId)
        .where('paid', '==', false)
        .orderBy('createdAt', 'asc')
        .get();
      
      // Procházení dluhů a jejich splácení
      for (const debtDoc of debtsSnapshot.docs) {
        if (remainingFund <= 0) break; // Došly nám prostředky
        
        const debt = debtDoc.data();
        const debtId = debtDoc.id;
        
        // Vypočítáme zbývající částku k zaplacení
        let remainingDebt = debt.amount;
        
        // Získání dosavadních splátek
        const paymentsSnapshot = await db.collection('debtPayments')
          .where('userId', '==', userId)
          .where('debtId', '==', debtId)
          .get();
        
        // Odečtení dosavadních splátek
        paymentsSnapshot.forEach(paymentDoc => {
          remainingDebt -= paymentDoc.data().amount;
        });
        
        // Pokud je dluh už zaplacen, přeskočíme ho
        if (remainingDebt <= 0) continue;
        
        // Určení částky k zaplacení
        let paymentAmount = Math.min(remainingDebt, remainingFund);
        
        // Přidání záznamu o splátce
        await db.collection('debtPayments').add({
          userId,
          debtId,
          amount: paymentAmount,
          date: admin.firestore.Timestamp.now(),
          description: `Automatická splátka z fondu srážek`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Přidání záznamu do historie fondu
        await db.collection('deductionsFundHistory').add({
          userId,
          type: 'debtPayment',
          amount: paymentAmount,
          debtId,
          date: admin.firestore.Timestamp.now(),
          description: `Automatická splátka dluhu: ${debt.description || 'Dluh'}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Aktualizace fondu srážek
        remainingFund -= paymentAmount;
        await db.collection('settings').doc(userId).update({
          deductionsFund: remainingFund,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Uživatel ${userId}: Splátka dluhu ${debtId} ve výši ${paymentAmount} Kč`);
        
        // Pokud byl dluh zcela splacen, označíme ho jako zaplacený
        if (remainingDebt - paymentAmount <= 0) {
          await db.collection('debts').doc(debtId).update({
            paid: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Uživatel ${userId}: Dluh ${debtId} byl zcela splacen`);
        }
      }
    }
    
    console.log(`Uživatel ${userId}: Měsíční zpracování dokončeno, zbývá ${remainingFund} Kč ve fondu`);
    return;
  } catch (error) {
    console.error(`Chyba při zpracování uživatele ${userId}:`, error);
    throw error;
  }
}

// Pomocná funkce pro ruční spuštění zpracování (pro testování)
exports.manualMonthlyProcessing = functions.https.onCall(async (data, context) => {
  // Kontrola, zda je uživatel přihlášen
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Funkci může spustit pouze přihlášený uživatel'
    );
  }
  
  try {
    const userId = context.auth.uid;
    
    // Získání nastavení uživatele
    const settingsDoc = await db.collection('settings').doc(userId).get();
    if (!settingsDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Nastavení uživatele nebylo nalezeno'
      );
    }
    
    const settings = settingsDoc.data();
    
    // Spuštění zpracování pro konkrétního uživatele
    await processUserMonthly(userId, settings);
    
    return { success: true, message: 'Měsíční zpracování bylo úspěšně dokončeno' };
  } catch (error) {
    console.error('Chyba při ručním spuštění měsíčního zpracování:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});