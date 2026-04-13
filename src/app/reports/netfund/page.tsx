
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
  FileStack,
  ArrowRight
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import Link from "next/link";

export default function NetfundStatementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [asOfDate, setAsOfDate] = useState("");
  const [search, setSearch] = useState("");

  // Defer date initialization to avoid hydration errors
  useEffect(() => {
    setAsOfDate(new Date().toISOString().split('T')[0]);
  }, []);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const reportData = useMemo(() => {
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
      "Loan Bal": item.col4,
      "Net Emp Fund": item.col7,
      "Net Office Fund": item.col10,
      "Total Netfund": item.col11
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Netfund");
    XLSX.writeFile(wb, `Netfund_Statement_${asOfDate}.xlsx`);
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-black p-3 rounded-2xl">
            <FileStack className="size-8 text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight">Netfund Statement</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black">Consolidated Subsidiary Statement • Institutional View</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-2xl border-2 border-black shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black">Statement As Of</Label>
              <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-8 text-xs border-black font-black" />
            </div>
          </div>
          <div className="h-6 w-px bg-black" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel} className="gap-2 border-black text-black font-black h-9 text-xs">
              <FileSpreadsheet className="size-4" /> Export
            </Button>
            <Button onClick={() => window.print()} className="gap-2 h-9 font-black text-xs bg-black text-white">
              <Printer className="size-4" /> Print
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 no-print">
        <Card className="border-2 border-black shadow-sm bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Aggregate Emp Fund</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black">৳ {stats.empFund.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-2 border-black shadow-sm bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Aggregate Office Fund</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black">৳ {stats.officeFund.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-2 border-black shadow-sm bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Total Loans</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black">৳ {stats.loans.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-2 border-black shadow-sm bg-black text-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-white">Total Netfund</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black">৳ {stats.total.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden no-print">
        <div className="p-4 border-b-2 border-black bg-slate-100 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black" />
            <Input className="pl-9 h-9 border-black font-black" placeholder="Search ID or Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Badge variant="outline" className="border-black text-black font-black">{reportData.length} Personnel</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table className="text-black font-black">
            <TableHeader className="bg-slate-50 border-b-2 border-black">
              <TableRow>
                <TableHead className="font-black text-black">ID No</TableHead>
                <TableHead className="font-black text-black">Member Name</TableHead>
                <TableHead className="text-right font-black text-black">Loan Balance</TableHead>
                <TableHead className="text-right font-black text-black">Net Emp Fund</TableHead>
                <TableHead className="text-right font-black text-black">Net Office Fund</TableHead>
                <TableHead className="text-right font-black text-black">Total Netfund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                  <td className="font-mono text-xs p-4">{row.memberIdNumber}</td>
                  <td className="p-4">{row.name}</td>
                  <td className="text-right p-4">৳ {row.col4.toLocaleString()}</td>
                  <td className="text-right p-4">৳ {row.col7.toLocaleString()}</td>
                  <td className="text-right p-4">৳ {row.col10.toLocaleString()}</td>
                  <td className="text-right p-4 font-black">৳ {row.col11.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-100 font-black border-t-2 border-black">
              <TableRow>
                <TableCell colSpan={2} className="text-right uppercase">GRAND TOTALS:</TableCell>
                <TableCell className="text-right">৳ {stats.loans.toLocaleString()}</TableCell>
                <TableCell className="text-right">৳ {stats.empFund.toLocaleString()}</TableCell>
                <TableCell className="text-right">৳ {stats.officeFund.toLocaleString()}</TableCell>
                <TableCell className="text-right text-base underline decoration-double">৳ {stats.total.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-8 border-b-4 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-widest">Contributory Provident Fund</p>
          <h2 className="text-lg font-black underline underline-offset-4 uppercase">Statement of Members' Net Fund Balances</h2>
          <div className="flex justify-between text-[10px] font-black pt-4">
            <span>Statement As Of: {asOfDate}</span>
            <span>Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[9px] border-collapse border-2 border-black text-black font-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-2">ID No</th>
              <th className="border border-black p-2 text-left">Member Name</th>
              <th className="border border-black p-2 text-right">Loan Bal</th>
              <th className="border border-black p-2 text-right">Net Emp Fund</th>
              <th className="border border-black p-2 text-right">Net Office Fund</th>
              <th className="border border-black p-2 text-right">Total Netfund</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, idx) => (
              <tr key={idx}>
                <td className="border border-black p-2 text-center font-mono">{row.memberIdNumber}</td>
                <td className="border border-black p-2">{row.name}</td>
                <td className="border border-black p-2 text-right">{row.col4.toLocaleString()}</td>
                <td className="border border-black p-2 text-right">{row.col7.toLocaleString()}</td>
                <td className="border border-black p-2 text-right">{row.col10.toLocaleString()}</td>
                <td className="border border-black p-2 text-right">{row.col11.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black">
              <td colSpan={2} className="border border-black p-2 text-right uppercase">Totals:</td>
              <td className="border border-black p-2 text-right">{stats.loans.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{stats.empFund.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{stats.officeFund.toLocaleString()}</td>
              <td className="border border-black p-2 text-right underline decoration-double">৳ {stats.total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-black text-center">
          <div className="border-t-2 border-black pt-2 uppercase">Prepared by</div>
          <div className="border-t-2 border-black pt-2 uppercase">Checked by</div>
          <div className="border-t-2 border-black pt-2 uppercase">Approved By Trustee</div>
        </div>
      </div>
    </div>
  );
}
