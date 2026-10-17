#!/usr/bin/env node
/**
 * One-off: fetch a public-domain illustration for each story from Wikimedia
 * Commons, record full provenance into credits.json, and report the runner-up
 * candidates so a human can review the choices.
 *
 * Usage: node scripts/fetch-story-images.mjs [--review]  (--review = fetch nothing, just search)
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const UA = "little-thinker-site/1.0 (https://little-thinker.probir.dev; contact via site)";
const OUT = "src/assets/images";
const CREDITS = "src/data/credits.json";
const REVIEW = process.argv.includes("--review");

// Per story: candidate Commons searches, in order of preference.
const STORIES = [
  { id: "the-cave", q: ["Plato cave allegory engraving", "Saenredam Plato", "allegory of the cave drawing"] },
  { id: "the-butterfly", q: ["Zhuangzi butterfly", "butterfly Chinese painting album", "Chinese butterfly painting Qing"] },
  { id: "the-elephant", q: ["blind men and the elephant", "blind monks examining elephant", "blind men elephant Hanabusa"] },
  { id: "the-emperors-new-clothes", q: ["Kejserens nye Klæder", "Emperor's New Clothes Pedersen", "emperors new clothes illustration 19th century"] },
  { id: "the-ring", q: ["ring of Gyges", "Croesus coin Lydian", "Achaemenid gold ring"] },
  { id: "the-ship", q: ["Exekias Dionysus cup", "ancient greek ship vase painting", "trireme relief Athens"] },
  { id: "the-boy-who-cried-wolf", q: ["boy who cried wolf illustration", "wolf shepherd Aesop illustration", "the shepherd boy and the wolf"] },
  { id: "the-fox-and-the-grapes", q: ["fox and the grapes illustration", "fox grapes fable Crane", "fox and grapes Rackham"] },
  { id: "the-north-wind-and-the-sun", q: ["north wind and the sun fable", "Aesop sun wind illustration", "north wind sun Crane"] },
  { id: "the-heap", q: ["sheaf of wheat painting", "wheat sheaves Van Gogh", "harvest sheaf painting"] },
  { id: "achilles-and-the-tortoise", q: ["Achilles red-figure amphora", "Achilles vase painting", "Achilles tortoise"] },
  { id: "the-bundle-of-sticks", q: ["bundle of sticks fable", "father bundle sticks Aesop", "faggot sticks fable illustration"] },
];

const OK_LICENSE = /public domain|cc0|no restrictions|cc by(-sa)? \d/i;

async function api(params) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`API ${res.status} for ${url}`);
  return res.json();
}

async function search(query) {
  const data = await api({
    action: "query", format: "json",
    generator: "search", gsrnamespace: "6", gsrsearch: `${query} filetype:bitmap`, gsrlimit: "12",
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1400",
  });
  const pages = Object.values(data?.query?.pages ?? {});
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const meta = ii.extmetadata ?? {};
    const license = String(meta.LicenseShortName?.value ?? "").trim();
    if (!OK_LICENSE.test(license)) continue;
    if (!/image\/(jpeg|png)/.test(ii.mime ?? "")) continue;
    if ((ii.width ?? 0) < 500 || (ii.height ?? 0) < 350) continue;
    const ar = ii.width / ii.height;
    if (ar < 0.4 || ar > 3.5) continue;
    const strip = (html) => String(html ?? "").replace(/<[^>]+>/g, "").trim();
    out.push({
      title: p.title.replace(/^File:/, ""),
      author: strip(meta.Artist?.value) || "Unknown",
      license,
      license_url: String(meta.LicenseUrl?.value ?? ""),
      source_url: ii.descriptionurl,
      width: ii.width, height: ii.height,
      thumb: ii.thumburl, url: ii.url,
      dead: String(meta.Artist?.value ?? "").match(/(1[89]\d\d|20\d\d)\s*(–|-|—)\s*(\d{4})/)?.[3] ?? "?",
    });
  }
  // Public domain first, then search relevance (the API's order).
  const pd = out.filter((c) => /public domain|cc0|no restrictions/i.test(c.license));
  return [...pd, ...out.filter((c) => !pd.includes(c))];
}

for (const story of STORIES) {
  const file = `${story.id}.jpg`;
  const onDisk = existsSync(join(OUT, file));
  let chosen = null, candidates = [];
  for (const q of story.q) {
    candidates = await search(q);
    if (candidates.length) { chosen = candidates[0]; break; }
  }
  if (!chosen) { console.log(`✗ ${story.id}: nothing acceptable found`); continue; }
  console.log(`\n${story.id}: ${chosen.title}`);
  console.log(`   by ${chosen.author} (d. ${chosen.dead}) — ${chosen.license}`);
  console.log(`   ${chosen.width}×${chosen.height}  ${chosen.source_url}`);
  for (const c of candidates.slice(1, 3)) console.log(`   alt: ${c.title} — ${c.author} (d. ${c.dead}) — ${c.license}`);

  if (REVIEW || onDisk) { if (onDisk) console.log("   already on disk, skipping download"); continue; }

  const dl = chosen.width > 1600 && chosen.thumb ? chosen.thumb : chosen.url;
  const res = await fetch(dl, { headers: { "User-Agent": UA } });
  if (!res.ok) { console.log(`   ✗ download failed: ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(OUT, file), buf);
  console.log(`   saved ${file} (${Math.round(buf.length / 1024)} KiB)`);

  const credits = JSON.parse(readFileSync(CREDITS, "utf8"));
  if (!credits.some((c) => c.slug === story.id)) {
    credits.push({
      slug: story.id, file,
      title: chosen.title, author: chosen.author,
      license: chosen.license, license_url: chosen.license_url,
      source_url: chosen.source_url, direct_url: chosen.url,
      width: chosen.width, height: chosen.height,
      notes: `story illustration, downloaded ${Math.round(buf.length / 1024)} KiB`,
    });
    writeFileSync(CREDITS, JSON.stringify(credits, null, 2) + "\n");
  }
}
