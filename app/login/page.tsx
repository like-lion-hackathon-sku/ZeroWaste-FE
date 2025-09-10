"use client"

import type React from "react"
import { useState, useTransition } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Leaf, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { apiClient } from "@/lib/api/client"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [needProfile, setNeedProfile] = useState(false)
  const [nickname, setNickname] = useState("")
  const [saving, setSaving] = useState(false)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await apiClient.login(email, password)
      if (!res.success) {
        setError(res.error || "로그인에 실패했어요.")
        return
      }

      const user = (res as any).data
      const uid = user?.id
      if (uid) localStorage.setItem("userId", String(uid))

      if (user?.isCompleted === false) {
        setNeedProfile(true)
      } else {
        window.location.href = "/map"
      }
    })
  }

  const handleGoogleLogin = () => {
    alert("Google 로그인은 준비 중입니다.")
  }

  const handleGuestMode = () => {
    window.location.href = "/map"
  }

  const submitNickname = async () => {
    if (!nickname.trim()) {
      alert("닉네임을 입력해주세요.")
      return
    }
    setSaving(true)
    const res = await apiClient.updateProfile({
      nickname,
      defaultImage: true,
      profileImage: null,
    })
    setSaving(false)

    if (!res.success) {
      alert(res.error || "프로필 저장에 실패했어요.")
      return
    }
    window.location.href = "/map"
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
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              onSubmit={handleLogin}
              className="space-y-4"
            >
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                disabled={isPending}
              >
                {isPending ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
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

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="space-y-3"
            >
              <Button
                variant="outline"
                className="w-full h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-all"
                onClick={handleGoogleLogin}
              >
                Google로 로그인
              </Button>

              <Button
                variant="ghost"
                className="w-full h-12 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                onClick={handleGuestMode}
              >
                게스트 모드로 둘러보기
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center text-sm"
            >
              <span className="text-gray-500">계정이 없으신가요? </span>
              <Link
                href="/auth/signup"
                className="text-green-600 hover:text-green-700 font-medium hover:underline transition-colors"
              >
                회원가입
              </Link>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {needProfile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 border border-white/20"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">닉네임 설정</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              처음 오셨네요! 다른 사용자에게 보일 닉네임을 설정해주세요.
            </p>
            <Input
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setNeedProfile(false)}>
                나중에
              </Button>
              <Button
                onClick={submitNickname}
                disabled={saving}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
