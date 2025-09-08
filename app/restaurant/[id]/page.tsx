// app/restaurant/[id]/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
} from "lucide-react"
import { apiClient } from "@/lib/api/client"
import { calculateWasteStarRating } from "@/lib/utils/database-helpers"

// ✅ 목업
import { mockRestaurants } from "@/lib/mock/restaurant-presets"

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
  /** 목업: 접이식 섹션 */
  infoSections?: { title: string; body: string }[]
}

/** BE 응답 → UI 타입으로 안전 변환 (header/tabs 구조 & 구형 external 둘 다 지원) */
function normalizeRestaurant(raw: any): UIRestaurant {
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
      ? t.gallery.photos
          .map((p: any) => (typeof p === "string" ? p : p?.url))
          .filter(Boolean)
      : []

    return {
      id: Number(h.id ?? 0),
      name: String(h.name ?? "알 수 없는 식당"),
      image: h.heroPhoto ?? null,
      badge: h.badge ?? null,
      wasteScore: typeof h.ecoScore === "number" ? h.ecoScore : null,
      totalReviews: typeof h.reviewCount === "number" ? h.reviewCount : 0,
      category: h.category ?? null,
      distance: null,
      address: t.info?.address ?? h.address ?? null,
      telephone: t.info?.telephone ?? h.telephone ?? null,
      hours: null,
      description: t.info?.description ?? null,
      favorited: !!h.isFavorite,
      menu: menuItems,
      gallery,
      reviews: [],
    }
  }

  const ext = raw?.external ?? {}
  const eco = raw?.stats?.ecoScore
  const photos: string[] = Array.isArray(ext.photos)
    ? (ext.photos as any[]).map((p) => p?.url).filter(Boolean)
    : []

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
    category: ext.category ?? raw?.category ?? null,
    distance: raw?.distance ?? null,
    address: ext.address ?? raw?.address ?? null,
    telephone: ext.telephone ?? raw?.telephone ?? null,
    hours: raw?.hours ?? null,
    description: raw?.description ?? null,
    favorited: !!raw?.isFavorite,
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

