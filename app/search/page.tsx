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

export default function SearchPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")

  const {
    data: restaurants,
    loading,
    error,
    isUsingFallback,
  } = useRestaurants({
    search: searchQuery || undefined,
  })

  const filteredAndSortedRestaurants = useMemo(() => {
    if (!restaurants) return []

    // Server-side filtering is handled by the API, but we can add client-side filtering for immediate feedback
    return restaurants.filter((restaurant) => {
      if (!searchQuery) return true
      const matchesSearch =
        restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        restaurant.description?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
  }, [restaurants, searchQuery])

  const toggleFavorite = async (restaurantId: number) => {
    if (!restaurants) return

    const restaurant = restaurants.find((r) => r.id === restaurantId)
    if (!restaurant) return

    try {
      if (restaurant.favorited) {
        await apiClient.removeFavorite(restaurantId)
      } else {
        await apiClient.addFavorite(restaurantId)
      }

      // Update local state optimistically
      // In a real app, you might want to refetch the data or use a state management solution
      restaurant.favorited = !restaurant.favorited
    } catch (error) {
      console.error("[v0] Failed to toggle favorite:", error)
    }
  }

  const handleRestaurantClick = (restaurantId: number) => {
    router.push(`/restaurant/${restaurantId}`)
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
      {isUsingFallback && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-2">
          <div className="container mx-auto text-center text-sm text-yellow-800">
            ⚠️ 연결되면 실제 데이터가 표시됩니다
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/map">
                <MapPin className="h-4 w-4 mr-2" />
                지도로 돌아가기
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-semibold text-foreground">식당 검색</span>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="bg-background border-b border-border p-4">
        <div className="container mx-auto space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="식당명, 음식 종류로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              총 {filteredAndSortedRestaurants.length}개의 식당을 찾았습니다
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto p-4">
        <div className="space-y-4">
          {filteredAndSortedRestaurants.map((restaurant) => (
            <div key={restaurant.id} className="relative">
              <Card
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleRestaurantClick(restaurant.id)}
              >
                <div className="flex gap-4">
                  <img
                    src={restaurant.image || "/placeholder.svg"}
                    alt={restaurant.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground truncate">{restaurant.name}</h3>
                      <Badge variant={restaurant.badge === "착한 식당" ? "default" : "secondary"} className="text-xs">
                        {restaurant.badge}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{restaurant.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
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

              {/* Favorite Button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFavorite(restaurant.id)
                }}
              >
                <Heart className={`h-4 w-4 ${restaurant.favorited ? "fill-red-500 text-red-500" : ""}`} />
              </Button>
            </div>
          ))}

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
