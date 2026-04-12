"use client"

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Calculator, 
  Loader2, 
  ShieldCheck, 
  CalendarClock, 
  FileSpreadsheet, 
  Printer,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, parseISO, startOfMonth, endOfMonth, format } from "date-fns";
import * as XLSX from "xlsx";

export default function InvestmentMaturityReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const TDS_RATE = 0.20; // 20% TDS

  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // Initialize date range to current month
  useEffect(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(new Date(now.getFullYear(), now.getMonth() + 11, 1)); // Default to 1 year range
    setDateRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    });
  }, []);

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const investmentsRef = useMemoFirebase(() => collection(firestore, "investmentInstruments"), [firestore]);
  const { data: investments, isLoading } = useCollection(investmentsRef);

  const reportData = useMemo(() => {
    if (!investments) return [];

    return investments
      .filter(inv => {
        if (inv.status !== 'Active') return false;
        if (!inv.maturityDate) return false;
        
        if (dateRange.start && dateRange.end) {
          const mDate = parseISO(inv.maturityDate).getTime();
          const sDate = parseISO(dateRange.start).getTime();
          const eDate = parseISO(dateRange.end).getTime();
          return mDate >= sDate && mDate <= eDate;
        }
        return true;
      })
      .map(inv => {
        const issueDate = parseISO(inv.issueDate);
        const maturityDate = parseISO(inv.maturityDate);
        
        const tenureDays = Math.max(0, differenceInDays(maturityDate, issueDate));
        const rate = Number(inv.interestRate) || 0;
        const principal = Number(inv.principalAmount) || 0;
        
        // Total Cycle Interest Formula: Principal * Rate * (Tenure / 365)
        const totalGrossInterest = principal * rate * (tenureDays / 365);
        const tdsAmount = totalGrossInterest * TDS_RATE;
        const netInterest = totalGrossInterest - tdsAmount;

        return {
          ...inv,
          tenureDays,
          totalGrossInterest,
          tdsAmount,
          netInterest
        };
      })
      .sort((a, b) => new Date(a.maturityDate || "").getTime() - new Date(b.maturityDate || "").getTime());
  }, [investments, dateRange]);

  const totals = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      gross: acc.gross + curr.totalGrossInterest,
      tds: acc.tds + curr.tdsAmount,
      net: acc.net + curr.netInterest,
      principal: acc.principal + (Number(curr.principalAmount) || 0)
    }), { gross: 0, tds: 0, net: 0, principal: 0 });
  }, [reportData]);

  const exportToExcel = () => {
    const data = reportData.map(item => ({
      "Bank Name": item.bankName,
      "Ref No": item.referenceNumber,
      "Principal (৳)": item.principalAmount,
      "Rate (%)": (Number(item.interestRate) * 100).toFixed(2),
      "Issue Date": item.issueDate,
      "Maturity Date": item.maturityDate,
      "Tenure (Days)": item.tenureDays,
      "Total Gross Yield (৳)": item.totalGrossInterest.toFixed(2),
      "TDS (20%) (৳)": item.tdsAmount.toFixed(2),
      "Net Yield (৳)": item.netInterest.toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Maturity Schedule");
    XLSX.writeFile(wb, `Investment_Maturity_Schedule_${dateRange.start}_to_${dateRange.end}.xlsx`);
    toast({ title: "Exported", description: "Maturity yield schedule saved to Excel." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/investments" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors group">
            <ArrowLeft className="size-6 text-slate-600 group-hover:text-primary" />
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-black text-primary tracking-tight">Provision Report</h1>
            <p className="text-lg font-bold text-slate-600 uppercase tracking-widest">Full Cycle Yield Audit • Adjustment Journal Guide</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={reportData.length === 0} className="gap-2 h-11 font-black border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <FileSpreadsheet className="size-5" /> Export Schedule
          </Button>
          <Button onClick={() => window.print()} disabled={reportData.length === 0} className="gap-2 h-11 font-black shadow-lg shadow-primary/20">
            <Printer className="size-5" /> Print Statement
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
        <div className="flex-1 w-full space-y-2">
          <Label className="text-xs font-black uppercase text-slate-400 ml-1">Maturity Period Filter</Label>
          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400">From</span>
              <Input 
                type="date" 
                value={dateRange.start} 
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})} 
                className="h-9 font-black border-none bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
            <ArrowRightLeft className="size-4 text-slate-300" />
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400">To</span>
              <Input 
                type="date" 
                value={dateRange.end} 
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})} 
                className="h-9 font-black border-none bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
          <AlertCircle className="size-5 text-amber-600" />
          <p className="text-xs font-bold text-amber-800 leading-tight">
            Showing instruments with <b>Maturity Date</b> between selected range.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 no-print">
        <Card className="bg-slate-50 border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-slate-500 tracking-widest">Selected Principal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">৳ {totals.principal.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-primary tracking-widest opacity-70">Total Gross Yield</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary">৳ {totals.gross.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="bg-rose-50 border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-rose-600 tracking-widest opacity-70">Expected Tax (20%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-700">৳ {totals.tds.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-emerald-600 tracking-widest opacity-70">Net Maturity Yield</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-700">৳ {totals.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-3xl shadow-2xl border overflow-hidden no-print">
        <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xl font-black flex items-center gap-3">
            <TrendingUp className="size-6 text-indigo-600" />
            Full Cycle Interest Matrix
          </h2>
          <Badge variant="outline" className="bg-white border-slate-200 px-4 py-1.5 font-black uppercase text-[10px]">
            Period: {dateRange.start} to {dateRange.end}
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-black py-5 pl-6">Bank & Reference</TableHead>
              <TableHead className="text-center font-black py-5">Cycle / Tenure</TableHead>
              <TableHead className="text-right font-black py-5">Principal (৳)</TableHead>
              <TableHead className="text-right font-black py-5">Gross Yield (৳)</TableHead>
              <TableHead className="text-right font-black py-5 text-rose-600">TDS (20%)</TableHead>
              <TableHead className="text-right font-black py-5 pr-6 text-primary">Net at Maturity (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : reportData.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-bold text-lg italic">No active investments maturing in this period.</TableCell></TableRow>
            ) : reportData.map((item) => (
              <TableRow key={item.id} className="hover:bg-slate-50 transition-colors border-b">
                <TableCell className="py-6 pl-6">
                  <div className="flex flex-col">
                    <span className="font-black text-slate-900 text-base">{item.bankName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground font-bold uppercase tracking-tight">Ref: {item.referenceNumber}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 font-black text-[11px] text-slate-600">
                      <span>{item.issueDate}</span>
                      <ArrowRight className="size-3 text-slate-300" />
                      <span className="text-rose-600">{item.maturityDate || "N/A"}</span>
                    </div>
                    <Badge variant="secondary" className="mt-1 h-5 text-[10px] font-black">{item.tenureDays} Days Tenure</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold text-slate-600">
                  ৳ {Number(item.principalAmount).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-black text-slate-900">৳ {item.totalGrossInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-bold text-rose-600">৳ {item.tdsAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex flex-col items-end">
                    <span className="font-black text-xl text-primary">৳ {item.netInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Total Yield</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-slate-900 text-white font-black">
            <TableRow>
              <TableCell colSpan={5} className="text-right uppercase tracking-widest text-sm pl-6 py-6">Consolidated Maturity Yield (Net):</TableCell>
              <TableCell className="text-right pr-6 py-6">
                <span className="text-2xl underline decoration-double">৳ {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex gap-4 items-start no-print">
        <ShieldCheck className="size-8 text-blue-600 shrink-0" />
        <div className="space-y-1">
          <h3 className="font-black text-blue-800 uppercase text-sm">Adjustment Journal Guide</h3>
          <p className="text-sm text-blue-700 leading-relaxed font-bold">
            Use the "Net Maturity Yield" column to record the cumulative income earned by an instrument upon its scheduled end date.
            Adjustments should be posted to <b>Accrued Interest (106.10.0000)</b> or <b>Interest Income (400.10.0000)</b> based on your periodic recognition rules.
          </p>
        </div>
      </div>

      {/* INSTITUTIONAL PRINT VIEW */}
      <div className="hidden print:block print-container text-black">
        <div className="text-center space-y-2 mb-10 border-b-2 border-black pb-8">
          <h1 className="text-3xl font-black uppercase">{pbsName}</h1>
          <h2 className="text-xl font-bold underline underline-offset-8 uppercase tracking-[0.2em]">Investment Maturity Interest Schedule</h2>
          <div className="flex justify-between text-xs font-bold pt-6">
            <span>Report Period: From {dateRange.start} to {dateRange.end} (Maturity Basis)</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-3 text-left">Bank & Reference</th>
              <th className="border border-black p-3 text-center">Cycle (Issue - Mature)</th>
              <th className="border border-black p-3 text-right">Principal (৳)</th>
              <th className="border border-black p-3 text-right">Gross Yield (৳)</th>
              <th className="border border-black p-3 text-right">TDS (20%) (৳)</th>
              <th className="border border-black p-3 text-right font-black">Net at Maturity (৳)</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((item, i) => (
              <tr key={i}>
                <td className="border border-black p-3">
                  <span className="font-bold">{item.bankName}</span><br/>
                  <span className="text-[8px] font-mono">{item.referenceNumber}</span>
                </td>
                <td className="border border-black p-3 text-center">
                  {item.issueDate} to {item.maturityDate}<br/>
                  <span className="text-[8px] uppercase">({item.tenureDays} Days)</span>
                </td>
                <td className="border border-black p-3 text-right">{Number(item.principalAmount).toLocaleString()}</td>
                <td className="border border-black p-3 text-right">{item.totalGrossInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border border-black p-3 text-right">{item.tdsAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border border-black p-3 text-right font-bold">{item.netInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black">
              <td colSpan={5} className="border border-black p-3 text-right uppercase tracking-widest">Total Estimated Net Yield:</td>
              <td className="border border-black p-3 text-right underline decoration-double">
                ৳ {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[12px] font-bold text-center">
          <div className="border-t border-black pt-2">Accountant (Audit)</div>
          <div className="border-t border-black pt-2">Internal Auditor / DGM</div>
          <div className="border-t border-black pt-2">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
