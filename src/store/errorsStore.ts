import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ErrorEntry {
  id: string;
  billetId: number;
  cardId: string | null;
  problemId: string | null;
  what: string;
  myFix: string;
  createdAt: number;
  updatedAt: number;
}

interface ErrorsState {
  entries: ErrorEntry[];
  addError: (
    e: Omit<ErrorEntry, "id" | "createdAt" | "updatedAt" | "myFix">,
  ) => void;
  updateMyFix: (id: string, myFix: string) => void;
  removeError: (id: string) => void;
  removeByCardId: (billetId: number, cardId: string) => void;
  removeByProblemId: (billetId: number, problemId: string) => void;
  countByBillet: (billetId: number) => number;
  countTotal: () => number;
}

export const useErrorsStore = create<ErrorsState>()(
  persist(
    (set, get) => ({
      entries: [],

      addError: (e) => {
        set((state) => {
          const dupIndex = state.entries.findIndex((entry) => {
            if (entry.billetId !== e.billetId) return false;
            if (e.cardId && entry.cardId === e.cardId) return true;
            if (e.problemId && entry.problemId === e.problemId) return true;
            return false;
          });
          if (dupIndex >= 0) {
            const updated = [...state.entries];
            updated[dupIndex] = {
              ...updated[dupIndex],
              updatedAt: Date.now(),
            };
            return { entries: updated };
          }
          const newEntry: ErrorEntry = {
            ...e,
            id: crypto.randomUUID(),
            myFix: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          return { entries: [newEntry, ...state.entries] };
        });
      },

      updateMyFix: (id, myFix) => {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, myFix, updatedAt: Date.now() } : e,
          ),
        }));
      },

      removeError: (id) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }));
      },

      removeByCardId: (billetId, cardId) => {
        set((state) => ({
          entries: state.entries.filter(
            (e) => !(e.billetId === billetId && e.cardId === cardId),
          ),
        }));
      },

      removeByProblemId: (billetId, problemId) => {
        set((state) => ({
          entries: state.entries.filter(
            (e) => !(e.billetId === billetId && e.problemId === problemId),
          ),
        }));
      },

      countByBillet: (billetId) => {
        return get().entries.filter((e) => e.billetId === billetId).length;
      },

      countTotal: () => get().entries.length,
    }),
    { name: "physics-errors-v1", version: 1 },
  ),
);
