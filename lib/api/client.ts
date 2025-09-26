// lib/api/client.ts — FINAL
import type { ApiResponse } from "@/lib/types/database"

/*
  ✅ Improvements
  - AbortController timeout (15s)
  - 401 refresh retry once; if still fails → { success:false, error:"AUTH_EXPIRED" }
  - Retry on 429/503/504 with simple backoff (once)
  - GET 요청 시 Content-Type 자동 미설정
  - createReviewForRestaurant: 오버로드 + 타입가드 (FormData/JSON 모두 지원)
*/

type UpdateProfileJson = {
  nickname?: string
  defaultImage?: boolean
}

type ReviewCreateJsonPayload = {
  content: string
  score: number
  images?: string[]
  detailFeedback?: string | null
  menuIds?: number[]
}

/** SSR 환경에서도 안전한 FormData 판별 */
function isFormDataPayload(x: unknown): x is FormData {
  return !!x && typeof (x as any).append === "function" && typeof (x as any).set === "function"
}

let refreshPromise: Promise<Response> | null = null

const RETRYABLE = new Set([429, 503, 504])
const DEFAULT_TIMEOUT_MS = 15_000

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl = process.env.NEXT_PUBLIC_API_URL || "/_be") {
    this.baseUrl = (baseUrl || "/_be").replace(/\/$/, "")
  }

  private buildUrl(endpoint: string) {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    return `${this.baseUrl}${path}`
  }

  /** 상대경로를 절대경로로 변환 (이미 절대면 그대로 반환) */
  toAbsoluteUrl(url: string) {
    if (!url) return url
    if (/^https?:\/\//i.test(url)) return url
    const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_ORIGIN || "")
    return origin ? `${origin}${url.startsWith("/") ? url : `/${url}`}` : url
  }

  /** 공통 요청 래퍼 */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    _retrying = false,
    _fromRefresh = false,
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint)

    // --- Headers
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
    const headers: HeadersInit = { ...(options.headers || {}) }
    const method = (options.method || "GET").toUpperCase()

    if (!isFormData) {
      if (method !== "GET" && !("Content-Type" in headers)) {
        ;(headers as Record<string, string>)["Content-Type"] = "application/json"
      }
      if (!("Accept" in headers)) {
        ;(headers as Record<string, string>)["Accept"] = "application/json"
      }
    }

    // Authorization (쿠키만 쓰면 제거)
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("accessToken") ||
        localStorage.getItem("authToken") ||
        document.cookie.match(/accessToken=([^;]+)/)?.[1]
      if (token && !("Authorization" in headers)) {
        ;(headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
      }
    }

    // Timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        ...options,
        headers,
        signal: controller.signal,
      })

      // 401 → refresh 1회
      if (res.status === 401 && !_retrying && !_fromRefresh) {
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
          return this.request<T>(endpoint, options, true, true)
        }
        if (typeof window !== "undefined") {
          try { alert("세션이 만료되었습니다. 다시 로그인 해주세요.") } catch {}
          try { window.location.href = "/login" } catch {}
        }
        return { success: false, error: "AUTH_EXPIRED" } as ApiResponse<T>
      }

      // 재시도 가능한 상태코드
      if (!res.ok) {
        if (RETRYABLE.has(res.status) && !_retrying) {
          await sleep(800)
          return this.request<T>(endpoint, options, true)
        }

        const bodyText = await res.text().catch(() => "")
        let message = res.statusText || `HTTP ${res.status}`
        try {
          const j = bodyText ? JSON.parse(bodyText) : {}
          message = (j as any)?.message || (j as any)?.error || message
          if (process.env.NODE_ENV !== "production") console.error("[API 4xx/5xx]", res.status, j)
        } catch {
          if (process.env.NODE_ENV !== "production") console.error("[API 4xx/5xx]", res.status, bodyText)
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
        const { resultType, success, error } = data
        if (String(resultType).toUpperCase() === "SUCCESS") {
          return { success: true, data: (success ?? null) as T }
        }
        const reason = error?.reason || error?.message || "요청이 실패했어요."
        return { success: false, error: reason } as ApiResponse<T>
      }

      if (typeof data?.success === "boolean") return data as ApiResponse<T>
      return { success: true, data } as ApiResponse<T>
    } catch (error: any) {
      const msg = error?.name === "AbortError" ? "요청이 시간 초과되었습니다." : (error instanceof Error ? error.message : "Unknown error occurred")
      if (process.env.NODE_ENV !== "production") console.error("[API request failed]", msg)
      return { success: false, error: msg } as ApiResponse<T>
    } finally {
      clearTimeout(timeout)
    }
  }

  // ───────── Auth
  async login(email: string, password: string) {
    return this.request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
  }
  async logout() { return this.request("/auth/logout", { method: "POST" }) }
  async signup(email: string, password: string) {
    return this.request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) })
  }
  async refresh() { return this.request("/auth/refresh", { method: "POST" }) }

  async updateProfile(payload: FormData | UpdateProfileJson) {
    if (payload instanceof FormData) {
      return this.request("/auth/profile", { method: "POST", body: payload })
    }
    const body: UpdateProfileJson = {}
    if (typeof payload.nickname === "string" && payload.nickname.trim()) body.nickname = payload.nickname.trim()
    if (payload.defaultImage === true) body.defaultImage = true
    return this.request("/auth/profile", { method: "POST", body: JSON.stringify(body) })
  }
  async updateProfileMultipart(form: FormData) {
    return this.request("/auth/profile", { method: "POST", body: form })
  }

  // ───────── Restaurants (Consumer)
  async getRestaurants(params?: { search?: string }) {
    const q = (params?.search ?? "맛집").trim()
    return this.request(`/restaurants/nearby?q=${encodeURIComponent(q)}`)
  }
  async getRestaurantsNearby(bbox: string, limit = 20, cursor = 0) {
    const sp = new URLSearchParams()
    sp.set("bbox", String(bbox))
    sp.set("limit", String(limit))
    sp.set("cursor", String(cursor))
    return this.request(`/restaurants/nearby?${sp.toString()}`)
  }
  async getRestaurantsInBounds(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number; category?: string; search?: string }) {
    const q = (bounds.search ?? "맛집").trim()
    return this.request(`/restaurants/nearby?q=${encodeURIComponent(q)}`)
  }
  async getRestaurantDetail(id: number) {
    return this.request<{ id: number; name: string; category: string; address?: string; telephone?: string; photos?: { id: number; photo_name: string }[]; menus?: { id: number; name: string; photo?: string }[] }>(
      `/restaurants/${id}/detail`, { method: "GET" })
  }
  async getRestaurantReviews(id: number) { return this.request(`/restaurants/${id}/reviews`) }
  async getRestaurantMenus(id: number) {
    return this.request<{ id: number; name: string; price?: number | null }[]>(`/restaurants/${id}/menu`, { method: "GET" })
  }

  // ───────── Favorites
  async getFavorites() { return this.request("/favorites") }
  async addFavorite(restaurantId: number) {
    return this.request(`/favorites`, { method: "POST", body: JSON.stringify({ restaurantId }) })
  }
  async addFavoriteExternal(place: { name: string; address: string; mapx: number; mapy: number; category?: string; telephone?: string }) {
    const payload = { ...place, mapx: Math.round(place.mapx), mapy: Math.round(place.mapy) }
    return this.request(`/favorites`, { method: "POST", body: JSON.stringify({ place: payload }) })
  }
  async removeFavorite(restaurantId: number) { return this.request(`/favorites/${restaurantId}`, { method: "DELETE" }) }

  // ───────── Stamps
  async getUserStamps() { return this.request("/stamps/me", { method: "GET" }) }
  async getUserStampHistory() { return this.request("/stamps/me/history", { method: "GET" }) }
  async requestUseStamp(restaurantId: number, condition: number) {
    return this.request<{ code: string }>("/stamps/me/use", { method: "POST", body: JSON.stringify({ restaurantId, condition }) })
  }
  async bizUseStamp(code: string) {
    return this.request("/biz/stamps/use", { method: "POST", body: JSON.stringify({ code }) })
  }
  async bizUseStampWithRestaurant(restaurantId: number, code: string) {
    return this.request("/biz/stamps/use", { method: "POST", body: JSON.stringify({ restaurantId, code }) })
  }

  // ───────── Notifications
  async getNotifications() { return this.request("/notifications") }
  async markNotificationAsRead(notificationId: number) { return this.request(`/notifications/${notificationId}`, { method: "PATCH" }) }

  // ───────── Business (Owner)
  async getBusinessRestaurants() { return this.request("/biz/restaurants") }
  async createBusinessRestaurantMultipart(payload: {
    name: string
    category: string
    address: string
    telephone?: string
    mapx: number
    mapy: number
    images?: File[]
    menuImages?: File[]
    menuMetadatas?: string[]
    benefits?: { condition: number; reward: string }[]
  }) {
    const fd = new FormData()
    fd.set("name", payload.name)
    fd.set("category", payload.category)
    fd.set("address", payload.address)
    if (payload.telephone) fd.set("telephone", payload.telephone)
    fd.set("mapx", String(Math.round(payload.mapx)))
    fd.set("mapy", String(Math.round(payload.mapy)))
    for (const f of payload.images ?? []) fd.append("images", f)
    for (const f of payload.menuImages ?? []) fd.append("menuImages", f)
    const metaJoined = (payload.menuMetadatas ?? []).map((s) => JSON.stringify(s)).join(",")
    if (metaJoined.length) fd.set("menuMetadatas", metaJoined)
    fd.set("benefits", JSON.stringify(payload.benefits ?? []))
    return this.request("/biz/restaurants", { method: "POST", body: fd })
  }
  async updateBusinessRestaurant(id: number, data: { name?: string; category?: string; address?: string; telephone?: string }) {
    return this.request(`/biz/restaurants/${id}`, { method: "PUT", body: JSON.stringify(data) })
  }
  async deleteBusinessRestaurant(restaurantId: number) {
    return this.request(`/biz/restaurants/${restaurantId}`, { method: "DELETE" })
  }
  async getBusinessRestaurantDetail(restaurantId: number) {
    return this.request(`/biz/restaurants/${restaurantId}`)
  }
  async uploadBusinessRestaurantPhoto(restaurantId: number, file: File) {
    const fd = new FormData()
    fd.append("file", file)
    return this.request<{ id: number; fileName: string; url: string }>(`/biz/restaurants/${restaurantId}/photos`, { method: "POST", body: fd })
  }
  async deleteBusinessRestaurantPhoto(restaurantId: number, photoId: number) {
    return this.request(`/biz/restaurants/${restaurantId}/photos/${photoId}`, { method: "DELETE" })
  }
  async getBusinessMenu(restaurantId: number) {
    return this.request<{ id: number; name: string; photo?: string }[]>(`/biz/restaurants/${restaurantId}/menu`, { method: "GET" })
  }
  async getBusinessReviews() { return this.request("/biz/reviews") }
  async getBusinessReviewFeedback(reviewId: number) { return this.request(`/biz/reviews/${reviewId}/feedback`) }
  async getBusinessStats() { return this.request("/biz/stats") }
  async getBusinessAnalytics(period?: string) {
    const params = period ? `?period=${encodeURIComponent(period)}` : ""
    return this.request(`/biz/analytics${params}`)
  }

  // ───────── Reviews

  // 오버로드 시그니처
  async createReviewForRestaurant(restaurantId: number, payload: FormData): Promise<ApiResponse<any>>
  async createReviewForRestaurant(
    restaurantId: number,
    payload: ReviewCreateJsonPayload
  ): Promise<ApiResponse<any>>

  async createReviewForRestaurant(
    restaurantId: number,
    payload: FormData | ReviewCreateJsonPayload
  ): Promise<ApiResponse<any>> {
    const url = `/reviews/restaurants/${restaurantId}`

    if (isFormDataPayload(payload)) {
      // 멀티파트는 Content-Type 자동 세팅
      return this.request(url, { method: "POST", body: payload })
    }

    // JSON 경로
    const p = payload as ReviewCreateJsonPayload
    const norm = (v?: string | null) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined)

    const body = {
      content: p.content,
      score: p.score,
      imageKeys: Array.isArray(p.images) ? p.images : [],
      detailFeedback: norm(p.detailFeedback) ?? null,
      menuIds: Array.isArray(p.menuIds) ? p.menuIds : [],
    }

    return this.request(url, { method: "POST", body: JSON.stringify(body) })
  }

  async updateReview(id: number, data: { contents?: string; score?: number }) {
    return this.request(`/reviews/${id}`, { method: "PUT", body: JSON.stringify(data) })
  }
  async deleteReview(id: number) { return this.request(`/reviews/${id}`, { method: "DELETE" }) }
  async getUserReviews() { return this.request("/reviews/me") }

  async analyzeReview(id: number, form?: FormData) {
    if (form) return this.request(`/reviews/${id}/analyze`, { method: "POST", body: form })
    return this.request(`/reviews/${id}/analyze`, { method: "POST" })
  }

  async analyzeWasteBatch(payload: any) {
    // 내부 Next 라우트 호출
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

  // ───────── Images (presigned URL)
  private async fetchPresignedUrl(fileType: 0 | 1 | 2 | 3, fileName: string): Promise<string | null> {
    if (!fileName) return null
    const res = await this.request<{ url: string }>(`/images/${fileType}/${encodeURIComponent(fileName)}`)
    if (!res?.success) return null
    const url = (res.data as any)?.url
    return typeof url === "string" && url.length > 0 ? url : null
  }
  async getProfileImageUrl(fileName: string)    { return this.fetchPresignedUrl(0, fileName) }
  async getReviewImageUrl(fileName: string)     { return this.fetchPresignedUrl(1, fileName) }
  async getRestaurantImageUrl(fileName: string) { return this.fetchPresignedUrl(2, fileName) }
  async getMenuImageUrl(fileName: string)       { return this.fetchPresignedUrl(3, fileName) }

  /** (구버전) 경로 문자열만 반환 — 새 코드에선 presigned URL 권장 */
  getImageUrl(imageType: "profile" | "review" | "restaurant", fileName: string) {
    return this.buildUrl(`/images/${encodeURIComponent(imageType)}/${encodeURIComponent(fileName)}`)
  }
  getImageUrlByType(type: 0 | 1 | 2 | 3, fileName: string) {
    return this.buildUrl(`/images/${type}/${encodeURIComponent(fileName)}`)
  }

  async uploadImage(imageType: "profile" | "review", file: File) {
    const fd = new FormData()
    fd.append("file", file)
    return this.request<{ ok: boolean; type: string; fileName: string; url: string }>(`/images/${encodeURIComponent(imageType)}/upload`, { method: "POST", body: fd })
  }
  async analyzeImage(imageType: "profile" | "review", fileName: string) {
    return this.request(`/images/${encodeURIComponent(imageType)}/${encodeURIComponent(fileName)}/analyze`, { method: "POST" })
  }
  async getImageSignedUrl(type: 0 | 1 | 2 | 3, fileName: string): Promise<string> {
    const res = await this.request<{ url: string }>(`/images/${type}/${encodeURIComponent(fileName)}`, { method: "GET" })
    return res?.success ? ((res.data as any)?.url ?? "") : ""
  }

  // ───────── Search
  async searchRestaurants(query: string, filters?: { category?: string; location?: string }) {
    const params = new URLSearchParams()
    params.set("q", query)
    if (filters?.category) params.set("category", filters.category)
    if (filters?.location) params.set("location", filters.location)
    return this.request(`/restaurants/search?${params.toString()}`)
  }
}

// 싱글턴 인스턴스 export
export const apiClient = new ApiClient()