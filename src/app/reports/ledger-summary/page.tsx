"use client"

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Search, ArrowLeft } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function LedgerSummaryReportPage() {
  const firestore = useFirestore();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [asOfDate, setAsOfDate] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setAsOfDate(new Date().toISOString().split('T')[0]);
  }, []);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const reportData = useMemo(() => {
    if (!members || !allSummaries || !asOfDate) return [];
    const cutOff = new Date(asOfDate).getTime();

    return members.map(m => {
      const ms = allSummaries.filter(s => s.memberId === m.id && new Date(s.summaryDate).getTime() <= cutOff);
      let c1=0,c2=0,c3=0,c5=0,c6=0,c8=0,c9=0;
      ms.forEach(s => {
        c1 += Number(s.employeeContribution)||0; 
        c2 += Number(s.loanWithdrawal)||0; 
        c3 += Number(s.loanRepayment)||0;
        c5 += Number(s.profitEmployee)||0; 
        c6 += Number(s.profitLoan)||0; 
        c8 += Number(s.pbsContribution)||0; 
        c9 += Number(s.profitPbs)||0;
      });
      const c4 = c2 - c3; 
      const c7 = c1 - c2 + c3 + c5 + c6; 
      const c10 = c8 + c9; 
      const c11 = c7 + c10;
      return { 
          id: m.memberIdNumber, name: m.name, 
          c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11 
      };
    })
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.id?.includes(search))
    .sort((a,b) => (a.id||"").localeCompare(b.id||""));
  }, [members, allSummaries, asOfDate, search]);

  const stats = useMemo(() => reportData.reduce((a,c) => ({ 
      c1:a.c1+c.c1, c2:a.c2+c.c2, c3:a.c3+c.c3, c4:a.c4+c.c4, c5:a.c5+c.c5, c6:a.c6+c.c6, c7:a.c7+c.c7, c8:a.c8+c.c8, c9:a.c9+c.c9, c10:a.c10+c.c10, c11:a.c11+c.c11 
  }), {c1:0,c2:0,c3:0,c4:0,c5:0,c6:0,c7:0,c8:0,c9:0,c10:0,c11:0}), [reportData]);

  if (isMembersLoading || isSummariesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-primary" /></div>;

  return (
    <div className="p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-[#000000]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-1.5 hover:bg-slate-100 rounded-full border border-black"><ArrowLeft className="size-5" /></Link>
          <h1 className="text-2xl font-black uppercase tracking-tight">Ledger Summary Matrix</h1>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2 border border-black rounded-xl">
          <div className="grid gap-1">
            <Label className="text-[9px] font-black uppercase ml-1">Statement Cut-off</Label>
            <Input type="date" value={asOfDate} max="9999-12-31" onChange={(e) => setAsOfDate(e.target.value)} className="h-8 w-32 border-black text-[10px] font-black" />
          </div>
          <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-[10px] px-8 uppercase tracking-widest"><Printer className="size-3.5 mr-2" /> Print</Button>
        </div>
      </div>

      <div className="bg-white rounded-none border border-black overflow-hidden print-container shadow-2xl">
        <div className="p-2 border-b border-black bg-slate-50 flex items-center justify-between no-print">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 opacity-40" />
            <Input className="pl-7 h-8 border-black font-black text-[10px] bg-white" placeholder="Search ID/Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Badge className="bg-black text-white font-black text-[9px] uppercase tracking-widest rounded-none">{reportData.length} Personnel</Badge>
        </div>
        
        <div className="overflow-x-auto">
          <Table className="w-full text-[8px] font-black table-fixed border-collapse text-[#000000]">
            <TableHeader className="bg-slate-100 border-b border-black uppercase text-[7px] leading-tight">
              <TableRow className="border-b border-black">
                <TableHead className="border-r border-black p-0.5 w-[40px] font-black text-black text-center h-8">ID No</TableHead>
                <TableHead className="border-r border-black p-0.5 text-left w-[110px] font-black text-black h-8">Personnel Name</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[60px] font-black text-black h-8">Emp(1)</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[60px] font-black text-black h-8">Draw(2)</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[60px] font-black text-black h-8">Repay(3)</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[70px] bg-slate-200 font-black text-black h-8">L.Bal(4)</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[60px] font-black text-black h-8">E.Profit(5)</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[60px] font-black text-black h-8">L.Int(6)</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[75px] bg-slate-300 font-black text-black h-8">Equity(7)</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[60px] font-black text-black h-8">PBS(8)</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[60px] font-black text-black h-8">P.Profit(9)</TableHead>
                <TableHead className="text-right border-r p-0.5 w-[75px] bg-slate-200 font-black text-black h-8">Office(10)</TableHead>
                <TableHead className="text-right p-0.5 w-[90px] bg-black text-white font-black h-8">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((r, i) => (
                <TableRow key={i} className="border-b border-black hover:bg-slate-50 h-8">
                  <TableCell className="p-0.5 border-r border-black font-mono text-center text-black">{r.id}</TableCell>
                  <TableCell className="p-0.5 border-r border-black truncate uppercase font-black text-black">{r.name}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.c1.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.c2.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.c3.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r bg-slate-50 font-bold text-black">{r.c4.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.c5.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.c6.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r bg-slate-100 font-bold text-black">{r.c7.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.c8.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r text-black">{r.c9.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 border-r bg-slate-50 font-bold text-black">{r.c10.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-0.5 bg-slate-200 font-black text-black">{r.c11.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {/* Institutional Summary Footer as part of tbody to ensure single end display */}
              <TableRow className="bg-black text-white font-black h-10 uppercase text-[7px]">
                <TableCell colSpan={2} className="text-right pr-2 font-black text-white">Aggregates:</TableCell>
                <TableCell className="text-right border-l border-white/10 text-white">{stats.c1.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-white/10 text-white">{stats.c2.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-white/10 text-white">{stats.c3.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-white/10 bg-white/10 text-white">{stats.c4.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-white/10 text-white">{stats.c5.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-white/10 text-white">{stats.c6.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-white/10 bg-white/20 text-white">{stats.c7.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-white/10 text-white">{stats.c8.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-white/10 text-white">{stats.c9.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-white/10 bg-white/10 text-white">{stats.c10.toLocaleString()}</TableCell>
                <TableCell className="text-right bg-white text-black font-black text-[9px]">৳ {stats.c11.toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest hidden print:flex">
          <span>PBS CPF Management Software</span>
          <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
        </div>
      </div>
    </div>
  );
}