// app/api/ai/waste/analyze/route.ts
import { NextRequest, NextResponse } from "next/server"
import { Client } from "@gradio/client"
import { Buffer } from "node:buffer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GRADIO_BASE = process.env.GRADIO_BASE ?? process.env.GRADIO_HOST ?? ""
const GRADIO_ENDPOINT = process.env.GRADIO_ENDPOINT ?? "/predict"

async function toNodeFile(src: Blob | File, name = "upload.jpg", type?: string) {
  const ab = await src.arrayBuffer()
  const buf = Buffer.from(ab)
  return new File([buf], name, { type: type || (src as any).type || "image/jpeg" })
}

// Gradio 헬스 체크(명확한 에러 메시지를 위해)
async function ensureGradioAlive(base: string) {
  const u = base.replace(/\/+$/, "")
  const r = await fetch(`${u}/config`, { cache: "no-store" })
  if (!r.ok) throw new Error(`Gradio config 응답 오류 ${r.status}`)
}

export async function POST(req: NextRequest) {
  try {
    if (!GRADIO_BASE) throw new Error("GRADIO_BASE(.env) 미설정")

    const ct = req.headers.get("content-type") || ""
    let file: File | null = null
    let imageUrl: string | null = null
    let menuName: string | null = null

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData()
      const f = form.get("image")
      if (f instanceof File) file = f
      const url = form.get("imageUrl")
      if (typeof url === "string" && url.trim()) imageUrl = url.trim()
      const mn = form.get("menuName")
      if (typeof mn === "string" && mn.trim()) menuName = mn.trim()
    } else {
      const json = await req.json().catch(() => ({}))
      if (json?.imageUrl && typeof json.imageUrl === "string") imageUrl = json.imageUrl.trim()
      if (json?.menuName && typeof json.menuName === "string") menuName = json.menuName.trim()
    }

    if (!file && !imageUrl) {
      return NextResponse.json({ ok: false, error: "image 또는 imageUrl 필요" }, { status: 400 })
    }

    // 1) 헬스 체크 & 연결
    await ensureGradioAlive(GRADIO_BASE)
    const client = await Client.connect(GRADIO_BASE)
    const rootUrl =
      (client as any).config?.root ??
      (client as any).api_url ??
      GRADIO_BASE

    // 2) Gradio 쪽 입력 준비(파일 업로드)
    let input: Record<string, any> = {}

    if (file) {
      const nodeFile = await toNodeFile(file, (file as any).name || "upload.jpg", (file as any).type || "image/jpeg")
      const uploadedArr = await (client as any).upload([{ data: nodeFile, path: nodeFile.name }], rootUrl)
      const uploaded = Array.isArray(uploadedArr) ? uploadedArr[0] : uploadedArr
      input = { pil_image: uploaded }
    } else if (imageUrl) {
      // 공개 URL을 받아 파일처럼 업로드
      const res = await fetch(imageUrl, { cache: "no-store" })
      if (!res.ok) throw new Error(`이미지 URL 요청 실패(${res.status})`)
      const blob = await res.blob()
      const name = imageUrl.split("/").slice(-1)[0] || "image.jpg"
      const nodeFile = await toNodeFile(blob, name, blob.type || "image/jpeg")
      const uploadedArr = await (client as any).upload([{ data: nodeFile, path: name }], rootUrl)
      const uploaded = Array.isArray(uploadedArr) ? uploadedArr[0] : uploadedArr
      input = { pil_image: uploaded }
    }

    // (옵션) 모델이 메뉴명을 받는 구조면 전달
    if (menuName) (input as any).menu_name = menuName

    // 3) 예측 호출
    const result = await client.predict(GRADIO_ENDPOINT, input)

    // 4) 응답 파싱 (모델 포맷에 맞춰 유연하게)
    let score: number | null = null
    let summary: string | null = null

    if (result && typeof result === "object" && "score" in (result as any) && "summary" in (result as any)) {
      score = Number((result as any).score)
      summary = String((result as any).summary ?? "")
    } else if (Array.isArray((result as any)?.data)) {
      const data = (result as any).data
      if (data.length === 2 && typeof data[0] === "number" && typeof data[1] === "string") {
        score = Number(data[0])
        summary = String(data[1])
      } else if (data.length >= 1 && typeof data[0] === "object") {
        const obj = data[0] as any
        if ("score" in obj) score = Number(obj.score)
        if ("summary" in obj) summary = String(obj.summary ?? "")
      }
    }

    if (score == null) {
      return NextResponse.json({ ok: false, error: "Gradio 응답 파싱 실패", raw: result }, { status: 502 })
    }

    return NextResponse.json({ ok: true, score, summary })
  } catch (e: any) {
    console.error("[ai/analyze:error]", e)
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 })
  }
}