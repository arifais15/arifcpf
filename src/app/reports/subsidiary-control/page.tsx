
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
  LayoutList,
  User,
  Tags,
  CalendarDays,
  BookOpenCheck,
  Info
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

const SUBSIDIARY_COLUMNS = [
  { key: 'employeeContribution', label: 'Col 1: Employee Contribution' },
  { key: 'loanWithdrawal', label: 'Col 2: Loan Withdrawal' },
  { key: 'loanRepayment', label: 'Col 3: Loan Repayment' },
  { key: 'profitEmployee', label: 'Col 5: Profit on Employee Cont.' },
  { key: 'profitLoan', label: 'Col 6: Profit on Loan' },
  { key: 'pbsContribution', label: 'Col 8: PBS Contribution' },
  { key: 'profitPbs', label: 'Col 9: Profit on PBS Cont.' },
];

export default function SubsidiaryControlLedgerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
  const today = now.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: fyStart, end: today });
  const [selectedColumn, setSelectedColumn] = useState<string>("employeeContribution");
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"ledger" | "institutional" | "daily">("institutional");

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading } = useCollection(summariesRef);

  const institutionalLedger = useMemo(() => {
    if (!allSummaries) return [];
    const grouped: Record<string, any> = {};
    allSummaries.forEach(s => {
      const c1 = Number(s.employeeContribution) || 0;
      const c2 = Number(s.loanWithdrawal) || 0;
      const c3 = Number(s.loanRepayment) || 0;
      const c5 = Number(s.profitEmployee) || 0;
      const c6 = Number(s.profitLoan) || 0;
      const c8 = Number(s.pbsContribution) || 0;
      const c9 = Number(s.profitPbs) || 0;
      const netEffect = (c1 + c3 + c5 + c6 + c8 + c9) - c2;
      if (Math.abs(netEffect) < 0.01) return;
      const date = s.summaryDate;
      if (!grouped[date]) grouped[date] = { date, debit: 0, credit: 0, timestamp: new Date(date).getTime(), count: 0 };
      if (netEffect > 0) grouped[date].credit += netEffect; else grouped[date].debit += Math.abs(netEffect);
      grouped[date].count++;
    });
    const sorted = Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);
    let processed = (dateRange.start && dateRange.end) ? sorted.filter((i: any) => i.timestamp >= new Date(dateRange.start).getTime() && i.timestamp <= new Date(dateRange.end).getTime()) : sorted;
    let balance = 0;
    return processed.map((item: any) => { balance += (item.credit - item.debit); return { ...item, particulars: `Daily Fund Activity (${item.count} records)`, balance }; });
  }, [allSummaries, dateRange]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl"><LayoutList className="size-8 text-white" /></div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight">Subsidiary Control</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black">Consolidated audit trail of member fund activities</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="gap-2 h-10 font-black bg-black text-white shadow-lg"><Printer className="size-4" /> Print Ledger</Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 no-print mb-8">
        <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full sm:w-auto">
          <TabsList className="bg-slate-100 p-1 h-11 border-black border-2">
            <TabsTrigger value="institutional" className="font-black data-[state=active]:bg-black data-[state=active]:text-white px-6">Institutional Ledger</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <div className="grid gap-1"><Label className="text-[9px] uppercase font-black text-black">From</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 text-xs border-black font-black text-black" /></div>
          <ArrowRightLeft className="size-3 text-black mt-4" />
          <div className="grid gap-1"><Label className="text-[9px] uppercase font-black text-black">To</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 text-xs border-black font-black text-black" /></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden no-print">
        <Table className="text-black font-black">
          <TableHeader className="bg-slate-50 border-b-2 border-black">
            <TableRow>
              <TableHead className="font-black text-black">Date</TableHead>
              <TableHead className="font-black text-black">Particulars</TableHead>
              <TableHead className="text-right font-black text-black">Debit (৳)</TableHead>
              <TableHead className="text-right font-black text-black">Credit (৳)</TableHead>
              <TableHead className="text-right font-black text-black bg-slate-100">Running Balance (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {institutionalLedger.map((item: any, idx: number) => (
              <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                <td className="font-mono text-xs p-4">{item.date}</td>
                <td className="p-4 text-xs">{item.particulars}</td>
                <td className="text-right p-4">{item.debit.toLocaleString()}</td>
                <td className="text-right p-4">{item.credit.toLocaleString()}</td>
                <td className="text-right p-4 bg-slate-50 font-black">৳ {item.balance.toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-slate-100 font-black border-t-2 border-black">
            <TableRow>
              <TableCell colSpan={2} className="text-right uppercase">Final Total:</TableCell>
              <TableCell className="text-right">{institutionalLedger.reduce((s, r) => s + r.debit, 0).toLocaleString()}</TableCell>
              <TableCell className="text-right">{institutionalLedger.reduce((s, r) => s + r.credit, 0).toLocaleString()}</TableCell>
              <TableCell className="text-right text-base underline decoration-double">৳ {institutionalLedger[institutionalLedger.length-1]?.balance.toLocaleString() || "0.00"}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-8 border-b-4 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-widest">Contributory Provident Fund</p>
          <h2 className="text-lg font-black underline underline-offset-4 uppercase">Subsidiary Control Ledger Statement</h2>
          <div className="flex justify-between text-[10px] font-black pt-4">
            <span>Period: {dateRange.start} to {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <table className="w-full text-[9px] border-collapse border-2 border-black text-black font-black">
          <thead><tr className="bg-slate-100"><th className="border border-black p-2">Date</th><th className="border border-black p-2 text-left">Particulars & Audit Trail</th><th className="border border-black p-2 text-right">Debit</th><th className="border border-black p-2 text-right">Credit</th><th className="border border-black p-2 text-right">Balance</th></tr></thead>
          <tbody>{institutionalLedger.map((item: any, idx: number) => <tr key={idx}><td className="border border-black p-2 text-center font-mono">{item.date}</td><td className="border border-black p-2">{item.particulars}</td><td className="border border-black p-2 text-right">{item.debit.toLocaleString()}</td><td className="border border-black p-2 text-right">{item.credit.toLocaleString()}</td><td className="border border-black p-2 text-right font-black">{item.balance.toLocaleString()}</td></tr>)}</tbody>
        </table>
        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-black text-center text-black">
          <div className="border-t-2 border-black pt-2 uppercase">Prepared by</div>
          <div className="border-t-2 border-black pt-2 uppercase">Checked by</div>
          <div className="border-t-2 border-black pt-2 uppercase">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
