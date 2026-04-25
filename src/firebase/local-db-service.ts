'use client';

/**
 * @fileOverview Institutional SQLite WASM + OPFS Persistence Engine
 * 
 * Replaces LocalStorage with a high-performance relational database.
 * Supports automated migration from legacy storage and async I/O.
 */

// REMOVED top-level import to avoid "self is not defined" SSR errors
// import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const DB_FILE = '/pbs_cpf_relational_matrix.sqlite3';
const LEGACY_KEY = 'pbs_cpf_local_matrix_v1';

class SQLiteDatabaseService {
  private db: any = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPromise = this.initialize();
    }
  }

  async ensureReady() {
    if (typeof window === 'undefined') return;
    if (this.initPromise) await this.initPromise;
  }

  private async initialize() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      // Dynamic import ensures this code ONLY runs in the browser
      // This prevents the "self is not defined" error during Next.js SSR
      const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default;

      const sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
      });

      if ('opfs' in sqlite3) {
        this.db = new sqlite3.oo1.OpfsDb(DB_FILE);
      } else {
        this.db = new sqlite3.oo1.DB(DB_FILE, 'ct');
      }

      // 1. Create Relational Schema
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE,
          name TEXT,
          type TEXT,
          balance TEXT,
          isHeader INTEGER,
          data JSON
        );
        CREATE TABLE IF NOT EXISTS members (
          id TEXT PRIMARY KEY,
          memberIdNumber TEXT UNIQUE,
          name TEXT,
          designation TEXT,
          status TEXT,
          data JSON
        );
        CREATE TABLE IF NOT EXISTS journal_entries (
          id TEXT PRIMARY KEY,
          entryDate TEXT,
          refNo TEXT,
          totalAmount REAL,
          data JSON
        );
        CREATE TABLE IF NOT EXISTS fund_summaries (
          id TEXT PRIMARY KEY,
          memberId TEXT,
          journalEntryId TEXT,
          summaryDate TEXT,
          data JSON,
          FOREIGN KEY(memberId) REFERENCES members(id)
        );
        CREATE TABLE IF NOT EXISTS investments (
          id TEXT PRIMARY KEY,
          refNo TEXT,
          bankName TEXT,
          principal REAL,
          data JSON
        );
        CREATE INDEX IF NOT EXISTS idx_summaries_member ON fund_summaries(memberId);
        CREATE INDEX IF NOT EXISTS idx_summaries_date ON fund_summaries(summaryDate);
      `);

      // 2. Automated Legacy Migration
      await this.migrateFromLocalStorage();

    } catch (e) {
      console.error("SQLite Initialization Error:", e);
    } finally {
      this.isInitializing = false;
    }
  }

  private async migrateFromLocalStorage() {
    const legacyData = localStorage.getItem(LEGACY_KEY);
    if (!legacyData) return;

    console.log("Institutional Audit: legacy LocalStorage detected. Initiating Relational Migration...");
    
    try {
      const flatDB = JSON.parse(legacyData);
      
      this.db.exec("BEGIN TRANSACTION;");
      
      for (const [path, data] of Object.entries(flatDB)) {
        const parts = path.split('/');
        const id = parts[parts.length - 1];

        if (path.startsWith('chartOfAccounts/')) {
          this.db.exec({
            sql: "INSERT OR REPLACE INTO accounts (id, code, name, type, balance, isHeader, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
            bind: [id, data.accountCode || data.code, data.accountName || data.name, data.accountType || data.type, data.normalBalance || data.balance, data.isHeader ? 1 : 0, JSON.stringify(data)]
          });
        } else if (path.startsWith('members/') && parts.length === 2) {
          this.db.exec({
            sql: "INSERT OR REPLACE INTO members (id, memberIdNumber, name, designation, status, data) VALUES (?, ?, ?, ?, ?, ?)",
            bind: [id, data.memberIdNumber, data.name, data.designation, data.status, JSON.stringify(data)]
          });
        } else if (path.includes('/fundSummaries/')) {
          this.db.exec({
            sql: "INSERT OR REPLACE INTO fund_summaries (id, memberId, journalEntryId, summaryDate, data) VALUES (?, ?, ?, ?, ?)",
            bind: [id, data.memberId, data.journalEntryId, data.summaryDate, JSON.stringify(data)]
          });
        } else if (path.startsWith('journalEntries/')) {
          this.db.exec({
            sql: "INSERT OR REPLACE INTO journal_entries (id, entryDate, refNo, totalAmount, data) VALUES (?, ?, ?, ?, ?)",
            bind: [id, data.entryDate, data.referenceNumber, data.totalAmount, JSON.stringify(data)]
          });
        } else if (path.startsWith('investmentInstruments/')) {
          this.db.exec({
            sql: "INSERT OR REPLACE INTO investments (id, refNo, bankName, principal, data) VALUES (?, ?, ?, ?, ?)",
            bind: [id, data.referenceNumber, data.bankName, data.principalAmount, JSON.stringify(data)]
          });
        }
      }

      this.db.exec("COMMIT;");
      localStorage.removeItem(LEGACY_KEY);
      console.log("Relational Migration Successful. Legacy cache purged.");
    } catch (e) {
      if (this.db) this.db.exec("ROLLBACK;");
      console.error("Migration Failed:", e);
    }
  }

  async getCollection(path: string): Promise<any[]> {
    await this.ensureReady();
    if (!this.db) return [];
    
    const results: any[] = [];
    const sanitized = path.replace(/^\/|\/$/g, '');

    let sql = "";
    if (sanitized === 'members') sql = "SELECT data FROM members ORDER BY memberIdNumber ASC";
    else if (sanitized === 'chartOfAccounts') sql = "SELECT data FROM accounts ORDER BY code ASC";
    else if (sanitized === 'journalEntries') sql = "SELECT data FROM journal_entries ORDER BY entryDate DESC";
    else if (sanitized === 'investmentInstruments') sql = "SELECT data FROM investments";
    else if (sanitized === 'fundSummaries') sql = "SELECT data FROM fund_summaries"; // collectionGroup
    else if (sanitized.includes('members/') && sanitized.includes('/fundSummaries')) {
      const memberId = sanitized.split('/')[1];
      sql = `SELECT data FROM fund_summaries WHERE memberId = '${memberId}' ORDER BY summaryDate ASC`;
    }

    if (!sql) return [];

    this.db.exec({
      sql,
      callback: (row: any) => {
        if (row[0]) results.push(JSON.parse(row[0]));
      }
    });

    return results;
  }

  async setDoc(path: string, data: any, options: { merge?: boolean } = {}) {
    await this.ensureReady();
    if (!this.db) return;

    const parts = path.replace(/^\/|\/$/g, '').split('/');
    const id = parts[parts.length - 1];
    
    let finalData = data;
    if (options.merge) {
      const existing = await this.getDoc(path);
      finalData = { ...existing, ...data };
    }

    if (path.startsWith('members/') && parts.length === 2) {
      this.db.exec({
        sql: "INSERT OR REPLACE INTO members (id, memberIdNumber, name, designation, status, data) VALUES (?, ?, ?, ?, ?, ?)",
        bind: [id, finalData.memberIdNumber, finalData.name, finalData.designation, finalData.status, JSON.stringify(finalData)]
      });
    } else if (path.includes('/fundSummaries/')) {
      this.db.exec({
        sql: "INSERT OR REPLACE INTO fund_summaries (id, memberId, journalEntryId, summaryDate, data) VALUES (?, ?, ?, ?, ?)",
        bind: [id, finalData.memberId, finalData.journalEntryId, finalData.summaryDate, JSON.stringify(finalData)]
      });
    } else if (path.startsWith('journalEntries/')) {
      this.db.exec({
        sql: "INSERT OR REPLACE INTO journal_entries (id, entryDate, refNo, totalAmount, data) VALUES (?, ?, ?, ?, ?)",
        bind: [id, finalData.entryDate, finalData.referenceNumber, finalData.totalAmount, JSON.stringify(finalData)]
      });
    }
    
    window.dispatchEvent(new Event('storage'));
  }

  async deleteDoc(path: string) {
    await this.ensureReady();
    if (!this.db) return;

    const parts = path.replace(/^\/|\/$/g, '').split('/');
    const id = parts[parts.length - 1];

    if (path.startsWith('members/')) {
      this.db.exec(`DELETE FROM fund_summaries WHERE memberId = '${id}'`);
      this.db.exec(`DELETE FROM members WHERE id = '${id}'`);
    } else if (path.includes('/fundSummaries/')) {
      this.db.exec(`DELETE FROM fund_summaries WHERE id = '${id}'`);
    } else if (path.startsWith('journalEntries/')) {
      this.db.exec(`DELETE FROM journal_entries WHERE id = '${id}'`);
    }

    window.dispatchEvent(new Event('storage'));
  }

  async getDoc(path: string): Promise<any | null> {
    await this.ensureReady();
    if (!this.db) return null;

    const parts = path.replace(/^\/|\/$/g, '').split('/');
    const id = parts[parts.length - 1];
    let result = null;

    let sql = "";
    if (path.startsWith('members/')) sql = `SELECT data FROM members WHERE id = '${id}'`;
    else if (path.includes('/fundSummaries/')) sql = `SELECT data FROM fund_summaries WHERE id = '${id}'`;
    
    if (sql) {
      this.db.exec({
        sql,
        callback: (row: any) => { result = JSON.parse(row[0]); }
      });
    }
    return result;
  }

  /**
   * Placeholder for future cloud synchronization logic.
   */
  async syncWithFirebase() {
    console.log("Institutional Sync: Preparing SQLite matrix for Firestore upload...");
    // Future: Iterate tables and call Firestore setDoc()
  }

  getStorageMetrics() {
    // SQLite OPFS doesn't have a small 5MB limit like LocalStorage.
    // It's limited by user disk space.
    return { used: 0, total: 1024 * 1024 * 1024, percent: 0 };
  }
}

export const localDB = new SQLiteDatabaseService();
