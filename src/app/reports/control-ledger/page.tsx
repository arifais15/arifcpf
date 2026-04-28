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
  ShieldCheck,
  FileSpreadsheet,
  ArrowLeft
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import Link from "next/link";
import { format, parseISO } from "date-fns";

export default function ControlAccountLedgerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = (generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2").toUpperCase();

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
    
    const account = activeCOA.find(a => (a.code || a.accountCode) === selectedAccount);
    if (!account) return { rows: [], opening: 0, closing: 0 };

    const startDate = new Date(`${dateRange.start}T00:00:00`).getTime();
    const endDate = new Date(`${dateRange.end}T23:59:59`).getTime();

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

    let openingBalance = 0;
    allRelevantLines.forEach(item => {
      if (item.timestamp < startDate) {
        if ((account.balance || account.normalBalance) === 'Debit') openingBalance += (item.debit - item.credit);
        else openingBalance += (item.credit - item.debit);
      }
    });

    const periodLines = allRelevantLines.filter(item => item.timestamp >= startDate && item.timestamp <= endDate);

    let currentBalance = openingBalance;
    const rows = periodLines.map(item => {
      if ((account.balance || account.normalBalance) === 'Debit') currentBalance += (item.debit - item.credit);
      else currentBalance += (item.credit - item.debit);
      return { ...item, balance: currentBalance };
    });

    return { rows, opening: openingBalance, closing: currentBalance };
  }, [allEntries, selectedAccount, activeCOA, dateRange]);

  const selectedAccountName = useMemo(() => {
    const acc = activeCOA.find(a => (a.code || a.accountCode) === selectedAccount);
    return acc ? (acc.name || acc.accountName) : "";
  }, [selectedAccount, activeCOA]);

  const exportToExcel = () => {
    if (!selectedAccount || ledgerResult.rows.length === 0) return;
    const exportRows = [
      { Date: dateRange.start, "Ref No": "N/A", Particulars: "Opening Balance Brought Forward", Debit: 0, Credit: 0, Balance: ledgerResult.opening }
    ];

    ledgerResult.rows.forEach(r => {
      exportRows.push({
        Date: r.date,
        "Ref No": r.ref,
        Particulars: r.particulars,
        Debit: r.debit,
        Credit: r.credit,
        Balance: r.balance
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Control Ledger");
    XLSX.writeFile(wb, `GL_Control_${selectedAccount}_${dateRange.start}.xlsx`);
    toast({ title: "Exported", description: "Ledger matrix saved to Excel." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-[#000000]">
      {/* PROFESSIONAL PRINT CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .no-print { display: none !important; }
          
          /* Purge scrollbars and force visibility */
          html, body, main, [data-sidebar="inset"] { 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }

          .print-container {
            display: block !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }

          table { 
            width: 100% !important; 
            table-layout: fixed !important; 
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          tr { break-inside: avoid !important; }
          th, td { border: 0.5pt solid black !important; padding: 4px 6px !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/reports" className="p-2 border-2 border-black rounded-full hover:bg-slate-100 transition-colors">
            <ArrowLeft className="size-6 text-black" />
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">GL Control Ledger</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Standardized Reconciliation Matrix</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={!selectedAccount} className="gap-2 h-10 font-black border-black text-black shadow-xl uppercase tracking-widest text-[10px] px-6">
            <FileSpreadsheet className="size-4" /> Export Excel
          </Button>
          <Button onClick={() => window.print()} disabled={!selectedAccount} className="gap-2 h-10 font-black bg-black text-white shadow-xl uppercase tracking-widest text-[10px] px-8">
            <Printer className="size-4" /> Print Ledger
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-2xl flex flex-col md:flex-row items-center gap-8 no-print">
        <div className="flex-1 w-full space-y-1.5">
          <Label className="text-[10px] font-black uppercase text-black ml-1">General Ledger Account Head</Label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="h-12 font-black border-4 border-black text-black text-lg">
              <SelectValue placeholder="Select GL Account..." />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {activeCOA.filter(a => !a.isHeader).map(a => (
                <SelectItem key={a.code || a.accountCode} value={a.code || a.accountCode} className="font-black text-black text-xs uppercase">
                  {a.code || a.accountCode} — {a.name || a.accountName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border-2 border-black">
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-black text-black text-center">Period From</Label>
            <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 font-black border-2 border-black text-black bg-white" />
          </div>
          <ArrowRightLeft className="size-4 text-black opacity-30 mt-4" />
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-black text-black text-center">Period To</Label>
            <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 font-black border-2 border-black text-black bg-white" />
          </div>
        </div>
      </div>

      {selectedAccount && (
        <div className="print-container bg-white rounded-none border-2 border-black overflow-hidden shadow-2xl print:border-none print:shadow-none animate-in fade-in duration-500">
          {/* INSTITUTIONAL PRINT HEADER */}
          <div className="hidden print:block text-center mb-8 text-black">
            <h1 className="text-2xl font-black uppercase tracking-tight">{pbsName}</h1>
            <p className="text-sm font-black uppercase tracking-[0.3em] mt-1">Employees' Contributory Provident Fund</p>
            <div className="mt-6 flex justify-center">
              <div className="border-4 border-black px-12 py-2">
                <h2 className="text-xl font-black uppercase tracking-[0.4em]">General Ledger Control Matrix</h2>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-8 text-[11px] font-black uppercase tracking-widest text-left border-2 border-black p-4">
              <div>Account: <span className="text-lg ml-2">{selectedAccount} — {selectedAccountName}</span></div>
              <div className="text-right">Period: {dateRange.start ? format(parseISO(dateRange.start), 'dd-MMM-yy') : '...'} to {dateRange.end ? format(parseISO(dateRange.end), 'dd-MMM-yy') : '...'}</div>
            </div>
          </div>

          <div className="p-4 bg-slate-100 border-b-2 border-black flex items-center justify-between no-print">
            <h2 className="text-sm font-black flex items-center gap-3 uppercase tracking-widest">
              <ShieldCheck className="size-5" /> GL Reconciliation Matrix: {selectedAccountName}
            </h2>
            <div className="flex gap-4">
              <Badge variant="outline" className="bg-white border-black font-black uppercase text-[10px] rounded-none px-4">Opening BF: ৳{ledgerResult.opening.toLocaleString()}</Badge>
              <Badge className="bg-black text-white font-black uppercase text-[10px] rounded-none px-4">Closing CF: ৳{ledgerResult.closing.toLocaleString()}</Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="text-black font-black tabular-nums border-collapse w-full">
              <TableHeader className="bg-slate-50 border-b-2 border-black uppercase text-[9px]">
                <TableRow>
                  <TableHead className="font-black text-black uppercase text-[10px] py-5 pl-6 border-r border-black w-[110px]">Date</TableHead>
                  <TableHead className="font-black text-black uppercase text-[10px] py-5 border-r border-black w-[120px]">Ref No</TableHead>
                  <TableHead className="font-black text-black uppercase text-[10px] py-5 border-r border-black">Particulars</TableHead>
                  <TableHead className="text-right font-black text-black uppercase text-[10px] py-5 border-r border-black w-[150px]">Debit (৳)</TableHead>
                  <TableHead className="text-right font-black text-black uppercase text-[10px] py-5 border-r border-black w-[150px]">Credit (৳)</TableHead>
                  <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5 bg-slate-100 pr-6 w-[180px]">Balance (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[11px] print:text-[10px]">
                <TableRow className="bg-slate-50/50 italic border-b-2 border-black h-12">
                  <td className="p-4 pl-6 font-mono text-xs border-r border-black">{dateRange.start}</td>
                  <td className="p-4 text-center border-r border-black">—</td>
                  <td className="p-4 uppercase font-black border-r border-black">Opening Balance Brought Forward</td>
                  <td className="text-right p-4 border-r border-black">—</td>
                  <td className="text-right p-4 border-r border-black">—</td>
                  <td className="text-right p-4 pr-6 font-black bg-slate-100/50">৳ {ledgerResult.opening.toLocaleString()}</td>
                </TableRow>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
                ) : ledgerResult.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-black uppercase text-xl italic opacity-20">No transactions recorded in this period</TableCell></TableRow>
                ) : ledgerResult.rows.map((item: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                    <td className="font-mono text-xs p-4 pl-6 border-r border-black">{item.date}</td>
                    <td className="p-4 text-xs font-mono border-r border-black">{item.ref}</td>
                    <td className="p-4 uppercase text-[10px] font-black border-r border-black leading-tight">{item.particulars}</td>
                    <td className="text-right p-4 border-r border-black font-black text-rose-600">{item.debit > 0 ? item.debit.toLocaleString() : "—"}</td>
                    <td className="text-right p-4 border-r border-black font-black text-emerald-600">{item.credit > 0 ? item.credit.toLocaleString() : "—"}</td>
                    <td className="text-right p-4 bg-slate-50 font-black text-base pr-6 underline decoration-black/10">৳ {item.balance.toLocaleString()}</td>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-slate-900 text-white font-black border-t-4 border-black no-print">
                <TableRow className="h-16">
                  <TableCell colSpan={3} className="text-right uppercase tracking-[0.3em] text-[10px] pr-10 border-r border-white/10">Institutional Totals:</TableCell>
                  <TableCell className="text-right border-r border-white/10 font-black text-rose-400">৳ {ledgerResult.rows.reduce((s,r) => s + r.debit, 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right border-r border-white/10 font-black text-emerald-400">৳ {ledgerResult.rows.reduce((s,r) => s + r.credit, 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right bg-white text-black text-2xl pr-6 underline decoration-double decoration-black/30">৳ {ledgerResult.closing.toLocaleString()}</TableCell>
                </TableRow>
              </TableFooter>
              <TableFooter className="hidden print:table-footer-group bg-slate-100 text-black font-black border-t-4 border-black">
                <TableRow className="h-12 font-black text-black">
                  <TableCell colSpan={3} className="text-right pr-6 uppercase font-black text-[10px] border-r border-black">Consolidated Totals:</TableCell>
                  <TableCell className="text-right border-r border-black">{ledgerResult.rows.reduce((s,r) => s + r.debit, 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right border-r border-black">{ledgerResult.rows.reduce((s,r) => s + r.credit, 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-black text-lg underline decoration-double decoration-black/30 bg-white">৳ {ledgerResult.closing.toLocaleString()}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* PRINT SIGN-OFF BLOCKS */}
          <div className="hidden print:block mt-24 px-6">
            <div className="grid grid-cols-3 gap-16 text-[12px] font-black text-center uppercase tracking-widest text-black">
              <div className="border-t-2 border-black pt-4">Prepared by</div>
              <div className="border-t-2 border-black pt-4">Checked by</div>
              <div className="border-t-2 border-black pt-4">Approved by Trustee</div>
            </div>
            <div className="mt-12 pt-4 border-t border-black/10 flex justify-between items-center text-[8px] font-black uppercase text-slate-400">
              <span>CPF Management Software v1.2</span>
              <span>Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
