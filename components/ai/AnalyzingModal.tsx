// components/ai/AnalyzingModal.tsx
"use client"

import React from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"

type Props = {
  open: boolean
  onClose?: () => void
  durationSec?: number
  mascotSrc?: string
  messages?: string[]
}

export default function AnalyzingModal({
  open,
  onClose,
  durationSec = 3,
  mascotSrc = "/bobple-mascot.png",
  messages = [
    "🔍 사진을 꼼꼼히 살펴보고 있어요...",
    "🍽️ 잔반 상태를 체크하는 중...",
    "⭐ 별점을 계산하는 중...",
    "📝 피드백을 정리하는 중...",
  ],
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl dark:bg-gray-900/95"
          >
            {/* Mascot */}
            <div className="mb-6 flex items-center justify-center">
              <motion.div
                animate={{ y: [0, -10, 0], rotate: [0, 4, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <Image
                  src={mascotSrc}
                  alt="AI Analyzing"
                  width={120}
                  height={120}
                  priority
                  className="drop-shadow-lg"
                />
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="absolute text-2xl select-none"
                    style={{ left: `${20 + i * 12}%`, top: `${10 + (i % 2) * 20}%` }}
                    animate={{ y: [0, -15, 0], opacity: [0.4, 1, 0.4], scale: [0.8, 1.15, 0.8] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                  >
                    ✨
                  </motion.span>
                ))}
              </motion.div>
            </div>

            <motion.h3
              className="mb-4 text-center text-2xl font-bold bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              AI가 분석 중이에요!
            </motion.h3>

            <div className="mb-6 space-y-2">
              {messages.map((m, i) => (
                <motion.p
                  key={i}
                  className="text-center text-sm text-gray-600 dark:text-gray-300"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 * i }}
                >
                  {m}
                </motion.p>
              ))}
            </div>

            {/* Progress */}
            <div className="relative">
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" />
              <motion.div
                className="absolute inset-y-0 left-0 h-3 rounded-full bg-gradient-to-r from-green-500 to-sky-500"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: durationSec, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute -top-1 text-2xl"
                initial={{ left: "0%" }}
                animate={{ left: "calc(100% - 2rem)" }}
                transition={{ duration: durationSec, ease: "easeInOut" }}
              >
                🍜
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
