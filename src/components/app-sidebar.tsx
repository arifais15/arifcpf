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
  useSidebar,
} from "@/components/ui/sidebar"
import { useSweetAlert } from "@/hooks/use-sweet-alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { title: "Dashboard Summary", icon: LayoutDashboard, url: "/", iconColor: "text-blue-400" },
  { title: "Transaction Ledger", icon: ListTodo, url: "/transactions", iconColor: "text-emerald-400" },
  { title: "Post New Voucher", icon: PlusCircle, url: "/transactions/new", iconColor: "text-sky-400" },
  { title: "GL Control Ledger", icon: BookText, url: "/reports/control-ledger", iconColor: "text-indigo-400" },
  { title: "Subsidiary Control", icon: LayoutList, url: "/reports/subsidiary-control", iconColor: "text-violet-400" },
  { title: "Trial Balance Matrix", icon: Scale, url: "/reports/trial-balance", iconColor: "text-slate-300" },
  { title: "Personnel Registry", icon: Users, url: "/members", iconColor: "text-cyan-400" },
  { title: "Ledger Matrix", icon: ClipboardCheck, url: "/reports/ledger-summary", iconColor: "text-teal-400" },
  { title: "Active Portfolio", icon: TrendingUp, url: "/investments", iconColor: "text-blue-500" },
  { title: "Member Interest", icon: Percent, url: "/investments/member-interest", iconColor: "text-orange-400" },
  { title: "Special Yield (DP)", icon: Calculator, url: "/investments/special-interest", iconColor: "text-amber-400" },
  { title: "Movement Audit", icon: Activity, url: "/investments/movements", iconColor: "text-slate-400" },
  { title: "Interest Movements", icon: Coins, url: "/reports/interest-movements", iconColor: "text-emerald-500" },
  { title: "Financial Terminal", icon: FileText, url: "/reports", iconColor: "text-slate-300" },
  { title: "Ledger Batch Print", icon: Printer, url: "/reports/all-ledgers", iconColor: "text-purple-400" },
  { title: "Loan Registry", icon: HandCoins, url: "/reports/loans", iconColor: "text-rose-400" },
  { title: "Settlement Log", icon: UserX, url: "/reports/settlements", iconColor: "text-red-400" },
  { title: "Audit Tracking", icon: PieChart, url: "/reports/contributions", iconColor: "text-pink-400" },
  { title: "User Manual", icon: HelpCircle, url: "/manual", iconColor: "text-slate-400" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const router = useRouter()
  const { showAlert } = useSweetAlert()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLogout = () => {
    showAlert({
      title: "Logout Confirmation",
      description: "Terminate current authorized session?",
      type: "warning",
      showCancel: true,
      confirmText: "Logout",
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
            <span className="font-black text-white text-base tracking-tighter uppercase">PBS CPF System</span>
            <span className="text-[9px] text-white/40 uppercase font-black tracking-widest">Institutional Mode</span>
          </div>
          {isMobile && (
            <Button variant="ghost" size="icon" className="size-8 ml-auto text-white" onClick={() => setOpenMobile(false)}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>
      <SidebarSeparator className="bg-white/5 mx-4" />
      <SidebarContent className="px-3 py-4">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.url}
                tooltip={item.title}
                className={cn(
                  "h-10 px-4 transition-all duration-200 rounded-lg group",
                  pathname === item.url 
                    ? "bg-white/10 text-white font-black" 
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <Link href={item.url}>
                  <item.icon className={cn("size-4 shrink-0 transition-colors", item.iconColor, pathname === item.url ? "opacity-100" : "opacity-40 group-hover:opacity-100")} />
                  <span className="text-[12px] font-bold uppercase tracking-tight">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 bg-black/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-10 text-white/50 hover:bg-white/5 hover:text-white rounded-lg">
              <Link href="/settings">
                <Settings className="size-4 opacity-50" />
                <span className="font-bold text-[12px] uppercase tracking-tight">Configuration</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-10 text-rose-400 hover:bg-rose-500/10 rounded-lg" onClick={handleLogout}>
              <LogOut className="size-4" />
              <span className="font-bold text-[12px] uppercase tracking-tight">Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}