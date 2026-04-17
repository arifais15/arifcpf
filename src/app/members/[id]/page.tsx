
"use client"

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Printer, 
  ArrowLeft, 
  Loader2, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowRightLeft,
  Calculator
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { cn } from "@/lib/utils";
import { PageHeaderActions } from "@/components/header-actions";

export default function MemberLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const firestore = useFirestore();
  const { showAlert } = useSweetAlert();
  
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [selectedFY, setSelectedFY] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const memberRef = useMemoFirebase(() => doc(firestore, "members", resolvedParams.id), [firestore, resolvedParams.id]);
  const { data: member, isLoading: isMemberLoading } = useDoc(memberRef);

  const summariesRef = useMemoFirebase(() => collection(firestore, "members", resolvedParams.id, "fundSummaries"), [firestore, resolvedParams.id]);
  const { data: summaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const availableFYs = useMemo(() => {
    const fys = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const activeStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    for (let i = 0; i < 15; i++) {
      const start = activeStartYear - i;
      fys.push(`${start}-${(start + 1).toString().slice(-2)}`);
    }
    return fys;
  }, []);

  const handleFYChange = (fy: string) => {
    setSelectedFY(fy);
    if (fy === "all") {
      setDateRange({ start: "2010-01-01", end: new Date().toISOString().split('T')[0] });
    } else {
      const parts = fy.split("-");
      const startYear = parseInt(parts[0]);
      setDateRange({ start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` });
    }
  };

  useEffect(() => {
    if (availableFYs.length > 0 && !selectedFY) {
      handleFYChange(availableFYs[0]);
    }
  }, [availableFYs, selectedFY]);

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  };

  const ledgerLogic = useMemo(() => {
    if (!summaries) return { rows: [], totals: { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 }, latest: { col4: 0, col7: 0, col10: 0, col11: 0 } };
    
    const sorted = [...summaries].sort((a, b) => {
      const dateA = new Date(a.summaryDate).getTime();
      const dateB = new Date(b.summaryDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    let rLoan = 0, rEmp = 0, rOff = 0;
    const allCalculated = sorted.map(row => {
      const v = { 
        c1: Number(row.employeeContribution)||0, 
        c2: Number(row.loanWithdrawal)||0, 
        c3: Number(row.loanRepayment)||0, 
        c5: Number(row.profitEmployee)||0, 
        c6: Number(row.profitLoan)||0, 
        c8: Number(row.pbsContribution)||0, 
        c9: Number(row.profitPbs)||0 
      };
      rLoan += v.c2 - v.c3;
      rEmp += v.c1 - v.c2 + v.c3 + v.c5 + v.c6;
      rOff += v.c8 + v.c9;
      return { ...row, ...v, col4: rLoan, col7: rEmp, col10: rOff, col11: rEmp + rOff };
    });

    const startDate = dateRange.start ? new Date(dateRange.start).getTime() : 0;
    const endDate = dateRange.end ? new Date(dateRange.end).getTime() : Infinity;

    const preRows = allCalculated.filter(r => new Date(r.summaryDate).getTime() < startDate);
    const inRangeRows = allCalculated.filter(r => {
      const time = new Date(r.summaryDate).getTime();
      return time >= startDate && time <= endDate;
    });

    const preSums = preRows.reduce((acc, r) => ({
      c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3,
      c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9
    }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

    let displayRows = inRangeRows;
    let openingRowValue = preSums;

    if (dateRange.start && preRows.length > 0) {
      const lastPre = preRows[preRows.length - 1];
      const openingRow = {
        summaryDate: dateRange.start,
        particulars: "Opening Balance",
        ...preSums,
        col4: lastPre.col4,
        col7: lastPre.col7,
        col10: lastPre.col10,
        col11: lastPre.col11,
        isOpening: true,
        id: "opening-row"
      };
      displayRows = [openingRow, ...inRangeRows];
    } else if (dateRange.start) {
        // Even if no preRows, we need the "Opening Balance" row if a start date is set
        const openingRow = {
            summaryDate: dateRange.start,
            particulars: "Opening Balance",
            c1:0, c2:0, c3:0, c5:0, c6:0, c8:0, c9:0,
            col4: 0, col7: 0, col10: 0, col11: 0,
            isOpening: true,
            id: "opening-row-empty"
        };
        displayRows = [openingRow, ...inRangeRows];
    }

    const activityTotals = inRangeRows.reduce((acc, r) => ({ 
      c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3, 
      c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9 
    }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

    const grandTotals = {
      c1: openingRowValue.c1 + activityTotals.c1,
      c2: openingRowValue.c2 + activityTotals.c2,
      c3: openingRowValue.c3 + activityTotals.c3,
      c5: openingRowValue.c5 + activityTotals.c5,
      c6: openingRowValue.c6 + activityTotals.c6,
      c8: openingRowValue.c8 + activityTotals.c8,
      c9: openingRowValue.c9 + activityTotals.c9,
    };

    const last = allCalculated[allCalculated.length - 1] || { col4: 0, col7: 0, col10: 0, col11: 0 };

    return { 
      rows: displayRows, 
      totals: grandTotals, 
      latest: { col4: last.col4, col7: last.col7, col10: last.col10, col11: last.col11 } 
    };
  }, [summaries, dateRange]);

  const handleSaveEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = { 
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
      createdAt: editingEntry?.createdAt || new Date().toISOString(), 
      memberId: resolvedParams.id 
    };
    if (editingEntry?.id) updateDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", editingEntry.id), data);
    else addDocumentNonBlocking(summariesRef, data);
    setIsEntryOpen(false); setEditingEntry(null);
  };

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;
  if (!member) return <div className="p-8 text-center bg-white"><h1 className="text-2xl font-black text-black uppercase">Member not found</h1></div>;

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-black">
      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4 landscape !important; margin: 8mm !important; } .print-container { width: 100% !important; display: block !important; } table { table-layout: fixed !important; width: 100% !important; } body { background-color: white !important; color: #000000 !important; } }` }} />
      
      <PageHeaderActions>
        <Link href="/members" className="p-2 hover:bg-black/5 rounded-full transition-colors mr-2 no-print"><ArrowLeft className="size-5 text-black" /></Link>
        
        <div className="flex items-center gap-3 bg-black/5 p-1 rounded-xl h-10 px-3 no-print">
          <div className="flex items-center gap-2 pr-3 border-r border-black/10">
            <Select value={selectedFY} onValueChange={handleFYChange}>
              <SelectTrigger className="h-7 w-[110px] bg-white border-black/20 text-[10px] font-black uppercase focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}
                <SelectItem value="all" className="font-black text-xs text-rose-600">ALL TIME</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-7 w-[120px] bg-white border-black/20 text-[10px] font-black uppercase" />
            <ArrowRightLeft className="size-3 text-black/20" />
            <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-7 w-[120px] bg-white border-black/20 text-[10px] font-black uppercase" />
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto no-print">
          <Button variant="outline" onClick={() => { setEditingEntry(null); setIsEntryOpen(true); }} className="h-9 border-black font-black text-[10px] uppercase gap-1.5 px-3"><Plus className="size-3.5" /> New Entry</Button>
          <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-[10px] uppercase gap-1.5 px-4 ml-1"><Printer className="size-3.5" /> Print Ledger</Button>
        </div>
      </PageHeaderActions>

      <div className="bg-white p-6 md:p-10 shadow-2xl rounded-none border-4 border-black max-w-[1400px] mx-auto w-full font-ledger print-container text-black">
        <div className="relative mb-6 text-center border-b-4 border-black pb-4">
          <p className="text-[10px] absolute left-0 top-0 font-black uppercase tracking-[0.2em]">REB Form no: 224</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <h2 className="text-xl font-black uppercase tracking-[0.3em] mt-2">Provident Fund Subsidiary Ledger</h2>
        </div>

        <div className="grid grid-cols-3 gap-x-8 gap-y-1.5 mb-6 text-[12px] font-black border-b-4 border-black pb-4">
          {[
            { label: "Full Legal Name", value: member.name },
            { label: "Designation", value: member.designation },
            { label: "ID Number", value: member.memberIdNumber },
            { label: "Joined Date", value: member.dateJoined },
            { label: "Status", value: member.status || "Active" },
            { label: "Address", value: member.permanentAddress || "-" },
          ].map((item, idx) => (
            <div key={idx} className="flex items-end gap-2 border-b border-black/20 pb-0.5">
              <span className="uppercase text-[9px] text-black shrink-0 tracking-widest min-w-[80px]">{item.label}:</span>
              <span className="font-black uppercase truncate border-none flex-1">{item.value}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[9px] border-collapse border-2 border-black table-fixed font-black tabular-nums text-black">
            <thead className="bg-slate-100 border-b-2 border-black">
              <tr className="uppercase text-[8px] tracking-tighter">
                <th rowSpan={3} className="border border-black p-0.5 w-[60px]">Date</th>
                <th rowSpan={3} className="border border-black p-0.5 w-[140px]">Particulars</th>
                <th colSpan={4} className="border border-black p-0.5 bg-slate-200/50">Contributions</th>
                <th colSpan={2} className="border border-black p-0.5 bg-slate-100">Profits</th>
                <th rowSpan={3} className="border border-black p-0.5 bg-slate-200 text-[8px]">Equity(7)</th>
                <th colSpan={2} className="border border-black p-0.5 bg-slate-100">PBS Fund</th>
                <th rowSpan={3} className="border border-black p-0.5 bg-slate-200">Off(10)</th>
                <th rowSpan={3} className="border border-black p-0.5 w-[85px] bg-black text-white">Total(11)</th>
                <th rowSpan={3} className="border border-black p-0.5 no-print w-[50px]">Action</th>
              </tr>
              <tr className="text-[7px] uppercase">
                <th className="border border-black p-0.5">E(1)</th><th className="border border-black p-0.5">D(2)</th><th className="border border-black p-0.5">R(3)</th><th className="border border-black p-0.5 bg-slate-200">L(4)</th>
                <th className="border border-black p-0.5">E(5)</th><th className="border border-black p-0.5">L(6)</th><th className="border border-black p-0.5">P(8)</th><th className="border border-black p-0.5">P(9)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {ledgerLogic.rows.map((row: any) => (
                <tr key={row.id} className={cn("hover:bg-slate-50 border-b border-black h-7", row.isOpening && "bg-slate-50 italic")}>
                  <td className="border border-black p-0.5 text-center font-mono text-[9px]">{row.summaryDate}</td>
                  <td className="border border-black p-0.5 truncate uppercase text-[9px]">{row.particulars}</td>
                  <td className="border border-black p-0.5 text-right">{row.c1.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c2.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c3.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right bg-slate-50">{(row.col4).toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c5.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c6.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right bg-slate-50">{(row.col7).toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c8.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c9.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right bg-slate-50">{(row.col10).toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right bg-slate-100 font-bold">{(row.col11).toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-center no-print">
                    {!row.isOpening && (
                      <div className="flex gap-1 justify-center">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingEntry(row); setIsEntryOpen(true); }}><Edit2 className="size-3"/></Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", row.id))}><Trash2 className="size-3"/></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-black text-[9px]">
              <tr className="h-8">
                <td colSpan={2} className="border border-black p-1 text-right uppercase">Totals (Incl. Opening):</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c1.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c2.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c3.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-200 font-bold">{(ledgerLogic.latest.col4).toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c5.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c6.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-200 font-bold">{(ledgerLogic.latest.col7).toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c8.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{ledgerLogic.totals.c9.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-200 font-bold">{(ledgerLogic.latest.col10).toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-300 font-black">৳ {(ledgerLogic.latest.col11).toLocaleString()}</td>
                <td className="border border-black p-1 no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-8 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
          <span>CPF Management Software</span><span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
        </div>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-4xl border-2 border-black rounded-none p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-8 border-b-2 border-black bg-slate-50">
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-3">
              <Calculator className="size-6" />
              {editingEntry ? "Edit Ledger Entry" : "New Ledger Entry"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEntry} className="p-8 space-y-6 pt-0 mt-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Posting Date</Label><Input name="summaryDate" type="date" max="9999-12-31" defaultValue={editingEntry?.summaryDate} required className="border-2 border-black font-black" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Particulars</Label><Input name="particulars" defaultValue={editingEntry?.particulars} required className="border-2 border-black font-black" /></div>
            </div>
            <div className="grid grid-cols-3 gap-6 bg-slate-50 p-6 border-2 border-black">
              {[
                { n: "employeeContribution", l: "Emp Cont(1)", v: editingEntry?.employeeContribution },
                { n: "loanWithdrawal", l: "Loan Draw(2)", v: editingEntry?.loanWithdrawal },
                { n: "loanRepayment", l: "Loan Repay(3)", v: editingEntry?.loanRepayment },
                { n: "profitEmployee", l: "Emp Profit(5)", v: editingEntry?.profitEmployee },
                { n: "profitLoan", l: "Loan Int(6)", v: editingEntry?.profitLoan },
                { n: "pbsContribution", l: "PBS Cont(8)", v: editingEntry?.pbsContribution },
                { n: "profitPbs", l: "PBS Profit(9)", v: editingEntry?.profitPbs }
              ].map(f => (
                <div key={f.n} className="space-y-1"><Label className="text-[9px] font-black uppercase opacity-60">{f.l}</Label><Input name={f.n} type="number" step="0.01" defaultValue={f.v || 0} onKeyDown={handleNumericKeyDown} className="h-9 border-black font-black text-right tabular-nums" /></div>
              ))}
            </div>
            <Button type="submit" className="w-full bg-black text-white font-black h-12 uppercase tracking-widest shadow-xl">Save Record</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
