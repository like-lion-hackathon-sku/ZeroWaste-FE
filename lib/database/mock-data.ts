// lib/database/mock-data.ts
import type {
  User,
  Restaurant,
  Review,
  ReviewPhoto,
  Favorite,
  Badge,
  AcquiredBadge,
  RefreshToken,
  RestaurantWithDetails,
  ReviewWithUser,
} from "@/lib/types/database"

/**
 * 카테고리 타입을 Restaurant에서 그대로 추출해서 사용
 * - 원본 타입(유니온/enum)이 바뀌어도 자동으로 따라감
 */
type RestaurantCategory = Restaurant["category"]

/** 카테고리 상수 — 원본 타입에 맞춰 단언 */
const RC = {
  KOREAN: "KOREAN" as RestaurantCategory,
  CAFE: "CAFE" as RestaurantCategory,
  // 필요하면 여기에 계속 추가
} as const

export const mockUsers: User[] = [
  {
    id: 1,
    email: "eco.kim@example.com",
    password: "password123",
    nickname: "김환경",
    profile: "/placeholder.svg?key=avatar",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    is_completed: true,
  },
  {
    id: 2,
    email: "green.lee@example.com",
    password: "password123",
    nickname: "이지구",
    profile: "/placeholder.svg?key=avatar2",
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    is_completed: true,
  },
]

export const mockRestaurants: Restaurant[] = [
  {
    id: 1,
    name: "그린테이블",
    category: RC.KOREAN,
    address: "서울시 강남구 테헤란로 123",
    telephone: "02-1234-5678",
    mapx: 127.0276,
    mapy: 37.4979,
    is_sponsored: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "제로웨이스트 카페",
    category: RC.CAFE,
    address: "서울시 강남구 역삼동 456",
    telephone: "02-2345-6789",
    mapx: 127.0286,
    mapy: 37.4989,
    is_sponsored: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 3,
    name: "자연밥상",
    category: RC.KOREAN,
    address: "서울시 서초구 서초대로 789",
    telephone: "02-3456-7890",
    mapx: 127.0296,
    mapy: 37.4999,
    is_sponsored: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
]

export const mockReviews: Review[] = [
  {
    id: 1,
    user_id: 1,
    restaurant_id: 1,
    rating: 5,
    comment: "정말 맛있고 음식도 적당한 양이라 남기지 않고 다 먹었어요!",
    waste_rating: 4.9,
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
  },
  {
    id: 2,
    user_id: 2,
    restaurant_id: 1,
    rating: 4,
    comment: "친환경적인 식당이라 좋네요. 포장도 재활용 가능한 용기로 해주셔서 감사합니다.",
    waste_rating: 4.6,
    created_at: "2024-01-10T00:00:00Z",
    updated_at: "2024-01-10T00:00:00Z",
  },
]

export const mockReviewPhotos: ReviewPhoto[] = [
  {
    id: 1,
    review_id: 1,
    image_name: "review_1_photo_1.jpg",
    leftover_ratio: 0.0,
    created_at: "2024-01-15T00:00:00Z",
  },
]

export const mockFavorites: Favorite[] = [
  { id: 1, restaurant_id: 2, user_id: 1 },
  { id: 2, restaurant_id: 3, user_id: 1 },
]

export const mockBadges: Badge[] = [
  { id: 1, name: "첫 리뷰 작성자", description: "첫 번째 리뷰를 작성했습니다" },
  { id: 2, name: "친환경 전사", description: "10개 이상의 친환경 식당을 방문했습니다" },
  { id: 3, name: "제로웨이스트 챔피언", description: "잔반 없이 식사를 20회 완료했습니다" },
  { id: 4, name: "리뷰 마스터", description: "50개 이상의 리뷰를 작성했습니다" },
]

export const mockAcquiredBadges: AcquiredBadge[] = [
  { id: 1, user_id: 1, badge_id: 1, acquired_at: "2024-01-01T00:00:00Z" },
  { id: 2, user_id: 1, badge_id: 3, acquired_at: "2024-01-15T00:00:00Z" },
]

export const mockRefreshTokens: RefreshToken[] = [
  { id: 1, token: "mock_refresh_token_1", user_id: 1, updated_at: "2024-01-01T00:00:00Z" },
]

// ── 확장된 목업 (프론트에서 편하게 쓰도록)
export const mockRestaurantsWithDetails: RestaurantWithDetails[] = [
  {
    ...mockRestaurants[0],
    score: 4.8,
    distance: "200m",
    badge: "착한 식당",
    image: "/korean-restaurant.png",
    description:
      "신선한 재료로 만든 건강한 한식 요리를 제공합니다. 유기농 채소와 무항생제 육류만을 사용하여 건강하고 맛있는 음식을 만들어 드립니다.",
    wasteScore: 95,
    totalReviews: 127,
    hours: "11:00 - 22:00",
    menu: [
      { name: "비빔밥", price: "12,000원", description: "신선한 나물과 고기가 들어간 영양만점 비빔밥" },
      { name: "된장찌개", price: "8,000원", description: "집에서 담근 된장으로 끓인 구수한 찌개" },
      { name: "불고기", price: "18,000원", description: "무항생제 한우로 만든 달콤한 불고기" },
      { name: "김치찌개", price: "9,000원", description: "잘 익은 김치로 끓인 얼큰한 찌개" },
    ],
    gallery: [
      "/korean-restaurant.png",
      "/natural-korean-food.png",
      "/placeholder.svg?key=gallery1",
      "/placeholder.svg?key=gallery2",
    ],
    favorited: false,
  },
  {
    ...mockRestaurants[1],
    score: 4.5,
    distance: "350m",
    badge: "제로웨이스트 도전 중",
    image: "/eco-cafe.png",
    description: "친환경 재료로 만든 음료와 디저트",
    wasteScore: 88,
    totalReviews: 89,
    hours: "09:00 - 21:00",
    favorited: true,
  },
  {
    ...mockRestaurants[2],
    score: 4.7,
    distance: "500m",
    badge: "착한 식당",
    image: "/natural-korean-food.png",
    description: "유기농 재료로 만한 전통 한식",
    wasteScore: 92,
    totalReviews: 156,
    hours: "11:30 - 21:30",
    favorited: false,
  },
]

export const mockReviewsWithUser: ReviewWithUser[] = [
  {
    ...mockReviews[0],
    user: {
      id: mockUsers[0].id,
      nickname: mockUsers[0].nickname,
      profile: mockUsers[0].profile,
    },
    photos: [mockReviewPhotos[0]],
  },
  {
    ...mockReviews[1],
    user: {
      id: mockUsers[1].id,
      nickname: mockUsers[1].nickname,
      profile: mockUsers[1].profile,
    },
    photos: [],
  },
]
