// app/map/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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
  User,
  Search,
} from "lucide-react";

import { useRestaurants } from "@/lib/hooks/use-api-with-fallback";
import { apiClient } from "@/lib/api/client";
import { CATEGORY_IMAGE } from "@/lib/category-images";
import { calculateWasteStarRating } from "@/lib/utils/database-helpers";

declare global {
  interface Window {
    naver: any;
  }
}

/* ───────────────── 카테고리/이미지 유틸 ───────────────── */
const normalizeImage = (v: any): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")) return s;
  return null;
};

const CATEGORY_SYNONYM: Record<string, string[]> = {
  한식: ["한식", "백반", "분식", "국밥", "족발", "보쌈", "삼겹", "비빔밥", "갈비", "냉면", "곰탕", "칼국수"],
  중식: ["중식", "짬뽕", "짜장", "탕수육", "중화요리"],
  일식: ["일식", "스시", "초밥", "라멘", "라면", "돈카츠", "돈까스", "우동", "덮밥"],
  양식: ["양식", "파스타", "스테이크", "피자", "리조또", "브런치", "이탈리안", "western"],
  카페: ["카페", "coffee", "coffeeshop", "tearoom"],
  패스트푸드: ["패스트푸드", "버거", "치킨", "피자", "샌드위치", "패스트", "fastfood"],
  기타: ["기타", "pub", "bar", "술집", "호프", "포차"],
};

function getCategoryKey(
  raw?: string | null,
  name?: string | null
): keyof typeof CATEGORY_IMAGE {
  const text = `${raw ?? ""} ${name ?? ""}`
    .toLowerCase()
    .replace(/[>,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const order: (keyof typeof CATEGORY_IMAGE)[] = ["한식", "중식", "일식", "양식", "카페", "패스트푸드", "기타"];
  for (const key of order) {
    if (CATEGORY_SYNONYM[key].some((w) => text.includes(w))) return key;
  }
  return "기타";
}
function getImageForRestaurant(category?: string | null, name?: string | null) {
  const key = getCategoryKey(category, name);
  return CATEGORY_IMAGE[key] || CATEGORY_IMAGE["기타"];
}
const pickImage = (rawImg?: string | null, category?: string | null, name?: string | null) =>
  normalizeImage(rawImg) ?? getImageForRestaurant(category, name);

/* ───────────────── 타입/상수 ───────────────── */
type RestaurantItem = {
  id?: number;
  restaurantId?: number;
  name: string;
  image?: string | null;
  category?: string | null;
  badge?: string | null;
  description?: string | null;
  address?: string | null;
  telephone?: string | null;
  distance?: string | null;
  favorited?: boolean;
  /** 원시 점수 (서버에서 오는 ecoScore/score 등) */
  wasteScore?: number | null;
  /** 지도에 표시할 0~5 스케일의 최종 점수 */
  displayScore?: number | null;
  mapx?: number | null; // lng
  mapy?: number | null; // lat
};

const SIDEBAR_WIDTH_PX = 400;

/* ───────────────── 공통: 보이는 별점(0~5)으로 정규화 ───────────────── */
const clamp05 = (v: any): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n * 10) / 10));
};

/** 서버 원시 점수(ecoScore 등) → 화면 표시용 0~5 점수 */
const toDisplay5 = (raw: any): number => {
  // 상세 페이지와 동일하게 헬퍼 사용
  const val = Number(raw) || 0;
  // calculateWasteStarRating가 반환하는 값을 다시 0~5로 안전하게 클램프
  return clamp05(calculateWasteStarRating(val));
};

