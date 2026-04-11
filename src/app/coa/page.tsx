
"use client"

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { CHART_OF_ACCOUNTS as INITIAL_COA } from "@/lib/coa-data";

export default function COAPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const coaRef = useMemoFirebase(() => collection(firestore, "chartOfAccounts"), [firestore]);
  const { data: coaData, isLoading } = useCollection(coaRef);

  const displayAccounts = useMemo(() => {
    const data = coaData && coaData.length > 0 ? coaData : INITIAL_COA;
    return data
      .filter((acc: any) => 
        (acc.name || acc.accountName).toLowerCase().includes(search.toLowerCase()) || 
        (acc.code || acc.accountCode).includes(search)
      )
      .sort((a: any, b: any) => (a.code || a.accountCode).localeCompare(b.code || b.accountCode));
  }, [coaData, search]);

  const handleSaveAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const type = formData.get("type") as string;
    const balance = formData.get("balance") as string;
    
    const accountData = {
      accountCode: formData.get("code") as string,
      accountName: formData.get("name") as string,
      accountType: type === "none" ? "" : type,
      normalBalance: balance === "none" ? "" : balance,
      isHeader: formData.get("isHeader") === "true",
      updatedAt: new Date().toISOString()
    };

    if (editingAccount && editingAccount.id) {
      const docRef = doc(firestore, "chartOfAccounts", editingAccount.id);
      updateDocumentNonBlocking(docRef, accountData);
      showAlert({
        title: "Success",
        description: `${accountData.accountName} has been updated successfully.`,
        type: "success"
      });
    } else {
      addDocumentNonBlocking(coaRef, accountData);
      showAlert({
        title: "Added",
        description: `${accountData.accountName} is now in the Chart of Accounts.`,
        type: "success"
      });
    }
    setIsAddOpen(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = (id: string, name: string) => {
    showAlert({
      title: "Are you sure?",
      description: `You are about to delete account: ${name}. This action cannot be reversed.`,
      type: "warning",
      showCancel: true,
      confirmText: "Delete Account",
      onConfirm: () => {
        const docRef = doc(firestore, "chartOfAccounts", id);
        deleteDocumentNonBlocking(docRef);
        showAlert({
          title: "Deleted",
          description: "The account has been removed.",
          type: "success"
        });
      }
    });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage Standardized PBS CPF Accounting Structure</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingAccount(null); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-2" />
              Add New Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAccount ? "Edit Account" : "Add New Account"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveAccount} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Account Code</Label>
                  <Input id="code" name="code" placeholder="e.g. 101.10.0000" defaultValue={editingAccount?.code || editingAccount?.accountCode} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Account Type</Label>
                  <Select name="type" defaultValue={editingAccount ? (editingAccount.type || editingAccount.accountType || "none") : "Asset"}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asset">Asset</SelectItem>
                      <SelectItem value="Contra-Asset">Contra-Asset</SelectItem>
                      <SelectItem value="Liability">Liability</SelectItem>
                      <SelectItem value="Equity">Equity</SelectItem>
                      <SelectItem value="Income">Income</SelectItem>
                      <SelectItem value="Expense">Expense</SelectItem>
                      <SelectItem value="none">None (Header)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Account Name</Label>
                <Input id="name" name="name" placeholder="e.g. Cash in Hand" defaultValue={editingAccount?.name || editingAccount?.accountName} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="balance">Normal Balance</Label>
                  <Select name="balance" defaultValue={editingAccount ? (editingAccount.balance || editingAccount.normalBalance || "none") : "Debit"}>
                    <SelectTrigger><SelectValue placeholder="Select balance" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Debit">Debit</SelectItem>
                      <SelectItem value="Credit">Credit</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="isHeader">Is Group Header?</Label>
                  <Select name="isHeader" defaultValue={editingAccount?.isHeader?.toString() || "false"}>
                    <SelectTrigger><SelectValue placeholder="Is Header?" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit">Save Account</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-1">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              className="pl-9 h-10 max-w-sm" 
              placeholder="Search accounts..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[150px]">Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Normal Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && coaData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : displayAccounts.map((account: any) => (
              <TableRow key={account.id || account.code || account.accountCode} className={account.isHeader ? "bg-muted/20 font-semibold" : ""}>
                <TableCell className="font-mono text-xs">{account.code || account.accountCode}</TableCell>
                <TableCell className={account.isHeader ? "pl-4" : "pl-8"}>
                  {account.name || account.accountName}
                </TableCell>
                <TableCell>
                  {(account.type || account.accountType) && (
                    <Badge variant={(account.type || account.accountType) === 'Asset' ? "default" : (account.type || account.accountType) === 'Liability' ? 'outline' : 'secondary'}>
                      {account.type || account.accountType}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {(account.balance || account.normalBalance) && (
                    <span className={`text-xs ${(account.balance || account.normalBalance) === 'Debit' ? 'text-blue-600' : 'text-orange-600'} font-medium`}>
                      {account.balance || account.normalBalance}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => { setEditingAccount(account); setIsAddOpen(true); }}
                    >
                      <Edit2 className="size-4" />
                    </Button>
                    {account.id && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:bg-destructive/10" 
                        onClick={() => handleDeleteAccount(account.id, account.name || account.accountName)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
