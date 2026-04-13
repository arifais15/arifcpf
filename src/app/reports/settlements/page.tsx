
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
import { useCollection, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function SettlementReportPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading } = useCollection(membersRef);

  const settledMembers = useMemo(() => {
    if (!members) return [];
    return members
      .filter(m => (m.status === 'Retired' || m.status === 'Transferred' || m.status === 'InActive') && 
        (m.name.toLowerCase().includes(search.toLowerCase()) || m.memberIdNumber?.includes(search)))
      .sort((a, b) => new Date(b.settlementDate || 0).getTime() - new Date(a.settlementDate || 0).getTime());
  }, [members, search]);

  const exportToExcel = () => {
    if (settledMembers.length === 0) return;
    const data = settledMembers.map(m => ({
      "ID No": m.memberIdNumber,
      "Name": m.name,
      "Status": m.status,
      "Settlement Date": m.settlementDate,
      "Settled Amount": m.settledAmount || 0
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Settlements");
    XLSX.writeFile(wb, `Settlement_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-black tracking-tight">Settlement Audit</h1>
          <p className="text-black uppercase tracking-widest text-[10px] font-black">Registry of Retired, Transferred & InActive Employees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} className="gap-2 border-black text-black font-black h-9 text-xs">
            <FileSpreadsheet className="size-4" /> Export
          </Button>
          <Button onClick={() => window.print()} className="gap-2 h-9 font-black text-xs bg-black text-white shadow-lg">
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 no-print">
        <Card className="border-2 border-black shadow-sm bg-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Retired Staff</CardTitle></CardHeader><CardContent><div className="text-xl font-black">{settledMembers.filter(m => m.status === 'Retired').length}</div></CardContent></Card>
        <Card className="border-2 border-black shadow-sm bg-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Transferred Staff</CardTitle></CardHeader><CardContent><div className="text-xl font-black">{settledMembers.filter(m => m.status === 'Transferred').length}</div></CardContent></Card>
        <Card className="border-2 border-black shadow-sm bg-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">InActive Staff</CardTitle></CardHeader><CardContent><div className="text-xl font-black">{settledMembers.filter(m => m.status === 'InActive').length}</div></CardContent></Card>
        <Card className="border-2 border-black shadow-sm bg-black text-white"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-white">Total Settled</CardTitle></CardHeader><CardContent><div className="text-xl font-black">৳ {settledMembers.reduce((sum, m) => sum + (Number(m.settledAmount) || 0), 0).toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden no-print">
        <div className="p-4 border-b-2 border-black bg-slate-100 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black" />
            <Input className="pl-9 h-9 border-black font-black" placeholder="Search ID or Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <Table className="text-black font-black">
          <TableHeader className="bg-slate-50 border-b-2 border-black">
            <TableRow>
              <TableHead className="font-black text-black">ID No</TableHead>
              <TableHead className="font-black text-black">Name & Designation</TableHead>
              <TableHead className="font-black text-black">Status</TableHead>
              <TableHead className="font-black text-black">Date</TableHead>
              <TableHead className="text-right font-black text-black">Amount (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settledMembers.map((m) => (
              <TableRow key={m.id} className="hover:bg-slate-50 border-b border-black">
                <td className="font-mono text-xs p-4">{m.memberIdNumber}</td>
                <td className="p-4"><div><p className="font-black">{m.name}</p><p className="text-[10px] opacity-70 uppercase">{m.designation}</p></div></td>
                <td className="p-4 uppercase">{m.status}</td>
                <td className="p-4">{m.settlementDate || "N/A"}</td>
                <td className="text-right p-4 font-black">৳ {(m.settledAmount || 0).toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-8 border-b-4 border-black pb-6">
          <h1 className="text-2xl font-black uppercase">{pbsName}</h1>
          <p className="text-sm font-black uppercase tracking-widest">Contributory Provident Fund</p>
          <h2 className="text-lg font-black underline underline-offset-4 uppercase">Retired, Transferred & InActive Employee Settlement Report</h2>
          <div className="flex justify-between text-[10px] font-black pt-4">
            <span>Report Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <table className="w-full text-[9px] border-collapse border-2 border-black text-black font-black">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-2">ID No</th>
              <th className="border border-black p-2 text-left">Name & Designation</th>
              <th className="border border-black p-2 text-center">Status</th>
              <th className="border border-black p-2 text-center">Date</th>
              <th className="border border-black p-2 text-right">Settled Amount</th>
            </tr>
          </thead>
          <tbody>
            {settledMembers.map((m) => (
              <tr key={m.id}>
                <td className="border border-black p-2 text-center font-mono">{m.memberIdNumber}</td>
                <td className="border border-black p-2"><b>{m.name}</b><br/><span className="text-[8px] uppercase">{m.designation}</span></td>
                <td className="border border-black p-2 text-center uppercase">{m.status}</td>
                <td className="border border-black p-2 text-center">{m.settlementDate}</td>
                <td className="border border-black p-2 text-right font-black">{(m.settledAmount || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black">
              <td colSpan={4} className="border border-black p-2 text-right uppercase">Total Settled:</td>
              <td className="border border-black p-2 text-right underline decoration-double">৳ {settledMembers.reduce((sum, m) => sum + (Number(m.settledAmount) || 0), 0).toLocaleString()}</td>
            </tr>
          </tfoot>
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
