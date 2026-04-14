"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, Download, ChevronLeft, ChevronRight, FilterX, ListFilter } from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, orderBy, limit, startAfter, where, QueryConstraint } from "firebase/firestore";
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
      settlementDate: (formData.get("settlementDate") as string) || ""
    };

    if (editingMember) {
      const docRef = doc(firestore, "members", editingMember.id);
      updateDocumentNonBlocking(docRef, memberData);
      showAlert({ title: "Updated", type: "success", onConfirm: () => window.location.reload() });
    } else {
      addDocumentNonBlocking(collection(firestore, "members"), { ...memberData, createdAt: new Date().toISOString() });
      showAlert({ title: "Registered", type: "success", onConfirm: () => window.location.reload() });
    }
    setIsAddOpen(false);
    setEditingMember(null);
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-ledger text-black">
      {/* Dynamic Header Actions */}
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
          <Button variant="outline" size="sm" onClick={() => setIsBulkOpen(true)} className="h-9 border-black font-black text-[10px] uppercase gap-1.5 px-3">
            <Upload className="size-3.5" /> Bulk
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="h-9 bg-black text-white font-black text-[10px] uppercase gap-1.5 px-4">
            <Plus className="size-3.5" /> Register
          </Button>
        </div>
      </PageHeaderActions>

      <div className="flex flex-col gap-1 md:hidden">
        <h1 className="text-2xl font-black text-black tracking-tight uppercase">Members Registry</h1>
        <p className="text-black font-black uppercase text-[9px] tracking-widest opacity-60">Audit Tools available in top header</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border-2 border-black overflow-hidden">
        <Table className="font-black text-black">
          <TableHeader>
            <TableRow className="bg-slate-100 border-b-2 border-black">
              <TableHead className="w-[120px] font-black uppercase text-[10px] tracking-widest pl-6 text-black">ID Number</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-black">Full Name</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-black">Designation</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest text-black">Account Status</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px] tracking-widest pr-6 text-black">Audit Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {isLoading && members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-32 text-black font-black italic uppercase">Registry Empty</TableCell></TableRow>
            ) : members.map((member) => (
              <TableRow key={member.id} className="hover:bg-slate-50 border-b border-black">
                <TableCell className="font-mono text-base pl-6 text-black font-black">{member.memberIdNumber}</TableCell>
                <TableCell className="text-sm font-black uppercase text-black">{member.name}</TableCell>
                <TableCell className="text-[10px] uppercase font-black text-black">{member.designation}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(
                    "text-[9px] uppercase font-black px-3 py-0.5 border-black rounded-none",
                    member.status === 'Active' ? "bg-black text-white" : "bg-white text-black"
                  )}>{member.status || "Active"}</Badge>
                </TableCell>
                <TableCell className="text-right pr-6">
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
        <DialogContent className="border-2 border-black">
          <DialogHeader><DialogTitle className="font-black uppercase">Personnel Profile</DialogTitle></DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">ID No (Key)</Label><Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required className="border-2 border-black font-black" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Full Name</Label><Input name="name" defaultValue={editingMember?.name} required className="border-2 border-black font-black" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Designation</Label><Input name="designation" defaultValue={editingMember?.designation} required className="border-2 border-black font-black" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Zonal Office</Label><Input name="zonalOffice" defaultValue={editingMember?.zonalOffice} className="border-2 border-black font-black" /></div>
            </div>
            <DialogFooter className="pt-4"><Button type="submit" className="w-full bg-black text-white font-black uppercase tracking-widest">Save Profile</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="max-w-2xl border-2 border-black">
          <DialogHeader><DialogTitle className="font-black uppercase">Bulk Import Personnel</DialogTitle></DialogHeader>
          <div className="border-2 border-dashed border-black/20 rounded-xl p-12 text-center cursor-pointer hover:border-black transition-colors" onClick={() => fileInputRef.current?.click()}>
            {isUploading ? <Loader2 className="size-8 mx-auto animate-spin" /> : <FileSpreadsheet className="size-8 mx-auto mb-2 opacity-20" />}
            <p className="text-sm font-black uppercase">Select XLSX Document</p>
            <input type="file" className="hidden" ref={fileInputRef} onChange={() => {}} accept=".xlsx" disabled={isUploading} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
