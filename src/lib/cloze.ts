import type { TheoryCard } from "../types/billets";

export interface ClozeBlank {
  index: number;
  expected: string;
}

export interface ClozeText {
  parts: string[];
  blanks: ClozeBlank[];
}

export function buildCloze(card: TheoryCard): ClozeText {
  const text = card.content.replace(/\*\*/g, "");
  const terms = card.key_terms.slice(0, 3);

  if (terms.length === 0) {
    return { parts: [text], blanks: [] };
  }

  const found: { term: string; index: number }[] = [];
  for (const term of terms) {
    const i = text.toLowerCase().indexOf(term.toLowerCase());
    if (i >= 0) found.push({ term, index: i });
  }
  found.sort((a, b) => a.index - b.index);

  if (found.length === 0) return { parts: [text], blanks: [] };

  const parts: string[] = [];
  const blanks: ClozeBlank[] = [];
  let cursor = 0;
  for (let i = 0; i < found.length; i++) {
    const { term, index } = found[i];
    parts.push(text.slice(cursor, index));
    blanks.push({ index: i, expected: term });
    cursor = index + term.length;
  }
  parts.push(text.slice(cursor));

  return { parts, blanks };
}

export function checkBlank(actual: string, expected: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,;:!?()«»"'`-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return norm(actual) === norm(expected);
}
