'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

/**
 * Initializes the Firebase Client SDK.
 * 
 * For a completely offline 'Local Database' experience during development, 
 * you can use the Firebase Emulator Suite. To do so, you would call:
 *   connectFirestoreEmulator(firestore, 'localhost', 8080);
 *   connectAuthEmulator(auth, 'http://localhost:9099');
 * 
 * To maintain production readiness, the SDK defaults to cloud connectivity.
 */
export function initializeFirebase() {
  if (!getApps().length) {
    let firebaseApp;
    try {
      // Priority: App Hosting Environment Variables
      firebaseApp = initializeApp();
    } catch (e) {
      // Fallback: Static configuration from config.ts
      firebaseApp = initializeApp(firebaseConfig);
    }
    return getSdks(firebaseApp);
  }
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
