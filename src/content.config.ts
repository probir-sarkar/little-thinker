import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const branch = z.enum([
  "how-to-live",
  "what-is-real",
  "how-we-know",
  "who-am-i",
  "together",
  "beauty",
]);

const philosophers = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/philosophers" }),
  schema: z.object({
    name: z.string(),
    monogram: z.string().length(2),
    icon: z.string(),
    years: z.string(),
    birthYear: z.number(),
    deathYear: z.number(),
    place: z.string(),
    branch,
    oneLiner: z.string(),
    bigQuestion: z.string(),
    quote: z.string(),
    quoteNote: z.string(),
    heroImage: z.string(),
    heroImageAlt: z.string(),
    facts: z.array(z.string()).length(3),
    activity: z.string(),
  }),
});

const concepts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/concepts" }),
  schema: z.object({
    title: z.string(),
    branch,
    agesMin: z.number(),
    agesMax: z.number(),
    hook: z.string(),
    tryIt: z.string(),
    talk: z.array(z.string()).min(3),
    related: z.array(z.string()),
    // Optional depth. A page with these filled in is a place to think, not
    // just a place to read: the objection is the argument a child will
    // actually make, and the reply is somebody having thought about it.
    keyThinkers: z.array(z.object({ who: z.string(), view: z.string() })).default([]),
    objections: z.array(z.object({ challenge: z.string(), reply: z.string() })).default([]),
    goFurther: z.array(z.object({ title: z.string(), who: z.string(), note: z.string() })).default([]),
  }),
});

/**
 * Stories. These are retellings of tales that already exist — a myth, a
 * parable, a thought experiment — not invented examples. The source line is
 * part of the page, because a story that came from somewhere should say so.
 */
const stories = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/stories" }),
  schema: z.object({
    title: z.string(),
    source: z.string(),
    // The card label. Kept separate from `source` so the full provenance
    // stays on the page and the card stays short enough not to be truncated.
    sourceShort: z.string(),
    sourceNote: z.string(),
    agesMin: z.number(),
    agesMax: z.number(),
    hook: z.string(),
    ask: z.string(),
    tellIt: z.string(),
    ideas: z.array(z.string()).default([]),
  }),
});

export const collections = { philosophers, concepts, stories };
