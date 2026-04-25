"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  BookOpen, 
  Users, 
  ListTodo, 
  Percent, 
  Printer, 
  ShieldCheck, 
  FileText, 
  Settings, 
  HelpCircle,
  ArrowRight,
  DatabaseZap,
  Calculator,
  ServerCrash,
  Coins,
  Globe,
  Monitor,
  Terminal,
  Save,
  HardDrive,
  Power,
  RefreshCw,
  FileDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function UserManualPage() {
  const { toast } = useToast();

  const handlePdfDownload = () => {
    toast({
      title: "Generating Institutional PDF",
      description: "Please select 'Save as PDF' in the destination menu for high-fidelity output.",
    });
    window.print();
  };

  const sections = [
    {
      title: "সদস্য ব্যবস্থাপনা (Member Registry)",
      description: "Personnel Profile & Ledger Maintenance",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      content: [
        "সদস্যদের প্রোফাইল যোগ, এডিট এবং ডিলিট করা যায়।",
        "প্রতি পেইজে ১০ জন সদস্যকে দেখা যাবে, যা সিস্টেমের স্পিড বজায় রাখে।",
        "সদস্যের নাম বা আইডি নম্বর দিয়ে সার্চ করে দ্রুত খুঁজে পাওয়া সম্ভব।",
        "'Ledger' বাটনে ক্লিক করে নির্দিষ্ট সদস্যের বিস্তারিত হিসাব দেখা যায়।"
      ]
    },
    {
      title: "জাবেদা ও লেনদেন (Journal & Transactions)",
      description: "Double-Entry Matrix & AI Assistant",
      icon: ListTodo,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      content: [
        "নতুন লেনদেন করার সময় 'AI Assistant' ব্যবহার করে চার্ট অফ অ্যাকাউন্টস পরামর্শ নেওয়া যায়।",
        "লেনদেনে সদস্যকে ট্যাগ (Tag) করলে তা স্বয়ংক্রিয়ভাবে তার ব্যক্তিগত লেজারে যুক্ত হবে।",
        "ডেবিট এবং ক্রেডিট সমান না হলে সিস্টেম ভাউচার সেভ করতে দেবে না (Balanced Entry)।",
        "ভুল এন্ট্রি হলে লেনদেন ডিলিট করলে তা মেম্বার লেজার থেকেও মুছে যাবে।"
      ]
    },
    {
      title: "মুনাফা হিসাব (Interest Accrual)",
      description: "Annual & Day-Product Yield Audit",
      icon: Percent,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      content: [
        "বছরের শেষে 'Profit Audit' রান করে সকল সদস্যের মুনাফা একসাথে জেনারেট করা যায়।",
        "বিশেষ ক্ষেত্রে (যেমন: অবসর বা ট্রান্সফার) 'Special Interest (Day-Product)' ব্যবহার করে দিনের হিসেবে মুনাফা বের করা সম্ভব।",
        "মুনাফা পোস্টিং করার আগে বিস্তারিত ব্রেকডাউন (Monthly Basis) চেক করে নেওয়া যায়।"
      ]
    },
    {
      title: "রিপোর্ট ও অডিট (Reports & Audit)",
      description: "Institutional Financial Statements",
      icon: FileText,
      color: "text-sky-600",
      bgColor: "bg-sky-50",
      borderColor: "border-sky-200",
      content: [
        "Balance Sheet, Income Statement এবং Netfund Statement স্বয়ংক্রিয়ভাবে জেনারেট হয়।",
        "সকল সদস্যের লেজার একসাথে প্রিন্ট করার জন্য 'Batch Print' অপশন রয়েছে।",
        "ভুলবশত বাল্ক পোস্টিং হলে 'Audit & Tracking' থেকে ডেট এবং Particulars ফিল্টার করে ডিলিট করা যায়।"
      ]
    }
  ];

  return (
    <div className="p-8 flex flex-col gap-8 bg-background min-h-screen font-bangla text-black">
      {/* HEADER ACTION BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-black text-primary tracking-tight uppercase">ব্যবহারকারী নির্দেশিকা</h1>
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">পিবিএস সিপিএফ ম্যানেজমেন্ট সফটওয়্যার • প্রাতিষ্ঠানিক ইউজার ম্যানুয়াল</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handlePdfDownload}
            className="gap-2 font-black border-2 border-black h-11 px-6 uppercase text-[11px] tracking-widest shadow-lg"
          >
            <FileDown className="size-4" /> Download PDF
          </Button>
          <Button onClick={() => window.print()} className="gap-2 bg-black text-white font-black h-11 px-8 uppercase text-[11px] tracking-widest shadow-xl">
            <Printer className="size-4" /> Print Full Manual
          </Button>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12 max-w-[1400px] mx-auto w-full">
        {/* LEFT COLUMN: GUIDES & SETUP */}
        <div className="lg:col-span-7 space-y-10">
          
          {/* FIRST TIME SETUP */}
          <Card className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden rounded-none">
            <div className="bg-black text-white p-6 flex items-center gap-6">
              <div className="bg-white/10 p-3 rounded-2xl">
                <Terminal className="size-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">প্রথমবার ব্যবহারের নিয়ম (First-Time Setup)</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Standalone Portable Matrix Setup</p>
              </div>
            </div>
            <CardContent className="p-8 grid md:grid-cols-3 gap-8">
              {[
                { step: "1", title: "Node.js ইন্সটল", desc: "সফটওয়্যারটি চালানোর জন্য পিসিতে Node.js (LTS) থাকতে হবে। nodejs.org থেকে ডাউনলোড করুন।" },
                { step: "2", title: "ডিপেন্ডেন্সি", desc: "প্রজেক্ট ফোল্ডারে cmd ওপেন করে npm install লিখুন। এটি প্রয়োজনীয় লাইব্রেরি সেটআপ করবে।" },
                { step: "3", title: "সফটওয়্যার রান", desc: "cmd-তে npm run dev লিখুন। এরপর ব্রাউজারে localhost:9002 ওপেন করুন। আইডি: arif" }
              ].map((item, i) => (
                <div key={i} className="space-y-4">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-lg border-2 border-black">{item.step}</div>
                  <h4 className="font-black text-[12px] uppercase text-black border-b border-black/10 pb-1">{item.title}</h4>
                  <p className="text-[13px] text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* DAILY USAGE GUIDE */}
          <Card className="border-2 border-amber-500 shadow-[8px_8px_0px_0px_rgba(245,158,11,1)] bg-white overflow-hidden rounded-none">
            <div className="bg-amber-50 text-white p-6 flex items-center gap-6">
              <div className="bg-white/20 p-3 rounded-2xl">
                <Power className="size-8" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">পিসি বন্ধ করার পর পুনরায় চালু করার নিয়ম</h2>
                <p className="text-amber-100 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">Daily Server Operations</p>
              </div>
            </div>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                 <div className="bg-amber-50 p-6 rounded-3xl border-2 border-amber-100 shrink-0 flex flex-col items-center gap-2">
                   <RefreshCw className="size-10 text-amber-600 animate-spin-slow" />
                   <span className="text-[10px] font-black uppercase text-amber-600">Re-Initialize</span>
                 </div>
                 <div className="space-y-4">
                   <h4 className="text-lg font-black uppercase text-amber-800">প্রতিদিন সকালে যা করতে হবে:</h4>
                   <p className="text-[15px] text-slate-700 leading-relaxed">
                     পিসি শাটডাউন দিলে আপনার সফটওয়্যারের "ইঞ্জিন" বন্ধ হয়ে যায়। পুনরায় ব্যবহার করার জন্য আপনাকে <b>cmd</b> ওপেন করে আবার <code>npm run dev</code> লিখতে হবে। 
                     সফটওয়্যার রান না করে সরাসরি <code>localhost:9002</code> এ গেলে পেজটি আসবে না।
                   </p>
                   <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl flex items-center gap-4">
                     <Badge className="bg-amber-600 text-[9px] h-5 uppercase px-2">গুরুত্বপূর্ণ</Badge>
                     <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">ডাটা হারাবে না: আপনার জমানো সব ডাটা পিসির মেমোরিতে সংরক্ষিত থাকবে।</span>
                   </div>
                 </div>
              </div>
            </CardContent>
          </Card>

          {/* VIBRANT MODULE SECTIONS */}
          <div className="grid gap-8 md:grid-cols-2">
            {sections.map((section, idx) => (
              <Card key={idx} className={cn("border-2 shadow-xl bg-white overflow-hidden group hover:shadow-2xl transition-all", section.borderColor)}>
                <CardHeader className={cn("border-b flex flex-row items-center gap-4", section.bgColor)}>
                  <div className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                    <section.icon className={cn("size-7", section.color)} />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black uppercase tracking-tight">{section.title}</CardTitle>
                    <CardDescription className="text-[10px] font-black uppercase tracking-widest text-slate-400">{section.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="space-y-4">
                    {section.content.map((item, i) => (
                      <li key={i} className="flex gap-3 text-[14px] text-slate-700 leading-relaxed items-start">
                        <div className={cn("h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5", section.bgColor)}>
                           <ArrowRight className={cn("size-3", section.color)} />
                        </div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: DATA SAFETY & PERSISTENCE */}
        <div className="lg:col-span-5 space-y-10">
          <Card className="border-4 border-black shadow-2xl bg-slate-900 text-white overflow-hidden sticky top-24">
            <div className="bg-emerald-600/30 p-8 border-b border-white/10 flex items-center gap-6">
              <div className="bg-emerald-600 p-4 rounded-3xl shadow-2xl">
                <Save className="size-10 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">ডাটা সেভ ও রিকভারি (Auto-Save)</h2>
                <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Institutional Storage Protocol</p>
              </div>
            </div>
            <CardContent className="p-8 space-y-10">
              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                    <HardDrive className="size-6 text-emerald-400" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-black text-emerald-400 uppercase text-xs tracking-[0.2em]">ইন্সট্যান্ট ডিস্ক রাইট (Local Persistence)</h4>
                    <p className="text-[13px] text-slate-400 leading-relaxed">
                      সফটওয়্যারটি <b>Local-First Architecture</b> ব্যবহার করে। আপনি যখনই কোনো ভাউচার সেভ করেন বা মুনাফা পোস্টিং করেন, সেটি সাথে সাথেই আপনার পিসির হার্ড ড্রাইভের (LocalStorage Matrix) মেমোরিতে সেভ হয়ে যায়।
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-6">
                  <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                    <ServerCrash className="size-6 text-rose-400" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-black text-rose-400 uppercase text-xs tracking-[0.2em]">বিদ্যুৎ বিভ্রাট সুরক্ষা</h4>
                    <p className="text-[13px] text-slate-400 leading-relaxed">
                      হঠাৎ পিসি বন্ধ হয়ে গেলে বা কারেন্ট চলে গেলেও আপনার ডাটা নষ্ট হবে না। পুনরায় সফটওয়্যার চালু করলে আগের সব তথ্য ঠিকভাবেই পাওয়া যাবে। সিস্টেমটি ব্রাউজার ক্যাশ ব্যবহার না করে ডিস্ক পারসিস্টেন্স ব্যবহার করে।
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 p-8 rounded-3xl border-2 border-emerald-500/30 space-y-5">
                <h4 className="font-black text-emerald-400 flex items-center gap-3 uppercase text-sm tracking-[0.2em]">
                  <ShieldCheck className="size-6" /> ব্যাকআপ নেওয়ার নিয়ম
                </h4>
                <div className="space-y-4">
                  <p className="text-[12px] text-slate-300 leading-relaxed font-black italic border-l-4 border-emerald-500 pl-4">
                    "প্রতি সপ্তাহে অন্তত একবার 'Settings' থেকে 'Download Backup' বাটন ব্যবহার করে একটি ডাটা ফাইল পেনড্রাইভে সেভ করে রাখুন। এতে পিসি নষ্ট হয়ে গেলেও অন্য পিসিতে সফটওয়্যারটি চালানো যাবে।"
                  </p>
                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/20 uppercase text-[9px] font-black">Safety Level: HIGH</Badge>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Archive: .JSON MATRIX</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-800 rounded-2xl border border-white/5 space-y-3">
                 <div className="flex items-center gap-2 text-indigo-400">
                    <Monitor className="size-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">System Monitor</p>
                 </div>
                 <div className="flex justify-between items-center text-[11px] font-black text-slate-400 uppercase tracking-tighter">
                   <span>Engine Mode:</span>
                   <span className="text-emerald-400">Local Dist v1.2</span>
                 </div>
                 <div className="flex justify-between items-center text-[11px] font-black text-slate-400 uppercase tracking-tighter">
                   <span>Persistence:</span>
                   <span className="text-emerald-400">Disk Active</span>
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PRINT VIEW FOOTER */}
      <div className="mt-20 pt-10 border-t-2 border-black flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest no-print">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-black" />
          <span>Institutional Trust Registry Technical Manual</span>
        </div>
        <p className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</p>
      </div>

      {/* HIDDEN PRINT CONTAINER (FOR HIGH FIDELITY OUTPUT) */}
      <div className="hidden print:block font-ledger text-black">
        <div className="text-center space-y-2 mb-12 border-b-4 border-black pb-8">
          <h1 className="text-3xl font-black uppercase"> Operating Manual</h1>
          <p className="text-base font-black uppercase tracking-[0.3em]">PBS CPF Management Software (Portable Version)</p>
          <p className="text-xs font-black uppercase mt-4">Document Version: 1.2 • Print Date: {new Date().toLocaleDateString('en-GB')}</p>
        </div>

        <div className="space-y-12">
          <section className="space-y-6">
            <h3 className="text-xl font-black uppercase border-b-2 border-black pb-2">1. System Setup & Initialization</h3>
            <div className="grid grid-cols-2 gap-8 text-[11px]">
               <div className="space-y-4 border-2 border-black p-4">
                 <h4 className="font-black uppercase">Installation Protocol</h4>
                 <ul className="list-disc pl-5 space-y-2">
                   <li>Ensure Node.js (LTS) is installed on the host machine.</li>
                   <li>Execute 'npm install' via system console in the root directory.</li>
                   <li>Start the operational engine using 'npm run dev'.</li>
                 </ul>
               </div>
               <div className="space-y-4 border-2 border-black p-4 bg-slate-50">
                 <h4 className="font-black uppercase">Daily Operations</h4>
                 <p>The system runs as a local server. Every session requires re-initialization via the terminal to bridge the persistent storage matrix.</p>
               </div>
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-xl font-black uppercase border-b-2 border-black pb-2">2. Functional Module Definitions</h3>
            <table className="w-full border-collapse border-2 border-black text-[10px] font-black">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black p-3 text-left uppercase">Module Name</th>
                  <th className="border border-black p-3 text-left uppercase">Operational Rule</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s, i) => (
                  <tr key={i}>
                    <td className="border border-black p-3 w-1/3">{s.title}</td>
                    <td className="border border-black p-3">{s.content.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="space-y-6">
            <h3 className="text-xl font-black uppercase border-b-2 border-black pb-2">3. Data Integrity & Safety Protocol</h3>
            <div className="p-6 border-4 border-black space-y-4">
              <p className="text-[12px] font-black uppercase underline">Critical Recovery Procedure:</p>
              <p className="leading-relaxed">All transaction data resides in the host continuity, the "Download Backup" function must be used weekly. The resulting .json file represents the absolute state of the CPF fund and can be migrated to any PC.</p>
            </div>
          </section>
        </div>

        <div className="mt-32 grid grid-cols-2 gap-16 text-[11px] font-black text-center uppercase tracking-widest">
          <div className="border-t-2 border-black pt-4">Technical Administrator</div>
          <div className="border-t-2 border-black pt-4">Approved By (Trustee)</div>
        </div>
        
        <div className="mt-12 pt-4 border-t border-black flex justify-between items-center text-[8px] font-black uppercase">
          <span>Manual Code: PBS-CPF-MAN-v1.2</span>
          <span>Developed by: Ariful Islam, AGM Finance , Gazipur PBS-2</span>
        </div>
      </div>
    </div>
  );
}
