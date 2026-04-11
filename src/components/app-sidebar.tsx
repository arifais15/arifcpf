
"use client"

import * as React from "react"
import {
  LayoutDashboard,
  BookOpen,
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
  FileStack,
  Activity,
  ClipboardCheck,
  BookText,
  LayoutList,
  Calculator
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

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/" },
  { title: "Chart of Accounts", icon: BookOpen, url: "/coa" },
  { title: "Journal Entries", icon: ListTodo, url: "/transactions" },
  { title: "New Transaction", icon: PlusCircle, url: "/transactions/new" },
  { title: "Control Ledger", icon: BookText, url: "/reports/control-ledger" },
  { title: "Subsidiary Control", icon: LayoutList, url: "/reports/subsidiary-control" },
  { title: "Members", icon: Users, url: "/members" },
  { title: "Ledger Summary", icon: ClipboardCheck, url: "/reports/ledger-summary" },
  { title: "Netfund Statement", icon: FileStack, url: "/reports/netfund" },
  { title: "Fund Movement", icon: Activity, url: "/reports/movements" },
  { title: "Interest Accrual", icon: Percent, url: "/interest" },
  { title: "Special Interest (DP)", icon: Calculator, url: "/interest/special" },
  { title: "Investments", icon: TrendingUp, url: "/investments" },
  { title: "Financial Reports", icon: FileText, url: "/reports" },
  { title: "Loan Report", icon: HandCoins, url: "/reports/loans" },
  { title: "Settlement Report", icon: UserX, url: "/reports/settlements" },
  { title: "Audit & Tracking", icon: PieChart, url: "/reports/contributions" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const auth = useAuth()
  const router = useRouter()
  const { showAlert } = useSweetAlert()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLogout = () => {
    showAlert({
      title: "Confirm Logout",
      description: "Are you sure you want to end your session?",
      type: "warning",
      showCancel: true,
      confirmText: "Logout",
      onConfirm: async () => {
        await signOut(auth)
        router.push("/login")
      }
    })
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-primary">PBS CPF</span>
            <span className="text-xs text-muted-foreground">Management</span>
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
                className="hover:bg-sidebar-accent"
              >
                <Link href={item.url}>
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/settings"} className="hover:bg-sidebar-accent">
              <Link href="/settings">
                <Settings className="size-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
