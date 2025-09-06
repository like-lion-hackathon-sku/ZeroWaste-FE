"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Leaf,
  LogOut,
  Star,
  Heart,
  MapPin,
  Loader2,
  LocateFixed,
} from "lucide-react";

import { useRestaurants } from "@/lib/hooks/use-api-with-fallback";
import { apiClient } from "@/lib/api/client";
import { calculateWasteStarRating } from "@/lib/utils/database-helpers";

declare global {
  interface Window {
    naver: any;
  }
}

type RestaurantItem = {
  id?: number;              // 검색 결과에는 없을 수도 있음
  restaurantId?: number;    // BE가 이 키로 줄 수 있어 방어
  name: string;
  image?: string | null;
  category?: string | null;
  badge?: string | null;
  description?: string | null;
  address?: string | null;
  telephone?: string | null;
  distance?: string | null;
  favorited?: boolean;
  wasteScore?: number | null;
  waste_score?: number | null;
  score?: number | null;
  ecoScore?: number | null;
  mapx?: number | null; // lng (deg)
  mapy?: number | null; // lat (deg)
};

export default function MapWithListPage() {
  const router = useRouter();
  const [naverReady, setNaverReady] = useState(false);

  // 지도 참조
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const hereMarkerRef = useRef<any>(null);

  // (예전 자동 새로고침용) 클린업만
  const idleTimerRef = useRef<number | null>(null);

  // 초기(DB) 목록
  const { data: rawRestaurants, loading, error, isUsingFallback } =
    useRestaurants();

  // 지도 검색 목록 / 로딩 / 지도 결과 우선 플래그
  const [mapRestaurants, setMapRestaurants] = useState<RestaurantItem[]>([]);
  const [loadingMapRestaurants, setLoadingMapRestaurants] = useState(false);
  const [useMapList, setUseMapList] = useState(false);

  // 검색 키워드
  const [kw, setKw] = useState("카페");

  /* ───────────────── 유틸 ───────────────── */

  const fixCoord = (v: any) => {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (Math.abs(n) <= 180) return n;      // 이미 deg(WGS84)
    if (Math.abs(n) > 1e3) return n / 1e7; // E7 → deg 추정
    return null;
  };

  // 공통 fetch 래퍼 (apiClient가 있으면 우선 사용)
  const fetchJson = async (url: string, init?: RequestInit) => {
    try {
      if (typeof (apiClient as any)?.request === "function") {
        const pathOnly = url.startsWith("/") ? url : `/${url}`;
        return (apiClient as any).request(pathOnly, init);
      }
      const r1 = await fetch(`/_be${url}`, { credentials: "include", ...init });
      if (r1.ok) return r1.json();
    } catch {}
    const r2 = await fetch(`/api${url}`, { credentials: "include", ...init });
    return r2.json();
  };

  // ▶ 중심 좌표 → 역지오코딩(구/동) → 키워드 조합
  async function reverseToRegion(lat: number, lng: number) {
    const svc = window.naver?.maps?.Service;
    if (!svc) return { gu: "", dong: "" };
    const coords = new window.naver.maps.LatLng(lat, lng);
    return new Promise<{ gu: string; dong: string }>((resolve) => {
      svc.reverseGeocode(
        { coords, orders: window.naver.maps.Service.OrderType.ADDR },
        (_status: any, res: any) => {
          const region = res?.v2?.results?.[0]?.region;
          resolve({
            gu: region?.area2?.name || "",
            dong: region?.area3?.name || "",
          });
        },
      );
    });
  }

  async function buildQueriesFromBounds(keyword: string) {
    if (!mapObjRef.current) return [keyword];

    const b = mapObjRef.current.getBounds();
    const c = b.getCenter(), sw = b.getSW(), ne = b.getNE();

    const pts = [
      { lat: c.y, lng: c.x },
      { lat: sw.y, lng: sw.x },
      { lat: ne.y, lng: ne.x },
    ];

    const regions = await Promise.all(pts.map((p) => reverseToRegion(p.lat, p.lng)));

    const qs = new Set<string>();
    const base = (keyword || "카페").trim();
    qs.add(base);
    regions.forEach((r) => {
      if (r.gu) qs.add(`${r.gu} ${base}`);
      if (r.dong) qs.add(`${r.dong} ${base}`);
    });

    return Array.from(qs).slice(0, 6);
  }

  // BE /restaurants/nearby 호출
  const callNearby = async (q: string, display = 30, start = 1) => {
    const search = new URLSearchParams({ q, display: String(display), start: String(start) });
    return fetchJson(`/restaurants/nearby?${search.toString()}`);
  };

  async function fetchNearbyForQueries(qs: string[]) {
    const pages = await Promise.all(qs.map((q) => callNearby(q, 30, 1)));
    const items = pages.flatMap((res) => {
      const d = res?.data ?? res ?? {};
      return d?.success?.items ?? d?.items ?? [];
    });
    // 이름+주소로 중복 제거
    const uniq = new Map<string, any>();
    for (const r of items) {
      const key = `${r.name || ""}__${r.address || ""}`;
      if (!uniq.has(key)) uniq.set(key, r);
    }
    return Array.from(uniq.values());
  }

  function filterInBounds(list: RestaurantItem[]) {
    const b = mapObjRef.current.getBounds();
    const sw = b.getSW(), ne = b.getNE();
    const pad = 0.1 * Math.max(ne.y - sw.y, ne.x - sw.x);
    return list.filter(
      (r) =>
        r.mapy != null &&
        r.mapx != null &&
        r.mapy >= sw.y - pad &&
        r.mapy <= ne.y + pad &&
        r.mapx >= sw.x - pad &&
        r.mapx <= ne.x + pad,
    );
  }

  /* ───────────────── 즐겨찾기 토글 ───────────────── */

  const toggleFavorite = async (idx: number) => {
    const r = restaurants[idx];
    if (!r) return;

    // 낙관적 토글
    const prev = !!r.favorited;
    const applyLocal = (v: boolean) => {
      const next = restaurants.map((x, i) => (i === idx ? { ...x, favorited: v } : x));
      setMapRestaurants(next);
      setUseMapList(true);
    };

    try {
      // UI 먼저 반영
      applyLocal(!prev);

      const rid = r.id ?? r.restaurantId;

      if (!prev) {
        // 추가
        if (rid && Number.isFinite(rid)) {
          const rs = await apiClient.addFavorite(rid);
          if (!rs?.success) throw new Error(rs?.error || "즐겨찾기 추가 실패");
        } else {
          // 외부 place만 있는 경우: deg → micro-deg(정수)로 변환해서 전송
          if (r.name && (r.address || r.description) && r.mapx != null && r.mapy != null) {
            const place = {
              name: r.name,
              address: r.address ?? r.description ?? "",
              mapx: Math.round((r.mapx as number) * 1e7), // ★ deg → micro-deg
              mapy: Math.round((r.mapy as number) * 1e7), // ★ deg → micro-deg
              category: r.category || undefined,
              telephone: r.telephone || undefined,
            };
            const rs = await apiClient.addFavoriteExternal(place);
            if (!rs?.success) throw new Error(rs?.error || "즐겨찾기 추가 실패");
          } else {
            throw new Error("식당 정보가 부족해요.");
          }
        }
      } else {
        // 해제
        if (!rid) throw new Error("restaurantId가 없어서 해제할 수 없어요.");
        const rs = await apiClient.removeFavorite(rid);
        if (!rs?.success) throw new Error(rs?.error || "즐겨찾기 해제 실패");
      }
    } catch (e: any) {
      console.error("[favorite toggle error]", e);
      // 실패 시 롤백
      applyLocal(prev);
      alert(e?.message || "즐겨찾기 처리에 실패했습니다.");
    }
  };

  /* ───────────────── 검색/지도 렌더 ───────────────── */

  // 현 지도에서 검색(버튼/엔터 전용)
  const handleSearchCurrentBounds = async () => {
    if (!mapObjRef.current) return;
    try {
      setLoadingMapRestaurants(true);
      const qs = await buildQueriesFromBounds(kw || "카페");
      const raw = await fetchNearbyForQueries(qs);

      const mapped: RestaurantItem[] = raw.map((r: any) => ({
        id: r.restaurantId ?? r.id ?? undefined, // 있을 수도/없을 수도
        restaurantId: r.restaurantId,
        name: r.name,
        image: r.image ?? null,
        category: r.category ?? null,
        badge: r.badge ?? null,
        address: r.address ?? null,
        telephone: r.telephone ?? null,
        description: r.address ?? r.description ?? null,
        distance: r.distance ?? null,
        favorited: !!r.favorited,
        wasteScore: r.wasteScore ?? r.waste_score ?? r.score ?? r.ecoScore ?? 80,
        mapx: fixCoord(r.lng ?? r.mapx),
        mapy: fixCoord(r.lat ?? r.mapy),
      }));

      let filtered = filterInBounds(mapped);
      if (filtered.length === 0) filtered = mapped;

      setMapRestaurants(filtered);
      setUseMapList(true);

      console.log("[nearby]", {
        qs,
        total: mapped.length,
        shown: filtered.length,
        sample: filtered[0],
      });
    } catch (e) {
      console.error("[nearby error]", e);
      setMapRestaurants([]);
      setUseMapList(true);
    } finally {
      setLoadingMapRestaurants(false);
    }
  };

  const restaurants: RestaurantItem[] = useMemo(() => {
    const src = useMapList ? mapRestaurants : (rawRestaurants as any[] ?? []);
    if (!Array.isArray(src)) return [];
    return [...src]
      .map((r: any) => {
        const id = r.restaurantId ?? r.id ?? undefined;
        const score =
          r.wasteScore ?? r.waste_score ?? r.score ?? r.ecoScore ?? 80;
        const lng = fixCoord(r.lng ?? r.mapx);
        const lat = fixCoord(r.lat ?? r.mapy);
        return {
          ...r,
          id,
          wasteScore: score,
          mapx: lng,
          mapy: lat,
          description: r.address ?? r.description ?? null,
        } as RestaurantItem;
      })
      .sort((a, b) => (b.wasteScore ?? 0) - (a.wasteScore ?? 0));
  }, [rawRestaurants, mapRestaurants, useMapList]);

  const topRestaurants = useMemo(() => restaurants.slice(0, 5), [restaurants]);

  const handleLogout = async () => {
    try {
      await apiClient.logout();
      router.push("/login");
    } catch (err) {
      console.error("[v0] Logout failed:", err);
    }
  };

  const goDetail = (restaurantId?: number) => {
    if (!restaurantId) {
      alert("식당 상세를 보려면 먼저 즐겨찾기 추가(멱등 확보) 후 가능합니다.");
      return;
    }
    router.push(`/restaurant/${restaurantId}`);
  };

  const flyTo = (lat: number, lng: number) => {
    if (!mapObjRef.current) return;
    const pos = new window.naver.maps.LatLng(lat, lng);
    mapObjRef.current.setCenter(pos);
    mapObjRef.current.setZoom(15);
  };

  const renderMarkers = (map: any, list: RestaurantItem[]) => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    list.forEach((r) => {
      if (r.mapx != null && r.mapy != null) {
        const pos = new window.naver.maps.LatLng(r.mapy, r.mapx);
        const marker = new window.naver.maps.Marker({
          position: pos,
          map,
          title: r.name,
        });
        window.naver.maps.Event.addListener(marker, "click", () =>
          r.id ? goDetail(r.id) : undefined,
        );
        markersRef.current.push(marker);
      }
    });
  };

  // 지도 초기화
  useEffect(() => {
    if (!naverReady || !mapRef.current || mapObjRef.current) return;

    const defaultCenter = new window.naver.maps.LatLng(37.3595704, 127.105399);
    const map = new window.naver.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 12,
    });
    mapObjRef.current = map;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const here = new window.naver.maps.LatLng(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          hereMarkerRef.current = new window.naver.maps.Marker({
            position: here,
            map,
            icon: {
              content:
                '<div style="background:#3b82f6;width:12px;height:12px;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 8px rgba(0,0,0,.3)"></div>',
              size: new window.naver.maps.Size(12, 12),
            },
          });
          map.setCenter(here);
          map.setZoom(14);
        },
        () => {
          console.warn("초기 위치 접근 실패");
        },
      );
    }

    renderMarkers(map, restaurants);

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      mapObjRef.current = null;
      hereMarkerRef.current = null;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naverReady]);

  // 목록 바뀌면 마커 갱신
  useEffect(() => {
    if (!naverReady || !mapObjRef.current) return;
    renderMarkers(mapObjRef.current, restaurants);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, naverReady]);

  // 초기 1회 검색
  useEffect(() => {
    if (!naverReady || !mapObjRef.current) return;
    handleSearchCurrentBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naverReady]);

  const recenterToUser = () => {
    if (!mapObjRef.current || !navigator.geolocation) {
      alert("현재 위치를 사용할 수 없습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = new window.naver.maps.LatLng(
          pos.coords.latitude,
          pos.coords.longitude,
        );

        if (hereMarkerRef.current) {
          hereMarkerRef.current.setPosition(here);
        } else {
          hereMarkerRef.current = new window.naver.maps.Marker({
            position: here,
            map: mapObjRef.current,
            icon: {
              content:
                '<div style="background:#3b82f6;width:12px;height:12px;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 8px rgba(0,0,0,.3)"></div>',
              size: new window.naver.maps.Size(12, 12),
            },
          });
        }

        mapObjRef.current.setCenter(here);
        mapObjRef.current.setZoom(14);
      },
      (err) => {
        alert("현재 위치를 불러올 수 없습니다. 위치 접근 권한을 허용해주세요.");
        console.warn("위치 접근 실패:", err);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=geocoder`}
        strategy="afterInteractive"
        onLoad={() => setNaverReady(true)}
        onError={(e) => console.error("Naver Maps script load error", e)}
      />

      {isUsingFallback && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-2 text-center text-sm text-yellow-800">
          ⚠️ 연결되면 실제 데이터가 표시됩니다
        </div>
      )}

      <header className="bg-card border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf className="h-6 w-6 text-primary" />
          <span className="font-semibold text-foreground">EcoEats</span>
        </div>

        {/* 키워드 입력 + 버튼 */}
        <div className="flex items-center gap-2">
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchCurrentBounds()}
            placeholder="예: 카페, 분식, 라멘…"
            className="h-9 w-56 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button size="sm" onClick={handleSearchCurrentBounds}>
            검색
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* 좌측 목록 */}
        <div className="w-[360px] border-r border-border overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              식당 정보를 불러오는 중...
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">
              식당 정보를 불러올 수 없습니다.
            </div>
          ) : (
            restaurants.map((r, idx) => (
              <Card
                key={`list-${r.name}-${idx}`}
                className="relative p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => r.id && goDetail(r.id)}
              >
                <div className="flex gap-4">
                  <img
                    src={r.image || "/placeholder.svg"}
                    alt={r.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground truncate">
                        {r.name}
                      </h3>
                      {r.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {r.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {r.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current text-green-500" />
                        <span className="text-green-600 font-medium">
                          {calculateWasteStarRating(r.wasteScore ?? 80)}
                        </span>
                      </div>
                      {r.category && <span>{r.category}</span>}
                      {r.distance && <span>{r.distance}</span>}
                    </div>
                  </div>
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  {r.mapy != null && r.mapx != null && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        flyTo(r.mapy!, r.mapx!);
                      }}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(idx); // 즐겨찾기 토글
                    }}
                    title={r.favorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        r.favorited ? "fill-red-500 text-red-500" : ""
                      }`}
                    />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* 우측 지도 */}
        <div className="flex-1 relative">
          <div ref={mapRef} id="map" className="absolute inset-0 w-full h-full" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            <Button
              onClick={handleSearchCurrentBounds}
              disabled={loadingMapRestaurants}
              className="shadow"
            >
              {loadingMapRestaurants ? "검색 중..." : "현 지도에서 검색"}
            </Button>
            <Button
              variant="outline"
              onClick={recenterToUser}
              className="shadow"
              title="내 위치로 돌아가기"
            >
              <LocateFixed className="h-4 w-4 mr-2" />
              내 위치
            </Button>
          </div>
        </div>
      </div>

      {/* 하단 TOP5 */}
      <div className="bg-card border-t border-border shrink-0">
        <div className="p-4 max-h-[320px] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              오늘의 착한 식당 TOP5
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-muted-foreground">식당 정보를 불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">
              식당 정보를 불러올 수 없습니다
            </div>
          ) : topRestaurants.length ? (
            <div className="space-y-3">
              {topRestaurants.map((restaurant, index) => (
                <Card
                  key={`top-${restaurant.name}-${index}`}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => restaurant.id && goDetail(restaurant.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <img
                        src={restaurant.image || "/placeholder.svg"}
                        alt={restaurant.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground truncate">
                            {restaurant.name}
                          </h4>
                          <Badge
                            variant={restaurant.category ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {restaurant.category || "기타"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={`s-${restaurant.name}-${i}`}
                                className={`h-3 w-3 ${
                                  i <
                                  Math.round(
                                    calculateWasteStarRating(
                                      restaurant.wasteScore ?? 80,
                                    ),
                                  )
                                    ? "fill-current text-green-500"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                            <span>
                              {calculateWasteStarRating(restaurant.wasteScore ?? 80)}
                            </span>
                          </div>
                          {restaurant.distance && <span>{restaurant.distance}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">식당 정보가 없습니다</h3>
              <p>잠시 후 다시 시도해주세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
