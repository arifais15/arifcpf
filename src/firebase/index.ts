'use client';

/**
 * @fileOverview Portable Database Initialization
 * 
 * This file has been re-engineered for Institutional Portability.
 * 
 * MODE SELECTION:
 * - true:  Saves data ONLY to your local PC (Private & Offline).
 * - false: Saves data to Firebase Cloud (Requires Internet).
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// To use Firebase Cloud instead of Local PC, change this to 'false'
export const USE_LOCAL_DB = true; 

export function initializeFirebase() {
  if (!getApps().length) {
    const app = initializeApp(firebaseConfig);
    return {
      firebaseApp: app,
      auth: getAuth(app),
      firestore: getFirestore(app)
    };
  }
  const app = getApp();
  return {
    firebaseApp: app,
    auth: getApp().name ? getAuth(app) : getAuth(), // Guard for local auth state
    firestore: getFirestore(app)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';
