'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const syncLocal = useCallback(async () => {
    if (!memoizedDocRef) return;
    const path = memoizedDocRef.path;
    try {
      const result = await serverGetDoc(path);
      setData(result ? { ...result, id: memoizedDocRef.id } as WithId<T> : null);
    } catch (e) {
      console.error("Local doc sync failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, [memoizedDocRef]);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      return;
    }

    if (USE_LOCAL_DB) {
      setIsLoading(true);
      syncLocal();

      // Listen for global update signals to refresh UI instantly
      const handleUpdate = () => {
        syncLocal();
      };

      errorEmitter.on('data-updated', handleUpdate);
      return () => {
        errorEmitter.off('data-updated', handleUpdate);
      };
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
  }, [memoizedDocRef, syncLocal]);

  return { data, isLoading, error: null };
}
