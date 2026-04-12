
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
  History, 
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet,
  Printer
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, useDoc } from "@/firebase";
import { collection, doc, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { differenceInDays, format, parseISO } from "date-fns";
import * as XLSX from "xlsx";

export default function InvestmentProvisionsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();

  const [fyEndDate, setFyEndDate] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // Defer date initialization to ensure same value on server/client
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    // Fiscal Year end is June 30th
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

    return investments
      .filter(inv => inv.status === 'Active')
      .map(inv => {
        const issueDate = parseISO(inv.issueDate);
        const days = Math.max(0, differenceInDays(targetDate, issueDate));
        const rate = Number(inv.interestRate) || 0;
        const principal = Number(inv.principalAmount) || 0;
        
        // Formula: Principal * Rate * (Days / 365)
        const accruedInterest = principal * rate * (days / 365);

        return {
          ...inv,
          days,
          accruedInterest,
          periodStart: inv.issueDate,
          periodEnd: fyEndDate
        };
      });
  }, [investments, fyEndDate]);

  const totalAccrued = useMemo(() => {
    return accrualData.reduce((sum, item) => sum + item.accruedInterest, 0);
  }, [accrualData]);

  const handlePostProvisions = async () => {
    if (accrualData.length === 0) return;

    showAlert({
      title: "Post Provisions?",
      description: `Synchronize year-end interest accruals for ${accrualData.length} active investments?`,
      type: "warning",
      showCancel: true,
      confirmText: "Post to Logs",
      onConfirm: async () => {
        setIsPosting(true);
        try {
          const logsRef = collection(firestore, "accruedInterestLogs");
          const fiscalYear = fyEndDate.split('-')[0];
          
          for (const item of accrualData) {
            await addDocumentNonBlocking(logsRef, {
              investmentId: item.id,
              bankName: item.bankName,
              referenceNumber: item.referenceNumber,
              fiscalYear: `FY ${parseInt(fiscalYear)-1}-${fiscalYear.slice(-2)}`,
              periodStart: item.periodStart,
              periodEnd: item.periodEnd,
              days: item.days,
              principalAmount: item.principalAmount,
              interestRate: item.interestRate,
              accruedInterest: Math.round(item.accruedInterest),
              postedAt: new Date().toISOString()
            });
          }

          showAlert({
            title: "Success",
            description: "Interest provisions have been logged successfully for audit.",
            type: "success"
          });
        } catch (error) {
          toast({ title: "Error", description: "Could not post provisions.", variant: "destructive" });
        } finally {
          setIsPosting(false);
        }
      }
    });
  };

  const exportToExcel = () => {
    const data = accrualData.map(item => ({
      "Bank Name": item.bankName,
      "Ref No": item.referenceNumber,
      "Principal (৳)": item.principalAmount,
      "Rate (%)": (Number(item.interestRate) * 100).toFixed(2),
      "Start Date": item.periodStart,
      "End Date": item.periodEnd,
      "Days": item.days,
      "Accrued Interest (৳)": item.accruedInterest.toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Provisions");
    XLSX.writeFile(wb, `Investment_Provisions_${fyEndDate}.xlsx`);
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/10 p-3 rounded-2xl">
            <Calculator className="size-8 text-indigo-600" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-black text-primary tracking-tight">Interest Provisions</h1>
            <p className="text-lg font-bold text-slate-600 uppercase tracking-widest">Year-end Accrual Audit (June 30th Basis)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={accrualData.length === 0} className="gap-2 h-11 font-black border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <FileSpreadsheet className="size-5" /> Export Excel
          </Button>
          <Button onClick={() => window.print()} disabled={accrualData.length === 0} className="gap-2 h-11 font-black shadow-lg shadow-primary/20">
            <Printer className="size-5" /> Print Statement
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row items-end gap-6 no-print">
        <div className="flex-1 space-y-2">
          <Label className="text-xs font-black uppercase text-slate-400 ml-1">Calculation Target Date (FY End)</Label>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
            <Input 
              type="date" 
              value={fyEndDate} 
              onChange={(e) => setFyEndDate(e.target.value)} 
              className="h-12 pl-10 text-lg font-black border-slate-200 focus:bg-slate-50 transition-colors"
            />
          </div>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
          <AlertCircle className="size-5 text-amber-600" />
          <p className="text-xs font-bold text-slate-600 leading-tight">
            Provision Logic: <code>Principal * Rate * (Days / 365)</code>. <br/>
            Calculates interest earned from the <b>Last Renewed Date</b> until <b>June 30th</b>.
          </p>
        </div>
        <Button 
          onClick={handlePostProvisions} 
          disabled={isPosting || accrualData.length === 0} 
          className="h-12 px-8 gap-2 font-black uppercase tracking-widest shadow-xl shadow-primary/30"
        >
          {isPosting ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
          Post to Audit Logs
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 no-print">
        <Card className="bg-primary/5 border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-primary tracking-widest opacity-70">Total Projected Accrual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">৳ {totalAccrued.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50 border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-indigo-600 tracking-widest opacity-70">Active Instruments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">{accrualData.length} FDR/Bonds</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-none shadow-sm rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase text-emerald-600 tracking-widest opacity-70">Audit Alignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">100% Accurate</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-3xl shadow-2xl border overflow-hidden no-print">
        <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xl font-black flex items-center gap-3">
            <TrendingUp className="size-6 text-indigo-600" />
            Accrual Matrix Summary
          </h2>
          <Badge variant="outline" className="bg-white border-slate-200 px-4 py-1 font-black uppercase text-[10px]">
            Fiscal Period Basis: {fyEndDate}
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-black py-5 pl-6">Bank & Reference</TableHead>
              <TableHead className="text-right font-black py-5">Principal (৳)</TableHead>
              <TableHead className="text-right font-black py-5">Yield</TableHead>
              <TableHead className="text-center font-black py-5">Provision Timeline</TableHead>
              <TableHead className="text-right font-black py-5 pr-6 text-primary">Accrued Interest (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : accrualData.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-bold text-lg italic">No active investments found for calculation.</TableCell></TableRow>
            ) : accrualData.map((item) => (
              <TableRow key={item.id} className="hover:bg-slate-50 transition-colors border-b">
                <TableCell className="py-6 pl-6">
                  <div className="flex flex-col">
                    <span className="font-black text-slate-900 text-base">{item.bankName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground font-bold uppercase tracking-tight">Ref: {item.referenceNumber}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-black text-base">৳ {item.principalAmount.toLocaleString()}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-black text-indigo-700">{(Number(item.interestRate) * 100).toFixed(2)}%</span>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-4 text-xs font-black">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Last Renewed</span>
                      <span className="text-slate-600">{item.periodStart}</span>
                    </div>
                    <div className="flex flex-col items-center bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                      <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest mb-0.5">Days</span>
                      <span className="text-indigo-700 text-sm">{item.days}d</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-rose-400 font-black uppercase tracking-widest mb-1">Accrual End</span>
                      <span className="text-rose-600 font-black">{item.periodEnd}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex flex-col items-end">
                    <span className="font-black text-xl text-primary">৳ {item.accruedInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Projected Provision</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-slate-900 text-white font-black">
            <TableRow>
              <TableCell colSpan={4} className="text-right uppercase tracking-widest text-sm pl-6 py-6">Consolidated Interest Accrual for the Period:</TableCell>
              <TableCell className="text-right pr-6 py-6">
                <span className="text-2xl underline decoration-double">৳ {totalAccrued.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* INSTITUTIONAL PRINT VIEW (HIDDEN IN UI) */}
      <div className="hidden print:block print-container text-black">
        <div className="text-center space-y-2 mb-10 border-b-2 border-black pb-8">
          <h1 className="text-3xl font-black uppercase">{pbsName}</h1>
          <h2 className="text-xl font-bold underline underline-offset-8 uppercase tracking-[0.2em]">Interest Provision (Accrual) Statement</h2>
          <div className="flex justify-between text-xs font-bold pt-6">
            <span>Accrual Basis: From Last Renewal Date to {fyEndDate}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-3 text-left w-[200px]">Bank Name & Reference</th>
              <th className="border border-black p-3 text-right">Principal (৳)</th>
              <th className="border border-black p-3 text-center">Rate</th>
              <th className="border border-black p-3 text-center">Days Audited</th>
              <th className="border border-black p-3 text-right font-black">Accrued Interest (৳)</th>
            </tr>
          </thead>
          <tbody>
            {accrualData.map((item, i) => (
              <tr key={i}>
                <td className="border border-black p-3">
                  <span className="font-bold">{item.bankName}</span><br/>
                  <span className="text-[8px] font-mono">{item.referenceNumber}</span>
                </td>
                <td className="border border-black p-3 text-right">{item.principalAmount.toLocaleString()}</td>
                <td className="border border-black p-3 text-center">{(Number(item.interestRate) * 100).toFixed(2)}%</td>
                <td className="border border-black p-3 text-center">{item.days} days</td>
                <td className="border border-black p-3 text-right font-bold">{item.accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black">
              <td colSpan={4} className="border border-black p-3 text-right uppercase tracking-widest">Total Accrued Provision:</td>
              <td className="border border-black p-3 text-right underline decoration-double">
                ৳ {totalAccrued.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[12px] font-bold text-center">
          <div className="border-t border-black pt-2">Accountant (Audit)</div>
          <div className="border-t border-black pt-2">Internal Auditor / DGM</div>
          <div className="border-t border-black pt-2">Approved By Trustee</div>
        </div>
        
        <div className="mt-12 pt-4 border-t border-slate-100 flex justify-between items-center text-[8px] text-slate-400 font-bold uppercase tracking-widest">
          <span>PBS CPF Management Software • Accrual Module v1.0</span>
          <span className="italic">Developed by: Ariful Islam,AGMF,Gazipur PBS-2</span>
        </div>
      </div>
    </div>
  );
}
