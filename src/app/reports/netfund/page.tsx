"use client"

import { useMemo, useState } from "react";
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
  Calendar,
  ShieldCheck,
  TrendingUp,
  FileStack,
  ArrowRight
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, collectionGroup } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function NetfundStatementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState("");

  // Fetch all members
  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  // Fetch all fund summaries globally
  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const reportData = useMemo(() => {
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
        status: member.status || "Active",
        col1, col2, col3, col4: loanBalance, col5, col6, col7: netEmpFund, col8, col9, col10: netOfficeFund, col11: totalNetFund
      };
    })
    .filter(row => 
      row.name.toLowerCase().includes(search.toLowerCase()) || 
      row.memberIdNumber?.includes(search)
    )
    .sort((a, b) => (a.memberIdNumber || "").localeCompare(b.memberIdNumber || ""));
  }, [members, allSummaries, asOfDate, search]);

  const stats = useMemo(() => {
    return reportData.reduce((acc, curr) => ({
      empFund: acc.empFund + curr.col7,
      officeFund: acc.officeFund + curr.col10,
      loans: acc.loans + curr.col4,
      total: acc.total + curr.col11,
    }), { empFund: 0, officeFund: 0, loans: 0, total: 0 });
  }, [reportData]);

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    const data = reportData.map(item => ({
      "ID No": item.memberIdNumber,
      "Name": item.name,
      "Designation": item.designation,
      "Status": item.status,
      "Emp. Contrib (Col 1)": item.col1,
      "Loan Withdraw (Col 2)": item.col2,
      "Loan Repay (Col 3)": item.col3,
      "Loan Balance (Col 4)": item.col4,
      "Profit Emp (Col 5)": item.col5,
      "Profit Loan (Col 6)": item.col6,
      "Net Emp Fund (Col 7)": item.col7,
      "PBS Contrib (Col 8)": item.col8,
      "Profit PBS (Col 9)": item.col9,
      "Net Office Fund (Col 10)": item.col10,
      "Grand Total Netfund (Col 11)": item.col11
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Netfund Statement");
    XLSX.writeFile(wb, `CPF_Netfund_Statement_AsOf_${asOfDate}.xlsx`);
    toast({ title: "Exported", description: "Consolidated statement saved to Excel." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      {/* Print View */}
      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">Gazipur Palli Bidyut Samity-2</h1>
          <h2 className="text-lg font-bold underline underline-offset-4 uppercase text-slate-800">Statement of Members' Net Fund Balances</h2>
          <div className="flex justify-between text-[10px] font-bold pt-4">
            <span>Statement As Of: {asOfDate}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[8px] border-collapse border border-black table-fixed">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-1 text-center w-[40px]">ID No</th>
              <th className="border border-black p-1 text-left w-[120px]">Member Name & Designation</th>
              <th className="border border-black p-1 text-right">Loan Bal (Col 4)</th>
              <th className="border border-black p-1 text-right">Net Emp Fund (Col 7)</th>
              <th className="border border-black p-1 text-right">Net Office Fund (Col 10)</th>
              <th className="border border-black p-1 text-right font-black">Total Netfund (Col 11)</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, idx) => (
              <tr key={idx}>
                <td className="border border-black p-1 text-center font-mono">{row.memberIdNumber}</td>
                <td className="border border-black p-1">
                  <span className="font-bold">{row.name}</span><br/>
                  <span className="opacity-70">{row.designation}</span>
                </td>
                <td className="border border-black p-1 text-right">{row.col4.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right">{row.col7.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right">{row.col10.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="border border-black p-1 text-right font-black">{row.col11.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black">
              <td colSpan={2} className="border border-black p-1 text-right uppercase">Grand Totals:</td>
              <td className="border border-black p-1 text-right">{stats.loans.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right">{stats.empFund.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right">{stats.officeFund.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
              <td className="border border-black p-1 text-right underline decoration-double">৳ {stats.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
          <div className="border-t border-black pt-2">Accountant (CPF)</div>
          <div className="border-t border-black pt-2">Internal Auditor / DGM</div>
          <div className="border-t border-black pt-2">Approved By Trustee</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <FileStack className="size-8 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-primary tracking-tight">Netfund Statement</h1>
            <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Consolidated Subsidiary Statement for All Members</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-bold text-slate-400">Statement As Of</Label>
              <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-8 text-xs border-none shadow-none p-0 focus-visible:ring-0 font-bold" />
            </div>
          </div>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-9 font-bold text-xs">
              <FileSpreadsheet className="size-4" /> Excel Export
            </Button>
            <Button onClick={() => window.print()} className="gap-2 h-9 font-bold text-xs shadow-lg shadow-primary/20">
              <Printer className="size-4" /> Print Statement
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 no-print">
        <Card className="border-none shadow-sm bg-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Total Emp Fund</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">৳ {stats.empFund.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-blue-600 tracking-widest">Total Office Fund</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">৳ {stats.officeFund.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-rose-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-rose-600 tracking-widest">Total Loan Bal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">৳ {stats.loans.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-primary text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-primary-foreground/70 tracking-widest">Grand Total Netfund</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">৳ {stats.total.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
        <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              className="pl-9 h-9 bg-white" 
              placeholder="Search member..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="bg-white border-slate-200">
            {reportData.length} Personnel Listed
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
              <TableRow className="bg-muted/30">
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
              {(isMembersLoading || isSummariesLoading) ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : reportData.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-16 text-muted-foreground italic">No member records found matching the criteria.</TableCell></TableRow>
              ) : reportData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="font-mono text-xs font-bold text-slate-600 p-4">{row.memberIdNumber}</td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">{row.name}</span>
                      <span className="text-[9px] text-muted-foreground uppercase">{row.designation}</span>
                    </div>
                  </td>
                  <td className="text-right font-medium p-4">৳ {row.col4.toLocaleString()}</td>
                  <td className="text-right font-medium p-4">৳ {row.col7.toLocaleString()}</td>
                  <td className="text-right font-medium p-4">৳ {row.col10.toLocaleString()}</td>
                  <td className="text-right font-black text-primary p-4">৳ {row.col11.toLocaleString()}</td>
                  <td className="text-center p-4">
                    <Button variant="ghost" size="icon" asChild title="View Full Ledger">
                      <Link href={`/members/${row.id}`}>
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-100/50">
              <TableRow className="font-black">
                <TableCell colSpan={2} className="text-right uppercase text-[10px]">Grand Total Statements:</TableCell>
                <TableCell className="text-right">৳ {stats.loans.toLocaleString()}</TableCell>
                <TableCell className="text-right">৳ {stats.empFund.toLocaleString()}</TableCell>
                <TableCell className="text-right">৳ {stats.officeFund.toLocaleString()}</TableCell>
                <TableCell className="text-right text-primary text-base">৳ {stats.total.toLocaleString()}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
