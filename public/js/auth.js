// auth.js - Funkce pro přihlašování a registraci

import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from './firebase-config.js';

// Reference na HTML elementy
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const loginErrorElement = document.getElementById('login-error');
const registerErrorElement = document.getElementById('register-error');

// Přepínání mezi přihlášením a registrací
showRegisterLink?.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
});

showLoginLink?.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
});

// Funkce pro přihlášení
loginButton?.addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    showError(loginErrorElement, 'Vyplňte prosím email a heslo');
    return;
  }
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Uživatel přihlášen:', userCredential.user);
    
    // Přesměrování na hlavní stránku
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Chyba při přihlašování:', error);
    let errorMessage = 'Došlo k chybě při přihlašování';
    
    if (error.code === 'auth/invalid-email') {
      errorMessage = 'Neplatný formát emailu';
    } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      errorMessage = 'Nesprávný email nebo heslo';
    }
    
    showError(loginErrorElement, errorMessage);
  }
});

// Funkce pro registraci
registerButton?.addEventListener('click', async () => {
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  
  if (!email || !password || !confirmPassword) {
    showError(registerErrorElement, 'Vyplňte prosím všechna pole');
    return;
  }
  
  if (password !== confirmPassword) {
    showError(registerErrorElement, 'Hesla se neshodují');
    return;
  }
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Uživatel zaregistrován:', userCredential.user);
    
    // Přesměrování na hlavní stránku
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Chyba při registraci:', error);
    let errorMessage = 'Došlo k chybě při registraci';
    
    if (error.code === 'auth/invalid-email') {
      errorMessage = 'Neplatný formát emailu';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Heslo je příliš slabé (minimálně 6 znaků)';
    } else if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Email je již používán';
    }
    
    showError(registerErrorElement, errorMessage);
  }
});

// Zobrazení chybové zprávy
function showError(element, message) {
  element.textContent = message;
  element.classList.remove('hidden');
  
  // Skrytí chybové zprávy po 3 sekundách
  setTimeout(() => {
    element.classList.add('hidden');
  }, 3000);
}

// Kontrola stavu přihlášení
export function checkAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // Uživatel je přihlášen
        console.log('Přihlášený uživatel:', user.email);
        resolve(user);
      } else {
        // Uživatel není přihlášen, přesměrování na přihlášení
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = 'login.html';
        }
        resolve(null);
      }
    });
  });
}

// Funkce pro odhlášení
export async function logoutUser() {
  try {
    await signOut(auth);
    console.log('Uživatel odhlášen');
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Chyba při odhlašování:', error);
  }
}

// Kontrola stavu přihlášení při načtení stránky
document.addEventListener('DOMContentLoaded', () => {
  // Pokud jsme na přihlašovací stránce, necháme ji být
  if (window.location.pathname.includes('login.html')) {
    return;
  }
  
  // Jinak kontrolujeme, zda je uživatel přihlášen
  checkAuth();
});

// Export funkcí pro použití v jiných souborech
export { auth };