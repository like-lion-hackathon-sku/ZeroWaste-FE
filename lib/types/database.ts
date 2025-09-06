// Database types matching ERD Cloud schema

export interface User {
  id: number
  email: string
  password: string
  nickname: string
  profile: string | null
  created_at: string
  updated_at: string
  is_completed: boolean
}

export interface Restaurant {
  id: number
  name: string
  category: RestaurantCategory
  address: string | null
  telephone: string | null
  mapx: number | null
  mapy: number | null
  is_sponsored: boolean | null
  created_at: string | null
  updated_at: string | null
}

export enum RestaurantCategory {
  KOREAN = "KOREAN",
  JAPANESE = "JAPANESE",
  CHINESE = "CHINESE",
  WESTERN = "WESTERN",
  CAFE = "CAFE",
  DESSERT = "DESSERT",
  FAST_FOOD = "FAST_FOOD",
  OTHER = "OTHER",
}

export interface Review {
  id: number
  user_id: number
  restaurant_id: number
  rating?: number
  comment?: string
  waste_rating?: number
  created_at: string | null
  updated_at: string | null
}

export interface ReviewPhoto {
  id: number
  review_id: number
  image_name: string
  leftover_ratio: number | null
  created_at: string | null
}

export interface Favorite {
  id: number
  restaurant_id: number
  user_id: number
}

export interface Badge {
  id: number
  name: string
  description: string
}

export interface AcquiredBadge {
  id: number
  user_id: number
  badge_id: number
  acquired_at: string
}

export interface RefreshToken {
  id: number
  token: string
  user_id: number
  updated_at: string | null
}

// Extended types for API responses
export interface RestaurantWithDetails extends Restaurant {
  score?: number
  distance?: string
  badge?: string
  image?: string
  description?: string
  wasteScore?: number
  totalReviews?: number
  hours?: string
  menu?: MenuItem[]
  gallery?: string[]
  reviews?: ReviewWithUser[]
  favorited?: boolean
}

export interface MenuItem {
  name: string
  price: string
  description: string
}

export interface ReviewWithUser extends Review {
  user?: Pick<User, "id" | "nickname" | "profile">
  photos?: ReviewPhoto[]
}

export interface FavoriteWithRestaurant extends Favorite {
  restaurant?: RestaurantWithDetails
}

export interface AcquiredBadgeWithDetails extends AcquiredBadge {
  badge?: Badge
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  warning?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Request types
export interface LoginRequest {
  email: string
  password: string
}

export interface SignupRequest {
  email: string
  password: string
  nickname: string
}

export interface UpdateProfileRequest {
  nickname?: string
  profile?: string
}

export interface CreateReviewRequest {
  restaurant_id: number
  rating?: number
  comment?: string
  waste_rating?: number
  photos?: File[]
}

export interface UpdateReviewRequest {
  rating?: number
  comment?: string
  waste_rating?: number
}
