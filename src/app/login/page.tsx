
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth"
import { useAuth, useUser } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Loader2, KeyRound, Mail, User, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useSweetAlert } from "@/hooks/use-sweet-alert"

export default function LoginPage() {
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const router = useRouter()
  const { toast } = useToast()
  const { showAlert } = useSweetAlert()

  // Set default credentials as requested
  const [idOrEmail, setIdOrEmail] = useState("arif")
  const [password, setPassword] = useState("123123")
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isUserLoading) {
      router.push("/")
    }
  }, [user, isUserLoading, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Map "arif" to the specified email
    const emailToUse = idOrEmail.toLowerCase() === "arif" 
      ? "arif.ais15@gmail.com" 
      : idOrEmail

    try {
      // Firebase requires 6+ characters for passwords.
      await signInWithEmailAndPassword(auth, emailToUse, password)
      
      showAlert({
        title: "Welcome Back",
        description: `Successfully signed in as ${idOrEmail}.`,
        type: "success"
      })
      router.push("/")
    } catch (error: any) {
      // Log for developer context but catch so it doesn't crash the UI
      console.warn("Authentication failed:", error.code)
      
      let message = "Invalid credentials. Please check your ID and password."
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-password' || error.code === 'auth/wrong-password') {
        message = "Authentication failed. Note: Firebase passwords must be at least 6 characters. Please ensure your account was created with the password '123123' in the console."
      } else if (error.code === 'auth/user-not-found') {
        message = "No account found with this ID/Email."
      } else if (error.code === 'auth/too-many-requests') {
        message = "Too many failed attempts. Please try again later."
      }

      showAlert({
        title: "Login Failed",
        description: message,
        type: "error"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const email = idOrEmail.toLowerCase() === "arif" ? "arif.ais15@gmail.com" : idOrEmail
    
    if (!email || !email.includes("@")) {
      showAlert({
        title: "Email Required",
        description: "Please enter your email address or 'arif' in the ID field to reset your password.",
        type: "info"
      })
      return
    }

    setIsResetting(true)
    try {
      await sendPasswordResetEmail(auth, email)
      showAlert({
        title: "Reset Link Sent",
        description: `A password reset link has been sent to ${email}. Please check your inbox.`,
        type: "success"
      })
    } catch (error: any) {
      showAlert({
        title: "Reset Failed",
        description: error.message || "Failed to send reset email. Ensure the email is registered.",
        type: "error"
      })
    } finally {
      setIsResetting(false)
    }
  }

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 font-ledger">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Verifying Session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 font-ledger">
      <Card className="w-full max-w-md border-none shadow-2xl overflow-hidden">
        <div className="h-2 bg-primary" />
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-4 rounded-3xl">
              <ShieldCheck className="size-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-primary uppercase">PBS CPF Management</CardTitle>
          <CardDescription>Authorized Personnel Only • Secure Terminal</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="idOrEmail" className="text-xs font-bold uppercase tracking-wider text-slate-500">User ID or Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  id="idOrEmail" 
                  placeholder="Enter arif or email" 
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white"
                  value={idOrEmail}
                  onChange={(e) => setIdOrEmail(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</Label>
                <Button 
                  type="button" 
                  variant="link" 
                  className="px-0 font-bold h-auto text-[10px] uppercase text-primary"
                  onClick={handleForgotPassword}
                  disabled={isResetting}
                >
                  {isResetting ? "Processing..." : "Reset Password"}
                </Button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex gap-2">
              <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] text-amber-800 leading-tight font-bold">
                  System Requirement:
                </p>
                <p className="text-[9px] text-amber-800 leading-tight italic">
                  Default credentials are set to ID <b>'arif'</b> and Password <b>'123123'</b>. Please ensure this user is created in the Firebase console with email 'arif.ais15@gmail.com'.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-8">
            <Button type="submit" className="w-full h-12 text-sm font-bold uppercase tracking-widest" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Verifying...
                </>
              ) : "Sign In to System"}
            </Button>
            <div className="text-center pt-2">
              <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-50">
                Gazipur Palli Bidyut Samity-2
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
