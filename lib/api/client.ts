// lib/api/client.ts
import type { ApiResponse } from "@/lib/types/database"

/**
 * 공통 API 클라이언트 (BE 프록시: /_be → {BE_ORIGIN}/api)
 * - baseUrl 기본: "/_be"
 * - credentials: "include" (HttpOnly 쿠키 사용)
 * - FormData 전송 시 Content-Type 수동 세팅 금지
 * - BE 응답(resultType/success/error) → FE 표준(success/data|error)로 정규화
 */
class ApiClient {
  private baseUrl: string

  constructor(baseUrl = process.env.NEXT_PUBLIC_API_URL || "/_be") {
    this.baseUrl = (baseUrl || "/_be").replace(/\/$/, "")
  }

  private buildUrl(endpoint: string) {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    return `${this.baseUrl}${path}`
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

      let res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        ...options,
        headers,
      })

      // 401 처리 (refresh 1회 시도)
      if (res.status === 401 && !_retrying) {
        const r = await fetch(this.buildUrl("/auth/refresh"), {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        })
        if (r.ok) return this.request<T>(endpoint, options, true)
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
        const { resultType, success, error } = data
        if (String(resultType).toUpperCase() === "SUCCESS") {
          return { success: true, data: (success ?? null) as T }
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
  async updateProfile(data: {
    name?: string
    nickname?: string
    profileImage?: File | null
    defaultImage?: boolean
  }) {
    const fd = new FormData()
    if (data.name) fd.append("name", data.name)
    if (data.nickname) fd.append("nickname", data.nickname)
    fd.append("defaultImage", String(!!data.defaultImage))
    if (data.profileImage instanceof File) fd.append("profileImage", data.profileImage)
    return this.request("/auth/profile", { method: "POST", body: fd })
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
    return this.request(`/restaurants/${id}/detail`, { method: "GET" })
  }
  async getRestaurantReviews(id: number) {
    return this.request(`/restaurants/${id}/reviews`)
  }

  // ───────────────────────── Favorites
  async getFavorites() {
    return this.request("/favorites")
  }
  async addFavorite(restaurantId: number) {
    return this.request(`/favorites`, {
      method: "PUT",
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
    return this.request(`/favorites`, { method: "PUT", body: JSON.stringify({ place: payload }) })
  }
  async removeFavorite(restaurantId: number) {
    return this.request(`/favorites/${restaurantId}`, { method: "DELETE" })
  }

  // ───────────────────────── Badges
  async getBadges() {
    return this.request("/badges")
  }
  async getUserBadges() {
    return this.request("/badges/me")
  }

  // ───────────────────────── Reviews
  async createReviewForRestaurant(
    restaurantId: number,
    payload: { contents: string; score: number }
  ) {
    return this.request(`/reviews/restaurants/${restaurantId}/reviews`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }
  async updateReview(id: number, data: { contents?: string; score?: number }) {
    return this.request(`/reviews/${id}`, { method: "PUT", body: JSON.stringify(data) })
  }
  async deleteReview(id: number) {
    return this.request(`/reviews/${id}`, { method: "DELETE" })
  }
  async getUserReviews() {
    return this.request("/reviews/me")
  }
  async analyzeReview(id: number, form?: FormData) {
    if (form) return this.request(`/reviews/${id}/analyze`, { method: "POST", body: form })
    return this.request(`/reviews/${id}/analyze`, { method: "POST" })
  }

  // ───────────────────────── Images
  async uploadImage(imageType: "profile" | "review", file: File) {
    const fd = new FormData()
    fd.append("file", file)
    return this.request<{ ok: boolean; type: string; fileName: string; url: string }>(
      `/images/${encodeURIComponent(imageType)}/upload`,
      { method: "POST", body: fd }
    )
  }
  getImageUrl(imageType: "profile" | "review", fileName: string) {
    return this.buildUrl(`/images/${encodeURIComponent(imageType)}/${encodeURIComponent(fileName)}`)
  }
  async analyzeImage(imageType: "profile" | "review", fileName: string) {
    return this.request(
      `/images/${encodeURIComponent(imageType)}/${encodeURIComponent(fileName)}/analyze`,
      { method: "POST" }
    )
  }
}

// 싱글턴 인스턴스 export
export const apiClient = new ApiClient()

export const showApiWarning = (message: string) => {
  if (typeof window !== "undefined") {
    console.warn("[v0] API Warning:", message)
    if (message.includes("연결되면 실제 데이터가 표시됩니다")) {
      setTimeout(() => alert(message), 1000)
    }
  }
}
