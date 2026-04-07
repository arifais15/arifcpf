
"use client"

import { useState, useMemo } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  TrendingUp, 
  Calendar, 
  Wallet, 
  Edit2, 
  Trash2, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Calculator,
  Building2,
  ArrowRight
} from "lucide-react";
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking 
} from "@/firebase";
import { collection, doc, query, where, orderBy } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function InvestmentsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<any>(null);
  const [selectedForProvision, setSelectedForProvision] = useState<any>(null);
  const [selectedForHistory, setSelectedForHistory] = useState<any>(null);

  const investmentsRef = useMemoFirebase(() => collection(firestore, "investmentInstruments"), [firestore]);
  const { data: investments, isLoading } = useCollection(investmentsRef);

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData } = useCollection(coaRef);
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData]);

  const accrualsRef = useMemoFirebase(() => collection(firestore, "accruedInterestLogs"), [firestore]);
  const { data: allAccruals } = useCollection(accrualsRef);

  const investmentAccounts = useMemo(() => {
    return activeCOA.filter((a: any) => (a.code || a.accountCode || "").startsWith("101") && !a.isHeader);
  }, [activeCOA]);

  const filteredInvestments = useMemo(() => {
    return (investments || []).filter(inv => 
      inv.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      inv.instrumentType?.toLowerCase().includes(search.toLowerCase()) ||
      inv.bankName?.toLowerCase().includes(search.toLowerCase())
    );
  }, [investments, search]);

  const stats = useMemo(() => {
    if (!investments || investments.length === 0) return { total: 0, count: 0, avgRate: 0 };
    const total = investments.reduce((sum, inv) => sum + (Number(inv.principalAmount) || 0), 0);
    const sumRates = investments.reduce((sum, inv) => sum + (Number(inv.interestRate) || 0), 0);
    return {
      total,
      count: investments.length,
      avgRate: (sumRates / investments.length) * 100
    };
  }, [investments]);

  const handleSaveInvestment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const investmentData = {
      bankName: formData.get("bankName") as string,
      chartOfAccountId: formData.get("chartOfAccountId") as string,
      instrumentType: formData.get("instrumentType") as string,
      referenceNumber: formData.get("referenceNumber") as string,
      issueDate: formData.get("issueDate") as string,
      maturityDate: formData.get("maturityDate") as string,
      principalAmount: Number(formData.get("principalAmount")),
      interestRate: Number(formData.get("interestRate")) / 100,
      accrualFrequency: formData.get("accrualFrequency") as string,
      status: formData.get("status") as string,
      updatedAt: new Date().toISOString(),
    };

    if (editingInvestment) {
      const docRef = doc(firestore, "investmentInstruments", editingInvestment.id);
      updateDocumentNonBlocking(docRef, investmentData);
      toast({ title: "Updated", description: `Instrument ${investmentData.referenceNumber} modified.` });
    } else {
      addDocumentNonBlocking(investmentsRef, investmentData);
      toast({ title: "Recorded", description: `New ${investmentData.instrumentType} added.` });
    }
    setIsAddOpen(false);
    setEditingInvestment(null);
  };

  const handleProvisionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedForProvision) return;

    const formData = new FormData(e.currentTarget);
    const periodStart = formData.get("periodStart") as string;
    const periodEnd = formData.get("periodEnd") as string;

    const principal = Number(selectedForProvision.principalAmount);
    const rate = Number(selectedForProvision.interestRate);
    
    // Simple Quarterly Provision Logic: (Principal * Rate) / 4
    const grossAmount = (principal * rate) / 4;
    const tdsAmount = grossAmount * 0.10;
    const netAmount = grossAmount - tdsAmount;

    const accrualLog = {
      accrualDate: new Date().toISOString().split('T')[0],
      chartOfAccountId: selectedForProvision.chartOfAccountId,
      sourceId: selectedForProvision.id,
      sourceType: 'InvestmentInstrument',
      grossAmount,
      tdsAmount,
      netAmount,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
      isPostedToGL: false
    };

    addDocumentNonBlocking(accrualsRef, accrualLog);
    toast({ 
      title: "Provision Recorded", 
      description: `Gross: ৳${grossAmount.toFixed(2)}, TDS (10%): ৳${tdsAmount.toFixed(2)}` 
    });
    setIsProvisionOpen(false);
    setSelectedForProvision(null);
  };

  const handleDelete = (id: string, ref: string) => {
    if (confirm(`Are you sure you want to remove investment ${ref}?`)) {
      const docRef = doc(firestore, "investmentInstruments", id);
      deleteDocumentNonBlocking(docRef);
      toast({ title: "Removed", description: "Investment deleted." });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="size-3" /> Active</Badge>;
      case 'Matured': return <Badge variant="outline" className="text-orange-600 border-orange-200 gap-1"><Clock className="size-3" /> Matured</Badge>;
      case 'Closed': return <Badge variant="secondary" className="gap-1"><AlertCircle className="size-3" /> Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const instrumentHistory = useMemo(() => {
    if (!selectedForHistory || !allAccruals) return [];
    return allAccruals
      .filter(a => a.sourceId === selectedForHistory.id)
      .sort((a, b) => new Date(b.accrualDate).getTime() - new Date(a.accrualDate).getTime());
  }, [selectedForHistory, allAccruals]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Investment Portfolio</h1>
          <p className="text-muted-foreground">Manage FDRs, Bonds and Savings Certificates with Bank tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingInvestment(null); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> New Investment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingInvestment ? "Edit Investment" : "Add New Investment"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveInvestment} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Bank / Institution Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input name="bankName" className="pl-9" placeholder="e.g. Agrani Bank Ltd." defaultValue={editingInvestment?.bankName} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Instrument Category (COA)</Label>
                    <Select name="chartOfAccountId" defaultValue={editingInvestment?.chartOfAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(acc => (
                          <SelectItem key={acc.code || acc.accountCode} value={acc.code || acc.accountCode}>{acc.code || acc.accountCode} - {acc.name || acc.accountName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Instrument Type</Label>
                    <Select name="instrumentType" defaultValue={editingInvestment?.instrumentType || "FDR"}>
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FDR">FDR</SelectItem>
                        <SelectItem value="Savings Certificate">Savings Certificate</SelectItem>
                        <SelectItem value="Govt. Treasury Bond">Govt. Treasury Bond</SelectItem>
                        <SelectItem value="Mutual Fund">Mutual Fund</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference / Cert No.</Label>
                    <Input name="referenceNumber" defaultValue={editingInvestment?.referenceNumber} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Principal Amount (৳)</Label>
                    <Input name="principalAmount" type="number" step="0.01" defaultValue={editingInvestment?.principalAmount} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Issue Date</Label>
                    <Input name="issueDate" type="date" defaultValue={editingInvestment?.issueDate} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Maturity Date</Label>
                    <Input name="maturityDate" type="date" defaultValue={editingInvestment?.maturityDate} />
                  </div>
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <Input name="interestRate" type="number" step="0.01" defaultValue={(editingInvestment?.interestRate * 100) || ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select name="status" defaultValue={editingInvestment?.status || "Active"}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Matured">Matured</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Instrument</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Principal Invested</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary flex items-center gap-2">
              <Wallet className="size-5 opacity-50" />
              ৳ {stats.total.toLocaleString('en-BD', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Weighted Avg Yield</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent flex items-center gap-2">
              <TrendingUp className="size-5 opacity-50" />
              {stats.avgRate.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Active Instruments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="size-5 opacity-50 text-emerald-500" />
              {stats.count} Certificates
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              className="pl-9 h-10 max-w-sm bg-white" 
              placeholder="Search by Bank, Ref No. or Type..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Bank & Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Principal (৳)</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Maturity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Provisions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : filteredInvestments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No investment instruments found.
                </TableCell>
              </TableRow>
            ) : filteredInvestments.map((inv) => (
              <TableRow key={inv.id} className="group hover:bg-slate-50">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-sm">{inv.bankName || "Unknown Bank"}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">Ref: {inv.referenceNumber}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs font-medium">{inv.instrumentType}</TableCell>
                <TableCell className="font-bold text-right">৳ {Number(inv.principalAmount).toLocaleString()}</TableCell>
                <TableCell className="text-accent font-semibold text-right">{(Number(inv.interestRate) * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-xs">{inv.maturityDate || "N/A"}</TableCell>
                <TableCell>{getStatusBadge(inv.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-2 text-[10px] gap-1 border-primary/20 hover:bg-primary/10"
                      onClick={() => { setSelectedForProvision(inv); setIsProvisionOpen(true); }}
                    >
                      <Calculator className="size-3" /> Accrue
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => { setSelectedForHistory(inv); setIsHistoryOpen(true); }}
                    >
                      <History className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingInvestment(inv); setIsAddOpen(true); }}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(inv.id, inv.referenceNumber)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Provision Dialog */}
      <Dialog open={isProvisionOpen} onOpenChange={setIsProvisionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accrue Quarterly Interest</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedForProvision && (
              <div className="bg-slate-50 p-3 rounded-lg border text-sm space-y-1">
                <p className="flex justify-between"><span>Bank:</span> <b>{selectedForProvision.bankName}</b></p>
                <p className="flex justify-between"><span>Principal:</span> <b>৳ {selectedForProvision.principalAmount.toLocaleString()}</b></p>
                <p className="flex justify-between"><span>Rate:</span> <b>{(selectedForProvision.interestRate * 100).toFixed(2)}%</b></p>
              </div>
            )}
            <form onSubmit={handleProvisionSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Period Start</Label>
                  <Input name="periodStart" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label>Period End</Label>
                  <Input name="periodEnd" type="date" required />
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs mb-1">
                  <Calculator className="size-4" /> Logic Applied:
                </div>
                <p className="text-[10px] text-blue-600 leading-tight">
                  Calculation: (Principal × Rate) ÷ 4 quarters.<br/>
                  <b>Tax Deduction:</b> 10% TDS will be automatically applied to the gross amount.
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsProvisionOpen(false)}>Cancel</Button>
                <Button type="submit" className="gap-2">
                  <ArrowRight className="size-4" /> Process Provision
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              Accrual History: {selectedForHistory?.referenceNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Accrual Date</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Gross (৳)</TableHead>
                  <TableHead className="text-right">TDS (10%)</TableHead>
                  <TableHead className="text-right">Net (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instrumentHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No accruals recorded yet.</TableCell>
                  </TableRow>
                ) : instrumentHistory.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{log.accrualDate}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      {log.periodStartDate} to {log.periodEndDate}
                    </TableCell>
                    <TableCell className="text-right font-medium">৳ {log.grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right text-rose-600 text-xs">৳ {log.tdsAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">৳ {log.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
