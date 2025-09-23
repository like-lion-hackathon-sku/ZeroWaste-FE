"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Upload, Plus, Trash2, Camera, Store, MapPin, Search, Gift } from "lucide-react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api/client"

// ---------------- Types ----------------
type MenuItem = {
  name: string
  beforeImage?: File
  beforeImagePreview?: string
}

type BenefitItem = {
  condition: number | ""
  reward: string
}

type NaverPlaceRaw = {
  title: string
  link: string
  category: string
  description: string
  telephone: string
  address: string
  roadAddress: string
  mapx: string // 네이버는 문자열
  mapy: string
}

export default function OwnerRegistrationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // 🔎 네이버 검색
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<NaverPlaceRaw[]>([])
  const [naverRaw, setNaverRaw] = useState<NaverPlaceRaw | null>(null) // 선택된 원본

  // Form state
  const [restaurantName, setRestaurantName] = useState("")
  const [restaurantImage, setRestaurantImage] = useState<File | null>(null)
  const [restaurantImagePreview, setRestaurantImagePreview] = useState("")

  const [menuItems, setMenuItems] = useState<MenuItem[]>([{ name: "" }])

  const [restaurantInfo, setRestaurantInfo] = useState({
    phone: "",
    address: "",
  })

  // ✅ 혜택(benefits)
  const [benefits, setBenefits] = useState<BenefitItem[]>([
    { condition: "", reward: "" },
  ])

  // ───────────────────────── 이미지 업로드 공통
  const handleImageUpload = (
    file: File,
    type: "restaurant" | "menuBefore",
    index?: number
  ) => {
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB 이하여야 합니다.")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const preview = e.target?.result as string

      if (type === "restaurant") {
        setRestaurantImage(file)
        setRestaurantImagePreview(preview)
      } else if (type === "menuBefore" && index !== undefined) {
        const list = [...menuItems]
        list[index].beforeImage = file
        list[index].beforeImagePreview = preview
        setMenuItems(list)
      }
    }
    reader.readAsDataURL(file)
  }

  // ───────────────────────── 메뉴 조작
  const addMenuItem = () => setMenuItems([...menuItems, { name: "" }])

  const removeMenuItem = (index: number) => {
    if (menuItems.length > 1) setMenuItems(menuItems.filter((_, i) => i !== index))
  }

  const updateMenuItem = (index: number, field: keyof MenuItem, value: string) => {
    const next = [...menuItems]
    next[index] = { ...next[index], [field]: value }
    setMenuItems(next)
  }

  // ───────────────────────── 혜택 조작
  const addBenefit = () => setBenefits([...benefits, { condition: "", reward: "" }])

  const removeBenefit = (i: number) => {
    if (benefits.length > 1) setBenefits(benefits.filter((_, idx) => idx !== i))
  }

  const updateBenefit = (i: number, patch: Partial<BenefitItem>) => {
    const next = [...benefits]
    next[i] = { ...next[i], ...patch }
    setBenefits(next)
  }

  // ───────────────────────── 네이버 API 검색
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/naver-search?query=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults((data?.items ?? []) as NaverPlaceRaw[])
    } catch (e) {
      console.error(e)
      alert("검색 중 오류가 발생했습니다.")
    } finally {
      setSearching(false)
    }
  }

  // 결과 선택 → 폼 채우기
  const pickPlace = (place: NaverPlaceRaw) => {
    setNaverRaw(place)
    const cleanTitle = place.title.replace(/<\/?b>/g, "")
    setRestaurantName(cleanTitle)
    setRestaurantInfo((prev) => ({
      ...prev,
      address: place.roadAddress || place.address || prev.address,
      phone: place.telephone || prev.phone,
    }))
    setSearchResults([]) // 목록 닫기
    setSearchQuery("")   // 검색창 초기화
  }

  // ───────────────────────── 제출 (multipart/form-data) via apiClient
  const handleSubmit = async () => {
    // 기본 검증
    if (!restaurantName.trim()) {
      alert("식당 이름을 입력해주세요.")
      return
    }
    if (!restaurantInfo.address.trim() && !naverRaw?.address && !naverRaw?.roadAddress) {
      alert("주소를 입력(또는 네이버에서 선택)해주세요.")
      return
    }

    // 메뉴명 최소 1개
    const menuNames = menuItems
      .map(m => (m.name || "").trim())
      .filter(Boolean)
    if (menuNames.length === 0) {
      if (!confirm("메뉴 이름이 없습니다. 계속 진행할까요?")) return
    }

    // benefits 정제: condition >0 & reward 유효
    const refinedBenefits = benefits
      .map(b => ({
        condition: typeof b.condition === "number" ? b.condition : Number(b.condition),
        reward: (b.reward || "").trim(),
      }))
      .filter(b => Number.isFinite(b.condition) && b.condition > 0 && b.reward.length > 0)

    setLoading(true)
    try {
      const payload = {
        name: restaurantName.trim(),
        category: "ETC", // 필요 시 선택 UI로 변경
        address: (naverRaw?.roadAddress || naverRaw?.address || restaurantInfo.address || "").trim(),
        telephone: (naverRaw?.telephone || restaurantInfo.phone || "").trim(),
        // BE DTO가 문자열을 parseInt 하므로 문자열 그대로 전달 OK
        mapx: (naverRaw?.mapx || "0") as unknown as number, // 타입은 맞추되 값은 문자열 전달됨
        mapy: (naverRaw?.mapy || "0") as unknown as number,
        images: restaurantImage ? [restaurantImage] : [],
        menuImages: menuItems.map(m => m.beforeImage).filter(Boolean) as File[],
        menuMetadatas: menuNames, // apiClient가 안전 포맷으로 변환해 전송
        benefits: refinedBenefits, // [{condition, reward}]
      }

      const res = await apiClient.createBusinessRestaurantMultipart(payload)
      if (!res.success) {
        throw new Error(res.error || "등록에 실패했어요.")
      }

      const rid = (res.data as any)?.restaurantId
      alert("사장님 등록이 완료되었습니다!")
      router.push(rid ? `/restaurant/${rid}?isOwnerMode=true` : "/profile")
    } catch (err: any) {
      console.error(err)
      alert(err?.message || "등록 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  // ───────────────────────── UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* 헤더 */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-white/20 p-4 sticky top-0 z-10"
      >
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="font-bold text-xl bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
            사장님 등록
          </h1>
          <div className="w-8" />
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* 🔎 네이버 식당 검색 */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-green-500" />
                네이버 식당 검색
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="식당 이름으로 검색"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching}>
                  <Search className="w-4 h-4 mr-1" />
                  {searching ? "검색중…" : "검색"}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <ul className="mt-3 border rounded-md divide-y max-h-60 overflow-y-auto bg-white dark:bg-gray-8 00">
                  {searchResults.map((p, i) => (
                    <li
                      key={`${p.link}_${i}`}
                      className="p-2 cursor-pointer hover:bg-green-50 dark:hover:bg-gray-700"
                      onClick={() => pickPlace(p)}
                    >
                      <p
                        className="font-medium text-gray-900 dark:text-gray-100"
                        dangerouslySetInnerHTML={{ __html: p.title }} // 네이버 <b> 하이라이트
                      />
                      <p className="text-sm text-gray-500">
                        {p.roadAddress || p.address}
                      </p>
                      {p.telephone && (
                        <p className="text-xs text-gray-400">{p.telephone}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {naverRaw && (
                <div className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
                  선택됨: <b>{restaurantName}</b> · 제출 시 category는 <b>ETC</b>로 전송
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 식당 기본 정보 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
          <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-green-500" />
                식당 기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 식당 이름 */}
              <div>
                <Label htmlFor="restaurant-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  식당 이름 *
                </Label>
                <Input
                  id="restaurant-name"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="식당 이름을 입력하세요"
                  className="mt-1 h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-green-500/20"
                />
              </div>

              {/* 식당 사진 */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">식당 사진</Label>
                <div className="mt-2 flex items-center gap-4">
                  {restaurantImagePreview && (
                    <div className="relative">
                      <img
                        src={restaurantImagePreview || "/placeholder.svg"}
                        alt="식당 사진"
                        className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 w-6 h-6 p-0"
                        onClick={() => { setRestaurantImage(null); setRestaurantImagePreview("") }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <Label htmlFor="restaurant-image" className="cursor-pointer">
                    <div className="flex items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition-colors">
                      <Camera className="h-6 w-6 text-gray-400" />
                    </div>
                  </Label>
                  <input
                    id="restaurant-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImageUpload(file, "restaurant")
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 메뉴 정보 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-green-500" />
                  메뉴 정보
                </CardTitle>
                <Button onClick={addMenuItem} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  메뉴 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {menuItems.map((item, index) => (
                <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-white">메뉴 {index + 1}</h4>
                    {menuItems.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeMenuItem(index)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">메뉴 이름 *</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateMenuItem(index, "name", e.target.value)}
                        placeholder="메뉴 이름"
                        className="mt-1 bg-white/50 dark:bg-gray-800/50"
                      />
                    </div>
                  </div>

                  {/* 식사 전 사진 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">식사 전 사진</Label>
                      <div className="mt-2 flex items-center gap-4">
                        {item.beforeImagePreview && (
                          <div className="relative">
                            <img
                              src={item.beforeImagePreview || "/placeholder.svg"}
                              alt={`메뉴 ${index + 1} 식사 전`}
                              className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute -top-2 -right-2 w-5 h-5 p-0"
                              onClick={() => {
                                const list = [...menuItems]
                                delete list[index].beforeImage
                                delete list[index].beforeImagePreview
                                setMenuItems(list)
                              }}
                            >
                              <Trash2 className="h-2 w-2" />
                            </Button>
                          </div>
                        )}
                        <Label htmlFor={`menu-before-${index}`} className="cursor-pointer">
                          <div className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition-colors">
                            <Camera className="h-5 w-5 text-gray-400" />
                          </div>
                        </Label>
                        <input
                          id={`menu-before-${index}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleImageUpload(file, "menuBefore", index)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* 혜택(스탬프 보상) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mb-6">
          <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-green-500" />
                  스탬프 혜택
                </CardTitle>
                <Button onClick={addBenefit} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  혜택 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {benefits.map((b, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end border rounded-md p-3">
                  <div className="md:col-span-2">
                    <Label className="text-sm">조건(스탬프 개수) *</Label>
                    <Input
                      inputMode="numeric"
                      pattern="\d*"
                      placeholder="예: 5"
                      value={b.condition}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "")
                        updateBenefit(i, { condition: v === "" ? "" : Number(v) })
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-sm">리워드 *</Label>
                    <Input
                      placeholder='예: "군만두 4개 세트"'
                      value={b.reward}
                      onChange={(e) => updateBenefit(i, { reward: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    {benefits.length > 1 && (
                      <Button variant="ghost" className="text-red-500" onClick={() => removeBenefit(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-500">
                * 생성 시 저장된 혜택은 나중에 스탬프 사용 조건 및 리워드 지급 기준으로 활용됩니다.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* 식당 연락처/주소 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6">
          <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-500" />
                식당 상세 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    전화번호
                  </Label>
                  <Input
                    value={restaurantInfo.phone}
                    onChange={(e) => setRestaurantInfo({ ...restaurantInfo, phone: e.target.value })}
                    placeholder="02-1234-5678"
                    className="mt-1 bg-white/50 dark:bg-gray-800/50"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    주소 *
                  </Label>
                  <Input
                    value={restaurantInfo.address}
                    onChange={(e) => setRestaurantInfo({ ...restaurantInfo, address: e.target.value })}
                    placeholder="서울시 강남구 테헤란로 123"
                    className="mt-1 bg-white/50 dark:bg-gray-800/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 등록 버튼 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
            size="lg"
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                />
                등록 중...
              </>
            ) : (
              "사장님 등록 완료"
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
