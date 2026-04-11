
"use client"

import { useMemo, useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  FileSpreadsheet, 
  Printer, 
  Loader2, 
  Search,
  Calendar,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  ArrowRightLeft
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collectionGroup, query, where } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function ContributionAuditPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Date Logic for default FY
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
  const today = now.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: fyStart, end: today });

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading } = useCollection(summariesRef);

  const filteredData = useMemo(() => {
    if (!allSummaries) return [];
    let data = allSummaries;
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      data = allSummaries.filter(item => {
        const d = new Date(item.summaryDate).getTime();
        return d >= s && d <= e;
      });
    }
    return data.sort((a, b) => new Date(b.summaryDate).getTime() - new Date(a.summaryDate).getTime());
  }, [allSummaries, dateRange]);

  const stats = useMemo(() => {
    const s = {
      systemProfit: 0,
      manualEmp: 0,
      manualPbs: 0,
      localPbs: 0,
      otherPbs: 0,
      totalEntries: filteredData.length
    };

    filteredData.forEach(item => {
      // System Profit
      if (item.isSystemGenerated || item.particulars?.includes("Annual Profit")) {
        s.systemProfit += (Number(item.profitEmployee) || 0) + (Number(item.profitPbs) || 0);
      }
      
      // Manual Entries
      if (item.isManual || (!item.isSystemGenerated && !item.isSettlement)) {
        s.manualEmp += (Number(item.employeeContribution) || 0);
        s.manualPbs += (Number(item.pbsContribution) || 0);
        
        // PBS Source Breakdown
        if (item.contributionSource === 'Other') {
          s.otherPbs += (Number(item.pbsContribution) || 0);
        } else {
          s.localPbs += (Number(item.pbsContribution) || 0);
        }
      }
    });

    return s;
  }, [filteredData]);

  const exportToExcel = () => {
    if (filteredData.length === 0) return;
    const data = filteredData.map(item => ({
      "Date": item.summaryDate,
      "Particulars": item.particulars,
      "Employee Contribution": item.employeeContribution || 0,
      "PBS Contribution": item.pbsContribution || 0,
      "Source": item.contributionSource || "Local",
      "System Generated": item.isSystemGenerated ? "Yes" : "No",
      "Profit Added": (Number(item.profitEmployee) || 0) + (Number(item.profitPbs) || 0)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit");
    XLSX.writeFile(wb, `CPF_Audit_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Exported", description: "Audit data saved to Excel." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      {/* Print View */}
      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">Gazipur Palli Bidyut Samity-2</h1>
          <h2 className="text-lg font-bold underline underline-offset-4 uppercase">Contribution & Profit Audit Report</h2>
          <div className="flex justify-between text-[10px] font-bold pt-4">
            <span>Period: {dateRange.start || "All Time"} to {dateRange.end || "Present"}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-10 border p-4 bg-slate-50 text-xs">
          <div className="space-y-2">
            <p className="font-bold border-b border-black pb-1 uppercase">Fund Growth Summary</p>
            <p className="flex justify-between"><span>System Accrued Profit:</span> <b>৳ {stats.systemProfit.toLocaleString()}</b></p>
            <p className="flex justify-between"><span>Manual Emp. Contributions:</span> <b>৳ {stats.manualEmp.toLocaleString()}</b></p>
            <p className="flex justify-between"><span>Manual PBS Contributions:</span> <b>৳ {stats.manualPbs.toLocaleString()}</b></p>
          </div>
          <div className="space-y-2">
            <p className="font-bold border-b border-black pb-1 uppercase">PBS Source Distribution</p>
            <p className="flex justify-between"><span>Local PBS (GPBS-2):</span> <b>৳ {stats.localPbs.toLocaleString()}</b></p>
            <p className="flex justify-between"><span>Other PBS (Transfers):</span> <b>৳ {stats.otherPbs.toLocaleString()}</b></p>
          </div>
        </div>

        <table className="w-full text-[9px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-1 text-center w-[70px]">Date</th>
              <th className="border border-black p-1 text-left">Particulars</th>
              <th className="border border-black p-1 text-right">Emp. Cont (৳)</th>
              <th className="border border-black p-1 text-right">PBS Cont (৳)</th>
              <th className="border border-black p-1 text-center">Source</th>
              <th className="border border-black p-1 text-right">Profit (৳)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black p-1 text-center font-mono">{item.summaryDate}</td>
                <td className="border border-black p-1">{item.particulars}</td>
                <td className="border border-black p-1 text-right">{Number(item.employeeContribution || 0).toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{Number(item.pbsContribution || 0).toLocaleString()}</td>
                <td className="border border-black p-1 text-center">{item.contributionSource || "Local"}</td>
                <td className="border border-black p-1 text-right">{(Number(item.profitEmployee || 0) + Number(item.profitPbs || 0)).toLocaleString()}</td>
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Audit & Tracking</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Comprehensive tracking of system profits and manual PBS contributions</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-bold text-slate-400">Start Date</Label>
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-none shadow-none p-0 focus-visible:ring-0" />
            </div>
            <ArrowRightLeft className="size-3 text-slate-300 mt-3" />
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-bold text-slate-400">End Date</Label>
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-none shadow-none p-0 focus-visible:ring-0" />
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-9 font-bold text-xs">
              <FileSpreadsheet className="size-4" /> Export Excel
            </Button>
            <Button onClick={() => window.print()} className="gap-2 h-9 font-bold text-xs shadow-lg shadow-primary/20">
              <Printer className="size-4" /> Print Audit
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 no-print">
        <Card className="border-none shadow-sm bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-blue-600 tracking-widest">System Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳ {stats.systemProfit.toLocaleString()}</div>
            <p className="text-[9px] text-blue-500 mt-1 uppercase font-medium">Auto-Calculated Interest</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-emerald-600 tracking-widest">Manual Emp. Contrib</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳ {stats.manualEmp.toLocaleString()}</div>
            <p className="text-[9px] text-emerald-500 mt-1 uppercase font-medium">New Entry System Postings</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-orange-600 tracking-widest">Other PBS Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳ {stats.otherPbs.toLocaleString()}</div>
            <p className="text-[9px] text-orange-500 mt-1 uppercase font-medium">External Transfers Tracked</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-slate-900 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Total Manual PBS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳ {stats.manualPbs.toLocaleString()}</div>
            <p className="text-[9px] text-slate-400 mt-1 uppercase font-medium">Sum of Local + Other PBS</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
        <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Audit Ledger Trail
          </h2>
          <Badge variant="outline" className="bg-white border-slate-200">
            {filteredData.length} Total Postings
          </Badge>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
              <TableRow className="bg-muted/30">
                <TableHead className="py-4">Date</TableHead>
                <TableHead className="py-4">Particulars</TableHead>
                <TableHead className="text-right py-4">Emp. Contrib (৳)</TableHead>
                <TableHead className="text-right py-4">PBS Contrib (৳)</TableHead>
                <TableHead className="text-center py-4">Source</TableHead>
                <TableHead className="text-right py-4">Total Profit (৳)</TableHead>
                <TableHead className="text-center py-4">Entry Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-16 text-muted-foreground italic">No entries found for the selected period.</TableCell></TableRow>
              ) : filteredData.map((item, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="font-mono text-xs font-bold text-slate-600 p-4">{item.summaryDate}</td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">{item.particulars}</span>
                      <span className="text-[10px] text-muted-foreground line-clamp-1">{item.memberId || "Global Sync"}</span>
                    </div>
                  </td>
                  <td className="text-right font-medium p-4">৳ {Number(item.employeeContribution || 0).toLocaleString()}</td>
                  <td className="text-right font-medium p-4">৳ {Number(item.pbsContribution || 0).toLocaleString()}</td>
                  <td className="text-center p-4">
                    {item.contributionSource === 'Other' ? (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">Other PBS</Badge>
                    ) : item.pbsContribution > 0 ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Local</Badge>
                    ) : null}
                  </td>
                  <td className="text-right font-black text-primary p-4">
                    ৳ {(Number(item.profitEmployee || 0) + Number(item.profitPbs || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                  <td className="text-center p-4">
                    {item.isSystemGenerated ? (
                      <Badge variant="secondary" className="text-[9px] uppercase tracking-tighter">System Profit</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] uppercase tracking-tighter">Manual Entry</Badge>
                    )}
                  </td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
