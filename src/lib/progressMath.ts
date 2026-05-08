import type { Billet } from "../types/billets";
import type { BilletProgress } from "../types/progress";
import { getAllCardIds } from "./billetsLoader";

export function calculateBilletProgress(
  billet: Billet,
  progress: BilletProgress | undefined,
): number {
  const cardIds = getAllCardIds(billet);
  if (cardIds.length === 0) return 0;

  let totalBox = 0;
  for (const cardId of cardIds) {
    const cardProgress = progress?.cards[cardId];
    totalBox += cardProgress ? cardProgress.box : 1;
  }
  const avgBox = totalBox / cardIds.length;
  return Math.round((avgBox / 5) * 100);
}

export function progressColor(percent: number): string {
  if (percent < 30) return "bg-red-500";
  if (percent < 60) return "bg-orange-500";
  if (percent < 85) return "bg-yellow-500";
  return "bg-green-500";
}

export function calculateOverallProgress(
  billets: Billet[],
  progressMap: Record<number, BilletProgress>,
): number {
  if (billets.length === 0) return 0;
  const sum = billets.reduce(
    (acc, b) => acc + calculateBilletProgress(b, progressMap[b.id]),
    0,
  );
  return Math.round(sum / billets.length);
}

export function isBilletLearned(
  billet: Billet,
  progress: BilletProgress | undefined,
): boolean {
  if (!progress) return false;
  const percent = calculateBilletProgress(billet, progress);
  return percent === 100 && progress.oralRecallDone;
}
