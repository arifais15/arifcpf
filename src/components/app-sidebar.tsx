
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
  Search,
  ListTodo,
  Percent
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/" },
  { title: "Chart of Accounts", icon: BookOpen, url: "/coa" },
  { title: "Journal Entries", icon: ListTodo, url: "/transactions" },
  { title: "New Transaction", icon: PlusCircle, url: "/transactions/new" },
  { title: "Members", icon: Users, url: "/members" },
  { title: "Interest Accrual", icon: Percent, url: "/interest" },
  { title: "Investments", icon: TrendingUp, url: "/investments" },
  { title: "Financial Reports", icon: FileText, url: "/reports" },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4 flex items-center gap-3">
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
          <span className="font-semibold text-primary">PBS CPF</span>
          <span className="text-xs text-muted-foreground">Compass</span>
        </div>
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
            <SidebarMenuButton className="hover:bg-sidebar-accent">
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
