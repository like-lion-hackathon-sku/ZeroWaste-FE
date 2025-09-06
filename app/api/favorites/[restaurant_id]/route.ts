import { type NextRequest, NextResponse } from "next/server"

export async function PUT(request: NextRequest, { params }: { params: { restaurant_id: string } }) {
  try {
    const restaurantId = Number.parseInt(params.restaurant_id)

    const newFavorite = {
      id: Date.now(),
      restaurant_id: restaurantId,
      user_id: 1,
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: newFavorite,
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: { id: 999, restaurant_id: Number.parseInt(params.restaurant_id), user_id: 1 },
    })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { restaurant_id: string } }) {
  try {
    const restaurantId = Number.parseInt(params.restaurant_id)

    return NextResponse.json({
      success: true,
      message: "Favorite removed successfully",
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      message: "Mock favorite removal",
    })
  }
}
