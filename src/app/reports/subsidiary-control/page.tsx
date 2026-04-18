"use client"

import React, { useMemo, useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Printer, 
  Loader2, 
  ArrowRightLeft,
  LayoutList,
  User,
  History,
  ShieldCheck
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function SubsidiaryControlLedgerPage() {
  const firestore = useFirestore();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [viewMode, setViewMode] = useState<"institutional">("institutional");
  const [viewingDayDetails, setViewingDayDetails] = useState<any | null>(null);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setDateRange({ start: fyStart, end: today });
  }, []);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members } = useCollection(membersRef);

  const memberMap = useMemo(() => {
    const map: Record<string, any> = {};
    members?.forEach(m => {
      map[m.id] = m;
    });
    return map;
  }, [members]);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading } = useCollection(summariesRef);

  const ledgerResult = useMemo(() => {
    if (!allSummaries || !dateRange.start) return { rows: [], opening: 0, closing: 0 };
    
    const startDate = new Date(`${dateRange.start}T00:00:00`).getTime();
    const endDate = new Date(`${dateRange.end}T23:59:59`).getTime();

    // 1. Calculate Opening Balance from all member summaries before period
    let openingBalance = 0;
    const grouped: Record<string, any> = {};
    
    allSummaries.forEach(s => {
      const c1 = Number(s.employeeContribution) || 0;
      const c2 = Number(s.loanWithdrawal) || 0;
      const c3 = Number(s.loanRepayment) || 0;
      const c5 = Number(s.profitEmployee) || 0;
      const c6 = Number(s.profitLoan) || 0;
      const c8 = Number(s.pbsContribution) || 0;
      const c9 = Number(s.profitPbs) || 0;
      
      const netEffect = (c1 + c3 + c5 + c6 + c8 + c9) - c2;
      const timestamp = new Date(s.summaryDate).getTime();

      if (timestamp < startDate) {
        openingBalance += netEffect;
      } else if (timestamp <= endDate) {
        const date = s.summaryDate;
        if (!grouped[date]) {
          grouped[date] = { 
            date, 
            debit: 0, 
            credit: 0, 
            timestamp, 
            count: 0,
            entries: []
          };
        }
        if (netEffect > 0) grouped[date].credit += netEffect; 
        else grouped[date].debit += Math.abs(netEffect);
        
        grouped[date].count++;
        grouped[date].entries.push({ ...s, netEffect });
      }
    });

    const sortedPeriod = Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);
    
    let currentBalance = openingBalance;
    const rows = sortedPeriod.map((item: any) => { 
      currentBalance += (item.credit - item.debit); 
      return { 
        ...item, 
        particulars: `Consolidated Daily Activity (${item.count} Personnel)`, 
        balance: currentBalance 
      }; 
    });

    return { rows, opening: openingBalance, closing: currentBalance };
  }, [allSummaries, dateRange]);

  const StandardFooter = () => (
    <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
      <span>CPF Management Software</span>
      <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
    </div>
  );

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-[#000000]">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape !important; margin: 5mm !important; }
          .print-container { width: 100% !important; display: block !important; }
          table { table-layout: fixed !important; width: 100% !important; }
          body { background-color: white !important; color: #000000 !important; }
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl shadow-lg">
            <LayoutList className="size-8 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Subsidiary Control</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Consolidated Trust Audit • Period Reconciliation</p>
          </div>
        </div>
        <Button onClick={() => window.print()} className="gap-2 h-10 font-black bg-black text-white shadow-xl uppercase tracking-widest text-xs px-8">
          <Printer className="size-4" /> Print Control Ledger
        </Button>
      </div>

      <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 no-print">
        <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full sm:w-auto">
          <TabsList className="bg-slate-100 p-1 h-11 border-4 border-black">
            <TabsTrigger value="institutional" className="font-black data-[state=active]:bg-black data-[state=active]:text-white px-8 uppercase text-xs">Institutional Aggregate</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border-2 border-black">
          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black text-center">Ledger Start</Label>
              <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-2 border-black font-black text-black bg-white" />
            </div>
            <ArrowRightLeft className="size-3 text-black opacity-30 mt-4" />
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black text-center">Ledger End</Label>
              <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-2 border-black font-black text-black bg-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print animate-in fade-in duration-500">
        <div className="p-4 bg-slate-100 border-b-4 border-black flex items-center justify-between">
          <h2 className="text-sm font-black flex items-center gap-3 uppercase tracking-widest">
            <ShieldCheck className="size-5" /> Verified Subsidiary Reconciliation Matrix
          </h2>
          <div className="flex gap-4">
            <Badge variant="outline" className="bg-white border-black font-black uppercase text-[10px]">Opening Basis: ৳{ledgerResult.opening.toLocaleString()}</Badge>
            <Badge className="bg-black text-white font-black uppercase text-[10px]">Institutional Net: ৳{ledgerResult.closing.toLocaleString()}</Badge>
          </div>
        </div>
        <Table className="text-black font-black tabular-nums">
          <TableHeader>
            <TableRow className="bg-slate-50 border-b-2 border-black">
              <TableHead className="font-black text-black uppercase text-[10px] tracking-widest py-5 pl-6">Posting Date</TableHead>
              <TableHead className="font-black text-black uppercase text-[10px] tracking-widest py-5">Consolidated Activity Details</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5">Debit (৳)</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5">Credit (৳)</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5 bg-slate-100 pr-6">Running Balance (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-slate-50/50 italic border-b-2 border-black h-12">
              <td className="p-4 pl-6 font-mono text-xs text-slate-500">{dateRange.start}</td>
              <td className="p-4 uppercase text-[11px] font-black tracking-widest">Opening Balance Brought Forward</td>
              <td className="text-right p-4">—</td>
              <td className="text-right p-4">—</td>
              <td className="text-right p-4 pr-6 font-black bg-slate-100/50">৳ {ledgerResult.opening.toLocaleString()}</td>
            </TableRow>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : ledgerResult.rows.map((item: any, idx: number) => (
              <TableRow key={idx} className="hover:bg-slate-50 border-b border-black transition-colors">
                <td className="font-mono text-xs p-5 pl-6">{item.date}</td>
                <td className="p-5 text-[11px] uppercase opacity-70 font-black">{item.particulars}</td>
                <td className="text-right p-5 text-base cursor-pointer hover:bg-rose-50 font-black text-rose-600" onClick={() => item.debit > 0 && setViewingDayDetails(item)}>
                  {item.debit > 0 ? item.debit.toLocaleString() : "—"}
                </td>
                <td className="text-right p-5 text-base cursor-pointer hover:bg-emerald-50 font-black text-emerald-600" onClick={() => item.credit > 0 && setViewingDayDetails(item)}>
                  {item.credit > 0 ? item.credit.toLocaleString() : "—"}
                </td>
                <td className="text-right p-5 bg-slate-50 font-black text-lg pr-6 underline decoration-black">৳ {item.balance.toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-slate-900 text-white font-black">
            <TableRow className="h-20">
              <TableCell colSpan={2} className="text-right uppercase tracking-[0.3em] text-sm pr-10">Period Closing Totals:</TableCell>
              <TableCell className="text-right text-lg border-l border-white/10 tabular-nums">{ledgerResult.rows.reduce((s, r) => s + r.debit, 0).toLocaleString()}</TableCell>
              <TableCell className="text-right text-lg border-l border-white/10 tabular-nums">{ledgerResult.rows.reduce((s, r) => s + r.credit, 0).toLocaleString()}</TableCell>
              <TableCell className="text-right text-2xl underline decoration-double bg-white text-black border-l border-white/10 pr-6 tabular-nums">৳ {ledgerResult.closing.toLocaleString()}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <Dialog open={!!viewingDayDetails} onOpenChange={(open) => !open && setViewingDayDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto font-ledger text-black border-4 border-black p-0 rounded-none shadow-2xl">
          <DialogHeader className="p-8 border-b-4 border-black bg-slate-50">
            <DialogTitle className="flex items-center gap-4 text-3xl font-black uppercase tracking-tight">
              <History className="size-10 text-black" /> Source Personnel Trace
            </DialogTitle>
            <DialogDescription className="font-mono text-sm font-black text-slate-500 mt-2 uppercase tracking-widest">Audit Date: {viewingDayDetails?.date}</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-8">
            <div className="border-2 border-black overflow-hidden shadow-xl">
              <Table className="font-black text-black tabular-nums">
                <TableHeader className="bg-slate-100 border-b-2 border-black">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-4 pl-6">ID & Personnel Name</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">Transaction Memo</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest py-4">Debit (৳)</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest py-4 pr-6">Credit (৳)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingDayDetails?.entries.map((entry: any, i: number) => {
                    const member = memberMap[entry.memberId];
                    return (
                      <TableRow key={i} className="hover:bg-slate-50 border-b border-black">
                        <td className="p-4 pl-6">
                          <div className="flex flex-col"><span className="font-mono text-xs">{member?.memberIdNumber || "N/A"}</span><span className="text-[10px] uppercase opacity-60">{member?.name || "N/A"}</span></div>
                        </td>
                        <td className="p-4 text-[10px] uppercase truncate max-w-[250px]">{entry.particulars}</td>
                        <td className="text-right p-4 text-rose-600">{entry.netEffect < 0 ? Math.abs(entry.netEffect).toLocaleString() : "—"}</td>
                        <td className="text-right p-4 pr-6 text-emerald-600">{entry.netEffect > 0 ? entry.netEffect.toLocaleString() : "—"}</td>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden print:block print-container font-ledger text-[#000000]">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.4em] mt-4">Subsidiary Control Ledger Audit Statement</h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <span className="bg-black text-white px-4 py-1 rounded">Period: {dateRange.start} TO {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse border-2 border-black text-[#000000] font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-black">
              <th className="border border-black p-2.5 uppercase text-center w-[100px]">Posting Date</th>
              <th className="border border-black p-2.5 text-left uppercase">Consolidated Activity particulars</th>
              <th className="border border-black p-2.5 text-right uppercase w-[120px]">Debit</th>
              <th className="border border-black p-2.5 text-right uppercase w-[120px]">Credit</th>
              <th className="border border-black p-2.5 text-right uppercase w-[150px] bg-slate-100">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="italic h-10">
              <td className="border border-black p-2 text-center">{dateRange.start}</td>
              <td className="border border-black p-2 uppercase">Opening Balance Brought Forward</td>
              <td className="border border-black p-2 text-right">—</td>
              <td className="border border-black p-2 text-right">—</td>
              <td className="border border-black p-2 text-right">৳ {ledgerResult.opening.toLocaleString()}</td>
            </tr>
            {ledgerResult.rows.map((item: any, idx: number) => (
              <tr key={idx} className="h-10">
                <td className="border border-black p-2 text-center font-mono">{item.date}</td>
                <td className="border border-black p-2 uppercase text-[9px]">{item.particulars}</td>
                <td className="border border-black p-2 text-right">{item.debit > 0 ? item.debit.toLocaleString() : "—"}</td>
                <td className="border border-black p-2 text-right">{item.credit > 0 ? item.credit.toLocaleString() : "—"}</td>
                <td className="border border-black p-2 text-right font-black bg-slate-50">৳ {item.balance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black h-16 border-t-2 border-black">
              <td colSpan={2} className="border border-black p-2.5 text-right uppercase tracking-[0.2em]">Institutional Totals:</td>
              <td className="border border-black p-2.5 text-right">{ledgerResult.rows.reduce((s, r) => s + r.debit, 0).toLocaleString()}</td>
              <td className="border border-black p-2.5 text-right">{ledgerResult.rows.reduce((s, r) => s + r.credit, 0).toLocaleString()}</td>
              <td className="border border-black p-2.5 text-right text-lg underline decoration-double">৳ {ledgerResult.closing.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center text-[#000000] uppercase tracking-widest">
          <div className="border-t-2 border-black pt-4">Prepared by</div>
          <div className="border-t-2 border-black pt-4">Checked by</div>
          <div className="border-t-2 border-black pt-4">Approved By Trustee</div>
        </div>
        <StandardFooter />
      </div>
    </div>
  );
}