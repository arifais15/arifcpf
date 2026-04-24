'use client';

import { useState, useEffect } from 'react';
import { USE_LOCAL_DB } from '@/firebase';
import { localDB } from '@/firebase/local-db-service';
import { onSnapshot, CollectionReference, Query, DocumentData, QuerySnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: any | null;
}

export function useCollection<T = any>(
  memoizedTargetRefOrQuery: any
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      return;
    }

    if (USE_LOCAL_DB) {
      const syncLocal = () => {
        const path = typeof memoizedTargetRefOrQuery === 'string' 
          ? memoizedTargetRefOrQuery 
          : memoizedTargetRefOrQuery.path || memoizedTargetRefOrQuery._query?.path?.canonicalString() || '';
        
        // Custom handling for the way collectionGroup is passed in the app
        const effectivePath = memoizedTargetRefOrQuery?.type === 'collection' ? memoizedTargetRefOrQuery.path : path;
        
        const results = localDB.getCollection(effectivePath || path);
        setData(results as WithId<T>[]);
        setIsLoading(false);
      };

      syncLocal();
      window.addEventListener('storage', syncLocal);
      return () => window.removeEventListener('storage', syncLocal);
    }

    // Standard Firestore Real-time Listener
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: WithId<T>[] = [];
        snapshot.forEach(doc => results.push({ ...(doc.data() as T), id: doc.id }));
        setData(results);
        setIsLoading(false);
      },
      async (serverError) => {
        const path = (memoizedTargetRefOrQuery as any).path || (memoizedTargetRefOrQuery as any)._query?.path?.canonicalString() || 'unknown';
        const permissionError = new FirestorePermissionError({
          path,
          operation: 'list',
        } satisfies SecurityRuleContext);

        errorEmitter.emit('permission-error', permissionError);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error: null };
}
