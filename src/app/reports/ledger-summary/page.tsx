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

export default function LedgerSummaryReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    setDateRange(prev => ({ ...prev, end: today }));
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
      "Employee_Contribution": r.c1,
      "Loan_Disbursed": r.c2,
      "Loan_Repaid": r.c3,
      "Loan_Balance": r.c4,
      "Employee_Profit": r.c5,
      "Loan_Profit": r.c6,
      "Net_Employee_Equity": r.c7,
      "PBS_Contribution": r.c8,
      "PBS_Profit": r.c9,
      "Net_Office_Share": r.c10,
      "Total_Inst_Fund": r.c11
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matrix");
    XLSX.writeFile(wb, `Consolidated_Ledger_${dateRange.end}.xlsx`);
  };

  if (isMembersLoading || isSummariesLoading) {
    return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 5mm !important;
          }
          .print-container {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            display: block !important;
            transform: scale(0.92);
            transform-origin: top left;
          }
          table {
            table-layout: fixed !important;
            width: 100% !important;
          }
          body {
            background-color: white !important;
          }
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="bg-black p-4 rounded-2xl shadow-lg">
            <ClipboardCheck className="size-8 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-black tracking-tighter uppercase">Consolidated Ledger Matrix</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Institutional Aggregation of Member Fund Sums (REB Form 224)</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-white p-4 rounded-2xl border-4 border-black shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="grid gap-1.5">
              <Label className="text-[10px] uppercase font-black text-black tracking-widest">Balance Cut-off</Label>
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

      <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print animate-in fade-in duration-500">
        <div className="p-6 border-b-4 border-black bg-slate-100 flex items-center justify-between">
          <div className="relative flex-1 max-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-black" />
            <Input className="pl-10 h-11 border-2 border-black font-black text-base" placeholder="Search Personnel (ID/Name)..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Badge className="bg-black text-white font-black px-6 py-2 text-sm uppercase tracking-[0.2em]">{reportData.length} Members Audited</Badge>
        </div>
        
        <div className="overflow-x-auto">
          <Table className="min-w-[1800px] border-collapse text-black font-black tabular-nums">
            <TableHeader className="bg-slate-100 border-b-4 border-black">
              <tr>
                <th rowSpan={2} className="w-[100px] sticky left-0 bg-slate-100 z-20 border-r-4 border-black text-black font-black uppercase text-[11px] p-4">Member ID</th>
                <th rowSpan={2} className="w-[250px] sticky left-[100px] bg-slate-100 z-20 border-r-4 border-black text-black font-black uppercase text-[11px] p-4">Personnel Details</th>
                <th colSpan={4} className="text-center border-r-4 border-black text-[11px] uppercase py-3 bg-slate-200/50">Contributions & Loans</th>
                <th colSpan={2} className="text-center border-r-4 border-black text-[11px] uppercase py-3 bg-slate-100">Profits Accrued</th>
                <th className="text-center border-r-4 border-black text-[11px] uppercase py-3 bg-slate-200">Net Emp (7)</th>
                <th colSpan={2} className="text-center border-r-4 border-black text-[11px] uppercase py-3 bg-slate-100">Office Matching</th>
                <th className="text-center border-r-4 border-black text-[11px] uppercase py-3 bg-slate-200">Net Off (10)</th>
                <th className="text-center text-[12px] uppercase py-3 bg-black text-white tracking-widest">Total Fund (11)</th>
              </tr>
              <tr className="bg-slate-50 text-[10px] uppercase border-b-4 border-black">
                <th className="p-3 text-right border-r-2 border-black/20">Emp Cont. (1)</th>
                <th className="p-3 text-right border-r-2 border-black/20">Loan Disb. (2)</th>
                <th className="p-3 text-right border-r-2 border-black/20">Loan Repay. (3)</th>
                <th className="p-3 text-right border-r-4 border-black font-black bg-slate-100">Loan Bal. (4)</th>
                <th className="p-3 text-right border-r-2 border-black/20">Emp Profit (5)</th>
                <th className="p-3 text-right border-r-4 border-black">Loan Prof. (6)</th>
                <th className="p-3 text-right border-r-4 border-black font-black bg-slate-200 text-primary">Equity (7)</th>
                <th className="p-3 text-right border-r-2 border-black/20">PBS Cont. (8)</th>
                <th className="p-3 text-right border-r-4 border-black">PBS Prof. (9)</th>
                <th className="p-3 text-right border-r-4 border-black font-black bg-slate-100 text-primary">Matching (10)</th>
                <th className="p-3 text-right font-black bg-slate-300 text-[12px] underline decoration-black underline-offset-4">TOTAL (11)</th>
              </tr>
            </TableHeader>
            <TableBody>
              {reportData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-slate-100 border-b-2 border-black text-[12px]">
                  <td className="font-mono font-black p-4 sticky left-0 bg-white border-r-4 border-black z-10 text-base">{row.memberIdNumber}</td>
                  <td className="p-4 font-black sticky left-[100px] bg-white border-r-4 border-black z-10 uppercase">
                    <div className="flex flex-col">
                      <span className="text-sm">{row.name}</span>
                      <span className="text-[10px] opacity-60 font-bold">{row.designation}</span>
                    </div>
                  </td>
                  <td className="text-right p-4 border-r-2 border-black/10">{row.c1.toLocaleString()}</td>
                  <td className="text-right p-4 border-r-2 border-black/10">{row.c2.toLocaleString()}</td>
                  <td className="text-right p-4 border-r-2 border-black/10">{row.c3.toLocaleString()}</td>
                  <td className="text-right p-4 border-r-4 border-black font-black bg-slate-50">{row.c4.toLocaleString()}</td>
                  <td className="text-right p-4 border-r-2 border-black/10">{row.c5.toLocaleString()}</td>
                  <td className="text-right p-4 border-r-4 border-black">{row.c6.toLocaleString()}</td>
                  <td className="text-right p-4 border-r-4 border-black font-black bg-slate-50 text-primary">{row.c7.toLocaleString()}</td>
                  <td className="text-right p-4 border-r-2 border-black/10">{row.c8.toLocaleString()}</td>
                  <td className="text-right p-4 border-r-4 border-black">{row.c9.toLocaleString()}</td>
                  <td className="text-right p-4 border-r-4 border-black font-black bg-slate-50 text-primary">{row.c10.toLocaleString()}</td>
                  <td className="text-right p-4 font-black bg-slate-100 text-base underline decoration-black decoration-2">৳ {row.c11.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="sticky bottom-0 bg-slate-900 text-white font-black z-30">
              <TableRow className="h-20">
                <TableCell colSpan={2} className="sticky left-0 bg-slate-900 z-40 border-r-4 border-white/40 text-right uppercase tracking-[0.2em] text-[11px] pr-6">Consolidated Totals:</TableCell>
                <TableCell className="text-right border-r-2 border-white/10">{stats.c1.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10">{stats.c2.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10">{stats.c3.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-4 border-white/40 bg-white/10">{stats.c4.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10">{stats.c5.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-4 border-white/40">{stats.c6.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-4 border-white/40 bg-white/10 text-emerald-400">{stats.c7.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10">{stats.c8.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-4 border-white/40">{stats.c9.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-4 border-white/40 bg-white/10 text-emerald-400">{stats.c10.toLocaleString()}</TableCell>
                <TableCell className="text-right text-3xl underline decoration-double bg-white text-black pr-6 tabular-nums">৳ {stats.c11.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest p-6">
          <span>CPF Management Software</span>
          <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
        </div>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-lg font-black uppercase tracking-[0.4em] text-slate-700">Contributory Provident Fund</p>
          <h2 className="text-2xl font-black underline underline-offset-8 decoration-4 uppercase tracking-[0.3em] mt-6">Institutional Ledger Matrix Statement</h2>
          <div className="flex justify-between text-[12px] font-black pt-10">
            <span className="bg-black text-white px-6 py-2 rounded-none uppercase tracking-widest">Balances As Of: {dateRange.end}</span>
            <span className="pt-2 uppercase tracking-widest">Audit Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[8.5px] border-collapse border-2 border-black text-black font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 border-b-4 border-black">
              <th className="border-2 border-black p-2 uppercase w-[60px]">ID No</th>
              <th className="border-2 border-black p-2 text-left uppercase">Name & Designation</th>
              <th className="border-2 border-black p-1 text-right uppercase">Emp Cont</th>
              <th className="border-2 border-black p-1 text-right uppercase">Loan Draw</th>
              <th className="border-2 border-black p-1 text-right uppercase">Loan Pay</th>
              <th className="border-2 border-black p-1 text-right uppercase bg-slate-50">Loan Bal</th>
              <th className="border-2 border-black p-1 text-right uppercase">Emp Prof</th>
              <th className="border-2 border-black p-1 text-right uppercase">Loan Prof</th>
              <th className="border-2 border-black p-1 text-right uppercase bg-slate-100">Net Emp</th>
              <th className="border-2 border-black p-1 text-right uppercase">PBS Cont</th>
              <th className="border-2 border-black p-1 text-right uppercase">PBS Prof</th>
              <th className="border-2 border-black p-1 text-right uppercase bg-slate-100">Net Off</th>
              <th className="border-2 border-black p-1 text-right uppercase bg-slate-200 text-[10px]">TOTAL FUND</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, idx) => (
              <tr key={idx} className="border-b border-black">
                <td className="border border-black p-1.5 text-center font-mono font-black">{row.memberIdNumber}</td>
                <td className="border border-black p-1.5 uppercase leading-tight"><b>{row.name}</b><br/>{row.designation}</td>
                <td className="border border-black p-1 text-right">{row.c1.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c2.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c3.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-50">{row.c4.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c5.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c6.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black">{row.c7.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c8.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.c9.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black">{row.c10.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black bg-slate-100 text-[10px]">৳ {row.c11.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black border-t-4 border-black h-16">
              <td colSpan={2} className="border-2 border-black p-3 text-right uppercase tracking-widest text-[11px]">Institutional Grand Totals:</td>
              <td className="border-2 border-black p-1 text-right">{stats.c1.toLocaleString()}</td>
              <td className="border-2 border-black p-1 text-right">{stats.c2.toLocaleString()}</td>
              <td className="border-2 border-black p-1 text-right">{stats.c3.toLocaleString()}</td>
              <td className="border-2 border-black p-1 text-right">{stats.c4.toLocaleString()}</td>
              <td className="border-2 border-black p-1 text-right">{stats.c5.toLocaleString()}</td>
              <td className="border-2 border-black p-1 text-right">{stats.c6.toLocaleString()}</td>
              <td className="border-2 border-black p-1 text-right text-[10px]">{stats.c7.toLocaleString()}</td>
              <td className="border-2 border-black p-1 text-right">{stats.c8.toLocaleString()}</td>
              <td className="border-2 border-black p-1 text-right">{stats.c9.toLocaleString()}</td>
              <td className="border-2 border-black p-1 text-right text-[10px]">{stats.c10.toLocaleString()}</td>
              <td className="border-2 border-black p-1 text-right text-lg underline decoration-double underline-offset-4">৳ {stats.c11.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-32 grid grid-cols-3 gap-16 text-[14px] font-black text-center uppercase tracking-[0.3em]">
          <div className="border-t-4 border-black pt-4">Prepared by</div>
          <div className="border-t-4 border-black pt-4">Checked by</div>
          <div className="border-t-4 border-black pt-4">Approved By Trustee</div>
        </div>
        <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
          <span>CPF Management Software</span>
          <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
        </div>
      </div>
    </div>
  );
}
