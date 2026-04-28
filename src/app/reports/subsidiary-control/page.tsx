
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
  History,
  ShieldCheck,
  FileSpreadsheet,
  ArrowLeft
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { format, parseISO } from "date-fns";

export default function SubsidiaryControlLedgerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = (generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2").toUpperCase();

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
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
    members?.forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading } = useCollection(summariesRef);

  const ledgerResult = useMemo(() => {
    if (!allSummaries || !dateRange.start) return { rows: [], opening: 0, closing: 0 };
    const startDate = new Date(`${dateRange.start}T00:00:00`).getTime();
    const endDate = new Date(`${dateRange.end}T23:59:59`).getTime();

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

      if (timestamp < startDate) openingBalance += netEffect;
      else if (timestamp <= endDate) {
        const date = s.summaryDate;
        if (!grouped[date]) grouped[date] = { date, debit: 0, credit: 0, timestamp, count: 0, entries: [] };
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
      return { ...item, particulars: `Consolidated Activity (${item.count} Personnel)`, balance: currentBalance }; 
    });

    return { rows, opening: openingBalance, closing: currentBalance };
  }, [allSummaries, dateRange]);

  const exportToExcel = () => {
    if (ledgerResult.rows.length === 0) return;
    const exportRows = [
      { Date: dateRange.start, Particulars: "Opening Balance Brought Forward", Debit: 0, Credit: 0, Balance: ledgerResult.opening }
    ];

    ledgerResult.rows.forEach(r => {
      exportRows.push({
        Date: r.date,
        Particulars: r.particulars,
        Debit: r.debit,
        Credit: r.credit,
        Balance: r.balance
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subsidiary Control");
    XLSX.writeFile(wb, `Subsidiary_Control_${dateRange.start}_to_${dateRange.end}.xlsx`);
    toast({ title: "Exported", description: "Subsidiary control ledger saved to Excel." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-[#000000]">
      {/* PROFESSIONAL LANDSCAPE PRINT CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          .no-print { display: none !important; }
          
          /* PURGE OVERFLOWS */
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
          th, td { border: 0.5pt solid black !important; padding: 4px 8px !important; }
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
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Subsidiary Control</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Consolidated Trust Audit Matrix</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="gap-2 h-10 font-black border-black text-black shadow-xl uppercase tracking-widest text-[10px] px-6">
            <FileSpreadsheet className="size-4" /> Export Excel
          </Button>
          <Button onClick={() => window.print()} className="gap-2 h-10 font-black bg-black text-white shadow-xl uppercase tracking-widest text-[10px] px-8">
            <Printer className="size-4" /> Print Statement
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border-4 border-black shadow-2xl flex flex-col md:flex-row items-center justify-between no-print gap-8">
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border-2 border-black">
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-black text-black">Ledger Start</Label>
            <Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-2 border-black bg-white font-black" />
          </div>
          <ArrowRightLeft className="size-3 text-black opacity-30 mt-4" />
          <div className="grid gap-1">
            <Label className="text-[9px] uppercase font-black text-black">Ledger End</Label>
            <Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-2 border-black bg-white font-black" />
          </div>
        </div>
        <div className="flex gap-4">
          <Badge variant="outline" className="bg-white border-black font-black uppercase text-[10px] rounded-none py-1.5 px-4 h-auto shadow-sm">Opening BF: ৳{ledgerResult.opening.toLocaleString()}</Badge>
          <Badge className="bg-black text-white font-black uppercase text-[10px] rounded-none py-1.5 px-4 h-auto shadow-md">Closing CF: ৳{ledgerResult.closing.toLocaleString()}</Badge>
        </div>
      </div>

      <div className="print-container bg-white rounded-none border-2 border-black overflow-hidden shadow-2xl print:border-none print:shadow-none">
        {/* INSTITUTIONAL PRINT HEADER */}
        <div className="hidden print:block text-center mb-8 text-black">
          <h1 className="text-2xl font-black uppercase tracking-tight">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-[0.3em] mt-1">Employees' Contributory Provident Fund</p>
          <div className="mt-6 flex justify-center">
            <div className="border-4 border-black px-12 py-2">
              <h2 className="text-xl font-black uppercase tracking-[0.4em]">Subsidiary Control Ledger</h2>
            </div>
          </div>
          <div className="flex justify-between items-end mt-8 border-b-2 border-black pb-2 text-[10px] font-black uppercase tracking-widest">
            <span>Period: {dateRange.start ? format(parseISO(dateRange.start), 'dd-MMM-yy') : '...'} to {dateRange.end ? format(parseISO(dateRange.end), 'dd-MMM-yy') : '...'}</span>
            <span>Print Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="text-black font-black tabular-nums border-collapse w-full">
            <TableHeader className="bg-slate-100 border-b-2 border-black uppercase text-[9px]">
              <TableRow>
                <TableHead className="font-black text-black uppercase text-[10px] py-5 pl-6 border-r border-black w-[110px]">Date</TableHead>
                <TableHead className="font-black text-black uppercase text-[10px] py-5 border-r border-black">Consolidated Particulars</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] py-5 border-r border-black w-[180px]">Debit (৳)</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] py-5 border-r border-black w-[180px]">Credit (৳)</TableHead>
                <TableHead className="text-right font-black text-black uppercase text-[10px] tracking-widest py-5 bg-slate-200 pr-6 w-[200px]">Balance (৳)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-[11px] print:text-[10px]">
              <TableRow className="bg-slate-50/50 italic border-b-2 border-black h-12">
                <td className="p-4 pl-6 font-mono text-xs border-r border-black">{dateRange.start}</td>
                <td className="p-4 uppercase font-black border-r border-black">Opening Balance Brought Forward</td>
                <td className="text-right p-4 border-r border-black">—</td>
                <td className="text-right p-4 border-r border-black">—</td>
                <td className="text-right p-4 pr-6 font-black bg-slate-100/50">৳ {ledgerResult.opening.toLocaleString()}</td>
              </TableRow>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
              ) : ledgerResult.rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-black uppercase text-xl italic opacity-20">No audit movements found in this period</TableCell></TableRow>
              ) : ledgerResult.rows.map((item: any, idx: number) => (
                <TableRow key={idx} className="hover:bg-slate-50 border-b border-black h-10">
                  <td className="font-mono text-xs p-4 pl-6 border-r border-black">{item.date}</td>
                  <td className="p-4 uppercase opacity-70 font-black border-r border-black">{item.particulars}</td>
                  <td 
                    className="text-right p-4 text-base cursor-pointer hover:bg-rose-50 font-black text-rose-600 border-r border-black no-print" 
                    onClick={() => item.debit > 0 && setViewingDayDetails(item)}
                  >
                    {item.debit > 0 ? item.debit.toLocaleString() : "—"}
                  </td>
                  {/* Print-specific cells */}
                  <td className="text-right p-4 font-black text-rose-600 border-r border-black hidden print:table-cell">
                    {item.debit > 0 ? item.debit.toLocaleString() : "—"}
                  </td>
                  <td 
                    className="text-right p-4 text-base cursor-pointer hover:bg-emerald-50 font-black text-emerald-600 border-r border-black no-print" 
                    onClick={() => item.credit > 0 && setViewingDayDetails(item)}
                  >
                    {item.credit > 0 ? item.credit.toLocaleString() : "—"}
                  </td>
                  <td className="text-right p-4 font-black text-emerald-600 border-r border-black hidden print:table-cell">
                    {item.credit > 0 ? item.credit.toLocaleString() : "—"}
                  </td>
                  <td className="text-right p-4 bg-slate-50 font-black text-lg pr-6 underline decoration-black/20">৳ {item.balance.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-900 text-white font-black border-t-4 border-black no-print">
              <TableRow className="h-16">
                <TableCell colSpan={2} className="text-right uppercase tracking-[0.3em] text-[10px] pr-10 border-r border-white/10">Period Closing Position:</TableCell>
                <TableCell className="text-right border-r border-white/10 font-black text-rose-400">৳ {ledgerResult.rows.reduce((s,r) => s + (r.debit||0), 0).toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-white/10 font-black text-emerald-400">৳ {ledgerResult.rows.reduce((s,r) => s + (r.credit||0), 0).toLocaleString()}</TableCell>
                <TableCell className="text-right bg-white text-black text-2xl pr-6 underline decoration-double decoration-black/30">৳ {ledgerResult.closing.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
            {/* PRINT FOOTER TOTALS */}
            <TableFooter className="hidden print:table-footer-group bg-slate-100 text-black font-black border-t-4 border-black">
              <TableRow className="h-12 font-black text-black">
                <TableCell colSpan={2} className="text-right pr-4 uppercase font-black text-[10px] border-r border-black">Institutional Matrix Totals:</TableCell>
                <TableCell className="text-right border-r border-black text-rose-700">{ledgerResult.rows.reduce((s,r) => s + (r.debit||0), 0).toLocaleString()}</TableCell>
                <TableCell className="text-right border-r border-black text-emerald-700">{ledgerResult.rows.reduce((s,r) => s + (r.credit||0), 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-black text-lg underline decoration-double decoration-black/30 bg-white">৳ {ledgerResult.closing.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* PRINT SIGN-OFF BLOCKS */}
        <div className="hidden print:block mt-24">
          <div className="grid grid-cols-3 gap-16 text-[12px] font-black text-center uppercase tracking-widest text-black">
            <div className="border-t-2 border-black pt-4">Prepared by</div>
            <div className="border-t-2 border-black pt-4">Checked by</div>
            <div className="border-t-2 border-black pt-4">Approved by Trustee</div>
          </div>
          <div className="mt-12 pt-4 border-t border-black/10 flex justify-between items-center text-[8px] font-black uppercase text-slate-400">
            <span>CPF Management Matrix v1.2</span>
            <span>Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
          </div>
        </div>
      </div>

      {/* DETAIL TRACE DIALOG */}
      <Dialog open={!!viewingDayDetails} onOpenChange={(open) => !open && setViewingDayDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto font-ledger text-black border-4 border-black p-0 rounded-none shadow-2xl">
          <DialogHeader className="p-8 border-b-4 border-black bg-slate-50">
            <DialogTitle className="flex items-center gap-4 text-3xl font-black uppercase tracking-tight">Source Trace Audit</DialogTitle>
            <DialogDescription className="font-mono text-sm font-black text-slate-500 mt-2 uppercase tracking-widest">Posting Date: {viewingDayDetails?.date} • {viewingDayDetails?.count} Personnel Matrix</DialogDescription>
          </DialogHeader>
          <div className="p-8">
            <Table className="font-black text-black tabular-nums border-2 border-black">
              <TableHeader className="bg-slate-100 border-b-2 border-black">
                <TableRow className="uppercase text-[9px] font-black">
                  <TableHead className="font-black uppercase text-[10px] py-4 pl-6 border-r border-black text-black">ID & Personnel Name</TableHead>
                  <TableHead className="font-black uppercase text-[10px] py-4 border-r border-black text-black">Voucher Detail</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] py-4 border-r border-black text-black">Debit (৳)</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] py-4 pr-6 text-black">Credit (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[11px]">
                {viewingDayDetails?.entries.map((entry: any, i: number) => (
                  <TableRow key={i} className="hover:bg-slate-50 border-b border-black">
                    <td className="p-4 pl-6 border-r border-black"><div className="flex flex-col"><span className="font-mono text-xs font-black">{memberMap[entry.memberId]?.memberIdNumber}</span><span className="text-[10px] uppercase opacity-60 font-black">{memberMap[entry.memberId]?.name}</span></div></td>
                    <td className="p-4 text-[10px] uppercase truncate border-r border-black">{entry.particulars}</td>
                    <td className="text-right p-4 text-rose-600 border-r border-black font-black">{entry.netEffect < 0 ? Math.abs(entry.netEffect).toLocaleString() : "—"}</td>
                    <td className="text-right p-4 pr-6 text-emerald-600 font-black">{entry.netEffect > 0 ? entry.netEffect.toLocaleString() : "—"}</td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="bg-slate-100 p-6 border-t-4 border-black text-right">
            <Button variant="ghost" onClick={() => setViewingDayDetails(null)} className="font-black text-xs uppercase tracking-widest border-2 border-black hover:bg-white px-8">Close Audit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
