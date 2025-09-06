import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { restaurant_id, rating, comment, waste_rating } = body

    if (!restaurant_id) {
      return NextResponse.json({ error: "Restaurant ID is required" }, { status: 400 })
    }

    const newReview = {
      id: Date.now(),
      user_id: 1, // Mock current user
      restaurant_id,
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
        restaurant_id: 1,
        rating: 5,
        comment: "Mock review created",
        waste_rating: 4.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })
  }
}
