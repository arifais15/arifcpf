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
  const [entryDate, setEntryDate] = useState("");
  const [refNo, setRefNo] = useState("");
  
  const [lines, setLines] = useState<LineItem[]>([
    { id: '1', accountCode: '', debit: 0, credit: 0, memo: '' },
    { id: '2', accountCode: '', debit: 0, credit: 0, memo: '' }
  ]);

  // Defer date initialization to avoid hydration errors
  useEffect(() => {
    if (!editId) {
      setEntryDate(new Date().toISOString().split('T')[0]);
    }
  }, [editId]);

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
    const mapping = ledgerSettings?.mapping || {};
    const debits = ledgerSettings?.debitAccounts || NORMAL_DEBIT_ACCOUNTS;
    const columnKey = Object.keys(mapping).find(key => mapping[key] === code) as LedgerColumnKey | undefined;
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

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
  };

  if (isEditLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black text-black tracking-tight uppercase">
            {editId ? "Edit Journal Entry" : "New Journal Entry"}
          </h1>
          {editId && (
            <Button variant="destructive" size="sm" onClick={handleDeleteTransaction} className="gap-2 font-black uppercase text-xs">
              <Trash2 className="size-4" /> Delete Entry
            </Button>
          )}
        </div>
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">General Ledger Synchronization Terminal</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-9 border-2 border-black shadow-lg overflow-hidden rounded-none">
          <CardHeader className="border-b-2 border-black bg-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">Institutional Bookkeeping</CardTitle>
                <CardDescription className="font-black text-slate-500 text-[10px] uppercase">Tagging a Member ensures auto-posting to Subsidiary Ledger (Form 224)</CardDescription>
              </div>
              <Button 
                type="button" 
                size="sm" 
                variant="outline"
                className="gap-2 border-2 border-black text-black font-black uppercase text-[10px] hover:bg-black hover:text-white"
                onClick={handleAIClassify}
                disabled={isClassifying}
              >
                {isClassifying ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-amber-500" />}
                {isClassifying ? "Analysing Trxn..." : "AI Account Suggest"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-6 grid grid-cols-3 gap-6 border-b-2 border-black bg-slate-50/50">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-black ml-1">Posting Date</Label>
                <Input type="date" value={entryDate} max="9999-12-31" onChange={(e) => setEntryDate(e.target.value)} className="h-11 border-2 border-black font-black uppercase text-xs focus:ring-0" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-black ml-1">Voucher / Ref No.</Label>
                <Input placeholder="V-2024-XXX" value={refNo} onChange={(e) => setRefNo(e.target.value)} className="h-11 border-2 border-black font-black uppercase text-xs focus:ring-0" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-black ml-1">General Particulars</Label>
                <Input placeholder="Description of fund activity..." value={description} onChange={(e) => setDescription(e.target.value)} className="h-11 border-2 border-black font-black text-xs focus:ring-0" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm font-black tabular-nums">
                <thead className="bg-slate-100 border-b-2 border-black">
                  <tr>
                    <th className="p-4 text-left font-black uppercase text-[10px] tracking-widest w-[250px] border-r-2 border-black">GL Account (COA)</th>
                    <th className="p-4 text-left font-black uppercase text-[10px] tracking-widest w-[200px] border-r-2 border-black">Member (Sub-Ledger)</th>
                    <th className="p-4 text-right font-black uppercase text-[10px] tracking-widest w-[130px] border-r-2 border-black">Debit (৳)</th>
                    <th className="p-4 text-right font-black uppercase text-[10px] tracking-widest w-[130px] border-r-2 border-black">Credit (৳)</th>
                    <th className="p-4 text-left font-black uppercase text-[10px] tracking-widest">Memo</th>
                    <th className="p-4 text-center w-[50px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black">
                  {lines.map((line) => (
                    <tr key={line.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-r-2 border-black">
                        <Select value={line.accountCode} onValueChange={(val) => updateLine(line.id, { accountCode: val })}>
                          <SelectTrigger className="h-10 border-none font-black text-xs focus:ring-0 shadow-none">
                            <SelectValue placeholder="Account..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {activeCOA.filter((a: any) => !a.isHeader).map((a: any) => (
                              <SelectItem key={a.code} value={a.code} className="font-black text-xs">{a.code} - {a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 border-r-2 border-black">
                        <div className="relative">
                          <User className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-black opacity-30" />
                          <Select value={line.memberId || "none"} onValueChange={(val) => updateLine(line.id, { memberId: val === "none" ? "" : val })}>
                            <SelectTrigger className="h-10 pl-8 border-none font-black text-[10px] focus:ring-0 shadow-none uppercase">
                              <SelectValue placeholder="NO MEMBER" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="none" className="font-black text-[10px]">NO MEMBER (GL ONLY)</SelectItem>
                              {members?.map(m => (
                                <SelectItem key={m.id} value={m.id} className="font-black text-[10px]">{m.memberIdNumber} - {m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="p-2 border-r-2 border-black">
                        <Input type="number" className="h-10 text-right border-none font-black text-sm focus-visible:ring-0 tabular-nums" value={line.debit || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => updateLine(line.id, { debit: Number(e.target.value), credit: 0 })} />
                      </td>
                      <td className="p-2 border-r-2 border-black">
                        <Input type="number" className="h-10 text-right border-none font-black text-sm focus-visible:ring-0 tabular-nums" value={line.credit || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => updateLine(line.id, { credit: Number(e.target.value), debit: 0 })} />
                      </td>
                      <td className="p-2">
                        <Input className="h-10 border-none font-black text-xs focus-visible:ring-0" placeholder="..." value={line.memo} onChange={(e) => updateLine(line.id, { memo: e.target.value })} />
                      </td>
                      <td className="p-2 text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-rose-100 hover:text-rose-600 transition-colors" onClick={() => handleRemoveLine(line.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-black border-t-4 border-black">
                  <tr className="h-16">
                    <td colSpan={2} className="p-4 text-right uppercase tracking-[0.2em] text-xs">Voucher Consolidated Totals:</td>
                    <td className="p-4 text-right text-lg border-l-2 border-black">৳ {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-right text-lg border-l-2 border-black">৳ {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td colSpan={2} className="p-4 text-center border-l-2 border-black">
                      {isBalanced ? (
                        <Badge className="bg-black text-white font-black uppercase text-[9px] px-4 py-1 tracking-widest border-2 border-black">Balanced Ledger</Badge>
                      ) : (
                        (totals.debit > 0 || totals.credit > 0) && <Badge variant="destructive" className="animate-pulse font-black uppercase text-[9px] px-4 py-1 tracking-widest">Unbalanced</Badge>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="p-6 bg-slate-50 border-t-4 border-black flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={handleAddLine} className="gap-2 border-2 border-black font-black uppercase text-[10px] h-10 px-6 hover:bg-slate-100">
                <Plus className="size-4" /> Add Voucher Line
              </Button>
              <div className="flex gap-4">
                <Button variant="ghost" className="font-black uppercase text-xs tracking-widest h-12 px-8 hover:bg-slate-200" onClick={() => router.back()}>Exit Voucher</Button>
                <Button className="gap-3 px-12 h-12 bg-black text-white font-black uppercase text-xs tracking-[0.3em] shadow-2xl hover:bg-black/90" onClick={handleSave} disabled={isSaving || !isBalanced}>
                  {isSaving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
                  {editId ? "Update & Sync" : "Commit & Post"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-2 border-black shadow-lg bg-black text-white rounded-none">
          <CardHeader className="border-b border-white/20 pb-4">
            <CardTitle className="flex items-center gap-3 text-white text-base uppercase tracking-widest">
              <ArrowRightLeft className="size-5 text-amber-400" />
              Accounting Audit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {!aiSuggestion ? (
              <div className="text-center py-16 px-6 border-2 border-dashed border-white/20 rounded-none bg-white/5">
                <Info className="size-10 mx-auto mb-4 opacity-20 text-white" />
                <p className="text-[10px] leading-relaxed uppercase font-black tracking-widest text-slate-400">Provide description and engage <b>AI Assistant</b> for specialized trust account mapping.</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right duration-500">
                <div className="p-5 bg-white text-black border-2 border-amber-400 shadow-[4px_4px_0px_0px_rgba(251,191,36,1)]">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-4 border-b border-amber-100 pb-2">AI Expert Verification</p>
                  <div className="space-y-4">
                    {aiSuggestion.suggestedEntries.map((entry: any, i: number) => (
                      <div key={i} className="flex justify-between items-start text-[11px] pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                        <div>
                          <p className="font-black text-black uppercase leading-tight">{entry.accountName}</p>
                          <p className="font-mono text-slate-400 mt-1">{entry.accountCode}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[8px] font-black uppercase px-1.5 h-5 rounded-none border-2", entry.type === 'Debit' ? "text-blue-600 border-blue-600" : "text-amber-600 border-amber-600")}>{entry.type}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5 bg-white/10 border-l-4 border-amber-400">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Audit Rationale</p>
                  <p className="text-[11px] leading-relaxed text-slate-200 font-black italic">"{aiSuggestion.rationale}"</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
