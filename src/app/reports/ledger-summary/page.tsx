
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

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [asOfDate, setAsOfDate] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("matrix");

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setDateRange({ start: fyStart, end: today });
    setAsOfDate(today);
  }, []);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const matrixData = useMemo(() => {
    if (!members || !allSummaries || !dateRange.start) return [];
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
      
      const openingCol7 = stats.c1.opening - stats.c2.opening + stats.c3.opening + stats.c5.opening + stats.c6.opening;
      const periodCol7 = stats.c1.period - stats.c2.period + stats.c3.period + stats.c5.period + stats.c6.period;
      const closingCol7 = openingCol7 + periodCol7;

      const openingCol11 = openingCol7 + stats.c8.opening + stats.c9.opening;
      const periodCol11 = periodCol7 + stats.c8.period + stats.c9.period;
      const closingCol11 = openingCol11 + periodCol11;

      return { 
        memberId: member.id, 
        memberIdNumber: member.memberIdNumber, 
        name: member.name, 
        designation: member.designation, 
        stats, 
        col7: { opening: openingCol7, period: periodCol7, closing: closingCol7 },
        total: { opening: openingCol11, period: periodCol11, closing: closingCol11 } 
      };
    })
    .filter(row => row.name.toLowerCase().includes(search.toLowerCase()) || row.memberIdNumber?.includes(search))
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, dateRange, search]);

  const matrixTotals = useMemo(() => {
    const res: any = { stats: {}, col7: { opening: 0, period: 0, closing: 0 }, total: { opening: 0, period: 0, closing: 0 } };
    ['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'].forEach(k => res.stats[k] = { opening: 0, period: 0, closing: 0 });
    matrixData.forEach(row => {
      Object.keys(row.stats).forEach(k => { res.stats[k].opening += row.stats[k].opening; res.stats[k].period += row.stats[k].period; res.stats[k].closing += row.stats[k].closing; });
      res.col7.opening += row.col7.opening; res.col7.period += row.col7.period; res.col7.closing += row.col7.closing;
      res.total.opening += row.total.opening; res.total.period += row.total.period; res.total.closing += row.total.closing;
    });
    return res;
  }, [matrixData]);

  const netfundData = useMemo(() => {
    if (!members || !allSummaries || !asOfDate) return [];
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

  const exportToExcel = () => {
    let dataToExport = [];
    let fileName = "Report";
    if (activeTab === "matrix") {
      dataToExport = matrixData.map(r => ({ "ID No": r.memberIdNumber, "Name": r.name, "Total Opening": r.total.opening, "Total Period": r.total.period, "Total Closing": r.total.closing }));
      fileName = "Ledger_Matrix";
    } else if (activeTab === "netfund") {
      dataToExport = netfundData.map(r => ({ "ID No": r.memberIdNumber, "Name": r.name, "Loan Bal": r.col4, "Emp Fund": r.col7, "Office Fund": r.col10, "Total Netfund": r.col11 }));
      fileName = "Netfund_Statement";
    }
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const ColumnGroupHead = ({ title, colSpan = 3, className }: { title: string, colSpan?: number, className?: string }) => (
    <TableHead colSpan={colSpan} className={cn("text-center border-x-2 border-black font-black uppercase text-[10px] py-2 leading-tight text-black", className)}>{title}</TableHead>
  );

  if (isMembersLoading || isSummariesLoading) {
    return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl shadow-lg">
            <ClipboardCheck className="size-8 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Ledger Summary</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Consolidated Trust Balances Audit Trail</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border-2 border-black shadow-xl">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-black" />
            <Input 
              className="pl-8 h-9 text-xs border-black border-2 font-black text-black" 
              placeholder="Search ID/Name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="h-6 w-px bg-black" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel} className="gap-2 h-10 font-black text-xs border-2 border-black uppercase tracking-widest">
              <FileSpreadsheet className="size-4" /> Export
            </Button>
            <Button onClick={() => window.print()} className="gap-2 h-10 font-black text-xs bg-black text-white shadow-lg uppercase tracking-widest">
              <Printer className="size-4" /> Print
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white p-1 rounded-xl border-2 border-black mb-8 no-print h-14 shadow-md">
          <TabsTrigger value="matrix" className="px-8 h-full gap-2 rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-black uppercase text-xs">
            <ClipboardCheck className="size-4" /> Ledger
          </TabsTrigger>
          <TabsTrigger value="netfund" className="px-8 h-full gap-2 rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-black uppercase text-xs">
            <FileStack className="size-4" /> Netfund Statement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white p-4 rounded-xl border-2 border-black flex items-center gap-6 no-print shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-black text-black">Date From</Label>
                <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-black border-2 font-black text-black" />
              </div>
              <ArrowRightLeft className="size-3 text-black mt-3" />
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-black text-black">Date To</Label>
                <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-black border-2 font-black text-black" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-none shadow-2xl border-2 border-black overflow-hidden no-print">
            <div className="overflow-x-auto">
              <Table className="min-w-[2500px] border-collapse text-black font-black">
                <TableHeader className="sticky top-0 bg-white z-30 shadow-md border-b-2 border-black">
                  <TableRow className="bg-slate-100">
                    <TableHead rowSpan={2} className="w-[80px] sticky left-0 bg-white border-r-2 border-black z-40 text-black font-black uppercase tracking-widest p-4">ID No</TableHead>
                    <TableHead rowSpan={2} className="w-[200px] sticky left-[80px] bg-white border-r-2 border-black z-40 text-black font-black uppercase tracking-widest p-4">Member Name</TableHead>
                    <ColumnGroupHead title="Emp. Contribution (Col 1)" />
                    <ColumnGroupHead title="Loan Disburse (Col 2)" />
                    <ColumnGroupHead title="Loan Repayment (Col 3)" />
                    <ColumnGroupHead title="Profit Emp (Col 5)" />
                    <ColumnGroupHead title="Profit Loan (Col 6)" />
                    <ColumnGroupHead title="Net Fund 7=(Pre+1-2+3+5+6)" />
                    <ColumnGroupHead title="PBS Contrib (Col 8)" />
                    <ColumnGroupHead title="Profit PBS (Col 9)" />
                    <ColumnGroupHead title="Total Fund (Col 11=7+10)" />
                  </TableRow>
                  <TableRow className="bg-slate-50 text-[8px] uppercase font-black border-b-2 border-black">
                    {[1,2,3,5,6,7,8,9,11].map(i => (
                      <React.Fragment key={i}>
                        <TableHead className="text-right px-2 border-l border-black text-black">Opening</TableHead>
                        <TableHead className="text-right px-2 text-black border-l border-black">Period</TableHead>
                        <TableHead className="text-right px-2 font-black bg-slate-200 border-l border-black text-black">Closing</TableHead>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="tabular-nums">
                  {matrixData.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-100 border-b border-black text-[11px]">
                      <td className="font-mono font-black p-3 sticky left-0 bg-white border-r-2 border-black z-10 text-black">{row.memberIdNumber}</td>
                      <td className="p-3 font-black sticky left-[80px] bg-white border-r-2 border-black z-10 truncate text-black uppercase">{row.name}</td>
                      {['c1', 'c2', 'c3', 'c5', 'c6'].map(k => (
                        <React.Fragment key={k}>
                          <td className="text-right p-3 border-l border-black text-black">{row.stats[k].opening.toLocaleString()}</td>
                          <td className="text-right p-3 border-l border-black text-black">{row.stats[k].period.toLocaleString()}</td>
                          <td className="text-right p-3 border-l border-black font-black bg-slate-50 text-black">{row.stats[k].closing.toLocaleString()}</td>
                        </React.Fragment>
                      ))}
                      <React.Fragment>
                        <td className="text-right p-3 border-l border-black text-black bg-slate-100">{row.col7.opening.toLocaleString()}</td>
                        <td className="text-right p-3 border-l border-black font-black bg-slate-100 text-black">{row.col7.period.toLocaleString()}</td>
                        <td className="text-right p-3 border-l border-black font-black bg-slate-200 text-black">{row.col7.closing.toLocaleString()}</td>
                      </React.Fragment>
                      {['c8', 'c9'].map(k => (
                        <React.Fragment key={k}>
                          <td className="text-right p-3 border-l border-black text-black">{row.stats[k].opening.toLocaleString()}</td>
                          <td className="text-right p-3 border-l border-black text-black">{row.stats[k].period.toLocaleString()}</td>
                          <td className="text-right p-3 border-l border-black font-black bg-slate-50 text-black">{row.stats[k].closing.toLocaleString()}</td>
                        </React.Fragment>
                      ))}
                      <td className="text-right p-3 border-l border-black text-black bg-slate-100">{row.total.opening.toLocaleString()}</td>
                      <td className="text-right p-3 border-l border-black font-black bg-slate-100 text-black">{row.total.period.toLocaleString()}</td>
                      <td className="text-right p-3 border-l border-black font-black bg-slate-200 text-black text-xs underline decoration-black">{row.total.closing.toLocaleString()}</td>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="sticky bottom-0 bg-slate-100 z-30 font-black border-t-4 border-black text-black">
                  <TableRow className="h-16">
                    <TableCell colSpan={2} className="sticky left-0 bg-slate-100 z-40 border-r-2 border-black text-right uppercase tracking-widest text-[10px] text-black pr-4">Institutional Summary:</TableCell>
                    {['c1', 'c2', 'c3', 'c5', 'c6'].map(k => (
                      <React.Fragment key={k}>
                        <TableCell className="text-right p-3 text-[10px] border-l border-black text-black">{matrixTotals.stats[k].opening.toLocaleString()}</TableCell>
                        <TableCell className="text-right p-3 text-[10px] border-l border-black text-black">{matrixTotals.stats[k].period.toLocaleString()}</TableCell>
                        <TableCell className="text-right p-3 text-[10px] border-l border-black bg-slate-200 text-black">{matrixTotals.stats[k].closing.toLocaleString()}</TableCell>
                      </React.Fragment>
                    ))}
                    <React.Fragment>
                      <TableCell className="text-right p-3 text-[10px] border-l border-black bg-slate-100 text-black">{matrixTotals.col7.opening.toLocaleString()}</TableCell>
                      <TableCell className="text-right p-3 text-[10px] border-l border-black bg-slate-100 text-black">{matrixTotals.col7.period.toLocaleString()}</TableCell>
                      <TableCell className="text-right p-3 text-[10px] border-l border-black bg-slate-200 text-black">{matrixTotals.col7.closing.toLocaleString()}</TableCell>
                    </React.Fragment>
                    {['c8', 'c9'].map(k => (
                      <React.Fragment key={k}>
                        <TableCell className="text-right p-3 text-[10px] border-l border-black text-black">{matrixTotals.stats[k].opening.toLocaleString()}</TableCell>
                        <TableCell className="text-right p-3 text-[10px] border-l border-black text-black">{matrixTotals.stats[k].period.toLocaleString()}</TableCell>
                        <TableCell className="text-right p-3 text-[10px] border-l border-black bg-slate-200 text-black">{matrixTotals.stats[k].closing.toLocaleString()}</TableCell>
                      </React.Fragment>
                    ))}
                    <TableCell className="text-right p-3 text-[10px] border-l border-black bg-slate-100 text-black">{matrixTotals.total.opening.toLocaleString()}</TableCell>
                    <TableCell className="text-right p-3 text-[10px] border-l border-black bg-slate-100 text-black">{matrixTotals.total.period.toLocaleString()}</TableCell>
                    <TableCell className="text-right p-3 text-sm border-l border-black bg-slate-300 underline decoration-double text-black"> {matrixTotals.total.closing.toLocaleString()}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="netfund" className="space-y-6 animate-in fade-in duration-500">
          <div className="grid gap-8 md:grid-cols-4 no-print">
            <Card className="border-2 border-black shadow-lg bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black tracking-widest">Aggregate Emp Fund</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black tabular-nums">{netfundStats.empFund.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="border-2 border-black shadow-lg bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black tracking-widest">Aggregate Office Fund</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black tabular-nums">{netfundStats.officeFund.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="border-2 border-black shadow-lg bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black tracking-widest">Total Loans</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black tabular-nums">{netfundStats.loans.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="border-2 border-black shadow-lg bg-black text-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-white tracking-widest">Total Institutional Netfund</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black tabular-nums">{netfundStats.total.toLocaleString()}</div></CardContent>
            </Card>
          </div>

          <div className="bg-white rounded-none shadow-2xl border-2 border-black overflow-hidden no-print">
            <Table className="text-black font-black border-collapse">
              <TableHeader className="bg-slate-100 border-b-2 border-black">
                <TableRow>
                  <TableHead className="font-black text-black uppercase tracking-widest py-5">ID Number</TableHead>
                  <TableHead className="font-black text-black uppercase tracking-widest py-5">Personnel Metadata</TableHead>
                  <TableHead className="text-right font-black text-black uppercase tracking-widest py-5">Loan Bal (Col 4)</TableHead>
                  <TableHead className="text-right font-black text-black uppercase tracking-widest py-5">Net Fund 7=(Pre+1-2+3+5+6)</TableHead>
                  <TableHead className="text-right font-black text-black uppercase tracking-widest py-5">Net Office (10=8+9)</TableHead>
                  <TableHead className="text-right font-black text-black uppercase tracking-widest py-5 bg-slate-200">Total Fund (Col 11=7+10)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {netfundData.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-100 border-b border-black">
                    <td className="font-mono text-base p-5 border-r border-black">{row.memberIdNumber}</td>
                    <td className="p-5 border-r border-black">
                      <div className="flex flex-col">
                        <span className="uppercase text-sm tracking-tight">{row.name}</span>
                        <span className="text-[10px] uppercase text-black italic tracking-widest">{row.designation}</span>
                      </div>
                    </td>
                    <td className="text-right p-5 border-r border-black">{row.col4.toLocaleString()}</td>
                    <td className="text-right p-5 border-r border-black">{row.col7.toLocaleString()}</td>
                    <td className="text-right p-5 border-r border-black">{row.col10.toLocaleString()}</td>
                    <td className="text-right p-5 bg-slate-50 text-lg underline decoration-black decoration-2"> {row.col11.toLocaleString()}</td>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-slate-100 font-black border-t-2 border-black text-black tabular-nums">
                <TableRow className="h-20">
                  <TableCell colSpan={2} className="text-right uppercase tracking-[0.3em] text-sm">Institutional Aggregates:</TableCell>
                  <TableCell className="text-right border-l border-black">{netfundStats.loans.toLocaleString()}</TableCell>
                  <TableCell className="text-right border-l border-black">{netfundStats.empFund.toLocaleString()}</TableCell>
                  <TableCell className="text-right border-l border-black">{netfundStats.officeFund.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-2xl underline decoration-double bg-slate-200 border-l border-black"> {netfundStats.total.toLocaleString()}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.4em] mt-4">
            {activeTab === 'matrix' ? 'Ledger Summary Matrix Audit' : 'Statement of Members Net Fund Balances'}
          </h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <span className="bg-black text-white px-4 py-1 rounded">Period Basis: {dateRange.start} to {dateRange.end}</span>
            <span>Audit Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[8px] border-collapse border-2 border-black text-black font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 font-black border-b-2 border-black">
              <th className="border border-black p-2 uppercase tracking-widest">ID No</th>
              <th className="border border-black p-2 text-left uppercase tracking-widest">Member Name & Designation</th>
              <th className="border border-black p-2 text-right uppercase tracking-widest">Col 1</th>
              <th className="border border-black p-2 text-right uppercase tracking-widest">Col 2</th>
              <th className="border border-black p-2 text-right uppercase tracking-widest">Col 3</th>
              <th className="border border-black p-2 text-right uppercase tracking-widest">Col 5</th>
              <th className="border border-black p-2 text-right uppercase tracking-widest">Col 6</th>
              <th className="border border-black p-2 text-right uppercase tracking-widest">Col 7</th>
              <th className="border border-black p-2 text-right uppercase tracking-widest">Col 8</th>
              <th className="border border-black p-2 text-right uppercase tracking-widest">Col 9</th>
              <th className="border border-black p-2 text-right uppercase tracking-widest bg-slate-100">Col 11</th>
            </tr>
          </thead>
          <tbody>
            {matrixData.map((row, i) => (
              <tr key={i} className="border-b border-black">
                <td className="border border-black p-1 text-center font-mono">{row.memberIdNumber}</td>
                <td className="border border-black p-1 uppercase">
                  <span className="block font-black">{row.name}</span>
                  <span className="text-[6px] tracking-tight">{row.designation}</span>
                </td>
                <td className="border border-black p-1 text-right">{row.stats.c1.closing.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.stats.c2.closing.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.stats.c3.closing.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.stats.c5.closing.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.stats.c6.closing.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.col7.closing.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.stats.c8.closing.toLocaleString()}</td>
                <td className="border border-black p-1 text-right">{row.stats.c9.closing.toLocaleString()}</td>
                <td className="border border-black p-1 text-right font-black bg-slate-50">{row.total.closing.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black border-t-2 border-black h-12">
              <td colSpan={2} className="border border-black p-2 text-right uppercase tracking-widest">Grand Totals:</td>
              <td className="border border-black p-2 text-right">{matrixTotals.stats.c1.closing.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{matrixTotals.stats.c2.closing.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{matrixTotals.stats.c3.closing.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{matrixTotals.stats.c5.closing.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{matrixTotals.stats.c6.closing.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{matrixTotals.col7.closing.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{matrixTotals.stats.c8.closing.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{matrixTotals.stats.c9.closing.toLocaleString()}</td>
              <td className="border border-black p-2 text-right underline decoration-double text-xs">{matrixTotals.total.closing.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center">
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Prepared by</div>
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Checked by</div>
          <div className="border-t-2 border-black pt-4 uppercase tracking-widest">Approved By Trustee</div>
        </div>
        
        <div className="mt-20 pt-8 border-t-2 border-black flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em]">
          <span>Institutional Trust Registry v1.0</span>
          <span className="italic">Form Generated via PBS CPF Software</span>
        </div>
      </div>
    </div>
  );
}
