"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  Camera,
  Upload,
  Leaf,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Star,
} from "lucide-react"
import { apiClient } from "@/lib/api/client"

/* ---------- 타입 ---------- */
type RestaurantInfo = { id: number; name: string; category?: string | null }

interface UploadedImage {
  id: string
  file: File
  preview: string
  type: "before" | "after"
  aiAnalysis?: {
    score: number // 0~5 (별점)
    summary: string // 한줄 요약
  }
}

export default function WriteReviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const restaurantIdParam = searchParams.get("restaurantId")
  const restaurantId = restaurantIdParam ? Number(restaurantIdParam) : NaN

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState<boolean>(true)

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [reviewData, setReviewData] = useState({ comment: "", score: 0 }) // 평균 별점(0~5)

  // 제출 중/오류 상태
  const [submitting, setSubmitting] = useState(false)
  const [conflict409, setConflict409] = useState<string | null>(null) // 409 배너 메시지
  const [submitError, setSubmitError] = useState<string | null>(null) // 기타 오류

  /* ---------- 식당 상세 불러오기 ---------- */
  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        if (!Number.isFinite(restaurantId)) return
        setLoadingRestaurant(true)
        const resp = await apiClient.getRestaurantDetail(restaurantId)
        if (!ignore) {
          if (resp.success) {
            const d: any = resp.data
            setRestaurant({
              id: restaurantId,
              name: d?.name ?? "이름 없음",
              category: d?.category ?? null,
            })
          } else {
            console.warn("식당 상세 실패:", resp.error)
            setRestaurant({ id: restaurantId, name: "알 수 없는 식당" })
          }
        }
      } catch (e) {
        console.error(e)
        if (!ignore) setRestaurant({ id: restaurantId, name: "알 수 없는 식당" })
      } finally {
        if (!ignore) setLoadingRestaurant(false)
      }
    })()
    return () => {
      ignore = true
    }
  }, [restaurantId])

  /* ---------- 업로드 ---------- */
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const newImage: UploadedImage = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
          file,
          preview: (e.target?.result as string) || "",
          type: uploadedImages.length % 2 === 0 ? "before" : "after",
        }
        setUploadedImages((prev) => [...prev, newImage])
      }
      reader.readAsDataURL(file)
    })
  }

  /* ---------- AI 분석 호출 (실 API: /api/reviews/0/analyze) ---------- */
  const analyzeImage = async (imageId: string) => {
    const target = uploadedImages.find((img) => img.id === imageId)
    if (!target?.file) return alert("이미지 파일을 찾을 수 없어요.")

    try {
      setIsAnalyzing(true)

      const fd = new FormData()
      fd.append("file", target.file, target.file.name)

      const res = await fetch(`/api/reviews/0/analyze`, { method: "POST", body: fd })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`API ${res.status}: ${text.slice(0, 200)}`)
      }
      const json = await res.json()

      const score = Math.max(0, Math.min(5, Number(json.data?.score ?? 0)))
      const summary = String(json.data?.summary ?? "")

      const next = uploadedImages.map((img) =>
        img.id === imageId ? { ...img, aiAnalysis: { score, summary } } : img
      )
      setUploadedImages(next)

      const analyzed = next.filter((x) => x.aiAnalysis?.score != null)
      const avg =
        analyzed.length > 0
          ? analyzed.reduce((acc, cur) => acc + (cur.aiAnalysis?.score ?? 0), 0) / analyzed.length
          : 0
      setReviewData((prev) => ({ ...prev, score: Math.round(avg * 10) / 10 }))
    } catch (e: any) {
      console.error(e)
      alert(e.message || "AI 분석 실패")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const removeImage = (imageId: string) => {
    const next = uploadedImages.filter((img) => img.id !== imageId)
    setUploadedImages(next)

    const analyzed = next.filter((x) => x.aiAnalysis?.score != null)
    const avg =
      analyzed.length > 0
        ? analyzed.reduce((acc, cur) => acc + (cur.aiAnalysis?.score ?? 0), 0) / analyzed.length
        : 0
    setReviewData((prev) => ({ ...prev, score: Math.round(avg * 10) / 10 }))
  }

  /* ---------- 제출 (실 BE 연동) ---------- */
  const handleSubmitReview = async () => {
    if (!Number.isFinite(restaurantId)) return alert("잘못된 식당 ID 입니다.")
    if (submitting) return
    setConflict409(null)
    setSubmitError(null)

    try {
      setSubmitting(true)

      // ⭐ 스웨거 명세 준수: POST /reviews/restaurants/{id}/reviews  { contents, score }
      const resp = await apiClient.createReviewForRestaurant(restaurantId, {
        contents: reviewData.comment.trim(),
        score: Number(reviewData.score),
      })

      if (!resp.success) {
        const err = String(resp.error || "")

        // 401: 로그인 필요
        if (err.includes("401")) {
          alert("로그인이 필요해요. 로그인 페이지로 이동합니다.")
          router.push("/login")
          return
        }

        // 409: 이미 작성한 리뷰가 존재
        if (err.includes("409") || err.includes("이미 작성한 리뷰가 존재")) {
          setConflict409("이미 작성한 리뷰가 존재합니다. 기존 리뷰를 수정하거나 삭제 후 다시 시도해주세요.")
          // 배너가 보이도록 상단으로 스크롤
          try {
            window.scrollTo({ top: 0, behavior: "smooth" })
          } catch {}
          return
        }

        // 기타 오류
        throw new Error(err || "리뷰 생성에 실패했어요.")
      }

      // 성공 시 이동
      router.push(`/review/success?restaurantId=${restaurantId}`)
    } catch (e: any) {
      console.error(e)
      setSubmitError(e?.message || "리뷰 제출 중 오류가 발생했어요.")
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    uploadedImages.length >= 1 &&
    reviewData.comment.trim().length > 0 &&
    reviewData.score > 0 &&
    !submitting

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* ── 상단 에러 배너 (409 전용) ───────────────────────── */}
      {conflict409 && (
        <div className="sticky top-0 z-20">
          <div className="mx-auto max-w-3xl p-3">
            <div className="flex items-start gap-3 rounded-xl border border-yellow-300/60 bg-yellow-50/70 dark:bg-yellow-900/30 px-4 py-3 backdrop-blur">
              <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-300 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-100">
                <p className="font-semibold">이미 작성한 리뷰가 존재함</p>
                <p className="mt-0.5">{conflict409}</p>
                {/* 필요 시 기존 리뷰로 이동 경로가 있다면 여기에 버튼 추가 */}
              </div>
            </div>
          </div>
        </div>
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
          <div className="text-center">
            <h1 className="font-bold text-xl bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
              리뷰 작성
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {loadingRestaurant ? "불러오는 중..." : restaurant?.name ?? "알 수 없는 식당"}
            </p>
          </div>
          <div className="w-20" />
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-2xl">
        <div className="space-y-6">
          {/* 업로드 카드 */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-green-500" />
                  <span className="bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                    식사 사진 업로드
                  </span>
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  사진을 업로드하면 AI가 <b>잔반 별점</b>과 <b>요약</b>을 생성합니다.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="border-2 border-dashed border-green-300/50 bg-green-50/50 dark:bg-green-900/20 rounded-2xl p-8 text-center transition-all duration-300"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/50 hover:bg-white/80 border-white/30"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    사진 선택
                  </Button>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">식사 사진을 업로드해주세요</p>
                </motion.div>

                {uploadedImages.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">업로드된 사진</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {uploadedImages.map((image, index) => (
                        <motion.div
                          key={image.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 * index }}
                        >
                          <Card className="overflow-hidden backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border-white/20">
                            <div className="relative">
                              <img
                                src={image.preview || "/placeholder.svg"}
                                alt="업로드된 사진"
                                className="w-full h-48 object-cover"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600"
                                onClick={() => removeImage(image.id)}
                              >
                                삭제
                              </Button>
                            </div>

                            <CardContent className="p-4">
                              {!image.aiAnalysis ? (
                                <Button
                                  onClick={() => analyzeImage(image.id)}
                                  disabled={isAnalyzing}
                                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                                >
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  {isAnalyzing ? "AI 분석 중..." : "AI 분석 시작"}
                                </Button>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">분석 완료</span>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">잔반 별점</span>
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                          <Star
                                            key={i}
                                            className={`h-5 w-5 ${
                                              i < Math.round(image.aiAnalysis!.score)
                                                ? "text-yellow-400 fill-yellow-400"
                                                : "text-gray-300"
                                            }`}
                                          />
                                        ))}
                                      </div>
                                      <span className="text-sm text-gray-600 dark:text-gray-300">
                                        {image.aiAnalysis.score.toFixed(1)}/5
                                      </span>
                                    </div>
                                  </div>

                                  <div className="bg-green-500/10 backdrop-blur-sm p-3 rounded-xl border border-green-200/30">
                                    <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-1">
                                      AI 피드백
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-300">
                                      {image.aiAnalysis.summary}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* 종합 결과 */}
          {reviewData.score > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-green-500" />
                    <span className="bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                      AI 분석 결과(종합)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm p-4 rounded-2xl border border-green-200/30">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">잔반 별점(평균)</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-6 w-6 ${
                                i < Math.round(reviewData.score) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {Math.round(reviewData.score * 10) / 10}/5
                        </span>
                      </div>
                    </div>
                    <Progress value={(reviewData.score / 5) * 100} className="h-3 bg-white/50" />
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                      이미지별 별점의 <b>평균값</b>으로 계산됩니다.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 리뷰 입력 */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl">
              <CardHeader>
                <CardTitle className="bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                  리뷰 작성
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300">식사 경험을 자세히 알려주세요</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 제출 오류(기타) 경고 */}
                {submitError && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-300/60 bg-red-50/70 dark:bg-red-900/30 px-3 py-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-300" />
                    <p className="text-sm text-red-800 dark:text-red-100">{submitError}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="comment" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    리뷰 내용
                  </Label>
                  <Textarea
                    id="comment"
                    placeholder="식당에 대한 솔직한 후기를 작성해주세요..."
                    value={reviewData.comment}
                    onChange={(e) => setReviewData((prev) => ({ ...prev, comment: e.target.value }))}
                    rows={4}
                    maxLength={500}
                    className="bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-green-500/20"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{reviewData.comment.length}/500자</p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleSubmitReview}
                    disabled={!canSubmit}
                    className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                    size="lg"
                  >
                    {submitting ? "제출 중..." : "리뷰 제출"}
                  </Button>
                </div>

                {!canSubmit && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-yellow-50/50 dark:bg-yellow-900/20 p-3 rounded-xl"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>사진 업로드, AI 분석, 리뷰 내용 작성을 완료해주세요</span>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
