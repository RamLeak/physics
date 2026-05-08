import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BilletProgress, CardProgress } from "../types/progress";
import { createInitialProgress, migrateBox } from "../lib/leitner";

interface ProgressState {
  billets: Record<number, BilletProgress>;

  reviewCard: (billetId: number, cardId: string, knew: boolean) => void;

  getCardProgress: (billetId: number, cardId: string) => CardProgress;

  getBilletProgress: (billetId: number) => BilletProgress | undefined;

  markOralRecall: (billetId: number, done: boolean) => void;

  markProblemSolved: (billetId: number, solved: boolean) => void;

  resetAll: () => void;

  exportProgress: () => string;
}

function emptyBillet(billetId: number): BilletProgress {
  return {
    billetId,
    cards: {},
    oralRecallDone: false,
    problemSolved: false,
  };
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      billets: {},

      reviewCard: (billetId, cardId, knew) => {
        set((state) => {
          const billet = state.billets[billetId] ?? emptyBillet(billetId);
          const card = billet.cards[cardId] ?? createInitialProgress(cardId);
          const newBox = migrateBox(card.box, knew);
          const updated: CardProgress = {
            ...card,
            box: newBox,
            lastReviewed: Date.now(),
            totalReviews: card.totalReviews + 1,
            correctReviews: card.correctReviews + (knew ? 1 : 0),
          };
          return {
            billets: {
              ...state.billets,
              [billetId]: {
                ...billet,
                cards: { ...billet.cards, [cardId]: updated },
              },
            },
          };
        });
      },

      getCardProgress: (billetId, cardId) => {
        const billet = get().billets[billetId];
        return billet?.cards[cardId] ?? createInitialProgress(cardId);
      },

      getBilletProgress: (billetId) => get().billets[billetId],

      markOralRecall: (billetId, done) => {
        set((state) => {
          const billet = state.billets[billetId] ?? emptyBillet(billetId);
          return {
            billets: {
              ...state.billets,
              [billetId]: { ...billet, oralRecallDone: done },
            },
          };
        });
      },

      markProblemSolved: (billetId, solved) => {
        set((state) => {
          const billet = state.billets[billetId] ?? emptyBillet(billetId);
          return {
            billets: {
              ...state.billets,
              [billetId]: { ...billet, problemSolved: solved },
            },
          };
        });
      },

      resetAll: () => set({ billets: {} }),

      exportProgress: () => {
        const state = get();
        return JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            version: 1,
            billets: state.billets,
          },
          null,
          2,
        );
      },
    }),
    {
      name: "physics-progress-v1",
      version: 1,
    },
  ),
);
