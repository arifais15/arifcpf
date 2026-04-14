
"use client"

import React, { useMemo, useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  FileSpreadsheet, 
  Printer, 
  Loader2, 
  ArrowRightLeft,
  BookText,
  Filter
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import * as XLSX from "xlsx";

export default function ControlLedgerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setDateRange({ start: fyStart, end: today });
  }, []);

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData } = useCollection(coaRef);
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData]);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: allEntries, isLoading } = useCollection(entriesRef);

  const ledgerData = useMemo(() => {
    if (!allEntries || !selectedAccount) return [];
    const account = activeCOA.find(a => a.code === selectedAccount);
    if (!account) return [];
    const filtered = allEntries.flatMap(entry => (entry.lines || []).filter((line: any) => line.accountCode === selectedAccount).map((line: any) => ({
      date: entry.entryDate, ref: entry.referenceNumber || "AUTO", particulars: entry.description, memo: line.memo,
      debit: Number(line.debit) || 0, credit: Number(line.credit) || 0, timestamp: new Date(entry.entryDate).getTime()
    }))).sort((a, b) => a.timestamp - b.timestamp);
    let processed = filtered;
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      processed = filtered.filter(item => item.timestamp >= s && item.timestamp <= e);
    }
    let currentBalance = 0;
    return processed.map(item => {
      if (account.balance === 'Debit') currentBalance += (item.debit - item.credit);
      else currentBalance += (item.credit - item.debit);
      return { ...item, balance: currentBalance };
    });
  }, [allEntries, selectedAccount, activeCOA, dateRange]);

  const StandardFooter = () => (
    <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
      <span>CPF Management Software</span>
      <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
    </div>
  );

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl"><BookText className="size-8 text-white" /></div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight">GL Control Ledger</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black">Trace transactions and running balances</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} disabled={!selectedAccount} className="gap-2 h-10 font-black bg-black text-white shadow-lg"><Printer className="size-4" /> Print Ledger</Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
        <div className="flex-1 w-full space-y-1.5">
          <Label className="text-[10px] uppercase font-black text-black">GL Account Code</Label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="h-11 font-black border-black border-2 text-black"><SelectValue placeholder="Select Account..." /></SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {activeCOA.filter(a => !a.isHeader).map(a => (
                <SelectItem key={a.code} value={a.code} className="font-black text-black">{a.code} - {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid gap-1"><Label className="text-[9px] uppercase font-black text-black">From</Label><Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 text-xs border-black font-black text-black" /></div>
          <ArrowRightLeft className="size-3 text-black mt-4" />
          <div className="grid gap-1"><Label className="text-[9px] uppercase font-black text-black">To</Label><Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 text-xs border-black font-black text-black" /></div>
        </div>
      </div>

      {selectedAccount && (
        <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden no-print">
          <Table className="text-black font-black">
            <TableHeader className="bg-slate-50 border-b-2 border-black">
              <TableRow>
                <TableHead className="font-black text-black">Date</TableHead>
                <TableHead className="font-black text-black">Ref</TableHead>
                <TableHead className="font-black text-black">Particulars</TableHead>
                <TableHead className="text-right font-black text-black">Debit</TableHead>
                <TableHead className="text-right font-black text-black">Credit</TableHead>
                <TableHead className="text-right font-black text-black bg-slate-100">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerData.map((item, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                  <td className="font-mono text-xs p-4">{item.date}</td>
                  <td className="p-4">{item.ref}</td>
                  <td className="p-4 max-w-[350px]"><div><p>{item.particulars}</p><p className="text-[10px] opacity-70 italic">{item.memo}</p></div></td>
                  <td className="text-right p-4">{item.debit.toLocaleString()}</td>
                  <td className="text-right p-4">{item.credit.toLocaleString()}</td>
                  <td className="text-right p-4 bg-slate-50">৳ {item.balance.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-100 font-black border-t-2 border-black">
              <TableRow>
                <TableCell colSpan={3} className="text-right uppercase">Balance:</TableCell>
                <TableCell className="text-right">{ledgerData.reduce((s, r) => s + r.debit, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right">{ledgerData.reduce((s, r) => s + r.credit, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-base underline decoration-double">৳ {ledgerData[ledgerData.length - 1]?.balance.toLocaleString() || "0.00"}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-8 border-b-4 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-widest">Contributory Provident Fund</p>
          <h2 className="text-lg font-black underline underline-offset-4 uppercase">Control Account Ledger Statement</h2>
          <div className="flex justify-between text-[10px] font-black pt-4">
            <div className="text-left"><p>Account: {selectedAccount} - {activeCOA.find(a => a.code === selectedAccount)?.name}</p></div>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <table className="w-full text-[10px] border-collapse border-2 border-black text-black font-black">
          <thead><tr className="bg-slate-100"><th className="border border-black p-2">Date</th><th className="border border-black p-2">Ref No</th><th className="border border-black p-2 text-left">Particulars & Memo</th><th className="border border-black p-2 text-right">Debit</th><th className="border border-black p-2 text-right">Credit</th><th className="border border-black p-2 text-right">Balance</th></tr></thead>
          <tbody>{ledgerData.map((item, idx) => (<tr key={idx}><td className="border border-black p-2 text-center font-mono">{item.date}</td><td className="border border-black p-2 text-center">{item.ref}</td><td className="border border-black p-2"><b>{item.particulars}</b><br/><span className="text-[8px] italic">{item.memo}</span></td><td className="border border-black p-2 text-right">{item.debit.toLocaleString()}</td><td className="border border-black p-2 text-right">{item.credit.toLocaleString()}</td><td className="border border-black p-2 text-right font-black">{item.balance.toLocaleString()}</td></tr>))}</tbody>
        </table>
        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-black text-center text-black">
          <div className="border-t-2 border-black pt-2 uppercase">Prepared by</div>
          <div className="border-t-2 border-black pt-2 uppercase">Checked by</div>
          <div className="border-t-2 border-black pt-2 uppercase">Approved By Trustee</div>
        </div>
        <StandardFooter />
      </div>
    </div>
  );
}
