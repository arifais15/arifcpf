
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
  FileSpreadsheet, 
  Printer, 
  Loader2, 
  Search,
  ArrowRightLeft,
  ClipboardCheck,
  FileStack,
  ShieldCheck
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function LedgerSummaryReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("matrix");

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
    if (!members || !allSummaries || !dateRange.end) return [];
    const end = new Date(dateRange.end).getTime();

    return members.map(member => {
      const memberSummaries = allSummaries.filter(s => 
        s.memberId === member.id && 
        new Date(s.summaryDate).getTime() <= end
      );
      
      let c1 = 0, c2 = 0, c3 = 0, c5 = 0, c6 = 0, c8 = 0, c9 = 0;
      memberSummaries.forEach(s => {
        c1 += Number(s.employeeContribution) || 0;
        c2 += Number(s.loanWithdrawal) || 0;
        c3 += Number(s.loanRepayment) || 0;
        c5 += Number(s.profitEmployee) || 0;
        c6 += Number(s.profitLoan) || 0;
        c8 += Number(s.pbsContribution) || 0;
        c9 += Number(s.profitPbs) || 0;
      });

      const c4 = c2 - c3;
      const c7 = c1 - c2 + c3 + c5 + c6;
      const c10 = c8 + c9;
      const c11 = c7 + c10;

      return {
        id: member.id,
        memberIdNumber: member.memberIdNumber,
        name: member.name,
        designation: member.designation,
        c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11
      };
    })
    .filter(row => 
      row.name.toLowerCase().includes(search.toLowerCase()) || 
      row.memberIdNumber?.includes(search)
    )
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, dateRange.end, search]);

  const stats = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      c1: acc.c1 + curr.c1, c2: acc.c2 + curr.c2, c3: acc.c3 + curr.c3, c4: acc.c4 + curr.c4,
      c5: acc.c5 + curr.c5, c6: acc.c6 + curr.c6, c7: acc.c7 + curr.c7,
      c8: acc.c8 + curr.c8, c9: acc.c9 + curr.c9, c10: acc.c10 + curr.c10, c11: acc.c11 + curr.c11
    }), { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0, c7: 0, c8: 0, c9: 0, c10: 0, c11: 0 });
  }, [reportData]);

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    const exportData = reportData.map(r => ({
      "ID No": r.memberIdNumber,
      "Name": r.name,
      "Designation": r.designation,
      "Col 1: Emp Cont": r.c1,
      "Col 2: Loan Draw": r.c2,
      "Col 3: Loan Pay": r.c3,
      "Col 4: Loan Bal": r.c4,
      "Col 5: Emp Profit": r.c5,
      "Col 6: Loan Profit": r.c6,
      "Col 7: Net Emp": r.c7,
      "Col 8: PBS Cont": r.c8,
      "Col 9: PBS Profit": r.c9,
      "Col 10: Net Office": r.c10,
      "Col 11: Total Fund": r.c11
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ConsolidatedLedger");
    XLSX.writeFile(wb, `Consolidated_Ledger_${dateRange.end}.xlsx`);
  };

  if (isMembersLoading || isSummariesLoading) {
    return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;
  }

  const StandardFooter = () => (
    <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
      <span>CPF Management Software</span>
      <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
    </div>
  );

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="bg-black p-4 rounded-2xl shadow-lg">
            <ClipboardCheck className="size-8 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-black tracking-tighter uppercase">Consolidated Ledger</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Institutional Matrix of Member Fund Sums</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-white p-4 rounded-2xl border-4 border-black shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="grid gap-1.5">
              <Label className="text-[10px] uppercase font-black text-black tracking-widest">Balance As Of</Label>
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-10 text-sm border-2 border-black font-black" />
            </div>
          </div>
          <div className="h-10 w-0.5 bg-black" />
          <div className="flex gap-3">
            <Button variant="outline" onClick={exportToExcel} className="gap-2 border-2 border-black text-black font-black h-11 px-6 uppercase tracking-widest">
              <FileSpreadsheet className="size-5" /> Export
            </Button>
            <Button onClick={() => window.print()} className="gap-2 h-11 font-black px-8 bg-black text-white shadow-xl uppercase tracking-widest hover:bg-black/90">
              <Printer className="size-5" /> Print Matrix
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-none shadow-2xl border-2 border-black overflow-hidden no-print">
        <div className="p-6 border-b-2 border-black bg-slate-50 flex items-center justify-between">
          <div className="relative flex-1 max-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-black" />
            <Input className="pl-10 h-11 border-2 border-black font-black text-base" placeholder="Search ID/Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Badge className="bg-black text-white font-black px-4 py-1.5 uppercase tracking-[0.2em]">{reportData.length} Personnel Audited</Badge>
        </div>
        
        <div className="overflow-x-auto">
          <Table className="min-w-[1800px] border-collapse text-black font-black tabular-nums">
            <TableHeader className="bg-slate-100 border-b-2 border-black">
              <tr>
                <th rowSpan={2} className="w-[100px] sticky left-0 bg-slate-100 z-20 border-r-2 border-black text-black font-black uppercase text-[10px] p-4">Member ID</th>
                <th rowSpan={2} className="w-[200px] sticky left-[100px] bg-slate-100 z-20 border-r-2 border-black text-black font-black uppercase text-[10px] p-4">Personnel Name</th>
                <th colSpan={4} className="text-center border-r-2 border-black text-[10px] uppercase py-2 bg-slate-200/50">Contributions & Loans</th>
                <th colSpan={2} className="text-center border-r-2 border-black text-[10px] uppercase py-2">Profits</th>
                <th className="text-center border-r-2 border-black text-[10px] uppercase py-2 bg-slate-200">Net Fund (7)</th>
                <th colSpan={2} className="text-center border-r-2 border-black text-[10px] uppercase py-2">Office Matching</th>
                <th className="text-center border-r-2 border-black text-[10px] uppercase py-2 bg-slate-100">Office Net (10)</th>
                <th className="text-center text-[10px] uppercase py-2 bg-slate-300">Total Fund (11)</th>
              </tr>
              <tr className="bg-slate-50 text-[8px] uppercase border-b-2 border-black">
                <th className="p-2 text-right border-r border-black/20">Col 1 (Cont)</th>
                <th className="p-2 text-right border-r border-black/20">Col 2 (Draw)</th>
                <th className="p-2 text-right border-r border-black/20">Col 3 (Pay)</th>
                <th className="p-2 text-right border-r-2 border-black font-black bg-slate-100">Col 4 (Bal)</th>
                <th className="p-2 text-right border-r border-black/20">Col 5 (Emp)</th>
                <th className="p-2 text-right border-r-2 border-black">Col 6 (Loan)</th>
                <th className="p-2 text-right border-r-2 border-black font-black bg-slate-200">Net Emp (7)</th>
                <th className="p-2 text-right border-r border-black/20">Col 8 (PBS)</th>
                <th className="p-2 text-right border-r-2 border-black">Col 9 (Profit)</th>
                <th className="p-2 text-right border-r-2 border-black font-black bg-slate-100">Net Off (10)</th>
                <th className="p-2 text-right font-black bg-slate-200 text-[10px]">TOTAL (11)</th>
              </tr>
            </TableHeader>
            <TableBody>
              {reportData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-slate-100 border-b border-black text-[11px]">
                  <td className="font-mono p-3 sticky left-0 bg-white border-r-2 border-black z-10">{row.memberIdNumber}</td>
                  <td className="p-3 font-black sticky left-[100px] bg-white border-r-2 border-black z-10 truncate uppercase">{row.name}</td>
                  <td className="text-right p-3 border-r border-black/10">{row.c1.toLocaleString()}</td>
                  <td className="text-right p-3 border-r border-black/10">{row.c2.toLocaleString()}</td>
                  <td className="text-right p-3 border-r border-black/10">{row.c3.toLocaleString()}</td>
                  <td className="text-right p-3 border-r-2 border-black font-black bg-slate-50">{row.c4.toLocaleString()}</td>
                  <td className="text-right p-3 border-r border-black/10">{row.c5.toLocaleString()}</td>
                  <td className="text-right p-3 border-r-2 border-black">{row.c6.toLocaleString()}</td>
                  <td className="text-right p-3 border-r-2 border-black font-black bg-slate-50">{row.c7.toLocaleString()}</td>
                  <td className="text-right p-3 border-r border-black/10">{row.c8.toLocaleString()}</td>
                  <td className="text-right p-3 border-r-2 border-black">{row.c9.toLocaleString()}</td>
                  <td className="text-right p-3 border-r-2 border-black font-black bg-slate-50">{row.c10.toLocaleString()}</td>
                  <td className="text-right p-3 font-black bg-slate-100 text-sm underline decoration-black"> {row.c11.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="sticky bottom-0 bg-slate-900 text-white font-black z-30">
              <TableRow className="h-16">
                <TableCell colSpan={2} className="sticky left-0 bg-slate-900 z-40 border-r-2 border-white/20 text-right uppercase tracking-widest text-[10px] pr-4">Consolidated Totals:</TableCell>
                <TableCell className="text-right border-r border-white/10">{stats.c1.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10">{stats.c2.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10">{stats.c3.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/40 bg-white/10">{stats.c4.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10">{stats.c5.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/40">{stats.c6.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/40 bg-white/10">{stats.c7.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10">{stats.c8.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/40">{stats.c9.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/40 bg-white/10">{stats.c10.toLocaleString()}</TableCell>
                <TableCell className="text-right text-xl underline decoration-double bg-white text-black pr-4">৳ {stats.c11.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.4em] mt-4">Matrix Statement of Consolidated Ledger Sums</h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <span className="bg-black text-white px-4 py-1 rounded">Consolidated As Of: {dateRange.end}</span>
            <span>Audit Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[7px] border-collapse border-2 border-black text-black font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-black">
              <th className="border border-black p-1 uppercase">ID No</th>
              <th className="border border-black p-1 text-left uppercase">Name & Designation</th>
              <th className="border border-black p-1 text-right uppercase">Col 1</th>
              <th className="border border-black p-1 text-right uppercase">Col 2</th>
              <th className="border border-black p-1 text-right uppercase">Col 3</th>
              <th className="border border-black p-1 text-right uppercase">Col 4</th>
              <th className="border border-black p-1 text-right uppercase">Col 5</th>
              <th className="border border-black p-1 text-right uppercase">Col 6</th>
              <th className="border border-black p-1 text-right uppercase">Col 7</th>
              <th className="border border-black p-1 text-right uppercase">Col 8</th>
              <th className="border border-black p-1 text-right uppercase">Col 9</th>
              <th className="border border-black p-1 text-right uppercase">Col 10</th>
              <th className="border border-black p-1 text-right uppercase bg-slate-50">Col 11</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, idx) => (
              <tr key={idx} className="border-b border-black">
                <td className="border border-black p-1 text-center font-mono">{row.memberIdNumber}</td>
                <td className="border border-black p-1 uppercase"><b>{row.name}</b><br/>{row.designation}</td>
                <td className="border border-black p-1 text-right">{row.c1.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c2.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c3.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c4.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c5.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c6.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black">{row.c7.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c8.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c9.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black">{row.c10.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black bg-slate-50">{row.c11.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black border-t-2 border-black h-12">
              <td colSpan={2} className="border border-black p-2 text-right uppercase">Institutional Aggregates:</td>
              <td className="border border-black p-1 text-right">{stats.c1.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.c2.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.c3.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.c4.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.c5.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.c6.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.c7.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.c8.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.c9.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.c10.toLocaleString()}</td>
              <td className="border border-black p-1 text-right text-xs underline decoration-double">৳ {stats.c11.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center">
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Prepared by</div>
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Checked by</div>
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Approved By Trustee</div>
        </div>
        <StandardFooter />
      </div>
    </div>
  );
}
