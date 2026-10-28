#!/usr/bin/env node
/**
 * Builds the book — one volume, three parts — from the same content the website
 * renders. There is no second copy of the text anywhere: stories, philosophers
 * and concepts are read straight out of src/content/.
 *
 *   node scripts/book.mjs
 *
 * Writes book/book.html (→ WeasyPrint: PDF with page numbers and a contents
 * list) and book/book.md (→ pandoc: EPUB).
 *
 * A story's retelling and its afterword are separated in the source by a `---`
 * rule; that rule is what keeps the commentary out of the middle of the tale.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "src", "content");
const OUT = join(ROOT, "book");
const IMG_OUT = join(OUT, "img");

const TITLE = "Philosophy for Children";
const SUBTITLE = "Stories, thinkers, and the questions they leave";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const readCollection = (name) =>
  readdirSync(join(CONTENT, name))
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = readFileSync(join(CONTENT, name, f), "utf8");
      const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      return { ...parseYaml(m[1]), body: m[2].trim(), slug: f.replace(/\.md$/, "") };
    });

const paragraphs = (text) =>
  (text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, " ")}</p>`)
    .join("\n");

const stories = readCollection("stories").sort(
  (a, b) => Number(a.agesMin) - Number(b.agesMin) || a.title.localeCompare(b.title),
);
const thinkers = readCollection("philosophers").sort(
  (a, b) => Number(a.birthYear ?? 0) - Number(b.birthYear ?? 0) || a.name.localeCompare(b.name),
);
const concepts = readCollection("concepts").sort((a, b) => a.title.localeCompare(b.title));

// ---------- pictures ----------
let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn("book: sharp not available — pictures copied at full size");
}
if (!existsSync(IMG_OUT)) mkdirSync(IMG_OUT, { recursive: true });

const credits = JSON.parse(readFileSync(join(ROOT, "src", "data", "credits.json"), "utf8"));
const creditFor = (file) => credits.find((c) => c.file === file);

const cleanTitle = (title = "") => {
  let s = title;
  try {
    s = decodeURIComponent(s);
  } catch {}
  return s
    .replace(/^File:/, "")
    .replace(/\.(jpe?g|png|tiff?|gif)$/i, "")
    .replace(/_/g, " ")
    .trim();
};

/** Downsample once, remember how wide it may print, and collect the credit. */
async function plate(entry, prefix) {
  if (!entry.heroImage) return null;
  const local = join(ROOT, "src", "assets", "images", entry.heroImage);
  if (!existsSync(local)) return null;
  const out = join(IMG_OUT, `${prefix}-${entry.slug}.jpg`);
  if (!existsSync(out)) {
    if (sharp) {
      const meta = await sharp(local).metadata();
      await sharp(local)
        .resize({ width: Math.min(meta.width ?? 1500, 1500), withoutEnlargement: true })
        .jpeg({ quality: 84, mozjpeg: true })
        .toFile(out);
    } else {
      writeFileSync(out, readFileSync(local));
    }
  }
  const px = sharp ? ((await sharp(out).metadata()).width ?? 0) : 0;
  return {
    file: `img/${prefix}-${entry.slug}.jpg`,
    widthMm: px ? Math.min(150, Math.round((px / 125) * 25.4)) : 150,
    credit: creditFor(entry.heroImage) ?? null,
  };
}

const storyPlates = new Map();
for (const s of stories) storyPlates.set(s.slug, await plate(s, "story"));

const thinkerPlates = new Map();
for (const t of thinkers) thinkerPlates.set(t.slug, await plate(t, "thinker"));

const allPlates = [
  ...[...storyPlates.values()],
  ...[...thinkerPlates.values()],
].filter((p) => p?.credit);

const elephant = stories.find((s) => s.slug === "the-elephant");
const elephantPlate = elephant ? storyPlates.get(elephant.slug) : null;
const coverPlate = elephantPlate
  ? { file: elephantPlate.file, alt: elephant.heroImageAlt ?? "Blind men examining an elephant" }
  : null;

