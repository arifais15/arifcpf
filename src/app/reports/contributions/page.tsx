"use client"

import { useMemo, useState, useEffect } from "react";
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
  Search,
  Calendar,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  ArrowRightLeft,
  Trash2,
  AlertTriangle,
  DatabaseZap,
  FilterX,
  Info
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc, deleteDocumentNonBlocking } from "@/firebase";
import { collectionGroup, query, where, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function ContributionAuditPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [particularsSearch, setParticularsSearch] = useState("");
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setDateRange({ start: fyStart, end: today });
  }, []);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading } = useCollection(summariesRef);

  const filteredData = useMemo(() => {
    if (!allSummaries) return [];
    let data = allSummaries;
    
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      data = data.filter(item => {
        const d = new Date(item.summaryDate).getTime();
        return d >= s && d <= e;
      });
    }

    if (particularsSearch) {
      data = data.filter(item => 
        item.particulars?.toLowerCase().includes(particularsSearch.toLowerCase())
      );
    }

    return data.sort((a, b) => new Date(b.summaryDate).getTime() - new Date(a.summaryDate).getTime());
  }, [allSummaries, dateRange, particularsSearch]);

  const stats = useMemo(() => {
    const s = {
      systemProfit: 0,
      manualEmp: 0,
      manualPbs: 0,
      totalEntries: filteredData.length
    };
    filteredData.forEach(item => {
      if (item.isSystemGenerated || item.particulars?.includes("Annual Profit")) {
        s.systemProfit += (Number(item.profitEmployee) || 0) + (Number(item.profitPbs) || 0);
      }
      if (item.isManual || (!item.isSystemGenerated && !item.isSettlement)) {
        s.manualEmp += (Number(item.employeeContribution) || 0);
        s.manualPbs += (Number(item.pbsContribution) || 0);
      }
    });
    return s;
  }, [filteredData]);

  const handleBulkDelete = async () => {
    if (filteredData.length === 0) return;
    
    showAlert({
      title: "Confirm Bulk Deletion",
      description: `You are about to delete ${filteredData.length} ledger entries matching: "${particularsSearch || 'All'}" within the selected date range. This cannot be undone.`,
      type: "warning",
      showCancel: true,
      confirmText: "Yes, Delete All",
      onConfirm: async () => {
        setIsDeleting(true);
        let count = 0;
        for (const item of filteredData) {
          const docRef = doc(firestore, "members", item.memberId, "fundSummaries", item.id);
          deleteDocumentNonBlocking(docRef);
          count++;
        }
        setIsDeleting(false);
        setIsCleanupOpen(false);
        showAlert({
          title: "Cleanup Complete",
          description: `Successfully removed ${count} records.`,
          type: "success"
        });
      }
    });
  };

  const StandardFooter = () => (
    <div className="mt-10 pt-2 border-t border-black flex justify-between items-center text-[8px] text-black font-black uppercase tracking-widest">
      <span>CPF Management Software</span>
      <span className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</span>
    </div>
  );

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-black tracking-tight uppercase">Audit & Tracking</h1>
          <p className="text-black uppercase tracking-widest text-[10px] font-black">Comprehensive institutional ledger audit terminal</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl border-2 border-black shadow-xl">
          <div className="flex items-center gap-3">
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black">Ledger Start</Label>
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-black font-black" />
            </div>
            <ArrowRightLeft className="size-3 text-black mt-3" />
            <div className="grid gap-1">
              <Label className="text-[9px] uppercase font-black text-black">Ledger End</Label>
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-black font-black" />
            </div>
          </div>
          <div className="h-6 w-px bg-black hidden sm:block" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-black/40" />
            <Input 
              placeholder="Search Particulars..." 
              value={particularsSearch} 
              onChange={(e) => setParticularsSearch(e.target.value)} 
              className="h-8 pl-8 text-xs border-black font-black w-[200px]"
            />
          </div>
          <div className="h-6 w-px bg-black hidden sm:block" />
          <Button variant="destructive" onClick={() => setIsCleanupOpen(true)} className="gap-2 h-8 font-black text-[10px] uppercase shadow-lg">
            <DatabaseZap className="size-3.5" /> Institutional Cleanup
          </Button>
          <Button onClick={() => window.print()} className="gap-2 h-8 font-black text-[10px] bg-black text-white shadow-lg uppercase">
            <Printer className="size-3.5" /> Print Audit
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 no-print">
        <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">System Generated Profit</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black text-black tabular-nums">৳ {stats.systemProfit.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Manual Personnel Contrib.</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black text-black tabular-nums">৳ {stats.manualEmp.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-black">Manual PBS Matching</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black text-black tabular-nums">৳ {stats.manualPbs.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] bg-black text-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-white">Total Ledger Hits</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-black">{stats.totalEntries} Records</div></CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print">
        <div className="p-4 border-b-4 border-black bg-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-black flex items-center gap-3 uppercase tracking-widest">
            <ShieldCheck className="size-5" /> Operational Ledger Trail
          </h2>
          <Badge className="bg-black text-white font-black px-4 py-1 uppercase border-black">{filteredData.length} Postings Matched</Badge>
        </div>
        <Table className="text-black font-black tabular-nums">
          <TableHeader className="bg-slate-50 border-b-2 border-black">
            <TableRow>
              <TableHead className="font-black text-black uppercase text-[10px] py-4">Date</TableHead>
              <TableHead className="font-black text-black uppercase text-[10px] py-4">Synchronized Particulars</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] py-4">Emp. Cont (৳)</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] py-4">PBS Cont (৳)</TableHead>
              <TableHead className="text-right font-black text-black uppercase text-[10px] py-4 bg-slate-100">Net Profit (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-black text-lg uppercase italic">No records found for current filters</TableCell></TableRow>
            ) : filteredData.map((item, idx) => (
              <TableRow key={idx} className="hover:bg-slate-50 border-b border-black">
                <td className="font-mono text-xs p-4">{item.summaryDate}</td>
                <td className="p-4 uppercase text-[10px] leading-tight max-w-[400px] truncate">{item.particulars}</td>
                <td className="text-right p-4">{Number(item.employeeContribution || 0).toLocaleString()}</td>
                <td className="text-right p-4">{Number(item.pbsContribution || 0).toLocaleString()}</td>
                <td className="text-right p-4 font-black bg-slate-50/50">৳ {(Number(item.profitEmployee || 0) + Number(item.profitPbs || 0)).toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCleanupOpen} onOpenChange={setIsCleanupOpen}>
        <DialogContent className="max-w-2xl border-4 border-black bg-white rounded-none p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="bg-rose-50 p-6 border-b-4 border-black">
            <DialogTitle className="font-black uppercase text-2xl tracking-tighter flex items-center gap-3 text-rose-700">
              <AlertTriangle className="size-8" />
              Institutional Cleanup Terminal
            </DialogTitle>
            <DialogDescription className="font-black text-[10px] uppercase tracking-widest text-rose-600">
              DANGER: This action will permanently remove records from member ledgers.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-6 border-2 border-black space-y-4">
              <div className="flex items-center justify-between border-b border-black/10 pb-4">
                <p className="text-[11px] font-black uppercase text-slate-500">Current Filter Matches</p>
                <Badge className="bg-rose-600 text-white font-black">{filteredData.length} Ledger Entries</Badge>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400">Date Coverage</p>
                  <p className="text-xs font-black">{dateRange.start || "N/A"} to {dateRange.end || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400">Particulars Keyword</p>
                  <p className="text-xs font-black">{particularsSearch || "ANY"}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 bg-amber-50 border-2 border-amber-200 text-amber-800">
              <Info className="size-5 shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed font-bold uppercase">
                To prevent accidental deletion of valid data, ensure your "Particulars" search is specific (e.g. "Opening Balance (Imported)"). Verify the record count in the list below before committing to delete.
              </p>
            </div>

            <DialogFooter className="pt-4 gap-4">
              <Button variant="ghost" onClick={() => setIsCleanupOpen(false)} className="font-black uppercase tracking-widest border-2 border-black">Cancel Audit</Button>
              <Button 
                variant="destructive" 
                onClick={handleBulkDelete} 
                disabled={isDeleting || filteredData.length === 0}
                className="flex-1 font-black uppercase h-12 shadow-xl tracking-[0.2em]"
              >
                {isDeleting ? <Loader2 className="size-5 animate-spin mr-2" /> : <Trash2 className="size-5 mr-2" />}
                Confirm Deletion of {filteredData.length} Records
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden print:block print-container font-ledger text-black">
        <div className="text-center space-y-2 mb-8 border-b-4 border-black pb-6">
          <h1 className="text-4xl font-black uppercase tracking-tighter">{pbsName}</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">Contributory Provident Fund</p>
          <h2 className="text-xl font-black underline underline-offset-4 decoration-2 uppercase tracking-[0.2em] mt-4">Institutional Contribution & Profit Audit Statement</h2>
          <div className="flex justify-between text-[11px] font-black pt-8">
            <span className="bg-black text-white px-4 py-1">Ledger Period: {dateRange.start} to {dateRange.end}</span>
            <span>Audit Run Date: {new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <table className="w-full text-[9px] border-collapse border-2 border-black text-black font-black tabular-nums">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-black">
              <th className="border border-black p-2 uppercase">Date</th>
              <th className="border border-black p-2 text-left uppercase">Particulars & Synchronized Metadata</th>
              <th className="border border-black p-2 text-right uppercase">Emp. Cont (৳)</th>
              <th className="border border-black p-2 text-right uppercase">PBS Cont (৳)</th>
              <th className="border border-black p-2 text-right uppercase bg-slate-50">Profit (৳)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, idx) => (
              <tr key={idx} className="border-b border-black">
                <td className="border border-black p-2 text-center font-mono">{item.summaryDate}</td>
                <td className="border border-black p-2 uppercase text-[8px] leading-tight">{item.particulars}</td>
                <td className="border border-black p-2 text-right">{Number(item.employeeContribution || 0).toLocaleString()}</td>
                <td className="border border-black p-2 text-right">{Number(item.pbsContribution || 0).toLocaleString()}</td>
                <td className="border border-black p-2 text-right font-black bg-slate-50">{(Number(item.profitEmployee || 0) + Number(item.profitPbs || 0)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-black border-t-2 border-black h-12">
              <td colSpan={2} className="border border-black p-2 text-right uppercase tracking-widest">Institutional Audit Totals:</td>
              <td className="border border-black p-2 text-right">{stats.manualEmp.toLocaleString()}</td>
              <td className="border border-black p-2 text-right">{stats.manualPbs.toLocaleString()}</td>
              <td className="border border-black p-2 text-right text-base underline decoration-double">৳ {stats.systemProfit.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-32 grid grid-cols-3 gap-16 text-[13px] font-black text-center uppercase tracking-widest">
          <div className="border-t-2 border-black pt-4">Prepared by</div>
          <div className="border-t-2 border-black pt-4">Checked by</div>
          <div className="border-t-2 border-black pt-4">Approved By Trustee</div>
        </div>
        <StandardFooter />
      </div>
    </div>
  );
}