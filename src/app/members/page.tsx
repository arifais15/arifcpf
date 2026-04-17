"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, Download, ChevronLeft, ChevronRight, FilterX, CalendarDays, Info } from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy, limit, startAfter, where, QueryConstraint, getDocs } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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

    const fetchLimit = pageSize === -1 ? 10000 : pageSize;
    constraints.push(limit(fetchLimit + 1));

    if (lastVisible && currentPage > 1 && pageSize !== -1) {
      constraints.push(startAfter(lastVisible));
    }

    return query(baseRef, ...constraints);
  }, [firestore, debouncedSearch, pageSize, lastVisible, currentPage]);

  const { data: rawMembers, isLoading, snapshot } = useCollection(membersQuery);

  const members = useMemo(() => {
    if (!rawMembers) return [];
    const displayLimit = pageSize === -1 ? 10000 : pageSize;
    return rawMembers.slice(0, displayLimit);
  }, [rawMembers, pageSize]);

  const isNextDisabled = pageSize === -1 || !rawMembers || rawMembers.length <= pageSize;

  const handleNextPage = () => {
    if (snapshot && snapshot.docs.length > pageSize) {
      setLastVisible(snapshot.docs[pageSize - 1]);
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    setCurrentPage(1);
    setLastVisible(null);
  };

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const memberData = {
      memberIdNumber: formData.get("memberIdNumber") as string,
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
      showAlert({ title: "Updated", type: "success" });
    } else {
      setDocumentNonBlocking(doc(collection(firestore, "members")), { ...memberData, createdAt: new Date().toISOString() }, { merge: true });
      showAlert({ title: "Registered", type: "success" });
    }
    setIsAddOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = (id: string, name: string) => {
    showAlert({
      title: "Delete Personnel?",
      description: `Permanently remove ${name} from registry?`,
      type: "warning",
      showCancel: true,
      onConfirm: () => deleteDocumentNonBlocking(doc(firestore, "members", id))
    });
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
        
        const allMembersSnap = await getDocs(collection(firestore, "members"));
        const existingMembersMap: Record<string, string> = {};
        allMembersSnap.forEach(d => { existingMembersMap[d.data().memberIdNumber] = d.id; });

        let count = 0;
        for (const entry of data as any[]) {
          const memberIdNumber = String(entry["ID"] || entry.memberIdNumber || "").trim();
          const name = String(entry["Name"] || "");
          if (!memberIdNumber || !name) continue;

          let memberDocId = existingMembersMap[memberIdNumber];
          if (!memberDocId) {
            const newRef = doc(collection(firestore, "members"));
            memberDocId = newRef.id;
            existingMembersMap[memberIdNumber] = memberDocId;
            setDocumentNonBlocking(newRef, { memberIdNumber, name, designation: String(entry["Designation"] || ""), dateJoined: String(entry["JoinedDate"] || ""), status: String(entry["Status"] || "Active"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
          } else {
            updateDocumentNonBlocking(doc(firestore, "members", memberDocId), { designation: String(entry["Designation"] || ""), updatedAt: new Date().toISOString() });
          }

          const ledgerEntry = {
            summaryDate: String(entry["PostingDate"] || new Date().toISOString().split('T')[0]),
            particulars: String(entry["Particulars"] || "Monthly Salary Contribution"),
            employeeContribution: Number(entry["Employee_Contribution"] || 0),
            loanWithdrawal: Number(entry["Loan_Disbursed"] || 0),
            loanRepayment: Number(entry["Loan_Repaid"] || 0),
            profitEmployee: Number(entry["Employee_Profit"] || 0),
            profitLoan: Number(entry["Loan_Profit"] || 0),
            pbsContribution: Number(entry["PBS_Contribution"] || 0),
            profitPbs: Number(entry["PBS_Profit"] || 0),
            memberId: memberDocId,
            createdAt: new Date().toISOString()
          };

          setDocumentNonBlocking(doc(collection(firestore, "members", memberDocId, "fundSummaries")), ledgerEntry, { merge: true });
          count++;
        }
        showAlert({ title: "Import Success", description: `Processed ${count} records.`, type: "success" });
      } catch (err) {
        toast({ title: "Import Failed", variant: "destructive" });
      } finally {
        setIsUploading(false);
        setIsBulkOpen(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-[#000000]">
      <PageHeaderActions>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/40" />
          <Input className="pl-9 h-10 bg-white border-black/20 font-black text-xs" placeholder="Search ID/Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setSearch("")}><FilterX className="size-3.5" /></Button>}
        </div>
        <div className="flex items-center bg-black/5 p-1 rounded-xl h-10 ml-2">
          <Label className="text-[9px] font-black uppercase text-black px-2">Limit:</Label>
          <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); setLastVisible(null); }}>
            <SelectTrigger className="h-7 w-[70px] border-black/20 bg-white font-black text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[5, 10, 25, -1].map(v => <SelectItem key={v} value={v.toString()} className="font-black text-[10px]">{v === -1 ? 'All' : `${v} Rows`}</SelectItem>)}
            </SelectContent>
          </Select>
          {pageSize !== -1 && (
            <div className="flex gap-1 border-l border-black/10 ml-1 pl-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevPage} disabled={currentPage === 1}><ChevronLeft className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextPage} disabled={isNextDisabled || isLoading}><ChevronRight className="size-3.5" /></Button>
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => setIsBulkOpen(true)} className="h-10 border-black border-2 font-black text-[10px] uppercase gap-1.5 px-4"><Upload className="size-3.5" /> Monthly Append</Button>
          <Button onClick={() => setIsAddOpen(true)} className="h-10 bg-black text-white font-black text-[10px] uppercase gap-1.5 px-6"><Plus className="size-3.5" /> Register Staff</Button>
        </div>
      </PageHeaderActions>

      <div className="bg-white rounded-none border-2 border-black overflow-hidden shadow-xl">
        <Table className="text-black font-black">
          <TableHeader>
            <TableRow className="bg-slate-100 border-b-2 border-black">
              <TableHead className="w-[100px] font-black uppercase text-[10px] pl-6 py-5">ID No</TableHead>
              <TableHead className="font-black uppercase text-[10px] py-5">Full Name</TableHead>
              <TableHead className="font-black uppercase text-[10px] py-5">Designation</TableHead>
              <TableHead className="font-black uppercase text-[10px] py-5">Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] pr-6 py-5">Audit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums text-[#000000]">
            {isLoading && members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto" /></TableCell></TableRow>
            ) : members.map((m) => (
              <TableRow key={m.id} className="hover:bg-slate-50 border-b border-black">
                <td className="font-mono text-base pl-6 font-black py-4">{m.memberIdNumber}</td>
                <td className="text-sm font-black uppercase py-4">{m.name}</td>
                <td className="text-[10px] font-black uppercase py-4">{m.designation}</td>
                <td className="py-4"><Badge variant="outline" className={cn("text-[9px] uppercase font-black px-3 border-black rounded-none", m.status === 'Active' ? "bg-black text-white" : "bg-white")}>{m.status || "Active"}</Badge></td>
                <td className="text-right pr-6 py-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingMember(m); setIsAddOpen(true); }}><Edit2 className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteMember(m.id, m.name)}><Trash2 className="size-4" /></Button>
                    <Button variant="outline" size="sm" asChild className="h-8 border-2 border-black font-black uppercase text-[10px]"><Link href={`/members/${m.id}`}>Ledger Audit</Link></Button>
                  </div>
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) setEditingMember(null); }}>
        <DialogContent className="border-4 border-black max-w-2xl bg-white p-0 rounded-none shadow-2xl">
          <DialogHeader className="bg-slate-50 p-6 border-b-4 border-black">
            <DialogTitle className="font-black uppercase text-2xl">Personnel Registration</DialogTitle>
            <DialogDescription className="text-xs uppercase font-black opacity-60">Synchronize official trust profiles</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Member ID No</Label><Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required className="h-11 border-2 border-black font-black rounded-none" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Full Legal Name</Label><Input name="name" defaultValue={editingMember?.name} required className="h-11 border-2 border-black font-black rounded-none" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Designation</Label><Input name="designation" defaultValue={editingMember?.designation} required className="h-11 border-2 border-black font-black rounded-none" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Joined Date</Label><Input name="dateJoined" type="date" max="9999-12-31" defaultValue={editingMember?.dateJoined} required className="h-11 border-2 border-black font-black rounded-none" /></div>
            </div>
            <Button type="submit" className="w-full bg-black text-white font-black h-14 uppercase tracking-[0.3em] rounded-none">Save Personnel Profile</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="border-4 border-black max-w-lg bg-white rounded-none p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="bg-slate-50 p-6 border-b-2 border-black">
            <DialogTitle className="text-xl font-black uppercase">Monthly Append Matrix</DialogTitle>
            <DialogDescription className="text-[10px] uppercase font-black opacity-60">Append transactions and sync profiles</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-10 border-2 border-black border-dashed text-center space-y-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="size-12 mx-auto text-black opacity-20" />
              <p className="text-xs font-black uppercase tracking-widest">Select Monthly XLSX File</p>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleExcelUpload} />
              {isUploading && <Loader2 className="animate-spin mx-auto" />}
            </div>
            <div className="bg-amber-50 p-4 border-2 border-amber-200 text-amber-800 flex gap-3 items-start">
              <Info className="size-5 shrink-0 mt-0.5" />
              <p className="text-[10px] font-black uppercase leading-tight">Importer will link by ID. Profiles are updated with new designations; new transactions are appended to historical ledger.</p>
            </div>
            <Button variant="outline" onClick={() => {
              const ws = XLSX.utils.json_to_sheet([{ "ID": "5001", "Name": "MD. ARIFUL ISLAM", "Designation": "AGMF", "Particulars": "Salary July-2024", "PostingDate": "2024-07-31", "Employee_Contribution": 5000, "Loan_Disbursed": 0, "Loan_Repaid": 0, "Employee_Profit": 0, "Loan_Profit": 0, "PBS_Contribution": 5000, "PBS_Profit": 0 }]);
              const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Monthly"); XLSX.writeFile(wb, "Monthly_Append_Template.xlsx");
            }} className="w-full border-2 border-black font-black uppercase text-[10px] h-10">Download Excel Template</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
