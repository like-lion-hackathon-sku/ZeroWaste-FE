// lib/state/reviewShare.ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReviewPiece = {
  score?: number;         // 0~5
  ownerComment?: string;  // 사장님 분석
  userComment?: string;   // 사용자 한 줄
};

type ReviewShareState = {
  pieces: ReviewPiece[];                 // 카드별 텍스트 조각
  combinedText: string;                  // 합쳐진 최종 문자열
  setPieces: (list: ReviewPiece[]) => void;
  buildCombined: (list?: ReviewPiece[]) => string;
  clear: () => void;
};

export const useReviewShare = create<ReviewShareState>()(
  persist(
    (set, get) => ({
      pieces: [],
      combinedText: "",
      setPieces: (list) => {
        set({ pieces: list });
        const text = get().buildCombined(list);
        set({ combinedText: text });
      },
      buildCombined: (list) => {
        const items = list ?? get().pieces ?? [];
        const chunks = items.map((r, i) => {
          const score = (r.score ?? "").toString();
          const owner = (r.ownerComment ?? "").trim();
          const user = (r.userComment ?? "").trim();
          return [
            `#${i + 1} 점수: ${score ? `${score}점` : "-"}`,
            owner ? `사장님 분석: ${owner}` : "",
            user ? `사용자 한 줄: ${user}` : "",
          ].filter(Boolean).join("\n");
        });
        return chunks.filter(Boolean).join("\n\n");
      },
      clear: () => set({ pieces: [], combinedText: "" }),
    }),
    { name: "zw_review_share" } // localStorage key
  )
);
