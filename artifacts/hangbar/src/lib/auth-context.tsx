import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore timed out after ${ms}ms`)), ms),
    ),
  ]);
}

const ADMIN_EMAILS = ['eraydrank@gmail.com'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // Holds the Firestore onSnapshot unsubscribe for the current user doc.
  const unsubDocRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Tear down previous user-doc listener on every auth state change.
      if (unsubDocRef.current) {
        unsubDocRef.current();
        unsubDocRef.current = null;
      }

      setUser(firebaseUser);

      if (!firebaseUser) {
        setUserData(null);
        setLoading(false);
        return;
      }

      // Assign role from email.
      const assignedRole = ADMIN_EMAILS.includes(
        (firebaseUser.email ?? '').toLowerCase(),
      )
        ? 'admin'
        : 'staff';

      const userDocRef = doc(db, 'users', firebaseUser.uid);

      // Only write profile fields (displayName, photoURL) for NEW users.
      // For existing users, only sync role + email so user-edited profile
      // data is never overwritten on login/refresh.
      try {
        const existing = await withTimeout(getDoc(userDocRef), 5000);
        if (!existing.exists()) {
          // New user — write full profile seeded from Firebase Auth.
          await withTimeout(
            setDoc(userDocRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? null,
              displayName: firebaseUser.displayName ?? 'Misafir',
              photoURL: firebaseUser.photoURL ?? '',
              username: '',
              role: assignedRole,
              joinedAt: serverTimestamp(),
              cocktailCount: 0,
              badges: [],
            }),
            5000,
          );
        } else {
          // Existing user — only sync auth-managed fields, never touch
          // displayName / photoURL / username / bio (user may have edited them).
          await withTimeout(
            setDoc(
              userDocRef,
              { uid: firebaseUser.uid, email: firebaseUser.email ?? null, role: assignedRole },
              { merge: true },
            ),
            5000,
          );
        }
      } catch (err) {
        console.warn('Firestore upsert skipped (offline / timeout):', err);
      }

      // Real-time listener: any Firestore write to the user doc (e.g. profile
      // edits) automatically refreshes userData everywhere in the app.
      unsubDocRef.current = onSnapshot(
        userDocRef,
        (snap) => {
          if (snap.exists()) {
            setUserData({ id: snap.id, ...snap.data() } as Record<string, unknown>);
          } else {
            setUserData(null);
          }
          setLoading(false);
        },
        (err) => {
          console.error('User doc listener error:', err);
          setLoading(false);
        },
      );
    });

    return () => {
      unsubAuth();
      if (unsubDocRef.current) unsubDocRef.current();
    };
  }, []);

  const signOut = async () => {
    if (unsubDocRef.current) {
      unsubDocRef.current();
      unsubDocRef.current = null;
    }
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
