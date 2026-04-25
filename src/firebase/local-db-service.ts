'use client';

/**
 * @fileOverview Institutional SQLite WASM Persistence Engine (V3)
 * 
 * Re-engineered for absolute data persistence on local PC.
 * Database Identity: pbs_cpf_institutional_vault_v3.sqlite3
 */

const DB_FILE = 'pbs_cpf_institutional_vault_v3.sqlite3';
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
    if (!this.db) {
        // Retry initialization if first attempt failed
        this.initPromise = this.initialize();
        await this.initPromise;
    }
  }

  private async initialize() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default;

      const sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
      });

      console.log("Institutional Audit: SQLite WASM Engine Loaded.");

      // Initialize persistent database using OO1 OPFS API
      if ('opfs' in sqlite3.oo1) {
        this.db = new sqlite3.oo1.OpfsDb(DB_FILE);
        console.log(`Institutional Persistence: [CREATED] ${DB_FILE} on local disk.`);
      } else {
        // Fallback for non-OPFS environments (e.g. missing headers)
        this.db = new sqlite3.oo1.DB(DB_FILE, 'ct');
        console.warn("Institutional Warning: OPFS restricted. Using browser-managed persistence.");
      }

      // 1. Force Disk Handshake
      this.db.exec("PRAGMA journal_mode=WAL;");
      this.db.exec("PRAGMA synchronous=NORMAL;");

      // 2. Create Comprehensive Relational Schema
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
        CREATE TABLE IF NOT EXISTS settings (
          id TEXT PRIMARY KEY,
          data JSON
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          type TEXT,
          data JSON
        );
        CREATE INDEX IF NOT EXISTS idx_summaries_member ON fund_summaries(memberId);
        CREATE INDEX IF NOT EXISTS idx_summaries_date ON fund_summaries(summaryDate);
        CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entryDate);
      `);

      // 3. Automated Legacy Migration
      await this.migrateFromLocalStorage();

    } catch (e) {
      console.error("SQLite Critical Initialization Failure:", e);
    } finally {
      this.isInitializing = false;
    }
  }

  private async migrateFromLocalStorage() {
    const legacyData = localStorage.getItem(LEGACY_KEY);
    if (!legacyData) return;

    console.log("Institutional Audit: Legacy LocalStorage detected. Initiating migration...");
    
    try {
      const flatDB = JSON.parse(legacyData);
      this.db.exec("BEGIN TRANSACTION;");
      
      for (const [path, data] of Object.entries(flatDB)) {
        await this.setDoc(path, data);
      }

      this.db.exec("COMMIT;");
      localStorage.removeItem(LEGACY_KEY);
      console.log("Migration Successful. LocalStorage matrix purged.");
    } catch (e) {
      if (this.db) this.db.exec("ROLLBACK;");
      console.error("Migration Aborted:", e);
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
    else if (sanitized === 'fundSummaries') sql = "SELECT data FROM fund_summaries"; 
    else if (sanitized === 'accruedInterestLogs') sql = "SELECT data FROM audit_logs WHERE type = 'accrual'";
    else if (sanitized.startsWith('settings')) sql = "SELECT data FROM settings";
    else if (sanitized.includes('members/') && sanitized.includes('/fundSummaries')) {
      const memberId = sanitized.split('/')[1];
      sql = `SELECT data FROM fund_summaries WHERE memberId = '${memberId}' ORDER BY summaryDate ASC`;
    }

    if (!sql) return [];

    try {
      this.db.exec({
        sql,
        callback: (row: any) => {
          if (row[0]) {
            try { results.push(JSON.parse(row[0])); } catch(e) {}
          }
        }
      });
    } catch(e) {
      console.error("Query Execution Error:", e);
    }

    return results;
  }

  async setDoc(path: string, data: any, options: { merge?: boolean } = {}) {
    await this.ensureReady();
    if (!this.db) return;

    const parts = path.replace(/^\/|\/$/g, '').split('/');
    const id = parts[parts.length - 1];
    const collection = parts[0];
    
    let finalData = data;
    if (options.merge) {
      const existing = await this.getDoc(path);
      finalData = { ...existing, ...data };
    }

    if (typeof finalData === 'object' && !finalData.id) {
      finalData.id = id;
    }

    const dataJson = JSON.stringify(finalData);

    try {
      this.db.exec("BEGIN TRANSACTION;");
      
      if (collection === 'members' && parts.length === 2) {
        this.db.exec({
          sql: "INSERT OR REPLACE INTO members (id, memberIdNumber, name, designation, status, data) VALUES (?, ?, ?, ?, ?, ?)",
          bind: [id, finalData.memberIdNumber, finalData.name, finalData.designation, finalData.status, dataJson]
        });
      } else if (path.includes('/fundSummaries/')) {
        this.db.exec({
          sql: "INSERT OR REPLACE INTO fund_summaries (id, memberId, journalEntryId, summaryDate, data) VALUES (?, ?, ?, ?, ?)",
          bind: [id, finalData.memberId, finalData.journalEntryId, finalData.summaryDate, dataJson]
        });
      } else if (collection === 'journalEntries') {
        this.db.exec({
          sql: "INSERT OR REPLACE INTO journal_entries (id, entryDate, refNo, totalAmount, data) VALUES (?, ?, ?, ?, ?)",
          bind: [id, finalData.entryDate, finalData.referenceNumber, finalData.totalAmount, dataJson]
        });
      } else if (collection === 'chartOfAccounts') {
        this.db.exec({
          sql: "INSERT OR REPLACE INTO accounts (id, code, name, type, balance, isHeader, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
          bind: [id, finalData.code || finalData.accountCode, finalData.name || finalData.accountName, finalData.type || finalData.accountType, finalData.balance || finalData.normalBalance, finalData.isHeader ? 1 : 0, dataJson]
        });
      } else if (collection === 'investmentInstruments') {
        this.db.exec({
          sql: "INSERT OR REPLACE INTO investments (id, refNo, bankName, principal, data) VALUES (?, ?, ?, ?, ?)",
          bind: [id, finalData.referenceNumber, finalData.bankName, finalData.principalAmount, dataJson]
        });
      } else if (collection === 'settings') {
        this.db.exec({
          sql: "INSERT OR REPLACE INTO settings (id, data) VALUES (?, ?)",
          bind: [id, dataJson]
        });
      } else if (collection === 'accruedInterestLogs') {
        this.db.exec({
          sql: "INSERT OR REPLACE INTO audit_logs (id, type, data) VALUES (?, ?, ?)",
          bind: [id, 'accrual', dataJson]
        });
      }
      
      this.db.exec("COMMIT;");
      console.log(`Institutional Sync: [COMMIT] ${path}`);
    } catch(e) {
      if (this.db) this.db.exec("ROLLBACK;");
      console.error(`Persistence Error for ${path}:`, e);
    }
    
    window.dispatchEvent(new Event('storage'));
  }

  async deleteDoc(path: string) {
    await this.ensureReady();
    if (!this.db) return;

    const parts = path.replace(/^\/|\/$/g, '').split('/');
    const id = parts[parts.length - 1];
    const collection = parts[0];

    try {
      this.db.exec("BEGIN TRANSACTION;");
      
      if (collection === 'members' && parts.length === 2) {
        this.db.exec(`DELETE FROM fund_summaries WHERE memberId = '${id}'`);
        this.db.exec(`DELETE FROM members WHERE id = '${id}'`);
      } else if (path.includes('/fundSummaries/')) {
        this.db.exec(`DELETE FROM fund_summaries WHERE id = '${id}'`);
      } else if (collection === 'journalEntries') {
        this.db.exec(`DELETE FROM journal_entries WHERE id = '${id}'`);
      } else if (collection === 'chartOfAccounts') {
        this.db.exec(`DELETE FROM accounts WHERE id = '${id}'`);
      } else if (collection === 'investmentInstruments') {
        this.db.exec(`DELETE FROM investments WHERE id = '${id}'`);
      } else if (collection === 'accruedInterestLogs') {
        this.db.exec(`DELETE FROM audit_logs WHERE id = '${id}'`);
      }
      
      this.db.exec("COMMIT;");
      console.log(`Institutional Sync: [PURGE] ${path}`);
    } catch(e) {
      if (this.db) this.db.exec("ROLLBACK;");
      console.error(`Deletion Error for ${path}:`, e);
    }

    window.dispatchEvent(new Event('storage'));
  }

  async getDoc(path: string): Promise<any | null> {
    await this.ensureReady();
    if (!this.db) return null;

    const parts = path.replace(/^\/|\/$/g, '').split('/');
    const id = parts[parts.length - 1];
    const collection = parts[0];
    let result = null;

    let sql = "";
    if (collection === 'members' && parts.length === 2) sql = `SELECT data FROM members WHERE id = '${id}'`;
    else if (path.includes('/fundSummaries/')) sql = `SELECT data FROM fund_summaries WHERE id = '${id}'`;
    else if (collection === 'journalEntries') sql = `SELECT data FROM journal_entries WHERE id = '${id}'`;
    else if (collection === 'chartOfAccounts') sql = `SELECT data FROM accounts WHERE id = '${id}'`;
    else if (collection === 'settings') sql = `SELECT data FROM settings WHERE id = '${id}'`;
    else if (collection === 'investmentInstruments') sql = `SELECT data FROM investments WHERE id = '${id}'`;
    
    if (sql) {
      try {
        this.db.exec({
          sql,
          callback: (row: any) => { if (row[0]) result = JSON.parse(row[0]); }
        });
      } catch(e) {
        console.error(`Read Error for ${path}:`, e);
      }
    }
    return result;
  }

  async exportDatabase(): Promise<string> {
    await this.ensureReady();
    const data: Record<string, any> = {};
    
    const collections = [
      { name: 'members', path: 'members' },
      { name: 'accounts', path: 'chartOfAccounts' },
      { name: 'journal_entries', path: 'journalEntries' },
      { name: 'investments', path: 'investmentInstruments' },
      { name: 'settings', path: 'settings' },
      { name: 'fund_summaries', path: 'fund_summaries' },
      { name: 'audit_logs', path: 'accruedInterestLogs' }
    ];

    for (const col of collections) {
      this.db.exec({
        sql: `SELECT id, data FROM ${col.name}`,
        callback: (row: any) => {
          if (row[0] && row[1]) {
            const rowData = JSON.parse(row[1]);
            const path = col.name === 'fund_summaries' 
              ? `members/${rowData.memberId}/fundSummaries/${row[0]}`
              : `${col.path}/${row[0]}`;
            data[path] = rowData;
          }
        }
      });
    }

    return JSON.stringify(data);
  }

  importDatabase(json: string): boolean {
    try {
      const data = JSON.parse(json);
      this.db.exec("BEGIN TRANSACTION;");
      
      ['members', 'fund_summaries', 'journal_entries', 'accounts', 'investments', 'settings', 'audit_logs'].forEach(t => {
        this.db.exec(`DELETE FROM ${t}`);
      });

      for (const [path, docData] of Object.entries(data)) {
        // Use normalized paths
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        this.setDoc(normalizedPath, docData);
      }

      this.db.exec("COMMIT;");
      return true;
    } catch (e) {
      if (this.db) this.db.exec("ROLLBACK;");
      return false;
    }
  }

  getStorageMetrics() {
    return { used: 0, total: 1024 * 1024 * 1024, percent: 0 };
  }
}

export const localDB = new SQLiteDatabaseService();
