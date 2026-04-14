
"use client"

import { useMemo, useState, useEffect } from "react";
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
  ArrowRightLeft,
  Trash2,
  AlertTriangle,
  DatabaseZap
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc, deleteDocumentNonBlocking } from "@/firebase";
import { collectionGroup, query, where, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function ContributionAuditPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [cleanupParticulars, setCleanupParticulars] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Defer date initialization to avoid hydration errors
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setDateRange({ start: fyStart, end: today });
  }, []);

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
      totalEntries: filteredData.length
    };
    filteredData.forEach(item => {
      if (item.isSystemGenerated || item.particulars?.includes("Annual Profit")) {
        s.systemProfit += (Number(item.profitEmployee) || 0) + (Number(item.profitPbs) || 0);
      }
      if (item.isManual || (!item.isSystemGenerated && !item.isSettlement)) {
        s.manualEmp += (Number(item.employeeContribution) || 0);
        s.manualPbs += (Number(item.pbsContribution) || 0);
      }
    });
    return s;
  }, [filteredData]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-black tracking-tight">Audit & Tracking</h1>
          <p className="text-black uppercase tracking-widest text-[10px] font-black">Comprehensive tracking of system profits and contributions</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-2xl border-2 border-black shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black">Start Date</Label>
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-black font-black" />
            </div>
            <ArrowRightLeft className="size-3 text-black mt-3" />
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black">End Date</Label>
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-black font-black" />
            </div>
          </div>
          <div className="h-6 w-px bg-black hidden sm:block" />
          <Button onClick={() => window.print()} className="gap-2 h-9 font-black text-xs bg-black text-white shadow-lg">
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 no-print">
        <Card className="border-2 border-black shadow-sm bg-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">System Profit</CardTitle></CardHeader><CardContent><div className="text-xl font-black text-black">৳ {stats.systemProfit.toLocaleString()}</div></CardContent></Card>
        <Card className="border-2 border-black shadow-sm bg-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Manual Emp. Contrib</CardTitle></CardHeader><CardContent><div className="text-xl font-black text-black">৳ {stats.manualEmp.toLocaleString()}</div></CardContent></Card>
        <Card className="border-2 border-black shadow-sm bg-black text-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-white">Manual PBS Contrib</CardTitle></CardHeader><CardContent><div className="text-xl font-black text-white">৳ {stats.manualPbs.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden no-print">
        <div className="p-4 border-b-2 border-black bg-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-black flex items-center gap-2 text-black"><ShieldCheck className="size-4 text-black" /> Audit Ledger Trail</h2>
          <Badge variant="outline" className="border-black text-black font-black">{filteredData.length} Postings</Badge>
        </div>
        <Table className="text-black font-black">
          <TableHeader className="bg-slate-50 border-b-2 border-black">
            <TableRow>
              <TableHead className="font-black text-black">Date</TableHead>
              <TableHead className="font-black text-black">Particulars</TableHead>
              <TableHead className="text-right font-black text-black">Emp. Cont (৳)</TableHead>
              <TableHead className="text-right font-black text-black">PBS Cont (৳)</TableHead>
              <TableHead className="text-right font-black text-black">Total Profit (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item, idx) => (
              <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                <td className="font-mono text-xs p-4">{item.summaryDate}</td>
                <td className="p-4">{item.particulars}</td>
                <td className="text-right p-4">{Number(item.employeeContribution || 0).toLocaleString()}</td>
                <td className="text-right p-4">{Number(item.pbsContribution || 0).toLocaleString()}</td>
                <td className="text-right p-4 font-black">৳ {(Number(item.profitEmployee || 0) + Number(item.profitPbs || 0)).toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-8 border-b-4 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-widest">Contributory Provident Fund</p>
          <h2 className="text-lg font-black underline underline-offset-4 uppercase">Contribution & Profit Report</h2>
          <div className="flex justify-between text-[10px] font-black pt-4">
            <span>Period: {dateRange.start} to {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <table className="w-full text-[9px] border-collapse border-2 border-black text-black font-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-1">Date</th>
              <th className="border border-black p-1 text-left">Particulars</th>
              <th className="border border-black p-1 text-right">Emp. Cont</th>
              <th className="border border-black p-1 text-right">PBS Cont</th>
              <th className="border border-black p-1 text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black p-1 text-center font-mono">{item.summaryDate}</td>
                <td className="border border-black p-1">{item.particulars}</td>
                <td className="border border-black p-1 text-right">{Number(item.employeeContribution || 0).toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{Number(item.pbsContribution || 0).toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{(Number(item.profitEmployee || 0) + Number(item.profitPbs || 0)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
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
