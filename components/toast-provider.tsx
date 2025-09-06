"use client"

import React from "react"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"

interface ToastContextType {
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showWarning: (message: string) => void
  showInfo: (message: string) => void
  showApiWarning: (message: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const showSuccess = React.useCallback((message: string) => {
    toast.success(message)
  }, [])

  const showError = React.useCallback((message: string) => {
    toast.error(message)
  }, [])

  const showWarning = React.useCallback((message: string) => {
    toast.warning(message)
  }, [])

  const showInfo = React.useCallback((message: string) => {
    toast.info(message)
  }, [])

  const showApiWarning = React.useCallback((message: string) => {
    toast.warning(message, {
      duration: 5000,
      description: "API 연결이 복구되면 실제 데이터가 표시됩니다.",
    })
  }, [])

  const value = React.useMemo(
    () => ({
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showApiWarning,
    }),
    [showSuccess, showError, showWarning, showInfo, showApiWarning],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster position="top-right" richColors />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}
