
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
  const TDS_RATE = 0.20; // 20% TDS

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [viewMode, setViewMode] = useState<"report" | "note">("report");

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
  }, [investments, dateRange]);

  const groupedData = useMemo(() => {
    const groups: Record<string, any[]> = {};
    reportData.forEach(item => {
      const code = item.chartOfAccountId || "101.60.0000";
      if (!groups[code]) groups[code] = [];
      groups[code].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [reportData]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      gross: acc.gross + curr.totalGrossInterest,
      tds: acc.tds + curr.tdsAmount,
      net: acc.net + curr.netInterest,
      principal: acc.principal + (Number(curr.principalAmount) || 0)
    }), { gross: 0, tds: 0, net: 0, principal: 0 });
  }, [reportData]);

  const exportToExcel = () => {
    const data = reportData.map(item => ({ "Account": item.chartOfAccountId, "Bank": item.bankName, "Ref": item.referenceNumber, "Principal": item.principalAmount, "Rate (%)": (Number(item.interestRate)*100).toFixed(2), "Maturity": item.maturityDate, "Net Yield": item.netInterest.toFixed(2) }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Maturity Schedule");
    XLSX.writeFile(wb, `Investment_Maturity_Schedule_${dateRange.start}.xlsx`);
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/investments" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors group"><ArrowLeft className="size-6 text-slate-600 group-hover:text-primary" /></Link>
          <div className="flex flex-col gap-1"><h1 className="text-4xl font-black text-primary tracking-tight">Provision Report</h1><p className="text-lg font-bold text-slate-600 uppercase tracking-widest">Full Cycle Yield Audit • Maturity Decision Matrix</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={viewMode === 'report' ? 'default' : 'outline'} onClick={() => setViewMode('report')} className="gap-2 h-11 font-black"><Layout className="size-5" /> Schedule View</Button>
          <Button variant={viewMode === 'note' ? 'default' : 'outline'} onClick={() => setViewMode('note')} className="gap-2 h-11 font-black border-amber-200 text-amber-700 hover:bg-amber-50"><FileText className="size-5" /> Official Note</Button>
          <div className="w-px h-11 bg-slate-200 mx-2" />
          <Button variant="outline" onClick={exportToExcel} disabled={reportData.length === 0} className="gap-2 h-11 font-black border-emerald-200 text-emerald-700 hover:bg-emerald-50"><FileSpreadsheet className="size-5" /> Export</Button>
          <Button onClick={() => window.print()} disabled={reportData.length === 0} className="gap-2 h-11 font-black shadow-lg shadow-primary/20"><Printer className="size-5" /> Print</Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
        <div className="flex-1 w-full space-y-2">
          <Label className="text-xs font-black uppercase text-slate-400 ml-1">Maturity Period Filter</Label>
          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <div className="flex-1 flex items-center gap-2"><span className="text-[10px] font-black uppercase text-slate-400">From</span><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 font-black border-none bg-transparent shadow-none" /></div>
            <ArrowRightLeft className="size-4 text-slate-300" /><div className="flex-1 flex items-center gap-2"><span className="text-[10px] font-black uppercase text-slate-400">To</span><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 font-black border-none bg-transparent shadow-none" /></div>
          </div>
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3"><AlertCircle className="size-5 text-amber-600" /><p className="text-xs font-bold text-amber-800 leading-tight">Showing instruments maturing within the range.</p></div>
      </div>

      {viewMode === 'report' ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid gap-6 md:grid-cols-4 no-print">
            <Card className="bg-slate-50 border-none shadow-sm rounded-3xl"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-slate-500 tracking-widest">Maturing Principal</CardTitle></CardHeader><CardContent><div className="text-2xl font-black text-slate-900">৳ {totals.principal.toLocaleString()}</div></CardContent></Card>
            <Card className="bg-primary/5 border-none shadow-sm rounded-3xl"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-primary tracking-widest opacity-70">Total Gross Yield</CardTitle></CardHeader><CardContent><div className="text-2xl font-black text-primary">৳ {totals.gross.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></CardContent></Card>
            <Card className="bg-rose-50 border-none shadow-sm rounded-3xl"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-rose-600 tracking-widest opacity-70">Tax (20%)</CardTitle></CardHeader><CardContent><div className="text-2xl font-black text-rose-700">৳ {totals.tds.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></CardContent></Card>
            <Card className="bg-emerald-50 border-none shadow-sm rounded-3xl"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-emerald-600 tracking-widest opacity-70">Net Maturity Yield</CardTitle></CardHeader><CardContent><div className="text-2xl font-black text-emerald-700">৳ {totals.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></CardContent></Card>
          </div>

          <div className="bg-card rounded-3xl shadow-2xl border overflow-hidden no-print">
            <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between"><h2 className="text-xl font-black flex items-center gap-3"><TrendingUp className="size-6 text-indigo-600" /> Yield Schedule</h2><Badge variant="outline" className="bg-white border-slate-200 px-4 py-1.5 font-black uppercase text-[10px]">Basis: {dateRange.start} to {dateRange.end}</Badge></div>
            <Table>
              <TableHeader><TableRow className="bg-muted/30"><TableHead className="font-black py-5 pl-6">Bank & Reference</TableHead><TableHead className="text-center font-black py-5">Tenure</TableHead><TableHead className="text-right font-black py-5">Principal (৳)</TableHead><TableHead className="text-right font-black py-5">Gross Yield</TableHead><TableHead className="text-right font-black py-5 text-rose-600">TDS (20%)</TableHead><TableHead className="text-right font-black py-5 pr-6 text-primary">Net Yield (৳)</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-primary" /></TableCell></TableRow> : groupedData.map(([code, items]) => {
                  const sub = items.reduce((acc, curr) => ({ g: acc.g+curr.totalGrossInterest, t: acc.t+curr.tdsAmount, n: acc.n+curr.netInterest, p: acc.p+(Number(curr.principalAmount)||0) }), { g: 0, t: 0, n: 0, p: 0 });
                  return (
                    <React.Fragment key={code}>
                      <TableRow className="bg-slate-100/50"><TableCell colSpan={6} className="py-2 pl-6"><span className="font-black text-[11px] uppercase tracking-widest text-indigo-700 flex items-center gap-2"><BookOpen className="size-3.5" /> {code} — {activeCOA.find(a => a.code === code)?.name || "OTHER"}</span></TableCell></TableRow>
                      {items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50 transition-colors border-b">
                          <TableCell className="py-6 pl-6"><div className="flex flex-col"><span className="font-black text-slate-900 text-base">{item.bankName}</span><span className="font-mono text-[11px] text-muted-foreground font-bold uppercase">Ref: {item.referenceNumber}</span></div></TableCell>
                          <TableCell className="text-center"><div className="flex flex-col items-center"><div className="flex items-center gap-2 font-black text-[11px] text-slate-600"><span>{item.issueDate}</span><ArrowRight className="size-3" /><span className="text-rose-600">{item.maturityDate}</span></div><Badge variant="secondary" className="mt-1 h-5 text-[10px] font-black">{item.tenureDays} Days</Badge></div></TableCell>
                          <TableCell className="text-right font-bold">৳ {Number(item.principalAmount).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-black">৳ {item.totalGrossInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-bold text-rose-600">৳ {item.tdsAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right pr-6"><span className="font-black text-xl text-primary">৳ {item.netInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 border-b-2 font-black"><TableCell colSpan={2} className="text-right py-4 pr-10 uppercase text-[10px] text-slate-500 italic">Subtotal {code}:</TableCell><TableCell className="text-right py-4">৳ {sub.p.toLocaleString()}</TableCell><TableCell className="text-right py-4">৳ {sub.g.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell><TableCell className="text-right py-4 text-rose-700">৳ {sub.t.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell><TableCell className="text-right py-4 pr-6 text-primary">৳ {sub.n.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell></TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
              <TableFooter className="bg-slate-900 text-white font-black"><TableRow><TableCell colSpan={5} className="text-right uppercase tracking-widest text-sm py-6">Consolidated Portfolio Net Yield:</TableCell><TableCell className="text-right pr-6 py-6"><span className="text-2xl underline decoration-double">৳ {totals.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></TableCell></TableRow></TableFooter>
            </Table>
          </div>
        </div>
      ) : (
        <Card className="max-w-5xl mx-auto border shadow-2xl rounded-none bg-white p-12 print:p-0 print:border-none animate-in zoom-in duration-500 font-ledger text-black">
          <div className="text-center space-y-2 mb-10 border-b-4 border-double border-black pb-8">
            <h1 className="text-3xl font-black uppercase">{pbsName}</h1>
            <p className="text-sm font-black uppercase tracking-widest text-slate-700">Contributory Provident Fund</p>
            <h2 className="text-xl font-bold uppercase tracking-[0.3em] underline underline-offset-8">Office Note</h2>
          </div>
          <div className="flex justify-between items-start mb-8 text-sm font-black"><div><p>Reference: PBS/CPF/INVEST/{new Date().getFullYear()}/_______</p><p>Section: Accounts / Finance</p></div><div className="text-right"><p>Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div></div>
          <div className="space-y-8">
            <div className="flex gap-4"><span className="font-black uppercase min-w-[80px]">Subject:</span><span className="font-black uppercase underline decoration-2 underline-offset-4 leading-relaxed">Approval for encashment or renewal of investment certificates maturing between {dateRange.start} and {dateRange.end}.</span></div>
            <div className="space-y-6 text-sm leading-relaxed text-justify font-medium">
              <p>The following detailed schedule of institutional investment certificates is reaching maturity. Review and necessary decision regarding their encashment or further renewal is requested.</p>
              <div className="py-2 overflow-x-auto">
                <table className="w-full border-collapse border border-black text-[10px]">
                  <thead><tr className="bg-slate-100 font-black"><th className="border border-black p-2 text-left">Bank & Reference No.</th><th className="border border-black p-2 text-right">Principal (৳)</th><th className="border border-black p-2 text-center">Rate (%)</th><th className="border border-black p-2 text-center">Maturity Date</th><th className="border border-black p-2 text-right">Net Interest (৳)</th><th className="border border-black p-2 text-center w-[120px]">Decision (Initial)</th></tr></thead>
                  <tbody>{reportData.map((item, i) => (<tr key={i} className="font-bold"><td className="border border-black p-2"><span className="uppercase">{item.bankName}</span><br/><span className="text-[8px] font-mono opacity-70">REF: {item.referenceNumber}</span></td><td className="border border-black p-2 text-right">{item.principalAmount?.toLocaleString()}</td><td className="border border-black p-2 text-center">{(item.interestRate * 100).toFixed(2)}%</td><td className="border border-black p-2 text-center">{item.maturityDate}</td><td className="border border-black p-2 text-right">{item.netInterest?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td className="border border-black p-2 text-center italic text-slate-300 text-[8px]">Encash / Renew</td></tr>))}</tbody>
                  <tfoot className="bg-slate-50 font-black"><tr><td className="border border-black p-2 text-right uppercase">Consolidated Total:</td><td className="border border-black p-2 text-right">৳ {totals.principal.toLocaleString()}</td><td colSpan={2} className="border border-black p-2 text-center">—</td><td className="border border-black p-2 text-right">৳ {totals.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td className="border border-black p-2"></td></tr></tfoot>
                </table>
              </div>
              <div className="bg-slate-50 p-4 border border-black/10 rounded-lg"><p className="font-black text-xs uppercase mb-2 underline">Analysis Summary:</p><div className="grid grid-cols-2 gap-x-12 gap-y-1"><div className="flex justify-between border-b py-1"><span>Aggregate Maturing Principal:</span> <b>৳ {totals.principal.toLocaleString()}</b></div><div className="flex justify-between border-b py-1"><span>Estimated Net Interest (Post 20% TDS):</span> <b>৳ {totals.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></div></div></div>
              <p className="pt-6 font-black italic">Submitted for kind information and approval of the proposed actions.</p>
            </div>
            <div className="mt-32 grid grid-cols-3 gap-16 text-center font-black text-xs">
              <div className="border-t-2 border-black pt-3 uppercase">Prepared by</div>
              <div className="border-t-2 border-black pt-3 uppercase">Checked by</div>
              <div className="border-t-2 border-black pt-3 uppercase">Approved By Trustee</div>
            </div>
          </div>
        </Card>
      )}

      <div className="hidden print:block print-container text-black">
        {viewMode === 'report' ? (
          <>
            <div className="text-center space-y-2 mb-10 border-b-2 border-black pb-8">
              <h1 className="text-3xl font-black uppercase">{pbsName}</h1>
              <p className="text-sm font-black uppercase tracking-widest text-slate-700">Contributory Provident Fund</p>
              <h2 className="text-xl font-bold underline underline-offset-8 uppercase tracking-[0.2em]">Investment Maturity Interest Schedule</h2>
              <div className="flex justify-between text-xs font-bold pt-6"><span>Report Period: {dateRange.start} to {dateRange.end}</span><span>Run Date: {new Date().toLocaleDateString('en-GB')}</span></div>
            </div>
            <table className="w-full text-[9px] border-collapse border border-black">
              <thead><tr className="bg-slate-100"><th className="border border-black p-2 text-left">Bank & Reference</th><th className="border border-black p-2 text-center">Cycle</th><th className="border border-black p-2 text-right">Principal</th><th className="border border-black p-2 text-right">Gross Yield</th><th className="border border-black p-2 text-right">TDS (20%)</th><th className="border border-black p-2 text-right font-black">Net Yield</th></tr></thead>
              <tbody>{groupedData.map(([code, items]) => (
                <React.Fragment key={code}>
                  <tr className="bg-slate-50 font-black"><td colSpan={6} className="border border-black p-1 text-[8px] uppercase pl-4">ACCOUNT: {code} — {activeCOA.find(a => a.code === code)?.name}</td></tr>
                  {items.map((item, i) => (<tr key={i}><td className="border border-black p-2"><span className="font-bold">{item.bankName}</span><br/><span className="text-[7px] font-mono">{item.referenceNumber}</span></td><td className="border border-black p-2 text-center">{item.issueDate} to {item.maturityDate}</td><td className="border border-black p-2 text-right">{Number(item.principalAmount).toLocaleString()}</td><td className="border border-black p-2 text-right">{item.totalGrossInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td className="border border-black p-2 text-right">{item.tdsAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td className="border border-black p-2 text-right font-bold">{item.netInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>))}
                </React.Fragment>
              ))}</tbody>
              <tfoot><tr className="bg-slate-900 text-white font-black"><td colSpan={5} className="border border-black p-3 text-right uppercase tracking-widest text-sm">Consolidated Net Yield:</td><td className="border border-black p-3 text-right text-base underline decoration-double">৳ {totals.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr></tfoot>
            </table>
            <div className="mt-24 grid grid-cols-3 gap-12 text-[12px] font-bold text-center">
              <div className="border-t border-black pt-2 uppercase">Prepared by</div>
              <div className="border-t border-black pt-2 uppercase">Checked by</div>
              <div className="border-t border-black pt-2 uppercase">Trustee</div>
            </div>
          </>
        ) : <div className="print-portrait-fix mx-auto text-black font-ledger"><p>Office Note Print Placeholder</p></div>}
      </div>
    </div>
  );
}
