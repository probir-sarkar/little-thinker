#!/usr/bin/env node
/**
 * Builds the book from the same stories the website uses.
 *
 *   node scripts/book.mjs
 *
 * Writes book/book.html and book/book.md. The HTML goes to WeasyPrint (PDF:
 * page numbers, real contents list); the markdown goes to pandoc (EPUB).
 *
 * A story and its afterword are separated in the markdown source by a `---`
 * rule, so the retelling is never broken up by commentary. Each chapter is a
 * plate page (picture + caption) facing a text page (story, question, afterword).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STORIES = join(ROOT, "src", "content", "stories");
const OUT = join(ROOT, "book");
const IMG_OUT = join(OUT, "img");

/** Frontmatter here is a flat list of `key: value` lines. */
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

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const paragraphs = (text) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, " ")}</p>`)
    .join("\n");

/** A body is "story --- afterword". That rule is what keeps them apart. */
function splitBody(body) {
  const parts = body.split(/\n-{3,}\n/);
  const after = (parts[1] ?? "").trim().replace(/^#{1,6}\s*After the story\s*\n+/i, "");
  return { story: parts[0].trim(), after };
}

const credits = JSON.parse(readFileSync(join(ROOT, "src", "data", "credits.json"), "utf8"));
const creditFor = (file) => credits.find((c) => c.file === file);

/** Commons metadata carries file names; print wants a title. */
const cleanTitle = (title = "") => {
  let s = title;
  try { s = decodeURIComponent(s); } catch {}
  return s.replace(/^File:/, "").replace(/\.(jpe?g|png|tiff?|gif)$/i, "").replace(/_/g, " ").trim();
};

const stories = readdirSync(STORIES)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const { data, body } = parseFrontmatter(readFileSync(join(STORIES, f), "utf8"));
    return { ...data, ...splitBody(body), slug: f.replace(/\.md$/, "") };
  })
  .sort((a, b) => Number(a.agesMin) - Number(b.agesMin) || a.title.localeCompare(b.title));

// ---- pictures: one plate per story, downsampled for print ----
let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn("book: sharp not available — pictures copied at full size");
}
if (!existsSync(IMG_OUT)) mkdirSync(IMG_OUT, { recursive: true });

const plates = [];
for (const s of stories) {
  const local = join(ROOT, "src", "assets", "images", s.heroImage ?? "");
  const out = join(IMG_OUT, `${s.slug}.jpg`);
  const credit = creditFor(s.heroImage);

  if (!existsSync(out)) {
    // Commons often serves a downsized thumbnail to the site; the original is
    // better for print. Try it, and fall back to whatever the site already has.
    let input = null;
    const tmp = join(IMG_OUT, `${s.slug}.orig`);
    if (credit?.direct_url) {
      try {
        const res = await fetch(credit.direct_url, { signal: AbortSignal.timeout(30000) });
        if (res.ok) {
          writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
          input = tmp;
        }
      } catch {
        console.warn(`book: original unavailable for ${s.slug}`);
      }
    }
    if (!input && existsSync(local)) input = local;
    if (!input) {
      console.warn(`book: no picture for ${s.slug}`);
      continue;
    }
    if (sharp) {
      const meta = await sharp(input).metadata();
      await sharp(input)
        .resize({ width: Math.min(meta.width ?? 1800, 1800), withoutEnlargement: true })
        .jpeg({ quality: 84, mozjpeg: true })
        .toFile(out);
      if (existsSync(tmp)) unlinkSync(tmp);
    } else {
      writeFileSync(out, readFileSync(input));
    }
  }
  const px = sharp ? (await sharp(out).metadata()).width ?? 0 : 0;
  // print at ~150 dpi: a 695px scan has no business being 170mm wide
  const widthMm = px ? Math.min(166, Math.round((px / 125) * 25.4)) : 166;
  plates.push({ slug: s.slug, file: `img/${s.slug}.jpg`, credit, widthMm });
}

const plateFor = (slug) => plates.find((p) => p.slug === slug);

const coverArt = readFileSync(join(ROOT, "public", "illustration-stories.svg"), "utf8")
  .replace(/<\?xml[^>]*\?>/, "")
  .replace(/<svg([^>]*)width="[^"]*"([^>]*)height="[^"]*"/, "<svg$1$2");

// ---- chapters: plate page, then text page ----
const chapters = stories
  .map((s, i) => {
    const n = i + 1;
    const plate = plateFor(s.slug);
    const credit = plate?.credit;
    const caption = credit
      ? `${esc(cleanTitle(credit.title))} — ${esc(credit.author)}, ${esc(credit.license)}`
      : "";
    return `
    <section class="plate" id="ch-${String(n).padStart(2, "0")}">
      <p class="plate-num">Chapter ${n}</p>
      <h1 class="plate-title">${esc(s.title)}</h1>
      <p class="plate-src">${esc(s.source)} · ages ${s.agesMin}–${s.agesMax}</p>
      ${
        plate
          ? `<div class="plate-body"><figure class="plate-figure">
        <img class="plate-img" style="max-width:${plate.widthMm}mm" src="${plate.file}" alt="${esc(s.heroImageAlt ?? s.title)}">
        <figcaption class="plate-caption">${caption}</figcaption>
      </figure></div>`
          : ""
      }
    </section>

    <section class="text">
      <div class="story">
