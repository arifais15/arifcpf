
"use client"

import { useMemo, useState, useEffect } from "react";
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
  Briefcase,
  ShieldCheck
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

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setDateRange({ start: fyStart, end: today });
  }, []);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

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

  if (isMembersLoading || isSummariesLoading) {
    return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-black tracking-tight uppercase">Loan Audit Report</h1>
          <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Opening, Disbursements, and Repayments Registry</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-2xl border-2 border-black shadow-xl">
          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black">Start Date</Label>
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-black border-2 font-black text-black" />
            </div>
            <ArrowRightLeft className="size-3 text-black mt-3" />
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black">End Date</Label>
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-black border-2 font-black text-black" />
            </div>
          </div>
          <div className="h-6 w-px bg-black hidden sm:block" />
          <Button onClick={() => window.print()} className="gap-2 h-10 font-black px-8 bg-black text-white shadow-xl uppercase tracking-widest">
            <Printer className="size-4" /> Print Report
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 no-print">
        <Card className="border-2 border-black shadow-lg bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-black tracking-widest">Aggregate Opening</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tabular-nums">{stats.totalOpening.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-black shadow-lg bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-black tracking-widest">New Disbursements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tabular-nums">{stats.totalNew.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-black shadow-lg bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-black tracking-widest">Aggregate Recovery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tabular-nums">{stats.totalRepaid.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-2 border-black shadow-lg bg-black text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-white tracking-widest">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tabular-nums">{stats.totalClosing.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-none shadow-2xl border-2 border-black overflow-hidden no-print">
        <div className="p-4 border-b-2 border-black bg-slate-50 flex items-center justify-between">
          <div className="relative flex-1 max-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black" />
            <Input className="pl-9 h-10 border-2 border-black font-black text-black" placeholder="Filter by ID or Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Badge className="bg-black text-white font-black px-4 py-1.5 uppercase tracking-widest">{reportData.length} Members List</Badge>
        </div>
        <Table className="text-black font-black">
          <TableHeader className="bg-slate-100 border-b-2 border-black">
            <TableRow>
              <TableHead className="font-black text-black uppercase tracking-widest">ID Number</TableHead>
              <TableHead className="font-black text-black uppercase tracking-widest">Personnel Details</TableHead>
              <TableHead className="text-right font-black text-black uppercase tracking-widest">Opening</TableHead>
              <TableHead className="text-right font-black text-black uppercase tracking-widest">Disbursed</TableHead>
              <TableHead className="text-right font-black text-black uppercase tracking-widest">Recovery</TableHead>
              <TableHead className="text-right font-black text-black uppercase tracking-widest bg-slate-200">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {reportData.map((row, idx) => (
              <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                <td className="font-mono text-base p-4 border-r border-black font-black">{row.memberIdNumber}</td>
                <td className="p-4 border-r border-black">
                  <div className="flex flex-col">
                    <span className="uppercase text-sm font-black">{row.name}</span>
                    <span className="text-[10px] uppercase italic tracking-widest font-black">{row.designation}</span>
                  </div>
                </td>
                <td className="text-right p-4 border-r border-black font-black">{row.openingBalance.toLocaleString()}</td>
                <td className="text-right p-4 border-r border-black font-black">{row.loansDuring.toLocaleString()}</td>
                <td className="text-right p-4 border-r border-black font-black">{row.repaymentsDuring.toLocaleString()}</td>
                <td className="text-right p-4 font-black bg-slate-50 underline decoration-black"> {row.closingBalance.toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-slate-100 font-black border-t-2 border-black text-black">
            <TableRow className="h-16">
              <TableCell colSpan={2} className="text-right uppercase tracking-[0.2em] text-sm pr-10">Institutional Grand Totals:</TableCell>
              <TableCell className="text-right border-l border-black font-black">{stats.totalOpening.toLocaleString()}</TableCell>
              <TableCell className="text-right border-l border-black font-black">{stats.totalNew.toLocaleString()}</TableCell>
              <TableCell className="text-right border-l border-black font-black">{stats.totalRepaid.toLocaleString()}</TableCell>
              <TableCell className="text-right text-xl underline decoration-double bg-slate-200 border-l border-black font-black">{stats.totalClosing.toLocaleString()}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.4em] mt-4">Employee Loan Audit Registry Statement</h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <span className="bg-black text-white px-4 py-1 rounded">Ledger Period: {dateRange.start} to {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <table className="w-full text-[10px] border-collapse border-2 border-black text-black font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-black">
              <th className="border border-black p-2.5 uppercase tracking-widest">ID No</th>
              <th className="border border-black p-2.5 text-left uppercase tracking-widest">Member Name & Designation</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest">Opening</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest">New Loans</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest">Recovery</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest bg-slate-100">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, i) => (
              <tr key={i} className="border-b border-black">
                <td className="border border-black p-2.5 text-center font-mono text-base font-black">{row.memberIdNumber}</td>
                <td className="border border-black p-2.5">
                  <span className="font-black uppercase text-sm block">{row.name}</span>
                  <span className="text-[8px] uppercase tracking-widest italic font-black">{row.designation}</span>
                </td>
                <td className="border border-black p-2.5 text-right font-black">{row.openingBalance.toLocaleString()}</td>
                <td className="border border-black p-2.5 text-right font-black">{row.loansDuring.toLocaleString()}</td>
                <td className="border border-black p-2.5 text-right font-black">{row.repaymentsDuring.toLocaleString()}</td>
                <td className="border border-black p-2.5 text-right font-black text-base underline decoration-black">{row.closingBalance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black border-t-2 border-black h-16">
              <td colSpan={2} className="border border-black p-2.5 text-right uppercase tracking-[0.2em]">Consolidated Totals:</td>
              <td className="border border-black p-2.5 text-right font-black">{stats.totalOpening.toLocaleString()}</td>
              <td className="border border-black p-2.5 text-right font-black">{stats.totalNew.toLocaleString()}</td>
              <td className="border border-black p-2.5 text-right font-black">{stats.totalRepaid.toLocaleString()}</td>
              <td className="border border-black p-2.5 text-right underline decoration-double text-lg font-black"> {stats.totalClosing.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center">
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Prepared by</div>
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Checked by</div>
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Approved By Trustee</div>
        </div>
        <div className="mt-20 pt-8 border-t-2 border-black flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em]">
          <span>Institutional Trust Registry v1.0</span>
          <span className="italic">Form Generated via PBS CPF Software</span>
        </div>
      </div>
    </div>
  );
}
