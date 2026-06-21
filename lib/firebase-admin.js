// Firebase CLIENT SDK para rutas API (Next.js server-side)
// Funciona porque las reglas de Firestore son públicas (allow read, write: if true)
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAb2Dp88yigDc7Pui_p_0SfSsNqF9SYghI",
  authDomain: "tfm-unir-3ce48.firebaseapp.com",
  projectId: "tfm-unir-3ce48",
  storageBucket: "tfm-unir-3ce48.firebasestorage.app",
  messagingSenderId: "277423950766",
  appId: "1:277423950766:web:e79790aa22a7c1f833963f"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

// Re-exportar helpers de Firestore para que las rutas API puedan usarlos igual
export { doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, collection, query, where };
