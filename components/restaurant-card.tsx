"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, Heart, MapPin } from "lucide-react"

interface RestaurantCardProps {
  restaurant: {
    id: number
    name: string
    score: number
    category: string
    distance: string
    badge: string
    image: string
    address?: string
    description?: string
    wasteScore?: number
    favorited?: boolean
  }
  onClick?: () => void
  showFavorite?: boolean
}

export function RestaurantCard({ restaurant, onClick, showFavorite = true }: RestaurantCardProps) {
  const wasteStarRating = restaurant.wasteScore
    ? Math.round((restaurant.wasteScore / 100) * 5 * 10) / 10
    : restaurant.score

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <img
            src={restaurant.image || "/placeholder.svg"}
            alt={restaurant.name}
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-foreground mb-1 truncate">{restaurant.name}</h3>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={restaurant.badge === "착한 식당" ? "default" : "secondary"} className="text-xs">
                    {restaurant.badge}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{restaurant.category}</span>
                </div>
              </div>
              {showFavorite && (
                <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                  <Heart className={`h-4 w-4 ${restaurant.favorited ? "fill-red-500 text-red-500" : ""}`} />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-current text-green-500" />
                <span className="font-medium text-green-600">잔반 {wasteStarRating}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{restaurant.distance}</span>
              </div>
            </div>

            {restaurant.address && <p className="text-sm text-muted-foreground mb-1 truncate">{restaurant.address}</p>}

            {restaurant.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{restaurant.description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
