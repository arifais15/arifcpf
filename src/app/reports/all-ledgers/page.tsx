"use client"

import React, { useMemo, useState, useEffect } from "react";
import { Loader2, Printer, ArrowLeft, ArrowRightLeft, FileSpreadsheet } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

export default function AllLedgersPrintPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isReady, setIsReady] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedFY, setSelectedFY] = useState("");

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const availableFYs = useMemo(() => {
    const fys = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const activeStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    for (let i = 0; i < 15; i++) {
      const start = activeStartYear - i;
      fys.push(`${start}-${(start + 1).toString().slice(-2)}`);
    }
    return fys;
  }, []);

  useEffect(() => {
    if (availableFYs.length > 0 && !selectedFY) {
      const fy = availableFYs[0];
      setSelectedFY(fy);
      const s = parseInt(fy.split("-")[0]);
      setDateRange({ start: `${s}-07-01`, end: `${s + 1}-06-30` });
    }
  }, [availableFYs, selectedFY]);

  useEffect(() => {
    if (!isMembersLoading && !isSummariesLoading && members && allSummaries) setIsReady(true);
  }, [isMembersLoading, isSummariesLoading, members, allSummaries]);

  const memberLedgers = useMemo(() => {
    if (!members || !allSummaries) return [];
    const startDate = dateRange.start ? new Date(dateRange.start).getTime() : 0;
    const endDate = dateRange.end ? new Date(dateRange.end).getTime() : Infinity;

    return members.sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""))
      .map(m => {
        const ms = allSummaries.filter(s => s.memberId === m.id).sort((a,b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime());
        let rL = 0, rE = 0, rO = 0;
        const allC = ms.map(s => {
          const v = { c1:Number(s.employeeContribution)||0, c2:Number(s.loanWithdrawal)||0, c3:Number(s.loanRepayment)||0, c5:Number(s.profitEmployee)||0, c6:Number(s.profitLoan)||0, c8:Number(s.pbsContribution)||0, c9:Number(s.profitPbs)||0 };
          rL += (v.c2 - v.c3); rE += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6); rO += (v.c8 + v.c9);
          return { ...s, ...v, col4:rL, col7:rE, col10:rO, col11:rE+rO };
        });

        const pre = allC.filter(r => new Date(r.summaryDate).getTime() < startDate);
        const inR = allC.filter(r => { const t = new Date(r.summaryDate).getTime(); return t >= startDate && t <= endDate; });
        const lastPre = pre[pre.length - 1] || { col4:0, col7:0, col10:0, col11:0 };
        const preS = pre.reduce((acc, r) => ({ c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3, c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9 }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

        let rows = inR;
        if (dateRange.start && pre.length > 0) rows = [{ summaryDate: dateRange.start, particulars: "Opening Balance", ...preS, col4: lastPre.col4, col7: lastPre.col7, col10: lastPre.col10, col11: lastPre.col11, isOpening: true }, ...inR];
        
        const last = allC[allC.length-1] || { col4:0, col7:0, col10:0, col11:0 };
        const grand = allC.reduce((acc, r) => ({ c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3, c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9 }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

        return { member: m, rows, grand: { ...grand, c4: last.col4, c7: last.col7, c10: last.col10, c11: last.col11 } };
      });
  }, [members, allSummaries, dateRange]);

  const exportToExcel = () => {
    if (memberLedgers.length === 0) return;
    
    const workbook = XLSX.utils.book_new();
    const exportData: any[] = [];

    memberLedgers.forEach(l => {
      // Add Member Header Row
      exportData.push({ Date: `MEMBER: ${l.member.name} (${l.member.memberIdNumber})`, Particulars: "", "Emp Cont (1)": "", "Loan Drw (2)": "", "Loan Repay (3)": "", "Loan Bal (4)": "", "Profit E (5)": "", "Profit L (6)": "", "Net Emp (7)": "", "PBS Cont (8)": "", "Profit P (9)": "", "Net Off (10)": "", "Total (11)": "" });
      
      l.rows.forEach(r => {
        exportData.push({
          Date: r.summaryDate,
          Particulars: r.particulars,
          "Emp Cont (1)": r.c1,
          "Loan Drw (2)": r.c2,
          "Loan Repay (3)": r.c3,
          "Loan Bal (4)": r.col4,
          "Profit E (5)": r.c5,
          "Profit L (6)": r.c6,
          "Net Emp (7)": r.col7,
          "PBS Cont (8)": r.c8,
          "Profit P (9)": r.c9,
          "Net Off (10)": r.col10,
          "Total (11)": r.col11
        });
      });
      
      // Add Grand Totals for this member
      exportData.push({
        Date: "AGGREGATE TOTALS",
        Particulars: "",
        "Emp Cont (1)": l.grand.c1,
        "Loan Drw (2)": l.grand.c2,
        "Loan Repay (3)": l.grand.c3,
        "Loan Bal (4)": l.grand.c4,
        "Profit E (5)": l.grand.c5,
        "Profit L (6)": l.grand.c6,
        "Net Emp (7)": l.grand.c7,
        "PBS Cont (8)": l.grand.c8,
        "Profit P (9)": l.grand.c9,
        "Net Off (10)": l.grand.c10,
        "Total (11)": l.grand.c11
      });
      
      // Empty separator row
      exportData.push({});
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, ws, "All Personnel Ledgers");
    XLSX.writeFile(workbook, `Batch_Ledgers_Export_${dateRange.start}.xlsx`);
    toast({ title: "Exported", description: "All personnel ledgers synchronized to Excel." });
  };

  if (!isReady) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-12" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-[#000000]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <Link href="/reports" className="p-2 hover:bg-slate-100 rounded-full border-2 border-black"><ArrowLeft className="size-6" /></Link>
        <div className="flex items-center gap-3 bg-slate-50 p-2 border-2 border-black rounded-xl h-14">
          <Select value={selectedFY} onValueChange={(fy) => { setSelectedFY(fy); if(fy==="all") setDateRange({start:"2010-01-01", end:new Date().toISOString().split('T')[0]}); else { const s = parseInt(fy.split("-")[0]); setDateRange({start:`${s}-07-01`, end:`${s+1}-06-30`}); } }}>
            <SelectTrigger className="h-8 w-[120px] font-black text-[10px] uppercase border-black"><SelectValue /></SelectTrigger>
            <SelectContent>{availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}<SelectItem value="all" className="font-black text-xs">All Time</SelectItem></SelectContent>
          </Select>
          <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 w-32 border-black font-black text-[10px]" />
          <ArrowRightLeft className="size-3" />
          <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 w-32 border-black font-black text-[10px]" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="h-12 border-2 border-black font-black uppercase text-xs px-8"><FileSpreadsheet className="size-4 mr-2" /> Export Excel</Button>
          <Button onClick={() => window.print()} className="h-12 bg-black text-white font-black uppercase text-xs px-10">Commit Batch Print</Button>
        </div>
      </div>

      <div className="print-container">
        {memberLedgers.map((l, i) => (
          <div key={l.member.id} className={cn("p-12 print:p-0 mb-16 bg-white border-2 border-black print:border-none", i < memberLedgers.length - 1 && "print:break-after-page")}>
            <div className="relative mb-8 text-center border-b-4 border-black pb-4">
              <p className="text-[10px] absolute left-0 top-0 font-black uppercase tracking-widest">REB Form no: 224</p>
              <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
              <h2 className="text-xl font-black uppercase tracking-[0.3em] mt-3">Provident Fund Subsidiary Ledger</h2>
            </div>
            
            <div className="grid grid-cols-3 gap-6 mb-8 text-[11px] font-black border-b-4 border-black pb-4">
              <div className="flex gap-2 border-b border-black/20"><span>NAME:</span><span className="uppercase">{l.member.name}</span></div>
              <div className="flex gap-2 border-b border-black/20"><span>ID NO:</span><span className="font-mono">{l.member.memberIdNumber}</span></div>
              <div className="flex gap-2 border-b border-black/20"><span>DESIGNATION:</span><span className="uppercase">{l.member.designation}</span></div>
              <div className="flex gap-2 border-b border-black/20"><span>STATUS:</span><span className="uppercase">{l.member.status || "Active"}</span></div>
              <div className="flex gap-2 border-b border-black/20"><span>OFFICE:</span><span className="uppercase">{l.member.zonalOffice || "HEAD OFFICE"}</span></div>
              <div className="flex gap-2 border-b border-black/20"><span>PRINTED:</span><span>{new Date().toLocaleDateString()}</span></div>
            </div>

            <table className="w-full text-[9px] border-collapse border-2 border-black font-black tabular-nums">
              <thead className="bg-slate-50 border-b-2 border-black uppercase text-[8px]">
                <tr>
                  <th rowSpan={2} className="border border-black p-1 w-[70px]">Date</th>
                  <th rowSpan={2} className="border border-black p-1">Particulars</th>
                  <th className="border border-black p-1 bg-slate-200/50">Emp Cont(1)</th>
                  <th className="border border-black p-1">Loan Draw(2)</th>
                  <th className="border border-black p-1">Loan Repay(3)</th>
                  <th className="border border-black p-1 bg-slate-200">Loan Bal(4)</th>
                  <th className="border border-black p-1">Profit Emp(5)</th>
                  <th className="border border-black p-1">Profit Loan(6)</th>
                  <th className="border border-black p-1 bg-slate-200">Net Emp(7)</th>
                  <th className="border border-black p-1">PBS Cont(8)</th>
                  <th className="border border-black p-1">Profit PBS(9)</th>
                  <th className="border border-black p-1 bg-slate-200">Net Off(10)</th>
                  <th className="border border-black p-1 bg-black text-white">Total(11)</th>
                </tr>
              </thead>
              <tbody>
                {l.rows.map((r, ri) => (
                  <tr key={ri} className={cn("border-b border-black h-8", r.isOpening && "bg-slate-50 italic")}>
                    <td className="border border-black p-1 text-center font-mono">{r.summaryDate}</td>
                    <td className="border border-black p-1 uppercase truncate max-w-[200px]">{r.particulars}</td>
                    <td className="border border-black p-1 text-right">{r.c1.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{r.c2.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{r.c3.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right bg-slate-50">{r.col4.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{r.c5.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{r.c6.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right bg-slate-50">{r.col7.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{r.c8.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{r.c9.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right bg-slate-50">{r.col10.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right bg-slate-100 font-bold">{r.col11.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black border-t-4 border-black text-[9px]">
                <tr className="h-10 uppercase">
                  <td colSpan={2} className="border border-black p-2 text-right">Aggregate All-Time Sums:</td>
                  <td className="border border-black p-1 text-right">{l.grand.c1.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{l.grand.c2.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{l.grand.c3.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200">{l.grand.c4.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{l.grand.c5.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{l.grand.c6.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200">{l.grand.c7.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{l.grand.c8.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{l.grand.c9.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200">{l.grand.c10.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-black text-white">৳ {l.grand.c11.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
