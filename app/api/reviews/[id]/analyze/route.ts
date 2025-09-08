import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@gradio/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clampScore(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n * 10) / 10));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "NO_FILE" }, { status: 400 });
    }

    const client = await Client.connect(process.env.GRADIO_BASE_URL!);
    const route = process.env.GRADIO_PREDICT_ROUTE || "/predict";

    // Gradio 호출
    const gr = await client.predict(route, { pil_image: file });

    // ---- 여기서 문자열 배열 파싱 ----
    const arr = (gr as any)?.data as unknown;
    let score = 0;
    let summary = "";

    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item !== "string") continue;

        // "점수: 5점" 에서 숫자 추출
        const m = item.match(/점수\s*[:：]\s*([0-9]+(?:\.[0-9]+)?)\s*점?/);
        if (m) {
          score = clampScore(Number(m[1]));
          continue;
        }

        // "한줄평: ..." 에서 본문만 추출
        if (/한줄평\s*[:：]/.test(item)) {
          summary = item.replace(/^.*?[:：]\s*/, "").trim();
          continue;
        }
      }
    }

    // 폴백 처리
    if (!summary) {
      summary =
        score >= 4.5
          ? "잔반이 거의 없습니다. 훌륭합니다!"
          : score >= 3.5
          ? "대체로 잘 드셨습니다. 소량의 잔반만 남았어요."
          : score >= 2.5
          ? "잔반이 조금 있어요. 다음엔 양 조절을 추천합니다."
          : score >= 1.5
          ? "잔반이 꽤 남았습니다. 양/구성 조정이 필요해요."
          : "잔반이 많이 남았습니다. 더 작은 양을 시도해보세요.";
    }

    return NextResponse.json({
      success: true,
      data: {
        review_id: Number(params.id),
        score,
        summary,
        analyzed_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[/api/reviews/[id]/analyze] error:", e);
    return NextResponse.json({ success: false, error: "AI_ANALYSIS_FAILED" }, { status: 500 });
  }
}
