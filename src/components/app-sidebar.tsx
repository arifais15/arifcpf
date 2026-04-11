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
  { title: "ড্যাশবোর্ড", icon: LayoutDashboard, url: "/" },
  { title: "জাবেদা এন্ট্রি", icon: ListTodo, url: "/transactions" },
  { title: "নতুন লেনদেন", icon: PlusCircle, url: "/transactions/new" },
  { title: "কন্ট্রোল লেজার", icon: BookText, url: "/reports/control-ledger" },
  { title: "সাবসিডিয়ারি কন্ট্রোল", icon: LayoutList, url: "/reports/subsidiary-control" },
  { title: "সদস্য তালিকা", icon: Users, url: "/members" },
  { title: "লেজার সারসংক্ষেপ", icon: ClipboardCheck, url: "/reports/ledger-summary" },
  { title: "মুনাফা হিসাব", icon: Percent, url: "/interest" },
  { title: "বিশেষ মুনাফা (DP)", icon: Calculator, url: "/interest/special" },
  { title: "বিনিয়োগ", icon: TrendingUp, url: "/investments" },
  { title: "আর্থিক প্রতিবেদন", icon: FileText, url: "/reports" },
  { title: "ঋণ প্রতিবেদন", icon: HandCoins, url: "/reports/loans" },
  { title: "নিষ্পত্তি প্রতিবেদন", icon: UserX, url: "/reports/settlements" },
  { title: "অডিট ও ট্র্যাকিং", icon: PieChart, url: "/reports/contributions" },
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
                className="hover:bg-sidebar-accent"
              >
                <Link href={item.url}>
                  <item.icon className="size-4" />
                  <span className="font-medium">{item.title}</span>
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
                <span className="font-medium">সেটিংস</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              <span className="font-medium">লগআউট</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
