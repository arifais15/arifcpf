
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

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [asOfDate, setAsOfDate] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("matrix");

  // Defer date initialization to avoid hydration errors
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

  // --- DATA FOR 11-COLUMN MATRIX ---
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

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl">
            <ClipboardCheck className="size-8 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight">Ledger Summary</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black">Consolidated Subsidiary Reports • Institutional View</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border-2 border-black shadow-sm">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-black" />
            <Input 
              className="pl-7 h-8 text-xs border-black border font-black" 
              placeholder="Search ID/Name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="h-6 w-px bg-black" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel} className="gap-2 h-9 font-black text-xs border-black">
              <FileSpreadsheet className="size-4" /> Export
            </Button>
            <Button onClick={() => window.print()} className="gap-2 h-9 font-black text-xs bg-black text-white">
              <Printer className="size-4" /> Print
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white p-1 rounded-xl border-2 border-black mb-8 no-print h-12">
          <TabsTrigger value="matrix" className="px-6 py-2 gap-2 rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-black">
            <ClipboardCheck className="size-4" /> Ledger Matrix
          </TabsTrigger>
          <TabsTrigger value="netfund" className="px-6 py-2 gap-2 rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-black">
            <FileStack className="size-4" /> Netfund Statement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white p-4 rounded-xl border-2 border-black flex items-center gap-6 no-print">
            <div className="flex items-center gap-3">
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-black text-black">Date From</Label>
                <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-black font-black" />
              </div>
              <ArrowRightLeft className="size-3 text-black mt-3" />
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-black text-black">Date To</Label>
                <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-black font-black" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden no-print">
            <div className="overflow-x-auto">
              <Table className="min-w-[2200px] border-collapse text-black font-black">
                <TableHeader className="sticky top-0 bg-white z-30 shadow-sm border-b-2 border-black">
                  <TableRow className="bg-slate-100">
                    <TableHead rowSpan={2} className="w-[60px] sticky left-0 bg-white border-r-2 border-black z-40 text-black font-black">ID No</TableHead>
                    <TableHead rowSpan={2} className="w-[180px] sticky left-[60px] bg-white border-r-2 border-black z-40 text-black font-black">Name</TableHead>
                    <ColumnGroupHead title="Emp. Contribution (Col 1)" />
                    <ColumnGroupHead title="Loan Disburse (Col 2)" />
                    <ColumnGroupHead title="Loan Repayment (Col 3)" />
                    <ColumnGroupHead title="Profit Emp (Col 5)" />
                    <ColumnGroupHead title="Profit Loan (Col 6)" />
                    <ColumnGroupHead title="PBS Contrib (Col 8)" />
                    <ColumnGroupHead title="Profit PBS (Col 9)" />
                    <ColumnGroupHead title="Total Fund (Col 11)" />
                  </TableRow>
                  <TableRow className="bg-slate-50 text-[8px] uppercase font-black border-b-2 border-black">
                    {[1,2,3,5,6,8,9,11].map(i => (
                      <React.Fragment key={i}>
                        <TableHead className="text-right px-1 border-l border-black text-black">Opening</TableHead>
                        <TableHead className="text-right px-1 text-black border-l border-black">Period</TableHead>
                        <TableHead className="text-right px-1 font-black bg-slate-200 border-l border-black text-black">Closing</TableHead>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrixData.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-100 border-b border-black text-[10px]">
                      <td className="font-mono font-black p-2 sticky left-0 bg-white border-r-2 border-black z-10 text-black">{row.memberIdNumber}</td>
                      <td className="p-2 font-black sticky left-[60px] bg-white border-r-2 border-black z-10 truncate text-black">{row.name}</td>
                      {['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'].map(k => (
                        <React.Fragment key={k}>
                          <td className="text-right p-2 border-l border-black text-black">{row.stats[k].opening.toLocaleString()}</td>
                          <td className="text-right p-2 border-l border-black text-black">{row.stats[k].period.toLocaleString()}</td>
                          <td className="text-right p-2 border-l border-black font-black bg-slate-50 text-black">{row.stats[k].closing.toLocaleString()}</td>
                        </React.Fragment>
                      ))}
                      <td className="text-right p-2 border-l border-black text-black bg-slate-100">{row.total.opening.toLocaleString()}</td>
                      <td className="text-right p-2 border-l border-black font-black bg-slate-100 text-black">{row.total.period.toLocaleString()}</td>
                      <td className="text-right p-2 border-l border-black font-black bg-slate-200 text-black">{row.total.closing.toLocaleString()}</td>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="sticky bottom-0 bg-slate-100 z-30 font-black border-t-4 border-black text-black">
                  <TableRow>
                    <TableCell colSpan={2} className="sticky left-0 bg-slate-100 z-40 border-r-2 border-black text-right uppercase text-[9px] text-black">Grand Totals:</TableCell>
                    {['c1', 'c2', 'c3', 'c5', 'c6', 'c8', 'c9'].map(k => (
                      <React.Fragment key={k}>
                        <TableCell className="text-right p-2 text-[9px] border-l border-black text-black">{matrixTotals.stats[k].opening.toLocaleString()}</TableCell>
                        <TableCell className="text-right p-2 text-[9px] border-l border-black text-black">{matrixTotals.stats[k].period.toLocaleString()}</TableCell>
                        <TableCell className="text-right p-2 text-[9px] border-l border-black bg-slate-200 text-black">{matrixTotals.stats[k].closing.toLocaleString()}</TableCell>
                      </React.Fragment>
                    ))}
                    <TableCell className="text-right p-2 text-[9px] border-l border-black bg-slate-100 text-black">{matrixTotals.total.opening.toLocaleString()}</TableCell>
                    <TableCell className="text-right p-2 text-[9px] border-l border-black bg-slate-100 text-black">{matrixTotals.total.period.toLocaleString()}</TableCell>
                    <TableCell className="text-right p-2 text-xs border-l border-black bg-slate-300 underline decoration-double text-black">৳ {matrixTotals.total.closing.toLocaleString()}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="netfund" className="space-y-6 animate-in fade-in duration-500">
          <div className="grid gap-6 md:grid-cols-4 no-print">
            <Card className="border-2 border-black shadow-sm bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Aggregate Emp Fund</CardTitle></CardHeader>
              <CardContent><div className="text-xl font-black text-black">৳ {netfundStats.empFund.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="border-2 border-black shadow-sm bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Aggregate Office Fund</CardTitle></CardHeader>
              <CardContent><div className="text-xl font-black text-black">৳ {netfundStats.officeFund.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="border-2 border-black shadow-sm bg-white">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Total Loans</CardTitle></CardHeader>
              <CardContent><div className="text-xl font-black text-black">৳ {netfundStats.loans.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="border-2 border-black shadow-sm bg-black">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-white">Total Netfund</CardTitle></CardHeader>
              <CardContent><div className="text-xl font-black text-white">৳ {netfundStats.total.toLocaleString()}</div></CardContent>
            </Card>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-black shadow-lg overflow-hidden no-print">
            <Table>
              <TableHeader className="bg-slate-100 border-b-2 border-black">
                <TableRow>
                  <TableHead className="font-black text-black">ID No</TableHead>
                  <TableHead className="font-black text-black">Member Name</TableHead>
                  <TableHead className="text-right font-black text-black">Loan Balance (Col 4)</TableHead>
                  <TableHead className="text-right font-black text-black">Net Emp Fund (Col 7)</TableHead>
                  <TableHead className="text-right font-black text-black">Net Office Fund (Col 10)</TableHead>
                  <TableHead className="text-right font-black text-black">Total Netfund (Col 11)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-black font-black">
                {netfundData.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                    <td className="font-mono text-xs p-4">{row.memberIdNumber}</td>
                    <td className="p-4">{row.name}</td>
                    <td className="text-right p-4">৳ {row.col4.toLocaleString()}</td>
                    <td className="text-right p-4">৳ {row.col7.toLocaleString()}</td>
                    <td className="text-right p-4">৳ {row.col10.toLocaleString()}</td>
                    <td className="text-right p-4">৳ {row.col11.toLocaleString()}</td>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-slate-100 font-black border-t-2 border-black text-black">
                <TableRow>
                  <TableCell colSpan={2} className="text-right uppercase">GRAND TOTALS:</TableCell>
                  <TableCell className="text-right">৳ {netfundStats.loans.toLocaleString()}</TableCell>
                  <TableCell className="text-right">৳ {netfundStats.empFund.toLocaleString()}</TableCell>
                  <TableCell className="text-right">৳ {netfundStats.officeFund.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-base underline decoration-double">৳ {netfundStats.total.toLocaleString()}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-8 border-b-4 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-widest">Contributory Provident Fund</p>
          <h2 className="text-lg font-black underline underline-offset-4 uppercase">
            {activeTab === 'matrix' ? 'Ledger Summary Matrix' : 'Statement of Members Netfund Balances'}
          </h2>
          <div className="flex justify-between text-[10px] font-black pt-4">
            <span>Period: {dateRange.start} to {dateRange.end}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[8px] border-collapse border-2 border-black text-black font-black">
          <thead>
            <tr className="bg-slate-100 font-black">
              <th className="border border-black p-1">ID No</th>
              <th className="border border-black p-1 text-left">Member Name</th>
              <th className="border border-black p-1 text-right">Col 1</th>
              <th className="border border-black p-1 text-right">Col 2</th>
              <th className="border border-black p-1 text-right">Col 3</th>
              <th className="border border-black p-1 text-right">Col 5</th>
              <th className="border border-black p-1 text-right">Col 6</th>
              <th className="border border-black p-1 text-right">Col 8</th>
              <th className="border border-black p-1 text-right">Col 9</th>
              <th className="border border-black p-1 text-right">Col 11</th>
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
                <td className="border border-black p-1 text-right">{row.total.closing.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-black text-center text-black">
          <div className="border-t-2 border-black pt-2 uppercase">Prepared by</div>
          <div className="border-t-2 border-black pt-2 uppercase">Checked by</div>
          <div className="border-t-2 border-black pt-2 uppercase">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
