"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  ArrowLeft,
  Star,
  MapPin,
  Phone,
  Clock,
  Heart,
  Share2,
  Camera,
  Edit3,
  Leaf,
  Users,
  Loader2,
  Award,
  Sparkles,
} from "lucide-react"

import { apiClient } from "@/lib/api/client"
import { calculateWasteStarRating } from "@/lib/utils/database-helpers"
import { mockRestaurants } from "@/lib/mock/restaurant-presets"

/* ───────────────── 별점(부분 채움) ───────────────── */
function StarRating({
  value,
  outOf = 5,
  size = 20,
  colorClass = "text-green-500",
  emptyClass = "text-gray-300",
}: {
  value: number
  outOf?: number
  size?: number
  colorClass?: string
  emptyClass?: string
}) {
  const v = Math.max(0, Math.min(Number(value) || 0, outOf))
  return (
    <div className="flex items-center" aria-label={`${v} / ${outOf}`}>
      {Array.from({ length: outOf }).map((_, i) => {
        const fill = Math.min(Math.max(v - i, 0), 1)
        return (
          <div key={i} className="relative" style={{ width: size, height: size }} aria-hidden>
            <Star width={size} height={size} className={emptyClass} />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star width={size} height={size} className={`${colorClass} fill-current`} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────── Types ───────────────── */
type UIReview = {
  id?: number
  userName?: string
  wasteRating?: number
  date?: string
  comment?: string
  images?: string[]
}
type UIMenuItem = { name?: string; price?: string; description?: string }
type UIRestaurant = {
  id: number
  name: string
  image?: string | null
  badge?: string | null
  wasteScore?: number | null
  totalReviews?: number | null
  /** 지도와 동일한 형식: 예) 카페,디저트>베이커리 */
  category?: string | null
  distance?: string | null
  address?: string | null
  telephone?: string | null
  hours?: string | null
  description?: string | null
  favorited?: boolean
  menu?: UIMenuItem[]
  gallery?: string[]
  reviews?: UIReview[]
  infoSections?: { title: string; body: string }[]
}

/* ───────────────── 카테고리 라벨 정규화 ───────────────── */
function firstNonEmpty(...vals: any[]) {
  for (const v of vals) {
    if (Array.isArray(v) && v.length) return v
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

/** 다양한 원본 형태 → `대분류,중분류>소분류>세부` 같은 지도 표기 */
function toCategoryLabel(raw: any): string | null {
  const h = raw?.header ?? {}
  const t = raw?.tabs ?? {}
  const ext = raw?.external ?? {}

  const arr =
    Array.isArray(raw?.categories) ? raw.categories :
    Array.isArray(ext?.categories) ? ext.categories :
    Array.isArray(h?.categories) ? h.categories :
    Array.isArray(t?.info?.categories) ? t.info.categories : null

  const path =
    Array.isArray(raw?.categoryPath) ? raw.categoryPath :
    Array.isArray(ext?.categoryPath) ? ext.categoryPath : null

  const tiered = [
    ext?.categoryLarge ?? ext?.largeCategory ?? ext?.majorCategory,
    ext?.categoryMedium ?? ext?.middleCategory ?? ext?.midCategory,
    ext?.categorySmall ?? ext?.smallCategory ?? ext?.minorCategory,
    ext?.categoryDetail ?? ext?.detailCategory,
  ].filter(Boolean)

  const flat = firstNonEmpty(
    raw?.category,
    h?.category,
    t?.info?.category,
    ext?.category,
    path,
    arr,
    tiered
  )

  if (!flat) return null

  let label = ""
  if (Array.isArray(flat)) {
    const head = flat.slice(0, 2).filter(Boolean).join(",")
    const tail = flat.slice(2).filter(Boolean).join(">")
    label = [head, tail].filter(Boolean).join(">")
  } else {
    label = String(flat)
  }

  label = label
    .replace(/\s*,\s*/g, ",")
    .replace(/\s*>\s*/g, ">")
    .replace(/,{2,}/g, ",")
    .replace(/>+/g, ">")
    .trim()

  if (!label || /^etc$/i.test(label)) return null
  return label
}

/* ───────────────── Review 정규화 ───────────────── */
const normalizeReview = (r: any): UIReview => {
  const u = r.user
  const name =
    typeof u === "string"
      ? u
      : (u?.name ??
         u?.username ??
         u?.nickname ??
         r.nickname ??
         r.userName ??
         r.authorName ??
         r.author ??
         "익명")

  const ratingRaw =
    r.score ?? r.waste_rating ?? r.rating ?? r.stars ?? r.star ?? r.wasteScore ?? 0

  const comment = r.contents ?? r.comment ?? r.content ?? r.text ?? ""
  const date = r.createdAt ?? r.created_at ?? r.date ?? r.created ?? ""
  const images =
    Array.isArray(r.images)
      ? r.images.map((x: any) => (typeof x === "string" ? x : x?.url)).filter(Boolean)
      : Array.isArray(r.photos)
        ? r.photos.map((x: any) => (typeof x === "string" ? x : x?.url)).filter(Boolean)
        : []

  return {
    id: Number(r.id ?? r.review_id ?? 0),
    userName: (name || "익명").trim(),
    wasteRating: Number(ratingRaw) || 0,
    date,
    comment,
    images,
  }
}

/* ───────────────── Restaurant 정규화 ───────────────── */
function normalizeRestaurant(raw: any): UIRestaurant {
  // v2 형태(header/tabs)
  if (raw?.header && raw?.tabs) {
    const h = raw.header ?? {}
    const t = raw.tabs ?? {}

    const menuItems: UIMenuItem[] = Array.isArray(t.menu?.items)
      ? t.menu.items.map((m: any) => ({
          name: m?.name,
          price: m?.price ?? "",
          description: m?.description ?? "",
        }))
      : []

    const gallery: string[] = Array.isArray(t.gallery?.photos)
      ? t.gallery.photos.map((p: any) => (typeof p === "string" ? p : p?.url)).filter(Boolean)
      : []

    const fav =
      !!h.isFavorite || !!h.is_favorite || !!h.favorited || !!raw?.isFavorite || !!raw?.is_favorite || !!raw?.favorited

    return {
      id: Number(h.id ?? 0),
      name: String(h.name ?? "알 수 없는 식당"),
      image: h.heroPhoto ?? null,
      badge: h.badge ?? null,
      wasteScore: typeof h.ecoScore === "number" ? h.ecoScore : null,
      totalReviews: typeof h.reviewCount === "number" ? h.reviewCount : 0,
      category: toCategoryLabel(raw) ?? h.category ?? null, // ★ 지도 포맷
      distance: null,
      address: t.info?.address ?? h.address ?? null,
      telephone: t.info?.telephone ?? h.telephone ?? null,
      hours: null,
      description: t.info?.description ?? null,
      favorited: fav,
      menu: menuItems,
      gallery,
      reviews: [],
    }
  }

  // 일반 형태
  const ext = raw?.external ?? {}
  const eco = raw?.stats?.ecoScore
  const photos: string[] = Array.isArray(ext.photos) ? (ext.photos as any[]).map((p) => p?.url).filter(Boolean) : []
  const fav =
    !!raw?.isFavorite ||
    !!raw?.is_favorite ||
    !!raw?.favorited ||
    !!ext?.isFavorite ||
    !!ext?.is_favorite ||
    !!ext?.favorited

  return {
    id: Number(raw?.id ?? 0),
    name: String(raw?.name ?? "알 수 없는 식당"),
    image: raw?.image ?? null,
    badge: raw?.badge ?? null,
    wasteScore: typeof eco === "number" ? eco : null,
    totalReviews:
      typeof raw?.stats?._count === "number"
        ? raw.stats._count
        : typeof raw?.totalReviews === "number"
          ? raw.totalReviews
          : 0,
    category: toCategoryLabel(raw) ?? ext.category ?? raw?.category ?? null, // ★ 지도 포맷
    distance: raw?.distance ?? null,
    address: ext.address ?? raw?.address ?? null,
    telephone: ext.telephone ?? raw?.telephone ?? null,
    hours: raw?.hours ?? null,
    description: raw?.description ?? null,
    favorited: fav,
    menu: Array.isArray(ext.menus)
      ? (ext.menus as any[]).map((m) => ({
          name: m?.name,
          price: m?.price,
          description: m?.description,
        }))
      : [],
    gallery: photos,
    reviews: [],
  }
}

/* ───────────────── Page ───────────────── */
export default function RestaurantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeFav = searchParams.get("fav") === "1"
  const routeCat = searchParams.get("cat") || null // ★ 쿼리 카테고리

  const restaurantId = Number.parseInt((params as any).id as string)

  const [activeTab, setActiveTab] = useState("info")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState<any | null>(null)

  // 리뷰
  const [reviews, setReviews] = useState<UIReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [reviewsFetched, setReviewsFetched] = useState(false)

  async function loadReviewsOnce(id: number) {
    if (!id || reviewsFetched) return
    setReviewsLoading(true)
    setReviewsError(null)
    try {
      const res = await apiClient.getRestaurantReviews(id)
      if (!res.success) {
        setReviews([])
        setReviewsError(res.error || "리뷰를 불러올 수 없습니다.")
      } else {
        const list = Array.isArray((res.data as any)?.items)
          ? (res.data as any).items
          : Array.isArray(res.data)
            ? (res.data as any)
            : []
        setReviews(list.map((r: any) => normalizeReview(r)))
      }
    } catch (e: any) {
      setReviews([])
      setReviewsError(e?.message || "네트워크 오류가 발생했어요.")
    } finally {
      setReviewsLoading(false)
      setReviewsFetched(true)
    }
  }

  // 상세 + 선로딩
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      setReviewsFetched(false)
      try {
        const res = await apiClient.getRestaurantDetail(restaurantId)
        if (!mounted) return
        if (!res.success) {
          setError(res.error || "식당 정보를 불러올 수 없습니다.")
          setRaw(null)
        } else {
          setRaw(res.data)
          loadReviewsOnce(restaurantId) // ★ 선로딩
        }
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || "네트워크 오류가 발생했어요.")
        setRaw(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [restaurantId])

  // 리뷰 탭 진입 시(미로드면 1회)
  useEffect(() => {
    if (activeTab !== "reviews" || !restaurantId || reviewsFetched) return
    loadReviewsOnce(restaurantId)
  }, [activeTab, restaurantId, reviewsFetched])

  // UI merge
  const restaurant = useMemo<UIRestaurant | null>(() => {
    if (!raw) return null
    const base = normalizeRestaurant(raw)
    const mock = mockRestaurants[base.id]
    if (!mock) return base

    const mergedDescription = [base.description, mock.facilities].filter(Boolean).join("\n\n")
    const mergedMenu = Array.isArray(mock.menu) && mock.menu.length > 0 ? mock.menu : base.menu

    return {
      ...base,
      description: mergedDescription,
      menu: mergedMenu,
      infoSections: mock.infoSections,
    }
  }, [raw])

  // 즐겨찾기
  const isFav = ((restaurant?.favorited ?? false) || routeFav) as boolean

  const toggleFavorite = async () => {
    if (!restaurant?.id) return
    const prev = isFav
    const nextFav = !prev
    setRaw((r: any) => {
      if (!r) return r
      const copy = JSON.parse(JSON.stringify(r))
      if (copy?.header) copy.header.isFavorite = nextFav
      else copy.isFavorite = nextFav
      return copy
    })
    router.replace(`/restaurant/${restaurantId}?fav=${nextFav ? 1 : 0}${routeCat ? `&cat=${encodeURIComponent(routeCat)}` : ""}`, { scroll: false })
    try {
      if (nextFav) {
        const rs = await apiClient.addFavorite(restaurant.id)
        if (!rs?.success) throw new Error(rs?.error || "즐겨찾기 추가 실패")
      } else {
        const rs = await apiClient.removeFavorite(restaurant.id)
        if (!rs?.success) throw new Error(rs?.error || "즐겨찾기 해제 실패")
      }
    } catch (err: any) {
      setRaw((r: any) => {
        if (!r) return r
        const copy = JSON.parse(JSON.stringify(r))
        if (copy?.header) copy.header.isFavorite = prev
        else copy.isFavorite = prev
        return copy
      })
      router.replace(`/restaurant/${restaurantId}?fav=${prev ? 1 : 0}${routeCat ? `&cat=${encodeURIComponent(routeCat)}` : ""}`, { scroll: false })
      alert(err?.message || "즐겨찾기 처리가 실패했어요.")
    }
  }

  const handleShare = () => {
    if (!restaurant) return
    if (navigator.share) {
      navigator.share({
        title: restaurant.name,
        text: "에코 친화 식당 정보 공유",
        url: typeof window !== "undefined" ? window.location.href : "",
      }).catch(() => {})
    } else {
      alert("이 브라우저는 공유 기능을 지원하지 않아요.")
    }
  }

  const handleWriteReview = () => {
    router.push(`/review/write?restaurantId=${restaurantId}`)
  }

  // 리뷰 평균(있으면 사용)
  const reviewsAvg = useMemo(() => {
    if (!reviews.length) return null
    const sum = reviews.reduce((acc, r) => acc + (Number(r.wasteRating) || 0), 0)
    return Math.round((sum / reviews.length) * 10) / 10
  }, [reviews])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-sky-50/30 dark:from-slate-950 dark:via-green-950/20 dark:to-sky-950/20 flex items-center justify-center">
        <motion.div className="text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-2xl">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full animate-pulse" />
          </div>
          <div className="text-lg font-semibold text-foreground mb-2">식당 정보를 불러오는 중...</div>
          <div className="text-sm text-muted-foreground">잠시만 기다려주세요</div>
        </motion.div>
      </div>
    )
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-orange-50/30 dark:from-slate-950 dark:via-red-950/20 dark:to-orange-950/20 flex items-center justify-center">
        <motion.div className="text-center max-w-md mx-auto p-8" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-2xl mb-6">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <div className="text-lg font-semibold text-red-600 mb-4">{error || "식당 정보를 불러올 수 없습니다"}</div>
          <Button
            onClick={() => router.back()}
            className="rounded-2xl bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 shadow-lg"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
        </motion.div>
      </div>
    )
  }

  // 표시할 별점
  const starFromEco = calculateWasteStarRating(restaurant.wasteScore ?? 0)
  const displayStar = (reviewsAvg ?? starFromEco)

  // ★ 표시할 카테고리: 쿼리 우선 → BE 값 → ETC
  const displayCategory = routeCat || restaurant.category || "ETC"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-sky-50/30 dark:from-slate-950 dark:via-green-950/20 dark:to-sky-950/20">
      {/* 헤더 */}
      <motion.header
        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 p-4 sticky top-0 z-20 shadow-lg"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="h-10 px-4 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-lg transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로가기
            </Button>
          </motion.div>
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                title="공유하기"
                className="h-10 w-10 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-lg transition-all duration-200"
              >
                <Share2 className="h-4 w-4 text-blue-600" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFavorite}
                title={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                aria-pressed={isFav}
                className="h-10 w-10 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-900/30 shadow-lg transition-all duration-200"
              >
                <Heart className={`h-4 w-4 transition-all duration-200 ${isFav ? "fill-red-500 text-red-500 scale-110" : "text-gray-400"}`} />
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* 히어로 */}
      <motion.div
        className="relative h-80 bg-muted overflow-hidden"
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      >
        <img src={restaurant.image || "/placeholder.svg"} alt={restaurant.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 to-emerald-900/20" />
        <motion.div className="absolute bottom-6 left-6 right-6" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center gap-3 mb-4">
            {restaurant.badge && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
                <Badge
                  variant={restaurant.badge === "착한 식당" ? "default" : "secondary"}
                  className="bg-green-500/90 text-white border-green-400 shadow-lg backdrop-blur-sm px-3 py-1 text-sm"
                >
                  <Award className="h-3 w-3 mr-1" />
                  {restaurant.badge}
                </Badge>
              </motion.div>
            )}
          </div>

          <motion.h1 className="text-3xl md:text-4xl font-bold text-white mb-3 drop-shadow-lg" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
            {restaurant.name}
          </motion.h1>

          <motion.div className="flex items-center gap-6 text-white/90" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2">
              <StarRating value={displayStar} size={18} colorClass="text-green-400" emptyClass="text-white/60" />
              <span className="font-bold text-lg ml-2">{displayStar.toFixed(1)}</span>
              <span className="text-sm opacity-75">({reviews.length || restaurant.totalReviews || 0})</span>
            </div>
            {displayCategory && (
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2" title={displayCategory}>
                <span className="text-sm font-medium">{displayCategory}</span>
              </div>
            )}
            {restaurant.distance && (
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2">
                <span className="text-sm">{restaurant.distance}</span>
              </div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* 본문 */}
      <div className="container mx-auto p-6 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl p-1 shadow-lg">
              <TabsTrigger value="info" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all duration-200">
                <MapPin className="h-4 w-4 mr-2" /> 정보
              </TabsTrigger>
              <TabsTrigger value="menu" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all duration-200">
                <Sparkles className="h-4 w-4 mr-2" /> 메뉴
              </TabsTrigger>
              <TabsTrigger value="gallery" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all duration-200">
                <Camera className="h-4 w-4 mr-2" /> 갤러리
              </TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all duration-200">
                <Users className="h-4 w-4 mr-2" /> 리뷰
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              {/* Info */}
              <TabsContent value="info" className="mt-8">
                <motion.div className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 dark:border-slate-700/50 shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-white/20 dark:border-slate-700/50">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                          <MapPin className="h-5 w-5 text-white" />
                        </div>
                        기본 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      {restaurant.address && (
                        <motion.div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl" whileHover={{ scale: 1.01 }}>
                          <MapPin className="h-5 w-5 text-green-600" />
                          <span className="text-foreground font-medium">{restaurant.address}</span>
                        </motion.div>
                      )}
                      {restaurant.telephone && (
                        <motion.div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl" whileHover={{ scale: 1.01 }}>
                          <Phone className="h-5 w-5 text-blue-600" />
                          <span className="text-foreground font-medium">{restaurant.telephone}</span>
                        </motion.div>
                      )}
                      {restaurant.hours && (
                        <motion.div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl" whileHover={{ scale: 1.01 }}>
                          <Clock className="h-5 w-5 text-orange-600" />
                          <span className="text-foreground font-medium">{restaurant.hours}</span>
                        </motion.div>
                      )}

                      {(restaurant.description?.trim()?.length ?? 0) > 0 && <Separator className="my-6" />}

                      {restaurant.description && (
                        <div className="p-6 bg-gradient-to-br from-slate-50 to-green-50/50 dark:from-slate-800/50 dark:to-green-900/20 rounded-2xl">
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-base">
                            {restaurant.description}
                          </p>
                        </div>
                      )}

                      {restaurant.infoSections?.length ? (
                        <div className="mt-6 space-y-4">
                          {restaurant.infoSections.map((sec, i) => (
                            <motion.details
                              key={`${sec.title}-${i}`}
                              className="rounded-2xl border border-white/20 dark:border-slate-700/50 p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm shadow-lg"
                              whileHover={{ scale: 1.01 }}
                            >
                              <summary className="cursor-pointer font-semibold text-foreground text-lg py-2">
                                {sec.title}
                              </summary>
                              <div className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {sec.body}
                              </div>
                            </motion.details>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200/50 dark:border-green-800/50 shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-b border-green-200/50 dark:border-green-800/50">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                          <Leaf className="h-5 w-5 text-white" />
                        </div>
                        친환경 지수
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <motion.div className="text-center p-8 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-2xl" whileHover={{ scale: 1.02 }}>
                        <motion.div className="text-4xl font-bold text-green-600 mb-2" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }}>
                          {displayStar}
                        </motion.div>
                        <div className="text-lg text-green-700 dark:text-green-300 font-medium">잔반 별점</div>
                        <div className="flex justify-center mt-4">
                          <StarRating value={displayStar} size={24} />
                        </div>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Menu */}
              <TabsContent value="menu" className="mt-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 dark:border-slate-700/50 shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-b border-white/20 dark:border-slate-700/50">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-600 shadow-lg">
                          <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        메뉴
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {restaurant.menu && restaurant.menu.length > 0 ? (
                          restaurant.menu.map((item, index) => (
                            <motion.div
                              key={index}
                              className="flex justify-between items-start p-6 border border-white/20 dark:border-slate-700/50 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              whileHover={{ scale: 1.01, x: 4 }}
                            >
                              <div className="flex-1">
                                <h3 className="font-semibold text-foreground mb-2 text-lg">{item.name || "메뉴"}</h3>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                  {item.description || ""}
                                </p>
                              </div>
                              {item.price && (
                                <div className="text-xl font-bold text-green-600 ml-6 bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-xl">
                                  {item.price}
                                </div>
                              )}
                            </motion.div>
                          ))
                        ) : (
                          <motion.div className="text-center text-muted-foreground py-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <Sparkles className="h-16 w-16 mx-auto mb-4 opacity-30" />
                            <p className="text-lg">메뉴 정보가 없습니다</p>
                          </motion.div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Gallery */}
              <TabsContent value="gallery" className="mt-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 dark:border-slate-700/50 shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-white/20 dark:border-slate-700/50">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                          <Camera className="h-5 w-5 text-white" />
                        </div>
                        사진 갤러리
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {restaurant.gallery && restaurant.gallery.length > 0 ? (
                          restaurant.gallery.map((image, index) => (
                            <motion.div
                              key={index}
                              className="aspect-square bg-muted rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 group"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.1 }}
                              whileHover={{ scale: 1.02 }}
                            >
                              <img
                                src={image || "/placeholder.svg"}
                                alt={`${restaurant.name} 사진 ${index + 1}`}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-pointer"
                              />
                            </motion.div>
                          ))
                        ) : (
                          <motion.div className="col-span-full text-center text-muted-foreground py-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <Camera className="h-16 w-16 mx-auto mb-4 opacity-30" />
                            <p className="text-lg">사진이 없습니다</p>
                          </motion.div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Reviews */}
              <TabsContent value="reviews" className="mt-8">
                <motion.div className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  {/* 요약 */}
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 dark:border-slate-700/50 shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-b border-white/20 dark:border-slate-700/50">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        리뷰 요약
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-2 gap-6 text-center">
                        <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {reviews.length || restaurant.totalReviews || 0}
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">총 리뷰</div>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl">
                          <div className="text-3xl font-bold text-green-600 mb-2">
                            {displayStar}
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">평균 잔반 별점</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 목록 */}
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 dark:border-slate-700/50 shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-slate-500/10 to-slate-700/10 border-b border-white/20 dark:border-slate-700/50">
                      <CardTitle className="text-lg">방문자 리뷰</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {reviewsLoading ? (
                        <div className="flex items-center justify-center py-16 text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mr-2" /> 불러오는 중…
                        </div>
                      ) : reviewsError ? (
                        <div className="text-center text-red-500 py-12 bg-red-50 dark:bg-red-900/20">
                          {reviewsError}
                        </div>
                      ) : reviews.length === 0 ? (
                        <div className="text-center text-muted-foreground py-16 bg-slate-50 dark:bg-slate-800/50">
                          아직 등록된 리뷰가 없어요.
                        </div>
                      ) : (
                        <ul className="divide-y divide-white/20 dark:divide-slate-700/50">
                          {reviews.map((rv) => (
                            <li key={rv.id} className="p-6">
                              <div className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                  <span className="text-sm font-semibold">{(rv.userName ?? "익명").slice(0, 1)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold">{rv.userName ?? "익명"}</div>
                                    <div className="text-xs text-muted-foreground">{rv.date?.slice(0, 10)}</div>
                                  </div>
                                  <div className="mt-1">
                                    <StarRating value={Number(rv.wasteRating) || 0} size={16} />
                                  </div>
                                  {rv.comment && (
                                    <p className="mt-2 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                      {rv.comment}
                                    </p>
                                  )}
                                  {rv.images && rv.images.length > 0 && (
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                      {rv.images.slice(0, 6).map((img, idx) => (
                                        <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-muted">
                                          <img src={img} alt={`review-${rv.id}-${idx}`} className="w-full h-full object-cover" loading="lazy" />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </Tabs>

          {/* 리뷰 작성 버튼 */}
          <motion.div
            className="fixed bottom-8 right-8 z-10"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={handleWriteReview}
              size="lg"
              className="h-14 px-6 rounded-3xl shadow-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-2 border-white/20 backdrop-blur-sm transition-all duration-300"
            >
              <Edit3 className="h-5 w-5 mr-2" />
              리뷰 작성
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}