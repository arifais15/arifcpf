"use client"

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_OF_ACCOUNTS as INITIAL_COA, type COAEntry } from "@/lib/coa-data";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Loader2, Printer, Wallet, TrendingUp, ArrowDownUp, Calendar, FileText, PieChart, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedFY, setSelectedFY] = useState("");

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData, isLoading: isCoaLoading } = useCollection(coaRef);

  const activeCOA = useMemo(() => {
    if (!coaData || coaData.length === 0) return INITIAL_COA;
    const mergedMap = new Map<string, any>();
    INITIAL_COA.forEach(acc => mergedMap.set(acc.code, acc));
    coaData.forEach(acc => mergedMap.set(acc.code, acc));
    return Array.from(mergedMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [coaData]);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: entries, isLoading: isEntriesLoading } = useCollection(entriesRef);

  const availableFYs = useMemo(() => {
    if (!entries || entries.length === 0) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const currentFY = month >= 7 
        ? `${year}-${(year + 1).toString().slice(-2)}` 
        : `${year - 1}-${year.toString().slice(-2)}`;
      return [currentFY];
    }
    const fys = new Set<string>();
    entries.forEach(entry => {
      const date = new Date(entry.entryDate);
      if (isNaN(date.getTime())) return;
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const fy = month >= 7 
        ? `${year}-${(year + 1).toString().slice(-2)}` 
        : `${year - 1}-${year.toString().slice(-2)}`;
      fys.add(fy);
    });
    return Array.from(fys).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  useEffect(() => {
    if (availableFYs.length > 0 && (!selectedFY || !availableFYs.includes(selectedFY))) {
      setSelectedFY(availableFYs[0]);
    }
  }, [availableFYs, selectedFY]);

  const fyDates = useMemo(() => {
    if (!selectedFY) return { start: '', end: '', display: '' };
    const parts = selectedFY.split("-");
    const startYear = parseInt(parts[0]);
    const endYear = startYear + 1;
    return {
      start: `${startYear}-07-01`,
      end: `${endYear}-06-30`,
      display: `FY ${selectedFY}`
    };
  }, [selectedFY]);

  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    if (!entries || !selectedFY) return map;
    const endDate = new Date(fyDates.end).getTime();
    entries.forEach(entry => {
      const entryDate = new Date(entry.entryDate).getTime();
      if (entryDate > endDate) return;
      const entryLines = entry.lines || [];
      entryLines.forEach((line: any) => {
        const code = line.accountCode;
        const coa = activeCOA.find(a => a.code === code);
        if (!coa) return;
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        let normalizedAmount = 0;
        if (coa.balance === 'Debit') {
          normalizedAmount = debit - credit;
        } else {
          normalizedAmount = credit - debit;
        }
        if (!map[code]) map[code] = 0;
        map[code] += normalizedAmount;
      });
    });
    return map;
  }, [entries, activeCOA, fyDates.end, selectedFY]);

  const periodBalances = useMemo(() => {
    const map: Record<string, number> = {};
    if (!entries || !selectedFY) return map;
    const startDate = new Date(fyDates.start).getTime();
    const endDate = new Date(fyDates.end).getTime();
    entries.forEach(entry => {
      const entryDate = new Date(entry.entryDate).getTime();
      if (entryDate < startDate || entryDate > endDate) return;
      const entryLines = entry.lines || [];
      entryLines.forEach((line: any) => {
        const code = line.accountCode;
        const coa = activeCOA.find(a => a.code === code);
        if (!coa) return;
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        let normalizedAmount = 0;
        if (coa.balance === 'Debit') {
          normalizedAmount = debit - credit;
        } else {
          normalizedAmount = credit - debit;
        }
        if (!map[code]) map[code] = 0;
        map[code] += normalizedAmount;
      });
    });
    return map;
  }, [entries, activeCOA, fyDates.start, fyDates.end, selectedFY]);

  const formatCurrency = (val: number) => {
    const absVal = Math.abs(val);
    const formatted = new Intl.NumberFormat('en-BD', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(absVal);
    return val < 0 ? `(${formatted})` : formatted;
  };

  const ClassifiedSection = ({ title, accounts, balancesMap, className }: { title: string, accounts: COAEntry[], balancesMap: Record<string, number>, className?: string }) => {
    const groups: { header: COAEntry; items: COAEntry[]; total: number }[] = [];
    let currentGroup: { header: COAEntry; items: COAEntry[]; total: number } | null = null;

    accounts.forEach(acc => {
      if (acc.isHeader) {
        if (currentGroup && currentGroup.items.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = { header: acc, items: [], total: 0 };
      } else if (currentGroup) {
        const val = balancesMap[acc.code] || 0;
        if (val !== 0) {
          currentGroup.items.push(acc);
          currentGroup.total += val;
        }
      }
    });
    if (currentGroup && currentGroup.items.length > 0) groups.push(currentGroup);
    const grandTotal = groups.reduce((sum, g) => sum + g.total, 0);

    return (
      <div className={cn("space-y-6", className)}>
        <h3 className="text-sm font-black border-b-2 border-black pb-1 uppercase tracking-widest text-primary">{title}</h3>
        <div className="space-y-6">
          {groups.map((group, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between font-black text-xs text-slate-900 bg-slate-50 p-1 rounded">
                <span>{group.header.name}</span>
              </div>
              <div className="pl-6 space-y-1">
                {group.items.map(item => (
                  <div key={item.code} className="flex justify-between text-[11px] py-1 border-b border-dotted border-slate-300">
                    <span className="flex gap-6">
                       <span className="text-slate-400 font-mono w-[90px] font-bold">{item.code}</span>
                       <span className="font-bold text-slate-700">{item.name}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(balancesMap[item.code])}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-black text-xs pt-2 border-t border-slate-400 mt-2 pl-6 pr-1 italic">
                <span>Total {group.header.name}</span>
                <span className="font-mono">{formatCurrency(group.total)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-black text-[13px] bg-slate-900 text-white p-3 rounded-xl mt-6 uppercase tracking-wider">
          <span>Total {title}</span>
          <span className="font-mono underline decoration-double">৳ {formatCurrency(grandTotal)}</span>
        </div>
      </div>
    );
  };

  const ReportHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="text-center mb-10 border-b-2 border-black pb-6">
      <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">{pbsName}</h1>
      <h2 className="text-lg md:text-xl font-black text-slate-800 mt-2 font-ledger uppercase underline decoration-2 underline-offset-8">{title}</h2>
      <p className="text-[11px] text-slate-600 font-bold uppercase tracking-[0.3em] mt-4 opacity-70">{subtitle}</p>
    </div>
  );

  if (isCoaLoading || isEntriesLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  const assetAccounts = activeCOA.filter(a => a.type === 'Asset' || a.type === 'Contra-Asset' || (a.isHeader && a.code.startsWith('1')));
  const liabilityEquityAccounts = activeCOA.filter(a => a.type === 'Liability' || a.type === 'Equity' || (a.isHeader && a.code.startsWith('2')));
  const incomeAccounts = activeCOA.filter(a => a.type === 'Income');
  const expenseAccounts = activeCOA.filter(a => a.type === 'Expense');

  const totalIncome = incomeAccounts.reduce((sum, acc) => sum + (periodBalances[acc.code] || 0), 0);
  const totalExpense = expenseAccounts.reduce((sum, acc) => sum + (periodBalances[acc.code] || 0), 0);

  return (
    <div className="p-10 flex flex-col gap-10 bg-background min-h-screen font-ledger text-slate-900">
      <div className="flex items-center justify-between no-print max-w-5xl mx-auto w-full bg-card p-8 rounded-3xl border shadow-xl">
        <div className="flex items-center gap-5">
          <div className="bg-primary/10 p-4 rounded-2xl">
             <ShieldCheck className="size-10 text-primary" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tight">Financial Terminal</h1>
            <p className="text-sm text-muted-foreground uppercase tracking-[0.2em] font-black opacity-60">Professional Reporting Suite • {fyDates.display}</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] uppercase font-black text-slate-500 tracking-wider">Active Fiscal Year</Label>
            <Select value={selectedFY} onValueChange={setSelectedFY}>
              <SelectTrigger className="w-[180px] h-11 text-sm font-black border-2 border-slate-200">
                <SelectValue placeholder="Select FY" />
              </SelectTrigger>
              <SelectContent>
                {availableFYs.map(fy => <SelectItem key={fy} value={fy}>Fiscal Year {fy}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => window.print()} className="h-11 gap-2 font-black px-8 shadow-xl shadow-primary/30 rounded-xl">
            <Printer className="size-5" />
            Print Reports
          </Button>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full max-w-5xl mx-auto">
        <TabsList className="grid w-full grid-cols-3 mb-10 no-print h-16 bg-white border-2 border-slate-200 p-1.5 rounded-[20px] shadow-sm">
          <TabsTrigger value="position" className="gap-3 rounded-xl text-[15px] font-black transition-all data-[state=active]:bg-primary data-[state=active]:text-white"><Wallet className="size-5" /> Position</TabsTrigger>
          <TabsTrigger value="income" className="gap-3 rounded-xl text-[15px] font-black transition-all data-[state=active]:bg-primary data-[state=active]:text-white"><TrendingUp className="size-5" /> Income</TabsTrigger>
          <TabsTrigger value="receipts" className="gap-3 rounded-xl text-[15px] font-black transition-all data-[state=active]:bg-primary data-[state=active]:text-white"><ArrowDownUp className="size-5" /> Receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="position">
          <Card className="border shadow-2xl rounded-none bg-white print-container print-portrait-fix mx-auto">
            <CardContent className="p-16 print:p-0">
              <ReportHeader title="Statement of Financial Position" subtitle={`As of June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="space-y-16">
                <ClassifiedSection title="Institutional Assets" accounts={assetAccounts} balancesMap={balances} />
                <ClassifiedSection title="Equity and Fund Liabilities" accounts={liabilityEquityAccounts} balancesMap={balances} />
              </div>
              <div className="mt-24 grid grid-cols-3 gap-12 text-[12px] font-black text-center">
                 <div className="border-t-2 border-black pt-3">Accountant / AGM(F)</div>
                 <div className="border-t-2 border-black pt-3">Internal Auditor / DGM</div>
                 <div className="border-t-2 border-black pt-3">Approved By Trustee</div>
              </div>
              <div className="mt-16 pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">
                <span>CPF Management Software</span>
                <span className="italic">Developed by: Ariful Islam,AGMF,Gazipur PBS-2</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card className="border shadow-2xl rounded-none bg-white print-container print-portrait-fix mx-auto">
            <CardContent className="p-16 print:p-0">
              <ReportHeader title="Statement of Comprehensive Income" subtitle={`For the Year Ended June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="space-y-12">
                <div className="space-y-6">
                  <h3 className="text-sm font-black border-b-2 border-black text-slate-900 pb-1 uppercase tracking-widest">Operating Revenue</h3>
                  <div className="space-y-2 pl-6">
                    {incomeAccounts.map(acc => {
                      const val = periodBalances[acc.code] || 0;
                      if (val === 0) return null;
                      return (
                        <div key={acc.code} className="flex justify-between text-[11px] py-1.5 border-b border-dotted border-slate-300">
                          <span className="font-bold text-slate-700">{acc.name}</span>
                          <span className="font-mono font-black text-slate-900">{formatCurrency(val)}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between font-black text-xs pt-3 border-t-2 border-slate-400 mt-4">
                       <span>Total Consolidated Revenue</span>
                       <span className="font-mono">{formatCurrency(totalIncome)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <h3 className="text-sm font-black border-b-2 border-black text-slate-900 pb-1 uppercase tracking-widest">Operating Expenditures</h3>
                  <div className="space-y-2 pl-6">
                    {expenseAccounts.map(acc => {
                      const val = periodBalances[acc.code] || 0;
                      if (val === 0) return null;
                      return (
                        <div key={acc.code} className="flex justify-between text-[11px] py-1.5 border-b border-dotted border-slate-300">
                          <span className="font-bold text-slate-700">{acc.name}</span>
                          <span className="font-mono font-black text-slate-900">{formatCurrency(val)}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between font-black text-xs pt-3 border-t-2 border-slate-400 mt-4">
                       <span>Total Expenditures</span>
                       <span className="font-mono">{formatCurrency(totalExpense)}</span>
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "flex justify-between font-black text-lg p-6 border-[3px] border-black mt-16 rounded-2xl",
                  (totalIncome - totalExpense) >= 0 ? "bg-slate-50" : "bg-red-50 border-red-600 text-red-900"
                )}>
                  <span className="uppercase text-sm tracking-widest">Net Surplus / (Deficit) for the Period</span>
                  <span className="font-mono underline decoration-double decoration-4">৳ {formatCurrency(totalIncome - totalExpense)}</span>
                </div>
              </div>
              <div className="mt-24 grid grid-cols-3 gap-12 text-[12px] font-black text-center">
                 <div className="border-t-2 border-black pt-3">Accountant / AGM(F)</div>
                 <div className="border-t-2 border-black pt-3">Internal Auditor / DGM</div>
                 <div className="border-t-2 border-black pt-3">Approved By Trustee</div>
              </div>
              <div className="mt-16 pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">
                <span>CPF Management Software</span>
                <span className="italic">Developed by: Ariful Islam,AGMF,Gazipur PBS-2</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
           <Card className="border shadow-2xl rounded-none bg-white print-container print-portrait-fix mx-auto">
            <CardContent className="p-16 print:p-0">
              <ReportHeader title="Receipts and Payments Statement" subtitle={`For the Year Ended June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="grid grid-cols-2 gap-x-16 mt-10">
                 <div className="space-y-8">
                    <h4 className="font-black text-[12px] text-slate-900 border-b-2 border-black pb-2 uppercase tracking-[0.2em]">Institutional Receipts</h4>
                    <div className="space-y-3">
                      {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && activeCOA.find(a => a.code === c)?.balance === 'Credit').map(c => (
                        <div key={c} className="flex justify-between text-[11px] py-1.5 border-b border-dotted border-slate-300">
                          <span className="max-w-[180px] font-bold text-slate-700">{activeCOA.find(a => a.code === c)?.name}</span>
                          <span className="font-mono font-black text-slate-900">{formatCurrency(periodBalances[c])}</span>
                        </div>
                      ))}
                    </div>
                 </div>
                 <div className="space-y-8 border-l-2 border-slate-200 pl-16">
                    <h4 className="font-black text-[12px] text-slate-900 border-b-2 border-black pb-2 uppercase tracking-[0.2em]">Institutional Payments</h4>
                    <div className="space-y-3">
                      {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && activeCOA.find(a => a.code === c)?.balance === 'Debit').map(c => (
                        <div key={c} className="flex justify-between text-[11px] py-1.5 border-b border-dotted border-slate-300">
                          <span className="max-w-[180px] font-bold text-slate-700">{activeCOA.find(a => a.code === c)?.name}</span>
                          <span className="font-mono font-black text-slate-900">{formatCurrency(periodBalances[c])}</span>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
              <div className="mt-24 grid grid-cols-3 gap-12 text-[12px] font-black text-center">
                 <div className="border-t-2 border-black pt-3">Accountant</div>
                 <div className="border-t-2 border-black pt-3">Checked By</div>
                 <div className="border-t-2 border-black pt-3">Approved By</div>
              </div>
              <div className="mt-16 pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">
                <span>CPF Management Software</span>
                <span className="italic">Developed by: Ariful Islam,AGMF,Gazipur PBS-2</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}