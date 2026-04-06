import { CHART_OF_ACCOUNTS } from "@/lib/coa-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Filter } from "lucide-react";

export default function COAPage() {
  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">Standardized PBS CPF Accounting Structure</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="size-4 mr-2" />
            Filter
          </Button>
          <Button size="sm">
            <Plus className="size-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-1">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9 h-10 max-w-sm" placeholder="Search accounts by name or code..." />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[150px]">Account Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Normal Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CHART_OF_ACCOUNTS.map((account) => (
              <TableRow key={account.code} className={account.isHeader ? "bg-muted/20 font-semibold" : ""}>
                <TableCell className="font-mono text-xs">{account.code}</TableCell>
                <TableCell className={account.isHeader ? "pl-4" : "pl-8"}>
                  {account.name}
                </TableCell>
                <TableCell>
                  {account.type && (
                    <Badge variant={account.type === 'Asset' ? "default" : account.type === 'Liability' ? 'outline' : 'secondary'}>
                      {account.type}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {account.balance && (
                    <span className={`text-xs ${account.balance === 'Debit' ? 'text-blue-600' : 'text-orange-600'} font-medium`}>
                      {account.balance}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!account.isHeader && (
                    <Button variant="ghost" size="sm">Edit</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
