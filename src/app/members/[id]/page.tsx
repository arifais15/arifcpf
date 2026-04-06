import { Button } from "@/components/ui/button";
import { Printer, Download, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MemberLedgerPage({ params }: { params: { id: string } }) {
  // Data matched exactly to the image provided
  const member = {
    id: "1932",
    name: "Md. Ariful Islam",
    designation: "AGM(Finance)",
    headOffice: "Razendrapur, Gazipur",
    currAddress: "",
    permanentAddress: "Baitkamari,chatra Kachari,pirganj,rangpur",
    joined: "25-Apr-2018",
    nominated: "28-Aug-2019",
  };

  const ledgerEntries = [
    {
      date: "28-Feb-25",
      particulars: "PJ-02-001",
      empContrib: "784.00",
      withdraws: "0",
      loanRepay: "0",
      loanBalance: "0",
      profitEmp: "0.00",
      profitLoan: "0.00",
      totalEmpFund: "784.00",
      pbsContrib: "653.00",
      profitPBS: "0.00",
      totalOfficeContrib: "653.00",
      cumulativeBalance: "1,437.00"
    },
    {
      date: "31-Mar-25",
      particulars: "PJ-03-001",
      empContrib: "5,486.00",
      withdraws: "0",
      loanRepay: "0",
      loanBalance: "0",
      profitEmp: "0.00",
      profitLoan: "0.00",
      totalEmpFund: "6,270.00",
      pbsContrib: "4,571.00",
      profitPBS: "0.00",
      totalOfficeContrib: "5,224.00",
      cumulativeBalance: "11,494.00"
    },
    {
      date: "30-Apr-25",
      particulars: "PJ-04-001",
      empContrib: "5,486.00",
      withdraws: "0",
      loanRepay: "0",
      loanBalance: "0",
      profitEmp: "0.00",
      profitLoan: "0.00",
      totalEmpFund: "11,756.00",
      pbsContrib: "4,571.00",
      profitPBS: "0.00",
      totalOfficeContrib: "9,795.00",
      cumulativeBalance: "21,551.00"
    },
    {
      date: "30-Jun-25",
      particulars: "Interest",
      empContrib: "0.00",
      withdraws: "0",
      loanRepay: "0",
      loanBalance: "0",
      profitEmp: "331.00",
      profitLoan: "0.00",
      totalEmpFund: "11,756.00",
      pbsContrib: "0.00",
      profitPBS: "276.00",
      totalOfficeContrib: "10,071.00",
      cumulativeBalance: "21,551.00"
    }
  ];

  return (
    <div className="p-4 flex flex-col gap-4 bg-slate-100 min-h-screen">
      <div className="flex items-center justify-between no-print max-w-[1200px] mx-auto w-full">
        <Link href="/members" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="size-4" />
          Back to Registry
        </Link>
        <div className="flex gap-2">
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
              <span className="border-b border-dotted border-black flex-1">{member.currAddress}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[100px]">Date of Joined:</span>
              <span className="font-bold border-b border-dotted border-black flex-1">{member.joined}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <span className="font-bold min-w-[120px]">Designation:</span>
              <span className="font-bold border-b border-dotted border-black flex-1">{member.designation}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[120px]">Head Office:</span>
              <span className="border-b border-dotted border-black flex-1">{member.headOffice}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold min-w-[120px]">Permanent Address:</span>
              <span className="border-b border-dotted border-black flex-1 text-[10px]">{member.permanentAddress}</span>
            </div>
            <div className="flex gap-x-8">
               <div className="flex gap-2 flex-1">
                <span className="font-bold min-w-[40px]">ID No:</span>
                <span className="font-bold border-b border-dotted border-black flex-1">{member.id}</span>
              </div>
              <div className="flex gap-2 flex-1">
                <span className="font-bold whitespace-nowrap">Date of Nomination:</span>
                <span className="font-bold border-b border-dotted border-black flex-1">{member.nominated}</span>
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
              {/* SUB HEADERS */}
              <tr className="bg-white">
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5 font-bold text-center leading-tight">Employee Contribution</th>
                <th className="border border-black p-0.5 font-bold text-center leading-tight">CPF Loan</th>
                <th className="border border-black p-0.5 font-bold text-center italic">7 = Prev + 1 - 2 + 3 + 5 + 6</th>
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5 font-bold text-center italic">10 = (8 + 9)</th>
                <th className="border border-black p-0.5 font-bold text-center italic">11 = (7 + 10)</th>
              </tr>
              {/* COLUMN NUMBERS */}
              <tr className="bg-white">
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5"></th>
                <th className="border border-black p-0.5 text-center font-bold">1</th>
                <th className="border border-black p-0.5 text-center font-bold">2</th>
                <th className="border border-black p-0.5 text-center font-bold">3</th>
                <th className="border border-black p-0.5 text-center font-bold">4</th>
                <th className="border border-black p-0.5 text-center font-bold">5</th>
                <th className="border border-black p-0.5 text-center font-bold">6</th>
                <th className="border border-black p-0.5 text-center font-bold"></th>
                <th className="border border-black p-0.5 text-center font-bold">8</th>
                <th className="border border-black p-0.5 text-center font-bold">9</th>
                <th className="border border-black p-0.5 text-center font-bold"></th>
                <th className="border border-black p-0.5 text-center font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((row, idx) => (
                <tr key={idx} className="bg-white">
                  <td className="border border-black p-1 whitespace-nowrap">{row.date}</td>
                  <td className="border border-black p-1">{row.particulars}</td>
                  <td className="border border-black p-1 text-right">{row.empContrib}</td>
                  <td className="border border-black p-1 text-right">{row.withdraws}</td>
                  <td className="border border-black p-1 text-right">{row.loanRepay}</td>
                  <td className="border border-black p-1 text-right">{row.loanBalance}</td>
                  <td className="border border-black p-1 text-right">{row.profitEmp}</td>
                  <td className="border border-black p-1 text-right">{row.profitLoan}</td>
                  <td className="border border-black p-1 text-right font-bold">{row.totalEmpFund}</td>
                  <td className="border border-black p-1 text-right">{row.pbsContrib}</td>
                  <td className="border border-black p-1 text-right">{row.profitPBS}</td>
                  <td className="border border-black p-1 text-right font-bold">{row.totalOfficeContrib}</td>
                  <td className="border border-black p-1 text-right font-bold">{row.cumulativeBalance}</td>
                </tr>
              ))}
              {/* TOTAL ROW */}
              <tr className="bg-white font-bold">
                <td colSpan={2} className="border border-black p-1 text-center">Total</td>
                <td className="border border-black p-1 text-right">11,756.00</td>
                <td className="border border-black p-1 text-right">0.00</td>
                <td className="border border-black p-1 text-right">0</td>
                <td className="border border-black p-1 text-right">0.00</td>
                <td className="border border-black p-1 text-right">331.00</td>
                <td className="border border-black p-1 text-right">0.00</td>
                <td className="border border-black p-1 text-right">11,756.00</td>
                <td className="border border-black p-1 text-right">9,795.00</td>
                <td className="border border-black p-1 text-right">276.00</td>
                <td className="border border-black p-1 text-right">10,071.00</td>
                <td className="border border-black p-1 text-right">21,551.00</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FOOTER SECTION */}
        <div className="mt-12 flex justify-between items-end text-[9px]">
           <p className="font-bold">{member.id}--{member.name}--{member.designation} =Page 1 of 1</p>
           <p className="text-right italic">CPF Management Software Developed by Ariful Islam Agm finance, contact: 017317530731</p>
        </div>
      </div>
    </div>
  );
}
