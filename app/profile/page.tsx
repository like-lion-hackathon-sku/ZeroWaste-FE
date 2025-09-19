"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  User,
  Star,
  Heart,
  Award,
  Users,
  Edit,
  Loader2,
  Trash2,
  MapPin,
  Phone,
  Leaf,
  Store,
  UserCheck,
  Plus,
  Stamp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  useUserProfile,
  useUserBadges,
  useFavorites,
  useUserReviews,
} from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"

// ────────────────────────────────────────────────────────────
// 로컬 타입/유틸
// ────────────────────────────────────────────────────────────
type UserRole = "USER" | "OWNER"
type TabKey = "리뷰" | "즐겨찾기" | "스탬프" | "뱃지" | "restaurant" | "reviews"

const toArray = <T,>(v: any): T[] =>
  Array.isArray(v) ? v : (v?.items ?? v?.success?.items ?? [])

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────
type RestaurantLite = {
  id: number
  name: string
  category?: string | null
  address?: string | null
  telephone?: string | null
}

type FavoriteItem = {
  id?: number
  restaurant_id: number | null
  restaurant?: RestaurantLite
  name?: string
  category?: string | null
  restaurantId?: number
  address?: string | null
  telephone?: string | null
}

type ReviewVM = {
  id: number | string
  restaurant?: { id: number; name: string; category?: string | null }
  waste_rating: number
  comment: string
  created_at?: string | null
}

type OwnerRestaurant = {
  id: number
  name: string
  category?: string | null
  address?: string | null
  telephone?: string | null
  rating?: number
  reviewCount?: number
}

type RestaurantStamp = {
  restaurantId: number
  restaurantName: string
  totalStamps: number   // 서버 기준 총 스탬프 수
  maxStamps: number     // 한 권 완성에 필요한 개수(예: 5)
}

// ────────────────────────────────────────────────────────────
// 로컬 훅: 스탬프(서버 직접 조회)
// ────────────────────────────────────────────────────────────
const useUserStampsData = () => {
  const [stamps, setStamps] = useState<RestaurantStamp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUsingFallback, setIsUsingFallback] = useState(false)

  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const res = await apiClient.getUserStamps()
        if (!res.success) {
          if (!ignore) {
            setError(res.error || "스탬프 조회 실패")
            setIsUsingFallback(true)
            setLoading(false)
          }
          return
        }
        const raw = toArray<any>(res.data)
        const mapped: RestaurantStamp[] = raw.map((stamp: any) => ({
          restaurantId: stamp?.restaurant?.id ?? stamp?.id,
          restaurantName: stamp?.restaurant?.name ?? `식당 ${stamp?.restaurant?.id ?? stamp?.id}`,
          totalStamps: stamp?.stamps?.length ?? 0,
          maxStamps: 5,
        }))
        if (!ignore) setStamps(mapped)
      } catch (e: any) {
        if (!ignore) setError(e?.message || "스탬프 조회 실패")
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => { ignore = true }
  }, [])

  return { stamps, loading, error, isUsingFallback }
}

