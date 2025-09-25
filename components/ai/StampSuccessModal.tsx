// components/ai/StampSuccessModal.tsx
"use client"

import React from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  open: boolean
  onClose: () => void
  mascotSrc?: string
  title?: string
  message?: string
}

export default function StampSuccessModal({
  open,
  onClose,
  mascotSrc = "/bobple-mascot.png",
  title = "스탬프 사용 완료!",
  message = "스탬프가 성공적으로 사용되었습니다.",
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl dark:bg-gray-900/95 text-center"
          >
            <div className="mb-5 flex items-center justify-center">
              <div className="relative">
                <Image
                  src={mascotSrc}
                  alt="Bobple"
                  width={120}
                  height={120}
                  priority
                  className="drop-shadow-lg"
                />
                <CheckCircle className="absolute -right-2 -bottom-2 h-7 w-7 text-emerald-500" />
              </div>
            </div>

            <h3 className="mb-2 text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              {title}
            </h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
              {message}
            </p>

            <Button
              onClick={onClose}
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6"
            >
              확인
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
