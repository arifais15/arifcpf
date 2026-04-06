import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, Download, Share2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MemberLedgerPage({ params }: { params: { id: string } }) {
  // Normally fetch data based on params.id
  const member = {
    id: "2952",
    name: "Prokash Kumar Saha",
    designation: "AGM(MS)",
    office: "Hossainpur, Kishoregonj",
    joined: "21-Oct-2019",
    permanentAddress: "Vill: Paranbaria, Post: Demajani, Shajahanpur",
    nominated: "30-Oct-2020",
  };

  const ledgerEntries = [
    {
      date: "01-Aug-25",
      particulars: "Opening Balance",
      employeeContrib: "5,486.00",
      pbsContrib: "5,486.00",
      withdraws: "0",
      profitEmployee: "0.00",
      profitPBS: "0.00",
      totalFund: "10,972.00",
      principalOutstanding: "0.00",
      cumulativeBalance: "10,972.00"
    },
    {
      date: "31-Aug-25",
      particulars: "PJ-08-001",
      employeeContrib: "4,571.00",
      pbsContrib: "4,571.00",
      withdraws: "0",
      profitEmployee: "0.00",
      profitPBS: "0.00",
      totalFund: "9,142.00",
      principalOutstanding: "0.00",
      cumulativeBalance: "20,114.00"
    }
  ];

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <Link href="/members" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="size-4" />
          Back to Registry
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Printer className="size-4 mr-2" /> Print Form 224</Button>
          <Button variant="outline" size="sm"><Download className="size-4 mr-2" /> Export PDF</Button>
        </div>
      </div>

      <div className="bg-white p-12 shadow-sm rounded-lg border border-slate-200 max-w-6xl mx-auto w-full">
        {/* REB FORM HEADER */}
        <div className="text-center mb-10 space-y-1">
          <h2 className="text-xl font-bold uppercase">Kishoregonj PBS</h2>
          <h3 className="text-lg font-semibold border-b-2 border-slate-800 inline-block px-4">Provident Fund Subsidiary Ledger</h3>
          <p className="text-xs text-muted-foreground pt-2">REB Form no: 224</p>
        </div>

        {/* MEMBER INFO GRID */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-sm">
          <div className="space-y-2 border-r pr-12">
            <div className="flex justify-between"><span className="font-semibold">Name:</span> <span>{member.name}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Designation:</span> <span>{member.designation}</span></div>
            <div className="flex justify-between"><span className="font-semibold">ID No:</span> <span>{member.id}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Zonal Office:</span> <span>{member.office}</span></div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="font-semibold">Joined:</span> <span>{member.joined}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Permanent Addr:</span> <span className="text-right text-xs max-w-[200px]">{member.permanentAddress}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Nomination Date:</span> <span>{member.nominated}</span></div>
          </div>
        </div>

        {/* LEDGER TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th rowSpan={2} className="border p-2 text-left">Date</th>
                <th rowSpan={2} className="border p-2 text-left">Particulars</th>
                <th colSpan={3} className="border p-1 text-center bg-slate-100">Provident Fund</th>
                <th colSpan={2} className="border p-1 text-center bg-slate-100">Profit on Fund</th>
                <th rowSpan={2} className="border p-2 text-right">Total Fund</th>
                <th rowSpan={2} className="border p-2 text-right">Loan Outstanding</th>
                <th rowSpan={2} className="border p-2 text-right font-bold bg-primary/5">Cumulative Balance</th>
              </tr>
              <tr className="bg-slate-50">
                <th className="border p-1 text-right">Employee</th>
                <th className="border p-1 text-right">PBS</th>
                <th className="border p-1 text-right">Withdraws</th>
                <th className="border p-1 text-right">Employee</th>
                <th className="border p-1 text-right">PBS</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="border p-2 text-slate-600">{row.date}</td>
                  <td className="border p-2 font-medium">{row.particulars}</td>
                  <td className="border p-2 text-right">{row.employeeContrib}</td>
                  <td className="border p-2 text-right">{row.pbsContrib}</td>
                  <td className="border p-2 text-right">{row.withdraws}</td>
                  <td className="border p-2 text-right">{row.profitEmployee}</td>
                  <td className="border p-2 text-right">{row.profitPBS}</td>
                  <td className="border p-2 text-right">{row.totalFund}</td>
                  <td className="border p-2 text-right">{row.principalOutstanding}</td>
                  <td className="border p-2 text-right font-bold bg-primary/5">{row.cumulativeBalance}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={2} className="border p-2 text-center uppercase tracking-wider">Total</td>
                <td className="border p-2 text-right">10,057.00</td>
                <td className="border p-2 text-right">10,057.00</td>
                <td className="border p-2 text-right">0</td>
                <td className="border p-2 text-right">0.00</td>
                <td className="border p-2 text-right">0.00</td>
                <td className="border p-2 text-right">20,114.00</td>
                <td className="border p-2 text-right">0.00</td>
                <td className="border p-2 text-right bg-primary/10">20,114.00</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="mt-20 flex justify-between items-end">
          <div className="text-center space-y-1">
            <div className="w-40 border-t border-slate-800 pt-2"></div>
            <p className="text-[10px] font-bold">Employee Signature</p>
          </div>
          <div className="text-center space-y-1">
            <div className="w-40 border-t border-slate-800 pt-2"></div>
            <p className="text-[10px] font-bold">Accountant / AGM Finance</p>
          </div>
          <div className="text-center space-y-1">
            <div className="w-40 border-t border-slate-800 pt-2"></div>
            <p className="text-[10px] font-bold">General Manager</p>
          </div>
        </div>
      </div>
    </div>
  );
}
