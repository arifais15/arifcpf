
"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, Download, ChevronLeft, ChevronRight, FilterX, Info } from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy, limit, startAfter, where, QueryConstraint, getDocs } from "firebase/firestore";
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
    const memberIdNumber = (formData.get("memberIdNumber") as string).trim();
    
    const memberData = {
      memberIdNumber,
      name: formData.get("name") as string,
      designation: formData.get("designation") as string,
      dateJoined: formData.get("dateJoined") as string,
      zonalOffice: formData.get("zonalOffice") as string,
      permanentAddress: formData.get("permanentAddress") as string,
      status: (formData.get("status") as string) || "Active",
      updatedAt: new Date().toISOString()
    };

    if (editingMember) {
      // Check if new ID is taken by someone else
      if (editingMember.memberIdNumber !== memberIdNumber) {
        const check = await getDocs(query(collection(firestore, "members"), where("memberIdNumber", "==", memberIdNumber)));
        if (!check.empty) {
          showAlert({ title: "ID Conflict", description: `The ID ${memberIdNumber} is already registered to another member.`, type: "error" });
          return;
        }
      }
      updateDocumentNonBlocking(doc(firestore, "members", editingMember.id), memberData);
      showAlert({ title: "Profile Updated", type: "success" });
    } else {
      // Check for unique ID before creating
      const check = await getDocs(query(collection(firestore, "members"), where("memberIdNumber", "==", memberIdNumber)));
      if (!check.empty) {
        showAlert({ title: "Duplicate Entry", description: `A member with ID ${memberIdNumber} is already in the registry. Use search to find them.`, type: "error" });
        return;
      }
      setDocumentNonBlocking(doc(collection(firestore, "members")), { ...memberData, createdAt: new Date().toISOString() }, { merge: true });
      showAlert({ title: "Personnel Registered", type: "success" });
    }
    setIsAddOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = (id: string, name: string) => {
    showAlert({
      title: "Delete Personnel?",
      description: `Permanently remove ${name} from registry? This action is irreversible.`,
      type: "warning",
      showCancel: true,
      confirmText: "Delete Records",
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
        
        // Optimize by getting all existing members once
        const allMembersSnap = await getDocs(collection(firestore, "members"));
        const existingMembersMap: Record<string, string> = {};
        allMembersSnap.forEach(d => { existingMembersMap[d.data().memberIdNumber] = d.id; });

        for (const entry of data as any[]) {
          const memberIdNumber = String(entry["ID"] || entry.memberIdNumber || "").trim();
          const name = String(entry["Name"] || "");
          if (!memberIdNumber || !name) continue;

          let memberDocId = existingMembersMap[memberIdNumber];
          if (!memberDocId) {
            const newRef = doc(collection(firestore, "members"));
            memberDocId = newRef.id;
            existingMembersMap[memberIdNumber] = memberDocId;
            setDocumentNonBlocking(newRef, { 
              memberIdNumber, 
              name, 
              designation: String(entry["Designation"] || ""), 
              dateJoined: String(entry["JoinedDate"] || ""), 
              zonalOffice: String(entry["ZonalOffice"] || "Head Office"), 
              permanentAddress: String(entry["Address"] || ""), 
              status: String(entry["Status"] || "Active"), 
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString() 
            }, { merge: true });
          } else {
            // Synchronize existing profile with latest metadata
            updateDocumentNonBlocking(doc(firestore, "members", memberDocId), { 
              designation: String(entry["Designation"] || ""), 
              zonalOffice: String(entry["ZonalOffice"] || "Head Office"), 
              updatedAt: new Date().toISOString() 
            });
          }

          // Append monthly ledger record
          const ledgerEntry = {
            summaryDate: String(entry["PostingDate"] || new Date().toISOString().split('T')[0]),
            particulars: String(entry["Particulars"] || "Monthly Salary contribution"),
            employeeContribution: Number(entry["Emp_Contrib"] || 0),
            loanWithdrawal: Number(entry["Loan_Disbursed"] || 0),
            loanRepayment: Number(entry["Loan_Repaid"] || 0),
            profitEmployee: Number(entry["Employee_Profit"] || 0),
            profitLoan: Number(entry["Loan_Profit"] || 0),
            pbsContribution: Number(entry["PBS_Contribution"] || 0),
            profitPbs: Number(entry["PBS_Profit"] || 0),
            memberId: memberDocId,
            createdAt: new Date().toISOString()
          };

          addDocumentNonBlocking(collection(firestore, "members", memberDocId, "fundSummaries"), ledgerEntry);
        }
        showAlert({ title: "Batch Sync Complete", type: "success" });
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
          <Input className="pl-9 h-10 bg-white border-black/20 font-black text-xs" placeholder="Search Personnel ID/Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setSearch("")}><FilterX className="size-3.5" /></Button>}
        </div>
        <div className="flex items-center bg-black/5 p-1 rounded-xl h-10 ml-2">
          <Label className="text-[9px] font-black uppercase text-black px-2">Rows:</Label>
          <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); setLastVisible(null); }}>
            <SelectTrigger className="h-7 w-[70px] border-black/20 bg-white font-black text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[5, 10, 25, 50, -1].map(v => <SelectItem key={v} value={v.toString()} className="font-black text-[10px]">{v === -1 ? 'ALL' : `${v} Rows`}</SelectItem>)}
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
          <Button variant="outline" onClick={() => setIsBulkOpen(true)} className="h-10 border-black border-2 font-black text-[10px] uppercase gap-1.5 px-4 shadow-sm hover:bg-slate-50 transition-colors"><Upload className="size-3.5" /> Monthly Matrix Import</Button>
          <Button onClick={() => setIsAddOpen(true)} className="h-10 bg-black text-white font-black text-[10px] uppercase gap-1.5 px-6 shadow-xl hover:bg-slate-900 transition-colors"><Plus className="size-3.5" /> Register Personnel</Button>
        </div>
      </PageHeaderActions>

      <div className="bg-white rounded-none border-2 border-black overflow-hidden shadow-2xl animate-in fade-in duration-500">
        <Table className="text-black font-black">
          <TableHeader>
            <TableRow className="bg-slate-100 border-b-2 border-black">
              <TableHead className="w-[100px] font-black uppercase text-[10px] pl-6 py-5">ID No</TableHead>
              <TableHead className="font-black uppercase text-[10px] py-5">Full Legal Name</TableHead>
              <TableHead className="font-black uppercase text-[10px] py-5">Designation</TableHead>
              <TableHead className="font-black uppercase text-[10px] py-5">Office</TableHead>
              <TableHead className="font-black uppercase text-[10px] py-5">Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] pr-6 py-5">Audit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums text-[#000000]">
            {isLoading && members.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : members.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-black uppercase tracking-widest italic">No personnel records identified</TableCell></TableRow>
            ) : members.map((m) => (
              <TableRow key={m.id} className="hover:bg-slate-50 border-b border-black group transition-colors">
                <td className="font-mono text-base pl-6 font-black py-4">{m.memberIdNumber}</td>
                <td className="text-sm font-black uppercase py-4">{m.name}</td>
                <td className="text-[10px] font-black uppercase py-4 opacity-70">{m.designation}</td>
                <td className="text-[10px] font-black uppercase py-4 opacity-70">{m.zonalOffice || "HO"}</td>
                <td className="py-4">
                  <Badge variant="outline" className={cn(
                    "text-[9px] uppercase font-black px-3 border-black rounded-none",
                    m.status === 'Active' ? "bg-black text-white" : "bg-white text-black"
                  )}>{m.status || "Active"}</Badge>
                </td>
                <td className="text-right pr-6 py-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-200" onClick={() => { setEditingMember(m); setIsAddOpen(true); }}><Edit2 className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteMember(m.id, m.name)}><Trash2 className="size-4" /></Button>
                    <Button variant="outline" size="sm" asChild className="h-8 border-2 border-black font-black uppercase text-[10px] shadow-sm active:scale-95 transition-transform"><Link href={`/members/${m.id}`}>Ledger Terminal</Link></Button>
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
            <DialogTitle className="font-black uppercase text-2xl flex items-center gap-3">
                <UserCircle className="size-6" /> Personnel Registry Terminal
            </DialogTitle>
            <DialogDescription className="text-xs font-black uppercase opacity-60">Synchronize official trust profiles. ID must be unique.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Member ID No (Unique)</Label>
                <Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required className="h-11 border-2 border-black font-black rounded-none focus:ring-0" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Full Legal Name</Label>
                <Input name="name" defaultValue={editingMember?.name} required className="h-11 border-2 border-black font-black rounded-none focus:ring-0" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Designation</Label>
                <Input name="designation" defaultValue={editingMember?.designation} required className="h-11 border-2 border-black font-black rounded-none focus:ring-0" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Joining Date</Label>
                <Input name="dateJoined" type="date" max="9999-12-31" defaultValue={editingMember?.dateJoined} required className="h-11 border-2 border-black font-black rounded-none focus:ring-0" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Zonal Office</Label>
                <Input name="zonalOffice" defaultValue={editingMember?.zonalOffice} placeholder="e.g. Head Office" className="h-11 border-2 border-black font-black rounded-none focus:ring-0" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Account Status</Label>
                <Select name="status" defaultValue={editingMember?.status || "Active"}>
                  <SelectTrigger className="h-11 border-2 border-black font-black rounded-none focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active" className="font-black uppercase">Active</SelectItem>
                    <SelectItem value="Retired" className="font-black uppercase">Retired</SelectItem>
                    <SelectItem value="Transferred" className="font-black uppercase">Transferred</SelectItem>
                    <SelectItem value="InActive" className="font-black uppercase">InActive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Permanent Address</Label>
                <Textarea name="permanentAddress" defaultValue={editingMember?.permanentAddress} className="border-2 border-black font-black rounded-none min-h-[100px] focus:ring-0" />
              </div>
            </div>
            <Button type="submit" className="w-full bg-black text-white font-black h-14 uppercase tracking-[0.4em] rounded-none shadow-xl hover:bg-slate-900 transition-colors">
                Commit Personnel Profile
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="border-4 border-black max-w-lg bg-white rounded-none p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="bg-slate-50 p-6 border-b-4 border-black">
            <DialogTitle className="text-xl font-black uppercase flex items-center gap-3">
                <FileSpreadsheet className="size-5" /> Institutional Matrix Importer
            </DialogTitle>
            <DialogDescription className="text-[10px] uppercase font-black opacity-60">Append monthly salary transactions and sync personnel profiles</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-10 border-2 border-black border-dashed text-center space-y-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="size-12 mx-auto text-black opacity-20" />
              <p className="text-xs font-black uppercase tracking-widest">Select Salary Matrix (XLSX)</p>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleExcelUpload} />
              {isUploading && <Loader2 className="size-8 animate-spin mx-auto text-black" />}
            </div>
            <div className="bg-amber-50 p-4 border-2 border-amber-200 text-amber-800 flex gap-3 items-start shadow-inner">
              <Info className="size-5 shrink-0 mt-0.5" />
              <p className="text-[10px] font-black uppercase leading-tight">System identifies members by unique ID. Profiles are updated to latest Designation/Office; financial records are appended as new unique ledger entries.</p>
            </div>
            <Button variant="outline" onClick={() => {
              const ws = XLSX.utils.json_to_sheet([{ 
                  "ID": "5001", "Name": "MD. ARIFUL ISLAM", "Designation": "AGMF", "ZonalOffice": "Head Office", "Status": "Active", "JoinedDate": "2020-01-01", "Address": "GAZIPUR",
                  "Particulars": "Salary July-2024", "PostingDate": "2024-07-31", 
                  "Emp_Contrib": 5000, "Loan_Disbursed": 0, "Loan_Repaid": 0, "Employee_Profit": 0, "Loan_Profit": 0, "PBS_Contribution": 5000, "PBS_Profit": 0 
              }]);
              const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "MonthlyAppend"); XLSX.writeFile(wb, "Institutional_Monthly_Sync_Template.xlsx");
            }} className="w-full border-2 border-black font-black uppercase text-[10px] h-11 tracking-widest hover:bg-slate-50">Download Standard Template</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
