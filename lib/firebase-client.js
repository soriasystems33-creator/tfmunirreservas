import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Proyecto Firebase TFM UNIR — independiente de Frida Nails
const firebaseConfig = {
  apiKey: "AIzaSyAb2Dp88yigDc7Pui_p_0SfSsNqF9SYghI",
  authDomain: "tfm-unir-3ce48.firebaseapp.com",
  projectId: "tfm-unir-3ce48",
  storageBucket: "tfm-unir-3ce48.firebasestorage.app",
  messagingSenderId: "277423950766",
  appId: "1:277423950766:web:e79790aa22a7c1f833963f",
  measurementId: "G-BC81DNVP6S"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

const auth = getAuth(app);
signInAnonymously(auth).catch(() => {});
