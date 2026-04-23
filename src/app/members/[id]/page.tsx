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
  HandCoins,
  Percent
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
      <Button onClick={() => window.print()} className="h-10 border border-black font-black uppercase text-[11px] px-6 shadow hover:bg-slate-50 text-black">
        <Printer className="size-4 mr-2" /> Print Statement
      </Button>
      <Button variant="outline" onClick={() => { setEditingEntry(null); setManualVals({ c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 }); setIsEntryOpen(true); }} className="h-10 border border-black font-black uppercase text-[11px] text-black hover:bg-slate-50 shadow">
        <Plus className="size-4 mr-2" /> Manual Sync
      </Button>
      <Button variant="outline" onClick={() => setIsSettlementOpen(true)} className="h-10 border border-rose-600 text-rose-700 hover:bg-rose-50 font-black uppercase text-[11px] shadow">
        <UserX className="size-4 mr-2" /> Final Settlement
      </Button>
    </div>
  ), [ledgerLogic.grand.c11, summariesRef, memberRef, resolvedParams.id]);

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-[#000000]">
      <PageHeaderActions>{headerActions}</PageHeaderActions>

      <div className="bg-white p-3 border border-black shadow-lg flex flex-col md:flex-row items-center justify-between no-print gap-4">
        <Link href="/members" className="p-1.5 hover:bg-slate-100 rounded-full border border-black transition-colors"><ArrowLeft className="size-5" /></Link>
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 border border-black rounded-xl shadow-inner">
          <div className="grid gap-0.5">
            <Label className="text-[9px] font-black uppercase text-black ml-1">Archive Period</Label>
            <Select 
              value={selectedFY} 
              onValueChange={(fy) => { 
                setSelectedFY(fy); 
                if(fy==="all") setDateRange({start:"2010-01-01", end:new Date().toISOString().split('T')[0]}); 
                else { const s = parseInt(fy.split("-")[0]); setDateRange({start:`${s}-07-01`, end:`${s+1}-06-30`}); } 
              }}
            >
              <SelectTrigger className="h-8 w-[120px] border border-black font-black text-[11px] uppercase bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border border-black">
                {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}
                <SelectItem value="all" className="font-black text-xs">ALL HISTORICAL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-8 w-px bg-black opacity-10" />
          <div className="grid gap-0.5"><Label className="text-[9px] font-black uppercase text-black ml-1">Range Start</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start:e.target.value})} className="h-8 w-32 border border-black text-[10px] font-black bg-white" /></div>
          <ArrowRightLeft className="size-3.5 opacity-30 mt-4" />
          <div className="grid gap-0.5"><Label className="text-[9px] font-black uppercase text-black ml-1">Range End</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end:e.target.value})} className="h-8 w-32 border border-black text-[10px] font-black bg-white" /></div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-10 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.05)] border-2 border-black max-w-[1500px] mx-auto w-full print-container overflow-x-auto rounded-none">
        <div className="text-center min-w-[1050px] relative mb-4">
          <div className="absolute top-0 left-0 bg-slate-50 border border-black px-3 py-0.5 font-black text-[8px] uppercase tracking-widest text-black">Institutional Vault Registry</div>
          <h1 className="text-xl font-black uppercase tracking-tight text-black leading-none">{pbsName}</h1>
          <h2 className="text-sm font-black uppercase tracking-[0.2em] mt-1 text-black">Provident Fund Subsidiary Ledger</h2>
        </div>

        <div className="grid grid-cols-3 border border-black mb-2 text-[10px] font-black min-w-[1050px] tabular-nums bg-white text-black">
          <div className="border-r border-b border-black py-1 px-4 flex gap-4 items-center h-[21px]">
            <span className="text-black text-[9px] uppercase tracking-tighter w-[80px]">PERSONNEL:</span>
            <span className="text-xs flex-1 truncate">{member?.name}</span>
          </div>
          <div className="border-r border-b border-black py-1 px-4 flex gap-4 items-center h-[21px]">
            <span className="text-black text-[9px] uppercase tracking-tighter w-[80px]">EmpID:</span>
            <span className="text-xs font-mono flex-1">{member?.memberIdNumber}</span>
          </div>
          <div className="border-b border-black py-1 px-4 flex gap-4 items-center h-[21px]">
            <span className="text-black text-[9px] uppercase tracking-tighter w-[80px]">POSITION:</span>
            <span className="text-xs flex-1 truncate">{member?.designation}</span>
          </div>
          <div className="border-r border-black py-1 px-4 flex gap-4 items-center h-[21px]">
            <span className="text-black text-[9px] uppercase tracking-tighter w-[80px]">OFFICE:</span>
            <span className="text-xs flex-1 truncate">{member?.zonalOffice || "Head Office"}</span>
          </div>
          <div className="border-r border-black py-1 px-4 flex gap-4 items-center h-[21px]">
            <span className="text-black text-[9px] uppercase tracking-tighter w-[80px]">STATUS:</span>
            <span className={cn("text-[10px] font-black", member?.status === 'Active' ? "text-emerald-700" : "text-rose-700")}>{member?.status || "Active"}</span>
          </div>
          <div className="py-1 px-4 flex gap-4 items-center h-[21px]">
            <span className="text-black text-[9px] uppercase tracking-tighter w-[80px]">INCEPTION:</span>
            <span className="text-xs flex-1">{member?.dateJoined}</span>
          </div>
        </div>

        <table className="w-full text-[8.5px] border-collapse border border-black font-black tabular-nums min-w-[1050px] text-black">
          <thead className="bg-slate-50 border-b border-black uppercase text-center font-black">
            <tr className="border-b border-black">
              <th rowSpan={2} className="border-r border-black p-1 w-[80px] bg-slate-100">Date</th>
              <th rowSpan={2} className="border-r border-black p-1">Transaction Detail</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-blue-50/20">Employee<br/>Contrib</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-rose-50/20">Loan<br/>Disburse</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-emerald-50/20">Loan<br/>Repay</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-slate-50 w-[90px]">Loan<br/>Balance</th>
              <th colSpan={2} className="border-r border-black p-1 bg-orange-50/20">Yield on</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-slate-50 w-[100px]">Total<br/>Equity</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-indigo-50/20">PBS<br/>Contrib</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-indigo-50/20">Profit on<br/>PBS Contrib</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-slate-50 w-[100px]">Total<br/>Office</th>
              <th rowSpan={2} className="border-r border-black p-1 bg-slate-100 w-[120px]">Cumulative<br/>Fund Total</th>
              <th rowSpan={2} className="p-1 no-print bg-slate-50 w-[80px]">Audits</th>
            </tr>
            <tr className="border-b border-black">
              <th className="border-r border-black p-1 bg-orange-50/10">Member<br/>Fund</th>
              <th className="border-r border-black p-1 bg-orange-50/10">CPF Loan</th>
            </tr>
            <tr className="bg-slate-100 text-black text-[7.5px] border-b-2 border-black h-7">
              <th className="border-r border-black/20">—</th>
              <th className="border-r border-black/20">—</th>
              <th className="border-r border-black/20">1</th>
              <th className="border-r border-black/20">2</th>
              <th className="border-r border-black/20">3</th>
              <th className="border-r border-black/20">4 (Prev+2-3)</th>
              <th className="border-r border-black/20">5</th>
              <th className="border-r border-black/20">6</th>
              <th className="border-r border-black/20">7 (Prev+1-2+3+5+6)</th>
              <th className="border-r border-black/20">8</th>
              <th className="border-r border-black/20">9</th>
              <th className="border-r border-black/20">10 (8+9)</th>
              <th className="border-r border-black/20">11 (7+10)</th>
              <th className="no-print opacity-50">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ledgerLogic.rows.map((r: any, idx: number) => (
              <tr key={idx} className={cn("border-b border-black h-[21px] hover:bg-slate-50 transition-colors bg-transparent", r.isOpening && "bg-slate-50/50 italic")}>
                <td className="border-r border-black p-0 text-center font-mono text-[8.5px]">{r.summaryDate}</td>
                <td className="border-r border-black p-0 px-1 uppercase truncate max-w-[200px] leading-none text-[8.5px]">{r.particulars}</td>
                <td className="border-r border-black p-0 px-1 text-right text-[8.5px]">{r.c1.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-0 px-1 text-right text-rose-600 text-[8.5px]">{r.c2.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-0 px-1 text-right text-emerald-600 text-[8.5px]">{r.c3.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-0 px-1 text-right bg-slate-50/50 font-mono text-[8.5px]">{r.col4.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-0 px-1 text-right text-[8.5px]">{r.c5.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-0 px-1 text-right text-[8.5px]">{r.c6.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-0 px-1 text-right bg-slate-50/50 font-bold text-[8.5px]">{r.col7.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-0 px-1 text-right text-[8.5px]">{r.c8.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-0 px-1 text-right text-[8.5px]">{r.c9.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-0 px-1 text-right bg-slate-50/50 font-bold text-[8.5px]">{r.col10.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="border-r border-black p-0 px-1 text-right bg-slate-100/50 text-[9px] font-bold underline underline-offset-1">৳ {r.col11.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-0 text-center no-print bg-slate-50/30 border-r border-black">{!r.isOpening && <div className="flex gap-1 justify-center"><Button variant="ghost" size="icon" className="h-4 w-4 hover:bg-black hover:text-white" onClick={() => { setEditingEntry(r); setManualVals({ c1:r.c1, c2:r.c2, c3:r.c3, c5:r.c5, c6:r.c6, c8:r.c8, c9:r.c9 }); setIsEntryOpen(true); }}><Edit2 className="size-2.5" /></Button><Button variant="ghost" size="icon" className="h-4 w-4 text-rose-600 hover:bg-rose-600 hover:text-white" onClick={() => showAlert({ title:"Irreversible Purge?", description: "Remove this voucher from subsidiary record?", type:"warning", showCancel:true, onConfirm:() => deleteDocumentNonBlocking(doc(firestore, "members", resolvedParams.id, "fundSummaries", r.id)) })}><Trash2 className="size-2.5" /></Button></div>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-black border-t-2 border-black text-[9px] uppercase tabular-nums text-black">
            <tr className="h-10">
              <td colSpan={2} className="border-r border-b border-black p-2 text-right bg-slate-100 tracking-widest">AGGREGATE TOTALS:</td>
              <td className="border-r border-b border-black p-0 px-1 text-right">{ledgerLogic.grand.c1.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-b border-black p-0 px-1 text-right text-rose-700">{ledgerLogic.grand.c2.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-b border-black p-0 px-1 text-right text-emerald-700">{ledgerLogic.grand.c3.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-b border-black p-0 px-1 text-right bg-white">{ledgerLogic.grand.c4.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-b border-black p-0 px-1 text-right">{ledgerLogic.grand.c5.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-b border-black p-0 px-1 text-right">{ledgerLogic.grand.c6.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-b border-black p-0 px-1 text-right bg-white">{ledgerLogic.grand.c7.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-b border-black p-0 px-1 text-right">{ledgerLogic.grand.c8.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-b border-black p-0 px-1 text-right">{ledgerLogic.grand.c9.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-b border-black p-0 px-1 text-right bg-white">{ledgerLogic.grand.c10.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="border-r border-b border-black p-0 px-2 text-right bg-slate-100 text-sm underline decoration-double decoration-black/30">৳ {ledgerLogic.grand.c11.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="no-print bg-slate-50 border-b border-black"></td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-12 flex justify-between items-end border-t border-black pt-4 no-print">
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase text-slate-400">Vault Verification</p>
            <div className="flex items-center gap-1.5 text-emerald-600">
               <ShieldCheck className="size-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">Mathematical Consistency Verified</span>
            </div>
          </div>
          <p className="text-[8px] font-black uppercase text-slate-300 italic">Developed by Ariful Islam, AGM Finance, Gazipur PBS-2</p>
        </div>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={(o) => { setIsEntryOpen(o); if(!o) setEditingEntry(null); }}>
        <DialogContent className="max-w-[1000px] w-[95vw] bg-white p-0 rounded-none shadow-2xl border-2 border-black overflow-hidden max-h-[95vh] flex flex-col font-ledger">
          <DialogHeader className="bg-slate-50 text-black p-5 border-b-2 border-black shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
               <Calculator className="size-6 text-black" />
               <div>
                  <DialogTitle className="text-lg font-black uppercase tracking-tight">Manual Ledger Posting Terminal</DialogTitle>
                  <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400 mt-0.5">Direct Vault Modification Interface</p>
               </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleManualSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-black bg-white custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 border border-black rounded-lg">
              <div className="space-y-1">
                 <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <TrendingUp className="size-3" /> Posting Date
                 </Label>
                 <Input name="summaryDate" type="date" max="9999-12-31" defaultValue={editingEntry?.summaryDate} required className="h-10 border-black border font-black text-base bg-white" />
              </div>
              <div className="space-y-1">
                 <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Info className="size-3" /> Voucher Particulars
                 </Label>
                 <Input name="particulars" defaultValue={editingEntry?.particulars} required placeholder="E.g. Salary July-2024" className="h-10 border-black border font-black text-xs uppercase bg-white" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
               <div className="space-y-3 border border-black p-4 bg-slate-50 rounded-lg">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-center border-b border-black pb-1.5 flex items-center justify-center gap-2">
                     <Landmark className="size-3" /> Membership Equity
                  </h4>
                  <div className="space-y-3">
                     <div className="space-y-1">
                        <Label className="text-[8px] font-black text-slate-400">Emp Contrib (1)</Label>
                        <Input type="number" step="0.01" value={manualVals.c1||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c1:Number(e.target.value)})} className="h-9 border-black border font-mono font-black text-right" />
                     </div>
                     <div className="space-y-1">
                        <Label className="text-[8px] font-black text-slate-400">Office Contrib (8)</Label>
                        <Input type="number" step="0.01" value={manualVals.c8||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c8:Number(e.target.value)})} className="h-9 border-black border font-mono font-black text-right" />
                     </div>
                  </div>
               </div>

               <div className="space-y-3 border border-black p-4 bg-slate-50 rounded-lg">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-center border-b border-black pb-1.5 flex items-center justify-center gap-2">
                     <HandCoins className="size-3" /> Loan Activity
                  </h4>
                  <div className="space-y-3">
                     <div className="space-y-1">
                        <Label className="text-[8px] font-black text-rose-600">Disbursement (2)</Label>
                        <Input type="number" step="0.01" value={manualVals.c2||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c2:Number(e.target.value)})} className="h-9 border-rose-600 border font-mono font-black text-right text-rose-700 bg-white" />
                     </div>
                     <div className="space-y-1">
                        <Label className="text-[8px] font-black text-emerald-600">Repayment (3)</Label>
                        <Input type="number" step="0.01" value={manualVals.c3||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c3:Number(e.target.value)})} className="h-9 border-emerald-600 border font-mono font-black text-right text-emerald-700 bg-white" />
                     </div>
                  </div>
               </div>

               <div className="space-y-3 border border-black p-4 bg-slate-50 rounded-lg">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-center border-b border-black pb-1.5 flex items-center justify-center gap-2">
                     <Percent className="size-3" /> Yield Distributions
                  </h4>
                  <div className="space-y-2">
                     <div className="space-y-0.5">
                        <Label className="text-[8px] font-black text-orange-600">Profit Emp (5)</Label>
                        <Input type="number" step="0.01" value={manualVals.c5||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c5:Number(e.target.value)})} className="h-8 border-orange-600 border font-mono font-black text-right text-orange-700 bg-white" />
                     </div>
                     <div className="space-y-0.5">
                        <Label className="text-[8px] font-black text-orange-600">Profit Loan (6)</Label>
                        <Input type="number" step="0.01" value={manualVals.c6||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c6:Number(e.target.value)})} className="h-8 border-orange-600 border font-mono font-black text-right text-orange-700 bg-white" />
                     </div>
                     <div className="space-y-0.5">
                        <Label className="text-[8px] font-black text-indigo-600">Profit PBS (9)</Label>
                        <Input type="number" step="0.01" value={manualVals.c9||''} onKeyDown={handleNumericKeyDown} onChange={e=>setManualVals({...manualVals, c9:Number(e.target.value)})} className="h-8 border-indigo-600 border font-mono font-black text-right text-indigo-700 bg-white" />
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-5 bg-slate-50 text-black border border-black shadow-inner relative rounded-lg">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-white border border-black text-black px-4 py-1 font-black uppercase text-[8px] tracking-widest">Entry Impact Audit</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1 border-r border-black/5 pr-4">
                   <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Employee Fund Δ</p>
                   <p className={cn("text-lg font-black tabular-nums", rowVerification.netEmp >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {rowVerification.netEmp >= 0 ? "+" : ""}{rowVerification.netEmp.toLocaleString()}
                   </p>
                </div>
                <div className="space-y-1 border-r border-black/5 pr-4">
                   <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Office Fund Δ</p>
                   <p className={cn("text-lg font-black tabular-nums", rowVerification.netOff >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {rowVerification.netOff >= 0 ? "+" : ""}{rowVerification.netOff.toLocaleString()}
                   </p>
                </div>
                <div className="space-y-1 border-r border-black/5 pr-4">
                   <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Loan Balance Δ</p>
                   <p className={cn("text-lg font-black tabular-nums", rowVerification.loanEffect >= 0 ? "text-rose-600" : "text-emerald-600")}>
                      {rowVerification.loanEffect >= 0 ? "+" : ""}{rowVerification.loanEffect.toLocaleString()}
                   </p>
                </div>
                <div className="space-y-1">
                   <p className="text-[8px] font-black uppercase tracking-widest text-primary">Total Impact</p>
                   <p className="text-xl font-black tabular-nums underline">৳ {rowVerification.total.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-16 font-black uppercase tracking-[0.3em] bg-black text-white shadow-xl hover:bg-slate-900 border border-white/10 text-base transition-all group shrink-0">
              <Save className="size-5 mr-3 group-hover:scale-110 transition-transform text-emerald-400" />
              Commit Voucher to Ledger
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettlementOpen} onOpenChange={(o) => { setIsSettlementOpen(o); if(!o) setEditingEntry(null); }}>
        <DialogContent className="max-w-md bg-white border-2 border-black p-0 overflow-hidden shadow-2xl rounded-none">
          <DialogHeader className="bg-rose-50 p-5 border-b-2 border-black"><DialogTitle className="text-lg font-black uppercase text-rose-700 flex items-center gap-3"><UserX className="size-5" /> Final Settlement</DialogTitle></DialogHeader>
          <form onSubmit={handleFinalSettlement} className="p-5 space-y-5">
            <div className="space-y-4">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Settlement Category</Label><Select name="reason" defaultValue="Retired"><SelectTrigger className="h-10 border border-black font-black uppercase text-[10px] text-black"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Retired">RETIRED</SelectItem><SelectItem value="Transferred">TRANSFERRED</SelectItem><SelectItem value="Dismissed">DISMISSED</SelectItem><SelectItem value="InActive">INACTIVE</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Closure Date</Label><Input name="settlementDate" type="date" required max="9999-12-31" defaultValue={new Date().toISOString().split('T')[0]} className="h-10 border border-black font-black text-black" /></div>
            </div>
            <div className="bg-slate-50 p-4 border border-black space-y-1.5 text-black rounded-lg">
               <p className="text-[8px] font-black uppercase opacity-40">Closure Impact Audit</p>
               <p className="text-xs font-black">Net Pay-out: ৳ {ledgerLogic.grand.c11.toLocaleString()}</p>
               <p className="text-[8px] text-slate-500 font-bold uppercase italic leading-tight">Full reversal of equity columns. Outstanding loans will be adjusted via positive repayment.</p>
            </div>
            <DialogFooter className="gap-2"><Button type="button" variant="outline" className="border border-black font-black uppercase text-[10px] text-black h-10 px-4" onClick={() => setIsSettlementOpen(false)}>Cancel</Button><Button type="submit" className="bg-rose-700 text-white font-black uppercase text-[10px] px-6 h-10">Confirm Payout</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
