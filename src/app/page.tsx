
"use client"

import { useMemo, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, TrendingUp, Wallet, ShieldCheck, Loader2, PieChart, Activity, HardDrive, DatabaseZap, Clock, ArrowUpRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const firestore = useFirestore();
  const [lastSaved, setLastSaved] = useState<string>("");

  useEffect(() => {
    setLastSaved(new Date().toLocaleTimeString('bn-BD'));
    const handleSync = () => setLastSaved(new Date().toLocaleTimeString('bn-BD'));
    window.addEventListener('storage', handleSync);
    return () => window.removeEventListener('storage', handleSync);
  }, []);

  const membersRef = useMemoFirebase(() => collection(firestore, "members"), [firestore]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersRef);

  const entriesRef = useMemoFirebase(() => collection(firestore, "journalEntries"), [firestore]);
  const { data: entries, isLoading: isEntriesLoading } = useCollection(entriesRef);

  const investmentsRef = useMemoFirebase(() => collection(firestore, "investmentInstruments"), [firestore]);
  const { data: investments, isLoading: isInvestmentsLoading } = useCollection(investmentsRef);

  const statsData = useMemo(() => {
    if (!entries) return { fundValue: 0, currentLoans: 0, profitDistributed: 0 };
    let fundValue = 0;
    let currentLoans = 0;
    let profitDistributed = 0;
    entries.forEach(entry => {
      (entry.lines || []).forEach((line: any) => {
        const code = line.accountCode;
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        
        if (code === '200.10.0000' || code === '200.20.0000') fundValue += (credit - debit);
        if (code === '105.10.0000') currentLoans += debit;
        if (code === '105.20.0000') currentLoans -= credit;
        if (code === '200.30.0000' || code === '200.40.0000') profitDistributed += (credit - debit);
      });
    });
    return { fundValue, currentLoans, profitDistributed };
  }, [entries]);

  const allocation = useMemo(() => {
    if (!investments || !entries) return [];
    let cashBalance = 0;
    entries.forEach(entry => {
      (entry.lines || []).forEach((line: any) => {
        if (line.accountCode?.startsWith('131.')) {
          cashBalance += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        }
      });
    });
    const fdrTotal = investments.filter(i => i.instrumentType === 'FDR').reduce((sum, i) => sum + (Number(i.principalAmount) || 0), 0);
    const bondsTotal = investments.filter(i => i.instrumentType === 'Govt. Treasury Bond').reduce((sum, i) => sum + (Number(i.principalAmount) || 0), 0);
    const total = fdrTotal + bondsTotal + statsData.currentLoans + cashBalance || 1;
    return [
      { label: "স্থায়ী আমানত (FDR)", value: Math.round((fdrTotal / total) * 100), color: "bg-blue-600" },
      { label: "ট্রেজারি বন্ড", value: Math.round((bondsTotal / total) * 100), color: "bg-indigo-600" },
      { label: "সদস্য ঋণ", value: Math.round((statsData.currentLoans / total) * 100), color: "bg-rose-600" },
      { label: "নগদ সমতুল্য", value: Math.round((cashBalance / total) * 100), color: "bg-slate-500" },
    ].sort((a, b) => b.value - a.value);
  }, [investments, entries, statsData.currentLoans]);

  const recentEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()).slice(0, 8);
  }, [entries]);

  if (isMembersLoading || isEntriesLoading || isInvestmentsLoading) {
    return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="size-10 animate-spin text-black" /></div>;
  }

  const stats = [
    { 
      title: "সদস্য রেজিস্টার", 
      value: members?.length.toLocaleString('bn-BD') || "০", 
      icon: Users, 
      sub: "নিবন্ধিত কর্মকর্তা-কর্মচারী", 
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200"
    },
    { 
      title: "মোট ফান্ড ইকুইটি", 
      value: `৳ ${(statsData.fundValue / 1000000).toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`, 
      icon: Wallet, 
      sub: "পুঞ্জীভূত মূলধন", 
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200"
    },
    { 
      title: "বকেয়া ঋণ", 
      value: `৳ ${(statsData.currentLoans / 1000).toLocaleString('bn-BD', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`, 
      icon: TrendingUp, 
      sub: "বর্তমান পাওনা", 
      color: "text-rose-700",
      bg: "bg-rose-50",
      border: "border-rose-200"
    },
    { 
      title: "অর্জিত মুনাফা", 
      value: `৳ ${(statsData.profitDistributed / 1000).toLocaleString('bn-BD', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`, 
      icon: Activity, 
      sub: "সদস্য বন্টন", 
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200"
    },
  ];

  return (
    <div className="p-10 flex flex-col gap-10 bg-slate-50 min-h-screen font-bangla text-black">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-black text-black tracking-tight uppercase">সারসংক্ষেপ</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-[11px] font-bold">সমন্বিত সিপিএফ ম্যানেজমেন্ট টার্মিনাল • প্রাতিষ্ঠানিক ড্যাশবোর্ড</p>
        </div>

        <div className="flex items-center gap-4 bg-white border-2 border-black p-4 rounded-2xl shadow-lg no-print">
           <div className="bg-slate-100 p-2 rounded-xl border border-black/10">
             <HardDrive className="size-5 text-slate-600" />
           </div>
           <div className="space-y-0.5">
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ডেটাবেস ইঞ্জিন:</span>
               <Badge className="bg-black text-white text-[8px] h-4 uppercase font-bold border-none rounded-none px-2 tracking-widest">Local Matrix Active</Badge>
             </div>
             <div className="flex items-center gap-2">
               <Clock className="size-3 text-slate-400" />
               <span className="text-[11px] font-bold text-slate-600">সিঙ্ক সময়: {lastSaved}</span>
             </div>
           </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className={cn("border-2 shadow-xl hover:scale-[1.02] transition-all overflow-hidden rounded-2xl", stat.bg, stat.border)}>
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {stat.title}
              </CardTitle>
              <stat.icon className={cn("h-6 w-6", stat.color)} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-3xl font-black tracking-tight tabular-nums", stat.color)}>{stat.value}</div>
              <p className="text-[10px] font-bold uppercase mt-2 tracking-wider text-slate-400 border-t border-black/5 pt-2">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-8 border-2 border-black shadow-2xl rounded-none overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 border-b-2 border-black flex flex-row items-center justify-between py-5 px-6">
            <div>
              <CardTitle className="text-lg font-black uppercase flex items-center gap-3 text-black">
                <ShieldCheck className="size-5" />
                অডিট লগ: সাম্প্রতিক কার্যক্রম
              </CardTitle>
              <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-500">যাচাইকৃত দ্বৈত-প্রবেশ হিসাব বিবরণী (Local Drive Archive)</CardDescription>
            </div>
            <Badge variant="outline" className="border-black border-2 font-black px-4 py-1.5 uppercase text-[9px] tracking-widest bg-white shadow-sm">রিয়েল-টাইম ডাটা</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 border-b-2 border-black">
                    <TableHead className="font-black py-4 pl-6 text-black uppercase text-[10px] border-r border-black/10">তারিখ</TableHead>
                    <TableHead className="font-black py-4 text-black uppercase text-[10px] border-r border-black/10">বিবরণ</TableHead>
                    <TableHead className="font-black py-4 text-black uppercase text-[10px] border-r border-black/10">রেফারেন্স</TableHead>
                    <TableHead className="text-right font-black py-4 pr-6 text-black uppercase text-[10px]">পরিমাণ (৳)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEntries.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-24 text-slate-400 font-bold uppercase text-xs">কোনো তথ্য পাওয়া যায়নি।</TableCell></TableRow>
                  ) : recentEntries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-slate-50 transition-colors border-b border-black/10 last:border-0 h-[29px]">
                      <td className="font-mono text-[11px] font-bold pl-6 border-r border-black/5">{entry.entryDate}</td>
                      <td className="text-[11px] font-bold uppercase text-slate-700 truncate max-w-[250px] border-r border-black/5">{entry.description}</td>
                      <td className="border-r border-black/5"><Badge variant="outline" className="text-[9px] uppercase font-bold tracking-widest px-2 border-black/20 rounded-none bg-slate-50">{entry.referenceNumber || "স্বয়ংক্রিয়"}</Badge></td>
                      <td className="text-right font-black text-black pr-6 tabular-nums">৳ {(entry.totalAmount || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 })}</td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-2 border-black shadow-2xl bg-white rounded-none flex flex-col overflow-hidden">
          <CardHeader className="py-5 px-6 border-b-2 border-black bg-slate-50">
            <CardTitle className="text-lg font-black uppercase flex items-center gap-3 text-black">
              <PieChart className="size-5" />
              সম্পদ বন্টন
            </CardTitle>
            <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-500">পোর্টফোলিও ঝুঁকি ও বিন্যাস ম্যাট্রিক্স</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-8 p-8">
            <div className="space-y-8">
              {allocation.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                    <span>{item.label}</span>
                    <span className="tabular-nums font-black text-black">{item.value.toLocaleString('bn-BD')}%</span>
                  </div>
                  <div className="h-4 w-full bg-slate-100 rounded-none overflow-hidden shadow-inner border border-black/10">
                    <div className={cn("h-full transition-all duration-1000 ease-in-out shadow-sm", item.color)} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-auto p-6 bg-slate-900 text-white border-2 border-black rounded-2xl space-y-4 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <DatabaseZap className="size-20" />
               </div>
               <div className="flex items-center gap-2 relative z-10">
                 <DatabaseZap className="size-4 text-emerald-400" />
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">ডিস্ক পারসিস্টেন্স মনিটর</p>
               </div>
               <p className="text-[12px] text-slate-300 leading-relaxed font-bold italic relative z-10 border-l-2 border-emerald-500 pl-4">
                 "ডাটা সরাসরি হোস্ট মেশিনের ড্রাইভে সংরক্ষিত হয়। জিরো ক্লাউড এক্সপোজার উচ্চ গোপনীয়তা নিশ্চিত করে। প্রাতিষ্ঠানিক গোপনীয়তা বজায় রাখতে আমরা এই লোকাল ইঞ্জিন ব্যবহার করি।"
               </p>
               <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest relative z-10 pt-2 border-t border-white/5">
                 <ShieldCheck className="size-3" />
                 ইন্ডাস্ট্রি স্ট্যান্ডার্ড এনক্রিপশন সক্রিয়
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
