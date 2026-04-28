"use client"

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Search, ArrowRightLeft, ArrowLeft, FileSpreadsheet, TrendingUp, ShieldCheck } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

export default function InterestMovementReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [search, setSearch] = useState("");

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = (generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2").toUpperCase();

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
      let opE=0, opP=0, addE=0, addP=0;

      ms.forEach(x => {
        const d = new Date(x.summaryDate).getTime();
        const v = { 
          c5: Number(x.profitEmployee)||0, 
          c9: Number(x.profitPbs)||0 
        };

        if (d < s) { 
          opE += v.c5; 
          opP += v.c9; 
        } else if (d <= e) { 
          addE += v.c5; 
          addP += v.c9; 
        }
      });

      const clE = opE + addE; 
      const clP = opP + addP;

      return { 
        id: m.memberIdNumber, 
        name: m.name, 
        designation: m.designation,
        opE, addE, clE, 
        opP, addP, clP, 
        totalOpening: opE + opP,
        totalPeriod: addE + addP,
        totalClosing: clE + clP 
      };
    })
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.id?.includes(search))
    .sort((a,b) => (a.id||"").localeCompare(b.id||""));
  }, [members, allSummaries, dateRange, search]);

  const stats = useMemo(() => reportData.reduce((a,c) => ({ 
    opE: a.opE + c.opE, 
    addE: a.addE + c.addE,
    clE: a.clE + c.clE, 
    opP: a.opP + c.opP, 
    addP: a.addP + c.addP,
    clP: a.clP + c.clP, 
    total: a.total + c.totalClosing 
  }), {opE:0, addE:0, clE:0, opP:0, addP:0, clP:0, total:0}), [reportData]);

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    const exportRows = reportData.map(r => ({
      "ID No": r.id,
      "Name": r.name,
      "Op. Profit (Emp)": r.opE,
      "Period Profit (Emp)": r.addE,
      "Cl. Profit (Emp)": r.clE,
      "Op. Profit (PBS)": r.opP,
      "Period Profit (PBS)": r.addP,
      "Cl. Profit (PBS)": r.clP,
      "Total Interest Balance": r.totalClosing
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Interest Movements");
    XLSX.writeFile(wb, `Interest_Movements_${dateRange.start}.xlsx`);
    toast({ title: "Exported", description: "Interest movement audit saved to Excel." });
  };

  if (isMembersLoading || isSummariesLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-[#000000]">
      {/* PROFESSIONAL PRINT CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          .no-print { display: none !important; }
          
          /* Purge scrollbars and force visibility */
          html, body, main, [data-sidebar="inset"] { 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }

          .print-container {
            display: block !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }

          table { 
            width: 100% !important; 
            table-layout: fixed !important; 
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          tr { break-inside: avoid !important; }
          th, td { border: 0.5pt solid black !important; padding: 2px 4px !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-1.5 hover:bg-slate-100 rounded-full border-2 border-black transition-colors"><ArrowLeft className="size-5 text-black" /></Link>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black uppercase tracking-tight">Interest Movement Audit</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cumulative Profit Trajectory Matrix</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-2 border-2 border-black rounded-xl shadow-xl">
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase ml-1">Period From</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start:e.target.value})} className="h-8 w-32 border-black border-2 text-[10px] font-black bg-white" /></div>
          <ArrowRightLeft className="size-3 text-black opacity-30" />
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase ml-1">Period To</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end:e.target.value})} className="h-8 w-32 border-black border-2 text-[10px] font-black bg-white" /></div>
          <Button variant="outline" onClick={exportToExcel} className="h-9 border-black border-2 font-black text-[10px] px-6 uppercase tracking-widest bg-white hover:bg-slate-50 shadow-md"><FileSpreadsheet className="size-3.5 mr-2" /> Export</Button>
          <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-[10px] px-8 uppercase shadow-lg"><Printer className="size-3.5 mr-2" /> Print Audit</Button>
        </div>
      </div>

      <div className="bg-white rounded-none border-2 border-black overflow-hidden print-container shadow-2xl">
        {/* INSTITUTIONAL PRINT HEADER */}
        <div className="hidden print:block text-center mb-8 text-black">
          <h1 className="text-2xl font-black uppercase tracking-tight">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-[0.3em] mt-1">Employees' Contributory Provident Fund</p>
          <div className="mt-6 flex justify-center">
            <div className="border-4 border-black px-12 py-2">
              <h2 className="text-xl font-black uppercase tracking-[0.4em]">Interest Movement Analysis Matrix</h2>
            </div>
          </div>
          <div className="flex justify-between items-end mt-8 border-b-2 border-black pb-2 text-[10px] font-black uppercase tracking-widest">
            <span>Period: {dateRange.start ? format(parseISO(dateRange.start), 'dd-MMM-yy') : '...'} to {dateRange.end ? format(parseISO(dateRange.end), 'dd-MMM-yy') : '...'}</span>
            <span>Print Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <div className="p-3 border-b-2 border-black bg-slate-100 flex items-center justify-between no-print">
          <div className="relative flex-1 max-w-xs"><Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-black opacity-40" /><Input className="pl-8 h-8 border-black border-2 font-black text-[10px] bg-white text-black" placeholder="Filter ID or Name..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Badge className="bg-black text-white font-black text-[9px] uppercase tracking-widest rounded-none px-4 py-1.5 shadow-sm">Interest Data Audit</Badge>
        </div>
        
        <div className="overflow-x-auto">
          <Table className="w-full text-[8px] font-black table-fixed border-collapse text-[#000000]">
            <TableHeader className="bg-slate-100 border-b-2 border-black uppercase text-[7px] leading-tight">
              <TableRow className="bg-slate-200 border-b-2 border-black">
                <TableHead colSpan={2} className="border-r-2 border-black h-10"></TableHead>
                <TableHead colSpan={3} className="text-center border-r-2 border-black bg-blue-50/50 font-black text-black h-10">Profit on Member Contrib (Col 5)</TableHead>
                <TableHead colSpan={3} className="text-center border-r-2 border-black bg-emerald-50/50 font-black text-black h-10">Profit on Office Contrib (Col 9)</TableHead>
                <TableHead className="bg-slate-900 h-10"></TableHead>
              </TableRow>
              <TableRow className="border-b border-black">
                <TableHead className="border-r border-black p-1 w-[45px] font-black text-black text-center h-10">ID No</TableHead>
                <TableHead className="border-r-2 border-black p-1 text-left w-[120px] font-black text-black h-10">Personnel Name</TableHead>
                
                {/* Employee Profit Headers */}
                <TableHead className="text-right border-r p-1 w-[65px] bg-slate-50 font-black text-black">Opening</TableHead>
                <TableHead className="text-right border-r p-1 w-[65px] font-black text-black">Addition</TableHead>
                <TableHead className="text-right border-r-2 p-1 w-[75px] bg-slate-200 font-black text-black">Closing</TableHead>
                
                {/* PBS Profit Headers */}
                <TableHead className="text-right border-r p-1 w-[65px] bg-slate-50 font-black text-black">Opening</TableHead>
                <TableHead className="text-right border-r p-1 w-[65px] font-black text-black">Addition</TableHead>
                <TableHead className="text-right border-r-2 p-1 w-[75px] bg-slate-200 font-black text-black">Closing</TableHead>
                
                <TableHead className="text-right p-1 w-[100px] bg-black text-white font-black h-10 uppercase tracking-widest">Total Interest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {reportData.map((r, i) => (
                <TableRow key={i} className="border-b border-black hover:bg-slate-50 h-10 transition-colors bg-transparent">
                  <TableCell className="p-1 border-r border-black font-mono text-center text-black font-bold">{r.id}</TableCell>
                  <TableCell className="p-1 border-r-2 border-black truncate uppercase font-black text-black text-[9px]">{r.name}</TableCell>
                  
                  {/* Employee Values */}
                  <TableCell className="text-right p-1 border-r bg-slate-50 text-black">{r.opE.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.addE.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r-2 bg-slate-100 font-bold text-black">{r.clE.toLocaleString()}</TableCell>
                  
                  {/* PBS Values */}
                  <TableCell className="text-right p-1 border-r bg-slate-50 text-black">{r.opP.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.addP.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r-2 bg-slate-100 font-bold text-black">{r.clP.toLocaleString()}</TableCell>
                  
                  <TableCell className="text-right p-1 bg-slate-200 font-black text-black text-[10px] underline decoration-black underline-offset-4">৳ {r.totalClosing.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-900 text-white font-black h-14 border-t-4 border-black no-print">
              <TableRow className="h-14 hover:bg-slate-900">
                <TableCell colSpan={2} className="text-right pr-6 uppercase font-black text-white text-[10px] tracking-widest border-r-2 border-white/10">Consolidated Interest Totals:</TableCell>
                
                {/* Employee Stats */}
                <TableCell className="text-right border-r border-white/10 bg-white/5 font-black text-white">{stats.opE.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 font-black text-white">{stats.addE.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10 bg-white/20 font-black text-white text-[10px]">{stats.clE.toLocaleString()}</TableCell>
                
                {/* PBS Stats */}
                <TableCell className="text-right border-r border-white/10 bg-white/5 font-black text-white">{stats.opP.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 font-black text-white">{stats.addP.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10 bg-white/20 font-black text-white text-[10px]">{stats.clP.toLocaleString()}</TableCell>
                
                <TableCell className="text-right bg-white text-black text-xl font-black pr-2 underline decoration-double">৳ {stats.total.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
            {/* PRINT SPECIFIC FOOTER TOTALS */}
            <TableFooter className="hidden print:table-footer-group bg-slate-100 text-black font-black border-t-4 border-black">
              <TableRow className="h-12 font-black text-black">
                <TableCell colSpan={2} className="text-right pr-4 uppercase font-black text-[10px] border-r-2 border-black">Consolidated Totals:</TableCell>
                <TableCell className="text-right border-r border-black">{stats.opE.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-black">{stats.addE.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-black bg-slate-200">{stats.clE.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-black">{stats.opP.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-black">{stats.addP.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-black bg-slate-200">{stats.clP.toLocaleString()}</TableCell>
                <TableCell className="text-right font-black text-lg underline decoration-double decoration-black/30 bg-white">৳ {stats.total.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* PRINT FOOTER SIGN-OFF */}
        <div className="hidden print:block mt-24">
          <div className="grid grid-cols-3 gap-16 text-[12px] font-black text-center uppercase tracking-widest text-black">
            <div className="border-t-2 border-black pt-4">Prepared by</div>
            <div className="border-t-2 border-black pt-4">Checked by</div>
            <div className="border-t-2 border-black pt-4">Approved by Trustee</div>
          </div>
          <div className="mt-12 pt-4 border-t border-black/10 flex justify-between items-center text-[8px] font-black uppercase text-slate-400">
            <span>CPF Management Matrix v1.2</span>
            <span>Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
