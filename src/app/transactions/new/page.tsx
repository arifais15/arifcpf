"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHART_OF_ACCOUNTS } from "@/lib/coa-data";
import { Sparkles, Save, Info, AlertTriangle } from "lucide-react";
import { classifyTransaction } from "@/ai/flows/transaction-classification-assistant";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function NewTransactionPage() {
  const [description, setDescription] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [amount, setAmount] = useState("");
  const { toast } = useToast();

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
        setSelectedAccount(result.suggestedAccount.accountCode);
      }
    } catch (err) {
      toast({ title: "AI Error", description: "Could not classify transaction.", variant: "destructive" });
    } finally {
      setIsClassifying(false);
    }
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
                <Input type="date" id="date" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference / Voucher No.</Label>
                <Input id="reference" placeholder="e.g. PJ-08-001" />
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
                  <Sparkles className="size-3.5 text-accent" />
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
                  <SelectContent>
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
                <Input type="number" id="amount" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end gap-3">
              <Button variant="outline">Reset Form</Button>
              <Button className="gap-2">
                <Save className="size-4" />
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
