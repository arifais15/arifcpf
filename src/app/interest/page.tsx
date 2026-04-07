
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
    const currentMonth = now.getMonth() + 1; // 1-indexed
    
    // Determine the "current" fiscal year (assuming July-June)
    const activeFYStart = currentMonth >= 7 ? currentYear : currentYear - 1;
    
    // Generate years from 2015 up to next year for planning
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

      // Check if duplicate for this specific FY is already posted
      const isAlreadyPosted = summaries.some(s => 
        s.particulars?.includes(`Annual Profit FY ${selectedFY}`)
      );

      let totalInterest = 0;
      let finalEmployeeFund = 0;
      let finalOfficeFund = 0;

      // 1. Calculate final fund balances for proportionality
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

      // 2. Loop through 12 months: June (Prior) to May (Current)
      for (let m = 0; m < 12; m++) {
        let currentMonthIdx, currentYear;
        if (m === 0) {
          currentMonthIdx = 5; // June (Prior Year)
          currentYear = startYear;
        } else {
          currentMonthIdx = (m + 5) % 12;
          currentYear = m < 7 ? startYear : startYear + 1;
        }
        
        const lastDayOfMonth = new Date(currentYear, currentMonthIdx + 1, 0);
        
        // Find cumulative balance (col 11) up to this month end
        let runningBalance = 0;
        summaries.forEach((row: any) => {
          if (new Date(row.summaryDate) <= lastDayOfMonth) {
            const val = (Number(row.employeeContribution) || 0) - (Number(row.loanWithdrawal) || 0) + (Number(row.loanRepayment) || 0) + 
                        (Number(row.profitEmployee) || 0) + (Number(row.profitLoan) || 0) + (Number(row.pbsContribution) || 0) + (Number(row.profitPbs) || 0);
            runningBalance += val;
          }
        });

        totalInterest += calculateTieredAnnual(runningBalance) / 12;
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
    toast({ title: "Calculation Complete", description: `Computed tiered interest for ${results.length} members.` });
  };

  const handlePostAllInterest = async () => {
    if (previewData.length === 0) return;
    
    const unpostedItems = previewData.filter(item => !item.isPosted);
    if (unpostedItems.length === 0) {
      toast({ title: "No Action Needed", description: "All records for this FY are already posted." });
      return;
    }

    setIsPosting(true);
    let postedCount = 0;

    // Posting date: June 30th of the end year of the FY
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
    toast({ title: "Posting Complete", description: `Successfully posted profit for ${postedCount} members.` });
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
          <p className="text-muted-foreground">Tiered profit calculation (June Prior to May Current)</p>
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
          <Button onClick={handleRunCPFCalculation} disabled={isCalculating || isPosting || isMembersLoading} className="gap-2">
            {isCalculating ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            Compute Interest
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-primary tracking-widest">Target Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length || 0} Members</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-accent tracking-widest">Total Computed Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳ {totalCPFProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-emerald-600 tracking-widest">Audit Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {previewData.length > 0 ? (
                hasUnpostedEntries ? (
                  <span className="text-orange-600 flex items-center gap-1">Pending Post</span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1">Synchronized</span>
                )
              ) : (
                <span className="text-slate-400">Idle</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isCalculating && (
        <div className="space-y-2 max-w-md mx-auto text-center">
          <p className="text-sm font-medium">Scanning subsidiary ledgers month-by-month...</p>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {previewData.length > 0 && (
        <div className="bg-card rounded-xl shadow-lg border overflow-hidden">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">Accrual Preview - FY {selectedFY}</h2>
            <Button 
              onClick={handlePostAllInterest} 
              disabled={isPosting || !hasUnpostedEntries} 
              className={cn("gap-2", hasUnpostedEntries ? "bg-emerald-600" : "bg-slate-400")}
            >
              {isPosting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Post to Ledgers (June 30)
            </Button>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead>Member ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Tiered Profit (৳)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((item) => (
                  <TableRow key={item.memberId} className={item.isPosted ? "opacity-60 bg-slate-50" : ""}>
                    <TableCell className="font-mono text-xs">{item.memberIdNumber}</TableCell>
                    <TableCell className="text-sm">{item.name}</TableCell>
                    <TableCell className="text-right font-bold text-accent">৳ {item.calculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center">
                      {item.isPosted ? (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-600">Already Posted</Badge>
                      ) : (
                        <Badge variant="outline">Computed</Badge>
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
