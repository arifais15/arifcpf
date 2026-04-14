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

  if (isMembersLoading || isSummariesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/investments" className="p-2 border-2 border-black rounded-full hover:bg-slate-100 transition-colors"><ArrowLeft className="size-6" /></Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Fund Movement Audit</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Analysis of Institutional and Personal Fund Evolution</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border-2 border-black shadow-xl">
          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black">Date Start</Label>
              <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-black border-2 font-black" />
            </div>
            <ArrowRightLeft className="size-3 mt-3" />
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black">Date End</Label>
              <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-black border-2 font-black" />
            </div>
          </div>
          <div className="h-8 w-px bg-black hidden sm:block" />
          <Button onClick={() => window.print()} className="gap-2 h-9 font-black uppercase text-[10px] bg-black text-white px-6 shadow-lg">
            <Printer className="size-4" /> Print Movement
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 no-print">
        <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest">Aggregate Opening Balance</CardTitle></CardHeader><CardContent><div className="text-3xl font-black tabular-nums">৳ {stats.op.toLocaleString()}</div></CardContent></Card>
        <Card className="bg-black text-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest">Aggregate Closing Balance</CardTitle></CardHeader><CardContent><div className="text-3xl font-black tabular-nums">৳ {stats.cl.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print">
        <div className="p-4 border-b-4 border-black bg-slate-100 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black" />
            <Input className="pl-9 h-10 border-2 border-black font-black" placeholder="Search ID/Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Badge className="bg-black text-white font-black px-4 py-1.5 uppercase tracking-widest">{reportData.length} Personnel Registered</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1800px] border-collapse text-black font-black">
            <TableHeader className="bg-slate-50 border-b-4 border-black">
              <TableRow>
                <TableHead className="font-black text-black uppercase text-[10px] sticky left-0 bg-slate-50 z-20 w-[100px] border-r-2 border-black">Member ID</TableHead>
                <TableHead className="font-black text-black uppercase text-[10px] sticky left-[100px] bg-slate-50 z-20 w-[200px] border-r-2 border-black">Name</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest bg-slate-100">Emp Opening</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest">Emp Add</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest">Emp Adj</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest bg-slate-200">Emp Closing</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest bg-slate-100">PBS Opening</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest">PBS Add</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest">PBS Adj</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest bg-slate-200">PBS Closing</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest bg-black text-white">TOTAL FUND</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {reportData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-slate-100 border-b border-black text-[11px]">
                  <td className="font-mono font-black p-3 sticky left-0 bg-white border-r-2 border-black z-10">{row.memberIdNumber}</td>
                  <td className="p-3 font-black sticky left-[100px] bg-white border-r-2 border-black z-10 truncate uppercase">{row.name}</td>
                  <td className="text-right p-3 bg-slate-50">{row.opEmp.toLocaleString()}</td>
                  <td className="text-right p-3">{row.addEmp.toLocaleString()}</td>
                  <td className="text-right p-3">{row.adjEmp.toLocaleString()}</td>
                  <td className="text-right p-3 bg-slate-100 font-black">{row.clEmp.toLocaleString()}</td>
                  <td className="text-right p-3 bg-slate-50">{row.opPbs.toLocaleString()}</td>
                  <td className="text-right p-3">{row.addPbs.toLocaleString()}</td>
                  <td className="text-right p-3">{row.adjPbs.toLocaleString()}</td>
                  <td className="text-right p-3 bg-slate-100 font-black">{row.clPbs.toLocaleString()}</td>
                  <td className="text-right p-3 bg-slate-200 font-black text-xs underline decoration-black"> {row.total.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="hidden print:block print-container text-black font-black">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.4em] mt-4">Fund Movement Audit Summary Statement</h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <span className="bg-black text-white px-4 py-1">Period Basis: {dateRange.start} to {dateRange.end}</span>
            <span>Audit Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <table className="w-full text-[8px] border-collapse border-2 border-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-black">
              <th className="border border-black p-1 uppercase">ID No</th>
              <th className="border border-black p-1 text-left uppercase">Name & Designation</th>
              <th className="border border-black p-1 text-right uppercase">Op. Emp</th>
              <th className="border border-black p-1 text-right uppercase">Add. Emp</th>
              <th className="border border-black p-1 text-right uppercase">Cl. Emp</th>
              <th className="border border-black p-1 text-right uppercase">Op. PBS</th>
              <th className="border border-black p-1 text-right uppercase">Add. PBS</th>
              <th className="border border-black p-1 text-right uppercase">Cl. PBS</th>
              <th className="border border-black p-1 text-right uppercase bg-slate-100">TOTAL FUND</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, i) => (
              <tr key={i} className="border-b border-black">
                <td className="border border-black p-1 text-center font-mono">{row.memberIdNumber}</td>
                <td className="border border-black p-1 uppercase"><b>{row.name}</b><br/>{row.designation}</td>
                <td className="border border-black p-1 text-right">{row.opEmp.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.addEmp.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black">{row.clEmp.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.opPbs.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.addPbs.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black">{row.clPbs.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black bg-slate-50">{row.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black h-12 border-t-2 border-black">
              <td colSpan={2} className="border border-black p-2 text-right uppercase tracking-widest">Consolidated Movements:</td>
              <td className="border border-black p-2 text-right">{reportData.reduce((s, r) => s + r.opEmp, 0).toLocaleString()}</td>
              <td colSpan={2} className="border border-black p-2 text-right">{reportData.reduce((s, r) => s + r.clEmp, 0).toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{reportData.reduce((s, r) => s + r.opPbs, 0).toLocaleString()}</td>
              <td colSpan={2} className="border border-black p-2 text-right">{reportData.reduce((s, r) => s + r.clPbs, 0).toLocaleString()}</td>
              <td className="border border-black p-2 text-right text-base underline decoration-double">৳ {stats.cl.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center uppercase tracking-widest">
          <div className="border-t-2 border-black pt-4">Prepared by</div>
          <div className="border-t-2 border-black pt-4">Checked by</div>
          <div className="border-t-2 border-black pt-4">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
