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
  ArrowLeft
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function LedgerSummaryReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
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
        c1 += Number(s.employeeContribution)||0; c2 += Number(s.loanWithdrawal)||0; c3 += Number(s.loanRepayment)||0;
        c5 += Number(s.profitEmployee)||0; c6 += Number(s.profitLoan)||0; c8 += Number(s.pbsContribution)||0; c9 += Number(s.profitPbs)||0;
      });
      const c4 = c2 - c3; const c7 = c1 - c2 + c3 + c5 + c6; const c10 = c8 + c9; const c11 = c7 + c10;
      return { memberIdNumber: m.memberIdNumber, name: m.name, designation: m.designation, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11 };
    }).filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.memberIdNumber?.includes(search)).sort((a,b) => (a.memberIdNumber||"").localeCompare(b.memberIdNumber||""));
  }, [members, allSummaries, asOfDate, search]);

  const stats = useMemo(() => reportData.reduce((a,c) => ({ c1:a.c1+c.c1, c2:a.c2+c.c2, c3:a.c3+c.c3, c4:a.c4+c.c4, c5:a.c5+c.c5, c6:a.c6+c.c6, c7:a.c7+c.c7, c8:a.c8+c.c8, c9:a.c9+c.c9, c10:a.c10+c.c10, c11:a.c11+c.c11 }), {c1:0,c2:0,c3:0,c4:0,c5:0,c6:0,c7:0,c8:0,c9:0,c10:0,c11:0}), [reportData]);

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger Matrix");
    XLSX.writeFile(wb, `CPF_Ledger_Summary_${asOfDate}.xlsx`);
  };

  const StandardFooter = () => (
    <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
      <span>CPF Management Software</span><span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
    </div>
  );

  if (isMembersLoading || isSummariesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-black">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape !important; margin: 5mm !important; }
          .print-container { width: 100% !important; display: block !important; }
          table { table-layout: fixed !important; width: 100% !important; }
          body { background-color: white !important; font-size: 8px !important; color: #000000 !important; }
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-1.5 hover:bg-slate-100 rounded-full border-2 border-black"><ArrowLeft className="size-5 text-black" /></Link>
          <h1 className="text-2xl font-black tracking-tighter uppercase">Ledger Matrix</h1>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border-2 border-black shadow-lg">
          <div className="grid gap-1">
            <Label className="text-[9px] font-black uppercase">Statement Date</Label>
            <Input type="date" value={asOfDate} max="9999-12-31" onChange={(e) => setAsOfDate(e.target.value)} className="h-8 w-32 border-black text-[10px] font-black" />
          </div>
          <Button variant="outline" onClick={exportToExcel} className="h-8 font-black px-3 border-black text-[9px] gap-1">
            <FileSpreadsheet className="size-3" /> Excel
          </Button>
          <Button onClick={() => window.print()} className="h-8 font-black px-4 bg-black text-white text-[9px] gap-1">
            <Printer className="size-3" /> Print
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-none border-2 border-black overflow-hidden print-container">
        <div className="p-2 border-b-2 border-black bg-slate-50 flex items-center justify-between no-print">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 opacity-40" />
            <Input className="pl-7 h-8 border-black font-black text-[10px]" placeholder="Search ID/Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        
        <div className="overflow-x-hidden">
          <Table className="w-full font-black tabular-nums border-collapse text-[8px] table-fixed">
            <TableHeader className="bg-slate-100 border-b-2 border-black">
              <tr className="uppercase text-[7px] leading-tight">
                <th className="border-r-2 border-black p-0.5 w-[40px]">ID</th>
                <th className="border-r-2 border-black p-0.5 text-left w-[100px]">Name</th>
                <th className="text-right border-r p-0.5 w-[65px]">E(1)</th>
                <th className="text-right border-r p-0.5 w-[65px]">D(2)</th>
                <th className="text-right border-r p-0.5 w-[65px]">R(3)</th>
                <th className="text-right border-r-2 p-0.5 w-[75px] bg-slate-100">L(4)</th>
                <th className="text-right border-r p-0.5 w-[65px]">P(5)</th>
                <th className="text-right border-r-2 p-0.5 w-[65px]">L(6)</th>
                <th className="text-right border-r-2 p-0.5 w-[75px] bg-slate-200">7</th>
                <th className="text-right border-r p-0.5 w-[65px]">O(8)</th>
                <th className="text-right border-r-2 p-0.5 w-[65px]">P(9)</th>
                <th className="text-right border-r-2 p-0.5 w-[75px] bg-slate-100">10</th>
                <th className="text-right p-0.5 w-[85px] bg-black text-white">11</th>
              </tr>
            </TableHeader>
            <TableBody>
              {reportData.map((r, i) => (
                <TableRow key={i} className="border-b border-black hover:bg-slate-50 h-8">
                  <td className="p-0.5 border-r-2 border-black font-mono text-center">{r.memberIdNumber}</td>
                  <td className="p-0.5 border-r-2 border-black uppercase truncate leading-none font-black">{r.name}</td>
                  <td className="p-0.5 text-right border-r">{r.c1.toLocaleString()}</td>
                  <td className="p-0.5 text-right border-r">{r.c2.toLocaleString()}</td>
                  <td className="p-0.5 text-right border-r">{r.c3.toLocaleString()}</td>
                  <td className="p-0.5 text-right border-r-2 bg-slate-50">{r.c4.toLocaleString()}</td>
                  <td className="p-0.5 text-right border-r">{r.c5.toLocaleString()}</td>
                  <td className="p-0.5 text-right border-r-2">{r.c6.toLocaleString()}</td>
                  <td className="p-0.5 text-right border-r-2 bg-slate-50 font-bold">{r.c7.toLocaleString()}</td>
                  <td className="p-0.5 text-right border-r">{r.c8.toLocaleString()}</td>
                  <td className="p-0.5 text-right border-r-2">{r.c9.toLocaleString()}</td>
                  <td className="p-0.5 text-right border-r-2 bg-slate-50 font-bold">{r.c10.toLocaleString()}</td>
                  <td className="p-0.5 text-right bg-slate-100 font-black text-black"> {r.c11.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-black text-white font-black text-[8px]">
              <TableRow className="h-10">
                <td colSpan={2} className="text-right pr-2">CONSOLIDATED TOTALS:</td>
                <td className="text-right">{stats.c1.toLocaleString()}</td>
                <td className="text-right">{stats.c2.toLocaleString()}</td>
                <td className="text-right">{stats.c3.toLocaleString()}</td>
                <td className="text-right bg-white/10">{stats.c4.toLocaleString()}</td>
                <td className="text-right">{stats.c5.toLocaleString()}</td>
                <td className="text-right">{stats.c6.toLocaleString()}</td>
                <td className="text-right bg-white/10">{stats.c7.toLocaleString()}</td>
                <td className="text-right">{stats.c8.toLocaleString()}</td>
                <td className="text-right">{stats.c9.toLocaleString()}</td>
                <td className="text-right bg-white/10">{stats.c10.toLocaleString()}</td>
                <td className="text-right bg-white text-black font-black text-[10px]">৳ {stats.c11.toLocaleString()}</td>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <StandardFooter />
      </div>
    </div>
  );
}
