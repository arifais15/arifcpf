
"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Printer, 
  ArrowLeft, 
  Loader2, 
  Plus, 
  Edit2, 
  Trash2, 
  Calculator, 
  ArrowRightLeft, 
  UserX, 
  ChevronLeft,
  ChevronRight,
  ListFilter,
  CalendarDays
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageHeaderActions } from "@/components/header-actions";

export default function MemberLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();
  
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isInterestOpen, setIsInterestOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Date Range Filtering
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [selectedInterestMode, setSelectedInterestMode] = useState<"fy" | "custom">("fy");
  const [selectedInterestFY, setSelectedInterestFY] = useState<string>("");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [profitPostingDate, setProfitPostingDate] = useState("");
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const memberRef = useMemoFirebase(() => doc(firestore, "members", resolvedParams.id), [firestore, resolvedParams.id]);
  const { data: member, isLoading: isMemberLoading } = useDoc(memberRef);

  const summariesRef = useMemoFirebase(() => collection(firestore, "members", resolvedParams.id, "fundSummaries"), [firestore, resolvedParams.id]);
  const { data: summaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

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

  // Initial Date Setup (Default to all time)
  useEffect(() => {
    setDateRange({ start: "", end: "" }); 
  }, []);

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

  // CALCULATION ENGINE WITH DATE RANGE AND COLUMN-WISE OPENING SUPPORT
  const ledgerLogic = useMemo(() => {
    if (!sortedSummaries) return { rows: [], totals: { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 }, latest: { col4: 0, col7: 0, col10: 0, col11: 0 }, opening: null };

    let runningLoanBalance = 0;
    let runningEmployeeFund = 0;
    let runningOfficeFund = 0;

    let opC1 = 0, opC2 = 0, opC3 = 0, opC4 = 0, opC5 = 0, opC6 = 0, opC7 = 0, opC8 = 0, opC9 = 0, opC10 = 0, opC11 = 0;
    const startTime = dateRange.start ? new Date(dateRange.start).getTime() : 0;
    const endTime = dateRange.end ? new Date(dateRange.end).getTime() : Infinity;

    const allCalculated = sortedSummaries.map((row: any) => {
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
        col1, col2, col3, col4: runningLoanBalance, col5, col6, col7: runningEmployeeFund, col8, col9, col10: runningOfficeFund, col11,
        timestamp: new Date(row.summaryDate).getTime()
      };
    });

    // Extract Opening Balance column-wise if range is set
    if (dateRange.start) {
      const preRecords = allCalculated.filter(r => r.timestamp < startTime);
      preRecords.forEach(r => {
        opC1 += r.col1;
        opC2 += r.col2;
        opC3 += r.col3;
        opC5 += r.col5;
        opC6 += r.col6;
        opC8 += r.col8;
        opC9 += r.col9;
      });
      if (preRecords.length > 0) {
        const lastPre = preRecords[preRecords.length - 1];
        opC4 = lastPre.col4;
        opC7 = lastPre.col7;
        opC10 = lastPre.col10;
        opC11 = lastPre.col11;
      }
    }

    // Filter for current view
    const filtered = allCalculated.filter(r => r.timestamp >= startTime && r.timestamp <= endTime);

    // Sum of period (excluding opening)
    const sums = filtered.reduce((acc, r) => ({
      c1: acc.c1 + r.col1, c2: acc.c2 + r.col2, c3: acc.c3 + r.col3, c5: acc.c5 + r.col5, c6: acc.c6 + r.col6, c8: acc.c8 + r.col8, c9: acc.c9 + r.col9
    }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

    const lastRow = filtered.length > 0 ? filtered[filtered.length - 1] : { col4: opC4, col7: opC7, col10: opC10, col11: opC11 };

    return {
      rows: filtered,
      opening: { 
        date: dateRange.start, 
        particulars: "Opening Balance B/F", 
        col1: opC1, col2: opC2, col3: opC3, col4: opC4, 
        col5: opC5, col6: opC6, col7: opC7, 
        col8: opC8, col9: opC9, col10: opC10, 
        col11: opC11 
      },
      totals: sums,
      latest: { col4: lastRow.col4, col7: lastRow.col7, col10: lastRow.col10, col11: lastRow.col11 },
      hasOpening: !!dateRange.start
    };
  }, [sortedSummaries, dateRange]);

  const paginatedRows = useMemo(() => {
    if (pageSize === -1) return ledgerLogic.rows;
    const start = (currentPage - 1) * pageSize;
    return ledgerLogic.rows.slice(start, start + pageSize);
  }, [ledgerLogic.rows, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(ledgerLogic.rows.length / pageSize);

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
      const relevant = sortedSummaries.filter(s => new Date(s.summaryDate) <= targetDate);
      let cumulativeBalance = 0;
      relevant.forEach(r => {
        const v = { c1: Number(r.employeeContribution)||0, c2: Number(r.loanWithdrawal)||0, c3: Number(r.loanRepayment)||0, c5: Number(r.profitEmployee)||0, c6: Number(r.profitLoan)||0, c8: Number(r.pbsContribution)||0, c9: Number(r.profitPbs)||0 };
        cumulativeBalance += (v.c1 + v.c3 + v.c5 + v.c6 + v.c8 + v.c9) - v.c2;
      });

      const interest = calculateTieredAnnual(cumulativeBalance) / 12;
      totalInterest += interest;
      monthlyDetails.push({
        label: targetDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
        isOpening: targetDate.getDate() !== 31 && targetDate.getMonth() === 5 && selectedInterestMode === 'fy',
        balance: cumulativeBalance,
        interest
      });
    }
    return { totalInterest, monthlyDetails, label, isDuplicate };
  }, [selectedInterestMode, selectedInterestFY, customRange, sortedSummaries, summaries, interestTiers]);

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
    const relevant = sortedSummaries.filter(s => new Date(s.summaryDate) <= new Date(profitPostingDate));
    let empFund = 0, officeFund = 0;
    relevant.forEach(r => {
      const v = { c1: Number(r.employeeContribution)||0, c2: Number(r.loanWithdrawal)||0, c3: Number(r.loanRepayment)||0, c5: Number(r.profitEmployee)||0, c6: Number(r.profitLoan)||0, c8: Number(r.pbsContribution)||0, c9: Number(r.profitPbs)||0 };
      empFund += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6);
      officeFund += (v.c8 + v.c9);
    });

    const totalFund = empFund + officeFund;
    let rawProfitEmp = 0, rawProfitPbs = 0;
    if (totalFund > 0) {
      rawProfitEmp = (interestCalculation.totalInterest * empFund) / totalFund;
      rawProfitPbs = (interestCalculation.totalInterest * officeFund) / totalFund;
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
    showAlert({ title: "Posted", description: "Profit recorded.", type: "success" });
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
      contributionSource: formData.get("contributionSource") || "Local",
      lastUpdateDate: new Date().toISOString(),
      createdAt: editingEntry?.createdAt || new Date().toISOString(),
      memberId: resolvedParams.id
    };
    if (editingEntry?.id) updateDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", editingEntry.id), entryData);
    else addDocumentNonBlocking(summariesRef, entryData);
    setIsEntryOpen(false);
    setEditingEntry(null);
  };

  const handleFinalSettlement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const settlementEntry = {
      summaryDate: formData.get("date") as string,
      particulars: `Final Settlement (${formData.get("type")})`,
      employeeContribution: -ledgerLogic.latest.col7,
      loanWithdrawal: 0, 
      loanRepayment: ledgerLogic.latest.col4, 
      profitEmployee: 0,
      profitLoan: 0,
      pbsContribution: -ledgerLogic.latest.col10,
      profitPbs: 0,
      lastUpdateDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      memberId: resolvedParams.id
    };
    addDocumentNonBlocking(summariesRef, settlementEntry);
    updateDocumentNonBlocking(memberRef, { status: formData.get("type") as string });
    setIsSettlementOpen(false);
    showAlert({ title: "Settled", description: "Account zeroed out successfully.", type: "success" });
  };

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;
  if (!member) return <div className="p-8 text-center bg-white"><h1 className="text-2xl font-black text-black uppercase">Member not found</h1></div>;

  return (
    <div className="p-6 md:p-10 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <PageHeaderActions>
        <Link href="/members" className="p-2 hover:bg-black/5 rounded-full transition-colors mr-2">
          <ArrowLeft className="size-5 text-black" />
        </Link>
        <div className="flex items-center gap-3 bg-black/5 p-1 rounded-xl h-10 px-3">
          <CalendarDays className="size-4 text-black/40" />
          <div className="flex items-center gap-2">
            <Input type="date" value={dateRange.start} onChange={(e) => { setDateRange({...dateRange, start: e.target.value}); setCurrentPage(1); }} className="h-7 w-[120px] bg-white border-black/20 text-[10px] font-black focus:ring-0 uppercase" />
            <ArrowRightLeft className="size-3 text-black/20" />
            <Input type="date" value={dateRange.end} onChange={(e) => { setDateRange({...dateRange, end: e.target.value}); setCurrentPage(1); }} className="h-7 w-[120px] bg-white border-black/20 text-[10px] font-black focus:ring-0 uppercase" />
          </div>
          {(dateRange.start || dateRange.end) && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-600" onClick={() => setDateRange({ start: "", end: "" })}>
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
        <div className="h-8 w-px bg-black/10 mx-1" />
        <div className="flex items-center bg-black/5 p-1 rounded-xl h-10 overflow-hidden">
          <div className="flex items-center gap-2 px-3">
            <Label className="text-[9px] font-black uppercase text-black">View:</Label>
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
              <SelectTrigger className="h-7 w-[70px] border-black/20 bg-white font-black text-[10px] focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5" className="font-black text-[10px]">5 Rows</SelectItem>
                <SelectItem value="10" className="font-black text-[10px]">10 Rows</SelectItem>
                <SelectItem value="25" className="font-black text-[10px]">25 Rows</SelectItem>
                <SelectItem value="-1" className="font-black text-[10px]">View All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {pageSize !== -1 && totalPages > 1 && (
            <div className="flex items-center gap-1 border-l border-black/10 ml-1 pl-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}><ChevronLeft className="size-3.5" /></Button>
              <span className="text-[10px] font-black tabular-nums">{currentPage}/{totalPages}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}><ChevronRight className="size-3.5" /></Button>
            </div>
          )}
        </div>
        <div className="h-8 w-px bg-black/10 mx-1" />
        <div className="flex items-center gap-1">
          <Button variant="outline" onClick={() => setIsEntryOpen(true)} className="h-9 border-black font-black text-[10px] uppercase gap-1.5 px-3"><Plus className="size-3.5" /> Entry</Button>
          <Button variant="outline" onClick={() => setIsInterestOpen(true)} className="h-9 border-black font-black text-[10px] uppercase gap-1.5 px-3"><Calculator className="size-3.5" /> Profit</Button>
          <Button variant="outline" onClick={() => setIsSettlementOpen(true)} className="h-9 border-black font-black text-[10px] uppercase gap-1.5 px-3"><UserX className="size-3.5" /> Settle</Button>
          <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-[10px] uppercase gap-1.5 px-4 ml-1"><Printer className="size-3.5" /> Print</Button>
        </div>
      </PageHeaderActions>

      <div className="bg-white p-8 md:p-12 shadow-2xl rounded-none border-2 border-black max-w-[1400px] mx-auto w-full font-ledger text-black print-container">
        <div className="relative mb-8 text-center border-b-2 border-black pb-6">
          <p className="text-[10px] absolute left-0 top-0 font-black uppercase tracking-[0.2em] text-black">REB Form no: 224</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-widest text-black mt-1">Contributory Provident Fund</p>
          <h2 className="text-lg md:text-xl font-black underline underline-offset-8 uppercase tracking-[0.25em] mt-4 text-black">Provident Fund Subsidiary Ledger</h2>
          {(dateRange.start || dateRange.end) && (
            <p className="text-[10px] font-black uppercase tracking-widest mt-6 bg-black text-white px-4 py-1.5 inline-block">Audit Period: {dateRange.start || "Genesis"} to {dateRange.end || "Today"}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-x-10 gap-y-4 mb-8 text-[13px] border-b-2 border-black pb-6 font-black text-black">
          {[
            { label: "Member Name", value: member.name, sub: "uppercase text-[15px]" },
            { label: "Designation", value: member.designation, sub: "text-sm uppercase" },
            { label: "ID Number", value: member.memberIdNumber, sub: "font-mono text-base" },
            { label: "Address", value: member.permanentAddress || "-", sub: "text-xs italic" },
            { label: "Joined Date", value: member.dateJoined, sub: "text-sm" },
            { label: "Status", value: member.status || "Active", sub: "uppercase text-xs bg-black text-white px-2 py-0.5 rounded ml-2" },
          ].map((item, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <span className="font-black min-w-[100px] uppercase text-[9px] text-black mb-0.5 tracking-widest">{item.label}</span>
              <span className={cn("font-black border-b-2 border-black flex-1 pb-0.5 text-black truncate", item.sub)}>{item.value}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-[11px] border-collapse border-2 border-black table-fixed text-black font-black">
            <thead className="bg-slate-100 font-black border-b-2 border-black text-black">
              <tr>
                <th rowSpan={3} className="border-2 border-black p-1 text-center w-[75px] uppercase text-[9px] tracking-tighter text-black">Date</th>
                <th rowSpan={3} className="border-2 border-black p-1 text-center w-[170px] uppercase text-[9px] tracking-tighter text-black">Particulars</th>
                <th colSpan={4} className="border-2 border-black p-1 text-center uppercase text-[9px] bg-slate-200/50 text-black">Contributions & Loans</th>
                <th colSpan={2} className="border-2 border-black p-1 text-center uppercase text-[9px] bg-slate-100 text-black">Profits Received</th>
                <th colSpan={1} className="border-2 border-black p-1 text-center uppercase text-[9px] bg-slate-200 text-black">Net Fund 7=(Pre+1-2+3+5+6)</th>
                <th colSpan={3} className="border-2 border-black p-1 text-center uppercase text-[9px] bg-slate-100 text-black">PBS Contribution & Profit (10=8+9)</th>
                <th rowSpan={3} className="border-2 border-black p-1 text-right w-[110px] uppercase text-[10px] bg-slate-200 text-black">Cumulative Total (Col 11=7+10)</th>
                <th rowSpan={3} className="border-2 border-black p-1 text-center no-print w-[80px] uppercase text-[9px] text-black">Action</th>
              </tr>
              <tr className="bg-slate-50 text-[10px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                  <th key={i} className="border border-black p-0.5 text-center font-mono text-black">{i}</th>
                ))}
              </tr>
              <tr className="text-[8px] uppercase leading-none text-black">
                <th className="border border-black p-1 text-right">Contrib</th>
                <th className="border border-black p-1 text-right">Draw</th>
                <th className="border border-black p-1 text-right">Payment</th>
                <th className="border border-black p-1 text-right bg-slate-200">Balance</th>
                <th className="border border-black p-1 text-right">Emp Profit</th>
                <th className="border border-black p-1 text-right">Loan Profit</th>
                <th className="border border-black p-1 text-right bg-slate-200">Net Emp</th>
                <th className="border border-black p-1 text-right">PBS Cont</th>
                <th className="border border-black p-1 text-right">PBS Profit</th>
                <th className="border border-black p-1 text-right bg-slate-100">Net Office</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-black tabular-nums text-black">
              {ledgerLogic.hasOpening && ledgerLogic.opening && (
                <tr className="bg-slate-50 font-black italic border-b border-black">
                  <td className="border border-black p-1 text-center font-mono text-black">{ledgerLogic.opening.date}</td>
                  <td className="border border-black p-1 text-left uppercase text-black">{ledgerLogic.opening.particulars}</td>
                  <td className="border border-black p-1 text-right text-black">{ledgerLogic.opening.col1.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledgerLogic.opening.col2.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledgerLogic.opening.col3.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-100 text-black font-black">{ledgerLogic.opening.col4.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledgerLogic.opening.col5.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledgerLogic.opening.col6.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-100 text-black font-black">{ledgerLogic.opening.col7.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledgerLogic.opening.col8.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{ledgerLogic.opening.col9.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-100 text-black font-black">{ledgerLogic.opening.col10.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200 text-black font-black">{ledgerLogic.opening.col11.toLocaleString()}</td>
                  <td className="border border-black p-1 no-print"></td>
                </tr>
              )}

              {(typeof window !== 'undefined' && window.matchMedia('print').matches ? ledgerLogic.rows : paginatedRows).map((row: any, idx) => (
                <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors border-b border-black">
                  <td className="border border-black p-1 text-center font-mono font-black text-black">{row.summaryDate}</td>
                  <td className="border border-black p-1 text-left font-black uppercase leading-tight truncate text-black">{row.particulars || "-"}</td>
                  <td className="border border-black p-1 text-right text-black">{row.col1.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{row.col2.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{row.col3.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-100 text-black">{row.col4.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{row.col5.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{row.col6.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-100 text-black">{row.col7.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{row.col8.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right text-black">{row.col9.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-100 text-black">{row.col10.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200 text-black">{row.col11.toLocaleString()}</td>
                  <td className="border border-black p-1 text-center no-print">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-black hover:bg-slate-200" onClick={() => { setEditingEntry(row); setIsEntryOpen(true); }}><Edit2 className="size-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-black hover:bg-slate-200" onClick={() => deleteDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", row.id))}><Trash2 className="size-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-black border-t-2 border-black tabular-nums text-black">
              <tr className="h-10 text-[10px]">
                <td className="border border-black p-1.5 text-center uppercase" colSpan={2}>Aggregate Period Portions:</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c1.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c2.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c3.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-200">{(ledgerLogic.latest.col4).toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c5.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c6.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-200">{(ledgerLogic.latest.col7).toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c8.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c9.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-200">{(ledgerLogic.latest.col10).toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-300 font-black text-sm">{(ledgerLogic.latest.col11).toLocaleString()}</td>
                <td className="border border-black p-1 no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div className="mt-10 pt-6 border-t-2 border-black flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-black">
          <span>Institutional Trust Audit • Form 224 Generated Output</span>
          <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
        </div>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-2xl bg-white border-2 border-black p-0 overflow-hidden rounded-2xl shadow-2xl">
          <DialogHeader className="p-6 border-b-2 border-black bg-slate-50 flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-2xl font-black text-black tracking-tight uppercase">{editingEntry ? "Edit Ledger Entry" : "New Ledger Entry"}</DialogTitle>
            <DialogClose asChild><Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-slate-200 text-black"><UserX className="size-4" /></Button></DialogClose>
          </DialogHeader>
          <form onSubmit={handleSaveEntry} className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-sm font-black text-black ml-1 uppercase">Transaction Date</Label><Input name="summaryDate" type="date" defaultValue={editingEntry?.summaryDate} required className="border-2 border-black font-black text-black h-12 focus:ring-0 rounded-xl bg-slate-50" /></div>
              <div className="space-y-2"><Label className="text-sm font-black text-black ml-1 uppercase">Voucher Particulars</Label><Input name="particulars" defaultValue={editingEntry?.particulars} required placeholder="Monthly Contribution..." className="border-2 border-black font-black text-black h-12 focus:ring-0 rounded-xl bg-slate-50" /></div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-black text-black ml-1 uppercase">Contribution Source</Label>
              <Select name="contributionSource" defaultValue={editingEntry?.contributionSource || "Local"}>
                <SelectTrigger className="border-2 border-black font-black text-black h-12 rounded-xl bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent className="border-2 border-black"><SelectItem value="Local" className="font-black uppercase">Local PBS (GPBS-2)</SelectItem><SelectItem value="Other" className="font-black uppercase">Other PBS (Transfer)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-6">
              <div className="bg-blue-50/50 p-6 rounded-2xl border-2 border-black grid grid-cols-3 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Emp Cont (Col 1)</Label><Input name="employeeContribution" type="number" step="0.01" defaultValue={editingEntry?.employeeContribution || 0} className="border-2 border-black font-black text-black h-11 tabular-nums rounded-lg bg-white" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Loan Disb (Col 2)</Label><Input name="loanWithdrawal" type="number" step="0.01" defaultValue={editingEntry?.loanWithdrawal || 0} className="border-2 border-black font-black text-black h-11 tabular-nums rounded-lg bg-white" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Loan Repay (Col 3)</Label><Input name="loanRepayment" type="number" step="0.01" defaultValue={editingEntry?.loanRepayment || 0} className="border-2 border-black font-black text-black h-11 tabular-nums rounded-lg bg-white" /></div>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-black grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Profit Emp (Col 5)</Label><Input name="profitEmployee" type="number" step="0.01" defaultValue={editingEntry?.profitEmployee || 0} className="border-2 border-black font-black text-black h-11 tabular-nums rounded-lg bg-white" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Profit Loan (Col 6)</Label><Input name="profitLoan" type="number" step="0.01" defaultValue={editingEntry?.profitLoan || 0} className="border-2 border-black font-black text-black h-11 tabular-nums rounded-lg bg-white" /></div>
              </div>
              <div className="bg-emerald-50/50 p-6 rounded-2xl border-2 border-black grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">PBS Cont (Col 8)</Label><Input name="pbsContribution" type="number" step="0.01" defaultValue={editingEntry?.pbsContribution || 0} className="border-2 border-black font-black text-black h-11 tabular-nums rounded-lg bg-white" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black text-black uppercase tracking-widest ml-1">Profit PBS (Col 9)</Label><Input name="profitPbs" type="number" step="0.01" defaultValue={editingEntry?.profitPbs || 0} className="border-2 border-black font-black text-black h-11 tabular-nums rounded-lg bg-white" /></div>
              </div>
            </div>
            <Button type="submit" className="w-full bg-black text-white font-black h-14 rounded-2xl uppercase tracking-[0.2em] shadow-xl text-sm">Save Record</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isInterestOpen} onOpenChange={setIsInterestOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white border-2 border-black">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-black text-2xl uppercase tracking-tight"><Calculator className="size-6 text-black" /> Profit Accrual Audit</DialogTitle>
            <DialogDescription className="font-black text-black uppercase text-xs">Review monthly basis balances and tiered interest portions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <Tabs value={selectedInterestMode} onValueChange={(v: any) => setSelectedInterestMode(v)}>
              <TabsList className="grid w-full grid-cols-2 border-black border-2 bg-slate-100 h-12">
                <TabsTrigger value="fy" className="font-black data-[state=active]:bg-black data-[state=active]:text-white uppercase text-xs">Fiscal Year</TabsTrigger>
                <TabsTrigger value="custom" className="font-black data-[state=active]:bg-black data-[state=active]:text-white uppercase text-xs">Custom Range</TabsTrigger>
              </TabsList>
              <TabsContent value="fy" className="pt-4">
                <div className="flex-1">
                  <Label className="text-[10px] uppercase font-black text-black tracking-widest ml-1">Fiscal Year Selection</Label>
                  <Select value={selectedInterestFY} onValueChange={setSelectedInterestFY}>
                    <SelectTrigger className="w-full border-2 border-black font-black text-black h-11"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-2 border-black">{availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-black uppercase">{fy}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </TabsContent>
              <TabsContent value="custom" className="pt-4">
                <div className="flex gap-4">
                  <div className="flex-1"><Label className="text-[10px] uppercase font-black text-black tracking-widest ml-1">Period Start</Label><Input type="date" value={customRange.start} onChange={(e) => setCustomRange({...customRange, start: e.target.value})} className="border-2 border-black font-black text-black h-11" /></div>
                  <div className="flex-1"><Label className="text-[10px] uppercase font-black text-black tracking-widest ml-1">Period End</Label><Input type="date" value={customRange.end} onChange={(e) => setCustomRange({...customRange, end: e.target.value})} className="border-2 border-black font-black text-black h-11" /></div>
                </div>
              </TabsContent>
            </Tabs>
            {interestCalculation && (
              <div className="space-y-6">
                <div className="p-6 bg-slate-50 border-2 border-black rounded-xl flex justify-between items-center shadow-md">
                  <div className="flex flex-col"><span className="text-[10px] uppercase font-black text-black tracking-widest mb-1">Total Audit Profit</span><span className="text-3xl font-black text-black tabular-nums">{interestCalculation.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="text-right"><span className="text-[10px] uppercase font-black text-black block tracking-widest mb-1">Audit Period</span><span className="text-sm font-black text-white bg-black px-4 py-1.5 rounded-full uppercase">{interestCalculation.label}</span></div>
                </div>
                <div className="border-2 border-black rounded-xl overflow-hidden shadow-md">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-100 border-b-2 border-black"><tr><th className="p-3 text-left font-black uppercase text-black tracking-widest">Basis Snapshot</th><th className="p-3 text-right font-black uppercase text-black tracking-widest">Balance</th><th className="p-3 text-right font-black uppercase text-black tracking-widest">Portion</th></tr></thead>
                    <tbody className="divide-y divide-black/10 font-black">
                      {interestCalculation.monthlyDetails.map((m, i) => (
                        <tr key={i} className="hover:bg-slate-50 tabular-nums">
                          <td className="p-3 font-black text-black flex items-center gap-2">{m.label} {m.isOpening && <Badge className="text-[9px] h-5 uppercase px-2 font-black bg-black text-white">Opening</Badge>}</td>
                          <td className="p-3 text-right font-black text-black">{m.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-black text-black">{m.interest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 bg-slate-50 p-5 rounded-xl border-2 border-black"><Label className="text-[10px] uppercase font-black text-black tracking-widest ml-1">Ledger Posting Date</Label><Input type="date" value={profitPostingDate} onChange={(e) => setProfitPostingDate(e.target.value)} required className="border-2 border-black font-black text-black h-11" /></div>
              </div>
            )}
          </div>
          <DialogFooter className="bg-slate-50 p-6 -mx-6 -mb-6 border-t-2 border-black mt-4"><Button variant="outline" className="border-2 border-black font-black h-12 px-8 uppercase text-xs text-black" onClick={() => setIsInterestOpen(false)}>Cancel Audit</Button><Button onClick={handlePostInterest} disabled={!interestCalculation || interestCalculation.isDuplicate || !profitPostingDate} className="gap-2 px-10 font-black bg-black text-white h-12 uppercase tracking-widest shadow-xl">Confirm & Post</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettlementOpen} onOpenChange={setIsSettlementOpen}>
        <DialogContent className="max-w-md bg-white border-2 border-black">
          <DialogHeader><DialogTitle className="font-black text-black uppercase">Institutional Final Settlement</DialogTitle></DialogHeader>
          <form onSubmit={handleFinalSettlement} className="space-y-6 py-4">
            <div className="bg-slate-50 p-4 rounded-xl border-2 border-black space-y-2">
              <div className="flex justify-between text-[11px] font-black text-black"><span>Net Employee Equity:</span> <span className="text-black tabular-nums">৳ {ledgerLogic.latest.col7.toLocaleString()}</span></div>
              <div className="flex justify-between text-[11px] font-black text-black"><span>Office matching share:</span> <span className="text-black tabular-nums">৳ {ledgerLogic.latest.col10.toLocaleString()}</span></div>
              <div className="pt-2 border-t-2 border-black flex justify-between font-black text-sm text-black uppercase"><span>Settlement Payable:</span> <span className="tabular-nums">৳ {ledgerLogic.latest.col11.toLocaleString()}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="font-black text-black text-[10px] uppercase tracking-widest">Settlement Date</Label><Input name="date" type="date" required className="border-2 border-black font-black text-black" /></div>
              <div className="space-y-2"><Label className="font-black text-black text-[10px] uppercase tracking-widest">New Status</Label>
                <Select name="type" defaultValue="Retired"><SelectTrigger className="border-2 border-black font-black text-black"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-2 border-black"><SelectItem value="Retired" className="font-black uppercase">Retired</SelectItem><SelectItem value="Transferred" className="font-black uppercase">Transferred</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button type="submit" className="w-full bg-black text-white font-black h-12 uppercase tracking-widest shadow-xl">Execute Settlement</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
