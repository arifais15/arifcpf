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
  ShieldCheck,
  Calculator,
  Save,
  Info,
  TrendingUp,
  Landmark,
  HandCoins
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
import { Badge } from "@/components/ui/badge";

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
    if (!summaries) return { rows: [], grand: { c1:0, c2:0, c3:0, c4:0, c5:0, c6:0, c7:0, c8:0, c9:0, c10:0, c11:0 }, totalAllTime: { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 } };
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
      grand: { 
        c1: viewSums.c1, 
        c2: viewSums.c2, 
        c3: viewSums.c3, 
        c4: lastRow.col4,
        c5: viewSums.c5, 
        c6: viewSums.c6, 
        c7: lastRow.col7,
        c8: viewSums.c8, 
        c9: viewSums.c9, 
        c10: lastRow.col10, 
        c11: lastRow.col11 
      }, 
      totalAllTime: allC.reduce((acc, r) => ({ c1: acc.c1 + r.c1, c2: acc.c2 + r.c2, c3: acc.c3 + r.c3, c5: acc.c5 + r.c5, c6: acc.c6 + r.c6, c8: acc.c8 + r.c8, c9: acc.c9 + r.c9 }), { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 }) 
    };
  }, [summaries, dateRange]);

  const rowVerification = useMemo(() => {
    const netEmp = (manualVals.c1 - manualVals.c2 + manualVals.c3 + manualVals.c5 + manualVals.c6);
    const netOff = manualVals.c8 + manualVals.c9;
    return { 
      netEmp, 
      netOff, 
      total: netEmp + netOff, 
      loanEffect: manualVals.c2 - manualVals.c3 
    };
  }, [manualVals]);

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
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
    <div className="flex gap-3 no-print">
      <Button onClick={() => window.print()} className="h-11 bg-black text-white font-black uppercase text-[11px] px-8 shadow-2xl hover:bg-slate-900 border-2 border-black/10">
        <Printer className="size-4 mr-3" /> Print Statement
      </Button>
      <Button variant="outline" onClick={() => { setEditingEntry(null); setManualVals({ c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 }); setIsEntryOpen(true); }} className="h-11 border-2 border-black font-black uppercase text-[11px] text-black hover:bg-slate-50 shadow-lg">
        <Plus className="size-4 mr-3" /> Manual Sync
      </Button>
      <Button variant="outline" onClick={() => setIsSettlementOpen(true)} className="h-11 border-2 border-rose-600 text-rose-700 hover:bg-rose-50 font-black uppercase text-[11px] shadow-lg">
        <UserX className="size-4 mr-3" /> Final Settlement
      </Button>
    </div>
  ), []);

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-[#000000]">
      <PageHeaderActions>{headerActions}</PageHeaderActions>

      <div className="bg-white p-4 border-4 border-black shadow-2xl flex flex-col md:flex-row items-center justify-between no-print gap-6">
        <Link href="/members" className="p-2 hover:bg-slate-100 rounded-full border-2 border-black transition-colors"><ArrowLeft className="size-6" /></Link>
        <div className="flex flex-wrap items-center gap-6 bg-slate-50 p-3 border-2 border-black rounded-2xl shadow-inner">
          <div className="grid gap-1">
            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Archive Period</Label>
            <Select 
              value={selectedFY} 
              onValueChange={(fy) => { 
                setSelectedFY(fy); 
                if(fy==="all") setDateRange({start:"2010-01-01", end:new Date().toISOString().split('T')[0]}); 
                else { const s = parseInt(fy.split("-")[0]); setDateRange({start:`${s}-07-01`, end:`${s+1}-06-30`}); } 
              }}
            >
              <SelectTrigger className="h-10 w-[140px] border-2 border-black font-black text-[12px] uppercase bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-2 border-black">
                {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}
                <SelectItem value="all" className="font-black text-xs">ALL HISTORICAL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-10 w-px bg-black opacity-10" />
          <div className="grid gap-1"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Range Start</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start:e.target.value})} className="h-10 w-40 border-2 border-black text-[11px] font-black bg-white" /></div>
          <ArrowRightLeft className="size-4 opacity-30 mt-5" />
          <div className="grid gap-1"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Range End</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end:e.target.value})} className="h-10 w-40 border-2 border-black text-[11px] font-black bg-white" /></div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-12 shadow-[20px_20px_0px_0px_rgba(0,0,0,0.1)] border-4 border-black max-w-[1500px] mx-auto w-full print-container overflow-x-auto rounded-none">
        <div className="text-center border-b-4 border-black pb-8 mb-10 min-w-[1050px] relative">
          <div className="absolute top-0 left-0 bg-black text-white px-4 py-1 font-black text-[10px] uppercase tracking-widest">Institutional Vault Registry</div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.4em] mt-3 underline underline-offset-8 decoration-4">Provident Fund Subsidiary Ledger</h2>
        </div>

        <div className="grid grid-cols-3 border-4 border-black mb-10 text-[11px] font-black min-w-[1050px] uppercase tabular-nums bg-slate-50">
          <div className="border-r-2 border-b-2 border-black p-4 flex gap-4 items-center">
            <span className="text-slate-400 text-[10px]">PERSONNEL:</span>
            <span className="text-base flex-1 truncate">{member?.name}</span>
          </div>
          <div className="border-r-2 border-b-2 border-black p-4 flex gap-4 items-center bg-white">
            <span className="text-slate-400 text-[10px]">VAULT ID:</span>
            <span className="text-base font-mono bg-black text-white px-2 py-0.5">{member?.memberIdNumber}</span>
          </div>
          <div className="border-b-2 border-black p-4 flex gap-4 items-center">
            <span className="text-slate-400 text-[10px]">DESIGNATION:</span>
            <span className="text-base flex-1 truncate">{member?.designation}</span>
          </div>
          <div className="border-r-2 border-black p-4 flex gap-4 items-center bg-white">
            <span className="text-slate-400 text-[10px]">ZONAL OFFICE:</span>
            <span className="text-sm flex-1 truncate">{member?.zonalOffice || "HEAD OFFICE"}</span>
          </div>
          <div className="border-r-2 border-black p-4 flex gap-4 items-center">
            <span className="text-slate-400 text-[10px]">STATUS:</span>
            <span className={cn("text-sm font-black px-3 py-1 rounded-full border-2", member?.status === 'Active' ? "border-emerald-600 text-emerald-700 bg-emerald-50" : "border-rose-600 text-rose-700 bg-rose-50")}>{member?.status || "Active"}</span>
          </div>
          <div className="p-4 flex gap-4 items-center bg-white">
            <span className="text-slate-400 text-[10px]">INCEPTION:</span>
            <span className="text-sm flex-1">{member?.dateJoined}</span>
          </div>
        </div>

        <table className="w-full text-[9px] border-collapse border-4 border-black font-black tabular-nums min-w-[1050px] shadow-lg">
          <thead className="bg-slate-100 border-b-4 border-black uppercase text-center font-black">
            <tr className="border-b-2 border-black">
              <th rowSpan={2} className="border-r-2 border-black p-2 w-[85px] bg-slate-200">Date</th>
              <th rowSpan={2} className="border-r-2 border-black p-2">Transaction Detail</th>
              <th rowSpan={2} className="border-r-2 border-black p-2 bg-blue-50/50">Employee<br/>Contrib</th>
              <th rowSpan={2} className="border-r-2 border-black p-2 bg-rose-50/50">Loan<br/>Disburse</th>
              <th rowSpan={2} className="border-r-2 border-black p-2 bg-emerald-50/50">Loan<br/>Repay</th>
              <th rowSpan={2} className="border-r-2 border-black p-2 bg-slate-900 text-white w-[100px]">Loan<br/>Balance</th>
              <th colSpan={2} className="border-r-2 border-black p-2 bg-orange-50/50">Yield on</th>
              <th rowSpan={2} className="border-r-2 border-black p-2 bg-slate-200 w-[110px]">Total<br/>Equity</th>
              <th rowSpan={2} className="border-r-2 border-black p-2 bg-indigo-50/50">PBS<br/>Contrib</th>
              <th rowSpan={2} className="border-r-2 border-black p-2 bg-indigo-50/50">Profit on<br/>PBS Contrib</th>
              <th rowSpan={2} className="border-r-2 border-black p-2 bg-slate-200 w-[110px]">Total<br/>Office</th>
              <th rowSpan={2} className="border-r-2 border-black p-2 bg-black text-white w-[130px]">CUMULATIVE<br/>FUND TOTAL</th>
              <th rowSpan={2} className="p-2 no-print bg-slate-100 w-[100px]">Audits</th>
            </tr>
            <tr className="border-b-2 border-black">
              <th className="border-r-2 border-black p-2 bg-orange-50/30">Member<br/>Fund</th>
              <th className="border-r-2 border-black p-2 bg-orange-50/30">CPF Loan</th>
            </tr>
            <tr className="bg-slate-900 text-white text-[8px] border-b-4 border-black h-8">
              <th className="border-r-2 border-white/20">—</th>
              <th className="border-r-2 border-white/20">—</th>
              <th className="border-r-2 border-white/20">1</th>
              <th className="border-r-2 border-white/20">2</th>
              <th className="border-r-2 border-white/20">3</th>
              <th className="border-r-2 border-white/20">4 (Prev+2-3)</th>
              <th className="border-r-2 border-white/20">5</th>
              <th className="border-r-2 border-white/20">6</th>
              <th className="border-r-2 border-white/20">7 (Prev+1-2+3+5+6)</th>
              <th className="border-r-2 border-white/20">8</th>
              <th className="border-r-2 border-white/20">9</th>
              <th className="border-r-2 border-white/20">10 (8+9)</th>
              <th className="border-r-2 border-white/20">11 (7+10)</th>
              <th className="no-print opacity-50">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {ledgerLogic.rows.map((r: any, idx: number) => (
              <tr key={idx} className={cn("border-b-2 border-black h-12 hover:bg-slate-50 transition-colors", r.isOpening && "bg-slate-100/50 italic")}>
                <td className="border-r-2 border-black p-2 text-center font-mono text-xs">{r.summaryDate}</td>
                <td className="border-r-2 border-black p-2 uppercase truncate max-w-[200px] leading-tight">{r.particulars}</td>
                <td className="border-r-2 border-black p-2 text-right">{r.c1.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r-2 border-black p-2 text-right text-rose-600">{r.c2.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r-2 border-black p-2 text-right text-emerald-600">{r.c3.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r-2 border-black p-2 text-right bg-slate-900 text-white font-mono">{r.col4.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r-2 border-black p-2 text-right">{r.c5.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r-2 border-black p-2 text-right">{r.c6.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r-2 border-black p-2 text-right bg-slate-100 font-bold">{r.col7.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r-2 border-black p-2 text-right">{r.c8.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r-2 border-black p-2 text-right">{r.c9.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r-2 border-black p-2 text-right bg-slate-100 font-bold">{r.col10.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r-2 border-black p-2 text-right bg-black text-white text-base underline decoration-white/20 underline-offset-4">৳ {r.col11.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-2 text-center no-print bg-slate-50">{!r.isOpening && <div className="flex gap-2 justify-center"><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black hover:text-white" onClick={() => { setEditingEntry(r); setManualVals({ c1:r.c1, c2:r.c2, c3:r.c3, c5:r.c5, c6:r.c6, c8:r.c8, c9:r.c9 }); setIsEntryOpen(true); }}><Edit2 className="size-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-600 hover:text-white" onClick={() => showAlert({ title:"Irreversible Purge?", description: "Remove this voucher from subsidiary record?", type:"warning", showCancel:true, onConfirm:() => deleteDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", r.id)) })}><Trash2 className="size-4" /></Button></div>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-200 font-black border-t-4 border-black text-[10px] uppercase tabular-nums">
            <tr className="h-16">
              <td colSpan={2} className="border-r-2 border-black p-4 text-right bg-slate-900 text-white tracking-[0.2em]">Institutional Grand Totals:</td>
              <td className="border-r-2 border-black p-2 text-right">{ledgerLogic.grand.c1.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r-2 border-black p-2 text-right text-rose-700">{ledgerLogic.grand.c2.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r-2 border-black p-2 text-right text-emerald-700">{ledgerLogic.grand.c3.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r-2 border-black p-2 text-right bg-slate-900 text-white text-sm border-y-4 border-white/10">{ledgerLogic.grand.c4.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r-2 border-black p-2 text-right">{ledgerLogic.grand.c5.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r-2 border-black p-2 text-right">{ledgerLogic.grand.c6.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r-2 border-black p-2 text-right bg-white text-base border-y-4 border-black/5">{ledgerLogic.grand.c7.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r-2 border-black p-2 text-right">{ledgerLogic.grand.c8.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r-2 border-black p-2 text-right">{ledgerLogic.grand.c9.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r-2 border-black p-2 text-right bg-white text-base border-y-4 border-black/5">{ledgerLogic.grand.c10.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r-2 border-black p-2 text-right bg-black text-white text-xl underline decoration-double decoration-white/30 px-4">৳ {ledgerLogic.grand.c11.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="no-print bg-slate-900"></td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-20 flex justify-between items-end border-t-2 border-black pt-8 no-print">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase text-slate-400">Vault Verification</p>
            <div className="flex items-center gap-2 text-emerald-600">
               <ShieldCheck className="size-5" />
               <span className="text-xs font-black uppercase tracking-widest">Mathematical Consistency Verified</span>
            </div>
          </div>
          <p className="text-[9px] font-black uppercase text-slate-300">Subsidiary Terminal v2.4 • Zero-Config Local Mode</p>
        </div>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={(o) => { setIsEntryOpen(o); if(!o) setEditingEntry(null); }}>
        <DialogContent className="max-w-[1000px] bg-white p-0 rounded-none shadow-2xl border-[6px] border-black overflow-hidden max-h-[95vh] flex flex-col font-ledger">
          <DialogHeader className="bg-black text-white p-8 border-b-4 border-black shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
               <Calculator className="size-10 text-emerald-400" />
               <div>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Manual Individual Ledger Posting Terminal</DialogTitle>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mt-1">Direct Vault Modification Interface</p>
               </div>
            </div>
            {editingEntry && <Badge className="bg-emerald-500 text-black font-black uppercase tracking-widest px-4 h-8 rounded-none">Editing Record</Badge>}
          </DialogHeader>

          <form onSubmit={handleManualSubmit} className="flex-1 overflow-y-auto p-10 space-y-10 text-black bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 p-8 border-4 border-black">
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <TrendingUp className="size-3" /> Ledger Posting Date
                 </Label>
                 <Input name="summaryDate" type="date" max="9999-12-31" defaultValue={editingEntry?.summaryDate} required className="h-14 border-black border-4 font-black text-xl px-6 bg-white focus:bg-emerald-50 transition-colors" />
              </div>
              <div className="space-y-2">
                 <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Info className="size-3" /> Voucher Particulars / Memo
                 </Label>
                 <Input name="particulars" defaultValue={editingEntry?.particulars} required placeholder="E.g. SALARY CONTRIBUTION JULY-2024" className="h-14 border-black border-4 font-black text-sm px-6 bg-white uppercase focus:bg-emerald-50 transition-colors" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                 {/* GROUP 1: MEMBERSHIP EQUITY */}
                 <div className="space-y-4 border-4 border-black p-6 bg-slate-50">
                    <h4 className="text-xs font-black uppercase tracking-widest text-center border-b-2 border-black pb-2 flex items-center justify-center gap-2">
                       <Landmark className="size-4" /> Membership Equity
                    </h4>
                    <div className="space-y-4">
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-slate-400">EMP CONTRIB (COL 1)</Label>
                          <Input type="number" step="0.01" value={manualVals.c1||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c1:Number(e.target.value)})} className="h-11 border-black border-2 font-mono font-black text-right text-lg" />
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-slate-400">OFFICE CONTRIB (COL 8)</Label>
                          <Input type="number" step="0.01" value={manualVals.c8||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c8:Number(e.target.value)})} className="h-11 border-black border-2 font-mono font-black text-right text-lg" />
                       </div>
                    </div>
                 </div>

                 {/* GROUP 2: LOAN ACTIVITY */}
                 <div className="space-y-4 border-4 border-black p-6 bg-slate-50">
                    <h4 className="text-xs font-black uppercase tracking-widest text-center border-b-2 border-black pb-2 flex items-center justify-center gap-2">
                       <HandCoins className="size-4" /> Loan Activity
                    </h4>
                    <div className="space-y-4">
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-rose-600">DISBURSEMENT (COL 2)</Label>
                          <Input type="number" step="0.01" value={manualVals.c2||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c2:Number(e.target.value)})} className="h-11 border-rose-600 border-2 font-mono font-black text-right text-lg text-rose-700 bg-white" />
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-emerald-600">REPAYMENT (COL 3)</Label>
                          <Input type="number" step="0.01" value={manualVals.c3||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c3:Number(e.target.value)})} className="h-11 border-emerald-600 border-2 font-mono font-black text-right text-lg text-emerald-700 bg-white" />
                       </div>
                    </div>
                 </div>

                 {/* GROUP 3: YIELD DISTRIBUTIONS */}
                 <div className="space-y-4 border-4 border-black p-6 bg-slate-50">
                    <h4 className="text-xs font-black uppercase tracking-widest text-center border-b-2 border-black pb-2 flex items-center justify-center gap-2">
                       <Percent className="size-4" /> Yield Distributions
                    </h4>
                    <div className="space-y-4">
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-orange-600">PROFIT EMP (COL 5)</Label>
                          <Input type="number" step="0.01" value={manualVals.c5||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c5:Number(e.target.value)})} className="h-11 border-orange-600 border-2 font-mono font-black text-right text-lg text-orange-700 bg-white" />
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-orange-600">PROFIT LOAN (COL 6)</Label>
                          <Input type="number" step="0.01" value={manualVals.c6||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c6:Number(e.target.value)})} className="h-11 border-orange-600 border-2 font-mono font-black text-right text-lg text-orange-700 bg-white" />
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-indigo-600">PROFIT PBS (COL 9)</Label>
                          <Input type="number" step="0.01" value={manualVals.c9||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c9:Number(e.target.value)})} className="h-11 border-indigo-600 border-2 font-mono font-black text-right text-lg text-indigo-700 bg-white" />
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-10 bg-black text-white border-[6px] border-emerald-500/20 shadow-2xl relative">
              <div className="absolute top-0 right-10 -translate-y-1/2 bg-emerald-500 text-black px-6 py-2 font-black uppercase text-[11px] tracking-widest shadow-xl">Audit Result</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                <div className="space-y-2 border-r-2 border-white/10 pr-6">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Fund Δ</p>
                   <p className={cn("text-2xl font-black tabular-nums", rowVerification.netEmp >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {rowVerification.netEmp >= 0 ? "+" : ""}{rowVerification.netEmp.toLocaleString()}
                   </p>
                </div>
                <div className="space-y-2 border-r-2 border-white/10 pr-6">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Office Fund Δ</p>
                   <p className={cn("text-2xl font-black tabular-nums", rowVerification.netOff >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {rowVerification.netOff >= 0 ? "+" : ""}{rowVerification.netOff.toLocaleString()}
                   </p>
                </div>
                <div className="space-y-2 border-r-2 border-white/10 pr-6">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loan Balance Δ</p>
                   <p className={cn("text-2xl font-black tabular-nums", rowVerification.loanEffect >= 0 ? "text-rose-400" : "text-emerald-400")}>
                      {rowVerification.loanEffect >= 0 ? "+" : ""}{rowVerification.loanEffect.toLocaleString()}
                   </p>
                </div>
                <div className="space-y-2">
                   <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">TOTAL NET FUND IMPACT</p>
                   <p className="text-3xl font-black tabular-nums underline decoration-double decoration-emerald-500/30">৳ {rowVerification.total.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-24 font-black uppercase tracking-[0.5em] bg-black text-white shadow-2xl hover:bg-slate-900 border-4 border-white/10 text-xl transition-all group">
              <Save className="size-8 mr-6 group-hover:scale-125 transition-transform text-emerald-400" />
              Commit Voucher to Vault
            </Button>
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
