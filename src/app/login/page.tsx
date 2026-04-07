
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
import { ShieldCheck, Loader2, KeyRound, Mail, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useSweetAlert } from "@/hooks/use-sweet-alert"

export default function LoginPage() {
  const auth = useAuth()
  const { user, isUserLoading } = useUser()
  const router = useRouter()
  const { toast } = useToast()
  const { showAlert } = useSweetAlert()

  const [idOrEmail, setIdOrEmail] = useState("")
  const [password, setPassword] = useState("")
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

    // Map "arif" to the specified email if used
    const emailToUse = idOrEmail.toLowerCase() === "arif" 
      ? "arif.ais15@gmail.com" 
      : idOrEmail

    try {
      await signInWithEmailAndPassword(auth, emailToUse, password)
      toast({
        title: "Welcome back!",
        description: "Successfully authenticated to PBS CPF Management.",
      })
      router.push("/")
    } catch (error: any) {
      console.error(error)
      let message = "Invalid credentials. Please check your ID and password."
      if (error.code === 'auth/user-not-found') message = "User not found."
      if (error.code === 'auth/wrong-password') message = "Incorrect password."
      
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
      toast({
        title: "Email Required",
        description: "Please enter your email or 'arif' in the ID field to reset your password.",
        variant: "destructive"
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
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email.",
        variant: "destructive"
      })
    } finally {
      setIsResetting(false)
    }
  }

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-primary p-3 rounded-2xl shadow-lg">
              <ShieldCheck className="size-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-primary">PBS CPF Management</CardTitle>
          <CardDescription>Enter your credentials to access the accounting system</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="idOrEmail">User ID or Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  id="idOrEmail" 
                  placeholder="arif" 
                  className="pl-9"
                  value={idOrEmail}
                  onChange={(e) => setIdOrEmail(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button 
                  type="button" 
                  variant="link" 
                  className="px-0 font-normal h-auto text-xs"
                  onClick={handleForgotPassword}
                  disabled={isResetting}
                >
                  {isResetting ? "Sending..." : "Forgot password?"}
                </Button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••" 
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full h-11 text-base font-bold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Authenticating...
                </>
              ) : "Sign In"}
            </Button>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                Secure Terminal • Authorized Personnel Only
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
