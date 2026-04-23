
"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, Download, ChevronLeft, ChevronRight, Info, ShieldCheck } from "lucide-react";
import Link from "next/link";
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
    <div className="flex gap-3 ml-auto no-print">
      <Button variant="outline" onClick={() => setIsBulkOpen(true)} className="h-10 border-2 border-black uppercase text-[11px] font-black text-black rounded-xl px-6 bg-white hover:bg-slate-50 shadow-md">
        <Upload className="size-4 mr-2" /> Monthly Matrix
      </Button>
      <Button onClick={() => setIsAddOpen(true)} className="h-10 bg-black text-white uppercase text-[11px] font-black rounded-xl px-8 shadow-xl">
        <Plus className="size-4 mr-2" /> Register Personnel
      </Button>
    </div>
  ), []);

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <PageHeaderActions>{headerActions}</PageHeaderActions>

      <div className="bg-white p-6 border-2 border-black shadow-2xl flex items-center justify-between no-print rounded-2xl">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
          <Input 
            className="pl-12 h-12 bg-slate-50 border-2 border-black font-black text-lg focus:bg-white transition-all shadow-inner" 
            placeholder="Search Institutional Personnel (ID/Name)..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        <div className="flex items-center gap-6 border-l-2 border-black/10 pl-8 ml-8">
          <div className="flex items-center gap-3">
            <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Display Rows</Label>
            <Select 
              value={pageSize.toString()} 
              onValueChange={(v) => { 
                setPageSize(parseInt(v)); 
                setLastVisible(null); 
                setCurrentPage(1); 
              }}
            >
              <SelectTrigger className="h-10 w-24 border-2 border-black font-black text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5" className="font-black">5 Rows</SelectItem>
                <SelectItem value="10" className="font-black">10 Rows</SelectItem>
                <SelectItem value="25" className="font-black">25 Rows</SelectItem>
                <SelectItem value="-1" className="font-black">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge className="bg-black text-white px-4 py-2 font-black uppercase text-[10px] tracking-[0.2em] rounded-none shadow-lg">
            {members.length} Personnel Listed
          </Badge>
        </div>
      </div>

      <div className="bg-white rounded-none border-2 border-black shadow-2xl overflow-hidden">
        <Table className="text-black font-black">
          <TableHeader className="bg-slate-100 border-b-2 border-black">
            <TableRow>
              <TableHead className="w-[150px] uppercase text-[11px] font-black pl-8 text-amber-800 border-r border-black tracking-[0.1em]">Vault ID</TableHead>
              <TableHead className="uppercase text-[11px] font-black text-blue-800 border-r border-black tracking-[0.1em]">Legal Name</TableHead>
              <TableHead className="uppercase text-[11px] font-black text-slate-600 border-r border-black tracking-[0.1em]">Designation</TableHead>
              <TableHead className="uppercase text-[11px] font-black text-indigo-700 text-center border-r border-black tracking-[0.1em]">Status</TableHead>
              <TableHead className="text-right uppercase text-[11px] font-black pr-8 text-black tracking-[0.1em]">Operations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-24"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-black uppercase text-xl italic opacity-20">No institutional records synchronized</TableCell></TableRow>
            ) : members.map((m) => (
              <TableRow key={m.id} className="hover:bg-slate-50 border-b border-black h-[29px] transition-colors group">
                <td className="font-mono text-base pl-8 py-0 border-r border-black text-amber-900">{m.memberIdNumber}</td>
                <td className="text-[13px] uppercase font-black py-0 border-r border-black text-black group-hover:text-blue-700">{m.name}</td>
                <td className="text-[10px] uppercase font-black opacity-50 py-0 border-r border-black">{m.designation}</td>
                <td className="text-center py-0 border-r border-black">
                  <Badge variant="outline" className={cn("text-[9px] uppercase font-black border-black h-5 px-2 rounded-none", m.status === 'Active' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                    {m.status || "Active"}
                  </Badge>
                </td>
                <td className="text-right pr-8 py-0">
                  <div className="flex justify-end gap-2 items-center h-full">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-black hover:bg-black hover:text-white transition-all" onClick={() => { setEditingMember(m); setIsAddOpen(true); }}><Edit2 className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-300 hover:text-white hover:bg-rose-600 transition-all" onClick={() => showAlert({ title: "Irreversible Purge?", description: `Remove ${m.name} from vault?`, type: "warning", showCancel: true, onConfirm: () => deleteDocumentNonBlocking(doc(firestore, "members", m.id)) })}><Trash2 className="size-3.5" /></Button>
                    <Button variant="outline" size="sm" asChild className="h-6 px-4 border-black border-2 font-black uppercase text-[10px] text-black bg-white hover:bg-black hover:text-white rounded-none transition-all tracking-widest ml-2"><Link href={`/members/${m.id}`}>Open Ledger</Link></Button>
                  </div>
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) setEditingMember(null); }}>
        <DialogContent className="max-w-2xl bg-white p-0 rounded-none shadow-2xl overflow-hidden border-4 border-black font-ledger">
          <DialogHeader className="bg-slate-50 p-6 border-b-4 border-black">
            <DialogTitle className="font-black uppercase text-2xl flex items-center gap-4 text-black">
              <UserCircle className="size-8 text-blue-700" /> 
              Personnel Registration Matrix
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="p-8 space-y-8 text-black bg-white">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2"><Label className="text-[11px] font-black uppercase text-amber-700 ml-1 tracking-widest">Vault ID Number</Label><Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required className="h-12 border-black border-2 font-black text-xl tabular-nums bg-slate-50 focus:bg-white" disabled={!!editingMember} /></div>
              <div className="space-y-2"><Label className="text-[11px] font-black uppercase text-blue-700 ml-1 tracking-widest">Full Legal Name</Label><Input name="name" defaultValue={editingMember?.name} required className="h-12 border-black border-2 font-black text-base uppercase" /></div>
              <div className="space-y-2"><Label className="text-[11px] font-black uppercase text-slate-500 ml-1 tracking-widest">Official Designation</Label><Input name="designation" defaultValue={editingMember?.designation} required className="h-12 border-black border-2 font-black text-sm uppercase" /></div>
              <div className="space-y-2"><Label className="text-[11px] font-black uppercase text-indigo-700 ml-1 tracking-widest">Joining Date</Label><Input name="dateJoined" type="date" max="9999-12-31" defaultValue={editingMember?.dateJoined} required className="h-12 border-black border-2 font-black text-black" /></div>
              <div className="space-y-2"><Label className="text-[11px] font-black uppercase text-slate-500 ml-1 tracking-widest">Assigned Office</Label><Input name="zonalOffice" defaultValue={editingMember?.zonalOffice} className="h-12 border-black border-2 font-black text-black" /></div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-rose-700 ml-1 tracking-widest">Operational Status</Label>
                <Select name="status" defaultValue={editingMember?.status || "Active"}>
                  <SelectTrigger className="h-12 border-black border-2 font-black text-black uppercase">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-black uppercase">
                    <SelectItem value="Active" className="text-emerald-700">Active</SelectItem>
                    <SelectItem value="Retired" className="text-rose-700">Retired</SelectItem>
                    <SelectItem value="Transferred" className="text-slate-600">Transferred</SelectItem>
                    <SelectItem value="Dismissed" className="text-red-900 font-bold">Dismissed</SelectItem>
                    <SelectItem value="InActive" className="text-slate-400 italic">InActive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2"><Label className="text-[11px] font-black uppercase text-slate-500 ml-1 tracking-widest">Permanent Registry Address</Label><Textarea name="permanentAddress" defaultValue={editingMember?.permanentAddress} className="border-black border-2 font-black text-black min-h-[80px] uppercase text-xs" /></div>
            </div>
            <Button type="submit" className="w-full h-16 font-black uppercase tracking-[0.4em] shadow-2xl bg-black text-white hover:bg-slate-900 border-none transition-all group">
              <Plus className="size-6 mr-4 group-hover:scale-110 transition-transform text-emerald-400" />
              Commit Profile to Local Vault
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
