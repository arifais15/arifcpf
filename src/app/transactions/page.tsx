
"use client"

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2 
} from "lucide-react";
import Link from "next/link";
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase, 
  deleteDocumentNonBlocking,
  getDocuments
} from "@/firebase";
import { collection, doc, query, where, collectionGroup } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";

export default function TransactionsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();
  const [search, setSearch] = useState("");

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: entries, isLoading } = useCollection(entriesRef);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    return entries
      .filter(e => 
        e.description?.toLowerCase().includes(search.toLowerCase()) || 
        e.referenceNumber?.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
  }, [entries, search]);

  const handleDelete = (id: string, ref: string) => {
    showAlert({
      title: "Delete Transaction?",
      description: `Are you sure you want to delete transaction ${ref || id}? This action will also remove associated entries from all member ledgers.`,
      type: "warning",
      showCancel: true,
      confirmText: "Yes, Delete All",
      onConfirm: async () => {
        try {
          // 1. Find and delete all linked member ledger entries
          const q = query(collectionGroup(firestore, "fundSummaries"), where("journalEntryId", "==", id));
          const snap = await getDocuments(q);
          snap.forEach(d => {
            const memberId = d.data().memberId;
            if (memberId) {
              deleteDocumentNonBlocking(doc(firestore, "members", memberId, "fundSummaries", d.id));
            }
          });

          // 2. Delete the main journal entry
          const docRef = doc(firestore, "journalEntries", id);
          deleteDocumentNonBlocking(docRef);
          
          showAlert({
            title: "Reconciled",
            description: "Journal entry and associated subsidiary records removed.",
            type: "success"
          });
        } catch (e) {
          toast({ title: "Deletion Failed", variant: "destructive" });
        }
      }
    });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Journal Transactions</h1>
          <p className="text-muted-foreground">Search and manage all dual-accounting entries</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/transactions/new">
            <Plus className="size-4" /> New Transaction
          </Link>
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              className="pl-9 h-10 max-w-sm bg-white" 
              placeholder="Search by description or voucher no..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead className="w-[150px]">Voucher No.</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Total Amount (৳)</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="size-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : filteredEntries.map((entry) => (
              <TableRow key={entry.id} className="group hover:bg-slate-50">
                <TableCell className="font-mono text-xs">{entry.entryDate}</TableCell>
                <TableCell className="font-medium">{entry.referenceNumber || "N/A"}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{entry.description}</span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1">
                      {entry.lines?.map((l: any) => l.accountName).join(", ")}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold text-primary">
                  ৳ {(entry.totalAmount || 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className="text-[10px]">{entry.lines?.length || 0} lines</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/transactions/new?edit=${entry.id}`}>
                        <Edit2 className="size-3.5" />
                      </Link>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10" 
                      onClick={() => handleDelete(entry.id, entry.referenceNumber)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
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
