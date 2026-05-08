import type { Billet } from "../types/billets";
import type { BilletProgress } from "../types/progress";
import { getAllCardIds } from "./billetsLoader";

const WEIGHT_THEORY = 0.6;
const WEIGHT_RECALL = 0.25;
const WEIGHT_PROBLEM = 0.15;

export function calculateTheoryProgress(
  billet: Billet,
  progress: BilletProgress | undefined,
): number {
  const cardIds = getAllCardIds(billet);
  if (cardIds.length === 0) return 0;
  let total = 0;
  for (const id of cardIds) {
    const card = progress?.cards[id];
    const box = card ? card.box : 1;
    total += ((box - 1) / 4) * 100;
  }
  return Math.round(total / cardIds.length);
}

export function calculateBilletProgress(
  billet: Billet,
  progress: BilletProgress | undefined,
): number {
  const theory = calculateTheoryProgress(billet, progress) / 100;
  const recall = progress?.oralRecallDone ? 1 : 0;
  const problem = progress?.problemSolved ? 1 : 0;

  const composite =
    theory * WEIGHT_THEORY + recall * WEIGHT_RECALL + problem * WEIGHT_PROBLEM;
  return Math.round(composite * 100);
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
  if (!progress.oralRecallDone) return false;
  return calculateBilletProgress(billet, progress) >= 95;
}
