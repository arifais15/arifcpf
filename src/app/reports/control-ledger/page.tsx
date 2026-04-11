"use client"

import React, { useMemo, useState } from "react";
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

  // Date Logic for default FY
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
  const today = now.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: fyStart, end: today });
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData } = useCollection(coaRef);
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData]);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: allEntries, isLoading } = useCollection(entriesRef);

  const ledgerData = useMemo(() => {
    if (!allEntries || !selectedAccount) return [];

    const account = activeCOA.find(a => a.code === selectedAccount);
    if (!account) return [];

    const filtered = allEntries
      .flatMap(entry => (entry.lines || [])
        .filter((line: any) => line.accountCode === selectedAccount)
        .map((line: any) => ({
          date: entry.entryDate,
          ref: entry.referenceNumber || "AUTO",
          particulars: entry.description,
          memo: line.memo,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          timestamp: new Date(entry.entryDate).getTime()
        }))
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    // Apply date filter
    let processed = filtered;
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      processed = filtered.filter(item => item.timestamp >= s && item.timestamp <= e);
    }

    // Calculate Running Balance
    let currentBalance = 0;
    return processed.map(item => {
      if (account.balance === 'Debit') {
        currentBalance += (item.debit - item.credit);
      } else {
        currentBalance += (item.credit - item.debit);
      }
      return { ...item, balance: currentBalance };
    });
  }, [allEntries, selectedAccount, activeCOA, dateRange]);

  const exportToExcel = () => {
    if (ledgerData.length === 0) return;
    const data = ledgerData.map(item => ({
      "Date": item.date,
      "Ref No": item.ref,
      "Particulars": item.particulars,
      "Line Memo": item.memo,
      "Debit (৳)": item.debit,
      "Credit (৳)": item.credit,
      "Running Balance (৳)": item.balance
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GL Ledger");
    XLSX.writeFile(wb, `GL_Control_Ledger_${selectedAccount}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Exported", description: "Ledger trail saved to Excel." });
  };

  const selectedAccountName = useMemo(() => {
    return activeCOA.find(a => a.code === selectedAccount)?.name || "Search Account";
  }, [selectedAccount, activeCOA]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <BookText className="size-8 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-primary tracking-tight">GL Control Ledger</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Trace transactions and running balances for any GL code</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={!selectedAccount} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-10 font-bold">
            <FileSpreadsheet className="size-4" /> Excel Trail
          </Button>
          <Button onClick={() => window.print()} disabled={!selectedAccount} className="gap-2 h-10 font-bold shadow-lg shadow-primary/20">
            <Printer className="size-4" /> Print Ledger
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
        <div className="flex-1 w-full space-y-1.5">
          <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">General Ledger Account Code</Label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="h-11 font-bold border-slate-200">
              <SelectValue placeholder="Search COA Account..." />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {activeCOA.filter(a => !a.isHeader).map(a => (
                <SelectItem key={a.code} value={a.code} className="py-2">
                  <span className="font-mono text-xs opacity-50 mr-2">{a.code}</span>
                  <span className="font-bold">{a.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-10 w-px bg-slate-100 hidden md:block" />

        <div className="flex items-center gap-3">
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-bold text-slate-400">Date From</Label>
            <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 text-xs border-slate-200 font-bold" />
          </div>
          <ArrowRightLeft className="size-3 text-slate-300 mt-4" />
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-bold text-slate-400">Date To</Label>
            <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 text-xs border-slate-200 font-bold" />
          </div>
        </div>
      </div>

      {!selectedAccount ? (
        <div className="bg-slate-50 border-2 border-dashed rounded-3xl p-24 text-center space-y-4 no-print">
          <Filter className="size-16 text-slate-200 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-400">Audit View Pending</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">Select an account from the Chart of Accounts to generate its detailed audit trail and running balance analysis.</p>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-white border-primary/20 text-primary font-mono text-xs py-1 px-3">
                {selectedAccount}
              </Badge>
              <h2 className="text-sm font-bold text-slate-800">{selectedAccountName}</h2>
            </div>
            <Badge variant="outline" className="bg-white border-slate-200">
              {ledgerData.length} Vouchers Audited
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-4">Date</TableHead>
                  <TableHead className="py-4">Reference</TableHead>
                  <TableHead className="py-4">Particulars & Memo</TableHead>
                  <TableHead className="text-right py-4">Debit (৳)</TableHead>
                  <TableHead className="text-right py-4">Credit (৳)</TableHead>
                  <TableHead className="text-right py-4">Running Balance (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                ) : ledgerData.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-16 text-muted-foreground italic">No transactions found for this account in the specified range.</TableCell></TableRow>
                ) : ledgerData.map((item, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="font-mono text-xs font-bold text-slate-600 p-4">{item.date}</td>
                    <td className="p-4">
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono px-2 py-0.5">{item.ref}</Badge>
                    </td>
                    <td className="p-4 max-w-[350px]">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">{item.particulars}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1 italic">{item.memo}</span>
                      </div>
                    </td>
                    <td className="text-right font-medium p-4 text-blue-600">
                      {item.debit > 0 ? `৳ ${item.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                    </td>
                    <td className="text-right font-medium p-4 text-rose-600">
                      {item.credit > 0 ? `৳ ${item.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                    </td>
                    <td className="text-right font-black text-slate-900 p-4 bg-slate-50/50 group-hover:bg-primary/5 transition-colors">
                      ৳ {item.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-slate-100/80 font-black">
                <TableRow>
                  <TableCell colSpan={3} className="text-right uppercase text-[9px]">Period End Position:</TableCell>
                  <TableCell className="text-right text-[10px] text-blue-700">
                    ৳ {ledgerData.reduce((s, r) => s + r.debit, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-[10px] text-rose-700">
                    ৳ {ledgerData.reduce((s, r) => s + r.credit, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-base text-primary underline decoration-double">
                    ৳ {ledgerData[ledgerData.length - 1]?.balance.toLocaleString() || "0.00"}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}

      {/* Landscape Institutional Print View */}
      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <h2 className="text-lg font-bold underline underline-offset-4 uppercase">Control Account Ledger Statement</h2>
          <div className="flex justify-between text-[10px] font-bold pt-4">
            <div className="text-left">
              <p>Account: {selectedAccount} - {activeCOA.find(a => a.code === selectedAccount)?.name}</p>
              <p>Audit Period: {dateRange.start || "Beginning"} to {dateRange.end || "Present"}</p>
            </div>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-2 text-center w-[80px]">Date</th>
              <th className="border border-black p-2 text-center w-[100px]">Ref No</th>
              <th className="border border-black p-2 text-left">Particulars & Memo</th>
              <th className="border border-black p-2 text-right">Debit (৳)</th>
              <th className="border border-black p-2 text-right">Credit (৳)</th>
              <th className="border border-black p-2 text-right">Balance (৳)</th>
            </tr>
          </thead>
          <tbody>
            {ledgerData.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black p-2 text-center font-mono">{item.date}</td>
                <td className="border border-black p-2 text-center">{item.ref}</td>
                <td className="border border-black p-2">
                  <span className="font-bold">{item.particulars}</span><br/>
                  <span className="text-[8px] italic">{item.memo}</span>
                </td>
                <td className="border border-black p-2 text-right">{item.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right">{item.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right font-bold">{item.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
          <div className="border-t border-black pt-2">Accountant / AGM(F)</div>
          <div className="border-t border-black pt-2">Internal Auditor / DGM</div>
          <div className="border-t border-black pt-2">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
