"use client"

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_OF_ACCOUNTS as INITIAL_COA, type COAEntry } from "@/lib/coa-data";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { Loader2, Printer, Wallet, TrendingUp, ArrowDownUp, Calendar, FileText, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedFY, setSelectedFY] = useState("");

  // Fetch dynamic COA
  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData, isLoading: isCoaLoading } = useCollection(coaRef);

  // Combine Firestore COA with initial fallback
  const activeCOA = useMemo(() => {
    if (!coaData || coaData.length === 0) return INITIAL_COA;
    
    // Merge: Firestore accounts take precedence by code
    const mergedMap = new Map<string, any>();
    INITIAL_COA.forEach(acc => mergedMap.set(acc.code, acc));
    coaData.forEach(acc => mergedMap.set(acc.code, acc));
    
    return Array.from(mergedMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [coaData]);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: entries, isLoading: isEntriesLoading } = useCollection(entriesRef);

  // Dynamically calculate available Fiscal Years from transactions
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

  // Aggregate balances
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

  // Period specific balances (for income statement/receipt-payment)
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
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2
    }).format(Math.abs(val)).replace('BDT', val < 0 ? '(৳ ' : '৳ ') + (val < 0 ? ')' : '');
  };

  const ClassifiedSection = ({ title, accounts, balancesMap, className }: { title: string, accounts: COAEntry[], balancesMap: Record<string, number>, className?: string }) => {
    // Group accounts by their header
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
      <div className={cn("space-y-4", className)}>
        <h3 className="text-[12px] font-bold border-b-2 border-slate-900 pb-1 uppercase tracking-wider">{title}</h3>
        <div className="space-y-4">
          {groups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between font-bold text-[10px] text-slate-700 bg-slate-50 p-1">
                <span>{group.header.name}</span>
              </div>
              <div className="pl-2 space-y-0.5">
                {group.items.map(item => (
                  <div key={item.code} className="flex justify-between text-[10px] py-0.5 border-b border-dotted border-slate-200">
                    <span className="flex gap-2">
                       <span className="text-slate-400 font-mono w-[70px]">{item.code}</span>
                       <span>{item.name}</span>
                    </span>
                    <span>{formatCurrency(balancesMap[item.code])}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-[10px] pt-1 border-t border-slate-400 mt-1 pl-2">
                <span>Sub-total: {group.header.name}</span>
                <span>{formatCurrency(group.total)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-bold text-[11px] bg-slate-100 p-2 border-y-2 border-slate-900 mt-4 uppercase">
          <span>TOTAL {title}</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    );
  };

  const ReportHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="text-center mb-8 border-b-4 border-double border-slate-900 pb-4">
      <h1 className="text-lg font-bold uppercase tracking-[0.1em] text-slate-900">Gazipur Palli Bidyut Samity-2</h1>
      <h2 className="text-md font-bold text-slate-700 mt-1 font-ledger uppercase">{title}</h2>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{subtitle}</p>
    </div>
  );

  if (isCoaLoading || isEntriesLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  // Define account sets for structured reports using the dynamic activeCOA
  const assetAccounts = activeCOA.filter(a => a.type === 'Asset' || a.type === 'Contra-Asset' || (a.isHeader && a.code.startsWith('1')));
  const liabilityEquityAccounts = activeCOA.filter(a => a.type === 'Liability' || a.type === 'Equity' || (a.isHeader && a.code.startsWith('2')));
  
  const incomeAccounts = activeCOA.filter(a => a.type === 'Income');
  const expenseAccounts = activeCOA.filter(a => a.type === 'Expense');

  const totalIncome = incomeAccounts.reduce((sum, acc) => sum + (periodBalances[acc.code] || 0), 0);
  const totalExpense = expenseAccounts.reduce((sum, acc) => sum + (periodBalances[acc.code] || 0), 0);

  return (
    <div className="p-8 flex flex-col gap-8 bg-slate-100 min-h-screen font-ledger text-slate-900">
      <div className="flex items-center justify-between no-print max-w-5xl mx-auto w-full bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2 rounded-lg">
             <PieChart className="size-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight">Financial Auditing Control</h1>
            <p className="text-xs text-muted-foreground">Classified Double-Entry Statements • {fyDates.display}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium">Reporting Period:</span>
            <Select value={selectedFY} onValueChange={setSelectedFY}>
              <SelectTrigger className="w-[140px] h-9 text-xs font-bold border-slate-300">
                <SelectValue placeholder="Select FY" />
              </SelectTrigger>
              <SelectContent>
                {availableFYs.map(fy => (
                  <SelectItem key={fy} value={fy}>Fiscal Year {fy}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9 border-slate-300">
            <Printer className="size-4 mr-2" />
            Print Reports
          </Button>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full max-w-5xl mx-auto">
        <TabsList className="grid w-full grid-cols-3 mb-8 no-print h-12 bg-white border-2 border-slate-200 p-1 rounded-xl shadow-sm">
          <TabsTrigger value="position" className="gap-2 data-[state=active]:bg-sidebar-primary data-[state=active]:text-white rounded-lg transition-all">
            <Wallet className="size-4" /> Financial Position
          </TabsTrigger>
          <TabsTrigger value="income" className="gap-2 data-[state=active]:bg-sidebar-primary data-[state=active]:text-white rounded-lg transition-all">
            <TrendingUp className="size-4" /> Comprehensive Income
          </TabsTrigger>
          <TabsTrigger value="receipts" className="gap-2 data-[state=active]:bg-sidebar-primary data-[state=active]:text-white rounded-lg transition-all">
            <ArrowDownUp className="size-4" /> Receipts & Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="position">
          <Card className="border shadow-2xl rounded-none print:shadow-none bg-white print-container print-portrait-fix mx-auto">
            <CardContent className="p-8 md:p-12 print:p-0">
              <ReportHeader title="Statement of Financial Position" subtitle={`As of June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="space-y-12">
                <ClassifiedSection title="Assets" accounts={assetAccounts} balancesMap={balances} />
                <ClassifiedSection title="Equity and Liabilities" accounts={liabilityEquityAccounts} balancesMap={balances} />
              </div>
              <div className="mt-16 flex justify-between items-end border-t pt-8">
                 <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Auditor Signature</p>
                    <div className="w-[150px] h-px bg-slate-300 mt-6" />
                 </div>
                 <p className="text-[8px] text-slate-400 italic">Generated by PBS CPF Management Software</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card className="border shadow-2xl rounded-none print:shadow-none bg-white print-container print-portrait-fix mx-auto">
            <CardContent className="p-8 md:p-12 print:p-0">
              <ReportHeader title="Statement of Comprehensive Income" subtitle={`For the Year Ended June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="space-y-10">
                <div className="space-y-4">
                  <h3 className="text-[12px] font-bold border-b-2 border-emerald-700 text-emerald-800 pb-1 uppercase tracking-wider">A. Operating Income</h3>
                  <div className="space-y-1 pl-4">
                    {incomeAccounts.map(acc => {
                      const val = periodBalances[acc.code] || 0;
                      if (val === 0) return null;
                      return (
                        <div key={acc.code} className="flex justify-between text-[10px] py-1 border-b border-dotted border-slate-200">
                          <span>{acc.name}</span>
                          <span>{formatCurrency(val)}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between font-bold text-[10px] pt-2 border-t border-emerald-700 mt-2">
                       <span>TOTAL INCOME (A)</span>
                       <span className="underline decoration-double">{formatCurrency(totalIncome)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[12px] font-bold border-b-2 border-rose-700 text-rose-800 pb-1 uppercase tracking-wider">B. Operating Expenses</h3>
                  <div className="space-y-1 pl-4">
                    {expenseAccounts.map(acc => {
                      const val = periodBalances[acc.code] || 0;
                      if (val === 0) return null;
                      return (
                        <div key={acc.code} className="flex justify-between text-[10px] py-1 border-b border-dotted border-slate-200">
                          <span>{acc.name}</span>
                          <span>{formatCurrency(val)}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between font-bold text-[10px] pt-2 border-t border-rose-700 mt-2">
                       <span>TOTAL EXPENSES (B)</span>
                       <span className="underline decoration-double">{formatCurrency(totalExpense)}</span>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "flex justify-between font-bold text-md p-4 border-2 mt-8",
                  (totalIncome - totalExpense) >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"
                )}>
                  <span className="uppercase text-sm">Net Surplus / (Deficit) for the Period</span>
                  <span className="underline decoration-double">{formatCurrency(totalIncome - totalExpense)}</span>
                </div>
              </div>
              <div className="mt-16 flex justify-between items-end border-t pt-8">
                 <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Auditor Signature</p>
                    <div className="w-[150px] h-px bg-slate-300 mt-6" />
                 </div>
                 <p className="text-[8px] text-slate-400 italic">Generated by PBS CPF Management Software</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
           <Card className="border shadow-2xl rounded-none print:shadow-none bg-white print-container print-portrait-fix mx-auto">
            <CardContent className="p-8 md:p-12 print:p-0">
              <ReportHeader title="Receipts and Payments" subtitle={`For the Year Ended June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="grid grid-cols-1 gap-12">
                 <div>
                    <h4 className="font-bold text-[11px] text-slate-900 mb-4 border-b-2 border-slate-900 pb-1 uppercase tracking-widest">RECEIPTS</h4>
                    <div className="space-y-2">
                      {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && activeCOA.find(a => a.code === c)?.balance === 'Credit').map(c => (
                        <div key={c} className="flex justify-between text-[10px] py-1 border-b border-dotted border-slate-200">
                          <span>{activeCOA.find(a => a.code === c)?.name}</span>
                          <span>{formatCurrency(periodBalances[c])}</span>
                        </div>
                      ))}
                    </div>
                 </div>
                 <div>
                    <h4 className="font-bold text-[11px] text-slate-900 mb-4 border-b-2 border-slate-900 pb-1 uppercase tracking-widest">PAYMENTS</h4>
                    <div className="space-y-2">
                      {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && activeCOA.find(a => a.code === c)?.balance === 'Debit').map(c => (
                        <div key={c} className="flex justify-between text-[10px] py-1 border-b border-dotted border-slate-200">
                          <span>{activeCOA.find(a => a.code === c)?.name}</span>
                          <span>{formatCurrency(periodBalances[c])}</span>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
              <div className="mt-16 flex justify-between items-end border-t pt-8">
                 <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Auditor Signature</p>
                    <div className="w-[150px] h-px bg-slate-300 mt-6" />
                 </div>
                 <p className="text-[8px] text-slate-400 italic">Generated by PBS CPF Management Software</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}