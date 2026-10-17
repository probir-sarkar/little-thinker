# Little Thinker — philosophy for children

An Astro project: content collections, build-time image optimisation, a
build-time search index, and a static deploy with no backend.

Live: <https://little-thinker.probir.dev>

## Commands

```bash
npm install
npm run dev        # local dev server
npm run build      # checks + static output to dist/
npm run verify     # verify dist/ against the URL contract (links, 404, /)
npm run preview    # preview the built output
npm run deploy     # build, then wrangler deploy
```

## Deploy

`npm run deploy` builds and uploads `dist/` as Cloudflare Workers static
assets, per `wrangler.jsonc` at the repo root.

`wrangler.jsonc` matters: `html_handling` must stay `auto-trailing-slash`.
With `none`, `/` 404s. With the default, `/ideas/fairness.html` 307-redirects
instead of serving, which breaks extensionless links.

**URL contract:** `build.format: "file"` writes `dist/ideas.html` and
`dist/ideas/fairness.html`. So canonical URLs are extensionless and have **no
trailing slash** — `/ideas`, not `/ideas/`. Cloudflare serves `ideas.html` at
`/ideas`; a trailing slash would look for `ideas/index.html` and 404. All
internal links are generated from this rule, so do not "fix" one to have a
trailing slash. `npm run verify` re-checks every internal link in `dist/`
against this contract.

## Layout

```
src/
  content.config.ts            content collection schemas (zod)
  content/philosophers/*.md   one page per thinker: story + frontmatter
  content/concepts/*.md       one page per big idea: hook, try-it, objections…
  content/stories/*.md        retellings of real stories, source named
  data/branches.json           the six themes and their colours
  data/credits.json            image provenance — powers /credits
  lib/site.ts                  branch lookup, era buckets, year formatting
  lib/count.ts                 numbers written as words, so copy can't drift
  components/
    BaseLayout.astro           head, nav, footer, search palette, reader panel
    Portrait.astro             credited photo, or monogram medallion fallback
    PhilosopherCard.astro      ConceptCard.astro      Icon.astro
    islands/                   Preact islands: search, filters, votes, wonders,
                               reading settings — all localStorage-only
  pages/
    index.astro   about.astro   grown-ups.astro   credits.astro   404.astro
    philosophers/{index,[slug]}.astro
    ideas/{index,[slug]}.astro
    stories/{index,[slug]}.astro
    search.json.ts             search index generated from the collections
public/icons.svg               hand-authored icon sprite
public/robots.txt              points at the sitemap
src/assets/images/             source images (optimised into dist/ at build)
scripts/                       build-time checks (see below)
```

## Why it is shaped this way

- **Content collections, not a database.** A new idea is one Markdown file.
  Pages, cards and the search index all regenerate from those files, so the
  site cannot drift out of sync with its own content.
- **Images are optimised at build.** `astro:assets` + sharp emits webp at
  several widths. Portraits fall back to an **engraved monogram plate** when
  no portrait is known — same size, border and paper tone as a photograph, so
  the grid reads as one set. It is deliberately letters and not a drawn face:
  inventing a likeness for someone nobody ever painted is the one thing this
  site must not do. `heroImage: ""` declares "none known", which is different
  from a wrong filename; `check:assets` tells the two apart.
- **Progressive enhancement.** The site reads fine with JavaScript off; the JS
  adds reading settings, search, filters and votes, all in localStorage.
- **No backend today.** A static site with no database has nothing to log in
  to. The "what do you think?" box records the reader's own answer on their
  own device; nothing is sent anywhere. If the site ever gains accounts,
  analytics or a real vote tally, keep the reader-facing copy on `/about` in
  sync with what the site actually does.

## Build-time checks

`npm run build` runs all three; each one exists because something shipped
without it.

- `check:icons` — a wrong icon id renders as a blank gap; this fails the build
  instead.
- `check:assets` — fails if a page declares an image file that does not exist,
  if a credit has no matching entry, or if an image on disk has no credit.
  (A declared-but-missing image does not error in the component — it silently
  falls back to the monogram plate — so this check is the only symptom. That
  shipped three times before this check existed.)
- `check:copy` — reader-facing copy must not mention the build (see below).

## Styling

Tailwind 4. Tokens live in `@theme` in `src/styles/global.css`; the repeated
composites (card, door, tool, qblock, facts) are built from those tokens with
`@apply` in `@layer components`, so markup stays readable — `class="card"`
rather than fifteen utilities — while colour, spacing and type still come from
one source of truth.

Branch accents are not markup classes. Components pass the branch colour in as
`--card-accent`, because the value comes from `src/data/branches.json`:

```astro
<a class="card" style={`--card-accent:${branchOf(p.data.branch).color}`}>
```

One theme, deliberately. A five-theme experiment was built on the token system
and then retired — a theme that is harder to read is a theme that fails the
brief for young readers.

**Pitfall:** a bare container selector catches SVGs you did not mean.
`.chart svg { width: 100% }` also matched the 14px icon in a panel heading and
stretched it to the width of the panel. Scope container rules to the plot,
never to bare `svg`.

## Copy rules

This is a public site for readers, not a project page. Reader-facing copy must
not mention the build.

- **Never** put tooling words in page copy: Astro, Tailwind, SVG, JSON,
  Markdown, frontmatter, localStorage, build, deploy, database, island.
- Provenance lives in exactly one place: `/credits`. Pages link to it; they do
  not explain it.
- No section explaining the project to itself. "How the site was made" and
  "accessibility notes" are engineering notes and belong in this README, not
  on a page a child might open.
- Counts in copy come from the collections via `lib/count.ts`, never typed by
  hand — a typed number goes stale the moment content is added.

`scripts/check-copy.mjs` enforces this against the built HTML and fails the
build if tooling vocabulary reaches a rendered page.

## Honest limits

- There is no tally anywhere on the site. "What do you think?" records the
  reader's own answer on their own device; no answer is sent or counted,
  because there is no backend.
- Stories are retold for young readers and simplified on purpose.
- Portraits are historical artworks, not photographs of the subjects.
- There is no LICENSE yet, so all rights are reserved by default. Decide a
  licence (e.g. CC BY for content, MIT for code) before inviting reuse.
