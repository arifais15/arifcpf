"use client"

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_OF_ACCOUNTS as INITIAL_COA, type COAEntry } from "@/lib/coa-data";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Loader2, Printer, Wallet, TrendingUp, ArrowDownUp, ShieldCheck, Scale, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedFiscalYear, setSelectedFY] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData, isLoading: isCoaLoading } = useCollection(coaRef);

  const activeCOA = useMemo(() => {
    const mergedMap = new Map<string, any>();
    INITIAL_COA.forEach(acc => mergedMap.set(acc.code, acc));
    if (coaData) {
      coaData.forEach(acc => mergedMap.set(acc.code, acc));
    }
    return Array.from(mergedMap.values()).sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  }, [coaData]);

  // Fixed categorization to resolve ReferenceError
  const assetAccounts = useMemo(() => activeCOA.filter(a => a.code.startsWith('1')), [activeCOA]);
  const liabilityEquityAccounts = useMemo(() => activeCOA.filter(a => a.code.startsWith('2')), [activeCOA]);
  const incomeAccounts = useMemo(() => activeCOA.filter(a => a.code.startsWith('4')), [activeCOA]);
  const expenseAccounts = useMemo(() => activeCOA.filter(a => a.code.startsWith('5')), [activeCOA]);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: entries, isLoading: isEntriesLoading } = useCollection(entriesRef);

  const availableFYs = useMemo(() => {
    const fys = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;
    const activeStartYear = month >= 7 ? currentYear : currentYear - 1;
    for (let i = 0; i < 15; i++) {
      const start = activeStartYear - i;
      fys.push(`${start}-${(start + 1).toString().slice(-2)}`);
    }
    return fys;
  }, []);

  const handleFYChange = (fy: string) => {
    setSelectedFY(fy);
    if (fy === "all") {
      setDateRange({ start: "2010-01-01", end: new Date().toISOString().split('T')[0] });
    } else {
      const parts = fy.split("-");
      const startYear = parseInt(parts[0]);
      setDateRange({ start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` });
    }
  };

  useEffect(() => {
    if (availableFYs.length > 0 && !selectedFiscalYear) {
      handleFYChange(availableFYs[0]);
    }
  }, [availableFYs, selectedFiscalYear]);

  const balances = useMemo(() => {
    const map: Record<string, number> = {};
    if (!entries || !dateRange.end) return map;
    const endDate = new Date(`${dateRange.end}T23:59:59`).getTime();
    entries.forEach(entry => {
      if (new Date(entry.entryDate).getTime() > endDate) return;
      (entry.lines || []).forEach((line: any) => {
        const coa = activeCOA.find(a => a.code === line.accountCode);
        if (!coa) return;
        const amt = coa.balance === 'Debit' ? (Number(line.debit) - Number(line.credit)) : (Number(line.credit) - Number(line.debit));
        map[line.accountCode] = (map[line.accountCode] || 0) + amt;
      });
    });
    return map;
  }, [entries, activeCOA, dateRange.end]);

  const periodBalances = useMemo(() => {
    const map: Record<string, number> = {};
    if (!entries || !dateRange.start || !dateRange.end) return map;
    const s = new Date(`${dateRange.start}T00:00:00`).getTime();
    const e = new Date(`${dateRange.end}T23:59:59`).getTime();
    entries.forEach(entry => {
      const t = new Date(entry.entryDate).getTime();
      if (t < s || t > e) return;
      (entry.lines || []).forEach((line: any) => {
        const coa = activeCOA.find(a => a.code === line.accountCode);
        if (!coa) return;
        const amt = coa.balance === 'Debit' ? (Number(line.debit) - Number(line.credit)) : (Number(line.credit) - Number(line.debit));
        map[line.accountCode] = (map[line.accountCode] || 0) + amt;
      });
    });
    return map;
  }, [entries, activeCOA, dateRange.start, dateRange.end]);

  const totalIncome = useMemo(() => incomeAccounts.filter(a => !a.isHeader).reduce((sum, acc) => sum + (periodBalances[acc.code] || 0), 0), [incomeAccounts, periodBalances]);
  const totalExpense = useMemo(() => expenseAccounts.filter(a => !a.isHeader).reduce((sum, acc) => sum + (periodBalances[acc.code] || 0), 0), [expenseAccounts, periodBalances]);

  const formatCurrency = (val: number) => {
    const formatted = new Intl.NumberFormat('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(val || 0));
    return val < 0 ? `(${formatted})` : formatted;
  };

  const ClassifiedSection = ({ title, accounts, balancesMap }: { title: string, accounts: COAEntry[], balancesMap: Record<string, number> }) => {
    const groups: { header: COAEntry; items: COAEntry[]; total: number }[] = [];
    let currentGroup: { header: COAEntry; items: COAEntry[]; total: number } | null = null;
    
    accounts.forEach(acc => {
      if (acc.isHeader) {
        if (currentGroup && currentGroup.items.length > 0) groups.push(currentGroup);
        currentGroup = { header: acc, items: [], total: 0 };
      } else {
        const val = balancesMap[acc.code] || 0;
        if (val !== 0) {
          if (!currentGroup) currentGroup = { header: { code: '', name: 'Miscellaneous', type: '', balance: '', isHeader: true }, items: [], total: 0 };
          currentGroup.items.push(acc);
          currentGroup.total += val;
        }
      }
    });
    if (currentGroup && currentGroup.items.length > 0) groups.push(currentGroup);

    if (groups.length === 0) return null;

    return (
      <div className="space-y-6">
        <h3 className="text-sm font-black border-b-2 border-black pb-1 uppercase tracking-widest text-black">{title}</h3>
        {groups.map((g, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between font-black text-xs uppercase bg-slate-50 p-1 border-l-4 border-black text-black">
              <span>{g.header.name}</span>
            </div>
            <div className="pl-4 space-y-0.5">
              {g.items.map(item => (
                <div key={item.code} className="flex justify-between text-[11px] py-1 border-b border-dotted border-black/20 font-black tabular-nums text-black">
                  <span className="flex gap-4"><span className="font-mono w-[80px] opacity-50">{item.code}</span><span>{item.name}</span></span>
                  <span>{formatCurrency(balancesMap[item.code])}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-black text-xs pt-2 border-t border-black mt-2 pl-4 italic text-black">
              <span>Total {g.header.name}</span><span>{formatCurrency(g.total)}</span>
            </div>
          </div>
        ))}
        <div className="flex justify-between font-black text-sm bg-black text-white p-3 rounded-none mt-4 uppercase tracking-widest">
          <span>Total {title}</span><span className="underline decoration-double">৳ {formatCurrency(groups.reduce((s, g) => s + g.total, 0))}</span>
        </div>
      </div>
    );
  };

  const ReportHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="text-center mb-10 border-b-4 border-black pb-6">
      <h1 className="text-3xl font-black uppercase tracking-tighter text-black">{pbsName}</h1>
      <p className="text-sm font-black uppercase tracking-[0.2em] mt-1 text-black">Contributory Provident Fund</p>
      <h2 className="text-xl font-black mt-4 uppercase text-black">{title}</h2>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-6 bg-black text-white py-1 px-4 inline-block rounded">{subtitle}</p>
    </div>
  );

  if (isCoaLoading || isEntriesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4 portrait !important; margin: 10mm !important; } .print-container { width: 100% !important; display: block !important; border: none !important; } body { background-color: white !important; color: #000000 !important; } }` }} />
      
      <div className="flex flex-col gap-4 no-print max-w-4xl mx-auto w-full bg-white p-6 rounded-2xl border-2 border-black shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4"><div className="bg-black p-2 rounded-xl"><ShieldCheck className="size-6 text-white" /></div><div><h1 className="text-xl font-black uppercase text-black">Trust Financials</h1><p className="text-[10px] font-black uppercase tracking-widest text-black">{selectedFiscalYear === 'all' ? 'Consolidated Period' : `FY ${selectedFiscalYear}`}</p></div></div>
          <Button onClick={() => window.print()} className="h-9 gap-2 font-black px-6 bg-black text-white rounded-lg uppercase text-[10px]"><Printer className="size-3.5" /> Print Statement</Button>
        </div>
        
        <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 border-2 border-black rounded-xl">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-500">Quick Range</Label>
            <Select value={selectedFiscalYear} onValueChange={handleFYChange}>
              <SelectTrigger className="h-10 font-black border-2 border-black focus:ring-0 text-black"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black">FY {fy}</SelectItem>)}
                <SelectItem value="all" className="font-black text-rose-600">ALL TIME CONSOLIDATED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-500">Manual Selection</Label>
            <div className="flex items-center gap-2">
              <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-10 font-black border-2 border-black text-black" />
              <ArrowRightLeft className="size-4 opacity-30 text-black" />
              <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-10 font-black border-2 border-black text-black" />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-4 mb-6 no-print h-12 bg-white border-2 border-black p-1 rounded-xl">
          <TabsTrigger value="position" className="rounded-lg font-black uppercase text-[10px] text-black data-[state=active]:bg-black data-[state=active]:text-white"><Wallet className="size-3.5 mr-2" /> Balance Sheet</TabsTrigger>
          <TabsTrigger value="income" className="rounded-lg font-black uppercase text-[10px] text-black data-[state=active]:bg-black data-[state=active]:text-white"><TrendingUp className="size-3.5 mr-2" /> Income Stmt</TabsTrigger>
          <TabsTrigger value="trial" className="rounded-lg font-black uppercase text-[10px] text-black data-[state=active]:bg-black data-[state=active]:text-white"><Scale className="size-3.5 mr-2" /> Trial Balance</TabsTrigger>
          <TabsTrigger value="receipts" className="rounded-lg font-black uppercase text-[10px] text-black data-[state=active]:bg-black data-[state=active]:text-white"><ArrowDownUp className="size-3.5 mr-2" /> Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="position">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white p-10 print:p-0">
            <ReportHeader title="Statement of Financial Position" subtitle={`As of ${dateRange.end}`} />
            <div className="space-y-12">
              <ClassifiedSection title="Institutional Assets" accounts={assetAccounts} balancesMap={balances} />
              <ClassifiedSection title="Equity & Liabilities" accounts={liabilityEquityAccounts} balancesMap={balances} />
            </div>
            <div className="mt-20 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
              <span>CPF Management Software</span><span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white p-10 print:p-0">
            <ReportHeader title="Income & Expenditure Account" subtitle={`Period: ${dateRange.start} to ${dateRange.end}`} />
            <div className="space-y-12">
              <div>
                <h3 className="text-sm font-black border-b-2 border-black pb-1 uppercase tracking-widest text-black">Operating Revenue</h3>
                <div className="space-y-1 pl-4 mt-4">
                  {incomeAccounts.filter(a => !a.isHeader).map(acc => periodBalances[acc.code] ? (
                    <div key={acc.code} className="flex justify-between text-[11px] py-1 border-b border-dotted border-black/20 font-black tabular-nums text-black">
                      <span>{acc.name}</span>
                      <span>{formatCurrency(periodBalances[acc.code])}</span>
                    </div>
                  ) : null)}
                  <div className="flex justify-between font-black text-xs pt-2 border-t border-black mt-4 italic uppercase text-black">
                    <span>Total Revenue</span><span>{formatCurrency(totalIncome)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-black border-b-2 border-black pb-1 uppercase tracking-widest text-black">Operating Expenditure</h3>
                <div className="space-y-1 pl-4 mt-4">
                  {expenseAccounts.filter(a => !a.isHeader).map(acc => periodBalances[acc.code] ? (
                    <div key={acc.code} className="flex justify-between text-[11px] py-1 border-b border-dotted border-black/20 font-black tabular-nums text-black">
                      <span>{acc.name}</span>
                      <span>{formatCurrency(periodBalances[acc.code])}</span>
                    </div>
                  ) : null)}
                  <div className="flex justify-between font-black text-xs pt-2 border-t border-black mt-4 italic uppercase text-black">
                    <span>Total Expenditure</span><span>{formatCurrency(totalExpense)}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between font-black text-lg p-6 border-4 border-black mt-10 rounded-none bg-slate-50 uppercase tracking-widest text-black">
                <span>Net Surplus / (Deficit)</span>
                <span>৳ {formatCurrency(totalIncome - totalExpense)}</span>
              </div>
            </div>
            <div className="mt-20 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
              <span>CPF Management Software</span><span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="trial">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white p-10 print:p-0">
            <ReportHeader title="Institutional Trial Balance" subtitle={`As of ${dateRange.end}`} />
            <div className="border-2 border-black overflow-hidden">
              <table className="w-full text-xs font-black tabular-nums text-black">
                <thead className="bg-slate-100 border-b-2 border-black">
                  <tr>
                    <th className="p-2 text-left border-r w-[100px]">Code</th>
                    <th className="p-2 text-left border-r">Account Description</th>
                    <th className="p-2 text-right border-r w-[120px]">Debit</th>
                    <th className="p-2 text-right w-[120px]">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-black">
                  {activeCOA.filter(a => !a.isHeader && (balances[a.code] !== 0 || periodBalances[a.code] !== 0)).map(acc => { 
                    const v = balances[acc.code] || 0; 
                    const isDr = acc.balance === 'Debit' ? v > 0 : v < 0; 
                    return (
                      <tr key={acc.code} className="h-8">
                        <td className="p-2 font-mono border-r">{acc.code}</td>
                        <td className="p-2 uppercase border-r">{acc.name}</td>
                        <td className="p-2 text-right border-r">{isDr ? formatCurrency(Math.abs(v)) : "—"}</td>
                        <td className="p-2 text-right">{!isDr ? formatCurrency(Math.abs(v)) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-20 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
              <span>CPF Management Software</span><span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white p-10 print:p-0">
            <ReportHeader title="Institutional Cash Flow" subtitle={`Year Ended ${dateRange.end}`} />
            <div className="space-y-8">
              <div>
                <h4 className="font-black text-sm border-b-2 border-black pb-1 uppercase tracking-widest text-black">Operating Receipts</h4>
                <div className="space-y-1 mt-4">
                  {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && activeCOA.find(a => a.code === c)?.balance === 'Credit').map(c => (
                    <div key={c} className="flex justify-between text-[11px] py-1.5 border-b border-dotted border-black/20 font-black tabular-nums text-black">
                      <span className="uppercase">{activeCOA.find(a => a.code === c)?.name}</span>
                      <span>{formatCurrency(periodBalances[c])}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-20 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
              <span>CPF Management Software</span><span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