// ────────────────────────────────────────────────────────────
// 컴포넌트
// ────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>("스탬프")
  const [userRole, setUserRole] = useState<UserRole>("USER")

  const {
    data: profile,
    loading: profileLoading,
    error: userError,
    isUsingFallback: profileFallback,
  } = useUserProfile()
  const { data: badges, loading: badgesLoading, isUsingFallback: badgesFallback } = useUserBadges()
  const { data: favorites, loading: favoritesLoading, isUsingFallback: favoritesFallback } = useFavorites()
  const { data: reviews, loading: reviewsLoading, isUsingFallback: reviewsFallback } = useUserReviews()
  const { stamps: restaurantStamps, loading: stampsLoading, isUsingFallback: stampsFallback } = useUserStampsData()

  // 로딩/에러
  const isLoading = profileLoading || badgesLoading || favoritesLoading || reviewsLoading || stampsLoading
  const hasError = userError

  // 즐겨찾기
  type ValidFavorite = FavoriteItem & { restaurant_id: number; restaurant: RestaurantLite }
  const [favList, setFavList] = useState<ValidFavorite[]>([])
  const [removingId, setRemovingId] = useState<number | null>(null)

  // 리뷰
  const [reviewList, setReviewList] = useState<ReviewVM[]>([])

  // ── 사장님 목업
  const [ownerRestaurants] = useState<OwnerRestaurant[]>([
    {
      id: 1,
      name: "그린 비스트로",
      category: "양식",
      address: "서울시 강남구 테헤란로 123",
      telephone: "02-1234-5678",
      rating: 4.7,
      reviewCount: 24,
    },
  ])
  const ownerStats = useMemo(() => {
    const totalReceivedReviews = ownerRestaurants.reduce((sum, r) => sum + (r.reviewCount || 0), 0)
    const avgOwnerRating =
      ownerRestaurants.length > 0
        ? ownerRestaurants.reduce((sum, r) => sum + (r.rating || 0), 0) / ownerRestaurants.length
        : 0
    const totalFavorites = ownerRestaurants.length * 156 // 목업
    return {
      totalRestaurants: ownerRestaurants.length,
      totalReceivedReviews,
      avgOwnerRating: Math.round(avgOwnerRating * 10) / 10,
      totalFavorites,
    }
  }, [ownerRestaurants])

  /* ──────────────────────────────────────────────────────────
     즐겨찾기 정규화
  ─────────────────────────────────────────────────────────── */
  function toFavoriteItem(f: any): FavoriteItem {
    const restaurant_id = f?.restaurant_id ?? f?.restaurantId ?? f?.restaurant?.id ?? null
    const restaurant: RestaurantLite | undefined =
      f?.restaurant ??
      (f?.name
        ? {
            id: restaurant_id as number,
            name: f.name,
            category: f.category ?? null,
            address: f.address ?? null,
            telephone: f.telephone ?? null,
          }
        : undefined)
    return { id: f?.id, restaurant_id, restaurant }
  }

  useEffect(() => {
    const raw = toArray<any>(favorites)
    const isValid = (x: FavoriteItem): x is ValidFavorite => !!x.restaurant_id && !!x.restaurant
    setFavList(raw.map(toFavoriteItem).filter(isValid))
  }, [favorites])

  /* ──────────────────────────────────────────────────────────
     리뷰 정규화 + 식당명 패치
  ─────────────────────────────────────────────────────────── */
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

    const needIds = Array.from(
      new Set(
        base
          .filter((v) => v.restaurant && (!v.restaurant.name || v.restaurant.name === "식당 정보 없음"))
          .map((v) => v.restaurant!.id)
          .filter((id): id is number => Number.isFinite(id)),
      ),
    )
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

  // 평균 별점
  const avgRating = useMemo(() => {
    const total = reviewList.length
    if (total === 0) return 0
    const sum = reviewList.reduce((acc, r) => acc + (Number(r.waste_rating) || 0), 0)
    return Math.max(0, Math.min(5, Math.round((sum / total) * 10) / 10))
  }, [reviewList])

  const handleRoleSwitch = () => {
    if (userRole === "USER") {
      setUserRole("OWNER")
      setActiveTab("restaurant")
    } else {
      setUserRole("USER")
      setActiveTab("reviews")
    }
  }

  const handleRestaurantClick = (restaurantId: number) => router.push(`/restaurant/${restaurantId}`)
  const handleEditProfile = () => router.push("/profile/edit")

  const handleRemoveFavorite = async (restaurantId: number) => {
    if (removingId) return
    setRemovingId(restaurantId)
    const prev = favList
    setFavList((list) => list.filter((f) => f.restaurant_id !== restaurantId))
    try {
      const res = await apiClient.removeFavorite(restaurantId)
      if (!res.success) throw new Error(res.error || "즐겨찾기 삭제 실패")
    } catch (e) {
      setFavList(prev)
      alert("즐겨찾기 삭제에 실패했습니다.")
      console.error(e)
    } finally {
      setRemovingId(null)
    }
  }

  /* ──────────────────────────────────────────────────────────
     스탬프: 식당별 페이지네이션 & 사용 상태
  ─────────────────────────────────────────────────────────── */
  // 식당별 현재 페이지(1-base)
  const [pageByRestaurant, setPageByRestaurant] = useState<Record<number, number>>({})
  // 식당별 사용(교환) 횟수. 1회 = maxStamps개 사용
  const [usedBooksByRestaurant, setUsedBooksByRestaurant] = useState<Record<number, number>>({})

  // 남은 스탬프(사용 반영)
  const getAvailable = (stamp: RestaurantStamp) => {
    const usedBooks = usedBooksByRestaurant[stamp.restaurantId] ?? 0
    const usedStamps = usedBooks * stamp.maxStamps
    return Math.max(0, stamp.totalStamps - usedStamps)
  }
  const getCurrentPage = (rid: number) => pageByRestaurant[rid] ?? 1
  const setPage = (rid: number, page: number) =>
    setPageByRestaurant((prev) => ({ ...prev, [rid]: page }))
  const getTotalPages = (stamp: RestaurantStamp) => {
    const avail = getAvailable(stamp)
    return Math.max(1, Math.ceil(avail / stamp.maxStamps))
  }

  const handleUseStamps = (stamp: RestaurantStamp) => {
    const avail = getAvailable(stamp)
    if (avail < stamp.maxStamps) return
    // 로컬 사용 증가
    setUsedBooksByRestaurant((prev) => {
      const cur = prev[stamp.restaurantId] ?? 0
      return { ...prev, [stamp.restaurantId]: cur + 1 }
    })
    // 사용 후 페이지 보정
    setPageByRestaurant((prev) => {
      const next = { ...prev }
      const rid = stamp.restaurantId
      const afterAvail = avail - stamp.maxStamps
      const totalPagesAfter = Math.max(1, Math.ceil(afterAvail / stamp.maxStamps))
      const curPage = next[rid] ?? 1
      if (curPage > totalPagesAfter) next[rid] = totalPagesAfter
      return next
    })

    // TODO: 서버와 동기화 필요 시 실제 사용 API 호출
    // await apiClient.useStamp(restaurantId, code)
  }

  // 로딩/에러 뷰
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">프로필 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (hasError || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="text-red-500 mb-4">프로필 정보를 불러올 수 없습니다</div>
          <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-green-500 to-emerald-600">
            다시 시도
          </Button>
        </motion.div>
      </div>
    )
  }

  // profile 안전 접근
  const p = profile as {
    nickname?: string
    email?: string
    created_at?: string | null
    profile?: string | null
  }

  const showFallbackWarning =
    profileFallback || badgesFallback || favoritesFallback || reviewsFallback || stampsFallback

  return (
    <div className="min-h-screen bg-gray-50">
      {showFallbackWarning && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">연결되면 실제 데이터가 표시됩니다. 현재는 목업 데이터를 사용 중입니다.</p>
            </div>
          </div>
        </div>
      )}

      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-white/20 p-4 sticky top-0 z-10"
      >
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="hover:bg-white/20">
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="font-bold text-xl bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
            프로필
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleEditProfile} className="hover:bg-white/20">
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* 프로필 카드 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="mb-6 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 200 }}>
                  <Avatar className="h-20 w-20 ring-4 ring-green-500/20">
                    <AvatarImage src={p.profile || "/placeholder.svg"} alt={p.nickname} />
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                </motion.div>

                <div className="flex-1">
                  <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-1"
                  >
                    {p.nickname}
                  </motion.h2>
                  <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="text-gray-600 dark:text-gray-300 mb-2">
                    {p.email}
                  </motion.p>
                  <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="text-sm text-gray-500 dark:text-gray-400">
                    가입일: {formatDate(p.created_at ?? "")}
                  </motion.p>
                </div>

                {userRole === "OWNER" && (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">사장님</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">인증됨</div>
                    </div>
                  </motion.div>
                )}

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
                  <Button
                    onClick={handleRoleSwitch}
                    variant={userRole === "OWNER" ? "default" : "outline"}
                    className={`${userRole === "OWNER"
                      ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                      : "border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"} transition-all duration-300`}
                  >
                    {userRole === "USER" ? (
                      <>
                        <Store className="h-4 w-4 mr-2" />
                        사장 전환
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-2" />
                        사용자 전환
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {userRole === "USER" ? (
                  <>
                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-2xl border border-green-200/30">
                      <div className="text-2xl font-bold text-green-600 mb-1">{reviewList.length}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">총 리뷰</div>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-4 bg-gradient-to-br from-sky-500/10 to-blue-500/10 backdrop-blur-sm rounded-2xl border border-sky-200/30">
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

                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-4 bg-gradient-to-br from-red-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl border border-red-200/30">
                      <div className="text-2xl font-bold text-red-500 mb-1">{favList.length}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">즐겨찾기</div>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-4 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 backdrop-blur-sm rounded-2xl border border-orange-200/30">
                      <div className="text-2xl font-bold text-orange-600 mb-1">{toArray<any>(badges).filter((b) => !!(b?.badge ?? b?.name)).length}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">획득 뱃지</div>
                    </motion.div>
                  </>
                ) : (
                  <>
                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-4 bg-gradient-to-br from-blue-500/10 to-sky-500/10 backdrop-blur-sm rounded-2xl border border-blue-200/30">
                      <div className="text-2xl font-bold text-blue-600 mb-1">{ownerStats.totalReceivedReviews}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">받은 리뷰</div>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-2xl border border-green-200/30">
                      <div className="text-2xl font-bold text-green-600 mb-1">{ownerStats.avgOwnerRating}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">평균 별점</div>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl border border-purple-200/30">
                      <div className="text-2xl font-bold text-purple-600 mb-1">{ownerStats.totalFavorites}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">받은 즐겨찾기</div>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-4 bg-gradient-to-br from-gray-500/10 to-slate-500/10 backdrop-blur-sm rounded-2xl border border-gray-200/30">
                      <div className="text-2xl font-bold text-gray-600 mb-1">4.2</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">서비스 점수</div>
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
            <TabsList className={`grid w-full ${userRole === "USER" ? "grid-cols-4" : "grid-cols-2"} backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 h-12`}>
              {userRole === "USER" ? (
                <>
                  <TabsTrigger value="리뷰" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400">
                    리뷰
                  </TabsTrigger>
                  <TabsTrigger value="즐겨찾기" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-400">
                    즐겨찾기
                  </TabsTrigger>
                  <TabsTrigger value="스탬프" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400">
                    스탬프
                  </TabsTrigger>
                  <TabsTrigger value="뱃지" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-400">
                    뱃지
                  </TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="restaurant" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-400">
                    내 식당 ({ownerStats.totalRestaurants})
                  </TabsTrigger>
                  <TabsTrigger value="reviews" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400">
                    받은 리뷰
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {/* USER 탭들 */}
            {userRole === "USER" && (
              <>
                {/* 리뷰 */}
                <TabsContent value="리뷰" className="mt-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-green-500" />
                          작성한 리뷰 ({reviewList.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {reviewList.length > 0 ? (
                            reviewList.map((review: ReviewVM, index: number) => (
                              <motion.div
                                key={review.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * index }}
                                className="backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-4 hover:shadow-lg transition-all duration-300"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                                      {review.restaurant?.name || "식당 정보 없음"}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                                      <div className="flex items-center gap-1">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                          <Star
                                            key={i}
                                            className={`h-3 w-3 ${i < Math.round(review.waste_rating || 0) ? "fill-current text-green-500" : "text-gray-300"}`}
                                          />
                                        ))}
                                        <span>{review.waste_rating.toFixed(1)}</span>
                                      </div>
                                      <span>{review.restaurant?.category || "카테고리 없음"}</span>
                                    </div>
                                  </div>
                                  <span className="text-sm text-gray-500">
                                    {review.created_at ? formatDate(review.created_at) : "날짜 없음"}
                                  </span>
                                </div>

                                <p className="text-gray-700 dark:text-gray-300 mb-3">{review.comment || "댓글 없음"}</p>

                                <div className="flex justify-end">
                                  <Button variant="outline" size="sm" onClick={() => router.push(`/review/edit/${review.id}`)} className="bg-white/50 hover:bg-white/80 border-white/30">
                                    수정
                                  </Button>
                                </div>
                              </motion.div>
                            ))
                          ) : (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center text-gray-500 py-12">
                              <Star className="h-16 w-16 mx-auto mb-4 opacity-30" />
                              <h3 className="text-lg font-medium mb-2">작성한 리뷰가 없습니다</h3>
                              <p>첫 번째 리뷰를 작성해보세요</p>
                            </motion.div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                {/* 즐겨찾기 */}
                <TabsContent value="즐겨찾기" className="mt-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Heart className="h-5 w-5 text-red-500" />
                          즐겨찾기 식당 ({favList.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {favList.length > 0 ? (
                            favList.map((favorite, index) =>
                              favorite.restaurant ? (
                                <motion.div
                                  key={`${favorite.restaurant_id}-${favorite.id ?? "row"}`}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.05 * index }}
                                  className="relative backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-4 hover:shadow-lg transition-all duration-300 cursor-pointer"
                                  onClick={() => handleRestaurantClick(favorite.restaurant!.id)}
                                >
                                  <div className="absolute right-3 top-3">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="gap-2 bg-red-500/90 hover:bg-red-600"
                                      onClick={() => handleRemoveFavorite(favorite.restaurant_id)}
                                      disabled={removingId === favorite.restaurant_id}
                                      title="즐겨찾기 삭제"
                                    >
                                      {removingId === favorite.restaurant_id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          삭제 중…
                                        </>
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>

                                  <div role="button" tabIndex={0}>
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                                      {favorite.restaurant.name}
                                    </h3>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300 mb-2">
                                      <span className="inline-flex items-center gap-1">
                                        <Leaf className="h-3.5 w-3.5 text-green-500" />
                                        잔반
                                      </span>
                                      <span>{favorite.restaurant.category || "카테고리 없음"}</span>
                                    </div>

                                    {favorite.restaurant.address && (
                                      <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                                        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                                        <span className="leading-5">{favorite.restaurant.address}</span>
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
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center text-gray-500 py-12">
                              <Heart className="h-16 w-16 mx-auto mb-4 opacity-30" />
                              <h3 className="text-lg font-medium mb-2">즐겨찾기한 식당이 없습니다</h3>
                              <p>마음에 드는 식당을 즐겨찾기에 추가해보세요</p>
                            </motion.div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                {/* 스탬프 */}
                <TabsContent value="스탬프" className="mt-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Stamp className="h-5 w-5 text-purple-500" />
                          내 스탬프 ({restaurantStamps.length})
                        </CardTitle>
                      </CardHeader>

                      <CardContent>
                        {stampsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
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
                                const overflowFirstPage = Math.max(0, avail - stamp.maxStamps)
                                const usedBooks = usedBooksByRestaurant[rid] ?? 0

                                return (
                                  <motion.div
                                    key={rid}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 * index }}
                                    className="relative backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-6 hover:shadow-lg transition-all duration-300"
                                  >
                                    {/* 오른쪽 위: 남은/권당 */}
                                    <div className="absolute right-6 top-6 text-sm text-gray-600 dark:text-gray-300">
                                      {avail}/{stamp.maxStamps} 스탬프
                                    </div>

                                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-4">{stamp.restaurantName}</h3>

                                    {/* 현재 페이지의 스탬프 슬롯 */}
                                    <div className="flex items-center justify-center gap-2 mb-3">
                                      {Array.from({ length: stamp.maxStamps }).map((_, i) => (
                                        <motion.div
                                          key={i}
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          transition={{ delay: 0.06 * i }}
                                          className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                                            i < filledOnThisPage
                                              ? "bg-gradient-to-br from-purple-500 to-pink-500 border-purple-400 text-white shadow-lg"
                                              : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400"
                                          }`}
                                        >
                                          <Stamp className="h-6 w-6" />
                                        </motion.div>
                                      ))}
                                    </div>

                                    <div className="text-center">
                                      <p className="text-sm text-gray-600 dark:text-gray-300">
                                        4점 이상 리뷰 {avail}개로 획득한 스탬프(사용 반영)
                                      </p>
                                      {overflowFirstPage > 0 && curPage === 1 && (
                                        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                                          +{overflowFirstPage}개 추가 스탬프 보유
                                        </div>
                                      )}
                                    </div>

                                    {/* 하단 바: 좌 – 페이지네이션 / 중 – 사용하기 / 우 – 사용횟수 */}
                                    <div className="mt-4 flex items-center justify-between">
                                      {/* 식당별 페이지네이션 */}
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setPage(rid, Math.max(1, curPage - 1))}
                                          disabled={curPage <= 1}
                                          className="backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border-white/20 hover:bg-white/70 dark:hover:bg-gray-700/70"
                                        >
                                          <ChevronLeft className="h-4 w-4" />
                                        </Button>

                                        {Array.from({ length: totalPages }).map((_, i) => (
                                          <Button
                                            key={i}
                                            variant={curPage === i + 1 ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setPage(rid, i + 1)}
                                            className={`w-8 h-8 p-0 ${
                                              curPage === i + 1
                                                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                                : "backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border-white/20 hover:bg-white/70 dark:hover:bg-gray-700/70"
                                            }`}
                                          >
                                            {i + 1}
                                          </Button>
                                        ))}

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setPage(rid, Math.min(totalPages, curPage + 1))}
                                          disabled={curPage >= totalPages}
                                          className="backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border-white/20 hover:bg-white/70 dark:hover:bg-gray-700/70"
                                        >
                                          <ChevronRight className="h-4 w-4" />
                                        </Button>
                                      </div>

                                      {/* 가운데: 사용하기 버튼/완성 표시 */}
                                      {avail >= stamp.maxStamps ? (
                                        <div className="flex items-center gap-2">
                                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full">
                                            <Award className="h-3 w-3" />
                                            스탬프 완성!
                                          </div>
                                          <Button
                                            onClick={() => handleUseStamps(stamp)}
                                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-2 rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                                          >
                                            사용하기
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {Math.max(0, stamp.maxStamps - (avail - (curPage - 1) * stamp.maxStamps))}개 더 필요
                                        </div>
                                      )}

                                      {/* 오른쪽: 사용 횟수 */}
                                      <div className="text-right">
                                        {usedBooks > 0 && (
                                          <div className="text-xs text-gray-600 dark:text-gray-300">사용 {usedBooks}회</div>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                )
                              })
                            ) : (
                              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center text-gray-500 py-12">
                                <Stamp className="h-16 w-16 mx-auto mb-4 opacity-30" />
                                <h3 className="text-lg font-medium mb-2">스탬프가 없습니다</h3>
                                <p>4점 이상의 리뷰를 작성하면 스탬프를 받을 수 있어요</p>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                {/* 뱃지 */}
                <TabsContent value="뱃지" className="mt-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-6">
                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Award className="h-5 w-5 text-orange-500" />
                          획득한 뱃지 ({toArray<any>(badges).filter((b) => !!(b?.badge ?? b?.name)).length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>{/* 필요 시 상세 UI 추가 */}</CardContent>
                    </Card>

                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-gray-500" />
                          진행 중인 뱃지 (2)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {/* 예시 진행중 뱃지 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[
                            { id: "good_customer_3", name: "착한 손님 Lv.3", icon: "🍃", description: "누적 리뷰 50개", progress: reviewList.length || 0, target: 50 },
                            { id: "eco_influencer", name: "에코 인플루언서", icon: "📸", description: "AI 분석 사진 20장 업로드", progress: 15, target: 20 },
                          ].map((badge, index) => (
                            <motion.div
                              key={badge.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.1 * index }}
                              whileHover={{ scale: 1.05 }}
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
            {userRole === "OWNER" && (
              <>
                <TabsContent value="restaurant" className="mt-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Store className="h-5 w-5 text-orange-500" />
                            내 식당 관리
                          </CardTitle>
                          <Button onClick={() => router.push("/profile/owner-registration")} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                            <Plus className="h-4 w-4 mr-2" />
                            내 식당 추가하기
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {ownerRestaurants.length > 0 ? (
                          <div className="space-y-4">
                            {ownerRestaurants.map((restaurant, index) => (
                              <motion.div
                                key={restaurant.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * index }}
                                className="backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-4 hover:shadow-lg transition-all duration-300 cursor-pointer"
                                onClick={() => router.push(`/restaurant/${restaurant.id}?isOwnerMode=true`)}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{restaurant.name}</h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                                      <span>{restaurant.category || "카테고리 없음"}</span>
                                      {restaurant.rating && (
                                        <div className="flex items-center gap-1">
                                          <Star className="h-3 w-3 fill-current text-green-500" />
                                          <span>{restaurant.rating.toFixed(1)}</span>
                                        </div>
                                      )}
                                      {restaurant.reviewCount && <span>리뷰 {restaurant.reviewCount}개</span>}
                                    </div>
                                  </div>
                                </div>

                                {restaurant.address && (
                                  <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
                                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                                    <span className="leading-5">{restaurant.address}</span>
                                  </div>
                                )}

                                {restaurant.telephone && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                    <Phone className="h-4 w-4 text-gray-400" />
                                    <span>{restaurant.telephone}</span>
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
                  </motion.div>
                </TabsContent>

                <TabsContent value="reviews" className="mt-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-green-500" />
                          받은 리뷰 관리 ({ownerStats.totalReceivedReviews})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center text-gray-500 py-12">
                          <Star className="h-16 w-16 mx-auto mb-4 opacity-30" />
                          <h3 className="text-lg font-medium mb-2">받은 리뷰 관리 기능</h3>
                          <p>고객들의 소중한 리뷰를 확인하고 관리할 수 있습니다</p>
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
    </div>
  )
}