"use client"

import React, { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, User, Camera, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { useUserStore } from "@/lib/state/user"
import { apiClient } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/database-helpers"

type SafeProfile = {
  id?: number | string | null
  userId?: number | string | null
  nickname?: string | null
  email?: string | null
  profile?: string | null
  profileImage?: string | null
  created_at?: string | null
}

export default function EditProfilePage() {
  const router = useRouter()

  // ✅ 스토어 우선 사용
  const me = useUserStore((s) => s.user) as SafeProfile | undefined
  const setUser = useUserStore((s) => s.setUser)

  // 로컬 로딩/에러 상태 (fallback 훅 제거)
  const [loading, setLoading] = useState(!me)
  const [error, setError] = useState<string | null>(null)

  // 스토어가 비어 있으면 한 번만 BE에서 직접 받아와 스토어 채움
  useEffect(() => {
    if (me) {
      setLoading(false)
      return
    }
    let ignore = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await apiClient.getProfile()
        if (!res?.success) throw new Error(res?.error || "프로필을 불러오지 못했습니다")
        if (!ignore) {
          setUser(res.data as any)
          setLoading(false)
        }
      } catch (e: any) {
        if (!ignore) {
          setError(e?.message || "프로필 로드 오류")
          setLoading(false)
        }
      }
    })()
    return () => { ignore = true }
  }, [me, setUser])

  // 화면에 쓸 원천 사용자
  const sourceUser = (me ?? null) as SafeProfile | null
  const p = useMemo(() => (sourceUser ?? {}) as SafeProfile, [sourceUser])

  // 폼 상태
  const [formData, setFormData] = useState<{ nickname: string; email: string }>({ nickname: "", email: "" })
  const [preview, setPreview] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [useDefault, setUseDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  // 초기 세팅: sourceUser 변할 때만 한 번 반영
  useEffect(() => {
    if (!sourceUser) return

    setFormData({
      nickname: sourceUser.nickname ?? "",
      email: sourceUser.email ?? "",
    })

    const raw = (sourceUser.profile ?? sourceUser.profileImage) || ""
    if (!raw) {
      setPreview("")
      setFile(null)
      setUseDefault(false)
      return
    }

    if (/^https?:\/\//i.test(raw)) {
      setPreview(raw)
      setFile(null)
      setUseDefault(false)
      return
    }

    ;(async () => {
      try {
        const signed = await apiClient.getImageSignedUrl(0, raw)
        const fallback = apiClient.getImageUrlByType(0, raw)
        setPreview(signed || fallback || "")
      } catch {
        setPreview(apiClient.getImageUrlByType(0, raw) || "")
      } finally {
        setFile(null)
        setUseDefault(false)
      }
    })()
  }, [sourceUser])

  const handleInputChange = (k: "nickname" | "email", v: string) =>
    setFormData((prev) => ({ ...prev, [k]: v }))

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!/^image\/(png|jpeg|jpg)$/i.test(f.type)) {
      alert("PNG 또는 JPG 이미지를 선택해주세요.")
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      alert("이미지 용량은 5MB 이하여야 합니다.")
      return
    }
    setFile(f)
    setUseDefault(false)

    const reader = new FileReader()
    reader.onload = (ev) => setPreview((ev.target?.result as string) || "")
    reader.readAsDataURL(f)
  }

  const handleResetImage = () => {
    setFile(null)
    setPreview("")
    setUseDefault(true) // 기본 이미지로 변경
  }

  const handleSave = async () => {
    if (!sourceUser) return
    setSaving(true)
    try {
      let res: any
      if (file || useDefault) {
        const fd = new FormData()
        fd.append("nickname", formData.nickname ?? "")
        if (file) fd.append("profileImage", file)
        if (useDefault) fd.append("defaultImage", "true")
        res = await apiClient.updateProfile(fd)
      } else {
        res = await apiClient.updateProfile({
          nickname: formData.nickname,
          defaultImage: false,
        })
      }

      if (!res?.success) {
        throw new Error(typeof res?.error === "string" ? res.error : "프로필 업데이트 실패")
      }

      // 서버 응답을 스토어에 병합
      const updated = (res.data?.user ?? res.data ?? {}) as SafeProfile
      const merged: SafeProfile = {
        ...(sourceUser || {}),
        ...updated,
        nickname: updated.nickname ?? formData.nickname ?? sourceUser?.nickname ?? null,
        profile:
          updated.profile ??
          updated.profileImage ??
          (useDefault ? null : (sourceUser?.profile ?? sourceUser?.profileImage ?? null)),
      }
      setUser(merged as any)

      router.back()
    } catch (e: any) {
      alert(e?.message || "프로필 업데이트 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const createdAtText = useMemo(() => formatDate(p.created_at ?? ""), [p.created_at])

  // 로딩/에러 처리
  if (loading && !sourceUser) {
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

  if ((error || !sourceUser) && !loading) {
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
      {/* ✅ fallback 배너 제거: 이제 isUsingFallback 안 씀 */}

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
        <h1 className="font-bold text-xl bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">프로필 수정</h1>
          <div className="w-8" />
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-2xl">
        {/* 프로필 사진 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="mb-6 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">프로필 사진</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }}>
                  <Avatar className="h-24 w-24 ring-4 ring-green-500/20">
                    <AvatarImage src={preview || "/placeholder.svg"} alt="프로필 사진" />
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                      <User className="h-12 w-12" />
                    </AvatarFallback>
                  </Avatar>
                </motion.div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="avatar-upload" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild className="bg-white/50 hover:bg-white/80 border-white/30">
                      <span>
                        <Camera className="h-4 w-4 mr-2" />
                        사진 변경
                      </span>
                    </Button>
                  </Label>
                  <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetImage}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    기본 이미지로 변경
                  </Button>

                  <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG · 최대 5MB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 개인정보 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="mb-6 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">개인정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nickname" className="text-sm font-medium text-gray-700 dark:text-gray-300">닉네임</Label>
                <Input
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) => handleInputChange("nickname", e.target.value)}
                  placeholder="닉네임을 입력하세요"
                  className="mt-1 h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-green-500/20"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  disabled
                  className="mt-1 h-12 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">이메일은 변경할 수 없습니다</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">가입일</Label>
                <Input
                  value={createdAtText}
                  disabled
                  className="mt-1 h-12 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 저장 버튼 */}
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