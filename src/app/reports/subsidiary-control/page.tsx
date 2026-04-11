
"use client"

import React, { useMemo, useState } from "react";
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
  Search,
  ArrowRightLeft,
  LayoutList,
  Filter,
  User,
  Tags
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

const SUBSIDIARY_COLUMNS = [
  { key: 'employeeContribution', label: 'Col 1: Employee Contribution', balance: 'Credit' },
  { key: 'loanWithdrawal', label: 'Col 2: Loan Withdrawal', balance: 'Debit' },
  { key: 'loanRepayment', label: 'Col 3: Loan Repayment', balance: 'Credit' },
  { key: 'profitEmployee', label: 'Col 5: Profit on Employee Cont.', balance: 'Credit' },
  { key: 'profitLoan', label: 'Col 6: Profit on Loan', balance: 'Credit' },
  { key: 'pbsContribution', label: 'Col 8: PBS Contribution', balance: 'Credit' },
  { key: 'profitPbs', label: 'Col 9: Profit on PBS Cont.', balance: 'Credit' },
];

export default function SubsidiaryControlLedgerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedColumn, setSelectedColumn] = useState<string>("employeeContribution");
  const [selectedMember, setSelectedMember] = useState<string>("all");

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading } = useCollection(summariesRef);

  const ledgerData = useMemo(() => {
    if (!allSummaries || !selectedColumn) return [];

    const colConfig = SUBSIDIARY_COLUMNS.find(c => c.key === selectedColumn);
    if (!colConfig) return [];

    const filtered = allSummaries
      .filter(s => {
        const val = Number(s[selectedColumn]) || 0;
        const matchesMember = selectedMember === "all" || s.memberId === selectedMember;
        return val !== 0 && matchesMember;
      })
      .map(s => {
        const amount = Number(s[selectedColumn]) || 0;
        const member = members?.find(m => m.id === s.memberId);
        
        return {
          date: s.summaryDate,
          memberId: member?.memberIdNumber || "N/A",
          memberName: member?.name || "Unknown",
          particulars: s.particulars || "Manual Entry",
          debit: colConfig.balance === 'Debit' ? (amount > 0 ? amount : 0) : (amount < 0 ? Math.abs(amount) : 0),
          credit: colConfig.balance === 'Credit' ? (amount > 0 ? amount : 0) : (amount < 0 ? Math.abs(amount) : 0),
          timestamp: new Date(s.summaryDate).getTime()
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    // Apply date filter
    let processed = filtered;
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      processed = filtered.filter(item => item.timestamp >= s && item.timestamp <= e);
    }

    // Calculate Running Balance
    let currentBalance = 0;
    return processed.map(item => {
      if (colConfig.balance === 'Debit') {
        currentBalance += (item.debit - item.credit);
      } else {
        currentBalance += (item.credit - item.debit);
      }
      return { ...item, balance: currentBalance };
    });
  }, [allSummaries, selectedColumn, selectedMember, members, dateRange]);

  const exportToExcel = () => {
    if (ledgerData.length === 0) return;
    const colName = SUBSIDIARY_COLUMNS.find(c => c.key === selectedColumn)?.label;
    const data = ledgerData.map(item => ({
      "Date": item.date,
      "Member ID": item.memberId,
      "Member Name": item.memberName,
      "Particulars": item.particulars,
      "Debit (৳)": item.debit,
      "Credit (৳)": item.credit,
      "Balance (৳)": item.balance
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sub Ledger");
    XLSX.writeFile(wb, `Subsidiary_Control_${selectedColumn}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Exported", description: "Subsidiary details saved to Excel." });
  };

  const selectedColLabel = SUBSIDIARY_COLUMNS.find(c => c.key === selectedColumn)?.label || "";

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      {/* Print View */}
      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">Gazipur Palli Bidyut Samity-2</h1>
          <h2 className="text-lg font-bold underline underline-offset-4 uppercase">Subsidiary Control Ledger</h2>
          <div className="flex justify-between text-[10px] font-bold pt-4">
            <div className="text-left">
              <p>Column Category: {selectedColLabel}</p>
              <p>Scope: {selectedMember === 'all' ? 'Institutional (All Members)' : `Member: ${ledgerData[0]?.memberId || ''} - ${ledgerData[0]?.memberName || ''}`}</p>
              <p>Period: {dateRange.start || "Beginning"} to {dateRange.end || "Present"}</p>
            </div>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[9px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-2 text-center w-[70px]">Date</th>
              <th className="border border-black p-2 text-center w-[80px]">Member ID</th>
              <th className="border border-black p-2 text-left">Particulars</th>
              <th className="border border-black p-2 text-right">Debit (৳)</th>
              <th className="border border-black p-2 text-right">Credit (৳)</th>
              <th className="border border-black p-2 text-right">Balance (৳)</th>
            </tr>
          </thead>
          <tbody>
            {ledgerData.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black p-2 text-center font-mono">{item.date}</td>
                <td className="border border-black p-2 text-center font-bold">{item.memberId}</td>
                <td className="border border-black p-2">{item.particulars}</td>
                <td className="border border-black p-2 text-right">{item.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right">{item.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-2 text-right font-bold">{item.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
          <div className="border-t border-black pt-2">Accountant / AGM(F)</div>
          <div className="border-t border-black pt-2">Internal Auditor / DGM</div>
          <div className="border-t border-black pt-2">Approved By Trustee</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <LayoutList className="size-8 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-primary tracking-tight">Subsidiary Control</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Aggregated movement of member fund categories</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-10 font-bold">
            <FileSpreadsheet className="size-4" /> Excel Export
          </Button>
          <Button onClick={() => window.print()} className="gap-2 h-10 font-bold shadow-lg shadow-primary/20">
            <Printer className="size-4" /> Print Ledger
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm grid gap-6 md:grid-cols-12 no-print">
        <div className="md:col-span-4 space-y-1.5">
          <Label className="text-[10px] uppercase font-black text-slate-400 ml-1 flex items-center gap-2">
            <Tags className="size-3" /> Select Ledger Category
          </Label>
          <Select value={selectedColumn} onValueChange={setSelectedColumn}>
            <SelectTrigger className="h-11 font-bold border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBSIDIARY_COLUMNS.map(col => (
                <SelectItem key={col.key} value={col.key} className="py-2">
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-4 space-y-1.5">
          <Label className="text-[10px] uppercase font-black text-slate-400 ml-1 flex items-center gap-2">
            <User className="size-3" /> Member Scope
          </Label>
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger className="h-11 font-bold border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">Institutional (All Members)</SelectItem>
              {members?.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.memberIdNumber} - {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-4 flex items-center gap-3 self-end">
          <div className="grid gap-1 flex-1">
            <Label className="text-[9px] uppercase font-bold text-slate-400">Date From</Label>
            <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 text-xs border-slate-200 font-bold" />
          </div>
          <ArrowRightLeft className="size-3 text-slate-300 mt-4" />
          <div className="grid gap-1 flex-1">
            <Label className="text-[9px] uppercase font-bold text-slate-400">Date To</Label>
            <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 text-xs border-slate-200 font-bold" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-white border-primary/20 text-primary font-bold text-xs py-1 px-3">
              {selectedColLabel}
            </Badge>
            {selectedMember !== 'all' && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Single Member Focus
              </Badge>
            )}
          </div>
          <Badge variant="outline" className="bg-white border-slate-200">
            {ledgerData.length} Postings Found
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-4">Date</TableHead>
                <TableHead className="py-4">Member ID</TableHead>
                <TableHead className="py-4">Particulars</TableHead>
                <TableHead className="text-right py-4">Debit (৳)</TableHead>
                <TableHead className="text-right py-4">Credit (৳)</TableHead>
                <TableHead className="text-right py-4">Running Balance (৳)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : ledgerData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-16 text-muted-foreground italic">No subsidiary entries found for this criteria.</TableCell></TableRow>
              ) : ledgerData.map((item, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="font-mono text-xs font-bold text-slate-600 p-4">{item.date}</td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900">{item.memberId}</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{item.memberName}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-medium text-slate-700">{item.particulars}</span>
                  </td>
                  <td className="text-right font-medium p-4 text-blue-600">
                    {item.debit > 0 ? `৳ ${item.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                  </td>
                  <td className="text-right font-medium p-4 text-rose-600">
                    {item.credit > 0 ? `৳ ${item.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                  </td>
                  <td className="text-right font-black text-slate-900 p-4 bg-slate-50/50 group-hover:bg-primary/5 transition-colors">
                    ৳ {item.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-100/80 font-black">
              <TableRow>
                <TableCell colSpan={3} className="text-right uppercase text-[9px]">Closing Subsidiary Position:</TableCell>
                <TableCell className="text-right text-[10px] text-blue-700">
                  ৳ {ledgerData.reduce((s, r) => s + r.debit, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-[10px] text-rose-700">
                  ৳ {ledgerData.reduce((s, r) => s + r.credit, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-base text-primary underline decoration-double">
                  ৳ {ledgerData[ledgerData.length - 1]?.balance.toLocaleString() || "0.00"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
