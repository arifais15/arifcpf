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
  ClipboardCheck,
  ShieldCheck
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
    setDateRange({ start: "", end: new Date().toISOString().split('T')[0] });
  }, []);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const reportData = useMemo(() => {
    if (!members || !allSummaries || !dateRange.end) return [];
    const cutOff = new Date(dateRange.end).getTime();

    return members.map(m => {
      const ms = allSummaries.filter(s => s.memberId === m.id && new Date(s.summaryDate).getTime() <= cutOff);
      let c1=0,c2=0,c3=0,c5=0,c6=0,c8=0,c9=0;
      ms.forEach(s => {
        c1 += Number(s.employeeContribution)||0; c2 += Number(s.loanWithdrawal)||0; c3 += Number(s.loanRepayment)||0;
        c5 += Number(s.profitEmployee)||0; c6 += Number(s.profitLoan)||0; c8 += Number(s.pbsContribution)||0; c9 += Number(s.profitPbs)||0;
      });
      const c4 = c2 - c3; const c7 = c1 - c2 + c3 + c5 + c6; const c10 = c8 + c9; const c11 = c7 + c10;
      return { memberIdNumber: m.memberIdNumber, name: m.name, designation: m.designation, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11 };
    }).filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.memberIdNumber?.includes(search)).sort((a,b) => (a.memberIdNumber||"").localeCompare(b.memberIdNumber||""));
  }, [members, allSummaries, dateRange.end, search]);

  const stats = useMemo(() => reportData.reduce((a,c) => ({ c1:a.c1+c.c1, c2:a.c2+c.c2, c3:a.c3+c.c3, c4:a.c4+c.c4, c5:a.c5+c.c5, c6:a.c6+c.c6, c7:a.c7+c.c7, c8:a.c8+c.c8, c9:a.c9+c.c9, c10:a.c10+c.c10, c11:a.c11+c.c11 }), {c1:0,c2:0,c3:0,c4:0,c5:0,c6:0,c7:0,c8:0,c9:0,c10:0,c11:0}), [reportData]);

  const StandardFooter = () => (
    <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
      <span>CPF Management Software</span><span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
    </div>
  );

  if (isMembersLoading || isSummariesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4 landscape !important; margin: 5mm !important; } .print-container { width: 100% !important; transform: scale(0.92); transform-origin: top left; display: block !important; } table { table-layout: fixed !important; width: 100% !important; } body { background-color: white !important; } }` }} />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-5"><div className="bg-black p-4 rounded-2xl"><ClipboardCheck className="size-8 text-white" /></div><div className="flex flex-col"><h1 className="text-3xl font-black tracking-tighter uppercase">Ledger Summary Matrix</h1><p className="text-[10px] font-black bg-black text-white px-2 py-0.5 uppercase tracking-widest rounded">Consolidated Trust Balances Audit</p></div></div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border-4 border-black shadow-xl">
          <div className="grid gap-1"><Label className="text-[10px] font-black uppercase">Cut-off</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 border-2 border-black font-black" /></div>
          <Button onClick={() => window.print()} className="h-10 font-black px-8 bg-black text-white uppercase tracking-widest text-xs"><Printer className="size-4 mr-2" /> Print Matrix</Button>
        </div>
      </div>

      <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden print-container">
        <div className="p-4 border-b-4 border-black bg-slate-100 flex items-center justify-between no-print">
          <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4" /><Input className="pl-9 h-10 border-2 border-black font-black" placeholder="Search ID/Name..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Badge className="bg-black text-white font-black px-4 py-1.5 uppercase tracking-widest">{reportData.length} Personnel Audited</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1800px] font-black tabular-nums border-collapse">
            <TableHeader className="bg-slate-100 border-b-4 border-black">
              <tr>
                <th rowSpan={2} className="border-r-4 border-black p-2 w-[100px] uppercase text-[10px]">Member ID</th>
                <th rowSpan={2} className="border-r-4 border-black p-2 w-[250px] uppercase text-[10px]">Name & Designation</th>
                <th colSpan={4} className="border-r-4 border-black p-2 bg-slate-200/50 uppercase text-[10px]">Contributions & Loans</th>
                <th colSpan={2} className="border-r-4 border-black p-2 bg-slate-100 uppercase text-[10px]">Profits Accrued</th>
                <th className="border-r-4 border-black p-2 bg-slate-200 uppercase text-[10px]">Net Emp(7)</th>
                <th colSpan={2} className="border-r-4 border-black p-2 bg-slate-100 uppercase text-[10px]">Office Matching</th>
                <th className="border-r-4 border-black p-2 bg-slate-200 uppercase text-[10px]">Net Off(10)</th>
                <th className="p-2 bg-black text-white uppercase text-[11px]">Total(11)</th>
              </tr>
              <tr className="bg-slate-50 text-[9px] uppercase">
                <th className="p-2 text-right border-r">Emp(1)</th><th className="p-2 text-right border-r">Loan(2)</th><th className="p-2 text-right border-r">Repay(3)</th><th className="p-2 text-right border-r-4 bg-slate-100">Bal(4)</th>
                <th className="p-2 text-right border-r">Prof(5)</th><th className="p-2 text-right border-r-4">Loan(6)</th><th className="p-2 text-right border-r-4 bg-slate-200">Equity(7)</th>
                <th className="p-2 text-right border-r">PBS(8)</th><th className="p-2 text-right border-r-4">Prof(9)</th><th className="p-2 text-right border-r-4 bg-slate-100">Match(10)</th><th className="p-2 text-right bg-slate-300">Total(11)</th>
              </tr>
            </TableHeader>
            <TableBody>
              {reportData.map((r, i) => (
                <TableRow key={i} className="border-b-2 border-black hover:bg-slate-50">
                  <td className="p-2 border-r-4 border-black font-mono text-base">{r.memberIdNumber}</td>
                  <td className="p-2 border-r-4 border-black uppercase"><div><p className="text-xs font-black">{r.name}</p><p className="text-[9px] opacity-60">{r.designation}</p></div></td>
                  <td className="p-2 text-right border-r">{r.c1.toLocaleString()}</td><td className="p-2 text-right border-r">{r.c2.toLocaleString()}</td><td className="p-2 text-right border-r">{r.c3.toLocaleString()}</td><td className="p-2 text-right border-r-4 bg-slate-50">{r.c4.toLocaleString()}</td>
                  <td className="p-2 text-right border-r">{r.c5.toLocaleString()}</td><td className="p-2 text-right border-r-4">{r.c6.toLocaleString()}</td><td className="p-2 text-right border-r-4 bg-slate-50">{r.c7.toLocaleString()}</td>
                  <td className="p-2 text-right border-r">{r.c8.toLocaleString()}</td><td className="p-2 text-right border-r-4">{r.c9.toLocaleString()}</td><td className="p-2 text-right border-r-4 bg-slate-50">{r.c10.toLocaleString()}</td>
                  <td className="p-2 text-right bg-slate-100 underline decoration-black decoration-2">৳ {r.c11.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-900 text-white font-black">
              <TableRow className="h-16">
                <TableCell colSpan={2} className="text-right uppercase tracking-[0.3em] text-[10px] pr-8">Grand Totals:</TableCell>
                <TableCell className="text-right border-r border-white/20">{stats.c1.toLocaleString()}</TableCell><TableCell className="text-right border-r border-white/20">{stats.c2.toLocaleString()}</TableCell><TableCell className="text-right border-r border-white/20">{stats.c3.toLocaleString()}</TableCell><TableCell className="text-right border-r-4 border-white/40 bg-white/10">{stats.c4.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/20">{stats.c5.toLocaleString()}</TableCell><TableCell className="text-right border-r-4 border-white/40">{stats.c6.toLocaleString()}</TableCell><TableCell className="text-right border-r-4 border-white/40 bg-white/10">{stats.c7.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/20">{stats.c8.toLocaleString()}</TableCell><TableCell className="text-right border-r-4 border-white/40">{stats.c9.toLocaleString()}</TableCell><TableCell className="text-right border-r-4 border-white/40 bg-white/10">{stats.c10.toLocaleString()}</TableCell>
                <TableCell className="text-right bg-white text-black text-xl underline decoration-double">৳ {stats.c11.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <StandardFooter />
      </div>
    </div>
  );
}