import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@gradio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRADIO_BASE = "https://5ed0df4846238b1cea.gradio.live";
const GRADIO_ENDPOINT = process.env.GRADIO_ENDPOINT ?? "/predict";

/** 클라이언트가 원하는 최종 응답 스키마 */
type PerMenu = {
  name: string;
  count: number;              // 등장 횟수
  avg_leftover: number;       // 0~5 평균 (소수1자리)
  worst_samples?: string[];   // 잔반이 높았던 코멘트 예시
  best_samples?: string[];    // 잔반이 낮았던 코멘트 예시
  insight?: string;           // 간단 인사이트
};
type Overall = {
  total_records: number;
  weighted_score_100: number; // 0~100 (소수0자리)
  summary: string;            // 한 줄 요약
  actions?: string[];         // 개선 액션 3~5개
};
type BatchAnalysis = {
  per_menu: PerMenu[];
  overall: Overall;
};

function round1(n: number) { return Math.round(n * 10) / 10; }
function round0(n: number) { return Math.round(n); }

/** 입력 JSON 검증 & 문자열 프롬프트 생성 */
async function readAndBuildPrompt(req: NextRequest): Promise<string> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.startsWith("application/json")) {
    throw new Error("Content-Type must be application/json");
  }
  const body = await req.json();
  if (!Array.isArray(body)) {
    throw new Error("Body must be an array of day objects.");
  }

  // 사용자가 붙여넣는 예시 구조:
  // [{ date, time, food_menu: [{name, leftover_score, user_comment}] }, ...]
  // 그대로 프롬프트에 포함시키되, 작업지시를 명확히.
  return [
    "다음은 급식/식당의 잔반 데이터입니다. JSON을 읽고 아래 형식으로 분석하세요.",
    "",
    "요구 형식(JSON):",
    JSON.stringify({
      per_menu: [
        { name: "예: 된장찌개", count: 0, avg_leftover: 0.0, worst_samples: [], best_samples: [], insight: "" }
      ],
      overall: {
        total_records: 0,
        weighted_score_100: 0,
        summary: "",
        actions: ["액션1", "액션2", "액션3"]
      }
    }, null, 2),
    "",
    "규칙:",
    "- leftover_score는 0~5로 가정(높을수록 잔반이 많음).",
    "- per_menu.avg_leftover는 소수 1자리, overall.weighted_score_100은 0~100 정수로 제시.",
    "- worst/best_samples에는 원문 user_comment 예시를 최대 2개 씩.",
    "- actions는 구체적인 개선안 3~5개.",
    "- 응답은 반드시 위 JSON 스키마로만 출력하세요(설명문 금지).",
    "",
    "데이터(JSON):",
    JSON.stringify(body, null, 2),
  ].join("\n");
}

/** Gradio 호출: 텍스트 입력 키 여러 가지를 순차 시도 */
async function callGradioText(base: string, endpoint: string, text: string) {
  const client = await Client.connect(base, { hf_token: undefined });
  const candidates: Record<string, any>[] = [
    { text }, { input: text }, { prompt: text }, { message: text }, { inputs: text },
  ];
  let lastErr: any;
  for (const payload of candidates) {
    try {
      return await client.predict(endpoint, payload);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Gradio 호출 실패");
}

/** 모델이 문자열로 JSON을 돌려줄 때 파싱 */
function safeParseJSON(s: unknown): any | null {
  if (typeof s !== "string") return null;
  try { return JSON.parse(s); } catch { return null; }
}

/** 모델 원본 → 우리 스키마로 정규화(최대한 보정) */
function normalizeToSchema(raw: any): BatchAnalysis {
  // raw가 문자열(JSON)일 수 있음
  const obj = typeof raw === "string" ? safeParseJSON(raw) : raw;

  const per_menu_raw: any[] = Array.isArray(obj?.per_menu) ? obj.per_menu : [];
  const per_menu: PerMenu[] = per_menu_raw.map((m) => ({
    name: String(m?.name ?? ""),
    count: Number(m?.count ?? 0),
    avg_leftover: round1(Number(m?.avg_leftover ?? 0)),
    worst_samples: Array.isArray(m?.worst_samples) ? m.worst_samples.slice(0, 2).map(String) : undefined,
    best_samples: Array.isArray(m?.best_samples) ? m.best_samples.slice(0, 2).map(String) : undefined,
    insight: typeof m?.insight === "string" ? m.insight : undefined,
  })).filter((x) => x.name);

  const overall_raw = obj?.overall ?? {};
  const overall: Overall = {
    total_records: Number(overall_raw?.total_records ?? 0),
    weighted_score_100: round0(Number(overall_raw?.weighted_score_100 ?? 0)),
    summary: String(overall_raw?.summary ?? ""),
    actions: Array.isArray(overall_raw?.actions) ? overall_raw.actions.map(String).slice(0, 5) : undefined,
  };

  return { per_menu, overall };
}

/** POST /api/ai/waste/analyze-batch */
export async function POST(req: NextRequest) {
  try {
    const prompt = await readAndBuildPrompt(req);
    const result = await callGradioText(GRADIO_BASE, GRADIO_ENDPOINT, prompt);

    // Gradio의 result.data는 환경마다 배열/문자열/객체 등 다양함
    const data = (result as any)?.data;
    // 1) 문자열 JSON -> 파싱, 2) 객체면 그대로 시도, 3) 배열이면 가장 긴 문자열/객체 선택
    let candidate: any = data;
    if (Array.isArray(data)) {
      // 문자열 JSON이 섞여 있으면 그중 가장 긴 것
      const texts = data.filter((x) => typeof x === "string") as string[];
      const bestText = texts.sort((a, b) => b.length - a.length)[0];
      candidate = bestText ?? data.find((x) => typeof x === "object") ?? data[0];
    }

    const normalized = normalizeToSchema(candidate);

    return NextResponse.json(
      { ok: true, status: "분석 완료", result: normalized, raw: data },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, status: "분석 실패", error: err?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}