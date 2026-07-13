import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

interface AuthContextType {
  user: User | null;
  userData: Record<string, unknown> | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signOut: async () => {},
});

/** Race a promise against a hard timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Firestore timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Wrap the entire handler so ANY error — sync or async — still
      // reaches the finally block and clears the loading spinner.
      (async () => {
        try {
          setUser(firebaseUser);

          if (firebaseUser) {
            const payload: Record<string, unknown> = {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? null,
              displayName: firebaseUser.displayName ?? 'Guest',
              photoURL: firebaseUser.photoURL ?? '',
              role: 'staff',
              createdAt: serverTimestamp(),
            };

            // Upsert the user document. merge:true creates it when absent,
            // merges it when present. setDoc writes are queued locally and
            // never throw "client is offline". Timeout guards against hangs.
            try {
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              await withTimeout(
                setDoc(userDocRef, payload, { merge: true }),
                5000,
              );
            } catch (firestoreErr) {
              console.warn(
                'Firestore upsert skipped (offline / timeout):',
                firestoreErr,
              );
              // Non-fatal — we still have the payload from Firebase Auth.
            }

            setUserData(payload);
          } else {
            setUserData(null);
          }
        } catch (err) {
          // Outer catch: something unexpected blew up (bad Firestore init,
          // network race, etc.). Log it and fall through to finally.
          console.error('AuthProvider: unexpected error in auth handler', err);
        } finally {
          // ALWAYS clear loading — this is the only place it must be set.
          setLoading(false);
        }
      })();
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserData(null);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
