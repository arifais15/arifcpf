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
      // Robust Query Inspection for Collection Groups
      const queryObj = target._query;
      path = queryObj.collectionGroup || (queryObj.path?.segments || []).join('/');
      
      const filters = queryObj.filters || [];
      if (filters.length > 0) {
        // Handle both simple and complex filter structures
        const firstFilter = filters[0];
        filterField = firstFilter.field?.segments?.[0] || firstFilter.left?.field?.segments?.[0] || "";
        filterValue = firstFilter.value?.internalValue ?? firstFilter.right?.value?.internalValue;
        filterOp = firstFilter.op || firstFilter.operator || "==";
      }

      const orders = queryObj.explicitOrderBy || [];
      if (orders.length > 0) {
        sortField = orders[0].field?.segments?.[0] || "";
      }
    }

    const sanitizedPath = path.replace(/^\/|\/$/g, '');
    let data = localDB.getCollection(sanitizedPath);
    
    // Automated Filtering Logic
    if (filterField && filterValue !== null) {
      data = data.filter(d => {
        const val = d[filterField];
        if (filterOp === '>=') return String(val) >= String(filterValue);
        if (filterOp === '<') return String(val) < String(filterValue);
        return String(val) === String(filterValue);
      });
    }

    // Automated Sorting
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
