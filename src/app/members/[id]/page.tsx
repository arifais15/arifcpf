"use client"

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2, Plus, ArrowRightLeft, Calculator, ShieldCheck } from "lucide-react";
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

export default function MemberLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const firestore = useFirestore();
  const { showAlert } = useSweetAlert();
  
  const [isEntryOpen, setIsEntryOpen] = useState(false);
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
    const allC = sorted.map(row => {
      const v = { c1:Number(row.employeeContribution)||0, c2:Number(row.loanWithdrawal)||0, c3:Number(row.loanRepayment)||0, c5:Number(row.profitEmployee)||0, c6:Number(row.profitLoan)||0, c8:Number(row.pbsContribution)||0, c9:Number(row.profitPbs)||0 };
      rL += (v.c2 - v.c3); rE += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6); rO += (v.c8 + v.c9);
      return { ...row, ...v, col4:rL, col7:rE, col10:rO, col11:rE+rO };
    });
    const s = new Date(dateRange.start).getTime();
    const e = new Date(dateRange.end).getTime();
    const pre = allC.filter(r => new Date(r.summaryDate).getTime() < s);
    const inR = allC.filter(r => { const t = new Date(r.summaryDate).getTime(); return t >= s && t <= e; });
    const pSums = pre.reduce((acc, r) => ({ c1:acc.c1+r.c1, c2:acc.c2+r.c2, c3:acc.c3+r.c3, c5:acc.c5+r.c5, c6:acc.c6+r.c6, c8:acc.c8+r.c8, c9:acc.c9+r.c9 }), { c1:0,c2:0,c3:0,c5:0,c6:0,c8:0,c9:0 });
    const lastP = pre[pre.length-1] || { col4:0, col7:0, col10:0, col11:0 };
    let rows = inR;
    if (pre.length > 0) rows = [{ summaryDate: dateRange.start, particulars: "Opening Balance", ...pSums, col4:lastP.col4, col7:lastP.col7, col10:lastP.col10, col11:lastP.col11, isOpening: true }, ...inR];
    const last = allC[allC.length-1] || { col4:0, col7:0, col10:0, col11:0 };
    const grand = allC.reduce((acc, r) => ({ c1:acc.c1+r.c1, c2:acc.c2+r.c2, c3:acc.c3+r.c3, c4:0, c5:acc.c5+r.c5, c6:acc.c6+r.c6, c7:0, c8:acc.c8+r.c8, c9:acc.c9+r.c9, c10:0, c11:0 }), { c1:0,c2:0,c3:0,c4:0,c5:0,c6:0,c7:0,c8:0,c9:0,c10:0,c11:0 });
    return { rows, grand: { ...grand, c4:last.col4, c7:last.col7, c10:last.col10, c11:last.col11 } };
  }, [summaries, dateRange]);

  if (isMemberLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-12 text-primary" /></div>;

  return (
    <div className="p-8 flex flex-col gap-6 bg-white min-h-screen font-ledger text-[#000000]">
      <PageHeaderActions>
        <Link href="/members" className="p-2 hover:bg-slate-100 rounded-full border border-black no-print"><ArrowLeft className="size-5" /></Link>
        <div className="flex items-center gap-3 bg-slate-50 p-2 border border-black rounded-xl no-print">
          <Select value={selectedFY} onValueChange={(fy) => { setSelectedFY(fy); if(fy==="all") setDateRange({start:"2010-01-01", end:new Date().toISOString().split('T')[0]}); else { const s = parseInt(fy.split("-")[0]); setDateRange({start:`${s}-07-01`, end:`${s+1}-06-30`}); } }}>
            <SelectTrigger className="h-8 w-[100px] font-black text-[10px] uppercase border-black"><SelectValue /></SelectTrigger>
            <SelectContent>{availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}<SelectItem value="all" className="font-black text-xs">ALL</SelectItem></SelectContent>
          </Select>
          <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start:e.target.value})} className="h-8 w-32 border-black text-[10px] font-black" />
          <ArrowRightLeft className="size-3 opacity-30" />
          <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end:e.target.value})} className="h-8 w-32 border-black text-[10px] font-black" />
        </div>
        <div className="flex gap-2 ml-auto no-print">
          <Button variant="outline" onClick={() => setIsEntryOpen(true)} className="h-10 border-black font-black uppercase text-[10px]"><Plus className="size-4 mr-2" /> Manual Sync</Button>
          <Button onClick={() => window.print()} className="h-10 bg-black text-white font-black uppercase text-[10px] px-8"><Printer className="size-4 mr-2" /> Print</Button>
        </div>
      </PageHeaderActions>

      <div className="bg-white p-12 shadow-2xl border-2 border-black max-w-[1400px] mx-auto w-full print-container">
        <div className="text-center border-b-2 border-black pb-4 mb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <h2 className="text-xl font-black uppercase tracking-[0.3em] mt-3">Provident Fund Subsidiary Ledger</h2>
        </div>

        <div className="grid grid-cols-3 gap-y-4 mb-8 text-[11px] font-black border-b-2 border-black pb-6">
          <div className="flex gap-2"><span>NAME:</span><span className="uppercase">{member?.name}</span></div>
          <div className="flex gap-2"><span>DESIGNATION:</span><span className="uppercase">{member?.designation}</span></div>
          <div className="flex gap-2"><span>ID NO:</span><span className="font-mono">{member?.memberIdNumber}</span></div>
          <div className="flex gap-2"><span>DATE JOINED:</span><span>{member?.dateJoined}</span></div>
          <div className="flex gap-2"><span>STATUS:</span><span className="uppercase">{member?.status || "Active"}</span></div>
          <div className="flex gap-2"><span>OFFICE:</span><span className="uppercase">{member?.zonalOffice || "HO"}</span></div>
        </div>

        <table className="w-full text-[9px] border-collapse border-2 border-black font-black tabular-nums">
          <thead className="bg-slate-50 border-b-2 border-black uppercase text-[8px]">
            <tr className="h-8">
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
          <tbody>
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
            <tr className="bg-slate-100 font-black h-10 border-t-2 border-black uppercase text-[8px]">
              <td colSpan={2} className="border border-black p-2 text-right">Aggregate All-Time Sums:</td>
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
              <td className="border border-black p-1 text-right bg-black text-white">৳ {ledgerLogic.grand.c11.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-4xl bg-white p-0 rounded-2xl shadow-2xl overflow-hidden">
          <DialogHeader className="bg-slate-50 p-8 border-b">
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-3">
              <Calculator className="size-6 text-primary" /> Voucher Entry terminal
            </DialogTitle>
            <DialogDescription className="text-xs font-black uppercase opacity-60">Manual synchronization of personnel records</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { 
              e.preventDefault(); const f = new FormData(e.currentTarget); 
              const d = { summaryDate: f.get("summaryDate"), particulars: f.get("particulars"), employeeContribution: Number(f.get("c1")), loanWithdrawal: Number(f.get("c2")), loanRepayment: Number(f.get("c3")), profitEmployee: Number(f.get("c5")), profitLoan: Number(f.get("c6")), pbsContribution: Number(f.get("c8")), profitPbs: Number(f.get("c9")), memberId: resolvedParams.id, createdAt: new Date().toISOString() }; 
              addDocumentNonBlocking(summariesRef, d); setIsEntryOpen(false); showAlert({ title: "Ledger Synced", type: "success" });
          }} className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Posting Date</Label><Input name="summaryDate" type="date" max="9999-12-31" required className="h-11 border-slate-200 font-black" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Voucher Particulars</Label><Input name="particulars" placeholder="e.g. Monthly Salary Sync" required className="h-11 border-slate-200 font-black" /></div>
            </div>
            <div className="grid grid-cols-2 gap-8 bg-slate-50 p-8 rounded-2xl border">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase underline tracking-widest">Contributions</h3>
                <div className="space-y-4"><div className="flex items-center justify-between"><Label className="text-[10px] uppercase">Col 1: Emp Contribution</Label><Input name="c1" type="number" step="0.01" defaultValue={0} className="w-32 border-slate-200 text-right font-black" /></div><div className="flex items-center justify-between"><Label className="text-[10px] uppercase">Col 8: PBS Contribution</Label><Input name="c8" type="number" step="0.01" defaultValue={0} className="w-32 border-slate-200 text-right font-black" /></div></div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase underline tracking-widest text-rose-600">Loan Activity</h3>
                <div className="space-y-4"><div className="flex items-center justify-between"><Label className="text-[10px] uppercase">Col 2: Loan Drawal</Label><Input name="c2" type="number" step="0.01" defaultValue={0} className="w-32 border-rose-200 text-right font-black text-rose-600" /></div><div className="flex items-center justify-between"><Label className="text-[10px] uppercase">Col 3: Loan Repay</Label><Input name="c3" type="number" step="0.01" defaultValue={0} className="w-32 border-emerald-200 text-right font-black text-emerald-600" /></div></div>
              </div>
              <div className="col-span-2 space-y-4 pt-4 border-t">
                <h3 className="text-xs font-black uppercase underline tracking-widest">Interest Accruals</h3>
                <div className="grid grid-cols-3 gap-4"><div className="space-y-1"><Label className="text-[9px] uppercase">Col 5: Profit Emp</Label><Input name="c5" type="number" step="0.01" defaultValue={0} className="border-slate-200 text-right font-black" /></div><div className="space-y-1"><Label className="text-[9px] uppercase">Col 9: Profit PBS</Label><Input name="c9" type="number" step="0.01" defaultValue={0} className="border-slate-200 text-right font-black" /></div><div className="space-y-1"><Label className="text-[9px] uppercase">Col 6: Profit Loan</Label><Input name="c6" type="number" step="0.01" defaultValue={0} className="border-slate-200 text-right font-black" /></div></div>
              </div>
            </div>
            <Button type="submit" className="w-full h-14 font-black uppercase tracking-[0.2em] shadow-xl">Commit to Ledger</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
