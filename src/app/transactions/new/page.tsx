
"use client"

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import { Sparkles, Save, Info, AlertTriangle, Loader2, Plus, Trash2, ArrowRightLeft } from "lucide-react";
import { classifyTransaction } from "@/ai/flows/transaction-classification-assistant";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface LineItem {
  id: string;
  accountCode: string;
  debit: number;
  credit: number;
  memo: string;
}

export default function NewTransactionPage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [description, setDescription] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState("");
  
  const [lines, setLines] = useState<LineItem[]>([
    { id: '1', accountCode: '', debit: 0, credit: 0, memo: '' },
    { id: '2', accountCode: '', debit: 0, credit: 0, memo: '' }
  ]);

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData } = useCollection(coaRef);
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData]);

  // Load transaction for editing
  const transactionRef = useMemoFirebase(() => editId ? doc(firestore, "journalEntries", editId) : null, [firestore, editId]);
  const { data: existingTransaction, isLoading: isEditLoading } = useDoc(transactionRef);

  useEffect(() => {
    if (existingTransaction) {
      setEntryDate(existingTransaction.entryDate);
      setDescription(existingTransaction.description);
      setRefNo(existingTransaction.referenceNumber || "");
      if (existingTransaction.lines) {
        setLines(existingTransaction.lines.map((l: any, idx: number) => ({
          id: Math.random().toString(),
          accountCode: l.accountCode,
          debit: l.debit || 0,
          credit: l.credit || 0,
          memo: l.memo || ""
        })));
      }
    }
  }, [existingTransaction]);

  const totals = useMemo(() => {
    return lines.reduce((acc, curr) => ({
      debit: acc.debit + (Number(curr.debit) || 0),
      credit: acc.credit + (Number(curr.credit) || 0)
    }), { debit: 0, credit: 0 });
  }, [lines]);

  const isBalanced = totals.debit > 0 && Math.abs(totals.debit - totals.credit) < 0.01;

  const handleAddLine = () => {
    setLines([...lines, { id: Math.random().toString(), accountCode: '', debit: 0, credit: 0, memo: description }]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines(lines.filter(l => l.id !== id));
  };

  const updateLine = (id: string, updates: Partial<LineItem>) => {
    setLines(lines.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const handleAIClassify = async () => {
    if (!description) {
      toast({ title: "Required", description: "Please enter a description first.", variant: "destructive" });
      return;
    }

    setIsClassifying(true);
    try {
      const result = await classifyTransaction({ transactionDescription: description });
      setAiSuggestion(result);
      
      if (result.suggestedEntries && result.suggestedEntries.length > 0) {
        const newLines = result.suggestedEntries.map((item: any) => ({
          id: Math.random().toString(),
          accountCode: item.accountCode,
          debit: item.type === 'Debit' ? 0 : 0,
          credit: item.type === 'Credit' ? 0 : 0,
          memo: description
        }));
        setLines(newLines);
        toast({ title: "AI Suggested", description: "Ledger lines updated based on description." });
      }
    } catch (err) {
      toast({ title: "AI Error", description: "Could not classify transaction.", variant: "destructive" });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSave = () => {
    if (!isBalanced) {
      toast({ title: "Unbalanced Entry", description: "Total debits must equal total credits.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const entryData = {
      entryDate,
      description,
      referenceNumber: refNo,
      updatedAt: new Date().toISOString(),
      lines: lines.map(l => ({
        accountCode: l.accountCode,
        accountName: activeCOA.find((a: any) => a.code === l.accountCode)?.name || "",
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        memo: l.memo
      })),
      totalAmount: totals.debit
    };

    if (editId) {
      const docRef = doc(firestore, "journalEntries", editId);
      updateDocumentNonBlocking(docRef, entryData);
      toast({ title: "Success", description: "Transaction updated." });
      router.push("/transactions");
    } else {
      const journalEntriesRef = collection(firestore, "journalEntries");
      addDocumentNonBlocking(journalEntriesRef, { ...entryData, createdAt: new Date().toISOString() })
        .then(() => {
          toast({ title: "Success", description: "Double-entry transaction recorded." });
          router.push("/transactions");
        });
    }
  };

  const handleDeleteTransaction = () => {
    if (!editId) return;
    if (confirm("Are you sure you want to delete this entire journal entry? This action cannot be undone.")) {
      const docRef = doc(firestore, "journalEntries", editId);
      deleteDocumentNonBlocking(docRef);
      toast({ title: "Deleted", description: "Journal entry removed." });
      router.push("/transactions");
    }
  };

  if (isEditLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary tracking-tight">
            {editId ? "Edit Transaction" : "New Journal Entry"}
          </h1>
          {editId && (
            <Button variant="destructive" size="sm" onClick={handleDeleteTransaction} className="gap-2">
              <Trash2 className="size-4" /> Delete Transaction
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">Dual accounting system for PBS CPF transactions</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-9 border-none shadow-sm">
          <CardHeader className="border-b bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Accounting Journal</CardTitle>
                <CardDescription>Enter multi-line accounting transactions.</CardDescription>
              </div>
              <div className="flex gap-2">
                 <Button 
                  type="button" 
                  size="sm" 
                  variant="outline"
                  className="gap-2 border-primary/20 text-primary"
                  onClick={handleAIClassify}
                  disabled={isClassifying}
                >
                  {isClassifying ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-accent" />}
                  {isClassifying ? "Thinking..." : "AI Assistant"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-6 grid grid-cols-3 gap-6 border-b">
              <div className="space-y-2">
                <Label htmlFor="date">Posting Date</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference / Voucher No.</Label>
                <Input placeholder="V-2023-001" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">General Description</Label>
                <Input placeholder="Transaction purpose..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-3 text-left font-semibold w-[300px]">Account (COA)</th>
                    <th className="p-3 text-right font-semibold w-[150px]">Debit (৳)</th>
                    <th className="p-3 text-right font-semibold w-[150px]">Credit (৳)</th>
                    <th className="p-3 text-left font-semibold">Line Memo</th>
                    <th className="p-3 text-center w-[50px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line) => (
                    <tr key={line.id} className="group">
                      <td className="p-2">
                        <Select value={line.accountCode} onValueChange={(val) => updateLine(line.id, { accountCode: val })}>
                          <SelectTrigger className="h-9 border-none focus:ring-0 shadow-none hover:bg-slate-50">
                            <SelectValue placeholder="Select account..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {activeCOA.filter((a: any) => !a.isHeader).map((a: any) => (
                              <SelectItem key={a.code} value={a.code}>
                                {a.code} - {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input 
                          type="number" 
                          className="h-9 text-right border-none focus-visible:ring-1" 
                          value={line.debit || ''} 
                          onChange={(e) => updateLine(line.id, { debit: Number(e.target.value), credit: 0 })}
                        />
                      </td>
                      <td className="p-2">
                        <Input 
                          type="number" 
                          className="h-9 text-right border-none focus-visible:ring-1" 
                          value={line.credit || ''} 
                          onChange={(e) => updateLine(line.id, { credit: Number(e.target.value), debit: 0 })}
                        />
                      </td>
                      <td className="p-2">
                        <Input 
                          className="h-9 border-none focus-visible:ring-1" 
                          placeholder="Line details..." 
                          value={line.memo}
                          onChange={(e) => updateLine(line.id, { memo: e.target.value })}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemoveLine(line.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/50 font-bold border-t">
                  <tr>
                    <td className="p-3 text-right">Totals:</td>
                    <td className="p-3 text-right text-primary">{totals.debit.toFixed(2)}</td>
                    <td className="p-3 text-right text-primary">{totals.credit.toFixed(2)}</td>
                    <td colSpan={2} className="p-3">
                      {!isBalanced && (totals.debit > 0 || totals.credit > 0) && (
                        <Badge variant="destructive" className="ml-2 animate-pulse">Out of Balance</Badge>
                      )}
                      {isBalanced && (
                        <Badge variant="outline" className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-200">Balanced</Badge>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="p-4 bg-slate-50/30 flex justify-between items-center border-t">
              <Button variant="outline" size="sm" onClick={handleAddLine} className="gap-2">
                <Plus className="size-3.5" /> Add Row
              </Button>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
                <Button className="gap-2" onClick={handleSave} disabled={isSaving || !isBalanced}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {editId ? "Update Transaction" : "Post Transaction"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-none shadow-sm bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent text-lg">
              <ArrowRightLeft className="size-5" />
              Accounting Audit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!aiSuggestion ? (
              <div className="text-center py-12 px-4 text-muted-foreground border-2 border-dashed rounded-xl">
                <Info className="size-8 mx-auto mb-3 opacity-20" />
                <p className="text-xs leading-relaxed">Briefly describe the transaction and use the <b>AI Assistant</b> for suggested ledger lines.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-right duration-500">
                <div className="p-4 bg-white rounded-lg border border-accent/20 shadow-sm">
                  <p className="text-xs font-bold text-accent uppercase mb-3">Suggested Entries</p>
                  <div className="space-y-3">
                    {aiSuggestion.suggestedEntries.map((entry: any, i: number) => (
                      <div key={i} className="flex justify-between items-start text-[11px] pb-2 border-b last:border-0">
                        <div>
                          <p className="font-bold text-slate-800">{entry.accountName}</p>
                          <p className="font-mono text-slate-400">{entry.accountCode}</p>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[9px] px-1 h-4",
                          entry.type === 'Debit' ? "text-blue-600 border-blue-200" : "text-orange-600 border-orange-200"
                        )}>{entry.type}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {aiSuggestion.potentialErrors && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                    <div className="flex items-center gap-2 text-rose-700 font-semibold text-[11px] mb-1">
                      <AlertTriangle className="size-3.5" />
                      Validation Alert
                    </div>
                    <p className="text-[10px] text-rose-600 leading-tight">{aiSuggestion.errorDescription}</p>
                  </div>
                )}

                <div className="p-3 bg-slate-100/50 rounded-lg border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Rationale</p>
                  <p className="text-[11px] leading-relaxed text-slate-600 italic">"{aiSuggestion.rationale}"</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
