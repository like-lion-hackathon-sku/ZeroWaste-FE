"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CheckCircle } from "lucide-react"

/* ───────────────── dynamic import: 모든 export 케이스 대응 ───────────────── */
function resolveScanner(mod: any) {
  // named export
  if (mod?.QrScanner) return mod.QrScanner
  if (mod?.Scanner) return mod.Scanner
  // default 아래
  if (mod?.default?.QrScanner) return mod.default.QrScanner
  if (mod?.default?.Scanner) return mod.default.Scanner
  // default 자체가 컴포넌트
  if (typeof mod?.default === "function") return mod.default
  return null
}

const QrScanner = dynamic(
  async () => {
    const mod: any = await import("@yudiel/react-qr-scanner")
    const Comp = resolveScanner(mod)
    if (Comp) return Comp
    // 안전 fallback (개발 중 표시)
    return function MissingScanner() {
      return (
        <div className="p-4 text-red-500 text-sm">
          QR 스캐너 라이브러리를 불러오지 못했습니다. 패키지 버전/빌드를 확인하세요.
        </div>
      )
    }
  },
  {
    ssr: false,
    loading: () => <div className="p-4 text-white/80">카메라 준비 중…</div>,
  }
)

/* 라이브러리 prop 타입(동적 컴포넌트 any 억제용, 느슨하게 정의) */
type QRProps = {
  onDecode: (result: string | string[]) => void
  onError?: (err: unknown) => void
  constraints?: MediaTrackConstraints
  containerStyle?: React.CSSProperties
  videoStyle?: React.CSSProperties
}
const QrScannerTyped = QrScanner as unknown as React.ComponentType<QRProps>

/* ───────────────── Page ───────────────── */
export default function ScanPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const type = sp.get("type") ?? "stamp"
  const restaurantId = sp.get("restaurantId") ?? ""

  const [decoded, setDecoded] = useState<string | null>(null)
  const handledRef = useRef(false) // StrictMode 중복 처리 방지

  // 후면 카메라 우선
  const videoConstraints: MediaTrackConstraints = {
    facingMode: { ideal: "environment" },
  }

  const handleDecode = useCallback(
    async (text: string) => {
      if (handledRef.current) return
      handledRef.current = true
      setDecoded(text)

      try {
        // TODO: 실제 API 연동 시 여기에 호출
        // await apiClient.useStamp({ restaurantId: Number(restaurantId), code: text })

        alert(`스캔 성공!\ncode=${text}\n타입=${type}\n식당ID=${restaurantId}`)
        router.replace(`/restaurant/${restaurantId}?stamp=done`)
      } catch (err) {
        console.error(err)
        alert("스탬프 처리 중 오류가 발생했습니다.")
        router.back()
      }
    },
    [restaurantId, router, type]
  )

  const handleCancel = () => router.back()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-start p-6">
      <div className="w-full max-w-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={handleCancel} className="bg-white/10">
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로
          </Button>
          <div className="text-sm opacity-80">QR 코드 스캔</div>
          <div style={{ width: 64 }} />
        </div>

        {/* 카메라 영역 */}
        <div className="rounded-xl overflow-hidden bg-black border border-white/10">
          <div style={{ width: "100%", height: 520, position: "relative", background: "#000" }}>
            <QrScannerTyped
              constraints={videoConstraints}
              onDecode={(result) => {
                const text = Array.isArray(result) ? String(result[0] ?? "") : String(result ?? "")
                if (text) handleDecode(text)
              }}
              onError={(err) => console.error("QR scanner error:", err)}
              containerStyle={{ width: "100%", height: "100%" }}
              videoStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>

        {/* 상태 표시 */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-white/80">식당 ID: {restaurantId}</div>
          {decoded ? (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span>스캔됨</span>
            </div>
          ) : (
            <div className="text-sm text-white/60">카메라로 QR을 비추세요</div>
          )}
        </div>
      </div>
    </div>
  )
}