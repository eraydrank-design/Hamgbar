/**
 * Firebase connectivity diagnostics.
 * Runs lightweight tests against Firestore and Storage and returns
 * exact error codes so the admin can see what needs to be configured.
 */
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage, auth } from './firebase';

export interface ServiceStatus {
  ok: boolean;
  latencyMs?: number;
  error?: string;   // Firebase error code, e.g. "permission-denied", "not-found"
  detail?: string;  // Full error message
}

export interface FirebaseStatus {
  auth: ServiceStatus;
  firestoreRead: ServiceStatus;
  firestoreWrite: ServiceStatus;
  storageWrite: ServiceStatus;
  checkedAt: Date;
}

export async function checkFirebaseStatus(): Promise<FirebaseStatus> {
  const uid = auth.currentUser?.uid;

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authStatus: ServiceStatus = uid
    ? { ok: true }
    : { ok: false, error: 'not-authenticated', detail: 'No authenticated user.' };

  // ── Firestore read ────────────────────────────────────────────────────────
  const fsReadStatus = await (async (): Promise<ServiceStatus> => {
    const t0 = Date.now();
    try {
      // Attempt to read from a well-known collection.
      await getDoc(doc(db, '__hangbar_ping__', 'status'));
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err: any) {
      // "not-found" means the doc doesn't exist but the DB is reachable.
      if (err?.code === 'not-found' || err?.message?.includes('not-found')) {
        return { ok: true, latencyMs: Date.now() - t0 };
      }
      return {
        ok: false,
        latencyMs: Date.now() - t0,
        error: err?.code ?? 'unknown',
        detail: err?.message ?? String(err),
      };
    }
  })();

  // ── Firestore write ───────────────────────────────────────────────────────
  const fsWriteStatus = await (async (): Promise<ServiceStatus> => {
    if (!uid) return { ok: false, error: 'not-authenticated' };
    const t0 = Date.now();
    const pingRef = doc(db, '__hangbar_ping__', uid);
    try {
      await setDoc(pingRef, { ts: serverTimestamp() }, { merge: true });
      await deleteDoc(pingRef);
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - t0,
        error: err?.code ?? 'unknown',
        detail: err?.message ?? String(err),
      };
    }
  })();

  // ── Storage write ─────────────────────────────────────────────────────────
  const storageStatus = await (async (): Promise<ServiceStatus> => {
    if (!uid) return { ok: false, error: 'not-authenticated' };
    const t0 = Date.now();
    const pingRef = ref(storage, `__hangbar_ping__/${uid}/ping.txt`);
    try {
      const blob = new Blob(['ping'], { type: 'text/plain' });
      await uploadBytes(pingRef, blob);
      await deleteObject(pingRef);
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - t0,
        error: err?.code ?? 'unknown',
        detail: err?.message ?? String(err),
      };
    }
  })();

  return {
    auth: authStatus,
    firestoreRead: fsReadStatus,
    firestoreWrite: fsWriteStatus,
    storageWrite: storageStatus,
    checkedAt: new Date(),
  };
}
