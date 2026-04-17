"use client"

import { useState, useMemo, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import { Sparkles, Save, Info, Loader2, Plus, Trash2, ArrowRightLeft, User } from "lucide-react";
import { classifyTransaction } from "@/ai/flows/transaction-classification-assistant";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Badge } from "@/components/ui/badge";
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, getDocs } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LEDGER_COLUMN_MAPPING, NORMAL_DEBIT_ACCOUNTS, type LedgerColumnKey } from "@/lib/ledger-mapping";

interface LineItem { id: string; accountCode: string; debit: number; credit: number; memo: string; memberId?: string; }

function TransactionForm() {
  const searchParams = useSearchParams(); const editId = searchParams.get("edit");
  const firestore = useFirestore(); const router = useRouter(); const { toast } = useToast(); const { showAlert } = useSweetAlert();
  const [description, setDescription] = useState(""); const [isClassifying, setIsClassifying] = useState(false); const [isSaving, setIsSaving] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null); const [entryDate, setEntryDate] = useState(""); const [refNo, setRefNo] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ id: '1', accountCode: '', debit: 0, credit: 0, memo: '' }, { id: '2', accountCode: '', debit: 0, credit: 0, memo: '' }]);

  useEffect(() => { if (!editId) setEntryDate(new Date().toISOString().split('T')[0]); }, [editId]);
  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData } = useCollection(coaRef);
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData]);
  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members } = useCollection(membersRef);
  const transactionRef = useMemoFirebase(() => editId ? doc(firestore, "journalEntries", editId) : null, [firestore, editId]);
  const { data: existingTransaction, isLoading: isEditLoading } = useDoc(transactionRef);

  useEffect(() => { if (existingTransaction) { setEntryDate(existingTransaction.entryDate); setDescription(existingTransaction.description); setRefNo(existingTransaction.referenceNumber || ""); if (existingTransaction.lines) setLines(existingTransaction.lines.map((l: any) => ({ id: Math.random().toString(), accountCode: l.accountCode, debit: l.debit || 0, credit: l.credit || 0, memo: l.memo || "", memberId: l.memberId || "" }))); } }, [existingTransaction]);
  const totals = useMemo(() => lines.reduce((acc, curr) => ({ debit: acc.debit + (Number(curr.debit) || 0), credit: acc.credit + (Number(curr.credit) || 0) }), { debit: 0, credit: 0 }), [lines]);
  const isBalanced = totals.debit > 0 && Math.abs(totals.debit - totals.credit) < 0.01;
  const updateLine = (id: string, updates: Partial<LineItem>) => setLines(lines.map(l => l.id === id ? { ...l, ...updates } : l));

  const handleAIClassify = async () => {
    if (!description) return; setIsClassifying(true);
    try {
      const res = await classifyTransaction({ transactionDescription: description }); setAiSuggestion(res);
      if (res.suggestedEntries?.length > 0) setLines(res.suggestedEntries.map((item: any) => ({ id: Math.random().toString(), accountCode: item.accountCode, debit: 0, credit: 0, memo: description })));
    } catch (err) { toast({ title: "AI Error", variant: "destructive" }); } finally { setIsClassifying(false); }
  };

  const handleSave = async () => {
    if (!isBalanced) return; setIsSaving(true);
    const entryData = { entryDate, description, referenceNumber: refNo, updatedAt: new Date().toISOString(), createdAt: existingTransaction?.createdAt || new Date().toISOString(), lines: lines.map(l => ({ accountCode: l.accountCode, accountName: activeCOA.find((a: any) => a.code === l.accountCode)?.name || "", debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.memo, memberId: l.memberId || "" })), totalAmount: totals.debit };
    try {
      if (editId) await updateDocumentNonBlocking(doc(firestore, "journalEntries", editId), entryData);
      else await addDocumentNonBlocking(collection(firestore, "journalEntries"), entryData);
      showAlert({ title: "Posted", type: "success" }); router.push("/transactions");
    } catch (err) { toast({ title: "Save Failed", variant: "destructive" }); } finally { setIsSaving(false); }
  };

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); };
  if (isEditLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <h1 className="text-4xl font-black uppercase tracking-tight">{editId ? "Modify Voucher" : "New Journal Entry"}</h1>
      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-9 border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] rounded-none">
          <CardHeader className="bg-slate-100 border-b-4 border-black">
            <div className="flex items-center justify-between">
              <div><CardTitle className="text-2xl font-black uppercase">Voucher terminal</CardTitle><CardDescription className="text-xs font-black uppercase opacity-60">General Ledger & Subsidiary Sync</CardDescription></div>
              <Button onClick={handleAIClassify} disabled={isClassifying} variant="outline" className="border-4 border-black font-black uppercase h-11"><Sparkles className="size-4 mr-2" /> AI Suggest</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-8 grid grid-cols-3 gap-8 bg-slate-50 border-b-4 border-black">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Posting Date</Label><Input type="date" value={entryDate} max="9999-12-31" onChange={(e) => setEntryDate(e.target.value)} className="h-12 border-4 border-black font-black text-lg focus:ring-0 uppercase" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Ref/Voucher No</Label><Input value={refNo} onChange={(e) => setRefNo(e.target.value)} className="h-12 border-4 border-black font-black text-lg" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Particulars</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-12 border-4 border-black font-black text-lg" /></div>
            </div>
            <table className="w-full font-black tabular-nums">
              <thead className="bg-slate-100 border-b-2 border-black uppercase text-[10px]">
                <tr><th className="p-4 text-left border-r-2 border-black">GL Account</th><th className="p-4 text-left border-r-2 border-black">Member (Sub-Ledger)</th><th className="p-4 text-right border-r-2 border-black">Debit</th><th className="p-4 text-right border-r-2 border-black">Credit</th><th className="p-4 text-center"></th></tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="p-2 border-r-2 border-black"><Select value={l.accountCode} onValueChange={(v) => updateLine(l.id, { accountCode: v })}><SelectTrigger className="border-none font-black text-sm uppercase"><SelectValue /></SelectTrigger><SelectContent className="max-h-[300px]">{activeCOA.filter(a => !a.isHeader).map(a => <SelectItem key={a.code} value={a.code} className="font-black">{a.code} - {a.name}</SelectItem>)}</SelectContent></Select></td>
                    <td className="p-2 border-r-2 border-black"><Select value={l.memberId || "none"} onValueChange={(v) => updateLine(l.id, { memberId: v === "none" ? "" : v })}><SelectTrigger className="border-none font-black text-[10px] uppercase"><SelectValue placeholder="NO MEMBER" /></SelectTrigger><SelectContent className="max-h-[300px]"><SelectItem value="none" className="font-black">NO MEMBER (GL ONLY)</SelectItem>{members?.map(m => <SelectItem key={m.id} value={m.id} className="font-black">{m.memberIdNumber} - {m.name} ({m.designation})</SelectItem>)}</SelectContent></Select></td>
                    <td className="p-2 border-r-2 border-black"><Input type="number" value={l.debit || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => updateLine(l.id, { debit: Number(e.target.value), credit: 0 })} className="border-none text-right font-black text-lg" /></td>
                    <td className="p-2 border-r-2 border-black"><Input type="number" value={l.credit || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => updateLine(l.id, { credit: Number(e.target.value), debit: 0 })} className="border-none text-right font-black text-lg" /></td>
                    <td className="p-2 text-center"><Button variant="ghost" onClick={() => setLines(lines.filter(x => x.id !== l.id))}><Trash2 className="size-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-4 border-black h-20">
                <tr><td colSpan={2} className="text-right p-4 uppercase text-xs">Voucher Totals:</td><td className="text-right p-4 text-2xl border-x-2 border-black">৳ {totals.debit.toLocaleString()}</td><td className="text-right p-4 text-2xl border-r-2 border-black">৳ {totals.credit.toLocaleString()}</td><td className="p-4 text-center">{isBalanced ? <Badge className="bg-black text-white px-4 py-1">Balanced</Badge> : <Badge variant="destructive">Unbalanced</Badge>}</td></tr>
              </tfoot>
            </table>
            <div className="p-8 flex justify-between bg-slate-50 border-t-4 border-black"><Button onClick={() => setLines([...lines, { id: Math.random().toString(), accountCode: '', debit: 0, credit: 0, memo: '' }])} variant="outline" className="border-4 border-black font-black uppercase"><Plus className="size-4 mr-2" /> Add Line</Button><Button onClick={handleSave} disabled={!isBalanced || isSaving} className="bg-black text-white px-16 h-14 font-black uppercase tracking-[0.4em] shadow-2xl">{isSaving ? <Loader2 className="animate-spin" /> : <Save className="mr-2" />} Post Journal</Button></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-12 text-black" /></div>}>
      <TransactionForm />
    </Suspense>
  );
}
