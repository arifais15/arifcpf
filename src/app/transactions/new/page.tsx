
"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHART_OF_ACCOUNTS } from "@/lib/coa-data";
import { Sparkles, Save, Info, AlertTriangle, Loader2 } from "lucide-react";
import { classifyTransaction } from "@/ai/flows/transaction-classification-assistant";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useFirestore, addDocumentNonBlocking } from "@/firebase";
import { collection, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function NewTransactionPage() {
  const [description, setDescription] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState("");
  
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();

  const handleAIClassify = async () => {
    if (!description) {
      toast({ title: "Error", description: "Please enter a description first.", variant: "destructive" });
      return;
    }

    setIsClassifying(true);
    try {
      const result = await classifyTransaction({ transactionDescription: description });
      setAiSuggestion(result);
      if (result.suggestedAccount) {
        // Find matching COA entry
        const match = CHART_OF_ACCOUNTS.find(a => a.code === result.suggestedAccount.accountCode);
        if (match) {
          setSelectedAccount(match.code);
        }
      }
    } catch (err) {
      toast({ title: "AI Error", description: "Could not classify transaction.", variant: "destructive" });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSave = () => {
    if (!selectedAccount || !amount || !description) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    
    // In a real double-entry system, we'd have multiple lines. 
    // For this MVP, we create a Journal Entry and its first line item.
    const journalEntriesRef = collection(firestore, "journalEntries");
    
    const entryData = {
      entryDate,
      description,
      referenceNumber: refNo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // We store the primary line item directly in the document for easier reporting in this prototype
      primaryLine: {
        chartOfAccountId: selectedAccount,
        amount: Number(amount),
        accountName: CHART_OF_ACCOUNTS.find(a => a.code === selectedAccount)?.name || ""
      }
    };

    addDocumentNonBlocking(journalEntriesRef, entryData)
      .then(() => {
        toast({ title: "Success", description: "Journal entry has been recorded." });
        router.push("/reports");
      })
      .catch(() => {
        toast({ title: "Error", description: "Failed to save transaction.", variant: "destructive" });
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-primary tracking-tight">Record Transaction</h1>
        <p className="text-muted-foreground">New financial entry into the CPF Ledger</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-8 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Manual Entry</CardTitle>
            <CardDescription>Enter the details for the ledger entry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Transaction Date</Label>
                <Input 
                  type="date" 
                  id="date" 
                  value={entryDate} 
                  onChange={(e) => setEntryDate(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference / Voucher No.</Label>
                <Input 
                  id="reference" 
                  placeholder="e.g. PJ-08-001" 
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Transaction Description</Label>
              <div className="relative">
                <Textarea 
                  id="description" 
                  placeholder="Describe the transaction (e.g. Monthly contribution for Prokash Kumar Saha for August 2025)" 
                  className="min-h-[100px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <Button 
                  type="button" 
                  size="sm" 
                  variant="secondary"
                  className="absolute bottom-2 right-2 gap-2"
                  onClick={handleAIClassify}
                  disabled={isClassifying}
                >
                  {isClassifying ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-accent" />}
                  {isClassifying ? "Classifying..." : "AI Assistant"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account">Account (COA)</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {CHART_OF_ACCOUNTS.filter(a => !a.isHeader).map(a => (
                      <SelectItem key={a.code} value={a.code}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (৳)</Label>
                <Input 
                  type="number" 
                  id="amount" 
                  placeholder="0.00" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                />
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setDescription("");
                setAmount("");
                setSelectedAccount("");
                setRefNo("");
                setAiSuggestion(null);
              }}>Reset Form</Button>
              <Button className="gap-2" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Entry
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-sm bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <Sparkles className="size-5" />
              AI Entry Insight
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!aiSuggestion ? (
              <div className="text-center py-8 px-4 text-muted-foreground">
                <Info className="size-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Describe the transaction and click "AI Assistant" to get account suggestions and error checks.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="p-3 bg-white rounded-lg border border-accent/20">
                  <p className="text-xs font-semibold text-accent uppercase mb-2">Suggested Classification</p>
                  <p className="text-lg font-bold text-primary">{aiSuggestion.suggestedAccount.accountName}</p>
                  <p className="text-sm font-mono text-muted-foreground">{aiSuggestion.suggestedAccount.accountCode}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">{aiSuggestion.suggestedAccount.accountType}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{aiSuggestion.suggestedAccount.normalBalance}</Badge>
                  </div>
                </div>

                {aiSuggestion.potentialErrors && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                    <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm mb-1">
                      <AlertTriangle className="size-4" />
                      Potential Error Flagged
                    </div>
                    <p className="text-xs text-rose-600">{aiSuggestion.errorDescription}</p>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Rationale</p>
                  <p className="text-xs leading-relaxed text-slate-700">{aiSuggestion.rationale}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
