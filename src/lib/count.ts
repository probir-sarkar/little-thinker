const ONES = [
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
];

const TEENS = [
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
];

const TENS = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** Small counts are written as words in running copy — "9 philosophers"
 *  reads like a database row, "nine philosophers" reads like a sentence.
 *  Centralised so the number and the copy can never drift apart. */
export function wordOf(n: number): string {
  if (n < 0 || !Number.isInteger(n)) return String(n);
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10) - 2];
    const ones = n % 10;
    return ones ? `${tens}-${ONES[ones]}` : tens;
  }
  return String(n);
}

/** 1 -> "one philosopher", 15 -> "fifteen philosophers" */
export function countOf(n: number, singular: string, plural = `${singular}s`): string {
  return `${wordOf(n)} ${n === 1 ? singular : plural}`;
}

/** "fifty-two" -> "Fifty-two", for the start of a sentence or a heading. */
export function capitalise(n: number): string {
  const w = wordOf(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
}
