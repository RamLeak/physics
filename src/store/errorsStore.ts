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
  archivedAt?: number;
}

interface ErrorsState {
  entries: ErrorEntry[];
  archived: ErrorEntry[];

  addError: (
    e: Omit<
      ErrorEntry,
      "id" | "createdAt" | "updatedAt" | "myFix" | "archivedAt"
    >,
  ) => void;
  updateMyFix: (id: string, myFix: string) => void;
  removeError: (id: string) => void;
  removeFromArchive: (id: string) => void;

  archiveByCardId: (billetId: number, cardId: string) => void;
  archiveByProblemId: (billetId: number, problemId: string) => void;

  removeByCardId: (billetId: number, cardId: string) => void;
  removeByProblemId: (billetId: number, problemId: string) => void;

  countByBillet: (billetId: number) => number;
  countTotal: () => number;
  countArchived: () => number;
}

export const useErrorsStore = create<ErrorsState>()(
  persist(
    (set, get) => ({
      entries: [],
      archived: [],

      addError: (e) => {
        set((state) => {
          const archivedIdx = state.archived.findIndex((entry) => {
            if (entry.billetId !== e.billetId) return false;
            if (e.cardId && entry.cardId === e.cardId) return true;
            if (e.problemId && entry.problemId === e.problemId) return true;
            return false;
          });

          if (archivedIdx >= 0) {
            const restored = state.archived[archivedIdx];
            const newArchived = [...state.archived];
            newArchived.splice(archivedIdx, 1);
            const reActivated: ErrorEntry = {
              ...restored,
              archivedAt: undefined,
              updatedAt: Date.now(),
            };
            return {
              archived: newArchived,
              entries: [reActivated, ...state.entries],
            };
          }

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
          archived: state.archived.map((e) =>
            e.id === id ? { ...e, myFix, updatedAt: Date.now() } : e,
          ),
        }));
      },

      removeError: (id) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }));
      },

      removeFromArchive: (id) => {
        set((state) => ({
          archived: state.archived.filter((e) => e.id !== id),
        }));
      },

      archiveByCardId: (billetId, cardId) => {
        set((state) => {
          const toArchive = state.entries.filter(
            (e) => e.billetId === billetId && e.cardId === cardId,
          );
          if (toArchive.length === 0) return state;
          const archivedNow = toArchive.map((e) => ({
            ...e,
            archivedAt: Date.now(),
          }));
          return {
            entries: state.entries.filter(
              (e) => !(e.billetId === billetId && e.cardId === cardId),
            ),
            archived: [...archivedNow, ...state.archived],
          };
        });
      },

      archiveByProblemId: (billetId, problemId) => {
        set((state) => {
          const toArchive = state.entries.filter(
            (e) => e.billetId === billetId && e.problemId === problemId,
          );
          if (toArchive.length === 0) return state;
          const archivedNow = toArchive.map((e) => ({
            ...e,
            archivedAt: Date.now(),
          }));
          return {
            entries: state.entries.filter(
              (e) => !(e.billetId === billetId && e.problemId === problemId),
            ),
            archived: [...archivedNow, ...state.archived],
          };
        });
      },

      removeByCardId: (billetId, cardId) =>
        get().archiveByCardId(billetId, cardId),
      removeByProblemId: (billetId, problemId) =>
        get().archiveByProblemId(billetId, problemId),

      countByBillet: (billetId) =>
        get().entries.filter((e) => e.billetId === billetId).length,
      countTotal: () => get().entries.length,
      countArchived: () => get().archived.length,
    }),
    {
      name: "physics-errors-v1",
      version: 2,
      migrate: (persistedState, version) => {
        const s = persistedState as Partial<ErrorsState> | null;
        if (version < 2 && s && Array.isArray(s.entries)) {
          return { ...s, archived: s.archived ?? [] } as ErrorsState;
        }
        return persistedState as ErrorsState;
      },
    },
  ),
);
