"use client";

import type React from "react";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Camera,
  Upload,
  Leaf,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Star,
} from "lucide-react";

// ---- 타입 & 목업 데이터 (숫자 키) ----
type RestaurantInfo = { name: string; category: string };

const mockRestaurants: Record<number, RestaurantInfo> = {
  1: { name: "그린테이블", category: "한식" },
  2: { name: "제로웨이스트 카페", category: "카페" },
};

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  type: "before" | "after";
  aiAnalysis?: {
    wastePercentage: number;
    confidence: number;
    suggestions: string[];
  };
}

export default function WriteReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurantIdParam = searchParams.get("restaurantId");
  const restaurantId = restaurantIdParam ? Number(restaurantIdParam) : NaN;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reviewData, setReviewData] = useState({
    comment: "",
    wasteScore: 0, // 0~100
  });

  // 안전 조회 (숫자 키)
  const restaurant: RestaurantInfo =
    (!Number.isNaN(restaurantId) && mockRestaurants[restaurantId]) || {
      name: "알 수 없는 식당",
      category: "기타",
    };

  // 업로드 핸들러 (이미지 전용)
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newImage: UploadedImage = {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
            file,
            preview: e.target?.result as string,
            type: uploadedImages.length % 2 === 0 ? "before" : "after",
          };
          setUploadedImages((prev) => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // AI 분석 모사
  const simulateAIAnalysis = async (imageId: string) => {
    setIsAnalyzing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockAnalysis = {
      wastePercentage: Math.floor(Math.random() * 30), // 0~30%
      confidence: 85 + Math.floor(Math.random() * 15), // 85~100%
      suggestions: [
        "음식을 거의 다 드셨네요! 훌륭합니다.",
        "적정량을 주문하여 음식물 쓰레기를 줄였습니다.",
        "친환경적인 식사 습관을 보여주셨습니다.",
      ],
    };

    setUploadedImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, aiAnalysis: mockAnalysis } : img)),
    );

    const wasteScore = Math.max(0, 100 - mockAnalysis.wastePercentage);
    setReviewData((prev) => ({ ...prev, wasteScore }));

    setIsAnalyzing(false);
  };

  const removeImage = (imageId: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const handleSubmitReview = async () => {
    // TODO: 실제 제출 로직 연동
    console.log("Submitting review:", {
      restaurantId,
      ...reviewData,
      images: uploadedImages,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    router.push(`/review/success?restaurantId=${restaurantIdParam ?? ""}`);
  };

  const canSubmit =
    uploadedImages.length >= 1 && reviewData.comment.trim().length > 0 && reviewData.wasteScore > 0;

  // ====== 별점 관련 유틸 ======
  const star5 = Math.round(reviewData.wasteScore / 20); // 0~5
  const star5Float = Math.round((reviewData.wasteScore / 20) * 10) / 10; // 한 자리 반올림

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <div className="text-center">
            <h1 className="font-semibold text-foreground">리뷰 작성</h1>
            <p className="text-sm text-muted-foreground">{restaurant.name}</p>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-2xl">
        <div className="space-y-6">
          {/* Photo Upload & AI Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                식사 사진 업로드
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                식사 사진을 업로드하면 AI가 자동으로 잔반 비율을 분석합니다
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Button */}
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
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
                  className="bg-transparent"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  사진 선택
                </Button>
                <p className="text-sm text-muted-foreground mt-2">식사 사진을 업로드해주세요</p>
              </div>

              {/* Uploaded Images */}
              {uploadedImages.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium text-foreground">업로드된 사진</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {uploadedImages.map((image) => (
                      <Card key={image.id} className="overflow-hidden">
                        <div className="relative">
                          <img
                            src={image.preview || "/placeholder.svg"}
                            alt="업로드된 사진"
                            className="w-full h-48 object-cover"
                          />
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
                          {!image.aiAnalysis && (
                            <Button
                              onClick={() => simulateAIAnalysis(image.id)}
                              disabled={isAnalyzing}
                              className="w-full"
                            >
                              <Sparkles className="h-4 w-4 mr-2" />
                              {isAnalyzing ? "AI 분석 중..." : "AI 분석 시작"}
                            </Button>
                          )}

                          {image.aiAnalysis && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm font-medium text-foreground">분석 완료</span>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>잔반 비율</span>
                                  <span className="font-medium text-primary">
                                    {image.aiAnalysis.wastePercentage}%
                                  </span>
                                </div>
                                <Progress
                                  value={100 - image.aiAnalysis.wastePercentage}
                                  className="h-2"
                                />
                              </div>

                              <div className="text-xs text-muted-foreground">
                                신뢰도: {image.aiAnalysis.confidence}%
                              </div>

                              {image.aiAnalysis.suggestions.length > 0 && (
                                <div className="bg-primary/5 p-3 rounded-lg">
                                  <p className="text-sm text-primary font-medium mb-1">AI 피드백</p>
                                  <p className="text-xs text-muted-foreground">
                                    {image.aiAnalysis.suggestions[0]}
                                  </p>
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

          {/* AI Analysis Result (별점 + 숫자 병기) */}
          {reviewData.wasteScore > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-primary" />
                  AI 분석 결과
                </CardTitle>
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
                              i < star5
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {reviewData.wasteScore}점 ({star5Float}/5)
                      </span>
                    </div>
                  </div>

                  <Progress value={reviewData.wasteScore} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    AI가 분석한 점수를 별점(5점 만점)으로 변환했습니다
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Review Form */}
          <Card>
            <CardHeader>
              <CardTitle>리뷰 작성</CardTitle>
              <p className="text-sm text-muted-foreground">식사 경험을 자세히 알려주세요</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Comment */}
              <div className="space-y-2">
                <Label htmlFor="comment">리뷰 내용</Label>
                <Textarea
                  id="comment"
                  placeholder="식당에 대한 솔직한 후기를 작성해주세요..."
                  value={reviewData.comment}
                  onChange={(e) =>
                    setReviewData((prev) => ({ ...prev, comment: e.target.value }))
                  }
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">{reviewData.comment.length}/500자</p>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button onClick={handleSubmitReview} disabled={!canSubmit} className="w-full" size="lg">
                  리뷰 제출
                </Button>
              </div>

              {!canSubmit && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>사진 업로드, AI 분석, 리뷰 내용 작성을 완료해주세요</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
