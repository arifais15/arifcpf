
"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2, Plus, Upload, FileSpreadsheet, FileText, Edit2, Trash2, Info, Calculator, Percent, Calendar, ShieldCheck, AlertCircle } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function MemberLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isInterestOpen, setIsInterestOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkCsvData, setBulkCsvData] = useState("");
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [selectedInterestMode, setSelectedInterestMode] = useState<"fy" | "custom">("fy");
  const [selectedInterestFY, setSelectedInterestFY] = useState<string>("");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memberRef = useMemoFirebase(() => doc(firestore, "members", resolvedParams.id), [firestore, resolvedParams.id]);
  const { data: member, isLoading: isMemberLoading } = useDoc(memberRef);

  const summariesRef = useMemoFirebase(() => collection(firestore, "members", resolvedParams.id, "fundSummaries"), [firestore, resolvedParams.id]);
  const { data: summaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const sortedSummaries = useMemo(() => {
    return [...(summaries || [])].sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime());
  }, [summaries]);

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

      runningLoanBalance = runningLoanBalance + col2 - col3;
      runningEmployeeFund = runningEmployeeFund + col1 - col2 + col3 + col5 + col6;
      runningOfficeFund = runningOfficeFund + col8 + col9;
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

  const availableFYs = useMemo(() => {
    const fys = new Set<string>();
    const now = new Date();
    const currentYear = now.getFullYear();
    for (let i = 0; i < 10; i++) {
      const start = currentYear - i;
      fys.add(`${start}-${(start + 1).toString().slice(-2)}`);
    }
    return Array.from(fys);
  }, []);

  useEffect(() => {
    if (availableFYs.length > 0 && !selectedInterestFY) {
      setSelectedInterestFY(availableFYs[1]); // Default to previous closed FY
    }
  }, [availableFYs, selectedInterestFY]);

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

  const interestCalculation = useMemo(() => {
    let startYear = 0;
    let monthsToCalculate = 0;
    let label = "";

    if (selectedInterestMode === "fy") {
      if (!selectedInterestFY) return null;
      const [startYearStr] = selectedInterestFY.split("-");
      startYear = parseInt(startYearStr);
      monthsToCalculate = 12;
      label = `FY ${selectedInterestFY}`;
    } else {
      if (!customRange.start || !customRange.end) return null;
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      monthsToCalculate = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      label = `Custom Range`;
    }
    
    const isDuplicate = summaries?.some(s => s.particulars?.includes(`Annual Profit ${label}`));
    const monthlyDetails = [];
    let totalInterest = 0;

    for (let i = 0; i < monthsToCalculate; i++) {
      let currentMonth: Date;
      if (selectedInterestMode === "fy") {
        let mIdx, yr;
        if (i === 0) {
          mIdx = 5; // June (Prior)
          yr = startYear;
        } else {
          mIdx = (i + 5) % 12;
          yr = i < 7 ? startYear : startYear + 1;
        }
        currentMonth = new Date(yr, mIdx + 1, 0);
      } else {
        const base = new Date(customRange.start);
        currentMonth = new Date(base.getFullYear(), base.getMonth() + i + 1, 0);
      }

      const lastEntryInMonth = [...calculatedRows]
        .filter(r => new Date(r.summaryDate) <= currentMonth)
        .pop();
      
      const balance = lastEntryInMonth ? lastEntryInMonth.col11 : 0;
      const monthlyInterest = calculateTieredAnnual(balance) / 12;
      
      totalInterest += monthlyInterest;
      monthlyDetails.push({
        monthName: currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
        balance,
        interest: monthlyInterest
      });
    }

    return { totalInterest, monthlyDetails, label, isDuplicate };
  }, [selectedInterestMode, selectedInterestFY, customRange, calculatedRows, summaries]);

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

  const handlePostInterest = () => {
    if (!interestCalculation) return;

    if (interestCalculation.isDuplicate) {
      showAlert({ title: "Duplicate Entry", description: "Profit for this period is already posted.", type: "error" });
      return;
    }

    const lastRow = calculatedRows[calculatedRows.length - 1];
    const empFund = lastRow?.col7 || 0;
    const pbsFund = lastRow?.col10 || 0;
    const totalFund = empFund + pbsFund;

    let profitEmployee = 0;
    let profitPbs = 0;

    if (totalFund > 0) {
      profitEmployee = (interestCalculation.totalInterest * empFund) / totalFund;
      profitPbs = (interestCalculation.totalInterest * pbsFund) / totalFund;
    } else {
      profitEmployee = interestCalculation.totalInterest / 2;
      profitPbs = interestCalculation.totalInterest / 2;
    }

    let summaryDate = "";
    if (selectedInterestMode === "fy") {
        const [startYearStr] = selectedInterestFY.split("-");
        const endYear = parseInt(startYearStr) + 1;
        summaryDate = `${endYear}-06-30`;
    } else {
        summaryDate = customRange.end;
    }

    const entryData = {
      summaryDate,
      particulars: `Annual Profit ${interestCalculation.label} (Proportional)`,
      employeeContribution: 0,
      loanWithdrawal: 0,
      loanRepayment: 0,
      profitEmployee,
      profitLoan: 0,
      pbsContribution: 0,
      profitPbs,
      lastUpdateDate: new Date().toISOString(),
      memberId: resolvedParams.id
    };

    addDocumentNonBlocking(summariesRef, entryData);
    showAlert({ title: "Posted", description: `Tiered profit has been added on ${summaryDate}.`, type: "success" });
    setIsInterestOpen(false);
  };

  const handleSaveEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const entryData = {
      summaryDate: formData.get("summaryDate") as string,
      particulars: formData.get("particulars") as string,
      employeeContribution: Number(formData.get("employeeContribution") || 0),
      loanWithdrawal: Number(formData.get("loanWithdrawal") || 0),
      loanRepayment: Number(formData.get("loanRepayment") || 0),
      profitEmployee: Number(formData.get("profitEmployee") || 0),
      profitLoan: Number(formData.get("profitLoan") || 0),
      pbsContribution: Number(formData.get("pbsContribution") || 0),
      profitPbs: Number(formData.get("profitPbs") || 0),
      lastUpdateDate: new Date().toISOString(),
      memberId: resolvedParams.id
    };

    if (editingEntry?.id) {
      updateDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", editingEntry.id), entryData);
    } else {
      addDocumentNonBlocking(summariesRef, entryData);
    }
    setIsEntryOpen(false);
    setEditingEntry(null);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = XLSX.utils.sheet_to_json(XLSX.read(event.target?.result, { type: "binary" }).Sheets[XLSX.read(event.target?.result, { type: "binary" }).SheetNames[0]]);
        data.forEach((entry: any) => {
          addDocumentNonBlocking(summariesRef, {
            summaryDate: entry.Date || entry.summaryDate || "",
            particulars: entry.Particulars || entry.particulars || "",
            employeeContribution: Number(entry["Employee Contribution"] || 0),
            loanWithdrawal: Number(entry["Amount Withdraws as Loan"] || 0),
            loanRepayment: Number(entry["Loan Principal repayment"] || 0),
            profitEmployee: Number(entry["Profit on Employee Contribution"] || 0),
            profitLoan: Number(entry["Profit on CPF Loan"] || 0),
            pbsContribution: Number(entry["PBS Contribution"] || 0),
            profitPbs: Number(entry["Profit on PBS Contribution"] || 0),
            lastUpdateDate: new Date().toISOString(),
            memberId: resolvedParams.id
          });
        });
        showAlert({ title: "Imported", description: "Ledger entries processed.", type: "success" });
      } catch (err) {
        toast({ title: "Failed", description: "Invalid file format.", variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  if (!member) return <div className="p-8 text-center"><h1 className="text-2xl font-bold">Member not found</h1></div>;

  return (
    <div className="p-4 flex flex-col gap-4 bg-slate-100 min-h-screen">
      <div className="flex items-center justify-between no-print max-w-[1200px] mx-auto w-full">
        <Link href="/members" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="size-4" /> Back to Registry
        </Link>
        <div className="flex gap-2">
          <Dialog open={isInterestOpen} onOpenChange={setIsInterestOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary">
                <Calculator className="size-4" /> Profit Calculator
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Subsidiary Ledger Profit Accrual</DialogTitle>
                <DialogDescription>Based on June Closing to May Ending Balance ratio.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <Tabs value={selectedInterestMode} onValueChange={(v: any) => setSelectedInterestMode(v)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="fy">Fiscal Year</TabsTrigger>
                    <TabsTrigger value="custom">Custom Range</TabsTrigger>
                  </TabsList>
                  <TabsContent value="fy" className="pt-4">
                    <Select value={selectedInterestFY} onValueChange={setSelectedInterestFY}>
                      <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{availableFYs.map(fy => <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>)}</SelectContent>
                    </Select>
                  </TabsContent>
                </Tabs>
                {interestCalculation && (
                  <div className="space-y-4">
                    <div className="flex justify-between p-4 bg-slate-50 border rounded-lg">
                      <div><p className="text-xs text-muted-foreground">Period</p><p className="font-bold">{interestCalculation.label}</p></div>
                      <div className="text-right"><p className="text-xs text-muted-foreground">Total Profit</p><p className="text-2xl font-bold text-primary">৳ {interestCalculation.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto border rounded-md">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 sticky top-0"><tr><th className="p-2 text-left">Month</th><th className="p-2 text-right">Balance</th><th className="p-2 text-right">Interest</th></tr></thead>
                        <tbody className="divide-y">{interestCalculation.monthlyDetails.map((d, i) => <tr key={i}><td className="p-2">{d.monthName}</td><td className="p-2 text-right">৳ {d.balance.toLocaleString()}</td><td className="p-2 text-right font-bold text-accent">৳ {d.interest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInterestOpen(false)}>Cancel</Button>
                <Button onClick={handlePostInterest} disabled={!interestCalculation || interestCalculation.isDuplicate}>Post to Ledger (June 30)</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={() => setIsBulkOpen(true)}><Upload className="size-4 mr-2" /> Bulk Upload</Button>
          <Button variant="secondary" size="sm" onClick={() => setIsEntryOpen(true)}><Plus className="size-4 mr-2" /> New Entry</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4 mr-2" /> Print Landscape</Button>
        </div>
      </div>

      <div className="bg-white p-12 shadow-none rounded-none border-none max-w-[1200px] mx-auto w-full font-ledger font-light text-black print-container">
        <div className="relative mb-6 text-center">
          <p className="text-[10px] absolute left-0 top-0">REB Form no: 224</p>
          <h1 className="text-xl font-bold">Gazipur PBS-2</h1>
          <h2 className="text-lg font-bold underline underline-offset-4">Provident Fund Subsidiary Ledger</h2>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-[11px]">
          <div className="space-y-2">
            <div className="flex gap-2"><span className="font-bold min-w-[100px]">Name:</span><span className="font-bold border-b border-dotted border-black flex-1">{member.name}</span></div>
            <div className="flex gap-2"><span className="font-bold min-w-[100px]">Curr. Address:</span><span className="border-b border-dotted border-black flex-1">{member.currentAddress || "-"}</span></div>
            <div className="flex gap-2"><span className="font-bold min-w-[100px]">Date of Joined:</span><span className="font-bold border-b border-dotted border-black flex-1">{member.dateJoined}</span></div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2"><span className="font-bold min-w-[120px]">Designation:</span><span className="font-bold border-b border-dotted border-black flex-1">{member.designation}</span></div>
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
                <th className="border border-black p-1 text-center font-bold w-[70px]">Date</th>
                <th className="border border-black p-1 text-center font-bold w-[220px]">Particulars</th>
                <th className="border border-black p-1 text-center font-bold">Emp. Contribution</th>
                <th className="border border-black p-1 text-center font-bold">Loan Withdrawal</th>
                <th className="border border-black p-1 text-center font-bold">Loan Repayment</th>
                <th className="border border-black p-1 text-center font-bold">O/S Loan Bal</th>
                <th colSpan={2} className="border border-black p-1 text-center font-bold">Profit (Emp/Loan)</th>
                <th className="border border-black p-1 text-center font-bold">Total Emp Fund</th>
                <th className="border border-black p-1 text-center font-bold">PBS Contrib</th>
                <th className="border border-black p-1 text-center font-bold">Profit PBS</th>
                <th className="border border-black p-1 text-center font-bold">Total Office</th>
                <th className="border border-black p-1 text-center font-bold">Cumul. Fund</th>
                <th className="border border-black p-1 text-center font-bold no-print w-[60px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {isSummariesLoading ? <tr><td colSpan={14} className="text-center p-4">Loading...</td></tr> : calculatedRows.map((row: any, idx) => (
                <tr key={idx} className="bg-white hover:bg-slate-50">
                  <td className="border border-black p-1 text-center whitespace-nowrap">{row.summaryDate}</td>
                  <td className="border border-black p-1 text-left break-words whitespace-normal overflow-visible min-w-[200px] leading-tight font-medium">
                    {row.particulars || "-"}
                  </td>
                  <td className="border border-black p-1 text-right">{row.col1.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{row.col2.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{row.col3.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{row.col4.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{row.col5.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{row.col6.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right font-bold">{row.col7.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{row.col8.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{row.col9.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right font-bold">{row.col10.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right font-bold bg-slate-50/30">{row.col11.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-center no-print">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingEntry(row); setIsEntryOpen(true); }}><Edit2 className="size-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteEntry(row.id)}><Trash2 className="size-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent><DialogHeader><DialogTitle>Bulk Import</DialogTitle></DialogHeader>
          <div className="p-8 border-2 border-dashed text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <FileSpreadsheet className="mx-auto size-8 mb-2" />
            <p>Select XLSX File</p>
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleExcelUpload} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEntry ? "Edit" : "New"} Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEntry} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2"><Label>Date</Label><Input name="summaryDate" type="date" defaultValue={editingEntry?.summaryDate} required /></div>
            <div className="col-span-2 space-y-2"><Label>Particulars</Label><Input name="particulars" defaultValue={editingEntry?.particulars} required /></div>
            <div className="space-y-2"><Label>Emp Contrib</Label><Input name="employeeContribution" type="number" step="0.01" defaultValue={editingEntry?.employeeContribution || 0} /></div>
            <div className="space-y-2"><Label>Loan Withdraw</Label><Input name="loanWithdrawal" type="number" step="0.01" defaultValue={editingEntry?.loanWithdrawal || 0} /></div>
            <div className="space-y-2"><Label>Loan Repay</Label><Input name="loanRepayment" type="number" step="0.01" defaultValue={editingEntry?.loanRepayment || 0} /></div>
            <div className="space-y-2"><Label>Profit Emp</Label><Input name="profitEmployee" type="number" step="0.01" defaultValue={editingEntry?.profitEmployee || 0} /></div>
            <div className="space-y-2"><Label>Profit Loan</Label><Input name="profitLoan" type="number" step="0.01" defaultValue={editingEntry?.profitLoan || 0} /></div>
            <div className="space-y-2"><Label>PBS Contrib</Label><Input name="pbsContribution" type="number" step="0.01" defaultValue={editingEntry?.pbsContribution || 0} /></div>
            <div className="space-y-2"><Label>Profit PBS</Label><Input name="profitPbs" type="number" step="0.01" defaultValue={editingEntry?.profitPbs || 0} /></div>
            <DialogFooter className="col-span-2"><Button type="submit">Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
