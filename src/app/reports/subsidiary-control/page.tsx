
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
  FileSpreadsheet, 
  Printer, 
  Loader2, 
  ArrowRightLeft,
  LayoutList,
  User,
  Tags,
  CalendarDays,
  BookOpenCheck,
  Info,
  History,
  ShieldCheck,
  Search
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

const SUBSIDIARY_COLUMNS = [
  { key: 'employeeContribution', label: 'Col 1: Employee Contribution' },
  { key: 'loanWithdrawal', label: 'Col 2: Loan Withdrawal' },
  { key: 'loanRepayment', label: 'Col 3: Loan Repayment' },
  { key: 'profitEmployee', label: 'Col 5: Profit on Employee Cont.' },
  { key: 'profitLoan', label: 'Col 6: Profit on Loan' },
  { key: 'pbsContribution', label: 'Col 8: PBS Contribution' },
  { key: 'profitPbs', label: 'Col 9: Profit on PBS Cont.' },
];

export default function SubsidiaryControlLedgerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
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

  const institutionalLedger = useMemo(() => {
    if (!allSummaries || !dateRange.start) return [];
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
      if (Math.abs(netEffect) < 0.01) return;
      
      const date = s.summaryDate;
      if (!grouped[date]) {
        grouped[date] = { 
          date, 
          debit: 0, 
          credit: 0, 
          timestamp: new Date(date).getTime(), 
          count: 0,
          entries: []
        };
      }
      
      if (netEffect > 0) grouped[date].credit += netEffect; 
      else grouped[date].debit += Math.abs(netEffect);
      
      grouped[date].count++;
      grouped[date].entries.push({
        ...s,
        netEffect
      });
    });

    const sorted = Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);
    
    let processed = sorted;
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      processed = sorted.filter((i: any) => i.timestamp >= s && i.timestamp <= e);
    }

    let runningBalance = 0;
    return processed.map((item: any) => { 
      runningBalance += (item.credit - item.debit); 
      return { 
        ...item, 
        particulars: `Consolidated Daily Activity (${item.count} Personnel)`, 
        balance: runningBalance 
      }; 
    });
  }, [allSummaries, dateRange]);

  const StandardFooter = () => (
    <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
      <span>CPF Management Software</span>
      <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
    </div>
  );

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl shadow-lg">
            <LayoutList className="size-8 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Subsidiary Control</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Consolidated audit trail of member fund activities</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="gap-2 h-10 font-black bg-black text-white shadow-lg uppercase tracking-widest text-xs">
            <Printer className="size-4" /> Print Control Ledger
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border-2 border-black shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 no-print mb-2">
        <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full sm:w-auto">
          <TabsList className="bg-slate-100 p-1 h-11 border-black border-2">
            <TabsTrigger value="institutional" className="font-black data-[state=active]:bg-black data-[state=active]:text-white px-8 uppercase text-xs">Institutional Ledger</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border-2 border-black/10">
          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-slate-400 ml-1">Ledger Start</Label>
              <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-black border-2 font-black text-black bg-white" />
            </div>
            <ArrowRightLeft className="size-3 text-black opacity-30 mt-4" />
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-slate-400 ml-1">Ledger End</Label>
              <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-black border-2 font-black text-black bg-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print animate-in fade-in duration-500">
        <div className="p-4 bg-slate-100 border-b-4 border-black flex items-center justify-between">
          <h2 className="text-sm font-black flex items-center gap-3 uppercase tracking-widest">
            <ShieldCheck className="size-5" /> Verified Institutional Subsidiary Control
          </h2>
          <Badge className="bg-black text-white font-black px-4 py-1 uppercase text-[10px] tracking-widest">
            Basis: {dateRange.start} to {dateRange.end}
          </Badge>
        </div>
        <Table className="text-black font-black tabular-nums">
          <TableHeader className="bg-slate-50 border-b-2 border-black">
            <TableRow>
              <TableHead className="font-black text-black uppercase text-[10px] tracking-widest py-5 pl-6">Posting Date</TableHead>
              <TableHead className="font-black text-black uppercase text-[10px] tracking-widest py-5">Consolidated Particulars</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5">Debit (৳)</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5">Credit (৳)</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5 bg-slate-100 pr-6">Running Balance (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : institutionalLedger.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-black text-lg uppercase italic">No ledger activity recorded in this range</TableCell></TableRow>
            ) : institutionalLedger.map((item: any, idx: number) => (
              <TableRow key={idx} className="hover:bg-slate-50 border-b border-black transition-colors">
                <td className="font-mono text-xs p-5 pl-6">{item.date}</td>
                <td className="p-5 text-[11px] uppercase opacity-70">{item.particulars}</td>
                <td 
                  className={cn(
                    "text-right p-5 text-base cursor-pointer hover:bg-rose-50 transition-colors",
                    item.debit > 0 ? "text-rose-600 font-black" : "text-slate-300"
                  )}
                  onClick={() => item.debit > 0 && setViewingDayDetails(item)}
                >
                  {item.debit > 0 ? item.debit.toLocaleString() : "—"}
                </td>
                <td 
                  className={cn(
                    "text-right p-5 text-base cursor-pointer hover:bg-emerald-50 transition-colors",
                    item.credit > 0 ? "text-emerald-600 font-black" : "text-slate-300"
                  )}
                  onClick={() => item.credit > 0 && setViewingDayDetails(item)}
                >
                  {item.credit > 0 ? item.credit.toLocaleString() : "—"}
                </td>
                <td className="text-right p-5 bg-slate-50 font-black text-lg pr-6 underline decoration-black">৳ {item.balance.toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-slate-900 text-white font-black">
            <TableRow className="h-16">
              <TableCell colSpan={2} className="text-right uppercase tracking-[0.3em] text-sm pr-10">Institutional Aggregate Totals:</TableCell>
              <TableCell className="text-right text-lg border-l border-white/10">{institutionalLedger.reduce((s, r) => s + r.debit, 0).toLocaleString()}</TableCell>
              <TableCell className="text-right text-lg border-l border-white/10">{institutionalLedger.reduce((s, r) => s + r.credit, 0).toLocaleString()}</TableCell>
              <TableCell className="text-right text-2xl underline decoration-double bg-white text-black border-l border-white/10 pr-6">৳ {institutionalLedger[institutionalLedger.length-1]?.balance.toLocaleString() || "0.00"}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <Dialog open={!!viewingDayDetails} onOpenChange={(open) => !open && setViewingDayDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto font-ledger text-black border-4 border-black p-0 rounded-none shadow-2xl">
          <DialogHeader className="p-8 border-b-4 border-black bg-slate-50">
            <DialogTitle className="flex items-center gap-4 text-3xl font-black uppercase tracking-tight">
              <History className="size-10 text-black" />
              Source Personnel Breakdown
            </DialogTitle>
            <DialogDescription className="font-mono text-sm font-black text-slate-500 mt-2 uppercase tracking-widest">
              Audit Date: {viewingDayDetails?.date} • Institutional Consolidation
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-none border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-[0.3em]">Day Total Debit</p>
                <p className="text-4xl font-black text-rose-600">৳ {viewingDayDetails?.debit.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-none border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-[0.3em]">Day Total Credit</p>
                <p className="text-4xl font-black text-emerald-600">৳ {viewingDayDetails?.credit.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-black flex items-center gap-3 uppercase tracking-widest border-b-2 border-black pb-2">
                <User className="size-5" />
                Contributing Ledger Records
              </h3>
              <div className="border-2 border-black overflow-hidden shadow-xl">
                <Table className="font-black text-black tabular-nums">
                  <TableHeader className="bg-slate-100 border-b-2 border-black">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest py-4 pl-6">Member ID & Name</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest py-4">Voucher Particulars</TableHead>
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
                            <div className="flex flex-col">
                              <span className="font-mono text-xs text-black">{member?.memberIdNumber || "N/A"}</span>
                              <span className="text-[10px] uppercase font-black text-slate-500">{member?.name || "Unknown Member"}</span>
                            </div>
                          </td>
                          <td className="p-4 text-[10px] uppercase max-w-[300px] truncate">{entry.particulars}</td>
                          <td className="text-right p-4 font-black text-rose-600">
                            {entry.netEffect < 0 ? Math.abs(entry.netEffect).toLocaleString() : "—"}
                          </td>
                          <td className="text-right p-4 pr-6 font-black text-emerald-600">
                            {entry.netEffect > 0 ? entry.netEffect.toLocaleString() : "—"}
                          </td>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter className="bg-slate-50 font-black border-t-2 border-black">
                    <TableRow className="h-14">
                      <TableCell colSpan={2} className="text-right uppercase tracking-widest text-[10px] pl-6">Consolidated Impact:</TableCell>
                      <TableCell className="text-right text-rose-600 text-lg tabular-nums">{viewingDayDetails?.debit.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-600 text-lg pr-6 tabular-nums">{viewingDayDetails?.credit.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>

            <div className="bg-slate-900 p-6 border-2 border-black flex gap-4 items-start shadow-xl">
              <ShieldCheck className="size-6 text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-white tracking-[0.2em]">Institutional Audit Logic Verification</p>
                <p className="text-[11px] leading-relaxed text-slate-400 font-bold uppercase italic">
                  This drill-down identifies the exact personnel origin for consolidated control balances. Every entry shown here represents a synchronized voucher from the Member Subsidiary Ledger (REB Form 224). The total debit and credit on this screen reconcile perfectly with the Institutional Control Ledger.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-100 p-6 border-t-4 border-black text-right">
            <Button variant="ghost" onClick={() => setViewingDayDetails(null)} className="font-black text-xs uppercase tracking-widest border-2 border-black hover:bg-white px-10 h-12">Close Audit Terminal</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.2em] mt-6">Subsidiary Control Ledger Statement</h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <span className="bg-black text-white px-4 py-1 rounded">Period: {dateRange.start} to {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <table className="w-full text-[10px] border-collapse border-2 border-black text-black font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 font-black border-b-2 border-black">
              <th className="border border-black p-2.5 uppercase tracking-widest text-center">Posting Date</th>
              <th className="border border-black p-2.5 text-left uppercase tracking-widest">Consolidated Particulars & Audit Trail</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest">Debit (৳)</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest">Credit (৳)</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest bg-slate-50">Balance (৳)</th>
            </tr>
          </thead>
          <tbody>
            {institutionalLedger.map((item: any, idx: number) => (
              <tr key={idx} className="border-b border-black">
                <td className="border border-black p-2.5 text-center font-mono">{item.date}</td>
                <td className="border border-black p-2.5 uppercase text-[9px]">{item.particulars}</td>
                <td className="border border-black p-2.5 text-right">{item.debit > 0 ? item.debit.toLocaleString() : "—"}</td>
                <td className="border border-black p-2.5 text-right">{item.credit > 0 ? item.credit.toLocaleString() : "—"}</td>
                <td className="border border-black p-2.5 text-right font-black bg-slate-50">{item.balance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black h-16 border-t-2 border-black">
              <td colSpan={2} className="border border-black p-2.5 text-right uppercase tracking-[0.2em]">Consolidated Grand Totals:</td>
              <td className="border border-black p-2.5 text-right font-black">{institutionalLedger.reduce((s, r) => s + r.debit, 0).toLocaleString()}</td>
              <td className="border border-black p-2.5 text-right font-black">{institutionalLedger.reduce((s, r) => s + r.credit, 0).toLocaleString()}</td>
              <td className="border border-black p-2.5 text-right underline decoration-double text-lg font-black">৳ {institutionalLedger[institutionalLedger.length-1]?.balance.toLocaleString() || "0.00"}</td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center">
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Prepared by</div>
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Checked by</div>
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Approved By Trustee</div>
        </div>
        <StandardFooter />
      </div>
    </div>
  );
}
