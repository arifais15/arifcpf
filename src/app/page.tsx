"use client"

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, TrendingUp, Wallet, ArrowUpRight, ShieldCheck, Loader2, PieChart, Activity } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const firestore = useFirestore();

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: entries, isLoading: isEntriesLoading } = useCollection(entriesRef);

  const investmentsRef = useMemoFirebase(() => collection(firestore, "investmentInstruments"), [firestore]);
  const { data: investments, isLoading: isInvestmentsLoading } = useCollection(investmentsRef);

  const statsData = useMemo(() => {
    if (!entries) return { fundValue: 0, currentLoans: 0, profitDistributed: 0 };
    let fundValue = 0;
    let currentLoans = 0;
    let profitDistributed = 0;
    entries.forEach(entry => {
      (entry.lines || []).forEach((line: any) => {
        const code = line.accountCode;
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        if (code === '225.10.0000' || code === '225.20.0000') fundValue += (credit - debit);
        if (code === '105.10.0000') currentLoans += debit;
        if (code === '105.20.0000') currentLoans -= credit;
        if (code === '225.30.0000' || code === '225.40.0000') profitDistributed += (credit - debit);
      });
    });
    return { fundValue, currentLoans, profitDistributed };
  }, [entries]);

  const allocation = useMemo(() => {
    if (!investments || !entries) return [];
    let cashBalance = 0;
    entries.forEach(entry => {
      (entry.lines || []).forEach((line: any) => {
        if (line.accountCode?.startsWith('131.')) {
          cashBalance += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        }
      });
    });
    const fdrTotal = investments.filter(i => i.instrumentType === 'FDR').reduce((sum, i) => sum + (Number(i.principalAmount) || 0), 0);
    const bondsTotal = investments.filter(i => i.instrumentType === 'Govt. Treasury Bond').reduce((sum, i) => sum + (Number(i.principalAmount) || 0), 0);
    const total = fdrTotal + bondsTotal + statsData.currentLoans + cashBalance || 1;
    return [
      { label: "Fixed Deposits (FDR)", value: Math.round((fdrTotal / total) * 100), color: "bg-primary" },
      { label: "Treasury Bonds", value: Math.round((bondsTotal / total) * 100), color: "bg-accent" },
      { label: "Member Loans", value: Math.round((statsData.currentLoans / total) * 100), color: "bg-slate-400" },
      { label: "Cash Equivalents", value: Math.round((cashBalance / total) * 100), color: "bg-emerald-400" },
    ].sort((a, b) => b.value - a.value);
  }, [investments, entries, statsData.currentLoans]);

  const recentEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()).slice(0, 6);
  }, [entries]);

  if (isMembersLoading || isEntriesLoading || isInvestmentsLoading) {
    return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="size-10 animate-spin text-primary" /></div>;
  }

  const stats = [
    { title: "Member Registry", value: members?.length.toLocaleString() || "0", icon: Users, sub: "Registered Personnel", color: "text-blue-600" },
    { title: "Total Fund Equity", value: `৳ ${(statsData.fundValue / 1000000).toFixed(2)}M`, icon: Wallet, sub: "Accumulated Principal", color: "text-emerald-600" },
    { title: "Outstanding Loans", value: `৳ ${(statsData.currentLoans / 1000).toFixed(1)}K`, icon: TrendingUp, sub: "Current Receivables", color: "text-amber-600" },
    { title: "Profit Accrued", value: `৳ ${(statsData.profitDistributed / 1000).toFixed(1)}K`, icon: Activity, sub: "Member Distribution", color: "text-accent" },
  ];

  return (
    <div className="p-10 flex flex-col gap-12 bg-background min-h-screen">
      <div className="flex flex-col gap-2">
        <h1 className="text-5xl font-black text-primary tracking-tight">Executive Summary</h1>
        <p className="text-muted-foreground font-bold uppercase tracking-[0.3em] text-xs opacity-60">Contributory Provident Fund Management Terminal</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-xl bg-card hover:translate-y-[-6px] transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-[11px] font-black uppercase text-slate-500 tracking-widest">
                {stat.title}
              </CardTitle>
              <stat.icon className={cn("h-6 w-6 opacity-40", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black tracking-tight">{stat.value}</div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase mt-3 opacity-60 tracking-wider">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <Card className="lg:col-span-8 border-none shadow-2xl overflow-hidden rounded-3xl">
          <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-6 px-8">
            <div>
              <CardTitle className="text-xl font-black flex items-center gap-4">
                <ShieldCheck className="size-7 text-primary" />
                Audit Log: Recent Transactions
              </CardTitle>
              <CardDescription className="text-sm font-semibold opacity-70">Verified double-entry accounting records</CardDescription>
            </div>
            <Badge variant="outline" className="bg-white border-slate-300 font-bold px-3 py-1">Live Sync</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 border-b">
                  <TableHead className="font-black py-5 pl-8">Date</TableHead>
                  <TableHead className="font-black py-5">Transaction Details</TableHead>
                  <TableHead className="font-black py-5">Reference</TableHead>
                  <TableHead className="text-right font-black py-5 pr-8">Amount (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 italic">No historical transactions found.</TableCell></TableRow>
                ) : recentEntries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-mono text-sm font-bold pl-8">{entry.entryDate}</TableCell>
                    <TableCell className="text-sm font-bold text-slate-700">{entry.description}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[11px] uppercase font-bold tracking-wider px-2">{entry.referenceNumber || "AUTO"}</Badge></TableCell>
                    <TableCell className="text-right font-black text-primary pr-8">{(entry.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-2xl bg-white rounded-3xl flex flex-col overflow-hidden">
          <CardHeader className="py-6 px-8 border-b bg-slate-50/30">
            <CardTitle className="text-xl font-black flex items-center gap-4">
              <PieChart className="size-7 text-accent" />
              Asset Allocation
            </CardTitle>
            <CardDescription className="text-sm font-semibold opacity-70">Diversification of Fund Portfolio</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-10 p-8">
            <div className="space-y-8">
              {allocation.map((item) => (
                <div key={item.label} className="space-y-3">
                  <div className="flex justify-between text-[12px] font-black uppercase tracking-widest text-slate-500">
                    <span>{item.label}</span>
                    <span className="text-slate-900">{item.value}%</span>
                  </div>
                  <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border">
                    <div className={cn("h-full transition-all duration-1000 ease-in-out", item.color)} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto p-6 bg-accent/5 rounded-2xl border border-accent/10 shadow-sm">
               <p className="text-[11px] uppercase font-black text-accent tracking-[0.2em] mb-3 flex items-center gap-3">
                 <ShieldCheck className="size-4" /> Integrity Check
               </p>
               <p className="text-xs text-slate-600 leading-relaxed italic font-semibold">Metrics are derived dynamically from verified ledger balances across all investment portfolios and cash accounts.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}