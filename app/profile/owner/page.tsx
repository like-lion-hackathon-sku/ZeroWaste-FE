"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Store, Plus, Star, MapPin, Phone, Award, Users, Loader2, Trash2, Info } from "lucide-react"
import { useRouter } from "next/navigation"

import ProfileHeader from "@/components/profile/profileHeader"
import { useUserStore } from "@/lib/state/user"
import { useAvatarSrc, useOwnerRestaurants } from "@/hooks/profile"
import { apiClient } from "@/lib/api/client"

/* ─────────────── Framer helper (type-safe) ─────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay },
})

/* ─────────────── 공통 Empty/Metric 컴포넌트 ─────────────── */
function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-white/50 dark:border-white/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {desc && <p className="text-sm text-gray-500 mt-1">{desc}</p>}
    </div>
  )
}

function MetricCard({
  tone = "green",
  className = "",
  children,
}: {
  tone?: "green" | "red" | "orange" | "blue" | "purple"
  className?: string
  children: React.ReactNode
}) {
  const toneMap = {
    green: "from-emerald-500/12 to-teal-500/12 border-emerald-200/30",
    red: "from-rose-500/12 to-pink-500/12 border-rose-200/30",
    orange: "from-amber-500/12 to-yellow-500/12 border-amber-200/30",
    blue: "from-sky-500/12 to-blue-500/12 border-sky-200/30",
    purple: "from-fuchsia-500/12 to-purple-500/12 border-fuchsia-200/30",
  } as const
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className={`h-28 sm:h-32 rounded-2xl border shadow-sm bg-gradient-to-br backdrop-blur-md p-4 ${toneMap[tone]} ${className}`}
    >
      <div className="w-full h-full flex items-center justify-center text-center">{children}</div>
    </motion.div>
  )
}

/* ─────────────── 타입(느슨) & 안전 매퍼 ─────────────── */
type OwnerRestaurant = {
  id: number
  name: string
  category?: string | null
  address?: string | null
  telephone?: string | null
  rating?: number | null
  reviewCount?: number | null
  favoritesCount?: number | null
  badgesCount?: number | null
  // BE가 다른 키로 내려줄 경우 대비
  [k: string]: any
}
// 기존
// function mapOwnerRestaurant(r: any): OwnerRestaurant {
function mapOwnerRestaurant(r: unknown): OwnerRestaurant {
  const o = r as any
  return {
    id: Number(o?.id ?? o?.restaurantId ?? o?.restaurant_id),
    name: String(o?.name ?? o?.restaurantName ?? "이름 없음"),
    category: o?.category ?? o?.type ?? null,
    address: o?.address ?? o?.addr ?? null,
    telephone: o?.telephone ?? o?.phone ?? o?.tel ?? null,
    rating: typeof o?.rating === "number" ? o.rating : (typeof o?.avgRating === "number" ? o.avgRating : (typeof o?.stars === "number" ? o.stars : null)),
    reviewCount: typeof o?.reviewCount === "number" ? o.reviewCount : (typeof o?.reviews === "number" ? o.reviews : (Array.isArray(o?.reviews) ? o.reviews.length : null)),
    favoritesCount: typeof o?.favoritesCount === "number" ? o.favoritesCount : (typeof o?.likes === "number" ? o.likes : null),
    badgesCount: typeof o?.badgesCount === "number" ? o.badgesCount : (Array.isArray(o?.badges) ? o.badges.length : null),
  }
}


