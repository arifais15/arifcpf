
"use client"

import React, { useMemo, useState, useEffect } from "react";
import { 
  Loader2, 
  Printer, 
  ArrowLeft,
  ArrowRightLeft
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AllLedgersPrintPage() {
  const firestore = useFirestore();
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

  const handleFYChange = (fy: string) => {
    setSelectedFY(fy);
    if (fy === "all") {
      setDateRange({ start: "2010-01-01", end: new Date().toISOString().split('T')[0] });
    } else {
      const parts = fy.split("-");
      const startYear = parseInt(parts[0]);
      setDateRange({ 
        start: `${startYear}-07-01`, 
        end: `${startYear + 1}-06-30` 
      });
    }
  };

  useEffect(() => {
    if (availableFYs.length > 0 && !selectedFY) {
      handleFYChange(availableFYs[0]);
    }
  }, [availableFYs, selectedFY]);

  useEffect(() => {
    if (!isMembersLoading && !isSummariesLoading && members && allSummaries) {
      setIsReady(true);
    }
  }, [isMembersLoading, isSummariesLoading, members, allSummaries]);

  const memberLedgers = useMemo(() => {
    if (!members || !allSummaries) return [];

    const startDate = dateRange.start ? new Date(dateRange.start).getTime() : 0;
    const endDate = dateRange.end ? new Date(dateRange.end).getTime() : Infinity;

    return members
      .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""))
      .map(member => {
        const memberSummaries = allSummaries
          .filter(s => s.memberId === member.id)
          .sort((a, b) => {
            const dateA = new Date(a.summaryDate).getTime();
            const dateB = new Date(b.summaryDate).getTime();
            if (dateA !== dateB) return dateA - dateB;
            const createA = new Date(a.createdAt || 0).getTime();
            const createB = new Date(b.createdAt || 0).getTime();
            return createA - createB;
          });

        let rLoan = 0, rEmp = 0, rOff = 0;
        const allCalculated = memberSummaries.map(row => {
          const v = { 
            c1: Number(row.employeeContribution)||0, 
            c2: Number(row.loanWithdrawal)||0, 
            c3: Number(row.loanRepayment)||0, 
            c5: Number(row.profitEmployee)||0, 
            c6: Number(row.profitLoan)||0, 
            c8: Number(row.pbsContribution)||0, 
            c9: Number(row.profitPbs)||0 
          };
          rLoan += v.c2 - v.c3;
          rEmp += v.c1 - v.c2 + v.c3 + v.c5 + v.c6;
          rOff += v.c8 + v.c9;
          return { ...row, ...v, col4: rLoan, col7: rEmp, col10: rOff, col11: rEmp + rOff };
        });

        const preRows = allCalculated.filter(r => new Date(r.summaryDate).getTime() < startDate);
        const inRangeRows = allCalculated.filter(r => {
          const time = new Date(r.summaryDate).getTime();
          return time >= startDate && time <= endDate;
        });

        const preSums = preRows.reduce((acc, r) => ({
          c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3,
          c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9
        }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

        let displayRows = inRangeRows;
        let openingRowValue = { c1:0, c2:0, c3:0, c5:0, c6:0, c8:0, c9:0 };

        if (dateRange.start && preRows.length > 0) {
          const lastPre = preRows[preRows.length - 1];
          openingRowValue = preSums;
          const openingRow = {
            summaryDate: dateRange.start,
            particulars: "Opening Balance",
            ...preSums,
            col4: lastPre.col4,
            col7: lastPre.col7,
            col10: lastPre.col10,
            col11: lastPre.col11,
            isOpening: true,
            id: "opening-row"
          };
          displayRows = [openingRow, ...inRangeRows];
        }

        const activityTotals = inRangeRows.reduce((acc, r) => ({ 
          c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3, 
          c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9 
        }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

        const grandTotals = {
          c1: openingRowValue.c1 + activityTotals.c1,
          c2: openingRowValue.c2 + activityTotals.c2,
          c3: openingRowValue.c3 + activityTotals.c3,
          c5: openingRowValue.c5 + activityTotals.c5,
          c6: openingRowValue.c6 + activityTotals.c6,
          c8: openingRowValue.c8 + activityTotals.c8,
          c9: openingRowValue.c9 + activityTotals.c9,
        };

        const last = allCalculated[allCalculated.length - 1] || { col4: 0, col7: 0, col10: 0, col11: 0 };

        return { member, rows: displayRows, sums: grandTotals, last };
      });
  }, [members, allSummaries, dateRange]);

  const StandardFooter = () => (
    <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
      <span>CPF Management Software</span>
      <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
    </div>
  );

  if (!isReady) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="size-12 animate-spin text-black" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-black">Synthesizing Institutional Ledger Volume...</p>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 10mm !important;
          }
          .print-container {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            display: block !important;
          }
          table {
            table-layout: fixed !important;
            width: 100% !important;
          }
          body {
            background-color: white !important;
            color: #000000 !important;
          }
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/reports" className="p-2 hover:bg-slate-100 rounded-full transition-colors border-2 border-black">
            <ArrowLeft className="size-6 text-black" />
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tighter uppercase">Batch Ledger Print</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Consolidated subsidiary reports audit trail</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-black/5 p-2 rounded-xl h-14 px-3">
          <div className="flex items-center gap-2 pr-3 border-r border-black/10">
            <Select value={selectedFY} onValueChange={handleFYChange}>
              <SelectTrigger className="h-8 w-[110px] bg-white border-black/20 text-[10px] font-black uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}
                <SelectItem value="all" className="font-black text-xs text-rose-600">ALL TIME</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 w-[120px] bg-white border-black/20 text-[10px] font-black uppercase" />
            <ArrowRightLeft className="size-3 text-black/20" />
            <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 w-[120px] bg-white border-black/20 text-[10px] font-black uppercase" />
          </div>
        </div>

        <div className="flex items-center gap-6 bg-white p-4 rounded-2xl border-2 border-black shadow-xl">
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-black uppercase text-black tracking-widest">Active Ledgers</span>
            <span className="text-2xl font-black text-black">{memberLedgers.length} Personnel</span>
          </div>
          <div className="h-10 w-0.5 bg-black" />
          <Button onClick={() => window.print()} className="gap-3 h-12 font-black px-10 bg-black text-white shadow-xl uppercase tracking-widest hover:bg-black/90">
            <Printer className="size-5" />
            Commit to Print
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-0 print-container">
        {memberLedgers.map((ledger, idx) => (
          <div key={ledger.member.id} className={cn("bg-white p-12 print:p-0 print:m-0 print:shadow-none shadow-2xl border-2 border-black mb-16 print:border-none", idx < memberLedgers.length - 1 && "print:break-after-page")}>
            <div className="relative mb-6 text-center border-b-4 border-black pb-4">
              <p className="text-[10px] absolute left-0 top-0 font-black uppercase tracking-[0.2em] text-black">REB Form no: 224</p>
              <h1 className="text-3xl font-black uppercase tracking-tight text-black">{pbsName}</h1>
              <h2 className="text-xl font-black uppercase tracking-[0.3em] mt-4 text-black">Provident Fund Subsidiary Ledger</h2>
            </div>
            
            <div className="grid grid-cols-3 gap-x-8 gap-y-1.5 mb-8 text-[12px] font-black border-b-4 border-black pb-4 text-black">
              {[
                { l: "Full Legal Name", v: ledger.member.name, u: "uppercase" },
                { l: "Official Designation", v: ledger.member.designation, u: "uppercase" },
                { l: "Trust ID Number", v: ledger.member.memberIdNumber, m: "font-mono" },
                { l: "Mailing Address", v: ledger.member.permanentAddress || "-", s: "text-[10px]" },
                { l: "Joined Date", v: ledger.member.dateJoined },
                { l: "Status", v: ledger.member.status || "Active", u: "uppercase" },
              ].map((item, i) => (
                <div key={i} className="flex items-end gap-2 border-b border-black/20 pb-0.5">
                  <span className="uppercase text-[9px] text-black shrink-0 tracking-widest min-w-[100px]">{item.l}:</span>
                  <span className={cn("truncate font-black text-black", item.u, item.m, item.s)}>{item.v}</span>
                </div>
              ))}
            </div>

            <table className="w-full text-[10px] border-collapse border-2 border-black table-fixed text-black font-black">
              <thead className="bg-slate-100 font-black border-b-2 border-black">
                <tr>
                  <th rowSpan={3} className="border border-black p-0.5 text-center w-[65px] uppercase text-[8px] tracking-tighter text-black">Date</th>
                  <th rowSpan={3} className="border border-black p-0.5 text-center w-[120px] uppercase text-[8px] tracking-tighter text-black">Particulars</th>
                  <th colSpan={4} className="border border-black p-0.5 text-center uppercase text-[8px] bg-slate-200/50 text-black">Contributions & Loans</th>
                  <th colSpan={2} className="border border-black p-0.5 text-center uppercase text-[8px] bg-slate-100 text-black">Profits Received</th>
                  <th rowSpan={3} className="border border-black p-0.5 text-center uppercase text-[8px] bg-slate-200 text-black">Net Emp<br/>(7=Pre+1-2+3+5+6)</th>
                  <th colSpan={2} className="border border-black p-0.5 text-center uppercase text-[8px] bg-slate-100 text-black">PBS Fund</th>
                  <th rowSpan={3} className="border border-black p-0.5 text-center uppercase text-[8px] bg-slate-200 text-black">Net Off<br/>(10=8+9)</th>
                  <th rowSpan={3} className="border border-black p-0.5 text-right w-[90px] uppercase text-[9px] bg-black text-white">Total<br/>(11=7+10)</th>
                </tr>
                <tr className="bg-slate-50 text-[9px]">
                  <th className="border border-black p-0.5">Contrib(1)</th><th className="border border-black p-0.5">Drawal(2)</th><th className="border border-black p-0.5">Repay(3)</th><th className="border border-black p-0.5 bg-slate-200">Bal(4=2-3)</th>
                  <th className="border border-black p-0.5">Emp(5)</th><th className="border border-black p-0.5">Loan(6)</th><th className="border border-black p-0.5">Contrib(8)</th><th className="border border-black p-0.5">Profit(9)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black font-black tabular-nums text-black">
                {ledger.rows.map((row, rIdx) => (
                  <tr key={rIdx} className={cn("h-7", row.isOpening && "bg-slate-50 italic")}>
                    <td className="border border-black p-0.5 text-center font-mono text-[9px]">{row.summaryDate}</td>
                    <td className="border border-black p-0.5 truncate text-[9px] uppercase leading-tight">{row.particulars}</td>
                    <td className="border border-black p-0.5 text-right">{row.c1.toLocaleString()}</td>
                    <td className="border border-black p-0.5 text-right">{row.c2.toLocaleString()}</td>
                    <td className="border border-black p-0.5 text-right">{row.c3.toLocaleString()}</td>
                    <td className="border border-black p-0.5 text-right bg-slate-50">{row.col4.toLocaleString()}</td>
                    <td className="border border-black p-0.5 text-right">{row.c5.toLocaleString()}</td>
                    <td className="border border-black p-0.5 text-right">{row.c6.toLocaleString()}</td>
                    <td className="border border-black p-0.5 text-right bg-slate-50">{row.col7.toLocaleString()}</td>
                    <td className="border border-black p-0.5 text-right">{row.c8.toLocaleString()}</td>
                    <td className="border border-black p-0.5 text-right">{row.c9.toLocaleString()}</td>
                    <td className="border border-black p-0.5 text-right bg-slate-50">{row.col10.toLocaleString()}</td>
                    <td className="border border-black p-0.5 text-right bg-slate-100">{row.col11.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black border-t-2 border-black tabular-nums text-black">
                <tr className="h-8">
                  <td className="border border-black p-1 text-right uppercase text-[9px]" colSpan={2}>Aggregate Sum:</td>
                  <td className="border border-black p-1 text-right">{ledger.sums.c1.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledger.sums.c2.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledger.sums.c3.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200">{(ledger.last?.col4 || 0).toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledger.sums.c5.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledger.sums.c6.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200">{(ledger.last?.col7 || 0).toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledger.sums.c8.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledger.sums.c9.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200">{(ledger.last?.col10 || 0).toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-300 font-black text-[11px] underline decoration-double">{(ledger.last?.col11 || 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-24 grid grid-cols-3 gap-16 text-[11px] font-black text-center uppercase tracking-widest">
              <div className="border-t-2 border-black pt-4">Prepared by</div>
              <div className="border-t-2 border-black pt-4">Checked by</div>
              <div className="border-t-2 border-black pt-4">Approved By Trustee</div>
            </div>
            <StandardFooter />
          </div>
        ))}
      </div>
    </div>
  );
}
