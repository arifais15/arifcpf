
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
  Layout,
  FileBox,
  ClipboardList
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
  const [viewMode, setViewMode] = useState<"audit" | "officenote">("audit");

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
      return { 
        ...inv, 
        tenureDays: days, 
        totalGrossInterest: gross, 
        tdsAmount: tds, 
        netInterest: gross - tds,
        displayRate: (Number(inv.interestRate) * 100).toFixed(2) + "%"
      };
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

  const currentYearStr = new Date().getFullYear().toString();

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-black tracking-tight uppercase">Provision Report</h1>
          <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Full Cycle Yield Audit • Maturity Decision Matrix</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border-2 border-black shadow-xl">
          <div className="flex bg-slate-100 p-1 rounded-xl border-2 border-black/10">
            <Button 
              variant={viewMode === 'audit' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('audit')}
              className={cn("h-9 font-black text-[10px] uppercase gap-2 px-4", viewMode === 'audit' ? "bg-black text-white" : "text-black")}
            >
              <ClipboardList className="size-3.5" /> Audit Matrix
            </Button>
            <Button 
              variant={viewMode === 'officenote' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => setViewMode('officenote')}
              className={cn("h-9 font-black text-[10px] uppercase gap-2 px-4", viewMode === 'officenote' ? "bg-black text-white" : "text-black")}
            >
              <FileBox className="size-3.5" /> Office Note
            </Button>
          </div>
          <div className="h-8 w-px bg-black/20" />
          <Button onClick={() => window.print()} className="gap-2 h-10 font-black bg-black text-white shadow-lg uppercase text-[10px] tracking-widest">
            <Printer className="size-4" /> Commit to Print
          </Button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
        <div className="flex-1 w-full space-y-2">
          <Label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Analysis Period Filter</Label>
          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border-2 border-black">
            <div className="flex-1 flex items-center gap-3 pl-4">
              <span className="text-[9px] font-black uppercase text-slate-400">Maturity From</span>
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 font-black border-none bg-transparent focus-visible:ring-0 text-black" />
            </div>
            <ArrowRightLeft className="size-4 text-black opacity-30" />
            <div className="flex-1 flex items-center gap-3 pr-4">
              <span className="text-[9px] font-black uppercase text-slate-400">Maturity To</span>
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 font-black border-none bg-transparent focus-visible:ring-0 text-black" />
            </div>
          </div>
        </div>
      </div>

      {/* AUDIT MATRIX VIEW */}
      {viewMode === 'audit' && (
        <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print animate-in fade-in duration-500">
          <div className="p-4 border-b-4 border-black bg-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-black flex items-center gap-3 uppercase tracking-widest">
              <TrendingUp className="size-5" /> Investment Maturity Yield Matrix
            </h2>
            <Badge className="bg-black text-white font-black px-4 py-1.5 uppercase tracking-widest">Basis: {dateRange.start} to {dateRange.end}</Badge>
          </div>
          <Table className="text-black font-black tabular-nums">
            <TableHeader>
              <TableRow className="bg-slate-50 border-b-2 border-black">
                <TableHead className="font-black text-black uppercase text-[10px] py-5 pl-6">Bank & Reference Details</TableHead>
                <TableHead className="text-center font-black text-black uppercase text-[10px]">Maturity Date</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px]">Principal (৳)</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px]">Gross Yield (৳)</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] bg-slate-100 pr-6">Net Yield (৳)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
              ) : reportData.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-black text-lg uppercase italic">No maturing instruments found in this range</TableCell></TableRow>
              ) : reportData.map((item, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                  <td className="p-5 pl-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-black text-base uppercase leading-tight">{item.bankName}</span>
                      <span className="font-mono text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ref: {item.referenceNumber}</span>
                    </div>
                  </td>
                  <td className="text-center p-5 font-black text-base">{item.maturityDate}</td>
                  <td className="text-right p-5 font-black text-base">{Number(item.principalAmount).toLocaleString()}</td>
                  <td className="text-right p-5 font-black text-base">{item.totalGrossInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="text-right p-5 font-black text-xl bg-slate-50/50 pr-6">৳ {item.netInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-black text-white font-black">
              <TableRow className="h-20">
                <TableCell colSpan={2} className="text-right uppercase tracking-[0.3em] text-sm pr-10">Consolidated Period Totals:</TableCell>
                <TableCell className="text-right text-lg border-l border-white/20 tabular-nums">৳ {totals.principal.toLocaleString()}</TableCell>
                <TableCell className="text-right text-lg border-l border-white/20 tabular-nums">৳ {totals.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right text-3xl underline decoration-double bg-white text-black border-l border-white/20 pr-6 tabular-nums">৳ {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* OFFICE NOTE VIEW (Screenshot Match) */}
      {viewMode === 'officenote' && (
        <div className="bg-white p-12 shadow-2xl border-2 border-black max-w-[1000px] mx-auto w-full no-print animate-in zoom-in-95 duration-500 print-container">
          <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-black">{pbsName}</h1>
            <p className="text-base font-black uppercase tracking-[0.3em] text-black">Contributory Provident Fund</p>
            <div className="mt-8 flex justify-center">
              <div className="border-4 border-black px-12 py-3">
                <h2 className="text-2xl font-black uppercase tracking-[0.4em]">Office Note</h2>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-10 text-sm font-black border-b-2 border-black pb-6">
            <div className="space-y-2">
              <p className="flex gap-2"><span>Reference:</span> <span className="flex-1 border-b border-black">PBS/CPF/INVEST/{currentYearStr}/________</span></p>
              <p className="flex gap-2"><span>Section:</span> <span className="flex-1 border-b border-black">Accounts / Finance</span></p>
            </div>
            <div className="text-right space-y-2">
              <p className="flex justify-end gap-2"><span>Date:</span> <span className="w-40 border-b border-black text-center">{format(new Date(), 'dd MMMM yyyy')}</span></p>
            </div>
          </div>

          <div className="space-y-8 font-black text-black">
            <div className="flex gap-4">
              <span className="uppercase tracking-widest shrink-0">Subject:</span>
              <span className="underline uppercase tracking-tight leading-tight">
                Approval for Encashment or Renewal of Investment Certificates Maturing Between {dateRange.start} and {dateRange.end}.
              </span>
            </div>

            <p className="leading-relaxed text-sm italic opacity-80">
              The following detailed schedule of institutional investment certificates is reaching maturity. Review and necessary decision regarding their encashment or further renewal is requested.
            </p>

            <table className="w-full text-[10px] border-collapse border-2 border-black text-black font-black tabular-nums">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-black">
                  <th className="border border-black p-2 text-left uppercase w-[30%]">Bank & Reference No.</th>
                  <th className="border border-black p-2 text-right uppercase">Principal (৳)</th>
                  <th className="border border-black p-2 text-center uppercase">Rate (%)</th>
                  <th className="border border-black p-2 text-center uppercase">Maturity Date</th>
                  <th className="border border-black p-2 text-right uppercase">Net Interest (৳)</th>
                  <th className="border border-black p-2 text-center uppercase w-[15%]">Decision (Initial)</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((item, idx) => (
                  <tr key={idx} className="border-b border-black">
                    <td className="border border-black p-2 text-left leading-tight">
                      <b>{item.bankName}</b><br/>
                      <span className="text-[8px] font-mono opacity-70">REF: {item.referenceNumber}</span>
                    </td>
                    <td className="border border-black p-2 text-right">{Number(item.principalAmount).toLocaleString()}</td>
                    <td className="border border-black p-2 text-center">{item.displayRate}</td>
                    <td className="border border-black p-2 text-center">{item.maturityDate}</td>
                    <td className="border border-black p-2 text-right">{item.netInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="border border-black p-2 text-center italic text-[8px] opacity-30">Encash / Renew</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-black h-10 border-t-2 border-black">
                  <td className="border border-black p-2 text-right uppercase tracking-widest">Consolidated Total:</td>
                  <td className="border border-black p-2 text-right">৳ {totals.principal.toLocaleString()}</td>
                  <td className="border border-black p-2"></td>
                  <td className="border border-black p-2 text-center">—</td>
                  <td className="border border-black p-2 text-right">৳ {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="border border-black p-2"></td>
                </tr>
              </tfoot>
            </table>

            <div className="bg-slate-50 p-6 border-2 border-black space-y-4 rounded-xl">
              <h3 className="text-xs uppercase underline tracking-[0.2em] mb-2">Analysis Summary:</h3>
              <div className="grid grid-cols-2 gap-12 text-sm">
                <div className="flex justify-between border-b border-black/20 pb-1">
                  <span className="opacity-70">Aggregate Maturing Principal:</span>
                  <span className="font-black">৳ {totals.principal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-black/20 pb-1">
                  <span className="opacity-70">Estimated Net Interest (Post {(TDS_RATE*100).toFixed(0)}% TDS):</span>
                  <span className="font-black">৳ {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <p className="italic font-bold text-center py-6 text-sm">Submitted for kind information and approval of the proposed actions.</p>

            <div className="mt-20 grid grid-cols-3 gap-16 text-[11px] font-black text-center uppercase tracking-widest">
              <div className="border-t-2 border-black pt-4">Prepared by</div>
              <div className="border-t-2 border-black pt-4">Checked by</div>
              <div className="border-t-2 border-black pt-4">Approved By Trustee</div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT VIEW (FORCING FORMAT) */}
      <div className="hidden print:block font-ledger text-black">
        {/* OFFICE NOTE PRINT */}
        {viewMode === 'officenote' && (
          <div className="p-0">
            <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
              <h1 className="text-3xl font-black uppercase tracking-tighter text-black">{pbsName}</h1>
              <p className="text-base font-black uppercase tracking-[0.3em] text-black">Contributory Provident Fund</p>
              <div className="mt-8 flex justify-center">
                <div className="border-4 border-black px-12 py-3">
                  <h2 className="text-2xl font-black uppercase tracking-[0.4em]">Office Note</h2>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-10 text-xs font-black border-b-2 border-black pb-6">
              <div className="space-y-2">
                <p className="flex gap-2"><span>Reference:</span> <span className="flex-1 border-b border-black">PBS/CPF/INVEST/{currentYearStr}/________</span></p>
                <p className="flex gap-2"><span>Section:</span> <span className="flex-1 border-b border-black">Accounts / Finance</span></p>
              </div>
              <div className="text-right space-y-2">
                <p className="flex justify-end gap-2"><span>Date:</span> <span className="w-40 border-b border-black text-center">{format(new Date(), 'dd MMMM yyyy')}</span></p>
              </div>
            </div>

            <div className="space-y-8 font-black text-black">
              <div className="flex gap-4">
                <span className="uppercase tracking-widest shrink-0">Subject:</span>
                <span className="underline uppercase tracking-tight leading-tight">
                  Approval for Encashment or Renewal of Investment Certificates Maturing Between {dateRange.start} and {dateRange.end}.
                </span>
              </div>

              <p className="leading-relaxed text-[10px] italic">
                The following detailed schedule of institutional investment certificates is reaching maturity. Review and necessary decision regarding their encashment or further renewal is requested.
              </p>

              <table className="w-full text-[9px] border-collapse border-2 border-black text-black font-black tabular-nums">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-black">
                    <th className="border border-black p-2 text-left uppercase">Bank & Reference No.</th>
                    <th className="border border-black p-2 text-right uppercase">Principal (৳)</th>
                    <th className="border border-black p-2 text-center uppercase">Rate (%)</th>
                    <th className="border border-black p-2 text-center uppercase">Maturity Date</th>
                    <th className="border border-black p-2 text-right uppercase">Net Interest (৳)</th>
                    <th className="border border-black p-2 text-center uppercase w-[15%]">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item, idx) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border border-black p-2 text-left"><b>{item.bankName}</b><br/>{item.referenceNumber}</td>
                      <td className="border border-black p-2 text-right">{Number(item.principalAmount).toLocaleString()}</td>
                      <td className="border border-black p-2 text-center">{item.displayRate}</td>
                      <td className="border border-black p-2 text-center">{item.maturityDate}</td>
                      <td className="border border-black p-2 text-right">{item.netInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="border border-black p-2 text-center italic text-[7px] opacity-20">Encash / Renew</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-black h-10 border-t-2 border-black">
                    <td className="border border-black p-2 text-right uppercase tracking-widest">Total:</td>
                    <td className="border border-black p-2 text-right">{totals.principal.toLocaleString()}</td>
                    <td className="border border-black p-2"></td>
                    <td className="border border-black p-2 text-center">—</td>
                    <td className="border border-black p-2 text-right">{totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="border border-black p-2"></td>
                  </tr>
                </tfoot>
              </table>

              <div className="bg-slate-50 p-4 border-2 border-black space-y-2">
                <h3 className="text-[10px] uppercase underline tracking-widest">Analysis Summary:</h3>
                <div className="grid grid-cols-2 gap-8 text-[11px]">
                  <div className="flex justify-between border-b border-black/20 pb-1">
                    <span>Aggregate Maturing Principal:</span>
                    <span className="font-black">৳ {totals.principal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-black/20 pb-1">
                    <span>Estimated Net Interest:</span>
                    <span className="font-black">৳ {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <p className="italic font-bold text-center py-4 text-[11px]">Submitted for kind information and approval of the proposed actions.</p>

              <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center uppercase tracking-widest">
                <div className="border-t-2 border-black pt-4">Prepared by</div>
                <div className="border-t-2 border-black pt-4">Checked by</div>
                <div className="border-t-2 border-black pt-4">Approved By Trustee</div>
              </div>
            </div>
          </div>
        )}

        {/* AUDIT MATRIX PRINT */}
        {viewMode === 'audit' && (
          <div className="p-0">
            <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
              <h1 className="text-3xl font-black uppercase tracking-tighter text-black">{pbsName}</h1>
              <p className="text-base font-black uppercase tracking-[0.3em] text-black">Contributory Provident Fund</p>
              <h2 className="text-2xl font-black underline underline-offset-8 uppercase tracking-[0.2em] mt-6">Investment Maturity Schedule Audit</h2>
              <div className="flex justify-between text-[11px] font-black pt-8">
                <span>Period Basis: {dateRange.start} to {dateRange.end}</span>
                <span>Print Date: {new Date().toLocaleDateString('en-GB')}</span>
              </div>
            </div>
            <table className="w-full text-[9px] border-collapse border-2 border-black text-black font-black tabular-nums">
              <thead>
                <tr className="bg-slate-100 font-black border-b-2 border-black">
                  <th className="border border-black p-2.5 text-left uppercase">Bank & Instrument</th>
                  <th className="border border-black p-2.5 text-center uppercase">Maturity Date</th>
                  <th className="border border-black p-2.5 text-right uppercase">Principal Amount</th>
                  <th className="border border-black p-2.5 text-right uppercase">Gross Interest</th>
                  <th className="border border-black p-2.5 text-right uppercase bg-slate-50">Net Provision</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((item, i) => (
                  <tr key={i} className="border-b border-black">
                    <td className="border border-black p-2.5">
                      <span className="font-black uppercase block">{item.bankName}</span>
                      <span className="text-[7px] tracking-widest font-mono">REF: {item.referenceNumber}</span>
                    </td>
                    <td className="border border-black p-2.5 text-center font-black">{item.maturityDate}</td>
                    <td className="border border-black p-2.5 text-right">{Number(item.principalAmount).toLocaleString()}</td>
                    <td className="border border-black p-2.5 text-right">{item.totalGrossInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="border border-black p-2.5 text-right font-black bg-slate-50">{item.netInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black h-16 border-t-2 border-black">
                  <td colSpan={2} className="border border-black p-2.5 text-right uppercase tracking-[0.2em]">Consolidated Totals:</td>
                  <td className="border border-black p-2.5 text-right">৳ {totals.principal.toLocaleString()}</td>
                  <td className="border border-black p-2.5 text-right">৳ {totals.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="border border-black p-2.5 text-right text-lg underline decoration-double underline-offset-4">৳ {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center">
              <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Prepared by</div>
              <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Checked by</div>
              <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Approved By Trustee</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
