
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
  Search,
  ArrowRightLeft,
  ClipboardCheck,
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function LedgerSummaryReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // Date Logic for default FY
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
  const today = now.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: fyStart, end: today });
  const [search, setSearch] = useState("");

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const reportData = useMemo(() => {
    if (!members || !allSummaries) return [];
    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end).getTime();

    return members.map(member => {
      const memberSummaries = allSummaries.filter(s => s.memberId === member.id);
      const colKeys = ['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'];
      const stats: Record<string, { opening: number, period: number, closing: number }> = {};
      colKeys.forEach(k => stats[k] = { opening: 0, period: 0, closing: 0 });

      memberSummaries.forEach(s => {
        const entryDate = new Date(s.summaryDate).getTime();
        const vals = { c1: Number(s.employeeContribution)||0, c2: Number(s.loanWithdrawal)||0, c3: Number(s.loanRepayment)||0, c5: Number(s.profitEmployee)||0, c6: Number(s.profitLoan)||0, c8: Number(s.pbsContribution)||0, c9: Number(s.profitPbs)||0 };
        if (entryDate < start) colKeys.forEach(k => stats[k].opening += (vals as any)[k]);
        else if (entryDate <= end) colKeys.forEach(k => stats[k].period += (vals as any)[k]);
      });

      colKeys.forEach(k => stats[k].closing = stats[k].opening + stats[k].period);
      const openingCol11 = stats.c1.opening - stats.c2.opening + stats.c3.opening + stats.c5.opening + stats.c6.opening + stats.c8.opening + stats.c9.opening;
      const periodCol11 = stats.c1.period - stats.c2.period + stats.c3.period + stats.c5.period + stats.c6.period + stats.c8.period + stats.c9.period;
      const closingCol11 = openingCol11 + periodCol11;

      return { memberIdNumber: member.memberIdNumber, name: member.name, designation: member.designation, stats, total: { opening: openingCol11, period: periodCol11, closing: closingCol11 } };
    })
    .filter(row => row.name.toLowerCase().includes(search.toLowerCase()) || row.memberIdNumber?.includes(search))
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, dateRange, search]);

  const grandTotals = useMemo(() => {
    const res: any = { stats: {}, total: { opening: 0, period: 0, closing: 0 } };
    ['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'].forEach(k => res.stats[k] = { opening: 0, period: 0, closing: 0 });
    reportData.forEach(row => {
      Object.keys(row.stats).forEach(k => { res.stats[k].opening += row.stats[k].opening; res.stats[k].period += row.stats[k].period; res.stats[k].closing += row.stats[k].closing; });
      res.total.opening += row.total.opening; res.total.period += row.total.period; res.total.closing += row.total.closing;
    });
    return res;
  }, [reportData]);

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(reportData.map(r => ({ "ID No": r.memberIdNumber, "Name": r.name, "Col 1 Close": r.stats.c1.closing, "Col 2 Close": r.stats.c2.closing, "Total Close": r.total.closing })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Matrix"); XLSX.writeFile(wb, `Ledger_Matrix.xlsx`);
  };

  const ColumnGroupHead = ({ title, colSpan = 3, className }: { title: string, colSpan?: number, className?: string }) => (
    <TableHead colSpan={colSpan} className={cn("text-center border-x border-black/10 font-bold uppercase text-[10px] py-2", className)}>{title}</TableHead>
  );

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4"><div className="bg-primary/10 p-3 rounded-2xl"><ClipboardCheck className="size-8 text-primary" /></div><div className="flex flex-col gap-1"><h1 className="text-3xl font-bold text-primary tracking-tight">Ledger Summary Matrix</h1><p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">11-Column Reconciliation • Opening + Period = Closing</p></div></div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border shadow-sm"><div className="flex items-center gap-3"><div className="grid gap-1"><Label className="text-[9px] uppercase font-bold text-slate-400">Date From</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-none shadow-none font-bold" /></div><ArrowRightLeft className="size-3 text-slate-300 mt-3" /><div className="grid gap-1"><Label className="text-[9px] uppercase font-bold text-slate-400">Date To</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-none shadow-none font-bold" /></div></div><div className="flex gap-2"><Button variant="outline" onClick={exportToExcel} className="gap-2 h-9 font-bold text-xs"><FileSpreadsheet className="size-4" /> Export</Button><Button onClick={() => window.print()} className="gap-2 h-9 font-bold text-xs"><Printer className="size-4" /> Print</Button></div></div>
      </div>

      <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
        <div className="overflow-x-auto">
          <Table className="min-w-[2200px] border-collapse">
            <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b-2">
              <TableRow className="bg-muted/50">
                <TableHead rowSpan={2} className="w-[60px] sticky left-0 bg-white border-r border-b z-40">ID No</TableHead>
                <TableHead rowSpan={2} className="w-[180px] sticky left-[60px] bg-white border-r border-b z-40">Name</TableHead>
                <ColumnGroupHead title="Emp. Contrib (Col 1)" className="bg-blue-50/30" />
                <ColumnGroupHead title="Loan Withdraw (Col 2)" className="bg-rose-50/30" />
                <ColumnGroupHead title="Loan Repay (Col 3)" className="bg-emerald-50/30" />
                <ColumnGroupHead title="Profit Emp (Col 5)" className="bg-amber-50/30" />
                <ColumnGroupHead title="Profit Loan (Col 6)" className="bg-amber-50/30" />
                <ColumnGroupHead title="PBS Contrib (Col 8)" className="bg-slate-50" />
                <ColumnGroupHead title="Profit PBS (Col 9)" className="bg-amber-50/30" />
                <ColumnGroupHead title="Grand Cumulative (Col 11)" className="bg-primary/5" />
              </TableRow>
              <TableRow className="bg-slate-50/50 text-[8px] uppercase font-bold">
                {[1,2,3,5,6,8,9,11].map(i => (
                  <React.Fragment key={i}>
                    <TableHead className="text-right px-1 border-l">Opening</TableHead>
                    <TableHead className="text-right px-1 text-primary">Period</TableHead>
                    <TableHead className="text-right px-1 font-black bg-slate-100/50">Closing</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isMembersLoading || isSummariesLoading) ? <TableRow><TableCell colSpan={26} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto" /></TableCell></TableRow> : reportData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50/50 text-[10px]">
                  <td className="font-mono font-bold p-2 sticky left-0 bg-white border-r z-10">{row.memberIdNumber}</td>
                  <td className="p-2 font-medium sticky left-[60px] bg-white border-r z-10 truncate">{row.name}</td>
                  {['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'].map(k => (
                    <React.Fragment key={k}>
                      <td className="text-right p-2 border-l text-slate-400">{row.stats[k].opening.toLocaleString()}</td>
                      <td className="text-right p-2 text-primary">{row.stats[k].period.toLocaleString()}</td>
                      <td className="text-right p-2 font-bold bg-slate-50/50">{row.stats[k].closing.toLocaleString()}</td>
                    </React.Fragment>
                  ))}
                  <td className="text-right p-2 border-l text-slate-400 bg-primary/5">{row.total.opening.toLocaleString()}</td>
                  <td className="text-right p-2 text-primary font-bold bg-primary/5">{row.total.period.toLocaleString()}</td>
                  <td className="text-right p-2 font-black bg-slate-100">{row.total.closing.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="sticky bottom-0 bg-slate-100 z-30 font-black border-t-2">
              <TableRow>
                <TableCell colSpan={2} className="sticky left-0 bg-slate-100 z-40 border-r text-right uppercase text-[9px]">Grand Totals:</TableCell>
                {['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'].map(k => (
                  <React.Fragment key={k}>
                    <TableCell className="text-right p-2 text-[9px]">{grandTotals.stats[k].opening.toLocaleString()}</TableCell>
                    <TableCell className="text-right p-2 text-[9px] text-primary">{grandTotals.stats[k].period.toLocaleString()}</TableCell>
                    <TableCell className="text-right p-2 text-[9px] bg-slate-200/50">{grandTotals.stats[k].closing.toLocaleString()}</TableCell>
                  </React.Fragment>
                ))}
                <TableCell className="text-right p-2 text-[9px] bg-primary/10">{grandTotals.total.opening.toLocaleString()}</TableCell>
                <TableCell className="text-right p-2 text-[9px] text-primary bg-primary/10">{grandTotals.total.period.toLocaleString()}</TableCell>
                <TableCell className="text-right p-2 text-xs bg-slate-200 underline decoration-double">৳ {grandTotals.total.closing.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
