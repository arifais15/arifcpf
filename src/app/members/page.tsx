"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, Download, ChevronLeft, ChevronRight, Info, ShieldCheck } from "lucide-react";
import Link from "link/next";
import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking, getDocuments } from "@/firebase";
import { collection, doc, query, orderBy, limit, startAfter, where, QueryConstraint } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PageHeaderActions } from "@/components/header-actions";
import * as XLSX from "xlsx";

export default function MembersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();
  
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisible, setLastVisible] = useState<any>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
      setLastVisible(null);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const membersQuery = useMemoFirebase(() => {
    const baseRef = collection(firestore, "members");
    const constraints: QueryConstraint[] = [];

    if (debouncedSearch) {
      if (/^\d+$/.test(debouncedSearch)) {
        constraints.push(where("memberIdNumber", "==", debouncedSearch));
      } else {
        const end = debouncedSearch.replace(/.$/, c => String.fromCharCode(c.charCodeAt(0) + 1));
        constraints.push(where("name", ">=", debouncedSearch));
        constraints.push(where("name", "<", end));
      }
    } else {
      constraints.push(orderBy("memberIdNumber", "asc"));
    }

    if (pageSize !== -1) {
      constraints.push(limit(pageSize + 1));
    } else {
      constraints.push(limit(5000));
    }

    if (lastVisible && currentPage > 1 && pageSize !== -1) {
      constraints.push(startAfter(lastVisible));
    }

    return query(baseRef, ...constraints);
  }, [firestore, debouncedSearch, pageSize, lastVisible, currentPage]);

  const { data: rawMembers, isLoading } = useCollection(membersQuery);

  const members = useMemo(() => {
    if (!rawMembers) return [];
    const displayLimit = pageSize === -1 ? 5000 : pageSize;
    return rawMembers.slice(0, displayLimit);
  }, [rawMembers, pageSize]);

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawId = formData.get("memberIdNumber") as string | null;
    const idNum = (rawId || editingMember?.memberIdNumber || "").trim();
    
    if (!idNum) {
      toast({ title: "Error", description: "Member ID is required", variant: "destructive" });
      return;
    }

    const memberData = {
      memberIdNumber: idNum,
      name: formData.get("name") as string,
      designation: formData.get("designation") as string,
      dateJoined: formData.get("dateJoined") as string,
      zonalOffice: formData.get("zonalOffice") as string,
      permanentAddress: formData.get("permanentAddress") as string,
      status: (formData.get("status") as string) || "Active",
      updatedAt: new Date().toISOString()
    };

    if (editingMember) {
      updateDocumentNonBlocking(doc(firestore, "members", editingMember.id), memberData);
      toast({ title: "Profile Updated" });
    } else {
      const check = await getDocuments(query(collection(firestore, "members"), where("memberIdNumber", "==", idNum)));
      if (!check.empty) {
        showAlert({ title: "Registration Denied", description: `Member ID ${idNum} is already assigned.`, type: "error" });
        return;
      }
      addDocumentNonBlocking(collection(firestore, "members"), { ...memberData, createdAt: new Date().toISOString() });
      toast({ title: "Personnel Registered" });
    }
    setIsAddOpen(false);
    setEditingMember(null);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        const allMembersSnap = await getDocuments(collection(firestore, "members"));
        const existingMembersMap: Record<string, string> = {};
        allMembersSnap.forEach((d: any) => { existingMembersMap[d.data().memberIdNumber] = d.id; });

        for (const entry of data as any[]) {
          const idNum = String(entry["ID"] || entry.memberIdNumber || "").trim();
          const name = String(entry["Name"] || "");
          if (!idNum || !name) continue;
          
          let mDocId = existingMembersMap[idNum];
          if (!mDocId) {
            const newRef = doc(collection(firestore, "members"));
            mDocId = newRef.id;
            existingMembersMap[idNum] = mDocId;
            setDocumentNonBlocking(newRef, { 
              memberIdNumber: idNum, 
              name, 
              designation: String(entry["Designation"] || ""), 
              dateJoined: String(entry["JoinedDate"] || ""), 
              zonalOffice: String(entry["ZonalOffice"] || "HO"), 
              permanentAddress: String(entry["Address"] || ""), 
              status: String(entry["Status"] || "Active"), 
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString() 
            }, { merge: true });
          } else {
            updateDocumentNonBlocking(doc(firestore, "members", mDocId), { 
              designation: String(entry["Designation"] || ""), 
              zonalOffice: String(entry["ZonalOffice"] || "HO"), 
              status: String(entry["Status"] || "Active"), 
              updatedAt: new Date().toISOString() 
            });
          }
          
          const ledgerEntry = { 
            summaryDate: String(entry["PostingDate"] || new Date().toISOString().split('T')[0]), 
            particulars: String(entry["Particulars"] || "Monthly Matrix Append"), 
            employeeContribution: Number(entry["Emp_Contrib"] || 0), 
            loanWithdrawal: Number(entry["Loan_Disbursed"] || 0), 
            loanRepayment: Number(entry["Loan_Repaid"] || 0), 
            profitEmployee: Number(entry["Employee_Profit"] || 0), 
            profitLoan: Number(entry["Loan_Profit"] || 0), 
            pbsContribution: Number(entry["PBS_Contribution"] || 0), 
            profitPbs: Number(entry["PBS_Profit"] || 0), 
            memberId: mDocId, 
            createdAt: new Date().toISOString() 
          };
          addDocumentNonBlocking(collection(firestore, "members", mDocId, "fundSummaries"), ledgerEntry);
        }
        showAlert({ title: "Synchronization Complete", type: "success" });
      } catch (err) { 
        console.error("Import Error:", err);
        toast({ title: "Import Failed", description: "Verify Excel structure.", variant: "destructive" }); 
      } finally { 
        setIsUploading(false); 
        setIsBulkOpen(false); 
      }
    };
    reader.readAsBinaryString(file);
  };

  const headerActions = useMemo(() => (
    <div className="flex gap-2 ml-auto no-print">
      <Button variant="outline" onClick={() => setIsBulkOpen(true)} className="h-9 border border-black uppercase text-[10px] font-black text-black">
        <Upload className="size-3.5 mr-2" /> Monthly Matrix
      </Button>
      <Button onClick={() => setIsAddOpen(true)} className="h-9 bg-black text-white uppercase text-[10px] font-black">
        <Plus className="size-3.5 mr-2" /> Register Personnel
      </Button>
    </div>
  ), []);

  return (
    <div className="p-8 flex flex-col gap-6 bg-background min-h-screen font-ledger text-black">
      <PageHeaderActions>{headerActions}</PageHeaderActions>

      <div className="bg-white p-4 border border-black shadow-lg flex items-center justify-between no-print">
        <div className="relative flex-1 max-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input 
            className="pl-9 h-10 bg-slate-50 border border-black font-black text-base" 
            placeholder="Search Personnel (ID/Name)..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        <div className="flex items-center gap-4 border-l border-slate-200 pl-6 ml-6">
          <div className="flex items-center gap-2">
            <Label className="text-[10px] font-black uppercase text-slate-400">Rows</Label>
            <Select 
              value={pageSize.toString()} 
              onValueChange={(v) => { 
                setPageSize(parseInt(v)); 
                setLastVisible(null); 
                setCurrentPage(1); 
              }}
            >
              <SelectTrigger className="h-9 w-20 border border-black font-black text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="-1">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-none border border-black shadow-xl overflow-hidden">
        <Table className="text-black font-black">
          <TableHeader className="bg-slate-50 border-b border-black">
            <TableRow>
              <TableHead className="w-[120px] uppercase text-[10px] font-black pl-6 text-black border-r border-black">ID Number</TableHead>
              <TableHead className="uppercase text-[10px] font-black text-black border-r border-black">Legal Name</TableHead>
              <TableHead className="uppercase text-[10px] font-black text-black border-r border-black">Position</TableHead>
              <TableHead className="uppercase text-[10px] font-black text-black text-center border-r border-black">Status</TableHead>
              <TableHead className="text-right uppercase text-[10px] font-black pr-6 text-black">Operational Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow key="loading"><TableCell colSpan={5} className="text-center py-20 h-[29px]"><Loader2 className="size-6 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow key="empty"><TableCell colSpan={5} className="text-center py-16 text-slate-400 font-black uppercase italic h-[29px]">No institutional records found</TableCell></TableRow>
            ) : members.map((m) => (
              <TableRow key={m.id} className="hover:bg-slate-50 border-b border-black h-[29px] bg-transparent">
                <td className="font-mono text-base pl-6 py-0 border-r border-black">{m.memberIdNumber}</td>
                <td className="text-sm uppercase py-0 border-r border-black">{m.name}</td>
                <td className="text-[10px] uppercase opacity-60 py-0 border-r border-black">{m.designation}</td>
                <td className="text-center py-0 border-r border-black">
                  <Badge variant="outline" className={cn("text-[9px] uppercase font-black border-black h-4 px-1.5", m.status === 'Active' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                    {m.status || "Active"}
                  </Badge>
                </td>
                <td className="text-right pr-6 py-0">
                  <div className="flex justify-end gap-1 items-center h-full">
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-black" onClick={() => { setEditingMember(m); setIsAddOpen(true); }}><Edit2 className="size-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-rose-600 hover:bg-rose-50" onClick={() => showAlert({ title: "Remove Personnel?", description: `Permanently delete ${m.name}?`, type: "warning", showCancel: true, onConfirm: () => deleteDocumentNonBlocking(doc(firestore, "members", m.id)) })}><Trash2 className="size-3" /></Button>
                    <Button variant="outline" size="sm" asChild className="h-5 px-1.5 border-black border font-black uppercase text-[8px] text-black"><Link href={`/members/${m.id}`}>Ledger</Link></Button>
                  </div>
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) setEditingMember(null); }}>
        <DialogContent className="max-w-2xl bg-white p-0 rounded-lg shadow-2xl overflow-hidden border-2 border-black">
          <DialogHeader className="bg-slate-50 p-5 border-b-2 border-black">
            <DialogTitle className="font-black uppercase text-xl flex items-center gap-3 text-black"><UserCircle className="size-6" /> Personnel Registration Matrix</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="p-6 space-y-6 text-black">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Member ID No</Label><Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required className="h-10 border-black border font-black text-black" disabled={!!editingMember} /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Full Legal Name</Label><Input name="name" defaultValue={editingMember?.name} required className="h-10 border-black border font-black text-black" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Official Designation</Label><Input name="designation" defaultValue={editingMember?.designation} required className="h-10 border-black border font-black text-black" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Joining Date</Label><Input name="dateJoined" type="date" max="9999-12-31" defaultValue={editingMember?.dateJoined} required className="h-10 border-black border font-black text-black" /></div>
              <div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Office</Label><Input name="zonalOffice" defaultValue={editingMember?.zonalOffice} className="h-10 border-black border font-black text-black" /></div>
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase ml-1">Status</Label>
                <Select name="status" defaultValue={editingMember?.status || "Active"}><SelectTrigger className="h-10 border-black border font-black text-black"><SelectValue /></SelectTrigger><SelectContent className="text-black font-black"><SelectItem value="Active">Active</SelectItem><SelectItem value="Retired">Retired</SelectItem><SelectItem value="Transferred">Transferred</SelectItem><SelectItem value="Dismissed">Dismissed</SelectItem><SelectItem value="InActive">InActive</SelectItem></SelectContent></Select>
              </div>
              <div className="col-span-2 space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Permanent Address</Label><Textarea name="permanentAddress" defaultValue={editingMember?.permanentAddress} className="border-black border font-black text-black min-h-[60px]" /></div>
            </div>
            <Button type="submit" className="w-full h-14 font-black uppercase tracking-[0.3em] shadow-xl bg-black text-white hover:bg-black/90">Commit Profile to System</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
