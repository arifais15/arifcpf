'use client';

/**
 * @fileOverview Statutory Local Persistence Engine
 * 
 * Implements a virtual Firestore environment using browser LocalStorage.
 * Designed for portable PBS CPF distribution where internet/cloud access is restricted.
 * Features automated disk persistence and portability export/import.
 */

const DB_KEY = 'pbs_cpf_local_matrix_v1';

interface LocalDB {
  [collection: string]: {
    [docId: string]: any;
  };
}

class LocalDatabaseService {
  private getDB(): LocalDB {
    if (typeof window === 'undefined') return {};
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : {};
  }

  private saveDB(db: LocalDB) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    // Trigger a storage event for multi-tab synchronization and UI updates
    window.dispatchEvent(new Event('storage'));
  }

  // CREATE / UPDATE
  setDoc(path: string, data: any, options: { merge?: boolean } = {}) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) return;
    
    const db = this.getDB();
    const collection = parts[0];
    const docId = parts[1];
    
    if (!db[collection]) db[collection] = {};
    
    const existing = db[collection][docId] || {};
    db[collection][docId] = options.merge ? { ...existing, ...data } : data;
    
    // Handle subcollections (e.g., members/ID/fundSummaries/ID)
    if (parts.length > 2) {
      const subPath = parts.slice(2).join('/');
      if (!db[collection][docId]._sub) db[collection][docId]._sub = {};
      db[collection][docId]._sub[subPath] = data;
    }

    this.saveDB(db);
  }

  addDoc(collectionPath: string, data: any) {
    const docId = Math.random().toString(36).substring(2, 15);
    const id = data.id || docId;
    this.setDoc(`${collectionPath}/${id}`, { ...data, id });
    return { id };
  }

  // DELETE
  deleteDoc(path: string) {
    const parts = path.split('/').filter(Boolean);
    const db = this.getDB();
    const collectionName = parts[0];
    const docId = parts[1];
    
    if (db[collectionName] && db[collectionName][docId]) {
      delete db[collectionName][docId];
      this.saveDB(db);
    }
  }

  // QUERY / READ
  getCollection(path: string): any[] {
    const db = this.getDB();
    const parts = path.split('/').filter(Boolean);
    
    // Support for collectionGroup (flat scan across all members)
    if (path.includes('fundSummaries')) {
      const all: any[] = [];
      Object.values(db['members'] || {}).forEach((member: any) => {
        if (member._sub) {
          Object.entries(member._sub).forEach(([subKey, entry]: any) => {
            if (subKey.startsWith('fundSummaries')) {
              all.push({ ...entry, id: entry.id || subKey.split('/').pop() });
            }
          });
        }
      });
      return all;
    }

    if (parts.length === 1) {
      return Object.values(db[parts[0]] || []);
    }
    
    // Subcollection reading
    if (parts.length === 3) {
      const parentCol = parts[0];
      const parentId = parts[1];
      const subCol = parts[2];
      const parent = db[parentCol]?.[parentId];
      if (!parent || !parent._sub) return [];
      
      return Object.entries(parent._sub)
        .filter(([k]) => k.startsWith(subCol))
        .map(([k, v]: any) => ({ ...v, id: v.id || k.split('/').pop() }));
    }

    return [];
  }

  getDoc(path: string): any | null {
    const parts = path.split('/').filter(Boolean);
    const db = this.getDB();
    return db[parts[0]]?.[parts[1]] || null;
  }

  // PORTABILITY API
  exportDatabase(): string {
    return JSON.stringify(this.getDB());
  }

  importDatabase(jsonString: string) {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed === 'object') {
        localStorage.setItem(DB_KEY, jsonString);
        window.dispatchEvent(new Event('storage'));
        return true;
      }
    } catch (e) {
      console.error("Institutional Data Import Failed:", e);
    }
    return false;
  }
}

export const localDB = new LocalDatabaseService();