/* ─────────────── 페이지 ─────────────── */
export default function OwnerProfilePage() {
  const me = useUserStore((s) => s.user) as { nickname?: string; email?: string; created_at?: string | null; profile?: string | null }
  const avatarSrc = useAvatarSrc((me as any)?.profile ?? (me as any)?.profileImage)
  const router = useRouter()

  // 훅(전역) + 로컬 로딩/오류 상태
  const { ownerRestaurants, setOwnerRestaurants } = useOwnerRestaurants()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // 최초 로드: 사업자 식당 목록
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await apiClient.getBusinessRestaurants()
        if (!res.success) throw new Error(res.error || "가게 목록을 불러오지 못했습니다.")
        const rawList = Array.isArray(res.data) ? res.data : (res as any)?.data?.restaurants ?? []
        // unknown[]로 끊어서 map의 반환을 OwnerRestaurant[]로 고정
        const mapped: OwnerRestaurant[] = (rawList as unknown[]).map(mapOwnerRestaurant)
        // filter의 파라미터 타입을 명시
        const filtered: OwnerRestaurant[] = mapped.filter((x: OwnerRestaurant) => Number.isFinite(x.id))
if (mounted) setOwnerRestaurants(filtered as any)
      } catch (e: any) {
        if (mounted) setError(e?.message || "요청 중 오류가 발생했습니다.")
        console.error(e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 통계: 실데이터 기반(폴백 포함)
  const stats = useMemo(() => {
    const list = ownerRestaurants as OwnerRestaurant[]
    const totalRestaurants = list.length

    const totalReceivedReviews = list.reduce((s, r) => s + (Number(r.reviewCount) || 0), 0)

    // 평균 별점: 각 식당 rating 평균 (식당 수 기준)
    const avgOwnerRating =
      totalRestaurants > 0
        ? Math.round((list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / totalRestaurants) * 10) / 10
        : 0

    // 받은 즐겨찾기 총합 (필드 없으면 0)
    const totalFavorites = list.reduce((s, r) => s + (Number(r.favoritesCount) || 0), 0)

    // 획득 뱃지 (식당별 합계 or 별도 필드)
    const totalBadges =
      list.reduce((s, r) => s + (Number(r.badgesCount) || 0), 0)

    return { totalRestaurants, totalReceivedReviews, avgOwnerRating, totalFavorites, totalBadges }
  }, [ownerRestaurants])

  // 삭제
  const handleDelete = async (id: number) => {
    if (!confirm("정말 삭제할까요?")) return
    setDeletingId(id)
    try {
      const res = await apiClient.deleteBusinessRestaurant(id)
      if (!res.success) throw new Error(res.error || "삭제 실패")
      setOwnerRestaurants((prev: any[]) => prev.filter((r) => r.id !== id))
    } catch (e: any) {
      alert(e?.message || "삭제에 실패했습니다.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen relative">
      {/* 배경 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_50%_-50%,rgba(16,185,129,.18),transparent),radial-gradient(1000px_500px_at_80%_10%,rgba(59,130,246,.14),transparent)]"
      />
      <div className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-white to-transparent dark:from-black" />

      {/* 헤더 */}
      <motion.div {...fadeUp(.05)} className="pt-[env(safe-area-inset-top)]">
        <Card className="mx-auto max-w-screen-md mb-5 bg-white/75 dark:bg-gray-900/70 backdrop-blur-xl border-white/30 shadow-2xl">
          <CardContent className="p-4 sm:p-6">
            <ProfileHeader
              title="사업자 프로필"
              nickname={me?.nickname}
              email={me?.email}
              createdAt={me?.created_at ?? undefined}
              avatarSrc={avatarSrc}
              onEdit={() => router.push("/profile/edit")}
            />

            <div className="flex justify-end mt-4">
              <Button onClick={() => router.push("/profile")} variant="outline" className="border-green-400/60 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                사용자 모드 전환
              </Button>
            </div>

            {/* 요약 메트릭 */}
            <motion.div {...fadeUp(.05)} className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-5">
              <MetricCard tone="blue">
                <div>
                  <div className="text-2xl font-bold tracking-tight text-sky-600">{stats.totalReceivedReviews}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">받은 리뷰</div>
                </div>
              </MetricCard>
              <MetricCard tone="green">
                <div>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < Math.round(stats.avgOwnerRating) ? "fill-current text-green-500" : "text-gray-300"}`} />
                    ))}
                  </div>
                  <div className="text-xs text-green-600 font-medium mb-1">{stats.avgOwnerRating.toFixed(1)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">평균 별점</div>
                </div>
              </MetricCard>
              <MetricCard tone="purple">
                <div>
                  <div className="text-2xl font-bold tracking-tight text-purple-600">{stats.totalFavorites}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">받은 즐겨찾기</div>
                </div>
              </MetricCard>
              <MetricCard tone="orange">
                <div>
                  <div className="text-2xl font-bold tracking-tight text-amber-600">{stats.totalBadges}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">획득 뱃지</div>
                </div>
              </MetricCard>
            </motion.div>

            {loading && (
              <div className="mt-3 inline-flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 데이터 로딩 중…
              </div>
            )}
            {!!error && (
              <div className="mt-3 text-xs inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                <Info className="h-4 w-4" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 탭 */}
      <div className="mx-auto px-4 sm:px-6 max-w-screen-md">
        <Tabs defaultValue="restaurant" className="w-full">
          <TabsList className="w-full flex gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 rounded-xl px-1 h-11 sm:h-12 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
            {["restaurant","reviews","owner-badges"].map((key) => (
              <TabsTrigger key={key} value={key} className="shrink-0 px-4 py-2 text-sm sm:text-base rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow border border-transparent data-[state=active]:border-white/40">
                {key === "restaurant" ? "내 식당" : key === "reviews" ? "받은 리뷰" : "뱃지"}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 내 식당 */}
          <TabsContent value="restaurant" className="mt-6">
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                    <Store className="h-5 w-5 text-orange-500" /> 내 식당 관리 ({ownerRestaurants.length})
                  </CardTitle>
                  <Button onClick={() => router.push("/profile/owner-registration")} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                    <Plus className="h-4 w-4 mr-2" /> 내 식당 추가하기
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                {ownerRestaurants.length > 0 ? (
                  <div className="space-y-4">
                    {(ownerRestaurants as OwnerRestaurant[]).map((r, index) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * index }}
                        whileHover={{ y: -2 }}
                        className="relative backdrop-blur-sm bg-white/70 dark:bg-gray-800/70 border border-white/30 dark:border-white/10 rounded-2xl p-4 hover:shadow-lg transition-all duration-300 cursor-pointer"
                        onClick={() => router.push(`/restaurant/${r.id}?isOwnerMode=true`)}
                      >
                        <div className="absolute right-3 top-3">
                          <Button
                            type="button" variant="destructive" size="sm"
                            className="gap-2"
                            onMouseDown={(e)=>{ e.preventDefault(); e.stopPropagation() }}
                            onClick={(e)=>{ e.stopPropagation(); handleDelete(r.id) }}
                            disabled={deletingId === r.id}
                            title="식당 삭제"
                          >
                            {deletingId === r.id ? (<><Loader2 className="h-4 w-4 animate-spin" />삭제 중…</>) : (<Trash2 className="h-4 w-4" />)}
                          </Button>
                        </div>

                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">{r.name}</h3>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                              <span className="truncate">{r.category || "카테고리 없음"}</span>
                              {Number.isFinite(r.rating) && (
                                <div className="flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5 fill-current text-green-500" />
                                  <span>{Number(r.rating).toFixed(1)}</span>
                                </div>
                              )}
                              {Number.isFinite(r.reviewCount) && <span>리뷰 {r.reviewCount}개</span>}
                              {Number.isFinite(r.favoritesCount) && <span>즐겨찾기 {r.favoritesCount}명</span>}
                            </div>
                          </div>
                        </div>

                        {r.address && (
                          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 mb-1.5">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                            <span className="leading-5 break-words">{r.address}</span>
                          </div>
                        )}
                        {r.telephone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span>{r.telephone}</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Store className="h-8 w-8 text-orange-400" />}
                    title="등록된 식당이 없습니다"
                    desc="첫 번째 식당을 등록해보세요."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 받은 리뷰 (추후 상세 관리 UI 연결 예정) */}
          <TabsContent value="reviews" className="mt-6">
            <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                  <Star className="h-5 w-5 text-green-500" /> 받은 리뷰 ({stats.totalReceivedReviews})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <EmptyState icon={<Star className="h-8 w-8 text-green-400" />} title="받은 리뷰 관리 기능" desc="고객 리뷰를 확인하고 관리할 수 있어요." />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 사업자 뱃지 */}
          <TabsContent value="owner-badges" className="mt-6">
            <motion.div {...fadeUp(.05)} className="space-y-6">
              <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                    <Award className="h-5 w-5 text-orange-500" /> 획득한 뱃지 ({stats.totalBadges})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {stats.totalBadges === 0
                    ? <EmptyState icon={<Award className="h-8 w-8 text-orange-400" />} title="아직 획득한 뱃지가 없습니다." />
                    : <div className="text-sm text-gray-600 dark:text-gray-300">뱃지 리스트는 BE 스펙 연결 시 표시됩니다.</div>}
                </CardContent>
              </Card>

              <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-xl">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-[clamp(16px,4vw,18px)]">
                    <Users className="h-5 w-5 text-gray-500" /> 진행 중인 뱃지
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[{ id: "good_owner", name: "친절한 사장님", icon: "🧡", description: "리뷰 50개 이상, 평균 4.5+", progress: Math.min(50, stats.totalReceivedReviews), target: 50 },
                      { id: "eco_master", name: "에코 마스터", icon: "🌿", description: "에코 캠페인 10회 참여", progress: 0, target: 10 }].map((b) => (
                      <div key={b.id} className="p-4 bg-gray-500/10 backdrop-blur-sm border border-gray-200/30 rounded-2xl text-center">
                        <div className="text-3xl mb-2 opacity-80">{b.icon}</div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{b.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{b.description}</p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm"><span>진행률</span><span>{b.progress}/{b.target}</span></div>
                          {/* shadcn Progress도 가능하지만 의존 없애려 텍스트만 표시 */}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="pb-[env(safe-area-inset-bottom)] h-10" />
    </div>
  )
}
