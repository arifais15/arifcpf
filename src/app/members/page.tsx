
"use client"

import { useState, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";

export default function MembersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
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
    m.designation.toLowerCase().includes(search.toLowerCase())
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
    };

    if (editingMember) {
      const docRef = doc(firestore, "members", editingMember.id);
      updateDocumentNonBlocking(docRef, memberData);
      toast({ title: "Member Updated", description: "Member information has been saved." });
    } else {
      addDocumentNonBlocking(membersRef, memberData);
      toast({ title: "Member Added", description: "New member has been registered." });
    }
    setIsAddOpen(false);
    setEditingMember(null);
  };

  const handleDeleteMember = (id: string) => {
    if (confirm("Are you sure you want to delete this member?")) {
      const docRef = doc(firestore, "members", id);
      deleteDocumentNonBlocking(docRef);
      toast({ title: "Member Deleted", description: "Member record has been removed." });
    }
  };

  const processEntries = (entries: any[]) => {
    entries.forEach(entry => {
      // Basic cleaning of keys and values
      const cleanedEntry: any = {};
      Object.keys(entry).forEach(key => {
        cleanedEntry[key.trim()] = entry[key]?.toString().trim();
      });
      addDocumentNonBlocking(membersRef, cleanedEntry);
    });
    toast({ title: "Bulk Upload Started", description: `Processing ${entries.length} entries.` });
    setIsBulkOpen(false);
    setBulkData("");
  };

  const handleBulkCsvUpload = () => {
    const lines = bulkData.trim().split("\n");
    if (lines.length < 2) {
      toast({ title: "Error", description: "Please provide a header line and at least one data line.", variant: "destructive" });
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim());
    const entries = lines.slice(1).map(line => {
      const values = line.split(",").map(v => v.trim());
      const entry: any = {};
      headers.forEach((h, i) => {
        entry[h] = values[i];
      });
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
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        processEntries(data);
      } catch (err) {
        toast({ title: "Upload Failed", description: "Could not parse Excel file.", variant: "destructive" });
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
              <Button variant="outline" size="sm">
                <Upload className="size-4 mr-2" />
                Bulk Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Upload Members</DialogTitle>
                <DialogDescription>
                  Upload an Excel file or paste CSV data. Required columns: memberIdNumber, name, designation, dateJoined, zonalOffice, permanentAddress
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="excel" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="excel" className="gap-2">
                    <FileSpreadsheet className="size-4" /> Excel File
                  </TabsTrigger>
                  <TabsTrigger value="csv" className="gap-2">
                    <FileText className="size-4" /> Paste CSV
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="excel" className="space-y-4 py-4">
                  <div 
                    className="border-2 border-dashed border-muted rounded-xl p-12 text-center flex flex-col items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="bg-primary/10 p-4 rounded-full">
                      <FileSpreadsheet className="size-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-muted-foreground">XLSX, XLS or CSV files are supported</p>
                    </div>
                    <Input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef}
                      accept=".xlsx, .xls, .csv"
                      onChange={handleExcelUpload}
                      disabled={isUploading}
                    />
                    {isUploading && <Loader2 className="size-4 animate-spin text-primary" />}
                  </div>
                </TabsContent>
                <TabsContent value="csv" className="space-y-4 py-4">
                  <textarea
                    className="min-h-[200px] w-full p-4 font-mono text-sm border rounded-md"
                    placeholder="memberIdNumber, name, designation, dateJoined, zonalOffice, permanentAddress&#10;1932, Md. Ariful Islam, AGM(Finance), 2018-04-25, Razendrapur, Gazipur, Baitkamari..."
                    value={bulkData}
                    onChange={(e) => setBulkData(e.target.value)}
                  />
                  <Button className="w-full" onClick={handleBulkCsvUpload}>Process CSV Data</Button>
                </TabsContent>
              </Tabs>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingMember(null); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4 mr-2" />
                Add New Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingMember ? "Edit Member" : "Add New Member"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ID Number</Label>
                    <Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input name="name" defaultValue={editingMember?.name} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <Input name="designation" defaultValue={editingMember?.designation} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Zonal Office</Label>
                    <Input name="zonalOffice" defaultValue={editingMember?.zonalOffice} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date Joined</Label>
                  <Input name="dateJoined" type="date" defaultValue={editingMember?.dateJoined} required />
                </div>
                <div className="space-y-2">
                  <Label>Permanent Address</Label>
                  <Input name="permanentAddress" defaultValue={editingMember?.permanentAddress} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit">{editingMember ? "Update" : "Save Member"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-1">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              className="pl-9 h-10 max-w-sm" 
              placeholder="Search members by name, ID or designation..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">ID No</TableHead>
              <TableHead>Member Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Station / Office</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No members found.
                </TableCell>
              </TableRow>
            ) : filteredMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.memberIdNumber}</TableCell>
                <TableCell>{member.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{member.designation}</TableCell>
                <TableCell className="text-sm">{member.zonalOffice}</TableCell>
                <TableCell className="text-right flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingMember(member); setIsAddOpen(true); }}>
                    <Edit2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMember(member.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/members/${member.id}`}>
                      <UserCircle className="size-4 mr-2" />
                      View Ledger
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
