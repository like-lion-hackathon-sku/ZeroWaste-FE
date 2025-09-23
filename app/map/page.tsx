"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Script from "next/script"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Leaf,
  LogOut,
  Star,
  MapPin,
  Loader2,
  LocateFixed,
  User,
  Search,
  MessageCircle,
  Navigation,
  X,
  Heart,
  Bell,
  ChevronRight,
} from "lucide-react"
import { createPortal } from "react-dom"

import { useRestaurants } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { CATEGORY_IMAGE } from "@/lib/category-images"
import { calculateWasteStarRating } from "@/lib/utils/database-helpers"

declare global {
  interface Window {
    naver: any
  }
}
const toSignedRestaurantUrl = async (fn?: string | null): Promise<string | null> => {
  if (!fn || typeof fn !== "string") return null
  try {
    return await apiClient.getImageSignedUrl(2, fn)           // ← 상세와 동일
  } catch {
    // 공개로 서빙되는 경우가 있다면 폴백
    return (apiClient as any)?.getImageUrlByType?.(2, fn) ?? null
  }
}
/* ─── 카테고리/이미지 유틸 ─── */
const normalizeImage = (v: any): string | null => {
  if (typeof v !== "string") return null
  const s = v.trim()
  if (!s) return null
  // http, https, / 시작 뿐 아니라 uploads 같은 상대경로도 허용
  if (s.startsWith("http") || s.startsWith("/") || s.startsWith("uploads")) return s
  return null
}
const CATEGORY_SYNONYM: Record<string, string[]> = {
  한식: ["한식", "백반", "분식", "국밥", "족발", "보쌈", "삼겹", "비빔밥", "갈비", "냉면", "곰탕", "칼국수"],
  중식: ["중식", "짬뽕", "짜장", "탕수육", "중화요리"],
  일식: ["일식", "스시", "초밥", "라멘", "라면", "돈카츠", "돈까스", "우동", "덮밥"],
  양식: ["양식", "파스타", "스테이크", "피자", "리조또", "브런치", "이탈리안", "western"],
  카페: ["카페", "coffee", "coffeeshop", "tearoom"],
  패스트푸드: ["패스트푸드", "버거", "치킨", "피자", "샌드위치", "패스트", "fastfood"],
  기타: ["기타", "pub", "bar", "술집", "호프", "포차"],
}
function getCategoryKey(raw?: string | null, name?: string | null): keyof typeof CATEGORY_IMAGE {
  const text = `${raw ?? ""} ${name ?? ""}`.toLowerCase().replace(/[>,]/g, " ").replace(/\s+/g, " ").trim()
  const order: (keyof typeof CATEGORY_IMAGE)[] = ["한식", "중식", "일식", "양식", "카페", "패스트푸드", "기타"]
  for (const key of order) if (CATEGORY_SYNONYM[key].some((w) => text.includes(w))) return key
  return "기타"
}
function getImageForRestaurant(category?: string | null, name?: string | null) {
  const key = getCategoryKey(category, name)
  return CATEGORY_IMAGE[key] || CATEGORY_IMAGE["기타"]
}
const pickImage = (rawImg?: string | null, category?: string | null, name?: string | null) =>
  normalizeImage(rawImg) ?? getImageForRestaurant(category, name)
/* ─── 타입/상수 ─── */
type WasteTier = "UNRANK" | "브론즈" | "실버" | "골드" | "플래티넘" | "다이아"

type RestaurantItem = {
  id?: number
  restaurantId?: number
  name: string
  image?: string | null
  category?: string | null
  badge?: string | null
  description?: string | null
  address?: string | null
  telephone?: string | null
  distance?: string | null
  favorited?: boolean
  wasteScore?: number | null
  displayScore?: number | null
  reviewCount?: number | null
  aiWaste100?: number | null
  wasteTier?: WasteTier | null
  mapx?: number | null
  mapy?: number | null
}

const STORAGE_KEY = "ecoEats.mapState.v2"

/* ─── 별점 정규화 ─── */
const clamp05 = (v: any): number => {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(5, Math.round(n * 10) / 10))
}
const toDisplay5 = (raw: any): number => clamp05(calculateWasteStarRating(Number(raw) || 0))

/* ─── 티어 판정 ─── */
function calcTier(reviewCount?: number | null, ai100?: number | null): WasteTier | null {
  const rc = Number(reviewCount ?? 0)
  const s = Number(ai100 ?? Number.NaN)
  if (rc >= 0 && rc <= 5) return "UNRANK"
  if (!Number.isFinite(s)) return null
  if (s < 20) return "브론즈"
  if (s < 40) return "실버"
  if (s < 60) return "골드"
  if (s < 80) return "플래티넘"
  return "다이아"
}

const getTierColor = (tier: WasteTier | null) => {
  switch (tier) {
    case "브론즈":
      return "bg-gradient-to-r from-amber-600 to-amber-700 text-white"
    case "실버":
      return "bg-gradient-to-r from-slate-400 to-slate-500 text-white"
    case "골드":
      return "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white"
    case "플래티넘":
      return "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white"
    case "다이아":
      return "bg-gradient-to-r from-purple-600 to-purple-700 text-white"
    case "UNRANK":
      return "bg-gradient-to-r from-gray-400 to-gray-500 text-white"
    default:
      return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-600"
  }
}
const getTierIcon = (tier: WasteTier | null) => {
  switch (tier) {
    case "브론즈":
    case "실버":
      return "🥄"
    case "골드":
      return "🍴"
    case "플래티넘":
      return "🍽️"
    case "다이아":
      return "💎"
    case "UNRANK":
      return "🥢"
    default:
      return "❓"
  }
}
const getTierName = (tier: WasteTier | null) => (tier === "UNRANK" ? "언랭" : tier || "미정")

