
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
  UserSearch, 
  ListOrdered, 
  ArrowLeft 
} from "lucide-react";
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  useDoc,
  addDocumentNonBlocking,
  getDocuments
} from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
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
import Link from "next/link";

export default function SpecialInterestDPPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [viewingDetails, setViewingDetails] = useState<any | null>(null);
  const [postingDate, setPostingDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setDateRange({ start: fyStart, end: today });
  }, []);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);
  
  const activeMembers = useMemo(() => members?.filter(m => m.status === 'Active') || [], [members]);

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
    if (!dateRange.start || !dateRange.end) return;
    setIsCalculating(true);
    setResults([]);
    setPostingDate(dateRange.end);
    const auditStart = new Date(dateRange.start);
    const auditEnd = new Date(dateRange.end);
    
    const targetMembers = selectedMember === "all" 
      ? activeMembers 
      : activeMembers.filter(m => m.id === selectedMember);

    if (targetMembers.length === 0 && selectedMember !== "all") {
       toast({ title: "Ineligible Member", description: "Interest accrual restricted to Active personnel.", variant: "destructive" });
       setIsCalculating(false);
       return;
    }

    const auditResults = [];
    for (const member of targetMembers) {
      const summariesRef = collection(firestore, "members", member.id, "fundSummaries");
      const snapshot = await getDocuments(summariesRef);
      
      // Explicit Sort for Local PC Accuracy
      const allEntries = snapshot.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime());
      
      let totalInterest = 0;
      let dailyLog = [];
      let currentDate = new Date(auditStart);
      const openingRefDate = new Date(auditStart);
      openingRefDate.setDate(openingRefDate.getDate() - 1);
      
      let runningBalance = allEntries
        .filter((e: any) => new Date(e.summaryDate).getTime() <= openingRefDate.getTime())
        .reduce((sum, e: any) => sum + ((Number(e.employeeContribution)||0) - (Number(e.loanWithdrawal)||0) + (Number(e.loanRepayment)||0) + (Number(e.profitEmployee)||0) + (Number(e.profitLoan)||0) + (Number(e.pbsContribution)||0) + (Number(e.profitPbs)||0)), 0);
      
      const openingBalance = runningBalance;
      
      while (currentDate <= auditEnd) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const daysEntries = allEntries.filter((e: any) => e.summaryDate === dateStr);
        daysEntries.forEach((e: any) => runningBalance += ((Number(e.employeeContribution)||0) - (Number(e.loanWithdrawal)||0) + (Number(e.loanRepayment)||0) + (Number(e.profitEmployee)||0) + (Number(e.profitLoan)||0) + (Number(e.pbsContribution)||0) + (Number(e.profitPbs)||0)));
        const dailyInterest = calculateTieredDaily(runningBalance);
        totalInterest += dailyInterest;
        dailyLog.push({ date: dateStr, balance: runningBalance, interest: dailyInterest, hasActivity: daysEntries.length > 0 });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      let currentEmpFund = 0, currentPbsFund = 0;
      allEntries.forEach((e: any) => { 
        if (new Date(e.summaryDate).getTime() <= auditEnd.getTime()) { 
          currentEmpFund += ((Number(e.employeeContribution)||0) - (Number(e.loanWithdrawal)||0) + (Number(e.loanRepayment)||0) + (Number(e.profitEmployee)||0) + (Number(e.profitLoan)||0)); 
          currentPbsFund += ((Number(e.pbsContribution)||0) + (Number(e.profitPbs)||0)); 
        } 
      });
      const totalFund = currentEmpFund + currentPbsFund;
      
      auditResults.push({ 
        memberId: member.id, 
        memberIdNumber: member.memberIdNumber, 
        name: member.name, 
        designation: member.designation, 
        openingBalance, 
        closingBalance: runningBalance, 
        totalInterest, 
        empProfit: totalFund > 0 ? (totalInterest * currentEmpFund) / totalFund : totalInterest / 2, 
        pbsProfit: totalFund > 0 ? (totalInterest * currentPbsFund) / totalFund : totalInterest / 2, 
        dailyLog, 
        days: dailyLog.length 
      });
    }
    setResults(auditResults);
    setIsCalculating(false);
    toast({ title: "Audit Complete", description: `Day-Product yield computed via project folder vault.` });
  };

  const handlePostAll = async () => {
    if (!postingDate || results.length === 0) return;
    setIsCalculating(true);
    for (const res of results) {
      if (res.totalInterest <= 0) continue;
      const entry = { 
        summaryDate: postingDate, 
        particulars: `Profit (DP Basis) ${dateRange.start} to ${dateRange.end}`, 
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
    }
    setIsCalculating(false);
    setResults([]);
    toast({ title: "Local Sync Success", description: "Interest distribution recorded in vault SQLite." });
  };

  const exportToExcel = () => {
    if (results.length === 0) return;
    const data = results.map(r => ({
      "ID No": r.memberIdNumber,
      "Name": r.name,
      "Days Audited": r.days,
      "Opening Balance": r.openingBalance.toFixed(2),
      "Closing Balance": r.closingBalance.toFixed(2),
      "Total DP Profit": r.totalInterest.toFixed(2),
      "Emp Portion (Col 5)": r.empProfit.toFixed(2),
      "PBS Portion (Col 9)": r.pbsProfit.toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Special Interest Audit");
    XLSX.writeFile(wb, `Special_Profit_DP_${dateRange.start}.xlsx`);
  };

  const monthlyBreakdown = useMemo(() => {
    if (!viewingDetails?.dailyLog) return [];
    const groups: Record<string, number> = {};
    viewingDetails.dailyLog.forEach((day: any) => {
      const monthKey = day.date.substring(0, 7); 
      groups[monthKey] = (groups[monthKey] || 0) + day.interest;
    });
    return Object.entries(groups).map(([key, amount]) => {
      const date = new Date(key + "-01");
      return { label: date.toLocaleDateString('default', { month: 'long', year: 'numeric' }), amount };
    });
  }, [viewingDetails]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/investments" className="p-2 border-2 border-black rounded-full hover:bg-slate-100 transition-colors"><ArrowLeft className="size-6 text-black" /></Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Special Interest (Day-Product)</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Mid-month balance tracking • Fraction month settlement audit</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-xl flex flex-col gap-6 no-print">
        <div className="grid gap-6 md:grid-cols-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-black ml-1">Local PC Member Focus</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="h-11 border-black border-2 font-black uppercase text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all" className="font-black text-xs">ALL ACTIVE PERSONNEL</SelectItem>
                {activeMembers.map(m => (
                  <SelectItem key={m.id} value={m.id} className="font-black text-xs uppercase">{m.memberIdNumber} - {m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-black ml-1">Date Range</Label>
            <div className="flex items-center gap-3 border-2 border-black p-1.5 rounded-lg">
              <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-none font-black" />
              <ArrowRightLeft className="size-3 text-black" />
              <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-none font-black" />
            </div>
          </div>
          <Button onClick={handleCalculate} disabled={isCalculating || isMembersLoading} className="h-11 font-black bg-black text-white uppercase tracking-widest shadow-xl">
            {isCalculating ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            Compute DP Profit
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid gap-6 md:grid-cols-3 no-print">
            <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-black">Total DP Profit</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black tabular-nums">৳ {results.reduce((s, r) => s + r.totalInterest, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></CardContent>
            </Card>
            <div className="bg-white p-4 rounded-xl border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between no-print h-full">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-black">Sync Date</Label>
                <Input type="date" value={postingDate} max="9999-12-31" onChange={(e) => setPostingDate(e.target.value)} className="h-8 font-black text-xs border-black border-2" />
              </div>
              <Button onClick={handlePostAll} disabled={!postingDate} className="bg-black text-white h-10 font-black uppercase text-[10px] tracking-widest">
                <ShieldCheck className="size-4" /> Sync to vault
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print">
            <div className="p-4 bg-slate-50 border-b-4 border-black flex items-center justify-between">
               <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportToExcel} className="h-8 gap-2 font-black text-[10px] border-black border-2 bg-white hover:bg-slate-50 uppercase tracking-widest">
                    <FileSpreadsheet className="size-3.5" /> Export Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 gap-2 font-black text-[10px] border-black border-2 bg-white hover:bg-slate-50 uppercase tracking-widest">
                    <Printer className="size-3.5" /> Print Statement
                  </Button>
               </div>
               <Badge className="bg-black text-white rounded-none uppercase text-[9px] font-black">Local PC Audit: {results.length} Personnel</Badge>
            </div>
            <Table className="text-black font-black">
              <TableHeader className="bg-slate-100 border-b-2 border-black">
                <TableRow>
                  <TableHead className="py-4 font-black uppercase text-[10px] tracking-widest pl-6 text-black">ID No</TableHead>
                  <TableHead className="py-4 font-black uppercase text-[10px] tracking-widest text-black">Details</TableHead>
                  <TableHead className="text-right py-4 font-black uppercase text-[10px] tracking-widest text-black">Days</TableHead>
                  <TableHead className="text-right py-4 font-black uppercase text-[10px] tracking-widest text-black">Total Interest</TableHead>
                  <TableHead className="text-center py-4 font-black uppercase text-[10px] tracking-widest pr-6 text-black">Audit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums font-black text-black">
                {results.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                    <td className="font-mono text-xs pl-6">{row.memberIdNumber}</td>
                    <td className="py-4"><div><p className="text-xs font-black uppercase">{row.name}</p><p className="text-[9px] opacity-70 uppercase">{row.designation}</p></div></td>
                    <td className="text-right">{row.days}d</td>
                    <td className="text-right font-black">৳ {row.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-center pr-6"><Button variant="ghost" size="icon" onClick={() => setViewingDetails(row)} className="h-8 w-8 hover:bg-slate-100 text-black"><History className="size-4" /></Button></td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Detail Breakdown Dialog */}
      <Dialog open={!!viewingDetails} onOpenChange={(o) => !o && setViewingDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto font-ledger text-black border-4 border-black p-0 rounded-none shadow-2xl">
          <DialogHeader className="p-8 border-b-4 border-black bg-slate-50">
            <DialogTitle className="flex items-center gap-4 text-2xl font-black uppercase">
              <History className="size-8 text-black" /> 
              Detailed Profit : {viewingDetails?.name}
            </DialogTitle>
            <DialogDescription className="uppercase font-black text-[10px] tracking-widest text-slate-500 mt-2">
              Audit Period: {dateRange.start} to {dateRange.end} • Member ID: {viewingDetails?.memberIdNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-8 space-y-10">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Total DP Profit</span>
                <span className="text-2xl font-black text-black">৳ {viewingDetails?.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Emp Portion (Col 5)</span>
                <span className="text-xl font-black text-black">৳ {viewingDetails?.empProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Office Portion (Col 9)</span>
                <span className="text-xl font-black text-black">৳ {viewingDetails?.pbsProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-black flex items-center gap-3 uppercase tracking-widest border-b-2 border-black pb-2">
                <ListOrdered className="size-5" />
                Monthly Interest Summary
              </h3>
              <div className="border-2 border-black overflow-hidden shadow-lg">
                <Table className="font-black text-black tabular-nums">
                  <TableHeader className="bg-slate-100 border-b-2 border-black">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pl-6 text-black">Calendar Month</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4 pr-6 text-black">Portion Accrual (৳)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="font-black text-black">
                    {monthlyBreakdown.map((month, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 border-b border-black">
                        <td className="font-black text-sm p-4 pl-6 uppercase text-black">{month.label}</td>
                        <td className="text-right p-4 pr-6 font-black text-black">৳ {month.amount.toLocaleString(undefined, { minimumFractionDigits: 4 })}</td>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter className="bg-slate-50 font-black border-t-2 border-black">
                    <TableRow className="h-14">
                      <TableCell className="text-right uppercase tracking-widest text-[10px] pl-6 text-black">Sum of Monthly Portions:</TableCell>
                      <TableCell className="text-right text-lg text-black underline decoration-double pr-6 font-black">৳ {viewingDetails?.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>

            <div className="bg-black p-6 border-2 border-black flex gap-4 items-start shadow-xl">
              <ShieldCheck className="size-6 text-white mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-white tracking-[0.2em]">Day-Product Vault Verification</p>
                <p className="text-[11px] leading-relaxed text-slate-400 font-black italic uppercase">
                  Interest is computed daily using the local SQLite balance matrix: (Daily Balance * Annual Tiered Rate) / 365. This high-fidelity audit captures exact fund utilization for Active members only.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-slate-100 p-6 border-t-4 border-black text-right">
            <Button variant="ghost" onClick={() => setViewingDetails(null)} className="font-black text-xs uppercase tracking-widest border-2 border-black hover:bg-white px-8">Close Audit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
