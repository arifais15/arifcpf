
"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, FileText, Download, ChevronLeft, ChevronRight, FilterX } from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy, limit, startAfter, where, QueryConstraint } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

export default function MembersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();
  
  // Pagination & Search States
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [isNextDisabled, setIsNextDisabled] = useState(false);

  // UI States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search to avoid too many Firestore reads
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

    // We fetch one extra to determine if there's a next page
    constraints.push(limit(pageSize + 1));

    if (lastVisible && currentPage > 1) {
      constraints.push(startAfter(lastVisible));
    }

    return query(baseRef, ...constraints);
  }, [firestore, debouncedSearch, pageSize, lastVisible, currentPage]);

  const { data: rawMembers, isLoading, snapshot } = useCollection(membersQuery);

  // Process data for display
  const members = useMemo(() => {
    if (!rawMembers) return [];
    return rawMembers.slice(0, pageSize);
  }, [rawMembers, pageSize]);

  // Side effect to update pagination state without triggering re-render loops during render phase
  useEffect(() => {
    if (rawMembers) {
      setIsNextDisabled(rawMembers.length <= pageSize);
    }
  }, [rawMembers, pageSize]);

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

  const handleAddMember = (e: React.FormEvent<HTMLFormElement>) => {
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
      settlementDate: (formData.get("settlementDate") as string) || ""
    };

    if (editingMember) {
      const docRef = doc(firestore, "members", editingMember.id);
      updateDocumentNonBlocking(docRef, memberData);
      showAlert({
        title: "Success",
        description: `${memberData.name} profile has been updated.`,
        type: "success"
      });
    } else {
      addDocumentNonBlocking(collection(firestore, "members"), { ...memberData, createdAt: new Date().toISOString() });
      showAlert({
        title: "Registered",
        description: `Member ${memberData.name} added to the registry.`,
        type: "success"
      });
    }
    setIsAddOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = (id: string, name: string) => {
    showAlert({
      title: "Remove Member?",
      description: `This will permanently delete ${name} and their accounting records.`,
      type: "warning",
      showCancel: true,
      confirmText: "Yes, Delete",
      onConfirm: () => {
        const docRef = doc(firestore, "members", id);
        deleteDocumentNonBlocking(docRef);
        showAlert({
          title: "Deleted",
          description: "Member removed from database.",
          type: "success"
        });
      }
    });
  };

  const processEntries = (entries: any[]) => {
    entries.forEach(entry => {
      const cleanedEntry: any = {};
      Object.keys(entry).forEach(key => {
        const k = key.trim().toLowerCase();
        if (k.includes("id") || k.includes("number")) cleanedEntry.memberIdNumber = entry[key]?.toString().trim();
        else if (k.includes("name")) cleanedEntry.name = entry[key]?.toString().trim();
        else if (k.includes("designation")) cleanedEntry.designation = entry[key]?.toString().trim();
        else if (k.includes("date") && k.includes("join")) cleanedEntry.dateJoined = entry[key]?.toString().trim();
        else if (k.includes("office")) cleanedEntry.zonalOffice = entry[key]?.toString().trim();
        else cleanedEntry[key.trim()] = entry[key]?.toString().trim();
      });
      cleanedEntry.status = "Active";
      addDocumentNonBlocking(collection(firestore, "members"), cleanedEntry);
    });
    showAlert({
      title: "Bulk Import",
      description: `Processing ${entries.length} members. They will appear in the list shortly.`,
      type: "info"
    });
    setIsBulkOpen(false);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        processEntries(data);
      } catch (err) {
        toast({ title: "Failed", description: "Could not parse file.", variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Members Registry</h1>
          <p className="text-muted-foreground">Managing {pageSize} accounts per page • Total efficiency audit</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Upload className="size-4 mr-2" /> Bulk Upload</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Bulk Upload Members</DialogTitle>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const templateData = [{"memberIdNumber": "12345", "name": "Ariful Islam", "designation": "AGM (Finance)", "dateJoined": "2020-01-01", "zonalOffice": "Headquarters", "permanentAddress": "Gazipur"}];
                    const ws = XLSX.utils.json_to_sheet(templateData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Members");
                    XLSX.writeFile(wb, "members_registry_template.xlsx");
                  }} className="text-xs h-7 gap-1">
                    <Download className="size-3" /> Template
                  </Button>
                </div>
                <DialogDescription>
                  Ensure your file has a "memberIdNumber" column to match with future ledger uploads.
                </DialogDescription>
              </DialogHeader>
              <div className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="size-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-bold">Click to upload XLSX</p>
                <p className="text-xs text-muted-foreground mt-1">Required Columns: memberIdNumber, name, designation</p>
                <Input type="file" className="hidden" ref={fileInputRef} onChange={handleExcelUpload} />
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingMember(null); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="size-4 mr-2" /> Add Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingMember ? "Edit" : "Add"} Member</DialogTitle></DialogHeader>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>ID No (Key)</Label><Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required /></div>
                  <div className="space-y-2"><Label>Full Name</Label><Input name="name" defaultValue={editingMember?.name} required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Designation</Label><Input name="designation" defaultValue={editingMember?.designation} required /></div>
                  <div className="space-y-2"><Label>Zonal Office</Label><Input name="zonalOffice" defaultValue={editingMember?.zonalOffice} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Status</Label>
                    <Select name="status" defaultValue={editingMember?.status || "Active"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Retired">Retired</SelectItem>
                        <SelectItem value="Transferred">Transferred</SelectItem>
                        <SelectItem value="InActive">InActive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Date Joined</Label><Input name="dateJoined" type="date" defaultValue={editingMember?.dateJoined} required /></div>
                </div>
                <DialogFooter><Button type="submit">Save Member Profile</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-1">
        <div className="p-4 border-b flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              className="pl-9 h-10 bg-white" 
              placeholder="Search by ID or Full Name..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
            {search && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleClearSearch}>
                <FilterX className="size-3.5" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-2">
              <span className="uppercase tracking-widest">Page</span>
              <Badge variant="secondary" className="h-6 w-6 flex items-center justify-center p-0 rounded-md bg-white border">{currentPage}</Badge>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-9 px-3 gap-1 font-bold" onClick={handlePrevPage} disabled={currentPage === 1}>
                <ChevronLeft className="size-4" /> Reset
              </Button>
              <Button variant="outline" size="sm" className="h-9 px-3 gap-1 font-bold" onClick={handleNextPage} disabled={isNextDisabled || isLoading}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">ID No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="size-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-16 text-muted-foreground italic">No members found matching your search.</TableCell></TableRow>
            ) : members.map((member) => (
              <TableRow key={member.id} className="group hover:bg-slate-50/50">
                <TableCell className="font-bold font-mono text-primary">{member.memberIdNumber}</TableCell>
                <TableCell className="font-bold text-slate-800">{member.name}</TableCell>
                <TableCell className="text-xs uppercase font-medium text-slate-500">{member.designation}</TableCell>
                <TableCell>
                  <Badge variant={member.status === 'Active' ? 'outline' : 'secondary'} className={
                    member.status === 'Active' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 
                    member.status === 'Retired' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                    member.status === 'Transferred' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }>{member.status || "Active"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingMember(member); setIsAddOpen(true); }}><Edit2 className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteMember(member.id, member.name)}><Trash2 className="size-4" /></Button>
                    <Button variant="outline" size="sm" asChild className="h-8 font-bold"><Link href={`/members/${member.id}`}><UserCircle className="size-4 mr-2 text-primary" /> Ledger</Link></Button>
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
