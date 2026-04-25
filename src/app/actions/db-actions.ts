
'use server';

import { db } from '@/lib/server-db';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server Actions for Database Bridge
 * Allows frontend to write directly to the .sqlite3 file in project folder.
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
