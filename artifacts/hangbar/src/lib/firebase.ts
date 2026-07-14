import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ── DEBUG: log runtime config so we can see what the browser actually receives ──
console.log('[FIREBASE DEBUG] import.meta.env keys:', Object.keys(import.meta.env));
console.log('[FIREBASE DEBUG] firebaseConfig at runtime:', {
  apiKey:            firebaseConfig.apiKey            ? `${String(firebaseConfig.apiKey).slice(0, 8)}…` : 'UNDEFINED',
  authDomain:        firebaseConfig.authDomain        ?? 'UNDEFINED',
  projectId:         firebaseConfig.projectId         ?? 'UNDEFINED',
  storageBucket:     firebaseConfig.storageBucket     ?? 'UNDEFINED',
  messagingSenderId: firebaseConfig.messagingSenderId ?? 'UNDEFINED',
  appId:             firebaseConfig.appId             ? `${String(firebaseConfig.appId).slice(0, 12)}…` : 'UNDEFINED',
});

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
