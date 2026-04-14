"use client"

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Calculator, 
  Loader2, 
  ShieldCheck, 
  CalendarDays, 
  Save, 
  TrendingUp, 
  AlertCircle,
  FileSpreadsheet,
  Printer,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { differenceInDays, parseISO } from "date-fns";
import * as XLSX from "xlsx";

export default function InvestmentProvisionsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();

  const [fyEndDate, setFyEndDate] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // Fetch Interest Settings for TDS rate
  const interestSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "interest"), [firestore]);
  const { data: interestSettings } = useDoc(interestSettingsRef);
  const TDS_RATE = useMemo(() => interestSettings?.tdsRate !== undefined ? interestSettings.tdsRate : 0.20, [interestSettings]);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const targetYear = currentMonth > 6 ? currentYear + 1 : currentYear;
    setFyEndDate(`${targetYear}-06-30`);
  }, []);

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const investmentsRef = useMemoFirebase(() => collection(firestore, "investmentInstruments"), [firestore]);
  const { data: investments, isLoading } = useCollection(investmentsRef);

  const accrualData = useMemo(() => {
    if (!investments || !fyEndDate) return [];
    const targetDate = parseISO(fyEndDate);
    return investments.filter(inv => inv.status === 'Active').map(inv => {
      const issueDate = parseISO(inv.issueDate);
      const days = Math.max(0, differenceInDays(targetDate, issueDate));
      const gross = (Number(inv.principalAmount) || 0) * (Number(inv.interestRate) || 0) * (days / 365);
      const tds = gross * TDS_RATE;
      return { ...inv, days, grossInterest: gross, tdsAmount: tds, accruedInterest: gross - tds, periodStart: inv.issueDate, periodEnd: fyEndDate };
    });
  }, [investments, fyEndDate, TDS_RATE]);

  const stats = useMemo(() => accrualData.reduce((acc, curr) => ({
    g: acc.g + curr.grossInterest, t: acc.t + curr.tdsAmount, n: acc.n + curr.accruedInterest
  }), { g: 0, t: 0, n: 0 }), [accrualData]);

  const handlePostProvisions = async () => {
    if (accrualData.length === 0) return;
    showAlert({
      title: "Post Provisions?",
      description: `Log year-end interest accruals (with ${(TDS_RATE * 100).toFixed(0)}% TDS) for ${accrualData.length} investments?`,
      type: "warning",
      showCancel: true,
      onConfirm: async () => {
        setIsPosting(true);
        const logsRef = collection(firestore, "accruedInterestLogs");
        const fy = fyEndDate.split('-')[0];
        for (const item of accrualData) {
          await addDocumentNonBlocking(logsRef, {
            investmentId: item.id, bankName: item.bankName, referenceNumber: item.referenceNumber,
            fiscalYear: `FY ${parseInt(fy)-1}-${fy.slice(-2)}`, periodStart: item.periodStart, periodEnd: item.periodEnd,
            days: item.days, principalAmount: item.principalAmount, interestRate: item.interestRate,
            grossInterest: Math.round(item.grossInterest), tdsAmount: Math.round(item.tdsAmount),
            accruedInterest: Math.round(item.accruedInterest), postedAt: new Date().toISOString()
          });
        }
        setIsPosting(false);
        showAlert({ title: "Success", description: "Provisions logged successfully.", type: "success" });
      }
    });
  };

  const exportToExcel = () => {
    if (accrualData.length === 0) return;
    const data = accrualData.map(item => ({
      "Bank Name": item.bankName,
      "Reference Number": item.referenceNumber,
      "Principal Amount": item.principalAmount,
      "Interest Rate (%)": (Number(item.interestRate) * 100).toFixed(2),
      "Period Start": item.periodStart,
      "Period End": item.periodEnd,
      "Days": item.days,
      "Gross Accrual": item.grossInterest.toFixed(2),
      [`TDS (${(TDS_RATE * 100).toFixed(0)}%)`]: item.tdsAmount.toFixed(2),
      "Net Provision": item.accruedInterest.toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Provisions");
    XLSX.writeFile(wb, `Interest_Provisions_${fyEndDate}.xlsx`);
    toast({ title: "Exported", description: "Provisions data saved to Excel." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/investments" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors group"><ArrowLeft className="size-6 text-slate-600 group-hover:text-primary" /></Link>
          <div className="flex flex-col gap-1"><h1 className="text-4xl font-black text-primary tracking-tight">Interest Provisions</h1><p className="text-lg font-bold text-slate-600 uppercase tracking-widest">Year-end Accrual Audit • {(TDS_RATE * 100).toFixed(0)}% TDS Deducted</p></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={accrualData.length === 0} className="gap-2 h-11 font-black border-emerald-200 text-emerald-700 hover:bg-emerald-50"><FileSpreadsheet className="size-5" /> Export Excel</Button>
          <Button onClick={() => window.print()} disabled={accrualData.length === 0} className="gap-2 h-11 font-black shadow-lg shadow-primary/20"><Printer className="size-5" /> Print Statement</Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row items-end gap-6 no-print">
        <div className="flex-1 space-y-2"><Label className="text-xs font-black uppercase text-slate-400 ml-1">FY End Target</Label><div className="relative"><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" /><Input type="date" value={fyEndDate} max="9999-12-31" onChange={(e) => setFyEndDate(e.target.value)} className="h-12 pl-10 text-lg font-black border-slate-200" /></div></div>
        <div className="bg-slate-50 p-4 rounded-2xl border flex items-center gap-3"><AlertCircle className="size-5 text-amber-600" /><p className="text-xs font-bold text-slate-600 leading-tight">Formula: (Gross - {(TDS_RATE * 100).toFixed(0)}% TDS). Accrual from Renew Date to June 30th.</p></div>
        <Button onClick={handlePostProvisions} disabled={isPosting || accrualData.length === 0} className="h-12 px-8 gap-2 font-black uppercase tracking-widest shadow-xl shadow-primary/30">{isPosting ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />} Post to Logs</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 no-print">
        <Card className="bg-primary/5 border-none shadow-sm rounded-3xl"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-primary tracking-widest opacity-70">Gross Accrual</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-900">৳ {stats.g.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></CardContent></Card>
        <Card className="bg-rose-50 border-none shadow-sm rounded-3xl"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-rose-600 tracking-widest opacity-70">TDS ({(TDS_RATE * 100).toFixed(0)}%)</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-rose-700">৳ {stats.t.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></CardContent></Card>
        <Card className="bg-emerald-50 border-none shadow-sm rounded-3xl"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-emerald-600 tracking-widest opacity-70">Net Provision</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-emerald-700">৳ {stats.n.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></CardContent></Card>
      </div>

      <div className="bg-card rounded-3xl shadow-2xl border overflow-hidden no-print">
        <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between"><h2 className="text-xl font-black flex items-center gap-3"><TrendingUp className="size-6 text-indigo-600" /> Accrual Matrix</h2><Badge variant="outline" className="bg-white border-slate-200 px-4 py-1 font-black uppercase text-[10px]">Basis: {fyEndDate}</Badge></div>
        <Table>
          <TableHeader><TableRow className="bg-muted/30"><TableHead className="font-black py-5 pl-6">Bank & Reference</TableHead><TableHead className="text-right font-black py-5">Gross Yield</TableHead><TableHead className="text-right font-black py-5 text-rose-600">TDS ({(TDS_RATE * 100).toFixed(0)}%)</TableHead><TableHead className="text-center font-black py-5">Days</TableHead><TableHead className="text-right font-black py-5 pr-6 text-primary">Net Provision</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-primary" /></TableCell></TableRow> : accrualData.map((item) => (
              <TableRow key={item.id} className="hover:bg-slate-50 border-b">
                <TableCell className="py-6 pl-6"><div className="flex flex-col"><span className="font-black text-slate-900 text-base">{item.bankName}</span><span className="font-mono text-[11px] text-muted-foreground font-bold uppercase">Ref: {item.referenceNumber}</span></div></TableCell>
                <td className="text-right p-4 font-bold">৳ {item.grossInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="text-right p-4 font-bold text-rose-600">৳ {item.tdsAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <TableCell className="text-center"><Badge variant="secondary" className="font-black">{item.days}d</Badge></TableCell>
                <TableCell className="text-right pr-6"><span className="font-black text-xl text-primary">৳ {item.accruedInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-slate-900 text-white font-black"><TableRow><TableCell colSpan={4} className="text-right uppercase tracking-widest text-sm py-6">Consolidated Net Accrual:</TableCell><TableCell className="text-right pr-6 py-6"><span className="text-2xl underline decoration-double">৳ {stats.n.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></TableCell></TableRow></TableFooter>
        </Table>
      </div>

      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-widest text-slate-700">Contributory Provident Fund</p>
          <h2 className="text-lg font-bold underline underline-offset-4 uppercase">Investment Interest Provision Statement</h2>
          <div className="flex justify-between text-[10px] font-bold pt-4">
            <span>Fiscal Year Cut-off: {fyEndDate}</span>
            <span>Tax Basis: {(TDS_RATE * 100).toFixed(0)}% TDS</span>
          </div>
        </div>

        <table className="w-full text-[9px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-2 text-left">Bank & Instrument Details</th>
              <th className="border border-black p-2 text-right">Principal</th>
              <th className="border border-black p-2 text-center">Days</th>
              <th className="border border-black p-2 text-right">Gross Interest</th>
              <th className="border border-black p-2 text-right">TDS ({(TDS_RATE * 100).toFixed(0)}%)</th>
              <th className="border border-black p-2 text-right font-black">Net Accrual</th>
            </tr>
          </thead>
          <tbody>
            {accrualData.map((item, i) => (
              <tr key={i}>
                <td className="border border-black p-2">
                  <span className="font-bold">{item.bankName}</span><br/>
                  <span className="text-[7px] font-mono">REF: {item.referenceNumber} • Issue: {item.issueDate}</span>
                </td>
                <td className="border border-black p-2 text-right">{Number(item.principalAmount).toLocaleString()}</td>
                <td className="border border-black p-2 text-center">{item.days}</td>
                <td className="border border-black p-2 text-right">{item.grossInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="border border-black p-2 text-right">{item.tdsAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="border border-black p-2 text-right font-bold">{item.accruedInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black">
              <td colSpan={3} className="border border-black p-2 text-right uppercase">Consolidated Totals:</td>
              <td className="border border-black p-2 text-right">{stats.g.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td className="border border-black p-2 text-right">{stats.t.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td className="border border-black p-2 text-right underline decoration-double">৳ {stats.n.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
          <div className="border-t border-black pt-2 uppercase">Prepared by</div>
          <div className="border-t border-black pt-2 uppercase">Checked by</div>
          <div className="border-t border-black pt-2 uppercase">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
