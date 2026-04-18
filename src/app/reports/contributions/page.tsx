
"use client"

import { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, ArrowRightLeft, Trash2, DatabaseZap, Info, ArrowLeft, FileSpreadsheet, ShieldAlert, Search } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, useDoc, deleteDocumentNonBlocking } from "@/firebase";
import { collection, collectionGroup, doc } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export default function ContributionAuditPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();

  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = (generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2").toUpperCase();

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedFY, setSelectedFY] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessingCleanup, setIsProcessingCleanup] = useState(false);

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

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members } = useCollection(membersRef);
  
  const memberMap = useMemo(() => {
    const map: Record<string, any> = {};
    members?.forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const summariesRef = useMemoFirebase(() => collectionGroup(firestore, "fundSummaries"), [firestore]);
  const { data: allSummaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  const filteredData = useMemo(() => {
    if (!allSummaries || isProcessingCleanup) return [];
    let data = allSummaries;
    
    // 1. Date Range Filter
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      data = data.filter(item => { 
        const d = new Date(item.summaryDate).getTime(); 
        return d >= s && d <= e; 
      });
    }

    // 2. Global Search (ID, Name, Desig, Particulars)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(item => {
        const m = memberMap[item.memberId];
        return (
          item.particulars?.toLowerCase().includes(q) ||
          m?.memberIdNumber?.toLowerCase().includes(q) ||
          m?.name?.toLowerCase().includes(q) ||
          m?.designation?.toLowerCase().includes(q)
        );
      });
    }

    return data.sort((a, b) => new Date(b.summaryDate).getTime() - new Date(a.summaryDate).getTime());
  }, [allSummaries, dateRange, searchQuery, isProcessingCleanup, memberMap]);

  const stats = useMemo(() => {
    const s = { systemProfit: 0, manualEmp: 0, manualPbs: 0, totalEntries: filteredData.length };
    if (isProcessingCleanup) return s;
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
  }, [filteredData, isProcessingCleanup]);

  const handleBulkDelete = async () => {
    if (filteredData.length === 0) return;
    showAlert({
      title: "Institutional Purge",
      description: `Permanently delete ${filteredData.length} records matching current filter?`,
      type: "warning",
      showCancel: true,
      confirmText: "Delete Records",
      onConfirm: async () => {
        setIsDeleting(true);
        setIsProcessingCleanup(true);
        
        for (const item of filteredData) {
          deleteDocumentNonBlocking(doc(firestore, "members", item.memberId, "fundSummaries", item.id));
        }

        setTimeout(() => {
          setIsDeleting(false);
          setIsProcessingCleanup(false);
          setIsCleanupOpen(false);
          showAlert({ title: "Audit Synchronized", description: "Batch deletion completed successfully.", type: "success" });
        }, 1500);
      }
    });
  };

  const exportToExcel = () => {
    if (filteredData.length === 0) return;
    const exportRows = filteredData.map(item => {
      const m = memberMap[item.memberId];
      return {
        "ID No": m?.memberIdNumber || "N/A",
        "Name": m?.name || "N/A",
        "Designation": m?.designation || "N/A",
        "Date": item.summaryDate,
        "Particulars": item.particulars,
        "Emp Contrib (1)": Number(item.employeeContribution || 0),
        "Loan Draw (2)": Number(item.loanWithdrawal || 0),
        "Loan Repay (3)": Number(item.loanRepayment || 0),
        "Profit Emp (5)": Number(item.profitEmployee || 0),
        "Profit Loan (6)": Number(item.profitLoan || 0),
        "PBS Contrib (8)": Number(item.pbsContribution || 0),
        "Profit PBS (9)": Number(item.profitPbs || 0)
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contribution Audit");
    XLSX.writeFile(wb, `Audit_Registry_${dateRange.start}_to_${dateRange.end}.xlsx`);
    toast({ title: "Exported", description: "Full audit registry saved to Excel." });
  };

  if (isSummariesLoading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin size-12 text-black" /></div>;

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-[#000000]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-1.5 hover:bg-slate-100 rounded-full border-2 border-black"><ArrowLeft className="size-5 text-black" /></Link>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black uppercase tracking-tight">Audit & Tracking Matrix</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cross-Referenced Subsidiary Ledger Movements</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-2 border-2 border-black rounded-xl shadow-xl">
          <div className="grid gap-1">
            <Label className="text-[9px] font-black uppercase text-black ml-1">Period Filter</Label>
            <Select value={selectedFY} onValueChange={handleFYChange}>
              <SelectTrigger className="h-8 w-[100px] border-black border-2 font-black text-[10px] uppercase focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableFYs.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs">FY {fy}</SelectItem>)}
                <SelectItem value="all" className="font-black text-xs">ALL TIME</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-black ml-1">From</Label><Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start:e.target.value})} className="h-8 w-32 border-black border-2 text-[10px] font-black" /></div>
          <ArrowRightLeft className="size-3 text-black opacity-30 mt-4" />
          <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-black ml-1">To</Label><Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end:e.target.value})} className="h-8 w-32 border-black border-2 text-[10px] font-black" /></div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={exportToExcel} className="h-9 border-black border-2 font-black text-[10px] px-4 uppercase bg-white hover:bg-slate-50"><FileSpreadsheet className="size-3.5 mr-2" /> Export</Button>
            <Button variant="destructive" onClick={() => setIsCleanupOpen(true)} className="h-9 font-black text-[10px] px-4 uppercase shadow-lg"><DatabaseZap className="size-3.5 mr-2" /> Purge</Button>
            <Button onClick={() => window.print()} className="h-9 bg-black text-white font-black text-[10px] px-6 uppercase shadow-lg"><Printer className="size-3.5 mr-2" /> Print Audit</Button>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 border-2 border-black shadow-xl flex items-center gap-6 no-print">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-black/40" />
          <Input 
            className="pl-10 h-12 bg-slate-50 border-black border-2 font-black text-lg" 
            placeholder="Search Member ID, Name, Desig, or Particulars..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
        </div>
        <div className="flex gap-4">
           <Badge className="bg-black text-white font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-none h-12 shadow-md">{filteredData.length} Records Found</Badge>
        </div>
      </div>

      <div className="relative bg-white border-2 border-black rounded-none shadow-2xl overflow-hidden min-h-[500px]">
        {isProcessingCleanup && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300">
             <div className="p-10 bg-black rounded-3xl shadow-2xl flex flex-col items-center gap-5 border-4 border-white/20">
                <Loader2 className="size-16 animate-spin text-white" />
                <div className="text-center">
                  <p className="text-white font-black uppercase tracking-[0.4em] text-sm">Purging Transaction Matrix</p>
                  <p className="text-slate-500 text-[10px] font-black mt-1 uppercase tracking-widest">Reconciling Subsidiary Ledger States...</p>
                </div>
             </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table className="text-[#000000] font-black table-fixed w-full border-collapse text-[8.5px]">
            <TableHeader className="bg-slate-100 border-b-2 border-black uppercase text-[7px] leading-tight font-black">
              <TableRow className="h-10">
                <TableHead className="w-[50px] border-r border-black p-1 text-center h-10 text-black font-black">ID No</TableHead>
                <TableHead className="w-[120px] border-r-2 border-black p-1 text-left text-black font-black">Personnel Details</TableHead>
                <TableHead className="w-[70px] border-r border-black p-1 text-center text-black font-black">Date</TableHead>
                <TableHead className="w-[150px] border-r-2 border-black p-1 text-left text-black font-black">Particulars</TableHead>
                
                {/* 7 Statutory Columns */}
                <TableHead className="w-[65px] border-r border-black text-right p-1 text-black font-black bg-blue-50/30">Emp(1)</TableHead>
                <TableHead className="w-[65px] border-r border-black text-right p-1 text-black font-black">Draw(2)</TableHead>
                <TableHead className="w-[65px] border-r border-black text-right p-1 text-black font-black">Repay(3)</TableHead>
                <TableHead className="w-[65px] border-r border-black text-right p-1 text-black font-black bg-orange-50/30">P.Emp(5)</TableHead>
                <TableHead className="w-[65px] border-r border-black text-right p-1 text-black font-black">P.Loan(6)</TableHead>
                <TableHead className="w-[65px] border-r border-black text-right p-1 text-black font-black bg-emerald-50/30">PBS(8)</TableHead>
                <TableHead className="w-[65px] text-right p-1 text-black font-black">P.PBS(9)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {filteredData.map((item, idx) => {
                const m = memberMap[item.memberId];
                return (
                  <TableRow key={idx} className="border-b border-black hover:bg-slate-50 h-10 transition-colors">
                    <td className="p-1 border-r border-black font-mono text-center font-bold text-black">{m?.memberIdNumber}</td>
                    <td className="p-1 border-r-2 border-black leading-tight">
                      <div className="flex flex-col">
                        <span className="truncate uppercase font-black">{m?.name}</span>
                        <span className="text-[7px] opacity-60 uppercase">{m?.designation}</span>
                      </div>
                    </td>
                    <td className="p-1 border-r border-black text-center font-mono text-black">{item.summaryDate}</td>
                    <td className="p-1 border-r-2 border-black truncate uppercase text-black">{item.particulars}</td>
                    
                    <td className="p-1 border-r border-black text-right bg-blue-50/10 text-black">{Number(item.employeeContribution||0).toLocaleString()}</td>
                    <td className="p-1 border-r border-black text-right text-rose-600">{Number(item.loanWithdrawal||0).toLocaleString()}</td>
                    <td className="p-1 border-r border-black text-right text-emerald-600">{Number(item.loanRepayment||0).toLocaleString()}</td>
                    <td className="p-1 border-r border-black text-right bg-orange-50/10 text-black">{Number(item.profitEmployee||0).toLocaleString()}</td>
                    <td className="p-1 border-r border-black text-right text-black">{Number(item.profitLoan||0).toLocaleString()}</td>
                    <td className="p-1 border-r border-black text-right bg-emerald-50/10 text-black">{Number(item.pbsContribution||0).toLocaleString()}</td>
                    <td className="p-1 text-right text-black">{Number(item.profitPbs||0).toLocaleString()}</td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isCleanupOpen} onOpenChange={setIsCleanupOpen}>
        <DialogContent className="border-4 border-black max-w-xl p-0 overflow-hidden rounded-none shadow-2xl">
          <DialogHeader className="bg-rose-50 p-8 border-b-4 border-black">
            <DialogTitle className="text-2xl font-black uppercase text-rose-700 flex items-center gap-4">
              <ShieldAlert className="size-8" />
              Institutional Cleanup Terminal
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="bg-slate-900 text-white p-6 border-2 border-black space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Filter Confirmation Audit</p>
              <div className="flex justify-between items-center">
                <span className="text-sm font-black">MATCHED RECORDS:</span>
                <span className="text-xl font-black text-rose-400">{filteredData.length} Items</span>
              </div>
              <p className="text-[10px] font-black border-t border-white/10 pt-2 uppercase">Active Search: <span className="text-emerald-400">"{searchQuery || 'ALL ENTRIES'}"</span></p>
            </div>
            
            <div className="p-5 bg-amber-50 border-4 border-amber-200 text-amber-900 rounded-xl flex gap-5 items-start">
              <Info className="size-8 shrink-0 mt-1" />
              <p className="text-[11px] leading-relaxed font-black uppercase tracking-tight">
                CRITICAL: This action permanently purges filtered records from all individual subsidiary ledgers. Ensure your search criteria is exact to avoid unintended data loss. Verify the record count above before committing.
              </p>
            </div>
            
            <DialogFooter className="pt-4">
              <Button 
                variant="destructive" 
                onClick={handleBulkDelete} 
                disabled={isDeleting || filteredData.length === 0} 
                className="w-full font-black uppercase h-16 tracking-[0.3em] shadow-2xl rounded-none border-2 border-white/20 text-base"
              >
                {isDeleting ? <Loader2 className="animate-spin mr-3 size-6" /> : <Trash2 className="mr-3 size-6" />} 
                Commit Purge of {filteredData.length} Records
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
