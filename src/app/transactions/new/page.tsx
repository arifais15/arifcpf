"use client"

import { useState, useMemo, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import { 
  Sparkles, 
  Save, 
  Info, 
  Loader2, 
  Plus, 
  Trash2, 
  ArrowRightLeft, 
  User, 
  Check, 
  ChevronsUpDown, 
  Search as SearchIcon 
} from "lucide-react";
import { classifyTransaction } from "@/ai/flows/transaction-classification-assistant";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Badge } from "@/components/ui/badge";
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, getDocs } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface LineItem { id: string; accountCode: string; debit: number; credit: number; memo: string; memberId?: string; }

function MemberSearchSelector({ value, onValueChange, members }: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedMember = useMemo(() => members?.find((m: any) => m.id === value), [members, value]);

  const filteredMembers = useMemo(() => {
    if (!search) return members || [];
    const term = search.toLowerCase();
    return members?.filter((m: any) => 
      m.name.toLowerCase().includes(term) || 
      m.memberIdNumber.includes(search)
    ) || [];
  }, [members, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-none h-12 font-black text-[11px] uppercase bg-transparent hover:bg-slate-100 px-3"
        >
          <span className="truncate text-left">
            {value ? `${selectedMember?.memberIdNumber} - ${selectedMember?.name}` : "NO MEMBER (GL ONLY)"}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 border-4 border-black rounded-none shadow-2xl" align="start">
        <div className="flex items-center border-b-4 border-black px-3 bg-slate-50">
          <SearchIcon className="mr-2 h-5 w-5 shrink-0 opacity-50" />
          <Input
            placeholder="Search Name or ID..."
            className="h-12 border-none bg-transparent focus-visible:ring-0 font-black text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[300px] bg-white">
          <div className="p-2">
            <Button
              variant="ghost"
              className="w-full justify-start font-black text-[11px] h-10 rounded-none uppercase mb-1"
              onClick={() => {
                onValueChange("");
                setOpen(false);
                setSearch("");
              }}
            >
              <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
              NO MEMBER (GL ONLY)
            </Button>
            <Separator className="my-1 bg-black/10" />
            {filteredMembers.map((m: any) => (
              <Button
                key={m.id}
                variant="ghost"
                className="w-full justify-start font-black text-[11px] h-auto py-3 text-left rounded-none uppercase"
                onClick={() => {
                  onValueChange(m.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check className={cn("mr-2 h-4 w-4 shrink-0", value === m.id ? "opacity-100" : "opacity-0")} />
                <div className="flex flex-col gap-0.5 overflow-hidden">
                   <span className="truncate">{m.memberIdNumber} - {m.name}</span>
                   <span className="text-[9px] opacity-60 font-bold tracking-wider">{m.designation} • {m.zonalOffice || "HO"}</span>
                </div>
              </Button>
            ))}
            {filteredMembers.length === 0 && (
              <div className="p-8 text-center text-[10px] font-black uppercase opacity-30 italic">No matching personnel found in registry</div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function TransactionForm() {
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

  useEffect(() => { 
    if (!editId) setEntryDate(new Date().toISOString().split('T')[0]); 
  }, [editId]);

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData } = useCollection(coaRef);
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData]);
  
  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members } = useCollection(membersRef);
  
  const transactionRef = useMemoFirebase(() => editId ? doc(firestore, "journalEntries", editId) : null, [firestore, editId]);
  const { data: existingTransaction, isLoading: isEditLoading } = useDoc(transactionRef);

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

  const totals = useMemo(() => lines.reduce((acc, curr) => ({ 
    debit: acc.debit + (Number(curr.debit) || 0), 
    credit: acc.credit + (Number(curr.credit) || 0) 
  }), { debit: 0, credit: 0 }), [lines]);

  const isBalanced = totals.debit > 0 && Math.abs(totals.debit - totals.credit) < 0.01;
  const updateLine = (id: string, updates: Partial<LineItem>) => setLines(lines.map(l => l.id === id ? { ...l, ...updates } : l));

  const handleAIClassify = async () => {
    if (!description) return; 
    setIsClassifying(true);
    try {
      const res = await classifyTransaction({ transactionDescription: description }); 
      setAiSuggestion(res);
      if (res.suggestedEntries?.length > 0) {
        setLines(res.suggestedEntries.map((item: any) => ({ 
          id: Math.random().toString(), 
          accountCode: item.accountCode, 
          debit: 0, 
          credit: 0, 
          memo: description 
        })));
      }
    } catch (err) { 
      toast({ title: "AI Error", variant: "destructive" }); 
    } finally { 
      setIsClassifying(false); 
    }
  };

  const handleSave = async () => {
    if (!isBalanced) return; 
    setIsSaving(true);
    const entryData = { 
      entryDate, 
      description, 
      referenceNumber: refNo, 
      updatedAt: new Date().toISOString(), 
      createdAt: existingTransaction?.createdAt || new Date().toISOString(), 
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
      if (editId) await updateDocumentNonBlocking(doc(firestore, "journalEntries", editId), entryData);
      else await addDocumentNonBlocking(collection(firestore, "journalEntries"), entryData);
      showAlert({ title: "Journal Posted", description: `Reference ${refNo || 'AUTO'} committed to ledger.`, type: "success" }); 
      router.push("/transactions");
    } catch (err) { 
      toast({ title: "Save Failed", variant: "destructive" }); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { 
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); 
  };

  if (isEditLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-black" /></div>;

  return (
    <div className="p-4 md:p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">{editId ? "Modify Voucher" : "New Journal Entry"}</h1>
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Double-Entry Financial Registry Matrix</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-12 border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] rounded-none">
          <CardHeader className="bg-slate-100 border-b-4 border-black flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-black uppercase">Voucher Terminal</CardTitle>
              <CardDescription className="text-xs font-black uppercase opacity-60">GL Distribution & Sub-Ledger Linking</CardDescription>
            </div>
            <Button onClick={handleAIClassify} disabled={isClassifying} variant="outline" className="w-full md:w-auto border-4 border-black font-black uppercase h-11 bg-white hover:bg-slate-50">
              {isClassifying ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
              AI Suggestion
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 border-b-4 border-black">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase ml-1">Posting Date</Label>
                <Input type="date" value={entryDate} max="9999-12-31" onChange={(e) => setEntryDate(e.target.value)} className="h-12 border-4 border-black font-black text-lg focus:ring-0 uppercase" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase ml-1">Ref/Voucher No</Label>
                <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} className="h-12 border-4 border-black font-black text-lg" placeholder="AUTO" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase ml-1">Voucher Particulars</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-12 border-4 border-black font-black text-lg" placeholder="Description of Transaction..." />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full font-black tabular-nums min-w-[900px]">
                <thead className="bg-slate-100 border-b-2 border-black uppercase text-[10px]">
                  <tr>
                    <th className="p-4 text-left border-r-2 border-black w-[30%]">General Ledger Account</th>
                    <th className="p-4 text-left border-r-2 border-black w-[30%]">Member (Sub-Ledger)</th>
                    <th className="p-4 text-right border-r-2 border-black w-[15%]">Debit Balance</th>
                    <th className="p-4 text-right border-r-2 border-black w-[15%]">Credit Balance</th>
                    <th className="p-4 text-center w-[10%]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black">
                  {lines.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="p-2 border-r-2 border-black">
                        <Select value={l.accountCode} onValueChange={(v) => updateLine(l.id, { accountCode: v })}>
                          <SelectTrigger className="border-none font-black text-sm uppercase h-12">
                            <SelectValue placeholder="Select Account" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[350px]">
                            {activeCOA.filter(a => !a.isHeader).map(a => (
                              <SelectItem key={a.code} value={a.code} className="font-black">
                                {a.code} - {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 border-r-2 border-black">
                        <MemberSearchSelector 
                          value={l.memberId} 
                          onValueChange={(v: string) => updateLine(l.id, { memberId: v })}
                          members={members}
                        />
                      </td>
                      <td className="p-2 border-r-2 border-black">
                        <Input 
                          type="number" 
                          step="0.01"
                          value={l.debit || ''} 
                          onKeyDown={handleNumericKeyDown} 
                          onChange={(e) => updateLine(l.id, { debit: Number(e.target.value), credit: 0 })} 
                          className="border-none text-right font-black text-lg h-12 focus-visible:ring-0" 
                        />
                      </td>
                      <td className="p-2 border-r-2 border-black">
                        <Input 
                          type="number" 
                          step="0.01"
                          value={l.credit || ''} 
                          onKeyDown={handleNumericKeyDown} 
                          onChange={(e) => updateLine(l.id, { credit: Number(e.target.value), debit: 0 })} 
                          className="border-none text-right font-black text-lg h-12 focus-visible:ring-0" 
                        />
                      </td>
                      <td className="p-2 text-center">
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-rose-600 hover:bg-rose-50" onClick={() => setLines(lines.filter(x => x.id !== l.id))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 border-t-4 border-black h-24">
                  <tr>
                    <td colSpan={2} className="text-right p-4 uppercase text-xs tracking-widest font-black">Voucher Consolidation Totals:</td>
                    <td className="text-right p-4 text-2xl border-x-2 border-black font-black">৳ {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-right p-4 text-2xl border-r-2 border-black font-black">৳ {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-center">
                      {isBalanced ? (
                        <Badge className="bg-emerald-600 text-white px-4 py-2 uppercase text-[10px] font-black border-2 border-black">Balanced</Badge>
                      ) : (
                        <Badge variant="destructive" className="px-4 py-2 uppercase text-[10px] font-black border-2 border-black">Unbalanced</Badge>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="p-4 md:p-8 flex flex-col md:flex-row justify-between items-center bg-slate-50 border-t-4 border-black gap-6">
              <Button onClick={() => setLines([...lines, { id: Math.random().toString(), accountCode: '', debit: 0, credit: 0, memo: '' }])} variant="outline" className="w-full md:w-auto border-4 border-black font-black uppercase h-14 px-8 bg-white shadow-lg">
                <Plus className="size-5 mr-2" /> Add Transaction Line
              </Button>
              <Button onClick={handleSave} disabled={!isBalanced || isSaving} className="w-full md:w-auto bg-black text-white px-16 h-16 font-black uppercase tracking-[0.4em] shadow-2xl hover:bg-slate-900 transition-all border-2 border-white/10">
                {isSaving ? <Loader2 className="animate-spin size-6" /> : <Save className="size-6 mr-3" />}
                Commit Voucher
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>}>
      <TransactionForm />
    </Suspense>
  );
}
