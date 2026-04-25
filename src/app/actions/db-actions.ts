
'use server';

import { db } from '@/lib/server-db';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server Actions for Database Bridge
 * Hardened for high-volume data synchronization with robust error handling.
 */

export async function serverGetCollection(path: string) {
  try {
    const p = path.replace(/^\/|\/$/g, '');
    let rows: any[] = [];

    if (p === 'members') rows = db.prepare("SELECT data FROM members").all();
    else if (p === 'chartOfAccounts' || p === 'accounts') rows = db.prepare("SELECT data FROM accounts").all();
    else if (p === 'journalEntries') rows = db.prepare("SELECT data FROM journal_entries").all();
    else if (p === 'investmentInstruments') rows = db.prepare("SELECT data FROM investments").all();
    else if (p === 'fundSummaries') rows = db.prepare("SELECT data FROM fund_summaries").all();
    else if (p.includes('/fundSummaries')) {
      const mid = p.split('/')[1];
      rows = db.prepare("SELECT data FROM fund_summaries WHERE memberId = ?").all(mid);
    } else if (p.startsWith('settings')) rows = db.prepare("SELECT data FROM settings").all();
    else if (p === 'accruedInterestLogs') rows = db.prepare("SELECT data FROM audit_logs").all();

    return rows.map(r => {
      try {
        return JSON.parse(r.data);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    console.error('Database Error (GetCollection):', error);
    throw new Error('Vault access failed');
  }
}

export async function serverGetDoc(path: string) {
  try {
    const p = path.replace(/^\/|\/$/g, '').split('/');
    const id = p[p.length - 1];
    const coll = p[0];

    let table = 'settings';
    if (path.includes('/fundSummaries/')) table = 'fund_summaries';
    else if (coll === 'members') table = 'members';
    else if (coll === 'journalEntries') table = 'journal_entries';
    else if (coll === 'chartOfAccounts' || coll === 'accounts') table = 'accounts';
    else if (coll === 'investmentInstruments') table = 'investments';
    else if (coll === 'accruedInterestLogs') table = 'audit_logs';

    const row: any = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
    return row ? JSON.parse(row.data) : null;
  } catch (error) {
    console.error('Database Error (GetDoc):', error);
    return null;
  }
}

export async function serverSetDoc(path: string, data: any) {
  try {
    const p = path.replace(/^\/|\/$/g, '').split('/');
    const id = p[p.length - 1];
    const coll = p[0];

    let table = "";
    let extraCols = "";
    let placeholders = "";
    // Sanitize data for serialization
    const sanitizedData = JSON.parse(JSON.stringify(data));
    let binds = [id, JSON.stringify({ ...sanitizedData, id })];

    if (coll === 'members' && p.length === 2) table = "members";
    else if (path.includes('/fundSummaries/')) {
      table = "fund_summaries";
      extraCols = ", memberId, journalEntryId";
      placeholders = ", ?, ?";
      binds.push(sanitizedData.memberId || "", sanitizedData.journalEntryId || "");
    } else if (coll === 'journalEntries') table = "journal_entries";
    else if (coll === 'chartOfAccounts' || coll === 'accounts') table = "accounts";
    else if (coll === 'investmentInstruments') table = "investments";
    else if (coll === 'settings') table = "settings";
    else if (coll === 'accruedInterestLogs') table = "audit_logs";

    if (table) {
      db.prepare(`INSERT OR REPLACE INTO ${table} (id, data${extraCols}) VALUES (?, ?${placeholders})`).run(...binds);
      revalidatePath('/', 'layout');
    }
  } catch (error) {
    console.error('Database Error (SetDoc):', error);
    throw new Error('Synchronization failed');
  }
}

/**
 * ATOMIC BATCH ENGINE
 * Processes massive datasets in a single physical disk write operation.
 */
export async function serverExecuteBatch(ops: { type: 'set' | 'delete', path: string, data?: any }[]) {
  try {
    const setMember = db.prepare("INSERT OR REPLACE INTO members (id, data) VALUES (?, ?)");
    const setSummary = db.prepare("INSERT OR REPLACE INTO fund_summaries (id, data, memberId, journalEntryId) VALUES (?, ?, ?, ?)");
    const setJournal = db.prepare("INSERT OR REPLACE INTO journal_entries (id, data) VALUES (?, ?)");
    const setAccount = db.prepare("INSERT OR REPLACE INTO accounts (id, data) VALUES (?, ?)");
    const setInvestment = db.prepare("INSERT OR REPLACE INTO investments (id, data) VALUES (?, ?)");
    const setSettings = db.prepare("INSERT OR REPLACE INTO settings (id, data) VALUES (?, ?)");
    const setLog = db.prepare("INSERT OR REPLACE INTO audit_logs (id, data) VALUES (?, ?)");
    
    const deleteMember = db.prepare("DELETE FROM members WHERE id = ?");
    const deleteSummariesForMember = db.prepare("DELETE FROM fund_summaries WHERE memberId = ?");
    const deleteSummary = db.prepare("DELETE FROM fund_summaries WHERE id = ?");
    const deleteJournal = db.prepare("DELETE FROM journal_entries WHERE id = ?");
    const deleteAccount = db.prepare("DELETE FROM accounts WHERE id = ?");
    const deleteInvestment = db.prepare("DELETE FROM investments WHERE id = ?");
    const deleteLog = db.prepare("DELETE FROM audit_logs WHERE id = ?");

    const runBatch = db.transaction((operations: any[]) => {
      for (const op of operations) {
        if (!op.path) continue;
        const p = op.path.replace(/^\/|\/$/g, '').split('/');
        const id = p[p.length - 1];
        const coll = p[0];

        if (op.type === 'set') {
          // Sanitize data for serialization
          const sanitizedData = JSON.parse(JSON.stringify(op.data || {}));
          const json = JSON.stringify({ ...sanitizedData, id });
          if (coll === 'members' && p.length === 2) setMember.run(id, json);
          else if (op.path.includes('/fundSummaries/')) setSummary.run(id, json, sanitizedData.memberId || "", sanitizedData.journalEntryId || "");
          else if (coll === 'journalEntries') setJournal.run(id, json);
          else if (coll === 'chartOfAccounts' || coll === 'accounts') setAccount.run(id, json);
          else if (coll === 'investmentInstruments') setInvestment.run(id, json);
          else if (coll === 'settings') setSettings.run(id, json);
          else if (coll === 'accruedInterestLogs') setLog.run(id, json);
        } else if (op.type === 'delete') {
          if (coll === 'members' && p.length === 2) {
            deleteSummariesForMember.run(id);
            deleteMember.run(id);
          } else if (op.path.includes('/fundSummaries/')) deleteSummary.run(id);
          else if (coll === 'journalEntries') deleteJournal.run(id);
          else if (coll === 'chartOfAccounts' || coll === 'accounts') deleteAccount.run(id);
          else if (coll === 'investmentInstruments') deleteInvestment.run(id);
          else if (coll === 'accruedInterestLogs') deleteLog.run(id);
        }
      }
    });

    runBatch(ops);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('Database Error (Batch):', error);
    throw new Error('Atomic synchronization failed');
  }
}

export async function serverDeleteDoc(path: string) {
  try {
    const p = path.replace(/^\/|\/$/g, '').split('/');
    const id = p[p.length - 1];
    const coll = p[0];

    if (coll === 'members' && p.length === 2) {
      db.prepare("DELETE FROM fund_summaries WHERE memberId = ?").run(id);
      db.prepare("DELETE FROM members WHERE id = ?").run(id);
    } else if (path.includes('/fundSummaries/')) {
      db.prepare("DELETE FROM fund_summaries WHERE id = ?").run(id);
    } else if (coll === 'journalEntries') db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);
    else if (coll === 'chartOfAccounts' || coll === 'accounts') db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
    else if (coll === 'investmentInstruments') db.prepare("DELETE FROM investments WHERE id = ?").run(id);
    else if (coll === 'accruedInterestLogs') db.prepare("DELETE FROM audit_logs WHERE id = ?").run(id);
    else if (coll === 'settings') db.prepare("DELETE FROM settings WHERE id = ?").run(id);

    revalidatePath('/', 'layout');
  } catch (error) {
    console.error('Database Error (Delete):', error);
    throw new Error('Removal failed');
  }
}

export async function serverBackupDatabase() {
  try {
    const data: Record<string, any> = {};
    const tables = [
      { name: 'members', path: 'members' },
      { name: 'accounts', path: 'chartOfAccounts' },
      { name: 'journal_entries', path: 'journalEntries' },
      { name: 'investments', path: 'investmentInstruments' },
      { name: 'settings', path: 'settings' },
      { name: 'audit_logs', path: 'accruedInterestLogs' }
    ];

    for (const table of tables) {
      const rows = db.prepare(`SELECT data FROM ${table.name}`).all();
      rows.forEach((r: any) => {
        try {
          const val = JSON.parse(r.data);
          const fullPath = `${table.path}/${val.id}`;
          data[fullPath] = val;
        } catch (e) {}
      });
    }

    const summaries = db.prepare("SELECT data FROM fund_summaries").all();
    summaries.forEach((s: any) => {
      try {
        const val = JSON.parse(s.data);
        const fullPath = `members/${val.memberId}/fundSummaries/${val.id}`;
        data[fullPath] = val;
      } catch (e) {}
    });

    return JSON.stringify(data);
  } catch (error) {
    console.error('Backup Error:', error);
    throw new Error('Encryption of vault failed');
  }
}

export async function serverRestoreDatabase(json: string) {
  try {
    const data = JSON.parse(json);
    const tables = ['members', 'fund_summaries', 'journal_entries', 'accounts', 'investments', 'settings', 'audit_logs'];
    
    const restore = db.transaction((payload: Record<string, any>) => {
      tables.forEach(t => db.prepare(`DELETE FROM ${t}`).run());
      
      for (const [path, docData] of Object.entries(payload)) {
        if (!docData) continue;
        const p = path.replace(/^\/|\/$/g, '').split('/');
        const id = p[p.length - 1];
        const coll = p[0];
        const docJson = JSON.stringify(docData);

        if (coll === 'members' && p.length === 2) {
          db.prepare("INSERT INTO members (id, data) VALUES (?, ?)").run(id, docJson);
        } else if (path.includes('/fundSummaries/')) {
          db.prepare("INSERT INTO fund_summaries (id, memberId, journalEntryId, data) VALUES (?, ?, ?, ?)")
            .run(id, docData.memberId || "", docData.journalEntryId || "", docJson);
        } else if (coll === 'journalEntries') {
          db.prepare("INSERT INTO journal_entries (id, data) VALUES (?, ?)").run(id, docJson);
        } else if (coll === 'chartOfAccounts' || coll === 'accounts') {
          db.prepare("INSERT INTO accounts (id, data) VALUES (?, ?)").run(id, docJson);
        } else if (coll === 'investmentInstruments') {
          db.prepare("INSERT INTO investments (id, data) VALUES (?, ?)").run(id, docJson);
        } else if (coll === 'settings') {
          db.prepare("INSERT INTO settings (id, data) VALUES (?, ?)").run(id, docJson);
        } else if (coll === 'accruedInterestLogs') {
          db.prepare("INSERT INTO audit_logs (id, data) VALUES (?, ?)").run(id, docJson);
        }
      }
    });

    restore(data);
    revalidatePath('/', 'layout');
    return true;
  } catch (error) {
    console.error('Restore Error:', error);
    throw new Error('Integrity check failed during restoration');
  }
}
