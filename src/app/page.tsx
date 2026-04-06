import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, ShieldCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const stats = [
    { title: "Total Members", value: "1,245", icon: Users, change: "+12", trend: "up" },
    { title: "Total Fund Value", value: "৳ 12.4M", icon: Wallet, change: "+5.2%", trend: "up" },
    { title: "Current Loans", value: "৳ 2.1M", icon: TrendingUp, change: "-1.4%", trend: "down" },
    { title: "Profit Distributed", value: "৳ 850K", icon: ArrowUpRight, change: "+8.1%", trend: "up" },
  ];

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-primary tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground">Welcome back, Auditor. Here's what's happening with the fund today.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm bg-card hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs flex items-center gap-1 mt-1">
                {stat.trend === "up" ? (
                  <span className="text-emerald-600 flex items-center"><ArrowUpRight className="size-3" /> {stat.change}</span>
                ) : (
                  <span className="text-rose-600 flex items-center"><ArrowDownRight className="size-3" /> {stat.change}</span>
                )}
                <span className="text-muted-foreground">from last month</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Particulars</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-sm">24 Oct 2023</TableCell>
                  <TableCell className="text-sm">Monthly Subscription - Kishoregonj PBS</TableCell>
                  <TableCell><Badge variant="outline">Contribution</Badge></TableCell>
                  <TableCell className="text-right font-medium">৳ 45,710.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-sm">22 Oct 2023</TableCell>
                  <TableCell className="text-sm">Loan Disbursement #L-982</TableCell>
                  <TableCell><Badge variant="secondary">Loan</Badge></TableCell>
                  <TableCell className="text-right font-medium text-rose-600">৳ 120,000.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-sm">20 Oct 2023</TableCell>
                  <TableCell className="text-sm">FDR Interest Accrued (101.10.0000)</TableCell>
                  <TableCell><Badge variant="outline">Investment</Badge></TableCell>
                  <TableCell className="text-right font-medium">৳ 12,400.00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Fund Allocation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 pt-4">
            <div className="space-y-4">
              {[
                { label: "Fixed Deposits (FDR)", value: 65, color: "bg-primary" },
                { label: "Treasury Bonds", value: 20, color: "bg-accent" },
                { label: "Member Loans", value: 10, color: "bg-slate-400" },
                { label: "Cash Equivalents", value: 5, color: "bg-emerald-400" },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
