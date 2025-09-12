"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { RestaurantCard } from "@/components/restaurant-card"
import { ArrowLeft, User, Star, Heart, Award, Users, Edit, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useUserProfile, useUserBadges, useFavorites, useUserReviews } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"
import { CATEGORY_IMAGE } from "@/lib/category-images"

/* ────────────────────────────────────────────────────────────
   ✅ 맵 페이지와 동일 + 영문 코드 대응: 카테고리/이미지 유틸
──────────────────────────────────────────────────────────── */
const normalizeImage = (v: any): string | null => {
  if (typeof v !== "string") return null
  const s = v.trim()
  if (!s) return null
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")) return s
  return null
}

// 백엔드가 KOREAN/CAFE/ETC 같은 영문 코드로 줄 때 처리
const RAW_CODE_TO_KEY = new Map<string, keyof typeof CATEGORY_IMAGE>([
  ["korean", "한식"],
  ["chinese", "중식"],
  ["japanese", "일식"],
  ["western", "양식"],
  ["cafe", "카페"],
  ["fastfood", "패스트푸드"],
  ["etc", "기타"],
])

const CATEGORY_SYNONYM: Record<keyof typeof CATEGORY_IMAGE, string[]> = {
  한식: ["한식","백반","분식","국밥","족발","보쌈","삼겹","비빔밥","갈비","냉면","곰탕","칼국수","korean","kimchi","bibimbap","gukbap"],
  중식: ["중식","짬뽕","짜장","탕수육","중화요리","chinese","jajang","jjajang","jjamppong","china"],
  일식: ["일식","스시","초밥","라멘","라면","돈카츠","돈까스","우동","덮밥","japanese","sushi","ramen","udon","donburi","katsu"],
  양식: ["양식","파스타","스테이크","피자","리조또","브런치","이탈리안","western","italian","steak","pizza","pasta","brunch","risotto"],
  카페: ["카페","coffee","cafe","coffeeshop","tearoom","dessert","bakery","디저트","베이커리"],
  패스트푸드: ["패스트푸드","버거","치킨","샌드위치","패스트","fastfood","fast food","burger","fried chicken","sandwich"],
  기타: ["기타","pub","bar","술집","호프","포차","etc","etc."],
}

type CategoryKey = keyof typeof CATEGORY_IMAGE

