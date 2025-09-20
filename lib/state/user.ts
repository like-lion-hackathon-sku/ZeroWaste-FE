import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type User = {
  id: number
  email: string
  nickname?: string | null
  profile?: string | null
  is_completed?: boolean
  role?: "USER" | "BIZ"
}

type UserState = {
  user: User | null
  setUser: (u: User | null) => void
  clear: () => void
}

// ✅ 영속 스토어
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (u) => set({ user: u }),
      clear: () => set({ user: null }),
    }),
    {
      name: "auth_user", // localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user }), // 저장 범위 제한(선택)
    }
  )
)

// 헬퍼
export const getUser = () => useUserStore.getState().user
export const setUserHelper = (u: User | null) => useUserStore.getState().setUser(u)

/** 구독 (선택) */
