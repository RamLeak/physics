export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

export interface CardProgress {
  cardId: string;
  box: LeitnerBox;
  lastReviewed: number | null;
  totalReviews: number;
  correctReviews: number;
}

export interface BilletProgress {
  billetId: number;
  cards: Record<string, CardProgress>;
  oralRecallDone: boolean;
  problemSolved: boolean;
}
