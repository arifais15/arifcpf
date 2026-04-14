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
  CalendarDays,
  ShieldCheck,
  TrendingUp
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
  const [editingEntry, setEditingEntry] = useState<any>(null);
  
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [tempEntry, setTempEntry] = useState({
    c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0
  });

  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const memberRef = useMemoFirebase(() => doc(firestore, "members", resolvedParams.id), [firestore, resolvedParams.id]);
  const { data: member, isLoading: isMemberLoading } = useDoc(memberRef);

  const summariesRef = useMemoFirebase(() => collection(firestore, "members", resolvedParams.id, "fundSummaries"), [firestore, resolvedParams.id]);
  const { data: summaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    const fyStartDate = `${fyStartYear}-07-01`;
    const todayStr = now.toISOString().split('T')[0];
    
    setDateRange({ start: fyStartDate, end: todayStr });
  }, []);

  useEffect(() => {
    if (editingEntry) {
      setTempEntry({
        c1: Number(editingEntry.employeeContribution) || 0,
        c2: Number(editingEntry.loanWithdrawal) || 0,
        c3: Number(editingEntry.loanRepayment) || 0,
        c5: Number(editingEntry.profitEmployee) || 0,
        c6: Number(editingEntry.profitLoan) || 0,
        c8: Number(editingEntry.pbsContribution) || 0,
        c9: Number(editingEntry.profitPbs) || 0,
      });
    } else {
      setTempEntry({ c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });
    }
  }, [editingEntry, isEntryOpen]);

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

    const filtered = allCalculated.filter(r => r.timestamp >= startTime && r.timestamp <= endTime);

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

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
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

  const entryNetFund = useMemo(() => {
    const empNet = tempEntry.c1 - tempEntry.c2 + tempEntry.c3 + tempEntry.c5 + tempEntry.c6;
    const officeNet = tempEntry.c8 + tempEntry.c9;
    return { empNet, officeNet, total: empNet + officeNet };
  }, [tempEntry]);

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;
  if (!member) return <div className="p-8 text-center bg-white"><h1 className="text-2xl font-black text-black uppercase">Member not found</h1></div>;

  return (
    <div className="p-6 md:p-10 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 10mm !important;
          }
          .print-container {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            display: block !important;
          }
          table {
            table-layout: fixed !important;
            width: 100% !important;
          }
          body {
            background-color: white !important;
          }
        }
      `}} />

      <PageHeaderActions>
        <Link href="/members" className="p-2 hover:bg-black/5 rounded-full transition-colors mr-2">
          <ArrowLeft className="size-5 text-black" />
        </Link>
        <div className="flex items-center gap-3 bg-black/5 p-1 rounded-xl h-10 px-3">
          <CalendarDays className="size-4 text-black/40" />
          <div className="flex items-center gap-2">
            <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => { setDateRange({...dateRange, start: e.target.value}); setCurrentPage(1); }} className="h-7 w-[120px] bg-white border-black/20 text-[10px] font-black focus:ring-0 uppercase" />
            <ArrowRightLeft className="size-3 text-black/20" />
            <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => { setDateRange({...dateRange, end: e.target.value}); setCurrentPage(1); }} className="h-7 w-[120px] bg-white border-black/20 text-[10px] font-black focus:ring-0 uppercase" />
          </div>
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
          <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-[10px] uppercase gap-1.5 px-4 ml-1"><Printer className="size-3.5" /> Print</Button>
        </div>
      </PageHeaderActions>

      <div className="bg-white p-8 md:p-12 shadow-2xl rounded-none border-2 border-black max-w-[1400px] mx-auto w-full font-ledger text-black print-container">
        <div className="relative mb-8 text-center border-b-2 border-black pb-6">
          <p className="text-[10px] absolute left-0 top-0 font-black uppercase tracking-[0.2em] text-black">REB Form no: 224</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-black">{pbsName}</h1>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.25em] mt-4 text-black">Provident Fund Subsidiary Ledger</h2>
          {(dateRange.start || dateRange.end) && (
            <p className="text-[10px] font-black uppercase tracking-widest mt-6 bg-black text-white px-4 py-1.5 inline-block">Ledger Period: {dateRange.start || "Genesis"} to {dateRange.end || "Today"}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-x-10 gap-y-4 mb-8 text-[13px] border-b-2 border-black pb-6 font-black text-black">
          {[
            { label: "Member Name", value: member.name, sub: "uppercase text-[15px]" },
            { label: "Designation", value: member.designation, sub: "text-sm uppercase" },
            { label: "ID Number", value: member.memberIdNumber, sub: "font-mono text-base" },
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
          <table className="w-full text-[10px] border-collapse border-2 border-black table-fixed text-black font-black">
            <thead className="bg-slate-100 font-black border-b-2 border-black">
              <tr>
                <th rowSpan={3} className="border-2 border-black p-1 text-center w-[65px] uppercase text-[8px] tracking-tighter">Date</th>
                <th rowSpan={3} className="border-2 border-black p-1 text-center w-[120px] uppercase text-[8px] tracking-tighter">Particulars</th>
                <th colSpan={4} className="border-2 border-black p-1 text-center uppercase text-[8px] bg-slate-200/50">Employees'Contributions & Loans</th>
                <th colSpan={2} className="border-2 border-black p-1 text-center uppercase text-[8px] bg-slate-100">Profits</th>
                <th className="border-2 border-black p-1 text-center uppercase text-[8px] bg-slate-200">Net Fund (7)</th>
                <th colSpan={3} className="border-2 border-black p-1 text-center uppercase text-[8px] bg-slate-100">PBS Contributions</th>
                <th rowSpan={3} className="border-2 border-black p-1 text-right w-[90px] uppercase text-[9px] bg-slate-200">Total (11=7+10)</th>
                <th rowSpan={3} className="border-2 border-black p-1 text-center no-print w-[60px] uppercase text-[8px]">Action</th>
              </tr>
              <tr className="bg-slate-50 text-[9px]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                  <th key={i} className="border border-black p-0.5 text-center font-mono">{i}</th>
                ))}
              </tr>
              <tr className="text-[7px] uppercase leading-none">
                <th className="border border-black p-1 text-right">Contrib</th>
                <th className="border border-black p-1 text-right">Drawal</th>
                <th className="border border-black p-1 text-right">Repay</th>
                <th className="border border-black p-1 text-right bg-slate-200">Balance</th>
                <th className="border border-black p-1 text-right">Emp.Cont</th>
                <th className="border border-black p-1 text-right">Loan.Int</th>
                <th className="border border-black p-1 text-right bg-slate-200">EmNetFund</th>
                <th className="border border-black p-1 text-right">Contrib</th>
                <th className="border border-black p-1 text-right">Profit</th>
                <th className="border border-black p-1 text-right bg-slate-100">NetFund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-black tabular-nums">
              {ledgerLogic.hasOpening && ledgerLogic.opening && (
                <tr className="bg-slate-50 font-black italic border-b border-black">
                  <td className="border border-black p-1 text-center font-mono">{ledgerLogic.opening.date}</td>
                  <td className="border border-black p-1 text-left uppercase">{ledgerLogic.opening.particulars}</td>
                  <td className="border border-black p-1 text-right">{ledgerLogic.opening.col1.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledgerLogic.opening.col2.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledgerLogic.opening.col3.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-100 font-black">{ledgerLogic.opening.col4.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledgerLogic.opening.col5.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledgerLogic.opening.col6.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-100 font-black">{ledgerLogic.opening.col7.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledgerLogic.opening.col8.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{ledgerLogic.opening.col9.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-100 font-black">{ledgerLogic.opening.col10.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-200 font-black">{ledgerLogic.opening.col11.toLocaleString()}</td>
                  <td className="border border-black p-1 no-print"></td>
                </tr>
              )}

              {(typeof window !== 'undefined' && window.matchMedia('print').matches ? ledgerLogic.rows : paginatedRows).map((row: any, idx) => (
                <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors border-b border-black">
                  <td className="border border-black p-1 text-center font-mono">{row.summaryDate}</td>
                  <td className="border border-black p-1 text-left uppercase leading-tight truncate">{row.particulars || "-"}</td>
                  <td className="border border-black p-1 text-right">{row.col1.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.col2.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.col3.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-50">{row.col4.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.col5.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.col6.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-50">{row.col7.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.col8.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.col9.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-50">{row.col10.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right bg-slate-100">{row.col11.toLocaleString()}</td>
                  <td className="border border-black p-1 text-center no-print">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-black hover:bg-slate-200" onClick={() => { setEditingEntry(row); setIsEntryOpen(true); }}><Edit2 className="size-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-black hover:bg-slate-200" onClick={() => deleteDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", row.id))}><Trash2 className="size-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-black border-t-2 border-black tabular-nums">
              <tr className="h-10 text-[9px]">
                <td className="border border-black p-1.5 text-center uppercase" colSpan={2}>Aggregate:</td>
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
                <td className="border border-black p-1 text-right bg-slate-300 font-black text-[11px]">{(ledgerLogic.latest.col11).toLocaleString()}</td>
                <td className="border border-black p-1 no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
          <span>CPF Management Software</span>
          <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
        </div>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-white border-2 border-black p-0 rounded-2xl shadow-2xl">
          <DialogHeader className="p-6 border-b-2 border-black bg-slate-50 flex flex-row items-center justify-between space-y-0 sticky top-0 z-10">
            <DialogTitle className="text-2xl font-black text-black tracking-tight uppercase">{editingEntry ? "Edit Ledger Entry" : "New Ledger Entry"}</DialogTitle>
            <DialogClose asChild><Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-slate-200 text-black"><UserX className="size-4" /></Button></DialogClose>
          </DialogHeader>
          <form onSubmit={handleSaveEntry} className="p-6 space-y-4">
            <div className="bg-black p-4 rounded-xl border-2 border-slate-800 shadow-xl space-y-2">
              <div className="flex items-center gap-2 text-white">
                <TrendingUp className="size-3.5 text-emerald-400" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Financial Impact Terminal</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">NetEmployeeFund</p>
                  <p className={cn("text-lg font-black tabular-nums", entryNetFund.empNet >= 0 ? "text-white" : "text-rose-400")}>
                    ৳ {entryNetFund.empNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">OfficeCotribution</p>
                  <p className="text-lg font-black text-white tabular-nums">
                    ৳ {entryNetFund.officeNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex items-center justify-between bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/30">
                  <p className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">Net Fund Sum</p>
                  <p className="text-xl font-black text-emerald-400 tabular-nums">
                    ৳ {entryNetFund.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50/50 rounded-xl border-2 border-black">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-black uppercase ml-1">Posting Date</Label>
                <Input name="summaryDate" type="date" max="9999-12-31" defaultValue={editingEntry?.summaryDate} required className="border-2 border-black font-black text-black h-9 focus:ring-0 rounded-lg bg-white uppercase text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-black uppercase ml-1">Voucher Particulars</Label>
                <Input name="particulars" defaultValue={editingEntry?.particulars} required placeholder="Monthly Contribution..." className="border-2 border-black font-black text-black h-9 focus:ring-0 rounded-lg bg-white text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-black uppercase ml-1">Contribution Source</Label>
                <Select name="contributionSource" defaultValue={editingEntry?.contributionSource || "Local"}>
                  <SelectTrigger className="border-2 border-black font-black text-black h-9 rounded-lg bg-white text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-2 border-black"><SelectItem value="Local" className="font-black uppercase text-xs">Local PBS (GPBS-2)</SelectItem><SelectItem value="Other" className="font-black uppercase text-xs">Other PBS (Transfer)</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50/30 p-4 rounded-xl border-2 border-black space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-blue-600 text-white rounded text-[8px] uppercase font-black">Employee & Loans</Badge>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Emp Cont (Col 1)</Label>
                    <Input name="employeeContribution" type="number" step="0.01" value={tempEntry.c1 || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => setTempEntry({...tempEntry, c1: Number(e.target.value)})} className="border-2 border-black font-black text-black h-9 tabular-nums rounded-lg bg-white text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Loan Disb (Col 2)</Label>
                    <Input name="loanWithdrawal" type="number" step="0.01" value={tempEntry.c2 || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => setTempEntry({...tempEntry, c2: Number(e.target.value)})} className="border-2 border-black font-black text-black h-9 tabular-nums rounded-lg bg-white text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Loan Repay (Col 3)</Label>
                    <Input name="loanRepayment" type="number" step="0.01" value={tempEntry.c3 || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => setTempEntry({...tempEntry, c3: Number(e.target.value)})} className="border-2 border-black font-black text-black h-9 tabular-nums rounded-lg bg-white text-xs" />
                  </div>
                </div>
              </div>

              <div className="bg-orange-50/30 p-4 rounded-xl border-2 border-black space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-orange-600 text-white rounded text-[8px] uppercase font-black">Period Profits</Badge>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Profit Emp (Col 5)</Label>
                    <Input name="profitEmployee" type="number" step="0.01" value={tempEntry.c5 || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => setTempEntry({...tempEntry, c5: Number(e.target.value)})} className="border-2 border-black font-black text-black h-9 tabular-nums rounded-lg bg-white text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Profit Loan (Col 6)</Label>
                    <Input name="profitLoan" type="number" step="0.01" value={tempEntry.c6 || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => setTempEntry({...tempEntry, c6: Number(e.target.value)})} className="border-2 border-black font-black text-black h-9 tabular-nums rounded-lg bg-white text-xs" />
                  </div>
                  <div className="h-[52px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                    <span className="text-[8px] uppercase font-black text-slate-300">Unused Buffer</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50/30 p-4 rounded-xl border-2 border-black space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-emerald-600 text-white rounded text-[8px] uppercase font-black">Office Contribution</Badge>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">PBS Cont (Col 8)</Label>
                    <Input name="pbsContribution" type="number" step="0.01" value={tempEntry.c8 || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => setTempEntry({...tempEntry, c8: Number(e.target.value)})} className="border-2 border-black font-black text-black h-9 tabular-nums rounded-lg bg-white text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Profit PBS (Col 9)</Label>
                    <Input name="profitPbs" type="number" step="0.01" value={tempEntry.c9 || ''} onKeyDown={handleNumericKeyDown} onChange={(e) => setTempEntry({...tempEntry, c9: Number(e.target.value)})} className="border-2 border-black font-black text-black h-9 tabular-nums rounded-lg bg-white text-xs" />
                  </div>
                  <div className="h-[52px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                    <span className="text-[8px] uppercase font-black text-slate-300">Office Side</span>
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full bg-black text-white font-black h-12 rounded-xl uppercase tracking-[0.2em] shadow-xl text-sm mb-2 mt-4">Save Ledger Record</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
