"use client"
import { useRouter } from "next/navigation"
import type React from "react"
import { useRef, useState, useTransition, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Leaf, Mail, Lock, Eye, EyeOff, Image as ImageIcon, Trash2, CheckCircle2 } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import { useUserStore } from "@/lib/state/user"
import type { User } from "@/lib/state/user"

export default function LoginPage() {
  // 로그인 폼
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // 최초 프로필 설정 모달
  const [needProfile, setNeedProfile] = useState(false)
  const [nickname, setNickname] = useState("")
  const [saving, setSaving] = useState(false)

  // 이미지 업로드 상태
  const [useDefaultImage, setUseDefaultImage] = useState<boolean>(true)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 전역 유저 저장
  const setUser = useUserStore((s) => s.setUser)

  const resetProfileModal = () => {
    setNickname("")
    setUseDefaultImage(true)
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setSaving(false)
  }

  /** 서버 응답 객체를 전역 User 타입으로 매핑 */
  const mapToUser = (u: any): User => ({
    id: Number(u?.id ?? 0),
    email: String(u?.email ?? ""),
    nickname: u?.nickname ?? null,
    profile: u?.profile ?? null,
    is_completed: Boolean(u?.is_completed ?? u?.isCompleted ?? false),
    role: u?.role === "BIZ" ? "BIZ" : "USER",
  })

  /* -------------------- 로그인 -------------------- */
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await apiClient.login(email, password)
      if (!res?.success) {
        setError(res?.error || "로그인에 실패했어요.")
        return
      }

      const rawUser = (res as any).data
      setUser(mapToUser(rawUser))

      if (rawUser?.id) {
        try { localStorage.setItem("userId", String(rawUser.id)) } catch {}
      }

      const incomplete = rawUser?.is_completed === false || rawUser?.isCompleted === false
      if (incomplete) {
        setNeedProfile(true)
      } else {
        router.push("/map")           // ✅ 여기
      }
    })
  }

  /* -------------------- 프로필 최초 설정 (multipart/form-data) -------------------- */
  const onChangeFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있어요.")
      e.target.value = ""
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      alert("파일 용량은 5MB 이하여야 해요.")
      e.target.value = ""
      return
    }
    setFile(f)
    setUseDefaultImage(false)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  // 미리보기 URL 정리
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const removeFile = () => {
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const submitProfile = async () => {
    if (!nickname.trim()) {
      alert("닉네임을 입력해주세요.")
      return
    }
    if (!useDefaultImage && !file) {
      alert("프로필 이미지를 선택하거나 '기본 이미지 사용'을 선택하세요.")
      return
    }

    setSaving(true)
    try {
      const form = new FormData()
      form.append("nickname", nickname.trim())
      form.append("defaultImage", useDefaultImage ? "true" : "false")
      if (!useDefaultImage && file) form.append("profileImage", file)

      // apiClient에 updateProfileMultipart가 없으면 updateProfile로 폴백
      const api: any = apiClient as any
      const res =
        typeof api.updateProfileMultipart === "function"
          ? await api.updateProfileMultipart(form)
          : await api.updateProfile({ nickname, defaultImage: useDefaultImage, profileImage: file ?? null })

      if (!res?.success) throw new Error(res?.error || "프로필 저장에 실패했어요.")

      // 최신 사용자 정보로 전역 동기화
      const me = await apiClient.getProfile().catch(() => null)
      if (me?.success && me.data) {
        setUser(mapToUser(me.data))
        try {
          const id = (me.data as any)?.id // ← 로컬 변수로 꺼내 타입 단언
          if (id != null) localStorage.setItem("userId", String(id))
        } catch {}
      }

      router.push("/map")
    } catch (err: any) {
      alert(err?.message || "프로필 저장 중 오류가 발생했어요.")
    } finally {
      setSaving(false)
    }
  }

  /* -------------------- 기타 -------------------- */
  const handleGoogleLogin = () => {
    alert("Google 로그인은 준비 중입니다.")
  }
  const handleGuestMode = () => {
    router.push("/map")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl rounded-2xl">
          <CardHeader className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="bg-gradient-to-br from-green-500 to-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
            >
              <Leaf className="h-8 w-8 text-white" />
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                로그인
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
                친환경 식당 리뷰 앱에 오신 것을 환영합니다
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-6">
            <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  이메일
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-green-500 transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="이메일을 입력하세요"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-green-500/20 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  비밀번호
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-green-500 transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호를 입력하세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-green-500/20 transition-all"
                    required
                  />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                  </Button>
                </div>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  {error}
                </motion.p>
              )}

              <Button type="submit" className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300" disabled={isPending}>
                {isPending ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  "로그인"
                )}
              </Button>
            </motion.form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">또는</span>
              </div>
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="space-y-3">
              <Button variant="outline" className="w-full h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-all" onClick={handleGoogleLogin}>
                Google로 로그인
              </Button>

              <Button variant="ghost" className="w-full h-12 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all" onClick={handleGuestMode}>
                게스트 모드로 둘러보기
              </Button>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-center text-sm">
              <span className="text-gray-500">계정이 없으신가요? </span>
              <Link href="/auth/signup" className="text-green-600 hover:text-green-700 font-medium hover:underline transition-colors">
                회원가입
              </Link>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 최초 프로필 설정 모달 */}
      {needProfile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 border border-white/20">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">프로필 설정</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">처음 오셨네요! 닉네임과 프로필 이미지를 선택해주세요.</p>

            {/* 닉네임 */}
            <div className="space-y-2">
              <Label className="text-sm">닉네임</Label>
              <Input placeholder="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-11 bg-white/60 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700" />
            </div>

            {/* 이미지 선택 방식 */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUseDefaultImage(true)}
                className={`flex-1 h-10 rounded-xl border ${useDefaultImage ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20" : "border-gray-300 dark:border-gray-700"} flex items-center justify-center gap-2`}
              >
                <CheckCircle2 className={`h-4 w-4 ${useDefaultImage ? "text-emerald-600" : "text-gray-400"}`} />
                기본 이미지 사용
              </button>
              <button
                type="button"
                onClick={() => setUseDefaultImage(false)}
                className={`flex-1 h-10 rounded-xl border ${!useDefaultImage ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20" : "border-gray-300 dark:border-gray-700"} flex items-center justify-center gap-2`}
              >
                <ImageIcon className={`h-4 w-4 ${!useDefaultImage ? "text-emerald-600" : "text-gray-400"}`} />
                직접 업로드
              </button>
            </div>

            {/* 파일 업로드 박스 */}
            {!useDefaultImage && (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4">
                {!preview ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
                    <ImageIcon className="h-8 w-8" />
                    <p>이미지 파일을 선택하세요 (최대 5MB)</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-9">
                        파일 선택
                      </Button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onChangeFile} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <img src={preview} alt="미리보기" className="w-16 h-16 rounded-full object-cover border border-white/50 shadow" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 dark:text-gray-200">{file?.name}</p>
                      <p className="text-xs text-gray-400">{Math.round((file?.size || 0) / 1024)} KB</p>
                    </div>
                    <Button type="button" variant="ghost" onClick={removeFile} className="text-red-500 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* 액션 */}
            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setNeedProfile(false)
                  resetProfileModal()
                }}
              >
                나중에
              </Button>
              <Button onClick={submitProfile} disabled={saving} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}