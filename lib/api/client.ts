// lib/api/client.ts
import type { ApiResponse } from "@/lib/types/database"

/** ─────────────────────────────────────────────────────────
 * 공통: 토큰 자동 갱신(401 시 1회) + 응답 정규화
 * - FE 기본 프록시: "/_be"  → 실제로는 {BE_ORIGIN}/api 로 전달됨
 * - FormData 보낼 때는 Content-Type 수동 지정 금지
 * - BE 응답이 { resultType, success, error } 형태여도 FE 표준으로 맞춰 반환
 ────────────────────────────────────────────────────────── */

export type Stamp = {
  id: number
  user_id: number
  restaurant_id: number
  used_at: string | null
  acquired_at: string
}

export type StampHistoryItem = {
  id: number
  restaurant_id: number
  status?: string
  reward?: string | null
  used_at?: string | null
  acquired_at?: string | null
  [k: string]: any
}

type UpdateProfileJson = {
  nickname?: string
  defaultImage?: boolean
}

let refreshPromise: Promise<Response> | null = null

class ApiClient {
  private baseUrl: string

  constructor(baseUrl = process.env.NEXT_PUBLIC_API_URL || "/_be") {
    this.baseUrl = (baseUrl || "/_be").replace(/\/$/, "")
  }

  private buildUrl(endpoint: string) {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    return `${this.baseUrl}${path}`
  }

  /** 상대경로 → 절대경로 */
  toAbsoluteUrl(url: string) {
    if (!url) return url
    if (/^https?:\/\//i.test(url)) return url
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_SITE_ORIGIN || "")
    return origin ? `${origin}${url.startsWith("/") ? url : `/${url}`}` : url
  }

