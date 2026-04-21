'use client';

import { useState, useEffect } from 'react';
import { USE_LOCAL_DB } from '@/firebase';
import { localDB } from '@/firebase/local-db-service';
import { onSnapshot, DocumentReference, DocumentSnapshot, DocumentData } from 'firebase/firestore';

type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: any | null;
}

export function useDoc<T = any>(
  memoizedDocRef: any
): UseDocResult<T> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      return;
    }

    if (USE_LOCAL_DB) {
      const syncLocal = () => {
        const path = memoizedDocRef.path;
        const result = localDB.getDoc(path);
        setData(result ? { ...result, id: memoizedDocRef.id } as WithId<T> : null);
        setIsLoading(false);
      };

      syncLocal();
      window.addEventListener('storage', syncLocal);
      return () => window.removeEventListener('storage', syncLocal);
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        setData(snapshot.exists() ? { ...(snapshot.data() as T), id: snapshot.id } : null);
        setIsLoading(false);
      },
      (error) => {
        console.error("Firestore Get Error:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef]);

  return { data, isLoading, error: null };
}
