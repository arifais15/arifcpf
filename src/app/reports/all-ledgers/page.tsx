
"use client"

import React, { useMemo, useState, useEffect } from "react";
import { 
  Loader2, 
  Printer, 
  ArrowLeft
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
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
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="size-12 animate-spin text-black" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-black">Synthesizing Institutional Ledger Volume...</p>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
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

      <div className="flex flex-col gap-0">
        {memberLedgers.map((ledger, idx) => (
          <div key={ledger.member.id} className={cn("bg-white p-12 print:p-0 print:m-0 print:shadow-none shadow-2xl border-2 border-black mb-16 print:border-none", idx < memberLedgers.length - 1 && "print:break-after-page")}>
            <div className="relative mb-10 text-center border-b-4 border-black pb-8">
              <p className="text-[10px] absolute left-0 top-0 font-black uppercase tracking-[0.2em] text-black">REB Form no: 224</p>
              <h1 className="text-3xl font-black uppercase tracking-tight text-black">{pbsName}</h1>
              <p className="text-base font-black uppercase tracking-[0.3em] text-black mt-1">Contributory Provident Fund</p>
              <h2 className="text-xl font-black underline underline-offset-8 decoration-2 uppercase tracking-[0.3em] mt-4 text-black">Provident Fund Subsidiary Ledger</h2>
            </div>

            <div className="grid grid-cols-3 gap-x-12 gap-y-6 mb-10 text-[13px] font-black border-b-4 border-black pb-6 text-black">
              {[
                { l: "Member Name", v: ledger.member.name, u: "uppercase" },
                { l: "Designation", v: ledger.member.designation },
                { l: "ID Number", v: ledger.member.memberIdNumber, m: "font-mono" },
                { l: "Perm. Address", v: ledger.member.permanentAddress || "-", s: "text-[11px]" },
                { l: "Joined Date", v: ledger.member.dateJoined },
                { l: "Status", v: ledger.member.status || "Active", u: "uppercase" },
              ].map((item, i) => (
                <div key={i} className="flex gap-2 items-end border-b-2 border-black pb-1.5">
                  <span className="min-w-[110px] uppercase text-[9px] text-black tracking-widest">{item.l}</span>
                  <span className={cn("flex-1 truncate font-black text-black", item.u, item.m, item.s)}>{item.v}</span>
                </div>
              ))}
            </div>

            <table className="w-full text-[11px] border-collapse border-2 border-black table-fixed text-black font-black">
              <thead className="bg-slate-100 font-black border-b-2 border-black">
                {/* Row 1: Logical Groupings */}
                <tr>
                  <th rowSpan={3} className="border-2 border-black p-1 text-center w-[75px] uppercase text-[9px] tracking-tighter">Date</th>
                  <th rowSpan={3} className="border-2 border-black p-1 text-center w-[170px] uppercase text-[9px] tracking-tighter">Particulars</th>
                  <th colSpan={2} className="border-2 border-black p-1 text-center uppercase text-[9px] bg-slate-200/50">Employees Contribution & Profit</th>
                  <th colSpan={5} className="border-2 border-black p-1 text-center uppercase text-[9px] bg-slate-100">Loan Draw & Payment</th>
                  <th colSpan={3} className="border-2 border-black p-1 text-center uppercase text-[9px] bg-slate-100">PBS Contribution & Profit</th>
                  <th rowSpan={3} className="border-2 border-black p-1 text-right w-[110px] uppercase text-[10px] bg-slate-200">TOTAL<br/>(Col 11)</th>
                </tr>
                {/* Row 2: Reordered Column Indices: 1, 5, 2, 3, 4, 6, 7, 8, 9, 10 */}
                <tr className="bg-slate-50 text-[10px]">
                  {[1, 5, 2, 3, 4, 6, 7, 8, 9, 10].map(i => (
                    <th key={i} className="border border-black p-0.5 text-center font-mono">{i}</th>
                  ))}
                </tr>
                {/* Row 3: Detail Labels */}
                <tr className="text-[8px] uppercase leading-none">
                  <th className="border border-black p-1 text-right">Contrib</th>
                  <th className="border border-black p-1 text-right">Profit</th>
                  <th className="border border-black p-1 text-right">Draw</th>
                  <th className="border border-black p-1 text-right">Payment</th>
                  <th className="border border-black p-1 text-right bg-slate-200">Balance</th>
                  <th className="border border-black p-1 text-right">Profit</th>
                  <th className="border border-black p-1 text-right bg-slate-200">Net</th>
                  <th className="border border-black p-1 text-right">Contrib</th>
                  <th className="border border-black p-1 text-right">Profit</th>
                  <th className="border border-black p-1 text-right bg-slate-100">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black font-black tabular-nums">
                {ledger.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td className="border border-black p-1 text-center font-mono text-[10px] font-black">{row.summaryDate}</td>
                    <td className="border border-black p-1 truncate text-[10px] font-black uppercase">{row.particulars}</td>
                    {/* Data sequence matches 1, 5, 2, 3, 4, 6, 7, 8, 9, 10 */}
                    <td className="border border-black p-1 text-right">{row.col1.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{row.col5.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{row.col2.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{row.col3.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right bg-slate-50">{row.col4.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{row.col6.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right bg-slate-50">{row.col7.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{row.col8.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right">{row.col9.toLocaleString()}</td>
                    <td className="border border-black p-1 text-right bg-slate-50">{row.col10.toLocaleString()}</td>
                    {/* Total: 11 */}
                    <td className="border border-black p-1 text-right bg-slate-100">{row.col11.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black border-t-2 border-black tabular-nums">
                <tr>
                  <td className="border border-black p-1.5 text-center uppercase text-[10px]" colSpan={2}>Aggregate Portions:</td>
                  {/* Footer sequence matches 1, 5, 2, 3, 4, 6, 7, 8, 9, 10 */}
                  <td className="border border-black p-1.5 text-right">{ledger.sums.c1.toLocaleString()}</td>
                  <td className="border border-black p-1.5 text-right">{ledger.sums.c5.toLocaleString()}</td>
                  <td className="border border-black p-1.5 text-right">{ledger.sums.c2.toLocaleString()}</td>
                  <td className="border border-black p-1.5 text-right">{ledger.sums.c3.toLocaleString()}</td>
                  <td className="border border-black p-1.5 text-right bg-slate-200">{(ledger.last?.col4 || 0).toLocaleString()}</td>
                  <td className="border border-black p-1.5 text-right">{ledger.sums.c6.toLocaleString()}</td>
                  <td className="border border-black p-1.5 text-right bg-slate-200">{(ledger.last?.col7 || 0).toLocaleString()}</td>
                  <td className="border border-black p-1.5 text-right">{ledger.sums.c8.toLocaleString()}</td>
                  <td className="border border-black p-1.5 text-right">{ledger.sums.c9.toLocaleString()}</td>
                  <td className="border border-black p-1.5 text-right bg-slate-200">{(ledger.last?.col10 || 0).toLocaleString()}</td>
                  {/* Total: 11 */}
                  <td className="border border-black p-1.5 text-right bg-slate-300 font-black text-xs underline decoration-double">{(ledger.last?.col11 || 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-16 pt-8 border-t-2 border-black flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em]">
              <span>Institutional Trust Record • CPF Audit Copy</span>
              <span className="italic px-4 py-1 bg-black text-white rounded">Ledger {idx + 1} of {memberLedgers.length}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
