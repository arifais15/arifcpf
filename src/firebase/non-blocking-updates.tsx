
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

/**
 * Statutory Persistence Layer - Supports both Cloud and Local-Matrix modes.
 * Ensures that data entered on a local PC stays on that PC's drive.
 */

export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions = {}) {
  if (USE_LOCAL_DB) {
    localDB.setDoc(docRef.path, data, options);
    return;
  }
  setDoc(docRef, data, options).catch(err => console.error(err));
}

export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  if (USE_LOCAL_DB) {
    const result = localDB.addDoc(colRef.path, data);
    return Promise.resolve(result);
  }
  return addDoc(colRef, data).catch(err => console.error(err));
}

export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  if (USE_LOCAL_DB) {
    localDB.setDoc(docRef.path, data, { merge: true });
    return;
  }
  updateDoc(docRef, data).catch(err => console.error(err));
}

export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  if (USE_LOCAL_DB) {
    localDB.deleteDoc(docRef.path);
    return;
  }
  deleteDoc(docRef).catch(err => console.error(err));
}

/**
 * Local-safe document retrieval for Institutional Portability.
 * Mirrors Firebase getDocs functionality using LocalStorage.
 * Handles basic 'where' filtering for Member ID Number.
 */
export async function getDocuments(target: any) {
  if (USE_LOCAL_DB) {
    let path = "";
    let filterField = "";
    let filterValue = "";

    // Extract path and basic filter info from target (CollectionReference or Query)
    if (typeof target === 'string') {
      path = target;
    } else if (target.path) {
      path = target.path;
    } else if (target._query) {
      // Internal parsing of Firestore Query object for basic filters
      path = target._query.path.canonicalString();
      const filters = target._query.filters || [];
      if (filters.length > 0) {
        filterField = filters[0].field?.segments?.[0] || "";
        filterValue = filters[0].value?.internalValue;
      }
    } else if (target.type === 'collection') {
      path = target.path;
    }

    // Default fallback for members
    if (!path && target.toString().includes('members')) path = 'members';

    let data = localDB.getCollection(path);
    
    // Basic filter shim for common 'where' queries (e.g., checking member uniqueness)
    if (filterField && filterValue !== undefined) {
      data = data.filter(d => String(d[filterField]) === String(filterValue));
    }
    
    // Returns a shimmed QuerySnapshot
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
  return firebaseGetDocs(target);
}
