"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Search, MapPin, Star, Leaf, Award } from "lucide-react"
import Link from "next/link"

/**
 * 시작 페이지 컴포넌트 (/home)
 * - 앱의 메인 랜딩 페이지
 * - 친환경 식당 앱의 주요 기능 소개
 * - 검색 기능과 주요 액션 버튼 제공
 */
export default function HomePage() {
  // 검색어 상태 관리
  const [searchQuery, setSearchQuery] = useState("")

  /**
   * 검색 실행 함수
   * 사용자가 입력한 검색어로 식당 검색 페이지로 이동
   */
  const handleSearch = () => {
    if (searchQuery.trim()) {
      // 검색어가 있으면 식당 조회 페이지로 이동
      window.location.href = `/restaurants?search=${encodeURIComponent(searchQuery)}`
    } else {
      // 검색어가 없으면 전체 식당 목록 페이지로 이동
      window.location.href = "/restaurants"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* 헤더 영역 */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {/* 로고 및 앱 이름 */}
          <div className="flex items-center gap-2">
            <Leaf className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-green-800">EcoEats</h1>
          </div>

          {/* 로그인/회원가입 버튼 */}
          <div className="flex gap-2">
            <Link href="/auth/login">
              <Button variant="outline">로그인</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>회원가입</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 메인 히어로 섹션 */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">친환경 식당을 찾아보세요</h2>
          <p className="text-xl text-gray-600 mb-8">잔반 없는 건강한 식사, 지구를 생각하는 식당 정보</p>

          {/* 메인 검색 바 */}
          <div className="max-w-md mx-auto flex gap-2">
            <Input
              placeholder="식당 이름이나 지역을 검색하세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} className="bg-green-600 hover:bg-green-700">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 주요 기능 카드 섹션 */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* 식당 찾기 카드 */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/restaurants">
              <CardContent className="p-6 text-center">
                <MapPin className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">식당 찾기</h3>
                <p className="text-gray-600">내 주변 친환경 식당을 지도에서 확인하세요</p>
              </CardContent>
            </Link>
          </Card>

          {/* 리뷰 작성 카드 */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/auth/login">
              <CardContent className="p-6 text-center">
                <Star className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">리뷰 작성</h3>
                <p className="text-gray-600">식당 방문 후기와 잔반 정보를 공유하세요</p>
              </CardContent>
            </Link>
          </Card>

          {/* 배지 수집 카드 */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link href="/auth/login">
              <CardContent className="p-6 text-center">
                <Award className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">배지 수집</h3>
                <p className="text-gray-600">친환경 활동으로 다양한 배지를 획득하세요</p>
              </CardContent>
            </Link>
          </Card>
        </div>

        {/* 통계 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">EcoEats와 함께하는 친환경 식사</h3>
          <div className="grid md:grid-cols-3 gap-8">
            {/* 등록된 식당 수 */}
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">1,234</div>
              <div className="text-gray-600">등록된 친환경 식당</div>
            </div>

            {/* 작성된 리뷰 수 */}
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">5,678</div>
              <div className="text-gray-600">작성된 리뷰</div>
            </div>

            {/* 절약된 음식물 쓰레기 */}
            <div>
              <div className="text-3xl font-bold text-purple-600 mb-2">89%</div>
              <div className="text-gray-600">평균 잔반 없음 비율</div>
            </div>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-50 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; 2024 EcoEats. 지구를 생각하는 식사 문화를 만들어갑니다.</p>
        </div>
      </footer>
    </div>
  )
}
