
"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, ArrowLeft, Loader2, Plus, Calendar as CalendarIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useDoc, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function MemberLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isEntryOpen, setIsEntryOpen] = useState(false);

  const memberRef = useMemoFirebase(() => doc(firestore, "members", resolvedParams.id), [firestore, resolvedParams.id]);
  const { data: member, isLoading: isMemberLoading } = useDoc(memberRef);

  const summariesRef = useMemoFirebase(() => collection(firestore, "members", resolvedParams.id, "fundSummaries"), [firestore, resolvedParams.id]);
  const { data: summaries, isLoading: isSummariesLoading } = useCollection(summariesRef);

  // Sorting summaries by date
  const sortedSummaries = React.useMemo(() => {
    return [...(summaries || [])].sort((a, b) => new Date(a.summaryDate).getTime() - new Date(b.summaryDate).getTime());
  }, [summaries]);

  const totals = React.useMemo(() => {
    if (!summaries || summaries.length === 0) return null;
    return summaries.reduce((acc, curr) => ({
      emp: acc.emp + (Number(curr.employeeContributionCumulative) || 0),
      pbs: acc.pbs + (Number(curr.pbsContributionCumulative) || 0),
      profitEmp: acc.profitEmp + (Number(curr.profitEmployeeContributionCumulative) || 0),
      profitPbs: acc.profitPbs + (Number(curr.profitPbsContributionCumulative) || 0),
      total: acc.total + (Number(curr.totalFundCumulative) || 0)
    }), { emp: 0, pbs: 0, profitEmp: 0, profitPbs: 0, total: 0 });
  }, [summaries]);

  const handleAddEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const entryData = {
      summaryDate: formData.get("summaryDate"),
      particulars: formData.get("particulars"),
      employeeContributionCumulative: Number(formData.get("empContrib")),
      pbsContributionCumulative: Number(formData.get("pbsContrib")),
      profitEmployeeContributionCumulative: Number(formData.get("profitEmp")),
      profitPbsContributionCumulative: Number(formData.get("profitPbs")),
      loanPrincipalOutstandingCumulative: Number(formData.get("loanBalance")),
      totalFundCumulative: Number(formData.get("totalFund")),
      lastUpdateDate: new Date().toISOString(),
      memberId: resolvedParams.id
    };

    addDocumentNonBlocking(summariesRef, entryData);
    toast({ title: "Entry Added", description: "Ledger entry has been recorded." });
    setIsEntryOpen(false);
  };

  if (isMemberLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin size-8 text-primary" /></div>;
  }

  if (!member) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold">Member not found</h1>
        <Button asChild className="mt-4"><Link href="/members">Back to Registry</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 bg-slate-100 min-h-screen">
      <div className="flex items-center justify-between no-print max-w-[1200px] mx-auto w-full">
        <Link href="/members" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="size-4" />
          Back to Registry
        </Link>
        <div className="flex gap-2">
          <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm"><Plus className="size-4 mr-2" /> New Entry</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New Ledger Entry</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddEntry} className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Date</Label>
                  <Input name="summaryDate" type="date" required />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Particulars</Label>
                  <Input name="particulars" placeholder="e.g. PJ-02-001 or Interest" required />
                </div>
                <div className="space-y-2">
                  <Label>Emp. Contrib</Label>
                  <Input name="empContrib" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>PBS Contrib</Label>
                  <Input name="pbsContrib" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>Profit (Emp)</Label>
                  <Input name="profitEmp" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>Profit (PBS)</Label>
                  <Input name="profitPbs" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>Loan Balance</Label>
                  <Input name="loanBalance" type="number" step="0.01" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>Total Fund</Label>
                  <Input name="totalFund" type="number" step="0.01" defaultValue="0" />
                </div>
                <DialogFooter className="col-span-2">
                  <Button type="button" variant="outline" onClick={() => setIsEntryOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Entry</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4 mr-2" /> Print Form 224</Button>
          <Button variant="outline" size="sm"><Download className="size-4 mr-2" /> Export PDF</Button>
        </div>
      </div>

      <div className="bg-white p-10 shadow-lg rounded-none border border-slate-300 max-w-[1200px] mx-auto w-full font-serif text-[#1e1e1e] print:shadow-none print:border-none">
        {/* HEADER SECTION */}
        <div className="relative mb-6">
          <p className="text-[10px] absolute left-0 top-0">REB Form no: 224</p>
          <div className="text-center space-y-0.5">
            <h1 className="text-xl font-bold">Gazipur PBS-2</h1>
            <h2 className="text-lg font-bold underline decoration-1 underline-offset-4">Provident Fund Subsidiary Ledger</h2>
          </div>
        </div>

        {/* MEMBER INFORMATION GRID */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-[11px]">
          <div className="space-y-2">
            <div className="flex gap-2">
              <span className="font-bold min-w-[100px]">Name:</span>
              <span className="font-bold border-b border-dotted border-black flex-1">{member.name}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[100px]">Curr. Address:</span>
              <span className="border-b border-dotted border-black flex-1">{member.currentAddress || "-"}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[100px]">Date of Joined:</span>
              <span className="font-bold border-b border-dotted border-black flex-1">{member.dateJoined}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <span className="font-bold min-w-[120px]">Designation:</span>
              <span className="font-bold border-b border-dotted border-black flex-1">{member.designation}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[120px]">Zonal Office:</span>
              <span className="border-b border-dotted border-black flex-1">{member.zonalOffice || "-"}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[120px]">Permanent Address:</span>
              <span className="border-b border-dotted border-black flex-1 text-[10px]">{member.permanentAddress || "-"}</span>
            </div>
            <div className="flex gap-x-8">
               <div className="flex gap-2 flex-1">
                <span className="font-bold min-w-[40px]">ID No:</span>
                <span className="font-bold border-b border-dotted border-black flex-1">{member.memberIdNumber}</span>
              </div>
              <div className="flex gap-2 flex-1">
                <span className="font-bold whitespace-nowrap">Date of Nomination:</span>
                <span className="font-bold border-b border-dotted border-black flex-1">{member.dateNomination || "-"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* LEDGER TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] border-collapse border border-black">
            <thead>
              <tr className="bg-white">
                <th className="border border-black p-1 text-center font-bold">Date</th>
                <th className="border border-black p-1 text-center font-bold">Particulars</th>
                <th className="border border-black p-1 text-center font-bold">Employee Contribution</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Amount Withdraws as Loan</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Loan Principal repayment</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Balance of outstanding loan</th>
                <th colSpan={2} className="border border-black p-1 text-center font-bold">Profit on</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Total Employee's Fund</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">PBS Contribution</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Profit on PBS Contribution</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Total Office Contribution</th>
                <th className="border border-black p-1 text-center font-bold leading-tight">Cumulative Fund Balance</th>
              </tr>
              <tr className="bg-white">
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5 text-center font-bold">1</th>
                <th className="border border-black p-0.5 text-center font-bold">2</th>
                <th className="border border-black p-0.5 text-center font-bold">3</th>
                <th className="border border-black p-0.5 text-center font-bold">4</th>
                <th className="border border-black p-0.5 font-bold text-center leading-tight">Employee Contribution (5)</th>
                <th className="border border-black p-0.5 font-bold text-center leading-tight">CPF Loan (6)</th>
                <th className="border border-black p-0.5 font-bold text-center italic">7 = Prev + 1 - 2 + 3 + 5 + 6</th>
                <th className="border border-black p-0.5 text-center font-bold">8</th>
                <th className="border border-black p-0.5 text-center font-bold">9</th>
                <th className="border border-black p-0.5 font-bold text-center italic">10 = (8 + 9)</th>
                <th className="border border-black p-0.5 font-bold text-center italic">11 = (7 + 10)</th>
              </tr>
            </thead>
            <tbody>
              {isSummariesLoading ? (
                <tr><td colSpan={13} className="text-center p-4">Loading ledger...</td></tr>
              ) : sortedSummaries.length === 0 ? (
                <tr><td colSpan={13} className="text-center p-4 text-muted-foreground">No ledger entries found.</td></tr>
              ) : sortedSummaries.map((row: any, idx) => (
                <tr key={idx} className="bg-white">
                  <td className="border border-black p-1 whitespace-nowrap">{row.summaryDate}</td>
                  <td className="border border-black p-1">{row.particulars || "-"}</td>
                  <td className="border border-black p-1 text-right">{row.employeeContributionCumulative?.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-1 text-right">{row.loanPrincipalOutstandingCumulative?.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{row.profitEmployeeContributionCumulative?.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-1 text-right font-bold">{row.totalFundCumulative?.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{row.pbsContributionCumulative?.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{row.profitPbsContributionCumulative?.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-bold">{(Number(row.pbsContributionCumulative) + Number(row.profitPbsContributionCumulative))?.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-bold">{(Number(row.totalFundCumulative) + Number(row.pbsContributionCumulative) + Number(row.profitPbsContributionCumulative))?.toFixed(2)}</td>
                </tr>
              ))}
              {/* TOTAL ROW */}
              {totals && (
                <tr className="bg-white font-bold">
                  <td colSpan={2} className="border border-black p-1 text-center">Total</td>
                  <td className="border border-black p-1 text-right">{totals.emp.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-1 text-right">{totals.profitEmp.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-1 text-right">{totals.total.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{totals.pbs.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{totals.profitPbs.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{(totals.pbs + totals.profitPbs).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{(totals.total + totals.pbs + totals.profitPbs).toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER SECTION */}
        <div className="mt-12 flex justify-between items-end text-[9px]">
           <p className="font-bold">{member.memberIdNumber}--{member.name}--{member.designation} =Page 1 of 1</p>
           <p className="text-right italic">CPF Management Software Developed by Ariful Islam Agm finance, contact: 017317530731</p>
        </div>
      </div>
    </div>
  );
}
