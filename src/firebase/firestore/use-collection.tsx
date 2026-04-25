'use client';

import { useState, useEffect } from 'react';
import { USE_LOCAL_DB } from '@/firebase';
import { localDB } from '@/firebase/local-db-service';
import { onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: any | null;
}

/**
 * Institutional Hook Wrapper - Seamlessly bridges Cloud and Local storage.
 * Automates data fetching for both collectionGroup and standard collections.
 */
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
        // Query Object Parsing Logic
        let path = "";
        let filterField = "";
        let filterValue: any = null;
        let filterOp = "==";
        let sortField = "";

        if (typeof memoizedTargetRefOrQuery === 'string') {
          path = memoizedTargetRefOrQuery;
        } else if (memoizedTargetRefOrQuery.path) {
          path = memoizedTargetRefOrQuery.path;
        } else if (memoizedTargetRefOrQuery._query) {
          path = memoizedTargetRefOrQuery._query.collectionGroup || memoizedTargetRefOrQuery._query.path.segments.join('/');
          
          const filters = memoizedTargetRefOrQuery._query.filters || [];
          if (filters.length > 0) {
            filterField = filters[0].field?.segments?.[0] || "";
            filterValue = filters[0].value?.internalValue;
            filterOp = filters[0].op || "==";
          }

          const orders = memoizedTargetRefOrQuery._query.explicitOrderBy || [];
          if (orders.length > 0) sortField = orders[0].field?.segments?.[0] || "";
        }
        
        const sanitizedPath = path.replace(/^\/|\/$/g, '');
        let results = localDB.getCollection(sanitizedPath);

        // Automated Filter Bridging
        if (filterField && filterValue !== null) {
          results = results.filter(d => {
            const val = d[filterField];
            if (filterOp === '>=') return String(val) >= String(filterValue);
            if (filterOp === '<') return String(val) < String(filterValue);
            return String(val) === String(filterValue);
          });
        }

        // Automated Sort Bridging
        if (sortField) {
          results.sort((a, b) => String(a[sortField]).localeCompare(String(b[sortField])));
        }

        setData(results as WithId<T>[]);
        setIsLoading(false);
      };

      syncLocal();
      window.addEventListener('storage', syncLocal);
      return () => window.removeEventListener('storage', syncLocal);
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
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error: null };
}
