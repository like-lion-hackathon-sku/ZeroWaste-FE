// app/profile/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft, User, Star, Heart, Award, Users, Edit, Loader2, Trash2,
  MapPin, Phone, Leaf, Store, UserCheck, Plus, Stamp, ChevronLeft, ChevronRight,
  QrCode, ShieldCheck, TimerReset,
} from "lucide-react"
import { useRouter } from "next/navigation"

// ✅ 프로필 기본 정보는 Zustand에서 읽음
import { useUserStore } from "@/lib/state/user"

import { useUserBadges, useFavorites, useUserReviews } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"
import { UserRole } from "@/lib/types/database"

// ✅ shadcn/ui Dialog & 입력
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

// ✅ QR
import { QRCodeCanvas } from "qrcode.react"

// ---------- 유틸 ----------
type TabKey = "리뷰" | "즐겨찾기" | "스탬프" | "뱃지" | "restaurant" | "reviews" | "owner-badges"
const toArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : (v?.items ?? v?.success?.items ?? []))

// ---------- 타입 ----------
type RestaurantLite = { id: number; name: string; category?: string | null; address?: string | null; telephone?: string | null }
type FavoriteItem = { id?: number; restaurant_id: number | null; restaurant?: RestaurantLite; name?: string; category?: string | null; restaurantId?: number; address?: string | null; telephone?: string | null }
type ReviewVM = { id: number | string; restaurant?: { id: number; name: string; category?: string | null }; waste_rating: number; comment: string; created_at?: string | null }
type OwnerRestaurant = { id: number; name: string; category?: string | null; address?: string | null; telephone?: string | null; rating?: number; reviewCount?: number }
type RestaurantStamp = { restaurantId: number; restaurantName: string; totalStamps: number; maxStamps: number }

