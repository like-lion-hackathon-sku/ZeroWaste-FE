// lib/api/client.ts
import type { ApiResponse } from "@/lib/types/database"

type UpdateProfileJson = {
  nickname?: string;
  defaultImage?: boolean;
};

let refreshPromise: Promise<Response> | null = null;

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

  async updateProfile(payload: FormData | UpdateProfileJson) {
    if (payload instanceof FormData) {
      return this.request("/auth/profile", { method: "POST", body: payload })
    }
    const body: UpdateProfileJson = {}
    if (typeof payload.nickname === "string" && payload.nickname.trim()) {
      body.nickname = payload.nickname.trim();
    }
    if (payload.defaultImage === true) body.defaultImage = true;
    return this.request("/auth/profile", { method: "POST", body: JSON.stringify(body) })
  }
  /** multipart 그대로 전달 */
  async updateProfileMultipart(form: FormData) {
    return this.request("/auth/profile", { method: "POST", body: form })
  }

  // ───────────────────────── Restaurants (Consumer)
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
      id: number; name: string; category: string;
      address?: string; telephone?: string;
      photos?: { id: number; photo_name: string }[];
      menus?: { id: number; name: string; photo?: string }[];
    }>(`/restaurants/${id}/detail`, { method: "GET" });
  }

  async getRestaurantReviews(id: number) {
    return this.request(`/restaurants/${id}/reviews`);
  }

  /** (옵션) 일반 사용자 메뉴 목록: BE 라우트 존재 시 */
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
    return this.request(`/favorites`, { method: "POST", body: JSON.stringify({ restaurantId }) })
  }
  async addFavoriteExternal(place: { name: string; address: string; mapx: number; mapy: number; category?: string; telephone?: string }) {
    const payload = { ...place, mapx: Math.round(place.mapx), mapy: Math.round(place.mapy) }
    return this.request(`/favorites`, { method: "POST", body: JSON.stringify({ place: payload }) })
  }
  async removeFavorite(restaurantId: number) {
    return this.request(`/favorites/${restaurantId}`, { method: "DELETE" })
  }

  // ─────────── Stamps
  async getUserStamps() { return this.request("/stamps/me", { method: "GET" }) }
  async getUserStampHistory() { return this.request("/stamps/me/history", { method: "GET" }) }
  async requestUseStamp(restaurantId: number, condition: number) {
    return this.request<{ code: string }>(
      "/stamps/me/use",
      { method: "POST", body: JSON.stringify({ restaurantId, condition }) }
    )
  }
  async bizUseStamp(restaurantId: number, code: string) {
    return this.request("/biz/stamps/use", { method: "POST", body: JSON.stringify({ code }) })
  }

  // ───────────────────────── Notifications
  async getNotifications() { return this.request("/notifications") }
  async markNotificationAsRead(notificationId: number) { return this.request(`/notifications/${notificationId}`, { method: "PATCH" }) }

  // ───────────────────────── Business (Owner)
  async getBusinessRestaurants() { return this.request("/biz/restaurants") }

  /** ✅ 사업자 식당 생성: 멀티파트 전송 (이미지/메뉴/benefits 포함) */
  async createBusinessRestaurantMultipart(payload: {
    name: string;
    category: string;
    address: string;
    telephone?: string;
    mapx: number;
    mapy: number;
    images?: File[];          // 식당 사진들
    menuImages?: File[];      // 메뉴 사진들
    menuMetadatas?: string[]; // 메뉴 이름들 (예: ["치즈버거","감자튀김"])
    benefits?: { condition: number; reward: string }[]; // 스탬프 혜택
  }) {
    const fd = new FormData();
    fd.set("name", payload.name);
    fd.set("category", payload.category);
    fd.set("address", payload.address);
    if (payload.telephone) fd.set("telephone", payload.telephone);
    fd.set("mapx", String(Math.round(payload.mapx)));
    fd.set("mapy", String(Math.round(payload.mapy)));

    for (const f of payload.images ?? []) fd.append("images", f);
    for (const f of payload.menuImages ?? []) fd.append("menuImages", f);

    // BE DTO가 JSON.parse(`[${body.menuMetadatas}]`) 형태라 안전한 문자열화 적용
    // 예: '"치즈버거","감자튀김"'
    const metaJoined = (payload.menuMetadatas ?? [])
      .map(s => JSON.stringify(s))
      .join(",");
    if (metaJoined.length) fd.set("menuMetadatas", metaJoined);

    // benefits는 배열 JSON 문자열로 전달
    fd.set("benefits", JSON.stringify(payload.benefits ?? []));

    return this.request("/biz/restaurants", { method: "POST", body: fd });
  }

  /** ✅ 수정: PUT /biz/restaurants/:id (BE 구현에 맞춰 선택) */
  async updateBusinessRestaurant(id: number, data: { name?: string; category?: string; address?: string; telephone?: string }) {
    return this.request(`/biz/restaurants/${id}`, {
      method: "PUT", 
      body: JSON.stringify(data),
    });
  }

  /** ✅ 삭제: DELETE /biz/restaurants/:id */
  async deleteBusinessRestaurant(restaurantId: number) {
    return this.request(`/biz/restaurants/${restaurantId}`, { method: "DELETE" })
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
  async getBusinessMenu(restaurantId: number) {
    return this.request<{ id: number; name: string; photo?: string }[]>(
      `/biz/restaurants/${restaurantId}/menu`,
      { method: "GET" }
    )
  }
  async getBusinessReviews() { return this.request("/biz/reviews") }
  async getBusinessReviewFeedback(reviewId: number) { return this.request(`/biz/reviews/${reviewId}/feedback`) }
  async getBusinessStats() { return this.request("/biz/stats") }
  async getBusinessAnalytics(period?: string) {
    const params = period ? `?period=${encodeURIComponent(period)}` : ""
    return this.request(`/biz/analytics${params}`)
  }

  /** ⛔️ 주의: 아래 3개는 BE에 개별 CRUD 라우트가 있을 때만 사용 */
  async createStampReward(restaurantId: number, data: { condition: number; reward: string }) {
    return this.request("/biz/stamps/rewards", { method: "POST", body: JSON.stringify({ restaurantId, ...data }) })
  }
  async updateStampReward(rewardId: number, data: { condition?: number; reward?: string }) {
    return this.request(`/biz/stamps/rewards/${rewardId}`, { method: "PUT", body: JSON.stringify(data) })
  }
  async deleteStampReward(rewardId: number) {
    return this.request(`/biz/stamps/rewards/${rewardId}`, { method: "DELETE" })
  }

  // ───────────────────────── Reviews
  /** 리뷰 생성(식당별) — POST /api/reviews/restaurants/{id} */
  async createReviewForRestaurant(
    restaurantId: number,
    payload: {
      content: string;
      score: number;
      images?: string[];
      detailFeedback?: string | null;
    }
  ) {
    const norm = (v?: string | null) =>
      typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

    const body: any = {
      content: payload.content,
      score: payload.score,
      imageKeys: Array.isArray(payload.images) ? payload.images : [],
      detailFeedback: norm(payload.detailFeedback) ?? null,
    };

    return this.request(`/reviews/restaurants/${restaurantId}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateReview(id: number, data: { contents?: string; score?: number }) {
    return this.request(`/reviews/${id}`, { method: "PUT", body: JSON.stringify(data) })
  }

  /** DELETE /api/reviews/{reviewId} */
  async deleteReview(id: number) { return this.request(`/reviews/${id}`, { method: "DELETE" }) }

  /** GET /api/reviews/me */
  async getUserReviews() { return this.request("/reviews/me") }

  /** (옵션) 분석 라우트가 존재할 때만 사용 */
  async analyzeReview(id: number, form?: FormData) {
    if (form) return this.request(`/reviews/${id}/analyze`, { method: "POST", body: form })
    return this.request(`/reviews/${id}/analyze`, { method: "POST" })
  }

  async analyzeWasteBatch(payload: any) {
    // 내부 Next 라우트이므로 baseUrl('/_be')를 타지 말고 직접 호출
    const res = await fetch("/api/ai/waste/analyze-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      return { success: false, error: data?.error || `HTTP ${res.status}` } as ApiResponse<any>;
    }
    return { success: true, data: data.result } as ApiResponse<any>;
  }

  // ───────────────────────── Images (presigned URL)
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
  async getUserStats() { return this.request("/auth/stats") }
  async deleteAccount() { return this.request("/auth/delete", { method: "DELETE" }) }
}

// 싱글턴 인스턴스 export
export const apiClient = new ApiClient()
