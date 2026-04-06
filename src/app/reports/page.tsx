
"use client"

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART_OF_ACCOUNTS, COAEntry } from "@/lib/coa-data";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { Loader2, FileText, Printer, Download, TrendingUp, Wallet, ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarizeFinancialReport } from "@/ai/flows/financial-report-summarizer";
import { useToast } from "@/hooks/use-toast";

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
      
      // Get account metadata
      const account = CHART_OF_ACCOUNTS.find(a => a.code === code);
      if (!account) return;

      if (!map[code]) map[code] = 0;
      
      // For simplicity in this prototype:
      // In a real system, we'd check if it's a debit or credit transaction.
      // Here we assume "Amount" is the absolute movement.
      // We add if it's a standard balance increase.
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

  const ReportHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="text-center mb-8 border-b pb-6">
      <h1 className="text-2xl font-bold uppercase tracking-widest text-primary">Gazipur Palli Bidyut Samity-2</h1>
      <h2 className="text-lg font-semibold text-slate-700">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2
    }).format(val).replace('BDT', '৳');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin size-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex items-center justify-between no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground">Audited financial statements generated from Chart of Accounts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4 mr-2" />
            Print All
          </Button>
          <Button variant="outline" size="sm">
            <Download className="size-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="position" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 no-print">
          <TabsTrigger value="position" className="gap-2"><Wallet className="size-4" /> Financial Position</TabsTrigger>
          <TabsTrigger value="income" className="gap-2"><TrendingUp className="size-4" /> Income Statement</TabsTrigger>
          <TabsTrigger value="receipts" className="gap-2"><ArrowDownUp className="size-4" /> Receipt & Payment</TabsTrigger>
        </TabsList>

        {/* --- FINANCIAL POSITION (BALANCE SHEET) --- */}
        <TabsContent value="position">
          <Card className="border-none shadow-lg print:shadow-none">
            <CardContent className="p-12">
              <ReportHeader title="Statement of Financial Position" subtitle="As of October 31, 2023" />
              
              <div className="grid grid-cols-2 gap-12">
                {/* Assets */}
                <div className="space-y-6">
                  <h3 className="font-bold border-b pb-2 uppercase text-sm">Property and Assets</h3>
                  <div className="space-y-4">
                    {CHART_OF_ACCOUNTS.filter(a => a.type === 'Asset' || a.type === 'Contra-Asset').map(acc => {
                      const bal = balances[acc.code] || 0;
                      if (bal === 0 && !acc.isHeader) return null;
                      return (
                        <div key={acc.code} className={`flex justify-between text-sm ${acc.isHeader ? 'font-bold mt-4' : 'pl-4'}`}>
                          <span>{acc.name}</span>
                          {!acc.isHeader && <span>{formatCurrency(bal)}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="space-y-6">
                  <h3 className="font-bold border-b pb-2 uppercase text-sm">Fund and Liabilities</h3>
                  <div className="space-y-4">
                    {CHART_OF_ACCOUNTS.filter(a => a.type === 'Liability' || a.type === 'Equity').map(acc => {
                      const bal = balances[acc.code] || 0;
                      if (bal === 0 && !acc.isHeader) return null;
                      return (
                        <div key={acc.code} className={`flex justify-between text-sm ${acc.isHeader ? 'font-bold mt-4' : 'pl-4'}`}>
                          <span>{acc.name}</span>
                          {!acc.isHeader && <span>{formatCurrency(bal)}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-24 grid grid-cols-3 gap-8 text-center text-xs font-bold uppercase border-t pt-8">
                <div className="border-t border-black pt-2">Accountant</div>
                <div className="border-t border-black pt-2">AGM (Finance)</div>
                <div className="border-t border-black pt-2">General Manager</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- INCOME STATEMENT --- */}
        <TabsContent value="income">
          <Card className="border-none shadow-lg print:shadow-none">
            <CardContent className="p-12">
              <ReportHeader title="Statement of Comprehensive Income" subtitle="For the Period Ended October 31, 2023" />
              
              <div className="space-y-8 max-w-3xl mx-auto">
                <section>
                  <h3 className="font-bold border-b pb-2 uppercase text-sm mb-4">Operating Income</h3>
                  {CHART_OF_ACCOUNTS.filter(a => a.type === 'Income').map(acc => (
                    <div key={acc.code} className="flex justify-between text-sm py-1 border-b border-dotted pl-4">
                      <span>{acc.name}</span>
                      <span>{formatCurrency(balances[acc.code] || 0)}</span>
                    </div>
                  ))}
                </section>

                <section>
                  <h3 className="font-bold border-b pb-2 uppercase text-sm mb-4">Operating Expenses</h3>
                  {CHART_OF_ACCOUNTS.filter(a => a.type === 'Expense').map(acc => (
                    <div key={acc.code} className="flex justify-between text-sm py-1 border-b border-dotted pl-4">
                      <span>{acc.name}</span>
                      <span>{formatCurrency(balances[acc.code] || 0)}</span>
                    </div>
                  ))}
                </section>

                <div className="flex justify-between font-bold text-lg bg-slate-50 p-4 rounded-lg">
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
          <Card className="border-none shadow-lg print:shadow-none">
            <CardContent className="p-12">
              <ReportHeader title="Statement of Receipts and Payments" subtitle="For the Period Ended October 31, 2023" />
              
              <div className="grid grid-cols-2 gap-px bg-black border border-black">
                <div className="bg-white p-6">
                  <h3 className="font-bold text-center border-b pb-2 mb-4 uppercase text-sm">Receipts</h3>
                  <div className="space-y-2">
                    {/* For MVP, we show any entries that were income or asset liquidation as receipts */}
                    {Object.keys(balances).filter(code => {
                      const type = CHART_OF_ACCOUNTS.find(a => a.code === code)?.type;
                      return type === 'Income' || code.startsWith('105.2'); // Loan recovery
                    }).map(code => (
                      <div key={code} className="flex justify-between text-xs py-1 border-b border-dotted">
                        <span>{CHART_OF_ACCOUNTS.find(a => a.code === code)?.name}</span>
                        <span>{formatCurrency(balances[code])}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-6">
                  <h3 className="font-bold text-center border-b pb-2 mb-4 uppercase text-sm">Payments</h3>
                  <div className="space-y-2">
                     {/* For MVP, we show any entries that were expense or asset investment as payments */}
                     {Object.keys(balances).filter(code => {
                      const type = CHART_OF_ACCOUNTS.find(a => a.code === code)?.type;
                      return type === 'Expense' || code.startsWith('105.1'); // Loan disbursement
                    }).map(code => (
                      <div key={code} className="flex justify-between text-xs py-1 border-b border-dotted">
                        <span>{CHART_OF_ACCOUNTS.find(a => a.code === code)?.name}</span>
                        <span>{formatCurrency(balances[code])}</span>
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
      <div className="no-print mt-8">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                AI Auditor's Summary
              </CardTitle>
              <CardDescription>Generate an automated analysis of these financial statements.</CardDescription>
            </div>
            <Button 
              size="sm" 
              onClick={() => handleAISummarize("Financial Report Package", JSON.stringify(balances))}
              disabled={isSummarizing}
            >
              {isSummarizing ? <Loader2 className="size-4 animate-spin mr-2" /> : <TrendingUp className="size-4 mr-2" />}
              {isSummarizing ? "Analyzing..." : "Analyze Performance"}
            </Button>
          </CardHeader>
          {aiSummary && (
            <CardContent>
              <div className="p-4 bg-white rounded-lg border text-sm leading-relaxed whitespace-pre-wrap">
                {aiSummary}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
