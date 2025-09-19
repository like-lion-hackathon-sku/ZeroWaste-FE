"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Upload, Plus, Trash2, Camera, FileText, Store, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api/client"

interface MenuItem {
  name: string
  price: string
  description: string
  image?: File
  imagePreview?: string
}

export default function OwnerRegistrationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Form state
  const [restaurantName, setRestaurantName] = useState("")
  const [restaurantImage, setRestaurantImage] = useState<File | null>(null)
  const [restaurantImagePreview, setRestaurantImagePreview] = useState("")
  const [businessLicense, setBusinessLicense] = useState<File | null>(null)
  const [businessLicensePreview, setBusinessLicensePreview] = useState("")

  const [menuItems, setMenuItems] = useState<MenuItem[]>([{ name: "", price: "", description: "" }])

  const [restaurantInfo, setRestaurantInfo] = useState({
    description: "",
    directions: "",
    phone: "",
    address: "",
  })

  const handleImageUpload = (file: File, type: "restaurant" | "license" | "menu", index?: number) => {
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
      } else if (type === "license") {
        setBusinessLicense(file)
        setBusinessLicensePreview(preview)
      } else if (type === "menu" && index !== undefined) {
        const newMenuItems = [...menuItems]
        newMenuItems[index].image = file
        newMenuItems[index].imagePreview = preview
        setMenuItems(newMenuItems)
      }
    }
    reader.readAsDataURL(file)
  }

  const addMenuItem = () => {
    setMenuItems([...menuItems, { name: "", price: "", description: "" }])
  }

  const removeMenuItem = (index: number) => {
    if (menuItems.length > 1) {
      setMenuItems(menuItems.filter((_, i) => i !== index))
    }
  }

  const updateMenuItem = (index: number, field: keyof MenuItem, value: string) => {
    const newMenuItems = [...menuItems]
    newMenuItems[index] = { ...newMenuItems[index], [field]: value }
    setMenuItems(newMenuItems)
  }

  const handleSubmit = async () => {
    // Validation
    if (!restaurantName.trim()) {
      alert("식당 이름을 입력해주세요.")
      return
    }

    if (!restaurantInfo.description.trim()) {
      alert("가게 소개를 입력해주세요.")
      return
    }

    if (!restaurantInfo.phone.trim()) {
      alert("전화번호를 입력해주세요.")
      return
    }

    if (!restaurantInfo.address.trim()) {
      alert("주소를 입력해주세요.")
      return
    }

    const validMenuItems = menuItems.filter((item) => item.name.trim() && item.price.trim() && item.description.trim())

    if (validMenuItems.length === 0) {
      alert("최소 하나의 메뉴를 완전히 입력해주세요.")
      return
    }

    setLoading(true)

    try {
      const res = await apiClient.createBusinessRestaurant({
        name: restaurantName,
        category: "KOREAN", // 기본값, 추후 선택 가능하도록 개선
        address: restaurantInfo.address,
        telephone: restaurantInfo.phone,
        mapx: 127.0276, // 기본값, 추후 주소 기반 좌표 변환 구현
        mapy: 37.4979,
      })

      if (!res.success) {
        throw new Error(res.error || "식당 등록에 실패했습니다.")
      }

      alert("사장님 등록이 완료되었습니다!")
      router.push("/profile")
    } catch (error: any) {
      alert(error?.message || "등록 중 오류가 발생했습니다. 다시 시도해주세요.")
      console.error("Owner registration error:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-white/20 p-4 sticky top-0 z-10"
      >
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="hover:bg-white/20">
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
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
                        onClick={() => {
                          setRestaurantImage(null)
                          setRestaurantImagePreview("")
                        }}
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

              {/* 사업자 등록증 */}
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">사업자 등록증</Label>
                <div className="mt-2 flex items-center gap-4">
                  {businessLicensePreview && (
                    <div className="relative">
                      <img
                        src={businessLicensePreview || "/placeholder.svg"}
                        alt="사업자 등록증"
                        className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 w-6 h-6 p-0"
                        onClick={() => {
                          setBusinessLicense(null)
                          setBusinessLicensePreview("")
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <Label htmlFor="business-license" className="cursor-pointer">
                    <div className="flex items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition-colors">
                      <FileText className="h-6 w-6 text-gray-400" />
                    </div>
                  </Label>
                  <input
                    id="business-license"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImageUpload(file, "license")
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 메뉴 정보 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
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
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-white">메뉴 {index + 1}</h4>
                    {menuItems.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMenuItem(index)}
                        className="text-red-500 hover:text-red-700"
                      >
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
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">가격 *</Label>
                      <Input
                        value={item.price}
                        onChange={(e) => updateMenuItem(index, "price", e.target.value)}
                        placeholder="예: 12,000원"
                        className="mt-1 bg-white/50 dark:bg-gray-800/50"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">메뉴 설명 *</Label>
                    <Textarea
                      value={item.description}
                      onChange={(e) => updateMenuItem(index, "description", e.target.value)}
                      placeholder="메뉴에 대한 설명을 입력하세요"
                      className="mt-1 bg-white/50 dark:bg-gray-800/50"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">메뉴 사진</Label>
                    <div className="mt-2 flex items-center gap-4">
                      {item.imagePreview && (
                        <div className="relative">
                          <img
                            src={item.imagePreview || "/placeholder.svg"}
                            alt={`메뉴 ${index + 1} 사진`}
                            className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute -top-2 -right-2 w-5 h-5 p-0"
                            onClick={() => {
                              const newMenuItems = [...menuItems]
                              delete newMenuItems[index].image
                              delete newMenuItems[index].imagePreview
                              setMenuItems(newMenuItems)
                            }}
                          >
                            <Trash2 className="h-2 w-2" />
                          </Button>
                        </div>
                      )}
                      <Label htmlFor={`menu-image-${index}`} className="cursor-pointer">
                        <div className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition-colors">
                          <Camera className="h-5 w-5 text-gray-400" />
                        </div>
                      </Label>
                      <input
                        id={`menu-image-${index}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(file, "menu", index)
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* 식당 정보 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-500" />
                식당 상세 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">가게 소개 *</Label>
                <Textarea
                  value={restaurantInfo.description}
                  onChange={(e) => setRestaurantInfo({ ...restaurantInfo, description: e.target.value })}
                  placeholder="가게의 특징, 분위기, 추천 메뉴 등을 소개해주세요"
                  className="mt-1 bg-white/50 dark:bg-gray-800/50"
                  rows={4}
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">오시는 길 *</Label>
                <Textarea
                  value={restaurantInfo.directions}
                  onChange={(e) => setRestaurantInfo({ ...restaurantInfo, directions: e.target.value })}
                  placeholder="대중교통 이용 방법, 주차 정보, 주요 랜드마크 등을 안내해주세요"
                  className="mt-1 bg-white/50 dark:bg-gray-800/50"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">전화번호 *</Label>
                  <Input
                    value={restaurantInfo.phone}
                    onChange={(e) => setRestaurantInfo({ ...restaurantInfo, phone: e.target.value })}
                    placeholder="02-1234-5678"
                    className="mt-1 bg-white/50 dark:bg-gray-800/50"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">주소 *</Label>
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
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
