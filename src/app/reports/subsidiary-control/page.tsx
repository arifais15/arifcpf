
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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

const SUBSIDIARY_COLUMNS = [
  { key: 'employeeContribution', label: 'Col 1: Employee Contribution', balance: 'Credit' },
  { key: 'loanWithdrawal', label: 'Col 2: Loan Withdrawal', balance: 'Debit' },
  { key: 'loanRepayment', label: 'Col 3: Loan Repayment', balance: 'Credit' },
  { key: 'profitEmployee', label: 'Col 5: Profit on Employee Cont.', balance: 'Credit' },
  { key: 'profitLoan', label: 'Col 6: Profit on Loan', balance: 'Credit' },
  { key: 'pbsContribution', label: 'Col 8: PBS Contribution', balance: 'Credit' },
  { key: 'profitPbs', label: 'Col 9: Profit on PBS Cont.', balance: 'Credit' },
];

export default function SubsidiaryControlLedgerPage() {
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
  const [selectedColumn, setSelectedColumn] = useState<string>("employeeContribution");
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"ledger" | "institutional" | "daily">("institutional");
  const [drillDownData, setDrillDownData] = useState<{ date: string, type: 'Debit' | 'Credit', records: any[] } | null>(null);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading } = useCollection(summariesRef);

  const getMemberInfo = (memberId: string) => {
    const member = members?.find(m => m.id === memberId);
    return member ? { name: member.name, idNo: member.memberIdNumber } : { name: "Unknown", idNo: memberId };
  };

  // VIEW 1: CATEGORY LEDGER (Trace a single column)
  const ledgerData = useMemo(() => {
    if (!allSummaries || !selectedColumn) return [];
    const colConfig = SUBSIDIARY_COLUMNS.find(c => c.key === selectedColumn);
    if (!colConfig) return [];

    const grouped: Record<string, any> = {};

    allSummaries.forEach(s => {
      const amount = Number(s[selectedColumn]) || 0;
      if (amount === 0) return;
      if (selectedMember !== "all" && s.memberId !== selectedMember) return;

      const date = s.summaryDate;
      if (!grouped[date]) {
        grouped[date] = { date, debit: 0, credit: 0, timestamp: new Date(date).getTime(), count: 0, debitRecords: [], creditRecords: [] };
      }

      const memberInfo = getMemberInfo(s.memberId);
      const record = { ...s, memberName: memberInfo.name, memberIdNo: memberInfo.idNo, amount: Math.abs(amount) };

      if (colConfig.balance === 'Debit') {
        if (amount > 0) { grouped[date].debit += amount; grouped[date].debitRecords.push(record); }
        else { grouped[date].credit += Math.abs(amount); grouped[date].creditRecords.push(record); }
      } else {
        if (amount > 0) { grouped[date].credit += amount; grouped[date].creditRecords.push(record); }
        else { grouped[date].debit += Math.abs(amount); grouped[date].debitRecords.push(record); }
      }
      grouped[date].count++;
    });

    const sorted = Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);
    let processed = sorted;
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      processed = sorted.filter((item: any) => item.timestamp >= s && item.timestamp <= e);
    }

    let balance = 0;
    return processed.map((item: any) => {
      balance += colConfig.balance === 'Debit' ? (item.debit - item.credit) : (item.credit - item.debit);
      return { ...item, particulars: `Daily Summary (${item.count} members)`, balance };
    });
  }, [allSummaries, selectedColumn, selectedMember, dateRange, members]);

  // VIEW 2: INSTITUTIONAL TOTAL FUND
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

      const netCreditEffect = (c1 + c3 + c5 + c6 + c8 + c9) - c2;
      if (Math.abs(netCreditEffect) < 0.01) return;

      const date = s.summaryDate;
      if (!grouped[date]) {
        grouped[date] = { date, debit: 0, credit: 0, timestamp: new Date(date).getTime(), count: 0, debitRecords: [], creditRecords: [] };
      }

      const memberInfo = getMemberInfo(s.memberId);
      const record = { ...s, memberName: memberInfo.name, memberIdNo: memberInfo.idNo, amount: Math.abs(netCreditEffect) };

      if (netCreditEffect > 0) { grouped[date].credit += netCreditEffect; grouped[date].creditRecords.push(record); }
      else { grouped[date].debit += Math.abs(netCreditEffect); grouped[date].debitRecords.push(record); }
      grouped[date].count++;
    });

    const sorted = Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);
    let processed = sorted;
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      processed = sorted.filter((item: any) => item.timestamp >= s && item.timestamp <= e);
    }

    let balance = 0;
    return processed.map((item: any) => {
      balance += (item.credit - item.debit);
      return { ...item, particulars: `Daily Fund Activity (${item.count} records)`, balance };
    });
  }, [allSummaries, dateRange, members]);

  // VIEW 3: DAILY MATRIX
  const dailySummaryData = useMemo(() => {
    if (!allSummaries) return [];
    const grouped: Record<string, any> = {};
    allSummaries.forEach(s => {
      const date = s.summaryDate;
      if (!grouped[date]) {
        grouped[date] = { date, timestamp: new Date(date).getTime(), c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0, totalDr: 0, totalCr: 0, drRecs: [], crRecs: [] };
      }
      const v = { c1: Number(s.employeeContribution)||0, c2: Number(s.loanWithdrawal)||0, c3: Number(s.loanRepayment)||0, c5: Number(s.profitEmployee)||0, c6: Number(s.profitLoan)||0, c8: Number(s.pbsContribution)||0, c9: Number(s.profitPbs)||0 };
      Object.keys(v).forEach(k => (grouped[date] as any)[k] += (v as any)[k]);
      
      const dr = (v.c2 > 0 ? v.c2 : 0) + [v.c1, v.c3, v.c5, v.c6, v.c8, v.c9].reduce((sum, val) => sum + (val < 0 ? Math.abs(val) : 0), 0);
      const cr = (v.c2 < 0 ? Math.abs(v.c2) : 0) + [v.c1, v.c3, v.c5, v.c6, v.c8, v.c9].reduce((sum, val) => sum + (val > 0 ? val : 0), 0);
      
      const memberInfo = getMemberInfo(s.memberId);
      if (dr > 0) grouped[date].drRecs.push({ ...s, memberName: memberInfo.name, memberIdNo: memberInfo.idNo, amount: dr });
      if (cr > 0) grouped[date].crRecs.push({ ...s, memberName: memberInfo.name, memberIdNo: memberInfo.idNo, amount: cr });
      grouped[date].totalDr += dr; grouped[date].totalCr += cr;
    });
    const sorted = Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);
    return (dateRange.start && dateRange.end) ? sorted.filter((i: any) => i.timestamp >= new Date(dateRange.start).getTime() && i.timestamp <= new Date(dateRange.end).getTime()) : sorted;
  }, [allSummaries, dateRange, members]);

  const exportToExcel = () => {
    const data = viewMode === 'ledger' ? ledgerData : viewMode === 'institutional' ? institutionalLedger : dailySummaryData;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit");
    XLSX.writeFile(wb, `Subsidiary_Control_${viewMode}.xlsx`);
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl"><LayoutList className="size-8 text-primary" /></div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-primary tracking-tight">Subsidiary Control</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Consolidated audit trail of member fund activities</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-10 font-bold"><FileSpreadsheet className="size-4" /> Excel Export</Button>
          <Button onClick={() => window.print()} className="gap-2 h-10 font-bold shadow-lg shadow-primary/20"><Printer className="size-4" /> Print Matrix</Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col gap-6 no-print mb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full sm:w-auto">
            <TabsList className="bg-slate-100 p-1 h-11">
              <TabsTrigger value="institutional" className="gap-2 px-6"><BookOpenCheck className="size-4" /> Institutional Ledger</TabsTrigger>
              <TabsTrigger value="ledger" className="gap-2 px-6"><Tags className="size-4" /> Category Ledger</TabsTrigger>
              <TabsTrigger value="daily" className="gap-2 px-6"><CalendarDays className="size-4" /> Daily Matrix</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-3">
            <div className="grid gap-1"><Label className="text-[9px] uppercase font-bold text-slate-400">Date From</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 text-xs border-slate-200 font-bold" /></div>
            <ArrowRightLeft className="size-3 text-slate-300 mt-4" />
            <div className="grid gap-1"><Label className="text-[9px] uppercase font-bold text-slate-400">Date To</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 text-xs border-slate-200 font-bold" /></div>
          </div>
        </div>
        {viewMode === 'ledger' && (
          <div className="grid gap-6 md:grid-cols-2 border-t pt-6">
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><Tags className="size-3" /> Category</Label><Select value={selectedColumn} onValueChange={setSelectedColumn}><SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger><SelectContent>{SUBSIDIARY_COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2"><User className="size-3" /> Member</Label><Select value={selectedMember} onValueChange={setSelectedMember}><SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger><SelectContent className="max-h-[300px]"><SelectItem value="all">All Institutional</SelectItem>{members?.map(m => <SelectItem key={m.id} value={m.id}>{m.memberIdNumber} - {m.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
        <Table>
          <TableHeader className="bg-muted/30">
            {viewMode === 'daily' ? (
              <TableRow>
                <TableHead>Date</TableHead><TableHead className="text-right">Col 1</TableHead><TableHead className="text-right">Col 2</TableHead><TableHead className="text-right">Col 3</TableHead><TableHead className="text-right">Col 5</TableHead><TableHead className="text-right">Col 6</TableHead><TableHead className="text-right">Col 8</TableHead><TableHead className="text-right">Col 9</TableHead><TableHead className="text-right font-bold text-rose-600">Total Dr</TableHead><TableHead className="text-right font-bold text-emerald-600">Total Cr</TableHead>
              </TableRow>
            ) : (
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Particulars</TableHead><TableHead className="text-right">Debit (৳)</TableHead><TableHead className="text-right">Credit (৳)</TableHead><TableHead className="text-right">Running Balance (৳)</TableHead>
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : (viewMode === 'daily' ? dailySummaryData : (viewMode === 'institutional' ? institutionalLedger : ledgerData)).map((item: any, idx: number) => (
              <TableRow key={idx} className="hover:bg-slate-50/50 group">
                <td className="font-mono text-xs font-bold p-4">{item.date}</td>
                {viewMode === 'daily' ? (
                  <>
                    <td className="text-right p-4 text-[10px]">{item.c1.toLocaleString()}</td><td className="text-right p-4 text-[10px] text-rose-600">{item.c2.toLocaleString()}</td><td className="text-right p-4 text-[10px] text-emerald-600">{item.c3.toLocaleString()}</td><td className="text-right p-4 text-[10px]">{item.c5.toLocaleString()}</td><td className="text-right p-4 text-[10px]">{item.c6.toLocaleString()}</td><td className="text-right p-4 text-[10px]">{item.c8.toLocaleString()}</td><td className="text-right p-4 text-[10px]">{item.c9.toLocaleString()}</td>
                    <td className="text-right p-4 font-bold text-rose-600 cursor-pointer hover:bg-rose-50 rounded" onClick={() => item.totalDr > 0 && setDrillDownData({ date: item.date, type: 'Debit', records: item.drRecs })}>{item.totalDr > 0 ? `৳ ${item.totalDr.toLocaleString()}` : "-"}</td>
                    <td className="text-right p-4 font-bold text-emerald-600 cursor-pointer hover:bg-emerald-50 rounded" onClick={() => item.totalCr > 0 && setDrillDownData({ date: item.date, type: 'Credit', records: item.crRecs })}>{item.totalCr > 0 ? `৳ ${item.totalCr.toLocaleString()}` : "-"}</td>
                  </>
                ) : (
                  <>
                    <td className="p-4 text-xs">{item.particulars}</td>
                    <td className="text-right p-4 text-rose-600 cursor-pointer hover:bg-rose-50 rounded" onClick={() => item.debit > 0 && setDrillDownData({ date: item.date, type: 'Debit', records: item.debitRecords })}>{item.debit > 0 ? `৳ ${item.debit.toLocaleString()}` : "-"}</td>
                    <td className="text-right p-4 text-emerald-600 cursor-pointer hover:bg-emerald-50 rounded" onClick={() => item.credit > 0 && setDrillDownData({ date: item.date, type: 'Credit', records: item.creditRecords })}>{item.credit > 0 ? `৳ ${item.credit.toLocaleString()}` : "-"}</td>
                    <td className="text-right p-4 font-black bg-slate-50 group-hover:bg-primary/5 transition-colors">৳ {item.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
          {viewMode !== 'daily' && (
            <TableFooter className="bg-slate-100/80 font-black">
              <TableRow>
                <TableCell colSpan={2} className="text-right uppercase text-[9px]">Final Total:</TableCell>
                <TableCell className="text-right text-rose-700">৳ {(viewMode === 'institutional' ? institutionalLedger : ledgerData).reduce((s, r) => s + r.debit, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-emerald-700">৳ {(viewMode === 'institutional' ? institutionalLedger : ledgerData).reduce((s, r) => s + r.credit, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-base text-primary underline decoration-double">৳ {(viewMode === 'institutional' ? institutionalLedger : ledgerData)[(viewMode === 'institutional' ? institutionalLedger : ledgerData).length-1]?.balance.toLocaleString() || "0.00"}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <Dialog open={!!drillDownData} onOpenChange={(o) => !o && setDrillDownData(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto font-ledger">
          <DialogHeader className="border-b pb-4 mb-4"><DialogTitle className="flex items-center gap-3 text-xl font-bold"><Info className="size-5 text-primary" /> Daily Voucher Breakdown: {drillDownData?.date}</DialogTitle><DialogDescription>Detailed institutional records for total {drillDownData?.type}s</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border flex justify-between items-center"><span className="text-[10px] uppercase font-black text-slate-400">Total {drillDownData?.type} Amount</span><span className={cn("text-2xl font-black", drillDownData?.type === 'Debit' ? "text-rose-700" : "text-emerald-700")}>৳ {drillDownData?.records.reduce((s, r) => s + r.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="border rounded-xl overflow-hidden shadow-sm"><Table><TableHeader className="bg-slate-100"><TableRow><TableHead className="w-[100px] text-[10px] font-black uppercase">ID No</TableHead><TableHead className="text-[10px] font-black uppercase">Member Name</TableHead><TableHead className="text-[10px] font-black uppercase">Particulars</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Amount (৳)</TableHead></TableRow></TableHeader><TableBody>{drillDownData?.records.map((r, i) => <TableRow key={i} className="hover:bg-slate-50/50"><td className="font-mono text-xs font-bold text-slate-500">{r.memberIdNo}</td><td className="font-bold text-sm">{r.memberName}</td><td className="text-xs italic text-slate-600">{r.particulars || "Voucher Entry"}</td><td className={cn("text-right font-black", drillDownData?.type === 'Debit' ? "text-rose-600" : "text-emerald-600")}>{r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></TableRow>)}</TableBody><TableFooter className="bg-slate-50 font-black"><TableRow><TableCell colSpan={3} className="text-right uppercase text-[9px]">Total Breakdown:</TableCell><TableCell className="text-right underline decoration-double">৳ {drillDownData?.records.reduce((s, r) => s + r.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow></TableFooter></Table></div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6"><h1 className="text-2xl font-black uppercase">{pbsName}</h1><h2 className="text-lg font-bold underline underline-offset-4 uppercase">Subsidiary Control Ledger Statement</h2><div className="flex justify-between text-[10px] font-bold pt-4"><span>Period: {dateRange.start || "Beginning"} to {dateRange.end || "Present"}</span><span>Run Date: {new Date().toLocaleDateString('en-GB')}</span></div></div>
        <table className="w-full text-[9px] border-collapse border border-black"><thead><tr className="bg-slate-100"><th className="border border-black p-2 text-center w-[80px]">Date</th><th className="border border-black p-2 text-left">Particulars & Audit Trail</th><th className="border border-black p-2 text-right">Debit (৳)</th><th className="border border-black p-2 text-right">Credit (৳)</th><th className="border border-black p-2 text-right">Balance (৳)</th></tr></thead><tbody>{(viewMode === 'institutional' ? institutionalLedger : ledgerData).map((item: any, idx: number) => <tr key={idx}><td className="border border-black p-2 text-center font-mono">{item.date}</td><td className="border border-black p-2">{item.particulars}</td><td className="border border-black p-2 text-right">{item.debit.toLocaleString()}</td><td className="border border-black p-2 text-right">{item.credit.toLocaleString()}</td><td className="border border-black p-2 text-right font-bold">{item.balance.toLocaleString()}</td></tr>)}</tbody></table>
        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
          <div className="border-t border-black pt-2 uppercase">Prepared by</div>
          <div className="border-t border-black pt-2 uppercase">Checked by</div>
          <div className="border-t border-black pt-2 uppercase">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
