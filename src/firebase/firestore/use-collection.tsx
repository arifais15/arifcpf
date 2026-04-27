'use client';

import { useState, useEffect, useCallback } from 'react';
import { USE_LOCAL_DB } from '@/firebase';
import { serverGetCollection } from '@/app/actions/db-actions';
import { onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
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

  const syncLocal = useCallback(async () => {
    if (!memoizedTargetRefOrQuery) return;
    
    let path = "";
    if (typeof memoizedTargetRefOrQuery === 'string') {
      path = memoizedTargetRefOrQuery;
    } else if (memoizedTargetRefOrQuery.path) {
      path = memoizedTargetRefOrQuery.path;
    } else if (memoizedTargetRefOrQuery._query) {
      path = memoizedTargetRefOrQuery._query.collectionGroup || (memoizedTargetRefOrQuery._query.path?.segments || []).join('/');
    }
    
    try {
      const results = await serverGetCollection(path);
      setData(results as WithId<T>[]);
    } catch (e) {
      console.error("Local sync failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, [memoizedTargetRefOrQuery]);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
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
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: WithId<T>[] = [];
        snapshot.forEach(doc => results.push({ ...(doc.data() as T), id: doc.id }));
        setData(results);
        setIsLoading(false);
      },
      async (serverError) => {
        const path = (memoizedTargetRefOrQuery as any).path || (memoizedTargetRefOrQuery as any)._query?.path?.canonicalString() || 'unknown';
        const permissionError = new FirestorePermissionError({ path, operation: 'list' } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery, syncLocal]);

  return { data, isLoading, error: null };
}
