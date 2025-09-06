import { type NextRequest, NextResponse } from "next/server"
import { mockReviews, mockUsers } from "@/lib/database/mock-data"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const restaurantId = Number.parseInt(params.id)

    // Get reviews for specific restaurant with user details
    const restaurantReviews = mockReviews
      .filter((review) => review.restaurant_id === restaurantId)
      .map((review) => {
        const user = mockUsers.find((u) => u.id === review.user_id)
        return {
          ...review,
          user: user
            ? {
                id: user.id,
                nickname: user.nickname,
                profile: user.profile,
              }
            : null,
          photos: [], // Mock empty photos array
        }
      })

    return NextResponse.json({
      success: true,
      data: restaurantReviews,
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: mockReviews.slice(0, 2), // Return first 2 reviews as fallback
    })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const restaurantId = Number.parseInt(params.id)
    const body = await request.json()
    const { rating, comment, waste_rating } = body

    const newReview = {
      id: Date.now(),
      user_id: 1, // Mock current user
      restaurant_id: restaurantId,
      rating: rating || 5,
      comment: comment || "",
      waste_rating: waste_rating || 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: newReview,
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: {
        id: 999,
        user_id: 1,
        restaurant_id: Number.parseInt(params.id),
        rating: 5,
        comment: "Mock review",
        waste_rating: 4.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })
  }
}
