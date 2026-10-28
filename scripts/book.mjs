#!/usr/bin/env node
/**
 * Builds the book from the same stories the website uses.
 *
 *   node scripts/book.mjs
 *
 * Output: book/book.html — one self-contained file, which is then handed to
 * WeasyPrint (PDF, with page numbers and a real contents list) and to pandoc
 * (EPUB). Neither step re-implements the layout; they only render this HTML.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STORIES = join(ROOT, "src", "content", "stories");
const OUT = join(ROOT, "book");

/** Frontmatter here is a flat list of `key: value` lines plus one string array. */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error("no frontmatter");
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (kv) {
      let v = kv[2].trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
      data[kv[1]] = v;
    }
  }
  return { data, body: m[2].trim() };
}

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const paragraphs = (body) =>
  body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, " ")}</p>`)
    .join("\n");

const stories = readdirSync(STORIES)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const { data, body } = parseFrontmatter(readFileSync(join(STORIES, f), "utf8"));
    return { ...data, body, slug: f.replace(/\.md$/, "") };
  })
  .sort((a, b) => Number(a.agesMin) - Number(b.agesMin) || a.title.localeCompare(b.title));

const coverArt = readFileSync(join(ROOT, "public", "illustration-stories.svg"), "utf8")
  .replace(/<\?xml[^>]*\?>/, "")
  .replace(/<svg([^>]*)width="[^"]*"([^>]*)height="[^"]*"/, '<svg$1$2');

const chapters = stories
  .map((s, i) => {
    const n = String(i + 1).padStart(2, "0");
    return `
    <section class="chapter" id="ch-${n}">
      <p class="ch-num">Chapter ${Number(n)}</p>
      <h1>${esc(s.title)}</h1>
      <p class="ch-src">${esc(s.source)} · ages ${s.agesMin}–${s.agesMax}</p>
      <div class="story">
${paragraphs(s.body)}
      </div>
      <div class="card">
        <p class="card-label">The question</p>
        <p class="card-q">${esc(s.ask)}</p>
      </div>
      <div class="provenance">
        <p class="prov-label">Where this comes from</p>
        <p class="prov-text">${esc(s.sourceNote)}</p>
      </div>
    </section>`;
  })
  .join("\n");

const contents = stories
  .map(
    (s, i) =>
      `<li><a href="#ch-${String(i + 1).padStart(2, "0")}">${esc(s.title)}</a></li>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>Twenty Questions for the Table</title>
