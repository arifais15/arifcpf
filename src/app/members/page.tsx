
"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, Download, ChevronLeft, ChevronRight, Info, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
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

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const idNum = (formData.get("memberIdNumber") as string).trim();
    
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
      showAlert({ title: "Profile Updated", type: "success" });
    } else {
      // STRICT UNIQUE ID ENFORCEMENT
      const check = await getDocs(query(collection(firestore, "members"), where("memberIdNumber", "==", idNum)));
      if (!check.empty) {
        showAlert({ 
          title: "Registration Denied", 
          description: `Member ID ${idNum} is already assigned to ${check.docs[0].data().name}. Profiles must be unique.`, 
          type: "error" 
        });
        return;
      }
      addDocumentNonBlocking(collection(firestore, "members"), { ...memberData, createdAt: new Date().toISOString() });
      showAlert({ title: "Personnel Registered", type: "success" });
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
        
        // Fetch current registry for merging logic
        const allMembersSnap = await getDocs(collection(firestore, "members"));
        const existingMembersMap: Record<string, string> = {};
        allMembersSnap.forEach(d => { existingMembersMap[d.data().memberIdNumber] = d.id; });

        for (const entry of data as any[]) {
          const idNum = String(entry["ID"] || entry.memberIdNumber || "").trim();
          const name = String(entry["Name"] || "");
          if (!idNum || !name) continue;

          let mDocId = existingMembersMap[idNum];
          
          if (!mDocId) {
            // NEW MEMBER: Create Profile
            const newRef = doc(collection(firestore, "members"));
            mDocId = newRef.id;
            existingMembersMap[idNum] = mDocId;
            setDocumentNonBlocking(newRef, { 
              memberIdNumber: idNum, name, 
              designation: String(entry["Designation"] || ""), 
              dateJoined: String(entry["JoinedDate"] || ""), 
              zonalOffice: String(entry["ZonalOffice"] || "HO"), 
              permanentAddress: String(entry["Address"] || ""), 
              status: String(entry["Status"] || "Active"), 
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString() 
            }, { merge: true });
          } else {
            // EXISTING MEMBER: Synchronize metadata
            updateDocumentNonBlocking(doc(firestore, "members", mDocId), { 
              designation: String(entry["Designation"] || ""), 
              zonalOffice: String(entry["ZonalOffice"] || "HO"), 
              status: String(entry["Status"] || "Active"),
              updatedAt: new Date().toISOString() 
            });
          }

          // ALWAYS APPEND TRANSACTION
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
        showAlert({ title: "Monthly Matrix Synchronized", description: "Profiles matched by ID. Transactions appended successfully.", type: "success" });
      } catch (err) { toast({ title: "Import Failed", variant: "destructive" }); }
      finally { setIsUploading(false); setIsBulkOpen(false); }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <PageHeaderActions>
        <div className="relative flex-1 max-w-sm no-print">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input className="pl-9 h-10 bg-white border-black border-2 font-black" placeholder="Search Personnel (ID/Name)..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 ml-auto no-print">
          <Button variant="outline" onClick={() => setIsBulkOpen(true)} className="h-10 border-black border-2 uppercase text-[10px] font-black text-black"><Upload className="size-3.5 mr-2" /> Monthly Append Matrix</Button>
          <Button onClick={() => setIsAddOpen(true)} className="h-10 bg-black text-white uppercase text-[10px] font-black"><Plus className="size-3.5 mr-2" /> Register Personnel</Button>
        </div>
      </PageHeaderActions>

      <div className="bg-white rounded-none border-2 border-black shadow-2xl overflow-hidden animate-in fade-in duration-500">
        <Table className="text-black font-black">
          <TableHeader className="bg-slate-50 border-b-2 border-black">
            <TableRow>
              <TableHead className="w-[120px] uppercase text-[10px] font-black pl-6 text-black">ID Number</TableHead>
              <TableHead className="uppercase text-[10px] font-black text-black">Legal Name</TableHead>
              <TableHead className="uppercase text-[10px] font-black text-black">Position</TableHead>
              <TableHead className="uppercase text-[10px] font-black text-black text-center">Status</TableHead>
              <TableHead className="text-right uppercase text-[10px] font-black pr-6 text-black">Operational Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-black uppercase italic">No institutional records found</TableCell></TableRow>
            ) : members.map((m) => (
              <TableRow key={m.id} className="hover:bg-slate-50 border-b border-black">
                <td className="font-mono text-base pl-6">{m.memberIdNumber}</td>
                <td className="text-sm uppercase">{m.name}</td>
                <td className="text-[10px] uppercase opacity-60">{m.designation}</td>
                <td className="text-center">
                  <Badge variant="outline" className={cn("text-[9px] uppercase font-black border-black", m.status === 'Active' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                    {m.status || "Active"}
                  </Badge>
                </td>
                <td className="text-right pr-6">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-black" onClick={() => { setEditingMember(m); setIsAddOpen(true); }}><Edit2 className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => showAlert({ title: "Remove Personnel?", description: `Permanently delete ${m.name} from registry? This will erase all ledger history.`, type: "warning", showCancel: true, confirmText: "Delete", onConfirm: () => deleteDocumentNonBlocking(doc(firestore, "members", m.id)) })}><Trash2 className="size-4" /></Button>
                    <Button variant="outline" size="sm" asChild className="h-8 border-black border-2 font-black uppercase text-[10px] text-black">
                      <Link href={`/members/${m.id}`}>Ledger Terminal</Link>
                    </Button>
                  </div>
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) setEditingMember(null); }}>
        <DialogContent className="max-w-3xl bg-white p-0 rounded-2xl shadow-2xl overflow-hidden border-4 border-black">
          <DialogHeader className="bg-slate-50 p-6 border-b-4 border-black">
            <DialogTitle className="font-black uppercase text-2xl flex items-center gap-3 text-black">
              <UserCircle className="size-8 text-black" /> Personnel Registration Matrix
            </DialogTitle>
            <DialogDescription className="text-xs font-black uppercase opacity-60 text-black">Official Trust Profile Management (Unique ID Enforcement Active)</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="p-8 space-y-6 text-black">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Member ID No (Unique Identifier)</Label><Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required className="h-11 border-black border-2 font-black text-black" disabled={!!editingMember} /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Full Legal Name</Label><Input name="name" defaultValue={editingMember?.name} required className="h-11 border-black border-2 font-black text-black" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Official Designation</Label><Input name="designation" defaultValue={editingMember?.designation} required className="h-11 border-black border-2 font-black text-black" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Institutional Joining Date</Label><Input name="dateJoined" type="date" max="9999-12-31" defaultValue={editingMember?.dateJoined} required className="h-11 border-black border-2 font-black text-black" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Zonal / Regional Office</Label><Input name="zonalOffice" defaultValue={editingMember?.zonalOffice} placeholder="e.g. Head Office" className="h-11 border-black border-2 font-black text-black" /></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase ml-1">Registry Status</Label>
                <Select name="status" defaultValue={editingMember?.status || "Active"}>
                  <SelectTrigger className="h-11 border-black border-2 font-black text-black"><SelectValue /></SelectTrigger>
                  <SelectContent className="text-black font-black">
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Retired">Retired</SelectItem>
                    <SelectItem value="Transferred">Transferred</SelectItem>
                    <SelectItem value="Dismissed">Dismissed</SelectItem>
                    <SelectItem value="InActive">InActive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Permanent Address Registry</Label><Textarea name="permanentAddress" defaultValue={editingMember?.permanentAddress} className="border-black border-2 font-black text-black" /></div>
            </div>
            <Button type="submit" className="w-full h-16 font-black uppercase tracking-[0.4em] shadow-2xl bg-black text-white hover:bg-black/90">Commit Profile to System</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="max-w-xl bg-white border-4 border-black p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="bg-slate-50 p-6 border-b-4 border-black text-black">
            <DialogTitle className="text-xl font-black uppercase flex items-center gap-3"><FileSpreadsheet className="size-6" /> Monthly Append Matrix</DialogTitle>
            <DialogDescription className="text-[10px] uppercase font-black opacity-60">Synchronize Profiles by ID & Append Monthly Salary Records</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-12 border-4 border-dashed border-slate-200 text-center space-y-4 cursor-pointer hover:border-black transition-colors" onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="size-16 mx-auto text-slate-300" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-500">Select Monthly Salary Matrix (XLSX)</p>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleExcelUpload} />
              {isUploading && <Loader2 className="size-10 animate-spin mx-auto mt-4 text-black" />}
            </div>
            <div className="bg-emerald-50 p-6 border-2 border-emerald-200 text-emerald-800 flex gap-4 items-start rounded-xl">
              <ShieldCheck className="size-6 shrink-0 mt-0.5" />
              <p className="text-[10px] font-black uppercase leading-relaxed">System Logic: Profiles are matched by ID. Metadata (Designation/Office) updates automatically. Transactions append as new unique entries.</p>
            </div>
            <Button variant="outline" onClick={() => {
              const ws = XLSX.utils.json_to_sheet([{ 
                "ID": "5001", "Name": "MD. EXAMPLE NAME", "Designation": "AGMF", "ZonalOffice": "HO", "Status": "Active", "JoinedDate": "2020-01-01", "Address": "GAZIPUR", 
                "Particulars": "Salary July-2024", "PostingDate": "2024-07-31", 
                "Emp_Contrib": 5000, "Loan_Disbursed": 0, "Loan_Repaid": 0, "Employee_Profit": 0, "Loan_Profit": 0, "PBS_Contribution": 5000, "PBS_Profit": 0 
              }]);
              const wb = XLSX.utils.book_new(); 
              XLSX.utils.book_append_sheet(wb, ws, "Matrix_Template"); 
              XLSX.writeFile(wb, "PBS_Monthly_Salary_Matrix_Template.xlsx");
            }} className="w-full h-14 border-2 border-black tracking-widest font-black uppercase text-xs">Download Structural Template</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
