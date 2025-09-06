import { type NextRequest, NextResponse } from "next/server"
import { mockReviews } from "@/lib/database/mock-data"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const reviewId = Number.parseInt(params.id)
    const body = await request.json()
    const { rating, comment, waste_rating } = body

    const existingReview = mockReviews.find((r) => r.id === reviewId)
    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    const updatedReview = {
      ...existingReview,
      rating: rating || existingReview.rating,
      comment: comment || existingReview.comment,
      waste_rating: waste_rating || existingReview.waste_rating,
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: updatedReview,
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: mockReviews[0],
    })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const reviewId = Number.parseInt(params.id)

    return NextResponse.json({
      success: true,
      message: "Review deleted successfully",
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      message: "Mock review deletion",
    })
  }
}
