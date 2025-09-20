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

  /** 상대경로를 절대경로로 변환 (이미 절대면 그대로 반환) */
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
  private async request<T>(endpoint: string, options: RequestInit = {}, _retrying = false): Promise<ApiResponse<T>> {
    try {
      const url = this.buildUrl(endpoint)
      const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData

      const headers: HeadersInit = { ...(options.headers || {}) }
      if (!isFormData) {
        if (!("Content-Type" in headers)) (headers as Record<string, string>)["Content-Type"] = "application/json"
        if (!("Accept" in headers)) (headers as Record<string, string>)["Accept"] = "application/json"
      }

      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        ...options,
        headers,
      })

      // 401 → refresh 1회 시도
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
    return this.request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
  }
  async logout() {
    return this.request("/auth/logout", { method: "POST" })
  }
  async signup(email: string, password: string) {
    return this.request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) })
  }
  async refresh() {
    return this.request("/auth/refresh", { method: "POST" })
  }
  async getProfile() {
    return this.request("/auth/me", { method: "GET" })
  }
  async updateProfile(data: { name?: string; nickname?: string; profileImage?: File | null; defaultImage?: boolean }) {
    const fd = new FormData()
    if (data.name) fd.append("name", data.name)
    if (data.nickname) fd.append("nickname", data.nickname)
    fd.append("defaultImage", String(!!data.defaultImage))
    if (data.profileImage instanceof File) fd.append("profileImage", data.profileImage)
    return this.request("/auth/profile", { method: "POST", body: fd })
  }
  /** multipart 그대로 전달 */
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
  async getRestaurantsInBounds(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number; category?: string; search?: string }) {
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

  // ───────────────────────── Favorites
  async getFavorites() {
    return this.request("/favorites")
  }
  async addFavorite(restaurantId: number) {
    return this.request(`/favorites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId }) })
  }
  async addFavoriteExternal(place: { name: string; address: string; mapx: number; mapy: number; category?: string; telephone?: string }) {
    const payload = { ...place, mapx: Math.round(place.mapx), mapy: Math.round(place.mapy) }
    return this.request(`/favorites`, { method: "POST", body: JSON.stringify({ place: payload }) })
  }
  async removeFavorite(restaurantId: number) {
    return this.request(`/favorites/${restaurantId}`, { method: "DELETE" })
  }

  // ───────────────────────── Badges & Stamps
  async getBadges() { return this.request("/badges") }
  async getUserBadges() { return this.request("/badges/me") }
  async getUserStamps() { return this.request("/stamps/me") }
  async getUserStampHistory() { return this.request("/stamps/me/history", { method: "GET" }) }
  async useStamp(restaurantId: number, code: string) {
    return this.request("/biz/stamps/use", { method: "PATCH", body: JSON.stringify({ restaurantId, code }) })
  }
  async getStampRewards(restaurantId: number) { return this.request(`/stamps/rewards/${restaurantId}`) }
  async claimStampReward(restaurantId: number, rewardId: number) {
    return this.request(`/stamps/rewards/claim`, { method: "POST", body: JSON.stringify({ restaurantId, rewardId }) })
  }
  getAiReviewSummary(restaurantId: number) {
    return this.request(`/restaurants/${restaurantId}/ai-summary`) as Promise<{ success: boolean; data: any; error?: string }>
  }

  // ───────────────────────── Notifications
  async getNotifications() { return this.request("/notifications") }
  async markNotificationAsRead(notificationId: number) { return this.request(`/notifications/${notificationId}`, { method: "PATCH" }) }

  // ───────────────────────── Business APIs
  async getBusinessRestaurants() { return this.request("/biz/restaurants") }
  async createBusinessRestaurant(data: { name: string; category: string; address: string; telephone?: string; mapx: number; mapy: number }) {
    return this.request("/biz/restaurants", { method: "POST", body: JSON.stringify(data) })
  }
  async updateBusinessRestaurant(restaurantId: number, data: { name?: string; category?: string; address?: string; telephone?: string }) {
    return this.request("/biz/restaurants", { method: "PUT", body: JSON.stringify({ restaurantId, ...data }) })
  }
  async deleteBusinessRestaurant(restaurantId: number) {
    return this.request("/biz/restaurants", { method: "DELETE", body: JSON.stringify({ restaurantId }) })
  }
  async getBusinessRestaurantDetail(restaurantId: number) { return this.request(`/biz/restaurants/${restaurantId}`) }
  async uploadBusinessRestaurantPhoto(restaurantId: number, file: File) {
    const fd = new FormData()
    fd.append("file", file)
    return this.request<{ id: number; fileName: string; url: string }>(`/biz/restaurants/${restaurantId}/photos`, { method: "POST", body: fd })
  }
  async deleteBusinessRestaurantPhoto(restaurantId: number, photoId: number) { return this.request(`/biz/restaurants/${restaurantId}/photos/${photoId}`, { method: "DELETE" }) }
  async getBusinessReviews() { return this.request("/biz/reviews") }
  async getBusinessReviewFeedback(reviewId: number) { return this.request(`/biz/reviews/${reviewId}/feedback`) }
  async getBusinessMenu(restaurantId: number) {
    return this.request<{ id: number; name: string; photo?: string }[]>(`/biz/restaurants/${restaurantId}/menu`, { method: "GET" })
  }
  async getBusinessStats() { return this.request("/biz/stats") }
  async getBusinessAnalytics(period?: string) {
    const params = period ? `?period=${encodeURIComponent(period)}` : ""
    return this.request(`/biz/analytics${params}`)
  }
  async createStampReward(restaurantId: number, data: { condition: number; reward: string }) {
    return this.request("/biz/stamps/rewards", { method: "POST", body: JSON.stringify({ restaurantId, ...data }) })
  }
  async updateStampReward(rewardId: number, data: { condition?: number; reward?: string }) {
    return this.request(`/biz/stamps/rewards/${rewardId}`, { method: "PUT", body: JSON.stringify(data) })
  }
  async deleteStampReward(rewardId: number) { return this.request(`/biz/stamps/rewards/${rewardId}`, { method: "DELETE" }) }

  // ───────────────────────── Reviews
  async createReviewForRestaurant(
    restaurantId: number,
    payload: { contents: string; score: number; menuId?: number | null; menuName?: string; images?: Array<{ fileName: string; shotType: "after"; score: number | null; summary: string | null }> }
  ) {
    return this.request(`/restaurants/${restaurantId}/reviews`, { method: "POST", body: JSON.stringify(payload) })
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
  async createReview(restaurantId: number, data: { content: string; score?: number; photos?: File[] }) {
    const fd = new FormData()
    fd.append("content", data.content)
    if (data.score != null) fd.append("score", String(data.score))
    if (data.photos) data.photos.forEach((photo, i) => fd.append(`photos[${i}]`, photo))
    return this.request(`/restaurants/${restaurantId}/reviews`, { method: "POST", body: fd })
  }

  // ───────────────────────── Images (presigned URL 방식 + 업로드)
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

  /** (구버전) 경로 문자열만 반환 — 새 코드에선 presigned URL 사용 권장 */
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
      { method: "POST", body: fd },
    )
  }

  async analyzeImage(imageType: "profile" | "review", fileName: string) {
    return this.request(`/images/${encodeURIComponent(imageType)}/${encodeURIComponent(fileName)}/analyze`, { method: "POST" })
  }

  async getImageSignedUrl(type: 0 | 1 | 2 | 3, fileName: string): Promise<string> {
    const res = await this.request<{ url: string }>(`/images/${type}/${encodeURIComponent(fileName)}`, { method: "GET" })
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
    return { success: true, data } as ApiResponse<any> // { ok, score5, score100, summary, raw }
  }

  // ───────────────────────── Search APIs
  async searchRestaurants(query: string, filters?: { category?: string; location?: string }) {
    const params = new URLSearchParams()
    params.set("q", query)
    if (filters?.category) params.set("category", filters.category)
    if (filters?.location) params.set("location", filters.location)
    return this.request(`/restaurants/search?${params.toString()}`)
  }

  // ───────────────────────── User Profile APIs
  async getUserStats() { return this.request("/auth/stats") }
  async deleteAccount() { return this.request("/auth/delete", { method: "DELETE" }) }
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
