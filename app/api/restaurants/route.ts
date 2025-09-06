import { type NextRequest, NextResponse } from "next/server"

// Mock restaurant data matching ERD schema
const mockRestaurants = [
  {
    id: 1,
    name: "그린테이블",
    category: "KOREAN",
    address: "서울시 강남구 테헤란로 123",
    telephone: "02-1234-5678",
    mapx: 127.0276,
    mapy: 37.4979,
    is_sponsored: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    // Additional fields for frontend
    score: 4.8,
    distance: "200m",
    badge: "착한 식당",
    image: "/korean-restaurant.png",
    description: "신선한 재료로 만든 건강한 한식 요리",
    wasteScore: 95,
    totalReviews: 127,
  },
  {
    id: 2,
    name: "제로웨이스트 카페",
    category: "CAFE",
    address: "서울시 강남구 역삼동 456",
    telephone: "02-2345-6789",
    mapx: 127.0286,
    mapy: 37.4989,
    is_sponsored: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    score: 4.5,
    distance: "350m",
    badge: "제로웨이스트 도전 중",
    image: "/eco-cafe.png",
    description: "친환경 재료로 만든 음료와 디저트",
    wasteScore: 88,
    totalReviews: 89,
  },
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const search = searchParams.get("search")

    let filteredRestaurants = mockRestaurants

    if (category) {
      filteredRestaurants = filteredRestaurants.filter((r) => r.category === category.toUpperCase())
    }

    if (search) {
      filteredRestaurants = filteredRestaurants.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.description.toLowerCase().includes(search.toLowerCase()),
      )
    }

    return NextResponse.json({
      success: true,
      data: filteredRestaurants,
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: mockRestaurants,
    })
  }
}
