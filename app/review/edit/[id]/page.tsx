"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Camera, Upload, Sparkles, CheckCircle, AlertCircle, Star, Save, Trash2 } from "lucide-react"

/* ---------------- Types ---------------- */
type RestaurantInfo = { id?: number; name: string; category?: string | null }
type Review = {
  id: number
  restaurant?: RestaurantInfo
  waste_rating: number // 0~5
  comment: string
  created_at?: string | null
}

type UploadedImage = {
  id: string
  file?: File
  preview: string
  ai?: {
    score: number // 0~5
    summary: string // 한줄 요약
    analyzed_at?: string
  }
}

/* ------ dataURL/URL → File 변환 유틸 ------ */
async function ensureFileFromImage(img: UploadedImage): Promise<File | null> {
  if (img.file) return img.file

  if (img.preview?.startsWith("data:")) {
    const [hdr, b64] = img.preview.split(",")
    const mime = hdr.match(/data:(.*?);/)?.[1] || "image/jpeg"
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new File([bytes], `image.${mime.split("/")[1] || "jpg"}`, { type: mime })
  }

  try {
    const r = await fetch(img.preview, { cache: "no-store" })
    const blob = await r.blob()
    const ext = blob.type?.split("/")[1] || "jpg"
    return new File([blob], `image.${ext}`, { type: blob.type || "image/jpeg" })
  } catch {
    return null
  }
}

