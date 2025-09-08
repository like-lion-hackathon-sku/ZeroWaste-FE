"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { fallbackService } from "@/lib/services/fallback-service";
import type { ApiResponse } from "@/lib/types/database";

/** 지도 경계 */
export type Bounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/**
 * API + Fallback 공통 훅
 * - apiCall이 실패하면 fallbackCall을 시도
 * - 둘 다 FE 표준 응답(ApiResponse<T>)을 사용
 */
export function useApiWithFallback<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  fallbackCall: () => Promise<ApiResponse<T>>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await apiCall();
        if (res.success && res.data != null) {
          if (!mounted) return;
          setData(res.data);
          setIsUsingFallback(false);
        } else {
          throw new Error(res.error || "API call failed");
        }
      } catch {
        // API 실패 → 폴백 시도
        try {
          const fres = await fallbackCall();
          if (fres.success && fres.data != null) {
            if (!mounted) return;
            setData(fres.data);
            setIsUsingFallback(true);
          } else {
            throw new Error(fres.error || "Fallback call failed");
          }
        } catch {
          if (!mounted) return;
          setError("데이터를 불러올 수 없습니다");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return { data, loading, error, isUsingFallback };
}

/**
 * 식당 목록 훅
 * - 카테고리/검색어 OR 지도 bounds로 조회
 * - bounds가 있으면 bounds 우선
 */
export function useRestaurants(params?: {
  category?: string;
  search?: string;
  bounds?: Bounds;
}) {
  const boundsKey = params?.bounds ? JSON.stringify(params.bounds) : undefined;

  return useApiWithFallback(
    // 1) 실제 API
    () => {
      if (params?.bounds) {
        // apiClient는 category/search를 함께 받도록 설계되어 있어도 무방
        return apiClient.getRestaurantsInBounds({
          ...params.bounds,
          category: params.category,
          search: params.search,
        } as any);
      }
      return apiClient.getRestaurants({
        category: params?.category,
        search: params?.search,
      });
    },

    // 2) 폴백
    () => {
      const anyFallback = fallbackService as any;

      // 폴백 서비스가 bounds 기반 메서드를 제공하면 bounds만 전달(타입 안전)
      if (
        params?.bounds &&
        anyFallback &&
        typeof anyFallback.getRestaurantsInBounds === "function"
      ) {
        return anyFallback.getRestaurantsInBounds(params.bounds);
      }

      // 그렇지 않으면 카테고리/검색 기반 폴백 사용
      return fallbackService.getRestaurants({
        category: params?.category,
        search: params?.search,
      });
    },

    // 의존성
    [params?.category, params?.search, boundsKey]
  );
}

/** 식당 상세 훅 */
export function useRestaurant(id: number) {
  return useApiWithFallback(
    () => apiClient.getRestaurant(id),
    () => fallbackService.getRestaurant(id),
    [id]
  );
}

/** 사용자 프로필 훅 */
export function useUserProfile() {
  return useApiWithFallback(
    () => apiClient.getProfile(),
    () => fallbackService.getUserProfile(),
    []
  );
}

/** 사용자 뱃지 훅 */
export function useUserBadges() {
  return useApiWithFallback(
    () => apiClient.getUserBadges(),
    () => fallbackService.getUserBadges(),
    []
  );
}

/** 즐겨찾기 목록 훅 */
export function useFavorites() {
  return useApiWithFallback(
    () => apiClient.getFavorites(),
    () => fallbackService.getFavorites(),
    []
  );
}

/** 내 리뷰 목록 훅 */
export function useUserReviews() {
  return useApiWithFallback(
    () => apiClient.getUserReviews(),
    () => fallbackService.getUserReviews(),
    []
  );
}