
"use client"

import React, { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Calculator, 
  Loader2, 
  ShieldCheck, 
  FileSpreadsheet, 
  Printer,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  ArrowLeft,
  BookOpen,
  FileText,
  Layout
} from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO, startOfMonth, endOfMonth, format } from "date-fns";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function InvestmentMaturityReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [viewMode, setViewMode] = useState<"report" | "note">("report");

  // Fetch Interest Settings for TDS rate
  const interestSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "interest"), [firestore]);
  const { data: interestSettings } = useDoc(interestSettingsRef);
  const TDS_RATE = useMemo(() => interestSettings?.tdsRate !== undefined ? interestSettings.tdsRate : 0.20, [interestSettings]);

  useEffect(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(new Date(now.getFullYear(), now.getMonth() + 11, 1));
    setDateRange({ start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') });
  }, []);

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData } = useCollection(coaRef);
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData]);

  const investmentsRef = useMemoFirebase(() => collection(firestore, "investmentInstruments"), [firestore]);
  const { data: investments, isLoading } = useCollection(investmentsRef);

  const reportData = useMemo(() => {
    if (!investments) return [];
    return investments.filter(inv => {
      if (inv.status !== 'Active' || !inv.maturityDate) return false;
      if (dateRange.start && dateRange.end) {
        const mDate = parseISO(inv.maturityDate).getTime();
        const sDate = parseISO(dateRange.start).getTime();
        const eDate = parseISO(dateRange.end).getTime();
        return mDate >= sDate && mDate <= eDate;
      }
      return true;
    }).map(inv => {
      const days = Math.max(0, differenceInDays(parseISO(inv.maturityDate), parseISO(inv.issueDate)));
      const gross = (Number(inv.principalAmount) || 0) * (Number(inv.interestRate) || 0) * (days / 365);
      const tds = gross * TDS_RATE;
      return { ...inv, tenureDays: days, totalGrossInterest: gross, tdsAmount: tds, netInterest: gross - tds };
    }).sort((a, b) => new Date(a.maturityDate || "").getTime() - new Date(b.maturityDate || "").getTime());
  }, [investments, dateRange, TDS_RATE]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      gross: acc.gross + curr.totalGrossInterest,
      tds: acc.tds + curr.tdsAmount,
      net: acc.net + curr.netInterest,
      principal: acc.principal + (Number(curr.principalAmount) || 0)
    }), { gross: 0, tds: 0, net: 0, principal: 0 });
  }, [reportData]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-black tracking-tight">Provision Report</h1>
          <p className="text-black uppercase tracking-widest text-[10px] font-black">Full Cycle Yield Audit • Maturity Decision Matrix</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="gap-2 h-10 font-black bg-black text-white shadow-lg"><Printer className="size-4" /> Print Schedule</Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
        <div className="flex-1 w-full space-y-2">
          <Label className="text-xs font-black uppercase text-black ml-1">Maturity Period Filter</Label>
          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border-2 border-black">
            <div className="flex-1 flex items-center gap-2"><span className="text-[10px] font-black uppercase text-black">From</span><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 font-black border-none bg-transparent" /></div>
            <ArrowRightLeft className="size-4 text-black" /><div className="flex-1 flex items-center gap-2"><span className="text-[10px] font-black uppercase text-black">To</span><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 font-black border-none bg-transparent" /></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden no-print">
        <Table className="text-black font-black">
          <TableHeader className="bg-slate-100 border-b-2 border-black">
            <TableRow>
              <TableHead className="font-black text-black">Bank & Reference</TableHead>
              <TableHead className="text-center font-black text-black">Maturity Date</TableHead>
              <TableHead className="text-right font-black text-black">Principal</TableHead>
              <TableHead className="text-right font-black text-black">Gross Yield</TableHead>
              <TableHead className="text-right font-black text-black">Net Yield</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportData.map((item, idx) => (
              <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                <td className="p-4"><div><p className="font-black">{item.bankName}</p><p className="text-[10px] opacity-70 font-mono">{item.referenceNumber}</p></div></td>
                <td className="text-center p-4">{item.maturityDate}</td>
                <td className="text-right p-4">{Number(item.principalAmount).toLocaleString()}</td>
                <td className="text-right p-4">{item.totalGrossInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="text-right p-4 font-black">৳ {item.netInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-slate-100 font-black border-t-2 border-black text-black">
            <TableRow>
              <TableCell colSpan={2} className="text-right uppercase">TOTALS:</TableCell>
              <TableCell className="text-right">{totals.principal.toLocaleString()}</TableCell>
              <TableCell className="text-right">{totals.gross.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
              <TableCell className="text-right text-base underline decoration-double">৳ {totals.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-widest">Contributory Provident Fund</p>
          <h2 className="text-xl font-bold underline underline-offset-8 uppercase">Investment Maturity Schedule</h2>
          <div className="flex justify-between text-xs font-bold pt-6"><span>Period: {dateRange.start} to {dateRange.end}</span><span>Run Date: {new Date().toLocaleDateString('en-GB')}</span></div>
        </div>
        <table className="w-full text-[9px] border-collapse border-2 border-black text-black font-black">
          <thead><tr className="bg-slate-100 font-black"><th className="border border-black p-2">Bank & Reference</th><th className="border border-black p-2 text-center">Maturity Date</th><th className="border border-black p-2 text-right">Principal</th><th className="border border-black p-2 text-right">Gross Yield</th><th className="border border-black p-2 text-right">Net Yield</th></tr></thead>
          <tbody>{reportData.map((item, i) => (<tr key={i}><td className="border border-black p-2"><b>{item.bankName}</b><br/>{item.referenceNumber}</td><td className="border border-black p-2 text-center">{item.maturityDate}</td><td className="border border-black p-2 text-right">{item.principalAmount?.toLocaleString()}</td><td className="border border-black p-2 text-right">{item.totalGrossInterest?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td className="border border-black p-2 text-right font-black">{item.netInterest?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>))}</tbody>
          <tfoot><tr className="bg-slate-50 font-black"><td colSpan={2} className="border border-black p-2 text-right uppercase">Totals:</td><td className="border border-black p-2 text-right">৳ {totals.principal.toLocaleString()}</td><td className="border border-black p-2 text-right">৳ {totals.gross.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td className="border border-black p-2 text-right underline decoration-double">৳ {totals.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr></tfoot>
        </table>
        <div className="mt-24 grid grid-cols-3 gap-12 text-[12px] font-black text-center text-black">
          <div className="border-t-2 border-black pt-3 uppercase">Prepared by</div>
          <div className="border-t-2 border-black pt-3 uppercase">Checked by</div>
          <div className="border-t-2 border-black pt-3 uppercase">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
