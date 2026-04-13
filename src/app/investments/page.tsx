
"use client"

import { useState, useMemo, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  TrendingUp, 
  Edit2, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  History as HistoryIcon, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  ArrowDownRight,
  Info,
  HandCoins,
  CalendarClock
} from "lucide-react";
import Link from "next/link";
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

  const [renewDate, setRenewDate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");

  const [formPrincipal, setFormPrincipal] = useState<string>("");
  const [formInitialPrincipal, setFormInitialPrincipal] = useState<string>("");
  const [formOpeningDate, setFormOpeningDate] = useState<string>("");
  const [formIssueDate, setFormIssueDate] = useState<string>("");

  const investmentsRef = useMemoFirebase(() => collection(firestore, "investmentInstruments"), [firestore]);
  const { data: investments, isLoading } = useCollection(investmentsRef);

  useEffect(() => {
    if (editingInvestment) {
      setFormPrincipal(editingInvestment.principalAmount?.toString() || "");
      setFormInitialPrincipal(editingInvestment.initialPrincipalAmount?.toString() || "");
      setFormOpeningDate(editingInvestment.firstOpeningDate || "");
      setFormIssueDate(editingInvestment.issueDate || "");
    } else {
      setFormPrincipal("");
      setFormInitialPrincipal("");
      setFormOpeningDate("");
      setFormIssueDate("");
    }
  }, [editingInvestment, isAddOpen]);

  const uniqueBankNames = useMemo(() => {
    if (!investments) return [];
    const names = new Set(investments.map(i => i.bankName).filter(Boolean));
    return Array.from(names).sort();
  }, [investments]);

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
      showAlert({ title: "Updated", description: `Instrument ${investmentData.referenceNumber} updated.`, type: "success" });
    } else {
      addDocumentNonBlocking(investmentsRef, { ...investmentData, createdAt: new Date().toISOString() });
      showAlert({ title: "Success", description: `New ${investmentData.instrumentType} recorded.`, type: "success" });
    }
    setIsAddOpen(false);
    setEditingInvestment(null);
  };

  const handleRenewInvestment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!renewingInvestment) return;

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

    const renewData = {
      principalAmount: Number(formData.get("principalAmount")),
      interestRate: Number(formData.get("interestRate")) / 100,
      issueDate: renewDate, 
      maturityDate: maturityDate,
      status: "Active",
      updatedAt: new Date().toISOString(),
    };

    updateDocumentNonBlocking(doc(firestore, "investmentInstruments", renewingInvestment.id), renewData);
    showAlert({ title: "Renewed", description: "Investment cycle updated. History archived.", type: "success" });
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
        showAlert({ title: "Success", description: "Bulk processing complete.", type: "success" });
      } catch (err) { toast({ title: "Upload Failed", variant: "destructive" }); }
      finally { setIsUploading(false); setIsBulkOpen(false); }
    };
    reader.readAsBinaryString(file);
  };

  const exportToExcel = () => {
    if (filteredInvestments.length === 0) return;
    const data = filteredInvestments.map(inv => ({
      "Bank Name": inv.bankName,
      "Reference Number": inv.referenceNumber,
      "Instrument Type": inv.instrumentType,
      "Principal Amount": inv.principalAmount,
      "Initial Principal": inv.initialPrincipalAmount || inv.principalAmount,
      "Interest Rate (%)": (Number(inv.interestRate) * 100).toFixed(2),
      "First Opening Date": inv.firstOpeningDate || inv.issueDate,
      "Issue/Renew Date": inv.issueDate,
      "Maturity Date": inv.maturityDate || "N/A",
      "Status": inv.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Investments");
    XLSX.writeFile(wb, `Investment_Portfolio_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Exported", description: "Portfolio data saved to Excel." });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-black"><CheckCircle2 className="size-3" /> Active</Badge>;
      case 'Matured': return <Badge variant="outline" className="text-orange-600 border-orange-200 gap-1 font-black"><Clock className="size-3" /> Matured</Badge>;
      case 'Closed': return <Badge variant="secondary" className="gap-1 font-black"><AlertCircle className="size-3" /> Closed</Badge>;
      default: return <Badge variant="outline" className="font-black">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-black text-primary tracking-tight">Investment Portfolio</h1>
          <p className="text-lg font-bold text-slate-600">Managing institutional certificates with lifecycle tracking and audit history</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border shadow-sm">
            <Button variant="ghost" asChild className="gap-2 text-amber-700 hover:bg-amber-50 font-black h-9 text-xs">
              <Link href="/reports/maturity-summary">
                <CalendarClock className="size-4" /> Provision Report
              </Link>
            </Button>
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <Button variant="ghost" asChild className="gap-2 text-indigo-700 hover:bg-indigo-50 font-black h-9 text-xs">
              <Link href="/investments/provisions">
                <HandCoins className="size-4" /> Interest Provisions
              </Link>
            </Button>
          </div>

          <Button variant="outline" onClick={exportToExcel} disabled={filteredInvestments.length === 0} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-black h-11 text-base">
            <FileSpreadsheet className="size-5" /> Export Excel
          </Button>

          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild><Button variant="outline" className="gap-2 border-slate-300 font-black h-11 text-base"><Upload className="size-5" /> Bulk Upload</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-2xl font-black">Bulk Upload Investments</DialogTitle>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const templateData = [{ "Bank Name": "Sonali Bank PLC", "Ref No": "FDR-2024-001", "Principal": 1000000, "Initial Principal": 1000000, "Rate": 12.5, "First Opening Date": "2020-01-01", "Renew Date": "2024-01-01", "Maturity Date": "2025-01-01", "Instrument Type": "FDR", "chartOfAccountId": "101.10.0000", "Status": "Active" }];
                    const ws = XLSX.utils.json_to_sheet(templateData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Investments");
                    XLSX.writeFile(wb, "investments_lifecycle_template.xlsx");
                  }} className="h-8 text-xs font-black gap-1 uppercase hover:bg-primary/5"><Download className="size-4" /> Template</Button>
                </div>
                <DialogDescription className="text-sm font-bold text-slate-500">Upload your XLSX file. Lifecycle dates and initial principal tracking are required.</DialogDescription>
              </DialogHeader>
              <div className="p-12 border-2 border-dashed rounded-2xl text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="size-12 mx-auto mb-4 text-primary opacity-50" />
                <p className="text-lg font-black">Select XLSX Investment File</p>
                <input type="file" className="hidden" ref={fileInputRef} onChange={handleExcelUpload} disabled={isUploading} accept=".xlsx" />
                {isUploading && <Loader2 className="size-6 animate-spin mx-auto mt-4" />}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingInvestment(null); }}>
            <DialogTrigger asChild><Button className="gap-2 h-11 text-base font-black"><Plus className="size-5" /> New Investment</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle className="text-2xl font-black">{editingInvestment ? "Edit" : "Add"} Investment Record</DialogTitle></DialogHeader>
              <form onSubmit={handleSaveInvestment} className="space-y-6 pt-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-sm font-black">Bank Name</Label>
                    <Input 
                      name="bankName" 
                      list="bank-names" 
                      defaultValue={editingInvestment?.bankName} 
                      className="h-11 font-bold" 
                      required 
                    />
                    <datalist id="bank-names">
                      {uniqueBankNames.map(name => <option key={name} value={name} />)}
                    </datalist>
                  </div>
                  <div className="space-y-2"><Label className="text-sm font-black">Ref No (Reference)</Label><Input name="referenceNumber" defaultValue={editingInvestment?.referenceNumber} className="h-11 font-bold" required /></div>
                  <div className="space-y-2">
                    <Label className="text-sm font-black">Instrument Type</Label>
                    <Select name="instrumentType" defaultValue={editingInvestment?.instrumentType || "FDR"}>
                      <SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FDR" className="font-bold">FDR</SelectItem>
                        <SelectItem value="Savings Certificate" className="font-bold">Savings Certificate</SelectItem>
                        <SelectItem value="Govt. Treasury Bond" className="font-bold">Govt. Treasury Bond</SelectItem>
                        <SelectItem value="Other" className="font-bold">Other Investment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-black">Current Principal (৳)</Label>
                    <Input 
                      name="principalAmount" 
                      type="number" 
                      step="0.01" 
                      value={formPrincipal} 
                      onChange={(e) => { 
                        setFormPrincipal(e.target.value); 
                        if (!editingInvestment) setFormInitialPrincipal(e.target.value); 
                      }} 
                      className="h-11 font-bold" 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-black">Initial Principal (৳)</Label>
                    <Input 
                      name="initialPrincipalAmount" 
                      type="number" 
                      step="0.01" 
                      value={formInitialPrincipal} 
                      onChange={(e) => setFormInitialPrincipal(e.target.value)} 
                      className="h-11 font-bold" 
                    />
                  </div>
                  <div className="space-y-2"><Label className="text-sm font-black">Interest Rate (%)</Label><Input name="interestRate" type="number" step="0.01" defaultValue={editingInvestment ? (editingInvestment.interestRate * 100).toFixed(2) : ""} className="h-11 font-bold" required /></div>
                  
                  <div className="col-span-2 grid grid-cols-3 gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="space-y-2">
                      <Label className="text-[11px] uppercase font-black text-slate-500">First Opening</Label>
                      <Input 
                        name="firstOpeningDate" 
                        type="date" 
                        value={formOpeningDate} 
                        onChange={(e) => { 
                          setFormOpeningDate(e.target.value); 
                          if (!editingInvestment) setFormIssueDate(e.target.value); 
                        }} 
                        className="font-bold" 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] uppercase font-black text-slate-500">Cycle Issue/Renew</Label>
                      <Input 
                        name="issueDate" 
                        type="date" 
                        value={formIssueDate} 
                        onChange={(e) => setFormIssueDate(e.target.value)} 
                        className="font-bold" 
                        required 
                      />
                    </div>
                    <div className="space-y-2"><Label className="text-[11px] uppercase font-black text-slate-500">Maturity Date</Label><Input name="maturityDate" type="date" defaultValue={editingInvestment?.maturityDate} className="font-bold" /></div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-black">GL Account Code</Label>
                    <Select name="chartOfAccountId" defaultValue={editingInvestment?.chartOfAccountId || "101.10.0000"}>
                      <SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => <SelectItem key={a.code} value={a.code} className="font-bold">{a.code} - {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-black">Status</Label>
                    <Select name="status" defaultValue={editingInvestment?.status || "Active"}>
                      <SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active" className="font-bold text-emerald-600">Active</SelectItem>
                        <SelectItem value="Matured" className="font-bold text-orange-600">Matured</SelectItem>
                        <SelectItem value="Closed" className="font-bold text-slate-600">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="gap-3 pt-4"><Button type="button" variant="outline" className="h-11 font-black px-8" onClick={() => setIsAddOpen(false)}>Cancel</Button><Button type="submit" className="h-11 font-black px-10">Save Instrument</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 no-print">
        <Card className="bg-primary/5 border-none shadow-sm rounded-3xl"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-primary tracking-widest opacity-70">Active Principal</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-900">৳ {stats.total.toLocaleString()}</div></CardContent></Card>
        <Card className="bg-accent/5 border-none shadow-sm rounded-3xl"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-accent tracking-widest opacity-70">Weighted Yield</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-900">{stats.avgRate.toFixed(2)}%</div></CardContent></Card>
        <Card className="bg-emerald-50 border-none shadow-sm rounded-3xl"><CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase text-emerald-600 tracking-widest opacity-70">Active Instruments</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-900">{stats.count} Certificates</div></CardContent></Card>
      </div>

      <div className="bg-card rounded-2xl shadow-lg border overflow-hidden no-print">
        <div className="p-6 border-b bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input className="pl-10 h-12 bg-white text-base font-bold shadow-sm" placeholder="Search portfolio (Bank, Ref, Type)..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-black text-sm py-5">Bank & Reference</TableHead>
              <TableHead className="font-black text-sm py-5">Type</TableHead>
              <TableHead className="text-right font-black text-sm py-5">Principal (৳)</TableHead>
              <TableHead className="text-right font-black text-sm py-5">Rate</TableHead>
              <TableHead className="text-center font-black text-sm py-5">Lifecycle Timeline</TableHead>
              <TableHead className="font-black text-sm py-5">Status</TableHead>
              <TableHead className="text-right font-black text-sm py-5 pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredInvestments.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredInvestments.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-32 text-slate-400 font-bold text-lg italic">No records found.</TableCell></TableRow>
            ) : filteredInvestments.map((inv) => (
              <TableRow key={inv.id} className="hover:bg-slate-50 transition-colors border-b">
                <TableCell className="py-5">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-black text-slate-900 text-base">{inv.bankName}</span>
                    <span className="font-mono text-[11px] text-muted-foreground font-bold uppercase tracking-tight">Ref: {inv.referenceNumber}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary" className="text-[11px] uppercase font-black tracking-wider px-2 py-1">{inv.instrumentType}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-black text-base text-slate-900">৳ {Number(inv.principalAmount).toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Initial: ৳{Number(inv.initialPrincipalAmount || inv.principalAmount).toLocaleString()}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-indigo-700 font-black text-base">{(Number(inv.interestRate) * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-4 text-xs font-black">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Opening</span>
                      <span className="text-slate-600">{inv.firstOpeningDate || inv.issueDate}</span>
                    </div>
                    <ArrowRight className="size-3 text-slate-300" />
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-primary font-black uppercase tracking-widest mb-1">Renewed</span>
                      <span className="text-primary">{inv.issueDate}</span>
                    </div>
                    <ArrowRight className="size-3 text-slate-300" />
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-rose-500 font-black uppercase tracking-widest mb-1">Maturity</span>
                      <span className="text-rose-600 font-black">{inv.maturityDate || "N/A"}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(inv.status)}</TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-indigo-600 hover:bg-indigo-50" title="Audit History" onClick={() => { setViewingHistory(inv); setIsHistoryOpen(true); }}><HistoryIcon className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/5" title="Renew Cycle" onClick={() => { setRenewingInvestment(inv); setIsRenewOpen(true); }}><RefreshCw className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-slate-100" onClick={() => { setEditingInvestment(inv); setIsAddOpen(true); }}><Edit2 className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => { showAlert({ title: "Delete Instrument?", description: "This will remove the current record. Audit trail history remains.", type: "warning", showCancel: true, confirmText: "Delete", onConfirm: () => { deleteDocumentNonBlocking(doc(firestore, "investmentInstruments", inv.id)); } }); }}><Trash2 className="size-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black"><RefreshCw className="size-6 text-primary" /> Renew Investment Cycle</DialogTitle>
            <DialogDescription className="text-base font-bold text-slate-500">Inception Principal: <span className="text-slate-900">৳{renewingInvestment?.initialPrincipalAmount?.toLocaleString()}</span></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenewInvestment} className="space-y-6 pt-4">
            <div className="grid gap-6">
              <div className="space-y-2"><Label className="text-sm font-black">New Principal (৳)</Label><Input name="principalAmount" type="number" step="0.01" defaultValue={renewingInvestment?.principalAmount} className="h-11 font-bold" required /></div>
              <div className="space-y-2"><Label className="text-sm font-black">New Interest Rate (%)</Label><Input name="interestRate" type="number" step="0.01" defaultValue={renewingInvestment ? (renewingInvestment.interestRate * 100).toFixed(2) : ""} className="h-11 font-bold" required /></div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-sm font-black">Renew Date</Label><Input name="renewDate" type="date" required value={renewDate} onChange={(e) => handleRenewDateChange(e.target.value)} className="h-11 font-bold" /></div>
                <div className="space-y-2"><Label className="text-sm font-black">New Maturity Date</Label><Input name="maturityDate" type="date" required value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} className="h-11 font-bold" /></div>
              </div>
            </div>
            <DialogFooter className="gap-3 pt-4"><Button type="button" variant="outline" className="h-11 font-black px-8" onClick={() => setIsRenewOpen(false)}>Cancel</Button><Button type="submit" className="h-11 font-black px-10">Confirm Renewal</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto font-ledger">
          <DialogHeader className="border-b pb-6">
            <DialogTitle className="flex items-center gap-4 text-3xl font-black"><ShieldCheck className="size-8 text-primary" /> Audit Trail: {viewingHistory?.bankName}</DialogTitle>
            <DialogDescription className="font-mono text-sm font-bold text-muted-foreground mt-2">Reference: {viewingHistory?.referenceNumber} • Inception: {viewingHistory?.firstOpeningDate}</DialogDescription>
          </DialogHeader>
          <div className="py-8 space-y-10">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm"><p className="text-xs uppercase font-black text-slate-400 mb-2 tracking-widest">Inception Principal</p><p className="text-3xl font-black text-slate-900">৳ {viewingHistory?.initialPrincipalAmount?.toLocaleString()}</p></div>
              <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 shadow-sm"><p className="text-xs uppercase font-black text-primary opacity-60 mb-2 tracking-widest">Current Principal</p><p className="text-3xl font-black text-primary">৳ {viewingHistory?.principalAmount?.toLocaleString()}</p></div>
            </div>
            <div className="space-y-6">
              <h3 className="text-lg font-black flex items-center gap-2 px-2"><Clock className="size-5 text-slate-400" /> Lifecycle Audit Matrix</h3>
              <div className="border rounded-2xl overflow-hidden shadow-md">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[180px] font-black uppercase text-xs py-4 pl-6">Audit Cycle</TableHead>
                      <TableHead className="font-black uppercase text-xs py-4">Date Coverage</TableHead>
                      <TableHead className="text-right font-black uppercase text-xs py-4">Principal (৳)</TableHead>
                      <TableHead className="text-right font-black uppercase text-xs py-4">Yield (%)</TableHead>
                      <TableHead className="text-center font-black uppercase text-xs py-4 pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-primary/5 hover:bg-primary/10 transition-colors border-b-2">
                      <TableCell className="font-black text-primary text-sm uppercase pl-6 py-5">Active Cycle</TableCell>
                      <TableCell className="py-5"><div className="flex items-center gap-3 font-mono text-xs font-black"><span className="text-slate-900">{viewingHistory?.issueDate}</span><ArrowRight className="size-3 text-slate-300" /><span className="text-rose-600">{viewingHistory?.maturityDate || "N/A"}</span></div></TableCell>
                      <TableCell className="text-right font-black text-lg text-slate-900 py-5">৳ {viewingHistory?.principalAmount?.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-black text-lg text-indigo-700 py-5">{(viewingHistory?.interestRate * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-center pr-6 py-5"><Badge className="bg-primary text-[10px] h-6 px-3 uppercase font-black tracking-widest">Active</Badge></TableCell>
                    </TableRow>
                    {isHistoryLoading ? <TableRow><TableCell colSpan={5} className="text-center py-16"><Loader2 className="size-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow> : (!auditHistory || auditHistory.length === 0) ? <TableRow><TableCell colSpan={5} className="text-center py-12"><Info className="size-8 mx-auto mb-2 text-slate-300" /><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No renewal history found</p></TableCell></TableRow> : auditHistory.map((h, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 transition-colors opacity-90 border-b">
                        <TableCell className="text-sm font-black text-slate-500 uppercase pl-6 py-4">{h.cycleLabel || "Archived Cycle"}</TableCell>
                        <TableCell className="py-4"><div className="flex items-center gap-3 font-mono text-xs font-bold text-slate-500"><span>{h.issueDate}</span><ArrowRight className="size-3 text-slate-200" /><span>{h.maturityDate}</span></div></TableCell>
                        <TableCell className="text-right font-bold text-base text-slate-600 py-4">৳ {h.principalAmount?.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-base text-slate-600 py-4">{(h.interestRate * 100).toFixed(2)}%</TableCell>
                        <TableCell className="text-center pr-6 py-4"><Badge variant="outline" className="text-[10px] h-6 px-3 uppercase font-black border-slate-200 text-slate-400">Archived</Badge></TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-emerald-50/30 border-t-4 border-emerald-100">
                      <TableCell className="font-black text-emerald-700 text-sm uppercase pl-6 py-6">Initial Inception</TableCell>
                      <TableCell className="font-mono text-xs font-black text-emerald-600 py-6">Genesis: {viewingHistory?.firstOpeningDate}</TableCell>
                      <TableCell className="text-right font-black text-lg text-emerald-700 py-6">৳ {viewingHistory?.initialPrincipalAmount?.toLocaleString()}</TableCell>
                      <TableCell colSpan={2} className="text-center pr-6 py-6"><div className="flex items-center justify-center gap-3 text-emerald-600"><ArrowDownRight className="size-4" /><span className="text-[11px] font-black uppercase tracking-tighter">Inception Anchor</span></div></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter className="bg-slate-50 -mx-6 -mb-6 p-6 border-t"><Button variant="ghost" className="font-black h-11 px-8 text-base" onClick={() => setIsHistoryOpen(false)}>Close Audit Terminal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
