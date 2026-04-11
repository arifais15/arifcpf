
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data"
import { useFirestore, useDoc, useCollection, useMemoFirebase, setDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { Loader2, Save, ShieldCheck, AlertCircle, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { LEDGER_COLUMN_MAPPING, NORMAL_DEBIT_ACCOUNTS, type LedgerColumnKey } from "@/lib/ledger-mapping"

export default function SettingsPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const settingsRef = useMemoFirebase(() => doc(firestore, "settings", "ledger"), [firestore])
  const { data: savedSettings, isLoading: isSettingsLoading } = useDoc(settingsRef)

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore])
  const { data: coaData } = useCollection(coaRef)
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData])

  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [debitAccounts, setDebitAccounts] = useState<string[]>([])

  useEffect(() => {
    if (savedSettings) {
      setMapping(savedSettings.mapping || {})
      setDebitAccounts(savedSettings.debitAccounts || [])
    } else {
      // Load defaults from file if no firestore settings exist yet
      const defaultMapping: Record<string, string> = {}
      Object.entries(LEDGER_COLUMN_MAPPING).forEach(([code, col]) => {
        defaultMapping[col] = code
      })
      setMapping(defaultMapping)
      setDebitAccounts(NORMAL_DEBIT_ACCOUNTS)
    }
  }, [savedSettings])

  const handleSave = () => {
    setIsSaving(true)
    setDocumentNonBlocking(settingsRef, {
      mapping,
      debitAccounts,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    
    setTimeout(() => {
      setIsSaving(false)
      toast({ title: "Settings Saved", description: "Ledger mapping configuration updated successfully." })
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

  if (isSettingsLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>
  }

  const columns = [
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
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">System Settings</h1>
          <p className="text-muted-foreground">Configure General Ledger to Subsidiary Ledger mapping</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2 px-8">
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Configuration
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-8 border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Column Mapping Configuration
            </CardTitle>
            <CardDescription>Assign GL Account Codes to specific Member Ledger columns.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {columns.map((col) => (
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
                How it works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs leading-relaxed text-blue-700">
              <p>When you record a <b>Journal Entry</b> and tag a member, the system checks these mappings to decide where to post the amount.</p>
              <p><b>Normal Balance:</b>
                <br/>• <b>Debit:</b> Amount increases with [Debit - Credit]
                <br/>• <b>Credit:</b> Amount increases with [Credit - Debit]
              </p>
              <p>Asset accounts (like Loans) are usually <b>Debit</b>. Equity/Liability accounts (like Contributions) are usually <b>Credit</b>.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-orange-50/50">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertCircle className="size-4 text-orange-600" />
                Audit Note
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed text-orange-700">
              Changing these mappings will not retroactively change existing ledger records. It only affects <b>new</b> transactions posted after saving.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
