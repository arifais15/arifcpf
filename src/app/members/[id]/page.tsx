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
  Calculator, 
  ArrowRightLeft, 
  UserX, 
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ShieldCheck,
  TrendingUp,
  Info
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
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
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const memberRef = useMemoFirebase(() => doc(firestore, "members", resolvedParams.id), [firestore, resolvedParams.id]);
  const { data: member, isLoading: isMemberLoading } = useDoc(memberRef);

  const summariesRef = useMemoFirebase(() => collection(firestore, "members", resolvedParams.id, "fundSummaries"), [firestore, resolvedParams.id]);
  const { data: summaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  };

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    setDateRange({ start: `${fyStartYear}-07-01`, end: now.toISOString().split('T')[0] });
  }, []);

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

    let displayRows = inRangeRows;
    if (dateRange.start && preRows.length > 0) {
      const preSums = preRows.reduce((acc, r) => ({
        c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3,
        c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9
      }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

      const lastPre = preRows[preRows.length - 1];
      const openingRow = {
        summaryDate: dateRange.start,
        particulars: "OPENING BALANCE (BROUGHT FORWARD)",
        ...preSums,
        col4: lastPre.col4,
        col7: lastPre.col7,
        col10: lastPre.col10,
        col11: lastPre.col11,
        isOpening: true,
        id: "opening-row"
      };
      displayRows = [openingRow, ...inRangeRows];
    }

    const totals = inRangeRows.reduce((acc, r) => ({ 
      c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3, 
      c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9 
    }), { c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

    const last = allCalculated[allCalculated.length - 1] || { col4: 0, col7: 0, col10: 0, col11: 0 };

    return { 
      rows: displayRows, 
      totals, 
      latest: { col4: last.col4, col7: last.col7, col10: last.col10, col11: last.col11 } 
    };
  }, [summaries, dateRange]);

  const paginatedRows = useMemo(() => 
    pageSize === -1 ? ledgerLogic.rows : ledgerLogic.rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  , [ledgerLogic.rows, currentPage, pageSize]);

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
    <div className="p-6 md:p-10 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4 landscape !important; margin: 8mm !important; } .print-container { width: 100% !important; display: block !important; } table { table-layout: fixed !important; width: 100% !important; } body { background-color: white !important; color: #000000 !important; } }` }} />
      
      <PageHeaderActions>
        <Link href="/members" className="p-2 hover:bg-black/5 rounded-full transition-colors mr-2"><ArrowLeft className="size-5 text-black" /></Link>
        <div className="flex items-center gap-3 bg-black/5 p-1 rounded-xl h-10 px-3">
          <CalendarDays className="size-4 text-black/40" />
          <div className="flex items-center gap-2">
            <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-7 w-[120px] bg-white border-black/20 text-[10px] font-black uppercase" />
            <ArrowRightLeft className="size-3 text-black/20" />
            <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-7 w-[120px] bg-white border-black/20 text-[10px] font-black uppercase" />
          </div>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" onClick={() => setIsEntryOpen(true)} className="h-9 border-black font-black text-[10px] uppercase gap-1.5 px-3"><Plus className="size-3.5" /> Entry</Button>
          <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-[10px] uppercase gap-1.5 px-4 ml-1"><Printer className="size-3.5" /> Print</Button>
        </div>
      </PageHeaderActions>

      <div className="bg-white p-8 md:p-10 shadow-2xl rounded-none border-4 border-black max-w-[1400px] mx-auto w-full font-ledger print-container">
        <div className="relative mb-8 text-center border-b-4 border-black pb-4">
          <p className="text-[10px] absolute left-0 top-0 font-black uppercase tracking-[0.2em]">REB Form no: 224</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-[0.35em] text-black mt-1">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 decoration-4 uppercase tracking-[0.3em] mt-4">Subsidiary Ledger Statement</h2>
        </div>

        <div className="grid grid-cols-3 gap-x-8 gap-y-2 mb-6 text-[12px] font-black border-b-4 border-black pb-4">
          {[
            { label: "Full Legal Name", value: member.name, sub: "uppercase text-sm" },
            { label: "Official Designation", value: member.designation, sub: "uppercase" },
            { label: "Trust ID Number", value: member.memberIdNumber, sub: "font-mono" },
            { label: "Joined Date", value: member.dateJoined, sub: "" },
            { label: "Status", value: member.status || "Active", sub: "uppercase" },
            { label: "Mailing Address", value: member.permanentAddress || "-", sub: "truncate max-w-[200px]" },
          ].map((item, idx) => (
            <div key={idx} className="flex items-end gap-2 border-b border-black/20 pb-0.5">
              <span className="uppercase text-[9px] text-black shrink-0 tracking-widest min-w-[100px]">{item.label}:</span>
              <span className={cn("font-black uppercase truncate", item.sub)}>{item.value}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse border-2 border-black table-fixed font-black tabular-nums">
            <thead className="bg-slate-100 border-b-4 border-black">
              <tr className="uppercase text-[8px] tracking-tighter">
                <th rowSpan={3} className="border border-black p-0.5 w-[65px]">Date</th>
                <th rowSpan={3} className="border border-black p-0.5 w-[140px]">Particulars</th>
                <th colSpan={4} className="border border-black p-0.5 bg-slate-200/50">Contributions & Loans</th>
                <th colSpan={2} className="border border-black p-0.5 bg-slate-100">Profits</th>
                <th rowSpan={3} className="border border-black p-0.5 bg-slate-200 text-[8px]">Net Emp<br/>(7=Pre+1-2+3+5+6)</th>
                <th colSpan={2} className="border border-black p-0.5 bg-slate-100">PBS Fund</th>
                <th rowSpan={3} className="border border-black p-0.5 bg-slate-200">Net Off<br/>(10=8+9)</th>
                <th rowSpan={3} className="border border-black p-0.5 w-[85px] bg-black text-white">Total<br/>(11=7+10)</th>
                <th rowSpan={3} className="border border-black p-0.5 no-print w-[50px]">Action</th>
              </tr>
              <tr className="text-[7px] uppercase">
                <th className="border border-black p-0.5">Contrib(1)</th><th className="border border-black p-0.5">Drawal(2)</th><th className="border border-black p-0.5">Repay(3)</th><th className="border border-black p-0.5 bg-slate-200">Bal(4=2-3)</th>
                <th className="border border-black p-0.5">Emp(5)</th><th className="border border-black p-0.5">Loan(6)</th><th className="border border-black p-0.5">Contrib(8)</th><th className="border border-black p-0.5">Profit(9)</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row: any, idx) => (
                <tr key={row.id} className={cn("hover:bg-slate-50 border-b border-black h-7", row.isOpening && "bg-slate-50 italic")}>
                  <td className="border border-black p-0.5 text-center font-mono text-[9px]">{row.summaryDate}</td>
                  <td className="border border-black p-0.5 truncate uppercase text-[9px]">
                    {row.particulars}
                    {row.isOpening && <Badge variant="outline" className="ml-1 text-[7px] h-3 px-1 border-black bg-white rounded-none">Consol.</Badge>}
                  </td>
                  <td className="border border-black p-0.5 text-right">{row.c1.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c2.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c3.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right bg-slate-50">{row.col4.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c5.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c6.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right bg-slate-50">{row.col7.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c8.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right">{row.c9.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right bg-slate-50">{row.col10.toLocaleString()}</td>
                  <td className="border border-black p-0.5 text-right bg-slate-100">{row.col11.toLocaleString()}</td>
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
                <td colSpan={2} className="border border-black p-1 text-right uppercase">Period Totals:</td>
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
                <td className="border border-black p-1 text-right bg-slate-300 font-black underline decoration-double">{(ledgerLogic.latest.col11).toLocaleString()}</td>
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
          <form onSubmit={handleSaveEntry} className="p-8 space-y-6">
            <h2 className="text-2xl font-black uppercase border-b-2 border-black pb-4">{editingEntry ? "Edit Ledger Entry" : "New Ledger Entry"}</h2>
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