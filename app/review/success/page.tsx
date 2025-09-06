"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Leaf } from "lucide-react"

export default function ReviewSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const restaurantId = searchParams.get("restaurantId")

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">리뷰 작성 완료!</CardTitle>
          <p className="text-muted-foreground">소중한 후기를 남겨주셔서 감사합니다</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-primary/5 p-4 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-medium text-primary">친환경 기여도</span>
            </div>
            <p className="text-sm text-muted-foreground">당신의 리뷰가 다른 사용자들에게 도움이 될 것입니다</p>
          </div>

          <div className="space-y-3">
            <Button onClick={() => router.push(`/restaurant/${restaurantId}`)} className="w-full">
              식당 페이지로 돌아가기
            </Button>
            <Button variant="outline" onClick={() => router.push("/map")} className="w-full bg-transparent">
              지도로 돌아가기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
