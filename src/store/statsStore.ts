import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StatsState {
  totalCardsReviewed: number;
  totalSessionsStarted: number;
  examPassed: number;
  examFailed: number;
  incrementCardsReviewed: () => void;
  incrementSessions: () => void;
  incrementExamPassed: () => void;
  incrementExamFailed: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      totalCardsReviewed: 0,
      totalSessionsStarted: 0,
      examPassed: 0,
      examFailed: 0,
      incrementCardsReviewed: () =>
        set((s) => ({ totalCardsReviewed: s.totalCardsReviewed + 1 })),
      incrementSessions: () =>
        set((s) => ({ totalSessionsStarted: s.totalSessionsStarted + 1 })),
      incrementExamPassed: () =>
        set((s) => ({ examPassed: s.examPassed + 1 })),
      incrementExamFailed: () =>
        set((s) => ({ examFailed: s.examFailed + 1 })),
    }),
    { name: "physics-stats-v1" },
  ),
);
