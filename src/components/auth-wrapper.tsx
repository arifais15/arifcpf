"use client"

import { useUser, useAuth, USE_LOCAL_DB } from "@/firebase"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { signOut } from "firebase/auth"

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser()
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [localAuthorized, setLocalAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    // 1. LOCAL AUTH CHECK
    if (USE_LOCAL_DB) {
      const checkLocal = () => {
        const session = localStorage.getItem('pbs_cpf_auth_session');
        setLocalAuthorized(session === 'authorized');
      };

      checkLocal();
      window.addEventListener('storage', checkLocal);
      return () => window.removeEventListener('storage', checkLocal);
    }
  }, []);

  useEffect(() => {
    if (USE_LOCAL_DB) {
      if (localAuthorized === false && pathname !== "/login") {
        router.push("/login");
      }
      return;
    }

    // 2. CLOUD AUTH CHECK
    if (!isUserLoading) {
      if (!user && pathname !== "/login") {
        router.push("/login")
      } else if (user && user.isAnonymous && pathname !== "/login") {
        signOut(auth).then(() => {
          router.push("/login")
        })
      }
    }
  }, [user, isUserLoading, localAuthorized, router, pathname, auth])

  // Loading State
  if (USE_LOCAL_DB) {
    if (localAuthorized === null && pathname !== "/login") {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-white">
          <Loader2 className="size-10 animate-spin text-black" />
        </div>
      );
    }
  } else if (isUserLoading) {
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

  // Final check for local mode
  if (USE_LOCAL_DB && localAuthorized !== true) {
    return null;
  }

  // Final check for cloud mode
  if (!USE_LOCAL_DB && (!user || user.isAnonymous)) {
    return null
  }

  return <>{children}</>
}
