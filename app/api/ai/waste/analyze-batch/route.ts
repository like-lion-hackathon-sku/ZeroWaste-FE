// app/api/ai/waste/analyze-batch/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@gradio/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRADIO_BASE = "https://5ed0df4846238b1cea.gradio.live"; // 네 Space 주소
const GRADIO_ENDPOINT = process.env.GRADIO_ENDPOINT ?? "/predict";

/** 클라이언트가 원하는 최종 응답 스키마 */
type PerMenu = {
  name: string;
  count: number;
  avg_leftover: number;
  worst_samples?: string[];
  best_samples?: string[];
  insight?: string;
};
type Overall = {
  total_records: number;
  weighted_score_100: number;
  summary: string;
  actions?: string[];
};
type BatchAnalysis = {
  per_menu: PerMenu[];
  overall: Overall;
};

function round1(n: number) { return Math.round(n * 10) / 10; }
function round0(n: number) { return Math.round(n); }

function safeParseJSON(s: unknown): any | null {
  if (typeof s !== "string") return null;
  try { return JSON.parse(s); } catch { return null; }
}

/** Gradio 호출: JSON 입력 파라미터를 찾아 전달 */
async function callGradioJson(base: string, endpoint: string, data: any) {
  const client = await Client.connect(base, { hf_token: undefined });
  const api = await client.view_api();

  const named = api.named_endpoints ?? {};

  // 실제 predict()에 넣을 경로 문자열 결정
  let path = endpoint;
  if (!named[endpoint]) {
    const firstKey = Object.keys(named)[0];
    if (!firstKey) throw new Error("Gradio endpoint not found");
    path = firstKey; // ex) "/predict"
  }

  // 해당 엔드포인트의 메타
  const ep: any = named[path];
  if (!ep) throw new Error("Gradio endpoint meta not found");

  // JSON/텍스트 파라미터 키 탐색
  const preferred = ["json_data", "json", "data", "text", "input", "prompt"];
  const param: any =
    ep.parameters?.find((p: any) =>
      preferred.includes(String(p?.parameter_name ?? p?.name ?? "").toLowerCase())
    ) ??
    ep.parameters?.find((p: any) =>
      /json|text|input/i.test(String(p?.label ?? p?.parameter_name ?? ""))
    );

  if (!param) throw new Error("적절한 JSON 파라미터를 찾지 못했습니다.");

  const key = String((param as any).parameter_name ?? (param as any).name ?? "json_data");

  // payload 생성
  const payload: Record<string, any> = {};
  payload[key] = typeof data === "string" ? data : JSON.stringify(data);

  // 나머지 파라미터 기본값 채우기
  (ep.parameters ?? []).forEach((p: any) => {
    const name = String(p?.parameter_name ?? p?.name ?? "");
    if (!name || (name in payload)) return;

    const comp = String(p?.component ?? "").toLowerCase();
    if (comp.includes("checkbox")) payload[name] = false;
    else if (comp.includes("slider")) payload[name] = p?.value ?? 0;
    else payload[name] = null;
  });

  // ✅ ep.path 대신 우리가 확정한 path 문자열 사용
  return await client.predict(path, payload);
}

/** 모델 원본 → 우리 스키마로 정규화 */
function normalizeToSchema(raw: any): BatchAnalysis {
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
    const body = await req.json();
    if (!Array.isArray(body)) {
      throw new Error("Body must be an array of day objects.");
    }

    const result = await callGradioJson(GRADIO_BASE, GRADIO_ENDPOINT, body);

    const data = (result as any)?.data ?? result;
    let candidate: any = data;
    if (Array.isArray(data)) {
      const texts = data.filter((x) => typeof x === "string") as string[];
      candidate = texts.sort((a, b) => b.length - a.length)[0]
        ?? data.find((x) => typeof x === "object")
        ?? data[0];
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