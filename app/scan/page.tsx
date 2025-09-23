// app/scan/page.tsx
"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useCallback, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  CheckCircle,
  Camera,
  QrCode,
  RefreshCw,
  AlertTriangle,
  Keyboard,
  Loader2,
} from "lucide-react"
import { apiClient } from "@/lib/api/client"

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
    loading: () => (
      <div className="flex items-center justify-center h-32 text-sm text-white/80">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        카메라 준비 중…
      </div>
    ),
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

/* ───────────────── 유틸: QR payload 파서 ───────────────── */
function parseStampCode(raw: string): { code: string | null; meta?: any } {
  if (!raw) return { code: null }
  // 1) JSON payload: {"t":"STAMP_USE","code":"..."}
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === "object" && typeof obj.code === "string" && obj.code.trim()) {
      return { code: obj.code.trim(), meta: obj }
    }
  } catch {
    /* noop */
  }
  // 2) URL 형태: https://...?code=xxx
  try {
    const url = new URL(raw)
    const code = url.searchParams.get("code")
    if (code && code.trim()) return { code: code.trim(), meta: { url: raw } }
  } catch {
    /* noop */
  }
  // 3) 순수 코드(UUID 등)
  if (/^[0-9a-fA-F-]{20,}$/.test(raw.trim())) return { code: raw.trim() }
  return { code: null }
}