  /** 공통 요청 래퍼 */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    _retrying = false
  ): Promise<ApiResponse<T>> {
    try {
      const url = this.buildUrl(endpoint)
      const isFormData =
        typeof FormData !== "undefined" && options.body instanceof FormData

      const headers: HeadersInit = { ...(options.headers || {}) }
      if (!isFormData) {
        if (!("Content-Type" in headers))
          (headers as Record<string, string>)["Content-Type"] = "application/json"
        if (!("Accept" in headers))
          (headers as Record<string, string>)["Accept"] = "application/json"
      }

      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        ...options,
        headers,
      })

      // 401 → refresh 1회 시도
      if (res.status === 401 && !_retrying) {
        if (!refreshPromise) {
          refreshPromise = fetch(this.buildUrl("/auth/refresh"), {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }).finally(() => {
            refreshPromise = null
          })
        }
        const rr = await refreshPromise
        if (rr?.ok) {
          return this.request<T>(endpoint, options, true)
        }
      }

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "")
        let message = res.statusText
        try {
          const j = bodyText ? JSON.parse(bodyText) : {}
          message = (j as any)?.message || (j as any)?.error || message
          console.error("[API 4xx/5xx]", res.status, j)
        } catch {
          console.error("[API 4xx/5xx]", res.status, bodyText)
        }
        return { success: false, error: `HTTP ${res.status}: ${message}` } as ApiResponse<T>
      }

      const text = await res.text()
      let data: any = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { success: true, data: text }
      }

      // BE → FE 표준 정규화
      if (data && typeof data === "object" && "resultType" in data) {
        const { resultType, success, error } = data as any
        if (String(resultType).toUpperCase() === "SUCCESS") {
          const inner =
            Array.isArray(success) ? success
            : Array.isArray(success?.stamps) ? success.stamps
            : Array.isArray(success?.items) ? success.items
            : success ?? null

          return { success: true, data: inner as T }
        }
        const reason = error?.reason || error?.message || "요청이 실패했어요."
        return { success: false, error: reason } as ApiResponse<T>
      }

      if (typeof data?.success === "boolean") return data as ApiResponse<T>
      return { success: true, data } as ApiResponse<T>
    } catch (error) {
      console.error("[v0] API request failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      } as ApiResponse<T>
    }
  }

  // ───────────────────────── Auth
  async login(email: string, password: string) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  }
  async logout() {
    return this.request("/auth/logout", { method: "POST" })
  }
  async signup(email: string, password: string) {
    return this.request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  }
  async refresh() {
    return this.request("/auth/refresh", { method: "POST" })
  }
  async getProfile() {
    return this.request("/auth/me", { method: "GET" })
  }

  async updateProfile(payload: FormData | UpdateProfileJson) {
    const url = "/api/profile/update" // 내부 Next 라우트 사용 시
    const res = await fetch(url, {
      method: "POST",
      ...(payload instanceof FormData
        ? { body: payload }
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
      credentials: "include",
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => "")
      return { success: false, error: msg || `HTTP ${res.status}` }
    }
    try {
      const data = await res.json()
      return typeof data?.success === "boolean" ? data : { success: true, data }
    } catch {
      return { success: true }
    }
  }

  /** multipart 그대로 전달 (BE 엔드포인트 사용 시) */
  async updateProfileMultipart(form: FormData) {
    return this.request("/auth/profile", { method: "POST", body: form })
  }

  // ───────────────────────── Restaurants
  async getRestaurants(params?: { search?: string }) {
    const q = (params?.search ?? "맛집").trim()
    return this.request(`/restaurants/nearby?q=${encodeURIComponent(q)}`)
  }

  async getRestaurantsNearby(bbox: string, limit = 20, cursor = 0) {
    const sp = new URLSearchParams()
    sp.set("bbox", bbox)
    sp.set("limit", String(limit))
    sp.set("cursor", String(cursor))
    return this.request(`/restaurants/nearby?${sp.toString()}`)
  }

  async getRestaurantsInBounds(bounds: {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
    category?: string
    search?: string
  }) {
    const q = (bounds.search ?? "맛집").trim()
    return this.request(`/restaurants/nearby?q=${encodeURIComponent(q)}`)
  }

  async getRestaurantDetail(id: number) {
    return this.request<{
      id: number
      name: string
      category: string
      address?: string
      telephone?: string
      photos?: { id: number; photo_name: string }[]
      menus?: { id: number; name: string; photo?: string }[]
    }>(`/restaurants/${id}/detail`, { method: "GET" })
  }

  async getRestaurantReviews(id: number) {
    return this.request(`/restaurants/${id}/reviews`)
  }

  /** (옵션) 일반 사용자 메뉴 목록 */
  async getRestaurantMenus(id: number) {
    return this.request<{ id: number; name: string; price?: number | null }[]>(
      `/restaurants/${id}/menu`,
      { method: "GET" }
    )
  }

  // ───────────────────────── Favorites
  async getFavorites() {
    return this.request("/favorites")
  }
  async addFavorite(restaurantId: number) {
    return this.request(`/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    })
  }
  async addFavoriteExternal(place: {
    name: string
    address: string
    mapx: number
    mapy: number
    category?: string
    telephone?: string
  }) {
    const payload = { ...place, mapx: Math.round(place.mapx), mapy: Math.round(place.mapy) }
    return this.request(`/favorites`, {
      method: "POST",
      body: JSON.stringify({ place: payload }),
    })
  }
  async removeFavorite(restaurantId: number) {
    return this.request(`/favorites/${restaurantId}`, { method: "DELETE" })
  }

  // ───────────────────────── Stamps (Swagger + ERD 일치)
  /** GET /api/stamps/me */
  async getMyStamps(params?: { restaurant_id?: number; only_unused?: boolean }) {
    const sp = new URLSearchParams()
    if (params?.restaurant_id != null) sp.set("restaurant_id", String(params.restaurant_id))
    if (params?.only_unused) sp.set("only_unused", "true")
    const qs = sp.toString() ? `?${sp.toString()}` : ""
    return this.request<Stamp[]>(`/stamps/me${qs}`, { method: "GET" })
  }

  /** GET /api/stamps/me/history */
  async getMyStampHistory(params?: { restaurant_id?: number }) {
    const sp = new URLSearchParams()
    if (params?.restaurant_id != null) sp.set("restaurant_id", String(params.restaurant_id))
    const qs = sp.toString() ? `?${sp.toString()}` : ""
    return this.request<StampHistoryItem[]>(`/stamps/me/history${qs}`, { method: "GET" })
  }

  /** POST /api/stamps/me/use → { code } */
async startUseStampForMe(payload: { restaurantId: number; condition: number }) {
  return this.request<{ code: string }>(`/stamps/me/use`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}


  /** POST /api/biz/stamps/use */
  async useStampBiz(payload: { restaurant_id: number; code: string }) {
    return this.request(`/biz/stamps/use`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  // ───────────────────────── Business APIs
  async getBusinessRestaurants() {
    return this.request("/biz/restaurants")
  }
  async createBusinessRestaurant(data: {
    name: string
    category: string
    address: string
    telephone?: string
    mapx: number
    mapy: number
  }) {
    return this.request("/biz/restaurants", { method: "POST", body: JSON.stringify(data) })
  }
  async updateBusinessRestaurant(
    id: number,
    data: { name?: string; category?: string; address?: string; telephone?: string }
  ) {
    return this.request("/biz/restaurants", {
      method: "PUT",
      body: JSON.stringify({ id, ...data }),
    })
  }
  async deleteBusinessRestaurant(restaurantId: number) {
    return this.request("/biz/restaurants", {
      method: "DELETE",
      body: JSON.stringify({ restaurantId }),
    })
  }
  async uploadViaSignedUrl(type: 0 | 1 | 2 | 3, file: File) {
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name}`
    const signed = await apiClient.request<{ url: string }>(
      `/images/${type}/${encodeURIComponent(safeName)}`
    )
    if (!signed.success || !signed.data?.url) {
      return { success: false, error: "서명 URL 발급 실패" } as ApiResponse<any>
    }
    const putRes = await fetch(signed.data.url, { method: "PUT", body: file })
    if (!putRes.ok) {
      return { success: false, error: `스토리지 업로드 실패 (${putRes.status})` } as ApiResponse<any>
    }
    return { success: true, data: { fileName: safeName } }
  }
  async getBusinessRestaurantDetail(restaurantId: number) {
    return this.request(`/biz/restaurants/${restaurantId}`)
  }
  async uploadBusinessRestaurantPhoto(restaurantId: number, file: File) {
    const fd = new FormData()
    fd.append("file", file)
    return this.request<{ id: number; fileName: string; url: string }>(
      `/biz/restaurants/${restaurantId}/photos`,
      { method: "POST", body: fd }
    )
  }
  async deleteBusinessRestaurantPhoto(restaurantId: number, photoId: number) {
    return this.request(`/biz/restaurants/${restaurantId}/photos/${photoId}`, { method: "DELETE" })
  }
  async getBusinessReviews() {
    return this.request("/biz/reviews")
  }
  async getBusinessReviewFeedback(reviewId: number) {
    return this.request(`/biz/reviews/${reviewId}/feedback`)
  }
  async getBusinessMenu(restaurantId: number) {
    return this.request<{ id: number; name: string; photo?: string }[]>(
      `/biz/restaurants/${restaurantId}/menu`,
      { method: "GET" }
    )
  }
  async getBusinessStats() {
    return this.request("/biz/stats")
  }
  async getBusinessAnalytics(period?: string) {
    const params = period ? `?period=${encodeURIComponent(period)}` : ""
    return this.request(`/biz/analytics${params}`)
  }
  async createStampReward(restaurantId: number, data: { condition: number; reward: string }) {
    return this.request("/biz/stamps/rewards", {
      method: "POST",
      body: JSON.stringify({ restaurant_id: restaurantId, ...data }),
    })
  }
  async updateStampReward(rewardId: number, data: { condition?: number; reward?: string }) {
    return this.request(`/biz/stamps/rewards/${rewardId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }
  async deleteStampReward(rewardId: number) {
    return this.request(`/biz/stamps/rewards/${rewardId}`, { method: "DELETE" })
  }

  // ───────────────────────── Reviews
  /** POST /api/reviews/restaurants/{id} */
  async createReviewForRestaurant(
    restaurantId: number,
    payload: { content: string; score: number; images?: string[] }
  ) {
    const body = {
      content: payload.content,
      score: payload.score,
      images: Array.isArray(payload.images) ? payload.images : [],
    }
    return this.request(`/reviews/restaurants/${restaurantId}`, {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async updateReview(id: number, data: { contents?: string; score?: number }) {
    return this.request(`/reviews/${id}`, { method: "PUT", body: JSON.stringify(data) })
  }

  async deleteReview(id: number) {
    return this.request(`/reviews/${id}`, { method: "DELETE" })
  }

  async getUserReviews() {
    return this.request(`/reviews/me`)
  }

  /** (옵션) 분석 라우트 존재 시 */
  async analyzeReview(id: number, form?: FormData) {
    if (form) return this.request(`/reviews/${id}/analyze`, { method: "POST", body: form })
    return this.request(`/reviews/${id}/analyze`, { method: "POST" })
  }

  async analyzeWasteBatch(payload: any) {
    const res = await fetch("/api/ai/waste/analyze-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) {
      return { success: false, error: data?.error || `HTTP ${res.status}` } as ApiResponse<any>
    }
    return { success: true, data: data.result } as ApiResponse<any>
  }

  // ───────────────────────── Images (presigned URL + 분석)
  private async fetchPresignedUrl(fileType: 0 | 1 | 2 | 3, fileName: string): Promise<string | null> {
    if (!fileName) return null
    const res = await this.request<{ url: string }>(
      `/images/${fileType}/${encodeURIComponent(fileName)}`
    )
    if (!res?.success) return null
    const url = (res.data as any)?.url
    return typeof url === "string" && url.length > 0 ? url : null
  }
  async getProfileImageUrl(fileName: string) {
    return this.fetchPresignedUrl(0, fileName)
  }
  async getReviewImageUrl(fileName: string) {
    return this.fetchPresignedUrl(1, fileName)
  }
  async getRestaurantImageUrl(fileName: string) {
    return this.fetchPresignedUrl(2, fileName)
  }
  async getMenuImageUrl(fileName: string) {
    return this.fetchPresignedUrl(3, fileName)
  }

  /** (구버전 경로 문자열만 반환 — presigned URL 사용 권장) */
  getImageUrl(imageType: "profile" | "review" | "restaurant", fileName: string) {
    return this.buildUrl(`/images/${encodeURIComponent(imageType)}/${encodeURIComponent(fileName)}`)
  }
  getImageUrlByType(type: 0 | 1 | 2 | 3, fileName: string) {
    return this.buildUrl(`/images/${type}/${encodeURIComponent(fileName)}`)
  }

  async uploadImage(imageType: "profile" | "review", file: File) {
    const fd = new FormData()
    fd.append("file", file)
    return this.request<{ ok: boolean; type: string; fileName: string; url: string }>(
      `/images/${encodeURIComponent(imageType)}/upload`,
      { method: "POST", body: fd }
    )
  }

  async analyzeImage(imageType: "profile" | "review", fileName: string) {
    return this.request(
      `/images/${encodeURIComponent(imageType)}/${encodeURIComponent(fileName)}/analyze`,
      { method: "POST" }
    )
  }

  async getImageSignedUrl(type: 0 | 1 | 2 | 3, fileName: string): Promise<string> {
    const res = await this.request<{ url: string }>(
      `/images/${type}/${encodeURIComponent(fileName)}`,
      { method: "GET" }
    )
    return res?.success ? ((res.data as any)?.url ?? "") : ""
  }

  /** 우리 Next API(Gradio 프록시)를 통해 공개 이미지 URL 분석 */
  async analyzeWasteByPublicUrl(imageUrl: string) {
    const abs = this.toAbsoluteUrl(imageUrl)
    const res = await fetch("/api/ai/waste/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: abs }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.ok) {
      return { success: false, error: data?.error || `AI analyze failed (${res.status})` } as ApiResponse<any>
    }
    return { success: true, data } as ApiResponse<any>
  }

  // ───────────────────────── Search
  async searchRestaurants(query: string, filters?: { category?: string; location?: string }) {
    const params = new URLSearchParams()
    params.set("q", query)
    if (filters?.category) params.set("category", filters.category)
    if (filters?.location) params.set("location", filters.location)
    return this.request(`/restaurants/search?${params.toString()}`)
  }

  // ───────────────────────── User Profile Extras
  async getUserStats() {
    return this.request("/auth/stats")
  }
  async deleteAccount() {
    return this.request("/auth/delete", { method: "DELETE" })
  }
}

// 싱글턴 인스턴스
export const apiClient = new ApiClient()
