"use client"

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_OF_ACCOUNTS as INITIAL_COA, type COAEntry } from "@/lib/coa-data";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Loader2, Printer, Wallet, TrendingUp, ArrowDownUp, ShieldCheck, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
    const fys = new Set<string>();
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;
    const activeStartYear = month >= 7 ? currentYear : currentYear - 1;

    for (let i = 0; i < 15; i++) {
      const start = activeStartYear - i;
      fys.add(`${start}-${(start + 1).toString().slice(-2)}`);
    }

    if (entries) {
      entries.forEach(entry => {
        const date = new Date(entry.entryDate);
        if (isNaN(date.getTime())) return;
        const year = date.getFullYear();
        const m = date.getMonth() + 1;
        const fy = m >= 7 
          ? `${year}-${(year + 1).toString().slice(-2)}` 
          : `${year - 1}-${year.toString().slice(-2)}`;
        fys.add(fy);
      });
    }
    
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
    const endDate = new Date(`${fyDates.end}T23:59:59`).getTime();
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
    const startDate = new Date(`${fyDates.start}T00:00:00`).getTime();
    const endDate = new Date(`${fyDates.end}T23:59:59`).getTime();
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

  const assetAccounts = useMemo(() => activeCOA.filter(a => a.code.startsWith('1')), [activeCOA]);
  const liabilityEquityAccounts = useMemo(() => activeCOA.filter(a => a.code.startsWith('2')), [activeCOA]);
  const incomeAccounts = useMemo(() => activeCOA.filter(a => a.code.startsWith('4') && !a.isHeader), [activeCOA]);
  const expenseAccounts = useMemo(() => activeCOA.filter(a => a.code.startsWith('5') && !a.isHeader), [activeCOA]);

  const totalIncome = useMemo(() => incomeAccounts.reduce((sum, acc) => sum + (periodBalances[acc.code] || 0), 0), [incomeAccounts, periodBalances]);
  const totalExpense = useMemo(() => expenseAccounts.reduce((sum, acc) => sum + (periodBalances[acc.code] || 0), 0), [expenseAccounts, periodBalances]);

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
        <h3 className="text-base font-black border-b-4 border-black pb-1.5 uppercase tracking-[0.2em] text-black">{title}</h3>
        <div className="space-y-8">
          {groups.map((group, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex justify-between font-black text-sm text-black bg-slate-50 p-2 rounded-sm border-l-4 border-black shadow-sm">
                <span className="uppercase tracking-widest">{group.header.name}</span>
              </div>
              <div className="pl-6 space-y-1">
                {group.items.map(item => (
                  <div key={item.code} className="flex justify-between text-xs py-1.5 border-b border-dotted border-black/40 font-black text-black tabular-nums">
                    <span className="flex gap-6">
                       <span className="font-mono w-[90px] opacity-60">{item.code}</span>
                       <span>{item.name}</span>
                    </span>
                    <span>{formatCurrency(balancesMap[item.code])}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-black text-sm pt-3 border-t-2 border-black mt-3 pl-6 pr-1 italic text-black tabular-nums">
                <span className="uppercase tracking-tight">Total {group.header.name}</span>
                <span className="underline decoration-black decoration-2">{formatCurrency(group.total)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-black text-base bg-black text-white p-4 rounded-xl mt-8 uppercase tracking-widest shadow-xl">
          <span>Total {title}</span>
          <span className="tabular-nums underline decoration-double decoration-2">৳ {formatCurrency(grandTotal)}</span>
        </div>
      </div>
    );
  };

  const TrialBalanceView = () => {
    const filteredAccounts = activeCOA.filter(a => !a.isHeader && (balances[a.code] || 0) !== 0);
    
    let totalDebit = 0;
    let totalCredit = 0;

    const rows = filteredAccounts.map(acc => {
      const val = balances[acc.code] || 0;
      let debit = 0;
      let credit = 0;

      if (acc.balance === 'Debit') {
        if (val > 0) debit = val;
        else credit = Math.abs(val);
      } else {
        if (val > 0) credit = val;
        else debit = Math.abs(val);
      }

      totalDebit += debit;
      totalCredit += credit;

      return { ...acc, debit, credit };
    });

    return (
      <div className="space-y-8">
        <div className="border-4 border-black overflow-hidden shadow-2xl">
          <table className="w-full text-xs border-collapse font-black text-black tabular-nums">
            <thead className="bg-slate-100 border-b-4 border-black">
              <tr>
                <th className="p-4 text-left uppercase tracking-widest border-r-2 border-black w-[120px]">Account Code</th>
                <th className="p-4 text-left uppercase tracking-widest border-r-2 border-black">Account Description</th>
                <th className="p-4 text-right uppercase tracking-widest border-r-2 border-black w-[150px]">Debit (৳)</th>
                <th className="p-4 text-right uppercase tracking-widest w-[150px]">Credit (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {rows.map((row) => (
                <tr key={row.code} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono border-r-2 border-black">{row.code}</td>
                  <td className="p-3 uppercase border-r-2 border-black">{row.name}</td>
                  <td className="p-3 text-right border-r-2 border-black">
                    {row.debit !== 0 ? formatCurrency(row.debit) : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {row.credit !== 0 ? formatCurrency(row.credit) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-black text-white border-t-4 border-black font-black">
              <tr className="h-16">
                <td colSpan={2} className="p-4 text-right uppercase tracking-[0.3em] text-sm pr-10">Institutional Grand Totals:</td>
                <td className="p-4 text-right text-lg border-l border-white/20">৳ {formatCurrency(totalDebit)}</td>
                <td className="p-4 text-right text-lg border-l border-white/20">৳ {formatCurrency(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="bg-slate-50 p-6 border-2 border-black flex items-center justify-between rounded-xl">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-6 text-emerald-600" />
            <p className="text-xs uppercase font-black tracking-widest">Mathematical Integrity Verified</p>
          </div>
          {Math.abs(totalDebit - totalCredit) < 0.01 ? (
            <Badge className="bg-emerald-600 text-white font-black uppercase tracking-widest px-6 py-1.5 text-[10px]">Balanced Ledger</Badge>
          ) : (
            <Badge variant="destructive" className="font-black uppercase tracking-widest px-6 py-1.5 text-[10px] animate-pulse">Out of Balance: {formatCurrency(totalDebit - totalCredit)}</Badge>
          )}
        </div>
      </div>
    );
  };

  const ReportHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="text-center mb-12 border-b-4 border-black pb-8">
      <h1 className="text-4xl font-black uppercase tracking-tighter text-black">{pbsName}</h1>
      <p className="text-base font-black uppercase tracking-[0.25em] text-black mt-1">Contributory Provident Fund</p>
      <h2 className="text-2xl font-black text-black mt-6 uppercase underline decoration-2 underline-offset-8 decoration-black">{title}</h2>
      <p className="text-xs text-black font-black uppercase tracking-[0.4em] mt-8 bg-black text-white py-1.5 px-6 inline-block rounded-md shadow-md">{subtitle}</p>
    </div>
  );

  if (isCoaLoading || isEntriesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 10mm !important;
          }
          .print-container {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            display: block !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-portrait-fix {
            width: 190mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          body {
            background-color: white !important;
          }
        }
      `}} />

      <div className="flex items-center justify-between no-print max-w-5xl mx-auto w-full bg-white p-6 rounded-3xl border-2 border-black shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="bg-black p-3.5 rounded-2xl">
             <ShieldCheck className="size-8 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tighter text-black uppercase">Institutional Financials</h1>
            <p className="text-xs text-black uppercase tracking-[0.2em] font-black">{fyDates.display}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase font-black text-black tracking-widest">Target Fiscal Period</Label>
            <Select value={selectedFiscalYear} onValueChange={setSelectedFY}>
              <SelectTrigger className="w-[180px] h-10 text-xs font-black border-2 border-black bg-white">
                <SelectValue placeholder="Select FY" />
              </SelectTrigger>
              <SelectContent>
                {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-black">FY {fy}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => window.print()} className="h-10 gap-2 font-black px-8 shadow-xl bg-black text-white rounded-xl uppercase tracking-widest text-xs hover:bg-black/90">
            <Printer className="size-4" />
            Commit to Print
          </Button>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full max-w-5xl mx-auto">
        <TabsList className="grid w-full grid-cols-4 mb-8 no-print h-14 bg-white border-2 border-black p-1.5 rounded-[20px] shadow-md">
          <TabsTrigger value="position" className="gap-2 rounded-xl text-sm font-black transition-all data-[state=active]:bg-black data-[state=active]:text-white uppercase"><Wallet className="size-4" /> Balance Sheet</TabsTrigger>
          <TabsTrigger value="income" className="gap-2 rounded-xl text-sm font-black transition-all data-[state=active]:bg-black data-[state=active]:text-white uppercase"><TrendingUp className="size-4" /> Profit & Loss</TabsTrigger>
          <TabsTrigger value="trial" className="gap-2 rounded-xl text-sm font-black transition-all data-[state=active]:bg-black data-[state=active]:text-white uppercase"><Scale className="size-4" /> Trial Balance</TabsTrigger>
          <TabsTrigger value="receipts" className="gap-2 rounded-xl text-sm font-black transition-all data-[state=active]:bg-black data-[state=active]:text-white uppercase"><ArrowDownUp className="size-4" /> Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="position">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white print-container print-portrait-fix mx-auto overflow-hidden">
            <CardContent className="p-12 print:p-0">
              <ReportHeader title="Statement of Financial Position" subtitle={`As of June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="space-y-12">
                <ClassifiedSection title="Institutional Assets & Portfolio" accounts={assetAccounts} balancesMap={balances} />
                <ClassifiedSection title="Member Equity & Trust Liabilities" accounts={liabilityEquityAccounts} balancesMap={balances} />
              </div>
              <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
                <span>CPF Management Software</span>
                <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white print-container print-portrait-fix mx-auto overflow-hidden">
            <CardContent className="p-12 print:p-0">
              <ReportHeader title="Statement of Comprehensive Income" subtitle={`For the Year Ended June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="space-y-12">
                <div className="space-y-6">
                  <h3 className="text-base font-black border-b-4 border-black text-black pb-1.5 uppercase tracking-[0.2em]">Institutional Revenue</h3>
                  <div className="space-y-2 pl-6">
                    {incomeAccounts.map(acc => {
                      const val = periodBalances[acc.code] || 0;
                      if (val === 0) return null;
                      return (
                        <div key={acc.code} className="flex justify-between text-xs py-1.5 border-b border-dotted border-black/40 font-black text-black tabular-nums">
                          <span className="uppercase tracking-tight">{acc.name}</span>
                          <span>{formatCurrency(val)}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between font-black text-sm pt-4 border-t-2 border-black mt-6 text-black tabular-nums uppercase italic">
                       <span>Gross Consolidated Income</span>
                       <span className="underline decoration-black decoration-2">{formatCurrency(totalIncome)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <h3 className="text-base font-black border-b-4 border-black text-black pb-1.5 uppercase tracking-[0.2em]">Operating Expenditures</h3>
                  <div className="space-y-2 pl-6">
                    {expenseAccounts.map(acc => {
                      const val = periodBalances[acc.code] || 0;
                      if (val === 0) return null;
                      return (
                        <div key={acc.code} className="flex justify-between text-xs py-1.5 border-b border-dotted border-black/40 font-black text-black tabular-nums">
                          <span className="uppercase tracking-tight">{acc.name}</span>
                          <span>{formatCurrency(val)}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between font-black text-sm pt-4 border-t-2 border-black mt-6 text-black tabular-nums uppercase italic">
                       <span>Total Trust Expenditures</span>
                       <span className="underline decoration-black decoration-2">{formatCurrency(totalExpense)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between font-black text-xl p-8 border-[4px] border-black mt-16 rounded-2xl bg-slate-50 text-black tabular-nums shadow-xl">
                  <span className="uppercase text-sm tracking-[0.3em]">Net Trust Surplus / (Deficit)</span>
                  <span className="underline decoration-double decoration-2">৳ {formatCurrency(totalIncome - totalExpense)}</span>
                </div>
              </div>
              <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
                <span>CPF Management Software</span>
                <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white print-container print-portrait-fix mx-auto overflow-hidden">
            <CardContent className="p-12 print:p-0">
              <ReportHeader title="Institutional Trial Balance" subtitle={`As of June 30, ${fyDates.end.split('-')[0]}`} />
              <TrialBalanceView />
              <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
                <span>CPF Management Software</span>
                <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
           <Card className="border-2 border-black shadow-2xl rounded-none bg-white print-container print-portrait-fix mx-auto overflow-hidden">
            <CardContent className="p-12 print:p-0">
              <ReportHeader title="Receipts and Payments Statement" subtitle={`For the Year Ended June 30, ${fyDates.end.split('-')[0]}`} />
              <div className="grid grid-cols-1 gap-y-12 mt-8">
                 <div className="space-y-8">
                    <h4 className="font-black text-base text-black border-b-4 border-black pb-1.5 uppercase tracking-[0.2em]">Institutional Receipts</h4>
                    <div className="space-y-2">
                      {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && activeCOA.find(a => a.code === c)?.balance === 'Credit').map(c => (
                        <div key={c} className="flex justify-between text-xs py-2 border-b border-dotted border-black/40 font-black text-black tabular-nums">
                          <span className="uppercase tracking-tighter leading-tight">{activeCOA.find(a => a.code === c)?.name}</span>
                          <span>{formatCurrency(periodBalances[c])}</span>
                        </div>
                      ))}
                    </div>
                 </div>
                 <div className="space-y-8 border-t-4 border-black pt-10">
                    <h4 className="font-black text-base text-black border-b-4 border-black pb-1.5 uppercase tracking-[0.2em]">Institutional Payments</h4>
                    <div className="space-y-2">
                      {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && activeCOA.find(a => a.code === c)?.balance === 'Debit').map(c => (
                        <div key={c} className="flex justify-between text-xs py-2 border-b border-dotted border-black/40 font-black text-black tabular-nums">
                          <span className="uppercase tracking-tighter leading-tight">{activeCOA.find(a => a.code === c)?.name}</span>
                          <span>{formatCurrency(periodBalances[c])}</span>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>
              <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
                <span>CPF Management Software</span>
                <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
