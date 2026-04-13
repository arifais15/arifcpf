
"use client"

import React, { useMemo, useState, useEffect } from "react";
import { 
  Loader2, 
  Printer, 
  ArrowLeft,
  FileStack,
  ShieldCheck
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AllLedgersPrintPage() {
  const firestore = useFirestore();
  const [isReady, setIsReady] = useState(false);

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  // Defer showing the print content to ensure hydration
  useEffect(() => {
    if (!isMembersLoading && !isSummariesLoading && members && allSummaries) {
      setIsReady(true);
    }
  }, [isMembersLoading, isSummariesLoading, members, allSummaries]);

  const memberLedgers = useMemo(() => {
    if (!members || !allSummaries) return [];

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

        let runningLoanBalance = 0;
        let runningEmployeeFund = 0;
        let runningOfficeFund = 0;

        const calculatedRows = memberSummaries.map((row: any) => {
          const col1 = Number(row.employeeContribution) || 0;
          const col2 = Number(row.loanWithdrawal) || 0;
          const col3 = Number(row.loanRepayment) || 0;
          const col5 = Number(row.profitEmployee) || 0;
          const col6 = Number(row.profitLoan) || 0;
          const col8 = Number(row.pbsContribution) || 0;
          const col9 = Number(row.profitPbs) || 0;

          runningLoanBalance = runningLoanBalance + col2 - col3;
          runningEmployeeFund = runningEmployeeFund + col1 - col2 + col3 + col5 + col6;
          runningOfficeFund = runningOfficeFund + col8 + col9;
          const col11 = runningEmployeeFund + runningOfficeFund;

          return {
            ...row,
            col1, col2, col3, col4: runningLoanBalance, col5, col6, col7: runningEmployeeFund, col8, col9, col10: runningOfficeFund, col11
          };
        });

        const sums = calculatedRows.reduce((acc, r) => ({
          c1: acc.c1 + r.col1, c2: acc.c2 + r.col2, c3: acc.c3 + r.col3, c5: acc.c5 + r.col5, c6: acc.c6 + r.col6, c8: acc.c8 + r.col8, c9: acc.c9 + r.col9
        }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

        return { member, rows: calculatedRows, sums, last: calculatedRows[calculatedRows.length - 1] };
      });
  }, [members, allSummaries]);

  if (!isReady) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="size-12 animate-spin text-primary" />
        <p className="text-sm font-black uppercase tracking-widest text-black animate-pulse">Processing Institutional Ledger Volume...</p>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/reports" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="size-6 text-black" />
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight">Batch Ledger Print</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black">Consolidated output for all individual subsidiary records</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border-2 border-black shadow-sm">
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-black uppercase text-black">Total Ledgers Loaded</span>
            <span className="text-lg font-black text-black">{memberLedgers.length} Personnel</span>
          </div>
          <div className="h-8 w-px bg-black mx-2" />
          <Button onClick={() => window.print()} className="gap-2 h-11 font-black px-8 bg-black text-white shadow-xl">
            <Printer className="size-5" />
            Proceed to Print
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-0">
        {memberLedgers.map((ledger, idx) => (
          <div key={ledger.member.id} className={cn("bg-white p-10 print:p-0 print:m-0 print:shadow-none shadow-xl border-2 border-black mb-12 print:border-none", idx < memberLedgers.length - 1 && "print:break-after-page")}>
            <div className="relative mb-8 text-center border-b-2 border-black pb-6">
              <p className="text-[10px] absolute left-0 top-0 font-black uppercase tracking-[0.2em] text-black">REB Form no: 224</p>
              <h1 className="text-2xl font-black uppercase tracking-tight text-black">{pbsName}</h1>
              <p className="text-sm font-black uppercase tracking-widest text-black">Contributory Provident Fund</p>
              <h2 className="text-lg font-black underline underline-offset-8 uppercase tracking-[0.25em] mt-3 text-black">Provident Fund Subsidiary Ledger</h2>
            </div>

            <div className="grid grid-cols-3 gap-x-8 gap-y-4 mb-8 text-[12px] font-black border-b-2 border-black pb-4 text-black">
              <div className="flex gap-2 items-end border-b border-black pb-1">
                <span className="min-w-[100px] uppercase text-[9px] text-black">Member Name</span>
                <span className="flex-1 truncate uppercase text-black">{ledger.member.name}</span>
              </div>
              <div className="flex gap-2 items-end border-b border-black pb-1">
                <span className="min-w-[80px] uppercase text-[9px] text-black">Designation</span>
                <span className="flex-1 truncate text-black">{ledger.member.designation}</span>
              </div>
              <div className="flex gap-2 items-end border-b border-black pb-1">
                <span className="min-w-[60px] uppercase text-[9px] text-black">ID Number</span>
                <span className="flex-1 font-mono text-black">{ledger.member.memberIdNumber}</span>
              </div>
              <div className="flex gap-2 items-end border-b border-black pb-1">
                <span className="min-w-[100px] uppercase text-[9px] text-black">Perm. Address</span>
                <span className="flex-1 truncate text-[11px] text-black">{ledger.member.permanentAddress || "-"}</span>
              </div>
              <div className="flex gap-2 items-end border-b border-black pb-1">
                <span className="min-w-[80px] uppercase text-[9px] text-black">Joined Date</span>
                <span className="flex-1 text-black">{ledger.member.dateJoined}</span>
              </div>
              <div className="flex gap-2 items-end border-b border-black pb-1">
                <span className="min-w-[60px] uppercase text-[9px] text-black">Status</span>
                <span className="flex-1 uppercase text-[10px] text-black">{ledger.member.status || "Active"}</span>
              </div>
            </div>

            <table className="w-full text-[11px] border-collapse border-2 border-black table-fixed text-black">
              <thead className="bg-slate-100 font-black">
                <tr>
                  <th className="border border-black p-1 text-center w-[70px] uppercase text-[9px] text-black">Date</th>
                  <th className="border border-black p-1 text-center w-[160px] uppercase text-[9px] text-black">Particulars</th>
                  <th className="border border-black p-1 text-right w-[80px] uppercase text-[9px] leading-tight text-black">Emp. Cont (Col 1)</th>
                  <th className="border border-black p-1 text-right w-[80px] uppercase text-[9px] leading-tight text-black">Loan Disb (Col 2)</th>
                  <th className="border border-black p-1 text-right w-[80px] uppercase text-[9px] leading-tight text-black">Loan Repay (Col 3)</th>
                  <th className="border border-black p-1 text-right w-[85px] uppercase text-[9px] leading-tight bg-slate-200 text-black">Loan Bal (Col 4)</th>
                  <th className="border border-black p-1 text-right w-[80px] uppercase text-[9px] text-black">Profit Emp (Col 5)</th>
                  <th className="border border-black p-1 text-right w-[80px] uppercase text-[9px] text-black">Profit Loan (Col 6)</th>
                  <th className="border border-black p-1 text-right w-[90px] uppercase text-[9px] leading-tight bg-slate-100 text-black">Net Emp (Col 7)</th>
                  <th className="border border-black p-1 text-right w-[80px] uppercase text-[9px] text-black">PBS Cont (Col 8)</th>
                  <th className="border border-black p-1 text-right w-[80px] uppercase text-[9px] text-black">Profit PBS (Col 9)</th>
                  <th className="border border-black p-1 text-right w-[90px] uppercase text-[9px] leading-tight bg-slate-100 text-black">Net PBS (Col 10)</th>
                  <th className="border border-black p-1 text-right w-[100px] uppercase text-[9px] leading-tight bg-slate-200 text-black">TOTAL (Col 11)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {ledger.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td className="border border-black p-1 text-center font-mono text-[10px] font-black text-black">{row.summaryDate}</td>
                    <td className="border border-black p-1 truncate text-[10px] font-black text-black uppercase">{row.particulars}</td>
                    <td className="border border-black p-1 text-right font-black text-black">{row.col1.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right font-black text-black">{row.col2.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right font-black text-black">{row.col3.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right font-black bg-slate-50 text-black">{row.col4.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right font-black text-black">{row.col5.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right font-black text-black">{row.col6.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right font-black bg-slate-50 text-black">{row.col7.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right font-black text-black">{row.col8.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right font-black text-black">{row.col9.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right font-black bg-slate-50 text-black">{row.col10.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right font-black bg-slate-100 text-black">{row.col11.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black border-t-2 border-black">
                <tr>
                  <td className="border border-black p-1 text-center uppercase text-[9px] text-black" colSpan={2}>Grand Totals:</td>
                  <td className="border border-black p-1 text-right text-black">{ledger.sums.c1.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledger.sums.c2.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledger.sums.c3.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200 text-black">{(ledger.last?.col4 || 0).toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledger.sums.c5.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledger.sums.c6.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200 text-black">{(ledger.last?.col7 || 0).toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledger.sums.c8.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledger.sums.c9.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200 text-black">{(ledger.last?.col10 || 0).toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-300 font-black text-xs text-black underline decoration-double">৳ {(ledger.last?.col11 || 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-12 pt-6 border-t border-black flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] text-black opacity-100">
              <span>Institution Audit Copy • PBS CPF Software</span>
              <span className="italic">Page {idx + 1} of {memberLedgers.length}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
