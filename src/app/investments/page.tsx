
"use client"

import { useState, useMemo, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  TrendingUp, 
  Wallet, 
  Edit2, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  History as HistoryIcon, 
  Building2, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  RefreshCw,
  Calendar,
  ArrowRight,
  ShieldCheck,
  ArrowDownRight
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function InvestmentsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [editingInvestment, setEditingInvestment] = useState<any>(null);
  const [renewingInvestment, setRenewingInvestment] = useState<any>(null);
  const [viewingHistory, setViewingHistory] = useState<any>(null);

  // States for automatic date calculation in Renew dialog
  const [renewDate, setRenewDate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");

  const investmentsRef = useMemoFirebase(() => collection(firestore, "investmentInstruments"), [firestore]);
  const { data: investments, isLoading } = useCollection(investmentsRef);

  // Fetch history for selected instrument
  const historyQuery = useMemoFirebase(() => {
    if (!firestore || !viewingHistory?.id) return null;
    return query(
      collection(firestore, "investmentInstruments", viewingHistory.id, "auditHistory"),
      orderBy("createdAt", "desc")
    );
  }, [firestore, viewingHistory]);
  const { data: auditHistory, isLoading: isHistoryLoading } = useCollection(historyQuery);

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData } = useCollection(coaRef);
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData]);

  const investmentAccounts = useMemo(() => {
    return activeCOA.filter((a: any) => (a.code || a.accountCode || "").startsWith("101") && !a.isHeader);
  }, [activeCOA]);

  const filteredInvestments = useMemo(() => {
    if (!investments) return [];
    return investments.filter(inv => 
      inv.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      inv.instrumentType?.toLowerCase().includes(search.toLowerCase()) ||
      inv.bankName?.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [investments, search]);

  const stats = useMemo(() => {
    if (!investments || investments.length === 0) return { total: 0, count: 0, avgRate: 0 };
    const activeOnes = investments.filter(i => i.status === 'Active');
    const total = activeOnes.reduce((sum, inv) => sum + (Number(inv.principalAmount) || 0), 0);
    const sumRates = activeOnes.reduce((sum, inv) => sum + (Number(inv.interestRate) || 0), 0);
    return { total, count: activeOnes.length, avgRate: (sumRates / (activeOnes.length || 1)) * 100 };
  }, [investments]);

  // Handle auto-filling of dates when a renewal starts
  useEffect(() => {
    if (renewingInvestment) {
      const defaultStart = renewingInvestment.maturityDate || new Date().toISOString().split('T')[0];
      setRenewDate(defaultStart);
      
      const d = new Date(defaultStart);
      d.setFullYear(d.getFullYear() + 1);
      setMaturityDate(d.toISOString().split('T')[0]);
    }
  }, [renewingInvestment]);

  const handleRenewDateChange = (val: string) => {
    setRenewDate(val);
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      d.setFullYear(d.getFullYear() + 1);
      setMaturityDate(d.toISOString().split('T')[0]);
    }
  };

  const handleSaveInvestment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const principal = Number(formData.get("principalAmount"));
    const investmentData = {
      bankName: formData.get("bankName") as string,
      referenceNumber: formData.get("referenceNumber") as string,
      principalAmount: principal,
      initialPrincipalAmount: Number(formData.get("initialPrincipalAmount")) || principal,
      interestRate: Number(formData.get("interestRate")) / 100,
      firstOpeningDate: formData.get("firstOpeningDate") as string,
      issueDate: formData.get("issueDate") as string, 
      maturityDate: formData.get("maturityDate") as string,
      instrumentType: formData.get("instrumentType") as string,
      chartOfAccountId: formData.get("chartOfAccountId") as string,
      status: formData.get("status") as string || "Active",
      updatedAt: new Date().toISOString(),
    };

    if (editingInvestment) {
      const docRef = doc(firestore, "investmentInstruments", editingInvestment.id);
      updateDocumentNonBlocking(docRef, investmentData);
      showAlert({ 
        title: "Updated", 
        description: `Instrument ${investmentData.referenceNumber} updated.`, 
        type: "success",
        onConfirm: () => window.location.reload()
      });
    } else {
      addDocumentNonBlocking(investmentsRef, {
        ...investmentData,
        createdAt: new Date().toISOString()
      });
      showAlert({ 
        title: "Success", 
        description: `New ${investmentData.instrumentType} recorded.`, 
        type: "success",
        onConfirm: () => window.location.reload()
      });
    }
    setIsAddOpen(false);
    setEditingInvestment(null);
  };

  const handleRenewInvestment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!renewingInvestment) return;

    // 1. Create a history snapshot before updating
    const historyRef = collection(firestore, "investmentInstruments", renewingInvestment.id, "auditHistory");
    addDocumentNonBlocking(historyRef, {
      cycleLabel: "Completed Cycle",
      principalAmount: renewingInvestment.principalAmount,
      interestRate: renewingInvestment.interestRate,
      issueDate: renewingInvestment.issueDate,
      maturityDate: renewingInvestment.maturityDate,
      createdAt: new Date().toISOString(),
      type: "Renewal Snapshot"
    });

    // 2. Update current state
    const renewData = {
      principalAmount: Number(formData.get("principalAmount")),
      interestRate: Number(formData.get("interestRate")) / 100,
      issueDate: renewDate, 
      maturityDate: maturityDate,
      status: "Active",
      updatedAt: new Date().toISOString(),
    };

    const docRef = doc(firestore, "investmentInstruments", renewingInvestment.id);
    updateDocumentNonBlocking(docRef, renewData);
    
    showAlert({ 
      title: "Renewed", 
      description: "Investment cycle updated. Previous state archived for audit.", 
      type: "success",
      onConfirm: () => window.location.reload()
    });
    
    setIsRenewOpen(false);
    setRenewingInvestment(null);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        data.forEach((entry: any) => {
          const principal = Number(entry["Principal"] || entry.principalAmount || 0);
          const mapped = {
            bankName: entry["Bank Name"] || entry.bankName || "",
            referenceNumber: entry["Ref No"] || entry.referenceNumber || "",
            principalAmount: principal,
            initialPrincipalAmount: Number(entry["Initial Principal"] || entry.initialPrincipalAmount || principal),
            interestRate: Number(entry["Rate"] || entry.interestRate || 0) / 100,
            firstOpeningDate: entry["First Opening Date"] || entry.firstOpeningDate || entry["Issue Date"] || "",
            issueDate: entry["Renew Date"] || entry.issueDate || "",
            maturityDate: entry["Maturity Date"] || entry.maturityDate || "",
            instrumentType: entry["Instrument Type"] || entry.instrumentType || "FDR",
            chartOfAccountId: entry["chartOfAccountId"] || entry.chartOfAccountId || "101.10.0000",
            status: entry["Status"] || entry.status || "Active",
            updatedAt: new Date().toISOString()
          };
          if (mapped.bankName) addDocumentNonBlocking(investmentsRef, mapped);
        });
        showAlert({ title: "Success", description: "Bulk processing complete.", type: "success", onConfirm: () => window.location.reload() });
      } catch (err) { toast({ title: "Upload Failed", variant: "destructive" }); }
      finally { setIsUploading(false); setIsBulkOpen(false); }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Bank Name": "Sonali Bank PLC",
        "Ref No": "FDR-2024-001",
        "Principal": 1000000,
        "Initial Principal": 1000000,
        "Rate": 12.5,
        "First Opening Date": "2020-01-01",
        "Renew Date": "2024-01-01",
        "Maturity Date": "2025-01-01",
        "Instrument Type": "FDR",
        "chartOfAccountId": "101.10.0000",
        "Status": "Active"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Investments");
    XLSX.writeFile(wb, "investments_lifecycle_template.xlsx");
    toast({ title: "Template Downloaded" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="size-3" /> Active</Badge>;
      case 'Matured': return <Badge variant="outline" className="text-orange-600 border-orange-200 gap-1"><Clock className="size-3" /> Matured</Badge>;
      case 'Closed': return <Badge variant="secondary" className="gap-1"><AlertCircle className="size-3" /> Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex items-center justify-between no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Investment Portfolio</h1>
          <p className="text-muted-foreground">Managing institutional certificates with lifecycle tracking and audit history</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild><Button variant="outline" className="gap-2 border-slate-300"><Upload className="size-4" /> Bulk Upload</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Bulk Upload Investments</DialogTitle>
                  <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="h-7 text-[10px] font-bold gap-1 uppercase hover:bg-primary/5">
                    <Download className="size-3" /> Template
                  </Button>
                </div>
                <DialogDescription>
                  Upload your XLSX file. Ensure lifecycle dates and initial principal tracking are handled correctly.
                </DialogDescription>
              </DialogHeader>
              <div className="p-12 border-2 border-dashed rounded-xl text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="size-8 mx-auto mb-2 text-primary opacity-50" />
                <p className="font-bold">Select XLSX Investment File</p>
                <input type="file" className="hidden" ref={fileInputRef} onChange={handleExcelUpload} disabled={isUploading} accept=".xlsx" />
                {isUploading && <Loader2 className="size-4 animate-spin mx-auto mt-4" />}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingInvestment(null); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" /> New Investment</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>{editingInvestment ? "Edit" : "Add"} Investment Record</DialogTitle></DialogHeader>
              <form onSubmit={handleSaveInvestment} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2"><Label>Bank Name</Label><Input name="bankName" defaultValue={editingInvestment?.bankName} required /></div>
                  <div className="space-y-2"><Label>Ref No (Reference)</Label><Input name="referenceNumber" defaultValue={editingInvestment?.referenceNumber} required /></div>
                  <div className="space-y-2">
                    <Label>Instrument Type</Label>
                    <Select name="instrumentType" defaultValue={editingInvestment?.instrumentType || "FDR"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FDR">FDR</SelectItem>
                        <SelectItem value="Savings Certificate">Savings Certificate</SelectItem>
                        <SelectItem value="Govt. Treasury Bond">Govt. Treasury Bond</SelectItem>
                        <SelectItem value="Other">Other Investment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Current Principal (৳)</Label>
                    <Input name="principalAmount" type="number" step="0.01" defaultValue={editingInvestment?.principalAmount} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Initial Principal (৳)</Label>
                    <Input name="initialPrincipalAmount" type="number" step="0.01" defaultValue={editingInvestment?.initialPrincipalAmount} />
                  </div>
                  <div className="space-y-2"><Label>Interest Rate (%)</Label><Input name="interestRate" type="number" step="0.01" defaultValue={editingInvestment ? (editingInvestment.interestRate * 100).toFixed(2) : ""} required /></div>
                  
                  <div className="col-span-2 grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500">First Opening</Label><Input name="firstOpeningDate" type="date" defaultValue={editingInvestment?.firstOpeningDate || editingInvestment?.issueDate} required /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500">Cycle Issue/Renew</Label><Input name="issueDate" type="date" defaultValue={editingInvestment?.issueDate} required /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-500">Maturity Date</Label><Input name="maturityDate" type="date" defaultValue={editingInvestment?.maturityDate} /></div>
                  </div>

                  <div className="space-y-2">
                    <Label>GL Account Code</Label>
                    <Select name="chartOfAccountId" defaultValue={editingInvestment?.chartOfAccountId || "101.10.0000"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} - {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select name="status" defaultValue={editingInvestment?.status || "Active"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Matured">Matured</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button><Button type="submit">Save Instrument</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 no-print">
        <Card className="bg-primary/5 border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest">Active Principal</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">৳ {stats.total.toLocaleString()}</div></CardContent></Card>
        <Card className="bg-accent/5 border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-accent tracking-widest">Weighted Yield</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.avgRate.toFixed(2)}%</div></CardContent></Card>
        <Card className="bg-emerald-50 border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-emerald-600 tracking-widest">Active Instruments</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.count} Certificates</div></CardContent></Card>
      </div>

      <div className="bg-card rounded-xl shadow-sm border overflow-hidden no-print">
        <div className="p-4 border-b bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9 h-10 bg-white" placeholder="Search portfolio..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Bank & Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Principal (৳)</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-center">Timeline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredInvestments.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredInvestments.map((inv) => (
              <TableRow key={inv.id} className="hover:bg-slate-50 transition-colors">
                <TableCell><div className="flex flex-col"><span className="font-bold">{inv.bankName}</span><span className="font-mono text-[10px] text-muted-foreground">{inv.referenceNumber}</span></div></TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px] uppercase font-bold">{inv.instrumentType}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-sm">৳ {Number(inv.principalAmount).toLocaleString()}</span>
                    <span className="text-[9px] text-muted-foreground uppercase font-medium">Initial: ৳{Number(inv.initialPrincipalAmount || inv.principalAmount).toLocaleString()}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-accent font-semibold">{(Number(inv.interestRate) * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2 text-[10px]">
                    <div className="flex flex-col items-center">
                      <span className="text-slate-400 font-bold uppercase">Opening</span>
                      <span>{inv.firstOpeningDate || inv.issueDate}</span>
                    </div>
                    <ArrowRight className="size-3 text-slate-300" />
                    <div className="flex flex-col items-center">
                      <span className="text-primary font-bold uppercase">Renewed</span>
                      <span>{inv.issueDate}</span>
                    </div>
                    <ArrowRight className="size-3 text-slate-300" />
                    <div className="flex flex-col items-center">
                      <span className="text-rose-500 font-bold uppercase">Maturity</span>
                      <span className="font-bold">{inv.maturityDate || "N/A"}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(inv.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600" title="Audit History" onClick={() => { setViewingHistory(inv); setIsHistoryOpen(true); }}><HistoryIcon className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Renew" onClick={() => { setRenewingInvestment(inv); setIsRenewOpen(true); }}><RefreshCw className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingInvestment(inv); setIsAddOpen(true); }}><Edit2 className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { showAlert({ title: "Delete?", type: "warning", showCancel: true, onConfirm: () => { deleteDocumentNonBlocking(doc(firestore, "investmentInstruments", inv.id)); window.location.reload(); } }); }}><Trash2 className="size-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* RENEW DIALOG */}
      <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="size-5 text-primary" />
              Renew Investment Cycle
            </DialogTitle>
            <DialogDescription>
              Preserving original Inception Principal: <b>৳{renewingInvestment?.initialPrincipalAmount?.toLocaleString()}</b>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenewInvestment} className="space-y-4 pt-4">
            <div className="grid gap-4">
              <div className="space-y-2"><Label>New Principal (৳)</Label><Input name="principalAmount" type="number" step="0.01" defaultValue={renewingInvestment?.principalAmount} required /></div>
              <div className="space-y-2"><Label>New Interest Rate (%)</Label><Input name="interestRate" type="number" step="0.01" defaultValue={renewingInvestment ? (renewingInvestment.interestRate * 100).toFixed(2) : ""} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Renew Date</Label><Input name="renewDate" type="date" required value={renewDate} onChange={(e) => handleRenewDateChange(e.target.value)} /></div>
                <div className="space-y-2"><Label>New Maturity Date</Label><Input name="maturityDate" type="date" required value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRenewOpen(false)}>Cancel</Button>
              <Button type="submit" className="gap-2">Confirm Renewal</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AUDIT HISTORY DIALOG */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto font-ledger">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <ShieldCheck className="size-6 text-primary" />
              Audit Trail: {viewingHistory?.bankName}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              Reference: {viewingHistory?.referenceNumber} • Inception: {viewingHistory?.firstOpeningDate}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Inception Principal</p>
                <p className="text-xl font-black text-slate-900">৳ {viewingHistory?.initialPrincipalAmount?.toLocaleString()}</p>
              </div>
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                <p className="text-[10px] uppercase font-bold text-primary opacity-60 mb-1">Current Principal</p>
                <p className="text-xl font-black text-primary">৳ {viewingHistory?.principalAmount?.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 px-1">
                <Clock className="size-4 text-slate-400" />
                Lifecycle Timeline (Previous Cycles)
              </h3>
              
              <div className="relative pl-8 space-y-6 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {/* Current State Indicator */}
                <div className="relative">
                  <div className="absolute -left-8 top-1 size-7 rounded-full bg-primary flex items-center justify-center border-4 border-white shadow-sm">
                    <CheckCircle2 className="size-3 text-white" />
                  </div>
                  <div className="bg-white p-4 rounded-xl border-2 border-primary shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge className="mb-2 bg-primary">CURRENT ACTIVE CYCLE</Badge>
                        <p className="text-sm font-bold">৳ {viewingHistory?.principalAmount?.toLocaleString()} @ {(viewingHistory?.interestRate * 100).toFixed(2)}%</p>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground uppercase font-black">
                        {viewingHistory?.issueDate} <ArrowRight className="inline size-2 mx-1" /> {viewingHistory?.maturityDate}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Historical Snapshots */}
                {isHistoryLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-slate-300" /></div>
                ) : (!auditHistory || auditHistory.length === 0) ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed">
                    <Info className="size-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No previous renewal history found</p>
                  </div>
                ) : auditHistory.map((h, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-8 top-1 size-7 rounded-full bg-slate-100 flex items-center justify-center border-4 border-white">
                      <div className="size-1.5 rounded-full bg-slate-400" />
                    </div>
                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-start opacity-70">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{h.cycleLabel || "Archived Record"}</p>
                          <p className="text-xs font-bold">৳ {h.principalAmount?.toLocaleString()} @ {(h.interestRate * 100).toFixed(2)}%</p>
                        </div>
                        <div className="text-right text-[10px] font-mono text-slate-500">
                          {h.issueDate} <ArrowRight className="inline size-2 mx-1" /> {h.maturityDate}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Original Opening Marker */}
                <div className="relative">
                  <div className="absolute -left-8 top-1 size-7 rounded-full bg-emerald-50 flex items-center justify-center border-4 border-white">
                    <ArrowDownRight className="size-3 text-emerald-600" />
                  </div>
                  <div className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100">
                    <p className="text-[10px] font-black uppercase text-emerald-600 mb-1">ORIGINAL INCEPTION</p>
                    <p className="text-xs font-bold">Investment Opened on {viewingHistory?.firstOpeningDate}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-4 border-t">
            <Button variant="ghost" onClick={() => setIsHistoryOpen(false)}>Close Audit View</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
