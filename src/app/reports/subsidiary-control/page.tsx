
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
  ArrowRightLeft,
  LayoutList,
  User,
  Tags,
  CalendarDays,
  FileStack,
  Search,
  BookOpenCheck
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [viewMode, setViewMode] = useState<"ledger" | "institutional" | "daily">("ledger");
  const [searchFilter, setSearchFilter] = useState("");

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading } = useCollection(summariesRef);

  // VIEW 1: CATEGORY LEDGER (Transaction level for one column)
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

  // VIEW 2: INSTITUTIONAL TOTAL FUND LEDGER (Consolidated sequential ledger)
  const institutionalLedger = useMemo(() => {
    if (!allSummaries) return [];

    const filtered = allSummaries
      .map(s => {
        const member = members?.find(m => m.id === s.memberId);
        const c1 = Number(s.employeeContribution) || 0;
        const c2 = Number(s.loanWithdrawal) || 0;
        const c3 = Number(s.loanRepayment) || 0;
        const c5 = Number(s.profitEmployee) || 0;
        const c6 = Number(s.profitLoan) || 0;
        const c8 = Number(s.pbsContribution) || 0;
        const c9 = Number(s.profitPbs) || 0;

        // Total Fund Logic: Net increase in Liability/Equity
        // Credits (Increases fund): c1, c3, c5, c6, c8, c9
        // Debits (Decreases fund): c2 (Loan withdrawal)
        const netCreditEffect = (c1 + c3 + c5 + c6 + c8 + c9) - c2;

        if (Math.abs(netCreditEffect) < 0.01) return null;

        return {
          date: s.summaryDate,
          memberId: member?.memberIdNumber || "N/A",
          memberName: member?.name || "Unknown",
          particulars: `${s.particulars || 'Record'} (${member?.memberIdNumber || 'Global'})`,
          debit: netCreditEffect < 0 ? Math.abs(netCreditEffect) : 0,
          credit: netCreditEffect > 0 ? netCreditEffect : 0,
          timestamp: new Date(s.summaryDate).getTime()
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.timestamp - b.timestamp);

    let processed = filtered;
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      processed = filtered.filter(item => item.timestamp >= s && item.timestamp <= e);
    }

    if (searchFilter) {
      processed = processed.filter(item => 
        item.particulars.toLowerCase().includes(searchFilter.toLowerCase()) || 
        item.memberName.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }

    let runningBalance = 0;
    return processed.map(item => {
      runningBalance += (item.credit - item.debit);
      return { ...item, balance: runningBalance };
    });
  }, [allSummaries, members, dateRange, searchFilter]);

  // VIEW 3: DAILY CONSOLIDATED SUMMARY
  const dailySummaryData = useMemo(() => {
    if (!allSummaries) return [];

    const grouped: Record<string, any> = {};
    
    allSummaries.forEach(s => {
      const date = s.summaryDate;
      if (!grouped[date]) {
        grouped[date] = {
          date,
          timestamp: new Date(date).getTime(),
          c1: 0, c2: 0, c3: 0, c5: 0, c6: 0, c8: 0, c9: 0,
          totalDr: 0, totalCr: 0
        };
      }
      
      const v1 = Number(s.employeeContribution) || 0;
      const v2 = Number(s.loanWithdrawal) || 0;
      const v3 = Number(s.loanRepayment) || 0;
      const v5 = Number(s.profitEmployee) || 0;
      const v6 = Number(s.profitLoan) || 0;
      const v8 = Number(s.pbsContribution) || 0;
      const v9 = Number(s.profitPbs) || 0;

      grouped[date].c1 += v1;
      grouped[date].c2 += v2;
      grouped[date].c3 += v3;
      grouped[date].c5 += v5;
      grouped[date].c6 += v6;
      grouped[date].c8 += v8;
      grouped[date].c9 += v9;

      grouped[date].totalDr += (v2 > 0 ? v2 : 0) + [v1, v3, v5, v6, v8, v9].reduce((sum, v) => sum + (v < 0 ? Math.abs(v) : 0), 0);
      grouped[date].totalCr += (v2 < 0 ? Math.abs(v2) : 0) + [v1, v3, v5, v6, v8, v9].reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
    });

    const sorted = Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);

    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      return sorted.filter((item: any) => item.timestamp >= s && item.timestamp <= e);
    }

    return sorted;
  }, [allSummaries, dateRange]);

  const exportToExcel = () => {
    let dataToExport: any[] = [];
    if (viewMode === 'ledger') dataToExport = ledgerData;
    else if (viewMode === 'institutional') dataToExport = institutionalLedger;
    else dataToExport = dailySummaryData;

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, viewMode);
    XLSX.writeFile(wb, `Subsidiary_Control_${viewMode}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Exported", description: "Audit data saved to Excel." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <LayoutList className="size-8 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-primary tracking-tight">Subsidiary Control</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Institutional audit of member fund categories</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-10 font-bold">
            <FileSpreadsheet className="size-4" /> Excel Export
          </Button>
          <Button onClick={() => window.print()} className="gap-2 h-10 font-bold shadow-lg shadow-primary/20">
            <Printer className="size-4" /> Print Matrix
          </Button>
        </div>
      </div>

      <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-full">
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col gap-6 no-print mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <TabsList className="bg-slate-100 p-1 h-11">
              <TabsTrigger value="institutional" className="gap-2 px-6"><BookOpenCheck className="size-4" /> Institutional Ledger</TabsTrigger>
              <TabsTrigger value="ledger" className="gap-2 px-6"><Tags className="size-4" /> Category Ledger</TabsTrigger>
              <TabsTrigger value="daily" className="gap-2 px-6"><CalendarDays className="size-4" /> Daily Summary</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-3">
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-bold text-slate-400">Date From</Label>
                <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-9 text-xs border-slate-200 font-bold" />
              </div>
              <ArrowRightLeft className="size-3 text-slate-300 mt-4" />
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-bold text-slate-400">Date To</Label>
                <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-9 text-xs border-slate-200 font-bold" />
              </div>
            </div>
          </div>

          {viewMode === 'ledger' && (
            <div className="grid gap-6 md:grid-cols-2 border-t pt-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-400 ml-1 flex items-center gap-2">
                  <Tags className="size-3" /> Ledger Column Category
                </Label>
                <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                  <SelectTrigger className="h-11 font-bold border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBSIDIARY_COLUMNS.map(col => (
                      <SelectItem key={col.key} value={col.key} className="py-2">{col.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-400 ml-1 flex items-center gap-2">
                  <User className="size-3" /> Member Filtering
                </Label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger className="h-11 font-bold border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Institutional Personnel</SelectItem>
                    {members?.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.memberIdNumber} - {m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {viewMode === 'institutional' && (
            <div className="border-t pt-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  className="pl-9" 
                  placeholder="Search transactions or members..." 
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <TabsContent value="institutional">
          <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-bold">Institutional Total Fund Control Ledger</h2>
              <Badge variant="outline" className="bg-white border-slate-200">
                {institutionalLedger.length} Movements Traceable
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="py-4">Date</TableHead>
                    <TableHead className="py-4">Particulars & Audit Trail</TableHead>
                    <TableHead className="text-right py-4">Debit (৳)</TableHead>
                    <TableHead className="text-right py-4">Credit (৳)</TableHead>
                    <TableHead className="text-right py-4">Running Balance (৳)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : institutionalLedger.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-16 text-muted-foreground italic">No fund movements identified.</TableCell></TableRow>
                  ) : institutionalLedger.map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="font-mono text-xs font-bold text-slate-600 p-4">{item.date}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">{item.particulars}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{item.memberName}</span>
                        </div>
                      </td>
                      <td className="text-right font-medium p-4 text-rose-600">
                        {item.debit > 0 ? `৳ ${item.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}
                      </td>
                      <td className="text-right font-medium p-4 text-emerald-600">
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
                    <TableCell colSpan={2} className="text-right uppercase text-[9px]">Closing Control Balance:</TableCell>
                    <TableCell className="text-right text-[10px] text-rose-700">
                      ৳ {institutionalLedger.reduce((s, r) => s + r.debit, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[10px] text-emerald-700">
                      ৳ {institutionalLedger.reduce((s, r) => s + r.credit, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-base text-primary underline decoration-double">
                      ৳ {institutionalLedger[institutionalLedger.length - 1]?.balance.toLocaleString() || "0.00"}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-bold">{SUBSIDIARY_COLUMNS.find(c => c.key === selectedColumn)?.label}</h2>
              <Badge variant="outline" className="bg-white border-slate-200">
                {ledgerData.length} Postings
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
                    <TableRow><TableCell colSpan={6} className="text-center py-16 text-muted-foreground italic">No entries match your filter.</TableCell></TableRow>
                  ) : ledgerData.map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="font-mono text-xs font-bold text-slate-600 p-4">{item.date}</td>
                      <td className="p-4"><span className="text-xs font-bold text-slate-900">{item.memberId}</span></td>
                      <td className="p-4 text-xs font-medium text-slate-700">{item.particulars}</td>
                      <td className="text-right font-medium p-4 text-blue-600">{item.debit > 0 ? `৳ ${item.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}</td>
                      <td className="text-right font-medium p-4 text-rose-600">{item.credit > 0 ? `৳ ${item.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "-"}</td>
                      <td className="text-right font-black text-slate-900 p-4 bg-slate-50/50 group-hover:bg-primary/5 transition-colors">৳ {item.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-slate-100/80 font-black">
                  <TableRow>
                    <TableCell colSpan={3} className="text-right uppercase text-[9px]">Closing:</TableCell>
                    <TableCell className="text-right text-[10px]">{ledgerData.reduce((s, r) => s + r.debit, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-[10px]">{ledgerData.reduce((s, r) => s + r.credit, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-base text-primary underline decoration-double">৳ {ledgerData[ledgerData.length - 1]?.balance.toLocaleString() || "0.00"}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="daily">
          <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-bold">Consolidated Daily Audit Summary</h2>
              <Badge variant="outline" className="bg-white border-slate-200">{dailySummaryData.length} Active Dates</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="py-4">Date</TableHead>
                    <TableHead className="text-right py-4">Col 1</TableHead>
                    <TableHead className="text-right py-4">Col 2</TableHead>
                    <TableHead className="text-right py-4">Col 3</TableHead>
                    <TableHead className="text-right py-4">Col 5</TableHead>
                    <TableHead className="text-right py-4">Col 6</TableHead>
                    <TableHead className="text-right py-4">Col 8</TableHead>
                    <TableHead className="text-right py-4">Col 9</TableHead>
                    <TableHead className="text-right py-4 font-bold bg-blue-50/30">Total Daily Dr</TableHead>
                    <TableHead className="text-right py-4 font-bold bg-emerald-50/30">Total Daily Cr</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySummaryData.map((item: any, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="font-mono text-xs font-bold text-slate-600 p-4">{item.date}</td>
                      <td className="text-right p-4 text-[11px]">{item.c1.toLocaleString()}</td>
                      <td className="text-right p-4 text-[11px] text-rose-600">{item.c2.toLocaleString()}</td>
                      <td className="text-right p-4 text-[11px] text-emerald-600">{item.c3.toLocaleString()}</td>
                      <td className="text-right p-4 text-[11px]">{item.c5.toLocaleString()}</td>
                      <td className="text-right p-4 text-[11px]">{item.c6.toLocaleString()}</td>
                      <td className="text-right p-4 text-[11px]">{item.c8.toLocaleString()}</td>
                      <td className="text-right p-4 text-[11px]">{item.c9.toLocaleString()}</td>
                      <td className="text-right p-4 font-bold">৳ {item.totalDr.toLocaleString()}</td>
                      <td className="text-right p-4 font-bold text-primary">৳ {item.totalCr.toLocaleString()}</td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Institutional Landscape Print View */}
      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">Gazipur Palli Bidyut Samity-2</h1>
          <h2 className="text-lg font-bold underline underline-offset-4 uppercase">Subsidiary Control Ledger Statement</h2>
          <div className="flex justify-between text-[10px] font-bold pt-4">
            <div className="text-left">
              <p>Report Type: {viewMode === 'institutional' ? 'Total Fund Control' : viewMode === 'ledger' ? `Category: ${SUBSIDIARY_COLUMNS.find(c => c.key === selectedColumn)?.label}` : 'Daily Audit'}</p>
              <p>Period: {dateRange.start || "Beginning"} to {dateRange.end || "Present"}</p>
            </div>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[9px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-2 text-center w-[80px]">Date</th>
              <th className="border border-black p-2 text-left">Particulars & Audit Trail</th>
              <th className="border border-black p-2 text-right">Debit (৳)</th>
              <th className="border border-black p-2 text-right">Credit (৳)</th>
              <th className="border border-black p-2 text-right">Balance (৳)</th>
            </tr>
          </thead>
          <tbody>
            {(viewMode === 'institutional' ? institutionalLedger : ledgerData).map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black p-2 text-center font-mono">{item.date}</td>
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
    </div>
  );
}
