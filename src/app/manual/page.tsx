
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
  HardDrive
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function UserManualPage() {
  const sections = [
    {
      title: "সদস্য ব্যবস্থাপনা (Member Registry)",
      icon: Users,
      color: "text-blue-600",
      content: [
        "সদস্যদের প্রোফাইল যোগ, এডিট এবং ডিলিট করা যায়।",
        "প্রতি পেইজে ১০ জন সদস্যকে দেখা যাবে, যা সিস্টেমের স্পিড বজায় রাখে।",
        "সদস্যের নাম বা আইডি নম্বর দিয়ে সার্চ করে দ্রুত খুঁজে পাওয়া সম্ভব।",
        "'Ledger' বাটনে ক্লিক করে নির্দিষ্ট সদস্যের বিস্তারিত হিসাব দেখা যায়।"
      ]
    },
    {
      title: "জাবেদা ও লেনদেন (Journal & Transactions)",
      icon: ListTodo,
      color: "text-emerald-600",
      content: [
        "নতুন লেনদেন করার সময় 'AI Assistant' ব্যবহার করে চার্ট অফ অ্যাকাউন্টস পরামর্শ নেওয়া যায়।",
        "লেনদেনে সদস্যকে ট্যাগ (Tag) করলে তা স্বয়ংক্রিয়ভাবে তার ব্যক্তিগত লেজারে যুক্ত হবে।",
        "ডেবিট এবং ক্রেডিট সমান না হলে সিস্টেম ভাউচার সেভ করতে দেবে না (Balanced Entry)।",
        "ভুল এন্ট্রি হলে লেনদেন ডিলিট করলে তা মেম্বার লেজার থেকেও মুছে যাবে।"
      ]
    },
    {
      title: "মুনাফা হিসাব (Interest Accrual)",
      icon: Percent,
      color: "text-orange-600",
      content: [
        "বছরের শেষে 'Profit Audit' রান করে সকল সদস্যের মুনাফা একসাথে জেনারেট করা যায়।",
        "বিশেষ ক্ষেত্রে (যেমন: অবসর বা ট্রান্সফার) 'Special Interest (Day-Product)' ব্যবহার করে দিনের হিসেবে মুনাফা বের করা সম্ভব।",
        "মুনাফা পোস্টিং করার আগে বিস্তারিত ব্রেকডাউন (Monthly Basis) চেক করে নেওয়া যায়।"
      ]
    },
    {
      title: "রিপোর্ট ও অডিট (Reports & Audit)",
      icon: FileText,
      color: "text-sky-600",
      content: [
        "Balance Sheet, Income Statement এবং Netfund Statement স্বয়ংক্রিয়ভাবে জেনারেট হয়।",
        "সকল সদস্যের লেজার একসাথে প্রিন্ট করার জন্য 'Batch Print' অপশন রয়েছে।",
        "ভুলবশত বাল্ক পোস্টিং হলে 'Audit & Tracking' থেকে ডেট এবং Particulars ফিল্টার করে ডিলিট করা যায়।"
      ]
    }
  ];

  return (
    <div className="p-10 flex flex-col gap-10 bg-background min-h-screen font-bangla">
      <div className="flex flex-col gap-2 border-b pb-6">
        <h1 className="text-4xl font-black text-primary tracking-tight uppercase">ব্যবহারকারী নির্দেশিকা ও সেটআপ</h1>
        <p className="text-muted-foreground font-bold uppercase tracking-wider text-sm">পিবিএস সিপিএফ ম্যানেজমেন্ট সফটওয়্যার • ইন্সটলেশন ও ইউজার ম্যানুয়াল</p>
      </div>

      {/* FIRST TIME SETUP SECTION */}
      <Card className="border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
        <div className="bg-black text-white p-8 flex items-center gap-6">
          <Terminal className="size-10" />
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">প্রথমবার ব্যবহারের নিয়ম (First-Time Setup)</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Standalone Portable Edition Setup Guide</p>
          </div>
        </div>
        <CardContent className="p-8 grid md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-lg border-2 border-black">1</div>
            <h4 className="font-black text-sm uppercase">Node.js ইন্সটল করুন</h4>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              সফটওয়্যারটি চালানোর জন্য আপনার পিসিতে <b>Node.js (LTS Version)</b> ইন্সটল থাকতে হবে। nodejs.org থেকে এটি ডাউনলোড করে নিন।
            </p>
          </div>
          <div className="space-y-4">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-lg border-2 border-black">2</div>
            <h4 className="font-black text-sm uppercase">ডিপেন্ডেন্সি সেটআপ</h4>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              প্রজেক্ট ফোল্ডারে গিয়ে Command Prompt (cmd) ওপেন করুন এবং লিখুন: <code>npm install</code>। এটি সফটওয়্যারের প্রয়োজনীয় ফাইলগুলো গুছিয়ে নেবে।
            </p>
          </div>
          <div className="space-y-4">
            <div className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center font-black text-lg border-2 border-black">3</div>
            <h4 className="font-black text-sm uppercase">সফটওয়্যার চালু করুন</h4>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              cmd-তে লিখুন: <code>npm run dev</code>। এরপর ব্রাউজারে গিয়ে <code>http://localhost:9002</code> ওপেন করুন। ইউজার আইডি: <b>arif</b>, পাসওয়ার্ড: <b>123123</b>।
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        {sections.map((section, idx) => (
          <Card key={idx} className="border-none shadow-lg bg-white overflow-hidden group hover:shadow-xl transition-all border-2 border-slate-100">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center gap-4">
              <div className={`p-3 rounded-2xl bg-white shadow-sm border border-slate-100 ${section.color}`}>
                <section.icon className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{section.title}</CardTitle>
                <CardDescription className="text-xs">কিভাবে ব্যবহার করবেন তার সংক্ষিপ্ত গাইড</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <ul className="space-y-3">
                {section.content.map((item, i) => (
                  <li key={i} className="flex gap-3 text-[15px] text-slate-700 leading-relaxed">
                    <ArrowRight className="size-4 mt-1 text-slate-300 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* DATA SAVING & RECOVERY */}
      <Card className="border-none shadow-2xl bg-slate-900 text-white overflow-hidden">
        <div className="bg-emerald-600/20 p-8 border-b border-white/10 flex items-center gap-6">
          <div className="bg-emerald-600 p-4 rounded-3xl shadow-xl">
            <Save className="size-10 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase">ডাটা সেভ ও রিকভারি (Auto-Save)</h2>
            <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mt-1">পিসি বন্ধ হয়ে গেলেও ডাটা হারাবে না</p>
          </div>
        </div>
        <CardContent className="p-8 grid md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <HardDrive className="size-4 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-400 uppercase text-xs tracking-wider">ইন্সট্যান্ট ডিস্ক রাইট (Local Storage)</h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  সফটওয়্যারটি <b>Local-First Architecture</b> ব্যবহার করে। আপনি যখনই কোনো ভাউচার সেভ করেন বা মুনাফা পোস্টিং করেন, সেটি সাথে সাথেই আপনার পিসির হার্ড ড্রাইভের (Browser Storage) মেমোরিতে সেভ হয়ে যায়।
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <ServerCrash className="size-4 text-orange-400" />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-orange-400 uppercase text-xs tracking-wider">বিদ্যুৎ বিভ্রাট সুরক্ষা</h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  হঠাৎ পিসি বন্ধ হয়ে গেলে বা কারেন্ট চলে গেলেও আপনার ডাটা নষ্ট হবে না। পুনরায় সফটওয়্যার চালু করলে আগের সব তথ্য ঠিকভাবেই পাওয়া যাবে।
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
            <h4 className="font-bold text-emerald-500 flex items-center gap-2 uppercase text-xs tracking-widest">
              <ShieldCheck className="size-4" /> ব্যাকআপ নেওয়ার নিয়ম
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed italic">
              "প্রতি সপ্তাহে অন্তত একবার 'Settings' থেকে 'Download Backup' বাটন ব্যবহার করে একটি ডাটা ফাইল পেনড্রাইভে সেভ করে রাখুন। এতে পিসি নষ্ট হয়ে গেলেও অন্য পিসিতে সফটওয়্যারটি আগের ডাটা নিয়ে চালানো যাবে।"
            </p>
            <div className="pt-4 border-t border-white/10">
              <Badge variant="outline" className="text-white border-white/20">Institutional Safety Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-auto pt-10 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-[13px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          <span>Local Distribution Version 1.2</span>
        </div>
        <p className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</p>
      </div>
    </div>
  );
}
