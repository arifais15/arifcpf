
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
        return <CheckCircle2 className="size-16 text-emerald-500 animate-in zoom-in duration-300" />
      case "warning":
        return <AlertTriangle className="size-16 text-amber-500 animate-in zoom-in duration-300" />
      case "error":
        return <XCircle className="size-16 text-destructive animate-in zoom-in duration-300" />
      default:
        return <Info className="size-16 text-blue-500 animate-in zoom-in duration-300" />
    }
  }

  return (
    <SweetAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent className="max-w-[400px] text-center flex flex-col items-center gap-6 p-8 rounded-2xl">
          <div className="flex justify-center w-full">
            {getIcon()}
          </div>
          <AlertDialogHeader className="space-y-2 items-center">
            <AlertDialogTitle className="text-2xl font-bold tracking-tight">
              {options?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm">
              {options?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2 w-full mt-2">
            {options?.showCancel && (
              <AlertDialogCancel 
                onClick={hideAlert}
                className="flex-1 h-11 font-semibold rounded-xl"
              >
                {options?.cancelText || "Cancel"}
              </AlertDialogCancel>
            )}
            <AlertDialogAction 
              onClick={handleConfirm}
              className={cn(
                "flex-1 h-11 font-semibold rounded-xl",
                options?.type === 'success' ? "bg-emerald-600 hover:bg-emerald-700" : 
                options?.type === 'warning' ? "bg-amber-600 hover:bg-amber-700" : ""
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
