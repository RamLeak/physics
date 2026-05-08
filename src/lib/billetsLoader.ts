import billetsData from "../data/billets.json";
import type { BilletsData, Billet } from "../types/billets";

const data = billetsData as BilletsData;

export function getAllBillets(): Billet[] {
  return data.billets;
}

export function getBilletById(id: number): Billet | undefined {
  return data.billets.find((b) => b.id === id);
}

export function getAllCardIds(billet: Billet): string[] {
  return [
    ...billet.theory_q1.cards.map((c) => c.id),
    ...billet.theory_q2.cards.map((c) => c.id),
  ];
}
