
"use client"

import { useState, useMemo, useRef } from "react";
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
  ArrowRight,
  FileText,
  Printer,
  ChevronRight,
  Upload,
  FileSpreadsheet,
  Download
} from "lucide-react";
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking 
} from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function InvestmentsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMaturityReportOpen, setIsMaturityReportOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkCsvData, setBulkCsvData] = useState("");
  
  const [editingInvestment, setEditingInvestment] = useState<any>(null);
  const [selectedForProvision, setSelectedForProvision] = useState<any>(null);
  const [selectedForHistory, setSelectedForHistory] = useState<any>(null);
  const [maturityRange, setMaturityRange] = useState({ start: "", end: "" });

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

  const maturedInstruments = useMemo(() => {
    if (!investments || !maturityRange.start || !maturityRange.end) return [];
    return investments.filter(inv => {
      if (!inv.maturityDate) return false;
      const mDate = new Date(inv.maturityDate);
      const sDate = new Date(maturityRange.start);
      const eDate = new Date(maturityRange.end);
      return mDate >= sDate && mDate <= eDate;
    }).sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime());
  }, [investments, maturityRange]);

  const stats = useMemo(() => {
    if (!investments || investments.length === 0) return { total: 0, count: 0, avgRate: 0 };
    const total = investments.reduce((sum, inv) => sum + (Number(inv.principalAmount) || 0), 0);
    const sumRates = investments.reduce((sum, inv) => sum + (Number(inv.interestRate) || 0), 0);
    return {
      total,
      count: investments.length,
      avgRate: (sumRates / (investments.length || 1)) * 100
    };
  }, [investments]);

  const handleSaveInvestment = (e: React.FormEvent<HTMLButtonElement | HTMLFormElement>) => {
    if (e.type === 'submit') e.preventDefault();
    const form = e.currentTarget instanceof HTMLFormElement ? e.currentTarget : (e.currentTarget.closest('form') as HTMLFormElement);
    if (!form) return;

    const formData = new FormData(form);
    const investmentData = {
      bankName: formData.get("bankName") as string,
      chartOfAccountId: formData.get("chartOfAccountId") as string,
      instrumentType: formData.get("instrumentType") as string,
      referenceNumber: formData.get("referenceNumber") as string,
      issueDate: formData.get("issueDate") as string,
      maturityDate: formData.get("maturityDate") as string,
      principalAmount: Number(formData.get("principalAmount")),
      interestRate: Number(formData.get("interestRate")) / 100,
      accrualFrequency: formData.get("accrualFrequency") as string || "Quarterly",
      status: formData.get("status") as string || "Active",
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

  const processBulkEntries = (entries: any[]) => {
    let count = 0;
    entries.forEach(entry => {
      const mappedEntry = {
        bankName: entry.bankName || entry["Bank Name"] || entry["Bank"] || "",
        referenceNumber: entry.referenceNumber || entry["Ref No"] || entry["Certificate No"] || "",
        principalAmount: Number(entry.principalAmount || entry["Principal"] || entry["Amount"] || 0),
        interestRate: Number(entry.interestRate || entry["Rate"] || entry["%"] || 0) / 100,
        issueDate: entry.issueDate || entry["Issue Date"] || "",
        maturityDate: entry.maturityDate || entry["Maturity Date"] || "",
        instrumentType: entry.instrumentType || entry["Type"] || entry["Instrument Type"] || "FDR",
        chartOfAccountId: entry.chartOfAccountId || entry["COA Code"] || entry["Account Code"] || "101.10.0000",
        status: entry.status || "Active",
        accrualFrequency: "Quarterly",
        updatedAt: new Date().toISOString()
      };

      if (mappedEntry.bankName && mappedEntry.referenceNumber) {
        addDocumentNonBlocking(investmentsRef, mappedEntry);
        count++;
      }
    });
    toast({ title: "Bulk Upload Complete", description: `Successfully processed ${count} investment instruments.` });
    setIsBulkOpen(false);
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
        processBulkEntries(data);
      } catch (err) {
        toast({ title: "Upload Failed", description: "Could not parse Excel file.", variant: "destructive" });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Bank Name": "Agrani Bank Ltd.",
        "Ref No": "FDR-2024-001",
        "Principal": 1000000,
        "Rate": 8.5,
        "Issue Date": "2024-01-01",
        "Maturity Date": "2025-01-01",
        "Instrument Type": "FDR",
        "Account Code": "101.10.0000",
        "Status": "Active"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Investments");
    XLSX.writeFile(wb, "investments_upload_template.xlsx");
  };

  const handleProvisionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedForProvision) return;

    const formData = new FormData(e.currentTarget);
    const periodStart = formData.get("periodStart") as string;
    const periodEnd = formData.get("periodEnd") as string;

    const principal = Number(selectedForProvision.principalAmount);
    const rate = Number(selectedForProvision.interestRate);
    
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
      <div className="flex items-center justify-between no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Investment Portfolio</h1>
          <p className="text-muted-foreground">Manage FDRs, Bonds and Savings Certificates with Bank tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isMaturityReportOpen} onOpenChange={setIsMaturityReportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-slate-300">
                <FileText className="size-4 text-orange-600" /> Maturity Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[1000px] h-[90vh] overflow-y-auto print:max-w-none print:h-auto print:overflow-visible">
              <DialogHeader className="no-print">
                <DialogTitle>Maturity Official Note</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="no-print flex items-center gap-4 bg-slate-50 p-4 rounded-xl border">
                  <div className="space-y-1 flex-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Maturity From</Label>
                    <Input type="date" value={maturityRange.start} onChange={(e) => setMaturityRange({...maturityRange, start: e.target.value})} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Maturity To</Label>
                    <Input type="date" value={maturityRange.end} onChange={(e) => setMaturityRange({...maturityRange, end: e.target.value})} />
                  </div>
                  <Button onClick={() => window.print()} className="mt-5 gap-2" disabled={maturedInstruments.length === 0}>
                    <Printer className="size-4" /> Print Note
                  </Button>
                </div>

                {maturityRange.start && maturityRange.end ? (
                  <div className="bg-white p-12 border shadow-sm print:border-none print:shadow-none min-h-[800px] text-slate-900 font-ledger">
                    <div className="text-center space-y-1 mb-8">
                      <h1 className="text-xl font-bold uppercase underline">Gazipur Palli Bidyut Samity-2</h1>
                      <h2 className="text-lg font-bold">OFFICIAL NOTE</h2>
                      <div className="flex justify-between text-[11px] pt-4 italic border-t border-slate-200 mt-2">
                        <span>Memo No: GPBS-2/CPF/Investment/Maturity/2024/____</span>
                        <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-bold">Subject: Maturity status of Investment Instruments from {new Date(maturityRange.start).toLocaleDateString('en-GB')} to {new Date(maturityRange.end).toLocaleDateString('en-GB')}.</p>
                      <p className="text-[12px] leading-relaxed">
                        The following investment instruments held by Gazipur PBS-2 Contributory Provident Fund (CPF) are scheduled for maturity or have reached maturity during the specified period. A detailed schedule is provided below for administrative review and necessary action regarding renewal or encashment.
                      </p>

                      <table className="w-full text-[10px] border-collapse border border-slate-900 mt-4">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="border border-slate-900 p-2 text-center w-[40px]">SL No</th>
                            <th className="border border-slate-900 p-2 text-left">Bank / Institution Name</th>
                            <th className="border border-slate-900 p-2 text-left">Instrument & Ref No.</th>
                            <th className="border border-slate-900 p-2 text-right">Principal (৳)</th>
                            <th className="border border-slate-900 p-2 text-center">Rate</th>
                            <th className="border border-slate-900 p-2 text-center">Maturity Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {maturedInstruments.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="border border-slate-900 p-8 text-center text-slate-400 italic">No instruments found maturing in this range.</td>
                            </tr>
                          ) : maturedInstruments.map((inv, idx) => (
                            <tr key={inv.id}>
                              <td className="border border-slate-900 p-2 text-center">{idx + 1}</td>
                              <td className="border border-slate-900 p-2 font-bold">{inv.bankName}</td>
                              <td className="border border-slate-900 p-2">
                                {inv.instrumentType}<br/>
                                <span className="font-mono text-[9px] text-slate-500">{inv.referenceNumber}</span>
                              </td>
                              <td className="border border-slate-900 p-2 text-right font-bold">
                                {Number(inv.principalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="border border-slate-900 p-2 text-center">{(Number(inv.interestRate) * 100).toFixed(2)}%</td>
                              <td className="border border-slate-900 p-2 text-center font-bold">{new Date(inv.maturityDate).toLocaleDateString('en-GB')}</td>
                            </tr>
                          ))}
                        </tbody>
                        {maturedInstruments.length > 0 && (
                          <tfoot>
                            <tr className="bg-slate-50 font-bold">
                              <td colSpan={3} className="border border-slate-900 p-2 text-right">Total Principal:</td>
                              <td className="border border-slate-900 p-2 text-right">
                                {maturedInstruments.reduce((sum, i) => sum + Number(i.principalAmount), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td colSpan={2} className="border border-slate-900 p-2 bg-slate-100"></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>

                      <div className="pt-8 text-[12px] space-y-4">
                        <p>Total Count: <b>{maturedInstruments.length}</b> Instruments maturing in this range.</p>
                        <p className="italic underline">Proposed Action:</p>
                        <p className="leading-tight">The Board of Trustees/Audit Committee may review the current market interest rates to decide between encashment of the above funds or renewal with the respective financial institutions to maximize fund yield.</p>
                      </div>

                      <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
                        <div className="space-y-1">
                          <div className="border-t border-slate-900 pt-1">Prepared By (Finance)</div>
                          <p className="text-[9px] font-normal italic">Assistant General Manager</p>
                        </div>
                        <div className="space-y-1">
                          <div className="border-t border-slate-900 pt-1">Checked By (Audit)</div>
                          <p className="text-[9px] font-normal italic">Deputy General Manager</p>
                        </div>
                        <div className="space-y-1">
                          <div className="border-t border-slate-900 pt-1">Approved By (Trustee)</div>
                          <p className="text-[9px] font-normal italic">Senior General Manager</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                    <Calendar className="size-12 mb-2 opacity-20" />
                    <p>Select a date range to generate the official note.</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-slate-300">
                <Upload className="size-4" /> Bulk Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Bulk Upload Investments</DialogTitle>
                  <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="text-xs h-7 gap-1">
                    <Download className="size-3" /> Template
                  </Button>
                </div>
                <DialogDescription>
                  Upload multiple FDRs, Bonds, or Certificates using Excel or CSV.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="excel" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="excel" className="gap-2"><FileSpreadsheet className="size-4" /> Excel File</TabsTrigger>
                  <TabsTrigger value="csv" className="gap-2"><FileText className="size-4" /> Paste CSV</TabsTrigger>
                </TabsList>
                <TabsContent value="excel" className="space-y-4 py-4">
                  <div 
                    className="border-2 border-dashed border-muted rounded-xl p-12 text-center flex flex-col items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="bg-primary/10 p-4 rounded-full"><FileSpreadsheet className="size-8 text-primary" /></div>
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <Input type="file" className="hidden" ref={fileInputRef} accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} disabled={isUploading} />
                    {isUploading && <Loader2 className="size-4 animate-spin text-primary" />}
                  </div>
                </TabsContent>
                <TabsContent value="csv" className="space-y-4 py-4">
                  <textarea
                    className="min-h-[200px] w-full p-4 font-mono text-xs border rounded-md"
                    placeholder="bankName, referenceNumber, principalAmount, interestRate, issueDate, instrumentType, chartOfAccountId..."
                    value={bulkCsvData}
                    onChange={(e) => setBulkCsvData(e.target.value)}
                  />
                  <Button className="w-full" onClick={() => processBulkEntries(bulkCsvData.trim().split("\n").slice(1).map(l => {
                    const v = l.split(",");
                    return { 
                      bankName: v[0], 
                      referenceNumber: v[1], 
                      principalAmount: v[2], 
                      interestRate: v[3], 
                      issueDate: v[4], 
                      instrumentType: v[5], 
                      chartOfAccountId: v[6] 
                    };
                  }))}>Process CSV Data</Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

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
                    <Select name="chartOfAccountId" defaultValue={editingInvestment?.chartOfAccountId || "101.10.0000"}>
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

      <div className="grid gap-6 md:grid-cols-3 no-print">
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

      <div className="bg-card rounded-xl shadow-sm border overflow-hidden no-print">
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
