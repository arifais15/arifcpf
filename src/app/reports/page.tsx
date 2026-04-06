"use client"

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_OF_ACCOUNTS } from "@/lib/coa-data";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { Loader2, Printer, Download, TrendingUp, Wallet, ArrowDownUp, ShieldCheck, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarizeFinancialReport } from "@/ai/flows/financial-report-summarizer";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ReportsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [selectedFY, setSelectedFY] = useState("2023-24");

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: entries, isLoading } = useCollection(entriesRef);

  const fyDates = useMemo(() => {
    const startYear = parseInt(selectedFY.split("-")[0]) + 2000;
    const endYear = startYear + 1;
    return {
      start: `${startYear}-07-01`,
      end: `${endYear}-06-30`,
      display: `FY ${selectedFY} (July ${startYear} - June ${endYear})`
    };
  }, [selectedFY]);

  // Aggregate balances from double-entry lines
  const bsBalances = useMemo(() => {
    if (!entries) return {};
    const map: Record<string, number> = {};
    const endDate = new Date(fyDates.end).getTime();
    
    entries.forEach(entry => {
      const entryDate = new Date(entry.entryDate).getTime();
      if (entryDate > endDate) return;

      const entryLines = entry.lines || [];
      entryLines.forEach((line: any) => {
        const code = line.accountCode;
        const coa = CHART_OF_ACCOUNTS.find(a => a.code === code);
        if (!coa) return;

        // In reports, we normalize value based on normal balance
        // Asset/Expense: Debit - Credit
        // Liability/Income/Equity: Credit - Debit
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
  }, [entries, fyDates.end]);

  const periodBalances = useMemo(() => {
    if (!entries) return {};
    const map: Record<string, number> = {};
    const startDate = new Date(fyDates.start).getTime();
    const endDate = new Date(fyDates.end).getTime();
    
    entries.forEach(entry => {
      const entryDate = new Date(entry.entryDate).getTime();
      if (entryDate < startDate || entryDate > endDate) return;

      const entryLines = entry.lines || [];
      entryLines.forEach((line: any) => {
        const code = line.accountCode;
        const coa = CHART_OF_ACCOUNTS.find(a => a.code === code);
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
  }, [entries, fyDates.start, fyDates.end]);

  const handleAISummarize = async (reportName: string, content: string) => {
    setIsSummarizing(true);
    try {
      const result = await summarizeFinancialReport({ reportContent: `${reportName}\n\n${content}` });
      setAiSummary(result.summary);
    } catch (err) {
      toast({ title: "AI Error", description: "Failed to generate report summary.", variant: "destructive" });
    } finally {
      setIsSummarizing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2
    }).format(val).replace('BDT', '৳');
  };

  const ReportHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="text-center mb-10 border-b pb-8">
      <h1 className="text-2xl font-bold uppercase tracking-[0.2em] text-primary">Gazipur Palli Bidyut Samity-2</h1>
      <h2 className="text-xl font-bold text-slate-800 mt-2 font-ledger">{title}</h2>
      <p className="text-sm text-muted-foreground uppercase tracking-widest mt-1">{subtitle}</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  const assetAccounts = CHART_OF_ACCOUNTS.filter(a => (a.type === 'Asset' || a.type === 'Contra-Asset') && (bsBalances[a.code] || a.isHeader));
  const liabilityAccounts = CHART_OF_ACCOUNTS.filter(a => a.type === 'Liability' && (bsBalances[a.code] || a.isHeader));
  const equityAccounts = CHART_OF_ACCOUNTS.filter(a => a.type === 'Equity' && (bsBalances[a.code] || a.isHeader));

  const totalAssets = assetAccounts.reduce((sum, acc) => sum + (bsBalances[acc.code] || 0), 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + (bsBalances[acc.code] || 0), 0);
  const totalEquity = equityAccounts.reduce((sum, acc) => sum + (bsBalances[acc.code] || 0), 0);

  return (
    <div className="p-8 flex flex-col gap-8 bg-slate-50 min-h-screen font-ledger">
      <div className="flex items-center justify-between no-print max-w-6xl mx-auto w-full bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-primary tracking-tight">IFRS Double-Entry Reports</h1>
          <p className="text-xs text-muted-foreground">July to June Fiscal Cycle (Double-Entry Aggregation)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium">Fiscal Year:</span>
            <Select value={selectedFY} onValueChange={setSelectedFY}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Select FY" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2022-23">FY 2022-23</SelectItem>
                <SelectItem value="2023-24">FY 2023-24</SelectItem>
                <SelectItem value="2024-25">FY 2024-25</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full max-w-6xl mx-auto">
        <TabsList className="grid w-full grid-cols-3 mb-8 no-print h-12 bg-white border shadow-sm">
          <TabsTrigger value="position" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Wallet className="size-4" /> Financial Position
          </TabsTrigger>
          <TabsTrigger value="income" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <TrendingUp className="size-4" /> Income Statement
          </TabsTrigger>
          <TabsTrigger value="receipts" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <ArrowDownUp className="size-4" /> Receipt & Payment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="position">
          <Card className="border shadow-xl rounded-none print:shadow-none bg-white">
            <CardContent className="p-16">
              <ReportHeader title="Statement of Financial Position" subtitle={`As of June 30, 20${selectedFY.split('-')[1]}`} />
              <div className="space-y-12">
                <section>
                  <h3 className="text-lg font-bold border-b-2 border-primary/20 pb-2 mb-4 text-primary">I. ASSETS</h3>
                  <Table className="border border-slate-200">
                    <TableBody>
                      {assetAccounts.map((acc) => (
                        <TableRow key={acc.code} className={acc.isHeader ? "bg-slate-50/50 font-bold" : ""}>
                          <TableCell className="font-mono text-[10px] w-[120px]">{acc.code}</TableCell>
                          <TableCell className={acc.isHeader ? "pl-4" : "pl-8"}>{acc.name}</TableCell>
                          <TableCell className="text-right font-medium">
                            {!acc.isHeader && formatCurrency(bsBalances[acc.code] || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-primary/5 font-bold">
                        <TableCell colSpan={2} className="text-right">TOTAL ASSETS</TableCell>
                        <TableCell className="text-right border-t-2 border-primary underline decoration-double">{formatCurrency(totalAssets)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </section>
                <section>
                  <h3 className="text-lg font-bold border-b-2 border-primary/20 pb-2 mb-4 text-primary">II. EQUITY AND LIABILITIES</h3>
                  <Table className="border border-slate-200">
                    <TableBody>
                      {[...equityAccounts, ...liabilityAccounts].map((acc) => (
                        <TableRow key={acc.code} className={acc.isHeader ? "bg-slate-50/50 font-bold" : ""}>
                          <TableCell className="font-mono text-[10px] w-[120px]">{acc.code}</TableCell>
                          <TableCell className={acc.isHeader ? "pl-4" : "pl-8"}>{acc.name}</TableCell>
                          <TableCell className="text-right font-medium">
                            {!acc.isHeader && formatCurrency(bsBalances[acc.code] || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-primary/5 font-bold">
                        <TableCell colSpan={2} className="text-right">TOTAL EQUITY AND LIABILITIES</TableCell>
                        <TableCell className="text-right border-t-2 border-primary underline decoration-double">{formatCurrency(totalEquity + totalLiabilities)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </section>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card className="border shadow-xl rounded-none print:shadow-none bg-white">
            <CardContent className="p-16">
              <ReportHeader title="Statement of Comprehensive Income" subtitle={`For the Year Ended June 30, 20${selectedFY.split('-')[1]}`} />
              <div className="space-y-10 max-w-4xl mx-auto">
                <section>
                  <h3 className="font-bold border-b-2 border-slate-200 pb-2 uppercase text-sm mb-4 text-primary">Operating Income</h3>
                  {CHART_OF_ACCOUNTS.filter(a => a.type === 'Income').map(acc => (
                    <div key={acc.code} className="flex justify-between text-sm py-2 border-b border-dotted pl-4">
                      <span>{acc.name}</span>
                      <span className="font-medium">{formatCurrency(periodBalances[acc.code] || 0)}</span>
                    </div>
                  ))}
                </section>
                <section>
                  <h3 className="font-bold border-b-2 border-slate-200 pb-2 uppercase text-sm mb-4 text-rose-800">Operating Expenses</h3>
                  {CHART_OF_ACCOUNTS.filter(a => a.type === 'Expense').map(acc => (
                    <div key={acc.code} className="flex justify-between text-sm py-2 border-b border-dotted pl-4">
                      <span>{acc.name}</span>
                      <span className="font-medium">{formatCurrency(periodBalances[acc.code] || 0)}</span>
                    </div>
                  ))}
                </section>
                <div className="flex justify-between font-bold text-xl bg-primary text-white p-6 rounded-none mt-12">
                  <span>Net surplus / (Deficit)</span>
                  <span>
                    {formatCurrency(
                      Object.keys(periodBalances)
                        .filter(code => CHART_OF_ACCOUNTS.find(a => a.code === code)?.type === 'Income')
                        .reduce((sum, code) => sum + periodBalances[code], 0) -
                      Object.keys(periodBalances)
                        .filter(code => CHART_OF_ACCOUNTS.find(a => a.code === code)?.type === 'Expense')
                        .reduce((sum, code) => sum + periodBalances[code], 0)
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
           {/* Similar structure but filtering for Cash/Bank movements specifically if desired, or simplified total movement */}
           <Card className="border shadow-xl rounded-none print:shadow-none bg-white">
            <CardContent className="p-16">
              <ReportHeader title="Receipts and Payments" subtitle={`For the Year Ended June 30, 20${selectedFY.split('-')[1]}`} />
              <div className="grid grid-cols-2 gap-px bg-slate-300 border">
                 <div className="bg-white p-6">
                    <h4 className="font-bold text-primary mb-4 border-b pb-2">RECEIPTS</h4>
                    {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && CHART_OF_ACCOUNTS.find(a => a.code === c)?.balance === 'Credit').map(c => (
                      <div key={c} className="flex justify-between text-xs py-1 border-b border-dotted">
                        <span>{CHART_OF_ACCOUNTS.find(a => a.code === c)?.name}</span>
                        <span>{formatCurrency(periodBalances[c])}</span>
                      </div>
                    ))}
                 </div>
                 <div className="bg-white p-6">
                    <h4 className="font-bold text-rose-700 mb-4 border-b pb-2">PAYMENTS</h4>
                    {Object.keys(periodBalances).filter(c => periodBalances[c] > 0 && CHART_OF_ACCOUNTS.find(a => a.code === c)?.balance === 'Debit').map(c => (
                      <div key={c} className="flex justify-between text-xs py-1 border-b border-dotted">
                        <span>{CHART_OF_ACCOUNTS.find(a => a.code === c)?.name}</span>
                        <span>{formatCurrency(periodBalances[c])}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
