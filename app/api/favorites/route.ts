import { type NextRequest, NextResponse } from "next/server"

// Mock favorites data matching ERD schema
const mockFavorites = [
  {
    id: 1,
    restaurant_id: 2,
    user_id: 1,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 2,
    restaurant_id: 5,
    user_id: 1,
    created_at: "2024-01-02T00:00:00Z",
  },
]

export async function GET(request: NextRequest) {
  try {
    const favoritesWithDetails = mockFavorites.map((fav) => ({
      id: fav.id,
      restaurant_id: fav.restaurant_id,
      user_id: fav.user_id,
      created_at: fav.created_at,
      restaurant: {
        id: fav.restaurant_id,
        name: fav.restaurant_id === 2 ? "제로웨이스트 카페" : "친환경 일식당",
        category: fav.restaurant_id === 2 ? "CAFE" : "JAPANESE",
        image: fav.restaurant_id === 2 ? "/eco-cafe.png" : "/eco-japanese-restaurant.png",
        wasteScore: fav.restaurant_id === 2 ? 88 : 90,
      },
    }))

    return NextResponse.json({
      success: true,
      data: favoritesWithDetails,
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: mockFavorites,
    })
  }
}
