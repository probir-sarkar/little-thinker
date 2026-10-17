#!/usr/bin/env node
/**
 * Verifies the BUILT output against the URL contract, before anything is
 * deployed.
 *
 * Why this exists: this deploy has already broken twice in ways that a build
 * success and a checksum of dist/ would not catch —
 *   1. html_handling:"none" made "/" 404 while every deep page worked.
 *   2. build.format:"file" writes ideas.html, so any link to "/ideas/" is a
 *      dead link, because Cloudflare would look for ideas/index.html.
 * Both were invisible until a real HTTP request was made. This script makes
 * the same checks against dist/ locally, so the failure lands in CI instead
 * of on a reader's screen.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const dist = join(process.cwd(), "dist/client");
const root = existsSync(dist) ? dist : join(process.cwd(), "dist");

if (!existsSync(root)) {
  console.error("verify-dist: no build output found. Run `npm run build` first.");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(root);
const html = files.filter((f) => f.endsWith(".html"));

/** Map a site path to the file Cloudflare's auto-trailing-slash would serve. */
function resolves(pathname) {
  const clean = pathname.split(/[?#]/)[0];
  const rel = clean.replace(/^\//, "");
  const candidates = clean.endsWith("/")
    ? [join(root, rel, "index.html")]
    : [join(root, rel), join(root, `${rel}.html`), join(root, rel, "index.html")];
  return candidates.some((c) => existsSync(c) && statSync(c).isFile());
}

const failures = [];

// 1. the front door, the exact thing that 404'd in production
if (!resolves("/")) failures.push("`/` does not resolve to index.html");

// 2. every internal link
let checked = 0;
for (const file of html) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/href="(\/[^"]*)"/g)) {
    const href = m[1];
    if (href.startsWith("//")) continue;
    checked++;
    if (!resolves(href)) {
      failures.push(`${relative(root, file)} -> ${href} does not resolve`);
    }
  }
}

// 3. no link should rely on a trailing slash (would need an index.html)
for (const file of html) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/href="(\/(?:philosophers|ideas|grown-ups|wonder-wall|credits)\/)"/g)) {
    failures.push(`${relative(root, file)} -> ${m[1]} has a trailing slash but no index.html exists there`);
  }
}

// 4. a custom 404 page must ship, since not_found_handling is "404-page"
if (!existsSync(join(root, "404.html"))) failures.push("no 404.html — not_found_handling expects one");

console.log(`verify-dist: ${html.length} pages, ${checked} internal links checked`);

if (failures.length) {
  console.error(`\n  ${failures.length} PROBLEM(S):`);
  for (const f of [...new Set(failures)].slice(0, 40)) console.error(`    ${f}`);
  console.error("");
  process.exit(1);
}
console.log("  every internal link resolves; / and 404.html present.");
