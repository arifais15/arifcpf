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
import { serverSetDoc, serverDeleteDoc, serverGetCollection } from '@/app/actions/db-actions';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * Executes a setDoc operation. In Local mode, this pushes to the project folder.
 */
export async function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions = {}) {
  if (USE_LOCAL_DB) {
    await serverSetDoc(docRef.path, data);
    errorEmitter.emit('data-updated', { path: docRef.path });
    return;
  }
  return setDoc(docRef, data, options).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: options && 'merge' in options ? 'update' : 'create',
      requestResourceData: data,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });
}

/**
 * Executes an addDoc operation. In Local mode, generates a random ID and saves to project folder.
 */
export async function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  if (USE_LOCAL_DB) {
    const docId = data.id || Math.random().toString(36).substring(2, 15);
    const path = `${colRef.path}/${docId}`;
    await serverSetDoc(path, { ...data, id: docId });
    errorEmitter.emit('data-updated', { path: colRef.path });
    return { id: docId };
  }
  return addDoc(colRef, data).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: colRef.path,
      operation: 'create',
      requestResourceData: data,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    return null;
  });
}

/**
 * Executes an updateDoc operation. In Local mode, this is a merged SQL operation in the project folder.
 */
export async function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  if (USE_LOCAL_DB) {
    await serverSetDoc(docRef.path, data);
    errorEmitter.emit('data-updated', { path: docRef.path });
    return;
  }
  return updateDoc(docRef, data).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: data,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });
}

/**
 * Executes a deleteDoc operation in the project folder.
 */
export async function deleteDocumentNonBlocking(docRef: DocumentReference) {
  if (USE_LOCAL_DB) {
    await serverDeleteDoc(docRef.path);
    errorEmitter.emit('data-updated', { path: docRef.path });
    return;
  }
  return deleteDoc(docRef).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });
}

/**
 * Universal data getter. Bridges Firestore QuerySnapshot structure to Project Folder SQL.
 */
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

    const data = await serverGetCollection(path);
    
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
