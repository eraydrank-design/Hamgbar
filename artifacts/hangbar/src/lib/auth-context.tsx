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
  firestoreError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signOut: async () => {},
  firestoreError: null,
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
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

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
      setFirestoreError(null);
      try {
        console.log('[AUTH DEBUG] Calling getDoc for uid:', firebaseUser.uid);
        const existing = await withTimeout(getDoc(userDocRef), 5000);
        console.log('[AUTH DEBUG] getDoc resolved — exists:', existing.exists());

        if (!existing.exists()) {
          // New user — write full profile seeded from Firebase Auth.
          console.log('[AUTH DEBUG] New user — calling setDoc (full profile)');
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
          console.log('[AUTH DEBUG] setDoc (new user) completed');
        } else {
          // Existing user — only sync auth-managed fields, never touch
          // displayName / photoURL / username / bio (user may have edited them).
          console.log('[AUTH DEBUG] Existing user — calling setDoc (merge: true)');
          await withTimeout(
            setDoc(
              userDocRef,
              { uid: firebaseUser.uid, email: firebaseUser.email ?? null, role: assignedRole },
              { merge: true },
            ),
            5000,
          );
          console.log('[AUTH DEBUG] setDoc (existing user merge) completed');
        }
      } catch (err: any) {
        const code    = err?.code    ?? 'no-code';
        const message = err?.message ?? String(err);
        console.error('[AUTH DEBUG] ❌ Firestore upsert FAILED');
        console.error('[AUTH DEBUG]    code   :', code);
        console.error('[AUTH DEBUG]    message:', message);
        console.error('[AUTH DEBUG]    stack  :', err?.stack);
        setFirestoreError(`[${code}] ${message}`);
        setLoading(false);
        return; // stop — do not attach the onSnapshot listener on a broken DB
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
        (err: any) => {
          const code    = err?.code    ?? 'no-code';
          const message = err?.message ?? String(err);
          console.error('[AUTH DEBUG] ❌ onSnapshot user doc FAILED');
          console.error('[AUTH DEBUG]    code   :', code);
          console.error('[AUTH DEBUG]    message:', message);
          console.error('[AUTH DEBUG]    stack  :', err?.stack);
          setFirestoreError(`[onSnapshot] [${code}] ${message}`);
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
    <AuthContext.Provider value={{ user, userData, loading, signOut, firestoreError }}>
      {firestoreError && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
          background: '#7f1d1d', color: '#fecaca', fontFamily: 'monospace',
          fontSize: '13px', padding: '10px 16px', borderBottom: '2px solid #dc2626',
          display: 'flex', alignItems: 'flex-start', gap: '8px', whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          <span style={{ flexShrink: 0, fontWeight: 'bold' }}>🔥 FIREBASE ERROR</span>
          <span>{firestoreError}</span>
          <button
            onClick={() => setFirestoreError(null)}
            style={{ marginLeft: 'auto', flexShrink: 0, background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '16px' }}
          >✕</button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
