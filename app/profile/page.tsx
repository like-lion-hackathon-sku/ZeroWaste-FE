"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Star, Heart, Award, Users, Loader2, Trash2,
  MapPin, Phone, Leaf, QrCode, SlidersHorizontal, Filter, Search, Store, Info
} from "lucide-react"
import { useRouter } from "next/navigation"
import ProfileHeader from "@/components/profile/profileHeader"

// store & apis
import { useUserStore } from "@/lib/state/user"
import { useFavorites, useUserReviews } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"

// shared hooks/utils
import {
  toArray, toFavoriteItem, useAvatarSrc,
  type FavoriteItem, type RestaurantLite, type ReviewVM
} from "@/hooks/profile"

type TabKey = "리뷰" | "즐겨찾기" | "뱃지"

/* ─────────────── Framer helper (type-safe) ─────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay },
})

/* ─────────────── Small UI helpers ─────────────── */
function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div {...fadeUp(.05)} className={className}>
      {children}
    </motion.div>
  )
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-white/50 dark:border-white/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
    </div>
  )
}

/* ─────────────── Uniform metric card (4장 동일 규격) ─────────────── */
function MetricCard({
  tone = "green",
  className = "",
  children,
}: {
  tone?: "green" | "red" | "orange" | "blue"
  className?: string
  children: React.ReactNode
}) {
  const toneMap = {
    green: "from-emerald-500/12 to-teal-500/12 border-emerald-200/30",
    red: "from-rose-500/12 to-pink-500/12 border-rose-200/30",
    orange: "from-amber-500/12 to-yellow-500/12 border-amber-200/30",
    blue: "from-sky-500/12 to-blue-500/12 border-sky-200/30",
  } as const
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className={`h-28 sm:h-32 rounded-2xl border shadow-sm bg-gradient-to-br backdrop-blur-md p-4 ${toneMap[tone]} ${className}`}
    >
      <div className="w-full h-full flex items-center justify-center text-center">{children}</div>
    </motion.div>
  )
}

/* ─────────────── Page ─────────────── */
export default function ProfilePage() {
  const me = useUserStore((s) => s.user)
  return me ? <LoggedInProfileView /> : <LoginGate />
}

function LoginGate() {
  const router = useRouter()
  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,.08),transparent_60%)]">
      <div className="text-center">
        <p className="mb-4 text-gray-600">로그인이 필요해요.</p>
        <Button onClick={() => router.push("/login")} className="bg-green-600 hover:bg-green-700">로그인하기</Button>
      </div>
    </div>
  )
}

