"use client"

import type React from "react"
import { useState, useTransition } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Leaf, Mail, Lock, Eye, EyeOff, User } from "lucide-react"
import { apiClient } from "@/lib/api/client"

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
    agreeToMarketing: false,
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.")
      return
    }
    if (!formData.agreeToTerms) {
      setError("이용약관에 동의해주세요.")
      return
    }

    startTransition(async () => {
      const res = await apiClient.signup(formData.email, formData.password)
      if (!res.success) {
        setError(res.error || "회원가입에 실패했어요.")
        return
      }
      window.location.href = "/login"
    })
  }

  const handleGoogleSignup = () => {
    alert("Google 회원가입은 준비 중입니다.")
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
                회원가입
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
                친환경 식당 리뷰 앱에서 지속가능한 식문화를 시작하세요
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-6">
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              onSubmit={handleSignup}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  이름
                </Label>
                <div className="relative group">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-green-500 transition-colors" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="이름(선택)"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="pl-10 h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-green-500/20 transition-all"
                  />
                </div>
              </div>

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
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
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
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  비밀번호 확인
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-green-500 transition-colors" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="비밀번호를 다시 입력하세요"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className="pl-10 pr-10 h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-green-500/20 transition-all"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id="terms"
                    checked={formData.agreeToTerms}
                    onCheckedChange={(checked) => handleInputChange("agreeToTerms", checked as boolean)}
                    className="border-gray-300 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                  />
                  <Label htmlFor="terms" className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-red-500">*</span> 이용약관 및 개인정보처리방침에 동의합니다
                  </Label>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id="marketing"
                    checked={formData.agreeToMarketing}
                    onCheckedChange={(checked) => handleInputChange("agreeToMarketing", checked as boolean)}
                    className="border-gray-300 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                  />
                  <Label htmlFor="marketing" className="text-sm text-gray-700 dark:text-gray-300">
                    마케팅 정보 수신에 동의합니다 (선택)
                  </Label>
                </motion.div>
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
                  "회원가입"
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

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
              <Button
                variant="outline"
                className="w-full h-12 bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-all"
                onClick={handleGoogleSignup}
              >
                Google로 회원가입
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-center text-sm"
            >
              <span className="text-gray-500">이미 계정이 있으신가요? </span>
              <Link
                href="/login"
                className="text-green-600 hover:text-green-700 font-medium hover:underline transition-colors"
              >
                로그인
              </Link>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
