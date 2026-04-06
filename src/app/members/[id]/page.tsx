"use client"

import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, ArrowLeft, Loader2, Plus, Upload, FileSpreadsheet, FileText } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";

export default function MemberLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkCsvData, setBulkCsvData] = useState("");
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

  const handleAddEntry = (e: React.FormEvent<HTMLFormElement>) => {
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

    addDocumentNonBlocking(summariesRef, entryData);
    toast({ title: "Entry Added", description: "Ledger entry has been recorded." });
    setIsEntryOpen(false);
  };

  const processEntries = (entries: any[]) => {
    let count = 0;
    entries.forEach(entry => {
      const entryData = {
        summaryDate: entry.Date || entry.summaryDate || "",
        particulars: entry.Particulars || entry.particulars || "",
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
    toast({ title: "Processing Complete", description: `Added ${count} ledger entries.` });
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
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
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

  const handleBulkCsvUpload = () => {
    const lines = bulkCsvData.trim().split("\n");
    if (lines.length < 2) {
      toast({ title: "Error", description: "Please provide a header line and at least one data line.", variant: "destructive" });
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim());
    const entries = lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const entry: any = {};
      headers.forEach((h, i) => {
        entry[h] = values[i];
      });
      return entry;
    });

    processEntries(entries);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Date": "2023-10-31",
        "Particulars": "Monthly Contribution Oct-23",
        "Employee Contribution": 1500.00,
        "Amount Withdraws as Loan": 0.00,
        "Loan Principal repayment": 0.00,
        "Profit on Employee Contribution": 12.50,
        "Profit on CPF Loan": 0.00,
        "PBS Contribution": 1500.00,
        "Profit on PBS Contribution": 12.50
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LedgerEntries");
    XLSX.writeFile(wb, "ledger_entries_template.xlsx");
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
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Upload className="size-4 mr-2" /> Bulk Upload</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Bulk Upload Ledger Entries</DialogTitle>
                  <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="text-xs h-7 gap-1">
                    <Download className="size-3" />
                    Download Template
                  </Button>
                </div>
                <DialogDescription>
                  Fields: Date, Particulars, Employee Contribution, Amount Withdraws as Loan, Loan Principal repayment, Profit on Employee Contribution, Profit on CPF Loan, PBS Contribution, Profit on PBS Contribution.
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
                    <div className="space-y-1">
                      <p className="font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-muted-foreground">XLSX, XLS or CSV files are supported</p>
                    </div>
                    <Input type="file" className="hidden" ref={fileInputRef} accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} disabled={isUploading} />
                    {isUploading && <Loader2 className="size-4 animate-spin text-primary" />}
                  </div>
                </TabsContent>
                <TabsContent value="csv" className="space-y-4 py-4">
                  <textarea
                    className="min-h-[200px] w-full p-4 font-mono text-sm border rounded-md"
                    placeholder="Date, Particulars, Employee Contribution, Amount Withdraws as Loan, Loan Principal repayment, Profit on Employee Contribution, Profit on CPF Loan, PBS Contribution, Profit on PBS Contribution"
                    value={bulkCsvData}
                    onChange={(e) => setBulkCsvData(e.target.value)}
                  />
                  <Button className="w-full" onClick={handleBulkCsvUpload}>Process CSV Data</Button>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm"><Plus className="size-4 mr-2" /> New Entry</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New Ledger Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddEntry} className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Date</Label>
                  <Input name="summaryDate" type="date" required />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Particulars</Label>
                  <Input name="particulars" placeholder="e.g. PJ-02-001 or Interest" required />
                </div>
                <div className="space-y-2">
                  <Label>Emp. Contrib (Col 1)</Label>
                  <Input name="employeeContribution" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>Loan Withdraw (Col 2)</Label>
                  <Input name="loanWithdrawal" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>Loan Repay (Col 3)</Label>
                  <Input name="loanRepayment" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>Profit Emp (Col 5)</Label>
                  <Input name="profitEmployee" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>Profit Loan (Col 6)</Label>
                  <Input name="profitLoan" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>PBS Contrib (Col 8)</Label>
                  <Input name="pbsContribution" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>Profit PBS (Col 9)</Label>
                  <Input name="profitPbs" type="number" step="0.01" defaultValue="0" />
                </div>
                <DialogFooter className="col-span-2">
                  <Button type="button" variant="outline" onClick={() => setIsEntryOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Entry</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4 mr-2" /> Print Form 224</Button>
          <Button variant="outline" size="sm"><Download className="size-4 mr-2" /> Export PDF</Button>
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
              </tr>
            </thead>
            <tbody>
              {isSummariesLoading ? (
                <tr><td colSpan={13} className="text-center p-4">Loading ledger...</td></tr>
              ) : calculatedRows.length === 0 ? (
                <tr><td colSpan={13} className="text-center p-4 text-muted-foreground">No ledger entries found.</td></tr>
              ) : calculatedRows.map((row: any, idx) => (
                <tr key={idx} className="bg-white">
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
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-12 flex justify-between items-end text-[9px]">
           <p className="font-bold">{member.memberIdNumber}--{member.name}--{member.designation} =Page 1 of 1</p>
           <p className="text-right italic">CPF Management Software Developed by Ariful Islam Agm finance, contact: 017317530731</p>
        </div>
      </div>
    </div>
  );
}