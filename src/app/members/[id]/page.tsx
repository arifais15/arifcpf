"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2, Plus, Upload, FileSpreadsheet, Edit2, Trash2, Calculator } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
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
    const fys = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    for (let i = 0; i < 10; i++) {
      const start = currentYear - i;
      fys.push(`${start}-${(start + 1).toString().slice(-2)}`);
    }
    return fys;
  }, []);

  useEffect(() => {
    if (availableFYs.length > 0 && !selectedInterestFY) {
      setSelectedInterestFY(availableFYs[1]);
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

  const handleDeleteEntry = (id: string) => {
    showAlert({
      title: "Confirm Deletion",
      description: "Are you sure you want to remove this ledger entry?",
      type: "warning",
      showCancel: true,
      onConfirm: () => {
        deleteDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", id));
      }
    });
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
    <div className="p-4 md:p-6 flex flex-col gap-6 bg-slate-50 min-h-screen font-ledger">
      <div className="flex items-center justify-between no-print max-w-[1300px] mx-auto w-full">
        <Link href="/members" className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary font-medium transition-colors">
          <ArrowLeft className="size-4" /> Back to Registry
        </Link>
        <div className="flex gap-2">
          <Dialog open={isInterestOpen} onOpenChange={setIsInterestOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-primary/20 text-primary hover:bg-primary/5">
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
                      <div><p className="text-xs text-muted-foreground uppercase font-bold">Period</p><p className="font-bold text-lg">{interestCalculation.label}</p></div>
                      <div className="text-right"><p className="text-xs text-muted-foreground uppercase font-bold">Total Profit</p><p className="text-2xl font-bold text-primary">৳ {interestCalculation.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto border rounded-md shadow-inner">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 sticky top-0 border-b">
                          <tr>
                            <th className="p-2 text-left font-bold uppercase">Month</th>
                            <th className="p-2 text-right font-bold uppercase">Balance</th>
                            <th className="p-2 text-right font-bold uppercase">Interest</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {interestCalculation.monthlyDetails.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-2">{d.monthName}</td>
                              <td className="p-2 text-right">৳ {d.balance.toLocaleString()}</td>
                              <td className="p-2 text-right font-bold text-emerald-700">৳ {d.interest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
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

          <Button variant="outline" size="sm" onClick={() => setIsBulkOpen(true)} className="gap-2 border-slate-300"><Upload className="size-4" /> Bulk Upload</Button>
          <Button variant="secondary" size="sm" onClick={() => setIsEntryOpen(true)} className="gap-2"><Plus className="size-4" /> New Entry</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 border-slate-300"><Printer className="size-4" /> Print Ledger</Button>
        </div>
      </div>

      <div className="bg-white p-6 md:p-10 shadow-sm rounded-none border border-slate-200 max-w-[1300px] mx-auto w-full font-ledger text-black print-container">
        <div className="relative mb-6 text-center border-b-2 border-black pb-4">
          <p className="text-[9px] absolute left-0 top-0 font-bold uppercase tracking-widest opacity-70">REB Form no: 224</p>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight">Gazipur Palli Bidyut Samity-2</h1>
          <h2 className="text-md md:text-lg font-bold underline underline-offset-8 uppercase tracking-[0.2em] mt-2">Provident Fund Subsidiary Ledger</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 mb-8 text-[11px] md:text-[12px]">
          <div className="space-y-2">
            <div className="flex gap-2 items-end"><span className="font-bold min-w-[100px] uppercase text-[9px] text-slate-500 mb-0.5">Member Name</span><span className="font-bold border-b border-black/30 flex-1 pb-0.5 text-sm">{member.name}</span></div>
            <div className="flex gap-2 items-end"><span className="font-bold min-w-[100px] uppercase text-[9px] text-slate-500 mb-0.5">Address</span><span className="border-b border-black/30 flex-1 pb-0.5">{member.currentAddress || "-"}</span></div>
            <div className="flex gap-2 items-end"><span className="font-bold min-w-[100px] uppercase text-[9px] text-slate-500 mb-0.5">Joined Date</span><span className="font-bold border-b border-black/30 flex-1 pb-0.5">{member.dateJoined}</span></div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2 items-end"><span className="font-bold min-w-[120px] uppercase text-[9px] text-slate-500 mb-0.5">Designation</span><span className="font-bold border-b border-black/30 flex-1 pb-0.5">{member.designation}</span></div>
            <div className="flex gap-x-4">
               <div className="flex gap-2 flex-1 items-end"><span className="font-bold min-w-[40px] uppercase text-[9px] text-slate-500 mb-0.5">ID No</span><span className="font-bold border-b border-black/30 flex-1 pb-0.5 font-mono text-sm">{member.memberIdNumber}</span></div>
               <div className="flex gap-2 flex-1 items-end"><span className="font-bold whitespace-nowrap uppercase text-[9px] text-slate-500 mb-0.5">Nomination Date</span><span className="font-bold border-b border-black/30 flex-1 pb-0.5">{member.dateNomination || "-"}</span></div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-[9px] border-collapse border border-black table-fixed">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="border border-black p-1 text-center font-bold w-[70px] uppercase text-[7.5px]">Date</th>
                <th className="border border-black p-1 text-center font-bold w-[220px] uppercase text-[7.5px]">Particulars</th>
                <th className="border border-black p-1 text-center font-bold w-[80px] uppercase text-[7.5px]">Emp. Contrib.</th>
                <th className="border border-black p-1 text-center font-bold w-[80px] uppercase text-[7.5px]">Loan Withdr.</th>
                <th className="border border-black p-1 text-center font-bold w-[80px] uppercase text-[7.5px]">Loan Repay.</th>
                <th className="border border-black p-1 text-center font-bold w-[85px] uppercase text-[7.5px]">O/S Loan</th>
                <th className="border border-black p-1 text-center font-bold w-[75px] uppercase text-[7.5px]">Profit (E)</th>
                <th className="border border-black p-1 text-center font-bold w-[75px] uppercase text-[7.5px]">Profit (L)</th>
                <th className="border border-black p-1 text-center font-bold w-[90px] uppercase text-[7.5px]">Emp. Fund</th>
                <th className="border border-black p-1 text-center font-bold w-[80px] uppercase text-[7.5px]">PBS Contrib.</th>
                <th className="border border-black p-1 text-center font-bold w-[75px] uppercase text-[7.5px]">Profit (P)</th>
                <th className="border border-black p-1 text-center font-bold w-[90px] uppercase text-[7.5px]">Office Fund</th>
                <th className="border border-black p-1 text-center font-bold w-[100px] uppercase text-[7.5px]">Cumul. Fund</th>
                <th className="border border-black p-1 text-center font-bold no-print w-[80px] uppercase text-[7.5px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/20">
              {isSummariesLoading ? <tr><td colSpan={14} className="text-center p-8 italic">Loading ledger data...</td></tr> : calculatedRows.map((row: any, idx) => (
                <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="border border-black p-1 text-center whitespace-nowrap font-mono">{row.summaryDate}</td>
                  <td className="border border-black p-1 text-left break-words whitespace-normal leading-tight font-medium align-top">
                    {row.particulars || "-"}
                  </td>
                  <td className="border border-black p-1 text-right">{row.col1.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right text-rose-800">{row.col2.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right text-emerald-800">{row.col3.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right font-bold bg-slate-50/50">{row.col4.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right text-accent">{row.col5.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right text-accent">{row.col6.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right font-bold bg-primary/5">{row.col7.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{row.col8.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right text-accent">{row.col9.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right font-bold bg-primary/5">{row.col10.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right font-black bg-slate-50 text-[10px]">{row.col11.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-center no-print">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-primary" onClick={() => { setEditingEntry(row); setIsEntryOpen(true); }}><Edit2 className="size-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500 hover:text-rose-700" onClick={() => handleDeleteEntry(row.id)}><Trash2 className="size-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {calculatedRows.length > 0 && (
              <tfoot className="bg-slate-50/50 font-black text-[8px] uppercase tracking-tighter">
                <tr>
                  <td colSpan={2} className="border border-black p-1 text-right">Ledger Totals:</td>
                  <td className="border border-black p-1 text-right">{calculatedRows.reduce((s, r) => s + r.col1, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{calculatedRows.reduce((s, r) => s + r.col2, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{calculatedRows.reduce((s, r) => s + r.col3, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 bg-slate-100"></td>
                  <td className="border border-black p-1 text-right">{calculatedRows.reduce((s, r) => s + r.col5, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{calculatedRows.reduce((s, r) => s + r.col6, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 bg-slate-100"></td>
                  <td className="border border-black p-1 text-right">{calculatedRows.reduce((s, r) => s + r.col8, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1 text-right">{calculatedRows.reduce((s, r) => s + r.col9, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td colSpan={3} className="border border-black p-1 bg-slate-100"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="mt-16 flex justify-between items-end border-t border-black/10 pt-8 text-[10px]">
           <div className="text-center w-[180px]">
              <div className="border-t border-black/30 pt-1 font-bold">Accountant / Preparer</div>
           </div>
           <div className="text-center w-[180px]">
              <div className="border-t border-black/30 pt-1 font-bold">Checked By</div>
           </div>
           <div className="text-center w-[180px]">
              <div className="border-t border-black/30 pt-1 font-bold">Approved By</div>
           </div>
        </div>
        <p className="text-[7px] text-slate-400 italic text-right mt-4 opacity-50 no-print">System generated subsidiary ledger for PBS CPF</p>
      </div>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Import Ledger Entries</DialogTitle></DialogHeader>
          <div className="p-12 border-2 border-dashed rounded-xl text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
            <FileSpreadsheet className="mx-auto size-12 text-primary opacity-50 mb-4" />
            <p className="font-bold">Select XLSX Ledger File</p>
            <p className="text-xs text-muted-foreground mt-2">Column Headers: Date, Particulars, Employee Contribution, etc.</p>
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleExcelUpload} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingEntry ? "Edit" : "New"} Ledger Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEntry} className="grid grid-cols-2 gap-4 pt-4">
            <div className="col-span-2 space-y-2"><Label>Date</Label><Input name="summaryDate" type="date" defaultValue={editingEntry?.summaryDate} required /></div>
            <div className="col-span-2 space-y-2"><Label>Particulars</Label><Input name="particulars" defaultValue={editingEntry?.particulars} required /></div>
            <div className="space-y-2"><Label>Emp Contrib</Label><Input name="employeeContribution" type="number" step="0.01" defaultValue={editingEntry?.employeeContribution || 0} /></div>
            <div className="space-y-2"><Label>Loan Withdraw</Label><Input name="loanWithdrawal" type="number" step="0.01" defaultValue={editingEntry?.loanWithdrawal || 0} /></div>
            <div className="space-y-2"><Label>Loan Repay</Label><Input name="loanRepayment" type="number" step="0.01" defaultValue={editingEntry?.loanRepayment || 0} /></div>
            <div className="space-y-2"><Label>Profit Emp</Label><Input name="profitEmployee" type="number" step="0.01" defaultValue={editingEntry?.profitEmployee || 0} /></div>
            <div className="space-y-2"><Label>Profit Loan</Label><Input name="profitLoan" type="number" step="0.01" defaultValue={editingEntry?.profitLoan || 0} /></div>
            <div className="space-y-2"><Label>PBS Contrib</Label><Input name="pbsContribution" type="number" step="0.01" defaultValue={editingEntry?.pbsContribution || 0} /></div>
            <div className="space-y-2"><Label>Profit PBS</Label><Input name="profitPbs" type="number" step="0.01" defaultValue={editingEntry?.profitPbs || 0} /></div>
            <DialogFooter className="col-span-2"><Button type="submit" className="w-full">Save Ledger Record</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
