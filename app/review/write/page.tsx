// app/review/write/page.tsx
// 리뷰 작성 - 기존 UI 유지 + "메뉴 선택 후" AI 분석 로딩 모달 추가, 별색: 초록

"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Camera,
  Upload,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Star,
  UtensilsCrossed,
  Shuffle,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import AnalyzingModal from "@/components/ai/AnalyzingModal";

/* ---------------- Types ---------------- */
type RestaurantInfo = { id: number; name: string; category?: string | null };

type ShotType = "before" | "after";

type MenuItem = {
  id: number;
  name: string;
  price?: number | null;
  // 필요 시: calories?: number | null;
};

type UploadedImage = {
  id: string;
  fileName: string; // 서버 파일명
  url: string;      // 프록시 표시 URL(/_be/images/..)
  preview: string;  // = url
  shotType: ShotType; // 식사 전/후
  ai?: {
    score: number;  // 0~5
    summary: string;
    analyzed_at?: string;
  };
};

export default function ReviewWritePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurantIdParam = searchParams.get("restaurantId");
  const restaurantId = restaurantIdParam ? Number(restaurantIdParam) : NaN;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loadingRestaurant, setLoadingRestaurant] = useState(true);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);

  const [menusLoading, setMenusLoading] = useState(false);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [menuQuery, setMenuQuery] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAILoadingModal, setShowAILoadingModal] = useState(false);

  const [comment, setComment] = useState("");
  const [avgScore5, setAvgScore5] = useState(0); // 0~5
  const avgScore100 = Math.round(avgScore5 * 20);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflict409, setConflict409] = useState<string | null>(null);

  /* -------- 식당 상세 -------- */
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!Number.isFinite(restaurantId)) {
          setRestaurant(null);
          return;
        }
        setLoadingRestaurant(true);
        const resp = await apiClient.getRestaurantDetail(restaurantId);
        if (ignore) return;

        if (resp.success) {
          const d: any = resp.data ?? {};
          setRestaurant({
            id: restaurantId,
            name: d.name ?? `식당 #${restaurantId}`,
            category: d.category ?? null,
          });
        } else {
          setRestaurant({ id: restaurantId, name: `식당 #${restaurantId}` });
        }
      } catch {
        if (!ignore)
          setRestaurant(
            Number.isFinite(restaurantId)
              ? { id: restaurantId, name: `식당 #${restaurantId}` }
              : null
          );
      } finally {
        if (!ignore) setLoadingRestaurant(false);
      }
    })();
    return () => { ignore = true; };
  }, [restaurantId]);

  /* -------- 메뉴 목록 --------
     BE에 getRestaurantMenus(restaurantId)가 있다고 가정.
     없다면 apiClient에 간단히 추가하거나, /restaurants/{id}/menus 호출로 대체하세요. */
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!Number.isFinite(restaurantId)) return;
      try {
        setMenusLoading(true);
        const resp = await (apiClient as any).getRestaurantMenus?.(restaurantId);
        // fallback이 필요하면 아래와 같이 교체 가능:
        // const resp = await apiClient.get(`/restaurants/${restaurantId}/menus`);
        if (ignore) return;
        if (resp?.success && Array.isArray(resp.data)) {
          setMenus(resp.data as MenuItem[]);
        } else {
          setMenus([]); // 메뉴 없음
        }
      } catch {
        if (!ignore) setMenus([]);
      } finally {
        if (!ignore) setMenusLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [restaurantId]);

  const filteredMenus = useMemo(() => {
    const q = menuQuery.trim();
    if (!q) return menus;
    return menus.filter((m) => (m.name || "").toLowerCase().includes(q.toLowerCase()));
  }, [menus, menuQuery]);

  /* -------- 업로드 (POST /images/review/upload) -------- */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        if (!file.type.startsWith("image/")) continue;

        const up = await apiClient.uploadImage("review", file);
        if (!up.success) throw new Error(up.error || "이미지 업로드 실패");

        const { fileName } = up.data!;
        const previewUrl = apiClient.getImageUrl("review", fileName);

        setUploadedImages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 10),
            fileName,
            url: previewUrl,
            preview: previewUrl,
            shotType: "before", // 기본값: 식사 전
          },
        ]);
      } catch (err: any) {
        console.error(err);
        alert(err?.message || "이미지 업로드 중 오류가 발생했어요.");
      }
    }

    // 같은 파일 다시 선택 가능하도록 리셋
    try { e.target.value = ""; } catch {}
  };

  /* -------- 평균 재계산 -------- */
  const recalcAverage = (imgs: UploadedImage[]) => {
    const scores = imgs
      .map((it) => it.ai?.score)
      .filter((s): s is number => typeof s === "number");
    const avg =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0;
    setAvgScore5(avg || 0);
  };

  const removeImage = (id: string) => {
    setUploadedImages((prev) => {
      const next = prev.filter((it) => it.id !== id);
      recalcAverage(next);
      return next;
    });
  };

  const toggleShotType = (id: string) => {
    setUploadedImages(prev =>
      prev.map(it =>
        it.id === id
          ? { ...it, shotType: it.shotType === "before" ? "after" : "before" }
          : it
      )
    );
  };

  /* -------- AI 분석 (POST /images/review/{fileName}/analyze) -------- */
  const analyzeImage = async (imageId: string) => {
    const target = uploadedImages.find((img) => img.id === imageId);
    if (!target) return alert("이미지를 찾을 수 없어요.");
    if (!selectedMenuId) {
      alert("먼저 메뉴를 선택해주세요.");
      return;
    }

    try {
      setShowAILoadingModal(true);  // 모달 열기
      setIsAnalyzing(true);

      // 기본: 기존 시그니처 그대로
      const res = await (apiClient as any).analyzeImage("review", target.fileName);
      // 만약 BE가 메뉴/전후 정보를 받도록 되어있다면, 아래처럼 바꿔주세요:
      // const res = await (apiClient as any).analyzeImage("review", target.fileName, {
      //   menuId: selectedMenuId,
      //   shotType: target.shotType,
      // });

      if (!res.success) throw new Error(res.error || "AI 분석 실패");

      const payload: any = res.data;
      const scoreNum = Number(payload?.score ?? payload?.data?.score ?? 0);
      const summaryStr = String(payload?.summary ?? payload?.data?.summary ?? "");

      const safeScore = Math.max(0, Math.min(5, Number.isFinite(scoreNum) ? scoreNum : 0));
      const summary = summaryStr;

      setUploadedImages((prev) => {
        const next = prev.map((img) =>
          img.id === imageId
            ? { ...img, ai: { score: safeScore, summary, analyzed_at: new Date().toISOString() } }
            : img
        );
        recalcAverage(next);
        return next;
      });
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "AI 분석에 실패했어요. 다시 시도해주세요.");
    } finally {
      setTimeout(() => {          // 애니메이션 여운 후 닫기
        setShowAILoadingModal(false);
        setIsAnalyzing(false);
      }, 1200);
    }
  };

  /* -------- “전/후” 비교 계산 (선택된 메뉴 기준) -------- */
  const compareForSelectedMenu = useMemo(() => {
    if (!selectedMenuId) return null;
    const beforeScores = uploadedImages
      .filter((i) => i.shotType === "before" && typeof i.ai?.score === "number")
      .map((i) => i.ai!.score);
    const afterScores = uploadedImages
      .filter((i) => i.shotType === "after" && typeof i.ai?.score === "number")
      .map((i) => i.ai!.score);

    if (beforeScores.length === 0 && afterScores.length === 0) return null;

    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

    const beforeAvg = avg(beforeScores);
    const afterAvg = avg(afterScores);
    const delta = Math.round((afterAvg - beforeAvg) * 10) / 10;

    return { beforeAvg, afterAvg, delta };
  }, [uploadedImages, selectedMenuId]);

  /* -------- 제출: POST /restaurants/{restaurantId}/reviews -------- */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(restaurantId)) {
      alert("잘못된 식당 ID 입니다.");
      return;
    }
    if (!selectedMenuId) {
      alert("메뉴를 선택해주세요.");
      return;
    }
    if (submitting) return;

    setSubmitError(null);
    setConflict409(null);
    try {
      setSubmitting(true);

      const payload: any = {
        contents: comment.trim(),
        score: Number(avgScore5.toFixed(1)),
        menuId: selectedMenuId, // ✅ 리뷰에 메뉴 연결
        images: uploadedImages.map((img) => ({
          fileName: img.fileName,
          shotType: img.shotType,
          score: typeof img.ai?.score === "number" ? img.ai!.score : null,
          summary: img.ai?.summary ?? null,
        })),
      };

      const resp = await apiClient.createReviewForRestaurant(restaurantId, payload);

      if (!resp.success) {
        const err = String(resp.error || "");
        if (err.includes("401")) {
          alert("로그인이 필요해요. 로그인 페이지로 이동합니다.");
          router.push("/login");
          return;
        }
        if (err.includes("409") || err.includes("이미 작성한 리뷰가 존재")) {
          setConflict409("이미 작성한 리뷰가 존재합니다. 기존 리뷰를 수정하거나 삭제 후 다시 시도해주세요.");
          try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
          return;
        }
        throw new Error(err || "리뷰 생성에 실패했어요.");
      }

      router.replace(`/review/success?restaurantId=${restaurantId}`);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message || "리뷰 제출 중 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    comment.trim().length > 0 &&
    avgScore5 > 0 &&
    uploadedImages.length > 0 &&
    !!selectedMenuId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* AI 로딩 모달 */}
      <AnalyzingModal open={showAILoadingModal} mascotSrc="/bobple-mascot.png" durationSec={3} />

      {/* 409 배너 */}
      {conflict409 && (
        <div className="sticky top-0 z-20">
          <div className="mx-auto max-w-3xl p-3">
            <div className="flex items-start gap-3 rounded-xl border border-yellow-300/60 bg-yellow-50/70 dark:bg-yellow-900/30 px-4 py-3 backdrop-blur">
              <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-300 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-100">
                <p className="font-semibold">이미 작성한 리뷰가 존재함</p>
                <p className="mt-0.5">{conflict409}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-white/20 p-4 sticky top-0 z-10 shadow-lg"
      >
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="hover:bg-white/50 dark:hover:bg-gray-800/50">
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="font-bold text-xl bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
            리뷰 작성
          </h1>
          <div className="w-16" />
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="space-y-6">
          {/* 상단 식당 카드 */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">식당</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                      {loadingRestaurant ? "불러오는 중…" : restaurant?.name || "식당 정보 없음"}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full inline-block">
                      {restaurant?.category || "카테고리 없음"}
                    </div>
                  </div>
                  <Badge className="bg-gradient-to-r from-green-100 to-sky-100 dark:from-green-900 dark:to-sky-900 text-green-700 dark:text-green-300">
                    신규 작성
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ✅ 메뉴 선택 박스 */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2 rounded-xl">
                    <UtensilsCrossed className="h-5 w-5 text-white" />
                  </div>
                  메뉴 선택
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    value={menuQuery}
                    onChange={(e) => setMenuQuery(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="메뉴 검색…"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMenuQuery("")}
                    className="rounded-xl"
                  >
                    초기화
                  </Button>
                </div>

                <div className="max-h-52 overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60">
                  {menusLoading ? (
                    <div className="p-4 text-sm text-gray-500">메뉴 불러오는 중…</div>
                  ) : filteredMenus.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">메뉴가 없어요.</div>
                  ) : (
                    <ul className="divide-y divide-gray-200/60 dark:divide-gray-700/60">
                      {filteredMenus.map((m) => {
                        const active = selectedMenuId === m.id;
                        return (
                          <li
                            key={m.id}
                            className={`px-4 py-2 cursor-pointer text-sm flex items-center justify-between
                              ${active ? "bg-emerald-50/80 dark:bg-emerald-900/20" : "hover:bg-gray-50/70 dark:hover:bg-gray-800/40"}`}
                            onClick={() => setSelectedMenuId(m.id)}
                          >
                            <span className="font-medium">{m.name}</span>
                            {typeof m.price === "number" && (
                              <span className="text-xs text-gray-500">{m.price.toLocaleString()}원</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {selectedMenuId && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    선택된 메뉴 ID: <span className="font-semibold">{selectedMenuId}</span>
                  </p>
                )}
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
                    accept="image/jpeg,image/png,image/jpg"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 border-green-200 dark:border-green-700 rounded-xl"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    사진 선택
                  </Button>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">사진 업로드 후 메뉴 선택 → AI 분석을 실행하세요</p>
                </motion.div>

                {uploadedImages.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-200">업로드된 사진</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {uploadedImages.map((image, index) => (
                        <motion.div key={image.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.08 }}>
                          <Card className="overflow-hidden backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-lg rounded-2xl">
                            <div className="relative">
                              <img src={image.preview || "/placeholder.svg"} alt="업로드" className="w-full h-48 object-cover" />
                              <Button variant="destructive" size="sm" className="absolute top-2 right-2 rounded-full" onClick={() => removeImage(image.id)}>
                                삭제
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => toggleShotType(image.id)}
                                className="absolute top-2 left-2 rounded-full bg-white/80 dark:bg-gray-800/80"
                                title="식사 전/후 전환"
                              >
                                <Shuffle className="h-4 w-4 mr-1" />
                                {image.shotType === "before" ? "식사 전" : "식사 후"}
                              </Button>
                            </div>

                            <CardContent className="p-4">
                              {!image.ai ? (
                                <Button
                                  onClick={() => analyzeImage(image.id)}
                                  disabled={isAnalyzing || !selectedMenuId}
                                  className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                                >
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  {isAnalyzing ? "AI 분석 중..." : (selectedMenuId ? "AI 분석 시작" : "메뉴 선택 필요")}
                                </Button>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-sm font-medium">
                                      분석 완료 · <span className="uppercase">{image.shotType === "before" ? "BEFORE" : "AFTER"}</span>
                                    </span>
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
                                      <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">AI 피드백</p>
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

          {/* AI 종합 점수 + 전/후 비교 */}
          {(avgScore5 > 0 || compareForSelectedMenu) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-2 rounded-xl">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    AI 분석 결과
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {avgScore5 > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-sky-50 dark:from-green-900/20 dark:to-sky-900/20 p-6 rounded-2xl border border-green-200 dark:border-green-700">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">잔반 없음 별점(평균)</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-6 w-6 ${i < Math.round(avgScore5) ? "text-green-500 fill-green-500" : "text-gray-300"}`}
                              />
                            ))}
                          </div>
                          <span className="text-lg font-bold bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                            {avgScore5.toFixed(1)} / 5
                          </span>
                        </div>
                      </div>
                      <Progress value={avgScore100} className="h-3" />
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">개별 이미지의 별점 평균으로 계산됩니다.</p>
                    </div>
                  )}

                  {compareForSelectedMenu && (
                    <div className="rounded-2xl border border-emerald-300/60 dark:border-emerald-700/60 p-5 bg-emerald-50/60 dark:bg-emerald-900/20">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                        선택 메뉴 전/후 비교
                      </p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl p-3 bg-white/70 dark:bg-gray-800/60 border border-emerald-200/60 dark:border-emerald-700/40">
                          <p className="text-xs text-gray-500 mb-1">식사 전 평균</p>
                          <p className="text-lg font-bold">{compareForSelectedMenu.beforeAvg.toFixed(1)} / 5</p>
                        </div>
                        <div className="rounded-xl p-3 bg-white/70 dark:bg-gray-800/60 border border-emerald-200/60 dark:border-emerald-700/40">
                          <p className="text-xs text-gray-500 mb-1">식사 후 평균</p>
                          <p className="text-lg font-bold">{compareForSelectedMenu.afterAvg.toFixed(1)} / 5</p>
                        </div>
                        <div className="rounded-xl p-3 bg-white/70 dark:bg-gray-800/60 border border-emerald-200/60 dark:border-emerald-700/40">
                          <p className="text-xs text-gray-500 mb-1">변화량(후-전)</p>
                          <p className={`text-lg font-bold ${compareForSelectedMenu.delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {compareForSelectedMenu.delta >= 0 ? "+" : ""}
                            {compareForSelectedMenu.delta.toFixed(1)}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-2">
                        * 전/후로 지정된 이미지들이 각각 AI 분석을 완료했을 때 계산돼요.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 코멘트 & 제출 */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <form onSubmit={onSubmit}>
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-xl">코멘트</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {submitError && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-300/60 bg-red-50/70 dark:bg-red-900/30 px-3 py-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-300" />
                      <p className="text-sm text-red-800 dark:text-red-100">{submitError}</p>
                    </div>
                  )}

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
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{comment.length}/500자</p>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={!canSubmit || submitting}
                      className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
                    >
                      {submitting ? "제출 중…" : "리뷰 제출"}
                    </Button>
                  </div>

                  {!canSubmit && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span>메뉴 선택, 사진 업로드·AI 분석, 코멘트를 완료하면 제출할 수 있어요.</span>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