function getCategoryKey(raw?: string | null, name?: string | null): CategoryKey {
  const rawLower = (raw ?? "").toLowerCase().replace(/[>,]/g, " ").trim()
  const hit = RAW_CODE_TO_KEY.get(rawLower)
  if (hit) return hit

  const text = `${raw ?? ""} ${name ?? ""}`
    .toLowerCase()
    .replace(/[>,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const order: CategoryKey[] = ["한식","중식","일식","양식","카페","패스트푸드","기타"]
  for (const key of order) {
    if (CATEGORY_SYNONYM[key].some((w) => text.includes(w))) return key
  }
  return "기타"
}

function buildCategoryLabel(raw?: string | null, name?: string | null): string {
  if (raw && raw.trim()) return raw.trim()
  return getCategoryKey(raw, name)
}
function getImageForRestaurant(category?: string | null, name?: string | null): string {
  const key = getCategoryKey(category, name)
  return CATEGORY_IMAGE[key] || CATEGORY_IMAGE["기타"]
}
const pickImage = (rawImg?: string | null, category?: string | null, name?: string | null) =>
  normalizeImage(rawImg) ?? getImageForRestaurant(category, name)

/* ────────────────────────────────────────────────────────────
   타입
──────────────────────────────────────────────────────────── */
type RestaurantLite = {
  id: number
  name: string
  category?: string | null
  categoryLabel?: string | null
  image?: string | null
  address?: string | null
  telephone?: string | null
}

type FavoriteItem = {
  id?: number
  restaurant_id: number
  restaurant?: RestaurantLite
  // 호환 필드
  name?: string
  category?: string | null
  restaurantId?: number
  address?: string | null
  telephone?: string | null
}

type ReviewVM = {
  id: number | string
  restaurant?: { id: number; name: string; category?: string | null; categoryLabel?: string | null; image?: string | null }
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

  const [favList, setFavList] = useState<FavoriteItem[]>([])
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [reviewList, setReviewList] = useState<ReviewVM[]>([])

  /* ──────────────────────────────────────────────────────────
     즐겨찾기 정규화 (카테고리 라벨/이미지 보강)
  ─────────────────────────────────────────────────────────── */
  const toFavoriteItem = (f: any): FavoriteItem => {
    const restaurant_id = f.restaurant_id ?? f.restaurantId ?? f.restaurant?.id ?? null
    const baseName = f.restaurant?.name ?? f.name ?? "식당 정보 없음"
    const baseCategory = f.restaurant?.category ?? f.category ?? null
    const baseImage = f.restaurant?.image ?? f.image ?? null

    const restaurant: RestaurantLite | undefined =
      restaurant_id
        ? {
            id: Number(restaurant_id),
            name: baseName,
            category: baseCategory,
            categoryLabel: buildCategoryLabel(baseCategory, baseName),
            image: pickImage(baseImage, baseCategory, baseName),
            address: f.restaurant?.address ?? f.address ?? null,
            telephone: f.restaurant?.telephone ?? f.telephone ?? null,
          }
        : undefined

    return { id: f.id, restaurant_id, restaurant }
  }

  useEffect(() => {
    const raw = Array.isArray(favorites) ? favorites : (favorites?.items ?? favorites?.success?.items)
    if (!Array.isArray(raw)) {
      setFavList([])
      return
    }
    const list = raw.map(toFavoriteItem).filter((x) => !!x.restaurant_id && !!x.restaurant)
    setFavList(list)

    // 누락 보강(상세)
    ;(async () => {
      const patched = await Promise.all(
        list.map(async (row) => {
          if (!row.restaurant) return row
          const needs = row.restaurant.name === "식당 정보 없음" || !row.restaurant.category || !row.restaurant.image
          if (!needs) return row
          try {
            const d = await apiClient.getRestaurantDetail(row.restaurant_id)
            if (d?.success) {
              const detail: any = d.data
              const nm = detail?.name ?? row.restaurant.name
              const cat = detail?.category ?? row.restaurant.category
              const img = pickImage(detail?.image ?? row.restaurant.image, cat, nm)
              return {
                ...row,
                restaurant: {
                  ...row.restaurant,
                  name: nm,
                  category: cat,
                  categoryLabel: buildCategoryLabel(cat, nm),
                  image: img,
                },
              }
            }
          } catch {}
          return row
        })
      )
      setFavList(patched)
    })()
  }, [favorites])

  /* ──────────────────────────────────────────────────────────
     리뷰 정규화 (카테고리 라벨/이미지 보강)
  ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const raw: any[] = Array.isArray(reviews) ? reviews : (reviews?.items ?? reviews?.success?.items ?? [])
    const base: ReviewVM[] = raw.map((r: any) => {
      const rid = r.restaurant?.id ?? r.restaurantId
      const name = r.restaurant?.name ?? (rid ? "식당 정보 없음" : undefined)
      const category = r.restaurant?.category ?? null

      return {
        id: r.id ?? r.reviewId,
        restaurant: rid
          ? {
              id: Number(rid),
              name: name!,
              category,
              categoryLabel: buildCategoryLabel(category, name!),
              image: pickImage(r.restaurant?.image, category, name!),
            }
          : undefined,
        waste_rating: Number(r.score ?? r.waste_rating ?? 0),
        comment: String(r.contents ?? r.comment ?? ""),
        created_at: r.createdAt ?? r.created_at ?? null,
      }
    })
    setReviewList(base)

    // 누락 보강(상세)
    const needIds = Array.from(
      new Set(
        base
          .filter(v => v.restaurant && (v.restaurant.name === "식당 정보 없음" || !v.restaurant.category || !v.restaurant.image))
          .map(v => v.restaurant!.id)
      )
    )
    if (needIds.length === 0) return

    ;(async () => {
      const patched = await Promise.all(
        base.map(async (v) => {
          if (!v.restaurant) return v
          const ok = v.restaurant.name !== "식당 정보 없음" && v.restaurant.category && v.restaurant.image
          if (ok) return v
          try {
            const resp = await apiClient.getRestaurantDetail(v.restaurant.id)
            if (resp?.success) {
              const d: any = resp.data
              const nm = d?.name ?? v.restaurant.name
              const cat = d?.category ?? v.restaurant.category
              const img = pickImage(d?.image ?? v.restaurant.image, cat, nm)
              return { ...v, restaurant: { ...v.restaurant, name: nm, category: cat, categoryLabel: buildCategoryLabel(cat, nm), image: img } }
            }
          } catch {}
          return v
        })
      )
      setReviewList(patched)
    })()
  }, [reviews])

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
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }} className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
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
          <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-green-500 to-emerald-600">다시 시도</Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {isUsingFallback && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-yellow-500/20 backdrop-blur-sm border-b border-yellow-200/30 p-3">
          <div className="container mx-auto text-center text-sm text-yellow-800 dark:text-yellow-200">⚠️ 연결되면 실제 데이터가 표시됩니다</div>
        </motion.div>
      )}

      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-white/20 p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="hover:bg-white/20">
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="font-bold text-xl bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">프로필</h1>
          <Button variant="ghost" size="sm" onClick={handleEditProfile} className="hover:bg-white/20">
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* 상단 프로필 카드 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="mb-6 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 200 }}>
                  <Avatar className="h-20 w-20 ring-4 ring-green-500/20">
                    <AvatarImage src={user.profile || "/placeholder.svg"} alt={user.nickname} />
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                <div className="flex-1">
                  <motion.h2 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-1">
                    {user.nickname}
                  </motion.h2>
                  <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="text-gray-600 dark:text-gray-300 mb-2">
                    {user.email}
                  </motion.p>
                  <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="text-sm text-gray-500 dark:text-gray-400">
                    가입일: {formatDate(user.created_at)}
                  </motion.p>
                </div>
              </div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div whileHover={{ scale: 1.05 }} className="text-center p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-2xl border border-green-200/30">
                  <div className="text-2xl font-bold text-green-600 mb-1">{reviewList.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">총 리뷰</div>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} className="text-center p-4 bg-gradient-to-br from-sky-500/10 to-blue-500/10 backdrop-blur-sm rounded-2xl border border-sky-200/30">
                  {reviewList.length > 0 ? (
                    <>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < Math.round(
                            Math.max(0, Math.min(5, Math.round((reviewList.reduce((acc, r) => acc + (Number(r.waste_rating) || 0), 0) / reviewList.length) * 10) / 10))
                          ) ? "fill-current text-green-500" : "text-gray-300"}`} />
                        ))}
                      </div>
                      <div className="text-xs text-green-600 font-medium mb-1">
                        {Math.max(0, Math.min(5, Math.round((reviewList.reduce((acc, r) => acc + (Number(r.waste_rating) || 0), 0) / reviewList.length) * 10) / 10)).toFixed(1)}
                      </div>
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
                  <div className="text-2xl font-bold text-orange-600 mb-1">{(userBadges || []).filter((b:any)=>b.badge).length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">획득 뱃지</div>
                </motion.div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 탭 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 h-12">
              <TabsTrigger value="reviews" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-400">리뷰</TabsTrigger>
              <TabsTrigger value="favorites" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-400">즐겨찾기</TabsTrigger>
              <TabsTrigger value="badges" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-400">뱃지</TabsTrigger>
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
                        reviewList.map((review, index) => (
                          <motion.div
                            key={review.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index }}
                            className="backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border border-white/20 rounded-2xl p-4 hover:shadow-lg transition-all duration-300"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-start gap-3">
                                {/* 썸네일: 실이미지 없으면 카테고리 기본 이미지 */}
                                <img
                                  src={review.restaurant?.image || getImageForRestaurant(review.restaurant?.category, review.restaurant?.name)}
                                  alt={review.restaurant?.name || "thumbnail"}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
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
                                    <span>{review.restaurant?.categoryLabel || "기타"}</span>
                                  </div>
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
                                onClick={() => router.push(`/review/edit/${review.id}`)}
                                className="bg-white/50 hover:bg-white/80 border-white/30"
                                title="리뷰 수정"
                              >
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

            {/* 즐겨찾기 탭 */}
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
                              transition={{ delay: 0.1 * index }}
                              className="relative"
                            >
                              <RestaurantCard
                                restaurant={{
                                  ...favorite.restaurant,
                                  image: favorite.restaurant.image || pickImage(undefined, favorite.restaurant.category, favorite.restaurant.name),
                                  category: favorite.restaurant.categoryLabel || favorite.restaurant.category,
                                }}
                                onClick={() => handleRestaurantClick(favorite.restaurant!.id)}
                                showFavorite={false}
                              />
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
                      진행 중인 뱃지 (2)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { id: "good_customer_3", name: "착한 손님 Lv.3", icon: "🍃", description: "누적 리뷰 50개", progress: reviewList.length || 0, target: 50 },
                        { id: "eco_influencer", name: "에코 인플루언서", icon: "📸", description: "AI 분석 사진 20장 업로드", progress: 15, target: 20 },
                      ].map((badge, index) => (
                        <motion.div key={badge.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * index }} whileHover={{ scale: 1.05 }} className="p-4 bg-gray-500/10 backdrop-blur-sm border border-gray-200/30 rounded-2xl text-center">
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
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}
