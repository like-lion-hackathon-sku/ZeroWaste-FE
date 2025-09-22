import {
  mockRestaurantsWithDetails,
  mockReviewsWithUser,
  mockUsers,
  mockBadges,
  mockAcquiredBadges,
  mockFavorites,
} from "@/lib/database/mock-data"
import type {
  RestaurantWithDetails,
  ReviewWithUser,
  User,
  AcquiredBadgeWithDetails,
  FavoriteWithRestaurant,
  ApiResponse,
} from "@/lib/types/database"

export class FallbackService {
  private static instance: FallbackService
  private warningShown = false

  static getInstance(): FallbackService {
    if (!FallbackService.instance) {
      FallbackService.instance = new FallbackService()
    }
    return FallbackService.instance
  }

  /** ✅ 무음 모드 경고: alert/confirm 없이 콘솔에만 출력 */
  private showWarning() {
    if (!this.warningShown && typeof window !== "undefined") {
      this.warningShown = true
      console.warn("[v0] Using fallback data - 연결되면 실제 데이터가 표시됩니다")
    }
  }

  async getRestaurants(params?: { category?: string; search?: string }): Promise<ApiResponse<RestaurantWithDetails[]>> {
    this.showWarning()

    let restaurants = [...mockRestaurantsWithDetails]

    if (params?.category) {
      restaurants = restaurants.filter((r) => r.category === params.category?.toUpperCase())
    }

    if (params?.search) {
      const searchLower = params.search.toLowerCase()
      restaurants = restaurants.filter(
        (r) => r.name.toLowerCase().includes(searchLower) || r.description?.toLowerCase().includes(searchLower),
      )
    }

    return {
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: restaurants,
    }
  }

  async getRestaurant(id: number): Promise<ApiResponse<RestaurantWithDetails>> {
    this.showWarning()

    const restaurant = mockRestaurantsWithDetails.find((r) => r.id === id)

    if (!restaurant) {
      return {
        success: false,
        error: "Restaurant not found",
      }
    }

    return {
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: restaurant,
    }
  }

  async getRestaurantReviews(restaurantId: number): Promise<ApiResponse<ReviewWithUser[]>> {
    this.showWarning()

    const reviews = mockReviewsWithUser.filter((r) => r.restaurant_id === restaurantId)

    return {
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: reviews,
    }
  }

  async getUserProfile(): Promise<ApiResponse<User>> {
    this.showWarning()

    return {
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: mockUsers[0],
    }
  }

  async getUserBadges(): Promise<ApiResponse<AcquiredBadgeWithDetails[]>> {
    this.showWarning()

    const userBadges = mockAcquiredBadges.map((acquired) => {
      const badge = mockBadges.find((b) => b.id === acquired.badge_id)
      return {
        ...acquired,
        badge,
      }
    })

    return {
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: userBadges,
    }
  }

  async getFavorites(): Promise<ApiResponse<FavoriteWithRestaurant[]>> {
    this.showWarning()

    const favoritesWithRestaurants = mockFavorites.map((favorite) => {
      const restaurant = mockRestaurantsWithDetails.find((r) => r.id === favorite.restaurant_id)
      return {
        ...favorite,
        restaurant,
      }
    })

    return {
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: favoritesWithRestaurants,
    }
  }

  async getUserReviews(): Promise<ApiResponse<ReviewWithUser[]>> {
    this.showWarning()

    const userReviews = mockReviewsWithUser.filter((r) => r.user_id === 1) // Mock current user

    return {
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: userReviews,
    }
  }

  async createReview(data: {
    restaurant_id: number
    rating?: number
    comment?: string
    waste_rating?: number
  }): Promise<ApiResponse<ReviewWithUser>> {
    this.showWarning()

    const newReview: ReviewWithUser = {
      id: Date.now(),
      user_id: 1,
      restaurant_id: data.restaurant_id,
      rating: data.rating || 5,
      comment: data.comment || "",
      waste_rating: data.waste_rating || 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        id: mockUsers[0].id,
        nickname: mockUsers[0].nickname,
        profile: mockUsers[0].profile,
      },
      photos: [],
    }

    return {
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: newReview,
    }
  }

  async toggleFavorite(restaurantId: number, isFavorited: boolean): Promise<ApiResponse<any>> {
    this.showWarning()

    if (isFavorited) {
      // Remove favorite
      return {
        success: true,
        warning: "연결되면 실제 데이터가 표시됩니다",
        message: "Favorite removed",
      }
    } else {
      // Add favorite
      const newFavorite = {
        id: Date.now(),
        restaurant_id: restaurantId,
        user_id: 1,
      }

      return {
        success: true,
        warning: "연결되면 실제 데이터가 표시됩니다",
        data: newFavorite,
      }
    }
  }
}

// Export singleton instance
export const fallbackService = FallbackService.getInstance()