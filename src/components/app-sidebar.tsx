
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
  HandCoins as CoinsIcon
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { useAuth } from "@/firebase"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { useSweetAlert } from "@/hooks/use-sweet-alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { title: "ড্যাশবোর্ড", icon: LayoutDashboard, url: "/", hoverBg: "hover:bg-blue-100", iconColor: "text-blue-600" },
  { title: "জাবেদা এন্ট্রি", icon: ListTodo, url: "/transactions", hoverBg: "hover:bg-emerald-100", iconColor: "text-emerald-600" },
  { title: "নতুন লেনদেন", icon: PlusCircle, url: "/transactions/new", hoverBg: "hover:bg-sky-100", iconColor: "text-sky-600" },
  { title: "কন্ট্রোল লেজার", icon: BookText, url: "/reports/control-ledger", hoverBg: "hover:bg-indigo-100", iconColor: "text-indigo-600" },
  { title: "সাবসিডিয়ারি কন্ট্রোল", icon: LayoutList, url: "/reports/subsidiary-control", hoverBg: "hover:bg-violet-100", iconColor: "text-violet-600" },
  { title: "সদস্য তালিকা", icon: Users, url: "/members", hoverBg: "hover:bg-cyan-100", iconColor: "text-cyan-600" },
  { title: "লেজার সারসংক্ষেপ", icon: ClipboardCheck, url: "/reports/ledger-summary", hoverBg: "hover:bg-teal-100", iconColor: "text-teal-600" },
  { title: "মুনাফা হিসাব", icon: Percent, url: "/interest", hoverBg: "hover:bg-orange-100", iconColor: "text-orange-600" },
  { title: "বিশেষ মুনাফা (DP)", icon: Calculator, url: "/interest/special", hoverBg: "hover:bg-amber-100", iconColor: "text-amber-600" },
  { title: "বিনিয়োগ", icon: TrendingUp, url: "/investments", hoverBg: "hover:bg-blue-200", iconColor: "text-blue-700" },
  { title: "মুনাফা প্রভিশন", icon: CoinsIcon, url: "/investments/provisions", hoverBg: "hover:bg-indigo-200", iconColor: "text-indigo-700" },
  { title: "আর্থিক প্রতিবেদন", icon: FileText, url: "/reports", hoverBg: "hover:bg-slate-200", iconColor: "text-slate-700" },
  { title: "লেজার ব্যাচ প্রিন্ট", icon: Printer, url: "/reports/all-ledgers", hoverBg: "hover:bg-purple-100", iconColor: "text-purple-600" },
  { title: "ঋণ প্রতিবেদন", icon: HandCoins, url: "/reports/loans", hoverBg: "hover:bg-rose-100", iconColor: "text-rose-600" },
  { title: "নিষ্পত্তি প্রতিবেদন", icon: UserX, url: "/reports/settlements", hoverBg: "hover:bg-red-100", iconColor: "text-red-600" },
  { title: "অডিট ও ট্র্যাকিং", icon: PieChart, url: "/reports/contributions", hoverBg: "hover:bg-pink-100", iconColor: "text-pink-600" },
  { title: "ব্যবহারকারী নির্দেশিকা", icon: HelpCircle, url: "/manual", hoverBg: "hover:bg-slate-100", iconColor: "text-slate-500" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const router = useRouter()
  const { showAlert } = useSweetAlert()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLogout = () => {
    showAlert({
      title: "লগআউট নিশ্চিত করুন",
      description: "আপনি কি আপনার সেশন শেষ করতে চান?",
      type: "warning",
      showCancel: true,
      confirmText: "লগআউট",
      cancelText: "বাতিল",
      onConfirm: async () => {
        await signOut(auth)
        router.push("/login")
      }
    })
  }

  return (
    <Sidebar variant="inset" collapsible="icon" className="font-bangla">
      <SidebarHeader className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-primary">পিবিএস সিপিএফ</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">ম্যানেজমেন্ট</span>
          </div>
        </div>
        {isMobile && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="size-8 md:hidden" 
            onClick={() => setOpenMobile(false)}
          >
            <X className="size-4 text-muted-foreground" />
          </Button>
        )}
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarMenu className="px-2">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.url}
                tooltip={item.title}
                className={cn(
                  "transition-all duration-200 text-sky-950 h-10",
                  item.hoverBg,
                  pathname === item.url && "bg-slate-100 font-extrabold"
                )}
              >
                <Link href={item.url}>
                  <item.icon className={cn("size-4 shrink-0", item.iconColor)} />
                  <span className="font-bold text-[15px]">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              isActive={pathname === "/settings"} 
              className="hover:bg-slate-100 text-sky-950 h-10"
            >
              <Link href="/settings">
                <Settings className="size-4 shrink-0 text-slate-500" />
                <span className="font-bold text-[15px]">সেটিংস</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="hover:bg-destructive/10 hover:text-destructive text-rose-600 h-10"
              onClick={handleLogout}
            >
              <LogOut className="size-4 shrink-0" />
              <span className="font-bold text-[15px]">লগআউট</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
