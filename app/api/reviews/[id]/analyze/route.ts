// app/api/reviews/[id]/analyze/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@gradio/client"; // 실서비스 모드에서만 사용

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ─────────────────────────────────────────────────────────
   공통 유틸
────────────────────────────────────────────────────────── */
function clampScore(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n * 10) / 10));
}

// 해시 기반 의사난수(목업 점수 고정 재현성)
function hashSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

// 점수에 따라 자연스러운 요약 문구 생성
function summaryFor(score: number) {
  if (score >= 4.5) return "잔반이 거의 없습니다. 훌륭합니다!";
  if (score >= 3.5) return "대체로 잘 드셨습니다. 소량의 잔반만 남았어요.";
  if (score >= 2.5) return "잔반이 조금 있어요. 다음엔 양 조절을 추천합니다.";
  if (score >= 1.5) return "잔반이 꽤 남았습니다. 양/구성 조정이 필요해요.";
  return "잔반이 많이 남았습니다. 더 작은 양을 시도해보세요.";
}

/* ─────────────────────────────────────────────────────────
   목업 생성기
────────────────────────────────────────────────────────── */
function buildMock(id: string) {
  // review id, 시간, 파일명 등을 섞어서 0~5 점수 생성
  const seed = hashSeed(id + ":" + new Date().toDateString());
  const raw = 4.8 * seed + 0.2; // 0.2 ~ 5.0 사이
  const score = clampScore(raw);
  const summary = summaryFor(score);
  return { score, summary };
}

/* ─────────────────────────────────────────────────────────
   메인 핸들러
────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reviewId = Number(params.id);

  try {
    const form = await req.formData();
    const file = form.get("file");

    // 파일 유효성(실서비스 고려). 목업이라도 형식은 맞춰 두자.
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "NO_FILE" }, { status: 400 });
    }

    const useMock =
      process.env.USE_MOCK_AI === "1" ||
      !process.env.GRADIO_BASE_URL; // Gradio 설정이 없으면 자동 목업

    /* ── 목업 모드 ─────────────────────────────────────── */
    if (useMock) {
      const { score, summary } = buildMock(String(reviewId));
      return NextResponse.json({
        success: true,
        data: {
          review_id: reviewId,
          score,
          summary,
          analyzed_at: new Date().toISOString(),
        },
      });
    }

    /* ── 실서비스(Gradio) 모드 ─────────────────────────── */
    const client = await Client.connect(process.env.GRADIO_BASE_URL!);
    const route = process.env.GRADIO_PREDICT_ROUTE || "/predict";
    const gr = await client.predict(route, { pil_image: file });

    // 문자열 배열 파싱
    const arr = (gr as any)?.data as unknown;
    let score = 0;
    let summary = "";

    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item !== "string") continue;

        // "점수: 5점" → 숫자
        const m = item.match(/점수\s*[:：]\s*([0-9]+(?:\.[0-9]+)?)\s*점?/);
        if (m) {
          score = clampScore(Number(m[1]));
          continue;
        }

        // "한줄평: ..." → 본문
        if (/한줄평\s*[:：]/.test(item)) {
          summary = item.replace(/^.*?[:：]\s*/, "").trim();
          continue;
        }
      }
    }

    // 폴백
    if (!summary) summary = summaryFor(score);

    return NextResponse.json({
      success: true,
      data: {
        review_id: reviewId,
        score,
        summary,
        analyzed_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[/api/reviews/[id]/analyze] error:", e);

    // 에러 시에도 서비스 끊기지 않게 목업으로 폴백
    const { score, summary } = buildMock(String(params.id));
    return NextResponse.json({
      success: true,
      warning: "AI 연결 실패로 목업 결과를 반환합니다.",
      data: {
        review_id: Number(params.id),
        score,
        summary,
        analyzed_at: new Date().toISOString(),
      },
    });
  }
}
