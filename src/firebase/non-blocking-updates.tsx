'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs as firebaseGetDocs,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { USE_LOCAL_DB } from '@/firebase';
import { localDB } from '@/firebase/local-db-service';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * Statutory Persistence Layer - Supports both Cloud and Local-Matrix modes.
 * Features automated query mapping for 100% offline filtering/sorting.
 */

export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions = {}) {
  if (USE_LOCAL_DB) {
    localDB.setDoc(docRef.path, data, options);
    return;
  }
  setDoc(docRef, data, options).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: options && 'merge' in options ? 'update' : 'create',
      requestResourceData: data,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });
}

export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  if (USE_LOCAL_DB) {
    const result = localDB.addDoc(colRef.path, data);
    return Promise.resolve(result);
  }
  return addDoc(colRef, data).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: colRef.path,
      operation: 'create',
      requestResourceData: data,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });
}

export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  if (USE_LOCAL_DB) {
    localDB.setDoc(docRef.path, data, { merge: true });
    return;
  }
  updateDoc(docRef, data).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: data,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });
}

export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  if (USE_LOCAL_DB) {
    localDB.deleteDoc(docRef.path);
    return;
  }
  deleteDoc(docRef).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });
}

/**
 * Institutional Query Reconciler
 * Bridging Firestore Queries to PC Local Storage Matrix with filter resolution.
 */
export async function getDocuments(target: any) {
  if (USE_LOCAL_DB) {
    let path = "";
    let filterField = "";
    let filterValue: any = null;
    let filterOp = "==";
    let sortField = "";

    if (typeof target === 'string') {
      path = target;
    } else if (target.path) {
      path = target.path;
    } else if (target._query) {
      const queryObj = target._query;
      // Extract path for both standard and collectionGroup queries
      path = queryObj.collectionGroup || (queryObj.path?.segments || []).join('/');
      
      const filters = queryObj.filters || [];
      if (filters.length > 0) {
        // Robust internal filter parsing across multiple SDK versions
        const firstFilter = filters[0];
        
        // 1. Identify Field Name
        filterField = firstFilter.field?.segments?.[0] || 
                      firstFilter.left?.field?.segments?.[0] || 
                      "";
        
        // 2. Identify Operator
        filterOp = firstFilter.op || firstFilter.operator || "==";
        
        // 3. Robust Multi-path value extraction
        // Handles nested objects (internalValue) and raw constants
        const extractVal = (v: any) => {
          if (v === null || v === undefined) return null;
          if (typeof v !== 'object') return v;
          return v.internalValue ?? v.value?.internalValue ?? v.constantValue ?? v;
        };

        const rawVal = firstFilter.value ?? firstFilter.right?.value;
        filterValue = extractVal(rawVal);
      }

      const orders = queryObj.explicitOrderBy || [];
      if (orders.length > 0) {
        sortField = orders[0].field?.segments?.[0] || "";
      }
    }

    const sanitizedPath = path.replace(/^\/|\/$/g, '');
    let data = localDB.getCollection(sanitizedPath);
    
    // Automated Filtering Matrix
    if (filterField && filterValue !== null && filterValue !== undefined) {
      data = data.filter(d => {
        const val = d[filterField];
        const stringVal = String(val);
        const stringFilter = String(filterValue);

        if (filterOp === '>=') return stringVal >= stringFilter;
        if (filterOp === '<') return stringVal < stringFilter;
        if (filterOp === '==' || filterOp === 'equal') return stringVal === stringFilter;
        return true;
      });
    }

    // Automated Sorting Chronology
    if (sortField) {
      data.sort((a, b) => String(a[sortField]).localeCompare(String(b[sortField])));
    }
    
    return {
      empty: data.length === 0,
      docs: data.map(d => ({ 
        id: d.id, 
        data: () => d, 
        exists: () => true, 
        ref: { path: d._path } 
      })),
      forEach: (cb: (doc: any) => void) => data.forEach(d => cb({ 
        id: d.id, 
        data: () => d, 
        exists: () => true, 
        ref: { path: d._path } 
      }))
    };
  }
  
  try {
    return await firebaseGetDocs(target);
  } catch (e: any) {
    const path = (target as any).path || (target as any)._query?.path?.canonicalString() || 'unknown';
    const permissionError = new FirestorePermissionError({ path, operation: 'list' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw e;
  }
}
