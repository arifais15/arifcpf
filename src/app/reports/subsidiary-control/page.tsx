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
  LayoutList,
  History,
  ShieldCheck,
  FileSpreadsheet
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

export default function SubsidiaryControlLedgerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [viewingDayDetails, setViewingDayDetails] = useState<any | null>(null);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setDateRange({ start: fyStart, end: today });
  }, []);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members } = useCollection(membersRef);
  const memberMap = useMemo(() => {
    const map: Record<string, any> = {};
    members?.forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading } = useCollection(summariesRef);

  const ledgerResult = useMemo(() => {
    if (!allSummaries || !dateRange.start) return { rows: [], opening: 0, closing: 0 };
    const startDate = new Date(`${dateRange.start}T00:00:00`).getTime();
    const endDate = new Date(`${dateRange.end}T23:59:59`).getTime();

    let openingBalance = 0;
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
      const timestamp = new Date(s.summaryDate).getTime();

      if (timestamp < startDate) openingBalance += netEffect;
      else if (timestamp <= endDate) {
        const date = s.summaryDate;
        if (!grouped[date]) grouped[date] = { date, debit: 0, credit: 0, timestamp, count: 0, entries: [] };
        if (netEffect > 0) grouped[date].credit += netEffect; 
        else grouped[date].debit += Math.abs(netEffect);
        grouped[date].count++;
        grouped[date].entries.push({ ...s, netEffect });
      }
    });

    const sortedPeriod = Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);
    let currentBalance = openingBalance;
    const rows = sortedPeriod.map((item: any) => { 
      currentBalance += (item.credit - item.debit); 
      return { ...item, particulars: `Consolidated Activity (${item.count} Personnel)`, balance: currentBalance }; 
    });

    return { rows, opening: openingBalance, closing: currentBalance };
  }, [allSummaries, dateRange]);

  const exportToExcel = () => {
    if (ledgerResult.rows.length === 0) return;
    const exportRows = [
      { Date: dateRange.start, Particulars: "Opening Balance Brought Forward", Debit: 0, Credit: 0, Balance: ledgerResult.opening }
    ];

    ledgerResult.rows.forEach(r => {
      exportRows.push({
        Date: r.date,
        Particulars: r.particulars,
        Debit: r.debit,
        Credit: r.credit,
        Balance: r.balance
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subsidiary Control");
    XLSX.writeFile(wb, `Subsidiary_Control_${dateRange.start}_to_${dateRange.end}.xlsx`);
    toast({ title: "Exported", description: "Subsidiary control ledger saved to Excel." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-[#000000]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl shadow-lg"><LayoutList className="size-8 text-white" /></div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Subsidiary Control</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Consolidated Trust Audit Matrix</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="gap-2 h-10 font-black border-black text-black shadow-xl uppercase tracking-widest text-[10px] px-6">
            <FileSpreadsheet className="size-4" /> Export Excel
          </Button>
          <Button onClick={() => window.print()} className="gap-2 h-10 font-black bg-black text-white shadow-xl uppercase tracking-widest text-[10px] px-8">
            <Printer className="size-4" /> Print Control Ledger
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-2xl flex items-center justify-between no-print">
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border-2 border-black">
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-black text-black">Ledger Start</Label>
            <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-2 border-black bg-white" />
          </div>
          <ArrowRightLeft className="size-3 text-black opacity-30 mt-4" />
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-black text-black">Ledger End</Label>
            <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-2 border-black bg-white" />
          </div>
        </div>
        <div className="flex gap-4">
          <Badge variant="outline" className="bg-white border-black font-black uppercase text-[10px]">Opening BF: ৳{ledgerResult.opening.toLocaleString()}</Badge>
          <Badge className="bg-black text-white font-black uppercase text-[10px]">Closing CF: ৳{ledgerResult.closing.toLocaleString()}</Badge>
        </div>
      </div>

      <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print animate-in fade-in duration-500">
        <Table className="text-black font-black tabular-nums">
          <TableHeader>
            <TableRow className="bg-slate-50 border-b-2 border-black">
              <TableHead className="font-black text-black uppercase text-[10px] py-5 pl-6">Date</TableHead>
              <TableHead className="font-black text-black uppercase text-[10px] py-5">Consolidated Particulars</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] py-5">Debit (৳)</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] py-5">Credit (৳)</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5 bg-slate-100 pr-6">Running Balance (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-slate-50/50 italic border-b-2 border-black h-12">
              <td className="p-4 pl-6 font-mono text-xs">{dateRange.start}</td>
              <td className="p-4 uppercase text-[11px] font-black">Opening Balance Brought Forward</td>
              <td className="text-right p-4">—</td>
              <td className="text-right p-4">—</td>
              <td className="text-right p-4 pr-6 font-black bg-slate-100/50">৳ {ledgerResult.opening.toLocaleString()}</td>
            </TableRow>
            {ledgerResult.rows.map((item: any, idx: number) => (
              <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                <td className="font-mono text-xs p-5 pl-6">{item.date}</td>
                <td className="p-5 text-[11px] uppercase opacity-70 font-black">{item.particulars}</td>
                <td className="text-right p-5 text-base cursor-pointer hover:bg-rose-50 font-black text-rose-600" onClick={() => item.debit > 0 && setViewingDayDetails(item)}>{item.debit > 0 ? item.debit.toLocaleString() : "—"}</td>
                <td className="text-right p-5 text-base cursor-pointer hover:bg-emerald-50 font-black text-emerald-600" onClick={() => item.credit > 0 && setViewingDayDetails(item)}>{item.credit > 0 ? item.credit.toLocaleString() : "—"}</td>
                <td className="text-right p-5 bg-slate-50 font-black text-lg pr-6 underline">৳ {item.balance.toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewingDayDetails} onOpenChange={(open) => !open && setViewingDayDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto font-ledger text-black border-4 border-black p-0 rounded-none shadow-2xl">
          <DialogHeader className="p-8 border-b-4 border-black bg-slate-50">
            <DialogTitle className="flex items-center gap-4 text-3xl font-black uppercase tracking-tight">Source Trace Audit</DialogTitle>
            <DialogDescription className="font-mono text-sm font-black text-slate-500 mt-2">Posting Date: {viewingDayDetails?.date}</DialogDescription>
          </DialogHeader>
          <div className="p-8">
            <Table className="font-black text-black tabular-nums border-2 border-black">
              <TableHeader className="bg-slate-100 border-b-2 border-black">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px] py-4 pl-6">ID & Personnel Name</TableHead>
                  <TableHead className="font-black uppercase text-[10px] py-4">Voucher Detail</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] py-4">Debit (৳)</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] py-4 pr-6">Credit (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewingDayDetails?.entries.map((entry: any, i: number) => (
                  <TableRow key={i} className="hover:bg-slate-50 border-b border-black">
                    <td className="p-4 pl-6"><div className="flex flex-col"><span className="font-mono text-xs">{memberMap[entry.memberId]?.memberIdNumber}</span><span className="text-[10px] uppercase opacity-60">{memberMap[entry.memberId]?.name}</span></div></td>
                    <td className="p-4 text-[10px] uppercase truncate">{entry.particulars}</td>
                    <td className="text-right p-4 text-rose-600">{entry.netEffect < 0 ? Math.abs(entry.netEffect).toLocaleString() : "—"}</td>
                    <td className="text-right p-4 pr-6 text-emerald-600">{entry.netEffect > 0 ? entry.netEffect.toLocaleString() : "—"}</td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