${paragraphs(s.story)}
      </div>
      <div class="card">
        <p class="card-label">The question</p>
        <p class="card-q">${esc(s.ask)}</p>
      </div>
      ${
        s.after
          ? `<div class="after">
        <p class="after-label">After the story</p>
${paragraphs(s.after)}
      </div>`
          : ""
      }
      <p class="prov">${esc(s.sourceNote)}</p>
    </section>`;
  })
  .join("\n");

const contents = stories
  .map((s, i) => `<li><a href="#ch-${String(i + 1).padStart(2, "0")}">${esc(s.title)}</a></li>`)
  .join("\n");

const creditRows = plates
  .filter((p) => p.credit)
  .map(
    (p) => `<li><span class="cr-title">${esc(cleanTitle(p.credit.title))}</span>
      <span class="cr-meta">${esc(p.credit.author)} · ${esc(p.credit.license)} · Wikimedia Commons</span></li>`,
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
  @page {
    size: A4;
    margin: 20mm 22mm 20mm;
    @bottom-center {
      content: counter(page);
      font-family: "Atkinson Hyperlegible", sans-serif;
      font-size: 8.5pt;
      color: #6b6257;
    }
    @top-right {
      content: string(chaptitle);
      font-family: "Atkinson Hyperlegible", sans-serif;
      font-size: 7pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #9a9083;
    }
  }
  @page cover { margin: 0; @bottom-center { content: none } @top-right { content: none } }
  @page plain { @top-right { content: none } }

  html { font-size: 10pt; }
  body {
    font-family: "Atkinson Hyperlegible", sans-serif;
    color: #2a2118;
    line-height: 1.5;
    margin: 0;
    hyphens: none;
  }
  h1, .card-q { font-family: Fraunces, serif; font-weight: 600; }

  /* cover */
  .cover { page: cover; height: 297mm; padding: 30mm 24mm 20mm; box-sizing: border-box; display: flex; flex-direction: column; }
  .cover-kicker { font-size: 8pt; letter-spacing: 0.26em; text-transform: uppercase; color: #6b6257; margin: 0 0 12mm; }
  .cover h1 { font-size: 41pt; line-height: 1.02; margin: 0 0 7mm; letter-spacing: -0.015em; }
  .cover-sub { font-size: 11.5pt; line-height: 1.45; max-width: 100mm; margin: 0 0 7mm; }
  .cover-note { font-size: 8.8pt; color: #6b6257; margin: 0; }
  .cover-art { margin-top: auto; }
  .cover-art svg { width: 100%; height: auto; }
  .cover-imprint { font-size: 7.8pt; letter-spacing: 0.06em; color: #6b6257; margin: 7mm 0 0; }

  /* front matter */
  .front { page: plain; break-before: page; }
  .front h1 { font-size: 19pt; margin: 0 0 4mm; }
  .front p { max-width: 116mm; margin: 0 0 3.2mm; }
  .contents-h { font-size: 19pt; margin: 0 0 3mm; break-before: page; }
  ol.contents { list-style: none; padding: 0; margin: 0; }
  ol.contents li { font-size: 9.4pt; padding: 1.5mm 0; border-bottom: 0.3pt solid #d9d2c5; }
  ol.contents a { text-decoration: none; color: #2a2118; display: block; }
  ol.contents a::after { content: leader('.') " " target-counter(attr(href), page); color: #6b6257; }

  /* plate: the picture gets the page that faces the story */
  .plate {
    break-before: page; page: plain; height: 257mm;
    display: flex; flex-direction: column;
  }
  /* nested flex + centre: reliable in WeasyPrint, unlike 1fr grid rows */
  /* optical centring: a touch above the geometric middle reads as balanced */
  .plate-body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding-bottom: 14mm; }
  .plate-num { font-size: 7.5pt; letter-spacing: 0.22em; text-transform: uppercase; color: #9a9083; margin: 0 0 2mm; }
  .plate-title { font-size: 22pt; line-height: 1.08; margin: 0 0 2mm; }
  .plate-src { font-size: 7.5pt; letter-spacing: 0.05em; text-transform: uppercase; color: #8a8072; margin: 0 0 6mm; }
  .plate-figure { margin: 0; text-align: center; }
  .plate-img { max-width: 100%; max-height: 178mm; object-fit: contain; display: block; margin: 0 auto; border: 0.3pt solid #ddd5c6; }
  .plate-caption { font-size: 7.4pt; line-height: 1.4; color: #8a8072; margin: 4mm auto 0; max-width: 132mm; }

  /* text page */
  .text { break-before: page; }
  .story p { font-size: 10.4pt; line-height: 1.55; margin: 0 0 3mm; }
  .card {
    break-inside: avoid;
    margin: 6mm 0 0;
    padding: 5mm 6mm;
    border: 1.1pt solid #2a2118;
    border-radius: 2.5mm;
    background: #f8f1e4;
  }
  .card-label { font-size: 7pt; letter-spacing: 0.2em; text-transform: uppercase; color: #6b6257; margin: 0 0 2mm; }
  .card-q { font-size: 14pt; line-height: 1.26; margin: 0; }

  .after { break-inside: avoid; margin: 5mm 0 0; padding-top: 3mm; border-top: 0.3pt solid #cfc6b6; }
  .after-label { font-size: 7pt; letter-spacing: 0.18em; text-transform: uppercase; color: #8a8072; margin: 0 0 2mm; }
  .after p { font-size: 9pt; line-height: 1.48; color: #4a4239; margin: 0 0 2.4mm; }
  .prov { font-size: 7.4pt; line-height: 1.4; color: #9a9083; margin: 4mm 0 0; }

  /* back matter */
  .back, .credits { page: plain; break-before: page; }
  .back h1, .credits h1 { font-size: 19pt; margin: 0 0 4mm; }
  .back p { max-width: 116mm; margin: 0 0 3.2mm; }
  ul.credits-list { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 9mm; }
  ul.credits-list li { break-inside: avoid; }
  ul.credits-list li { padding: 1.5mm 0; border-bottom: 0.3pt solid #e2dbcd; }
  .cr-title { display: inline; font-size: 7.6pt; line-height: 1.35; }
  .cr-meta { display: block; font-size: 6.9pt; color: #8a8072; margin-top: 0.3mm; }
  .credits-note { font-size: 7.8pt; color: #6b6257; margin: 6mm 0 0; max-width: 120mm; }
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
  <p>Each chapter has a picture and a story. The <em>question</em> box is where you stop. What follows it, under “After the story”, is for whoever wants to keep going: the history, the argument, the part that is still unsettled. Read it aloud too, or leave it.</p>
  <p>If you are reading with a child, do not rescue them from the difficulty. If you are reading alone, write your answer down; a written answer is much easier to disagree with later. The ages printed with each story are a suggestion, not a rule.</p>

  <h1 class="contents-h">Contents</h1>
  <ol class="contents">
${contents}
  </ol>
</section>

${chapters}

<section class="credits">
  <h1>Picture credits</h1>
  <ul class="credits-list">
${creditRows}
  </ul>
  <p class="credits-note">Every picture is a public-domain or openly licensed work from Wikimedia Commons, credited above and linked on the website. Nothing here was generated.</p>
</section>

<section class="back">
  <h1>Where these stories come from</h1>
  <p>Nothing in this book is invented. Each story is a retelling of something older — a Greek fable, a Chinese parable, a thought experiment from Plato, a Buddhist teaching, a folktale with no author left to thank. The words are ours; the stories are not. Every chapter names its source, and the website links the edition used.</p>
  <p>little-thinker.browserstay.com — free, no accounts, no adverts, nothing collected.</p>
</section>

</body>
</html>
`;

