
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

  const [selectedFY, setSelectedFY] = useState<string>(fyOptions[1] || ""); // Default to previous closed FY
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

      // Check for duplicates
      const isAlreadyPosted = summaries.some(s => 
        s.particulars?.includes(`Annual Profit FY ${selectedFY}`)
      );

      let runningEmployeeFund = 0;
      let runningOfficeFund = 0;
      const sortedSummaries = summaries.sort((a: any, b: any) => 
        new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime()
      );

      let totalInterest = 0;
      
      // We calculate monthly, but we also need the final fund balances to determine the ratio for posting
      sortedSummaries.forEach((row: any) => {
        const c1 = Number(row.employeeContribution) || 0;
        const c2 = Number(row.loanWithdrawal) || 0;
        const c3 = Number(row.loanRepayment) || 0;
        const c5 = Number(row.profitEmployee) || 0;
        const c6 = Number(row.profitLoan) || 0;
        const c8 = Number(row.pbsContribution) || 0;
        const c9 = Number(row.profitPbs) || 0;

        runningEmployeeFund += (c1 - c2 + c3 + c5 + c6);
        runningOfficeFund += (c8 + c9);
      });

      for (let m = 0; m < 12; m++) {
        let currentMonthIdx, currentYear;
        if (m === 0) {
          currentMonthIdx = 5; // June (Last day of June is starting balance for July)
          currentYear = startYear;
        } else {
          currentMonthIdx = (m + 5) % 12;
          currentYear = m < 7 ? startYear : startYear + 1;
        }
        
        const lastDayOfMonth = new Date(currentYear, currentMonthIdx + 1, 0);
        
        const entriesUpToMonth = sortedSummaries.filter(r => new Date(r.summaryDate) <= lastDayOfMonth);
        const lastBalance = entriesUpToMonth.reduce((acc, curr: any) => acc + 
              (Number(curr.employeeContribution) - Number(curr.loanWithdrawal) + Number(curr.loanRepayment) + 
               Number(curr.profitEmployee) + Number(curr.profitLoan) + Number(curr.pbsContribution) + Number(curr.profitPbs)), 0);

        totalInterest += calculateTieredAnnual(lastBalance) / 12;
      }

      results.push({
        memberId: member.id,
        memberIdNumber: member.memberIdNumber,
        name: member.name,
        calculatedInterest: totalInterest,
        employeeFund: runningEmployeeFund,
        officeFund: runningOfficeFund,
        isPosted: isAlreadyPosted
      });

      setProgress(Math.round(((i + 1) / members.length) * 100));
    }

    setPreviewData(results);
    setIsCalculating(false);
    toast({ title: "Calculation Complete", description: `Prepared profits for ${results.length} members.` });
  };

  const handlePostAllInterest = async () => {
    if (previewData.length === 0) return;
    
    const unpostedItems = previewData.filter(item => !item.isPosted);
    if (unpostedItems.length === 0) {
      toast({ title: "No Actions Required", description: "All selected records are already posted for this period." });
      return;
    }

    setIsPosting(true);
    let postedCount = 0;

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
        summaryDate: new Date().toISOString().split('T')[0],
        particulars: `Annual Profit FY ${selectedFY} (Proportional)`,
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
    toast({ title: "Posting Complete", description: `Successfully updated ${postedCount} subsidiary ledgers.` });
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
          <p className="text-muted-foreground">Apply tiered profit calculation based on proportional fund balances</p>
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
            Run CPF Calc
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-primary tracking-widest">Target Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length || 0} Accounts</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-accent tracking-widest">Total Accrued Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳ {totalCPFProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-emerald-600 tracking-widest">Posting Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {previewData.length > 0 ? (
                hasUnpostedEntries ? (
                  <span className="text-orange-600 flex items-center gap-1"><AlertCircle className="size-5" /> Pending</span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1"><ShieldCheck className="size-5" /> Already Posted</span>
                )
              ) : (
                <span className="text-slate-400 flex items-center gap-1"><CheckCircle2 className="size-5" /> Idle</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isCalculating && (
        <div className="space-y-2 max-w-md mx-auto text-center">
          <p className="text-sm font-medium animate-pulse">Scanning ledgers and checking for duplicate postings...</p>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground">{progress}% complete</p>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="bg-card rounded-xl shadow-lg border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Percent className="size-4 text-primary" />
              Accrual Preview - FY {selectedFY}
            </h2>
            <Button 
              onClick={handlePostAllInterest} 
              disabled={isPosting || !hasUnpostedEntries} 
              className={cn(
                "gap-2",
                hasUnpostedEntries ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400 cursor-not-allowed"
              )}
            >
              {isPosting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              {hasUnpostedEntries ? "Post Unposted Proportional" : "All Records Synced"}
            </Button>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
                <TableRow>
                  <TableHead>Member ID</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead className="text-right">Tiered Profit (৳)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((item) => (
                  <TableRow key={item.memberId} className={item.isPosted ? "bg-slate-50/50 opacity-80" : ""}>
                    <TableCell className="font-mono font-bold text-xs">{item.memberIdNumber}</TableCell>
                    <TableCell className="text-sm">{item.name}</TableCell>
                    <TableCell className="text-right font-bold text-accent">৳ {item.calculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center">
                      {item.isPosted ? (
                        <Badge variant="outline" className="text-[10px] uppercase border-emerald-500 text-emerald-600 bg-emerald-50">Duplicate Protected</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] uppercase">Calculated</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 bg-amber-50 border-t flex gap-3">
            <Info className="size-5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <b>Validation:</b> The system automatically detects if a profit entry for <b>FY {selectedFY}</b> already exists in the subsidiary ledger. Duplicate postings are strictly prohibited to maintain accounting accuracy.
            </p>
          </div>
        </div>
      )}

      {!isCalculating && previewData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-2xl bg-slate-50/50">
          <Calculator className="size-16 text-slate-200 mb-4" />
          <p className="text-slate-400 font-medium">Select a Fiscal Year and run calculation to begin accrual process</p>
        </div>
      )}
    </div>
  );
}
