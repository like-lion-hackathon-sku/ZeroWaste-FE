"use client"

import React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, User, Camera } from "lucide-react"
import { useRouter } from "next/navigation"
import { useUserProfile } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"

export default function EditProfilePage() {
  const router = useRouter()
  const { data: user, loading, error, isUsingFallback } = useUserProfile()

  const [formData, setFormData] = useState({ nickname: "", email: "" })
  const [avatar, setAvatar] = useState("")
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    if (user) {
      setFormData({ nickname: user.nickname, email: user.email })
      setAvatar(user.profile || "")
    }
  }, [user])

  const handleInputChange = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }))

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => setAvatar(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const res = await apiClient.updateProfile({ nickname: formData.nickname, profile: avatar })
      if (res.success) router.back()
      else alert("프로필 업데이트에 실패했습니다")
    } catch (e) {
      alert("프로필 업데이트 중 오류가 발생했습니다")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <div className="text-gray-600 dark:text-gray-300">프로필 정보를 불러오는 중...</div>
        </motion.div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="text-red-500 mb-4">프로필 정보를 불러올 수 없습니다</div>
          <Button onClick={() => router.back()} className="bg-gradient-to-r from-green-500 to-emerald-600">
            뒤로가기
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {isUsingFallback && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-500/20 backdrop-blur-sm border-b border-yellow-200/30 p-3"
        >
          <div className="container mx-auto text-center text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ 연결되면 실제 데이터가 표시됩니다
          </div>
        </motion.div>
      )}

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
            프로필 수정
          </h1>
          <div className="w-8" />
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="mb-6 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                프로필 사진
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  <Avatar className="h-24 w-24 ring-4 ring-green-500/20">
                    <AvatarImage src={avatar || "/placeholder.svg"} alt="프로필 사진" />
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                      <User className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                <div>
                  <Label htmlFor="avatar-upload" className="cursor-pointer">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="bg-white/50 hover:bg-white/80 border-white/30"
                    >
                      <span>
                        <Camera className="h-4 w-4 mr-2" />
                        사진 변경
                      </span>
                    </Button>
                  </Label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">JPG, PNG 파일만 업로드 가능합니다.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="mb-6 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                개인정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nickname" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  닉네임
                </Label>
                <Input
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) => handleInputChange("nickname", e.target.value)}
                  placeholder="닉네임을 입력하세요"
                  className="mt-1 h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-green-500/20"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  이메일
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="이메일을 입력하세요"
                  disabled
                  className="mt-1 h-12 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">이메일은 변경할 수 없습니다</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">가입일</Label>
                <Input
                  value={formatDate(user.created_at)}
                  disabled
                  className="mt-1 h-12 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Button
            onClick={handleSave}
            className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
            size="lg"
            disabled={saving}
          >
            {saving ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                />
                저장 중...
              </>
            ) : (
              "변경사항 저장"
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
