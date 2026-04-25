
'use server';

import { db } from '@/lib/server-db';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server Actions for Database Bridge
 * Optimized for high-speed local persistence in the Project Folder.
 */

export async function serverGetCollection(path: string) {
  const p = path.replace(/^\/|\/$/g, '');
  let rows: any[] = [];

  if (p === 'members') rows = db.prepare("SELECT data FROM members").all();
  else if (p === 'chartOfAccounts') rows = db.prepare("SELECT data FROM accounts").all();
  else if (p === 'journalEntries') rows = db.prepare("SELECT data FROM journal_entries").all();
  else if (p === 'investmentInstruments') rows = db.prepare("SELECT data FROM investments").all();
  else if (p === 'fundSummaries') rows = db.prepare("SELECT data FROM fund_summaries").all();
  else if (p.includes('/fundSummaries')) {
    const mid = p.split('/')[1];
    rows = db.prepare("SELECT data FROM fund_summaries WHERE memberId = ?").all(mid);
  } else if (p.startsWith('settings')) rows = db.prepare("SELECT data FROM settings").all();
  else if (p === 'accruedInterestLogs') rows = db.prepare("SELECT data FROM audit_logs").all();

  return rows.map(r => JSON.parse(r.data));
}

export async function serverGetDoc(path: string) {
  const p = path.replace(/^\/|\/$/g, '').split('/');
  const id = p[p.length - 1];
  const coll = p[0];

  let table = 'settings';
  if (path.includes('/fundSummaries/')) table = 'fund_summaries';
  else if (coll === 'members') table = 'members';
  else if (coll === 'journalEntries') table = 'journal_entries';
  else if (coll === 'chartOfAccounts') table = 'accounts';
  else if (coll === 'investmentInstruments') table = 'investments';
  else if (coll === 'accruedInterestLogs') table = 'audit_logs';

  const row: any = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
  return row ? JSON.parse(row.data) : null;
}

export async function serverSetDoc(path: string, data: any) {
  const p = path.replace(/^\/|\/$/g, '').split('/');
  const id = p[p.length - 1];
  const coll = p[0];

  let table = "";
  let extraCols = "";
  let placeholders = "";
  let binds = [id, JSON.stringify({ ...data, id })];

  if (coll === 'members' && p.length === 2) table = "members";
  else if (path.includes('/fundSummaries/')) {
    table = "fund_summaries";
    extraCols = ", memberId, journalEntryId";
    placeholders = ", ?, ?";
    binds.push(data.memberId || "", data.journalEntryId || "");
  } else if (coll === 'journalEntries') table = "journal_entries";
  else if (coll === 'chartOfAccounts') table = "accounts";
  else if (coll === 'investmentInstruments') table = "investments";
  else if (coll === 'settings') table = "settings";
  else if (coll === 'accruedInterestLogs') table = "audit_logs";

  if (table) {
    db.prepare(`INSERT OR REPLACE INTO ${table} (id, data${extraCols}) VALUES (?, ?${placeholders})`).run(...binds);
    revalidatePath('/');
  }
}

/**
 * ATOMIC BATCH ENGINE
 * Processes thousands of records in a single SQL transaction.
 */
export async function serverExecuteBatch(ops: { type: 'set' | 'delete', path: string, data?: any }[]) {
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
      const p = op.path.replace(/^\/|\/$/g, '').split('/');
      const id = p[p.length - 1];
      const coll = p[0];

      if (op.type === 'set') {
        const json = JSON.stringify({ ...op.data, id });
        if (coll === 'members' && p.length === 2) setMember.run(id, json);
        else if (op.path.includes('/fundSummaries/')) setSummary.run(id, json, op.data.memberId || "", op.data.journalEntryId || "");
        else if (coll === 'journalEntries') setJournal.run(id, json);
        else if (coll === 'chartOfAccounts') setAccount.run(id, json);
        else if (coll === 'investmentInstruments') setInvestment.run(id, json);
        else if (coll === 'settings') setSettings.run(id, json);
        else if (coll === 'accruedInterestLogs') setLog.run(id, json);
      } else if (op.type === 'delete') {
        if (coll === 'members' && p.length === 2) {
          deleteSummariesForMember.run(id);
          deleteMember.run(id);
        } else if (op.path.includes('/fundSummaries/')) deleteSummary.run(id);
        else if (coll === 'journalEntries') deleteJournal.run(id);
        else if (coll === 'chartOfAccounts') deleteAccount.run(id);
        else if (coll === 'investmentInstruments') deleteInvestment.run(id);
        else if (coll === 'accruedInterestLogs') deleteLog.run(id);
      }
    }
  });

  runBatch(ops);
  revalidatePath('/');
}

export async function serverDeleteDoc(path: string) {
  const p = path.replace(/^\/|\/$/g, '').split('/');
  const id = p[p.length - 1];
  const coll = p[0];

  if (coll === 'members' && p.length === 2) {
    db.prepare("DELETE FROM fund_summaries WHERE memberId = ?").run(id);
    db.prepare("DELETE FROM members WHERE id = ?").run(id);
  } else if (path.includes('/fundSummaries/')) {
    db.prepare("DELETE FROM fund_summaries WHERE id = ?").run(id);
  } else if (coll === 'journalEntries') db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);
  else if (coll === 'chartOfAccounts') db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
  else if (coll === 'investmentInstruments') db.prepare("DELETE FROM investments WHERE id = ?").run(id);
  else if (coll === 'accruedInterestLogs') db.prepare("DELETE FROM audit_logs WHERE id = ?").run(id);
  else if (coll === 'settings') db.prepare("DELETE FROM settings WHERE id = ?").run(id);

  revalidatePath('/');
}
