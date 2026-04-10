
"use client"

import { useMemo, useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  FileSpreadsheet, 
  Printer, 
  Loader2, 
  UserX, 
  Search,
  Calendar,
  ShieldCheck
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function SettlementReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading } = useCollection(membersRef);

  const settledMembers = useMemo(() => {
    if (!members) return [];
    return members
      .filter(m => (m.status === 'Retired' || m.status === 'Transferred') && 
        (m.name.toLowerCase().includes(search.toLowerCase()) || m.memberIdNumber?.includes(search)))
      .sort((a, b) => new Date(b.settlementDate || 0).getTime() - new Date(a.settlementDate || 0).getTime());
  }, [members, search]);

  const exportToExcel = () => {
    if (settledMembers.length === 0) return;
    const data = settledMembers.map(m => ({
      "ID No": m.memberIdNumber,
      "Name": m.name,
      "Designation": m.designation,
      "Status": m.status,
      "Settlement Date": m.settlementDate,
      "Settled Amount (৳)": m.settledAmount || 0
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Settlements");
    XLSX.writeFile(wb, `CPF_Settlement_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Exported", description: "Settlement data saved to Excel." });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      {/* Print View */}
      <div className="hidden print:block print-container">
        <div className="text-center space-y-2 mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">Gazipur Palli Bidyut Samity-2</h1>
          <h2 className="text-lg font-bold underline underline-offset-4 uppercase">Retired & Transferred Employee Settlement Report</h2>
          <div className="flex justify-between text-[10px] font-bold pt-4">
            <span>Report Run Date: {new Date().toLocaleDateString('en-GB')}</span>
            <span>PBS CPF Management Audit Statement</span>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-black p-2 text-center w-[80px]">ID No</th>
              <th className="border border-black p-2 text-left">Name & Designation</th>
              <th className="border border-black p-2 text-center">Status</th>
              <th className="border border-black p-2 text-center">Settlement Date</th>
              <th className="border border-black p-2 text-right">Settled Amount (৳)</th>
            </tr>
          </thead>
          <tbody>
            {settledMembers.map((m) => (
              <tr key={m.id}>
                <td className="border border-black p-2 text-center font-mono">{m.memberIdNumber}</td>
                <td className="border border-black p-2">
                  <span className="font-bold">{m.name}</span><br/>
                  <span className="text-[8px] uppercase">{m.designation}</span>
                </td>
                <td className="border border-black p-2 text-center uppercase">{m.status}</td>
                <td className="border border-black p-2 text-center font-mono">{m.settlementDate}</td>
                <td className="border border-black p-2 text-right font-black">{(m.settledAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black">
              <td colSpan={4} className="border border-black p-2 text-right uppercase">Grand Total Settled:</td>
              <td className="border border-black p-2 text-right underline decoration-double">
                ৳ {settledMembers.reduce((sum, m) => sum + (Number(m.settledAmount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-24 grid grid-cols-3 gap-12 text-[11px] font-bold text-center">
          <div className="border-t border-black pt-2">Accountant / AGM(F)</div>
          <div className="border-t border-black pt-2">Internal Auditor / DGM</div>
          <div className="border-t border-black pt-2">Approved By Trustee</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Settlement Audit</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Registry of Retired & Transferred Employees with Final Ledger Clearances</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-10 font-bold">
            <FileSpreadsheet className="size-4" /> Export Excel
          </Button>
          <Button onClick={() => window.print()} className="gap-2 h-10 font-bold shadow-lg shadow-primary/20">
            <Printer className="size-4" /> Print Report
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 no-print">
        <Card className="border-none shadow-sm bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-orange-600 tracking-widest">Retired Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{settledMembers.filter(m => m.status === 'Retired').length} Accounts</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-blue-600 tracking-widest">Transferred Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{settledMembers.filter(m => m.status === 'Transferred').length} Accounts</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-slate-900 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Total Settled Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">৳ {settledMembers.reduce((sum, m) => sum + (Number(m.settledAmount) || 0), 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-xl shadow-lg border overflow-hidden no-print">
        <div className="p-4 border-b flex items-center gap-4 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              className="pl-9 h-10 max-w-sm bg-white" 
              placeholder="Search by ID or Name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="py-4">ID No</TableHead>
              <TableHead className="py-4">Name & Designation</TableHead>
              <TableHead className="py-4">Status</TableHead>
              <TableHead className="py-4">Settlement Date</TableHead>
              <TableHead className="text-right py-4">Settled Amount (৳)</TableHead>
              <TableHead className="text-center py-4">Ledger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="size-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : settledMembers.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-16 text-muted-foreground italic">No retired or transferred employees found.</TableCell></TableRow>
            ) : settledMembers.map((m) => (
              <TableRow key={m.id} className="hover:bg-slate-50/50">
                <TableCell className="font-mono text-xs font-bold">{m.memberIdNumber}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{m.designation}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={m.status === 'Retired' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                    {m.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium">{m.settlementDate || "N/A"}</TableCell>
                <TableCell className="text-right font-black text-primary">৳ {(m.settledAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" asChild className="h-8"><Link href={`/members/${m.id}`}><Calendar className="size-3.5 mr-2" /> View Ledger</Link></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
