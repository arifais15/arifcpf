
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
    const docId = data.id || Math.random().toString(36).substring(2, 15);
    const path = `${colRef.path}/${docId}`;
    localDB.setDoc(path, { ...data, id: docId });
    return Promise.resolve({ id: docId });
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
    if (typeof target === 'string') {
      path = target;
    } else if (target.path) {
      path = target.path;
    } else if (target._query) {
      path = target._query.collectionGroup || (target._query.path?.segments || []).join('/');
    }

    const data = await localDB.getCollection(path);
    
    return {
      empty: data.length === 0,
      docs: data.map(d => ({ 
        id: d.id, 
        data: () => d, 
        exists: () => true, 
        ref: { path: `${path}/${d.id}` } 
      })),
      forEach: (cb: (doc: any) => void) => data.forEach(d => cb({ 
        id: d.id, 
        data: () => d, 
        exists: () => true, 
        ref: { path: `${path}/${d.id}` } 
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