export default function RestaurantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const restaurantId = Number.parseInt((params as any).id as string)

  const [activeTab, setActiveTab] = useState("info")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState<any | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiClient.getRestaurantDetail(restaurantId)
        if (!mounted) return
        if (!res.success) {
          setError(res.error || "식당 정보를 불러올 수 없습니다.")
          setRaw(null)
        } else {
          setRaw(res.data)
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

  /** BE → UI 변환 + 목업 병합 */
  const restaurant = useMemo<UIRestaurant | null>(() => {
    if (!raw) return null
    const base = normalizeRestaurant(raw)

    const mock = mockRestaurants[base.id]
    if (!mock) return base

    const mergedDescription = [base.description, mock.facilities]
      .filter(Boolean)
      .join("\n\n")

    const mergedMenu =
      Array.isArray(mock.menu) && mock.menu.length > 0 ? mock.menu : base.menu

    return {
      ...base,
      description: mergedDescription,
      menu: mergedMenu,
      infoSections: mock.infoSections, // 👉 접이식 섹션 제공
    }
  }, [raw])

  const toggleFavorite = async () => {
    if (!restaurant?.id) return
    try {
      if (restaurant.favorited) {
        await apiClient.removeFavorite(restaurant.id)
      } else {
        await apiClient.addFavorite(restaurant.id)
      }
      const res = await apiClient.getRestaurantDetail(restaurant.id)
      if (res.success) setRaw(res.data)
    } catch (err) {
      console.error("[toggle favorite] failed:", err)
      alert("즐겨찾기 처리가 실패했어요.")
    }
  }

  const handleShare = () => {
    if (!restaurant) return
    if (navigator.share) {
      navigator
        .share({
          title: restaurant.name,
          text: "에코 친화 식당 정보 공유",
          url: typeof window !== "undefined" ? window.location.href : "",
        })
        .catch(() => {})
    } else {
      alert("이 브라우저는 공유 기능을 지원하지 않아요.")
    }
  }

  const handleWriteReview = () => {
    router.push(`/review/write?restaurantId=${restaurantId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-muted-foreground">식당 정보를 불러오는 중...</div>
        </div>
      </div>
    )
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error || "식당 정보를 불러올 수 없습니다"}</div>
          <Button onClick={() => router.back()}>뒤로가기</Button>
        </div>
      </div>
    )
  }

  const star = calculateWasteStarRating(restaurant.wasteScore ?? 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleShare} title="공유하기">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleFavorite} title="즐겨찾기">
              <Heart className={`h-4 w-4 ${restaurant.favorited ? "fill-red-500 text-red-500" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative h-64 bg-muted">
        <img
          src={restaurant.image || "/placeholder.svg"}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2 mb-2">
            {restaurant.badge && (
              <Badge variant={restaurant.badge === "착한 식당" ? "default" : "secondary"}>
                {restaurant.badge}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{restaurant.name}</h1>
          <div className="flex items-center gap-4 text-white/90">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-current text-green-400" />
              <span className="font-medium">{star}</span>
              <span className="text-sm">({restaurant.totalReviews || 0})</span>
            </div>
            {restaurant.category && <span className="text-sm">{restaurant.category}</span>}
            {restaurant.distance && <span className="text-sm">{restaurant.distance}</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto p-4 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">정보</TabsTrigger>
            <TabsTrigger value="menu">메뉴</TabsTrigger>
            <TabsTrigger value="gallery">갤러리</TabsTrigger>
            <TabsTrigger value="reviews">리뷰</TabsTrigger>
          </TabsList>

          {/* Info */}
          <TabsContent value="info" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    기본 정보
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {restaurant.address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{restaurant.address}</span>
                    </div>
                  )}
                  {restaurant.telephone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{restaurant.telephone}</span>
                    </div>
                  )}
                  {restaurant.hours && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{restaurant.hours}</span>
                    </div>
                  )}

                  {(restaurant.description?.trim()?.length ?? 0) > 0 && <Separator />}

                  {/* 본문 + 줄바꿈 유지 */}
                  {restaurant.description && (
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {restaurant.description}
                    </p>
                  )}

                  {/* 🔻 목업 섹션: 접었다/폈다 (details/summary) */}
                  {restaurant.infoSections?.length ? (
                    <div className="mt-4 space-y-2">
                      {restaurant.infoSections.map((sec, i) => (
                        <details
                          key={`${sec.title}-${i}`}
                          className="rounded-lg border border-border p-3 bg-muted/40"
                        >
                          <summary className="cursor-pointer font-medium text-foreground">
                            {sec.title}
                          </summary>
                          <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                            {sec.body}
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-primary" />
                    친환경 지수
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {calculateWasteStarRating(restaurant.wasteScore ?? 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">잔반 별점</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Menu */}
          <TabsContent value="menu" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>메뉴</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {restaurant.menu && restaurant.menu.length > 0 ? (
                    restaurant.menu.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-start p-4 border border-border rounded-lg"
                      >
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground mb-1">
                            {item.name || "메뉴"}
                          </h3>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {item.description || ""}
                          </p>
                        </div>
                        {item.price && (
                          <div className="text-lg font-semibold text-primary ml-4">
                            {item.price}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      메뉴 정보가 없습니다
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gallery */}
          <TabsContent value="gallery" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  사진 갤러리
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {restaurant.gallery && restaurant.gallery.length > 0 ? (
                    restaurant.gallery.map((image, index) => (
                      <div
                        key={index}
                        className="aspect-square bg-muted rounded-lg overflow-hidden"
                      >
                        <img
                          src={image || "/placeholder.svg"}
                          alt={`${restaurant.name} 사진 ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center text-muted-foreground py-8">
                      사진이 없습니다
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews */}
          <TabsContent value="reviews" className="mt-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    리뷰 요약
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-primary mb-1">
                        {restaurant.totalReviews || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">총 리뷰</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        {calculateWasteStarRating(restaurant.wasteScore ?? 0)}
                      </div>
                      <div className="text-sm text-muted-foreground">평균 잔반 별점</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Write Review Button */}
        <div className="fixed bottom-6 right-6">
          <Button onClick={handleWriteReview} size="lg" className="rounded-full shadow-lg">
            <Edit3 className="h-5 w-5 mr-2" />
            리뷰 작성
          </Button>
        </div>
      </div>
    </div>
  )
}