/* ───────────────── Page ───────────────── */
export default function ScanPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const type = sp.get("type") ?? "stamp"
  const restaurantId = sp.get("restaurantId") ?? ""

  const [decoded, setDecoded] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [msg, setMsg] = useState<string>("")
  const [manualCode, setManualCode] = useState("")
  const handledRef = useRef(false) // StrictMode & 중복콜 방지
  const [submitting, setSubmitting] = useState(false)

  // 후면 카메라 우선 + 해상도 힌트
  const videoConstraints: MediaTrackConstraints = useMemo(
    () => ({
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    }),
    []
  )

  const vibrate = (pattern = [60]) => {
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        // @ts-ignore
        navigator.vibrate?.(pattern)
      }
    } catch {}
  }

  const callUseAPI = useCallback(
    async (code: string) => {
      setSubmitting(true)
      setMsg("")
      try {
        // ✅ 현재 클라 시그니처 유지: (restaurantId, code)
        const res = await apiClient.bizUseStamp(Number(restaurantId), code)
        if (!res?.success) throw new Error(res?.error || "스탬프 사용 처리 실패")
        setStatus("success")
        setMsg("확인되었습니다. 스탬프가 사용 처리되었습니다.")
        vibrate([20, 30, 20])
        // 상세로 복귀(딥링크 파라미터로 완료 신호)
        setTimeout(() => {
          router.replace(`/restaurant/${restaurantId}?stamp=done`)
        }, 550)
      } catch (e: any) {
        setStatus("error")
        setMsg(e?.message || "스탬프 사용 처리에 실패했습니다.")
        vibrate([80])
        // 실패 시 재시도 허용
        handledRef.current = false
      } finally {
        setSubmitting(false)
      }
    },
    [restaurantId, router]
  )

  const handleDecode = useCallback(
    async (result: string | string[]) => {
      // 라이브러리마다 배열로 올 수 있으니 안전 처리
      const text = Array.isArray(result) ? String(result[0] ?? "") : String(result ?? "")
      if (!text || handledRef.current) return
      handledRef.current = true
      setDecoded(text)

      const { code } = parseStampCode(text)
      if (!code) {
        setStatus("error")
        setMsg("유효한 스탬프 QR이 아닙니다. 다시 시도해주세요.")
        handledRef.current = false
        return
      }
      await callUseAPI(code)
    },
    [callUseAPI]
  )

  const handleCancel = () => router.back()

  const onSubmitManual = async () => {
    const code = manualCode.trim()
    if (!code || handledRef.current) return
    handledRef.current = true
    setDecoded(code)
    await callUseAPI(code)
  }

  const resetForRescan = () => {
    handledRef.current = false
    setDecoded(null)
    setStatus("idle")
    setMsg("")
  }

  const title = type === "stamp" ? "스탬프 사용 (QR 스캔)" : "QR 스캔"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-green-950/30 to-emerald-950/20 text-white flex flex-col items-center justify-start p-6">
      <div className="w-full max-w-3xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={handleCancel} className="rounded-2xl bg-white/10 hover:bg-white/20">
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로
          </Button>
          <div className="text-sm opacity-80">{title}</div>
          <div style={{ width: 80 }} />
        </div>

        {/* 카드 */}
        <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.06] backdrop-blur-xl shadow-2xl">
          {/* 상단 헤더영역 */}
          <div className="p-5 border-b border-white/10 bg-gradient-to-r from-emerald-600/20 to-teal-600/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                  <QrCode className="h-5 w-5 text-white" />
                </div>
                <div className="font-semibold text-base md:text-lg">{title}</div>
              </div>
              <div className="text-xs text-white/70">식당 ID: {restaurantId || "-"}</div>
            </div>
          </div>

          {/* 카메라 영역 */}
          <div className="relative">
            <div className="relative bg-black">
              <div className="relative w-full h-[56vw] max-h-[520px] min-h-[280px]">
                <QrScannerTyped
                  constraints={videoConstraints}
                  onDecode={handleDecode}
                  onError={(err) => {
                    console.error("QR scanner error:", err)
                    setStatus("error")
                    setMsg("카메라 접근에 실패했어요. 권한을 확인하거나 수동 입력을 이용하세요.")
                  }}
                  containerStyle={{ width: "100%", height: "100%" }}
                  videoStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {/* 가이드 프레임 */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-[78%] max-w-[480px] aspect-square rounded-3xl border-2 border-emerald-400/80 shadow-[0_0_30px_rgba(16,185,129,0.55)]" />
                </div>
              </div>

              {/* 오버레이 메시지 */}
              <div className="absolute bottom-3 inset-x-3">
                <div className="rounded-2xl px-4 py-3 bg-black/40 backdrop-blur-md border border-white/10 text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 opacity-80" />
                    <span className="opacity-90">
                      카메라를 QR 코드에 맞춰주세요
                    </span>
                  </div>
                  {decoded ? (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="h-4 w-4" />
                      <span>스캔됨</span>
                    </div>
                  ) : (
                    <span className="text-white/60">자동 인식</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 액션 영역 */}
          <div className="p-5 space-y-5">
            {/* 상태 표시 */}
            {msg && (
              <div
                className={`rounded-2xl px-4 py-3 text-sm border ${
                  status === "success"
                    ? "bg-emerald-50/20 text-emerald-300 border-emerald-400/30"
                    : "bg-red-50/20 text-red-300 border-red-400/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  {status === "success" ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <span>{msg}</span>
                </div>
              </div>
            )}

            {/* 버튼들 */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={resetForRescan}
                variant="secondary"
                className="rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10"
                disabled={submitting}
                title="다시 스캔"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                다시 스캔
              </Button>

              <div className="flex-1" />

              <Button
                variant="ghost"
                onClick={handleCancel}
                className="rounded-2xl hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                돌아가기
              </Button>
            </div>

            {/* 수동 입력 (대체 수단) */}
            <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 text-sm text-white/80 mb-3">
                <Keyboard className="h-4 w-4" />
                QR 대신 코드 수동 입력
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-4 py-2 rounded-xl bg-black/30 border border-white/10 outline-none focus:border-emerald-400/50 placeholder:text-white/30"
                  placeholder='예: 123e4567-e89b-12d3-a456-426614174000 또는 {"t":"STAMP_USE","code":"..."}'
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  disabled={submitting}
                />
                <Button
                  onClick={onSubmitManual}
                  disabled={!manualCode.trim() || submitting}
                  className="rounded-xl"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      처리 중…
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      사용 처리
                    </>
                  )}
                </Button>
              </div>
              <p className="mt-2 text-xs text-white/50">
                고객 앱에서 보여주는 QR을 스캔하거나, 표시된 코드 문자열을 그대로 붙여넣어도 됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 하단 도움말 */}
        <div className="mt-4 text-center text-xs text-white/50">
          스캔이 지연될 경우 조명/초점을 맞춘 뒤 다시 시도하세요.
        </div>
      </div>
    </div>
  )
}