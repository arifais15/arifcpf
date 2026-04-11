"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2, Plus, Upload, FileSpreadsheet, Edit2, Trash2, Calculator, ArrowRightLeft, Calendar, UserX, AlertTriangle, Info, Link as LinkIcon, Download } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [selectedInterestMode, setSelectedInterestMode] = useState<"fy" | "custom">("fy");
  const [selectedInterestFY, setSelectedInterestFY] = useState<string>("");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [profitPostingDate, setProfitPostingDate] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const memberRef = useMemoFirebase(() => doc(firestore, "members", resolvedParams.id), [firestore, resolvedParams.id]);
  const { data: member, isLoading: isMemberLoading } = useDoc(memberRef);

  const summariesRef = useMemoFirebase(() => collection(firestore, "members", resolvedParams.id, "fundSummaries"), [firestore, resolvedParams.id]);
  const { data: summaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  // Fetch Interest Settings
  const interestSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "interest"), [firestore]);
  const { data: interestSettings } = useDoc(interestSettingsRef);

  const interestTiers = useMemo(() => {
    if (interestSettings?.tiers) return interestSettings.tiers;
    return [
      { limit: 1500000, rate: 0.13 },
      { limit: 3000000, rate: 0.12 },
      { limit: null, rate: 0.11 }
    ];
  }, [interestSettings]);

  const sortedSummaries = useMemo(() => {
    return [...(summaries || [])].sort((a, b) => {
      const dateA = new Date(a.summaryDate).getTime();
      const dateB = new Date(b.summaryDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
      const createA = new Date(a.createdAt || 0).getTime();
      const createB = new Date(b.createdAt || 0).getTime();
      return createA - createB;
    });
  }, [summaries]);

  const columnSums = useMemo(() => {
    return sortedSummaries.reduce((acc, row) => ({
      c1: acc.c1 + (Number(row.employeeContribution) || 0),
      c2: acc.c2 + (Number(row.loanWithdrawal) || 0),
      c3: acc.c3 + (Number(row.loanRepayment) || 0),
      c5: acc.c5 + (Number(row.profitEmployee) || 0),
      c6: acc.c6 + (Number(row.profitLoan) || 0),
      c8: acc.c8 + (Number(row.pbsContribution) || 0),
      c9: acc.c9 + (Number(row.profitPbs) || 0),
    }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });
  }, [sortedSummaries]);

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

  const latestRunningTotals = useMemo(() => {
    if (calculatedRows.length === 0) return { empFund: 0, officeFund: 0, total: 0, loanBalance: 0 };
    const last = calculatedRows[calculatedRows.length - 1];
    return {
      empFund: last.col7,
      officeFund: last.col10,
      total: last.col11,
      loanBalance: last.col4
    };
  }, [calculatedRows]);

  const availableFYs = useMemo(() => {
    const fys = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const activeFYStart = currentMonth >= 7 ? currentYear : currentYear - 1;
    for (let i = 0; i < 10; i++) {
      const start = activeFYStart - i;
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
    let totalInterest = 0;
    let remainingBalance = balance;
    let prevLimit = 0;

    for (const tier of interestTiers) {
      if (remainingBalance <= 0) break;

      if (tier.limit === null) {
        totalInterest += remainingBalance * tier.rate;
        break;
      } else {
        const tierCapacity = tier.limit - prevLimit;
        const amountInTier = Math.min(remainingBalance, tierCapacity);
        totalInterest += amountInTier * tier.rate;
        remainingBalance -= amountInTier;
        prevLimit = tier.limit;
      }
    }
    return totalInterest;
  };

  const interestCalculation = useMemo(() => {
    let monthsToCalculate = 0;
    let label = "";
    const basisDates: Date[] = [];

    if (selectedInterestMode === "fy") {
      if (!selectedInterestFY) return null;
      const [startYearStr] = selectedInterestFY.split("-");
      const startYear = parseInt(startYearStr);
      monthsToCalculate = 12;
      label = `FY ${selectedInterestFY}`;
      for (let i = 0; i < 12; i++) {
        let mIdx, yr;
        if (i === 0) { mIdx = 5; yr = startYear; }
        else { mIdx = (i + 5) % 12; yr = i < 7 ? startYear : startYear + 1; }
        basisDates.push(new Date(yr, mIdx + 1, 0, 23, 59, 59, 999));
      }
    } else {
      if (!customRange.start || !customRange.end) return null;
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      monthsToCalculate = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      label = `Custom Range`;
      const opening = new Date(start);
      opening.setDate(opening.getDate() - 1);
      opening.setHours(23, 59, 59, 999);
      basisDates.push(opening);
      for (let i = 0; i < monthsToCalculate - 1; i++) {
        basisDates.push(new Date(start.getFullYear(), start.getMonth() + i + 1, 0, 23, 59, 59, 999));
      }
    }
    
    const isDuplicate = summaries?.some(s => s.particulars?.includes(`Annual Profit ${label}`));
    const monthlyDetails = [];
    let totalInterest = 0;

    for (const targetDate of basisDates) {
      const lastEntry = [...calculatedRows].filter(r => new Date(r.summaryDate) <= targetDate).pop();
      const balance = lastEntry ? lastEntry.col11 : 0;
      const interest = calculateTieredAnnual(balance) / 12;
      totalInterest += interest;
      monthlyDetails.push({
        label: targetDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
        isOpening: targetDate.getDate() !== 31 && targetDate.getMonth() === 5 && selectedInterestMode === 'fy',
        balance,
        interest
      });
    }
    return { totalInterest, monthlyDetails, label, isDuplicate };
  }, [selectedInterestMode, selectedInterestFY, customRange, calculatedRows, summaries, interestTiers]);

  useEffect(() => {
    if (selectedInterestMode === "fy" && selectedInterestFY) {
      const [startYearStr] = selectedInterestFY.split("-");
      setProfitPostingDate(`${parseInt(startYearStr) + 1}-06-30`);
    } else if (selectedInterestMode === "custom" && customRange.end) {
      setProfitPostingDate(customRange.end);
    }
  }, [selectedInterestMode, selectedInterestFY, customRange.end]);

  const handlePostInterest = () => {
    if (!interestCalculation || !profitPostingDate) return;
    if (interestCalculation.isDuplicate) {
      showAlert({ title: "Duplicate Entry", description: "Profit for this period is already posted.", type: "error" });
      return;
    }
    const empFund = latestRunningTotals.empFund;
    const pbsFund = latestRunningTotals.officeFund;
    const totalFund = empFund + pbsFund;
    let rawProfitEmp = 0, rawProfitPbs = 0;
    if (totalFund > 0) {
      rawProfitEmp = (interestCalculation.totalInterest * empFund) / totalFund;
      rawProfitPbs = (interestCalculation.totalInterest * pbsFund) / totalFund;
    } else {
      rawProfitEmp = interestCalculation.totalInterest / 2;
      rawProfitPbs = interestCalculation.totalInterest / 2;
    }
    addDocumentNonBlocking(summariesRef, {
      summaryDate: profitPostingDate,
      particulars: `Annual Profit ${interestCalculation.label} (Tiered)`,
      employeeContribution: 0, loanWithdrawal: 0, loanRepayment: 0,
      profitEmployee: Math.round(rawProfitEmp), profitLoan: 0, pbsContribution: 0, profitPbs: Math.round(rawProfitPbs),
      lastUpdateDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      memberId: resolvedParams.id
    });
    showAlert({ title: "Posted", description: `Profit recorded on ${profitPostingDate}.`, type: "success" });
    setIsInterestOpen(false);
  };

  const handleFinalSettlement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = formData.get("date") as string;
    const type = formData.get("type") as string;

    if (latestRunningTotals.total === 0 && latestRunningTotals.loanBalance === 0) {
      showAlert({ title: "Zero Balance", description: "Ledger already has no outstanding balance.", type: "info" });
      return;
    }

    const settlementEntry = {
      summaryDate: date,
      particulars: `Final Settlement (${type}) - Full Column Clearance`,
      employeeContribution: -columnSums.c1,
      loanWithdrawal: 0, 
      loanRepayment: latestRunningTotals.loanBalance, 
      profitEmployee: -columnSums.c5,
      profitLoan: -columnSums.c6,
      pbsContribution: -columnSums.c8,
      profitPbs: -columnSums.c9,
      lastUpdateDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      memberId: resolvedParams.id,
      isSettlement: true
    };

    addDocumentNonBlocking(summariesRef, settlementEntry);
    updateDocumentNonBlocking(memberRef, { 
      status: type, 
      settlementDate: date,
      settledAmount: latestRunningTotals.total
    });

    showAlert({ title: "Account Zeroed", description: `Final reversal entries posted. All ledger columns now zero. Status set to ${type}.`, type: "success" });
    setIsSettlementOpen(false);
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
      contributionSource: formData.get("contributionSource") || "Local",
      lastUpdateDate: new Date().toISOString(),
      createdAt: editingEntry?.createdAt || new Date().toISOString(),
      memberId: resolvedParams.id,
      isManual: true
    };
    if (editingEntry?.id) updateDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", editingEntry.id), entryData);
    else addDocumentNonBlocking(summariesRef, entryData);
    setIsEntryOpen(false);
    setEditingEntry(null);
  };

  const handleDeleteEntry = (id: string) => {
    showAlert({ title: "Confirm Deletion", description: "Remove this ledger entry?", type: "warning", showCancel: true, onConfirm: () => {
      deleteDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", id));
    }});
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsUploading(true); const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = XLSX.utils.sheet_to_json(XLSX.read(event.target?.result, { type: "binary" }).Sheets[XLSX.read(event.target?.result, { type: "binary" }).SheetNames[0]]);
        data.forEach((entry: any) => {
          addDocumentNonBlocking(summariesRef, {
            summaryDate: entry.Date || entry.summaryDate || "", particulars: entry.Particulars || entry.particulars || "",
            employeeContribution: Number(entry["Employee Contribution"] || 0), loanWithdrawal: Number(entry["Amount Withdraws as Loan"] || 0),
            loanRepayment: Number(entry["Loan Principal repayment"] || 0), profitEmployee: Number(entry["Profit on Employee Contribution"] || 0),
            profitLoan: Number(entry["Profit on CPF Loan"] || 0), pbsContribution: Number(entry["PBS Contribution"] || 0),
            profitPbs: Number(entry["Profit on PBS Contribution"] || 0), 
            contributionSource: entry["Source"] || "Local",
            lastUpdateDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            memberId: resolvedParams.id,
            isManual: true
          });
        });
        showAlert({ title: "Imported", description: "Ledger entries processed.", type: "success" });
      } catch (err) { toast({ title: "Failed", description: "Invalid file format.", variant: "destructive" }); }
      finally { setIsUploading(false); }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Date": "2024-01-01",
        "Particulars": "Monthly Contribution",
        "Employee Contribution": 5000,
        "Amount Withdraws as Loan": 0,
        "Loan Principal repayment": 0,
        "Profit on Employee Contribution": 0,
        "Profit on CPF Loan": 0,
        "PBS Contribution": 5000,
        "Profit on PBS Contribution": 0,
        "Source": "Local"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    XLSX.writeFile(wb, "member_ledger_import_template.xlsx");
  };

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  if (!member) return <div className="p-8 text-center"><h1 className="text-2xl font-bold">Member not found</h1></div>;

  return (
    <div className="p-6 md:p-10 flex flex-col gap-8 bg-slate-50 min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between no-print max-w-[1400px] mx-auto w-full gap-6">
        <Link href="/members" className="flex items-center gap-2 text-[15px] text-slate-500 hover:text-primary font-bold transition-colors">
          <ArrowLeft className="size-5" /> Back to Registry
        </Link>
        <div className="flex flex-wrap gap-3">
          <Dialog open={isSettlementOpen} onOpenChange={setIsSettlementOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg" className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50 font-bold" disabled={latestRunningTotals.total === 0 && latestRunningTotals.loanBalance === 0}>
                <UserX className="size-5" /> Final Settlement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Employee Final Settlement</DialogTitle>
                <DialogDescription>This will post negative reversals for all column totals to bring every balance to exactly zero.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleFinalSettlement} className="space-y-6 py-4">
                <div className="bg-slate-50 p-4 rounded-xl border space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500"><span>Net Emp. Fund:</span> <span className="text-slate-900">৳ {latestRunningTotals.empFund.toLocaleString()}</span></div>
                  {latestRunningTotals.loanBalance > 0 && (
                    <div className="flex justify-between text-xs font-bold text-rose-600"><span>Loan to Clear (Col 3):</span> <span className="text-rose-700">৳ {latestRunningTotals.loanBalance.toLocaleString()}</span></div>
                  )}
                  <div className="flex justify-between text-xs font-bold text-slate-500"><span>Office Fund:</span> <span className="text-slate-900">৳ {latestRunningTotals.officeFund.toLocaleString()}</span></div>
                  <div className="pt-2 border-t flex justify-between font-black text-sm text-primary uppercase"><span>Payable Amount:</span> <span>৳ {latestRunningTotals.total.toLocaleString()}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Settlement Date</Label><Input name="date" type="date" required /></div>
                  <div className="space-y-2">
                    <Label>Settlement Type</Label>
                    <Select name="type" defaultValue="Retired">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Retired">Retirement</SelectItem>
                        <SelectItem value="Transferred">Transfer</SelectItem>
                        <SelectItem value="InActive">InActive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 flex gap-3">
                  <AlertTriangle className="size-5 text-orange-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-orange-700 leading-tight"><b>Settlement Rule:</b> All individual column totals will be negated. Outstanding Loan Balance will be cleared by posting to Repayment column.</p>
                </div>
                <DialogFooter><Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">Post Reversals & Close Account</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isInterestOpen} onOpenChange={setIsInterestOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg" className="gap-2 border-primary/20 text-primary hover:bg-primary/5 font-bold">
                <Calculator className="size-5" /> Profit Calculator
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calculator className="size-5 text-primary" />
                  Profit Accrual Audit
                </DialogTitle>
                <DialogDescription>Review monthly basis balances and tiered interest portions before posting to ledger.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <Tabs value={selectedInterestMode} onValueChange={(v: any) => setSelectedInterestMode(v)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="fy">Fiscal Year</TabsTrigger>
                    <TabsTrigger value="custom">Custom Range</TabsTrigger>
                  </TabsList>
                  <TabsContent value="fy" className="pt-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Select Fiscal Year</Label>
                        <Select value={selectedInterestFY} onValueChange={setSelectedInterestFY}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{availableFYs.map(fy => <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="custom" className="pt-4">
                    <div className="flex gap-4">
                      <div className="flex-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Start Date</Label><Input type="date" value={customRange.start} onChange={(e) => setCustomRange({...customRange, start: e.target.value})} /></div>
                      <div className="flex-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">End Date</Label><Input type="date" value={customRange.end} onChange={(e) => setCustomRange({...customRange, end: e.target.value})} /></div>
                    </div>
                  </TabsContent>
                </Tabs>

                {interestCalculation && (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="p-4 bg-primary/5 border rounded-xl flex justify-between items-center shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-primary opacity-70">Total Computed Profit Share</span>
                        <span className="text-2xl font-black text-primary">৳ {interestCalculation.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Calculation Basis</span>
                        <span className="text-xs font-bold text-slate-600">{interestCalculation.label}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                          <Info className="size-3.5" /> Calculation Breakdown
                        </h4>
                        {interestCalculation.isDuplicate && (
                          <Badge variant="destructive" className="h-5 text-[9px] uppercase">Duplicate Entry Detected</Badge>
                        )}
                      </div>
                      
                      <div className="border rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-[10px] border-collapse">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="p-2.5 text-left font-bold uppercase text-slate-500">Basis Month</th>
                              <th className="p-2.5 text-right font-bold uppercase text-slate-500">Snapshot Balance (৳)</th>
                              <th className="p-2.5 text-right font-bold uppercase text-slate-500">1/12th Portion (৳)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {interestCalculation.monthlyDetails.map((m, i) => (
                              <tr key={i} className={cn("hover:bg-slate-50/50", m.isOpening && "bg-blue-50/30")}>
                                <td className="p-2.5 font-semibold flex items-center gap-2">
                                  {m.label}
                                  {m.isOpening && <Badge variant="secondary" className="text-[8px] h-4 uppercase px-1 font-black">Opening</Badge>}
                                </td>
                                <td className="p-2.5 text-right font-mono">{m.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="p-2.5 text-right font-bold text-emerald-700 font-mono">{m.interest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50 font-black border-t-2">
                            <tr>
                              <td className="p-2.5 uppercase text-slate-500">Total Audit Profit:</td>
                              <td colSpan={2} className="p-2.5 text-right text-primary text-sm">৳ {interestCalculation.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Ledger Posting Date</Label>
                      <Input type="date" value={profitPostingDate} onChange={(e) => setProfitPostingDate(e.target.value)} required className="font-bold border-slate-300 focus:bg-white" />
                      <p className="text-[9px] text-muted-foreground italic">Note: The profit will be split between Employee and PBS fund columns proportionally based on the current ledger status.</p>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="bg-slate-50 p-4 -mx-6 -mb-6 border-t mt-4">
                <Button variant="outline" onClick={() => setIsInterestOpen(false)}>Cancel</Button>
                <Button onClick={handlePostInterest} disabled={!interestCalculation || interestCalculation.isDuplicate || !profitPostingDate} className="gap-2 px-8 font-bold">
                  <Plus className="size-4" /> Synchronize to Ledger
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg" className="gap-2 border-slate-300 font-bold"><Upload className="size-5" /> Bulk Upload</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Import Ledger Records</DialogTitle>
                  <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="h-7 text-[10px] font-bold gap-1 uppercase hover:bg-primary/5">
                    <Download className="size-3" /> Template
                  </Button>
                </div>
                <DialogDescription>Select an Excel file containing historical ledger entries for this member.</DialogDescription>
              </DialogHeader>
              <div className="p-12 border-2 border-dashed border-muted rounded-xl text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="mx-auto size-12 text-primary opacity-50 mb-4" />
                <p className="font-bold">Select XLSX Ledger File</p>
                <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">Max 5MB • .XLSX Only</p>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleExcelUpload} disabled={isUploading} />
                {isUploading && <Loader2 className="animate-spin size-4 mx-auto mt-4 text-primary" />}
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="secondary" size="lg" onClick={() => setIsEntryOpen(true)} className="gap-2 font-bold"><Plus className="size-5" /> New Entry</Button>
          <Button variant="outline" size="lg" onClick={() => window.print()} className="gap-2 border-slate-300 font-bold"><Printer className="size-5" /> Print Ledger</Button>
        </div>
      </div>

      <div className="bg-white p-10 md:p-12 shadow-2xl rounded-none border-2 border-slate-200 max-w-[1400px] mx-auto w-full font-ledger text-black print-container">
        <div className="relative mb-8 text-center border-b-2 border-black pb-6">
          <p className="text-[10px] absolute left-0 top-0 font-black uppercase tracking-[0.2em] opacity-70">REB Form no: 224</p>
          {member.status && member.status !== 'Active' && (
            <Badge className={cn("absolute right-0 top-0 uppercase text-[11px] font-black px-3 py-1", member.status === 'Retired' ? 'bg-orange-50 text-orange-700 border-orange-200' : member.status === 'Transferred' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600')}>
              {member.status} ACCOUNT
            </Badge>
          )}
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">{pbsName}</h1>
          <h2 className="text-lg md:text-xl font-bold underline underline-offset-8 uppercase tracking-[0.25em] mt-3 text-slate-800">Provident Fund Subsidiary Ledger</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 mb-10 text-[13px]">
          <div className="space-y-3">
            <div className="flex gap-3 items-end"><span className="font-black min-w-[120px] uppercase text-[10px] text-slate-500 mb-0.5 tracking-wider">Member Name</span><span className="font-black border-b border-black/30 flex-1 pb-0.5 text-lg">{member.name}</span></div>
            <div className="flex gap-3 items-end"><span className="font-black min-w-[120px] uppercase text-[10px] text-slate-500 mb-0.5 tracking-wider">Address</span><span className="font-bold border-b border-black/30 flex-1 pb-0.5">{member.currentAddress || "-"}</span></div>
            <div className="flex gap-3 items-end"><span className="font-black min-w-[120px] uppercase text-[10px] text-slate-500 mb-0.5 tracking-wider">Joined Date</span><span className="font-black border-b border-black/30 flex-1 pb-0.5">{member.dateJoined}</span></div>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3 items-end"><span className="font-black min-w-[140px] uppercase text-[10px] text-slate-500 mb-0.5 tracking-wider">Designation</span><span className="font-black border-b border-black/30 flex-1 pb-0.5">{member.designation}</span></div>
            <div className="flex gap-x-6">
               <div className="flex gap-3 flex-1 items-end"><span className="font-black min-w-[50px] uppercase text-[10px] text-slate-500 mb-0.5 tracking-wider">ID No</span><span className="font-black border-b border-black/30 flex-1 pb-0.5 font-mono text-lg">{member.memberIdNumber}</span></div>
               <div className="flex gap-3 flex-1 items-end"><span className="font-black whitespace-nowrap uppercase text-[10px] text-slate-500 mb-0.5 tracking-wider">Status</span><span className="font-black border-b border-black/30 flex-1 pb-0.5 uppercase text-sm text-primary">{member.status || "Active"}</span></div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-[12px] border-collapse border border-black table-fixed">
            <thead className="bg-slate-50/90 font-black">
              <tr>
                <th className="border border-black p-1.5 text-center w-[75px] uppercase text-[10px]">Date</th>
                <th className="border border-black p-1.5 text-center w-[180px] uppercase text-[10px] align-top">Particulars</th>
                <th className="border border-black p-1.5 text-center w-[85px] uppercase text-[10px] leading-tight">Emp. Cont (Col 1)</th>
                <th className="border border-black p-1.5 text-center w-[85px] uppercase text-[10px] leading-tight text-rose-900">Loan Dr (Col 2)</th>
                <th className="border border-black p-1.5 text-center w-[85px] uppercase text-[10px] leading-tight text-emerald-900">Loan Cr (Col 3)</th>
                <th className="border border-black p-1.5 text-center w-[90px] uppercase text-[10px] leading-tight bg-slate-100">Loan Bal (Col 4)</th>
                <th className="border border-black p-1.5 text-center w-[85px] uppercase text-[10px] leading-tight">Profit Emp (Col 5)</th>
                <th className="border border-black p-1.5 text-center w-[85px] uppercase text-[10px] leading-tight">Profit Loan (Col 6)</th>
                <th className="border border-black p-1.5 text-center w-[95px] uppercase text-[10px] leading-tight bg-primary/10">Net Emp (Col 7)</th>
                <th className="border border-black p-1.5 text-center w-[85px] uppercase text-[10px] leading-tight">PBS Cont (Col 8)</th>
                <th className="border border-black p-1.5 text-center w-[85px] uppercase text-[10px] leading-tight">Profit PBS (Col 9)</th>
                <th className="border border-black p-1.5 text-center w-[95px] uppercase text-[10px] leading-tight bg-primary/10">Net PBS (Col 10)</th>
                <th className="border border-black p-1.5 text-center w-[110px] uppercase text-[10px] leading-tight bg-slate-200">TOTAL (Col 11)</th>
                <th className="border border-black p-1.5 text-center no-print w-[90px] uppercase text-[10px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/30">
              {isSummariesLoading ? <tr><td colSpan={14} className="text-center p-12 italic text-lg">Loading ledger data...</td></tr> : calculatedRows.map((row: any, idx) => (
                <tr key={idx} className={cn("bg-white hover:bg-slate-50/80 transition-colors", row.particulars?.includes("Settlement") && "bg-slate-50 italic")}>
                  <td className="border border-black p-1.5 text-center font-mono font-bold">{row.summaryDate}</td>
                  <td className="border border-black p-1.5 text-left break-words font-bold align-top">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5">
                        {row.particulars || "-"}
                        {row.journalEntryId && <Link href={`/transactions/new?edit=${row.journalEntryId}`} className="no-print"><Badge variant="outline" className="text-[8px] h-4 px-1.5 bg-primary/5 text-primary border-primary/20 font-black"><LinkIcon className="size-2 mr-1" /> JV</Badge></Link>}
                      </span>
                      {row.contributionSource === 'Other' && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-slate-400 w-fit font-black uppercase">Other PBS</Badge>
                      )}
                    </div>
                  </td>
                  <td className="border border-black p-1.5 text-right font-medium">{row.col1.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1.5 text-right text-rose-800 font-bold">{row.col2.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1.5 text-right text-emerald-800 font-bold">{row.col3.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className={cn("border border-black p-1.5 text-right font-black bg-slate-100/50", row.col4 === 0 && "text-slate-300")}>{row.col4.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1.5 text-right text-accent font-bold">{row.col5.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1.5 text-right text-accent font-bold">{row.col6.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className={cn("border border-black p-1.5 text-right font-black bg-primary/5", row.col7 === 0 && "text-slate-300")}>{row.col7.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1.5 text-right font-medium">{row.col8.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1.5 text-right text-accent font-bold">{row.col9.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className={cn("border border-black p-1.5 text-right font-black bg-primary/5", row.col10 === 0 && "text-slate-300")}>{row.col10.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className={cn("border border-black p-1.5 text-right font-black bg-slate-200 text-[13px]", row.col11 === 0 && "text-slate-300")}>{row.col11.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="border border-black p-1.5 text-center no-print">
                    <div className="flex gap-1.5 justify-center">
                      {!row.isSyncedFromJV ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingEntry(row); setIsEntryOpen(true); }}><Edit2 className="size-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => handleDeleteEntry(row.id)}><Trash2 className="size-4" /></Button>
                        </>
                      ) : (
                        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter opacity-50">JV Sync</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-black border-t-2 border-black sticky bottom-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
              <tr>
                <td className="border border-black p-2 text-center uppercase text-[11px]" colSpan={2}>Grand Ledger Totals:</td>
                <td className="border border-black p-2 text-right text-[13px]">{columnSums.c1.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right text-rose-800 text-[13px]">{columnSums.c2.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right text-emerald-800 text-[13px]">{columnSums.c3.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right bg-slate-200/50 text-[13px]">{latestRunningTotals.loanBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right text-accent text-[13px]">{columnSums.c5.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right text-accent text-[13px]">{columnSums.c6.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right bg-primary/10 text-[13px]">{latestRunningTotals.empFund.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right text-[13px]">{columnSums.c8.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right text-accent text-[13px]">{columnSums.c9.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right bg-primary/10 text-[13px]">{latestRunningTotals.officeFund.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right bg-slate-300 text-[14px] underline decoration-double">৳ {latestRunningTotals.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div className="mt-10 pt-6 border-t border-black flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
          <span>CPF Management Software</span>
          <span className="italic">Developed by: Ariful Islam,AGMF,Gazipur PBS-2</span>
        </div>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingEntry ? "Edit" : "New"} Ledger Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEntry} className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Date</Label><Input name="summaryDate" type="date" defaultValue={editingEntry?.summaryDate} required /></div>
              <div className="space-y-2"><Label>Particulars</Label><Input name="particulars" defaultValue={editingEntry?.particulars} required /></div>
            </div>

            <div className="space-y-2">
              <Label>Contribution Source</Label>
              <Select name="contributionSource" defaultValue={editingEntry?.contributionSource || "Local"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Local">Local PBS (GPBS-2)</SelectItem>
                  <SelectItem value="Other">Other PBS (Transfer In)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border">
              <div className="space-y-2"><Label>Emp Contrib (Col 1)</Label><Input name="employeeContribution" type="number" step="0.01" defaultValue={editingEntry?.employeeContribution || 0} /></div>
              <div className="space-y-2"><Label>Loan Withdraw (Col 2)</Label><Input name="loanWithdrawal" type="number" step="0.01" defaultValue={editingEntry?.loanWithdrawal || 0} /></div>
              <div className="space-y-2"><Label>Loan Repay (Col 3)</Label><Input name="loanRepayment" type="number" step="0.01" defaultValue={editingEntry?.loanRepayment || 0} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-accent/5 rounded-lg border border-accent/10">
              <div className="space-y-2"><Label>Profit Emp. (Col 5)</Label><Input name="profitEmployee" type="number" step="0.01" defaultValue={editingEntry?.profitEmployee || 0} /></div>
              <div className="space-y-2"><Label>Profit Loan (Col 6)</Label><Input name="profitLoan" type="number" step="0.01" defaultValue={editingEntry?.profitLoan || 0} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
              <div className="space-y-2"><Label>PBS Contrib (Col 8)</Label><Input name="pbsContribution" type="number" step="0.01" defaultValue={editingEntry?.pbsContribution || 0} /></div>
              <div className="space-y-2"><Label>Profit PBS (Col 9)</Label><Input name="profitPbs" type="number" step="0.01" defaultValue={editingEntry?.profitPbs || 0} /></div>
            </div>

            <DialogFooter><Button type="submit" className="w-full">Save Record</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}