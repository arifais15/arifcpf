
"use client"

import { useState, useMemo, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Percent, 
  Loader2, 
  CheckCircle2, 
  Calculator, 
  Calendar, 
  ArrowRight,
  Info,
  AlertCircle,
  ShieldCheck,
  ArrowRightLeft,
  X,
  FileSpreadsheet,
  Printer,
  Download
} from "lucide-react";
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  addDocumentNonBlocking,
  useDoc
} from "@/firebase";
import { collection, getDocs, query, orderBy, doc } from "firebase/firestore";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

export default function CPFInterestPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  // Fetch Interest Settings
  const interestSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "interest"), [firestore]);
  const { data: interestSettings } = useDoc(interestSettingsRef);

  const interestTiers = useMemo(() => {
    if (interestSettings?.tiers) return interestSettings.tiers;
    // Default fallback
    return [
      { limit: 1500000, rate: 0.13 },
      { limit: 3000000, rate: 0.12 },
      { limit: null, rate: 0.11 }
    ];
  }, [interestSettings]);

  // Dynamically generate Fiscal Year options
  const fyOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const activeFYStart = currentMonth >= 7 ? currentYear : currentYear - 1;
    
    for (let year = activeFYStart + 1; year >= 2015; year--) {
      const start = year;
      const end = (year + 1).toString().slice(-2);
      options.push(`${start}-${end}`);
    }
    return options;
  }, []);

  const [calculationMode, setCalculationMode] = useState<"fy" | "custom">("fy");
  const [selectedFY, setSelectedFY] = useState<string>(""); 
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [postingDate, setPostingDate] = useState("");
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [viewingDetails, setViewingDetails] = useState<any | null>(null);

  // Defer date initialization to avoid hydration errors
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    
    setCustomRange({ start: fyStart, end: today });
    if (fyOptions.length > 1) {
      setSelectedFY(fyOptions[1]);
    } else if (fyOptions.length > 0) {
      setSelectedFY(fyOptions[0]);
    }
  }, [fyOptions]);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const calculateTieredAnnual = (balance: number) => {
    let totalInterest = 0;
    let remainingBalance = balance;
    let prevLimit = 0;

    for (const tier of interestTiers) {
      if (remainingBalance <= 0) break;

      if (tier.limit === null) {
        totalInterest += remainingBalance * tier.rate;
        break;
      } else {
        const tierCapacity = tier.limit - prevLimit;
        const amountInTier = Math.min(remainingBalance, tierCapacity);
        totalInterest += amountInTier * tier.rate;
        remainingBalance -= amountInTier;
        prevLimit = tier.limit;
      }
    }
    return totalInterest;
  };

  const handleRunCPFCalculation = async () => {
    if (!members) return;
    
    if (calculationMode === 'custom' && (!customRange.start || !customRange.end)) {
      toast({ title: "Dates Required", description: "Please select start and end dates.", variant: "destructive" });
      return;
    }

    setIsCalculating(true);
    setPreviewData([]);
    setProgress(0);

    // Set suggested posting date
    if (calculationMode === 'fy') {
      const [startYearStr] = selectedFY.split("-");
      setPostingDate(`${parseInt(startYearStr) + 1}-06-30`);
    } else {
      setPostingDate(customRange.end);
    }

    const results = [];
    const modeLabel = calculationMode === 'fy' ? `FY ${selectedFY}` : `Custom Range`;

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      
      const summariesRef = collection(firestore, "members", member.id, "fundSummaries");
      const q = query(summariesRef, orderBy("summaryDate", "asc"));
      const snapshot = await getDocs(q);
      const summaries = snapshot.docs.map(doc => doc.data());

      const isAlreadyPosted = summaries.some(s => 
        s.particulars?.includes(`Annual Profit ${modeLabel}`)
      );

      let totalInterest = 0;
      let finalEmployeeFund = 0;
      let finalOfficeFund = 0;

      summaries.forEach((row: any) => {
        const c1 = Number(row.employeeContribution) || 0;
        const c2 = Number(row.loanWithdrawal) || 0;
        const c3 = Number(row.loanRepayment) || 0;
        const c5 = Number(row.profitEmployee) || 0;
        const c6 = Number(row.profitLoan) || 0;
        const c8 = Number(row.pbsContribution) || 0;
        const c9 = Number(row.profitPbs) || 0;

        finalEmployeeFund += (c1 - c2 + c3 + c5 + c6);
        finalOfficeFund += (c8 + c9);
      });

      let monthsToCalculate = 0;
      const basisDates: Date[] = [];

      if (calculationMode === 'fy') {
        const [startYearStr] = selectedFY.split("-");
        const startYear = parseInt(startYearStr);
        monthsToCalculate = 12;
        for (let m = 0; m < 12; m++) {
          let mIdx, yr;
          if (m === 0) {
            mIdx = 5; yr = startYear; // June (Prior Year Opening)
          } else {
            mIdx = (m + 5) % 12;
            yr = m < 7 ? startYear : startYear + 1;
          }
          basisDates.push(new Date(yr, mIdx + 1, 0, 23, 59, 59, 999));
        }
      } else {
        const start = new Date(customRange.start);
        const end = new Date(customRange.end);
        monthsToCalculate = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
        
        const opening = new Date(start);
        opening.setDate(opening.getDate() - 1);
        opening.setHours(23, 59, 59, 999);
        basisDates.push(opening);

        for (let m = 0; m < monthsToCalculate - 1; m++) {
          const next = new Date(start.getFullYear(), start.getMonth() + m + 1, 0, 23, 59, 59, 999);
          basisDates.push(next);
        }
      }

      const monthlyBreakdown = [];
      for (const targetDate of basisDates) {
        let runningBalanceBasis = 0;
        summaries.forEach((row: any) => {
          const rowDate = new Date(row.summaryDate);
          if (rowDate <= targetDate) {
            const val = (Number(row.employeeContribution) || 0) - (Number(row.loanWithdrawal) || 0) + (Number(row.loanRepayment) || 0) + 
                        (Number(row.profitEmployee) || 0) + (Number(row.profitLoan) || 0) + (Number(row.pbsContribution) || 0) + (Number(row.profitPbs) || 0);
            runningBalanceBasis += val;
          }
        });
        const monthlyPortion = calculateTieredAnnual(runningBalanceBasis) / 12;
        totalInterest += monthlyPortion;
        
        monthlyBreakdown.push({
          label: targetDate.toLocaleDateString('default', { month: 'short', year: 'numeric' }),
          dateStr: targetDate.toISOString().split('T')[0],
          isOpening: targetDate.getDate() !== 31 && targetDate.getMonth() === 5 && calculationMode === 'fy',
          balance: runningBalanceBasis,
          interest: monthlyPortion
        });
      }

      const totalFundAtEnd = finalEmployeeFund + finalOfficeFund;
      let employeeProfit = 0;
      let pbsProfit = 0;

      if (totalFundAtEnd > 0) {
        employeeProfit = (totalInterest * finalEmployeeFund) / totalFundAtEnd;
        pbsProfit = (totalInterest * finalOfficeFund) / totalFundAtEnd;
      } else {
        employeeProfit = totalInterest / 2;
        pbsProfit = totalInterest / 2;
      }

      results.push({
        memberId: member.id,
        memberIdNumber: member.memberIdNumber,
        name: member.name,
        designation: member.designation || "N/A",
        calculatedInterest: totalInterest,
        employeeProfit,
        pbsProfit,
        employeeFund: finalEmployeeFund,
        officeFund: finalOfficeFund,
        isPosted: isAlreadyPosted,
        monthlyDetails: monthlyBreakdown
      });

      setProgress(Math.round(((i + 1) / members.length) * 100));
    }

    setPreviewData(results);
    setIsCalculating(false);
    toast({ title: "Audit Complete", description: `Computed tiered profit for ${results.length} active members.` });
  };

  const handlePostAllInterest = async () => {
    if (previewData.length === 0 || !postingDate) {
      toast({ title: "Date Required", description: "Please select a ledger posting date.", variant: "destructive" });
      return;
    }
    
    const unpostedItems = previewData.filter(item => !item.isPosted);
    if (unpostedItems.length === 0) {
      toast({ title: "No Action Needed", description: "Records for this period already synchronized." });
      return;
    }

    setIsPosting(true);
    let postedCount = 0;
    const modeLabel = calculationMode === 'fy' ? `FY ${selectedFY}` : `Custom Range`;

    for (const item of unpostedItems) {
      if (item.calculatedInterest <= 0) continue;

      const entryData = {
        summaryDate: postingDate,
        particulars: `Annual Profit ${modeLabel} (Tiered)`,
        employeeContribution: 0,
        loanWithdrawal: 0,
        loanRepayment: 0,
        profitEmployee: Math.round(item.employeeProfit),
        profitLoan: 0,
        pbsContribution: 0,
        profitPbs: Math.round(item.pbsProfit),
        lastUpdateDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        memberId: item.memberId
      };

      const summariesRef = collection(firestore, "members", item.memberId, "fundSummaries");
      addDocumentNonBlocking(summariesRef, entryData);
      postedCount++;
    }

    setIsPosting(false);
    setPreviewData([]);
    toast({ title: "Posting Complete", description: `Successfully recorded profit for ${postedCount} active members.` });
  };

  const exportToExcel = () => {
    if (previewData.length === 0) return;

    const exportRows = previewData.map(item => ({
      "Member ID": item.memberIdNumber,
      "Name": item.name,
      "Designation": item.designation,
      "Profit on Employee Contribution": item.employeeProfit.toFixed(2),
      "Profit on PBS Contribution": item.pbsProfit.toFixed(2),
      "Total Profit": item.calculatedInterest.toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Interest Calculation");
    
    const fileName = calculationMode === 'fy' 
      ? `CPF_Profit_Audit_FY_${selectedFY}.xlsx` 
      : `CPF_Profit_Audit_${customRange.start}_to_${customRange.end}.xlsx`;
      
    XLSX.writeFile(wb, fileName);
    toast({ title: "Exported", description: "Interest calculation data exported to Excel." });
  };

  const totalCPFProfit = useMemo(() => {
    return previewData.reduce((sum, item) => sum + item.calculatedInterest, 0);
  }, [previewData]);

  const hasUnpostedEntries = useMemo(() => {
    return previewData.some(item => !item.isPosted && item.calculatedInterest > 0);
  }, [previewData]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      {/* Print View Container (Hidden in UI) */}
      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <h2 className="text-lg font-bold underline underline-offset-4">CPF Interest Accrual Audit Report</h2>
          <div className="flex justify-between text-xs font-bold pt-4">
            <span>Basis: {calculationMode === 'fy' ? `Fiscal Year ${selectedFY}` : `Custom Range: ${customRange.start} to ${customRange.end}`}</span>
            <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-black p-2 text-center w-[80px]">Member ID</th>
              <th className="border border-black p-2 text-left">Name</th>
              <th className="border border-black p-2 text-left">Designation</th>
              <th className="border border-black p-2 text-right">Profit (Emp) ৳</th>
              <th className="border border-black p-2 text-right">Profit (PBS) ৳</th>
              <th className="border border-black p-2 text-right">Total Profit ৳</th>
            </tr>
          </thead>
          <tbody>
            {previewData.map((item) => (
              <tr key={item.memberId}>
                <td className="border border-black p-2 text-center font-mono">{item.memberIdNumber}</td>
                <td className="border border-black p-2 font-bold">{item.name}</td>
                <td className="border border-black p-2">{item.designation}</td>
                <td className="border border-black p-2 text-right">{item.employeeProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border border-black p-2 text-right">{item.pbsProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border border-black p-2 text-right font-black">{item.calculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black">
              <td colSpan={3} className="border border-black p-2 text-right uppercase">Grand Totals:</td>
              <td className="border border-black p-2 text-right">{previewData.reduce((s, i) => s + i.employeeProfit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border border-black p-2 text-right">{previewData.reduce((s, i) => s + i.pbsProfit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border border-black p-2 text-right underline decoration-double">৳ {totalCPFProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
          <div className="border-t border-black pt-2">Accountant / AGM(F)</div>
          <div className="border-t border-black pt-2">Internal Auditor / DGM</div>
          <div className="border-t border-black pt-2">Approved By Trustee</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">CPF Interest Accrual</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Rule: Opening Balance Focused + 11 Monthly Closing Balances (Captures Last-Day Entries)</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-3 rounded-2xl border shadow-sm">
          <Tabs value={calculationMode} onValueChange={(v: any) => setCalculationMode(v)} className="w-full sm:w-auto">
            <TabsList className="bg-slate-100 p-1 h-9">
              <TabsTrigger value="fy" className="text-xs px-4">Fiscal Year</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs px-4">Custom Range</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {calculationMode === 'fy' ? (
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <Select value={selectedFY} onValueChange={setSelectedFY}>
                <SelectTrigger className="w-[140px] border-none shadow-none font-bold focus:ring-0">
                  <SelectValue placeholder="Fiscal Year" />
                </SelectTrigger>
                <SelectContent>
                  {fyOptions.map(fy => <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-bold text-slate-400">Start</Label>
                <Input type="date" value={customRange.start} onChange={(e) => setCustomRange({...customRange, start: e.target.value})} className="h-8 text-xs border-none shadow-none p-0 focus-visible:ring-0" />
              </div>
              <ArrowRightLeft className="size-3 text-slate-300 mt-3" />
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-bold text-slate-400">End</Label>
                <Input type="date" value={customRange.end} onChange={(e) => setCustomRange({...customRange, end: e.target.value})} className="h-8 text-xs border-none shadow-none p-0 focus-visible:ring-0" />
              </div>
            </div>
          )}

          <Button onClick={handleRunCPFCalculation} disabled={isCalculating || isPosting || isMembersLoading} className="gap-2 font-bold uppercase text-xs tracking-widest h-9 px-6 shadow-md shadow-primary/20">
            {isCalculating ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            Run Profit Audit
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 no-print">
        <Card className="border-none shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest opacity-60">Subsidiary Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length || 0} Members Registry</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-accent tracking-widest opacity-60">Audit Computed Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳ {totalCPFProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-emerald-600 tracking-widest opacity-60">Synchronization Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {previewData.length > 0 ? (
                hasUnpostedEntries ? (
                  <span className="text-orange-600 flex items-center gap-1">Pending Sync</span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1">Verified & Posted</span>
                )
              ) : (
                <span className="text-slate-300">Ready</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isCalculating && (
        <div className="space-y-3 max-w-md mx-auto text-center no-print">
          <div className="p-4 bg-slate-900 rounded-2xl border border-white/10 shadow-2xl mb-4">
            <p className="text-xs font-black uppercase tracking-widest text-primary mb-2 flex items-center justify-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              Auditing Institutional Volume...
            </p>
            <Progress value={progress} className="h-2 bg-white/10" />
            <p className="text-[10px] font-bold text-slate-400 mt-2">{progress}% COMPLETE • PROCESSING PERSONNEL {Math.round((progress/100) * (members?.length || 0))}/{members?.length}</p>
          </div>
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-start gap-2 text-left">
            <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[9px] text-amber-700 leading-tight">
              <b>Performance Tip:</b> Large datasets (800+ members) require a few minutes. Please keep this tab active until the audit completes. To speed up future audits, ensure all prior years have an "Opening Balance" entry.
            </p>
          </div>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
          <div className="p-4 bg-slate-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                Accrual Audit Preview - {calculationMode === 'fy' ? `FY ${selectedFY}` : `Custom Range`}
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToExcel} className="h-8 gap-2 font-bold text-[10px] border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  <FileSpreadsheet className="size-3.5" /> Export Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 gap-2 font-bold text-[10px] border-slate-300">
                  <Printer className="size-3.5" /> Print Audit Report
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
              <div className="flex flex-col gap-0.5">
                <Label className="text-[9px] uppercase font-bold text-slate-400">Ledger Posting Date</Label>
                <Input 
                  type="date" 
                  value={postingDate} 
                  onChange={(e) => setPostingDate(e.target.value)} 
                  className="h-7 text-[10px] border-none shadow-none p-0 focus-visible:ring-0 font-bold" 
                />
              </div>
              <div className="h-6 w-px bg-slate-100" />
              <Button 
                onClick={handlePostAllInterest} 
                disabled={isPosting || !hasUnpostedEntries || !postingDate} 
                className={cn("gap-2 font-bold uppercase text-xs h-8 px-4", hasUnpostedEntries && postingDate ? "bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20" : "bg-slate-400")}
              >
                {isPosting ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
                Synchronize Ledger
              </Button>
            </div>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow className="border-b">
                  <TableHead className="text-[10px] uppercase font-bold py-4">Member ID</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold py-4">Name & Designation</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold py-4">Profit (Emp) ৳</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold py-4">Profit (PBS) ৳</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold py-4">Total Profit (৳)</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-bold py-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((item) => (
                  <TableRow key={item.memberId} className={cn(item.isPosted ? "opacity-60 bg-slate-50" : "hover:bg-slate-50/50")}>
                    <TableCell className="font-mono text-xs font-bold">{item.memberIdNumber}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{item.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">{item.designation}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {item.employeeProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {item.pbsProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell 
                      className="text-right font-black text-accent cursor-pointer hover:bg-accent/5 transition-colors group"
                      onClick={() => setViewingDetails(item)}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span>৳ {item.calculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <Info className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {item.isPosted ? (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-[9px] uppercase">Posted to Ledger</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] uppercase">Audit Verified</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Detail Breakdown Dialog */}
      <Dialog open={!!viewingDetails} onOpenChange={(open) => !open && setViewingDetails(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto font-ledger">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-bold uppercase tracking-tight">
              <Calculator className="size-6 text-primary" />
              Profit Audit Breakdown
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500 text-[11px] uppercase tracking-widest">
              {viewingDetails?.name} ({viewingDetails?.memberIdNumber}) • {calculationMode === 'fy' ? `FY ${selectedFY}` : `Custom Range`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Audit Profit</p>
                <p className="text-xl font-black text-primary">৳ {viewingDetails?.calculatedInterest?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Profit Split (Emp / PBS)</p>
                <div className="flex flex-col text-xs font-bold text-slate-700">
                  <span>Emp: ৳{viewingDetails?.employeeProfit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span>PBS: ৳{viewingDetails?.pbsProfit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {viewingDetails?.isPosted ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 uppercase text-[9px]">Already Synchronized</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 uppercase text-[9px]">Pending Ledger Post</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase py-3">Audit Basis Month</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase py-3">Basis Balance (৳)</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase py-3">1/12th Profit Portion (৳)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingDetails?.monthlyDetails?.map((month: any, idx: number) => (
                    <TableRow key={idx} className={cn(month.isOpening && "bg-blue-50/50")}>
                      <TableCell className="text-xs font-semibold py-3 flex items-center gap-2">
                        {month.label}
                        {month.isOpening && <Badge variant="secondary" className="text-[8px] h-4 uppercase px-1">Opening Balance</Badge>}
                      </TableCell>
                      <td className="p-3 text-right font-mono text-xs">
                        {month.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700 font-mono text-xs">
                        {month.interest.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot className="bg-slate-50 border-t-2 font-black">
                  <tr>
                    <td className="p-3 text-right text-[10px] uppercase">Computed Fiscal Profit:</td>
                    <td colSpan={2} className="p-3 text-right text-primary text-sm">
                      ৳ {viewingDetails?.calculatedInterest?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
              <ShieldCheck className="size-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Audit Logic Verification</p>
                <p className="text-[11px] leading-relaxed text-blue-600">
                  This tiered profit is computed by aggregating 12 audit snapshots. Each snapshot captures the total cumulative fund value at the end of the basis month (Opening Balance + 11 monthly closings). The final amount represents the weighted annual profit share of the member based on their real-time ledger contributions.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
