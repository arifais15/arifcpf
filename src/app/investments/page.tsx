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
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Percent,
  Calculator,
  Activity
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

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

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

  // Reset to page 1 when searching
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const paginatedInvestments = useMemo(() => {
    if (pageSize === -1) return filteredInvestments;
    const start = (currentPage - 1) * pageSize;
    return filteredInvestments.slice(start, start + pageSize);
  }, [filteredInvestments, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredInvestments.length / pageSize);

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
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-black text-black tracking-tight uppercase">Investment Portfolio</h1>
          <p className="text-sm font-black uppercase tracking-widest text-slate-500">Capital Assets & Institutional Yield Terminal</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Movement & Interest Sub-Navigation */}
          <div className="flex items-center bg-white p-1 rounded-xl border-2 border-black shadow-sm">
            <Button variant="ghost" asChild className="gap-2 text-black hover:bg-slate-100 font-black h-9 text-[10px] uppercase tracking-tighter">
              <Link href="/investments/member-interest">
                <Percent className="size-3.5" /> Member Interest
              </Link>
            </Button>
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <Button variant="ghost" asChild className="gap-2 text-black hover:bg-slate-100 font-black h-9 text-[10px] uppercase tracking-tighter">
              <Link href="/investments/special-interest">
                <Calculator className="size-3.5" /> Special Interest
              </Link>
            </Button>
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <Button variant="ghost" asChild className="gap-2 text-black hover:bg-slate-100 font-black h-9 text-[10px] uppercase tracking-tighter">
              <Link href="/investments/movements">
                <Activity className="size-3.5" /> Movement
              </Link>
            </Button>
          </div>

          <div className="flex items-center bg-white p-1 rounded-xl border-2 border-black shadow-sm">
            <Button variant="ghost" asChild className="gap-2 text-black hover:bg-slate-100 font-black h-9 text-[10px] uppercase tracking-tighter">
              <Link href="/reports/maturity-summary">
                <CalendarClock className="size-3.5" /> Maturity Schedule
              </Link>
            </Button>
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <Button variant="ghost" asChild className="gap-2 text-black hover:bg-slate-100 font-black h-9 text-[10px] uppercase tracking-tighter">
              <Link href="/investments/provisions">
                <HandCoins className="size-3.5" /> Provisions
              </Link>
            </Button>
          </div>

          <Button variant="outline" onClick={exportToExcel} disabled={filteredInvestments.length === 0} className="gap-2 border-2 border-black text-black hover:bg-slate-50 font-black h-11 text-sm uppercase tracking-widest">
            <FileSpreadsheet className="size-5" /> Export
          </Button>

          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild><Button variant="outline" className="gap-2 border-2 border-black font-black h-11 text-sm uppercase tracking-widest"><Upload className="size-5" /> Bulk</Button></DialogTrigger>
            <DialogContent className="max-w-2xl bg-white border-2 border-black">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-2xl font-black uppercase">Bulk Portfolio Upload</DialogTitle>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const templateData = [{ "Bank Name": "Sonali Bank PLC", "Ref No": "FDR-2024-001", "Principal": 1000000, "Initial Principal": 1000000, "Rate": 12.5, "First Opening Date": "2020-01-01", "Renew Date": "2024-01-01", "Maturity Date": "2025-01-01", "Instrument Type": "FDR", "chartOfAccountId": "101.10.0000", "Status": "Active" }];
                    const ws = XLSX.utils.json_to_sheet(templateData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Investments");
                    XLSX.writeFile(wb, "investments_template.xlsx");
                  }} className="h-8 text-xs font-black gap-1 uppercase hover:bg-slate-100"><Download className="size-4" /> Template</Button>
                </div>
                <DialogDescription className="text-sm font-black text-slate-500">Upload institutional XLSX file. All lifecycle dates are required for audit trail consistency.</DialogDescription>
              </DialogHeader>
              <div className="p-12 border-4 border-dashed border-slate-200 rounded-3xl text-center cursor-pointer hover:border-black transition-colors" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="size-16 mx-auto mb-4 text-black opacity-20" />
                <p className="text-xl font-black uppercase tracking-widest">Select Portfolio File</p>
                <input type="file" className="hidden" ref={fileInputRef} onChange={handleExcelUpload} disabled={isUploading} accept=".xlsx" />
                {isUploading && <Loader2 className="size-8 animate-spin mx-auto mt-4 text-black" />}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingInvestment(null); }}>
            <DialogTrigger asChild><Button className="gap-2 h-11 text-sm font-black bg-black text-white uppercase tracking-widest hover:bg-black/90 shadow-xl"><Plus className="size-5" /> New Record</Button></DialogTrigger>
            <DialogContent className="max-w-2xl bg-white border-2 border-black">
              <DialogHeader><DialogTitle className="text-2xl font-black uppercase">{editingInvestment ? "Edit" : "Add"} Instrument</DialogTitle></DialogHeader>
              <form onSubmit={handleSaveInvestment} className="space-y-6 pt-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Bank / Institution Name</Label>
                    <Input 
                      name="bankName" 
                      list="bank-names" 
                      defaultValue={editingInvestment?.bankName} 
                      className="h-11 border-2 border-black font-black" 
                      required 
                    />
                    <datalist id="bank-names">
                      {uniqueBankNames.map(name => <option key={name} value={name} />)}
                    </datalist>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Ref No</Label><Input name="referenceNumber" defaultValue={editingInvestment?.referenceNumber} className="h-11 border-2 border-black font-black" required /></div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Instrument Type</Label>
                    <Select name="instrumentType" defaultValue={editingInvestment?.instrumentType || "FDR"}>
                      <SelectTrigger className="h-11 border-2 border-black font-black"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FDR" className="font-black uppercase">FDR</SelectItem>
                        <SelectItem value="Savings Certificate" className="font-black uppercase">Savings Certificate</SelectItem>
                        <SelectItem value="Govt. Treasury Bond" className="font-black uppercase">Govt. Bond</SelectItem>
                        <SelectItem value="Other" className="font-black uppercase">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Current Principal (৳)</Label>
                    <Input 
                      name="principalAmount" 
                      type="number" 
                      step="0.01" 
                      value={formPrincipal} 
                      onChange={(e) => { 
                        setFormPrincipal(e.target.value); 
                        if (!editingInvestment) setFormInitialPrincipal(e.target.value); 
                      }} 
                      className="h-11 border-2 border-black font-black tabular-nums" 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Initial Principal (৳)</Label>
                    <Input 
                      name="initialPrincipalAmount" 
                      type="number" 
                      step="0.01" 
                      value={formInitialPrincipal} 
                      onChange={(e) => setFormInitialPrincipal(e.target.value)} 
                      className="h-11 border-2 border-black font-black tabular-nums" 
                    />
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Yield Rate (%)</Label><Input name="interestRate" type="number" step="0.01" defaultValue={editingInvestment ? (editingInvestment.interestRate * 100).toFixed(2) : ""} className="h-11 border-2 border-black font-black tabular-nums" required /></div>
                  
                  <div className="col-span-2 grid grid-cols-3 gap-4 p-6 bg-slate-50 rounded-2xl border-2 border-black">
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black text-slate-500">First Opening</Label>
                      <Input 
                        name="firstOpeningDate" 
                        type="date" 
                        value={formOpeningDate} 
                        onChange={(e) => { 
                          setFormOpeningDate(e.target.value); 
                          if (!editingInvestment) setFormIssueDate(e.target.value); 
                        }} 
                        className="font-black text-xs border-2 border-slate-300" 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[9px] uppercase font-black text-slate-500">Cycle Renew</Label>
                      <Input 
                        name="issueDate" 
                        type="date" 
                        value={formIssueDate} 
                        onChange={(e) => setFormIssueDate(e.target.value)} 
                        className="font-black text-xs border-2 border-slate-300" 
                        required 
                      />
                    </div>
                    <div className="space-y-2"><Label className="text-[9px] uppercase font-black text-slate-500">Maturity Date</Label><Input name="maturityDate" type="date" defaultValue={editingInvestment?.maturityDate} className="font-black text-xs border-2 border-slate-300" /></div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">GL Account</Label>
                    <Select name="chartOfAccountId" defaultValue={editingInvestment?.chartOfAccountId || "101.10.0000"}>
                      <SelectTrigger className="h-11 border-2 border-black font-black"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => <SelectItem key={a.code} value={a.code} className="font-black">{a.code} - {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Status</Label>
                    <Select name="status" defaultValue={editingInvestment?.status || "Active"}>
                      <SelectTrigger className="h-11 border-2 border-black font-black"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active" className="font-black text-emerald-700">ACTIVE</SelectItem>
                        <SelectItem value="Matured" className="font-black text-orange-700">MATURED</SelectItem>
                        <SelectItem value="Closed" className="font-black text-slate-700">CLOSED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="gap-3 pt-4"><Button type="button" variant="outline" className="h-12 border-2 border-black font-black px-8 uppercase" onClick={() => setIsAddOpen(false)}>Cancel</Button><Button type="submit" className="h-12 bg-black text-white font-black px-10 uppercase tracking-widest shadow-xl">Save Instrument</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 no-print">
        <Card className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-black">Active Principal</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-black tabular-nums">৳ {stats.total.toLocaleString()}</div></CardContent></Card>
        <Card className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-black">Weighted Yield</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-black tabular-nums">{stats.avgRate.toFixed(2)}%</div></CardContent></Card>
        <Card className="bg-black text-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] rounded-none"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Active Certificates</CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-white">{stats.count} Items</div></CardContent></Card>
      </div>

      <div className="bg-white rounded-none shadow-2xl border-2 border-black overflow-hidden no-print">
        <div className="p-6 border-b-2 border-black bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-black" />
            <Input className="pl-10 h-12 bg-white text-base font-black border-2 border-black shadow-inner" placeholder="Audit Portfolio (Bank, Ref, Type)..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Display</Label>
              <Select 
                value={pageSize.toString()} 
                onValueChange={(v) => { 
                  setPageSize(parseInt(v)); 
                  setCurrentPage(1); 
                }}
              >
                <SelectTrigger className="h-9 w-24 font-black text-xs border-black border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5" className="font-black">5 Items</SelectItem>
                  <SelectItem value="10" className="font-black">10 Items</SelectItem>
                  <SelectItem value="25" className="font-black">25 Items</SelectItem>
                  <SelectItem value="-1" className="font-black">All Records</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-2 border-l-2 pl-4 border-slate-200">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 w-9 p-0 border-black border-2" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="flex items-center gap-1.5 px-3">
                  <span className="text-[10px] font-black uppercase text-slate-400">Page</span>
                  <span className="text-sm font-black">{currentPage} / {totalPages}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 w-9 p-0 border-black border-2" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 border-b-2 border-black hover:bg-slate-100">
              <TableHead className="font-black text-black uppercase text-[10px] tracking-widest py-5 pl-6">Bank & Reference</TableHead>
              <TableHead className="font-black text-black uppercase text-[10px] tracking-widest py-5">Type</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5">Principal (৳)</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5">Yield</TableHead>
              <TableHead className="text-center font-black text-black uppercase text-[10px] tracking-widest py-5">Lifecycle</TableHead>
              <TableHead className="font-black text-black uppercase text-[10px] tracking-widest py-5">Status</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5 pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {isLoading && filteredInvestments.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : paginatedInvestments.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-32 text-slate-400 font-black text-lg uppercase italic">No records found</TableCell></TableRow>
            ) : paginatedInvestments.map((inv) => (
              <TableRow key={inv.id} className="hover:bg-slate-50 transition-colors border-b border-black">
                <TableCell className="py-5 pl-6">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-black text-black text-base uppercase leading-tight">{inv.bankName}</span>
                    <span className="font-mono text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ref: {inv.referenceNumber}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] uppercase font-black border-black px-2 py-0.5">{inv.instrumentType}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-black text-base text-black">{Number(inv.principalAmount).toLocaleString()}</span>
                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-tight">Init: ৳{Number(inv.initialPrincipalAmount || inv.principalAmount).toLocaleString()}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-black font-black text-base">{(Number(inv.interestRate) * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-4 text-xs font-black">
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Open</span>
                      <span className="text-slate-600">{inv.firstOpeningDate || inv.issueDate}</span>
                    </div>
                    <ArrowRight className="size-3 text-slate-300" />
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] text-black font-black uppercase tracking-[0.2em] mb-1">Renew</span>
                      <span className="text-black">{inv.issueDate}</span>
                    </div>
                    <ArrowRight className="size-3 text-slate-300" />
                    <div className="flex flex-col items-center">
                      <span className="text-[8px] text-rose-500 font-black uppercase tracking-[0.2em] mb-1">Mature</span>
                      <span className="text-rose-600 font-black">{inv.maturityDate || "N/A"}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(inv.status)}</TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-black hover:bg-slate-100" title="History" onClick={() => { setViewingHistory(inv); setIsHistoryOpen(true); }}><HistoryIcon className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-black hover:bg-slate-100" title="Renew" onClick={() => { setRenewingInvestment(inv); setIsRenewOpen(true); }}><RefreshCw className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-slate-100" onClick={() => { setEditingInvestment(inv); setIsAddOpen(true); }}><Edit2 className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => { showAlert({ title: "Delete Record?", description: "Remove this instrument from active portfolio? Audit trail history is retained.", type: "warning", showCancel: true, confirmText: "Delete", onConfirm: () => { deleteDocumentNonBlocking(doc(firestore, "investmentInstruments", inv.id)); } }); }}><Trash2 className="size-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}>
        <DialogContent className="max-w-lg bg-white border-2 border-black">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase"><RefreshCw className="size-6 text-black" /> Cycle Renewal</DialogTitle>
            <DialogDescription className="text-sm font-black text-slate-500">Genesis Principal: <span className="text-black">৳{renewingInvestment?.initialPrincipalAmount?.toLocaleString()}</span></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenewInvestment} className="space-y-6 pt-4">
            <div className="grid gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">New Cycle Principal (৳)</Label><Input name="principalAmount" type="number" step="0.01" defaultValue={renewingInvestment?.principalAmount} className="h-11 border-2 border-black font-black tabular-nums" required /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">New Yield Rate (%)</Label><Input name="interestRate" type="number" step="0.01" defaultValue={renewingInvestment ? (renewingInvestment.interestRate * 100).toFixed(2) : ""} className="h-11 border-2 border-black font-black tabular-nums" required /></div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Renew Date</Label><Input name="renewDate" type="date" required value={renewDate} onChange={(e) => handleRenewDateChange(e.target.value)} className="h-11 border-2 border-black font-black" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Maturity Date</Label><Input name="maturityDate" type="date" required value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} className="h-11 border-2 border-black font-black" /></div>
              </div>
            </div>
            <DialogFooter className="gap-3 pt-4"><Button type="button" variant="outline" className="h-12 border-2 border-black font-black px-8 uppercase" onClick={() => setIsRenewOpen(false)}>Cancel</Button><Button type="submit" className="h-12 bg-black text-white font-black px-10 uppercase tracking-widest shadow-xl">Confirm Cycle</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-white border-4 border-black p-0 rounded-none shadow-2xl">
          <DialogHeader className="p-8 border-b-4 border-black bg-slate-50">
            <DialogTitle className="flex items-center gap-4 text-3xl font-black uppercase tracking-tight"><ShieldCheck className="size-10 text-black" /> Lifecycle Audit Trail: {viewingHistory?.bankName}</DialogTitle>
            <DialogDescription className="font-mono text-sm font-black text-slate-500 mt-2 uppercase tracking-widest">Ref: {viewingHistory?.referenceNumber} • Genesis Inception: {viewingHistory?.firstOpeningDate}</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-10">
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-none border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"><p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-[0.3em]">Genesis Principal</p><p className="text-4xl font-black text-black">৳ {viewingHistory?.initialPrincipalAmount?.toLocaleString()}</p></div>
              <div className="bg-black p-8 rounded-none border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]"><p className="text-[10px] uppercase font-black text-white/60 mb-2 tracking-[0.3em]">Current Portfolio Weight</p><p className="text-4xl font-black text-white">৳ {viewingHistory?.principalAmount?.toLocaleString()}</p></div>
            </div>
            <div className="space-y-6">
              <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-3 border-b-4 border-black pb-2"><Clock className="size-6 text-black" /> Historical Audit Matrix</h3>
              <div className="border-2 border-black overflow-hidden shadow-xl">
                <Table className="tabular-nums font-black text-black">
                  <TableHeader className="bg-slate-100 border-b-2 border-black">
                    <TableRow>
                      <TableHead className="w-[200px] font-black uppercase text-[10px] tracking-widest py-4 pl-6">Audit Cycle</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">Coverage Timeline</TableHead>
                      <TableHead className="text-right font-black uppercase text-[10px] tracking-widest py-4">Principal (৳)</TableHead>
                      <TableHead className="text-right font-black uppercase text-[10px] tracking-widest py-4">Yield (%)</TableHead>
                      <TableHead className="text-center font-black uppercase text-[10px] tracking-widest py-4 pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-white hover:bg-slate-50 transition-colors border-b-2 border-black">
                      <TableCell className="font-black text-black text-sm uppercase pl-6 py-5">Active Cycle</TableCell>
                      <TableCell className="py-5"><div className="flex items-center gap-3 font-mono text-[11px] font-black uppercase"><span className="text-black">{viewingHistory?.issueDate}</span><ArrowRight className="size-3 text-slate-300" /><span className="text-rose-600 underline">{viewingHistory?.maturityDate || "OPEN"}</span></div></TableCell>
                      <TableCell className="text-right font-black text-xl text-black py-5">৳ {viewingHistory?.principalAmount?.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-black text-xl text-black py-5">{(viewingHistory?.interestRate * 100).toFixed(2)}%</TableCell>
                      <TableCell className="text-center pr-6 py-5"><Badge className="bg-black text-white text-[9px] h-6 px-3 uppercase font-black tracking-widest rounded-none">In Service</Badge></TableCell>
                    </TableRow>
                    {isHistoryLoading ? <TableRow><TableCell colSpan={5} className="text-center py-16"><Loader2 className="size-8 animate-spin mx-auto text-black" /></TableCell></TableRow> : (!auditHistory || auditHistory.length === 0) ? <TableRow><TableCell colSpan={5} className="text-center py-12"><Info className="size-8 mx-auto mb-2 text-slate-300" /><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No renewal history recorded</p></TableCell></TableRow> : auditHistory.map((h, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 transition-colors border-b border-black">
                        <TableCell className="text-sm font-black text-slate-500 uppercase pl-6 py-4">{h.cycleLabel || "Archived"}</TableCell>
                        <TableCell className="py-4"><div className="flex items-center gap-3 font-mono text-[10px] font-black text-slate-400"><span>{h.issueDate}</span><ArrowRight className="size-3 text-slate-200" /><span>{h.maturityDate}</span></div></TableCell>
                        <TableCell className="text-right font-black text-base text-slate-600 py-4">{h.principalAmount?.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-black text-base text-slate-600 py-4">{(h.interestRate * 100).toFixed(2)}%</TableCell>
                        <TableCell className="text-center pr-6 py-4"><Badge variant="outline" className="text-[9px] h-6 px-3 uppercase font-black border-slate-200 text-slate-400 rounded-none">Archived</Badge></TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 border-t-4 border-black">
                      <TableCell className="font-black text-black text-sm uppercase pl-6 py-6">Genesis Anchor</TableCell>
                      <TableCell className="font-mono text-[11px] font-black text-slate-600 py-6">Genesis: {viewingHistory?.firstOpeningDate}</TableCell>
                      <TableCell className="text-right font-black text-xl text-black py-6">৳ {viewingHistory?.initialPrincipalAmount?.toLocaleString()}</TableCell>
                      <TableCell colSpan={2} className="text-center pr-6 py-6"><div className="flex items-center justify-center gap-3 text-black"><ArrowDownRight className="size-4" /><span className="text-[10px] font-black uppercase tracking-widest">Inception Point</span></div></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter className="bg-slate-100 p-8 border-t-4 border-black"><Button variant="ghost" className="font-black h-12 px-10 text-sm uppercase tracking-[0.3em] hover:bg-white" onClick={() => setIsHistoryOpen(false)}>Exit Audit Terminal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
