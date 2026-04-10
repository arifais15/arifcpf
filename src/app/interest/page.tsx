
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
  ShieldCheck
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

  const [selectedFY, setSelectedFY] = useState<string>(fyOptions[1] || ""); 
  const [isCalculating, setIsCalculating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);

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
    setIsCalculating(true);
    setPreviewData([]);
    setProgress(0);

    const [startYearStr] = selectedFY.split("-");
    const startYear = parseInt(startYearStr);
    const results = [];

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const summariesRef = collection(firestore, "members", member.id, "fundSummaries");
      const q = query(summariesRef, orderBy("summaryDate", "asc"));
      const snapshot = await getDocs(q);
      const summaries = snapshot.docs.map(doc => doc.data());

      const isAlreadyPosted = summaries.some(s => 
        s.particulars?.includes(`Annual Profit FY ${selectedFY}`)
      );

      let totalInterest = 0;
      let finalEmployeeFund = 0;
      let finalOfficeFund = 0;

      // 1. Final state for proportionality
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

      /**
       * 2. Calculation Basis: 
       * Month 1: Opening Balance (June 30th Prior Year)
       * Months 2-12: July Ending Balance to May Ending Balance (Current Year)
       * Including transactions on the LAST DAY of each month.
       */
      for (let m = 0; m < 12; m++) {
        let currentMonthIdx, currentYear;
        if (m === 0) {
          currentMonthIdx = 5; // June (Prior Year Opening Basis)
          currentYear = startYear;
        } else {
          currentMonthIdx = (m + 5) % 12; // July (6) ... May (4)
          currentYear = m < 7 ? startYear : startYear + 1;
        }
        
        // Ensure comparison includes the entire last day
        const lastDayOfMonth = new Date(currentYear, currentMonthIdx + 1, 0, 23, 59, 59, 999);
        
        let runningBalanceBasis = 0;
        summaries.forEach((row: any) => {
          const rowDate = new Date(row.summaryDate);
          if (rowDate <= lastDayOfMonth) {
            const val = (Number(row.employeeContribution) || 0) - (Number(row.loanWithdrawal) || 0) + (Number(row.loanRepayment) || 0) + 
                        (Number(row.profitEmployee) || 0) + (Number(row.profitLoan) || 0) + (Number(row.pbsContribution) || 0) + (Number(row.profitPbs) || 0);
            runningBalanceBasis += val;
          }
        });

        totalInterest += calculateTieredAnnual(runningBalanceBasis) / 12;
      }

      results.push({
        memberId: member.id,
        memberIdNumber: member.memberIdNumber,
        name: member.name,
        calculatedInterest: totalInterest,
        employeeFund: finalEmployeeFund,
        officeFund: finalOfficeFund,
        isPosted: isAlreadyPosted
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
      toast({ title: "No Action Needed", description: "Records for this FY already synchronized." });
      return;
    }

    setIsPosting(true);
    let postedCount = 0;

    const [startYearStr] = selectedFY.split("-");
    const endYear = parseInt(startYearStr) + 1;
    const summaryDate = `${endYear}-06-30`;

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
        summaryDate: summaryDate,
        particulars: `Annual Profit FY ${selectedFY} (Tiered)`,
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
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">CPF Interest Accrual</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Rule: Opening Balance (June 30) + July-May Monthly Basis (Includes last-day transactions)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 border p-1 rounded-md">
            <Calendar className="size-4 text-muted-foreground ml-2" />
            <Select value={selectedFY} onValueChange={setSelectedFY}>
              <SelectTrigger className="w-[140px] border-none shadow-none font-bold">
                <SelectValue placeholder="Fiscal Year" />
              </SelectTrigger>
              <SelectContent>
                {fyOptions.map(fy => <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleRunCPFCalculation} disabled={isCalculating || isPosting || isMembersLoading} className="gap-2 font-bold uppercase text-xs tracking-widest">
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
        <div className="space-y-2 max-w-md mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest opacity-50">Processing 12-month basis (Opening + 11 Months)...</p>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {previewData.length > 0 && (
        <div className="bg-card rounded-xl shadow-lg border overflow-hidden">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider">Accrual Audit Preview - Basis FY {selectedFY}</h2>
            <Button 
              onClick={handlePostAllInterest} 
              disabled={isPosting || !hasUnpostedEntries} 
              className={cn("gap-2 font-bold uppercase text-xs", hasUnpostedEntries ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400")}
            >
              {isPosting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Synchronize Ledger (June 30)
            </Button>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-bold">Member ID</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Name</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold">Computed Profit (৳)</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((item) => (
                  <TableRow key={item.memberId} className={cn(item.isPosted ? "opacity-60 bg-slate-50" : "hover:bg-slate-50/50")}>
                    <TableCell className="font-mono text-xs font-bold">{item.memberIdNumber}</TableCell>
                    <TableCell className="text-xs font-semibold">{item.name}</TableCell>
                    <TableCell className="text-right font-black text-accent">৳ {item.calculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
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
    </div>
  );
}
