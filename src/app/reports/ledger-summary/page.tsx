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
  Search,
  ArrowRightLeft,
  ClipboardCheck,
  FileStack,
  Activity,
  ArrowRight,
  TrendingUp,
  ShieldCheck
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function LedgerSummaryReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  // Date Logic for default FY
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
  const today = now.toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ start: fyStart, end: today });
  const [asOfDate, setAsOfDate] = useState(today);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("matrix");

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  // --- DATA FOR 11-COLUMN MATRIX ---
  const matrixData = useMemo(() => {
    if (!members || !allSummaries) return [];
    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end).getTime();

    return members.map(member => {
      const memberSummaries = allSummaries.filter(s => s.memberId === member.id);
      const colKeys = ['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'];
      const stats: Record<string, { opening: number, period: number, closing: number }> = {};
      colKeys.forEach(k => stats[k] = { opening: 0, period: 0, closing: 0 });

      memberSummaries.forEach(s => {
        const entryDate = new Date(s.summaryDate).getTime();
        const vals = { 
          c1: Number(s.employeeContribution)||0, 
          c2: Number(s.loanWithdrawal)||0, 
          c3: Number(s.loanRepayment)||0, 
          c5: Number(s.profitEmployee)||0, 
          c6: Number(s.profitLoan)||0, 
          c8: Number(s.pbsContribution)||0, 
          c9: Number(s.profitPbs)||0 
        };
        if (entryDate < start) colKeys.forEach(k => stats[k].opening += (vals as any)[k]);
        else if (entryDate <= end) colKeys.forEach(k => stats[k].period += (vals as any)[k]);
      });

      colKeys.forEach(k => stats[k].closing = stats[k].opening + stats[k].period);
      const openingCol11 = stats.c1.opening - stats.c2.opening + stats.c3.opening + stats.c5.opening + stats.c6.opening + stats.c8.opening + stats.c9.opening;
      const periodCol11 = stats.c1.period - stats.c2.period + stats.c3.period + stats.c5.period + stats.c6.period + stats.c8.period + stats.c9.period;
      const closingCol11 = openingCol11 + periodCol11;

      return { memberId: member.id, memberIdNumber: member.memberIdNumber, name: member.name, designation: member.designation, stats, total: { opening: openingCol11, period: periodCol11, closing: closingCol11 } };
    })
    .filter(row => row.name.toLowerCase().includes(search.toLowerCase()) || row.memberIdNumber?.includes(search))
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, dateRange, search]);

  const matrixTotals = useMemo(() => {
    const res: any = { stats: {}, total: { opening: 0, period: 0, closing: 0 } };
    ['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'].forEach(k => res.stats[k] = { opening: 0, period: 0, closing: 0 });
    matrixData.forEach(row => {
      Object.keys(row.stats).forEach(k => { res.stats[k].opening += row.stats[k].opening; res.stats[k].period += row.stats[k].period; res.stats[k].closing += row.stats[k].closing; });
      res.total.opening += row.total.opening; res.total.period += row.total.period; res.total.closing += row.total.closing;
    });
    return res;
  }, [matrixData]);

  // --- DATA FOR NETFUND STATEMENT ---
  const netfundData = useMemo(() => {
    if (!members || !allSummaries) return [];
    const cutOff = new Date(asOfDate).getTime();

    return members.map(member => {
      const memberSummaries = allSummaries.filter(s => 
        s.memberId === member.id && 
        new Date(s.summaryDate).getTime() <= cutOff
      );
      
      let col1 = 0, col2 = 0, col3 = 0, col5 = 0, col6 = 0, col8 = 0, col9 = 0;
      memberSummaries.forEach(s => {
        col1 += Number(s.employeeContribution) || 0;
        col2 += Number(s.loanWithdrawal) || 0;
        col3 += Number(s.loanRepayment) || 0;
        col5 += Number(s.profitEmployee) || 0;
        col6 += Number(s.profitLoan) || 0;
        col8 += Number(s.pbsContribution) || 0;
        col9 += Number(s.profitPbs) || 0;
      });

      const loanBalance = col2 - col3;
      const netEmpFund = col1 - col2 + col3 + col5 + col6;
      const netOfficeFund = col8 + col9;
      const totalNetFund = netEmpFund + netOfficeFund;

      return {
        id: member.id,
        memberIdNumber: member.memberIdNumber,
        name: member.name,
        designation: member.designation,
        col4: loanBalance, col7: netEmpFund, col10: netOfficeFund, col11: totalNetFund
      };
    })
    .filter(row => row.name.toLowerCase().includes(search.toLowerCase()) || row.memberIdNumber?.includes(search))
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, asOfDate, search]);

  const netfundStats = useMemo(() => {
    return netfundData.reduce((acc, curr) => ({
      empFund: acc.empFund + curr.col7,
      officeFund: acc.officeFund + curr.col10,
      loans: acc.loans + curr.col4,
      total: acc.total + curr.col11,
    }), { empFund: 0, officeFund: 0, loans: 0, total: 0 });
  }, [netfundData]);

  // --- DATA FOR FUND MOVEMENT ---
  const movementData = useMemo(() => {
    if (!members || !allSummaries) return [];
    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end).getTime();

    return members.map(member => {
      const memberSummaries = allSummaries.filter(s => s.memberId === member.id);
      let opEmp = 0, opPbs = 0, addEmp = 0, adjEmp = 0, addPbs = 0, adjPbs = 0;

      memberSummaries.forEach(s => {
        const entryDate = new Date(s.summaryDate).getTime();
        const v = { c1: Number(s.employeeContribution)||0, c2: Number(s.loanWithdrawal)||0, c3: Number(s.loanRepayment)||0, c5: Number(s.profitEmployee)||0, c6: Number(s.profitLoan)||0, c8: Number(s.pbsContribution)||0, c9: Number(s.profitPbs)||0 };
        if (entryDate < start) { opEmp += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6); opPbs += (v.c8 + v.c9); }
        else if (entryDate <= end) { addEmp += v.c1; adjEmp += (v.c5 + v.c6 + (v.c3 - v.c2)); addPbs += v.c8; adjPbs += v.c9; }
      });

      return { memberIdNumber: member.memberIdNumber, name: member.name, opEmp, addEmp, adjEmp, clEmp: opEmp+addEmp+adjEmp, opPbs, addPbs, adjPbs, clPbs: opPbs+addPbs+adjPbs, total: (opEmp+addEmp+adjEmp)+(opPbs+addPbs+adjPbs) };
    })
    .filter(row => row.name.toLowerCase().includes(search.toLowerCase()) || row.memberIdNumber?.includes(search))
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, dateRange, search]);

  const movementStats = useMemo(() => movementData.reduce((acc, c) => ({ op: acc.op+c.opEmp+c.opPbs, cl: acc.cl+c.total }), { op: 0, cl: 0 }), [movementData]);

  const exportToExcel = () => {
    let dataToExport = [];
    let fileName = "Report";
    if (activeTab === "matrix") {
      dataToExport = matrixData.map(r => ({ "ID No": r.memberIdNumber, "Name": r.name, "Total Opening": r.total.opening, "Total Period": r.total.period, "Total Closing": r.total.closing }));
      fileName = "Ledger_Matrix";
    } else if (activeTab === "netfund") {
      dataToExport = netfundData.map(r => ({ "ID No": r.memberIdNumber, "Name": r.name, "Loan Bal": r.col4, "Emp Fund": r.col7, "Office Fund": r.col10, "Total Netfund": r.col11 }));
      fileName = "Netfund_Statement";
    } else {
      dataToExport = movementData.map(r => ({ "ID No": r.memberIdNumber, "Name": r.name, "Emp Closing": r.clEmp, "PBS Closing": r.clPbs, "Grand Total": r.total }));
      fileName = "Fund_Movement";
    }
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const ColumnGroupHead = ({ title, colSpan = 3, className }: { title: string, colSpan?: number, className?: string }) => (
    <TableHead colSpan={colSpan} className={cn("text-center border-x border-black/10 font-bold uppercase text-[10px] py-2", className)}>{title}</TableHead>
  );

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <ClipboardCheck className="size-8 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-primary tracking-tight">Ledger Summary & Statements</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Consolidated Subsidiary Reports • Dual-View institutional auditing</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border shadow-sm">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input 
              className="pl-7 h-8 text-xs bg-slate-50 border-none" 
              placeholder="Search ID/Name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel} className="gap-2 h-9 font-bold text-xs">
              <FileSpreadsheet className="size-4" /> Export
            </Button>
            <Button onClick={() => window.print()} className="gap-2 h-9 font-bold text-xs shadow-lg shadow-primary/20">
              <Printer className="size-4" /> Print
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white p-1 rounded-xl border shadow-sm mb-8 no-print h-12">
          <TabsTrigger value="matrix" className="px-6 py-2 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <ClipboardCheck className="size-4" /> Ledger Matrix
          </TabsTrigger>
          <TabsTrigger value="netfund" className="px-6 py-2 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <FileStack className="size-4" /> Netfund Statement
          </TabsTrigger>
          <TabsTrigger value="movements" className="px-6 py-2 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Activity className="size-4" /> Fund Movement
          </TabsTrigger>
        </TabsList>

        {/* --- 11-COLUMN MATRIX CONTENT --- */}
        <TabsContent value="matrix" className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-6 no-print">
            <div className="flex items-center gap-3">
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-bold text-slate-400">Date From</Label>
                <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-none shadow-none font-bold" />
              </div>
              <ArrowRightLeft className="size-3 text-slate-300 mt-3" />
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-bold text-slate-400">Date To</Label>
                <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-none shadow-none font-bold" />
              </div>
            </div>
            <div className="h-8 w-px bg-slate-100" />
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Matrix Logic: Opening Balance + Period Activity = Closing Balance</p>
          </div>

          <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
            <div className="overflow-x-auto">
              <Table className="min-w-[2200px] border-collapse">
                <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b-2">
                  <TableRow className="bg-muted/50">
                    <TableHead rowSpan={2} className="w-[60px] sticky left-0 bg-white border-r border-b z-40">ID No</TableHead>
                    <TableHead rowSpan={2} className="w-[180px] sticky left-[60px] bg-white border-r border-b z-40">Name</TableHead>
                    <ColumnGroupHead title="Emp. Contrib (Col 1)" className="bg-blue-50/30" />
                    <ColumnGroupHead title="Loan Withdraw (Col 2)" className="bg-rose-50/30" />
                    <ColumnGroupHead title="Loan Repay (Col 3)" className="bg-emerald-50/30" />
                    <ColumnGroupHead title="Profit Emp (Col 5)" className="bg-amber-50/30" />
                    <ColumnGroupHead title="Profit Loan (Col 6)" className="bg-amber-50/30" />
                    <ColumnGroupHead title="PBS Contrib (Col 8)" className="bg-slate-50" />
                    <ColumnGroupHead title="Profit PBS (Col 9)" className="bg-amber-50/30" />
                    <ColumnGroupHead title="Grand Cumulative (Col 11)" className="bg-primary/5" />
                  </TableRow>
                  <TableRow className="bg-slate-50/50 text-[8px] uppercase font-bold">
                    {[1,2,3,5,6,8,9,11].map(i => (
                      <React.Fragment key={i}>
                        <TableHead className="text-right px-1 border-l">Opening</TableHead>
                        <TableHead className="text-right px-1 text-primary">Period</TableHead>
                        <TableHead className="text-right px-1 font-black bg-slate-100/50">Closing</TableHead>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(isMembersLoading || isSummariesLoading) ? <TableRow><TableCell colSpan={26} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto" /></TableCell></TableRow> : matrixData.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 text-[10px]">
                      <td className="font-mono font-bold p-2 sticky left-0 bg-white border-r z-10">{row.memberIdNumber}</td>
                      <td className="p-2 font-medium sticky left-[60px] bg-white border-r z-10 truncate">{row.name}</td>
                      {['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'].map(k => (
                        <React.Fragment key={k}>
                          <td className="text-right p-2 border-l text-slate-400">{row.stats[k].opening.toLocaleString()}</td>
                          <td className="text-right p-2 text-primary">{row.stats[k].period.toLocaleString()}</td>
                          <td className="text-right p-2 font-bold bg-slate-50/50">{row.stats[k].closing.toLocaleString()}</td>
                        </React.Fragment>
                      ))}
                      <td className="text-right p-2 border-l text-slate-400 bg-primary/5">{row.total.opening.toLocaleString()}</td>
                      <td className="text-right p-2 text-primary font-bold bg-primary/5">{row.total.period.toLocaleString()}</td>
                      <td className="text-right p-2 font-black bg-slate-100">{row.total.closing.toLocaleString()}</td>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="sticky bottom-0 bg-slate-100 z-30 font-black border-t-2">
                  <TableRow>
                    <TableCell colSpan={2} className="sticky left-0 bg-slate-100 z-40 border-r text-right uppercase text-[9px]">Grand Totals:</TableCell>
                    {['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'].map(k => (
                      <React.Fragment key={k}>
                        <TableCell className="text-right p-2 text-[9px]">{matrixTotals.stats[k].opening.toLocaleString()}</TableCell>
                        <TableCell className="text-right p-2 text-[9px] text-primary">{matrixTotals.stats[k].period.toLocaleString()}</TableCell>
                        <TableCell className="text-right p-2 text-[9px] bg-slate-200/50">{matrixTotals.stats[k].closing.toLocaleString()}</TableCell>
                      </React.Fragment>
                    ))}
                    <TableCell className="text-right p-2 text-[9px] bg-primary/10">{matrixTotals.total.opening.toLocaleString()}</TableCell>
                    <TableCell className="text-right p-2 text-[9px] text-primary bg-primary/10">{matrixTotals.total.period.toLocaleString()}</TableCell>
                    <TableCell className="text-right p-2 text-xs bg-slate-200 underline decoration-double">৳ {matrixTotals.total.closing.toLocaleString()}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* --- NETFUND STATEMENT CONTENT --- */}
        <TabsContent value="netfund" className="space-y-6 animate-in fade-in duration-500">
          <div className="grid gap-6 md:grid-cols-4 no-print">
            <Card className="border-none shadow-sm bg-slate-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Aggregate Emp Fund</CardTitle>
              </CardHeader>
              <CardContent><div className="text-xl font-bold">৳ {netfundStats.empFund.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase text-blue-600 tracking-widest">Aggregate Office Fund</CardTitle>
              </CardHeader>
              <CardContent><div className="text-xl font-bold">৳ {netfundStats.officeFund.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-rose-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase text-rose-600 tracking-widest">Total Outstanding Loans</CardTitle>
              </CardHeader>
              <CardContent><div className="text-xl font-bold">৳ {netfundStats.loans.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-primary text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase text-primary-foreground/70 tracking-widest">Institutional Netfund</CardTitle>
              </CardHeader>
              <CardContent><div className="text-xl font-bold">৳ {netfundStats.total.toLocaleString()}</div></CardContent>
            </Card>
          </div>

          <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4 no-print">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-bold text-slate-400">Statement As Of</Label>
              <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-8 text-xs border-none shadow-none font-bold p-0 focus-visible:ring-0" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-4">ID No</TableHead>
                  <TableHead className="py-4">Member Name</TableHead>
                  <TableHead className="text-right py-4">Loan Bal (Col 4)</TableHead>
                  <TableHead className="text-right py-4">Net Emp Fund (Col 7)</TableHead>
                  <TableHead className="text-right py-4">Net Office Fund (Col 10)</TableHead>
                  <TableHead className="text-right py-4">Total Netfund (Col 11)</TableHead>
                  <TableHead className="text-center py-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isMembersLoading || isSummariesLoading) ? <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="animate-spin size-6 mx-auto" /></TableCell></TableRow> : netfundData.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50">
                    <td className="font-mono text-xs font-bold p-4">{row.memberIdNumber}</td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{row.name}</span>
                        <span className="text-[9px] uppercase opacity-60">{row.designation}</span>
                      </div>
                    </td>
                    <td className="text-right p-4">৳ {row.col4.toLocaleString()}</td>
                    <td className="text-right p-4">৳ {row.col7.toLocaleString()}</td>
                    <td className="text-right p-4">৳ {row.col10.toLocaleString()}</td>
                    <td className="text-right p-4 font-black text-primary">৳ {row.col11.toLocaleString()}</td>
                    <td className="text-center p-4"><Button variant="ghost" size="icon" asChild><Link href={`/members/${row.id}`}><ArrowRight className="size-4" /></Link></Button></td>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="font-black">
                <TableRow>
                  <TableCell colSpan={2} className="text-right">GRAND TOTALS:</TableCell>
                  <TableCell className="text-right">৳ {netfundStats.loans.toLocaleString()}</TableCell>
                  <TableCell className="text-right">৳ {netfundStats.empFund.toLocaleString()}</TableCell>
                  <TableCell className="text-right">৳ {netfundStats.officeFund.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-primary text-base">৳ {netfundStats.total.toLocaleString()}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </TabsContent>

        {/* --- FUND MOVEMENT CONTENT --- */}
        <TabsContent value="movements" className="space-y-6 animate-in fade-in duration-500">
          <div className="grid gap-6 md:grid-cols-2 no-print">
            <Card className="bg-slate-50"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-slate-500">Opening (All Fund)</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">৳ {movementStats.op.toLocaleString()}</div></CardContent></Card>
            <Card className="bg-slate-900 text-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase text-slate-400">Closing (Institutional)</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">৳ {movementStats.cl.toLocaleString()}</div></CardContent></Card>
          </div>

          <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Member ID</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Emp Opening</TableHead><TableHead className="text-right">Emp Add</TableHead><TableHead className="text-right">Emp Adj</TableHead><TableHead className="text-right font-bold">Emp Closing</TableHead><TableHead className="text-right">PBS Opening</TableHead><TableHead className="text-right">PBS Add</TableHead><TableHead className="text-right">PBS Adj</TableHead><TableHead className="text-right font-bold">PBS Closing</TableHead><TableHead className="text-right font-black">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isMembersLoading || isSummariesLoading) ? <TableRow><TableCell colSpan={11} className="text-center py-12"><Loader2 className="animate-spin size-6 mx-auto" /></TableCell></TableRow> : movementData.map((row, idx) => (
                  <TableRow key={idx} className="text-[11px]">
                    <td className="font-mono font-bold p-4">{row.memberIdNumber}</td><td className="p-4 truncate">{row.name}</td>
                    <td className="text-right p-4 text-slate-400">{row.opEmp.toLocaleString()}</td><td className="text-right p-4">{row.addEmp.toLocaleString()}</td><td className="text-right p-4 text-orange-600">{row.adjEmp.toLocaleString()}</td><td className="text-right p-4 font-bold">৳ {row.clEmp.toLocaleString()}</td>
                    <td className="text-right p-4 text-slate-400">{row.opPbs.toLocaleString()}</td><td className="text-right p-4">{row.addPbs.toLocaleString()}</td><td className="text-right p-4 text-emerald-600">{row.adjPbs.toLocaleString()}</td><td className="text-right p-4 font-bold">৳ {row.clPbs.toLocaleString()}</td>
                    <td className="text-right p-4 font-black text-primary">৳ {row.total.toLocaleString()}</td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-auto pt-8 border-t no-print flex justify-between items-center text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-50">
        <span>CPF Management Software</span>
        <span className="italic">Developed by: Ariful Islam,AGMF,Gazipur PBS-2</span>
      </div>

      {/* --- PRINT CONTAINER --- */}
      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <h2 className="text-lg font-bold underline underline-offset-4 uppercase">
            {activeTab === 'matrix' ? 'Ledger Summary Matrix' : activeTab === 'netfund' ? 'Statement of Members Netfund Balances' : 'Fund Movement Audit Report'}
          </h2>
          <div className="flex justify-between text-[10px] font-bold pt-4">
            <span>Period: {activeTab === 'netfund' ? `As Of ${asOfDate}` : `${dateRange.start} to ${dateRange.end}`}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        {activeTab === 'matrix' && (
          <table className="w-full text-[7px] border-collapse border border-black">
            <thead>
              <tr className="bg-slate-50 font-bold">
                <th className="border border-black p-1">ID No</th>
                <th className="border border-black p-1 text-left">Member Name</th>
                <th className="border border-black p-1 text-right">Col 1</th>
                <th className="border border-black p-1 text-right">Col 2</th>
                <th className="border border-black p-1 text-right">Col 3</th>
                <th className="border border-black p-1 text-right">Col 5</th>
                <th className="border border-black p-1 text-right">Col 6</th>
                <th className="border border-black p-1 text-right">Col 8</th>
                <th className="border border-black p-1 text-right">Col 9</th>
                <th className="border border-black p-1 text-right font-black">Col 11 (Final)</th>
              </tr>
            </thead>
            <tbody>
              {matrixData.map((row, i) => (
                <tr key={i}>
                  <td className="border border-black p-1 text-center">{row.memberIdNumber}</td>
                  <td className="border border-black p-1">{row.name}</td>
                  <td className="border border-black p-1 text-right">{row.stats.c1.closing.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.stats.c2.closing.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.stats.c3.closing.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.stats.c5.closing.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.stats.c6.closing.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.stats.c8.closing.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right">{row.stats.c9.closing.toLocaleString()}</td>
                  <td className="border border-black p-1 text-right font-bold">{row.total.closing.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'netfund' && (
          <table className="w-full text-[9px] border-collapse border border-black">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-black p-2 text-center">ID No</th>
                <th className="border border-black p-2 text-left">Member Name</th>
                <th className="border border-black p-2 text-right">Loan Bal</th>
                <th className="border border-black p-2 text-right">Net Emp Fund</th>
                <th className="border border-black p-2 text-right">Net Office Fund</th>
                <th className="border border-black p-2 text-right font-black">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {netfundData.map((row, i) => (
                <tr key={i}>
                  <td className="border border-black p-2 text-center font-mono">{row.memberIdNumber}</td>
                  <td className="border border-black p-2">{row.name}</td>
                  <td className="border border-black p-2 text-right">{row.col4.toLocaleString()}</td>
                  <td className="border border-black p-2 text-right">{row.col7.toLocaleString()}</td>
                  <td className="border border-black p-2 text-right">{row.col10.toLocaleString()}</td>
                  <td className="border border-black p-2 text-right font-black">{row.col11.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
          <div className="border-t border-black pt-2">Accountant / AGM(F)</div>
          <div className="border-t border-black pt-2">Internal Auditor / DGM</div>
          <div className="border-t border-black pt-2">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