const coverArt = readFileSync(join(ROOT, "public", "illustration-stories.svg"), "utf8")
  .replace(/<\?xml[^>]*\?>/, "")
  .replace(/<svg([^>]*)width="[^"]*"([^>]*)height="[^"]*"/, "<svg$1$2");

const humanBranch = (b) => String(b ?? "").replace(/-/g, " ");

// ---------- part one: stories ----------
const storyChapters = stories
  .map((s, i) => {
    const p = storyPlates.get(s.slug);
    const caption = p?.credit
      ? `${esc(cleanTitle(p.credit.title))} — ${esc(p.credit.author)}, ${esc(p.credit.license)}`
      : "";
    const [story, after] = s.body.split(/\n-{3,}\n/).concat([""]);
    const afterText = (after ?? "").trim().replace(/^#{1,6}\s*After the story\s*\n+/i, "");
    return `
    <section class="plate" id="s-${s.slug}">
      <p class="plate-num">Story ${i + 1}</p>
      <h1 class="plate-title">${esc(s.title)}</h1>
      <p class="plate-src">${esc(s.source)} · ages ${s.agesMin}–${s.agesMax}</p>
      ${
        p
          ? `<div class="plate-body"><figure class="plate-figure">
        <img class="plate-img" style="max-width:${p.widthMm}mm" src="${p.file}" alt="${esc(s.heroImageAlt ?? s.title)}">
        <figcaption class="plate-caption">${caption}</figcaption>
      </figure></div>`
          : ""
      }
    </section>

    <section class="text">
      <div class="story">${paragraphs(story.trim())}</div>
      <div class="card">
        <p class="card-label">The question</p>
        <p class="card-q">${esc(s.ask)}</p>
      </div>
      ${afterText ? `<div class="after"><p class="after-label">After the story</p>${paragraphs(afterText)}</div>` : ""}
      <p class="prov">${esc(s.sourceNote)}</p>
    </section>`;
  })
  .join("\n");

// ---------- part two: thinkers ----------
const thinkerChapters = thinkers
  .map((t, i) => {
    const p = thinkerPlates.get(t.slug);
    const caption = p?.credit
      ? `${esc(cleanTitle(p.credit.title))} — ${esc(p.credit.author)}, ${esc(p.credit.license)}`
      : "";
    const facts = (t.facts ?? []).map((f) => `<li>${f}</li>`).join("");
    return `
    <section class="plate" id="t-${t.slug}">
      <p class="plate-num">Thinker ${i + 1}</p>
      <h1 class="plate-title">${esc(t.name)}</h1>
      <p class="plate-src">${esc(t.years)} · ${esc(t.place)} · ${esc(humanBranch(t.branch))}</p>
      <div class="plate-body">
        ${
          p
            ? `<figure class="plate-figure">
          <img class="plate-img" style="max-width:${p.widthMm}mm" src="${p.file}" alt="${esc(t.heroImageAlt ?? t.name)}">
          <figcaption class="plate-caption">${caption}</figcaption>
        </figure>`
            : `<p class="monogram">${esc(t.monogram ?? t.name.slice(0, 2))}</p>`
        }
      </div>
    </section>

    <section class="text">
      <p class="lede">${esc(t.oneLiner)}</p>
      <div class="story">${paragraphs(t.body)}</div>
      ${t.quote ? `<blockquote class="quote"><p>“${esc(t.quote)}”</p>${t.quoteNote ? `<footer>${esc(t.quoteNote)}</footer>` : ""}</blockquote>` : ""}
      <div class="card">
        <p class="card-label">The question</p>
        <p class="card-q">${esc(t.bigQuestion)}</p>
      </div>
      ${facts ? `<ul class="facts">${facts}</ul>` : ""}
      ${t.activity ? `<div class="tryit"><p class="tryit-label">Try this</p><p>${esc(t.activity)}</p></div>` : ""}
    </section>`;
  })
  .join("\n");

// ---------- part three: questions ----------
const ideaChapters = concepts
  .map((c) => {
    const thinkers = (c.keyThinkers ?? [])
      .map((k) => `<li><b>${esc(k.who ?? k)}</b> — ${esc(k.view ?? "")}</li>`)
      .join("");
    const objections = (c.objections ?? [])
      .map((o) => `<li><p class="obj-q">“${esc(o.challenge)}”</p><p class="obj-a">${esc(o.reply)}</p></li>`)
      .join("");
    const talk = (c.talk ?? []).map((q) => `<li>${esc(q)}</li>`).join("");
    const further = (c.goFurther ?? [])
      .map((g) => `<li><b>${esc(g.title)}</b>${g.who ? ` — ${esc(g.who)}` : ""}${g.note ? `. ${esc(g.note)}` : ""}</li>`)
      .join("");
    const related = (c.related ?? []).map((r) => esc(String(r).replace(/-/g, " "))).join(" · ");

    return `
    <section class="idea" id="q-${c.slug}">
      <p class="plate-num">Question · ${esc(humanBranch(c.branch))} · ages ${c.agesMin}–${c.agesMax}</p>
      <h1 class="idea-title">${esc(c.title)}</h1>
      <p class="lede">${esc(c.hook)}</p>
      <div class="story">${paragraphs(c.body)}</div>

      <div class="notes">
        ${thinkers ? `<div class="block"><p class="block-h">What the thinkers said</p><ul class="views">${thinkers}</ul></div>` : ""}
        ${objections ? `<div class="block"><p class="block-h">The usual objections</p><ul class="objs">${objections}</ul></div>` : ""}
        ${talk ? `<div class="block"><p class="block-h">Ask each other</p><ul class="asks">${talk}</ul></div>` : ""}
        ${c.tryIt ? `<div class="tryit"><p class="tryit-label">Try this</p><p>${esc(c.tryIt)}</p></div>` : ""}
        ${further ? `<div class="block"><p class="block-h">Go further</p><ul class="further">${further}</ul></div>` : ""}
        ${related ? `<p class="prov">Questions next door: ${related}</p>` : ""}
      </div>
    </section>`;
  })
  .join("\n");

// ---------- contents ----------
const contentsList = (items, kind) =>
  items
    .map((it) => {
      const [id, label] =
        kind === "story" ? [`s-${it.slug}`, it.title] : kind === "thinker" ? [`t-${it.slug}`, it.name] : [`q-${it.slug}`, it.title];
      return `<li><a href="#${id}">${esc(label)}</a></li>`;
    })
    .join("\n");

const creditRows = allPlates
  .map(
    (p) => `<li><span class="cr-title">${esc(cleanTitle(p.credit.title))}</span>
      <span class="cr-meta">${esc(p.credit.author)} · ${esc(p.credit.license)} · Wikimedia Commons</span></li>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${TITLE}: ${SUBTITLE}</title>
<meta name="author" content="Little Thinker">
<meta name="description" content="${stories.length} stories, ${thinkers.length} thinkers and ${concepts.length} questions. Philosophy for children, ages 6–12.">
<style>
  @page {
    size: A4;
    margin: 20mm 22mm 20mm;
    @bottom-center { content: counter(page); font-family: "Atkinson Hyperlegible", sans-serif; font-size: 8.5pt; color: #6b6257; }
    @top-right {
      content: string(entrytitle);
      font-family: "Atkinson Hyperlegible", sans-serif; font-size: 7pt;
      letter-spacing: 0.1em; text-transform: uppercase; color: #9a9083;
    }
  }
  @page cover { margin: 0; @bottom-center { content: none } @top-right { content: none } }
  @page plain { @top-right { content: none } }

  html { font-size: 10pt; }
  body { font-family: "Atkinson Hyperlegible", sans-serif; color: #2a2118; line-height: 1.5; margin: 0; hyphens: none; }
  h1, .card-q, .monogram, .part-title { font-family: Fraunces, serif; font-weight: 600; }

  /* cover: ink block, then the plate, then a quiet footer */
  .cover { page: cover; height: 297mm; padding: 0; display: flex; flex-direction: column; }
  .cover-top { background: #1e2a24; color: #f7f0e1; padding: 26mm 22mm 18mm; }
  .cover-kicker { font-size: 8pt; letter-spacing: 0.3em; text-transform: uppercase; color: #c2a878; margin: 0 0 16mm; }
  .cover h1 { font-family: Fraunces, serif; font-weight: 600; font-size: 56pt; line-height: 0.98; letter-spacing: -0.02em; margin: 0 0 9mm; color: #fdf8ec; }
  .cover-sub { font-size: 11.5pt; line-height: 1.42; max-width: 104mm; margin: 0 0 6mm; color: #e8dcc5; }
  .cover-note { font-size: 8.6pt; letter-spacing: 0.04em; color: #c2a878; margin: 0; }
  .cover-art { flex: 1; background: #f4ead6; display: flex; align-items: center; justify-content: center; padding: 10mm 16mm; }
  .cover-art img { max-width: 100%; max-height: 92mm; object-fit: contain; border: 0.6pt solid #b9a888; }
  .cover-art svg { width: 70%; height: auto; }
  .cover-foot {
    background: #1e2a24; color: #c2a878; padding: 6mm 22mm;
    display: flex; justify-content: space-between;
    font-size: 7.4pt; letter-spacing: 0.12em; text-transform: uppercase;
  }

  /* front matter */
  .front { page: plain; break-before: page; }
  .front h1 { font-size: 19pt; margin: 0 0 4mm; }
  .front p { max-width: 118mm; margin: 0 0 3.2mm; }
  .contents-h { font-size: 19pt; margin: 0 0 4mm; break-before: page; }
  .contents-part { font-family: Fraunces, serif; font-size: 10.5pt; margin: 4mm 0 1.5mm; }
  ol.contents { list-style: none; padding: 0; margin: 0 0 2mm; }
  ol.contents li { font-size: 8.8pt; padding: 0.9mm 0; border-bottom: 0.3pt solid #e6dfd1; }
  ol.contents a { text-decoration: none; color: #2a2118; display: block; }
  ol.contents a::after { content: leader('.') " " target-counter(attr(href), page); color: #6b6257; }

  /* part opener */
  .part { page: plain; break-before: page; height: 257mm; display: flex; flex-direction: column; justify-content: center; }
  .part-label { font-size: 7.5pt; letter-spacing: 0.24em; text-transform: uppercase; color: #8a8072; margin: 0 0 4mm; }
  .part-title { font-size: 30pt; line-height: 1.06; margin: 0 0 5mm; }
  .part-intro { font-size: 10.5pt; line-height: 1.5; max-width: 112mm; margin: 0; }

  /* plate pages */
  .plate { break-before: page; page: plain; height: 257mm; display: flex; flex-direction: column; }
  .plate-num { font-size: 7.5pt; letter-spacing: 0.22em; text-transform: uppercase; color: #9a9083; margin: 0 0 2mm; }
  .plate-title { font-size: 22pt; line-height: 1.08; margin: 0 0 2mm; string-set: entrytitle content(); break-after: avoid; }
  .plate-src { font-size: 7.5pt; letter-spacing: 0.05em; text-transform: uppercase; color: #8a8072; margin: 0 0 6mm; }
  .plate-body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding-bottom: 14mm; }
  .plate-figure { margin: 0; text-align: center; }
  .plate-img { max-width: 100%; max-height: 170mm; object-fit: contain; display: block; margin: 0 auto; border: 0.3pt solid #ddd5c6; }
  .plate-caption { font-size: 7.4pt; line-height: 1.4; color: #8a8072; margin: 4mm auto 0; max-width: 132mm; }
  .monogram { font-size: 120pt; line-height: 1; color: #e2d8c6; text-align: center; letter-spacing: 0.04em; margin: 0; }

  /* text pages */
  .text, .idea { break-before: page; }
  .story p { font-size: 10.2pt; line-height: 1.52; margin: 0 0 2.8mm; }
  .lede { font-family: Fraunces, serif; font-size: 12.5pt; line-height: 1.35; margin: 0 0 4mm; break-after: avoid; }
  .card {
    break-inside: avoid; margin: 5mm 0 0; padding: 5mm 6mm;
    border: 1.1pt solid #2a2118; border-radius: 2.5mm; background: #f8f1e4;
  }
  .card-label { font-size: 7pt; letter-spacing: 0.2em; text-transform: uppercase; color: #6b6257; margin: 0 0 2mm; }
  .card-q { font-size: 13.5pt; line-height: 1.25; margin: 0; }

  .after { break-inside: avoid; margin: 5mm 0 0; padding-top: 3mm; border-top: 0.3pt solid #cfc6b6; }
  .after-label { font-size: 7pt; letter-spacing: 0.18em; text-transform: uppercase; color: #8a8072; margin: 0 0 2mm; }
  .after p { font-size: 9pt; line-height: 1.45; color: #4a4239; margin: 0 0 2.2mm; }
  .prov { font-size: 7.4pt; line-height: 1.4; color: #9a9083; margin: 4mm 0 0; break-before: avoid; }

  .quote { break-inside: avoid; margin: 5mm 0 0; padding-left: 5mm; border-left: 1.5pt solid #cfc6b6; }
  .quote p { font-family: Fraunces, serif; font-size: 11.5pt; line-height: 1.35; margin: 0 0 2mm; }
  .quote footer { font-size: 7.6pt; line-height: 1.4; color: #8a8072; }

  ul.facts { margin: 5mm 0 0; padding-left: 4.5mm; }
  ul.facts li { font-size: 8.6pt; line-height: 1.45; margin: 0 0 1.6mm; color: #4a4239; }

  .tryit { break-inside: avoid; margin: 4mm 0 0; padding: 3.5mm 4mm; background: #f4eee2; border-radius: 2mm; }
  .tryit-label { font-size: 6.8pt; letter-spacing: 0.18em; text-transform: uppercase; color: #8a8072; margin: 0 0 1.2mm; }
  .tryit p { font-size: 8.6pt; line-height: 1.45; margin: 0; }

  .notes { break-before: page; }
  .block { margin: 5mm 0 0; }
  .block:first-child { margin-top: 0; }
  .block-h { font-size: 7pt; letter-spacing: 0.18em; text-transform: uppercase; color: #8a8072; margin: 0 0 2mm; }
  .views, .objs, .asks, .further { list-style: none; padding: 0; margin: 0; }
  .views li, .asks li, .further li { font-size: 8.7pt; line-height: 1.45; margin: 0 0 2mm; color: #3a332b; }
  .objs li { margin: 0 0 3mm; }
  .obj-q { font-family: Fraunces, serif; font-size: 9.6pt; line-height: 1.3; margin: 0 0 1mm; color: #2a2118; }
  .obj-a { font-size: 8.7pt; line-height: 1.45; margin: 0; color: #4a4239; }
  .idea-title { font-size: 20pt; line-height: 1.12; margin: 0 0 4mm; string-set: entrytitle content(); break-after: avoid; }
  .talk { margin: 4mm 0 0; }
  .talk ul { margin: 0; padding-left: 4.5mm; }
  .talk li { font-size: 9pt; line-height: 1.45; margin: 0 0 1.4mm; }

  /* back matter */
  .back, .credits { page: plain; break-before: page; }
  .back h1, .credits h1 { font-size: 19pt; margin: 0 0 4mm; }
  .back p { max-width: 116mm; margin: 0 0 3.2mm; }
  ul.credits-list { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 9mm; }
  ul.credits-list li { break-inside: avoid; padding: 1.4mm 0; border-bottom: 0.3pt solid #e2dbcd; }
  .cr-title { display: inline; font-size: 7.4pt; line-height: 1.35; }
  .cr-meta { display: block; font-size: 6.8pt; color: #8a8072; margin-top: 0.3mm; }
  .credits-note { font-size: 7.8pt; color: #6b6257; margin: 6mm 0 0; max-width: 120mm; }
</style>
</head>
<body>

<section class="cover">
  <div class="cover-top">
    <p class="cover-kicker">Little Thinker</p>
    <h1>Philosophy<br>for Children</h1>
    <p class="cover-sub">${stories.length} stories, ${thinkers.length} thinkers, ${concepts.length} questions.</p>
    <p class="cover-note">Ages 6–12 · read it aloud</p>
  </div>
  <div class="cover-art">
    ${coverPlate ? `<img src="${coverPlate.file}" alt="${esc(coverPlate.alt)}">` : coverArt}
  </div>
  <div class="cover-foot">
    <span>little-thinker.browserstay.com</span>
    <span>One volume · three parts</span>
  </div>
</section>

<section class="front">
  <h1>How to use this book</h1>
  <p>This is one book in three parts. The stories come first: old tales, told plainly, each ending in the question it was invented to ask. Then the thinkers — thirty-three people who spent their lives on questions like these. Then the questions themselves, arranged as short arguments you can read in four minutes and argue about for an hour.</p>
  <p>Read one aloud. Stop at the question. Then wait — the waiting is the part that works. Do not rescue a child from the difficulty; the difficulty is the material.</p>
  <p>Under <em>After the story</em> you will find the history and the argument, for whoever wants to keep going. Skip it if the table has had enough. The ages printed with each entry are a suggestion, not a rule.</p>

  <h1 class="contents-h">Contents</h1>
  <p class="contents-part">Part One · Stories</p>
  <ol class="contents">${contentsList(stories, "story")}</ol>
  <p class="contents-part">Part Two · Thinkers</p>
  <ol class="contents">${contentsList(thinkers, "thinker")}</ol>
  <p class="contents-part">Part Three · Questions</p>
  <ol class="contents">${contentsList(concepts, "idea")}</ol>
</section>

<section class="part">
  <p class="part-label">Part One</p>
  <h1 class="part-title">Stories</h1>
  <p class="part-intro">Old tales, retold plainly. Each one ends where the argument starts, and every one of them was told to make somebody think rather than to make a point.</p>
</section>
${storyChapters}

<section class="part">
  <p class="part-label">Part Two</p>
  <h1 class="part-title">Thinkers</h1>
  <p class="part-intro">Thirty-three people who kept asking. Not saints and not heroes — several were wrong in ways that are still useful, which is the point of reading them.</p>
</section>
${thinkerChapters}

<section class="part">
  <p class="part-label">Part Three</p>
  <h1 class="part-title">Questions</h1>
  <p class="part-intro">Short arguments you can hold in one hand. Each ends in questions for the table rather than a conclusion, because the conclusion is the part you are supposed to reach yourself.</p>
</section>
${ideaChapters}

<section class="credits">
  <h1>Picture credits</h1>
  <ul class="credits-list">${creditRows}</ul>
  <p class="credits-note">Every picture is a public-domain or openly licensed work from Wikimedia Commons, credited above and linked on the website. Nothing here was generated.</p>
</section>

<section class="back">
  <h1>Where all this comes from</h1>
  <p>Nothing in this book is invented. The stories are retellings of older stories; the thinkers are described from their own words and the historical record; the questions come from arguments that have been running for centuries. The words are ours, the material is not. Every entry names its source, and the website links the edition used.</p>
  <p>little-thinker.browserstay.com — free, no accounts, no adverts, nothing collected.</p>
</section>

</body>
</html>
`;

// ---------- markdown twin, for pandoc (EPUB) ----------
const md = `---
title: "${TITLE}: ${SUBTITLE}"
author: Little Thinker
lang: en-GB
description: "${stories.length} stories, ${thinkers.length} thinkers and ${concepts.length} questions. Philosophy for children, ages 6–12."
---

# How to use this book

This is one book in three parts. The stories come first: old tales, told plainly, each ending in the question it was invented to ask. Then the thinkers. Then the questions themselves.

Read one aloud. Stop at the question. Then wait — the waiting is the part that works.

# Part One · Stories

${stories
  .map((s, i) => {
    const p = storyPlates.get(s.slug);
    const [story, after] = s.body.split(/\n-{3,}\n/).concat([""]);
    const afterText = (after ?? "").trim().replace(/^#{1,6}\s*After the story\s*\n+/i, "");
    return `## ${s.title}

<p class="plate-src">Story ${i + 1} · ${esc(s.source)} · ages ${s.agesMin}–${s.agesMax}</p>

${p ? `![${s.heroImageAlt ?? s.title}](${p.file})\n` : ""}
${story.trim()}

<div class="card">
<p class="card-label">The question</p>
<p class="card-q">${esc(s.ask)}</p>
</div>

${afterText ? `<div class="after">\n<p class="after-label">After the story</p>\n\n${afterText}\n</div>\n` : ""}
<p class="prov">${esc(s.sourceNote)}</p>
`;
  })
  .join("\n")}

# Part Two · Thinkers

${thinkers
  .map((t, i) => {
    const p = thinkerPlates.get(t.slug);
    return `## ${t.name}

<p class="plate-src">Thinker ${i + 1} · ${esc(t.years)} · ${esc(t.place)}</p>

${p ? `![${t.heroImageAlt ?? t.name}](${p.file})\n` : ""}
<p class="lede-text">${esc(t.oneLiner)}</p>

${t.body}

${t.quote ? `> “${t.quote}”\n>\n> ${t.quoteNote ?? ""}\n` : ""}
<div class="card">
<p class="card-label">The question</p>
<p class="card-q">${esc(t.bigQuestion)}</p>
</div>

${(t.facts ?? []).map((f) => `- ${f}`).join("\n")}

${t.activity ? `<div class="tryit">\n<p class="tryit-label">Try this</p>\n\n${t.activity}\n</div>\n` : ""}
`;
  })
  .join("\n")}

# Part Three · Questions

${concepts
  .map((c) => {
    const thinkers = (c.keyThinkers ?? [])
      .map((k) => `- **${k.who ?? k}** — ${k.view ?? ""}`)
      .join("\n");
    const objections = (c.objections ?? [])
      .map((o) => `> “${o.challenge}”\n>\n> ${o.reply}`)
      .join("\n\n");
    const talk = (c.talk ?? []).map((q) => `- ${q}`).join("\n");
    const further = (c.goFurther ?? [])
      .map((g) => `- **${g.title}**${g.who ? ` — ${g.who}` : ""}${g.note ? `. ${g.note}` : ""}`)
      .join("\n");
    const related = (c.related ?? []).map((r) => String(r).replace(/-/g, " ")).join(", ");

    return `## ${c.title}

<p class="plate-src">Question · ${esc(String(c.branch ?? "").replace(/-/g, " "))} · ages ${c.agesMin}–${c.agesMax}</p>

${c.hook}

${c.body}

${thinkers ? `### What the thinkers said\n\n${thinkers}\n` : ""}
${objections ? `### The usual objections\n\n${objections}\n` : ""}
${talk ? `### Ask each other\n\n${talk}\n` : ""}
${c.tryIt ? `<div class="tryit">\n<p class="tryit-label">Try this</p>\n\n${c.tryIt}\n</div>\n` : ""}
${further ? `### Go further\n\n${further}\n` : ""}
${related ? `<p class="prov">Questions next door: ${related}</p>` : ""}
`;
  })
  .join("\n")}

# Picture credits

${allPlates.map((p) => `- ${esc(cleanTitle(p.credit.title))} — ${esc(p.credit.author)}, ${esc(p.credit.license)} (Wikimedia Commons)`).join("\n")}

Every picture is a public-domain or openly licensed work from Wikimedia Commons, credited above and linked on the website. Nothing here was generated.

# Where all this comes from

Nothing in this book is invented. The stories are retellings of older stories; the thinkers are described from their own words and the historical record; the questions come from arguments that have been running for centuries. The words are ours, the material is not.

little-thinker.browserstay.com — free, no accounts, no adverts, nothing collected.
`;

writeFileSync(join(OUT, "book.html"), html);
writeFileSync(join(OUT, "book.md"), md);
console.log(
  `book: ${stories.length} stories, ${thinkers.length} thinkers, ${concepts.length} questions, ${allPlates.length} pictures → book/book.html + book/book.md`,
);
