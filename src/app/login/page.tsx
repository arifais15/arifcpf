
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth"
import { useAuth, useUser } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/card"
import { ShieldCheck, Loader2, KeyRound, User, AlertCircle, UserPlus, LogIn } from "lucide-react"
import { useSweetAlert } from "@/hooks/use-sweet-alert"

export default function LoginPage() {
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const router = useRouter()
  const { showAlert } = useSweetAlert()

  const [mode, setMode] = useState<"login" | "signup">("login")
  const [name, setName] = useState("")
  const [idOrEmail, setIdOrEmail] = useState("arif")
  const [password, setPassword] = useState("123123")
  const [confirmPassword, setConfirmPassword] = useState("123123")
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isUserLoading) {
      router.push("/")
    }
  }, [user, isUserLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const emailToUse = idOrEmail.toLowerCase() === "arif" 
      ? "arif.ais15@gmail.com" 
      : idOrEmail

    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          showAlert({
            title: "Password Mismatch",
            description: "The confirmation password does not match.",
            type: "warning"
          })
          setIsLoading(false)
          return
        }
        if (password.length < 6) {
          showAlert({
            title: "Weak Password",
            description: "Security policy requires at least 6 characters.",
            type: "warning"
          })
          setIsLoading(false)
          return
        }

        const userCredential = await createUserWithEmailAndPassword(auth, emailToUse, password)
        if (name) {
          await updateProfile(userCredential.user, { displayName: name })
        }
        
        showAlert({
          title: "Account Created",
          description: `User ${emailToUse} has been registered successfully. You are now logged in.`,
          type: "success"
        })
      } else {
        await signInWithEmailAndPassword(auth, emailToUse, password)
        showAlert({
          title: "Welcome Back",
          description: `Successfully signed in as ${idOrEmail}.`,
          type: "success"
        })
      }
      router.push("/")
    } catch (error: any) {
      console.warn("Authentication failed:", error.code)
      
      let title = "Access Denied"
      let message = "Invalid credentials. Please check your entry."
      
      if (error.code === 'auth/email-already-in-use') {
        title = "Email Exists"
        message = "This email is already registered. Please sign in instead."
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        title = "Authentication Failed"
        message = "Incorrect password or user does not exist. If you haven't created an account yet, please switch to 'Sign Up' mode first."
      } else if (error.code === 'auth/weak-password') {
        title = "Weak Password"
        message = "Password must be at least 6 characters long."
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
    const email = idOrEmail.toLowerCase() === "arif" ? "arif.ais15@gmail.com" : idOrEmail
    
    if (!email || !email.includes("@")) {
      showAlert({
        title: "Email Required",
        description: "Please enter your email address to reset your password.",
        type: "info"
      })
      return
    }

    setIsResetting(true)
    try {
      await sendPasswordResetEmail(auth, email)
      showAlert({
        title: "Reset Link Sent",
        description: `A password reset link has been sent to ${email}.`,
        type: "success"
      })
    } catch (error: any) {
      showAlert({
        title: "Reset Failed",
        description: "Failed to send reset email. Ensure the email is registered.",
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
          <CardDescription>
            {mode === "login" ? "Authorized Personnel Only • Secure Terminal" : "Register New Administrator Profile"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    id="name" 
                    placeholder="Enter full name" 
                    className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={mode === "signup"}
                  />
                </div>
              </div>
            )}
            
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
                {mode === "login" && (
                  <Button 
                    type="button" 
                    variant="link" 
                    className="px-0 font-bold h-auto text-[10px] uppercase text-primary"
                    onClick={handleForgotPassword}
                    disabled={isResetting}
                  >
                    {isResetting ? "Processing..." : "Reset Password"}
                  </Button>
                )}
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

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirm Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={mode === "signup"}
                  />
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex gap-2">
              <AlertCircle className="size-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] text-blue-800 leading-tight font-bold uppercase">First Time User?</p>
                <p className="text-[9px] text-blue-800 leading-tight">
                  If you haven't created an account yet, please click <b>"Need an account? Sign Up"</b> below first.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-8">
            <Button type="submit" className="w-full h-12 text-sm font-bold uppercase tracking-widest" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {mode === "login" ? "Verifying..." : "Creating Account..."}
                </>
              ) : (
                <>
                  {mode === "login" ? <LogIn className="mr-2 size-4" /> : <UserPlus className="mr-2 size-4" />}
                  {mode === "login" ? "Sign In to System" : "Create Account"}
                </>
              )}
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full text-xs text-primary font-bold uppercase border-primary/20 hover:bg-primary/5"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Need an account? Sign Up" : "Already have an account? Sign In"}
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
