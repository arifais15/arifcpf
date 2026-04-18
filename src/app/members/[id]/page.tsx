
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
  CheckCircle2
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

  const [manualVals, setManualVals] = useState({
    c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0
  });

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
      const v = { 
        c1:Number(row.employeeContribution)||0, 
        c2:Number(row.loanWithdrawal)||0, 
        c3:Number(row.loanRepayment)||0, 
        c5:Number(row.profitEmployee)||0, 
        c6:Number(row.profitLoan)||0, 
        c8:Number(row.pbsContribution)||0, 
        c9:Number(row.profitPbs)||0 
      };
      
      rL += (v.c2 - v.c3); 
      rE += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6); 
      rO += (v.c8 + v.c9);
      
      return { ...row, ...v, col4:rL, col7:rE, col10:rO, col11:rE+rO };
    });

    const s = new Date(dateRange.start).getTime();
    const e = new Date(dateRange.end).getTime();
    
    const pre = allC.filter(r => new Date(r.summaryDate).getTime() < s);
    const inR = allC.filter(r => { 
      const t = new Date(r.summaryDate).getTime(); 
      return t >= s && t <= e; 
    });

    const lastP = pre[pre.length-1] || { col4:0, col7:0, col10:0, col11:0 };
    const pSums = pre.reduce((acc, r) => ({ 
      c1:acc.c1+r.c1, c2:acc.c2+r.c2, c3:acc.c3+r.c3, c5:acc.c5+r.c5, c6:acc.c6+r.c6, c8:acc.c8+r.c8, c9:acc.c9+r.c9 
    }), { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 });

    let rows = inR;
    if (dateRange.start && pre.length > 0) {
      rows = [{ 
        summaryDate: dateRange.start, 
        particulars: "Opening Balance Brought Forward", 
        ...pSums, 
        col4:lastP.col4, col7:lastP.col7, col10:lastP.col10, col11:lastP.col11, 
        isOpening: true 
      }, ...inR];
    } else if (dateRange.start && inR.length === 0 && pre.length > 0) {
       rows = [{ 
        summaryDate: dateRange.start, 
        particulars: "Opening Balance Brought Forward", 
        ...pSums, 
        col4:lastP.col4, col7:lastP.col7, col10:lastP.col10, col11:lastP.col11, 
        isOpening: true 
      }];
    }

    const viewSums = rows.reduce((acc, r) => ({
      c1: acc.c1 + r.c1,
      c2: acc.c2 + r.c2,
      c3: acc.c3 + r.c3,
      c5: acc.c5 + r.c5,
      c6: acc.c6 + r.c6,
      c8: acc.c8 + r.c8,
      c9: acc.c9 + r.c9
    }), { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 });

    const totalSums = allC.reduce((acc, r) => ({
      c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3,
      c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9
    }), { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 });

    const last = rows[rows.length-1] || { col4:0, col7:0, col10:0, col11:0 };
    
    return { 
      rows, 
      grand: { 
        c1:viewSums.c1, c2:viewSums.c2, c3:viewSums.c3, c5:viewSums.c5, c6:viewSums.c6, c8:viewSums.c8, c9:viewSums.c9, 
        c4:last.col4, c7:last.col7, c10:last.col10, c11:last.col11 
      },
      totalAllTime: totalSums
    };
  }, [summaries, dateRange]);

  const rowVerification = useMemo(() => {
    const netEmp = (manualVals.c1 - manualVals.c2 + manualVals.c3 + manualVals.c5 + manualVals.c6);
    const netOff = manualVals.c8 + manualVals.c9;
    const total = netEmp + netOff;
    const loanEffect = manualVals.c2 - manualVals.c3;
    return { netEmp, netOff, total, loanEffect };
  }, [manualVals]);

  const updateManualVal = (key: string, val: string) => {
    setManualVals(prev => ({ ...prev, [key]: Number(val) || 0 }));
  };

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry);
    setManualVals({
      c1: entry.c1,
      c2: entry.c2,
      c3: entry.c3,
      c5: entry.c5,
      c6: entry.c6,
      c8: entry.c8,
      c9: entry.c9
    });
    setIsEntryOpen(true);
  };

  const handleDeleteEntry = (id: string) => {
    showAlert({
      title: "Remove Entry?",
      description: "Permanently delete this transaction from the subsidiary ledger?",
      type: "warning",
      showCancel: true,
      confirmText: "Delete",
      onConfirm: () => {
        const docRef = doc(firestore, "members", resolvedParams.id, "fundSummaries", id);
        deleteDocumentNonBlocking(docRef);
        toast({ title: "Ledger Entry Deleted" });
      }
    });
  };

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

    if (editingEntry && editingEntry.id) {
      const docRef = doc(firestore, "members", resolvedParams.id, "fundSummaries", editingEntry.id);
      updateDocumentNonBlocking(docRef, d);
      toast({ title: "Ledger Updated" });
    } else {
      addDocumentNonBlocking(summariesRef, { ...d, createdAt: new Date().toISOString() }); 
      toast({ title: "Ledger Synchronized" });
    }

    setIsEntryOpen(false); 
    setEditingEntry(null);
    setManualVals({ c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });
  };

  const handleFinalSettlement = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const reason = f.get("reason") as string;
    const sDate = f.get("settlementDate") as string;
    const currentLoanBal = (ledgerLogic.totalAllTime.c2 || 0) - (ledgerLogic.totalAllTime.c3 || 0);

    const settlementEntry = {
      summaryDate: sDate,
      particulars: `FINAL SETTLEMENT - ${reason.toUpperCase()}${currentLoanBal > 0 ? ` (LOAN BAL ${currentLoanBal.toLocaleString()} ADJUSTED)` : ""}`,
      employeeContribution: -(ledgerLogic.totalAllTime.c1 || 0),
      loanWithdrawal: 0, 
      loanRepayment: currentLoanBal > 0 ? currentLoanBal : 0, 
      profitEmployee: -(ledgerLogic.totalAllTime.c5 || 0),
      profitLoan: -(ledgerLogic.totalAllTime.c6 || 0),
      pbsContribution: -(ledgerLogic.totalAllTime.c8 || 0),
      profitPbs: -(ledgerLogic.totalAllTime.c9 || 0),
      memberId: resolvedParams.id,
      isSettlement: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (currentLoanBal < 0) {
      settlementEntry.loanWithdrawal = Math.abs(currentLoanBal);
      settlementEntry.loanRepayment = 0;
    }

    addDocumentNonBlocking(summariesRef, settlementEntry);
    updateDocumentNonBlocking(memberRef, {
      status: reason,
      settlementDate: sDate,
      settledAmount: ledgerLogic.grand.c11,
      updatedAt: new Date().toISOString()
    });

    toast({ title: "Settlement Confirmed" });
    setIsSettlementOpen(false);
  };

  const headerActionsContent = useMemo(() => (
    <>
      <Link href="/members" className="p-2 hover:bg-slate-100 rounded-full border border-black no-print"><ArrowLeft className="size-5 text-black" /></Link>
      <div className="flex items-center gap-3 bg-slate-50 p-2 border border-black rounded-xl no-print">
        <Select value={selectedFY} onValueChange={(fy) => { setSelectedFY(fy); if(fy==="all") setDateRange({start:"2010-01-01", end:new Date().toISOString().split('T')[0]}); else { const s = parseInt(fy.split("-")[0]); setDateRange({start:`${s}-07-01`, end:`${s+1}-06-30`}); } }}>
          <SelectTrigger className="h-8 w-[100px] font-black text-[10px] uppercase border-black text-black"><SelectValue /></SelectTrigger>
          <SelectContent>{availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}<SelectItem value="all" className="font-black text-xs">ALL TIME</SelectItem></SelectContent>
        </Select>
        <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start:e.target.value})} className="h-8 w-32 border-black text-[10px] font-black text-black" />
        <ArrowRightLeft className="size-3 opacity-30 text-black" />
        <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end:e.target.value})} className="h-8 w-32 border-black text-[10px] font-black text-black" />
      </div>
      <div className="flex gap-2 ml-auto no-print">
        <Button variant="outline" onClick={() => setIsSettlementOpen(true)} className="h-10 border-rose-600 text-rose-700 hover:bg-rose-50 font-black uppercase text-[10px]"><UserX className="size-4 mr-2" /> Final Settlement</Button>
        <Button variant="outline" onClick={() => setIsEntryOpen(true)} className="h-10 border-black font-black uppercase text-[10px] text-black"><Plus className="size-4 mr-2" /> Manual Sync</Button>
        <Button onClick={() => window.print()} className="h-10 bg-black text-white font-black uppercase text-[10px] px-8"><Printer className="size-4 mr-2" /> Print</Button>
      </div>
    </>
  ), [selectedFY, dateRange, availableFYs]);

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-[#000000]">
      <PageHeaderActions>{headerActionsContent}</PageHeaderActions>

      <div className="bg-white p-4 md:p-10 shadow-2xl border-2 border-black max-w-[1400px] mx-auto w-full print-container text-black overflow-x-auto">
        <div className="text-center border-b-2 border-black pb-4 mb-6 min-w-[950px]">
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <h2 className="text-lg md:text-xl font-black uppercase tracking-[0.3em] mt-2">Provident Fund Subsidiary Ledger</h2>
        </div>

        <div className="grid grid-cols-3 gap-y-2 gap-x-8 mb-6 text-[10px] font-black border-b-2 border-black pb-4 min-w-[950px] uppercase">
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>NAME:</span><span className="flex-1 truncate">{member?.name}</span></div>
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>ID NO:</span><span className="font-mono">{member?.memberIdNumber}</span></div>
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>POSITION:</span><span className="flex-1 truncate">{member?.designation}</span></div>
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>OFFICE:</span><span className="flex-1 truncate">{member?.zonalOffice || "HEAD OFFICE"}</span></div>
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>STATUS:</span><span className={cn("flex-1", member?.status !== 'Active' && "text-rose-600 font-black")}>{member?.status || "Active"}</span></div>
          <div className="flex gap-2 border-b border-black/10 pb-1"><span>JOIN DATE:</span><span className="flex-1">{member?.dateJoined}</span></div>
        </div>

        <table className="w-full text-[9px] border-collapse border-2 border-black font-black tabular-nums min-w-[950px]">
          <thead className="bg-slate-50 border-b-2 border-black uppercase text-[8px] text-black">
            <tr className="h-10">
              <th rowSpan={2} className="border border-black p-1 w-[70px]">Date</th>
              <th rowSpan={2} className="border border-black p-1">Particulars</th>
              <th className="border border-black p-1">Emp Cont(1)</th>
              <th className="border border-black p-1">Loan Drw(2)</th>
              <th className="border border-black p-1">Loan Rep(3)</th>
              <th className="border border-black p-1 bg-slate-200">Loan Bal(4)</th>
              <th className="border border-black p-1">Profit E(5)</th>
              <th className="border border-black p-1">Profit L(6)</th>
              <th className="border border-black p-1 bg-slate-200">Net Emp(7)</th>
              <th className="border border-black p-1">PBS Cont(8)</th>
              <th className="border border-black p-1">Profit P(9)</th>
              <th className="border border-black p-1 bg-slate-200">Net Off(10)</th>
              <th className="border border-black p-1 bg-black text-white">Total(11)</th>
              <th className="border border-black p-1 no-print">Actions</th>
            </tr>
          </thead>
          <tbody className="text-black">
            {ledgerLogic.rows.map((r: any, idx: number) => (
              <tr key={idx} className={cn("border-b border-black h-8", r.isOpening && "bg-slate-50 italic", r.isSettlement && "bg-rose-50")}>
                <td className="border border-black p-1 text-center font-mono">{r.summaryDate}</td>
                <td className="border border-black p-1 uppercase truncate max-w-[150px]">{r.particulars}</td>
                <td className="border border-black p-1 text-right">{r.c1.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.c2.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.c3.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-50">{r.col4.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.c5.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.c6.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-50">{r.col7.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.c8.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{r.c9.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-50">{r.col10.toLocaleString()}</td>
                <td className="border border-black p-1 text-right bg-slate-100 font-bold">{r.col11.toLocaleString()}</td>
                <td className="border border-black p-1 text-center no-print">
                  {!r.isOpening && (
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditEntry(r)}>
                        <Edit2 className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteEntry(r.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-black border-t-4 border-black text-[9px] uppercase">
            <tr className="h-10">
              <td colSpan={2} className="border border-black p-2 text-right">Aggregate Period Totals:</td>
              <td className="border border-black p-1 text-right">{ledgerLogic.grand.c1.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{ledgerLogic.grand.c2.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{ledgerLogic.grand.c3.toLocaleString()}</td>
              <td className="border border-black p-1 text-right bg-slate-200">{ledgerLogic.grand.c4.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{ledgerLogic.grand.c5.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{ledgerLogic.grand.c6.toLocaleString()}</td>
              <td className="border border-black p-1 text-right bg-slate-200">{ledgerLogic.grand.c7.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{ledgerLogic.grand.c8.toLocaleString()}</td>
              <td className="border border-black p-1 text-right">{ledgerLogic.grand.c9.toLocaleString()}</td>
              <td className="border border-black p-1 text-right bg-slate-200">{ledgerLogic.grand.c10.toLocaleString()}</td>
              <td className="border border-black p-1 text-right bg-black text-white text-[11px]">৳ {ledgerLogic.grand.c11.toLocaleString()}</td>
              <td className="border border-black p-1 no-print"></td>
            </tr>
          </tfoot>
        </table>
        
        <div className="mt-12 pt-6 border-t-2 border-black flex justify-between items-center text-[10px] font-black uppercase tracking-widest no-print min-w-[950px]">
          <div className="flex items-center gap-2"><ShieldCheck className="size-4" /><span>System Synchronized v1.0</span></div>
          <span>Institutional Trust Registry</span>
        </div>
      </div>

      <Dialog open={isSettlementOpen} onOpenChange={setIsSettlementOpen}>
        <DialogContent className="max-w-md bg-white border-4 border-black p-0 overflow-hidden shadow-2xl rounded-none">
          <DialogHeader className="bg-rose-50 p-6 border-b-4 border-black">
            <DialogTitle className="text-xl font-black uppercase flex items-center gap-3 text-rose-700">
              <UserX className="size-6" /> Institutional Final Settlement
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black uppercase text-rose-600">Close subsidiary account and zero ledger balances</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFinalSettlement} className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Settlement Category</Label>
                <Select name="reason" defaultValue="Retired">
                  <SelectTrigger className="h-11 border-2 border-black font-black uppercase text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Retired">RETIRED</SelectItem>
                    <SelectItem value="Transferred">TRANSFERRED</SelectItem>
                    <SelectItem value="Dismissed">DISMISSED</SelectItem>
                    <SelectItem value="InActive">INACTIVE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Date of Settlement</Label>
                <Input name="settlementDate" type="date" required max="9999-12-31" defaultValue={new Date().toISOString().split('T')[0]} className="h-11 border-2 border-black font-black" />
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-lg space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Verification Matrix: Settlement Sum</p>
              <div className="flex justify-between items-end">
                <span className="text-[9px] uppercase font-bold">Consolidated Trust Fund:</span>
                <span className="text-xl font-black text-emerald-400">৳ {ledgerLogic.grand.c11.toLocaleString()}</span>
              </div>
              <p className="text-[8px] italic opacity-40 leading-tight border-t border-white/10 pt-2">System will insert reversal entries for fund columns and adjust loan balance to zero.</p>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsSettlementOpen(false)} className="border-2 border-black font-black uppercase text-xs">Cancel</Button>
              <Button type="submit" className="bg-rose-700 hover:bg-rose-800 text-white font-black uppercase text-xs px-8 shadow-xl">Confirm & Close Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntryOpen} onOpenChange={(open) => { 
        setIsEntryOpen(open); 
        if(!open) {
          setEditingEntry(null);
          setManualVals({ c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });
        }
      }}>
        <DialogContent className="max-w-4xl bg-white p-0 rounded-2xl shadow-2xl border-4 border-black overflow-hidden max-h-[95vh] flex flex-col">
          <DialogHeader className="bg-slate-50 p-6 md:p-8 border-b-4 border-black shrink-0">
            <DialogTitle className="text-xl md:text-2xl font-black uppercase flex items-center gap-3 text-black">
              <Calculator className="size-6 md:size-8 text-black" /> {editingEntry ? "Modify Ledger Entry" : "Voucher Entry Terminal"}
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black uppercase opacity-60 text-black">Manual Ledger Synchronization Matrix</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManualSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 text-black">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase ml-1">Posting Date</Label>
                <Input name="summaryDate" type="date" max="9999-12-31" defaultValue={editingEntry?.summaryDate} required className="h-12 border-black border-4 font-black text-black text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase ml-1">Voucher Particulars</Label>
                <Input name="particulars" placeholder="e.g. Monthly Salary Sync" defaultValue={editingEntry?.particulars} required className="h-12 border-black border-4 font-black text-black text-base" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 p-4 md:p-8 rounded-2xl border-2 border-black shadow-inner">
              <div className="space-y-4">
                <h3 className="text-[11px] font-black uppercase underline tracking-widest flex items-center gap-2 text-primary"><Wallet className="size-3.5" /> Direct Contributions</h3>
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-[10px] uppercase font-bold">Col 1: Emp Contribution</Label>
                    <Input name="c1" type="number" step="0.01" value={manualVals.c1 || ''} onChange={(e) => updateManualVal('c1', e.target.value)} className="w-full sm:w-40 border-black border-2 text-right font-black h-11 text-base" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-[10px] uppercase font-bold">Col 8: PBS Contribution</Label>
                    <Input name="c8" type="number" step="0.01" value={manualVals.c8 || ''} onChange={(e) => updateManualVal('c8', e.target.value)} className="w-full sm:w-40 border-black border-2 text-right font-black h-11 text-base" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-[11px] font-black uppercase underline tracking-widest text-rose-600 flex items-center gap-2"><HandCoins className="size-3.5" /> Loan Activity</h3>
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-[10px] uppercase font-bold text-rose-600">Col 2: Loan Disbursement</Label>
                    <Input name="c2" type="number" step="0.01" value={manualVals.c2 || ''} onChange={(e) => updateManualVal('c2', e.target.value)} className="w-full sm:w-40 border-rose-600 border-2 text-right font-black h-11 text-base" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <Label className="text-[10px] uppercase font-bold text-emerald-600">Col 3: Loan Repayment</Label>
                    <Input name="c3" type="number" step="0.01" value={manualVals.c3 || ''} onChange={(e) => updateManualVal('c3', e.target.value)} className="w-full sm:w-40 border-emerald-600 border-2 text-right font-black h-11 text-base" />
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2 space-y-4 pt-6 border-t-2 border-black/10">
                <h3 className="text-[11px] font-black uppercase underline tracking-widest flex items-center gap-2 text-indigo-600"><TrendingUp className="size-3.5" /> Periodic Interest Accruals</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8">
                  <div className="space-y-1.5"><Label className="text-[9px] uppercase font-bold">Col 5: Profit Employee</Label><Input name="c5" type="number" step="0.01" value={manualVals.c5 || ''} onChange={(e) => updateManualVal('c5', e.target.value)} className="border-black border-2 text-right font-black h-11 text-base" /></div>
                  <div className="space-y-1.5"><Label className="text-[9px] uppercase font-bold">Col 9: Profit PBS</Label><Input name="c9" type="number" step="0.01" value={manualVals.c9 || ''} onChange={(e) => updateManualVal('c9', e.target.value)} className="border-black border-2 text-right font-black h-11 text-base" /></div>
                  <div className="space-y-1.5"><Label className="text-[9px] uppercase font-bold">Col 6: Profit Loan</Label><Input name="c6" type="number" step="0.01" value={manualVals.c6 || ''} onChange={(e) => updateManualVal('c6', e.target.value)} className="border-black border-2 text-right font-black h-11 text-base" /></div>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-10 bg-black text-white rounded-2xl flex flex-col gap-6 border-4 border-white/20 shadow-2xl">
              <p className="text-[11px] font-black uppercase tracking-[0.4em] opacity-60 text-center border-b border-white/20 pb-4">Verification Matrix: Entry Impact (৳)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                <div className="space-y-1"><p className="text-[9px] uppercase font-black opacity-50 tracking-wider">Employee Fund Effect</p><p className="text-xl font-black tabular-nums">{rowVerification.netEmp.toLocaleString()}</p></div>
                <div className="space-y-1"><p className="text-[9px] uppercase font-black opacity-50 tracking-wider">Office Fund Effect</p><p className="text-xl font-black tabular-nums">{rowVerification.netOff.toLocaleString()}</p></div>
                <div className="space-y-1"><p className="text-[9px] uppercase font-black opacity-50 tracking-wider">Loan Bal Effect</p><p className={cn("text-xl font-black tabular-nums", rowVerification.loanEffect > 0 ? "text-rose-400" : "text-emerald-400")}>{rowVerification.loanEffect.toLocaleString()}</p></div>
                <div className="bg-white/10 rounded-xl p-4 border border-white/5 shadow-inner">
                  <p className="text-[10px] uppercase font-black text-white/80 tracking-[0.2em] mb-1">TOTAL VOUCHER IMPACT</p>
                  <p className="text-2xl font-black text-emerald-400">৳ {rowVerification.total.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full h-20 font-black uppercase tracking-[0.5em] shadow-2xl bg-black text-white hover:bg-slate-900 border-4 border-white/10 text-lg transition-transform active:scale-[0.98]">
              {editingEntry ? "Update Entry Records" : "Commit Matrix to Ledger"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
