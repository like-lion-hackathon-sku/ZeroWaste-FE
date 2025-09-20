import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@gradio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ─────────────────────────────────────────────────────────
 * 환경변수
 *   - GRADIO_BASE: 예) https://c3abdff47bad24a110.gradio.live
 *   - GRADIO_ENDPOINT: 예) /predict   (기본값으로 둬도 됨)
 ────────────────────────────────────────────────────────── */
const GRADIO_BASE = process.env.GRADIO_BASE ?? "https://c3abdff47bad24a110.gradio.live";
const GRADIO_ENDPOINT = process.env.GRADIO_ENDPOINT ?? "/predict";

/** 문자열에서 숫자 점수(0~100 또는 0~5)를 유연하게 뽑아내기 */
function extractScore(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    // "점수: 5점", "rating=4.2", "waste 83/100" 같은 형태 대응
    const five = v.match(/(\d+(?:\.\d+)?)\s*([\/]?5|점|stars?)/i);
    if (five) return Math.min(5, parseFloat(five[1]));
    const hundred = v.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*100|점\s*만점|percent|%)/i);
    if (hundred) return Math.min(100, parseFloat(hundred[1]));
    const plain = v.match(/\d+(?:\.\d+)?/);
    if (plain) return parseFloat(plain[0]);
  }
  return null;
}

/** 결과 객체에서 요약문 후보 추출 */
function extractSummary(data: any): string | null {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) {
    // 문자열 항목이 있으면 그중 가장 긴 걸 한줄평으로
    const texts = data.filter((x) => typeof x === "string") as string[];
    if (texts.length) return texts.sort((a, b) => b.length - a.length)[0];
  }
  if (typeof data === "object") {
    for (const k of ["summary", "comment", "one_line", "한줄평", "description"]) {
      if (typeof data[k] === "string") return data[k];
    }
  }
  return null;
}

/** 배열/객체 혼합 결과에서 (점수, 한줄평) 뽑기 */
function parseGradioResult(data: any): { score5?: number; score100?: number; summary?: string } {
  let score5: number | undefined;
  let score100: number | undefined;
  let summary = extractSummary(data) ?? undefined;

  const tryPick = (x: unknown) => {
    const s = extractScore(x);
    if (s == null) return;
    // 5점 척도인지 100점 척도인지 추정
    if (s <= 5) score5 = s;
    else score100 = s;
  };

  if (Array.isArray(data)) data.forEach(tryPick);
  else if (typeof data === "object" && data) {
    // 명시 키 우선
    if (typeof data.score === "number") {
      tryPick(data.score);
    }
    if (typeof data.score5 === "number") score5 = data.score5;
    if (typeof data.score100 === "number") score100 = data.score100;
    // 기타 값들에도 숫자 있으면 추출
    Object.values(data).forEach(tryPick);
  } else {
    tryPick(data);
  }

  // 100점만 온 경우 5점 환산
  if (score5 == null && typeof score100 === "number") {
    score5 = Math.round(((score100 / 100) * 5) * 10) / 10;
  }

  return { score5, score100, summary };
}

/** 이미지 Blob 만들기 (URL 혹은 multipart/form-data 파일) */
async function readImageBlob(req: NextRequest): Promise<Blob> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.startsWith("application/json")) {
    const { imageUrl } = (await req.json()) as { imageUrl?: string };
    if (!imageUrl) throw new Error("imageUrl is required");
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    return await res.blob();
  }

  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("image");
    if (!file || !(file instanceof Blob)) throw new Error("form-data field 'image' is required");
    return file;
  }

  throw new Error("Unsupported Content-Type. Use JSON {imageUrl} or multipart/form-data with 'image'.");
}

/** POST /api/ai/waste/analyze */
export async function POST(req: NextRequest) {
  try {
    const imageBlob = await readImageBlob(req);

    const client = await Client.connect(GRADIO_BASE, { hf_token: undefined }); // 토큰 필요 없으면 생략
    const result = await client.predict(GRADIO_ENDPOINT, {
      // Gradio에서 입력 컴포넌트 이름이 보통 'image' 또는 'pil_image' 입니다.
      // 스크린샷 기준: 'pil_image'
      pil_image: imageBlob,
    });

    const parsed = parseGradioResult(result.data);

    return NextResponse.json(
      {
        ok: true,
        score5: parsed.score5 ?? null,     // 0~5 (소수1자리 반올림)
        score100: parsed.score100 ?? (parsed.score5 != null ? Math.round((parsed.score5 / 5) * 100) : null),
        summary: parsed.summary ?? null,
        raw: result.data,                  // 디버깅용(원하면 FE에서 안 쓰면 됨)
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
