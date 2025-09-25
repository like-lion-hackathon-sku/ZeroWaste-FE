"use client"

import { useCallback, useEffect, useState } from "react"
import { apiClient } from "@/lib/api/client"

/* ================== 공용 타입 ================== */
export type DetailKey = "맛" | "양" | "서비스" | "청결" | "분위기"
export type DetailChip = { key: DetailKey; value: string }
export const KEY_LABELS: DetailKey[] = ["맛", "양", "서비스", "청결", "분위기"]

export type RestaurantLite = { id: number; name: string; category?: string | null; address?: string | null; telephone?: string | null }
export type FavoriteItem = { id?: number; restaurant_id: number | null; restaurant?: RestaurantLite }
export type ReviewVM = { id: number | string; restaurant?: { id: number; name: string; category?: string | null }; waste_rating: number; comment: string; created_at?: string | null }

export type RestaurantStamp = { restaurantId: number | null; restaurantName: string; totalStamps: number; maxStamps: number; uiKey: number }
export type StampHistoryVM = { id: number | string; restaurantId: number; restaurantName: string; type: "earn" | "use"; count: number; created_at?: string | null }

export type OwnerRestaurant = { id: number; name: string; category?: string | null; address?: string | null; telephone?: string | null; rating?: number; reviewCount?: number }

/* ================== 공용 유틸 ================== */
export const toArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : (v?.items ?? v?.success?.items ?? []))
export function stringHash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0 } return Math.abs(h) || 1 }
export const pickData = <T,>(r: any): T => (r?.data ?? r?.success?.data ?? r)

export function extractDetailChips(comment: string) {
  if (!comment) return [] as DetailChip[]
  const chips: DetailChip[] = []
  const text = comment.replace(/\n+/g, " ").trim()
  KEY_LABELS.forEach((k) => {
    const m = text.match(new RegExp(`${k}\\s*[:：]\\s*([^/\\]\\|]+)`, "i"))
    if (m?.[1]) chips.push({ key: k, value: m[1].trim() })
  })
  if (chips.length === 0) {
    KEY_LABELS.forEach((k) => {
      const m = text.match(new RegExp(`\\[\\s*${k}\\s*\\]\\s*([^/\\]|]+)`, "i"))
      if (m?.[1]) chips.push({ key: k, value: m[1].trim() })
    })
  }
  const seen = new Set<string>()
  return chips.filter((c) => { const key = `${c.key}:${c.value}`; if (seen.has(key)) return false; seen.add(key); return true })
}

export function toFavoriteItem(f: any): FavoriteItem {
  const restaurant_id = f?.restaurant_id ?? f?.restaurantId ?? f?.restaurant?.id ?? null
  const restaurant: RestaurantLite | undefined =
    f?.restaurant ??
    (f?.name ? { id: restaurant_id as number, name: f.name, category: f.category ?? null, address: f.address ?? null, telephone: f.telephone ?? null } : undefined)
  return { id: f?.id, restaurant_id, restaurant }
}

/* ================== 훅: 아바타 URL ================== */
export const useAvatarSrc = (raw?: string | null) => {
  const [avatarSrc, setAvatarSrc] = useState<string>("/placeholder.svg")
  useEffect(() => {
    let ignore = false
    ;(async () => {
      if (!raw) { setAvatarSrc("/placeholder.svg"); return }
      if (/^https?:\/\//i.test(raw)) { if (!ignore) setAvatarSrc(raw); return }
      const signed = await apiClient.getImageSignedUrl(0, raw).catch(() => "")
      const fallback = apiClient.getImageUrlByType(0, raw)
      if (!ignore) setAvatarSrc(signed || fallback)
    })()
    return () => { ignore = true }
  }, [raw])
  return avatarSrc
}

/* ================== 훅: 스탬프 목록 ================== */
export const useUserStampsData = () => {
  const [stamps, setStamps] = useState<RestaurantStamp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiClient.getUserStamps()
      if (!res?.success) throw new Error(res?.error || "failed")
      const raw = Array.isArray(res.data) ? res.data : (res as any)?.data?.stamps ?? []
      const out: RestaurantStamp[] = raw.map((r: any) => {
        const name = String(r.restaurant ?? r.restaurantName ?? "")
        const realId = Number(r.restaurantId ?? r.restaurant_id)
        const hasRealId = Number.isFinite(realId) && realId > 0
        const count = Number(r.count ?? 0)
        return { restaurantId: hasRealId ? realId : null, restaurantName: name, totalStamps: Math.max(0, count), maxStamps: 5, uiKey: hasRealId ? realId : stringHash(name) }
      })
      setStamps(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load stamps")
      setStamps([])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refetch() }, [refetch])
  return { stamps, loading, error, refetch }
}

/* ================== 훅: 스탬프 히스토리 ================== */
export const useUserStampHistory = () => {
  const [items, setItems] = useState<StampHistoryVM[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await apiClient.getUserStampHistory()
      if (!res?.success) throw new Error(res?.error || "failed")
      const r: any = res as any
      const rowsRaw =
        (Array.isArray(r.data) ? r.data : undefined) ??
        r.data?.histories ??
        r.success?.histories ??
        r.histories ?? []
      const rows: any[] = Array.isArray(rowsRaw) ? rowsRaw : []
      const mapped: StampHistoryVM[] = rows.map((r: any): StampHistoryVM => {
        const name: string = String(r?.restaurant?.name ?? r?.restaurant ?? r?.restaurantName ?? "식당")
        const ridRaw = Number(r?.restaurant_id ?? r?.restaurantId ?? 0)
        const rid = Number.isFinite(ridRaw) && ridRaw > 0 ? ridRaw : stringHash(name)
        const typeBE = String(r?.type ?? "").toUpperCase()
        const isUse = typeBE === "USED" || !!(r?.used_at ?? r?.expiredAt)
        return {
          id: String(r?.id ?? `${rid}-${r?.at ?? r?.created_at ?? Math.random()}`),
          restaurantId: rid,
          restaurantName: name,
          type: isUse ? "use" : "earn",
          count: Number(r?.count ?? r?.condition ?? 1),
          created_at: r?.created_at ?? r?.createdAt ?? r?.acquiredAt ?? r?.expiredAt ?? r?.at ?? null,
        }
      })
      mapped.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      setItems(mapped)
    } catch (e) {
      setItems([]); setError(e instanceof Error ? e.message : "failed to load history")
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refetch() }, [refetch])
  return { items, loading, error, refetch }
}

/* ================== 훅: 사업자 식당 목록 ================== */
export const useOwnerRestaurants = () => {
  const [ownerRestaurants, setOwnerRestaurants] = useState<OwnerRestaurant[]>([])
  useEffect(() => {
    let ignore = false
    ;(async () => {
      try {
        const res = await apiClient.getBusinessRestaurants()
        if (!res.success) throw new Error(res.error || "목록 로드 실패")
        const data = (res.data ?? []) as any
        const list: any[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
        const norm: OwnerRestaurant[] = list.map((r: any) =>
          (["id","name","category","address","telephone","rating","reviewCount"] as const)
            .reduce((acc,k)=>({...acc,[k]: r?.[k]}), {} as OwnerRestaurant)
        ) as any
        if (!ignore) setOwnerRestaurants(norm)
      } catch (e) {
        console.error(e)
        if (!ignore) setOwnerRestaurants([])
      }
    })()
    return () => { ignore = true }
  }, [])
  return { ownerRestaurants, setOwnerRestaurants }
}
