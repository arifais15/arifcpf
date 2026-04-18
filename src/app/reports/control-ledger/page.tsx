
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
  BookText,
  ShieldCheck
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import { cn } from "@/lib/utils";

export default function ControlAccountLedgerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setDateRange({ start: fyStart, end: today });
  }, []);

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData } = useCollection(coaRef);
  const activeCOA = useMemo(() => (coaData && coaData.length > 0 ? coaData : INITIAL_COA), [coaData]);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: allEntries, isLoading } = useCollection(entriesRef);

  const ledgerResult = useMemo(() => {
    if (!allEntries || !selectedAccount || !dateRange.start) return { rows: [], opening: 0, closing: 0 };
    
    const account = activeCOA.find(a => a.code === selectedAccount);
    if (!account) return { rows: [], opening: 0, closing: 0 };

    const startDate = new Date(`${dateRange.start}T00:00:00`).getTime();
    const endDate = new Date(`${dateRange.end}T23:59:59`).getTime();

    // 1. Flatten all lines for this account and sort by date
    const allRelevantLines = allEntries.flatMap(entry => 
      (entry.lines || [])
        .filter((line: any) => line.accountCode === selectedAccount)
        .map((line: any) => ({
          date: entry.entryDate,
          ref: entry.referenceNumber || "AUTO",
          particulars: entry.description,
          memo: line.memo,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          timestamp: new Date(entry.entryDate).getTime()
        }))
    ).sort((a, b) => a.timestamp - b.timestamp);

    // 2. Calculate Opening Balance (Everything before start date)
    let openingBalance = 0;
    allRelevantLines.forEach(item => {
      if (item.timestamp < startDate) {
        if (account.balance === 'Debit') openingBalance += (item.debit - item.credit);
        else openingBalance += (item.credit - item.debit);
      }
    });

    // 3. Filter transactions during period
    const periodLines = allRelevantLines.filter(item => 
      item.timestamp >= startDate && item.timestamp <= endDate
    );

    // 4. Map rows with running balance
    let currentBalance = openingBalance;
    const rows = periodLines.map(item => {
      if (account.balance === 'Debit') currentBalance += (item.debit - item.credit);
      else currentBalance += (item.credit - item.debit);
      return { ...item, balance: currentBalance };
    });

    return { rows, opening: openingBalance, closing: currentBalance };
  }, [allEntries, selectedAccount, activeCOA, dateRange]);

  const StandardFooter = () => (
    <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
      <span>CPF Management Software</span>
      <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
    </div>
  );

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-[#000000]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl shadow-lg">
            <BookText className="size-8 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">GL Control Ledger</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Full Cycle Traceability • Opening & Closing Audit</p>
          </div>
        </div>
        <Button onClick={() => window.print()} disabled={!selectedAccount} className="gap-2 h-10 font-black bg-black text-white shadow-xl uppercase tracking-widest text-xs px-8">
          <Printer className="size-4" /> Print Control Ledger
        </Button>
      </div>

      <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-2xl flex flex-col md:flex-row items-center gap-8 no-print">
        <div className="flex-1 w-full space-y-1.5">
          <Label className="text-[10px] font-black uppercase text-black ml-1">General Ledger Account</Label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="h-12 font-black border-4 border-black text-black text-lg"><SelectValue placeholder="Search or Select Account..." /></SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {activeCOA.filter(a => !a.isHeader).map(a => (
                <SelectItem key={a.code} value={a.code} className="font-black text-black">{a.code} - {a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border-2 border-black">
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-black text-black text-center">Audit From</Label>
            <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 font-black border-2 border-black text-black bg-white" />
          </div>
          <ArrowRightLeft className="size-4 text-black opacity-30 mt-4" />
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-black text-black text-center">Audit To</Label>
            <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 font-black border-2 border-black text-black bg-white" />
          </div>
        </div>
      </div>

      {selectedAccount && (
        <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print animate-in fade-in duration-500">
          <div className="p-4 bg-slate-100 border-b-4 border-black flex items-center justify-between">
            <h2 className="text-sm font-black flex items-center gap-3 uppercase tracking-widest">
              <ShieldCheck className="size-5" /> GL Reconciliation Terminal
            </h2>
            <div className="flex gap-4">
              <Badge variant="outline" className="bg-white border-black font-black uppercase text-[10px]">Opening: ৳{ledgerResult.opening.toLocaleString()}</Badge>
              <Badge className="bg-black text-white font-black uppercase text-[10px]">Closing: ৳{ledgerResult.closing.toLocaleString()}</Badge>
            </div>
          </div>
          <Table className="text-black font-black tabular-nums">
            <TableHeader>
              <TableRow className="bg-slate-50 border-b-2 border-black">
                <TableHead className="font-black text-black uppercase text-[10px] tracking-widest py-5 pl-6">Date</TableHead>
                <TableHead className="font-black text-black uppercase text-[10px] tracking-widest py-5">Ref No</TableHead>
                <TableHead className="font-black text-black uppercase text-[10px] tracking-widest py-5">Particulars & Transaction Memo</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5">Debit (৳)</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5">Credit (৳)</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5 bg-slate-100 pr-6">Balance (৳)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-slate-50/50 italic border-b-2 border-black h-12">
                <td className="p-4 pl-6 font-mono text-xs text-slate-500">{dateRange.start}</td>
                <td className="p-4 text-center">—</td>
                <td className="p-4 uppercase text-[11px] font-black tracking-widest">Opening Balance</td>
                <td className="text-right p-4">—</td>
                <td className="text-right p-4">—</td>
                <td className="text-right p-4 pr-6 font-black bg-slate-100/50">৳ {ledgerResult.opening.toLocaleString()}</td>
              </TableRow>
              
              {ledgerResult.rows.map((item, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50 border-b border-black transition-colors">
                  <td className="font-mono text-xs p-4 pl-6">{item.date}</td>
                  <td className="p-4 text-xs font-mono">{item.ref}</td>
                  <td className="p-4 max-w-[400px]">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[11px] uppercase font-black leading-tight">{item.particulars}</p>
                      {item.memo && <p className="text-[9px] opacity-60 font-bold uppercase italic">{item.memo}</p>}
                    </div>
                  </td>
                  <td className="text-right p-4 text-base">{item.debit > 0 ? item.debit.toLocaleString() : "—"}</td>
                  <td className="text-right p-4 text-base">{item.credit > 0 ? item.credit.toLocaleString() : "—"}</td>
                  <td className="text-right p-4 bg-slate-50 font-black text-lg pr-6 underline decoration-black">৳ {item.balance.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-100 font-black border-t-4 border-black text-black">
              <TableRow className="h-16">
                <TableCell colSpan={3} className="text-right uppercase tracking-[0.2em] text-sm pr-10">Period Closing Aggregates:</TableCell>
                <TableCell className="text-right text-lg border-l border-black/20">{ledgerResult.rows.reduce((s, r) => s + r.debit, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-lg border-l border-black/20">{ledgerResult.rows.reduce((s, r) => s + r.credit, 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-2xl underline decoration-double bg-white border-l border-black/20 pr-6">৳ {ledgerResult.closing.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      <div className="hidden print:block print-container font-ledger text-[#000000]">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.4em] mt-4">Control Account Ledger Reconciliation Statement</h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <div className="text-left space-y-1">
              <p>ACCOUNT: {selectedAccount} - {activeCOA.find(a => a.code === selectedAccount)?.name}</p>
              <p>PERIOD: {dateRange.start} TO {dateRange.end}</p>
            </div>
            <span>RUN DATE: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse border-2 border-black text-[#000000] font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-black">
              <th className="border border-black p-2.5 uppercase text-center w-[90px]">Date</th>
              <th className="border border-black p-2.5 uppercase text-center w-[80px]">Ref No</th>
              <th className="border border-black p-2.5 text-left uppercase">Particulars & Audit Memo</th>
              <th className="border border-black p-2.5 text-right uppercase w-[120px]">Debit</th>
              <th className="border border-black p-2.5 text-right uppercase w-[120px]">Credit</th>
              <th className="border border-black p-2.5 text-right uppercase w-[150px] bg-slate-100">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="italic h-10">
              <td className="border border-black p-2 text-center">{dateRange.start}</td>
              <td className="border border-black p-2 text-center">—</td>
              <td className="border border-black p-2 uppercase">Opening Balance Brought Forward</td>
              <td className="border border-black p-2 text-right">—</td>
              <td className="border border-black p-2 text-right">—</td>
              <td className="border border-black p-2 text-right">৳ {ledgerResult.opening.toLocaleString()}</td>
            </tr>
            {ledgerResult.rows.map((item, idx) => (
              <tr key={idx} className="h-10">
                <td className="border border-black p-2 text-center font-mono">{item.date}</td>
                <td className="border border-black p-2 text-center font-mono">{item.ref}</td>
                <td className="border border-black p-2">
                  <span className="font-black block">{item.particulars}</span>
                  {item.memo && <span className="text-[8px] italic opacity-70 block">{item.memo}</span>}
                </td>
                <td className="border border-black p-2 text-right">{item.debit > 0 ? item.debit.toLocaleString() : "—"}</td>
                <td className="border border-black p-2 text-right">{item.credit > 0 ? item.credit.toLocaleString() : "—"}</td>
                <td className="border border-black p-2 text-right font-black">৳ {item.balance.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black h-16 border-t-2 border-black">
              <td colSpan={3} className="border border-black p-2.5 text-right uppercase tracking-widest">Aggregate Audit Totals:</td>
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
