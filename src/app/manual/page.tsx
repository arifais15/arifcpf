
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
  Monitor
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
        "প্রতি পেইজে ৫ জন সদস্যকে দেখা যাবে, যা সিস্টেমের স্পিড বজায় রাখে।",
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
    },
    {
      title: "নিরাপত্তা ও সেটিংস (Security & Settings)",
      icon: ShieldCheck,
      color: "text-rose-600",
      content: [
        "সেটিংস পেজের গুরুত্বপূর্ণ বাটনগুলো ডিফল্টভাবে লক করা থাকে।",
        "লক খোলার কোড: Arif@PBS2। এই কোডটি দিয়ে 'Authorization' বক্সে এন্টার দিলে সব সেটিংস এডিট করা যাবে।",
        "এখান থেকে চার্ট অফ অ্যাকাউন্টস এবং লেজার কলাম ম্যাপিং পরিবর্তন করা সম্ভব।"
      ]
    }
  ];

  return (
    <div className="p-10 flex flex-col gap-10 bg-background min-h-screen font-bangla">
      <div className="flex flex-col gap-2 border-b pb-6">
        <h1 className="text-4xl font-black text-primary tracking-tight">ব্যবহারকারী নির্দেশিকা</h1>
        <p className="text-muted-foreground font-bold uppercase tracking-wider text-sm">পিবিএস সিপিএফ ম্যানেজমেন্ট সফটওয়্যার • ইউজার ম্যানুয়াল</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {sections.map((section, idx) => (
          <Card key={idx} className="border-none shadow-lg bg-white overflow-hidden group hover:shadow-xl transition-all">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center gap-4">
              <div className={`p-3 rounded-2xl bg-white shadow-sm ${section.color}`}>
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

      {/* SCALE & PERFORMANCE SECTION */}
      <Card className="border-none shadow-2xl bg-slate-900 text-white overflow-hidden">
        <div className="bg-primary/20 p-8 border-b border-white/10 flex items-center gap-6">
          <div className="bg-white/10 p-4 rounded-3xl">
            <ServerCrash className="size-10 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black">বড় ডাটা ও পারফরম্যান্স গাইড (Scaling)</h2>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">৮০০+ সদস্য এবং ২০ বছরের ডাটা ম্যানেজমেন্ট</p>
          </div>
        </div>
        <CardContent className="p-8 grid md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Coins className="size-4 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-400 uppercase text-xs tracking-wider">কোটা এবং খরচ (Quotas)</h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  ৮০০ জন কর্মচারীর ২০ বছরের মুনাফা হিসাব করলে প্রায় ২ লক্ষ রেকর্ড রিড হবে। ফায়ারবেস ফ্রি প্ল্যানে প্রতিদিন ৫০,০০০ রিড সম্ভব। বড় ডাটা নিয়ে কাজ করতে <b>Blaze Plan (Pay-as-you-go)</b> ব্যবহার করা বাধ্যতামূলক। এতে প্রতি ১ লক্ষ রিডে খরচ মাত্র ৫-৬ টাকা, যা প্রাতিষ্ঠানিক ক্ষেত্রে নগণ্য।
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <Calculator className="size-4 text-blue-400" />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-blue-400 uppercase text-xs tracking-wider">ওপেনিং ব্যালেন্স কৌশল</h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  পুরো ২০ বছরের ডাটা বারবার রিড না করে, প্রতি বছর মুনাফা পোস্টিং করার পর একটি "Opening Balance" এন্ট্রি দিয়ে রাখুন। এতে পরবর্তী বছর মুনাফা হিসাব করার সময় সিস্টেমকে শুধুমাত্র ১ বছরের ডাটা রিড করতে হবে, যা গতি বহুগুণ বাড়িয়ে দেবে।
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
            <h4 className="font-bold text-primary flex items-center gap-2">
              <ShieldCheck className="size-4" /> ডাটা এন্ট্রি টিপস
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed italic">
              "৮০০ জন কর্মচারীর ২০ বছরের তথ্য ইনপুট দেওয়ার ক্ষেত্রে সরাসরি বাল্ক আপলোড (Excel Upload) ব্যবহার করুন। ছোট ছোট ব্যাচে (যেমন ২০০ জন করে) ডাটা আপলোড করলে সিস্টেমের ওপর চাপ কম পড়বে এবং অডিট ট্রেইল চেক করা সহজ হবে।"
            </p>
            <div className="pt-4 border-t border-white/10">
              <Badge variant="outline" className="text-white border-white/20">Blaze Plan Recommended</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SERVER & FREE USAGE INFO */}
      <div className="grid md:grid-cols-2 gap-8">
        <Card className="border-none shadow-lg bg-blue-600 text-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Globe className="size-6" />
              <CardTitle className="text-lg">ক্লাউড বনাম লোকাল ব্যবহার</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed opacity-90">
              ফায়ারবেস সার্ভার ছাড়া এই সফটওয়্যারটি <b>Firebase Emulator Suite</b> ব্যবহার করে আপনার কম্পিউটারে সম্পূর্ণ ফ্রিতে চালানো সম্ভব। এতে কোনো ডাটা লিমিট বা বিল আসবে না। তবে এই ডাটা শুধুমাত্র আপনার কম্পিউটারেই থাকবে, অফিসের অন্য কেউ দেখতে পারবে না।
            </p>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-white border-white/30 bg-white/10">Local: Free & Private</Badge>
              <Badge variant="outline" className="text-white border-white/30 bg-white/10">Cloud: Multi-User & Secure</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-emerald-600 text-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Monitor className="size-6" />
              <CardTitle className="text-lg">সাশ্রয়ী ব্যবহারের পরামর্শ</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed opacity-90">
              ফায়ারবেসের ফ্রি লিমিট শেষ হয়ে গেলেও <b>Blaze Plan</b>-এ প্রতি ১ লক্ষ ডাটা রিডে খরচ মাত্র কয়েক টাকা। প্রফেশনাল অ্যাকাউন্টিং সফটওয়্যারের ক্ষেত্রে এই খরচ অত্যন্ত নগণ্য। ডাটাবেজ ব্যাকআপ নেওয়ার জন্য মাঝেমধ্যে Excel Export ফিচারটি ব্যবহার করুন।
            </p>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-white border-white/30 bg-white/10">Pay-as-you-go</Badge>
              <Badge variant="outline" className="text-white border-white/30 bg-white/10">Excel Backup</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-dashed bg-slate-50/50">
        <CardContent className="p-8">
          <div className="flex items-start gap-6">
            <div className="bg-primary/10 p-4 rounded-full">
              <Printer className="size-10 text-primary" />
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-primary">প্রিন্টিং ও এক্সপোর্ট টিপস</h3>
              <p className="text-slate-600 leading-relaxed">
                প্রতিটি লেজার এবং রিপোর্ট **A4 Landscape** ওরিয়েন্টেশনে প্রিন্ট করার জন্য অপ্টিমাইজ করা হয়েছে। 
                ব্রাউজারের প্রিন্ট ডায়ালগ বক্স থেকে 'Margins' অপশনটি 'None' বা 'Minimum' সেট করলে কলামগুলো সুন্দরভাবে ফিট হবে। 
                এছাড়া সকল রিপোর্ট এক্সেল (Excel) ফাইলে ডাউনলোড করা যায় যা অডিট কাজে সহায়ক।
              </p>
              <div className="flex gap-3">
                <Badge variant="outline" className="bg-white border-primary/20">Landscape Mode</Badge>
                <Badge variant="outline" className="bg-white border-primary/20">A4 Paper</Badge>
                <Badge variant="outline" className="bg-white border-primary/20">Excel Sync</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-auto pt-10 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-[13px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          <span>Institutional Version 1.0</span>
        </div>
        <p className="italic">Developed by: Ariful Islam, AGMF, Gazipur PBS-2</p>
      </div>
    </div>
  );
}
