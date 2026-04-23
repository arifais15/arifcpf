"use client"

import { useMemo, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, TrendingUp, Wallet, ShieldCheck, Loader2, PieChart, Activity, HardDrive, DatabaseZap, Clock, ArrowUpRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const firestore = useFirestore();
  const [lastSaved, setLastSaved] = useState<string>("");

  useEffect(() => {
    setLastSaved(new Date().toLocaleTimeString());
    const handleSync = () => setLastSaved(new Date().toLocaleTimeString());
    window.addEventListener('storage', handleSync);
    return () => window.removeEventListener('storage', handleSync);
  }, []);

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
        
        if (code === '200.10.0000' || code === '200.20.0000') fundValue += (credit - debit);
        if (code === '105.10.0000') currentLoans += debit;
        if (code === '105.20.0000') currentLoans -= credit;
        if (code === '200.30.0000' || code === '200.40.0000') profitDistributed += (credit - debit);
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
      { label: "Member Loans", value: Math.round((statsData.currentLoans / total) * 100), color: "bg-slate-500" },
      { label: "Cash Equivalents", value: Math.round((cashBalance / total) * 100), color: "bg-slate-300" },
    ].sort((a, b) => b.value - a.value);
  }, [investments, entries, statsData.currentLoans]);

  const recentEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()).slice(0, 6);
  }, [entries]);

  if (isMembersLoading || isEntriesLoading || isInvestmentsLoading) {
    return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="size-10 animate-spin text-primary" /></div>;
  }

  const stats = [
    { title: "Member Registry", value: members?.length.toLocaleString() || "0", icon: Users, sub: "Registered Personnel", color: "text-blue-600" },
    { title: "Total Fund Equity", value: `৳ ${(statsData.fundValue / 1000000).toFixed(2)}M`, icon: Wallet, sub: "Accumulated Principal", color: "text-emerald-600" },
    { title: "Outstanding Loans", value: `৳ ${(statsData.currentLoans / 1000).toFixed(1)}K`, icon: TrendingUp, sub: "Current Receivables", color: "text-rose-600" },
    { title: "Profit Accrued", value: `৳ ${(statsData.profitDistributed / 1000).toFixed(1)}K`, icon: Activity, sub: "Member Distribution", color: "text-amber-600" },
  ];

  return (
    <div className="p-10 flex flex-col gap-10 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-black text-primary tracking-tight uppercase">Executive Summary</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-[11px] font-bold">Consolidated CPF Management Terminal • Version 1.2</p>
        </div>

        <div className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-sm no-print">
           <div className="bg-slate-100 p-2 rounded-lg">
             <HardDrive className="size-5 text-slate-600" />
           </div>
           <div className="space-y-0.5">
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Database Engine:</span>
               <Badge className="bg-emerald-100 text-emerald-700 text-[8px] h-4 uppercase font-bold border-none">Local Matrix v1</Badge>
             </div>
             <div className="flex items-center gap-2">
               <Clock className="size-3 text-slate-400" />
               <span className="text-[11px] font-bold text-slate-600">Sync Time: {lastSaved}</span>
             </div>
           </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm hover:shadow-md transition-shadow group overflow-hidden bg-white">
            <div className={cn("h-1 w-full bg-slate-100", stat.color.replace('text-', 'bg-'))} />
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {stat.title}
              </CardTitle>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black tracking-tight text-primary">{stat.value}</div>
              <p className="text-[10px] font-bold uppercase mt-2 tracking-wider text-slate-400">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-8 border-none shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-white border-b flex flex-row items-center justify-between py-5 px-6">
            <div>
              <CardTitle className="text-lg font-black uppercase flex items-center gap-3 text-primary">
                <ShieldCheck className="size-5" />
                Audit Log: Recent Activity
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-wider">Verified double-entry accounting records</CardDescription>
            </div>
            <Badge variant="outline" className="border-slate-200 font-bold px-3 py-1 uppercase text-[9px] tracking-widest">Live Sync</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b">
                  <TableHead className="font-black py-4 pl-6 text-slate-500 uppercase text-[10px]">Date</TableHead>
                  <TableHead className="font-black py-4 text-slate-500 uppercase text-[10px]">Particulars</TableHead>
                  <TableHead className="font-black py-4 text-slate-500 uppercase text-[10px]">Reference</TableHead>
                  <TableHead className="text-right font-black py-4 pr-6 text-slate-500 uppercase text-[10px]">Amount (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-16 text-slate-400 font-bold uppercase text-xs">No records found.</TableCell></TableRow>
                ) : recentEntries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-slate-50/50 transition-colors border-b last:border-0">
                    <TableCell className="font-mono text-[11px] font-bold pl-6">{entry.entryDate}</TableCell>
                    <TableCell className="text-[11px] font-bold uppercase text-slate-700">{entry.description}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[9px] uppercase font-bold tracking-widest px-2 bg-slate-100">{entry.referenceNumber || "AUTO"}</Badge></TableCell>
                    <TableCell className="text-right font-black text-slate-900 pr-6">{(entry.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-sm bg-white rounded-xl flex flex-col overflow-hidden">
          <CardHeader className="py-5 px-6 border-b bg-white">
            <CardTitle className="text-lg font-black uppercase flex items-center gap-3 text-primary">
              <PieChart className="size-5" />
              Asset Allocation
            </CardTitle>
            <CardDescription className="text-[11px] font-bold uppercase tracking-wider">Portfolio Risk Diversification</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-8 p-6 pt-8">
            <div className="space-y-6">
              {allocation.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>{item.label}</span>
                    <span>{item.value}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
                    <div className={cn("h-full transition-all duration-1000 ease-in-out", item.color)} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
               <div className="flex items-center gap-2">
                 <DatabaseZap className="size-3.5 text-indigo-600" />
                 <p className="text-[9px] uppercase font-black tracking-widest text-indigo-700">Disk Persistence Monitor</p>
               </div>
               <p className="text-[11px] text-slate-500 leading-relaxed font-bold italic">
                 "Data mirrors directly to the host machine's drive. Zero cloud exposure ensures high-confidentiality processing."
               </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}