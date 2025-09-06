"use client"

import React from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { WifiOff } from "lucide-react"

export function NetworkStatus() {
  const [isOnline, setIsOnline] = React.useState(true)
  const [showOfflineAlert, setShowOfflineAlert] = React.useState(false)

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowOfflineAlert(false)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowOfflineAlert(true)
    }

    // Set initial state
    setIsOnline(navigator.onLine)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Auto-hide offline alert after 10 seconds
  React.useEffect(() => {
    if (showOfflineAlert) {
      const timer = setTimeout(() => {
        setShowOfflineAlert(false)
      }, 10000)

      return () => clearTimeout(timer)
    }
  }, [showOfflineAlert])

  if (!showOfflineAlert) {
    return null
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50">
      <Alert variant="destructive">
        <WifiOff className="h-4 w-4" />
        <AlertDescription>인터넷 연결이 끊어졌습니다. 연결이 복구되면 자동으로 동기화됩니다.</AlertDescription>
      </Alert>
    </div>
  )
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = React.useState(true)

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    setIsOnline(navigator.onLine)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return isOnline
}
