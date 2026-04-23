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
          className="w-full justify-between border border-slate-200 h-10 font-bold text-[11px] uppercase bg-white hover:bg-slate-50 px-3"
        >
          <span className="truncate text-left max-w-[220px]">
            {value ? `${selectedMember?.memberIdNumber} - ${selectedMember?.name}` : "SELECT MEMBER (OPTIONAL)"}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 border border-slate-200 rounded-xl shadow-2xl overflow-hidden" align="start">
        <div className="flex items-center border-b px-3 bg-slate-50">
          <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search Name or ID..."
            className="h-10 border-none bg-transparent focus-visible:ring-0 font-bold text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[250px] bg-white">
          <div className="p-1">
            <Button
              variant="ghost"
              className="w-full justify-start font-bold text-[10px] h-9 rounded-lg uppercase mb-0.5"
              onClick={() => {
                onValueChange("");
                setOpen(false);
                setSearch("");
              }}
            >
              <Check className={cn("mr-2 h-3.5 w-3.5", !value ? "opacity-100" : "opacity-0")} />
              NO MEMBER (GL ONLY)
            </Button>
            <Separator className="my-1 bg-slate-100" />
            {filteredMembers.map((m: any) => (
              <Button
                key={m.id}
                variant="ghost"
                className="w-full justify-start font-bold text-[10px] h-auto py-2.5 text-left rounded-lg uppercase transition-colors"
                onClick={() => {
                  onValueChange(m.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", value === m.id ? "opacity-100" : "opacity-0")} />
                <div className="flex flex-col gap-0 overflow-hidden">
                   <span className="truncate">{m.memberIdNumber} - {m.name}</span>
                   <span className="text-[8px] opacity-50 tracking-wider">{m.designation}</span>
                </div>
              </Button>
            ))}
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
      showAlert({ title: "Journal Posted", description: "The transaction has been committed to the local drive.", type: "success" }); 
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

  if (isEditLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-10 text-primary" /></div>;

  return (
    <div className="p-8 flex flex-col gap-10 bg-slate-50 min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-primary tracking-tight uppercase">{editId ? "Modify Voucher" : "New Journal Entry"}</h1>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Institutional Financial Registry Matrix</p>
      </div>

      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-white border-b px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <CardTitle className="text-xl font-black uppercase text-primary">Voucher Terminal</CardTitle>
            <CardDescription className="text-[11px] font-bold uppercase tracking-wider">GL Distribution & Subsidiary Integration</CardDescription>
          </div>
          <Button onClick={handleAIClassify} disabled={isClassifying} variant="outline" className="w-full md:w-auto border-2 border-slate-100 font-bold uppercase h-10 px-6 bg-slate-50 hover:bg-slate-100 transition-all text-indigo-600">
            {isClassifying ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
            Accounting AI
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50/50 border-b">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Posting Date</Label>
              <Input type="date" value={entryDate} max="9999-12-31" onChange={(e) => setEntryDate(e.target.value)} className="h-11 border-slate-200 font-bold text-sm focus:ring-0 uppercase bg-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Voucher/Ref No</Label>
              <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} className="h-11 border-slate-200 font-bold text-sm bg-white" placeholder="E.g. J-2024-001" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Transaction Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-11 border-slate-200 font-bold text-sm bg-white" placeholder="Describe the transaction..." />
            </div>
          </div>

          <div className="overflow-x-auto p-2">
            <table className="w-full font-bold tabular-nums min-w-[1000px] border-separate border-spacing-0">
              <thead className="bg-white border-b text-[9px] uppercase text-slate-400">
                <tr>
                  <th className="p-4 text-left font-black tracking-widest w-[30%]">General Ledger Account</th>
                  <th className="p-4 text-left font-black tracking-widest w-[30%]">Sub-Ledger Tag (Optional)</th>
                  <th className="p-4 text-right font-black tracking-widest w-[15%]">Debit (৳)</th>
                  <th className="p-4 text-right font-black tracking-widest w-[15%]">Credit (৳)</th>
                  <th className="p-4 text-center w-[10%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l) => (
                  <tr key={l.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="p-2">
                      <Select value={l.accountCode} onValueChange={(v) => updateLine(l.id, { accountCode: v })}>
                        <SelectTrigger className="border-none font-bold text-[13px] uppercase h-10 bg-transparent hover:bg-slate-100 px-3">
                          <SelectValue placeholder="Select Account Code" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[350px] rounded-xl shadow-2xl border-slate-200">
                          {activeCOA.filter(a => !a.isHeader).map(a => (
                            <SelectItem key={a.code} value={a.code} className="text-[11px] font-bold uppercase py-2">
                              {a.code} - {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <MemberSearchSelector 
                        value={l.memberId} 
                        onValueChange={(v: string) => updateLine(l.id, { memberId: v })}
                        members={members}
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number" 
                        step="0.01"
                        value={l.debit || ''} 
                        onKeyDown={handleNumericKeyDown} 
                        onChange={(e) => updateLine(l.id, { debit: Number(e.target.value), credit: 0 })} 
                        className={cn("border-none text-right font-black text-[15px] h-10 focus-visible:ring-0 bg-transparent", l.debit > 0 && "text-primary")} 
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number" 
                        step="0.01"
                        value={l.credit || ''} 
                        onKeyDown={handleNumericKeyDown} 
                        onChange={(e) => updateLine(l.id, { credit: Number(e.target.value), debit: 0 })} 
                        className={cn("border-none text-right font-black text-[15px] h-10 focus-visible:ring-0 bg-transparent", l.credit > 0 && "text-accent")} 
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all" onClick={() => setLines(lines.filter(x => x.id !== l.id))}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/50 border-t-2">
                <tr className="h-20">
                  <td colSpan={2} className="text-right px-8 uppercase text-[10px] font-black tracking-widest text-slate-400">Mathematical Reconciliation:</td>
                  <td className="text-right px-4 text-xl font-black text-primary border-r tabular-nums">৳ {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-right px-4 text-xl font-black text-accent tabular-nums">৳ {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 text-center">
                    {isBalanced ? (
                      <Badge className="bg-emerald-500 text-white px-3 py-1 uppercase text-[8px] font-black border-none">Balanced</Badge>
                    ) : (
                      <Badge variant="destructive" className="px-3 py-1 uppercase text-[8px] font-black border-none">Discrepancy</Badge>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-8 flex flex-col md:flex-row justify-between items-center bg-white border-t gap-6">
            <Button onClick={() => setLines([...lines, { id: Math.random().toString(), accountCode: '', debit: 0, credit: 0, memo: '' }])} variant="outline" className="w-full md:w-auto border-2 border-slate-100 font-black uppercase h-12 px-8 bg-slate-50 hover:bg-slate-100 text-[11px] tracking-widest">
              <Plus className="size-4 mr-2" /> Add Transaction Matrix
            </Button>
            <Button onClick={handleSave} disabled={!isBalanced || isSaving} className="w-full md:w-auto bg-primary text-white px-16 h-14 font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-primary/90 transition-all">
              {isSaving ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4 mr-3" />}
              Commit Voucher to Ledger
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewTransactionPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-10 text-primary" /></div>}>
      <TransactionForm />
    </Suspense>
  );
}