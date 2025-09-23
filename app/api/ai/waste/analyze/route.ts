import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@gradio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ─────────────────────────────────────────────────────────
 * 환경변수
 *   - GRADIO_BASE: 예) https://xxxx.gradio.live
 *   - GRADIO_ENDPOINT: 예) /predict
 ────────────────────────────────────────────────────────── */
const GRADIO_BASE = process.env.GRADIO_BASE ?? "https://92d5382c6ae299f758.gradio.live";
const GRADIO_ENDPOINT = process.env.GRADIO_ENDPOINT ?? "/predict";

/** 문자열에서 숫자 점수(0~100 또는 0~5)를 유연하게 뽑아내기 */
function extractScore(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
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
    const texts = data.filter((x) => typeof x === "string") as string[];
    if (texts.length) return texts.sort((a, b) => b.length - a.length)[0];
  }
  if (typeof data === "object") {
    for (const k of ["summary", "comment", "one_line", "한줄평", "description", "result", "message"]) {
      if (typeof (data as any)[k] === "string") return (data as any)[k];
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
    if (s <= 5) score5 = s;
    else score100 = s;
  };

  if (Array.isArray(data)) data.forEach(tryPick);
  else if (typeof data === "object" && data) {
    if (typeof (data as any).score === "number") {
      tryPick((data as any).score);
    }
    if (typeof (data as any).score5 === "number") score5 = (data as any).score5;
    if (typeof (data as any).score100 === "number") score100 = (data as any).score100;
    Object.values(data as Record<string, unknown>).forEach(tryPick);
  } else {
    tryPick(data);
  }

  if (score5 == null && typeof score100 === "number") {
    score5 = Math.round(((score100 / 100) * 5) * 10) / 10;
  }

  return { score5, score100, summary };
}

/** 이미지 Blob 읽기 (JSON {imageUrl} 또는 multipart/form-data 'image') */
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

/** Gradio 엔드포인트에서 "이미지" 입력 파라미터의 실제 키 이름을 찾아준다. */
async function findImageParamName(client: any, endpoint: string): Promise<string> {
  // 1) 정식 스키마 조회
  try {
    const info = await client.view(endpoint);
    // info.parameters 형식: [{label, component, type, name, ...}, ...]
    const params: any[] = Array.isArray(info?.parameters) ? info.parameters : [];

    // type 혹은 component가 Image/File/AnnotatedImage 계열인 것을 우선 탐색
    const imageCandidate = params.find(
      (p) =>
        /image/i.test(p?.type ?? "") ||
        /image/i.test(p?.component ?? "") ||
        /image/i.test(p?.label ?? "") ||
        /image/i.test(p?.name ?? "")
    );

    if (imageCandidate?.name) return imageCandidate.name as string;
  } catch {
    // view 실패 시 바로 휴리스틱으로
  }

  // 2) 휴리스틱 키 후보군 (모델/데모마다 이름이 제각각)
  const FALLBACKS = ["user_image", "pil_image", "image", "img", "input_image", "file", "media"];
  return FALLBACKS[0]; // 우선 user_image로 시도 (이번 에러가 user_image를 요구)
}

/** POST /api/ai/waste/analyze */
export async function POST(req: NextRequest) {
  try {
    const imageBlob = await readImageBlob(req);

    // Gradio 연결
    const client = await Client.connect(GRADIO_BASE);

    // 실제 이미지 파라미터 키 확인 (예: user_image / pil_image / image ...)
    const imageKey = await findImageParamName(client, GRADIO_ENDPOINT);

    // 페이로드 구성
    const payload: Record<string, unknown> = { [imageKey]: imageBlob };

    // 예) 추가 필드가 꼭 필요한 경우(기본값 없고 required)라면 여기서 넣어줘야 함.
    // payload["top_k"] = 3  처럼…

    // 호출
    const result = await client.predict(GRADIO_ENDPOINT, payload as any);

    const parsed = parseGradioResult(result?.data);

    return NextResponse.json(
      {
        ok: true,
        score5: parsed.score5 ?? null,
        score100: parsed.score100 ?? (parsed.score5 != null ? Math.round((parsed.score5 / 5) * 100) : null),
        summary: parsed.summary ?? null,
        raw: result?.data,
        usedParam: imageKey, // 디버깅에 도움
      },
      { status: 200 }
    );
  } catch (err: any) {
    // Gradio가 "No value provided for required parameter: X" 라고 줄 때 가독성 향상
    const msg = String(err?.message ?? err);
    const nicer =
      /No value provided for required parameter/i.test(msg)
        ? `${msg}  → 라우트에서 이미지 파라미터 키가 달라진 것 같습니다. GRADIO_ENDPOINT의 입력 이름을 확인하세요.`
        : msg;

    return NextResponse.json({ ok: false, error: nicer }, { status: 500 });
  }
}