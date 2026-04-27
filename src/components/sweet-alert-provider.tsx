
"use client"

import React, { useState, useCallback, ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SweetAlertContext } from "@/hooks/use-sweet-alert"
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface SweetAlertOptions {
  title: string
  description?: string
  type?: "success" | "error" | "warning" | "info"
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
  showCancel?: boolean
}

export function SweetAlertProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<SweetAlertOptions | null>(null)

  const showAlert = useCallback((opts: SweetAlertOptions) => {
    setOptions(opts)
    setIsOpen(true)
  }, [])

  const hideAlert = useCallback(() => {
    setIsOpen(false)
    if (options?.onCancel) options.onCancel()
  }, [options])

  const handleConfirm = useCallback(() => {
    setIsOpen(false)
    if (options?.onConfirm) options.onConfirm()
  }, [options])

  const getIcon = () => {
    switch (options?.type) {
      case "success":
        return <CheckCircle2 className="size-20 text-emerald-500 animate-in zoom-in duration-300" />
      case "warning":
        return <AlertTriangle className="size-20 text-amber-500 animate-in zoom-in duration-300" />
      case "error":
        return <XCircle className="size-20 text-destructive animate-in zoom-in duration-300" />
      default:
        return <Info className="size-20 text-blue-500 animate-in zoom-in duration-300" />
    }
  }

  return (
    <SweetAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent className="max-w-[450px] text-center flex flex-col items-center gap-6 p-10 rounded-[2rem] border-4 border-black shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] font-ledger">
          <div className="flex justify-center w-full mb-2">
            {getIcon()}
          </div>
          <AlertDialogHeader className="space-y-3 items-center">
            <AlertDialogTitle className="text-3xl font-black tracking-tight text-black uppercase">
              {options?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-base font-bold leading-relaxed">
              {options?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-4 w-full mt-6">
            {options?.showCancel && (
              <AlertDialogCancel 
                onClick={hideAlert}
                className="flex-1 h-14 font-black uppercase tracking-widest rounded-xl border-2 border-black hover:bg-slate-50 text-xs"
              >
                {options?.cancelText || "Cancel"}
              </AlertDialogCancel>
            )}
            <AlertDialogAction 
              onClick={handleConfirm}
              className={cn(
                "flex-1 h-14 font-black uppercase tracking-widest rounded-xl border-none shadow-xl text-xs text-white",
                options?.type === 'success' ? "bg-emerald-600 hover:bg-emerald-700" : 
                options?.type === 'warning' ? "bg-amber-600 hover:bg-amber-700" : 
                options?.type === 'error' ? "bg-rose-600 hover:bg-rose-700" : "bg-black hover:bg-slate-900"
              )}
            >
              {options?.confirmText || "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SweetAlertContext.Provider>
  )
}
