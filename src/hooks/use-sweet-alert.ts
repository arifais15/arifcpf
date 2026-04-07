
"use client"

import { create } from "zustand" // We'll use a simple state pattern if we can't add packages, but since we can, we could. However, to keep it lean, let's use a custom event-based state or a simple context.

import { useState, useCallback, createContext, useContext } from "react"

type AlertType = "success" | "error" | "warning" | "info"

interface SweetAlertOptions {
  title: string
  description?: string
  type?: AlertType
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
  showCancel?: boolean
}

interface SweetAlertContextType {
  showAlert: (options: SweetAlertOptions) => void
  hideAlert: () => void
}

export const SweetAlertContext = createContext<SweetAlertContextType | undefined>(undefined)

export function useSweetAlert() {
  const context = useContext(SweetAlertContext)
  if (!context) {
    throw new Error("useSweetAlert must be used within a SweetAlertProvider")
  }
  return context
}
