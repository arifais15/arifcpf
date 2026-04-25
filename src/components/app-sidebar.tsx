"use client"

import * as React from "react"
import {
  LayoutDashboard,
  PlusCircle,
  Users,
  TrendingUp,
  FileText,
  Settings,
  ShieldCheck,
  Percent,
  LogOut,
  ListTodo,
  X,
  UserX,
  PieChart,
  HandCoins,
  ClipboardCheck,
  BookText,
  LayoutList,
  Calculator,
  Printer,
  HelpCircle,
  Activity,
  Scale,
  Coins
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { useAuth, USE_LOCAL_DB } from "@/firebase"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar"
import { useSweetAlert } from "@/hooks/use-sweet-alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigationGroups = [
  {
    label: "মূল মেনু",
    items: [
      { title: "ড্যাশবোর্ড", icon: LayoutDashboard, url: "/", iconColor: "text-blue-400" },
      { title: "জাবেদা বই", icon: ListTodo, url: "/transactions", iconColor: "text-emerald-400" },
      { title: "নতুন ভাউচার এন্ট্রি", icon: PlusCircle, url: "/transactions/new", iconColor: "text-sky-400" },
    ]
  },
  {
    label: "সদস্য লেজার",
    items: [
      { title: "সাবসিডিয়ারি লেজার", icon: Users, url: "/members", iconColor: "text-cyan-400" },
      { title: "লেজার সামারি", icon: ClipboardCheck, url: "/reports/ledger-summary", iconColor: "text-teal-400" },
      { title: "ঋণ রেজিস্টার", icon: HandCoins, url: "/reports/loans", iconColor: "text-rose-400" },
      { title: "ব্যাচ লেজার প্রিন্ট", icon: Printer, url: "/reports/all-ledgers", iconColor: "text-purple-400" },
      { title: "বার্ষিক মুনাফা", icon: Percent, url: "/investments/member-interest", iconColor: "text-orange-400" },
      { title: "বিশেষ মুনাফা (DP)", icon: Calculator, url: "/investments/special-interest", iconColor: "text-amber-400" },
      { title: "কন্ট্রোল লেজার", icon: LayoutList, url: "/reports/subsidiary-control", iconColor: "text-violet-400" },
      { title: "ফান্ডের মুভমেন্ট", icon: Activity, url: "/investments/movements", iconColor: "text-slate-400" },
      { title: "মুনাফার মুভমেন্ট", icon: Coins, iconColor: "text-emerald-500", url: "/reports/interest-movements" },
      { title: "নিষ্পত্তি লগ", icon: UserX, url: "/reports/settlements", iconColor: "text-red-400" },
    ]
  },
  {
    label: "বিনিয়োগ ব্যবস্থাপনা",
    items: [
      { title: "বিনিয়োগ পোর্টফোলিও", icon: TrendingUp, url: "/investments", iconColor: "text-blue-500" },
    ]
  },
  {
    label: "আর্থিক প্রতিবেদন",
    items: [
      { title: "আর্থিক প্রতিবেদন", icon: FileText, url: "/reports", iconColor: "text-slate-300" },
      { title: "রেওয়ামিল", icon: Scale, url: "/reports/trial-balance", iconColor: "text-slate-300" },
      { title: "সাধারণ খতিয়ান", icon: BookText, url: "/reports/control-ledger", iconColor: "text-indigo-400" },
      { title: "অডিট ট্র্যাকিং", icon: PieChart, url: "/reports/contributions", iconColor: "text-pink-400" },
    ]
  }
]

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const router = useRouter()
  const { showAlert } = useSweetAlert()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLogout = () => {
    showAlert({
      title: "লগআউট নিশ্চিতকরণ",
      description: "আপনি কি বর্তমান সেশনটি বন্ধ করতে চান?",
      type: "warning",
      showCancel: true,
      confirmText: "লগআউট",
      cancelText: "বাতিল",
      onConfirm: async () => {
        if (USE_LOCAL_DB) {
          localStorage.removeItem('pbs_cpf_auth_session');
          window.dispatchEvent(new Event('storage'));
          router.push("/login");
        } else {
          await signOut(auth);
          router.push("/login");
        }
      }
    })
  }

  return (
    <Sidebar variant="inset" collapsible="icon" className="border-r-0 bg-sidebar">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-primary text-white shadow-lg">
            <ShieldCheck className="size-6" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-black text-white text-base tracking-tighter uppercase">সিপিএ ম্যানেজমেন্ট</span>
            <span className="text-[9px] text-white/40 uppercase font-black tracking-widest">অটোমেশন@আরিফ</span>
          </div>
          {isMobile && (
            <Button variant="ghost" size="icon" className="size-8 ml-auto text-white" onClick={() => setOpenMobile(false)}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>
      <SidebarSeparator className="bg-white/5 mx-4" />
      <SidebarContent className="px-3 py-4 space-y-4">
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-4 mb-2">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      tooltip={item.title}
                      className={cn(
                        "h-9 px-4 transition-all duration-200 rounded-lg group",
                        pathname === item.url 
                          ? "bg-white/10 text-white font-black" 
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <Link href={item.url}>
                        <item.icon className={cn("size-4 shrink-0 transition-colors", item.iconColor, pathname === item.url ? "opacity-100" : "opacity-40 group-hover:opacity-100")} />
                        <span className="text-[13px] font-bold tracking-tight">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-4 mb-2">সহায়তা</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/manual"}
                  tooltip="ব্যবহারকারী নির্দেশিকা"
                  className={cn(
                    "h-9 px-4 transition-all duration-200 rounded-lg group",
                    pathname === "/manual" 
                      ? "bg-white/10 text-white font-black" 
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Link href="/manual">
                    <HelpCircle className="size-4 shrink-0 opacity-40 text-slate-400 group-hover:opacity-100" />
                    <span className="text-[13px] font-bold tracking-tight">নির্দেশিকা</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 bg-black/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-10 text-white/50 hover:bg-white/5 hover:text-white rounded-lg">
              <Link href="/settings">
                <Settings className="size-4 opacity-50" />
                <span className="font-bold text-[14px] tracking-tight">সেটিংস</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-10 text-rose-400 hover:bg-rose-500/10 rounded-lg" onClick={handleLogout}>
              <LogOut className="size-4" />
              <span className="font-bold text-[14px] tracking-tight">লগআউট</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
