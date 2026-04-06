import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle } from "lucide-react";
import Link from "next/link";

const MOCK_MEMBERS = [
  { id: "2952", name: "Prokash Kumar Saha", designation: "AGM(MS)", address: "Hossainpur, Kishoregonj", balance: "20,114.00" },
  { id: "1023", name: "Ariful Islam", designation: "AGM Finance", address: "Gazipur PBS-2", balance: "45,200.00" },
  { id: "4421", name: "Sumaiya Akhter", designation: "Accountant", address: "Dhaka PBS-1", balance: "12,150.00" },
];

export default function MembersPage() {
  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Members Registry</h1>
          <p className="text-muted-foreground">Manage and track individual member fund accounts</p>
        </div>
        <Button size="sm">
          <Plus className="size-4 mr-2" />
          Add New Member
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-1">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9 h-10 max-w-sm" placeholder="Search members by name, ID or designation..." />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">ID No</TableHead>
              <TableHead>Member Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Station / Office</TableHead>
              <TableHead className="text-right">Total Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_MEMBERS.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.id}</TableCell>
                <TableCell>{member.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{member.designation}</TableCell>
                <TableCell className="text-sm">{member.address}</TableCell>
                <TableCell className="text-right font-bold text-primary">৳ {member.balance}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/members/${member.id}`}>
                      <UserCircle className="size-4 mr-2" />
                      View Ledger
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
