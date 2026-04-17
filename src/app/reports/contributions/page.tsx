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
  ArrowRightLeft,
  Trash2,
  DatabaseZap,
  Info,
  ArrowLeft
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
  DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import Link from "next/link";

export default function ContributionAuditPage() {
  const firestore = useFirestore();
  const { showAlert } = useSweetAlert();

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedFY, setSelectedFY] = useState("");
  const [particularsSearch, setParticularsSearch] = useState("");
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const availableFYs = useMemo(() => {
    const fys = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const activeStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    for (let i = 0; i < 15; i++) {
      const start = activeStartYear - i;
      fys.push(`${start}-${(start + 1).toString().slice(-2)}`);
    }
    return fys;
  }, []);

  const handleFYChange = (fy: string) => {
    setSelectedFY(fy);
    if (fy === "all") {
      setDateRange({ start: "2010-01-01", end: new Date().toISOString().split('T')[0] });
    } else {
      const parts = fy.split("-");
      const startYear = parseInt(parts[0]);
      setDateRange({ start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` });
    }
  };

  useEffect(() => {
    if (availableFYs.length > 0 && !selectedFY) {
      handleFYChange(availableFYs[0]);
    }
  }, [availableFYs, selectedFY]);

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
      if (item.isManual || (!item.isSystemGenerated && !item.particulars?.includes("Profit"))) {
        s.manualEmp += (Number(item.employeeContribution) || 0);
        s.manualPbs += (Number(item.pbsContribution) || 0);
      }
    });
    return s;
  }, [filteredData]);

  const handleBulkDelete = async () => {
    if (filteredData.length === 0) return;
    showAlert({
      title: "Confirm Institutional Cleanup",
      description: `Permanently delete ${filteredData.length} records matching "${particularsSearch || 'All'}"?`,
      type: "warning",
      showCancel: true,
      confirmText: "Delete Records",
      onConfirm: async () => {
        setIsDeleting(true);
        for (const item of filteredData) {
          deleteDocumentNonBlocking(doc(firestore, "members", item.memberId, "fundSummaries", item.id));
        }
        setIsDeleting(false); setIsCleanupOpen(false);
        showAlert({ title: "Audit Synchronized", type: "success" });
      }
    });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-1.5 hover:bg-slate-100 rounded-full border border-black"><ArrowLeft className="size-5 text-black" /></Link>
          <h1 className="text-3xl font-black uppercase tracking-tight text-black">Audit & Tracking</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 border-2 border-black rounded-xl shadow-xl">
          <div className="grid gap-1">
            <Label className="text-[9px] font-black uppercase text-black">Quick FY</Label>
            <Select value={selectedFY} onValueChange={handleFYChange}>
              <SelectTrigger className="h-8 w-[100px] border-black text-xs font-black focus:ring-0 text-black"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}
                <SelectItem value="all" className="font-black text-xs">ALL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-black">Start</Label><Input type="date" value={dateRange.start} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="h-8 text-xs border-black border-2 font-black text-black" /></div>
          <ArrowRightLeft className="size-3 mt-4 text-black opacity-30" />
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-black">End</Label><Input type="date" value={dateRange.end} max="9999-12-31" onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="h-8 text-xs border-black border-2 font-black text-black" /></div>
          <div className="grid gap-1">
            <Label className="text-[9px] font-black uppercase text-black">Particulars</Label>
            <Input placeholder="Filter keyword..." value={particularsSearch} onChange={(e) => setParticularsSearch(e.target.value)} className="h-8 border-black border-2 font-black w-[150px] text-xs text-black" />
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="destructive" onClick={() => setIsCleanupOpen(true)} className="h-8 text-[10px] font-black uppercase gap-1"><DatabaseZap className="size-3" /> Cleanup</Button>
            <Button onClick={() => window.print()} className="h-8 text-[10px] font-black uppercase bg-black text-white gap-1"><Printer className="size-3" /> Print</Button>
          </div>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-4 no-print">
        {[{l:"SYSTEM PROFIT", v:stats.systemProfit}, {l:"PERSONNEL CONTRIB", v:stats.manualEmp}, {l:"PBS MATCHING", v:stats.manualPbs}, {l:"RECORDS", v:stats.totalEntries, isInt:true}].map((s,i) => (
          <Card key={i} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
            <CardHeader className="pb-1"><CardTitle className="text-[10px] font-black uppercase opacity-60 text-black">{s.l}</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-black text-black">{s.isInt ? s.v : `৳ ${s.v.toLocaleString()}`}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-white border-2 border-black rounded-none shadow-xl overflow-hidden">
        <Table className="font-black tabular-nums text-black">
          <TableHeader className="bg-slate-100 border-b-2 border-black">
            <TableRow>
              <TableHead className="font-black uppercase text-[10px] py-4 text-black">Date</TableHead>
              <TableHead className="font-black uppercase text-[10px] py-4 text-black">Particulars</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] py-4 text-black">Emp (৳)</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] py-4 text-black">PBS (৳)</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] py-4 text-black">Profit (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin size-8 mx-auto" /></TableCell></TableRow> : filteredData.map((item, idx) => (
              <TableRow key={idx} className="border-b border-black hover:bg-slate-50">
                <td className="p-4 font-mono text-xs text-black">{item.summaryDate}</td>
                <td className="p-4 uppercase text-[10px] truncate max-w-[300px] text-black">{item.particulars}</td>
                <td className="text-right p-4 text-black">{Number(item.employeeContribution||0).toLocaleString()}</td>
                <td className="text-right p-4 text-black">{Number(item.pbsContribution||0).toLocaleString()}</td>
                <td className="text-right p-4 text-black">{(Number(item.profitEmployee||0)+Number(item.profitPbs||0)).toLocaleString()}</td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCleanupOpen} onOpenChange={setIsCleanupOpen}>
        <DialogContent className="border-4 border-black max-w-xl p-0 overflow-hidden rounded-none shadow-2xl">
          <DialogHeader className="bg-rose-50 p-6 border-b-4 border-black">
            <DialogTitle className="text-xl font-black uppercase text-rose-700">Cleanup Terminal</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="bg-slate-50 p-4 border-2 border-black space-y-2">
              <p className="text-[10px] font-black uppercase opacity-40 text-black">Filter Verification</p>
              <p className="text-xs font-black text-black">Matched Records: {filteredData.length}</p>
              <p className="text-xs font-black text-black">Target Keyword: {particularsSearch || "NONE"}</p>
            </div>
            <div className="flex gap-4 items-start p-4 bg-amber-50 border-2 border-amber-200 text-amber-800">
              <Info className="size-5 shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed font-bold uppercase">To prevent accidental deletion of valid data, ensure your "Particulars" search is specific (e.g. "Opening Balance (Imported)"). Verify the record count in the list below before committing to delete.</p>
            </div>
            <DialogFooter className="p-6 pt-2">
              <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting || filteredData.length === 0} className="w-full font-black uppercase h-12 tracking-widest shadow-xl rounded-none">
                {isDeleting ? <Loader2 className="animate-spin mr-2" /> : <Trash2 className="mr-2" />} 
                Delete {filteredData.length} Matched Records
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
