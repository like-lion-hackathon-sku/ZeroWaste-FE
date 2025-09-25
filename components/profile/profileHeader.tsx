"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Edit, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatDate } from "@/lib/utils/database-helpers"

type Props = {
  title?: string
  nickname?: string | null
  email?: string | null
  createdAt?: string | null
  avatarSrc?: string
  onEdit?: () => void
}

export default function ProfileHeader({
  title = "프로필",
  nickname,
  email,
  createdAt,
  avatarSrc = "/placeholder.svg",
  onEdit,
}: Props) {
  const router = useRouter()

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 pt-[max(env(safe-area-inset-top),0px)] backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-white/20 px-3 sm:px-4 py-2 sm:py-3"
    >
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="hover:bg-white/20">
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로가기
        </Button>
        <h1 className="font-bold text-[clamp(18px,4vw,24px)] bg-gradient-to-r from-green-600 to-sky-600 bg-clip-text text-transparent">
          {title}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit} className="hover:bg-white/20">
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mx-auto px-1 sm:px-2 max-w-screen-md">
        <div className="flex items-center gap-4 py-3">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }}>
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-4 ring-green-500/20">
              <AvatarImage src={avatarSrc} alt={nickname || "user"} />
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                <User className="h-7 w-7" />
              </AvatarFallback>
            </Avatar>
          </motion.div>

          <div className="flex-1 min-w-0">
            <motion.h2 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
              className="text-[clamp(18px,5vw,22px)] font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-1 truncate">
              {nickname}
            </motion.h2>
            <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="text-gray-600 dark:text-gray-300 mb-1 truncate">
              {email}
            </motion.p>
            {createdAt && (
              <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }} className="text-xs text-gray-500 dark:text-gray-400">
                가입일: {formatDate(createdAt)}
              </motion.p>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  )
}
