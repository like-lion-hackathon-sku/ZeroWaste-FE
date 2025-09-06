"use client"

import React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, User, Camera, Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useUserProfile } from "@/lib/hooks/use-api-with-fallback"
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"

export default function EditProfilePage() {
  const router = useRouter()
  const { data: user, loading, error, isUsingFallback } = useUserProfile()

  const [formData, setFormData] = useState({
    nickname: "",
    email: "",
  })
  const [avatar, setAvatar] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    if (user) {
      setFormData({
        nickname: user.nickname,
        email: user.email,
      })
      setAvatar(user.profile || "")
    }
  }, [user])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatar(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const response = await apiClient.updateProfile({
        nickname: formData.nickname,
        profile: avatar,
      })

      if (response.success) {
        console.log("[v0] Profile updated successfully")
        router.back()
      } else {
        console.error("[v0] Failed to update profile:", response.error)
        alert("프로필 업데이트에 실패했습니다")
      }
    } catch (error) {
      console.error("[v0] Profile update error:", error)
      alert("프로필 업데이트 중 오류가 발생했습니다")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = () => {
    if (showDeleteConfirm) {
      // TODO: Implement account deletion API call
      console.log("Deleting account")
      alert("계정 삭제 기능은 아직 구현되지 않았습니다")
      router.push("/")
    } else {
      setShowDeleteConfirm(true)
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
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
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

        {/* Action Buttons */}
        <div className="space-y-4">
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

          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">위험 구역</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
              </p>
              {showDeleteConfirm ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-600">정말로 계정을 삭제하시겠습니까?</p>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      네, 삭제합니다
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  계정 삭제
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
