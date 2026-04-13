
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
  ArrowRightLeft,
  Briefcase
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function LoanReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [search, setSearch] = useState("");

  // Defer date initialization to avoid hydration errors
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setDateRange({ start: fyStart, end: today });
  }, []);

  // Fetch all members for metadata (Name, Designation, ID)
  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  // Fetch all fund summaries globally
  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const reportData = useMemo(() => {
    if (!members || !allSummaries || !dateRange.start) return [];

    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end).getTime();

    return members.map(member => {
      const memberSummaries = allSummaries.filter(s => s.memberId === member.id);
      
      let openingBalance = 0;
      let loansDuring = 0;
      let repaymentsDuring = 0;

      memberSummaries.forEach(s => {
        const entryDate = new Date(s.summaryDate).getTime();
        const withdraw = Number(s.loanWithdrawal) || 0;
        const repay = Number(s.loanRepayment) || 0;

        if (entryDate < start) {
          openingBalance += (withdraw - repay);
        } else if (entryDate <= end) {
          loansDuring += withdraw;
          repaymentsDuring += repay;
        }
      });

      const closingBalance = openingBalance + loansDuring - repaymentsDuring;

      return {
        memberIdNumber: member.memberIdNumber,
        name: member.name,
        designation: member.designation,
        openingBalance,
        loansDuring,
        repaymentsDuring,
        closingBalance
      };
    })
    .filter(row => 
      (row.openingBalance !== 0 || row.loansDuring !== 0 || row.repaymentsDuring !== 0 || row.closingBalance !== 0) &&
      (row.name.toLowerCase().includes(search.toLowerCase()) || row.memberIdNumber?.includes(search))
    )
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, dateRange, search]);

  const stats = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      totalOpening: acc.totalOpening + curr.openingBalance,
      totalNew: acc.totalNew + curr.loansDuring,
      totalRepaid: acc.totalRepaid + curr.repaymentsDuring,
      totalClosing: acc.totalClosing + curr.closingBalance,
    }), { totalOpening: 0, totalNew: 0, totalRepaid: 0, totalClosing: 0 });
  }, [reportData]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-black tracking-tight">Loan Audit Report</h1>
          <p className="text-black uppercase tracking-widest text-[10px] font-black">Track Opening, Disbursements, and Repayments</p>
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

      <div className="grid gap-6 md:grid-cols-4 no-print">
        <Card className="border-2 border-black shadow-sm bg-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Opening Balance</CardTitle></CardHeader><CardContent><div className="text-xl font-black">৳ {stats.totalOpening.toLocaleString()}</div></CardContent></Card>
        <Card className="border-2 border-black shadow-sm bg-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">New Loans</CardTitle></CardHeader><CardContent><div className="text-xl font-black">৳ {stats.totalNew.toLocaleString()}</div></CardContent></Card>
        <Card className="border-2 border-black shadow-sm bg-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Total Repaid</CardTitle></CardHeader><CardContent><div className="text-xl font-black">৳ {stats.totalRepaid.toLocaleString()}</div></CardContent></Card>
        <Card className="border-2 border-black shadow-sm bg-black text-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-white">Total Outstanding</CardTitle></CardHeader><CardContent><div className="text-xl font-black">৳ {stats.totalClosing.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden no-print">
        <div className="p-4 border-b-2 border-black bg-slate-100 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black" />
            <Input className="pl-9 h-9 border-black font-black" placeholder="Search ID or Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Badge variant="outline" className="border-black text-black font-black">{reportData.length} Records</Badge>
        </div>
        <Table className="text-black font-black">
          <TableHeader className="bg-slate-50 border-b-2 border-black">
            <TableRow>
              <TableHead className="font-black text-black">ID No</TableHead>
              <TableHead className="font-black text-black">Member Name</TableHead>
              <TableHead className="text-right font-black text-black">Opening</TableHead>
              <TableHead className="text-right font-black text-black">Disbursed</TableHead>
              <TableHead className="text-right font-black text-black">Repayment</TableHead>
              <TableHead className="text-right font-black text-black">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportData.map((row, idx) => (
              <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                <td className="font-mono text-xs p-4">{row.memberIdNumber}</td>
                <td className="p-4">{row.name}</td>
                <td className="text-right p-4">{row.openingBalance.toLocaleString()}</td>
                <td className="text-right p-4">{row.loansDuring.toLocaleString()}</td>
                <td className="text-right p-4">{row.repaymentsDuring.toLocaleString()}</td>
                <td className="text-right p-4 font-black">৳ {row.closingBalance.toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-slate-100 font-black border-t-2 border-black">
            <TableRow>
              <TableCell colSpan={2} className="text-right uppercase">GRAND TOTALS:</TableCell>
              <TableCell className="text-right">{stats.totalOpening.toLocaleString()}</TableCell>
              <TableCell className="text-right">{stats.totalNew.toLocaleString()}</TableCell>
              <TableCell className="text-right">{stats.totalRepaid.toLocaleString()}</TableCell>
              <TableCell className="text-right text-base underline decoration-double">৳ {stats.totalClosing.toLocaleString()}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-8 border-b-4 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-widest">Contributory Provident Fund</p>
          <h2 className="text-lg font-black underline underline-offset-4 uppercase">Member Loan Statement Report</h2>
          <div className="flex justify-between text-[10px] font-black pt-4">
            <span>Period: {dateRange.start} to {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <table className="w-full text-[9px] border-collapse border-2 border-black text-black font-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-1">ID No</th>
              <th className="border border-black p-1 text-left">Member Name</th>
              <th className="border border-black p-1 text-right">Opening</th>
              <th className="border border-black p-1 text-right">New Loans</th>
              <th className="border border-black p-1 text-right">Repayment</th>
              <th className="border border-black p-1 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, i) => (
              <tr key={i}>
                <td className="border border-black p-1 text-center">{row.memberIdNumber}</td>
                <td className="border border-black p-1">{row.name}</td>
                <td className="border border-black p-1 text-right">{row.openingBalance.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.loansDuring.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.repaymentsDuring.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black">{row.closingBalance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black">
              <td colSpan={2} className="border border-black p-1 text-right uppercase">Totals:</td>
              <td className="border border-black p-1 text-right">{stats.totalOpening.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.totalNew.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.totalRepaid.toLocaleString()}</td>
              <td className="border border-black p-1 text-right underline decoration-double">৳ {stats.totalClosing.toLocaleString()}</td>
            </tr>
          </tfoot>
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
