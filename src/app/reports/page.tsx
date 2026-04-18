
"use client"

import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Loader2, Printer, ShieldCheck, Scale, ArrowRightLeft, FileStack, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { format, subYears, parseISO } from "date-fns";

export default function ReportsPage() {
  const firestore = useFirestore();
  const [selectedFiscalYear, setSelectedFY] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = (generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2").toUpperCase();

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
      setDateRange({ start: "2010-01-01", end: format(new Date(), 'yyyy-MM-dd') });
    } else {
      const startYear = parseInt(fy.split("-")[0]);
      setDateRange({ start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` });
    }
  };

  useEffect(() => {
    if (availableFYs.length > 0 && !selectedFiscalYear) handleFYChange(availableFYs[0]);
  }, [availableFYs, selectedFiscalYear]);

  // Helper to get balance for an account or group at a specific point in time
  const getBalanceAtDate = (targetDateStr: string, codes: string | string[]) => {
    if (!entries || !targetDateStr) return 0;
    const cutOff = new Date(`${targetDateStr}T23:59:59`).getTime();
    const codeList = Array.isArray(codes) ? codes : [codes];

    let total = 0;
    entries.forEach(entry => {
      if (new Date(entry.entryDate).getTime() > cutOff) return;
      (entry.lines || []).forEach((line: any) => {
        // Match exact code or check if it starts with the group prefix
        const isMatch = codeList.some(code => 
          line.accountCode === code || 
          (code.endsWith('.00.0000') && line.accountCode.startsWith(code.split('.')[0]))
        );
        
        if (isMatch) {
          const coa = activeCOA.find(a => a.code === line.accountCode);
          if (!coa) return;
          const amt = coa.balance === 'Debit' ? (Number(line.debit) - Number(line.credit)) : (Number(line.credit) - Number(line.debit));
          total += amt;
        }
      });
    });
    return total;
  };

  // Helper to get periodic movement (Income/Expense)
  const getMovementForPeriod = (startStr: string, endStr: string, codes: string | string[]) => {
    if (!entries || !startStr || !endStr) return 0;
    const s = new Date(`${startStr}T00:00:00`).getTime();
    const e = new Date(`${endStr}T23:59:59`).getTime();
    const codeList = Array.isArray(codes) ? codes : [codes];

    let total = 0;
    entries.forEach(entry => {
      const t = new Date(entry.entryDate).getTime();
      if (t < s || t > e) return;
      (entry.lines || []).forEach((line: any) => {
        const isMatch = codeList.some(code => 
          line.accountCode === code || 
          (code.endsWith('.00.0000') && line.accountCode.startsWith(code.split('.')[0]))
        );

        if (isMatch) {
          const coa = activeCOA.find(a => a.code === line.accountCode);
          if (!coa) return;
          const amt = coa.balance === 'Debit' ? (Number(line.debit) - Number(line.credit)) : (Number(line.credit) - Number(line.debit));
          total += amt;
        }
      });
    });
    return total;
  };

  const prevYearEnd = useMemo(() => {
    if (!dateRange.end) return "";
    try { return format(subYears(parseISO(dateRange.end), 1), 'yyyy-MM-dd'); } catch { return ""; }
  }, [dateRange.end]);

  const prevYearStart = useMemo(() => {
    if (!dateRange.start) return "";
    try { return format(subYears(parseISO(dateRange.start), 1), 'yyyy-MM-dd'); } catch { return ""; }
  }, [dateRange.start]);

  const currentPeriodLabel = dateRange.end ? format(parseISO(dateRange.end), 'dd-MMM-yy') : "N/A";
  const previousPeriodLabel = prevYearEnd ? format(parseISO(prevYearEnd), 'dd-MMM-yy') : "N/A";

  const formatValue = (val: number) => {
    if (val === 0) return "—";
    return new Intl.NumberFormat('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  if (isCoaLoading || isEntriesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <div className="flex flex-col gap-6 no-print max-w-6xl mx-auto w-full bg-white p-8 rounded-3xl border-2 border-black shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="bg-black p-3 rounded-2xl shadow-xl"><ShieldCheck className="size-8 text-white" /></div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Financial Reporting Matrix</h1>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Institutional Audit Terminal</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild className="h-11 gap-2 font-black px-8 border-2 border-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg">
              <Link href="/reports/trial-balance"><Scale className="size-4" /> Trial Balance</Link>
            </Button>
            <Button onClick={() => window.print()} className="h-11 gap-2 font-black px-10 bg-black text-white rounded-xl uppercase text-[10px] tracking-widest shadow-xl">
              <Printer className="size-4" /> Print Report
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 p-6 bg-slate-50 border-2 border-black rounded-2xl">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Fiscal Year Basis</Label>
            <Select value={selectedFiscalYear} onValueChange={handleFYChange}>
              <SelectTrigger className="h-11 font-black border-2 border-black focus:ring-0 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black">Fiscal Year {fy}</SelectItem>)}<SelectItem value="all" className="font-black">Consolidated</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Period Range</Label>
            <div className="flex items-center gap-4">
              <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-11 font-black border-2 border-black bg-white" />
              <ArrowRightLeft className="size-5 opacity-20" />
              <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-11 font-black border-2 border-black bg-white" />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full max-w-6xl mx-auto">
        <TabsList className="grid w-full grid-cols-2 mb-8 no-print h-14 bg-slate-100 border-2 border-black p-1 rounded-2xl">
          <TabsTrigger value="position" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white">Financial Position (BS)</TabsTrigger>
          <TabsTrigger value="income" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white">Income Statement (PL)</TabsTrigger>
        </TabsList>

        {/* --- STATEMENT OF FINANCIAL POSITION --- */}
        <TabsContent value="position" className="animate-in fade-in duration-500">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white p-16 print:p-0 font-ledger">
            <div className="text-center mb-10 text-black">
              <h1 className="text-2xl font-black uppercase tracking-tight">{pbsName}</h1>
              <p className="text-lg font-black uppercase tracking-[0.2em] mt-1">Employees' Provident Fund</p>
              <h2 className="text-xl font-black mt-6 uppercase underline underline-offset-8">Statement of Financial Position</h2>
              <p className="text-sm font-black mt-6">As at {dateRange.end ? format(parseISO(dateRange.end), 'MMMM d, yyyy') : '...'}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-black text-[11px] font-black tabular-nums">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-black">
                    <th className="border-r border-black p-3 text-left w-[120px]">Account Code</th>
                    <th className="border-r border-black p-3 text-left">Particulars</th>
                    <th className="border-r border-black p-3 text-center w-[60px]">Note</th>
                    <th colSpan={2} className="p-3 text-center border-b border-black">Amount in Taka</th>
                  </tr>
                  <tr className="bg-slate-100 border-b-2 border-black">
                    <th className="border-r border-black"></th>
                    <th className="border-r border-black"></th>
                    <th className="border-r border-black"></th>
                    <th className="border-r border-black p-2 text-center w-[140px]">{currentPeriodLabel}</th>
                    <th className="p-2 text-center w-[140px]">{previousPeriodLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50"><td colSpan={5} className="p-2 pl-4 border-b border-black font-black uppercase tracking-widest text-[10px]">ASSETS:</td></tr>
                  {[
                    { code: '101.00.0000', label: 'Investment', note: '1' },
                    { code: '105.00.0000', label: 'Member Loans (outstanding)', note: '2' },
                    { code: '106.00.0000', label: 'Accrued Revenue Interest', note: '3' },
                    { code: '107.00.0000', label: 'Receivables', note: '4' },
                    { code: '108.00.0000', label: 'Advance Tax', note: '5' },
                    { code: '131.00.0000', label: 'Cash & Bank', note: '6' },
                  ].map((row) => (
                    <tr key={row.code} className="border-b border-black hover:bg-slate-50/50">
                      <td className="border-r border-black p-2 pl-3 font-mono">{row.code}</td>
                      <td className="border-r border-black p-2 pl-4">{row.label}</td>
                      <td className="border-r border-black p-2 text-center">{row.note}</td>
                      <td className="border-r border-black p-2 text-right pr-4">{formatValue(getBalanceAtDate(dateRange.end, row.code))}</td>
                      <td className="p-2 text-right pr-4">{formatValue(getBalanceAtDate(prevYearEnd, row.code))}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black h-10">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black p-2 pl-4 uppercase">Total Assets</td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black p-2 text-right pr-4 underline decoration-double">
                      {formatValue(['101','105','106','107','108','131'].reduce((s,c)=>s+getBalanceAtDate(dateRange.end, c+'.00.0000'), 0))}
                    </td>
                    <td className="p-2 text-right pr-4 underline decoration-double">
                      {formatValue(['101','105','106','107','108','131'].reduce((s,c)=>s+getBalanceAtDate(prevYearEnd, c+'.00.0000'), 0))}
                    </td>
                  </tr>

                  <tr className="bg-slate-50"><td colSpan={5} className="p-2 pl-4 border-y border-black font-black uppercase tracking-widest text-[10px]">LIABILITIES & MEMBER FUND:</td></tr>
                  {[
                    { code: '200.00.0000', label: 'Member Fund / Equity', note: '7' },
                    { code: '205.00.0000', label: 'Forfeiture', note: '8' },
                    { code: '205.10.0000', label: 'Lapse & Forfeiture Account', note: '9' },
                    { code: '210.00.0000', label: 'Payables', note: '10' },
                    { code: '210.10.0000', label: 'Audit & Professional Fee Payable', note: '11' },
                    { code: '210.20.0000', label: 'Payable to PBS', note: '12' },
                    { code: '210.30.0000', label: 'Audit Objection & Legal Procedure', note: '13' },
                    { code: '220.00.0000', label: 'Provisions', note: '14' },
                    { code: '220.10.0000', label: 'Provision for Income Tax', note: '15' },
                    { code: '225.50.0000', label: 'Final Settlement Payable', note: '16' },
                    { code: '225.60.0000', label: 'Retained Earnings (Reserved)', note: '17' },
                  ].map((row) => (
                    <tr key={row.code} className="border-b border-black hover:bg-slate-50/50">
                      <td className="border-r border-black p-2 pl-3 font-mono">{row.code}</td>
                      <td className="border-r border-black p-2 pl-4">{row.label}</td>
                      <td className="border-r border-black p-2 text-center">{row.note}</td>
                      <td className="border-r border-black p-2 text-right pr-4">{formatValue(getBalanceAtDate(dateRange.end, row.code))}</td>
                      <td className="p-2 text-right pr-4">{formatValue(getBalanceAtDate(prevYearEnd, row.code))}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black h-12">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black p-2 pl-4 uppercase">TOTAL LIABILITIES & MEMBER FUND</td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black p-2 text-right pr-4 underline decoration-double">
                      {formatValue(['200','205','210','220','225'].reduce((s,c)=>s+getBalanceAtDate(dateRange.end, c+'.00.0000'), 0))}
                    </td>
                    <td className="p-2 text-right pr-4 underline decoration-double">
                      {formatValue(['200','205','210','220','225'].reduce((s,c)=>s+getBalanceAtDate(prevYearEnd, c+'.00.0000'), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-32 grid grid-cols-3 gap-16 text-[12px] font-black text-center uppercase tracking-widest">
              <div className="border-t-2 border-black pt-4">Prepared by</div>
              <div className="border-t-2 border-black pt-4">Checked by</div>
              <div className="border-t-2 border-black pt-4">Approved By Trustee</div>
            </div>
          </Card>
        </TabsContent>

        {/* --- INCOME STATEMENT --- */}
        <TabsContent value="income">
          <Card className="border-2 border-black shadow-2xl rounded-none bg-white p-16 print:p-0 font-ledger">
            <div className="text-center mb-10 text-black">
              <h1 className="text-2xl font-black uppercase tracking-tight">{pbsName}</h1>
              <p className="text-lg font-black uppercase tracking-[0.2em] mt-1">Employees' Provident Fund</p>
              <h2 className="text-xl font-black mt-6 uppercase underline underline-offset-8">Income Statement</h2>
              <p className="text-sm font-black mt-6">For the Year Ended June 30, {dateRange.end ? format(parseISO(dateRange.end), 'yyyy') : '...'}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-black text-[11px] font-black tabular-nums">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-black">
                    <th className="border-r border-black p-3 text-left w-[120px]">Code</th>
                    <th className="border-r border-black p-3 text-left">Particulars</th>
                    <th className="border-r border-black p-3 text-center w-[60px]">Note</th>
                    <th colSpan={2} className="p-3 text-center border-b border-black">Amount in Taka</th>
                  </tr>
                  <tr className="bg-slate-100 border-b-2 border-black">
                    <th className="border-r border-black"></th>
                    <th className="border-r border-black"></th>
                    <th className="border-r border-black"></th>
                    <th className="border-r border-black p-2 text-center w-[140px]">{currentPeriodLabel}</th>
                    <th className="p-2 text-center w-[140px]">{previousPeriodLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50"><td colSpan={5} className="p-2 pl-4 border-b border-black font-black uppercase text-[10px]">A. OPERATING INCOME</td></tr>
                  {[
                    { code: '400.00.0000', label: 'Interest Income', note: '18' },
                    { code: '400.10.0000', label: 'Interest on FDR', note: '19' },
                    { code: '400.20.0000', label: 'Interest on Savings Certificate', note: '20' },
                    { code: '400.30.0000', label: 'Interest on Bond', note: '21' },
                    { code: '400.40.0000', label: 'Interest on Member Loan', note: '22' },
                    { code: '400.50.0000', label: 'Interest on Bank Balance', note: '23' },
                  ].map((row) => (
                    <tr key={row.code} className="border-b border-black hover:bg-slate-50/50">
                      <td className="border-r border-black p-2 pl-3 font-mono">{row.code}</td>
                      <td className={cn("border-r border-black p-2 pl-4", row.code.endsWith('.00.0000') ? "font-black" : "pl-8")}>{row.label}</td>
                      <td className="border-r border-black p-2 text-center">{row.note}</td>
                      <td className="border-r border-black p-2 text-right pr-4">{formatValue(getMovementForPeriod(dateRange.start, dateRange.end, row.code))}</td>
                      <td className="p-2 text-right pr-4">{formatValue(getMovementForPeriod(prevYearStart, prevYearEnd, row.code))}</td>
                    </tr>
                  ))}

                  <tr className="bg-slate-50"><td colSpan={5} className="p-2 pl-4 border-y border-black font-black uppercase text-[10px]">B. NON OPERATING INCOME & SUBSIDY</td></tr>
                  {[
                    { code: '410.10.0000', label: 'Forfeiture Income', note: '24' },
                    { code: '410.20.0000', label: 'PBS Subsidy (Administrative Support)', note: '25' },
                  ].map((row) => (
                    <tr key={row.code} className="border-b border-black hover:bg-slate-50/50">
                      <td className="border-r border-black p-2 pl-3 font-mono">{row.code}</td>
                      <td className="border-r border-black p-2 pl-4">{row.label}</td>
                      <td className="border-r border-black p-2 text-center">{row.note}</td>
                      <td className="border-r border-black p-2 text-right pr-4">{formatValue(getMovementForPeriod(dateRange.start, dateRange.end, row.code))}</td>
                      <td className="p-2 text-right pr-4">{formatValue(getMovementForPeriod(prevYearStart, prevYearEnd, row.code))}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black h-10 border-b-2 border-black">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black p-2 pl-4 uppercase">Total INCOME (C)</td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black p-2 text-right pr-4">
                      {formatValue(getMovementForPeriod(dateRange.start, dateRange.end, ['400','410']))}
                    </td>
                    <td className="p-2 text-right pr-4">
                      {formatValue(getMovementForPeriod(prevYearStart, prevYearEnd, ['400','410']))}
                    </td>
                  </tr>

                  <tr className="bg-slate-50"><td colSpan={5} className="p-2 pl-4 border-b border-black font-black uppercase text-[10px]">D. OPERATING EXPENSE</td></tr>
                  {[
                    { code: '500.10.0000', label: 'Bank Charges & Excise Duty', note: '26' },
                    { code: '500.20.0000', label: 'Audit & Professional Fees', note: '27' },
                    { code: '500.30.0000', label: 'Administrative Expenses', note: '28' },
                    { code: '500.40.0000', label: 'Loss on Investment', note: '29' },
                  ].map((row) => (
                    <tr key={row.code} className="border-b border-black hover:bg-slate-50/50">
                      <td className="border-r border-black p-2 pl-3 font-mono">{row.code}</td>
                      <td className="border-r border-black p-2 pl-4">{row.label}</td>
                      <td className="border-r border-black p-2 text-center">{row.note}</td>
                      <td className="border-r border-black p-2 text-right pr-4">{formatValue(getMovementForPeriod(dateRange.start, dateRange.end, row.code))}</td>
                      <td className="p-2 text-right pr-4">{formatValue(getMovementForPeriod(prevYearStart, prevYearEnd, row.code))}</td>
                    </tr>
                  ))}
                  
                  <tr className="bg-slate-50 font-black border-y-2 border-black h-10">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black p-2 pl-4 uppercase">INCOME BEFORE TAX</td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black p-2 text-right pr-4">
                      {formatValue(getMovementForPeriod(dateRange.start, dateRange.end, ['400','410']) - getMovementForPeriod(dateRange.start, dateRange.end, ['500.10','500.20','500.30','500.40']))}
                    </td>
                    <td className="p-2 text-right pr-4">
                      {formatValue(getMovementForPeriod(prevYearStart, prevYearEnd, ['400','410']) - getMovementForPeriod(prevYearStart, prevYearEnd, ['500.10','500.20','500.30','500.40']))}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/50 border-b border-black">
                    <td className="border-r border-black p-2 pl-3 font-mono">500.50.0000</td>
                    <td className="border-r border-black p-2 pl-4">Income Tax Expense</td>
                    <td className="border-r border-black p-2 text-center">30</td>
                    <td className="border-r border-black p-2 text-right pr-4">{formatValue(getMovementForPeriod(dateRange.start, dateRange.end, '500.50.0000'))}</td>
                    <td className="p-2 text-right pr-4">{formatValue(getMovementForPeriod(prevYearStart, prevYearEnd, '500.50.0000'))}</td>
                  </tr>

                  <tr className="bg-slate-100 font-black border-y-2 border-black h-10">
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black p-2 pl-4 uppercase text-primary">E. NET INCOME FOR DISTRIBUTION</td>
                    <td className="border-r border-black"></td>
                    <td className="border-r border-black p-2 text-right pr-4">
                      {formatValue(getMovementForPeriod(dateRange.start, dateRange.end, ['400','410']) - getMovementForPeriod(dateRange.start, dateRange.end, ['500.10','500.20','500.30','500.40','500.50']))}
                    </td>
                    <td className="p-2 text-right pr-4">
                      {formatValue(getMovementForPeriod(prevYearStart, prevYearEnd, ['400','410']) - getMovementForPeriod(prevYearStart, prevYearEnd, ['500.10','500.20','500.30','500.40','500.50']))}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/50 border-b border-black">
                    <td className="border-r border-black p-2 pl-3 font-mono">500.60.0000</td>
                    <td className="border-r border-black p-2 pl-4">Interest Distribution</td>
                    <td className="border-r border-black p-2 text-center">31</td>
                    <td className="border-r border-black p-2 text-right pr-4">{formatValue(getMovementForPeriod(dateRange.start, dateRange.end, '500.60.0000'))}</td>
                    <td className="p-2 text-right pr-4">{formatValue(getMovementForPeriod(prevYearStart, prevYearEnd, '500.60.0000'))}</td>
                  </tr>

                  <tr className="bg-black text-white font-black h-12">
                    <td className="border-r border-white/20"></td>
                    <td className="border-r border-white/20 p-2 pl-4 uppercase tracking-widest">Net Margin</td>
                    <td className="border-r border-white/20"></td>
                    <td className="border-r border-white/20 p-2 text-right pr-4 underline decoration-double">
                      {formatValue(getMovementForPeriod(dateRange.start, dateRange.end, ['400','410']) - getMovementForPeriod(dateRange.start, dateRange.end, ['500']))}
                    </td>
                    <td className="p-2 text-right pr-4 underline decoration-double">
                      {formatValue(getMovementForPeriod(prevYearStart, prevYearEnd, ['400','410']) - getMovementForPeriod(prevYearStart, prevYearEnd, ['500']))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-32 grid grid-cols-3 gap-16 text-[12px] font-black text-center uppercase tracking-widest text-black">
              <div className="border-t-2 border-black pt-4">Prepared by</div>
              <div className="border-t-2 border-black pt-4">Checked by</div>
              <div className="border-t-2 border-black pt-4">Approved By Trustee</div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
