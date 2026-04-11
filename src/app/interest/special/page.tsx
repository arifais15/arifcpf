"use client"

import React, { useState, useMemo, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Calculator, 
  Loader2, 
  CalendarDays, 
  ArrowRightLeft,
  FileSpreadsheet,
  Printer,
  Info,
  ShieldCheck,
  History,
  TrendingUp,
  UserSearch
} from "lucide-react";
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  useDoc,
  addDocumentNonBlocking
} from "@/firebase";
import { collection, query, orderBy, doc, getDocs } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function SpecialInterestDPPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  // Date Logic for default FY (July 1st to Today)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
  const today = now.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: fyStart, end: today });
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [viewingDetails, setViewingDetails] = useState<any | null>(null);
  const [postingDate, setPostingDate] = useState("");

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const interestSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "interest"), [firestore]);
  const { data: interestSettings } = useDoc(interestSettingsRef);

  const interestTiers = useMemo(() => {
    if (interestSettings?.tiers) return interestSettings.tiers;
    return [
      { limit: 1500000, rate: 0.13 },
      { limit: 3000000, rate: 0.12 },
      { limit: null, rate: 0.11 }
    ];
  }, [interestSettings]);

  const calculateTieredDaily = (balance: number) => {
    let annualInterest = 0;
    let remainingBalance = balance;
    let prevLimit = 0;

    for (const tier of interestTiers) {
      if (remainingBalance <= 0) break;
      if (tier.limit === null) {
        annualInterest += remainingBalance * tier.rate;
        break;
      } else {
        const tierCapacity = tier.limit - prevLimit;
        const amountInTier = Math.min(remainingBalance, tierCapacity);
        annualInterest += amountInTier * tier.rate;
        remainingBalance -= amountInTier;
        prevLimit = tier.limit;
      }
    }
    return annualInterest / 365;
  };

  const handleCalculate = async () => {
    if (!dateRange.start || !dateRange.end) {
      toast({ title: "Dates Required", description: "Select audit period.", variant: "destructive" });
      return;
    }

    setIsCalculating(true);
    setResults([]);
    setPostingDate(dateRange.end);

    const auditStart = new Date(dateRange.start);
    const auditEnd = new Date(dateRange.end);
    const targetMembers = selectedMember === "all" ? (members || []) : (members?.filter(m => m.id === selectedMember) || []);
    
    const auditResults = [];

    for (const member of targetMembers) {
      const summariesRef = collection(firestore, "members", member.id, "fundSummaries");
      const q = query(summariesRef, orderBy("summaryDate", "asc"));
      const snapshot = await getDocs(q);
      const allEntries = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));

      let totalInterest = 0;
      let dailyLog = [];
      let currentDate = new Date(auditStart);
      
      const openingRefDate = new Date(auditStart);
      openingRefDate.setDate(openingRefDate.getDate() - 1);
      
      let runningBalance = allEntries
        .filter((e: any) => new Date(e.summaryDate) <= openingRefDate)
        .reduce((sum, e: any) => {
          const v = { c1: Number(e.employeeContribution)||0, c2: Number(e.loanWithdrawal)||0, c3: Number(e.loanRepayment)||0, c5: Number(e.profitEmployee)||0, c6: Number(e.profitLoan)||0, c8: Number(e.pbsContribution)||0, c9: Number(e.profitPbs)||0 };
          return sum + (v.c1 - v.c2 + v.c3 + v.c5 + v.c6 + v.c8 + v.c9);
        }, 0);

      const openingBalance = runningBalance;

      while (currentDate <= auditEnd) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const daysEntries = allEntries.filter((e: any) => e.summaryDate === dateStr);
        daysEntries.forEach((e: any) => {
          const v = { c1: Number(e.employeeContribution)||0, c2: Number(e.loanWithdrawal)||0, c3: Number(e.loanRepayment)||0, c5: Number(e.profitEmployee)||0, c6: Number(e.profitLoan)||0, c8: Number(e.pbsContribution)||0, c9: Number(e.profitPbs)||0 };
          runningBalance += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6 + v.c8 + v.c9);
        });

        const dailyInterest = calculateTieredDaily(runningBalance);
        totalInterest += dailyInterest;

        dailyLog.push({
          date: dateStr,
          balance: runningBalance,
          interest: dailyInterest,
          hasActivity: daysEntries.length > 0
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      let currentEmpFund = 0;
      let currentPbsFund = 0;
      allEntries.forEach((e: any) => {
        if (new Date(e.summaryDate) <= auditEnd) {
          const v = { c1: Number(e.employeeContribution)||0, c2: Number(e.loanWithdrawal)||0, c3: Number(e.loanRepayment)||0, c5: Number(e.profitEmployee)||0, c6: Number(e.profitLoan)||0, c8: Number(e.pbsContribution)||0, c9: Number(e.profitPbs)||0 };
          currentEmpFund += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6);
          currentPbsFund += (v.c8 + v.c9);
        }
      });

      const totalFund = currentEmpFund + currentPbsFund;
      const empProfit = totalFund > 0 ? (totalInterest * currentEmpFund) / totalFund : totalInterest / 2;
      const pbsProfit = totalFund > 0 ? (totalInterest * currentPbsFund) / totalFund : totalInterest / 2;

      auditResults.push({
        memberId: member.id,
        memberIdNumber: member.memberIdNumber,
        name: member.name,
        designation: member.designation,
        openingBalance,
        closingBalance: runningBalance,
        totalInterest,
        empProfit,
        pbsProfit,
        dailyLog,
        days: dailyLog.length
      });
    }

    setResults(auditResults);
    setIsCalculating(false);
    toast({ title: "Day-Product Audit Complete", description: `Processed ${auditResults.length} records.` });
  };

  const handlePostAll = async () => {
    if (!postingDate || results.length === 0) return;
    
    setIsCalculating(true);
    let count = 0;
    for (const res of results) {
      if (res.totalInterest <= 0) continue;
      
      const entry = {
        summaryDate: postingDate,
        particulars: `Annual Profit (DP Basis) ${dateRange.start} to ${dateRange.end}`,
        employeeContribution: 0,
        loanWithdrawal: 0,
        loanRepayment: 0,
        profitEmployee: Math.round(res.empProfit),
        profitLoan: 0,
        pbsContribution: 0,
        profitPbs: Math.round(res.pbsProfit),
        lastUpdateDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        memberId: res.memberId,
        isSystemGenerated: true
      };

      await addDocumentNonBlocking(collection(firestore, "members", res.memberId, "fundSummaries"), entry);
      count++;
    }
    setIsCalculating(false);
    setResults([]);
    toast({ title: "Posted", description: `Synchronized special interest for ${count} members.` });
  };

  const exportToExcel = () => {
    const data = results.map(r => ({
      "ID No": r.memberIdNumber,
      "Name": r.name,
      "Days Audited": r.days,
      "Opening Balance": r.openingBalance,
      "Closing Balance": r.closingBalance,
      "Total DP Interest": r.totalInterest.toFixed(2),
      "Emp Portion": r.empProfit.toFixed(2),
      "PBS Portion": r.pbsProfit.toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Special Interest");
    XLSX.writeFile(wb, `Special_Interest_DP_${dateRange.start}.xlsx`);
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500/10 p-3 rounded-2xl">
            <Calculator className="size-8 text-amber-600" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-primary tracking-tight">Special Interest (Day-Product)</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Mid-month balance tracking • Fraction month settlement audit</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={results.length === 0} className="gap-2 h-10 font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <FileSpreadsheet className="size-4" /> Excel Export
          </Button>
          <Button onClick={() => window.print()} disabled={results.length === 0} className="gap-2 h-10 font-bold shadow-lg shadow-primary/20">
            <Printer className="size-4" /> Print Statement
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col gap-6 no-print">
        <div className="grid gap-6 md:grid-cols-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Member Focus</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="h-11 font-bold border-slate-200">
                <UserSearch className="size-4 mr-2 text-slate-400" />
                <SelectValue placeholder="All Active Members" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All Institutional Personnel</SelectItem>
                {members?.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.memberIdNumber} - {m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Audit Period Range</Label>
            <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border">
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-none bg-transparent font-bold" />
              <ArrowRightLeft className="size-3 text-slate-300" />
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-none bg-transparent font-bold" />
            </div>
          </div>

          <Button 
            onClick={handleCalculate} 
            disabled={isCalculating || isMembersLoading} 
            className="h-11 font-black uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
          >
            {isCalculating ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            Run DP Audit
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid gap-6 md:grid-cols-3 no-print">
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest opacity-60 mb-1">Total DP Profit Share</p>
                <div className="text-2xl font-black text-primary">
                  ৳ {results.reduce((s, r) => s + r.totalInterest, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-100">
              <CardContent className="pt-6">
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest opacity-60 mb-1">Personnel Processed</p>
                <div className="text-2xl font-black text-emerald-700">{results.length} Members</div>
              </CardContent>
            </Card>
            <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between no-print">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-400">Sync Ledger Date</Label>
                <Input type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} className="h-8 font-bold text-xs" />
              </div>
              <Button onClick={handlePostAll} disabled={!postingDate} className="bg-emerald-600 hover:bg-emerald-700 h-10 font-bold gap-2">
                <ShieldCheck className="size-4" /> Synchronize All
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-xl border overflow-hidden no-print">
            <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="size-4 text-amber-600" />
                Special Interest Statement Preview
              </h2>
              <Badge variant="outline" className="bg-white border-slate-200 uppercase text-[9px] font-black tracking-widest">
                DP Basis: {dateRange.start} to {dateRange.end}
              </Badge>
            </div>
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-4">ID No</TableHead>
                  <TableHead className="py-4">Member Details</TableHead>
                  <TableHead className="text-right py-4">Opening Bal (৳)</TableHead>
                  <TableHead className="text-right py-4">Closing Bal (৳)</TableHead>
                  <TableHead className="text-right py-4">Days</TableHead>
                  <TableHead className="text-right py-4 font-black">Total Interest (৳)</TableHead>
                  <TableHead className="text-center py-4">Audit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50 group">
                    <td className="font-mono text-xs font-bold p-4 text-slate-500">{row.memberIdNumber}</td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">{row.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{row.designation}</span>
                      </div>
                    </td>
                    <td className="text-right p-4 font-medium text-slate-400">৳ {row.openingBalance.toLocaleString()}</td>
                    <td className="text-right p-4 font-medium">৳ {row.closingBalance.toLocaleString()}</td>
                    <td className="text-right p-4"><Badge variant="secondary" className="h-5 text-[10px]">{row.days}d</Badge></td>
                    <td className="text-right p-4 font-black text-primary">৳ {row.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-center p-4">
                      <Button variant="ghost" size="icon" onClick={() => setViewingDetails(row)} className="h-8 w-8 hover:bg-amber-50">
                        <History className="size-4 text-amber-600" />
                      </Button>
                    </td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={!!viewingDetails} onOpenChange={(o) => !o && setViewingDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto font-ledger">
          <DialogHeader className="border-b pb-4 mb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <History className="size-5 text-amber-600" /> 
              Daily Ledger Log: {viewingDetails?.name}
            </DialogTitle>
            <DialogDescription className="uppercase font-black text-[10px] tracking-widest text-slate-400">
              Audit Period: {dateRange.start} to {dateRange.end} • Member ID: {viewingDetails?.memberIdNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-black text-slate-400 mb-1">Total DP Profit</span>
                <span className="text-xl font-black text-primary">৳ {viewingDetails?.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-black text-slate-400 mb-1">Emp Portion (Col 5)</span>
                <span className="text-lg font-bold text-slate-700">৳ {viewingDetails?.empProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-black text-slate-400 mb-1">Office Portion (Col 9)</span>
                <span className="text-lg font-bold text-slate-700">৳ {viewingDetails?.pbsProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-3">Audit Date</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase py-3">Day-End Balance (৳)</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase py-3">Day Portion Interest (৳)</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase py-3">Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingDetails?.dailyLog.map((day: any, i: number) => (
                    <TableRow key={i} className={cn("hover:bg-slate-50/50", day.hasActivity && "bg-amber-50/30")}>
                      <td className="font-mono text-xs p-3 text-slate-600">{day.date}</td>
                      <td className="text-right p-3 font-medium">৳ {day.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="text-right p-3 font-bold text-emerald-700">৳ {day.interest.toLocaleString(undefined, { minimumFractionDigits: 6 })}</td>
                      <td className="text-center p-3">
                        {day.hasActivity ? <Badge className="bg-amber-100 text-amber-700 text-[8px] h-4 uppercase">Trxn</Badge> : <span className="text-[8px] text-slate-300 uppercase">-</span>}
                      </td>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-slate-50 font-black">
                  <TableRow>
                    <TableCell colSpan={2} className="text-right uppercase text-[9px]">Sum of Daily Portions:</TableCell>
                    <TableCell className="text-right text-base text-primary underline decoration-double">৳ {viewingDetails?.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
              <ShieldCheck className="size-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Day-Product Logic Verification</p>
                <p className="text-[11px] leading-relaxed text-blue-600">
                  This calculation captures exact fund utilization. Interest is computed daily using the formula: <code>(Daily Balance * Annual Tiered Rate) / 365</code>. This ensures that mid-month loan disbursements or repayments are perfectly adjusted for interest accrual.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <h2 className="text-lg font-bold underline underline-offset-4 uppercase">Day-Product Special Interest Audit Statement</h2>
          <div className="flex justify-between text-[10px] font-bold pt-4">
            <span>Period: {dateRange.start} to {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[9px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-2 text-center w-[80px]">ID No</th>
              <th className="border border-black p-2 text-left">Name & Designation</th>
              <th className="border border-black p-2 text-right">Days</th>
              <th className="border border-black p-2 text-right">Opening Bal (৳)</th>
              <th className="border border-black p-2 text-right">Closing Bal (৳)</th>
              <th className="border border-black p-2 text-right font-black">Total Interest (৳)</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td className="border border-black p-2 text-center font-mono">{r.memberIdNumber}</td>
                <td className="border border-black p-2">
                  <span className="font-bold">{r.name}</span><br/>
                  <span className="text-[8px] uppercase">{r.designation}</span>
                </td>
                <td className="border border-black p-2 text-right">{r.days}</td>
                <td className="border border-black p-2 text-right">{r.openingBalance.toLocaleString()}</td>
                <td className="border border-black p-2 text-right">{r.closingBalance.toLocaleString()}</td>
                <td className="border border-black p-2 text-right font-black">{r.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black">
              <td colSpan={5} className="border border-black p-2 text-right uppercase">Grand Total Special Interest:</td>
              <td className="border border-black p-2 text-right underline decoration-double">
                ৳ {results.reduce((sum, r) => sum + r.totalInterest, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
          <div className="border-t border-black pt-2">Accountant (Audit)</div>
          <div className="border-t border-black pt-2">Internal Auditor / DGM</div>
          <div className="border-t border-black pt-2">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
