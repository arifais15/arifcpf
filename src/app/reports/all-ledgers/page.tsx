"use client"

import React, { useMemo, useState, useEffect } from "react";
import { Loader2, Printer, ArrowLeft, ArrowRightLeft, FileSpreadsheet, ShieldCheck } from "lucide-react";
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
        if (dateRange.start && pre.length > 0) rows = [{ summaryDate: dateRange.start, particulars: "Opening Balance BF", ...preS, col4: lastPre.col4, col7: lastPre.col7, col10: lastPre.col10, col11: lastPre.col11, isOpening: true }, ...inR];
        
        const grand = rows.reduce((acc, r) => ({ c1: acc.c1 + (r.isOpening?0:r.c1), c2: acc.c2 + (r.isOpening?0:r.c2), c3: acc.c3 + (r.isOpening?0:r.c3), c5: acc.c5 + (r.isOpening?0:r.c5), c6: acc.c6 + (r.isOpening?0:r.c6), c8: acc.c8 + (r.isOpening?0:r.c8), c9: acc.c9 + (r.isOpening?0:r.c9) }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

        const lastRowInView = rows[rows.length - 1] || { col4: 0, col7: 0, col10: 0, col11: 0 };

        return { 
          member: m, 
          rows, 
          grand: { 
            ...grand, 
            c1: grand.c1 + preS.c1,
            c2: grand.c2 + preS.c2,
            c3: grand.c3 + preS.c3,
            c5: grand.c5 + preS.c5,
            c6: grand.c6 + preS.c6,
            c8: grand.c8 + preS.c8,
            c9: grand.c9 + preS.c9,
            c4: lastRowInView.col4, 
            c7: lastRowInView.col7, 
            c10: lastRowInView.col10, 
            c11: lastRowInView.col11 
          } 
        };
      });
  }, [members, allSummaries, dateRange]);

  const exportToExcel = () => {
    if (memberLedgers.length === 0) return;
    const workbook = XLSX.utils.book_new();
    const exportData: any[] = [];
    memberLedgers.forEach(l => {
      exportData.push({ Date: `MEMBER: ${l.member.name} (${l.member.memberIdNumber})` });
      l.rows.forEach(r => {
        exportData.push({
          Date: r.summaryDate, Particulars: r.particulars, "Emp Cont": r.c1, "Loan Drw": r.c2, "Loan Repay": r.c3, "Loan Bal": r.col4, "Profit E": r.c5, "Profit L": r.c6, "Equity": r.col7, "PBS Cont": r.c8, "Profit P": r.c9, "Office": r.col10, "Total": r.col11
        });
      });
      exportData.push({ Date: "TOTALS", "Emp Cont": l.grand.c1, "Loan Drw": l.grand.c2, "Loan Repay": l.grand.c3, "Loan Bal": l.grand.c4, "Profit E": l.grand.c5, "Profit L": l.grand.c6, "Equity": l.grand.c7, "PBS Cont": l.grand.c8, "Profit P": l.grand.c9, "Office": l.grand.c10, "Total": l.grand.c11 });
      exportData.push({});
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, ws, "Subsidiary Ledgers");
    XLSX.writeFile(workbook, `Batch_Print_${dateRange.start}.xlsx`);
  };

  if (!isReady) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      {/* 
        CRITICAL: CSS for Page Breaks
        Injected directly to ensure flex containers and overflow wrappers don't block breaking.
      */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          .no-print { display: none !important; }
          
          /* Force physical block flow for page breaking */
          html, body, main, [data-sidebar="inset"] { 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important;
          }
          
          .print-container {
            display: block !important;
            width: 100% !important;
          }
          
          .ledger-page {
            display: block !important;
            break-after: page !important;
            page-break-after: always !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            width: 100% !important;
          }
          
          .ledger-page:last-child {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          table { 
            width: 100% !important; 
            table-layout: fixed !important; 
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          tr { 
            page-break-inside: avoid !important; 
            page-break-after: auto !important;
            height: auto !important;
          }
          th, td { 
            height: auto !important;
            vertical-align: middle !important;
          }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          
          .particulars-cell {
            white-space: normal !important;
            word-break: break-word !important;
            line-height: 1.2 !important;
            padding: 4px 8px !important;
          }
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <Link href="/reports" className="p-2 hover:bg-slate-100 rounded-full border-2 border-black transition-colors"><ArrowLeft className="size-6" /></Link>
        <div className="flex items-center gap-4 bg-slate-50 p-2 border-2 border-black rounded-xl shadow-inner">
          <Select value={selectedFY} onValueChange={(fy) => { setSelectedFY(fy); if(fy==="all") setDateRange({start:"2010-01-01", end:new Date().toISOString().split('T')[0]}); else { const s = parseInt(fy.split("-")[0]); setDateRange({start:`${s}-07-01`, end:`${s+1}-06-30`}); } }}>
            <SelectTrigger className="h-8 w-[120px] font-black text-[10px] uppercase border-black bg-white"><SelectValue /></SelectTrigger>
            <SelectContent className="border-2 border-black">
              {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}
              <SelectItem value="all" className="font-black text-xs">All Historical</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 w-32 border-2 border-black font-black text-[10px] bg-white" />
          <ArrowRightLeft className="size-3 text-black opacity-20" />
          <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 w-32 border-2 border-black font-black text-[10px] bg-white" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="h-11 border-2 border-black font-black uppercase text-xs px-8 hover:bg-slate-50 shadow-md"><FileSpreadsheet className="size-4 mr-2" /> Export Excel</Button>
          <Button onClick={() => window.print()} className="h-11 bg-black text-white font-black uppercase text-xs px-10 shadow-2xl hover:bg-slate-900 transition-all">Commit Batch Print</Button>
        </div>
      </div>

      <div className="print-container">
        {memberLedgers.map((l, i) => (
          <div key={l.member.id} className="ledger-page p-12 mb-20 bg-white border-2 border-black print:mb-0 shadow-2xl rounded-none relative">
            <div className="relative mb-6 text-center">
              <div className="absolute top-0 left-0 bg-slate-50 border border-black px-3 py-1 font-black text-[9px] uppercase tracking-widest text-black">BREB Form-224</div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-black leading-none">{pbsName}</h1>
              <h2 className="text-base font-black uppercase tracking-[0.3em] mt-2 text-black underline underline-offset-4">Provident Fund Subsidiary Ledger</h2>
            </div>

            <div className="grid grid-cols-3 border border-black mb-0 text-[11px] font-black tabular-nums bg-white text-black">
              <div className="border-r border-b border-black py-1 px-4 flex gap-4 items-center h-[21px]">
                <span className="text-blue-700 text-[11px] uppercase tracking-tighter font-black w-[80px]">Name:</span>
                <span className="text-xs flex-1 truncate text-black font-black uppercase">{l.member?.name}</span>
              </div>
              <div className="border-b border-black py-1 px-4 flex gap-4 items-center h-[21px]">
                <span className="text-blue-700 text-[11px] uppercase tracking-tighter font-black w-[80px]">Designation:</span>
                <span className="text-xs flex-1 truncate text-black font-black uppercase">{l.member?.designation}</span>
              </div>
              <div className="border-r border-b border-black py-1 px-4 flex gap-4 items-center h-[21px]">
                <span className="text-amber-800 text-[11px] uppercase tracking-tighter font-black w-[80px]">PayID:</span>
                <span className="text-xs font-mono flex-1 text-black font-black">{l.member?.memberIdNumber}</span>
              </div>
              <div className="border-r border-black py-1 px-4 flex gap-4 items-center h-[21px]">
                <span className="text-blue-700 text-[11px] uppercase tracking-tighter font-black w-[80px]">Office:</span>
                <span className="text-xs flex-1 truncate text-black font-black uppercase">{l.member?.zonalOffice || "Head Office"}</span>
              </div>
              <div className="border-r border-black py-1 px-4 flex gap-4 items-center h-[21px]">
                <span className="text-rose-700 text-[11px] uppercase tracking-tighter font-black w-[80px]">Status:</span>
                <span className={cn("text-[11px] font-black uppercase", l.member?.status === 'Active' ? "text-emerald-700" : "text-rose-700")}>{l.member?.status || "Active"}</span>
              </div>
              <div className="py-1 px-4 flex gap-4 items-center h-[21px]">
                <span className="text-indigo-700 text-[11px] uppercase tracking-tighter font-black w-[100px]">Regular Date:</span>
                <span className="text-xs flex-1 text-black font-black">{l.member?.dateJoined}</span>
              </div>
            </div>

            <table className="w-full text-[8.5px] border-collapse border border-black font-black tabular-nums text-black">
              <thead className="bg-slate-100 border-b border-black uppercase text-center font-black">
                <tr className="border-b border-black">
                  <th rowSpan={2} className="border border-black p-1 w-[80px] bg-indigo-50 text-indigo-800">Date</th>
                  <th rowSpan={2} className="border border-black p-1 text-blue-800">Particulars</th>
                  <th rowSpan={2} className="border border-black p-1 bg-blue-50/50 text-blue-900">Emp<br/>Contrib</th>
                  <th rowSpan={2} className="border border-black p-1 bg-rose-50/50 text-rose-900">Loan<br/>Drw</th>
                  <th rowSpan={2} className="border border-black p-1 bg-emerald-50/50 text-emerald-900">Loan<br/>Repay</th>
                  <th rowSpan={2} className="border border-black p-1 bg-slate-100 text-black w-[90px]">Loan<br/>Balance</th>
                  <th colSpan={2} className="border border-black p-1 bg-amber-50/50 text-amber-900">Profit on</th>
                  <th rowSpan={2} className="border border-black p-1 bg-slate-200 text-black w-[100px]">Total<br/>Equity</th>
                  <th rowSpan={2} className="border border-black p-1 bg-indigo-50/50 text-indigo-900">PBS<br/>Contrib</th>
                  <th rowSpan={2} className="border border-black p-1 bg-indigo-50/50 text-indigo-900">Profit on<br/>PBS Cont</th>
                  <th rowSpan={2} className="border border-black p-1 bg-slate-200 text-black w-[100px]">Total<br/>Office</th>
                  <th rowSpan={2} className="border border-black p-1 bg-slate-50 text-black w-[120px]">Cumulative<br/>Total</th>
                </tr>
                <tr className="border-b border-black">
                  <th className="border border-black p-1 bg-amber-50/20 text-[7px]">Member</th>
                  <th className="border border-black p-1 bg-amber-50/20 text-[7px]">Loan</th>
                </tr>
              </thead>
              <tbody>
                {l.rows.map((r: any, idx: number) => (
                  <tr key={idx} className={cn("border border-black h-auto hover:bg-slate-50 transition-colors bg-transparent", r.isOpening && "bg-slate-50/50 italic")}>
                    <td className="border border-black p-1 text-center font-mono text-indigo-800 text-[8.5px]">{r.summaryDate}</td>
                    <td className="border border-black p-1 px-2 uppercase text-[8.5px] particulars-cell">
                      <div className="max-w-[200px] print:max-w-none">{r.particulars}</div>
                    </td>
                    <td className="border border-black p-0 px-2 text-right text-[8.5px]">{Number(r.c1).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-0 px-2 text-right text-rose-700 text-[8.5px]">{Number(r.c2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-0 px-2 text-right text-emerald-700 text-[8.5px]">{Number(r.c3).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-0 px-2 text-right bg-slate-50 font-mono text-[8.5px]">{Number(r.col4).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-0 px-2 text-right text-[8.5px]">{Number(r.c5).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-0 px-2 text-right text-[8.5px]">{Number(r.c6).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-0 px-2 text-right bg-slate-100 font-bold text-[8.5px]">{Number(r.col7).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-0 px-2 text-right text-[8.5px]">{Number(r.c8).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-0 px-2 text-right text-[8.5px]">{Number(r.c9).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-0 px-2 text-right bg-slate-100 font-bold text-[8.5px]">{Number(r.col10).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-0 px-2 text-right bg-slate-50 font-bold text-[9px]">৳ {Number(r.col11).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black border-t-2 border-black text-[9px] uppercase tabular-nums">
                <tr className="h-10">
                  <td colSpan={2} className="border border-black p-2 text-right bg-slate-200 tracking-widest font-black text-black">Total:</td>
                  <td className="border border-black p-0 px-2 text-right font-black">{l.grand.c1.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-0 px-2 text-right text-rose-800 font-black">{l.grand.c2.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-0 px-2 text-right text-emerald-800 font-black">{l.grand.c3.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-0 px-2 text-right bg-white font-black">{l.grand.c4.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-0 px-2 text-right font-black">{l.grand.c5.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-0 px-2 text-right font-black">{l.grand.c6.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-0 px-2 text-right bg-white font-black">{l.grand.c7.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-0 px-2 text-right font-black">{l.grand.c8.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-0 px-2 text-right font-black">{l.grand.c9.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-0 px-2 text-right bg-white font-black">{l.grand.c10.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-0 px-2 text-right bg-slate-50 text-sm font-black underline decoration-double decoration-black/20">৳ {l.grand.c11.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-8 flex justify-between items-end border-t-2 border-black pt-2">
              <div className="flex items-center gap-2 text-emerald-600">
                 <ShieldCheck className="size-4" />
                 <span className="text-[9px] font-black uppercase tracking-widest">Institutional Audit Reconciled</span>
              </div>
              <p className="text-[9px] font-black uppercase text-slate-400 italic">Developed by Ariful Islam, AGM Finance, Gazipur PBS-2</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
