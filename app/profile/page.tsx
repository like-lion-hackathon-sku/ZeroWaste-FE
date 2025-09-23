// app/profile/page.tsx
"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft, User, Star, Heart, Award, Users, Edit, Loader2, Trash2,
  MapPin, Phone, Leaf, Store, UserCheck, Plus, Stamp as StampIcon,
  ChevronLeft, ChevronRight, QrCode, ShieldCheck, TimerReset,
} from "lucide-react"
import { useRouter } from "next/navigation"

// ✅ Zustand
import { useUserStore } from "@/lib/state/user"

// ✅ 데이터 훅 (즐겨찾기/리뷰) — 뱃지는 FE 계산
import { useFavorites, useUserReviews } from "@/lib/hooks/use-api-with-fallback"

// ✅ API 클라이언트
import { apiClient } from "@/lib/api/client"

import { formatDate } from "@/lib/utils/database-helpers"
import { UserRole } from "@/lib/types/database"

// ✅ shadcn/ui Dialog & 입력
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

// ✅ QR
import { QRCodeCanvas } from "qrcode.react"

/* ─────────────────────────────────────────────────────────
   공통 타입/유틸
────────────────────────────────────────────────────────── */
type TabKey = "리뷰" | "즐겨찾기" | "스탬프" | "뱃지" | "restaurant" | "reviews" | "owner-badges"
const toArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : (v?.items ?? v?.success?.items ?? []))

type RestaurantLite = { id: number; name: string; category?: string | null; address?: string | null; telephone?: string | null }
type FavoriteItem = { id?: number; restaurant_id: number | null; restaurant?: RestaurantLite }
type ReviewVM = { id: number | string; restaurant?: { id: number; name: string; category?: string | null }; waste_rating: number; comment: string; created_at?: string | null }
type RestaurantStamp = { restaurantId: number; restaurantName: string; totalStamps: number; maxStamps: number }
type StampHistoryVM = { id: number | string; restaurantId: number; restaurantName: string; type: "earn" | "use"; count: number; created_at?: string | null }

function stringHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0 }
  return Math.abs(h) || 1
}

