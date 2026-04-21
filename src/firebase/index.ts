'use client';

/**
 * @fileOverview Portable Database Initialization
 * 
 * This file has been re-engineered for Institutional Portability.
 * It provides a "Local-First" database experience that runs on any PC
 * without requiring cloud configuration or Firebase CLI installation.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// The system now defaults to Local Persistence Mode for Zero-Config Distribution
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
    auth: getAuth(app),
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
