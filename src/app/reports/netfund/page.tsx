
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
  FileStack
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function NetfundStatementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [asOfDate, setAsOfDate] = useState("");
  const [search, setSearch] = useState("");

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

  if (isMembersLoading || isSummariesLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-black" /></div>;
  }

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-5">
          <div className="bg-black p-4 rounded-2xl shadow-lg">
            <FileStack className="size-8 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-black tracking-tighter uppercase">Netfund Statement</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Consolidated Trust Balances Audit</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-white p-4 rounded-2xl border-4 border-black shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="grid gap-1.5">
              <Label className="text-[10px] uppercase font-black text-black tracking-widest">Statement Cut-off</Label>
              <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-10 text-sm border-2 border-black font-black" />
            </div>
          </div>
          <div className="h-10 w-0.5 bg-black" />
          <div className="flex gap-3">
            <Button variant="outline" onClick={exportToExcel} className="gap-2 border-2 border-black text-black font-black h-11 px-6 uppercase tracking-widest">
              <FileSpreadsheet className="size-5" /> Export
            </Button>
            <Button onClick={() => window.print()} className="gap-2 h-11 font-black px-8 bg-black text-white shadow-xl uppercase tracking-widest hover:bg-black/90">
              <Printer className="size-5" /> Print
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-4 no-print">
        {[
          { l: "Aggregate Emp Fund", v: stats.empFund, c: "bg-white" },
          { l: "Aggregate Office Fund", v: stats.officeFund, c: "bg-white" },
          { l: "Total Outstanding Loans", v: stats.loans, c: "bg-white" },
          { l: "Total Institutional Netfund", v: stats.total, c: "bg-black text-white" },
        ].map((s, i) => (
          <Card key={i} className={cn("border-2 border-black shadow-lg", s.c)}>
            <CardHeader className="pb-2">
              <CardTitle className={cn("text-[11px] font-black uppercase tracking-widest", i === 3 ? "text-white" : "text-black")}>{s.l}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black tabular-nums">৳ {s.v.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-white rounded-none shadow-2xl border-2 border-black overflow-hidden no-print">
        <div className="p-6 border-b-2 border-black bg-slate-50 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-black" />
            <Input className="pl-10 h-11 border-2 border-black font-black text-base" placeholder="Audit Registry Search (ID/Name)..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Badge className="bg-black text-white font-black px-4 py-1.5 uppercase tracking-[0.2em]">{reportData.length} Personnel Audited</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table className="text-black font-black border-collapse">
            <TableHeader className="bg-slate-100 border-b-2 border-black">
              <TableRow>
                <TableHead className="font-black text-black uppercase tracking-widest py-5">ID Number</TableHead>
                <TableHead className="font-black text-black uppercase tracking-widest py-5">Personnel Metadata</TableHead>
                <TableHead className="text-right font-black text-black uppercase tracking-widest py-5">Loan Bal (Col 4)</TableHead>
                <TableHead className="text-right font-black text-black uppercase tracking-widest py-5">Net Emp (Col 7=Pre+1-2+3+5+6)</TableHead>
                <TableHead className="text-right font-black text-black uppercase tracking-widest py-5">Net Office (Col 10)</TableHead>
                <TableHead className="text-right font-black text-black uppercase tracking-widest py-5 bg-slate-200">Total Netfund (Col 11=7+10)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-black tabular-nums">
              {reportData.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-slate-100 border-b border-black">
                  <td className="font-mono text-base p-5 border-r border-black">{row.memberIdNumber}</td>
                  <td className="p-5 border-r border-black">
                    <div className="flex flex-col">
                      <span className="uppercase text-sm tracking-tight">{row.name}</span>
                      <span className="text-[10px] uppercase text-black italic tracking-widest">{row.designation}</span>
                    </div>
                  </td>
                  <td className="text-right p-5 border-r border-black">৳ {row.col4.toLocaleString()}</td>
                  <td className="text-right p-5 border-r border-black">৳ {row.col7.toLocaleString()}</td>
                  <td className="text-right p-5 border-r border-black">৳ {row.col10.toLocaleString()}</td>
                  <td className="text-right p-5 bg-slate-50 text-lg underline decoration-black decoration-2">৳ {row.col11.toLocaleString()}</td>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-100 font-black border-t-2 border-black text-black tabular-nums">
              <TableRow className="h-20">
                <TableCell colSpan={2} className="text-right uppercase tracking-[0.3em] text-sm">Institutional Aggregates:</TableCell>
                <TableCell className="text-right border-l border-black">৳ {stats.loans.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-black">৳ {stats.empFund.toLocaleString()}</TableCell>
                <TableCell className="text-right border-l border-black">৳ {stats.officeFund.toLocaleString()}</TableCell>
                <TableCell className="text-right text-2xl underline decoration-double bg-slate-200 border-l border-black">৳ {stats.total.toLocaleString()}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-10 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-8 uppercase tracking-[0.4em] mt-4">Statement of Members' Net Fund Balances</h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <span className="bg-black text-white px-4 py-1 rounded">Statement Cut-off: {asOfDate}</span>
            <span>Audit Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse border-2 border-black text-black font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-black">
              <th className="border border-black p-2.5 uppercase tracking-widest">ID No</th>
              <th className="border border-black p-2.5 text-left uppercase tracking-widest">Member Name & Designation</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest">Loan Bal</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest">Net Emp Fund</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest">Net Office Fund</th>
              <th className="border border-black p-2.5 text-right uppercase tracking-widest bg-slate-100">Total Netfund</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, idx) => (
              <tr key={idx} className="border-b border-black">
                <td className="border border-black p-2.5 text-center font-mono text-base">{row.memberIdNumber}</td>
                <td className="border border-black p-2.5">
                  <span className="font-black uppercase text-sm block">{row.name}</span>
                  <span className="text-[8px] uppercase tracking-widest italic">{row.designation}</span>
                </td>
                <td className="border border-black p-2.5 text-right">{row.col4.toLocaleString()}</td>
                <td className="border border-black p-2.5 text-right">{row.col7.toLocaleString()}</td>
                <td className="border border-black p-2.5 text-right">{row.col10.toLocaleString()}</td>
                <td className="border border-black p-2.5 text-right font-black text-base underline decoration-black decoration-2">{row.col11.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black border-t-2 border-black h-16">
              <td colSpan={2} className="border border-black p-2.5 text-right uppercase tracking-[0.2em]">Grand Totals:</td>
              <td className="border border-black p-2.5 text-right">{stats.loans.toLocaleString()}</td>
              <td className="border border-black p-2.5 text-right">{stats.empFund.toLocaleString()}</td>
              <td className="border border-black p-2.5 text-right">{stats.officeFund.toLocaleString()}</td>
              <td className="border border-black p-2.5 text-right underline decoration-double text-lg underline-offset-4">৳ {stats.total.toLocaleString()}</td>
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
