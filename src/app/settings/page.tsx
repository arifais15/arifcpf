
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data"
import { useFirestore, useDoc, useCollection, useMemoFirebase, setDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { Loader2, Save, ShieldCheck, AlertCircle, Info, Percent, Plus, Trash2, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { LEDGER_COLUMN_MAPPING, NORMAL_DEBIT_ACCOUNTS, type LedgerColumnKey } from "@/lib/ledger-mapping"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  // Ledger Mapping Settings
  const ledgerSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "ledger"), [firestore])
  const { data: savedLedgerSettings, isLoading: isLedgerLoading } = useDoc(ledgerSettingsRef)

  // Interest Rate Settings
  const interestSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "interest"), [firestore])
  const { data: savedInterestSettings, isLoading: isInterestLoading } = useDoc(interestSettingsRef)

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore])
  const { data: coaData } = useCollection(coaRef)
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData])

  // Local State for Mapping
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [debitAccounts, setDebitAccounts] = useState<string[]>([])

  // Local State for Interest
  const [interestTiers, setInterestTiers] = useState<{ limit: number | null, rate: number }[]>([
    { limit: 1500000, rate: 13 },
    { limit: 3000000, rate: 12 },
    { limit: null, rate: 11 }
  ])

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
    if (savedInterestSettings && savedInterestSettings.tiers) {
      setInterestTiers(savedInterestSettings.tiers.map((t: any) => ({ ...t, rate: t.rate * 100 })))
    }
  }, [savedInterestSettings])

  const handleSaveLedger = () => {
    setIsSaving(true)
    setDocumentNonBlocking(ledgerSettingsRef, {
      mapping,
      debitAccounts,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    
    setTimeout(() => {
      setIsSaving(false)
      toast({ title: "Ledger Saved", description: "Mapping configuration updated successfully." })
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
      updatedAt: new Date().toISOString()
    }, { merge: true })

    setTimeout(() => {
      setIsSaving(false)
      toast({ title: "Interest Saved", description: "Interest rate tiers updated successfully." })
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
      // If the last tier was 'Above All', make it a specific limit and add a new null limit
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

  if (isLedgerLoading || isInterestLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
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
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-primary tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">Manage institutional accounting rules and parameters</p>
      </div>

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList className="bg-white p-1 rounded-xl border shadow-sm mb-8">
          <TabsTrigger value="ledger" className="px-6 py-2 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <ShieldCheck className="size-4" /> Ledger Mapping
          </TabsTrigger>
          <TabsTrigger value="interest" className="px-6 py-2 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Percent className="size-4" /> Interest Rates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid gap-8 lg:grid-cols-12">
            <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Column Mapping Configuration</CardTitle>
                  <CardDescription>Assign GL Account Codes to specific Member Ledger columns.</CardDescription>
                </div>
                <Button onClick={handleSaveLedger} disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save Mappings
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {ledgerCols.map((col) => (
                    <div key={col.key} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1">
                        <Label className="text-sm font-bold">{col.label}</Label>
                        <p className="text-xs text-muted-foreground">{col.description}</p>
                      </div>
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="flex flex-col items-center gap-1">
                          <Label className="text-[9px] uppercase text-slate-400 font-bold">Normal Balance</Label>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold", !debitAccounts.includes(mapping[col.key] || "") ? "text-primary" : "text-slate-300")}>Credit</span>
                            <Switch 
                              checked={debitAccounts.includes(mapping[col.key] || "")} 
                              onCheckedChange={() => mapping[col.key] && toggleDebit(mapping[col.key])}
                              disabled={!mapping[col.key]}
                            />
                            <span className={cn("text-[10px] font-bold", debitAccounts.includes(mapping[col.key] || "") ? "text-primary" : "text-slate-300")}>Debit</span>
                          </div>
                        </div>
                        <Select value={mapping[col.key] || "none"} onValueChange={(val) => updateMapping(col.key, val === "none" ? "" : val)}>
                          <SelectTrigger className="w-[300px]">
                            <SelectValue placeholder="Select Account Code" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="none">No Mapping</SelectItem>
                            {activeCOA.filter(a => !a.isHeader).map(a => (
                              <SelectItem key={a.code} value={a.code}>{a.code} - {a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-sm bg-blue-50/50">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Info className="size-4 text-blue-600" />
                    Ledger Sync Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs leading-relaxed text-blue-700">
                  <p>When you record a <b>Journal Entry</b> and tag a member, the system checks these mappings to decide where to post the amount.</p>
                  <p><b>Normal Balance:</b>
                    <br/>• <b>Debit:</b> Amount increases with [Debit - Credit]
                    <br/>• <b>Credit:</b> Amount increases with [Credit - Debit]
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="interest" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid gap-8 lg:grid-cols-12">
            <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Tiered Interest Policy</CardTitle>
                  <CardDescription>Configure annual profit sharing rates based on cumulative member balances.</CardDescription>
                </div>
                <Button onClick={handleSaveInterest} disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save Interest Rates
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-4 px-2 text-[10px] uppercase font-bold text-slate-400">
                    <div className="col-span-5">Balance Limit (৳)</div>
                    <div className="col-span-5">Annual Interest Rate (%)</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  
                  {interestTiers.map((tier, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="col-span-5 relative">
                        {tier.limit === null ? (
                          <div className="h-10 flex items-center px-3 bg-slate-200/50 rounded-md text-slate-500 text-sm font-bold italic">
                            Above previous limit
                          </div>
                        ) : (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">৳</span>
                            <Input 
                              type="number" 
                              className="pl-7 font-mono" 
                              value={tier.limit} 
                              onChange={(e) => updateInterestTier(idx, { limit: Number(e.target.value) })}
                            />
                          </div>
                        )}
                      </div>
                      <div className="col-span-5 relative">
                        <Input 
                          type="number" 
                          step="0.01" 
                          className="pr-8 font-mono" 
                          value={tier.rate} 
                          onChange={(e) => updateInterestTier(idx, { rate: Number(e.target.value) })}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeInterestTier(idx)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" className="w-full border-dashed border-2 py-8 rounded-xl gap-2 text-slate-500 hover:text-primary hover:border-primary/50" onClick={addInterestTier}>
                    <Plus className="size-4" /> Add Interest Tier
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-4 space-y-6">
              <Card className="border-none shadow-sm bg-accent/5">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Percent className="size-4 text-accent" />
                    How Calculation Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs leading-relaxed text-slate-600">
                  <p>Profit is computed monthly as <b>1/12th</b> of the annual rate. The rate applied depends on the tier:</p>
                  <div className="space-y-2 py-2">
                    {interestTiers.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 font-medium">
                        <ArrowRight className="size-3 text-accent" />
                        <span>{t.limit ? `Up to ৳${t.limit.toLocaleString()}` : 'Remaining balance'} at <b>{t.rate}%</b></span>
                      </div>
                    ))}
                  </div>
                  <p className="italic text-[10px] text-muted-foreground border-t pt-2 mt-2">Example: If a member has ৳2M balance, the first ৳1.5M is computed at Tier 1, and the next ৳0.5M at Tier 2.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
