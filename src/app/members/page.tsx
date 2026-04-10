
"use client"

import { useState, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, FileText, Download } from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSweetAlert } from "@/hooks/use-sweet-alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

export default function MembersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { showAlert } = useSweetAlert();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [editingMember, setEditingMember] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading } = useCollection(membersRef);

  const filteredMembers = members?.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.memberIdNumber?.includes(search) ||
    m.designation?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleAddMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const memberData = {
      memberIdNumber: formData.get("memberIdNumber"),
      name: formData.get("name"),
      designation: formData.get("designation"),
      dateJoined: formData.get("dateJoined"),
      zonalOffice: formData.get("zonalOffice"),
      permanentAddress: formData.get("permanentAddress"),
      status: formData.get("status") || "Active",
      settlementDate: formData.get("settlementDate") || ""
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
      addDocumentNonBlocking(membersRef, { ...memberData, createdAt: new Date().toISOString() });
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
      addDocumentNonBlocking(membersRef, cleanedEntry);
    });
    showAlert({
      title: "Bulk Import",
      description: `Processing ${entries.length} members. They will appear in the list shortly.`,
      type: "info"
    });
    setIsBulkOpen(false);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "memberIdNumber": "12345",
        "name": "Ariful Islam",
        "designation": "AGM (Finance)",
        "dateJoined": "2020-01-01",
        "zonalOffice": "Headquarters",
        "permanentAddress": "Gazipur, Bangladesh"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, "members_registry_template.xlsx");
  };

  const handleBulkCsvUpload = () => {
    const lines = bulkData.trim().split("\n");
    if (lines.length < 2) {
      toast({ title: "Error", description: "Format required.", variant: "destructive" });
      return;
    }
    const headers = lines[0].split(",").map(h => h.trim());
    const entries = lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const entry: any = {};
      headers.forEach((h, i) => { entry[h] = values[i]; });
      return entry;
    });
    processEntries(entries);
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
          <p className="text-muted-foreground">Manage and track individual member fund accounts</p>
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
                  <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="text-xs h-7 gap-1">
                    <Download className="size-3" /> Template
                  </Button>
                </div>
                <DialogDescription>
                  Ensure your file has a "memberIdNumber" column to match with future ledger uploads.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="excel" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="excel"><FileSpreadsheet className="size-4 mr-2" /> Excel</TabsTrigger>
                  <TabsTrigger value="csv"><FileText className="size-4 mr-2" /> CSV</TabsTrigger>
                </TabsList>
                <TabsContent value="excel" className="py-4">
                  <div className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50" onClick={() => fileInputRef.current?.click()}>
                    <FileSpreadsheet className="size-8 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">Click to upload XLSX/CSV</p>
                    <p className="text-xs text-muted-foreground mt-1">Columns: memberIdNumber, name, designation, dateJoined...</p>
                    <Input type="file" className="hidden" ref={fileInputRef} onChange={handleExcelUpload} />
                  </div>
                </TabsContent>
                <TabsContent value="csv" className="py-4 space-y-4">
                  <textarea className="w-full min-h-[150px] p-2 text-sm border rounded font-mono" value={bulkData} onChange={(e) => setBulkData(e.target.value)} placeholder="memberIdNumber, name, designation, dateJoined..." />
                  <Button className="w-full" onClick={handleBulkCsvUpload}>Process CSV</Button>
                </TabsContent>
              </Tabs>
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
                  <div className="space-y-2"><Label>ID No (Common Key)</Label><Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required /></div>
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Retired">Retired</SelectItem>
                        <SelectItem value="Transferred">Transferred</SelectItem>
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
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9 max-w-sm h-9" placeholder="Search by ID No, Name or Designation..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">ID No (Key)</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No members found.</TableCell></TableRow>
            ) : filteredMembers.map((member) => (
              <TableRow key={member.id} className="group">
                <TableCell className="font-bold font-mono">{member.memberIdNumber}</TableCell>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell className="text-xs">{member.designation}</TableCell>
                <TableCell>
                  <Badge variant={member.status === 'Active' ? 'outline' : 'secondary'} className={
                    member.status === 'Active' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 
                    member.status === 'Retired' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                  }>
                    {member.status || "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingMember(member); setIsAddOpen(true); }}><Edit2 className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteMember(member.id, member.name)}><Trash2 className="size-4" /></Button>
                    <Button variant="outline" size="sm" asChild className="h-8"><Link href={`/members/${member.id}`}><UserCircle className="size-4 mr-2" /> Ledger</Link></Button>
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
