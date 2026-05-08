export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,;:!?()«»"'`\-]/g, " ")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchKeyTerms(
  userAnswer: string,
  keyTerms: string[],
): {
  found: string[];
  missing: string[];
} {
  const norm = normalize(userAnswer);
  const found: string[] = [];
  const missing: string[] = [];
  for (const term of keyTerms) {
    if (norm.includes(normalize(term))) {
      found.push(term);
    } else {
      missing.push(term);
    }
  }
  return { found, missing };
}
