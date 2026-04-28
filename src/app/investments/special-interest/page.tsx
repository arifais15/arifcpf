
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
  const pbsName = (generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2").toUpperCase();

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [viewingDetails, setViewingDetails] = useState<any | null>(null);
  const [postingDate, setPostingDate] = useState("");

  // Prevent hydration errors by setting dates after mount
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
    if (!dateRange.start || !dateRange.end) {
      toast({ title: "Date Range Required", variant: "destructive" });
      return;
    }
    
    setIsCalculating(true);
    setResults([]);
    setPostingDate(dateRange.end);
    
    const auditStart = new Date(dateRange.start);
    const auditEnd = new Date(dateRange.end);
    
    const targetMembers = selectedMember === "all" 
      ? activeMembers 
      : activeMembers.filter(m => m.id === selectedMember);

    if (targetMembers.length === 0) {
       toast({ title: "Ineligible Target", description: "Interest accrual restricted to Active personnel.", variant: "destructive" });
       setIsCalculating(false);
       return;
    }

    const auditResults = [];
    for (const member of targetMembers) {
      const summariesRef = collection(firestore, "members", member.id, "fundSummaries");
      const snapshot = await getDocuments(summariesRef);
      
      const allEntries = snapshot.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime());
      
      let totalInterest = 0;
      let dailyLog = [];
      let currentDate = new Date(auditStart);
      
      // Calculate Opening Balance for the start of the range
      const openingRefDate = new Date(auditStart);
      openingRefDate.setDate(openingRefDate.getDate() - 1);
      
      let runningBalance = allEntries
        .filter((e: any) => new Date(e.summaryDate).getTime() <= openingRefDate.getTime())
        .reduce((sum, e: any) => {
          const v = { 
            c1: Number(e.employeeContribution)||0, 
            c2: Number(e.loanWithdrawal)||0, 
            c3: Number(e.loanRepayment)||0, 
            c5: Number(e.profitEmployee)||0, 
            c6: Number(e.profitLoan)||0, 
            c8: Number(e.pbsContribution)||0, 
            c9: Number(e.profitPbs)||0 
          };
          return sum + (v.c1 - v.c2 + v.c3 + v.c5 + v.c6 + v.c8 + v.c9);
        }, 0);
      
      const openingBalance = runningBalance;
      
      // Loop Day by Day
      while (currentDate <= auditEnd) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const daysEntries = allEntries.filter((e: any) => e.summaryDate === dateStr);
        
        daysEntries.forEach((e: any) => {
          const v = { 
            c1: Number(e.employeeContribution)||0, 
            c2: Number(e.loanWithdrawal)||0, 
            c3: Number(e.loanRepayment)||0, 
            c5: Number(e.profitEmployee)||0, 
            c6: Number(e.profitLoan)||0, 
            c8: Number(e.pbsContribution)||0, 
            c9: Number(e.profitPbs)||0 
          };
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
      
      // Calculate split for Col 5 and Col 9 based on final fund weights
      let currentEmpFund = 0, currentPbsFund = 0;
      allEntries.forEach((e: any) => { 
        if (new Date(e.summaryDate).getTime() <= auditEnd.getTime()) { 
          const v = { c1:Number(e.employeeContribution)||0, c2:Number(e.loanWithdrawal)||0, c3:Number(e.loanRepayment)||0, c5:Number(e.profitEmployee)||0, c6:Number(e.profitLoan)||0, c8:Number(e.pbsContribution)||0, c9:Number(e.profitPbs)||0 };
          currentEmpFund += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6); 
          currentPbsFund += (v.c8 + v.c9); 
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
    toast({ title: "Day-Basis Audit Complete", description: `Computed accrual for ${auditResults.length} records.` });
  };

  const handlePostAll = async () => {
    if (!postingDate || results.length === 0) return;
    setIsCalculating(true);
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
    }
    setIsCalculating(false);
    setResults([]);
    toast({ title: "Local Sync Success", description: "Daily-product interest synchronized to vault." });
  };

  const exportToExcel = () => {
    if (results.length === 0) return;
    const data = results.map(r => ({
      "ID No": r.memberIdNumber,
      "Name": r.name,
      "Audit Days": r.days,
      "Opening Bal": r.openingBalance.toFixed(2),
      "Closing Bal": r.closingBalance.toFixed(2),
      "Total DP Profit": r.totalInterest.toFixed(2),
      "Emp Portion": r.empProfit.toFixed(2),
      "Office Portion": r.pbsProfit.toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DP Interest Audit");
    XLSX.writeFile(wb, `DayProduct_Interest_${dateRange.start}_to_${dateRange.end}.xlsx`);
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
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Day-Product Special Interest</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">High-Fidelity Daily Accrual Matrix • Local PC Hardware Vault</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-xl flex flex-col gap-6 no-print">
        <div className="grid gap-6 md:grid-cols-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-black ml-1 tracking-widest">Focus Personnel</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="h-11 border-black border-2 font-black uppercase text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all" className="font-black text-xs">ALL ACTIVE MEMBERS</SelectItem>
                {activeMembers.map(m => (
                  <SelectItem key={m.id} value={m.id} className="font-black text-xs uppercase">{m.memberIdNumber} - {m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-black ml-1 tracking-widest">Audit Period Range</Label>
            <div className="flex items-center gap-3 border-2 border-black p-1.5 rounded-lg">
              <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-none font-black" />
              <ArrowRightLeft className="size-3 text-black opacity-30" />
              <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-none font-black" />
            </div>
          </div>
          <Button onClick={handleCalculate} disabled={isCalculating || isMembersLoading} className="h-11 font-black bg-black text-white uppercase tracking-widest shadow-xl group">
            {isCalculating ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4 mr-2 group-hover:scale-110 transition-transform" />}
            Compute Day-Basis Profit
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid gap-6 md:grid-cols-3 no-print">
            <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white p-6">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Aggregate DP Yield</p>
              <div className="text-3xl font-black tabular-nums">৳ {results.reduce((s, r) => s + r.totalInterest, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            </Card>
            <div className="bg-white p-6 rounded-none border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between no-print h-full">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-black tracking-widest">Ledger Sync Date</Label>
                <Input type="date" value={postingDate} max="9999-12-31" onChange={(e) => setPostingDate(e.target.value)} className="h-9 font-black text-sm border-black border-2 bg-slate-50" />
              </div>
              <Button onClick={handlePostAll} disabled={!postingDate} className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-black uppercase text-[10px] px-6 shadow-xl tracking-tighter">
                <ShieldCheck className="size-4 mr-2" /> Sync to Local Vault
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print">
            <div className="p-4 bg-slate-100 border-b-4 border-black flex items-center justify-between">
               <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={exportToExcel} className="h-9 gap-2 font-black text-[10px] border-black border-2 bg-white hover:bg-slate-50 uppercase tracking-widest">
                    <FileSpreadsheet className="size-3.5 text-emerald-600" /> Export Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9 gap-2 font-black text-[10px] border-black border-2 bg-white hover:bg-slate-50 uppercase tracking-widest">
                    <Printer className="size-3.5" /> Print Statement
                  </Button>
               </div>
               <Badge className="bg-black text-white rounded-none uppercase text-[9px] font-black h-9 px-6 shadow-md tracking-widest">Audit Scope: {results.length} Active Members</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table className="text-black font-black">
                <TableHeader className="bg-slate-50 border-b-2 border-black">
                  <TableRow>
                    <TableHead className="py-5 font-black uppercase text-[10px] tracking-widest pl-8 text-black border-r border-black">PayID</TableHead>
                    <TableHead className="py-5 font-black uppercase text-[10px] tracking-widest text-black border-r border-black">Personnel details</TableHead>
                    <TableHead className="text-center py-5 font-black uppercase text-[10px] tracking-widest text-black border-r border-black">Days</TableHead>
                    <TableHead className="text-right py-5 font-black uppercase text-[10px] tracking-widest text-black border-r border-black">Aggregate Yield</TableHead>
                    <TableHead className="text-center py-5 font-black uppercase text-[10px] tracking-widest pr-8 text-black">Trace Audit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="tabular-nums font-black text-black">
                  {results.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                      <td className="font-mono text-base pl-8 border-r border-black">{row.memberIdNumber}</td>
                      <td className="py-4 border-r border-black">
                        <div className="flex flex-col">
                          <p className="text-sm font-black uppercase leading-tight">{row.name}</p>
                          <p className="text-[9px] opacity-60 uppercase tracking-widest">{row.designation}</p>
                        </div>
                      </td>
                      <td className="text-center border-r border-black"><Badge variant="secondary" className="font-black h-5 text-[10px]">{row.days}d</Badge></td>
                      <td className="text-right font-black text-lg border-r border-black pr-6">৳ {row.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="text-center pr-8">
                        <Button variant="ghost" size="icon" onClick={() => setViewingDetails(row)} className="h-10 w-10 hover:bg-black hover:text-white transition-all text-black">
                          <History className="size-5" />
                        </Button>
                      </td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED DAILY BREAKDOWN DIALOG */}
      <Dialog open={!!viewingDetails} onOpenChange={(o) => !o && setViewingDetails(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto font-ledger text-black border-4 border-black p-0 rounded-none shadow-2xl">
          <DialogHeader className="p-10 border-b-4 border-black bg-slate-50 sticky top-0 z-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="bg-black p-4 rounded-3xl shadow-xl"><History className="size-10 text-white" /></div>
                <div>
                  <DialogTitle className="text-3xl font-black uppercase tracking-tight">Day-Basis Breakdown</DialogTitle>
                  <DialogDescription className="uppercase font-black text-[11px] tracking-[0.3em] text-slate-400 mt-2">
                    {viewingDetails?.name} • PayID: {viewingDetails?.memberIdNumber}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className="bg-black text-white rounded-none px-4 py-1.5 uppercase font-black text-[10px] tracking-widest shadow-lg">Period: {dateRange.start} TO {dateRange.end}</Badge>
                <span className="text-[10px] font-black uppercase text-slate-400">Precision: Local Hardware Clock Sync</span>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-10 space-y-12 bg-white">
            <div className="grid grid-cols-3 gap-8">
              <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center text-center">
                <span className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-[0.2em]">Aggregate DP Profit</span>
                <span className="text-3xl font-black text-black">৳ {viewingDetails?.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center text-center">
                <span className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-[0.2em]">Equity Split (Col 5)</span>
                <span className="text-2xl font-black text-indigo-700">৳ {viewingDetails?.empProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center text-center">
                <span className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-[0.2em]">Matching Split (Col 9)</span>
                <span className="text-2xl font-black text-emerald-700">৳ {viewingDetails?.pbsProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-black flex items-center gap-3 uppercase tracking-widest border-b-2 border-black pb-2 text-indigo-900">
                <ListOrdered className="size-6" />
                Monthly Aggregate Verification
              </h3>
              <div className="border-2 border-black overflow-hidden shadow-xl">
                <Table className="font-black text-black tabular-nums">
                  <TableHeader className="bg-slate-100 border-b-2 border-black">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pl-8 text-black border-r border-black">Calendar Month</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4 pr-8 text-black">Month Aggregate Accrual (৳)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyBreakdown.map((month, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 border-b border-black">
                        <td className="font-black text-sm p-4 pl-8 uppercase border-r border-black">{month.label}</td>
                        <td className="text-right p-4 pr-8 font-black text-indigo-700 text-lg">৳ {month.amount.toLocaleString(undefined, { minimumFractionDigits: 4 })}</td>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter className="bg-slate-50 font-black border-t-2 border-black">
                    <TableRow className="h-16">
                      <TableCell className="text-right uppercase tracking-[0.3em] text-[11px] pl-8 text-slate-500 border-r border-black">Total Matrix Accrual:</TableCell>
                      <TableCell className="text-right text-2xl text-black underline decoration-double pr-8 font-black">৳ {viewingDetails?.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-black flex items-center gap-3 uppercase tracking-widest border-b-2 border-black pb-2 text-rose-900">
                <CalendarDays className="size-6" />
                Granular Day-Basis Log
              </h3>
              <div className="border-2 border-black overflow-hidden shadow-2xl">
                <Table className="font-black text-black tabular-nums">
                  <TableHeader className="bg-slate-900 border-b-2 border-black">
                    <TableRow className="text-white">
                      <TableHead className="text-[9px] font-black uppercase tracking-widest py-4 pl-8 text-white border-r border-white/10">Date Anchor</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase tracking-widest py-4 text-white border-r border-white/10">Day-End Balance (৳)</TableHead>
                      <TableHead className="text-right text-[9px] font-black uppercase tracking-widest py-4 text-white border-r border-white/10">Daily Interest Portion (৳)</TableHead>
                      <TableHead className="text-center text-[9px] font-black uppercase tracking-widest py-4 pr-8 text-white">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-[11px]">
                    {viewingDetails?.dailyLog.map((day: any, i: number) => (
                      <TableRow key={i} className={cn("hover:bg-slate-50 border-b border-black/10", day.hasActivity && "bg-amber-50/50")}>
                        <td className="font-mono p-4 pl-8 border-r border-black/10 text-indigo-700">{day.date}</td>
                        <td className="text-right p-4 border-r border-black/10 font-bold">{day.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="text-right p-4 border-r border-black/10 font-black text-emerald-700">{day.interest.toLocaleString(undefined, { minimumFractionDigits: 6 })}</td>
                        <td className="text-center pr-8">
                          {day.hasActivity ? <Badge className="bg-amber-500 text-white text-[8px] h-4 uppercase font-black rounded-none shadow-sm">VOUCHER</Badge> : <span className="text-[8px] text-slate-300 font-black uppercase tracking-widest">STABLE</span>}
                        </td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="bg-slate-900 p-8 border-4 border-black flex gap-6 items-start shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><ShieldCheck className="size-24" /></div>
              <ShieldCheck className="size-8 text-emerald-400 mt-0.5 shrink-0 relative z-10" />
              <div className="space-y-3 relative z-10">
                <p className="text-[11px] font-black uppercase text-emerald-400 tracking-[0.4em]">Project Folder Vault Verification</p>
                <p className="text-[13px] leading-relaxed text-slate-300 font-black italic uppercase">
                  This high-precision breakdown captures exactly how every transaction impacts interest accrual on a day-basis. The matrix utilizes local hardware performance to calculate balances daily: <span className="text-white underline decoration-emerald-500">(Daily Balance × Tiered Annual Rate) / 365</span>. This ensures absolute fairness for mid-month loan movements.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-100 p-8 border-t-4 border-black text-right sticky bottom-0 z-20">
            <Button variant="ghost" onClick={() => setViewingDetails(null)} className="font-black text-xs uppercase tracking-widest border-2 border-black h-12 px-12 bg-white hover:bg-slate-50 shadow-lg">Close Audit Trace</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* HIDDEN PRINT VIEW */}
      <div className="hidden print:block font-ledger text-black">
        <div className="text-center space-y-2 mb-12 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-[0.4em] mt-1">Employees' Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.2em] mt-8">Day-Product Special Interest Audit Statement</h2>
          <div className="flex justify-between text-[11px] font-black pt-10 px-4">
            <span className="bg-black text-white px-6 py-1.5 rounded-none shadow-md uppercase tracking-widest">Audit Range: {dateRange.start} to {dateRange.end}</span>
            <span className="text-slate-500 uppercase tracking-widest">Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse border-4 border-black text-black font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 border-b-4 border-black">
              <th className="border-r border-black p-3 text-center uppercase tracking-widest w-[80px]">PayID</th>
              <th className="border-r border-black p-3 text-left uppercase tracking-widest">Member Name & Rank</th>
              <th className="border-r border-black p-3 text-center uppercase tracking-widest w-[80px]">Days</th>
              <th className="border-r border-black p-3 text-right uppercase tracking-widest">Opening Bal</th>
              <th className="border-r border-black p-3 text-right uppercase tracking-widest">Closing Bal</th>
              <th className="p-3 text-right uppercase tracking-widest bg-slate-50">Aggregate Profit</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border-b border-black">
                <td className="border-r border-black p-3 text-center font-mono font-black">{r.memberIdNumber}</td>
                <td className="border-r border-black p-3">
                  <span className="font-black uppercase text-sm block">{r.name}</span>
                  <span className="text-[8px] uppercase tracking-widest opacity-60">{r.designation}</span>
                </td>
                <td className="border-r border-black p-3 text-center">{r.days}</td>
                <td className="border-r border-black p-3 text-right">{r.openingBalance.toLocaleString()}</td>
                <td className="border-r border-black p-3 text-right">{r.closingBalance.toLocaleString()}</td>
                <td className="p-3 text-right font-black text-base underline decoration-black decoration-2 bg-slate-50">৳ {r.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black h-16 border-t-4 border-black">
              <td colSpan={5} className="p-4 text-right uppercase tracking-[0.3em] text-sm">Grand Institutional Yield Total:</td>
              <td className="p-4 text-right underline decoration-double text-xl font-black bg-white">৳ {results.reduce((sum, r) => sum + r.totalInterest, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-40 grid grid-cols-3 gap-20 text-[12px] font-black text-center uppercase tracking-widest">
          <div className="border-t-2 border-black pt-4">Prepared by</div>
          <div className="border-t-2 border-black pt-4">Checked by</div>
          <div className="border-t-2 border-black pt-4">Approved By Trustee</div>
        </div>
        
        <div className="mt-20 pt-4 border-t border-black flex justify-between items-center text-[8px] text-slate-400 font-black uppercase tracking-widest">
          <span>PBS CPF Matrix v1.2</span>
          <span className="italic">Developed by: Ariful Islam, AGM Finance, Gazipur PBS-2</span>
        </div>
      </div>
    </div>
  );
}
