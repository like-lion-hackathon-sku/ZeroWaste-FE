"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, User, Star, Heart, Award, Users, Edit, Loader2, Trash2, MapPin, Phone, Leaf } from "lucide-react"
import { useRouter } from "next/navigation"
import { useUserProfile, useUserBadges, useFavorites, useUserReviews } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"

/* ────────────────────────────────────────────────────────────
   타입
──────────────────────────────────────────────────────────── */
type RestaurantLite = {
  id: number
  name: string
  category?: string | null
  address?: string | null
  telephone?: string | null
}

type FavoriteItem = {
  id?: number // favorite row id
  restaurant_id: number
  restaurant?: RestaurantLite
  // 평평한 응답 대비 키
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

/* ────────────────────────────────────────────────────────────
   컴포넌트
──────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("reviews")

  const { data: user, loading: userLoading, error: userError, isUsingFallback: userFallback } = useUserProfile()
  const { data: userBadges, loading: badgesLoading, isUsingFallback: badgesFallback } = useUserBadges()
  const { data: favorites, loading: favoritesLoading, isUsingFallback: favoritesFallback } = useFavorites()
  const { data: reviews, loading: reviewsLoading, isUsingFallback: reviewsFallback } = useUserReviews()

  const isLoading = userLoading || badgesLoading || favoritesLoading || reviewsLoading
  const hasError = userError
  const isUsingFallback = userFallback || badgesFallback || favoritesFallback || reviewsFallback

  // 즐겨찾기 삭제용 로컬 상태(낙관적 업데이트)
  const [favList, setFavList] = useState<FavoriteItem[]>([])
  const [removingId, setRemovingId] = useState<number | null>(null)

  // 리뷰 화면 모델
  const [reviewList, setReviewList] = useState<ReviewVM[]>([])

  /* ──────────────────────────────────────────────────────────
     응답 정규화: 중첩형/평평한 두 포맷 모두 지원 + address/telephone 포함
  ─────────────────────────────────────────────────────────── */
  function toFavoriteItem(f: any): FavoriteItem {
    const restaurant_id = f.restaurant_id ?? f.restaurantId ?? f.restaurant?.id ?? null

    const restaurant: RestaurantLite | undefined =
      f.restaurant ??
      (f.name
        ? {
            id: restaurant_id,
            name: f.name,
            category: f.category ?? null,
            address: f.address ?? null,
            telephone: f.telephone ?? null,
          }
        : undefined)

    return { id: f.id, restaurant_id, restaurant }
  }

  useEffect(() => {
    const raw = Array.isArray(favorites) ? favorites : (favorites?.items ?? favorites?.success?.items)
    if (Array.isArray(raw)) {
      setFavList(raw.map(toFavoriteItem).filter((x) => !!x.restaurant_id && !!x.restaurant))
    } else {
      setFavList([])
    }
  }, [favorites])

  const earnedBadges = (userBadges || []).filter((badge: any) => badge.badge)

  const mockInProgressBadges = [
    { id: "good_customer_3", name: "착한 손님 Lv.3", icon: "🍃", description: "누적 리뷰 50개", category: "activity", earned: false, progress: reviewList.length || 0, target: 50 },
    { id: "eco_influencer", name: "에코 인플루언서", icon: "📸", description: "AI 분석 사진 20장 업로드", category: "environment", earned: false, progress: 15, target: 20 },
  ]

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

  const handleEditReview = (reviewId: number | string) => router.push(`/review/edit/${reviewId}`)

  /* ✅ /reviews/me 응답 정규화 + 식당명 보강 */
  useEffect(() => {
    const raw: any[] = Array.isArray(reviews) ? reviews : (reviews?.items ?? reviews?.success?.items ?? [])
    const base: ReviewVM[] = raw.map((r: any) => ({
      id: r.id ?? r.reviewId,
      restaurant: r.restaurant
        ? { id: r.restaurant.id, name: r.restaurant.name, category: r.restaurant.category ?? null }
        : (r.restaurantId ? { id: r.restaurantId, name: "식당 정보 없음" } : undefined),
      waste_rating: Number(r.score ?? r.waste_rating ?? 0),
      comment: String(r.contents ?? r.comment ?? ""),
      created_at: r.createdAt ?? r.created_at ?? null,
    }))
    setReviewList(base)

    const needIds = Array.from(
      new Set(
        base
          .filter(v => v.restaurant && (!v.restaurant.name || v.restaurant.name === "식당 정보 없음"))
          .map(v => v.restaurant!.id)
          .filter((id): id is number => Number.isFinite(id))
      )
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
        })
      )
      setReviewList(patched)
    })()
  }, [reviews])

  /* ✅ 평균 별점 계산 (리뷰 없으면 0) */
  const totalReviews = reviewList.length
  const avgRating = useMemo(() => {
    if (totalReviews === 0) return 0
    const sum = reviewList.reduce((acc, r) => acc + (Number(r.waste_rating) || 0), 0)
    return Math.max(0, Math.min(5, Math.round((sum / totalReviews) * 10) / 10))
  }, [totalReviews, reviewList])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <div className="text-gray-600 dark:text-gray-300">프로필 정보를 불러오는 중...</div>
        </motion.div>
      </div>
    )
  }

  if (hasError || !user) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {isUsingFallback && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-500/20 backdrop-blur-sm border-b border-yellow-200/30 p-3"
        >
          <div className="container mx-auto text-center text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ 연결되면 실제 데이터가 표시됩니다
          </div>
        </motion.div>
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
          <Button variant="ghost" size="sm" onClick={handleEditProfile} className="hover:bg-white/20">
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="mb-6 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  <Avatar className="h-20 w-20 ring-4 ring-green-500/20">
                    <AvatarImage src={user.profile || "/placeholder.svg"} alt={user.nickname} />
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
                    {user.nickname}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-gray-600 dark:text-gray-300 mb-2"
                  >
                    {user.email}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="text-sm text-gray-500 dark:text-gray-400"
                  >
                    가입일: {formatDate(user.created_at)}
                  </motion.p>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
              >
                {/* 총 리뷰 */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-2xl border border-green-200/30"
                >
                  <div className="text-2xl font-bold text-green-600 mb-1">{reviewList.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">총 리뷰</div>
                </motion.div>

                {/* 잔반 별점 (평균) */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-4 bg-gradient-to-br from-sky-500/10 to-blue-500/10 backdrop-blur-sm rounded-2xl border border-sky-200/30"
                >
                  {reviewList.length > 0 ? (
                    <>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < Math.round(avgRating) ? "fill-current text-green-500" : "text-gray-300"}`}
                          />
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

                {/* 즐겨찾기 수 */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-4 bg-gradient-to-br from-red-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl border border-red-200/30"
                >
                  <div className="text-2xl font-bold text-red-500 mb-1">{favList.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">즐겨찾기</div>
                </motion.div>

                {/* 획득 뱃지 수 */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="text-center p-4 bg-gradient-to-br from-orange-500/10 to-yellow-500/10 backdrop-blur-sm rounded-2xl border border-orange-200/30"
                >
                  <div className="text-2xl font-bold text-orange-600 mb-1">{earnedBadges.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">획득 뱃지</div>
                </motion.div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 h-12">
              <TabsTrigger
                value="reviews"
                className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400"
              >
                리뷰
              </TabsTrigger>
              <TabsTrigger
                value="favorites"
                className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-400"
              >
                즐겨찾기
              </TabsTrigger>
              <TabsTrigger
                value="badges"
                className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-400"
              >
                뱃지
              </TabsTrigger>
            </TabsList>

            {/* 리뷰 탭 */}
            <TabsContent value="reviews" className="mt-6">
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
                                        className={`h-3 w-3 ${
                                          i < Math.round(review.waste_rating || 0)
                                            ? "fill-current text-green-500"
                                            : "text-gray-300"
                                        }`}
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditReview(review.id)}
                                className="bg-white/50 hover:bg-white/80 border-white/30"
                                title="리뷰 수정"
                              >
                                수정
                              </Button>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center text-gray-500 py-12"
                        >
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

            {/* 즐겨찾기 탭 — 사진칸 제거 & 리뷰 카드 스타일 */}
            <TabsContent value="favorites" className="mt-6">
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
                              className="relative backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-4 hover:shadow-lg transition-all duration-300"
                            >
                              {/* 삭제 버튼 */}
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

                              {/* 본문 (이미지 없이 텍스트형) */}
                              <div
                                className="cursor-pointer"
                                onClick={() => handleRestaurantClick(favorite.restaurant!.id)}
                                role="button"
                                tabIndex={0}
                              >
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
                          ) : null
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

            {/* 뱃지 탭 */}
            <TabsContent value="badges" className="mt-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-6">
                <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-orange-500" />
                      획득한 뱃지 ({earnedBadges.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>{/* 필요 시 상세 UI 추가 */}</CardContent>
                </Card>

                <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-gray-500" />
                      진행 중인 뱃지 ({mockInProgressBadges.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {mockInProgressBadges.map((badge, index) => (
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
                          {badge.progress !== undefined && badge.target !== undefined && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>진행률</span>
                                <span>
                                  {badge.progress}/{badge.target}
                                </span>
                              </div>
                              <Progress value={(badge.progress / badge.target) * 100} className="h-2" />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}
