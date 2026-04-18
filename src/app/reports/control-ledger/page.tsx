
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
  Printer, 
  Loader2, 
  ArrowRightLeft,
  BookText,
  ShieldCheck
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import { cn } from "@/lib/utils";

export default function ControlAccountLedgerPage() {
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

  const ledgerResult = useMemo(() => {
    if (!allEntries || !selectedAccount || !dateRange.start) return { rows: [], opening: 0, closing: 0 };
    
    const account = activeCOA.find(a => a.code === selectedAccount);
    if (!account) return { rows: [], opening: 0, closing: 0 };

    const startDate = new Date(`${dateRange.start}T00:00:00`).getTime();
    const endDate = new Date(`${dateRange.end}T23:59:59`).getTime();

    const allRelevantLines = allEntries.flatMap(entry => 
      (entry.lines || [])
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
    ).sort((a, b) => a.timestamp - b.timestamp);

    let openingBalance = 0;
    allRelevantLines.forEach(item => {
      if (item.timestamp < startDate) {
        if (account.balance === 'Debit') openingBalance += (item.debit - item.credit);
        else openingBalance += (item.credit - item.debit);
      }
    });

    const periodLines = allRelevantLines.filter(item => item.timestamp >= startDate && item.timestamp <= endDate);

    let currentBalance = openingBalance;
    const rows = periodLines.map(item => {
      if (account.balance === 'Debit') currentBalance += (item.debit - item.credit);
      else currentBalance += (item.credit - item.debit);
      return { ...item, balance: currentBalance };
    });

    return { rows, opening: openingBalance, closing: currentBalance };
  }, [allEntries, selectedAccount, activeCOA, dateRange]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-[#000000]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl shadow-lg"><BookText className="size-8 text-white" /></div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">GL Control Ledger</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Brought Forward Logic • Reconciled Matrix</p>
          </div>
        </div>
        <Button onClick={() => window.print()} disabled={!selectedAccount} className="gap-2 h-10 font-black bg-black text-white shadow-xl uppercase tracking-widest text-xs px-8">
          <Printer className="size-4" /> Print Control Ledger
        </Button>
      </div>

      <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-2xl flex flex-col md:flex-row items-center gap-8 no-print">
        <div className="flex-1 w-full space-y-1.5">
          <Label className="text-[10px] font-black uppercase text-black ml-1">General Ledger Account</Label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="h-12 font-black border-4 border-black text-black text-lg"><SelectValue placeholder="Select Account..." /></SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {activeCOA.filter(a => !a.isHeader).map(a => (
                <SelectItem key={a.code} value={a.code} className="font-black text-black">{a.code} - {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border-2 border-black">
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-black text-black text-center">Period From</Label>
            <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 font-black border-2 border-black text-black bg-white" />
          </div>
          <ArrowRightLeft className="size-4 text-black opacity-30 mt-4" />
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-black text-black text-center">Period To</Label>
            <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 font-black border-2 border-black text-black bg-white" />
          </div>
        </div>
      </div>

      {selectedAccount && (
        <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print animate-in fade-in duration-500">
          <div className="p-4 bg-slate-100 border-b-4 border-black flex items-center justify-between">
            <h2 className="text-sm font-black flex items-center gap-3 uppercase tracking-widest">
              <ShieldCheck className="size-5" /> GL Reconciliation Terminal
            </h2>
            <div className="flex gap-4">
              <Badge variant="outline" className="bg-white border-black font-black uppercase text-[10px]">Opening BF: ৳{ledgerResult.opening.toLocaleString()}</Badge>
              <Badge className="bg-black text-white font-black uppercase text-[10px]">Closing CF: ৳{ledgerResult.closing.toLocaleString()}</Badge>
            </div>
          </div>
          <Table className="text-black font-black tabular-nums">
            <TableHeader>
              <TableRow className="bg-slate-50 border-b-2 border-black">
                <TableHead className="font-black text-black uppercase text-[10px] py-5 pl-6">Date</TableHead>
                <TableHead className="font-black text-black uppercase text-[10px] py-5">Ref No</TableHead>
                <TableHead className="font-black text-black uppercase text-[10px] py-5">Particulars</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] py-5">Debit (৳)</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] py-5">Credit (৳)</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5 bg-slate-100 pr-6">Balance (৳)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-slate-50/50 italic border-b-2 border-black h-12">
                <td className="p-4 pl-6 font-mono text-xs">{dateRange.start}</td>
                <td className="p-4 text-center">—</td>
                <td className="p-4 uppercase text-[11px] font-black">Opening Balance Brought Forward</td>
                <td className="text-right p-4">—</td>
                <td className="text-right p-4">—</td>
                <td className="text-right p-4 pr-6 font-black bg-slate-100/50">৳ {ledgerResult.opening.toLocaleString()}</td>
              </TableRow>
              {ledgerResult.rows.map((item, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                  <td className="font-mono text-xs p-4 pl-6">{item.date}</td>
                  <td className="p-4 text-xs font-mono">{item.ref}</td>
                  <td className="p-4 uppercase text-[11px] font-black">{item.particulars}</td>
                  <td className="text-right p-4">{item.debit > 0 ? item.debit.toLocaleString() : "—"}</td>
                  <td className="text-right p-4">{item.credit > 0 ? item.credit.toLocaleString() : "—"}</td>
                  <td className="text-right p-4 bg-slate-50 font-black text-lg pr-6 underline">৳ {item.balance.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
