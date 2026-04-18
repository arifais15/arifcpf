
"use client"

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2, Plus, ArrowRightLeft, Calculator, ShieldCheck, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { cn } from "@/lib/utils";
import { PageHeaderActions } from "@/components/header-actions";
import { Badge } from "@/components/ui/badge";

export default function MemberLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const firestore = useFirestore();
  const { showAlert } = useSweetAlert();
  
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [selectedFY, setSelectedFY] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // Manual Entry States for Real-time Calculation
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
    const curMonth = now.getMonth() + 1;
    const startYear = curMonth >= 7 ? curYear : curYear - 1;
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
    if (!summaries) return { rows: [], grand: { c1:0, c2:0, c3:0, c5:0, c6:0, c8:0, c9:0, c4:0, c7:0, c10:0, c11:0 } };
    const sorted = [...summaries].sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime());
    let rL = 0, rE = 0, rO = 0;
    
    // Column wise sum variables
    let sC1=0, sC2=0, sC3=0, sC5=0, sC6=0, sC8=0, sC9=0;

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
      
      sC1 += v.c1; sC2 += v.c2; sC3 += v.c3; sC5 += v.c5; sC6 += v.c6; sC8 += v.c8; sC9 += v.c9;
      
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
    if (pre.length > 0) {
      rows = [{ 
        summaryDate: dateRange.start, 
        particulars: "Opening Balance Brought Forward", 
        ...pSums, 
        col4:lastP.col4, col7:lastP.col7, col10:lastP.col10, col11:lastP.col11, 
        isOpening: true 
      }, ...inR];
    }

    const last = allC[allC.length-1] || { col4:0, col7:0, col10:0, col11:0 };
    
    return { 
      rows, 
      grand: { 
        c1:sC1, c2:sC2, c3:sC3, c5:sC5, c6:sC6, c8:sC8, c9:sC9, 
        c4:last.col4, c7:last.col7, c10:last.col10, c11:last.col11 
      } 
    };
  }, [summaries, dateRange]);

  const rowVerification = useMemo(() => {
    const netEmp = manualVals.c1 - manualVals.c2 + manualVals.c3 + manualVals.c5 + manualVals.c6;
    const netOff = manualVals.c8 + manualVals.c9;
    const total = netEmp + netOff;
    const loanEffect = manualVals.c2 - manualVals.c3;
    return { netEmp, netOff, total, loanEffect };
  }, [manualVals]);

  const updateManualVal = (key: string, val: string) => {
    setManualVals(prev => ({ ...prev, [key]: Number(val) || 0 }));
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
      createdAt: new Date().toISOString() 
    }; 
    addDocumentNonBlocking(summariesRef, d); 
    setIsEntryOpen(false); 
    setManualVals({ c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0 });
    showAlert({ title: "Ledger Synchronized", type: "success" });
  };

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-12 text-primary" /></div>;

  return (
    <div className="p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-[#000000]">
      <PageHeaderActions>
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
          <Button variant="outline" onClick={() => setIsEntryOpen(true)} className="h-10 border-black font-black uppercase text-[10px] text-black"><Plus className="size-4 mr-2" /> Manual Sync</Button>
          <Button onClick={() => window.print()} className="h-10 bg-black text-white font-black uppercase text-[10px] px-8"><Printer className="size-4 mr-2" /> Print Ledger</Button>
        </div>
      </PageHeaderActions>

      <div className="bg-white p-12 shadow-2xl border-2 border-black max-w-[1400px] mx-auto w-full print-container text-black">
        <div className="text-center border-b-2 border-black pb-4 mb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <h2 className="text-xl font-black uppercase tracking-[0.3em] mt-3">Provident Fund Subsidiary Ledger</h2>
          <p className="text-[10px] font-black uppercase tracking-widest mt-2 opacity-60">Report Basis: {dateRange.start} to {dateRange.end}</p>
        </div>

        <div className="grid grid-cols-3 gap-x-8 gap-y-4 mb-8 text-[11px] font-black border-b-2 border-black pb-6">
          <div className="flex gap-2"><span>NAME:</span><span className="uppercase">{member?.name}</span></div>
          <div className="flex gap-2"><span>DESIGNATION:</span><span className="uppercase">{member?.designation}</span></div>
          <div className="flex gap-2"><span>ID NO:</span><span className="font-mono">{member?.memberIdNumber}</span></div>
          <div className="flex gap-2"><span>DATE JOINED:</span><span>{member?.dateJoined}</span></div>
          <div className="flex gap-2"><span>STATUS:</span><span className="uppercase">{member?.status || "Active"}</span></div>
          <div className="flex gap-2"><span>OFFICE:</span><span className="uppercase">{member?.zonalOffice || "HO"}</span></div>
        </div>

        <table className="w-full text-[9px] border-collapse border-2 border-black font-black tabular-nums">
          <thead className="bg-slate-50 border-b-2 border-black uppercase text-[8px] text-black">
            <tr className="h-10">
              <th rowSpan={2} className="border border-black p-1 w-[70px]">Date</th>
              <th rowSpan={2} className="border border-black p-1">Particulars</th>
              <th className="border border-black p-1">Emp Contrib(1)</th>
              <th className="border border-black p-1">Loan Draw(2)</th>
              <th className="border border-black p-1">Loan Repay(3)</th>
              <th className="border border-black p-1 bg-slate-200">Loan Bal(4)</th>
              <th className="border border-black p-1">Profit Emp(5)</th>
              <th className="border border-black p-1">Profit Loan(6)</th>
              <th className="border border-black p-1 bg-slate-200">Net Emp(7)</th>
              <th className="border border-black p-1">PBS Contrib(8)</th>
              <th className="border border-black p-1">Profit PBS(9)</th>
              <th className="border border-black p-1 bg-slate-200">Net Off(10)</th>
              <th className="border border-black p-1 bg-black text-white">Total(11)</th>
            </tr>
          </thead>
          <tbody className="text-black">
            {ledgerLogic.rows.map((r: any, idx: number) => (
              <tr key={idx} className={cn("border-b border-black h-8", r.isOpening && "bg-slate-50 italic")}>
                <td className="border border-black p-1 text-center font-mono">{r.summaryDate}</td>
                <td className="border border-black p-1 uppercase truncate">{r.particulars}</td>
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
              </tr>
            ))}
            <tr className="bg-slate-100 font-black h-12 border-t-4 border-black uppercase text-[8px] text-black">
              <td colSpan={2} className="border border-black p-2 text-right">Aggregate Column-wise Sums:</td>
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
              <td className="border border-black p-1 text-right bg-black text-white text-sm">৳ {ledgerLogic.grand.c11.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        
        <div className="mt-20 pt-8 border-t-2 border-black flex justify-between items-center text-[10px] font-black uppercase tracking-widest no-print">
          <div className="flex items-center gap-2"><ShieldCheck className="size-4" /><span>System Synchronized v1.0</span></div>
          <span>Institutional Trust Registry</span>
        </div>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-4xl bg-white p-0 rounded-2xl shadow-2xl overflow-hidden border-4 border-black">
          <DialogHeader className="bg-slate-50 p-8 border-b-4 border-black">
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-3 text-black">
              <Calculator className="size-8 text-black" /> Voucher Entry terminal
            </DialogTitle>
            <DialogDescription className="text-xs font-black uppercase opacity-60 text-black">Personnel Ledger Manual Synchronization</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManualSubmit} className="p-8 space-y-8 text-black">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Posting Date</Label><Input name="summaryDate" type="date" max="9999-12-31" required className="h-11 border-black border-2 font-black text-black" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Voucher Particulars</Label><Input name="particulars" placeholder="e.g. Monthly Salary Sync" required className="h-11 border-black border-2 font-black text-black" /></div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 bg-slate-50 p-8 rounded-2xl border-2 border-black">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase underline tracking-widest">Contributions</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase font-bold">Col 1: Emp Contribution</Label>
                    <Input name="c1" type="number" step="0.01" value={manualVals.c1} onChange={(e) => updateManualVal('c1', e.target.value)} className="w-32 border-black border-2 text-right font-black text-black" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase font-bold">Col 8: PBS Contribution</Label>
                    <Input name="c8" type="number" step="0.01" value={manualVals.c8} onChange={(e) => updateManualVal('c8', e.target.value)} className="w-32 border-black border-2 text-right font-black text-black" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase underline tracking-widest text-rose-600">Loan Activity</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase font-bold text-rose-600">Col 2: Loan Disbursement</Label>
                    <Input name="c2" type="number" step="0.01" value={manualVals.c2} onChange={(e) => updateManualVal('c2', e.target.value)} className="w-32 border-rose-600 border-2 text-right font-black text-rose-600" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase font-bold text-emerald-600">Col 3: Loan Repayment</Label>
                    <Input name="c3" type="number" step="0.01" value={manualVals.c3} onChange={(e) => updateManualVal('c3', e.target.value)} className="w-32 border-emerald-600 border-2 text-right font-black text-emerald-600" />
                  </div>
                </div>
              </div>
              <div className="col-span-2 space-y-4 pt-4 border-t-2 border-black/10">
                <h3 className="text-xs font-black uppercase underline tracking-widest">Interest Accruals</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold">Col 5: Profit Employee</Label>
                    <Input name="c5" type="number" step="0.01" value={manualVals.c5} onChange={(e) => updateManualVal('c5', e.target.value)} className="border-black border-2 text-right font-black text-black" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold">Col 9: Profit PBS</Label>
                    <Input name="c9" type="number" step="0.01" value={manualVals.c9} onChange={(e) => updateManualVal('c9', e.target.value)} className="border-black border-2 text-right font-black text-black" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase font-bold">Col 6: Profit Loan</Label>
                    <Input name="c6" type="number" step="0.01" value={manualVals.c6} onChange={(e) => updateManualVal('c6', e.target.value)} className="border-black border-2 text-right font-black text-black" />
                  </div>
                </div>
              </div>
            </div>

            {/* REAL-TIME ROW VERIFICATION MATRIX */}
            <div className="p-6 bg-black text-white rounded-2xl flex flex-col gap-4">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 text-center border-b border-white/20 pb-2">Row Net Impact Verification</p>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-[8px] uppercase font-black opacity-50">Emp Fund Effect</p>
                  <p className="text-lg font-black tabular-nums">{rowVerification.netEmp.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] uppercase font-black opacity-50">Office Fund Effect</p>
                  <p className="text-lg font-black tabular-nums">{rowVerification.netOff.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] uppercase font-black opacity-50">Loan Bal Effect</p>
                  <p className={cn("text-lg font-black tabular-nums", rowVerification.loanEffect > 0 ? "text-rose-400" : rowVerification.loanEffect < 0 ? "text-emerald-400" : "")}>{rowVerification.loanEffect.toLocaleString()}</p>
                </div>
                <div className="space-y-1 bg-white/10 rounded-xl p-2">
                  <p className="text-[8px] uppercase font-black text-white/80">TOTAL FUND GROWTH</p>
                  <p className="text-xl font-black text-emerald-400">৳ {rowVerification.total.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-14 font-black uppercase tracking-[0.4em] shadow-2xl bg-black text-white hover:bg-black/90">Commit to Ledger</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

