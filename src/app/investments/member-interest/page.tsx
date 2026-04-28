
"use client"

import { useState, useMemo, useEffect } from "react";
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
  Percent, 
  Loader2, 
  Calculator, 
  Calendar, 
  ArrowRight,
  Info,
  ShieldCheck,
  ArrowRightLeft,
  FileSpreadsheet,
  Printer,
  ArrowLeft
} from "lucide-react";
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  addDocumentNonBlocking,
  useDoc,
  getDocuments
} from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import Link from "next/link";

export default function CPFInterestPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const generalSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "general"), [firestore]);
  const { data: generalSettings } = useDoc(generalSettingsRef);
  const pbsName = generalSettings?.pbsName || "Gazipur Palli Bidyut Samity-2";

  const interestSettingsRef = useMemoFirebase(() => doc(firestore, "settings", "interest"), [firestore]);
  const { data: interestSettings } = useDoc(interestSettingsRef);

  const interestTiers = useMemo(() => {
    if (interestSettings?.tiers) return interestSettings.tiers;
    return [
      { limit: 1500000, rate: 0.13 },
      { limit: 3000000, rate: 0.12 },
      { limit: null, rate: 0.11 }
    ];
  }, [interestSettings]);

  const fyOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const activeFYStart = currentMonth >= 7 ? currentYear : currentYear - 1;
    for (let year = activeFYStart + 1; year >= 2015; year--) {
      const start = year;
      const end = (year + 1).toString().slice(-2);
      options.push(`${start}-${end}`);
    }
    return options;
  }, []);

  const [calculationMode, setCalculationMode] = useState<"fy" | "custom">("fy");
  const [selectedFY, setSelectedFY] = useState<string>(""); 
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [postingDate, setPostingDate] = useState("");
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [viewingDetails, setViewingDetails] = useState<any | null>(null);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 7 ? `${currentYear}-07-01` : `${currentYear - 1}-07-01`;
    const today = now.toISOString().split('T')[0];
    setCustomRange({ start: fyStart, end: today });
    if (fyOptions.length > 1) setSelectedFY(fyOptions[1]);
    else if (fyOptions.length > 0) setSelectedFY(fyOptions[0]);
  }, [fyOptions]);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: rawMembers, isLoading: isMembersLoading } = useCollection(membersRef);
  
  const activeMembers = useMemo(() => rawMembers?.filter(m => m.status === 'Active') || [], [rawMembers]);

  const calculateTieredAnnual = (balance: number) => {
    let totalInterest = 0;
    let remainingBalance = balance;
    let prevLimit = 0;
    for (const tier of interestTiers) {
      if (remainingBalance <= 0) break;
      if (tier.limit === null) {
        totalInterest += remainingBalance * tier.rate;
        break;
      } else {
        const tierCapacity = tier.limit - prevLimit;
        const amountInTier = Math.min(remainingBalance, tierCapacity);
        totalInterest += amountInTier * tier.rate;
        remainingBalance -= amountInTier;
        prevLimit = tier.limit;
      }
    }
    return totalInterest;
  };

  const handleRunCPFCalculation = async () => {
    if (activeMembers.length === 0) return;
    setIsCalculating(true);
    setPreviewData([]);
    setProgress(0);

    if (calculationMode === 'fy') {
      const [startYearStr] = selectedFY.split("-");
      setPostingDate(`${parseInt(startYearStr) + 1}-06-30`);
    } else {
      setPostingDate(customRange.end);
    }

    const results = [];
    const modeLabel = calculationMode === 'fy' ? `FY ${selectedFY}` : `Custom Range`;

    for (let i = 0; i < activeMembers.length; i++) {
      const member = activeMembers[i];
      const summariesRef = collection(firestore, "members", member.id, "fundSummaries");
      const snapshot = await getDocuments(summariesRef);
      
      // Explicit Sort for Local PC Accuracy
      const summaries = snapshot.docs
        .map(doc => doc.data())
        .sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime());

      const isAlreadyPosted = summaries.some(s => s.particulars?.includes(`Profit ${modeLabel}`));

      let totalInterest = 0;
      let finalEmployeeFund = 0;
      let finalOfficeFund = 0;

      summaries.forEach((row: any) => {
        const v = { c1: Number(row.employeeContribution)||0, c2: Number(row.loanWithdrawal)||0, c3: Number(row.loanRepayment)||0, c5: Number(row.profitEmployee)||0, c6: Number(row.profitLoan)||0, c8: Number(row.pbsContribution)||0, c9: Number(row.profitPbs)||0 };
        finalEmployeeFund += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6);
        finalOfficeFund += (v.c8 + v.c9);
      });

      const basisDates: Date[] = [];
      if (calculationMode === 'fy') {
        const [startYearStr] = selectedFY.split("-");
        const startYear = parseInt(startYearStr);
        for (let m = 0; m < 12; m++) {
          let mIdx, yr;
          if (m === 0) { mIdx = 5; yr = startYear; }
          else { mIdx = (m + 5) % 12; yr = m < 7 ? startYear : startYear + 1; }
          basisDates.push(new Date(yr, mIdx + 1, 0, 23, 59, 59, 999));
        }
      } else {
        const start = new Date(customRange.start);
        const end = new Date(customRange.end);
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
        const opening = new Date(start);
        opening.setDate(opening.getDate() - 1);
        opening.setHours(23, 59, 59, 999);
        basisDates.push(opening);
        for (let m = 0; m < months - 1; m++) basisDates.push(new Date(start.getFullYear(), start.getMonth() + m + 1, 0, 23, 59, 59, 999));
      }

      const monthlyBreakdown = [];
      for (const targetDate of basisDates) {
        let runningBalanceBasis = 0;
        summaries.forEach((row: any) => {
          if (new Date(row.summaryDate).getTime() <= targetDate.getTime()) {
            const v = { c1: Number(row.employeeContribution)||0, c2: Number(row.loanWithdrawal)||0, c3: Number(row.loanRepayment)||0, c5: Number(row.profitEmployee)||0, c6: Number(row.profitLoan)||0, c8: Number(row.pbsContribution)||0, c9: Number(row.profitPbs)||0 };
            runningBalanceBasis += (v.c1 - v.c2 + v.c3 + v.c5 + v.c6 + v.c8 + v.c9);
          }
        });
        const monthlyPortion = calculateTieredAnnual(runningBalanceBasis) / 12;
        totalInterest += monthlyPortion;
        monthlyBreakdown.push({ label: targetDate.toLocaleDateString('default', { month: 'short', year: 'numeric' }), dateStr: targetDate.toISOString().split('T')[0], isOpening: targetDate.getDate() !== 31 && targetDate.getMonth() === 5 && calculationMode === 'fy', balance: runningBalanceBasis, interest: monthlyPortion });
      }

      const totalFundAtEnd = finalEmployeeFund + finalOfficeFund;
      const employeeProfit = totalFundAtEnd > 0 ? (totalInterest * finalEmployeeFund) / totalFundAtEnd : totalInterest / 2;
      const pbsProfit = totalFundAtEnd > 0 ? (totalInterest * finalOfficeFund) / totalFundAtEnd : totalInterest / 2;

      results.push({ memberId: member.id, memberIdNumber: member.memberIdNumber, name: member.name, designation: member.designation || "N/A", calculatedInterest: totalInterest, employeeProfit, pbsProfit, employeeFund: finalEmployeeFund, officeFund: finalOfficeFund, isPosted: isAlreadyPosted, monthlyDetails: monthlyBreakdown });
      setProgress(Math.round(((i + 1) / activeMembers.length) * 100));
    }
    setPreviewData(results);
    setIsCalculating(false);
    toast({ title: "Audit Matrix Generated", description: `Processed ${results.length} active personnel.` });
  };

  const handlePostAllInterest = async () => {
    if (previewData.length === 0 || !postingDate) return;
    const unpostedItems = previewData.filter(item => !item.isPosted);
    if (unpostedItems.length === 0) return;
    setIsPosting(true);
    const modeLabel = calculationMode === 'fy' ? `FY ${selectedFY}` : `Custom Range`;
    for (const item of unpostedItems) {
      if (item.calculatedInterest <= 0) continue;
      const entryData = { 
        summaryDate: postingDate, 
        particulars: `Profit ${modeLabel}`, 
        employeeContribution: 0, 
        loanWithdrawal: 0, 
        loanRepayment: 0, 
        profitEmployee: Math.round(item.employeeProfit), 
        profitLoan: 0, 
        pbsContribution: 0, 
        profitPbs: Math.round(item.pbsProfit),
        lastUpdateDate: new Date().toISOString(), 
        createdAt: new Date().toISOString(), 
        memberId: item.memberId 
      };
      await addDocumentNonBlocking(collection(firestore, "members", item.memberId, "fundSummaries"), entryData);
    }
    setIsPosting(false);
    setPreviewData([]);
    toast({ title: "Posted", description: "Interest distribution synchronized to all active ledgers." });
  };

  const exportToExcel = () => {
    if (previewData.length === 0) return;
    const exportRows = previewData.map(item => ({ 
      "Member ID": item.memberIdNumber, 
      "Name": item.name, 
      "Designation": item.designation, 
      "Profit (Emp)": item.employeeProfit.toFixed(2), 
      "Profit (PBS)": item.pbsProfit.toFixed(2), 
      "Total Profit": item.calculatedInterest.toFixed(2) 
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Annual Interest Audit");
    XLSX.writeFile(wb, `CPF_Profit_Audit_${selectedFY || 'Custom'}.xlsx`);
    toast({ title: "Exported", description: "Audit matrix saved to Excel." });
  };

  const totalCPFProfit = useMemo(() => previewData.reduce((sum, item) => sum + item.calculatedInterest, 0), [previewData]);
  const hasUnpostedEntries = useMemo(() => previewData.some(item => !item.isPosted && item.calculatedInterest > 0), [previewData]);

  return (
    <div className="p-8 flex flex-col gap-8 bg-white min-h-screen font-ledger text-black">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <Link href="/investments" className="p-2 border-2 border-black rounded-full hover:bg-slate-100 transition-colors"><ArrowLeft className="size-6 text-black" /></Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase">Member Interest Accrual</h1>
            <p className="text-black uppercase tracking-widest text-[10px] font-black bg-black text-white px-2 py-0.5 inline-block rounded">Annual Profit Distribution Matrix</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-2xl border-2 border-black shadow-xl">
          <Tabs value={calculationMode} onValueChange={(v: any) => setCalculationMode(v)}>
            <TabsList className="bg-slate-100 border-2 border-black h-10 p-1">
              <TabsTrigger value="fy" className="text-[10px] font-black uppercase data-[state=active]:bg-black data-[state=active]:text-white">Fiscal Year</TabsTrigger>
              <TabsTrigger value="custom" className="text-[10px] font-black uppercase data-[state=active]:bg-black data-[state=active]:text-white">Custom Range</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="h-6 w-px bg-black hidden sm:block" />

          {calculationMode === 'fy' ? (
            <Select value={selectedFY} onValueChange={setSelectedFY}>
              <SelectTrigger className="w-[140px] border-2 border-black font-black text-xs h-9 uppercase"><SelectValue /></SelectTrigger>
              <SelectContent>{fyOptions.map(fy => <SelectItem key={fy} value={fy} className="font-black text-xs uppercase">FY {fy}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2">
              <Input type="date" value={customRange.start} max="9999-12-31" onChange={(e) => setCustomRange({...customRange, start: e.target.value})} className="h-9 text-xs border-2 border-black font-black" />
              <ArrowRightLeft className="size-3 text-black" />
              <Input type="date" value={customRange.end} max="9999-12-31" onChange={(e) => setCustomRange({...customRange, end: e.target.value})} className="h-9 text-xs border-2 border-black font-black" />
            </div>
          )}

          <Button onClick={handleRunCPFCalculation} disabled={isCalculating || isPosting || isMembersLoading} className="gap-2 font-black uppercase text-[10px] h-9 px-6 bg-black text-white hover:bg-black/90 shadow-lg">
            {isCalculating ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
            Run Audit
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 no-print">
        <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-black">Audit Scope</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black">{activeMembers.length} Active Members</div></CardContent>
        </Card>
        <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-black">Computed Profit</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-black tabular-nums">৳ {totalCPFProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></CardContent>
        </Card>
        <Card className={cn("border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]", hasUnpostedEntries ? "bg-white" : "bg-black text-white")}>
          <CardHeader className="pb-2"><CardTitle className={cn("text-[10px] font-black uppercase tracking-widest", hasUnpostedEntries ? "text-black" : "text-white")}>Sync Status</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-black uppercase">
              {previewData.length > 0 ? (hasUnpostedEntries ? "Pending Sync" : "Verified") : "Ready"}
            </div>
          </CardContent>
        </Card>
      </div>

      {isCalculating && (
        <div className="max-w-md mx-auto text-center space-y-4 no-print py-12">
          <p className="text-xs font-black uppercase tracking-[0.2em]">Auditing Local PC Registry...</p>
          <Progress value={progress} className="h-3 border-2 border-black bg-slate-100 rounded-none" />
          <p className="text-[10px] font-black uppercase">{progress}% Complete</p>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="bg-white rounded-none shadow-2xl border-4 border-black overflow-hidden no-print animate-in fade-in duration-500">
          <div className="p-6 border-b-4 border-black bg-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col gap-3">
              <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-3">
                <ShieldCheck className="size-5" /> Local PC Audit Preview: {calculationMode === 'fy' ? `FY ${selectedFY}` : `Range`}
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToExcel} className="h-8 gap-2 font-black text-[10px] border-black border-2 bg-white hover:bg-slate-50 uppercase tracking-widest">
                  <FileSpreadsheet className="size-3.5" /> Export Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 gap-2 font-black text-[10px] border-black border-2 bg-white hover:bg-slate-50 uppercase tracking-widest">
                  <Printer className="size-3.5" /> Print Statement
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white p-3 border-2 border-black shadow-lg">
              <div className="grid gap-1">
                <Label className="text-[9px] uppercase font-black text-black">Ledger Posting Date</Label>
                <Input type="date" value={postingDate} max="9999-12-31" onChange={(e) => setPostingDate(e.target.value)} className="h-8 text-[10px] border-black border-2 font-black" />
              </div>
              <div className="h-8 w-0.5 bg-black" />
              <Button 
                onClick={handlePostAllInterest} 
                disabled={isPosting || !hasUnpostedEntries || !postingDate} 
                className={cn("gap-2 font-black uppercase text-[10px] h-9 px-6", hasUnpostedEntries && postingDate ? "bg-black text-white" : "bg-slate-200 text-slate-400")}
              >
                {isPosting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                Sync to Local Ledger
              </Button>
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 border-b-2 border-black font-black">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-black py-4 pl-6 text-black">ID No</TableHead>
                  <TableHead className="text-[10px] uppercase font-black py-4 text-black">Name & Designation</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black py-4 text-black">Profit (Emp)</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black py-4 text-black">Profit (PBS)</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black py-4 bg-slate-50 text-black">Total Profit</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black py-4 pr-6 text-black">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums font-black text-black">
                {previewData.map((item) => (
                  <TableRow key={item.memberId} className={cn("hover:bg-slate-50 border-b border-black", item.isPosted && "bg-slate-100/50 opacity-60")}>
                    <td className="font-mono text-xs pl-6 py-4">{item.memberIdNumber}</td>
                    <td className="py-4"><div><p className="text-xs font-black uppercase">{item.name}</p><p className="text-[9px] opacity-70 uppercase">{item.designation}</p></div></td>
                    <td className="text-right py-4">{item.employeeProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-right py-4">{item.pbsProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-right py-4 bg-slate-50 font-black cursor-pointer group" onClick={() => setViewingDetails(item)}>
                      <div className="flex items-center justify-end gap-2">
                        <span>৳ {item.calculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        <Info className="size-3.5 opacity-0 group-hover:opacity-100 text-black" />
                      </div>
                    </td>
                    <td className="text-center pr-6 py-4">
                      <Badge variant="outline" className={cn("text-[9px] uppercase font-black border-black rounded-none", item.isPosted ? "bg-black text-white" : "bg-white text-black")}>
                        {item.isPosted ? "Posted" : "Verified"}
                      </Badge>
                    </td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Detail Breakdown Dialog */}
      <Dialog open={!!viewingDetails} onOpenChange={(open) => !open && setViewingDetails(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto font-ledger text-black border-4 border-black p-0 rounded-none shadow-2xl">
          <DialogHeader className="p-8 border-b-4 border-black bg-slate-50">
            <DialogTitle className="flex items-center gap-4 text-2xl font-black uppercase tracking-tight">
              <Calculator className="size-8 text-black" />
              Profit Calculation Breakdown
            </DialogTitle>
            <DialogDescription className="font-black text-slate-500 text-[11px] uppercase tracking-[0.25em] mt-2">
              {viewingDetails?.name} ({viewingDetails?.memberIdNumber}) • {calculationMode === 'fy' ? `FY ${selectedFY}` : `Custom Audit Range`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-8 space-y-10">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Aggregate Profit</p>
                <p className="text-2xl font-black text-black">৳ {viewingDetails?.calculatedInterest?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-white p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Equity Split (Emp)</p>
                <p className="text-xl font-black text-black">৳ {viewingDetails?.employeeProfit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-white p-6 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Matching Share (PBS)</p>
                <p className="text-xl font-black text-black">৳ {viewingDetails?.pbsProfit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="border-2 border-black overflow-hidden shadow-xl">
              <Table className="font-black text-black tabular-nums">
                <TableHeader className="bg-slate-100 border-b-2 border-black">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pl-6 text-black">Audit Basis Point</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4 text-black">Basis Balance (৳)</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4 pr-6 text-black">Monthly Portion (৳)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingDetails?.monthlyDetails?.map((month: any, idx: number) => (
                    <TableRow key={idx} className={cn("hover:bg-slate-50 transition-colors border-b border-black", month.isOpening && "bg-blue-50/30")}>
                      <TableCell className="text-xs font-black py-4 pl-6 flex items-center gap-3">
                        {month.label}
                        {month.isOpening && <Badge className="text-[8px] h-4 uppercase px-2 bg-black text-white rounded-none">Opening Anchor</Badge>}
                      </TableCell>
                      <td className="p-4 text-right text-xs">
                        {month.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-black text-black text-xs pr-6">
                        {month.interest.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot className="bg-slate-50 border-t-2 border-black font-black">
                  <tr className="h-14">
                    <td className="p-4 text-right text-[10px] uppercase tracking-widest pl-6">Computed Audit Profit:</td>
                    <td colSpan={2} className="p-4 text-right text-black text-xl pr-6 underline decoration-double">
                      ৳ {viewingDetails?.calculatedInterest?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </div>

            <div className="bg-slate-900 p-6 border-2 border-black flex gap-4 items-start shadow-xl">
              <ShieldCheck className="size-6 text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-white tracking-[0.2em]">Local PC Logic Verification</p>
                <p className="text-[11px] leading-relaxed text-slate-400 font-bold uppercase italic">
                  Profit is computed by aggregating 12 monthly snapshots derived from the project vault SQLite file. Each snapshot captures the total cumulative fund value at the end of the basis month, ensuring high-fidelity interest accrual.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-slate-100 p-6 border-t-4 border-black text-right">
            <Button variant="ghost" onClick={() => setViewingDetails(null)} className="font-black text-xs uppercase tracking-widest border-2 border-black hover:bg-white px-6">Close Matrix</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