// ---- markdown twin, for pandoc (EPUB) ----
const mdChapters = stories
  .map((s, i) => {
    const plate = plateFor(s.slug);
    const credit = plate?.credit;
    return `# ${s.title}

<p class="plate-src">Chapter ${i + 1} · ${esc(s.source)} · ages ${s.agesMin}–${s.agesMax}</p>

${plate ? `![${s.heroImageAlt ?? s.title}](${plate.file})\n\n<p class="cap">${esc(cleanTitle(credit?.title))} — ${esc(credit?.author ?? "")}, ${esc(credit?.license ?? "")}</p>\n` : ""}
${s.story}

<div class="card">
<p class="card-label">The question</p>
<p class="card-q">${esc(s.ask)}</p>
</div>

${
  s.after
    ? `<div class="after">\n<p class="after-label">After the story</p>\n\n${s.after}\n</div>\n`
    : ""
}
<p class="prov">${esc(s.sourceNote)}</p>
`;
  })
  .join("\n");

const markdown = `---
title: Twenty Questions for the Table
author: Little Thinker
lang: en-GB
description: Twenty old stories, each ending in the question it was invented to ask. Philosophy for children, ages 6–12.
---

# How to use this book

Every story here is old, and every one of them was told to make somebody think rather than to make a point. None of them ends in an answer, on purpose. Read one aloud. Stop at the question. Then wait — the waiting is the part that works.

Each chapter has a picture and a story. The *question* box is where you stop. What follows it, under “After the story”, is for whoever wants to keep going.

If you are reading with a child, do not rescue them from the difficulty. If you are reading alone, write your answer down; a written answer is much easier to disagree with later.

${mdChapters}

# Picture credits

${plates
  .filter((p) => p.credit)
  .map((p) => `- ${esc(cleanTitle(p.credit.title))} — ${esc(p.credit.author)}, ${esc(p.credit.license)} (Wikimedia Commons)`)
  .join("\n")}

Every picture is a public-domain or openly licensed work from Wikimedia Commons, credited above and linked on the website. Nothing here was generated.

# Where these stories come from

Nothing in this book is invented. Each story is a retelling of something older — a Greek fable, a Chinese parable, a thought experiment from Plato, a Buddhist teaching, a folktale with no author left to thank. The words are ours; the stories are not. Every chapter names its source, and the website links the edition used.

little-thinker.browserstay.com — free, no accounts, no adverts, nothing collected.
`;

writeFileSync(join(OUT, "book.html"), html);
writeFileSync(join(OUT, "book.md"), markdown);
console.log(`book: ${stories.length} chapters, ${plates.length} plates → book/book.html + book/book.md`);
