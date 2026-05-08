import { getAllBillets } from "./billetsLoader";
import { calculateBilletProgress } from "./progressMath";
import type { BilletProgress } from "../types/progress";
import type { Billet } from "../types/billets";

export function pickExamBillet(
  progressMap: Record<number, BilletProgress>,
): Billet | null {
  const billets = getAllBillets();
  if (billets.length === 0) return null;

  const weak = billets.filter(
    (b) => calculateBilletProgress(b, progressMap[b.id]) < 60,
  );
  const pool = weak.length > 0 ? weak : billets;
  return pool[Math.floor(Math.random() * pool.length)];
}
