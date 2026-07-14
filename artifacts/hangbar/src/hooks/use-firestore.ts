import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  QueryConstraint,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useCollection<T>(path: string, constraints: QueryConstraint[] = []) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, path), ...constraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const result = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      setData(result);
      setLoading(false);
    }, (error: any) => {
      console.error(`[FIRESTORE] ❌ onSnapshot collection "${path}" FAILED`);
      console.error('[FIRESTORE]    code   :', error?.code    ?? 'no-code');
      console.error('[FIRESTORE]    message:', error?.message ?? String(error));
      console.error('[FIRESTORE]    stack  :', error?.stack);
      setLoading(false);
    });

    return unsubscribe;
  }, [path, JSON.stringify(constraints.map(c => c.type))]); // Simple deps handling

  const add = async (data: any) => {
    return await addDoc(collection(db, path), {
      ...data,
      createdAt: serverTimestamp()
    });
  };

  const update = async (id: string, data: any) => {
    const ref = doc(db, path, id);
    return await updateDoc(ref, data);
  };

  const remove = async (id: string) => {
    const ref = doc(db, path, id);
    return await deleteDoc(ref);
  };

  return { data, loading, add, update, remove };
}

export function useDocument<T>(path: string, id: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(doc(db, path, id), (docSnap) => {
      if (docSnap.exists()) {
        setData({ id: docSnap.id, ...docSnap.data() } as T);
      } else {
        setData(null);
      }
      setLoading(false);
    }, (error: any) => {
      console.error(`[FIRESTORE] ❌ onSnapshot document "${path}/${id}" FAILED`);
      console.error('[FIRESTORE]    code   :', error?.code    ?? 'no-code');
      console.error('[FIRESTORE]    message:', error?.message ?? String(error));
      console.error('[FIRESTORE]    stack  :', error?.stack);
      setLoading(false);
    });

    return unsubscribe;
  }, [path, id]);

  const update = async (data: any) => {
    if (!id) throw new Error('Belge kimliği eksik — güncelleme yapılamadı');
    const ref = doc(db, path, id);
    return await updateDoc(ref, data);
  };

  return { data, loading, update };
}
