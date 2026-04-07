
"use client"

import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, ArrowLeft, Loader2, Plus, Upload, FileSpreadsheet, FileText, Edit2, Trash2, Info, Calculator, Percent, Calendar } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";

export default function MemberLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isInterestOpen, setIsInterestOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkCsvData, setBulkCsvData] = useState("");
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [selectedInterestFY, setSelectedInterestFY] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memberRef = useMemoFirebase(() => doc(firestore, "members", resolvedParams.id), [firestore, resolvedParams.id]);
  const { data: member, isLoading: isMemberLoading } = useDoc(memberRef);

  const summariesRef = useMemoFirebase(() => collection(firestore, "members", resolvedParams.id, "fundSummaries"), [firestore, resolvedParams.id]);
  const { data: summaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const sortedSummaries = useMemo(() => {
    return [...(summaries || [])].sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime());
  }, [summaries]);

  // Running balance calculations
  const calculatedRows = useMemo(() => {
    let runningLoanBalance = 0;
    let runningEmployeeFund = 0;
    let runningOfficeFund = 0;

    return sortedSummaries.map((row: any) => {
      const col1 = Number(row.employeeContribution) || 0;
      const col2 = Number(row.loanWithdrawal) || 0;
      const col3 = Number(row.loanRepayment) || 0;
      const col5 = Number(row.profitEmployee) || 0;
      const col6 = Number(row.profitLoan) || 0;
      const col8 = Number(row.pbsContribution) || 0;
      const col9 = Number(row.profitPbs) || 0;

      // Col 4: Balance of outstanding loan
      runningLoanBalance = runningLoanBalance + col2 - col3;
      
      // Col 7: Total Employee's Fund = Prev + 1 - 2 + 3 + 5 + 6
      runningEmployeeFund = runningEmployeeFund + col1 - col2 + col3 + col5 + col6;

      // Col 10: Total Office Contribution = Prev + (8 + 9)
      runningOfficeFund = runningOfficeFund + col8 + col9;

      // Col 11: Cumulative Fund Balance = 7 + 10
      const col11 = runningEmployeeFund + runningOfficeFund;

      return {
        ...row,
        col1, 
        col2, 
        col3, 
        col4: runningLoanBalance, 
        col5, 
        col6, 
        col7: runningEmployeeFund, 
        col8, 
        col9, 
        col10: runningOfficeFund, 
        col11
      };
    });
  }, [sortedSummaries]);

  // Determine available Fiscal Years from ledger data
  const availableFYs = useMemo(() => {
    const fys = new Set<string>();
    calculatedRows.forEach(row => {
      const date = new Date(row.summaryDate);
      if (isNaN(date.getTime())) return;
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const fy = month >= 7 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
      fys.add(fy);
    });
    const sorted = Array.from(fys).sort((a, b) => b.localeCompare(a));
    if (sorted.length > 0 && !selectedInterestFY) {
      setSelectedInterestFY(sorted[0]);
    }
    return sorted;
  }, [calculatedRows, selectedInterestFY]);

  // Tiered Interest Logic (Calculates annual interest for a specific balance)
  const calculateTieredAnnual = (balance: number) => {
    let annualInterest = 0;
    if (balance <= 1500000) {
      annualInterest = balance * 0.13;
    } else if (balance <= 3000000) {
      annualInterest = (1500000 * 0.13) + ((balance - 1500000) * 0.12);
    } else {
      annualInterest = (1500000 * 0.13) + (1500000 * 0.12) + ((balance - 3000000) * 0.11);
    }
    return annualInterest;
  };

  // Advanced Interest Calculation Logic (Monthly Cumulative for FY)
  const fyInterestCalculation = useMemo(() => {
    if (!selectedInterestFY) return null;
    
    const [startYearStr, endYearShort] = selectedInterestFY.split("-");
    const startYear = parseInt(startYearStr);
    
    // FY 2023-24 means July 2023 to June 2024
    const monthlyDetails = [];
    let totalFYInterest = 0;

    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      // monthIdx 0 = July, 11 = June
      const currentMonth = (monthIdx + 6) % 12; // 0-indexed month (July=6)
      const currentYear = monthIdx < 6 ? startYear : startYear + 1;
      
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
      
      // Find the cumulative balance as of the end of this month
      // We take the latest entry whose date is <= lastDayOfMonth
      const lastEntryInMonth = [...calculatedRows]
        .filter(r => new Date(r.summaryDate) <= lastDayOfMonth)
        .pop();
      
      const balance = lastEntryInMonth ? lastEntryInMonth.col11 : 0;
      const monthlyInterest = calculateTieredAnnual(balance) / 12;
      
      totalFYInterest += monthlyInterest;
      monthlyDetails.push({
        monthName: lastDayOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
        balance,
        interest: monthlyInterest
      });
    }

    return { totalFYInterest, monthlyDetails };
  }, [selectedInterestFY, calculatedRows]);

  const totals = useMemo(() => {
    if (calculatedRows.length === 0) return null;
    return calculatedRows.reduce((acc, curr) => ({
      col1: acc.col1 + curr.col1,
      col2: acc.col2 + curr.col2,
      col3: acc.col3 + curr.col3,
      col5: acc.col5 + curr.col5,
      col6: acc.col6 + curr.col6,
      col8: acc.col8 + curr.col8,
      col9: acc.col9 + curr.col9,
    }), { col1: 0, col2: 0, col3: 0, col5: 0, col6: 0, col8: 0, col9: 0 });
  }, [calculatedRows]);

  const handleSaveEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const entryData = {
      summaryDate: formData.get("summaryDate"),
      particulars: formData.get("particulars"),
      employeeContribution: Number(formData.get("employeeContribution")),
      loanWithdrawal: Number(formData.get("loanWithdrawal")),
      loanRepayment: Number(formData.get("loanRepayment")),
      profitEmployee: Number(formData.get("profitEmployee")),
      profitLoan: Number(formData.get("profitLoan")),
      pbsContribution: Number(formData.get("pbsContribution")),
      profitPbs: Number(formData.get("profitPbs")),
      lastUpdateDate: new Date().toISOString(),
      memberId: resolvedParams.id
    };

    if (editingEntry) {
      const entryRef = doc(firestore, "members", resolvedParams.id, "fundSummaries", editingEntry.id);
      updateDocumentNonBlocking(entryRef, entryData);
      toast({ title: "Entry Updated", description: "Ledger entry has been modified." });
    } else {
      addDocumentNonBlocking(summariesRef, entryData);
      toast({ title: "Entry Added", description: "Ledger entry has been recorded." });
    }
    
    setIsEntryOpen(false);
    setEditingEntry(null);
  };

  const handlePostInterest = () => {
    if (!fyInterestCalculation) return;

    const halfInterest = fyInterestCalculation.totalFYInterest / 2;
    const entryData = {
      summaryDate: new Date().toISOString().split('T')[0],
      particulars: `Annual Profit FY ${selectedInterestFY} (Monthly Cumul.)`,
      employeeContribution: 0,
      loanWithdrawal: 0,
      loanRepayment: 0,
      profitEmployee: halfInterest,
      profitLoan: 0,
      pbsContribution: 0,
      profitPbs: halfInterest,
      lastUpdateDate: new Date().toISOString(),
      memberId: resolvedParams.id
    };

    addDocumentNonBlocking(summariesRef, entryData);
    toast({ title: "Profit Recorded", description: `Interest of ৳${fyInterestCalculation.totalFYInterest.toFixed(2)} posted.` });
    setIsInterestOpen(false);
  };

  const handleEditClick = (entry: any) => {
    setEditingEntry(entry);
    setIsEntryOpen(true);
  };

  const handleDeleteEntry = (entryId: string) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      const entryRef = doc(firestore, "members", resolvedParams.id, "fundSummaries", entryId);
      deleteDocumentNonBlocking(entryRef);
      toast({ title: "Entry Deleted", description: "Ledger entry has been removed." });
    }
  };

  const processEntries = (entries: any[]) => {
    let count = 0;
    let skipped = 0;
    entries.forEach(entry => {
      const incomingId = entry.memberIdNumber || entry["Member ID"] || entry["ID No"];
      if (incomingId && incomingId.toString().trim() !== member?.memberIdNumber) {
        skipped++;
        return;
      }

      const entryData = {
        summaryDate: entry.Date || entry.summaryDate || entry["Date"] || "",
        particulars: entry.Particulars || entry.particulars || entry["Particulars"] || "",
        employeeContribution: Number(entry["Employee Contribution"] || entry.employeeContribution || 0),
        loanWithdrawal: Number(entry["Amount Withdraws as Loan"] || entry.loanWithdrawal || 0),
        loanRepayment: Number(entry["Loan Principal repayment"] || entry.loanRepayment || 0),
        profitEmployee: Number(entry["Profit on Employee Contribution"] || entry.profitEmployee || 0),
        profitLoan: Number(entry["Profit on CPF Loan"] || entry.profitLoan || 0),
        pbsContribution: Number(entry["PBS Contribution"] || entry.pbsContribution || 0),
        profitPbs: Number(entry["Profit on PBS Contribution"] || entry.profitPbs || 0),
        lastUpdateDate: new Date().toISOString(),
        memberId: resolvedParams.id
      };
      
      if (entryData.summaryDate) {
        addDocumentNonBlocking(summariesRef, entryData);
        count++;
      }
    });
    
    if (skipped > 0) {
      toast({ 
        title: "Partial Success", 
        description: `Added ${count} entries. Skipped ${skipped} unmatched IDs.`,
        variant: "destructive"
      });
    } else {
      toast({ title: "Complete", description: `Added ${count} ledger entries for ${member?.name}.` });
    }
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
        processEntries(data);
      } catch (err) {
        toast({ title: "Upload Failed", description: "Could not parse Excel file.", variant: "destructive" });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  if (isMemberLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  if (!member) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold">Member not found</h1>
        <Button asChild className="mt-4"><Link href="/members">Back to Registry</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 bg-slate-100 min-h-screen">
      <div className="flex items-center justify-between no-print max-w-[1200px] mx-auto w-full">
        <Link href="/members" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="size-4" />
          Back to Registry
        </Link>
        <div className="flex gap-2">
          {/* Enhanced Monthly Interest Calculator */}
          <Dialog open={isInterestOpen} onOpenChange={setIsInterestOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
                <Calculator className="size-4" />
                Monthly Interest Calc
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Monthly Cumulative Interest (Tiered)</DialogTitle>
                <DialogDescription>
                  Calculates interest based on month-end balances for a specific Fiscal Year.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-lg border">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Select Fiscal Year</Label>
                    <Select value={selectedInterestFY} onValueChange={setSelectedInterestFY}>
                      <SelectTrigger className="w-[180px] h-9 font-bold">
                        <SelectValue placeholder="Select FY" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFYs.map(fy => (
                          <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Total Profit for FY {selectedInterestFY}</p>
                    <p className="text-3xl font-bold text-primary">
                      ৳ {fyInterestCalculation?.totalFYInterest.toLocaleString('en-BD', { minimumFractionDigits: 2 }) || "0.00"}
                    </p>
                  </div>
                </div>

                <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-100 border-b">
                      <tr>
                        <th className="p-2 text-left">Month</th>
                        <th className="p-2 text-right">End Balance (Col 11)</th>
                        <th className="p-2 text-right">Monthly Interest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {fyInterestCalculation?.monthlyDetails.map((detail, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-medium">{detail.monthName}</td>
                          <td className="p-2 text-right">৳ {detail.balance.toLocaleString()}</td>
                          <td className="p-2 text-right font-bold text-accent">৳ {detail.interest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex gap-2">
                  <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 leading-tight">
                    Calculation based on month-end cumulative balance. ৳1.5M @ 13%, next ৳1.5M @ 12%, above ৳3M @ 11%. Monthly portions are 1/12th of annual yield.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInterestOpen(false)}>Cancel</Button>
                <Button onClick={handlePostInterest} className="gap-2" disabled={!selectedInterestFY}>
                  <Percent className="size-4" />
                  Post FY Profit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Upload className="size-4 mr-2" /> Bulk Upload</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Bulk Upload Ledger Entries</DialogTitle>
                </div>
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
                    className="min-h-[200px] w-full p-4 font-mono text-sm border rounded-md"
                    placeholder="memberIdNumber, Date, Particulars, Employee Contribution..."
                    value={bulkCsvData}
                    onChange={(e) => setBulkCsvData(e.target.value)}
                  />
                  <Button className="w-full" onClick={() => processEntries(bulkCsvData.trim().split("\n").slice(1).map(l => {
                    const v = l.split(",");
                    return { memberIdNumber: v[0], Date: v[1], Particulars: v[2], "Employee Contribution": v[3] };
                  }))}>Process CSV Data</Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <Dialog open={isEntryOpen} onOpenChange={(open) => { setIsEntryOpen(open); if (!open) setEditingEntry(null); }}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm"><Plus className="size-4 mr-2" /> New Entry</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingEntry ? "Edit Ledger Entry" : "New Ledger Entry"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveEntry} className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Date</Label>
                  <Input name="summaryDate" type="date" defaultValue={editingEntry?.summaryDate} required />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Particulars</Label>
                  <Input name="particulars" placeholder="e.g. PJ-02-001 or Interest" defaultValue={editingEntry?.particulars} required />
                </div>
                <div className="space-y-2">
                  <Label>Emp. Contrib (Col 1)</Label>
                  <Input name="employeeContribution" type="number" step="0.01" defaultValue={editingEntry?.employeeContribution || "0"} />
                </div>
                <div className="space-y-2">
                  <Label>Loan Withdraw (Col 2)</Label>
                  <Input name="loanWithdrawal" type="number" step="0.01" defaultValue={editingEntry?.loanWithdrawal || "0"} />
                </div>
                <div className="space-y-2">
                  <Label>Loan Repay (Col 3)</Label>
                  <Input name="loanRepayment" type="number" step="0.01" defaultValue={editingEntry?.loanRepayment || "0"} />
                </div>
                <div className="space-y-2">
                  <Label>Profit Emp (Col 5)</Label>
                  <Input name="profitEmployee" type="number" step="0.01" defaultValue={editingEntry?.profitEmployee || "0"} />
                </div>
                <div className="space-y-2">
                  <Label>Profit Loan (Col 6)</Label>
                  <Input name="profitLoan" type="number" step="0.01" defaultValue={editingEntry?.profitLoan || "0"} />
                </div>
                <div className="space-y-2">
                  <Label>PBS Contrib (Col 8)</Label>
                  <Input name="pbsContribution" type="number" step="0.01" defaultValue={editingEntry?.pbsContribution || "0"} />
                </div>
                <div className="space-y-2">
                  <Label>Profit PBS (Col 9)</Label>
                  <Input name="profitPbs" type="number" step="0.01" defaultValue={editingEntry?.profitPbs || "0"} />
                </div>
                <DialogFooter className="col-span-2">
                  <Button type="button" variant="outline" onClick={() => setIsEntryOpen(false)}>Cancel</Button>
                  <Button type="submit">{editingEntry ? "Update Entry" : "Save Entry"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4 mr-2" /> Print Form 224</Button>
        </div>
      </div>

      <div className="bg-white p-10 shadow-lg rounded-none border border-slate-300 max-w-[1200px] mx-auto w-full font-ledger font-light text-[#1e1e1e] print:shadow-none print:border-none">
        <div className="relative mb-6">
          <p className="text-[10px] absolute left-0 top-0">REB Form no: 224</p>
          <div className="text-center space-y-0.5">
            <h1 className="text-xl font-bold">Gazipur PBS-2</h1>
            <h2 className="text-lg font-bold underline decoration-1 underline-offset-4">Provident Fund Subsidiary Ledger</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-[11px]">
          <div className="space-y-2">
            <div className="flex gap-2"><span className="font-bold min-w-[100px]">Name:</span><span className="font-bold border-b border-dotted border-black flex-1">{member.name}</span></div>
            <div className="flex gap-2"><span className="font-bold min-w-[100px]">Curr. Address:</span><span className="border-b border-dotted border-black flex-1">{member.currentAddress || "-"}</span></div>
            <div className="flex gap-2"><span className="font-bold min-w-[100px]">Date of Joined:</span><span className="font-bold border-b border-dotted border-black flex-1">{member.dateJoined}</span></div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2"><span className="font-bold min-w-[120px]">Designation:</span><span className="font-bold border-b border-dotted border-black flex-1">{member.designation}</span></div>
            <div className="flex gap-2"><span className="font-bold min-w-[120px]">Zonal Office:</span><span className="border-b border-dotted border-black flex-1">{member.zonalOffice || "-"}</span></div>
            <div className="flex gap-2"><span className="font-bold min-w-[120px]">Permanent Address:</span><span className="border-b border-dotted border-black flex-1 text-[10px]">{member.permanentAddress || "-"}</span></div>
            <div className="flex gap-x-8">
               <div className="flex gap-2 flex-1"><span className="font-bold min-w-[40px]">ID No:</span><span className="font-bold border-b border-dotted border-black flex-1">{member.memberIdNumber}</span></div>
               <div className="flex gap-2 flex-1"><span className="font-bold whitespace-nowrap">Date of Nomination:</span><span className="font-bold border-b border-dotted border-black flex-1">{member.dateNomination || "-"}</span></div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[9px] border-collapse border border-black">
            <thead>
              <tr className="bg-white">
                <th className="border border-black p-1 text-center font-bold">Date</th>
                <th className="border border-black p-1 text-center font-bold">Particulars</th>
                <th className="border border-black p-1 text-center font-bold">Employee Contribution</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Amount Withdraws as Loan</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Loan Principal repayment</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Balance of outstanding loan</th>
                <th colSpan={2} className="border border-black p-1 text-center font-bold">Profit on</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Total Employee's Fund</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">PBS Contribution</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Profit on PBS Contribution</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Total Office Contribution</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Cumulative Fund Balance</th>
                <th className="border border-black p-1 text-center font-bold no-print">Actions</th>
              </tr>
              <tr className="bg-white">
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5 text-center font-bold">1</th>
                <th className="border border-black p-0.5 text-center font-bold">2</th>
                <th className="border border-black p-0.5 text-center font-bold">3</th>
                <th className="border border-black p-0.5 text-center font-bold">4</th>
                <th className="border border-black p-0.5 font-bold text-center leading-tight">Employee Contribution (5)</th>
                <th className="border border-black p-0.5 font-bold text-center leading-tight">CPF Loan (6)</th>
                <th className="border border-black p-0.5 font-bold text-center italic">7 = Prev + 1 - 2 + 3 + 5 + 6</th>
                <th className="border border-black p-0.5 text-center font-bold">8</th>
                <th className="border border-black p-0.5 text-center font-bold">9</th>
                <th className="border border-black p-0.5 font-bold text-center italic">10 = Prev + (8 + 9)</th>
                <th className="border border-black p-0.5 font-bold text-center italic">11 = (7 + 10)</th>
                <th className="border border-black p-0.5 no-print"></th>
              </tr>
            </thead>
            <tbody>
              {isSummariesLoading ? (
                <tr><td colSpan={14} className="text-center p-4">Loading ledger...</td></tr>
              ) : calculatedRows.length === 0 ? (
                <tr><td colSpan={14} className="text-center p-4 text-muted-foreground">No ledger entries found.</td></tr>
              ) : calculatedRows.map((row: any, idx) => (
                <tr key={idx} className="bg-white group hover:bg-slate-50 transition-colors">
                  <td className="border border-black p-1 whitespace-nowrap">{row.summaryDate}</td>
                  <td className="border border-black p-1">{row.particulars || "-"}</td>
                  <td className="border border-black p-1 text-right">{row.col1.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{row.col2.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{row.col3.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{row.col4.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{row.col5.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{row.col6.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-bold">{row.col7.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{row.col8.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{row.col9.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-bold">{row.col10.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-bold">{row.col11.toFixed(2)}</td>
                  <td className="border border-black p-1 text-center no-print whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditClick(row)}>
                        <Edit2 className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteEntry(row.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {totals && (
                <tr className="bg-white font-bold">
                  <td colSpan={2} className="border border-black p-1 text-center">Total</td>
                  <td className="border border-black p-1 text-right">{totals.col1.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{totals.col2.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{totals.col3.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-1 text-right">{totals.col5.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{totals.col6.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-1 text-right">{totals.col8.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{totals.col9.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{(totals.col8 + totals.col9).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-0.5 no-print"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-12 flex justify-between items-end text-[9px]">
           <p className="font-bold">{member.memberIdNumber}--{member.name}--{member.designation} =Page 1 of 1</p>
           <p className="text-right italic">CPF Management Software developed by Ariful Islam contact: 01731753731</p>
        </div>
      </div>
    </div>
  );
}
