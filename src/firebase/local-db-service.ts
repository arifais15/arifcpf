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

  /**
   * Returns storage utilization metrics in Bytes and Percentage.
   */
  getStorageMetrics() {
    if (typeof window === 'undefined') return { used: 0, total: 5242880, percent: 0 };
    const data = localStorage.getItem(DB_KEY) || "";
    const used = new Blob([data]).size;
    const total = 5 * 1024 * 1024; // 5MB standard safe limit
    return {
      used,
      total,
      percent: Math.min(100, Math.round((used / total) * 100))
    };
  }

  setDoc(path: string, data: any, options: { merge?: boolean } = {}) {
    const db = this.getDB();
    const cleanPath = path.replace(/^\/|\/$/g, '');
    const existing = db[cleanPath] || {};
    db[cleanPath] = options.merge ? { ...existing, ...data } : data;
    this.saveDB(db);
  }

  addDoc(collectionPath: string, data: any) {
    const docId = data.id || Math.random().toString(36).substring(2, 15);
    const cleanColPath = collectionPath.replace(/^\/|\/$/g, '');
    const path = `${cleanColPath}/${docId}`;
    this.setDoc(path, { ...data, id: docId });
    return { id: docId };
  }

  deleteDoc(path: string) {
    const db = this.getDB();
    const cleanPath = path.replace(/^\/|\/$/g, '');
    if (db[cleanPath]) {
      delete db[cleanPath];
      // Automate sub-collection purging (Recursive Deletion)
      Object.keys(db).forEach(k => {
        if (k.startsWith(`${cleanPath}/`)) delete db[k];
      });
      this.saveDB(db);
    }
  }

  getCollection(path: string): any[] {
    const db = this.getDB();
    const results: any[] = [];
    const searchPath = path.replace(/^\/|\/$/g, '');
    
    // Support for collectionGroup (No slashes = search all paths for this segment)
    const isCollectionGroup = !searchPath.includes('/');
    
    Object.entries(db).forEach(([k, v]) => {
      const parts = k.split('/');
      if (isCollectionGroup) {
        // Robust Collection Group Matching: find the collection segment anywhere in the path
        const colIndex = parts.indexOf(searchPath);
        if (colIndex !== -1 && colIndex === parts.length - 2) {
          results.push({ ...v, id: v.id || parts[parts.length - 1], _path: k });
        }
      } else {
        const prefix = searchPath.endsWith('/') ? searchPath : `${searchPath}/`;
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
    const cleanPath = path.replace(/^\/|\/$/g, '');
    return this.getDB()[cleanPath] || null;
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
