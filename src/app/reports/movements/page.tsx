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
  Activity,
  ShieldCheck,
  TrendingUp,
  Download
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

export default function FundMovementReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // Default to current fiscal year
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const initialStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
  const initialEnd = currentMonth >= 7 ? `${currentYear + 1}-06-30` : `${currentYear}-06-30`;

  const [dateRange, setDateRange] = useState({ start: initialStart, end: initialEnd });
  const [search, setSearch] = useState("");

  // Fetch all members
  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  // Fetch all fund summaries globally
  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const reportData = useMemo(() => {
    if (!members || !allSummaries) return [];

    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end).getTime();

    return members.map(member => {
      const memberSummaries = allSummaries.filter(s => s.memberId === member.id);
      
      let openingEmp = 0;
      let openingPbs = 0;
      
      let additionEmp = 0;
      let adjustmentEmp = 0;
      
      let additionPbs = 0;
      let adjustmentPbs = 0;

      memberSummaries.forEach(s => {
        const entryDate = new Date(s.summaryDate).getTime();
        const c1 = Number(s.employeeContribution) || 0;
        const c2 = Number(s.loanWithdrawal) || 0;
        const c3 = Number(s.loanRepayment) || 0;
        const c5 = Number(s.profitEmployee) || 0;
        const c6 = Number(s.profitLoan) || 0;
        const c8 = Number(s.pbsContribution) || 0;
        const c9 = Number(s.profitPbs) || 0;

        if (entryDate < start) {
          openingEmp += (c1 - c2 + c3 + c5 + c6);
          openingPbs += (c8 + c9);
        } else if (entryDate <= end) {
          additionEmp += c1;
          // Adjustments include profits and loan impact on net fund
          adjustmentEmp += (c5 + c6 + (c3 - c2));
          
          additionPbs += c8;
          adjustmentPbs += c9;
        }
      });

      const closingEmp = openingEmp + additionEmp + adjustmentEmp;
      const closingPbs = openingPbs + additionPbs + adjustmentPbs;
      const totalClosing = closingEmp + closingPbs;

      return {
        memberIdNumber: member.memberIdNumber,
        name: member.name,
        designation: member.designation,
        openingEmp,
        additionEmp,
        adjustmentEmp,
        closingEmp,
        openingPbs,
        additionPbs,
        adjustmentPbs,
        closingPbs,
        totalClosing
      };
    })
    .filter(row => 
      row.name.toLowerCase().includes(search.toLowerCase()) || 
      row.memberIdNumber?.includes(search)
    )
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, dateRange, search]);

  const stats = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      totalOpening: acc.totalOpening + curr.openingEmp + curr.openingPbs,
      totalAddition: acc.totalAddition + curr.additionEmp + curr.additionPbs,
      totalAdjustment: acc.totalAdjustment + curr.adjustmentEmp + curr.adjustmentPbs,
      totalClosing: acc.totalClosing + curr.totalClosing,
    }), { totalOpening: 0, totalAddition: 0, totalAdjustment: 0, totalClosing: 0 });
  }, [reportData]);

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    const data = reportData.map(item => ({
      "ID No": item.memberIdNumber,
      "Name": item.name,
      "Designation": item.designation,
      "Emp Opening": item.openingEmp,
      "Emp Addition": item.additionEmp,
      "Emp Adjustment": item.adjustmentEmp,
      "Emp Closing": item.closingEmp,
      "PBS Opening": item.openingPbs,
      "PBS Addition": item.additionPbs,
      "PBS Adjustment": item.adjustmentPbs,
      "PBS Closing": item.closingPbs,
      "Grand Total": item.totalClosing
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fund Movement");
    XLSX.writeFile(wb, `Fund_Movement_Report_${dateRange.start}_to_${dateRange.end}.xlsx`);
    toast({ title: "Exported", description: "Movement data saved to Excel." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      {/* Print View */}
      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">Gazipur Palli Bidyut Samity-2</h1>
          <h2 className="text-lg font-bold underline underline-offset-4 uppercase">Member Fund Movement Statement</h2>
          <div className="flex justify-between text-[10px] font-bold pt-4">
            <span>Period: {dateRange.start} to {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[7.5px] border-collapse border border-black table-fixed">
          <thead>
            <tr className="bg-slate-100 font-bold">
              <th className="border border-black p-1 text-center w-[35px]" rowSpan={2}>ID No</th>
              <th className="border border-black p-1 text-left w-[90px]" rowSpan={2}>Member Name</th>
              <th className="border border-black p-1 text-center bg-slate-200/50" colSpan={4}>Employee Fund (৳)</th>
              <th className="border border-black p-1 text-center bg-blue-50" colSpan={4}>PBS Office Fund (৳)</th>
              <th className="border border-black p-1 text-right w-[60px] bg-slate-100" rowSpan={2}>Total Closing (৳)</th>
            </tr>
            <tr className="bg-slate-50 text-[7px]">
              <th className="border border-black p-1 text-right">Opening</th>
              <th className="border border-black p-1 text-right">Addition</th>
              <th className="border border-black p-1 text-right">Adjust.</th>
              <th className="border border-black p-1 text-right font-bold">Closing</th>
              <th className="border border-black p-1 text-right">Opening</th>
              <th className="border border-black p-1 text-right">Addition</th>
              <th className="border border-black p-1 text-right">Adjust.</th>
              <th className="border border-black p-1 text-right font-bold">Closing</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, idx) => (
              <tr key={idx}>
                <td className="border border-black p-1 text-center font-mono">{row.memberIdNumber}</td>
                <td className="border border-black p-1 truncate">{row.name}</td>
                <td className="border border-black p-1 text-right">{row.openingEmp.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right">{row.additionEmp.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right">{row.adjustmentEmp.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right font-bold bg-slate-50">{row.closingEmp.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right">{row.openingPbs.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right">{row.additionPbs.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right">{row.adjustmentPbs.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right font-bold bg-blue-50/30">{row.closingPbs.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right font-black bg-slate-100">{row.totalClosing.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black">
              <td colSpan={2} className="border border-black p-1 text-right uppercase">Grand Totals:</td>
              <td className="border border-black p-1 text-right">{reportData.reduce((s, r) => s + r.openingEmp, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right">{reportData.reduce((s, r) => s + r.additionEmp, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right">{reportData.reduce((s, r) => s + r.adjustmentEmp, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right">{reportData.reduce((s, r) => s + r.closingEmp, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right">{reportData.reduce((s, r) => s + r.openingPbs, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right">{reportData.reduce((s, r) => s + r.additionPbs, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right">{reportData.reduce((s, r) => s + r.adjustmentPbs, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right">{reportData.reduce((s, r) => s + r.closingPbs, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right underline decoration-double">৳ {stats.totalClosing.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
          <div className="border-t border-black pt-2">Accountant / AGM(F)</div>
          <div className="border-t border-black pt-2">Internal Auditor / DGM</div>
          <div className="border-t border-black pt-2">Approved By Trustee</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <Activity className="size-8 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-primary tracking-tight">Fund Movement Report</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Analysis of Additions and Adjustments to Member Funds</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-bold text-slate-400">Date Start</Label>
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-none shadow-none p-0 focus-visible:ring-0 font-bold" />
            </div>
            <ArrowRightLeft className="size-3 text-slate-300 mt-3" />
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-bold text-slate-400">Date End</Label>
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-none shadow-none p-0 focus-visible:ring-0 font-bold" />
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-9 font-bold text-xs">
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button onClick={() => window.print()} className="gap-2 h-9 font-bold text-xs shadow-lg shadow-primary/20">
              <Printer className="size-4" /> Print
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 no-print">
        <Card className="border-none shadow-sm bg-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Opening Bal (Period)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">৳ {stats.totalOpening.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-blue-600 tracking-widest">Total Additions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">৳ {stats.totalAddition.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-orange-600 tracking-widest">Net Adjustments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">৳ {stats.totalAdjustment.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-primary text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-primary-foreground/70 tracking-widest">Closing Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">৳ {stats.totalClosing.toLocaleString()}</div>
          </CardContent>
        </div>

      <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
        <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              className="pl-9 h-9 bg-white" 
              placeholder="Search by ID or Name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="bg-white border-slate-200">
            {reportData.length} Personnel Audited
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
              <TableRow className="bg-muted/30">
                <TableHead className="py-4">Member ID</TableHead>
                <TableHead className="py-4">Name</TableHead>
                <TableHead className="text-right py-4 bg-slate-100/30">Emp Opening (৳)</TableHead>
                <TableHead className="text-right py-4">Emp Add (৳)</TableHead>
                <TableHead className="text-right py-4 text-orange-600">Emp Adj (৳)</TableHead>
                <TableHead className="text-right py-4 font-bold">Emp Closing (৳)</TableHead>
                <TableHead className="text-right py-4 bg-blue-50/30">PBS Opening (৳)</TableHead>
                <TableHead className="text-right py-4">PBS Add (৳)</TableHead>
                <TableHead className="text-right py-4 text-emerald-600">PBS Adj (৳)</TableHead>
                <TableHead className="text-right py-4 font-bold">PBS Closing (৳)</TableHead>
                <TableHead className="text-right py-4 font-black">Grand Total (৳)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isMembersLoading || isSummariesLoading) ? (
                <TableRow><TableCell colSpan={11} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : reportData.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-16 text-muted-foreground italic">No movement records found for the selected range.</TableCell></TableRow>
              ) : reportData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors text-[11px]">
                  <td className="font-mono font-bold p-4">{row.memberIdNumber}</td>
                  <td className="p-4 font-medium max-w-[120px] truncate" title={row.name}>{row.name}</td>
                  <td className="text-right p-4 bg-slate-50/50">৳ {row.openingEmp.toLocaleString()}</td>
                  <td className="text-right p-4">৳ {row.additionEmp.toLocaleString()}</td>
                  <td className="text-right p-4 text-orange-600">৳ {row.adjustmentEmp.toLocaleString()}</td>
                  <td className="text-right p-4 font-bold">৳ {row.closingEmp.toLocaleString()}</td>
                  <td className="text-right p-4 bg-blue-50/20">৳ {row.openingPbs.toLocaleString()}</td>
                  <td className="text-right p-4">৳ {row.additionPbs.toLocaleString()}</td>
                  <td className="text-right p-4 text-emerald-600">৳ {row.adjustmentPbs.toLocaleString()}</td>
                  <td className="text-right p-4 font-bold">৳ {row.closingPbs.toLocaleString()}</td>
                  <td className="text-right p-4 font-black text-primary">৳ {row.totalClosing.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-slate-100/80 font-black">
                <TableCell colSpan={2} className="text-right uppercase text-[9px]">Grand Totals:</TableCell>
                <TableCell className="text-right text-[10px]">৳ {reportData.reduce((s, r) => s + r.openingEmp, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-[10px]">৳ {reportData.reduce((s, r) => s + r.additionEmp, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-[10px]">৳ {reportData.reduce((s, r) => s + r.adjustmentEmp, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-[10px]">৳ {reportData.reduce((s, r) => s + r.closingEmp, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-[10px]">৳ {reportData.reduce((s, r) => s + r.openingPbs, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-[10px]">৳ {reportData.reduce((s, r) => s + r.additionPbs, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-[10px]">৳ {reportData.reduce((s, r) => s + r.adjustmentPbs, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-[10px]">৳ {reportData.reduce((s, r) => s + r.closingPbs, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-base underline decoration-double">৳ {stats.totalClosing.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
