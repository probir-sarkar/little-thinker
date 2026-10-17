import branches from "../data/branches.json";

export type BranchKey = keyof typeof branches;

export interface BranchMeta {
  name: string;
  color: string;
  note: string;
}

export const BRANCHES = branches as Record<BranchKey, BranchMeta>;

export const branchList = (Object.keys(BRANCHES) as BranchKey[]).map((key) => ({
  key,
  ...BRANCHES[key],
}));

export function branchOf(key: string): BranchMeta {
  const b = BRANCHES[key as BranchKey];
  if (!b) throw new Error(`Unknown branch "${key}" — check content frontmatter against src/data/branches.json`);
  return b;
}

/** Era buckets used by the philosophers index filter. */
export function eraOf(birthYear: number): "ancient" | "medieval" | "modern" {
  if (birthYear < 1000) return "ancient";
  if (birthYear < 1600) return "medieval";
  return "modern";
}

/** -469 -> "469 BCE", 1596 -> "1596" */
export function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : String(year);
}

export function lifespan(birth: number, death: number): string {
  return `${formatYear(birth)} – ${formatYear(death)}`;
}