/* ───────────────── 페이지 ───────────────── */
export default function MapWithListPage() {
  const router = useRouter();

  /** Naver Maps SDK 로드 여부 */
  const [naverReady, setNaverReady] = useState(false);

  /** 로그인 여부 (localStorage만 확인) */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setIsLoggedIn(!!localStorage.getItem("userId"));
      } catch {
        setIsLoggedIn(false);
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "userId") read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** 내 즐겨찾기 ID Set */
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!isLoggedIn) {
      setFavoriteIds(new Set());
      return;
    }
    (async () => {
      try {
        await apiClient.refresh().catch(() => {});
        const res = await apiClient.getFavorites();
        const items =
          (res as any)?.data?.items ??
          (res as any)?.success?.items ??
          (Array.isArray((res as any)?.items) ? (res as any).items : []);
        const ids = new Set<number>(
          items
            .map((it: any) => it.restaurant_id ?? it.restaurantId ?? it.id)
            .filter((x: any) => Number.isFinite(Number(x)))
            .map((x: any) => Number(x))
        );
        setFavoriteIds(ids);
      } catch (e) {
        console.warn("load favorites failed:", e);
      }
    })();
  }, [isLoggedIn]);

  // 지도/마커 refs
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const hereMarkerRef = useRef<any>(null);

  // 초기(DB) 목록
  const { data: rawRestaurants, loading, error } = useRestaurants();

  // 지도 검색 목록 / 로딩 / 지도 결과 우선 플래그
  const [mapRestaurants, setMapRestaurants] = useState<RestaurantItem[]>([]);
  const [loadingMapRestaurants, setLoadingMapRestaurants] = useState(false);
  const [useMapList, setUseMapList] = useState(false);

  // 검색 키워드
  const [kw, setKw] = useState("카페");

  /* ────────────── 좌표/패치 유틸 ────────────── */
  const fixCoord = (v: any) => {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (Math.abs(n) <= 180) return n; // deg
    if (Math.abs(n) > 1e3) return n / 1e7; // E7 → deg
    return null;
  };

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

  /* ────────────── 행정동 키워드 생성 ────────────── */
  async function reverseToRegion(lat: number, lng: number) {
    const svc = window.naver?.maps?.Service;
    if (!svc) return { gu: "", dong: "" };
    const coords = new window.naver.maps.LatLng(lat, lng);
    return new Promise<{ gu: string; dong: string }>((resolve) => {
      svc.reverseGeocode(
        { coords, orders: window.naver.maps.Service.OrderType.ADDR },
        (_s: any, res: any) => {
          const region = res?.v2?.results?.[0]?.region;
          resolve({
            gu: region?.area2?.name || "",
            dong: region?.area3?.name || "",
          });
        }
      );
    });
  }

  async function buildQueriesFromBounds(keyword: string) {
    if (!mapObjRef.current) return [keyword];
    const b = mapObjRef.current.getBounds();
    const c = b.getCenter(),
      sw = b.getSW(),
      ne = b.getNE();
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

  const callNearby = async (q: string, display = 30, start = 1) => {
    const search = new URLSearchParams({ q, display: String(display), start: String(start) });
    return fetchJson(`/restaurants/nearby?${search.toString()}`);
  };

  async function fetchNearbyForQueries(qs: string[]) {
    const pages = await Promise.all(qs.map((q) => callNearby(q, 30, 1)));
    const items = pages.flatMap((res) => {
      const d = (res as any)?.data ?? res ?? {};
      return (d as any)?.success?.items ?? (d as any)?.items ?? [];
    });
    const uniq = new Map<string, any>();
    for (const r of items) {
      const key = `${r.name || ""}__${r.address || ""}`;
      if (!uniq.has(key)) uniq.set(key, r);
    }
    return Array.from(uniq.values());
  }

  function filterInBounds(list: RestaurantItem[]) {
    const b = mapObjRef.current.getBounds();
    const sw = b.getSW(),
      ne = b.getNE();
    const pad = 0.1 * Math.max(ne.y - sw.y, ne.x - sw.x);
    return list.filter(
      (r) =>
        r.mapy != null &&
        r.mapx != null &&
        r.mapy >= sw.y - pad &&
        r.mapy <= ne.y + pad &&
        r.mapx >= sw.x - pad &&
        r.mapx <= ne.x + pad
    );
  }

  /* ────────────── 리뷰 평균(0~5) 계산 ────────────── */
  const avgFromReviews05 = (reviews: any[]): number | null => {
    if (!Array.isArray(reviews) || reviews.length === 0) return null;
    const nums: number[] = [];
    for (const r of reviews) {
      const cand = r?.waste_rating ?? r?.wasteRating ?? r?.wasteScore ?? r?.rating ?? r?.score ?? null;
      const n = Number(cand);
      if (Number.isFinite(n)) nums.push(n);
    }
    if (nums.length === 0) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return clamp05(avg);
  };

  // 상세/리뷰 평균으로 리스트 점수 보강 → displayScore(0~5)로 저장
  const enrichWithDbScores = async (items: RestaurantItem[]): Promise<RestaurantItem[]> => {
    // nearby 응답의 id/restaurantId/restaurant_id 등을 모두 커버
    const toId = (it: any) =>
      Number(
        it.restaurantId ??
          it.restaurant_id ??
          it.id ??
          it._id ??
          it.restId ??
          it.rest_id ??
          0
      ) || 0;

    const targets = items
      .map((it) => ({ id: toId(it), it }))
      .filter((x) => Number.isInteger(x.id) && x.id > 0);

    if (targets.length === 0) return items;

    // 1차: 상세에서 ecoScore 류 추출 → 표시점수(0~5)로 변환
    const detailResults = await Promise.allSettled(
      targets.map(({ id }) => fetchJson(`/restaurants/${id}/detail`))
    );
    const idToDisplay5 = new Map<number, number>();
    detailResults.forEach((pr, idx) => {
      if (pr.status !== "fulfilled") return;
      const data = (pr.value as any)?.data ?? (pr.value as any)?.success ?? pr.value ?? {};
      const ecoRaw =
        data?.stats?.ecoScore ??
        data?.ecoScore ??
        data?.averageWasteScore ??
        data?.avgWasteScore ??
        data?.wasteScore ??
        null;
      if (ecoRaw != null) {
        idToDisplay5.set(targets[idx].id, toDisplay5(ecoRaw));
      }
    });

    // 2차: 없는 것만 리뷰 평균(이미 0~5 스케일)으로 보강
    const missing = targets.filter(({ id }) => !idToDisplay5.has(id));
    if (missing.length) {
      const reviewResults = await Promise.allSettled(
        missing.map(({ id }) => fetchJson(`/restaurants/${id}/reviews`))
      );
      reviewResults.forEach((pr, idx) => {
        if (pr.status !== "fulfilled") return;
        const payload = (pr.value as any)?.data ?? (pr.value as any)?.success ?? pr.value ?? {};
        const list = Array.isArray(payload) ? payload : payload?.items ?? [];
        const avg05 = avgFromReviews05(list);
        if (avg05 != null) idToDisplay5.set(missing[idx].id, avg05);
      });
    }

    return items.map((r) => {
      const id =
        Number(r.restaurantId ?? (r as any).restaurant_id ?? r.id ?? (r as any)._id ?? 0) || 0;
      const disp = idToDisplay5.get(id);
      return disp != null ? { ...r, displayScore: disp } : r;
    });
  };

  /* ────────────── 즐겨찾기 ────────────── */
  const toggleFavorite = async (idx: number) => {
    if (!isLoggedIn) return;
    const r = restaurants[idx];
    if (!r) return;
    const id = r.id ?? r.restaurantId;
    const prev = !!r.favorited;

    const applyLocal = (v: boolean) => {
      const next = restaurants.map((x, i) => (i === idx ? { ...x, favorited: v } : x));
      setMapRestaurants(next);
      setUseMapList(true);
      if (Number.isFinite(Number(id))) {
        setFavoriteIds((old) => {
          const s = new Set(old);
          const nid = Number(id);
          if (v) s.add(nid);
          else s.delete(nid);
          return s;
        });
      }
    };

    try {
      applyLocal(!prev);
      if (!prev) {
        if (Number.isFinite(Number(id))) {
          const rs = await apiClient.addFavorite(Number(id));
          if (!rs?.success) throw new Error(rs?.error || "즐겨찾기 추가 실패");
        }
      } else {
        if (!Number.isFinite(Number(id))) throw new Error("restaurantId가 없어서 해제할 수 없어요.");
        const rs = await apiClient.removeFavorite(Number(id));
        if (!rs?.success) throw new Error(rs?.error || "즐겨찾기 해제 실패");
      }
    } catch (e: any) {
      applyLocal(prev);
      alert(e?.message || "즐겨찾기 처리에 실패했습니다.");
    }
  };

  /* ────────────── 검색/목록 변환 ────────────── */
  const handleSearchCurrentBounds = async () => {
    if (!mapObjRef.current) return;
    try {
      setLoadingMapRestaurants(true);
      const qs = await buildQueriesFromBounds(kw || "카페");
      const raw = await fetchNearbyForQueries(qs);

      const mapped: RestaurantItem[] = raw.map((r: any) => {
        const rawId =
          r.restaurantId ??
          r.restaurant_id ??
          r.id ??
          r._id ??
          r.restId ??
          r.rest_id;
        const idNum = Number(rawId) || undefined;

        const isFavByServer = !!r.favorited;
        const isFavByMe = idNum != null && favoriteIds.has(Number(idNum));

        // 원시 점수와 표시 점수 분리
        const rawScore =
          r.wasteScore ?? r.waste_score ?? r.score ?? r.ecoScore ?? null;

        // 화면 표시용 0~5
        const displayScore =
          rawScore != null ? toDisplay5(rawScore) : null;

        return {
          id: idNum,
          restaurantId: idNum,
          name: r.name,
          image: pickImage(r.image, r.category, r.name),
          category: r.category ?? null,
          badge: r.badge ?? null,
          address: r.address ?? null,
          telephone: r.telephone ?? null,
          description: r.address ?? r.description ?? null,
          distance: r.distance ?? null,
          favorited: isFavByServer || isFavByMe,
          wasteScore: Number(rawScore) || null, // 원본 보관
          displayScore, // 표시 점수(0~5)
          mapx: fixCoord(r.lng ?? r.mapx),
          mapy: fixCoord(r.lat ?? r.mapy),
        };
      });

      let filtered = filterInBounds(mapped);
      if (filtered.length === 0) filtered = mapped;

      // ★ 상세/리뷰로 표시 점수 보강
      const enriched = await enrichWithDbScores(filtered);

      setMapRestaurants(enriched);
      setUseMapList(true);
    } catch {
      setMapRestaurants([]);
      setUseMapList(true);
    } finally {
      setLoadingMapRestaurants(false);
    }
  };

  /* ────────────── 파생 상태 ────────────── */
  const restaurants: RestaurantItem[] = useMemo(() => {
    const src = useMapList ? mapRestaurants : ((rawRestaurants as any[]) ?? []);
    if (!Array.isArray(src)) return [];
    return [...src]
      .map((r: any) => {
        const rawId =
          r.restaurantId ??
          (r as any).restaurant_id ??
          r.id ??
          (r as any)._id ??
          (r as any).restId ??
          (r as any).rest_id;
        const idNum = Number(rawId) || undefined;

        const lng = fixCoord(r.lng ?? r.mapx);
        const lat = fixCoord(r.lat ?? r.mapy);
        const fav = r.favorited || (idNum != null && favoriteIds.has(Number(idNum)));

        // 표시 점수 우선순위: displayScore(보강값) → rawScore 변환
        const displayScore =
          r.displayScore != null
            ? clamp05(r.displayScore)
            : r.wasteScore != null
            ? toDisplay5(r.wasteScore)
            : 0;

        return {
          ...r,
          id: idNum,
          image: pickImage(r.image, r.category, r.name),
          displayScore,
          mapx: lng,
          mapy: lat,
          description: r.address ?? r.description ?? null,
          favorited: fav,
        } as RestaurantItem;
      })
      .sort((a, b) => (b.displayScore ?? 0) - (a.displayScore ?? 0));
  }, [rawRestaurants, mapRestaurants, useMapList, favoriteIds]);

  const topRestaurants = useMemo(() => restaurants.slice(0, 5), [restaurants]);

  /* ────────────── 내비/지도 유틸 ────────────── */
  const goDetail = (restaurantId?: number, favorited?: boolean) => {
    if (!restaurantId) {
      alert("식당 상세를 보려면 먼저 즐겨찾기 추가(멱등 확보) 후 가능합니다.");
      return;
    }
    const fav = favorited ? "1" : "0";
    router.push(`/restaurant/${restaurantId}?fav=${fav}`);
  };

  const flyTo = (lat: number, lng: number) => {
    if (!mapObjRef.current) return;
    const pos = new window.naver.maps.LatLng(lat, lng);
    mapObjRef.current.setCenter(pos);
    mapObjRef.current.setZoom(15);
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout().catch(() => {});
    } finally {
      try {
        localStorage.removeItem("userId");
      } catch {}
      setIsLoggedIn(false);
      router.push("/login");
    }
  };

  /* ────────────── SDK 로드 & 지도 초기화 ────────────── */
  useEffect(() => {
    if (typeof window !== "undefined" && window.naver?.maps) setNaverReady(true);
  }, []);

  useEffect(() => {
    if (!naverReady || !mapRef.current || mapObjRef.current) return;

    const defaultCenter = new window.naver.maps.LatLng(37.3595704, 127.105399);
    const map = new window.naver.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 12,
    });
    mapObjRef.current = map;

    // 처음 마커
    renderMarkers(map, restaurants);

    // 현재 위치
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const here = new window.naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
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
        () => console.warn("초기 위치 접근 실패")
      );
    }

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      mapObjRef.current = null;
      hereMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naverReady]);

  // 목록 변경 시 마커 갱신
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

  function renderMarkers(map: any, list: RestaurantItem[]) {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    list.forEach((r) => {
      if (r.mapy != null && r.mapx != null) {
        const pos = new window.naver.maps.LatLng(r.mapy, r.mapx);
        const marker = new window.naver.maps.Marker({
          position: pos,
          map,
          title: r.name,
        });
        window.naver.maps.Event.addListener(marker, "click", () =>
          r.id ? goDetail(r.id, r.favorited) : undefined
        );
        markersRef.current.push(marker);
      }
    });
  }

  const recenterToUser = () => {
    if (!mapObjRef.current || !navigator.geolocation) {
      alert("현재 위치를 사용할 수 없습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = new window.naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
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
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-green-50/30 to-sky-50/30 dark:from-slate-950 dark:via-green-950/20 dark:to-sky-950/20">
      {/* Naver Maps SDK */}
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}&submodules=geocoder`}
        strategy="afterInteractive"
        onLoad={() => setNaverReady(true)}
        onError={(e) => console.error("Naver Maps script load error", e)}
      />

      {/* 헤더 */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 p-4 flex items-center justify-between shadow-lg"
      >
        <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.02 }}>
          <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            EcoEats
          </span>
        </motion.div>

        {/* 검색바 */}
        <div className="hidden sm:block absolute top-1/2 -translate-y-1/2 left-[380px] right-48 z-0 pointer-events-none">
          <motion.div
            className="flex items-center gap-3 pointer-events-auto"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="relative flex-1 max-w-[420px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchCurrentBounds()}
                placeholder="예: 카페, 분식, 라멘…"
                className="h-11 w-full pl-10 pr-4 rounded-2xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-sm outline-none focus:ring-2 focus:ring-green-500/30 shadow-lg"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSearchCurrentBounds}
              className="h-11 px-6 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg"
            >
              <Search className="h-4 w-4 mr-2" />
              검색
            </Button>
          </motion.div>
        </div>

        <div className="relative z-20 flex items-center gap-2">
          {isLoggedIn && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/profile")}
                className="h-10 px-4 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 shadow-lg"
                title="프로필"
              >
                <User className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">프로필</span>
              </Button>
            </motion.div>
          )}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-10 px-4 rounded-xl bg-white/50 dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-lg"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">로그아웃</span>
            </Button>
          </motion.div>
        </div>
      </motion.header>

      <div className="flex flex-1 min-h-0">
        {/* 사이드바 (리스트) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-r border-white/20 dark:border-slate-800/50 overflow-y-auto p-6 space-y-4 shadow-2xl"
          style={{ width: SIDEBAR_WIDTH_PX }}
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              주변 맛집
            </h2>
            <Badge
              variant="secondary"
              className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
            >
              {restaurants.length}곳
            </Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-green-500" />
                <p className="text-sm">식당 정보를 불러오는 중...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-12 bg-red-50 dark:bg-red-900/20 rounded-2xl">
              <p className="text-sm">식당 정보를 불러올 수 없습니다.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {restaurants.map((r, idx) => (
                <motion.div
                  key={`list-${r.name}-${idx}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ delay: idx * 0.03 }}
                  whileHover={{ scale: 1.01, y: -2 }}
                >
                  <Card
                    className="relative p-5 cursor-pointer bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white/90 dark:hover:bg-slate-800/90 border-white/20 dark:border-slate-700/50 shadow-lg transition-all duration-200 rounded-2xl group"
                    onClick={() => r.id && goDetail(r.id, r.favorited)}
                  >
                    <div className="flex items-start gap-4">
                      {/* 썸네일 */}
                      <div className="relative overflow-hidden rounded-xl shrink-0">
                        <img
                          src={r.image || "/placeholder.svg"}
                          alt={r.name}
                          loading="lazy"
                          sizes="80px"
                          className="w-20 h-20 object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>

                      {/* 본문 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3
                            className="font-semibold text-foreground text-base md:text-lg leading-snug break-keep line-clamp-2"
                            title={r.name}
                          >
                            {r.name}
                          </h3>
                          {r.badge && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                            >
                              {r.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2 leading-relaxed">
                          {r.description}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-current text-green-500" />
                            <span className="text-green-600 font-semibold">
                              {clamp05(r.displayScore ?? 0).toFixed(1)}
                            </span>
                          </div>
                          {r.category && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                              {r.category}
                            </span>
                          )}
                          {r.distance && <span className="text-xs opacity-75">{r.distance}</span>}
                        </div>
                      </div>

                      {/* 우측 아이콘들 */}
                      <div className="flex flex-col items-end gap-2 shrink-0 self-start">
                        {r.mapy != null && r.mapx != null && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              flyTo(r.mapy!, r.mapx!);
                            }}
                            className="h-8 w-8 rounded-xl bg-white/80 dark:bg-slate-700/80 hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow"
                            title="지도에서 보기"
                          >
                            <MapPin className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {isLoggedIn && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(idx);
                            }}
                            title={r.favorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                            className="h-8 w-8 rounded-xl bg-white/80 dark:bg-slate-700/80 hover:bg-red-50 dark:hover:bg-red-900/30 shadow"
                          >
                            <Heart
                              className={`h-4 w-4 transition-colors duration-200 ${
                                r.favorited ? "fill-red-500 text-red-500" : "text-gray-400"
                              }`}
                            />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </motion.div>

        {/* 지도 */}
        <div className="flex-1 relative">
          <div ref={mapRef} id="map" className="absolute inset-0 w-full h-full" />

          {/* 부동 컨트롤 */}
          <motion.div
            className="absolute bottom-20 md:bottom-16 left-1/2 -translate-x-1/2 z-10 flex gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              onClick={handleSearchCurrentBounds}
              disabled={loadingMapRestaurants}
              className="h-12 px-6 rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl text-foreground hover:bg-white dark:hover:bg-slate-700 shadow-xl border border-white/20 dark:border-slate-700/50"
            >
              {loadingMapRestaurants ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  검색 중...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  현 지도에서 검색
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={recenterToUser}
              className="h-12 px-6 rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 shadow-xl border border-white/20 dark:border-slate-700/50"
              title="내 위치로 돌아가기"
            >
              <LocateFixed className="h-4 w-4 mr-2 text-blue-600" />
              <span className="hidden sm:inline">내 위치</span>
            </Button>
          </motion.div>
        </div>
      </div>

      {/* 하단 TOP5 */}
      <motion.div
        className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-t border-white/20 dark:border-slate-800/50 shrink-0 shadow-2xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="p-6 max-h=[320px] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <motion.h3 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                <Star className="h-5 w-5 text-white" />
              </div>
              오늘의 착한 식당 TOP5
            </motion.h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-green-500" />
                <span className="text-muted-foreground text-sm">식당 정보를 불러오는 중...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-12 bg-red-50 dark:bg-red-900/20 rounded-2xl">
              <p className="text-sm">식당 정보를 불러올 수 없습니다</p>
            </div>
          ) : topRestaurants.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {topRestaurants.map((restaurant, index) => {
                const score = clamp05(restaurant.displayScore ?? 0);
                return (
                  <motion.div
                    key={`top-${restaurant.name}-${index}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card
                      className="cursor-pointer bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white/90 dark:hover:bg-slate-800/90 border-white/20 dark:border-slate-700/50 shadow-lg transition-all duration-200 rounded-2xl group"
                      onClick={() =>
                        restaurant.id && goDetail(restaurant.id, restaurant.favorited)
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* 순위 */}
                          <div className="relative">
                            <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl w-10 h-10 flex items-center justify-center text-lg font-bold shadow-lg">
                              {index + 1}
                            </div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-pulse" />
                          </div>

                          {/* 썸네일 */}
                          <div className="relative overflow-hidden rounded-xl">
                            <img
                              src={restaurant.image || "/placeholder.svg"}
                              alt={restaurant.name}
                              loading="lazy"
                              sizes="56px"
                              className="w-14 h-14 object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                          </div>

                          {/* 본문 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 min-w-0">
                              <h4
                                className="flex-1 min-w-0 font-semibold text-foreground text-[15px] leading-snug break-keep line-clamp-2"
                                title={restaurant.name}
                              >
                                {restaurant.name}
                              </h4>
                              <Badge
                                variant={restaurant.category ? "secondary" : "outline"}
                                className="shrink-0 max-w-[50%] truncate text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                title={restaurant.category || "기타"}
                              >
                                {restaurant.category || "기타"}
                              </Badge>
                            </div>

                            {/* 평점/거리 */}
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={`s-${restaurant.name}-${i}`}
                                    className={`h-3 w-3 ${
                                      i < Math.round(score)
                                        ? "fill-current text-green-500"
                                        : "text-gray-300"
                                    }`}
                                  />
                                ))}
                                <span className="font-semibold text-green-600 ml-1">
                                  {score.toFixed(1)}
                                </span>
                              </div>
                              {restaurant.distance && (
                                <span className="text-xs opacity-75">{restaurant.distance}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
              <Star className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">식당 정보가 없습니다</h3>
              <p className="text-sm">잠시 후 다시 시도해주세요</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
