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
}

interface ErrorsState {
  entries: ErrorEntry[];
  addError: (e: Omit<ErrorEntry, "id" | "createdAt">) => void;
  updateMyFix: (id: string, myFix: string) => void;
  removeError: (id: string) => void;
}

export const useErrorsStore = create<ErrorsState>()(
  persist(
    (set) => ({
      entries: [],
      addError: (e) =>
        set((state) => ({
          entries: [
            ...state.entries,
            { ...e, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        })),
      updateMyFix: (id, myFix) =>
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id ? { ...entry, myFix } : entry,
          ),
        })),
      removeError: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),
    }),
    { name: "physics-errors-v1" },
  ),
);
