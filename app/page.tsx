"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, MapPin, Star, Users, Award, Camera, Heart, ArrowRight, Sparkles, Globe, Shield } from "lucide-react";
import { motion, type Variants } from "framer-motion";

/* ───────── framer-motion variants ───────── */
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 220, damping: 26 },
  },
};

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
  ] as const;

  const gallery = [
    {
      image: "/placeholder-0igdm.png",
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
  ] as const;

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* ───────── Hero ───────── */}
      <motion.div
        className="relative hero-gradient min-h-screen flex items-center"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 py-20 text-center relative z-10">
          <motion.div variants={itemVariants} className="flex justify-center mb-8">
            <div className="glass-card p-6 rounded-3xl">
              <Leaf className="h-16 w-16 text-primary mx-auto" />
            </div>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 text-balance tracking-tight"
          >
            <span className="gradient-text">지구를 위한</span>
            <br />
            <span className="text-foreground">스마트한 선택</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-4xl mx-auto text-pretty leading-relaxed"
          >
            AI 기술로 음식물 쓰레기를 줄이고, 친환경 식당을 발견하세요.
            <br className="hidden md:block" />
            당신의 작은 실천이 지구의 큰 변화를 만듭니다.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                asChild
                size="lg"
                className="text-lg px-10 py-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group"
              >
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
                className="text-lg px-10 py-6 rounded-2xl glass-card hover:bg-card/90 transition-all duration-300 bg-transparent"
              >
                <Link href="/map" className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  지도 둘러보기
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-16 flex flex-wrap justify-center gap-4">
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
          <p className="text-muted-foreground text-xl max-w-3xl mx-auto text-pretty leading-relaxed">
            최첨단 AI 기술과 사용자 중심의 디자인이 만나 완전히 새로운 친환경 식문화 경험을 제공합니다
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Card className="text-center glass-card rounded-3xl border-0 shadow-xl hover:shadow-2xl transition-all duration-300 h-full">
                <CardHeader className="p-8">
                  <div
                    className={`${feature.bgColor} w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg`}
                  >
                    <feature.icon className={`h-10 w-10 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl font-semibold mb-4 text-balance">{feature.title}</CardTitle>
                  <CardDescription className="text-muted-foreground leading-relaxed text-pretty">
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
            <p className="text-muted-foreground text-xl max-w-3xl mx-auto text-pretty leading-relaxed">
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
                <Card className="glass-card rounded-3xl border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
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

      {/* ───────── CTA ───────── */}
      <motion.div
        className="relative py-24 overflow-hidden"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/5 to-primary/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div variants={itemVariants}>
            <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-6 tracking-tight">
              <span className="gradient-text">지금 바로 시작하세요</span>
            </h2>
            <p className="text-muted-foreground text-xl mb-12 max-w-2xl mx-auto text-pretty leading-relaxed">
              수천 명의 사용자들과 함께 지속가능한 식문화를 만들어가세요.
              <br />
              당신의 참여가 지구의 미래를 바꿉니다.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                asChild
                size="lg"
                className="text-xl px-12 py-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 group"
              >
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
                className="text-xl px-12 py-6 rounded-2xl glass-card hover:bg-card/90 transition-all duration-300 bg-transparent"
              >
                <Link href="/map" className="flex items-center gap-3">
                  <Star className="h-6 w-6" />
                  더 알아보기
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-16 text-center">
            <p className="text-sm text-muted-foreground mb-4">이미 10,000+ 사용자가 함께하고 있습니다</p>
            <div className="flex justify-center items-center gap-8 flex-wrap">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Star className="h-5 w-5 text-yellow-500 fill-current" />
                <span className="font-semibold">4.9/5</span>
                <span>사용자 평점</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Leaf className="h-5 w-5 text-primary" />
                <span className="font-semibold">50,000kg+</span>
                <span>음식물 쓰레기 절약</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-5 w-5 text-secondary" />
                <span className="font-semibold">1,200+</span>
                <span>파트너 식당</span>
              </div>
            </div>
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
    </div>
  );
}
