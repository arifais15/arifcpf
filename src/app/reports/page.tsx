"use client"

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_OF_ACCOUNTS as INITIAL_COA, type COAEntry } from "@/lib/coa-data";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Loader2, Printer, Wallet, TrendingUp, ArrowDownUp, ShieldCheck, Scale, ArrowRightLeft, History, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: entries, isLoading: isEntriesLoading } = useCollection(entriesRef);

  const availableFYs = useMemo(() => {
    const fys = [];
    const now = new Date();
    const activeStartYear = (now.getMonth() + 1) >= 7 ? now.getFullYear() : now.getFullYear() - 1;
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
      const startYear = parseInt(fy.split("-")[0]);
      setDateRange({ start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` });
    }
  };

  useEffect(() => {
    if (availableFYs.length > 0 && !selectedFiscalYear) handleFYChange(availableFYs[0]);
  }, [availableFYs, selectedFiscalYear]);

  // IAS 1: Balance Sheet Balances (As of end date)
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

  // IAS 1: Income Statement Balances (For the period)
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

  const formatCurrency = (val: number) => {
    const formatted = new Intl.NumberFormat('en-BD', { minimumFractionDigits: 2 }).format(Math.abs(val || 0));
    return val < 0 ? `(${formatted})` : formatted;
  };

  const SummaryRow = ({ label, value, isBold, isTotal, isGrandTotal }: any) => (
    <div className={cn(
      "flex justify-between py-1.5 text-[11px] font-black tabular-nums border-b border-dotted border-black/10",
      isBold && "font-black text-xs border-black/20",
      isTotal && "bg-slate-50 border-t-2 border-black mt-2",
      isGrandTotal && "bg-black text-white p-3 border-none mt-4 uppercase tracking-widest text-sm"
    )}>
      <span>{label}</span>
      <span className={cn(isGrandTotal && "underline decoration-double")}>{isGrandTotal ? `৳ ${formatCurrency(value)}` : formatCurrency(value)}</span>
    </div>
  );

  const IAS1_Heading = ({ title, date }: any) => (
    <div className="text-center mb-10 border-b-4 border-black pb-8 text-black">
      <h1 className="text-4xl font-black uppercase tracking-tighter">{pbsName}</h1>
      <p className="text-sm font-black uppercase tracking-[0.3em] mt-2">Contributory Provident Fund (CPF)</p>
      <h2 className="text-2xl font-black mt-6 uppercase underline underline-offset-8 decoration-4">{title}</h2>
      <p className="text-xs font-black uppercase tracking-[0.2em] mt-6 bg-black text-white py-2 px-8 inline-block rounded-full">{date}</p>
    </div>
  );

  if (isCoaLoading || isEntriesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  const netSurplus = (periodBalances['400.10.0000']||0) + (periodBalances['400.20.0000']||0) + (periodBalances['400.30.0000']||0) + (periodBalances['400.40.0000']||0) + (periodBalances['400.50.0000']||0) + (periodBalances['410.10.0000']||0) + (periodBalances['410.20.0000']||0) - (periodBalances['500.10.0000']||0) - (periodBalances['500.20.0000']||0) - (periodBalances['500.30.0000']||0) - (periodBalances['500.40.0000']||0) - (periodBalances['500.50.0000']||0) - (periodBalances['500.60.0000']||0);

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <div className="flex flex-col gap-6 no-print max-w-5xl mx-auto w-full bg-white p-8 rounded-3xl border-4 border-black shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="bg-black p-3 rounded-2xl shadow-xl"><ShieldCheck className="size-8 text-white" /></div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">IAS 1 Reporting Matrix</h1>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Institutional Compliance Terminal</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild className="h-12 gap-2 font-black px-8 border-2 border-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg">
              <Link href="/reports/trial-balance"><Scale className="size-4" /> Trial Balance</Link>
            </Button>
            <Button onClick={() => window.print()} className="h-12 gap-2 font-black px-10 bg-black text-white rounded-xl uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-900 transition-all"><Printer className="size-4" /> Print</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 p-6 bg-slate-50 border-2 border-black rounded-2xl">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Analysis Target</Label>
            <Select value={selectedFiscalYear} onValueChange={handleFYChange}>
              <SelectTrigger className="h-12 font-black border-2 border-black focus:ring-0 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black">Fiscal Year {fy}</SelectItem>)}<SelectItem value="all" className="font-black">Consolidated (Genesis to Date)</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Custom Reconciliation Range</Label>
            <div className="flex items-center gap-4">
              <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-12 font-black border-2 border-black bg-white" />
              <ArrowRightLeft className="size-5 opacity-20" />
              <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-12 font-black border-2 border-black bg-white" />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full max-w-5xl mx-auto">
        <TabsList className="grid w-full grid-cols-4 mb-8 no-print h-14 bg-slate-100 border-4 border-black p-1 rounded-2xl">
          <TabsTrigger value="position" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white">Position (BS)</TabsTrigger>
          <TabsTrigger value="income" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white">Comprehensive (PL)</TabsTrigger>
          <TabsTrigger value="changes" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white">Equity Movement</TabsTrigger>
          <TabsTrigger value="cash" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white">Cash Flows</TabsTrigger>
        </TabsList>

        <TabsContent value="position" className="animate-in fade-in duration-500">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white p-12 print:p-0">
            <IAS1_Heading title="Statement of Financial Position" date={`As at ${dateRange.end}`} />
            <div className="grid md:grid-cols-2 gap-16">
              <div className="space-y-8">
                <h3 className="text-sm font-black border-b-2 border-black pb-1 uppercase tracking-widest">Assets</h3>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-40 mb-2">Non-Current Assets</p>
                    <div className="pl-4">
                      <SummaryRow label="Long-term Investments (Portfolio)" value={(balances['101.10.0000']||0)+(balances['101.20.0000']||0)+(balances['101.30.0000']||0)} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-40 mb-2">Current Assets</p>
                    <div className="pl-4">
                      <SummaryRow label="Loans & Advances to Members" value={(balances['105.10.0000']||0)+(balances['105.20.0000']||0)} />
                      <SummaryRow label="Accrued Interest Receivables" value={(balances['106.10.0000']||0)+(balances['106.40.0000']||0)} />
                      <SummaryRow label="Other Receivables from PBS" value={balances['107.10.0000']||0} />
                      <SummaryRow label="Cash & Cash Equivalents" value={balances['131.10.0000']||0} />
                    </div>
                  </div>
                  <SummaryRow isGrandTotal label="Total Institutional Assets" value={Object.values(balances).filter((_,k)=>k.toString().startsWith('1')).reduce((s,v)=>s+v,0)} />
                </div>
              </div>
              <div className="space-y-8">
                <h3 className="text-sm font-black border-b-2 border-black pb-1 uppercase tracking-widest">Equity & Liabilities</h3>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-40 mb-2">Members' Equity (Net Funds)</p>
                    <div className="pl-4">
                      <SummaryRow label="Personnel Principal Contribution" value={balances['200.10.0000']||0} />
                      <SummaryRow label="Institutional Matching Contribution" value={balances['200.20.0000']||0} />
                      <SummaryRow label="Accumulated Profit Distribution" value={(balances['200.30.0000']||0)+(balances['200.40.0000']||0)} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-40 mb-2">Current Liabilities</p>
                    <div className="pl-4">
                      <SummaryRow label="Payable to Members/PBS" value={(balances['210.10.0000']||0)+(balances['210.20.0000']||0)} />
                      <SummaryRow label="Lapse & Forfeiture Suspense" value={balances['205.10.0000']||0} />
                      <SummaryRow label="Provision for Taxation" value={balances['220.10.0000']||0} />
                    </div>
                  </div>
                  <SummaryRow isGrandTotal label="Total Equity & Liabilities" value={Object.values(balances).filter((_,k)=>k.toString().startsWith('2')).reduce((s,v)=>s+v,0)} />
                </div>
              </div>
            </div>
            <div className="mt-20 pt-4 border-t border-black flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
              <span>IAS 1 Compliant Report</span><span>Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white p-12 print:p-0">
            <IAS1_Heading title="Statement of Comprehensive Income" date={`For the period ended ${dateRange.end}`} />
            <div className="space-y-12 max-w-3xl mx-auto">
              <div>
                <h3 className="text-sm font-black border-b-2 border-black pb-1 uppercase tracking-widest">Operating Revenue</h3>
                <div className="pl-4 space-y-1 mt-4">
                  <SummaryRow label="Interest on Portfolio (FDR/Bonds)" value={(periodBalances['400.10.0000']||0)+(periodBalances['400.20.0000']||0)+(periodBalances['400.30.0000']||0)} />
                  <SummaryRow label="Interest on Member Loans" value={periodBalances['400.40.0000']||0} />
                  <SummaryRow label="Other Operating Receipts" value={(periodBalances['400.50.0000']||0)+(periodBalances['410.10.0000']||0)} />
                  <SummaryRow label="PBS Support Subsidy" value={periodBalances['410.20.0000']||0} />
                  <SummaryRow isBold label="Total Operating Revenue" value={Object.keys(periodBalances).filter(c=>c.startsWith('4')).reduce((s,c)=>s+(periodBalances[c]||0), 0)} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-black border-b-2 border-black pb-1 uppercase tracking-widest">Operating Expenditure</h3>
                <div className="pl-4 space-y-1 mt-4">
                  <SummaryRow label="Bank Charges & Excise Duty" value={periodBalances['500.10.0000']||0} />
                  <SummaryRow label="Audit & Professional Fees" value={periodBalances['500.20.0000']||0} />
                  <SummaryRow label="Administrative Support Expenses" value={periodBalances['500.30.0000']||0} />
                  <SummaryRow label="Allocated Member Profit" value={periodBalances['500.60.0000']||0} />
                  <SummaryRow isBold label="Total Operating Expenditure" value={Object.keys(periodBalances).filter(c=>c.startsWith('5')).reduce((s,c)=>s+(periodBalances[c]||0), 0)} />
                </div>
              </div>
              <SummaryRow isGrandTotal label="Net Institutional Surplus / (Deficit)" value={netSurplus} />
            </div>
            <div className="mt-24 pt-4 border-t border-black flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
              <span>Statutory Compliance Matrix</span><span>Professional Terminal v1.0</span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="changes">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white p-12 print:p-0">
            <IAS1_Heading title="Statement of Changes in Members' Funds" date={`Period: ${dateRange.start} to ${dateRange.end}`} />
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] font-black border-collapse border-2 border-black">
                <thead className="bg-slate-100 border-b-2 border-black">
                  <tr>
                    <th className="border border-black p-3 text-left uppercase">Description of Movement</th>
                    <th className="border border-black p-3 text-right uppercase">Principal (৳)</th>
                    <th className="border border-black p-3 text-right uppercase">Allocated Profit (৳)</th>
                    <th className="border border-black p-3 text-right uppercase bg-slate-200">Aggregate Fund (৳)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-12">
                    <td className="border border-black p-3 uppercase opacity-50">Opening Balance Brought Forward</td>
                    <td className="border border-black p-3 text-right">{formatCurrency((balances['200.10.0000']||0)+(balances['200.20.0000']||0) - (periodBalances['200.10.0000']||0) - (periodBalances['200.20.0000']||0))}</td>
                    <td className="border border-black p-3 text-right">{formatCurrency((balances['200.30.0000']||0)+(balances['200.40.0000']||0) - (periodBalances['200.30.0000']||0) - (periodBalances['200.40.0000']||0))}</td>
                    <td className="border border-black p-3 text-right bg-slate-50 font-bold">---</td>
                  </tr>
                  <tr className="h-12 bg-slate-50/30">
                    <td className="border border-black p-3 uppercase">Net Contributions during period</td>
                    <td className="border border-black p-3 text-right">{formatCurrency((periodBalances['200.10.0000']||0)+(periodBalances['200.20.0000']||0))}</td>
                    <td className="border border-black p-3 text-right">0.00</td>
                    <td className="border border-black p-3 text-right">---</td>
                  </tr>
                  <tr className="h-12">
                    <td className="border border-black p-3 uppercase">Profit Allocation for the period</td>
                    <td className="border border-black p-3 text-right">0.00</td>
                    <td className="border border-black p-3 text-right">{formatCurrency(netSurplus)}</td>
                    <td className="border border-black p-3 text-right">---</td>
                  </tr>
                </tbody>
                <tfoot className="bg-black text-white font-black">
                  <tr className="h-16">
                    <td className="border border-white/20 p-3 uppercase tracking-widest">Closing Institutional Balance</td>
                    <td className="border border-white/20 p-3 text-right text-lg">{formatCurrency(balances['200.10.0000']||0 + (balances['200.20.0000']||0))}</td>
                    <td className="border border-white/20 p-3 text-right text-lg">{formatCurrency(balances['200.30.0000']||0 + (balances['200.40.0000']||0))}</td>
                    <td className="border border-white/20 p-3 text-right text-2xl underline decoration-double">৳ {formatCurrency((balances['200.10.0000']||0)+(balances['200.20.0000']||0)+(balances['200.30.0000']||0)+(balances['200.40.0000']||0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-20 pt-4 border-t border-black flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
              <span>Audited Fund Lifecycle Statement</span><span>Gazipur PBS-2 Authority</span>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cash">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white p-12 print:p-0">
            <IAS1_Heading title="Statement of Cash Flows (Direct)" date={`For the period ended ${dateRange.end}`} />
            <div className="space-y-12 max-w-3xl mx-auto">
              <div>
                <h3 className="text-sm font-black border-b-2 border-black pb-1 uppercase tracking-widest">Operating Cash Receipts</h3>
                <div className="pl-4 space-y-1 mt-4">
                  {Object.keys(periodBalances).filter(c=>periodBalances[c]>0 && activeCOA.find(a=>a.code===c)?.balance==='Credit').map(c=>(
                    <SummaryRow key={c} label={activeCOA.find(a=>a.code===c)?.name} value={periodBalances[c]} />
                  ))}
                  <SummaryRow isBold label="Net Increase in Trust Cash" value={Object.values(periodBalances).reduce((s,v)=>s+v,0)} />
                </div>
              </div>
            </div>
            <div className="mt-32 pt-4 border-t border-black flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
              <span>Verified Cash Liquidity Terminal</span><span>Professional Documentation v1.0</span>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
