"use client"

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Search, ArrowRightLeft, ArrowLeft, FileSpreadsheet } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import * as XLSX from "xlsx";

export default function FundMovementReportPage() {
  const firestore = useFirestore();
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [search, setSearch] = useState("");

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

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

    return members.map(m => {
      const ms = allSummaries.filter(s => s.memberId === m.id);
      let opE = 0, opP = 0, addE = 0, adjE = 0, addP = 0, adjP = 0;
      ms.forEach(s => {
        const d = new Date(s.summaryDate).getTime();
        const v = { c1: Number(s.employeeContribution)||0, c2: Number(s.loanWithdrawal)||0, c3: Number(s.loanRepayment)||0, c5: Number(s.profitEmployee)||0, c6: Number(s.profitLoan)||0, c8: Number(s.pbsContribution)||0, c9: Number(s.profitPbs)||0 };
        if (d < start) { opE += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6); opP += (v.c8 + v.c9); }
        else if (d <= end) { addE += v.c1; adjE += (v.c5 + v.c6 + (v.c3 - v.c2)); addP += v.c8; adjP += v.c9; }
      });
      const clE = opE + addE + adjE; const clP = opP + addP + adjP;
      return { id: m.memberIdNumber, name: m.name, opE, addE, adjE, clE, opP, addP, adjP, clP, total: clE + clP };
    })
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.id?.includes(search))
    .sort((a,b) => (a.id||"").localeCompare(b.id||""));
  }, [members, allSummaries, dateRange, search]);

  const stats = useMemo(() => reportData.reduce((a,c) => ({ opE:a.opE+c.opE, clE:a.clE+c.clE, opP:a.opP+c.opP, clP:a.clP+c.clP, total:a.total+c.total }), {opE:0,clE:0,opP:0,clP:0,total:0}), [reportData]);

  if (isMembersLoading || isSummariesLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-12" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-[#000000]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-1.5 hover:bg-slate-100 rounded-full border-2 border-black"><ArrowLeft className="size-5" /></Link>
          <h1 className="text-2xl font-black uppercase tracking-tight">Fund Movement Audit</h1>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 border-2 border-black rounded-xl shadow-lg">
          <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 w-32 border-black font-black text-[10px]" />
          <ArrowRightLeft className="size-3" />
          <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 w-32 border-black font-black text-[10px]" />
          <Button onClick={() => window.print()} className="h-8 bg-black text-white font-black text-[10px] px-6">Print Matrix</Button>
        </div>
      </div>

      <div className="bg-white rounded-none border-2 border-black overflow-hidden print-container">
        <div className="p-2 border-b-2 border-black bg-slate-50 flex items-center justify-between no-print">
          <Input className="max-w-xs h-8 border-black font-black text-[10px]" placeholder="Search ID/Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Badge className="bg-black text-white font-black text-[9px]">{reportData.length} Personnel</Badge>
        </div>
        <Table className="w-full text-[8px] font-black table-fixed border-collapse">
          <TableHeader className="bg-slate-100 border-b-2 border-black uppercase text-[7px]">
            <tr>
              <th className="border-r border-black p-0.5 w-[40px]">ID</th>
              <th className="border-r border-black p-0.5 text-left w-[110px]">Name</th>
              <th className="text-right border-r p-0.5 w-[65px]">E-Open</th>
              <th className="text-right border-r p-0.5 w-[65px]">E-Add</th>
              <th className="text-right border-r p-0.5 w-[65px]">E-Adj</th>
              <th className="text-right border-r-2 p-0.5 w-[70px] bg-slate-50">E-Close</th>
              <th className="text-right border-r p-0.5 w-[65px]">P-Open</th>
              <th className="text-right border-r p-0.5 w-[65px]">P-Add</th>
              <th className="text-right border-r p-0.5 w-[65px]">P-Adj</th>
              <th className="text-right border-r-2 p-0.5 w-[70px] bg-slate-50">P-Close</th>
              <th className="text-right p-0.5 w-[90px] bg-black text-white">Total</th>
            </tr>
          </TableHeader>
          <TableBody className="tabular-nums">
            {reportData.map((r, i) => (
              <tr key={i} className="border-b border-black hover:bg-slate-50 h-8">
                <td className="p-0.5 border-r border-black font-mono text-center">{r.id}</td>
                <td className="p-0.5 border-r border-black truncate uppercase">{r.name}</td>
                <td className="text-right p-0.5 border-r">{r.opE.toLocaleString()}</td>
                <td className="text-right p-0.5 border-r">{r.addE.toLocaleString()}</td>
                <td className="text-right p-0.5 border-r">{r.adjE.toLocaleString()}</td>
                <td className="text-right p-0.5 border-r-2 bg-slate-50">{r.clE.toLocaleString()}</td>
                <td className="text-right p-0.5 border-r">{r.opP.toLocaleString()}</td>
                <td className="text-right p-0.5 border-r">{r.addP.toLocaleString()}</td>
                <td className="text-right p-0.5 border-r">{r.adjP.toLocaleString()}</td>
                <td className="text-right p-0.5 border-r-2 bg-slate-50">{r.clP.toLocaleString()}</td>
                <td className="text-right p-0.5 bg-slate-100 font-bold"> {r.total.toLocaleString()}</td>
              </tr>
            ))}
          </TableBody>
          <TableFooter className="bg-black text-white text-[7px] font-black h-10">
            <tr>
              <td colSpan={2} className="text-right pr-2 uppercase">Aggregates:</td>
              <td className="text-right">{stats.opE.toLocaleString()}</td>
              <td colSpan={2}></td>
              <td className="text-right bg-white/10">{stats.clE.toLocaleString()}</td>
              <td className="text-right">{stats.opP.toLocaleString()}</td>
              <td colSpan={2}></td>
              <td className="text-right bg-white/10">{stats.clP.toLocaleString()}</td>
              <td className="text-right bg-white text-black text-[9px]">৳ {stats.total.toLocaleString()}</td>
            </tr>
          </TableFooter>
        </Table>
        <div className="mt-8 pt-2 border-t border-black flex justify-between items-center text-[7px] font-black uppercase tracking-widest p-4">
          <span>{pbsName} • Fund Movement Audit Summary</span>
          <span className="italic">Report Date: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
