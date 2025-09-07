"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { RestaurantCard } from "@/components/restaurant-card"
import { ArrowLeft, User, Star, Heart, Award, Users, Edit, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useUserProfile, useUserBadges, useFavorites, useUserReviews } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"

type FavoriteItem = {
  id?: number
  restaurant_id: number
  restaurant?: {
    id: number
    name: string
    category?: string | null
    // 필요 시 더 추가
  }
}

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

  useEffect(() => {
    if (Array.isArray(favorites)) {
      setFavList(
        favorites.map((f: any) => ({
          id: f.id,
          restaurant_id: f.restaurant_id ?? f.restaurant?.id,
          restaurant: f.restaurant,
        }))
      )
    }
  }, [favorites])

  const earnedBadges = (userBadges || []).filter((badge: any) => badge.badge)

  const mockInProgressBadges = [
    {
      id: "good_customer_3",
      name: "착한 손님 Lv.3",
      icon: "🍃",
      description: "누적 리뷰 50개",
      category: "activity",
      earned: false,
      progress: reviews?.length || 0,
      target: 50,
    },
    {
      id: "eco_influencer",
      name: "에코 인플루언서",
      icon: "📸",
      description: "AI 분석 사진 20장 업로드",
      category: "environment",
      earned: false,
      progress: 15,
      target: 20,
    },
  ]

  const getBadgesByCategory = (category: string) => {
    return earnedBadges.filter((badge: any) =>
      badge.badge?.name.includes(category === "activity" ? "리뷰" : category === "environment" ? "친환경" : "지역")
    )
  }

  const handleRestaurantClick = (restaurantId: number) => {
    router.push(`/restaurant/${restaurantId}`)
  }

  const handleEditProfile = () => {
    router.push("/profile/edit")
  }

  const handleRemoveFavorite = async (restaurantId: number) => {
    if (removingId) return
    setRemovingId(restaurantId)

    // 1) 낙관적 업데이트: 즉시 목록에서 제거
    const prev = favList
    setFavList((list) => list.filter((f) => f.restaurant_id !== restaurantId))

    try {
      const res = await apiClient.removeFavorite(restaurantId)
      if (!res.success) throw new Error(res.error || "즐겨찾기 삭제 실패")
      // 필요 시 서버 상태 동기화
      // router.refresh()
    } catch (e) {
      // 2) 실패 시 롤백
      setFavList(prev)
      alert("즐겨찾기 삭제에 실패했습니다.")
      console.error(e)
    } finally {
      setRemovingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-muted-foreground">프로필 정보를 불러오는 중...</div>
        </div>
      </div>
    )
  }

  if (hasError || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">프로필 정보를 불러올 수 없습니다</div>
          <Button onClick={() => window.location.reload()}>다시 시도</Button>
        </div>
      </div>
    )
  }

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
          <h1 className="font-semibold text-foreground">프로필</h1>
          <Button variant="ghost" size="sm" onClick={handleEditProfile}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* User Info Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.profile || "/placeholder.svg"} alt={user.nickname} />
                <AvatarFallback>
                  <User className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-1">{user.nickname}</h2>
                <p className="text-muted-foreground mb-2">{user.email}</p>
                <p className="text-sm text-muted-foreground">가입일: {formatDate(user.created_at)}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-primary/5 rounded-lg">
                <div className="text-2xl font-bold text-primary mb-1">{reviews?.length || 0}</div>
                <div className="text-sm text-muted-foreground">총 리뷰</div>
              </div>
              <div className="text-center p-3 bg-secondary/5 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${i < Math.round(4.6) ? "fill-current text-green-500" : "text-gray-300"}`}
                    />
                  ))}
                </div>
                <div className="text-xs text-green-600 font-medium mb-1">4.6</div>
                <div className="text-sm text-muted-foreground">잔반 별점</div>
              </div>
              <div className="text-center p-3 bg-accent/5 rounded-lg">
                <div className="text-2xl font-bold text-accent mb-1">{favList.length}</div>
                <div className="text-sm text-muted-foreground">즐겨찾기</div>
              </div>
              <div className="text-center p-3 bg-orange-100 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 mb-1">{earnedBadges.length}</div>
                <div className="text-sm text-muted-foreground">획득 뱃지</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reviews">리뷰</TabsTrigger>
            <TabsTrigger value="favorites">즐겨찾기</TabsTrigger>
            <TabsTrigger value="badges">뱃지</TabsTrigger>
          </TabsList>

          {/* 리뷰 탭 */}
          <TabsContent value="reviews" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  작성한 리뷰 ({reviews?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {reviews && reviews.length > 0 ? (
                    reviews.map((review: any) => (
                      <div key={review.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">
                              {review.restaurant?.name || "식당 정보 없음"}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                                <span>{review.waste_rating?.toFixed(1) || "0.0"}</span>
                              </div>
                              <span>{review.restaurant?.category || "카테고리 없음"}</span>
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {review.created_at ? formatDate(review.created_at) : "날짜 없음"}
                          </span>
                        </div>
                        <p className="text-foreground mb-3">{review.comment || "댓글 없음"}</p>
                        {review.photos && review.photos.length > 0 && (
                          <div className="flex gap-2">
                            {review.photos.map((photo: any, index: number) => (
                              <img
                                key={index}
                                src={`/ceholder-svg-key-review.png?key=review${photo.id}`}
                                alt={`리뷰 사진 ${index + 1}`}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">작성한 리뷰가 없습니다</h3>
                      <p>첫 번째 리뷰를 작성해보세요</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 즐겨찾기 탭 */}
          <TabsContent value="favorites" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  즐겨찾기 식당 ({favList.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {favList.length > 0 ? (
                    favList.map((favorite) =>
                      favorite.restaurant ? (
                        <div
                          key={`${favorite.restaurant_id}-${favorite.id ?? "row"}`}
                          className="relative"
                        >
                          {/* 레스토랑 카드 */}
                          <RestaurantCard
                            restaurant={favorite.restaurant}
                            onClick={() => handleRestaurantClick(favorite.restaurant!.id)}
                            showFavorite={false} // 내부 하트 숨김 (우리는 삭제 버튼으로 대체)
                          />

                          {/* 삭제 버튼 */}
                          <div className="absolute right-3 top-3">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-2"
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
                                <>
                                  <Trash2 className="h-4 w-4" />
                                  
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : null
                    )
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">즐겨찾기한 식당이 없습니다</h3>
                      <p>마음에 드는 식당을 즐겨찾기에 추가해보세요</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 뱃지 탭 */}
          <TabsContent value="badges" className="mt-6">
            <div className="space-y-6">
              {/* 획득한 뱃지 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-orange-500" />
                    획득한 뱃지 ({earnedBadges.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {earnedBadges.length > 0 ? (
                      earnedBadges.map((acquiredBadge: any) => (
                        <div
                          key={acquiredBadge.id}
                          className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-center"
                        >
                          <div className="text-3xl mb-2">🏆</div>
                          <h3 className="font-semibold text-foreground mb-1">{acquiredBadge.badge?.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{acquiredBadge.badge?.description}</p>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                            {formatDate(acquiredBadge.acquired_at)}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-center text-muted-foreground py-8">
                        <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">획득한 뱃지가 없습니다</h3>
                        <p>활동을 통해 뱃지를 획득해보세요</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 진행 중인 뱃지 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    진행 중인 뱃지 ({mockInProgressBadges.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mockInProgressBadges.map((badge) => (
                      <div key={badge.id} className="p-4 bg-muted/50 border border-border rounded-lg text-center">
                        <div className="text-3xl mb-2 opacity-50">{badge.icon}</div>
                        <h3 className="font-semibold text-foreground mb-1">{badge.name}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{badge.description}</p>
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
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
