import { NextResponse, type NextRequest } from "next/server";
export const dynamic = "force-dynamic";

type Review = {
  id: number;
  restaurant?: { id?: number; name: string; category?: string | null };
  waste_rating: number; // 0~5
  comment: string;
  created_at?: string | null;
};

const seed: Review[] = [
  {
    id: 1,
    restaurant: { id: 101, name: "그린테이블", category: "한식" },
    waste_rating: 4.2,
    comment: "양이 딱 적당해서 잔반 없이 잘 먹었습니다!",
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    restaurant: { id: 202, name: "제로웨이스트 카페", category: "카페" },
    waste_rating: 3.6,
    comment: "머그 컵 제공이 좋아요.",
    created_at: new Date().toISOString(),
  },
];

const KEY = "__mock_review_db__";
const db: Map<number, Review> =
  (globalThis as any)[KEY] || ((globalThis as any)[KEY] = new Map(seed.map((r) => [r.id, r])));

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const data = db.get(id);
  if (!data) return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const existing = db.get(id);
  if (!existing) return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => ({} as any));
  if (typeof body.comment === "string") existing.comment = body.comment;
  if (typeof body.waste_rating === "number") {
    existing.waste_rating = Math.max(0, Math.min(5, Number(body.waste_rating)));
  }

  db.set(id, existing);
  return NextResponse.json({ success: true, data: existing });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const ok = db.delete(id);
  if (!ok) return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ success: true });
}
