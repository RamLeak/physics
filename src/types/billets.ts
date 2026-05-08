export interface TheoryCard {
  id: string;
  topic: string;
  content: string;
  key_terms: string[];
}

export interface TheoryQuestion {
  title: string;
  cards: TheoryCard[];
}

export interface ConnectedRecall {
  checklist: string[];
}

export interface Problem {
  id: string;
  title: string;
  condition: string;
  given: string[];
  find: string;
  image: string | null;
  solution_steps: string[];
  answer: string;
}

export interface Duplicate {
  billet_id: number;
  question: "q1" | "q2";
  note: string;
}

export interface Billet {
  id: number;
  title: string;
  theory_q1: TheoryQuestion;
  theory_q2: TheoryQuestion;
  connected_recall: ConnectedRecall;
  problem: Problem;
  theory_duplicates: Duplicate[];
}

export interface BilletsData {
  billets: Billet[];
}
