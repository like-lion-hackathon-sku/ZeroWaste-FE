import { type NextRequest, NextResponse } from "next/server"

// Mock user data for fallback
const mockUsers = [
  {
    id: 1,
    email: "eco.kim@example.com",
    password: "password123",
    nickname: "김환경",
    profile: "/placeholder.svg?key=avatar",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    is_completed: true,
  },
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    const user = mockUsers.find((u) => u.email === email && u.password === password)

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Mock JWT token
    const token = `mock_jwt_token_${user.id}_${Date.now()}`
    const refreshToken = `mock_refresh_token_${user.id}_${Date.now()}`

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          profile: user.profile,
          is_completed: user.is_completed,
        },
        token,
        refresh_token: refreshToken,
      },
    })
  } catch (error) {
    console.log("[v0] API connection failed, using mock data")

    // Show warning to user about mock data
    return NextResponse.json({
      success: true,
      warning: "연결되면 실제 데이터가 표시됩니다",
      data: {
        user: mockUsers[0],
        token: "mock_token",
        refresh_token: "mock_refresh_token",
      },
    })
  }
}