// ---------- 스탬프 훅 ----------
const useUserStampsData = () => {
  const [stamps, setStamps] = useState<RestaurantStamp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUsingFallback, setIsUsingFallback] = useState(false)

  const MOCK: RestaurantStamp[] = [
    { restaurantId: 101, restaurantName: "그린 비스트로", totalStamps: 7, maxStamps: 5 },
    { restaurantId: 202, restaurantName: "제로웨이스트 키친", totalStamps: 3, maxStamps: 5 },
  ]

  useEffect(() => {
    let ignore = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiClient.getUserStamps()
        if (!ignore && res?.success) {
          const raw = Array.isArray(res.data) ? res.data : (res.data as any)?.items ?? []
          const normalized: RestaurantStamp[] = raw.map((s: any) => ({
            restaurantId: s?.restaurant?.id ?? s?.id,
            restaurantName: s?.restaurant?.name ?? `식당 ${s?.restaurant?.id ?? s?.id}`,
            totalStamps: s?.stamps?.length ?? 0,
            maxStamps: 5,
          }))
          setStamps(normalized)
          setIsUsingFallback(false)
        } else {
          setStamps(MOCK)
          setIsUsingFallback(true)
        }
      } catch (e) {
        if (!ignore) {
          setStamps(MOCK)
          setIsUsingFallback(true)
          setError(e instanceof Error ? e.message : "failed to load stamps")
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [])

  return { stamps, loading, error, isUsingFallback }
}

// ---------- 페이지 ----------
export default function ProfilePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>("스탬프")
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER)

  // ✅ 스토어에서 현재 사용자 (로그인 여부 판별)
  const me = useUserStore((s) => s.user)

  // 목록 데이터는 기존 훅 사용
  const { data: badges, loading: badgesLoading, isUsingFallback: badgesFallback } = useUserBadges()
  const { data: favorites, loading: favoritesLoading, isUsingFallback: favoritesFallback } = useFavorites()
  const { data: reviews, loading: reviewsLoading, isUsingFallback: reviewsFallback } = useUserReviews()
  const { stamps: restaurantStamps, loading: stampsLoading, isUsingFallback: stampsFallback } = useUserStampsData()

  // 전체 로딩 상태
  const isLoading = badgesLoading || favoritesLoading || reviewsLoading || stampsLoading

  const earnedBadgesCount = useMemo(
    () => toArray<any>(badges).filter((b) => !!(b?.badge ?? b?.name)).length,
    [badges],
  )

  // 즐겨찾기/리뷰 렌더 준비
  type ValidFavorite = FavoriteItem & { restaurant_id: number; restaurant: RestaurantLite }
  const [favList, setFavList] = useState<ValidFavorite[]>([])
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [reviewList, setReviewList] = useState<ReviewVM[]>([])

  const [ownerRestaurants] = useState<OwnerRestaurant[]>([
    { id: 1, name: "그린 비스트로", category: "양식", address: "서울시 강남구 테헤란로 123", telephone: "02-1234-5678", rating: 4.7, reviewCount: 24 },
  ])
  const ownerStats = useMemo(() => {
    const totalReceivedReviews = ownerRestaurants.reduce((s, r) => s + (r.reviewCount || 0), 0)
    const avgOwnerRating = ownerRestaurants.length > 0
      ? ownerRestaurants.reduce((s, r) => s + (r.rating || 0), 0) / ownerRestaurants.length
      : 0
    const totalFavorites = ownerRestaurants.length * 156
    return { totalRestaurants: ownerRestaurants.length, totalReceivedReviews, avgOwnerRating: Math.round(avgOwnerRating * 10) / 10, totalFavorites }
  }, [ownerRestaurants])

  function toFavoriteItem(f: any): FavoriteItem {
    const restaurant_id = f?.restaurant_id ?? f?.restaurantId ?? f?.restaurant?.id ?? null
    const restaurant: RestaurantLite | undefined =
      f?.restaurant ??
      (f?.name
        ? { id: restaurant_id as number, name: f.name, category: f.category ?? null, address: f.address ?? null, telephone: f.telephone ?? null }
        : undefined)
    return { id: f?.id, restaurant_id, restaurant }
  }

  useEffect(() => {
    const raw = toArray<any>(favorites)
    const isValid = (x: FavoriteItem): x is ValidFavorite => !!x.restaurant_id && !!x.restaurant
    setFavList(raw.map(toFavoriteItem).filter(isValid))
  }, [favorites])

  useEffect(() => {
    const raw = toArray<any>(reviews)
    const base: ReviewVM[] = raw.map((r: any) => ({
      id: r?.id ?? r?.reviewId,
      restaurant: r?.restaurant
        ? { id: r.restaurant.id, name: r.restaurant.name, category: r.restaurant.category ?? null }
        : r?.restaurantId
          ? { id: r.restaurantId, name: "식당 정보 없음" }
          : undefined,
      waste_rating: Number(r?.score ?? r?.waste_rating ?? 0),
      comment: String(r?.contents ?? r?.comment ?? ""),
      created_at: r?.createdAt ?? r?.created_at ?? null,
    }))
    setReviewList(base)

    const needIds = Array.from(new Set(
      base.filter((v) => v.restaurant && (!v.restaurant.name || v.restaurant.name === "식당 정보 없음"))
          .map((v) => v.restaurant!.id)
          .filter((id): id is number => Number.isFinite(id)),
    ))
    if (needIds.length === 0) return

    const cache = new Map<number, { name: string; category?: string | null }>()
    ;(async () => {
      const patched = await Promise.all(
        base.map(async (v) => {
          if (!v.restaurant) return v
          const rid = v.restaurant.id
          if (v.restaurant.name && v.restaurant.name !== "식당 정보 없음") return v
          if (cache.has(rid)) {
            const c = cache.get(rid)!
            return { ...v, restaurant: { id: rid, name: c.name, category: c.category ?? null } }
          }
          try {
            const resp = await apiClient.getRestaurantDetail(rid)
            if (resp.success) {
              const d: any = resp.data
              const name = d?.name ?? "식당 정보 없음"
              const category = d?.category ?? null
              cache.set(rid, { name, category })
              return { ...v, restaurant: { id: rid, name, category } }
            }
          } catch {}
          return v
        }),
      )
      setReviewList(patched)
    })()
  }, [reviews])

  const avgRating = useMemo(() => {
    const total = reviewList.length
    if (total === 0) return 0
    const sum = reviewList.reduce((acc, r) => acc + (Number(r.waste_rating) || 0), 0)
    return Math.max(0, Math.min(5, Math.round((sum / total) * 10) / 10))
  }, [reviewList])

  const handleRoleSwitch = () => {
    if (userRole === UserRole.USER) {
      setUserRole(UserRole.OWNER); setActiveTab("restaurant")
    } else {
      setUserRole(UserRole.USER); setActiveTab("리뷰")
    }
  }

  // ───────────── 스탬프: ‘개수’ 단위 사용 + 페이징 ─────────────
  const [pageByRestaurant, setPageByRestaurant] = useState<Record<number, number>>({})
  const [usedUnitsByRestaurant, setUsedUnitsByRestaurant] = useState<Record<number, number>>({}) // ✅ 핵심: 사용 개수

  const getAvailable = (s: RestaurantStamp) =>
    Math.max(0, s.totalStamps - (usedUnitsByRestaurant[s.restaurantId] ?? 0))

  const getCurrentPage = (rid: number) => pageByRestaurant[rid] ?? 1
  const setPage = (rid: number, page: number) =>
    setPageByRestaurant((p) => ({ ...p, [rid]: Math.max(1, page) }))

  const getTotalPages = (s: RestaurantStamp) =>
    Math.max(1, Math.ceil(getAvailable(s) / s.maxStamps))

  // 🔶 “사용하기” → 개수 선택 다이얼로그 & QR
  type StampDialogState =
    | { open: false }
    | {
        open: true
        step: "choose" | "qr"
        restaurant: RestaurantStamp
        maxUsable: number
        count: number
        generating: boolean
        token?: string
        payload?: string
        expiresAt?: number   // epoch ms
        remainSec?: number
      }

  const [stampDialog, setStampDialog] = useState<StampDialogState>({ open: false })

  const openUseDialog = (s: RestaurantStamp) => {
    const avail = getAvailable(s)
    const maxUsable = Math.min(10, avail) // 최대 10
    if (avail < 3) {
      alert("스탬프가 3개 이상일 때만 사용할 수 있어요.")
      return
    }
    setStampDialog({
      open: true,
      step: "choose",
      restaurant: s,
      maxUsable,
      count: Math.min(3, maxUsable), // 최소 기본 3
      generating: false,
    })
  }

  async function generateUseQR(restaurant: RestaurantStamp, count: number) {
    try {
      setStampDialog((s) => ({ ...(s as any), generating: true }))
      const be = await apiClient.createStampUseIntent?.({
        restaurantId: restaurant.restaurantId,
        count,
      })
      let token = ""
      let payload = ""
      let expiresAt = Date.now() + 2 * 60 * 1000 // 120s 기본

      if (be?.success) {
        token = be.data?.token ?? ""
        payload = be.data?.payload ?? ""
        if (be.data?.expiresAt) expiresAt = new Date(be.data.expiresAt).getTime()
      } else {
        // 폴백: 로컬 페이로드
        const nonce = crypto.getRandomValues(new Uint32Array(4)).join("-")
        token = `local-${nonce}`

        const userId = (me as any)?.id ?? (me as any)?.userId ?? "me"
        const now = Date.now()
        expiresAt = now + 2 * 60 * 1000

        const localPayload = {
          ver: 1,
          type: "stamp.use",
          rid: restaurant.restaurantId,
          rname: restaurant.restaurantName,
          uid: userId,
          count,
          ts: now,
          exp: expiresAt,
          nonce,
        }
        payload = JSON.stringify(localPayload)
      }

      setStampDialog({
        open: true,
        step: "qr",
        restaurant,
        maxUsable: Math.min(10, getAvailable(restaurant)),
        count,
        generating: false,
        token,
        payload: payload || token,
        expiresAt,
        remainSec: Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
      })
    } catch (e) {
      console.error(e)
      alert("QR 생성에 실패했어요. 잠시 후 다시 시도해주세요.")
      setStampDialog((s) => ({ ...(s as any), generating: false }))
    }
  }

  // 남은 시간 타이머
  useEffect(() => {
    if (!stampDialog.open || stampDialog.step !== "qr" || !stampDialog.expiresAt) return
    const tick = () => {
      setStampDialog((s) => {
        if (!s.open || s.step !== "qr" || !s.expiresAt) return s
        const remain = Math.max(0, Math.ceil((s.expiresAt - Date.now()) / 1000))
        return { ...s, remainSec: remain }
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [stampDialog.open, stampDialog.step, stampDialog.expiresAt])

  // 🔸 사장 처리 후: ‘개수’ 단위로 차감 & 페이지 보정
  const markUsedLocally = () => {
    if (!stampDialog.open || stampDialog.step !== "qr") return
    const s = stampDialog.restaurant
    const useCount = Math.min(stampDialog.count, getAvailable(s))
    if (useCount <= 0) {
      setStampDialog({ open: false })
      return
    }

    setUsedUnitsByRestaurant((prev) => {
      const cur = prev[s.restaurantId] ?? 0
      return { ...prev, [s.restaurantId]: cur + useCount }
    })

    const afterAvail = Math.max(0, getAvailable(s) - useCount)
    const totalPagesAfter = Math.max(1, Math.ceil(afterAvail / s.maxStamps))
    setPageByRestaurant((prev) => {
      const next = { ...prev }
      const curPage = next[s.restaurantId] ?? 1
      if (curPage > totalPagesAfter) next[s.restaurantId] = totalPagesAfter
      return next
    })

    setStampDialog({ open: false })
  }

  const handleRestaurantClick = (restaurantId: number) => router.push(`/restaurant/${restaurantId}`)
  const handleEditProfile = () => router.push("/profile/edit")

  const handleRemoveFavorite = async (e: React.MouseEvent<HTMLButtonElement>, restaurantId: number) => {
    e.preventDefault(); e.stopPropagation()
    if (removingId) return
    setRemovingId(restaurantId)
    const prev = favList
    setFavList((list) => list.filter((f) => f.restaurant_id !== restaurantId))
    try {
      const res = await apiClient.removeFavorite(restaurantId)
      if (!res.success) throw new Error(res.error || "즐겨찾기 삭제 실패")
    } catch (err) {
      setFavList(prev); console.error(err); alert("즐겨찾기 삭제에 실패했습니다.")
    } finally { setRemovingId(null) }
  }

  // ---------- 로그인 게이트 ----------
  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-gray-600">로그인이 필요해요.</p>
          <Button onClick={() => router.push("/login")} className="bg-green-600 hover:bg-green-700">
            로그인하기
          </Button>
        </div>
      </div>
    )
  }

  // ✅ 프로필 표시용 데이터 (Zustand)
  const p = me as { nickname?: string; email?: string; created_at?: string | null; profile?: string | null }

  // ✅ 아바타 이미지 URL
  const [avatarSrc, setAvatarSrc] = useState<string>("/placeholder.svg")
  useEffect(() => {
    let ignore = false
    ;(async () => {
      const fileName = (me as any)?.profile
      if (!fileName) {
        setAvatarSrc("/placeholder.svg")
        return
      }
      const url = await apiClient.getImageSignedUrl(0, fileName) // 0 = 프로필
      if (!ignore && url) setAvatarSrc(url)
    })()
    return () => { ignore = true }
  }, [me])
  const showFallbackWarning = badgesFallback || favoritesFallback || reviewsFallback || stampsFallback

  // ---------- 본문 렌더 ----------
  return (
    <div className="min-h-screen bg-gray-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {showFallbackWarning && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 px-4 py-3 text-sm">
          연결되면 실제 데이터가 표시됩니다. 현재는 목업 데이터를 사용 중입니다.
        </div>
      )}

      {/* 헤더 */}
      <motion.header
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 pt-[max(env(safe-area-inset-top),0px)] backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-white/20 px-3 sm:px-4 py-2 sm:py-3"
      >
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="hover:bg-white/20">
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="font-bold text-[clamp(18px,4vw,24px)] bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
            프로필
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleEditProfile} className="hover:bg-white/20">
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      <div className="mx-auto px-4 sm:px-6 max-w-screen-md">
        {/* 프로필 카드 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="mb-6 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-4 mb-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 200 }}>
                  <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-4 ring-green-500/20">
                    <AvatarImage src={avatarSrc} alt={p.nickname || "user"} />
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                      <User className="h-7 w-7" />
                    </AvatarFallback>
                  </Avatar>
                </motion.div>

                <div className="flex-1 min-w-0">
                  <motion.h2
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                    className="text-[clamp(18px,5vw,22px)] font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-1 truncate"
                  >
                    {p.nickname}
                  </motion.h2>
                  <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="text-gray-600 dark:text-gray-300 mb-1 truncate">
                    {p.email}
                  </motion.p>
                  {p.created_at && (
                    <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="text-xs text-gray-500 dark:text-gray-400">
                      가입일: {formatDate(p.created_at ?? "")}
                    </motion.p>
                  )}
                </div>

                {/* 우측: 모드 전환 버튼 */}
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="flex flex-col items-end gap-2">
                  <Button
                    onClick={handleRoleSwitch}
                    variant={userRole === UserRole.OWNER ? "default" : "outline"}
                    className={`${userRole === UserRole.OWNER
                        ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        : "border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                      } transition-all duration-300`}
                  >
                    {userRole === UserRole.USER ? (<><Store className="h-4 w-4 mr-2" />사업자 모드 전환</>) : (<><UserCheck className="h-4 w-4 mr-2" />사용자 모드 전환</>)}
                  </Button>

                  {userRole === UserRole.OWNER && (
                    <div className="flex items-center gap-2">
                      <div className="px-2.5 py-0.5 rounded-full text-xs font-medium text-white bg-gradient-to-r from-orange-500 to-red-600">사장님</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">인증됨</div>
                    </div>
                  )}
                </motion.div>
              </div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {userRole === UserRole.USER ? (
                  <>
                    <motion.div whileHover={{ scale: 1.03 }} className="text-center p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-2xl border border-green-200/30">
                      <div className="text-2xl font-bold text-green-600 mb-1">{reviewList.length}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">총 리뷰</div>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.03 }} className="text-center p-4 bg-gradient-to-br from-sky-500/10 to-blue-500/10 backdrop-blur-sm rounded-2xl border border-sky-200/30">
                      {reviewList.length > 0 ? (
                        <>
                          <div className="flex items-center justify-center gap-1 mb-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`h-4 w-4 ${i < Math.round(avgRating) ? "fill-current text-green-500" : "text-gray-300"}`} />
                            ))}
                          </div>
                          <div className="text-xs text-green-600 font-medium mb-1">{avgRating.toFixed(1)}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">잔반 별점</div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">리뷰 없음</div>
                          <div className="text-xs text-gray-500">리뷰를 작성해보세요</div>
                        </>
                      )}
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.03 }} className="text-center p-4 bg-gradient-to-br from-red-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl border border-red-200/30">
                      <div className="text-2xl font-bold text-red-500 mb-1">{favList.length}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">즐겨찾기</div>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.03 }} className="text-center p-4 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 backdrop-blur-sm rounded-2xl border border-orange-200/30">
                      <div className="text-2xl font-bold text-orange-600 mb-1">{earnedBadgesCount}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">획득 뱃지</div>
                    </motion.div>
                  </>
                ) : (
                  <>
                    <motion.div whileHover={{ scale: 1.03 }} className="text-center p-4 bg-gradient-to-br from-blue-500/10 to-sky-500/10 backdrop-blur-sm rounded-2xl border border-blue-200/30">
                      <div className="text-2xl font-bold text-blue-600 mb-1">{ownerStats.totalReceivedReviews}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">받은 리뷰</div>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.03 }} className="text-center p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-2xl border border-green-200/30">
                      <div className="text-2xl font-bold text-green-600 mb-1">{ownerStats.avgOwnerRating}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">평균 별점</div>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.03 }} className="text-center p-4 bg-gradient-to-br from紫-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl border border-purple-200/30">
                      <div className="text-2xl font-bold text-purple-600 mb-1">{ownerStats.totalFavorites}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">받은 즐겨찾기</div>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.03 }} className="text-center p-4 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 backdrop-blur-sm rounded-2xl border border-orange-200/30">
                      <div className="text-2xl font-bold text-orange-600 mb-1">{earnedBadgesCount}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">획득 뱃지</div>
                    </motion.div>
                  </>
                )}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 탭 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
            <TabsList
              className={`w-full flex gap-1 overflow-x-auto
                          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
                          sm:grid ${userRole === UserRole.USER ? "sm:grid-cols-4" : "sm:grid-cols-3"}
                          backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 rounded-xl px-1 h-10 sm:h-12`}
            >
              {(userRole === UserRole.USER ? ["리뷰","즐겨찾기","스탬프","뱃지"] : ["restaurant","reviews","owner-badges"]).map((key) => (
                <TabsTrigger
                  key={key}
                  value={key as TabKey}
                  className="shrink-0 px-3 py-2 text-sm sm:text-base rounded-lg
                             data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800
                             data-[state=active]:shadow"
                >
                  {key === "restaurant" ? "내 식당" : key === "reviews" ? "받은 리뷰" : key === "owner-badges" ? "뱃지" : key}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* USER 탭들 */}
            {userRole === UserRole.USER && (
              <>
                {/* 리뷰 */}
                <TabsContent value="리뷰" className="mt-6">
                  <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                        <Star className="h-5 w-5 text-green-500" />
                        작성한 리뷰 ({reviewList.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="space-y-4 sm:space-y-6">
                        {reviewList.length > 0 ? (
                          reviewList.map((review, idx) => {
                            return (
                              <motion.div
                                key={review.id}
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * idx }}
                                className="backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-4 hover:shadow-lg transition-all duration-300"
                              >
                                <div className="flex items-start justify-between mb-3 gap-3">
                                  <div className="min-w-0">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">
                                      {review.restaurant?.name || "식당 정보 없음"}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                                      <div className="flex items-center gap-1">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                          <Star key={i} className={`h-3 w-3 ${i < Math.round(review.waste_rating || 0) ? "fill-current text-green-500" : "text-gray-300"}`} />
                                        ))}
                                        <span>{review.waste_rating.toFixed(1)}</span>
                                      </div>
                                      <span className="truncate">{review.restaurant?.category || "카테고리 없음"}</span>
                                    </div>
                                  </div>
                                  <span className="text-xs text-gray-500 flex-shrink-0">
                                    {review.created_at ? formatDate(review.created_at) : "날짜 없음"}
                                  </span>
                                </div>

                                <p className="text-gray-700 dark:text-gray-300 mb-3 break-words whitespace-pre-wrap leading-relaxed">{review.comment || "댓글 없음"}</p>

                                <div className="flex justify-end">
                                  <Button variant="outline" size="sm" onClick={() => router.push(`/review/edit/${review.id}`)} className="bg-white/50 hover:bg白/80 border-white/30">
                                    수정
                                  </Button>
                                </div>
                              </motion.div>
                            )
                          })
                        ) : (
                          <div className="text-center text-gray-500 py-12">
                            <Star className="h-16 w-16 mx-auto mb-4 opacity-30" />
                            <h3 className="text-lg font-medium mb-2">작성한 리뷰가 없습니다</h3>
                            <p>첫 번째 리뷰를 작성해보세요</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 즐겨찾기 */}
                <TabsContent value="즐겨찾기" className="mt-6">
                  <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                        <Heart className="h-5 w-5 text-red-500" />
                        즐겨찾기 식당 ({favList.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="space-y-4">
                        {favList.length > 0 ? (
                          favList.map((favorite, index) =>
                            favorite.restaurant ? (
                              <motion.div
                                key={`${favorite.restaurant_id}-${favorite.id ?? "row"}`}
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * index }}
                                className="relative backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-4 hover:shadow-lg transition-all duration-300 cursor-pointer"
                                onClick={() => handleRestaurantClick(favorite.restaurant!.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRestaurantClick(favorite.restaurant!.id) } }}
                              >
                                <div className="absolute right-3 top-3">
                                  <Button
                                    type="button" variant="destructive" size="sm"
                                    className="gap-2 bg-red-500/90 hover:bg-red-600"
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                                    onClick={(e) => handleRemoveFavorite(e, favorite.restaurant_id!)}
                                    disabled={removingId === favorite.restaurant_id}
                                    title="즐겨찾기 삭제"
                                  >
                                    {removingId === favorite.restaurant_id ? (<><Loader2 className="h-4 w-4 animate-spin" />삭제 중…</>) : (<Trash2 className="h-4 w-4" />)}
                                  </Button>
                                </div>

                                <div>
                                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">
                                    {favorite.restaurant.name}
                                  </h3>

                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300 mb-2">
                                    <span className="inline-flex items-center gap-1">
                                      <Leaf className="h-3.5 w-3.5 text-green-500" />
                                      잔반
                                    </span>
                                    <span className="truncate">{favorite.restaurant.category || "카테고리 없음"}</span>
                                  </div>

                                  {favorite.restaurant.address && (
                                    <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                                      <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                                      <span className="leading-5 break-words">{favorite.restaurant.address}</span>
                                    </div>
                                  )}

                                  {favorite.restaurant.telephone && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-1">
                                      <Phone className="h-4 w-4 text-gray-400" />
                                      <span>{favorite.restaurant.telephone}</span>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            ) : null,
                          )
                        ) : (
                          <div className="text-center text-gray-500 py-12">
                            <Heart className="h-16 w-16 mx-auto mb-4 opacity-30" />
                            <h3 className="text-lg font-medium mb-2">즐겨찾기한 식당이 없습니다</h3>
                            <p>마음에 드는 식당을 즐겨찾기에 추가해보세요</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 스탬프 */}
                <TabsContent value="스탬프" className="mt-6">
                  <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                        <Stamp className="h-5 w-5 text-purple-500" />
                        내 스탬프 ({restaurantStamps.length})
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-6">
                      {stampsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {restaurantStamps.length > 0 ? (
                            restaurantStamps.map((stamp, index) => {
                              const rid = stamp.restaurantId
                              const avail = getAvailable(stamp)
                              const totalPages = getTotalPages(stamp)
                              const curPage = getCurrentPage(rid)
                              const startIdx = (curPage - 1) * stamp.maxStamps
                              const filledOnThisPage = Math.max(0, Math.min(stamp.maxStamps, avail - startIdx))
                              const extraBeyondFirst = Math.max(0, avail - stamp.maxStamps)
                              const booksUsed = Math.floor((usedUnitsByRestaurant[rid] ?? 0) / stamp.maxStamps) // 안내용

                              return (
                                <motion.div
                                  key={rid}
                                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * index }}
                                  className="relative backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-5 sm:p-6 hover:shadow-lg transition-all duration-300"
                                >
                                  <div className="absolute right-5 top-5 text-sm text-gray-600 dark:text-gray-300">
                                    {avail}/{stamp.maxStamps} 스탬프
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
                                        <Stamp className="h-5 w-5 sm:h-6 sm:w-6" />
                                      </div>
                                    ))}
                                  </div>

                                  <div className="text-center w-full mx-auto">
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                      4점 이상 리뷰 {avail}개 보유 (부분 사용 즉시 반영)
                                    </p>
                                    {extraBeyondFirst > 0 && curPage === 1 && (
                                      <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                                        +{extraBeyondFirst}개 추가 보유
                                      </div>
                                    )}
                                  </div>

                                  {/* 컨트롤 */}
                                  <div className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                                    {/* 가운데: 사용하기 */}
                                    <div className="order-1 sm:order-2 justify-self-center text-center">
                                      {avail >= 3 ? (
                                        <div className="inline-flex items-center gap-2">
                                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full">
                                            <QrCode className="h-3 w-3" />
                                            스탬프 사용
                                          </div>
                                          <Button
                                            onClick={() => openUseDialog(stamp)}
                                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-5 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-xl"
                                          >
                                            사용하기
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          최소 3개 이상 모이면 사용 가능
                                        </div>
                                      )}
                                    </div>

                                    {/* 왼쪽: 페이지네이션 */}
                                    <div className="order-2 sm:order-1 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                      <Button variant="outline" size="sm" onClick={() => setPage(rid, Math.max(1, curPage - 1))} disabled={curPage <= 1} className="h-8 px-2">
                                        <ChevronLeft className="h-4 w-4" />
                                      </Button>

                                      {Array.from({ length: totalPages }).map((_, i) => (
                                        <Button
                                          key={i}
                                          variant={curPage === i + 1 ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => setPage(rid, i + 1)}
                                          className={`h-8 w-8 p-0 ${curPage === i + 1 ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white" : ""}`}
                                        >
                                          {i + 1}
                                        </Button>
                                      ))}

                                      <Button variant="outline" size="sm" onClick={() => setPage(rid, Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} className="h-8 px-2">
                                        <ChevronRight className="h-4 w-4" />
                                      </Button>
                                    </div>

                                    {/* 오른쪽: 사용(책) 횟수 안내 */}
                                    <div className="order-3 sm:order-3 text-center sm:text-right">
                                      {booksUsed > 0 && <div className="text-xs text-gray-600 dark:text-gray-300">사용(책) {booksUsed}회</div>}
                                    </div>
                                  </div>
                                </motion.div>
                              )
                            })
                          ) : (
                            <div className="text-center text-gray-500 py-12">
                              <Stamp className="h-16 w-16 mx-auto mb-4 opacity-30" />
                              <h3 className="text-lg font-medium mb-2">스탬프가 없습니다</h3>
                              <p>4점 이상의 리뷰를 작성하면 스탬프를 받을 수 있어요</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 뱃지 (USER) */}
                <TabsContent value="뱃지" className="mt-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                          <Award className="h-5 w-5 text-orange-500" />
                          획득한 뱃지 ({earnedBadgesCount})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6">{/* 상세 UI 필요 시 채워넣기 */}</CardContent>
                    </Card>

                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                          <Users className="h-5 w-5 text-gray-500" />
                          진행 중인 뱃지 (2)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[
                            { id: "good_customer_3", name: "착한 손님 Lv.3", icon: "🍃", description: "누적 리뷰 50개", progress: reviewList.length || 0, target: 50 },
                            { id: "eco_influencer", name: "에코 인플루언서", icon: "📸", description: "AI 분석 사진 20장 업로드", progress: 15, target: 20 },
                          ].map((badge, index) => (
                            <motion.div
                              key={badge.id}
                              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * index }}
                              whileHover={{ scale: 1.03 }}
                              className="p-4 bg-gray-500/10 backdrop-blur-sm border border-gray-200/30 rounded-2xl text-center"
                            >
                              <div className="text-3xl mb-2 opacity-50">{badge.icon}</div>
                              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{badge.name}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{badge.description}</p>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>진행률</span>
                                  <span>{badge.progress}/{badge.target}</span>
                                </div>
                                <Progress value={(badge.progress / badge.target) * 100} className="h-2" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              </>
            )}

            {/* OWNER 탭들 */}
            {userRole === UserRole.OWNER && (
              <>
                <TabsContent value="restaurant" className="mt-6">
                  <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                    <CardHeader className="p-4 sm:p-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                          <Store className="h-5 w-5 text-orange-500" />
                          내 식당 관리
                        </CardTitle>
                        <Button onClick={() => router.push("/profile/owner-registration")} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                          <Plus className="h-4 w-4 mr-2" />
                          내 식당 추가하기
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      {ownerRestaurants.length > 0 ? (
                        <div className="space-y-4">
                          {ownerRestaurants.map((r, index) => (
                            <motion.div
                              key={r.id}
                              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * index }}
                              className="backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-4 hover:shadow-lg transition-all duration-300 cursor-pointer"
                              onClick={() => router.push(`/restaurant/${r.id}?isOwnerMode=true`)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">{r.name}</h3>
                                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                                    <span className="truncate">{r.category || "카테고리 없음"}</span>
                                    {r.rating && (
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-current text-green-500" />
                                        <span>{r.rating.toFixed(1)}</span>
                                      </div>
                                    )}
                                    {r.reviewCount && <span>리뷰 {r.reviewCount}개</span>}
                                  </div>
                                </div>
                              </div>

                              {r.address && (
                                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
                                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                                  <span className="leading-5 break-words">{r.address}</span>
                                </div>
                              )}

                              {r.telephone && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                  <Phone className="h-4 w-4 text-gray-400" />
                                  <span>{r.telephone}</span>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-12">
                          <Store className="h-16 w-16 mx-auto mb-4 opacity-30" />
                          <h3 className="text-lg font-medium mb-2">등록된 식당이 없습니다</h3>
                          <p className="mb-4">첫 번째 식당을 등록해보세요</p>
                          <Button onClick={() => router.push("/profile/owner-registration")} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                            <Plus className="h-4 w-4 mr-2" />
                            식당 등록하기
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="reviews" className="mt-6">
                  <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                        <Star className="h-5 w-5 text-green-500" />
                        받은 리뷰 관리 ({ownerStats.totalReceivedReviews})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="text-center text-gray-500 py-12">
                        <Star className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <h3 className="text-lg font-medium mb-2">받은 리뷰 관리 기능</h3>
                        <p>고객들의 소중한 리뷰를 확인하고 관리할 수 있습니다</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="owner-badges" className="mt-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                          <Award className="h-5 w-5 text-orange-500" />
                          획득한 뱃지 ({earnedBadgesCount})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6">
                        {earnedBadgesCount > 0 ? (
                          <div className="text-sm text-gray-600 dark:text-gray-300">뱃지 목록은 추후 상세 화면에서 관리할 수 있어요.</div>
                        ) : (
                          <div className="text-center text-gray-500 py-8">아직 획득한 뱃지가 없습니다.</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                          <Users className="h-5 w-5 text-gray-500" />
                          진행 중인 뱃지 (2)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[
                            { id: "good_owner", name: "친절한 사장님", icon: "🧡", description: "리뷰 50개 이상, 평균 4.5+", progress: 24, target: 50 },
                            { id: "eco_master", name: "에코 마스터", icon: "🌿", description: "에코 캠페인 10회 참여", progress: 6, target: 10 },
                          ].map((badge, idx) => (
                            <motion.div
                              key={badge.id}
                              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * idx }}
                              whileHover={{ scale: 1.03 }}
                              className="p-4 bg-gray-500/10 backdrop-blur-sm border border-gray-200/30 rounded-2xl text-center"
                            >
                              <div className="text-3xl mb-2 opacity-50">{badge.icon}</div>
                              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{badge.name}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{badge.description}</p>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>진행률</span>
                                  <span>{badge.progress}/{badge.target}</span>
                                </div>
                                <Progress value={(badge.progress / badge.target) * 100} className="h-2" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              </>
            )}
          </Tabs>
        </motion.div>
      </div>

      {/* ───────── 스탬프 사용 다이얼로그 ───────── */}
      <Dialog open={stampDialog.open} onOpenChange={(open) => setStampDialog(open ? stampDialog : { open: false })}>
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
                  <QRCodeCanvas
                    value={stampDialog.payload || stampDialog.token || ""}
                    size={220}
                    includeMargin
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TimerReset className="h-4 w-4" />
                  남은 시간 {stampDialog.remainSec ?? 0}s
                </div>
                <p className="text-xs text-gray-500 text-center">
                  • 유효시간 내 스캔해야 합니다. 스캔 후에는 화면을 닫아주세요.
                </p>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                <Button variant="outline" onClick={() => setStampDialog({ open: false })}>닫기</Button>
                <Button
                  onClick={markUsedLocally}
                  className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                >
                  사용 완료로 표시
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* 참고: apiClient에 아래 메서드가 없으면 폴백 QR로 동작합니다.
   - getUserStamps()
   - getRestaurantDetail(id:number)
   - removeFavorite(restaurantId:number)
   - createStampUseIntent({ restaurantId:number, count:number })
*/
