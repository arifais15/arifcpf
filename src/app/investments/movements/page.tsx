"use client"

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Search, ArrowRightLeft, ArrowLeft, FileSpreadsheet } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

export default function FundMovementReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [search, setSearch] = useState("");

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  useEffect(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const sYear = curMonth >= 7 ? curYear : curYear - 1;
    setDateRange({ start: `${sYear}-07-01`, end: now.toISOString().split('T')[0] });
  }, []);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const reportData = useMemo(() => {
    if (!members || !allSummaries || !dateRange.start) return [];
    const s = new Date(dateRange.start).getTime();
    const e = new Date(dateRange.end).getTime();
    return members.map(m => {
      const ms = allSummaries.filter(x => x.memberId === m.id);
      let opE=0, opP=0, addE=0, adjE=0, addP=0, adjP=0;
      ms.forEach(x => {
        const d = new Date(x.summaryDate).getTime();
        const v = { c1:Number(x.employeeContribution)||0, c2:Number(x.loanWithdrawal)||0, c3:Number(x.loanRepayment)||0, c5:Number(x.profitEmployee)||0, c6:Number(x.profitLoan)||0, c8:Number(x.pbsContribution)||0, c9:Number(x.profitPbs)||0 };
        if (d < s) { opE += (v.c1-v.c2+v.c3+v.c5+v.c6); opP += (v.c8+v.c9); }
        else if (d <= e) { addE += v.c1; adjE += (v.c5+v.c6+(v.c3-v.c2)); addP += v.c8; adjP += v.c9; }
      });
      const clE = opE+addE+adjE; const clP = opP+addP+adjP;
      return { id: m.memberIdNumber, name: m.name, opE, addE, adjE, clE, opP, addP, adjP, clP, total: clE+clP };
    })
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.id?.includes(search))
    .sort((a,b) => (a.id||"").localeCompare(b.id||""));
  }, [members, allSummaries, dateRange, search]);

  const stats = useMemo(() => reportData.reduce((a,c) => ({ opE:a.opE+c.opE, clE:a.clE+c.clE, opP:a.opP+c.opP, clP:a.clP+c.clP, total:a.total+c.total }), {opE:0,clE:0,opP:0,clP:0,total:0}), [reportData]);

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    const exportRows = reportData.map(r => ({
      "ID No": r.id,
      "Name": r.name,
      "E-Open": r.opE,
      "E-Add": r.addE,
      "E-Adj": r.adjE,
      "E-Close": r.clE,
      "P-Open": r.opP,
      "P-Add": r.addP,
      "P-Adj": r.adjP,
      "P-Close": r.clP,
      "Total Fund": r.total
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fund Movements");
    XLSX.writeFile(wb, `Fund_Movements_${dateRange.start}_to_${dateRange.end}.xlsx`);
    toast({ title: "Exported", description: "Movement audit data saved to Excel." });
  };

  if (isMembersLoading || isSummariesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-primary" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-[#000000]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link href="/investments" className="p-1.5 hover:bg-slate-100 rounded-full border border-black"><ArrowLeft className="size-5" /></Link>
          <h1 className="text-2xl font-black uppercase tracking-tight">Fund Movement Audit</h1>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-2 border border-black rounded-xl">
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase ml-1">Start</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start:e.target.value})} className="h-8 w-32 border-black text-[10px] font-black" /></div>
          <ArrowRightLeft className="size-3 opacity-30" />
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase ml-1">End</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end:e.target.value})} className="h-8 w-32 border-black text-[10px] font-black" /></div>
          <Button variant="outline" onClick={exportToExcel} className="h-9 border-black font-black text-[10px] px-6 uppercase tracking-widest"><FileSpreadsheet className="size-3.5 mr-2" /> Export</Button>
          <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-[10px] px-8 uppercase tracking-widest"><Printer className="size-3.5 mr-2" /> Print</Button>
        </div>
      </div>

      <div className="bg-white rounded-none border border-black overflow-hidden print-container shadow-2xl">
        <div className="p-2 border-b border-black bg-slate-50 flex items-center justify-between no-print">
          <div className="relative flex-1 max-w-xs"><Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 opacity-40" /><Input className="pl-7 h-8 border-black font-black text-[10px] bg-white" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Badge className="bg-black text-white font-black text-[9px] uppercase tracking-widest rounded-none">{reportData.length} Personnel</Badge>
        </div>
        
        <div className="overflow-x-auto">
          <Table className="w-full text-[8px] font-black table-fixed border-collapse text-[#000000]">
            <TableHeader className="bg-slate-100 border-b border-black uppercase text-[7px] leading-tight">
              <TableRow className="border-b border-black">
                <TableHead className="border-r border-black p-0.5 w-[40px] font-black text-black text-center h-8">ID No</TableHead>
                <TableHead className="border-r border-black p-0.5 text-left w-[110px] font-black text-black h-8">Personnel Name</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[65px] bg-slate-50 font-black text-black h-8">E-Open</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[65px] font-black text-black h-8">E-Add</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[65px] font-black text-black h-8">E-Adj</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[75px] bg-slate-200 font-black text-black h-8">E-Close</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[65px] bg-slate-50 font-black text-black h-8">P-Open</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[65px] font-black text-black h-8">P-Add</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[65px] font-black text-black h-8">P-Adj</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[75px] bg-slate-200 font-black text-black h-8">P-Close</TableHead>
                <TableHead className="text-right p-0.5 w-[90px] bg-black text-white font-black h-8">Total Fund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((r, i) => (
                <TableRow key={i} className="border-b border-black hover:bg-slate-50 h-8">
                  <TableCell className="p-0.5 border-r border-black font-mono text-center text-black">{r.id}</TableCell>
                  <TableCell className="p-0.5 border-r border-black truncate uppercase font-black text-black">{r.name}</TableCell>
                  <TableCell className="text-right p-0.5 border-r bg-slate-50 text-black">{r.opE.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.addE.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.adjE.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r bg-slate-100 font-bold text-black">{r.clE.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r bg-slate-50 text-black">{r.opP.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.addP.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.adjP.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r bg-slate-100 font-bold text-black">{r.clP.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 bg-slate-200 font-black text-black">{r.total.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-black text-white text-[7px] font-black h-10 border-t-2 border-white/20">
              <TableRow className="h-10 hover:bg-black">
                <TableCell colSpan={2} className="text-right pr-2 uppercase font-black text-white">Aggregates:</TableCell>
                <TableCell className="text-right border-l border-white/10 bg-white/5 font-black text-white">{stats.opE.toLocaleString()}</TableCell>
                <TableCell colSpan={2} className="border-l border-white/10"></TableCell>
                <TableCell className="text-right border-l border-white/10 bg-white/15 font-bold text-white">{stats.clE.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-white/10 bg-white/5 font-black text-white">{stats.opP.toLocaleString()}</TableCell>
                <TableCell colSpan={2} className="border-l border-white/10"></TableCell>
                <TableCell className="text-right border-l border-white/10 bg-white/15 font-bold text-white">{stats.clP.toLocaleString()}</TableCell>
                <TableCell className="text-right bg-white text-black text-[9px] font-black">৳ {stats.total.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