<meta name="author" content="Little Thinker">
<meta name="description" content="Twenty old stories, each ending in the question it was invented to ask. Philosophy for children, ages 6–12.">
<style>
  /* ---------- the page ---------- */
  @page {
    size: A4;
    margin: 18mm 20mm 18mm;
    @bottom-center {
      content: counter(page);
      font-family: "Atkinson Hyperlegible", sans-serif;
      font-size: 8.5pt;
      color: #6b6257;
    }
    @top-right {
      content: string(chapter);
      font-family: "Atkinson Hyperlegible", sans-serif;
      font-size: 7.5pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9a9083;
    }
  }
  @page cover { margin: 0; @bottom-center { content: none } @top-right { content: none } }
  @page front { @top-right { content: none } }

  html { font-size: 10.1pt; }
  body {
    font-family: "Atkinson Hyperlegible", sans-serif;
    color: #2a2118;
    line-height: 1.5;
    margin: 0;
    hyphens: none;
  }
  h1, .card-q { font-family: Fraunces, serif; font-weight: 600; }

  /* ---------- cover ---------- */
  .cover { page: cover; height: 297mm; padding: 28mm 24mm 22mm; box-sizing: border-box; display: flex; flex-direction: column; }
  .cover-kicker { font-size: 8.5pt; letter-spacing: 0.24em; text-transform: uppercase; color: #6b6257; margin: 0 0 10mm; }
  .cover h1 { font-size: 42pt; line-height: 1.02; margin: 0 0 6mm; letter-spacing: -0.015em; }
  .cover-sub { font-size: 12pt; line-height: 1.45; max-width: 105mm; margin: 0 0 6mm; }
  .cover-note { font-size: 9pt; color: #6b6257; margin: 0; }
  .cover-art { margin-top: auto; }
  .cover-art svg { width: 100%; height: auto; }
  .cover-imprint { font-size: 8pt; letter-spacing: 0.06em; color: #6b6257; margin: 8mm 0 0; }

  /* ---------- front matter ---------- */
  .front { page: front; break-before: page; }
  .front h1 { font-size: 20pt; margin: 0 0 4mm; }
  .front p { max-width: 118mm; margin: 0 0 3.4mm; }
  .contents-h { font-size: 20pt; margin: 12mm 0 2mm; }
  .contents-note { font-size: 8.5pt; color: #6b6257; margin: 0 0 4mm; }
  ol.contents { list-style: none; padding: 0; margin: 0; }
  ol.contents li { font-size: 9.6pt; padding: 1.5mm 0; border-bottom: 0.3pt solid #d9d2c5; }
  ol.contents a { text-decoration: none; color: #2a2118; display: block; }
  ol.contents a::after {
    content: leader('.') " " target-counter(attr(href), page);
    color: #6b6257;
  }

  /* ---------- a chapter ---------- */
  .chapter { break-before: page; }
  .ch-num { font-size: 8.5pt; letter-spacing: 0.2em; color: #8a8072; margin: 0 0 1.5mm; }
  .chapter h1 { string-set: chapter content(); font-size: 19pt; line-height: 1.1; margin: 0 0 1.5mm; }
  .ch-src { font-size: 7.5pt; letter-spacing: 0.06em; text-transform: uppercase; color: #8a8072; margin: 0 0 4.5mm; }
  .story p { margin: 0 0 2.7mm; }
  .story p:first-child { text-indent: 0; }

  /* the card: the question, set apart from the story */
  .card {
    break-inside: avoid;
    margin: 6mm 0 0;
    padding: 5mm 6mm;
    border: 1.2pt solid #2a2118;
    border-radius: 3mm;
    background: #f7f0e2;
  }
  .card-label { font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; color: #6b6257; margin: 0 0 2.5mm; }
  .card-q { font-size: 14pt; line-height: 1.25; margin: 0; }

  /* provenance: metadata, clearly not story */
  .provenance { break-inside: avoid; margin: 4.5mm 0 0; padding-top: 2.5mm; border-top: 0.3pt solid #cfc6b6; }
  .prov-label { font-size: 7pt; letter-spacing: 0.18em; text-transform: uppercase; color: #9a9083; margin: 0 0 1.5mm; }
  .prov-text { font-size: 8.2pt; line-height: 1.45; color: #6b6257; margin: 0; }

  /* ---------- back ---------- */
  .back { break-before: page; }
  .back h1 { font-size: 20pt; margin: 0 0 4mm; }
  .back p { max-width: 118mm; margin: 0 0 3.4mm; }
  .back-end { font-size: 8.5pt; color: #6b6257; margin-top: 8mm; }
</style>
</head>
<body>

<section class="cover">
  <p class="cover-kicker">Little Thinker</p>
  <h1>Twenty questions<br>for the table</h1>
  <p class="cover-sub">Old stories — a cave, a ring, a ship — each one ending in a question nobody has settled.</p>
  <p class="cover-note">Philosophy for children · ages 6–12 · read it aloud</p>
  <div class="cover-art">${coverArt}</div>
  <p class="cover-imprint">little-thinker.browserstay.com</p>
</section>

<section class="front">
  <h1>How to use this book</h1>
  <p>Every story here is old, and every one of them was told to make somebody think rather than to make a point. None of them ends in an answer, on purpose. Read one aloud. Stop at the question. Then wait — the waiting is the part that works.</p>
  <p>If you are reading with a child, do not rescue them from the difficulty. If you are reading alone, write your answer down; a written answer is much easier to disagree with later. The stories get longer and heavier as the book goes on, and the ages printed with each story are a suggestion, not a rule.</p>

  <h1 class="contents-h">Contents</h1>
  <p class="contents-note">Each story names where it comes from. Page numbers are printed opposite.</p>
  <ol class="contents">
${contents}
  </ol>
</section>

${chapters}

<section class="back">
  <h1>Where these stories come from</h1>
  <p>Nothing in this book is invented. Each story is a retelling of something older — a Greek fable, a Chinese parable, a thought experiment from Plato, a Buddhist teaching, a folktale with no author left to thank. The words are ours; the stories are not. Every chapter names its source, and the website links the edition used.</p>
  <p class="back-end">little-thinker.browserstay.com — free, no accounts, no adverts, nothing collected.</p>
</section>

</body>
</html>
`;

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "book.html"), html);

// ---- markdown twin, for pandoc (EPUB) ----
const mdChapters = stories
  .map((s, i) => {
    const n = i + 1;
    return `# ${s.title}

<p class="ch-num">Chapter ${n}</p>

<p class="ch-src">${s.source} · ages ${s.agesMin}–${s.agesMax}</p>

${s.body}

<div class="card">
<p class="card-label">The question</p>
<p class="card-q">${s.ask}</p>
</div>

<div class="provenance">
<p class="prov-label">Where this comes from</p>
<p class="prov-text">${s.sourceNote}</p>
</div>
`;
  })
  .join("\n");

const mdContents = stories.map((s, i) => `${i + 1}. ${s.title}`).join("\n");

const markdown = `---
title: Twenty Questions for the Table
author: Little Thinker
lang: en-GB
description: Twenty old stories, each ending in the question it was invented to ask. Philosophy for children, ages 6–12.
---

# How to use this book

Every story here is old, and every one of them was told to make somebody think rather than to make a point. None of them ends in an answer, on purpose. Read one aloud. Stop at the question. Then wait — the waiting is the part that works.

If you are reading with a child, do not rescue them from the difficulty. If you are reading alone, write your answer down; a written answer is much easier to disagree with later. The stories get longer and heavier as the book goes on, and the ages printed with each story are a suggestion, not a rule.

${mdChapters}
# Where these stories come from

Nothing in this book is invented. Each story is a retelling of something older — a Greek fable, a Chinese parable, a thought experiment from Plato, a Buddhist teaching, a folktale with no author left to thank. The words are ours; the stories are not. Every chapter names its source, and the website links the edition used.

little-thinker.browserstay.com — free, no accounts, no adverts, nothing collected.

`;
writeFileSync(join(OUT, "book.md"), markdown);

console.log(`book: ${stories.length} chapters → book/book.html + book/book.md`);
