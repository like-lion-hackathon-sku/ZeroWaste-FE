import { type NextRequest, NextResponse } from "next/server"

const mockRestaurantDetails = {
  1: {
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
    score: 4.8,
    distance: "200m",
    badge: "착한 식당",
    image: "/korean-restaurant.png",
    description: "신선한 재료로 만든 건강한 한식 요리를 제공합니다.",
    wasteScore: 95,
    totalReviews: 127,
    hours: "11:00 - 22:00",
    menu: [
      { name: "비빔밥", price: "12,000원", description: "신선한 나물과 고기가 들어간 영양만점 비빔밥" },
      { name: "된장찌개", price: "8,000원", description: "집에서 담근 된장으로 끓인 구수한 찌개" },
    ],
    gallery: ["/korean-restaurant.png", "/natural-korean-food.png"],
  },
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const restaurantId = Number.parseInt(params.id)

    const restaurant = mockRestaurantDetails[restaurantId as keyof typeof mockRestaurantDetails]

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: restaurant,
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: mockRestaurantDetails[1],
    })
  }
}
