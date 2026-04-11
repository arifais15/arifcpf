
"use client"

import { useState, useMemo, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, TrendingUp, Wallet, Edit2, Trash2, Loader2, AlertCircle, CheckCircle2, Clock, History, Building2, Upload, FileSpreadsheet, Download, ClipboardList } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
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
  const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [editingInvestment, setEditingInvestment] = useState<any>(null);

  const investmentsRef = useMemoFirebase(() => collection(firestore, "investmentInstruments"), [firestore]);
  const { data: investments, isLoading } = useCollection(investmentsRef);

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
    );
  }, [investments, search]);

  const stats = useMemo(() => {
    if (!investments || investments.length === 0) return { total: 0, count: 0, avgRate: 0 };
    const total = investments.reduce((sum, inv) => sum + (Number(inv.principalAmount) || 0), 0);
    const sumRates = investments.reduce((sum, inv) => sum + (Number(inv.interestRate) || 0), 0);
    return { total, count: investments.length, avgRate: (sumRates / (investments.length || 1)) * 100 };
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
      accrualFrequency: formData.get("accrualFrequency") as string || "Quarterly",
      status: formData.get("status") as string || "Active",
      updatedAt: new Date().toISOString(),
    };

    if (editingInvestment) {
      const docRef = doc(firestore, "investmentInstruments", editingInvestment.id);
      updateDocumentNonBlocking(docRef, investmentData);
      showAlert({ 
        title: "Updated", 
        description: `Instrument ${investmentData.referenceNumber} updated. System will refresh.`, 
        type: "success",
        onConfirm: () => window.location.reload()
      });
    } else {
      addDocumentNonBlocking(investmentsRef, investmentData);
      showAlert({ 
        title: "Success", 
        description: `New ${investmentData.instrumentType} recorded. System will refresh.`, 
        type: "success",
        onConfirm: () => window.location.reload()
      });
    }
    setIsAddOpen(false);
    setEditingInvestment(null);
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
          const mapped = {
            bankName: entry.bankName || entry["Bank Name"] || "",
            referenceNumber: entry.referenceNumber || entry["Ref No"] || "",
            principalAmount: Number(entry.principalAmount || entry["Principal"] || 0),
            interestRate: Number(entry.interestRate || entry["Rate"] || 0) / 100,
            issueDate: entry.issueDate || "",
            maturityDate: entry.maturityDate || "",
            instrumentType: entry.instrumentType || "FDR",
            chartOfAccountId: entry.chartOfAccountId || "101.10.0000",
            status: entry.status || "Active",
            updatedAt: new Date().toISOString()
          };
          if (mapped.bankName) addDocumentNonBlocking(investmentsRef, mapped);
        });
        showAlert({ 
          title: "Success", 
          description: "Bulk processing complete. Page will refresh.", 
          type: "success",
          onConfirm: () => window.location.reload()
        });
      } catch (err) { toast({ title: "Upload Failed", variant: "destructive" }); }
      finally { setIsUploading(false); setIsBulkOpen(false); }
    };
    reader.readAsBinaryString(file);
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
          <p className="text-muted-foreground">Manage FDRs, Bonds and Savings Certificates</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild><Button variant="outline" className="gap-2 border-slate-300"><Upload className="size-4" /> Bulk Upload</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Bulk Upload Investments</DialogTitle></DialogHeader>
              <div className="p-12 border-2 border-dashed rounded-xl text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="size-8 mx-auto mb-2 text-primary" />
                <p className="font-medium">Select XLSX Template</p>
                <input type="file" className="hidden" ref={fileInputRef} onChange={handleExcelUpload} disabled={isUploading} accept=".xlsx" />
                {isUploading && <Loader2 className="size-4 animate-spin mx-auto mt-4" />}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingInvestment(null); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" /> New Investment</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>{editingInvestment ? "Edit" : "Add"} Investment</DialogTitle></DialogHeader>
              <form onSubmit={handleSaveInvestment} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2"><Label>Bank Name</Label><Input name="bankName" defaultValue={editingInvestment?.bankName} required /></div>
                  <div className="space-y-2">
                    <Label>Account Code</Label>
                    <Select name="chartOfAccountId" defaultValue={editingInvestment?.chartOfAccountId || "101.10.0000"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {investmentAccounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Principal</Label><Input name="principalAmount" type="number" step="0.01" defaultValue={editingInvestment?.principalAmount} required /></div>
                  <div className="space-y-2"><Label>Issue Date</Label><Input name="issueDate" type="date" defaultValue={editingInvestment?.issueDate} required /></div>
                  <div className="space-y-2"><Label>Maturity Date</Label><Input name="maturityDate" type="date" defaultValue={editingInvestment?.maturityDate} /></div>
                  <div className="space-y-2"><Label>Rate (%)</Label><Input name="interestRate" type="number" step="0.01" defaultValue={editingInvestment ? editingInvestment.interestRate * 100 : ""} required /></div>
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
        <Card className="bg-primary/5 border-none"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Principal</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">৳ {stats.total.toLocaleString()}</div></CardContent></Card>
        <Card className="bg-accent/5 border-none"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Weighted Yield</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.avgRate.toFixed(2)}%</div></CardContent></Card>
        <Card className="bg-emerald-50 border-none"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Active Certificates</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.count} Items</div></CardContent></Card>
      </div>

      <div className="bg-card rounded-xl shadow-sm border overflow-hidden no-print">
        <div className="p-4 border-b bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search portfolio..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Bank & Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Principal (৳)</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredInvestments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredInvestments.map((inv) => (
              <TableRow key={inv.id} className="hover:bg-slate-50">
                <TableCell><div className="flex flex-col"><span className="font-bold">{inv.bankName}</span><span className="font-mono text-[10px] text-muted-foreground">{inv.referenceNumber}</span></div></TableCell>
                <TableCell className="text-xs">{inv.instrumentType}</TableCell>
                <TableCell className="text-right font-bold">৳ {Number(inv.principalAmount).toLocaleString()}</TableCell>
                <TableCell className="text-right text-accent font-semibold">{(Number(inv.interestRate) * 100).toFixed(2)}%</TableCell>
                <TableCell>{getStatusBadge(inv.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingInvestment(inv); setIsAddOpen(true); }}><Edit2 className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { showAlert({ title: "Delete?", description: "Remove this investment record?", type: "warning", showCancel: true, onConfirm: () => { deleteDocumentNonBlocking(doc(firestore, "investmentInstruments", inv.id)); window.location.reload(); } }); }}><Trash2 className="size-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
