import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("query")

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 })
  }

  const res = await fetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`, {
    headers: {
      "X-Naver-Client-Id": process.env.NEXT_PUBLIC_NAVER_CLIENT_ID!,
      "X-Naver-Client-Secret": process.env.NEXT_PUBLIC_NAVER_CLIENT_SECRET!,
    },
  })

  const data = await res.json()
  return NextResponse.json(data)
}