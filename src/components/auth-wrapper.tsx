
"use client"

import { useUser } from "@/firebase"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isUserLoading && !user && pathname !== "/login") {
      router.push("/login")
    }
  }, [user, isUserLoading, router, pathname])

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Synchronizing Security Session...</p>
        </div>
      </div>
    )
  }

  // If on login page, just show it
  if (pathname === "/login") {
    return <>{children}</>
  }

  // If not logged in, show nothing while redirecting
  if (!user) {
    return null
  }

  return <>{children}</>
}
