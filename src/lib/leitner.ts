import type { LeitnerBox, CardProgress } from "../types/progress";

export function createInitialProgress(cardId: string): CardProgress {
  return {
    cardId,
    box: 1,
    lastReviewed: null,
    totalReviews: 0,
    correctReviews: 0,
  };
}

export function migrateBox(current: LeitnerBox, knew: boolean): LeitnerBox {
  if (knew) {
    return Math.min(current + 1, 5) as LeitnerBox;
  }
  return 1;
}

export type LearnMethod =
  | "read"
  | "multiple_choice"
  | "cloze"
  | "match"
  | "free_answer"
  | "extended";

export function suggestMethod(box: LeitnerBox): LearnMethod {
  switch (box) {
    case 1:
      return "read";
    case 2:
      return "multiple_choice";
    case 3:
      return "cloze";
    case 4:
      return "match";
    case 5:
      return "free_answer";
    default:
      return "read";
  }
}