function LoggedInProfileView() {
  const router = useRouter()
  const me = useUserStore((s) => s.user) as { nickname?: string; email?: string; created_at?: string | null; profile?: string | null }

  // 데이터
  const { data: favorites, loading: favoritesLoading, isUsingFallback: favoritesFallback } = useFavorites()
  const { data: reviews,   loading: reviewsLoading,   isUsingFallback: reviewsFallback   } = useUserReviews()
  const isLoading = favoritesLoading || reviewsLoading

  // 상태
  type ValidFavorite = FavoriteItem & { restaurant_id: number; restaurant: RestaurantLite }
  const [favList, setFavList] = useState<ValidFavorite[]>([])
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [reviewList, setReviewList] = useState<ReviewVM[]>([])
  const [deletingId, setDeletingId] = useState<number | string | null>(null)

  const [reviewQuery, setReviewQuery] = useState("")
  const [reviewSort, setReviewSort] = useState<"latest" | "ratingDesc" | "ratingAsc">("latest")
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("리뷰")

  // 즐겨찾기/리뷰 매핑
  useEffect(() => {
    const raw = toArray<any>(favorites)
    const isValid = (x: FavoriteItem): x is ValidFavorite => !!x.restaurant_id && !!x.restaurant
    setFavList(raw.map(toFavoriteItem).filter(isValid))
  }, [favorites])

  useEffect(() => {
    const raw = toArray<any>(reviews)
    const base: ReviewVM[] = raw.map((r: any) => ({
      id: r?.id ?? r?.reviewId,
      restaurant: r?.restaurant ? { id: r.restaurant.id, name: r.restaurant.name, category: r.restaurant.category ?? null }
        : r?.restaurantId ? { id: r.restaurantId, name: "식당 정보 없음" } : undefined,
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
      setReviewList(prev); alert("리뷰 삭제에 실패했습니다."); console.error(e)
    } finally { setDeletingId(null) }
  }

  const avgRating = useMemo(() => {
    const total = reviewList.length
    if (total === 0) return 0
    const sum = reviewList.reduce((acc, r) => acc + (Number(r.waste_rating) || 0), 0)
    return Math.max(0, Math.min(5, Math.round((sum / total) * 10) / 10))
  }, [reviewList])

  // 뱃지 계산
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

  // 아바타
  const avatarSrc = useAvatarSrc((me as any)?.profile ?? (me as any)?.profileImage)
  const showFallbackWarning = favoritesFallback || reviewsFallback

  const handleRestaurantClick = (rid: number) => router.push(`/restaurant/${rid}`)
  const handleEditProfile = () => router.push("/profile/edit")
  const goOwner = () => router.push("/profile/owner")
  const goStamps = () => router.push("/stamps")

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

  /* ================== 렌더 ================== */
  return (
    <div className="min-h-screen relative">
      {/* 배경 장식 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_50%_-50%,rgba(16,185,129,.18),transparent),radial-gradient(1000px_500px_at_80%_10%,rgba(59,130,246,.14),transparent)]"
      />
      <div className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-white to-transparent dark:from-black" />

      {/* 히어로 */}
      <Section className="pt-[env(safe-area-inset-top)]">
        <Card className="mx-auto max-w-screen-md mb-5 bg-white/75 dark:bg-gray-900/70 backdrop-blur-xl border-white/30 shadow-2xl">
          <CardContent className="p-4 sm:p-6">
            <ProfileHeader
              nickname={me?.nickname}
              email={me?.email}
              createdAt={me?.created_at ?? undefined}
              avatarSrc={avatarSrc}
              onEdit={handleEditProfile}
            />

            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={goStamps} variant="outline" className="border-purple-400/60 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                <QrCode className="h-4 w-4 mr-2" /> 스탬프 사용
              </Button>
              <Button onClick={goOwner} variant="outline" className="border-green-400/60 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                <Store className="h-4 w-4 mr-2" /> 사업자 모드 전환
              </Button>
            </div>

            {/* 요약 (4장 동일 규격) */}
            <motion.div {...fadeUp(.05)} className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-5">
              <MetricCard tone="green">
                <div>
                  <div className="text-2xl font-bold tracking-tight text-emerald-600">{reviewList.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">총 리뷰</div>
                </div>
              </MetricCard>

              <MetricCard tone="blue">
                {reviewList.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < Math.round(avgRating) ? "fill-current text-green-500" : "text-gray-300"}`} />
                      ))}
                    </div>
                    <div className="text-xs text-green-600 font-medium mb-1">{avgRating.toFixed(1)}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">잔반 별점</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">리뷰 없음</div>
                    <div className="text-xs text-gray-500">리뷰를 작성해보세요</div>
                  </div>
                )}
              </MetricCard>

              <MetricCard tone="red">
                <div>
                  <div className="text-2xl font-bold tracking-tight text-rose-600">{favList.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">즐겨찾기</div>
                </div>
              </MetricCard>

              <MetricCard tone="orange">
                <div>
                  <div className="text-2xl font-bold tracking-tight text-amber-600">{earnedBadges.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">획득 뱃지</div>
                </div>
              </MetricCard>
            </motion.div>

            {(showFallbackWarning) && (
              <div className="mt-4 text-xs inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                <Info className="h-4 w-4" />
                일부 데이터는 임시 값 또는 로딩 지연이 있을 수 있어요.
              </div>
            )}
            {isLoading && (
              <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 데이터 로딩 중…
              </div>
            )}
          </CardContent>
        </Card>
      </Section>

      {/* Sticky Tabs 바 */}
      <div className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/50 bg-white/80 dark:bg-gray-900/70 border-b border-white/30 dark:border-white/10">
        <div className="mx-auto px-4 sm:px-6 max-w-screen-md">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
            <TabsList className="w-full flex gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 rounded-xl px-1 h-11 sm:h-12">
              {["리뷰","즐겨찾기","뱃지"].map((key) => (
                <TabsTrigger
                  key={key}
                  value={key as TabKey}
                  className="shrink-0 px-4 py-2 text-sm sm:text-base rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow border border-transparent data-[state=active]:border-white/40"
                >
                  {key}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="mx-auto px-4 sm:px-6 max-w-screen-md">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
          {/* 리뷰 */}
          <TabsContent value="리뷰" className="mt-6">
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center justify-between gap-2 text-[clamp(16px,4vw,18px)]">
                  <span className="inline-flex items-center gap-2">
                    <Star className="h-5 w-5 text-green-500" />
                    작성한 리뷰 (
                      {(() => {
                        let arr = [...reviewList]
                        if (reviewQuery.trim()) {
                          const q = reviewQuery.trim().toLowerCase()
                          arr = arr.filter(r =>
                            (r.restaurant?.name?.toLowerCase() ?? "").includes(q) ||
                            (r.restaurant?.category?.toLowerCase() ?? "").includes(q) ||
                            (r.comment.toLowerCase()).includes(q)
                          )
                        }
                        if (ratingFilter != null) arr = arr.filter(r => Math.round(r.waste_rating) === ratingFilter)
                        switch (reviewSort) {
                          case "ratingDesc":
                            arr.sort((a,b)=> (b.waste_rating - a.waste_rating) || (new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime()))
                            break
                          case "ratingAsc":
                            arr.sort((a,b)=> (a.waste_rating - b.waste_rating) || (new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime()))
                            break
                          default:
                            arr.sort((a,b)=> new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime())
                        }
                        return arr.length
                      })()}
                    )
                  </span>

                  {/* 필터/정렬/검색 바 */}
                  <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        value={reviewQuery}
                        onChange={(e)=>setReviewQuery(e.target.value)}
                        placeholder="식당명/카테고리/내용 검색"
                        className="pl-8 h-9 w-full rounded-md border bg-white/70 dark:bg-gray-800/70 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-300"
                      />
                    </div>
                    <div className="relative">
                      <select
                        value={reviewSort}
                        onChange={(e)=>setReviewSort(e.target.value as any)}
                        className="appearance-none pr-8 pl-3 h-9 rounded-md border bg-white/70 dark:bg-gray-800/70 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-300"
                      >
                        <option value="latest">최신순</option>
                        <option value="ratingDesc">별점 높은순</option>
                        <option value="ratingAsc">별점 낮은순</option>
                      </select>
                      <SlidersHorizontal className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
                    </div>
                    <div className="relative">
                      <select
                        value={ratingFilter ?? ""}
                        onChange={(e)=>setRatingFilter(e.target.value ? Number(e.target.value) : null)}
                        className="appearance-none pr-8 pl-3 h-9 rounded-md border bg-white/70 dark:bg-gray-800/70 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-300"
                      >
                        <option value="">별점(전체)</option>
                        {[5,4,3,2,1,0].map(v => <option key={v} value={v}>{v}점</option>)}
                      </select>
                      <Filter className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                {reviewsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 border border-white/30 dark:border-white/10">
                        <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                        <div className="h-3 w-1/4 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                        <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                        <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    {(() => {
                      // 동일한 필터/정렬 로직으로 최종 배열 만들기
                      let arr = [...reviewList]
                      if (reviewQuery.trim()) {
                        const q = reviewQuery.trim().toLowerCase()
                        arr = arr.filter(r =>
                          (r.restaurant?.name?.toLowerCase() ?? "").includes(q) ||
                          (r.restaurant?.category?.toLowerCase() ?? "").includes(q) ||
                          (r.comment.toLowerCase()).includes(q)
                        )
                      }
                      if (ratingFilter != null) arr = arr.filter(r => Math.round(r.waste_rating) === ratingFilter)
                      switch (reviewSort) {
                        case "ratingDesc":
                          arr.sort((a,b)=> (b.waste_rating - a.waste_rating) || (new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime()))
                          break
                        case "ratingAsc":
                          arr.sort((a,b)=> (a.waste_rating - b.waste_rating) || (new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime()))
                          break
                        default:
                          arr.sort((a,b)=> new Date(b.created_at||0).getTime() - new Date(a.created_at||0).getTime())
                      }
                      return arr
                    })().map((review, idx) => {
                      const ratingInt = Math.round(review.waste_rating || 0)
                      const ratingTone =
                        ratingInt >= 4 ? "from-emerald-500 to-green-500"
                        : ratingInt === 3 ? "from-amber-500 to-yellow-500"
                        : "from-rose-500 to-pink-500"
                      return (
                        <motion.div
                          key={review.id}
                          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * idx }}
                          whileHover={{ y: -2 }}
                          className="relative overflow-hidden backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 border border-white/30 dark:border-white/10 rounded-2xl p-4 hover:shadow-lg transition-all duration-300"
                        >
                          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ratingTone}`} />
                          <div className="flex items-start justify-between mb-3 gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-gray-900 dark:text-white truncate max-w-[240px] sm:max-w-[360px]">
                                  {review.restaurant?.name || "식당 정보 없음"}
                                </h3>
                                {!!review.restaurant?.category && (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">
                                    {review.restaurant.category}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-300">
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star key={i} className={`h-3.5 w-3.5 ${i < ratingInt ? "fill-current text-green-500" : "text-gray-300"}`} />
                                  ))}
                                  <span className="ml-1 font-medium">{review.waste_rating.toFixed(1)}</span>
                                </div>
                                <span className="text-xs text-gray-500">{review.created_at ? formatDate(review.created_at) : "날짜 없음"}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {review.restaurant?.id ? (
                                <Button variant="outline" size="sm" onClick={()=>handleRestaurantClick(review.restaurant!.id)} className="h-8 px-3">
                                  가게 보기
                                </Button>
                              ) : null}
                              <Button variant="destructive" size="sm" onClick={()=>handleDeleteReview(review.id)} disabled={deletingId === review.id} className="gap-2 h-8" title="리뷰 삭제">
                                {deletingId === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                삭제
                              </Button>
                            </div>
                          </div>

                          <p className="text-gray-800 dark:text-gray-200 break-words whitespace-pre-wrap leading-relaxed">
                            {review.comment || "댓글 없음"}
                          </p>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
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
                          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * index }}
                          whileHover={{ y: -2 }}
                          className="relative backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 border border-white/30 dark:border-white/10 rounded-2xl p-4 hover:shadow-lg transition-all duration-300 cursor-pointer"
                          onClick={()=>handleRestaurantClick(favorite.restaurant!.id)}
                          role="button" tabIndex={0}
                          onKeyDown={(e)=>{ if (e.key==="Enter" || e.key===" ") { e.preventDefault(); handleRestaurantClick(favorite.restaurant!.id) } }}
                        >
                          <div className="absolute right-3 top-3">
                            <Button
                              type="button" variant="destructive" size="sm"
                              className="gap-2 bg-red-500/90 hover:bg-red-600"
                              onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation() }}
                              onClick={(e)=>handleRemoveFavorite(e, favorite.restaurant_id!)}
                              disabled={removingId === favorite.restaurant_id}
                              title="즐겨찾기 삭제"
                            >
                              {removingId === favorite.restaurant_id ? (<><Loader2 className="h-4 w-4 animate-spin" />삭제 중…</>) : (<Trash2 className="h-4 w-4" />)}
                            </Button>
                          </div>

                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">{favorite.restaurant.name}</h3>

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
                    <EmptyState
                      icon={<Heart className="h-8 w-8 text-red-400" />}
                      title="즐겨찾기한 식당이 없습니다"
                      desc="마음에 드는 식당을 즐겨찾기에 추가해보세요."
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 뱃지 */}
          <TabsContent value="뱃지" className="mt-6">
            <motion.div {...fadeUp(.05)} className="space-y-6">
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                    <Award className="h-5 w-5 text-orange-500" />
                    획득한 뱃지 ({earnedBadges.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {earnedBadges.length === 0 ? (
                    <EmptyState icon={<Award className="h-8 w-8 text-orange-400" />} title="아직 획득한 뱃지가 없습니다." />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {earnedBadges.map((badge, idx) => (
                        <motion.div
                          key={badge.id}
                          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * idx }}
                          whileHover={{ scale: 1.02 }}
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

              <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                    <Users className="h-5 w-5 text-gray-500" />
                    진행 중인 뱃지 ({inProgressBadges.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {inProgressBadges.length === 0 ? (
                    <EmptyState icon={<Users className="h-8 w-8 text-gray-400" />} title="진행 중인 뱃지가 없습니다." />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {inProgressBadges.map((badge, index) => {
                        const pct = Math.min(100, Math.round((badge.progress / badge.target) * 100))
                        return (
                          <motion.div
                            key={badge.id}
                            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * index }}
                            whileHover={{ scale: 1.02 }}
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
        </Tabs>
      </div>

      <div className="pb-[env(safe-area-inset-bottom)] h-10" />
    </div>
  )
}
