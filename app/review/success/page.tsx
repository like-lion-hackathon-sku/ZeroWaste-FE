"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Leaf } from "lucide-react"

export default function ReviewSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const restaurantId = searchParams.get("restaurantId")

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-sky-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-white/20 shadow-2xl text-center">
          <CardHeader>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="bg-gradient-to-br from-green-500 to-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            >
              <CheckCircle className="h-8 w-8 text-white" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
                리뷰 작성 완료!
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-300 mt-2">소중한 후기를 남겨주셔서 감사합니다</p>
            </motion.div>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm p-4 rounded-2xl border border-green-200/30"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Leaf className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">친환경 기여도</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                당신의 리뷰가 다른 사용자들에게 도움이 될 것입니다
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="space-y-3"
            >
              <Button
                onClick={() => router.push(`/restaurant/${restaurantId}`)}
                className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              >
                식당 페이지로 돌아가기
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/map")}
                className="w-full h-12 bg-white/50 hover:bg-white/80 border-white/30"
              >
                지도로 돌아가기
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
