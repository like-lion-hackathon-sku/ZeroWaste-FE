import { type NextRequest, NextResponse } from "next/server"

// Mock user badges matching ERD schema
const mockUserBadges = [
  {
    id: 1,
    user_id: 1,
    badge_id: 1,
    acquired_at: "2024-01-01T00:00:00Z",
    badge: {
      id: 1,
      name: "첫 리뷰 작성자",
      description: "첫 번째 리뷰를 작성했습니다",
    },
  },
  {
    id: 2,
    user_id: 1,
    badge_id: 3,
    acquired_at: "2024-01-15T00:00:00Z",
    badge: {
      id: 3,
      name: "제로웨이스트 챔피언",
      description: "잔반 없이 식사를 20회 완료했습니다",
    },
  },
]

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: mockUserBadges,
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: mockUserBadges,
    })
  }
}
