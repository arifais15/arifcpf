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
  Printer, 
  Loader2, 
  Search,
  ArrowRightLeft,
  Trash2,
  AlertTriangle,
  DatabaseZap,
  ShieldCheck,
  Info
} from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc, deleteDocumentNonBlocking } from "@/firebase";
import { collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useSweetAlert } from "@/hooks/use-sweet-alert";

export default function ContributionAuditPage() {
  const firestore = useFirestore();
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
      data = data.filter(item => { const d = new Date(item.summaryDate).getTime(); return d >= s && d <= e; });
    }
    if (particularsSearch) {
      data = data.filter(item => item.particulars?.toLowerCase().includes(particularsSearch.toLowerCase()));
    }
    return data.sort((a, b) => new Date(b.summaryDate).getTime() - new Date(a.summaryDate).getTime());
  }, [allSummaries, dateRange, particularsSearch]);

  const stats = useMemo(() => {
    const s = { systemProfit: 0, manualEmp: 0, manualPbs: 0, totalEntries: filteredData.length };
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
      description: `Permanently delete ${filteredData.length} entries matching "${particularsSearch || 'All'}"?`,
      type: "warning",
      showCancel: true,
      onConfirm: async () => {
        setIsDeleting(true);
        for (const item of filteredData) {
          deleteDocumentNonBlocking(doc(firestore, "members", item.memberId, "fundSummaries", item.id));
        }
        setIsDeleting(false); setIsCleanupOpen(false);
        showAlert({ title: "Cleanup Complete", type: "success" });
      }
    });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <h1 className="text-3xl font-black uppercase">Audit & Tracking</h1>
        <div className="flex items-center gap-4 bg-white p-3 border-2 border-black rounded-xl shadow-xl">
          <div className="grid gap-1"><Label className="text-[9px] font-black">START</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-black font-black" /></div>
          <ArrowRightLeft className="size-3 mt-4" />
          <div className="grid gap-1"><Label className="text-[9px] font-black">END</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-black font-black" /></div>
          <Input placeholder="Search Particulars..." value={particularsSearch} onChange={(e) => setParticularsSearch(e.target.value)} className="h-8 border-black font-black w-[180px]" />
          <Button variant="destructive" onClick={() => setIsCleanupOpen(true)} className="h-8 text-[10px] font-black uppercase"><DatabaseZap className="size-3 mr-1" /> Cleanup</Button>
          <Button onClick={() => window.print()} className="h-8 text-[10px] font-black uppercase bg-black text-white"><Printer className="size-3 mr-1" /> Print</Button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-4 no-print">
        {[{l:"SYSTEM PROFIT", v:stats.systemProfit}, {l:"PERSONNEL CONTRIB", v:stats.manualEmp}, {l:"PBS MATCHING", v:stats.manualPbs}, {l:"RECORDS", v:stats.totalEntries, isInt:true}].map((s,i) => (
          <Card key={i} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
            <CardHeader className="pb-1"><CardTitle className="text-[10px] font-black uppercase opacity-60">{s.l}</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-black">{s.isInt ? s.v : `৳ ${s.v.toLocaleString()}`}</div></CardContent>
          </Card>
        ))}
      </div>
      <div className="bg-white border-2 border-black rounded-none shadow-xl overflow-hidden">
        <Table className="font-black tabular-nums">
          <TableHeader className="bg-slate-100 border-b-2 border-black">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] py-4">Date</TableHead>
              <TableHead className="font-black uppercase text-[10px] py-4">Particulars</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] py-4">Emp (৳)</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] py-4">PBS (৳)</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] py-4">Profit (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin size-8 mx-auto" /></TableCell></TableRow> : filteredData.map((item, idx) => (
              <TableRow key={idx} className="border-b border-black hover:bg-slate-50">
                <td className="p-4 font-mono text-xs">{item.summaryDate}</td>
                <td className="p-4 uppercase text-[10px] truncate max-w-[300px]">{item.particulars}</td>
                <td className="text-right p-4">{Number(item.employeeContribution||0).toLocaleString()}</td>
                <td className="text-right p-4">{Number(item.pbsContribution||0).toLocaleString()}</td>
                <td className="text-right p-4">{(Number(item.profitEmployee||0)+Number(item.profitPbs||0)).toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={isCleanupOpen} onOpenChange={setIsCleanupOpen}><DialogContent className="border-4 border-black max-w-xl p-0 overflow-hidden"><DialogHeader className="bg-rose-50 p-6 border-b-4 border-black"><DialogTitle className="text-xl font-black uppercase text-rose-700">Bulk Cleanup Utility</DialogTitle></DialogHeader><div className="p-6 space-y-4"><div className="bg-slate-50 p-4 border-2 border-black space-y-2"><p className="text-[10px] font-black uppercase opacity-40">Filter Context</p><p className="text-xs font-black">Records: {filteredData.length}</p><p className="text-xs font-black">Keyword: {particularsSearch || "NONE"}</p></div><div className="flex gap-4 items-start p-4 bg-amber-50 border-2 border-amber-200 text-amber-800"><Info className="size-5 shrink-0" /><p className="text-[10px] font-black uppercase">Ensure search is specific to avoid accidental data loss.</p></div><DialogFooter className="p-6 pt-2"><Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting || filteredData.length === 0} className="w-full font-black uppercase h-12 tracking-widest shadow-xl">{isDeleting ? <Loader2 className="animate-spin mr-2" /> : <Trash2 className="mr-2" />} Delete {filteredData.length} Records</Button></DialogFooter></div></DialogContent></Dialog>
    </div>
  );
}