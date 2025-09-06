import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Leaf, MapPin, Star, Users } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-card to-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/10 p-4 rounded-full">
              <Leaf className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-balance">
            친환경 식당을 찾고
            <br />
            <span className="text-primary">음식물 쓰레기를 줄여요</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
            AI 분석으로 잔반을 측정하고, 제로웨이스트를 실천하는 착한 식당을 발견해보세요
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link href="/login">시작하기</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 bg-transparent">
              <Link href="/map">지도 둘러보기</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">지속가능한 식문화를 만들어가요</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">우리의 작은 실천이 모여 큰 변화를 만듭니다</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardHeader>
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>지도 기반 검색</CardTitle>
              <CardDescription>내 주변 친환경 식당을 쉽게 찾아보세요</CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="bg-secondary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-secondary" />
              </div>
              <CardTitle>AI 잔반 분석</CardTitle>
              <CardDescription>식사 전후 사진으로 자동 잔반 비율 측정</CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-accent" />
              </div>
              <CardTitle>커뮤니티 리뷰</CardTitle>
              <CardDescription>다른 사용자들과 친환경 식당 정보 공유</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-card">
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">지금 시작해보세요</h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            친환경 식당 리뷰 앱으로 지속가능한 식문화에 동참하세요
          </p>
          <Button asChild size="lg" className="text-lg px-8">
            <Link href="/login">회원가입하기</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
