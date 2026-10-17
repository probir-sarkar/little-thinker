#!/usr/bin/env node
/**
 * Fails the build if anything references an icon that the sprite does not
 * define.
 *
 * Why this exists: a wrong icon id renders as nothing at all. The page still
 * builds, the HTML still validates, and the only symptom is a gap where a
 * drawing should be — which is exactly the kind of thing that ships. This
 * turns it into a loud build error instead.
 *
 * Checks two sources: `icon:` in content frontmatter, and name="..." on
 * <Icon /> usage in .astro files.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const spritePath = join(root, "public/icons.svg");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(astro|ts|js|md|mdx)$/.test(entry)) out.push(p);
  }
  return out;
}

// 1. icon ids the sprite actually defines
let defined = new Set();
if (existsSync(spritePath)) {
  const svg = readFileSync(spritePath, "utf8");
  for (const m of svg.matchAll(/<symbol[^>]*\sid="([^"]+)"/g)) {
    defined.add(m[1].replace(/^icon-/, ""));
  }
}

// 2. icon names the rest of the repo asks for
const used = new Map(); // name -> [files]
const add = (name, file) => {
  if (!name || name.includes("{")) return; // dynamic, checked at render
  if (!used.has(name)) used.set(name, new Set());
  used.get(name).add(file.replace(root + "/", ""));
};

for (const file of walk(join(root, "src"))) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/^icon:\s*"?([A-Za-z0-9_-]+)"?/gm)) add(m[1], file);
  for (const m of text.matchAll(/<Icon\s[^>]*name="([A-Za-z0-9_-]+)"/g)) add(m[1], file);
}

if (defined.size === 0) {
  console.warn("check-icons: public/icons.svg has no <symbol> ids yet — skipping validation.");
  process.exit(0);
}

const missing = [...used.entries()].filter(([name]) => !defined.has(name));
const unused = [...defined].filter((name) => !used.has(name));

console.log(`check-icons: ${defined.size} defined, ${used.size} referenced`);
if (unused.length) console.log(`  unused in this build: ${unused.sort().join(", ")}`);

if (missing.length) {
  console.error("\n  UNDEFINED ICONS:");
  for (const [name, files] of missing) {
    console.error(`    icon-${name}  <- ${[...files].join(", ")}`);
  }
  console.error("\n  Add the symbol to public/icons.svg or fix the name in content.\n");
  process.exit(1);
}
console.log("  all referenced icons exist in the sprite.");
