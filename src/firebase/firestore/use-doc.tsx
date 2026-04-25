
'use client';

import { useState, useEffect } from 'react';
import { USE_LOCAL_DB } from '@/firebase';
import { serverGetDoc } from '@/app/actions/db-actions';
import { onSnapshot, DocumentReference, DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

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
      const syncLocal = async () => {
        const path = memoizedDocRef.path;
        const result = await serverGetDoc(path);
        setData(result ? { ...result, id: memoizedDocRef.id } as WithId<T> : null);
        setIsLoading(false);
      };

      syncLocal();
      return;
    }

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        setData(snapshot.exists() ? { ...(snapshot.data() as T), id: snapshot.id } : null);
        setIsLoading(false);
      },
      async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: memoizedDocRef.path,
          operation: 'get',
        } satisfies SecurityRuleContext);

        errorEmitter.emit('permission-error', permissionError);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef]);

  return { data, isLoading, error: null };
}
