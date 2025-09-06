"use client"

import { useMemo, useState } from "react"
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
import { useRestaurant } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { calculateWasteStarRating } from "@/lib/utils/database-helpers"

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
}

/** 들어온 원시 restaurant를 UI friendly 형태로 안전 변환 */
function normalizeRestaurant(raw: any): UIRestaurant {
  return {
    id: Number(raw?.id ?? 0),
    name: String(raw?.name ?? "알 수 없는 식당"),
    image: raw?.image ?? null,
    badge: raw?.badge ?? null,
    wasteScore: typeof raw?.wasteScore === "number" ? raw.wasteScore : raw?.waste_score ?? null,
    totalReviews: typeof raw?.totalReviews === "number" ? raw.totalReviews : raw?.total_reviews ?? 0,
    category: raw?.category ?? null,
    distance: raw?.distance ?? null,
    address: raw?.address ?? null,
    telephone: raw?.telephone ?? null,
    hours: raw?.hours ?? null,
    description: raw?.description ?? null,
    favorited: !!raw?.favorited,
    menu: Array.isArray(raw?.menu) ? raw.menu as UIMenuItem[] : [],
    gallery: Array.isArray(raw?.gallery) ? (raw.gallery as string[]) : [],
    reviews: Array.isArray(raw?.reviews)
      ? (raw.reviews as any[]).map((rv) => ({
          id: rv?.id,
          userName: rv?.userName ?? rv?.user_name ?? "익명",
          wasteRating: rv?.wasteRating ?? rv?.waste_rating ?? undefined,
          date: rv?.date ?? rv?.created_at ?? "",
          comment: rv?.comment ?? "",
          images: Array.isArray(rv?.images) ? rv.images : [],
        }))
      : [],
  }
}

export default function RestaurantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const restaurantId = Number.parseInt((params as any).id as string)
  const [activeTab, setActiveTab] = useState("info")

  const { data: raw, loading, error, isUsingFallback } = useRestaurant(restaurantId)

  // 안전한 형태로 변환
  const restaurant = useMemo<UIRestaurant | null>(() => {
    if (!raw) return null
    return normalizeRestaurant(raw)
  }, [raw])

  const toggleFavorite = async () => {
    if (!restaurant?.id) return
    try {
      if (restaurant.favorited) {
        await apiClient.removeFavorite(restaurant.id)
      } else {
        await apiClient.addFavorite(restaurant.id)
      }
      // 필요 시 router.refresh()로 재요청
      // router.refresh()
      // 또는 낙관적 갱신을 하려면 별도 로컬 상태로 감싸서 setState 해도 됨
    } catch (err) {
      console.error("[v0] Failed to toggle favorite:", err)
    }
  }

  const handleShare = () => {
    if (navigator.share && restaurant) {
      navigator
        .share({
          title: restaurant.name,
          text: "에코 친화 식당 정보 공유",
          url: typeof window !== "undefined" ? window.location.href : "",
        })
        .catch(() => {})
    } else {
      console.log("Share:", restaurant?.name)
      alert("이 브라우저는 Web Share를 지원하지 않아요.")
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
          <div className="text-red-500 mb-4">식당 정보를 불러올 수 없습니다</div>
          <Button onClick={() => router.back()}>뒤로가기</Button>
        </div>
      </div>
    )
  }

  const star = calculateWasteStarRating(restaurant.wasteScore ?? 80)

  return (
    <div className="min-h-screen bg-background">
      {isUsingFallback && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-2">
          <div className="container mx-auto text-center text-sm text-yellow-800">
            ⚠️ 연결되면 실제 데이터가 표시됩니다
          </div>
        </div>
      )}

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

      {/* Hero Image */}
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

          <TabsContent value="info" className="mt-6">
            <div className="space-y-6">
              {/* Basic Info */}
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
                  <p className="text-muted-foreground leading-relaxed">
                    {restaurant.description || "설명 정보가 없습니다"}
                  </p>
                </CardContent>
              </Card>

              {/* Eco Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-primary" />
                    친환경 지수
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 mb-1">{star}</div>
                    <div className="text-sm text-muted-foreground">잔반 별점</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="menu" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>메뉴</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {restaurant.menu && restaurant.menu.length > 0 ? (
                    restaurant.menu.map((item, index) => (
                      <div key={index} className="flex justify-between items-start p-4 border border-border rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground mb-1">{item.name || "메뉴"}</h3>
                          <p className="text-sm text-muted-foreground">{item.description || ""}</p>
                        </div>
                        {item.price && <div className="text-lg font-semibold text-primary ml-4">{item.price}</div>}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">메뉴 정보가 없습니다</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                      <div key={index} className="aspect-square bg-muted rounded-lg overflow-hidden">
                        <img
                          src={image || "/placeholder.svg"}
                          alt={`${restaurant.name} 사진 ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center text-muted-foreground py-8">사진이 없습니다</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews" className="mt-6">
            <div className="space-y-4">
              {/* Review Summary */}
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
                      <div className="text-2xl font-bold text-primary mb-1">{restaurant.totalReviews || 0}</div>
                      <div className="text-sm text-muted-foreground">총 리뷰</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600 mb-1">{star}</div>
                      <div className="text-sm text-muted-foreground">평균 잔반 별점</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Individual Reviews */}
              <div className="space-y-4">
                {restaurant.reviews && restaurant.reviews.length > 0 ? (
                  restaurant.reviews.map((review) => (
                    <Card key={review.id ?? Math.random()}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-medium text-foreground mb-1">{review.userName || "익명"}</div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {typeof review.wasteRating === "number" && (
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 fill-current text-green-500" />
                                  <span className="text-green-600 font-medium">{review.wasteRating}</span>
                                </div>
                              )}
                              {review.date && <span>{review.date}</span>}
                            </div>
                          </div>
                        </div>
                        {review.comment && <p className="text-foreground mb-3">{review.comment}</p>}
                        {review.images && review.images.length > 0 && (
                          <div className="flex gap-2">
                            {review.images.map((image, i) => (
                              <img
                                key={i}
                                src={image || "/placeholder.svg"}
                                alt={`리뷰 사진 ${i + 1}`}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="p-8 text-center">
                    <div className="text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">리뷰가 없습니다</h3>
                      <p>첫 번째 리뷰를 작성해보세요</p>
                    </div>
                  </Card>
                )}
              </div>
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
