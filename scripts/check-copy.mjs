#!/usr/bin/env node
/**
 * Fails the build if tooling vocabulary reaches a rendered page.
 *
 * Why: this is a public site for readers. A first pass shipped an
 * "Accessibility notes" section, an "Adding to the library" paragraph and
 * chart labels like "Chart · counted from this site's own content" onto pages
 * a child might open. That is a copy mistake code review does not catch,
 * because the page still renders perfectly.
 *
 * Scans visible text only — tags, attributes, scripts and styles are stripped
 * first, so class names and structured data cannot produce false positives.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const dist = process.cwd();
const root = existsSync(join(dist, "dist", "index.html"))
  ? join(dist, "dist")
  : join(dist, "dist", "client");

if (!existsSync(root)) {
  console.error("check-copy: no build output. Run `npm run build` first.");
  process.exit(1);
}

// Words that mean nothing to a reader and everything about how the site is made.
const BANNED = [
  "astro",
  "tailwind",
  "svg",
  "json",
  "markdown",
  "frontmatter",
  "localstorage",
  "npm",
  "wrangler",
  "cloudflare",
  "repo",
  "component",
  "stylesheet",
  "html",
  "css",
  "regex",
  "database",
  "api",
  "script",
  "build time",
  "deploy",
  "preact",
  "island",
  "chart · ",
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

const problems = [];
const pages = walk(root);

for (const page of pages) {
  const text = visibleText(readFileSync(page, "utf8")).toLowerCase();
  for (const word of BANNED) {
    // Word-boundary match on both sides: "astro" must not fire on "astronomy",
    // and "api" must not fire inside "rapidly".
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, "g");
    const match = re.exec(text);
    if (!match) continue;
    const at = match.index;
    const context = text.slice(Math.max(0, at - 45), at + 45).trim();
    problems.push({ page: relative(root, page), word, context });
  }
}

console.log(`check-copy: scanned ${pages.length} pages for tooling vocabulary`);

if (problems.length) {
  console.error(`\n  ${problems.length} PLACE(S) WHERE THE BUILD SHOWS THROUGH:\n`);
  for (const p of problems) {
    console.error(`    ${p.page}  [${p.word}]`);
    console.error(`      …${p.context}…`);
  }
  console.error("");
  process.exit(1);
}
console.log("  no tooling vocabulary in any rendered page.");
