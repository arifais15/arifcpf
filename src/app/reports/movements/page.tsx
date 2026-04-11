
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
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function FundMovementReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
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

      return { memberIdNumber: member.memberIdNumber, name: member.name, opEmp, addEmp, adjEmp, clEmp: opEmp+addEmp+adjEmp, opPbs, addPbs, adjPbs, clPbs: opPbs+addPbs+adjPbs, total: (opEmp+addEmp+adjEmp)+(opPbs+addPbs+adjPbs) };
    })
    .filter(row => row.name.toLowerCase().includes(search.toLowerCase()) || row.memberIdNumber?.includes(search))
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, dateRange, search]);

  const stats = useMemo(() => reportData.reduce((acc, c) => ({ op: acc.op+c.opEmp+c.opPbs, cl: acc.cl+c.total }), { op: 0, cl: 0 }), [reportData]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4"><div className="bg-primary/10 p-3 rounded-2xl"><Activity className="size-8 text-primary" /></div><div className="flex flex-col gap-1"><h1 className="text-3xl font-bold text-primary tracking-tight">Fund Movement Audit</h1><p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Analysis of institutional and personal fund evolution</p></div></div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border shadow-sm"><div className="grid gap-1"><Label className="text-[9px] uppercase font-bold text-slate-400">Range</Label><div className="flex items-center gap-2"><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-none font-bold" /><ArrowRightLeft className="size-3 text-slate-300" /><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-none font-bold" /></div></div></div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 no-print">
        <Card className="bg-slate-50"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-slate-500">Opening (All Fund)</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">৳ {stats.op.toLocaleString()}</div></CardContent></Card>
        <Card className="bg-slate-900 text-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-slate-400">Closing (Institutional)</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">৳ {stats.cl.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Member ID</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Emp Opening</TableHead><TableHead className="text-right">Emp Add</TableHead><TableHead className="text-right">Emp Adj</TableHead><TableHead className="text-right font-bold">Emp Closing</TableHead><TableHead className="text-right">PBS Opening</TableHead><TableHead className="text-right">PBS Add</TableHead><TableHead className="text-right">PBS Adj</TableHead><TableHead className="text-right font-bold">PBS Closing</TableHead><TableHead className="text-right font-black">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(isMembersLoading || isSummariesLoading) ? <TableRow><TableCell colSpan={11} className="text-center py-12"><Loader2 className="animate-spin size-6 mx-auto" /></TableCell></TableRow> : reportData.map((row, idx) => (
              <TableRow key={idx} className="text-[11px]">
                <td className="font-mono font-bold p-4">{row.memberIdNumber}</td><td className="p-4 truncate">{row.name}</td>
                <td className="text-right p-4 text-slate-400">{row.opEmp.toLocaleString()}</td><td className="text-right p-4">{row.addEmp.toLocaleString()}</td><td className="text-right p-4 text-orange-600">{row.adjEmp.toLocaleString()}</td><td className="text-right p-4 font-bold">৳ {row.clEmp.toLocaleString()}</td>
                <td className="text-right p-4 text-slate-400">{row.opPbs.toLocaleString()}</td><td className="text-right p-4">{row.addPbs.toLocaleString()}</td><td className="text-right p-4 text-emerald-600">{row.adjPbs.toLocaleString()}</td><td className="text-right p-4 font-bold">৳ {row.clPbs.toLocaleString()}</td>
                <td className="text-right p-4 font-black text-primary">৳ {row.total.toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
