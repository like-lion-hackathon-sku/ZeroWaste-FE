// app/stamps/page.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft, QrCode, ChevronLeft, ChevronRight, Loader2,
  TimerReset, Sparkles, ShieldCheck, RefreshCw, Info
} from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"

// api & utils
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"

// shared hooks
import {
  useUserStampsData, useUserStampHistory, pickData,
  type RestaurantStamp
} from "@/hooks/profile"

// shadcn
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// ✅ 성공 모달
import StampSuccessModal from "@/components/ai/StampSuccessModal"

/* ──────────────────────────────────────────────────────────────
   Page
────────────────────────────────────────────────────────────── */
export default function StampsPage() {
  const router = useRouter()

  // 데이터 로딩
  const { stamps: restaurantStamps, loading: stampsLoading, error: stampsError, refetch: refetchStamps } = useUserStampsData()
  const { items: stampHistory, loading: historyLoading, error: historyError, refetch: refetchHistory } = useUserStampHistory()

  // 페이지네이션(식당별)
  const [pageByRestaurant, setPageByRestaurant] = useState<Record<number, number>>({})
  const getCurrentPage = (ridKey: number) => pageByRestaurant[ridKey] ?? 1
  const setPage = (ridKey: number, page: number) => setPageByRestaurant((p) => ({ ...p, [ridKey]: Math.max(1, page) }))

  // 상단 탭 (✅ "use" 제거)
  type TopTab = "mine" | "history"
  const [tab, setTab] = useState<TopTab>("mine")

  // 사용 다이얼로그
  type StampDialogState =
    | { open: false }
    | {
        open: true
        step: "choose" | "qr"
        restaurant: RestaurantStamp
        maxUsable: number
        count: number
        generating: boolean
        code?: string
        qrPayload?: string
        condition?: number
        expiresAt?: number
        remainSec?: number
      }
  const [stampDialog, setStampDialog] = useState<StampDialogState>({ open: false })

  // 폴링 제어
  const startAtRef = useRef<number>(0)
  const stopPollingRef = useRef(false)

  // ✅ 성공 모달 상태
  const [showSuccess, setShowSuccess] = useState(false)

  // 히스토리 필터
  const [historyTab, setHistoryTab] = useState<"all" | "earn" | "use">("all")
  const earnCount = useMemo(() => stampHistory.filter(h => h.type === "earn").length, [stampHistory])
  const useCount  = useMemo(() => stampHistory.filter(h => h.type === "use").length,  [stampHistory])
  const filteredHistory = useMemo(
    () => historyTab === "all" ? stampHistory : stampHistory.filter(h => h.type === historyTab),
    [stampHistory, historyTab]
  )

  /* ───────────────────── 스탬프 사용 흐름 ───────────────────── */
  function getRestaurantId(s: RestaurantStamp): number | undefined {
    const id =
      (s as any).restaurantId ??
      (s as any).id ??
      (s as any).restaurant?.id ??
      (s as any).restaurant_id
    return typeof id === "number" ? id : undefined
  }

  function openUseDialog(s: RestaurantStamp) {
    const avail = s.totalStamps
    const maxUsable = Math.min(10, avail)
    if (avail < 3) { alert("스탬프가 3개 이상일 때만 사용할 수 있어요."); return }
    setStampDialog({ open: true, step: "choose", restaurant: s, maxUsable, count: Math.min(3, maxUsable), generating: false })
  }

  async function createUseSession(restaurantId: number, condition: number) {
    const r = await apiClient.requestUseStamp(restaurantId, condition) // POST /stamps/me/use
    if (!r.success) throw new Error(r.error || "세션 코드 발급 실패")
    return String((r.data as any).code)
  }

  async function generateUseQR(restaurant: RestaurantStamp, count: number) {
    try {
      setStampDialog((s) => ({ ...(s as any), generating: true }))

      const realId = getRestaurantId(restaurant)
      if (!realId) throw new Error("식당 ID를 찾지 못했어요. 식당 상세에서 다시 시도해 주세요.")

      const code = await createUseSession(realId, count)
      const qrPayload = JSON.stringify({ t: "STAMP_USE", code, r: realId, c: count })

      const expiresAt = Date.now() + 2 * 60 * 1000
      setStampDialog({
        open: true,
        step: "qr",
        restaurant,
        maxUsable: Math.min(10, restaurant.totalStamps),
        count,
        generating: false,
        code,
        qrPayload,
        condition: count,
        expiresAt,
        remainSec: Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
      })

      startAtRef.current = Date.now()
      stopPollingRef.current = false
      void pollUntilRedeemed({ name: restaurant.restaurantName, count })
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : "QR 생성(세션 발급)에 실패했어요.")
      setStampDialog((s) => ({ ...(s as any), generating: false }))
    }
  }

  async function pollUntilRedeemed({ name, count }: { name: string; count: number }) {
    const TIMEOUT = 90_000
    const INTERVAL = 1_000
    const started = startAtRef.current

    let baseCount: number | null = null
    try {
      const me0 = await apiClient.getUserStamps()
      const rows = ((me0 as any)?.data?.stamps ?? (me0 as any)?.data ?? []) as any[]
      const row = rows.find(r => String(r.restaurant ?? r.restaurantName) === name)
      baseCount = Number(row?.count ?? null)
    } catch {}

    const tick = async (): Promise<void> => {
      if (stopPollingRef.current) return
      try {
        // A) 보유 수 감소 감지
        let seenDrop = false
        {
          const me = await apiClient.getUserStamps()
          const arr = (pickData<any>(me)?.stamps ?? pickData<any>(me) ?? []) as any[]
          const row = arr.find(r => String(r.restaurant ?? r.restaurantName) === name)
          const nowCount = Number(row?.count ?? null)
          if (baseCount != null && Number.isFinite(nowCount)) {
            seenDrop = nowCount === baseCount - count
          }
        }

        // B) 히스토리 USED 감지
        let seenUsed = false
        {
          const h = await apiClient.getUserStampHistory()
          const hist = (pickData<any>(h)?.histories ?? pickData<any>(h) ?? []) as any[]
          const used = hist.find((x: any) => {
            const rname = String(x?.restaurant?.name ?? x?.restaurant ?? x?.restaurantName ?? "")
            const t = String(x?.type ?? "").toUpperCase()
            const usedAtMs = new Date(x?.expiredAt ?? x?.createdAt ?? x?.at ?? 0).getTime()
            const cond = Number(x?.condition ?? x?.count ?? 0)
            return rname === name && t === "USED" && cond === count && Number.isFinite(usedAtMs) && usedAtMs >= started
          })
          seenUsed = !!used
        }

        if (seenDrop && seenUsed) { onRedeemed(); return }
      } catch { /* ignore transient */ }

      if (Date.now() - started > TIMEOUT) {
        stopPollingRef.current = true
        setStampDialog(s => (s.open ? { open: false } : s as any))
        alert("QR 유효 시간이 만료되었습니다. 다시 시도해주세요.")
        return
      }
      setTimeout(tick, INTERVAL)
    }
    setTimeout(tick, INTERVAL)
  }

  function onRedeemed() {
    stopPollingRef.current = true
    setStampDialog({ open: false })
    refetchStamps(); refetchHistory()
    setTab("mine")
    // ✅ 성공 모달 오픈
    setShowSuccess(true)
  }

  // 남은 시간 타이머
  useEffect(() => {
    if (!(stampDialog.open && stampDialog.step === "qr" && stampDialog.expiresAt)) return
    const id = setInterval(() => {
      setStampDialog((s) => {
        if (!(s.open && s.step === "qr" && s.expiresAt)) return s
        const remain = Math.max(0, Math.ceil((s.expiresAt - Date.now()) / 1000))
        return { ...s, remainSec: remain }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [stampDialog.open, (stampDialog as any).step, (stampDialog as any).expiresAt])

  /* ────────────────────────── 렌더 ────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-gray-900/40 border-b">
        <div className="max-w-screen-md mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={()=>router.back()} className="h-9 px-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="font-semibold text-lg">스탬프</div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={()=>{ refetchStamps(); refetchHistory() }}>
              <RefreshCw className="h-4 w-4 mr-2" /> 새로고침
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 sm:px-6 py-6">
        <Tabs value={tab} onValueChange={(v)=>setTab(v as TopTab)} className="w-full">
          {/* ✅ 2-탭 구성 (mine, history) */}
          <TabsList className="w-full grid grid-cols-2 bg-white/70 dark:bg-gray-900/70 backdrop-blur border rounded-xl h-11">
            <TabsTrigger value="mine" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 rounded-lg">내 스탬프</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 rounded-lg">내역</TabsTrigger>
          </TabsList>

          {/* 내 스탬프 */}
          <TabsContent value="mine" className="mt-6">
            <Card className="backdrop-blur-xl bg-white/85 dark:bg-gray-900/80 border-white/20 shadow-xl">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  보유 스탬프 ({restaurantStamps.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {stampsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  </div>
                ) : stampsError ? (
                  <div className="text-center text-red-500 py-8">{String(stampsError)}</div>
                ) : restaurantStamps.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <QrCode className="h-16 w-16 mx-auto mb-3 opacity-30" />
                    아직 스탬프가 없습니다. 4점 이상의 리뷰를 작성해 보세요.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {restaurantStamps.map((stamp, index) => {
                      const ridKey = stamp.uiKey
                      const totalPages = Math.max(1, Math.ceil(stamp.totalStamps / stamp.maxStamps))
                      const curPage = getCurrentPage(ridKey)
                      const startIdx = (curPage - 1) * stamp.maxStamps
                      const filledOnThisPage = Math.max(0, Math.min(stamp.maxStamps, stamp.totalStamps - startIdx))
                      const extraBeyondFirst = Math.max(0, stamp.totalStamps - stamp.maxStamps)

                      return (
                        <motion.div
                          key={ridKey}
                          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * index }}
                          className="relative backdrop-blur-sm bg-white/60 dark:bg-gray-800/60 border rounded-2xl p-5 hover:shadow-lg"
                        >
                          <div className="absolute right-5 top-5 text-sm text-gray-600 dark:text-gray-300">
                            {stamp.totalStamps}/{stamp.maxStamps} 스탬프
                          </div>

                          <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-3 sm:mb-4 truncate">{stamp.restaurantName}</h3>

                          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-2">
                            {Array.from({ length: stamp.maxStamps }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                  i < filledOnThisPage
                                    ? "bg-gradient-to-br from-purple-500 to-pink-500 border-purple-400 text-white shadow-lg"
                                    : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400"
                                }`}
                              >
                                <QrCode className="h-5 w-5 sm:h-6 sm:w-6" />
                              </div>
                            ))}
                          </div>

                          <div className="text-center w-full mx-auto">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              4점 이상 리뷰 {stamp.totalStamps}개 보유
                            </p>
                            {extraBeyondFirst > 0 && curPage === 1 && (
                              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">+{extraBeyondFirst}개 추가 보유</div>
                            )}
                          </div>

                          <div className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                            <div className="order-1 sm:order-2 justify-self-center text-center">
                              {stamp.totalStamps >= 3 ? (
                                <div className="inline-flex items-center gap-2">
                                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full">
                                    <QrCode className="h-3 w-3" />
                                    스탬프 사용
                                  </div>
                                  <Button
                                    onClick={()=>openUseDialog(stamp)}
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-5 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-xl"
                                  >
                                    사용하기
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500 dark:text-gray-400">최소 3개 이상 모이면 사용 가능</div>
                              )}
                            </div>

                            <div className="order-2 sm:order-1 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                              <Button variant="outline" size="sm" onClick={()=>setPage(ridKey, Math.max(1, curPage - 1))} disabled={curPage <= 1} className="h-8 px-2">
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              {Array.from({ length: totalPages }).map((_, i) => (
                                <Button key={i} variant={curPage === i + 1 ? "default" : "outline"} size="sm" onClick={()=>setPage(ridKey, i + 1)}
                                  className={`h-8 w-8 p-0 ${curPage === i + 1 ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white" : ""}`}>
                                  {i + 1}
                                </Button>
                              ))}
                              <Button variant="outline" size="sm" onClick={()=>setPage(ridKey, Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} className="h-8 px-2">
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="order-3 sm:order-3 text-center sm:text-right">
                              <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center justify-center sm:justify-end gap-1">
                                <Info className="h-3.5 w-3.5" /> 사장님이 QR 스캔 후 사용 처리
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 내역 */}
          <TabsContent value="history" className="mt-6">
            <Card className="backdrop-blur-xl bg-white/85 dark:bg-gray-900/80 border-white/20 shadow-xl">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2">
                  사용 · 적립 내역
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {/* 상단 세그먼트 */}
                <div className="mb-3 flex items-center gap-1 rounded-xl p-1 bg-gray-100 dark:bg-gray-800">
                  <button
                    onClick={() => setHistoryTab("all")}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium transition ${historyTab === "all" ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300"}`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setHistoryTab("earn")}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium transition ${historyTab === "earn" ? "bg-white dark:bg-gray-900 shadow text-emerald-700 dark:text-emerald-300" : "text-gray-600 dark:text-gray-300"}`}
                  >
                    적립 ({earnCount})
                  </button>
                  <button
                    onClick={() => setHistoryTab("use")}
                    className={`flex-1 h-9 rounded-lg text-sm font-medium transition ${historyTab === "use" ? "bg-white dark:bg-gray-900 shadow text-purple-700 dark:text-purple-300" : "text-gray-600 dark:text-gray-300"}`}
                  >
                    사용 ({useCount})
                  </button>
                </div>

                {historyLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  </div>
                ) : historyError ? (
                  <div className="text-center text-red-500 py-6 text-sm">{historyError}</div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">내역이 없습니다.</div>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-auto">
                    {filteredHistory.map((h) => {
                      const chipClass =
                        h.type === "earn"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
                      const chipLabel = h.type === "earn" ? "적립" : "사용"
                      return (
                        <div key={String(h.id)} className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-white/60 dark:bg-gray-800/60">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{h.restaurantName}</div>
                              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${chipClass}`}>
                                {chipLabel} · {h.count}개
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 flex-shrink-0">{h.created_at ? formatDate(h.created_at) : "-"}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 스탬프 사용 다이얼로그 */}
      <Dialog
        open={(stampDialog as any).open}
        onOpenChange={(open) => {
          if (!open) { stopPollingRef.current = true }
          setStampDialog(open ? stampDialog : { open: false })
        }}
      >
        <DialogContent className="sm:max-w-md">
          {stampDialog.open && stampDialog.step === "choose" && (
            <>
              <DialogHeader>
                <DialogTitle>스탬프 사용 개수 선택</DialogTitle>
                <DialogDescription>
                  {stampDialog.restaurant.restaurantName} — 사용 가능: {stampDialog.maxUsable}개 (최소 3개, 최대 10개)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Label htmlFor="use-count">사용할 개수</Label>
                <Input
                  id="use-count"
                  type="number"
                  min={3}
                  max={stampDialog.maxUsable}
                  value={stampDialog.count}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0)
                    const clamped = Math.max(3, Math.min(stampDialog.maxUsable, v))
                    setStampDialog({ ...stampDialog, count: clamped })
                  }}
                />
                <p className="text-xs text-gray-500">사장님이 QR을 스캔하면 해당 개수만큼 사용 처리됩니다.</p>
              </div>

              <DialogFooter className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setStampDialog({ open: false })}>취소</Button>
                <Button
                  disabled={stampDialog.generating}
                  onClick={() => generateUseQR(stampDialog.restaurant, stampDialog.count)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                >
                  {stampDialog.generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                  QR 생성
                </Button>
              </DialogFooter>
            </>
          )}

          {stampDialog.open && stampDialog.step === "qr" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-purple-500" />
                  사장님 확인용 QR
                </DialogTitle>
                <DialogDescription>
                  {stampDialog.restaurant.restaurantName} • {stampDialog.count}개 사용
                </DialogDescription>
              </DialogHeader>

              <div className="w-full flex flex-col items-center gap-3 py-2">
                <div className="p-3 rounded-2xl bg-white shadow-inner border">
                  <QRCodeCanvas value={stampDialog.qrPayload || stampDialog.code || ""} size={220} includeMargin />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TimerReset className="h-4 w-4" />
                  남은 시간 {stampDialog.remainSec ?? 0}s
                </div>
                <p className="text-xs text-gray-500 text-center">
                  • 사장님 기기에서 QR을 스캔하면 사용 완료됩니다. (서버에서 검증/차감)
                </p>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                <Button variant="outline" onClick={() => setStampDialog({ open: false })}>닫기</Button>
                <Button
                  onClick={() => { setStampDialog({ open: false }); refetchStamps(); refetchHistory(); setTab("mine") }}
                  className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                >
                  새로고침
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ✅ 스탬프 성공 모달 */}
      <StampSuccessModal
        open={showSuccess}
        onClose={() => {
          setShowSuccess(false)
          setTab("history") // 원하면 "mine" 유지로 바꿔도 됨
        }}
        mascotSrc="/bobple-mascot.png"
        title="스탬프 사용 완료!"
        message={"스탬프가 성공적으로 사용되었습니다.\n내역 탭에서 사용 내역을 확인할 수 있어요."}
      />
    </div>
  )
}