/* ─────────────────────────────────────────────────────────
   스탬프 훅들 (BE 스펙 대응)
────────────────────────────────────────────────────────── */
const useUserStampsData = () => {
  const [stamps, setStamps] = useState<RestaurantStamp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.getMyStamps()
      if (!res?.success) throw new Error(res?.error || "failed")

      // BE 표준: { success: { stamps: [{ restaurant: "하오하오즈", count: 3 }, ...] } }
      const raw = Array.isArray(res.data) ? res.data : (res as any)?.data?.stamps ?? []
      // A) [{ restaurant: string, count: number }]
      if (raw.length > 0 && typeof raw[0]?.restaurant === "string" && "count" in raw[0]) {
        const out: RestaurantStamp[] = raw.map((r: any) => {
          const name = String(r.restaurant)
          const rid = stringHash(name)
          const cnt = Number(r.count ?? 0)
          return { restaurantId: rid, restaurantName: name, totalStamps: Math.max(0, cnt), maxStamps: 5 }
        })
        setStamps(out)
      } else {
        // B) (fallback) 개별 스탬프 배열 → 미사용 합산
        const counter = new Map<number, { name: string; count: number }>()
        for (const r of raw as any[]) {
          const rid = Number(r?.restaurant_id ?? r?.restaurantId ?? 0)
          const usedAt = r?.used_at ?? r?.usedAt
          if (usedAt) continue
          const name = typeof r?.restaurant === "string" ? r.restaurant : r?.restaurant?.name ?? (rid ? `식당 ${rid}` : "알 수 없음")
          const key = Number.isFinite(rid) && rid > 0 ? rid : stringHash(name)
          const prev = counter.get(key)
          if (prev) prev.count += 1
          else counter.set(key, { name, count: 1 })
        }
        const out: RestaurantStamp[] = Array.from(counter.entries()).map(([rid, { name, count }]) => ({
          restaurantId: rid, restaurantName: name, totalStamps: count, maxStamps: 5,
        }))
        setStamps(out)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load stamps")
      setStamps([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  return { stamps, loading, error, refetch }
}

const useUserStampHistory = () => {
  const [items, setItems] = useState<StampHistoryVM[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.getMyStampHistory()
      if (!res?.success) throw new Error(res?.error || "failed")
      const rows = Array.isArray(res.data) ? res.data : []

      const mapped: StampHistoryVM[] = rows.map((r: any): StampHistoryVM => {
        const ridRaw = Number(r?.restaurant_id ?? r?.restaurantId ?? 0)
        const rname = typeof r?.restaurant === "string"
          ? r.restaurant
          : r?.restaurant?.name ?? (ridRaw ? `식당 ${ridRaw}` : "식당 정보 없음")

        const rid = Number.isFinite(ridRaw) && ridRaw > 0 ? ridRaw : stringHash(String(rname ?? ""))
        const isUse: boolean = Boolean(r?.used_at ?? r?.expiredAt ?? r?.stamp_reward_id)

        return {
          id: r?.id ?? crypto.getRandomValues(new Uint32Array(2)).join("-"),
          restaurantId: rid,
          restaurantName: String(rname ?? ""),
          type: (isUse ? "use" : "earn"),
          count: Number(r?.count ?? 1),
          created_at: r?.created_at ?? r?.createdAt ?? null,
        }
      })

      mapped.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      setItems(mapped)
    } catch (e) {
      setItems([])
      setError(e instanceof Error ? e.message : "failed to load history")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])
  return { items, loading, error, refetch }
}

/* ─────────────────────────────────────────────────────────
   얇은 래퍼: 로그인 여부만 보고 분기
────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const me = useUserStore((s) => s.user)
  return me ? <LoggedInProfileView /> : <LoginGate />
}

function LoginGate() {
  const router = useRouter()
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

/* ─────────────────────────────────────────────────────────
   본 뷰
────────────────────────────────────────────────────────── */
function LoggedInProfileView() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>("스탬프")
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER)

  // ✅ 스토어 사용자
  const me = useUserStore((s) => s.user) as { id?: number; userId?: number; nickname?: string; email?: string; created_at?: string | null; profile?: string | null }

  // ✅ 데이터 훅들
  const { data: favorites, loading: favoritesLoading, isUsingFallback: favoritesFallback } = useFavorites()
  const { data: reviews, loading: reviewsLoading, isUsingFallback: reviewsFallback } = useUserReviews()

  const { stamps: restaurantStamps, loading: stampsLoading, error: stampsError, refetch: refetchStamps } = useUserStampsData()
  const { items: stampHistory, loading: historyLoading, error: historyError, refetch: refetchHistory } = useUserStampHistory()

  const isLoading = favoritesLoading || reviewsLoading || stampsLoading || historyLoading

  // 즐겨찾기/리뷰 상태
  type ValidFavorite = FavoriteItem & { restaurant_id: number; restaurant: RestaurantLite }
  const [favList, setFavList] = useState<ValidFavorite[]>([])
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [reviewList, setReviewList] = useState<ReviewVM[]>([])
  const [deletingId, setDeletingId] = useState<number | string | null>(null)

  // 내 식당(사업자) 목록 (간단 노출)
  type OwnerRestaurant = { id: number; name: string; category?: string | null; address?: string | null; telephone?: string | null; rating?: number; reviewCount?: number }
  const [ownerRestaurants, setOwnerRestaurants] = useState<OwnerRestaurant[]>([])

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const res = await apiClient.getBusinessRestaurants()
        if (!res.success) throw new Error(res.error || "목록 로드 실패")
        const data = (res.data ?? []) as any
        const list: any[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
        const norm: OwnerRestaurant[] = list.map((r: any) => ([
          "id","name","category","address","telephone","rating","reviewCount"
        ] as const).reduce((acc,k)=>({...acc,[k]: r?.[k]}), {} as OwnerRestaurant)) as any
        if (!ignore) setOwnerRestaurants(norm)
      } catch (e) {
        console.error(e)
        if (!ignore) setOwnerRestaurants([])
      }
    })()
    return () => { ignore = true }
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제할까요?")) return
    const res = await apiClient.deleteBusinessRestaurant(id)
    if (!res.success) return alert(res.error || "삭제 실패")
    setOwnerRestaurants((prev) => prev.filter((r) => r.id !== id))
  }

  const ownerStats = useMemo(() => {
    const totalReceivedReviews = ownerRestaurants.reduce((s, r) => s + (r.reviewCount || 0), 0)
    const avgOwnerRating = ownerRestaurants.length > 0
      ? ownerRestaurants.reduce((s, r) => s + (r.rating || 0), 0) / ownerRestaurants.length
      : 0
    const totalFavorites = ownerRestaurants.length * 156 // 대략값(예시)
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
      comment: String(r?.content ?? r?.comment ?? ""),
      created_at: r?.createdAt ?? r?.created_at ?? null,
    }))
    setReviewList(base)
  }, [reviews])

  const handleDeleteReview = async (id: number | string) => {
    if (!confirm("이 리뷰를 삭제할까요?")) return
    setDeletingId(id)
    const prev = reviewList
    setReviewList((list) => list.filter((r) => r.id !== id))
    try {
      const res = await apiClient.deleteReview(Number(id))
      if (!res.success) throw new Error(res.error || "삭제 실패")
    } catch (e) {
      setReviewList(prev)
      alert("리뷰 삭제에 실패했습니다.")
      console.error(e)
    } finally {
      setDeletingId(null)
    }
  }

  const avgRating = useMemo(() => {
    const total = reviewList.length
    if (total === 0) return 0
    const sum = reviewList.reduce((acc, r) => acc + (Number(r.waste_rating) || 0), 0)
    return Math.max(0, Math.min(5, Math.round((sum / total) * 10) / 10))
  }, [reviewList])

  // FE 뱃지 계산
  const badgeStats = useMemo(() => {
    const totalReviews = reviewList.length
    const uniqueRestaurants = new Set(reviewList.map((r) => r.restaurant?.id).filter(Boolean)).size
    return { totalReviews, uniqueRestaurants }
  }, [reviewList])

  const badgeRules = useMemo(() => ([
    { id: "good_customer_lv1", name: "착한 손님 Lv.1", icon: "🥢", description: "누적 리뷰 10개",  progress: badgeStats.totalReviews,     target: 10 },
    { id: "good_customer_lv2", name: "착한 손님 Lv.2", icon: "🍴", description: "누적 리뷰 30개",  progress: badgeStats.totalReviews,     target: 30 },
    { id: "good_customer_lv3", name: "착한 손님 Lv.3", icon: "🍃", description: "누적 리뷰 50개",  progress: badgeStats.totalReviews,     target: 50 },
    { id: "food_explorer_lv1", name: "다양한 미식가 Lv.1", icon: "🌮", description: "서로 다른 식당 5곳 리뷰",  progress: badgeStats.uniqueRestaurants, target: 5 },
    { id: "food_explorer_lv2", name: "다양한 미식가 Lv.2", icon: "🍜", description: "서로 다른 식당 10곳 리뷰", progress: badgeStats.uniqueRestaurants, target: 10 },
    { id: "food_explorer_lv3", name: "다양한 미식가 Lv.3", icon: "🍣", description: "서로 다른 식당 20곳 리뷰", progress: badgeStats.uniqueRestaurants, target: 20 },
  ]), [badgeStats])

  const earnedBadges = useMemo(() => badgeRules.filter(b => b.progress >= b.target), [badgeRules])
  const inProgressBadges = useMemo(() => badgeRules.filter(b => b.progress < b.target), [badgeRules])
  const earnedBadgesCount = earnedBadges.length

  const handleRoleSwitch = () => {
    if (userRole === UserRole.USER) { setUserRole(UserRole.OWNER); setActiveTab("restaurant") }
    else { setUserRole(UserRole.USER); setActiveTab("리뷰") }
  }

  // ───────────── 스탬프(개수) 사용/페이징 로직 ─────────────
  const [pageByRestaurant, setPageByRestaurant] = useState<Record<number, number>>({})
  const getCurrentPage = (rid: number) => pageByRestaurant[rid] ?? 1
  const setPage = (rid: number, page: number) =>
    setPageByRestaurant((p) => ({ ...p, [rid]: Math.max(1, page) }))

  // ✅ "사용하기" 다이얼로그 상태 (BE 세션 코드 기반)
  type StampDialogState =
    | { open: false }
    | {
        open: true
        step: "choose" | "qr"
        restaurant: RestaurantStamp
        maxUsable: number
        count: number
        generating: boolean
        code?: string           // BE가 발급한 세션 코드
        condition?: number      // 사용 조건(=사용 개수)
        expiresAt?: number      // (선택) 타이머용
        remainSec?: number
      }

  const [stampDialog, setStampDialog] = useState<StampDialogState>({ open: false })

  const openUseDialog = (s: RestaurantStamp) => {
    const avail = s.totalStamps
    const maxUsable = Math.min(10, avail)
    if (avail < 3) {
      alert("스탬프가 3개 이상일 때만 사용할 수 있어요.")
      return
    }
    setStampDialog({
      open: true,
      step: "choose",
      restaurant: s,
      maxUsable,
      count: Math.min(3, maxUsable),
      generating: false,
    })
  }

  // ✅ BE 스펙: POST /stamps/me/use { restaurantId, condition } → { code }
  const createUseSession = async (restaurantId: number, condition: number) => {
    const base = process.env.NEXT_PUBLIC_API_URL || "/_be"
    const res = await fetch(`${base}/stamps/me/use`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ restaurantId, condition }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      // BE는 throw 시 error.message를 내려줘. 여기서 그대로 표출
      throw new Error(txt || `HTTP ${res.status}`)
    }
    const json = await res.json().catch(() => ({}))
    // { resultType: "SUCCESS", success: { code: "uuid..." } } 형태 지원
    const code = json?.success?.code ?? json?.code
    if (!code) throw new Error("세션 코드 발급 실패")
    return String(code)
  }

  async function generateUseQR(restaurant: RestaurantStamp, count: number) {
    try {
      setStampDialog((s) => ({ ...(s as any), generating: true }))
      const code = await createUseSession(restaurant.restaurantId, count)

      // QR은 "사장님 단말이 이 code를 읽어서 /biz/stamps/use 로 사용 완료" 하는 흐름
      // 유효시간은 백엔드에서 관리(여기서는 안내용 타이머만)
      const expiresAt = Date.now() + 2 * 60 * 1000

      setStampDialog({
        open: true,
        step: "qr",
        restaurant,
        maxUsable: Math.min(10, restaurant.totalStamps),
        count,
        generating: false,
        code,
        condition: count,
        expiresAt,
        remainSec: Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)),
      })
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : "QR 생성(세션 발급)에 실패했어요.")
      setStampDialog((s) => ({ ...(s as any), generating: false }))
    }
  }

  // 남은 시간 타이머
  useEffect(() => {
    if (!(stampDialog.open && stampDialog.step === "qr" && stampDialog.expiresAt)) return
    const tick = () => {
      setStampDialog((s) => {
        if (!(s.open && s.step === "qr" && s.expiresAt)) return s
        const remain = Math.max(0, Math.ceil((s.expiresAt - Date.now()) / 1000))
        return { ...s, remainSec: remain }
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [stampDialog.open, (stampDialog as any).step, (stampDialog as any).expiresAt])

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

  // ✅ 아바타 이미지 URL
  const [avatarSrc, setAvatarSrc] = useState<string>("/placeholder.svg")
  useEffect(() => {
    let ignore = false
    ;(async () => {
      const raw = (me as any)?.profile ?? (me as any)?.profileImage
      if (!raw) { setAvatarSrc("/placeholder.svg"); return }
      if (/^https?:\/\//i.test(raw)) { if (!ignore) setAvatarSrc(raw); return }
      const signed = await apiClient.getImageSignedUrl(0, raw).catch(() => "")
      const fallback = apiClient.getImageUrlByType(0, raw)
      if (!ignore) setAvatarSrc(signed || fallback)
    })()
    return () => { ignore = true }
  }, [me])

  const showFallbackWarning = favoritesFallback || reviewsFallback

  const [historyOpen, setHistoryOpen] = useState(false)

  /* ─────────────────────────────────────────────────────────
     렌더
  ────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50 pt/[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
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
                    <AvatarImage src={avatarSrc} alt={me?.nickname || "user"} />
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
                    {me?.nickname}
                  </motion.h2>
                  <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="text-gray-600 dark:text-gray-300 mb-1 truncate">
                    {me?.email}
                  </motion.p>
                  {me?.created_at && (
                    <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="text-xs text-gray-500 dark:text-gray-400">
                      가입일: {formatDate(me.created_at ?? "")}
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

              {/* 요약 카드들 */}
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
                    <motion.div whileHover={{ scale: 1.03 }} className="text-center p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl border border-purple-200/30">
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

              {(showFallbackWarning || stampsError) && (
                <div className="mt-4 text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ 일부 데이터는 임시 값 또는 로딩 오류가 있을 수 있어요.
                </div>
              )}
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
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteReview(review.id)}
                                    disabled={deletingId === review.id}
                                    className="gap-2"
                                    title="리뷰 삭제"
                                  >
                                    {deletingId === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    삭제
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
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                          <StampIcon className="h-5 w-5 text-purple-500" />
                          내 스탬프 ({restaurantStamps.length})
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setHistoryOpen(true)}
                            className="border-purple-400 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          >
                            사용/적립 내역 보기
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { refetchStamps(); refetchHistory() }}>
                            새로고침
                          </Button>
                        </div>
                      </div>
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
                              const totalPages = Math.max(1, Math.ceil(stamp.totalStamps / stamp.maxStamps))
                              const curPage = getCurrentPage(rid)
                              const startIdx = (curPage - 1) * stamp.maxStamps
                              const filledOnThisPage = Math.max(0, Math.min(stamp.maxStamps, stamp.totalStamps - startIdx))
                              const extraBeyondFirst = Math.max(0, stamp.totalStamps - stamp.maxStamps)

                              return (
                                <motion.div
                                  key={rid}
                                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * index }}
                                  className="relative backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-5 sm:p-6 hover:shadow-lg transition-all duration-300"
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
                                        <StampIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                                      </div>
                                    ))}
                                  </div>

                                  <div className="text-center w-full mx-auto">
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                      4점 이상 리뷰 {stamp.totalStamps}개 보유
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
                                      {stamp.totalStamps >= 3 ? (
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

                                    {/* 오른쪽: 힌트 */}
                                    <div className="order-3 sm:order-3 text-center sm:text-right">
                                      <div className="text-xs text-gray-600 dark:text-gray-300">사장님이 QR 스캔 후 사용 처리</div>
                                    </div>
                                  </div>
                                </motion.div>
                              )
                            })
                          ) : (
                            <div className="text-center text-gray-500 py-12">
                              <StampIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
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
                    {/* 획득한 뱃지 */}
                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                          <Award className="h-5 w-5 text-orange-500" />
                          획득한 뱃지 ({earnedBadges.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6">
                        {earnedBadges.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">아직 획득한 뱃지가 없습니다.</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {earnedBadges.map((badge, idx) => (
                              <motion.div
                                key={badge.id}
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * idx }}
                                whileHover={{ scale: 1.03 }}
                                className="p-4 bg-green-500/10 backdrop-blur-sm border border-green-200/40 rounded-2xl text-center"
                              >
                                <div className="text-3xl mb-2">{badge.icon}</div>
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{badge.name}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{badge.description}</p>
                                <div className="mt-3">
                                  <Progress value={100} className="h-2" />
                                  <p className="text-xs mt-1 text-gray-500">{badge.target}/{badge.target}</p>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* 진행 중인 뱃지 */}
                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                          <Users className="h-5 w-5 text-gray-500" />
                          진행 중인 뱃지 ({inProgressBadges.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6">
                        {inProgressBadges.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">진행 중인 뱃지가 없습니다.</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {inProgressBadges.map((badge, index) => {
                              const pct = Math.min(100, Math.round((badge.progress / badge.target) * 100))
                              return (
                                <motion.div
                                  key={badge.id}
                                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * index }}
                                  whileHover={{ scale: 1.03 }}
                                  className="p-4 bg-gray-500/10 backdrop-blur-sm border border-gray-200/30 rounded-2xl text-center"
                                >
                                  <div className="text-3xl mb-2 opacity-80">{badge.icon}</div>
                                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{badge.name}</h3>
                                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{badge.description}</p>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span>진행률</span>
                                      <span>{badge.progress}/{badge.target}</span>
                                    </div>
                                    <Progress value={pct} className="h-2" />
                                  </div>
                                </motion.div>
                              )
                            })}
                          </div>
                        )}
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
                                    {typeof r.rating === "number" && (
                                      <div className="flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-current text-green-500" />
                                        <span>{r.rating.toFixed(1)}</span>
                                      </div>
                                    )}
                                    {typeof r.reviewCount === "number" && <span>리뷰 {r.reviewCount}개</span>}
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
                          {[{ id: "good_owner", name: "친절한 사장님", icon: "🧡", description: "리뷰 50개 이상, 평균 4.5+", progress: 24, target: 50 },
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
      <Dialog open={(stampDialog as any).open} onOpenChange={(open) => setStampDialog(open ? stampDialog : { open: false })}>
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
                    value={stampDialog.code || ""}
                    size={220}
                    includeMargin
                  />
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
                  onClick={() => { setStampDialog({ open: false }); refetchStamps(); refetchHistory() }}
                  className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                >
                  새로고침
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ───────── 스탬프 사용/적립 내역 ───────── */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>스탬프 사용/적립 내역</DialogTitle>
            <DialogDescription>최신순으로 표시합니다.</DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : historyError ? (
            <div className="text-center text-red-500 py-6 text-sm">{historyError}</div>
          ) : (
            <div className="max-h-[60vh] overflow-auto space-y-2">
              {stampHistory.length === 0 ? (
                <div className="text-center text-gray-500 py-8">내역이 없습니다.</div>
              ) : (
                stampHistory.map((h) => (
                  <div key={String(h.id)} className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-white/60 dark:bg-gray-800/60">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{h.restaurantName}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">{h.type === "use" ? "사용" : "적립"} • {h.count}개</div>
                    </div>
                    <div className="text-xs text-gray-500 flex-shrink-0">{h.created_at ? formatDate(h.created_at) : "-"}</div>
                  </div>
                ))
              )}
            </div>
          )}

          <DialogFooter className="flex justify-end">
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 전역 로딩 오버레이 (선택) */}
      {isLoading && (
        <div className="fixed bottom-4 right-4 pointer-events-none">
          <div className="px-3 py-2 rounded-lg bg-white/90 shadow border text-sm text-gray-600">
            로딩 중…
          </div>
        </div>
      )}
    </div>
  )
}
