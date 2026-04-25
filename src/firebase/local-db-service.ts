
'use client';

/**
 * @fileOverview Local Database Service (Decommissioned)
 * 
 * The application has transitioned to a Server-Side SQLite architecture to provide
 * direct visibility of 'pbs_cpf_vault_v7.sqlite3' in the project folder.
 * 
 * Client-side SQLite operations are now proxied via Next.js Server Actions.
 */

export const localDB = {
  getMode: () => "Server-Side Vault",
  ensureReady: async () => {},
  getCollection: async () => [],
  setDoc: async () => {},
  deleteDoc: async () => {},
  getDoc: async () => null,
  exportDatabase: async () => "{}",
  importDatabase: () => false,
  getStorageMetrics: () => ({ used: 0, total: 0, percent: 0 })
};
