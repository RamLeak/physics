import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StatsState {
  totalCardsReviewed: number;
  totalSessionsStarted: number;
  incrementCardsReviewed: () => void;
  incrementSessions: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      totalCardsReviewed: 0,
      totalSessionsStarted: 0,
      incrementCardsReviewed: () =>
        set((s) => ({ totalCardsReviewed: s.totalCardsReviewed + 1 })),
      incrementSessions: () =>
        set((s) => ({ totalSessionsStarted: s.totalSessionsStarted + 1 })),
    }),
    { name: "physics-stats-v1" },
  ),
);
