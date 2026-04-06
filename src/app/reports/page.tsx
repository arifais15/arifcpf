"use client"

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_OF_ACCOUNTS, COAEntry } from "@/lib/coa-data";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { Loader2, FileText, Printer, Download, TrendingUp, Wallet, ArrowDownUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarizeFinancialReport } from "@/ai/flows/financial-report-summarizer";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function ReportsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: entries, isLoading } = useCollection(entriesRef);

  // Group balances by account code
  const balances = useMemo(() => {
    if (!entries) return {};
    const map: Record<string, number> = {};
    
    entries.forEach(entry => {
      const line = entry.primaryLine;
      if (!line) return;
      
      const code = line.chartOfAccountId;
      const amount = Number(line.amount) || 0;
      
      if (!map[code]) map[code] = 0;
      map[code] += amount;
    });
    
    return map;
  }, [entries]);

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

  const assetAccounts = CHART_OF_ACCOUNTS.filter(a => (a.type === 'Asset' || a.type === 'Contra-Asset') && (balances[a.code] || a.isHeader));
  const liabilityAccounts = CHART_OF_ACCOUNTS.filter(a => a.type === 'Liability' && (balances[a.code] || a.isHeader));
  const equityAccounts = CHART_OF_ACCOUNTS.filter(a => a.type === 'Equity' && (balances[a.code] || a.isHeader));

  const totalAssets = assetAccounts.reduce((sum, acc) => sum + (balances[acc.code] || 0), 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, acc) => sum + (balances[acc.code] || 0), 0);
  const totalEquity = equityAccounts.reduce((sum, acc) => sum + (balances[acc.code] || 0), 0);

  return (
    <div className="p-8 flex flex-col gap-8 bg-slate-50 min-h-screen font-ledger">
      <div className="flex items-center justify-between no-print max-w-6xl mx-auto w-full">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">IFRS Financial Reports</h1>
          <p className="text-muted-foreground">Dynamic auditing and reporting based on Chart of Accounts nature</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4 mr-2" />
            Print Reports
          </Button>
          <Button variant="outline" size="sm">
            <Download className="size-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full max-w-6xl mx-auto">
        <TabsList className="grid w-full grid-cols-3 mb-8 no-print h-12 bg-white border shadow-sm">
          <TabsTrigger value="position" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <Wallet className="size-4" /> Statement of Financial Position
          </TabsTrigger>
          <TabsTrigger value="income" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <TrendingUp className="size-4" /> Income Statement
          </TabsTrigger>
          <TabsTrigger value="receipts" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <ArrowDownUp className="size-4" /> Receipt & Payment
          </TabsTrigger>
        </TabsList>

        {/* --- FINANCIAL POSITION (BALANCE SHEET) --- */}
        <TabsContent value="position">
          <Card className="border shadow-xl rounded-none print:shadow-none print:border-none bg-white">
            <CardContent className="p-16">
              <ReportHeader title="Statement of Financial Position" subtitle="As of October 31, 2023" />
              
              <div className="space-y-12">
                {/* Assets Section */}
                <div>
                  <h3 className="text-lg font-bold border-b-2 border-primary/20 pb-2 mb-4 text-primary">I. ASSETS</h3>
                  <Table className="border border-slate-200">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-[120px] font-bold">Code</TableHead>
                        <TableHead className="font-bold">Account Particulars</TableHead>
                        <TableHead className="font-bold">Type</TableHead>
                        <TableHead className="font-bold">Nature</TableHead>
                        <TableHead className="text-right font-bold">Amount (৳)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assetAccounts.map((acc) => (
                        <TableRow key={acc.code} className={acc.isHeader ? "bg-slate-50/50 font-bold" : ""}>
                          <TableCell className="font-mono text-[10px]">{acc.code}</TableCell>
                          <TableCell className={acc.isHeader ? "pl-4" : "pl-8"}>{acc.name}</TableCell>
                          <TableCell className="text-[10px]">{acc.type || '-'}</TableCell>
                          <TableCell className="text-[10px]">
                            {acc.balance && (
                              <Badge variant="outline" className={`text-[9px] ${acc.balance === 'Debit' ? 'border-blue-200 text-blue-700' : 'border-orange-200 text-orange-700'}`}>
                                {acc.balance}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {!acc.isHeader && formatCurrency(balances[acc.code] || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-primary/5 font-bold">
                        <TableCell colSpan={4} className="text-right">TOTAL ASSETS</TableCell>
                        <TableCell className="text-right border-t-2 border-primary underline decoration-double">{formatCurrency(totalAssets)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Equity & Liabilities Section */}
                <div>
                  <h3 className="text-lg font-bold border-b-2 border-primary/20 pb-2 mb-4 text-primary">II. EQUITY AND LIABILITIES</h3>
                  
                  <div className="mb-6">
                    <h4 className="font-bold text-sm mb-2 text-slate-600">A. EQUITY</h4>
                    <Table className="border border-slate-200">
                      <TableBody>
                        {equityAccounts.map((acc) => (
                          <TableRow key={acc.code} className={acc.isHeader ? "bg-slate-50/50 font-bold" : ""}>
                            <TableCell className="font-mono text-[10px] w-[120px]">{acc.code}</TableCell>
                            <TableCell className={acc.isHeader ? "pl-4" : "pl-8"}>{acc.name}</TableCell>
                            <TableCell className="text-right font-medium w-[150px]">
                              {!acc.isHeader && formatCurrency(balances[acc.code] || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm mb-2 text-slate-600">B. LIABILITIES</h4>
                    <Table className="border border-slate-200">
                      <TableBody>
                        {liabilityAccounts.map((acc) => (
                          <TableRow key={acc.code} className={acc.isHeader ? "bg-slate-50/50 font-bold" : ""}>
                            <TableCell className="font-mono text-[10px] w-[120px]">{acc.code}</TableCell>
                            <TableCell className={acc.isHeader ? "pl-4" : "pl-8"}>{acc.name}</TableCell>
                            <TableCell className="text-right font-medium w-[150px]">
                              {!acc.isHeader && formatCurrency(balances[acc.code] || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-primary/5 font-bold">
                          <TableCell colSpan={2} className="text-right">TOTAL EQUITY AND LIABILITIES</TableCell>
                          <TableCell className="text-right border-t-2 border-primary underline decoration-double">{formatCurrency(totalEquity + totalLiabilities)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <div className="mt-32 grid grid-cols-3 gap-12 text-center text-[10px] font-bold uppercase no-print-break">
                <div className="border-t border-black pt-3">Accountant</div>
                <div className="border-t border-black pt-3">AGM (Finance)</div>
                <div className="border-t border-black pt-3">General Manager</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- INCOME STATEMENT --- */}
        <TabsContent value="income">
          <Card className="border shadow-xl rounded-none print:shadow-none bg-white">
            <CardContent className="p-16">
              <ReportHeader title="Statement of Comprehensive Income" subtitle="For the Period Ended October 31, 2023" />
              
              <div className="space-y-10 max-w-4xl mx-auto">
                <section>
                  <h3 className="font-bold border-b-2 border-slate-200 pb-2 uppercase text-sm mb-4 text-primary">Operating Income</h3>
                  {CHART_OF_ACCOUNTS.filter(a => a.type === 'Income').map(acc => (
                    <div key={acc.code} className="flex justify-between text-sm py-2 border-b border-dotted pl-4">
                      <span className="flex gap-3">
                        <span className="font-mono text-[10px] text-muted-foreground">{acc.code}</span>
                        <span>{acc.name}</span>
                      </span>
                      <span className="font-medium">{formatCurrency(balances[acc.code] || 0)}</span>
                    </div>
                  ))}
                </section>

                <section>
                  <h3 className="font-bold border-b-2 border-slate-200 pb-2 uppercase text-sm mb-4 text-rose-800">Operating Expenses</h3>
                  {CHART_OF_ACCOUNTS.filter(a => a.type === 'Expense').map(acc => (
                    <div key={acc.code} className="flex justify-between text-sm py-2 border-b border-dotted pl-4">
                      <span className="flex gap-3">
                        <span className="font-mono text-[10px] text-muted-foreground">{acc.code}</span>
                        <span>{acc.name}</span>
                      </span>
                      <span className="font-medium">{formatCurrency(balances[acc.code] || 0)}</span>
                    </div>
                  ))}
                </section>

                <div className="flex justify-between font-bold text-xl bg-slate-900 text-white p-6 rounded-none mt-12">
                  <span>Net Profit/Loss for the Period</span>
                  <span>
                    {formatCurrency(
                      Object.keys(balances)
                        .filter(code => CHART_OF_ACCOUNTS.find(a => a.code === code)?.type === 'Income')
                        .reduce((sum, code) => sum + balances[code], 0) -
                      Object.keys(balances)
                        .filter(code => CHART_OF_ACCOUNTS.find(a => a.code === code)?.type === 'Expense')
                        .reduce((sum, code) => sum + balances[code], 0)
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- RECEIPT AND PAYMENT --- */}
        <TabsContent value="receipts">
          <Card className="border shadow-xl rounded-none print:shadow-none bg-white">
            <CardContent className="p-16">
              <ReportHeader title="Statement of Receipts and Payments" subtitle="For the Period Ended October 31, 2023" />
              
              <div className="grid grid-cols-2 gap-px bg-slate-400 border border-slate-400">
                <div className="bg-white p-8">
                  <h3 className="font-bold text-center border-b-2 border-primary pb-3 mb-6 uppercase text-sm text-primary">Receipts</h3>
                  <div className="space-y-3">
                    {Object.keys(balances).filter(code => {
                      const type = CHART_OF_ACCOUNTS.find(a => a.code === code)?.type;
                      return type === 'Income' || code.startsWith('105.2');
                    }).map(code => (
                      <div key={code} className="flex justify-between text-xs py-2 border-b border-dotted">
                        <span>{CHART_OF_ACCOUNTS.find(a => a.code === code)?.name}</span>
                        <span className="font-medium">{formatCurrency(balances[code])}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-8">
                  <h3 className="font-bold text-center border-b-2 border-rose-800 pb-3 mb-6 uppercase text-sm text-rose-800">Payments</h3>
                  <div className="space-y-3">
                     {Object.keys(balances).filter(code => {
                      const type = CHART_OF_ACCOUNTS.find(a => a.code === code)?.type;
                      return type === 'Expense' || code.startsWith('105.1');
                    }).map(code => (
                      <div key={code} className="flex justify-between text-xs py-2 border-b border-dotted">
                        <span>{CHART_OF_ACCOUNTS.find(a => a.code === code)?.name}</span>
                        <span className="font-medium">{formatCurrency(balances[code])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Analysis Section */}
      <div className="no-print mt-12 max-w-6xl mx-auto w-full">
        <Card className="bg-slate-900 text-white border-none rounded-none shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-6">
            <div>
              <CardTitle className="text-xl flex items-center gap-3">
                <ShieldCheck className="size-6 text-emerald-400" />
                AI Auditor's Insights
              </CardTitle>
              <CardDescription className="text-slate-400">Autonomous analysis of financial positions and IFRS compliance.</CardDescription>
            </div>
            <Button 
              size="sm" 
              className="bg-emerald-500 hover:bg-emerald-600 text-white border-none"
              onClick={() => handleAISummarize("Statement of Financial Position Analysis", JSON.stringify({ balances, assetTotal: totalAssets, equityLiabTotal: totalEquity + totalLiabilities }))}
              disabled={isSummarizing}
            >
              {isSummarizing ? <Loader2 className="size-4 animate-spin mr-2" /> : <TrendingUp className="size-4 mr-2" />}
              {isSummarizing ? "Running Audit..." : "Generate Audit Summary"}
            </Button>
          </CardHeader>
          {aiSummary && (
            <CardContent className="p-8">
              <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-ledger text-slate-200">
                {aiSummary}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
