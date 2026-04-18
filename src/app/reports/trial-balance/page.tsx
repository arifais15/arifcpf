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
  Scale,
  ShieldCheck,
  Search,
  ArrowLeft
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function TrialBalancePage() {
  const firestore = useFirestore();
  const [asOfDate, setAsOfDate] = useState("");
  const [search, setSearch] = useState("");

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  useEffect(() => {
    setAsOfDate(new Date().toISOString().split('T')[0]);
  }, []);

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData } = useCollection(coaRef);
  const activeCOA = useMemo(() => {
    const data = coaData && coaData.length > 0 ? coaData : INITIAL_COA;
    return data.sort((a: any, b: any) => (a.code || a.accountCode).localeCompare(b.code || b.accountCode));
  }, [coaData]);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: allEntries, isLoading } = useCollection(entriesRef);

  const trialBalanceData = useMemo(() => {
    if (!allEntries || !asOfDate) return [];
    const cutOff = new Date(`${asOfDate}T23:59:59`).getTime();

    // 1. Aggregate all balances by account code
    const balances: Record<string, { debit: number, credit: number }> = {};
    
    allEntries.forEach(entry => {
      if (new Date(entry.entryDate).getTime() <= cutOff) {
        (entry.lines || []).forEach((line: any) => {
          if (!balances[line.accountCode]) {
            balances[line.accountCode] = { debit: 0, credit: 0 };
          }
          balances[line.accountCode].debit += (Number(line.debit) || 0);
          balances[line.accountCode].credit += (Number(line.credit) || 0);
        });
      }
    });

    // 2. Map COA and calculate final balances
    return activeCOA.map(acc => {
      const code = acc.code || acc.accountCode;
      const aggregated = balances[code] || { debit: 0, credit: 0 };
      
      let finalDebit = 0;
      let finalCredit = 0;

      // Netting logic for trial balance
      if (aggregated.debit > aggregated.credit) {
        finalDebit = aggregated.debit - aggregated.credit;
      } else {
        finalCredit = aggregated.credit - aggregated.debit;
      }

      return {
        code,
        name: acc.name || acc.accountName,
        debit: finalDebit,
        credit: finalCredit,
        isHeader: acc.isHeader,
        type: acc.type || acc.accountType
      };
    }).filter(row => 
      !row.isHeader && (row.debit !== 0 || row.credit !== 0) &&
      (row.name.toLowerCase().includes(search.toLowerCase()) || row.code.includes(search))
    );
  }, [allEntries, activeCOA, asOfDate, search]);

  const stats = useMemo(() => {
    return trialBalanceData.reduce((acc, curr) => ({
      debit: acc.debit + curr.debit,
      credit: acc.credit + curr.credit
    }), { debit: 0, credit: 0 });
  }, [trialBalanceData]);

  const isBalanced = Math.abs(stats.debit - stats.credit) < 0.01;

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-primary" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-[#000000]">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/reports" className="p-2 border-2 border-black rounded-full hover:bg-slate-100 transition-colors">
            <ArrowLeft className="size-6 text-black" />
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Trial Balance</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">
              Institutional Mathematical Reconciliation Matrix
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border-2 border-black shadow-xl">
          <div className="grid gap-1">
            <Label className="text-[9px] font-black uppercase text-black ml-1">As of Date</Label>
            <Input 
              type="date" 
              value={asOfDate} 
              max="9999-12-31" 
              onChange={(e) => setAsOfDate(e.target.value)} 
              className="h-9 w-40 border-black border-2 font-black text-xs text-black" 
            />
          </div>
          <div className="h-8 w-px bg-black/20" />
          <Button onClick={() => window.print()} className="h-10 bg-black text-white font-black text-[10px] px-10 uppercase tracking-widest shadow-xl">
            <Printer className="size-4 mr-2" /> Print Statement
          </Button>
        </div>
      </div>

      {/* Trial Balance Status Cards */}
      <div className="grid gap-6 md:grid-cols-3 no-print">
        <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
          <p className="text-[10px] font-black uppercase text-black/60 tracking-widest mb-1">Total Debits</p>
          <div className="text-2xl font-black tabular-nums">৳ {stats.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6">
          <p className="text-[10px] font-black uppercase text-black/60 tracking-widest mb-1">Total Credits</p>
          <div className="text-2xl font-black tabular-nums">৳ {stats.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className={cn(
          "border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 flex flex-col justify-center",
          isBalanced ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"
        )}>
          <div className="flex items-center gap-3">
            <ShieldCheck className={cn("size-6", isBalanced ? "text-emerald-600" : "text-rose-600")} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest">Balance Status</p>
              <p className="text-xl font-black uppercase">{isBalanced ? "Balanced" : "Discrepancy Detected"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Trial Balance Matrix */}
      <div className="bg-white border-2 border-black rounded-none shadow-2xl overflow-hidden print-container">
        <div className="p-3 border-b-2 border-black bg-slate-50 flex items-center justify-between no-print">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 opacity-40 text-black" />
            <Input 
              className="pl-8 h-8 border-black border-2 font-black text-[10px] bg-white text-black" 
              placeholder="Search Code or Account Name..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <Badge className="bg-black text-white font-black text-[9px] uppercase tracking-widest rounded-none">
            {trialBalanceData.length} Active Accounts
          </Badge>
        </div>

        <Table className="text-black font-black tabular-nums border-collapse">
          <TableHeader className="bg-slate-100 border-b-2 border-black uppercase text-[9px]">
            <TableRow>
              <TableHead className="w-[120px] border-r-2 border-black p-4 font-black text-black">Account Code</TableHead>
              <TableHead className="border-r-2 border-black p-4 font-black text-black">Account Description</TableHead>
              <TableHead className="text-right w-[150px] border-r-2 border-black p-4 font-black text-black">Debit Balance (৳)</TableHead>
              <TableHead className="text-right w-[150px] p-4 font-black text-black">Credit Balance (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-[11px]">
            {trialBalanceData.map((row, i) => (
              <TableRow key={i} className="border-b border-black hover:bg-slate-50 h-10 transition-colors">
                <td className="p-3 pl-4 border-r border-black font-mono font-black">{row.code}</td>
                <td className="p-3 pl-4 border-r border-black uppercase font-black">{row.name}</td>
                <td className="p-3 text-right border-r border-black font-black">
                  {row.debit > 0 ? row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                </td>
                <td className="p-3 text-right font-black">
                  {row.credit > 0 ? row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                </td>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-slate-100 border-t-4 border-black text-black font-black">
            <TableRow className="h-16">
              <TableCell colSpan={2} className="text-right uppercase tracking-[0.4em] text-sm pr-10 border-r-2 border-black">
                Trial Balance Grand Totals:
              </TableCell>
              <TableCell className="text-right text-xl border-r-2 border-black font-black">
                ৳ {stats.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right text-xl font-black">
                ৳ {stats.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Print Footer */}
      <div className="hidden print:block mt-32">
        <div className="grid grid-cols-3 gap-16 text-[12px] font-black text-center uppercase tracking-widest">
          <div className="border-t-2 border-black pt-4">Prepared by</div>
          <div className="border-t-2 border-black pt-4">Checked by</div>
          <div className="border-t-2 border-black pt-4">Approved by Trustee</div>
        </div>
        <div className="mt-20 pt-4 border-t-2 border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
          <span>CPF Management Software trial balance matrix</span>
          <span className="italic">Institutional Trust Registry v1.0</span>
        </div>
      </div>

      {/* Digital Footer */}
      <div className="no-print mt-auto pt-10 border-t flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          <span>Statutory Compliance v1.0</span>
        </div>
        <p className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</p>
      </div>
    </div>
  );
}
