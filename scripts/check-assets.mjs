#!/usr/bin/env node
/**
 * Fails the build when a page points at an image file that does not exist.
 *
 * Why this exists: this exact bug shipped three times. A portrait downloaded as
 * PNG while the page declared .jpg (Hypatia, then Marcus Aurelius) does not
 * error — the component quietly falls back to a drawn monogram medallion, so
 * the only symptom is one philosopher looking different from the rest. That is
 * invisible to a build log and easy to miss in review.
 *
 * Checks, in order of how bad the failure would be:
 *   1. every philosopher's and story's declared heroImage exists with that
 *      exact filename
 *   2. every credited file exists
 *   3. every credit slug maps to a philosopher, a story or a scene
 *   4. no image sits on disk uncredited
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const root = process.cwd();
const IMG = join(root, "src", "assets", "images");
const PH = join(root, "src", "content", "philosophers");
const ST = join(root, "src", "content", "stories");

const onDisk = new Set(readdirSync(IMG));
const problems = [];

// 1. declared hero images (philosophers and stories use the same frontmatter key)
const phSlugs = readdirSync(PH).filter((f) => f.endsWith(".md")).map((f) => basename(f, ".md"));
const stSlugs = readdirSync(ST).filter((f) => f.endsWith(".md")).map((f) => basename(f, ".md"));
const slugs = [...phSlugs, ...stSlugs];
const heroOf = {};
const noHero = [];

for (const [dir, slugsHere] of [[PH, phSlugs], [ST, stSlugs]]) {
  for (const slug of slugsHere) {
    const text = readFileSync(join(dir, `${slug}.md`), "utf8");
    const m = text.match(/^heroImage:\s*"?([^"\n]+)"?/m);
    if (!m) continue;
    const declared = m[1].trim();
    heroOf[slug] = declared;
    if (declared === "" || declared === "null") { noHero.push(slug); continue; }
    if (!onDisk.has(declared)) {
      // A near-miss in the same family is almost always the real culprit.
      const stem = declared.replace(/\.[^.]+$/, "");
      const near = [...onDisk].filter((f) => f.startsWith(stem));
      problems.push(
        `${slug}: declares "${declared}" which does not exist` +
          (near.length ? ` — did you mean ${near.join(" or ")}?` : " (no similar file on disk)"),
      );
    }
  }
}

// 2-4. credits
const creditsPath = join(root, "src", "data", "credits.json");
const credits = JSON.parse(readFileSync(creditsPath, "utf8"));
const sceneSlugs = new Set(credits.filter((c) => c.slug.startsWith("scene-")).map((c) => c.slug));

for (const c of credits) {
  if (!onDisk.has(c.file)) problems.push(`credits: "${c.slug}" lists ${c.file}, not on disk`);
  if (!phSlugs.includes(c.slug) && !stSlugs.includes(c.slug) && !sceneSlugs.has(c.slug)) {
    problems.push(`credits: "${c.slug}" matches no philosopher, story or scene- entry`);
  }
}

const credited = new Set(credits.map((c) => c.file));
for (const file of onDisk) {
  if (!credited.has(file)) {
    problems.push(`${file} is on disk but has no credits entry — it could ship uncredited`);
  }
}

console.log(
  `check-assets: ${phSlugs.length} philosophers, ${stSlugs.length} stories, ${onDisk.size} images, ${credits.length} credit records`,
);
if (noHero.length) {
  console.log(`  using the drawn fallback (no image declared): ${noHero.join(", ")}`);
}

if (problems.length) {
  console.error(`\n  ${problems.length} ASSET PROBLEM(S):\n`);
  for (const p of problems) console.error(`    ${p}`);
  console.error("");
  process.exit(1);
}
console.log("  every declared image exists and is credited.");
