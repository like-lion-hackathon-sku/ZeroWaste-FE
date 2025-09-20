"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Leaf, MapPin, Star, Users, Award, Camera, Heart, ArrowRight, Sparkles, Globe, Shield, Play,
} from "lucide-react"
import { motion, useScroll, useTransform, type Variants } from "framer-motion"

/* ───────── framer-motion variants ───────── */
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 26 } },
}

/* ───────── 유틸: 숫자 카운터 ───────── */
function useCounter(target: number, inView: boolean, duration = 1.2) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!inView) return
    let raf = 0
    const start = performance.now()
    const run = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000))
      setValue(Math.floor(target * (1 - Math.pow(1 - p, 3)))) // ease-out-cubic
      if (p < 1) raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [target, inView, duration])
  return value
}

/* ───────── 유틸: 뷰포트 진입 감지 ───────── */
function useInView<T extends HTMLElement>(offset = 0.2) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setInView(true),
      { threshold: offset }
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [offset])
  return { ref, inView }
}

/* ───────── 로고 마퀴 데이터 ───────── */
const logos = [
  { name: "UN SDGs", src: "/logos/greenkorea.svg" },
  { name: "Seoul Zero", src: "/logos/seoul.svg" },
  { name: "Green Korea", src: "/logos/green-korea.png" },
  { name: "환경부", src: "/logos/moe.svg" },
  { name: "Net Zero", src: "/logos/netzero.svg" },
]

/* ───────── 테스티모니얼 데이터 ───────── */
const testimonials = [
  {
    quote: "잔반 분석이 눈으로 보이니 팀에서 캠페인을 설득하기 쉬워졌어요.",
    user: "김OO 매니저",
    role: "프랜차이즈 운영",
  },
  {
    quote: "평균 별점 4.0↑ 스탬프 정책으로 재방문율이 확실히 늘었습니다.",
    user: "이지OO 대표",
    role: "개인 식당",
  },
  {
    quote: "내 주변 친환경 식당을 빠르게 찾고 리뷰 신뢰도가 높아요.",
    user: "박OO",
    role: "사용자",
  },
]

