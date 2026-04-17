"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, Download, ChevronLeft, ChevronRight, FilterX, ListFilter, CalendarDays, MapPin, ShieldCheck, Info } from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy, limit, startAfter, where, QueryConstraint, addDoc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageHeaderActions } from "@/components/header-actions";
import { Textarea } from "@/components/ui/textarea";
import * as XLSX from "xlsx";

export default function MembersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();
  
  // Pagination & Search States
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisible, setLastVisible] = useState<any>(null);

  // UI States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
      setLastVisible(null);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Dynamic Query Construction
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

    // "View All" handling
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

  const handleClearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
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
      const docRef = doc(firestore, "members", editingMember.id);
      updateDocumentNonBlocking(docRef, memberData);
      showAlert({ 
        title: "Profile Updated", 
        description: `Records for ${memberData.name} have been synchronized.`,
        type: "success", 
        onConfirm: () => window.location.reload() 
      });
    } else {
      addDocumentNonBlocking(collection(firestore, "members"), { 
        ...memberData, 
        createdAt: new Date().toISOString() 
      });
      showAlert({ 
        title: "Personnel Registered", 
        description: `${memberData.name} added to trust registry.`,
        type: "success", 
        onConfirm: () => window.location.reload() 
      });
    }
    setIsAddOpen(false);
    setEditingMember(null);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        
        let count = 0;
        for (const entry of data as any[]) {
          const joinedDate = String(entry["JoinedDate"] || entry.dateJoined || "");
          const memberData = {
            memberIdNumber: String(entry["ID"] || entry.memberIdNumber || ""),
            name: String(entry["Name"] || ""),
            designation: String(entry["Designation"] || ""),
            dateJoined: joinedDate,
            permanentAddress: String(entry["Address"] || entry.permanentAddress || ""),
            zonalOffice: String(entry["Office"] || entry.zonalOffice || ""),
            status: String(entry["Status"] || "Active"),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          if (memberData.memberIdNumber && memberData.name) {
            const memberRef = await addDoc(collection(firestore, "members"), memberData);
            
            // Inject Opening Balance Entry using descriptive headers
            const openingEntry = {
              summaryDate: joinedDate || new Date().toISOString().split('T')[0],
              particulars: "Opening Balance (Imported)",
              employeeContribution: Number(entry["Employee_Contribution"] || 0),
              loanWithdrawal: Number(entry["Loan_Disbursed"] || 0),
              loanRepayment: Number(entry["Loan_Repaid"] || 0),
              profitEmployee: Number(entry["Employee_Profit"] || 0),
              profitLoan: Number(entry["Loan_Profit"] || 0),
              pbsContribution: Number(entry["PBS_Contribution"] || 0),
              profitPbs: Number(entry["PBS_Profit"] || 0),
              isSystemGenerated: true,
              memberId: memberRef.id,
              createdAt: new Date().toISOString()
            };
            await addDoc(collection(firestore, "members", memberRef.id, "fundSummaries"), openingEntry);
            count++;
          }
        }
        showAlert({ 
          title: "Import Success", 
          description: `Successfully registered ${count} personnel with opening ledger balances.`, 
          type: "success", 
          onConfirm: () => window.location.reload() 
        });
      } catch (err) {
        toast({ title: "Upload Failed", description: "Ensure the Excel format matches the requirement.", variant: "destructive" });
      } finally {
        setIsUploading(false);
        setIsBulkOpen(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const templateData = [{
      "ID": "5001",
      "Name": "MD. ARIFUL ISLAM",
      "Designation": "AGMF",
      "JoinedDate": "2020-01-01",
      "Address": "GAZIPUR",
      "Office": "HEAD OFFICE",
      "Status": "Active",
      "Employee_Contribution": 150000,
      "Loan_Disbursed": 0,
      "Loan_Repaid": 0,
      "Employee_Profit": 45000,
      "Loan_Profit": 0,
      "PBS_Contribution": 150000,
      "PBS_Profit": 45000
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RegistryTemplate");
    XLSX.writeFile(wb, "PBS_CPF_Import_Template.xlsx");
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      <PageHeaderActions>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black opacity-40" />
          <Input 
            className="pl-9 h-10 bg-white/50 border-black/20 font-black text-xs" 
            placeholder="Search Registry..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
          {search && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleClearSearch}><FilterX className="size-3.5" /></Button>}
        </div>
        
        <div className="flex items-center bg-black/5 p-1 rounded-xl h-10 overflow-hidden ml-2">
          <div className="flex items-center gap-2 px-3">
            <Label className="text-[9px] font-black uppercase text-black">Limit:</Label>
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); setLastVisible(null); }}>
              <SelectTrigger className="h-7 w-[70px] border-black/20 bg-white font-black text-[10px] focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5" className="font-black text-[10px]">5 Rows</SelectItem>
                <SelectItem value="10" className="font-black text-[10px]">10 Rows</SelectItem>
                <SelectItem value="25" className="font-black text-[10px]">25 Rows</SelectItem>
                <SelectItem value="-1" className="font-black text-[10px]">View All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {pageSize !== -1 && (
            <div className="flex gap-1 border-l border-black/10 ml-1 pl-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevPage} disabled={currentPage === 1}><ChevronLeft className="size-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextPage} disabled={isNextDisabled || isLoading}><ChevronRight className="size-3.5" /></Button>
            </div>
          )}
        </div>

        <div className="h-8 w-px bg-black/10 mx-1" />
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setIsBulkOpen(true)} className="h-9 border-black border-2 font-black text-[10px] uppercase gap-1.5 px-3">
            <Upload className="size-3.5" /> Bulk
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="h-9 bg-black text-white font-black text-[10px] uppercase gap-1.5 px-4 shadow-lg shadow-black/20">
            <Plus className="size-3.5" /> Register Personnel
          </Button>
        </div>
      </PageHeaderActions>

      <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden">
        <Table className="font-black text-black">
          <TableHeader>
            <TableRow className="bg-slate-100 border-b-2 border-black">
              <TableHead className="w-[120px] font-black uppercase text-[10px] tracking-widest pl-6 text-black py-5">ID Number</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-black py-5">Full Name</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-black py-5">Designation</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-black py-5">Account Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] tracking-widest pr-6 text-black py-5">Audit Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {isLoading && members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-32 text-black font-black italic uppercase">Registry Empty</TableCell></TableRow>
            ) : members.map((member) => (
              <TableRow key={member.id} className="hover:bg-slate-50 border-b border-black">
                <TableCell className="font-mono text-base pl-6 text-black font-black py-4">{member.memberIdNumber}</TableCell>
                <TableCell className="text-sm font-black uppercase text-black py-4">{member.name}</TableCell>
                <TableCell className="text-[10px] uppercase font-black text-black py-4">{member.designation}</TableCell>
                <TableCell className="py-4">
                  <Badge variant="outline" className={cn(
                    "text-[9px] uppercase font-black px-3 py-0.5 border-black rounded-none",
                    member.status === 'Active' ? "bg-black text-white" : "bg-white text-black"
                  )}>{member.status || "Active"}</Badge>
                </TableCell>
                <TableCell className="text-right pr-6 py-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-black hover:bg-slate-100" onClick={() => { setEditingMember(member); setIsAddOpen(true); }}><Edit2 className="size-4" /></Button>
                    <Button variant="outline" size="sm" asChild className="h-8 border-2 border-black font-black uppercase text-[10px] bg-white text-black hover:bg-black hover:text-white transition-all"><Link href={`/members/${member.id}`}><UserCircle className="size-3.5 mr-2" /> Ledger Audit</Link></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingMember(null); }}>
        <DialogContent className="border-4 border-black max-w-2xl bg-white p-0 overflow-hidden rounded-none shadow-2xl">
          <DialogHeader className="bg-slate-50 p-6 border-b-4 border-black">
            <DialogTitle className="font-black uppercase text-2xl tracking-tighter flex items-center gap-3">
              <UserCircle className="size-7" />
              {editingMember ? "Modify Personnel Records" : "New Personnel Registration"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Member ID No (Key)</Label>
                <Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required className="h-11 border-2 border-black font-black rounded-none focus:ring-0" placeholder="e.g. 5001" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Full Legal Name</Label>
                <Input name="name" defaultValue={editingMember?.name} required className="h-11 border-2 border-black font-black rounded-none focus:ring-0" placeholder="AS PER SERVICE BOOK" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Official Designation</Label>
                <Input name="designation" defaultValue={editingMember?.designation} required className="h-11 border-2 border-black font-black rounded-none focus:ring-0" placeholder="e.g. AGMF" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <CalendarDays className="size-3" /> Fund Joined Date
                </Label>
                <Input name="dateJoined" type="date" max="9999-12-31" defaultValue={editingMember?.dateJoined} required className="h-11 border-2 border-black font-black rounded-none focus:ring-0 uppercase" />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full bg-black text-white font-black h-14 uppercase tracking-[0.3em] rounded-none shadow-xl hover:bg-black/90 text-base">
                {editingMember ? "Synchronize Profile" : "Register Personnel Profile"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
