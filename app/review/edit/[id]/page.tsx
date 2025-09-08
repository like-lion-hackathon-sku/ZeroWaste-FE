"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Camera, Upload, Sparkles, CheckCircle, AlertCircle, Star, Save, Trash2,
} from "lucide-react";

/* ---------------- Types ---------------- */
type RestaurantInfo = { id?: number; name: string; category?: string | null };
type Review = {
  id: number;
  restaurant?: RestaurantInfo;
  waste_rating: number; // 0~5
  comment: string;
  created_at?: string | null;
};

type UploadedImage = {
  id: string;
  file?: File;
  preview: string;
  ai?: {
    score: number;          // 0~5
    summary: string;        // 한줄 요약
    analyzed_at?: string;
  };
};

/* ------ dataURL/URL → File 변환 유틸 ------ */
async function ensureFileFromImage(img: UploadedImage): Promise<File | null> {
  if (img.file) return img.file;

  if (img.preview?.startsWith("data:")) {
    const [hdr, b64] = img.preview.split(",");
    const mime = hdr.match(/data:(.*?);/)?.[1] || "image/jpeg";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], `image.${mime.split("/")[1] || "jpg"}`, { type: mime });
  }

  try {
    const r = await fetch(img.preview, { cache: "no-store" });
    const blob = await r.blob();
    const ext = blob.type?.split("/")[1] || "jpg";
    return new File([blob], `image.${ext}`, { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}

export default function ReviewEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const reviewId = Number(params?.id);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [review, setReview] = useState<Review | null>(null);
  const [comment, setComment] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [wasteScore5, setWasteScore5] = useState(0); // ⭐ 0~5
  const wasteScore100 = Math.round(wasteScore5 * 20);

  /* -------- 초기 데이터 -------- */
  useEffect(() => {
    if (!reviewId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reviews/${reviewId}`, { cache: "no-store" });
        const json = await res.json();
        if (json?.success && json?.data) {
          const r: Review = json.data;
          setReview(r);
          setComment(r.comment ?? "");
          setWasteScore5(Number(r.waste_rating ?? 0));
        } else {
          setReview(null);
        }
      } catch (e) {
        console.error(e);
        setReview(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [reviewId]);

  /* -------- 업로드 -------- */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedImages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 10),
            file,
            preview: (ev.target?.result as string) || "",
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  /* -------- 삭제(점수 재계산) -------- */
  const removeImage = (id: string) => {
    setUploadedImages((prev) => {
      const next = prev.filter((it) => it.id !== id);
      const remainScores = next
        .map((it) => it.ai?.score)
        .filter((s): s is number => typeof s === "number");
      setWasteScore5(remainScores.length ? Math.max(...remainScores) : 0);
      return next;
    });
  };

  /* -------- AI 분석: /api/reviews/:id/analyze -------- */
  const analyzeImage = async (imageId: string) => {
    try {
      setIsAnalyzing(true);

      const target = uploadedImages.find((img) => img.id === imageId);
      if (!target) throw new Error("이미지를 찾을 수 없어요.");

      const fileToSend = await ensureFileFromImage(target);
      if (!fileToSend) throw new Error("분석할 이미지 파일을 준비하지 못했어요.");

      const fd = new FormData();
      fd.append("file", fileToSend, fileToSend.name);

      const res = await fetch(`/api/reviews/${reviewId}/analyze`, {
        method: "POST",
        body: fd, // Content-Type 자동 설정
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`분석 API ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = await res.json();
      if (!json?.success || !json?.data) throw new Error("분석 실패");

      const safeScore = Math.max(0, Math.min(5, Number(json.data.score ?? 0)));
      const summary = String(json.data.summary ?? "");
      const analyzed_at = String(json.data.analyzed_at ?? new Date().toISOString());

      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, ai: { score: safeScore, summary, analyzed_at } } : img
        ),
      );

      // 종합 점수: 최고점 유지
      setWasteScore5((prev) => Math.max(prev, safeScore));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "AI 분석에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  /* -------- 저장/삭제 -------- */
  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: comment?.trim() ?? "",
          waste_rating: wasteScore5,
        }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "리뷰 수정 실패");
      alert("리뷰가 수정되었습니다.");
      router.replace("/profile");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "리뷰 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!reviewId || !confirm("이 리뷰를 삭제할까요?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "리뷰 삭제 실패");
      alert("리뷰가 삭제되었습니다.");
      router.replace("/profile");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "리뷰 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  /* -------- UI -------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">리뷰 정보를 불러오는 중…</div>
      </div>
    );
  }
  if (!review) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-red-500">리뷰를 찾을 수 없습니다.</div>
          <Button variant="outline" onClick={() => router.back()}>뒤로가기</Button>
        </div>
      </div>
    );
  }

  const canSubmit =
    uploadedImages.length >= 1 && comment.trim().length > 0 && wasteScore5 > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />뒤로가기
          </Button>
          <h1 className="font-semibold text-foreground">리뷰 수정</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-2xl">
        <div className="space-y-6">
          {/* 요약 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">식당</div>
                  <div className="text-lg font-semibold text-foreground">
                    {review.restaurant?.name || "식당 정보 없음"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {review.restaurant?.category || "카테고리 없음"}
                  </div>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {(review.waste_rating ?? 0).toFixed(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* 업로드 & AI 분석 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                사진 업로드 & AI 분석
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  사진 선택
                </Button>
                <p className="text-sm text-muted-foreground mt-2">사진 업로드 후 AI 분석을 실행하세요</p>
              </div>

              {uploadedImages.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground">업로드된 사진</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {uploadedImages.map((image) => (
                      <Card key={image.id} className="overflow-hidden">
                        <div className="relative">
                          <img src={image.preview} alt="업로드" className="w-full h-48 object-cover" />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
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
                              className="w-full"
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              {isAnalyzing ? "AI 분석 중..." : "AI 분석 시작"}
                            </Button>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm font-medium text-foreground">분석 완료</span>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>AI 산출 별점</span>
                                  <span className="font-medium text-primary">
                                    {image.ai.score.toFixed(1)} / 5
                                  </span>
                                </div>
                                <Progress value={Math.round(image.ai.score * 20)} className="h-2" />
                              </div>

                              {image.ai.summary && (
                                <div className="bg-primary/5 p-3 rounded-lg">
                                  <p className="text-sm text-primary font-medium mb-1">AI 피드백</p>
                                  <p className="text-xs text-muted-foreground">{image.ai.summary}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI 결과(별점 표기) */}
          {wasteScore5 > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>AI 분석 결과</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-primary/5 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">잔반 없음 별점</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-6 w-6 ${
                              i < Math.round(wasteScore5)
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {wasteScore5.toFixed(1)} / 5
                      </span>
                    </div>
                  </div>
                  <Progress value={wasteScore100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 코멘트 + 저장/삭제 */}
          <form onSubmit={onSave}>
            <Card>
              <CardHeader><CardTitle>코멘트</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="comment">리뷰 내용</Label>
                  <Textarea
                    id="comment"
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="식사 경험을 적어주세요…"
                  />
                  <p className="text-xs text-muted-foreground">{comment.length}자</p>
                </div>

                <div className="flex justify-between gap-2 pt-2">
                  <Button type="button" variant="destructive" onClick={onDelete} disabled={deleting}>
                    <Trash2 className="h-4 w-4 mr-1" />{deleting ? "삭제 중…" : "삭제"}
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                      취소
                    </Button>
                    <Button type="submit" disabled={!canSubmit || saving}>
                      <Save className="h-4 w-4 mr-1" />{saving ? "저장 중…" : "저장"}
                    </Button>
                  </div>
                </div>

                {!canSubmit && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>사진 업로드, AI 분석, 코멘트를 완료하면 저장할 수 있어요.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
