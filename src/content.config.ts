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
  }),
});

export const collections = { philosophers, concepts };
