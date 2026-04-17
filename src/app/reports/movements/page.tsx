
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
  Activity,
  ArrowLeft
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
import Link from "next/link";

export default function FundMovementReportPage() {
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
      let opEmp = 0, opPbs = 0, addEmp = 0, adjEmp = 0, addPbs = 0, adjPbs = 0;

      memberSummaries.forEach(s => {
        const entryDate = new Date(s.summaryDate).getTime();
        const v = { c1: Number(s.employeeContribution)||0, c2: Number(s.loanWithdrawal)||0, c3: Number(s.loanRepayment)||0, c5: Number(s.profitEmployee)||0, c6: Number(s.profitLoan)||0, c8: Number(s.pbsContribution)||0, c9: Number(s.profitPbs)||0 };
        if (entryDate < start) { opEmp += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6); opPbs += (v.c8 + v.c9); }
        else if (entryDate <= end) { addEmp += v.c1; adjEmp += (v.c5 + v.c6 + (v.c3 - v.c2)); addPbs += v.c8; adjPbs += v.c9; }
      });

      return { memberIdNumber: member.memberIdNumber, name: member.name, designation: member.designation, opEmp, addEmp, adjEmp, clEmp: opEmp+addEmp+adjEmp, opPbs, addPbs, adjPbs, clPbs: opPbs+addPbs+adjPbs, total: (opEmp+addEmp+adjEmp)+(opPbs+addPbs+adjPbs) };
    })
    .filter(row => row.name.toLowerCase().includes(search.toLowerCase()) || row.memberIdNumber?.includes(search))
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, dateRange, search]);

  const stats = useMemo(() => reportData.reduce((acc, c) => ({ op: acc.op+c.opEmp+c.opPbs, cl: acc.cl+c.total }), { op: 0, cl: 0 }), [reportData]);

  const StandardFooter = () => (
    <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
      <span>CPF Management Software</span>
      <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
    </div>
  );

  if (isMembersLoading || isSummariesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-black">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape !important; margin: 4mm !important; }
          .print-container { width: 100% !important; transform: scale(1); transform-origin: top left; display: block !important; }
          table { table-layout: fixed !important; width: 100% !important; }
          body { background-color: white !important; font-size: 8px !important; }
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-1.5 hover:bg-slate-100 rounded-full border border-black"><ArrowLeft className="size-5 text-black" /></Link>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Fund Movement</h1>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border-2 border-black">
          <div className="flex items-center gap-2">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black">Start</Label>
              <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 w-32 border-black text-[10px] font-black p-1" />
            </div>
            <ArrowRightLeft className="size-3 mt-4 opacity-30" />
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black">End</Label>
              <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 w-32 border-black text-[10px] font-black p-1" />
            </div>
          </div>
          <Button onClick={() => window.print()} className="h-8 font-black px-4 bg-black text-white text-[9px] uppercase">
            <Printer className="size-3 mr-1" /> Print
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-none border-2 border-black overflow-hidden print-container">
        <div className="p-2 border-b-2 border-black bg-slate-100 flex items-center justify-between no-print">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 opacity-40" />
            <Input className="pl-7 h-8 border-black font-black text-[10px]" placeholder="Search ID/Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-hidden">
          <Table className="w-full font-black tabular-nums border-collapse text-[9px]">
            <TableHeader className="bg-slate-100 border-b-2 border-black">
              <tr className="uppercase text-[8px] leading-tight">
                <th className="font-black p-1 w-[50px] border-r">ID</th>
                <th className="font-black p-1 text-left w-[120px] border-r">Name</th>
                <th className="text-right p-1 border-r">E-Open</th>
                <th className="text-right p-1 border-r">E-Add</th>
                <th className="text-right p-1 border-r">E-Adj</th>
                <th className="text-right p-1 border-r-2 bg-slate-200">E-Close</th>
                <th className="text-right p-1 border-r">P-Open</th>
                <th className="text-right p-1 border-r">P-Add</th>
                <th className="text-right p-1 border-r">P-Adj</th>
                <th className="text-right p-1 border-r-2 bg-slate-200">P-Close</th>
                <th className="text-right p-1 bg-black text-white">TOTAL</th>
              </tr>
            </TableHeader>
            <TableBody>
              {reportData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-slate-100 border-b border-black h-8">
                  <td className="font-mono p-1 border-r text-center">{row.memberIdNumber}</td>
                  <td className="p-1 border-r uppercase truncate leading-none">
                    <span className="font-black block">{row.name}</span>
                  </td>
                  <td className="text-right p-0.5 border-r">{row.opEmp.toLocaleString()}</td>
                  <td className="text-right p-0.5 border-r">{row.addEmp.toLocaleString()}</td>
                  <td className="text-right p-0.5 border-r">{row.adjEmp.toLocaleString()}</td>
                  <td className="text-right p-0.5 border-r-2 bg-slate-50 font-bold">{row.clEmp.toLocaleString()}</td>
                  <td className="text-right p-0.5 border-r">{row.opPbs.toLocaleString()}</td>
                  <td className="text-right p-0.5 border-r">{row.addPbs.toLocaleString()}</td>
                  <td className="text-right p-0.5 border-r">{row.adjPbs.toLocaleString()}</td>
                  <td className="text-right p-0.5 border-r-2 bg-slate-50 font-bold">{row.clPbs.toLocaleString()}</td>
                  <td className="text-right p-0.5 bg-slate-100 font-bold"> {row.total.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-black text-white font-black text-[8px]">
              <TableRow className="h-10">
                <td colSpan={2} className="text-right pr-2">CONSOLIDATED:</td>
                <td className="text-right">{reportData.reduce((s, r) => s + r.opEmp, 0).toLocaleString()}</td>
                <td colSpan={2} className="text-right">SUM:</td>
                <td className="text-right bg-white/10">{reportData.reduce((s, r) => s + r.clEmp, 0).toLocaleString()}</td>
                <td className="text-right">{reportData.reduce((s, r) => s + r.opPbs, 0).toLocaleString()}</td>
                <td colSpan={2} className="text-right">SUM:</td>
                <td className="text-right bg-white/10">{reportData.reduce((s, r) => s + r.clPbs, 0).toLocaleString()}</td>
                <td className="text-right bg-white text-black">৳ {stats.cl.toLocaleString()}</td>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <StandardFooter />
      </div>
    </div>
  );
}
