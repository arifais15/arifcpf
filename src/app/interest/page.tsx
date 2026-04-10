
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
  X
} from "lucide-react";
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  addDocumentNonBlocking 
} from "@/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
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

export default function CPFInterestPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
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
  const [selectedFY, setSelectedFY] = useState<string>(fyOptions[1] || ""); 
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [viewingDetails, setViewingDetails] = useState<any | null>(null);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const calculateTieredAnnual = (balance: number) => {
    let annualInterest = 0;
    if (balance <= 1500000) {
      annualInterest = balance * 0.13;
    } else if (balance <= 3000000) {
      annualInterest = (1500000 * 0.13) + ((balance - 1500000) * 0.12);
    } else {
      annualInterest = (1500000 * 0.13) + (1500000 * 0.12) + ((balance - 3000000) * 0.11);
    }
    return annualInterest;
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

      // Current State for proportionality
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
        
        // Month 1 basis: day before start
        const opening = new Date(start);
        opening.setDate(opening.getDate() - 1);
        opening.setHours(23, 59, 59, 999);
        basisDates.push(opening);

        // Subsequent months
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

      results.push({
        memberId: member.id,
        memberIdNumber: member.memberIdNumber,
        name: member.name,
        calculatedInterest: totalInterest,
        employeeFund: finalEmployeeFund,
        officeFund: finalOfficeFund,
        isPosted: isAlreadyPosted,
        monthlyDetails: monthlyBreakdown
      });

      setProgress(Math.round(((i + 1) / members.length) * 100));
    }

    setPreviewData(results);
    setIsCalculating(false);
    toast({ title: "Audit Complete", description: `Computed tiered profit for ${results.length} members.` });
  };

  const handlePostAllInterest = async () => {
    if (previewData.length === 0) return;
    
    const unpostedItems = previewData.filter(item => !item.isPosted);
    if (unpostedItems.length === 0) {
      toast({ title: "No Action Needed", description: "Records for this period already synchronized." });
      return;
    }

    setIsPosting(true);
    let postedCount = 0;
    const modeLabel = calculationMode === 'fy' ? `FY ${selectedFY}` : `Custom Range`;

    let summaryDate = "";
    if (calculationMode === 'fy') {
      const [startYearStr] = selectedFY.split("-");
      summaryDate = `${parseInt(startYearStr) + 1}-06-30`;
    } else {
      summaryDate = customRange.end;
    }

    for (const item of unpostedItems) {
      if (item.calculatedInterest <= 0) continue;

      const totalFund = item.employeeFund + item.officeFund;
      let employeeProfit = 0;
      let pbsProfit = 0;

      if (totalFund > 0) {
        employeeProfit = (item.calculatedInterest * item.employeeFund) / totalFund;
        pbsProfit = (item.calculatedInterest * item.officeFund) / totalFund;
      } else {
        employeeProfit = item.calculatedInterest / 2;
        pbsProfit = item.calculatedInterest / 2;
      }

      const entryData = {
        summaryDate,
        particulars: `Annual Profit ${modeLabel} (Tiered)`,
        employeeContribution: 0,
        loanWithdrawal: 0,
        loanRepayment: 0,
        profitEmployee: employeeProfit,
        profitLoan: 0,
        pbsContribution: 0,
        profitPbs: pbsProfit,
        lastUpdateDate: new Date().toISOString(),
        memberId: item.memberId
      };

      const summariesRef = collection(firestore, "members", item.memberId, "fundSummaries");
      addDocumentNonBlocking(summariesRef, entryData);
      postedCount++;
    }

    setIsPosting(false);
    setPreviewData([]);
    toast({ title: "Posting Complete", description: `Successfully recorded profit for ${postedCount} members.` });
  };

  const totalCPFProfit = useMemo(() => {
    return previewData.reduce((sum, item) => sum + item.calculatedInterest, 0);
  }, [previewData]);

  const hasUnpostedEntries = useMemo(() => {
    return previewData.some(item => !item.isPosted && item.calculatedInterest > 0);
  }, [previewData]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
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

      <div className="grid gap-6 md:grid-cols-3">
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
        <div className="space-y-3 max-w-md mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary opacity-70">Auditing Real-time Ledger Balances...</p>
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] font-medium text-muted-foreground">{progress}% Complete</p>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="bg-card rounded-xl shadow-lg border overflow-hidden">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
              Accrual Audit Preview - {calculationMode === 'fy' ? `FY ${selectedFY}` : `Custom Range`}
            </h2>
            <Button 
              onClick={handlePostAllInterest} 
              disabled={isPosting || !hasUnpostedEntries} 
              className={cn("gap-2 font-bold uppercase text-xs h-9 px-6", hasUnpostedEntries ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20" : "bg-slate-400")}
            >
              {isPosting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Synchronize Ledger (June 30)
            </Button>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow className="border-b">
                  <TableHead className="text-[10px] uppercase font-bold py-4">Member ID</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold py-4">Name</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold py-4">Computed Profit (৳)</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-bold py-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((item) => (
                  <TableRow key={item.memberId} className={cn(item.isPosted ? "opacity-60 bg-slate-50" : "hover:bg-slate-50/50")}>
                    <TableCell className="font-mono text-xs font-bold">{item.memberIdNumber}</TableCell>
                    <TableCell className="text-xs font-semibold">{item.name}</TableCell>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Audit Profit</p>
                <p className="text-2xl font-black text-primary">৳ {viewingDetails?.calculatedInterest?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Current Ledger Status</p>
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
