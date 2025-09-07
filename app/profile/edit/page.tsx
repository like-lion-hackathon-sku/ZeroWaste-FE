"use client"

import React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, User, Camera, Loader2 } from "lucide-react"   // ← Trash2 제거
import { useRouter } from "next/navigation"
import { useUserProfile } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"

export default function EditProfilePage() {
  const router = useRouter()
  const { data: user, loading, error, isUsingFallback } = useUserProfile()

  const [formData, setFormData] = useState({ nickname: "", email: "" })
  const [avatar, setAvatar] = useState("")
  const [saving, setSaving] = useState(false)                     // ← showDeleteConfirm 제거

  React.useEffect(() => {
    if (user) {
      setFormData({ nickname: user.nickname, email: user.email })
      setAvatar(user.profile || "")
    }
  }, [user])

  const handleInputChange = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-muted-foreground">프로필 정보를 불러오는 중...</div>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">프로필 정보를 불러올 수 없습니다</div>
          <Button onClick={() => router.back()}>뒤로가기</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {isUsingFallback && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-2">
          <div className="container mx-auto text-center text-sm text-yellow-800">
            ⚠️ 연결되면 실제 데이터가 표시됩니다
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="font-semibold text-foreground">프로필 수정</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-2xl">
        {/* Profile Image */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>프로필 사진</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatar || "/placeholder.svg"} alt="프로필 사진" />
                <AvatarFallback>
                  <User className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Camera className="h-4 w-4 mr-2" />
                      사진 변경
                    </span>
                  </Button>
                </Label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <p className="text-sm text-muted-foreground mt-2">JPG, PNG 파일만 업로드 가능합니다.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>개인정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nickname">닉네임</Label>
              <Input
                id="nickname"
                value={formData.nickname}
                onChange={(e) => handleInputChange("nickname", e.target.value)}
                placeholder="닉네임을 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="이메일을 입력하세요"
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground mt-1">이메일은 변경할 수 없습니다</p>
            </div>
            <div>
              <Label>가입일</Label>
              <Input value={formatDate(user.created_at)} disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* Save Button only */}
        <Button onClick={handleSave} className="w-full" size="lg" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              저장 중...
            </>
          ) : (
            "변경사항 저장"
          )}
        </Button>
      </div>
    </div>
  )
}
