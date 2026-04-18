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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
        const v = { 
          c1: Number(x.employeeContribution)||0, 
          c2: Number(x.loanWithdrawal)||0, 
          c3: Number(x.loanRepayment)||0, 
          c5: Number(x.profitEmployee)||0, 
          c6: Number(x.profitLoan)||0, 
          c8: Number(x.pbsContribution)||0, 
          c9: Number(x.profitPbs)||0 
        };

        if (d < s) { 
          opE += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6); 
          opP += (v.c8 + v.c9); 
        } else if (d <= e) { 
          addE += v.c1; 
          adjE += (v.c5 + v.c6 + (v.c3 - v.c2)); 
          addP += v.c8; 
          adjP += v.c9; 
        }
      });

      const clE = opE + addE + adjE; 
      const clP = opP + addP + adjP;

      return { 
        id: m.memberIdNumber, 
        name: m.name, 
        opE, addE, adjE, clE, 
        opP, addP, adjP, clP, 
        total: clE + clP 
      };
    })
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.id?.includes(search))
    .sort((a,b) => (a.id||"").localeCompare(b.id||""));
  }, [members, allSummaries, dateRange, search]);

  const stats = useMemo(() => reportData.reduce((a,c) => ({ 
    opE: a.opE + c.opE, 
    addE: a.addE + c.addE,
    adjE: a.adjE + c.adjE,
    clE: a.clE + c.clE, 
    opP: a.opP + c.opP, 
    addP: a.addP + c.addP,
    adjP: a.adjP + c.adjP,
    clP: a.clP + c.clP, 
    total: a.total + c.total 
  }), {opE:0, addE:0, adjE:0, clE:0, opP:0, addP:0, adjP:0, clP:0, total:0}), [reportData]);

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    const exportRows = reportData.map(r => ({
      "ID No": r.id,
      "Name": r.name,
      "Emp-Opening": r.opE,
      "Emp-Addition": r.addE,
      "Emp-Adjustment": r.adjE,
      "Emp-Closing": r.clE,
      "PBS-Opening": r.opP,
      "PBS-Addition": r.addP,
      "PBS-Adjustment": r.adjP,
      "PBS-Closing": r.clP,
      "Total Portfolio Fund": r.total
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
          <Link href="/investments" className="p-1.5 hover:bg-slate-100 rounded-full border-2 border-black"><ArrowLeft className="size-5 text-black" /></Link>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black uppercase tracking-tight">Fund Movement Audit</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Opening, Addition, Adjustment & Closing Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-2 border-2 border-black rounded-xl shadow-xl">
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase ml-1">Period Start</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start:e.target.value})} className="h-8 w-32 border-black border-2 text-[10px] font-black bg-white" /></div>
          <ArrowRightLeft className="size-3 text-black opacity-30" />
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase ml-1">Period End</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end:e.target.value})} className="h-8 w-32 border-black border-2 text-[10px] font-black bg-white" /></div>
          <Button variant="outline" onClick={exportToExcel} className="h-9 border-black border-2 font-black text-[10px] px-6 uppercase tracking-widest bg-white hover:bg-slate-50"><FileSpreadsheet className="size-3.5 mr-2" /> Export</Button>
          <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-[10px] px-8 uppercase tracking-widest shadow-lg"><Printer className="size-3.5 mr-2" /> Print Audit</Button>
        </div>
      </div>

      <div className="bg-white rounded-none border-2 border-black overflow-hidden print-container shadow-2xl">
        <div className="p-3 border-b-2 border-black bg-slate-100 flex items-center justify-between no-print">
          <div className="relative flex-1 max-w-xs"><Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-black opacity-40" /><Input className="pl-8 h-8 border-black border-2 font-black text-[10px] bg-white text-black" placeholder="Filter ID or Name..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Badge className="bg-black text-white font-black text-[9px] uppercase tracking-widest rounded-none px-4 py-1.5 shadow-sm">{reportData.length} Personnel Registry</Badge>
        </div>
        
        <div className="overflow-x-auto">
          <Table className="w-full text-[8px] font-black table-fixed border-collapse text-[#000000]">
            <TableHeader className="bg-slate-100 border-b-2 border-black uppercase text-[7px] leading-tight">
              <TableRow className="bg-slate-200 border-b-2 border-black">
                <TableHead colSpan={2} className="border-r-2 border-black bg-slate-300"></TableHead>
                <TableHead colSpan={4} className="text-center border-r-2 border-black bg-blue-50/50 font-black text-black">Employee Fund Movements</TableHead>
                <TableHead colSpan={4} className="text-center border-r-2 border-black bg-emerald-50/50 font-black text-black">PBS Fund Movements</TableHead>
                <TableHead className="bg-slate-900"></TableHead>
              </TableRow>
              <TableRow className="border-b border-black">
                <TableHead className="border-r border-black p-1 w-[45px] font-black text-black text-center h-10">ID No</TableHead>
                <TableHead className="border-r-2 border-black p-1 text-left w-[120px] font-black text-black h-10">Personnel Name</TableHead>
                
                {/* Employee Headers */}
                <TableHead className="text-right border-r p-1 w-[65px] bg-slate-50 font-black text-black">Opening</TableHead>
                <TableHead className="text-right border-r p-1 w-[65px] font-black text-black">Addition</TableHead>
                <TableHead className="text-right border-r p-1 w-[65px] font-black text-black">Adjustment</TableHead>
                <TableHead className="text-right border-r-2 p-1 w-[75px] bg-slate-200 font-black text-black">Closing</TableHead>
                
                {/* PBS Headers */}
                <TableHead className="text-right border-r p-1 w-[65px] bg-slate-50 font-black text-black">Opening</TableHead>
                <TableHead className="text-right border-r p-1 w-[65px] font-black text-black">Addition</TableHead>
                <TableHead className="text-right border-r p-1 w-[65px] font-black text-black">Adjustment</TableHead>
                <TableHead className="text-right border-r-2 p-1 w-[75px] bg-slate-200 font-black text-black">Closing</TableHead>
                
                <TableHead className="text-right p-1 w-[100px] bg-black text-white font-black h-10 uppercase tracking-widest">Total Fund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {reportData.map((r, i) => (
                <TableRow key={i} className="border-b border-black hover:bg-slate-50 h-10 transition-colors">
                  <TableCell className="p-1 border-r border-black font-mono text-center text-black font-bold">{r.id}</TableCell>
                  <TableCell className="p-1 border-r-2 border-black truncate uppercase font-black text-black text-[9px]">{r.name}</TableCell>
                  
                  {/* Employee Values */}
                  <TableCell className="text-right p-1 border-r bg-slate-50 text-black">{r.opE.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.addE.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.adjE.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r-2 bg-slate-100 font-bold text-black">{r.clE.toLocaleString()}</TableCell>
                  
                  {/* PBS Values */}
                  <TableCell className="text-right p-1 border-r bg-slate-50 text-black">{r.opP.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.addP.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.adjP.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r-2 bg-slate-100 font-bold text-black">{r.clP.toLocaleString()}</TableCell>
                  
                  <TableCell className="text-right p-1 bg-slate-200 font-black text-black text-[10px] underline decoration-black underline-offset-4">৳ {r.total.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-900 text-white font-black h-14 border-t-4 border-black">
              <TableRow className="h-14 hover:bg-slate-900">
                <TableCell colSpan={2} className="text-right pr-6 uppercase font-black text-white text-[10px] tracking-widest border-r-2 border-white/10">Institutional Aggregate Totals:</TableCell>
                
                {/* Employee Stats */}
                <TableCell className="text-right border-r border-white/10 bg-white/5 font-black text-white">{stats.opE.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 font-black text-white">{stats.addE.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 font-black text-white">{stats.adjE.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10 bg-white/20 font-black text-white text-[10px]">{stats.clE.toLocaleString()}</TableCell>
                
                {/* PBS Stats */}
                <TableCell className="text-right border-r border-white/10 bg-white/5 font-black text-white">{stats.opP.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 font-black text-white">{stats.addP.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 font-black text-white">{stats.adjP.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10 bg-white/20 font-black text-white text-[10px]">{stats.clP.toLocaleString()}</TableCell>
                
                <TableCell className="text-right bg-white text-black text-xl font-black pr-2 underline decoration-double">৳ {stats.total.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.4em] mt-4">Fund Movement Analysis Matrix</h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <span className="bg-black text-white px-4 py-1 rounded">Audit Basis: {dateRange.start} to {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        {/* Custom Print table uses full portrait/landscape space */}
        <table className="w-full text-[7.5px] border-collapse border-2 border-black font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-black uppercase text-[7px]">
              <th rowSpan={2} className="border border-black p-1 w-[40px]">ID No</th>
              <th rowSpan={2} className="border border-black p-1 text-left w-[120px]">Member Name</th>
              <th colSpan={4} className="border border-black p-1 text-center bg-slate-50">Employee Fund Movements</th>
              <th colSpan={4} className="border border-black p-1 text-center bg-slate-50">PBS Fund Movements</th>
              <th rowSpan={2} className="border border-black p-1 text-right bg-slate-100 w-[80px]">Total Fund</th>
            </tr>
            <tr className="bg-slate-50 border-b border-black text-[6px]">
              <th className="border border-black p-1">Opening</th>
              <th className="border border-black p-1">Addition</th>
              <th className="border border-black p-1">Adjustment</th>
              <th className="border border-black p-1">Closing</th>
              <th className="border border-black p-1">Opening</th>
              <th className="border border-black p-1">Addition</th>
              <th className="border border-black p-1">Adjustment</th>
              <th className="border border-black p-1">Closing</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((r, i) => (
              <tr key={i} className="border-b border-black">
                <td className="border border-black p-1 text-center font-mono">{r.id}</td>
                <td className="border border-black p-1 truncate uppercase">{r.name}</td>
                <td className="border border-black p-1 text-right">{r.opE.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.addE.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.adjE.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-50 font-bold">{r.clE.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.opP.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.addP.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.adjP.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-50 font-bold">{r.clP.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black">৳ {r.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black h-12 border-t-2 border-black uppercase text-[8px]">
              <td colSpan={2} className="border border-black p-1 text-right pr-4">Matrix Totals:</td>
              <td className="border border-black p-1 text-right">{stats.opE.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.addE.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.adjE.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.clE.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.opP.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.addP.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.adjP.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{stats.clP.toLocaleString()}</td>
              <td className="border border-black p-1 text-right underline decoration-double">৳ {stats.total.toLocaleString()}</td>
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
