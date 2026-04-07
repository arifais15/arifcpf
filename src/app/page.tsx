
"use client"

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, ShieldCheck, Loader2, PieChart } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";

export default function DashboardPage() {
  const firestore = useFirestore();

  // Fetch collections
  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: entries, isLoading: isEntriesLoading } = useCollection(entriesRef);

  const investmentsRef = useMemoFirebase(() => collection(firestore, "investmentInstruments"), [firestore]);
  const { data: investments, isLoading: isInvestmentsLoading } = useCollection(investmentsRef);

  // Aggregate Data
  const statsData = useMemo(() => {
    if (!entries) return { fundValue: 0, currentLoans: 0, profitDistributed: 0 };

    let fundValue = 0; // Balance of 225.10 and 225.20
    let currentLoans = 0; // Balance of 105.10 - 105.20
    let profitDistributed = 0; // Balance of 225.30 and 225.40

    entries.forEach(entry => {
      (entry.lines || []).forEach((line: any) => {
        const code = line.accountCode;
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;

        // Fund Value (Equity/Liabilities - Credits increase)
        if (code === '225.10.0000' || code === '225.20.0000') {
          fundValue += (credit - debit);
        }

        // Current Loans (Assets - Debits increase)
        if (code === '105.10.0000') currentLoans += debit;
        if (code === '105.20.0000') currentLoans -= credit;

        // Profit (Equity/Liabilities - Credits increase)
        if (code === '225.30.0000' || code === '225.40.0000') {
          profitDistributed += (credit - debit);
        }
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
    const loansTotal = statsData.currentLoans;
    
    const total = fdrTotal + bondsTotal + loansTotal + cashBalance || 1; // Avoid divide by zero

    return [
      { label: "Fixed Deposits (FDR)", value: Math.round((fdrTotal / total) * 100), color: "bg-primary" },
      { label: "Treasury Bonds", value: Math.round((bondsTotal / total) * 100), color: "bg-accent" },
      { label: "Member Loans", value: Math.round((loansTotal / total) * 100), color: "bg-slate-400" },
      { label: "Cash Equivalents", value: Math.round((cashBalance / total) * 100), color: "bg-emerald-400" },
    ].sort((a, b) => b.value - a.value);
  }, [investments, entries, statsData.currentLoans]);

  const recentEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
      .slice(0, 5);
  }, [entries]);

  const stats = [
    { title: "Total Members", value: members?.length.toLocaleString() || "0", icon: Users, change: "+0", trend: "up" },
    { title: "Total Fund Value", value: `৳ ${(statsData.fundValue / 1000000).toFixed(2)}M`, icon: Wallet, change: "Real-time", trend: "up" },
    { title: "Current Loans", value: `৳ ${(statsData.currentLoans / 1000).toFixed(0)}K`, icon: TrendingUp, change: "Outstanding", trend: "up" },
    { title: "Profit Distributed", value: `৳ ${(statsData.profitDistributed / 1000).toFixed(0)}K`, icon: ArrowUpRight, change: "Cumulative", trend: "up" },
  ];

  if (isMembersLoading || isEntriesLoading || isInvestmentsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Synchronizing Ledger Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-primary tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground">Welcome back. Real-time fund metrics derived from dual-accounting entries.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm bg-card hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs flex items-center gap-1 mt-1">
                {stat.trend === "up" ? (
                  <span className="text-emerald-600 flex items-center">{stat.change}</span>
                ) : (
                  <span className="text-rose-600 flex items-center">{stat.change}</span>
                )}
                <span className="text-muted-foreground ml-1">status</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Latest Journal Entries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No transactions recorded yet.</TableCell>
                  </TableRow>
                ) : recentEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">{entry.entryDate}</TableCell>
                    <TableCell className="text-sm font-medium">{entry.description}</TableCell>
                    <TableCell><Badge variant="outline">{entry.referenceNumber || "N/A"}</Badge></TableCell>
                    <TableCell className="text-right font-bold text-primary">৳ {(entry.totalAmount || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <PieChart className="size-5 text-accent" />
              Fund Asset Allocation
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 pt-4">
            <div className="space-y-4">
              {allocation.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">{item.label}</span>
                    <span className="font-bold">{item.value}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden shadow-inner">
                    <div className={`h-full ${item.color} transition-all duration-1000`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
              {allocation.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">No asset data available.</p>}
            </div>
            <div className="mt-4 p-4 bg-accent/5 rounded-lg border border-accent/10">
               <p className="text-[10px] uppercase font-bold text-accent tracking-wider mb-1">Audit Note</p>
               <p className="text-[11px] text-slate-600 leading-relaxed italic">Allocation is automatically adjusted based on current investment principal and bank ledger balances.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
