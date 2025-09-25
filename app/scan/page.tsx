// app/scan/page.tsx
"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {ArrowLeft, CheckCircle, Camera, QrCode, RefreshCw, AlertTriangle, Keyboard, Loader2} from "lucide-react"
import { apiClient } from "@/lib/api/client"

// ZXing
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser"
import { BarcodeFormat, DecodeHintType } from "@zxing/library"

/* ───────────────── 유틸: QR payload 파서 ───────────────── */
function parseStampCode(raw: string): { code: string | null; meta?: any } {
  if (!raw) return { code: null }
  // 1) JSON payload: {"t":"STAMP_USE","code":"..."}
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === "object" && typeof obj.code === "string" && obj.code.trim()) {
      return { code: obj.code.trim(), meta: obj }
    }
  } catch {}
  // 2) URL 형태: https://...?code=xxx
  try {
    const url = new URL(raw)
    const code = url.searchParams.get("code")
    if (code && code.trim()) return { code: code.trim(), meta: { url: raw } }
  } catch {}
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
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // ZXing refs
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const zxingControlsRef = useRef<IScannerControls | null>(null)
  const handledRef = useRef(false) // 중복 호출 방지

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
        // ✅ client 최종본 기준: bizUseStamp는 code만 받음
        const res = await apiClient.bizUseStamp(code)
        if (!res?.success) throw new Error(res?.error || "스탬프 사용 처리 실패")
        setStatus("success")
        setMsg("확인되었습니다. 스탬프가 사용 처리되었습니다.")
        vibrate([20, 30, 20])

        // 소폭 지연 후 사장 모드 페이지로 이동 (필요 시 경로 조정)
        setTimeout(() => {
          if (restaurantId) {
            router.replace(`/restaurant/${restaurantId}?isOwnerMode=true`)
          } else {
            router.back()
          }
        }, 550)
      } catch (e: any) {
        setStatus("error")
        setMsg(e?.message || "스탬프 사용 처리에 실패했습니다.")
        vibrate([80])
        handledRef.current = false // 실패 시 재스캔 허용
        startZXing()
      } finally {
        setSubmitting(false)
      }
    },
    [restaurantId, router]
  )

  // ZXing 시작
  const startZXing = useCallback(async () => {
    try {
      setErr(null)
      // 이전 스캐너 중지
      zxingControlsRef.current?.stop()
      zxingControlsRef.current = null

      const hints = new Map<DecodeHintType, any>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE])
      const reader = new BrowserMultiFormatReader(hints)

      // 카메라 목록
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      if (!devices.length) {
        setErr("사용 가능한 카메라가 없어요.")
        return
      }
      // 후면 우선 선택
      const back =
        devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[devices.length - 1]

      // 연속 디코딩
      const controls = await reader.decodeFromVideoDevice(
        back.deviceId,
        videoRef.current!,
        (result) => {
          if (!result) return
          const text = result.getText()
          if (handledRef.current) return

          handledRef.current = true
          setDecoded(text)

          const { code } = parseStampCode(text)
          if (!code) {
            setStatus("error")
            setMsg("유효한 스탬프 QR이 아닙니다. 다시 시도해주세요.")
            handledRef.current = false
            return
          }

          // 중복 호출 방지 위해 즉시 정지
          controls.stop()
          zxingControlsRef.current = null
          void callUseAPI(code)
        }
      )

      // 포커스/프레임레이트 제약 (가능한 기기에서만)
      try {
        const stream = (videoRef.current as any)?.srcObject as MediaStream | undefined
        const track = stream?.getVideoTracks?.()[0]
        await (track as any)?.applyConstraints({
          advanced: [
            { focusMode: "continuous" }, // 일부 기기에서만 지원
            { frameRate: 30 },
            { width: 1280, height: 720 },
          ],
        } as any)
      } catch {}

      zxingControlsRef.current = controls
    } catch (e: any) {
      const name = e?.name || ""
      if (name === "NotAllowedError") {
        setErr("카메라 권한이 차단되었어요. 주소창의 카메라 아이콘에서 허용해주세요.")
      } else if (name === "NotFoundError") {
        setErr("카메라를 찾을 수 없어요.")
      } else {
        setErr(e?.message || "스캐너 초기화에 실패했어요.")
      }
    }
  }, [callUseAPI])

  const stopZXing = useCallback(() => {
    zxingControlsRef.current?.stop()
    zxingControlsRef.current = null
  }, [])

  useEffect(() => {
    startZXing()
    return () => stopZXing()
  }, [startZXing, stopZXing])

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
    startZXing()
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

          {/* 카메라 영역 (ZXing) */}
          <div className="relative">
            <div className="relative bg-black">
              <div className="relative w-full h-[56vw] max-h-[520px] min-h-[280px]">
                {!err ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 text-sm text-red-400">
                    {err}
                  </div>
                )}

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
                    <span className="opacity-90">카메라를 QR 코드에 맞춰주세요</span>
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
