"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail
} from "firebase/auth"
import { useAuth, useUser, USE_LOCAL_DB } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Loader2, KeyRound, User, LogIn } from "lucide-react"
import { useSweetAlert } from "@/hooks/use-sweet-alert"

export default function LoginPage() {
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const router = useRouter()
  const { showAlert } = useSweetAlert()

  const [idOrEmail, setIdOrEmail] = useState("arif")
  const [password, setPassword] = useState("123123")
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Check for existing local session on mount
  useEffect(() => {
    if (USE_LOCAL_DB) {
      const localSession = localStorage.getItem('pbs_cpf_auth_session');
      if (localSession === 'authorized') {
        router.push("/");
      }
    } else if (user && !isUserLoading) {
      router.push("/");
    }
  }, [user, isUserLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // LOCAL AUTH LOGIC FOR PORTABLE DISTRIBUTION
    if (USE_LOCAL_DB) {
      setTimeout(() => {
        if (idOrEmail.toLowerCase() === "arif" && password === "123123") {
          localStorage.setItem('pbs_cpf_auth_session', 'authorized');
          localStorage.setItem('pbs_cpf_user_data', JSON.stringify({ uid: 'admin-local', email: 'arif.ais15@gmail.com', displayName: 'Ariful Islam' }));
          
          showAlert({
            title: "Access Granted",
            description: "Institutional Local Mode Active. Session synchronized.",
            type: "success"
          });
          router.push("/");
          window.dispatchEvent(new Event('storage')); // Trigger auth check
        } else {
          showAlert({
            title: "Access Denied",
            description: "Incorrect password or user does not exist in local registry.",
            type: "error"
          });
          setIsLoading(false);
        }
      }, 800);
      return;
    }

    // CLOUD AUTH LOGIC
    const emailToUse = idOrEmail.toLowerCase() === "arif" 
      ? "arif.ais15@gmail.com" 
      : idOrEmail

    try {
      await signInWithEmailAndPassword(auth, emailToUse, password)
      showAlert({
        title: "Welcome Back",
        description: `Successfully signed in as ${idOrEmail}.`,
        type: "success"
      })
      router.push("/")
    } catch (error: any) {
      let title = "Access Denied"
      let message = "Invalid credentials. Please check your entry."
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        title = "Authentication Failed"
        message = "Incorrect password or user does not exist. Please contact the administrator for access."
      }

      showAlert({
        title: title,
        description: message,
        type: "error"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (USE_LOCAL_DB) {
      showAlert({
        title: "Local Mode",
        description: "Password reset is handled via System Settings in Local Mode.",
        type: "info"
      });
      return;
    }

    const email = idOrEmail.toLowerCase() === "arif" ? "arif.ais15@gmail.com" : idOrEmail
    if (!email || !email.includes("@")) {
      showAlert({ title: "Email Required", description: "Enter email address to reset.", type: "info" });
      return;
    }

    setIsResetting(true)
    try {
      await sendPasswordResetEmail(auth, email)
      showAlert({ title: "Reset Link Sent", description: `Sent to ${email}.`, type: "success" });
    } catch (error: any) {
      showAlert({ title: "Reset Failed", type: "error" });
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 font-ledger">
      <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden">
        <div className="h-2 bg-black" />
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-black/5 p-4 rounded-3xl">
              <ShieldCheck className="size-10 text-black" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black tracking-tight text-black uppercase">PBS CPF System</CardTitle>
          <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-slate-400">
            Institutional Local Access Matrix
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="idOrEmail" className="text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">User Identification</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                <Input 
                  id="idOrEmail" 
                  placeholder="Enter arif" 
                  className="pl-10 h-11 bg-white border-2 border-slate-100 font-black"
                  value={idOrEmail}
                  onChange={(e) => setIdOrEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">Security Pin</Label>
                <Button 
                  type="button" 
                  variant="link" 
                  className="px-0 font-black h-auto text-[9px] uppercase text-slate-400"
                  onClick={handleForgotPassword}
                  disabled={isResetting}
                >
                  {isResetting ? "Processing..." : "Recovery"}
                </Button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-10 h-11 bg-white border-2 border-slate-100 font-black"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-10">
            <Button type="submit" className="w-full h-14 text-xs font-black uppercase tracking-[0.3em] bg-black text-white shadow-xl hover:bg-slate-900" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 size-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="mr-3 size-5" />
                  Enter System
                </>
              )}
            </Button>
            
            <div className="text-center pt-2">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest font-black italic">
                Developed by: Ariful Islam, AGMF, Gazipur PBS-2
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