export default function ReviewEditPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const reviewId = Number(params?.id)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const [review, setReview] = useState<Review | null>(null)
  const [comment, setComment] = useState("")
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [wasteScore5, setWasteScore5] = useState(0) // ⭐ 0~5
  const wasteScore100 = Math.round(wasteScore5 * 20)

  /* -------- 초기 데이터: GET /_be/reviews/me → id로 찾기 + /_be/restaurants/{id}/detail -------- */
  useEffect(() => {
    if (!Number.isFinite(reviewId)) return
    ;(async () => {
      try {
        setLoading(true)

        const res = await fetch("/_be/reviews/me", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        })
        const list = await res.json() // 배열

        if (!Array.isArray(list)) {
          console.warn("Unexpected /reviews/me response:", list)
          setReview(null)
          return
        }

        const item =
          list.find(
            (r: any) => Number(r?.id) === reviewId || Number(r?.reviewId) === reviewId,
          ) || null

        if (!item) {
          setReview(null)
          return
        }

        // 식당 상세 조회해서 이름/카테고리 보강
        const restaurantId = Number(item.restaurantId)
        let restaurant: RestaurantInfo | undefined = undefined
        if (Number.isFinite(restaurantId)) {
          try {
            const rDetail = await fetch(`/_be/restaurants/${restaurantId}/detail`, {
              credentials: "include",
              cache: "no-store",
            })
            const detailJson = await rDetail.json().catch(() => null)
            const d = detailJson?.success ?? detailJson // (SUCCESS 래퍼 or 바로 객체 둘 다 대비)
            if (d && (d.name || d.category)) {
              restaurant = { id: restaurantId, name: d.name ?? `식당 #${restaurantId}`, category: d.category ?? null }
            } else {
              restaurant = { id: restaurantId, name: `식당 #${restaurantId}` }
            }
          } catch {
            restaurant = { id: restaurantId, name: `식당 #${restaurantId}` }
          }
        }

        // 화면용 매핑
        const mapped: Review = {
          id: Number(item.id ?? item.reviewId),
          restaurant,
          waste_rating: Number(item.score ?? 0),
          comment: String(item.contents ?? ""),
          created_at: item.created_at ?? null,
        }

        setReview(mapped)
        setComment(mapped.comment ?? "")
        setWasteScore5(Number(mapped.waste_rating ?? 0))
      } catch (e) {
        console.error(e)
        setReview(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [reviewId])

  /* -------- 업로드 -------- */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        setUploadedImages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 10),
            file,
            preview: (ev.target?.result as string) || "",
          },
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  /* -------- 공통: 현재 업로드 목록에서 AI 점수 평균 계산 -------- */
  const recalcAverage = (imgs: UploadedImage[]) => {
    const scores = imgs
      .map((it) => it.ai?.score)
      .filter((s): s is number => typeof s === "number")
    const avg =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0
    setWasteScore5(avg || 0)
  }

  /* -------- 삭제(점수 재계산) -------- */
  const removeImage = (id: string) => {
    setUploadedImages((prev) => {
      const next = prev.filter((it) => it.id !== id)
      recalcAverage(next)
      return next
    })
  }

  /* -------- AI 분석: /api/reviews/:id/analyze -------- */
  const analyzeImage = async (imageId: string) => {
    try {
      setIsAnalyzing(true)

      const target = uploadedImages.find((img) => img.id === imageId)
      if (!target) throw new Error("이미지를 찾을 수 없어요.")

      const fileToSend = await ensureFileFromImage(target)
      if (!fileToSend) throw new Error("분석할 이미지 파일을 준비하지 못했어요.")

      const fd = new FormData()
      fd.append("file", fileToSend, fileToSend.name)

      const res = await fetch(`/api/reviews/${reviewId}/analyze`, {
        method: "POST",
        body: fd,
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`분석 API ${res.status}: ${t.slice(0, 200)}`)
      }
      const json = await res.json()
      if (!json?.success || !json?.data) throw new Error("분석 실패")

      const safeScore = Math.max(0, Math.min(5, Number(json.data.score ?? 0)))
      const summary = String(json.data.summary ?? "")
      const analyzed_at = String(json.data.analyzed_at ?? new Date().toISOString())

      setUploadedImages((prev) => {
        const next = prev.map((img) =>
          img.id === imageId ? { ...img, ai: { score: safeScore, summary, analyzed_at } } : img,
        )
        recalcAverage(next) // ★ 평균으로 즉시 갱신
        return next
      })
    } catch (e: any) {
      console.error(e)
      alert(e?.message || "AI 분석에 실패했어요. 다시 시도해주세요.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  /* -------- 저장: PUT /_be/reviews/{id}  { contents, score } -------- */
  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewId) return
    setSaving(true)
    try {
      const res = await fetch(`/_be/reviews/${reviewId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: comment?.trim() ?? "",
          // BE가 소수 허용(예: 1.7) → 한 자리로 보냄
          score: Number(wasteScore5.toFixed(1)),
        }),
      })

      // 본문이 없을 수도 있으니 안전 파싱
      let json: any = null
      try {
        json = await res.json()
      } catch {
        // ignore
      }

      if (!res.ok) {
        const msg = json?.error || `리뷰 수정 실패 (${res.status})`
        throw new Error(msg)
      }

      alert("리뷰가 수정되었습니다.")
      router.replace("/profile")
      router.refresh()
    } catch (err: any) {
      console.error(err)
      alert(err?.message || "리뷰 수정 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  /* -------- 삭제: DELETE /_be/reviews/{id} -------- */
  const onDelete = async () => {
    if (!reviewId || !confirm("이 리뷰를 삭제할까요?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/_be/reviews/${reviewId}`, {
        method: "DELETE",
        credentials: "include",
      })

      let json: any = null
      try {
        json = await res.json()
      } catch {
        // ignore
      }

      if (!res.ok) {
        const msg = json?.error || `리뷰 삭제 실패 (${res.status})`
        throw new Error(msg)
      }

      alert("리뷰가 삭제되었습니다.")
      router.replace("/profile")
      router.refresh()
    } catch (err: any) {
      console.error(err)
      alert(err?.message || "리뷰 삭제 중 오류가 발생했습니다.")
    } finally {
      setDeleting(false)
    }
  }

  /* -------- UI -------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full mx-auto"
          />
          <div className="text-gray-600 dark:text-gray-300">리뷰 정보를 불러오는 중…</div>
        </motion.div>
      </div>
    )
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <div className="text-red-500 text-lg font-medium">리뷰를 찾을 수 없습니다.</div>
          <Button variant="outline" onClick={() => router.back()} className="bg-white/80 backdrop-blur-sm">
            뒤로가기
          </Button>
        </motion.div>
      </div>
    )
  }

  // 저장 가능 조건: 코멘트 있고 별점 > 0
  const canSubmit = comment.trim().length > 0 && wasteScore5 > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-white/20 p-4 sticky top-0 z-10 shadow-lg"
      >
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="hover:bg-white/50 dark:hover:bg-gray-800/50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="font-bold text-xl bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
            리뷰 수정
          </h1>
          <div className="w-16" />
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          {/* 상단 식당 카드 */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">식당</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                      {review.restaurant?.name || "식당 정보 없음"}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full inline-block">
                      {review.restaurant?.category || "카테고리 없음"}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 bg-gradient-to-r from-green-100 to-sky-100 dark:from-green-900 dark:to-sky-900 text-green-700 dark:text-green-300"
                  >
                    <Star className="h-3 w-3 fill-current" />
                    {(review.waste_rating ?? 0).toFixed(1)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 업로드 & AI 분석 */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-xl">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                  사진 업로드 & AI 분석
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="border-2 border-dashed border-green-300 dark:border-green-700 rounded-2xl p-8 text-center bg-gradient-to-br from-green-50/50 to-sky-50/50 dark:from-green-900/20 dark:to-sky-900/20"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 border-green-200 dark:border-green-700"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    사진 선택
                  </Button>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">사진 업로드 후 AI 분석을 실행하세요</p>
                </motion.div>

                {uploadedImages.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-200">업로드된 사진</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {uploadedImages.map((image, index) => (
                        <motion.div
                          key={image.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Card className="overflow-hidden backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-lg rounded-2xl">
                            <div className="relative">
                              <img
                                src={image.preview || "/placeholder.svg"}
                                alt="업로드"
                                className="w-full h-48 object-cover"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2 rounded-full"
                                onClick={() => removeImage(image.id)}
                              >
                                삭제
                              </Button>
                            </div>

                            <CardContent className="p-4">
                              {!image.ai ? (
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
                                    <span className="text-sm font-medium">분석 완료</span>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span>AI 산출 별점</span>
                                      <span className="font-bold bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                                        {image.ai.score.toFixed(1)} / 5
                                      </span>
                                    </div>
                                    <Progress value={Math.round(image.ai.score * 20)} className="h-3" />
                                  </div>

                                  {image.ai.summary && (
                                    <div className="bg-gradient-to-r from-green-50 to-sky-50 dark:from-green-900/20 dark:to-sky-900/20 p-3 rounded-xl border border-green-200 dark:border-green-700">
                                      <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">
                                        AI 피드백
                                      </p>
                                      <p className="text-xs text-gray-600 dark:text-gray-300">{image.ai.summary}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* AI 종합 점수 */}
          {wasteScore5 > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-2 rounded-xl">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    AI 분석 결과
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-r from-green-50 to-sky-50 dark:from-green-900/20 dark:to-sky-900/20 p-6 rounded-2xl border border-green-200 dark:border-green-700">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">잔반 없음 별점</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-6 w-6 ${i < Math.round(wasteScore5) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                        <span className="text-lg font-bold bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                          {wasteScore5.toFixed(1)} / 5
                        </span>
                      </div>
                    </div>
                    <Progress value={wasteScore100} className="h-3" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 코멘트 & 액션 */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <form onSubmit={onSave}>
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-xl">코멘트</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="comment" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      리뷰 내용
                    </Label>
                    <Textarea
                      id="comment"
                      rows={4}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="식사 경험을 적어주세요…"
                      className="bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:border-green-500 focus:ring-green-500/20 rounded-xl"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{comment.length}자</p>
                  </div>

                  <div className="flex justify-between gap-3 pt-4">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={onDelete}
                      disabled={deleting}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting ? "삭제 중…" : "삭제"}
                    </Button>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm"
                      >
                        취소
                      </Button>
                      <Button
                        type="submit"
                        disabled={!canSubmit || saving}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "저장 중…" : "저장"}
                      </Button>
                    </div>
                  </div>

                  {!canSubmit && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span>코멘트와 별점을 입력하면 저장할 수 있어요.</span>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
