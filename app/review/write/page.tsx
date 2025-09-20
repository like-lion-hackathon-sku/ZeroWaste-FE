// app/review/write/page.tsx
// 리뷰 작성 - AFTER만 분석/집계 + "기타(직접 입력)" + 메뉴판(버튼) 선택 + 평균 4.0↑ 시 스탬프 1개 적립 UI

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
  Stamp as StampIcon,
  Search,
  X,
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
};

type UploadedImage = {
  id: string;
  fileName: string;
  url: string;     // 절대 URL
  preview: string; // 절대 URL

  shotType: ShotType;
  ai?: {
    score: number; // 0~5
    summary: string;
    analyzed_at?: string;
  };
};

/* ─────────────────────────────
   상수: "기타(직접 입력)" 메뉴
───────────────────────────── */
const OTHER_MENU_ID = -1;
const OTHER_MENU_ITEM: MenuItem = { id: OTHER_MENU_ID, name: "기타(직접 입력)" };

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
  const [customMenuName, setCustomMenuName] = useState("");

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAILoadingModal, setShowAILoadingModal] = useState(false);

  const [comment, setComment] = useState("");
  const [avgScore5, setAvgScore5] = useState(0); // AFTER 사진만 집계
  const avgScore100 = Math.round(avgScore5 * 20);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflict409, setConflict409] = useState<string | null>(null);

  // 평균 4.0↑일 때 노출되는 배너/스탬프 카드
  const [stampBanner, setStampBanner] = useState<string | null>(null);
  const [earnedStamp, setEarnedStamp] = useState(false);

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
    return () => {
      ignore = true;
    };
  }, [restaurantId]);

  /* -------- 메뉴 목록 -------- */
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!Number.isFinite(restaurantId)) return;
      try {
        setMenusLoading(true);
        const resp = await (apiClient as any).getRestaurantMenus?.(restaurantId);
        if (ignore) return;

        let base: MenuItem[] = [];
        if (resp?.success && Array.isArray(resp.data)) base = resp.data as MenuItem[];
        const hasOther = base.some((m) => m.id === OTHER_MENU_ID);
        // 메뉴판 마지막에 "기타(직접 입력)" 추가
        const appended = hasOther ? base : [...base, OTHER_MENU_ITEM];
        setMenus(appended);
      } catch {
        if (!ignore) setMenus([OTHER_MENU_ITEM]);
      } finally {
        if (!ignore) setMenusLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [restaurantId]);

  /* -------- 메뉴 검색(보조) -------- */
  const filteredMenus = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return menus;
    return menus.filter((m) => (m.name || "").toLowerCase().includes(q));
  }, [menus, menuQuery]);

  /* -------- 업로드 (AFTER 고정) -------- */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      try {
        if (!file.type.startsWith("image/")) continue;

        const up = await apiClient.uploadImage("review", file);
        if (!up.success) throw new Error(up.error || "이미지 업로드 실패");

        const { fileName } = up.data!;
        // 절대 URL로 저장 (분석 호출 안정성)
        const rel = apiClient.getImageUrl("review", fileName);
        const previewUrl = apiClient.toAbsoluteUrl(rel);

        setUploadedImages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 10),
            fileName,
            url: previewUrl,     // 절대 URL
            preview: previewUrl, // 절대 URL
            shotType: "after",
          },
        ]);
      } catch (err: any) {
        console.error(err);
        alert(err?.message || "이미지 업로드 중 오류가 발생했어요.");
      }
    }

    try {
      e.target.value = "";
    } catch {}
  };

  /* -------- 평균 재계산: AFTER만 -------- */
  const recalcAverage = (imgs: UploadedImage[]) => {
    const scores = imgs
      .filter((it) => it.shotType === "after")
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


  /* -------- AI 분석 (이미지 URL → 우리 BE → Gradio) -------- */
  const analyzeImage = async (imageId: string) => {
    const target = uploadedImages.find((img) => img.id === imageId);
    if (!target) return alert("이미지를 찾을 수 없어요.");
    if (!selectedMenuId) return alert("먼저 메뉴를 선택해주세요.");
    if (selectedMenuId === OTHER_MENU_ID && !customMenuName.trim()) {
      alert("‘기타(직접 입력)’을 선택하셨다면 메뉴명을 입력해주세요.");
      return;
    }

    try {
      setShowAILoadingModal(true);
      setIsAnalyzing(true);


      // 클라이언트 헬퍼 (내부에서 절대 URL 보정 + 에러 정규화)
      const resp = await apiClient.analyzeWasteByPublicUrl(target.url);
      if (!resp.success) throw new Error(resp.error || "AI 분석 실패");

      const payload: any = resp.data ?? {};
      const scoreNum = Number(payload?.score5 ?? payload?.score ?? 0);
      const summaryStr = String(payload?.summary ?? "");
      const safeScore = Math.max(0, Math.min(5, Number.isFinite(scoreNum) ? Math.round(scoreNum * 10) / 10 : 0));

      setUploadedImages((prev) => {
        const next = prev.map((img) =>
          img.id === imageId
            ? { ...img, ai: { score: safeScore, summary: summaryStr, analyzed_at: new Date().toISOString() } }
            : img
        );
        recalcAverage(next); // 평균 갱신
        return next;
      });
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "AI 분석에 실패했어요. 다시 시도해주세요.");
    } finally {
      setTimeout(() => {
        setShowAILoadingModal(false);
        setIsAnalyzing(false);
      }, 1200);
    }
  };

  /* -------- 평균 4.0 이상 감지 → 배너/스탬프 카드 노출 -------- */
  useEffect(() => {
    if (avgScore5 >= 4) {
      setEarnedStamp(true);
      setStampBanner("축하합니다! 평균 별점 4.0점 이상으로 스탬프가 적립됩니다.");
    } else {
      setEarnedStamp(false);
      setStampBanner(null);
    }
  }, [avgScore5]);

  /* -------- 제출 -------- */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(restaurantId)) return alert("잘못된 식당 ID 입니다.");
    if (!selectedMenuId) return alert("메뉴를 선택해주세요.");
    if (selectedMenuId === OTHER_MENU_ID && !customMenuName.trim())
      return alert("‘기타(직접 입력)’ 메뉴명을 입력해주세요.");
    if (submitting) return;

    setSubmitError(null);
    setConflict409(null);
    try {
      setSubmitting(true);

      const payload: any = {
        contents: comment.trim(),
        score: Number(avgScore5.toFixed(1)),
        menuId: selectedMenuId === OTHER_MENU_ID ? null : selectedMenuId,
        menuName: selectedMenuId === OTHER_MENU_ID ? customMenuName.trim() : undefined,
        images: uploadedImages.map((img) => ({
          fileName: img.fileName,
          shotType: "after" as const,
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
          try {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch {}
          return;
        }
        throw new Error(err || "리뷰 생성에 실패했어요.");
      }

      const earned = avgScore5 >= 4 ? 1 : 0;
      if (earned) alert("축하합니다! 평균 4.0 이상으로 스탬프가 적립됩니다.");

      router.replace(`/review/success?restaurantId=${restaurantId}${earned ? "&stampEarned=1" : ""}`);
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
    !!selectedMenuId &&
    (selectedMenuId !== OTHER_MENU_ID || !!customMenuName.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* AI 로딩 모달 */}
      <AnalyzingModal open={showAILoadingModal} mascotSrc="/bobple-mascot.png" durationSec={3} />

      {/* 409 배너 */}
      {conflict409 && (
        <div className="sticky top-0 z-30">
          <div className="mx-auto max-w-3xl p-3">
            <div className="flex items-start gap-3 rounded-xl border border-yellow-300/60 bg-yellow-50/80 dark:bg-yellow-900/30 px-4 py-3 backdrop-blur">
              <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-300 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-100">
                <p className="font-semibold">이미 작성한 리뷰가 존재함</p>
                <p className="mt-0.5">{conflict409}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 평균 4.0↑ 스탬프 알림 배너 */}
      {stampBanner && (
        <div className="sticky top-0 z-20">
          <div className="mx-auto max-w-3xl p-3">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50/85 dark:bg-emerald-900/30 px-4 py-3 backdrop-blur">
              <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300 mt-0.5" />
              <div className="text-sm text-emerald-800 dark:text-emerald-100">
                <p className="font-semibold">스탬프 획득</p>
                <p className="mt-0.5">{stampBanner}</p>
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
          <h1 className="font-bold text-xl bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">리뷰 작성</h1>
          <div className="w-16" />
        </div>
      </motion.header>

      <div className="container mx-auto p-4 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="space-y-6">
          {/* 상단 식당 카드 */}
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

          {/* ✅ 메뉴판: 버튼으로 선택 */}
          <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2 rounded-xl">
                  <UtensilsCrossed className="h-5 w-5 text-white" />
                </div>
                메뉴 선택(메뉴판)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 보조 검색 */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={menuQuery}
                    onChange={(e) => setMenuQuery(e.target.value)}
                    className="w-full rounded-xl border pl-9 pr-9 border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="메뉴 검색…"
                  />
                  {menuQuery && (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setMenuQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button type="button" variant="outline" onClick={() => setMenuQuery("")} className="rounded-xl">
                  초기화
                </Button>
              </div>

              {/* 버튼 그리드 메뉴판 */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white/60 dark:bg-gray-800/60 max-h-64 overflow-auto">
                {menusLoading ? (
                  <div className="p-3 text-sm text-gray-500">메뉴 불러오는 중…</div>
                ) : filteredMenus.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">메뉴가 없어요. 아래의 “기타(직접 입력)”을 사용하세요.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredMenus.map((m) => {
                      const active = selectedMenuId === m.id;
                      return (
                        <Button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMenuId(m.id)}
                          variant={active ? "default" : "outline"}
                          className={
                            "justify-between rounded-xl px-3 py-2 " +
                            (active
                              ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white"
                              : "border-gray-200 dark:border-gray-700")
                          }
                          title={m.name}
                        >
                          <span className="truncate">{m.name}</span>
                          {typeof m.price === "number" && (
                            <span className={"ml-2 text-xs " + (active ? "text-white/90" : "text-gray-500")}>
                              {m.price.toLocaleString()}원
                            </span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 기타(직접 입력) 입력란 */}
              {selectedMenuId === OTHER_MENU_ID && (
                <div className="space-y-2">
                  <Label htmlFor="customMenu" className="text-sm">
                    기타 메뉴명
                  </Label>
                  <input
                    id="customMenu"
                    value={customMenuName}
                    onChange={(e) => setCustomMenuName(e.target.value)}
                    placeholder="예) 한우불고기 정식"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    maxLength={40}
                  />
                </div>
              )}

              {/* 선택 안내 */}
              {selectedMenuId && selectedMenuId !== OTHER_MENU_ID && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  선택된 메뉴 ID: <span className="font-semibold">{selectedMenuId}</span>
                </p>
              )}
              {selectedMenuId === OTHER_MENU_ID && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  선택된 메뉴: <span className="font-semibold">기타(직접 입력)</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* 업로드 & AI 분석 (AFTER 고정) */}
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
              <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-700/60 bg-emerald-50/60 dark:bg-emerald-900/20 p-3 text-xs text-emerald-800 dark:text-emerald-200">
                이 페이지에서는 <b>식사 후 사진</b>만 업로드·분석되며, AI 종합 점수도 <b>‘식사 후’ 결과</b>만으로 계산됩니다.
              </div>

              <div className="border-2 border-dashed border-green-300 dark:border-green-700 rounded-2xl p-8 text-center bg-gradient-to-br from-green-50/50 to-sky-50/50 dark:from-green-900/20 dark:to-sky-900/20">
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
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                  사진 업로드 후 <b>메뉴 선택</b> → <b>AI 분석</b>을 실행하세요.
                </p>
              </div>

              {uploadedImages.length > 0 && (
                <div className="space-y-4">
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
                            <div className="absolute top-2 left-2 rounded-full bg-white/85 dark:bg-gray-800/85 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-700/40">
                              식사 후 (고정)
                            </div>
                          </div>

                          <CardContent className="p-4">
                            {!image.ai ? (
                              <Button
                                onClick={() => analyzeImage(image.id)}
                                disabled={
                                  isAnalyzing ||
                                  !selectedMenuId ||
                                  (selectedMenuId === OTHER_MENU_ID && !customMenuName.trim())
                                }
                                className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                              >
                                <Sparkles className="h-4 w-4 mr-2" />
                                {isAnalyzing
                                  ? "AI 분석 중..."
                                  : !selectedMenuId
                                  ? "메뉴 선택 필요"
                                  : selectedMenuId === OTHER_MENU_ID && !customMenuName.trim()
                                  ? "메뉴명 입력 필요"
                                  : "AI 분석 시작"}
                              </Button>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                  <span className="text-sm font-medium">분석 완료 · AFTER</span>
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI 종합 점수 (AFTER만 반영) */}
          {avgScore5 > 0 && (
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-2 rounded-xl">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  AI 분석 결과 (식사 후 기준)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="bg-gradient-to-r from-green-50 to-sky-50 dark:from-green-900/20 dark:to-sky-900/20 p-6 rounded-2xl border border-green-200 dark:border-green-700">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">잔반 없음 별점(평균)</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-6 w-6 ${i < Math.round(avgScore5) ? "text-green-500 fill-green-500" : "text-gray-300"}`} />
                        ))}
                      </div>
                      <span className="text-lg font-bold bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                        {avgScore5.toFixed(1)} / 5
                      </span>
                    </div>
                  </div>
                  <Progress value={avgScore100} className="h-3" />
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                    * <b>식사 후(After)</b>로 업로드·분석된 이미지들의 별점 평균입니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ✅ 스탬프 적립 카드 — 평균 4.0 이상일 때만 노출, 1개만 표시 */}
          {earnedStamp && avgScore5 >= 4 && (
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 16 }}>
              <Card className="border-purple-300/60 dark:border-purple-700/60 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 shadow-xl rounded-2xl">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                        <StampIcon className="h-5 w-5" />
                      </div>
                      <div className="text-lg font-semibold text-purple-700 dark:text-purple-200">스탬프 적립</div>
                    </div>
                    <div className="text-sm text-purple-700/80 dark:text-purple-200/80">이번 리뷰</div>
                  </div>

                  <div className="flex items-center justify-center mb-2">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.05 }}
                      className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg border-2 border-purple-400 flex items-center justify-center"
                    >
                      <StampIcon className="h-7 w-7" />
                    </motion.div>
                  </div>

                  <p className="text-center text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-purple-700 dark:text-purple-300">스탬프 1개 적립 완료!</span> 평균 4점 이상 리뷰로 적립됐어요.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 코멘트 & 제출 */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">
                      <AlertCircle className="h-4 w-4" />
                      <span>메뉴판에서 메뉴 선택(또는 기타 입력), 사진 업로드·AI 분석(식사 후), 코멘트를 완료하면 제출할 수 있어요.</span>
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
