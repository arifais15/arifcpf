
import Database from 'better-sqlite3';
import path from 'path';

/**
 * @fileOverview Server-Side SQLite Database Instance
 * Optimized for high-fidelity persistence in the Project Folder.
 */

const DB_PATH = path.join(process.cwd(), 'pbs_cpf_vault_v7.sqlite3');

let db: Database.Database;

try {
  // Opening the database. better-sqlite3 handles concurrent reads/writes efficiently.
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  // Initialize Tables with consistent structure
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, data TEXT);
    CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, data TEXT);
    CREATE TABLE IF NOT EXISTS journal_entries (id TEXT PRIMARY KEY, data TEXT);
    CREATE TABLE IF NOT EXISTS fund_summaries (id TEXT PRIMARY KEY, memberId TEXT, journalEntryId TEXT, data TEXT);
    CREATE TABLE IF NOT EXISTS investments (id TEXT PRIMARY KEY, data TEXT);
    CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT);
    CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, data TEXT);
    
    CREATE INDEX IF NOT EXISTS idx_fs_m ON fund_summaries(memberId);
    CREATE INDEX IF NOT EXISTS idx_fs_je ON fund_summaries(journalEntryId);
  `);

  console.log(`[Institutional Vault Engaged]: ${DB_PATH}`);
} catch (error) {
  console.error('CRITICAL: Vault Initialization Failure:', error);
  throw error;
}

export { db };
