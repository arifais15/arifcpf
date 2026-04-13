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
    const targetMembers = selectedMember === "all" ? (members || []) : (members?.filter(m => m.id === selectedMember) || []);
    const auditResults = [];
    for (const member of targetMembers) {
      const summariesRef = collection(firestore, "members", member.id, "fundSummaries");
      const snapshot = await getDocs(query(summariesRef, orderBy("summaryDate", "asc")));
      const allEntries = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      let totalInterest = 0;
      let dailyLog = [];
      let currentDate = new Date(auditStart);
      const openingRefDate = new Date(auditStart);
      openingRefDate.setDate(openingRefDate.getDate() - 1);
      let runningBalance = allEntries.filter((e: any) => new Date(e.summaryDate) <= openingRefDate).reduce((sum, e: any) => sum + ((Number(e.employeeContribution)||0) - (Number(e.loanWithdrawal)||0) + (Number(e.loanRepayment)||0) + (Number(e.profitEmployee)||0) + (Number(e.profitLoan)||0) + (Number(e.pbsContribution)||0) + (Number(e.profitPbs)||0)), 0);
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
      allEntries.forEach((e: any) => { if (new Date(e.summaryDate) <= auditEnd) { currentEmpFund += ((Number(e.employeeContribution)||0) - (Number(e.loanWithdrawal)||0) + (Number(e.loanRepayment)||0) + (Number(e.profitEmployee)||0) + (Number(e.profitLoan)||0)); currentPbsFund += ((Number(e.pbsContribution)||0) + (Number(e.profitPbs)||0)); } });
      const totalFund = currentEmpFund + currentPbsFund;
      auditResults.push({ memberId: member.id, memberIdNumber: member.memberIdNumber, name: member.name, designation: member.designation, openingBalance, closingBalance: runningBalance, totalInterest, empProfit: totalFund > 0 ? (totalInterest * currentEmpFund) / totalFund : totalInterest / 2, pbsProfit: totalFund > 0 ? (totalInterest * currentPbsFund) / totalFund : totalInterest / 2, dailyLog, days: dailyLog.length });
    }
    setResults(auditResults);
    setIsCalculating(false);
  };

  const handlePostAll = async () => {
    if (!postingDate || results.length === 0) return;
    setIsCalculating(true);
    for (const res of results) {
      if (res.totalInterest <= 0) continue;
      const entry = { summaryDate: postingDate, particulars: `Annual Profit (DP Basis) ${dateRange.start} to ${dateRange.end}`, employeeContribution: 0, loanWithdrawal: 0, loanRepayment: 0, profitEmployee: Math.round(res.empProfit), profitLoan: 0, pbsContribution: 0, profitPbs: Math.round(res.pbsProfit), lastUpdateDate: new Date().toISOString(), createdAt: new Date().toISOString(), memberId: res.memberId, isSystemGenerated: true };
      await addDocumentNonBlocking(collection(firestore, "members", res.memberId, "fundSummaries"), entry);
    }
    setIsCalculating(false);
    setResults([]);
    toast({ title: "Posted", description: "Special interest distribution synchronized." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/investments" className="p-2 border-2 border-black rounded-full hover:bg-slate-100 transition-colors"><ArrowLeft className="size-6" /></Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Special Interest (Day-Product)</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Mid-month balance tracking • Fraction month settlement audit</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} disabled={results.length === 0} className="gap-2 h-11 font-black bg-black text-white shadow-lg uppercase tracking-widest">
            <Printer className="size-4" /> Print Statement
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-xl flex flex-col gap-6 no-print">
        <div className="grid gap-6 md:grid-cols-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-black ml-1">Member Focus</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="h-11 font-black border-black border-2"><SelectValue /></SelectTrigger>
              <SelectContent>{members?.map(m => <SelectItem key={m.id} value={m.id} className="font-black text-xs uppercase">{m.memberIdNumber} - {m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-black ml-1">Audit Range</Label>
            <div className="flex items-center gap-3 border-2 border-black p-1.5 rounded-lg">
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-none font-black" />
              <ArrowRightLeft className="size-3" />
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-none font-black" />
            </div>
          </div>
          <Button onClick={handleCalculate} disabled={isCalculating || isMembersLoading} className="h-11 font-black bg-black text-white uppercase tracking-widest shadow-xl">
            {isCalculating ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            Run DP Audit
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
                <Label className="text-[10px] uppercase font-black text-black">Ledger Post Date</Label>
                <Input type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} className="h-8 font-black text-xs border-black border-2" />
              </div>
              <Button onClick={handlePostAll} disabled={!postingDate} className="bg-black text-white h-10 font-black uppercase text-[10px] tracking-widest">
                <ShieldCheck className="size-4" /> Sync All
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print">
            <Table className="text-black font-black">
              <TableHeader className="bg-slate-100 border-b-2 border-black">
                <TableRow>
                  <TableHead className="py-4 font-black uppercase text-[10px] tracking-widest pl-6">ID No</TableHead>
                  <TableHead className="py-4 font-black uppercase text-[10px] tracking-widest">Details</TableHead>
                  <TableHead className="text-right py-4 font-black uppercase text-[10px] tracking-widest">Days</TableHead>
                  <TableHead className="text-right py-4 font-black uppercase text-[10px] tracking-widest">Total Interest</TableHead>
                  <TableHead className="text-center py-4 font-black uppercase text-[10px] tracking-widest pr-6">Audit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
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

      <div className="hidden print:block print-container text-black font-black">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.4em] mt-4">Day-Product Special Interest Statement</h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <span>Period: {dateRange.start} to {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <table className="w-full text-[9px] border-collapse border-2 border-black tabular-nums">
          <thead><tr className="bg-slate-100 font-black"><th className="border border-black p-2">ID No</th><th className="border border-black p-2 text-left">Name & Designation</th><th className="border border-black p-2 text-right">Days</th><th className="border border-black p-2 text-right">Opening Bal</th><th className="border border-black p-2 text-right">Total Interest</th></tr></thead>
          <tbody>{results.map((r, i) => (<tr key={i} className="border-b border-black"><td className="border border-black p-2 text-center font-mono">{r.memberIdNumber}</td><td className="border border-black p-2 uppercase"><b>{r.name}</b><br/>{r.designation}</td><td className="border border-black p-2 text-right">{r.days}</td><td className="border border-black p-2 text-right">{r.openingBalance.toLocaleString()}</td><td className="border border-black p-2 text-right font-black">{r.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>))}</tbody>
          <tfoot><tr className="bg-slate-50 font-black h-12"><td colSpan={4} className="border border-black p-2 text-right uppercase tracking-widest">Grand Total:</td><td className="border border-black p-2 text-right text-lg underline decoration-double">৳ {results.reduce((s, r) => s + r.totalInterest, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr></tfoot>
        </table>
        <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center uppercase tracking-widest">
          <div className="border-t-2 border-black pt-4">Prepared by</div>
          <div className="border-t-2 border-black pt-4">Checked by</div>
          <div className="border-t-2 border-black pt-4">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
