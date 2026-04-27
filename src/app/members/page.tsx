
"use client"

import { useState, useRef, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, UserCircle, Upload, Trash2, Edit2, Loader2, FileSpreadsheet, Download, ChevronLeft, ChevronRight, Info, ShieldCheck, FileType, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, addDocumentNonBlocking, getDocuments, errorEmitter } from "@/firebase";
import { collection, doc, query, where, QueryConstraint, orderBy, limit, startAfter } from "firebase/firestore";
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
import { getSubsidiaryValues } from "@/lib/ledger-mapping";
import { serverExecuteBatch } from "@/app/actions/db-actions";

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bulkPreview, setBulkPreview] = useState<any>(null);

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
      toast({ title: "Employee Registered" });
    }
    setIsAddOpen(false);
    setEditingMember(null);
  };

  const excelDateToISO = (val: any) => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch (e) {}
    }
    return String(val);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "ID": "1234",
        "Name": "Ariful Islam",
        "Designation": "AGM",
        "JoinedDate": "2018-05-03",
        "ZonalOffice": "HO",
        "Address": "Gazipur",
        "Status": "Active",
        "PostingDate": "2025-07-01",
        "Particulars": "Contribution - July 2025",
        "Emp_Contrib": 5000,
        "Loan_Disbursed": 0,
        "Loan_Repaid": 0,
        "Employee_Profit": 0,
        "Loan_Profit": 0,
        "PBS_Contribution": 4165,
        "PBS_Profit": 0
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "UploadTemplate");
    XLSX.writeFile(wb, "CPF_Monthly_Import_Template.xlsx");
    toast({ title: "Template Downloaded" });
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
        
        if (data.length === 0) {
          toast({ title: "Empty File", variant: "destructive" });
          setIsUploading(false);
          return;
        }

        const groupedByDate: Record<string, any[]> = {};
        let totalEmpCont = 0;
        let totalPbsCont = 0;
        let totalLoanAct = 0;
        let uniqueIDs = new Set();

        data.forEach((entry: any) => {
          const findKey = (search: string[]) => Object.keys(entry).find(k => search.includes(k.trim())) || "";
          const date = excelDateToISO(entry[findKey(["PostingDate", "Date", "TransactionDate"])]);
          const idNum = String(entry[findKey(["ID", "Member ID", "ID No"])] || "").trim();
          
          if (!idNum) return;
          uniqueIDs.add(idNum);

          if (!groupedByDate[date]) groupedByDate[date] = [];
          groupedByDate[date].push(entry);

          totalEmpCont += Number(entry[findKey(["Emp_Contrib", "Column 1"])] || 0);
          totalPbsCont += Number(entry[findKey(["PBS_Contribution", "Column 8"])] || 0);
          totalLoanAct += Number(entry[findKey(["Loan_Disbursed", "Column 2"])] || 0);
          totalLoanAct -= Number(entry[findKey(["Loan_Repaid", "Column 3"])] || 0);
        });

        setBulkPreview({
          dateGroups: groupedByDate,
          totalMembers: uniqueIDs.size,
          totalEmpCont,
          totalPbsCont,
          totalLoanAct,
          rawData: data
        });

        setIsBulkOpen(false);
        setIsPreviewOpen(true);
      } catch (err) {
        toast({ title: "Parse Error", variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmUpload = async () => {
    const pw = window.prompt("Enter Authorization Code to Import Data:");
    if (pw !== "321") {
      if (pw !== null) toast({ title: "Access Denied", description: "Incorrect authorization code.", variant: "destructive" });
      return;
    }
    if (!bulkPreview) return;
    setIsCommitting(true);

    try {
      const allMembersSnap = await getDocuments(collection(firestore, "members"));
      const existingMembersMap: Record<string, string> = {};
      allMembersSnap.forEach((d: any) => { existingMembersMap[String(d.data().memberIdNumber).trim()] = d.id; });

      const batchOps: any[] = [];
      const timestamp = new Date().toISOString();

      for (const [postingDate, rows] of Object.entries(bulkPreview.dateGroups)) {
        const dateKey = postingDate.replaceAll('-', '');
        const journalId = `BULK-${dateKey}`;
        const journalLines: any[] = [];
        let totalDebit = 0;
        let totalCredit = 0;
        let bankEffect = 0; 

        for (const entry of rows as any[]) {
          const findKey = (search: string[]) => Object.keys(entry).find(k => search.includes(k.trim())) || "";
          const idNum = String(entry[findKey(["ID", "Member ID", "ID No"])] || "").trim();
          const name = String(entry[findKey(["Name", "Member Name"])] || "").trim();
          
          if (!idNum || !name) continue;
          
          let mDocId = existingMembersMap[idNum];
          if (!mDocId) {
            mDocId = Math.random().toString(36).substring(2, 15);
            existingMembersMap[idNum] = mDocId;
            batchOps.push({
              type: 'set',
              path: `members/${mDocId}`,
              data: { 
                memberIdNumber: idNum, name, 
                designation: String(entry[findKey(["Designation", "Rank"])] || ""), 
                dateJoined: excelDateToISO(entry[findKey(["JoinedDate", "DateJoined"])]), 
                zonalOffice: String(entry[findKey(["ZonalOffice", "Office"])] || "HO"), 
                status: "Active", createdAt: timestamp, updatedAt: timestamp
              }
            });
          }

          const vals = {
            c1: Number(entry[findKey(["Emp_Contrib", "Column 1"])] || 0),
            c2: Number(entry[findKey(["Loan_Disbursed", "Column 2"])] || 0),
            c3: Number(entry[findKey(["Loan_Repaid", "Column 3"])] || 0),
            c5: Number(entry[findKey(["Employee_Profit", "Column 5"])] || 0),
            c6: Number(entry[findKey(["Loan_Profit", "Column 6"])] || 0),
            c8: Number(entry[findKey(["PBS_Contribution", "Column 8"])] || 0),
            c9: Number(entry[findKey(["PBS_Profit", "Column 9"])] || 0)
          };

          const particulars = String(entry[findKey(["Particulars", "Detail"])] || `Monthly Import Bulk - ${postingDate}`);

          const mapping = [
            { code: '200.10.0000', debit: 0, credit: vals.c1, name: "Employees' Own Contribution" },
            { code: '105.10.0000', debit: vals.c2, credit: 0, name: "CPF Loan Disburse" },
            { code: '105.20.0000', debit: 0, credit: vals.c3, name: "CPF Loan Recover" },
            { code: '400.40.0000', debit: 0, credit: vals.c6, name: "Interest on Member Loan" },
            { code: '200.20.0000', debit: 0, credit: vals.c8, name: "PBS Contribution" }
          ];

          mapping.forEach(m => {
            if (m.debit > 0 || m.credit > 0) {
              journalLines.push({ 
                accountCode: m.code, accountName: m.name, 
                debit: m.debit, credit: m.credit, 
                memberId: mDocId, memo: particulars 
              });
              totalDebit += m.debit;
              totalCredit += m.credit;
              bankEffect += (m.credit - m.debit);
            }
          });

          const deterministicId = `${dateKey}&${mDocId}&BATCH&${journalId}`;
          batchOps.push({
            type: 'set',
            path: `members/${mDocId}/fundSummaries/${deterministicId}`,
            data: {
              employeeContribution: vals.c1, loanWithdrawal: vals.c2, loanRepayment: vals.c3,
              profitEmployee: vals.c5, profitLoan: vals.c6, pbsContribution: vals.c8, profitPbs: vals.c9,
              id: deterministicId, summaryDate: postingDate, particulars, journalEntryId: journalId, memberId: mDocId,
              createdAt: timestamp, isSystemGenerated: true
            }
          });
        }

        if (bankEffect !== 0) {
          const isDebit = bankEffect > 0;
          journalLines.push({
            accountCode: '107.10.0000', accountName: 'Receivable from PBS',
            debit: isDebit ? Math.abs(bankEffect) : 0,
            credit: !isDebit ? Math.abs(bankEffect) : 0,
            memo: `Bulk Import Reconciliation - ${postingDate}`
          });
          if (isDebit) totalDebit += Math.abs(bankEffect);
          else totalCredit += Math.abs(bankEffect);
        }

        if (journalLines.length > 0) {
          batchOps.push({
            type: 'set',
            path: `journalEntries/${journalId}`,
            data: {
              id: journalId, entryDate: postingDate, referenceNumber: `BULK-${dateKey}`,
              description: `Automated Batch Dual-Entry: Monthly Import ${postingDate}`,
              lines: journalLines, totalAmount: totalDebit,
              createdAt: timestamp, updatedAt: timestamp
            }
          });
        }
      }

      await serverExecuteBatch(batchOps);
      errorEmitter.emit('data-updated', { path: 'members' });

      showAlert({ 
        title: "Audit Synchronized", 
        description: `Successfully processed ${bulkPreview.rawData.length} lines into the project vault.`, 
        type: "success" 
      });
      setIsPreviewOpen(false);
      setBulkPreview(null);
    } catch (err) {
      toast({ title: "Sync Failed", description: "The batch operation encountered an error.", variant: "destructive" });
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDeleteMember = (id: string, name: string) => {
    const pw = window.prompt("Enter Authorization Code to Delete Member:");
    if (pw !== "321") {
      if (pw !== null) toast({ title: "Access Denied", description: "Incorrect authorization code.", variant: "destructive" });
      return;
    }
    showAlert({ 
      title: "Irreversible Purge?", 
      description: `Remove ${name} from vault?`, 
      type: "warning", 
      showCancel: true, 
      onConfirm: () => deleteDocumentNonBlocking(doc(firestore, "members", id)) 
    });
  };

  const headerActions = useMemo(() => (
    <div className="flex gap-3 ml-auto no-print">
      <Button variant="outline" onClick={() => setIsBulkOpen(true)} className="h-10 border-2 border-black uppercase text-[11px] font-black text-black rounded-xl px-6 bg-white hover:bg-slate-50 shadow-md">
        <Upload className="size-4 mr-2" /> Monthly Data Import
      </Button>
      <Button onClick={() => setIsAddOpen(true)} className="h-10 bg-black text-white uppercase text-[11px] font-black rounded-xl px-8 shadow-xl">
        <Plus className="size-4 mr-2" /> Register Employee
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
            placeholder="Search  Employee (ID/Name)..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        <div className="flex items-center gap-6 border-l-2 border-black/10 pl-8 ml-8">
          <div className="flex items-center gap-3">
            <Label className="uppercase text-slate-500 tracking-widest">Display Rows</Label>
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
            {members.length} Employees Listed
          </Badge>
        </div>
      </div>

      <div className="bg-white rounded-none border-2 border-black shadow-2xl overflow-hidden">
        <Table className="text-black font-black">
          <TableHeader className="bg-slate-100 border-b-2 border-black">
            <TableRow>
              <TableHead className="w-[150px] uppercase text-[11px] font-black pl-8 text-amber-800 border-r border-black tracking-[0.1em]">PayID</TableHead>
              <TableHead className="uppercase text-[11px] font-black text-blue-800 border-r border-black tracking-[0.1em]">Legal Name</TableHead>
              <TableHead className="uppercase text-[11px] font-black text-slate-600 border-r border-black tracking-[0.1em]">Designation</TableHead>
              <TableHead className="uppercase text-[11px] font-black text-indigo-700 text-center border-r border-black tracking-[0.1em]">Status</TableHead>
              <TableHead className="text-right uppercase text-[11px] font-black pr-8 text-black tracking-[0.1em]">Operations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow key="loading-row"><TableCell colSpan={5} className="text-center py-24"><Loader2 className="size-10 animate-spin mx-auto text-black" /></TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow key="empty-row"><TableCell colSpan={5} className="text-center py-32 text-slate-400 font-black uppercase text-xl italic opacity-20">No institutional records synchronized</TableCell></TableRow>
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-300 hover:text-white hover:bg-rose-600 transition-all" onClick={() => handleDeleteMember(m.id, m.name)}><Trash2 className="size-3.5" /></Button>
                    <Button variant="outline" size="sm" asChild className="h-6 px-4 border-black border-2 font-black uppercase text-[10px] text-black bg-white hover:bg-black hover:text-white rounded-none transition-all tracking-widest ml-2"><Link href={`/members/${m.id}`}>Open Ledger</Link></Button>
                  </div>
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center no-print px-2">
        <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest italic">Institutional Registry Interface</p>
        <div className="flex items-center gap-2">
           <Button variant="outline" disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); setLastVisible(null); }} className="h-8 border-2 border-black font-black uppercase text-[9px] px-4">Previous</Button>
           <Button variant="outline" disabled={members.length < pageSize} onClick={() => { setLastVisible(rawMembers?.[rawMembers.length - 2]); setCurrentPage(p => p + 1); }} className="h-8 border-2 border-black font-black uppercase text-[9px] px-4">Next</Button>
        </div>
      </div>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="max-w-xl bg-white border-2 border-black p-0 rounded-none shadow-2xl font-ledger">
          <DialogHeader className="bg-slate-50 p-6 border-b-2 border-black flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-black uppercase flex items-center gap-3">
                <FileType className="size-6 text-emerald-600" />
                Monthly Data Import
              </DialogTitle>
              <DialogDescription className="font-black uppercase tracking-widest text-slate-500 mt-1">
                Phase 1: Excel Integration
              </DialogDescription>
            </div>
            <Button variant="outline" onClick={downloadTemplate} className="h-8 border-black border-2 font-black uppercase text-[9px] gap-1 px-3">
              <Download className="size-3" /> Template
            </Button>
          </DialogHeader>
          
          <div className="p-8 space-y-6">
            <div className="p-10 border-4 border-dashed border-slate-200 rounded-3xl text-center cursor-pointer hover:border-black transition-all group" onClick={() => fileInputRef.current?.click()}>
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleExcelUpload} disabled={isUploading} accept=".xlsx, .xls" />
              {isUploading ? (
                <div className="space-y-4">
                  <Loader2 className="size-12 animate-spin mx-auto text-black" />
                  <p className="text-xs font-black uppercase tracking-widest text-black text-center">Parsing Data ...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="size-12 mx-auto text-slate-300 group-hover:text-black transition-colors" />
                  <p className="text-sm font-black uppercase tracking-[0.2em]">Select Monthly Excel</p>
                  <p className="text-[9px] font-black uppercase text-slate-400">verification</p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="bg-slate-100 p-4 border-t-2 border-black">
            <Button variant="ghost" onClick={() => setIsBulkOpen(false)} className="font-black text-[10px] uppercase tracking-widest border-2 border-black h-9 px-6 bg-white hover:bg-slate-50">Cancel Terminal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl bg-white border-4 border-black p-0 rounded-none shadow-2xl font-ledger">
          <DialogHeader className="bg-black text-white p-6 border-b-2 border-black">
            <DialogTitle className="text-xl font-black uppercase flex items-center gap-3">
              <ShieldCheck className="size-6 text-emerald-400" />
             Reconciliation
            </DialogTitle>
            <DialogDescription className="text-slate-400 font-black uppercase tracking-widest mt-1">
              Phase 2: Confirmation of Statutory Totals
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-slate-50 border-2 border-black rounded-xl space-y-1">
                  <p className="uppercase text-slate-400">Total Employees</p>
                  <p className="text-2xl font-black text-black">{bulkPreview?.totalMembers} Members</p>
               </div>
               <div className="p-4 bg-slate-50 border-2 border-black rounded-xl space-y-1">
                  <p className="uppercase text-slate-400">Emp Contrib (Col 1)</p>
                  <p className="text-2xl font-black text-indigo-700">৳ {bulkPreview?.totalEmpCont.toLocaleString()}</p>
               </div>
               <div className="p-4 bg-slate-50 border-2 border-black rounded-xl space-y-1">
                  <p className="uppercase text-slate-400">PBS Matching (Col 8)</p>
                  <p className="text-2xl font-black text-emerald-700">৳ {bulkPreview?.totalPbsCont.toLocaleString()}</p>
               </div>
               <div className="p-4 bg-slate-50 border-2 border-black rounded-xl space-y-1">
                  <p className="uppercase text-slate-400">Net Loan Movement</p>
                  <p className={cn("text-2xl font-black", bulkPreview?.totalLoanAct >= 0 ? "text-rose-700" : "text-emerald-700")}>
                    ৳ {Math.abs(bulkPreview?.totalLoanAct || 0).toLocaleString()} {bulkPreview?.totalLoanAct >= 0 ? "(Disbursed)" : "(Recovered)"}
                  </p>
               </div>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-xl flex gap-3 items-start">
               <AlertCircle className="size-5 text-amber-600 mt-1 shrink-0" />
               <div className="space-y-1">
                 <p className="uppercase text-amber-900 tracking-wider">Institutional Data Integrity Safe</p>
                 <p className="text-[11px] leading-relaxed text-amber-800 font-bold italic">
                   This will synchronize balanced Journal Entries against "Receivable from PBS (107.10.0000)". Any existing data for these members on these dates will be reconciled (updated) automatically.
                 </p>
               </div>
            </div>

            {isCommitting && (
               <div className="text-center space-y-2 py-4">
                  <Loader2 className="size-8 animate-spin mx-auto text-black" />
                  <p className="text-xs font-black uppercase tracking-widest">Committing Atomic Batch to Project Folder...</p>
                  <p className="text-[10px] font-bold text-slate-400">Synchronizing database file on PC drive.</p>
               </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t-2 border-black gap-3">
             <Button variant="outline" onClick={() => setIsPreviewOpen(false)} disabled={isCommitting} className="border-black border-2 font-black uppercase text-[11px] px-8 h-12 bg-white">Abandon</Button>
             <Button onClick={handleConfirmUpload} disabled={isCommitting} className="bg-black text-white font-black uppercase text-[11px] px-12 h-12 shadow-xl group">
               <CheckCircle2 className="size-4 mr-2 group-hover:scale-110 transition-transform text-emerald-400" />
               Commit to Project Vault
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) setEditingMember(null); }}>
        <DialogContent className="max-w-2xl bg-white p-0 rounded-none shadow-2xl overflow-hidden border-4 border-black font-ledger">
          <DialogHeader className="bg-slate-50 p-6 border-b-4 border-black">
            <DialogTitle className="font-black uppercase text-2xl flex items-center gap-4 text-black">
              <UserCircle className="size-8 text-blue-700" /> 
              EMPLOYEE REGISTRATION
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="p-8 space-y-10 text-black bg-white">
            <div className="grid grid-cols-2 gap-10">
              <div className="space-y-2.5">
                <Label className="uppercase text-amber-800 ml-1 tracking-widest">PayID</Label>
                <Input name="memberIdNumber" defaultValue={editingMember?.memberIdNumber} required className="h-14 border-black border-2 font-black text-2xl tabular-nums bg-slate-50 focus:bg-white" disabled={!!editingMember} />
              </div>
              <div className="space-y-2.5">
                <Label className="uppercase text-blue-800 ml-1 tracking-widest">Name</Label>
                <Input name="name" defaultValue={editingMember?.name} required className="h-14 border-black border-2 font-black text-xl uppercase" />
              </div>
              <div className="space-y-2.5">
                <Label className="uppercase text-slate-700 ml-1 tracking-widest">Designation</Label>
                <Input name="designation" defaultValue={editingMember?.designation} required className="h-14 border-black border-2 font-black text-lg uppercase" />
              </div>
              <div className="space-y-2.5">
                <Label className="uppercase text-indigo-800 ml-1 tracking-widest">Joining Date</Label>
                <Input name="dateJoined" type="date" max="9999-12-31" defaultValue={editingMember?.dateJoined} required className="h-14 border-black border-2 font-black text-xl text-black" />
              </div>
              <div className="space-y-2.5">
                <Label className="uppercase text-slate-700 ml-1 tracking-widest">Assigned Office</Label>
                <Input name="zonalOffice" defaultValue={editingMember?.zonalOffice} className="h-14 border-black border-2 font-black text-lg text-black uppercase" />
              </div>
              <div className="space-y-2.5">
                <Label className="uppercase text-rose-800 ml-1 tracking-widest">Status</Label>
                <Select name="status" defaultValue={editingMember?.status || "Active"}>
                  <SelectTrigger className="h-14 border-black border-2 font-black text-lg text-black uppercase">
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
              <div className="col-span-2 space-y-2.5">
                <Label className="uppercase text-slate-700 ml-1 tracking-widest">Permanent Registry Address</Label>
                <Textarea name="permanentAddress" defaultValue={editingMember?.permanentAddress} className="border-black border-2 font-black text-black min-h-[100px] uppercase text-sm" />
              </div>
            </div>
            <Button type="submit" className="w-full h-20 font-black uppercase tracking-[0.4em] shadow-2xl bg-black text-white hover:bg-slate-900 border-none transition-all group text-lg">
              <Plus className="size-7 mr-4 group-hover:scale-110 transition-transform text-emerald-400" />
              COMMIT PROFILE
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
