
"use client"

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_OF_ACCOUNTS as INITIAL_COA, type COAEntry } from "@/lib/coa-data";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Loader2, Printer, Wallet, TrendingUp, ArrowDownUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedFiscalYear, setSelectedFY] = useState("");

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
    if (availableFYs.length > 0 && (!selectedFiscalYear || !availableFYs.includes(selectedFiscalYear))) {
      setSelectedFY(availableFYs[0]);
    }
  }, [availableFYs, selectedFiscalYear]);

  const fyDates = useMemo(() => {
    if (!selectedFiscalYear) return { start: '', end: '', display: '' };
    const parts = selectedFiscalYear.split("-");
    const startYear = parseInt(parts[0]);
    const endYear = startYear + 1;
    return {
      start: `${startYear}-07-01`,
      end: `${endYear}-06-30`,
      display: `FY ${selectedFiscalYear}`
    };
  }, [selectedFiscalYear]);

  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    if (!entries || !selectedFiscalYear) return map;
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
  }, [entries, activeCOA, fyDates.end, selectedFiscalYear]);

  const periodBalances = useMemo(() => {
    const map: Record<string, number> = {};
    if (!entries || !selectedFiscalYear) return map;
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
  }, [entries, activeCOA, fyDates.start, fyDates.end, selectedFiscalYear]);

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
      <div className={cn("space-y-8", className)}>
        <h3 className="text-sm font-black border-b-4 border-black pb-2 uppercase tracking-[0.2em] text-black">{title}</h3>
        <div className="space-y-8">
          {groups.map((group, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex justify-between font-black text-xs text-black bg-slate-100 p-2 rounded-md border-l-4 border-black">
                <span className="uppercase tracking-widest">{group.header.name}</span>
              </div>
              <div className="pl-6 space-y-1">
                {group.items.map(item => (
                  <div key={item.code} className="flex justify-between text-[12px] py-2 border-b border-dotted border-black hover:bg-slate-50 transition-colors tabular-nums font-black text-black">
                    <span className="flex gap-8">
                       <span className="font-mono w-[100px]">{item.code}</span>
                       <span>{item.name}</span>
                    </span>
                    <span>{formatCurrency(balancesMap[item.code])}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-black text-[12px] pt-3 border-t-2 border-black mt-3 pl-6 pr-2 italic text-black tabular-nums">
                <span className="uppercase tracking-tight">Total {group.header.name}</span>
                <span className="underline decoration-black">{formatCurrency(group.total)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-black text-base bg-black text-white p-4 rounded-xl mt-10 uppercase tracking-widest shadow-lg">
          <span>Total Consolidated {title}</span>
          <span className="tabular-nums underline decoration-double">৳ {formatCurrency(grandTotal)}</span>
        </div>
      </div>
    );
  };

  const ReportHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="text-center mb-12 border-b-4 border-black pb-8">
      <h1 className="text-3xl font-black uppercase tracking-tighter text-black">{pbsName}</h1>
      <p className="text-base font-black uppercase tracking-[0.25em] text-black mt-1">Contributory Provident Fund</p>
      <h2 className="text-xl md:text-2xl font-black text-black mt-4 uppercase underline decoration-2 underline-offset-8 decoration-black">{title}</h2>
      <p className="text-[12px] text-black font-black uppercase tracking-[0.4em] mt-6 bg-black text-white py-1.5 px-4 inline-block rounded-md">{subtitle}</p>
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
    <div className="p-10 flex flex-col gap-10 bg-white min-h-screen font-ledger text-black">
      <div className="flex items-center justify-between no-print max-w-5xl mx-auto w-full bg-white p-8 rounded-3xl border-2 border-black shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="bg-black p-4 rounded-2xl">
             <ShieldCheck className="size-10 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tighter text-black uppercase">Institutional Financials</h1>
            <p className="text-sm text-black uppercase tracking-[0.2em] font-black">{fyDates.display}</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] uppercase font-black text-black tracking-widest">Target Fiscal Period</Label>
            <Select value={selectedFiscalYear} onValueChange={setSelectedFY}>
              <SelectTrigger className="w-[200px] h-12 text-sm font-black border-2 border-black bg-white">
                <SelectValue placeholder="Select FY" />
              </SelectTrigger>
              <SelectContent>
                {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-black">FY {fy}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => window.print()} className="h-12 gap-3 font-black px-10 shadow-xl bg-black text-white rounded-xl uppercase tracking-widest hover:bg-black/90">
            <Printer className="size-5" />
            Generate Statement
          </Button>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full max-w-5xl mx-auto">
        <TabsList className="grid w-full grid-cols-3 mb-12 no-print h-16 bg-white border-2 border-black p-1.5 rounded-[24px] shadow-md">
          <TabsTrigger value="position" className="gap-3 rounded-2xl text-[15px] font-black transition-all data-[state=active]:bg-black data-[state=active]:text-white uppercase"><Wallet className="size-5" /> Balance Sheet</TabsTrigger>
          <TabsTrigger value="income" className="gap-3 rounded-2xl text-[15px] font-black transition-all data-[state=active]:bg-black data-[state=active]:text-white uppercase"><TrendingUp className="size-5" /> Profit & Loss</TabsTrigger>
          <TabsTrigger value="receipts" className="gap-3 rounded-2xl text-[15px] font-black transition-all data-[state=active]:bg-black data-[state=active]:text-white uppercase"><ArrowDownUp className="size-5" /> Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="position">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white print-container print-portrait-fix mx-auto">
            <CardContent className="p-16 print:p-0">
              <ReportHeader title="Statement of Financial Position" subtitle={`As of June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="space-y-20">
                <ClassifiedSection title="Institutional Assets & Portfolio" accounts={assetAccounts} balancesMap={balances} />
                <ClassifiedSection title="Member Equity & Trust Liabilities" accounts={liabilityEquityAccounts} balancesMap={balances} />
              </div>
              <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center text-black">
                 <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Prepared by</div>
                 <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Checked by</div>
                 <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Approved By Trustee</div>
              </div>
              <div className="mt-20 pt-8 border-t-2 border-black flex justify-between items-center text-[11px] text-black font-black uppercase tracking-[0.3em]">
                <span>CPF Management Software v1.0</span>
                <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white print-container print-portrait-fix mx-auto">
            <CardContent className="p-16 print:p-0">
              <ReportHeader title="Statement of Comprehensive Income" subtitle={`For the Year Ended June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="space-y-16">
                <div className="space-y-8">
                  <h3 className="text-sm font-black border-b-4 border-black text-black pb-2 uppercase tracking-[0.2em]">Institutional Revenue</h3>
                  <div className="space-y-3 pl-6">
                    {incomeAccounts.map(acc => {
                      const val = periodBalances[acc.code] || 0;
                      if (val === 0) return null;
                      return (
                        <div key={acc.code} className="flex justify-between text-[12px] py-2 border-b border-dotted border-black font-black text-black tabular-nums">
                          <span className="uppercase tracking-tight">{acc.name}</span>
                          <span>{formatCurrency(val)}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between font-black text-[13px] pt-4 border-t-2 border-black mt-6 text-black tabular-nums uppercase">
                       <span>Gross Consolidated Income</span>
                       <span className="underline decoration-black">{formatCurrency(totalIncome)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-8">
                  <h3 className="text-sm font-black border-b-4 border-black text-black pb-2 uppercase tracking-[0.2em]">Operating Expenditures</h3>
                  <div className="space-y-3 pl-6">
                    {expenseAccounts.map(acc => {
                      const val = periodBalances[acc.code] || 0;
                      if (val === 0) return null;
                      return (
                        <div key={acc.code} className="flex justify-between text-[12px] py-2 border-b border-dotted border-black font-black text-black tabular-nums">
                          <span className="uppercase tracking-tight">{acc.name}</span>
                          <span>{formatCurrency(val)}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between font-black text-[13px] pt-4 border-t-2 border-black mt-6 text-black tabular-nums uppercase">
                       <span>Total Trust Expenditures</span>
                       <span className="underline decoration-black">{formatCurrency(totalExpense)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between font-black text-xl p-8 border-[4px] border-black mt-20 rounded-2xl bg-slate-50 text-black tabular-nums">
                  <span className="uppercase text-sm tracking-[0.3em]">Net Trust Surplus / (Deficit)</span>
                  <span className="underline decoration-double decoration-4">৳ {formatCurrency(totalIncome - totalExpense)}</span>
                </div>
              </div>
              <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center text-black">
                 <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Prepared by</div>
                 <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Checked by</div>
                 <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Approved By Trustee</div>
              </div>
              <div className="mt-20 pt-8 border-t-2 border-black flex justify-between items-center text-[11px] text-black font-black uppercase tracking-[0.3em]">
                <span>CPF Management Software v1.0</span>
                <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
           <Card className="border-2 border-black shadow-2xl rounded-none bg-white print-container print-portrait-fix mx-auto">
            <CardContent className="p-16 print:p-0">
              <ReportHeader title="Receipts and Payments Statement" subtitle={`For the Year Ended June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="grid grid-cols-2 gap-x-24 mt-12">
                 <div className="space-y-10">
                    <h4 className="font-black text-[13px] text-black border-b-4 border-black pb-2 uppercase tracking-[0.2em]">Institutional Receipts</h4>
                    <div className="space-y-4">
                      {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && activeCOA.find(a => a.code === c)?.balance === 'Credit').map(c => (
                        <div key={c} className="flex justify-between text-[12px] py-2 border-b border-dotted border-black font-black text-black tabular-nums">
                          <span className="max-w-[200px] uppercase tracking-tighter leading-tight">{activeCOA.find(a => a.code === c)?.name}</span>
                          <span>{formatCurrency(periodBalances[c])}</span>
                        </div>
                      ))}
                    </div>
                 </div>
                 <div className="space-y-10 border-l-4 border-black pl-24">
                    <h4 className="font-black text-[13px] text-black border-b-4 border-black pb-2 uppercase tracking-[0.2em]">Institutional Payments</h4>
                    <div className="space-y-4">
                      {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && activeCOA.find(a => a.code === c)?.balance === 'Debit').map(c => (
                        <div key={c} className="flex justify-between text-[12px] py-2 border-b border-dotted border-black font-black text-black tabular-nums">
                          <span className="max-w-[200px] uppercase tracking-tighter leading-tight">{activeCOA.find(a => a.code === c)?.name}</span>
                          <span>{formatCurrency(periodBalances[c])}</span>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
              <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center text-black">
                 <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Prepared by</div>
                 <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Checked by</div>
                 <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Approved By Trustee</div>
              </div>
              <div className="mt-20 pt-8 border-t-2 border-black flex justify-between items-center text-[11px] text-black font-black uppercase tracking-[0.3em]">
                <span>CPF Management Software v1.0</span>
                <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
