import type { TheoryCard } from "../types/billets";
import type { BilletProgress } from "../types/progress";
import { getAllBillets } from "./billetsLoader";
import type { LearnMethod } from "./leitner";

export interface PracticeItem {
  billetId: number;
  card: TheoryCard;
  method: LearnMethod;
}

export type PracticeMode = "all" | "weak";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function methodForBox(box: number): LearnMethod {
  if (box <= 2) return "multiple_choice";
  if (box <= 3) return "cloze";
  return "free_answer";
}

export function buildPracticeQueue(
  progressMap: Record<number, BilletProgress>,
  mode: PracticeMode,
  size: number = 10,
): PracticeItem[] {
  const billets = getAllBillets();
  const allItems: PracticeItem[] = [];

  for (const billet of billets) {
    const progress = progressMap[billet.id];
    const allCards = [...billet.theory_q1.cards, ...billet.theory_q2.cards];
    for (const card of allCards) {
      const box = progress?.cards[card.id]?.box ?? 1;
      if (mode === "weak" && box > 2) continue;
      allItems.push({
        billetId: billet.id,
        card,
        method: methodForBox(box),
      });
    }
  }

  return shuffle(allItems).slice(0, size);
}
