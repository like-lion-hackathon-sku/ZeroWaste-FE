"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, Heart, Leaf, Star, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRestaurants } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { calculateWasteStarRating } from "@/lib/utils/database-helpers"

/**
 * 식당 조회 페이지 컴포넌트 (/restaurants)
 * - 전체 식당 목록 조회 및 검색 기능
 * - 식당 정보 카드 형태로 표시
 * - 즐겨찾기 토글 및 상세 페이지 이동 기능
 */
export default function RestaurantsPage() {
  const router = useRouter()

  // 검색어 상태 관리
  const [searchQuery, setSearchQuery] = useState("")

  /**
   * 식당 데이터 API 호출 훅
   * - 검색어가 있으면 필터링된 결과 반환
   * - API 실패 시 목업 데이터로 폴백
   */
  const {
    data: restaurants,
    loading,
    error,
    isUsingFallback,
  } = useRestaurants({
    search: searchQuery || undefined,
  })

  /**
   * 클라이언트 사이드 필터링 및 정렬
   * 서버 사이드 필터링과 함께 즉각적인 피드백 제공
   */
  const filteredAndSortedRestaurants = useMemo(() => {
    if (!restaurants) return []

    // 서버 사이드 필터링이 주요 처리를 담당하지만, 클라이언트에서 추가 필터링으로 즉각적인 반응 제공
    return restaurants.filter((restaurant) => {
      if (!searchQuery) return true
      const matchesSearch =
        restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        restaurant.description?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
  }, [restaurants, searchQuery])

  /**
   * 즐겨찾기 토글 처리 함수
   * @param restaurantId - 즐겨찾기를 토글할 식당 ID
   */
  const toggleFavorite = async (restaurantId: number) => {
    if (!restaurants) return

    const restaurant = restaurants.find((r) => r.id === restaurantId)
    if (!restaurant) return

    try {
      // API 호출로 즐겨찾기 상태 변경
      if (restaurant.favorited) {
        await apiClient.removeFavorite(restaurantId)
      } else {
        await apiClient.addFavorite(restaurantId)
      }

      // 낙관적 업데이트로 즉시 UI 반영
      // 실제 앱에서는 데이터 재조회나 상태 관리 솔루션 사용 권장
      restaurant.favorited = !restaurant.favorited
    } catch (error) {
      console.error("[v0] 즐겨찾기 토글 실패:", error)
    }
  }

  /**
   * 식당 상세 페이지 이동 함수
   * @param restaurantId - 상세 정보를 볼 식당 ID
   */
  const handleRestaurantClick = (restaurantId: number) => {
    router.push(`/restaurants/${restaurantId}`)
  }

  // 로딩 상태 UI
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

  // 에러 상태 UI
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">데이터를 불러올 수 없습니다</div>
          <Button onClick={() => window.location.reload()}>다시 시도</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 폴백 데이터 사용 시 경고 메시지 */}
      {isUsingFallback && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-2">
          <div className="container mx-auto text-center text-sm text-yellow-800">
            ⚠️ 연결되면 실제 데이터가 표시됩니다
          </div>
        </div>
      )}

      {/* 헤더 영역 */}
      <header className="bg-card border-b border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          {/* 뒤로가기 버튼 */}
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/home">
                <MapPin className="h-4 w-4 mr-2" />
                홈으로 돌아가기
              </Link>
            </Button>
          </div>

          {/* 페이지 제목 */}
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-semibold text-foreground">식당 검색</span>
          </div>
        </div>
      </header>

      {/* 검색 및 필터 영역 */}
      <div className="bg-background border-b border-border p-4">
        <div className="container mx-auto space-y-4">
          {/* 검색 바 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="식당명, 음식 종류로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 검색 결과 개수 표시 */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              총 {filteredAndSortedRestaurants.length}개의 식당을 찾았습니다
            </p>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="container mx-auto p-4">
        <div className="space-y-4">
          {/* 식당 목록 */}
          {filteredAndSortedRestaurants.map((restaurant) => (
            <div key={restaurant.id} className="relative">
              {/* 식당 정보 카드 */}
              <Card
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleRestaurantClick(restaurant.id)}
              >
                <div className="flex gap-4">
                  {/* 식당 이미지 */}
                  <img
                    src={restaurant.image || "/placeholder.svg"}
                    alt={restaurant.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />

                  {/* 식당 정보 */}
                  <div className="flex-1 min-w-0">
                    {/* 식당명 및 배지 */}
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground truncate">{restaurant.name}</h3>
                      <Badge variant={restaurant.badge === "착한 식당" ? "default" : "secondary"} className="text-xs">
                        {restaurant.badge}
                      </Badge>
                    </div>

                    {/* 식당 설명 */}
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{restaurant.description}</p>

                    {/* 평점, 카테고리, 거리 정보 */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {/* 친환경 별점 */}
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current text-green-500" />
                        <span className="text-green-600 font-medium">
                          {calculateWasteStarRating(restaurant.wasteScore || 80)}
                        </span>
                      </div>
                      <span>{restaurant.category}</span>
                      <span>{restaurant.distance}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 즐겨찾기 버튼 */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4"
                onClick={(e) => {
                  e.stopPropagation() // 카드 클릭 이벤트 전파 방지
                  toggleFavorite(restaurant.id)
                }}
              >
                <Heart className={`h-4 w-4 ${restaurant.favorited ? "fill-red-500 text-red-500" : ""}`} />
              </Button>
            </div>
          ))}

          {/* 검색 결과 없음 상태 */}
          {filteredAndSortedRestaurants.length === 0 && (
            <Card className="p-8 text-center">
              <div className="text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">검색 결과가 없습니다</h3>
                <p>다른 검색어를 시도해보세요</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
