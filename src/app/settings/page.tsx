"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data"
import { 
  useFirestore, 
  useDoc, 
  useCollection, 
  useMemoFirebase, 
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from "@/firebase"
import { localDB } from "@/firebase/local-db-service"
import { collection, doc } from "firebase/firestore"
import { 
  Loader2, 
  Save, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  BookOpen, 
  Search, 
  Edit2,
  Building,
  Lock,
  Unlock,
  KeyRound,
  Coins,
  Download,
  Upload,
  Database,
  HardDrive
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useSweetAlert } from "@/hooks/use-sweet-alert"
import { LEDGER_COLUMN_MAPPING, NORMAL_DEBIT_ACCOUNTS } from "@/lib/ledger-mapping"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const { showAlert } = useSweetAlert()
  const [isSaving, setIsSaving] = useState(false)

  // --- SECURITY LOCK STATE ---
  const [securityCode, setSecurityCode] = useState("")
  const AUTHORIZATION_CODE = "Arif@PBS2" 
  const isUnlocked = securityCode === AUTHORIZATION_CODE

  // --- STORAGE METRICS ---
  const [dbMode, setDbMode] = useState<string>("Initializing...")
  
  useEffect(() => {
    const updateMetrics = () => {
      setDbMode(localDB.getMode());
    };
    updateMetrics();
    window.addEventListener('storage', updateMetrics);
    return () => window.removeEventListener('storage', updateMetrics);
  }, []);

  // --- GENERAL SETTINGS ---
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore])
  const { data: savedGeneralSettings, isLoading: isGeneralLoading } = useDoc(generalSettingsRef)
  const [pbsName, setPbsName] = useState("Gazipur Palli Bidyut Samity-2")

  // --- LEDGER MAPPING & INTEREST STATES ---
  const ledgerSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "ledger"), [firestore])
  const { data: savedLedgerSettings, isLoading: isLedgerLoading } = useDoc(ledgerSettingsRef)

  const interestSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "interest"), [firestore])
  const { data: savedInterestSettings, isLoading: isInterestLoading } = useDoc(interestSettingsRef)

  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [debitAccounts, setDebitAccounts] = useState<string[]>([])
  const [interestTiers, setInterestTiers] = useState<{ limit: number | null, rate: number }[]>([
    { limit: 1500000, rate: 13 },
    { limit: 3000000, rate: 12 },
    { limit: null, rate: 11 }
  ])
  const [tdsRate, setTdsRate] = useState<number>(20)

  // --- CHART OF ACCOUNTS STATES ---
  const [coaSearch, setCoaSearch] = useState("")
  const [isCoaAddOpen, setIsCoaAddOpen] = useState(false)
  const [editingCoaAccount, setEditingCoaAccount] = useState<any>(null)

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore])
  const { data: coaData, isLoading: isCoaLoading } = useCollection(coaRef)

  const activeCOA = useMemo(() => {
    const data = coaData && coaData.length > 0 ? coaData : INITIAL_COA;
    return data
      .filter((acc: any) => 
        (acc.name || acc.accountName).toLowerCase().includes(coaSearch.toLowerCase()) || 
        (acc.code || acc.accountCode).includes(coaSearch)
      )
      .sort((a: any, b: any) => (a.code || a.accountCode).localeCompare(b.code || b.accountCode));
  }, [coaData, coaSearch]);

  useEffect(() => {
    if (savedGeneralSettings) {
      setPbsName(savedGeneralSettings.pbsName || "Gazipur Palli Bidyut Samity-2")
    }
  }, [savedGeneralSettings])

  useEffect(() => {
    if (savedLedgerSettings) {
      setMapping(savedLedgerSettings.mapping || {})
      setDebitAccounts(savedLedgerSettings.debitAccounts || [])
    } else {
      const defaultMapping: Record<string, string> = {}
      Object.entries(LEDGER_COLUMN_MAPPING).forEach(([code, col]) => {
        defaultMapping[col] = code
      })
      setMapping(defaultMapping)
      setDebitAccounts(NORMAL_DEBIT_ACCOUNTS)
    }
  }, [savedLedgerSettings])

  useEffect(() => {
    if (savedInterestSettings) {
      if (savedInterestSettings.tiers) {
        setInterestTiers(savedInterestSettings.tiers.map((t: any) => ({ ...t, rate: t.rate * 100 })))
      }
      if (savedInterestSettings.tdsRate !== undefined) {
        setTdsRate(savedInterestSettings.tdsRate * 100)
      }
    }
  }, [savedInterestSettings])

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
  };

  const handleSaveGeneral = () => {
    setIsSaving(true)
    setDocumentNonBlocking(generalSettingsRef, {
      pbsName,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    
    setTimeout(() => {
      setIsSaving(false)
      showAlert({ title: "Branding Updated", description: "Institution name saved.", type: "success" })
    }, 500)
  }

  const handleSaveLedger = () => {
    setIsSaving(true)
    setDocumentNonBlocking(ledgerSettingsRef, {
      mapping,
      debitAccounts,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    
    setTimeout(() => {
      setIsSaving(false)
      showAlert({ title: "Ledger Saved", description: "Mapping configuration updated.", type: "success" })
    }, 500)
  }

  const handleSaveInterest = () => {
    setIsSaving(true)
    const tiersToSave = interestTiers.map(t => ({
      limit: t.limit === null ? null : Number(t.limit),
      rate: Number(t.rate) / 100
    }))

    setDocumentNonBlocking(interestSettingsRef, {
      tiers: tiersToSave,
      tdsRate: Number(tdsRate) / 100,
      updatedAt: new Date().toISOString()
    }, { merge: true })

    setTimeout(() => {
      setIsSaving(false)
      showAlert({ title: "Policy Updated", description: "Interest tiers and TDS rates saved.", type: "success" })
    }, 500)
  }

  const updateMapping = (column: string, code: string) => {
    setMapping(prev => ({ ...prev, [column]: code }))
  }

  const toggleDebit = (code: string) => {
    setDebitAccounts(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  const addInterestTier = () => {
    const newTiers = [...interestTiers]
    const lastTier = newTiers[newTiers.length - 1]
    if (lastTier.limit !== null) {
      newTiers.push({ limit: null, rate: 10 })
    } else {
      const currentVal = lastTier.limit || 5000000
      lastTier.limit = currentVal + 1000000
      newTiers.push({ limit: null, rate: 10 })
    }
    setInterestTiers(newTiers)
  }

  const removeInterestTier = (index: number) => {
    if (interestTiers.length <= 1) return
    setInterestTiers(interestTiers.filter((_, i) => i !== index))
  }

  const updateInterestTier = (index: number, updates: any) => {
    const newTiers = [...interestTiers]
    newTiers[index] = { ...newTiers[index], ...updates }
    setInterestTiers(newTiers)
  }

  const handleSaveCoaAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const type = formData.get("type") as string;
    const balance = formData.get("balance") as string;
    
    const accountData = {
      accountCode: formData.get("code") as string,
      accountName: formData.get("name") as string,
      accountType: type === "none" ? "" : type,
      normalBalance: balance === "none" ? "" : balance,
      isHeader: formData.get("isHeader") === "true",
      updatedAt: new Date().toISOString()
    };

    if (editingCoaAccount && editingCoaAccount.id) {
      const docRef = doc(firestore, "chartOfAccounts", editingCoaAccount.id);
      updateDocumentNonBlocking(docRef, accountData);
      showAlert({ title: "Success", description: `${accountData.accountName} updated.`, type: "success" });
    } else {
      addDocumentNonBlocking(coaRef, accountData);
      showAlert({ title: "Added", description: `${accountData.accountName} added.`, type: "success" });
    }
    setIsCoaAddOpen(false);
    setEditingCoaAccount(null);
  };

  const handleDeleteCoaAccount = (id: string, name: string) => {
    showAlert({
      title: "Are you sure?",
      description: `Delete account: ${name}?`,
      type: "warning",
      showCancel: true,
      confirmText: "Delete Account",
      onConfirm: () => {
        const docRef = doc(firestore, "chartOfAccounts", id);
        deleteDocumentNonBlocking(docRef);
        showAlert({ title: "Deleted", description: "Account removed.", type: "success" });
      }
    });
  };

  // --- LOCAL DB PORTABILITY HANDLERS ---
  const handleExportDB = () => {
    localDB.exportDatabase().then(data => {
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PBS_CPF_DATABASE_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Database Exported", description: "Storage file saved to downloads." });
    });
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = localDB.importDatabase(event.target?.result as string);
      if (result) {
        showAlert({
          title: "Import Successful",
          description: "Institutional registry has been synchronized. System will now reload.",
          type: "success",
          onConfirm: () => window.location.reload()
        });
      } else {
        toast({ title: "Import Failed", description: "Invalid database file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  if (isLedgerLoading || isInterestLoading || isCoaLoading || isGeneralLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-black" /></div>
  }

  const ledgerCols = [
    { key: 'employeeContribution', label: 'Employee Contribution (Col 1)', description: 'Standard monthly contribution' },
    { key: 'loanWithdrawal', label: 'Loan Withdrawal (Col 2)', description: 'Principle disbursed to member' },
    { key: 'loanRepayment', label: 'Loan Repayment (Col 3)', description: 'Principle recovered from member' },
    { key: 'profitEmployee', label: 'Profit on Employee Cont. (Col 5)', description: 'Annual accrued interest' },
    { key: 'profitLoan', label: 'Profit on Loan (Col 6)', description: 'Interest paid by member on loans' },
    { key: 'pbsContribution', label: 'PBS Contribution (Col 8)', description: 'Office share matching' },
    { key: 'profitPbs', label: 'Profit on PBS Cont. (Col 9)', description: 'Interest on office share' },
  ]

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-black tracking-tight uppercase">System Settings</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Institutional Governance & Rule Matrix</p>
        </div>

        <div className="bg-white p-4 rounded-xl border-2 border-black shadow-lg flex items-center gap-4 animate-in slide-in-from-right-4 duration-500">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg transition-colors border-2",
              isUnlocked ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"
            )}>
              {isUnlocked ? <Unlock className="size-5" /> : <Lock className="size-5" />}
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] uppercase font-black text-slate-400">Security Authorization</Label>
              <div className="relative">
                <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <Input 
                  type="password"
                  placeholder="Insert Higher Code..."
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value)}
                  className="h-9 pl-9 w-[200px] text-xs font-black border-2 border-slate-200 focus:bg-white text-black"
                />
              </div>
            </div>
          </div>
          {isUnlocked && (
            <Badge className="bg-black text-white uppercase text-[9px] font-black tracking-widest px-3 py-1 rounded-none shadow-md">Authorized</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="database" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl border-2 border-black mb-8 h-12 shadow-inner">
          <TabsTrigger value="database" className="px-6 py-2 gap-2 rounded-lg font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white"><Database className="size-4" /> Data Portability</TabsTrigger>
          <TabsTrigger value="coa" className="px-6 py-2 gap-2 rounded-lg font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white"><BookOpen className="size-4" /> Chart of Accounts</TabsTrigger>
          <TabsTrigger value="ledger" className="px-6 py-2 gap-2 rounded-lg font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white"><ShieldCheck className="size-4" /> Ledger Mapping</TabsTrigger>
          <TabsTrigger value="interest" className="px-6 py-2 gap-2 rounded-lg font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white"><Percent className="size-4" /> Interest & Tax</TabsTrigger>
          <TabsTrigger value="branding" className="px-6 py-2 gap-2 rounded-lg font-black uppercase text-[10px] data-[state=active]:bg-black data-[state=active]:text-white"><Building className="size-4" /> General</TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-10 animate-in fade-in duration-500">
           <Card className="max-w-3xl border-4 border-black rounded-none shadow-2xl bg-white overflow-hidden">
              <CardHeader className="bg-black text-white flex flex-row items-center justify-between py-6">
                <div className="flex items-center gap-4">
                  <HardDrive className="size-6 text-emerald-400" />
                  <div>
                    <CardTitle className="text-lg font-black uppercase">Persistence Matrix Monitor</CardTitle>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Real-time drive synchronization audit</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-emerald-500 text-emerald-400 font-black uppercase text-[10px] tracking-widest px-4 py-1.5 h-8">Active: {dbMode}</Badge>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                 <div className="space-y-6">
                   <div className="flex items-center gap-4 p-4 bg-slate-50 border-2 border-black rounded-xl">
                      <div className={cn("p-2 rounded-lg", dbMode === 'OPFS' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                        <ShieldCheck className="size-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase">Vault Status: {dbMode === 'OPFS' ? 'Synchronized to Disk' : 'Fallback Active'}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                          {dbMode === 'OPFS' ? 'Every transaction is immediately flushed to the Origin Private File System.' : 'System is using IndexedDB fallback. Data is persistent but storage may be limited.'}
                        </p>
                      </div>
                   </div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed italic border-l-4 border-slate-200 pl-4">
                     Browser SQL storage is managed locally. For institutional continuity, performing a weekly "Download Archive" is mandatory.
                   </p>
                 </div>

                 <div className="grid md:grid-cols-2 gap-10">
                    <div className="p-8 bg-slate-50 border-2 border-black rounded-3xl space-y-6 shadow-xl hover:scale-[1.02] transition-transform">
                       <div className="flex items-center gap-4">
                         <div className="bg-white p-3 rounded-2xl border-2 border-black"><Download className="size-6 text-black" /></div>
                         <h4 className="font-black uppercase text-sm tracking-widest">Download Archive</h4>
                       </div>
                       <p className="text-[11px] text-slate-400 font-bold uppercase leading-relaxed">Encapsulates all Member Ledgers, Vouchers, and Matrix Rules into a standalone JSON file.</p>
                       <Button onClick={handleExportDB} className="w-full h-12 bg-black text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl">Generate Local Backup</Button>
                    </div>

                    <div className="p-8 bg-slate-50 border-2 border-black rounded-3xl space-y-6 shadow-xl hover:scale-[1.02] transition-transform">
                       <div className="flex items-center gap-4">
                         <div className="bg-white p-3 rounded-2xl border-2 border-black"><Upload className="size-6 text-indigo-600" /></div>
                         <h4 className="font-black uppercase text-sm tracking-widest">Synchronize Drive</h4>
                       </div>
                       <p className="text-[11px] text-slate-400 font-bold uppercase leading-relaxed">Restore institutional registry from an external file. <span className="text-rose-600 underline">Existing data will be replaced.</span></p>
                       <div className="relative">
                         <Input type="file" accept=".json" onChange={handleImportDB} className="cursor-pointer opacity-0 absolute inset-0 w-full h-full z-10" disabled={!isUnlocked} />
                         <Button variant="outline" disabled={!isUnlocked} className="w-full h-12 border-2 border-black bg-white font-black uppercase tracking-[0.2em] text-[10px] text-black">
                            {isUnlocked ? "Select Registry Matrix" : "Terminal Locked"}
                         </Button>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="coa" className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between mb-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black opacity-30" />
              <Input className="pl-9 h-10 border-2 border-black font-black text-xs" placeholder="Filter Registry Accounts..." value={coaSearch} onChange={(e) => setCoaSearch(e.target.value)} />
            </div>
            <Dialog open={isCoaAddOpen} onOpenChange={(open) => { if (isUnlocked) { setIsCoaAddOpen(open); if (!open) setEditingCoaAccount(null); } }}>
              <DialogTrigger asChild>
                <Button className="h-10 bg-black text-white font-black uppercase text-[10px] px-8 rounded-none shadow-xl" disabled={!isUnlocked}><Plus className="size-4 mr-2" /> Add Account</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white border-4 border-black p-0 overflow-hidden rounded-none shadow-2xl">
                <DialogHeader className="bg-slate-100 p-6 border-b-4 border-black"><DialogTitle className="text-xl font-black uppercase">{editingCoaAccount ? "Edit" : "New"} Ledger Head</DialogTitle></DialogHeader>
                <form onSubmit={handleSaveCoaAccount} className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Code</Label><Input name="code" className="h-10 border-2 border-black font-black font-mono" defaultValue={editingCoaAccount?.code || editingCoaAccount?.accountCode} required /></div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Type</Label>
                      <Select name="type" defaultValue={editingCoaAccount ? (editingCoaAccount.type || editingCoaAccount.accountType || "none") : "Asset"}>
                        <SelectTrigger className="h-10 border-2 border-black font-black uppercase text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent className="font-black uppercase text-[10px]">
                          <SelectItem value="Asset">Asset</SelectItem><SelectItem value="Contra-Asset">Contra-Asset</SelectItem><SelectItem value="Liability">Liability</SelectItem><SelectItem value="Equity">Equity</SelectItem><SelectItem value="Income">Income</SelectItem><SelectItem value="Expense">Expense</SelectItem><SelectItem value="none">Header</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Account Label</Label><Input name="name" className="h-10 border-2 border-black font-black uppercase text-xs" defaultValue={editingCoaAccount?.name || editingCoaAccount?.accountName} required /></div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Normal Balance</Label>
                      <Select name="balance" defaultValue={editingCoaAccount ? (editingCoaAccount.balance || editingCoaAccount.normalBalance || "none") : "Debit"}>
                        <SelectTrigger className="h-10 border-2 border-black font-black uppercase text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent className="font-black uppercase text-[10px]"><SelectItem value="Debit">Debit</SelectItem><SelectItem value="Credit">Credit</SelectItem><SelectItem value="none">None</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Header Row</Label>
                      <Select name="isHeader" defaultValue={editingCoaAccount?.isHeader?.toString() || "false"}>
                        <SelectTrigger className="h-10 border-2 border-black font-black uppercase text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent className="font-black uppercase text-[10px]"><SelectItem value="true">YES</SelectItem><SelectItem value="false">NO</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="pt-4"><Button type="submit" className="w-full h-12 bg-black text-white font-black uppercase tracking-widest text-[10px] shadow-xl">Commit to Registry</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-2 border-black rounded-none shadow-xl overflow-hidden bg-white">
            <Table className="text-black font-black">
              <TableHeader className="bg-slate-100 border-b-2 border-black">
                <TableRow>
                  <TableHead className="w-[150px] font-black uppercase text-[10px] pl-6 text-black">Code</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-black">Account Name</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-black">Type</TableHead>
                  <TableHead className="font-black uppercase text-[10px] text-black">Balance</TableHead>
                  <TableHead className="text-right pr-6 font-black uppercase text-[10px] text-black">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {activeCOA.map((account: any) => (
                  <TableRow key={account.id || account.code} className={cn("border-b border-black/10 hover:bg-slate-50 transition-colors h-[29px]", account.isHeader && "bg-slate-100/50 font-black")}>
                    <td className="font-mono text-xs pl-6 py-0">{account.code || account.accountCode}</td>
                    <td className={cn("py-0 uppercase text-[11px]", account.isHeader ? "pl-4 text-primary" : "pl-8")}>{account.name || account.accountName}</td>
                    <td className="py-0"><Badge variant="outline" className="text-[9px] uppercase font-black border-black/20 h-5 px-2 rounded-none">{account.type || account.accountType}</Badge></td>
                    <td className="py-0 font-bold uppercase text-[9px]">{account.balance || account.normalBalance}</td>
                    <td className="text-right pr-6 py-0">
                      <div className="flex justify-end gap-1 h-full items-center">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-black" disabled={!isUnlocked} onClick={() => { setEditingCoaAccount(account); setIsCoaAddOpen(true); }}><Edit2 className="size-3" /></Button>
                        {account.id && <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-300 hover:text-rose-600" disabled={!isUnlocked} onClick={() => handleDeleteCoaAccount(account.id, account.name || account.accountName)}><Trash2 className="size-3" /></Button>}
                      </div>
                    </td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="space-y-8 animate-in fade-in duration-500">
          <Card className="max-w-4xl border-2 border-black rounded-none shadow-2xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b-2 border-black flex flex-row items-center justify-between py-6">
              <div>
                <CardTitle className="text-xl font-black uppercase">Subsidiary Column Mapping</CardTitle>
                <CardDescription className="font-black text-[10px] uppercase tracking-widest text-slate-400 mt-1">Cross-link General Ledger heads to BREB Form-224 Columns</CardDescription>
              </div>
              <Button onClick={handleSaveLedger} disabled={isSaving || !isUnlocked} className="h-10 bg-black text-white font-black uppercase text-[10px] px-10 shadow-xl">{isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-2" />} Commit Config</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-black/10">
                {ledgerCols.map((col) => (
                  <div key={col.key} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50 transition-colors">
                    <div className="space-y-1">
                      <Label className="text-sm font-black uppercase text-indigo-700">{col.label}</Label>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{col.description}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center gap-1.5 border-r border-black/10 pr-6">
                        <Label className="text-[9px] uppercase text-slate-400 font-black">Normal Balance</Label>
                        <div className="flex items-center gap-3">
                          <span className={cn("text-[9px] font-black uppercase", !debitAccounts.includes(mapping[col.key] || "") ? "text-primary" : "text-slate-300")}>Credit</span>
                          <Switch className="data-[state=checked]:bg-indigo-600" checked={debitAccounts.includes(mapping[col.key] || "")} onCheckedChange={() => mapping[col.key] && toggleDebit(mapping[col.key])} disabled={!mapping[col.key] || !isUnlocked} />
                          <span className={cn("text-[9px] font-black uppercase", debitAccounts.includes(mapping[col.key] || "") ? "text-primary" : "text-slate-300")}>Debit</span>
                        </div>
                      </div>
                      <Select value={mapping[col.key] || "none"} onValueChange={(val) => updateMapping(col.key, val === "none" ? "" : val)} disabled={!isUnlocked}>
                        <SelectTrigger className="w-[350px] h-10 border-2 border-black font-black uppercase text-xs text-black"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-[300px] font-black uppercase text-xs">
                          <SelectItem value="none">UNMAPPED</SelectItem>
                          {coaData?.filter((a: any) => !a.isHeader).map((a: any) => (
                            <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interest" className="space-y-8 animate-in fade-in duration-500">
           <div className="grid gap-10 lg:grid-cols-12 max-w-6xl">
              <div className="lg:col-span-8 space-y-10">
                <Card className="border-4 border-black rounded-none shadow-2xl bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b-4 border-black flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-black uppercase">Interest Distribution Policy</CardTitle>
                      <CardDescription className="font-black text-[10px] uppercase text-slate-400 mt-1">Multi-tier annual profit sharing matrix</CardDescription>
                    </div>
                    <Button onClick={handleSaveInterest} disabled={isSaving || !isUnlocked} className="h-10 bg-black text-white font-black uppercase text-[10px] px-10 shadow-xl">{isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-2" />} Save Matrix</Button>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    <div className="space-y-4">
                       {interestTiers.map((tier, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-6 items-center p-6 bg-slate-50 border-2 border-black rounded-xl">
                          <div className="col-span-6 space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-500">Tier Cap Limit (৳)</Label>
                             {tier.limit === null ? (
                               <div className="h-11 flex items-center px-4 bg-slate-200 border-2 border-slate-300 rounded-lg text-slate-500 text-xs font-black uppercase italic tracking-widest">Surplus Balances</div>
                             ) : (
                               <Input type="number" className="h-11 border-2 border-black font-black text-lg tabular-nums" value={tier.limit} disabled={!isUnlocked} onKeyDown={handleNumericKeyDown} onChange={(e) => updateInterestTier(idx, { limit: Number(e.target.value) })} />
                             )}
                          </div>
                          <div className="col-span-4 space-y-2">
                             <Label className="text-[10px] font-black uppercase text-slate-500">Yield Rate (%)</Label>
                             <div className="relative">
                               <Input type="number" step="0.01" className="h-11 border-2 border-black font-black text-lg tabular-nums pr-8 text-center" value={tier.rate} disabled={!isUnlocked} onKeyDown={handleNumericKeyDown} onChange={(e) => updateInterestTier(idx, { rate: Number(e.target.value) })} />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
                             </div>
                          </div>
                          <div className="col-span-2 text-right pt-6">
                            <Button variant="ghost" size="icon" className="h-11 w-11 text-rose-300 hover:text-rose-600 hover:bg-rose-50" disabled={!isUnlocked} onClick={() => removeInterestTier(idx)}><Trash2 className="size-5" /></Button>
                          </div>
                        </div>
                       ))}
                       <Button variant="outline" className="w-full border-4 border-dashed border-slate-200 py-12 rounded-2xl gap-4 font-black uppercase text-slate-300 hover:border-black hover:text-black transition-all" disabled={!isUnlocked} onClick={addInterestTier}><Plus className="size-6" /> Append Policy Tier</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-4 border-black rounded-none shadow-2xl bg-white overflow-hidden">
                  <CardHeader className="bg-indigo-50 border-b-4 border-black">
                    <CardTitle className="text-xl font-black uppercase flex items-center gap-4 text-indigo-900"><Coins className="size-6" /> Statutory Tax Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 p-8 border-2 border-indigo-200 bg-indigo-50/20 rounded-3xl">
                      <div className="space-y-2">
                        <Label className="text-sm font-black uppercase text-indigo-900">Institutional TDS Rate (%)</Label>
                        <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest leading-relaxed">Default deduction for annual provisions.</p>
                      </div>
                      <div className="relative w-full md:w-[220px]">
                        <Input type="number" step="0.01" value={tdsRate} onKeyDown={handleNumericKeyDown} onChange={(e) => setTdsRate(Number(e.target.value))} disabled={!isUnlocked} className="h-16 border-4 border-black font-black text-3xl text-center tabular-nums pr-12 focus:bg-white" />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl font-black text-black">%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
           </div>
        </TabsContent>

        <TabsContent value="branding" className="space-y-8 animate-in fade-in duration-500">
           <Card className="max-w-2xl border-4 border-black rounded-none shadow-2xl bg-white overflow-hidden">
             <CardHeader className="bg-slate-50 border-b-4 border-black flex flex-row items-center justify-between">
               <div><CardTitle className="text-xl font-black uppercase">Institutional Branding</CardTitle></div>
               <Button onClick={handleSaveGeneral} disabled={isSaving || !isUnlocked} className="h-10 bg-black text-white font-black uppercase text-[10px] px-10 shadow-xl">{isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-2" />} Commit</Button>
             </CardHeader>
             <CardContent className="p-10 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Full PBS Identity</Label>
                  <Input value={pbsName} disabled={!isUnlocked} onChange={(e) => setPbsName(e.target.value)} className="h-14 border-2 border-black font-black text-xl uppercase px-6" />
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-black/5 flex gap-4 items-center">
                   <ShieldCheck className="size-8 text-emerald-600" />
                   <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-tight">This name will appear on all statutory reports and member ledgers.</p>
                </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
