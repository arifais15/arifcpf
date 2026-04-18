
"use client"

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Printer, 
  ArrowLeft, 
  Loader2, 
  Plus, 
  ArrowRightLeft, 
  Calculator, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  HandCoins,
  Edit2,
  Trash2,
  UserX,
  CheckCircle2,
  Calendar
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { cn } from "@/lib/utils";
import { PageHeaderActions } from "@/components/header-actions";
import { Badge } from "@/components/ui/badge";
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
    const curMonth = now.getMonth() + 1;
    const startYear = curMonth >= 7 ? now.getFullYear() : now.getFullYear() - 1;
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
    const viewSums = rows.reduce((acc, r) => ({ c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3, c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9 }), { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 });
    const lastRow = rows[rows.length-1] || { col4:0, col7:0, col10:0, col11:0 };
    return { rows, grand: { c1:viewSums.c1, c2:viewSums.c2, c3:viewSums.c3, c5:viewSums.c5, c6:viewSums.c6, c8:viewSums.c8, c9:viewSums.c9, c4:lastRow.col4, c7:lastRow.col7, c10:lastRow.col10, c11:lastRow.col11 }, totalAllTime: allC.reduce((acc, r) => ({ c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3, c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9 }), { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 }) };
  }, [summaries, dateRange]);

  const rowVerification = useMemo(() => {
    const netEmp = (manualVals.c1 - manualVals.c2 + manualVals.c3 + manualVals.c5 + manualVals.c6);
    const netOff = manualVals.c8 + manualVals.c9;
    return { netEmp, netOff, total: netEmp + netOff, loanEffect: manualVals.c2 - manualVals.c3 };
  }, [manualVals]);

  const handleManualSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const d = { summaryDate: f.get("summaryDate"), particulars: f.get("particulars"), employeeContribution: manualVals.c1, loanWithdrawal: manualVals.c2, loanRepayment: manualVals.c3, profitEmployee: manualVals.c5, profitLoan: manualVals.c6, pbsContribution: manualVals.c8, profitPbs: manualVals.c9, memberId: resolvedParams.id, updatedAt: new Date().toISOString() }; 
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
    const entry = { summaryDate: sDate, particulars: `FINAL SETTLEMENT - ${reason.toUpperCase()}`, employeeContribution: -(ledgerLogic.totalAllTime.c1 || 0), loanWithdrawal: 0, loanRepayment: currentLoanBal > 0 ? currentLoanBal : 0, profitEmployee: -(ledgerLogic.totalAllTime.c5 || 0), profitLoan: -(ledgerLogic.totalAllTime.c6 || 0), pbsContribution: -(ledgerLogic.totalAllTime.c8 || 0), profitPbs: -(ledgerLogic.totalAllTime.c9 || 0), memberId: resolvedParams.id, isSettlement: true, createdAt: new Date().toISOString() };
    addDocumentNonBlocking(summariesRef, entry);
    updateDocumentNonBlocking(memberRef, { status: reason, settlementDate: sDate, settledAmount: ledgerLogic.grand.c11, updatedAt: new Date().toISOString() });
    setIsSettlementOpen(false);
    toast({ title: "Settlement Confirmed" });
  };

  const headerActions = useMemo(() => (
    <div className="flex gap-2 ml-auto no-print">
      <Button variant="outline" onClick={() => setIsSettlementOpen(true)} className="h-10 border-rose-600 text-rose-700 hover:bg-rose-50 font-black uppercase text-[10px]"><UserX className="size-4 mr-2" /> Final Settlement</Button>
      <Button variant="outline" onClick={() => setIsEntryOpen(true)} className="h-10 border-black font-black uppercase text-[10px] text-black"><Plus className="size-4 mr-2" /> Manual Sync</Button>
      <Button onClick={() => window.print()} className="h-10 bg-black text-white font-black uppercase text-[10px] px-8"><Printer className="size-4 mr-2" /> Print</Button>
    </div>
  ), []);

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-12" /></div>;

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-black">
      <PageHeaderActions>{headerActions}</PageHeaderActions>

      <div className="bg-white p-4 border-2 border-black shadow-xl flex items-center justify-between no-print animate-in slide-in-from-top duration-500">
        <Link href="/members" className="p-2 hover:bg-slate-100 rounded-full border border-black"><ArrowLeft className="size-5" /></Link>
        <div className="flex items-center gap-4 bg-slate-50 p-2 border border-black rounded-xl">
          <div className="grid gap-1">
            <Label className="text-[9px] font-black uppercase text-black ml-1">Analysis Period</Label>
            <Select value={selectedFY} onValueChange={(fy) => { setSelectedFY(fy); if(fy==="all") setDateRange({start:"2010-01-01", end:new Date().toISOString().split('T')[0]}); else { const s = parseInt(fy.split("-")[0]); setDateRange({start:`${s}-07-01`, end:`${s+1}-06-30`}); } }}>
              <SelectTrigger className="h-8 w-[100px] border-black font-black text-[10px] uppercase"><SelectValue /></SelectTrigger>
              <SelectContent>{availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}<SelectItem value="all" className="font-black text-xs">ALL TIME</SelectItem></SelectContent>
            </Select>
          </div>
          <ArrowRightLeft className="size-3 opacity-30 mt-4" />
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-black ml-1">From</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start:e.target.value})} className="h-8 w-32 border-black text-[10px] font-black" /></div>
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-black ml-1">To</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end:e.target.value})} className="h-8 w-32 border-black text-[10px] font-black" /></div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-10 shadow-2xl border-2 border-black max-w-[1400px] mx-auto w-full print-container overflow-x-auto">
        <div className="text-center border-b-2 border-black pb-4 mb-6 min-w-[950px]">
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.3em] mt-2">Provident Fund Subsidiary Ledger</h2>
        </div>

        <div className="grid grid-cols-3 gap-y-2 gap-x-8 mb-6 text-[10px] font-black border-b-2 border-black pb-4 min-w-[950px] uppercase">
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>NAME:</span><span className="flex-1 truncate">{member?.name}</span></div>
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>ID NO:</span><span className="font-mono">{member?.memberIdNumber}</span></div>
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>POSITION:</span><span className="flex-1 truncate">{member?.designation}</span></div>
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>OFFICE:</span><span className="flex-1 truncate">{member?.zonalOffice || "HO"}</span></div>
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>STATUS:</span><span className={cn("flex-1", member?.status !== 'Active' && "text-rose-600")}>{member?.status || "Active"}</span></div>
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>JOIN DATE:</span><span className="flex-1">{member?.dateJoined}</span></div>
        </div>

        <table className="w-full text-[9px] border-collapse border-2 border-black font-black tabular-nums min-w-[950px]">
          <thead className="bg-slate-50 border-b-2 border-black uppercase text-[8px]">
            <tr>
              <th rowSpan={2} className="border border-black p-1 w-[70px]">Date</th>
              <th rowSpan={2} className="border border-black p-1">Particulars</th>
              <th className="border border-black p-1">Emp(1)</th><th className="border border-black p-1">Draw(2)</th><th className="border border-black p-1">Repay(3)</th><th className="border border-black p-1 bg-slate-200">L.Bal(4)</th><th className="border border-black p-1">P.E(5)</th><th className="border border-black p-1">P.L(6)</th><th className="border border-black p-1 bg-slate-200">Net.E(7)</th><th className="border border-black p-1">PBS(8)</th><th className="border border-black p-1">P.P(9)</th><th className="border border-black p-1 bg-slate-200">Net.O(10)</th><th className="border border-black p-1 bg-black text-white">Total(11)</th><th className="border border-black p-1 no-print">Action</th>
            </tr>
          </thead>
          <tbody>
            {ledgerLogic.rows.map((r: any, idx: number) => (
              <tr key={idx} className={cn("border-b border-black h-8", r.isOpening && "bg-slate-50 italic")}>
                <td className="border border-black p-1 text-center font-mono">{r.summaryDate}</td>
                <td className="border border-black p-1 uppercase truncate max-w-[150px]">{r.particulars}</td>
                <td className="border border-black p-1 text-right">{r.c1.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.c2.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.c3.toLocaleString()}</td><td className="border border-black p-1 text-right bg-slate-50">{r.col4.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.c5.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.c6.toLocaleString()}</td><td className="border border-black p-1 text-right bg-slate-50">{r.col7.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.c8.toLocaleString()}</td><td className="border border-black p-1 text-right">{r.c9.toLocaleString()}</td><td className="border border-black p-1 text-right bg-slate-50">{r.col10.toLocaleString()}</td><td className="border border-black p-1 text-right bg-slate-100 font-bold">{r.col11.toLocaleString()}</td>
                <td className="border border-black p-1 text-center no-print">{!r.isOpening && <div className="flex gap-1 justify-center"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingEntry(r); setManualVals({ c1:r.c1, c2:r.c2, c3:r.c3, c5:r.c5, c6:r.c6, c8:r.c8, c9:r.c9 }); setIsEntryOpen(true); }}><Edit2 className="size-3" /></Button><Button variant="ghost" size="icon" className="h-6 w-6 text-rose-600" onClick={() => showAlert({ title:"Remove?", type:"warning", showCancel:true, onConfirm:() => deleteDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", r.id)) })}><Trash2 className="size-3" /></Button></div>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-black border-t-4 border-black text-[9px] uppercase">
            <tr className="h-10"><td colSpan={2} className="border border-black p-2 text-right">Aggregate Period Totals:</td><td className="border border-black p-1 text-right">{ledgerLogic.grand.c1.toLocaleString()}</td><td className="border border-black p-1 text-right">{ledgerLogic.grand.c2.toLocaleString()}</td><td className="border border-black p-1 text-right">{ledgerLogic.grand.c3.toLocaleString()}</td><td className="border border-black p-1 text-right bg-slate-200">{ledgerLogic.grand.c4.toLocaleString()}</td><td className="border border-black p-1 text-right">{ledgerLogic.grand.c5.toLocaleString()}</td><td className="border border-black p-1 text-right">{ledgerLogic.grand.c6.toLocaleString()}</td><td className="border border-black p-1 text-right bg-slate-200">{ledgerLogic.grand.c7.toLocaleString()}</td><td className="border border-black p-1 text-right">{ledgerLogic.grand.c8.toLocaleString()}</td><td className="border border-black p-1 text-right">{ledgerLogic.grand.c9.toLocaleString()}</td><td className="border border-black p-1 text-right bg-slate-200">{ledgerLogic.grand.c10.toLocaleString()}</td><td className="border border-black p-1 text-right bg-black text-white text-[11px]">৳ {ledgerLogic.grand.c11.toLocaleString()}</td><td className="border border-black p-1 no-print"></td></tr>
          </tfoot>
        </table>
      </div>

      <Dialog open={isSettlementOpen} onOpenChange={setIsSettlementOpen}>
        <DialogContent className="max-w-md bg-white border-4 border-black p-0 overflow-hidden shadow-2xl rounded-none">
          <DialogHeader className="bg-rose-50 p-6 border-b-4 border-black"><DialogTitle className="text-xl font-black uppercase text-rose-700">Final Settlement</DialogTitle></DialogHeader>
          <form onSubmit={handleFinalSettlement} className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Category</Label><Select name="reason" defaultValue="Retired"><SelectTrigger className="h-11 border-2 border-black font-black uppercase text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Retired">RETIRED</SelectItem><SelectItem value="Transferred">TRANSFERRED</SelectItem><SelectItem value="Dismissed">DISMISSED</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Date</Label><Input name="settlementDate" type="date" required max="9999-12-31" defaultValue={new Date().toISOString().split('T')[0]} className="h-11 border-2 border-black font-black" /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setIsSettlementOpen(false)}>Cancel</Button><Button type="submit" className="bg-rose-700 text-white font-black uppercase text-xs">Confirm Settlement</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntryOpen} onOpenChange={(o) => { setIsEntryOpen(o); if(!o) setEditingEntry(null); }}>
        <DialogContent className="max-w-4xl bg-white p-0 rounded-2xl shadow-2xl border-4 border-black overflow-hidden max-h-[95vh] flex flex-col">
          <DialogHeader className="bg-slate-50 p-6 border-b-4 border-black shrink-0"><DialogTitle className="text-xl font-black uppercase">Voucher Matrix Terminal</DialogTitle></DialogHeader>
          <form onSubmit={handleManualSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Posting Date</Label><Input name="summaryDate" type="date" max="9999-12-31" defaultValue={editingEntry?.summaryDate} required className="h-12 border-black border-4 font-black" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Particulars</Label><Input name="particulars" defaultValue={editingEntry?.particulars} required className="h-12 border-black border-4 font-black" /></div>
            </div>
            <div className="grid grid-cols-2 gap-8 bg-slate-50 p-6 rounded-2xl border-2 border-black shadow-inner">
              <div className="space-y-4">
                <h3 className="text-[11px] font-black uppercase underline tracking-widest text-primary">Contributions</h3>
                <div className="space-y-3"><div className="flex items-center justify-between"><Label className="text-[10px] uppercase">Col 1: Emp</Label><Input type="number" step="0.01" value={manualVals.c1||''} onChange={e=>setManualVals({...manualVals, c1:Number(e.target.value)})} className="w-32 border-black border-2 text-right" /></div><div className="flex items-center justify-between"><Label className="text-[10px] uppercase">Col 8: PBS</Label><Input type="number" step="0.01" value={manualVals.c8||''} onChange={e=>setManualVals({...manualVals, c8:Number(e.target.value)})} className="w-32 border-black border-2 text-right" /></div></div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[11px] font-black uppercase underline tracking-widest text-rose-600">Loan Activity</h3>
                <div className="space-y-3"><div className="flex items-center justify-between"><Label className="text-[10px] uppercase">Col 2: Draw</Label><Input type="number" step="0.01" value={manualVals.c2||''} onChange={e=>setManualVals({...manualVals, c2:Number(e.target.value)})} className="w-32 border-rose-600 border-2 text-right" /></div><div className="flex items-center justify-between"><Label className="text-[10px] uppercase">Col 3: Repay</Label><Input type="number" step="0.01" value={manualVals.c3||''} onChange={e=>setManualVals({...manualVals, c3:Number(e.target.value)})} className="w-32 border-emerald-600 border-2 text-right" /></div></div>
              </div>
            </div>
            <div className="p-6 bg-black text-white rounded-2xl flex flex-col gap-4 border-4 border-white/20">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-60 text-center border-b border-white/20 pb-2">Entry Impact Verification</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-[9px] uppercase font-black opacity-50">Emp Fund Effect</p><p className="text-lg font-black">{rowVerification.netEmp.toLocaleString()}</p></div>
                <div><p className="text-[9px] uppercase font-black opacity-50">Office Fund Effect</p><p className="text-lg font-black">{rowVerification.netOff.toLocaleString()}</p></div>
                <div className="bg-white/10 rounded-xl p-2"><p className="text-[10px] uppercase font-black">TOTAL NET IMPACT</p><p className="text-xl font-black text-emerald-400">৳ {rowVerification.total.toLocaleString()}</p></div>
              </div>
            </div>
            <Button type="submit" className="w-full h-16 font-black uppercase tracking-[0.4em] bg-black text-white">Commit Matrix to Ledger</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
