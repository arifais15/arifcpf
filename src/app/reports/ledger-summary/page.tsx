
"use client"

import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Search, ArrowLeft, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

export default function LedgerSummaryReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = (generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2").toUpperCase();

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
      return { id: m.memberIdNumber, name: m.name, designation: m.designation, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11 };
    })
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.id?.includes(search))
    .sort((a,b) => (a.id||"").localeCompare(b.id||""));
  }, [members, allSummaries, asOfDate, search]);

  const stats = useMemo(() => reportData.reduce((a,c) => ({ 
      c1:a.c1+c.c1, c2:a.c2+c.c2, c3:a.c3+c.c3, c4:a.c4+c.c4, c5:a.c5+c.c5, c6:a.c6+c.c6, c7:a.c7+c.c7, c8:a.c8+c.c8, c9:a.c9+c.c9, c10:a.c10+c.c10, c11:a.c11+c.c11 
  }), {c1:0,c2:0,c3:0,c4:0,c5:0,c6:0,c7:0,c8:0,c9:0,c10:0,c11:0}), [reportData]);

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    const exportRows = reportData.map(r => ({
      "ID No": r.id,
      "Name": r.name,
      "Emp Cont (1)": r.c1,
      "Loan Draw (2)": r.c2,
      "Loan Repay (3)": r.c3,
      "Loan Bal (4)": r.c4,
      "Profit Emp (5)": r.c5,
      "Profit Loan (6)": r.c6,
      "Net Emp Fund (7)": r.c7,
      "PBS Cont (8)": r.c8,
      "Profit PBS (9)": r.c9,
      "Net Office Fund (10)": r.c10,
      "Total Fund (11)": r.c11
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger Summary");
    XLSX.writeFile(wb, `Ledger_Summary_${asOfDate}.xlsx`);
    toast({ title: "Exported", description: "Ledger summary matrix saved to Excel." });
  };

  if (isMembersLoading || isSummariesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-[#000000]">
      {/* PROFESSIONAL PRINT CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          .no-print { display: none !important; }
          
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
          <Link href="/reports" className="p-1.5 hover:bg-slate-100 rounded-full border-2 border-black transition-colors"><ArrowLeft className="size-5" /></Link>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black uppercase tracking-tight">Ledger Summary Matrix</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cumulative Status Analysis for All Personnel</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2 border-2 border-black rounded-xl shadow-xl">
          <div className="grid gap-1">
            <Label className="text-[9px] font-black uppercase ml-1">Statement Cut-off</Label>
            <Input type="date" value={asOfDate} max="9999-12-31" onChange={(e) => setAsOfDate(e.target.value)} className="h-8 w-36 border-black border-2 text-[10px] font-black bg-white" />
          </div>
          <Button variant="outline" onClick={exportToExcel} className="h-9 border-black border-2 font-black text-[10px] px-6 uppercase tracking-widest bg-white hover:bg-slate-50 shadow-md"><FileSpreadsheet className="size-3.5 mr-2" /> Export</Button>
          <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-[10px] px-8 uppercase tracking-widest shadow-lg"><Printer className="size-3.5 mr-2" /> Print Audit</Button>
        </div>
      </div>

      <div className="bg-white rounded-none border-2 border-black overflow-hidden print-container shadow-2xl">
        {/* INSTITUTIONAL PRINT HEADER */}
        <div className="hidden print:block text-center mb-8 text-black">
          <h1 className="text-2xl font-black uppercase tracking-tight">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-[0.3em] mt-1">Employees' Contributory Provident Fund</p>
          <div className="mt-6 flex justify-center">
            <div className="border-4 border-black px-12 py-2">
              <h2 className="text-xl font-black uppercase tracking-[0.4em]">Ledger Summary Matrix</h2>
            </div>
          </div>
          <div className="flex justify-between items-end mt-8 border-b-2 border-black pb-2 text-[10px] font-black uppercase tracking-widest">
            <span>Statement Cut-off: {asOfDate ? format(parseISO(asOfDate), 'dd MMMM yyyy') : '...'}</span>
            <span>Print Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <div className="p-3 border-b-2 border-black bg-slate-100 flex items-center justify-between no-print">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 opacity-40" />
            <Input className="pl-8 h-8 border-black border-2 font-black text-[10px] bg-white text-black" placeholder="Search ID or Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Badge className="bg-black text-white font-black text-[9px] uppercase tracking-widest rounded-none px-4 py-1.5 shadow-sm">{reportData.length} Personnel Audited</Badge>
        </div>
        
        <div className="overflow-x-auto">
          <Table className="w-full text-[8px] font-black table-fixed border-collapse text-[#000000]">
            <TableHeader className="bg-slate-100 border-b-2 border-black uppercase text-[7px] leading-tight font-black">
              <TableRow>
                <TableHead className="border-r border-black p-1 w-[40px] font-black text-black text-center h-10">ID No</TableHead>
                <TableHead className="border-r-2 border-black p-1 text-left w-[110px] font-black text-black h-10">Personnel Name</TableHead>
                <TableHead className="text-right border-r p-1 w-[60px] font-black text-black h-10">Emp(1)</TableHead>
                <TableHead className="text-right border-r p-1 w-[60px] font-black text-black h-10">Draw(2)</TableHead>
                <TableHead className="text-right border-r p-1 w-[60px] font-black text-black h-10">Repay(3)</TableHead>
                <TableHead className="text-right border-r-2 p-1 w-[70px] bg-slate-200 font-black text-black h-10">L.Bal(4)</TableHead>
                <TableHead className="text-right border-r p-1 w-[60px] font-black text-black h-10">E.Profit(5)</TableHead>
                <TableHead className="text-right border-r p-1 w-[60px] font-black text-black h-10">L.Int(6)</TableHead>
                <TableHead className="text-right border-r-2 p-1 w-[75px] bg-slate-300 font-black text-black h-10">Equity(7)</TableHead>
                <TableHead className="text-right border-r p-1 w-[60px] font-black text-black h-10">PBS(8)</TableHead>
                <TableHead className="text-right border-r p-1 w-[60px] font-black text-black h-10">P.Profit(9)</TableHead>
                <TableHead className="text-right border-r-2 p-1 w-[75px] bg-slate-200 font-black text-black h-10">Office(10)</TableHead>
                <TableHead className="text-right p-1 w-[95px] bg-black text-white font-black h-10 uppercase tracking-widest">Total Fund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {reportData.map((r, i) => (
                <TableRow key={i} className="border-b border-black hover:bg-slate-50 h-10 transition-colors bg-transparent">
                  <TableCell className="p-1 border-r border-black font-mono text-center text-black font-bold">{r.id}</TableCell>
                  <TableCell className="p-1 border-r-2 border-black truncate uppercase font-black text-black text-[9px]">{r.name}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.c1.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.c2.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.c3.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r-2 bg-slate-50 font-bold text-black">{r.c4.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.c5.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.c6.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r-2 bg-slate-100 font-bold text-black">{r.c7.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.c8.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r text-black">{r.c9.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 border-r-2 bg-slate-100 font-bold text-black">{r.c10.toLocaleString()}</TableCell>
                  <TableCell className="text-right p-1 bg-slate-200 font-black text-black text-[9px] underline decoration-black underline-offset-4">৳ {r.c11.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-900 text-white font-black h-14 border-t-4 border-black no-print">
              <TableRow className="h-14 hover:bg-slate-900">
                <TableCell colSpan={2} className="text-right pr-4 uppercase font-black text-white text-[10px] tracking-widest border-r-2 border-white/10">Institutional Totals:</TableCell>
                <TableCell className="text-right border-r border-white/10 text-white">{stats.c1.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 text-white">{stats.c2.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 text-white">{stats.c3.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10 bg-white/10 text-white">{stats.c4.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 text-white">{stats.c5.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 text-white">{stats.c6.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10 bg-white/20 text-white">{stats.c7.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 text-white">{stats.c8.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 text-white">{stats.c9.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-white/10 bg-white/10 text-white">{stats.c10.toLocaleString()}</TableCell>
                <TableCell className="text-right bg-white text-black text-xl font-black pr-2 underline decoration-double">৳ {stats.c11.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
            {/* PRINT SPECIFIC FOOTER TOTALS */}
            <TableFooter className="hidden print:table-footer-group bg-slate-100 text-black font-black border-t-4 border-black">
              <TableRow className="h-12 font-black text-black">
                <TableCell colSpan={2} className="text-right pr-4 uppercase font-black text-[10px] border-r-2 border-black">Institutional Aggregates:</TableCell>
                <TableCell className="text-right border-r border-black">{stats.c1.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-black">{stats.c2.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-black">{stats.c3.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-black bg-slate-200">{stats.c4.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-black">{stats.c5.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-black">{stats.c6.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-black bg-slate-200">{stats.c7.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-black">{stats.c8.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-black">{stats.c9.toLocaleString()}</TableCell>
                <TableCell className="text-right border-r-2 border-black bg-slate-200">{stats.c10.toLocaleString()}</TableCell>
                <TableCell className="text-right font-black text-lg underline decoration-double decoration-black/30 bg-white">৳ {stats.c11.toLocaleString()}</TableCell>
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
            <span>CPF Management Softawre v1.2</span>
            <span>Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
