import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const reviewId = Number.parseInt(params.id)

    // Mock AI analysis result
    const analysisResult = {
      review_id: reviewId,
      sentiment: "positive",
      waste_score: 4.5,
      keywords: ["맛있다", "친환경", "잔반없음"],
      suggestions: ["더 많은 친환경 메뉴 추가", "포장 용기 개선"],
      analyzed_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: analysisResult,
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: {
        review_id: Number.parseInt(params.id),
        sentiment: "positive",
        waste_score: 4.0,
        keywords: ["mock", "analysis"],
        suggestions: ["Mock suggestion"],
        analyzed_at: new Date().toISOString(),
      },
    })
  }
}
