# Think Small — philosophy for children

A real Astro project: 30 routes, content collections, build-time image
optimisation, and charts drawn as SVG from the content itself.

Live: <https://think-small-philosophy.probir.workers.dev>

## Commands

```bash
npm install
npm run dev        # local dev server
npm run build      # static output to dist/
npm run preview    # preview the built output
npx astro check    # type + template diagnostics
```

## Deploy

```bash
npm run build
cd deploy && npx wrangler@latest deploy     # assets directory: ../dist
```

`wrangler.jsonc` matters: `html_handling` must stay `auto-trailing-slash`.
With `none`, `/` 404s. With the default, `/ideas/fairness.html` 307-redirects
instead of serving, which breaks extensionless links.

**URL contract:** `build.format: "file"` writes `dist/ideas.html` and
`dist/ideas/fairness.html`. So canonical URLs are extensionless and have **no
trailing slash** — `/ideas`, not `/ideas/`. Cloudflare serves `ideas.html` at
`/ideas`; a trailing slash would look for `ideas/index.html` and 404. All
internal links are generated from this rule, so do not "fix" one to have a
trailing slash.

## Layout

```
src/
  content.config.ts            content collection schemas (zod)
  content/philosophers/*.md    9 entries: story body + frontmatter
  content/concepts/*.md        14 entries: body + frontmatter
  data/branches.json           the six themes and their colours
  data/credits.json            image provenance — powers /credits
  lib/site.ts                  branch lookup, era buckets, year formatting
  components/
    BaseLayout.astro           head, nav, footer, search palette, reader panel
    Portrait.astro             credited photo, or monogram medallion fallback
    PhilosopherCard.astro      ConceptCard.astro      Icon.astro
    charts/TimelineChart.astro     dumbbell timeline, 2,450 years wide
    charts/BranchChart.astro       coverage across the six themes
    charts/AgeRangeChart.astro     "reading ladder" of age bands
  pages/
    index.astro   philosophers/{index,[slug]}.astro   ideas/{index,[slug]}.astro
    wonder-wall.astro   grown-ups.astro   credits.astro   404.astro
    search.json.ts         search index generated from the collections
public/icons.svg             hand-authored 24-icon sprite
src/assets/images/           source images (optimised into dist/ at build)
scripts/import-content.py    one-off importer from the original prototype
```

## Why it is shaped this way

- **Content collections, not a database.** A new idea is one Markdown file.
  Pages, cards, charts and the search index all regenerate from those files, so
  the site cannot drift out of sync with its own content.
- **Charts are generated, not drawn.** Every chart reads the collections, so the
  numbers on screen are the numbers in the content.
- **Images are optimised at build.** `astro:assets` + sharp emits webp at several
  widths. Portraits fall back to a drawn monogram medallion when no correctly
  licensed photograph exists, so nobody gets an uncredited face.
- **Progressive enhancement.** The site reads fine with JavaScript off; the JS
  adds reading settings, read-aloud, search and votes, all in localStorage.
- **No accounts, no tracking, no backend.** A static site with no database has
  nothing to log in to — which is the point for an audience of children.

## Styling

Tailwind 4. Tokens live in `@theme` in `src/styles/global.css`; the repeated
composites (card, door, tool, qblock, facts, chart) are built from those tokens
with `@apply` in `@layer components`, so markup stays readable —
`class="card"` rather than fifteen utilities — while colour, spacing and type
still come from one source of truth.

Branch accents are not markup classes. Components pass the branch colour in as
`--card-accent`, because the value comes from `src/data/branches.json`:

```astro
<a class="card" style={`--card-accent:${branchOf(p.data.branch).color}`}>
```

One theme, deliberately. A five-theme experiment (riso/bauhaus/botanic/chalk)
was built on the token system and then retired — a theme that is harder to read
is a theme that fails the brief for six-to-twelve-year-olds.

**Pitfall:** a bare container selector catches SVGs you did not mean. `.chart
svg { width: 100% }` also matched the 14px icon in `.chart-head` and stretched
it to the width of the panel. Scope container rules to the plot
(`.chart-scroll svg`), never to `svg`.

## Honest limits

- Vote percentages on idea pages are **sample pilot figures**, not live data.
- Stories are retold for young readers and simplified on purpose.
- Portraits are historical artworks, not photographs of the subjects.
- The theme lab and four alternate themes were removed; only `ink` ships.
