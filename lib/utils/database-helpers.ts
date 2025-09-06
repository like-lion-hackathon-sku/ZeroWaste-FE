import type {
  Restaurant,
  RestaurantWithDetails,
  Review,
  ReviewWithUser,
  User,
  Favorite,
  FavoriteWithRestaurant,
  AcquiredBadge,
  AcquiredBadgeWithDetails,
  Badge,
} from "@/lib/types/database"

// Transform database restaurant to display format
export const transformRestaurantForDisplay = (
  restaurant: Restaurant,
  additionalData?: Partial<RestaurantWithDetails>,
): RestaurantWithDetails => {
  return {
    ...restaurant,
    score: additionalData?.score || 4.0,
    distance: additionalData?.distance || "N/A",
    badge: additionalData?.badge || "일반 식당",
    image: additionalData?.image || "/placeholder.svg",
    description: additionalData?.description || restaurant.name,
    wasteScore: additionalData?.wasteScore || 80,
    totalReviews: additionalData?.totalReviews || 0,
    hours: additionalData?.hours || "정보 없음",
    menu: additionalData?.menu || [],
    gallery: additionalData?.gallery || [],
    reviews: additionalData?.reviews || [],
    favorited: additionalData?.favorited || false,
  }
}

// Transform review with user data
export const transformReviewWithUser = (
  review: Review,
  user: Pick<User, "id" | "nickname" | "profile">,
): ReviewWithUser => {
  return {
    ...review,
    user,
    photos: [],
  }
}

// Transform favorite with restaurant data
export const transformFavoriteWithRestaurant = (
  favorite: Favorite,
  restaurant: RestaurantWithDetails,
): FavoriteWithRestaurant => {
  return {
    ...favorite,
    restaurant,
  }
}

// Transform acquired badge with badge details
export const transformAcquiredBadgeWithDetails = (
  acquiredBadge: AcquiredBadge,
  badge: Badge,
): AcquiredBadgeWithDetails => {
  return {
    ...acquiredBadge,
    badge,
  }
}

// Calculate waste score star rating
export const calculateWasteStarRating = (wasteScore: number): number => {
  return Math.round((wasteScore / 100) * 5 * 10) / 10
}

// Format date for display
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// Format datetime for display
export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate password strength
export const isValidPassword = (password: string): boolean => {
  return password.length >= 8
}

// Generate mock JWT token (for development)
export const generateMockToken = (userId: number): string => {
  return `mock_jwt_token_${userId}_${Date.now()}`
}

// Parse category enum to display string
export const getCategoryDisplayName = (category: string): string => {
  const categoryMap: Record<string, string> = {
    KOREAN: "한식",
    JAPANESE: "일식",
    CHINESE: "중식",
    WESTERN: "양식",
    CAFE: "카페",
    DESSERT: "디저트",
    FAST_FOOD: "패스트푸드",
    OTHER: "기타",
  }
  return categoryMap[category] || category
}

// Calculate distance (mock implementation)
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
  // Simple distance calculation (not accurate, for demo purposes)
  const distance = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2)) * 100

  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`
  } else {
    return `${distance.toFixed(1)}km`
  }
}
