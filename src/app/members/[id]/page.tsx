
"use client"

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Printer, 
  ArrowLeft, 
  Loader2, 
  Plus, 
  ArrowRightLeft, 
  UserX,
  Edit2,
  Trash2,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { cn } from "@/lib/utils";
import { PageHeaderActions } from "@/components/header-actions";
import { useToast } from "@/hooks/use-toast";

export default function MemberLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const firestore = useFirestore();
  const { showAlert } = useSweetAlert();
  const { toast } = useToast();
  
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [selectedFY, setSelectedFY] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const [manualVals, setManualVals] = useState({ c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });

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
    const curYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const startYear = currentMonth >= 7 ? curYear : curYear - 1;
    for (let i = 0; i < 15; i++) {
      const s = startYear - i;
      fys.push(`${s}-${(s + 1).toString().slice(-2)}`);
    }
    return fys;
  }, []);

  useEffect(() => {
    if (availableFYs.length > 0 && !selectedFY) {
      const fy = availableFYs[0];
      setSelectedFY(fy);
      const s = parseInt(fy.split("-")[0]);
      setDateRange({ start: `${s}-07-01`, end: `${s+1}-06-30` });
    }
  }, [availableFYs, selectedFY]);

  const ledgerLogic = useMemo(() => {
    if (!summaries) return { rows: [], grand: { c1:0, c2:0, c3:0, c5:0, c6:0, c8:0, c9:0, c4:0, c7:0, c10:0, c11:0 }, totalAllTime: { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 } };
    const sorted = [...summaries].sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime());
    let rL = 0, rE = 0, rO = 0;
    const allC = sorted.map(row => {
      const v = { c1:Number(row.employeeContribution)||0, c2:Number(row.loanWithdrawal)||0, c3:Number(row.loanRepayment)||0, c5:Number(row.profitEmployee)||0, c6:Number(row.profitLoan)||0, c8:Number(row.pbsContribution)||0, c9:Number(row.profitPbs)||0 };
      rL += (v.c2 - v.c3); rE += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6); rO += (v.c8 + v.c9);
      return { ...row, ...v, col4:rL, col7:rE, col10:rO, col11:rE+rO };
    });
    const sTime = new Date(dateRange.start).getTime();
    const eTime = new Date(dateRange.end).getTime();
    const pre = allC.filter(r => new Date(r.summaryDate).getTime() < sTime);
    const inR = allC.filter(r => { const t = new Date(r.summaryDate).getTime(); return t >= sTime && t <= eTime; });
    const lastP = pre[pre.length-1] || { col4:0, col7:0, col10:0, col11:0 };
    const pSums = pre.reduce((acc, r) => ({ c1:acc.c1+r.c1, c2:acc.c2+r.c2, c3:acc.c3+r.c3, c5:acc.c5+r.c5, c6:acc.c6+r.c6, c8:acc.c8+r.c8, c9:acc.c9+r.c9 }), { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 });
    let rows = inR;
    if (pre.length > 0) rows = [{ summaryDate: dateRange.start, particulars: "Opening Balance Brought Forward", ...pSums, col4:lastP.col4, col7:lastP.col7, col10:lastP.col10, col11:lastP.col11, isOpening: true }, ...inR];
    
    const viewSums = rows.reduce((acc, r) => ({ 
      c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3, c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9 
    }), { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 });
    
    const lastRow = rows[rows.length-1] || { col4:0, col7:0, col10:0, col11:0 };
    return { 
      rows, 
      grand: { c1:viewSums.c1, c2:viewSums.c2, c3:viewSums.c3, c5:viewSums.c5, c6:viewSums.c6, c8:viewSums.c8, c9:viewSums.c9, c4:lastRow.col4, c7:lastRow.col7, c10:lastRow.col10, c11:lastRow.col11 }, 
      totalAllTime: allC.reduce((acc, r) => ({ c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3, c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9 }), { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 }) 
    };
  }, [summaries, dateRange]);

  const rowVerification = useMemo(() => {
    const netEmp = (manualVals.c1 - manualVals.c2 + manualVals.c3 + manualVals.c5 + manualVals.c6);
    const netOff = manualVals.c8 + manualVals.c9;
    return { netEmp, netOff, total: netEmp + netOff, loanEffect: manualVals.c2 - manualVals.c3 };
  }, [manualVals]);

  const handleManualSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const d = { 
      summaryDate: f.get("summaryDate"), 
      particulars: f.get("particulars"), 
      employeeContribution: manualVals.c1, 
      loanWithdrawal: manualVals.c2, 
      loanRepayment: manualVals.c3, 
      profitEmployee: manualVals.c5, 
      profitLoan: manualVals.c6, 
      pbsContribution: manualVals.c8, 
      profitPbs: manualVals.c9, 
      memberId: resolvedParams.id, 
      updatedAt: new Date().toISOString() 
    }; 
    if (editingEntry) updateDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", editingEntry.id), d);
    else addDocumentNonBlocking(summariesRef, { ...d, createdAt: new Date().toISOString() }); 
    setIsEntryOpen(false); setEditingEntry(null);
    setManualVals({ c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });
    toast({ title: "Ledger Synchronized" });
  };

  const handleFinalSettlement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const reason = f.get("reason") as string;
    const sDate = f.get("settlementDate") as string;
    const currentLoanBal = (ledgerLogic.totalAllTime.c2 || 0) - (ledgerLogic.totalAllTime.c3 || 0);
    
    const entry = { 
      summaryDate: sDate, 
      particulars: `FINAL SETTLEMENT - ${reason.toUpperCase()}${currentLoanBal > 0 ? ` (LOAN BAL ${currentLoanBal.toLocaleString()} ADJUSTED)` : ''}`, 
      employeeContribution: -(ledgerLogic.totalAllTime.c1 || 0), 
      loanWithdrawal: 0, 
      loanRepayment: currentLoanBal > 0 ? currentLoanBal : 0,
      profitEmployee: -(ledgerLogic.totalAllTime.c5 || 0), 
      profitLoan: -(ledgerLogic.totalAllTime.c6 || 0), 
      pbsContribution: -(ledgerLogic.totalAllTime.c8 || 0), 
      profitPbs: -(ledgerLogic.totalAllTime.c9 || 0), 
      memberId: resolvedParams.id, 
      isSettlement: true, 
      createdAt: new Date().toISOString() 
    };
    
    addDocumentNonBlocking(summariesRef, entry);
    updateDocumentNonBlocking(memberRef, { status: reason, settlementDate: sDate, settledAmount: ledgerLogic.grand.c11, updatedAt: new Date().toISOString() });
    setIsSettlementOpen(false);
    toast({ title: "Settlement Confirmed" });
  };

  const headerActions = useMemo(() => (
    <div className="flex gap-2 ml-auto no-print">
      <Button variant="outline" onClick={() => setIsSettlementOpen(true)} className="h-10 border-rose-600 text-rose-700 hover:bg-rose-50 font-black uppercase text-[10px]">
        <UserX className="size-4 mr-2" /> Final Settlement
      </Button>
      <Button variant="outline" onClick={() => setIsEntryOpen(true)} className="h-10 border-black font-black uppercase text-[10px] text-black">
        <Plus className="size-4 mr-2" /> Manual Sync
      </Button>
      <Button onClick={() => window.print()} className="h-10 bg-black text-white font-black uppercase text-[10px] px-8">
        <Printer className="size-4 mr-2" /> Print
      </Button>
    </div>
  ), [ledgerLogic.grand.c11]);

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-black">
      <PageHeaderActions>{headerActions}</PageHeaderActions>

      <div className="bg-white p-4 border-2 border-black shadow-xl flex flex-col md:flex-row items-center justify-between no-print gap-4">
        <Link href="/members" className="p-2 hover:bg-slate-100 rounded-full border border-black"><ArrowLeft className="size-5" /></Link>
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 border border-black rounded-xl">
          <div className="grid gap-1">
            <Label className="text-[9px] font-black uppercase text-black ml-1">Period Filter</Label>
            <Select 
              value={selectedFY} 
              onValueChange={(fy) => { 
                setSelectedFY(fy); 
                if(fy==="all") setDateRange({start:"2010-01-01", end:new Date().toISOString().split('T')[0]}); 
                else { const s = parseInt(fy.split("-")[0]); setDateRange({start:`${s}-07-01`, end:`${s+1}-06-30`}); } 
              }}
            >
              <SelectTrigger className="h-8 w-[100px] border-black font-black text-[10px] uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}
                <SelectItem value="all" className="font-black text-xs">ALL TIME</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ArrowRightLeft className="size-3 opacity-30 mt-4" />
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-black ml-1">From</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start:e.target.value})} className="h-8 w-32 border-black text-[10px] font-black" /></div>
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-black ml-1">To</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end:e.target.value})} className="h-8 w-32 border-black text-[10px] font-black" /></div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-10 shadow-2xl border-2 border-black max-w-[1400px] mx-auto w-full print-container overflow-x-auto">
        <div className="text-center border-b-2 border-black pb-4 mb-6 min-w-[1050px]">
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.3em] mt-2">Provident Fund Subsidiary Ledger</h2>
        </div>

        <div className="grid grid-cols-3 border-2 border-black mb-6 text-[10px] font-black min-w-[1050px] uppercase tabular-nums">
          <div className="border-r border-b border-black p-2 flex gap-2"><span>NAME:</span><span className="flex-1 truncate">{member?.name}</span></div>
          <div className="border-r border-b border-black p-2 flex gap-2"><span>ID NO:</span><span className="font-mono">{member?.memberIdNumber}</span></div>
          <div className="border-b border-black p-2 flex gap-2"><span>POSITION:</span><span className="flex-1 truncate">{member?.designation}</span></div>
          <div className="border-r border-black p-2 flex gap-2"><span>OFFICE:</span><span className="flex-1 truncate">{member?.zonalOffice || "HO"}</span></div>
          <div className="border-r border-black p-2 flex gap-2"><span>STATUS:</span><span className={cn("flex-1", member?.status !== 'Active' && "text-rose-600")}>{member?.status || "Active"}</span></div>
          <div className="p-2 flex gap-2"><span>JOIN DATE:</span><span className="flex-1">{member?.dateJoined}</span></div>
        </div>

        <table className="w-full text-[8.5px] border-collapse border-2 border-black font-black tabular-nums min-w-[1050px]">
          <thead className="bg-slate-50 border-b-2 border-black uppercase text-center font-black">
            <tr className="border-b border-black">
              <th rowSpan={2} className="border-r border-black p-1 w-[70px]">Date</th>
              <th rowSpan={2} className="border-r border-black p-1">Particulars</th>
              <th rowSpan={2} className="border-r border-black p-1">Employee<br/>Contribution</th>
              <th rowSpan={2} className="border-r border-black p-1">Amount<br/>Withdraws as Loan</th>
              <th rowSpan={2} className="border-r border-black p-1">Loan Principal<br/>repayment</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-slate-200/50">Balance of<br/>outstanding loan</th>
              <th colSpan={2} className="border-r border-black p-1 bg-slate-100">Profit on</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-slate-200">Total Employee's<br/>Fund</th>
              <th rowSpan={2} className="border-r border-black p-1">PBS<br/>Contribution</th>
              <th rowSpan={2} className="border-r border-black p-1">Profit on PBS<br/>Contribution</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-slate-200">Total Office<br/>Contribution</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-black text-white">Cumulative<br/>Fund Balance</th>
              <th rowSpan={2} className="p-1 no-print">Action</th>
            </tr>
            <tr className="border-b border-black">
              <th className="border-r border-black p-1">Employee<br/>Contribution</th>
              <th className="border-r border-black p-1">CPF Loan</th>
            </tr>
            <tr className="bg-slate-100/50 text-[7px] border-b-2 border-black">
              <th className="border-r border-black">—</th>
              <th className="border-r border-black">—</th>
              <th className="border-r border-black">1</th>
              <th className="border-r border-black">2</th>
              <th className="border-r border-black">3</th>
              <th className="border-r border-black">4</th>
              <th className="border-r border-black">5</th>
              <th className="border-r border-black">6</th>
              <th className="border-r border-black text-[6px]">7=Prev+1-2+3+5+6</th>
              <th className="border-r border-black">8</th>
              <th className="border-r border-black">9</th>
              <th className="border-r border-black text-[6px]">10=(8+9)</th>
              <th className="border-r border-black text-[6px]">11=(7+10)</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {ledgerLogic.rows.map((r: any, idx: number) => (
              <tr key={idx} className={cn("border-b border-black h-8", r.isOpening && "bg-slate-50 italic")}>
                <td className="border-r border-black p-1 text-center font-mono">{r.summaryDate}</td>
                <td className="border-r border-black p-1 uppercase truncate max-w-[150px]">{r.particulars}</td>
                <td className="border-r border-black p-1 text-right">{r.c1.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-1 text-right">{r.c2.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-1 text-right">{r.c3.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-1 text-right bg-slate-50/50">{r.col4.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-1 text-right">{r.c5.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-1 text-right">{r.c6.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-1 text-right bg-slate-50/50">{r.col7.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-1 text-right">{r.c8.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-1 text-right">{r.c9.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-1 text-right bg-slate-50/50">{r.col10.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-1 text-right bg-slate-100 font-bold">{r.col11.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-1 text-center no-print">{!r.isOpening && <div className="flex gap-1 justify-center"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingEntry(r); setManualVals({ c1:r.c1, c2:r.c2, c3:r.c3, c5:r.c5, c6:r.c6, c8:r.c8, c9:r.c9 }); setIsEntryOpen(true); }}><Edit2 className="size-3" /></Button><Button variant="ghost" size="icon" className="h-6 w-6 text-rose-600" onClick={() => showAlert({ title:"Remove Record?", type:"warning", showCancel:true, onConfirm:() => deleteDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", r.id)) })}><Trash2 className="size-3" /></Button></div>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-black border-t-4 border-black text-[9px] uppercase">
            <tr className="h-10">
              <td colSpan={2} className="border-r border-black p-2 text-right">Aggregate Period Totals:</td>
              <td className="border-r border-black p-1 text-right">{ledgerLogic.grand.c1.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-black p-1 text-right">{ledgerLogic.grand.c2.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-black p-1 text-right">{ledgerLogic.grand.c3.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-black p-1 text-right bg-slate-200/50">{ledgerLogic.grand.c4.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-black p-1 text-right">{ledgerLogic.grand.c5.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-black p-1 text-right">{ledgerLogic.grand.c6.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-black p-1 text-right bg-slate-200/50">{ledgerLogic.grand.c7.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-black p-1 text-right">{ledgerLogic.grand.c8.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-black p-1 text-right">{ledgerLogic.grand.c9.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-black p-1 text-right bg-slate-200/50">{ledgerLogic.grand.c10.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-black p-1 text-right bg-black text-white text-[11px]">৳ {ledgerLogic.grand.c11.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="no-print"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={(o) => { setIsEntryOpen(o); if(!o) setEditingEntry(null); }}>
        <DialogContent className="max-w-6xl bg-white p-0 rounded-2xl shadow-2xl border-4 border-black overflow-hidden max-h-[95vh] flex flex-col">
          <DialogHeader className="bg-slate-50 p-6 border-b-4 border-black shrink-0"><DialogTitle className="text-xl font-black uppercase">Manual Individual Ledger Posting Terminal</DialogTitle></DialogHeader>
          <form onSubmit={handleManualSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 text-black">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b-2 border-black pb-6">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Posting Date</Label><Input name="summaryDate" type="date" max="9999-12-31" defaultValue={editingEntry?.summaryDate} required className="h-12 border-black border-4 font-black" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">Voucher Particulars</Label><Input name="particulars" defaultValue={editingEntry?.particulars} required className="h-12 border-black border-4 font-black" /></div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-1 px-1 no-print">
                 <div className="text-[9px] font-black uppercase text-center truncate">1: Emp Contrib</div>
                 <div className="text-[9px] font-black uppercase text-center truncate">2: Loan Draw</div>
                 <div className="text-[9px] font-black uppercase text-center truncate">3: Loan Repay</div>
                 <div className="text-[9px] font-black uppercase text-center truncate">5: Profit (Emp)</div>
                 <div className="text-[9px] font-black uppercase text-center truncate">6: Profit (Loan)</div>
                 <div className="text-[9px] font-black uppercase text-center truncate">8: PBS Contrib</div>
                 <div className="text-[9px] font-black uppercase text-center truncate">9: Profit (PBS)</div>
              </div>
              <div className="grid grid-cols-7 gap-2 bg-slate-100 p-2 border-2 border-black rounded-xl">
                 <Input type="number" step="0.01" placeholder="Col 1" value={manualVals.c1||''} onChange={e=>setManualVals({...manualVals, c1:Number(e.target.value)})} className="h-10 border-black border-2 font-black text-center" />
                 <Input type="number" step="0.01" placeholder="Col 2" value={manualVals.c2||''} onChange={e=>setManualVals({...manualVals, c2:Number(e.target.value)})} className="h-10 border-rose-600 border-2 font-black text-center text-rose-700" />
                 <Input type="number" step="0.01" placeholder="Col 3" value={manualVals.c3||''} onChange={e=>setManualVals({...manualVals, c3:Number(e.target.value)})} className="h-10 border-emerald-600 border-2 font-black text-center text-emerald-700" />
                 <Input type="number" step="0.01" placeholder="Col 5" value={manualVals.c5||''} onChange={e=>setManualVals({...manualVals, c5:Number(e.target.value)})} className="h-10 border-orange-600 border-2 font-black text-center text-orange-700" />
                 <Input type="number" step="0.01" placeholder="Col 6" value={manualVals.c6||''} onChange={e=>setManualVals({...manualVals, c6:Number(e.target.value)})} className="h-10 border-orange-600 border-2 font-black text-center text-orange-700" />
                 <Input type="number" step="0.01" placeholder="Col 8" value={manualVals.c8||''} onChange={e=>setManualVals({...manualVals, c8:Number(e.target.value)})} className="h-10 border-blue-600 border-2 font-black text-center text-blue-700" />
                 <Input type="number" step="0.01" placeholder="Col 9" value={manualVals.c9||''} onChange={e=>setManualVals({...manualVals, c9:Number(e.target.value)})} className="h-10 border-blue-600 border-2 font-black text-center text-blue-700" />
              </div>
            </div>

            <div className="p-6 bg-black text-white rounded-2xl border-4 border-white/20">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-60 text-center border-b border-white/20 pb-2 mb-4">Entry Impact Matrix</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
                <div className="p-2 border border-white/10 rounded-xl"><p className="text-[9px] uppercase font-black opacity-50">Emp Fund Effect</p><p className="text-base font-black">{rowVerification.netEmp.toLocaleString()}</p></div>
                <div className="p-2 border border-white/10 rounded-xl"><p className="text-[9px] uppercase font-black opacity-50">Office Fund Effect</p><p className="text-base font-black">{rowVerification.netOff.toLocaleString()}</p></div>
                <div className="p-2 border border-white/10 rounded-xl"><p className="text-[9px] uppercase font-black opacity-50 text-rose-400">Loan Bal Delta</p><p className="text-base font-black text-rose-300">{rowVerification.loanEffect.toLocaleString()}</p></div>
                <div className="bg-white/10 rounded-xl p-2 border border-emerald-500/50"><p className="text-[10px] uppercase font-black">TOTAL NET IMPACT</p><p className="text-xl font-black text-emerald-400">৳ {rowVerification.total.toLocaleString()}</p></div>
              </div>
            </div>
            <Button type="submit" className="w-full h-16 font-black uppercase tracking-[0.4em] bg-black text-white shadow-2xl hover:bg-slate-900 border-2 border-white/10">Commit Matrix to Ledger</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettlementOpen} onOpenChange={setIsSettlementOpen}>
        <DialogContent className="max-w-md bg-white border-4 border-black p-0 overflow-hidden shadow-2xl rounded-none">
          <DialogHeader className="bg-rose-50 p-6 border-b-4 border-black"><DialogTitle className="text-xl font-black uppercase text-rose-700 flex items-center gap-3"><UserX className="size-6" /> Final Settlement</DialogTitle></DialogHeader>
          <form onSubmit={handleFinalSettlement} className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Settlement Category</Label><Select name="reason" defaultValue="Retired"><SelectTrigger className="h-11 border-2 border-black font-black uppercase text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Retired">RETIRED</SelectItem><SelectItem value="Transferred">TRANSFERRED</SelectItem><SelectItem value="Dismissed">DISMISSED</SelectItem><SelectItem value="InActive">INACTIVE</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Closure Date</Label><Input name="settlementDate" type="date" required max="9999-12-31" defaultValue={new Date().toISOString().split('T')[0]} className="h-11 border-2 border-black font-black" /></div>
            </div>
            <div className="bg-slate-50 p-4 border-2 border-black space-y-2">
               <p className="text-[9px] font-black uppercase opacity-40">Closure Impact Audit</p>
               <p className="text-xs font-black">Net Pay-out: ৳ {ledgerLogic.grand.c11.toLocaleString()}</p>
               <p className="text-[9px] text-slate-500 font-bold uppercase italic leading-tight">Full reversal of equity columns. Outstanding loans will be adjusted via positive repayment.</p>
            </div>
            <DialogFooter><Button type="button" variant="outline" className="border-2 border-black font-black uppercase text-xs" onClick={() => setIsSettlementOpen(false)}>Cancel</Button><Button type="submit" className="bg-rose-700 text-white font-black uppercase text-xs px-8">Confirm Payout</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
