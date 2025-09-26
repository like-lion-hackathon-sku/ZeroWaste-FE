"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sparkles } from "lucide-react"
import {
  ArrowLeft, Star, MapPin, Phone, Clock, Heart, Share2, Camera, Edit3,
  Leaf, Users, Loader2, Award, Bot, QrCode, RefreshCw,
} from "lucide-react"

import { apiClient } from "@/lib/api/client"
import { calculateWasteStarRating } from "@/lib/utils/database-helpers"
import { mockRestaurants } from "@/lib/mock/restaurant-presets"

/* ───────────────── Utils ───────────────── */
function parseRawText(text: string) {
  if (!text) return ""
  return text.replace(/\n/g, "<br />")
}

/* ───────────────── 별점(부분 채움) ───────────────── */
function StarRating({
  value, outOf = 5, size = 20, colorClass = "text-green-500", emptyClass = "text-gray-300",
}: {
  value: number; outOf?: number; size?: number; colorClass?: string; emptyClass?: string
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
  detailFeedback?: string | null
  images?: string[]
  foodMenu?: { name: string; leftover_score?: number }[]
}
type UIMenuItem = {
  name?: string
  price?: string
  description?: string
  thumb?: string | null
}
type UIRestaurant = {
  id: number
  name: string
  image?: string | null
  badge?: string | null
  wasteScore?: number | null
  totalReviews?: number | null
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

/** 상세(raw)의 사진/메뉴 파일명을 presigned URL로 변환
 *  - API가 { success: { ... } } 래핑이어도 동작
 */
async function resolveSignedUrls(raw: any) {
  const src = raw?.success ?? raw

  const photoNames: string[] = Array.isArray(src?.photos)
    ? src.photos.map((p: any) => (typeof p === "string" ? p : p?.photo_name)).filter(Boolean)
    : []

  const galleryUrls = await Promise.all(
    photoNames.map((fn) => apiClient.getImageSignedUrl(2, fn).catch(() => "")),
  )

  const menus: any[] = Array.isArray(src?.menus) ? src.menus : []
  const menuThumbUrls = await Promise.all(
    menus.map((m) =>
      m?.photo ? apiClient.getImageSignedUrl(3, m.photo).catch(() => "") : Promise.resolve(""),
    ),
  )

  const menusWithThumb = menus.map((m, i) => ({ ...m, _thumbUrl: menuThumbUrls[i] || "" }))

  return { galleryUrls: galleryUrls.filter(Boolean), menusWithThumb, src }
}

/* ───────────────── 카테고리 라벨 정규화 ───────────────── */
function firstNonEmpty(...vals: any[]) {
  for (const v of vals) {
    if (Array.isArray(v) && v.length) return v
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

function toCategoryLabel(raw: any): string | null {
  const h = raw?.header ?? {}
  const t = raw?.tabs ?? {}
  const ext = raw?.external ?? {}

  const arr = Array.isArray(raw?.categories)
    ? raw.categories
    : Array.isArray(ext?.categories)
      ? ext.categories
      : Array.isArray(h?.categories)
        ? h.categories
        : Array.isArray(t?.info?.categories)
          ? t.info.categories
          : null

  const path = Array.isArray(raw?.categoryPath)
    ? raw.categoryPath
    : Array.isArray(ext?.categoryPath)
      ? ext.categoryPath
      : null

  const tiered = [
    ext?.categoryLarge ?? ext?.largeCategory ?? ext?.majorCategory,
    ext?.categoryMedium ?? ext?.middleCategory ?? ext?.midCategory,
    ext?.categorySmall ?? ext?.smallCategory ?? ext?.minorCategory,
    ext?.categoryDetail ?? ext?.detailCategory,
  ].filter(Boolean)

  const flat = firstNonEmpty(raw?.category, h?.category, t?.info?.category, ext?.category, path, arr, tiered)
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

/* ───────────────── 메뉴 이름 맵 ───────────────── */
/** 식당 raw에서 메뉴 id → name 매핑 만들기 */
function buildMenuNameMap(raw: any): Record<string, string> {
  const map: Record<string, string> = {}

  const src = raw?.success ?? raw
  const itemsA: any[] = Array.isArray(raw?.tabs?.menu?.items) ? raw.tabs.menu.items : []
  const itemsB: any[] = Array.isArray(src?.menus) ? src.menus : []

  const push = (m: any) => {
    if (!m) return
    const id =
      m?.id ?? m?.menu_id ?? m?.menuId ?? m?.item_id ?? m?.itemId ?? m?.code ?? m?.uid
    const name =
      m?.name ?? m?.menu ?? m?.menuName ?? m?.title ?? m?.label ?? m?.item ?? ""
    if (id != null && String(name).trim()) {
      map[String(id)] = String(name).trim()
    }
  }

  itemsA.forEach(push)
  itemsB.forEach(push)
  return map
}

/* ───────────────── Review 정규화 ───────────────── */
function toStringArray(v: any): string[] {
  if (!v) return []
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "string" ? x : x?.name ?? x?.menu ?? x?.title ?? ""))
      .map((s) => String(s).trim())
      .filter(Boolean)
  }
  return [String(v).trim()].filter(Boolean)
}

function extractMenuNames(r: any): string[] {
  const candidates: any[] = [
    r.menuNames, r.menus, r.items, r.orderedMenus, r.orderItems, r.dishes,
    r.foods, r.food_names, r.menu, r.menu_name, r.dish, r.food, r.food_name, r.item,
  ]
  if (Array.isArray(r.food_menu)) {
    candidates.push(r.food_menu.map((m: any) => m?.name ?? m?.menu ?? m?.item ?? m?.title ?? ""))
  }
  const names = candidates.flatMap(toStringArray).map((s) => s.replace(/\s+/g, " ").trim())
  return Array.from(new Set(names.filter(Boolean)))
}

/** 메뉴 이름 맵을 사용해 리뷰 표준화 (menuId 지원) */
const normalizeReview = (r: any, menuNameMap: Record<string, string> = {}): UIReview => {
  const u = r.user
  const name =
    typeof u === "string"
      ? u
      : (u?.name ?? u?.username ?? u?.nickname ?? r.nickname ?? r.userName ?? r.authorName ?? r.author ?? "익명")

  const ratingRaw =
    r.score ?? r.leftoverRate ?? r.waste_rating ?? r.rating ?? r.stars ?? r.star ?? r.wasteScore ?? 0

  const comment = r.contents ?? r.comment ?? r.content ?? r.text ?? ""
  const detail =
    r.detailFeedback ?? r.detail_feedback ?? r.feedback_detail ?? r.ai_feedback ?? null

  const date =
    r.createdAt ?? r.created_at ?? r.date ?? r.created ?? ""

  const images = Array.isArray(r.images)
    ? r.images.map((x: any) => (typeof x === "string" ? x : x?.url)).filter(Boolean)
    : Array.isArray(r.photos)
      ? r.photos.map((x: any) => (typeof x === "string" ? x : x?.url)).filter(Boolean)
      : []

  // ── 메뉴 추출 ──
  let foodMenu: { name: string; leftover_score?: number }[] | undefined

  if (Array.isArray(r.food_menu)) {
    // 서버가 객체 배열로 줄 때
    foodMenu = r.food_menu
      .map((m: any) => {
        // 이름 ← 주어진 값 or id를 이름맵에 치환
        let nm =
          m?.name ?? m?.menu ?? m?.menuName ?? m?.item ?? m?.title ?? m?.food ?? m?.label ?? ""
        const rawId = m?.id ?? m?.menu_id ?? m?.menuId ?? m?.item_id ?? m?.itemId ?? m?.code ?? m?.uid
        if ((!nm || !String(nm).trim()) && rawId != null) {
          const mapped = menuNameMap[String(rawId)]
          if (mapped) nm = mapped
        }

        const leftover =
          typeof m?.leftover_score === "number"
            ? m.leftover_score
            : typeof m?.score === "number"
              ? m.score
              : undefined

        const nameTrimmed = String(nm || "").trim()
        if (!nameTrimmed) return null
        return { name: nameTrimmed, leftover_score: leftover }
      })
      .filter(Boolean) as { name: string; leftover_score?: number }[]
  } else if (r.menuId != null) {
    // 단일 menuId만 있는 경우
    const idStr = String(r.menuId)
    const nm = menuNameMap[idStr] || "전체"
    const baseScore = Number(r.wasteRating ?? ratingRaw) || 0
    foodMenu = [{ name: nm, leftover_score: baseScore }]
  } else {
    // id 배열로 오는 경우
    const ids =
      (Array.isArray(r.menu_ids) && r.menu_ids) ||
      (Array.isArray(r.menuIds) && r.menuIds) ||
      (Array.isArray(r.item_ids) && r.item_ids) ||
      null

    if (ids && ids.length) {
      const baseScore = Number(r.wasteRating ?? ratingRaw) || 0
      foodMenu = ids
        .map((id: any) => {
          const nm = menuNameMap[String(id)] || ""
          if (!nm) return null
          return { name: nm, leftover_score: baseScore }
        })
        .filter(Boolean) as { name: string; leftover_score?: number }[]
    } else {
      // 문자열 키에서 추출 (fallback)
      const names = extractMenuNames(r)
      if (names.length) {
        const baseScore = Number(r.wasteRating ?? ratingRaw) || 0
        foodMenu = names
          .map((nm) => {
            const nameTrimmed = String(nm || "").trim()
            if (!nameTrimmed) return null
            return { name: nameTrimmed, leftover_score: baseScore }
          })
          .filter(Boolean) as { name: string; leftover_score?: number }[]
      }
    }
  }

  return {
    id: Number(r.id ?? r.review_id ?? 0),
    userName: (name || "익명").trim(),
    wasteRating: Number(r.wasteRating ?? ratingRaw) || 0,
    date,
    comment,
    detailFeedback: typeof detail === "string" ? detail : null,
    images,
    foodMenu,
  }
}

/* ───────────────── 리뷰 이미지: 파일명 → 서명 URL ───────────────── */
async function signReviewImageNames(list: UIReview[]): Promise<UIReview[]> {
  const cache = new Map<string, string>()
  const toUrl = async (name: string) => {
    if (!name) return ""
    if (/^https?:\/\//i.test(name)) return name
    if (cache.has(name)) return cache.get(name)!
    const url = await apiClient.getImageSignedUrl(1, name).catch(() => "")
    if (url) cache.set(name, url)
    return url
  }

  return Promise.all(
    list.map(async (r) => {
      const names = Array.isArray(r.images) ? r.images : []
      const urls = await Promise.all(names.map((n) => toUrl(String(n))))
      return { ...r, images: urls.filter(Boolean) }
    }),
  )
}

/* ───────────────── Restaurant 정규화 ───────────────── */
function normalizeRestaurant(raw: any): UIRestaurant {
  // (1) 복합 구조(예: Naver 스타일)
  if (raw?.header && raw?.tabs) {
    const h = raw.header ?? {}
    const t = raw.tabs ?? {}
    const menuItems: UIMenuItem[] = Array.isArray(t.menu?.items)
      ? t.menu.items.map((m: any) => ({ name: m?.name, price: m?.price ?? "", description: m?.description ?? "" }))
      : []
    const gallery: string[] = Array.isArray(t.gallery?.photos)
      ? t.gallery.photos.map((p: any) => (typeof p === "string" ? p : p?.url)).filter(Boolean)
      : []
    const fav = !!h.isFavorite || !!h.is_favorite || !!h.favorited || !!raw?.isFavorite || !!raw?.is_favorite || !!raw?.favorited

    return {
      id: Number(h.id ?? 0),
      name: String(h.name ?? "알 수 없는 식당"),
      image: gallery[0] ?? h.heroPhoto ?? null,
      badge: h.badge ?? null,
      wasteScore: typeof h.ecoScore === "number" ? h.ecoScore : null,
      totalReviews: typeof h.reviewCount === "number" ? h.reviewCount : 0,
      category: toCategoryLabel(raw) ?? h.category ?? null,
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

  // (2) 단순 detail 구조(네가 올린 스크린샷 형태)
  const src = raw?.success ?? raw
  const galleryFromSigned: string[] = Array.isArray(src?._galleryUrls) ? src._galleryUrls : []
  const menuArr: any[] = Array.isArray(src?.menus) ? src.menus : []
  const menu: UIMenuItem[] = menuArr.map((m: any) => ({
    name: m?.name, price: "", description: "", thumb: m?._thumbUrl || "",
  }))
  const fav = !!src?.isFavorite || !!src?.is_favorite || !!src?.favorited || !!src?.isMyFavorite

  return {
    id: Number(src?.id ?? 0),
    name: String(src?.name ?? "알 수 없는 식당"),
    image: galleryFromSigned[0] || null,
    badge: (src as any)?.badge ?? null,
    wasteScore:
      typeof (src as any)?.ecoScore === "number"
        ? (src as any).ecoScore
        : typeof (src as any)?.stats?.ecoScore === "number"
          ? (src as any).stats.ecoScore
          : null,
    totalReviews: typeof (src as any)?.reviewCount === "number" ? (src as any).reviewCount : 0,
    category: (src as any)?.category ?? null,
    distance: (src as any)?.distance ?? null,
    address: (src as any)?.address ?? null,
    telephone: (src as any)?.telephone ?? null,
    hours: (src as any)?.hours ?? null,
    description: (src as any)?.feedback ?? (src as any)?.description ?? null,
    favorited: fav,
    menu,
    gallery: galleryFromSigned,
    reviews: [],
  }
}

function MenuThumb({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <div className="relative shrink-0">
      <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl overflow-hidden border border-white/30 dark:border-slate-700/50 shadow-sm bg-muted">
        <img src={src || "/placeholder.svg"} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      </div>
    </div>
  )
}

/* ── 리뷰 → 배치분석 입력 포맷 ── */
function buildBatchFromReviews(revs: UIReview[]) {
  return revs.map((r) => {
    const hasMenus = Array.isArray(r.foodMenu) && r.foodMenu.length > 0
    type Item = { name: string; leftover_score: number; user_comment: string; detail_feedback?: string }

    const menus: Item[] = hasMenus
      ? r.foodMenu!.map((m: any): Item => ({
          name: (m?.name ?? "").toString().trim() || "전체",
          leftover_score: typeof m?.leftover_score === "number" ? m.leftover_score : Number(r.wasteRating) || 0,
          user_comment: r.comment || "",
          detail_feedback: r.detailFeedback?.trim() || undefined,
        }))
      : [{
          name: "전체",
          leftover_score: Number(r.wasteRating) || 0,
          user_comment: r.comment || "",
          detail_feedback: r.detailFeedback?.trim() || undefined,
        }]

    return {
      date: (r.date || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      time: "점심",
      food_menu: menus,
    }
  })
}

/* ───────────────── Page ───────────────── */
export default function RestaurantDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const restaurantId = Number.parseInt(params.id, 10)

  const [activeTab, setActiveTab] = useState("info")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState<any | null>(null)
  const [menuNameMap, setMenuNameMap] = useState<Record<string, string>>({})

  const [isOwnerMode, setIsOwnerMode] = useState(false)

  // 리뷰
  const [reviews, setReviews] = useState<UIReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)
  const [reviewsFetched, setReviewsFetched] = useState(false)

  // AI 호출 상태
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiRaw, setAiRaw] = useState<any>(null)

  async function loadReviewsOnce(id: number, nameMap: Record<string, string>) {
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
        const norm = list.map((r: any) => normalizeReview(r, nameMap))
        const withUrls = await signReviewImageNames(norm)
        setReviews(withUrls)
      }
    } catch (e: any) {
      setReviews([])
      setReviewsError(e?.message || "네트워크 오류가 발생했어요.")
    } finally {
      setReviewsLoading(false)
      setReviewsFetched(true)
    }
  }

  /** 🔁 배치 분석(서버 호출) — raw만 저장 */
  const analyzeOnServer = async () => {
    if (!reviews.length) {
      setAiRaw(null)
      return
    }
    setAiLoading(true)
    setAiError(null)
    try {
      const payload = buildBatchFromReviews(reviews)
      const res = await fetch("/api/ai/waste/analyze-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || "분석 실패")
      setAiRaw(data.raw ?? null)
    } catch (e: any) {
      setAiRaw(null)
      setAiError(e?.message || "AI 분석에 실패했어요.")
    } finally {
      setAiLoading(false)
    }
  }

  // 상세 + 선로딩
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      setReviewsFetched(false)
      setAiRaw(null)
      try {
        const res = await apiClient.getRestaurantDetail(restaurantId)
        if (!mounted) return
        if (!res.success) {
          setError(res.error || "식당 정보를 불러올 수 없습니다.")
          setRaw(null)
        } else {
          // detail 구조 래핑/서명 URL 처리
          const { galleryUrls, menusWithThumb, src } = await resolveSignedUrls(res.data)
          const enriched = { ...src, _galleryUrls: galleryUrls, menus: menusWithThumb }
          setRaw(enriched)

          // 메뉴 이름 맵 구성 후 리뷰 로딩
          const nameMap = buildMenuNameMap(enriched)
          setMenuNameMap(nameMap)
          await loadReviewsOnce(restaurantId, nameMap)
        }
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || "네트워크 오류가 발생했어요.")
        setRaw(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [restaurantId])

  // 리뷰 로딩 끝나면 AI 분석 1회
  useEffect(() => {
    if (!reviewsFetched || aiLoading || aiRaw !== null) return
    analyzeOnServer()
  }, [reviewsFetched])

  // 리뷰 탭 진입 시 미로드면 1회 (메뉴맵 의존)
  useEffect(() => {
    if (activeTab !== "reviews" || !restaurantId || reviewsFetched) return
    loadReviewsOnce(restaurantId, menuNameMap)
  }, [activeTab, restaurantId, reviewsFetched, menuNameMap])

  useEffect(() => {
    const ownerModeParam = searchParams.get("isOwnerMode")
    setIsOwnerMode(ownerModeParam === "true")
  }, [searchParams])

  // UI merge
  const restaurant = useMemo<UIRestaurant | null>(() => {
    if (!raw) return null
    const base = normalizeRestaurant(raw)
    const mock = mockRestaurants[base.id]
    if (!mock) return base

    const mergedDescription = [base.description, mock.facilities].filter(Boolean).join("\n\n")
    const mergedMenu = Array.isArray(mock.menu) && mock.menu.length > 0 ? mock.menu : base.menu

    return { ...base, description: mergedDescription, menu: mergedMenu, infoSections: mock.infoSections }
  }, [raw])

  // 즐겨찾기
  const isFav = ((restaurant?.favorited ?? false) || false) as boolean

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
    router.replace(`/restaurant/${restaurantId}?fav=${nextFav ? 1 : 0}`, { scroll: false })
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
      router.replace(`/restaurant/${restaurantId}?fav=${prev ? 1 : 0}`, { scroll: false })
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

  const handleWriteReview = () => router.push(`/review/write?restaurantId=${restaurantId}`)
  const handleEditRestaurant = () => router.push(`/restaurant/edit/${restaurantId}`)
  const handleUseStamp = () => router.push(`/scan?type=stamp&restaurantId=${restaurantId}`)

  // 리뷰 평균(0점 제외)
  const reviewsAvg = useMemo(() => {
    if (!reviews.length) return null
    const valid = reviews.map((r) => Number(r.wasteRating) || 0).filter((v) => v > 0)
    if (!valid.length) return null
    const sum = valid.reduce((a, b) => a + b, 0)
    return Math.round((sum / valid.length) * 10) / 10
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
          <Button onClick={() => router.back()} className="rounded-2xl bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 shadow-lg">
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
        </motion.div>
      </div>
    )
  }

  const starFromEco = calculateWasteStarRating(restaurant.wasteScore ?? 0)
  const displayStar = (reviewsAvg ?? starFromEco ?? 0)
  const displayCategory = restaurant.category || "ETC"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-sky-50/30 dark:from-slate-950 dark:via-green-950/20 dark:to-sky-950/20">
      {/* 헤더 */}
      <motion.header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 p-4 sticky top-0 z-20 shadow-lg" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-10 px-4 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-lg transition-all duration-200">
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로가기
            </Button>
          </motion.div>
          <div className="flex items-center gap-2">
            {isOwnerMode && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="ghost" size="sm" onClick={handleUseStamp} title="스탬프 사용 (QR 스캔)" className="h-10 w-10 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 shadow-lg transition-all duration-200">
                  <QrCode className="h-4 w-4 text-purple-600" />
                </Button>
              </motion.div>
            )}

            {isOwnerMode && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="ghost" size="sm" onClick={handleEditRestaurant} title="식당 정보 수정" className="h-10 w-10 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-orange-50 dark:hover:bg-orange-900/30 shadow-lg transition-all duration-200">
                  <Edit3 className="h-4 w-4 text-orange-600" />
                </Button>
              </motion.div>
            )}

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="ghost" size="sm" onClick={handleShare} title="공유하기" className="h-10 w-10 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-lg transition-all duration-200">
                <Share2 className="h-4 w-4 text-blue-600" />
              </Button>
            </motion.div>
            {!isOwnerMode && (
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
            )}
          </div>
        </div>
      </motion.header>

      {/* 히어로 */}
      <motion.div className="relative h-80 bg-muted overflow-hidden" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
        <img src={restaurant.image || "/placeholder.svg"} alt={restaurant.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 to-emerald-900/20" />
        <motion.div className="absolute bottom-6 left-6 right-6" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center gap-3 mb-4">
            {restaurant.badge && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
                <Badge variant={restaurant.badge === "착한 식당" ? "default" : "secondary"} className="bg-green-500/90 text-white border-green-400 shadow-lg backdrop-blur-sm px-3 py-1 text-sm">
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
              <span className="font-bold text-lg ml-2">{Number(displayStar).toFixed(1)}</span>
              <span className="text-sm opacity-75">({reviews.length || restaurant.totalReviews || 0})</span>
            </div>
            {displayCategory && (
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2" title={displayCategory}>
                <span className="text-sm font-medium">{displayCategory}</span>
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
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-base">{restaurant.description}</p>
                        </div>
                      )}

                      {restaurant.infoSections?.length ? (
                        <div className="mt-6 space-y-4">
                          {restaurant.infoSections.map((sec, i) => (
                            <motion.details key={`${sec.title}-${i}`} className="rounded-2xl border border-white/20 dark:border-slate-700/50 p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm shadow-lg" whileHover={{ scale: 1.01 }}>
                              <summary className="cursor-pointer font-semibold text-foreground text-lg py-2">{sec.title}</summary>
                              <div className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{sec.body}</div>
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
                      {restaurant.menu && restaurant.menu.length > 0 ? (
                        <div className="grid gap-4">
                          {restaurant.menu.map((item, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.18, delay: index * 0.02 }}
                              className="group rounded-2xl border border-white/20 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm shadow-sm hover:shadow-lg hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all duration-200"
                            >
                              <div className="p-4 md:p-5 flex items-center gap-4 md:gap-5">
                                {item.thumb ? <MenuThumb src={item.thumb} alt={item.name || "menu"} /> : <MenuThumb src={null} alt={item.name || "menu"} />}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <h3 className="font-semibold text-foreground text-base md:text-lg leading-snug line-clamp-1">{item.name || "메뉴"}</h3>
                                    {item.price && (
                                      <span className="shrink-0 px-3 py-1.5 rounded-xl text-sm md:text-base font-bold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200/50 dark:border-green-800/60">
                                        {item.price}
                                      </span>
                                    )}
                                  </div>
                                  {item.description && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <motion.div className="text-center text-muted-foreground py-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <Sparkles className="h-16 w-16 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">메뉴 정보가 없습니다</p>
                        </motion.div>
                      )}
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
                              <img src={image || "/placeholder.svg"} alt={`${restaurant.name} 사진 ${index + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-pointer" />
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
                  {/* 요약 숫자 카드 */}
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
                          <div className="text-3xl font-bold text-blue-600 mb-2">{reviews.length || restaurant.totalReviews || 0}</div>
                          <div className="text-sm text-muted-foreground font-medium">총 리뷰</div>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl">
                          <div className="text-3xl font-bold text-green-600 mb-2">{displayStar}</div>
                          <div className="text-sm text-muted-foreground font-medium">평균 잔반 별점</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* AI raw — 사장님 모드에서만 */}
                  {isOwnerMode && (
                    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 dark:border-slate-700/50 shadow-xl rounded-3xl overflow-hidden">
                      <CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-white/20 dark:border-slate-700/50">
                        <CardTitle className="flex items-center justify-between text-xl">
                          <span className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                              <Bot className="h-5 w-5 text-white" />
                            </div>
                            AI 원본 결과 (raw)
                          </span>
                          <Button variant="ghost" size="sm" onClick={analyzeOnServer} className="rounded-xl hover:bg-white/60 dark:hover:bg-slate-700/50" title="다시 분석">
                            <RefreshCw className={`h-4 w-4 ${aiLoading ? "animate-spin" : ""}`} />
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        {aiLoading ? (
                          <div className="flex items-center justify-center py-10 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" /> 분석 중…
                          </div>
                        ) : aiError ? (
                          <div className="text-center text-red-500 py-8 bg-red-50 dark:bg-red-900/20 rounded-xl">{aiError}</div>
                        ) : aiRaw == null ? (
                          <div className="text-center text-muted-foreground py-8">아직 보여줄 결과가 없어요.</div>
                        ) : typeof aiRaw === "string" ? (
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: parseRawText(aiRaw) }} />
                        ) : Array.isArray(aiRaw) ? (
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed">{aiRaw.join("\n")}</pre>
                        ) : typeof aiRaw === "object" ? (
                          <pre className="whitespace-pre overflow-auto rounded-xl bg-slate-50 dark:bg-slate-900/40 p-4 text-xs">{JSON.stringify(aiRaw, null, 2)}</pre>
                        ) : (
                          <div>알 수 없는 데이터 형식</div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* 리뷰 목록 */}
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
                        <div className="text-center text-red-500 py-12 bg-red-50 dark:bg-red-900/20">{reviewsError}</div>
                      ) : reviews.length === 0 ? (
                        <div className="text-center text-muted-foreground py-16 bg-slate-50 dark:bg-slate-800/50">아직 등록된 리뷰가 없어요.</div>
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

                                  {/* 메뉴 라벨 (있을 때만) */}
                                  {rv.foodMenu && rv.foodMenu.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {rv.foodMenu.slice(0, 6).map((m, i) => (
                                        <span key={`${m.name}-${i}`} className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">
                                          {m.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {rv.comment && <p className="mt-2 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{rv.comment}</p>}

                                  {/* 사용자 모드에서는 리뷰 사진 숨김 */}
                                  {isOwnerMode && rv.images && rv.images.length > 0 && (
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                      {rv.images.slice(0, 6).map((img, idx) => (
                                        <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-muted">
                                          <img src={img || "/placeholder.svg"} alt={`review-${rv.id}-${idx}`} className="w-full h-full object-cover" loading="lazy" />
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

          {!isOwnerMode && (
            <motion.div className="fixed bottom-8 right-8 z-10" initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 1 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={handleWriteReview} size="lg" className="h-14 px-6 rounded-3xl shadow-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-2 border-white/20 backdrop-blur-sm transition-all duration-300">
                <Edit3 className="h-5 w-5 mr-2" />
                리뷰 작성
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}