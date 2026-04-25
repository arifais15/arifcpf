'use client';

/**
 * @fileOverview Statutory Local Persistence Engine (V3 - Automation Version)
 * 
 * Implements a flat-path virtual Firestore environment using browser LocalStorage.
 * Optimized for institutional portability with zero cloud exposure.
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
      return JSON.parse(data);
    } catch (e) {
      console.error("Local DB Parse Error:", e);
      return {};
    }
  }

  private saveDB(db: LocalDB) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error("Local DB Save Error:", e);
    }
  }

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

  deleteDoc(path: string) {
    const db = this.getDB();
    if (db[path]) {
      delete db[path];
      // Automate sub-collection purging (Recursive Deletion)
      Object.keys(db).forEach(k => {
        if (k.startsWith(`${path}/`)) delete db[k];
      });
      this.saveDB(db);
    }
  }

  getCollection(path: string): any[] {
    const db = this.getDB();
    const results: any[] = [];
    
    // Support for collectionGroup (No slashes = search all paths for this segment)
    const isCollectionGroup = !path.includes('/');
    
    Object.entries(db).forEach(([k, v]) => {
      const parts = k.split('/');
      if (isCollectionGroup) {
        if (parts.length >= 2 && parts[parts.length - 2] === path) {
          results.push({ ...v, id: v.id || parts[parts.length - 1], _path: k });
        }
      } else {
        const prefix = path.endsWith('/') ? path : `${path}/`;
        if (k.startsWith(prefix)) {
          const subPath = k.substring(prefix.length);
          if (!subPath.includes('/')) {
            results.push({ ...v, id: v.id || subPath, _path: k });
          }
        }
      }
    });

    return results;
  }

  getDoc(path: string): any | null {
    return this.getDB()[path] || null;
  }

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
      return false;
    }
    return false;
  }
}

export const localDB = new LocalDatabaseService();
