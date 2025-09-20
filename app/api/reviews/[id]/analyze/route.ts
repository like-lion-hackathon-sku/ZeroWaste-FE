// app/api/reviews/[id]/analyze/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { Client } from "@gradio/client";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRADIO_HOST = process.env.GRADIO_HOST ?? "https://c3abdff47bad24a110.gradio.live";
const GRADIO_API = "/predict";

async function toNodeFile(src: Blob | File, name = "upload.jpg", type?: string) {
  const ab = await src.arrayBuffer();
  const buf = Buffer.from(ab);
  return new File([buf], name, { type: type || (src as any).type || "image/jpeg" });
}

type GradioFileData = { data: File | Blob; path: string; meta?: any };

/** 헬스 체크: gradio host가 살아있는지 빠르게 확인 */
async function ensureGradioAlive(base: string) {
  try {
    const u = base.replace(/\/+$/, "");
    // gradio는 /config 또는 /info가 보통 열려 있음
    const res = await fetch(`${u}/config`, { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error(`config ${res.status}`);
    return true;
  } catch (e: any) {
    throw new Error(`Gradio 호스트(${base})에 연결할 수 없습니다: ${e?.message || "unknown"}`);
  }
}

/** 상대경로라면 절대 URL로 바꾸고, 필요시 쿠키/헤더를 넘겨 fetch */
async function fetchImageAsBlob(req: NextRequest, urlOrPath: string): Promise<{ blob: Blob; name: string; type: string }> {
  let imgUrl = urlOrPath.trim();
  const isAbsolute = /^https?:\/\//i.test(imgUrl);
  if (!isAbsolute) {
    // 같은 호스트 절대 URL로 변환
    imgUrl = `${req.nextUrl.origin}${imgUrl.startsWith("/") ? imgUrl : `/${imgUrl}`}`;
  }

  const headers: HeadersInit = {};
  // BE 프록시(/_be) 등 인증이 걸린 경우 쿠키 전달
  // (쿠키가 없어도 무해)
  const cookie = req.headers.get("cookie");
  if (cookie) (headers as any).cookie = cookie;

  const res = await fetch(imgUrl, { headers, cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`이미지 URL 요청 실패 (${res.status}) ${txt.slice(0, 200)}`);
  }
  const blob = await res.blob();
  const type = blob.type || "image/jpeg";
  // 파일명 추정
  const name = imgUrl.split("/").slice(-1)[0] || "image.jpg";
  return { blob, name, type };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ct = req.headers.get("content-type") || "";

    let file: File | null = null;
    let imageUrl: string | null = null;
    let menuName: string | null = null;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const f = form.get("image");
      if (f instanceof File) file = f as File;

      const url = form.get("imageUrl");
      if (typeof url === "string" && url.trim()) imageUrl = url.trim();

      const mn = form.get("menuName");
      if (typeof mn === "string" && mn.trim()) menuName = mn.trim();
    } else {
      const json = await req.json().catch(() => ({}));
      if (json?.imageUrl && typeof json.imageUrl === "string") imageUrl = json.imageUrl.trim();
      if (json?.menuName && typeof json.menuName === "string") menuName = json.menuName.trim();
    }

    if (!file && !imageUrl) {
      return NextResponse.json(
        { ok: false, error: "image 또는 imageUrl이 필요합니다." },
        { status: 400 },
      );
    }

    // 1) Gradio 헬스 체크 (죽은 호스트면 여기서 명확한 메시지로 실패)
    await ensureGradioAlive(GRADIO_HOST);

    // 2) Gradio 연결
    const client = await Client.connect(GRADIO_HOST);
    const rootUrl =
      (client as any).config?.root ??
      (client as any).api_url ??
      GRADIO_HOST;

    // 3) 업로드 준비 (반드시 Node File 로 포맷 맞추기)
    let input: Record<string, any> = {};

    if (file) {
      const nodeFile = await toNodeFile(
        file,
        (file as any).name || "upload.jpg",
        (file as any).type || "image/jpeg",
      );
      const files: GradioFileData[] = [{ data: nodeFile, path: nodeFile.name }];
      const uploadedArr = (await (client as any).upload(files, rootUrl)) as any[];
      const uploaded = Array.isArray(uploadedArr) ? uploadedArr[0] : uploadedArr;
      input = { pil_image: uploaded };
    } else if (imageUrl) {
      // 내부 프록시(/_be) 등 상대경로를 절대 URL로 변환 + 쿠키 전달
      const { blob, name, type } = await fetchImageAsBlob(req, imageUrl);
      const nodeFile = await toNodeFile(blob, name, type);
      const files: GradioFileData[] = [{ data: nodeFile, path: name }];
      const uploadedArr = (await (client as any).upload(files, rootUrl)) as any[];
      const uploaded = Array.isArray(uploadedArr) ? uploadedArr[0] : uploadedArr;
      input = { pil_image: uploaded };
    }

    // (옵션) 모델이 메뉴명을 받으면 여기에 넣으세요.
    // input.menu_name = menuName;

    // 4) 예측 호출
    const result = await client.predict(GRADIO_API, input);

    // 5) 응답 파싱
    let score: number | null = null;
    let summary: string | null = null;

    if (result && typeof result === "object" && "score" in (result as any) && "summary" in (result as any)) {
      score = Number((result as any).score);
      summary = String((result as any).summary ?? "");
    } else if (Array.isArray((result as any)?.data)) {
      const data = (result as any).data;
      if (data.length === 2 && typeof data[0] === "number" && typeof data[1] === "string") {
        score = Number(data[0]);
        summary = String(data[1]);
      } else if (data.length >= 1 && typeof data[0] === "object") {
        const obj = data[0] as any;
        if ("score" in obj) score = Number(obj.score);
        if ("summary" in obj) summary = String(obj.summary ?? "");
      }
    }

    if (score == null) {
      return NextResponse.json(
        { ok: false, error: "Gradio 응답 파싱 실패", raw: result },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      reviewId: params.id,
      score,   // 0~5 가정
      summary, // 문자열
    });
  } catch (e: any) {
    console.error("[analyze:error]", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