const renderStars = (rating: number) => {
  const stars = []
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) stars.push(<Star key={i} className="h-4 w-4 fill-green-500 text-green-500" />)
    else if (i === fullStars && hasHalfStar)
      stars.push(<Star key={i} className="h-4 w-4 fill-green-500/50 text-green-500" />)
    else stars.push(<Star key={i} className="h-4 w-4 text-gray-300" />)
  }
  return stars
}

/* ─── 페이지 ─── */
export default function MapWithListPage() {
  const router = useRouter()
  const [naverReady, setNaverReady] = useState(false)

  // 로그인 플래그
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  useEffect(() => {
    const read = () => {
      try {
        setIsLoggedIn(!!localStorage.getItem("userId"))
      } catch {
        setIsLoggedIn(false)
      }
    }
    read()
    const onStorage = (e: StorageEvent) => {
      if (e.key === "userId") read()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (!isLoggedIn) {
      setFavoriteIds(new Set())
      return
    }
    ;(async () => {
      try {
        await apiClient.refresh().catch(() => {})
        const res = await apiClient.getFavorites()
        const items =
          (res as any)?.data?.items ??
          (res as any)?.success?.items ??
          (Array.isArray((res as any)?.items) ? (res as any).items : [])
        const ids = new Set<number>(
          items
            .map((it: any) => it.restaurant_id ?? it.restaurantId ?? it.id)
            .filter((x: any) => Number.isFinite(Number(x)))
            .map((x: any) => Number(x)),
        )
        setFavoriteIds(ids)
      } catch (e) {
        console.warn("load favorites failed:", e)
      }
    })()
  }, [isLoggedIn])

  // 지도 refs
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapObjRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const hereMarkerRef = useRef<any>(null)

  // 데이터
  const { data: rawRestaurants, loading } = useRestaurants()
  const [mapRestaurants, setMapRestaurants] = useState<RestaurantItem[]>([])
  const [loadingMapRestaurants, setLoadingMapRestaurants] = useState(false)
  const [useMapList, setUseMapList] = useState(false)

  // 검색어 ── ✅ 기본값 "맛집"
  const [kw, setKw] = useState("맛집")
  const restoredRef = useRef(false)
  const autoSearchOnceRef = useRef(false) // ✅ 자동검색 1회 플래그

  // 필터 상태
  const [sortKey, setSortKey] = useState<"rating" | "reviews">("rating")
  const [tierFilter, setTierFilter] = useState<"ALL" | WasteTier>("ALL")

  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null)

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "badge",
      title: "🏆 새로운 뱃지 달성!",
      message: "친환경 전사 뱃지를 획득했습니다",
      isRead: false,
      createdAt: new Date(),
      actionUrl: "/profile",
    },
    {
      id: 2,
      type: "review",
      title: "📝 리뷰 작성 완료",
      message: "다이아몬드스타 광화문점 리뷰가 등록되었습니다",
      isRead: false,
      createdAt: new Date(Date.now() - 3600000),
      actionUrl: "/profile",
    },
  ])
  const [showNotifications, setShowNotifications] = useState(false)

  /* ─── 유틸 ─── */
  const fixCoord = (v: any) => {
    if (v == null) return null
    const n = Number(v)
    if (!Number.isFinite(n)) return null
    if (Math.abs(n) <= 180) return n
    if (Math.abs(n) > 1e3) return n / 1e7
    return null
  }
  const fetchJson = async (url: string, init?: RequestInit) => {
    try {
      if (typeof (apiClient as any)?.request === "function") {
        const pathOnly = url.startsWith("/") ? url : `/${url}`
        return (apiClient as any).request(pathOnly, init)
      }
      const r1 = await fetch(`/_be${url}`, { credentials: "include", ...init })
      if (r1.ok) return r1.json()
    } catch {}
    const r2 = await fetch(`/api${url}`, { credentials: "include", ...init })
    return r2.json()
  }

  async function reverseToRegion(lat: number, lng: number) {
    const svc = window.naver?.maps?.Service
    if (!svc) return { gu: "", dong: "" }
    const coords = new window.naver.maps.LatLng(lat, lng)
    return new Promise<{ gu: string; dong: string }>((resolve) => {
      svc.reverseGeocode({ coords, orders: window.naver.maps.Service.OrderType.ADDR }, (_s: any, res: any) => {
        const region = res?.v2?.results?.[0]?.region
        resolve({ gu: region?.area2?.name || "", dong: region?.area3?.name || "" })
      })
    })
  }
  async function buildQueriesFromBounds(keyword: string) {
    if (!mapObjRef.current) return [keyword]
    const b = mapObjRef.current.getBounds()
    const c = b.getCenter(),
      sw = b.getSW(),
      ne = b.getNE()
    const pts = [
      { lat: c.y, lng: c.x },
      { lat: sw.y, lng: sw.x },
      { lat: ne.y, lng: ne.x },
    ]
    const regions = await Promise.all(pts.map((p) => reverseToRegion(p.lat, p.lng)))
    const qs = new Set<string>()
    const base = (keyword || "카페").trim()
    qs.add(base)
    regions.forEach((r) => {
      if (r.gu) qs.add(`${r.gu} ${base}`)
      if (r.dong) qs.add(`${r.dong} ${base}`)
    })
    return Array.from(qs).slice(0, 6)
  }
  const callNearby = (q: string, display = 30, start = 1) => {
    const search = new URLSearchParams({ q, display: String(display), start: String(start) })
    return fetchJson(`/restaurants/nearby?${search.toString()}`)
  }
  async function fetchNearbyForQueries(qs: string[]) {
    const pages = await Promise.all(qs.map((q) => callNearby(q, 30, 1)))
    const items = pages.flatMap((res) => {
      const d = (res as any)?.data ?? res ?? {}
      return (d as any)?.success?.items ?? (d as any)?.items ?? []
    })
    const uniq = new Map<string, any>()
    for (const r of items) {
      const key = `${r.name || ""}__${r.address || ""}`
      if (!uniq.has(key)) uniq.set(key, r)
    }
    return Array.from(uniq.values())
  }
  function filterInBounds(list: RestaurantItem[]) {
    const b = mapObjRef.current.getBounds()
    const sw = b.getSW(),
      ne = b.getNE()
    const pad = 0.1 * Math.max(ne.y - sw.y, ne.x - sw.x)
    return list.filter(
      (r) =>
        r.mapy != null &&
        r.mapx != null &&
        r.mapy >= sw.y - pad &&
        r.mapy <= ne.y + pad &&
        r.mapx >= sw.x - pad &&
        r.mapx <= ne.x + pad,
    )
  }
  const avgFromReviews05 = (reviews: any[]): number | null => {
    if (!Array.isArray(reviews) || reviews.length === 0) return null
  
    const pick = (r: any): number | null => {
      // 흔한 케이스부터: 납작/중첩/문자숫자 모두 커버
      const candidates = [
        r?.waste_rating, r?.wasteRating, r?.wasteScore, r?.waste_score,
        r?.ecoScore, r?.score, r?.rating, r?.stars, r?.star, r?.value,
        r?.rating?.value, r?.rating?.score, r?.scores?.waste, r?.scores?.overall,
      ]
      for (const c of candidates) {
        const n = Number(c)
        if (Number.isFinite(n)) {
          // 100점제면 5점제로 변환
          return n > 5 ? toDisplay5(n) : clamp05(n)
        }
      }
      return null
    }
  
    const nums: number[] = []
    for (const r of reviews) {
      const v = pick(r)
      if (v != null) nums.push(v)
    }
    if (nums.length === 0) return null
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length
    return clamp05(avg)
  }

  // 상세/리뷰 → 점수/리뷰수/티어 보강
  const enrichWithDbScores = async (items: RestaurantItem[]): Promise<RestaurantItem[]> => {
    const toId = (it: any) => Number(it.id ?? 0) || 0
  
    const targets = items.map((it) => ({ id: toId(it), it })).filter((x) => x.id > 0)
    if (!targets.length) return items
  
    // 상세
    const detailResults = await Promise.allSettled(
      targets.map(({ id }) => fetchJson(`/restaurants/${id}/detail`))
    )
  
    const idTo = new Map<number, { hero?: string | null; ai100?: number; display5?: number }>()
await Promise.all(detailResults.map(async (pr, i) => {
  if (pr.status !== "fulfilled") return
  const dwrap = (pr.value as any)?.data ?? (pr.value as any)?.success ?? pr.value ?? {}

  // hero 이미지
  let hero: string | null = null
  if (Array.isArray(dwrap?.photos) && dwrap.photos.length > 0) {
    const fn = typeof dwrap.photos[0] === "string"
      ? dwrap.photos[0]
      : dwrap.photos[0]?.photo_name || dwrap.photos[0]?.fileName
    hero = await toSignedRestaurantUrl(fn)
  }

  // 평점 원천들: 100점제/5점제 혼재 가능
  const eco100 = Number(
    dwrap?.ecoScore ??
    dwrap?.stats?.ecoScore ??
    dwrap?.score ??
    dwrap?.scores?.eco
  )

  const avg05 = Number(
    dwrap?.avgRating ??
    dwrap?.rating ??
    dwrap?.stats?.avgRating ??
    dwrap?.stats?.avgWasteRating ??
    dwrap?.ratings?.avg
  )

  let display5: number | undefined
  if (Number.isFinite(avg05)) display5 = clamp05(avg05)
  else if (Number.isFinite(eco100)) display5 = toDisplay5(eco100)

  idTo.set(targets[i].id, {
    hero,
    ai100: Number.isFinite(eco100) ? eco100 : undefined,
    display5,
  })
}))
  
    // ✅ 리뷰
    const reviewResults = await Promise.allSettled(
      targets.map(({ id }) => fetchJson(`/restaurants/${id}/reviews`))
    )
    const idToReview = new Map<number, { count: number; avg05: number | null }>()
    reviewResults.forEach((pr, i) => {
      if (pr.status !== "fulfilled") return
      const payload = (pr.value as any)?.data ?? (pr.value as any)?.success ?? pr.value ?? {}
      const list = Array.isArray(payload) ? payload : (payload?.items ?? [])
      idToReview.set(targets[i].id, { count: list.length, avg05: avgFromReviews05(list) })
    })
  
    // 머지
    return items.map((r) => {
      const id = Number(r.restaurantId ?? r.id ?? 0) || 0
      const d = idTo.get(id)
      const rr = idToReview.get(id)
  
      const display5 =
        r.displayScore != null ? clamp05(r.displayScore)
        : d?.display5 != null ? clamp05(d.display5)
        : (rr?.avg05 ?? 0)
  
      const ai100 = d?.ai100 ?? r.aiWaste100 ?? null
      const rcnt = rr?.count ?? r.reviewCount ?? null
  
      const imageFromDetail = d?.hero ?? null
      return {
        ...r,
        image: imageFromDetail ?? r.image ?? pickImage(r.image, r.category, r.name),
        displayScore: display5,
        aiWaste100: ai100,
        reviewCount: rcnt,
        wasteTier: calcTier(rcnt, ai100),
      }
    })
  }

  // 상태 저장/복원
  const saveState = (kwStr: string, list: RestaurantItem[]) => {
    try {
      const center = mapObjRef.current?.getCenter?.()
      const zoom = mapObjRef.current?.getZoom?.()
      const payload = {
        kw: kwStr,
        list,
        useMapList: true,
        center: center ? { lat: center.y, lng: center.x } : null,
        zoom: Number.isFinite(zoom) ? zoom : null,
        ts: Date.now(),
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (e) {
      console.warn("saveState failed", e)
    }
  }
  const tryRestoreState = () => {
    if (restoredRef.current) return false
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const parsed = JSON.parse(raw)
      if (typeof parsed.kw === "string") setKw(parsed.kw)
      if (Array.isArray(parsed.list)) {
        setMapRestaurants(parsed.list)
        setUseMapList(!!parsed.useMapList)
      }
      setTimeout(() => {
        if (!mapObjRef.current) return
        if (parsed.center)
          mapObjRef.current.setCenter(new window.naver.maps.LatLng(parsed.center.lat, parsed.center.lng))
        if (Number.isFinite(parsed.zoom)) mapObjRef.current.setZoom(parsed.zoom)
      }, 0)
      restoredRef.current = true
      return true
    } catch (e) {
      console.warn("restoreState failed", e)
      return false
    }
  }

  /* ✅ 즐겨찾기: id 기반 (정렬/필터/검색 뒤섞여도 안전) */
  const toggleFavoriteById = async (restaurantId?: number, nextFavorite?: boolean) => {
    if (!isLoggedIn || !Number.isFinite(Number(restaurantId))) return
    const id = Number(restaurantId)

    const base = useMapList ? mapRestaurants : restaurants
    const applyLocal = (v: boolean) => {
      const next = base.map((x) => (Number(x.id ?? x.restaurantId) === id ? { ...x, favorited: v } : x))
      setMapRestaurants(next)
      setUseMapList(true)
      saveState(kw, next)
      setFavoriteIds((old) => {
        const s = new Set(old)
        if (v) s.add(id)
        else s.delete(id)
        return s
      })
    }

    try {
      const prev = favoriteIds.has(id)
      const target = typeof nextFavorite === "boolean" ? nextFavorite : !prev
      applyLocal(target)
      if (target) {
        const rs = await apiClient.addFavorite(id)
        if (!rs?.success) throw new Error(rs?.error || "즐겨찾기 추가 실패")
      } else {
        const rs = await apiClient.removeFavorite(id)
        if (!rs?.success) throw new Error(rs?.error || "즐겨찾기 해제 실패")
      }
    } catch (e: any) {
      // 실패 시 롤백
      applyLocal(!nextFavorite)
      alert(e?.message || "즐겨찾기 실패")
    }
  }

  // 검색
  const handleSearchCurrentBounds = async () => {
    if (!mapObjRef.current) return
    if (!kw.trim()) {
      alert("검색어를 입력해주세요.")
      return
    }
    try {
      setLoadingMapRestaurants(true)
      const qs = await buildQueriesFromBounds(kw.trim())
      const raw = await fetchNearbyForQueries(qs)
      const mapped: RestaurantItem[] = await Promise.all(
        raw.map(async (r: any) => {
          const fn =
            Array.isArray(r.photos) && r.photos.length > 0
              ? (typeof r.photos[0] === "string" ? r.photos[0] : r.photos[0]?.photo_name || r.photos[0]?.fileName)
              : null
          const photoUrl = fn ? await toSignedRestaurantUrl(fn) : null
      
          const rawId = r.restaurantId ?? r.restaurant_id ?? r.id ?? r._id ?? r.restId ?? r.rest_id
const idNum = Number(rawId) || undefined
          const isFavByServer = !!r.favorited
          const isFavByMe = idNum != null && favoriteIds.has(Number(idNum))
          const rawScore = r.wasteScore ?? r.waste_score ?? r.score ?? r.ecoScore ?? null
const displayScore = rawScore != null ? toDisplay5(rawScore) : null
      
          return {
            id: idNum,
            restaurantId: idNum,
            name: r.name,
            image: photoUrl ?? r.image ?? pickImage(r.image, r.category, r.name),
            category: r.category ?? null,
            badge: r.badge ?? null,
            address: r.address ?? null,
            telephone: r.telephone ?? null,
            description: r.address ?? r.description ?? null,
            distance: r.distance ?? null,
            favorited: isFavByServer || isFavByMe,
            wasteScore: Number(rawScore) || null,
            displayScore,
            mapx: fixCoord(r.lng ?? r.mapx),
            mapy: fixCoord(r.lat ?? r.mapy),
          }
        })
      )
      let filtered = filterInBounds(mapped)
      if (!filtered.length) filtered = mapped
      const enriched = await enrichWithDbScores(filtered)
      setMapRestaurants(enriched)
      setUseMapList(true)
      saveState(kw, enriched)
    } catch {
      setMapRestaurants([])
      setUseMapList(true)
      saveState(kw, [])
    } finally {
      setLoadingMapRestaurants(false)
    }
  }

  // 파생: 서버 or 지도검색 리스트
  const restaurants: RestaurantItem[] = useMemo(() => {
    const src = useMapList ? mapRestaurants : ((rawRestaurants as any[]) ?? [])
    if (!Array.isArray(src)) return []
    return src.map((r: any) => {
      const rawId = r.restaurantId ?? r.restaurant_id ?? r.id ?? r._id ?? r.restId ?? r.rest_id
      const idNum = Number(rawId) || undefined
      const lng = fixCoord(r.lng ?? r.mapx)
      const lat = fixCoord(r.lat ?? r.mapy)
      const fav = r.favorited || (idNum != null && favoriteIds.has(Number(idNum)))
      const displayScore =
        r.displayScore != null ? clamp05(r.displayScore) : r.wasteScore != null ? toDisplay5(r.wasteScore) : 0
  
      return {
        ...r,
        id: idNum,
        // ✅ 여기서는 비동기 호출 불가 → 이미 세팅된 r.image 사용, 없으면 카테고리 기본
        image: r.image ?? pickImage(r.image, r.category, r.name),
        displayScore,
        mapx: lng,
        mapy: lat,
        description: r.address ?? r.description ?? null,
        favorited: fav,
      } as RestaurantItem
    })
  }, [rawRestaurants, mapRestaurants, useMapList, favoriteIds])

  // ✅ 필터 적용 리스트
  const filteredRestaurants = useMemo(() => {
    let list = [...restaurants]
    if (tierFilter !== "ALL") list = list.filter((r) => (r.wasteTier ?? null) === tierFilter)
    if (sortKey === "rating") list.sort((a, b) => (b.displayScore ?? 0) - (a.displayScore ?? 0))
    else list.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    return list
  }, [restaurants, sortKey, tierFilter])

  const goDetail = (restaurantId?: number, favorited?: boolean, catRaw?: string | null) => {
    if (!restaurantId) {
      alert("식당 상세를 보려면 즐겨찾기 추가 후 가능합니다.")
      return
    }
    saveState(kw, mapRestaurants.length ? mapRestaurants : restaurants)
    router.push(
      `/restaurant/${restaurantId}?fav=${favorited ? "1" : "0"}${catRaw ? `&cat=${encodeURIComponent(catRaw)}` : ""}`,
    )
  }
  const flyTo = (lat: number, lng: number) => {
    if (!mapObjRef.current) return
    const pos = new window.naver.maps.LatLng(lat, lng)
    mapObjRef.current.setCenter(pos)
    mapObjRef.current.setZoom(15)
  }
  const handleLogout = async () => {
    try {
      await apiClient.logout().catch(() => {})
    } finally {
      try {
        localStorage.removeItem("userId")
      } catch {}
      setIsLoggedIn(false)
      router.push("/login")
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const markAsRead = (notificationId: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)))
  }

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id)
    setShowNotifications(false)
    router.push(notification.actionUrl)
  }

  /* ─── 지도 초기화 ─── */
  useEffect(() => {
    if (typeof window !== "undefined" && window.naver?.maps) setNaverReady(true)
  }, [])
  useEffect(() => {
    if (!naverReady || !mapRef.current || mapObjRef.current) return
    const map = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(37.3595704, 127.105399),
      zoom: 12,
    })
    mapObjRef.current = map
    tryRestoreState()
    const hasSaved = !!sessionStorage.getItem(STORAGE_KEY)
    if (!hasSaved && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const here = new window.naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude)
          hereMarkerRef.current = new window.naver.maps.Marker({
            position: here,
            map,
            icon: {
              content:
                '<div style="background:#3b82f6;width:12px;height:12px;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 8px rgba(0,0,0,.3)"></div>',
              size: new window.naver.maps.Size(12, 12),
            },
          })
          map.setCenter(here)
          map.setZoom(14)
        },
        () => console.warn("초기 위치 접근 실패"),
      )
    }
    return () => {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
      mapObjRef.current = null
      hereMarkerRef.current = null
    }
  }, [naverReady])

  // ✅ 맵이 준비되고 최초 idle 시점에 ‘맛집’ 현 지도 자동 검색 (세션 복원 시 스킵)
  useEffect(() => {
    if (!naverReady || !mapObjRef.current) return
    if (autoSearchOnceRef.current || restoredRef.current) return
    if (!kw.trim()) return

    const onceIdle = window.naver.maps.Event.addListener(mapObjRef.current, "idle", async () => {
      if (autoSearchOnceRef.current) return
      autoSearchOnceRef.current = true
      await handleSearchCurrentBounds()
      window.naver.maps.Event.removeListener(onceIdle)
    })

    return () => {
      try {
        window.naver.maps.Event.removeListener(onceIdle)
      } catch {}
    }
  }, [naverReady, kw])

  useEffect(() => {
    if (!naverReady || !mapObjRef.current) return
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    filteredRestaurants.forEach((r) => {
      if (r.mapy != null && r.mapx != null) {
        const pos = new window.naver.maps.LatLng(r.mapy, r.mapx)
        const marker = new window.naver.maps.Marker({ position: pos, map: mapObjRef.current, title: r.name })
        window.naver.maps.Event.addListener(marker, "click", () => {
          setSelectedRestaurant({ ...r })
        })
        markersRef.current.push(marker)
      }
    })
  }, [filteredRestaurants, naverReady])

  const recenterToUser = () => {
    if (!mapObjRef.current || !navigator.geolocation) {
      alert("현재 위치를 사용할 수 없습니다.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = new window.naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude)
        if (hereMarkerRef.current) hereMarkerRef.current.setPosition(here)
        else {
          hereMarkerRef.current = new window.naver.maps.Marker({
            position: here,
            map: mapObjRef.current,
            icon: {
              content:
                '<div style="background:#3b82f6;width:12px;height:12px;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 8px rgba(0,0,0,.3)"></div>',
              size: new window.naver.maps.Size(12, 12),
            },
          })
        }
        mapObjRef.current.setCenter(here)
        mapObjRef.current.setZoom(14)
        saveState(kw, mapRestaurants.length ? mapRestaurants : restaurants)
      },
      (err) => {
        alert("현재 위치를 불러올 수 없습니다. 위치 권한을 허용해주세요.")
        console.warn("위치 접근 실패:", err)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-green-50/30 to-sky-50/30 dark:from-slate-950 dark:via-green-950/20 dark:to-sky-950/20">
      {/* Naver SDK */}
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=geocoder`}
        strategy="afterInteractive"
        onLoad={() => setNaverReady(true)}
        onError={(e) => console.error("Naver Maps script load error", e)}
      />

      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-white/30 dark:border-slate-800/50 shadow-xl"
      >
        <div className="flex items-center gap-4 p-4">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative p-3 rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 shadow-lg">
              <Leaf className="h-7 w-7 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
                ZeroWaste
              </h1>
              <p className="text-xs text-muted-foreground">친환경 맛집 찾기</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchCurrentBounds()}
                placeholder="맛집을 검색해보세요..."
                className="h-12 w-full pl-12 pr-4 rounded-2xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-sm outline-none focus:ring-2 focus:ring-green-500/40 shadow-lg placeholder:text-muted-foreground/60"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Button
                  size="sm"
                  onClick={handleSearchCurrentBounds}
                  className="h-8 px-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-md"
                >
                  <Search className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="h-11 px-4 rounded-2xl bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-700 shadow-lg border border-white/50 dark:border-slate-700/50 relative"
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">알림</span>
                      {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                          {unreadCount}
                        </div>
                      )}
                    </Button>
                  </motion.div>
                </>
              )}

              {isLoggedIn && (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/profile")}
                    className="h-11 px-4 rounded-2xl bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-700 shadow-lg border border-white/50 dark:border-slate-700/50"
                  >
                    <User className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">프로필</span>
                  </Button>
                </motion.div>
              )}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="h-11 px-4 rounded-2xl bg-white/70 dark:bg-slate-800/70 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-lg border border-white/50 dark:border-slate-700/50 text-red-600 hover:text-red-700"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">로그아웃</span>
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex flex-1 min-h-0">
        {/* ── 왼쪽 사이드 리스트 (데스크탑) ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="hidden md:flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-white/20 dark:border-slate-800/30 shadow-2xl md:w-[500px] min-h-0"
        >
          {/* 고정 헤더 (타이틀 + 필터) */}
          <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/30">
            <div className="p-6 pr-7 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  주변 맛집
                </h2>
                <Badge
                  variant="secondary"
                  className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full font-semibold shadow-sm"
                >
                  {filteredRestaurants.length}곳
                </Badge>
              </div>

              {/* 필터 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant={sortKey === "rating" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSortKey("rating")}
                      className={`h-11 px-4 rounded-2xl font-medium transition-all duration-300 shadow-lg ${
                        sortKey === "rating"
                          ? "bg-gradient-to-r from-yellow-500 via-yellow-600 to-orange-500 hover:from-yellow-600 hover:via-yellow-700 hover:to-orange-600 text-white shadow-yellow-200 dark:shadow-yellow-900/50"
                          : "bg-white/90 dark:bg-slate-800/90 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⭐</span>
                        <span>별점순</span>
                      </div>
                    </Button>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant={sortKey === "reviews" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSortKey("reviews")}
                      className={`h-11 px-4 rounded-2xl font-medium transition-all duration-300 shadow-lg ${
                        sortKey === "reviews"
                          ? "bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 hover:from-blue-600 hover:via-blue-700 hover:to-cyan-600 text-white shadow-blue-200 dark:shadow-blue-900/50"
                          : "bg-white/90 dark:bg-slate-800/90 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:shadow-md"
                      }`}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      리뷰순
                    </Button>
                  </motion.div>
                </div>

                {/* 티어 필터 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-muted-foreground">등급 필터</label>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant={tierFilter === "ALL" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTierFilter("ALL")}
                        className={`h-8 w-full rounded-lg font-medium transition-all duration-300 text-xs ${
                          tierFilter === "ALL"
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                            : "bg-white/90 dark:bg-slate-800/90 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        }`}
                      >
                        <span className="text-sm mr-1">🍽️</span>
                        전체
                      </Button>
                    </motion.div>

                    {(
                      [
                        ["UNRANK", "언랭"],
                        ["브론즈", "브론즈"],
                        ["실버", "실버"],
                        ["골드", "골드"],
                        ["플래티넘", "플래티넘"],
                        ["다이아", "다이아"],
                      ] as const
                    ).map(([tier, name]) => (
                      <motion.div key={tier} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          variant={tierFilter === tier ? "default" : "outline"}
                          size="sm"
                          onClick={() => setTierFilter(tier)}
                          className={`h-8 w-full rounded-lg font-medium transition-all duration-300 text-xs ${
                            tierFilter === tier
                              ? getTierColor(tier) + " shadow-md"
                              : "bg-white/90 dark:bg-slate-800/90 hover:bg-gray-50 dark:hover:bg-gray-900/20"
                          }`}
                        >
                          <span className="text-sm mr-1">{getTierIcon(tier)}</span>
                          {name}
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 스크롤 리스트 */}
          <div className="flex-1 overflow-y-auto p-6 pr-7">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center space-y-4">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-green-500" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full bg-green-500/20 animate-pulse mx-auto" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-medium">맛집 정보를 불러오는 중...</p>
                    <p className="text-sm text-muted-foreground/70">잠시만 기다려주세요</p>
                  </div>
                </div>
              </div>
            ) : filteredRestaurants.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center space-y-4">
                  <div className="text-6xl opacity-50">🔍</div>
                  <div className="space-y-2">
                    <p className="text-base font-medium">검색 결과가 없습니다</p>
                    <p className="text-sm text-muted-foreground/70">다른 조건으로 검색해보세요</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRestaurants.slice(0, 20).map((r) => (
                  <motion.div
                    key={`desktop-${r.id}-${r.name}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className="p-5 cursor-pointer bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 border-white/40 dark:border-slate-700/40 shadow-lg hover:shadow-2xl transition-all duration-300 rounded-3xl group overflow-hidden"
                      onClick={() => r.id && goDetail(r.id, r.favorited, r.category ?? null)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative overflow-hidden rounded-2xl shrink-0">
                          <img
                            src={r.image || "/placeholder.svg"}
                            alt={r.name}
                            loading="lazy"
                            sizes="80px"
                            className="w-20 h-20 object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              className="font-bold text-foreground text-lg leading-tight break-words line-clamp-2 group-hover:text-green-600 transition-colors duration-200 flex-1"
                              title={r.name}
                            >
                              {r.name}
                            </h3>
                            {r.wasteTier && (
                              <Badge
                                className={`${getTierColor(r.wasteTier)} text-xs font-bold px-2 py-1 rounded-full shadow-md shrink-0`}
                              >
                                {getTierName(r.wasteTier)}
                              </Badge>
                            )}
                          </div>

                          {/* ⭐ 별점 + 💬 리뷰 */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm">
                              <div className="flex items-center gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-3 py-1.5 rounded-full border border-green-200/50 dark:border-green-800/50">
                                <div className="flex items-center gap-0.5">
                                  {renderStars(clamp05(r.displayScore ?? 0))}
                                </div>
                                <span className="text-green-700 dark:text-green-300 font-bold text-sm">
                                  {clamp05(r.displayScore ?? 0).toFixed(1)}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/25 px-3 py-1.5 rounded-full border border-blue-200/60 dark:border-blue-800/60 shadow-sm">
                                <MessageCircle className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                                <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm">
                                  {Math.max(0, Number(r.reviewCount ?? 0))}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* ❤️ */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleFavoriteById(r.id, !favoriteIds.has(r.id!))
                                }}
                                className={`h-10 w-10 rounded-full shadow-md border ${
                                  favoriteIds.has(r.id!)
                                    ? "bg-gradient-to-r from-rose-500 to-red-600 text-white border-red-500/50"
                                    : "bg-white/90 dark:bg-slate-700/90 hover:bg-red-50 dark:hover:bg-red-900/30 border-red-200/60 dark:border-red-800/60"
                                }`}
                                title={favoriteIds.has(r.id!) ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                              >
                                <Heart
                                  className={`h-[18px] w-[18px] ${favoriteIds.has(r.id!) ? "fill-current" : "text-red-500"}`}
                                />
                              </Button>

                              {r.mapy != null && r.mapx != null && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    flyTo(r.mapy!, r.mapx!)
                                  }}
                                  className="h-9 w-9 rounded-lg bg-white/90 dark:bg-slate-700/90 hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-md border border-blue-200/50 dark:border-blue-800/50"
                                >
                                  <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {r.address && (
                            <p className="text-xs text-muted-foreground/80 line-clamp-1" title={r.address}>
                              📍 {r.address}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} id="map" className="absolute inset-0 w-full h-full" />

          {selectedRestaurant && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-20 left-4 right-4 md:left-80 md:right-auto md:w-80 z-50"
            >
              <Card className="p-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-white/40 dark:border-slate-700/40 shadow-2xl rounded-2xl">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-lg text-foreground">{selectedRestaurant.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedRestaurant(null)}
                    className="h-8 w-8 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="relative overflow-hidden rounded-xl shrink-0">
                    <img
                      src={selectedRestaurant.image || "/placeholder.svg"}
                      alt={selectedRestaurant.name}
                      className="w-16 h-16 object-cover"
                    />
                    {selectedRestaurant.wasteTier && (
                      <div
                        className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getTierColor(selectedRestaurant.wasteTier)} shadow-lg border border-white dark:border-slate-800`}
                      >
                        {getTierIcon(selectedRestaurant.wasteTier)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(clamp05(selectedRestaurant.displayScore ?? 0))
                                ? "fill-green-500 text-green-500"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                        <span className="text-sm font-medium text-green-600 ml-1">
                          {clamp05(selectedRestaurant.displayScore ?? 0).toFixed(1)}
                        </span>
                      </div>
                      {selectedRestaurant.wasteTier && (
                        <Badge
                          className={`${getTierColor(selectedRestaurant.wasteTier)} text-xs font-bold px-2 py-1 rounded-full`}
                        >
                          {getTierName(selectedRestaurant.wasteTier)}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      <span className="text-blue-700 dark:text-blue-300 font-medium text-sm">
                        리뷰 {Math.max(0, Number(selectedRestaurant.reviewCount ?? 0))}개
                      </span>
                    </div>
                  </div>
                </div>

                {selectedRestaurant.address && (
                  <p className="text-sm text-muted-foreground mb-3">{selectedRestaurant.address}</p>
                )}

                <Button
                  onClick={() => {
                    if (selectedRestaurant.id) {
                      goDetail(selectedRestaurant.id, selectedRestaurant.favorited, selectedRestaurant.category ?? null)
                    }
                    setSelectedRestaurant(null)
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl"
                >
                  상세 정보 보기
                </Button>
              </Card>
            </motion.div>
          )}

          {/* 지도 하단 전역 컨트롤 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute left-0 right-0 bottom-0 z-10 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
          >
            <div className="mx-auto max-w-2xl flex items-center justify-center gap-3 pointer-events-auto">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleSearchCurrentBounds}
                  disabled={loadingMapRestaurants}
                  className="h-14 px-8 rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl text-foreground hover:bg-white dark:hover:bg-slate-700 shadow-2xl border border-white/30 dark:border-slate-700/50 font-medium"
                  title="현 지도에서 검색"
                >
                  {loadingMapRestaurants ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                      검색 중...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-3" />현 지도에서 검색
                    </>
                  )}
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  onClick={recenterToUser}
                  className="h-14 px-6 rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-2xl border border-white/30 dark:border-slate-700/50 font-medium"
                  title="내 위치로 돌아가기"
                >
                  <LocateFixed className="h-5 w-5 mr-2 text-blue-600" />내 위치
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── 모바일 하단 리스트 ── */}
      <motion.div
        className="md:hidden flex flex-col bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-white/20 dark:border-slate-800/30 shrink-0 shadow-xl max-h-[60vh]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* 고정 헤더 (타이틀 + 필터) */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/30">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                주변 맛집
              </h2>
              <div className="flex items-center gap-2">
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as any)}
                  className="h-9 rounded-xl border bg-white/95 dark:bg-slate-800/95 text-sm px-3 font-medium shadow-md backdrop-blur-sm"
                >
                  <option value="ALL">🍽️ 전체</option>
                  <option value="UNRANK">🥢 젓가락</option>
                  <option value="브론즈">🥄 나무수저</option>
                  <option value="실버">🥄 은수저</option>
                  <option value="골드">🍴 금수저</option>
                  <option value="플래티넘">🍽️ 다이아수저</option>
                  <option value="다이아">👑 왕관수저</option>
                </select>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as any)}
                  className="h-9 rounded-xl border bg-white/95 dark:bg-slate-800/95 text-sm px-3 font-medium shadow-md backdrop-blur-sm"
                >
                  <option value="rating">⭐ 별점 순</option>
                  <option value="reviews">💬 리뷰 수 순</option>
                </select>
                <Badge
                  variant="secondary"
                  className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-semibold px-3 py-1 rounded-full shadow-sm"
                >
                  {filteredRestaurants.length}곳
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* 스크롤 리스트 */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {filteredRestaurants.slice(0, 10).map((r) => (
              <motion.div
                key={`mobile-${r.id}-${r.name}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Card
                  className="p-4 cursor-pointer bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 border-white/40 dark:border-slate-700/40 shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl group"
                  onClick={() => r.id && goDetail(r.id, r.favorited, r.category ?? null)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative overflow-hidden rounded-xl shrink-0">
                      <img
                        src={r.image || "/placeholder.svg"}
                        alt={r.name}
                        loading="lazy"
                        sizes="60px"
                        className="w-16 h-16 object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3
                          className="font-bold text-foreground text-base leading-snug break-words line-clamp-2 flex-1"
                          title={r.name}
                        >
                          {r.name}
                        </h3>
                        {r.wasteTier && (
                          <Badge
                            className={`${getTierColor(r.wasteTier)} text-xs font-bold px-2 py-0.5 rounded-full shadow-sm shrink-0`}
                          >
                            {getTierName(r.wasteTier)}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-2.5 py-1.5 rounded-full border border-green-200/50 dark:border-green-800/50">
                          {renderStars(clamp05(r.displayScore ?? 0)).slice(0, 1)}
                          <span className="text-green-700 dark:text-green-300 font-bold text-xs">
                            {clamp05(r.displayScore ?? 0).toFixed(1)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/25 px-2.5 py-1.5 rounded-full border border-blue-200/60 dark:border-blue-800/60">
                          <MessageCircle className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" />
                          <span className="text-blue-700 dark:text-blue-300 text-xs font-semibold">
                            리뷰 {Math.max(0, Number(r.reviewCount ?? 0))}개
                          </span>
                        </div>

                        {r.distance && (
                          <span className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                            {r.distance}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavoriteById(r.id, !favoriteIds.has(r.id!))
                        }}
                        className={`h-9 w-9 rounded-full shadow-md border ${
                          favoriteIds.has(r.id!)
                            ? "bg-gradient-to-r from-rose-500 to-red-600 text-white border-red-500/50"
                            : "bg-white/90 dark:bg-slate-700/90 hover:bg-red-50 dark:hover:bg-red-900/30 border-red-200/60 dark:border-red-800/60"
                        }`}
                        title={favoriteIds.has(r.id!) ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                      >
                        <Heart className={`h-4 w-4 ${favoriteIds.has(r.id!) ? "fill-current" : "text-red-500"}`} />
                      </Button>

                      {r.mapy != null && r.mapx != null && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            flyTo(r.mapy!, r.mapx!)
                          }}
                          className="h-8 w-8 rounded-lg bg-white/90 dark:bg-slate-700/90 hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-md border border-blue-200/50 dark:border-blue-800/50"
                        >
                          <Navigation className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {showNotifications &&
        typeof window !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[999998]" onClick={() => setShowNotifications(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="fixed top-20 right-4 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 backdrop-blur-xl z-[999999]"
            >
              <div className="p-4 border-b border-gray-100 dark:border-slate-700">
                <h3 className="font-semibold text-lg">알림</h3>
                <p className="text-sm text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount}개의 새로운 알림` : "모든 알림을 확인했습니다"}
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>새로운 알림이 없습니다</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 border-b border-gray-50 dark:border-slate-700/30 cursor-pointer transition-colors ${
                        !notification.isRead ? "bg-green-50/50 dark:bg-green-900/10" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-2 ${
                            !notification.isRead ? "bg-green-500" : "bg-gray-300"
                          }`}
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-sm mb-1">{notification.title}</h4>
                          <p className="text-xs text-muted-foreground mb-2">{notification.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {notification.createdAt.toLocaleString("ko-KR", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-100 dark:border-slate-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
                      setShowNotifications(false)
                    }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground"
                  >
                    모든 알림 읽음 처리
                  </Button>
                </div>
              )}
            </motion.div>
          </>,
          document.body,
        )}
    </div>
  )
}
