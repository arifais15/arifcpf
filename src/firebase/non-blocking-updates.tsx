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
 * Ensures that data entered on a local PC stays on that PC's drive.
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
 * Local-safe document retrieval for Institutional Portability.
 * Mirrors Firebase getDocs functionality using LocalStorage.
 * Handles basic 'where' filtering and internal 'summaryDate' sorting for interest audits.
 */
export async function getDocuments(target: any) {
  if (USE_LOCAL_DB) {
    let path = "";
    let filterField = "";
    let filterValue = "";
    let sortField = "";

    // Extract path and basic filter info from target (CollectionReference or Query)
    if (typeof target === 'string') {
      path = target;
    } else if (target.path) {
      path = target.path;
    } else if (target._query) {
      // Internal parsing of Firestore Query object for local routing
      path = target._query.path.segments.join('/');
      
      // Look for where filters
      const filters = target._query.filters || [];
      if (filters.length > 0) {
        filterField = filters[0].field?.segments?.[0] || "";
        filterValue = filters[0].value?.internalValue;
      }

      // Look for explicit sorting requirements (critical for interest audits)
      const orders = target._query.explicitOrderBy || [];
      if (orders.length > 0) {
        sortField = orders[0].field?.segments?.[0] || "";
      }
    }

    // Sanitize path (no leading/trailing slashes for local registry match)
    const sanitizedPath = path.replace(/^\/|\/$/g, '');

    let data = localDB.getCollection(sanitizedPath);
    
    // Basic filter shim for common 'where' queries
    if (filterField && filterValue !== undefined) {
      data = data.filter(d => String(d[filterField]) === String(filterValue));
    }

    // Sorting shim for audits (e.g. summaryDate asc)
    if (sortField) {
      data.sort((a, b) => String(a[sortField]).localeCompare(String(b[sortField])));
    }
    
    // Returns a shimmed QuerySnapshot compatible with map/forEach patterns
    return {
      empty: data.length === 0,
      docs: data.map(d => ({
        id: d.id,
        data: () => d,
        exists: () => true
      })),
      forEach: (cb: (doc: any) => void) => data.forEach(d => cb({ 
        id: d.id, 
        data: () => d,
        exists: () => true 
      }))
    };
  }
  
  try {
    return await firebaseGetDocs(target);
  } catch (e: any) {
    if (e.code === 'permission-denied' || e.message?.includes('permissions')) {
      const path = (target as any).path || (target as any)._query?.path?.canonicalString() || 'unknown';
      const permissionError = new FirestorePermissionError({
        path,
        operation: 'list',
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    }
    throw e;
  }
}
