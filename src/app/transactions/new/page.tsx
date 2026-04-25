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
  Search as SearchIcon,
  ShieldCheck,
  Calculator,
  BookOpen
} from "lucide-react";
import { classifyTransaction } from "@/ai/flows/transaction-classification-assistant";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Badge } from "@/components/ui/badge";
import { 
  useFirestore, 
  addDocumentNonBlocking, 
  setDocumentNonBlocking,
  useCollection, 
  useMemoFirebase, 
  useDoc, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  getDocuments
} from "@/firebase";
import { collection, doc, query, where, collectionGroup } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getSubsidiaryValues } from "@/lib/ledger-mapping";

interface LineItem { id: string; accountCode: string; debit: number; credit: number; memo: string; memberId?: string; }

function AccountSearchSelector({ value, onValueChange, accounts }: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedAccount = useMemo(() => accounts?.find((a: any) => a.code === value), [accounts, value]);

  const filteredAccounts = useMemo(() => {
    if (!search) return accounts || [];
    const term = search.toLowerCase();
    return accounts?.filter((a: any) => 
      (a.name || '').toLowerCase().includes(term) || 
      (a.code || '').includes(search)
    ) || [];
  }, [accounts, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-none shadow-none h-11 font-black text-[11px] uppercase bg-transparent hover:bg-slate-50 px-4 focus:ring-0"
        >
          <span className="truncate text-left max-w-[300px] text-black">
            {value ? `${value} — ${selectedAccount?.name || 'MANUAL INPUT'}` : "SELECT ACCOUNT..."}
          </span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-30 text-black" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0 border-2 border-black rounded-none shadow-2xl overflow-hidden font-ledger" align="start">
        <div className="flex items-center border-b border-black px-3 bg-slate-50">
          <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-40 text-black" />
          <Input
            placeholder="Search Code or Account Head..."
            className="h-12 border-none bg-transparent focus-visible:ring-0 font-black text-sm text-black"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[300px] bg-white">
          <div className="p-1">
             {search && !accounts.find((a:any) => a.code === search) && (
               <Button
                 variant="ghost"
                 className="w-full justify-start font-black text-[11px] h-11 rounded-none uppercase mb-1 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all border-b border-indigo-100"
                 onClick={() => {
                   onValueChange(search);
                   setOpen(false);
                   setSearch("");
                 }}
               >
                 <Plus className="mr-2 h-4 w-4" />
                 USE MANUAL CODE: "{search}"
               </Button>
             )}
            {filteredAccounts.map((a: any) => (
              <Button
                key={a.code}
                variant="ghost"
                className="w-full justify-start font-black text-[11px] h-auto py-2.5 text-left rounded-none uppercase transition-all text-black hover:bg-indigo-600 hover:text-white group"
                onClick={() => {
                  onValueChange(a.code);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check className={cn("mr-2 h-4 w-4 shrink-0", value === a.code ? "opacity-100" : "opacity-0")} />
                <div className="flex flex-col gap-0.5 overflow-hidden">
                   <span className="truncate">{a.code} — {a.name}</span>
                   <span className="text-[9px] opacity-40 tracking-wider font-bold group-hover:text-white/80">{a.type} | {a.balance}</span>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

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
          className="w-full justify-between border-none shadow-none h-8 font-black text-[11px] uppercase bg-transparent hover:bg-slate-50 px-2"
        >
          <span className="truncate text-left max-w-[200px] text-black">
            {value ? `${selectedMember?.memberIdNumber} - ${selectedMember?.name}` : "UNTAGGED"}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-30 text-black" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 border-2 border-black rounded-none shadow-2xl overflow-hidden font-ledger" align="start">
        <div className="flex items-center border-b border-black px-3 bg-slate-50">
          <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-40 text-black" />
          <Input
            placeholder="Search Name or ID..."
            className="h-10 border-none bg-transparent focus-visible:ring-0 font-black text-xs text-black"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[250px] bg-white">
          <div className="p-1">
            <Button
              variant="ghost"
              className="w-full justify-start font-black text-[10px] h-9 rounded-none uppercase mb-0.5 text-black hover:bg-blue-600 hover:text-white transition-all"
              onClick={() => {
                onValueChange("");
                setOpen(false);
                setSearch("");
              }}
            >
              <Check className={cn("mr-2 h-3.5 w-3.5", !value ? "opacity-100" : "opacity-0")} />
              NO MEMBER (GL ONLY)
            </Button>
            <Separator className="my-1 bg-black/10" />
            {filteredMembers.map((m: any) => (
              <Button
                key={m.id}
                variant="ghost"
                className="w-full justify-start font-black text-[10px] h-auto py-2 text-left rounded-none uppercase transition-all text-black hover:bg-blue-600 hover:text-white group"
                onClick={() => {
                  onValueChange(m.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", value === m.id ? "opacity-100" : "opacity-0")} />
                <div className="flex flex-col gap-0 overflow-hidden">
                   <span className="truncate">{m.memberIdNumber} — {m.name}</span>
                   <span className="text-[8px] opacity-40 tracking-wider font-bold group-hover:text-white/80">{m.designation}</span>
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
    if (!description) {
      toast({ title: "Input Required", description: "Provide transaction narrative first.", variant: "destructive" });
      return;
    } 
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
        toast({ title: "AI Suggestion Applied", description: "Ledger matrix populated." });
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
    
    let savedId = editId;
    if (!savedId) {
      const newRef = doc(collection(firestore, "journalEntries"));
      savedId = newRef.id;
    }

    const journalRef = doc(firestore, "journalEntries", savedId);

    const entryData = { 
      id: savedId,
      entryDate, 
      description, 
      referenceNumber: refNo, 
      updatedAt: new Date().toISOString(), 
      createdAt: existingTransaction?.createdAt || new Date().toISOString(), 
      lines: lines.map(l => ({ 
        accountCode: l.accountCode, 
        accountName: activeCOA.find((a: any) => a.code === l.accountCode)?.name || "MANUAL INPUT", 
        debit: Number(l.debit) || 0, 
        credit: Number(l.credit) || 0, 
        memo: l.memo, 
        memberId: l.memberId || "" 
      })), 
      totalAmount: totals.debit 
    };

    try {
      // 1. CRITICAL RECONCILIATION: Purge all existing linked ledger entries to prevent duplicates
      if (editId) {
        const q = query(collectionGroup(firestore, "fundSummaries"), where("journalEntryId", "==", editId));
        const snap = await getDocuments(q);
        // Sequential deletion for database stability
        snap.forEach((d: any) => {
          if (d.ref) deleteDocumentNonBlocking(d.ref);
        });
      }

      // 2. Commit main Journal Entry
      setDocumentNonBlocking(journalRef, entryData);

      // 3. Post to member ledgers (Synchronized Multi-Posting)
      lines.forEach(l => {
        if (l.memberId) {
          const vals = getSubsidiaryValues(l.accountCode, Number(l.debit) || 0, Number(l.credit) || 0);
          if (vals) {
            const ledgerEntry = {
              ...vals,
              summaryDate: entryDate,
              particulars: description,
              journalEntryId: savedId,
              memberId: l.memberId,
              createdAt: new Date().toISOString(),
              isSystemGenerated: true
            };
            addDocumentNonBlocking(collection(firestore, "members", l.memberId, "fundSummaries"), ledgerEntry);
          }
        }
      });

      showAlert({ title: "Voucher Committed", description: "Transaction and Subsidiary Ledgers synchronized.", type: "success" }); 
      router.push("/transactions");
    } catch (err) { 
      console.error("Institutional Save Error:", err);
      toast({ title: "Save Failed", description: "Audit trail reconciliation failed.", variant: "destructive" }); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { 
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); 
  };

  if (isEditLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight uppercase text-black">
            {editId ? "Modify Voucher" : "New Journal Entry"}
          </h1>
          <p className="text-black uppercase tracking-widest text-[11px] font-black bg-black text-white px-3 py-1 rounded inline-block">
            Institutional General Ledger Terminal
          </p>
        </div>
        <Button onClick={handleAIClassify} disabled={isClassifying} variant="outline" className="border-2 border-black font-black uppercase h-10 px-8 bg-white hover:bg-slate-50 transition-all text-indigo-700 shadow-lg">
          {isClassifying ? <Loader2 className="size-4 animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
          AI Matrix Assistant
        </Button>
      </div>

      <div className="bg-white border-2 border-black shadow-2xl rounded-none overflow-hidden animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-4 border-b border-black font-black bg-slate-50">
          <div className="p-4 border-r border-black space-y-2">
            <Label className="text-xs uppercase tracking-widest text-indigo-700 font-black block">Posting Date</Label>
            <Input type="date" value={entryDate} max="9999-12-31" onChange={(e) => setEntryDate(e.target.value)} className="h-10 border-black border-2 bg-white font-black text-base focus-visible:ring-0 text-black uppercase" />
          </div>
          <div className="p-4 border-r border-black space-y-2">
            <Label className="text-xs uppercase tracking-widest text-amber-700 font-black block">Voucher/Ref No</Label>
            <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} className="h-10 border-black border-2 bg-white font-black text-base focus-visible:ring-0 text-black" placeholder="INSERT REF..." />
          </div>
          <div className="md:col-span-2 p-4 space-y-2">
            <Label className="text-xs uppercase tracking-widest text-blue-700 font-black block">Institutional Narrative</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-10 border-black border-2 bg-white font-black text-base focus-visible:ring-0 text-black uppercase" placeholder="ENTER TRANSACTION DESCRIPTION..." />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-black tabular-nums text-black min-w-[1000px]">
            <thead className="bg-slate-100 border-b border-black text-[10px] uppercase tracking-widest font-black">
              <tr>
                <th className="border-r border-black p-3 text-left w-[35%] text-slate-600">Chart of Accounts Mapping</th>
                <th className="border-r border-black p-3 text-left w-[30%] text-slate-600">Subsidiary Tag</th>
                <th className="border-r border-black p-3 text-right w-[15%] text-emerald-700">Debit (৳)</th>
                <th className="border-r border-black p-3 text-right w-[15%] text-rose-700">Credit (৳)</th>
                <th className="p-3 text-center w-[5%]">Op</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-black hover:bg-slate-50/50 transition-colors h-11">
                  <td className="border-r border-black p-0">
                    <AccountSearchSelector 
                      value={l.accountCode} 
                      onValueChange={(v: string) => updateLine(l.id, { accountCode: v })}
                      accounts={activeCOA.filter(a => !a.isHeader)}
                    />
                  </td>
                  <td className="border-r border-black p-0">
                    <MemberSearchSelector 
                      value={l.memberId} 
                      onValueChange={(v: string) => updateLine(l.id, { memberId: v })}
                      members={members}
                    />
                  </td>
                  <td className="border-r border-black p-0">
                    <Input 
                      type="number" 
                      step="0.01"
                      value={l.debit || ''} 
                      onKeyDown={handleNumericKeyDown} 
                      onChange={(e) => updateLine(l.id, { debit: Number(e.target.value), credit: 0 })} 
                      className="border-none text-right font-black text-sm h-10 focus-visible:ring-0 bg-transparent px-4 text-emerald-700" 
                    />
                  </td>
                  <td className="border-r border-black p-0">
                    <Input 
                      type="number" 
                      step="0.01"
                      value={l.credit || ''} 
                      onKeyDown={handleNumericKeyDown} 
                      onChange={(e) => updateLine(l.id, { credit: Number(e.target.value), debit: 0 })} 
                      className="border-none text-right font-black text-sm h-10 focus-visible:ring-0 bg-transparent px-4 text-rose-700" 
                    />
                  </td>
                  <td className="p-0 text-center">
                    <Button variant="ghost" size="icon" className="h-10 w-full rounded-none text-rose-300 hover:text-rose-700 hover:bg-rose-50" onClick={() => setLines(lines.filter(x => x.id !== l.id))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-black text-black">
              <tr className="h-16">
                <td colSpan={2} className="border-r border-black px-8 text-right uppercase text-[11px] font-black tracking-[0.3em] text-slate-500">
                  <div className="flex items-center justify-end gap-3">
                     <Calculator className="size-4" />
                     Mathematical Reconciliation Matrix:
                  </div>
                </td>
                <td className="border-r border-black text-right px-4 text-2xl font-black tabular-nums text-emerald-700">৳ {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black text-right px-4 text-2xl font-black tabular-nums text-rose-700">৳ {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 text-center bg-white">
                  {isBalanced ? (
                    <Badge className="bg-emerald-600 text-white border-none font-black uppercase text-[10px] rounded-none px-4 py-1 tracking-widest">Balanced</Badge>
                  ) : (
                    <Badge className="bg-rose-600 text-white border-none font-black uppercase text-[10px] rounded-none px-4 py-1 tracking-widest">Error</Badge>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-8 flex flex-col md:flex-row justify-between items-center bg-white border-t border-black gap-6">
          <Button onClick={() => setLines([...lines, { id: Math.random().toString(), accountCode: '', debit: 0, credit: 0, memo: '' }])} variant="outline" className="w-full md:w-auto border-2 border-black font-black uppercase h-12 px-10 bg-slate-50 hover:bg-slate-100 text-[11px] tracking-widest shadow-md">
            <Plus className="size-5 mr-2" /> Append Grid Row
          </Button>
          <div className="flex items-center gap-6 w-full md:w-auto">
            <div className="hidden lg:flex items-center gap-3 text-emerald-600">
               <ShieldCheck className="size-7" />
               <p className="text-[10px] font-black uppercase tracking-widest leading-tight">Double-Entry<br/>Integrity Safe</p>
            </div>
            <Button onClick={handleSave} disabled={!isBalanced || isSaving} className="w-full md:w-auto bg-black text-white px-20 h-16 font-black uppercase text-xs tracking-[0.4em] shadow-2xl hover:bg-slate-900 transition-all group">
              {isSaving ? <Loader2 className="animate-spin size-5 mr-3" /> : <Save className="size-5 mr-4 group-hover:scale-110 transition-transform text-emerald-400" />}
              Commit Voucher
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-10 border-t border-black flex justify-between items-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-600" />
          <span>Institutional Trust Registry v1.2</span>
        </div>
        <p className="italic">Developed by: Ariful Islam, AGM Finance, Gazipur PBS-2</p>
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
