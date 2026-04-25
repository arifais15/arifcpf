'use client';

/**
 * @fileOverview Institutional SQLite WASM Persistence Engine (V4)
 * 
 * Re-engineered with a Sequential Execution Queue to handle 
 * high-concurrency bulk uploads and prevent transaction collisions.
 */

const DB_FILE = 'pbs_cpf_institutional_vault_v3.sqlite3';
const LEGACY_KEY = 'pbs_cpf_local_matrix_v1';

class SQLiteDatabaseService {
  private db: any = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  private queue: Promise<any> = Promise.resolve();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPromise = this.initialize();
    }
  }

  async ensureReady() {
    if (typeof window === 'undefined') return;
    if (this.initPromise) await this.initPromise;
    if (!this.db) {
      this.initPromise = this.initialize();
      await this.initPromise;
    }
  }

  /**
   * Sequential Task Runner
   * Ensures that all database operations happen one after another.
   */
  private async runQueued<T>(task: () => Promise<T>): Promise<T> {
    this.queue = this.queue.then(() => task()).catch(err => {
      console.error("Critical Matrix Execution Error:", err);
      return null as any;
    });
    return this.queue;
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

      if ('opfs' in sqlite3.oo1) {
        this.db = new sqlite3.oo1.OpfsDb(DB_FILE);
        console.log("Institutional Persistence: SQLite OPFS Engine Active.");
      } else {
        this.db = new sqlite3.oo1.DB(DB_FILE, 'ct');
        console.warn("Institutional Warning: OPFS restricted. Using fallback persistence.");
      }

      // Optimize for local performance
      this.db.exec("PRAGMA journal_mode=WAL;");
      this.db.exec("PRAGMA synchronous=NORMAL;");
      this.db.exec("PRAGMA foreign_keys=OFF;"); // Match Firestore's flat flexibility for bulk uploads

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT, type TEXT, balance TEXT, isHeader INTEGER, data JSON
        );
        CREATE TABLE IF NOT EXISTS members (
          id TEXT PRIMARY KEY, memberIdNumber TEXT UNIQUE, name TEXT, designation TEXT, status TEXT, data JSON
        );
        CREATE TABLE IF NOT EXISTS journal_entries (
          id TEXT PRIMARY KEY, entryDate TEXT, refNo TEXT, totalAmount REAL, data JSON
        );
        CREATE TABLE IF NOT EXISTS fund_summaries (
          id TEXT PRIMARY KEY, memberId TEXT, journalEntryId TEXT, summaryDate TEXT, data JSON
        );
        CREATE TABLE IF NOT EXISTS investments (
          id TEXT PRIMARY KEY, refNo TEXT, bankName TEXT, principal REAL, data JSON
        );
        CREATE TABLE IF NOT EXISTS settings (
          id TEXT PRIMARY KEY, data JSON
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY, type TEXT, data JSON
        );
        CREATE INDEX IF NOT EXISTS idx_summaries_member ON fund_summaries(memberId);
        CREATE INDEX IF NOT EXISTS idx_summaries_date ON fund_summaries(summaryDate);
        CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entryDate);
      `);

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

    try {
      const flatDB = JSON.parse(legacyData);
      this.db.exec("BEGIN TRANSACTION;");
      for (const [path, data] of Object.entries(flatDB)) {
        await this.internalSetDoc(path, data);
      }
      this.db.exec("COMMIT;");
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {
      if (this.db) this.db.exec("ROLLBACK;");
    }
  }

  async getCollection(path: string): Promise<any[]> {
    return this.runQueued(async () => {
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

      if (sql) {
        this.db.exec({
          sql,
          callback: (row: any) => { if (row[0]) results.push(JSON.parse(row[0])); }
        });
      }
      return results;
    });
  }

  async setDoc(path: string, data: any, options: { merge?: boolean } = {}) {
    return this.runQueued(async () => {
      await this.ensureReady();
      return this.internalSetDoc(path, data, options);
    });
  }

  private async internalSetDoc(path: string, data: any, options: { merge?: boolean } = {}) {
    if (!this.db) return;

    const parts = path.replace(/^\/|\/$/g, '').split('/');
    const id = parts[parts.length - 1];
    const collection = parts[0];
    
    let finalData = data;
    if (options.merge) {
      let existing = null;
      this.db.exec({
        sql: `SELECT data FROM ${this.getTableName(path)} WHERE id = ?`,
        bind: [id],
        callback: (row: any) => { if (row[0]) existing = JSON.parse(row[0]); }
      });
      finalData = { ...existing, ...data };
    }

    if (typeof finalData === 'object' && !finalData.id) {
      finalData.id = id;
    }

    const dataJson = JSON.stringify(finalData);

    try {
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
      window.dispatchEvent(new Event('storage'));
    } catch(e) {
      console.error(`Vault Sync Error:`, e);
    }
  }

  private getTableName(path: string): string {
    const p = path.replace(/^\/|\/$/g, '');
    if (p.includes('/fundSummaries/')) return 'fund_summaries';
    if (p.startsWith('members')) return 'members';
    if (p.startsWith('journalEntries')) return 'journal_entries';
    if (p.startsWith('chartOfAccounts')) return 'accounts';
    if (p.startsWith('investmentInstruments')) return 'investments';
    if (p.startsWith('accruedInterestLogs')) return 'audit_logs';
    return 'settings';
  }

  async deleteDoc(path: string) {
    return this.runQueued(async () => {
      await this.ensureReady();
      if (!this.db) return;

      const parts = path.replace(/^\/|\/$/g, '').split('/');
      const id = parts[parts.length - 1];
      const collection = parts[0];

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
      window.dispatchEvent(new Event('storage'));
    });
  }

  async getDoc(path: string): Promise<any | null> {
    return this.runQueued(async () => {
      await this.ensureReady();
      if (!this.db) return null;

      const parts = path.replace(/^\/|\/$/g, '').split('/');
      const id = parts[parts.length - 1];
      let result = null;

      this.db.exec({
        sql: `SELECT data FROM ${this.getTableName(path)} WHERE id = ?`,
        bind: [id],
        callback: (row: any) => { if (row[0]) result = JSON.parse(row[0]); }
      });
      return result;
    });
  }

  async exportDatabase(): Promise<string> {
    await this.ensureReady();
    const data: Record<string, any> = {};
    const tables = [
      { name: 'members', path: 'members' },
      { name: 'accounts', path: 'chartOfAccounts' },
      { name: 'journal_entries', path: 'journalEntries' },
      { name: 'investments', path: 'investmentInstruments' },
      { name: 'settings', path: 'settings' },
      { name: 'fund_summaries', path: 'fund_summaries' },
      { name: 'audit_logs', path: 'accruedInterestLogs' }
    ];

    for (const table of tables) {
      this.db.exec({
        sql: `SELECT id, data FROM ${table.name}`,
        callback: (row: any) => {
          if (row[0] && row[1]) {
            const rowData = JSON.parse(row[1]);
            const path = table.name === 'fund_summaries' 
              ? `members/${rowData.memberId}/fundSummaries/${row[0]}`
              : `${table.path}/${row[0]}`;
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
        this.internalSetDoc(path, docData);
      }
      this.db.exec("COMMIT;");
      return true;
    } catch (e) {
      if (this.db) this.db.exec("ROLLBACK;");
      return false;
    }
  }

  getStorageMetrics() { return { used: 0, total: 1024 * 1024 * 1024, percent: 0 }; }
}

export const localDB = new SQLiteDatabaseService();
