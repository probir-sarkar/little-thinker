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
