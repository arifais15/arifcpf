
"use client"

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import { Sparkles, Save, Info, AlertTriangle, Loader2, Plus, Trash2, ArrowRightLeft, User } from "lucide-react";
import { classifyTransaction } from "@/ai/flows/transaction-classification-assistant";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Badge } from "@/components/ui/badge";
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, getDocs } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LEDGER_COLUMN_MAPPING, NORMAL_DEBIT_ACCOUNTS, type LedgerColumnKey } from "@/lib/ledger-mapping";

interface LineItem {
  id: string;
  accountCode: string;
  debit: number;
  credit: number;
  memo: string;
  memberId?: string;
}

export default function NewTransactionPage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();

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

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members } = useCollection(membersRef);

  const transactionRef = useMemoFirebase(() => editId ? doc(firestore, "journalEntries", editId) : null, [firestore, editId]);
  const { data: existingTransaction, isLoading: isEditLoading } = useDoc(transactionRef);

  const settingsRef = useMemoFirebase(() => doc(firestore, "settings", "ledger"), [firestore]);
  const { data: ledgerSettings } = useDoc(settingsRef);

  useEffect(() => {
    if (existingTransaction) {
      setEntryDate(existingTransaction.entryDate);
      setDescription(existingTransaction.description);
      setRefNo(existingTransaction.referenceNumber || "");
      if (existingTransaction.lines) {
        setLines(existingTransaction.lines.map((l: any) => ({
          id: Math.random().toString(),
          accountCode: l.accountCode,
          debit: l.debit || 0,
          credit: l.credit || 0,
          memo: l.memo || "",
          memberId: l.memberId || ""
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
          debit: 0,
          credit: 0,
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

  const getSubValues = (code: string, debit: number, credit: number) => {
    // 1. Get current mappings from settings or fallback to default
    const mapping = ledgerSettings?.mapping || {};
    const debits = ledgerSettings?.debitAccounts || NORMAL_DEBIT_ACCOUNTS;
    
    // Find which column this code belongs to
    // Setting store mapping as { columnKey: accountCode }
    const columnKey = Object.keys(mapping).find(key => mapping[key] === code) as LedgerColumnKey | undefined;
    
    // If not in firestore settings, try the hardcoded default mapping
    const finalColumnKey = columnKey || (Object.keys(LEDGER_COLUMN_MAPPING).find(key => key === code) ? LEDGER_COLUMN_MAPPING[code] : undefined);

    if (!finalColumnKey) return null;

    const isNormalDebit = debits.includes(code);
    const amount = isNormalDebit ? (debit - credit) : (credit - debit);

    return {
      employeeContribution: finalColumnKey === 'employeeContribution' ? amount : 0,
      loanWithdrawal: finalColumnKey === 'loanWithdrawal' ? amount : 0,
      loanRepayment: finalColumnKey === 'loanRepayment' ? amount : 0,
      profitEmployee: finalColumnKey === 'profitEmployee' ? amount : 0,
      profitLoan: finalColumnKey === 'profitLoan' ? amount : 0,
      pbsContribution: finalColumnKey === 'pbsContribution' ? amount : 0,
      profitPbs: finalColumnKey === 'profitPbs' ? amount : 0,
    };
  }

  const syncSubsidiaryLedgers = async (journalId: string, entryData: any) => {
    for (const line of entryData.lines) {
      if (line.memberId) {
        const subsidiaryCols = getSubValues(line.accountCode, line.debit, line.credit);
        if (!subsidiaryCols) continue;

        const summaryData = {
          summaryDate: entryData.entryDate,
          particulars: `${entryData.description} (JV: ${entryData.referenceNumber || 'N/A'})`,
          ...subsidiaryCols,
          lastUpdateDate: new Date().toISOString(),
          createdAt: entryData.createdAt || new Date().toISOString(),
          memberId: line.memberId,
          journalEntryId: journalId,
          isSyncedFromJV: true
        };

        const memberSummariesRef = collection(firestore, "members", line.memberId, "fundSummaries");
        
        if (editId) {
          const q = query(memberSummariesRef, where("journalEntryId", "==", editId), where("accountCodeAtSource", "==", line.accountCode));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            updateDocumentNonBlocking(doc(firestore, "members", line.memberId, "fundSummaries", snapshot.docs[0].id), {
              ...summaryData,
              accountCodeAtSource: line.accountCode
            });
            continue;
          }
        }
        
        addDocumentNonBlocking(memberSummariesRef, {
          ...summaryData,
          accountCodeAtSource: line.accountCode
        });
      }
    }
  };

  const handleSave = async () => {
    if (!isBalanced) {
      toast({ title: "Unbalanced Entry", description: "Total debits must equal total credits.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const createdAt = existingTransaction?.createdAt || new Date().toISOString();
    const entryData = {
      entryDate,
      description,
      referenceNumber: refNo,
      updatedAt: new Date().toISOString(),
      createdAt,
      lines: lines.map(l => ({
        accountCode: l.accountCode,
        accountName: activeCOA.find((a: any) => a.code === l.accountCode)?.name || "",
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        memo: l.memo,
        memberId: l.memberId || ""
      })),
      totalAmount: totals.debit
    };

    try {
      if (editId) {
        const docRef = doc(firestore, "journalEntries", editId);
        updateDocumentNonBlocking(docRef, entryData);
        await syncSubsidiaryLedgers(editId, entryData);
        showAlert({ title: "Updated", description: "Journal and subsidiary ledgers synchronized.", type: "success" });
      } else {
        const journalEntriesRef = collection(firestore, "journalEntries");
        const newDoc = await addDocumentNonBlocking(journalEntriesRef, entryData);
        if (newDoc) {
          await syncSubsidiaryLedgers(newDoc.id, entryData);
        }
        showAlert({ title: "Posted", description: "Transaction synchronized with subsidiary ledgers.", type: "success" });
      }
      router.push("/transactions");
    } catch (err) {
      toast({ title: "Save Failed", description: "An error occurred while synchronizing records.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!editId) return;
    showAlert({
      title: "Delete Transaction?",
      description: "This will also remove linked records from member subsidiary ledgers.",
      type: "warning",
      showCancel: true,
      confirmText: "Yes, Delete",
      onConfirm: async () => {
        for (const line of existingTransaction.lines || []) {
          if (line.memberId) {
            const memberSummariesRef = collection(firestore, "members", line.memberId, "fundSummaries");
            const q = query(memberSummariesRef, where("journalEntryId", "==", editId));
            const snapshot = await getDocs(q);
            snapshot.forEach(d => deleteDocumentNonBlocking(d.ref));
          }
        }

        const docRef = doc(firestore, "journalEntries", editId);
        deleteDocumentNonBlocking(docRef);
        showAlert({ title: "Deleted", description: "All synchronized records removed.", type: "success" });
        router.push("/transactions");
      }
    });
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
        <p className="text-muted-foreground">General Ledger synchronization with Member Subsidiary Ledgers</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-9 border-none shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Accounting Journal</CardTitle>
                <CardDescription>Lines tagged with a Member will auto-post to their subsidiary ledger.</CardDescription>
              </div>
              <Button 
                type="button" 
                size="sm" 
                variant="outline"
                className="gap-2 border-primary/20 text-primary"
                onClick={handleAIClassify}
                disabled={isClassifying}
              >
                {isClassifying ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-accent" />}
                {isClassifying ? "Analyzing..." : "AI Assistant"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-6 grid grid-cols-3 gap-6 border-b">
              <div className="space-y-2">
                <Label>Posting Date</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Voucher / Reference No.</Label>
                <Input placeholder="V-2024-001" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>General Description</Label>
                <Input placeholder="Purpose of transaction..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-3 text-left font-semibold w-[250px]">Account (COA)</th>
                    <th className="p-3 text-left font-semibold w-[200px]">Member (Subsidiary)</th>
                    <th className="p-3 text-right font-semibold w-[120px]">Debit (৳)</th>
                    <th className="p-3 text-right font-semibold w-[120px]">Credit (৳)</th>
                    <th className="p-3 text-left font-semibold">Memo</th>
                    <th className="p-3 text-center w-[40px]"></th>
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
                              <SelectItem key={a.code} value={a.code}>{a.code} - {a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <div className="relative">
                          <User className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-slate-300" />
                          <Select value={line.memberId || "none"} onValueChange={(val) => updateLine(line.id, { memberId: val === "none" ? "" : val })}>
                            <SelectTrigger className="h-9 pl-7 border-none focus:ring-0 shadow-none hover:bg-slate-50 text-[11px]">
                              <SelectValue placeholder="General Ledger Only" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="none">No Member (General Ledger)</SelectItem>
                              {members?.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.memberIdNumber} - {m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="p-2">
                        <Input type="number" className="h-9 text-right border-none focus-visible:ring-1" value={line.debit || ''} onChange={(e) => updateLine(line.id, { debit: Number(e.target.value), credit: 0 })} />
                      </td>
                      <td className="p-2">
                        <Input type="number" className="h-9 text-right border-none focus-visible:ring-1" value={line.credit || ''} onChange={(e) => updateLine(line.id, { credit: Number(e.target.value), debit: 0 })} />
                      </td>
                      <td className="p-2">
                        <Input className="h-9 border-none focus-visible:ring-1 text-xs" placeholder="..." value={line.memo} onChange={(e) => updateLine(line.id, { memo: e.target.value })} />
                      </td>
                      <td className="p-2 text-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveLine(line.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/50 font-bold border-t">
                  <tr>
                    <td colSpan={2} className="p-3 text-right">Journal Totals:</td>
                    <td className="p-3 text-right text-primary">{totals.debit.toFixed(2)}</td>
                    <td className="p-3 text-right text-primary">{totals.credit.toFixed(2)}</td>
                    <td colSpan={2} className="p-3">
                      {isBalanced ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Balanced</Badge>
                      ) : (
                        (totals.debit > 0 || totals.credit > 0) && <Badge variant="destructive" className="animate-pulse">Out of Balance</Badge>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="p-4 bg-slate-50/30 flex justify-between items-center border-t">
              <Button variant="outline" size="sm" onClick={handleAddLine} className="gap-2">
                <Plus className="size-3.5" /> Add Voucher Row
              </Button>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
                <Button className="gap-2 px-8" onClick={handleSave} disabled={isSaving || !isBalanced}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {editId ? "Update & Sync" : "Post & Synchronize"}
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
                <p className="text-xs leading-relaxed">Describe the transaction and use the <b>AI Assistant</b> for automated account suggestions.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-right duration-500">
                <div className="p-4 bg-white rounded-lg border border-accent/20 shadow-sm">
                  <p className="text-xs font-bold text-accent uppercase mb-3">AI Recommendation</p>
                  <div className="space-y-3">
                    {aiSuggestion.suggestedEntries.map((entry: any, i: number) => (
                      <div key={i} className="flex justify-between items-start text-[11px] pb-2 border-b last:border-0">
                        <div>
                          <p className="font-bold text-slate-800">{entry.accountName}</p>
                          <p className="font-mono text-slate-400">{entry.accountCode}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[9px] px-1 h-4", entry.type === 'Debit' ? "text-blue-600 border-blue-200" : "text-orange-600 border-orange-200")}>{entry.type}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
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
