'use client';

/**
 * @fileOverview Statutory Local Persistence Engine (Circular-Safe Version)
 * 
 * Implements a flat-path virtual Firestore environment using browser LocalStorage.
 * Prevents circular references by avoiding nested object structures.
 * Features automated disk persistence and portability export/import.
 */

const DB_KEY = 'pbs_cpf_local_matrix_v1';

interface LocalDB {
  [path: string]: any;
}

class LocalDatabaseService {
  private getDB(): LocalDB {
    if (typeof window === 'undefined') return {};
    const data = localStorage.getItem(DB_KEY);
    if (!data) return {};
    
    try {
      const parsed = JSON.parse(data);
      
      // MIGRATION: Detect and flatten old nested structure if present
      const keys = Object.keys(parsed);
      const isOldStructure = keys.some(k => !k.includes('/') && typeof parsed[k] === 'object' && !Array.isArray(parsed[k]));
      
      if (isOldStructure) {
        const flattened: LocalDB = {};
        Object.entries(parsed).forEach(([colName, docs]: [string, any]) => {
          if (typeof docs !== 'object' || Array.isArray(docs)) return;
          Object.entries(docs).forEach(([docId, docData]: [string, any]) => {
            const path = `${colName}/${docId}`;
            const { _sub, ...rest } = docData;
            flattened[path] = rest;
            if (_sub) {
              Object.entries(_sub).forEach(([subKey, subData]) => {
                // subKey in old version was 'fundSummaries/docID'
                flattened[`${path}/${subKey}`] = subData;
              });
            }
          });
        });
        localStorage.setItem(DB_KEY, JSON.stringify(flattened));
        return flattened;
      }
      
      return parsed;
    } catch (e) {
      console.error("Local DB Parse Error:", e);
      return {};
    }
  }

  private saveDB(db: LocalDB) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      // Trigger a storage event for multi-tab synchronization and UI updates
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error("Local DB Save Error (Circular Check Needed):", e);
    }
  }

  // CREATE / UPDATE
  setDoc(path: string, data: any, options: { merge?: boolean } = {}) {
    const db = this.getDB();
    const existing = db[path] || {};
    db[path] = options.merge ? { ...existing, ...data } : data;
    this.saveDB(db);
  }

  addDoc(collectionPath: string, data: any) {
    const docId = data.id || Math.random().toString(36).substring(2, 15);
    const path = `${collectionPath}/${docId}`;
    this.setDoc(path, { ...data, id: docId });
    return { id: docId };
  }

  // DELETE
  deleteDoc(path: string) {
    const db = this.getDB();
    if (db[path]) {
      delete db[path];
      // Recursive delete: also remove all sub-documents in paths like path/subcollection/id
      Object.keys(db).forEach(k => {
        if (k.startsWith(`${path}/`)) {
          delete db[k];
        }
      });
      this.saveDB(db);
    }
  }

  // QUERY / READ
  getCollection(path: string): any[] {
    const db = this.getDB();
    const results: any[] = [];
    
    // Support for collectionGroup (e.g. path='fundSummaries' or path='journalEntries')
    // We assume path is a collectionGroup name if it has no slashes.
    const isCollectionGroup = !path.includes('/');
    
    Object.entries(db).forEach(([k, v]) => {
      const parts = k.split('/');
      
      if (isCollectionGroup) {
        // Find any document where the parent segment matches the collection name
        // Path like 'members/ID/fundSummaries/docID' matches 'fundSummaries'
        if (parts.length >= 2 && parts[parts.length - 2] === path) {
          results.push({ ...v, id: v.id || parts[parts.length - 1] });
        }
      } else {
        // Standard collection match (e.g. path='members' or path='members/123/fundSummaries')
        const prefix = path.endsWith('/') ? path : `${path}/`;
        if (k.startsWith(prefix)) {
          const subPath = k.substring(prefix.length);
          // Ensure it is a direct child document (no more slashes in subPath)
          if (!subPath.includes('/')) {
            results.push({ ...v, id: v.id || subPath });
          }
        }
      }
    });

    return results;
  }

  getDoc(path: string): any | null {
    const db = this.getDB();
    return db[path] || null;
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
