import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, nickname } = body

    if (!email || !password || !nickname) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const newUser = {
      id: Date.now(),
      email,
      nickname,
      profile: "/placeholder.svg?key=avatar",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_completed: false,
    }

    const token = `mock_jwt_token_${newUser.id}_${Date.now()}`

    return NextResponse.json({
      success: true,
      data: {
        user: newUser,
        token,
      },
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: {
        user: {
          id: 999,
          email: "mock@example.com",
          nickname: "테스트 사용자",
          profile: "/placeholder.svg?key=avatar",
          is_completed: false,
        },
        token: "mock_token",
      },
    })
  }
}