export default function HomePage() {
  const features = [
    {
      icon: MapPin,
      title: "스마트 위치 검색",
      description: "AI 기반 추천으로 내 주변 최고의 친환경 식당을 발견하세요",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Camera,
      title: "AI 잔반 분석",
      description: "식사 전후 사진 한 장으로 정확한 잔반 비율을 자동 측정합니다",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      icon: Users,
      title: "신뢰할 수 있는 커뮤니티",
      description: "검증된 사용자들과 함께 진정한 친환경 식당 정보를 공유하세요",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      icon: Award,
      title: "환경 배지 시스템",
      description: "친환경 실천을 통해 특별한 배지를 획득하고 성취감을 느껴보세요",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ] as const

  const gallery = [
    {
      image: "/eco-friendly-restaurant-with-green-plants-and-sust.jpg",
      title: "친환경 인증 식당",
      description: "제로웨이스트를 실천하는 검증된 식당들",
    },
    {
      image: "/ai-food-waste-analysis-on-smartphone-screen.jpg",
      title: "AI 분석 결과",
      description: "정확한 잔반 측정으로 환경 기여도 확인",
    },
    {
      image: "/community-of-people-sharing-eco-friendly-meals.jpg",
      title: "활발한 커뮤니티",
      description: "함께 만들어가는 지속가능한 식문화",
    },
  ] as const

  /* ─── 히어로 키워드 로테이션 ─── */
  const keywords = useMemo(() => ["스마트한 선택", "지속가능한 식문화", "진짜 친환경 맛집", "나의 작은 실천"], [])
  const [kwIdx, setKwIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setKwIdx((i) => (i + 1) % keywords.length), 2400)
    return () => clearInterval(id)
  }, [keywords.length])

  /* ─── 패럴랙스 배경 ─── */
  const heroRef = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const yBlob = useTransform(scrollYProgress, [0, 1], [0, -120])
  const yGrid = useTransform(scrollYProgress, [0, 1], [0, -60])

  /* ─── 카운터 InView ─── */
  const { ref: counterRef, inView: counterIn } = useInView<HTMLDivElement>(0.3)
  const vRating = useCounter(49, counterIn) // 4.9 → 소수점은 UI에서 처리
  const vWaste = useCounter(50000, counterIn)
  const vPartners = useCounter(1200, counterIn)

  /* ─── 테스티모니얼 슬라이더 ─── */
  const [tIdx, setTIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTIdx((i) => (i + 1) % testimonials.length), 3500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* ───────── Animated Background (Hero) ───────── */}
      <motion.div
        ref={heroRef}
        className="relative hero-gradient min-h-screen flex items-center"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* 오로라/블랍 */}
        <motion.div
          style={{ y: yBlob }}
          className="pointer-events-none absolute -top-24 -left-32 w-[42rem] h-[42rem] rounded-full blur-3xl bg-primary/20"
        />
        <motion.div
          style={{ y: yBlob }}
          className="pointer-events-none absolute -bottom-32 -right-32 w-[48rem] h-[48rem] rounded-full blur-3xl bg-secondary/20"
        />

        {/* 그리드 */}
        <motion.svg
          style={{ y: yGrid }}
          className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.6" className="text-border/40" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </motion.svg>

        {/* 파티클 */}
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 36 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/50"
              initial={{ opacity: 0, scale: 0.6, x: Math.random() * 100 + "%", y: Math.random() * 100 + "%" }}
              animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.6, 1, 0.6] }}
              transition={{ duration: 6 + Math.random() * 6, repeat: Infinity, repeatType: "mirror" }}
            />
          ))}
        </div>

        {/* Hero Content */}
        <div className="container mx-auto px-4 py-20 text-center relative z-10">
          <motion.div variants={itemVariants} className="flex justify-center mb-8">
            <div className="glass-card p-6 rounded-3xl shadow-2xl ring-1 ring-primary/20">
              <Leaf className="h-16 w-16 text-primary mx-auto" />
            </div>
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-8 tracking-tight">
            <span className="gradient-text">지구를 위한</span>
            <br />
            <span className="text-foreground inline-block relative">
              {/* 키워드 스와핑 */}
              <motion.span
                key={kwIdx}
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 250, damping: 30 }}
                className="inline-block"
              >
                {keywords[kwIdx]}
              </motion.span>
            </span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-4xl mx-auto leading-relaxed">
            AI 기술로 음식물 쓰레기를 줄이고, 친환경 식당을 발견하세요.
            <br className="hidden md:block" />
            당신의 작은 실천이 지구의 큰 변화를 만듭니다.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button asChild size="lg" className="text-lg px-10 py-6 rounded-2xl shadow-xl hover:shadow-2xl group">
                <Link href="/login" className="flex items-center gap-2">
                  지금 시작하기
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-lg px-10 py-6 rounded-2xl glass-card hover:bg-card/90 bg-transparent"
              >
                <Link href="/map" className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  지도 둘러보기
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* ▼▼▼ 로고 마퀴 제거됨 ▼▼▼ */}

          <motion.div variants={itemVariants} className="mt-12 flex flex-wrap justify-center gap-4">
            <Badge variant="secondary" className="px-4 py-2 text-sm rounded-full">
              <Sparkles className="h-4 w-4 mr-2" />
              AI 잔반 분석
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm rounded-full glass-card">
              <Globe className="h-4 w-4 mr-2" />
              친환경 인증
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm rounded-full glass-card">
              <Shield className="h-4 w-4 mr-2" />
              신뢰할 수 있는 리뷰
            </Badge>
          </motion.div>
        </div>
      </motion.div>

      {/* ───────── Demo / Mock Section ───────── */}
      <motion.section
        className="container mx-auto px-4 py-24"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div variants={itemVariants}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
              <span className="gradient-text">AI 잔반 분석</span>이
              <br />왜 중요한가요?
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              식사 전/후 이미지를 비교해 낭비율을 수치로 제시합니다. 평균 별점 4.0 이상일 땐 스탬프 1개를 적립해
              재방문을 촉진하고, 낮은 점수의 메뉴는 리뉴얼 근거를 제공합니다.
            </p>

            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              {[
                { icon: Star, title: "평균 4.9/5", sub: "사용자 만족도" },
                { icon: Leaf, title: "50,000kg+", sub: "절감 음식물" },
                { icon: Users, title: "1,200+", sub: "파트너 식당" },
              ].map((s, i) => (
                <Card key={i} className="glass-card rounded-2xl border-0 p-5 hover:shadow-xl transition">
                  <div className="flex items-center gap-3">
                    <s.icon className="h-6 w-6 text-primary" />
                    <div className="text-sm">
                      <div className="font-semibold">{s.title}</div>
                      <div className="text-muted-foreground">{s.sub}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* Phone Mock */}
          <motion.div variants={itemVariants} className="relative flex justify-center">
            <div className="relative w-[280px] h-[560px] rounded-[2.3rem] p-3 bg-gradient-to-br from-primary/20 to-secondary/20 shadow-2xl ring-1 ring-border/40">
              <div className="absolute inset-0 rounded-[2.3rem] backdrop-blur-xl" />
              <div className="relative w-full h-full rounded-[1.8rem] overflow-hidden bg-card/60 border border-white/10">
                <img
                  src="/ai-food-waste-analysis-on-smartphone-screen.jpg"
                  alt="demo"
                  className="w-full h-full object-cover opacity-90"
                />
                <button className="absolute bottom-4 right-4 bg-background/80 hover:bg-background text-foreground rounded-full p-3 shadow-lg transition">
                  <Play className="h-5 w-5" />
                </button>
              </div>
              <div className="absolute -z-10 inset-0 blur-3xl bg-primary/20 rounded-[2.3rem]" />
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ───────── Features ───────── */}
      <motion.div
        className="container mx-auto px-4 py-24"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <motion.div variants={itemVariants} className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 tracking-tight">
            <span className="gradient-text">혁신적인 기능</span>으로
            <br />
            지속가능한 미래를 만들어요
          </h2>
          <p className="text-muted-foreground text-xl max-w-3xl mx-auto leading-relaxed">
            최첨단 AI와 사용자 중심 디자인이 만나 완전히 새로운 친환경 식문화 경험을 제공합니다
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -6, rotateX: 1.5, rotateY: -1.5 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group"
            >
              <Card className="text-center glass-card rounded-3xl border-0 shadow-xl hover:shadow-2xl transition h-full relative overflow-hidden">
                {/* 글로우 */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500"
                  style={{
                    background:
                      "radial-gradient(800px circle at var(--x,50%) var(--y,50%), rgba(16,185,129,0.12), transparent 40%)",
                  }}
                />
                <CardHeader className="p-8">
                  <div className={`${feature.bgColor} w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                    <feature.icon className={`h-10 w-10 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl font-semibold mb-4">{feature.title}</CardTitle>
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ───────── Gallery ───────── */}
      <motion.div
        className="bg-card/30 py-24"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="container mx-auto px-4">
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 tracking-tight">
              실제 사용자들의 <span className="gradient-text">친환경 맛집</span>
            </h2>
            <p className="text-muted-foreground text-xl max-w-3xl mx-auto leading-relaxed">
              전국 수천 명의 사용자들이 ZeroWaste와 함께 환경을 보호하고 있습니다
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {gallery.map((item, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Card className="glass-card rounded-3xl border-0 shadow-xl hover:shadow-2xl transition overflow-hidden">
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                  <CardHeader className="p-6">
                    <CardTitle className="text-lg font-semibold mb-2">{item.title}</CardTitle>
                    <CardDescription className="text-muted-foreground">{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ───────── Testimonials + Stats ───────── */}
      <section className="container mx-auto px-4 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Testimonials slider */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-primary/20 to-secondary/20 blur-2xl" />
            <Card className="relative glass-card rounded-3xl border-0 p-8 overflow-hidden">
              <div className="absolute top-0 right-0 opacity-20">
                <Sparkles className="w-32 h-32" />
              </div>
              <div className="h-40 flex items-center">
                <motion.div
                  key={tIdx}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 240, damping: 24 }}
                >
                  <p className="text-xl md:text-2xl text-foreground leading-relaxed">
                    “{testimonials[tIdx].quote}”
                  </p>
                  <div className="mt-4 text-muted-foreground">
                    <span className="font-semibold text-foreground">{testimonials[tIdx].user}</span> · {testimonials[tIdx].role}
                  </div>
                </motion.div>
              </div>
              <div className="mt-6 flex gap-2">
                {testimonials.map((_, i) => (
                  <span key={i} className={`h-2 w-2 rounded-full ${i === tIdx ? "bg-primary" : "bg-muted"}`} />
                ))}
              </div>
            </Card>
          </div>

          {/* Animated counters */}
          <div ref={counterRef as any} className="grid sm:grid-cols-3 gap-4">
            <Card className="glass-card rounded-3xl border-0 p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-3xl font-bold">
                <Star className="h-7 w-7 text-yellow-500 fill-current" />
                <span>{(Math.max(0, vRating) / 10).toFixed(1)}/5</span>
              </div>
              <p className="text-muted-foreground mt-2">사용자 평점</p>
            </Card>
            <Card className="glass-card rounded-3xl border-0 p-8 text-center">
              <div className="text-3xl font-bold">{vWaste.toLocaleString()}kg+</div>
              <p className="text-muted-foreground mt-2">절감 음식물</p>
            </Card>
            <Card className="glass-card rounded-3xl border-0 p-8 text-center">
              <div className="text-3xl font-bold">{vPartners.toLocaleString()}+</div>
              <p className="text-muted-foreground mt-2">파트너 식당</p>
            </Card>
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <motion.div
        className="relative py-24 overflow-hidden"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/5 to-primary/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div variants={itemVariants}>
            <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-6 tracking-tight">
              <span className="gradient-text">지금 바로 시작하세요</span>
            </h2>
            <p className="text-muted-foreground text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
              수천 명의 사용자들과 함께 지속가능한 식문화를 만들어가세요.
              <br />
              당신의 참여가 지구의 미래를 바꿉니다.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button asChild size="lg" className="text-xl px-12 py-6 rounded-2xl shadow-xl hover:shadow-2xl group">
                <Link href="/auth/signup" className="flex items-center gap-3">
                  <Heart className="h-6 w-6" />
                  무료로 시작하기
                  <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-xl px-12 py-6 rounded-2xl glass-card hover:bg-card/90 bg-transparent"
              >
                <Link href="/map" className="flex items-center gap-3">
                  <Star className="h-6 w-6" />
                  더 알아보기
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-border/50 py-12 bg-card/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl">
                <Leaf className="h-6 w-6 text-primary" />
              </div>
              <span className="text-lg font-semibold text-foreground">ZeroWaste</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                개인정보처리방침
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                이용약관
              </Link>
              <span>© 2024 ZeroWaste. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ───────── 작은 인터랙션: feature 글로우 포인터 좌표 반영 ───────── */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('mousemove', (e) => {
              document.querySelectorAll('.group').forEach(el => {
                el.style.setProperty('--x', e.clientX - el.getBoundingClientRect().left + 'px');
                el.style.setProperty('--y', e.clientY - el.getBoundingClientRect().top + 'px');
              });
            });
          `,
        }}
      />
      {/* ▼▼▼ marquee keyframes 삭제됨 ▼▼▼ */}
    </div>
  )
}
