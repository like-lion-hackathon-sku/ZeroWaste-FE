import { type NextRequest, NextResponse } from "next/server"
import { mockReviews, mockRestaurants } from "@/lib/database/mock-data"

export async function GET(request: NextRequest) {
  try {
    // Mock user reviews with restaurant details
    const userReviews = mockReviews
      .filter((review) => review.user_id === 1) // Mock current user ID
      .map((review) => {
        const restaurant = mockRestaurants.find((r) => r.id === review.restaurant_id)
        return {
          ...review,
          restaurant: restaurant
            ? {
                id: restaurant.id,
                name: restaurant.name,
                category: restaurant.category,
                image: "/korean-restaurant.png", // Mock image
              }
            : null,
        }
      })

    return NextResponse.json({
      success: true,
      data: userReviews,
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: mockReviews.slice(0, 1), // Return first review as fallback
    })
  }
}
