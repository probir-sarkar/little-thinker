const WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

/** Small counts are written as words in running copy — "9 philosophers"
 *  reads like a database row, "nine philosophers" reads like a sentence.
 *  Centralised so the number and the copy can never drift apart. */
export function localeCount(n: number): string {
  return `${WORDS[n] ?? n} ${n === 1 ? "philosopher" : "philosophers"}`;
}

export function wordCount(n: number): string {
  return WORDS[n] ?? String(n);
}

/** 1 -> "one philosopher", 15 -> "fifteen philosophers" */
export function countOf(n: number, singular: string, plural = `${singular}s`): string {
  return `${wordOf(n)} ${n === 1 ? singular : plural}`;
}

export function wordOf(n: number): string {
  return WORDS[n] ?? String(n);
}

/** "fifteen" -> "Fifteen", for the start of a sentence or a heading. */
export function Capitalised(n: number): string {
  const w = wordOf(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
}
